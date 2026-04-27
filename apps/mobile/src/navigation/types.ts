import { NavigatorScreenParams } from '@react-navigation/native'
import { Scope } from '../types'

export type AuthStackParamList = {
  Welcome: undefined
}

export type BottomTabParamList = {
  ProjectsTab: undefined
  NotificationsTab: undefined
}

export type AppStackParamList = {
  BottomTabs: NavigatorScreenParams<BottomTabParamList>
  ProjectDetail: { projectId: string }
  CreateProject: undefined
  ScopeUpload: { projectId: string }
  ScopeConfirm: { projectId: string; scope: Scope }
  SlackConnect: { projectId: string }
  ChannelPicker: { projectId: string }
  MessageFeed: { projectId: string }
  MessageDetail: { messageId: string; projectId: string }
  QuoteList: { projectId: string }
  QuoteChat: { quoteId: string; projectId: string }
  QuoteDetail: { quoteId: string }
  ProjectSettings: { projectId: string }
}

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>
  App: NavigatorScreenParams<AppStackParamList>
}
