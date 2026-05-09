import { createBrowserRouter, Navigate } from 'react-router-dom'

import { ChallengeListPage } from '@/pages/ChallengeListPage'
import { HomePage } from '@/pages/HomePage'
import { PlayerPage } from '@/pages/PlayerPage'
import { StatsPage } from '@/pages/StatsPage'
import { VideoLibraryPage } from '@/pages/VideoLibraryPage'

import { routePatterns } from './paths'

export const router = createBrowserRouter([
  { path: routePatterns.home, element: <HomePage /> },
  { path: routePatterns.challenges, element: <ChallengeListPage /> },
  { path: routePatterns.videoLibrary, element: <VideoLibraryPage /> },
  { path: routePatterns.player, element: <PlayerPage /> },
  { path: routePatterns.stats, element: <StatsPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])
