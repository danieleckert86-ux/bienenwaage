import { checkAlarms } from './alarms.js';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { run, sql } from './db.js';
import { DAY, HIVES, fetchWindow, fetchLive, parsePoints, type Feed } from './hives.js';

async function save(channel:number, feeds:Feed[], cursor:number|null) {
  const hives=HIVES.filter(h=>h.channel===channel);
  const payload=hives.flatMap(h=>parsePoints(feeds,h.field).map(p=>({key:h.key,name:h.name,t:new Date(p.t).toISOString(),v:p.v})));
  const q=neon(process.env.DATABASE_URL!);
  // Measurements and cursor advance atomically; a failed batch is replayed.
  const result=await q.transaction([
    q`WITH added AS (
      INSERT INTO hive_measurements(hive_key,hive_name,measured_at,weight_kg)
      SELECT DISTINCT ON (key,t) key,name,t::timestamptz,v FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(key text,name text,t text,v double precision)
      ON CONFLICT(hive_key,measured_at) DO NOTHING RETURNING 1
    ) SELECT count(*)::int AS inserted FROM added`,
    q`UPDATE bee_sync_state SET cursor_at=COALESCE(${cursor ? new Date(cursor).toISOString():null}::timestamptz,cursor_at), succeeded_at=now(),last_error=null WHERE channel=${channel}`
  ]);
  const inserted=Number(result[0][0]?.inserted||0);
  await run(sql`UPDATE bee_sync_state SET inserted=inserted+${inserted} WHERE channel=${channel}`);
  return inserted;
}
export async function syncAll() {
  const token=randomUUID(), now=Date.now();
  const lease=await run(sql`INSERT INTO bee_sync_lease(id,token,expires_at,next_allowed_at)
    VALUES(1,${token},now()+interval '240 seconds',now()+interval '2 minutes')
    ON CONFLICT(id) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at,next_allowed_at=EXCLUDED.next_allowed_at
    WHERE bee_sync_lease.expires_at<=now() AND bee_sync_lease.next_allowed_at<=now() RETURNING id`);
  if(!lease.length) return {ok:true,skipped:true,reason:'already-running-or-recent',channels:[]};
  try {
    const channelIds=[...new Set(HIVES.map(h=>h.channel))];
    // Always ingest the latest readings for every channel first. A slow or broken
    // historical import must never hold the swarm alarm behind it.
    const live=await Promise.all(channelIds.map(async channel=>{
      try {
        await run(sql`UPDATE bee_sync_state SET attempted_at=now() WHERE channel=${channel}`);
        const inserted=await save(channel,await fetchLive(channel),null);
        return {channel,ok:true,inserted};
      } catch(error) {
        console.error('live sync channel',channel,error);
        await run(sql`UPDATE bee_sync_state SET last_error='Live-Abruf fehlgeschlagen' WHERE channel=${channel}`);
        return {channel,ok:false,inserted:0};
      }
    }));
    // Alarm mails are sent before the (potentially expensive) historical catch-up.
    const alarms=await checkAlarms();
    const channels=await Promise.all(channelIds.map(async channel=>{
      const current=live.find(c=>c.channel===channel)!;
      let inserted=current.inserted;
      try {
        // Recheck a sliding 24-hour window on every run to heal recent holes,
        // regardless of the historical cursor. Upserts do not duplicate readings.
        inserted+=await save(channel,await fetchWindow(channel,Date.now()-DAY-3_600_000,Date.now()),null);
        const [state]=await run(sql`SELECT cursor_at FROM bee_sync_state WHERE channel=${channel}`);
        let cursor=state?.cursor_at ? Date.parse(state.cursor_at):null;
        if(!cursor) {
          const keys=HIVES.filter(h=>h.channel===channel).map(h=>h.key);
          const [row]=await run(sql`SELECT min(t) AS t FROM (SELECT max(measured_at) AS t FROM hive_measurements WHERE hive_key IN (${sql.join(keys.map(k=>sql`${k}`),sql`,`)}) GROUP BY hive_key) x`);
          cursor=row?.t ? Date.parse(row.t)-DAY:now-DAY;
        }
        // Historical backlog is intentionally low priority.
        for(let batch=0;batch<3 && cursor<now;batch++) {
          const finish=Math.min(cursor+DAY,now);
          inserted+=await save(channel,await fetchWindow(channel,cursor-3_600_000,finish),finish);
          cursor=finish;
        }
        return {channel,ok:current.ok,inserted,caughtUp:cursor>=now};
      } catch(error) {
        console.error('history sync channel',channel,error);
        await run(sql`UPDATE bee_sync_state SET last_error='Historischer Abgleich fehlgeschlagen' WHERE channel=${channel}`);
        return {channel,ok:false,inserted};
      }
    }));
    return {ok:channels.every(c=>c.ok),skipped:false,channels,alarms};

  } finally {
    await run(sql`UPDATE bee_sync_lease SET expires_at=now(),next_allowed_at=now()+interval '2 minutes' WHERE id=1 AND token=${token}`);
  }
}
