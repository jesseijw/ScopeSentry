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
import { useMessages } from '../../hooks/useMessages'
import { Colors } from '../../lib/colors'
import { MessageAnalysis } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'MessageFeed'>

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  EXPANSION:     { label: 'Expansion',    color: Colors.danger,   bg: Colors.danger + '15' },
  MODIFICATION:  { label: 'Modification', color: Colors.warning,  bg: Colors.warning + '15' },
  CLARIFICATION: { label: 'Clarification',color: Colors.success,  bg: Colors.success + '15' },
  UPDATE:        { label: 'Update',       color: Colors.textSecondary, bg: Colors.textSecondary + '15' },
  APPROVAL:      { label: 'Approval',     color: Colors.primary,  bg: Colors.primary + '15' },
}

function MessageCard({
  message,
  onPress,
}: {
  message: MessageAnalysis
  onPress: () => void
}) {
  const category = message.intentCategory
  const config = category ? (CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.UPDATE) : null
  const isDrift = category === 'EXPANSION' || category === 'MODIFICATION'

  return (
    <TouchableOpacity style={[styles.card, isDrift && styles.driftCard]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        {config && (
          <View style={[styles.categoryBadge, { backgroundColor: config.bg }]}>
            <Text style={[styles.categoryText, { color: config.color }]}>{config.label}</Text>
          </View>
        )}
        {message.driftScore !== null && (
          <Text style={styles.scoreText}>Score: {(Number(message.driftScore) * 100).toFixed(0)}%</Text>
        )}
      </View>

      <Text style={styles.messageText} numberOfLines={3}>
        {message.rawText}
      </Text>

      <View style={styles.cardFooter}>
        {message.freelancerOverride && (
          <View style={styles.overrideBadge}>
            <Text style={styles.overrideText}>
              {message.freelancerOverride === 'NOT_DRIFT' ? '✓ Not drift' : '⚑ Confirmed drift'}
            </Text>
          </View>
        )}
        <Text style={styles.timestamp}>
          {new Date(message.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default function MessageFeedScreen({ route, navigation }: Props) {
  const { projectId } = route.params
  const { data, isLoading, refetch, isRefetching } = useMessages(projectId)

  const messages: MessageAnalysis[] = data?.messages ?? []

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
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MessageCard
            message={item}
            onPress={() =>
              navigation.navigate('MessageDetail', { messageId: item.id, projectId })
            }
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>
              Messages from your linked Slack channel will appear here once analyzed.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  driftCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryText: { fontSize: 12, fontWeight: '700' },
  scoreText: { fontSize: 12, color: Colors.textSecondary },
  messageText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, marginBottom: 10 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overrideBadge: {
    backgroundColor: Colors.success + '20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  overrideText: { fontSize: 11, color: Colors.success },
  timestamp: { fontSize: 11, color: Colors.textSecondary },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
})
