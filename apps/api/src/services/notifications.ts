import * as http2 from "http2";
import * as fs from "fs";
import * as jwt from "jsonwebtoken";
import * as path from "path";

// ─── APNs ────────────────────────────────────────────────────────────────────

let apnsToken: string | null = null;
let apnsTokenExpiry: number = 0;

function getApnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (apnsToken && apnsTokenExpiry > now + 60) {
    return apnsToken;
  }

  const keyPath = process.env.APNS_KEY_PATH;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;

  if (!keyPath || !keyId || !teamId) {
    throw new Error("APNs configuration missing: APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID required");
  }

  const key = fs.readFileSync(path.resolve(keyPath));
  apnsToken = jwt.sign({}, key, {
    algorithm: "ES256",
    keyid: keyId,
    issuer: teamId,
    expiresIn: "1h",
  });
  apnsTokenExpiry = now + 3600;
  return apnsToken;
}

export async function sendApnsPush(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const bundleId = process.env.APNS_BUNDLE_ID || "com.scopesentry.app";
  const isProduction = process.env.NODE_ENV === "production";
  const host = isProduction
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";

  const token = getApnsJwt();

  const payload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: "default",
      badge: 1,
    },
    ...data,
  });

  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${host}`);

    client.on("error", reject);

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      authorization: `bearer ${token}`,
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload).toString(),
    });

    let statusCode = 0;
    let responseBody = "";

    req.on("response", (headers) => {
      statusCode = headers[":status"] as number;
    });

    req.on("data", (chunk) => {
      responseBody += chunk;
    });

    req.on("end", () => {
      client.close();
      if (statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`APNs error ${statusCode}: ${responseBody}`));
      }
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ─── SendGrid ─────────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY not set — skipping email");
    return;
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@scopesentry.app";

  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: "ScopeSentry" },
      subject,
      content: [
        ...(text ? [{ type: "text/plain", value: text }] : []),
        { type: "text/html", value: html },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`SendGrid error ${resp.status}: ${err}`);
  }
}

export function buildQuoteEmailHtml(
  clientName: string,
  projectTitle: string,
  rationale: string,
  lineItems: Array<{ description: string; hours: number; rateCents: number; totalCents: number }>,
  totalCents: number | bigint,
  timelineImpactDays: number,
  clientUrl: string
): string {
  const total = typeof totalCents === "bigint" ? Number(totalCents) : totalCents;

  const rows = lineItems
    .map(
      (li) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${li.description}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${li.hours}h</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(li.rateCents / 100).toFixed(2)}/hr</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">$${(li.totalCents / 100).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Change Order — ${projectTitle}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <div style="background:#4F46E5;color:white;padding:20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:20px">Change Order Request</h1>
    <p style="margin:4px 0 0;opacity:0.8">Project: ${projectTitle}</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px">
    <p style="color:#374151">${rationale}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">Description</th>
          <th style="padding:8px;text-align:center;border-bottom:2px solid #e5e7eb">Hours</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #e5e7eb">Rate</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #e5e7eb">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:12px 8px;text-align:right;font-weight:bold">Total:</td>
          <td style="padding:12px 8px;text-align:right;font-weight:bold;font-size:18px">$${(total / 100).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <p style="color:#6b7280;font-size:14px">⏱ Timeline impact: +${timelineImpactDays} day${timelineImpactDays !== 1 ? "s" : ""}</p>
    <div style="text-align:center;margin-top:24px">
      <a href="${clientUrl}" style="background:#4F46E5;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">
        Review &amp; Acknowledge
      </a>
    </div>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;text-align:center">
      This link expires in 14 days. Powered by ScopeSentry.
    </p>
  </div>
</body>
</html>`;
}
