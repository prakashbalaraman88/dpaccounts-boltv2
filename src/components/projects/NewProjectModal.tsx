import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthContext } from '@/components/auth/AuthProvider'
import type { Project } from '@/types'

interface NewProjectModalProps {
  children: React.ReactNode
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ children }) => {
  const { addProject, setCurrentProject } = useAppStore()
  const { user } = useAuthContext()
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    projectName: '',
    projectType: '',
    propertyName: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.projectName.trim() || !formData.projectType || !formData.propertyName.trim()) {
      return
    }

    if (!user?.id) {
      console.error('No user ID available')
      return
    }

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: formData.projectName.trim(),
      client_name: formData.propertyName.trim(),
      client_contact: null,
      client_email: null,
      budget: null,
      spent: null,
      status: 'active',
      description: `${formData.projectType} project for ${formData.propertyName}`,
      start_date: new Date().toISOString().split('T')[0],
      end_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user.id
    }

    addProject(newProject)
    setCurrentProject(newProject)

    // Reset form and close modal
    setFormData({ projectName: '', projectType: '', propertyName: '' })
    setOpen(false)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.projectName.trim() && formData.projectType && formData.propertyName.trim()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new project. All fields are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                placeholder="e.g., Modern Living Room Renovation"
                value={formData.projectName}
                onChange={(e) => handleInputChange('projectName', e.target.value)}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="projectType">Project Type</Label>
              <Select value={formData.projectType} onValueChange={(value) => handleInputChange('projectType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Interiors">Interiors</SelectItem>
                  <SelectItem value="Construction">Construction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="propertyName">Property Name</Label>
              <Input
                id="propertyName"
                placeholder="e.g., Rajesh Kumar Residence"
                value={formData.propertyName}
                onChange={(e) => handleInputChange('propertyName', e.target.value)}
                required
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!isFormValid}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}