import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

export const checkQueue = new Queue('website-checks', { connection: redis });
