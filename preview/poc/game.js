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
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.08,1800);scene.add(camera);
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
const grid=Array.from({length:11},(_,i)=>(i-5)*72),worldLimit=395,coastX=worldLimit+7,roadWrap=worldLimit-3;let buildingGroup=null,cityVisibilityTimer=0,farCity=null;const cityChunks=[];
const cube=new THREE.BoxGeometry(1,1,1),colliders=[],buildings=[],lamps=[],peds=[],traffic=[],cars=[],decor=[];
function box(w,h,d,x,y,z,material,parent=scene,shadow=true){const m=new THREE.Mesh(cube,material);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;(parent===scene&&buildingGroup?buildingGroup:parent).add(m);return m}
function plane(w,d,x,z,material,y=.015){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;(buildingGroup??scene).add(m);return m}
plane(worldLimit*2+12,worldLimit*2+12,0,0,roadMat,0);
// Window grids use seeded illumination, weathering and framing, shared between buildings.
function facade(style){const c=document.createElement('canvas');c.width=256;c.height=512;const g=c.getContext('2d');g.fillStyle=style===0?'#8f918c':style===1?'#687b81':'#b3a695';g.fillRect(0,0,256,512);for(let y=0;y<512;y+=32)for(let x=0;x<256;x+=32){g.fillStyle='rgba(0,0,0,.12)';g.fillRect(x,y,32,1);const lit=rand()>.77;g.fillStyle=lit?['#d8b77d','#bba57a','#e1c59a'][Math.floor(rand()*3)]:['#344a54','#4e6065','#263b46','#607079'][Math.floor(rand()*4)];g.fillRect(x+5,y+5,22,23);g.fillStyle='#192d3b60';g.fillRect(x+5,y+16,22,2);g.fillRect(x+15,y+5,1,23);g.fillStyle='#ded8c570';g.fillRect(x+4,y+28,24,2)}for(let i=0;i<2400;i++){g.fillStyle=`rgba(30,25,20,${rand()*.055})`;g.fillRect(rand()*256,rand()*512,rand()*5,rand()*20)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
const facades=[0,1,2].map(facade);const roofs=[mat(0x5c6767),mat(0x73716c)];
function sign(text,w,h,x,y,z,rot=0,color='#ece3d1',bg='#223c3e'){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,512,128);g.fillStyle=color;g.font='500 40px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.25,roughness:.7}));m.position.set(x,y,z);m.rotation.y=rot;(buildingGroup??scene).add(m)}
for(let ix=0;ix<grid.length-1;ix++)for(let iz=0;iz<grid.length-1;iz++){
 const cx=(grid[ix]+grid[ix+1])/2,cz=(grid[iz]+grid[iz+1])/2;buildingGroup=new THREE.Group();scene.add(buildingGroup);cityChunks.push({group:buildingGroup,x:cx,z:cz});
 box(51,.28,51,cx,.14,cz,paveMat,scene,false);
 // Eastern blocks are planted parks beside the waterfront.
 if((ix===grid.length-2&&iz%2===1)||(ix===1&&iz===6)){plane(42,42,cx,cz,new THREE.MeshStandardMaterial({map:texture('grass',5),color:0x78865f}),.3);box(25,.5,3,cx,.55,cz,concrete);continue}
 for(let a=0;a<2;a++)for(let b=0;b<2;b++){
 const x=cx+(a-.5)*25,z=cz+(b-.5)*25,w=range(17,22),d=range(17,22),height=(Math.abs(cx)<145&&Math.abs(cz)<145)?range(29,83):range(12,34),style=Math.floor(rand()*3);
 const tx=facades[style].clone();tx.repeat.set(w/23,height/46);tx.needsUpdate=true;const bm=new THREE.MeshStandardMaterial({map:tx,color:style===1?0xb9c6cb:0xe0d4c3,roughness:style===1?.35:.78,metalness:style===1?.38:.06});
 const building=box(w,height,d,x,height/2+.3,z,bm);buildings.push({x,z,w,d,h:height,chunk:buildingGroup});colliders.push({x,z,w:w/2+.15,d:d/2+.15});box(w+.6,.55,d+.6,x,height+.6,z,roofs[style%2]);box(w+1,.4,d+1,x,4.1,z,concrete);
 box(w-.2,3.4,d-.2,x,2,z,new THREE.MeshStandardMaterial({color:0x243a43,roughness:.28,metalness:.35}));
 for(let n=0;n<3;n++){box(2,1.3,2,x+range(-w/3,w/3),height+1.4,z+range(-d/3,d/3),roofs[0]);}
 if(height>45){box(w*.3,5,d*.6,x,height+3,z,bm);box(.15,9,.15,x,height+9,z,black)}
 if(b===0&&a===0){sign(['ATELIER 24','LUMIÈRE CAFÉ','ÉPICERIE','MAISON NORD','HÔTEL RIVAGE','STUDIO 426'][iz%6],w*.85,1.3,x,3,z-d/2-.025);}
 }
}
buildingGroup=null;
// Painted lane markings, crosswalks and generous, unobstructed intersections.
for(const x of grid){for(let z=-roadWrap;z<roadWrap;z+=9)if(grid.every(k=>Math.abs(z-k)>12)){box(.14,.018,4,x,.025,z,lineMat,scene,false);box(4,.018,.14,z,.025,x,lineMat,scene,false)}for(const z of grid){for(let n=-4;n<=4;n++){box(1.1,.018,4.6,x+n*1.7,.03,z-12,lineMat,scene,false);box(4.6,.018,1.1,x-12,.031,z+n*1.7,lineMat,scene,false)}}}
// Sidewalk furnishings and lights.
for(const x of grid)for(let z=-worldLimit+14;z<worldLimit-12;z+=36){if(grid.some(k=>Math.abs(z-k)<17))continue;for(const side of[-1,1]){
 const px=x+side*11.2;box(.13,6.7,.13,px,3.4,z,black);box(2,.12,.16,px-side*.9,6.7,z,black);box(.9,.08,.35,px-side*1.6,6.6,z,lampMat);
 const l=new THREE.PointLight(0xffd295,0,22,2);l.position.set(px-side*1.6,6.2,z);lamps.push(l);if(lamps.length%5===0)scene.add(l);
 if(side===1){box(1.6,.12,.6,px+.7,.6,z+5,mat(0x6f5140));box(.12,.6,.5,px+.1,.3,z+5,black);box(.12,.6,.5,px+1.3,.3,z+5,black);box(.6,.9,.6,px+.5,.45,z+8,black)}
 }}
// Waterfront: quays, reflective water and distant hills.
const water=new THREE.Mesh(new THREE.PlaneGeometry(900,1500,80,80),new THREE.MeshStandardMaterial({color:0x416b79,metalness:.65,roughness:.22}));water.rotation.x=-Math.PI/2;water.position.set(coastX+450,-.35,0);scene.add(water);box(5,2,worldLimit*2+40,coastX-2,0,0,concrete);for(let z=-worldLimit-12;z<worldLimit+12;z+=8){box(.08,1,.08,coastX-3,1.35,z,black)}box(.08,.08,worldLimit*2+24,coastX-3,1.85,0,black);box(.08,.08,worldLimit*2+24,coastX-3,1.25,0,black);
for(let i=0;i<35;i++){const mountain=new THREE.Mesh(new THREE.ConeGeometry(range(55,140),range(40,120),9),mat(0x6c7e79));mountain.position.set(range(-700,800),10,range(650,850));scene.add(mountain)}
mergeStaticBoxes(scene);createFarCity();
const enemies=[],vehicleModels={},vehicleMetas={},stationaryActors=[],effects=[];let phoneOpen=false,phoneBusy=false,weaponRoot=null,firstPersonWeapon=null,weaponId='fists',lastDelivered=null;const jump={y:0,vy:0,grounded:true};let cameraKick=0,enemyAlertTimer=0;let attackCooldown=0,attackHeld=false,oneShot=null,playerActionPack=null,animationClock=0,airClock=0,recoilTime=99,punchSequence=0,ejection=null,hitFlash=0,shotFlash=0,knockoutTime=0;const playerClips={},animationWeights=new Map();
const keys={},touch={x:0,y:0},state={playing:false,paused:false,driving:true,speed:0,heading:0,camYaw:0,camPitch:.22,view:0,health:100,bank:0,mission:0,stage:0,time:0,quality:'auto',sound:false};let player,activeCar,animData,mixer,actions={},lastAction='',toastTimeout,loaded=false,pixelRatio=renderer.getPixelRatio();
try{const save=JSON.parse(localStorage.getItem('nocturne-poc-v1')||'null');if(save){state.bank=Number(save.bank)||0;state.mission=clamp(Number(save.mission)||0,0,2)}}catch{}
function save(){try{localStorage.setItem('nocturne-poc-v1',JSON.stringify({bank:state.bank,mission:state.mission}))}catch{}}
const missions=[{name:'La première course',pickup:[4,74],drop:[148,-140],reward:350,desc:'Récupérez le pli à la Maison Nord.'},{name:'Le dernier service',pickup:[-140,-68],drop:[220,148],reward:500,desc:'Un colis attend devant le café.'},{name:'Lumières du port',pickup:[76,220],drop:[220,-212],reward:750,desc:'Rejoignez le rendez-vous du port.'}];
const marker=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(3,.08,8,64),new THREE.MeshBasicMaterial({color:0xd3e49a}));ring.rotation.x=Math.PI/2;marker.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.4,2,12,24,1,true),new THREE.MeshBasicMaterial({color:0xd3e49a,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=6;marker.add(beam);scene.add(marker);
function target(){return missions[state.mission][state.stage?'drop':'pickup']}
function updateMission(){const m=missions[state.mission],t=target();marker.position.set(t[0],.12,t[1]);$('missionCount').textContent=String(state.mission+1).padStart(2,'0');$('missionTitle').textContent=m.name;$('missionText').textContent=state.stage?'Livrez le colis au point indiqué sur la carte.':m.desc;$('reward').textContent='+ '+m.reward+' €';$('money').textContent=state.bank.toLocaleString('fr-FR')+' €'}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),4200)}
function fail(t){$('errorText').textContent=t;$('error').hidden=false}
function shadowModel(root){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(/hair|lash/i.test(m.name)){m.alphaTest=.45;m.transparent=false;m.side=THREE.DoubleSide}}}}})}
function makeCar(proto,meta,x,z,h,type){const root=new THREE.Group(),body=proto.clone(true);const wheel=body.getObjectByName('wheel');if(wheel)wheel.removeFromParent();root.add(body);const wheels=[];for(const p of meta.wheels||[]){if(!wheel)continue;const pivot=new THREE.Group();pivot.position.fromArray(p);const mesh=wheel.clone(true);mesh.position.set(0,0,0);if(p[0]<0)mesh.rotation.y=Math.PI;pivot.add(mesh);root.add(pivot);wheels.push({pivot,mesh,front:p[2]>0})}shadowModel(root);root.position.set(x,.035,z);root.rotation.y=h;scene.add(root);vehiclePaint(root,type==='HONDA NSX'?0xb9c7cf:type==='VOLVO V50'?0x354e5b:0x89816c);const car={root,wheels,meta,type,h,speed:0};cars.push(car);return car}
function human(proto,anims){const root=skeletonClone(proto);root.traverse(o=>{if(o.isBone)o.name=o.name.replace(/^mixamorig\d*:?/,'mixamorig')});root.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone()});shadowModel(root);let hips=1;root.traverse(o=>{if(o.isBone&&o.name.endsWith('Hips'))hips=o.position.y});const mix=new THREE.AnimationMixer(root),acts={};for(const k of ['idle','walk','run'])if(anims[k]){const c=THREE.AnimationClip.parse(anims[k]);for(const t of c.tracks){t.name=t.name.replace(/^mixamorig\d*:?/,'mixamorig');if(/Hips\.position$/.test(t.name))for(let i=0;i<t.values.length;i+=3){t.values[i]=0;t.values[i+1]*=hips/.93;t.values[i+2]=0}}acts[k]=mix.clipAction(c);acts[k].play();acts[k].setEffectiveWeight(k==='idle'?1:0)}return {root,mix,acts}}
function animateHuman(h,speed,dt){const next=speed>4?'run':speed>.2?'walk':'idle';for(const k in h.acts)h.acts[k].setEffectiveWeight(k===next?1:0);h.mix.update(dt)}
async function init(){
 const files=['nsx','volvo','kia','james','adam','pnj_femme','n_CommonTree_1','n_PalmTree_1','w_ak'];let done=0;const models={};
 await Promise.all(files.map(async f=>{models[f]=(await loadGlb('assets/models/'+f+'.glb')).scene;done++;$('progress').textContent=Math.round(done/(files.length+2)*100)+'%';$('loadStatus').textContent='Chargement : '+f.replaceAll('_',' ')+'…'}));
 animData=await fetch('assets/anims.json').then(r=>{if(!r.ok)throw Error('Animations manquantes');return r.json()});done++;
 const metas=await Promise.all(['nsx','volvo','kia'].map(f=>fetch('assets/models/'+f+'.json').then(r=>r.json())));
 Object.assign(vehicleModels,models);['nsx','volvo','kia'].forEach((key,i)=>vehicleMetas[key]=metas[i]);
 activeCar=makeCar(models.nsx,metas[0],4,45,0,'HONDA NSX');
 for(let i=0;i<32;i++){const axis=i%2,road=grid[i%grid.length],lane=i%3?4:-4,h=axis?(lane>0?Math.PI/2:-Math.PI/2):(lane>0?0:Math.PI),x=axis?range(-worldLimit+25,worldLimit-25):road+lane,z=axis?road+lane:range(-worldLimit+25,worldLimit-25);const c=makeCar(models[i%2?'volvo':'kia'],metas[i%2?1:2],x,z,h,i%2?'VOLVO V50':'KIA PICANTO');c.axis=axis;c.direction=lane>0?1:-1;c.speed=range(6,11);traffic.push(c)}
 for(const p of [[-4,78,Math.PI],[76,-8,Math.PI/2],[-68,-140,0]])makeCar(models.volvo,metas[1],...p,'VOLVO V50');
 const actionResponse=await fetch('assets/player-actions.json?v=immersion-1');if(!actionResponse.ok)throw new Error('Animations joueur : HTTP '+actionResponse.status);playerActionPack=await actionResponse.json();const riderResponse=await fetch('assets/rider-animation.json?v=city-2');if(!riderResponse.ok)throw new Error('Animation moto : HTTP '+riderResponse.status);Object.assign(playerActionPack.clips,(await riderResponse.json()).clips);
 const h=human(models.james,animData);player=h.root;mixer=h.mix;actions=h.acts;initPlayerAnimations();player.visible=false;scene.add(player);player.position.set(7,0,45);
 for(let i=0;i<42;i++){const hh=human(models[i%3===0?'pnj_femme':i%3===1?'james':'adam'],animData);const road=grid[i%grid.length],side=i%2?1:-1;hh.root.position.set(road+side*11.25,.3,range(-worldLimit+25,worldLimit-25));hh.dir=i%2?1:-1;hh.speed=range(.6,1.15);hh.root.rotation.y=hh.dir>0?0:Math.PI;hh.root.scale.setScalar(range(.92,1.02));for(let retry=0;retry<30&&personBlocked(hh.root.position.x,hh.root.position.z,.4,.3);retry++)hh.root.position.z=range(-worldLimit+25,worldLimit-25);prepareActor(hh,false);scene.add(hh.root);peds.push(hh)}
 // Additional original GLB downloaded directly from the user's Drive, displayed in the park.
 const casual=await loadGlb('assets/casual.glb?v=4cbff2a0');const parkPerson=casual.scene;const cb=new THREE.Box3().setFromObject(parkPerson),sz=cb.getSize(new V());parkPerson.scale.setScalar(1.75/sz.y);parkPerson.position.set(180,.3,40);shadowModel(parkPerson);scene.add(parkPerson);stationaryActors.push({root:parkPerson,radius:.38,height:1.8,stationary:true});prepareActor(stationaryActors.at(-1),false);if(casual.animations.length){const mm=new THREE.AnimationMixer(parkPerson);mm.clipAction(casual.animations[0]).play();decor.push(mm)}
 initEnemies(models.james,models.w_ak);
 for(let i=0;i<190;i++){const tree=models[i%5===0?'n_PalmTree_1':'n_CommonTree_1'].clone(true);const ix=Math.floor(rand()*(grid.length-1)),iz=Math.floor(rand()*(grid.length-1)),x=(grid[ix]+grid[ix+1])/2+(rand()>.5?25:-25),z=(grid[iz]+grid[iz+1])/2+range(-23,23);tree.position.set(x,.3,z);const b=new THREE.Box3().setFromObject(tree),s=range(5,9)/b.getSize(new V()).y;tree.scale.setScalar(s);shadowModel(tree);scene.add(tree)}
 loaded=true;$('play').disabled=false;$('play').innerHTML='ENTRER DANS LA VILLE <span>↗</span>';$('loadStatus').textContent='Prêt. Casque conseillé · Clavier et tactile';updateMission();camera.position.set(17,5,25);camera.lookAt(4,1,45);updateCityVisibility(1);window.__game={state,renderer,scene,camera,cars,player,get activeCar(){return activeCar},recover,interact,peds,jump,attack,spawnVehicle,equipWeapon,togglePhone,toggleView,get weaponId(){return weaponId},get oneShot(){return oneShot},enemies};
}
function mood(value){const night=value==='night';hemi.intensity=night?.65:2;hemi.color.set(night?0x7193c2:0xa5cbeb);sun.intensity=night?.35:3.4;sun.color.set(night?0x8bb8eb:0xffd3a0);sky.material.uniforms.top.value.set(night?'#061126':'#335d80');sky.material.uniforms.horizon.value.set(night?'#394455':'#eab18b');sky.material.uniforms.night.value=night?1:0;scene.fog.color.set(night?0x26374a:0xc7a18d);scene.environmentIntensity=night?.35:1;lamps.forEach(l=>l.intensity=night?16:0);renderer.toneMappingExposure=night?1.1:1.05;bloom.strength=night?.32:.16;$('weatherLabel').textContent=night?'NUIT URBAINE · 22:18':'FIN DE JOURNÉE · 19:42'}
function quality(){const low=$('quality').value==='low';state.quality=$('quality').value;pixelRatio=Math.min(devicePixelRatio,low?1:mobile?1.25:1.7);renderer.setPixelRatio(pixelRatio);composer.setPixelRatio(pixelRatio);renderer.shadowMap.enabled=!low;bloom.enabled=!low}
$('mood').onchange=e=>mood(e.target.value);$('quality').onchange=quality;
function start(){if(!loaded)return;state.playing=true;state.paused=false;$('menu').hidden=true;$('hud').hidden=false;$('pause').hidden=true;state.camYaw=0;toast('Bienvenue à Port Lumière. Rejoignez le repère vert.');}
function pause(on){if(!state.playing)return;state.paused=on;if(on)togglePhone(false);$('pause').hidden=!on;clearInput();save()}
$('play').onclick=start;$('pauseBtn').onclick=()=>pause(!state.paused);$('resume').onclick=()=>pause(false);$('recover').onclick=()=>{recover();pause(false)};$('home').onclick=()=>{togglePhone(false);state.playing=false;state.paused=false;$('pause').hidden=true;$('menu').hidden=false;$('hud').hidden=true;save()};
function clearInput(){drag=null;attackHeld=false;for(const k in keys)keys[k]=false;touch.x=touch.y=0;$('knob').style.transform='translate(0,0)'}
function interact(){
 if(!state.playing||state.paused||phoneOpen||knockoutTime>0)return;
 if(state.driving){
  const car=activeCar,p=car.root.position,h=car.h,speed=state.speed,airborne=p.y>.55,offset=car.kind==='heli'?4:car.kind==='bike'?1.5:2.4;
  const candidates=[];for(const side of [1,-1])for(const extra of [0,1.5,3])candidates.push({x:p.x+Math.cos(h)*side*(offset+extra),z:p.z-Math.sin(h)*side*(offset+extra),side});
  const exitY=airborne?p.y+(car.kind==='heli'?1.2:.4):groundAt(p.x,p.z)+.15;
  const exit=candidates.find(v=>!personBlocked(v.x,v.z,.4,exitY));
  if(!exit){toast('La sortie est bloquée par un obstacle.');return}
  const rolling=airborne||Math.abs(speed)>2;
  player.position.set(exit.x,rolling?exitY:groundAt(exit.x,exit.z),exit.z);player.rotation.set(0,h,0);state.heading=h;state.driving=false;state.speed=0;
  Object.assign(jump,{y:player.position.y,vy:rolling?(airborne?0:1.8):0,grounded:!rolling});
  car.speed=speed;car.coasting=rolling;car.root.rotation.x=car.root.rotation.z=0;
  if(rolling){ejection={vx:Math.sin(h)*speed*.5+Math.cos(h)*exit.side*1.6,vz:Math.cos(h)*speed*.5-Math.sin(h)*exit.side*1.6,impact:Math.abs(speed)*.45,airborne};airClock=0;oneShot=null;toast(airborne?'Vous sautez de l’hélicoptère.':'Sortie en mouvement — préparez la roulade.')}else{ejection=null;oneShot=null;toast('À pied · Espace : sauter · F / clic : action · P : téléphone.')}
  syncPlayerVisibility();
 }else{
  if(!jump.grounded||oneShot?.name==='roll'||oneShot?.name==='exitRoll'){toast('Attendez de terminer la réception.');return}
  const nearest=cars.filter(c=>c.root.position.y<.5&&(!traffic.includes(c)||Math.abs(c.speed)<1)).sort((a,b)=>a.root.position.distanceTo(player.position)-b.root.position.distanceTo(player.position))[0];
  if(nearest&&nearest.root.position.distanceTo(player.position)<(nearest.kind==='heli'?9:5)){
   activeCar=nearest;const ai=traffic.indexOf(nearest);if(ai!==-1)traffic.splice(ai,1);state.driving=true;state.speed=nearest.speed;state.heading=nearest.h;nearest.coasting=false;oneShot=null;ejection=null;syncPlayerVisibility();toast(nearest.kind==='heli'?'Hélicoptère · Espace : monter · Maj : descendre · E / G : sauter dehors.':nearest.type+' · E / G pour sortir, même en mouvement.');
  }else toast('Approchez-vous d’un véhicule à l’arrêt.');
 }
}

function recover(){const p=state.driving?activeCar.root.position:player.position;const road=grid.reduce((a,b)=>Math.abs(b-p.x)<Math.abs(a-p.x)?b:a,grid[0]);p.set(road+4,0,clamp(p.z,-worldLimit+18,worldLimit-18));state.speed=0;Object.assign(jump,{y:groundAt(p.x,p.z),vy:0,grounded:true});player.rotation.x=player.rotation.z=0;if(state.driving){activeCar.h=0;activeCar.root.rotation.y=0;activeCar.speed=0}ejection=null;oneShot=null;knockoutTime=0;if(state.health<=0)state.health=100;activeCar.coasting=false;syncPlayerVisibility();toast('Vous êtes de retour sur la route.')}
function blocked(x,z,r){if(Math.abs(x)>worldLimit||Math.abs(z)>worldLimit)return true;return colliders.some(b=>Math.abs(x-b.x)<b.w+r&&Math.abs(z-b.z)<b.d+r)}
function carBlocked(car,x,z,h){
 if(car.kind==='heli')return aircraftBlocked(x,z,car.root.position.y,7);
 for(const [sx,sz]of(car.kind==='bike'?[[0,0],[0,.95],[0,-.95]]:[[0,0],[.85,1.5],[-.85,1.5],[.85,-1.5],[-.85,-1.5]])){
  const px=x+sx*Math.cos(h)+sz*Math.sin(h),pz=z-sx*Math.sin(h)+sz*Math.cos(h);if(blocked(px,pz,.25)||actorAt(px,pz,.3,0))return true;
 }
 for(const other of cars){if(other===car||other.root.position.y>3)continue;if(Math.hypot(x-other.root.position.x,z-other.root.position.z)<(car.kind==='bike'?1.8:2.7))return true}return false;
}
function staticBlocked(x,z,r,y){return Math.abs(x)>worldLimit-r||Math.abs(z)>worldLimit-r||buildings.some(b=>y<b.h+.85&&Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r)}
function groundAt(x,z){return grid.slice(0,-1).some(a=>x>a+10.5&&x<a+61.5)&&grid.slice(0,-1).some(a=>z>a+10.5&&z<a+61.5)?.3:0}
function actorShape(actor){return {x:actor.root.position.x,z:actor.root.position.z,y:actor.root.position.y,radius:actor.down?.72:actor.radius??.38,height:actor.down?.4:actor.height??1.8}}
function actorAt(x,z,r,y,ignore=null){const capsule={x,z,y,radius:r,height:1.8};return [...peds,...stationaryActors].some(a=>a!==ignore&&capsulesOverlap(capsule,actorShape(a)))}
function vehicleAt(x,z,r,y){return cars.some(c=>{
 const dy=c.root.position.y;if(y>=dy+(c.meta.h||1.6)-.015||y+1.8<dy)return false;
 const dx=x-c.root.position.x,dz=z-c.root.position.z,lx=dx*Math.cos(c.h)-dz*Math.sin(c.h),lz=dx*Math.sin(c.h)+dz*Math.cos(c.h);
 return Math.abs(lx)<(c.meta.w||2)/2+r&&Math.abs(lz)<(c.meta.len||4.5)/2+r;
})}
function playerGround(){
 let floor=groundAt(player.position.x,player.position.z);for(const b of buildings){if(Math.abs(player.position.x-b.x)<b.w/2&&Math.abs(player.position.z-b.z)<b.d/2&&player.position.y>=b.h+.75)floor=Math.max(floor,b.h+.85)}
 for(const c of cars){const dx=player.position.x-c.root.position.x,dz=player.position.z-c.root.position.z,lx=dx*Math.cos(c.h)-dz*Math.sin(c.h),lz=dx*Math.sin(c.h)+dz*Math.cos(c.h),roof=c.root.position.y+(c.meta.h||1.6);if(Math.abs(lx)<(c.meta.w||2)/2&&Math.abs(lz)<(c.meta.len||4.5)/2&&player.position.y>=roof-.06)floor=Math.max(floor,roof)}
 return floor;
}
function personBlocked(x,z,r,y,ignore=null){
 if(staticBlocked(x,z,r,y)||actorAt(x,z,r,y,ignore)||vehicleAt(x,z,r,y))return true;
 return ignore&&!state.driving&&capsulesOverlap({x,z,y,radius:r,height:1.8},{x:player.position.x,z:player.position.z,y:player.position.y,radius:.4,height:1.8});
}
function aircraftBlocked(x,z,y,r){
 if(Math.abs(x)>worldLimit-r||Math.abs(z)>worldLimit-r)return true;
 if(buildings.some(b=>y<b.h+1&&Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r))return true;
 if(y<2&&actorAt(x,z,r,y))return true;
 return cars.some(c=>c!==activeCar&&Math.abs(y-c.root.position.y)<5&&Math.hypot(x-c.root.position.x,z-c.root.position.z)<r+2.5);
}
function requestJump(){if(!state.playing||state.paused||phoneOpen||state.driving||oneShot||knockoutTime>0)return;airClock=0;stepJump(jump,0,playerGround(),true)}
function move(dt){
 if(knockoutTime>0){animatePlayer(dt);return}
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
   for(const part of c.rotors)part.rotation.y+=dt*(c.root.position.y>.1?36:7)
   return;
  }
  let accel=forward>0?(c.kind==='bike'?13:10):forward<0?(state.speed>1?-22:-6):0;state.speed+=accel*dt;state.speed*=Math.exp(-(keys.Space?2.8:forward===0?.35:.045)*dt);state.speed=clamp(state.speed,-9,c.kind==='bike'?48:43);if(Math.abs(state.speed)<.03)state.speed=0;
  const steer=turn*.52/(1+Math.abs(state.speed)*.035),proposedHeading=c.h+state.speed/(c.kind==='bike'?1.8:2.75)*Math.tan(steer)*dt;
  if(!carBlocked(c,c.root.position.x,c.root.position.z,proposedHeading))c.h=proposedHeading;
  c.root.rotation.y=c.h;const distance=state.speed*dt,steps=Math.max(1,Math.ceil(Math.abs(distance)/.2));let hit=false;
  for(let i=0;i<steps;i++){const x=c.root.position.x+Math.sin(c.h)*distance/steps,z=c.root.position.z+Math.cos(c.h)*distance/steps;if(carBlocked(c,x,z,c.h)){hit=true;break}c.root.position.x=x;c.root.position.z=z}
  if(hit){if(Math.abs(state.speed)>6)toast('Passage bloqué — ralentissez.');state.speed*=-.1}c.speed=state.speed;state.heading=c.h;
  for(const w of c.wheels){w.mesh.rotation.x+=state.speed*dt/.33;if(w.front)w.pivot.rotation.y=steer}c.root.rotation.z=THREE.MathUtils.damp(c.root.rotation.z,-steer*state.speed*(c.kind==='bike'?.016:.002),5,dt);
  if(c.kind==='bike'){animateRider(dt,c);syncPlayerVisibility()}
 }else{
  const rolling=oneShot?.name==='roll'||oneShot?.name==='exitRoll';const f=clamp(forward,-1,1),t=clamp(turn,-1,1),len=Math.min(1,Math.hypot(f,t)),pace=rolling?0:len*(keys.ShiftLeft?5.8:2.7)*(oneShot?.name.startsWith('punch')?.4:1);let traveled=0;
  if(len>.03&&!rolling){const view=state.heading+state.camYaw,dx=(Math.sin(view)*f+Math.cos(view)*t)*pace*dt/Math.max(1,Math.hypot(f,t)),dz=(Math.cos(view)*f-Math.sin(view)*t)*pace*dt/Math.max(1,Math.hypot(f,t));traveled=moveWithCollisions(player.position,dx,dz,.4,(x,z,r)=>personBlocked(x,z,r,player.position.y));if(!oneShot)player.rotation.y=weaponId==='fists'?Math.atan2(dx,dz):state.heading+state.camYaw}
  if(ejection){moveWithCollisions(player.position,ejection.vx*dt,ejection.vz*dt,.4,(x,z,r)=>personBlocked(x,z,r,player.position.y));const drag=jump.grounded?2.1:.4;ejection.vx*=Math.exp(-drag*dt);ejection.vz*=Math.exp(-drag*dt)}
  state.speed=traveled/Math.max(dt,.001);const wasAirborne=!jump.grounded,impactSpeed=Math.max(0,-jump.vy);stepJump(jump,dt,playerGround());player.position.y=jump.y;if(!jump.grounded)airClock+=dt;
  if(wasAirborne&&jump.grounded){if(ejection){const damage=clamp(Math.round(ejection.impact+Math.max(0,impactSpeed-5)*1.25),4,55);takeDamage(damage);beginAction(ejection.airborne?'roll':'exitRoll',{rate:1.25,offset:ejection.airborne?.45:0})}else if(impactSpeed>9){takeDamage(Math.min(35,Math.round((impactSpeed-8)*1.5)));beginAction('roll',{rate:1.25,offset:.45})}airClock=0}
  animatePlayer(dt);updateWeaponTransforms();syncPlayerVisibility();
 }
}
function toggleView(){state.view=1-state.view;syncPlayerVisibility();cameraFollow(0,true)}
function syncPlayerVisibility(){if(!player)return;player.visible=state.view!==1&&(!state.driving||activeCar.kind==='bike');if(weaponRoot)weaponRoot.visible=state.view!==1&&!state.driving&&weaponId!=='fists';if(firstPersonWeapon)firstPersonWeapon.visible=state.playing&&state.view===1&&!state.driving&&!phoneOpen&&weaponId!=='fists'}
function cameraFollow(dt,snap=false){
 const p=state.driving?activeCar.root.position:player.position,h=state.heading+state.camYaw,first=state.view===1,heli=state.driving&&activeCar.kind==='heli',armed=!state.driving&&weaponId!=='fists';camera.up.set(0,1,0);
 cameraKick*=Math.exp(-dt*18);const pitch=clamp(state.camPitch-cameraKick,-1.15,1.15),direction=new V(Math.sin(h)*Math.cos(pitch),-Math.sin(pitch),Math.cos(h)*Math.cos(pitch));
 if(first){const eye=state.driving?(heli?2.8:activeCar.kind==='bike'?1.5:1.0):1.64;const forward=state.driving&&heli?4:0;camera.position.set(p.x+Math.sin(h)*forward,p.y+eye,p.z+Math.cos(h)*forward);camera.lookAt(camera.position.clone().addScaledVector(direction,20))}
 else{
  const dist=heli?23:state.driving?8+Math.abs(state.speed)*.06:armed?3.2:4.5,height=heli?9:state.driving?3.8:armed?1.75:2.5;const desired=new V(p.x-Math.sin(h)*dist,p.y+height+(armed?0:state.camPitch*3),p.z-Math.cos(h)*dist);
  for(let k=1;k<=12;k++){const a=k/12,x=THREE.MathUtils.lerp(p.x,desired.x,a),z=THREE.MathUtils.lerp(p.z,desired.z,a);if(staticBlocked(x,z,.2,desired.y)){desired.set(THREE.MathUtils.lerp(p.x,desired.x,Math.max(.15,a-.1)),p.y+height,THREE.MathUtils.lerp(p.z,desired.z,Math.max(.15,a-.1)));break}}
  if(snap)camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-dt*7));if(armed)camera.lookAt(camera.position.clone().addScaledVector(direction,50));else camera.lookAt(p.x+Math.sin(h)*3,p.y+1.2,p.z+Math.cos(h)*3);
 }
 camera.fov=THREE.MathUtils.lerp(camera.fov,first?72:58+Math.abs(state.speed)*.23,snap?1:Math.min(1,dt*3));camera.updateProjectionMatrix();sky.position.copy(camera.position);sun.target.position.copy(p);sun.position.set(p.x-100,95,p.z-160);syncPlayerVisibility();updateWeaponTransforms();
}

function updateTraffic(dt){
 for(const c of traffic){if(c===activeCar)continue;const p=c.root.position,dx=Math.sin(c.h),dz=Math.cos(c.h),ahead=new V(p.x+dx*6,0,p.z+dz*6);let speed=c.speed;
  if(cars.some(o=>o!==c&&o.root.position.distanceTo(ahead)<4)||(!state.driving&&player.position.distanceTo(ahead)<4)||actorAt(ahead.x,ahead.z,1.2,0))speed=0;
  const x=p.x+dx*speed*dt,z=p.z+dz*speed*dt;
  if(!actorAt(x,z,1.2,0)&&!(!state.driving&&Math.hypot(player.position.x-x,player.position.z-z)<2.5)){p.x=x;p.z=z}
  if(p.x>roadWrap)p.x=-roadWrap;if(p.x<-roadWrap)p.x=roadWrap;if(p.z>roadWrap)p.z=-roadWrap;if(p.z<-roadWrap)p.z=roadWrap;for(const w of c.wheels)w.mesh.rotation.x+=speed*dt/.35;
 }
 for(const ped of peds){
  if(ped.enemy){updateEnemy(ped,dt);continue}
  if(ped.down){ped.down-=dt;if(ped.down<=0){if(!personBlocked(ped.root.position.x,ped.root.position.z,.4,ped.root.position.y,ped)){ped.down=0;ped.hp=100;ped.root.rotation.x=0}else ped.down=1}continue}
  const before=ped.root.position.z;moveWithCollisions(ped.root.position,0,ped.dir*ped.speed*dt,.38,(x,z,r)=>personBlocked(x,z,r,ped.root.position.y,ped));
  if(Math.abs(ped.root.position.z-before)<ped.speed*dt*.1||Math.abs(ped.root.position.z)>worldLimit-18){ped.dir*=-1;ped.root.rotation.y=ped.dir>0?0:Math.PI}
  ped.root.position.y=groundAt(ped.root.position.x,ped.root.position.z);if(ped.root.position.distanceTo(state.driving?activeCar.root.position:player.position)<150)animateHuman(ped,Math.abs(ped.root.position.z-before)/dt,dt);if(ped.hit){ped.hit=Math.max(0,ped.hit-dt);ped.root.rotation.x=-Math.sin(ped.hit/.35*Math.PI)*.25}else ped.root.rotation.x=0;
 }for(const m of decor)m.update(dt);
}

const map=$('minimap'),ctx=map.getContext('2d');function drawMap(){const p=state.driving?activeCar.root.position:player.position,t=target(),expanded=document.body.classList.contains('map-expanded'),zoom=expanded?220/(2*(worldLimit+12)):.65;ctx.fillStyle='#15282b';ctx.fillRect(0,0,220,220);const X=x=>110+(x-(expanded?0:p.x))*zoom,Z=z=>110+(z-(expanded?0:p.z))*zoom;ctx.fillStyle='#2c4244';for(const b of buildings)ctx.fillRect(X(b.x-b.w/2),Z(b.z-b.d/2),b.w*zoom,b.d*zoom);ctx.strokeStyle='#66817a';ctx.lineWidth=3;for(const r of grid){ctx.beginPath();ctx.moveTo(X(r),Z(-worldLimit));ctx.lineTo(X(r),Z(worldLimit));ctx.stroke();ctx.beginPath();ctx.moveTo(X(-worldLimit),Z(r));ctx.lineTo(X(worldLimit),Z(r));ctx.stroke()}ctx.fillStyle='#426979';ctx.fillRect(X(coastX),0,220,220);ctx.setLineDash([4,4]);ctx.lineWidth=1.5;ctx.strokeStyle='#cfe599b0';ctx.beginPath();ctx.moveTo(X(p.x),Z(p.z));ctx.lineTo(X(t[0]),Z(t[1]));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d3e49a';const tx=clamp(X(t[0]),9,211),tz=clamp(Z(t[1]),9,211);ctx.beginPath();ctx.arc(tx,tz,5,0,Math.PI*2);ctx.fill();for(const enemy of enemies){if(enemy.down)continue;ctx.fillStyle='#ef7469';ctx.beginPath();ctx.arc(X(enemy.root.position.x),Z(enemy.root.position.z),3,0,Math.PI*2);ctx.fill()}for(const c of cars){ctx.fillStyle=c===activeCar?'#fff5d0':'#94b3a1';ctx.fillRect(X(c.root.position.x)-1.5,Z(c.root.position.z)-1.5,3,3);if(c===lastDelivered){ctx.strokeStyle='#7cdbed';ctx.lineWidth=2;ctx.beginPath();ctx.arc(clamp(X(c.root.position.x),8,212),clamp(Z(c.root.position.z),8,212),6,0,Math.PI*2);ctx.stroke()}}ctx.save();ctx.translate(X(p.x),Z(p.z));ctx.rotate(-state.heading);ctx.fillStyle='#f4f5ed';ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(-5,-5);ctx.lineTo(0,-2);ctx.lineTo(5,-5);ctx.closePath();ctx.fill();ctx.restore()}
let hudTimer=0;function hud(dt){hudTimer+=dt;if(hudTimer<.1)return;hudTimer=0;const p=state.driving?activeCar.root.position:player.position,t=target(),dist=Math.hypot(p.x-t[0],p.z-t[1]);$('distance').textContent=Math.round(dist)+' m';$('mode').textContent=state.driving?activeCar.type:'EXPLORATION À PIED';$('unit').textContent=state.driving?'KM/H':'M/S';$('speed').textContent=String(Math.round(Math.abs(state.speed)*(state.driving?3.6:1))).padStart(3,'0');$('speedbar').style.width=Math.min(100,Math.abs(state.speed)/43*100)+'%';$('district').textContent=p.x>worldLimit-80?'QUAIS DU RIVAGE':p.z<-100?'MAISON NORD':'PORT LUMIÈRE';$('hints').textContent=state.driving?(activeCar.kind==='heli'?'ZQSD · Piloter    Espace / Maj · Monter / descendre    P · Téléphone':'ZQSD · Conduire    Espace · Freiner    E / G · Sortir / sauter    P · Téléphone'):'ZQSD · Marcher    Maj · Courir    Espace · Sauter    F · Frapper / tirer    P · Téléphone';$('weaponStatus').textContent=state.driving?(activeCar.kind==='heli'?'ALTITUDE '+Math.round(activeCar.root.position.y)+' M':'P · TÉLÉPHONE'):(weaponId==='fists'?'POINGS · F POUR FRAPPER':weaponId==='w_ak'?'AK-47 · F POUR TIRER':'PISTOLET · F POUR TIRER');$('crosshair').hidden=state.driving||weaponId==='fists'||phoneOpen;$('healthValue').textContent=Math.round(state.health);const nearby=enemies.filter(e=>!e.down&&e.root.position.distanceTo(p)<50).length;$('enemyStatus').textContent=nearby?nearby+' HOSTILE'+(nearby>1?'S':'')+' À PROXIMITÉ':enemies.filter(e=>!e.down).length+' HOSTILES DANS LA VILLE';$('healthBar').style.width=state.health+'%';$('exitActionLabel').textContent=state.driving?'SORTIR':'VÉHICULE';$('jumpActionLabel').textContent=state.driving?(activeCar.kind==='heli'?'MONTER':'FREIN'):'SAUTER';$('sprintActionLabel').textContent=state.driving&&activeCar.kind==='heli'?'DESCENDRE':'SPRINT';let prompt='';if(dist<8&&p.y<1){if(Math.abs(state.speed)>1.8)prompt='Ralentissez pour le rendez-vous';else{if(!state.stage){state.stage=1;updateMission();toast('Colis récupéré. Direction le point de livraison.')}else{const reward=missions[state.mission].reward;state.bank+=reward;state.mission=(state.mission+1)%missions.length;state.stage=0;updateMission();save();toast('Livraison terminée · + '+reward+' € · Nouveau contrat disponible.')}}}else if(!state.driving&&cars.some(c=>c.root.position.distanceTo(player.position)<5&&!traffic.includes(c)))prompt='E · Monter dans le véhicule';$('prompt').innerHTML=prompt?'<span>'+prompt+'</span>':'';drawMap()}
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
 $('phoneBtn').setAttribute('aria-expanded',String(open));syncPlayerVisibility();if(open){document.body.classList.remove('map-expanded');$('phoneClose').focus()}else if(state.playing)$('phoneBtn').focus();
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
 for(const x of grid)for(let z=-worldLimit+20;z<=worldLimit-20;z+=10)points.push({x:x+(key==='heli'?0:4),z},{x:z,z:x+(key==='heli'?0:4)});
 const spot=findSpawnPoint(origin,points,radius,spawnBlocked);if(!spot)throw new Error('aucun emplacement libre à proximité');
 let car;
 if(key==='nsx')car=makeCar(proto,meta,spot.x,spot.z,0,'HONDA NSX');
 else{
  const root=new THREE.Group(),body=proto.clone(true);root.add(body);const wheels=[];
  if(key==='h2r')for(const name of ['wheelF','wheelR']){const mesh=body.getObjectByName(name);if(!mesh)continue;const pivot=new THREE.Group();pivot.position.copy(mesh.position);mesh.removeFromParent();mesh.position.set(0,0,0);pivot.add(mesh);body.add(pivot);wheels.push({pivot,mesh,front:name==='wheelF'})}
  shadowModel(root);vehiclePaint(root,key==='heli'?0x314654:0x1b3430);root.position.set(spot.x,.035,spot.z);scene.add(root);car={root,wheels,meta,type:label.toUpperCase(),h:0,speed:0,kind:key==='heli'?'heli':'bike',rotors:key==='heli'?['rotor'].map(n=>body.getObjectByName(n)).filter(Boolean):[]};cars.push(car);
 }
 car.delivered=true;lastDelivered=car;const extras=cars.filter(c=>c.delivered&&c!==activeCar&&c!==car);while(extras.length>4){const old=extras.shift();old.root.removeFromParent();cars.splice(cars.indexOf(old),1)}
 const meters=Math.round(Math.hypot(spot.x-origin.x,spot.z-origin.z));$('phoneStatus').textContent=label+' livré à '+meters+' m. Repère bleu sur la carte. Approchez-vous puis appuyez sur E.';toast(label+' livré à '+meters+' m · Repère bleu.');
}
async function equipWeapon(id){
 if(!['fists','w_deagle','w_ak'].includes(id))throw new Error('arme inconnue');let proto;if(id!=='fists')proto=await getModel(id);if(!state.playing)throw new Error('la partie est fermée');
 if(weaponRoot)weaponRoot.removeFromParent();if(firstPersonWeapon)firstPersonWeapon.removeFromParent();weaponRoot=firstPersonWeapon=null;weaponId=id;attackCooldown=0;recoilTime=99;if(oneShot?.name.startsWith('punch'))oneShot=null;
 if(proto){
  state.camPitch=0;const hand=player.getObjectByName('mixamorigRightHand');if(!hand)throw new Error('main du personnage introuvable');weaponRoot=makeHeldWeapon(proto,id);weaponRoot.position.set(.015,.14,.02);hand.add(weaponRoot);shadowModel(weaponRoot);
  firstPersonWeapon=makeHeldWeapon(proto,id);firstPersonWeapon.position.set(id==='w_ak'?.24:.2,-.23,id==='w_ak'?-.68:-.46);firstPersonWeapon.rotation.y=Math.PI;camera.add(firstPersonWeapon);
 }
 const label=id==='fists'?'Poings':id==='w_ak'?'AK-47':'Pistolet';$('phoneStatus').textContent=label+' équipé.';$('equippedName').textContent=label;for(const b of document.querySelectorAll('[data-weapon]'))b.setAttribute('aria-pressed',String(b.dataset.weapon===id));togglePhone(false);syncPlayerVisibility();cameraFollow(0,true);toast(label+' équipé · F / clic gauche / ACTION.');
}
// Action clips are baked from the owner's FBX files into James' bind pose.
// Lower-body locomotion and upper-body aiming use disjoint tracks.
function isUpperTrack(track){return /mixamorig(?:Spine|Neck|Head|LeftShoulder|RightShoulder|LeftArm|RightArm|LeftForeArm|RightForeArm|LeftHand|RightHand)/.test(track.name)}
function initPlayerAnimations(){
 for(const name of ['idle','walk','run']){
  const lower=actions[name].getClip().clone();lower.name=name+'Lower';lower.tracks=lower.tracks.filter(t=>!isUpperTrack(t));actions[name+'Lower']=mixer.clipAction(lower).play().setEffectiveWeight(0);
 }
 for(const [name,json]of Object.entries(playerActionPack.clips)){
  const clip=THREE.AnimationClip.parse(json);for(const track of clip.tracks){if(!player.getObjectByName(track.name.split('.')[0]))throw new Error('Animation '+name+' : os introuvable '+track.name)}
  playerClips[name]=clip;actions[name]=mixer.clipAction(clip).play().setEffectiveWeight(0);actions[name].paused=true;actions[name].setLoop(THREE.LoopOnce,1);actions[name].clampWhenFinished=true;
  if(name==='aim'||name==='fire'){const upper=clip.clone();upper.name=name+'Upper';upper.tracks=upper.tracks.filter(isUpperTrack);actions[upper.name]=mixer.clipAction(upper).play().setEffectiveWeight(0);actions[upper.name].paused=true;actions[upper.name].setLoop(THREE.LoopOnce,1);actions[upper.name].clampWhenFinished=true;playerClips[upper.name]=upper}
 }
}
function beginAction(name,{rate=1,offset=0,contactAt=null}={}){oneShot={name,elapsed:0,rate,offset,duration:(playerClips[name].duration-offset)/rate,contactAt,contactDone:false};}
function animatePlayer(dt){
 animationClock+=dt;recoilTime+=dt;const selection=new Map(),sample=(name,time)=>{selection.set(name,1);const a=actions[name];a.enabled=true;a.paused=true;a.time=clamp(time,0,playerClips[name].duration-.0001)};
 if(oneShot){
  oneShot.elapsed+=dt;sample(oneShot.name,oneShot.offset+oneShot.elapsed*oneShot.rate);
  if(oneShot.contactAt!==null&&!oneShot.contactDone&&oneShot.elapsed>=oneShot.contactAt){oneShot.contactDone=true;applyMeleeHit()}
  if(oneShot.elapsed>=oneShot.duration){const rolled=oneShot.name==='roll'||oneShot.name==='exitRoll';oneShot=null;if(rolled)ejection=null}
 }else if(!jump.grounded){const falling=!!ejection||jump.vy<-.5;sample(falling?'fall':'jump',falling?airClock%playerClips.fall.duration:clamp(airClock/.76,0,.98)*playerClips.jump.duration)}
 else if(weaponId!=='fists'){
  const moving=state.speed>.15,fire=recoilTime<.3,key=fire?'fire':'aim',name=moving?key+'Upper':key;
  sample(name,fire?recoilTime/.3*playerClips.fire.duration:animationClock%playerClips.aim.duration);
  if(moving)selection.set(state.speed>4?'runLower':'walkLower',1);
 }else selection.set(state.speed>4?'run':state.speed>.15?'walk':'idle',1);
 for(const [name,a]of Object.entries(actions)){
  const weight=THREE.MathUtils.damp(animationWeights.get(name)??a.getEffectiveWeight(),selection.get(name)??0,22,dt);animationWeights.set(name,weight);a.enabled=true;a.setEffectiveWeight(weight<.001?0:weight);if(['idle','walk','run','idleLower','walkLower','runLower'].includes(name))a.paused=false;
 }
 mixer.update(dt);
}
function updateWeaponTransforms(){
 if(!weaponRoot)return;player.updateMatrixWorld(true);const hand=player.getObjectByName('mixamorigRightHand'),direction=camera.getWorldDirection(new V());const world=new THREE.Quaternion().setFromUnitVectors(new V(0,0,1),direction);weaponRoot.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
}
function makeHeldWeapon(proto,id){
 const model=proto.clone(true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new V()),length=id==='w_ak'?.8:.25,scale=length/Math.max(size.x,size.y,size.z),center=bounds.getCenter(new V()),holder=new THREE.Group();
 model.position.sub(center).multiplyScalar(scale);model.scale.setScalar(scale);holder.add(model);return holder;
}
function takeDamage(amount,reason='Réception'){
 if(knockoutTime>0)return;state.health=clamp(state.health-amount,0,100);hitFlash=.4;$('damageFlash').style.opacity='.35';toast(reason+' · −'+amount+' points de vie');if(state.health===0){knockoutTime=2.8;clearInput();toast('K.O. · Vous allez être remis sur pied.')}
}
function updateUnoccupiedVehicles(dt){
 for(const c of cars){if(state.driving&&c===activeCar)continue;if(c.kind==='heli')for(const part of c.rotors)part.rotation.y+=dt*(c.coasting?25:4);if(!c.coasting)continue;
  c.speed*=Math.exp(-dt*(c.kind==='heli'?.6:1.25));const dx=Math.sin(c.h)*c.speed*dt,dz=Math.cos(c.h)*c.speed*dt;
  if(c.kind==='heli'){
   const floor=buildings.reduce((v,b)=>c.root.position.y>=b.h+.75&&Math.abs(c.root.position.x-b.x)<b.w/2+7&&Math.abs(c.root.position.z-b.z)<b.d/2+7?Math.max(v,b.h+.85):v,.035);c.fallSpeed=Math.min(8,(c.fallSpeed??0)+3*dt);c.root.position.y=Math.max(floor,c.root.position.y-c.fallSpeed*dt);
   if(!aircraftBlocked(c.root.position.x+dx,c.root.position.z+dz,c.root.position.y,7)){c.root.position.x+=dx;c.root.position.z+=dz}else c.speed=0;if(c.root.position.y<=floor+.01)c.coasting=false;
  }else{if(!carBlocked(c,c.root.position.x+dx,c.root.position.z+dz,c.h)){c.root.position.x+=dx;c.root.position.z+=dz}else c.speed=0;if(Math.abs(c.speed)<.05)c.coasting=false;for(const w of c.wheels)w.mesh.rotation.x+=c.speed*dt/.33}
 }
}

function mergeStaticBoxes(parent){
 for(const child of [...parent.children])if(child.isGroup)mergeStaticBoxes(child);
 const batches=new Map();for(const mesh of [...parent.children])if(mesh.isMesh&&!mesh.isInstancedMesh&&mesh.geometry===cube&&!Array.isArray(mesh.material)){
  const key=mesh.material.uuid+'-'+mesh.castShadow;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(mesh);
 }
 for(const batch of batches.values()){if(batch.length<3)continue;const combined=new THREE.InstancedMesh(cube,batch[0].material,batch.length);combined.castShadow=batch[0].castShadow;combined.receiveShadow=true;for(let i=0;i<batch.length;i++){batch[i].updateMatrix();combined.setMatrixAt(i,batch[i].matrix);parent.remove(batch[i])}combined.instanceMatrix.needsUpdate=true;parent.add(combined)}
}
function createFarCity(){
 for(const chunk of cityChunks)chunk.group.visible=Math.hypot(chunk.x-4,chunk.z-45)<(mobile?205:300);
 farCity=new THREE.InstancedMesh(cube,mat(0x888e89,.9),buildings.length);farCity.castShadow=false;farCity.receiveShadow=false;const matrix=new THREE.Matrix4();for(let i=0;i<buildings.length;i++){const b=buildings[i],scale=b.chunk.visible?0:1;matrix.compose(new V(b.x,b.h/2,b.z),new THREE.Quaternion(),new V(b.w*scale,b.h*scale,b.d*scale));farCity.setMatrixAt(i,matrix)}farCity.instanceMatrix.needsUpdate=true;scene.add(farCity);
}
function updateCityVisibility(dt){
 cityVisibilityTimer+=dt;if(cityVisibilityTimer<.35)return;cityVisibilityTimer=0;const p=state.driving?activeCar.root.position:player.position,detailRadius=mobile?205:300;for(const chunk of cityChunks)chunk.group.visible=Math.hypot(chunk.x-p.x,chunk.z-p.z)<detailRadius;
 const matrix=new THREE.Matrix4();for(let i=0;i<buildings.length;i++){const b=buildings[i],scale=b.chunk.visible?0:1;matrix.compose(new V(b.x,b.h/2,b.z),new THREE.Quaternion(),new V(b.w*scale,b.h*scale,b.d*scale));farCity.setMatrixAt(i,matrix)}farCity.instanceMatrix.needsUpdate=true;
 for(const actor of [...peds,...stationaryActors])actor.root.visible=actor.root.position.distanceTo(p)<(mobile?125:190);
}
function vehiclePaint(root,color){const clones=new Map();root.traverse(o=>{if(!o.isMesh)return;const assign=m=>{if(m.name!=='PAINT')return m;if(!clones.has(m)){const paint=m.clone();paint.color.set(color);paint.roughness=.34;paint.metalness=.45;clones.set(m,paint)}return clones.get(m)};o.material=Array.isArray(o.material)?o.material.map(assign):assign(o.material)})}
function rotateBoneToward(bone,from,to){
 if(from.lengthSq()<1e-8||to.lengthSq()<1e-8)return;const delta=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()),world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.copy(parent.invert().multiply(world)).normalize();bone.updateMatrixWorld(true);
}
function solveTwoBone(upper,lower,end,target,pole){
 player.updateMatrixWorld(true);const a=upper.getWorldPosition(new V()),b=lower.getWorldPosition(new V()),c=end.getWorldPosition(new V()),l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a);const distance=clamp(dir.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001);dir.normalize();let bend=pole.clone().sub(a);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<1e-7)bend=new V(0,0,1).addScaledVector(dir,-dir.z);bend.normalize();const cosine=clamp((l1*l1+distance*distance-l2*l2)/(2*l1*distance),-1,1),desiredB=a.clone().addScaledVector(dir,cosine*l1).addScaledVector(bend,Math.sqrt(1-cosine*cosine)*l1),desiredC=a.clone().addScaledVector(dir,distance);
 rotateBoneToward(upper,b.clone().sub(a),desiredB.clone().sub(a));const nb=lower.getWorldPosition(new V()),nc=end.getWorldPosition(new V());rotateBoneToward(lower,nc.sub(nb),desiredC.sub(nb));
}
const bikeContacts={seat:[0,.94,-.18],leftHand:[.30,1.03,.43],rightHand:[-.30,1.03,.43],leftFoot:[.29,.40,-.38],rightFoot:[-.29,.40,-.38]};
function animateRider(dt,car){
 animationClock+=dt;for(const action of Object.values(actions))action.setEffectiveWeight(0);const action=actions.riding;action.enabled=true;action.paused=true;action.time=animationClock%playerClips.riding.duration;action.setEffectiveWeight(1);mixer.update(0);
 player.position.copy(car.root.position);player.quaternion.copy(car.root.quaternion);const spine=player.getObjectByName('mixamorigSpine');if(spine)spine.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new V(1,0,0),.85));player.updateMatrixWorld(true);car.root.updateMatrixWorld(true);
 const seat=car.root.localToWorld(new V().fromArray(bikeContacts.seat)),hips=player.getObjectByName('mixamorigHips');player.position.add(seat.sub(hips.getWorldPosition(new V())));player.updateMatrixWorld(true);
 for(const side of ['Left','Right']){const sign=side==='Left'?1:-1,key=side.toLowerCase();const hand=car.root.localToWorld(new V().fromArray(bikeContacts[key+'Hand'])),foot=car.root.localToWorld(new V().fromArray(bikeContacts[key+'Foot']));solveTwoBone(player.getObjectByName('mixamorig'+side+'Arm'),player.getObjectByName('mixamorig'+side+'ForeArm'),player.getObjectByName('mixamorig'+side+'Hand'),hand,car.root.localToWorld(new V(sign*.78,.95,.04)));solveTwoBone(player.getObjectByName('mixamorig'+side+'UpLeg'),player.getObjectByName('mixamorig'+side+'Leg'),player.getObjectByName('mixamorig'+side+'Foot'),foot,car.root.localToWorld(new V(sign*.56,.65,.10)))}
}

function prepareActor(actor,hostile=false){
 actor.hitMaterials=[];actor.root.traverse(o=>{if(o.isMesh)for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material.emissive&&!actor.hitMaterials.some(x=>x.material===material))actor.hitMaterials.push({material,color:material.emissive.clone(),intensity:material.emissiveIntensity})});
 actor.ui=new THREE.Group();actor.ui.position.set(0,2.05,0);const bg=new THREE.Mesh(new THREE.PlaneGeometry(.82,.07),new THREE.MeshBasicMaterial({color:0x162328,depthWrite:false}));const bar=new THREE.Mesh(new THREE.PlaneGeometry(.78,.045),new THREE.MeshBasicMaterial({color:hostile?0xe7685b:0xd3e49a,depthWrite:false}));bar.position.z=.005;actor.ui.add(bg,bar);actor.healthBar=bar;
 if(hostile){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.fillStyle='#ef9b8e';g.font='bold 29px sans-serif';g.textAlign='center';g.fillText('HOSTILE',128,45);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));label.position.y=.18;label.scale.set(.9,.225,1);actor.ui.add(label)}actor.ui.visible=hostile;actor.root.add(actor.ui);
}
function initEnemies(proto,weapon){
 const positions=[[11.25,96],[-11.25,126],[83.25,118],[60.75,176],[-132.75,194],[-155.25,-108],[227.25,-180],[299.25,250],[-299.25,300],[-227.25,-284],[155.25,-300],[299.25,-284]];
 for(let i=0;i<positions.length;i++){
  const enemy=human(proto,animData);enemy.enemy=true;enemy.hp=100;enemy.speed=2.6;enemy.dir=1;enemy.home=new V(positions[i][0],.3,positions[i][1]);enemy.root.position.copy(enemy.home);for(let retry=0;retry<15&&personBlocked(enemy.root.position.x,enemy.root.position.z,.4,.3);retry++)enemy.root.position.z+=3;
  enemy.home.copy(enemy.root.position);enemy.shotTimer=1.8+i*.2;enemy.aggroTime=0;enemy.recoil=9;enemy.route=[];enemy.routeTimer=0;enemy.shots=0;
  for(const base of ['walk','run']){const lower=enemy.acts[base].getClip().clone();lower.name='enemy'+i+base+'Lower';lower.tracks=lower.tracks.filter(t=>!isUpperTrack(t));enemy.acts[base+'Lower']=enemy.mix.clipAction(lower).play().setEffectiveWeight(0)}
  for(const name of ['aim','fire']){const clip=THREE.AnimationClip.parse(playerActionPack.clips[name]);clip.name='enemy'+i+name;clip.tracks=clip.tracks.filter(isUpperTrack);enemy.acts[name]=enemy.mix.clipAction(clip).play().setEffectiveWeight(0);enemy.acts[name].paused=true;enemy.acts[name].setLoop(THREE.LoopOnce,1);enemy.acts[name].clampWhenFinished=true}
  prepareActor(enemy,true);enemy.weapon=makeHeldWeapon(weapon,'w_ak');enemy.weapon.position.set(.015,.14,.02);enemy.root.getObjectByName('mixamorigRightHand').add(enemy.weapon);scene.add(enemy.root);peds.push(enemy);enemies.push(enemy);
 }
}
function buildEnemyRoute(enemy,target){
 const near=value=>grid.reduce((best,next)=>Math.abs(next-value)<Math.abs(best-value)?next:best,grid[0]);const start={x:near(enemy.root.position.x),z:near(enemy.root.position.z)},goal={x:near(target.x),z:near(target.z)},route=[start];let x=start.x,z=start.z;while(x!==goal.x){x+=Math.sign(goal.x-x)*72;route.push({x,z})}while(z!==goal.z){z+=Math.sign(goal.z-z)*72;route.push({x,z})}route.push({x:target.x,z:target.z});enemy.route=route;enemy.routeTimer=3;
}
function updateEnemy(enemy,dt){
 if(enemy.down){enemy.down-=dt;if(enemy.down<=0){if(!personBlocked(enemy.root.position.x,enemy.root.position.z,.4,enemy.root.position.y,enemy)){enemy.hp=100;enemy.down=0;enemy.root.rotation.x=0;enemy.shotTimer=2}else enemy.down=1}return}
 const target=state.driving?activeCar.root.position:player.position,p=enemy.root.position,distance=Math.hypot(target.x-p.x,target.z-p.z);enemy.aggroTime=Math.max(0,enemy.aggroTime-dt);if(distance<40&&target.y<7)enemy.aggroTime=8;
 const active=enemy.aggroTime>0;let destination;enemy.routeTimer-=dt;const sight=distance<60&&clearLine(p,target);
 if(active){if(sight)destination=target;else{if(enemy.routeTimer<=0||!enemy.route.length)buildEnemyRoute(enemy,target);while(enemy.route.length>1&&Math.hypot(enemy.route[0].x-p.x,enemy.route[0].z-p.z)<1.5)enemy.route.shift();destination=enemy.route[0]}}
 else destination={x:enemy.home.x,z:enemy.home.z+Math.sin(state.time*.2+enemy.home.x)*7};
 let speed=0;if(destination&&(!active||distance>12||!sight)){const dx=destination.x-p.x,dz=destination.z-p.z,len=Math.hypot(dx,dz);if(len>.3){const before=p.clone();moveWithCollisions(p,dx/len*(active?2.6:.8)*dt,dz/len*(active?2.6:.8)*dt,.38,(x,z,r)=>personBlocked(x,z,r,p.y,enemy));speed=before.distanceTo(p)/Math.max(dt,.001);enemy.root.rotation.y=Math.atan2(dx,dz)}}
 if(active&&sight)enemy.root.rotation.y=Math.atan2(target.x-p.x,target.z-p.z);p.y=groundAt(p.x,p.z);enemy.shotTimer-=dt;enemy.recoil+=dt;
 if(active&&sight&&distance<32&&target.y<5&&enemy.shotTimer<=0&&knockoutTime<=0){
  enemy.shotTimer=2.1+rand()*1.5;enemy.recoil=0;enemy.shots++;const origin=p.clone().add(new V(0,1.4,0)),end=target.clone().add(new V(0,state.driving?1:1.25,0));emitTracer(origin,end,true);playGunshot(.025);if(distance<18||rand()<.5)takeDamage(state.driving?2:4+Math.floor(rand()*3),'Tir ennemi');
 }
 if(distance<150){for(const [name,action]of Object.entries(enemy.acts))action.setEffectiveWeight(name===(active?(speed>.2?'runLower':'idle'):(speed>.2?'walk':'idle'))?1:0);if(active){enemy.acts.idle.setEffectiveWeight(speed>.2?0:1);if(speed<=.2){ // Keep only the lower body of idle under the aiming pose.
    if(!enemy.acts.idleLower){const clip=enemy.acts.idle.getClip().clone();clip.name='idleLower'+enemy.root.uuid;clip.tracks=clip.tracks.filter(t=>!isUpperTrack(t));enemy.acts.idleLower=enemy.mix.clipAction(clip).play()}enemy.acts.idle.setEffectiveWeight(0);enemy.acts.idleLower.setEffectiveWeight(1)
   }const key=enemy.recoil<.3?'fire':'aim',action=enemy.acts[key];action.enabled=true;action.setEffectiveWeight(1);action.time=key==='fire'?enemy.recoil/.3*playerClips.fire.duration:state.time%playerClips.aim.duration;}enemy.mix.update(dt);
  enemy.root.updateMatrixWorld(true);const hand=enemy.root.getObjectByName('mixamorigRightHand'),direction=target.clone().sub(p).setY(0).normalize();if(direction.lengthSq()>0)enemy.weapon.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(new THREE.Quaternion().setFromUnitVectors(new V(0,0,1),direction)));
 }
 if(enemy.hit){enemy.hit=Math.max(0,enemy.hit-dt);enemy.root.rotation.x=-Math.sin(enemy.hit/.35*Math.PI)*.2}else enemy.root.rotation.x=0;
}
function radialTexture(){
 const size=32,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot((x+ .5)/size*2-1,(y+.5)/size*2-1),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(clamp((1-r)*4,0,1)*255)}const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.needsUpdate=true;return texture;
}
let particleTexture=null;const splatterGeometry=new THREE.CircleGeometry(1,10),tracerGeometry=new THREE.CylinderGeometry(1,1,1,6),flashGeometry=new THREE.PlaneGeometry(1,1);let gunNoiseBuffer=null;
function spawnParticles(point,color,count,speed,life,size){
 particleTexture??=radialTexture();const positions=new Float32Array(count*3),velocities=new Float32Array(count*3);for(let i=0;i<count;i++){positions.set(point.toArray(),i*3);velocities.set([(rand()-.5)*speed,rand()*speed*.7,(rand()-.5)*speed],i*3)}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const material=new THREE.PointsMaterial({color,size,map:particleTexture,transparent:true,opacity:.95,depthWrite:false});const root=new THREE.Points(geometry,material);scene.add(root);effects.push({root,life,total:life,ownMaterial:true,update(dt,fx){for(let i=0;i<count;i++){velocities[i*3+1]-=5*dt;positions[i*3]+=velocities[i*3]*dt;positions[i*3+1]+=velocities[i*3+1]*dt;positions[i*3+2]+=velocities[i*3+2]*dt}geometry.attributes.position.needsUpdate=true;material.opacity=Math.max(0,fx.life/fx.total)}});
}
function bloodImpact(actor,point){
 const origin=point?.clone()??actor.root.position.clone().add(new V(0,1.15,0));spawnParticles(origin,0x9e2630,10,1.8,.55,.075);const marks=effects.filter(f=>f.bloodMark);if(marks.length>=18){const oldest=marks[0];oldest.life=0}
 const material=new THREE.MeshBasicMaterial({color:0x691f28,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide}),mark=new THREE.Mesh(splatterGeometry,material);mark.rotation.x=-Math.PI/2;mark.position.set(origin.x+(rand()-.5)*.25,groundAt(origin.x,origin.z)+.012,origin.z+(rand()-.5)*.25);mark.scale.set(.13+rand()*.12,.08+rand()*.12,1);scene.add(mark);effects.push({root:mark,life:10,total:10,bloodMark:true,sharedGeometry:true,ownMaterial:true,update(_dt,fx){material.opacity=.6*Math.min(1,fx.life/3)}});
}
function emitTracer(origin,end,hostile=false){
 const delta=end.clone().sub(origin),length=delta.length();if(length<.01)return;const root=new THREE.Mesh(tracerGeometry,new THREE.MeshBasicMaterial({color:hostile?0xff7653:0xffe6a8,transparent:true,opacity:.9,depthWrite:false}));root.position.copy(origin).addScaledVector(delta,.5);root.scale.set(hostile?.007:.011,length,hostile?.007:.011);root.quaternion.setFromUnitVectors(new V(0,1,0),delta.normalize());scene.add(root);effects.push({root,life:.11,sharedGeometry:true,ownMaterial:true});
}
function muzzleFlash(origin,direction){
 particleTexture??=radialTexture();const material=new THREE.MeshBasicMaterial({map:particleTexture,color:0xffd38a,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),root=new THREE.Mesh(flashGeometry,material);root.position.copy(origin).addScaledVector(direction,.035);root.quaternion.copy(camera.quaternion);const size=(weaponId==='w_deagle'?.38:.28)*(state.view===1?.55:1);root.scale.set(size,size,1);scene.add(root);effects.push({root,life:.09,total:.09,ownMaterial:true,sharedGeometry:true,update(_dt,fx){material.opacity=fx.life/fx.total}});const light=new THREE.PointLight(0xffbd75,5,4,2);light.position.copy(origin);scene.add(light);effects.push({root:light,life:.07,sharedGeometry:true});
}
function playGunshot(volume=.12){
 if(!state.sound||!audioCtx)return;const duration=.1;if(!gunNoiseBuffer){gunNoiseBuffer=audioCtx.createBuffer(1,Math.ceil(audioCtx.sampleRate*duration),audioCtx.sampleRate);const data=gunNoiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*5)}const noise=audioCtx.createBufferSource(),gain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();noise.buffer=gunNoiseBuffer;filter.type='lowpass';filter.frequency.value=weaponId==='w_deagle'?2400:3200;gain.gain.setValueAtTime(volume,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);noise.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);noise.start();noise.onended=()=>{noise.disconnect();gain.disconnect();filter.disconnect()};
}
function updateActorFeedback(dt){
 const p=state.driving?activeCar.root.position:player.position;for(const actor of [...peds,...stationaryActors]){actor.feedback=Math.max(0,(actor.feedback??0)-dt);actor.redFlash=Math.max(0,(actor.redFlash??0)-dt);for(const entry of actor.hitMaterials??[]){entry.material.emissive.copy(entry.color);entry.material.emissiveIntensity=entry.intensity;if(actor.redFlash>0){entry.material.emissive.set(0x9f242b);entry.material.emissiveIntensity=.65}}
  if(actor.ui){actor.ui.visible=!actor.down&&actor.root.position.distanceTo(p)<65&&(actor.enemy||actor.feedback>0);actor.ui.quaternion.copy(actor.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(camera.getWorldQuaternion(new THREE.Quaternion())));const ratio=clamp((actor.hp??100)/100,0,1);actor.healthBar.scale.x=ratio;actor.healthBar.position.x=-.39+.39*ratio}
 }
}

function clearLine(from,to){const distance=from.distanceTo(to),steps=Math.ceil(distance/.25);for(let i=1;i<steps;i++){const t=i/steps;if(blocked(THREE.MathUtils.lerp(from.x,to.x,t),THREE.MathUtils.lerp(from.z,to.z,t),.05))return false}return true}
function damagePed(ped,damage,point=null){
 if(ped.down)return;ped.hp=(ped.hp??100)-damage;ped.hit=.35;ped.feedback=3;ped.redFlash=.18;bloodImpact(ped,point);if(ped.enemy){ped.aggroTime=12;ped.shotTimer=Math.min(ped.shotTimer,.9);for(const ally of enemies)if(ally.root.position.distanceTo(ped.root.position)<40)ally.aggroTime=12}
 if(ped.hp<=0){ped.down=12;ped.root.rotation.x=-Math.PI/2;toast('PNJ à terre.')}else{if(!ped.stationary){ped.dir*=-1;ped.root.rotation.y=ped.dir>0?0:Math.PI}toast('Touché · '+Math.max(0,ped.hp)+' / 100')}
}
function applyMeleeHit(){
 const origin=player.position,targets=[...peds,...stationaryActors].filter(p=>!p.down&&inMeleeRange(origin,player.rotation.y,p.root.position)&&clearLine(origin,p.root.position)).sort((a,b)=>a.root.position.distanceTo(origin)-b.root.position.distanceTo(origin));
 if(targets[0]){damagePed(targets[0],34);showShotFeedback(true)}
}
function castShot(origin,direction,range=140){
 const ray=new THREE.Ray(origin,direction),point=new V(),end=ray.at(range,new V());let nearest=range,hit=null;
 const consider=(d,target)=>{if(d<nearest){nearest=d;hit=target;end.copy(point)}};
 for(const b of buildings){const box=new THREE.Box3(new V(b.x-b.w/2,0,b.z-b.d/2),new V(b.x+b.w/2,b.h+.9,b.z+b.d/2));if(ray.intersectBox(box,point))consider(point.distanceTo(origin),null)}
 for(const car of cars){const box=new THREE.Box3().setFromObject(car.root);if(ray.intersectBox(box,point))consider(point.distanceTo(origin),null)}
 for(const ped of [...peds,...stationaryActors]){if(ped.down)continue;for(const [height,radius]of [[1.05,.48],[1.6,.26]]){const sphere=new THREE.Sphere(ped.root.position.clone().add(new V(0,height,0)),radius);if(ray.intersectSphere(sphere,point))consider(point.distanceTo(origin),ped)}}
 return {point:end,hit,distance:nearest};
}
function showShotFeedback(hit){shotFlash=.18;$('shotIndicator').textContent=hit?'TOUCHÉ':'TIR';$('shotIndicator').style.opacity='1';$('crosshair').classList.toggle('hit',hit)}
function attack(){
 if(!state.playing||state.paused||phoneOpen||state.driving||knockoutTime>0||attackCooldown>0||oneShot)return;
 if(weaponId==='fists'){
  const name=punchSequence++%2?'punch2':'punch',rate=2.1;beginAction(name,{rate,contactAt:(name==='punch'?.467:.45)/rate});attackCooldown=oneShot.duration;return;
 }
 attackCooldown=weaponId==='w_ak'?.13:.3;recoilTime=0;
 scene.updateMatrixWorld(true);const direction=camera.getWorldDirection(new V()).normalize(),aim=castShot(camera.position,direction),holder=state.view===1?firstPersonWeapon:weaponRoot,origin=holder?holder.getWorldPosition(new V()).addScaledVector(direction,weaponId==='w_ak'?.4:.125):player.position.clone().add(new V(0,1.35,0));
 const shot=castShot(origin,aim.point.clone().sub(origin).normalize());player.rotation.y=Math.atan2(direction.x,direction.z);
 if(shot.hit)damagePed(shot.hit,weaponId==='w_ak'?30:50,shot.point);else if(shot.distance<139.9)spawnParticles(shot.point,0xffd09b,5,1.5,.22,.045);showShotFeedback(!!shot.hit);cameraKick=Math.min(.07,cameraKick+(weaponId==='w_deagle'?.035:.013));
 emitTracer(origin,shot.point);muzzleFlash(origin,direction);playGunshot();
}
function updateCombat(dt){
 updateActorFeedback(dt);attackCooldown=Math.max(0,attackCooldown-dt);if((keys.KeyF||attackHeld)&&attackCooldown<=0)attack();
 if(hitFlash>0){hitFlash=Math.max(0,hitFlash-dt);$('damageFlash').style.opacity=String(hitFlash*.8)}
 if(shotFlash>0){shotFlash=Math.max(0,shotFlash-dt);if(!shotFlash){$('shotIndicator').style.opacity='0';$('crosshair').classList.remove('hit')}}
 if(knockoutTime>0){knockoutTime=Math.max(0,knockoutTime-dt);if(!knockoutTime){state.health=100;recover();toast('Vous êtes remis sur pied.')}}
 for(const actor of stationaryActors){if(actor.down){actor.down=Math.max(0,actor.down-dt);if(!actor.down&&!personBlocked(actor.root.position.x,actor.root.position.z,.4,actor.root.position.y,actor)){actor.hp=100;actor.root.rotation.x=0}else if(!actor.down)actor.down=1}}
 for(let i=effects.length-1;i>=0;i--){const fx=effects[i];fx.life-=dt;fx.update?.(dt,fx);if(fx.life<=0){fx.root.removeFromParent();if(!fx.sharedGeometry)fx.root.geometry?.dispose();if(fx.ownMaterial)fx.root.material?.dispose();effects.splice(i,1)}}
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
 if(e.code==='KeyE'||e.code==='KeyG')interact();if(e.code==='KeyF')attack();if(e.code==='Space')requestJump();if(e.code==='KeyC')toggleView();if(e.code==='KeyM')document.body.classList.toggle('map-expanded');
});window.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',()=>{clearInput();if(state.playing)pause(true)});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(state.playing)pause(true)}});
let drag=null;$('world').addEventListener('pointerdown',e=>{if(!state.playing||state.paused||phoneOpen)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId,travel:0,mouse:e.pointerType==='mouse'&&e.button===0};$('world').setPointerCapture(e.pointerId)});$('world').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;state.camYaw-=(e.clientX-drag.x)*.005;state.camPitch=clamp(state.camPitch+(e.clientY-drag.y)*.003,-1.15,1.15);drag.travel+=Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY});$('world').addEventListener('pointerup',()=>{const click=drag?.mouse&&drag.travel<6;drag=null;if(click)attack()});$('world').addEventListener('pointercancel',()=>drag=null);
let stickId=null;const stick=$('stick');function stickMove(e){const r=stick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,n=Math.max(1,Math.hypot(dx,dy)/40);touch.x=dx/n/40;touch.y=dy/n/40;$('knob').style.transform=`translate(${dx/n}px,${dy/n}px)`}stick.onpointerdown=e=>{stickId=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e)};stick.onpointermove=e=>{if(e.pointerId===stickId)stickMove(e)};for(const ev of ['pointerup','pointercancel'])stick.addEventListener(ev,()=>{stickId=null;touch.x=touch.y=0;$('knob').style.transform='translate(0,0)'});
for(const b of document.querySelectorAll('[data-action]')){
 const a=b.dataset.action;if(a==='interact')b.onclick=interact;else if(a==='camera')b.onclick=toggleView;else if(a==='attack'){b.onpointerdown=e=>{if(phoneOpen||state.paused)return;attackHeld=true;attack();b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=()=>attackHeld=false;}else{
  const k=a==='brake'?'Space':'ShiftLeft';b.onpointerdown=e=>{if(phoneOpen||state.paused)return;keys[k]=true;if(a==='brake')requestJump();b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=()=>keys[k]=false;
 }
}

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)});
let last=performance.now(),frames=0,elapsed=0,adaptiveTime=0;function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;state.time+=dt;if(loaded){if(state.playing&&!state.paused&&!phoneOpen){move(dt);updateTraffic(dt);updateUnoccupiedVehicles(dt);cameraFollow(dt);updateCombat(dt);updateCityVisibility(dt);hud(dt)}else if(!state.playing){const a=state.time*.035;camera.position.set(4+Math.sin(a+.65)*17,4.5,45-Math.cos(a+.65)*17);camera.lookAt(activeCar.root.position.x,1.1,activeCar.root.position.z);sky.position.copy(camera.position)}marker.rotation.y+=dt*.2;ring.scale.setScalar(1+Math.sin(state.time*2)*.07);beam.material.opacity=.08+Math.sin(state.time*2)*.035;}if(engineGain){engineGain.gain.setTargetAtTime(state.sound&&state.playing&&!state.paused&&!phoneOpen&&state.driving?.025:0,audioCtx.currentTime,.1);engineOsc.frequency.setTargetAtTime(42+Math.abs(state.speed)*3.5,audioCtx.currentTime,.15)}composer.render();frames++;elapsed+=dt;adaptiveTime+=dt;if(elapsed>3){if(state.quality==='auto'&&state.playing&&frames/elapsed<26&&pixelRatio>.8){pixelRatio=Math.max(.8,pixelRatio-.2);renderer.setPixelRatio(pixelRatio);composer.setPixelRatio(pixelRatio);if(pixelRatio<1)bloom.enabled=false}frames=elapsed=0}}
requestAnimationFrame(frame);init().catch(e=>{console.error(e);$('loadStatus').textContent='Chargement interrompu';fail('Un modèle ou une ressource n’a pas pu être chargé. Vérifiez votre connexion puis réessayez. '+e.message)});
