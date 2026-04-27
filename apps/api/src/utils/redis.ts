import IORedis from "ioredis";

let redisInstance: IORedis | null = null;
let bullMQRedisInstance: IORedis | null = null;

export function getRedis(): IORedis {
  if (!redisInstance) {
    redisInstance = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redisInstance;
}

/**
 * BullMQ requires maxRetriesPerRequest: null to work correctly
 */
export function getBullMQRedis(): IORedis {
  if (!bullMQRedisInstance) {
    bullMQRedisInstance = new IORedis(
      process.env.REDIS_URL || "redis://localhost:6379",
      {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }
    );
  }
  return bullMQRedisInstance;
}
