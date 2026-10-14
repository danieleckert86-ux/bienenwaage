import type { VercelRequest,VercelResponse } from '@vercel/node';
import { authorized,alarmStatus } from '../lib/alarms.js';
import { run,sql } from '../lib/db.js';
import { validThreshold,recipients } from '../lib/swarm.js';
import { HIVES } from '../lib/hives.js';
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Vary','Authorization');
 const admin=authorized(req.headers.authorization);
 try {
  if(req.method==='GET')return res.json(await alarmStatus(admin));
  if(req.method!=='POST')return res.status(405).json({error:'GET oder POST erforderlich'});
  const body=req.body;
  if(!body||typeof body!=='object')return res.status(400).json({error:'Ungültige Eingabe'});
  if(body.action!=='pause'&&!admin)return res.status(401).json({error:'Zum Ändern bitte das Kennwort eingeben.'});
  if(body.action==='pause') {
   await run(sql`INSERT INTO bee_alarm_pause(hive_key,started_at,until_at) VALUES
    ${sql.join(HIVES.map(h=>sql`(${h.key},now(),now()+interval '8 hours')`),sql`, `)}
    ON CONFLICT(hive_key) DO UPDATE SET started_at=now(),until_at=now()+interval '8 hours'`);
  } else if(body.action==='settings') {
   if(!validThreshold(body.threshold)||typeof body.enabled!=='boolean')return res.status(400).json({error:'Grenzwert: 0,2 bis 10 kg.'});
   let list:string[];try{list=recipients(body.recipients);}catch(e){return res.status(400).json({error:(e as Error).message});}
   await run(sql`UPDATE bee_alarm_settings SET threshold_kg=${body.threshold},recipients=${JSON.stringify(list)}::jsonb,enabled=${body.enabled},active_since=now(),updated_at=now() WHERE id=1`);
  } else return res.status(400).json({error:'Unbekannte Aktion'});
  return res.json(await alarmStatus(admin));
 }catch(error){console.error('alarm api unavailable');return res.status(503).json({error:'Alarm-Einstellungen derzeit nicht erreichbar'});}
}
