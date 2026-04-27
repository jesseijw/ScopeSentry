import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as jwtLib from "jsonwebtoken";
import { getPrisma } from "../utils/prisma";
import { postConfirmationToThread } from "../services/slack";
import { sendEmail, sendApnsPush } from "../services/notifications";
import { getNotificationQueue } from "../utils/queues";
import {
  ClientAcknowledgeInputSchema,
  ClientRequestChangesInputSchema,
} from "@scopesentry/shared";
import { BuiltLineItem } from "@scopesentry/nlp";

function verifyClientToken(token: string): { quoteId: string } {
  const secret = process.env.QUOTE_JWT_SECRET;
  if (!secret) throw new Error("QUOTE_JWT_SECRET not set");
  const decoded = jwtLib.verify(token, secret) as { quoteId: string };
  return { quoteId: decoded.quoteId };
}

export async function clientQuoteRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // GET /q/:token — returns quote data for the client-facing page
  fastify.get(
    "/q/:token",
    async (request: any, reply: any) => {
      let quoteId: string;
      try {
        ({ quoteId } = verifyClientToken(request.params.token));
      } catch {
        return reply.status(404).send({ error: "Invalid or expired link" });
      }

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          project: { select: { title: true, clientName: true, clientEmail: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      });

      if (!quote) {
        return reply.status(404).send({ error: "Quote not found" });
      }

      const version = quote.versions[0];

      return reply.send({
        quoteId: quote.id,
        status: quote.status,
        project: quote.project,
        version: version
          ? {
              lineItems: version.lineItemsJson as BuiltLineItem[],
              subtotalCents: Number(version.subtotalCents),
              totalCents: Number(version.totalCents),
              timelineImpactDays: version.timelineImpactDays,
              rationale: version.rationale,
            }
          : null,
      });
    }
  );

  // POST /q/:token/acknowledge
  fastify.post(
    "/q/:token/acknowledge",
    async (request: any, reply: any) => {
      let quoteId: string;
      try {
        ({ quoteId } = verifyClientToken(request.params.token));
      } catch {
        return reply.status(404).send({ error: "Invalid or expired link" });
      }

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          project: { include: { user: true, scopes: { orderBy: { version: "desc" }, take: 1, include: { scopeItems: true } } } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      });

      if (!quote) return reply.status(404).send({ error: "Quote not found" });
      if (quote.status !== "AWAITING_CLIENT") {
        return reply.status(400).send({ error: "Quote is not awaiting acknowledgement" });
      }

      const version = quote.versions[0];
      const project = quote.project;
      const user = project.user;
      const lineItems = (version?.lineItemsJson as BuiltLineItem[]) || [];

      // Update quote status
      await prisma.quote.update({
        where: { id: quoteId },
        data: { status: "ACCEPTED" },
      });

      // Update scope: append new line items as amendments to current scope
      const currentScope = project.scopes[0];
      if (currentScope && lineItems.length > 0) {
        const newScope = await prisma.scope.create({
          data: {
            projectId: project.id,
            version: currentScope.version + 1,
            summary: `${currentScope.summary}\n\nAmended: ${version?.rationale || ""}`,
            estimatedHours: currentScope.estimatedHours,
          },
        });

        // Copy existing items + add new deliverables from accepted change order
        const existingItems = currentScope.scopeItems.map((si: any) => ({
          scopeId: newScope.id,
          kind: si.kind,
          description: si.description,
        }));

        const newItems = lineItems.map((li) => ({
          scopeId: newScope.id,
          kind: "DELIVERABLE" as const,
          description: li.description,
        }));

        await prisma.scopeItem.createMany({
          data: [...existingItems, ...newItems],
        });
      }

      // Post Slack confirmation
      if (user.slackAccessToken && project.slackChannelId) {
        try {
          await postConfirmationToThread(
            user.slackAccessToken,
            project.slackChannelId,
            "ACCEPTED",
            undefined,
            quote.slackMessageTs || undefined
          );
        } catch (err) {
          fastify.log.warn({ err }, "Slack confirmation failed");
        }
      }

      // Notify freelancer via APNs
      if (user.apnsDeviceToken) {
        try {
          await sendApnsPush(
            user.apnsDeviceToken,
            "Change Order Accepted ✅",
            `${project.clientName} accepted the quote for "${project.title}"`,
            { quoteId, type: "CLIENT_ACCEPTED" }
          );
        } catch (err) {
          fastify.log.warn({ err }, "APNs push failed");
        }
      }

      // Persist notification record
      await prisma.notification.create({
        data: {
          userId: user.id,
          kind: "CLIENT_ACCEPTED",
          payloadJson: {
            quoteId,
            projectId: project.id,
            projectTitle: project.title,
            clientName: project.clientName,
          },
          deliveredAt: new Date(),
        },
      });

      return reply.send({ success: true, message: "Change order acknowledged." });
    }
  );

  // POST /q/:token/request-changes
  fastify.post(
    "/q/:token/request-changes",
    async (request: any, reply: any) => {
      const body = ClientRequestChangesInputSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Feedback is required" });
      }

      let quoteId: string;
      try {
        ({ quoteId } = verifyClientToken(request.params.token));
      } catch {
        return reply.status(404).send({ error: "Invalid or expired link" });
      }

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          project: { include: { user: true } },
        },
      });

      if (!quote) return reply.status(404).send({ error: "Quote not found" });
      if (quote.status !== "AWAITING_CLIENT") {
        return reply.status(400).send({ error: "Quote is not awaiting client response" });
      }

      const user = quote.project.user;
      const project = quote.project;

      // Move back to DRAFT so freelancer can iterate
      await prisma.quote.update({
        where: { id: quoteId },
        data: { status: "DRAFT" },
      });

      // Post Slack message with feedback
      if (user.slackAccessToken && project.slackChannelId) {
        try {
          await postConfirmationToThread(
            user.slackAccessToken,
            project.slackChannelId,
            "CHANGES_REQUESTED",
            body.data.feedback,
            quote.slackMessageTs || undefined
          );
        } catch (err) {
          fastify.log.warn({ err }, "Slack notification failed");
        }
      }

      // Notify freelancer
      if (user.apnsDeviceToken) {
        try {
          await sendApnsPush(
            user.apnsDeviceToken,
            "Client Requested Changes",
            `${project.clientName}: "${body.data.feedback.slice(0, 80)}"`,
            { quoteId, type: "CLIENT_REQUESTED_CHANGES" }
          );
        } catch (err) {
          fastify.log.warn({ err }, "APNs push failed");
        }
      }

      await prisma.notification.create({
        data: {
          userId: user.id,
          kind: "CLIENT_REQUESTED_CHANGES",
          payloadJson: {
            quoteId,
            projectId: project.id,
            projectTitle: project.title,
            clientName: project.clientName,
            feedback: body.data.feedback,
          },
          deliveredAt: new Date(),
        },
      });

      return reply.send({ success: true, message: "Feedback submitted." });
    }
  );
}
