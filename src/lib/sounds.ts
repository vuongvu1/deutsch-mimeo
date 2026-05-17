import * as piperTTS from '@mintplex-labs/piper-tts-web'

const MUTE_STORAGE_KEY = 'mimeo:sound:muted'
const PIPER_VOICE_ID: piperTTS.VoiceId = 'de_DE-thorsten-medium'
const ORT_WASM_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/'
const PIPER_PHONEMIZE_BASE =
  'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize'

// piper-tts-web@1.0.4 hardcodes the voice URL to huggingface.co/diffusionstudio/piper-voices,
// which has been seen returning 404 in prod (transient HF cache misses). The model is committed
// in this repo under /voices/ and served via raw.githubusercontent.com (CORS: *). The library's
// OPFS cache still keys off the original HF URL, so caching keeps working unchanged.
const PIPER_VOICE_FILENAMES = new Set([
  'de_DE-thorsten-medium.onnx',
  'de_DE-thorsten-medium.onnx.json',
])
const PIPER_MIRROR_BASE =
  'https://raw.githubusercontent.com/vuongvu1/deutsch-mimeo/main/voices/'

function patchPiperVoiceFetch(): void {
  if (typeof window === 'undefined') return
  const w = window as Window & { __mimeoPiperFetchPatched?: boolean }
  if (w.__mimeoPiperFetchPatched) return
  w.__mimeoPiperFetchPatched = true
  const original = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const filename = url.slice(url.lastIndexOf('/') + 1)
    if (!PIPER_VOICE_FILENAMES.has(filename)) return original(input, init)
    const rewritten = PIPER_MIRROR_BASE + filename
    if (typeof input === 'string' || input instanceof URL) {
      return original(rewritten, init)
    }
    return original(new Request(rewritten, input))
  }
}

patchPiperVoiceFetch()

let cachedCtx: AudioContext | null = null
let muted: boolean = (() => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1'
})()

type MuteListener = (muted: boolean) => void
const listeners = new Set<MuteListener>()

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean): void {
  muted = next
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0')
    if (next) {
      if (window.speechSynthesis) window.speechSynthesis.cancel()
      stopCurrentPiperSource()
    }
  }
  for (const l of listeners) l(next)
}

export function subscribeMute(listener: MuteListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (cachedCtx) return cachedCtx
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  cachedCtx = new Ctor()
  return cachedCtx
}

function prepareCtx(): AudioContext | null {
  if (muted) return null
  const ctx = getCtx()
  if (!ctx) return null
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function envelopedTone(
  ctx: AudioContext,
  startAt: number,
  freq: number,
  duration: number,
  peakGain: number,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startAt)
  osc.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

export function playMatch(): void {
  const ctx = prepareCtx()
  if (!ctx) return
  const start = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, start)
  osc.frequency.linearRampToValueAtTime(1320, start + 0.08)
  osc.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(0.14, start + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12)
  osc.start(start)
  osc.stop(start + 0.13)
}

export function playWrong(): void {
  const ctx = prepareCtx()
  if (!ctx) return
  const start = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(280, start)
  osc.frequency.linearRampToValueAtTime(140, start + 0.14)
  osc.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(0.07, start + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
  osc.start(start)
  osc.stop(start + 0.18)
}

export function playRoundDone(): void {
  const ctx = prepareCtx()
  if (!ctx) return
  const start = ctx.currentTime
  envelopedTone(ctx, start, 698.46, 0.13, 0.13)
  envelopedTone(ctx, start + 0.09, 880, 0.18, 0.13)
}

export function playGoalReached(): void {
  const ctx = prepareCtx()
  if (!ctx) return
  const freqs = [523.25, 659.25, 783.99, 1046.5]
  const noteDuration = 0.22
  const stride = 0.11
  const start = ctx.currentTime
  freqs.forEach((freq, i) => {
    envelopedTone(ctx, start + i * stride, freq, noteDuration, 0.18)
  })
}

let voicesCache: SpeechSynthesisVoice[] = []

if (typeof window !== 'undefined' && window.speechSynthesis) {
  const synth = window.speechSynthesis
  voicesCache = synth.getVoices()
  synth.addEventListener('voiceschanged', () => {
    voicesCache = synth.getVoices()
  })
}

function scoreGermanVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase()
  let s = 0
  if (name.includes('premium')) s += 100
  if (name.includes('enhanced')) s += 90
  if (name.includes('neural')) s += 90
  if (name.includes('natural')) s += 85
  if (name.includes('siri')) s += 80
  if (!v.localService) s += 60
  if (name.includes('google')) s += 40
  if (name.includes('microsoft')) s += 30
  if (v.lang.toLowerCase() === 'de-de') s += 5
  if (name === 'anna' || name.includes('espeak')) s -= 50
  return s
}

function pickGermanVoice(): SpeechSynthesisVoice | null {
  const candidates = voicesCache.filter((v) => v.lang.toLowerCase().startsWith('de'))
  if (candidates.length === 0) return null
  return candidates.slice().sort((a, b) => scoreGermanVoice(b) - scoreGermanVoice(a))[0]
}

function speakViaWebSpeech(text: string): void {
  if (typeof window === 'undefined') return
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'de-DE'
  utter.rate = 0.9
  const voice = pickGermanVoice()
  if (voice) utter.voice = voice
  synth.speak(utter)
}

let piperSessionPromise: Promise<piperTTS.TtsSession> | null = null
let piperReady = false
let piperBroken = false
let currentPiperSource: AudioBufferSourceNode | null = null
let speakRequestId = 0

function stopCurrentPiperSource(): void {
  if (!currentPiperSource) return
  const src = currentPiperSource
  currentPiperSource = null
  try {
    src.onended = null
    src.stop()
  } catch {
    // already stopped
  }
  try {
    src.disconnect()
  } catch {
    // already disconnected
  }
}

function startPiperInit(): Promise<piperTTS.TtsSession> {
  if (piperBroken) return Promise.reject(new Error('piper unavailable'))
  if (piperSessionPromise) return piperSessionPromise
  piperSessionPromise = piperTTS.TtsSession.create({
    voiceId: PIPER_VOICE_ID,
    wasmPaths: {
      onnxWasm: ORT_WASM_BASE,
      piperData: `${PIPER_PHONEMIZE_BASE}.data`,
      piperWasm: `${PIPER_PHONEMIZE_BASE}.wasm`,
    },
  })
    .then((session) => {
      piperReady = true
      return session
    })
    .catch((err) => {
      piperBroken = true
      piperSessionPromise = null
      console.info('[piper] init failed, falling back to Web Speech', err)
      throw err
    })
  return piperSessionPromise
}

export function prewarmPiper(): void {
  if (typeof window === 'undefined') return
  if (piperBroken || piperReady || piperSessionPromise) return
  void startPiperInit().catch(() => {
    // already logged; fallback stays in effect
  })
}

async function speakViaPiper(text: string, ctx: AudioContext, myId: number): Promise<void> {
  const session = await startPiperInit()
  if (muted || myId !== speakRequestId) return
  const wav = await session.predict(text)
  if (muted || myId !== speakRequestId) return
  const buffer = await ctx.decodeAudioData(await wav.arrayBuffer())
  if (muted || myId !== speakRequestId) return
  stopCurrentPiperSource()
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.onended = () => {
    if (currentPiperSource === source) currentPiperSource = null
  }
  currentPiperSource = source
  source.start()
}

export function speakGerman(text: string): void {
  if (muted) return
  if (typeof window === 'undefined') return
  if (window.speechSynthesis) window.speechSynthesis.cancel()
  stopCurrentPiperSource()
  const myId = ++speakRequestId

  if (piperBroken) {
    speakViaWebSpeech(text)
    return
  }

  if (piperReady) {
    const ctx = prepareCtx()
    if (!ctx) {
      speakViaWebSpeech(text)
      return
    }
    speakViaPiper(text, ctx, myId).catch((err) => {
      piperBroken = true
      console.info('[piper] speak failed, falling back to Web Speech', err)
      if (myId === speakRequestId) speakViaWebSpeech(text)
    })
    return
  }

  speakViaWebSpeech(text)
  void startPiperInit().catch(() => {
    // already logged; fallback stays in effect
  })
}
