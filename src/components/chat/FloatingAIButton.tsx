import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { MessageCircle, X, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChatInterface } from './ChatInterface'
import { useProjectStore, useUIStore } from '@/stores'
import { useAppStore } from '@/stores/useAppStore'
import { useProjects } from '@/lib/api/hooks'

export const FloatingAIButton = () => {
  const [isMinimized, setIsMinimized] = useState(false)
  const { isChatOpen, setIsChatOpen } = useUIStore()
  const { currentProject, setCurrentProject } = useProjectStore()
  const { setCurrentProject: setAppCurrentProject } = useAppStore()
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const { data: projects = [] } = useProjects()

  const pathMatch = location.pathname.match(/\/projects\/([^\/]+)/)
  const projectIdFromPath = pathMatch ? pathMatch[1] : null
  const effectiveProjectId = projectId || projectIdFromPath

  const isProjectDetailsPage = location.pathname.includes('/projects/') && effectiveProjectId

  console.log('FloatingAIButton render:', {
    isProjectDetailsPage,
    isChatOpen,
    isMinimized,
    currentProject: currentProject?.name,
    projectId,
    projectIdFromPath,
    effectiveProjectId,
    pathname: location.pathname
  })

  useEffect(() => {
    if (effectiveProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === effectiveProjectId)
      if (project && project.id !== currentProject?.id) {
        console.log('Setting current project in both stores:', project.name)
        setCurrentProject(project)
        setAppCurrentProject(project)
      }
    }
  }, [effectiveProjectId, projects, currentProject, setCurrentProject, setAppCurrentProject])

  useEffect(() => {
    if (!currentProject && !location.pathname.includes('/projects/')) {
      setIsChatOpen(false)
      setIsMinimized(false)
    }
  }, [currentProject, location, setIsChatOpen])

  const toggleChat = () => {
    console.log('toggleChat called, current isChatOpen:', isChatOpen)
    if (isMinimized) {
      setIsMinimized(false)
    } else {
      setIsChatOpen(!isChatOpen)
    }
  }

  const minimizeChat = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMinimized(true)
  }

  const closeChat = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsChatOpen(false)
    setIsMinimized(false)
  }

  if (!isProjectDetailsPage) {
    console.log('Not on project details page, returning null')
    return null
  }

  console.log('About to render button/chat, isChatOpen:', isChatOpen, 'isMinimized:', isMinimized)

  return (
    <>
      {isChatOpen && !isMinimized && (
        <Card className="fixed bottom-24 right-6 w-full max-w-lg h-[600px] flex flex-col shadow-2xl border-2 z-[9999] md:bottom-6 md:right-6 md:w-[32rem]">
          <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">AI Assistant</h3>
                <p className="text-xs opacity-90">{currentProject?.name || 'Project'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={minimizeChat}
                className="h-8 w-8 p-0 hover:bg-primary-foreground/20 text-primary-foreground"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeChat}
                className="h-8 w-8 p-0 hover:bg-primary-foreground/20 text-primary-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <ChatInterface />
          </div>
        </Card>
      )}

      {(!isChatOpen || isMinimized) && (
        <Button
          onClick={toggleChat}
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl hover:scale-110 transition-transform z-[9999] md:h-16 md:w-16 bg-primary"
        >
          <MessageCircle className="h-6 w-6 md:h-7 md:w-7" />
        </Button>
      )}
    </>
  )
}
