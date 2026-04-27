import { Worker, Job } from "bullmq";
import { getBullMQRedis } from "../utils/redis";
import { getPrisma } from "../utils/prisma";
import { NotificationJobData } from "../utils/queues";
import { sendApnsPush } from "../services/notifications";

export function startNotificationWorker(): Worker<NotificationJobData> {
  const prisma = getPrisma();

  const worker = new Worker<NotificationJobData>(
    "notifications",
    async (job: Job<NotificationJobData>) => {
      const { userId, kind, payload, notificationId } = job.data;

      // Idempotency: check if already delivered
      if (notificationId) {
        const existing = await prisma.notification.findFirst({
          where: { id: notificationId, deliveredAt: { not: null } },
        });
        if (existing) return;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;

      let title: string;
      let body: string;

      switch (kind) {
        case "DRIFT_DETECTED": {
          const totalCents = payload.draftTotal as number;
          const total = totalCents ? `$${(totalCents / 100).toFixed(2)}` : "draft";
          title = `Scope drift detected — ${payload.projectTitle}`;
          body = `Draft quote: ${total}. Tap to review.`;
          break;
        }
        case "CLIENT_ACCEPTED": {
          title = "Change order accepted ✅";
          body = `${payload.clientName} accepted the quote for "${payload.projectTitle}"`;
          break;
        }
        case "CLIENT_REQUESTED_CHANGES": {
          title = "Client requested changes";
          body = `${payload.clientName}: "${String(payload.feedback || "").slice(0, 80)}"`;
          break;
        }
        case "REMINDER": {
          title = payload.title as string || "Reminder — action needed";
          body = payload.message as string || "A quote is waiting for your review.";
          break;
        }
        default:
          return;
      }

      // Send APNs push
      if (user.apnsDeviceToken) {
        try {
          await sendApnsPush(user.apnsDeviceToken, title, body, {
            kind,
            ...payload,
          });
        } catch (err) {
          console.warn("APNs delivery failed:", err);
          // Don't throw — we still persist the notification record
        }
      }

      // Create or update notification record
      if (notificationId) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { deliveredAt: new Date() },
        });
      } else {
        await prisma.notification.create({
          data: {
            userId,
            kind: kind as any,
            payloadJson: payload,
            deliveredAt: new Date(),
          },
        });
      }
    },
    {
      connection: getBullMQRedis(),
      concurrency: 10,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`Notification worker job ${job?.id} failed:`, err);
  });

  return worker;
}
