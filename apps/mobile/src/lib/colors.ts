export const Colors = {
  primary: '#7C3AED',
  primaryLight: '#EDE9FE',
  primaryDark: '#5B21B6',
  accent: '#EC4899',
  accentLight: '#FCE7F3',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  background: '#F5F3FF',
  surface: '#FFFFFF',
  textPrimary: '#1E1B4B',
  textSecondary: '#6B7280',
  border: '#E8E4FF',
  inputBackground: '#F8F7FF',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const

export const TierColors = {
  PREMIUM: {
    background: '#FFF7ED',
    text: '#92400E',
  },
  MID: {
    background: '#EFF6FF',
    text: '#1E40AF',
  },
  AFFORDABLE: {
    background: '#ECFDF5',
    text: '#065F46',
  },
} as const

export const StatusColors = {
  ACTIVE: '#10B981',
  PAUSED: '#F59E0B',
  COMPLETED: '#6B7280',
} as const

export const IntentColors = {
  EXPANSION: '#EF4444',
  MODIFICATION: '#F59E0B',
  CLARIFICATION: '#6B7280',
} as const
