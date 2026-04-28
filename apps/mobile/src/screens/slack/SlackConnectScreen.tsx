import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { api } from '../../lib/api'
import { Colors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'SlackConnect'>

const FEATURES = [
  { kind: 'monitor', label: 'Monitors messages in real time', color: Colors.primaryLight },
  { kind: 'alert', label: 'Detects scope expansion automatically', color: Colors.dangerLight },
  { kind: 'channel', label: 'Appears in your client channel, from your account', color: Colors.successLight },
]

function SlackGlyph() {
  return (
    <View style={styles.slackGlyph}>
      <View style={styles.slackGlyphBubble} />
      <View style={styles.slackGlyphTail} />
    </View>
  )
}

function FeatureGlyph({ kind }: { kind: string }) {
  if (kind === 'monitor') {
    return (
      <View style={styles.monitorGlyph}>
        <View style={[styles.monitorLine, { width: 20 }]} />
        <View style={[styles.monitorLine, { width: 14 }]} />
      </View>
    )
  }
  if (kind === 'alert') {
    return (
      <View style={styles.alertGlyph}>
        <View style={styles.alertBar} />
        <View style={styles.alertDot} />
      </View>
    )
  }
  return (
    <View style={styles.channelGlyph}>
      <View style={styles.channelNode} />
      <View style={styles.channelLine} />
      <View style={styles.channelNode} />
    </View>
  )
}

export default function SlackConnectScreen({ route, navigation }: Props) {
  const { projectId } = route.params
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (url.startsWith('scopesentry://slack-callback')) {
        const params = new URL(url.replace('scopesentry://', 'https://x.com/')).searchParams
        setConnecting(false)
        if (params.get('success') === 'true') {
          setConnected(true)
        } else {
          Alert.alert('Connection Failed', params.get('error') || 'Could not connect to Slack. Please try again.')
        }
      }
    }
    const sub = Linking.addEventListener('url', handleUrl)
    return () => sub.remove()
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconBg}>
            {connected ? <View style={styles.connectedGlyph} /> : <SlackGlyph />}
          </View>
        </View>

        <Text style={styles.title}>{connected ? 'You\'re connected!' : 'Connect Slack'}</Text>
        <Text style={styles.subtitle}>
          {connected
            ? 'Now pick the channel where your client communicates.'
            : 'ScopeSentry monitors your Slack channel to catch scope creep before it costs you.'}
        </Text>

        {connected ? (
          <View style={styles.successCard}>
            <View style={styles.successMark}>
              <View style={styles.successCheckLong} />
              <View style={styles.successCheckShort} />
            </View>
            <Text style={styles.successText}>Slack workspace connected</Text>
            <Text style={styles.successSub}>Select a channel to start monitoring</Text>
          </View>
        ) : (
          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <View style={[styles.featureIconBox, { backgroundColor: f.color }]}>
                  <FeatureGlyph kind={f.kind} />
                </View>
                <Text style={styles.featureText}>{f.label}</Text>
              </View>
            ))}
          </View>
        )}

        {connected ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('ChannelPicker', { projectId })}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Select Channel →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, connecting && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={connecting}
            activeOpacity={0.85}
          >
            {connecting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Connect Slack Workspace</Text>
            )}
          </TouchableOpacity>
        )}

        {!connected && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => navigation.navigate('BottomTabs', { screen: 'ProjectsTab' } as any)}
          >
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

  iconWrap: { marginBottom: 24 },
  iconBg: {
    width: 90,
    height: 90,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  slackGlyph: { alignItems: 'center' },
  slackGlyphBubble: {
    width: 34,
    height: 24,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  slackGlyphTail: {
    width: 12,
    height: 12,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: Colors.primary,
    transform: [{ rotate: '-25deg' }],
    marginTop: -4,
    marginLeft: -15,
  },
  connectedGlyph: {
    width: 34,
    height: 20,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderColor: Colors.primary,
    transform: [{ rotate: '-45deg' }],
    marginTop: -6,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },

  featureList: { width: '100%', gap: 12, marginBottom: 36 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  monitorGlyph: { gap: 5 },
  monitorLine: { height: 4, borderRadius: 2, backgroundColor: Colors.primaryDark },
  alertGlyph: { alignItems: 'center', gap: 4 },
  alertBar: { width: 5, height: 20, borderRadius: 3, backgroundColor: Colors.primaryDark },
  alertDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primaryDark },
  channelGlyph: { flexDirection: 'row', alignItems: 'center' },
  channelNode: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primaryDark },
  channelLine: { width: 14, height: 3, borderRadius: 2, backgroundColor: Colors.primaryDark },
  featureText: { fontSize: 14, color: Colors.textPrimary, flex: 1, lineHeight: 20, fontWeight: '500' },

  successCard: {
    backgroundColor: Colors.successLight,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
    gap: 6,
  },
  successMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successCheckLong: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.success,
    transform: [{ rotate: '-45deg' }],
    marginLeft: 6,
  },
  successCheckShort: {
    width: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.success,
    transform: [{ rotate: '45deg' }],
    marginTop: -3,
    marginLeft: -11,
  },
  successText: { fontSize: 17, fontWeight: '800', color: Colors.success },
  successSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  skipButton: { padding: 12 },
  skipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
})
