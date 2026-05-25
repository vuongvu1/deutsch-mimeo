import type { UserId } from '@/types/db'

export const paths = {
  home: () => '/',
  challenges: (userId: UserId) => `/u/${userId}`,
  videoLibrary: (userId: UserId) => `/u/${userId}/listen`,
  player: (userId: UserId, videoId: string) => `/u/${userId}/listen/${videoId}`,
  vocabGame: (userId: UserId) => `/u/${userId}/vocab`,
  listening: (userId: UserId) => `/u/${userId}/listening`,
  stats: (userId: UserId) => `/u/${userId}/stats`,
  compare: () => '/compare',
} as const

export const routePatterns = {
  home: '/',
  challenges: '/u/:userId',
  videoLibrary: '/u/:userId/listen',
  player: '/u/:userId/listen/:videoId',
  vocabGame: '/u/:userId/vocab',
  listening: '/u/:userId/listening',
  stats: '/u/:userId/stats',
  compare: '/compare',
} as const
