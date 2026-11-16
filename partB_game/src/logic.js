// ===== Machine Whisperer: pure game logic (no DOM, no 3D). Runs in browser and in node tests. =====
const MODES=['','Tool-wear failure','Heat-dissipation failure','Power failure','Overstrain failure','Random failure'];
const TYPES=['L','M','H'];
function rng(seed){let st=seed>>>0;return()=>{st=(st+0x6D2B79F5)>>>0;let z=st;z=Math.imul(z^(z>>>15),z|1);z^=z+Math.imul(z^(z>>>7),z|61);return((z^(z>>>14))>>>0)/4294967296}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// ---- the rows (REAL data) ----
const ROWS=POOL.map(r=>({id:r[0],type:r[1],air:r[2],proc:r[3],rpm:r[4],torque:r[5],wear:r[6],mode:r[7],y:r[8],ticket:0}));
// ---- features: raw sensors, engineered features, and one leak ----
const FEATS={
 torque:{e:'🌀',n:'Torque',u:'Nm',f:r=>r.torque},
 wear:{e:'🔩',n:'Tool wear',u:'min',f:r=>r.wear},
 rpm:{e:'⚙️',n:'Speed',u:'rpm',f:r=>r.rpm},
 air:{e:'🌡️',n:'Air temp',u:'K',f:r=>r.air},
 proc:{e:'🔥',n:'Process temp',u:'K',f:r=>r.proc},
 power:{e:'⚡',n:'Power',u:'W',f:r=>r.torque*r.rpm*2*Math.PI/60,eng:1},
 dT:{e:'♨️',n:'Heat gap',u:'K',f:r=>r.proc-r.air,eng:1},
 strain:{e:'💪',n:'Wear×Torque',u:'',f:r=>r.wear*r.torque,eng:1},
 ticket:{e:'🎫',n:'Repair ticket',u:'',f:r=>r.ticket,leak:1}};
// robust min-max scaling from the 1st-99th percentile of the whole pool (clipped to 0..1)
const RNG={};
Object.keys(FEATS).forEach(id=>{const v=ROWS.map(FEATS[id].f).sort((a,b)=>a-b);RNG[id]=id=='ticket'?[0,1]:[v[Math.floor(v.length*.01)],v[Math.floor(v.length*.99)]]});
const vec=(r,ids)=>ids.map(id=>{const[a,b]=RNG[id];return clamp((FEATS[id].f(r)-a)/(b-a||1),0,1)});
// ---- the "model": k-nearest-neighbours on the machines you have labelled ----
function risk(r,lab,ids,k,self){
  const v=vec(r,ids),d=[];
  for(const l of lab){if(l===r&&!self)continue;const w=vec(l,ids);let s=0;for(let i=0;i<v.length;i++)s+=(v[i]-w[i])**2;d.push([s,l.y])}
  if(!d.length)return .5;
  d.sort((a,b)=>a[0]-b[0]);const kk=Math.min(k,d.length);let p=0;for(let i=0;i<kk;i++)p+=d[i][1];return p/kk}
function nearest(r,lab,ids,k){const v=vec(r,ids);return lab.filter(l=>l!==r).map(l=>{const w=vec(l,ids);let s=0;for(let i=0;i<v.length;i++)s+=(v[i]-w[i])**2;return[s,l]}).sort((a,b)=>a[0]-b[0]).slice(0,k).map(x=>x[1])}
function conf(rows,rs,thr){let tp=0,fp=0,fn=0,tn=0;rows.forEach((r,i)=>{const p=rs[i]>=thr;if(p&&r.y)tp++;else if(p)fp++;else if(r.y)fn++;else tn++});
  const n=rows.length||1;return{tp,fp,fn,tn,acc:(tp+tn)/n,prec:tp+fp?tp/(tp+fp):0,rec:tp+fn?tp/(tp+fn):0}}
// ---- shift economics: the crew can only service `cap` machines ----
const V={tp:10,fp:3,fn:6};
function shift(rows,rs,thr,cap){
  const order=rows.map((r,i)=>i).filter(i=>rs[i]>=thr).sort((a,b)=>rs[b]-rs[a]).slice(0,cap),svc=new Set(order);
  let tp=0,fp=0,fn=0;rows.forEach((r,i)=>{if(svc.has(i)){r.y?tp++:fp++}else if(r.y)fn++});
  const nf=rows.reduce((u,r)=>u+r.y,0),best=Math.min(nf,cap);
  const net=V.tp*tp-V.fp*fp-V.fn*fn,none=-V.fn*nf,max=V.tp*best-V.fn*(nf-best);
  const sc=max==none?100:clamp(Math.round(100*(net-none)/(max-none)),0,100);
  return{svc,tp,fp,fn,nf,sc,net}}
const stars=v=>v>=80?3:v>=65?2:v>=45?1:0;
// ---- levels (each teaches different concepts; mixes choose which real failure modes appear) ----
const LV=[
 {t:'Overfit Alley',sub:'Train vs test',feats:['wear','torque'],toggle:0,W:5,H:4,na:40,bud:20,nv:20,prev:.4,cap:20,thrDial:0,kMax:15,k0:1,thr0:.5,mix:{4:.5,1:.2,2:.3},
  h:'Pull maintenance logs, then turn the k dial. Does your model understand the machines, or just remember them?',
  tip:'Compare the TRAIN and VALIDATION scores as you turn the k dial. When they drift apart, the model is memorising.'},
 {t:'Cry-Wolf Corner',sub:'Rare failures & alarms',feats:['torque','wear','rpm'],toggle:0,W:5,H:4,na:40,bud:20,nv:25,prev:.2,cap:5,thrDial:1,kMax:15,k0:5,thr0:.5,mix:{3:.35,4:.35,1:.15,2:.15},
  h:'Failures are rarer and the crew can fix only 5 machines per shift. Accuracy will fool you. Tune the Alarm dial.',
  tip:'Too many alarms waste crew time; too few miss breakdowns. Watch recall AND precision, not accuracy.'},
 {t:'Signal Hall',sub:'Features & leakage',feats:['torque','wear','rpm','air','proc'],toggle:1,W:5,H:4,na:40,bud:28,nv:25,prev:.25,cap:6,thrDial:1,kMax:15,k0:3,thr0:.5,mix:{2:.35,3:.3,4:.3,1:.05},
  h:'Choose what your model looks at. Combine sensors the way the physics does, and distrust any score that looks too good.',
  tip:'Engineered features (power, heat gap, wear×torque) encode the failure physics. A feature that only exists AFTER a failure is a leak.'}];
function sample(L,seed){
  const R=rng(seed),sh=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  // positives are drawn by failure mode (L.mix = {modeCode:weight}); every level shows the learner a different slice of the real failure physics
  const byMode={};ROWS.filter(r=>r.y).forEach(r=>(byMode[r.mode]=byMode[r.mode]||[]).push(r));Object.values(byMode).forEach(sh);
  const N=sh(ROWS.filter(r=>!r.y)),ptr={},keys=Object.keys(L.mix).filter(k=>byMode[k]),tot=keys.reduce((u,k)=>u+L.mix[k],0);let in_=0;
  const pickMode=()=>{let x=R()*tot;for(const k of keys){x-=L.mix[k];if(x<=0)return k}return keys[0]};
  const take=(n,ticket)=>{const np=Math.max(1,Math.round(n*L.prev)),out=[];
    for(let i=0;i<np;i++){let m=pickMode();ptr[m]=ptr[m]||0;if(ptr[m]>=byMode[m].length){m=keys.find(q=>(ptr[q]||0)<byMode[q].length)}ptr[m]=ptr[m]||0;out.push(byMode[m][ptr[m]++])}
    while(out.length<n)out.push(N[in_++]);return sh(out).map(r=>({...r,ticket:ticket?r.y:0}))};
  return{arch:take(L.na,1),val:take(L.nv,1),live:()=>take(L.W*L.H,0)}}
