import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, insertPoints } from '../lib/db.js';
import { fetchThingSpeakRange, HIVES } from '../lib/hives.js';

const DAY = 86_400_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await ensureSchema();
    const offsetDays = Math.max(0, Number(req.query.offsetDays || 0));
    const spanDays = Math.min(28, Math.max(1, Number(req.query.spanDays || 28)));
    const end = new Date(Date.now() - offsetDays * DAY);
    const start = new Date(end.getTime() - spanDays * DAY);
    const result = [];
    for (const hive of HIVES) {
      const points = await fetchThingSpeakRange(hive, start, end);
      await insertPoints(hive, points);
      result.push({ key: hive.key, imported: points.length });
    }
    return res.status(200).json({
      ok: true,
      start: start.toISOString(),
      end: end.toISOString(),
      hives: result
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
