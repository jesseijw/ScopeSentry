import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Scope } from '../types'

export function useSubmitScope(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { file?: FormData; text?: string }) => {
      let res
      if (data.file) {
        res = await api.post(`/projects/${projectId}/scope`, data.file, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        res = await api.post(`/projects/${projectId}/scope`, { text: data.text })
      }
      return res.data as Scope
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}

export function useUpdateScope(projectId: string, scopeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      summary?: string
      estimatedHours?: number
      items?: Array<{ id?: string; kind: string; description: string }>
    }) => {
      const res = await api.patch(`/projects/${projectId}/scope/${scopeId}`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}
