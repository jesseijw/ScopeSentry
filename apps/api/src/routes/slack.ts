import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { getPrisma } from "../utils/prisma";
import { requireAuth } from "../middleware/auth";
import { encryptToBytes } from "../utils/crypto";
import { getDriftQueue } from "../utils/queues";
import {
  listWorkspaceChannels,
  fetchChannelHistory,
} from "../services/slack";
import { LinkSlackChannelInputSchema } from "@scopesentry/shared";

const SLACK_API = "https://slack.com/api";

function buildSlackOAuthUrl(): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.API_BASE_URL || "http://localhost:3001"}/slack/oauth/callback`;
  const scopes = [
    "channels:history",
    "channels:read",
    "groups:history",
    "groups:read",
    "im:history",
    "im:read",
    "mpim:history",
    "mpim:read",
    "chat:write",
    "users:read",
    "users:read.email",
  ].join(",");

  return (
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${clientId}` +
    `&user_scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`
  );
}

function verifySlackSignature(
  signingSecret: string,
  rawBody: Buffer,
  timestamp: string,
  signature: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;

  const sigBase = `v0:${timestamp}:${rawBody.toString("utf-8")}`;
  const hash = "v0=" + crypto.createHmac("sha256", signingSecret).update(sigBase).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

export async function slackRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // GET /slack/install
  fastify.get(
    "/slack/install",
    { preHandler: requireAuth },
    async (_req: any, reply: any) => {
      const url = buildSlackOAuthUrl();
      return reply.send({ url });
    }
  );

  // GET /slack/oauth/callback
  fastify.get(
    "/slack/oauth/callback",
    async (request: any, reply: any) => {
      const { code, error } = request.query;

      if (error || !code) {
        return reply.redirect(`scopesentry://slack-callback?error=${error || "no_code"}`);
      }

      const clientId = process.env.SLACK_CLIENT_ID!;
      const clientSecret = process.env.SLACK_CLIENT_SECRET!;
      const redirectUri = `${process.env.API_BASE_URL || "http://localhost:3001"}/slack/oauth/callback`;

      // Exchange code for token
      const resp = await fetch(`${SLACK_API}/oauth.v2.access`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }).toString(),
      });

      const data = (await resp.json()) as any;

      if (!data.ok) {
        return reply.redirect(`scopesentry://slack-callback?error=${data.error}`);
      }

      // Slack v2: user token is at data.authed_user.access_token
      const userToken: string = data.authed_user?.access_token;
      const slackUserId: string = data.authed_user?.id;
      const slackTeamId: string = data.team?.id;

      if (!userToken || !slackUserId) {
        return reply.redirect(`scopesentry://slack-callback?error=missing_user_token`);
      }

      // We need to identify the ScopeSentry user — use state param (should contain their JWT)
      // For simplicity: look up by Slack user. The app will re-set on connect.
      // In production, pass state=<jwt> from the install step and decode it here.
      const state = request.query.state;
      let scopesentryUserId: string | null = null;

      if (state) {
        try {
          const jwtSecret = process.env.JWT_SECRET!;
          const decoded = require("jsonwebtoken").verify(state, jwtSecret) as { sub: string };
          scopesentryUserId = decoded.sub;
        } catch {
          // ignore
        }
      }

      if (!scopesentryUserId) {
        // Try to find by Slack user ID if already linked
        const existing = await prisma.user.findFirst({ where: { slackUserId } });
        scopesentryUserId = existing?.id ?? null;
      }

      if (!scopesentryUserId) {
        return reply.redirect(`scopesentry://slack-callback?error=user_not_found`);
      }

      // Encrypt token and save
      const encrypted = encryptToBytes(userToken);

      await prisma.user.update({
        where: { id: scopesentryUserId },
        data: {
          slackUserId,
          slackTeamId,
          slackAccessToken: encrypted,
        },
      });

      return reply.redirect(
        `scopesentry://slack-callback?success=true&team=${slackTeamId}&user=${slackUserId}`
      );
    }
  );

  // GET /slack/channels
  fastify.get(
    "/slack/channels",
    { preHandler: requireAuth },
    async (request: any, reply: any) => {
      const user = await prisma.user.findUnique({ where: { id: request.userId } });

      if (!user?.slackAccessToken) {
        return reply.status(400).send({ error: "Slack not connected" });
      }

      const channels = await listWorkspaceChannels(user.slackAccessToken);
      return reply.send({ channels });
    }
  );

  // POST /projects/:id/slack/link
  fastify.post(
    "/projects/:id/slack/link",
    { preHandler: requireAuth },
    async (request: any, reply: any) => {
      const body = LinkSlackChannelInputSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid request", details: body.error });
      }

      const project = await prisma.project.findFirst({
        where: { id: request.params.id, userId: request.userId },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (!user?.slackAccessToken || !user.slackUserId) {
        return reply.status(400).send({ error: "Slack not connected" });
      }

      await prisma.project.update({
        where: { id: project.id },
        data: { slackChannelId: body.data.channelId },
      });

      // Backfill: last 90 days of messages
      const ninetyDaysAgo = String(
        Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)
      );
      const contractStart = Math.floor(
        new Date(project.startDate).getTime() / 1000
      );
      const oldest = String(Math.max(parseInt(ninetyDaysAgo), contractStart));

      const driftQueue = getDriftQueue();

      try {
        const messages = await fetchChannelHistory(
          user.slackAccessToken,
          body.data.channelId,
          oldest
        );

        // Queue drift analysis for each historical message (non-freelancer)
        for (const msg of messages) {
          if (msg.user === user.slackUserId) continue; // skip freelancer messages
          if (msg.text.length < 15) continue;

          await driftQueue.add("analyze-message", {
            projectId: project.id,
            slackMessageTs: msg.ts,
            channelId: body.data.channelId,
            senderUserId: msg.user,
            text: msg.text,
          });
        }
      } catch (err) {
        fastify.log.warn({ err }, "Backfill failed — continuing");
      }

      return reply.send({ success: true, channelId: body.data.channelId });
    }
  );

  // POST /slack/events — Slack Events API webhook (unauthenticated, signature-verified)
  fastify.post(
    "/slack/events",
    {
      // raw body captured via content-type parser
    },
    async (request: any, reply: any) => {
      const signingSecret = process.env.SLACK_SIGNING_SECRET;
      if (!signingSecret) {
        fastify.log.error("SLACK_SIGNING_SECRET not set");
        return reply.status(500).send({ error: "Server misconfigured" });
      }

      const signature = request.headers["x-slack-signature"] as string;
      const timestamp = request.headers["x-slack-request-timestamp"] as string;
      const rawBody = (request as any).rawBody as Buffer;

      if (
        !signature ||
        !timestamp ||
        !rawBody ||
        !verifySlackSignature(signingSecret, rawBody, timestamp, signature)
      ) {
        return reply.status(401).send({ error: "Invalid signature" });
      }

      const body = request.body as any;

      // URL verification challenge
      if (body.type === "url_verification") {
        return reply.send({ challenge: body.challenge });
      }

      // Route events
      if (body.type === "event_callback") {
        const event = body.event;
        const channelId: string = event.channel;

        // Find project linked to this channel
        const project = await prisma.project.findFirst({
          where: { slackChannelId: channelId, status: "ACTIVE" },
          include: { user: true },
        });

        if (!project) {
          return reply.send({ ok: true }); // Not tracked
        }

        // Drop bot messages, short texts, non-message events
        const isMessage =
          event.type === "message" &&
          !event.bot_id &&
          !event.subtype &&
          event.text &&
          event.text.length >= 15;

        if (!isMessage) {
          return reply.send({ ok: true });
        }

        // Drop messages from the freelancer themselves
        if (event.user === project.user.slackUserId) {
          return reply.send({ ok: true });
        }

        const driftQueue = getDriftQueue();
        await driftQueue.add("analyze-message", {
          projectId: project.id,
          slackMessageTs: event.ts,
          channelId,
          senderUserId: event.user,
          text: event.text,
        });
      }

      return reply.send({ ok: true });
    }
  );
}
