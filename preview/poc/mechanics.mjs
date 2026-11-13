// CPU-only gameplay primitives, shared by the game and regression checks.
export function capsulesOverlap(a,b){
 const ah=a.height??1.8,bh=b.height??1.8,ay=a.y??0,by=b.y??0;
 return ay<by+bh&&by<ay+ah&&Math.hypot(a.x-b.x,a.z-b.z)<a.radius+b.radius-1e-6;
}
export function moveWithCollisions(position,dx,dz,radius,isBlocked){
 const startX=position.x,startZ=position.z;
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/Math.min(.16,radius*.45)));
 for(let i=0;i<steps;i++){
  const x=position.x+dx/steps;if(!isBlocked(x,position.z,radius))position.x=x;
  const z=position.z+dz/steps;if(!isBlocked(position.x,z,radius))position.z=z;
 }
 return Math.hypot(position.x-startX,position.z-startZ);
}
export function stepJump(jump,dt,ground,jumpPressed=false){
 if(jumpPressed&&jump.grounded){jump.vy=6.4;jump.grounded=false}
 if(!jump.grounded){jump.vy-=17*dt;jump.y+=jump.vy*dt}
 if(jump.y<=ground&&jump.vy<=0){jump.y=ground;jump.vy=0;jump.grounded=true}
 else if(jump.grounded){jump.grounded=false;jump.vy=0}
 return jump;
}
export function inMeleeRange(origin,heading,target,reach=1.75){
 const dx=target.x-origin.x,dz=target.z-origin.z,d=Math.hypot(dx,dz);
 return d<=reach&&Math.abs((target.y??0)-(origin.y??0))<1.3&&(d<.15||(Math.sin(heading)*dx+Math.cos(heading)*dz)/d>.35);
}
export function findSpawnPoint(origin,candidates,radius,isBlocked){
 return candidates.filter(p=>Math.hypot(p.x-origin.x,p.z-origin.z)>radius+2&&!isBlocked(p.x,p.z,radius))
 .sort((a,b)=>Math.hypot(a.x-origin.x,a.z-origin.z)-Math.hypot(b.x-origin.x,b.z-origin.z))[0]??null;
}
