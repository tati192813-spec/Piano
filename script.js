/* Clara — Entrenamiento de lectura musical. Sin dependencias externas. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const LETTERS = ['Do','Re','Mi','Fa','Sol','La','Si'];
const CHROMA = [0,2,4,5,7,9,11];
const ROOTS = [
  {l:0,a:0},{l:0,a:1},{l:1,a:0},{l:2,a:-1},{l:2,a:0},{l:3,a:0},
  {l:3,a:1},{l:4,a:0},{l:5,a:-1},{l:5,a:0},{l:6,a:-1},{l:6,a:0}
];
const FAMILIES = [
  {id:'major',name:'Mayor',semitones:[0,4,7],degrees:[0,2,4]},
  {id:'minor',name:'Menor',semitones:[0,3,7],degrees:[0,2,4]},
  {id:'dim',name:'Disminuido',semitones:[0,3,6],degrees:[0,2,4]},
  {id:'aug',name:'Aumentado',semitones:[0,4,8],degrees:[0,2,4]},
  {id:'sus2',name:'Suspendido 2',semitones:[0,2,7],degrees:[0,1,4]},
  {id:'sus4',name:'Suspendido 4',semitones:[0,5,7],degrees:[0,3,4]},
  {id:'7',name:'Séptima dominante',semitones:[0,4,7,10],degrees:[0,2,4,6]},
  {id:'maj7',name:'Séptima mayor',semitones:[0,4,7,11],degrees:[0,2,4,6]},
  {id:'m7',name:'Séptima menor',semitones:[0,3,7,10],degrees:[0,2,4,6]}
];
const SHARPS=[3,0,4,1,5,2,6], FLATS=[6,2,5,1,4,0,3];
const SIGNATURES = {0:'Do mayor / La menor',1:'Sol mayor / Mi menor',2:'Re mayor / Si menor',3:'La mayor / Fa♯ menor',4:'Mi mayor / Do♯ menor',5:'Si mayor / Sol♯ menor',6:'Fa♯ mayor / Re♯ menor',7:'Do♯ mayor / La♯ menor',[-1]:'Fa mayor / Re menor',[-2]:'Si♭ mayor / Sol menor',[-3]:'Mi♭ mayor / Do menor',[-4]:'La♭ mayor / Fa menor',[-5]:'Re♭ mayor / Si♭ menor',[-6]:'Sol♭ mayor / Mi♭ menor',[-7]:'Do♭ mayor / La♭ menor'};
const SIGNATURE_POS={treble:{sharp:[8,5,9,6,3,7,4],flat:[4,7,3,6,2,5,1]},bass:{sharp:[6,3,7,4,1,5,2],flat:[2,5,1,4,0,3,-1]}};
const BOTTOM={treble:4*7+2,bass:2*7+4};
// Distribución orientada a partituras reales: aproximadamente 80 % de ejercicios
// con un máximo de 3 líneas adicionales y 20 % con 4 o 5.
// Una nota en el espacio inmediatamente exterior no requiere línea adicional.
const ledgerLines=(note,clef)=>{
 const d=step(note)-BOTTOM[clef];
 return d<0?Math.floor(-d/2):d>8?Math.floor((d-8)/2):0;
};
const inDistanceGroup=(notes,clef,group)=>{
 const longest=Math.max(...notes.map(note=>ledgerLines(note,clef)));
 return group==='usual'?longest<=3:longest>=4&&longest<=5;
};
const STORE='claraReadingV2', LEGACY='pianoReadingStatsV1';
const DEFAULT={preset:'medium',kind:'notes',method:'text',strategy:'balanced',clef:'both',signature:'0',accidentals:'simple',minOct:2,maxOct:6,feedback:'show',families:FAMILIES.map(f=>f.id),roots:ROOTS.map((_,i)=>i),inversions:true,open:true,duplicates:true,notePercent:50,delay:800,muteMidi:false};
const PRESETS={
 basic:{clef:'treble',signature:'0',accidentals:'none',minOct:3,maxOct:5,families:['major','minor'],inversions:true,open:true,duplicates:false},
 medium:{clef:'both',signature:'0',accidentals:'simple',minOct:2,maxOct:6,families:['major','minor','dim','aug','sus2','sus4'],inversions:true,open:true,duplicates:true},
 advanced:{clef:'both',signature:'random',accidentals:'double',minOct:0,maxOct:8,families:FAMILIES.map(f=>f.id),inversions:true,open:true,duplicates:true}
};
const clone=x=>JSON.parse(JSON.stringify(x));
const mod=(x,n)=>((x%n)+n)%n;
const rand=(n)=>Math.floor(Math.random()*n);
const pick=a=>a[rand(a.length)];
const step=n=>n.o*7+n.l;
const midi=n=>12*(n.o+1)+CHROMA[n.l]+n.a;
const pitchClass=n=>mod(midi(n),12);
const fmt=n=>LETTERS[n.l]+({[-2]:'𝄫',[-1]:'♭',0:'',1:'♯',2:'𝄪'}[n.a]||'')+n.o;
const rootName=n=>LETTERS[n.l]+({[-1]:'♭',0:'',1:'♯'}[n.a]||'');
const initStat=()=>({seen:0,first:0,completed:0,errors:0,totalMs:0,firstMs:0,firstMsCount:0,fastCount:0});
let store;
try {store=JSON.parse(localStorage.getItem(STORE))} catch {}
if(!store || store.version!==2) store={version:2,settings:clone(DEFAULT),records:{},sessions:[],serial:0};
store.settings={...clone(DEFAULT),...store.settings};
let settings=store.settings;
// Recuperar únicamente recuentos de la versión previa, sin inventar tiempos ni sesiones.
if(!store.legacyMigrated){
 store.legacyMigrated=true;
 try { const old=JSON.parse(localStorage.getItem(LEGACY)||'{}'); for(const [k,v] of Object.entries(old)){
 if(!v || typeof v.tries!=='number')continue;
 store.records['legacy:'+k]={...initStat(),seen:Math.max(0,v.tries),first:Math.max(0,v.hits||0),completed:Math.max(0,v.hits||0),label:k.split(':')[1]||k,kind:'notes',clef:k.split(':')[0]};
 }} catch {}
}
const persist=()=>{try{store.activeSession=data.session?{...data.session,duration:sessionTime()}:null;localStorage.setItem(STORE,JSON.stringify(store))}catch(e){/* Si el navegador bloquea almacenamiento, los ejercicios siguen funcionando. */}};
const data={tab:'practice',exercise:null,count:0,advance:null,pause:false,ended:false,session:null,elapsedStart:0,awaitRelease:false,midi:null,midiInputs:[],midiHeld:new Set(),midiNotes:new Set(),midiWindow:null,selectedVirtual:new Set(),audio:null,activeVoices:[],feedbackDefault:'',mixCounts:{note:0,chord:0}};
let settingReady=false;
const setFeedback=(message='',kind='')=>{const e=$('feedback');e.textContent=message;e.className='feedback'+(kind?' '+kind:'')};
const hidden=(id,hide=true)=>$(id).classList.toggle('hidden',hide);
const setLabel=(id,v)=>$(id).textContent=v;
const sortedNotes=a=>a.slice().sort((x,y)=>midi(x)-midi(y)||step(x)-step(y));
const sigAlter=(s,l)=>{const arr=s>0?SHARPS:FLATS;return arr.slice(0,Math.abs(s)).includes(l)?(s>0?1:-1):0};
const selectedSignature=()=>settings.signature==='random'?rand(15)-7:Number(settings.signature);
const parseNote=str=>{
 const clean=(str||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'').replace(/♯/g,'#').replace(/♭/g,'b').replace(/𝄪/g,'x').replace(/𝄫/g,'bb').replace(/♮/g,'');
 const m=/^(do|re|mi|fa|sol|la|si|c|d|e|f|g|a|b)(##|bb|x|#|b)?([0-8])$/.exec(clean);
 if(!m)return null;
 let l=LETTERS.findIndex(n=>n.toLowerCase()===m[1]);if(l<0)l='cdefgab'.indexOf(m[1]);
 return {l,a:({'##':2,x:2,'#':1,b:-1,bb:-2}[m[2]]||0),o:Number(m[3])};
};
const strictEq=(a,b)=>a && a.l===b.l && a.a===b.a && a.o===b.o;
const physical=n=>midi(n)>=21&&midi(n)<=108;
const inRange=n=>n.o>=settings.minOct&&n.o<=settings.maxOct&&physical(n);
const candidateStat=e=>store.records[e.id]||initStat();
const candidateWeight=e=>{let r=candidateStat(e);if(settings.strategy==='random')return Math.random();if(settings.strategy==='balanced')return -(r.seen||0)+Math.random()*.3;const acc=r.seen?r.first/r.seen:.48;const slow=r.completed?r.totalMs/r.completed:2600;return (1-acc)*3+Math.min(slow/3500,2)+1/Math.sqrt(r.seen+1)+Math.random()*.9};
function chooseBest(make){let best=null,bestWeight=-Infinity;const trials=settings.strategy==='random'?1:28;for(let i=0;i<trials;i++){const c=make();if(!c)continue;const w=candidateWeight(c)-(data.exercise&&c.id===data.exercise.id?10:0);if(w>bestWeight){best=c;bestWeight=w}}return best}
function makeNote(group){
 const clef=settings.clef==='both'?pick(['treble','bass']):settings.clef;
 const signature=selectedSignature();
 for(let a=0;a<150;a++){
   const l=rand(7),o=settings.minOct+rand(settings.maxOct-settings.minOct+1);
   if(!inDistanceGroup([{l,o}],clef,group))continue;
   let alt=sigAlter(signature,l);
   if(settings.accidentals!=='none' && Math.random()<.46){const options=settings.accidentals==='double'?[-2,-1,0,1,2]:[-1,0,1];alt=pick(options.filter(x=>x!==sigAlter(signature,l)));}
   const note={l,o,a:alt};if(!inRange(note))continue;
   return {type:'note',clef,signature,notes:[note],id:`n:${clef}:${fmt(note)}:sig${signature}`,label:`${fmt(note)} · ${clef==='treble'?'Sol':'Fa'} · ${signature>0?signature+'♯':signature<0?(-signature)+'♭':'sin arm.'}`,family:null};
 }
 return null;
}
function deriveChord(root,family,oct){
 const base={...root,o:oct},m0=midi(base),diat0=step(base);
 return family.semitones.map((diff,i)=>{
   const diat=diat0+family.degrees[i],l=mod(diat,7),o=Math.floor(diat/7),a=m0+diff-(12*(o+1)+CHROMA[l]);
   if(a<-2||a>2)return null;
   return {l,o,a};
 });
}
function makeChord(group){
 const families=FAMILIES.filter(f=>settings.families.includes(f.id));const roots=ROOTS.filter((r,i)=>settings.roots.includes(i));
 if(!families.length||!roots.length)return null;
 const clef=settings.clef==='both'?pick(['treble','bass']):settings.clef;
 const sig=selectedSignature();
 for(let attempt=0;attempt<600;attempt++){
   const f=pick(families),r=pick(roots),o=settings.minOct+rand(settings.maxOct-settings.minOct+1);
   const tones=deriveChord(r,f,o);if(tones.some(n=>!n))continue;
   const inversion=settings.inversions?rand(f.semitones.length):0;
   const ordered=tones.slice(inversion).concat(tones.slice(0,inversion)).map(n=>({...n}));
   let last=-Infinity;const open=settings.open&&Math.random()<.48;
   for(let i=0;i<ordered.length;i++){
     if(i>0 && open && Math.random()<.56)ordered[i].o+=1;
     while(midi(ordered[i])<=last)ordered[i].o++;
     last=midi(ordered[i]);
   }
   const shifts=[-3,-2,-1,0,1,2,3].map(x=>x*12);
   const options=shifts.filter(s=>ordered.every(n=>inRange({...n,o:n.o+s/12})));
   if(!options.length)continue;
   const sh=pick(options)/12;
   let notes=ordered.map(n=>({...n,o:n.o+sh}));
   if(settings.duplicates && Math.random()<.46){
     const nExtra=1+rand(2);
     for(let j=0;j<nExtra;j++){
       const origin=pick(notes);
       const candidates=[-2,-1,1,2].map(d=>({...origin,o:origin.o+d})).filter(n=>inRange(n)&&!notes.some(x=>midi(x)===midi(n)));
       if(candidates.length)notes.push(pick(candidates));
     }
   }
   notes=sortedNotes(notes);
   if(notes.length>6||notes.some(n=>!inRange(n)))continue;
   if(!inDistanceGroup(notes,clef,group))continue;
   const actualInversion=f.semitones.findIndex(semi=>mod(pitchClass({...r,o:4})+semi,12)===pitchClass(notes[0]));
   const id=`c:${f.id}:${pitchClass({...r,o:4})}:${actualInversion}:${open?'open':'closed'}:d${notes.length-tones.length}:sig${sig}`;
   return {type:'chord',clef,signature:sig,notes,id,label:`${rootName(r)} ${f.name} · ${actualInversion}ª inv.`,family:f.id,rootPc:pitchClass({...r,o:4}),inversion:actualInversion,open,duplicates:notes.length>tones.length};
 }
 return null;
}
function interpretationList(e){
 const pcs=[...new Set(e.notes.map(pitchClass))].sort((a,b)=>a-b);const bass=pitchClass(e.notes[0]);const interpretations=[];
 for(const f of FAMILIES)for(let pc=0;pc<12;pc++){
   const expected=[...new Set(f.semitones.map(s=>mod(s+pc,12)))].sort((a,b)=>a-b);
   if(pcs.length!==expected.length||pcs.some((v,i)=>v!==expected[i]))continue;
   const inv=f.semitones.findIndex(s=>mod(pc+s,12)===bass);
   if(inv>=0)interpretations.push({root:pc,quality:f.id,inversion:inv});
 }
 return interpretations;
}
function generate(){
 let kind=settings.kind==='mixed'?(Math.random()*100<settings.notePercent?'note':'chord'):(settings.kind==='notes'?'note':'chord');
 if(settings.kind==='mixed'&&settings.strategy==='balanced'){
   const total=data.mixCounts.note+data.mixCounts.chord, expected=(total+1)*settings.notePercent/100;
   kind=data.mixCounts.note<expected?'note':'chord';
 }
 // El grupo se fija ANTES de elegir entre candidatos aleatorios, equilibrados
 // o adaptativos. Así la estrategia no altera la proporción 80 / 20.
 const group=Math.random()<.8?'usual':'extended';
 const generateOf=(type,distance)=>chooseBest(()=>type==='note'?makeNote(distance):makeChord(distance));
 let exercise=generateOf(kind,group);
 // Con ciertos filtros (octavas muy estrechas, por ejemplo), un grupo puede
 // resultar imposible; entonces usamos el otro para no dejar de practicar.
 if(!exercise)exercise=generateOf(kind,group==='usual'?'extended':'usual');
 if(!exercise && settings.kind==='mixed'){
   kind=kind==='note'?'chord':'note';
   exercise=generateOf(kind,group)||generateOf(kind,group==='usual'?'extended':'usual');
 }
 if(!exercise)return null;
 data.mixCounts[exercise.type]++;
 exercise.interpretations=exercise.type==='chord'?interpretationList(exercise):[];
 exercise.start=performance.now();exercise.elapsed=0;exercise.attempts=0;exercise.shown=false;exercise.lockedNotes=exercise.notes.map(()=>false);exercise.identityLocks={root:false,quality:false,inversion:false};exercise.identityComplete=false;exercise.midiComplete=false;exercise.virtualComplete=false;
 return exercise;
}
function svgEl(tag,attrs,parent){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));parent.appendChild(el);return el}
function svgLine(s,x1,y1,x2,y2,stroke='#33405c',width=1.8){svgEl('line',{x1,y1,x2,y2,stroke,'stroke-width':width,'stroke-linecap':'round'},s)}
function accidental(s,x,y,alter,size=1){
 const g=svgEl('g',{transform:`translate(${x} ${y}) scale(${size})`,stroke:'#29344f','stroke-width':2.35,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'},s);
 if(alter===1||alter===-1||alter===0||alter===2||alter===-2){
   if(alter===1){svgLine(g,-5,-20,-6,17,'#29344f',2.6);svgLine(g,7,-25,6,12,'#29344f',2.6);svgLine(g,-10,-5,12,-11,'#29344f',4.1);svgLine(g,-10,7,12,1,'#29344f',4.1)}
   if(alter===-1){svgLine(g,-5,-25,-5,16,'#29344f',2.7);svgEl('path',{d:'M -5,-4 C 6,-14 14,-4 9,5 C 6,11 1,14 -5,18',stroke:'#29344f','stroke-width':3,fill:'none'},g)}
   if(alter===0){svgLine(g,-6,-19,-6,10,'#29344f',2.8);svgLine(g,6,-9,6,20,'#29344f',2.8);svgLine(g,-6,-2,6,-7,'#29344f',3.3);svgLine(g,-6,11,6,6,'#29344f',3.3)}
   if(alter===2){svgEl('path',{d:'M -11,-13 L -3,-6 L 4,-13 L 10,-7 L 3,0 L 10,7 L 4,13 L -3,6 L -11,13 L -17,7 L -10,0 L -17,-7 Z',fill:'#29344f',stroke:'none'},g)}
   if(alter===-2){accidental(g,-10,0,-1,.78);accidental(g,9,0,-1,.78)}
 }
}
function renderScore(){
 const e=data.exercise;if(!e)return;
 const svg=$('score');svg.replaceChildren();const baseline=172, gap=24, half=gap/2,x=468;
 const yAt=n=>baseline-(step(n)-BOTTOM[e.clef])*half;
 const ys=e.notes.map(yAt),minY=Math.min(76,...ys)-55,maxY=Math.max(196,...ys)+65;
 const top=Math.min(-20,minY),bottom=Math.max(260,maxY),height=bottom-top;
 svg.setAttribute('viewBox',`0 ${top} 720 ${height}`);svg.setAttribute('aria-label',`Ejercicio en clave de ${e.clef==='treble'?'sol':'fa'} con ${e.notes.length} ${e.notes.length===1?'nota':'notas'}`);
 // Clave y cinco líneas.
 for(let i=0;i<5;i++)svgLine(svg,60,baseline-i*gap,655,baseline-i*gap,'#39445d',1.7);
 svgLine(svg,60,baseline,60,baseline-4*gap,'#39445d',2);
 const glyph=svgEl('text',{x:82,y:e.clef==='treble'?163:139,'font-size':e.clef==='treble'?115:88,fill:'#28324b','font-family':'"Noto Music","Bravura","Segoe UI Symbol","Apple Symbols",serif'},svg);glyph.textContent=e.clef==='treble'?'𝄞':'𝄢';
 // Armadura tradicional, entre la clave y la nota.
 const sig=e.signature,n=Math.abs(sig),order=sig>0?SHARPS:FLATS,kind=sig>0?'sharp':'flat';
 for(let i=0;i<n;i++){
   const p=SIGNATURE_POS[e.clef][kind][i],y=baseline-p*half;
   accidental(svg,184+i*26,y,sig>0?1:-1,.72);
 }
 // Líneas adicionales para cada nota: el generador limita el máximo a cinco.
 for(const note of e.notes){const d=step(note)-BOTTOM[e.clef],y=yAt(note);
   for(let k=-2;k>=d;k-=2)svgLine(svg,x-27,baseline-k*half,x+34,baseline-k*half,'#38445d',1.6);
   for(let k=10;k<=d;k+=2)svgLine(svg,x-27,baseline-k*half,x+34,baseline-k*half,'#38445d',1.6);
 }
 // Alteraciones: independientes de la armadura solo cuando son necesarias.
 const changes=e.notes.map((note,i)=>({note,i,y:yAt(note),explicit:note.a!==sigAlter(sig,note.l)})).filter(o=>o.explicit).sort((a,b)=>a.y-b.y);
 const cols=[];
 for(const a of changes){let idx=cols.findIndex(column=>column.every(v=>Math.abs(v-a.y)>37));if(idx<0){idx=cols.length;cols.push([])}cols[idx].push(a.y);accidental(svg,x-50-idx*32,a.y,a.note.a,.78)}
 // Cabezas negras (figuras negras) y plica.
 const ordered=e.notes.map((note,i)=>({note,y:yAt(note)})).sort((a,b)=>b.y-a.y);
 const shifts=[];
 for(let i=0;i<ordered.length;i++){const prev=ordered[i-1];shifts.push(prev&&Math.abs(prev.y-ordered[i].y)<half+1?(shifts[i-1]===0?20:0):0)}
 const ysSorted=ordered.map(o=>o.y);
 const stemUp=(ysSorted.reduce((a,b)=>a+b,0)/ysSorted.length)>=baseline-2*gap;
 const stemX=x+(stemUp?16:-16);const stemStart=stemUp?Math.max(...ysSorted):Math.min(...ysSorted);
 svgLine(svg,stemX,stemStart,stemX,stemStart+(stemUp?-70:70),'#28344c',2.6);
 ordered.forEach((v,i)=>{
   const xoff=shifts[i]*(stemUp?1:-1);
   svgEl('ellipse',{cx:x+xoff,cy:v.y,rx:15.2,ry:10.4,fill:'#25314b',transform:`rotate(-17 ${x+xoff} ${v.y})`},svg);
 });
 const caption=svgEl('text',{x:650,y:top+25,'text-anchor':'end','font-size':13,fill:'#8893a9'},svg);caption.textContent=`Clave de ${e.clef==='treble'?'sol':'fa'}`;
}
function currentElapsed(){const e=data.exercise;return e?e.elapsed+(data.pause||data.tab!=='practice'||data.ended?0:performance.now()-e.start):0}
function pauseExercise(){if(data.exercise&&data.tab==='practice'&&!data.pause&&!data.ended){data.exercise.elapsed+=performance.now()-data.exercise.start}}
function resumeExercise(){if(data.exercise)data.exercise.start=performance.now()}
function newExercise(){
 clearTimeout(data.advance);clearTimeout(data.midiWindow);data.midiNotes.clear();data.awaitRelease=false;data.selectedVirtual.clear();
 const e=generate();if(!e){setFeedback('No se pueden generar ejercicios con estos filtros. Amplía el rango o activa alguna familia y fundamental.','err');hidden('answer-area',true);hidden('settings-warning',false);setLabel('settings-warning','No hay ejercicios posibles con los filtros actuales.');return}
 data.exercise=e;data.count++;hidden('answer-area',false);hidden('settings-warning',true);
 setFeedback();setLabel('exercise-tag',e.type==='note'?'NOTA':'ACORDE');setLabel('exercise-key',SIGNATURES[e.signature]||'Sin alteraciones');setLabel('exercise-count',`Ejercicio ${data.count}`);
 $('note-input').value='';$('note-input').disabled=false;$('note-input').className='';$('note-submit').disabled=false;
 renderScore();renderAnswer();if(settings.method==='text'&&e.type==='note'&&data.tab==='practice'&&!data.pause) $('note-input').focus();
 persist();
}
function renderAnswer(){
 const e=data.exercise;if(!e)return;const chord=e.type==='chord',method=settings.method;
 hidden('note-text-area',chord||method!=='text');hidden('chord-identity-area',!chord);hidden('chord-notes-area',!chord);hidden('virtual-area',method!=='virtual');hidden('midi-area',method!=='midi');hidden('virtual-check',!chord);
 hidden('chord-submit-area',!chord);$('chord-submit').textContent='Comprobar '+(method==='text'?'acorde':'identificación');
 if(chord){
  for(const id of ['chord-root','chord-quality','chord-inversion']){$(id).value='';$(id).disabled=false;$(id).classList.remove('is-wrong','is-correct')}
  const grid=$('chord-inputs');grid.replaceChildren();e.notes.forEach((n,i)=>{
    const wrap=document.createElement('div');wrap.className='chord-note-cell';
    const lab=document.createElement('label');lab.textContent=`Nota ${i+1}`;lab.htmlFor=`chord-note-${i}`;
    const input=document.createElement('input');input.id=`chord-note-${i}`;input.className='chord-input';input.autocomplete='off';input.placeholder='Ej. Fa#4';input.spellcheck=false;
    input.addEventListener('keydown',ev=>{if(ev.key==='Enter')submitChord()});
    const state=document.createElement('span');state.className='tiny-state';state.id=`chord-state-${i}`;
    wrap.append(lab,input,state);grid.appendChild(wrap);
  });
  hidden('chord-inputs',method!=='text');
  setLabel('chord-notes-tip',method==='text'?'Escribe cada nota exactamente como aparece, de grave a aguda.':method==='virtual'?'Elige las alturas en el piano virtual; la identificación del acorde se comprueba por separado.':'Toca todas las alturas a la vez en tu piano MIDI.');
 }
 data.selectedVirtual.clear();paintVirtual();setLabel('virtual-prompt',chord?'Selecciona las notas del acorde.':'Pulsa la nota correspondiente.');
 setLabel('midi-played','');
}
function ensureSession(){if(data.session||data.ended)return;data.session={id:'s-'+Date.now()+'-'+Math.random().toString(36).slice(2,9),date:new Date().toISOString(),duration:0,completed:0,first:0,attempts:0,errors:0,notes:0,chords:0};data.elapsedStart=Date.now();}
function sessionTime(){return data.session?data.session.duration+(!data.pause&&!data.ended&&data.tab==='practice'?Date.now()-data.elapsedStart:0):0}
function updateSession(){const s=data.session;setLabel('session-clock',formatTime(sessionTime()));setLabel('session-status',data.ended?'Sesión terminada':data.pause?'En pausa':'Sesión activa');setLabel('pause-session',data.pause?'Reanudar':'Pausar');setLabel('today-progress',s?`${s.completed} ejercicios · ${s.attempts?Math.round(s.first/s.attempts*100):0} % al primer intento`:'0 ejercicios · 0 % al primer intento')}
function formatTime(ms){const sec=Math.floor(Math.max(0,ms)/1000);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function updateTimers(){if(data.session&&!data.pause&&!data.ended&&data.tab==='practice')updateSession()}
function recordAttempt(ok){const e=data.exercise;if(!e)return;ensureSession();e.attempts++;if(e.attempts>1)return;
 const r=store.records[e.id]||{...initStat(),label:e.label,kind:e.type==='note'?'notes':'chords',family:e.family,clef:e.clef,signature:e.signature,alteration:e.type==='note'?e.notes[0].a:null,open:e.open,inversion:e.inversion,duplicates:e.duplicates};r.seen++;if(ok)r.first++;r.firstMs=(r.firstMs||0)+Math.max(0,Math.round(currentElapsed()));r.firstMsCount=(r.firstMsCount||0)+1;store.records[e.id]=r;
 data.session.attempts++;if(ok)data.session.first++;persist();updateSession();
}
function recordMistake(number=1){const e=data.exercise;if(!e)return;const r=store.records[e.id];if(r)r.errors+=number;if(data.session)data.session.errors+=number;persist()}
function finishExercise(){
 const e=data.exercise;if(!e||e.shown)return;e.shown=true;
 const time=currentElapsed();const r=store.records[e.id]||{...initStat(),label:e.label,kind:e.type==='note'?'notes':'chords',family:e.family,clef:e.clef,signature:e.signature,alteration:e.type==='note'?e.notes[0].a:null,open:e.open,inversion:e.inversion,duplicates:e.duplicates};r.completed++;r.totalMs+=Math.max(0,Math.round(time));if(e.attempts===1&&time<=1800)r.fastCount++;store.records[e.id]=r;
 if(data.session){data.session.completed++;data.session[e.type==='note'?'notes':'chords']++}
 setFeedback('¡Correcto! '+(e.type==='note'?fmt(e.notes[0]):'Acorde completado')+'.','ok');updateSession();persist();
 const willPlay=!(settings.method==='midi'&&settings.muteMidi);
 const soundMs=willPlay?playSuccess(e.notes):0;
 data.advance=setTimeout(()=>{data.advance=null;if(!data.pause&&!data.ended&&data.tab==='practice')newExercise()},Math.max(settings.delay,soundMs));
}
function reveal(){const e=data.exercise;if(!e||e.shown)return;e.shownSolution=true;setFeedback(e.type==='note'?'Solución: '+fmt(e.notes[0]):`Solución: ${e.interpretations.map(a=>rootName(ROOTS[a.root])+ ' '+FAMILIES.find(f=>f.id===a.quality).name+' ('+a.inversion+'ª inversión)').join(' / ')} · ${e.notes.map(fmt).join(', ')}`,'err');}
function inputError(input,correct){input.classList.toggle('is-correct',correct);input.classList.toggle('is-wrong',!correct)}
function noteAnswer(answer,strict=true,pressed=null){const e=data.exercise;if(!e||e.type!=='note'||e.shown||data.pause||data.ended||data.tab!=='practice')return;
 const ok=strict?strictEq(answer,e.notes[0]):answer===midi(e.notes[0]);if(answer===null){setFeedback('Escribe una nota válida, por ejemplo Do4, Fa#5 o Sibb3.','err');inputError($('note-input'),false);return}
 recordAttempt(ok);if(ok){if(pressed)pressed.classList.add('selected');inputError($('note-input'),true);finishExercise()}
 else{recordMistake();if(pressed)pressed.classList.add('is-wrong');inputError($('note-input'),false);setFeedback(settings.feedback==='show'?`Incorrecto. La nota es ${fmt(e.notes[0])}. Inténtalo otra vez.`:'Incorrecto. Revisa la nota, alteración u octava.','err');if(settings.method==='text'){$('note-input').focus();$('note-input').select()}}
}
function identifyChord(){const e=data.exercise;if(!e||e.type!=='chord')return false;
 const root=$('chord-root').value,quality=$('chord-quality').value,inv=$('chord-inversion').value;
 const locks=e.identityLocks;
 const validRoot=root!==''&&e.interpretations.some(x=>x.root===Number(root));
 const validQuality=validRoot&&e.interpretations.some(x=>x.root===Number(root)&&x.quality===quality);
 const validInv=validQuality&&inv!==''&&e.interpretations.some(x=>x.root===Number(root)&&x.quality===quality&&x.inversion===Number(inv));
 for(const [name,correct] of [['root',validRoot],['quality',validQuality],['inversion',validInv]]){
   const el=$('chord-'+name);if(locks[name])continue;if(correct){locks[name]=true;inputError(el,true);el.disabled=true;}else{el.classList.add('is-wrong');el.classList.remove('is-correct')}
 }
 e.identityComplete=validInv;
 return validInv;
}
function textNotesCheck(){const e=data.exercise;let errors=0;
 e.notes.forEach((n,i)=>{const input=$(`chord-note-${i}`);if(e.lockedNotes[i])return;const p=parseNote(input.value),correct=strictEq(p,n);inputError(input,correct);if(correct){e.lockedNotes[i]=true;input.disabled=true;setLabel(`chord-state-${i}`,'Correcta')}else{errors++;setLabel(`chord-state-${i}`,'Revisar')}});
 return {ok:e.lockedNotes.every(Boolean),errors};
}
function submitChord(){const e=data.exercise;if(!e||e.type!=='chord'||e.shown||data.pause||data.ended||data.tab!=='practice')return;
 const harmony=identifyChord();const textMode=settings.method==='text';const notes=textMode?textNotesCheck():{ok:e.midiComplete||e.virtualComplete,errors:0};const ok=harmony&&notes.ok;
 recordAttempt(ok);if(ok){finishExercise();return}
 const errors=(harmony?0:1)+notes.errors;recordMistake(errors);
 const solution=settings.feedback==='show'?(harmony?'':`Identificación posible: ${rootName(ROOTS[e.interpretations[0]?.root??e.rootPc])} ${FAMILIES.find(f=>f.id===e.interpretations[0]?.quality)?.name||'acorde'} (${e.interpretations[0]?.inversion??e.inversion}ª inversión). `)+(notes.ok?'':`Notas: ${e.notes.map(fmt).join(', ')}.`):'Revisa los apartados marcados en rojo. Los correctos permanecen bloqueados.';
 setFeedback(settings.feedback==='show'?'Revisa tu respuesta. '+solution:'Hay apartados incorrectos. '+solution,'err');
}
function chordNotesByMidi(got,origin='midi'){
 const e=data.exercise;if(!e||e.type!=='chord'||e.shown||data.pause||data.ended||data.tab!=='practice')return;
 const target=e.notes.map(midi).sort((a,b)=>a-b),actual=[...got].sort((a,b)=>a-b);
 const ok=target.length===actual.length&&target.every((v,i)=>v===actual[i]);
 if(origin==='midi')e.midiComplete=ok;else e.virtualComplete=ok;
 if(!ok){recordAttempt(false);recordMistake();setFeedback(settings.feedback==='show'?`Teclas incorrectas. Las alturas son ${e.notes.map(fmt).join(', ')}.`:'Las teclas pulsadas no coinciden con el acorde. Inténtalo otra vez.','err');}
 else{setFeedback('Teclas correctas. Completa la identificación del acorde si falta algún apartado.','ok');if(e.identityComplete){recordAttempt(e.attempts===0);finishExercise()}else setLabel('practice-message','Las alturas están correctas. Comprueba ahora el nombre, tipo e inversión.');}
}
function processVirtual(m,button){const e=data.exercise;if(!e||e.shown||data.pause||data.ended)return;
 if(e.type==='note'){noteAnswer(m,false,button);return}
 if(data.selectedVirtual.has(m)){data.selectedVirtual.delete(m)}else{data.selectedVirtual.add(m)}paintVirtual();}
function paintVirtual(){document.querySelectorAll('#keyboard button[data-midi]').forEach(el=>{el.classList.toggle('selected',data.selectedVirtual.has(Number(el.dataset.midi)));el.classList.remove('is-wrong')})}
function drawKeyboard(){const box=$('keyboard');box.replaceChildren();const whiteNotes=[];for(let m=21;m<=108;m++){if(![1,3,6,8,10].includes(mod(m,12)))whiteNotes.push(m)}
 const W=36;box.style.width=whiteNotes.length*W+'px';
 whiteNotes.forEach((m,i)=>{let b=document.createElement('button');b.type='button';b.className='piano-white';b.style.left=(i*W)+'px';b.dataset.midi=m;const octave=Math.floor(m/12)-1;const letter=['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'][m%12];b.textContent=m%12===0?'Do'+octave:'';b.title=letter+octave;b.setAttribute('aria-label',b.title);b.addEventListener('click',()=>processVirtual(m,b));box.appendChild(b)});
 for(let m=21;m<=108;m++){if(![1,3,6,8,10].includes(mod(m,12)))continue;const prev=whiteNotes.filter(n=>n<m).length-1;const b=document.createElement('button');b.type='button';b.className='piano-black';b.style.left=(prev*W+W-11.5)+'px';b.dataset.midi=m;b.title='Tecla negra MIDI '+m;b.setAttribute('aria-label',b.title);b.addEventListener('click',()=>processVirtual(m,b));box.appendChild(b)}
}
function playSuccess(notes){try{
 const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return 0;
 if(!data.audio)data.audio=new Audio();const ctx=data.audio;ctx.resume();
 const start=ctx.currentTime+.005;for(const n of notes){const freq=440*Math.pow(2,(midi(n)-69)/12);let gain=ctx.createGain(),filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=Math.min(7900,Math.max(1300,freq*12));filter.Q.value=.3;gain.connect(filter);filter.connect(ctx.destination);
 gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.min(.1,.38/Math.max(3,notes.length)),start+.014);gain.gain.exponentialRampToValueAtTime(.0001,start+.72);
 for(let k=1;k<=3;k++){const osc=ctx.createOscillator(),harm=ctx.createGain();osc.type=k===1?'triangle':'sine';osc.frequency.setValueAtTime(freq*k,start);harm.gain.value=[.68,.17,.055][k-1];osc.connect(harm);harm.connect(gain);osc.start(start);osc.stop(start+.76)}}return 800;
 }catch(e){return 0}}
function connectMidi(){if(!navigator.requestMIDIAccess){setLabel('midi-state','Este navegador no admite Web MIDI');setLabel('midi-hint','Utiliza Chrome/Edge en localhost o HTTPS.');return}
 navigator.requestMIDIAccess({sysex:false}).then(access=>{data.midi=access;access.onstatechange=setupMidiInputs;setupMidiInputs();try{if(!data.audio&&(window.AudioContext||window.webkitAudioContext))data.audio=new (window.AudioContext||window.webkitAudioContext)();data.audio?.resume()}catch{}}).catch(err=>{setLabel('midi-state','No se pudo conectar el piano');setLabel('midi-hint',(err&&err.message)||'Comprueba los permisos del navegador y la conexión USB-MIDI.');});}
function setupMidiInputs(){if(!data.midi)return;data.midiInputs=[...data.midi.inputs.values()].filter(x=>x.state==='connected');const select=$('midi-device');select.replaceChildren();for(const input of data.midiInputs){const op=document.createElement('option');op.value=input.id;op.textContent=input.name||'Entrada MIDI';select.appendChild(op);input.onmidimessage=handleMidi}
 hidden('midi-selection',!data.midiInputs.length);setLabel('midi-state',data.midiInputs.length?'Piano MIDI conectado':'No se detectan entradas MIDI');setLabel('midi-hint',data.midiInputs.length?'Pulsa las teclas para responder. En acordes, todas a la vez.':'Conecta el piano por USB-MIDI y vuelve a intentarlo.');}
function handleMidi(ev){if(settings.method!=='midi'||data.tab!=='practice'||data.pause||data.ended||!data.exercise)return;
 const device=$('midi-device').value;if(device && ev.currentTarget?.id!==device)return;
 const [status,note,velocity]=ev.data||[];const kind=status&0xf0;if(kind===0x80||(kind===0x90&&velocity===0)){data.midiHeld.delete(note);if(!data.midiHeld.size){data.awaitRelease=false}return}
 if(kind!==0x90||!velocity)return;
 if(data.awaitRelease)return;data.midiHeld.add(note);setLabel('midi-played','Teclas pulsadas: '+[...data.midiHeld].sort((a,b)=>a-b).map(m=>midiName(m)).join(' · '));
 const e=data.exercise;if(e.type==='note'){noteAnswer(note,false);return}
 data.midiNotes.add(note);if(!data.midiWindow){data.midiWindow=setTimeout(()=>{data.midiWindow=null;const got=new Set([...data.midiHeld].filter(n=>data.midiNotes.has(n)));data.midiNotes.clear();data.awaitRelease=true;chordNotesByMidi(got);},300)}
}
function midiName(m){const names=['Do','Do♯','Re','Mi♭','Mi','Fa','Fa♯','Sol','Sol♯','La','Si♭','Si'];return names[mod(m,12)]+(Math.floor(m/12)-1)}
function submitNotes(){noteAnswer(parseNote($('note-input').value),true)}
function activateTab(tab){if(data.tab==='practice'&&tab!=='practice'){pauseExercise();if(data.session&&!data.pause&&!data.ended)data.session.duration=sessionTime()}data.tab=tab;document.querySelectorAll('.tab').forEach(btn=>{btn.classList.toggle('active',btn.dataset.tab===tab);if(btn.dataset.tab===tab)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current')});document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id!=='view-'+tab));
 if(tab==='practice'&&!data.pause&&!data.ended){if(data.exercise?.shown||!data.exercise)newExercise();resumeExercise();if(data.session)data.elapsedStart=Date.now()}
 if(tab==='stats')renderStats();updateSession();}
function pauseSession(){if(data.ended)return;ensureSession();if(data.pause){data.pause=false;data.elapsedStart=Date.now();if(data.exercise?.shown)newExercise();resumeExercise()}else{pauseExercise();data.session.duration=sessionTime();data.pause=true}hidden('paused-overlay',!data.pause);updateSession();persist()}
function finishSession(){if(data.ended)return;ensureSession();if(!data.pause){pauseExercise();data.session.duration=sessionTime()};const s=clone(data.session);s.finished=new Date().toISOString();store.sessions.unshift(s);store.sessions=store.sessions.slice(0,300);data.session=null;data.ended=true;data.pause=false;clearTimeout(data.advance);hidden('paused-overlay',true);hidden('ended-overlay',false);setLabel('ended-summary',`${s.completed} ejercicios · ${s.attempts?Math.round(s.first/s.attempts*100):0} % al primer intento · ${formatTime(s.duration)} de práctica.`);persist();updateSession()}
function newSession(){data.ended=false;data.pause=false;data.mixCounts={note:0,chord:0};hidden('ended-overlay',true);ensureSession();newExercise();updateSession()}
function renderStats(){const rows=Object.values(store.records).filter(r=>r.seen>0);const seen=rows.reduce((v,r)=>v+r.seen,0),hits=rows.reduce((v,r)=>v+r.first,0),solved=rows.reduce((v,r)=>v+r.completed,0),total=rows.reduce((v,r)=>v+(r.firstMs||0),0),validTimes=rows.reduce((v,r)=>v+(r.firstMsCount||0),0);
 const cards=[['Intentos',seen],['Precisión al primer intento',seen?Math.round(hits/seen*100)+' %':'—'],['Ejercicios resueltos',solved],['Tiempo medio de primera respuesta',validTimes?(total/validTimes/1000).toFixed(1).replace('.',',')+' s':'—']];
 $('stats-overview').replaceChildren();for(const [label,val] of cards){const b=document.createElement('div');b.className='metric';const s=document.createElement('span'),strong=document.createElement('strong');s.textContent=label;strong.textContent=val;b.append(s,strong);$('stats-overview').appendChild(b)}
 const weak=rows.slice().sort((a,b)=>a.first/a.seen-b.first/b.seen||b.errors-a.errors).slice(0,12);
 fillBars('weak-stats',weak.map(r=>({label:r.label||'Nota',pct:Math.round(r.first/r.seen*100),detail:`${r.first}/${r.seen}`})));
 const groups={};
 function countGroup(label,r){groups[label]??={seen:0,first:0};groups[label].seen+=r.seen;groups[label].first+=r.first}
 for(const r of rows){
   if(r.kind==='notes'){
     const label=r.alteration===null||r.alteration===undefined?'Notas (estadísticas antiguas)':Math.abs(r.alteration)===2?'Dobles alteraciones':Math.abs(r.alteration)===1?'Sostenidos y bemoles':'Notas naturales';
     countGroup(label,r);
   }else{
     countGroup('Acordes · '+(FAMILIES.find(f=>f.id===r.family)?.name||'Otros'),r);
     if(r.open!==undefined)countGroup(r.open?'Posiciones abiertas':'Posiciones cerradas',r);
     if(r.inversion>0)countGroup('Inversiones',r);
     if(r.duplicates)countGroup('Acordes con duplicaciones',r);
   }
   if(r.clef)countGroup('Clave de '+(r.clef==='treble'?'sol':'fa'),r);
 }
 fillBars('category-stats',Object.entries(groups).map(([label,r])=>({label,pct:Math.round(r.first/r.seen*100),detail:`${r.first}/${r.seen}`})).sort((a,b)=>b.pct-a.pct));
 $('sessions-list').replaceChildren();if(!store.sessions.length){const e=document.createElement('p');e.className='empty';e.textContent='Las sesiones finalizadas aparecerán aquí.';$('sessions-list').appendChild(e)}else for(const s of store.sessions.slice(0,15)){const row=document.createElement('div');row.className='session-row';const date=new Date(s.date).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'});const one=document.createElement('strong');one.textContent=date;const two=document.createElement('span');two.textContent=`${s.completed} ejercicios · ${s.attempts?Math.round(s.first/s.attempts*100):0}% · ${formatTime(s.duration)}`;row.append(one,two);$('sessions-list').appendChild(row)}
}
function fillBars(id,items){const target=$(id);target.replaceChildren();if(!items.length){const e=document.createElement('p');e.className='empty';e.textContent='Todavía no hay datos. Practica algunas notas para empezar.';target.appendChild(e);return}
 for(const x of items){const box=document.createElement('div');box.className='stat-line';const head=document.createElement('div');head.className='stat-title';const name=document.createElement('strong');name.textContent=x.label;const val=document.createElement('span');val.textContent=`${x.pct}% · ${x.detail}`;head.append(name,val);const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill';fill.style.width=x.pct+'%';fill.style.background=x.pct>=85?'#259d79':x.pct>=60?'#c8a04c':'#cf7582';track.appendChild(fill);box.append(head,track);target.appendChild(box)}
}
function exportData(){persist();const payload=JSON.stringify({...store,exported:new Date().toISOString()},null,2);const blob=new Blob([payload],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='clara-copia-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function importData(file){if(!file)return;try{const parsed=JSON.parse(await file.text());if(parsed.version!==2||!parsed.records||!Array.isArray(parsed.sessions)||!parsed.settings)throw new Error('Archivo no compatible.');const yes=confirm('¿Quieres RESTAURAR esta copia? Se sustituirán las estadísticas actuales. Pulsa Cancelar para elegir combinación.');if(yes){store={version:2,settings:{...clone(DEFAULT),...parsed.settings},records:parsed.records,sessions:parsed.sessions.slice(0,300),serial:parsed.serial||0}}else{if(!confirm('¿Combinar sin duplicar sesiones? Se conservará para cada ejercicio el historial con más intentos, para evitar duplicar los datos de una copia anterior.'))return;for(const [key,value] of Object.entries(parsed.records)){if(!store.records[key]||store.records[key].seen<value.seen)store.records[key]=value}const ids=new Set(store.sessions.map(s=>s.id));for(const s of parsed.sessions){if(s.id&&!ids.has(s.id)){store.sessions.push(s);ids.add(s.id)}}store.sessions.sort((a,b)=>new Date(b.date)-new Date(a.date));store.sessions=store.sessions.slice(0,300)}settings=store.settings;data.session=null;data.ended=false;data.pause=false;hidden('ended-overlay',true);hidden('paused-overlay',true);ensureSession();persist();renderSettings();renderStats();newExercise();alert('Copia importada correctamente.')}catch(err){alert('No se pudo importar el archivo: '+err.message)}finally{$('import-file').value=''}}
function initSettings(){const ks=$('key-signature');ks.innerHTML='<option value="random">Todas (aleatoria)</option>';for(let i=-7;i<=7;i++){const opt=document.createElement('option');opt.value=String(i);opt.textContent=(i>0?i+' ♯ · ':i<0?Math.abs(i)+' ♭ · ':'Sin alteraciones · ')+SIGNATURES[i];ks.appendChild(opt)}
 for(const id of ['min-octave','max-octave'])for(let o=0;o<=8;o++){const op=document.createElement('option');op.value=o;op.textContent=`Octava ${o}`;$(id).appendChild(op)}
 const rootSel=$('chord-root');rootSel.innerHTML='<option value="">Selecciona fundamental…</option>';ROOTS.forEach((r,i)=>{const op=document.createElement('option');op.value=pitchClass({...r,o:4});op.textContent=rootName(r);rootSel.appendChild(op)});
 const q=$('chord-quality');q.innerHTML='<option value="">Selecciona tipo…</option>';FAMILIES.forEach(f=>{const op=document.createElement('option');op.value=f.id;op.textContent=f.name;q.appendChild(op)});
 const i=$('chord-inversion');i.innerHTML='<option value="">Selecciona inversión…</option>';['Estado fundamental','Primera inversión','Segunda inversión','Tercera inversión'].forEach((name,idx)=>{const op=document.createElement('option');op.value=idx;op.textContent=name;i.appendChild(op)});
 const families=$('family-options'),roots=$('root-options');FAMILIES.forEach(f=>{const l=document.createElement('label');const inp=document.createElement('input');inp.type='checkbox';inp.value=f.id;inp.dataset.family=f.id;l.append(inp,document.createTextNode(f.name));families.appendChild(l)});ROOTS.forEach((r,i)=>{const l=document.createElement('label');const inp=document.createElement('input');inp.type='checkbox';inp.value=i;inp.dataset.root=i;l.append(inp,document.createTextNode(rootName(r)));roots.appendChild(l)});
}
function renderSettings(){settingReady=false;for(const [id,k] of [['preset','preset'],['strategy','strategy'],['clef','clef'],['key-signature','signature'],['accidentals','accidentals'],['min-octave','minOct'],['max-octave','maxOct'],['feedback-mode','feedback'],['note-percent','notePercent'],['advance-delay','delay']])$(id).value=String(settings[k]);
 for(const [id,k] of [['use-inversions','inversions'],['use-open','open'],['use-duplicates','duplicates'],['mute-midi','muteMidi']])$(id).checked=settings[k];
 document.querySelectorAll('[data-family]').forEach(x=>x.checked=settings.families.includes(x.dataset.family));document.querySelectorAll('[data-root]').forEach(x=>x.checked=settings.roots.includes(Number(x.dataset.root)));
 $('quick-kind').value=settings.kind;$('quick-method').value=settings.method;setLabel('note-percent-label',settings.notePercent+' %');$('bar-notes').style.width=settings.notePercent+'%';$('bar-chords').style.width=(100-settings.notePercent)+'%';setLabel('delay-label',settings.delay+' ms');setLabel('current-strategy','Selección '+({random:'aleatoria',balanced:'equilibrada',adaptive:'adaptativa'}[settings.strategy]||''));settingReady=true;
}
function bindSettings(){const mappings={'strategy':'strategy','clef':'clef','key-signature':'signature','accidentals':'accidentals','min-octave':'minOct','max-octave':'maxOct','feedback-mode':'feedback','note-percent':'notePercent','advance-delay':'delay'};
 for(const [id,key] of Object.entries(mappings))$(id).addEventListener(id==='note-percent'||id==='advance-delay'?'input':'change',()=>{if(!settingReady)return;let val=$(id).value;if(['minOct','maxOct','notePercent','delay'].includes(key))val=Number(val);settings[key]=val;if(key==='minOct'&&settings.minOct>settings.maxOct)settings.maxOct=settings.minOct;if(key==='maxOct'&&settings.maxOct<settings.minOct)settings.minOct=settings.maxOct;settings.preset='custom';persist();renderSettings()});
 for(const [id,key] of [['use-inversions','inversions'],['use-open','open'],['use-duplicates','duplicates'],['mute-midi','muteMidi']])$(id).addEventListener('change',()=>{settings[key]=$(id).checked;settings.preset='custom';persist();renderSettings()});
 $('preset').addEventListener('change',()=>{const val=$('preset').value;settings.preset=val;if(PRESETS[val])Object.assign(settings,clone(PRESETS[val]));persist();renderSettings()});
 $('family-options').addEventListener('change',()=>{settings.families=[...document.querySelectorAll('[data-family]:checked')].map(e=>e.dataset.family);settings.preset='custom';persist();renderSettings()});
 $('root-options').addEventListener('change',()=>{settings.roots=[...document.querySelectorAll('[data-root]:checked')].map(e=>Number(e.dataset.root));settings.preset='custom';persist();renderSettings()});
 $('all-families').addEventListener('click',()=>{settings.families=FAMILIES.map(f=>f.id);settings.preset='custom';persist();renderSettings()});
 $('all-roots').addEventListener('click',()=>{settings.roots=ROOTS.map((_,i)=>i);settings.preset='custom';persist();renderSettings()});
 $('reset-settings').addEventListener('click',()=>{if(!confirm('¿Restablecer solo la configuración? Tus estadísticas se conservarán.'))return;settings=store.settings=clone(DEFAULT);persist();renderSettings()});
}
function listen(){document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
 $('quick-kind').addEventListener('change',()=>{settings.kind=$('quick-kind').value;persist();newExercise()});$('quick-method').addEventListener('change',()=>{settings.method=$('quick-method').value;persist();newExercise()});
 $('note-submit').addEventListener('click',submitNotes);$('note-input').addEventListener('keydown',ev=>{if(ev.key==='Enter')submitNotes()});$('note-input').addEventListener('input',()=> $('note-input').classList.remove('is-wrong'));
 $('chord-submit').addEventListener('click',submitChord);$('reinterpret').addEventListener('click',()=>{const e=data.exercise;if(!e||e.type!=='chord'||e.shown)return;e.identityLocks={root:false,quality:false,inversion:false};e.identityComplete=false;for(const id of ['chord-root','chord-quality','chord-inversion']){$(id).disabled=false;$(id).value='';$(id).classList.remove('is-wrong','is-correct')}});
 $('virtual-check').addEventListener('click',()=>chordNotesByMidi(data.selectedVirtual,'virtual'));
 $('midi-connect').addEventListener('click',connectMidi);
 $('skip').addEventListener('click',()=>{if(!data.pause&&!data.ended)newExercise()});$('reveal').addEventListener('click',reveal);
 $('pause-session').addEventListener('click',pauseSession);$('resume-session').addEventListener('click',pauseSession);$('finish-session').addEventListener('click',finishSession);$('new-session').addEventListener('click',newSession);
 $('export-data').addEventListener('click',exportData);$('import-data').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',ev=>importData(ev.target.files[0]));
 $('clear-data').addEventListener('click',()=>{if(!confirm('¿Borrar todas tus estadísticas e historial? Esta acción no se puede deshacer.'))return;store.records={};store.sessions=[];if(data.session){data.session.completed=0;data.session.first=0;data.session.attempts=0;data.session.errors=0}persist();renderStats()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(data.tab==='practice'&&!data.pause)pauseExercise();if(data.session&&!data.pause){data.session.duration=sessionTime();data.elapsedStart=Date.now()}}else{if(data.tab==='practice'&&!data.pause&&!data.ended){resumeExercise();data.elapsedStart=Date.now()}}});
 window.addEventListener('beforeunload',persist);
}
function boot(){initSettings();renderSettings();bindSettings();listen();drawKeyboard();if(store.activeSession&&!store.activeSession.finished){data.session=store.activeSession;data.elapsedStart=Date.now()}else ensureSession();newExercise();setInterval(updateTimers,300);updateSession();}
boot();
})();
