import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getPrisma } from "../utils/prisma";
import { requireAuth } from "../middleware/auth";
import { parseScope } from "@scopesentry/nlp";
import { embedBatch } from "@scopesentry/nlp";
import { ScopeItemKind } from "@scopesentry/shared";
import { Decimal } from "@prisma/client/runtime/library";

// Text extraction helpers
async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string,
  filename: string
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (mimetype === "application/pdf" || ext === "pdf") {
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // MD, TXT, or any other text format
  return buffer.toString("utf-8");
}

function kindToScopeItemKind(kind: string): ScopeItemKind {
  if (kind === "out_of_scope") return ScopeItemKind.OUT_OF_SCOPE;
  if (kind === "assumption") return ScopeItemKind.ASSUMPTION;
  return ScopeItemKind.DELIVERABLE;
}

export async function scopeRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // POST /projects/:id/scope
  fastify.post(
    "/projects/:id/scope",
    { preHandler: requireAuth },
    async (request: any, reply: any) => {
      const project = await prisma.project.findFirst({
        where: { id: request.params.id, userId: request.userId },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      let rawText: string;

      // Check if multipart
      const contentType = request.headers["content-type"] || "";
      if (contentType.includes("multipart/form-data")) {
        const data = await request.file();
        if (!data) {
          return reply.status(400).send({ error: "No file uploaded" });
        }
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        rawText = await extractTextFromBuffer(
          buffer,
          data.mimetype,
          data.filename
        );
      } else {
        // JSON body with text field
        const body = request.body as { text?: string };
        if (!body?.text) {
          return reply
            .status(400)
            .send({ error: "Either upload a file or provide { text: string }" });
        }
        rawText = body.text;
      }

      if (!rawText.trim()) {
        return reply.status(400).send({ error: "Empty document — nothing to parse" });
      }

      // Parse scope with NLP. The parser has a local fallback for development.
      let parsed;
      try {
        parsed = await parseScope(rawText);
      } catch (err) {
        fastify.log.error({ err }, "Scope parsing failed");
        return reply.status(500).send({
          error: "Scope parsing failed",
          message: err instanceof Error ? err.message : "Could not parse scope",
        });
      }

      // Get current version number
      const existingScopes = await prisma.scope.findMany({
        where: { projectId: project.id },
        orderBy: { version: "desc" },
        take: 1,
      });
      const nextVersion = (existingScopes[0]?.version ?? 0) + 1;

      // Create scope record
      const scope = await prisma.scope.create({
        data: {
          projectId: project.id,
          version: nextVersion,
          summary: parsed.scope_summary,
          estimatedHours: new Decimal(parsed.estimated_hours),
        },
      });

      // Collect all items for embedding
      const allItems: { description: string; kind: ScopeItemKind }[] = [
        ...parsed.deliverables.map((d) => ({
          description: d,
          kind: ScopeItemKind.DELIVERABLE,
        })),
        ...parsed.out_of_scope.map((o) => ({
          description: o,
          kind: ScopeItemKind.OUT_OF_SCOPE,
        })),
        ...parsed.assumptions.map((a) => ({
          description: a,
          kind: ScopeItemKind.ASSUMPTION,
        })),
      ];

      // Create scope items in DB first
      const createdItems = await prisma.$transaction(
        allItems.map((item) =>
          prisma.scopeItem.create({
            data: {
              scopeId: scope.id,
              kind: item.kind,
              description: item.description,
            },
          })
        )
      );

      // Generate embeddings in batch. Embeddings improve drift matching, but
      // scope creation should still succeed during local development if the
      // embedding provider is not configured.
      if (createdItems.length > 0) {
        try {
          const texts = allItems.map((item) => item.description);
          const embeddings = await embedBatch(texts);

          // Store embeddings using raw SQL (pgvector)
          for (let i = 0; i < createdItems.length; i++) {
            const embedding = embeddings[i];
            const vectorStr = `[${embedding.join(",")}]`;
            await prisma.$executeRaw`
              UPDATE scope_items
              SET embedding = ${vectorStr}::vector
              WHERE id = ${createdItems[i].id}
            `;
          }
        } catch (err) {
          fastify.log.warn({ err }, "Scope embedding failed; continuing without embeddings");
        }
      }

      // Return parsed scope for freelancer confirmation
      const fullScope = await prisma.scope.findUnique({
        where: { id: scope.id },
        include: { scopeItems: true },
      });

      return reply.status(201).send({
        scope: fullScope,
        parsed: {
          ...parsed,
          itemCount: createdItems.length,
        },
      });
    }
  );

  // PATCH /projects/:id/scope/:scopeId
  fastify.patch(
    "/projects/:id/scope/:scopeId",
    { preHandler: requireAuth },
    async (request: any, reply: any) => {
      const project = await prisma.project.findFirst({
        where: { id: request.params.id, userId: request.userId },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const existingScope = await prisma.scope.findFirst({
        where: { id: request.params.scopeId, projectId: project.id },
        include: { scopeItems: true },
      });

      if (!existingScope) {
        return reply.status(404).send({ error: "Scope not found" });
      }

      const body = request.body as {
        summary?: string;
        estimatedHours?: number;
        items?: Array<{
          id?: string;
          kind: string;
          description: string;
        }>;
      };

      // Create new version of scope
      const newScope = await prisma.scope.create({
        data: {
          projectId: project.id,
          version: existingScope.version + 1,
          summary: body.summary ?? existingScope.summary,
          estimatedHours: body.estimatedHours
            ? new Decimal(body.estimatedHours)
            : existingScope.estimatedHours,
        },
      });

      if (body.items && body.items.length > 0) {
        const createdItems = await prisma.$transaction(
          body.items.map((item) =>
            prisma.scopeItem.create({
              data: {
                scopeId: newScope.id,
                kind: kindToScopeItemKind(item.kind),
                description: item.description,
              },
            })
          )
        );

        // Re-embed new items
        const texts = body.items.map((i) => i.description);
        const embeddings = await embedBatch(texts);

        for (let i = 0; i < createdItems.length; i++) {
          const vectorStr = `[${embeddings[i].join(",")}]`;
          await prisma.$executeRaw`
            UPDATE scope_items
            SET embedding = ${vectorStr}::vector
            WHERE id = ${createdItems[i].id}
          `;
        }
      }

      const fullScope = await prisma.scope.findUnique({
        where: { id: newScope.id },
        include: { scopeItems: true },
      });

      return reply.send({ scope: fullScope });
    }
  );
}
