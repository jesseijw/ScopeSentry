import { DRIFT_THRESHOLDS } from "@scopesentry/shared";

export interface ScopeItemEmbedding {
  id: string;
  kind: "DELIVERABLE" | "OUT_OF_SCOPE" | "ASSUMPTION";
  embedding: number[];
}

export interface DriftScorerInput {
  messageEmbedding: number[];
  scopeItems: ScopeItemEmbedding[];
}

export interface DriftScorerResult {
  driftScore: number;
  nearestScopeItemId: string;
  nearestOutOfScopeId?: string;
  forceExpansion: boolean;
  nearestDeliverableSimilarity: number;
  nearestOutOfScopeSimilarity: number;
}

/**
 * Compute cosine similarity between two equal-length vectors
 * Returns a value in [-1, 1]; higher means more similar
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);

  if (magnitude === 0) return 0;

  return dot / magnitude;
}

/**
 * Score the drift of a message relative to project scope.
 *
 * Logic:
 * - Compute cosine similarity between message embedding and each deliverable
 * - If max deliverable similarity < MIN_SIMILARITY (0.72) → amplify score
 * - If any out_of_scope item similarity > OUT_OF_SCOPE_FORCE (0.82) → forceExpansion = true
 * - driftScore is a normalized value in [0, 1]
 */
export function scoreDrift(input: DriftScorerInput): DriftScorerResult {
  const { messageEmbedding, scopeItems } = input;

  const deliverables = scopeItems.filter((s) => s.kind === "DELIVERABLE");
  const outOfScopeItems = scopeItems.filter((s) => s.kind === "OUT_OF_SCOPE");
  const allItems = scopeItems;

  // Find nearest scope item overall (across all kinds)
  let maxOverallSimilarity = -Infinity;
  let nearestScopeItemId = scopeItems[0]?.id ?? "";

  for (const item of allItems) {
    const sim = cosineSimilarity(messageEmbedding, item.embedding);
    if (sim > maxOverallSimilarity) {
      maxOverallSimilarity = sim;
      nearestScopeItemId = item.id;
    }
  }

  // Find max similarity among deliverables
  let maxDeliverableSimilarity = 0;
  for (const item of deliverables) {
    const sim = cosineSimilarity(messageEmbedding, item.embedding);
    if (sim > maxDeliverableSimilarity) {
      maxDeliverableSimilarity = sim;
    }
  }

  // Find max similarity among out-of-scope items
  let maxOutOfScopeSimilarity = 0;
  let nearestOutOfScopeId: string | undefined;
  for (const item of outOfScopeItems) {
    const sim = cosineSimilarity(messageEmbedding, item.embedding);
    if (sim > maxOutOfScopeSimilarity) {
      maxOutOfScopeSimilarity = sim;
      nearestOutOfScopeId = item.id;
    }
  }

  // Force expansion if message is close to an explicitly excluded item
  const forceExpansion =
    maxOutOfScopeSimilarity > DRIFT_THRESHOLDS.OUT_OF_SCOPE_FORCE;

  // Compute drift score:
  // High similarity to deliverables → low drift (message is about existing scope)
  // Low similarity to deliverables → high drift (message is about something new)
  let driftScore: number;

  if (deliverables.length === 0) {
    // No deliverables to compare against — treat as uncertain
    driftScore = 0.5;
  } else if (maxDeliverableSimilarity < DRIFT_THRESHOLDS.MIN_SIMILARITY) {
    // Message is not close to any deliverable → high drift, amplify signal
    // Map [0, MIN_SIMILARITY) → [1.0, 0.6] (inverted and amplified)
    const normalized = maxDeliverableSimilarity / DRIFT_THRESHOLDS.MIN_SIMILARITY;
    // Amplification: the further from threshold, the higher the drift
    driftScore = Math.max(0.6, 1.0 - normalized * 0.4);
  } else {
    // Message is within deliverable space → low drift
    // Map [MIN_SIMILARITY, 1.0] → [0.4, 0.0]
    const normalized =
      (maxDeliverableSimilarity - DRIFT_THRESHOLDS.MIN_SIMILARITY) /
      (1.0 - DRIFT_THRESHOLDS.MIN_SIMILARITY);
    driftScore = Math.max(0, 0.4 - normalized * 0.4);
  }

  // Out-of-scope match pushes drift to maximum
  if (forceExpansion) {
    driftScore = Math.max(driftScore, 0.95);
  }

  return {
    driftScore: Math.min(1, Math.max(0, driftScore)),
    nearestScopeItemId,
    nearestOutOfScopeId,
    forceExpansion,
    nearestDeliverableSimilarity: maxDeliverableSimilarity,
    nearestOutOfScopeSimilarity: maxOutOfScopeSimilarity,
  };
}
