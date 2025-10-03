import { Plus, TrendingUp, TrendingDown, DollarSign, FolderOpen, CircleAlert as AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/ui/project-card'
import { TransactionCard } from '@/components/ui/transaction-card'
import { NewProjectModal } from '@/components/projects/NewProjectModal'
import { useProjects } from '@/lib/api/hooks'
import { useTransactions } from '@/lib/api/hooks'
import { useProjectStore } from '@/stores'
import { formatCurrency } from '@/lib/utils'

export const Dashboard = () => {
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useProjects()
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions()
  const { currentProject, setCurrentProject } = useProjectStore()

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const netAmount = totalIncome - totalExpenses
  const activeProjects = projects.filter(p => p.status === 'active')
  const recentTransactions = transactions.slice(0, 5)

  if (projectsError) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
          <AlertCircle className="w-5 h-5 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-error-700 dark:text-error-300">
              Failed to load dashboard data
            </p>
            <p className="text-xs text-error-600 dark:text-error-400 mt-1">
              {projectsError instanceof Error ? projectsError.message : 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isLoading = projectsLoading || transactionsLoading

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Welcome back! Here's your project overview.
          </p>
        </div>
        <NewProjectModal>
          <Button size="lg" className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all">
            <Plus className="mr-2 h-5 w-5" />
            New Project
          </Button>
        </NewProjectModal>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="backdrop-blur-sm bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Income
            </CardTitle>
            <div className="w-10 h-10 rounded-full bg-success-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-success-600 dark:text-success-500" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-success-600 dark:text-success-500">
                  {formatCurrency(totalIncome)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {transactions.filter(t => t.type === 'income').length} transactions
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
            <div className="w-10 h-10 rounded-full bg-error-500/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-error-600 dark:text-error-500" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-error-600 dark:text-error-500">
                  {formatCurrency(totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {transactions.filter(t => t.type === 'expense').length} transactions
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Amount
            </CardTitle>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className={`text-2xl md:text-3xl font-bold ${
                  netAmount >= 0
                    ? 'text-success-600 dark:text-success-500'
                    : 'text-error-600 dark:text-error-500'
                }`}>
                  {formatCurrency(netAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Current balance
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Projects
            </CardTitle>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold">
                  {activeProjects.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {projects.length} total
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="backdrop-blur-sm bg-card/50 border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Current Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-24 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : currentProject ? (
              <ProjectCard
                project={currentProject as any}
                onSelect={setCurrentProject as any}
                isSelected={true}
              />
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">No project selected</p>
                <Link to="/projects">
                  <Button variant="outline">Browse Projects</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm bg-card/50 border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Recent Transactions
              </span>
              {recentTransactions.length > 0 && (
                <Link to="/transactions">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">No transactions yet</p>
                <Link to="/chat">
                  <Button>Add Transaction</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="backdrop-blur-sm bg-card/50 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Active Projects</span>
            {activeProjects.length > 0 && (
              <Link to="/projects">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : activeProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project as any}
                  onSelect={setCurrentProject as any}
                  isSelected={currentProject?.id === project.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-2 text-lg font-medium">No active projects</p>
              <p className="text-sm text-muted-foreground mb-6">
                Get started by creating your first project
              </p>
              <NewProjectModal>
                <Button size="lg" className="shadow-lg">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Your First Project
                </Button>
              </NewProjectModal>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
