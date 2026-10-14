import { createHash,timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { run,sql } from './db.js';
import { HIVES } from './hives.js';
import { detectSwarms,season,COOLDOWN } from './swarm.js';
export function authorized(header:unknown) {
 const expected=process.env.ALARM_ADMIN_TOKEN;
 if(!expected||typeof header!=='string')return false;
 const input=header.replace(/^Bearer /,'');
 return timingSafeEqual(createHash('sha256').update(input).digest(),createHash('sha256').update(expected).digest());
}
export function mailReady(){return Boolean(process.env.RESEND_API_KEY&&process.env.ALARM_MAIL_FROM);}
export async function getSettings(){
 const [s]=await run(sql`SELECT * FROM bee_alarm_settings WHERE id=1`);
 if(!s)throw new Error('Alarm-Einstellungen fehlen');
 return s;
}
export async function alarmStatus(privateView=false){
 const settings=await getSettings();
 const pauses=await run(sql`SELECT hive_key,until_at FROM bee_alarm_pause WHERE until_at>now()`);
 const events=await run(sql`SELECT e.hive_key,e.detected_at,e.loss_kg,
 (SELECT count(*)::int FROM bee_alarm_delivery d WHERE d.event_id=e.id AND sent_at IS NOT NULL) AS sent,
 (SELECT count(*)::int FROM bee_alarm_delivery d WHERE d.event_id=e.id AND sent_at IS NULL) AS pending
 FROM bee_alarm_events e ORDER BY detected_at DESC LIMIT 8`);
 return {threshold:Number(settings.threshold_kg),enabled:settings.enabled,mailReady:mailReady(),hasRecipients:settings.recipients.length>0,pauses,events,
 ...(privateView?{recipients:settings.recipients}:{}),editable:privateView};
}
export async function checkAlarms(now=Date.now()) {
 const settings=await getSettings();
 if(!settings.enabled||!season(now))return {checked:true,season:season(now),created:0,sent:0,mailReady:mailReady()};
 const q=neon(process.env.DATABASE_URL!);
 const since=Date.parse(settings.active_since);
 let created=0,sent=0;
 const [pauses,measurements,recentEvents]=await Promise.all([
  run(sql`SELECT hive_key,started_at,until_at FROM bee_alarm_pause WHERE until_at>now()-interval '1 hour'`),
  run(sql`SELECT hive_key,measured_at,weight_kg FROM hive_measurements WHERE measured_at>=${new Date(now-3*COOLDOWN).toISOString()}::timestamptz AND measured_at<=${new Date(now).toISOString()}::timestamptz ORDER BY measured_at`),
  run(sql`SELECT hive_key,detected_at FROM bee_alarm_events WHERE detected_at>=${new Date(now-4*COOLDOWN).toISOString()}::timestamptz`)
 ]);
 for(const hive of HIVES) {
  // Never send historical backfill events. Keep two hours for event separation; only fresh confirmations qualify.
  const rows=measurements.filter(r=>r.hive_key===hive.key);
  const candidates=detectSwarms(rows.map(r=>({t:Date.parse(r.measured_at),v:Number(r.weight_kg)})),Number(settings.threshold_kg));
  for(const e of candidates) {
   if(e.start<since||now-e.confirmed>60*60_000||e.confirmed>now||!season(e.detected))continue;
   if(pauses.some(p=>p.hive_key===hive.key&&e.start<=Date.parse(p.until_at)&&e.confirmed>=Date.parse(p.started_at)))continue;
   if(recentEvents.some(r=>r.hive_key===hive.key&&Date.parse(r.detected_at)>e.detected-COOLDOWN&&Date.parse(r.detected_at)<=e.detected))continue;
   const id=`${hive.key}-${e.detected}`;
   const result=await q.transaction([
    q`INSERT INTO bee_alarm_events(id,hive_key,detected_at,confirmed_at,loss_kg,before_kg,after_kg,threshold_kg)
      VALUES(${id},${hive.key},${new Date(e.detected).toISOString()},${new Date(e.confirmed).toISOString()},${e.loss},${e.before},${e.after},${settings.threshold_kg}) ON CONFLICT DO NOTHING RETURNING id`,
    q`INSERT INTO bee_alarm_delivery(event_id,recipient) SELECT ${id},jsonb_array_elements_text(${JSON.stringify(settings.recipients)}::jsonb) ON CONFLICT DO NOTHING`
   ]);
   created+=result[0].length;
  }
 }
 if(mailReady()) {
  const pending=await run(sql`SELECT d.event_id,d.recipient,e.* FROM bee_alarm_delivery d JOIN bee_alarm_events e ON e.id=d.event_id WHERE d.sent_at IS NULL AND e.created_at>now()-interval '23 hours' AND d.attempts<20 ORDER BY e.created_at LIMIT 20`);
  for(const d of pending) {
   // Removed recipients and currently paused hives must not receive queued messages.
   if(!settings.recipients.includes(d.recipient)||pauses.some(p=>p.hive_key===d.hive_key&&Date.parse(p.until_at)>now))continue;
   const name=HIVES.find(h=>h.key===d.hive_key)!.name;
   const fmt=(t:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(t));
   const kg=(v:number)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(v);
   const text=`Schwarmverdacht: ${name}\n\n${kg(d.loss_kg)} kg schneller Gewichtsverlust; durch Folgemessung bestätigt.\nErkannt: ${fmt(d.detected_at)}\nBestätigt: ${fmt(d.confirmed_at)}\nGewicht: ${kg(d.before_kg)} → ${kg(d.after_kg)} kg\nGrenzwert: ${kg(d.threshold_kg)} kg innerhalb von 15 Minuten.\n\nBitte zeitnah am Stand prüfen. Auch Arbeiten an der Beute können diesen Alarm auslösen.\nhttps://bienenwaage.vercel.app/#overview`;
   try {
    await run(sql`UPDATE bee_alarm_delivery SET attempts=attempts+1 WHERE event_id=${d.event_id} AND recipient=${d.recipient}`);
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':createHash('sha256').update(`${d.event_id}:${d.recipient}`).digest('hex')},body:JSON.stringify({from:process.env.ALARM_MAIL_FROM,to:[d.recipient],subject:`Schwarmverdacht: ${name} – ${kg(d.loss_kg)} kg`,text}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`Mailanbieter: HTTP ${response.status}`);
    await run(sql`UPDATE bee_alarm_delivery SET sent_at=now(),last_error=null WHERE event_id=${d.event_id} AND recipient=${d.recipient}`);sent++;
   }catch(error){await run(sql`UPDATE bee_alarm_delivery SET last_error='Mailversand fehlgeschlagen' WHERE event_id=${d.event_id} AND recipient=${d.recipient}`);console.error('alarm delivery failed',d.event_id);}
  }
 }
 return {checked:true,created,sent,mailReady:mailReady()};
}
