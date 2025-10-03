import React from 'react'
import { Calendar, DollarSign, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Project } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface ProjectCardProps {
  project: Project
  onSelect: (project: Project) => void
  isSelected?: boolean
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onSelect,
  isSelected = false
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-gold-500/10 text-gold-600 border-gold-500/20'
      case 'completed':
        return 'bg-sage-500/10 text-sage-600 border-sage-500/20'
      case 'on_hold':
        return 'bg-warm-600/10 text-warm-700 border-warm-600/20'
      default:
        return 'bg-warm-500/10 text-warm-600 border-warm-500/20'
    }
  }

  return (
    <Card 
      className={`project-card cursor-pointer transition-all duration-200 ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => onSelect(project)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold truncate">
            {project.name}
          </CardTitle>
          <Badge className={getStatusColor(project.status)}>
            {project.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center text-sm text-muted-foreground">
          <User className="mr-2 h-4 w-4" />
          <span className="truncate">{project.client_name}</span>
        </div>
        
        {project.budget && (
          <div className="flex items-center text-sm text-muted-foreground">
            <DollarSign className="mr-2 h-4 w-4" />
            <span>{formatCurrency(project.budget)}</span>
          </div>
        )}
        
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="mr-2 h-4 w-4" />
          <span>{formatDate(project.start_date || project.created_at)}</span>
        </div>
        
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        )}
        
        <div className="pt-2">
          <Button 
            size="sm" 
            className="w-full"
            onClick={(e) => {
              e.stopPropagation()
              onSelect(project)
            }}
          >
            {isSelected ? 'Selected' : 'Select Project'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}