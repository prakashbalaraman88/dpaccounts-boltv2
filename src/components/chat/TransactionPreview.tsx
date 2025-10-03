import React from 'react'
import { Check, CreditCard as Edit, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { Transaction } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TRANSACTION_CATEGORIES } from '@/lib/ai'

interface TransactionPreviewProps {
  transaction: Partial<Transaction>
  onConfirm: () => void
  onEdit: () => void
  onCancel?: () => void
  onUpdateTransaction: (updates: Partial<Transaction>) => void
}

export const TransactionPreview: React.FC<TransactionPreviewProps> = ({
  transaction,
  onConfirm,
  onEdit,
  onCancel,
  onUpdateTransaction
}) => {
  const availableCategories = transaction.type 
    ? TRANSACTION_CATEGORIES[transaction.type] 
    : []

  const handleCategoryChange = (category: string) => {
    onUpdateTransaction({ category })
  }

  return (
    <Card className="mx-4 mb-4 border-primary/50 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Transaction Preview</span>
          <Badge variant="outline" className="text-xs">
            Pending Confirmation
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Amount:</span>
              <p className="font-medium">
                {transaction.amount ? formatCurrency(transaction.amount) : 'Not specified'}
              </p>
            </div>
            
            <div>
              <span className="text-muted-foreground">Type:</span>
              <p className="font-medium capitalize">
                {transaction.type || 'Not specified'}
              </p>
            </div>
            
            <div>
              <span className="text-muted-foreground">Date:</span>
              <p className="font-medium">
                {transaction.transaction_date 
                  ? formatDate(transaction.transaction_date) 
                  : 'Today'
                }
              </p>
            </div>
          </div>

          {/* Category Selection */}
          {transaction.type && (
            <div className="space-y-2">
              <Label htmlFor="category">
                {transaction.type === 'income' ? 'Payment Method' : 'Expense Category'}
              </Label>
              <Select 
                value={transaction.category || ''} 
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger>
                  <SelectValue 
                    placeholder={`Select ${transaction.type === 'income' ? 'payment method' : 'category'}`} 
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category: string) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {transaction.description && (
            <div>
              <span className="text-muted-foreground text-sm">Description:</span>
              <p className="text-sm mt-1">{transaction.description}</p>
            </div>
          )}
        </div>

        <div className="hidden grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Amount:</span>
            <p className="font-medium">
              {transaction.amount ? formatCurrency(transaction.amount) : 'Not specified'}
            </p>
          </div>
          
          <div>
            <span className="text-muted-foreground">Type:</span>
            <p className="font-medium capitalize">
              {transaction.type || 'Not specified'}
            </p>
          </div>
          
          <div>
            <span className="text-muted-foreground">Category:</span>
            <p className="font-medium">
              {transaction.category || 'Not specified'}
            </p>
          </div>
          
          <div>
            <span className="text-muted-foreground">Date:</span>
            <p className="font-medium">
              {transaction.transaction_date 
                ? formatDate(transaction.transaction_date) 
                : 'Today'
              }
            </p>
          </div>
        </div>


        <div className="flex space-x-2 pt-2">
          <Button onClick={onConfirm} size="sm" className="flex-1">
            <Check className="mr-2 h-4 w-4" />
            Confirm
          </Button>
          
          <Button onClick={onEdit} variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          
          {onCancel && (
            <Button onClick={onCancel} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}