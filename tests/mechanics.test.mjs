import assert from 'node:assert/strict';
import {capsulesOverlap,moveWithCollisions,stepJump,inMeleeRange,findSpawnPoint} from '../mechanics.mjs';
// A sprint, including a long frame, cannot tunnel through another person's capsule.
const npc={x:0,z:2,y:0,radius:.38,height:1.8};
for(const dt of [1/144,1/30,.04,1]){const player={x:0,z:0,y:0,radius:.4,height:1.8};for(let t=0;t<2;t+=dt)moveWithCollisions(player,0,5.8*dt,.4,(x,z,r)=>capsulesOverlap({...player,x,z,radius:r},npc));assert(!capsulesOverlap(player,npc));assert(player.z<1.23)}
// The same rule stops an approaching NPC from entering a stationary player.
const player={x:0,z:0,y:0,radius:.4};const moving={x:0,z:2,y:0,radius:.38};for(let i=0;i<120;i++)moveWithCollisions(moving,0,-.03,.38,(x,z,r)=>capsulesOverlap({...moving,x,z,radius:r},player));assert(!capsulesOverlap(player,moving));
// Wall sliding still works when one axis is blocked.
const slide={x:0,z:0};moveWithCollisions(slide,2,2,.4,(x)=>x>.6);assert(slide.x<=.6);assert(slide.z>1.99);
// A jump takes off, cannot be retriggered midair, and lands at the sidewalk height.
const jump={y:.3,vy:0,grounded:true};stepJump(jump,0,.3,true);assert(!jump.grounded);assert(jump.vy>0);stepJump(jump,1/60,.3);assert(jump.y>.3);const vy=jump.vy;stepJump(jump,1/60,.3,true);assert(jump.vy<vy);for(let i=0;i<120;i++)stepJump(jump,1/60,.3);assert(jump.grounded);assert.equal(jump.y,.3);
assert(inMeleeRange({x:0,z:0},0,{x:0,z:1}));assert(!inMeleeRange({x:0,z:0},0,{x:0,z:-1}));assert(!inMeleeRange({x:0,z:0},0,{x:0,z:3}));
const spawn=findSpawnPoint({x:0,z:0},[{x:0,z:1},{x:0,z:8},{x:8,z:0}],3,(x,z)=>z===8);assert.deepEqual(spawn,{x:8,z:0});assert.equal(findSpawnPoint({x:0,z:0},[{x:0,z:8}],3,()=>true),null);
console.log('PASS: player/NPC collision in both directions, sprint tunneling, wall sliding, jump/landing, melee cone and unobstructed vehicle spawns.');
