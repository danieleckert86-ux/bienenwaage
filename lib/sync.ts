import { ensureSchema, insertPoints, latestTimestamp } from './db.js';
import { fetchThingSpeak, HIVES } from './hives.js';

export async function syncAll() {
  await ensureSchema();
  const result = [];
  for (const hive of HIVES) {
    const latest = await latestTimestamp(hive.key);
    const points = await fetchThingSpeak(hive, latest ? 500 : 8000);
    const fresh = latest ? points.filter(p => p.t > latest - 60_000) : points;
    await insertPoints(hive, fresh);
    result.push({ key: hive.key, imported: fresh.length });
  }
  return result;
}
