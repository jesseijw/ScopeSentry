import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { useQuote, useSendChatMessage, useApproveQuote } from '../../hooks/useQuotes'
import { Colors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'QuoteChat'>

interface LineItem {
  description: string
  hours: number
  rateCents: number
  totalCents: number
}

interface ChatTurn {
  id: string
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  content: { text?: string }
  createdAt: string
}

interface QuoteVersionDisplay {
  versionNumber: number
  lineItemsJson: LineItem[]
  subtotalCents: bigint | number
  totalCents: bigint | number
  timelineImpactDays: number
  rationale: string
}

function formatCents(cents: number | bigint) {
  return `$${(Number(cents) / 100).toFixed(2)}`
}

function LineItemDiff({
  prev,
  curr,
}: {
  prev?: LineItem
  curr?: LineItem
}) {
  const changed = prev && curr && prev.totalCents !== curr.totalCents

  return (
    <View style={styles.lineItemRow}>
      <View style={styles.lineItemLeft}>
        <Text style={styles.lineItemDesc} numberOfLines={2}>
          {curr?.description ?? prev?.description}
        </Text>
        {curr && (
          <Text style={styles.lineItemMeta}>
            {curr.hours}h × {formatCents(curr.rateCents)}/hr
          </Text>
        )}
      </View>
      <View style={styles.lineItemRight}>
        {changed && prev ? (
          <>
            <Text style={styles.oldValue}>{formatCents(prev.totalCents)}</Text>
            <Text style={styles.newValue}>{formatCents(curr!.totalCents)}</Text>
          </>
        ) : (
          <Text style={styles.lineItemTotal}>{formatCents(curr?.totalCents ?? 0)}</Text>
        )}
      </View>
    </View>
  )
}

function QuotePreview({
  version,
  prevVersion,
}: {
  version: QuoteVersionDisplay
  prevVersion?: QuoteVersionDisplay
}) {
  const totalChanged = prevVersion && Number(version.totalCents) !== Number(prevVersion.totalCents)

  return (
    <View style={styles.previewPanel}>
      <Text style={styles.previewTitle}>
        Quote v{version.versionNumber}
      </Text>

      <ScrollView style={styles.lineItemsList} showsVerticalScrollIndicator={false}>
        {version.lineItemsJson.map((item, i) => (
          <LineItemDiff
            key={i}
            prev={prevVersion?.lineItemsJson[i]}
            curr={item}
          />
        ))}

        <View style={styles.previewTotalsRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <View style={styles.totalAmountRow}>
            {totalChanged && prevVersion ? (
              <>
                <Text style={styles.oldTotal}>{formatCents(prevVersion.totalCents)}</Text>
                <Text style={styles.arrowText}> → </Text>
              </>
            ) : null}
            <Text style={styles.totalAmount}>{formatCents(version.totalCents)}</Text>
          </View>
        </View>

        <Text style={styles.timelineText}>
          ⏱ +{version.timelineImpactDays} day{version.timelineImpactDays !== 1 ? 's' : ''} timeline impact
        </Text>
      </ScrollView>
    </View>
  )
}

export default function QuoteChatScreen({ route, navigation }: Props) {
  const { quoteId, projectId } = route.params
  const [inputText, setInputText] = useState('')
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [localTurns, setLocalTurns] = useState<ChatTurn[]>([])
  const [localCurrentVersion, setLocalCurrentVersion] = useState<QuoteVersionDisplay | null>(null)
  const [localPrevVersion, setLocalPrevVersion] = useState<QuoteVersionDisplay | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  const { data, isLoading, refetch } = useQuote(quoteId)
  const sendMessage = useSendChatMessage(quoteId)
  const approveQuote = useApproveQuote(quoteId)

  const quote = data?.quote

  // Initialize local state from fetched data
  useEffect(() => {
    if (quote) {
      setLocalTurns(quote.chatTurns ?? [])
      const versions = quote.versions ?? []
      if (versions.length > 0) {
        setLocalCurrentVersion(versions[versions.length - 1])
        if (versions.length > 1) {
          setLocalPrevVersion(versions[versions.length - 2])
        }
      }
    }
  }, [quote])

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [localTurns])

  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if (!text || sendMessage.isPending) return

    setInputText('')

    // Optimistic: add user message
    const optimisticUserTurn: ChatTurn = {
      id: 'optimistic-' + Date.now(),
      role: 'USER',
      content: { text },
      createdAt: new Date().toISOString(),
    }
    setLocalTurns((prev) => [...prev, optimisticUserTurn])

    try {
      const result = await sendMessage.mutateAsync({ content: text })

      // Add assistant response
      const assistantTurn: ChatTurn = {
        id: 'assistant-' + Date.now(),
        role: 'ASSISTANT',
        content: { text: result.assistantMessage },
        createdAt: new Date().toISOString(),
      }
      setLocalTurns((prev) => [...prev.filter((t) => t.id !== optimisticUserTurn.id), optimisticUserTurn, assistantTurn])

      // Update quote version
      if (result.changed && result.updatedVersion) {
        setLocalPrevVersion(localCurrentVersion)
        setLocalCurrentVersion(result.updatedVersion)
      }
    } catch (err: any) {
      setLocalTurns((prev) => prev.filter((t) => t.id !== optimisticUserTurn.id))
      Alert.alert('Error', err.message || 'Could not process your request.')
    }
  }, [inputText, sendMessage, localCurrentVersion])

  async function handleApprove() {
    setShowApproveModal(false)
    try {
      const result = await approveQuote.mutateAsync()
      Alert.alert(
        'Quote Sent ✅',
        `Posted to Slack and emailed to client. They'll review via the link.`,
        [{ text: 'OK', onPress: () => navigation.navigate('ProjectDetail', { projectId }) }]
      )
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not send quote.')
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const currentVersion = localCurrentVersion
  const prevVersion = localPrevVersion
  const canApprove = quote?.status === 'DRAFT' && currentVersion !== null

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quote Editor</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Quote Preview (top 40%) */}
      {currentVersion && (
        <QuotePreview version={currentVersion} prevVersion={prevVersion ?? undefined} />
      )}

      {/* Chat section */}
      <KeyboardAvoidingView
        style={styles.chatWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {localTurns.length === 0 && (
            <View style={styles.chatHint}>
              <Text style={styles.chatHintTitle}>Quote Chat</Text>
              <Text style={styles.chatHintText}>
                Try: "Drop the price by 20%", "Remove the last line item", "Make the rationale more friendly"
              </Text>
            </View>
          )}

          {localTurns
            .filter((t) => t.role === 'USER' || t.role === 'ASSISTANT')
            .map((turn) => (
              <View
                key={turn.id}
                style={[
                  styles.bubble,
                  turn.role === 'USER' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    turn.role === 'USER' ? styles.userBubbleText : styles.assistantBubbleText,
                  ]}
                >
                  {turn.content?.text ?? ''}
                </Text>
              </View>
            ))}

          {sendMessage.isPending && (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask to refine the quote..."
            placeholderTextColor={Colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sendMessage.isPending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sendMessage.isPending}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>

        {canApprove && (
          <TouchableOpacity
            style={[styles.approveButton, approveQuote.isPending && styles.buttonDisabled]}
            onPress={() => setShowApproveModal(true)}
            disabled={approveQuote.isPending}
            activeOpacity={0.8}
          >
            {approveQuote.isPending ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.approveButtonText}>Approve & Send →</Text>
            )}
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>

      {/* Confirmation modal */}
      <Modal visible={showApproveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Send Quote to Client?</Text>
            <Text style={styles.modalBody}>
              This will post the quote in your Slack channel and email your client with a review link.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowApproveModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleApprove}>
                <Text style={styles.modalConfirmText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 17, color: Colors.primary },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },

  // Quote Preview
  previewPanel: {
    flex: 0.4,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    padding: 16,
  },
  previewTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  lineItemsList: { flex: 1 },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  lineItemLeft: { flex: 1, marginRight: 8 },
  lineItemDesc: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  lineItemMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  lineItemRight: { alignItems: 'flex-end' },
  lineItemTotal: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  oldValue: { fontSize: 12, color: Colors.danger, textDecorationLine: 'line-through' },
  newValue: { fontSize: 14, fontWeight: '700', color: Colors.success },
  previewTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  totalAmountRow: { flexDirection: 'row', alignItems: 'center' },
  oldTotal: { fontSize: 13, color: Colors.danger, textDecorationLine: 'line-through' },
  arrowText: { fontSize: 13, color: Colors.textSecondary },
  totalAmount: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  timelineText: { fontSize: 12, color: Colors.textSecondary, marginTop: 6 },

  // Chat
  chatWrapper: { flex: 0.6 },
  chatScroll: { flex: 1 },
  chatContent: { padding: 12, gap: 8, paddingBottom: 8 },
  chatHint: {
    padding: 16,
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    marginBottom: 8,
  },
  chatHintTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  chatHintText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userBubbleText: { color: Colors.white },
  assistantBubbleText: { color: Colors.textPrimary },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: Colors.white, fontSize: 18, fontWeight: '700' },

  // Approve
  approveButton: {
    margin: 12,
    marginTop: 4,
    height: 50,
    backgroundColor: Colors.success,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  approveButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  modalBody: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: { fontSize: 15, color: Colors.textSecondary },
  modalConfirm: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
  },
  modalConfirmText: { fontSize: 15, color: Colors.white, fontWeight: '700' },
})
