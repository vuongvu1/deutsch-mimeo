/**
 * Telegram notifications.
 *
 * Two entry points:
 *  - handleNotify: the client rings a doorbell after any session write; this
 *    decides whether anything is worth announcing. The client sends no totals
 *    and no before/after state, so all goal math lives here.
 *  - handleScheduled: the 21:00 nag, driven by a Cloudflare cron trigger.
 *
 * Both are idempotent. Every send is preceded by a claim against the
 * `notifications` unique index, so repeated pings, two devices, a redeploy
 * mid-flight or a cron that fires twice all converge on exactly one message.
 */

export interface NotifyEnv {
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_CHAT_ID: string
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
}

export interface Goal {
  id: string
  title: string
  daily_goal_seconds: number
}

export interface TotalRow {
  user_id: string
  challenge_id: string
  total_seconds: number
}

interface ClaimRow {
  user_id: string
  kind: 'challenge' | 'day' | 'nag'
  challenge_id: string | null
  local_date: string
}

const TZ = 'Europe/Berlin'
const NAG_HOUR = 21
const USER_IDS = ['mi', 'meo'] as const
const USER_LABELS: Record<string, string> = { mi: '🐷 Mi', meo: '🐱 Meo' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Pure helpers (covered by notify.test.ts) ──────────────────────────────────

function berlinParts(now: Date): { y: string; m: string; d: string; h: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') }
}

/**
 * Cloudflare crons are UTC-only, so the trigger fires at both 19:00 and 20:00
 * UTC and this is what decides which one is actually 21:00 in Berlin. That's
 * the entire DST story — no offset table, nothing to change twice a year.
 */
export function berlinHour(now: Date): number {
  return Number(berlinParts(now).h)
}

/** Matches the client's `local_date` — both users are in one timezone. */
export function berlinLocalDate(now: Date): string {
  const p = berlinParts(now)
  return `${p.y}-${p.m}-${p.d}`
}

export function completedChallengeIds(
  goals: Goal[],
  rows: TotalRow[],
  userId: string,
): Set<string> {
  const totals = new Map<string, number>()
  for (const r of rows) {
    if (r.user_id !== userId) continue
    totals.set(r.challenge_id, (totals.get(r.challenge_id) ?? 0) + r.total_seconds)
  }
  const done = new Set<string>()
  for (const g of goals) {
    if ((totals.get(g.id) ?? 0) >= g.daily_goal_seconds) done.add(g.id)
  }
  return done
}

export function incompleteUserIds(goals: Goal[], rows: TotalRow[]): string[] {
  return USER_IDS.filter((u) => completedChallengeIds(goals, rows, u).size === 0)
}

// ── Supabase REST ─────────────────────────────────────────────────────────────

function sbHeaders(env: NotifyEnv): Record<string, string> {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function sbGet<T>(env: NotifyEnv, query: string): Promise<T[]> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${query}`, { headers: sbHeaders(env) })
  if (!res.ok) throw new Error(`Supabase GET ${query} failed: ${res.status}`)
  return (await res.json()) as T[]
}

/** Mirrors the daily_completion view's activated_on gate. */
function fetchGoals(env: NotifyEnv, localDate: string): Promise<Goal[]> {
  return sbGet<Goal>(
    env,
    `challenges?active=is.true&activated_on=lte.${localDate}&select=id,title,daily_goal_seconds`,
  )
}

function fetchTotals(env: NotifyEnv, localDate: string, userId?: string): Promise<TotalRow[]> {
  const user = userId ? `&user_id=eq.${userId}` : ''
  return sbGet<TotalRow>(
    env,
    `daily_challenge_totals?local_date=eq.${localDate}${user}&select=user_id,challenge_id,total_seconds`,
  )
}

async function fetchCompleteDayCount(env: NotifyEnv, userId: string): Promise<number> {
  const rows = await sbGet<{ local_date: string }>(
    env,
    `daily_completion?user_id=eq.${userId}&all_complete=is.true&select=local_date`,
  )
  return rows.length
}

/**
 * Atomic claim. A non-empty response means this request won the race and owns
 * the send; empty means someone already sent it. A failed request returns false
 * so a transient Supabase error never turns into a duplicate message.
 */
async function claim(env: NotifyEnv, row: ClaimRow): Promise<boolean> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/notifications?on_conflict=user_id,kind,local_date,challenge_id`,
    {
      method: 'POST',
      headers: {
        ...sbHeaders(env),
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify(row),
    },
  )
  if (!res.ok) {
    console.error('[notify] claim failed', res.status, await res.text())
    return false
  }
  const inserted = (await res.json()) as unknown[]
  return Array.isArray(inserted) && inserted.length > 0
}

/**
 * Hand a claim back when the send fails, so the next ping (or tomorrow's cron)
 * retries instead of the message being lost to a transient Telegram 429.
 */
async function release(env: NotifyEnv, row: ClaimRow): Promise<void> {
  const challenge = row.challenge_id ? `eq.${row.challenge_id}` : 'is.null'
  const query =
    `notifications?user_id=eq.${row.user_id}&kind=eq.${row.kind}` +
    `&local_date=eq.${row.local_date}&challenge_id=${challenge}`
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${query}`, {
    method: 'DELETE',
    headers: sbHeaders(env),
  })
  if (!res.ok) console.error('[notify] release failed', res.status)
}

// ── Telegram ──────────────────────────────────────────────────────────────────

async function send(env: NotifyEnv, text: string, claims: ClaimRow[]): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  })
  if (res.ok) return
  console.error('[notify] sendMessage failed', res.status, await res.text())
  await Promise.all(claims.map((c) => release(env, c)))
}

function isConfigured(env: NotifyEnv): boolean {
  const ok =
    !!env.TELEGRAM_BOT_TOKEN &&
    !!env.TELEGRAM_CHAT_ID &&
    !!env.SUPABASE_URL &&
    !!env.SUPABASE_PUBLISHABLE_KEY
  if (!ok) console.warn('[notify] skipped — Telegram/Supabase vars not configured')
  return ok
}

// ── Entry points ──────────────────────────────────────────────────────────────

/**
 * Public and unauthenticated, like /api/listening/generate. The body selects a
 * template and can't inject text, and the dedup index caps output at 5 messages
 * per user per day however hard this is hit — so abuse costs requests, not spam.
 * Always 204: the client has nothing useful to do with a failure.
 */
export async function handleNotify(request: Request, env: NotifyEnv): Promise<Response> {
  try {
    const body = (await request.json()) as { userId?: unknown; challengeId?: unknown }
    const userId = typeof body.userId === 'string' ? body.userId : ''
    const challengeId = typeof body.challengeId === 'string' ? body.challengeId : ''
    if (!USER_IDS.includes(userId as (typeof USER_IDS)[number])) return noContent()
    if (!UUID_RE.test(challengeId)) return noContent()
    if (!isConfigured(env)) return noContent()

    const localDate = berlinLocalDate(new Date())
    const goals = await fetchGoals(env, localDate)
    const rows = await fetchTotals(env, localDate, userId)
    const done = completedChallengeIds(goals, rows, userId)
    if (done.size === 0) return noContent()

    const lines: string[] = []
    const claims: ClaimRow[] = []

    if (done.has(challengeId)) {
      const row: ClaimRow = {
        user_id: userId,
        kind: 'challenge',
        challenge_id: challengeId,
        local_date: localDate,
      }
      if (await claim(env, row)) {
        claims.push(row)
        const title = goals.find((g) => g.id === challengeId)?.title ?? 'eine Challenge'
        lines.push(`${USER_LABELS[userId]} hat "${title}" geschafft! ✅`)
      }
    }

    // Any one challenge completes the day, so the first completion of the day
    // claims both kinds and the two events merge into a single message.
    const dayRow: ClaimRow = {
      user_id: userId,
      kind: 'day',
      challenge_id: null,
      local_date: localDate,
    }
    if (await claim(env, dayRow)) {
      claims.push(dayRow)
      const total = await fetchCompleteDayCount(env, userId)
      lines.push(`🔥 Tag komplett! (${total} Tage insgesamt)`)
    }

    if (lines.length > 0) await send(env, lines.join('\n'), claims)
    return noContent()
  } catch (err) {
    console.error('[notify] handleNotify failed', err)
    return noContent()
  }
}

export async function handleScheduled(env: NotifyEnv, now: Date): Promise<void> {
  if (berlinHour(now) !== NAG_HOUR) return
  if (!isConfigured(env)) return
  try {
    const localDate = berlinLocalDate(now)
    const goals = await fetchGoals(env, localDate)
    // Derived from totals rather than from a missing 'day' notification, so the
    // nag is still correct if a doorbell ping was lost.
    const rows = await fetchTotals(env, localDate)
    const slackers = incompleteUserIds(goals, rows)
    if (slackers.length === 0) return

    const claims: ClaimRow[] = []
    for (const userId of slackers) {
      const row: ClaimRow = { user_id: userId, kind: 'nag', challenge_id: null, local_date: localDate }
      if (await claim(env, row)) claims.push(row)
    }
    if (claims.length === 0) return

    const names = claims.map((c) => USER_LABELS[c.user_id]).join('\n')
    await send(env, `⏰ 21:00 — heute noch nichts geschafft:\n${names}\nNoch 3 Stunden! 💪`, claims)
  } catch (err) {
    console.error('[notify] handleScheduled failed', err)
  }
}

function noContent(): Response {
  return new Response(null, { status: 204 })
}
