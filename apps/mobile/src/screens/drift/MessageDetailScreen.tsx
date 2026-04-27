import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { useMessage, useOverrideMessage } from '../../hooks/useMessages'
import { useProjectQuotes } from '../../hooks/useQuotes'
import { Colors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'MessageDetail'>

const CATEGORY_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  EXPANSION: {
    label: 'Scope Expansion',
    color: Colors.danger,
    description: 'This message requests new work not in the original scope.',
  },
  MODIFICATION: {
    label: 'Scope Modification',
    color: Colors.warning,
    description: 'This message asks to change something already in scope.',
  },
  CLARIFICATION: {
    label: 'Clarification',
    color: Colors.success,
    description: 'This message asks about existing scope — no new work.',
  },
  UPDATE: {
    label: 'Status Update',
    color: Colors.textSecondary,
    description: 'This is a status check or non-work message.',
  },
  APPROVAL: {
    label: 'Approval',
    color: Colors.primary,
    description: 'The client is acknowledging or approving existing work.',
  },
}

export default function MessageDetailScreen({ route, navigation }: Props) {
  const { messageId, projectId } = route.params
  const { data, isLoading, refetch } = useMessage(messageId)
  const { data: quotesData } = useProjectQuotes(projectId)
  const overrideMutation = useOverrideMessage()

  const message = data?.analysis
  const category = message?.intentCategory
  const config = category ? (CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.UPDATE) : null

  const triggeredQuote = quotesData?.quotes?.find(
    (q: any) => q.sourceMessageAnalysisId === messageId
  )

  async function handleOverride(override: 'NOT_DRIFT' | 'CONFIRMED_DRIFT') {
    if (!message) return
    try {
      await overrideMutation.mutateAsync({ messageId, override })
      await refetch()
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save override.')
    }
  }

  if (isLoading || !message) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const driftScore = message.driftScore ? Number(message.driftScore) : null

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Category Badge */}
        {config && (
          <View style={[styles.categoryHeader, { borderLeftColor: config.color }]}>
            <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
              <Text style={[styles.categoryLabel, { color: config.color }]}>{config.label}</Text>
            </View>
            <Text style={styles.categoryDesc}>{config.description}</Text>
          </View>
        )}

        {/* Drift Score */}
        {driftScore !== null && (
          <View style={styles.scoreSection}>
            <Text style={styles.sectionLabel}>Drift Score</Text>
            <View style={styles.scoreBar}>
              <View
                style={[
                  styles.scoreFill,
                  {
                    width: `${Math.round(driftScore * 100)}%`,
                    backgroundColor:
                      driftScore > 0.7 ? Colors.danger : driftScore > 0.4 ? Colors.warning : Colors.success,
                  },
                ]}
              />
            </View>
            <Text style={styles.scoreValue}>{Math.round(driftScore * 100)}%</Text>
          </View>
        )}

        {/* Message Text */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Client Message</Text>
          <View style={styles.messageBubble}>
            <Text style={styles.messageText}>{message.rawText}</Text>
          </View>
        </View>

        {/* Nearest Scope Item */}
        {message.nearestScopeItem && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Nearest Scope Item</Text>
            <View style={styles.scopeItemBox}>
              <View style={[styles.kindDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.scopeItemText}>{message.nearestScopeItem.description}</Text>
            </View>
          </View>
        )}

        {/* Quote Draft */}
        {triggeredQuote && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Draft Quote</Text>
            <TouchableOpacity
              style={styles.quoteCard}
              onPress={() =>
                navigation.navigate('QuoteChat', { quoteId: triggeredQuote.id, projectId })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.quoteStatus}>{triggeredQuote.status.replace('_', ' ')}</Text>
              {triggeredQuote.versions?.[0] && (
                <Text style={styles.quoteTotal}>
                  ${(Number(triggeredQuote.versions[0].totalCents) / 100).toFixed(2)}
                </Text>
              )}
              <Text style={styles.openQuote}>Open Quote Editor →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Override Actions */}
        {!message.freelancerOverride && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your Assessment</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.notDriftButton}
                onPress={() => handleOverride('NOT_DRIFT')}
                disabled={overrideMutation.isPending}
                activeOpacity={0.8}
              >
                {overrideMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.success} />
                ) : (
                  <Text style={styles.notDriftText}>Not Drift</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmedDriftButton}
                onPress={() => handleOverride('CONFIRMED_DRIFT')}
                disabled={overrideMutation.isPending}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmedDriftText}>Confirmed Drift</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {message.freelancerOverride && (
          <View style={styles.overriddenBanner}>
            <Text style={styles.overriddenText}>
              {message.freelancerOverride === 'NOT_DRIFT'
                ? '✓ You marked this as not drift'
                : '⚑ You confirmed this as drift'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  categoryHeader: {
    borderLeftWidth: 4,
    paddingLeft: 14,
    marginBottom: 24,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  categoryLabel: { fontSize: 13, fontWeight: '700' },
  categoryDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  scoreSection: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  scoreBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  scoreFill: { height: '100%', borderRadius: 4 },
  scoreValue: { fontSize: 13, color: Colors.textSecondary },
  section: { marginBottom: 24 },
  messageBubble: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  scopeItemBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  kindDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  scopeItemText: { fontSize: 14, color: Colors.textPrimary, flex: 1, lineHeight: 20 },
  quoteCard: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  quoteStatus: { fontSize: 12, color: Colors.primary, fontWeight: '700', marginBottom: 4 },
  quoteTotal: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  openQuote: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 12 },
  notDriftButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.success,
  },
  notDriftText: { color: Colors.success, fontSize: 15, fontWeight: '600' },
  confirmedDriftButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
  },
  confirmedDriftText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  overriddenBanner: {
    backgroundColor: Colors.success + '15',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  overriddenText: { color: Colors.success, fontSize: 14, fontWeight: '600' },
})
