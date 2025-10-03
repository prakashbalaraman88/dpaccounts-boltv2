import React, { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/useAppStore'
import { 
  LayoutDashboard, 
  FolderOpen, 
  MessageSquare, 
  Receipt, 
  Settings 
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export const MobileNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { currentProject } = useAppStore()
  const location = useLocation()

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden bg-muted hover:bg-accent border border-border"
        onClick={() => setIsOpen(true)}
      >
        <Menu className="h-5 w-5 text-foreground stroke-2" />
      </Button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          
          <div className="fixed left-0 top-0 h-full w-64 bg-background border-r border-border shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gold-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-sm">IA</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Interior Accounts</h1>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Current Project */}
            {currentProject && (
              <div className="p-4 border-b border-border bg-muted">
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
            <nav className="p-4 space-y-2 bg-background">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors bg-background',
                    location.pathname === item.href
                      ? 'bg-primary text-primary-foreground border border-primary'
                      : 'text-foreground hover:text-foreground hover:bg-accent border border-transparent'
                  )}
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}