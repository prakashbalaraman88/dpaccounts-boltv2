import React from 'react'
import { 
  LayoutDashboard, 
  FolderOpen, 
  MessageSquare, 
  Receipt, 
  Settings,
  PlusCircle
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/useAppStore'
import { NewProjectModal } from '@/components/projects/NewProjectModal'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export const Sidebar: React.FC = () => {
  const { currentProject } = useAppStore()
  const location = useLocation()

  return (
    <div className="hidden md:flex w-64 bg-card border-r border-border flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gold-500 rounded-md flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">IA</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Interior Accounts
            </h1>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 ml-10">
          Project Manager
        </p>
      </div>

      {/* Logo - Old version to remove */}
      <div className="hidden p-6 border-b border-border">
        <h1 className="hidden text-xl font-bold text-foreground">
          Interior Accounts
        </h1>
        <p className="hidden text-sm text-muted-foreground mt-1">
          Project Manager
        </p>
      </div>

      {/* Current Project */}
      {currentProject && (
        <div className="p-4 border-b border-border bg-muted/50">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Current Project
          </p>
          <p className="text-sm font-medium text-foreground mt-1 truncate">
            {currentProject.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {currentProject.client_name}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              'flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors',
              location.pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <item.icon className="mr-3 h-4 w-4" />
            {item.name}
          </Link>
        ))}
      </nav>

      {/* Quick Actions */}
      <div className="p-4 border-t border-border">
        <NewProjectModal>
          <Button className="w-full" size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </NewProjectModal>
      </div>
    </div>
  )
}