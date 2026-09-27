// Shared by the numeric editor and persisted room-layout transforms.
export function applyNumericTransform(object,values){
 const p=values.position.map(Number),r=values.rotation.map(Number);
 if(values.position.some(v=>String(v).trim()==='')||values.rotation.some(v=>String(v).trim()==='')
   ||p.length!==3||r.length!==3||![...p,...r].every(Number.isFinite)||p.some(v=>Math.abs(v)>500))return false;
 object.position.set(...p);
 object.rotation.set(...r.map(v=>(((v+180)%360+360)%360-180)*Math.PI/180),object.rotation.order);
 object.updateWorldMatrix(true,true);return true;
}
