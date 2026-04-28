import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { useProject } from '../../hooks/useProjects'
import { useMessages } from '../../hooks/useMessages'
import { useProjectQuotes } from '../../hooks/useQuotes'
import { Colors, TierColors, StatusColors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'ProjectDetail'>

function SectionCard({
  title,
  onPress,
  actionLabel,
  children,
  accentColor,
}: {
  title: string
  onPress?: () => void
  actionLabel?: string
  children: React.ReactNode
  accentColor?: string
}) {
  return (
    <View style={[styles.card, accentColor ? { borderTopColor: accentColor, borderTopWidth: 3 } : {}]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {onPress && actionLabel && (
          <TouchableOpacity onPress={onPress}>
            <Text style={styles.sectionAction}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
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
  const latestQuote = quotes.sort(
    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Project header card */}
        <View style={styles.headerCard}>
          <View style={[styles.headerStrip, { backgroundColor: statusColor }]} />
          <View style={styles.headerContent}>
            <View style={styles.projectTitleRow}>
              <Text style={styles.projectTitle}>{project.title}</Text>
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={() => navigation.navigate('ProjectSettings', { projectId })}
              >
                <Text style={styles.settingsIcon}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.clientName}>{project.clientName}</Text>
            <View style={styles.badges}>
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
          </View>
        </View>

        {/* Financials */}
        <SectionCard title="Financials" accentColor={Colors.primary}>
          <View style={styles.financialRow}>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Contract</Text>
              <Text style={styles.financialValue}>${project.totalPrice.toLocaleString()}</Text>
            </View>
            <View style={styles.financialDivider} />
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Change Orders</Text>
              <Text style={[styles.financialValue, { color: Colors.success }]}>
                +${project.acceptedChangeOrderTotal.toLocaleString()}
              </Text>
            </View>
            <View style={styles.financialDivider} />
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Total</Text>
              <Text style={[styles.financialValue, { color: Colors.primary }]}>
                ${(project.totalPrice + project.acceptedChangeOrderTotal).toLocaleString()}
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* Slack */}
        <SectionCard title="Slack">
          {project.slackChannelName ? (
            <View style={styles.slackConnected}>
              <View style={styles.slackIconBox}>
                <View style={styles.slackBubble} />
                <View style={styles.slackBubbleTail} />
              </View>
              <View>
                <Text style={styles.slackChannelName}>#{project.slackChannelName}</Text>
                <Text style={styles.slackStatus}>Connected ✓</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => navigation.navigate('SlackConnect', { projectId })}
            >
              <Text style={styles.connectButtonText}>Connect Slack Channel →</Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* Drift Flags */}
        <SectionCard
          title={`Drift Flags${driftMessages.length > 0 ? ` (${driftMessages.length})` : ''}`}
          onPress={() => navigation.navigate('MessageFeed', { projectId })}
          actionLabel="View All"
          accentColor={driftMessages.length > 0 ? Colors.danger : undefined}
        >
          {driftMessages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateMark}>
                <View style={styles.cleanCheckLine} />
                <View style={styles.cleanCheckLineShort} />
              </View>
              <Text style={styles.emptyText}>No drift detected</Text>
            </View>
          ) : (
            driftMessages.slice(0, 3).map((msg: any) => (
              <TouchableOpacity
                key={msg.id}
                style={styles.driftItem}
                onPress={() => navigation.navigate('MessageDetail', { messageId: msg.id, projectId })}
              >
                <View style={styles.driftItemLeft}>
                  <View style={[
                    styles.intentBadge,
                    {
                      backgroundColor:
                        msg.intentCategory === 'EXPANSION' ? Colors.dangerLight :
                        msg.intentCategory === 'MODIFICATION' ? Colors.warningLight :
                        Colors.background,
                    },
                  ]}>
                    <Text style={[
                      styles.intentText,
                      {
                        color:
                          msg.intentCategory === 'EXPANSION' ? Colors.danger :
                          msg.intentCategory === 'MODIFICATION' ? Colors.warning :
                          Colors.textSecondary,
                      },
                    ]}>
                      {msg.intentCategory ?? 'UNKNOWN'}
                    </Text>
                  </View>
                  <Text style={styles.driftText} numberOfLines={2}>{msg.text}</Text>
                </View>
                <View style={styles.driftScoreBox}>
                  <Text style={styles.driftScore}>{Math.round(msg.driftScore * 100)}%</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </SectionCard>

        {/* Quotes */}
        <SectionCard
          title="Quotes"
          onPress={() => navigation.navigate('QuoteList', { projectId })}
          actionLabel="View All"
        >
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
                <Text style={styles.quoteStatus}>{latestQuote.status.replace('_', ' ')}</Text>
                <Text style={styles.quoteTotal}>
                  ${latestQuote.currentVersion?.total?.toLocaleString() ?? 0}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateMark}>
                <View style={styles.quoteEmptyPage} />
                <View style={styles.quoteEmptyLine} />
              </View>
              <Text style={styles.emptyText}>No quotes yet</Text>
            </View>
          )}
        </SectionCard>

        {/* Actions */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('ScopeUpload', { projectId })}
        >
          <Text style={styles.actionButtonText}>Update Scope</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
    flexDirection: 'row',
  },
  headerStrip: {
    width: 5,
  },
  headerContent: {
    flex: 1,
    padding: 16,
  },
  projectTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    flex: 1,
    letterSpacing: -0.3,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  clientName: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  badges: { flexDirection: 'row', gap: 8 },
  tierBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  tierText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  sectionAction: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
  },
  financialItem: { alignItems: 'center', flex: 1 },
  financialDivider: { width: 1, backgroundColor: Colors.border },
  financialLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  financialValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },

  slackConnected: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slackIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4A154B18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slackBubble: {
    width: 22,
    height: 16,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4A154B',
  },
  slackBubbleTail: {
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#4A154B',
    transform: [{ rotate: '-25deg' }],
    marginTop: -3,
    marginLeft: -10,
  },
  slackChannelName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  slackStatus: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  connectButton: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  connectButtonText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },

  driftItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  driftItemLeft: { flex: 1, marginRight: 10, gap: 6 },
  intentBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  intentText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  driftText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  driftScoreBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  driftScore: { fontSize: 13, fontWeight: '800', color: Colors.danger },

  quoteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  quoteStatus: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  quoteTotal: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  chevron: { fontSize: 26, color: Colors.textSecondary },

  emptyState: { alignItems: 'center', paddingVertical: 8, gap: 8 },
  emptyStateMark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanCheckLine: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.success,
    transform: [{ rotate: '-45deg' }],
    marginLeft: 6,
  },
  cleanCheckLineShort: {
    width: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.success,
    transform: [{ rotate: '45deg' }],
    marginTop: -2,
    marginLeft: -10,
  },
  quoteEmptyPage: {
    width: 18,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
  },
  quoteEmptyLine: {
    width: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.textSecondary,
    marginTop: -8,
  },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  actionButton: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    marginTop: 4,
  },
  actionButtonText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
})
