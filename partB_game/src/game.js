// ===== Machine Whisperer 3D | game.js =====
// State, console, dispatch (coach), teaching loop, shift report. Pure rules: logic.js. 3D parts: scene.js.
const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
const OBJ=['Explain why data is split into <b>train, validation and test</b> sets',
 'Spot <b>overfitting and underfitting</b> from the train-validation gap',
 'Explain why <b>accuracy misleads</b> on rare failures and choose an alarm threshold with <b>precision and recall</b>',
 'Build <b>features</b> from physics and reject <b>leaky</b> ones'];
// ---------- field manual: one entry per idea (title, explanation, when to use it) ----------
const CON={
 split:['Train / validation / test split','You never grade a model on the machines it studied. <b>Train</b> = the logs you pulled. <b>Validation</b> = the bench pods, held back and used to tune. <b>Test</b> = the live floor (the real future), judged only when you deploy a shift.','You want an honest estimate of performance on data the model has never seen. Split first, then look at scores.'],
 overfit:['Overfitting','With k = 1 the model just copies the single closest machine. It scores almost 100% on the logs it already knows but clearly lower on the validation bench: it memorised noise (random failures, failures its sensors cannot see) instead of the pattern.','Train score is far above validation score. Fix: smoother model (bigger k), more data, fewer noisy inputs.'],
 underfit:['Underfitting and bias vs variance','Push k too high and every prediction becomes a blurry crowd average: train AND validation drop. Very flexible models (small k) have high <b>variance</b>; very rigid ones (large k) have high <b>bias</b>. The best model sits in between.','Both train and validation scores are low. Fix: a more flexible model or better features.'],
 imbalance:['Class imbalance: the accuracy trap','When only about 1 machine in 5 fails, "never raise an alarm" is already ~80% accurate and catches nothing. Accuracy hides the problem. Check <b>recall</b> (failures caught) and <b>precision</b> (alarms that were real). In the real dataset only 3.4% of cycles fail, so it is even worse.','Positives are rare. Report recall, precision, PR-AUC or cost. Never accuracy alone.'],
 threshold:['Precision vs recall: the alarm threshold','A model outputs a risk score; <i>you</i> decide the cut-off. A lower threshold catches more real failures (recall up) but sends the crew to healthy machines (precision down). With a limited crew the best threshold depends on what a miss costs versus a wasted visit.','You must turn a score into a yes/no action. Choose the threshold from costs, using validation data (never test).'],
 feature:['Feature engineering and selection','Raw sensors tell the model less than physics does: <b>power = torque × speed</b>, <b>heat gap = process − air temperature</b>, <b>strain = wear × torque</b>. Each one turns a failure region into a single easy axis. Dropping distractors (like air temperature) helps too.','Raw columns hide the pattern. Build features from domain knowledge, keep only those that help on validation.'],
 leakage:['Data leakage','The repair ticket is written only <b>after</b> a breakdown, so on historical machines it "predicts" the outcome perfectly (validation looked amazing) but it is blank on live machines, so the model sees no danger and misses everything.','A score looks too good to be true, or live results collapse. Ask: would this feature exist at prediction time?']};
const WHEN=[['My model aces its training logs but not new machines','overfit'],['Both train and validation scores are poor','underfit'],['Is my score honest?','split'],['Almost nothing fails, so accuracy looks great','imbalance'],['How risky is risky enough to act?','threshold'],['What should the model look at?','feature'],['My validation score is too good to be true','leakage']];
const FD={torque:'Turning force on the tool.',wear:'Minutes the tool has been cutting. Worn tools snap.',rpm:'Spindle speed.',air:'Workshop air temperature. Barely relevant: a distractor.',proc:'Temperature at the cut.',
 power:'<b>Engineered:</b> torque × speed = mechanical power. Too little or too much breaks the process.',dT:'<b>Engineered:</b> process − air temperature. A small gap at low speed = heat cannot escape.',strain:'<b>Engineered:</b> tool wear × torque = cumulative overstrain.',ticket:'Written when a breakdown is logged. Is it available <i>before</i> a failure?'};
const CODE={torque:'TRQ',wear:'WEAR',rpm:'RPM',air:'AIR',proc:'PROC',power:'PWR',dT:'dT',strain:'STRN',ticket:'TKT'};
const WHY={1:['Tool-wear failures strike at a random wear time (200-240 min): partly predictable, never certain.',null,''],
 2:['Heat could not escape (small heat gap at low speed).',m=>m.includes('dT')||(m.includes('air')&&m.includes('proc')),'Switch on the dT (heat gap) feature and keep RPM.'],
 3:['Spindle power left the safe 3.5-9 kW band.',m=>m.includes('power')||(m.includes('torque')&&m.includes('rpm')),'The PWR (power) feature shows this directly.'],
 4:['Wear × torque passed the strain limit.',m=>m.includes('strain')||(m.includes('wear')&&m.includes('torque')),'The STRN (wear × torque) feature shows this directly.'],
 5:['A purely random failure: no sensor can predict it (irreducible error).',null,''],0:['No failure mode was recorded: noise nobody can predict.',null,'']};
const SHORT=['','wear','heat','power','strain','random'];
const STEPS=['DATA','VALIDATE','TUNE','DEPLOY','REVIEW'];
// ---------- little diagrams for the manual cards ----------
const FIG=(()=>{const t=(x,y,s,c='currentColor',a='middle')=>`<text x="${x}" y="${y}" fill="${c}" font-size="8.5" font-family="ui-monospace,Menlo,monospace" text-anchor="${a}">${s}</text>`;
 const svg=b=>`<svg class="fig" viewBox="0 0 240 96" fill="none" stroke-width="1.6">${b}</svg>`;
 const pts=(a,c)=>a.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.7" fill="${c}" stroke="none"/>`).join('');
 return{
 split:svg(`<rect x="8" y="26" width="128" height="30" fill="#35e0ff22" stroke="#35e0ff"/>${t(72,45,'TRAIN','#35e0ff')}<rect x="140" y="26" width="46" height="30" fill="#ffb81c22" stroke="#ffb81c"/>${t(163,45,'VALID.','#ffb81c')}<rect x="190" y="26" width="42" height="30" fill="#38f2a522" stroke="#38f2a5"/>${t(211,45,'TEST','#38f2a5')}${t(72,74,'fit the model','#7e97ab')}${t(163,74,'tune','#7e97ab')}${t(211,74,'judge once','#7e97ab')}`),
 overfit:svg(`${pts([[20,60],[45,40],[70,64],[95,34],[120,58],[145,30],[170,52],[195,38],[220,56]],'#d6e6f2')}<path d="M20 60L45 40L70 64L95 34L120 58L145 30L170 52L195 38L220 56" stroke="#ffb81c"/><path d="M14 58C70 50 120 44 226 46" stroke="#35e0ff" stroke-dasharray="4 3"/>${t(120,88,'amber: memorises noise · cyan: the real trend','#7e97ab')}`),
 underfit:svg(`${pts([[20,70],[45,54],[70,42],[95,35],[120,33],[145,36],[170,44],[195,56],[220,72]],'#d6e6f2')}<path d="M12 50H228" stroke="#ffb81c"/><path d="M12 76C60 40 90 28 120 28C150 28 180 40 228 76" stroke="#35e0ff" stroke-dasharray="4 3"/>${t(120,90,'amber: too rigid · cyan: the real curve','#7e97ab')}`),
 imbalance:svg([...Array(20)].map((_,i)=>`<rect x="${14+(i%10)*22}" y="${12+((i/10)|0)*22}" width="17" height="17" fill="${[3,7,12,17].includes(i)?'#ff4f5e':'#1d3b52'}" stroke="none"/>`).join('')+t(120,68,'4 failing in 20: "never alarm" is 80% accurate','#d6e6f2')+t(120,84,'...and catches 0 failures','#ff4f5e')),
 threshold:svg(`<path d="M16 76C45 76 58 18 82 18C106 18 116 76 146 76" stroke="#38f2a5"/><path d="M92 76C122 76 134 28 158 28C182 28 192 76 226 76" stroke="#ff4f5e"/><path d="M121 8V80" stroke="#ffb81c" stroke-width="2.4"/>${t(121,91,'threshold','#ffb81c')}${t(44,14,'healthy','#38f2a5')}${t(200,24,'failing','#ff4f5e')}`),
 feature:svg(`${pts([[22,70],[34,56],[44,64],[58,44],[66,58],[80,36],[92,50],[40,36],[70,70],[86,66]],'#7e97ab')}<path d="M22 24C40 54 70 74 100 80" stroke="#ffb81c"/>${t(6,92,'raw: curved boundary','#7e97ab','start')}<path d="M112 48H130" stroke="#d6e6f2"/><path d="M126 44L130 48L126 52" stroke="#d6e6f2"/><rect x="140" y="38" width="30" height="20" fill="#ff4f5e33" stroke="none"/><rect x="170" y="38" width="36" height="20" fill="#38f2a533" stroke="none"/><rect x="206" y="38" width="26" height="20" fill="#ff4f5e33" stroke="none"/><path d="M140 48H232" stroke="#35e0ff"/>${t(234,32,'power = torque × rpm','#35e0ff','end')}${t(234,92,'one axis: easy to cut','#7e97ab','end')}`),
 leakage:svg(`<rect x="6" y="30" width="50" height="26" stroke="#35e0ff"/>${t(31,46,'SENSORS','#35e0ff')}<rect x="66" y="30" width="54" height="26" stroke="#38f2a5"/>${t(93,46,'PREDICT','#38f2a5')}<rect x="130" y="30" width="48" height="26" stroke="#ff4f5e"/>${t(154,46,'FAILURE','#ff4f5e')}<rect x="188" y="30" width="46" height="26" stroke="#ffb81c" stroke-dasharray="3 2"/>${t(211,46,'TICKET','#ffb81c')}<path d="M56 43H66M120 43H130M178 43H188" stroke="#7e97ab"/>${t(120,76,'the ticket only exists AFTER the failure','#ffb81c')}${t(93,20,'decide here','#38f2a5')}`)}})();
const ICO={on:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9c1.5 1.5 1.5 4.5 0 6M19.5 6.5c3 3 3 8 0 11"/></svg>',
 off:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
 man:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M5 3h14v18H5z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>'};
// ---------- feel: sound, haptics, notices ----------
let au,muted=false;const wake=()=>{try{au=au||new AudioContext();au.resume()}catch(e){}};
function beep(freq,dur=.14,wave='sine',vol=.07,delay=0){if(muted||!au)return;
 try{const t0=au.currentTime+delay,osc=au.createOscillator(),amp=au.createGain();osc.type=wave;osc.frequency.value=freq;
  amp.gain.setValueAtTime(vol,t0);amp.gain.exponentialRampToValueAtTime(.0008,t0+dur);osc.connect(amp);amp.connect(au.destination);osc.start(t0);osc.stop(t0+dur+.02)}catch(e){}}
function buzz(pattern){if(navigator.vibrate)try{navigator.vibrate(pattern)}catch(e){}}
function flash(m,ms=2400){const f=qs('#flash');f.textContent=m;f.classList.add('on');clearTimeout(flash.t);flash.t=setTimeout(()=>f.classList.remove('on'),ms)}
// ---------- overlay layers ----------
const modal=qs('#modal');
function openLayer(id,html,z=30){let l=qs('#'+id);if(!l){l=document.createElement('div');l.id=id;l.className='veil';modal.appendChild(l)}l.style.zIndex=z;l.innerHTML=html;return l}
function closeLayer(id){const l=qs('#'+id);l&&l.remove()}
// ---------- state ----------
let ST=null,seedBase=Math.floor(Math.random()*9e5);
const best=[0,0,0],seen={},manualQ=[],SESSION={start:Date.now(),levels:[],concepts:[]};
const labRows=()=>ST.arch.filter(c=>c.labeled).map(c=>c.row);
const objOf=(k,i)=>k=='a'?ST.arch[i]:k=='v'?ST.val[i]:ST.live[i];
// ---------- build a level ----------
function loadLevel(l){
 if(ST)scene.remove(ST.grp);droneReset();
 const L=LV[l],set=sample(L,seedBase+l*101),grp=new THREE.Group();scene.add(grp);
 const arch=[],val=[],live=[],picks=[],lines=new THREE.Group();grp.add(lines);
 // live floor: a ring of machines around the radar hub
 const fresh=set.live(),N=fresh.length,RR=4.4;
 fresh.forEach((row,i)=>{const a=(i+.5)/N*Math.PI*2,x=Math.sin(a)*RR,z=Math.cos(a)*RR,g=makeMachine(row);g.position.set(x,0,z);g.rotation.y=a;grp.add(g);
  const tag=makeTag(100,.3);tag.position.set(x,1.45,z);grp.add(tag);g.userData.hit.userData={k:'l',i};picks.push(g.userData.hit);
  live.push({row,g,u:g.userData,x,z,tag,risk:null,state:'',shake:0})});
 // archive rack: terraced cartridges (training logs), back of the plant
 const na=L.na,t0=Math.round(na*.35),t1=Math.round(na*.33);let ix=0;
 [t0,t1,na-t0-t1].forEach((n,t)=>{const r=6.9+t*.95,y=.28+t*.52,step=.74/r;
  for(let j=0;j<n;j++){const a=(j-(n-1)/2)*step,x=Math.sin(a)*r,z=-Math.cos(a)*r;
   part(BX(.52,y,.32),0x10202e,x,y/2,z,grp,{sh:1,rc:1}).lookAt(0,y/2,0);part(BX(.58,.04,.38),0x1f6c8c,x,y+.02,z,grp,{em:0x1f6c8c,ei:.9}).lookAt(0,y+.02,0);
   const g=makeCart();g.position.set(x,y+.04,z);g.lookAt(0,y+.04,0);grp.add(g);g.userData.hit.userData={k:'a',i:ix};picks.push(g.userData.hit);
   arch.push({row:set.arch[ix],g,u:g.userData,x,z,y:y+.04,labeled:0,pend:0,out:0});ix++}});
 // validation bench: small test pods in front
 const nv=L.nv,RB=6.6,sp=.44/RB;
 set.val.forEach((row,i)=>{const a=(i-(nv-1)/2)*sp,x=Math.sin(a)*RB,z=Math.cos(a)*RB,g=makePod();g.position.set(x,0,z);grp.add(g);
  const tag=makeTag(52,.26);tag.position.set(x,.66,z);grp.add(tag);g.userData.hit.userData={k:'v',i};picks.push(g.userData.hit);val.push({row,g,u:g.userData,x,z,tag,res:null})});
 [['ARCHIVE RACK · TRAINING LOGS',0,3.0,-8.9,270],['TEST BENCH · VALIDATION',0,.95,7.6,230],['LIVE FLOOR · TODAY IS THE TEST SET',0,.3,2.45,300]].forEach(([s,x,y,z,w])=>{const tg=makeTag(w,.46);tg.position.set(x,y,z);setTag(tg,s,'dim',24);grp.add(tg)});
 ST={lv:l,L,grp,arch,val,live,picks,lines,tokens:L.bud,k:L.k0,thr:L.thr0,ids:L.feats.slice(),flag:new Set(),valRes:null,nVal:0,kSeen:[99,0],thrMoved:0,busy:0,shifting:0,res:null,reviewed:0,shiftNo:0,hist:[],sel:null};
 qs('#sNo').innerHTML=`Sector ${l+1} of 3<span class="xs"> · ${L.sub}</span>`;qs('#sName').textContent=L.t;closeLayer('vRes');
 buildDials();showRo('');sizeAll();view.dist=view.goal*1.2;recompute();paintAll();renderPips()}
// ---------- model glue ----------
function recompute(){const lab=labRows();ST.live.forEach(m=>{m.risk=lab.length>=3?risk(m.row,lab,ST.ids,ST.k,false):null});
 ST.flag=new Set();if(lab.length>=3)ST.live.map((m,i)=>[i,m.risk]).filter(x=>x[1]>=ST.thr).sort((a,b)=>b[1]-a[1]).slice(0,ST.L.cap).forEach(x=>ST.flag.add(x[0]))}
function trainConf(){const lab=labRows();return conf(lab,lab.map(r=>risk(r,lab,ST.ids,Math.min(ST.k,lab.length),true)),ST.thr)}
// ---------- console: dials and switches ----------
function ledDial(id,label,vals,cur,fmt,lo,hi,cls=''){return`<div class="dial"><div class="dial-h"><span>${label}</span><b id="${id}V">${fmt(cur)}</b></div>
 <div class="dial-b"><button class="step" data-d="${id}" data-s="-1" aria-label="decrease">−</button><div class="leds ${cls}" id="${id}L">${vals.map(v=>`<button data-d="${id}" data-v="${v}" class="${v<=cur?'on':''}" aria-label="${fmt(v)}"></button>`).join('')}</div><button class="step" data-d="${id}" data-s="1" aria-label="increase">+</button></div>
 <div class="dial-s"><span>${lo}</span><span>${hi}</span></div></div>`}
function buildDials(){const L=ST.L,ks=[...Array(L.kMax)].map((_,i)=>i+1),ts=[...Array(17)].map((_,i)=>10+i*5);
 let h=ledDial('k','NEIGHBOURS THAT VOTE (k)',ks,ST.k,v=>v,'1 · copy closest machine',`${L.kMax} · blurry crowd average`);
 if(L.thrDial)h+=ledDial('t','ALARM THRESHOLD (flag if risk ≥)',ts,Math.round(ST.thr*100),v=>(v/100).toFixed(2),'low · cries wolf','high · misses failures','am');
 if(L.toggle){h+=`<div class="fx-h">MODEL LOOKS AT · tap to switch on/off</div><div class="sws">${Object.keys(FEATS).map(id=>`<button class="sw ${FEATS[id].eng?'eng':''} ${ST.ids.includes(id)?'on':''}" data-f="${id}"><code>${CODE[id]}</code>${FEATS[id].n}</button>`).join('')}</div><div class="legend"><b>amber</b> = engineered from physics</div>`}
 else h+=`<div class="fx-h">MODEL LOOKS AT · fixed this sector</div><div class="sws">${L.feats.map(id=>`<button class="sw fixed on" data-f="${id}"><code>${CODE[id]}</code>${FEATS[id].n}</button>`).join('')}</div>`;
 qs('#dials').innerHTML=h}
qs('#dials').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!ST)return;wake();beep(440,.05,'triangle',.05);buzz(8);
 if(b.dataset.f){const id=b.dataset.f;showRo(`<div class="ro-h"><span>${FEATS[id].n.toUpperCase()}</span><small>FEATURE</small></div><div class="ro-m">${FD[id]}</div>`);if(!ST.L.toggle)return;
  const i=ST.ids.indexOf(id);if(i>=0){if(ST.ids.length<2)return flash('KEEP AT LEAST ONE FEATURE ON');ST.ids.splice(i,1)}else ST.ids.push(id);b.classList.toggle('on');dialsChanged();return}
 const d=b.dataset.d;if(!d)return;const isK=d=='k',cur=isK?ST.k:Math.round(ST.thr*100),lim=isK?[1,ST.L.kMax]:[10,90],stp=isK?1:5;
 let v=b.dataset.v!=null?+b.dataset.v:cur+(+b.dataset.s)*stp;v=Math.max(lim[0],Math.min(lim[1],v));
 if(isK){ST.k=v;ST.kSeen=[Math.min(ST.kSeen[0],v),Math.max(ST.kSeen[1],v)]}else{ST.thr=v/100;if(Math.abs(ST.thr-ST.L.thr0)>=.15)ST.thrMoved=1}
 dialsChanged()});
function refreshDials(){const L=ST.L;[['k',ST.k,v=>v],['t',Math.round(ST.thr*100),v=>(v/100).toFixed(2)]].forEach(([id,cur,fmt])=>{const el=qs('#'+id+'V');if(!el)return;el.textContent=fmt(cur);qsa('#'+id+'L button').forEach(b=>b.classList.toggle('on',+b.dataset.v<=cur))})}
function dialsChanged(){refreshDials();ST.valRes&&(ST.valRes.stale=1);ST.val.forEach(v=>{v.res=null});paintAll()}
// ---------- readout (inspector): where a machine sits within the real data ----------
const SPEC=[['TORQUE','torque','Nm'],['WEAR','wear','min'],['SPEED','rpm','rpm'],['AIR','air','K'],['PROC','proc','K']];
function showRo(h){const r=qs('#readout');r.hidden=!h;r.innerHTML=h||''}
function select(k,i){const o=objOf(k,i),r=o.row;ST.lines.children.slice().forEach(c=>ST.lines.remove(c));ST.sel={k,i};
 const rows=SPEC.map(([n,f,u])=>`<span>${n}</span><u><s style="width:${Math.round(vec(r,[f])[0]*100)}%"></s></u><b>${r[f]} ${u}</b>`).join('');
 let h=`<div class="ro-h"><span>${k=='a'?'ARCHIVE LOG':k=='v'?'BENCH POD':'LIVE MACHINE'} #${r.id}</span><small>GRADE ${TYPES[r.type]}</small></div><div class="spec">${rows}</div>`;
 if(k=='a')h+=`<div class="ro-m">${o.labeled?`Outcome: <b>${r.y?'FAILED ('+MODES[r.mode||0]+')':'ran fine'}</b>`:'Outcome unknown. Pull the log (1 token).'}</div>`;
 if(k=='v')h+=`<div class="ro-m">Hidden outcome. Only used when you press VALIDATE.</div>`;
 const lab=labRows();
 if(k!='a'&&lab.length>=3){const nb=nearest(r,lab,ST.ids,ST.k),a=new THREE.Vector3(o.x,.62,o.z);
  nb.forEach(l=>{const c=ST.arch.find(q=>q.row===l);ST.lines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,new THREE.Vector3(c.x,c.y+.4,c.z)]),new THREE.LineBasicMaterial({color:l.y?0xff4f5e:0x38f2a5,transparent:true,opacity:.9})))});
  h+=`<div class="ro-m">Model: the ${nb.length} closest logged machine(s) (<b style="color:#ff4f5e">red</b> failed, <b style="color:#38f2a5">green</b> fine) say risk <b>${Math.round(risk(r,lab,ST.ids,ST.k,false)*100)}%</b>.</div>`}
 showRo(h);buzz(8)}
// ---------- dispatch (coach) ----------
function step(){const lab=labRows().length;return ST.reviewed?4:lab<4?0:!ST.nVal?1:ST.nVal<3?2:3}
function coach(){const lab=labRows().length,s=step(),L=ST.L;let m;
 const tune=['Turn the <b>k dial</b>, then VALIDATE again. Watch <b>TRAIN vs VALID</b>: which k generalises best?','Try the <b>ALARM THRESHOLD</b>: accuracy barely moves but <b>recall</b> does. Re-validate after each change.','Switch features on/off (try PWR, STRN, dT), then VALIDATE. If a score looks <b>too good</b>, ask why.'][ST.lv];
 if(s==0)m=`<b>Collect data.</b> Tap a cartridge on the back rack, or press <b>FETCH 5 RANDOM LOGS</b>. Each log costs 1 token (${ST.tokens} left).<i>Labels cost money in real life. These logs are your training set: spread your picks.</i>`;
 if(s==1)m=`<b>Validate honestly.</b> Press <b>VALIDATE</b>. The bench pods were never used for training.<i>The TRAIN score uses machines the model already knows; only the bench tells the truth.</i>`;
 if(s==2)m=`<b>Tune the model.</b> ${tune}<i>${L.tip}</i>`;
 if(s==3)m=`<b>Deploy.</b> ${ST.flag.size?`${ST.flag.size} machine(s) flagged (crew limit ${L.cap}). `:''}Press <b>DEPLOY SHIFT</b> when you trust the model, or keep tuning.<i>The live floor is the real test: it is checked only when you deploy.</i>`;
 if(s==4)m=`<b>Review.</b> Compare what validation <em>promised</em> with what the live floor <em>delivered</em>. ${L.tip}`;
 qs('#dm').innerHTML=m;qs('#dStep').textContent=`${s+1}/5`;
 qs('#steps').innerHTML=STEPS.map((x,i)=>`<li class="${i<s?'done':i==s?'now':''}">${x}</li>`).join('');
 qsa('.pulse').forEach(b=>b.classList.remove('pulse'));const hs=s==0?'#bPull5':s==1?'#bVal':s==3?'#bGo':'';if(hs&&!qs(hs).disabled)qs(hs).classList.add('pulse');
 const hot={0:'data',1:'deploy',2:'model',3:'deploy',4:'deploy'}[s];qsa('#tabs button').forEach(b=>b.classList.toggle('hot',b.dataset.t==hot&&!b.classList.contains('on')))}
qs('#dFold').onclick=e=>{e.stopPropagation();qs('#dispatch').classList.toggle('min');sizeAll()};qs('#dm').onclick=()=>qs('#dispatch').classList.toggle('open');
// ---------- telemetry ----------
function telemHtml(){const lab=labRows();if(lab.length<4)return`<div class="tm"><div class="tm-n">Need at least <b>4 logs</b> to build a model (${lab.length} so far).</div></div>`;
 const tc=trainConf(),Vr=ST.valRes,st=Vr&&Vr.stale?'stale':'',nul=Vr?Vr.base:null;
 const seg=(v,c,tick)=>`<div class="seg" style="--w:${Math.round(v*100)}%;--c:${c}"><i></i>${tick!=null?`<s style="left:${Math.round(tick*100)}%"></s>`:''}</div>`;
 let h=`<div class="tm"><div class="tm-r"><span>TRAIN</span>${seg(tc.acc,'var(--mt)')}<b>${Math.round(tc.acc*100)}%</b></div>`;
 h+=Vr?`<div class="tm-r ${st}"><span>VALID.</span>${seg(Vr.acc,'var(--cy)',nul)}<b>${Math.round(Vr.acc*100)}%</b></div>`:`<div class="tm-r"><span>VALID.</span><small style="color:var(--dim)">press VALIDATE</small><b></b></div>`;
 if(Vr){const gap=tc.acc-Vr.acc;h+=`<div class="${st}"><span class="gap ${gap>=.15?'bad':gap<=.06?'ok':''}">GAP ${Math.round(gap*100)} PTS${gap>=.15?' · MEMORISING':''}</span><div class="tm-n">amber tick = "never alarm" accuracy ${Math.round(nul*100)}%${ST.lv>0?`<br>valid. <b>recall ${Math.round(Vr.rec*100)}%</b> (failures caught) · <b>precision ${Math.round(Vr.prec*100)}%</b> (alarms that were real)`:''}${Vr.stale?'<br>model changed: validate again':''}</div></div>`}
 return h+'</div>'}
// ---------- paint everything from state ----------
function paintAll(){recompute();ST.live.forEach((m,i)=>paintLive(i));ST.arch.forEach(paintCart);ST.val.forEach(paintPod);
 const n=ST.L.bud;qs('#tokCells').innerHTML=[...Array(n)].map((_,i)=>`<i class="${i<ST.tokens?'':'off'}"></i>`).join('');qs('#tokNum').textContent=ST.tokens;
 qs('#telem').innerHTML=telemHtml();setTag(hubTag,labRows().length>=3?`MODEL · k=${ST.k} · ${labRows().length} LOGS`:'MODEL OFFLINE · PULL LOGS','cyan',26);
 const lab=labRows().length,idle=ST.busy||ST.shifting;qs('#bVal').disabled=lab<4||idle;qs('#bGo').disabled=lab<4||idle||droneBusy()>0;
 qs('#bGo').textContent=lab>=4?`DEPLOY SHIFT · ${ST.flag.size} FLAGGED`:'DEPLOY SHIFT';coach()}
function paintLive(i){const m=ST.live[i],r=m.risk,u=m.u;if(m.state)return;
 if(r==null){setEm(u.ring,0x39556b,.3);setTag(m.tag,null);u.beacon.visible=false;return}
 const f=ST.flag.has(i),over=r>=ST.thr&&!f;setEm(u.ring,riskCol(r),1.2);u.beacon.material.color.set(riskCol(r));u.beacon.visible=f;
 setTag(m.tag,Math.round(r*100)+'%'+(over?' · NO CREW':''),f?'amber':over?'red':'cyan',over?22:34)}
function paintCart(c){const u=c.u;if(c.labeled){setEm(u.strip,c.row.y?0xff4f5e:0x38f2a5,1.0);setEm(u.led,c.row.y?0xff4f5e:0x38f2a5,1.3)}else{setEm(u.strip,0x35536a,.5);setEm(u.led,0x35536a,.5)}}
function paintPod(v){const t=v.u.top;if(v.res==null){setEm(t,0xffb81c,.8);setTag(v.tag,null)}else{setEm(t,v.res?0x38f2a5:0xff4f5e,.9);setTag(v.tag,v.res?'✓':'✕',v.res?'mint':'red',40)}}
// ---------- actions ----------
function pullLog(c){if(c.labeled||c.pend)return;if(ST.tokens<1){flash('OUT OF LOG TOKENS · decide with what you know');buzz(30);return}ST.tokens--;c.pend=1;
 flyJob(c.x,c.z,()=>{c.labeled=1;c.pend=0;spark(c.x,c.y+.5,c.z,c.row.y?0xff4f5e:0x38f2a5,12);beep(c.row.y?260:660,.12,'triangle');beep(c.row.y?200:990,.14,'sine',.05,.06);buzz(12);
  ST.valRes&&(ST.valRes.stale=1);ST.val.forEach(v=>{v.res=null});paintAll()},.45,c.y+1.0);paintAll()}
function pickAt(e){const r=renderer.domElement.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return null;
 ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},cam);const h=ray.intersectObjects(ST.picks);return h.length?h[0].object.userData:null}
function useTarget(t){const o=objOf(t.k,t.i);if(t.k=='a'&&!o.labeled){pullLog(o);select('a',t.i);return}select(t.k,t.i)}
qs('#bPull5').onclick=()=>{wake();beep(440,.06,'triangle',.05);const un=ST.arch.filter(c=>!c.labeled&&!c.pend);if(!un.length)return flash('NO UNREAD CARTRIDGES LEFT');
 const n=Math.min(5,ST.tokens);if(!n)return flash('OUT OF LOG TOKENS');un.sort(()=>Math.random()-.5).slice(0,n).forEach(pullLog)};
function validate(){if(ST.busy||labRows().length<4)return;wake();ST.busy=1;const lab=labRows(),thr=ST.thr,k=Math.min(ST.k,lab.length);teach('split',1);
 const rs=ST.val.map(v=>risk(v.row,lab,ST.ids,k,false)),tc=trainConf();ST.val.forEach(v=>{v.res=null});paintAll();
 ST.val.forEach((v,i)=>setTimeout(()=>{const ok=(rs[i]>=thr)==!!v.row.y;v.res=ok;paintPod(v);spark(v.x,.3,v.z,ok?0x38f2a5:0xff4f5e,5);beep(ok?500+i*18:160,.1,ok?'triangle':'sawtooth',ok?.05:.03)},i*60+100));
 setTimeout(()=>{const c=conf(ST.val.map(v=>v.row),rs,thr),base=1-ST.val.reduce((u,v)=>u+v.row.y,0)/ST.val.length;ST.nVal++;
  ST.valRes={...c,base,stale:0,k:ST.k,thr,ids:ST.ids.slice(),nLab:lab.length,tr:tc.acc};ST.busy=0;
  ST.hist.push({k:ST.k,thr,ids:ST.ids.join('+'),train:+tc.acc.toFixed(2),val:+c.acc.toFixed(2),rec:+c.rec.toFixed(2),prec:+c.prec.toFixed(2)});
  const gap=tc.acc-c.acc;
  if(ST.lv==0){if(gap>=.12&&ST.k<=3)teach('overfit');if(ST.kSeen[1]>=9&&ST.k>=9&&c.acc<.8)teach('underfit')}
  if(ST.lv==0&&ST.k>=9&&tc.acc<.82&&gap<.1)teach('underfit');
  if(ST.lv>=1&&c.acc>=base-.04&&c.rec<.6)teach('imbalance');
  if(ST.lv>=1&&ST.thrMoved)teach('threshold');
  if(ST.lv==2&&ST.ids.some(id=>FEATS[id].eng))teach('feature');
  if(ST.lv==2&&ST.ids.includes('ticket')&&c.acc>=.95){flash('VALIDATION ALMOST PERFECT... SUSPICIOUS?',3600);beep(1200,.2,'sine',.05)}
  paintAll()},ST.val.length*60+350);paintAll()}
qs('#bVal').onclick=validate;
function runShift(){if(ST.busy||ST.shifting)return;wake();recompute();const L=ST.L;ST.shiftNo++;ST.reviewed=0;
 const rows=ST.live.map(m=>m.row),rs=ST.live.map(m=>m.risk??.5),res=shift(rows,rs,ST.thr,L.cap);ST.res=res;ST.shifting=1;
 ST.lines.children.slice().forEach(c=>ST.lines.remove(c));showRo('');flash('DRONE DISPATCHED · SERVICING FLAGGED MACHINES',1900);
 [...res.svc].forEach(i=>{const m=ST.live[i];flyJob(m.x,m.z,()=>{spark(m.x,1.0,m.z,0xffb81c,14);beep(520,.1,'square',.04);beep(780,.1,'square',.04,.07);buzz(10)},.75,1.9)});paintAll()}
qs('#bGo').onclick=runShift;
function finishShift(){const res=ST.res,live=ST.live;ST.shifting=0;
 live.forEach((m,i)=>{setTimeout(()=>{const y=m.row.y,sv=res.svc.has(i),u=m.u;m.state='done';u.beacon.visible=false;
  if(y&&sv){m.state='saved';setEm(u.ring,0x38f2a5,1.8);setTag(m.tag,'SAVED','mint');spark(m.x,.9,m.z,0x38f2a5,16);beep(700,.18,'triangle',.07)}
  else if(y){m.state='broke';setEm(u.ring,0xff4f5e,2);setTag(m.tag,'FAILED · '+SHORT[m.row.mode||0],'red',24);spark(m.x,.8,m.z,0xff4f5e,20);spark(m.x,.8,m.z,0xffb81c,10);beep(110,.35,'sawtooth',.07);buzz(25);u.body.material.color.set(0x3a2a2e);m.shake=1.6}
  else if(sv){m.state='wasted';setEm(u.ring,0x7e97ab,.6);setTag(m.tag,'NO FAULT','dim');spark(m.x,.6,m.z,0x9fb6c8,5)}
  else{m.state='fine';setEm(u.ring,0x2c8f78,.7);setTag(m.tag,'OK','dim')}},i*90+200)});
 setTimeout(report,live.length*90+900)}
// ---------- shift report ticket ----------
function report(){const res=ST.res,L=ST.L,live=ST.live,thr=ST.thr,rows=live.map(m=>m.row),rs=live.map(m=>m.risk??.5),lc=conf(rows,rs,thr),st=stars(res.sc);best[ST.lv]=Math.max(best[ST.lv],st);ST.reviewed=1;
 const Vr=ST.valRes&&!ST.valRes.stale?ST.valRes:null,promised=Vr?Math.round(Vr.acc*100):null,got=Math.round(lc.acc*100),lab=labRows(),tn=live.length-res.tp-res.fp-res.fn;
 const miss=live.map((m,i)=>i).filter(i=>live[i].row.y&&!res.svc.has(i)).slice(0,3).map(i=>{const r=live[i].row,w=WHY[r.mode||0],okIn=!w[1]||w[1](ST.ids);
  return`<div class="tk-p"><b>MISS #${r.id}</b> (${MODES[r.mode||0]||'unflagged'}): ${w[0]}${w[1]&&!okIn?' <b>Your model is not looking at the right inputs for this.</b> '+(L.toggle?w[2]:"This sector's sensors cannot see it, so no model could catch it here."):''}</div>`}).join('');
 const leak=ST.ids.includes('ticket'),last=ST.lv==2;
 SESSION.levels.push({level:ST.lv+1,shift:ST.shiftNo,k:ST.k,thr:ST.thr,features:ST.ids.join('+'),logs:lab.length,train:+trainConf().acc.toFixed(2),validation:Vr?+Vr.acc.toFixed(2):null,live:+lc.acc.toFixed(2),score:res.sc,stars:st});
 const l=openLayer('vRes',`<div class="ticket"><div class="tk-h"><b>SHIFT REPORT</b><small>SECTOR ${ST.lv+1} · SHIFT ${ST.shiftNo} · ${L.t.toUpperCase()}</small></div>
 <div class="score"><div class="n">${res.sc}<small>/100</small></div><div class="hex">${[0,1,2].map(q=>`<i class="${q<st?'on':'off'}" style="animation-delay:${q*.3+.2}s"></i>`).join('')}</div></div>
 <div class="sub">0 = doing nothing · 100 = perfect crew · rank at 45 / 65 / 80</div>
 <div class="cm"><div></div><div class="hd">SERVICED</div><div class="hd">SKIPPED</div><div class="hd">FAILING</div><div class="c good"><b>${res.tp}</b>caught</div><div class="c bad"><b>${res.fn}</b>missed</div><div class="hd">HEALTHY</div><div class="c meh"><b>${res.fp}</b>false alarm</div><div class="c nil"><b>${tn}</b>left alone</div></div>
 <div class="tk-p">Validation promised <b>${promised==null?'(not checked with this model!)':promised+'%'}</b> accuracy; the live floor delivered <b>${got}%</b>${promised!=null?` (${got>=promised-3?'honest estimate':'optimistic estimate: gap '+(promised-got)+' pts'})`:''}.</div>
 ${leak?`<div class="tk-p"><b>LEAK:</b> your model leaned on the <b>repair ticket</b>, which only exists after a failure. On live machines it is blank, so nothing looked risky. That is <b>data leakage</b>. Switch it off.</div>`:''}${miss||'<div class="tk-p">No breakdowns got through. Nice.</div>'}
 ${res.nf>L.cap?`<div class="tk-p">${res.nf} machines were failing but the crew can only fix ${L.cap}: ranking by risk matters.</div>`:''}
 ${st?'':'<div class="tk-p">Need 45+ for a rank. Check the dispatch tips, re-validate, and run another shift.</div>'}
 <div class="btnrow">${st?`<button class="act mint" id="rNext">${last?'FINISH THE PLANT':'NEXT SECTOR'}</button>`:''}<button class="act ghost" id="rAgain">${st?'KEEP TWEAKING (NEW BATCH)':'TRY AGAIN (NEW BATCH)'}</button><button class="act ghost" id="rCopy">COPY SESSION SUMMARY</button></div></div>`);
 qs('#rAgain').onclick=()=>{closeLayer('vRes');newBatch()};qs('#rCopy').onclick=copySummary;if(st)qs('#rNext').onclick=()=>last?finale():go(ST.lv+1);
 l.onclick=e=>{if(e.target===l){closeLayer('vRes');newBatch()}};
 if(st){[0,1,2].slice(0,st).forEach(q=>beep([523,659,784][q],.35,'triangle',.08,q*.2+.2));buzz([20,40,20]);live.forEach((m,q)=>setTimeout(()=>spark(m.x,1,m.z,[0xffb81c,0x35e0ff,0x9d86ff][q%3],5),q*40))}
 if(leak)teach('leakage');if(ST.lv>=1&&ST.thrMoved)teach('threshold');paintAll();renderPips()}
function newBatch(){const set=sample(ST.L,seedBase+ST.lv*101+ST.shiftNo*7+1),fresh=set.live();
 ST.live.forEach((m,i)=>{m.row=fresh[i];m.state='';m.shake=0;ST.grp.remove(m.g);const nm=makeMachine(fresh[i]);nm.position.set(m.x,0,m.z);nm.rotation.y=m.g.rotation.y;nm.scale.setScalar(.01);nm.userData.hit.userData={k:'l',i};
  ST.picks[ST.picks.indexOf(m.u.hit)]=nm.userData.hit;ST.grp.add(nm);m.g=nm;m.u=nm.userData;m.pop=1;setTag(m.tag,null)});
 ST.reviewed=0;ST.res=null;paintAll();flash('NEW MACHINES ROLLED IN · A FRESH TEST SET',2200)}
// ---------- the manual (concept cards) ----------
function teach(k,now){if(seen[k])return;seen[k]=1;manualQ.push(k);SESSION.concepts.push(k);setTimeout(showManual,now?400:900)}
function showManual(){if(qs('#vMan')||!manualQ.length)return;const key=manualQ.shift(),c=CON[key],n=Object.keys(seen).length;
 openLayer('vMan',`<div class="paper panel cut"><div class="eyebrow">Field manual · new entry<span class="stamp">FILED</span></div><h2>${c[0]}</h2>${FIG[key]}<p>${c[1]}</p><div class="when"><b>USE IT WHEN</b> ${c[2]}</div><div class="btnrow"><button class="act" id="mOk">GOT IT</button></div></div>`,36);
 beep(660,.15,'sine',.06);beep(990,.2,'sine',.05,.1);qs('#mOk').onclick=()=>{closeLayer('vMan');showManual()}}
function helpOpen(){const l=openLayer('vHelp',`<div class="paper panel cut"><div class="eyebrow">Field manual</div><h2>How to play</h2>
 <div class="goals"><b class="t">BY THE END YOU CAN</b><ul>${OBJ.map(o=>`<li>${o}</li>`).join('')}</ul></div>
 <p><b>The loop:</b> fetch logs from the rack (training data) → set the model → VALIDATE on the bench → tune → DEPLOY a shift on the live floor → compare what validation promised with what happened. Every machine is a <b>real row</b> of the UCI AI4I 2020 milling dataset; failures are over-represented so the game is playable (really only 3.4% fail). Each shift brings a fresh batch of live machines.</p>
 <h2 style="font-size:19px;margin-top:14px">Which idea, when?</h2>
 <ul class="ol">${WHEN.map(([q,k])=>`<li><b>›</b><span>${q}<small>${CON[k][0]}</small></span></li>`).join('')}</ul>
 <div class="btnrow"><button class="act ghost" id="hCopy">COPY SESSION SUMMARY</button><button class="act" id="hX">BACK TO THE PLANT</button></div></div>`,31);
 qs('#hX').onclick=()=>closeLayer('vHelp');qs('#hCopy').onclick=copySummary;l.onclick=e=>{if(e.target===l)closeLayer('vHelp')}}
qs('#bHelp').onclick=helpOpen;
function intro(){openLayer('vIntro',`<div class="paper panel cut"><div class="eyebrow">Night shift · time card</div><h2>Machine Whisperer</h2>
 <p>Predict which machines will break <b>before</b> they do. You will discover how data science really works by running a plant on real maintenance records.</p>
 <ul class="ol"><li><b>01</b><span>Fetch logs of past machines<small>your training data</small></span></li><li><b>02</b><span>Validate on a bench of unseen machines<small>an honest score</small></span></li><li><b>03</b><span>Tune the model: neighbours, alarm level, features<small>watch the train-validation gap</small></span></li><li><b>04</b><span>Deploy a shift on the live floor<small>and learn from the gap</small></span></li></ul>
 <div class="goals"><b class="t">BY THE END YOU CAN</b><ul>${OBJ.map(o=>`<li>${o}</li>`).join('')}</ul></div>
 <div class="btnrow"><button class="act" id="iGo">CLOCK IN</button></div><div class="fine">drag to orbit · pinch / scroll to zoom · tap a cartridge to read it · real data: UCI AI4I 2020</div></div>`,32);
 qs('#iGo').onclick=()=>{wake();closeLayer('vIntro');beep(520,.1,'triangle',.06);beep(780,.14,'triangle',.06,.09)}}
// ---------- levels, summary, finale ----------
function go(l){qs('#wLv').textContent=`SECTOR ${l+1} OF 3`;qs('#wTt').textContent=LV[l].t;qs('#wHt').textContent=LV[l].h;closeLayer('vRes');const w=qs('#wipe');w.classList.add('on');
 setTimeout(()=>{loadLevel(l);setTimeout(()=>w.classList.remove('on'),1100)},650)}
function summaryText(){const o=[`Machine Whisperer 3D - session summary (${new Date().toLocaleString()})`,`Time played: ${Math.round((Date.now()-SESSION.start)/60000)} min · ranks per sector: ${best.join('/')} · ideas unlocked: ${[...new Set(SESSION.concepts)].join(', ')||'none'}`];
 SESSION.levels.forEach(s=>o.push(`S${s.level} shift ${s.shift}: k=${s.k} thr=${s.thr} features=${s.features} logs=${s.logs} train=${s.train} val=${s.validation} live=${s.live} score=${s.score} rank=${s.stars}`));return o.join('\n')}
function copySummary(){const t=summaryText();try{navigator.clipboard.writeText(t).then(()=>flash('SUMMARY COPIED · PASTE IT INTO THE PLAYTEST FORM'),()=>prompt('Copy this summary:',t))}catch(e){prompt('Copy this summary:',t)}}
function finale(){closeLayer('vRes');const t=best.reduce((a,b)=>a+b,0);
 openLayer('vEnd',`<div class="paper panel cut"><div class="eyebrow">Shift complete</div><h2>Plant secured</h2><p><b>${t} of 9</b> rank pips earned. Ideas you practised:</p>
 <ul class="ol" style="max-height:42vh;overflow:auto">${Object.values(CON).map(c=>`<li><b>›</b><span>${c[0]}<small>Use when: ${c[2]}</small></span></li>`).join('')}</ul>
 <div class="btnrow"><button class="act ghost" id="eCopy">COPY SESSION SUMMARY</button><button class="act" id="eAgain">PLAY AGAIN</button></div></div>`,31);
 [523,659,784,1047].forEach((f,q)=>beep(f,.4,'triangle',.08,q*.15));qs('#eCopy').onclick=copySummary;
 qs('#eAgain').onclick=()=>{Object.keys(seen).forEach(k=>delete seen[k]);best.fill(0);SESSION.levels=[];SESSION.concepts=[];seedBase=Math.floor(Math.random()*9e5);closeLayer('vEnd');go(0)}}
function renderPips(){qs('#pips').innerHTML=[0,1,2].map(q=>`<i class="pip ${q<best[ST.lv]?'on':''}"></i>`).join('')}
// ---------- top bar buttons, tabs ----------
const sndBtn=qs('#bSnd');sndBtn.innerHTML=ICO.on;qs('#bHelp').innerHTML=ICO.man;
sndBtn.onclick=()=>{muted=!muted;sndBtn.innerHTML=muted?ICO.off:ICO.on;wake()};
function setTab(t){qsa('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t==t));qsa('.pane').forEach(p=>p.classList.toggle('on',p.dataset.p==t));ST&&coach()}
qs('#tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;const rig=qs('#rig');if(b.classList.contains('on')){rig.classList.toggle('fold');sizeAll();return}rig.classList.remove('fold');setTab(b.dataset.t);sizeAll()};
// the readout lives in the left column on desktop and rides on top of the drawer on phones
const mq=matchMedia('(max-width:899px)');
function placeRo(){const ro=qs('#readout');if(mq.matches)qs('#rig').insertBefore(ro,qs('#tabs'));else qs('#colL').appendChild(ro)}
mq.addEventListener?mq.addEventListener('change',()=>{placeRo();sizeAll()}):mq.addListener(()=>{placeRo();sizeAll()});
// ---------- camera framing + pointer ----------
const ray=new THREE.Raycaster();
const hoverRing=flat(new THREE.RingGeometry(.5,.58,28),0x35e0ff,.9,.05,scene);hoverRing.visible=false;
function sizeAll(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);cam.aspect=w/h;
 const mob=w<900;let lw=0,rw=0,top=0,bot=0;
 if(!mob){lw=qs('#colL').offsetWidth+14;rw=qs('#rig').offsetWidth+14;top=54}else{top=qs('.bar').offsetHeight+Math.max(96,qs('#dispatch').offsetHeight)+8;bot=qs('#rig').offsetHeight}
 cam.setViewOffset(w,h,-(lw-rw)/2,-(top-bot)/2,w,h);cam.updateProjectionMatrix();
 const tn=Math.tan(17*Math.PI/180),aw=Math.max(200,w-lw-rw),ah=Math.max(200,h-top-bot),EW=12.4,EV=16.6*Math.sin(view.el)+2.4*Math.cos(view.el);
 view.goal=Math.max(12,Math.min(60,Math.max(EW*h/(2*tn*aw),EV*h/(2*tn*ah))*1.05))}
addEventListener('resize',sizeAll);
const cv=renderer.domElement,ptr=new Map();let drag=null,pinch=0,hov=null;
cv.onpointerdown=e=>{wake();ptr.set(e.pointerId,e);drag={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,moved:0};cv.setPointerCapture(e.pointerId)};
cv.onpointermove=e=>{if(!drag){hov=ST?pickAt(e):null;return}ptr.set(e.pointerId,e);
 if(ptr.size==2){const[a,b]=[...ptr.values()],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);if(pinch)view.goal=clamp(view.goal*pinch/d,view.min,view.max);pinch=d;drag.moved=1;return}
 if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)drag.moved=1;
 if(drag.moved){view.az-=(e.clientX-drag.lx)*.008;view.el=clamp(view.el+(e.clientY-drag.ly)*.006,.45,1.4);hov=null}drag.lx=e.clientX;drag.ly=e.clientY};
cv.onpointerup=e=>{ptr.delete(e.pointerId);pinch=0;if(drag&&!drag.moved&&ST){const t=pickAt(e);if(t)useTarget(t)}if(!ptr.size){drag=null;if(e.pointerType!='mouse')hov=null}};
cv.onpointerleave=()=>hov=null;cv.onwheel=e=>{e.preventDefault();view.goal=clamp(view.goal*(1+e.deltaY*.001),view.min,view.max)};
// ---------- main loop ----------
let lastT=0;
function frame(ms){const t=ms/1000,dt=Math.min(.05,t-lastT);lastT=t;requestAnimationFrame(frame);
 if(ST){const ho=hov&&objOf(hov.k,hov.i);hoverRing.visible=!!ho;if(ho){hoverRing.position.set(ho.x,hov.k=='a'?ho.y-.2:.06,ho.z);hoverRing.scale.setScalar((hov.k=='l'?1.5:hov.k=='a'?.7:.45)*(1+Math.sin(T*8)*.06))}
  ST.live.forEach((m,i)=>{const u=m.u,broke=m.state=='broke';u.rotor.rotation.y+=broke?0:dt*(m.row.rpm/1500)*3;
   if(broke)u.ring.material.emissiveIntensity=Math.sin(T*14)>0?2.2:.15;
   if(m.shake>0){m.shake-=dt;m.g.position.x=m.x+Math.sin(T*60)*.03*m.shake;m.g.position.z=m.z+Math.cos(T*53)*.03*m.shake}
   if(m.pop){const s=m.g.scale.x;m.g.scale.setScalar(Math.min(1,s+dt*3));if(s>=1)m.pop=0}
   if(u.beacon.visible){u.beacon.material.opacity=.17+.08*Math.sin(T*5+i);u.beacon.rotation.y+=dt*1.2}});
  ST.arch.forEach(c=>{const tg=c.labeled?.34:0;c.out+=(tg-c.out)*Math.min(1,dt*8);c.u.inner.position.z=c.out});
  if(ST.shifting&&!droneBusy())finishShift()}
 sceneTick(dt);renderer.render(scene,cam)}
// ---------- start ----------
setTab('data');placeRo();loadLevel(0);intro();requestAnimationFrame(frame);
