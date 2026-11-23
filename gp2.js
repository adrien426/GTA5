/* =====================================================================================
   Néo Cité — gameplay 2 : armes portées, coffre des voitures, tenues de rechange
   - Les armes longues que tu portes (sans les avoir en main) sont visibles dans ton dos,
     l'arme de poing dans un holster à la hanche. La police les voit (signalement).
   - Coffre : derrière une voiture à l'arrêt, E ouvre le coffre. On y range armes et tenues.
     Le coffre de tes voitures personnelles est sauvegardé.
   - On ne porte sur soi que 2 armes longues et 2 armes de poing : le reste va au coffre.
   - Tenues de rechange : ranger / enfiler une tenue depuis le coffre (pas sous les yeux de la police),
     ce qui brouille ton signalement.
   Chargé après gp.js (il enveloppe GP.update et quelques fonctions du jeu).
   ===================================================================================== */
'use strict';
(function(){
if(!window.GP)return;
const GP2=window.GP2={};
const hyp=Math.hypot;
const LONG=w=>!w.melee&&!w.throw&&(w.len||0)>=.45;
const HAND=w=>!w.melee&&!w.throw&&!LONG(w);
const CARRY={long:2,hand:2};

/* ---------- armes visibles sur le personnage ---------- */
const BK={meshes:{},slots:[]};
function backMesh(id){let g=BK.meshes[id];if(!g){const w=WBY[id];const src=weaponMesh(w);g=src.clone(true);g.visible=false;g.traverse(o=>{if(o.userData&&o.userData.beam)o.visible=false;if(o.isMesh)o.castShadow=true;});
  g.userData.len=src.userData.len||w.len||.3;scene.add(g);BK.meshes[id]=g;}return g;}
// armes rangées dans le dos : les 2 plus longues portées, hors arme en main
function backList(){const cur=player.weap;return WEAPONS.filter(w=>player.owned.has(w.id)&&w.id!==cur&&LONG(w)).sort((a,b)=>(b.len||0)-(a.len||0)).slice(0,2);}
function holster(){const cur=player.weap;return WEAPONS.filter(w=>player.owned.has(w.id)&&w.id!==cur&&HAND(w)).sort((a,b)=>(b.dmg||0)-(a.dmg||0))[0]||null;}
GP.backWeapon=function(){const b=backList();return b.length?b[0].id:'';};
const _p=new THREE.Vector3(),_t=new THREE.Vector3(),_f=new THREE.Vector3(),_r=new THREE.Vector3(),_u=new THREE.Vector3(0,1,0),_d=new THREE.Vector3();
function place(g,base,dir,up,L,k){g.position.copy(base).addScaledVector(dir,-L*k);g.up.copy(up);_t.copy(g.position).add(dir);g.lookAt(_t);g.visible=true;}
function updateWorn(){for(const id in BK.meshes)BK.meshes[id].visible=false;
  const h=HUM.playerH;if(!h||!h.root.visible||player.dead||player.knock>0||cam.fp||player.swim||(player.car&&!player.car.T.moto)||(GP.rd&&GP.rd.active(player)))return;
  if(!h.wB){h.wB={sp:h.root.getObjectByName('mixamorigSpine2'),hip:h.root.getObjectByName('mixamorigHips')};}if(!h.wB.sp)return;
  const a=player.car?player.car.h:player.h;_f.set(Math.sin(a),0,Math.cos(a));_r.set(-Math.cos(a),0,Math.sin(a));
  h.wB.sp.getWorldPosition(_p);const list=backList();
  list.forEach((w,i)=>{const g=backMesh(w.id),L=g.userData.len;_d.copy(_u).multiplyScalar(.86).addScaledVector(_r,i?-.5:.5).normalize();
    const base=_t.copy(_p).addScaledVector(_f,-(.16+i*.05)).addScaledVector(_u,-.05);place(g,base.clone(),_d.clone(),_f.clone().negate(),L,.5);});
  const hw=holster();if(hw&&h.wB.hip){h.wB.hip.getWorldPosition(_p);const g=backMesh(hw.id),L=g.userData.len;_d.copy(_u).multiplyScalar(-.92).addScaledVector(_f,.3).normalize();
    place(g,_t.copy(_p).addScaledVector(_r,.19).addScaledVector(_u,-.02),_d.clone(),_r.clone(),L,.25);}}
{const _uh=window.updateHumans;window.updateHumans=function(dt,P){_uh(dt,P);try{if(HUM.ready)updateWorn();}catch(e){}};}

/* ---------- coffre ---------- */
function personal(c){return !!c&&(c===START.car||c===myCar||c===HOME.car||c.mine);}
function trunkOf(c){if(personal(c)){const t=saveData.trunk||(saveData.trunk={w:[],o:[]});t.w=t.w||[];t.o=t.o||[];return t;}return c.trunk||(c.trunk={w:[],o:[]});}
function hasTrunk(c){const t=c.T;return !(t.moto||t.fly||t.boat||t.custom||t.tank)&&c.type!=='police'&&c.type!=='bus';}
function atRear(c){const dx=player.x-c.x,dz=player.z-c.z,fx=Math.sin(c.h),fz=Math.cos(c.h);const along=dx*fx+dz*fz,lat=Math.abs(dx*fz-dz*fx),L=(c.T.len||4.4)/2;return along<-L+.9&&along>-L-1.8&&lat<1.3;}
function rearCar(){if(player.car||player.dead)return null;const c=nearestCar(3.6);return c&&hasTrunk(c)&&!c.hasDriver&&c.speed<1&&!c.dead&&atRear(c)?c:null;}
{const _ec=window.enterCar;window.enterCar=function(c){if(!player.car&&c&&hasTrunk(c)&&!c.hasDriver&&c.speed<1&&atRear(c)){openTrunk(c);return;}return _ec(c);};}
const TR={open:false,car:null,el:null};
function css(){if(document.getElementById('gp2css'))return;const st=document.createElement('style');st.id='gp2css';st.textContent=`
#gpTrunk{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;width:min(720px,94vw);max-height:86vh;overflow:auto;background:rgba(14,8,22,.94);border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.6);color:#fff;font:600 16px var(--font);padding:14px 16px}
#gpTrunk h2{margin:0 0 4px;font:italic 800 28px var(--font);background:linear-gradient(100deg,#ff3d9a,#ffc76b);-webkit-background-clip:text;background-clip:text;color:transparent}
#gpTrunk .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}#gpTrunk h3{margin:10px 0 6px;font:700 14px var(--font);letter-spacing:.08em;color:#ffc76b;text-transform:uppercase}
#gpTrunk .it{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,.06);margin-bottom:5px}
#gpTrunk .it small{display:block;color:#b9b2c4;font-weight:500;font-size:13px}#gpTrunk button{font:700 14px var(--font);border:0;border-radius:999px;padding:6px 12px;cursor:pointer;color:#fff;background:linear-gradient(100deg,#ff3d9a,#ff7a59)}
#gpTrunk button.alt{background:rgba(255,255,255,.14)}#gpTrunk .sw{display:inline-block;width:14px;height:14px;border-radius:4px;margin-right:3px;vertical-align:-2px;border:1px solid rgba(255,255,255,.4)}
#gpTrunk .top{display:flex;justify-content:space-between;align-items:center;gap:10px}#gpTrunk .note{color:#b9b2c4;font-size:13px;font-weight:500}
@media (max-width:620px){#gpTrunk .cols{grid-template-columns:1fr}}`;document.head.appendChild(st);}
function sw(lk){return `<span class="sw" style="background:${lk.shirt}"></span><span class="sw" style="background:${lk.pants}"></span>`;}
function counts(){let l=0,h=0;for(const id of player.owned){const w=WBY[id];if(!w)continue;if(LONG(w))l++;else if(HAND(w))h++;}return {l,h};}
function renderTrunk(){const c=TR.car,t=trunkOf(c),el=TR.el,n=counts();
  const mine=WEAPONS.filter(w=>player.owned.has(w.id)&&w.id!=='poings');
  el.innerHTML=`<div class="top"><div><h2>Coffre · ${c.T.name}</h2><div class="note">${personal(c)?'Ton véhicule : le coffre est sauvegardé.':'Véhicule d\'un autre : le coffre ne te suivra pas.'} Sur toi : ${n.l}/${CARRY.long} armes longues, ${n.h}/${CARRY.hand} armes de poing.</div></div><button class="alt" data-x="1">✕ Fermer</button></div>
  <div class="cols"><div><h3>Sur toi</h3>${mine.length?mine.map(w=>`<div class="it"><div>${w.name}<small>${w.melee?'Corps à corps':((player.mag[w.id]||0)+' / '+(player.ammo[w.id]||0)+' balles')}${LONG(w)?' · dans le dos':HAND(w)?' · à la ceinture':''}</small></div><button data-put="${w.id}">Ranger →</button></div>`).join(''):'<div class="note">Rien.</div>'}</div>
  <div><h3>Dans le coffre</h3>${t.w.length?t.w.map((s,i)=>{const w=WBY[s.id];return w?`<div class="it"><div>${w.name}<small>${w.melee?'Corps à corps':(s.mag+s.ammo)+' balles'}</small></div><button data-take="${i}">← Prendre</button></div>`:'';}).join(''):'<div class="note">Vide.</div>'}</div></div>
  <h3>Tenues de rechange</h3><div class="note">Changer de tenue brouille ton signalement auprès de la police (pas devant elle).</div>
  <div class="it"><div>Tenue actuelle ${sw(player.m.look)}</div><button data-store="1">Ranger une copie</button></div>
  ${t.o.map((lk,i)=>`<div class="it"><div>Tenue ${i+1} ${sw(lk)}</div><span><button data-wear="${i}">Enfiler</button> <button class="alt" data-del="${i}">Jeter</button></span></div>`).join('')}
  ${t.o.length<4?`<div class="it"><div>Acheter une tenue de rechange<small>Livrée dans ce coffre</small></div><button data-buy="1">$180</button></div>`:''}`;}
function openTrunk(c){css();TR.open=true;TR.car=c;if(!TR.el){TR.el=document.createElement('div');TR.el.id='gpTrunk';document.body.appendChild(TR.el);TR.el.addEventListener('click',trunkClick);}
  TR.el.hidden=false;renderTrunk();sfx.click&&sfx.click();if(document.pointerLockElement)document.exitPointerLock();}
function closeTrunk(){if(!TR.open)return;TR.open=false;if(TR.el)TR.el.hidden=true;save();if(state==='play')lockPtr();}
GP2.openTrunk=openTrunk;GP2.closeTrunk=closeTrunk;GP2.trunkOf=trunkOf;
function seenByPolice(){return player.stars>0&&GP.ws&&GP.ws.mode==='chase';}
function wearLook(lk){const cur=player.m.look,nl=Object.assign({},lk,{skin:cur.skin,hair:cur.hair,custom:true});setLook(player.m,nl);if(HUM.playerH)applyLook(HUM.playerH,nl);}
function trunkClick(e){const b=e.target.closest('button');if(!b)return;e.stopPropagation();const c=TR.car,t=trunkOf(c);
  if(b.dataset.x){closeTrunk();return;}
  if(b.dataset.put){const id=b.dataset.put;if(!player.owned.has(id))return;t.w.push({id,mag:player.mag[id]||0,ammo:player.ammo[id]||0});player.owned.delete(id);player.mag[id]=0;player.ammo[id]=0;if(player.weap===id)equip('poings');sfx.swish&&sfx.swish();}
  else if(b.dataset.take!=null){const i=+b.dataset.take,s=t.w[i];if(!s)return;const w=WBY[s.id],n=counts();
    if(LONG(w)&&n.l>=CARRY.long){toast(`Tu portes déjà ${CARRY.long} armes longues : range-en une`);return;}if(HAND(w)&&n.h>=CARRY.hand){toast(`Tu portes déjà ${CARRY.hand} armes de poing : range-en une`);return;}
    t.w.splice(i,1);player.owned.add(s.id);player.mag[s.id]=(player.mag[s.id]||0)+s.mag;player.ammo[s.id]=(player.ammo[s.id]||0)+s.ammo;sfx.click&&sfx.click();}
  else if(b.dataset.store){if(t.o.length>=4){toast('Coffre plein : 4 tenues maximum');return;}t.o.push(Object.assign({},player.m.look));toast('Tenue rangée dans le coffre');}
  else if(b.dataset.wear!=null){if(seenByPolice()){toast('Impossible : la police te voit !');return;}const i=+b.dataset.wear,lk=t.o[i];if(!lk)return;t.o[i]=Object.assign({},player.m.look);wearLook(lk);toast('Tu as changé de tenue');}
  else if(b.dataset.del!=null){t.o.splice(+b.dataset.del,1);}
  else if(b.dataset.buy){if(t.o.length>=4)return;if(player.money<180){toast('Pas assez d\'argent');return;}player.money-=180;const lk=randLook();t.o.push(Object.assign({},lk));sfx.coin&&sfx.coin();toast('Tenue de rechange livrée dans le coffre');}
  save();renderTrunk();}
// libérer la souris pour le coffre ne doit pas mettre le jeu en pause
{const _pz=window.pause;window.pause=function(){if(TR.open)return;return _pz.apply(this,arguments);};}
// entrée bloquée et Échap ferme le coffre
{const _ri=window.readInput;window.readInput=function(){const r=_ri();if(TR.open)return {x:0,y:0,sprint:false,hb:true};return r;};}
addEventListener('keydown',e=>{if(!TR.open)return;if(e.code==='Escape'||(e.key||'').toLowerCase()==='e'){e.stopImmediatePropagation();e.preventDefault();closeTrunk();}},true);

/* ---------- limite de port : les achats en trop vont au coffre de ta voiture ---------- */
{const _gw=window.giveWeapon;window.giveWeapon=function(id,mags){const had=player.owned.has(id);const r=_gw(id,mags);try{const w=WBY[id];if(!had&&w&&(LONG(w)||HAND(w))&&state==='play'){const n=counts(),over=LONG(w)?n.l>CARRY.long:n.h>CARRY.hand;
  if(over){const car=[myCar,START.car,HOME.car].find(c=>c&&!c.dead);const t=saveData.trunk||(saveData.trunk={w:[],o:[]});t.w=t.w||[];t.o=t.o||[];t.w.push({id,mag:player.mag[id]||0,ammo:player.ammo[id]||0});player.owned.delete(id);player.mag[id]=0;player.ammo[id]=0;
    setTimeout(()=>toast(`${w.name} : tu ne peux pas en porter plus.\nLivrée dans le coffre de ta voiture${car?'':' personnelle'}`),400);save();}}}catch(e){}return r;};}

/* ---------- boucle ---------- */
{const _u=GP.update;GP.update=function(dt,P){_u(dt,P);try{if(TR.open&&(player.car||player.dead||!TR.car||hyp(TR.car.x-player.x,TR.car.z-player.z)>5))closeTrunk();
  if(!TR.open&&!promptOverride){const c=rearCar();if(c)promptOverride=`${KEYE}Ouvrir le coffre · ${c.T.name}`;}}catch(e){console.warn(e);}};}
GP2.ready=true;
})();
