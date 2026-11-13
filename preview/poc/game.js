import {capsulesOverlap,moveWithCollisions,stepJump,inMeleeRange,findSpawnPoint} from './mechanics.mjs?v=actions-1';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clone as skeletonClone} from 'three/addons/utils/SkeletonUtils.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
const $=id=>document.getElementById(id), V=THREE.Vector3, clamp=THREE.MathUtils.clamp, mobile=matchMedia('(pointer:coarse)').matches;
let seed=426;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}const range=(a,b)=>a+rand()*(b-a);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.2,1800);
let renderer;try{renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});}catch(e){fail('WebGL est indisponible sur cet appareil. Essayez un navigateur récent.');throw e}
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.19,.65,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
const hemi=new THREE.HemisphereLight(0xa5cbeb,0x594e3a,2.0);scene.add(hemi);const sun=new THREE.DirectionalLight(0xffd3a0,3.4);sun.position.set(-100,95,-160);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-100,right:100,top:100,bottom:-100,near:1,far:500});sun.shadow.bias=-.0002;sun.shadow.normalBias=.04;scene.add(sun,sun.target);
const sky=new THREE.Mesh(new THREE.SphereGeometry(1400,32,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#335d80')},horizon:{value:new THREE.Color('#eab18b')},sunColor:{value:new THREE.Color('#fff1c5')},sunDir:{value:sun.position.clone().normalize()},night:{value:0}},vertexShader:'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vPos;uniform vec3 top,horizon,sunColor,sunDir;uniform float night;void main(){vec3 d=normalize(vPos);float t=pow(max(d.y,0.),.4);vec3 c=mix(horizon,top,t);float s=max(dot(d,sunDir),0.);c+=sunColor*(pow(s,1400.)*3.+pow(s,14.)*.22)*(1.-night);gl_FragColor=vec4(c,1.);}'}));scene.add(sky);scene.fog=new THREE.FogExp2(0xc7a18d,.0017);
const envScene=new THREE.Scene();envScene.add(sky.clone());const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(envScene,.04,.1,1600).texture;pmrem.dispose();
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);const texLoader=new THREE.TextureLoader();
async function loadGlb(path){
 const url=new URL(path,document.baseURI);
 try{
  const response=await fetch(url);
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.arrayBuffer();
  if(data.byteLength<12)throw new Error('fichier GLB incomplet');
  const header=new DataView(data);
  if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2)throw new Error('format GLB invalide');
  const expected=header.getUint32(8,true);
  if(expected!==data.byteLength)throw new Error('fichier incomplet : '+data.byteLength+' octets reçus, '+expected+' attendus');
  return await loader.parseAsync(data,new URL('.',url).href);
 }catch(error){throw new Error(path.split('?')[0]+' : '+error.message)}
}
function texture(name,repeat){const t=texLoader.load('assets/tex/'+name+'.jpg');t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=4;return t}
const mat=(c,roughness=.75,metalness=0)=>new THREE.MeshStandardMaterial({color:c,roughness,metalness});
const roadMat=new THREE.MeshStandardMaterial({color:0xa3a6a6,map:texture('asphalt',90),roughness:.74});const paveMat=new THREE.MeshStandardMaterial({color:0xb4afa4,map:texture('pave',5),roughness:.88});const concrete=new THREE.MeshStandardMaterial({map:texture('conc',4),color:0xaaa598,roughness:.85});const lineMat=mat(0xd6d2b8);const black=mat(0x1a2327,.5,.4);const foliage=mat(0x4e6952);const lampMat=new THREE.MeshStandardMaterial({color:0xffdb9a,emissive:0xffc96b,emissiveIntensity:2});
const cube=new THREE.BoxGeometry(1,1,1),colliders=[],buildings=[],lamps=[],peds=[],traffic=[],cars=[],decor=[];
function box(w,h,d,x,y,z,material,parent=scene,shadow=true){const m=new THREE.Mesh(cube,material);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m}
function plane(w,d,x,z,material,y=.015){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;scene.add(m);return m}
plane(1250,1250,0,0,roadMat,0);
// Window grids use seeded illumination, weathering and framing, shared between buildings.
function facade(style){const c=document.createElement('canvas');c.width=256;c.height=512;const g=c.getContext('2d');g.fillStyle=style===0?'#8f918c':style===1?'#687b81':'#b3a695';g.fillRect(0,0,256,512);for(let y=0;y<512;y+=32)for(let x=0;x<256;x+=32){g.fillStyle='rgba(0,0,0,.12)';g.fillRect(x,y,32,1);const lit=rand()>.77;g.fillStyle=lit?['#d8b77d','#bba57a','#e1c59a'][Math.floor(rand()*3)]:['#344a54','#4e6065','#263b46','#607079'][Math.floor(rand()*4)];g.fillRect(x+5,y+5,22,23);g.fillStyle='#192d3b60';g.fillRect(x+5,y+16,22,2);g.fillRect(x+15,y+5,1,23);g.fillStyle='#ded8c570';g.fillRect(x+4,y+28,24,2)}for(let i=0;i<2400;i++){g.fillStyle=`rgba(30,25,20,${rand()*.055})`;g.fillRect(rand()*256,rand()*512,rand()*5,rand()*20)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
const facades=[0,1,2].map(facade);const roofs=[mat(0x5c6767),mat(0x73716c)];
function sign(text,w,h,x,y,z,rot=0,color='#ece3d1',bg='#223c3e'){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,512,128);g.fillStyle=color;g.font='500 40px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.25,roughness:.7}));m.position.set(x,y,z);m.rotation.y=rot;scene.add(m)}
const grid=[-216,-144,-72,0,72,144,216],worldLimit=251;
for(let ix=0;ix<6;ix++)for(let iz=0;iz<6;iz++){
 const cx=(grid[ix]+grid[ix+1])/2,cz=(grid[iz]+grid[iz+1])/2;
 box(51,.28,51,cx,.14,cz,paveMat,scene,false);
 // Eastern blocks are planted parks beside the waterfront.
 if(ix===5&&(iz===1||iz===3)){plane(42,42,cx,cz,new THREE.MeshStandardMaterial({map:texture('grass',5),color:0x78865f}),.3);box(25,.5,3,cx,.55,cz,concrete);continue}
 for(let a=0;a<2;a++)for(let b=0;b<2;b++){
 const x=cx+(a-.5)*25,z=cz+(b-.5)*25,w=range(17,22),d=range(17,22),height=(ix>1&&ix<5&&iz>1&&iz<5)?range(29,83):range(12,34),style=Math.floor(rand()*3);
 const tx=facades[style].clone();tx.repeat.set(w/23,height/46);tx.needsUpdate=true;const bm=new THREE.MeshStandardMaterial({map:tx,color:style===1?0xb9c6cb:0xe0d4c3,roughness:style===1?.35:.78,metalness:style===1?.38:.06});
 const building=box(w,height,d,x,height/2+.3,z,bm);buildings.push({x,z,w,d,h:height});colliders.push({x,z,w:w/2+.15,d:d/2+.15});box(w+.6,.55,d+.6,x,height+.6,z,roofs[style%2]);box(w+1,.4,d+1,x,4.1,z,concrete);
 box(w-.2,3.4,d-.2,x,2,z,new THREE.MeshStandardMaterial({color:0x243a43,roughness:.28,metalness:.35}));
 for(let n=0;n<3;n++){box(2,1.3,2,x+range(-w/3,w/3),height+1.4,z+range(-d/3,d/3),roofs[0]);}
 if(height>45){box(w*.3,5,d*.6,x,height+3,z,bm);box(.15,9,.15,x,height+9,z,black)}
 if(b===0&&a===0){sign(['ATELIER 24','LUMIÈRE CAFÉ','ÉPICERIE','MAISON NORD','HÔTEL RIVAGE','STUDIO 426'][iz],w*.85,1.3,x,3,z-d/2-.025);}
 }
}
// Painted lane markings, crosswalks and generous, unobstructed intersections.
for(const x of grid){for(let z=-250;z<250;z+=9)if(grid.every(k=>Math.abs(z-k)>12)){box(.14,.018,4,x,.025,z,lineMat,scene,false);box(4,.018,.14,z,.025,x,lineMat,scene,false)}for(const z of grid){for(let n=-4;n<=4;n++){box(1.1,.018,4.6,x+n*1.7,.03,z-12,lineMat,scene,false);box(4.6,.018,1.1,x-12,.031,z+n*1.7,lineMat,scene,false)}}}
// Sidewalk furnishings and lights.
for(const x of grid)for(let z=-238;z<240;z+=36){if(grid.some(k=>Math.abs(z-k)<17))continue;for(const side of[-1,1]){
 const px=x+side*11.2;box(.13,6.7,.13,px,3.4,z,black);box(2,.12,.16,px-side*.9,6.7,z,black);box(.9,.08,.35,px-side*1.6,6.6,z,lampMat);
 const l=new THREE.PointLight(0xffd295,0,22,2);l.position.set(px-side*1.6,6.2,z);lamps.push(l);if(lamps.length%5===0)scene.add(l);
 if(side===1){box(1.6,.12,.6,px+.7,.6,z+5,mat(0x6f5140));box(.12,.6,.5,px+.1,.3,z+5,black);box(.12,.6,.5,px+1.3,.3,z+5,black);box(.6,.9,.6,px+.5,.45,z+8,black)}
 }}
// Waterfront: quays, reflective water and distant hills.
const water=new THREE.Mesh(new THREE.PlaneGeometry(900,1500,80,80),new THREE.MeshStandardMaterial({color:0x416b79,metalness:.65,roughness:.22}));water.rotation.x=-Math.PI/2;water.position.set(710,-.35,0);scene.add(water);box(5,2,600,258,0,0,concrete);for(let z=-260;z<280;z+=8){box(.08,1,.08,257,1.35,z,black)}box(.08,.08,550,257,1.85,0,black);box(.08,.08,550,257,1.25,0,black);
for(let i=0;i<35;i++){const mountain=new THREE.Mesh(new THREE.ConeGeometry(range(55,140),range(40,120),9),mat(0x6c7e79));mountain.position.set(range(-700,800),10,range(650,850));scene.add(mountain)}
const vehicleModels={},vehicleMetas={},stationaryActors=[],effects=[];let phoneOpen=false,phoneBusy=false,weaponRoot=null,weaponId='fists',lastDelivered=null;const jump={y:0,vy:0,grounded:true};let punchTimer=0,attackCooldown=0;
const keys={},touch={x:0,y:0},state={playing:false,paused:false,driving:true,speed:0,heading:0,camYaw:0,camPitch:.22,view:0,bank:0,mission:0,stage:0,time:0,quality:'auto',sound:false};let player,activeCar,animData,mixer,actions={},lastAction='',toastTimeout,loaded=false,pixelRatio=renderer.getPixelRatio();
try{const save=JSON.parse(localStorage.getItem('nocturne-poc-v1')||'null');if(save){state.bank=Number(save.bank)||0;state.mission=clamp(Number(save.mission)||0,0,2)}}catch{}
function save(){try{localStorage.setItem('nocturne-poc-v1',JSON.stringify({bank:state.bank,mission:state.mission}))}catch{}}
const missions=[{name:'La première course',pickup:[4,74],drop:[148,-140],reward:350,desc:'Récupérez le pli à la Maison Nord.'},{name:'Le dernier service',pickup:[-140,-68],drop:[220,148],reward:500,desc:'Un colis attend devant le café.'},{name:'Lumières du port',pickup:[76,220],drop:[220,-212],reward:750,desc:'Rejoignez le rendez-vous du port.'}];
const marker=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(3,.08,8,64),new THREE.MeshBasicMaterial({color:0xd3e49a}));ring.rotation.x=Math.PI/2;marker.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.4,2,12,24,1,true),new THREE.MeshBasicMaterial({color:0xd3e49a,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=6;marker.add(beam);scene.add(marker);
function target(){return missions[state.mission][state.stage?'drop':'pickup']}
function updateMission(){const m=missions[state.mission],t=target();marker.position.set(t[0],.12,t[1]);$('missionCount').textContent=String(state.mission+1).padStart(2,'0');$('missionTitle').textContent=m.name;$('missionText').textContent=state.stage?'Livrez le colis au point indiqué sur la carte.':m.desc;$('reward').textContent='+ '+m.reward+' €';$('money').textContent=state.bank.toLocaleString('fr-FR')+' €'}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),4200)}
function fail(t){$('errorText').textContent=t;$('error').hidden=false}
function shadowModel(root){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(/hair|lash/i.test(m.name)){m.alphaTest=.45;m.transparent=false;m.side=THREE.DoubleSide}}}}})}
function makeCar(proto,meta,x,z,h,type){const root=new THREE.Group(),body=proto.clone(true);const wheel=body.getObjectByName('wheel');if(wheel)wheel.removeFromParent();root.add(body);const wheels=[];for(const p of meta.wheels||[]){if(!wheel)continue;const pivot=new THREE.Group();pivot.position.fromArray(p);const mesh=wheel.clone(true);mesh.position.set(0,0,0);if(p[0]<0)mesh.rotation.y=Math.PI;pivot.add(mesh);root.add(pivot);wheels.push({pivot,mesh,front:p[2]>0})}shadowModel(root);root.position.set(x,.035,z);root.rotation.y=h;scene.add(root);const car={root,wheels,meta,type,h,speed:0};cars.push(car);return car}
function human(proto,anims){const root=skeletonClone(proto);root.traverse(o=>{if(o.isBone)o.name=o.name.replace(/^mixamorig\d*:?/,'mixamorig')});shadowModel(root);let hips=1;root.traverse(o=>{if(o.isBone&&o.name.endsWith('Hips'))hips=o.position.y});const mix=new THREE.AnimationMixer(root),acts={};for(const k of ['idle','walk','run'])if(anims[k]){const c=THREE.AnimationClip.parse(anims[k]);for(const t of c.tracks){t.name=t.name.replace(/^mixamorig\d*:?/,'mixamorig');if(/Hips\.position$/.test(t.name))for(let i=0;i<t.values.length;i+=3){t.values[i]=0;t.values[i+1]*=hips/.93;t.values[i+2]=0}}acts[k]=mix.clipAction(c);acts[k].play();acts[k].setEffectiveWeight(k==='idle'?1:0)}return {root,mix,acts}}
function animateHuman(h,speed,dt){const next=speed>4?'run':speed>.2?'walk':'idle';for(const k in h.acts)h.acts[k].setEffectiveWeight(k===next?1:0);h.mix.update(dt)}
async function init(){
 const files=['nsx','volvo','kia','james','adam','pnj_femme','n_CommonTree_1','n_PalmTree_1'];let done=0;const models={};
 await Promise.all(files.map(async f=>{models[f]=(await loadGlb('assets/models/'+f+'.glb')).scene;done++;$('progress').textContent=Math.round(done/(files.length+2)*100)+'%';$('loadStatus').textContent='Chargement : '+f.replaceAll('_',' ')+'…'}));
 animData=await fetch('assets/anims.json').then(r=>{if(!r.ok)throw Error('Animations manquantes');return r.json()});done++;
 const metas=await Promise.all(['nsx','volvo','kia'].map(f=>fetch('assets/models/'+f+'.json').then(r=>r.json())));
 Object.assign(vehicleModels,models);['nsx','volvo','kia'].forEach((key,i)=>vehicleMetas[key]=metas[i]);
 activeCar=makeCar(models.nsx,metas[0],4,45,0,'HONDA NSX');
 for(let i=0;i<18;i++){const axis=i%2,road=grid[i%grid.length],lane=i%3?4:-4,h=axis?(lane>0?Math.PI/2:-Math.PI/2):(lane>0?0:Math.PI),x=axis?range(-230,230):road+lane,z=axis?road+lane:range(-230,230);const c=makeCar(models[i%2?'volvo':'kia'],metas[i%2?1:2],x,z,h,i%2?'VOLVO V50':'KIA PICANTO');c.axis=axis;c.direction=lane>0?1:-1;c.speed=range(6,11);traffic.push(c)}
 for(const p of [[-4,78,Math.PI],[76,-8,Math.PI/2],[-68,-140,0]])makeCar(models.volvo,metas[1],...p,'VOLVO V50');
 const h=human(models.james,animData);player=h.root;mixer=h.mix;actions=h.acts;player.visible=false;scene.add(player);player.position.set(7,0,45);
 for(let i=0;i<26;i++){const hh=human(models[i%3===0?'pnj_femme':i%3===1?'james':'adam'],animData);const road=grid[i%7],side=i%2?1:-1;hh.root.position.set(road+side*11.25,.3,range(-230,230));hh.dir=i%2?1:-1;hh.speed=range(.6,1.15);hh.root.rotation.y=hh.dir>0?0:Math.PI;hh.root.scale.setScalar(range(.92,1.02));for(let retry=0;retry<30&&personBlocked(hh.root.position.x,hh.root.position.z,.4,.3);retry++)hh.root.position.z=range(-230,230);scene.add(hh.root);peds.push(hh)}
 // Additional original GLB downloaded directly from the user's Drive, displayed in the park.
 const casual=await loadGlb('assets/casual.glb?v=4cbff2a0');const parkPerson=casual.scene;const cb=new THREE.Box3().setFromObject(parkPerson),sz=cb.getSize(new V());parkPerson.scale.setScalar(1.75/sz.y);parkPerson.position.set(180,.3,40);shadowModel(parkPerson);scene.add(parkPerson);stationaryActors.push({root:parkPerson,radius:.38,height:1.8,stationary:true});if(casual.animations.length){const mm=new THREE.AnimationMixer(parkPerson);mm.clipAction(casual.animations[0]).play();decor.push(mm)}
 for(let i=0;i<115;i++){const tree=models[i%5===0?'n_PalmTree_1':'n_CommonTree_1'].clone(true);const ix=Math.floor(rand()*6),iz=Math.floor(rand()*6),x=(grid[ix]+grid[ix+1])/2+(rand()>.5?25:-25),z=(grid[iz]+grid[iz+1])/2+range(-23,23);tree.position.set(x,.3,z);const b=new THREE.Box3().setFromObject(tree),s=range(5,9)/b.getSize(new V()).y;tree.scale.setScalar(s);shadowModel(tree);scene.add(tree)}
 loaded=true;$('play').disabled=false;$('play').innerHTML='ENTRER DANS LA VILLE <span>↗</span>';$('loadStatus').textContent='Prêt. Casque conseillé · Clavier et tactile';updateMission();camera.position.set(17,5,25);camera.lookAt(4,1,45);window.__game={state,renderer,scene,camera,cars,player,get activeCar(){return activeCar},recover,interact,peds,jump,attack,spawnVehicle,equipWeapon,togglePhone};
}
function mood(value){const night=value==='night';hemi.intensity=night?.65:2;hemi.color.set(night?0x7193c2:0xa5cbeb);sun.intensity=night?.35:3.4;sun.color.set(night?0x8bb8eb:0xffd3a0);sky.material.uniforms.top.value.set(night?'#061126':'#335d80');sky.material.uniforms.horizon.value.set(night?'#394455':'#eab18b');sky.material.uniforms.night.value=night?1:0;scene.fog.color.set(night?0x26374a:0xc7a18d);scene.environmentIntensity=night?.35:1;lamps.forEach(l=>l.intensity=night?16:0);renderer.toneMappingExposure=night?1.1:1.05;bloom.strength=night?.32:.16;$('weatherLabel').textContent=night?'NUIT URBAINE · 22:18':'FIN DE JOURNÉE · 19:42'}
function quality(){const low=$('quality').value==='low';state.quality=$('quality').value;pixelRatio=Math.min(devicePixelRatio,low?1:mobile?1.25:1.7);renderer.setPixelRatio(pixelRatio);composer.setPixelRatio(pixelRatio);renderer.shadowMap.enabled=!low;bloom.enabled=!low}
$('mood').onchange=e=>mood(e.target.value);$('quality').onchange=quality;
function start(){if(!loaded)return;state.playing=true;state.paused=false;$('menu').hidden=true;$('hud').hidden=false;$('pause').hidden=true;state.camYaw=0;toast('Bienvenue à Port Lumière. Rejoignez le repère vert.');}
function pause(on){if(!state.playing)return;state.paused=on;if(on)togglePhone(false);$('pause').hidden=!on;clearInput();save()}
$('play').onclick=start;$('pauseBtn').onclick=()=>pause(!state.paused);$('resume').onclick=()=>pause(false);$('recover').onclick=()=>{recover();pause(false)};$('home').onclick=()=>{togglePhone(false);state.playing=false;state.paused=false;$('pause').hidden=true;$('menu').hidden=false;$('hud').hidden=true;save()};
function clearInput(){drag=null;for(const k in keys)keys[k]=false;touch.x=touch.y=0;$('knob').style.transform='translate(0,0)'}
function interact(){
 if(!state.playing||state.paused||phoneOpen)return;
 if(state.driving){
  if(Math.abs(state.speed)>2||activeCar.root.position.y>.5){toast('Arrêtez le véhicule et posez-le au sol pour descendre.');return}
  const p=activeCar.root.position,h=activeCar.h,offset=activeCar.kind==='heli'?4:activeCar.kind==='bike'?1.5:2.4;
  const candidates=[new V(p.x+Math.cos(h)*offset,0,p.z-Math.sin(h)*offset),new V(p.x-Math.cos(h)*offset,0,p.z+Math.sin(h)*offset)];
  const exit=candidates.find(v=>!personBlocked(v.x,v.z,.4,groundAt(v.x,v.z)));
  if(!exit){toast('La sortie est bloquée. Déplacez le véhicule.');return}
  player.position.copy(exit);player.position.y=groundAt(exit.x,exit.z);Object.assign(jump,{y:player.position.y,vy:0,grounded:true});player.visible=true;player.rotation.x=player.rotation.z=0;state.heading=h;state.driving=false;activeCar.speed=0;state.speed=0;toast('À pied · Espace : sauter · F : frapper / tirer · P : téléphone.');
 }else{
  if(!jump.grounded){toast('Attendez de retomber au sol.');return}
  const nearest=cars.filter(c=>c.root.position.y<.5&&(!traffic.includes(c)||Math.abs(c.speed)<1)).sort((a,b)=>a.root.position.distanceTo(player.position)-b.root.position.distanceTo(player.position))[0];
  if(nearest&&nearest.root.position.distanceTo(player.position)<(nearest.kind==='heli'?9:5)){
   activeCar=nearest;const ai=traffic.indexOf(nearest);if(ai!==-1)traffic.splice(ai,1);state.driving=true;state.speed=0;state.heading=nearest.h;player.visible=nearest.kind==='bike';if(weaponRoot)weaponRoot.visible=false;toast(nearest.kind==='heli'?'Hélicoptère · Espace : monter · Maj : descendre · ZQSD : piloter.':nearest.type+' · Bonne route.');
  }else toast('Approchez-vous d’un véhicule à l’arrêt.');
 }
}

function recover(){const p=state.driving?activeCar.root.position:player.position;const road=grid.reduce((a,b)=>Math.abs(b-p.x)<Math.abs(a-p.x)?b:a,grid[0]);p.set(road+4,0,clamp(p.z,-235,235));state.speed=0;Object.assign(jump,{y:groundAt(p.x,p.z),vy:0,grounded:true});player.rotation.x=player.rotation.z=0;if(state.driving){activeCar.h=0;activeCar.root.rotation.y=0;activeCar.speed=0}toast('Vous êtes de retour sur la route.')}
function blocked(x,z,r){if(Math.abs(x)>worldLimit||Math.abs(z)>worldLimit)return true;return colliders.some(b=>Math.abs(x-b.x)<b.w+r&&Math.abs(z-b.z)<b.d+r)}
function carBlocked(car,x,z,h){
 if(car.kind==='heli')return aircraftBlocked(x,z,car.root.position.y,7);
 for(const [sx,sz]of(car.kind==='bike'?[[0,0],[0,.95],[0,-.95]]:[[0,0],[.85,1.5],[-.85,1.5],[.85,-1.5],[-.85,-1.5]])){
  const px=x+sx*Math.cos(h)+sz*Math.sin(h),pz=z-sx*Math.sin(h)+sz*Math.cos(h);if(blocked(px,pz,.25)||actorAt(px,pz,.3,0))return true;
 }
 for(const other of cars){if(other===car||other.root.position.y>3)continue;if(Math.hypot(x-other.root.position.x,z-other.root.position.z)<(car.kind==='bike'?1.8:2.7))return true}return false;
}
function groundAt(x,z){return grid.slice(0,-1).some(a=>x>a+10.5&&x<a+61.5)&&grid.slice(0,-1).some(a=>z>a+10.5&&z<a+61.5)?.3:0}
function actorShape(actor){return {x:actor.root.position.x,z:actor.root.position.z,y:actor.root.position.y,radius:actor.down?.72:actor.radius??.38,height:actor.down?.4:actor.height??1.8}}
function actorAt(x,z,r,y,ignore=null){const capsule={x,z,y,radius:r,height:1.8};return [...peds,...stationaryActors].some(a=>a!==ignore&&capsulesOverlap(capsule,actorShape(a)))}
function vehicleAt(x,z,r,y){return cars.some(c=>{
 const dy=c.root.position.y;if(y>=dy+(c.meta.h||1.6)-.015||y+1.8<dy)return false;
 const dx=x-c.root.position.x,dz=z-c.root.position.z,lx=dx*Math.cos(c.h)-dz*Math.sin(c.h),lz=dx*Math.sin(c.h)+dz*Math.cos(c.h);
 return Math.abs(lx)<(c.meta.w||2)/2+r&&Math.abs(lz)<(c.meta.len||4.5)/2+r;
})}
function playerGround(){
 let floor=groundAt(player.position.x,player.position.z);
 for(const c of cars){const dx=player.position.x-c.root.position.x,dz=player.position.z-c.root.position.z,lx=dx*Math.cos(c.h)-dz*Math.sin(c.h),lz=dx*Math.sin(c.h)+dz*Math.cos(c.h),roof=c.root.position.y+(c.meta.h||1.6);if(Math.abs(lx)<(c.meta.w||2)/2&&Math.abs(lz)<(c.meta.len||4.5)/2&&player.position.y>=roof-.06)floor=Math.max(floor,roof)}
 return floor;
}
function personBlocked(x,z,r,y,ignore=null){
 if(blocked(x,z,r)||actorAt(x,z,r,y,ignore)||vehicleAt(x,z,r,y))return true;
 return ignore&&!state.driving&&capsulesOverlap({x,z,y,radius:r,height:1.8},{x:player.position.x,z:player.position.z,y:player.position.y,radius:.4,height:1.8});
}
function aircraftBlocked(x,z,y,r){
 if(Math.abs(x)>worldLimit-r||Math.abs(z)>worldLimit-r)return true;
 if(buildings.some(b=>y<b.h+1&&Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r))return true;
 if(y<2&&actorAt(x,z,r,y))return true;
 return cars.some(c=>c!==activeCar&&Math.abs(y-c.root.position.y)<5&&Math.hypot(x-c.root.position.x,z-c.root.position.z)<r+2.5);
}
function requestJump(){if(!state.playing||state.paused||phoneOpen||state.driving)return;stepJump(jump,0,playerGround(),true)}
function move(dt){
 const forward=(keys.KeyW||keys.KeyZ||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-touch.y,turn=(keys.KeyA||keys.KeyQ||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0)-touch.x;
 if(state.driving){
  const c=activeCar;
  if(c.kind==='heli'){
   state.speed=THREE.MathUtils.damp(state.speed,forward*23,2,dt);c.h+=turn*1.05*dt;c.root.rotation.y=c.h;
   const dx=Math.sin(c.h)*state.speed*dt,dz=Math.cos(c.h)*state.speed*dt;
   const floor=buildings.reduce((v,b)=>Math.abs(c.root.position.x-b.x)<b.w/2+7&&Math.abs(c.root.position.z-b.z)<b.d/2+7?Math.max(v,b.h+1):v,.035);
   const lift=(keys.Space?1:0)-(keys.ShiftLeft?1:0),ny=clamp(c.root.position.y+lift*8*dt,floor,110);
   if(!aircraftBlocked(c.root.position.x,c.root.position.z,ny,7))c.root.position.y=ny;
   if(c.root.position.y>.5&&!aircraftBlocked(c.root.position.x+dx,c.root.position.z+dz,c.root.position.y,7)){c.root.position.x+=dx;c.root.position.z+=dz}else if(Math.abs(state.speed)>1)state.speed=0;
   c.root.rotation.x=THREE.MathUtils.damp(c.root.rotation.x,forward*.08,4,dt);c.root.rotation.z=THREE.MathUtils.damp(c.root.rotation.z,-turn*.08,4,dt);c.speed=state.speed;state.heading=c.h;
   for(const part of c.rotors){if(part.name==='tail')part.rotation.x+=dt*(c.root.position.y>.1?36:7);else part.rotation.y+=dt*(c.root.position.y>.1?36:7)}
   return;
  }
  let accel=forward>0?(c.kind==='bike'?13:10):forward<0?(state.speed>1?-22:-6):0;state.speed+=accel*dt;state.speed*=Math.exp(-(keys.Space?2.8:forward===0?.35:.045)*dt);state.speed=clamp(state.speed,-9,c.kind==='bike'?48:43);if(Math.abs(state.speed)<.03)state.speed=0;
  const steer=turn*.52/(1+Math.abs(state.speed)*.035),proposedHeading=c.h+state.speed/(c.kind==='bike'?1.8:2.75)*Math.tan(steer)*dt;
  if(!carBlocked(c,c.root.position.x,c.root.position.z,proposedHeading))c.h=proposedHeading;
  c.root.rotation.y=c.h;const distance=state.speed*dt,steps=Math.max(1,Math.ceil(Math.abs(distance)/.2));let hit=false;
  for(let i=0;i<steps;i++){const x=c.root.position.x+Math.sin(c.h)*distance/steps,z=c.root.position.z+Math.cos(c.h)*distance/steps;if(carBlocked(c,x,z,c.h)){hit=true;break}c.root.position.x=x;c.root.position.z=z}
  if(hit){if(Math.abs(state.speed)>6)toast('Passage bloqué — ralentissez.');state.speed*=-.1}c.speed=state.speed;state.heading=c.h;
  for(const w of c.wheels){w.mesh.rotation.x+=state.speed*dt/.33;if(w.front)w.pivot.rotation.y=steer}c.root.rotation.z=THREE.MathUtils.damp(c.root.rotation.z,-steer*state.speed*(c.kind==='bike'?.016:.002),5,dt);
  if(c.kind==='bike'){player.visible=true;player.position.copy(c.root.position);player.rotation.set(.18,c.h,c.root.rotation.z);animateHuman({mix:mixer,acts:actions},0,dt);poseRider()}
 }else{
  const f=clamp(forward,-1,1),t=clamp(turn,-1,1),len=Math.min(1,Math.hypot(f,t)),pace=len*(keys.ShiftLeft?5.8:2.7);let traveled=0;
  if(len>.03){const view=state.heading+state.camYaw,dx=(Math.sin(view)*f+Math.cos(view)*t)*pace*dt/Math.max(1,Math.hypot(f,t)),dz=(Math.cos(view)*f-Math.sin(view)*t)*pace*dt/Math.max(1,Math.hypot(f,t));traveled=moveWithCollisions(player.position,dx,dz,.4,(x,z,r)=>personBlocked(x,z,r,player.position.y));player.rotation.y=Math.atan2(dx,dz)}
  state.speed=traveled/Math.max(dt,.001);stepJump(jump,dt,playerGround());player.position.y=jump.y;
  animateHuman({mix:mixer,acts:actions},jump.grounded?state.speed:0,dt);poseArms(dt);if(weaponRoot)weaponRoot.visible=true;
 }
}

let camResetTimer=0;function cameraFollow(dt){const p=state.driving?activeCar.root.position:player.position,h=state.heading+state.camYaw,first=state.view===1;const helicopter=state.driving&&activeCar.kind==='heli',armed=!state.driving&&weaponId!=='fists';const dist=first?(helicopter?-4:state.driving?.05:.1):(helicopter?23:state.driving?8+Math.abs(state.speed)*.06:armed?3:4.5),height=first?(helicopter?2.8:state.driving?1.05:1.7):(helicopter?9:state.driving?3.8:armed?1.75:2.5)+(armed?0:state.camPitch*5);const desired=new V(p.x-Math.sin(h)*dist,p.y+height,p.z-Math.cos(h)*dist);if(!first){ // Shorten the camera arm before it reaches a building.
 for(let k=1;k<=12;k++){const a=k/12,x=THREE.MathUtils.lerp(p.x,desired.x,a),z=THREE.MathUtils.lerp(p.z,desired.z,a);if(blocked(x,z,.2)){desired.set(THREE.MathUtils.lerp(p.x,desired.x,Math.max(.15,a-.1)),p.y+height,THREE.MathUtils.lerp(p.z,desired.z,Math.max(.15,a-.1)));break}}}
 camera.position.lerp(desired,1-Math.exp(-dt*7));if(armed)camera.lookAt(camera.position.x+Math.sin(h)*50,camera.position.y-state.camPitch*25,camera.position.z+Math.cos(h)*50);else if(first)camera.lookAt(p.x+Math.sin(h)*15,p.y+1.4-state.camPitch*7,p.z+Math.cos(h)*15);else camera.lookAt(p.x+Math.sin(h)*3,p.y+1.2,p.z+Math.cos(h)*3);camera.fov=THREE.MathUtils.lerp(camera.fov,58+Math.abs(state.speed)*.23,dt*3);camera.updateProjectionMatrix();sky.position.copy(camera.position);sun.target.position.copy(p);sun.position.set(p.x-100,95,p.z-160);
}
function updateTraffic(dt){
 for(const c of traffic){if(c===activeCar)continue;const p=c.root.position,dx=Math.sin(c.h),dz=Math.cos(c.h),ahead=new V(p.x+dx*6,0,p.z+dz*6);let speed=c.speed;
  if(cars.some(o=>o!==c&&o.root.position.distanceTo(ahead)<4)||(!state.driving&&player.position.distanceTo(ahead)<4)||actorAt(ahead.x,ahead.z,1.2,0))speed=0;
  const x=p.x+dx*speed*dt,z=p.z+dz*speed*dt;
  if(!actorAt(x,z,1.2,0)&&!(!state.driving&&Math.hypot(player.position.x-x,player.position.z-z)<2.5)){p.x=x;p.z=z}
  if(p.x>248)p.x=-248;if(p.x<-248)p.x=248;if(p.z>248)p.z=-248;if(p.z<-248)p.z=248;for(const w of c.wheels)w.mesh.rotation.x+=speed*dt/.35;
 }
 for(const ped of peds){
  if(ped.down){ped.down-=dt;if(ped.down<=0){if(!personBlocked(ped.root.position.x,ped.root.position.z,.4,ped.root.position.y,ped)){ped.down=0;ped.hp=100;ped.root.rotation.x=0}else ped.down=1}continue}
  const before=ped.root.position.z;moveWithCollisions(ped.root.position,0,ped.dir*ped.speed*dt,.38,(x,z,r)=>personBlocked(x,z,r,ped.root.position.y,ped));
  if(Math.abs(ped.root.position.z-before)<ped.speed*dt*.1||Math.abs(ped.root.position.z)>239){ped.dir*=-1;ped.root.rotation.y=ped.dir>0?0:Math.PI}
  ped.root.position.y=groundAt(ped.root.position.x,ped.root.position.z);animateHuman(ped,Math.abs(ped.root.position.z-before)/dt,dt);if(ped.hit){ped.hit=Math.max(0,ped.hit-dt);ped.root.rotation.x=-Math.sin(ped.hit/.35*Math.PI)*.25}else ped.root.rotation.x=0;
 }for(const m of decor)m.update(dt);
}

const map=$('minimap'),ctx=map.getContext('2d');function drawMap(){const p=state.driving?activeCar.root.position:player.position,t=target(),expanded=document.body.classList.contains('map-expanded'),zoom=expanded?.39:.65;ctx.fillStyle='#15282b';ctx.fillRect(0,0,220,220);const X=x=>110+(x-p.x)*zoom,Z=z=>110+(z-p.z)*zoom;ctx.fillStyle='#2c4244';for(const b of buildings)ctx.fillRect(X(b.x-b.w/2),Z(b.z-b.d/2),b.w*zoom,b.d*zoom);ctx.strokeStyle='#66817a';ctx.lineWidth=3;for(const r of grid){ctx.beginPath();ctx.moveTo(X(r),Z(-260));ctx.lineTo(X(r),Z(260));ctx.stroke();ctx.beginPath();ctx.moveTo(X(-260),Z(r));ctx.lineTo(X(260),Z(r));ctx.stroke()}ctx.fillStyle='#426979';ctx.fillRect(X(260),0,220,220);ctx.setLineDash([4,4]);ctx.lineWidth=1.5;ctx.strokeStyle='#cfe599b0';ctx.beginPath();ctx.moveTo(110,110);ctx.lineTo(X(t[0]),Z(t[1]));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d3e49a';const tx=clamp(X(t[0]),9,211),tz=clamp(Z(t[1]),9,211);ctx.beginPath();ctx.arc(tx,tz,5,0,Math.PI*2);ctx.fill();for(const c of cars){ctx.fillStyle=c===activeCar?'#fff5d0':'#94b3a1';ctx.fillRect(X(c.root.position.x)-1.5,Z(c.root.position.z)-1.5,3,3);if(c===lastDelivered){ctx.strokeStyle='#7cdbed';ctx.lineWidth=2;ctx.beginPath();ctx.arc(clamp(X(c.root.position.x),8,212),clamp(Z(c.root.position.z),8,212),6,0,Math.PI*2);ctx.stroke()}}ctx.save();ctx.translate(110,110);ctx.rotate(-state.heading);ctx.fillStyle='#f4f5ed';ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(-5,-5);ctx.lineTo(0,-2);ctx.lineTo(5,-5);ctx.closePath();ctx.fill();ctx.restore()}
let hudTimer=0;function hud(dt){hudTimer+=dt;if(hudTimer<.1)return;hudTimer=0;const p=state.driving?activeCar.root.position:player.position,t=target(),dist=Math.hypot(p.x-t[0],p.z-t[1]);$('distance').textContent=Math.round(dist)+' m';$('mode').textContent=state.driving?activeCar.type:'EXPLORATION À PIED';$('unit').textContent=state.driving?'KM/H':'M/S';$('speed').textContent=String(Math.round(Math.abs(state.speed)*(state.driving?3.6:1))).padStart(3,'0');$('speedbar').style.width=Math.min(100,Math.abs(state.speed)/43*100)+'%';$('district').textContent=p.x>170?'QUAIS DU RIVAGE':p.z<-100?'MAISON NORD':'PORT LUMIÈRE';$('hints').textContent=state.driving?(activeCar.kind==='heli'?'ZQSD · Piloter    Espace / Maj · Monter / descendre    P · Téléphone':'ZQSD · Conduire    Espace · Freiner    E · Descendre    P · Téléphone'):'ZQSD · Marcher    Maj · Courir    Espace · Sauter    F · Frapper / tirer    P · Téléphone';$('weaponStatus').textContent=state.driving?(activeCar.kind==='heli'?'ALTITUDE '+Math.round(activeCar.root.position.y)+' M':'P · TÉLÉPHONE'):(weaponId==='fists'?'POINGS · F POUR FRAPPER':weaponId==='w_ak'?'AK-47 · F POUR TIRER':'PISTOLET · F POUR TIRER');$('crosshair').hidden=state.driving||weaponId==='fists';$('jumpActionLabel').textContent=state.driving?(activeCar.kind==='heli'?'MONTER':'FREIN'):'SAUTER';$('sprintActionLabel').textContent=state.driving&&activeCar.kind==='heli'?'DESCENDRE':'SPRINT';let prompt='';if(dist<8&&p.y<1){if(Math.abs(state.speed)>1.8)prompt='Ralentissez pour le rendez-vous';else{if(!state.stage){state.stage=1;updateMission();toast('Colis récupéré. Direction le point de livraison.')}else{const reward=missions[state.mission].reward;state.bank+=reward;state.mission=(state.mission+1)%missions.length;state.stage=0;updateMission();save();toast('Livraison terminée · + '+reward+' € · Nouveau contrat disponible.')}}}else if(!state.driving&&cars.some(c=>c.root.position.distanceTo(player.position)<5&&!traffic.includes(c)))prompt='E · Monter dans le véhicule';$('prompt').innerHTML=prompt?'<span>'+prompt+'</span>':'';drawMap()}
// Phone apps load the existing repository models only when requested.
const assetPromises=new Map();
async function getModel(key){
 if(vehicleModels[key])return vehicleModels[key];
 if(!assetPromises.has(key))assetPromises.set(key,loadGlb('assets/models/'+key+'.glb').then(g=>{vehicleModels[key]=g.scene;return g.scene}).catch(e=>{assetPromises.delete(key);throw e}));
 return assetPromises.get(key);
}
async function getVehicleMeta(key){
 if(vehicleMetas[key])return vehicleMetas[key];const response=await fetch('assets/models/'+key+'.json');if(!response.ok)throw new Error(key+'.json : HTTP '+response.status);return vehicleMetas[key]=await response.json();
}
function togglePhone(open=!phoneOpen){
 if(open&&(!state.playing||state.paused))return;
 phoneOpen=open;$('phone').hidden=!open;clearInput();$('crosshair').hidden=open||state.driving||weaponId==='fists';
 $('phoneBtn').setAttribute('aria-expanded',String(open));if(open){document.body.classList.remove('map-expanded');$('phoneClose').focus()}else if(state.playing)$('phoneBtn').focus();
}
function phoneTab(tab){for(const button of document.querySelectorAll('[data-phone-tab]')){const selected=button.dataset.phoneTab===tab;button.setAttribute('aria-selected',String(selected));button.classList.toggle('selected',selected)}$('phoneVehicles').hidden=tab!=='vehicles';$('phoneWeapons').hidden=tab!=='weapons'}
async function phoneTask(task){
 if(phoneBusy)return;phoneBusy=true;for(const b of document.querySelectorAll('[data-spawn],[data-weapon]'))b.disabled=true;$('phoneStatus').textContent='Chargement du modèle…';
 try{await task()}catch(error){console.error(error);$('phoneStatus').textContent='Impossible de charger : '+error.message}
 finally{phoneBusy=false;for(const b of document.querySelectorAll('[data-spawn],[data-weapon]'))b.disabled=false}
}
function spawnBlocked(x,z,r){
 if(blocked(x,z,r)||actorAt(x,z,r,0))return true;
 if(!state.driving&&Math.hypot(player.position.x-x,player.position.z-z)<r+.6)return true;
 return cars.some(c=>Math.hypot(c.root.position.x-x,c.root.position.z-z)<r+(c.kind==='heli'?8:c.kind==='bike'?1.5:3));
}
async function spawnVehicle(key){
 if(!state.playing)throw new Error('la partie est fermée');const label={nsx:'Honda NSX',h2r:'Kawasaki Ninja H2R',heli:'Hélicoptère'}[key];if(!label)throw new Error('véhicule inconnu');
 const [proto,meta]=await Promise.all([getModel(key),getVehicleMeta(key)]);if(!state.playing)throw new Error('la partie est fermée');
 const origin=state.driving?activeCar.root.position:player.position,radius=key==='heli'?9:key==='h2r'?1.8:3,points=[];
 for(const x of grid)for(let z=-230;z<=230;z+=10)points.push({x:x+(key==='heli'?0:4),z},{x:z,z:x+(key==='heli'?0:4)});
 const spot=findSpawnPoint(origin,points,radius,spawnBlocked);if(!spot)throw new Error('aucun emplacement libre à proximité');
 let car;
 if(key==='nsx')car=makeCar(proto,meta,spot.x,spot.z,0,'HONDA NSX');
 else{
  const root=new THREE.Group(),body=proto.clone(true);root.add(body);const wheels=[];
  if(key==='h2r')for(const name of ['wheelF','wheelR']){const mesh=body.getObjectByName(name);if(!mesh)continue;const pivot=new THREE.Group();pivot.position.copy(mesh.position);mesh.removeFromParent();mesh.position.set(0,0,0);pivot.add(mesh);body.add(pivot);wheels.push({pivot,mesh,front:name==='wheelF'})}
  shadowModel(root);root.position.set(spot.x,.035,spot.z);scene.add(root);car={root,wheels,meta,type:label.toUpperCase(),h:0,speed:0,kind:key==='heli'?'heli':'bike',rotors:key==='heli'?['rotor','tail'].map(n=>body.getObjectByName(n)).filter(Boolean):[]};cars.push(car);
 }
 car.delivered=true;lastDelivered=car;const extras=cars.filter(c=>c.delivered&&c!==activeCar&&c!==car);while(extras.length>4){const old=extras.shift();old.root.removeFromParent();cars.splice(cars.indexOf(old),1)}
 const meters=Math.round(Math.hypot(spot.x-origin.x,spot.z-origin.z));$('phoneStatus').textContent=label+' livré à '+meters+' m. Repère bleu sur la carte. Approchez-vous puis appuyez sur E.';toast(label+' livré à '+meters+' m · Repère bleu.');
}
async function equipWeapon(id){
 if(!['fists','w_deagle','w_ak'].includes(id))throw new Error('arme inconnue');
 let proto;if(id!=='fists')proto=await getModel(id);if(!state.playing)throw new Error('la partie est fermée');
 if(weaponRoot){weaponRoot.removeFromParent();weaponRoot=null}weaponId=id;if(proto)state.camPitch=0;
 if(proto){
  const hand=player.getObjectByName('mixamorigRightHand');if(!hand)throw new Error('main du personnage introuvable');
  const model=proto.clone(true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new V()),length=id==='w_ak'?.8:.25,scale=length/Math.max(size.x,size.y,size.z),center=bounds.getCenter(new V());
  const holder=new THREE.Group();model.position.sub(center);model.scale.setScalar(scale);model.position.multiplyScalar(scale);holder.add(model);holder.position.set(.015,.14,.02);holder.rotation.x=-Math.PI/2;hand.add(holder);weaponRoot=holder;shadowModel(holder);weaponRoot.visible=!state.driving;
 }
 const label=id==='fists'?'Poings':id==='w_ak'?'AK-47':'Pistolet';$('phoneStatus').textContent=label+' équipé. Fermez le téléphone et utilisez F / le bouton ACTION à pied.';$('equippedName').textContent=label;
 for(const b of document.querySelectorAll('[data-weapon]'))b.setAttribute('aria-pressed',String(b.dataset.weapon===id));
}
function poseRider(){
 for(const side of ['Left','Right']){const leg=player.getObjectByName('mixamorig'+side+'UpLeg'),knee=player.getObjectByName('mixamorig'+side+'Leg'),arm=player.getObjectByName('mixamorig'+side+'Arm'),forearm=player.getObjectByName('mixamorig'+side+'ForeArm');if(leg)leg.rotation.x-=1.1;if(knee)knee.rotation.x+=1.35;if(arm)arm.rotation.x-=1.15;if(forearm)forearm.rotation.y+=side==='Left'?-.45:.45}
}
function poseArms(dt){
 punchTimer=Math.max(0,punchTimer-dt);const swing=punchTimer>0?Math.sin((1-punchTimer/.32)*Math.PI):0;
 const right=player.getObjectByName('mixamorigRightArm'),fore=player.getObjectByName('mixamorigRightForeArm');
 if(right){right.rotation.z+=weaponId==='fists'?swing*.8:1.05;right.rotation.x-=weaponId==='fists'?swing*1.2:1.25}
 if(fore)fore.rotation.y-=weaponId==='fists'?swing*.45:.4;
 if(weaponId==='w_ak'){const left=player.getObjectByName('mixamorigLeftArm');if(left){left.rotation.z-=.9;left.rotation.x-=1.1}}
 if(!jump.grounded){const left=player.getObjectByName('mixamorigLeftUpLeg'),rightLeg=player.getObjectByName('mixamorigRightUpLeg');if(left)left.rotation.x-=.35;if(rightLeg)rightLeg.rotation.x+=.25}
}
function clearLine(from,to){const distance=from.distanceTo(to),steps=Math.ceil(distance/.25);for(let i=1;i<steps;i++){const t=i/steps;if(blocked(THREE.MathUtils.lerp(from.x,to.x,t),THREE.MathUtils.lerp(from.z,to.z,t),.05))return false}return true}
function damagePed(ped,damage){
 if(ped.down)return;ped.hp=(ped.hp??100)-damage;ped.hit=.35;
 if(ped.hp<=0){ped.down=12;ped.root.rotation.x=-Math.PI/2;toast('PNJ à terre.')}else{if(!ped.stationary){ped.dir*=-1;ped.root.rotation.y=ped.dir>0?0:Math.PI}toast('Touché · '+Math.max(0,ped.hp)+' / 100')}
}
function attack(){
 if(!state.playing||state.paused||phoneOpen||state.driving||attackCooldown>0)return;
 attackCooldown=weaponId==='w_ak'?.13:weaponId==='fists'?.45:.3;punchTimer=.32;
 if(weaponId==='fists'){
  const origin=player.position,targets=[...peds,...stationaryActors].filter(p=>!p.down&&inMeleeRange(origin,player.rotation.y,p.root.position)&&clearLine(origin,p.root.position)).sort((a,b)=>a.root.position.distanceTo(origin)-b.root.position.distanceTo(origin));
  if(targets[0])damagePed(targets[0],34);return;
 }
 const origin=player.position.clone().add(new V(0,1.35,0)),direction=camera.getWorldDirection(new V()).normalize();player.rotation.y=Math.atan2(direction.x,direction.z);
 const ray=new THREE.Ray(origin,direction),point=new V(),end=ray.at(90,new V());let nearest=90,hit=null;
 for(const b of buildings){const bb=new THREE.Box3(new V(b.x-b.w/2,0,b.z-b.d/2),new V(b.x+b.w/2,b.h+.9,b.z+b.d/2));if(ray.intersectBox(bb,point)){const d=point.distanceTo(origin);if(d<nearest){nearest=d;hit=null;end.copy(point)}}}
 for(const car of cars){const bb=new THREE.Box3().setFromObject(car.root);if(ray.intersectBox(bb,point)){const d=point.distanceTo(origin);if(d<nearest){nearest=d;hit=null;end.copy(point)}}}
 for(const ped of [...peds,...stationaryActors]){if(ped.down)continue;const sphere=new THREE.Sphere(ped.root.position.clone().add(new V(0,1.05,0)),.58);if(ray.intersectSphere(sphere,point)){const d=origin.distanceTo(point);if(d<nearest){nearest=d;hit=ped;end.copy(point)}}}
 if(hit)damagePed(hit,weaponId==='w_ak'?30:50);
 const trace=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin,end]),traceMaterial);scene.add(trace);effects.push({root:trace,life:.07});
}
const traceMaterial=new THREE.LineBasicMaterial({color:0xffdfa0,transparent:true,opacity:.85});
function updateCombat(dt){
 attackCooldown=Math.max(0,attackCooldown-dt);for(const actor of stationaryActors){if(actor.down){actor.down=Math.max(0,actor.down-dt);if(!actor.down&&!personBlocked(actor.root.position.x,actor.root.position.z,.4,actor.root.position.y,actor)){actor.hp=100;actor.root.rotation.x=0}else if(!actor.down)actor.down=1}}for(let i=effects.length-1;i>=0;i--){const fx=effects[i];fx.life-=dt;if(fx.life<=0){fx.root.removeFromParent();fx.root.geometry.dispose();effects.splice(i,1)}}
}
$('phoneBtn').onclick=()=>togglePhone();$('phoneClose').onclick=()=>togglePhone(false);
for(const b of document.querySelectorAll('[data-phone-tab]'))b.onclick=()=>phoneTab(b.dataset.phoneTab);
for(const b of document.querySelectorAll('[data-spawn]'))b.onclick=()=>phoneTask(()=>spawnVehicle(b.dataset.spawn));
for(const b of document.querySelectorAll('[data-weapon]'))b.onclick=()=>phoneTask(()=>equipWeapon(b.dataset.weapon));
$('phone').addEventListener('keydown',e=>{if(e.code!=='Tab')return;const focusable=[...$('phone').querySelectorAll('button:not(:disabled)')].filter(b=>!b.closest('[hidden]'));if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});

let audioCtx,engineOsc,engineGain;function soundToggle(){state.sound=!state.sound;if(state.sound&&!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();engineOsc=audioCtx.createOscillator();engineOsc.type='triangle';engineGain=audioCtx.createGain();const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=280;engineOsc.connect(filter);filter.connect(engineGain);engineGain.connect(audioCtx.destination);engineGain.gain.value=0;engineOsc.start()}if(audioCtx?.state==='suspended')audioCtx.resume();$('sound').textContent=state.sound?'SON ON':'SON OFF'}$('sound').onclick=soundToggle;
window.addEventListener('keydown',e=>{
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.repeat)return;
 if(e.code==='KeyP'){if(state.playing&&!state.paused)togglePhone();return}
 if(e.code==='Escape'){if(phoneOpen)togglePhone(false);else pause(!state.paused);return}
 if(!state.playing||state.paused||phoneOpen)return;keys[e.code]=true;
 if(e.code==='KeyE')interact();if(e.code==='KeyF')attack();if(e.code==='Space')requestJump();if(e.code==='KeyC')state.view=1-state.view;if(e.code==='KeyM')document.body.classList.toggle('map-expanded');
});window.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',()=>{clearInput();if(state.playing)pause(true)});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(state.playing)pause(true)}});
let drag=null;$('world').addEventListener('pointerdown',e=>{if(!state.playing||state.paused||phoneOpen)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId};$('world').setPointerCapture(e.pointerId)});$('world').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;state.camYaw-=(e.clientX-drag.x)*.005;state.camPitch=clamp(state.camPitch+(e.clientY-drag.y)*.003,-.2,.8);drag.x=e.clientX;drag.y=e.clientY});for(const event of ['pointerup','pointercancel'])$('world').addEventListener(event,()=>drag=null);
let stickId=null;const stick=$('stick');function stickMove(e){const r=stick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,n=Math.max(1,Math.hypot(dx,dy)/40);touch.x=dx/n/40;touch.y=dy/n/40;$('knob').style.transform=`translate(${dx/n}px,${dy/n}px)`}stick.onpointerdown=e=>{stickId=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e)};stick.onpointermove=e=>{if(e.pointerId===stickId)stickMove(e)};for(const ev of ['pointerup','pointercancel'])stick.addEventListener(ev,()=>{stickId=null;touch.x=touch.y=0;$('knob').style.transform='translate(0,0)'});
for(const b of document.querySelectorAll('[data-action]')){
 const a=b.dataset.action;if(a==='interact')b.onclick=interact;else if(a==='camera')b.onclick=()=>state.view=1-state.view;else if(a==='attack')b.onclick=attack;else{
  const k=a==='brake'?'Space':'ShiftLeft';b.onpointerdown=e=>{if(phoneOpen||state.paused)return;keys[k]=true;if(a==='brake')requestJump();b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=()=>keys[k]=false;
 }
}

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)});
let last=performance.now(),frames=0,elapsed=0,adaptiveTime=0;function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;state.time+=dt;if(loaded){if(state.playing&&!state.paused&&!phoneOpen){move(dt);updateTraffic(dt);updateCombat(dt);cameraFollow(dt);hud(dt)}else if(!state.playing){const a=state.time*.035;camera.position.set(4+Math.sin(a+.65)*17,4.5,45-Math.cos(a+.65)*17);camera.lookAt(activeCar.root.position.x,1.1,activeCar.root.position.z);sky.position.copy(camera.position)}marker.rotation.y+=dt*.2;ring.scale.setScalar(1+Math.sin(state.time*2)*.07);beam.material.opacity=.08+Math.sin(state.time*2)*.035;}if(engineGain){engineGain.gain.setTargetAtTime(state.sound&&state.playing&&!state.paused&&!phoneOpen&&state.driving?.025:0,audioCtx.currentTime,.1);engineOsc.frequency.setTargetAtTime(42+Math.abs(state.speed)*3.5,audioCtx.currentTime,.15)}composer.render();frames++;elapsed+=dt;adaptiveTime+=dt;if(elapsed>3){if(state.quality==='auto'&&state.playing&&frames/elapsed<26&&pixelRatio>.8){pixelRatio=Math.max(.8,pixelRatio-.2);renderer.setPixelRatio(pixelRatio);composer.setPixelRatio(pixelRatio);if(pixelRatio<1)bloom.enabled=false}frames=elapsed=0}}
requestAnimationFrame(frame);init().catch(e=>{console.error(e);$('loadStatus').textContent='Chargement interrompu';fail('Un modèle ou une ressource n’a pas pu être chargé. Vérifiez votre connexion puis réessayez. '+e.message)});
