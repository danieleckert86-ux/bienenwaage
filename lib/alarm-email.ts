export type AlarmEmail={name:string;loss:number;before:number;after:number;threshold:number;detected:string;confirmed:string;test?:boolean};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const kg=(v:number)=>new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const time=(s:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
export function renderAlarmEmail(a:AlarmEmail){
 const label=a.test?'TESTALARM':'SCHWARMVERDACHT';
 const subject=a.test?'[TEST] Schwarmalarm – Bienenstand':`⚠ Schwarmverdacht: ${a.name} · −${kg(a.loss)} kg`;
 const summary=a.test?'Kein echter Schwarmalarm. Die folgenden Messwerte sind Beispieldaten.':'Schneller Gewichtsverlust, durch die nächste Messung bestätigt. Bitte zeitnah am Stand prüfen.';
 const rows=[['Gewicht vorher',`${kg(a.before)} kg`],['Gewicht danach',`${kg(a.after)} kg`],['Abfall erkannt',time(a.detected)],['Bestätigt',time(a.confirmed)],['Dein Grenzwert',`${kg(a.threshold)} kg / 15 Minuten`]];
 const text=`${label}\n${a.name}\n\n${summary}\n\nGewichtsverlust: −${kg(a.loss)} kg\n${rows.map(([k,v])=>`${k}: ${v}`).join('\n')}\n\nDashboard öffnen: https://bienenwaage.vercel.app/\n\nGewicht allein beweist keinen Schwarm. Auch Arbeiten an der Beute können diesen Alarm auslösen. Alle Zeiten: Europe/Berlin.`;
 const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;padding:0;background:#f3f0eb;color:#302b28;font-family:Arial,Helvetica,sans-serif;">
 <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(a.test?'Testmail – kein echter Alarm':`${a.name}: −${kg(a.loss)} kg. Bitte zeitnah am Stand prüfen.`)}</div>
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0eb;"><tr><td align="center" style="padding:28px 14px;">
 <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fffdf9;border:1px solid #e7dfd5;border-radius:16px;overflow:hidden;">
 <tr><td style="padding:25px 28px;background:#a42d24;color:#ffffff;border-bottom:5px solid #d66c55;"><p style="margin:0 0 15px;font-size:12px;letter-spacing:2px;font-weight:bold;">BIENENSTAND</p><p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#ffe1d9;">⚠ ${label}</p><h1 style="margin:0;font-size:29px;line-height:1.2;color:#ffffff;">${esc(a.name)}</h1></td></tr>
 <tr><td style="padding:25px 28px 8px;">${a.test?'<p style="margin:0 0 22px;padding:12px 14px;border-left:4px solid #d39c35;background:#fff3d6;font-size:14px;line-height:1.5;color:#60481c;"><strong>Nur ein Test.</strong><br>Kein echter Schwarmalarm. Alle Messwerte unten sind Beispieldaten.</p>':''}
 <p style="margin:0 0 5px;font-size:12px;letter-spacing:1px;font-weight:bold;color:#807164;">GEWICHTSVERLUST</p><p style="margin:0;font-size:46px;line-height:1.15;font-weight:bold;letter-spacing:-1px;color:#a42d24;">−${kg(a.loss)} <span style="font-size:24px;letter-spacing:0;">kg</span></p>
 <p style="margin:10px 0 23px;font-size:15px;line-height:1.6;color:#5e5248;">Schneller Abfall innerhalb von 15 Minuten.<br>Durch die nächste Messung bestätigt${a.test?' (Beispiel)':''}.</p>
 <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">${rows.map(([k,v])=>`<tr><th scope="row" align="left" style="font-weight:normal;padding:12px 0;border-top:1px solid #eee6dc;color:#75685c;">${esc(k)}</th><td align="right" style="padding:12px 0 12px 12px;border-top:1px solid #eee6dc;font-weight:bold;color:#302b28;">${esc(v)}</td></tr>`).join('')}</table>
 </td></tr><tr><td style="padding:16px 28px 28px;"><p style="margin:0 0 18px;font-size:15px;line-height:1.6;font-weight:bold;color:#5b352f;">${a.test?'So sieht deine künftige Alarmmail aus.':'Bitte zeitnah am Stand prüfen.'}</p>
 <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#a42d24" style="border-radius:8px;"><a href="https://bienenwaage.vercel.app/" style="display:inline-block;padding:15px 22px;border:1px solid #a42d24;border-radius:8px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Dashboard öffnen →</a></td></tr></table>
 <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#8a7b6d;">Gewicht allein beweist keinen Schwarm. Auch Arbeiten an der Beute können diesen Alarm auslösen.<br>Alle Zeiten: Europe/Berlin.</p></td></tr></table>
 <p style="margin:16px 0 0;font-size:11px;letter-spacing:.4px;color:#9b8d7f;">Deine vier Völker im Blick · Bienenstand</p></td></tr></table></body></html>`;
 return {subject,text,html};
}
