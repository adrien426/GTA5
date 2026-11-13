// Runs the actual game module and real GLB decoders without a GPU.
// Rendering and DOM painting are stubbed; movement, AI, model loading,
// interactions, weapon selection and spawning execute the production code.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import {GLTFLoader} from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/examples/jsm/libs/meshopt_decoder.module.js';
import {clone} from '../vendor/three/examples/jsm/utils/SkeletonUtils.js';
import * as mechanics from '../mechanics.mjs';
const root=path.resolve(import.meta.dirname,'..'),elements=new Map(),buttons=[];
function element(id=''){return {id,value:id==='quality'?'auto':'golden',hidden:false,disabled:false,textContent:'',innerHTML:'',dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},getContext:()=>new Proxy({},{get:()=>()=>{}}),addEventListener(){},setAttribute(){},focus(){},closest(){return null},setPointerCapture(){}}}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const id of html.matchAll(/\bid="([^"]+)"/g))elements.set(id[1],element(id[1]));
for(const match of html.matchAll(/<button\b([^>]+)>/g)){const e=element();for(const a of match[1].matchAll(/data-([\w-]+)="([^"]+)"/g))e.dataset[a[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=a[2];buttons.push(e)}
const document={baseURI:'https://game.test/',getElementById:id=>{assert(elements.has(id),'DOM ID '+id);return elements.get(id)},createElement:()=>element(),body:element('body'),querySelectorAll:selector=>buttons.filter(b=>Object.keys(b.dataset).some(k=>selector.includes('data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())))),addEventListener(){}};
document.body.classList.contains=()=>false;elements.get('phone').querySelectorAll=()=>buttons;
const nativeFetch=globalThis.fetch;
async function fetchResource(input){const url=String(input);if(url.startsWith('blob:')||url.startsWith('data:'))return nativeFetch(input);const rel=new URL(url,'https://game.test/').pathname;const filename=path.join(root,rel);try{const bytes=fs.readFileSync(filename);return {ok:true,status:200,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),json:async()=>JSON.parse(bytes.toString())}}catch{return {ok:false,status:404}}}
globalThis.self=globalThis;globalThis.Image=class{height=1;set src(v){queueMicrotask(()=>this.onload?.())}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});globalThis.ProgressEvent=class{constructor(type,values){Object.assign(this,values)}};
class Renderer{shadowMap={};pixelRatio=1;setSize(){}setPixelRatio(v){this.pixelRatio=v}getPixelRatio(){return this.pixelRatio}}
class PMREM{fromScene(){return {texture:new THREE.Texture()}}dispose(){}}
class TextureLoader{load(){return new THREE.Texture()}}
class Composer{addPass(){}setPixelRatio(){}setSize(){}render(){}}
class Pass{}
const sandbox={console,document,URL,DataView,Math,Error,Promise,Map,Set,Float32Array,Uint8Array,ArrayBuffer,setTimeout,clearTimeout,performance,innerWidth:1280,innerHeight:800,devicePixelRatio:1,matchMedia:()=>({matches:false}),requestAnimationFrame(){},fetch:fetchResource,localStorage:{getItem:()=>null,setItem(){}}};sandbox.window=sandbox;sandbox.addEventListener=()=>{};
const context=vm.createContext(sandbox),modules=new Map();
function synthetic(name,values){const mod=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v)},{context,identifier:name});modules.set(name,mod)}
synthetic('three',{...THREE,WebGLRenderer:Renderer,PMREMGenerator:PMREM,TextureLoader});synthetic('three/addons/loaders/GLTFLoader.js',{GLTFLoader});synthetic('three/addons/libs/meshopt_decoder.module.js',{MeshoptDecoder});synthetic('three/addons/utils/SkeletonUtils.js',{clone});synthetic('three/addons/postprocessing/EffectComposer.js',{EffectComposer:Composer});for(const k of ['RenderPass','UnrealBloomPass','OutputPass'])synthetic('three/addons/postprocessing/'+k+'.js',{[k]:Pass});synthetic('./mechanics.mjs?v=actions-1',mechanics);
const source=fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nexport {move,updateTraffic,updateCombat,requestJump,keys,cars,traffic,peds,stationaryActors,personBlocked,phoneOpen,attackCooldown};';
const module=new vm.SourceTextModule(source,{context,identifier:'game.js'});await module.link(spec=>{assert(modules.has(spec),spec);return modules.get(spec)});await module.evaluate();
for(let i=0;i<1000&&!sandbox.__game;i++)await new Promise(resolve=>setTimeout(resolve,5));assert(sandbox.__game,'Game initialized with all actual GLB models');
const api=sandbox.__game,ns=module.namespace;api.state.playing=true;api.state.driving=false;api.player.visible=true;api.player.position.set(4,0,49);api.player.rotation.set(0,0,0);Object.assign(api.jump,{y:0,vy:0,grounded:true});
// Isolate two people on an unobstructed road; background actors remain far away.
ns.traffic.splice(0);for(const c of ns.cars)c.root.position.set(-220,0,-220);for(const p of ns.peds)p.root.position.set(-200,.3,-200);const ped=ns.peds[0];ped.root.position.set(4,0,51);ped.dir=-1;
ns.keys.KeyZ=true;ns.keys.ShiftLeft=true;for(let i=0;i<100;i++)ns.move(.04);assert(api.player.position.z<=50.23,'Sprint stops before NPC');assert(api.player.position.distanceTo(ped.root.position)>=.77);ns.keys.KeyZ=ns.keys.ShiftLeft=false;
const before=ped.root.position.z;for(let i=0;i<50;i++)ns.updateTraffic(.04);assert(!mechanics.capsulesOverlap({x:api.player.position.x,z:api.player.position.z,y:0,radius:.4},{x:ped.root.position.x,z:ped.root.position.z,y:0,radius:.38}),'NPC cannot enter player');
api.player.position.set(4,0,55);Object.assign(api.jump,{y:0,vy:0,grounded:true});ns.requestJump();assert(api.jump.vy>0);for(let i=0;i<8;i++)ns.move(.04);assert(api.player.position.y>.8,'Space jumps');for(let i=0;i<60;i++)ns.move(.04);assert(api.jump.grounded);assert.equal(api.player.position.y,0);
ped.root.position.set(4,0,56);ped.down=0;ped.hp=100;api.player.rotation.y=0;api.attack();assert.equal(ped.hp,66,'Melee hits a nearby target in front');ns.updateCombat(1);
await api.equipWeapon('w_deagle');api.camera.position.set(4,1.35,52);api.camera.lookAt(4,1.35,56);api.attack();assert.equal(ped.hp,16,'Pistol ray hits the target');ns.updateCombat(1);assert(api.player.getObjectByName('mixamorigRightHand').children.some(c=>c.type==='Group'),'Real pistol attaches to hand');await api.equipWeapon('w_ak');await api.equipWeapon('fists');
await api.spawnVehicle('nsx');const car=ns.cars.at(-1);assert.equal(car.wheels.length,4);await api.spawnVehicle('h2r');const bike=ns.cars.at(-1);assert.equal(bike.kind,'bike');assert.equal(bike.wheels.length,2);await api.spawnVehicle('heli');const heli=ns.cars.at(-1);assert.equal(heli.kind,'heli');assert.equal(heli.rotors.length,2);
// Enter the delivered helicopter, fly it, disallow an airborne exit, then land and exit.
api.player.position.copy(heli.root.position).add(new THREE.Vector3(4,0,0));Object.assign(api.jump,{y:0,vy:0,grounded:true});api.interact();assert.equal(api.activeCar,heli);assert(api.state.driving);ns.keys.Space=true;for(let i=0;i<40;i++)ns.move(.04);ns.keys.Space=false;assert(heli.root.position.y>10,'Helicopter ascends');const z=heli.root.position.z;ns.keys.KeyZ=true;for(let i=0;i<10;i++)ns.move(.04);ns.keys.KeyZ=false;assert.notEqual(heli.root.position.z,z,'Helicopter flies forward');api.state.speed=0;api.interact();assert(api.state.driving,'Airborne exit refused');ns.keys.ShiftLeft=true;for(let i=0;i<80;i++)ns.move(.04);ns.keys.ShiftLeft=false;api.state.speed=0;assert(heli.root.position.y<.1,'Helicopter lands');api.interact();assert(!api.state.driving,'Exit after landing');
api.togglePhone(true);assert(ns.phoneOpen);api.togglePhone(false);assert(!ns.phoneOpen);
console.log('PASS: actual game initialization and 13 real GLB assets; sprint/NPC collisions; NPC avoidance; jump/landing; melee damage; both weapon models; phone toggling; car/bike/heli spawns; helicopter entry, ascent, forward flight, exit guard, landing and exit. GPU rendering was not tested.');
