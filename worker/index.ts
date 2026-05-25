interface Env {
  GEMINI_API_KEY: string
  ASSETS: Fetcher
}

type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'mix'

interface GenerateRequest {
  level: Level
  targetMinutes: number
  numQuestions: number
}

interface ListeningQuestion {
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

const VALID_LEVELS: ReadonlySet<string> = new Set(['A1', 'A2', 'B1', 'B2', 'mix'])
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
          q: { type: 'STRING' },
          options: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          correctIndex: { type: 'INTEGER' },
          explanationDe: { type: 'STRING' },
          explanationEn: { type: 'STRING' },
        },
        required: ['q', 'options', 'correctIndex', 'explanationDe', 'explanationEn'],
      },
    },
  },
  required: ['transcript', 'questions'],
}

function buildPrompt(level: Level, words: number, questions: number): string {
  const levelLine =
    level === 'mix'
      ? 'a mix of CEFR levels A1 to B2 (varied difficulty across sentences)'
      : `CEFR level ${level}`
  return [
    'You are creating a German listening comprehension exercise for an adult learner.',
    'Pick a varied everyday topic at random (daily life, work, travel, society, environment,',
    'technology, culture, food, history, science, etc. — do not repeat common topics).',
    `Write one short paragraph in German on that topic at ${levelLine},`,
    `around ${words} words. Use natural prose: no bullet points, no headings, no lists,`,
    'no numbered steps — just flowing sentences a listener can follow by ear.',
    `Then create exactly ${questions} independent multiple-choice comprehension questions`,
    'in German that test understanding of the paragraph. Each question must have exactly',
    '4 options as German strings with one correct answer (correctIndex is 0–3) and three',
    'plausible distractors that are closely related to the content (so a learner who only',
    'half-listened could realistically pick them).',
    'For each question, provide a one-sentence explanation in German (explanationDe) AND',
    'a one-sentence explanation in English (explanationEn) describing why the correct',
    'option is right and why the distractors are wrong.',
    'Return ONLY the JSON matching the schema, with no surrounding prose.',
  ].join(' ')
}

async function callGemini(env: Env, body: GenerateRequest): Promise<ListeningExercise> {
  const targetWords = body.targetMinutes * WORDS_PER_MINUTE
  const prompt = buildPrompt(body.level, targetWords, body.numQuestions)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`
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
    if (
      typeof q.q !== 'string' ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      typeof q.correctIndex !== 'number' ||
      q.correctIndex < 0 ||
      q.correctIndex > 3
    ) {
      throw new Error('Gemini returned a malformed question')
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
