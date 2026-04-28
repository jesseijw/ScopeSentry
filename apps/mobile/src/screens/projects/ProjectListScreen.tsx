import React, { useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { useProjects } from '../../hooks/useProjects'
import { Project } from '../../types'
import { Colors, TierColors, StatusColors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'BottomTabs'>

function formatCurrency(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  const tierColors = TierColors[project.pricingTier as keyof typeof TierColors]
  const statusColor = StatusColors[project.status as keyof typeof StatusColors] ?? StatusColors.ACTIVE
  const totalWithChanges = project.totalPrice + project.acceptedChangeOrderTotal

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Status left strip */}
      <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />

      <View style={styles.cardInner}>
        {/* Title row */}
        <View style={styles.cardTitleRow}>
          <Text style={styles.projectTitle} numberOfLines={1}>
            {project.title}
          </Text>
          {project.pendingDriftCount > 0 && (
            <View style={styles.driftBadge}>
              <Text style={styles.driftBadgeText}>{project.pendingDriftCount}</Text>
            </View>
          )}
        </View>

        <Text style={styles.clientName}>{project.clientName}</Text>

        {/* Badges row */}
        <View style={styles.badgesRow}>
          <View style={[styles.tierBadge, { backgroundColor: tierColors.background }]}>
            <Text style={[styles.tierText, { color: tierColors.text }]}>{project.pricingTier}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {project.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>Contract</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatCurrency(project.totalPrice, project.currency)}</Text>
              {project.acceptedChangeOrderTotal > 0 && (
                <Text style={styles.priceExtra}>
                  {' '}+{formatCurrency(project.acceptedChangeOrderTotal, project.currency)}
                </Text>
              )}
            </View>
          </View>
          {project.lastSlackMessageAt && (
            <Text style={styles.lastMessage}>
              Slack · {formatRelativeTime(project.lastSlackMessageAt)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function ProjectListScreen({ navigation }: { navigation: any }) {
  const { data: projects, isLoading, refetch, isRefetching } = useProjects()

  const handleProjectPress = useCallback(
    (projectId: string) => navigation.navigate('ProjectDetail', { projectId }),
    [navigation]
  )
  const handleCreateProject = useCallback(
    () => navigation.navigate('CreateProject'),
    [navigation]
  )

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>Workspace overview</Text>
          <Text style={styles.headerTitle}>Projects</Text>
        </View>
        {(projects?.length ?? 0) > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{projects!.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={projects ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProjectCard project={item} onPress={() => handleProjectPress(item.id)} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyMark}>
              <View style={styles.emptyProjectCard} />
              <View style={styles.emptyProjectLine} />
            </View>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to create your first project and start tracking scope.
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={handleCreateProject} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
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
  countBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 110,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  statusStrip: {
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  cardInner: {
    flex: 1,
    padding: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  projectTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  clientName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  driftBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  driftBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tierBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
  },
  priceBox: {},
  priceLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  priceExtra: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
  },
  lastMessage: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
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
  emptyProjectCard: {
    width: 24,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 4,
  },
  emptyProjectLine: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 36,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  fabText: {
    fontSize: 30,
    color: Colors.white,
    fontWeight: '300',
    lineHeight: 34,
  },
})
