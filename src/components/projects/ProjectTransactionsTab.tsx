import { useState } from 'react'
import { Search, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types'

interface ProjectTransactionsTabProps {
  transactions: Transaction[]
}

export const ProjectTransactionsTab = ({ transactions }: ProjectTransactionsTabProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const categories = Array.from(new Set(transactions.map(t => t.category)))

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch =
      transaction.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || transaction.type === typeFilter
    const matchesCategory = categoryFilter === 'all' || transaction.category === categoryFilter
    return matchesSearch && matchesType && matchesCategory
  })

  const sortedTransactions = filteredTransactions.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
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
              <div className="h-6 w-px bg-border mx-2" />
              <Button
                variant={categoryFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter('all')}
              >
                All Categories
              </Button>
              {categories.slice(0, 5).map(category => (
                <Button
                  key={category}
                  variant={categoryFilter === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium text-muted-foreground">
                {searchQuery || typeFilter !== 'all' || categoryFilter !== 'all'
                  ? 'No transactions found'
                  : 'No transactions yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || typeFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Use the AI assistant to add your first transaction'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">
                        {transaction.description || 'Transaction'}
                      </p>
                      <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'} className="text-xs">
                        {transaction.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {transaction.vendor_name && (
                        <>
                          <span>{transaction.vendor_name}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{new Date(transaction.created_at).toLocaleDateString()}</span>
                      {transaction.transaction_date && transaction.transaction_date !== transaction.created_at.split('T')[0] && (
                        <>
                          <span>•</span>
                          <span>Date: {new Date(transaction.transaction_date).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className={`text-lg font-semibold ${transaction.type === 'income' ? 'text-success-600 dark:text-success-500' : 'text-error-600 dark:text-error-500'}`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </p>
                    {transaction.is_verified && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-bold">{transactions.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Income Transactions</p>
              <p className="text-2xl font-bold text-success-600 dark:text-success-500">
                {transactions.filter(t => t.type === 'income').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expense Transactions</p>
              <p className="text-2xl font-bold text-error-600 dark:text-error-500">
                {transactions.filter(t => t.type === 'expense').length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
