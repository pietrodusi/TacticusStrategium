import { HashRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/layout/Layout'
import { HomePage } from './pages/HomePage'
import { SetupPage } from './pages/SetupPage'
import { BoardPage } from './pages/BoardPage'
import { SignInPage } from './pages/SignInPage'
import { PlansPage } from './pages/PlansPage'
import { TeamsPage } from './pages/TeamsPage'
import { AccountPage } from './pages/AccountPage'
import { LegalPage } from './pages/LegalPage'
import { SharedPlanPage } from './pages/SharedPlanPage'
import { initAuth } from './services/firebase/auth'

initAuth()

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
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/legal" element={<LegalPage />} />
          </Route>
          {/* Full-bleed planning board — outside the app shell. */}
          <Route path="/plan/board" element={<BoardPage />} />
          {/* Read-only shared-plan viewer — also full-bleed. */}
          <Route path="/shared/:planId" element={<SharedPlanPage />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}
