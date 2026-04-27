import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { User } from '../types'

interface AuthStore {
  token: string | null
  user: User | null
  isLoading: boolean
  setToken: (token: string) => Promise<void>
  setUser: (user: User) => void
  logout: () => Promise<void>
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  isLoading: true,

  setToken: async (token: string) => {
    await SecureStore.setItemAsync('auth_token', token)
    set({ token })
  },

  setUser: (user: User) => {
    set({ user })
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token')
    set({ token: null, user: null })
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token')
      set({ token, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },
}))
