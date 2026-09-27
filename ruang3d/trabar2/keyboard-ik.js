import * as THREE from 'three';

const V=()=>new THREE.Vector3(), Y=new THREE.Vector3(0,1,0);
const a=V(),b=V(),c=V(),axis=V(),bend=V(),elbow=V(),direction=V();
const q=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),delta=new THREE.Quaternion();
const handBasis=new THREE.Matrix4(),hx=V(),hy=V(),hz=V();

function aim(bone,worldDirection,weight){
  bone.updateWorldMatrix(true,false);bone.getWorldQuaternion(q);
  direction.copy(Y).applyQuaternion(q).normalize();
  q.premultiply(delta.setFromUnitVectors(direction,worldDirection));
  bone.parent.getWorldQuaternion(parentQ);q.premultiply(parentQ.invert());
  bone.quaternion.slerp(q,weight);
}

// Solve the actual shoulder/elbow/wrist chain against each keyboard's world
// bounds. The keyboard may be moved with the furniture editor; targets follow.
export function typeAtKeyboard(npc,time,weight){
  const keyboard=npc.station.keyboard;
  if(!keyboard||weight<.001)return;
  keyboard.updateWorldMatrix(true,true);
  const bounds=npc.station.keyboardBounds??=new THREE.Box3();bounds.setFromObject(keyboard);
  const center=bounds.getCenter(V());
  const forward=V().set(Math.sin(npc.heading),0,Math.cos(npc.heading));
  const side=V().set(forward.z,0,-forward.x);
  npc.model.updateWorldMatrix(true,true);
  for(const [i,s] of ['L','R'].entries()){
    const upper=npc.tulang['CTRLupperarm'+s],lower=npc.tulang['CTRLforearm'+s],hand=npc.tulang['CTRLhand'+s];
    if(!upper||!lower||!hand)continue;
    const sign=s==='L'?1:-1,phase=time*7.2+npc.index*.71+i*Math.PI;
    const tap=(Math.sin(phase)+1)*.5;
    // Robot palms point forward; the fingertips extend 17 cm from the wrist.
    const target=center.clone().addScaledVector(side,sign*.108+Math.sin(phase*.47)*.008).addScaledVector(forward,-.163);
    target.y=bounds.max.y+.044+tap*.013;
    upper.getWorldPosition(a);lower.getWorldPosition(b);hand.getWorldPosition(c);
    const l1=a.distanceTo(b),l2=b.distanceTo(c);
    axis.copy(target).sub(a);const distance=Math.min(l1+l2-.001,Math.max(Math.abs(l1-l2)+.001,axis.length()));axis.normalize();
    // Elbows bend downward and a little outward, away from the torso.
    bend.copy(side).multiplyScalar(sign*.42).addScaledVector(forward,-.15);bend.y=-1;
    bend.addScaledVector(axis,-bend.dot(axis)).normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
    elbow.copy(a).addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    aim(upper,direction.copy(elbow).sub(a).normalize().clone(),weight);
    lower.updateWorldMatrix(true,false);lower.getWorldPosition(b);
    aim(lower,direction.copy(target).sub(b).normalize().clone(),weight);
    // Palm local X points up, Y along the keys, Z across the keyboard.
    hy.copy(forward).setY(-.10).normalize();hz.copy(side);hx.crossVectors(hy,hz).normalize();
    handBasis.makeBasis(hx,hy,hz);q.setFromRotationMatrix(handBasis);
    hand.parent.getWorldQuaternion(parentQ);q.premultiply(parentQ.invert());hand.quaternion.slerp(q,weight);
    for(let f=1;f<=3;f++){
      const finger=npc.tulang['CTRLfinger'+f+s],rest=npc.istirahat['CTRLfinger'+f+s];
      if(finger&&rest){q.copy(rest).multiply(delta.setFromAxisAngle(new THREE.Vector3(0,0,1),-.10-.08*Math.sin(phase+f*.9)));finger.quaternion.slerp(q,weight);}
    }
  }
}
