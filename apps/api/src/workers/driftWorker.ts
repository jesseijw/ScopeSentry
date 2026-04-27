import { Worker, Job } from "bullmq";
import { getBullMQRedis } from "../utils/redis";
import { getPrisma } from "../utils/prisma";
import { DriftJobData, getNotificationQueue } from "../utils/queues";
import { embedText } from "@scopesentry/nlp";
import { classifyIntent, estimateEffort } from "@scopesentry/nlp";
import { scoreDrift } from "@scopesentry/nlp";
import { buildQuoteFromEffortEstimate } from "@scopesentry/nlp";
import { IntentCategory, PricingTier } from "@scopesentry/shared";
import { Decimal } from "@prisma/client/runtime/library";

async function getScopeItemsWithEmbeddings(
  prisma: ReturnType<typeof getPrisma>,
  projectId: string
): Promise<Array<{ id: string; kind: string; description: string; embedding: number[] | null }>> {
  // Load scope items with embeddings via raw SQL
  const rows = (await prisma.$queryRaw`
    SELECT si.id, si.kind, si.description,
           si.embedding::text as embedding_text
    FROM scope_items si
    JOIN scopes s ON si.scope_id = s.id
    WHERE s.project_id = ${projectId}
    ORDER BY s.version DESC
  `) as Array<{ id: string; kind: string; description: string; embedding_text: string | null }>;

  return rows.map((row) => {
    let embedding: number[] | null = null;
    if (row.embedding_text) {
      try {
        // pgvector returns format like [0.1,0.2,...]
        embedding = JSON.parse(row.embedding_text);
      } catch {
        embedding = null;
      }
    }
    return { id: row.id, kind: row.kind, description: row.description, embedding };
  });
}

export function startDriftWorker(): Worker<DriftJobData> {
  const prisma = getPrisma();
  const notificationQueue = getNotificationQueue();

  const worker = new Worker<DriftJobData>(
    "drift",
    async (job: Job<DriftJobData>) => {
      const { projectId, slackMessageTs, channelId, senderUserId, text } = job.data;

      // Load project
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          user: true,
          scopes: { orderBy: { version: "desc" }, take: 1 },
        },
      });

      if (!project || project.status !== "ACTIVE") return;

      // Deduplicate: skip if already analyzed
      const existing = await prisma.messageAnalysis.findFirst({
        where: { projectId, slackMessageTs, slackChannelId: channelId },
      });
      if (existing) return;

      // Generate embedding for the message
      const messageEmbedding = await embedText(text);

      // Load scope items with embeddings
      const scopeItems = await getScopeItemsWithEmbeddings(prisma, projectId);

      const deliverables = scopeItems.filter(
        (si) => si.kind === "DELIVERABLE" && si.embedding
      );
      const outOfScopeItems = scopeItems.filter(
        (si) => si.kind === "OUT_OF_SCOPE" && si.embedding
      );

      // Score drift
      const driftResult = scoreDrift({
        messageEmbedding,
        scopeItems: [
          ...deliverables.map((si) => ({ id: si.id, kind: "DELIVERABLE" as const, embedding: si.embedding! })),
          ...outOfScopeItems.map((si) => ({ id: si.id, kind: "OUT_OF_SCOPE" as const, embedding: si.embedding! })),
        ],
      });

      // Build project context summary for intent classification
      const scope = project.scopes[0];
      const projectContextSummary = `Project: "${project.title}" for client ${project.clientName}.
Total price: $${(Number(project.totalPriceCents) / 100).toFixed(2)} (${project.pricingTier} tier).
Scope summary: ${scope?.summary || "No scope defined yet."}.`;

      // Classify intent
      const classification = await classifyIntent(text, projectContextSummary);

      // Determine if drift is triggered
      const isDrift =
        (classification.category === IntentCategory.EXPANSION ||
          classification.category === IntentCategory.MODIFICATION) &&
        classification.confidence > 0.7;

      // Persist analysis
      const analysis = await prisma.messageAnalysis.create({
        data: {
          projectId,
          slackMessageTs,
          slackChannelId: channelId,
          senderSlackUserId: senderUserId,
          rawText: text,
          intentCategory: classification.category as any,
          driftScore: new Decimal(driftResult.driftScore),
          nearestScopeItemId: driftResult.nearestScopeItemId || null,
        },
      });

      // Store the message embedding
      const vectorStr = `[${messageEmbedding.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE message_analyses
        SET embedding = ${vectorStr}::vector
        WHERE id = ${analysis.id}
      `;

      if (!isDrift) return;

      // Generate effort estimate via Claude
      const scopeSummary = scope?.summary || "No scope defined.";
      const effort = await estimateEffort(text, projectContextSummary, scopeSummary);

      // Build quote
      const estimatedHours = scope
        ? parseFloat(scope.estimatedHours.toString())
        : 0;

      const quoteVersion = buildQuoteFromEffortEstimate(
        effort.lineItems,
        {
          id: project.id,
          totalPriceCents: Number(project.totalPriceCents),
          pricingTier: project.pricingTier as PricingTier,
          title: project.title,
          clientName: project.clientName,
          currency: project.currency,
        },
        { estimatedHours },
        effort.overallRationale,
        1
      );

      // Create quote in DB
      const quote = await prisma.quote.create({
        data: {
          projectId,
          sourceMessageAnalysisId: analysis.id,
          status: "DRAFT",
        },
      });

      const version = await prisma.quoteVersion.create({
        data: {
          quoteId: quote.id,
          versionNumber: 1,
          lineItemsJson: quoteVersion.lineItemsJson,
          subtotalCents: BigInt(quoteVersion.subtotalCents),
          totalCents: BigInt(quoteVersion.totalCents),
          timelineImpactDays: quoteVersion.timelineImpactDays,
          rationale: quoteVersion.rationale,
        },
      });

      await prisma.quote.update({
        where: { id: quote.id },
        data: { currentVersionId: version.id },
      });

      // Update analysis with triggered quote
      await prisma.messageAnalysis.update({
        where: { id: analysis.id },
        data: { triggeredQuoteId: quote.id },
      });

      // Enqueue push notification
      await notificationQueue.add(
        "send-notification",
        {
          userId: project.userId,
          kind: "DRIFT_DETECTED",
          payload: {
            quoteId: quote.id,
            projectId,
            projectTitle: project.title,
            draftTotal: quoteVersion.totalCents,
            messageText: text.slice(0, 120),
          },
        },
        {
          jobId: `drift-notif-${quote.id}`, // idempotent
        }
      );
    },
    {
      connection: getBullMQRedis(),
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`Drift worker job ${job?.id} failed:`, err);
  });

  return worker;
}
