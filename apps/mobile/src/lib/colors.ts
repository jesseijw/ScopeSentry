export const Colors = {
  primary: '#4F46E5',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  inputBackground: '#F3F4F6',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const

export const TierColors = {
  PREMIUM: {
    background: '#FEF3C7',
    text: '#92400E',
  },
  MID: {
    background: '#DBEAFE',
    text: '#1E40AF',
  },
  AFFORDABLE: {
    background: '#D1FAE5',
    text: '#065F46',
  },
} as const

export const StatusColors = {
  ACTIVE: '#16A34A',
  PAUSED: '#D97706',
  COMPLETED: '#6B7280',
} as const

export const IntentColors = {
  EXPANSION: '#DC2626',
  MODIFICATION: '#D97706',
  CLARIFICATION: '#6B7280',
} as const
