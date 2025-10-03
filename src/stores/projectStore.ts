import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Database } from '@/types/database'

type Project = Database['public']['Tables']['projects']['Row']

interface ProjectState {
  currentProject: Project | null
  selectedProjectId: string | null

  setCurrentProject: (project: Project | null) => void
  setSelectedProjectId: (id: string | null) => void
  clearCurrentProject: () => void
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      (set) => ({
        currentProject: null,
        selectedProjectId: null,

        setCurrentProject: (project) =>
          set({
            currentProject: project,
            selectedProjectId: project?.id || null
          }),

        setSelectedProjectId: (id) => set({ selectedProjectId: id }),

        clearCurrentProject: () =>
          set({
            currentProject: null,
            selectedProjectId: null
          })
      }),
      {
        name: 'project-storage',
        partialize: (state) => ({
          selectedProjectId: state.selectedProjectId
        })
      }
    ),
    { name: 'ProjectStore' }
  )
)
