import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { pool } from '../db/index.js';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 10000);

const worker = new Worker(
  'website-checks',
  async (job) => {
    const { websiteId, url } = job.data as { websiteId: number; url: string };
    const started = Date.now();
    let statusCode: number | null = null;
    let ok = false;
    let error: string | null = null;

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'DistributedWebsiteMonitor/1.0' }
      });
      statusCode = response.status;
      ok = response.ok;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const responseTimeMs = Date.now() - started;
    await pool.query(
      `INSERT INTO checks (website_id, status_code, response_time_ms, ok, error)
       VALUES ($1, $2, $3, $4, $5)`,
      [websiteId, statusCode, responseTimeMs, ok, error]
    );

    return { websiteId, url, statusCode, responseTimeMs, ok, error };
  },
  { connection, concurrency: 5 }
);

worker.on('completed', (job, result) => {
  console.log(`[worker ${process.pid}] completed ${job.id}:`, result.url, result.statusCode, `${result.responseTimeMs}ms`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker ${process.pid}] failed ${job?.id}:`, err.message);
});

console.log(`[worker ${process.pid}] ready`);
