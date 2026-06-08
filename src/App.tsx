import { HashRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/layout/Layout'
import { HomePage } from './pages/HomePage'
import { SetupPage } from './pages/SetupPage'
import { BoardPage } from './pages/BoardPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Catalog data changes rarely; cache aggressively.
      staleTime: 1000 * 60 * 60,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/plan" element={<SetupPage />} />
          </Route>
          {/* Full-bleed planning board — outside the app shell. */}
          <Route path="/plan/board" element={<BoardPage />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}
