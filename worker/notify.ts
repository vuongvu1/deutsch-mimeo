/**
 * Telegram notifications, Duolingo-flavoured and bilingual.
 *
 * Every message is German first, a separator, then the same message in English.
 * Copy pools are stored as aligned {de, en} pairs and picked as a unit, so both
 * halves always tell the same joke — two independent pools would drift.
 * Placeholders are `{who}`, `{them}`, `{title}`, `{days}`, `{done}`, `{total}`,
 * `{clock}`; `fill()` leaves an unknown one visible so typos surface loudly.
 *
 * This is server-side copy and involves no i18n files.
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
  slug: string
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

/** One line of copy in both languages. */
export interface Bilingual {
  de: string
  en: string
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

export const SEPARATOR = '➖➖➖➖➖➖➖'

/** Every 2 hours, 10:00–20:00 Berlin. The cron runs hourly and this filters. */
const NAG_HOURS: ReadonlySet<number> = new Set([10, 12, 14, 16, 18, 20])

/** 22:00 gets the end-of-day recap instead of another nag. */
const RECAP_HOUR = 22

/** Fraction of a goal that counts as "almost there". */
const ALMOST_THRESHOLD = 0.7

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

export function isRecapHour(now: Date): boolean {
  return berlinHour(now) === RECAP_HOUR
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

/**
 * Progress towards one goal, 0–1 and uncapped above 1. Percent rather than
 * "N rounds left" because `sessions.seconds` means seconds for `listen` and
 * rounds for `vocab`/`recall`, so there's no shared unit to name.
 */
export function progressRatio(
  goals: Goal[],
  rows: TotalRow[],
  challengeId: string,
  userId: string,
): number {
  const goal = goals.find((g) => g.id === challengeId)
  if (!goal || goal.daily_goal_seconds <= 0) return 0
  return totalFor(rows, userId, challengeId) / goal.daily_goal_seconds
}

export function isAlmostThere(
  goals: Goal[],
  rows: TotalRow[],
  challengeId: string,
  userId: string,
): boolean {
  const r = progressRatio(goals, rows, challengeId, userId)
  return r >= ALMOST_THRESHOLD && r < 1
}

/** Who cleared more challenges today. Null on a draw, including 0–0. */
export function dayWinner(statuses: UserStatus[]): string | null {
  const [a, b] = statuses
  if (a.done === b.done) return null
  return a.done > b.done ? a.userId : b.userId
}

// ── Copy ──────────────────────────────────────────────────────────────────────

function pick<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)]
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) => vars[key] ?? whole)
}

function render(v: Bilingual, de: Record<string, string>, en: Record<string, string>): Bilingual {
  return { de: fill(v.de, de), en: fill(v.en, en) }
}

/**
 * `challenges.title` is German because the UI renders it. The English half of
 * each message needs its own name, so translate by slug here rather than
 * touching the DB. An unknown slug falls back to the German title.
 */
const ENGLISH_TITLES: Record<string, string> = {
  listen: 'Listen 30 min',
  vocab: 'Vocab 10 rounds',
  listening: 'Listening 1×',
  recall: 'Recall 10 words',
}

export function titleFor(goal: Goal | undefined): Bilingual {
  if (!goal) return { de: 'eine Challenge', en: 'a challenge' }
  return { de: goal.title, en: ENGLISH_TITLES[goal.slug] ?? goal.title }
}

const CHALLENGE_VARIANTS: readonly Bilingual[] = [
  {
    de: `🎉 {who} hat "{title}" geschafft. So ein Vorzeigekind.`,
    en: `🎉 {who} finished "{title}". Look at this overachiever.`,
  },
  {
    de: `✅ {who} hat "{title}" einfach erledigt. Unaufgefordert. Beängstigend.`,
    en: `✅ {who} knocked out "{title}". Unprompted. Terrifying.`,
  },
  {
    de: `💪 "{title}" — erledigt von {who}. Die Messlatte liegt jetzt höher. Unhöflich.`,
    en: `💪 "{title}" — done by {who}. The bar has been raised. Rude.`,
  },
  {
    de: `🏆 {who} hat "{title}" abgeschlossen. Hier lässt jemand jemanden schlecht aussehen.`,
    en: `🏆 {who} cleared "{title}". Someone is making the other look bad.`,
  },
  {
    de: `📚 {who} hat "{title}" gemacht — wie ein Mensch mit geordnetem Leben.`,
    en: `📚 {who} did "{title}" like a person with their life together.`,
  },
  {
    de: `⚡ {who} ist mit "{title}" schon durch. {them}, kein Druck. Ein bisschen Druck.`,
    en: `⚡ {who} finished "{title}" already. {them}, no pressure. Some pressure.`,
  },
  {
    de: `🎯 {who} hat "{title}" fertig. Keine große Sache. {who} findet es eine große Sache.`,
    en: `🎯 {who} completed "{title}". Not a big deal. {who} thinks it's a big deal.`,
  },
  {
    de: `🧠 {who} hat "{title}" geschafft. Gehirnzellen: sichtbar größer.`,
    en: `🧠 {who} finished "{title}". Brain cells: visibly larger.`,
  },
  {
    de: `📈 "{title}" erledigt von {who}. Kategorie: Dinge, die {them} nicht gemacht hat.`,
    en: `📈 "{title}" done by {who}. Filed under: things {them} has not done.`,
  },
  {
    de: `😌 {who} hat "{title}" abgehakt und ist jetzt unerträglich gelassen.`,
    en: `😌 {who} wrapped "{title}" and is now unbearably calm about it.`,
  },
]

const DAY_VARIANTS: readonly Bilingual[] = [
  {
    de: `🔥 {who} hat den Tag komplett. {days} Tage insgesamt. Unerträglich.`,
    en: `🔥 {who} completed the day. {days} days total. Insufferable.`,
  },
  {
    de: `🔥 Tag komplett für {who} — {days} auf dem Konto. Selbstgefälligkeit: AN.`,
    en: `🔥 Day complete for {who} — {days} in the bank. Smug mode: ON.`,
  },
  {
    de: `🔥 {who} ist für heute fertig. {days} Tage. Kein Kommentar.`,
    en: `🔥 {who} is done for the day. {days} days total. No notes.`,
  },
  {
    de: `🔥 Tag {days} gesichert von {who}. {them}, die Uhr ist ein echtes Ding.`,
    en: `🔥 Day {days} secured by {who}. {them}, the clock is a real thing.`,
  },
  {
    de: `🏅 Tag komplett: {who}. Gesamtbilanz {days}. Denkmal folgt.`,
    en: `🏅 Day complete: {who}. Career total {days}. Statue pending.`,
  },
  {
    de: `🎊 {who} ist durch. {days} Tage. Bitte applaudieren.`,
    en: `🎊 {who} is done. {days} days. Please clap.`,
  },
  {
    de: `😤 {who} hat den Tag WIEDER geschafft. {days} insgesamt. Das ist ein Muster.`,
    en: `😤 {who} finished the day AGAIN. {days} total. This is a pattern.`,
  },
]

const OVERTAKE_VARIANTS: readonly Bilingual[] = [
  {
    de: `📈 {who} hat {them} bei "{title}" überholt. Unangenehm.`,
    en: `📈 {who} just passed {them} on "{title}". Awkward.`,
  },
  {
    de: `😤 {who} liegt jetzt vor {them} bei "{title}". Tu was dagegen.`,
    en: `😤 {who} is ahead of {them} on "{title}" now. Do something about it.`,
  },
  {
    de: `🚨 Überholt. {who} > {them} bei "{title}". Ehrlich gesagt peinlich.`,
    en: `🚨 Overtaken. {who} > {them} on "{title}". Embarrassing, honestly.`,
  },
  {
    de: `🥇 {who} führt gegen {them} bei "{title}". {them}, erklär dich.`,
    en: `🥇 {who} leads {them} on "{title}". {them}, explain yourself.`,
  },
  {
    de: `🏎️ {who} ist an {them} vorbeigezogen bei "{title}". Überall Staub.`,
    en: `🏎️ {who} blew past {them} on "{title}". Dust everywhere.`,
  },
  {
    de: `📊 Neue Rangliste bei "{title}": {who} Erster, {them} … auch anwesend.`,
    en: `📊 New leaderboard on "{title}": {who} first, {them} … also present.`,
  },
  {
    de: `👀 {who} > {them} bei "{title}". Das wird protokolliert.`,
    en: `👀 {who} > {them} on "{title}". This is being recorded.`,
  },
]

const STATUS_DONE_VARIANTS: readonly Bilingual[] = [
  { de: `{who}: {done}/{total} ✅`, en: `{who}: {done}/{total} ✅` },
  {
    de: `{who}: {done}/{total} erledigt, natürlich ✅`,
    en: `{who}: {done}/{total} done, obviously ✅`,
  },
  { de: `{who}: {done}/{total} — Musterschüler ✅`, en: `{who}: {done}/{total} — model citizen ✅` },
]

const STATUS_TODO_VARIANTS: readonly Bilingual[] = [
  { de: `{who}: noch nichts ❌`, en: `{who}: nothing yet ❌` },
  { de: `{who}: null. Gar nichts ❌`, en: `{who}: zero. Nothing. Zilch ❌` },
  { de: `{who}: immer noch 0/{total} ❌`, en: `{who}: still 0/{total} ❌` },
  { de: `{who}: nicht angefasst ❌`, en: `{who}: hasn't touched it ❌` },
  { de: `{who}: unentschuldigt abwesend ❌`, en: `{who}: absent without leave ❌` },
]

const TAUNT_VARIANTS: readonly Bilingual[] = [
  { de: `Die Eule macht sich Notizen. 🦉`, en: `The owl is taking notes. 🦉` },
  {
    de: `Deutsche Verben konjugieren sich nicht selbst.`,
    en: `German verbs do not conjugate themselves.`,
  },
  {
    de: `Duolingo hätte davon schon vier geschickt.`,
    en: `Duolingo would have sent four of these by now.`,
  },
  { de: `Ein bisschen Deutsch? Bitte? 🥺`, en: `A little German? Please? 🥺` },
  {
    de: `Das ist die freundliche Erinnerung. Die nächste wird es nicht.`,
    en: `This is the friendly reminder. The next one won't be.`,
  },
  { de: `Irgendwo weint ein Grammatikbuch.`, en: `Somewhere a grammar book is crying.` },
  {
    de: `Dein zukünftiges fließend sprechendes Ich ist sehr enttäuscht.`,
    en: `Your future fluent self is very disappointed.`,
  },
  {
    de: `Fünf Minuten. Das ist alles. Mach es nicht komisch.`,
    en: `Five minutes. That's all. Don't make this weird.`,
  },
  {
    de: `Der, die, das — und du weißt nicht welches.`,
    en: `Three words for "the" and you know none of them.`,
  },
  {
    de: `Ich mache das alle zwei Stunden weiter. Ich habe sonst nichts vor. 🦉`,
    en: `I will keep doing this every two hours. I have nothing else going on. 🦉`,
  },
  {
    de: `Stell dir vor, du bestellst selbstbewusst ein Brötchen. Das könntest du sein.`,
    en: `Imagine ordering a bread roll confidently. That could be you.`,
  },
  { de: `Der Dativ vermisst dich.`, en: `The dative case misses you.` },
  {
    de: `Du hast die App einmal geöffnet. Ich erinnere mich. Ich erinnere mich immer. 🦉`,
    en: `You opened this app once. I remember. I always remember. 🦉`,
  },
  {
    de: `Zehn Minuten Deutsch oder ein Leben lang auf Speisekarten zeigen. Wähle.`,
    en: `Ten minutes of German or a lifetime of pointing at menus. Choose.`,
  },
  {
    de: `Akkusativ oder Dativ? Du weißt es nicht. Das ist das Problem.`,
    en: `Accusative or dative? You don't know. That's the problem.`,
  },
  { de: `Keine Drohung, nur ein Zeitplan. 🦉`, en: `Not a threat, just a schedule. 🦉` },
  {
    de: `Deine Vokabeln sammeln Staub. Echten Staub.`,
    en: `Your vocabulary is gathering dust. Actual dust.`,
  },
  {
    de: `Irgendwo in Berlin bereitet sich eine Bäckerei darauf vor, dich zu verwirren.`,
    en: `Somewhere in Berlin, a bakery is preparing to confuse you.`,
  },
  {
    de: `Ich bin nicht sauer. Ich erwähne es beim nächsten Slot einfach wieder.`,
    en: `I'm not mad. I'm just going to mention it again at the next slot.`,
  },
]

const ALMOST_VARIANTS: readonly Bilingual[] = [
  {
    de: `😤 {who} ist bei {pct}% von "{title}". {pct} PROZENT. Nicht aufhören.`,
    en: `😤 {who} is at {pct}% of "{title}". {pct} PERCENT. Do not stop.`,
  },
  {
    de: `🫠 {who}, "{title}" ist zu {pct}% fertig. So kurz vorher aufhören ist eine Entscheidung.`,
    en: `🫠 {who}, "{title}" is {pct}% done. Quitting this close is a choice.`,
  },
  {
    de: `👏 {who} hat {pct}% von "{title}". Der Rest wartet nicht auf dich.`,
    en: `👏 {who} has {pct}% of "{title}". The rest isn't waiting for you.`,
  },
  {
    de: `⏳ "{title}": {pct}% von {who}. Der letzte Rest ist der einfache Teil. Angeblich.`,
    en: `⏳ "{title}": {pct}% by {who}. The last bit is the easy part. Allegedly.`,
  },
  {
    de: `🥲 {who} ist bei {pct}% von "{title}" und macht gerade wahrscheinlich etwas anderes.`,
    en: `🥲 {who} is at {pct}% of "{title}" and is probably doing something else now.`,
  },
]

const PERFECT_VARIANTS: readonly Bilingual[] = [
  {
    de: `🏆 {who} hat ALLE Challenges geschafft. Alle. Zeig damit nicht so an.`,
    en: `🏆 {who} finished EVERY challenge. All of them. Don't be smug about it.`,
  },
  {
    de: `👑 Perfekter Tag für {who}. {them}, das ist der Standard jetzt. Viel Glück.`,
    en: `👑 Perfect day for {who}. {them}, that's the standard now. Good luck.`,
  },
  {
    de: `🤯 {who} hat alles abgeräumt. Die Eule weiß nicht, was sie sagen soll. 🦉`,
    en: `🤯 {who} cleared the whole board. The owl is speechless. 🦉`,
  },
  {
    de: `🎖️ Alle Challenges erledigt von {who}. Das war nicht nötig, aber gut.`,
    en: `🎖️ Every challenge done by {who}. That was unnecessary, but fine.`,
  },
]

const RIVAL_DONE_VARIANTS: readonly Bilingual[] = [
  {
    de: `👀 {them} ist für heute fertig. {who} ist es nicht. Nur so als Info.`,
    en: `👀 {them} is done for today. {who} is not. Just saying.`,
  },
  {
    de: `🙃 {them} hat den Tag komplett. {who}, wie läuft's so?`,
    en: `🙃 {them} completed the day. {who}, how's it going over there?`,
  },
  {
    de: `📉 {them}: fertig. {who}: nicht fertig. Die Tabelle lügt nicht.`,
    en: `📉 {them}: done. {who}: not done. The table doesn't lie.`,
  },
  {
    de: `⌛ {them} ist durch und {who} hat noch Zeit. Theoretisch.`,
    en: `⌛ {them} is finished and {who} still has time. Theoretically.`,
  },
]

const NAG_HEADER: Bilingual = { de: `⏰ {clock} Kontrolle`, en: `⏰ {clock} check-in` }
const RECAP_HEADER: Bilingual = { de: `🌙 Tagesabschluss`, en: `🌙 End of day` }

const RECAP_WINNER_VARIANTS: readonly Bilingual[] = [
  { de: `👑 Heute gewinnt {who}. {them}, morgen ist auch ein Tag.`, en: `👑 {who} wins today. {them}, tomorrow is also a day.` },
  { de: `🥇 Tagessieg: {who}. Das wird notiert. 🦉`, en: `🥇 Winner today: {who}. This is being recorded. 🦉` },
  { de: `📊 {who} vor {them}. Wieder.`, en: `📊 {who} ahead of {them}. Again.` },
]

const RECAP_DRAW_VARIANTS: readonly Bilingual[] = [
  { de: `🤝 Unentschieden. Beide gleich gut oder gleich schlecht.`, en: `🤝 A draw. Equally good or equally bad.` },
  { de: `⚖️ Gleichstand heute. Wie langweilig.`, en: `⚖️ Tied today. How boring.` },
  { de: `😐 Niemand gewinnt. Die Eule ist trotzdem da. 🦉`, en: `😐 Nobody wins. The owl is still here. 🦉` },
]

function whoVars(userId: string): Record<string, string> {
  return { who: USER_LABELS[userId], them: USER_LABELS[otherUserId(userId)] }
}

export function challengeLine(userId: string, title: Bilingual): Bilingual {
  const base = whoVars(userId)
  return render(pick(CHALLENGE_VARIANTS), { ...base, title: title.de }, { ...base, title: title.en })
}

export function dayLine(userId: string, totalDays: number): Bilingual {
  const vars = { ...whoVars(userId), days: String(totalDays) }
  return render(pick(DAY_VARIANTS), vars, vars)
}

export function overtakeLine(userId: string, title: Bilingual): Bilingual {
  const base = whoVars(userId)
  return render(pick(OVERTAKE_VARIANTS), { ...base, title: title.de }, { ...base, title: title.en })
}

function statusLine(s: UserStatus): Bilingual {
  const vars = {
    who: USER_LABELS[s.userId],
    done: String(s.done),
    total: String(s.total),
  }
  const pool = s.complete ? STATUS_DONE_VARIANTS : STATUS_TODO_VARIANTS
  return render(pick(pool), vars, vars)
}

/** German block, separator, English block. */
export function bilingualMessage(lines: Bilingual[]): string {
  const de = lines.map((l) => l.de).join('\n')
  const en = lines.map((l) => l.en).join('\n')
  return `${de}\n${SEPARATOR}\n${en}`
}

export function almostLine(userId: string, title: Bilingual, ratio: number): Bilingual {
  const base = { ...whoVars(userId), pct: String(Math.floor(ratio * 100)) }
  return render(pick(ALMOST_VARIANTS), { ...base, title: title.de }, { ...base, title: title.en })
}

export function perfectLine(userId: string): Bilingual {
  const vars = whoVars(userId)
  return render(pick(PERFECT_VARIANTS), vars, vars)
}

/** Addressed to the user who is *behind*; `them` is the one who finished. */
export function rivalDoneLine(laggardId: string): Bilingual {
  const vars = whoVars(laggardId)
  return render(pick(RIVAL_DONE_VARIANTS), vars, vars)
}

export function nagMessage(hour: number, statuses: UserStatus[]): string {
  const clock = { clock: `${String(hour).padStart(2, '0')}:00` }
  return bilingualMessage([
    render(NAG_HEADER, clock, clock),
    ...statuses.map(statusLine),
    pick(TAUNT_VARIANTS),
  ])
}

export function recapMessage(statuses: UserStatus[]): string {
  const winner = dayWinner(statuses)
  const closing = winner
    ? render(pick(RECAP_WINNER_VARIANTS), whoVars(winner), whoVars(winner))
    : pick(RECAP_DRAW_VARIANTS)
  return bilingualMessage([RECAP_HEADER, ...statuses.map(statusLine), closing])
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
    `challenges?active=is.true&activated_on=lte.${localDate}&select=id,slug,title,daily_goal_seconds`,
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
    const title = titleFor(goals.find((g) => g.id === challengeId))

    const lines: Bilingual[] = []
    const claims: ClaimRow[] = []
    const tryClaim = async (
      kind: string,
      challenge: string | null,
      line: () => Promise<Bilingual>,
      claimant = userId,
    ) => {
      const row: ClaimRow = {
        user_id: claimant,
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
      if (done.size === goals.length) {
        await tryClaim('perfect', null, async () => perfectLine(userId))
      }
      // Claimed against the *other* user, so it fires once for whoever is behind
      // rather than once per completion of the one who's ahead.
      const laggard = otherUserId(userId)
      if (completedChallengeIds(goals, rows, laggard).size === 0) {
        await tryClaim('rivalDone', null, async () => rivalDoneLine(laggard), laggard)
      }
    } else if (isAlmostThere(goals, rows, challengeId, userId)) {
      const ratio = progressRatio(goals, rows, challengeId, userId)
      await tryClaim('almost', challengeId, async () => almostLine(userId, title, ratio))
    }

    if (hasOvertaken(rows, challengeId, userId)) {
      await tryClaim('overtake', challengeId, async () => overtakeLine(userId, title))
    }

    if (lines.length > 0) await send(env, bilingualMessage(lines), claims)
    return noContent()
  } catch (err) {
    console.error('[notify] handleNotify failed', err)
    return noContent()
  }
}

export async function handleScheduled(env: NotifyEnv, now: Date): Promise<void> {
  const recap = isRecapHour(now)
  if (!recap && !isNagHour(now)) return
  if (!isConfigured(env)) return
  try {
    const hour = berlinHour(now)
    const localDate = berlinLocalDate(now)
    const goals = await fetchGoals(env, localDate)
    // Derived from totals rather than from a missing 'day' notification, so the
    // nag is still correct if a doorbell ping was lost.
    const rows = await fetchTotals(env, localDate)
    const statuses = userStatuses(goals, rows)

    const claims: ClaimRow[] = []
    // The recap goes out even when both are done — it's a wrap-up, not a nag —
    // so it claims for both users. The nag only claims for whoever is behind, so
    // a fully finished day stays quiet.
    const claimants = recap ? statuses : statuses.filter((s) => !s.complete)
    for (const s of claimants) {
      const row: ClaimRow = {
        user_id: s.userId,
        kind: recap ? 'recap' : `nag${hour}`,
        challenge_id: null,
        local_date: localDate,
      }
      if (await claim(env, row)) claims.push(row)
    }
    if (claims.length === 0) return

    await send(env, recap ? recapMessage(statuses) : nagMessage(hour, statuses), claims)
  } catch (err) {
    console.error('[notify] handleScheduled failed', err)
  }
}

function noContent(): Response {
  return new Response(null, { status: 204 })
}
