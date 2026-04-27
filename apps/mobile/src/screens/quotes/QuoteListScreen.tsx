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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:           { label: 'Draft',           color: Colors.textSecondary },
  AWAITING_CLIENT: { label: 'Awaiting Client', color: Colors.warning },
  ACCEPTED:        { label: 'Accepted',         color: Colors.success },
  REJECTED:        { label: 'Rejected',         color: Colors.danger },
  SUPERSEDED:      { label: 'Superseded',       color: Colors.textSecondary },
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
              <View style={styles.cardTop}>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
                <Text style={styles.createdAt}>
                  {new Date(quote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>

              {latestVersion && (
                <Text style={styles.total}>
                  {`$${(Number(latestVersion.totalCents) / 100).toFixed(2)}`}
                </Text>
              )}

              {latestVersion?.rationale && (
                <Text style={styles.rationale} numberOfLines={2}>
                  {latestVersion.rationale}
                </Text>
              )}

              <Text style={styles.action}>
                {isDraft ? 'Edit in Quote Chat →' : 'View details →'}
              </Text>
            </TouchableOpacity>
          )
        }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>No quotes yet</Text>
            <Text style={styles.emptySubtext}>
              Quotes are generated automatically when scope drift is detected.
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
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  createdAt: { fontSize: 12, color: Colors.textSecondary },
  total: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  rationale: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  action: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
})
