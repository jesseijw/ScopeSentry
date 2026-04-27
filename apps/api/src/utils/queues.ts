import { Queue } from "bullmq";
import { getBullMQRedis } from "./redis";

export interface DriftJobData {
  projectId: string;
  slackMessageTs: string;
  channelId: string;
  senderUserId: string;
  text: string;
}

export interface NotificationJobData {
  userId: string;
  kind: "DRIFT_DETECTED" | "CLIENT_ACCEPTED" | "CLIENT_REQUESTED_CHANGES" | "REMINDER";
  payload: Record<string, unknown>;
  notificationId?: string;
}

let driftQueueInstance: Queue<DriftJobData> | null = null;
let notificationQueueInstance: Queue<NotificationJobData> | null = null;

export function getDriftQueue(): Queue<DriftJobData> {
  if (!driftQueueInstance) {
    driftQueueInstance = new Queue<DriftJobData>("drift", {
      connection: getBullMQRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return driftQueueInstance;
}

export function getNotificationQueue(): Queue<NotificationJobData> {
  if (!notificationQueueInstance) {
    notificationQueueInstance = new Queue<NotificationJobData>("notifications", {
      connection: getBullMQRedis(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return notificationQueueInstance;
}
