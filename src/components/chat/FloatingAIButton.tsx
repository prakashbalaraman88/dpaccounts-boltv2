import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { MessageCircle, X, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PersistentChat } from './PersistentChat'
import { useProjectStore } from '@/stores'
import { useProjects } from '@/lib/api/hooks'

export const FloatingAIButton = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const { currentProject, setCurrentProject } = useProjectStore()
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const { data: projects = [] } = useProjects()

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const project = projects.find(p => p.id === projectId)
      if (project && project.id !== currentProject?.id) {
        setCurrentProject(project)
      }
    }
  }, [projectId, projects, currentProject, setCurrentProject])

  useEffect(() => {
    if (!currentProject && !location.pathname.includes('/projects/')) {
      setIsOpen(false)
      setIsMinimized(false)
    }
  }, [currentProject, location])

  const toggleChat = () => {
    if (isMinimized) {
      setIsMinimized(false)
    } else {
      setIsOpen(!isOpen)
    }
  }

  const minimizeChat = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMinimized(true)
  }

  const closeChat = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
    setIsMinimized(false)
  }

  if (!currentProject) {
    return null
  }

  return (
    <>
      {isOpen && !isMinimized && (
        <Card className="fixed bottom-24 right-6 w-full max-w-lg h-[600px] flex flex-col shadow-2xl border-2 z-50 md:bottom-6 md:right-6">
          <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">AI Assistant</h3>
                <p className="text-xs opacity-90">{currentProject.name}</p>
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
          <div className="flex-1 overflow-hidden">
            <PersistentChat />
          </div>
        </Card>
      )}

      {(!isOpen || isMinimized) && (
        <Button
          onClick={toggleChat}
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl hover:scale-110 transition-transform z-50 md:h-16 md:w-16"
        >
          <MessageCircle className="h-6 w-6 md:h-7 md:w-7" />
        </Button>
      )}
    </>
  )
}
