import { Container, Flex, Spinner } from '@radix-ui/themes'
import { Suspense, lazy } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'

import { AppHeader } from '@/components/AppHeader'
import { HomePage } from '@/pages/HomePage'

import { routePatterns } from './paths'

const ChallengeListPage = lazy(() =>
  import('@/pages/ChallengeListPage').then((m) => ({ default: m.ChallengeListPage })),
)
const VideoLibraryPage = lazy(() =>
  import('@/pages/VideoLibraryPage').then((m) => ({ default: m.VideoLibraryPage })),
)
const PlayerPage = lazy(() =>
  import('@/pages/PlayerPage').then((m) => ({ default: m.PlayerPage })),
)
const StatsPage = lazy(() =>
  import('@/pages/StatsPage').then((m) => ({ default: m.StatsPage })),
)
const VocabGamePage = lazy(() =>
  import('@/pages/VocabGamePage').then((m) => ({ default: m.VocabGamePage })),
)

function PageLoader() {
  return (
    <Container size="3" px={{ initial: '4', sm: '5' }} py="6">
      <Flex justify="center" py="6">
        <Spinner size="3" />
      </Flex>
    </Container>
  )
}

function AppLayout() {
  return (
    <>
      <AppHeader />
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
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
      { path: routePatterns.vocabGame, element: <VocabGamePage /> },
      { path: routePatterns.stats, element: <StatsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
