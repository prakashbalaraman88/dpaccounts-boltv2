import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../database'
import type { Database } from '@/types/database'

type Project = Database['public']['Tables']['projects']['Row']
type ProjectInsert = Database['public']['Tables']['projects']['Insert']
type ProjectUpdate = Database['public']['Tables']['projects']['Update']

export const PROJECTS_QUERY_KEY = ['projects']

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await db.getProjects()
      if (error) throw error
      return data || []
    },
    staleTime: 30000,
    gcTime: 300000
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await db.getProject(id)
      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 30000
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (project: ProjectInsert) => {
      const { data, error } = await db.createProject(project)
      if (error) throw error
      return data
    },
    onSuccess: (newProject) => {
      queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, (old = []) => {
        return [newProject!, ...old]
      })
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
    }
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ProjectUpdate }) => {
      const { data, error } = await db.updateProject(id, updates)
      if (error) throw error
      return data
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_QUERY_KEY })

      const previousProjects = queryClient.getQueryData<Project[]>(PROJECTS_QUERY_KEY)

      queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, (old = []) => {
        return old.map(project =>
          project.id === id ? { ...project, ...updates } : project
        )
      })

      return { previousProjects }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(PROJECTS_QUERY_KEY, context.previousProjects)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
    }
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.deleteProject(id)
      if (error) throw error
      return id
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_QUERY_KEY })

      const previousProjects = queryClient.getQueryData<Project[]>(PROJECTS_QUERY_KEY)

      queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, (old = []) => {
        return old.filter(project => project.id !== id)
      })

      return { previousProjects }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(PROJECTS_QUERY_KEY, context.previousProjects)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
    }
  })
}
