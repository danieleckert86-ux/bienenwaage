import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql as query } from 'drizzle-orm';
import * as schema from './schema.js';
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL fehlt');
  return drizzle(neon(process.env.DATABASE_URL), {schema});
}
export const sql = query;
export async function run(q: ReturnType<typeof query>) {
  return (await database().execute(q)).rows as Record<string, any>[];
}
