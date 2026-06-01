interface Env {
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

// Split N questions into richtig/falsch and multiple-choice counts, guaranteeing
// rf + mc === total and at least one of each type for a genuine mix.
function splitCounts(total: number, rfRatio: number): { rfCount: number; mcCount: number } {
  const rfCount = Math.max(1, Math.min(total - 1, Math.round(total * rfRatio)))
  return { rfCount, mcCount: total - rfCount }
}

function buildPrompt(level: Level, words: number, numQuestions: number): string {
  const bp = BLUEPRINTS[level]
  const { rfCount, mcCount } = splitCounts(numQuestions, bp.rfRatio)
  return [
    'You are creating a German listening comprehension exercise for an adult learner,',
    `modelled on the Goethe-Zertifikat ${level} "Hören" (listening) exam.`,
    `Write a German listening text in the style of ${bp.textType}.`,
    'Pick a varied, realistic everyday topic at random (daily life, work, travel, society,',
    'environment, technology, culture, food, health, etc.) — do not always reuse the same topic.',
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

async function callGemini(env: Env, body: GenerateRequest): Promise<ListeningExercise> {
  const targetWords = body.targetMinutes * WORDS_PER_MINUTE
  const prompt = buildPrompt(body.level, targetWords, body.numQuestions)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.95,
      },
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Gemini ${res.status}: ${txt.slice(0, 400)}`)
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
}
