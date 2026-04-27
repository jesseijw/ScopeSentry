import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { api } from '../../lib/api'
import { Colors } from '../../lib/colors'
import { Linking } from 'react-native'

type Props = NativeStackScreenProps<AppStackParamList, 'SlackConnect'>

export default function SlackConnectScreen({ route, navigation }: Props) {
  const { projectId } = route.params
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (url.startsWith('scopesentry://slack-callback')) {
        const params = new URL(url.replace('scopesentry://', 'https://x.com/')).searchParams
        const success = params.get('success')
        const error = params.get('error')

        setConnecting(false)

        if (success === 'true') {
          setConnected(true)
        } else {
          Alert.alert('Connection Failed', error || 'Could not connect to Slack. Please try again.')
        }
      }
    }

    const subscription = Linking.addEventListener('url', handleUrl)
    return () => subscription.remove()
  }, [])

  async function handleConnect() {
    setConnecting(true)
    try {
      const { data } = await api.get('/slack/install')
      await WebBrowser.openAuthSessionAsync(data.url, 'scopesentry://slack-callback')
    } catch (err: any) {
      setConnecting(false)
      Alert.alert('Error', err.message || 'Could not start Slack OAuth.')
    }
  }

  function handleContinue() {
    navigation.navigate('ChannelPicker', { projectId })
  }

  function handleSkip() {
    navigation.navigate('BottomTabs', { screen: 'ProjectsTab' } as any)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔗</Text>
        </View>

        <Text style={styles.title}>Connect Slack</Text>
        <Text style={styles.subtitle}>
          ScopeSentry monitors your Slack channel to detect when a client requests work outside
          your agreed scope. Connect your workspace to get started.
        </Text>

        {connected ? (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successText}>Slack connected successfully!</Text>
            <Text style={styles.successSubtext}>Now select the channel for this project.</Text>
          </View>
        ) : (
          <View style={styles.featureList}>
            {[
              'Monitors messages in real-time',
              'Detects scope expansion automatically',
              'Messages appear in your client channel, from your account',
            ].map((feat) => (
              <View key={feat} style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{feat}</Text>
              </View>
            ))}
          </View>
        )}

        {connected ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Select Channel →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, connecting && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={connecting}
            activeOpacity={0.8}
          >
            {connecting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Connect Slack Workspace</Text>
            )}
          </TouchableOpacity>
        )}

        {!connected && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#4A154B20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: { fontSize: 40 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  featureList: { width: '100%', marginBottom: 32, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureCheck: { color: Colors.success, fontSize: 16, fontWeight: '700' },
  featureText: { fontSize: 14, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  successBox: {
    backgroundColor: Colors.success + '15',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  successIcon: { fontSize: 40, marginBottom: 12 },
  successText: { fontSize: 18, fontWeight: '700', color: Colors.success, marginBottom: 6 },
  successSubtext: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  skipButton: { padding: 12 },
  skipText: { color: Colors.textSecondary, fontSize: 14 },
})
