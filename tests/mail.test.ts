import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/alarms.js';
test('test mail requires authorization and cannot report success without sending credentials',async()=>{
 const keys=['SMTP_USER','SMTP_APP_PASSWORD','RESEND_API_KEY','ALARM_MAIL_FROM','ALARM_ADMIN_TOKEN'];
 const previous=new Map(keys.map(k=>[k,process.env[k]]));
 for(const k of keys)delete process.env[k];
 process.env.ALARM_ADMIN_TOKEN='Private-Test-123';
 const request=async(auth?:string)=>{let status=200,data:any;const res={setHeader(){},status(n:number){status=n;return this;},json(v:any){data=v;return this;}};await handler({method:'POST',headers:{authorization:auth},body:{action:'test'}} as any,res as any);return{status,data};};
 try {
  assert.equal((await request()).status,401);
  const result=await request('Bearer Private-Test-123');assert.equal(result.status,503);assert.equal(result.data.testSent,undefined);assert.ok(result.data.error.includes('SMTP_APP_PASSWORD'));
 }finally{for(const [k,v] of previous){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test('Resend receives the canonical Gmail address for Googlemail aliases',async()=>{
 const {deliveryRecipient}=await import('../lib/mail.js');
 assert.equal(deliveryRecipient('bee@googlemail.com'),'bee@gmail.com');
 assert.equal(deliveryRecipient('bee@gmail.com'),'bee@gmail.com');
 assert.equal(deliveryRecipient('bee@example.com'),'bee@example.com');
});
