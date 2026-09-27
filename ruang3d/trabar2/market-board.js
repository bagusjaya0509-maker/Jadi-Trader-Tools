import * as THREE from 'three';
export const MARKET_BOARD_ASSETS=['BTC','ETH','SOL','HYPE','BNB'];
const YAW=-2.364;
const ORIGIN=new THREE.Vector3(7.39878+Math.cos(YAW)*1.68,0,4.40623-Math.sin(YAW)*1.68);
// The last leg occupies the original straight glazing, x=5.4, z=6.92..8.94.
const OUTLINE=[[7.39878,0,4.40623],[5.4,0,6.92],[5.4,0,8.94]].map(p=>new THREE.Vector3(...p).sub(ORIGIN).applyAxisAngle(new THREE.Vector3(0,1,0),-YAW));
const navigationCells=new WeakMap();
export function reserveMarketBoard(group,nav){
 const previous=navigationCells.get(nav)||new Map();
 const rows=new Map(),setCell=(k,value)=>{const row=Math.floor(k/nav.width);if(!rows.has(row))rows.set(row,[...nav.rows[row]]);rows.get(row)[k%nav.width]=value;};
 for(const [k,value] of previous){setCell(k,value);nav.allowed.add(k);}
 const blocked=new Map();group.updateWorldMatrix(true,true);
 const inverse=group.matrixWorld.clone().invert(),p=new THREE.Vector3();
 if(!group.userData.deleted)for(const k of nav.allowed){
  const [x,z]=nav.world(k);
  const collides=[.25,.85,1.5].some(y=>{
   p.set(x,y,z).applyMatrix4(inverse);if(p.y<-.15||p.y>3.30)return false;
   return OUTLINE.slice(1).some((b,i)=>{const a=OUTLINE[i],dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<.49;});
  });
  if(collides){blocked.set(k,previous.get(k)||nav.rows[Math.floor(k/nav.width)][k%nav.width]);setCell(k,'#');}
 }
 for(const [row,cells] of rows)nav.rows[row]=cells.join('');
 for(const k of blocked.keys())nav.allowed.delete(k);
 nav.walkable=[...nav.allowed];navigationCells.set(nav,blocked);
}
export function createMarketBoard(scene,marketTextures,tickerTextures){
 const group=new THREE.Group();group.name='Papan trading · 5 grafik bersudut';
 group.userData={objectId:'market-board-link',objectName:group.name,selectAsWhole:true,category:'FURNITURE'};
 // Preserve the existing editable pivot and saved transforms.
 group.rotation.y=YAW;group.position.copy(ORIGIN);
 const metal=new THREE.MeshStandardMaterial({color:'#242d2d',metalness:.5,roughness:.34});
 const trim=new THREE.MeshStandardMaterial({color:'#a09b83',metalness:.7,roughness:.32});
 const directions=OUTLINE.slice(1).map((b,i)=>b.clone().sub(OUTLINE[i]).normalize());
 const normals=directions.map(d=>new THREE.Vector3(-d.z,0,d.x));
 const ribbon=(width,height,y,material,name)=>{
  const side=sign=>OUTLINE.map((p,i)=>{const before=normals[Math.max(0,i-1)],after=normals[Math.min(i,normals.length-1)],n=before.clone().add(after).normalize();const q=p.clone().addScaledVector(n,sign*width/2/n.dot(after));return new THREE.Vector2(q.x,-q.z);});
  const shape=new THREE.Shape([...side(-1),...side(1).reverse()]);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.y=y;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
 };
 ribbon(.16,3.15,0,metal,'Dinding papan trading bersudut');
 ribbon(.18,.045,3.1375,trim,'List atas bersambung di sudut');
 group.userData.marketPanels=[];
 for(let i=0;i<2;i++){
  const a=OUTLINE[i],b=OUTLINE[i+1],d=b.clone().sub(a),width=d.length(),panel=new THREE.Group();
  panel.name=i?'Bidang lurus · bekas kaca · 2 grafik':'Bidang miring · 3 grafik';panel.position.copy(a).add(b).multiplyScalar(.5);panel.rotation.y=-Math.atan2(d.z,d.x);group.add(panel);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(width-.18,1.5,.07),trim);frame.position.set(0,1.91,.12);frame.name='Bingkai grafik '+(i+1);panel.add(frame);
  const screen=(w,h,y,texture,name)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));m.position.set(0,y,.16);m.name=name;panel.add(m);return m;};
  screen(width-.28,1.40,1.91,marketTextures[i],'Grafik '+(i?'HYPE · BNB':'BTC · ETH · SOL'));
  screen(width-.24,.24,2.87,tickerTextures[i],'Ticker '+(i+1));
  const glow=new THREE.PointLight('#8fcbd0',4.5,3.5,2);glow.position.set(0,2.1,.55);panel.add(glow);
  group.userData.marketPanels.push({panel,width});
 }
 scene.add(group);updateMarketBoard(group);return group;
}
export function updateMarketBoard(group,station){
 group.updateWorldMatrix(true,true);
 const point=new THREE.Vector3(),front=new THREE.Vector3();let total=0;
 for(const {panel,width} of group.userData.marketPanels){point.addScaledVector(panel.localToWorld(new THREE.Vector3(0,1.91,.18)),width);front.addScaledVector(new THREE.Vector3(0,0,1).transformDirection(panel.matrixWorld),width);total+=width;}
 point.divideScalar(total);front.normalize();
 group.userData.focus={label:'Papan trading · 5 grafik bersudut',point,distance:7.6};
 if(station){const p=point.clone().addScaledVector(front,2.1);station.position=[p.x,p.z];station.look=[point.x,point.z];}
 return {target:point,position:point.clone().addScaledVector(front,7.6).add(new THREE.Vector3(0,.45,0)),label:'Papan trading · 5 grafik bersudut'};
}
