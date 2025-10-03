import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { AuthProvider, useAuthContext } from '@/components/auth/AuthProvider'
import { AuthPage } from '@/components/auth/AuthPage'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { ProjectsPage } from '@/components/projects/ProjectsPage'
import { ProjectDetailsPage } from '@/components/projects/ProjectDetailsPage'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { FloatingAIButton } from '@/components/chat/FloatingAIButton'
import { useAuthStore } from '@/stores'
import { authService } from '@/lib/api'
import { aiService } from '@/lib/ai'

const AppContent: React.FC = () => {
  const { user, loading } = useAuthContext()
  const { setSession, setLoading, setInitialized } = useAuthStore()

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true)
      try {
        const { data: session } = await authService.getSession()
        if (session) {
          setSession(session)
          if (session.user?.id) {
            await aiService.initialize(session.user.id)
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error)
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    }

    const initUser = async () => {
      if (user?.id) {
        await aiService.initialize(user.id)
      }
    }

    initAuth()
    initUser()

    const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session)
        if (session?.user?.id) {
          await aiService.initialize(session.user.id)
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setSession, setLoading, setInitialized, user])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <FloatingAIButton />
    </div>
  )
}

function App() {
  return (
    <QueryProvider>
      <ThemeProvider defaultTheme="dark" storageKey="interior-accounts-theme">
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  )
}

export default App