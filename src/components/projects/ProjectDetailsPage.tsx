import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Settings, BarChart3, Receipt, CircleAlert as AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProjectOverviewTab } from './ProjectOverviewTab'
import { ProjectTransactionsTab } from './ProjectTransactionsTab'
import { useProjects } from '@/lib/api/hooks'
import { useTransactions } from '@/lib/api/hooks'
import { formatCurrency } from '@/lib/utils'

type Tab = 'overview' | 'transactions'

export const ProjectDetailsPage = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useProjects()
  const { data: allTransactions = [], isLoading: transactionsLoading } = useTransactions()

  const project = projects.find(p => p.id === projectId)
  const projectTransactions = allTransactions.filter(t => t.project_id === projectId)

  if (projectsError) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
          <AlertCircle className="w-5 h-5 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-error-700 dark:text-error-300">
              Failed to load project
            </p>
            <p className="text-xs text-error-600 dark:text-error-400 mt-1">
              {projectsError instanceof Error ? projectsError.message : 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (projectsLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="h-12 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
          <p className="text-muted-foreground mb-4">The project you're looking for doesn't exist.</p>
          <Link to="/projects">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'transactions' as const, label: 'Transactions', icon: Receipt },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/projects')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="h-6 w-px bg-border" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
            {project.name}
          </h1>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge
                variant={
                  project.status === 'active' ? 'default' :
                  project.status === 'completed' ? 'secondary' :
                  'outline'
                }
              >
                {project.status}
              </Badge>
              {project.client_email && (
                <span className="text-sm text-muted-foreground">
                  Client: {project.client_email}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-6 mt-4">
              <div>
                <p className="text-xs text-muted-foreground">Budget</p>
                <p className="text-lg font-semibold">{formatCurrency(project.budget || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Spent</p>
                <p className="text-lg font-semibold text-error-600 dark:text-error-500">
                  {formatCurrency(projectTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="text-lg font-semibold text-success-600 dark:text-success-500">
                  {formatCurrency(projectTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0))}
                </p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Edit Project
          </Button>
        </div>
      </Card>

      <div className="border-b">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        {transactionsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <ProjectOverviewTab project={project} transactions={projectTransactions} />
            )}
            {activeTab === 'transactions' && (
              <ProjectTransactionsTab transactions={projectTransactions} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
