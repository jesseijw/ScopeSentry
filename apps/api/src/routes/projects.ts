import { FastifyInstance } from "fastify";
import { getPrisma } from "../utils/prisma";
import {
  CreateProjectInputSchema,
  UpdateProjectInputSchema,
} from "@scopesentry/shared";
import { requireAuth } from "../middleware/auth";

// BigInt serialization helper
function serialize(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? Number(value) : value
    )
  );
}

export async function projectRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // GET /projects
  fastify.get("/projects", { preHandler: requireAuth }, async (request: any, reply) => {
    const projects = await prisma.project.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "desc" },
      include: {
        scopes: { orderBy: { version: "desc" }, take: 1 },
        messageAnalyses: {
          where: { triggeredQuoteId: { not: null }, freelancerOverride: null },
          select: { id: true },
        },
        quotes: {
          where: { status: "ACCEPTED" },
          include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        },
      },
    });

    const result = projects.map((p: any) => {
      const acceptedTotal = p.quotes.reduce((sum: number, q: any) => {
        const v = q.versions[0];
        return sum + (v ? Number(v.totalCents) : 0);
      }, 0);

      return serialize({
        ...p,
        totalPrice: Number(p.totalPriceCents) / 100,
        pendingDriftCount: p.messageAnalyses.length,
        acceptedChangeOrderTotal: acceptedTotal / 100,
        messageAnalyses: undefined,
      });
    });

    return reply.send({ projects: result });
  });

  // POST /projects
  fastify.post("/projects", { preHandler: requireAuth }, async (request: any, reply) => {
    const body = CreateProjectInputSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error });
    }

    const project = await prisma.project.create({
      data: {
        userId: request.userId,
        title: body.data.title,
        clientName: body.data.clientName,
        clientEmail: body.data.clientEmail,
        totalPriceCents: BigInt(body.data.totalPriceCents),
        currency: body.data.currency,
        pricingTier: body.data.pricingTier,
        startDate: new Date(body.data.startDate),
        endDate: body.data.endDate ? new Date(body.data.endDate) : null,
        slackChannelId: body.data.slackChannelId,
      },
    });

    return reply.status(201).send({ project: serialize(project) });
  });

  // GET /projects/:id
  fastify.get("/projects/:id", { preHandler: requireAuth }, async (request: any, reply) => {
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.userId },
      include: {
        scopes: {
          orderBy: { version: "desc" },
          include: { scopeItems: true },
        },
        quotes: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        },
      },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    return reply.send({
      project: serialize({
        ...project,
        totalPrice: Number(project.totalPriceCents) / 100,
      }),
    });
  });

  // PATCH /projects/:id
  fastify.patch("/projects/:id", { preHandler: requireAuth }, async (request: any, reply) => {
    const existing = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const body = UpdateProjectInputSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error });
    }

    const updated = await prisma.project.update({
      where: { id: request.params.id },
      data: {
        ...(body.data.title && { title: body.data.title }),
        ...(body.data.clientName && { clientName: body.data.clientName }),
        ...(body.data.clientEmail && { clientEmail: body.data.clientEmail }),
        ...(body.data.totalPriceCents && { totalPriceCents: BigInt(body.data.totalPriceCents) }),
        ...(body.data.currency && { currency: body.data.currency }),
        ...(body.data.pricingTier && { pricingTier: body.data.pricingTier }),
        ...(body.data.startDate && { startDate: new Date(body.data.startDate) }),
        ...(body.data.endDate && { endDate: new Date(body.data.endDate) }),
        ...(body.data.slackChannelId !== undefined && { slackChannelId: body.data.slackChannelId }),
        ...(body.data.status && { status: body.data.status }),
      },
    });

    return reply.send({ project: serialize(updated) });
  });

  // DELETE /projects/:id
  fastify.delete("/projects/:id", { preHandler: requireAuth }, async (request: any, reply) => {
    const existing = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Project not found" });
    }

    await prisma.project.delete({ where: { id: request.params.id } });
    return reply.send({ success: true });
  });
}
