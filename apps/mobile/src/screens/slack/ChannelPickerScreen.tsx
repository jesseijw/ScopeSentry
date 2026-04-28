import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '../../navigation/types'
import { useSlackChannels, useLinkChannel } from '../../hooks/useSlack'
import { Colors } from '../../lib/colors'

type Props = NativeStackScreenProps<AppStackParamList, 'ChannelPicker'>

interface Channel {
  id: string
  name: string
  is_private: boolean
  is_im: boolean
  num_members?: number
}

export default function ChannelPickerScreen({ route, navigation }: Props) {
  const { projectId } = route.params
  const [query, setQuery] = useState('')
  const [linking, setLinking] = useState(false)

  const { data, isLoading } = useSlackChannels()
  const linkChannel = useLinkChannel(projectId)

  const channels: Channel[] = data?.channels ?? []
  const filtered = channels.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  )

  async function handleSelect(channel: Channel) {
    setLinking(true)
    try {
      await linkChannel.mutateAsync({ channelId: channel.id })
      Alert.alert(
        'Channel linked!',
        `#${channel.name} is now monitored for scope drift.`,
        [
          {
            text: 'Go to Project',
            onPress: () => navigation.navigate('ProjectDetail', { projectId }),
          },
        ]
      )
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not link channel.')
    } finally {
      setLinking(false)
    }
  }

  function channelLabel(c: Channel) {
    if (c.is_im) return 'DM'
    if (c.is_private) return 'Private'
    return '#'
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>Search</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search channels..."
          placeholderTextColor={Colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading channels...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.channelRow}
              onPress={() => handleSelect(item)}
              disabled={linking}
              activeOpacity={0.7}
            >
              <Text style={styles.channelIcon}>{channelLabel(item)}</Text>
              <View style={styles.channelInfo}>
                <Text style={styles.channelName}>{item.name}</Text>
                {item.num_members !== undefined && (
                  <Text style={styles.memberCount}>{item.num_members} members</Text>
                )}
              </View>
              {linking ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.selectChevron}>›</Text>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No channels found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  channelIcon: { fontSize: 18, marginRight: 12, width: 24, textAlign: 'center' },
  channelInfo: { flex: 1 },
  channelName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  memberCount: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  selectChevron: { fontSize: 20, color: Colors.textSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  loadingText: { marginTop: 12, color: Colors.textSecondary },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },
})
