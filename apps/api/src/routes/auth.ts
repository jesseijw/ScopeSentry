import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { OAuth2Client } from "google-auth-library";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { getPrisma } from "../utils/prisma";
import {
  AppleAuthInputSchema,
  EmailAuthInputSchema,
  GoogleAuthInputSchema,
  RegisterDeviceInputSchema,
} from "@scopesentry/shared";
import { requireAuth } from "../middleware/auth";

// ─── Apple JWKS cache ────────────────────────────────────────────────────────

let appleJwksCache: { keys: any[]; fetchedAt: number } | null = null;

async function getApplePublicKey(kid: string): Promise<crypto.KeyObject> {
  const now = Date.now();
  // Cache JWKS for 10 minutes
  if (!appleJwksCache || now - appleJwksCache.fetchedAt > 10 * 60 * 1000) {
    const res = await fetch("https://appleid.apple.com/auth/keys");
    if (!res.ok) throw new Error("Failed to fetch Apple JWKS");
    const data = (await res.json()) as { keys: any[] };
    appleJwksCache = { keys: data.keys, fetchedAt: now };
  }

  const jwk = appleJwksCache.keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error(`Apple public key not found for kid: ${kid}`);

  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

async function verifyAppleToken(
  identityToken: string
): Promise<{ sub: string; email?: string }> {
  const parts = identityToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Apple identity token format");

  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8"));
  if (!header.kid) throw new Error("Apple token missing kid");

  const publicKey = await getApplePublicKey(header.kid);

  const bundleId = process.env.APNS_BUNDLE_ID || "com.scopesentry.app";
  const payload = jwt.verify(identityToken, publicKey, {
    algorithms: ["RS256"],
    issuer: "https://appleid.apple.com",
    audience: bundleId,
  }) as jwt.JwtPayload;

  if (!payload.sub) throw new Error("Apple token missing subject");

  return { sub: payload.sub, email: payload.email as string | undefined };
}

function toAuthUser(user: {
  id: string;
  email: string;
  slackUserId: string | null;
  slackTeamId: string | null;
  apnsDeviceToken: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.email.split("@")[0],
    slackUserId: user.slackUserId,
    slackTeamId: user.slackTeamId,
    apnsDeviceToken: user.apnsDeviceToken,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // POST /auth/email
  // Expo Go-friendly development login. This creates or reuses a user by email.
  fastify.post(
    "/auth/email",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = EmailAuthInputSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid request", details: body.error });
      }

      const email = body.data.email.trim().toLowerCase();
      const user = await prisma.user.upsert({
        where: { email },
        create: { email },
        update: {},
      });

      const token = (fastify as any).jwt.sign(
        { sub: user.id, email: user.email },
        { expiresIn: "30d" }
      );

      return reply.send({
        token,
        user: toAuthUser(user),
      });
    }
  );

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

      return reply.send({
        token,
        user: toAuthUser(user),
      });
    }
  );

  // POST /auth/google
  // Accepts { accessToken } from the mobile app.
  fastify.post(
    "/auth/google",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = GoogleAuthInputSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid request", details: body.error });
      }

      const { accessToken } = body.data as { accessToken: string };

      let googleSub: string;
      let email: string;

      try {
        // Fetch user info from Google using the access token
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userInfoRes.ok) {
          throw new Error("Failed to fetch Google user info");
        }

        const userInfo = (await userInfoRes.json()) as any;
        if (!userInfo.sub || !userInfo.email) {
          throw new Error("Missing required fields in Google user info");
        }
        if (userInfo.email_verified === false) {
          throw new Error("Google email is not verified");
        }
        googleSub = userInfo.sub;
        email = userInfo.email;
      } catch (err) {
        fastify.log.warn({ err }, "Google auth failed");
        return reply.status(401).send({ error: "Google sign-in failed" });
      }

      const user = await prisma.user.upsert({
        where: { email },
        create: { email, googleSub },
        update: { googleSub },
      });

      const token = (fastify as any).jwt.sign(
        { sub: user.id, email: user.email },
        { expiresIn: "30d" }
      );

      return reply.send({
        token,
        user: toAuthUser(user),
      });
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
