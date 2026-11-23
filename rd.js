/* =====================================================================================
   Néo Cité — physique des corps (ragdoll)
   Même principe que Ragdoll Arena : un corps de points (Verlet) reliés par des contraintes
   (os, torse rigide, garde-fous anatomiques), avec gravité, frottement, sol, murs et voitures.
   Le squelette Mixamo des personnages 3D est ensuite orienté segment par segment sur ce corps
   (axes de repos lus dans les matrices de liaison du squelette).
   Utilisé quand un passant ou le joueur est renversé, abattu, soufflé par une explosion,
   éjecté d'un véhicule ou K.O. ; les corps se posent sur le sol, les marches et les voitures.
   Chargé en dernier (après gp.js et gp2.js).
   ===================================================================================== */
'use strict';
(function(){
if(!window.GP)return;
const RD=GP.rd={list:[],acc:0};
const H=1/60,GRAV=9.8*H*H,ITER=7,MAXSIM=10,FRIC=.6;
const BIND_CHILD={Hips:'Spine',Spine:'Spine1',Spine1:'Spine2',Spine2:'Neck',Neck:'Head',Head:'HeadTop_End',
  RightArm:'RightForeArm',RightForeArm:'RightHand',RightHand:'RightHandMiddle1',LeftArm:'LeftForeArm',LeftForeArm:'LeftHand',LeftHand:'LeftHandMiddle1',
  RightUpLeg:'RightLeg',RightLeg:'RightFoot',RightFoot:'RightToeBase',LeftUpLeg:'LeftLeg',LeftLeg:'LeftFoot',LeftFoot:'LeftToeBase'};
const ORDER=['Hips','Spine','Spine1','Spine2','Neck','Head','RightArm','RightForeArm','RightHand','LeftArm','LeftForeArm','LeftHand','RightUpLeg','RightLeg','RightFoot','LeftUpLeg','LeftLeg','LeftFoot'];
const sn=n=>n.replace(/^mixamorig\d*:?/,'');
const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
const _m=new THREE.Matrix4(),_m2=new THREE.Matrix4(),_a=V(),_b=V(),_c=V(),_q=Q(),_q2=Q(),_s=V();

/* ---------- axes de repos de chaque os (depuis les matrices de liaison) ---------- */
function rig(h){if(h.rdRig!==undefined)return h.rdRig;h.rdRig=null;let sk=null;h.root.traverse(o=>{if(!sk&&o.isSkinnedMesh&&o.skeleton)sk=o.skeleton;});if(!sk)return null;
  const bind={},bones={};sk.bones.forEach((b,i)=>{const n=sn(b.name);bones[n]=b;_m.copy(sk.boneInverses[i]).invert();const p=V(),q=Q(),s=V();_m.decompose(p,q,s);bind[n]={p,q};});
  for(const n of ORDER)if(!bones[n])return null;
  const FWD=V().set(0,0,1),RIGHT=V().set(-1,0,0),map={};
  const FALLBACK={RightHand:'RightForeArm',LeftHand:'LeftForeArm'};
  for(const n in BIND_CHILD){const ch=bind[BIND_CHILD[n]];let p;
    if(ch)p=ch.p.clone().sub(bind[n].p).normalize();
    else if(n==='Head')p=V().set(0,1,0);
    else if(FALLBACK[n]&&bind[FALLBACK[n]])p=bind[n].p.clone().sub(bind[FALLBACK[n]].p).normalize();
    else if(/Foot/.test(n))p=V().set(0,-.35,1).normalize();else continue;
    let sec;if(/Arm|Hand/.test(n))sec=V().crossVectors(p,FWD);else if(/Leg|Foot/.test(n))sec=V().crossVectors(/Foot/.test(n)?V().set(0,-1,0):p,FWD.clone().negate());else sec=RIGHT.clone();
    sec.sub(p.clone().multiplyScalar(sec.dot(p)));if(sec.lengthSq()<1e-6)continue;sec.normalize();const inv=bind[n].q.clone().invert();
    map[n]={a:p.clone().applyQuaternion(inv),f:sec.clone().applyQuaternion(inv)};}
  for(const n of ORDER)if(!map[n])return null;
  h.root.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false;});
  return h.rdRig={bones,map};}

/* ---------- création du corps depuis la pose actuelle ---------- */
function startOn(owner,h,vel,o){const R=rig(h);if(!R)return null;h.root.updateMatrixWorld(true);const B=R.bones,P=[],S=[];
  const wp=n=>B[n].getWorldPosition(V());
  const pt=(v,r)=>{P.push({x:v.x,y:v.y,z:v.z,ox:v.x,oy:v.y,oz:v.z,r});return P.length-1;};
  const ht=B.HeadTop_End?wp('HeadTop_End'):wp('Head').add(V().set(0,.18,0));
  const head=pt(wp('Head').lerp(ht,.5),.11),neck=pt(wp('Neck'),.05),chest=pt(wp('Spine2'),.12),pelvis=pt(wp('Hips'),.11);
  const sh=[pt(wp('RightArm'),.06),pt(wp('LeftArm'),.06)],hip=[pt(wp('RightUpLeg'),.07),pt(wp('LeftUpLeg'),.07)];
  const arms=[],legs=[];
  const d=(a,b)=>Math.hypot(P[a].x-P[b].x,P[a].y-P[b].y,P[a].z-P[b].z);
  const st=(a,b,k,kind)=>{let len=d(a,b);if(kind==='min')len*=.45;S.push({a,b,len,k,kind});};
  const T=[neck,chest,pelvis,sh[0],sh[1],hip[0],hip[1]];for(let i=0;i<T.length;i++)for(let j=i+1;j<T.length;j++)st(T[i],T[j],.9);
  st(head,neck,1);st(head,chest,.35);st(head,sh[0],.3);st(head,sh[1],.3);
  for(let s=0;s<2;s++){const S_=s?'Left':'Right';
    const el=pt(wp(S_+'ForeArm'),.05),ha=pt(wp(S_+'Hand'),.045);st(sh[s],el,1);st(el,ha,1);st(sh[s],ha,1,'min');arms.push({sh:sh[s],el,ha});
    const kn=pt(wp(S_+'Leg'),.06),ft=pt(wp(S_+'Foot'),.05),toe=pt(B[S_+'ToeBase']?wp(S_+'ToeBase'):wp(S_+'Foot').add(V().set(0,-.05,.12)),.04);
    st(hip[s],kn,1);st(kn,ft,1);st(hip[s],ft,1,'min');st(ft,toe,1);st(kn,toe,.15);legs.push({hip:hip[s],kn,ft,toe});}
  const c={owner,h,R,P,S,head,neck,chest,pelvis,sh,hip,arms,legs,sleep:0,frozen:false,t:0,wq:{}};
  // vitesse initiale (m/s) : les jambes partent plus vite que la tête (le corps bascule)
  const vx=vel.x||0,vy=vel.y||0,vz=vel.z||0,spin=o&&o.spin!=null?o.spin:.35;
  P.forEach((p,i)=>{const low=(i>=legs[0].kn&&i<=legs[0].toe)||(i>=legs[1].kn&&i<=legs[1].toe)?1+spin:i===head?1-spin*.6:1;p.ox=p.x-vx*H*low;p.oy=p.y-vy*H;p.oz=p.z-vz*H*low;});
  owner.rd=c;RD.list.push(c);
  if(RD.list.filter(r=>!r.frozen).length>MAXSIM){const old=RD.list.find(r=>!r.frozen&&r!==c);if(old)old.frozen=true;}
  return c;}
RD.start=startOn;
RD.active=owner=>!!(owner&&owner.rd);
function stop(c){const i=RD.list.indexOf(c);if(i>=0)RD.list.splice(i,1);if(c.owner.rd===c)c.owner.rd=null;}
RD.stop=owner=>{if(owner&&owner.rd)stop(owner.rd);};
RD.impulse=function(owner,x,y,z,dx,dy,dz,k){const c=owner&&owner.rd;if(!c)return;c.frozen=false;c.sleep=0;let best=0,bd=1e9;c.P.forEach((p,i)=>{const q=(p.x-x)**2+(p.y-y)**2+(p.z-z)**2;if(q<bd){bd=q;best=i;}});
  c.P.forEach((p,i)=>{const w=i===best?1:.25;p.ox-=dx*k*H*w;p.oy-=dy*k*H*w;p.oz-=dz*k*H*w;});};

/* ---------- simulation ---------- */
const CC=new Array(6);
function step(c){const P=c.P,pel=P[c.pelvis];
  for(const p of P){let vx=(p.x-p.ox)*.996,vy=(p.y-p.oy)*.996,vz=(p.z-p.oz)*.996;const vm=Math.abs(vx)+Math.abs(vy)+Math.abs(vz);if(vm>.9){const k=.9/vm;vx*=k;vy*=k;vz*=k;}
    if(p.y<WL-.2){vx*=.93;vy*=.9;vz*=.93;vy+=GRAV*1.08;}p.ox=p.x;p.oy=p.y;p.oz=p.z;p.x+=vx;p.y+=vy-GRAV;p.z+=vz;}
  const boxes=queryColl(pel.x-2.5,pel.x+2.5,pel.z-2.5,pel.z+2.5);
  const near=cars.filter(k=>k.on&&!k.dead&&Math.abs(k.x-pel.x)<6&&Math.abs(k.z-pel.z)<6);
  for(let it=0;it<ITER;it++){
    for(const s of c.S){const a=P[s.a],b=P[s.b];let dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;const d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6;if(s.kind==='min'&&d>=s.len)continue;
      const k=s.k*(d-s.len)/d*.5;dx*=k;dy*=k;dz*=k;a.x+=dx;a.y+=dy;a.z+=dz;b.x-=dx;b.y-=dy;b.z-=dz;}
    if(it>=2)limits(c);
    for(const p of P){const g=groundY(p.x,p.z);if(p.y<g+p.r){p.y=g+p.r;if(p.oy>p.y)p.oy=p.y;}
      for(const b of boxes){const r=p.r;if(p.x>b.minx-r&&p.x<b.maxx+r&&p.y>b.miny-r&&p.y<b.maxy+r&&p.z>b.minz-r&&p.z<b.maxz+r){
        const o=[p.x-(b.minx-r),(b.maxx+r)-p.x,p.y-(b.miny-r),(b.maxy+r)-p.y,p.z-(b.minz-r),(b.maxz+r)-p.z];let mi=0;for(let i=1;i<6;i++)if(o[i]<o[mi])mi=i;
        if(mi===0)p.x=b.minx-r;else if(mi===1)p.x=b.maxx+r;else if(mi===2)p.y=b.miny-r;else if(mi===3){p.y=b.maxy+r;if(p.oy>p.y)p.oy=p.y;}else if(mi===4)p.z=b.minz-r;else p.z=b.maxz+r;}}
      // carrosseries : les corps sont poussés (et emportés) par les voitures
      for(const k of near){if(p.y>k.y+1.45)continue;carCircles(k,CC);for(let j=0;j<3;j++){const dx=p.x-CC[j*2],dz=p.z-CC[j*2+1],d=Math.hypot(dx,dz),R=CR+p.r*.5;
        if(d<R&&d>1e-4){p.x+=dx/d*(R-d);p.z+=dz/d*(R-d);const sp=Math.hypot(k.vx,k.vz);if(sp>2){p.ox=p.x-k.vx*H*.9;p.oz=p.z-k.vz*H*.9;p.oy=p.y-Math.min(6,sp*.25)*H;}}}}}}
  for(const p of P){if(p.y<=groundY(p.x,p.z)+p.r+.01){p.ox=p.x-(p.x-p.ox)*FRIC;p.oz=p.z-(p.z-p.oz)*FRIC;}}
  if(!Number.isFinite(pel.x+pel.y+pel.z)){stop(c);return;}
  let mv=0;for(const p of P){const v=Math.abs(p.x-p.ox)+Math.abs(p.y-p.oy)+Math.abs(p.z-p.oz);if(v>mv)mv=v;}c.sleep=mv<.0012?c.sleep+1:0;}
// garde-fous anatomiques : genoux vers l'avant, coudes vers l'arrière, tête au-dessus du cou
const _u=V(),_l=V(),_f=V(),_v=V();
function limits(c){const P=c.P,p=i=>_v.set(P[i].x,P[i].y,P[i].z);
  _u.set(P[c.chest].x-P[c.pelvis].x,P[c.chest].y-P[c.pelvis].y,P[c.chest].z-P[c.pelvis].z).normalize();_l.set(P[c.hip[0]].x-P[c.hip[1]].x,P[c.hip[0]].y-P[c.hip[1]].y,P[c.hip[0]].z-P[c.hip[1]].z).normalize();_f.crossVectors(_u,_l).normalize();
  for(const L of c.legs){const k=P[L.kn],a=P[L.hip],b=P[L.ft];const d=(k.x-(a.x+b.x)/2)*_f.x+(k.y-(a.y+b.y)/2)*_f.y+(k.z-(a.z+b.z)/2)*_f.z;if(d<.02){const m=(.02-d)*.6;k.x+=_f.x*m;k.y+=_f.y*m;k.z+=_f.z*m;}}
  _u.set(P[c.neck].x-P[c.chest].x,P[c.neck].y-P[c.chest].y,P[c.neck].z-P[c.chest].z).normalize();_l.set(P[c.sh[0]].x-P[c.sh[1]].x,P[c.sh[0]].y-P[c.sh[1]].y,P[c.sh[0]].z-P[c.sh[1]].z).normalize();_f.crossVectors(_u,_l).normalize();
  for(const A of c.arms){const e=P[A.el],a=P[A.sh],b=P[A.ha];const d=(e.x-(a.x+b.x)/2)*_f.x+(e.y-(a.y+b.y)/2)*_f.y+(e.z-(a.z+b.z)/2)*_f.z;if(d>-.02){const m=(d+.02)*.6;e.x-=_f.x*m;e.y-=_f.y*m;e.z-=_f.z*m;}}}

/* ---------- squelette piloté par le corps physique ---------- */
function basis(m,p,f){_s.crossVectors(p,f);m.makeBasis(p,f,_s);return m;}
const SEC={latP:V(),latC:V(),armN0:V(),armN1:V(),legN0:V(),legN1:V()},_fc=V(),_fp=V();
function hinge(out,P,a,b,cc,fb,flip,upC){const u=_a.set(P[b].x-P[a].x,P[b].y-P[a].y,P[b].z-P[a].z).normalize(),w=_b.set(P[cc].x-P[b].x,P[cc].y-P[b].y,P[cc].z-P[b].z).normalize();
  out.crossVectors(u,w);if(out.lengthSq()<.02){out.crossVectors(u,flip?_c.copy(fb).negate():fb);if(out.lengthSq()<.02)out.crossVectors(u,upC);}return out.normalize();}
function drive(c){const R=c.R,B=R.bones,P=c.P,W=c.wq,A=c.arms,L=c.legs;
  const vec=(a,b,o)=>o.set(P[b].x-P[a].x,P[b].y-P[a].y,P[b].z-P[a].z);
  vec(c.hip[1],c.hip[0],SEC.latP).normalize();vec(c.sh[1],c.sh[0],SEC.latC).normalize();
  const upC=vec(c.chest,c.neck,V()).normalize(),upP=vec(c.pelvis,c.chest,V()).normalize();_fc.crossVectors(upC,SEC.latC).normalize();_fp.crossVectors(upP,SEC.latP).normalize();
  hinge(SEC.armN0,P,A[0].sh,A[0].el,A[0].ha,_fc,false,upC);hinge(SEC.armN1,P,A[1].sh,A[1].el,A[1].ha,_fc,false,upC);
  hinge(SEC.legN0,P,L[0].hip,L[0].kn,L[0].ft,_fp,true,upC);hinge(SEC.legN1,P,L[1].hip,L[1].kn,L[1].ft,_fp,true,upC);
  const T=c.T||(c.T={Hips:[c.pelvis,c.chest,'latP'],Spine:[c.pelvis,c.chest,'latP'],Spine1:[c.pelvis,c.chest,'latC'],Spine2:[c.chest,c.neck,'latC'],Neck:[c.neck,c.head,'latC'],Head:[c.neck,c.head,'latC'],
    RightArm:[A[0].sh,A[0].el,'armN0'],RightForeArm:[A[0].el,A[0].ha,'armN0'],RightHand:[A[0].el,A[0].ha,'armN0'],LeftArm:[A[1].sh,A[1].el,'armN1'],LeftForeArm:[A[1].el,A[1].ha,'armN1'],LeftHand:[A[1].el,A[1].ha,'armN1'],
    RightUpLeg:[L[0].hip,L[0].kn,'legN0'],RightLeg:[L[0].kn,L[0].ft,'legN0'],RightFoot:[L[0].ft,L[0].toe,'legN0'],LeftUpLeg:[L[1].hip,L[1].kn,'legN1'],LeftLeg:[L[1].kn,L[1].ft,'legN1'],LeftFoot:[L[1].ft,L[1].toe,'legN1']});
  const hips=B.Hips;c.h.root.updateMatrixWorld(true);const F=new Map();
  const worldQ=b=>{let q=F.get(b);if(q)return q;q=Q();if(b===hips.parent||!b.isBone||!b.parent)b.getWorldQuaternion(q);else q.copy(worldQ(b.parent)).multiply(b.quaternion);F.set(b,q);return q;};
  for(const n of ORDER){const b=B[n],t=T[n],mp=R.map[n];const parent=worldQ(b.parent);
    const p=vec(t[0],t[1],_a);if(p.lengthSq()<1e-8)p.set(0,1,0);p.normalize();const f=_b.copy(SEC[t[2]]);f.sub(_c.copy(p).multiplyScalar(f.dot(p)));if(f.lengthSq()<1e-6){f.copy(_fc);f.sub(_c.copy(p).multiplyScalar(f.dot(p)));}f.normalize();
    basis(_m,p,f);const fl=_c.copy(mp.f).sub(V().copy(mp.a).multiplyScalar(mp.f.dot(mp.a))).normalize();basis(_m2,mp.a.clone(),fl);_m.multiply(_m2.transpose());
    const wq=W[n]||(W[n]=Q());wq.setFromRotationMatrix(_m);b.quaternion.copy(_q.copy(parent).invert().multiply(wq));F.set(b,wq);}
  const pel=P[c.pelvis];hips.position.copy(hips.parent.worldToLocal(_a.set(pel.x,pel.y,pel.z)));
  // les os non pilotés (doigts, orteils) gardent leur rotation locale
  c.h.root.updateMatrixWorld(true);}

/* ---------- qui passe en ragdoll, et quand ---------- */
function wantPed(p){return !!p.hum&&!p.off&&(p.gdead||(p.state==='down'&&(p.t||0)<2.3));}
function wantPlayer(){return !!HUM.playerH&&!player.car&&(player.dead||player.knock>1.15)&&!(typeof CHUTE!=='undefined'&&(CHUTE.open||CHUTE.free));}
RD.update=function(dt,P){
  // départs
  for(const p of peds){if(p.rd){if(p.rd.h!==p.hum||!wantPed(p))stop(p.rd);continue;}if(wantPed(p)&&Math.hypot(p.x-P.x,p.z-P.z)<90)startOn(p,p.hum,{x:p.vx||0,y:p.vy||0,z:p.vz||0});}
  if(player.rd){if(player.rd.h!==HUM.playerH||!wantPlayer())stop(player.rd);}
  else if(wantPlayer())startOn(player,HUM.playerH,{x:player.vx||0,y:player.vy||0,z:player.vz||0},{spin:.2});
  // pas fixes de 1/60 s
  RD.acc=Math.min(RD.acc+dt,4*H);while(RD.acc>=H){RD.acc-=H;for(const c of RD.list)if(!c.frozen&&c.sleep<90)step(c);}
  // corps immobiles depuis longtemps : figés (plus de calcul)
  const live=RD.list.filter(c=>!c.frozen);if(live.length>MAXSIM)live[0].frozen=true;
  for(const c of RD.list){const pel=c.P[c.pelvis],o=c.owner;if(o===player){player.x=pel.x;player.z=pel.z;player.y=Math.max(groundY(pel.x,pel.z),pel.y-.95);}
    else{o.x=pel.x;o.z=pel.z;o.y=groundY(pel.x,pel.z);}}
};
RD.apply=function(){for(const c of RD.list){try{if(c.h&&c.h.root.visible)drive(c);}catch(e){stop(c);}}};
{const _uh=window.updateHumans;window.updateHumans=function(dt,P){_uh(dt,P);if(HUM.ready)RD.apply();};}
{const _u=GP.update;GP.update=function(dt,P){_u(dt,P);try{RD.update(dt,P);}catch(e){console.warn(e);}};}
// balles : la partie touchée est projetée dans le sens du tir
{const _ah=window.applyHit;window.applyHit=function(r,w){const res=_ah(r,w);try{if(r&&r.hit&&r.hit.kind==='ped'){const p=r.hit.ref;if(!p.rd&&wantPed(p)&&p.hum)startOn(p,p.hum,{x:(p.vx||0)+r.d.x*1.5,y:0,z:(p.vz||0)+r.d.z*1.5});
  if(p.rd)RD.impulse(p,r.end.x,r.end.y,r.end.z,r.d.x,r.d.y,r.d.z,(w.dmg||10)*.18);}}catch(e){}return res;};}
// explosions : souffle radial sur les corps
{const _bl=window.blast;window.blast=function(x,y,z,R){const res=_bl.apply(this,arguments);try{for(const c of RD.list){const pel=c.P[c.pelvis],d=Math.hypot(pel.x-x,pel.z-z);if(d>R*1.3)continue;
  const k=(1-d/(R*1.3))*14,dx=(pel.x-x)/(d||1),dz=(pel.z-z)/(d||1);c.frozen=false;c.sleep=0;for(const p of c.P){p.ox-=dx*k*H;p.oz-=dz*k*H;p.oy-=k*.6*H;}}}catch(e){}return res;};}
RD.ready=true;
})();
