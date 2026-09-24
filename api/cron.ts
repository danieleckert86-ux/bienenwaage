import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncAll } from '../lib/sync.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const hives = await syncAll();
    return res.status(200).json({ ok: true, hives });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
