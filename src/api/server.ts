import express from 'express';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { checkQueue } from '../queue/index.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use(express.static('public'));

const websiteSchema = z.object({
  url: z.string().url()
});

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.get('/api/websites', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT w.*,
      c.ok AS last_ok,
      c.status_code AS last_status_code,
      c.response_time_ms AS last_response_time_ms,
      c.error AS last_error,
      c.checked_at AS last_checked_at
    FROM websites w
    LEFT JOIN LATERAL (
      SELECT * FROM checks c
      WHERE c.website_id = w.id
      ORDER BY c.checked_at DESC
      LIMIT 1
    ) c ON TRUE
    ORDER BY w.id DESC
  `);
  res.json(rows);
});

app.post('/api/websites', async (req, res) => {
  const parsed = websiteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valid URL required' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO websites (url) VALUES ($1) RETURNING *',
      [parsed.data.url]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Website already exists' });
    throw e;
  }
});

app.delete('/api/websites/:id', async (req, res) => {
  await pool.query('DELETE FROM websites WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

app.post('/api/check/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT id, url FROM websites WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Website not found' });

  const job = await checkQueue.add('check-website', { websiteId: rows[0].id, url: rows[0].url }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 1000
  });
  res.status(202).json({ jobId: job.id });
});

app.post('/api/check-all', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, url FROM websites WHERE enabled = TRUE ORDER BY id');
  const jobs = rows.map((w) => ({
    name: 'check-website',
    data: { websiteId: w.id, url: w.url },
    opts: { attempts: 3, backoff: { type: 'exponential' as const, delay: 1000 }, removeOnComplete: 1000, removeOnFail: 1000 }
  }));
  if (jobs.length) await checkQueue.addBulk(jobs);
  res.status(202).json({ queued: jobs.length });
});

app.get('/api/stats', async (_req, res) => {
  const { rows } = await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (website_id) website_id, ok, response_time_ms
      FROM checks ORDER BY website_id, checked_at DESC
    )
    SELECT
      (SELECT COUNT(*)::int FROM websites WHERE enabled = TRUE) AS total,
      COUNT(*) FILTER (WHERE ok = TRUE)::int AS online,
      COUNT(*) FILTER (WHERE ok = FALSE)::int AS offline,
      COALESCE(ROUND(AVG(response_time_ms))::int, 0) AS avg_response_ms
    FROM latest
  `);
  res.json(rows[0]);
});

app.get('/api/websites/:id/history', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT status_code, response_time_ms, ok, error, checked_at
     FROM checks WHERE website_id = $1 ORDER BY checked_at DESC LIMIT 50`,
    [req.params.id]
  );
  res.json(rows);
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => console.log(`API listening on http://localhost:${port}`));
