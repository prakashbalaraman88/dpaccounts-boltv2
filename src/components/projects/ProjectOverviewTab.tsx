import { TrendingUp, TrendingDown, DollarSign, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { Project, Transaction } from '@/types'

interface ProjectOverviewTabProps {
  project: Project
  transactions: Transaction[]
}

export const ProjectOverviewTab = ({ project, transactions }: ProjectOverviewTabProps) => {
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const balance = income - expenses
  const budget = project.budget || 0
  const budgetUsed = budget > 0 ? (expenses / budget) * 100 : 0
  const budgetRemaining = budget - expenses

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Income
            </CardTitle>
            <div className="w-10 h-10 rounded-full bg-success-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-success-600 dark:text-success-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success-600 dark:text-success-500">
              {formatCurrency(income)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {transactions.filter(t => t.type === 'income').length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
            <div className="w-10 h-10 rounded-full bg-error-500/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-error-600 dark:text-error-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-error-600 dark:text-error-500">
              {formatCurrency(expenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {transactions.filter(t => t.type === 'expense').length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Balance
            </CardTitle>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-success-600 dark:text-success-500' : 'text-error-600 dark:text-error-500'}`}>
              {formatCurrency(balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget Remaining
            </CardTitle>
            <div className="w-10 h-10 rounded-full bg-warning-500/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-warning-600 dark:text-warning-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${budgetRemaining >= 0 ? 'text-success-600 dark:text-success-500' : 'text-error-600 dark:text-error-500'}`}>
              {formatCurrency(budgetRemaining)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {budgetUsed.toFixed(0)}% used
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Budget Utilization</span>
              <span className={`text-sm font-bold ${budgetUsed > 100 ? 'text-error-600' : budgetUsed > 80 ? 'text-warning-600' : 'text-success-600'}`}>
                {budgetUsed.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${budgetUsed > 100 ? 'bg-error-500' : budgetUsed > 80 ? 'bg-warning-500' : 'bg-success-500'}`}
                style={{ width: `${Math.min(budgetUsed, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Total Budget</p>
              <p className="text-lg font-semibold">{formatCurrency(budget)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className={`text-lg font-semibold ${budgetRemaining >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                {formatCurrency(budgetRemaining)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Project Name</p>
              <p className="font-medium">{project.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{project.status}</p>
            </div>
            {project.client_email && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium">{project.client_email}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(project.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium">{new Date(project.updated_at).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
