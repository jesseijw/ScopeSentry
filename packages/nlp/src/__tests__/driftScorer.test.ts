import {
  cosineSimilarity,
  scoreDrift,
  DriftScorerInput,
  ScopeItemEmbedding,
} from "../driftScorer";
import { DRIFT_THRESHOLDS } from "@scopesentry/shared";

// Helper to create a unit vector in a given direction
function makeVector(dims: number, primaryDim: number, value = 1): number[] {
  const v = new Array(dims).fill(0);
  v[primaryDim] = value;
  return v;
}

// Helper to create a vector with controlled similarity to another
function mixVectors(
  v1: number[],
  v2: number[],
  weight1: number
): number[] {
  const weight2 = 1 - weight1;
  const mixed = v1.map((val, i) => val * weight1 + v2[i] * weight2);
  // Normalize
  const mag = Math.sqrt(mixed.reduce((s, x) => s + x * x, 0));
  return mixed.map((x) => x / mag);
}

describe("cosineSimilarity", () => {
  it("should return 1.0 for identical vectors", () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 10);
  });

  it("should return 0.0 for orthogonal vectors", () => {
    const v1 = [1, 0, 0];
    const v2 = [0, 1, 0];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0, 10);
  });

  it("should return -1.0 for opposite vectors", () => {
    const v1 = [1, 0, 0];
    const v2 = [-1, 0, 0];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0, 10);
  });

  it("should be symmetric", () => {
    const v1 = [0.2, 0.5, 0.8, 0.1];
    const v2 = [0.7, 0.3, 0.2, 0.9];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(
      cosineSimilarity(v2, v1),
      10
    );
  });

  it("should handle zero vectors gracefully", () => {
    const v1 = [0, 0, 0];
    const v2 = [1, 2, 3];
    expect(cosineSimilarity(v1, v2)).toBe(0);
  });

  it("should throw on dimension mismatch", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });

  it("should return value in [-1, 1] range", () => {
    for (let i = 0; i < 20; i++) {
      const v1 = Array.from({ length: 10 }, () => Math.random() - 0.5);
      const v2 = Array.from({ length: 10 }, () => Math.random() - 0.5);
      const sim = cosineSimilarity(v1, v2);
      expect(sim).toBeGreaterThanOrEqual(-1.0 - 1e-10);
      expect(sim).toBeLessThanOrEqual(1.0 + 1e-10);
    }
  });
});

describe("scoreDrift", () => {
  const DIMS = 10;

  // Deliverable embedding: direction 0
  const deliverableEmbedding = makeVector(DIMS, 0);
  // Out-of-scope embedding: direction 1
  const outOfScopeEmbedding = makeVector(DIMS, 1);
  // Unrelated embedding: direction 2
  const unrelatedEmbedding = makeVector(DIMS, 2);

  const scopeItems: ScopeItemEmbedding[] = [
    {
      id: "deliverable-1",
      kind: "DELIVERABLE",
      embedding: deliverableEmbedding,
    },
    {
      id: "out-of-scope-1",
      kind: "OUT_OF_SCOPE",
      embedding: outOfScopeEmbedding,
    },
  ];

  it("should return low drift for message similar to deliverables", () => {
    const input: DriftScorerInput = {
      messageEmbedding: deliverableEmbedding, // identical to deliverable
      scopeItems,
    };

    const result = scoreDrift(input);

    // High similarity to deliverable → low drift score
    expect(result.driftScore).toBeLessThan(0.4);
    expect(result.nearestDeliverableSimilarity).toBeCloseTo(1.0, 5);
    expect(result.forceExpansion).toBe(false);
  });

  it("should amplify signal when similarity < MIN_SIMILARITY threshold (0.72)", () => {
    // Create a message that is mostly unrelated to deliverables
    const lowSimMessage = unrelatedEmbedding; // orthogonal → similarity = 0

    const input: DriftScorerInput = {
      messageEmbedding: lowSimMessage,
      scopeItems,
    };

    const result = scoreDrift(input);

    // Low similarity to deliverables → amplified drift score (>= 0.6)
    expect(result.nearestDeliverableSimilarity).toBeLessThan(
      DRIFT_THRESHOLDS.MIN_SIMILARITY
    );
    expect(result.driftScore).toBeGreaterThanOrEqual(0.6);
  });

  it("should set forceExpansion=true when out-of-scope similarity > 0.82", () => {
    // Message very similar to out-of-scope item
    const highOutOfScopeMessage = outOfScopeEmbedding; // identical

    const input: DriftScorerInput = {
      messageEmbedding: highOutOfScopeMessage,
      scopeItems,
    };

    const result = scoreDrift(input);

    expect(result.nearestOutOfScopeSimilarity).toBeGreaterThan(
      DRIFT_THRESHOLDS.OUT_OF_SCOPE_FORCE
    );
    expect(result.forceExpansion).toBe(true);
    expect(result.nearestOutOfScopeId).toBe("out-of-scope-1");
    // Drift score should be very high when force expansion
    expect(result.driftScore).toBeGreaterThanOrEqual(0.95);
  });

  it("should not force expansion when out-of-scope similarity is below 0.82", () => {
    // Message with partial similarity to out-of-scope (below threshold)
    // Mix out-of-scope (60%) with unrelated (40%) → similarity < 1.0
    const partialOutOfScope = mixVectors(
      outOfScopeEmbedding,
      unrelatedEmbedding,
      0.5
    );

    // The similarity to the pure out-of-scope direction will be cos(angle)
    // With 50/50 mix, similarity = 1/sqrt(2) ≈ 0.707 < 0.82
    const sim = cosineSimilarity(partialOutOfScope, outOfScopeEmbedding);

    const input: DriftScorerInput = {
      messageEmbedding: partialOutOfScope,
      scopeItems,
    };

    const result = scoreDrift(input);

    if (sim <= DRIFT_THRESHOLDS.OUT_OF_SCOPE_FORCE) {
      expect(result.forceExpansion).toBe(false);
    }
  });

  it("should handle empty scope items gracefully", () => {
    const input: DriftScorerInput = {
      messageEmbedding: deliverableEmbedding,
      scopeItems: [],
    };

    const result = scoreDrift(input);
    expect(result.driftScore).toBe(0.5);
  });

  it("should identify nearest scope item correctly", () => {
    const input: DriftScorerInput = {
      messageEmbedding: deliverableEmbedding,
      scopeItems,
    };

    const result = scoreDrift(input);
    // Message is identical to deliverable → nearest should be deliverable-1
    expect(result.nearestScopeItemId).toBe("deliverable-1");
  });

  it("driftScore should always be in [0, 1] range", () => {
    const testVectors = [
      deliverableEmbedding,
      outOfScopeEmbedding,
      unrelatedEmbedding,
      makeVector(DIMS, 3),
      makeVector(DIMS, 4),
    ];

    for (const vec of testVectors) {
      const result = scoreDrift({ messageEmbedding: vec, scopeItems });
      expect(result.driftScore).toBeGreaterThanOrEqual(0);
      expect(result.driftScore).toBeLessThanOrEqual(1);
    }
  });
});
