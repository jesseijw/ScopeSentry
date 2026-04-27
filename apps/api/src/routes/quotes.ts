import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as jwtLib from "jsonwebtoken";
import { getPrisma } from "../utils/prisma";
import { requireAuth } from "../middleware/auth";
import { processQuoteChatMessage } from "../services/quoteChat";
import {
  postQuoteToThread,
  postConfirmationToThread,
} from "../services/slack";
import {
  sendEmail,
  buildQuoteEmailHtml,
  sendApnsPush,
} from "../services/notifications";
import { getNotificationQueue } from "../utils/queues";
import { QuoteChatMessageSchema } from "@scopesentry/shared";
import { BuiltLineItem } from "@scopesentry/nlp";

function generateClientToken(quoteId: string): string {
  const secret = process.env.QUOTE_JWT_SECRET;
  if (!secret) throw new Error("QUOTE_JWT_SECRET not set");
  return jwtLib.sign({ quoteId }, secret, { expiresIn: "14d" });
}

export async function quotesRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // GET /quotes/:id
  fastify.get(
    "/quotes/:id",
    { preHandler: requireAuth },
    async (request: any, reply: any) => {
      const quote = await prisma.quote.findFirst({
        where: { id: request.params.id, project: { userId: request.userId } },
        include: {
          project: true,
          sourceAnalysis: true,
          versions: { orderBy: { versionNumber: "asc" } },
          chatTurns: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!quote) {
        return reply.status(404).send({ error: "Quote not found" });
      }

      return reply.send({ quote });
    }
  );

  // GET /projects/:id/quotes
  fastify.get(
    "/projects/:id/quotes",
    { preHandler: requireAuth },
    async (request: any, reply: any) => {
      const project = await prisma.project.findFirst({
        where: { id: request.params.id, userId: request.userId },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const quotes = await prisma.quote.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: "desc" },
        include: {
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      });

      return reply.send({ quotes });
    }
  );

  // POST /quotes/:id/chat
  fastify.post(
    "/quotes/:id/chat",
    { preHandler: requireAuth },
    async (request: any, reply: any) => {
      const body = QuoteChatMessageSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid request", details: body.error });
      }

      // Verify quote access
      const quote = await prisma.quote.findFirst({
        where: { id: request.params.id, project: { userId: request.userId } },
      });

      if (!quote) {
        return reply.status(404).send({ error: "Quote not found" });
      }

      if (quote.status !== "DRAFT") {
        return reply.status(400).send({
          error: "Cannot edit a quote that has already been sent or accepted",
        });
      }

      const result = await processQuoteChatMessage(
        request.params.id,
        request.userId,
        body.data.content
      );

      return reply.send(result);
    }
  );

  // POST /quotes/:id/approve — send to client
  fastify.post(
    "/quotes/:id/approve",
    { preHandler: requireAuth },
    async (request: any, reply: any) => {
      const quote = await prisma.quote.findFirst({
        where: { id: request.params.id, project: { userId: request.userId } },
        include: {
          project: true,
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          sourceAnalysis: true,
        },
      });

      if (!quote) return reply.status(404).send({ error: "Quote not found" });
      if (quote.status !== "DRAFT") {
        return reply.status(400).send({ error: "Quote already sent or finalized" });
      }

      const currentVersion = quote.versions[0];
      if (!currentVersion) return reply.status(400).send({ error: "No quote version" });

      const user = await prisma.user.findUnique({
        where: { id: request.userId },
      });

      if (!user?.slackAccessToken) {
        return reply.status(400).send({ error: "Slack not connected" });
      }

      if (!quote.project.slackChannelId) {
        return reply.status(400).send({ error: "No Slack channel linked to project" });
      }

      // Generate client acknowledgement token
      const clientToken = generateClientToken(quote.id);
      const quotesBaseUrl = process.env.QUOTES_BASE_URL || "http://localhost:3002";
      const clientUrl = `${quotesBaseUrl}/q/${clientToken}`;

      const lineItems = currentVersion.lineItemsJson as BuiltLineItem[];

      // Post to Slack thread
      let slackTs: string | undefined;
      let slackPermalink: string | undefined;

      try {
        const slackResult = await postQuoteToThread(
          user.slackAccessToken,
          quote.project.slackChannelId,
          lineItems,
          currentVersion.totalCents,
          currentVersion.subtotalCents,
          currentVersion.rationale,
          currentVersion.timelineImpactDays,
          clientUrl,
          quote.project.title,
          quote.sourceAnalysis?.slackMessageTs
        );
        slackTs = slackResult.ts;
        slackPermalink = slackResult.permalink;
      } catch (err) {
        fastify.log.error({ err }, "Failed to post Slack message");
        return reply.status(502).send({ error: "Failed to post to Slack" });
      }

      // Send email to client
      try {
        const emailHtml = buildQuoteEmailHtml(
          quote.project.clientName,
          quote.project.title,
          currentVersion.rationale,
          lineItems,
          currentVersion.totalCents,
          currentVersion.timelineImpactDays,
          clientUrl
        );

        await sendEmail(
          quote.project.clientEmail,
          `Change Order: ${quote.project.title}`,
          emailHtml
        );
      } catch (err) {
        fastify.log.warn({ err }, "Email delivery failed — continuing");
      }

      // Update quote status
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: "AWAITING_CLIENT",
          clientAcknowledgementToken: clientToken,
          slackMessageTs: slackTs,
          currentVersionId: currentVersion.id,
        },
      });

      return reply.send({
        success: true,
        clientUrl,
        slackTs,
        slackPermalink,
      });
    }
  );

  // POST /quotes/:id/revert/:versionId
  fastify.post(
    "/quotes/:id/revert/:versionId",
    { preHandler: requireAuth },
    async (request: any, reply: any) => {
      const quote = await prisma.quote.findFirst({
        where: { id: request.params.id, project: { userId: request.userId } },
      });

      if (!quote) return reply.status(404).send({ error: "Quote not found" });
      if (quote.status !== "DRAFT") {
        return reply.status(400).send({ error: "Cannot revert a sent quote" });
      }

      const version = await prisma.quoteVersion.findFirst({
        where: { id: request.params.versionId, quoteId: quote.id },
      });

      if (!version) return reply.status(404).send({ error: "Version not found" });

      await prisma.quote.update({
        where: { id: quote.id },
        data: { currentVersionId: version.id },
      });

      return reply.send({ quote: { ...quote, currentVersionId: version.id }, version });
    }
  );
}
