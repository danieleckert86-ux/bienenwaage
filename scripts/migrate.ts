import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
const q=neon(process.env.DATABASE_URL!);
const source=await readFile(new URL('../migrations/001_sync.sql',import.meta.url),'utf8');
for(const statement of source.split(';').map(x=>x.trim()).filter(Boolean))await q.query(statement);
console.log('Additive migration complete');
