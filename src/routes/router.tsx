import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'

import { AppHeader } from '@/components/AppHeader'
import { ChallengeListPage } from '@/pages/ChallengeListPage'
import { HomePage } from '@/pages/HomePage'
import { PlayerPage } from '@/pages/PlayerPage'
import { StatsPage } from '@/pages/StatsPage'
import { VideoLibraryPage } from '@/pages/VideoLibraryPage'

import { routePatterns } from './paths'

function AppLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: routePatterns.home, element: <HomePage /> },
      { path: routePatterns.challenges, element: <ChallengeListPage /> },
      { path: routePatterns.videoLibrary, element: <VideoLibraryPage /> },
      { path: routePatterns.player, element: <PlayerPage /> },
      { path: routePatterns.stats, element: <StatsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
