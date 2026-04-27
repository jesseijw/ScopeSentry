import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { useSubmitScope } from '../../hooks/useScope'
import { Colors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'ScopeUpload'>

type Tab = 'file' | 'text'

export default function ScopeUploadScreen({ route, navigation }: Props) {
  const { projectId } = route.params
  const [activeTab, setActiveTab] = useState<Tab>('file')
  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null)
  const [pastedText, setPastedText] = useState('')
  const { mutateAsync: submitScope, isPending } = useSubmitScope(projectId)

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'text/markdown',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      })
      if (!result.canceled && result.assets.length > 0) {
        setPickedFile(result.assets[0])
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick document')
    }
  }

  async function handleSubmit() {
    if (activeTab === 'file') {
      if (!pickedFile) {
        Alert.alert('No file selected', 'Please pick a file to upload.')
        return
      }
      try {
        const formData = new FormData()
        formData.append('file', {
          uri: pickedFile.uri,
          name: pickedFile.name,
          type: pickedFile.mimeType ?? 'application/octet-stream',
        } as any)
        const scope = await submitScope({ file: formData })
        navigation.replace('ScopeConfirm', { projectId, scope })
      } catch {
        Alert.alert('Upload failed', 'Could not parse your scope file. Please try again.')
      }
    } else {
      if (!pastedText.trim()) {
        Alert.alert('Empty text', 'Please paste your scope document text.')
        return
      }
      try {
        const scope = await submitScope({ text: pastedText.trim() })
        navigation.replace('ScopeConfirm', { projectId, scope })
      } catch {
        Alert.alert('Parse failed', 'Could not parse the scope text. Please try again.')
      }
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Upload Your Scope</Text>
          <Text style={styles.subtitle}>
            We'll parse your scope document and extract deliverables, exclusions, and assumptions.
          </Text>

          {/* Tab Switcher */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'file' && styles.tabActive]}
              onPress={() => setActiveTab('file')}
            >
              <Text style={[styles.tabText, activeTab === 'file' && styles.tabTextActive]}>
                Upload File
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'text' && styles.tabActive]}
              onPress={() => setActiveTab('text')}
            >
              <Text style={[styles.tabText, activeTab === 'text' && styles.tabTextActive]}>
                Paste Text
              </Text>
            </TouchableOpacity>
          </View>

          {/* File Tab */}
          {activeTab === 'file' && (
            <View style={styles.tabContent}>
              <TouchableOpacity
                style={styles.dropZone}
                onPress={handlePickFile}
                activeOpacity={0.7}
              >
                <Text style={styles.dropZoneIcon}>📎</Text>
                <Text style={styles.dropZoneTitle}>
                  {pickedFile ? 'Tap to change file' : 'Tap to select file'}
                </Text>
                <Text style={styles.dropZoneSubtitle}>PDF, DOCX, MD, or TXT</Text>
              </TouchableOpacity>

              {pickedFile && (
                <View style={styles.filePreview}>
                  <Text style={styles.fileIcon}>📄</Text>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{pickedFile.name}</Text>
                    <Text style={styles.fileSize}>
                      {pickedFile.size ? formatBytes(pickedFile.size) : 'Unknown size'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setPickedFile(null)}>
                    <Text style={styles.removeFile}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Text Tab */}
          {activeTab === 'text' && (
            <View style={styles.tabContent}>
              <TextInput
                value={pastedText}
                onChangeText={setPastedText}
                multiline
                placeholder="Paste your scope of work here...&#10;&#10;Include deliverables, timelines, and what's out of scope."
                placeholderTextColor={Colors.textSecondary}
                style={styles.textArea}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{pastedText.length} characters</Text>
            </View>
          )}

          {isPending && (
            <View style={styles.parsingBanner}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.parsingText}>
                Parsing scope... this may take 10-15 seconds
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, isPending && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isPending}
            activeOpacity={0.8}
          >
            {isPending ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Parse Scope →</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: Colors.surface, shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.textPrimary },
  tabContent: { gap: 12 },
  dropZone: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  dropZoneIcon: { fontSize: 36 },
  dropZoneTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  dropZoneSubtitle: { fontSize: 13, color: Colors.textSecondary },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fileIcon: { fontSize: 24 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  fileSize: { fontSize: 12, color: Colors.textSecondary },
  removeFile: { fontSize: 18, color: Colors.textSecondary },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 240,
    lineHeight: 22,
  },
  charCount: { fontSize: 12, color: Colors.textSecondary, textAlign: 'right' },
  parsingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.primary + '15',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  parsingText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: Colors.white },
})
