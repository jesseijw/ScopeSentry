import "dotenv/config";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyRateLimit from "@fastify/rate-limit";

import { authRoutes } from "./routes/auth";
import { projectRoutes } from "./routes/projects";
import { scopeRoutes } from "./routes/scope";
import { slackRoutes } from "./routes/slack";
import { driftRoutes } from "./routes/drift";
import { quotesRoutes } from "./routes/quotes";
import { clientQuoteRoutes } from "./routes/clientQuote";
import { notificationRoutes } from "./routes/notifications";
import { startDriftWorker } from "./workers/driftWorker";
import { startNotificationWorker } from "./workers/notificationWorker";

const PORT = parseInt(process.env.PORT || "3001");
const HOST = process.env.HOST || "0.0.0.0";

async function build() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
    // Enable raw body capture for Slack signature verification
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // Store raw body for Slack signature verification
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    function (req: any, body: Buffer, done: any) {
      req.rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (err: any) {
        done(err, undefined);
      }
    }
  );

  // ─── Plugins ──────────────────────────────────────────────────────────────

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  });

  await fastify.register(fastifyMultipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });

  await fastify.register(fastifyRateLimit, {
    max: parseInt(process.env.RATE_LIMIT_PER_MINUTE || "60"),
    timeWindow: "1 minute",
    // Skip rate limiting for Slack events (high-volume webhook)
    skip: (req: any) => req.url === "/slack/events",
  } as any);

  // ─── Routes ───────────────────────────────────────────────────────────────

  await fastify.register(authRoutes);
  await fastify.register(projectRoutes);
  await fastify.register(scopeRoutes);
  await fastify.register(slackRoutes);
  await fastify.register(driftRoutes);
  await fastify.register(quotesRoutes);
  await fastify.register(clientQuoteRoutes);
  await fastify.register(notificationRoutes);

  // Health check
  fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  return fastify;
}

async function start() {
  const app = await build();

  // Start BullMQ workers
  const driftWorker = startDriftWorker();
  const notificationWorker = startNotificationWorker();

  app.log.info("Workers started");

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    await Promise.all([
      app.close(),
      driftWorker.close(),
      notificationWorker.close(),
    ]);
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start();
