import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, newestMeasurement, readHistory, readLatest } from '../lib/db.js';
import { HIVES } from '../lib/hives.js';
import { syncAll } from '../lib/sync.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await ensureSchema();
    let newest = await newestMeasurement();
    if (!newest) {
      await syncAll();
      newest = await newestMeasurement();
    }
    const days = Math.min(800, Math.max(1, Number(req.query.days || 365)));
    const hives = [];
    for (const hive of HIVES) {
      const raw = await readHistory(hive.key, days);
      let points = raw;
      if (days > 14) {
        const daily = new Map<string,{t:number,v:number}>();
        for (const p of raw) {
          const key = new Date(p.t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
          const current = daily.get(key);
          if (!current || p.t > current.t) daily.set(key, p);
        }
        points = [...daily.values()].sort((a,b) => a.t-b.t);
      }
      const latest = await readLatest(hive.key);\n      hives.push({ key: hive.key, name: hive.name, lastSync: newest, latest, points });
    }
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ source: 'neon', hives });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
