/* =====================================================================================
   Néo Cité — gameplay « nouvelle génération »
   Chargé APRÈS le script principal : réutilise ses fonctions et en enveloppe certaines.
   - Police : ligne de vue (voitures, agents à pied, hélico), cônes de vision sur la mini-carte,
     zone de recherche autour de la dernière position connue, fouille du secteur, barrages et herses,
     messages radio. On sème la police en sortant de la zone sans être vu (toutes les étoiles d'un coup).
   - Conduite : inertie de la direction, dérapages contrôlés au frein à main, fumée et traces de pneus,
     caméra qui suit la glisse.
   - Combat : se mettre à couvert (touche A en AZERTY / Q en QWERTY), sortir la tête pour tirer,
     recul de l'arme, marqueurs d'impact, gangsters qui se déplacent en tirant.
   - Monde vivant : événements aléatoires (fourgon blindé, course de rue, vol à l'arraché,
     course-poursuite policière), GPS sur la mini-carte, réseau social NéoGram, passants qui filment.
   ===================================================================================== */
'use strict';
(function(){
const GP=window.GP={};
const hyp=Math.hypot,dist2=(a,b)=>hyp(a.x-b.x,a.z-b.z);
const AZ=/^fr/i.test(navigator.language||'fr');const KCOV=AZ?'A':'Q';

/* ================= HUD ================= */
const H={ok:false};
function hud(){if(H.ok)return;H.ok=true;
  const st=document.createElement('style');st.textContent=`
#gpObj{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:5;pointer-events:none;background:rgba(14,6,24,.8);border-left:4px solid #ff3d9a;border-radius:8px;padding:7px 16px;font:700 19px var(--font);color:#fff;text-align:center;max-width:min(560px,74vw);box-shadow:0 6px 20px rgba(0,0,0,.35)}
#gpObj.low{top:calc(84px + env(safe-area-inset-top,0px))}#gpObj small{display:block;font-weight:500;font-size:15px;color:#ecdff3}
#gpNote{position:fixed;left:calc(14px + env(safe-area-inset-left,0px));top:calc(74px + env(safe-area-inset-top,0px));z-index:7;pointer-events:none;display:flex;gap:10px;align-items:center;max-width:min(370px,64vw);padding:9px 14px;border-radius:12px;background:rgba(14,6,24,.88);border:1px solid rgba(255,61,154,.6);color:#fff;font:600 15px/1.25 var(--font);transform:translateX(-130%);transition:transform .45s cubic-bezier(.2,.8,.2,1);box-shadow:0 8px 24px rgba(0,0,0,.4)}
#gpNote.on{transform:none}#gpNote i{font-style:normal;font-size:24px}#gpNote b{color:#ff8ac4}
#gpHit{position:fixed;left:50%;top:50%;width:24px;height:24px;margin:-12px 0 0 -12px;z-index:6;pointer-events:none;opacity:0;transition:opacity .1s}
#gpHit::before,#gpHit::after{content:"";position:absolute;left:11px;top:-3px;width:2px;height:30px;background:#fff;box-shadow:0 0 3px #000}#gpHit::before{transform:rotate(45deg)}#gpHit::after{transform:rotate(-45deg)}
#gpHit.on{opacity:1}#gpHit.kill::before,#gpHit.kill::after{background:#ff3b3b}
#tCov{left:calc(40px + env(safe-area-inset-left,0px));bottom:calc(200px + env(safe-area-inset-bottom,0px));width:58px;height:58px;font-size:12px}
.ngFeed{display:flex;flex-direction:column;gap:8px;padding:2px 0 8px}.ngPost{background:rgba(255,255,255,.06);border-radius:12px;padding:9px 11px;text-align:left}
.ngPost b{color:#ff8ac4;font-size:14px}.ngPost small{color:#9aa4ad;margin-left:6px}.ngPost p{margin:4px 0 2px;font-size:15px;line-height:1.25;color:#f3f5f7}.ngPost .ngVid{height:62px;border-radius:8px;margin:6px 0 2px;background:linear-gradient(120deg,#ff3d9a,#ff9a5a 55%,#5b2a86);display:flex;align-items:center;justify-content:center;font-size:24px}
.ngPost em{font-style:normal;color:#9aa4ad;font-size:13px}.ngPost.me{border:1px solid rgba(255,61,154,.45)}`;
  document.head.appendChild(st);
  const o=document.createElement('div');o.id='gpObj';o.className='hud';o.hidden=true;document.body.appendChild(o);H.obj=o;
  const n=document.createElement('div');n.id='gpNote';n.innerHTML='<i>📸</i><span></span>';document.body.appendChild(n);H.note=n;
  const h=document.createElement('div');h.id='gpHit';document.body.appendChild(h);H.hit=h;
  const t=$('touch');if(t){const b=document.createElement('button');b.className='tb';b.id='tCov';b.textContent='COUV.';b.hidden=true;
    b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();CV.req=true;});t.appendChild(b);H.cov=b;}}
function objective(title,sub){if(!H.ok)return;const el=H.obj;if(!title){el.hidden=true;el.dataset.k='';return;}const k=title+'|'+sub;
  if(el.dataset.k!==k){el.dataset.k=k;el.innerHTML=title+(sub?`<small>${sub}</small>`:'');}el.hidden=false;el.classList.toggle('low',!$('mission').hidden);}
let noteT=0;
function note(icon,html){if(!H.ok)return;H.note.querySelector('i').textContent=icon;H.note.querySelector('span').innerHTML=html;H.note.classList.add('on');noteT=4.5;}
let hitT=0;
function hitMark(kill){if(!H.ok)return;H.hit.classList.add('on');H.hit.classList.toggle('kill',!!kill);hitT=kill?.35:.16;}
const RADIO={t:-99};
function radio(t,force){if(!force&&gameT-RADIO.t<5)return;RADIO.t=gameT;showSub('📻 Central : '+t);}

/* ================= NéoGram (réseau social) ================= */
const NGU=['@lea.neo','@kev_drift','@sarah.sunset','@tonton_ricard','@maya.vlog','@neo_info','@jojo.ride','@ines.beach','@ryan.cars','@mamie_rose','@dj_pinede','@nina.palmiers','@le_vrai_momo','@clara.daily','@yanis.moto'];
const FEED=GP.feed=[];let ngUnread=0;
function post(text,me,vid){const u=rpick(NGU);FEED.unshift({u,t:text,at:gameT,lk:Math.floor(rnd(12,900)*(me?4:1)),me:!!me,vid:!!vid});if(FEED.length>40)FEED.pop();ngUnread++;
  if(me)note('📸',`<b>${u}</b> a publié une vidéo de toi sur NéoGram`);}
GP.post=post;
const AMB=[['Coucher de soleil sur la plage de Néo Cité 🌅 rien ne bat ça',1],['Embouteillage monstre vers Port-Soleil, courage à tous 🚗🚗🚗'],['Le Néo Burger a sorti un menu XXL, je suis mort 🍔'],['Quelqu\'un sait pourquoi il y a autant de flics vers le centre ? 🚓'],
  ['Ma voisine fait du roller avec son chien, la ville est folle 😂'],['Soirée sur les toits ce soir, néons partout ✨',1],['Encore un braquage à la bijouterie ?! 💎'],['Les palmiers de l\'avenue la nuit… vibe incroyable 🌴',1],['J\'ai vu un hélico raser les immeubles, le bruit 😱'],
  ['Petit footing au bord de l\'eau, 28 °C à 19 h ☀️'],['Qui a garé une supercar en double file devant la pharmacie ??'],['Promo à la station Néo Fuel, plein + lavage 🧽']];
GP.feedHTML=function(){ngUnread=0;return phTitle('NéoGram')+'<div class="ngFeed">'+(FEED.length?FEED.map(p=>{const m=Math.max(1,Math.round((gameT-p.at)/60*24));
  return `<div class="ngPost${p.me?' me':''}"><b>${p.u}</b><small>il y a ${m<60?m+' min':Math.round(m/60)+' h'}</small>${p.vid?'<div class="ngVid">▶</div>':''}<p>${p.t}</p><em>♥ ${p.lk.toLocaleString('fr-FR')}</em></div>`;}).join(''):'<div class="ngPost"><p>Rien pour l\'instant. Fais parler de toi…</p></div>')+'</div>';};

/* ================= POLICE v2 ================= */
const WS=GP.ws={mode:'none',lkp:{x:0,z:0},lostT:0,outT:0,hideT:0,rbCD:25,blocks:[],posted:false};
const zoneR=()=>80+player.stars*35;
const CALL=['Signalement en cours, unités disponibles en route.','Suspect identifié, toutes les patrouilles sur le secteur.','Code 3 : intervention immédiate.'];
const LOST=['On a perdu le visuel ! Fouillez le secteur.','Suspect hors de vue, quadrillez la zone.','Plus de contact visuel, on resserre le périmètre.'];
const SPOT=['Suspect repéré ! On le reprend !','Contact visuel, je l\'ai !','Il est là ! Toutes les unités !'];
const GIVEUP=['Recherches terminées, le suspect s\'est volatilisé.','Fin de la traque, on lève le dispositif.'];
function indoors(P){return INT.on||zones.some(z=>z.kind==='inside'&&P.x>z.minx&&P.x<z.maxx&&P.z>z.minz&&P.z<z.maxz);}
const SEE={t:0,v:false};
function detect(P,dt){SEE.t-=dt;if(SEE.t>0)return SEE.v;SEE.t=.2;
  let v=false;const py=(P.y||0)+1.3,hide=indoors(P),st=player.stars;
  for(const c of cars){if(c.ai!=='police'||!c.on||c.dead||c.gpChase)continue;const dx=P.x-c.x,dz=P.z-c.z,d=hyp(dx,dz),R=60+st*12;if(d>R)continue;
    if(d>22&&!c.gpBlock&&(dx*Math.sin(c.h)+dz*Math.cos(c.h))/d<.25)continue;if(hide&&d>8)continue;
    if(rayT(c.x,c.y+1.5,c.z,P.x,py,P.z)>=.97){v=true;c.gpSeen=gameT;break;}}
  if(!v)for(const p of POL.off){if(p.off||p.state==='down'||p.gdead)continue;const d=hyp(P.x-p.x,P.z-p.z);if(d>55||hide&&d>6)continue;if(rayT(p.x,p.y+1.6,p.z,P.x,py,P.z)>=.97){v=true;break;}}
  if(!v&&heli.on&&!hide){const hp=heli.g.position;if(hyp(hp.x-P.x,hp.z-P.z)<70)v=true;}
  SEE.v=v;return v;}
function spawnCop(c,s){c.place(s.x,s.z,s.h);c.ai='police';c.graph=false;c.dead=false;c.health=100;c.burn=0;c.paintMesh.material=paint(c.color);c.headM.material=CARM.head;c.tailM.material=CARM.tail;
  c.setDriver(true);c.on=true;c.group.visible=true;c.vx=Math.sin(s.h)*15;c.vz=Math.cos(s.h)*15;c.copsOut=false;c.skidT=0;c.parkT=0;c.gpBlock=false;c.gpChase=null;c.sp=null;}
function escapeWanted(){player.stars=0;seenT=0;bustT=0;toast('Tu as semé la police');sfx.ding();radio(rpick(GIVEUP),true);
  for(const c of police)if(c.ai==='police'&&!c.gpChase){c.ai='traffic';c.cruise=12;c.gpBlock=false;snapToGraph(c);}
  clearBlocks();WS.mode='none';if(gameT-WS.start>25)post(rpick(['La police a perdu la trace du fuyard 👀 #NéoCité','Ils l\'ont cherché partout… évaporé 💨','Grosse traque ce soir, le suspect court toujours 🚓']),false);}
function endWanted(){WS.mode='none';clearBlocks();}
// position et direction de la route la plus proche (grille de la ville ou routes entre les villes)
function roadAt(x,z){
  if(Math.abs(x)<HALF+4&&Math.abs(z)<HALF+4){const gx=nodePos(clamp(Math.round((x+HALF)/CELL),0,N)),gz=nodePos(clamp(Math.round((z+HALF)/CELL),0,N)),dX=Math.abs(x-gx),dZ=Math.abs(z-gz);
    if(dX<dZ){if(dZ<16)return null;return {x:gx,z,dx:0,dz:1};}if(dX<16)return null;return {x,z:gz,dx:1,dz:0};}
  let best=null,bd=14;for(const r of ROADS){const x0=r[0],z0=r[1],vx=r[2]-x0,vz=r[3]-z0,L2=vx*vx+vz*vz;const t=clamp(((x-x0)*vx+(z-z0)*vz)/L2,.05,.95),qx=x0+vx*t,qz=z0+vz*t,d=hyp(x-qx,z-qz);
    if(d<bd){const L=Math.sqrt(L2);bd=d;best={x:qx,z:qz,dx:vx/L,dz:vz/L};}}return best;}
GP.roadAt=roadAt;
function searchPoint(){for(let k=0;k<12;k++){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*zoneR(),q=roadAt(WS.lkp.x+Math.cos(a)*r,WS.lkp.z+Math.sin(a)*r);if(q)return {x:q.x,z:q.z};}return {x:WS.lkp.x,z:WS.lkp.z};}
// conduite d'une voiture IA vers un point (grille en ville, ligne droite ailleurs)
function drivePoint(c,T,dt,vmax){
  if(c.rev>0){c.rev-=dt;carPhysics(c,-1,c.revS,false,dt);return;}
  const dx=T.x-c.x,dz=T.z-c.z,d=hyp(dx,dz),city=Math.abs(c.x)<HALF+12&&Math.abs(c.z)<HALF+12&&Math.abs(T.x)<HALF+12&&Math.abs(T.z)<HALF+12;let desired,vt;
  if(d<45||!city){desired=Math.atan2(dx,dz);vt=Math.min(vmax,d*.7+5);c.graph=false;}
  else{if(!c.graph){snapToGraph(c);c.graph=true;}if(hyp(c.tx-c.x,c.tz-c.z)<8)chooseNext(c,T);desired=Math.atan2(c.tx-c.x,c.tz-c.z);vt=Math.abs(wrapA(desired-c.h))>.4?11:vmax;}
  if(T.slow&&d<T.slow.d)vt=Math.min(vt,T.slow.v);
  const diff=wrapA(desired-c.h),steer=clamp(diff*2.6,-1,1),thr=clamp((vt-(c.vf||0))*.4,-1,1),hb=Math.abs(diff)>1.2&&c.vf>14;
  if(thr>.5&&c.speed<1.2)c.stuck=(c.stuck||0)+dt;else c.stuck=Math.max(0,(c.stuck||0)-dt);
  if(c.stuck>1.3){c.stuck=0;c.rev=1.2;c.revS=-Math.sign(diff)||1;}
  carPhysics(c,thr,steer,hb,dt);}
GP.drivePoint=drivePoint;
// barrages : deux voitures en travers de la route devant le suspect + herse
const SPK={geo:null,mat:null};
function spikeMesh(){if(!SPK.geo){const parts=[new THREE.BoxGeometry(12,.05,.42).translate(0,.05,0)];for(let i=0;i<30;i++){const c=new THREE.ConeGeometry(.045,.16,4);c.translate(-5.8+i*.4,.13,(i%2?.1:-.1));parts.push(c);}
  SPK.geo=THREE.BufferGeometryUtils.mergeBufferGeometries(parts.map(g=>g.index?g.toNonIndexed():g));SPK.mat=new THREE.MeshStandardMaterial({color:0x2a2c30,metalness:.8,roughness:.35});}
  const m=new THREE.Mesh(SPK.geo,SPK.mat);m.castShadow=true;scene.add(m);return m;}
function tryRoadblock(P){if(player.stars<3||!player.car||WS.rbCD>0||policeETA>0||player.car.T.fly||player.car.T.boat)return;
  const car=player.car,sp=hyp(car.vx,car.vz);if(sp<12)return;const hx=car.vx/sp,hz=car.vz/sp;
  const r=roadAt(P.x+hx*135,P.z+hz*135);if(!r)return;let dx=r.dx,dz=r.dz;const al=dx*hx+dz*hz;if(Math.abs(al)<.75)return;if(al<0){dx=-dx;dz=-dz;}
  const free=police.filter(c=>c.type!=='jeep'&&!c.gpChase&&(c.ai==='off'||(c.ai==='traffic'||c.ai==='police'&&!c.gpBlock)&&dist2(c,P)>115)).slice(0,2);if(free.length<2){WS.rbCD=6;return;}
  const px=-dz,pz=dx,b={cars:free,x:r.x,z:r.z,dx,dz,t:45,spike:null,hit:new Set()};
  free.forEach((c,i)=>{const o=i?3.4:-3.4;spawnCop(c,{x:r.x+px*o,z:r.z+pz*o,h:Math.atan2(px,pz)+(i?Math.PI:0)+rnd(-.2,.2)});c.vx=c.vz=0;c.gpBlock=true;c.copsOut=true;});
  if(player.stars>=4||Math.random()<.6){const m=spikeMesh();m.position.set(r.x-dx*16,groundY(r.x-dx*16,r.z-dz*16),r.z-dz*16);m.rotation.y=Math.atan2(px,pz)+Math.PI/2;b.spike=m;}
  WS.blocks.push(b);WS.rbCD=32;radio(b.spike?'Barrage et herse en place sur sa route !':'Barrage en place, on le bloque !',true);}
function clearBlocks(){for(const b of WS.blocks){for(const c of b.cars)c.gpBlock=false;if(b.spike)scene.remove(b.spike);}WS.blocks.length=0;}
function updateBlocks(dt,P){for(let i=WS.blocks.length-1;i>=0;i--){const b=WS.blocks[i];b.t-=dt;const along=(P.x-b.x)*b.dx+(P.z-b.z)*b.dz;
    if(b.spike){const c=player.car;if(c&&!b.hit.has(c)&&!c.T.fly){const sx=b.spike.position.x,sz=b.spike.position.z,a=(c.x-sx)*b.dx+(c.z-sz)*b.dz,l=(c.x-sx)*-b.dz+(c.z-sz)*b.dx;
      if(Math.abs(a)<1.4&&Math.abs(l)<6.3&&c.speed>3){b.hit.add(c);let n=0;for(let k=0;k<4;k++)if(c.wheels[k]&&Math.random()<.85){popTyre(c,k);n++;}if(n){toast('HERSE !\nPneus crevés');shake=.5;}}}}
    if(b.t<0||along>45||player.stars===0){for(const c of b.cars)c.gpBlock=false;if(b.spike&&(b.t<-10||player.stars===0||along>140)){scene.remove(b.spike);b.spike=null;}if(!b.spike){WS.blocks.splice(i,1);}else b.cars=[];}}}

window.updateWanted=function(dt,P){
  policeCD-=dt;wantedCD-=dt;WS.rbCD-=dt;
  const active=police.filter(c=>c.ai==='police'&&!c.gpChase);
  if(player.stars>0&&WS.mode==='none'){WS.mode='chase';WS.lkp.x=P.x;WS.lkp.z=P.z;WS.lostT=0;WS.start=gameT;}
  if(player.stars>0&&policeETA>0&&!prison.on){policeETA-=dt;seenT=0;const el=$('policeEta');el.hidden=false;el.textContent=`🚓 Police dans ${Math.ceil(policeETA)} s`;bustT=0;
    WS.mode='chase';WS.lkp.x=P.x;WS.lkp.z=P.z;WS.lostT=0;$('stars').classList.remove('blink');return;}
  $('policeEta').hidden=true;
  if(player.stars<=0){if(WS.mode!=='none')endWanted();$('stars').classList.remove('blink');bustT=0;return;}
  const want=Math.min(6,player.stars+(player.stars>=3?1:0)),mil=player.stars>=5,C=WS.mode==='search'&&hyp(P.x-WS.lkp.x,P.z-WS.lkp.z)<250?WS.lkp:P;
  const free=c=>!c.gpBlock&&!c.gpChase&&(c.ai==='off'||(c.ai==='traffic'&&hyp(c.x-P.x,c.z-P.z)>60));
  if(active.length<want+(mil?2:0)&&policeCD<=0){const c=police.find(c=>free(c)&&(c.type==='jeep')===mil&&(mil||Math.random()<.9))||police.find(free);
    if(c){const s=inBase(C.x,C.z)||Math.abs(C.x)>HALF+12||Math.abs(C.z)>HALF+12?offroadSpot(C):randomRoadSpot(C,70,150);if(s){spawnCop(c,s);policeCD=3.5-player.stars*.4;}}}
  const seen=player.dead?false:detect(P,dt);
  if(seen){if(WS.mode==='search')radio(rpick(SPOT),true);WS.mode='chase';WS.lkp.x=P.x;WS.lkp.z=P.z;WS.lostT=0;WS.outT=0;WS.hideT=0;}
  else{WS.lostT+=dt;
    if(WS.mode==='chase'&&WS.lostT>1.5){WS.mode='search';for(const c of active)c.sp=null;radio(rpick(LOST));}
    if(WS.mode==='search'){const d=hyp(P.x-WS.lkp.x,P.z-WS.lkp.z);if(d>zoneR())WS.outT+=dt;else{WS.outT=Math.max(0,WS.outT-dt*.5);WS.hideT+=dt;}
      if(WS.outT>3+player.stars*1.4||WS.hideT>35+player.stars*9){escapeWanted();return;}}}
  $('stars').classList.toggle('blink',WS.mode==='search');
  if(WS.mode==='chase')tryRoadblock(P);
  updateBlocks(dt,P);
  let near=1e9;for(const c of active){const d=hyp(c.x-P.x,c.z-P.z);near=Math.min(near,d);}
  const ps=hyp(P.vx||0,P.vz||0);
  if(near<(player.car?6:6.5)&&ps<2.5&&!player.dead)bustT+=dt;else bustT=Math.max(0,bustT-dt*2);
  if(bustT>(player.car?3:1.8))busted();
};
{const _aw=window.addWanted;window.addWanted=function(n){const b=player.stars;_aw(n);if(player.stars>0&&!player.dead){const P=playerPos();WS.mode='chase';WS.lkp.x=P.x;WS.lkp.z=P.z;WS.lostT=0;WS.outT=0;WS.hideT=0;
  if(b===0){WS.start=gameT;WS.posted=false;radio(rpick(CALL),true);}
  if(player.stars>=2&&!WS.posted){WS.posted=true;setTimeout(()=>{if(player.stars>0)post(rpick(['Course-poursuite de malade en plein centre !! 🚓🚓🚓','Les flics sont partout, quelqu\'un a vu ce qui s\'est passé ?? 😳','En direct de ma fenêtre : grosse intervention de police 🚨']),true,true);},7000);}}};}
{const _ai=window.aiPolice;window.aiPolice=function(c,dt){
  if(c.gpBlock){carPhysics(c,0,0,true,dt);return;}
  if(c.gpChase){const f=c.gpChase;drivePoint(c,{x:f.x+(f.vx||0)*.7,z:f.z+(f.vz||0)*.7},dt,38);return;}
  if(player.stars>0&&WS.mode==='search'&&policeETA<=0){if(!c.sp||hyp(c.sp.x-c.x,c.sp.z-c.z)<16||(c.spT=(c.spT||0)-dt)<0){c.sp=searchPoint();c.spT=rnd(14,24);}drivePoint(c,c.sp,dt,19);return;}
  _ai(c,dt);};}
{const _pf=window.policeFire;window.policeFire=function(dt,P){if(WS.mode==='search'&&policeETA<=0)return;_pf(dt,P);};}
{const _ga=window.guardAct;window.guardAct=function(p,dt,P){
  if(p.cop&&!p.off&&p.mood&&player.stars>0&&WS.mode==='search'&&policeETA<=0){if(!p.sp||hyp(p.sp.x-p.x,p.sp.z-p.z)<2){const a=Math.random()*6.283,r=Math.random()*zoneR()*.4;p.sp={x:WS.lkp.x+Math.cos(a)*r,z:WS.lkp.z+Math.sin(a)*r};}
    const dx=p.sp.x-p.x,dz=p.sp.z-p.z,d=hyp(dx,dz)||1;p.h=Math.atan2(dx,dz);p.x+=dx/d*2.4*dt;p.z+=dz/d*2.4*dt;if(resolveCircle(p,.3,false))p.sp=null;p.y=groundY(p.x,p.z);p.aiming=false;return 2.4;}
  return _ga(p,dt,P);};}

/* ================= CONDUITE v2 (voiture du joueur) ================= */
// adhérence : après un coup de frein à main la voiture reste en glisse tant que l'angle de dérive est fort (drift)
GP.grip=function(c,g,vf,vl,thr,hb){const t=c.T;if(t.moto||t.fly||t.boat||t.tank||t.custom)return g;const sp=hyp(vf,vl),slip=Math.abs(vl)/Math.max(3,Math.abs(vf));
  if(hb){if(sp>10)c.drift=1;return g;}
  if(c.drift){if(slip<.07||sp<5){c.drift=0;return g;}return Math.min(g,Math.max(1.3,2.1+3.2*clamp(1-slip*2.3,0,1)-(thr>.3?.7:0)));}
  return g;};
// direction avec inertie (poids), plus vive en glisse pour contre-braquer
GP.yaw=function(c,steer,tr,vf,dt){c.steer=lerp(c.steer,steer,1-Math.exp(-7.5*dt));const target=c.steer*tr*(vf>=0?1:-1)*(c.drift?1.22:1);
  c.yr=lerp(c.yr||0,target,1-Math.exp(-(c.drift?5.5:9)*dt));c.h+=c.yr*dt;};
GP.camYaw=function(c){const sp=hyp(c.vx,c.vz);if(sp<6||c.T.fly)return c.h;const slip=wrapA(Math.atan2(c.vx,c.vz)-c.h);return c.h+clamp(slip,-.9,.9)*.55;};
// traces de pneus : tampon circulaire de quads collés au sol
const SKID={n:700,i:0,geo:null,mesh:null,last:[null,null]};
function skidInit(){const g=new THREE.BufferGeometry(),pos=new Float32Array(SKID.n*18);g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x0a0a0a,transparent:true,opacity:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));m.frustumCulled=false;m.renderOrder=1;scene.add(m);SKID.geo=g;SKID.mesh=m;}
const _wp=new THREE.Vector3();
function skidSeg(k,x,y,z){const L=SKID.last[k];SKID.last[k]={x,y,z,t:gameT};if(!L||gameT-L.t>.12||hyp(x-L.x,z-L.z)>3)return;const dx=x-L.x,dz=z-L.z,l=hyp(dx,dz);if(l<.15){SKID.last[k]=L;return;}
  const nx=-dz/l*.13,nz=dx/l*.13,a=SKID.geo.attributes.position.array,o=(SKID.i++%SKID.n)*18,Y0=L.y+.035,Y1=y+.035;
  a.set([L.x-nx,Y0,L.z-nz,L.x+nx,Y0,L.z+nz,x+nx,Y1,z+nz,L.x-nx,Y0,L.z-nz,x+nx,Y1,z+nz,x-nx,Y1,z-nz],o);SKID.geo.attributes.position.needsUpdate=true;}
function driveFx(dt){const c=player.car;if(!c||c.T.fly||c.T.boat||c.dead||!c.wheels){SKID.last[0]=SKID.last[1]=null;return;}if(!SKID.geo)skidInit();
  const sp=hyp(c.vx,c.vz),fx=Math.sin(c.h),fz=Math.cos(c.h),vl=Math.abs(c.vx*fz-c.vz*fx),hb=keys.Space||touch.jump,thr=keys.KeyW||keys.ArrowUp;
  const burn=thr&&hb&&sp<4&&!c.T.moto,slide=(vl>3.2&&sp>6)||(hb&&sp>9)||burn;
  if(!slide){SKID.last[0]=SKID.last[1]=null;if(c.drift&&GP.driftPts>0)driftEnd();return;}
  const idx=c.T.moto?[2]:[2,3];
  idx.forEach((wi,k)=>{const w=c.wheels[wi];if(!w)return;w.getWorldPosition(_wp);const gy=groundY(_wp.x,_wp.z);skidSeg(k,_wp.x,gy,_wp.z);
    if(Math.random()<dt*(burn?28:16))emit(_wp.x,gy+.3,_wp.z,'#d9d9d9',rnd(.9,1.6),rnd(.8,1.5),-c.vx*.12+rnd(-.6,.6),rnd(.4,1.2),-c.vz*.12+rnd(-.6,.6),2.6);});
  if(c.drift&&sp>12){GP.driftPts=(GP.driftPts||0)+dt*sp*(vl/Math.max(sp,1))*12;GP.driftT=gameT;}}
function driftEnd(){const p=Math.round(GP.driftPts||0);GP.driftPts=0;if(p>=120){const cash=Math.min(400,Math.round(p/12));player.money+=cash;note('🔥',`<b>Drift ${p} pts</b> · +$${cash}`);if(p>600)post(rpick(['Un fou vient de drifter tout le carrefour 🔥🔥','Le drift de ce soir sur l\'avenue, j\'en reviens pas 😱','Tête à queue maîtrisé devant chez moi, respect 🏎️']),true,true);}}

/* ================= COMBAT v2 : couverture ================= */
const CV=GP.cover={on:false,low:false,nx:0,nz:0,qx:0,qz:0,top:1,peek:0,req:false,prevQ:false,exitT:0,ref:null,boxRef:null};
function findCover(){const p=player;let best=null,bd=1.8;
  for(const c of queryColl(p.x-2.2,p.x+2.2,p.z-2.2,p.z+2.2)){if(c.maxy<.85||c.miny>.7||(c.maxx-c.minx)*(c.maxz-c.minz)<.15)continue;
    const qx=clamp(p.x,c.minx,c.maxx),qz=clamp(p.z,c.minz,c.maxz),d=hyp(p.x-qx,p.z-qz);if(d<bd&&d>.02){bd=d;best={qx,qz,nx:(p.x-qx)/d,nz:(p.z-qz)/d,low:c.maxy<1.75,top:Math.min(c.maxy,2.2),box:c};}}
  for(const c of cars){if(!c.on||c===p.car||c.T.fly||c.T.boat||c.T.moto)continue;const d=hyp(c.x-p.x,c.z-p.z)-1.55;if(d<bd&&d>-.6){const l=hyp(p.x-c.x,p.z-c.z)||1;bd=d;best={qx:c.x+(p.x-c.x)/l*1.55,qz:c.z+(p.z-c.z)/l*1.55,nx:(p.x-c.x)/l,nz:(p.z-c.z)/l,low:true,top:1.4,car:c};}}
  return best;}
function coverEnter(b){Object.assign(CV,{on:true,low:b.low,nx:b.nx,nz:b.nz,qx:b.qx,qz:b.qz,top:b.top,boxRef:b.box||null,ref:b.car||null,peek:0,exitT:0});sfx.swish&&sfx.swish();}
function coverExit(){CV.on=false;CV.peek=0;CV.ref=null;CV.boxRef=null;}
GP.inCover=()=>CV.on;
function coverUpdate(dt,P){const p=player,w=W(),gun=isGun(w)&&!w.throw;
  const q=!!keys.KeyQ,press=(q&&!CV.prevQ)||CV.req;CV.prevQ=q;CV.req=false;
  const can=!p.car&&!p.dead&&!p.swim&&p.knock<=0&&!phone.open&&p.ground!==false;
  if(H.cov){const show=can&&(gun||CV.on);if(H.cov.hidden===show)H.cov.hidden=!show;H.cov.classList.toggle('on',CV.on);}
  if(!can){if(CV.on)coverExit();return;}
  if(press){if(CV.on){coverExit();}else{const b=findCover();if(b)coverEnter(b);else toast('Aucun abri à proximité');}}
  if(!CV.on){if(gun&&(p.stars>0||p.aimT>0||nearHostile(P))&&!nearestCar(3.4)&&!promptOverride){const b=findCover();if(b)promptOverride=`<kbd>${IS_TOUCH?'COUV.':KCOV}</kbd>Se mettre à couvert`;}return;}
  // recalcul du point d'appui (on peut glisser le long du mur / de la voiture)
  let b=null;if(CV.ref){const c=CV.ref;if(c.on&&!c.dead){const l=hyp(p.x-c.x,p.z-c.z)||1;b={qx:c.x+(p.x-c.x)/l*1.55,qz:c.z+(p.z-c.z)/l*1.55,nx:(p.x-c.x)/l,nz:(p.z-c.z)/l};}}
  else if(CV.boxRef){const c=CV.boxRef,qx=clamp(p.x,c.minx,c.maxx),qz=clamp(p.z,c.minz,c.maxz),d=hyp(p.x-qx,p.z-qz);if(d<1.3&&d>.01)b={qx,qz,nx:(p.x-qx)/d,nz:(p.z-qz)/d};}
  if(!b){coverExit();return;}
  CV.qx=b.qx;CV.qz=b.qz;CV.nx=b.nx;CV.nz=b.nz;p.x=b.qx+b.nx*.5;p.z=b.qz+b.nz*.5;
  const v=hyp(p.vx,p.vz);if(v>1&&(p.vx*b.nx+p.vz*b.nz)/v>.75)CV.exitT+=dt;else CV.exitT=0;
  if(CV.exitT>.3||keys.ShiftLeft||keys.ShiftRight||pressed.jump){coverExit();return;}
  const firing=keys.KeyF||(locked&&mouseAtk)||touch.attack;if(firing)CV.peek=.55;else CV.peek=Math.max(0,CV.peek-dt);
  if(CV.peek<=0&&!p.aim)p.h=Math.atan2(-b.nx,-b.nz);
  objective('À COUVERT',`${IS_TOUCH?'COUV.':KCOV} : quitter · tirer = sortir la tête${CV.low?'':' (mur haut : tir de côté)'}`);}
function nearHostile(P){for(const p of peds){if(p.off||p.gdead||p.state==='down')continue;if((p.aiming||p.mood&&p.mood.k==='shoot')&&hyp(p.x-P.x,p.z-P.z)<45)return true;}return false;}
// derrière un abri, la plupart des balles s'écrasent dessus (étincelles) ; celles qui passent font moins mal
function coverSpark(){for(let i=0;i<5;i++)emit(CV.qx+rnd(-.3,.3),Math.max(.6,CV.top-.1),CV.qz+rnd(-.3,.3),'#ffd27f',rnd(.04,.08),rnd(.12,.25),CV.nx*rnd(-2,1)+rnd(-1.5,1.5),rnd(1,3),CV.nz*rnd(-2,1)+rnd(-1.5,1.5),.2,true,6);}
function coverBlock(){if(!CV.on||player.car)return false;if(Math.random()<(CV.peek>0?.45:.88)){coverSpark();return true;}return false;}
const coverK=()=>CV.on&&!player.car?(CV.peek>0?.8:.6):1;
{const _hp=window.hurtPlayer;window.hurtPlayer=function(d,k){if(GP._bullet&&d<900){if(coverBlock())return;d*=coverK();}return _hp(d,CV.on?false:k);};}
{const _ps=window.playerShot;window.playerShot=function(d){if(coverBlock())return;return _ps(d*coverK());};}
{const _pf2=window.policeFire;window.policeFire=function(dt,P){GP._bullet=true;try{_pf2(dt,P);}finally{GP._bullet=false;}};}
// recul de l'arme et marqueurs d'impact
const REC={v:0};
{const _sh=window.shoot;window.shoot=function(){const r=_sh.apply(this,arguments);try{const w=W();if(!w.melee&&!w.throw){const k=.004+Math.min(.018,(w.dmg||20)/2600);cam.pitch-=k;cam.yaw+=rnd(-k,k)*.6;REC.v+=k*.75;if(CV.on)CV.peek=.55;}}catch(e){}return r;};}
{const _ah=window.applyHit;window.applyHit=function(r,w){const res=_ah(r,w);try{if(r&&r.hit){const ref=r.hit.ref;hitMark(r.hit.kind==='ped'&&ref&&(ref.gdead||ref.state==='down'));}}catch(e){}return res;};}
// gangsters : ils se déplacent latéralement en tirant (plus durs à toucher)
{const _gp=window.gangPed;window.gangPed=function(p,dt,P){const s=_gp(p,dt,P);if(p.aiming&&!p.gdead&&p.state!=='down'){const dx=P.x-p.x,dz=P.z-p.z,d=hyp(dx,dz)||1,k=Math.sin(gameT*1.25+(p.x+p.z)*.37)*1.8;
  p.x+=-dz/d*k*dt;p.z+=dx/d*k*dt;resolveCircle(p,.3,false);p.y=groundY(p.x,p.z);return Math.max(s,Math.abs(k));}return s;};}
// pose accroupie derrière un abri bas (posée sur l'animation, comme la pose assise à moto)
const CROUCH={UpLeg:1.3,Leg:-1.9,Spine:.3};
function crouchPose(h,on){if(!h.crB){h.crB=[];const add=(n,a)=>{const b=h.root.getObjectByName('mixamorig'+n);if(b)h.crB.push({b,a,base:new THREE.Quaternion(),last:new THREE.Quaternion(),done:false});};
    for(const sd of['Left','Right']){add(sd+'UpLeg',CROUCH.UpLeg);add(sd+'Leg',CROUCH.Leg);}add('Spine',CROUCH.Spine);h.crH=h.root.getObjectByName('mixamorigHips');h.crK=0;h.crLast=null;}
  // si l'animation n'a pas réécrit l'os depuis notre dernière retouche, on repart de sa valeur d'origine (pas d'accumulation)
  for(const e of h.crB){if(e.done&&e.b.quaternion.equals(e.last))e.b.quaternion.copy(e.base);else e.base.copy(e.b.quaternion);e.done=false;}
  if(h.crH){if(h.crLast!==null&&h.crH.position.y===h.crLast)h.crH.position.y=h.crBase;else h.crBase=h.crH.position.y;h.crLast=null;}
  h.crK=lerp(h.crK,on?1:0,.25);if(h.crK<.01)return;
  for(const e of h.crB){e.b.rotateX(e.a*h.crK);e.last.copy(e.b.quaternion);e.done=true;}
  if(h.crH){h.crH.position.y=h.crBase*(1-.42*h.crK);h.crLast=h.crH.position.y;}}

/* ================= passants qui filment ================= */
const PH={pool:[],film:new Set(),t:0,postT:-99};
function phoneMesh(){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(.075,.15,.012),new THREE.MeshStandardMaterial({color:0x111318,metalness:.6,roughness:.3}));g.add(b);
  const s=new THREE.Mesh(new THREE.PlaneGeometry(.065,.135),new THREE.MeshBasicMaterial({color:0x9fd8ff}));s.position.z=-.007;s.rotation.y=Math.PI;g.add(s);
  const l=new THREE.Mesh(new THREE.SphereGeometry(.008,6,4),new THREE.MeshBasicMaterial({color:0xff2a2a}));l.position.set(.022,.06,.008);g.add(l);g.visible=false;scene.add(g);return g;}
function filmUpdate(dt,P){PH.t-=dt;if(PH.t>0)return;PH.t=.6;
  const c=player.car,spec=(player.stars>0&&WS.mode==='chase')||(c&&c.drift&&c.speed>12)||(c&&c.speed>32)||gameT-(GP.boomT||-99)<4;
  if(!spec||PH.film.size>=3)return;
  for(const p of peds){if(PH.film.size>=3)break;if(p.film>0||p.off||p.cop||p.gang||p.thief||p.gdead||!p.hum||(p.state!=='walk'&&p.state!=='idle'))continue;const d=hyp(p.x-P.x,p.z-P.z);if(d<9||d>30||Math.random()<.5)continue;
    p.film=rnd(4,7);PH.film.add(p);if(Math.random()<.5)npcSay(p,rpick(['Oh la vache, je filme !','Ça va partir sur NéoGram ça !','Regardez-moi ce fou !','C\'est pas possible…']));}
  if(PH.film.size&&gameT-PH.postT>45&&Math.random()<.5){PH.postT=gameT;setTimeout(()=>post(rpick(c?['Un taré en '+c.T.name+' vient de traverser la rue à fond 😳 #NéoCité','J\'ai filmé la scène depuis le trottoir, regardez ça 🎥','Encore un chauffard dans le quartier… 🙄']:['Il se passe un truc de fou dans ma rue 🎥','Fusillade ?! Restez chez vous 😰','J\'ai tout filmé, la police arrive 🚨']),true,true),2500);}}
{const _up=window.updatePed;window.updatePed=function(p,dt,P){if(p.film>0){if(p.state==='down'||p.gdead||p.off||p.state==='flee'){p.film=0;}else{p.film-=dt;p.h=Math.atan2(P.x-p.x,P.z-p.z);const m=p.m;m.group.position.set(p.x,p.y,p.z);m.group.rotation.y=p.h;animPerson(m,0,dt,false);p.curSpeed=0;return;}}
  if(p.film<=0&&PH.film.has(p))PH.film.delete(p);_up(p,dt,P);};}
const _hd=new THREE.Vector3(),_hp2=new THREE.Vector3();
function postHumans(){let k=0;const P=playerPos();
  for(const p of PH.film){if(!(p.film>0)||!p.hum){PH.film.delete(p);continue;}const h=p.hum;_hd.set(P.x-p.x,1.1,P.z-p.z).normalize();try{aimArm(h,_hd);}catch(e){}
    if(!PH.pool[k])PH.pool[k]=phoneMesh();const g=PH.pool[k++];if(!h.bones)initBones(h);if(h.bones&&h.bones.hand){h.bones.hand.getWorldPosition(_hp2);g.position.copy(_hp2);g.lookAt(P.x,(P.y||0)+1.2,P.z);g.visible=true;}}
  for(;k<PH.pool.length;k++)PH.pool[k].visible=false;
  const h=HUM.playerH;if(h&&!player.car)crouchPose(h,CV.on&&CV.low&&CV.peek<=0);}
{const _uh=window.updateHumans;window.updateHumans=function(dt,P){_uh(dt,P);try{if(HUM.ready)postHumans();}catch(e){}};}
{const _ex=window.explode;window.explode=function(c){const r=_ex(c);GP.boomT=gameT;try{const P=playerPos();if(hyp(c.x-P.x,c.z-P.z)<70&&gameT-(GP.boomPost||-99)>60){GP.boomPost=gameT;setTimeout(()=>post(rpick(['BOUM 💥 une voiture vient d\'exploser en bas de chez moi','Explosion en pleine rue, j\'ai les mains qui tremblent 😰','Quelqu\'un a vu cette explosion ?? 🔥']),true,true),3000);}}catch(e){}return r;};}

/* ================= ÉVÉNEMENTS ALÉATOIRES ================= */
const EV=GP.ev={cur:null,cd:70,cars:{}};
let evBeam=null;
function evCar(key,type,color){let c=EV.cars[key];if(!c){c=new Car(type,color);EV.cars[key]=c;}c.dead=false;c.burn=0;c.health=100;c.flat=null;c.drift=0;if(typeof carRepairFx==='function')try{carRepairFx(c);}catch(e){}
  c.paintMesh.material=paint(c.color);c.headM.material=CARM.head;c.tailM.material=CARM.tail;c.on=true;c.group.visible=true;return c;}
function evCarOff(c){if(!c||c===player.car)return;c.ai='off';c.on=false;c.group.visible=false;c.x=c.z=9999;c.setDriver(false);}
function canEvent(){return !EV.cur&&!mission&&!story&&player.stars===0&&!player.dead&&!prison.on&&!INT.on&&!GAV.on&&state==='play'&&!(typeof CINE!=='undefined'&&CINE.on);}
function evEnd(msg,ok,reward){const e=EV.cur;if(!e)return;EV.cur=null;EV.cd=rnd(110,190);objective(null);if(evBeam)evBeam.visible=false;try{e.cleanup&&e.cleanup();}catch(er){}
  if(reward){player.money+=reward;sfx.win();}else if(ok===false)sfx.fail();if(msg)toast(msg+(reward?`\n+$${reward.toLocaleString('fr-FR')}`:''));if(reward)try{save();}catch(er){}}
GP.startEvent=function(k){if(EV.cur)evEnd(null);const P=playerPos();const f={van:evVan,race:evRace,thief:evThief,chase:evChase}[k];if(f)EV.cur=f(P);return !!EV.cur;};
function evUpdate(dt,P){if(EV.cur){EV.cur.update(dt,P);return;}EV.cd-=dt;if(EV.cd>0||!canEvent())return;
  const opts=['thief','van','chase'];if(player.car&&!player.car.T.moto&&!player.car.T.fly)opts.push('race','race');
  EV.cd=rnd(110,190);GP.startEvent(rpick(opts));}
// --- fourgon blindé ---
function evVan(P){const c=evCar('van','van','#2e3d33');if(!spawnTraffic(c,P,110,210)){evCarOff(c);return null;}c.health=320;c.cruise=12;
  note('💰','<b>Fourgon blindé</b> repéré dans le quartier. Immobilise-le !');radio('Transport de fonds en cours dans le secteur.',true);
  const e={c,stage:0,t:150,plant:0,boom:0,
    dest:()=>({x:c.x,z:c.z}),blip:()=>({x:c.x,z:c.z,c:'#3fbf6f',l:'$',edge:true}),
    update(dt,P){const c=this.c;this.t-=dt;const d=hyp(c.x-P.x,c.z-P.z);
      if(this.stage===0){if(c.dead){evEnd('Le fourgon a brûlé avec l\'argent',false);return;}
        if(c.health<300&&c.ai==='traffic')c.cruise=19;
        if(c.ai==='traffic'&&(flatCount(c)>=2||c.health<170)){c.ai='parked';c.setDriver(false);this.stage=1;toast('FOURGON IMMOBILISÉ !\nVa à l\'arrière pour poser la charge');sfx.ding();}
        if(d>420||this.t<0){evEnd('Le fourgon blindé s\'est échappé',false);return;}
        objective('FOURGON BLINDÉ','Crève ses pneus ou percute-le jusqu\'à l\'immobiliser · '+Math.round(d)+' m');return;}
      if(this.stage===1){const rx=c.x-Math.sin(c.h)*3.4,rz=c.z-Math.cos(c.h)*3.4,dr=hyp(player.x-rx,player.z-rz);
        if(!player.car&&dr<2.4){this.plant+=dt;objective('POSE DE LA CHARGE',Math.min(100,Math.round(this.plant/2*100))+' %');if(this.plant>=2){this.stage=2;this.boom=3;toast('Charge posée ! Éloigne-toi !');sfx.click();}}
        else{this.plant=Math.max(0,this.plant-dt);objective('FOURGON IMMOBILISÉ','Approche-toi des portes arrière, à pied');}
        if(d>300){evEnd('Tu as laissé filer le fourgon',false);}return;}
      if(this.stage===2){this.boom-=dt;objective('ÉLOIGNE-TOI !',Math.ceil(this.boom)+'…');if(this.boom<=0){const rx=c.x-Math.sin(c.h)*3,rz=c.z-Math.cos(c.h)*3;
          for(let i=0;i<22;i++)emit(rx+rnd(-.8,.8),c.y+1.2,rz+rnd(-.8,.8),rpick(['#ffb347','#ff6a00','#ffd27f']),rnd(1.5,3),rnd(.4,.8),rnd(-5,5),rnd(2,7),rnd(-5,5),2,true);
          sfx.boom();flash=.8;shake=.6;if(hyp(player.x-rx,player.z-rz)<4)hurtPlayer(25,true);
          for(let i=0;i<5;i++)dropPickup(rx+rnd(-2.5,2.5),groundY(rx,rz),rz+rnd(-2.5,2.5),{cash:Math.round(rnd(700,1400))});
          addWanted(3);this.stage=3;this.t=40;post('Braquage de fourgon blindé en pleine rue 💰💰 la police est déjà là',true,true);}return;}
      if(this.stage===3){this.t-=0;objective('RAMASSE LE BUTIN','Les sacs de billets sont au sol · puis sème la police');if(this.t<0||player.stars===0||hyp(c.x-P.x,c.z-P.z)>120)evEnd('Braquage terminé',true);}},
    cleanup(){const c=this.c;setTimeout(()=>{if(c!==player.car&&hyp(c.x-player.x,c.z-player.z)>80)evCarOff(c);},20000);}};
  return e;}
// --- course de rue ---
function gridNode(P,minD,maxD){for(let k=0;k<40;k++){const i=ri(1,N-1),j=ri(1,N-1),x=nodePos(i),z=nodePos(j),d=hyp(x-P.x,z-P.z);if(d>minD&&d<maxD)return {i,j,x,z};}return null;}
function evRace(P){const s=gridNode(P,70,240);if(!s)return null;
  const opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(d=>s.i+d[0]*2>=0&&s.i+d[0]*2<=N&&s.j+d[1]*2>=0&&s.j+d[1]*2<=N);const d0=rpick(opts);
  // parcours sur la grille
  const cps=[];let i=s.i,j=s.j,pd=d0;for(let s2=0;s2<2;s2++){i+=d0[0];j+=d0[1];}cps.push({x:nodePos(i),z:nodePos(j)});
  for(let k=0;k<7;k++){const o=DIRS.filter(d=>validNode(i+d[0],j+d[1])&&!(d[0]===-pd[0]&&d[1]===-pd[1]));const d=rpick(o);const st=Math.random()<.5?1:2;for(let q=0;q<st&&validNode(i+d[0],j+d[1]);q++){i+=d[0];j+=d[1];}pd=d;cps.push({x:nodePos(i),z:nodePos(j)});}
  const h=Math.atan2(d0[0],d0[1]),bx=-d0[0],bz=-d0[1],px=-bz,pz=bx;
  const types=[['supercar','#f2c230'],['sport','#19e6ff'],['muscle','#ff2d95']];
  const racers=types.map(([t,col],k)=>{const c=evCar('r'+k,t,col);const back=12+Math.floor(k/2)*9,side=(k%2?-1:1)*2.4;c.place(s.x+bx*back+px*side,s.z+bz*back+pz*side,h);c.ai='racer';c.setDriver(true);c.cpi=0;c.vx=c.vz=0;c.fin=0;return c;});
  if(!evBeam)evBeam=makeBeam(0xff3d9a,3.2,45);evBeam.visible=true;evBeam.position.set(s.x,groundY(s.x,s.z),s.z);
  note('🏁','<b>Course de rue</b> : des pilotes t\'attendent sur la ligne de départ');
  const e={s,cps,racers,stage:0,t:120,cd:3,pcp:0,order:[],
    dest(){return this.stage<2?{x:s.x,z:s.z}:this.cps[Math.min(this.pcp,this.cps.length-1)];},blip(){return this.stage<2?{x:s.x,z:s.z,c:'#ff3d9a',l:'🏁',edge:true}:null;},
    update(dt,P){const pc=player.car;
      if(this.stage===0){this.t-=dt;for(const c of racers){c.vx*=.9;c.vz*=.9;carPhysics(c,0,0,true,dt);}
        const d=hyp(P.x-s.x,P.z-s.z);objective('COURSE DE RUE','Rejoins la ligne de départ en voiture · '+Math.round(d)+' m');
        if(pc&&d<16&&pc.speed<4){this.stage=1;this.cd=3.2;sfx.ding();}if(this.t<0||d>500)evEnd('Les pilotes sont partis sans toi',false);return;}
      if(this.stage===1){this.cd-=dt;if(pc){pc.vx=pc.vz=0;}for(const c of racers){c.vx=c.vz=0;carPhysics(c,0,0,true,dt);}objective('COURSE DE RUE',this.cd>.4?String(Math.ceil(this.cd-.4)):'GO !');
        if(this.cd<=0){this.stage=2;sfx.ding();evBeam.position.set(cps[0].x,groundY(cps[0].x,cps[0].z),cps[0].z);}return;}
      if(this.stage===2){const n=cps.length;
        for(const c of racers){if(c.fin){c.vx*=.97;c.vz*=.97;carPhysics(c,0,0,true,dt);continue;}const T=cps[c.cpi],nx=cps[c.cpi+1];const dd=hyp(T.x-c.x,T.z-c.z);
          if(dd<11){c.cpi++;if(c.cpi>=n){c.fin=1;this.order.push(c);continue;}}
          let turn=0;if(nx){const a1=Math.atan2(T.x-c.x,T.z-c.z),a2=Math.atan2(nx.x-T.x,nx.z-T.z);turn=Math.abs(wrapA(a2-a1));}
          const lead=c.cpi-this.pcp,vmax=33+(lead<0?5:lead>1?-4:0);drivePoint(c,{x:T.x,z:T.z,slow:turn>.6?{d:30,v:15}:null},dt,vmax);}
        if(pc){const T=cps[this.pcp];if(hyp(P.x-T.x,P.z-T.z)<12){this.pcp++;sfx.ding();if(this.pcp>=n){this.order.push('me');}else evBeam.position.set(cps[this.pcp].x,groundY(cps[this.pcp].x,cps[this.pcp].z),cps[this.pcp].z);}}
        const pos=1+racers.filter(c=>c.fin||(c.cpi>this.pcp)||(c.cpi===this.pcp&&hyp(cps[c.cpi].x-c.x,cps[c.cpi].z-c.z)<hyp(cps[this.pcp].x-P.x,cps[this.pcp].z-P.z))).length;
        const rank=this.order.indexOf('me');
        if(rank>=0){const r=rank+1,rew=[2500,900,300,0][rank];evEnd(r===1?'🏆 VICTOIRE !':`Arrivé ${r}e`,r<4,rew);if(r===1)post('Course sauvage en plein centre, le gagnant a tout déchiré 🏁🔥',true,true);return;}
        objective('COURSE DE RUE',`Position ${pos}/4 · Point ${Math.min(this.pcp+1,n)}/${n}`);
        if(!pc||hyp(P.x-cps[Math.min(this.pcp,n-1)].x,P.z-cps[Math.min(this.pcp,n-1)].z)>600)evEnd('Course abandonnée',false);}},
    cleanup(){for(const c of racers){c.ai='parked';c.setDriver(false);}setTimeout(()=>{for(const c of racers)if(c!==player.car&&hyp(c.x-player.x,c.z-player.z)>60)evCarOff(c);},25000);}};
  return e;}
// --- vol à l'arraché ---
function evThief(P){const cand=peds.filter(p=>!p.off&&!p.cop&&!p.gang&&!p.gdead&&!p.soldier&&!p.inmate&&p.state==='walk'&&hyp(p.x-P.x,p.z-P.z)>14&&hyp(p.x-P.x,p.z-P.z)<40);if(cand.length<2)return null;
  const th=rpick(cand),vic=cand.find(p=>p!==th);th.thief=true;th.state='flee';th.t=0;th.fx=th.x-P.x;th.fz=th.z-P.z;npcSay(vic,rpick(['Au voleur !! Mon sac !','À l\'aide ! Il m\'a volé mon sac !','Arrêtez-le, il a mon portefeuille !']));
  const e={th,vic,t:60,
    dest:()=>({x:th.x,z:th.z}),blip:()=>({x:th.x,z:th.z,c:'#e5484d',l:'!',edge:true}),
    update(dt,P){const th=this.th;this.t-=dt;const d=hyp(th.x-P.x,th.z-P.z);
      if(th.state==='down'||th.gdead){dropPickup(th.x,th.y||groundY(th.x,th.z),th.z,{cash:Math.round(rnd(180,420))});evEnd('Voleur neutralisé !\nRécupère le sac',true,100);post('Un passant a stoppé un voleur à l\'arraché 👏 respect',true,true);return;}
      if(th.state!=='flee'){th.state='flee';th.t=0;}th.t=Math.min(th.t,1);th.fx=th.fx*.9+(th.x-P.x)*.1;th.fz=th.fz*.9+(th.z-P.z)*.1;
      const l=hyp(th.fx,th.fz)||1;th.x+=th.fx/l*1.1*dt;th.z+=th.fz/l*1.1*dt;
      objective('VOL À L\'ARRACHÉ','Rattrape le voleur (coup, plaquage, voiture…) · '+Math.round(d)+' m');
      if(d>150||this.t<0)evEnd('Le voleur s\'est enfui',false);},
    cleanup(){this.th.thief=false;}};
  return e;}
// --- course-poursuite policière (PNJ) ---
function evChase(P){const f=evCar('fug','sport','#c0392b');if(!spawnTraffic(f,P,100,170)){evCarOff(f);return null;}f.ai='fugitive';f.setDriver(true);f.health=110;
  const cops=police.filter(c=>c.ai==='off'&&c.type!=='jeep').slice(0,2);if(!cops.length){evCarOff(f);return null;}
  for(const c of cops){const s=randomRoadSpot(f,20,55)||{x:f.x-Math.sin(f.h)*25,z:f.z-Math.cos(f.h)*25,h:f.h};spawnCop(c,s);c.gpChase=f;c.copsOut=true;}
  const tgt=()=>{const q=roadAt(P.x+(P.x-f.x)*1.3+rnd(-80,80),P.z+(P.z-f.z)*1.3+rnd(-80,80));return q?{x:q.x,z:q.z}:{x:-f.x*.5,z:-f.z*.5};};
  f.tg=tgt();radio('Poursuite en cours, véhicule rouge en fuite !',true);note('🚨','Une <b>course-poursuite</b> passe près de toi. Aide la police ?');
  const e={f,cops,t:100,slowT:0,
    dest:()=>({x:f.x,z:f.z}),blip:()=>({x:f.x,z:f.z,c:'#ff3b3b',l:'⚠',edge:true}),
    update(dt,P){const f=this.f;this.t-=dt;const d=hyp(f.x-P.x,f.z-P.z);
      if(!f.dead&&f.ai==='fugitive'){if(hyp(f.tg.x-f.x,f.tg.z-f.z)<20){const a=Math.random()*6.283,q=roadAt(f.x+Math.cos(a)*300,f.z+Math.sin(a)*300);f.tg=q?{x:q.x,z:q.z}:{x:rnd(-HALF,HALF),z:rnd(-HALF,HALF)};}
        drivePoint(f,f.tg,dt,31);if(f.speed<1.5)this.slowT+=dt;else this.slowT=0;}
      const stopped=f.dead||f.health<30||flatCount(f)>=2||this.slowT>5;
      if(stopped){if(f.ai==='fugitive'){f.ai='parked';f.setDriver(false);}evEnd(d<80?'Le fuyard est arrêté, la police te remercie':'La police a eu le fuyard',true,d<80?750:0);if(d<80)post('Un citoyen a aidé la police à stopper un chauffard 👮',true);return;}
      objective('COURSE-POURSUITE','Arrête la voiture rouge (pneus, chocs) · '+Math.round(d)+' m');
      if(d>450||this.t<0)evEnd('La poursuite s\'éloigne…',null);},
    cleanup(){for(const c of this.cops){c.gpChase=null;c.copsOut=false;if(hyp(c.x-player.x,c.z-player.z)>90){c.ai='off';c.on=false;c.group.visible=false;}else{c.ai='traffic';c.cruise=11;snapToGraph(c);}}
      const f=this.f;if(f.ai==='fugitive'){f.ai='parked';f.setDriver(false);}setTimeout(()=>{if(f!==player.car&&hyp(f.x-player.x,f.z-player.z)>70)evCarOff(f);},25000);}};
  return e;}
// les voitures d'événement sont pilotées ici (le jeu ne connaît pas ces modes d'IA)
function evCars(dt){for(const k in EV.cars){const c=EV.cars[k];if(!c.on)continue;if(c.ai==='fugitive'&&!(EV.cur&&EV.cur.f===c)){c.ai='parked';c.setDriver(false);}
  if(c.ai==='racer'&&!(EV.cur&&EV.cur.racers&&EV.cur.racers.includes(c))){c.ai='parked';c.setDriver(false);}
  if(c.ai==='parked'&&c.speed>.05)carPhysics(c,0,0,true,dt);}}

/* ================= GPS ================= */
const GPS=GP.gps={nodes:null,adj:null,path:null,t:0,col:'#b06cff',key:''};
function gpsBuild(){const nodes=[],adj=[];const add=(x,z)=>{for(let i=0;i<nodes.length;i++)if(hyp(nodes[i].x-x,nodes[i].z-z)<14)return i;nodes.push({x,z});adj.push([]);return nodes.length-1;};
  const link=(a,b)=>{if(a===b||adj[a].some(e=>e[0]===b))return;const d=hyp(nodes[a].x-nodes[b].x,nodes[a].z-nodes[b].z);adj[a].push([b,d]);adj[b].push([a,d]);};
  const g=[];for(let i=0;i<=N;i++){g[i]=[];for(let j=0;j<=N;j++)g[i][j]=add(nodePos(i),nodePos(j));}
  for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){if(i<N)link(g[i][j],g[i+1][j]);if(j<N)link(g[i][j],g[i][j+1]);}
  for(const r of ROADS){const x0=r[0],z0=r[1],vx=r[2]-x0,vz=r[3]-z0,L2=vx*vx+vz*vz,pts=[[0,x0,z0],[1,r[2],r[3]]];
    const on=(ex,ez)=>{const t=((ex-x0)*vx+(ez-z0)*vz)/L2;if(t<=.005||t>=.995)return;const qx=x0+vx*t,qz=z0+vz*t;if(hyp(ex-qx,ez-qz)<14)pts.push([t,qx,qz]);};
    for(const o of ROADS){on(o[0],o[1]);on(o[2],o[3]);}for(let i=0;i<=N;i++)for(let j=0;j<=N;j++)on(nodePos(i),nodePos(j));
    pts.sort((a,b)=>a[0]-b[0]);let prev=-1;for(const p of pts){const k=add(p[1],p[2]);if(prev>=0)link(prev,k);prev=k;}}
  GPS.nodes=nodes;GPS.adj=adj;}
function gpsRoute(P,D){if(!GPS.nodes)gpsBuild();const nodes=GPS.nodes,adj=GPS.adj,n=nodes.length;
  let t=-1,td=1e9;for(let i=0;i<n;i++){const d=hyp(nodes[i].x-D.x,nodes[i].z-D.z);if(d<td){td=d;t=i;}}
  if(t<0||hyp(P.x-D.x,P.z-D.z)<td+40)return [P,D];
  const dist=new Float64Array(n).fill(1e18),prev=new Int32Array(n).fill(-1),done=new Uint8Array(n);dist[t]=0;
  for(;;){let u=-1,bd=1e18;for(let i=0;i<n;i++)if(!done[i]&&dist[i]<bd){bd=dist[i];u=i;}if(u<0)break;done[u]=1;for(const [v,w] of adj[u])if(dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u;}}
  let s=-1,sd=1e18;for(let i=0;i<n;i++){const d=hyp(nodes[i].x-P.x,nodes[i].z-P.z);if(d<300&&d*1.3+dist[i]<sd){sd=d*1.3+dist[i];s=i;}}
  if(s<0)return [P,D];const out=[{x:P.x,z:P.z}];for(let u=s;u>=0;u=prev[u])out.push(nodes[u]);out.push(D);return out;}
function gpsDest(){if(WP)return {x:WP.x,z:WP.z,c:'#b06cff'};
  if(mission){const t=mission.type==='livraison'?mission.target:mission.cps&&mission.cps[mission.idx];if(t)return {x:t.x,z:t.z,c:'#f2c230'};}
  if(story&&story.step&&typeof stepPos==='function'){try{const t=stepPos(story.step);if(t)return {x:t.x,z:t.z,c:'#ff9f1a'};}catch(e){}}
  if(EV.cur&&EV.cur.dest){const t=EV.cur.dest();if(t)return {x:t.x,z:t.z,c:'#ff3d9a'};}return null;}
function gpsUpdate(dt,P){GPS.t-=dt;if(GPS.t>0)return;GPS.t=.8;const D=gpsDest();if(!D||hyp(D.x-P.x,D.z-P.z)<45){GPS.path=null;return;}GPS.col=D.c;GPS.path=gpsRoute({x:P.x,z:P.z},D);}
function strokePath(g,ox,oz,f){const p=GPS.path;g.beginPath();g.moveTo((p[0].x-ox)*f,(p[0].z-oz)*f);for(let i=1;i<p.length;i++)g.lineTo((p[i].x-ox)*f,(p[i].z-oz)*f);}
// dessiné dans le repère de la mini-carte (appelé au milieu de drawMini, sous les marqueurs)
function miniLayer(P){const g=mctx,sc=player.car?1.1:1.8;
  if(GPS.path&&GPS.path.length>1){g.lineJoin='round';g.lineCap='round';g.strokeStyle='rgba(0,0,0,.55)';g.lineWidth=10/sc;strokePath(g,P.x,P.z,1);g.stroke();g.strokeStyle=GPS.col;g.lineWidth=6/sc;strokePath(g,P.x,P.z,1);g.stroke();}
  if(player.stars>0&&WS.mode==='search'){const f=(gameT*2|0)%2;g.fillStyle=f?'rgba(229,72,77,.24)':'rgba(59,130,246,.24)';g.strokeStyle=f?'rgba(255,90,90,.95)':'rgba(90,150,255,.95)';g.lineWidth=3/sc;
    g.beginPath();g.arc(WS.lkp.x-P.x,WS.lkp.z-P.z,zoneR(),0,7);g.fill();g.stroke();}
  if(player.stars>0){const R=60+player.stars*12;for(const c of cars){if(c.ai!=='police'||!c.on||c.dead||c.gpChase)continue;const dx=c.x-P.x,dz=c.z-P.z;if(hyp(dx,dz)>320)continue;
    const th=Math.atan2(Math.cos(c.h),Math.sin(c.h)),hot=gameT-(c.gpSeen||-9)<.6;g.fillStyle=hot?'rgba(255,60,60,.32)':'rgba(120,170,255,.2)';g.beginPath();g.moveTo(dx,dz);
    if(c.gpBlock)g.arc(dx,dz,R*.5,0,7);else{g.arc(dx,dz,R,th-1.32,th+1.32);g.lineTo(dx,dz);}g.fill();
    g.fillStyle=(gameT*6|0)%2?'#ff3b3b':'#3b82f6';g.beginPath();g.arc(dx,dz,5/sc,0,7);g.fill();}}}
{const _dc=window.drawCountryMinis;window.drawCountryMinis=function(P){_dc(P);try{miniLayer(P);}catch(e){}};}
{const _db=window.drawBig;window.drawBig=function(){_db();try{if(!GPS.path||GPS.path.length<2)return;const cv=$('big'),g=cv.getContext('2d'),V=bigView(),s=cv.width/V.span;
  g.save();g.translate(-V.lx*s,-V.lz*s);g.lineJoin='round';g.lineCap='round';g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=9;strokePath(g,0,0,s);g.stroke();g.strokeStyle=GPS.col;g.lineWidth=5;strokePath(g,0,0,s);g.stroke();g.restore();}catch(e){}};}
{const _mm=window.mapMarkers;window.mapMarkers=function(){const a=_mm();try{if(EV.cur&&EV.cur.blip){const b=EV.cur.blip();if(b)a.push(b);}}catch(e){}return a;};}

/* ================= caméra cinématique en voiture (touche K) ================= */
const CIN=GP.cin={on:false,shot:null,t:0};
addEventListener('keydown',e=>{if(e.repeat||state!=='play'||(e.key||'').toLowerCase()!=='k'||document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName))return;
  if(!player.car){toast('Caméra cinématique : en véhicule seulement');return;}CIN.on=!CIN.on;CIN.shot=null;toast(CIN.on?'🎬 Caméra cinématique':'Caméra normale');});
const _cp=new THREE.Vector3();
function cinShot(c){const sp=hyp(c.vx,c.vz),fx=sp>2?c.vx/sp:Math.sin(c.h),fz=sp>2?c.vz/sp:Math.cos(c.h),sx=-fz,sz=fx,side=Math.random()<.5?1:-1;
  const kinds=sp>8?['road','road','side','low','air']:['side','low','air'];
  for(let k=0;k<6;k++){const kind=rpick(kinds);let s;
    if(kind==='road'){const a=rnd(28,42),o=rnd(5,8)*side;s={kind,x:c.x+fx*a+sx*o,z:c.z+fz*a+sz*o,y:rnd(.9,2.6),fov:rnd(38,50)};}
    else if(kind==='side')s={kind,ox:sx*7*side,oz:sz*7*side,y:1.3,fov:48};
    else if(kind==='low')s={kind,ox:-fx*5.5+sx*1.2*side,oz:-fz*5.5+sz*1.2*side,y:.55,fov:58};
    else s={kind,ox:-fx*22+sx*8*side,oz:-fz*22+sz*8*side,y:16,fov:50};
    const px=s.x!=null?s.x:c.x+s.ox,pz=s.z!=null?s.z:c.z+s.oz;if(rayT(c.x,c.y+1.2,c.z,px,groundY(px,pz)+s.y,pz)>.98){s.t=s.kind==='road'?6:rnd(3.5,5);return s;}}
  return {kind:'low',ox:-fx*5.5,oz:-fz*5.5,y:.6,fov:58,t:3};}
{const _uc=window.updateCamera;window.updateCamera=function(dt){_uc(dt);
  if(!CIN.on)return;const c=player.car;if(!c||c.dead||(typeof CINE!=='undefined'&&CINE.on)||cam.fp){if(!c)CIN.on=false;return;}
  CIN.t-=dt;let s=CIN.shot;if(s&&s.kind==='road'&&hyp(s.x-c.x,s.z-c.z)>48&&((s.x-c.x)*c.vx+(s.z-c.z)*c.vz)<0)CIN.t=0;
  if(!s||CIN.t<=0){s=CIN.shot=cinShot(c);CIN.t=s.t;}
  const px=s.x!=null?s.x:c.x+s.ox,pz=s.z!=null?s.z:c.z+s.oz;_cp.set(px,Math.max(groundY(px,pz)+.35,(s.x!=null?groundY(px,pz):c.y)+s.y),pz);
  if(s.x==null)camera.position.lerp(_cp,1-Math.exp(-6*dt));else camera.position.copy(_cp);
  camera.lookAt(c.x,c.y+.9,c.z);if(Math.abs(camera.fov-s.fov)>.05){camera.fov=s.fov;camera.updateProjectionMatrix();}};}

/* ================= téléphone : appli NéoGram ================= */
APPS.push(['neogram','NéoGram','📸','#d6336c']);
{const _pe=window.phExtra;window.phExtra=function(v){if(v==='neogram')return GP.feedHTML();return _pe(v);};}

/* ================= boucle (appelée par la boucle principale) ================= */
let ambT=25,lastM=-1,speedPost=-99;
GP.update=function(dt,P){hud();
  try{coverUpdate(dt,P);}catch(e){console.warn(e);}
  try{driveFx(dt);}catch(e){}
  try{evCars(dt);evUpdate(dt,P);}catch(e){console.warn(e);if(EV.cur)evEnd(null);}
  try{gpsUpdate(dt,P);}catch(e){}
  try{filmUpdate(dt,P);}catch(e){}
  if(REC.v>0){const r=Math.min(REC.v,dt*.06);cam.pitch+=r;REC.v-=r;}
  if(noteT>0){noteT-=dt;if(noteT<=0)H.note.classList.remove('on');}
  if(hitT>0){hitT-=dt;if(hitT<=0)H.hit.classList.remove('on');}
  if(!EV.cur&&!CV.on&&H.obj&&!H.obj.hidden)objective(null);
  ambT-=dt;if(ambT<=0){ambT=rnd(55,110);const a=rpick(AMB);post(a[0],false,!!a[1]);}
  if(lastM>=0&&missionsDone>lastM)post(rpick(['Mission accomplie pour le mystérieux pilote de Néo Cité 😎','Encore un coup réussi en ville… qui est derrière tout ça ?']),false);lastM=missionsDone;
  const c=player.car;if(c&&c.speed>55&&!c.T.fly&&gameT-speedPost>150){speedPost=gameT;setTimeout(()=>post(`Une ${c.T.name} à plus de 200 km/h dans le centre 😱 #NéoCité`,true,true),2000);}
};
GP.ready=true;
})();
