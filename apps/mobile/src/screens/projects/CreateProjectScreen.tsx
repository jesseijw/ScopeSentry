import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { useCreateProject } from '../../hooks/useProjects'
import { Colors, TierColors } from '../../lib/colors'
import { PricingTier } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'CreateProject'>

const TIERS: { value: PricingTier; label: string; description: string }[] = [
  { value: 'PREMIUM',    label: 'Premium',    description: 'Quotes priced at 1.3× your implied base rate' },
  { value: 'MID',        label: 'Mid',        description: 'Quotes priced at 1.15× your implied base rate' },
  { value: 'AFFORDABLE', label: 'Affordable', description: 'Quotes priced at 1.05× your implied base rate' },
]

const STEP_LABELS = ['Basic Info', 'Financials', 'Timeline']

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepIndicator}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={styles.stepPillWrapper}>
          <View style={[
            styles.stepPill,
            i < current  ? styles.stepPillDone :
            i === current ? styles.stepPillActive :
            styles.stepPillInactive,
          ]}>
            {i < current && <Text style={styles.stepCheck}>✓</Text>}
            {i === current && <Text style={styles.stepNumber}>{i + 1}</Text>}
          </View>
          {i < total - 1 && (
            <View style={[styles.stepLine, i < current && styles.stepLineDone]} />
          )}
        </View>
      ))}
    </View>
  )
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>
}

function TierGlyph({ tier, color }: { tier: PricingTier; color: string }) {
  if (tier === 'PREMIUM') {
    return (
      <View style={styles.premiumGlyph}>
        <View style={[styles.premiumDiamond, { borderColor: color }]} />
        <View style={[styles.premiumDot, { backgroundColor: color }]} />
      </View>
    )
  }

  if (tier === 'MID') {
    return (
      <View style={styles.midGlyph}>
        <View style={[styles.midLine, { backgroundColor: color, width: 22 }]} />
        <View style={[styles.midLine, { backgroundColor: color, width: 14 }]} />
      </View>
    )
  }

  return (
    <View style={styles.affordableGlyph}>
      <View style={[styles.affordableRing, { borderColor: color }]} />
      <View style={[styles.affordableLeaf, { backgroundColor: color }]} />
    </View>
  )
}

function Input({ value, onChangeText, placeholder, keyboardType, autoCapitalize }: {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  keyboardType?: any
  autoCapitalize?: any
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textSecondary}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      style={styles.input}
    />
  )
}

export default function CreateProjectScreen({ navigation }: Props) {
  const [step, setStep] = useState(0)
  const { mutateAsync: createProject, isPending } = useCreateProject()

  const [title, setTitle]           = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  const [currency, setCurrency]     = useState('USD')
  const [pricingTier, setPricingTier] = useState<PricingTier>('MID')
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')

  function validateStep() {
    if (step === 0) {
      if (!title.trim()) return 'Project title is required'
      if (!clientName.trim()) return 'Client name is required'
      if (!clientEmail.trim() || !clientEmail.includes('@')) return 'Valid client email is required'
    }
    if (step === 1) {
      if (!totalPrice || isNaN(Number(totalPrice))) return 'Valid price is required'
    }
    if (step === 2) {
      if (!startDate) return 'Start date is required (YYYY-MM-DD)'
      if (!endDate) return 'End date is required (YYYY-MM-DD)'
    }
    return null
  }

  async function handleNext() {
    const error = validateStep()
    if (error) { Alert.alert('Oops!', error); return }
    if (step < 2) {
      setStep((s) => s + 1)
    } else {
      try {
        const project = await createProject({
          title: title.trim(),
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          totalPriceCents: Math.round(Number(totalPrice) * 100),
          currency,
          pricingTier,
          startDate,
          endDate,
        })
        navigation.replace('ScopeUpload', { projectId: project.id })
      } catch (e: any) {
        console.log('Create project failed:', e?.response?.data || e?.message || e)
        Alert.alert(
          'Error',
          e?.response?.data?.error || e?.message || 'Failed to create project. Please try again.'
        )
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Step indicator */}
          <View style={styles.stepHeader}>
            <StepIndicator current={step} total={3} />
            <Text style={styles.stepLabel}>{STEP_LABELS[step]}</Text>
          </View>

          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Project details</Text>
              <Text style={styles.stepSubtitle}>Basic details about this project</Text>

              <Label>Project Title *</Label>
              <Input value={title} onChangeText={setTitle} placeholder="e.g. Acme Corp Website Redesign" />

              <Label>Client Name *</Label>
              <Input value={clientName} onChangeText={setClientName} placeholder="e.g. Jane Smith" />

              <Label>Client Email *</Label>
              <Input value={clientEmail} onChangeText={setClientEmail} placeholder="jane@acme.com" keyboardType="email-address" autoCapitalize="none" />
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Set the price</Text>
              <Text style={styles.stepSubtitle}>Contract value and pricing strategy</Text>

              <Label>Total Contract Price (USD) *</Label>
              <Input value={totalPrice} onChangeText={setTotalPrice} placeholder="e.g. 5000" keyboardType="numeric" />

              <Label>Pricing Tier *</Label>
              {TIERS.map((tier) => {
                const tierColors = TierColors[tier.value]
                const isSelected = pricingTier === tier.value
                return (
                  <TouchableOpacity
                    key={tier.value}
                    style={[
                      styles.tierOption,
                      isSelected && { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
                    ]}
                    onPress={() => setPricingTier(tier.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.tierMarkBox, { backgroundColor: tierColors.background }]}>
                      <TierGlyph tier={tier.value} color={tierColors.text} />
                    </View>
                    <View style={styles.tierOptionText}>
                      <View style={styles.tierLabelRow}>
                        <Text style={[styles.tierBadgeText, { color: tierColors.text, backgroundColor: tierColors.background }]}>
                          {tier.label}
                        </Text>
                        {isSelected && (
                          <View style={styles.selectedDot}>
                            <Text style={styles.selectedDotInner}>✓</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.tierDescription}>{tier.description}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Set the timeline</Text>
              <Text style={styles.stepSubtitle}>When does this project run?</Text>

              <Label>Start Date * (YYYY-MM-DD)</Label>
              <Input value={startDate} onChangeText={setStartDate} placeholder="2026-01-01" keyboardType="numbers-and-punctuation" />

              <Label>End Date * (YYYY-MM-DD)</Label>
              <Input value={endDate} onChangeText={setEndDate} placeholder="2026-03-31" keyboardType="numbers-and-punctuation" />
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={() => setStep((s) => s - 1)}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextButton, step > 0 ? { flex: 1 } : { width: '100%' as any }]}
            onPress={handleNext}
            disabled={isPending}
            activeOpacity={0.85}
          >
            {isPending ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.nextButtonText}>
                {step === 2 ? 'Create Project' : 'Next →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  stepHeader: { alignItems: 'center', marginBottom: 28 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stepPillWrapper: { flexDirection: 'row', alignItems: 'center' },
  stepPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPillActive:   { backgroundColor: Colors.primary },
  stepPillDone:     { backgroundColor: Colors.success },
  stepPillInactive: { backgroundColor: Colors.border },
  stepCheck:  { color: Colors.white, fontSize: 14, fontWeight: '800' },
  stepNumber: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  stepLine:   { width: 28, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: Colors.success },
  stepLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },

  stepContent: { gap: 4 },
  stepTitle: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4, letterSpacing: -0.3 },
  stepSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, lineHeight: 20 },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  tierOption: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tierMarkBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  premiumGlyph: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumDiamond: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
  },
  premiumDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  midGlyph: {
    width: 26,
    gap: 6,
    alignItems: 'center',
  },
  midLine: {
    height: 4,
    borderRadius: 2,
  },
  affordableGlyph: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affordableRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  affordableLeaf: {
    position: 'absolute',
    right: 4,
    bottom: 5,
    width: 9,
    height: 6,
    borderRadius: 6,
    transform: [{ rotate: '-25deg' }],
  },
  tierOptionText: { flex: 1 },
  tierLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  selectedDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDotInner: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  tierDescription: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },

  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  backButtonText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  nextButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonText: { fontSize: 16, fontWeight: '700', color: Colors.white },
})
