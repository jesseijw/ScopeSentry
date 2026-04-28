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

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; strip: string }> = {
  EXPANSION:     { label: 'Expansion',     color: Colors.danger,         bg: Colors.dangerLight,   strip: Colors.danger },
  MODIFICATION:  { label: 'Modification',  color: Colors.warning,        bg: Colors.warningLight,  strip: Colors.warning },
  CLARIFICATION: { label: 'Clarification', color: Colors.success,        bg: Colors.successLight,  strip: Colors.success },
  UPDATE:        { label: 'Update',        color: Colors.textSecondary,  bg: Colors.background,    strip: Colors.border },
  APPROVAL:      { label: 'Approval',      color: Colors.primary,        bg: Colors.primaryLight,  strip: Colors.primary },
}

function scoreColor(score: number) {
  if (score >= 0.7) return Colors.danger
  if (score >= 0.4) return Colors.warning
  return Colors.success
}

function MessageCard({ message, onPress }: { message: MessageAnalysis; onPress: () => void }) {
  const category = message.intentCategory
  const config = category ? (CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.UPDATE) : null
  const isDrift = category === 'EXPANSION' || category === 'MODIFICATION'
  const score = Number(message.driftScore)

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Left colored strip */}
      <View style={[styles.strip, { backgroundColor: config?.strip ?? Colors.border }]} />

      <View style={styles.cardInner}>
        <View style={styles.cardTop}>
          {config && (
            <View style={[styles.categoryBadge, { backgroundColor: config.bg }]}>
              <Text style={[styles.categoryText, { color: config.color }]}>{config.label}</Text>
            </View>
          )}
          {message.driftScore !== null && (
            <View style={[styles.scoreChip, { backgroundColor: scoreColor(score) + '18' }]}>
              <Text style={[styles.scoreText, { color: scoreColor(score) }]}>
                {(score * 100).toFixed(0)}% drift
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.messageText} numberOfLines={3}>
          {message.rawText}
        </Text>

        <View style={styles.cardFooter}>
          {message.freelancerOverride ? (
            <View style={[
              styles.overrideBadge,
              { backgroundColor: message.freelancerOverride === 'NOT_DRIFT' ? Colors.successLight : Colors.dangerLight },
            ]}>
              <Text style={[
                styles.overrideText,
                { color: message.freelancerOverride === 'NOT_DRIFT' ? Colors.success : Colors.danger },
              ]}>
                {message.freelancerOverride === 'NOT_DRIFT' ? '✓ Not drift' : '⚑ Confirmed drift'}
              </Text>
            </View>
          ) : <View />}
          <Text style={styles.timestamp}>
            {new Date(message.createdAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>
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
            onPress={() => navigation.navigate('MessageDetail', { messageId: item.id, projectId })}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyMessageMark}>
              <View style={styles.emptyMessageBox} />
              <View style={styles.emptyMessageTail} />
            </View>
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
  list: { padding: 16, paddingBottom: 40, gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  strip: {
    width: 4,
  },
  cardInner: {
    flex: 1,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  categoryBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreChip: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreText: { fontSize: 11, fontWeight: '700' },
  messageText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overrideBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  overrideText: { fontSize: 11, fontWeight: '700' },
  timestamp: { fontSize: 11, color: Colors.textSecondary },

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
  emptyMessageMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyMessageBox: {
    width: 26,
    height: 18,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  emptyMessageTail: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: Colors.primary,
    transform: [{ rotate: '-25deg' }],
    marginTop: -4,
    marginLeft: -12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
})
