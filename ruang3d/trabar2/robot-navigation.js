import * as THREE from 'three';

// World-space tread centers measured from Suspended Staircase, not a ramp
// guessed from the room bounds. Coordinates are [x,z,height,stair corridor].
export const STAIR_POINTS=[[-12,-4.12,0,true],
 ...[[-3.522,.122],[-3.118,.298],[-2.714,.474],[-2.309,.652],[-1.905,.829],[-1.498,1.004],[-1.086,1.18],[-.683,1.357],[-.282,1.535],[.126,1.711],[.534,1.886]].map(([z,y])=>[-12,z,y,true]),
 [-12,1.55,2.056,true],[-9.95,1.55,2.056,true],
 ...[[.741,2.231],[.335,2.407],[-.069,2.585],[-.473,2.762],[-.88,2.939],[-1.289,3.113],[-1.697,3.29],[-2.10,3.467],[-2.505,3.644],[-2.914,3.821],[-3.315,3.995]].map(([z,y])=>[-9.95,z,y,true]),
 [-9.95,-3.93,4.166,true],[-10.9,-4.32,4.166,true],[-11.8,-4.45,4.166,true],
];
const vec=p=>new THREE.Vector3(p[0],p[2]||0,p[1]);

export class StairRoute {
 constructor(nav,office,stations){
  this.nav=nav;this.mesh=office.getObjectByName('Suspended_Staircase')||office.getObjectByName('Suspended Staircase');
  if(!this.mesh)office.traverse(o=>{if(o.userData.objectId==='stair-394')this.mesh=o;});
  this.owner=null;this.queue=[];this.delay=32;this.next=0;
  stations.upstairs={label:'Lantai atas · kantor tangga',activity:'Meninjau pasar dari lantai atas',kind:'review',position:[-11.8,-4.45,4.166],look:[-11.7,-5.8],duration:14};
  this.station=stations.upstairs;
 }
 project(start){
  const p=vec(start);let best={distance:Infinity,index:0,point:STAIR_POINTS[0]};
  for(let i=1;i<STAIR_POINTS.length;i++){
   const a=vec(STAIR_POINTS[i-1]),b=vec(STAIR_POINTS[i]),d=b.clone().sub(a);
   const t=THREE.MathUtils.clamp(p.clone().sub(a).dot(d)/d.lengthSq(),0,1),q=a.addScaledVector(d,t),distance=q.distanceToSquared(p);
   if(distance<best.distance)best={distance,index:i-1,point:[q.x,q.z,q.y,true]};
  }return best;
 }
 path(start,end,groundPath){
  const up=(end[2]||0)>1,above=(start[2]||0)>.025;
  if(!up&&!above)return groundPath(start,end);
  if(above){
   const p=this.project(start);
   if(up)return [start,p.point,...STAIR_POINTS.slice(p.index+1)];
   const down=[start,p.point,...STAIR_POINTS.slice(0,p.index+1).reverse()];
   return down.concat(groundPath(STAIR_POINTS[0],end).slice(1));
  }
  return groundPath(start,STAIR_POINTS[0]).concat(STAIR_POINTS);
 }
 request(npc){
  if(!npc||this.owner===npc||this.queue.includes(npc))return false;
  this.queue.push(npc);return true;
 }
 tick(dt,npcs,dancing){
  if(!dt)return;
  this.queue=this.queue.filter(n=>npcs.includes(n));
  if(this.owner&&!npcs.includes(this.owner))this.release(this.owner);
  if(this.owner){
   const n=this.owner;
   if(!dancing&&!n.joget&&!n.moving&&n.station===this.station&&n.dwell>this.station.duration){n.excursion='return';n.pulang();}
   else if((n.excursion==='return'||n.excursion==='dance-return')&&n.group.position.y<.04&&!n.moving)this.release(n);
   return;
  }
  if(dancing)return;
  this.delay-=dt;
  const candidate=this.queue[0]||(this.delay<=0?npcs[this.next%npcs.length]:null);
  if(!candidate||candidate.moving||candidate.wave>0)return;
  if(this.mesh?.userData.deleted){this.delay=15;return;}
  if(this.queue[0]===candidate)this.queue.shift();
  this.owner=candidate;this.next=(candidate.index+1)%npcs.length;candidate.excursion='upstairs';
  candidate.station=this.station;candidate.path=candidate.planRoute(this.station.position);candidate.pathIndex=1;
  candidate.moving=candidate.path.length>1;candidate.dwell=0;candidate.aturUlangKemajuan();candidate.play('03_Walk_In_Place');
 }
 release(npc){if(this.owner===npc)this.owner=null;npc.excursion=null;this.delay=24;}
}

const MIN_DISTANCE=.76;
export function clearOfRobots(npc,x,z,others,y=npc.group.position.y){
 const p=npc.group.position;
 return others.every(other=>{
  if(other===npc||Math.abs(other.group.position.y-y)>.60)return true;
  const q=other.group.position,current=Math.hypot(p.x-q.x,p.z-q.z);
  return Math.hypot(x-q.x,z-q.z)>=Math.min(MIN_DISTANCE,current-.000001);
 });
}
// Every candidate is checked before committing a step. Waiting never disables
// collision checks; opposite traffic naturally passes on each robot's right.
export function moveInTraffic(npc,dx,dz,distance,dt,nav,others){
 const p=npc.group.position,maxStep=Math.min(distance,.68*dt),ux=dx/distance,uz=dz/distance;
 const valid=(x,z)=>npc.bolehDi(x,z);
 let best=null,bestScore=-Infinity;
 for(const angle of [0,.38,-.38,.76,-.76,1.18,-1.18,1.65,-1.65,2.12,-2.12]){
  const c=Math.cos(angle),s=Math.sin(angle),vx=ux*c+uz*s,vz=uz*c-ux*s;
  const x=p.x+vx*maxStep,z=p.z+vz*maxStep;
  if(valid(p.x,p.z)){if(!valid(x,z)||!valid(p.x+vx*.14,p.z+vz*.14))continue;}
  else if(npc.keluarKe){const k=npc.keluarKe;if(Math.hypot(x-k[0],z-k[1])>Math.hypot(p.x-k[0],p.z-k[1]))continue;}
  let safe=true,penalty=0;
  for(const other of others){
   if(other===npc||Math.abs(other.group.position.y-p.y)>.6)continue;
   const q=other.group.position,current=Math.hypot(p.x-q.x,p.z-q.z),next=Math.hypot(x-q.x,z-q.z);
   if(next<Math.min(MIN_DISTANCE,current-.000001)){safe=false;break;}
   if(current>2)continue;
   // Predict a short horizon to start turning before the hard clearance.
   const horizon=Math.min(.48,distance),ox=other.velocity?.x||0,oz=other.velocity?.z||0;
   const ahead=Math.hypot(p.x+vx*horizon-q.x-ox*.30,p.z+vz*horizon-q.z-oz*.30);
   penalty+=Math.max(0,.84-ahead)*4.5;
  }
  if(!safe)continue;
  const score=Math.cos(angle)-penalty+(angle>0?.055:0)-Math.abs(angle)*.012;
  if(score>bestScore){bestScore=score;best={x,z,vx,vz};}
 }
 if(!best){npc.velocity={x:0,z:0};return null;}
 npc.velocity={x:(best.x-p.x)/Math.max(dt,.0001),z:(best.z-p.z)/Math.max(dt,.0001)};
 p.x=best.x;p.z=best.z;return Math.atan2(best.vx,best.vz);
}

export function walkStairSegment(npc,target,dt,others){
 const p=npc.group.position,dx=target[0]-p.x,dz=target[1]-p.z,d=Math.hypot(dx,dz),dy=(target[2]||0)+.012-p.y;
 const step=Math.min(d,.48*dt/Math.max(1,Math.hypot(d,dy)/Math.max(d,.001))),f=d>.00001?step/d:1;
 const x=p.x+dx*f,z=p.z+dz*f,y=p.y+dy*f;
 for(const other of others){if(other===npc||Math.abs(other.group.position.y-y)>.60)continue;
  const q=other.group.position,old=Math.hypot(p.x-q.x,p.z-q.z);if(Math.hypot(x-q.x,z-q.z)<Math.min(MIN_DISTANCE,old-.000001))return null;
 }
 p.set(x,y,z);npc.velocity={x:dx*f/Math.max(dt,.001),z:dz*f/Math.max(dt,.001)};
 return d>.0001?Math.atan2(dx,dz):npc.heading;
}

const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),Y=new THREE.Vector3(0,1,0);
function aim(bone,direction){
 const q=bone.getWorldQuaternion(new THREE.Quaternion()),from=Y.clone().applyQuaternion(q);
 q.premultiply(new THREE.Quaternion().setFromUnitVectors(from.normalize(),direction.normalize()));
 q.premultiply(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert());bone.quaternion.copy(q);bone.updateWorldMatrix(false,true);
}
// Keep soles above the actual treads while the hips rise continuously.
export function stepOnStairs(npc,stairRoute,time){
 if(!stairRoute?.mesh||!npc.moving||!npc.onStairs)return;
 npc.model.updateWorldMatrix(true,true);stairRoute.mesh.updateWorldMatrix(true,true);
 for(const side of ['L','R']){
  const thigh=npc.tulang['CTRLthigh'+side],shin=npc.tulang['CTRLshin'+side],foot=npc.tulang['CTRLfoot'+side];if(!thigh||!shin||!foot)continue;
  const hip=thigh.getWorldPosition(new THREE.Vector3()),knee=shin.getWorldPosition(new THREE.Vector3()),ankle=foot.getWorldPosition(new THREE.Vector3());
  const footQ=foot.getWorldQuaternion(new THREE.Quaternion());
  ray.set(new THREE.Vector3(ankle.x,npc.group.position.y+.65,ankle.z),down);ray.far=1.5;
  const hit=ray.intersectObject(stairRoute.mesh,true)[0];const surface=hit?hit.point.y:0;
  const lift=Math.max(0,Math.sin(time*6+(side==='L'?0:Math.PI)))*.075;
  const target=ankle.clone();target.y=Math.max(ankle.y,surface+.085+lift);
  const l1=hip.distanceTo(knee),l2=knee.distanceTo(ankle),axis=target.clone().sub(hip);
  const distance=THREE.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.001,l1+l2-.001);axis.normalize();
  const bend=new THREE.Vector3(Math.sin(npc.heading),0,Math.cos(npc.heading));bend.addScaledVector(axis,-bend.dot(axis)).normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
  const joint=hip.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
  aim(thigh,joint.sub(hip));aim(shin,target.sub(shin.getWorldPosition(new THREE.Vector3())));
  foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(footQ));
 }
}
