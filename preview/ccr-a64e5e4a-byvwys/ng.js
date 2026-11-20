/* =====================================================================================
   Néo Cité — moteur de rendu « nouvelle génération »
   - ciel atmosphérique : dégradé de diffusion, halo du soleil, ceinture de Vénus au crépuscule,
     nuages procéduraux éclairés par le soleil (liseré argenté, dessous orangé au couchant),
     cirrus, étoiles scintillantes, lune, pollution lumineuse de la ville la nuit
   - brume aérienne : brouillard exponentiel en altitude + diffusion vers le soleil (perspective atmosphérique)
   - océan : houle (6 trains de vagues + détail), Fresnel, reflet du ciel et des nuages, chemin de soleil,
     lagon turquoise près des côtes, écume sur le rivage
   - reflets PBR : environnement PMREM du ciel (carrosseries vernies, vitres des tours, routes mouillées)
   - post-traitement HDR : rendu MSAA flottant, bloom à mip-maps, rayons crépusculaires, reflets d'objectif,
     tonemapping ACES, étalonnage « Floride au couchant », vignette, grain
   Chargé AVANT le script principal : les fonctions ci-dessous utilisent ses variables globales
   (scene, renderer, camera, sun, hemi…) seulement au moment où elles sont appelées.
   ===================================================================================== */
'use strict';
(function(){
const NG=window.NG={ready:false,t:0};
const isTouch=('ontouchstart' in window)||matchMedia('(pointer:coarse)').matches;

/* ---------- uniformes partagés (le même objet est référencé par tous les matériaux du ciel / de l'eau) ---------- */
const U=NG.U={
  uSunDir:{value:new THREE.Vector3(0,1,0)},uMoonDir:{value:new THREE.Vector3(0,1,0)},
  uZen:{value:new THREE.Color()},uHor:{value:new THREE.Color()},uGlow:{value:new THREE.Color()},uBelt:{value:new THREE.Color()},uSunC:{value:new THREE.Color()},
  uP:{value:new THREE.Vector4()},   // x temps, y couverture nuageuse, z nuit, w crépuscule
  uQ:{value:new THREE.Vector4()},   // x éclair, y visibilité du soleil, z étoiles, w lune
};
// uniformes de brume injectés dans TOUS les matériaux three.js : objets simples (non clonés par three) => partagés
const FV={sun:{x:0,y:1,z:0},glow:{x:0,y:0,z:0},mie:{x:0,y:0,z:0},p:{x:.0008,y:1/150,z:1}};
function addFogU(u){u.ngSun={value:FV.sun};u.ngGlow={value:FV.glow};u.ngMie={value:FV.mie};u.ngFogP={value:FV.p};}
addFogU(THREE.UniformsLib.fog);
for(const k in THREE.ShaderLib){const s=THREE.ShaderLib[k];if(s&&s.uniforms&&s.uniforms.fogColor)addFogU(s.uniforms);}

/* ---------- brume aérienne : remplace le brouillard linéaire de three.js ---------- */
{const C=THREE.ShaderChunk;
C.fog_pars_vertex='#ifdef USE_FOG\n\tvarying float fogDepth;\n\tvarying vec3 vFogView;\n#endif';
C.fog_vertex='#ifdef USE_FOG\n\tfogDepth = - mvPosition.z;\n\tvFogView = mvPosition.xyz;\n#endif';
C.fog_pars_fragment=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float fogDepth;
	varying vec3 vFogView;
	uniform vec3 ngSun;
	uniform vec3 ngGlow;
	uniform vec3 ngMie;
	uniform vec3 ngFogP;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`;
C.fog_fragment=`#ifdef USE_FOG
	vec3 ngRd = ( vec4( vFogView, 0.0 ) * viewMatrix ).xyz;
	float ngD = length( ngRd );
	vec3 ngDir = ngRd / max( ngD, 1e-4 );
	float ngK = ngFogP.y * ngRd.y;
	float ngOD = ngFogP.x * exp( - ngFogP.y * max( cameraPosition.y, 0.0 ) ) * ngD * ( abs( ngK ) > 1e-3 ? ( 1.0 - exp( - ngK ) ) / ngK : 1.0 );
	float fogFactor = 1.0 - exp( - ngOD );
	#ifdef FOG_EXP2
		fogFactor = max( fogFactor, 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth ) );
	#else
		fogFactor = max( fogFactor, smoothstep( fogNear, fogFar, fogDepth ) );
	#endif
	float ngMu = dot( ngDir, ngSun );
	float ngM = max( ngMu, 0.0 );
	vec3 ngFc = fogColor + ngGlow * pow( ngMu * 0.5 + 0.5, 4.0 ) + ngMie * ( pow( ngM, 8.0 ) * 0.1 + pow( ngM, 64.0 ) * 0.25 );
	#if defined( TONE_MAPPING )
		ngFc = toneMapping( ngFc );
	#endif
	ngFc = linearToOutputTexel( vec4( ngFc, 1.0 ) ).rgb;
	gl_FragColor.rgb = mix( gl_FragColor.rgb, ngFc, clamp( fogFactor * ngFogP.z, 0.0, 1.0 ) );
#endif`;}

/* ---------- ciel : fonction GLSL commune (dôme, reflets de l'océan, carte d'environnement) ---------- */
const SKY_GLSL=`
uniform vec3 uSunDir;uniform vec3 uMoonDir;uniform vec3 uZen;uniform vec3 uHor;uniform vec3 uGlow;uniform vec3 uBelt;uniform vec3 uSunC;uniform vec4 uP;uniform vec4 uQ;
float ngH(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float ngN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(ngH(i),ngH(i+vec2(1.0,0.0)),f.x),mix(ngH(i+vec2(0.0,1.0)),ngH(i+vec2(1.0,1.0)),f.x),f.y);}
float ngF(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=a*ngN(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=0.5;}return s;}
float ngF3(vec2 p){float s=0.0,a=0.5;for(int i=0;i<3;i++){s+=a*ngN(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=0.5;}return s*1.1428;}
vec3 ngSkyBase(vec3 d){
  float y=max(d.y,0.0),mu=dot(d,uSunDir),m=max(mu,0.0);
  vec3 c=mix(uZen,uHor,pow(1.0-y,5.0));
  c+=uGlow*pow(mu*0.5+0.5,4.0)*pow(1.0-y,3.0);
  c+=uBelt*clamp(-mu,0.0,1.0)*smoothstep(0.0,0.07,y)*smoothstep(0.34,0.05,y);
  c+=uSunC*(pow(m,8.0)*0.1+pow(m,64.0)*0.25+pow(m,900.0)*1.4);
  return c;
}
vec3 ngSky(vec3 d,float q){
  vec3 c=ngSkyBase(d);
  float y=d.y,mu=dot(d,uSunDir),m=max(mu,0.0),occ=0.0;
  if(y>0.0){
    if(q>0.5){
      vec2 uv=d.xz/(y+0.1)*2.0;
      vec2 w=vec2(uP.x*0.012,uP.x*0.005);
      vec2 p=uv+w;
      float cov=uP.y,th=mix(0.66,0.30,cov);
      float n=q>1.5?ngF(p+0.55*vec2(ngF3(p*0.5+3.1),ngF3(p*0.5-1.7))):ngF3(p+0.3);
      float den=smoothstep(th,th+0.28,n);
      float sh=q>1.5?smoothstep(th-0.05,th+0.45,ngF3(p+uSunDir.xz*0.22)):den*0.6;
      vec3 amb=mix(uZen,uHor,0.5)*0.8+uGlow*0.16+vec3(0.05,0.03,0.018)*uP.z;
      vec3 lit=amb+uSunC*(1.0-sh*0.8)*0.6+uSunC*pow(m,5.0)*(1.0-den)*1.5;
      lit*=mix(1.0,0.45,cov*cov);
      float fd=smoothstep(0.0,0.16,y);
      float ci=smoothstep(0.6,0.98,ngF3(uv*vec2(0.5,1.3)*0.9+w*2.0))*0.22*(1.0-cov)*fd;
      c=mix(c,lit*1.1,ci);
      den*=fd;c=mix(c,lit,den*0.96);occ=den;
    }
    c+=uSunC*smoothstep(0.99962,0.99978,mu)*16.0*uQ.y*(1.0-occ);
    if(uQ.z>0.001){vec3 sd=d*170.0;vec3 ci=floor(sd);vec3 cf=fract(sd)-0.5;float hs=fract(sin(dot(ci,vec3(12.9898,78.233,37.719)))*43758.5453);
      float st=step(0.9962,hs)*smoothstep(0.32,0.0,length(cf))*(0.55+0.45*sin(uP.x*2.7+hs*91.0));
      c+=vec3(0.85,0.9,1.0)*st*uQ.z*(1.0-occ)*smoothstep(0.0,0.2,y)*(1.5+6.0*fract(hs*37.0));}
    if(uQ.w>0.001){float mm=dot(d,uMoonDir);float md=smoothstep(0.99935,0.9995,mm);float mt=0.78+0.22*ngN(d.xz*260.0+d.y*130.0);
      c+=vec3(0.95,0.95,1.0)*md*mt*uQ.w*3.0*(1.0-occ*0.85)+vec3(0.25,0.3,0.45)*pow(max(mm,0.0),180.0)*uQ.w*0.6;}
  }
  c+=vec3(uQ.x);
  return c;
}`;
NG.SKY_GLSL=SKY_GLSL;
function skyMat(q,cube){return new THREE.ShaderMaterial({uniforms:Object.assign({},U,{uQual:{value:q}}),side:THREE.BackSide,depthWrite:false,depthTest:!cube,fog:false,
  vertexShader:'varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);p.z=p.w*0.99999;gl_Position=p;}',
  fragmentShader:SKY_GLSL+'\nuniform float uQual;varying vec3 vDir;void main(){vec3 d=normalize(vDir);gl_FragColor=vec4(ngSky(d,uQual),0.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'});}
NG.skyMaterial=()=>skyMat(isTouch?1:2,false);

/* ---------- couleurs du ciel selon la hauteur du soleil (valeurs linéaires HDR) ---------- */
// e = sinus de la hauteur du soleil ; zénith, horizon, lueur côté soleil, ceinture de Vénus
const KF=[
  [-0.40,[.0014,.0022,.0065],[.008,.008,.015],[0,0,0],[0,0,0]],
  [-0.16,[.003,.006,.022],[.022,.02,.045],[.015,.006,.006],[0,0,0]],
  [-0.07,[.008,.016,.065],[.11,.055,.13],[.26,.06,.04],[.035,.012,.04]],
  [ 0.00,[.030,.060,.20],[.55,.20,.16],[1.3,.32,.07],[.20,.06,.15]],
  [ 0.08,[.05,.12,.38],[.60,.34,.23],[.80,.26,.06],[.07,.025,.05]],
  [ 0.25,[.07,.20,.62],[.66,.72,.84],[.26,.17,.08],[0,0,0]],
  [ 0.60,[.05,.18,.66],[.52,.66,.86],[.09,.07,.04],[0,0,0]],
  [ 1.00,[.04,.17,.64],[.50,.64,.85],[.07,.06,.04],[0,0,0]]];
// couleur et intensité du soleil (pour le ciel)
const SKF=[[-0.06,[0,0,0]],[0.0,[2.0,.5,.12]],[0.08,[2.1,1.0,.38]],[0.25,[2.2,1.75,1.2]],[0.6,[2.2,2.05,1.85]],[1.0,[2.2,2.1,1.95]]];
const EXP=[[-0.4,1.85],[-0.12,1.6],[-0.04,1.35],[0.0,1.1],[0.08,.94],[0.25,.96],[1.0,.95]];
function kf(tab,e,i){if(e<=tab[0][0])return tab[0][i];for(let k=1;k<tab.length;k++){const a=tab[k-1],b=tab[k];if(e<=b[0]){const t=(e-a[0])/(b[0]-a[0]),s=t*t*(3-2*t);
  if(typeof a[i]==='number')return a[i]+(b[i]-a[i])*s;return [a[i][0]+(b[i][0]-a[i][0])*s,a[i][1]+(b[i][1]-a[i][1])*s,a[i][2]+(b[i][2]-a[i][2])*s];}}return tab[tab.length-1][i];}
const _c=new THREE.Color(),_g=new THREE.Color(),_v=new THREE.Vector3(),_v2=new THREE.Vector3();
const W={cloud:0,fog:0,rain:0,flash:0};
NG.state={e:1,exp:1,night:0,sunVis:1};
NG.weather=function(c,flash){W.cloud=c.cloud;W.fog=c.fog;W.rain=c.rain;W.flash=flash>0?1:0;};

NG.updateSky=function(dt,P){
  dayT=(dayT+dt*24/DAYLEN)%24;NG.t+=dt;
  const a=(dayT-6)/12*Math.PI,S=_v.set(Math.cos(a)*.6,Math.sin(a),.45).normalize(),e=S.y;
  const dayF=smooth(-.1,.25,e);nightF=1-dayF;
  const dusk=Math.max(0,1-Math.abs(e)*4)*(dayT>12?1:.75),night=smooth(-.03,-.16,e);
  const cl=W.cloud,cov=.22+.78*cl,grey=cl*.72;
  U.uSunDir.value.copy(S);
  const M=U.uMoonDir.value.set(-S.x,Math.abs(S.y)*.9+.25,S.z*.4-.3).normalize();
  // couleurs du ciel, ternies par les nuages
  const set=(col,arr,k)=>{col.setRGB(arr[0],arr[1],arr[2]);if(grey>0){const l=(arr[0]*.3+arr[1]*.55+arr[2]*.15)*k;col.lerp(_g.setRGB(l,l,l*1.05),grey);}return col;};
  const zen=set(U.uZen.value,kf(KF,e,1),.75),hor=set(U.uHor.value,kf(KF,e,2),.85);
  U.uGlow.value.fromArray(kf(KF,e,3)).multiplyScalar(1-cl*.85);U.uBelt.value.fromArray(kf(KF,e,4)).multiplyScalar(1-cl);
  // pollution lumineuse orangée de la ville à l'horizon la nuit
  hor.r+=.022*night;hor.g+=.012*night;hor.b+=.006*night;
  const sc=kf(SKF,e,1),sunVis=1-smooth(.45,.92,cl);U.uSunC.value.setRGB(sc[0],sc[1],sc[2]).multiplyScalar(.25+.75*sunVis);
  U.uP.value.set(NG.t,cov,night,dusk);U.uQ.value.set(W.flash?.55:0,sunVis*smooth(-.03,.0,e),night*(1-cl),night*(1-cl*.7));
  // brume : couleur, densité, diffusion vers le soleil
  FV.sun.x=S.x;FV.sun.y=S.y;FV.sun.z=S.z;
  const gl=U.uGlow.value,sC=U.uSunC.value;FV.glow.x=gl.r;FV.glow.y=gl.g;FV.glow.z=gl.b;FV.mie.x=sC.r*sunVis;FV.mie.y=sC.g*sunVis;FV.mie.z=sC.b*sunVis;
  FV.p.x=(.00068+.0005*dusk-.0002*night)*(1+cl*.8+W.fog*3+W.rain*.8);FV.p.y=1/150;
  scene.fog.color.copy(hor);scene.background.copy(hor);
  scene.fog.near=lerp(450,25,W.fog);scene.fog.far=lerp(2100,220,W.fog);
  // soleil (ombres) ou lune
  const useMoon=e<-.035;
  if(!useMoon){_v2.copy(S);if(_v2.y<.16){_v2.y=.16;_v2.normalize();}
    sun.color.setRGB(sc[0],sc[1],sc[2]);const mx=Math.max(sun.color.r,sun.color.g,sun.color.b,1e-3);sun.color.multiplyScalar(1/mx);
    sun.intensity=kf([[-0.035,0],[0,.55],[0.08,1.15],[0.25,1.45],[0.6,1.6]],e,1)*(1-cl*.68);}
  else{_v2.copy(M);if(_v2.y<.3){_v2.y=.3;_v2.normalize();}sun.color.setRGB(.55,.68,1);sun.intensity=.2*night*(1-cl*.6);}
  sun.position.set(P.x+_v2.x*160,_v2.y*160,P.z+_v2.z*160);sun.target.position.set(P.x,0,P.z);
  // lumière d'ambiance (ciel / sol)
  _c.copy(zen).lerp(hor,.55);const al=Math.max(_c.r,_c.g,_c.b,1e-4);
  hemi.color.copy(_c).multiplyScalar(1/al).lerp(_g.setRGB(1,1,1),.5).lerp(_g.setRGB(.45,.56,1),night);
  hemi.groundColor.setRGB(.42,.36,.29).lerp(_g.setRGB(.25,.22,.2),night);
  hemi.intensity=Math.min(.95,al*.95)+.07+cl*.12*dayF;
  if(W.flash){sun.intensity+=1.4;hemi.intensity+=.5;}
  // exposition (appliquée au tonemapping)
  const ex=kf(EXP,e,1)*(1+cl*.12);NG.state.exp=ex;NG.state.e=e;NG.state.night=night;NG.state.sunVis=sunVis*smooth(-.03,.02,e);NG.state.dusk=dusk;
  if(!(POST.on&&NG.pp))renderer.toneMappingExposure=ex*1.05;
  if(typeof sky!=='undefined')sky.position.copy(camera.position);
  // éclairages artificiels (HDR : les fenêtres, lampadaires et phares « brillent » réellement)
  const em=smooth(.25,.75,nightF);
  for(const m of SHOPM)m.emissiveIntensity=em*1.3;for(const m of adMats)m.emissiveIntensity=.2+em*1.4;
  for(const m of FACM)m.emissiveIntensity=em*1.5;for(const m of NEON)if(m)m.emissiveIntensity=.35+em*3.6;if(POOL)POOL.color.setRGB(1,.72,.45).multiplyScalar(em*.28);if(BEAM)BEAM.color.setRGB(1,.93,.78).multiplyScalar(em*.45);
  MAT.lamp.emissiveIntensity=em*4.5;CARM.head.emissiveIntensity=.2+em*3;CARM.tail.emissiveIntensity=.3+em*1.6;
  MAT.ceil.emissiveIntensity=.5+em*.3;
  headSpot.intensity=player.car&&!player.car.dead?em*2.6:0;
  updateEnv(dt);updateWaters(dt);
};

/* ---------- carte d'environnement PMREM du ciel (reflets des matériaux PBR) ---------- */
const ENV={gen:null,scene:null,rt:null,t:0,sun:new THREE.Vector3(),cl:-1};
function updateEnv(dt){if(!NG.ready||!ENV.gen)return;ENV.t-=dt;
  const dd=ENV.sun.distanceToSquared(U.uSunDir.value),moved=dd>.0027||Math.abs(ENV.cl-W.cloud)>.08,jump=dd>.06||Math.abs(ENV.cl-W.cloud)>.3;
  if(ENV.t>0&&!jump&&!(moved&&ENV.t<8))return;ENV.t=12;ENV.sun.copy(U.uSunDir.value);ENV.cl=W.cloud;
  try{const rt=ENV.gen.fromScene(ENV.scene,0,.1,100);if(ENV.rt)ENV.rt.dispose();ENV.rt=rt;scene.environment=rt.texture;}catch(e){ENV.gen=null;}}

/* ---------- ambiance « Floride » : néons des toits (allumés la nuit) ---------- */
NG.hash=(x,z)=>{const v=Math.sin(x*12.9898+z*78.233)*43758.5453;return v-Math.floor(v);};
const NEON=NG.neon=[];
const NEONC=['#ff2d95','#19e6ff','#a63dff','#ff7a1a'];
NG.neonMat=i=>NEON[i]||(NEON[i]=new THREE.MeshLambertMaterial({color:new THREE.Color(NEONC[i]).multiplyScalar(.35),emissive:NEONC[i],emissiveIntensity:.3}));

// halo de lumière au sol sous les lampadaires (additif, visible seulement la nuit)
let POOL=null;
NG.poolMat=()=>{if(POOL)return POOL;const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);
  r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.55)');r.addColorStop(.7,'rgba(255,255,255,.14)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c);POOL=new THREE.MeshBasicMaterial({map:t,color:0x000000,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-2});return POOL;};

// faisceau des phares sur la route (voitures qui roulent, la nuit)
let BEAM=null;
NG.carBeam=function(c){if(c.beam!==undefined)return c.beam;const T=c.T;if(T.fly||T.boat||T.custom||T.tank){c.beam=null;return null;}
  if(!BEAM){const cv=document.createElement('canvas');cv.width=64;cv.height=128;const g=cv.getContext('2d');g.translate(32,128);g.scale(1,2);
    const r=g.createRadialGradient(0,0,0,0,0,64);r.addColorStop(0,'rgba(255,255,255,.9)');r.addColorStop(.45,'rgba(255,255,255,.4)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(-32,-64,64,64);
    BEAM=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),color:0x000000,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-2});}
  const L=T.len||4.4,w=T.moto?2.6:4.4,g=new THREE.PlaneGeometry(w,10);g.rotateX(-Math.PI/2);g.translate(0,.08,L/2+4.4);
  const m=new THREE.Mesh(g,BEAM);m.renderOrder=3;m.visible=false;c.group.add(m);c.beam=m;return m;};

/* ---------- matériaux PBR ---------- */
// peinture de carrosserie : métallisée avec vernis (clearcoat) qui reflète le ciel
NG.paint=c=>new THREE.MeshPhysicalMaterial({color:new THREE.Color(c).convertSRGBToLinear(),metalness:.35,roughness:.42,clearcoat:1,clearcoatRoughness:.05,side:THREE.DoubleSide,envMapIntensity:1.15});
NG.carGlass=()=>new THREE.MeshPhysicalMaterial({color:0x1d2a33,metalness:.1,roughness:.04,transparent:true,opacity:.6,depthWrite:false,envMapIntensity:1.8});

/* ---------- océan ---------- */
const WATER_GLSL=`
uniform float uTime;uniform vec4 uLand;uniform vec3 uCirc[6];uniform vec3 uLight;uniform float uLake;uniform float uRefl;
varying vec3 vWorld;
float shoreDist(vec2 p){
  vec2 q=max(vec2(uLand.x-p.x,p.x-uLand.y),0.0),r=max(vec2(uLand.z-p.y,p.y-uLand.w),0.0);
  float d=length(vec2(max(q.x,q.y),max(r.x,r.y)));
  if(p.x>uLand.x&&p.x<uLand.y&&p.y>uLand.z&&p.y<uLand.w)d=0.0;
  for(int i=0;i<6;i++){float c=length(p-uCirc[i].xy)-uCirc[i].z;d=min(d,max(c,0.0));}
  return d;
}
vec2 wv(vec2 p,vec2 D,float k,float A,float t){float w=sqrt(9.8*k);return D*(A*k*cos(dot(D,p)*k-w*t));}
void main(){
  vec3 V=cameraPosition-vWorld;float dist=length(V);V/=dist;
  vec2 p=vWorld.xz;float t=uTime;
  float fz=1.0-smoothstep(150.0,900.0,dist);
  vec2 g=wv(p,vec2(.83,.56),.06,.35,t)+wv(p,vec2(-.6,.8),.11,.18,t)+wv(p,vec2(.3,-.95),.23,.08,t)
    +(wv(p,vec2(.97,-.24),.47,.035,t)+wv(p,vec2(-.9,-.43),.9,.016,t)+wv(p,vec2(.5,.86),1.7,.008,t))*(.35+.65*fz);
  if(uLake>0.5)g*=0.35;
  float e=0.35;vec2 np=p*0.35+vec2(t*0.25,t*0.17);
  float n0=ngN(np),nx=ngN(np+vec2(e,0.0)),ny=ngN(np+vec2(0.0,e));
  vec2 np2=p*1.1-vec2(t*0.31,t*0.12);
  float m0=ngN(np2),mx=ngN(np2+vec2(e,0.0)),my=ngN(np2+vec2(0.0,e));
  g+=(vec2(nx-n0,ny-n0)*0.12+vec2(mx-m0,my-m0)*0.07)*fz;
  vec3 N=normalize(vec3(-g.x,1.0,-g.y));
  float NV=max(dot(N,V),0.0);
  float F=min(0.02+0.98*pow(1.0-NV,5.0),0.62);
  vec3 R=reflect(-V,N);R.y=abs(R.y)+0.01;R=normalize(R);
  vec3 sky=ngSky(R,uRefl);
  // couleur de l'eau : bleu profond au large, turquoise près des côtes
  float sd=uLake>0.5?40.0:shoreDist(p);
  float sh=exp(-sd/55.0);
  vec3 deep=vec3(0.006,0.042,0.078),shal=vec3(0.02,0.30,0.30);
  if(uLake>0.5){deep=vec3(0.01,0.045,0.04);shal=deep;}
  vec3 body=mix(deep,shal,sh)*uLight;
  // diffusion sous-marine dans les crêtes face au soleil
  body+=vec3(0.0,0.06,0.05)*uLight*max(dot(V,-uSunDir),0.0)*clamp(g.x*4.0+0.3,0.0,1.0);
  vec3 col=mix(body,sky,F);
  // reflet du soleil (chemin de lumière scintillant)
  vec3 H=normalize(uSunDir+V);float nh=max(dot(N,H),0.0);
  col+=uSunC*uQ.y*(pow(nh,900.0)*9.0+pow(nh,120.0)*0.6)*(0.4+0.6*fz);
  // écume du rivage
  float fo=0.0;
  if(uLake<0.5){fo=smoothstep(7.0,0.0,sd)*(0.55+0.45*sin(sd*1.4-t*1.7+ngN(p*0.3)*5.0));
    fo+=smoothstep(0.72,0.95,ngN(p*0.08+t*0.03))*0.18*fz*uP.y;}
  col=mix(col,uLight*0.85,clamp(fo,0.0,1.0)*0.85);
  gl_FragColor=vec4(col,mix(0.86,0.985,F));
`;
function waterMat(lake){
  const u=Object.assign({},U,THREE.UniformsUtils.clone(THREE.UniformsLib.fog),{uTime:{value:0},uLand:{value:new THREE.Vector4(-1778,2928,-1678,2528)},
    uCirc:{value:[0,1,2,3,4,5].map(()=>new THREE.Vector3(0,0,-1e5))},uLight:{value:new THREE.Color(1,1,1)},uLake:{value:lake?1:0},uRefl:{value:isTouch?0:1}});
  addFogU(u);
  const m=new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,fog:true,
    vertexShader:'varying vec3 vWorld;\n#include <fog_pars_vertex>\nvoid main(){vec4 wp=modelMatrix*vec4(position,1.0);vWorld=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader:SKY_GLSL+'\n#include <fog_pars_fragment>\n'+WATER_GLSL+'\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n#include <fog_fragment>\n}'});
  NG.waters.push(m);return m;}
NG.waters=[];
NG.oceanMat=()=>waterMat(false);NG.lakeMat=()=>waterMat(true);
function updateWaters(dt){if(!NG.waters.length)return;
  const s=U.uSunC.value,k=Math.max(0,U.uSunDir.value.y)*.55*NG.state.sunVis,h=hemi.color,hi=hemi.intensity*.9;
  for(const m of NG.waters){m.uniforms.uTime.value=NG.t*1.0;m.uniforms.uLight.value.setRGB(s.r*k*.45+h.r*hi,s.g*k*.45+h.g*hi,s.b*k*.45+h.b*hi);}}
NG.setShores=function(land,sandW,circles){for(const m of NG.waters){const u=m.uniforms;u.uLand.value.set(land.x0-sandW,land.x1+sandW,land.z0-sandW,land.z1+sandW);
  circles.slice(0,6).forEach((c,i)=>u.uCirc.value[i].set(c.x,c.z,c.r));}};

/* ---------- post-traitement HDR ---------- */
const VQ='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
function qmat(fs,u,add){return new THREE.ShaderMaterial({uniforms:u,vertexShader:VQ,fragmentShader:fs,depthTest:false,depthWrite:false,toneMapped:false,
  blending:add?THREE.AdditiveBlending:THREE.NoBlending,transparent:!!add});}
NG.pp=null;
function ppCreate(){
  const gl=renderer.getContext(),gl2=renderer.capabilities.isWebGL2;
  const ok=gl2?gl.getExtension('EXT_color_buffer_float')||gl.getExtension('EXT_color_buffer_half_float'):(gl.getExtension('OES_texture_half_float')&&gl.getExtension('EXT_color_buffer_half_float'));
  if(!ok)return null;
  const P={},o={format:THREE.RGBAFormat,type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false};
  // depth + stencil => 24-bit depth (three r128 uses a 16-bit depth buffer otherwise: z-fighting beyond a few dozen metres)
  const od=Object.assign({},o,{depthBuffer:true,stencilBuffer:true});
  P.rt=gl2&&THREE.WebGLMultisampleRenderTarget?new THREE.WebGLMultisampleRenderTarget(4,4,od):new THREE.WebGLRenderTarget(4,4,od);
  P.ms=!!P.rt.isWebGLMultisampleRenderTarget;
  P.mips=[];for(let i=0;i<6;i++)P.mips.push(new THREE.WebGLRenderTarget(4,4,o));
  P.sA=new THREE.WebGLRenderTarget(4,4,o);P.sB=new THREE.WebGLRenderTarget(4,4,o);
  P.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);P.scene=new THREE.Scene();P.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));P.quad.frustumCulled=false;P.scene.add(P.quad);
  // 13 échantillons (Jimenez 2014) + seuil doux au premier niveau
  P.down=qmat(`uniform sampler2D tSrc;uniform vec2 uTx;uniform vec4 uTh;varying vec2 vUv;
    vec3 s(vec2 o){return texture2D(tSrc,vUv+o*uTx).rgb;}
    void main(){vec3 a=s(vec2(-2,2)),b=s(vec2(0,2)),c=s(vec2(2,2)),d=s(vec2(-2,0)),e=s(vec2(0,0)),f=s(vec2(2,0)),g=s(vec2(-2,-2)),h=s(vec2(0,-2)),i=s(vec2(2,-2)),j=s(vec2(-1,1)),k=s(vec2(1,1)),l=s(vec2(-1,-1)),m=s(vec2(1,-1));
      vec3 col=e*0.125+(a+c+g+i)*0.03125+(b+d+f+h)*0.0625+(j+k+l+m)*0.125;
      if(uTh.z>0.5){col=min(col,vec3(60.0));float br=max(col.r,max(col.g,col.b));float rq=clamp(br-uTh.x+uTh.y,0.0,2.0*uTh.y);rq=rq*rq/(4.0*uTh.y+1e-4);col*=max(rq,br-uTh.x)/max(br,1e-4);}
      gl_FragColor=vec4(col,1.0);}`,{tSrc:{value:null},uTx:{value:new THREE.Vector2()},uTh:{value:new THREE.Vector4(1.4,.7,0,0)}});
  P.up=qmat(`uniform sampler2D tSrc;uniform vec2 uTx;uniform float uK;varying vec2 vUv;
    void main(){vec4 d=uTx.xyxy*vec4(1.0,1.0,-1.0,0.0);
      vec3 s=texture2D(tSrc,vUv-d.xy).rgb+texture2D(tSrc,vUv-d.wy).rgb*2.0+texture2D(tSrc,vUv-d.zy).rgb
        +texture2D(tSrc,vUv+d.zw).rgb*2.0+texture2D(tSrc,vUv).rgb*4.0+texture2D(tSrc,vUv+d.xw).rgb*2.0
        +texture2D(tSrc,vUv+d.zy).rgb+texture2D(tSrc,vUv+d.wy).rgb*2.0+texture2D(tSrc,vUv+d.xy).rgb;
      gl_FragColor=vec4(s*(uK/16.0),1.0);}`,{tSrc:{value:null},uTx:{value:new THREE.Vector2()},uK:{value:1}},true);
  // rayons crépusculaires : masque du ciel (alpha = 0) autour du soleil, puis flou radial vers le soleil
  P.mask=qmat(`uniform sampler2D tSrc;uniform vec2 uSun;uniform float uAsp;varying vec2 vUv;
    void main(){vec4 c=texture2D(tSrc,vUv);float sky=1.0-clamp(c.a,0.0,1.0);vec2 d=(vUv-uSun)*vec2(uAsp,1.0);
      float l=dot(c.rgb,vec3(0.3,0.55,0.15));float m=sky*smoothstep(2.0,9.0,l)*pow(clamp(1.0-length(d)*2.2,0.0,1.0),2.0);
      gl_FragColor=vec4(m,m,m,1.0);}`,{tSrc:{value:null},uSun:{value:new THREE.Vector2()},uAsp:{value:1}});
  P.rad=qmat(`uniform sampler2D tSrc;uniform vec2 uSun;uniform float uLen;varying vec2 vUv;
    void main(){vec2 dl=(uSun-vUv)*uLen/24.0;vec2 uv=vUv;float acc=0.0,dec=1.0,wt=0.0;
      for(int i=0;i<24;i++){acc+=texture2D(tSrc,uv).r*dec;wt+=dec;dec*=0.965;uv+=dl;}
      float r=acc/wt;gl_FragColor=vec4(r,r,r,1.0);}`,{tSrc:{value:null},uSun:{value:new THREE.Vector2()},uLen:{value:1}});
  P.fin=qmat(`uniform sampler2D tScene;uniform sampler2D tBloom;uniform sampler2D tShaft;
    uniform vec4 uF;uniform vec3 uShC;uniform vec2 uSun;uniform vec4 uG;uniform vec4 uL;uniform vec2 uRes;uniform float uMB;varying vec2 vUv;
    vec3 ngRRT(vec3 v){vec3 a=v*(v+0.0245786)-0.000090537;vec3 b=v*(0.983729*v+0.4329510)+0.238081;return a/b;}
    vec3 ngACES(vec3 c){const mat3 I=mat3(0.59719,0.07600,0.02840,0.35458,0.90834,0.13383,0.04823,0.01566,0.83777);
      const mat3 O=mat3(1.60475,-0.10208,-0.00327,-0.53108,1.10813,-0.07276,-0.07367,-0.00605,1.07602);return clamp(O*ngRRT(I*c),0.0,1.0);}
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uF.w)*43758.5453);}
    float disc(vec2 p,vec2 c,float r){return smoothstep(r,r*0.6,length((p-c)*vec2(uRes.x/uRes.y,1.0)));}
    void main(){vec2 uv=vUv,dc=uv-0.5;float r2=dot(dc,dc);vec2 ca=dc*r2*uG.w;
      vec3 col=vec3(texture2D(tScene,uv+ca).r,texture2D(tScene,uv).g,texture2D(tScene,uv-ca).b);
      // flou de vitesse radial (voiture rapide)
      if(uMB>0.001){vec2 dv=dc*uMB*smoothstep(0.02,0.25,r2);for(int i=1;i<7;i++)col+=texture2D(tScene,uv-dv*float(i)).rgb;col/=7.0;}
      col+=texture2D(tBloom,uv).rgb*uF.y;
      float sh=texture2D(tShaft,uv).r;col+=uShC*sh*uF.z;
      // reflets d'objectif : fantômes le long de l'axe soleil -> centre + traînée anamorphique
      if(uL.x>0.001){vec2 ax=vec2(0.5)-uSun;float vis=uL.x*clamp(texture2D(tShaft,uSun).r*3.0,0.0,1.0);
        vec3 fl=vec3(0.0);
        fl+=vec3(1.0,0.6,0.3)*disc(uv,uSun+ax*0.55,0.03)*0.06;
        fl+=vec3(0.4,0.9,0.6)*disc(uv,uSun+ax*1.25,0.06)*0.035;
        fl+=vec3(0.45,0.55,1.0)*disc(uv,uSun+ax*1.6,0.11)*0.03;
        fl+=vec3(1.0,0.5,0.7)*disc(uv,uSun+ax*2.1,0.02)*0.05;
        vec2 dd=(uv-uSun)*vec2(uRes.x/uRes.y,1.0);fl+=vec3(0.55,0.7,1.0)*exp(-abs(dd.y)*160.0)*exp(-abs(dd.x)*2.6)*0.35;
        col+=fl*vis*uShC*0.6;}
      col*=uF.x/0.6;
      col=ngACES(col);
      // étalonnage : ombres légèrement bleutées, hautes lumières chaudes, saturation et contraste
      float l=dot(col,vec3(0.2126,0.7152,0.0722));
      col+=vec3(-0.012,0.002,0.022)*(1.0-l)*(1.0-l)*uL.y;
      col*=mix(vec3(1.0),vec3(1.05,1.0,0.93),l*uL.y);
      col=mix(vec3(l),col,uG.x);
      col=clamp(col,0.0,1.0);col=mix(col,col*col*(3.0-2.0*col),uG.y);
      col*=1.0-r2*uG.z;
      col=LinearTosRGB(vec4(col,1.0)).rgb;
      col+=(hash(uv*uRes)-0.5)*uL.z;
      gl_FragColor=vec4(col,1.0);}`,
    {tScene:{value:null},tBloom:{value:null},tShaft:{value:null},uF:{value:new THREE.Vector4(1,.1,0,0)},uShC:{value:new THREE.Color()},uSun:{value:new THREE.Vector2(.5,.5)},
     uG:{value:new THREE.Vector4(1.12,.22,.5,.012)},uL:{value:new THREE.Vector4(0,1,.02,0)},uRes:{value:new THREE.Vector2(1,1)},uMB:{value:0}});
  return P;}
function ppSize(){const P=NG.pp;if(!P)return;const pr=renderer.getPixelRatio(),w=Math.max(4,Math.floor(innerWidth*pr)),h=Math.max(4,Math.floor(innerHeight*pr));
  if(P.ms)P.rt.samples=w*h>2600000?2:4;
  P.rt.setSize(w,h);let mw=w,mh=h;for(const m of P.mips){mw=Math.max(2,mw>>1);mh=Math.max(2,mh>>1);m.setSize(mw,mh);}
  P.sA.setSize(Math.max(2,w>>2),Math.max(2,h>>2));P.sB.setSize(Math.max(2,w>>2),Math.max(2,h>>2));P.w=w;P.h=h;}
function pass(m,target,clear){const P=NG.pp;P.quad.material=m;renderer.setRenderTarget(target);if(clear!==false)renderer.clear(true,false,false);renderer.render(P.scene,P.cam);}
const _sp=new THREE.Vector3(),_cf=new THREE.Vector3();
NG.render=function(){
  const P=NG.pp;
  if(!(POST.on&&P)){renderer.render(scene,camera);return;}
  const ac=renderer.autoClear;
  renderer.setRenderTarget(P.rt);renderer.autoClear=true;renderer.render(scene,camera);renderer.autoClear=false;
  const st=NG.state,night=st.night,wet=W.rain;
  // bloom
  let src=P.rt;P.down.uniforms.uTh.value.set(night>.5?1.1:2.2,.8,1,0);
  for(let i=0;i<P.mips.length;i++){const m=P.mips[i];P.down.uniforms.tSrc.value=src.texture;P.down.uniforms.uTx.value.set(1/(i?P.mips[i-1].width:P.w),1/(i?P.mips[i-1].height:P.h));
    pass(P.down,m);if(i===0)P.down.uniforms.uTh.value.z=0;src=m;}
  for(let i=P.mips.length-2;i>=0;i--){const lo=P.mips[i+1];P.up.uniforms.tSrc.value=lo.texture;P.up.uniforms.uTx.value.set(1/lo.width,1/lo.height);P.up.uniforms.uK.value=.85;pass(P.up,P.mips[i],false);}
  // rayons de soleil
  let shaft=0;camera.getWorldDirection(_cf);const sd=U.uSunDir.value,facing=_cf.dot(sd);
  _sp.copy(camera.position).addScaledVector(sd,1000).project(camera);const sx=_sp.x*.5+.5,sy=_sp.y*.5+.5;
  if(facing>.05&&st.sunVis>.02){shaft=st.sunVis*smooth(.05,.45,facing)*(.35+.65*Math.min(1,st.dusk*1.6+.25));
    P.mask.uniforms.tSrc.value=P.rt.texture;P.mask.uniforms.uSun.value.set(sx,sy);P.mask.uniforms.uAsp.value=P.w/P.h;pass(P.mask,P.sA);
    P.rad.uniforms.uSun.value.set(sx,sy);P.rad.uniforms.tSrc.value=P.sA.texture;P.rad.uniforms.uLen.value=.95;pass(P.rad,P.sB);
    P.rad.uniforms.tSrc.value=P.sB.texture;P.rad.uniforms.uLen.value=.35;pass(P.rad,P.sA);}
  else{renderer.setRenderTarget(P.sA);renderer.setClearColor(0x000000,1);renderer.clear(true,false,false);}
  const f=P.fin.uniforms;f.tScene.value=P.rt.texture;f.tBloom.value=P.mips[0].texture;f.tShaft.value=P.sA.texture;
  f.uF.value.set(st.exp,(.022+night*.09+wet*.04)*(NG.boost||1),shaft*.22,(NG.t*7)%100);
  f.uShC.value.copy(U.uSunC.value).multiplyScalar(.5);f.uSun.value.set(sx,sy);f.uRes.value.set(P.w,P.h);
  f.uL.value.set(shaft>0&&sx>-.2&&sx<1.2&&sy>-.2&&sy<1.2?shaft:0,1-night*.6,isTouch?0:.018,0);
  f.uG.value.set(1.1+st.dusk*.08-night*.05,.2,.45,.010);
  {const c=typeof player!=='undefined'&&player.car;const v=c&&!c.T.fly?Math.hypot(c.vx||0,c.vz||0):0;f.uMB.value=(typeof cam!=='undefined'&&cam.fp?.5:1)*smooth(24,75,v)*.02;}
  pass(P.fin,null);
  renderer.autoClear=ac;
};

/* ---------- activation / désactivation (G, qualité adaptative) ---------- */
function retone(){const t=POST.on&&NG.pp?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;if(renderer.toneMapping===t)return;renderer.toneMapping=t;
  scene.traverse(o=>{const m=o.material;if(!m)return;if(Array.isArray(m))m.forEach(x=>x.needsUpdate=true);else m.needsUpdate=true;});}
// les cibles HDR ne sont allouées qu'à l'activation (téléphones : désactivé par défaut, économise la mémoire)
function ensurePP(){if(NG.pp||NG.ppFail)return;try{NG.pp=ppCreate();}catch(e){console.warn('Post-traitement indisponible',e);NG.pp=null;}
  if(NG.pp){ppSize();addEventListener('resize',ppSize);}else NG.ppFail=true;POST.comp=NG.pp?{}:null;}
NG.setPost=function(on){POST.on=!!on;if(POST.on)ensurePP();retone();};
NG.size=ppSize;
NG.initPost=function(){if(POST.on)ensurePP();retone();};

/* ---------- initialisation (après la génération du monde) ---------- */
NG.init=function(){
  try{ENV.gen=new THREE.PMREMGenerator(renderer);ENV.scene=new THREE.Scene();const m=new THREE.Mesh(new THREE.SphereGeometry(50,32,16),skyMat(1,true));m.frustumCulled=false;ENV.scene.add(m);}catch(e){ENV.gen=null;}
  // ombres plus fines sur ordinateur
  if(!isTouch){sun.shadow.mapSize.set(3072,3072);const s=sun.shadow.camera;s.left=-75;s.right=75;s.top=75;s.bottom=-75;s.updateProjectionMatrix();if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
  NG.ready=true;ENV.t=0;
};
})();
