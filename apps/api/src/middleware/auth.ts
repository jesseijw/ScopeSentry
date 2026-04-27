import { FastifyRequest, FastifyReply } from "fastify";

export interface JwtPayload {
  sub: string; // user id
  email: string;
}

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as JwtPayload;
    request.userId = payload.sub;
    request.userEmail = payload.email;
  } catch (err) {
    reply.status(401).send({ error: "Unauthorized", message: "Valid JWT required" });
  }
}
