import {
  getPiperSession,
  getSpeechRate,
  isMuted,
  pickGermanVoice,
  subscribeSpeechRate,
  subscribeVoiceId,
} from '@/lib/sounds'
import type * as piperTTS from '@/vendor/piperWeb/piperWeb.js'

export type SpeechState = 'idle' | 'loading' | 'speaking' | 'paused'

type StateListener = (state: SpeechState) => void
type ProgressListener = (progress: SpeechProgress | null) => void

const stateListeners = new Set<StateListener>()
const progressListeners = new Set<ProgressListener>()
let state: SpeechState = 'idle'

function setState(next: SpeechState): void {
  if (state === next) return
  state = next
  for (const l of stateListeners) l(next)
}

export function getLongFormState(): SpeechState {
  return state
}

export function subscribeLongFormState(listener: StateListener): () => void {
  stateListeners.add(listener)
  return () => {
    stateListeners.delete(listener)
  }
}

export interface SpeechProgress {
  /** Index of the sentence currently playing (0-based). */
  current: number
  /** Total sentence count. */
  total: number
  /** Number of sentences that have an AudioBuffer ready (>= current). */
  buffered: number
  /** Whether the underlying engine is Piper or the Web Speech fallback. */
  engine: 'piper' | 'webspeech'
}

function getProgress(): SpeechProgress | null {
  if (!current) return null
  if (current.kind === 'webspeech') {
    return { current: 0, total: 1, buffered: 1, engine: 'webspeech' }
  }
  let buffered = 0
  for (const b of current.buffers) {
    if (b) buffered += 1
  }
  return {
    current: Math.min(current.currentIdx, current.sentences.length),
    total: current.sentences.length,
    buffered,
    engine: 'piper',
  }
}

export function getLongFormProgress(): SpeechProgress | null {
  return getProgress()
}

/**
 * Returns a smooth 0..1 progress through the whole transcript. Each sentence
 * is weighted equally — within a sentence, fractional progress comes from the
 * AudioContext's clock vs the current buffer's duration. Returns null when
 * nothing is playing, and 1 when playback has completed. Safe to poll at rAF
 * cadence; reads module state without allocating.
 */
export function getLongFormProgressRatio(): number | null {
  if (!current) return null
  if (current.kind === 'webspeech') return null
  const p = current
  const total = p.sentences.length
  if (total === 0) return 0
  let fraction = 0
  const buf = p.buffers[p.currentIdx]
  if (buf && p.currentSource && p.currentStartedAt !== null) {
    const elapsed = Math.max(0, p.ctx.currentTime - p.currentStartedAt)
    fraction = Math.min(1, elapsed / buf.duration)
  }
  return Math.min(1, (p.currentIdx + fraction) / total)
}

export function subscribeLongFormProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener)
  return () => {
    progressListeners.delete(listener)
  }
}

function notifyProgress(): void {
  if (progressListeners.size === 0) return
  const p = getProgress()
  for (const l of progressListeners) l(p)
}

interface PiperPlayback {
  kind: 'piper'
  sentences: string[]
  buffers: (AudioBuffer | null)[]
  failed: Set<number>
  ctx: AudioContext
  currentIdx: number
  currentSource: AudioBufferSourceNode | null
  /** ctx.currentTime when the current sentence started (after suspend/resume,
   * ctx.currentTime stays paused so this stays meaningful for elapsed-time
   * calculations). */
  currentStartedAt: number | null
  cancelled: boolean
  started: boolean
}

interface WebSpeechPlayback {
  kind: 'webspeech'
  utterance: SpeechSynthesisUtterance
}

let current: PiperPlayback | WebSpeechPlayback | null = null
let requestId = 0
let voiceSubscribed = false

function ensureVoiceSubscription(): void {
  if (voiceSubscribed) return
  voiceSubscribed = true
  // A voice change invalidates the Piper session; a speed change leaves it
  // valid but makes already-buffered sentences play at the old pace. Either
  // way, drop in-flight playback so nothing leaks past the switch mismatched.
  const stop = () => cancelLongForm()
  subscribeVoiceId(stop)
  subscribeSpeechRate(stop)
}

// Split on .!?… while keeping the terminator with its sentence. Trailing
// fragment (no terminator) is captured by the second alternation. Naive but
// good enough for AI-generated prose at conversational levels.
export function splitTranscriptSentences(text: string): string[] {
  const matches = text.match(/[^.!?…]+[.!?…]+|\S[^.!?…]*$/g)
  const out: string[] = []
  if (matches) {
    for (const m of matches) {
      const trimmed = m.trim()
      if (trimmed) out.push(trimmed)
    }
  }
  if (out.length === 0 && text.trim()) out.push(text.trim())
  return out
}

async function synthesizeSentence(
  piperSession: piperTTS.TtsSession,
  ctx: AudioContext,
  text: string,
): Promise<AudioBuffer> {
  const wav = await piperSession.predict(text, { speed: getSpeechRate() })
  return ctx.decodeAudioData(await wav.arrayBuffer())
}

function speakViaWebSpeechFallback(text: string): void {
  if (typeof window === 'undefined') return
  const synth = window.speechSynthesis
  if (!synth) {
    setState('idle')
    return
  }
  synth.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'de-DE'
  utter.rate = getSpeechRate()
  const voice = pickGermanVoice()
  if (voice) utter.voice = voice
  utter.onstart = () => {
    setState('speaking')
    notifyProgress()
  }
  utter.onresume = () => setState('speaking')
  utter.onpause = () => setState('paused')
  const finish = () => {
    if (current && current.kind === 'webspeech' && current.utterance === utter) {
      current = null
      setState('idle')
      notifyProgress()
    }
  }
  utter.onend = finish
  utter.onerror = finish
  current = { kind: 'webspeech', utterance: utter }
  notifyProgress()
  synth.speak(utter)
}

function playNext(playback: PiperPlayback): void {
  if (playback.cancelled || current !== playback) return
  if (playback.currentIdx >= playback.sentences.length) {
    closePlayback(playback)
    setState('idle')
    notifyProgress()
    return
  }
  if (playback.failed.has(playback.currentIdx)) {
    playback.currentIdx += 1
    playback.currentStartedAt = null
    notifyProgress()
    playNext(playback)
    return
  }
  const buf = playback.buffers[playback.currentIdx]
  if (!buf) {
    // Synthesis for this sentence hasn't caught up yet — spin briefly.
    window.setTimeout(() => playNext(playback), 250)
    return
  }
  const src = playback.ctx.createBufferSource()
  src.buffer = buf
  src.connect(playback.ctx.destination)
  src.onended = () => {
    if (current !== playback || playback.cancelled) return
    playback.currentIdx += 1
    playback.currentSource = null
    playback.currentStartedAt = null
    notifyProgress()
    playNext(playback)
  }
  playback.currentSource = src
  playback.currentStartedAt = playback.ctx.currentTime
  src.start()
  notifyProgress()
}

function closePlayback(playback: PiperPlayback): void {
  playback.cancelled = true
  if (playback.currentSource) {
    try {
      playback.currentSource.onended = null
      playback.currentSource.stop()
    } catch {
      // already stopped
    }
    try {
      playback.currentSource.disconnect()
    } catch {
      // already disconnected
    }
    playback.currentSource = null
  }
  void playback.ctx.close().catch(() => {})
  if (current === playback) current = null
}

async function startPiperPlayback(text: string, myId: number): Promise<void> {
  if (typeof window === 'undefined') return
  setState('loading')
  const piperSession = await getPiperSession()
  if (myId !== requestId) return
  if (!piperSession) {
    console.warn('[longFormSpeech] Piper unavailable — falling back to system speech synthesis')
    speakViaWebSpeechFallback(text)
    return
  }
  const sentences = splitTranscriptSentences(text)
  if (sentences.length === 0) {
    setState('idle')
    return
  }
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) {
    speakViaWebSpeechFallback(text)
    return
  }
  const ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()

  const playback: PiperPlayback = {
    kind: 'piper',
    sentences,
    buffers: sentences.map(() => null),
    failed: new Set(),
    ctx,
    currentIdx: 0,
    currentSource: null,
    currentStartedAt: null,
    cancelled: false,
    started: false,
  }
  current = playback
  notifyProgress()

  // Synthesize sequentially — ORT / Piper can't run multiple predict() calls
  // concurrently on the same session. Start playback as soon as sentence 0
  // lands so first-audio latency stays low.
  void (async () => {
    for (let i = 0; i < sentences.length; i++) {
      if (playback.cancelled) return
      try {
        const buf = await synthesizeSentence(piperSession, ctx, sentences[i])
        if (playback.cancelled) return
        playback.buffers[i] = buf
        notifyProgress()
        if (!playback.started) {
          playback.started = true
          setState('speaking')
          playNext(playback)
        }
      } catch (err) {
        console.warn('[longFormSpeech] sentence synthesis failed', { i, err })
        playback.failed.add(i)
        if (i === 0 && playback.buffers.every((b) => b == null)) {
          // Couldn't render even the first sentence — fall back so the user
          // still hears something rather than dead air.
          closePlayback(playback)
          speakViaWebSpeechFallback(text)
          return
        }
      }
    }
  })()
}

export function speakLongForm(text: string): void {
  if (typeof window === 'undefined') return
  if (isMuted()) return
  ensureVoiceSubscription()
  cancelLongForm()
  const id = ++requestId
  void startPiperPlayback(text, id)
}

export function pauseLongForm(): void {
  if (!current) return
  if (current.kind === 'piper') {
    void current.ctx.suspend()
    setState('paused')
  } else {
    window.speechSynthesis?.pause()
  }
}

export function resumeLongForm(): void {
  if (!current) return
  if (current.kind === 'piper') {
    void current.ctx.resume()
    setState('speaking')
  } else {
    window.speechSynthesis?.resume()
  }
}

export function cancelLongForm(): void {
  requestId += 1
  if (current) {
    if (current.kind === 'piper') {
      closePlayback(current)
    } else {
      window.speechSynthesis?.cancel()
      current = null
    }
  }
  setState('idle')
  notifyProgress()
}
