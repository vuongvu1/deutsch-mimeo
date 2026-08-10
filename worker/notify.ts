/**
 * Telegram notifications, Duolingo-flavoured. Copy is English and deliberately
 * obnoxious; it is server-side only, so no i18n files are involved.
 *
 * Two entry points:
 *  - handleNotify: the client rings a doorbell after any session write; this
 *    decides whether anything is worth announcing. The client sends no totals
 *    and no before/after state, so all goal math lives here.
 *  - handleScheduled: the every-2-hours status nag, driven by an hourly cron.
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

export interface UserStatus {
  userId: string
  done: number
  total: number
  complete: boolean
}

interface ClaimRow {
  user_id: string
  kind: string
  challenge_id: string | null
  local_date: string
}

const TZ = 'Europe/Berlin'
const USER_IDS = ['mi', 'meo'] as const
const USER_LABELS: Record<string, string> = { mi: '🐷 Mi', meo: '🐱 Meo' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Every 2 hours, 10:00–22:00 Berlin. The cron runs hourly and this filters. */
const NAG_HOURS: ReadonlySet<number> = new Set([10, 12, 14, 16, 18, 20, 22])

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
 * Cloudflare crons are UTC-only, so the trigger runs every hour and this is what
 * decides which ones are nag slots in Berlin. That's the entire DST story — no
 * offset table, nothing to change twice a year.
 */
export function berlinHour(now: Date): number {
  return Number(berlinParts(now).h)
}

/** Matches the client's `local_date` — both users are in one timezone. */
export function berlinLocalDate(now: Date): string {
  const p = berlinParts(now)
  return `${p.y}-${p.m}-${p.d}`
}

export function isNagHour(now: Date): boolean {
  return NAG_HOURS.has(berlinHour(now))
}

function totalFor(rows: TotalRow[], userId: string, challengeId: string): number {
  let sum = 0
  for (const r of rows) {
    if (r.user_id === userId && r.challenge_id === challengeId) sum += r.total_seconds
  }
  return sum
}

export function completedChallengeIds(
  goals: Goal[],
  rows: TotalRow[],
  userId: string,
): Set<string> {
  const done = new Set<string>()
  for (const g of goals) {
    if (totalFor(rows, userId, g.id) >= g.daily_goal_seconds) done.add(g.id)
  }
  return done
}

export function userStatuses(goals: Goal[], rows: TotalRow[]): UserStatus[] {
  return USER_IDS.map((userId) => {
    const done = completedChallengeIds(goals, rows, userId).size
    return { userId, done, total: goals.length, complete: done > 0 }
  })
}

export function otherUserId(userId: string): string {
  return userId === 'mi' ? 'meo' : 'mi'
}

/**
 * True when `userId` is now ahead of the other user on this challenge. Requires
 * the rival to have a nonzero total so a 1–0 lead at 8am isn't an "overtake".
 *
 * ponytail: level comparison, not a real edge trigger — the Worker only sees
 * current totals. The dedup claim is what stops it repeating; upgrade to a
 * stored previous-total column only if once-per-day-per-challenge feels wrong.
 */
export function hasOvertaken(rows: TotalRow[], challengeId: string, userId: string): boolean {
  const mine = totalFor(rows, userId, challengeId)
  const theirs = totalFor(rows, otherUserId(userId), challengeId)
  return theirs > 0 && mine > theirs
}

// ── Copy ──────────────────────────────────────────────────────────────────────

function pick(pool: readonly string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

export function challengeLine(userId: string, title: string): string {
  const who = USER_LABELS[userId]
  const them = USER_LABELS[otherUserId(userId)]
  return pick([
    `🎉 ${who} finished "${title}". Look at this overachiever.`,
    `✅ ${who} knocked out "${title}". Unprompted. Terrifying.`,
    `💪 "${title}" — done by ${who}. The bar has been raised. Rude.`,
    `🏆 ${who} cleared "${title}". Someone is making the other look bad.`,
    `📚 ${who} did "${title}" like a person with their life together.`,
    `⚡ ${who} finished "${title}" already. ${them}, no pressure. Some pressure.`,
    `🫡 "${title}": handled by ${who}. Respect, and also envy.`,
    `🎯 ${who} completed "${title}". Not a big deal. ${who} thinks it's a big deal.`,
    `🥳 ${who} did "${title}". The German language remains undefeated but ${who} landed a punch.`,
    `📈 "${title}" done by ${who}. Filed under: things ${them} has not done.`,
    `🧠 ${who} finished "${title}". Brain cells: visibly larger.`,
    `😌 ${who} wrapped "${title}" and is now unbearably calm about it.`,
  ])
}

export function dayLine(userId: string, totalDays: number): string {
  const who = USER_LABELS[userId]
  const them = USER_LABELS[otherUserId(userId)]
  return pick([
    `🔥 ${who} completed the day. ${totalDays} days total. Insufferable.`,
    `🔥 Day complete for ${who} — ${totalDays} in the bank. Smug mode: ON.`,
    `🔥 ${who} is done for the day. ${totalDays} days total. No notes.`,
    `🔥 That's the day for ${who}. ${totalDays} days. Showing off now.`,
    `🔥 Day ${totalDays} secured by ${who}. ${them}, the clock is a real thing.`,
    `🌟 ${who} closed the day out. ${totalDays} days. Basically German now.`,
    `🏅 Day complete: ${who}. Career total ${totalDays}. Statue pending.`,
    `🎊 ${who} is done. ${totalDays} days. Please clap.`,
    `😤 ${who} finished the day AGAIN. ${totalDays} total. This is a pattern.`,
  ])
}

export function overtakeLine(userId: string, title: string): string {
  const who = USER_LABELS[userId]
  const them = USER_LABELS[otherUserId(userId)]
  return pick([
    `📈 ${who} just passed ${them} on "${title}". Awkward.`,
    `😤 ${who} is ahead of ${them} on "${title}" now. Do something about it.`,
    `🚨 Overtaken. ${who} > ${them} on "${title}". Embarrassing, honestly.`,
    `🥇 ${who} leads ${them} on "${title}". ${them}, explain yourself.`,
    `🏎️ ${who} blew past ${them} on "${title}". Dust everywhere.`,
    `📊 New leaderboard on "${title}": ${who} first, ${them} … also present.`,
    `👀 ${who} > ${them} on "${title}". This is being recorded.`,
    `🪤 ${them} got overtaken on "${title}" by ${who}. Rough hour.`,
    `🧨 ${who} took the lead on "${title}". ${them}, your move. Or don't. Cool.`,
  ])
}

function statusLine(s: UserStatus): string {
  const who = USER_LABELS[s.userId]
  if (s.complete) {
    return pick([
      `${who}: ${s.done}/${s.total} ✅`,
      `${who}: ${s.done}/${s.total} done, obviously ✅`,
      `${who}: ${s.done}/${s.total} — model citizen ✅`,
    ])
  }
  return pick([
    `${who}: nothing yet ❌`,
    `${who}: zero. Null. Nichts ❌`,
    `${who}: still 0/${s.total} ❌`,
    `${who}: hasn't touched it ❌`,
    `${who}: absent without leave ❌`,
  ])
}

function taunt(): string {
  return pick([
    `The owl is taking notes. 🦉`,
    `German verbs do not conjugate themselves.`,
    `Duolingo would have sent four of these by now.`,
    `Ein bisschen Deutsch? Bitte? 🥺`,
    `This is the friendly reminder. The next one won't be.`,
    `Somewhere a grammar book is crying.`,
    `Your future fluent self is very disappointed.`,
    `Five minutes. That's all. Don't make this weird.`,
    `Der, die, das are not going to learn themselves.`,
    `I will keep doing this every two hours. I have nothing else going on. 🦉`,
    `Imagine ordering a Brötchen confidently. That could be you.`,
    `The dative case misses you.`,
    `Studies show people who ignore this notification remain not-German.`,
    `You opened this app once. I remember. I always remember. 🦉`,
    `Ten minutes of German or a lifetime of pointing at menus. Choose.`,
    `Akkusativ oder Dativ? You don't know. That's the problem.`,
    `Not a threat, just a schedule. 🦉`,
    `Your Vokabeln are gathering dust. Actual dust.`,
    `Somewhere in Berlin, a bakery is preparing to confuse you.`,
    `I'm not mad. I'm just going to mention it again at the next slot.`,
  ])
}

export function nagMessage(hour: number, statuses: UserStatus[]): string {
  const clock = `${String(hour).padStart(2, '0')}:00`
  const lines = statuses.map(statusLine).join('\n')
  return `⏰ ${clock} check-in\n${lines}\n${taunt()}`
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

/** Both users, always — the overtake check and the nag both need the rival. */
function fetchTotals(env: NotifyEnv, localDate: string): Promise<TotalRow[]> {
  return sbGet<TotalRow>(
    env,
    `daily_challenge_totals?local_date=eq.${localDate}&select=user_id,challenge_id,total_seconds`,
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
 * Hand a claim back when the send fails, so the next ping (or the next cron)
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
 * template and can't inject text, and the dedup index caps output per user per
 * day — so abuse costs requests, not spam. Always 204: the client has nothing
 * useful to do with a failure.
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
    const rows = await fetchTotals(env, localDate)
    const done = completedChallengeIds(goals, rows, userId)
    const title = goals.find((g) => g.id === challengeId)?.title ?? 'a challenge'

    const lines: string[] = []
    const claims: ClaimRow[] = []
    const tryClaim = async (kind: string, challenge: string | null, line: () => Promise<string>) => {
      const row: ClaimRow = {
        user_id: userId,
        kind,
        challenge_id: challenge,
        local_date: localDate,
      }
      if (!(await claim(env, row))) return
      claims.push(row)
      lines.push(await line())
    }

    if (done.has(challengeId)) {
      await tryClaim('challenge', challengeId, async () => challengeLine(userId, title))
      // Any one challenge completes the day, so the first completion of the day
      // claims both kinds and the two events merge into a single message.
      await tryClaim('day', null, async () =>
        dayLine(userId, await fetchCompleteDayCount(env, userId)),
      )
    }

    if (hasOvertaken(rows, challengeId, userId)) {
      await tryClaim('overtake', challengeId, async () => overtakeLine(userId, title))
    }

    if (lines.length > 0) await send(env, lines.join('\n'), claims)
    return noContent()
  } catch (err) {
    console.error('[notify] handleNotify failed', err)
    return noContent()
  }
}

export async function handleScheduled(env: NotifyEnv, now: Date): Promise<void> {
  if (!isNagHour(now)) return
  if (!isConfigured(env)) return
  try {
    const hour = berlinHour(now)
    const localDate = berlinLocalDate(now)
    const goals = await fetchGoals(env, localDate)
    // Derived from totals rather than from a missing 'day' notification, so the
    // nag is still correct if a doorbell ping was lost.
    const rows = await fetchTotals(env, localDate)
    const statuses = userStatuses(goals, rows)

    // Claim per incomplete user so each slot nags at most once. If everyone is
    // done there is nothing to claim and the group stays quiet.
    const claims: ClaimRow[] = []
    for (const s of statuses) {
      if (s.complete) continue
      const row: ClaimRow = {
        user_id: s.userId,
        kind: `nag${hour}`,
        challenge_id: null,
        local_date: localDate,
      }
      if (await claim(env, row)) claims.push(row)
    }
    if (claims.length === 0) return

    await send(env, nagMessage(hour, statuses), claims)
  } catch (err) {
    console.error('[notify] handleScheduled failed', err)
  }
}

function noContent(): Response {
  return new Response(null, { status: 204 })
}
