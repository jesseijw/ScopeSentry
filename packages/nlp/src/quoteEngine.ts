import { TIER_CONFIG, PricingTier } from "@scopesentry/shared";
import { EffortLineItem } from "./intentClassifier";

export interface BuiltLineItem {
  description: string;
  hours: number;
  rateCents: number;
  totalCents: number;
}

export interface ProjectContext {
  id: string;
  totalPriceCents: bigint | number;
  pricingTier: PricingTier;
  title: string;
  clientName: string;
  currency: string;
}

export interface ScopeContext {
  estimatedHours: number;
}

export interface BuiltQuoteVersion {
  lineItemsJson: BuiltLineItem[];
  subtotalCents: number;
  totalCents: number;
  timelineImpactDays: number;
  rationale: string;
  versionNumber: number;
}

/**
 * Round a value to the nearest `rounding` cents (e.g. $5 = 500 cents)
 */
function roundToNearest(cents: number, rounding: number): number {
  return Math.round(cents / rounding) * rounding;
}

/**
 * Compute the implied hourly rate given the project total price and estimated hours,
 * then apply the tier multiplier from TIER_CONFIG.
 * Returns the rate in cents per hour.
 */
export function computeImpliedRate(
  totalPriceCents: number,
  estimatedHours: number,
  tier: PricingTier
): number {
  if (estimatedHours <= 0) {
    throw new Error("estimatedHours must be positive");
  }

  const baseRateCents = totalPriceCents / estimatedHours;
  const config = TIER_CONFIG[tier];
  return baseRateCents * config.multiplier;
}

/**
 * Apply tier multiplier to a base rate and round to nearest $5
 */
export function applyTierMultiplier(
  baseRateCents: number,
  tier: PricingTier
): number {
  const config = TIER_CONFIG[tier];
  const multiplied = baseRateCents * config.multiplier;
  // Round to nearest $5 (500 cents)
  return roundToNearest(multiplied, 500);
}

/**
 * Build a complete QuoteVersion from effort line items.
 * Pure function — fully unit testable with no external dependencies.
 */
export function buildQuoteFromEffortEstimate(
  effortItems: EffortLineItem[],
  project: ProjectContext,
  scope: ScopeContext,
  rationale: string,
  versionNumber: number = 1
): BuiltQuoteVersion {
  const tier = project.pricingTier;
  const config = TIER_CONFIG[tier];

  const totalPriceCents =
    typeof project.totalPriceCents === "bigint"
      ? Number(project.totalPriceCents)
      : project.totalPriceCents;

  // Compute implied hourly rate from project pricing
  let hourlyRateCents: number;
  if (scope.estimatedHours > 0) {
    hourlyRateCents = computeImpliedRate(
      totalPriceCents,
      scope.estimatedHours,
      tier
    );
  } else {
    // Fall back to tier default rate
    hourlyRateCents = config.defaultHourlyRateCents * config.multiplier;
  }

  // Round hourly rate to nearest $5
  hourlyRateCents = roundToNearest(hourlyRateCents, 500);

  // Build line items
  const lineItems: BuiltLineItem[] = effortItems.map((item) => {
    const rawTotal = item.hours * hourlyRateCents;
    const totalCents = roundToNearest(rawTotal, config.rounding);
    return {
      description: item.description,
      hours: item.hours,
      rateCents: hourlyRateCents,
      totalCents,
    };
  });

  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + item.totalCents,
    0
  );
  // Total = subtotal (no tax in base model — can be extended)
  const totalCents = subtotalCents;

  // Estimate timeline impact: 8 hours per working day, round up
  const totalHours = effortItems.reduce((sum, item) => sum + item.hours, 0);
  const timelineImpactDays = Math.ceil(totalHours / 8);

  return {
    lineItemsJson: lineItems,
    subtotalCents,
    totalCents,
    timelineImpactDays,
    rationale,
    versionNumber,
  };
}

/**
 * Scale all line items by a factor (for pricing adjustments in quote chat)
 * Rounds each item to nearest $5
 */
export function scaleLineItems(
  lineItems: BuiltLineItem[],
  factor: number,
  tier: PricingTier
): BuiltLineItem[] {
  const config = TIER_CONFIG[tier];
  return lineItems.map((item) => {
    const newTotal = roundToNearest(item.totalCents * factor, config.rounding);
    const newRate = roundToNearest(item.rateCents * factor, 500);
    return {
      ...item,
      rateCents: newRate,
      totalCents: newTotal,
    };
  });
}

/**
 * Add a new line item at the tier's default hourly rate
 */
export function addLineItem(
  lineItems: BuiltLineItem[],
  description: string,
  hours: number,
  tier: PricingTier
): BuiltLineItem[] {
  const config = TIER_CONFIG[tier];
  const rateCents = roundToNearest(
    config.defaultHourlyRateCents * config.multiplier,
    500
  );
  const totalCents = roundToNearest(hours * rateCents, config.rounding);
  return [
    ...lineItems,
    { description, hours, rateCents, totalCents },
  ];
}

/**
 * Remove a line item by index
 */
export function removeLineItem(
  lineItems: BuiltLineItem[],
  index: number
): BuiltLineItem[] {
  if (index < 0 || index >= lineItems.length) {
    throw new Error(`Invalid line item index: ${index}`);
  }
  return lineItems.filter((_, i) => i !== index);
}

/**
 * Merge multiple line items into one combined item
 */
export function mergeLineItems(
  lineItems: BuiltLineItem[],
  indices: number[],
  mergedDescription: string
): BuiltLineItem[] {
  const toMerge = indices.map((i) => {
    if (i < 0 || i >= lineItems.length) {
      throw new Error(`Invalid line item index: ${i}`);
    }
    return lineItems[i];
  });

  const mergedHours = toMerge.reduce((sum, item) => sum + item.hours, 0);
  const mergedTotal = toMerge.reduce((sum, item) => sum + item.totalCents, 0);
  const avgRate =
    toMerge.reduce((sum, item) => sum + item.rateCents, 0) / toMerge.length;

  const merged: BuiltLineItem = {
    description: mergedDescription,
    hours: mergedHours,
    rateCents: Math.round(avgRate),
    totalCents: mergedTotal,
  };

  const indexSet = new Set(indices);
  const remaining = lineItems.filter((_, i) => !indexSet.has(i));
  return [...remaining, merged];
}
