import { TrendingUp, TrendingDown, DollarSign, FolderOpen, CircleAlert as AlertCircle, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProjects } from '@/lib/api/hooks'
import { useTransactions } from '@/lib/api/hooks'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export const Dashboard = () => {
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useProjects()
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions()

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const netAmount = totalIncome - totalExpenses
  const activeProjects = projects.filter(p => p.status === 'active')
  const recentTransactions = transactions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

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
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-24">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Overview of all your projects and transactions
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
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

        <Card className="shadow-sm hover:shadow-md transition-shadow">
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

        <Card className="shadow-sm hover:shadow-md transition-shadow">
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
                <div className={`text-2xl md:text-3xl font-bold ${netAmount >= 0 ? 'text-success-600 dark:text-success-500' : 'text-error-600 dark:text-error-500'}`}>
                  {formatCurrency(netAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Current balance
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Projects
            </CardTitle>
            <div className="w-10 h-10 rounded-full bg-warning-500/10 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-warning-600 dark:text-warning-500" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-warning-600 dark:text-warning-500">
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
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Latest {recentTransactions.length} transactions across all projects
              </p>
            </div>
            <Link to="/projects">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No transactions yet</p>
                <p className="text-xs mt-1">Start by creating a project and adding transactions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => {
                  const project = projects.find(p => p.id === transaction.project_id)
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {transaction.description || 'Transaction'}
                          </p>
                          <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'} className="text-xs">
                            {transaction.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground truncate">
                            {project?.name || 'Unknown Project'}
                          </p>
                          {transaction.vendor_name && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <p className="text-xs text-muted-foreground truncate">
                                {transaction.vendor_name}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className={`font-semibold ${transaction.type === 'income' ? 'text-success-600 dark:text-success-500' : 'text-error-600 dark:text-error-500'}`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active Projects</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {activeProjects.length} project{activeProjects.length !== 1 ? 's' : ''} in progress
              </p>
            </div>
            <Link to="/projects">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No active projects</p>
                <p className="text-xs mt-1">Create your first project to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeProjects.slice(0, 5).map((project) => {
                  const projectTransactions = transactions.filter(t => t.project_id === project.id)
                  const projectIncome = projectTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
                  const projectExpenses = projectTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
                  const projectBalance = projectIncome - projectExpenses

                  return (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="block p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{project.name}</p>
                          {project.client_email && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {project.client_email}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <div className="text-xs">
                              <span className="text-muted-foreground">Budget: </span>
                              <span className="font-medium">{formatCurrency(project.budget || 0)}</span>
                            </div>
                            <div className="text-xs">
                              <span className="text-muted-foreground">Spent: </span>
                              <span className="font-medium">{formatCurrency((project.spent || projectExpenses) || 0)}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant={projectBalance >= 0 ? 'default' : 'destructive'} className="ml-2">
                          {formatCurrency(projectBalance)}
                        </Badge>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
