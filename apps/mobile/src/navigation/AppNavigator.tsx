import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, StyleSheet } from 'react-native'
import { AppStackParamList, BottomTabParamList } from './types'
import { Colors } from '../lib/colors'

import ProjectListScreen from '../screens/projects/ProjectListScreen'
import ProjectDetailScreen from '../screens/projects/ProjectDetailScreen'
import CreateProjectScreen from '../screens/projects/CreateProjectScreen'
import ProjectSettingsScreen from '../screens/projects/ProjectSettingsScreen'
import ScopeUploadScreen from '../screens/scope/ScopeUploadScreen'
import ScopeConfirmScreen from '../screens/scope/ScopeConfirmScreen'
import SlackConnectScreen from '../screens/slack/SlackConnectScreen'
import ChannelPickerScreen from '../screens/slack/ChannelPickerScreen'
import MessageFeedScreen from '../screens/drift/MessageFeedScreen'
import MessageDetailScreen from '../screens/drift/MessageDetailScreen'
import QuoteListScreen from '../screens/quotes/QuoteListScreen'
import QuoteChatScreen from '../screens/quotes/QuoteChatScreen'
import QuoteDetailScreen from '../screens/quotes/QuoteDetailScreen'
import NotificationsScreen from '../screens/notifications/NotificationsScreen'

const Tab = createBottomTabNavigator<BottomTabParamList>()
const Stack = createNativeStackNavigator<AppStackParamList>()

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    ProjectsTab: '📋',
    NotificationsTab: '🔔',
  }
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {icons[name] ?? '•'}
    </Text>
  )
}

function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="ProjectsTab"
        component={ProjectListScreen}
        options={{ tabBarLabel: 'Projects' }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{ tabBarLabel: 'Notifications' }}
      />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="BottomTabs"
        component={BottomTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ title: 'Project' }}
      />
      <Stack.Screen
        name="CreateProject"
        component={CreateProjectScreen}
        options={{ title: 'New Project', presentation: 'modal' }}
      />
      <Stack.Screen
        name="ProjectSettings"
        component={ProjectSettingsScreen}
        options={{ title: 'Project Settings' }}
      />
      <Stack.Screen
        name="ScopeUpload"
        component={ScopeUploadScreen}
        options={{ title: 'Upload Scope' }}
      />
      <Stack.Screen
        name="ScopeConfirm"
        component={ScopeConfirmScreen}
        options={{ title: 'Confirm Scope' }}
      />
      <Stack.Screen
        name="SlackConnect"
        component={SlackConnectScreen}
        options={{ title: 'Connect Slack' }}
      />
      <Stack.Screen
        name="ChannelPicker"
        component={ChannelPickerScreen}
        options={{ title: 'Select Channel' }}
      />
      <Stack.Screen
        name="MessageFeed"
        component={MessageFeedScreen}
        options={{ title: 'Drift Messages' }}
      />
      <Stack.Screen
        name="MessageDetail"
        component={MessageDetailScreen}
        options={{ title: 'Message' }}
      />
      <Stack.Screen
        name="QuoteList"
        component={QuoteListScreen}
        options={{ title: 'Quotes' }}
      />
      <Stack.Screen
        name="QuoteChat"
        component={QuoteChatScreen}
        options={{ title: 'Quote Editor', headerShown: false }}
      />
      <Stack.Screen
        name="QuoteDetail"
        component={QuoteDetailScreen}
        options={{ title: 'Quote' }}
      />
    </Stack.Navigator>
  )
}
