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

function ProjectCard({
  project,
  onPress,
}: {
  project: Project
  onPress: () => void
}) {
  const tierColors = TierColors[project.pricingTier as keyof typeof TierColors]
  const statusColor = StatusColors[project.status as keyof typeof StatusColors] ?? StatusColors.ACTIVE
  const totalWithChanges = project.totalPrice + project.acceptedChangeOrderTotal

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
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
      </View>

      <View style={styles.cardMid}>
        <View style={[styles.tierBadge, { backgroundColor: tierColors.background }]}>
          <Text style={[styles.tierText, { color: tierColors.text }]}>
            {project.pricingTier}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {project.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.priceLabel}>Contract Value</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(project.totalPrice, project.currency)}</Text>
            {project.acceptedChangeOrderTotal > 0 && (
              <Text style={styles.priceExtra}>
                {' '}+ {formatCurrency(project.acceptedChangeOrderTotal, project.currency)}
              </Text>
            )}
          </View>
        </View>
        {project.lastSlackMessageAt && (
          <Text style={styles.lastMessage}>
            Last msg {formatRelativeTime(project.lastSlackMessageAt)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default function ProjectListScreen({ navigation }: { navigation: any }) {
  const { data: projects, isLoading, refetch, isRefetching } = useProjects()

  const handleProjectPress = useCallback(
    (projectId: string) => {
      navigation.navigate('ProjectDetail', { projectId })
    },
    [navigation]
  )

  const handleCreateProject = useCallback(() => {
    navigation.navigate('CreateProject')
  }, [navigation])

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Projects</Text>
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
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first project to start tracking scope.
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={handleCreateProject} activeOpacity={0.8}>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  projectTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  clientName: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  driftBadge: {
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  driftBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  cardMid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tierBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusPill: {
    borderRadius: 6,
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
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  priceExtra: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  lastMessage: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    color: Colors.white,
    fontWeight: '300',
    lineHeight: 32,
  },
})
