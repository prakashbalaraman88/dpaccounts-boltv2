import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Paperclip, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { aiService, TRANSACTION_CATEGORIES } from '@/lib/ai'
import { formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types'

export const PersistentChat: React.FC = () => {
  const { user } = useAuthContext()
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { 
    currentProject, 
    messages, 
    isTyping, 
    isProcessing, 
    pendingTransaction,
    addMessage,
    setIsTyping,
    setIsProcessing,
    setPendingTransaction,
    addTransaction
  } = useAppStore()

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping, isOpen])

  const handleSendMessage = async (content: string, imageFile?: File) => {
    if (!currentProject) return

    const userMessage = {
      id: Date.now().toString(),
      project_id: currentProject.id,
      content,
      role: 'user' as const,
      message_type: imageFile ? 'image' as const : 'text' as const,
      image_url: imageFile ? URL.createObjectURL(imageFile) : null,
      transaction_id: null,
      ai_analysis: null,
      created_at: new Date().toISOString(),
      user_id: user?.id || 'demo-user'
    }

    addMessage(userMessage)
    setIsProcessing(true)

    try {
      if (imageFile) {
        const reader = new FileReader()
        const imageData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })

        const analysis = await aiService.analyzeTransaction(imageData)

        setIsTyping(true)

        setTimeout(() => {
          const aiContent = `I've analyzed your transaction. ${analysis.amount ? `I found an amount of ${formatCurrency(analysis.amount)}` : 'I couldn\'t detect a specific amount'}. ${analysis.type ? `This appears to be an ${analysis.type}.` : 'Could you clarify if this is income or expense?'} ${analysis.category ? `I've categorized this as "${analysis.category}".` : ''} ${analysis.confidence < 0.7 ? 'Let me ask a few questions to get more details.' : 'The details look good!'}`

          const aiMessage = {
            id: (Date.now() + 1).toString(),
            project_id: currentProject.id,
            content: aiContent,
            role: 'assistant' as const,
            message_type: 'transaction' as const,
            image_url: null,
            transaction_id: null,
            ai_analysis: analysis,
            created_at: new Date().toISOString(),
            user_id: user?.id || 'demo-user'
          }

          addMessage(aiMessage)

          if (analysis.amount && analysis.type) {
            setPendingTransaction({
              project_id: currentProject.id,
              amount: analysis.amount,
              type: analysis.type,
              category: analysis.category || (analysis.type === 'income' ? 'Current Account' : 'Construction Material'),
              subcategory: analysis.subcategory,
              description: analysis.description,
              vendor_name: analysis.vendorName,
              transaction_date: new Date().toISOString().split('T')[0],
            })
          }

          setIsTyping(false)
          setIsProcessing(false)
        }, 2000)
      } else {
        const analysis = await aiService.analyzeTextTransaction(content)

        setIsTyping(true)
        setTimeout(() => {
          const aiContent = `I've analyzed your transaction. ${analysis.amount ? `I found an amount of ${formatCurrency(analysis.amount)}` : 'I couldn\'t detect a specific amount'}. ${analysis.type ? `This appears to be an ${analysis.type}.` : 'Could you clarify if this is income or expense?'} ${analysis.category ? `I've categorized this as "${analysis.category}".` : ''} ${analysis.confidence < 0.7 ? 'Let me ask a few questions to get more details.' : 'The details look good!'}`

          const aiMessage = {
            id: (Date.now() + 1).toString(),
            project_id: currentProject.id,
            content: aiContent,
            role: 'assistant' as const,
            message_type: 'transaction' as const,
            image_url: null,
            transaction_id: null,
            ai_analysis: analysis,
            created_at: new Date().toISOString(),
            user_id: user?.id || 'demo-user'
          }

          addMessage(aiMessage)

          if (analysis.amount && analysis.type) {
            setPendingTransaction({
              project_id: currentProject.id,
              amount: analysis.amount,
              type: analysis.type,
              category: analysis.category || (analysis.type === 'income' ? 'Current Account' : 'Construction Material'),
              subcategory: analysis.subcategory,
              description: analysis.description,
              vendor_name: analysis.vendorName,
              transaction_date: new Date().toISOString().split('T')[0],
            })
          }

          setIsTyping(false)
          setIsProcessing(false)
        }, 1500)
      }
    } catch (error) {
      console.error('Error processing message:', error)

      setIsTyping(true)
      setTimeout(() => {
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          project_id: currentProject.id,
          content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
          role: 'assistant' as const,
          message_type: 'text' as const,
          image_url: null,
          transaction_id: null,
          ai_analysis: null,
          created_at: new Date().toISOString(),
          user_id: user?.id || 'demo-user'
        }

        addMessage(errorMessage)
        setIsTyping(false)
        setIsProcessing(false)
      }, 1000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if ((!message.trim() && !selectedFile) || isProcessing) return

    setIsUploading(true)
    try {
      await handleSendMessage(message.trim(), selectedFile || undefined)
      setMessage('')
      setSelectedFile(null)
      
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Please select an image smaller than 5MB')
      return
    }

    setSelectedFile(file)
  }

  const handleConfirmTransaction = async () => {
    if (!pendingTransaction || !currentProject) return

    const transaction = {
      id: Date.now().toString(),
      ...pendingTransaction,
      project_id: currentProject.id,
      amount: pendingTransaction.amount || 0,
      type: pendingTransaction.type || 'expense',
      category: pendingTransaction.category || (pendingTransaction.type === 'income' ? 'Current Account' : 'Construction Material'),
      is_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user?.id || 'demo-user'
    } as Transaction

    addTransaction(transaction)

    const confirmationMessage = {
      id: (Date.now() + 2).toString(),
      project_id: currentProject.id,
      content: `✅ Transaction confirmed! Added ${transaction.type} of ${formatCurrency(transaction.amount)} for ${transaction.category}.`,
      role: 'assistant' as const,
      message_type: 'transaction' as const,
      image_url: null,
      transaction_id: transaction.id,
      ai_analysis: null,
      created_at: new Date().toISOString(),
      user_id: user?.id || 'demo-user'
    }

    addMessage(confirmationMessage)
    setPendingTransaction(null)
  }

  const handleUpdatePendingTransaction = (updates: Partial<Transaction>) => {
    if (!pendingTransaction) return
    setPendingTransaction({ ...pendingTransaction, ...updates })
  }

  const handleCategoryChange = (category: string) => {
    handleUpdatePendingTransaction({ category })
  }

  if (!currentProject) {
    return null
  }

  return (
    <>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <div className="fixed bottom-20 right-4 z-40">
          <Button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
            size="icon"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 w-full sm:w-96 h-[70vh] sm:h-[500px] bg-background border border-border shadow-2xl z-50 flex flex-col sm:m-4 sm:rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-card">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  AI
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-sm">Transaction Assistant</h3>
                <p className="text-xs text-muted-foreground">{currentProject.name}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
            {messages.length === 0 && !isProcessing && (
              <div className="text-center py-8">
                <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Send transaction details or upload receipts
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background border border-border'
                  }`}
                >
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Receipt"
                      className="max-w-full h-auto rounded mb-2"
                      style={{ maxHeight: '150px' }}
                    />
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.ai_analysis && (
                    <div className="mt-2 pt-2 border-t border-border/20">
                      <div className="flex flex-wrap gap-1">
                        {msg.ai_analysis.amount && (
                          <Badge variant="secondary" className="text-xs">
                            {formatCurrency(msg.ai_analysis.amount)}
                          </Badge>
                        )}
                        {msg.ai_analysis.type && (
                          <Badge variant="outline" className="text-xs">
                            {msg.ai_analysis.type}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-background border border-border rounded-lg px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Transaction Preview */}
          {pendingTransaction && (
            <div className="p-3 border-t border-border bg-primary/5 space-y-3">
              <div className="text-xs font-medium">Transaction Preview</div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <p className="font-medium">
                    {pendingTransaction.amount ? formatCurrency(pendingTransaction.amount) : 'Not specified'}
                  </p>
                </div>
                
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p className="font-medium capitalize">
                    {pendingTransaction.type || 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Category Selection */}
              {pendingTransaction.type && (
                <div className="space-y-1">
                  <Label htmlFor="category" className="text-xs">
                    {pendingTransaction.type === 'income' ? 'Payment Method' : 'Expense Category'}
                  </Label>
                  <Select 
                    value={pendingTransaction.category || ''} 
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue 
                        placeholder={`Select ${pendingTransaction.type === 'income' ? 'payment method' : 'category'}`} 
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_CATEGORIES[pendingTransaction.type].map((category) => (
                        <SelectItem key={category} value={category} className="text-xs">
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end">
                <Button 
                  size="sm" 
                  onClick={handleConfirmTransaction}
                  disabled={!pendingTransaction.category}
                  className="text-xs px-3 py-1"
                >
                  Confirm Transaction
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border bg-background">
            {selectedFile && (
              <div className="mb-2 p-2 bg-muted rounded flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Image className="h-4 w-4" />
                  <span className="text-sm truncate">{selectedFile.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value)
                    const textarea = e.target
                    textarea.style.height = 'auto'
                    textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px'
                  }}
                  placeholder="Type a message..."
                  disabled={isProcessing || isUploading}
                  className="min-h-[40px] max-h-[80px] resize-none pr-10 text-sm"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 bottom-1 h-8 w-8 p-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing || isUploading}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>

              <Button
                type="submit"
                disabled={(!message.trim() && !selectedFile) || isProcessing || isUploading}
                size="sm"
                className="h-10 w-10 p-0"
              >
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </form>
          </div>
        </div>
      )}
    </>
  )
}