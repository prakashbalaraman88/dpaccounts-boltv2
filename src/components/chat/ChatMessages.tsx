import React from 'react'
import { Bot, User, Image, CheckCircle } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { ChatMessage } from '@/types'
import { formatDateTime, formatCurrency } from '@/lib/utils'

interface ChatMessagesProps {
  messages: ChatMessage[]
  isTyping: boolean
  isProcessing: boolean
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isTyping,
  isProcessing
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && !isProcessing && (
        <div className="text-center py-8">
          <Bot className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Start a conversation
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Send me transaction details like "Received 1 lakh from client" or upload receipt images. 
            I'll help you categorize and track everything automatically.
          </p>
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isTyping && <TypingIndicator />}
    </div>
  )
}

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} chat-message`}>
      <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start space-x-2`}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className={isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
            {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>

        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`rounded-lg px-4 py-2 max-w-full ${
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border'
            }`}
          >
            {message.image_url && (
              <div className="mb-2">
                <img
                  src={message.image_url}
                  alt="Receipt"
                  className="max-w-full h-auto rounded border"
                  style={{ maxHeight: '200px' }}
                />
                <div className="flex items-center mt-1 text-xs opacity-75">
                  <Image className="h-3 w-3 mr-1" />
                  Receipt Image
                </div>
              </div>
            )}

            <div className="whitespace-pre-wrap text-sm">
              {message.content}
            </div>

            {message.message_type === 'transaction' && message.ai_analysis && (
              <div className="mt-2 pt-2 border-t border-border/20">
                <div className="flex flex-wrap gap-1">
                  {message.ai_analysis.amount && (
                    <Badge variant="secondary" className="text-xs">
                      {formatCurrency(message.ai_analysis.amount)}
                    </Badge>
                  )}
                  {message.ai_analysis.type && (
                    <Badge 
                      variant={message.ai_analysis.type === 'income' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {message.ai_analysis.type}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {message.transaction_id && (
              <div className="flex items-center mt-2 text-xs opacity-75">
                <CheckCircle className="h-3 w-3 mr-1" />
                Transaction Saved
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground mt-1">
            {formatDateTime(message.created_at)}
          </div>
        </div>
      </div>
    </div>
  )
}

const TypingIndicator: React.FC = () => (
  <div className="flex justify-start">
    <div className="flex items-start space-x-2">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-muted">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="bg-card border border-border rounded-lg px-4 py-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    </div>
  </div>
)