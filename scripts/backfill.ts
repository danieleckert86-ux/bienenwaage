import { neon } from '@neondatabase/serverless';
import { DAY,HIVES,fetchWindow,parsePoints } from '../lib/hives.js';
const start=Date.parse(process.argv[2]),end=Date.parse(process.argv[3]);
if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('Usage: backfill YYYY-MM-DD YYYY-MM-DD');
const q=neon(process.env.DATABASE_URL!);
for(let t=start;t<end;t+=DAY)for(const channel of [...new Set(HIVES.map(h=>h.channel))]) {
 const feeds=await fetchWindow(channel,t,Math.min(end,t+DAY));
 const rows=HIVES.filter(h=>h.channel===channel).flatMap(h=>parsePoints(feeds,h.field).map(p=>({k:h.key,n:h.name,t:new Date(p.t).toISOString(),v:p.v})));
 await q`INSERT INTO hive_measurements(hive_key,hive_name,measured_at,weight_kg) SELECT DISTINCT ON(k,t) k,n,t::timestamptz,v FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(k text,n text,t text,v double precision) ON CONFLICT DO NOTHING`;
 console.log(new Date(t).toISOString().slice(0,10),channel,rows.length);
}
