import React, { useEffect, useRef } from 'react'
import { aiService } from '@/lib/ai'
import { ChatHeader } from './ChatHeader'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { TransactionPreview } from './TransactionPreview'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthContext } from '@/components/auth/AuthProvider'
import type { Transaction } from '@/types'

export const ChatInterface: React.FC = () => {
  const { user } = useAuthContext()
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

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSendMessage = async (content: string, imageFile?: File) => {
    if (!currentProject) return

    let imageDataUrl = ''
    if (imageFile) {
      imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(imageFile)
      })
    }

    const userMessage = {
      id: Date.now().toString(),
      project_id: currentProject.id,
      content,
      role: 'user' as const,
      message_type: imageFile ? 'image' as const : 'text' as const,
      image_url: imageDataUrl || null,
      transaction_id: null,
      ai_analysis: null,
      created_at: new Date().toISOString(),
      user_id: user?.id || 'demo-user'
    }

    addMessage(userMessage)
    setIsProcessing(true)

    try {
      const analysis = await aiService.analyzeTransaction(imageDataUrl)
      
      setIsTyping(true)
      
      setTimeout(() => {
        const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
        const aiContent = `I've analyzed your transaction. ${analysis.amount ? `I found an amount of ${formatCurrency(analysis.amount)}` : 'I couldn\'t detect a specific amount'}. ${analysis.type ? `This appears to be an ${analysis.type}.` : 'Could you clarify if this is income or expense?'} ${analysis.confidence < 0.7 ? 'Please select a category and review the details.' : 'Please select a category and confirm the details.'}`

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
            category: analysis.type === 'income' ? 'Current Account' : 'Construction Material',
            description: analysis.description,
            vendor_name: analysis.vendorName,
            transaction_date: new Date().toISOString().split('T')[0],
          })
        }

        setIsTyping(false)
        setIsProcessing(false)
      }, 2000)
    } catch (error) {
      console.error('Error processing message:', error)
      
      setIsTyping(true)
      setTimeout(() => {
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          project_id: currentProject.id,
          content: 'Sorry, I encountered an error analyzing your transaction. Please make sure the Gemini API key is configured correctly, or try again with a simpler message.',
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
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">
            No Project Selected
          </h3>
          <p className="text-muted-foreground">
            Select a project to start chatting and managing transactions
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background min-h-0">
      <ChatHeader project={currentProject} />
      
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <ChatMessages 
          messages={messages}
          isTyping={isTyping}
          isProcessing={isProcessing}
        />
        <div ref={messagesEndRef} />
      </div>

      {pendingTransaction && (
        <TransactionPreview
          transaction={pendingTransaction}
          onConfirm={handleConfirmTransaction}
          onEdit={() => {/* Handle edit */}}
          onUpdateTransaction={handleUpdatePendingTransaction}
        />
      )}

      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isProcessing}
        placeholder={
          isProcessing 
            ? "Processing your message..." 
            : "Type a message or upload a receipt..."
        }
      />
    </div>
  )
}