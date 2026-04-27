import React from 'react'
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
import { useProject } from '../../hooks/useProjects'
import { useMessages } from '../../hooks/useMessages'
import { useProjectQuotes } from '../../hooks/useQuotes'
import { Colors, TierColors, StatusColors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'ProjectDetail'>

function SectionHeader({ title, onPress, actionLabel }: { title: string; onPress?: () => void; actionLabel?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onPress && actionLabel && (
        <TouchableOpacity onPress={onPress}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function ProjectDetailScreen({ route, navigation }: Props) {
  const { projectId } = route.params
  const { data: project, isLoading } = useProject(projectId)
  const { data: messages } = useMessages(projectId)
  const { data: quotesData } = useProjectQuotes(projectId)

  if (isLoading || !project) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const tierColors = TierColors[project.pricingTier as keyof typeof TierColors]
  const statusColor = StatusColors[project.status as keyof typeof StatusColors] ?? StatusColors.ACTIVE
  const driftMessages = messages?.filter((m: any) => m.isDrift && !m.overrideReason) ?? []
  const quotes = quotesData?.quotes ?? []
  const latestQuote = quotes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.projectHeader}>
          <View style={styles.projectTitleRow}>
            <Text style={styles.projectTitle}>{project.title}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('ProjectSettings', { projectId })}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.clientName}>{project.clientName}</Text>
          <View style={styles.badges}>
            <View style={[styles.tierBadge, { backgroundColor: tierColors.background }]}>
              <Text style={[styles.tierText, { color: tierColors.text }]}>{project.pricingTier}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {project.status.replace('_', ' ')}
              </Text>
            </View>
          </View>
        </View>

        {/* Financials */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Financials</Text>
          <View style={styles.financialRow}>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Contract</Text>
              <Text style={styles.financialValue}>
                ${project.totalPrice.toLocaleString()}
              </Text>
            </View>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Change Orders</Text>
              <Text style={[styles.financialValue, { color: Colors.success }]}>
                +${project.acceptedChangeOrderTotal.toLocaleString()}
              </Text>
            </View>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Total</Text>
              <Text style={[styles.financialValue, { color: Colors.primary }]}>
                ${(project.totalPrice + project.acceptedChangeOrderTotal).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Slack */}
        <View style={styles.card}>
          <SectionHeader title="Slack" />
          {project.slackChannelName ? (
            <View style={styles.slackConnected}>
              <Text style={styles.slackIcon}>💬</Text>
              <View>
                <Text style={styles.slackChannelName}>#{project.slackChannelName}</Text>
                <Text style={styles.slackStatus}>Connected</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => navigation.navigate('SlackConnect', { projectId })}
            >
              <Text style={styles.connectButtonText}>Connect Slack Channel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Drift Messages */}
        <View style={styles.card}>
          <SectionHeader
            title={`Drift Flags (${driftMessages.length})`}
            onPress={() => navigation.navigate('MessageFeed', { projectId })}
            actionLabel="View All"
          />
          {driftMessages.length === 0 ? (
            <Text style={styles.emptyText}>No drift detected</Text>
          ) : (
            driftMessages.slice(0, 3).map((msg: any) => (
              <TouchableOpacity
                key={msg.id}
                style={styles.driftItem}
                onPress={() => navigation.navigate('MessageDetail', { messageId: msg.id, projectId })}
              >
                <View style={styles.driftItemLeft}>
                  <View style={[styles.intentBadge, {
                    backgroundColor: msg.intentCategory === 'EXPANSION' ? '#FEE2E2' :
                      msg.intentCategory === 'MODIFICATION' ? '#FEF3C7' : '#F3F4F6'
                  }]}>
                    <Text style={[styles.intentText, {
                      color: msg.intentCategory === 'EXPANSION' ? Colors.danger :
                        msg.intentCategory === 'MODIFICATION' ? Colors.warning : Colors.textSecondary
                    }]}>
                      {msg.intentCategory ?? 'UNKNOWN'}
                    </Text>
                  </View>
                  <Text style={styles.driftText} numberOfLines={2}>{msg.text}</Text>
                </View>
                <Text style={styles.driftScore}>{Math.round(msg.driftScore * 100)}%</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quotes */}
        <View style={styles.card}>
          <SectionHeader
            title="Quotes"
            onPress={() => navigation.navigate('QuoteList', { projectId })}
            actionLabel="View All"
          />
          {latestQuote ? (
            <TouchableOpacity
              style={styles.quoteItem}
              onPress={() =>
                latestQuote.status === 'DRAFT' || latestQuote.status === 'AWAITING_CLIENT'
                  ? navigation.navigate('QuoteChat', { quoteId: latestQuote.id, projectId })
                  : navigation.navigate('QuoteDetail', { quoteId: latestQuote.id })
              }
            >
              <View>
                <Text style={styles.quoteStatus}>{latestQuote.status}</Text>
                <Text style={styles.quoteTotal}>
                  ${latestQuote.currentVersion?.total?.toLocaleString() ?? 0}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.emptyText}>No quotes yet</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ScopeUpload', { projectId })}
          >
            <Text style={styles.actionButtonText}>📄 Update Scope</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  projectHeader: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  projectTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  settingsIcon: { fontSize: 20 },
  clientName: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  badges: { flexDirection: 'row', gap: 8 },
  tierBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  tierText: { fontSize: 12, fontWeight: '600' },
  statusPill: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  sectionAction: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  financialRow: { flexDirection: 'row', justifyContent: 'space-between' },
  financialItem: { alignItems: 'center' },
  financialLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  financialValue: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },

  slackConnected: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slackIcon: { fontSize: 28 },
  slackChannelName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  slackStatus: { fontSize: 12, color: Colors.success, fontWeight: '500' },
  connectButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  connectButtonText: { color: Colors.white, fontWeight: '600', fontSize: 15 },

  driftItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  driftItemLeft: { flex: 1, marginRight: 8, gap: 6 },
  intentBadge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  intentText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  driftText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  driftScore: { fontSize: 14, fontWeight: '700', color: Colors.danger },

  quoteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  quoteStatus: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', textTransform: 'uppercase' },
  quoteTotal: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  chevron: { fontSize: 24, color: Colors.textSecondary },

  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 8 },
  actions: { gap: 12, marginTop: 8 },
  actionButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  actionButtonText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
})
