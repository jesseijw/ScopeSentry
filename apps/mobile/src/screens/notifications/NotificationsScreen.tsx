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

const KIND_CONFIG: Record<string, { title: string; color: string; bg: string }> = {
  DRIFT_DETECTED:           { title: 'Scope Drift Detected',     color: Colors.warning,       bg: Colors.warningLight },
  CLIENT_ACCEPTED:          { title: 'Quote Accepted',           color: Colors.success,       bg: Colors.successLight },
  CLIENT_REQUESTED_CHANGES: { title: 'Client Requested Changes', color: Colors.primary,       bg: Colors.primaryLight },
  REMINDER:                 { title: 'Reminder',                 color: Colors.textSecondary, bg: Colors.background },
}

function NotificationGlyph({ kind, color }: { kind: string; color: string }) {
  if (kind === 'CLIENT_ACCEPTED') {
    return (
      <View style={styles.acceptedGlyph}>
        <View style={[styles.acceptedLong, { backgroundColor: color }]} />
        <View style={[styles.acceptedShort, { backgroundColor: color }]} />
      </View>
    )
  }
  if (kind === 'CLIENT_REQUESTED_CHANGES') {
    return (
      <View style={styles.commentGlyph}>
        <View style={[styles.commentBox, { borderColor: color }]} />
        <View style={[styles.commentTail, { borderColor: color }]} />
      </View>
    )
  }
  if (kind === 'DRIFT_DETECTED') {
    return (
      <View style={styles.warningGlyph}>
        <View style={[styles.warningBar, { backgroundColor: color }]} />
        <View style={[styles.warningDot, { backgroundColor: color }]} />
      </View>
    )
  }
  return (
    <View style={styles.reminderGlyph}>
      <View style={[styles.reminderDome, { borderColor: color }]} />
      <View style={[styles.reminderBase, { backgroundColor: color }]} />
    </View>
  )
}

function NotificationRow({ notif, onPress }: { notif: any; onPress: () => void }) {
  const config = KIND_CONFIG[notif.kind] ?? KIND_CONFIG.REMINDER
  const isUnread = !notif.readAt

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isUnread && <View style={styles.unreadStrip} />}
      <View style={[styles.iconBubble, { backgroundColor: config.bg }]}>
        <NotificationGlyph kind={notif.kind} color={config.color} />
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, isUnread && styles.rowTitleUnread]} numberOfLines={1}>
            {config.title}
          </Text>
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: config.color }]} />}
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
      if (!notif.readAt) markRead.mutate({ notificationId: notif.id })
      const payload = notif.payloadJson ?? {}
      if (notif.kind === 'DRIFT_DETECTED' && payload.quoteId) {
        navigation.navigate('QuoteChat', { quoteId: payload.quoteId, projectId: payload.projectId })
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
        <View>
          <Text style={styles.headerEyebrow}>Activity center</Text>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        {notifications.some((n: any) => !n.readAt) && (
          <TouchableOpacity style={styles.markAllBtn} onPress={() => refetch()}>
            <Text style={styles.markAllText}>Mark all read</Text>
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
          <View style={styles.emptyCard}>
            <View style={styles.emptyMark}>
              <View style={styles.emptyCheckLong} />
              <View style={styles.emptyCheckShort} />
            </View>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySubtitle}>
              Scope drift alerts and client responses will show up here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerEyebrow: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  markAllBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 4,
  },
  markAllText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },

  list: { paddingBottom: 40 },

  row: {
    flexDirection: 'row',
    padding: 16,
    paddingLeft: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 14,
    alignItems: 'flex-start',
  },
  rowUnread: {
    backgroundColor: Colors.primaryLight + '55',
  },
  unreadStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.primary,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  iconBubble: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  acceptedGlyph: { width: 24, height: 20, justifyContent: 'center' },
  acceptedLong: {
    width: 18,
    height: 3,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
    marginLeft: 8,
  },
  acceptedShort: {
    width: 10,
    height: 3,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    marginTop: -2,
  },
  commentGlyph: { alignItems: 'center' },
  commentBox: {
    width: 22,
    height: 16,
    borderRadius: 6,
    borderWidth: 2,
  },
  commentTail: {
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '-25deg' }],
    marginTop: -3,
    marginLeft: -8,
  },
  warningGlyph: { alignItems: 'center', gap: 3 },
  warningBar: { width: 5, height: 18, borderRadius: 3 },
  warningDot: { width: 5, height: 5, borderRadius: 3 },
  reminderGlyph: { alignItems: 'center' },
  reminderDome: {
    width: 18,
    height: 16,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 2,
    borderBottomWidth: 0,
  },
  reminderBase: { width: 20, height: 3, borderRadius: 2 },

  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  rowTitleUnread: { fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  rowSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2, fontWeight: '500' },
  rowPreview: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: 4 },
  rowTime: { fontSize: 11, color: Colors.textSecondary },

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
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCheckLong: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.success,
    transform: [{ rotate: '-45deg' }],
    marginLeft: 7,
  },
  emptyCheckShort: {
    width: 11,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.success,
    transform: [{ rotate: '45deg' }],
    marginTop: -3,
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
