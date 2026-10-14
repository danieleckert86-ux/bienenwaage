export type Sample = {t:number;v:number};
export type Swarm = {start:number;detected:number;confirmed:number;before:number;after:number;loss:number};
export const WINDOW=15*60_000;
export const COOLDOWN=2*60*60_000;
export function validThreshold(value:unknown):value is number {
 return typeof value==='number' && Number.isFinite(value) && value>=0.2 && value<=10;
}
export function recipients(value:unknown):string[] {
 if(typeof value!=='string'||value.length>3000)throw new Error('Bitte E-Mail-Adressen eingeben.');
 const list=[...new Set(value.split(/[,;\s]+/).filter(Boolean).map(s=>s.toLowerCase()))];
 if(list.length>10||list.some(s=>s.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s)))throw new Error('Maximal zehn gültige E-Mail-Adressen, getrennt durch Komma oder Zeilenumbruch.');
 return list;
}
// Use raw adjacent readings. A second independent reading must confirm the loss.
export function detectSwarms(samples:Sample[],threshold:number):Swarm[] {
 if(!validThreshold(threshold))throw new Error('Ungültiger Grenzwert');
 const points=[...new Map(samples.filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.v)).map(p=>[p.t,p])).values()].sort((a,b)=>a.t-b.t);
 const result:Swarm[]=[];
 let last=-Infinity;
 for(let i=1;i<points.length-1;i++) {
  const b=points[i],c=points[i+1];
  let a=points[i-1];
  for(let j=i-2;j>=0&&b.t-points[j].t<=WINDOW;j--)if(points[j].v>a.v)a=points[j];
  if(b.t-a.t>WINDOW||c.t-b.t>WINDOW||b.t-last<COOLDOWN)continue;
  if(a.v-b.v+1e-9>=threshold&&a.v-c.v+1e-9>=threshold) {
   result.push({start:a.t,detected:b.t,confirmed:c.t,before:a.v,after:b.v,loss:Math.round((a.v-b.v)*1000)/1000});last=b.t;
  }
 }
 return result;
}
