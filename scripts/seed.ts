import { pool } from '../src/db/index.js';

const urls = ['https://example.com', 'https://www.wikipedia.org', 'https://httpstat.us/503'];
for (const url of urls) {
  await pool.query('INSERT INTO websites (url) VALUES ($1) ON CONFLICT (url) DO NOTHING', [url]);
}
console.log('Seeded', urls.length, 'websites');
await pool.end();
