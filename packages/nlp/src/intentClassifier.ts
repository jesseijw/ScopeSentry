import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { IntentCategory } from "@scopesentry/shared";

const PROMPT_PATH = path.join(__dirname, "../prompts/intent-classifier.txt");

export interface IntentClassification {
  category: IntentCategory;
  confidence: number;
  reasoning: string;
}

const classifyIntentTool: Anthropic.Tool = {
  name: "classify_intent",
  description: "Classify the intent of a Slack message in a project context",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        enum: [
          "CLARIFICATION",
          "EXPANSION",
          "MODIFICATION",
          "UPDATE",
          "APPROVAL",
        ],
        description: "The intent category of the message",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "Confidence score from 0.0 to 1.0 for the classification",
      },
      reasoning: {
        type: "string",
        description:
          "Brief explanation of why this category was chosen (1-2 sentences)",
      },
    },
    required: ["category", "confidence", "reasoning"],
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
    return `You are analyzing a Slack message in the context of a freelance project. Classify the message intent using the classify_intent tool. Be conservative — only classify as EXPANSION or MODIFICATION if there is clear evidence.`;
  }
}

/**
 * Classify the intent of a Slack message given project context
 * Uses Claude claude-sonnet-4-6 with structured tool output
 */
export async function classifyIntent(
  messageText: string,
  projectContextSummary: string
): Promise<IntentClassification> {
  const client = getAnthropic();
  const systemPrompt = getSystemPrompt();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    tools: [classifyIntentTool],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: `Project Context:
${projectContextSummary}

Slack Message to classify:
"${messageText}"

Please classify this message's intent.`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse || toolUse.name !== "classify_intent") {
    throw new Error("Claude did not return intent classification");
  }

  const result = toolUse.input as {
    category: string;
    confidence: number;
    reasoning: string;
  };

  return {
    category: result.category as IntentCategory,
    confidence: result.confidence,
    reasoning: result.reasoning,
  };
}

/**
 * Generate an effort estimate for a scope change request
 * Returns line items with hours for quote generation
 */
export interface EffortLineItem {
  description: string;
  hours: number;
}

const estimateEffortTool: Anthropic.Tool = {
  name: "estimate_effort",
  description:
    "Estimate the effort required for a scope change request as line items",
  input_schema: {
    type: "object" as const,
    properties: {
      lineItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description: "Plain-language description of this work item",
            },
            hours: {
              type: "number",
              description: "Estimated hours for this line item",
            },
          },
          required: ["description", "hours"],
        },
        minItems: 1,
        maxItems: 5,
        description: "1-5 line items breaking down the scope change effort",
      },
      overallRationale: {
        type: "string",
        description:
          "Brief explanation of the estimate and key assumptions made",
      },
    },
    required: ["lineItems", "overallRationale"],
  },
};

const EFFORT_PROMPT_PATH = path.join(
  __dirname,
  "../prompts/effort-estimator.txt"
);

function getEffortSystemPrompt(): string {
  try {
    return fs.readFileSync(EFFORT_PROMPT_PATH, "utf-8");
  } catch {
    return `You are estimating the additional effort required for a scope change request. Break down the work into 1-5 specific line items. Use the estimate_effort tool to return your structured estimate.`;
  }
}

export async function estimateEffort(
  requestText: string,
  projectContextSummary: string,
  scopeSummary: string
): Promise<{ lineItems: EffortLineItem[]; overallRationale: string }> {
  const client = getAnthropic();
  const systemPrompt = getEffortSystemPrompt();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    tools: [estimateEffortTool],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: `Project Context: ${projectContextSummary}

Current Scope Summary: ${scopeSummary}

Client's Change Request:
"${requestText}"

Please estimate the effort required for this scope change.`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse || toolUse.name !== "estimate_effort") {
    throw new Error("Claude did not return effort estimate");
  }

  return toolUse.input as {
    lineItems: EffortLineItem[];
    overallRationale: string;
  };
}
