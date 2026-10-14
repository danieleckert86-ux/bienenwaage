type Status={threshold:number;enabled:boolean;mailReady:boolean;hasRecipients:boolean;editable:boolean;recipients?:string[];pauses:{hive_key:string;until_at:string}[];events:{hive_key:string;detected_at:string;loss_kg:number;sent:number;pending:number}[]};
const names:Record<string,string>={rot:'Rotes Volk',gelb:'Gelbes Volk',schnecke:'Schnecken-Volk',ameisenbaer:'Ameisenbär-Volk'};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const date=(s:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(s));
let key=sessionStorage.getItem('bee-alarm-key')||'';
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('alarm-key')) {key=fragment.get('alarm-key')!;sessionStorage.setItem('bee-alarm-key',key);history.replaceState(null,'',location.pathname+location.search+'#schwarmalarm');}
export function initAlarms(){
 const section=document.createElement('dialog');section.id='schwarmalarm';section.className='alarm-panel alarm-dialog';section.setAttribute('aria-labelledby','alarm-title');
 section.innerHTML=`<div class="alarm-heading"><h2 id="alarm-title">Schwarmalarm</h2><button id="alarm-close" class="refresh" type="button" aria-label="Einstellungen schließen">Schließen</button></div><p class="panel-subtitle">Ein gemeinsamer Grenzwert für alle vier Völker. Alarm bei schnellem Gewichtsverlust innerhalb von 15 Minuten, bestätigt durch die nächste Messung.</p><p id="alarm-status" role="status">Alarm-Einstellungen werden geladen …</p>
 <div id="alarm-settings"><form id="alarm-form"><div id="alarm-unlock"><label>Kennwort <input id="alarm-key" type="password" autocomplete="off"></label><button type="button" id="alarm-unlock-button" class="refresh">Entsperren</button></div>
 <fieldset id="alarm-fields" disabled><label>Grenzwert für alle Völker (kg)<input id="alarm-threshold" type="number" min="0.2" max="10" step="0.1" value="1" required></label><label>E-Mail-Empfänger<textarea id="alarm-recipients" rows="3" placeholder="name@beispiel.de, weitere@beispiel.de"></textarea></label><small>Bis zu zehn Adressen, getrennt durch Komma oder Zeilenumbruch. Jede Adresse erhält eine eigene Mail.</small><label class="compare"><input id="alarm-enabled" type="checkbox" checked>Schwarmalarm April–August aktiv</label><button class="refresh" type="submit">Einstellungen speichern</button></fieldset></form></div>
 <div id="alarm-pauses" class="alarm-pauses"></div><p class="aside-note">Die Pause gilt für alle vier Völker für acht Stunden. Die Messwerte werden weiter gespeichert. Die Waage erkennt einen Schwarmverdacht, keine sichere Diagnose.</p><div id="alarm-events"></div><p id="alarm-message" role="status" aria-live="polite"></p>`;
 document.body.append(section);
 const settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.className='refresh';settingsButton.textContent='⚙ Einstellungen';settingsButton.setAttribute('aria-haspopup','dialog');
 document.querySelector('.overview-tools')!.append(settingsButton);
 settingsButton.addEventListener('click',()=>{section.showModal();void action();});
 section.querySelector('#alarm-close')!.addEventListener('click',()=>section.close());
 section.addEventListener('click',e=>{if(e.target===section){const r=section.getBoundingClientRect();const m=e as MouseEvent;if(m.clientX<r.left||m.clientX>r.right||m.clientY<r.top||m.clientY>r.bottom)section.close();}});
 if(location.hash==='#schwarmalarm')section.showModal();
 const el=(id:string)=>document.getElementById(id)!;
 const headers=():Record<string,string>=>key?{Authorization:`Bearer ${encodeURIComponent(key)}`}:{ };
 function render(s:Status){
  (el('alarm-threshold') as HTMLInputElement).value=String(s.threshold);
  (el('alarm-enabled') as HTMLInputElement).checked=s.enabled;
  (el('alarm-fields') as HTMLFieldSetElement).disabled=!s.editable;
  el('alarm-unlock').hidden=s.editable;
  (el('alarm-recipients') as HTMLTextAreaElement).value=s.recipients?.join('\n')||'';
  el('alarm-status').textContent=`Grenzwert: ${s.threshold.toLocaleString('de-DE')} kg · ${!s.enabled?'Deaktiviert':!s.mailReady?'Mailversand noch nicht eingerichtet':!s.hasRecipients?'Bitte E-Mail-Empfänger hinterlegen':'Bereit · Schwarmzeit April–August'}`;
  const allPaused=Object.keys(names).every(id=>s.pauses.some(p=>p.hive_key===id));
  const pauseUntil=allPaused?new Date(Math.min(...s.pauses.map(p=>Date.parse(p.until_at)))).toISOString():null;
  el('alarm-pauses').innerHTML=`<div><span>${pauseUntil?`Alle Völker pausiert bis ${date(pauseUntil)}`:'Schwarmalarm für alle Völker pausieren'}</span><button class="refresh" data-pause="all" ${!s.editable?'disabled':''}>${allPaused?'Pause auf 8 h verlängern':'Alle Völker pausieren · 8 h'}</button></div>`;
  el('alarm-events').innerHTML=s.events.length?`<h3>Letzte Schwarmverdachte</h3><ul>${s.events.map(e=>`<li>${escape(names[e.hive_key]||e.hive_key)} · ${date(e.detected_at)} · −${Number(e.loss_kg).toLocaleString('de-DE')} kg · ${e.sent?`${e.sent} Mail(s) vom Anbieter angenommen`:e.pending?'Mailversand ausstehend':'ohne E-Mail-Empfänger'}</li>`).join('')}</ul>`:'<p class="muted">Noch kein Schwarmverdacht seit Einrichtung des Alarms.</p>';
 }
 async function request(body?:unknown){const r=await fetch('/api/alarms',{method:body?'POST':'GET',headers:{...headers(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(30000)});const s=await r.json();if(!r.ok)throw new Error(s.error||'Alarm-Einstellungen nicht erreichbar');render(s);return s as Status;}
 async function action(body?:unknown){try{await request(body);el('alarm-message').textContent=body?'Gespeichert.':'';}catch(e){el('alarm-message').textContent=(e as Error).message;}}
 el('alarm-unlock-button').addEventListener('click',async()=>{key=(el('alarm-key') as HTMLInputElement).value.trim();try{const s=await request();if(!s.editable)throw new Error('Kennwort ungültig.');sessionStorage.setItem('bee-alarm-key',key);el('alarm-message').textContent='Einstellungen entsperrt.';}catch(e){el('alarm-message').textContent=(e as Error).message;}});
 el('alarm-form').addEventListener('submit',e=>{e.preventDefault();void action({action:'settings',threshold:Number((el('alarm-threshold') as HTMLInputElement).value),recipients:(el('alarm-recipients') as HTMLTextAreaElement).value,enabled:(el('alarm-enabled') as HTMLInputElement).checked});});
 el('alarm-pauses').addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-pause]');if(b)void action({action:'pause'});});
 void action();
}
