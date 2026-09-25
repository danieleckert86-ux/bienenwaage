import type {VercelRequest,VercelResponse} from '@vercel/node';
import { run,sql } from '../lib/db.js';
import { DAY,HIVES } from '../lib/hives.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
 if(req.method!=='GET')return res.status(405).json({error:'GET erforderlich'});
 const days=Number(req.query.days??7);
 if(![1,7,30,365].includes(days))return res.status(400).json({error:'Zeitraum muss 1, 7, 30 oder 365 Tage sein'});
 const now=Date.now(),start=now-days*DAY,bucket=days===1?300:days===7?1800:days===30?7200:86400;
 try {
  const [summary,points,states]=await Promise.all([
   run(sql`WITH keys AS (SELECT unnest(ARRAY['rot','gelb','schnecke','ameisenbaer']) AS key)
    SELECT k.key,l.measured_at AS latest_at,l.weight_kg AS latest_weight,
      d.measured_at AS day_at,d.weight_kg AS day_weight,w.measured_at AS week_at,w.weight_kg AS week_weight,
      f.measured_at AS first_at,j.measured_at AS jump_at,j.delta AS jump_delta
    FROM keys k
    LEFT JOIN LATERAL (SELECT measured_at,weight_kg FROM hive_measurements WHERE hive_key=k.key ORDER BY measured_at DESC LIMIT 1) l ON true
    LEFT JOIN LATERAL (SELECT measured_at,weight_kg FROM hive_measurements WHERE hive_key=k.key AND measured_at<=l.measured_at-interval '24 hours' AND measured_at>=l.measured_at-interval '25 hours' ORDER BY measured_at DESC LIMIT 1) d ON true
    LEFT JOIN LATERAL (SELECT measured_at,weight_kg FROM hive_measurements WHERE hive_key=k.key AND measured_at<=l.measured_at-interval '7 days' AND measured_at>=l.measured_at-interval '7 days 1 hour' ORDER BY measured_at DESC LIMIT 1) w ON true
    LEFT JOIN LATERAL (SELECT measured_at FROM hive_measurements WHERE hive_key=k.key ORDER BY measured_at LIMIT 1) f ON true
    LEFT JOIN LATERAL (SELECT measured_at,delta FROM (
      SELECT measured_at,weight_kg-lag(weight_kg) OVER(ORDER BY measured_at) AS delta,measured_at-lag(measured_at) OVER(ORDER BY measured_at) AS gap
      FROM hive_measurements WHERE hive_key=k.key AND measured_at>now()-interval '25 hours'
    ) s WHERE measured_at>now()-interval '24 hours' AND gap<=interval '30 minutes' AND abs(delta)>=2 ORDER BY abs(delta) DESC LIMIT 1) j ON true`),
   // Bounded response: first/min/max/last per bucket preserves real weight jumps.
   run(sql`WITH ranked AS (
    SELECT hive_key,measured_at,weight_kg,
      row_number() OVER(PARTITION BY hive_key,floor(extract(epoch FROM measured_at)/${bucket}) ORDER BY measured_at) AS first,
      row_number() OVER(PARTITION BY hive_key,floor(extract(epoch FROM measured_at)/${bucket}) ORDER BY measured_at DESC) AS last,
      row_number() OVER(PARTITION BY hive_key,floor(extract(epoch FROM measured_at)/${bucket}) ORDER BY weight_kg,measured_at) AS low,
      row_number() OVER(PARTITION BY hive_key,floor(extract(epoch FROM measured_at)/${bucket}) ORDER BY weight_kg DESC,measured_at) AS high
    FROM hive_measurements WHERE measured_at>=${new Date(start).toISOString()}::timestamptz AND measured_at<=${new Date(now).toISOString()}::timestamptz
   ) SELECT hive_key,measured_at,weight_kg FROM ranked WHERE first=1 OR last=1 OR low=1 OR high=1 ORDER BY hive_key,measured_at`),
   run(sql`SELECT channel,cursor_at,attempted_at,succeeded_at,last_error FROM bee_sync_state ORDER BY channel`)
  ]);
  const time=(v:any)=>v?Date.parse(v):null;
  const hives=HIVES.map(h=>{
   const s=summary.find(r=>r.key===h.key)!;
   return {...h,latest:s.latest_at?{t:time(s.latest_at),v:Number(s.latest_weight)}:null,
    delta24:s.day_at?Number(s.latest_weight)-Number(s.day_weight):null,
    delta7:s.week_at?Number(s.latest_weight)-Number(s.week_weight):null,
    reference24:time(s.day_at),reference7:time(s.week_at),firstAt:time(s.first_at),
    jump:s.jump_at?{t:time(s.jump_at),delta:Number(s.jump_delta)}:null,
    points:points.filter(p=>p.hive_key===h.key).map(p=>({t:time(p.measured_at),v:Number(p.weight_kg)}))};
  });
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({source:'neon',generatedAt:now,start,end:now,days,bucketSeconds:bucket,hives,sync:states});
 }catch(error){console.error(error);return res.status(503).json({error:'Das Messwertarchiv ist momentan nicht erreichbar. Bitte erneut versuchen.'});}
}
