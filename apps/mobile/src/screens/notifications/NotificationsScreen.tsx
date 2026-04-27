import React, { useCallback } from 'react'
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
import { useNotifications, useMarkNotificationRead } from '../../hooks/useNotifications'
import { Colors } from '../../lib/colors'

const KIND_CONFIG: Record<string, { icon: string; title: string; color: string }> = {
  DRIFT_DETECTED:           { icon: '⚠️', title: 'Scope Drift Detected', color: Colors.warning },
  CLIENT_ACCEPTED:          { icon: '✅', title: 'Quote Accepted',        color: Colors.success },
  CLIENT_REQUESTED_CHANGES: { icon: '💬', title: 'Client Requested Changes', color: Colors.primary },
  REMINDER:                 { icon: '🔔', title: 'Reminder',              color: Colors.textSecondary },
}

function NotificationRow({
  notif,
  onPress,
}: {
  notif: any
  onPress: () => void
}) {
  const config = KIND_CONFIG[notif.kind] ?? KIND_CONFIG.REMINDER
  const isUnread = !notif.readAt

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: config.color + '20' }]}>
        <Text style={styles.icon}>{config.icon}</Text>
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {config.title}
          </Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>
        {notif.payloadJson?.projectTitle && (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {notif.payloadJson.projectTitle}
          </Text>
        )}
        {notif.payloadJson?.messageText && (
          <Text style={styles.rowPreview} numberOfLines={1}>
            "{notif.payloadJson.messageText}"
          </Text>
        )}
        <Text style={styles.rowTime}>
          {notif.deliveredAt
            ? new Date(notif.deliveredAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Just now'}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default function NotificationsScreen({ navigation }: { navigation: any }) {
  const { data, isLoading, refetch, isRefetching } = useNotifications()
  const markRead = useMarkNotificationRead()

  const notifications = data?.notifications ?? []

  const handlePress = useCallback(
    async (notif: any) => {
      // Mark as read
      if (!notif.readAt) {
        markRead.mutate({ notificationId: notif.id })
      }

      // Navigate to relevant screen
      const payload = notif.payloadJson ?? {}
      if (notif.kind === 'DRIFT_DETECTED' && payload.quoteId) {
        navigation.navigate('QuoteChat', {
          quoteId: payload.quoteId,
          projectId: payload.projectId,
        })
      } else if (
        (notif.kind === 'CLIENT_ACCEPTED' || notif.kind === 'CLIENT_REQUESTED_CHANGES') &&
        payload.quoteId
      ) {
        navigation.navigate('QuoteDetail', { quoteId: payload.quoteId })
      } else if (payload.projectId) {
        navigation.navigate('ProjectDetail', { projectId: payload.projectId })
      }
    },
    [navigation, markRead]
  )

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.some((n: any) => !n.readAt) && (
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n: any) => n.id}
        renderItem={({ item }) => (
          <NotificationRow notif={item} onPress={() => handlePress(item)} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySubtitle}>
              Notifications about scope drift and client responses will appear here.
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  markAllRead: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  list: { paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 14,
  },
  rowUnread: { backgroundColor: Colors.primary + '06' },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { fontSize: 20 },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  rowSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
  rowPreview: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: 4 },
  rowTime: { fontSize: 11, color: Colors.textSecondary },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
})
