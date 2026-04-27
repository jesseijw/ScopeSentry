import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useMessages(projectId: string) {
  return useQuery({
    queryKey: ['messages', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/messages`)
      return res.data // { messages, pagination }
    },
    enabled: !!projectId,
    staleTime: 15_000,
  })
}

export function useMessage(messageId: string) {
  return useQuery({
    queryKey: ['message', messageId],
    queryFn: async () => {
      // We get single message details via the project messages list
      // In practice the app passes full data; as fallback we fetch from list
      const res = await api.get(`/messages/${messageId}`)
      return res.data // { analysis }
    },
    enabled: !!messageId,
    staleTime: 15_000,
    // Graceful 404 handling
    retry: (count, err: any) => err?.response?.status !== 404 && count < 2,
  })
}

export function useOverrideMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      messageId,
      override,
    }: {
      messageId: string
      override: 'NOT_DRIFT' | 'CONFIRMED_DRIFT'
    }) => {
      const res = await api.post(`/messages/${messageId}/override`, { override })
      return res.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['message', variables.messageId] })
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    },
  })
}
