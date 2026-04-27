import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { useUpdateScope } from '../../hooks/useScope'
import { Colors } from '../../lib/colors'
import { Scope, ScopeItem } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'ScopeConfirm'>

function ScopeItemRow({
  item,
  onEdit,
}: {
  item: ScopeItem
  onEdit: (newDesc: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.description)

  const kindColors: Record<string, string> = {
    DELIVERABLE: Colors.primary,
    OUT_OF_SCOPE: Colors.danger,
    ASSUMPTION: Colors.warning,
  }

  return (
    <View style={styles.itemRow}>
      <View style={[styles.kindDot, { backgroundColor: kindColors[item.kind] || Colors.textSecondary }]} />
      {editing ? (
        <TextInput
          style={styles.itemInput}
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          onBlur={() => {
            setEditing(false)
            if (text !== item.description) onEdit(text)
          }}
        />
      ) : (
        <TouchableOpacity
          style={styles.itemTextWrapper}
          onPress={() => setEditing(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.itemText}>{item.description}</Text>
          <Text style={styles.editHint}>Tap to edit</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function ScopeSection({
  title,
  items,
  onItemEdit,
}: {
  title: string
  items: ScopeItem[]
  onItemEdit: (itemId: string, desc: string) => void
}) {
  if (items.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <ScopeItemRow
          key={item.id}
          item={item}
          onEdit={(desc) => onItemEdit(item.id!, desc)}
        />
      ))}
    </View>
  )
}

export default function ScopeConfirmScreen({ route, navigation }: Props) {
  const { projectId, scope } = route.params
  const [localScope, setLocalScope] = useState<Scope>(scope)
  const [summary, setSummary] = useState(scope.summary)
  const updateScope = useUpdateScope(projectId, scope.id!)

  const deliverables = localScope.scopeItems?.filter((si) => si.kind === 'DELIVERABLE') ?? []
  const outOfScope = localScope.scopeItems?.filter((si) => si.kind === 'OUT_OF_SCOPE') ?? []
  const assumptions = localScope.scopeItems?.filter((si) => si.kind === 'ASSUMPTION') ?? []

  function handleItemEdit(itemId: string, newDesc: string) {
    setLocalScope((prev) => ({
      ...prev,
      scopeItems: prev.scopeItems?.map((si) =>
        si.id === itemId ? { ...si, description: newDesc } : si
      ),
    }))
  }

  async function handleSave() {
    try {
      await updateScope.mutateAsync({
        summary,
        items: localScope.scopeItems?.map((si) => ({
          id: si.id,
          kind: si.kind,
          description: si.description,
        })),
      })
      navigation.navigate('SlackConnect', { projectId })
    } catch (err: any) {
      Alert.alert('Save failed', err.message || 'Could not save scope.')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Review Your Scope</Text>
        <Text style={styles.subheading}>
          ScopeSentry parsed your document. Edit any field, then save to continue.
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <TextInput
            style={styles.summaryInput}
            value={summary}
            onChangeText={setSummary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <ScopeSection
          title="Deliverables"
          items={deliverables}
          onItemEdit={handleItemEdit}
        />
        <ScopeSection
          title="Out of Scope"
          items={outOfScope}
          onItemEdit={handleItemEdit}
        />
        <ScopeSection
          title="Assumptions"
          items={assumptions}
          onItemEdit={handleItemEdit}
        />

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.kindDot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.legendText}>Deliverable</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.kindDot, { backgroundColor: Colors.danger }]} />
            <Text style={styles.legendText}>Out of Scope</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.kindDot, { backgroundColor: Colors.warning }]} />
            <Text style={styles.legendText}>Assumption</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, updateScope.isPending && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={updateScope.isPending}
          activeOpacity={0.8}
        >
          {updateScope.isPending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save & Connect Slack</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 120 },
  heading: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24, lineHeight: 20 },
  summaryBox: { marginBottom: 24 },
  summaryInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
    marginTop: 8,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kindDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 10 },
  itemTextWrapper: { flex: 1 },
  itemText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  editHint: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  itemInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    paddingBottom: 2,
  },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, color: Colors.textSecondary },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
})

