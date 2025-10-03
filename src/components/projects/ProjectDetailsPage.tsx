import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
  User, 
  TrendingUp, 
  TrendingDown,
  Plus,
  Search,
  Receipt,
  Edit
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TransactionCard } from '@/components/ui/transaction-card'
import { useAppStore } from '@/stores/useAppStore'
import { formatCurrency, formatDate } from '@/lib/utils'

export const ProjectDetailsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { projects, transactions, setCurrentProject } = useAppStore()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')

  const project = projects.find(p => p.id === projectId)
  const projectTransactions = transactions.filter(t => t.project_id === projectId)

  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Project Not Found</h2>
          <p className="text-muted-foreground mb-4">The project you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  // Filter transactions
  const filteredTransactions = projectTransactions.filter(transaction => {
    const matchesSearch = transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || transaction.category === categoryFilter
    const matchesType = typeFilter === 'all' || transaction.type === typeFilter
    return matchesSearch && matchesCategory && matchesType
  })

  // Calculate stats
  const totalIncome = projectTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = projectTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const netAmount = totalIncome - totalExpenses

  // Get unique categories
  const categories = Array.from(new Set(projectTransactions.map(t => t.category)))

  const handleOpenChat = () => {
    setCurrentProject(project)
    navigate('/chat')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20'
      case 'completed':
        return 'bg-[#646F63]/10 text-[#646F63] border-[#646F63]/20'
      case 'on_hold':
        return 'bg-[#3A4040]/10 text-[#3A4040] border-[#3A4040]/20'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/projects')}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
            <p className="text-muted-foreground mt-1">
              Project details and transaction management
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleOpenChat}>
            Open Chat
          </Button>
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit Project
          </Button>
        </div>
      </div>

      {/* Project Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <User className="mr-2 h-4 w-4" />
                Client
              </div>
              <p className="font-medium">{project.client_name}</p>
              {project.client_contact && (
                <p className="text-sm text-muted-foreground">{project.client_contact}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <DollarSign className="mr-2 h-4 w-4" />
                Budget
              </div>
              <p className="font-medium">
                {project.budget ? formatCurrency(project.budget) : 'Not specified'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                Timeline
              </div>
              <p className="font-medium">
                {formatDate(project.start_date || project.created_at)}
                {project.end_date && ` - ${formatDate(project.end_date)}`}
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Status</div>
              <Badge className={getStatusColor(project.status)}>
                {project.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          {project.description && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-muted-foreground">{project.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-[#D4AF37] mr-2" />
              <div className="text-2xl font-bold text-[#D4AF37]">
                {formatCurrency(totalIncome)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <TrendingDown className="h-4 w-4 text-red-600 mr-2" />
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalExpenses)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 text-muted-foreground mr-2" />
              <div className={`text-2xl font-bold ${netAmount >= 0 ? 'text-[#D4AF37]' : 'text-red-600'}`}>
                {formatCurrency(netAmount)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Receipt className="h-4 w-4 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">
                {projectTransactions.length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transactions</CardTitle>
            <Button onClick={handleOpenChat}>
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={typeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('all')}
              >
                All
              </Button>
              <Button
                variant={typeFilter === 'income' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('income')}
              >
                Income
              </Button>
              <Button
                variant={typeFilter === 'expense' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('expense')}
              >
                Expenses
              </Button>
            </div>

            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            )}
          </div>

          {/* Transactions List */}
          {filteredTransactions.length > 0 ? (
            <div className="space-y-3">
              {filteredTransactions
                .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
                .map((transaction) => (
                  <div key={transaction.id} className="relative">
                    <TransactionCard transaction={transaction} />
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchTerm || typeFilter !== 'all' || categoryFilter !== 'all' 
                  ? 'No transactions match your filters' 
                  : 'No transactions yet'
                }
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || typeFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Start by adding your first transaction through the chat interface'
                }
              </p>
              <Button onClick={handleOpenChat}>
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}