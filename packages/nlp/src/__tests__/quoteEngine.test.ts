import {
  applyTierMultiplier,
  computeImpliedRate,
  buildQuoteFromEffortEstimate,
  ProjectContext,
  ScopeContext,
} from "../quoteEngine";
import { PricingTier, TIER_CONFIG } from "@scopesentry/shared";

describe("applyTierMultiplier", () => {
  it("should apply PREMIUM multiplier (1.3) and round to nearest $5", () => {
    const base = 10000; // $100/hr in cents
    const result = applyTierMultiplier(base, PricingTier.PREMIUM);
    // 10000 * 1.3 = 13000 → already on $5 boundary
    expect(result).toBe(13000);
  });

  it("should apply MID multiplier (1.0) — no change", () => {
    const base = 10000;
    const result = applyTierMultiplier(base, PricingTier.MID);
    expect(result).toBe(10000);
  });

  it("should apply AFFORDABLE multiplier (0.8) and round to nearest $5", () => {
    const base = 10000;
    const result = applyTierMultiplier(base, PricingTier.AFFORDABLE);
    // 10000 * 0.8 = 8000 → already on $5 boundary
    expect(result).toBe(8000);
  });

  it("should round to nearest $5 boundary", () => {
    // 7300 * 1.3 = 9490 → nearest $5 = 9500
    const result = applyTierMultiplier(7300, PricingTier.PREMIUM);
    expect(result % 500).toBe(0);
  });

  it("PREMIUM vs AFFORDABLE prices differ by approximately 1.3/0.8 ratio", () => {
    const base = 10000;
    const premiumRate = applyTierMultiplier(base, PricingTier.PREMIUM);
    const affordableRate = applyTierMultiplier(base, PricingTier.AFFORDABLE);

    const expectedRatio = 1.3 / 0.8; // = 1.625
    const actualRatio = premiumRate / affordableRate;

    // Allow for rounding to nearest $5 — within 5% tolerance
    expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.1);
  });

  it("PREMIUM rate is always higher than MID, which is higher than AFFORDABLE", () => {
    const base = 12345;
    const premium = applyTierMultiplier(base, PricingTier.PREMIUM);
    const mid = applyTierMultiplier(base, PricingTier.MID);
    const affordable = applyTierMultiplier(base, PricingTier.AFFORDABLE);

    expect(premium).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(affordable);
  });
});

describe("computeImpliedRate", () => {
  it("should compute the correct implied hourly rate for MID tier", () => {
    // $10,000 project for 100 hours → $100/hr, MID multiplier 1.0
    const rate = computeImpliedRate(1_000_000, 100, PricingTier.MID);
    expect(rate).toBe(10000); // $100/hr in cents
  });

  it("should apply tier multiplier to implied rate", () => {
    // $10,000 project for 100 hours → $100/hr base
    const midRate = computeImpliedRate(1_000_000, 100, PricingTier.MID);
    const premiumRate = computeImpliedRate(1_000_000, 100, PricingTier.PREMIUM);

    expect(premiumRate).toBeCloseTo(midRate * 1.3, 1);
  });

  it("should throw on zero estimated hours", () => {
    expect(() => computeImpliedRate(1_000_000, 0, PricingTier.MID)).toThrow();
  });

  it("should handle large project values", () => {
    // $50,000 project for 200 hours = $250/hr base
    const rate = computeImpliedRate(5_000_000, 200, PricingTier.MID);
    expect(rate).toBe(25000); // $250/hr in cents
  });
});

describe("buildQuoteFromEffortEstimate", () => {
  const mockProject: ProjectContext = {
    id: "test-project-id",
    totalPriceCents: 1_000_000, // $10,000
    pricingTier: PricingTier.MID,
    title: "Test Project",
    clientName: "Test Client",
    currency: "USD",
  };

  const mockScope: ScopeContext = {
    estimatedHours: 100,
  };

  const mockEffortItems = [
    { description: "Backend API development", hours: 8 },
    { description: "Frontend integration", hours: 4 },
  ];

  it("should build a quote with correct structure", () => {
    const quote = buildQuoteFromEffortEstimate(
      mockEffortItems,
      mockProject,
      mockScope,
      "This covers the new feature request.",
      1
    );

    expect(quote.lineItemsJson).toHaveLength(2);
    expect(quote.lineItemsJson[0].description).toBe("Backend API development");
    expect(quote.lineItemsJson[0].hours).toBe(8);
    expect(quote.versionNumber).toBe(1);
    expect(quote.rationale).toBe("This covers the new feature request.");
  });

  it("should have subtotalCents equal to sum of line item totals", () => {
    const quote = buildQuoteFromEffortEstimate(
      mockEffortItems,
      mockProject,
      mockScope,
      "Test rationale"
    );

    const manualSum = quote.lineItemsJson.reduce(
      (sum, item) => sum + item.totalCents,
      0
    );
    expect(quote.subtotalCents).toBe(manualSum);
  });

  it("should compute timeline impact in days (8 hrs/day, rounded up)", () => {
    const items = [{ description: "Work", hours: 10 }]; // 10 hrs / 8 = 1.25 → 2 days
    const quote = buildQuoteFromEffortEstimate(
      items,
      mockProject,
      mockScope,
      "Test"
    );
    expect(quote.timelineImpactDays).toBe(2);
  });

  it("PREMIUM quote is always more expensive than AFFORDABLE for same effort", () => {
    const premiumProject: ProjectContext = {
      ...mockProject,
      pricingTier: PricingTier.PREMIUM,
    };
    const affordableProject: ProjectContext = {
      ...mockProject,
      pricingTier: PricingTier.AFFORDABLE,
    };

    const premiumQuote = buildQuoteFromEffortEstimate(
      mockEffortItems,
      premiumProject,
      mockScope,
      "Test"
    );
    const affordableQuote = buildQuoteFromEffortEstimate(
      mockEffortItems,
      affordableProject,
      mockScope,
      "Test"
    );

    expect(premiumQuote.totalCents).toBeGreaterThan(affordableQuote.totalCents);
  });

  it("PREMIUM vs AFFORDABLE total price ratio is approximately 1.3/0.8", () => {
    const premiumProject: ProjectContext = {
      ...mockProject,
      pricingTier: PricingTier.PREMIUM,
    };
    const affordableProject: ProjectContext = {
      ...mockProject,
      pricingTier: PricingTier.AFFORDABLE,
    };

    const premiumQuote = buildQuoteFromEffortEstimate(
      mockEffortItems,
      premiumProject,
      mockScope,
      "Test"
    );
    const affordableQuote = buildQuoteFromEffortEstimate(
      mockEffortItems,
      affordableProject,
      mockScope,
      "Test"
    );

    const ratio = premiumQuote.totalCents / affordableQuote.totalCents;
    const expectedRatio = 1.3 / 0.8; // 1.625

    // Allow rounding tolerance of ±10%
    expect(Math.abs(ratio - expectedRatio)).toBeLessThan(expectedRatio * 0.1);
  });

  it("all line item totals should be rounded to nearest $5", () => {
    const quote = buildQuoteFromEffortEstimate(
      mockEffortItems,
      mockProject,
      mockScope,
      "Test"
    );

    for (const item of quote.lineItemsJson) {
      expect(item.totalCents % 500).toBe(0);
    }
  });
});
