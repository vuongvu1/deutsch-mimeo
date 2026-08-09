import { handleNotify, handleScheduled, type NotifyEnv } from './notify'

interface Env extends NotifyEnv {
  GEMINI_API_KEY: string
  ASSETS: Fetcher
}

type Level = 'A1' | 'A2' | 'B1' | 'B2'
type QuestionType = 'richtig_falsch' | 'multiple_choice'

interface GenerateRequest {
  level: Level
  targetMinutes: number
  numQuestions: number
}

interface ListeningQuestion {
  type: QuestionType
  q: string
  options: string[]
  correctIndex: number
  explanationDe: string
  explanationEn: string
}

interface ListeningExercise {
  transcript: string
  questions: ListeningQuestion[]
}

const VALID_LEVELS: ReadonlySet<string> = new Set(['A1', 'A2', 'B1', 'B2'])
const VALID_MINUTES: ReadonlySet<number> = new Set([1, 2, 3, 5])
const VALID_QUESTIONS: ReadonlySet<number> = new Set([5, 10, 15])

// German conversational TTS ≈ 140 wpm; the frontend uses rate ≈ 0.9 so this is approximate.
const WORDS_PER_MINUTE = 140

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['richtig_falsch', 'multiple_choice'] },
          q: { type: 'STRING' },
          options: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          correctIndex: { type: 'INTEGER' },
          explanationDe: { type: 'STRING' },
          explanationEn: { type: 'STRING' },
        },
        required: ['type', 'q', 'options', 'correctIndex', 'explanationDe', 'explanationEn'],
      },
    },
  },
  required: ['transcript', 'questions'],
}

interface Blueprint {
  // English description of the audio's text type for the chosen level.
  textType: string
  // Difficulty / vocabulary guidance.
  difficulty: string
  // Fraction of questions that should be richtig/falsch (the rest are 3-option MC).
  rfRatio: number
}

// Each level mirrors the Goethe-Zertifikat "Hören" exam for that level, collapsed
// to a single audio: the text type, difficulty and richtig-falsch ↔ multiple-choice
// balance shift up the CEFR scale.
const BLUEPRINTS: Record<Level, Blueprint> = {
  A1: {
    textType:
      'a short public announcement, a voicemail, or a simple everyday dialogue between two people (if it is a dialogue, prefix each turn with a speaker label such as "Mann:", "Frau:")',
    difficulty:
      'Use only high-frequency everyday words and short present-tense sentences. The questions test concrete, literal facts (times, prices, places, names, simple actions).',
    rfRatio: 2 / 3,
  },
  A2: {
    textType:
      'an everyday conversation, a phone message, or a short radio snippet or interview (if it is a dialogue, prefix each turn with a speaker label such as "Mann:", "Frau:")',
    difficulty:
      'Use common everyday vocabulary and simple connectors (weil, aber, dann, deshalb). The questions test facts plus simple opinions or intentions.',
    rfRatio: 1 / 2,
  },
  B1: {
    textType:
      'an interview, a radio report, a short presentation (Vortrag), or a discussion on a familiar everyday topic (if it is a dialogue, prefix each turn with a speaker label such as "Moderator:", "Frau Bauer:")',
    difficulty:
      'Use a wider range of vocabulary with some abstraction; speakers express opinions and give reasons. The questions test main ideas, specific details, and light inference.',
    rfRatio: 1 / 3,
  },
  B2: {
    textType:
      'an in-depth interview, a debate or discussion between two speakers, or a short lecture on an abstract or topical subject (if it is a dialogue, prefix each turn with a speaker label)',
    difficulty:
      'Use advanced vocabulary, argumentation and implicit meaning. The questions test detail, speaker attitude and opinion, implication, and overall gist.',
    rfRatio: 1 / 5,
  },
}

interface TopicDomain {
  // Domains below this level are excluded for lower levels (default: all levels).
  minLevel?: Level
  topics: string[]
}

// Gemini mode-collapses onto a handful of favorite topics when asked to "pick a
// varied topic at random", regardless of temperature. Real variety has to come
// from outside the model: the Worker rolls the dice and injects a concrete
// topic + story angle into the prompt.
const TOPIC_DOMAINS: TopicDomain[] = [
  {
    topics: [
      'a mix-up with a package delivery',
      'losing the apartment keys',
      'a visit to the neighborhood flea market',
      'returning a faulty product to a shop',
      'booking a haircut appointment',
      'a power outage in the building',
      'borrowing a tool from a neighbor',
      'finding a lost wallet on the street',
      'a long queue at the post office',
      'a new supermarket opening nearby',
    ],
  },
  {
    topics: [
      'the first day at a new job',
      'calling in sick to work',
      'a farewell party for a colleague',
      'trouble on the daily commute',
      'scheduling a team meeting',
      'a job interview for a part-time position',
      'the office coffee machine breaking down',
      'working from home for the first time',
      'a lunch break conversation between colleagues',
      'asking the boss for a day off',
    ],
  },
  {
    topics: [
      'a delayed train on the way to a wedding',
      'booking a hotel room with a special request',
      'asking a stranger for directions',
      'renting bicycles for a day trip',
      'lost luggage at the airport',
      'a road trip interrupted by a flat tire',
      'a guided sightseeing tour through an old town',
      'missing the last bus connection',
      'packing for a weekend trip',
      'a misunderstanding at the ticket counter',
    ],
  },
  {
    topics: [
      'trying a newly opened restaurant',
      'a cooking class for beginners',
      'baking a cake for a birthday',
      'a Saturday visit to the farmers market',
      'a dinner guest with a food allergy',
      'a pizza order that goes wrong',
      'discovering a regional specialty',
      'planning the menu for a family celebration',
      'a picnic in the park',
      'comparing homemade food with takeout',
    ],
  },
  {
    topics: [
      'a check-up appointment at the doctor',
      'joining a gym for the new year',
      'a beginner yoga course',
      'a sprained ankle from jogging',
      'a visit to the dentist',
      'training for a charity run',
      'a new sports club opening in town',
      'trying to sleep better',
      'a pharmacy consultation about a cold',
      'swimming lessons for adults',
    ],
  },
  {
    topics: [
      'moving into a new apartment',
      'noisy neighbors and how to deal with them',
      'assembling furniture from a flat-pack',
      'a broken heating system in winter',
      'starting a small balcony garden',
      'house-sitting for friends on holiday',
      'organizing a party for the whole building',
      'redecorating the living room',
      'a leaking washing machine',
      'looking for a bigger flat',
    ],
  },
  {
    topics: [
      'a weekend hike in the mountains',
      'planting a community garden',
      'confusion about local recycling rules',
      'a storm warning and its consequences',
      'a birdwatching trip at the lake',
      'a beach clean-up with volunteers',
      'an unusually hot summer week',
      'a mushroom-picking excursion in autumn',
      'feeding ducks: allowed or not?',
      'a city park getting renovated',
    ],
  },
  {
    topics: [
      'a forgotten password and account recovery',
      'buying a new phone and choosing a plan',
      'a smart-home gadget that misbehaves',
      'a video call with family abroad',
      'learning to use a new app',
      'a laptop repair taking longer than promised',
      'switching to a cheaper internet provider',
      'a warning about an online shopping scam',
      'teaching grandparents to use a tablet',
      'a navigation app leading the wrong way',
    ],
  },
  {
    topics: [
      'buying tickets for a sold-out concert',
      'a museum exhibition about everyday life 100 years ago',
      'a book club discussing a bestseller',
      'learning a musical instrument as an adult',
      'a small-town film festival',
      'photography as a new hobby',
      'a board game evening with friends',
      'a street festival in the neighborhood',
      'a pottery workshop on the weekend',
      'a choir looking for new members',
    ],
  },
  {
    minLevel: 'B1',
    topics: [
      'volunteering in the local community',
      'remote work versus office work',
      'paying with cash versus card',
      'the urban gardening movement',
      'generational differences in media use',
      'e-scooters in cities: blessing or nuisance',
      'why fewer young people get a driving license',
      'the revival of repair cafés',
      'tourism and its effect on small towns',
      'four-day work week experiments',
    ],
  },
]

// Phrased text-type-neutral so they work for announcements and lectures, not
// just dialogues; the prompt tells the model to adapt if the angle doesn't fit.
const ANGLES = [
  'a small problem comes up and gets resolved',
  'two different opinions are expressed before finding common ground',
  'plans change unexpectedly',
  'a surprising or amusing detail is revealed',
  'someone asks for and receives advice',
  'a misunderstanding gets cleared up',
  'someone shares a personal experience from the past',
  'two alternatives are compared',
]

const LEVEL_RANK: Record<Level, number> = { A1: 0, A2: 1, B1: 2, B2: 3 }

function pickTopicAndAngle(level: Level): { topic: string; angle: string } {
  const rank = LEVEL_RANK[level]
  const domains = TOPIC_DOMAINS.filter((d) => rank >= LEVEL_RANK[d.minLevel ?? 'A1'])
  const domain = domains[Math.floor(Math.random() * domains.length)]
  const topic = domain.topics[Math.floor(Math.random() * domain.topics.length)]
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)]
  return { topic, angle }
}

// Split N questions into richtig/falsch and multiple-choice counts, guaranteeing
// rf + mc === total and at least one of each type for a genuine mix.
function splitCounts(total: number, rfRatio: number): { rfCount: number; mcCount: number } {
  const rfCount = Math.max(1, Math.min(total - 1, Math.round(total * rfRatio)))
  return { rfCount, mcCount: total - rfCount }
}

function buildPrompt(level: Level, words: number, numQuestions: number): string {
  const bp = BLUEPRINTS[level]
  const { rfCount, mcCount } = splitCounts(numQuestions, bp.rfRatio)
  const { topic, angle } = pickTopicAndAngle(level)
  return [
    'You are creating a German listening comprehension exercise for an adult learner,',
    `modelled on the Goethe-Zertifikat ${level} "Hören" (listening) exam.`,
    `Write a German listening text in the style of ${bp.textType}.`,
    `The topic of the text: ${topic}. Story element to weave in: ${angle}`,
    '(adapt the story element freely if it does not suit the chosen text type).',
    `The text should be around ${words} words. Use natural spoken-style prose a listener can`,
    'follow by ear: no headings, no bullet points, no numbered lists.',
    bp.difficulty,
    `Then create exactly ${numQuestions} comprehension questions about the text, in German,`,
    'as a JSON array in the order a listener encounters the answers:',
    `- exactly ${rfCount} of type "richtig_falsch": a statement about the text that is either`,
    'true or false. For these, set options to exactly ["Richtig","Falsch"] and set correctIndex',
    'to 0 when the statement is true (richtig) or 1 when it is false (falsch).',
    `- exactly ${mcCount} of type "multiple_choice": a question with exactly 3 German answer`,
    'options (correctIndex 0–2). The two distractors must be plausible and closely tied to the',
    'content, so a learner who only half-listened could realistically pick them.',
    'Mix the two question types throughout — do not group all of one type together.',
    'For every question, provide a one-sentence explanation in German (explanationDe) AND a',
    'one-sentence explanation in English (explanationEn) saying why the correct answer is right.',
    'Return ONLY the JSON matching the schema, with no surrounding prose.',
  ].join(' ')
}

// Tried in order: cheap model first, fall back to the bigger one only when the
// cheap one keeps returning transient errors. Each model is retried with
// exponential backoff before giving up on it.
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] as const
const RETRIES = 3

// 429 (rate limit), 500/503 (overload) are temporary — Google explicitly says
// to retry. Anything else (400 bad request, 401/403 auth) won't fix itself.
function isTransient(status: number): boolean {
  return status === 429 || status === 500 || status === 503
}

function geminiUrl(env: Env, model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`
}

async function callGemini(env: Env, body: GenerateRequest): Promise<ListeningExercise> {
  const targetWords = body.targetMinutes * WORDS_PER_MINUTE
  const prompt = buildPrompt(body.level, targetWords, body.numQuestions)
  const payload = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.95,
    },
  })

  let res: Response | undefined
  outer: for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      res = await fetch(geminiUrl(env, model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
      if (res.ok) break outer
      // Non-transient (bad request, auth) would fail identically on the fallback
      // model and on a retry — bail out immediately and surface it.
      if (!isTransient(res.status)) break outer
      if (attempt < RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)) // 500ms, 1s
      }
    }
    // This model exhausted its retries on transient errors — try the next one.
  }
  if (!res?.ok) {
    const txt = res ? await res.text() : ''
    throw new Error(`Gemini ${res?.status ?? 'no response'}: ${txt.slice(0, 400)}`)
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no text')
  const parsed = JSON.parse(text) as ListeningExercise
  if (!parsed.transcript || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Gemini returned malformed JSON')
  }
  for (const q of parsed.questions) {
    if (typeof q.q !== 'string' || typeof q.correctIndex !== 'number') {
      throw new Error('Gemini returned a malformed question')
    }
    if (q.type === 'richtig_falsch') {
      // Normalise to the two canonical German labels; trust the 0/1 index.
      q.options = ['Richtig', 'Falsch']
      if (q.correctIndex !== 0 && q.correctIndex !== 1) {
        throw new Error('Gemini returned a malformed richtig_falsch question')
      }
    } else {
      // Treat anything that is not richtig_falsch as multiple choice and tolerate
      // an off-by-one option count rather than failing the whole round.
      q.type = 'multiple_choice'
      if (
        !Array.isArray(q.options) ||
        q.options.length < 2 ||
        q.correctIndex < 0 ||
        q.correctIndex >= q.options.length
      ) {
        throw new Error('Gemini returned a malformed multiple_choice question')
      }
    }
  }
  return parsed
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/notify') {
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405)
      }
      return handleNotify(request, env)
    }

    if (url.pathname === '/api/listening/generate') {
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405)
      }
      let raw: unknown
      try {
        raw = await request.json()
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400)
      }
      const body = (raw ?? {}) as Partial<GenerateRequest>
      const level = body.level
      const targetMinutes = Number(body.targetMinutes)
      const numQuestions = Number(body.numQuestions)
      if (
        typeof level !== 'string' ||
        !VALID_LEVELS.has(level) ||
        !VALID_MINUTES.has(targetMinutes) ||
        !VALID_QUESTIONS.has(numQuestions)
      ) {
        return jsonResponse({ error: 'Invalid level / targetMinutes / numQuestions' }, 400)
      }
      if (!env.GEMINI_API_KEY) {
        return jsonResponse({ error: 'GEMINI_API_KEY not configured on the Worker' }, 500)
      }
      try {
        const exercise = await callGemini(env, {
          level: level as Level,
          targetMinutes,
          numQuestions,
        })
        return jsonResponse(exercise)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return jsonResponse({ error: msg }, 502)
      }
    }

    return env.ASSETS.fetch(request)
  },

  // Fires at 19:00 and 20:00 UTC; handleScheduled keeps whichever one is
  // actually 21:00 in Berlin and drops the other.
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    await handleScheduled(env, new Date(event.scheduledTime))
  },
}
