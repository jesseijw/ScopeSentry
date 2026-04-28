import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const PROMPT_PATH = path.join(__dirname, "../prompts/scope-parser.txt");

export interface ParsedScope {
  deliverables: string[];
  out_of_scope: string[];
  assumptions: string[];
  scope_summary: string;
  estimated_hours: number;
  timeline: string;
}

const extractScopeTool: Anthropic.Tool = {
  name: "extract_scope",
  description:
    "Extract structured scope information from a scope of work document",
  input_schema: {
    type: "object" as const,
    properties: {
      deliverables: {
        type: "array",
        items: { type: "string" },
        description: "List of concrete deliverables the freelancer will provide",
      },
      out_of_scope: {
        type: "array",
        items: { type: "string" },
        description: "Items explicitly excluded from this engagement",
      },
      assumptions: {
        type: "array",
        items: { type: "string" },
        description: "Conditions assumed to be true for this scope to hold",
      },
      scope_summary: {
        type: "string",
        description:
          "A concise 2-3 sentence summary of the project scope for context",
      },
      estimated_hours: {
        type: "number",
        description:
          "Realistic total estimated hours to complete all deliverables",
      },
      timeline: {
        type: "string",
        description:
          "Estimated timeline (e.g. '4 weeks', '2 months') to complete the work",
      },
    },
    required: [
      "deliverables",
      "out_of_scope",
      "assumptions",
      "scope_summary",
      "estimated_hours",
      "timeline",
    ],
  },
};

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function getSystemPrompt(): string {
  try {
    return fs.readFileSync(PROMPT_PATH, "utf-8");
  } catch {
    return `You are a contract analyst. Given a scope of work document, extract the following as JSON using the extract_scope tool. Be precise. Only include items explicitly stated. Do not infer deliverables not mentioned.`;
  }
}

/**
 * Parse a raw scope document text into structured scope items
 * Uses Claude claude-sonnet-4-6 with tool use for structured output
 */
export async function parseScope(rawText: string): Promise<ParsedScope> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return parseScopeLocally(rawText);
  }

  const client = getAnthropic();
  const systemPrompt = getSystemPrompt();

  let response: any;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: [extractScopeTool],
      tool_choice: { type: "any" },
      messages: [
        {
          role: "user",
          content: `Please analyze this scope of work document and extract the structured scope information:\n\n${rawText}`,
        },
      ],
    });
  } catch (err) {
    console.warn("Claude scope parsing failed; using local parser fallback", err);
    return parseScopeLocally(rawText);
  }

  // Find the tool use block
  const toolUse = response.content.find(
    (block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use"
  );

  if (!toolUse || toolUse.name !== "extract_scope") {
    throw new Error("Claude did not return structured scope output");
  }

  const result = toolUse.input as ParsedScope;

  // Validate required fields
  if (
    !result.deliverables ||
    !result.scope_summary ||
    result.estimated_hours === undefined
  ) {
    throw new Error("Incomplete scope extraction from Claude");
  }

  return result;
}

function parseScopeLocally(rawText: string): ParsedScope {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);

  const deliverables: string[] = [];
  const out_of_scope: string[] = [];
  const assumptions: string[] = [];
  let current: "deliverables" | "out_of_scope" | "assumptions" = "deliverables";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("out of scope") || lower.includes("excluded") || lower.includes("exclusions")) {
      current = "out_of_scope";
      continue;
    }
    if (lower.includes("assumption") || lower.includes("assumptions")) {
      current = "assumptions";
      continue;
    }
    if (lower.includes("deliverable") || lower.includes("scope") || lower.includes("services")) {
      current = "deliverables";
      continue;
    }

    if (line.length < 4) continue;
    if (current === "out_of_scope") out_of_scope.push(line);
    else if (current === "assumptions") assumptions.push(line);
    else deliverables.push(line);
  }

  const fallbackDeliverables = deliverables.length > 0 ? deliverables : lines.slice(0, 8);
  const summarySource = rawText.replace(/\s+/g, " ").trim();

  return {
    deliverables: fallbackDeliverables.slice(0, 20),
    out_of_scope: out_of_scope.slice(0, 20),
    assumptions: assumptions.slice(0, 20),
    scope_summary: summarySource.slice(0, 280) || "Scope document imported for review.",
    estimated_hours: Math.max(1, Math.ceil(fallbackDeliverables.length * 4)),
    timeline: "To be confirmed",
  };
}
