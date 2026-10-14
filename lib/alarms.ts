import {renderAlarmEmail} from './alarm-email.js';
import { mailReady,mailProvider,sendAlarmMail } from './mail.js';
export {mailReady} from './mail.js';
import { createHash,timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { run,sql } from './db.js';
import { HIVES } from './hives.js';
import { detectSwarms,season,COOLDOWN } from './swarm.js';
export function authorized(header:unknown) {
 const expected=process.env.ALARM_ADMIN_TOKEN;
 if(!expected||typeof header!=='string')return false;
 let input:string;
 try {input=decodeURIComponent(header.replace(/^Bearer /,''));}catch{return false;}
 return timingSafeEqual(createHash('sha256').update(input).digest(),createHash('sha256').update(expected).digest());
}
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
 const iso=(s:string)=>new Date(s).toISOString();
 return {threshold:Number(settings.threshold_kg),enabled:settings.enabled,mailReady:mailReady(),hasRecipients:settings.recipients.length>0,pauses:pauses.map(p=>({...p,until_at:iso(p.until_at)})),events:events.map(e=>({...e,detected_at:iso(e.detected_at)})),
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
  const pending=await run(sql`SELECT d.event_id,d.recipient,e.* FROM bee_alarm_delivery d JOIN bee_alarm_events e ON e.id=d.event_id WHERE d.sent_at IS NULL AND e.created_at>now()-interval '23 hours' AND d.attempts<20 AND d.last_error IS DISTINCT FROM 'SMTP-Status unklar' ORDER BY e.created_at LIMIT 20`);
  const sendStarted=Date.now();
  for(const d of pending) {
   if(Date.now()-sendStarted>20000)break;
   // Removed recipients and currently paused hives must not receive queued messages.
   if(!settings.recipients.includes(d.recipient)||pauses.some(p=>p.hive_key===d.hive_key&&Date.parse(p.until_at)>now))continue;
   const name=HIVES.find(h=>h.key===d.hive_key)!.name;
   const email=renderAlarmEmail({name,loss:Number(d.loss_kg),before:Number(d.before_kg),after:Number(d.after_kg),threshold:Number(d.threshold_kg),detected:d.detected_at,confirmed:d.confirmed_at});
   try {
    await run(sql`UPDATE bee_alarm_delivery SET attempts=attempts+1 WHERE event_id=${d.event_id} AND recipient=${d.recipient}`);
    if(mailProvider()==='gmail')await run(sql`UPDATE bee_alarm_delivery SET last_error='SMTP-Status unklar' WHERE event_id=${d.event_id} AND recipient=${d.recipient}`);
    await sendAlarmMail(d.recipient,email.subject,email.text,createHash('sha256').update(`${d.event_id}:${d.recipient}`).digest('hex'),email.html);
    await run(sql`UPDATE bee_alarm_delivery SET sent_at=now(),last_error=null WHERE event_id=${d.event_id} AND recipient=${d.recipient}`);sent++;
   }catch(error){await run(sql`UPDATE bee_alarm_delivery SET last_error=CASE WHEN last_error='SMTP-Status unklar' THEN last_error ELSE 'Mailversand fehlgeschlagen' END WHERE event_id=${d.event_id} AND recipient=${d.recipient}`);console.error('alarm delivery failed',d.event_id);}
  }
 }
 return {checked:true,created,sent,mailReady:mailReady()};
}
