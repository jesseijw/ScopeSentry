import Anthropic from "@anthropic-ai/sdk";
import { getPrisma } from "../utils/prisma";
import {
  scaleLineItems,
  addLineItem,
  removeLineItem,
  mergeLineItems,
  BuiltLineItem,
} from "@scopesentry/nlp";
import { PricingTier } from "@scopesentry/shared";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tool definitions ─────────────────────────────────────────────────────────

const QUOTE_CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "adjust_pricing",
    description: "Scale all line items by a factor (e.g., 0.8 for 20% off)",
    input_schema: {
      type: "object" as const,
      properties: {
        factor: { type: "number", description: "Multiplier, e.g. 0.85 = 15% off, 1.1 = 10% more" },
        reason: { type: "string", description: "Human-readable reason for the change" },
      },
      required: ["factor"],
    },
  },
  {
    name: "add_line_item",
    description: "Add a new line item to the quote",
    input_schema: {
      type: "object" as const,
      properties: {
        description: { type: "string" },
        hours: { type: "number" },
        reason: { type: "string" },
      },
      required: ["description", "hours"],
    },
  },
  {
    name: "remove_line_item",
    description: "Remove a line item by its 0-based index",
    input_schema: {
      type: "object" as const,
      properties: {
        index: { type: "number", description: "0-based index of the line item to remove" },
        reason: { type: "string" },
      },
      required: ["index"],
    },
  },
  {
    name: "merge_line_items",
    description: "Merge multiple line items into one combined item",
    input_schema: {
      type: "object" as const,
      properties: {
        indices: {
          type: "array",
          items: { type: "number" },
          description: "0-based indices of items to merge",
        },
        merged_description: { type: "string", description: "Description for the merged item" },
      },
      required: ["indices", "merged_description"],
    },
  },
  {
    name: "update_timeline",
    description: "Update the timeline impact in days",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "New timeline impact in days" },
        reason: { type: "string" },
      },
      required: ["days"],
    },
  },
  {
    name: "regenerate_rationale",
    description: "Rewrite the quote rationale with a different tone",
    input_schema: {
      type: "object" as const,
      properties: {
        tone: {
          type: "string",
          enum: ["friendly", "formal", "concise"],
          description: "Desired tone",
        },
        original_rationale: { type: "string", description: "The current rationale text" },
      },
      required: ["tone"],
    },
  },
  {
    name: "revert",
    description: "Revert to the previous quote version",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "no_change",
    description: "Respond without making any changes to the quote",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Explanation or clarification to the user" },
      },
      required: ["message"],
    },
  },
];

// ─── Regenerate rationale via Claude ─────────────────────────────────────────

async function regenerateRationale(
  originalRationale: string,
  tone: "friendly" | "formal" | "concise"
): Promise<string> {
  const toneInstructions: Record<string, string> = {
    friendly: "warm, conversational, and approachable",
    formal: "professional and business-like",
    concise: "brief and to-the-point, one or two sentences",
  };

  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Rewrite this change order rationale in a ${toneInstructions[tone]} tone. Keep the core information intact but adjust the style.\n\nOriginal:\n${originalRationale}\n\nRewritten rationale (just the text, no preamble):`,
      },
    ],
  });

  const block = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return block?.text || originalRationale;
}

// ─── Main quote chat handler ──────────────────────────────────────────────────

export interface QuoteChatResult {
  assistantMessage: string;
  updatedVersion: {
    id: string;
    versionNumber: number;
    lineItemsJson: BuiltLineItem[];
    subtotalCents: bigint;
    totalCents: bigint;
    timelineImpactDays: number;
    rationale: string;
    createdAt: Date;
  } | null;
  changed: boolean;
}

export async function processQuoteChatMessage(
  quoteId: string,
  userId: string,
  userMessage: string
): Promise<QuoteChatResult> {
  const prisma = getPrisma();

  // Load quote with project and current version
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, project: { userId } },
    include: {
      project: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      chatTurns: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!quote) throw new Error("Quote not found");

  const currentVersion = quote.versions[0];
  if (!currentVersion) throw new Error("No quote version found");

  // Build conversation history
  const messages: Anthropic.MessageParam[] = [];

  // Include prior chat turns
  for (const turn of quote.chatTurns) {
    if (turn.role === "USER") {
      messages.push({ role: "user", content: (turn.content as any).text || "" });
    } else if (turn.role === "ASSISTANT") {
      messages.push({ role: "assistant", content: (turn.content as any).text || "" });
    }
  }

  // Add current user message
  messages.push({ role: "user", content: userMessage });

  const lineItems = currentVersion.lineItemsJson as BuiltLineItem[];
  const tier = quote.project.pricingTier as PricingTier;

  const systemPrompt = `You are ScopeSentry's quote assistant, helping a freelancer refine a change order quote before sending it to their client.

Current quote:
- Line items: ${JSON.stringify(lineItems, null, 2)}
- Subtotal: $${(Number(currentVersion.subtotalCents) / 100).toFixed(2)}
- Total: $${(Number(currentVersion.totalCents) / 100).toFixed(2)}
- Timeline impact: ${currentVersion.timelineImpactDays} days
- Rationale: "${currentVersion.rationale}"
- Pricing tier: ${tier}

Use the available tools to modify the quote based on the freelancer's request. Be precise:
- "drop by 15%" → adjust_pricing with factor 0.85
- "remove the third line item" → remove_line_item with index 2
- "revert" → use the revert tool
- If no change is needed, use no_change tool.

Always use a tool. Don't just reply with text.`;

  // LLM call with tool use
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    tools: QUOTE_CHAT_TOOLS,
    tool_choice: { type: "any" },
    messages,
  });

  // Store user turn
  await prisma.quoteChatTurn.create({
    data: {
      quoteId,
      role: "USER",
      content: { text: userMessage },
    },
  });

  // Process tool call
  const toolUse = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  if (!toolUse) {
    // No tool — just store response
    const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const assistantText = textBlock?.text || "I'm not sure how to help with that.";

    await prisma.quoteChatTurn.create({
      data: { quoteId, role: "ASSISTANT", content: { text: assistantText } },
    });

    return { assistantMessage: assistantText, updatedVersion: null, changed: false };
  }

  const toolInput = toolUse.input as Record<string, any>;
  let newLineItems = [...lineItems];
  let newTimeline = currentVersion.timelineImpactDays;
  let newRationale = currentVersion.rationale;
  let changed = true;
  let assistantMessage = "";

  // Handle revert separately
  if (toolUse.name === "revert") {
    const allVersions = await prisma.quoteVersion.findMany({
      where: { quoteId },
      orderBy: { versionNumber: "desc" },
    });

    if (allVersions.length < 2) {
      assistantMessage = "There's no previous version to revert to.";
      changed = false;
    } else {
      const prev = allVersions[1];
      await prisma.quoteChatTurn.create({
        data: { quoteId, role: "ASSISTANT", content: { text: "Reverted to previous version." } },
      });

      await prisma.quote.update({
        where: { id: quoteId },
        data: { currentVersionId: prev.id },
      });

      return {
        assistantMessage: "Reverted to the previous version.",
        updatedVersion: {
          ...prev,
          lineItemsJson: prev.lineItemsJson as BuiltLineItem[],
        },
        changed: true,
      };
    }
  } else if (toolUse.name === "no_change") {
    assistantMessage = toolInput.message || "No changes made.";
    changed = false;
  } else if (toolUse.name === "adjust_pricing") {
    newLineItems = scaleLineItems(newLineItems, toolInput.factor, tier);
    assistantMessage = toolInput.reason || `Adjusted all prices by ${(toolInput.factor * 100 - 100).toFixed(0)}%.`;
  } else if (toolUse.name === "add_line_item") {
    newLineItems = addLineItem(newLineItems, toolInput.description, toolInput.hours, tier);
    assistantMessage = toolInput.reason || `Added "${toolInput.description}" (${toolInput.hours}h).`;
  } else if (toolUse.name === "remove_line_item") {
    newLineItems = removeLineItem(newLineItems, toolInput.index);
    assistantMessage = toolInput.reason || `Removed line item ${toolInput.index + 1}.`;
  } else if (toolUse.name === "merge_line_items") {
    newLineItems = mergeLineItems(newLineItems, toolInput.indices, toolInput.merged_description);
    assistantMessage = `Merged items into "${toolInput.merged_description}".`;
  } else if (toolUse.name === "update_timeline") {
    newTimeline = toolInput.days;
    assistantMessage = toolInput.reason || `Updated timeline impact to ${toolInput.days} days.`;
  } else if (toolUse.name === "regenerate_rationale") {
    const tone = toolInput.tone as "friendly" | "formal" | "concise";
    newRationale = await regenerateRationale(
      toolInput.original_rationale || currentVersion.rationale,
      tone
    );
    assistantMessage = `Rewritten in a ${tone} tone.`;
  }

  // Store assistant turn
  await prisma.quoteChatTurn.create({
    data: { quoteId, role: "ASSISTANT", content: { text: assistantMessage } },
  });

  if (!changed) {
    return { assistantMessage, updatedVersion: null, changed: false };
  }

  // Compute new totals
  const newSubtotal = newLineItems.reduce((s, li) => s + li.totalCents, 0);
  const newTotal = newSubtotal;

  // Create new version
  const newVersionNumber = currentVersion.versionNumber + 1;
  const newVersion = await prisma.quoteVersion.create({
    data: {
      quoteId,
      versionNumber: newVersionNumber,
      lineItemsJson: newLineItems,
      subtotalCents: BigInt(newSubtotal),
      totalCents: BigInt(newTotal),
      timelineImpactDays: newTimeline,
      rationale: newRationale,
    },
  });

  // Update quote's current version
  await prisma.quote.update({
    where: { id: quoteId },
    data: { currentVersionId: newVersion.id },
  });

  return {
    assistantMessage,
    updatedVersion: {
      ...newVersion,
      lineItemsJson: newVersion.lineItemsJson as BuiltLineItem[],
    },
    changed: true,
  };
}
