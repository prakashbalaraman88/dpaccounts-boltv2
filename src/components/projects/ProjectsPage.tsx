import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, FolderOpen, CircleAlert as AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { NewProjectModal } from './NewProjectModal'
import { useProjects } from '@/lib/api/hooks'
import { useTransactions } from '@/lib/api/hooks'
import { formatCurrency } from '@/lib/utils'

export const ProjectsPage = () => {
  const { data: projects = [], isLoading, error } = useProjects()
  const { data: transactions = [] } = useTransactions()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>('all')

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.client_email?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusCounts = {
    all: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    on_hold: projects.filter(p => p.status === 'on_hold').length,
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
          <AlertCircle className="w-5 h-5 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-error-700 dark:text-error-300">
              Failed to load projects
            </p>
            <p className="text-xs text-error-600 dark:text-error-400 mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Projects
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your interior design projects and track their progress
          </p>
        </div>
        <NewProjectModal>
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="mr-2 h-5 w-5" />
            New Project
          </Button>
        </NewProjectModal>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
          onClick={() => setStatusFilter('all')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.all}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'active' ? 'ring-2 ring-warning-500' : 'hover:shadow-md'}`}
          onClick={() => setStatusFilter('active')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-600 dark:text-warning-500">
              {statusCounts.active}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'completed' ? 'ring-2 ring-success-500' : 'hover:shadow-md'}`}
          onClick={() => setStatusFilter('completed')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success-600 dark:text-success-500">
              {statusCounts.completed}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'on_hold' ? 'ring-2 ring-error-500' : 'hover:shadow-md'}`}
          onClick={() => setStatusFilter('on_hold')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              On Hold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-error-600 dark:text-error-500">
              {statusCounts.on_hold}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
              >
                Completed
              </Button>
              <Button
                variant={statusFilter === 'on_hold' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('on_hold')}
              >
                On Hold
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium text-muted-foreground">
                {searchQuery || statusFilter !== 'all' ? 'No projects found' : 'No projects yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first project to get started'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <NewProjectModal>
                  <Button size="lg" className="mt-6">
                    <Plus className="mr-2 h-5 w-5" />
                    Create Your First Project
                  </Button>
                </NewProjectModal>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProjects.map((project) => {
                const projectTransactions = transactions.filter(t => t.project_id === project.id)
                const projectIncome = projectTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
                const projectExpenses = projectTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
                const projectBalance = projectIncome - projectExpenses
                const budget = project.budget || 0
                const budgetUsed = budget > 0 ? (projectExpenses / budget) * 100 : 0

                return (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="block p-6 rounded-lg border bg-card hover:bg-accent/50 transition-all hover:shadow-md"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold truncate">{project.name}</h3>
                          <Badge
                            variant={
                              project.status === 'active' ? 'default' :
                              project.status === 'completed' ? 'secondary' :
                              'outline'
                            }
                          >
                            {project.status}
                          </Badge>
                        </div>
                        {project.client_email && (
                          <p className="text-sm text-muted-foreground truncate">
                            Client: {project.client_email}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Budget</p>
                            <p className="text-sm font-semibold">{formatCurrency(budget)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Spent</p>
                            <p className="text-sm font-semibold text-error-600 dark:text-error-500">
                              {formatCurrency(projectExpenses)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Income</p>
                            <p className="text-sm font-semibold text-success-600 dark:text-success-500">
                              {formatCurrency(projectIncome)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Balance</p>
                            <p className={`text-sm font-semibold ${projectBalance >= 0 ? 'text-success-600 dark:text-success-500' : 'text-error-600 dark:text-error-500'}`}>
                              {formatCurrency(projectBalance)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Budget Used</p>
                          <p className={`text-2xl font-bold ${budgetUsed > 100 ? 'text-error-600 dark:text-error-500' : budgetUsed > 80 ? 'text-warning-600 dark:text-warning-500' : 'text-success-600 dark:text-success-500'}`}>
                            {budgetUsed.toFixed(0)}%
                          </p>
                        </div>
                        <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${budgetUsed > 100 ? 'bg-error-500' : budgetUsed > 80 ? 'bg-warning-500' : 'bg-success-500'}`}
                            style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
