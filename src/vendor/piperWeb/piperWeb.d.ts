// Minimal type surface for the vendored piper-tts-web wrapper. The runtime
// is the upstream library copy (see piperWeb.js) patched to drop out-of-range
// phoneme IDs — see the [mimeo patch] block inside predict().

export type VoiceId = string

export interface TtsSessionOptions {
  voiceId: VoiceId
  wasmPaths?: {
    onnxWasm?: string
    piperData?: string
    piperWasm?: string
  }
  progress?: (event: { url: string; total: number; loaded: number }) => void
  logger?: (msg: string) => void
}

export class TtsSession {
  voiceId: VoiceId
  waitReady: Promise<void>
  static create(options: TtsSessionOptions): Promise<TtsSession>
  static WASM_LOCATIONS: {
    onnxWasm: string
    piperData: string
    piperWasm: string
  }
  /** Singleton instance held by the constructor. Setting this back to `null`
   * is the supported way to force the next `create()` to load a different
   * voice model (the constructor otherwise returns the existing instance
   * with just `voiceId` swapped). */
  static _instance: TtsSession | null
  predict(text: string): Promise<Blob>
}

export const HF_BASE: string
export const ONNX_BASE: string
export const WASM_BASE: string
export const PATH_MAP: Record<string, string>
