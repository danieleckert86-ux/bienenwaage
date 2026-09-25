import assert from 'node:assert/strict';
import {neon} from '@neondatabase/serverless';
import {syncAll} from '../lib/sync.js';
import history from '../api/history.js';
const q=neon(process.env.DATABASE_URL!);
const before=await q`SELECT count(*)::int AS n FROM hive_measurements`;
const result=process.argv.includes('--read-only')?{ok:true}:await syncAll();console.log('sync',JSON.stringify(result));assert.equal(result.ok,true);
if(!process.argv.includes('--read-only')) {const again=await syncAll();assert.equal(again.skipped,true);console.log('concurrent/repeated trigger is throttled');}
for(const days of [1,7,30,365]){
 let status=200,body:any;const response={setHeader(){},status(n:number){status=n;return this;},json(v:any){body=v;return this;}};
 const start=Date.now();await history({method:'GET',query:{days:String(days)}} as any,response as any);
 assert.equal(status,200);assert.equal(body.hives.length,4);
 for(const h of body.hives){assert.ok(h.latest);assert.ok(h.points.length>0);assert.ok(h.points.every((p:any,i:number,a:any[])=>!i||p.t>a[i-1].t));assert.ok(h.points.length<5000);}
 console.log('history',days,'days',Date.now()-start,'ms',body.hives.map((h:any)=>({key:h.key,latest:h.latest,delta24:h.delta24,delta7:h.delta7,points:h.points.length})));
}
const after=await q`SELECT count(*)::int AS n,count(DISTINCT(hive_key,measured_at))::int AS unique FROM hive_measurements`;
assert.equal(after[0].n,after[0].unique);assert.ok(after[0].n>=before[0].n);console.log('archive preserved, no duplicates',after[0]);
