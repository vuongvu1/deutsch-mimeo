// YouTube IFrame Player API helpers + URL parsing + oEmbed title fetch.

declare global {
  interface Window {
    YT?: typeof YT
    onYouTubeIframeAPIReady?: () => void
  }
  // Minimal subset of the IFrame API we use.
  namespace YT {
    interface Player {
      destroy(): void
      getCurrentTime(): number
      getDuration(): number
      getPlayerState(): number
      playVideo(): void
      pauseVideo(): void
    }
    interface PlayerEvent {
      target: Player
    }
    interface OnStateChangeEvent extends PlayerEvent {
      data: number
    }
    interface PlayerOptions {
      videoId?: string
      width?: number | string
      height?: number | string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: PlayerEvent) => void
        onStateChange?: (e: OnStateChangeEvent) => void
      }
    }
    const PlayerState: {
      UNSTARTED: -1
      ENDED: 0
      PLAYING: 1
      PAUSED: 2
      BUFFERING: 3
      CUED: 5
    }
    class Player {
      constructor(elementOrId: HTMLElement | string, options: PlayerOptions)
    }
  }
}

let apiPromise: Promise<typeof YT> | null = null

export function loadYouTubeApi(): Promise<typeof YT> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT!)
    }
  })
  return apiPromise
}

const YT_PATTERNS = [
  /[?&]v=([a-zA-Z0-9_-]{11})/, // ?v=ID
  /youtu\.be\/([a-zA-Z0-9_-]{11})/, // youtu.be/ID
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, // /embed/ID
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, // /shorts/ID
]

const PLAYLIST_PATTERN = /[?&]list=([a-zA-Z0-9_-]+)/

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  for (const re of YT_PATTERNS) {
    const m = trimmed.match(re)
    if (m) return m[1]
  }
  return null
}

export function extractPlaylistId(input: string): string | null {
  const m = input.trim().match(PLAYLIST_PATTERN)
  return m ? m[1] : null
}

interface OEmbedResponse {
  title: string
  author_name: string
  thumbnail_url: string
}

export async function fetchYouTubeTitle(youtubeId: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`
    const res = await fetch(url)
    if (!res.ok) return null
    const data: OEmbedResponse = await res.json()
    return data.title ?? null
  } catch {
    return null
  }
}

export function youtubeThumbUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`
}

export interface PlaylistVideo {
  youtubeId: string
  title: string
}

interface PlaylistItemsResponse {
  nextPageToken?: string
  items: {
    snippet?: {
      title?: string
      resourceId?: { videoId?: string }
    }
    status?: { privacyStatus?: string }
  }[]
}

export async function fetchPlaylistItems(playlistId: string): Promise<PlaylistVideo[]> {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY
  if (!key) {
    throw new Error('VITE_YOUTUBE_API_KEY is not set')
  }
  const out: PlaylistVideo[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      part: 'snippet,status',
      maxResults: '50',
      playlistId,
      key,
    })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`YouTube API ${res.status}: ${body || res.statusText}`)
    }
    const data = (await res.json()) as PlaylistItemsResponse
    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId
      const title = item.snippet?.title ?? ''
      if (!videoId) continue
      if (title === 'Private video' || title === 'Deleted video') continue
      const privacy = item.status?.privacyStatus
      if (privacy && privacy !== 'public' && privacy !== 'unlisted') continue
      out.push({ youtubeId: videoId, title: title || `YouTube ${videoId}` })
    }
    pageToken = data.nextPageToken
  } while (pageToken)
  return out
}
