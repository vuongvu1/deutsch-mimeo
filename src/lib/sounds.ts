const MUTE_STORAGE_KEY = 'mimeo:sound:muted'

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

export function speakGerman(text: string): void {
  if (muted) return
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
