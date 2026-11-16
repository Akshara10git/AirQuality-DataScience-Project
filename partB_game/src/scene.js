// ===== Machine Whisperer 3D | scene.js =====
// The night-shift plant: lights, floor, radar hub, part builders, survey drone, particles, orbit camera.
// (rules live in logic.js; the interface and teaching loop live in game.js)
const SPEED=Math.max(1,+(new URLSearchParams(location.search).get('speed'))||1);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}
catch(err){document.getElementById('modal').innerHTML='<div class="veil"><div class="paper panel cut"><h2>3D unavailable</h2><p>This browser could not start WebGL. Enable hardware acceleration and reload the page.</p></div></div>';throw err}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.getElementById('world').appendChild(renderer.domElement);
const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(34,1,.1,200);
scene.fog=new THREE.Fog(0x08131e,34,130);
let T=0;
// ---------- light: cold moon + a cyan glow from the hub ----------
scene.add(new THREE.HemisphereLight(0x86b6ff,0x0b1420,.95));
const moon=new THREE.DirectionalLight(0xd4e6ff,.9);moon.position.set(-7,16,10);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);
Object.assign(moon.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:2,far:48});moon.shadow.bias=-.0006;scene.add(moon);
const hubLight=new THREE.PointLight(0x35e0ff,.9,13);hubLight.position.set(0,2.4,0);scene.add(hubLight);
// ---------- tiny mesh helpers ----------
const BX=(w,h,d)=>new THREE.BoxGeometry(w,h,d),CY=(a,b,h,n=12)=>new THREE.CylinderGeometry(a,b,h,n);
function part(geo,col,x,y,z,par,o={}){const me=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:col,roughness:o.r??.7,metalness:o.m??.25,emissive:o.em??0,emissiveIntensity:o.ei??1}));
 me.position.set(x,y,z);me.castShadow=!!o.sh;me.receiveShadow=!!o.rc;par&&par.add(me);return me}
function flat(geo,col,op,y,par,add=true){const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false,side:THREE.DoubleSide,blending:add?THREE.AdditiveBlending:THREE.NormalBlending}));
 m.rotation.x=-Math.PI/2;m.position.y=y;par&&par.add(m);return m}
const glowMat=(col,op)=>new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
function setEm(m,col,ei){m.material.color.set(col);m.material.emissive.set(col);m.material.emissiveIntensity=ei}
// risk 0..1 -> mint (safe) via amber to red (danger)
function riskCol(r){const c=new THREE.Color(),h=r<.5?.43-.31*(r/.5):.12-.12*((r-.5)/.5);return c.setHSL(Math.max(0,h),.9,.52)}
// ---------- floating tags (canvas sprites with cut corners) ----------
const TONE={dim:['#0b1824dd','#47657c','#9fb6c8'],cyan:['#0a2a3bdd','#35e0ff','#dcfaff'],mint:['#06392bdd','#38f2a5','#dbfff0'],red:['#3b0c14dd','#ff4f5e','#ffe4e7'],amber:['#3a2a06dd','#ffb81c','#fff1cf']};
function makeTag(w=100,h=.3){const c=document.createElement('canvas');c.width=w*2;c.height=64;const t=new THREE.CanvasTexture(c),s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false}));
 s.renderOrder=10;s.userData={c,t,w};s.scale.set(h*w/32,h,1);s.visible=false;return s}
function setTag(s,txt,tone='dim',fs=34){if(!s)return;if(!txt){s.visible=false;return}
 const{c,t}=s.userData,x=c.getContext('2d'),W=c.width,H=c.height,k=14,[bg,ln,fg]=TONE[tone];x.clearRect(0,0,W,H);
 x.beginPath();x.moveTo(3,3);x.lineTo(W-3-k,3);x.lineTo(W-3,3+k);x.lineTo(W-3,H-3);x.lineTo(3+k,H-3);x.lineTo(3,H-3-k);x.closePath();x.fillStyle=bg;x.fill();x.lineWidth=3;x.strokeStyle=ln;x.stroke();
 x.fillStyle=fg;x.font=`700 ${fs}px ui-monospace,Menlo,Consolas,monospace`;x.textAlign='center';x.textBaseline='middle';x.fillText(txt,W/2,H/2+1);t.needsUpdate=true;s.visible=true}
// ---------- the plant (static world) ----------
const world=new THREE.Group();scene.add(world);
function gridTex(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#0b1925';x.fillRect(0,0,256,256);
 x.strokeStyle='#12354a';x.lineWidth=2;for(let i=0;i<=256;i+=32){x.beginPath();x.moveTo(i,0);x.lineTo(i,256);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(256,i);x.stroke()}
 x.strokeStyle='#1f6c8c';x.lineWidth=4;x.strokeRect(0,0,256,256);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(11,11);t.anisotropy=4;return t}
const floor=part(new THREE.CircleGeometry(12.5,80),0xffffff,0,0,0,world,{rc:true,r:.95,m:0});floor.rotation.x=-Math.PI/2;floor.material.map=gridTex();
part(CY(12.7,13,.6,80),0x07111a,0,-.31,0,world,{r:1,m:0});
flat(new THREE.RingGeometry(12.3,12.55,96),0x35e0ff,.8,.02,world);
flat(new THREE.RingGeometry(3.6,5.2,96),0x35e0ff,.05,.015,world);flat(new THREE.RingGeometry(5.16,5.2,96),0x35e0ff,.55,.02,world);flat(new THREE.RingGeometry(3.6,3.64,96),0x35e0ff,.35,.02,world);
// far skyline (fades into the fog): gives the plant a place to be
const blink=[];(()=>{const R=rngSeed(5);for(let i=0;i<26;i++){const a=i/26*Math.PI*2+R()*.1,r=52+R()*10,h=8+R()*20,w=2.5+R()*3,g=new THREE.Group();g.position.set(Math.sin(a)*r,0,Math.cos(a)*r);world.add(g);
 part(BX(w,h,w),0x0d1d2b,0,h/2,0,g,{r:1,m:0});for(let j=0;j<3;j++)part(BX(w*.8,.35,.05),R()>.5?0x35e0ff:0xffb81c,0,2+R()*(h-3),w/2+.01,g,{em:0x35e0ff,ei:.8});
 const b=part(new THREE.SphereGeometry(.22,6,4),0xff4f5e,0,h+.2,0,g,{em:0xff4f5e,ei:1.5});b.userData.ph=R()*6;blink.push(b)}})();
function rngSeed(s){return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646}}
// control hub: radar tower in the middle of the live ring
const hub=new THREE.Group();world.add(hub);
part(CY(.62,.76,.24,18),0x13283a,0,.12,0,hub,{sh:1,rc:1,m:.5});
part(CY(.3,.38,1.55,14),0x1b384f,0,1.0,0,hub,{sh:1,m:.6,r:.45,em:0x0c2a3c,ei:.9});
[.5,.95,1.4].forEach(y=>{const r=new THREE.Mesh(new THREE.TorusGeometry(.36,.022,6,26),new THREE.MeshBasicMaterial({color:0x35e0ff}));r.rotation.x=Math.PI/2;r.position.y=y;hub.add(r)});
const holo=flat(new THREE.RingGeometry(.35,.74,32),0x35e0ff,.35,1.95,hub);flat(new THREE.CircleGeometry(.34,24),0x35e0ff,.18,1.95,hub);
const hubTag=makeTag(210,.34);hubTag.position.set(0,2.4,0);hub.add(hubTag);
const sweep=new THREE.Group();sweep.position.y=.03;world.add(sweep);flat(new THREE.CircleGeometry(3.55,40,0,1.05),0x35e0ff,.1,0,sweep);
// ---------- particles: bursts and floating dust ----------
const FXN=420,fxP=new Float32Array(FXN*3).fill(-99),fxV=new Float32Array(FXN*3),fxC=new Float32Array(FXN*3),fxB=new Float32Array(FXN*3),fxL=new Float32Array(FXN);let fxI=0;
const fxG=new THREE.BufferGeometry();fxG.setAttribute('position',new THREE.BufferAttribute(fxP,3));fxG.setAttribute('color',new THREE.BufferAttribute(fxC,3));
const fxPts=new THREE.Points(fxG,new THREE.PointsMaterial({size:.16,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));fxPts.frustumCulled=false;scene.add(fxPts);
function spark(x,y,z,col,n=8,up=1){const c=new THREE.Color(col);for(let q=0;q<n;q++){const i=fxI++%FXN;fxP.set([x,y,z],i*3);fxV.set([(Math.random()-.5)*2.6,(1+Math.random()*2.4)*up,(Math.random()-.5)*2.6],i*3);fxL[i]=1;fxB.set([c.r,c.g,c.b],i*3)}}
const DN=150,dustB=[],dustG=new THREE.BufferGeometry(),dustP=new Float32Array(DN*3);
for(let i=0;i<DN;i++){dustB.push([(Math.random()-.5)*26,Math.random()*5,(Math.random()-.5)*26,Math.random()*6]);}
dustG.setAttribute('position',new THREE.BufferAttribute(dustP,3));
const dust=new THREE.Points(dustG,new THREE.PointsMaterial({size:.07,color:0x7fd8ff,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));dust.frustumCulled=false;scene.add(dust);
// ---------- part builders ----------
const TYPE_COL=[0x4aa8ff,0x35e0c0,0xffc04a];// product grade L, M, H
function makeMachine(row){const g=new THREE.Group(),u={};
 part(CY(.5,.57,.12,10),0x142636,0,.06,0,g,{sh:1,rc:1});
 u.body=part(BX(.62,.44,.62),0x2c4156,0,.34,0,g,{sh:1,m:.5,r:.5});
 part(BX(.645,.06,.645),TYPE_COL[row.type],0,.2,0,g,{em:TYPE_COL[row.type],ei:.7});
 part(BX(.36,.16,.02),0x06121c,0,.4,.32,g,{em:TYPE_COL[row.type],ei:.55});
 u.rotor=new THREE.Group();u.rotor.position.set(0,.66,0);g.add(u.rotor);part(CY(.1,.12,.12,10),0x9fb4c6,0,0,0,u.rotor,{m:.8,r:.3});
 for(let i=0;i<3;i++)part(BX(.38,.025,.07),0xc9d8e4,0,.05,0,u.rotor,{m:.7,r:.3}).rotation.y=i*Math.PI/3;
 const wf=Math.min(1,Math.max(.04,row.wear/250)),wc=new THREE.Color().setHSL((1-wf)*.33,.85,.5),wh=.5*wf+.06;
 part(BX(.05,.62,.05),0x10222f,.4,.43,-.4,g);u.wear=part(CY(.05,.05,wh,8),wc,.4,.12+wh/2,-.4,g,{em:wc,ei:.7});
 const hv=vec(row,['dT'])[0];u.vent=part(BX(.22,.05,.22),0xff7a2a,-.16,.6,.12,g,{em:0xff7a2a,ei:.15+1.2*hv});
 u.ring=new THREE.Mesh(new THREE.TorusGeometry(.56,.035,8,34),new THREE.MeshStandardMaterial({color:0x39556b,emissive:0x39556b,emissiveIntensity:.3,roughness:.4}));u.ring.rotation.x=Math.PI/2;u.ring.position.y=.14;g.add(u.ring);
 u.beacon=new THREE.Mesh(new THREE.ConeGeometry(.34,1.8,16,1,true),glowMat(0xffb81c,.3));u.beacon.position.y=1.0;u.beacon.visible=false;g.add(u.beacon);
 u.hit=new THREE.Mesh(BX(.95,1.1,.95),new THREE.MeshBasicMaterial({visible:false}));u.hit.position.y=.55;g.add(u.hit);g.userData=u;return g}
function makeCart(){const g=new THREE.Group(),u={};u.inner=new THREE.Group();g.add(u.inner);
 u.body=part(BX(.46,.6,.13),0x1b2d3f,0,.3,0,u.inner,{sh:1,m:.4,r:.55});part(BX(.38,.22,.02),0x08141e,0,.2,.07,u.inner);
 u.strip=part(BX(.38,.08,.02),0x35536a,0,.47,.075,u.inner,{em:0x35536a,ei:.5});u.led=part(BX(.07,.07,.02),0x35536a,.14,.2,.085,u.inner,{em:0x35536a,ei:.5});
 u.hit=new THREE.Mesh(BX(.55,.7,.4),new THREE.MeshBasicMaterial({visible:false}));u.hit.position.y=.32;g.add(u.hit);g.userData=u;return g}
function makePod(){const g=new THREE.Group(),u={};part(CY(.15,.18,.1,6),0x142636,0,.05,0,g,{sh:1});u.top=part(CY(.1,.1,.035,6),0xffb81c,0,.12,0,g,{em:0xffb81c,ei:.55});
 u.hit=new THREE.Mesh(BX(.4,.5,.4),new THREE.MeshBasicMaterial({visible:false}));u.hit.position.y=.22;g.add(u.hit);g.userData=u;return g}
// ---------- survey drone: flies to a target, hovers, beams, then runs a callback ----------
const drone=new THREE.Group();scene.add(drone);drone.position.set(0,2.9,0);
part(CY(.24,.3,.13,6),0x1f3448,0,0,0,drone,{sh:1,m:.6});part(new THREE.SphereGeometry(.11,10,8),0x35e0ff,0,-.07,0,drone,{em:0x35e0ff,ei:1.8});
[Math.PI/4,-Math.PI/4].forEach(a=>part(BX(.95,.03,.06),0x2b445c,0,.02,0,drone).rotation.y=a);
const rotors=[];[[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([a,b])=>{const r=new THREE.Group();r.position.set(a*.34,.07,b*.34);drone.add(r);
 const d=new THREE.Mesh(CY(.2,.2,.01,18),glowMat(0x9be9ff,.22));r.add(d);part(BX(.4,.012,.035),0xd8e8f4,0,.01,0,r);rotors.push(r)});
const beam=new THREE.Mesh(new THREE.ConeGeometry(.4,1,20,1,true),glowMat(0x35e0ff,.2));beam.visible=false;drone.add(beam);
const dShadow=flat(new THREE.CircleGeometry(.4,20),0x000000,.45,.035,world,false);
const DR={q:[],cur:null,ph:0,hold:0};
function flyJob(x,z,fn,hold=.4,hy=1.6){DR.q.push({x,z,fn,hold,hy})}
const droneBusy=()=>DR.q.length+(DR.cur?1:0);
function droneReset(){DR.q.length=0;DR.cur=null;DR.ph=0;beam.visible=false}
function droneTick(rdt){const dt=rdt*SPEED;if(!DR.cur&&DR.q.length){DR.cur=DR.q.shift();DR.ph=0;DR.hold=DR.cur.hold}
 const c=DR.cur,p=drone.position;let tx,ty,tz;
 if(c){tx=c.x;tz=c.z;ty=DR.ph==0?c.hy+1.0:c.hy}else{tx=Math.cos(T*.3)*1.5;tz=Math.sin(T*.3)*1.5;ty=2.95+Math.sin(T*1.4)*.08}
 const k=1-Math.exp(-dt*(c?6:2.4)),ox=p.x,oz=p.z;p.x+=(tx-p.x)*k;p.z+=(tz-p.z)*k;p.y+=(ty-p.y)*k;
 if(c){if(DR.ph==0&&Math.hypot(tx-p.x,tz-p.z)<.14)DR.ph=1;else if(DR.ph==1&&Math.abs(p.y-ty)<.08)DR.ph=2;
  else if(DR.ph==2){DR.hold-=dt;if(DR.hold<=0){const f=c.fn;DR.cur=null;f&&f()}}}
 beam.visible=!!DR.cur&&DR.ph>=1;if(beam.visible){beam.scale.set(1,p.y,1);beam.position.y=-p.y/2;beam.material.opacity=.14+.08*Math.sin(T*18)}
 const sdt=Math.max(rdt,1e-3);drone.rotation.z+=((-(p.x-ox)/sdt*.05)-drone.rotation.z)*.2;drone.rotation.x+=(((p.z-oz)/sdt*.05)-drone.rotation.x)*.2;
 rotors.forEach((r,i)=>r.rotation.y+=rdt*(i%2?-1:1)*60);dShadow.position.set(p.x,.035,p.z);dShadow.scale.setScalar(.7+p.y*.12);dShadow.material.opacity=Math.max(.12,.5-p.y*.07)}
// ---------- orbit camera ----------
const view={az:0,el:.95,dist:24,goal:24,tz:-1.1,min:7,max:70};
function camTick(){view.dist+=(view.goal-view.dist)*.09;const ce=Math.cos(view.el);
 cam.position.set(Math.sin(view.az)*ce*view.dist,Math.sin(view.el)*view.dist,view.tz+Math.cos(view.az)*ce*view.dist);cam.lookAt(0,0,view.tz)}
// ---------- per-frame scene animation ----------
function sceneTick(dt){T+=dt;sweep.rotation.y=-T*.9;holo.rotation.z=T*.6;hubLight.intensity=.8+Math.sin(T*2)*.1;
 blink.forEach(b=>b.material.emissiveIntensity=Math.sin(T*2.4+b.userData.ph)>.4?1.8:.1);
 for(let i=0;i<DN;i++){const d=dustB[i];dustP[i*3]=d[0]+Math.sin(T*.3+d[3])*.7;dustP[i*3+1]=(d[1]+T*.12)%5;dustP[i*3+2]=d[2]+Math.cos(T*.25+d[3])*.7}dustG.attributes.position.needsUpdate=true;
 for(let i=0;i<FXN;i++)if(fxL[i]>0){fxL[i]-=dt*.9;fxV[i*3+1]-=dt*2.6;for(let a=0;a<3;a++)fxP[i*3+a]+=fxV[i*3+a]*dt;const l=Math.max(0,fxL[i]);for(let a=0;a<3;a++)fxC[i*3+a]=fxB[i*3+a]*l;if(l<=0)fxP[i*3+1]=-99}
 fxG.attributes.position.needsUpdate=fxG.attributes.color.needsUpdate=true;droneTick(dt);camTick()}
