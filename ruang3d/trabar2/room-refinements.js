import * as THREE from 'three';
// Replace the obsolete curved coffee enclosure with connected, straight bays.
export function refineRoom(office,layout){
 const ids=new Set(['stair-main-wall','office-030','office-031','office-150','office-151','office-152','office-153','office-154',
  // Open the glazing beside the market wall, including both posts and its cap.
  'link-209','link-210','link-211','link-212']);
 const remove=[];office.traverse(o=>{if(ids.has(o.userData.objectId))remove.push(o);});remove.forEach(o=>o.removeFromParent());
 // The upper landing is 4.166 m high. Leave headroom for the standing robot.
 if(layout.stair?.roof){
  const extra=Math.max(0,6.15-layout.stair.roof.height);
  if(extra){
   office.updateMatrixWorld(true);
   office.traverse(o=>{
    if(!['Dinding belakang ruang tangga','Dinding barat ruang tangga'].includes(o.userData.objectName))return;
    const bounds=new THREE.Box3().setFromObject(o),height=bounds.max.y-bounds.min.y;
    o.scale.y*=1+extra/height;o.position.y+=extra*.5;
   });
   layout.stair.roof.height=6.15;
  }
 }
 const wall=new THREE.MeshStandardMaterial({color:'#50524f',roughness:.65,metalness:.06});
 const cap=new THREE.MeshStandardMaterial({color:'#777870',roughness:.45,metalness:.12});
 const frame=new THREE.MeshStandardMaterial({color:'#a6aaa5',roughness:.3,metalness:.72});
 const plinth=new THREE.MeshStandardMaterial({color:'#e9e7e1',roughness:.56});
 const glass=new THREE.MeshStandardMaterial({name:'Architectural glass',color:'#d5dfdc',transparent:true,opacity:.105,depthWrite:false,roughness:.15,metalness:.08,side:THREE.DoubleSide});
 const led=new THREE.MeshStandardMaterial({name:'Dimmable perimeter LED',color:'#fff0cf',emissive:'#ffd19a',emissiveIntensity:3.2,roughness:.36});
 const mesh=(g,size,p,mat,name)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...p);m.name=name;m.castShadow=mat!==glass;m.receiveShadow=true;g.add(m);return m;};
 const group=(id,name,category)=>{const g=new THREE.Group();g.name=name;g.userData={objectId:id,objectName:name,category,selectAsWhole:true};office.add(g);return g;};
 const rear=layout.stair.straightRear,end=layout.floor.findIndex(p=>p[0]>7.2&&p[2]>4);
 // Keep every corner of the footprint. Sampling every fifth point cut through
 // the lounge at the east corner. Shared mitres close the wall/cap seams.
 const points=[[rear.x0,0,rear.z],...layout.floor.slice(rear.joinIndex,end+1)].map(p=>new THREE.Vector3(...p));
 const cuts=[0,...points.slice(1).map((_,i)=>i+1).filter(i=>(i-1)%5===0||i===points.length-1)];
 const normals=points.slice(1).map((p,i)=>{const d=p.clone().sub(points[i]).normalize();return new THREE.Vector3(-d.z,0,d.x);});
 const offset=(i,distance)=>{
  const before=normals[Math.max(0,i-1)],after=normals[Math.min(i,normals.length-1)];
  const mitre=before.clone().add(after).normalize();
  return points[i].clone().addScaledVector(mitre,distance/Math.max(.25,mitre.dot(after)));
 };
 for(let i=1;i<cuts.length;i++){
  const start=cuts[i-1],finish=cuts[i],a=points[start],b=points[finish],d=b.clone().sub(a);
  const g=group('refined-wall-'+i,'Dinding kantor 1 · bidang '+i,'WALL');g.position.copy(a.clone().add(b).multiplyScalar(.5));g.rotation.y=-Math.atan2(d.z,d.x);
  g.updateMatrix();const inverse=g.matrix.clone().invert();
  const ribbon=(width,height,y,inset,material,name)=>{
   const outer=[],inner=[];
   for(let j=start;j<=finish;j++){
    const p=offset(j,inset-width/2).applyMatrix4(inverse),q=offset(j,inset+width/2).applyMatrix4(inverse);
    outer.push(new THREE.Vector2(p.x,-p.z));inner.push(new THREE.Vector2(q.x,-q.z));
   }
   const shape=new THREE.Shape([...outer,...inner.reverse()]);
   const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1,curveSegments:1});geometry.rotateX(-Math.PI/2);
   const m=new THREE.Mesh(geometry,material);m.name=name;m.position.y=y;m.castShadow=m.receiveShadow=true;g.add(m);
  };
  ribbon(.14,3.20,0,0,wall,'Bidang dinding utuh');
  ribbon(.18,.055,3.1975,0,cap,'List atas tersambung');
  // The wall, trim and lamp are hidden together by adaptive cutaway.
  ribbon(.026,.028,3.116,.081,led,'Lampu list dinding');
  ribbon(.155,.07,0,0,cap,'List lantai');
 }
 for(const [side,x,z0] of [['kiri',-5.35,-7.28],['kanan',-1.35,-7.28]]){
  const end=-3.40,count=3,span=(end-z0)/count;
  for(let i=0;i<count;i++){
   const g=group('coffee-glass-'+side+'-'+i,'Kaca coffee corner '+side+' · '+(i+1),'PARTITION');g.position.set(x,0,z0+span*(i+.5));
   mesh(g,[.035,2.45,span-.04],[0,1.445,0],glass,'Kaca bening');
   mesh(g,[.12,.20,span+.002],[0,.10,0],plinth,'Ambang bawah');
   mesh(g,[.06,.061,span+.002],[0,2.6825,0],frame,'List atas lurus');
   for(const z of [-span/2,span/2])mesh(g,[.047,2.66,.042],[0,1.35,z],frame,'Sambungan kaca');
  }
 }
 office.updateMatrixWorld(true);
}

export function refineNavigation(nav){
 const blocked=new Set();
 nav.rows=nav.rows.map((row,j)=>[...row].map((v,i)=>{if(v!=='1'&&v!=='.')return v;const k=j*nav.width+i,[x,z]=nav.world(k);if(z>=-7.40&&z<=-3.37&&[ -5.35,-1.35 ].some(a=>Math.abs(x-a)<.24)){blocked.add(k);return '#';}return v;}).join(''));
 nav.walkable=nav.walkable.filter(k=>!blocked.has(k));for(const k of blocked)nav.allowed.delete(k);
}
