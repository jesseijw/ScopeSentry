import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native'
import { Colors } from '../../lib/colors'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'

const FEATURES = [
  { kind: 'scope', label: 'Track project scope automatically', color: Colors.primaryLight },
  { kind: 'drift', label: 'Detect drift in Slack messages', color: Colors.accentLight },
  { kind: 'quote', label: 'Generate change order quotes instantly', color: Colors.successLight },
]

function LogoGlyph() {
  return (
    <View style={styles.logoGlyph}>
      <View style={styles.logoGlyphTop} />
      <View style={styles.logoGlyphMiddle} />
      <View style={styles.logoGlyphBottom} />
    </View>
  )
}

function FeatureGlyph({ kind }: { kind: string }) {
  if (kind === 'scope') {
    return (
      <View style={styles.scopeGlyph}>
        <View style={[styles.scopeLine, { width: 18 }]} />
        <View style={[styles.scopeLine, { width: 12 }]} />
        <View style={[styles.scopeLine, { width: 16 }]} />
      </View>
    )
  }

  if (kind === 'drift') {
    return (
      <View style={styles.driftGlyph}>
        <View style={[styles.driftBar, { height: 10 }]} />
        <View style={[styles.driftBar, { height: 18 }]} />
        <View style={[styles.driftBar, { height: 26 }]} />
      </View>
    )
  }

  return (
    <View style={styles.quoteGlyph}>
      <View style={styles.quoteCard} />
      <View style={styles.quoteAccent} />
    </View>
  )
}

export default function WelcomeScreen() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const { setToken, setUser } = useAuthStore()

  async function handleEmailSignIn() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      Alert.alert('Email required', 'Enter your email to continue.')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/email', { email: normalizedEmail })
      await setToken(res.data.token)
      setUser(res.data.user)
    } catch (e: any) {
      console.log('Email sign in failed:', e?.response?.data || e?.message || e)
      Alert.alert(
        'Sign in failed',
        e?.response?.data?.error || e?.message || 'Could not sign in. Make sure the API server is running.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Decorative blobs */}
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <View style={styles.inner}>
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <LogoGlyph />
          </View>
          <Text style={styles.appName}>ScopeSentry</Text>
          <Text style={styles.tagline}>
            Stop scope creep before it starts.{'\n'}Protect your freelance business.
          </Text>
        </View>

        {/* Feature cards */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <View style={[styles.featureIconBox, { backgroundColor: f.color }]}>
                <FeatureGlyph kind={f.kind} />
              </View>
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Auth form */}
        <View style={styles.buttons}>
          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} />
          ) : (
            <>
              <TextInput
                style={styles.emailInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={handleEmailSignIn}
              />
              <TouchableOpacity
                style={styles.signInButton}
                onPress={handleEmailSignIn}
                activeOpacity={0.85}
              >
                <Text style={styles.signInButtonText}>Continue</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.terms}>
          This development sign-in uses your email to create a local account.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  blobTop: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.primaryLight,
    opacity: 0.6,
  },
  blobBottom: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Colors.accentLight,
    opacity: 0.5,
  },
  inner: {
    flex: 1,
    padding: 28,
    justifyContent: 'space-between',
  },
  logoArea: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  logoGlyph: {
    width: 42,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyphTop: {
    width: 32,
    height: 10,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: Colors.white,
  },
  logoGlyphMiddle: {
    width: 36,
    height: 22,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.white,
  },
  logoGlyphBottom: {
    width: 26,
    height: 14,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderColor: Colors.white,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  features: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  featureIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scopeGlyph: {
    gap: 4,
    alignItems: 'flex-start',
  },
  scopeLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primaryDark,
  },
  driftGlyph: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  driftBar: {
    width: 5,
    borderRadius: 3,
    backgroundColor: Colors.primaryDark,
  },
  quoteGlyph: {
    width: 26,
    height: 26,
  },
  quoteCard: {
    position: 'absolute',
    left: 3,
    top: 3,
    width: 18,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.transparent,
  },
  quoteAccent: {
    position: 'absolute',
    right: 2,
    bottom: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primaryDark,
  },
  featureText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  buttons: {
    gap: 12,
    alignItems: 'center',
  },
  emailInput: {
    width: '100%',
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  signInButton: {
    width: '100%',
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  terms: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
})
