import { WebClient } from "@slack/web-api";
import { decryptFromBytes } from "../utils/crypto";

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_im: boolean;
  num_members?: number;
}

export interface QuoteLineItem {
  description: string;
  hours: number;
  rateCents: number;
  totalCents: number;
}

function formatCents(cents: number | bigint): string {
  const num = typeof cents === "bigint" ? Number(cents) : cents;
  return `$${(num / 100).toFixed(2)}`;
}

export function getSlackClient(encryptedToken: Buffer | Uint8Array): WebClient {
  const token = decryptFromBytes(Buffer.from(encryptedToken));
  return new WebClient(token);
}

export async function listWorkspaceChannels(
  encryptedToken: Buffer | Uint8Array
): Promise<SlackChannel[]> {
  const client = getSlackClient(encryptedToken);
  const channels: SlackChannel[] = [];

  // Public channels
  let cursor: string | undefined;
  do {
    const resp = await client.conversations.list({
      types: "public_channel,private_channel,im,mpim",
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    if (resp.channels) {
      channels.push(
        ...resp.channels.map((c) => ({
          id: c.id!,
          name: c.name || c.id!,
          is_private: c.is_private ?? false,
          is_im: (c as any).is_im ?? false,
          num_members: (c as any).num_members,
        }))
      );
    }
    cursor = (resp.response_metadata as any)?.next_cursor || undefined;
  } while (cursor);

  return channels;
}

export async function fetchChannelHistory(
  encryptedToken: Buffer | Uint8Array,
  channelId: string,
  oldest: string // Unix timestamp string
): Promise<Array<{ ts: string; user: string; text: string }>> {
  const client = getSlackClient(encryptedToken);
  const messages: Array<{ ts: string; user: string; text: string }> = [];
  let cursor: string | undefined;

  do {
    const resp = await client.conversations.history({
      channel: channelId,
      oldest,
      limit: 200,
      cursor,
    });

    if (resp.messages) {
      for (const m of resp.messages) {
        if (m.ts && m.user && m.text && m.type === "message" && !m.bot_id) {
          messages.push({ ts: m.ts, user: m.user, text: m.text });
        }
      }
    }

    cursor = (resp.response_metadata as any)?.next_cursor || undefined;
  } while (cursor);

  return messages;
}

export async function postQuoteToThread(
  encryptedToken: Buffer | Uint8Array,
  channelId: string,
  lineItems: QuoteLineItem[],
  totalCents: number | bigint,
  subtotalCents: number | bigint,
  rationale: string,
  timelineImpactDays: number,
  clientUrl: string,
  projectTitle: string,
  sourceMessageTs?: string
): Promise<{ ts: string; permalink: string }> {
  const client = getSlackClient(encryptedToken);

  const lineItemsText = lineItems
    .map(
      (li, i) =>
        `${i + 1}. *${li.description}* — ${li.hours}h × ${formatCents(li.rateCents)}/hr = *${formatCents(li.totalCents)}*`
    )
    .join("\n");

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📋 Change Order — ${projectTitle}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: rationale,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Line Items:*\n${lineItemsText}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Subtotal:* ${formatCents(subtotalCents)}`,
        },
        {
          type: "mrkdwn",
          text: `*Total:* ${formatCents(totalCents)}`,
        },
        {
          type: "mrkdwn",
          text: `*Timeline Impact:* +${timelineImpactDays} day${timelineImpactDays !== 1 ? "s" : ""}`,
        },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Please review and acknowledge this change order:`,
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "Review & Acknowledge" },
        url: clientUrl,
        action_id: "review_quote",
        style: "primary",
      },
    },
  ];

  const resp = await client.chat.postMessage({
    channel: channelId,
    thread_ts: sourceMessageTs,
    text: `Change Order: ${formatCents(totalCents)} — ${projectTitle}`,
    blocks,
  });

  const ts = resp.ts!;

  // Get permalink
  const permalinkResp = await client.chat.getPermalink({
    channel: channelId,
    message_ts: ts,
  });

  return {
    ts,
    permalink: (permalinkResp as any).permalink || "",
  };
}

export async function postConfirmationToThread(
  encryptedToken: Buffer | Uint8Array,
  channelId: string,
  status: "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED",
  clientComment?: string,
  threadTs?: string
): Promise<void> {
  const client = getSlackClient(encryptedToken);

  let text: string;
  if (status === "ACCEPTED") {
    text = "✅ *Change order accepted.* The scope has been updated accordingly.";
  } else if (status === "REJECTED") {
    text = "❌ *Change order declined.*";
  } else {
    text = `💬 *Client requested changes:* ${clientComment || "(no comment)"}`;
  }

  await client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text,
  });
}

export async function getSlackUserInfo(
  encryptedToken: Buffer | Uint8Array,
  userId: string
): Promise<{ email?: string; display_name?: string }> {
  const client = getSlackClient(encryptedToken);
  const resp = await client.users.info({ user: userId });
  return {
    email: resp.user?.profile?.email,
    display_name:
      resp.user?.profile?.display_name || resp.user?.real_name || userId,
  };
}
