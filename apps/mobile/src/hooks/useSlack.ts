import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useSlackChannels() {
  return useQuery({
    queryKey: ['slack', 'channels'],
    queryFn: async () => {
      const res = await api.get('/slack/channels')
      return res.data
    },
    staleTime: 60_000,
  })
}

export function useLinkChannel(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { channelId: string }) => {
      const res = await api.post(`/projects/${projectId}/slack/link`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}

export function useSlackInstallUrl() {
  return useQuery<{ url: string }>({
    queryKey: ['slack', 'install-url'],
    queryFn: async () => {
      const res = await api.get('/slack/install')
      return res.data
    },
    enabled: false, // Only fetch on demand
  })
}
