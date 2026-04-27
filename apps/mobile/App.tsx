import 'expo-dev-client'
import React, { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { api } from './src/lib/api'
import RootNavigator from './src/navigation/RootNavigator'

// Configure how notifications are shown when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
})

async function registerPushNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied')
    return
  }

  // Get Expo push token (backed by APNs in production)
  const token = await Notifications.getDevicePushTokenAsync()
  const deviceToken = token.data

  if (deviceToken) {
    // Register with backend
    const authToken = await SecureStore.getItemAsync('auth_token')
    if (authToken) {
      try {
        await api.post('/devices/register', { deviceToken })
      } catch (err) {
        console.warn('Failed to register device token:', err)
      }
    }
  }
}

export default function App() {
  useEffect(() => {
    registerPushNotifications()

    // Handle notification taps when app was closed
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data
      console.log('Notification tapped:', data)
      // Navigation happens inside the navigator based on notification data
    })

    return () => subscription.remove()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  )
}
