import { z } from "zod";
import {
  PricingTier,
  ProjectStatus,
  IntentCategory,
  QuoteStatus,
  ScopeItemKind,
  NotificationKind,
  QuoteChatRole,
  FreelancerOverride,
} from "./enums";

// ─── Project ────────────────────────────────────────────────────────────────

export const CreateProjectInputSchema = z.object({
  title: z.string().min(1).max(255),
  clientName: z.string().min(1).max(255),
  clientEmail: z.string().email(),
  totalPriceCents: z.number().int().positive(),
  currency: z.string().default("USD"),
  pricingTier: z.nativeEnum(PricingTier),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slackChannelId: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const UpdateProjectInputSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  clientName: z.string().min(1).max(255).optional(),
  clientEmail: z.string().email().optional(),
  totalPriceCents: z.number().int().positive().optional(),
  currency: z.string().optional(),
  pricingTier: z.nativeEnum(PricingTier).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slackChannelId: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

// ─── Scope ───────────────────────────────────────────────────────────────────

export const ScopeItemSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.nativeEnum(ScopeItemKind),
  description: z.string().min(1),
});

export type ScopeItem = z.infer<typeof ScopeItemSchema>;

export const CreateScopeInputSchema = z.object({
  text: z.string().min(1).optional(),
  summary: z.string().optional(),
  estimatedHours: z.number().positive().optional(),
  items: z.array(ScopeItemSchema).optional(),
});

export type CreateScopeInput = z.infer<typeof CreateScopeInputSchema>;

// ─── Quote ───────────────────────────────────────────────────────────────────

export const LineItemSchema = z.object({
  description: z.string().min(1),
  hours: z.number().positive(),
  rateCents: z.number().int().positive(),
  totalCents: z.number().int().positive(),
});

export type LineItem = z.infer<typeof LineItemSchema>;

export const QuoteVersionSchema = z.object({
  id: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  versionNumber: z.number().int().positive(),
  lineItemsJson: z.array(LineItemSchema),
  subtotalCents: z.number().int().positive(),
  totalCents: z.number().int().positive(),
  timelineImpactDays: z.number().int().nonnegative(),
  rationale: z.string().min(1),
  createdAt: z.date().optional(),
});

export type QuoteVersion = z.infer<typeof QuoteVersionSchema>;

// ─── Drift ───────────────────────────────────────────────────────────────────

export const MessageAnalysisSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  slackMessageTs: z.string(),
  slackChannelId: z.string(),
  senderSlackUserId: z.string(),
  rawText: z.string(),
  intentCategory: z.nativeEnum(IntentCategory).nullable(),
  driftScore: z.number().min(0).max(1).nullable(),
  nearestScopeItemId: z.string().uuid().nullable(),
  triggeredQuoteId: z.string().uuid().nullable(),
  freelancerOverride: z.nativeEnum(FreelancerOverride).nullable(),
  createdAt: z.date(),
});

export type MessageAnalysis = z.infer<typeof MessageAnalysisSchema>;

export const OverrideMessageInputSchema = z.object({
  override: z.nativeEnum(FreelancerOverride),
});

export type OverrideMessageInput = z.infer<typeof OverrideMessageInputSchema>;

// ─── Chat ────────────────────────────────────────────────────────────────────

export const QuoteChatMessageSchema = z.object({
  content: z.string().min(1),
});

export type QuoteChatMessage = z.infer<typeof QuoteChatMessageSchema>;

// ─── Notifications ───────────────────────────────────────────────────────────

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  kind: z.nativeEnum(NotificationKind),
  payloadJson: z.record(z.unknown()),
  deliveredAt: z.date().nullable(),
  readAt: z.date().nullable(),
});

export type Notification = z.infer<typeof NotificationSchema>;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const AppleAuthInputSchema = z.object({
  identityToken: z.string(),
  user: z.string().optional(),
  email: z.string().email().optional(),
  fullName: z
    .object({
      givenName: z.string().optional(),
      familyName: z.string().optional(),
    })
    .optional(),
});

export type AppleAuthInput = z.infer<typeof AppleAuthInputSchema>;

export const GoogleAuthInputSchema = z.object({
  accessToken: z.string().min(1),
});

export type GoogleAuthInput = z.infer<typeof GoogleAuthInputSchema>;

export const EmailAuthInputSchema = z.object({
  email: z.string().email(),
});

export type EmailAuthInput = z.infer<typeof EmailAuthInputSchema>;

export const RegisterDeviceInputSchema = z.object({
  deviceToken: z.string().min(1),
});

export type RegisterDeviceInput = z.infer<typeof RegisterDeviceInputSchema>;

// ─── Client Quote ─────────────────────────────────────────────────────────────

export const ClientAcknowledgeInputSchema = z.object({
  comment: z.string().optional(),
});

export type ClientAcknowledgeInput = z.infer<
  typeof ClientAcknowledgeInputSchema
>;

export const ClientRequestChangesInputSchema = z.object({
  feedback: z.string().min(1),
});

export type ClientRequestChangesInput = z.infer<
  typeof ClientRequestChangesInputSchema
>;

// ─── Slack Link ───────────────────────────────────────────────────────────────

export const LinkSlackChannelInputSchema = z.object({
  channelId: z.string().min(1),
});

export type LinkSlackChannelInput = z.infer<typeof LinkSlackChannelInputSchema>;

// Re-export enums
export {
  PricingTier,
  ProjectStatus,
  IntentCategory,
  QuoteStatus,
  ScopeItemKind,
  NotificationKind,
  QuoteChatRole,
  FreelancerOverride,
};
