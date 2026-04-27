import { FastifyInstance } from "fastify";
import { getPrisma } from "../utils/prisma";
import { requireAuth } from "../middleware/auth";

export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // GET /notifications
  fastify.get<{ Querystring: { page?: string; unread?: string } }>(
    "/notifications",
    { preHandler: requireAuth },
    async (request, reply) => {
      const page = Math.max(1, parseInt(request.query.page || "1"));
      const limit = 25;
      const offset = (page - 1) * limit;
      const unreadOnly = request.query.unread === "true";

      const where = {
        userId: request.userId,
        ...(unreadOnly ? { readAt: null } : {}),
      };

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { deliveredAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);

      return reply.send({
        notifications,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }
  );

  // POST /notifications/:id/read
  fastify.post<{ Params: { id: string } }>(
    "/notifications/:id/read",
    { preHandler: requireAuth },
    async (request, reply) => {
      const notification = await prisma.notification.findFirst({
        where: { id: request.params.id, userId: request.userId },
      });

      if (!notification) {
        return reply.status(404).send({ error: "Notification not found" });
      }

      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: { readAt: new Date() },
      });

      return reply.send({ notification: updated });
    }
  );

  // POST /notifications/read-all
  fastify.post(
    "/notifications/read-all",
    { preHandler: requireAuth },
    async (request, reply) => {
      await prisma.notification.updateMany({
        where: { userId: request.userId, readAt: null },
        data: { readAt: new Date() },
      });

      return reply.send({ success: true });
    }
  );
}
