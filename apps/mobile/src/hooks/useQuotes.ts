import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useQuote(id: string) {
  return useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      const res = await api.get(`/quotes/${id}`)
      return res.data // { quote }
    },
    enabled: !!id,
    staleTime: 10_000,
  })
}

export function useProjectQuotes(projectId: string) {
  return useQuery({
    queryKey: ['quotes', 'project', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/quotes`)
      return res.data // { quotes }
    },
    enabled: !!projectId,
    staleTime: 15_000,
  })
}

export function useSendChatMessage(quoteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { content: string }) => {
      const res = await api.post(`/quotes/${quoteId}/chat`, payload)
      return res.data // { assistantMessage, updatedVersion, changed }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
    },
  })
}

export function useApproveQuote(quoteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/quotes/${quoteId}/approve`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}
