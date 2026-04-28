import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { useProjectQuotes } from '../../hooks/useQuotes'
import { Colors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'QuoteList'>

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:           { label: 'Draft',           color: Colors.textSecondary, bg: Colors.background },
  AWAITING_CLIENT: { label: 'Awaiting Client', color: Colors.warning,       bg: Colors.warningLight },
  ACCEPTED:        { label: 'Accepted',        color: Colors.success,       bg: Colors.successLight },
  REJECTED:        { label: 'Rejected',        color: Colors.danger,        bg: Colors.dangerLight },
  SUPERSEDED:      { label: 'Superseded',      color: Colors.textSecondary, bg: Colors.background },
}

export default function QuoteListScreen({ route, navigation }: Props) {
  const { projectId } = route.params
  const { data, isLoading, refetch, isRefetching } = useProjectQuotes(projectId)
  const quotes = data?.quotes ?? []

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={quotes}
        keyExtractor={(q: any) => q.id}
        renderItem={({ item: quote }) => {
          const statusConfig = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.DRAFT
          const latestVersion = quote.versions?.[0]
          const isDraft = quote.status === 'DRAFT'

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                if (isDraft) {
                  navigation.navigate('QuoteChat', { quoteId: quote.id, projectId })
                } else {
                  navigation.navigate('QuoteDetail', { quoteId: quote.id })
                }
              }}
              activeOpacity={0.7}
            >
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
                <Text style={styles.createdAt}>
                  {new Date(quote.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>

              {/* Amount */}
              {latestVersion && (
                <Text style={styles.total}>
                  {`$${(Number(latestVersion.totalCents) / 100).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                </Text>
              )}

              {/* Rationale preview */}
              {latestVersion?.rationale && (
                <Text style={styles.rationale} numberOfLines={2}>
                  {latestVersion.rationale}
                </Text>
              )}

              {/* Divider + action */}
              <View style={styles.actionRow}>
                <View style={styles.divider} />
                <Text style={styles.action}>
                  {isDraft ? 'Edit in Quote Chat' : 'View details'}{' →'}
                </Text>
              </View>
            </TouchableOpacity>
          )
        }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyMark}>
              <View style={styles.emptyQuotePage} />
              <View style={styles.emptyQuoteLine} />
            </View>
            <Text style={styles.emptyTitle}>No quotes yet</Text>
            <Text style={styles.emptySubtext}>
              Quotes are generated automatically when scope drift is detected in Slack.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  list: { padding: 16, paddingBottom: 40, gap: 12 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  createdAt: { fontSize: 12, color: Colors.textSecondary },

  total: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  rationale: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  actionRow: {
    gap: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  action: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
    paddingTop: 2,
  },

  emptyCard: {
    margin: 24,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyQuotePage: {
    width: 24,
    height: 30,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  emptyQuoteLine: {
    width: 15,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: -10,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
})
