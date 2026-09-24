import { ensureSchema, insertPoints, latestTimestamp } from './db.js';
import { fetchThingSpeak, HIVES } from './hives.js';

export async function syncAll() {
  await ensureSchema();
  const result = [];
  for (const hive of HIVES) {
    const latest = await latestTimestamp(hive.key);
    const points = await fetchThingSpeak(hive, 500);
    const fresh = latest ? points.filter(p => p.t > latest - 60_000) : points;
    console.log('[sync]', hive.key, { fetched: points.length, fresh: fresh.length, previousLatest: latest, fetchedFirst: points[0]?.t ?? null, fetchedLast: points.at(-1)?.t ?? null });
    await insertPoints(hive, fresh);
    result.push({ key: hive.key, imported: fresh.length });
  }
  return result;
}
