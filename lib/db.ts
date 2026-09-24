import { neon } from '@neondatabase/serverless';
import type { Hive, Point } from './hives.js';

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  return neon(url);
}

export async function ensureSchema() {
  const q = sql();
  await q`
    CREATE TABLE IF NOT EXISTS hive_measurements (
      hive_key TEXT NOT NULL,
      hive_name TEXT NOT NULL,
      measured_at TIMESTAMPTZ NOT NULL,
      weight_kg DOUBLE PRECISION NOT NULL,
      PRIMARY KEY (hive_key, measured_at)
    )
  `;
  await q`
    CREATE INDEX IF NOT EXISTS hive_measurements_measured_at_idx
    ON hive_measurements (measured_at DESC)
  `;
}

export async function insertPoints(hive: Hive, points: Point[]) {
  if (!points.length) return;
  const q = sql();
  for (const p of points) {
    await q`
      INSERT INTO hive_measurements (hive_key, hive_name, measured_at, weight_kg)
      VALUES (${hive.key}, ${hive.name}, ${new Date(p.t).toISOString()}, ${p.v})
      ON CONFLICT (hive_key, measured_at)
      DO UPDATE SET weight_kg = EXCLUDED.weight_kg, hive_name = EXCLUDED.hive_name
    `;
  }
}

export async function latestTimestamp(hiveKey: string): Promise<number | null> {
  const q = sql();
  const rows = await q`
    SELECT measured_at FROM hive_measurements
    WHERE hive_key = ${hiveKey}
    ORDER BY measured_at DESC
    LIMIT 1
  `;
  return rows.length ? new Date(String(rows[0].measured_at)).getTime() : null;
}

export async function readHistory(hiveKey: string, days: number) {
  const q = sql();
  const rows = await q`
    SELECT measured_at, weight_kg
    FROM hive_measurements
    WHERE hive_key = ${hiveKey}
      AND measured_at >= NOW() - (${days}::text || ' days')::interval
    ORDER BY measured_at ASC
  `;
  return rows.map(r => ({ t: new Date(String(r.measured_at)).getTime(), v: Number(r.weight_kg) }));
}

export async function newestMeasurement(): Promise<number | null> {
  const q = sql();
  const rows = await q`SELECT MAX(measured_at) AS newest FROM hive_measurements`;
  return rows[0]?.newest ? new Date(String(rows[0].newest)).getTime() : null;
}


export async function readLatest(hiveKey: string) {
  const q = sql();
  const rows = await q`
    SELECT measured_at, weight_kg
    FROM hive_measurements
    WHERE hive_key = ${hiveKey}
    ORDER BY measured_at DESC
    LIMIT 1
  `;
  return rows.length ? { t: new Date(String(rows[0].measured_at)).getTime(), v: Number(rows[0].weight_kg) } : null;
}
