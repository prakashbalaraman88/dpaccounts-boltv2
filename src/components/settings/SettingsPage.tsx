import React, { useState, useEffect } from 'react'
import { Key, Save, Trash2, CircleCheck as CheckCircle, Circle as XCircle, CircleAlert as AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { aiService } from '@/lib/ai'
import type { APISettings } from '@/lib/ai'

export const SettingsPage: React.FC = () => {
  const { user } = useAuthContext()
  const [settings, setSettings] = useState<APISettings[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [geminiKey, setGeminiKey] = useState('')
  const [geminiActive, setGeminiActive] = useState(true)
  const [geminiPriority, setGeminiPriority] = useState('1')

  const [claudeKey, setClaudeKey] = useState('')
  const [claudeActive, setClaudeActive] = useState(true)
  const [claudePriority, setClaudePriority] = useState('2')

  const [providerStatus, setProviderStatus] = useState<{ provider: string; available: boolean }[]>([])

  useEffect(() => {
    if (user?.id) {
      loadSettings()
      updateProviderStatus()
    }
  }, [user?.id])

  const loadSettings = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const data = await aiService.getAPISettings(user.id)

      data.forEach(setting => {
        if (setting.provider === 'gemini') {
          setGeminiKey(maskApiKey(setting.api_key))
          setGeminiActive(setting.is_active)
          setGeminiPriority(setting.priority.toString())
        } else if (setting.provider === 'claude') {
          setClaudeKey(maskApiKey(setting.api_key))
          setClaudeActive(setting.is_active)
          setClaudePriority(setting.priority.toString())
        }
      })

      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
      showMessage('error', 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const updateProviderStatus = () => {
    const status = aiService.getProviderStatus()
    setProviderStatus(status)
  }

  const maskApiKey = (key: string): string => {
    if (key.length <= 8) return key
    return key.substring(0, 4) + '•'.repeat(key.length - 8) + key.substring(key.length - 4)
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleSaveGemini = async () => {
    if (!user?.id || !geminiKey) {
      showMessage('error', 'API key is required')
      return
    }

    if (geminiKey.includes('•')) {
      showMessage('error', 'Please enter a new API key')
      return
    }

    try {
      setSaving(true)
      await aiService.saveAPISettings({
        user_id: user.id,
        provider: 'gemini',
        api_key: geminiKey,
        is_active: geminiActive,
        priority: parseInt(geminiPriority)
      })

      await aiService.initialize(user.id)
      updateProviderStatus()
      showMessage('success', 'Gemini settings saved successfully')
      await loadSettings()
    } catch (error) {
      console.error('Failed to save Gemini settings:', error)
      showMessage('error', 'Failed to save Gemini settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveClaude = async () => {
    if (!user?.id || !claudeKey) {
      showMessage('error', 'API key is required')
      return
    }

    if (claudeKey.includes('•')) {
      showMessage('error', 'Please enter a new API key')
      return
    }

    try {
      setSaving(true)
      await aiService.saveAPISettings({
        user_id: user.id,
        provider: 'claude',
        api_key: claudeKey,
        is_active: claudeActive,
        priority: parseInt(claudePriority)
      })

      await aiService.initialize(user.id)
      updateProviderStatus()
      showMessage('success', 'Claude settings saved successfully')
      await loadSettings()
    } catch (error) {
      console.error('Failed to save Claude settings:', error)
      showMessage('error', 'Failed to save Claude settings')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return

    try {
      await aiService.deleteAPISettings(id)
      updateProviderStatus()
      showMessage('success', 'API key deleted successfully')
      await loadSettings()
    } catch (error) {
      console.error('Failed to delete settings:', error)
      showMessage('error', 'Failed to delete API key')
    }
  }

  const getStatusBadge = (provider: string) => {
    const status = providerStatus.find(p => p.provider === provider)
    if (!status) return null

    return status.available ? (
      <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge variant="secondary">
        <XCircle className="w-3 h-3 mr-1" />
        Not Configured
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-muted-foreground">Loading settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI API Settings</h1>
          <p className="text-muted-foreground">
            Configure your AI provider API keys. Lower priority number means higher preference (1 = primary, 2 = fallback).
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-500'
              : 'bg-red-500/10 text-red-500'
          }`}>
            <AlertCircle className="w-5 h-5" />
            {message.text}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Google Gemini API
                </CardTitle>
                <CardDescription className="mt-1">
                  Get your API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google AI Studio
                  </a>
                </CardDescription>
              </div>
              {getStatusBadge('gemini')}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gemini-key">API Key</Label>
              <Input
                id="gemini-key"
                type="password"
                placeholder="Enter your Gemini API key"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gemini-priority">Priority</Label>
                <Select value={geminiPriority} onValueChange={setGeminiPriority}>
                  <SelectTrigger id="gemini-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Primary)</SelectItem>
                    <SelectItem value="2">2 (Secondary)</SelectItem>
                    <SelectItem value="3">3 (Tertiary)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gemini-active">Status</Label>
                <Select
                  value={geminiActive ? 'active' : 'inactive'}
                  onValueChange={(val) => setGeminiActive(val === 'active')}
                >
                  <SelectTrigger id="gemini-active">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveGemini} disabled={saving || !geminiKey}>
                <Save className="w-4 h-4 mr-2" />
                Save Gemini Settings
              </Button>
              {settings.find(s => s.provider === 'gemini') && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    const setting = settings.find(s => s.provider === 'gemini')
                    if (setting?.id) handleDelete(setting.id)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Anthropic Claude API
                </CardTitle>
                <CardDescription className="mt-1">
                  Get your API key from{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Anthropic Console
                  </a>
                </CardDescription>
              </div>
              {getStatusBadge('claude')}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claude-key">API Key</Label>
              <Input
                id="claude-key"
                type="password"
                placeholder="Enter your Claude API key"
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="claude-priority">Priority</Label>
                <Select value={claudePriority} onValueChange={setClaudePriority}>
                  <SelectTrigger id="claude-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Primary)</SelectItem>
                    <SelectItem value="2">2 (Secondary)</SelectItem>
                    <SelectItem value="3">3 (Tertiary)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="claude-active">Status</Label>
                <Select
                  value={claudeActive ? 'active' : 'inactive'}
                  onValueChange={(val) => setClaudeActive(val === 'active')}
                >
                  <SelectTrigger id="claude-active">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveClaude} disabled={saving || !claudeKey}>
                <Save className="w-4 h-4 mr-2" />
                Save Claude Settings
              </Button>
              {settings.find(s => s.provider === 'claude') && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    const setting = settings.find(s => s.provider === 'claude')
                    if (setting?.id) handleDelete(setting.id)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Priority System:</strong> The AI service will try providers in order of priority (1, 2, 3...).
              If the primary provider fails, it automatically falls back to the next available provider.
            </p>
            <p>
              <strong>Security:</strong> Your API keys are stored securely in the database and are only accessible
              to your account. They are never shared or exposed to other users.
            </p>
            <p>
              <strong>Recommendations:</strong> Set Gemini as priority 1 (primary) and Claude as priority 2 (fallback)
              for the best experience and reliability.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
