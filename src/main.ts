import './styles.css';

type Hive = { name: string; color: string };
type Point = { t: number; v: number };
const hives: Hive[] = [
  { name: 'Rotes Volk', color: '#c94d44' },
  { name: 'Gelbes Volk', color: '#d6a928' },
  { name: 'Schnecken-Volk', color: '#708e62' },
  { name: 'Ameisenbär-Volk', color: '#566c8e' },
];
let days = 365;
const enabled = new Set(hives.map(h => h.name));
let data = new Map<string, Point[]>();

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1}) : '–';
const delta = (pts: Point[], hours: number) => {
  if (!pts.length) return NaN;
  const latest=pts[pts.length-1], target=latest.t-hours*3600000;
  let best=pts[0];
  for(const p of pts) if(Math.abs(p.t-target)<Math.abs(best.t-target)) best=p;
  return latest.v-best.v;
};
const deltaText=(v:number)=>Number.isFinite(v)?(v>=0?'+':'')+fmt(v)+' kg':'–';

type YearTask = { icon: string; title: string; detail: string };
type YearStep = { month: string; phase: string; tasks: YearTask[]; next: string };
const beeYear: YearStep[] = [
  { month:'Januar',phase:'Winterruhe · Futter im Blick',tasks:[{icon:'⚖',title:'Futtervorrat beobachten',detail:'Gewichtsverlauf nutzen; bei auffälligem Verlust oder leichtem Volk Futterlage prüfen.'},{icon:'⌂',title:'Stand kontrollieren',detail:'Flugloch, Mäuseschutz, Sturm- und Feuchteschäden äußerlich prüfen.'},{icon:'◌',title:'Varroa-Nachkontrolle',detail:'Nach Winterbehandlung Behandlungserfolg über natürlichen Milbenfall beurteilen.'}],next:'Material und Honigräume vorbereiten; Futterkontrolle bleibt bis zum sicheren Trachtbeginn wichtig.'},
  { month:'Februar',phase:'Übergang zur Auswinterung',tasks:[{icon:'⚖',title:'Futter bleibt Priorität',detail:'Brutbeginn erhöht den Verbrauch. Waage auf stärkeren Gewichtsverlust beobachten.'},{icon:'☀',title:'Reinigungsflug beobachten',detail:'Flugbild und Auffälligkeiten notieren; Völker bei Kälte nicht unnötig öffnen.'},{icon:'▤',title:'Dadant vorbereiten',detail:'Schiede, saubere Brutraumwaben und Honigräume für die Saison bereithalten.'}],next:'Bei geeigneter Witterung folgt die erste kurze Volkskontrolle und das Anpassen des Brutraums.'},
  { month:'März',phase:'Auswinterung · Dadant-Brutraum anpassen',tasks:[{icon:'⚖',title:'Futter und Weiselrichtigkeit prüfen',detail:'Kurze Kontrolle bei geeignetem Flugwetter; Brutbild und Vorräte beurteilen.'},{icon:'▥',title:'Brutraum mit Schied anpassen',detail:'Dadant-Brutraum an Volksstärke und Brutnest anpassen, ohne das Brutnest unnötig auseinanderzureißen.'},{icon:'◌',title:'Varroa-Frühjahrsdiagnose',detail:'Gemüll bzw. geeignete Befallskontrolle nutzen und auffällige Völker markieren.'}],next:'Mit zunehmender Volksstärke rechtzeitig Raum geben; Honigraum und Schwarmzeit vorbereiten.'},
  { month:'April',phase:'Aufwärtsentwicklung · Raum geben',tasks:[{icon:'▦',title:'Honigraum rechtzeitig geben',detail:'An Volksstärke und Tracht orientieren; bei Dadant Brutraum gezielt führen und Honigraum erweitern.'},{icon:'♙',title:'Schwarmkontrollen beginnen',detail:'Ab einsetzender Schwarmzeit regelmäßig kontrollieren; Takt an Entwicklung und Wetter anpassen.'},{icon:'○',title:'Drohnenrahmen / Biotechnik',detail:'Drohnenbrutmanagement kann die Varroaentwicklung während der Saison bremsen.'}],next:'Mai ist meist Hochphase von Tracht, Erweiterung, Schwarmkontrolle und Ablegerbildung.'},
  { month:'Mai',phase:'Hauptentwicklung · Schwarmzeit',tasks:[{icon:'♙',title:'Wöchentlich Schwarmstimmung prüfen',detail:'Genügend Platz für die Königin und Schwarmzellen kontrollieren.'},{icon:'▦',title:'Honigräume nach Bedarf erweitern',detail:'Eintrag und Platz beobachten; Gewichtsanstieg der Waage als zusätzlichen Hinweis nutzen.'},{icon:'＋',title:'Ablegerbildung planen',detail:'Starke Völker nutzen; zugleich Varroadruck durch biotechnische Maßnahmen begrenzen.'}],next:'Schwarmkontrollen laufen weiter; Honigernte und Jungvolkpflege rücken näher.'},
  { month:'Juni',phase:'Tracht · Ernte · Jungvölker',tasks:[{icon:'♙',title:'Schwarmkontrolle fortsetzen',detail:'Bis zum Ende der Schwarmphase eng am tatsächlichen Volkszustand bleiben.'},{icon:'⬡',title:'Honigreife und Ernte planen',detail:'Nicht nur Kalender, sondern Trachtende und Honigreife entscheiden lassen.'},{icon:'◌',title:'Varroa im Blick behalten',detail:'Befall ermitteln; während Trachtnutzung keine routinemäßige medikamentöse Behandlung im Wirtschaftsvolk.'}],next:'Nach Trachtende beginnt die entscheidende Phase für Varroabehandlung, Fütterung und gesunde Winterbienen.'},
  { month:'Juli',phase:'Nach der Ernte · neues Bienenjahr beginnt',tasks:[{icon:'◌',title:'Varroabefall bestimmen',detail:'Vor der Sommerbehandlung Befall erfassen und Dringlichkeit beurteilen.'},{icon:'⚗',title:'Sommerbehandlung vorbereiten',detail:'Nassenheider/Ameisensäure ist eine Option bei Völkern mit Brut. Varroawetter und Packungsbeilage beachten.'},{icon:'▰',title:'Fütterung starten',detail:'Nach Trachtende Futterversorgung sichern und Behandlung/Fütterung sinnvoll aufeinander abstimmen.'}],next:'Im August stehen Winterbienen im Mittelpunkt: Futter, Varroawirkung und Volksstärke eng kontrollieren.'},
  { month:'August',phase:'Winterbienen schützen · auffüttern',tasks:[{icon:'⚗',title:'Varroabehandlung durchführen / kontrollieren',detail:'Ameisensäure mit Nassenheider nur passend zu Präparat, Befall und Wetter einsetzen.'},{icon:'▰',title:'Weiter auffüttern',detail:'Futtervorrat und Platz für Brut beachten; Gewichtsverlauf hilft bei der Kontrolle.'},{icon:'✓',title:'Behandlungserfolg nachprüfen',detail:'Nach ausreichender Nachwirkzeit Restbefall bestimmen; Reinvasion berücksichtigen.'}],next:'Bis Ende September sollten Futterversorgung und Varroasituation belastbar sein.'},
  { month:'September',phase:'Einwinterung abschließen',tasks:[{icon:'⚖',title:'Winterfutter kontrollieren',detail:'Zielvorrat betriebsspezifisch prüfen und fehlendes Futter rechtzeitig ergänzen.'},{icon:'◌',title:'Varroa erneut kontrollieren',detail:'Reinvasion ist möglich. Nicht allein davon ausgehen, dass die Sommerbehandlung dauerhaft genügt.'},{icon:'↔',title:'Volksstärke beurteilen',detail:'Schwache oder problematische Einheiten rechtzeitig bewerten und Betriebsweise entsprechend anpassen.'}],next:'Oktober: Wintersicherung, Flugloch/Mäuseschutz und möglichst wenig störende Eingriffe.'},
  { month:'Oktober',phase:'Wintersicherung',tasks:[{icon:'⌂',title:'Mäuseschutz und Beute prüfen',detail:'Flugloch, Deckel, Standfestigkeit und Feuchteschutz kontrollieren.'},{icon:'⚖',title:'Futter plausibilisieren',detail:'Waage nutzen, ohne das Volk unnötig zu öffnen.'},{icon:'◌',title:'Varroa im Auge behalten',detail:'Bei Bienenflug bleibt Reinvasion möglich; auffälligen Milbenfall ernst nehmen.'}],next:'Im November/Dezember Brutfreiheit feststellen und Winterbehandlung passend planen.'},
  { month:'November',phase:'Winterruhe · Brutfreiheit prüfen',tasks:[{icon:'◌',title:'Brutzustand feststellen',detail:'Für eine wirksame Oxalsäure-Restentmilbung ist Brutfreiheit entscheidend; nicht nur nach Datum entscheiden.'},{icon:'⚗',title:'Oxalsäure-Verdampfung planen',detail:'Nur mit dafür zugelassenem Präparat/Gerät und exakt nach aktueller Packungsbeilage anwenden.'},{icon:'⌂',title:'Äußerliche Standkontrolle',detail:'Ruhe bewahren; Störungen und unnötiges Öffnen vermeiden.'}],next:'Bei bestätigter Brutfreiheit liegt die Restentmilbung typischerweise im Spätherbst/Winter.'},
  { month:'Dezember',phase:'Restentmilbung · Winterruhe',tasks:[{icon:'⚗',title:'Oxalsäure bei Brutfreiheit',detail:'Verdampfung nur entsprechend Zulassung von Präparat und Gerät; Schutz- und Anwendungsvorgaben strikt beachten.'},{icon:'✓',title:'Behandlung dokumentieren',detail:'Varroa-Arzneimittelanwendungen gehören ins Bestandsbuch bzw. in die Stockkarte.'},{icon:'⌂',title:'Danach Ruhe',detail:'Stand äußerlich kontrollieren und Völker möglichst ungestört lassen.'}],next:'Im Januar Behandlungserfolg und Futterentwicklung beobachten; dann beginnt der Kreislauf erneut.'}
];

function renderBeeYear() {
  const now = new Date();
  const index = now.getMonth();
  const step = beeYear[index];
  el('year-month').textContent = step.month;
  el('year-phase').textContent = step.phase;
  el('year-now').innerHTML = step.tasks.map(t => '<div class="year-task"><div class="ico">'+t.icon+'</div><div><strong>'+t.title+'</strong><span>'+t.detail+'</span></div></div>').join('');
  el('year-next').textContent = step.next;
  el('year-all').innerHTML = beeYear.map((s,i) => '<div class="year-row"><strong>'+(i===index?'→ ':'')+s.month+'</strong><span>'+s.phase+' · '+s.tasks.map(t=>t.title).join(' · ')+'</span></div>').join('');
}

async function requestJson(url:string, init?:RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || ('HTTP '+response.status));
  return body;
}
async function loadArchive(rangeDays:number) {
  const body = await requestJson('/api/history?days='+Math.max(rangeDays,8));
  const map = new Map<string,Point[]>();
  let newest=0;
  for(const h of body.hives || []) {
    map.set(h.name,(h.points||[]).map((p:Point)=>({t:Number(p.t),v:Number(p.v)})).filter((p:Point)=>Number.isFinite(p.v)));
    newest=Math.max(newest,Number(h.lastSync||0));
  }
  return { map, newest };
}
async function refresh(sync=false) {
  const status=el<HTMLDivElement>('status');
  status.className='status show';
  status.textContent=sync?'Neue Messwerte werden archiviert …':'Archiv wird geladen …';
  try {
    if(sync) await requestJson('/api/sync', { method:'POST' });
    const loaded=await loadArchive(days);
    data=loaded.map; renderCards(); renderLegend(); draw();
    status.className='status';
    el('updated').textContent=loaded.newest?'Archiv\n'+new Date(loaded.newest).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Archiv bereit';
  } catch (error) {
    console.error(error);
    status.className='status show error';
    status.textContent='Das Messwert-Archiv konnte nicht geladen werden. Tippe auf ↻.';
  }
}
function renderCards() {
  el('cards').innerHTML=hives.map(h=>{
    const pts=data.get(h.name)||[], latest=pts.at(-1)?.v??NaN;
    return '<article class="hive-card"><div class="hive-top"><span class="dot" style="background:'+h.color+'"></span>'+h.name+'</div><div class="weight">'+fmt(latest)+'<span class="unit">kg</span></div><div class="changes"><span>24 h<strong>'+deltaText(delta(pts,24))+'</strong></span><span>7 Tage<strong>'+deltaText(delta(pts,168))+'</strong></span></div></article>';
  }).join('');
}
function renderLegend() {
  el('legend').innerHTML=hives.map(h=>'<button data-hive="'+h.name+'" class="'+(enabled.has(h.name)?'':'off')+'"><span class="dot" style="background:'+h.color+'"></span>'+h.name.replace('-Volk','')+'</button>').join('');
  el('legend').querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>{const n=b.dataset.hive!;enabled.has(n)?enabled.delete(n):enabled.add(n);renderLegend();draw();});
}
function draw() {
  const canvas=el<HTMLCanvasElement>('chart'),box=canvas.parentElement!.getBoundingClientRect(),dpr=devicePixelRatio||1;
  canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);
  const c=canvas.getContext('2d')!;c.scale(dpr,dpr);const w=box.width,h=box.height,p={l:42,r:10,t:12,b:30},cutoff=Date.now()-days*86400000;
  const series=hives.filter(x=>enabled.has(x.name)).map(x=>({h:x,p:(data.get(x.name)||[]).filter(q=>q.t>=cutoff)})).filter(x=>x.p.length);
  const vals=series.flatMap(s=>s.p.map(p=>p.v));if(!vals.length){c.fillStyle='#888';c.font='13px system-ui';c.fillText('Noch keine archivierten Messwerte',20,60);return;}
  let min=Math.min(...vals),max=Math.max(...vals);const pad=Math.max((max-min)*.12,1);min-=pad;max+=pad;
  c.strokeStyle='#e2dfd5';c.lineWidth=1;c.fillStyle='#89897e';c.font='10px system-ui';c.textAlign='right';
  for(let i=0;i<5;i++){const y=p.t+(h-p.t-p.b)*i/4;c.beginPath();c.moveTo(p.l,y);c.lineTo(w-p.r,y);c.stroke();c.fillText(fmt(max-(max-min)*i/4),p.l-7,y+3);}
  c.textAlign='center';const labels=days===1?['-24h','-18h','-12h','-6h','Jetzt']:days===7?['-7T','-5T','-3T','-1T','Jetzt']:days===30?['-30T','-22T','-15T','-7T','Jetzt']:['-12M','-9M','-6M','-3M','Jetzt'];
  labels.forEach((x,i)=>c.fillText(x,p.l+(w-p.l-p.r)*i/4,h-8));
  const x0=Date.now()-days*86400000,x1=Date.now(),px=(t:number)=>p.l+(t-x0)/(x1-x0)*(w-p.l-p.r),py=(v:number)=>p.t+(max-v)/(max-min)*(h-p.t-p.b);
  for(const s of series){c.strokeStyle=s.h.color;c.lineWidth=2;c.lineJoin='round';c.beginPath();s.p.forEach((q,i)=>i?c.lineTo(px(q.t),py(q.v)):c.moveTo(px(q.t),py(q.v)));c.stroke();}
}
document.querySelectorAll<HTMLButtonElement>('.ranges button').forEach(b=>b.onclick=async()=>{document.querySelectorAll('.ranges button').forEach(x=>x.classList.remove('active'));b.classList.add('active');days=Number(b.dataset.days);await refresh();});
el<HTMLButtonElement>('refresh').onclick=()=>refresh(true);
window.addEventListener('resize',draw);
renderBeeYear();
refresh();
