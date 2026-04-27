// These types mirror the Prisma/API shapes

export interface User {
  id: string
  email: string
  name: string
  slackUserId?: string | null
  slackTeamId?: string | null
  apnsDeviceToken?: string | null
  createdAt: string
}

export type PricingTier = 'PREMIUM' | 'MID' | 'AFFORDABLE'
export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED'
export type QuoteStatus = 'DRAFT' | 'AWAITING_CLIENT' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED'
export type IntentCategory = 'CLARIFICATION' | 'EXPANSION' | 'MODIFICATION' | 'UPDATE' | 'APPROVAL'
export type ScopeItemKind = 'DELIVERABLE' | 'OUT_OF_SCOPE' | 'ASSUMPTION'
export type FreelancerOverride = 'NOT_DRIFT' | 'CONFIRMED_DRIFT'
export type NotificationKind = 'DRIFT_DETECTED' | 'CLIENT_ACCEPTED' | 'CLIENT_REQUESTED_CHANGES' | 'REMINDER'

// Project card data (augmented by API)
export interface Project {
  id: string
  userId: string
  title: string
  clientName: string
  clientEmail: string
  totalPriceCents: number
  totalPrice: number           // derived: totalPriceCents / 100
  currency: string
  pricingTier: PricingTier
  status: ProjectStatus
  startDate: string
  endDate?: string
  slackChannelId?: string
  // Dashboard computed fields
  pendingDriftCount: number
  acceptedChangeOrderTotal: number
  lastSlackMessageAt?: string
  createdAt: string
}

export interface ScopeItem {
  id?: string
  scopeId?: string
  kind: ScopeItemKind
  description: string
}

export interface Scope {
  id?: string
  projectId?: string
  version?: number
  summary: string
  estimatedHours: number
  rawDocumentS3Key?: string
  scopeItems?: ScopeItem[]
  createdAt?: string
}

export interface MessageAnalysis {
  id: string
  projectId: string
  slackMessageTs: string
  slackChannelId: string
  senderSlackUserId: string
  rawText: string
  intentCategory: IntentCategory | null
  driftScore: number | null
  nearestScopeItemId: string | null
  triggeredQuoteId: string | null
  freelancerOverride: FreelancerOverride | null
  nearestScopeItem?: ScopeItem | null
  createdAt: string
}

export interface LineItem {
  description: string
  hours: number
  rateCents: number
  totalCents: number
}

export interface QuoteVersion {
  id: string
  quoteId: string
  versionNumber: number
  lineItemsJson: LineItem[]
  subtotalCents: number
  totalCents: number
  timelineImpactDays: number
  rationale: string
  chatTurnId?: string | null
  createdAt: string
}

export interface ChatTurn {
  id: string
  quoteId: string
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  content: { text?: string; [key: string]: any }
  createdAt: string
}

export interface Quote {
  id: string
  projectId: string
  sourceMessageAnalysisId: string
  status: QuoteStatus
  currentVersionId?: string | null
  clientAcknowledgementToken?: string | null
  slackMessageTs?: string | null
  createdAt: string
  project?: Project
  sourceAnalysis?: MessageAnalysis
  versions: QuoteVersion[]
  chatTurns: ChatTurn[]
}

export interface Notification {
  id: string
  userId: string
  kind: NotificationKind
  payloadJson: Record<string, any>
  deliveredAt: string | null
  readAt: string | null
}

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_im: boolean
  num_members?: number
}
