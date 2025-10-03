import React from 'react'
import { MessageSquare, User, Calendar } from 'lucide-react'
import type { Project } from '@/types'
import { formatDate } from '@/lib/utils'

interface ChatHeaderProps {
  project: Project
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ project }) => {
  return (
    <div className="border-b border-border bg-card p-4">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <MessageSquare className="h-8 w-8 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground truncate">
            {project.name}
          </h2>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <User className="mr-1 h-3 w-3" />
              <span>{project.client_name}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="mr-1 h-3 w-3" />
              <span>{formatDate(project.start_date || project.created_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}