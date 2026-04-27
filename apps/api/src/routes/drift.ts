import { FastifyInstance } from "fastify";
import { getPrisma } from "../utils/prisma";
import { requireAuth } from "../middleware/auth";
import { OverrideMessageInputSchema } from "@scopesentry/shared";

export async function driftRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // GET /projects/:id/messages — message analysis feed
  fastify.get<{ Params: { id: string }; Querystring: { page?: string; limit?: string } }>(
    "/projects/:id/messages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const project = await prisma.project.findFirst({
        where: { id: request.params.id, userId: request.userId },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const page = Math.max(1, parseInt(request.query.page || "1"));
      const limit = Math.min(50, parseInt(request.query.limit || "25"));
      const offset = (page - 1) * limit;

      const [messages, total] = await Promise.all([
        prisma.messageAnalysis.findMany({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: { nearestScopeItem: true },
        }),
        prisma.messageAnalysis.count({ where: { projectId: project.id } }),
      ]);

      return reply.send({
        messages,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }
  );

  // GET /messages/:id
  fastify.get<{ Params: { id: string } }>(
    "/messages/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const analysis = await prisma.messageAnalysis.findFirst({
        where: {
          id: request.params.id,
          project: { userId: request.userId },
        },
        include: { nearestScopeItem: true },
      });

      if (!analysis) {
        return reply.status(404).send({ error: "Message analysis not found" });
      }

      return reply.send({ analysis });
    }
  );

  // POST /messages/:id/override
  fastify.post<{ Params: { id: string } }>(
    "/messages/:id/override",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = OverrideMessageInputSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid request", details: body.error });
      }

      const analysis = await prisma.messageAnalysis.findFirst({
        where: {
          id: request.params.id,
          project: { userId: request.userId },
        },
      });

      if (!analysis) {
        return reply.status(404).send({ error: "Message analysis not found" });
      }

      const updated = await prisma.messageAnalysis.update({
        where: { id: analysis.id },
        data: { freelancerOverride: body.data.override },
      });

      return reply.send({ analysis: updated });
    }
  );
}
