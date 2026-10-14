import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
const q=neon(process.env.DATABASE_URL!);
for(const name of ['001_sync.sql','002_swarm.sql']) {
 const source=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');
 for(const statement of source.split(';').map(x=>x.trim()).filter(Boolean))await q.query(statement);
}
console.log('Additive migration complete');
