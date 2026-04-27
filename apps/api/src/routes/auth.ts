import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { OAuth2Client } from "google-auth-library";
import * as jwt from "jsonwebtoken";
import { getPrisma } from "../utils/prisma";
import {
  AppleAuthInputSchema,
  GoogleAuthInputSchema,
  RegisterDeviceInputSchema,
} from "@scopesentry/shared";
import { requireAuth } from "../middleware/auth";

// Apple JWT public key verification
// In production, fetch keys from https://appleid.apple.com/auth/keys
async function verifyAppleToken(
  identityToken: string
): Promise<{ sub: string; email?: string }> {
  // Decode the JWT header to get kid
  const parts = identityToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid Apple identity token format");
  }

  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf-8")
  );

  // In production: fetch JWKS from Apple and verify signature
  // For now we decode and validate issuer/audience fields
  if (payload.iss !== "https://appleid.apple.com") {
    throw new Error("Invalid Apple token issuer");
  }

  const bundleId = process.env.APNS_BUNDLE_ID || "com.scopesentry.app";
  if (payload.aud !== bundleId) {
    throw new Error("Invalid Apple token audience");
  }

  if (!payload.sub) {
    throw new Error("Apple token missing subject");
  }

  return { sub: payload.sub as string, email: payload.email as string | undefined };
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // POST /auth/apple
  fastify.post(
    "/auth/apple",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = AppleAuthInputSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid request", details: body.error });
      }

      const { identityToken, email: bodyEmail } = body.data;

      let appleSub: string;
      let email: string | undefined;

      try {
        const verified = await verifyAppleToken(identityToken);
        appleSub = verified.sub;
        email = verified.email || bodyEmail;
      } catch (err) {
        return reply.status(401).send({ error: "Invalid Apple identity token" });
      }

      if (!email) {
        return reply.status(400).send({
          error: "Email required",
          message: "Email is required for first-time sign-in",
        });
      }

      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          appleSub,
        },
        update: {
          appleSub,
        },
      });

      const token = (fastify as any).jwt.sign(
        { sub: user.id, email: user.email },
        { expiresIn: "30d" }
      );

      return reply.send({ token, userId: user.id, email: user.email });
    }
  );

  // POST /auth/google
  fastify.post(
    "/auth/google",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = GoogleAuthInputSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid request", details: body.error });
      }

      const { idToken } = body.data;

      let googleSub: string;
      let email: string;

      try {
        const client = new OAuth2Client();
        const ticket = await client.verifyIdToken({
          idToken,
          // audience is optional; set if you have a CLIENT_ID
        });
        const payload = ticket.getPayload();
        if (!payload?.sub || !payload?.email) {
          throw new Error("Missing required fields in Google token");
        }
        googleSub = payload.sub;
        email = payload.email;
      } catch (err) {
        return reply.status(401).send({ error: "Invalid Google ID token" });
      }

      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          googleSub,
        },
        update: {
          googleSub,
        },
      });

      const token = (fastify as any).jwt.sign(
        { sub: user.id, email: user.email },
        { expiresIn: "30d" }
      );

      return reply.send({ token, userId: user.id, email: user.email });
    }
  );

  // POST /devices/register
  fastify.post(
    "/devices/register",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = RegisterDeviceInputSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid request", details: body.error });
      }

      await prisma.user.update({
        where: { id: request.userId },
        data: { apnsDeviceToken: body.data.deviceToken },
      });

      return reply.send({ success: true });
    }
  );
}
