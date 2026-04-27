import { PricingTier } from "./enums";

export const TIER_CONFIG: Record<
  PricingTier,
  { multiplier: number; rounding: number; defaultHourlyRateCents: number }
> = {
  [PricingTier.PREMIUM]: {
    multiplier: 1.3,
    rounding: 500,
    defaultHourlyRateCents: 15000,
  },
  [PricingTier.MID]: {
    multiplier: 1.0,
    rounding: 500,
    defaultHourlyRateCents: 10000,
  },
  [PricingTier.AFFORDABLE]: {
    multiplier: 0.8,
    rounding: 500,
    defaultHourlyRateCents: 6500,
  },
};

export const DRIFT_THRESHOLDS = {
  MIN_SIMILARITY: 0.72,
  OUT_OF_SCOPE_FORCE: 0.82,
  INTENT_CONFIDENCE_THRESHOLD: 0.7,
  MIN_MESSAGE_LENGTH: 15,
} as const;

export const QUOTE_TOKEN_EXPIRY_DAYS = 14;
export const QUOTE_PENDING_REMINDER_HOURS = 48;
export const CLIENT_NO_RESPONSE_REMINDER_HOURS = 72;
export const RATE_LIMIT_PER_MINUTE = 60;
