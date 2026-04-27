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
  {
    value: 'PREMIUM',
    label: 'Premium',
    description: 'Quotes priced at 1.3× your implied base rate',
  },
  {
    value: 'MID',
    label: 'Mid',
    description: 'Quotes priced at 1.15× your implied base rate',
  },
  {
    value: 'AFFORDABLE',
    label: 'Affordable',
    description: 'Quotes priced at 1.05× your implied base rate',
  },
]

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepIndicator}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            i < current ? styles.stepDotDone : i === current ? styles.stepDotActive : styles.stepDotInactive,
          ]}
        />
      ))}
    </View>
  )
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>
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

  // Step 1
  const [title, setTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')

  // Step 2
  const [totalPrice, setTotalPrice] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [pricingTier, setPricingTier] = useState<PricingTier>('MID')

  // Step 3
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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
    if (error) {
      Alert.alert('Validation Error', error)
      return
    }
    if (step < 2) {
      setStep((s) => s + 1)
    } else {
      // Submit
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
      } catch (e) {
        Alert.alert('Error', 'Failed to create project. Please try again.')
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <StepIndicator current={step} total={3} />

          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Basic Info</Text>
              <Text style={styles.stepSubtitle}>Tell us about this project</Text>

              <Label>Project Title *</Label>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Acme Corp Website Redesign"
              />

              <Label>Client Name *</Label>
              <Input
                value={clientName}
                onChangeText={setClientName}
                placeholder="e.g. Jane Smith"
              />

              <Label>Client Email *</Label>
              <Input
                value={clientEmail}
                onChangeText={setClientEmail}
                placeholder="jane@acme.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Financials</Text>
              <Text style={styles.stepSubtitle}>Set the contract value and pricing tier</Text>

              <Label>Total Contract Price (USD) *</Label>
              <Input
                value={totalPrice}
                onChangeText={setTotalPrice}
                placeholder="e.g. 5000"
                keyboardType="numeric"
              />

              <Label>Pricing Tier *</Label>
              {TIERS.map((tier) => {
                const tierColors = TierColors[tier.value]
                const isSelected = pricingTier === tier.value
                return (
                  <TouchableOpacity
                    key={tier.value}
                    style={[
                      styles.tierOption,
                      isSelected && { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
                    ]}
                    onPress={() => setPricingTier(tier.value)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tierOptionLeft}>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <View>
                        <View style={[styles.tierBadge, { backgroundColor: tierColors.background }]}>
                          <Text style={[styles.tierBadgeText, { color: tierColors.text }]}>
                            {tier.label}
                          </Text>
                        </View>
                        <Text style={styles.tierDescription}>{tier.description}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Timeline</Text>
              <Text style={styles.stepSubtitle}>When does this project run?</Text>

              <Label>Start Date * (YYYY-MM-DD)</Label>
              <Input
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-01-01"
                keyboardType="numbers-and-punctuation"
              />

              <Label>End Date * (YYYY-MM-DD)</Label>
              <Input
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-03-31"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep((s) => s - 1)}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextButton, { flex: step > 0 ? 1 : undefined, width: step === 0 ? '100%' : undefined }]}
            onPress={handleNext}
            disabled={isPending}
            activeOpacity={0.8}
          >
            {isPending ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.nextButtonText}>
                {step === 2 ? 'Create Project' : 'Next'}
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
  stepIndicator: { flexDirection: 'row', gap: 8, marginBottom: 28, justifyContent: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  stepDotActive: { backgroundColor: Colors.primary, width: 24 },
  stepDotDone: { backgroundColor: Colors.primary },
  stepDotInactive: { backgroundColor: Colors.border },
  stepContent: { gap: 4 },
  stepTitle: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tierOption: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  tierOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  tierBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4 },
  tierBadgeText: { fontSize: 12, fontWeight: '700' },
  tierDescription: { fontSize: 13, color: Colors.textSecondary },
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
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  backButtonText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  nextButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextButtonText: { fontSize: 16, fontWeight: '600', color: Colors.white },
})
