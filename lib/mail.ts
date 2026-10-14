import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
export function mailProvider(): 'gmail'|'resend'|null {
 if(process.env.SMTP_USER&&process.env.SMTP_APP_PASSWORD)return 'gmail';
 if(process.env.RESEND_API_KEY&&process.env.ALARM_MAIL_FROM)return 'resend';
 return null;
}
export function deliveryRecipient(address:string){return address.replace(/@googlemail\.com$/i,'@gmail.com');}
export const mailReady=()=>mailProvider()!==null;
export async function sendAlarmMail(to:string,subject:string,text:string,idempotencyKey:string) {
 const provider=mailProvider();
 if(provider==='gmail') {
  const transport=nodemailer.createTransport({service:'gmail',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_APP_PASSWORD!.replace(/\s/g,'')},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
  const id=createHash('sha256').update(idempotencyKey).digest('hex');
  try {await transport.sendMail({from:{name:'Bienenstand',address:process.env.SMTP_USER!},to,subject,text,messageId:`<${id}@bienenwaage.vercel.app>`});}finally{transport.close();}
  return;
 }
 if(provider==='resend') {
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:process.env.ALARM_MAIL_FROM,to:[deliveryRecipient(to)],subject,text}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Mailanbieter: HTTP ${response.status}`);
  return;
 }
 throw new Error('Mailversand noch nicht eingerichtet');
}
