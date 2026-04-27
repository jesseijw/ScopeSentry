import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { useQuote } from '../../hooks/useQuotes'
import { Colors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'QuoteDetail'>

function formatCents(cents: number | bigint) {
  return `$${(Number(cents) / 100).toFixed(2)}`
}

export default function QuoteDetailScreen({ route }: Props) {
  const { quoteId } = route.params
  const { data, isLoading } = useQuote(quoteId)

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const quote = data?.quote
  const latestVersion = quote?.versions?.[quote.versions.length - 1]
  const lineItems = latestVersion?.lineItemsJson ?? []

  const STATUS_LABEL: Record<string, string> = {
    DRAFT: 'Draft',
    AWAITING_CLIENT: 'Awaiting Client',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    SUPERSEDED: 'Superseded',
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {quote && (
          <>
            <View style={styles.statusRow}>
              <Text style={styles.status}>{STATUS_LABEL[quote.status] ?? quote.status}</Text>
              <Text style={styles.date}>
                {new Date(quote.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>

            {latestVersion && (
              <>
                <Text style={styles.totalAmount}>{formatCents(latestVersion.totalCents)}</Text>

                <View style={styles.rationaleBox}>
                  <Text style={styles.sectionLabel}>Rationale</Text>
                  <Text style={styles.rationaleText}>{latestVersion.rationale}</Text>
                </View>

                <View style={styles.lineItemsSection}>
                  <Text style={styles.sectionLabel}>Line Items</Text>
                  {lineItems.map((li: any, i: number) => (
                    <View key={i} style={styles.lineItemRow}>
                      <View style={styles.lineItemLeft}>
                        <Text style={styles.lineItemDesc}>{li.description}</Text>
                        <Text style={styles.lineItemMeta}>
                          {li.hours}h × {formatCents(li.rateCents)}/hr
                        </Text>
                      </View>
                      <Text style={styles.lineItemTotal}>{formatCents(li.totalCents)}</Text>
                    </View>
                  ))}

                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Subtotal</Text>
                    <Text style={styles.totalsValue}>{formatCents(latestVersion.subtotalCents)}</Text>
                  </View>
                  <View style={styles.totalsRow}>
                    <Text style={[styles.totalsLabel, { fontWeight: '700' }]}>Total</Text>
                    <Text style={[styles.totalsValue, { fontWeight: '700', fontSize: 18 }]}>
                      {formatCents(latestVersion.totalCents)}
                    </Text>
                  </View>

                  <View style={styles.timelineRow}>
                    <Text style={styles.timelineLabel}>⏱ Timeline Impact</Text>
                    <Text style={styles.timelineValue}>
                      +{latestVersion.timelineImpactDays} day{latestVersion.timelineImpactDays !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.versionsSection}>
                  <Text style={styles.sectionLabel}>Version History</Text>
                  {[...(quote.versions ?? [])].reverse().map((v: any) => (
                    <View key={v.id} style={styles.versionRow}>
                      <Text style={styles.versionNum}>v{v.versionNumber}</Text>
                      <Text style={styles.versionTotal}>{formatCents(v.totalCents)}</Text>
                      <Text style={styles.versionDate}>
                        {new Date(v.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  status: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  date: { fontSize: 13, color: Colors.textSecondary },
  totalAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 24,
  },
  rationaleBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  rationaleText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },
  lineItemsSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  lineItemLeft: { flex: 1, marginRight: 8 },
  lineItemDesc: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  lineItemMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  lineItemTotal: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalsLabel: { fontSize: 14, color: Colors.textSecondary },
  totalsValue: { fontSize: 14, color: Colors.textPrimary },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
  timelineLabel: { fontSize: 13, color: Colors.textSecondary },
  timelineValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  versionsSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  versionNum: { fontSize: 13, fontWeight: '700', color: Colors.primary, width: 30 },
  versionTotal: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  versionDate: { fontSize: 12, color: Colors.textSecondary },
})
