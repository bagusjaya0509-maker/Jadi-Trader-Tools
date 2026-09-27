import * as THREE from 'three';

// These imported bookcases used one wood material for both carcass and files.
// Split material groups on their existing faces; keep geometry, pivots and IDs.
export function restoreDocumentMaterials(office){
 const shelfIds=new Set(['annex-147','annex-148','annex-149']);
 const bands=[[0,.0351],[.3865,.4217],[.7906,.8258],[1.1947,1.2474],[1.6164,1.6515],[2.0381,2.0732]];
 office.traverse(root=>{
  if(!shelfIds.has(root.userData.objectId))return;
  root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.userData.documentsRestored)return;
   const wood=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
   if(wood.name!=='Shelf')return;
   const geometry=mesh.geometry.clone(),p=geometry.attributes.position;
   const materials=[wood,...[['Map navy','#274a68'],['Map hijau','#43756c'],['Map burgundy','#8b414c'],['Map krem','#d7c49d'],['Map arang','#4b535c'],['Kertas dokumen','#ece8d9']].map(([name,color])=>new THREE.MeshStandardMaterial({name,color,roughness:.78,metalness:0,envMapIntensity:.5,side:THREE.DoubleSide}))];
   const buckets=materials.map(()=>[]),indices=geometry.index?.array||Array.from({length:p.count},(_,i)=>i);
   const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),edge=new THREE.Vector3();
   for(let i=0;i<indices.length;i+=3){
    a.fromBufferAttribute(p,indices[i]);b.fromBufferAttribute(p,indices[i+1]);c.fromBufferAttribute(p,indices[i+2]);
    const loY=Math.min(a.y,b.y,c.y),hiY=Math.max(a.y,b.y,c.y),x=(a.x+b.x+c.x)/3,y=(loY+hiY)/2,z=(Math.min(a.z,b.z,c.z)+Math.max(a.z,b.z,c.z))/2;
    const center=root.userData.objectId==='annex-149'?(z<0?-.5826:.5826):0,localZ=z-center;
    const frame=hiY-loY>.36||x>.165||Math.abs(localZ)>.5445||bands.some(([lo,hi])=>loY>=lo-.0008&&hiY<=hi+.0008);
    let material=0;
    if(!frame){
     const row=y<.3865?0:y<.7906?1:y<1.1947?2:y<1.6164?3:4;
     const centers=row===2?[-.2309,-.1079,.0151,.1381,.2491,.3602,.4832]:row===3?[-.4832,-.3602,-.2372,-.1142,.0088,.1261,.2372,.3602]:[-.4832,-.3602,-.2372,-.1142,.0031];
     const book=centers.reduce((best,c,i)=>Math.abs(c-localZ)<Math.abs(centers[best]-localZ)?i:best,0);
     material=1+((row*3+book+(center>0?2:0))%5+5)%5;
     if(row===0)material=y<.16?2:3;
     if(row===4&&localZ>.085)material=1;
     normal.subVectors(b,a).cross(edge.subVectors(c,a)).normalize();
     if(Math.abs(normal.y)>.9&&hiY-loY<.002)material=6;
    }
    buckets[material].push(indices[i],indices[i+1],indices[i+2]);
   }
   geometry.clearGroups();let offset=0;const reordered=[];
   buckets.forEach((bucket,i)=>{if(bucket.length){geometry.addGroup(offset,bucket.length,i);reordered.push(...bucket);offset+=bucket.length;}});
   geometry.setIndex(reordered);mesh.geometry=geometry;mesh.material=materials;mesh.userData.documentsRestored=true;
  });
 });
}
