import React, { useState } from 'react'
import { Plus, Search, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/stores/useAppStore'
import { NewProjectModal } from './NewProjectModal'
import { formatCurrency } from '@/lib/utils'
import type { Project } from '@/types'

export const ProjectsPage: React.FC = () => {
  const { projects, currentProject, setCurrentProject, transactions } = useAppStore()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>('all')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.client_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const projectStats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    on_hold: projects.filter(p => p.status === 'on_hold').length
  }

  const handleProjectSelect = (project: Project) => {
    setCurrentProject(project)
    setSelectedProject(project)
  }

  const handleViewProject = (project: Project) => {
    setCurrentProject(project)
    navigate('/chat')
  }

  const getProjectTransactions = (projectId: string) => {
    return transactions.filter(t => t.project_id === projectId)
  }

  const getProjectStats = (projectId: string) => {
    const projectTransactions = getProjectTransactions(projectId)
    const income = projectTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const expenses = projectTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    return { income, expenses, net: income - expenses, count: projectTransactions.length }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Manage your interior design projects and track their progress.
          </p>
        </div>
        <div className="hidden sm:block">
          <NewProjectModal>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </NewProjectModal>
        </div>
        <div className="sm:hidden">
          <NewProjectModal>
            <Button size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </NewProjectModal>
        </div>
      </div>

      {/* Mobile New Project Button */}
      <div className="sm:hidden">
        <NewProjectModal>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </NewProjectModal>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl font-bold">{projectStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl font-bold text-gold-500">{projectStats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl font-bold text-sage-500">{projectStats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              On Hold
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl font-bold text-warm-800">{projectStats.on_hold}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Projects List */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle>All Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={statusFilter === 'active' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('active')}
                  >
                    Active
                  </Button>
                  <Button
                    variant={statusFilter === 'completed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('completed')}
                  >
                    Completed
                  </Button>
                  <Button
                    variant={statusFilter === 'on_hold' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('on_hold')}
                  >
                    On Hold
                  </Button>
                </div>
              </div>

              {/* Projects List */}
              {filteredProjects.length > 0 ? (
                <div className="space-y-4">
                  {filteredProjects.map((project) => {
                    const stats = getProjectStats(project.id)
                    const isSelected = selectedProject?.id === project.id
                    const isCurrent = currentProject?.id === project.id
                    
                    return (
                      <Card 
                        key={project.id} 
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                          isSelected ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => handleProjectSelect(project)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h3 className="font-semibold text-lg">{project.name}</h3>
                                <Badge 
                                  variant={project.status === 'active' ? 'default' : 'secondary'}
                                  className={
                                    project.status === 'active' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                                    project.status === 'completed' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                    'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                                  }
                                >
                                  {project.status.replace('_', ' ')}
                                </Badge>
                                {isCurrent && (
                                  <Badge className="bg-primary">Current</Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground mb-2">{project.client_name}</p>
                              <div className="flex items-center gap-4 text-sm flex-wrap">
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="h-4 w-4 text-gold-500" />
                                  <span className="text-gold-500">{formatCurrency(stats.income)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                  <span className="text-red-600">{formatCurrency(stats.expenses)}</span>
                                </div>
                                <div className="text-muted-foreground">
                                  {stats.count} transactions
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-col sm:flex-row">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/projects/${project.id}`)
                                }}
                              >
                                <span className="hidden sm:inline">View Details</span>
                                <span className="sm:hidden">Details</span>
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewProject(project)
                                }}
                              >
                                <span className="hidden sm:inline">Open Chat</span>
                                <span className="sm:hidden">Chat</span>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-muted-foreground mb-4">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'No projects match your search criteria' 
                      : 'No projects found'
                    }
                  </div>
                  {!searchTerm && statusFilter === 'all' && (
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Project
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Project Details */}
        <div className="lg:col-span-1 order-1 lg:order-2">
          {selectedProject ? (
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{selectedProject.name}</h3>
                    <p className="text-muted-foreground">{selectedProject.client_name}</p>
                  </div>

                  {selectedProject.budget && (
                    <div>
                      <span className="text-sm text-muted-foreground">Budget:</span>
                      <p className="font-medium">{formatCurrency(selectedProject.budget)}</p>
                    </div>
                  )}

                  {selectedProject.description && (
                    <div>
                      <span className="text-sm text-muted-foreground">Description:</span>
                      <p className="text-sm mt-1">{selectedProject.description}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Recent Transactions</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {getProjectTransactions(selectedProject.id).slice(0, 5).map((transaction) => (
                        <div key={transaction.id} className="p-2 bg-muted/50 rounded text-sm">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium truncate">{transaction.description || transaction.category}</p>
                              <p className="text-muted-foreground text-xs">{transaction.category}</p>
                            </div>
                            <div className={`font-medium ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                              {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                            </div>
                          </div>
                        </div>
                      ))}
                      {getProjectTransactions(selectedProject.id).length === 0 && (
                        <p className="text-muted-foreground text-sm">No transactions yet</p>
                      )}
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button 
                      className="w-full" 
                      onClick={() => handleViewProject(selectedProject)}
                    >
                      Open in Chat
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <p>Select a project to view details and transactions</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}