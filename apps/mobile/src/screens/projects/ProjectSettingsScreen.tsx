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
import { Colors, TierColors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'ProjectSettings'>

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

export default function ProjectSettingsScreen({ route, navigation }: Props) {
  const { projectId } = route.params
  const { data: project, isLoading } = useProject(projectId)

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

  const tierDescriptions: Record<string, string> = {
    PREMIUM: 'Change order quotes are priced at 1.3× your implied base rate. Best for high-value, complex projects.',
    MID: 'Change order quotes are priced at 1.15× your implied base rate. Good balance for most projects.',
    AFFORDABLE: 'Change order quotes are priced at 1.05× your implied base rate. For budget-conscious clients.',
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Project Info</Text>
          <InfoRow label="Title" value={project.title} />
          <InfoRow label="Client" value={project.clientName} />
          <InfoRow label="Client Email" value={project.clientEmail} />
          <InfoRow label="Currency" value={project.currency} />
          <InfoRow label="Start Date" value={project.startDate.slice(0, 10)} />
          <InfoRow label="End Date" value={project.endDate.slice(0, 10)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pricing Tier</Text>
          <View style={[styles.tierBadge, { backgroundColor: tierColors.background }]}>
            <Text style={[styles.tierText, { color: tierColors.text }]}>{project.pricingTier}</Text>
          </View>
          <Text style={styles.tierDescription}>{tierDescriptions[project.pricingTier]}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Slack Integration</Text>
          {project.slackChannelName ? (
            <>
              <InfoRow label="Channel" value={`#${project.slackChannelName}`} />
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => navigation.navigate('ChannelPicker', { projectId })}
              >
                <Text style={styles.changeButtonText}>Change Channel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => navigation.navigate('SlackConnect', { projectId })}
            >
              <Text style={styles.connectButtonText}>Connect Slack</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.dangerButton}
          onPress={() => {
            Alert.alert(
              'Archive Project',
              'Are you sure you want to archive this project? This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Archive',
                  style: 'destructive',
                  onPress: () => {
                    navigation.popToTop()
                  },
                },
              ]
            )
          }}
        >
          <Text style={styles.dangerButtonText}>Archive Project</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: 16 },
  tierBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  tierText: { fontSize: 14, fontWeight: '700' },
  tierDescription: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  connectButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  connectButtonText: { color: Colors.white, fontWeight: '600', fontSize: 15 },
  changeButton: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  changeButtonText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  dangerButton: {
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  dangerButtonText: { color: Colors.danger, fontWeight: '600', fontSize: 15 },
})
