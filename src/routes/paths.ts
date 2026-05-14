import type { UserId } from '@/types/db'

export const paths = {
  home: () => '/',
  challenges: (userId: UserId) => `/u/${userId}`,
  videoLibrary: (userId: UserId) => `/u/${userId}/listen`,
  player: (userId: UserId, videoId: string) => `/u/${userId}/listen/${videoId}`,
  vocabGame: (userId: UserId) => `/u/${userId}/vocab`,
  stats: (userId: UserId) => `/u/${userId}/stats`,
} as const

export const routePatterns = {
  home: '/',
  challenges: '/u/:userId',
  videoLibrary: '/u/:userId/listen',
  player: '/u/:userId/listen/:videoId',
  vocabGame: '/u/:userId/vocab',
  stats: '/u/:userId/stats',
} as const
