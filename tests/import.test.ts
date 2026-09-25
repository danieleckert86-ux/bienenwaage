import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePoints,fetchWindow} from '../lib/hives.js';
test('missing values never become zero and timestamps are validated',()=>{
 const t='2026-09-24T10:00:00Z';
 assert.deepEqual(parsePoints([null,'',undefined,'NaN','Infinity','bad'].map(v=>({created_at:t,field4:v})),4),[]);
 assert.deepEqual(parsePoints([{created_at:t,field4:'0'},{created_at:'bad',field4:'42'},{created_at:'2099-01-01',field4:'42'}],4),[{t:Date.parse(t),v:0}]);
});
test('channel fields stay separate, records sort and deduplicate',()=>{
 const points=parsePoints([{created_at:'2026-09-24T10:02:00Z',field1:'47',field3:'51'},{created_at:'2026-09-24T10:00:00Z',field1:'46',field3:'50'},{created_at:'2026-09-24T10:00:00Z',field1:'46',field3:'50'}],3);
 assert.deepEqual(points.map(p=>p.v),[50,51]);
});
test('saturated 8000-point windows split before checkpointing',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({channel:{id:2038308},feeds:calls===1?Array.from({length:8000},()=>({})):Array.from({length:10},()=>({}))}),{status:200});};
 try{assert.equal((await fetchWindow(2038308,0,86400000)).length,20);assert.equal(calls,3);}finally{globalThis.fetch=original;}
});
