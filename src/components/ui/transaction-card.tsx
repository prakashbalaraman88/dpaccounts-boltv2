import React from 'react'
import { Calendar, Receipt, Tag } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Transaction } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface TransactionCardProps {
  transaction: Transaction
  onClick?: () => void
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onClick
}) => {
  const isIncome = transaction.type === 'income'
  
  return (
    <Card 
      className="transaction-card cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <Badge 
                variant={isIncome ? 'default' : 'secondary'}
                className={isIncome ? 'bg-gold-500/10 text-gold-600 border-gold-500/20' : 'bg-warm-800/10 text-warm-800 border-warm-800/20'}
              >
                {transaction.type}
              </Badge>
              {transaction.receipt_url && (
                <Receipt className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            <h4 className="font-medium text-foreground truncate">
              {transaction.description || transaction.category}
            </h4>
            
            <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Tag className="mr-1 h-3 w-3" />
                <span>{transaction.category}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="mr-1 h-3 w-3" />
                <span>{formatDate(transaction.transaction_date)}</span>
              </div>
            </div>
          </div>
          
          <div className="text-right ml-4">
            <p className={`text-lg font-semibold ${
              isIncome ? 'text-green-600' : 'text-red-600'
            }`}>
              {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
            </p>
            {transaction.vendor_name && (
              <p className="text-xs text-muted-foreground mt-1">
                {transaction.vendor_name}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}