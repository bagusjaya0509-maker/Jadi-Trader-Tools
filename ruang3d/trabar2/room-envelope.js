import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createWindowPanorama,createReflectiveGlazing} from './window-illusion.js';

const ROOF_Y=3.29;

export function insideFloor(x,z,outline){
  let inside=false;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++){
    const a=outline[i],b=outline[j];
    if(((a[2]>z)!==(b[2]>z))&&(x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0]))inside=!inside;
  }
  return inside;
}

export class RoomEnvelope {
  constructor(scene,office,layout,panorama){
    RectAreaLightUniformsLib.init();
    this.outline=layout.stair?.mainRoof||layout.expansion?.floor||layout.floor;this.roofOpacity=0;this.windows=[];this.look=new THREE.Vector3();
    // The source trees were made for an open dollhouse view. Keep their lower
    // branches unchanged and fit their upper canopy beneath the new ceiling.
    office.traverse(o=>{
      if(layout.canopyFitted)return;
      if(!o.isMesh)return;
      const name=o.material?.name||'';
      if(!/^(leaf[1-4]|bark|goldleaf)$/.test(name))return;
      const a=o.geometry.attributes.position;
      for(let i=0;i<a.count;i++)if(a.getY(i)>2.55)a.setY(i,2.55+(a.getY(i)-2.55)*.38);
      a.needsUpdate=true;o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
    });
    this.roof=new THREE.Group();this.roof.name='Automatic cutaway ceiling';scene.add(this.roof);
    const shape=new THREE.Shape(this.outline.map(p=>new THREE.Vector2(p[0],-p[2])));
    const slabGeometry=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false,steps:1,curveSegments:1});slabGeometry.rotateX(-Math.PI/2);
    this.roofMaterials=[];
    const ceiling=new THREE.MeshStandardMaterial({color:'#777870',roughness:.78,metalness:.035,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false});
    this.roofMaterials.push(ceiling);
    const slab=new THREE.Mesh(slabGeometry,ceiling);slab.name='Plafon kantor utama';slab.position.y=ROOF_Y;slab.receiveShadow=true;slab.castShadow=false;this.roof.add(slab);
    // A separate shadow-only roof keeps the morning light stable while the
    // visible ceiling fades for an overhead camera. Sun enters at the glazing.
    const roofShadow=new THREE.Mesh(slabGeometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,colorWrite:false,depthWrite:false}));
    roofShadow.name='Ceiling daylight occlusion';roofShadow.position.y=ROOF_Y;
    roofShadow.castShadow=true;roofShadow.userData.excludeFromAO=true;scene.add(roofShadow);
    const fixture=new THREE.MeshStandardMaterial({color:'#4b493f',roughness:.47,metalness:.4,transparent:true,opacity:0,depthWrite:false});
    const emission=new THREE.MeshStandardMaterial({color:'#fff5e4',emissive:'#ffdfaf',emissiveIntensity:5,roughness:.45,transparent:true,opacity:0,depthWrite:false});
    this.roofMaterials.push(fixture,emission);
    this.extraRoofs=[];
    if(layout.stair){
      const spec=layout.stair.roof,group=new THREE.Group();group.name='Plafon otomatis ruang bertangga';scene.add(group);
      const shape=new THREE.Shape(spec.floor.map(p=>new THREE.Vector2(p[0],-p[2])));
      const geo=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false,steps:1});geo.rotateX(-Math.PI/2);
      const materials=[ceiling.clone(),fixture.clone(),emission.clone()];
      const panel=new THREE.Mesh(geo,materials[0]);panel.name='Plafon ruang bertangga';panel.position.y=spec.height;panel.receiveShadow=true;group.add(panel);
      const shadow=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,colorWrite:false,depthWrite:false}));shadow.position.y=spec.height;shadow.castShadow=true;shadow.userData.excludeFromAO=true;scene.add(shadow);
      for(const [x,z,length] of layout.stair.lights){
        const channel=new THREE.Mesh(new THREE.BoxGeometry(length,.035,.11),materials[1]);channel.name='Rumah lampu atrium';channel.position.set(x,spec.height-.018,z);group.add(channel);
        const lamp=new THREE.Mesh(new THREE.BoxGeometry(length-.08,.012,.048),materials[2]);lamp.name='Lampu plafon atrium';lamp.position.set(x,spec.height-.041,z);group.add(lamp);
        const light=new THREE.RectAreaLight('#ffe8cc',32,length-.08,.85);light.position.set(x,spec.height-.09,z);light.lookAt(x,0,z);scene.add(light);
      }
      this.extraRoofs.push({group,materials,height:spec.height,opacity:0});
    }
    this.cameraOutline=layout.stair?.floor||this.outline;
    // Slender recessed ceiling lights, attached to the roof so they disappear
    // with it in a top view. Illumination remains continuous during the fade.
    for(const [x,z,length] of [[-2.1,-.15,4.8],[1.45,3.8,3.5],[2.2,-5.6,3.7],...(layout.expansion?.lights||[])]){
      const channel=new THREE.Mesh(new THREE.BoxGeometry(length,.035,.11),fixture);channel.name='Rumah lampu plafon';channel.position.set(x,ROOF_Y-.018,z);this.roof.add(channel);
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(length-.08,.012,.048),emission);lamp.name='Lampu plafon linear';lamp.position.set(x,ROOF_Y-.041,z);this.roof.add(lamp);
      const light=new THREE.RectAreaLight('#ffe8cc',23,length-.08,.55);
      light.name='Recessed ceiling strip illumination';light.position.set(x,ROOF_Y-.08,z);
      light.lookAt(x,0,z);scene.add(light);
    }
    // Recessed round downlights provide warm pools around the lounge and desk.
    for(const [x,z] of [[5.6,-1.8],[5.6,1.65],[-5.9,.3],[.3,2.2]]){
      const rim=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.015,24),fixture);
      rim.name='Bingkai downlight';rim.position.set(x,ROOF_Y-.02,z);this.roof.add(rim);
      const lens=new THREE.Mesh(new THREE.CircleGeometry(.063,24),emission);
      lens.name='Downlight';lens.rotation.x=Math.PI/2;lens.position.set(x,ROOF_Y-.03,z);this.roof.add(lens);
      const light=new THREE.SpotLight('#ffe8ce',32,8,.85,.85,2);
      light.position.set(x,ROOF_Y-.065,z);light.target.position.set(x,0,z);
      scene.add(light,light.target);
    }
    this.workLights=[];
    const pools=[[-5,2.95,4.8,5,3],[-5,2.95,-4.6,6,3],[3.4,2.95,.3,5,3],[-7.4,2.95,7.7,5,2],[-8.1,3.05,12.4,5,4],[-2.4,3.05,12.2,5,4],[6.6,3.05,12.2,5,4],[-8,3.05,19.3,5,4],[-1.5,3.05,20,6,4],[7,3.05,19.4,5,4],[-18.4,5.55,-3,5,4],[-12.5,5.55,3.3,5,4],[-19.4,2.28,4.5,3,3]];
    for(const [x,y,z,w,h] of pools){
      const l=new THREE.RectAreaLight('#fff0db',y>4?6.0:3.4,w,h);l.position.set(x,y,z);l.lookAt(x,0,z);l.name='Diffuse ceiling fill';scene.add(l);this.workLights.push(l);
    }
    // Flat window portals share one distant view, projected from the camera
    // instead of attaching a different piece of the image to each glass pane.
    const indices=[4,14,24,34,44,54,64,69];
    const points=indices.map(i=>new THREE.Vector3(...layout.floor[i]));
    if(layout.stair?.straightRear)layout.stair.straightRear.windowXs.forEach((x,i)=>points[i].set(x,0,layout.stair.straightRear.z));
    const panels=points.slice(1).map((b,i)=>{
      const a=points[i],width=b.distanceTo(a)-.045;
      const tangent=b.clone().sub(a).normalize();
      const normal=new THREE.Vector3(-tangent.z,0,tangent.x);
      const middle=a.clone().add(b).multiplyScalar(.5);
      const inward=new THREE.Vector3(-.65-middle.x,0,.25-middle.z);
      if(normal.dot(inward)<0)normal.negate();
      middle.addScaledVector(normal,.135);middle.y=1.68;
      return {position:middle.toArray(),normal:normal.toArray(),width,height:2.48};
    }).concat(layout.expansion?.windows||[],layout.stair?.windows||[]);
    for(const [i,panel] of panels.entries()){
      const {width,height}=panel,normal=new THREE.Vector3(...panel.normal);
      const g=new THREE.Group();g.position.fromArray(panel.position);
      g.rotation.y=Math.atan2(normal.x,normal.z);g.name='Kaca panorama kota '+(i+1);g.userData={objectId:'panorama-'+i,objectName:g.name,category:'PARTITION',selectAsWhole:true};scene.add(g);
      const pictureMaterial=createWindowPanorama(panorama);
      const frameMaterial=new THREE.MeshStandardMaterial({color:'#96938a',metalness:.7,roughness:.3,transparent:true,opacity:1});
      const glassMaterial=createReflectiveGlazing();
      const geometry=new THREE.PlaneGeometry(width,height);
      const picture=new THREE.Mesh(geometry,pictureMaterial);picture.userData.excludeFromAO=true;g.add(picture);
      const glass=new THREE.Mesh(new THREE.PlaneGeometry(width,height),glassMaterial);glass.position.z=.018;glass.renderOrder=2;g.add(glass);
      for(const x of [-width/2,width/2]){const m=new THREE.Mesh(new THREE.BoxGeometry(.058,height+.08,.10),frameMaterial);m.position.set(x,0,.025);m.castShadow=m.receiveShadow=true;g.add(m);}
      for(const y of [-height/2,height/2]){const m=new THREE.Mesh(new THREE.BoxGeometry(width+.04,.058,.10),frameMaterial);m.position.set(0,y,.025);m.castShadow=m.receiveShadow=true;g.add(m);}
      const sill=new THREE.Mesh(new THREE.BoxGeometry(width+.05,.055,.20),frameMaterial);sill.position.set(0,-height/2-.035,.06);sill.castShadow=sill.receiveShadow=true;g.add(sill);
      if([1,3,5].includes(i)){
        const daylight=new THREE.RectAreaLight('#e8f1ff',1.6,width,height);
        daylight.name='Soft daylight from glazing';daylight.position.copy(g.position).addScaledVector(normal,.06);
        daylight.lookAt(daylight.position.clone().add(normal));scene.add(daylight);
      }
      this.windows.push({group:g,normal,opacity:1,pictureMaterial,frameMaterial,glassMaterial});
    }
  }
  update(camera,dt){
    camera.getWorldDirection(this.look);
    const inRoom=insideFloor(camera.position.x,camera.position.z,this.cameraOutline);
    const underRoof=1-THREE.MathUtils.smoothstep(camera.position.y,ROOF_Y-.3,ROOF_Y+.25);
    const upClear=1-THREE.MathUtils.smoothstep(this.look.y,.65,.9);
    const target=inRoom?underRoof*upClear:0;
    this.roofOpacity=THREE.MathUtils.damp(this.roofOpacity,target,7,dt);
    this.roof.visible=this.roofOpacity>.005;
    for(const m of this.roofMaterials){m.opacity=this.roofOpacity;m.depthWrite=this.roofOpacity>.985;}
    for(const roof of this.extraRoofs){
      const under=1-THREE.MathUtils.smoothstep(camera.position.y,roof.height-.3,roof.height+.25);
      roof.opacity=THREE.MathUtils.damp(roof.opacity,inRoom?under*upClear:0,7,dt);roof.group.visible=roof.opacity>.005;
      for(const m of roof.materials){m.opacity=roof.opacity;m.depthWrite=roof.opacity>.985;}
    }
    for(const w of this.windows){
      const front=camera.position.clone().sub(w.group.position).dot(w.normal)>.025;
      w.opacity=THREE.MathUtils.damp(w.opacity,front?1:0,9,dt);
      w.group.visible=w.opacity>.005&&!w.group.userData.deleted;w.pictureMaterial.opacity=w.opacity;
      w.pictureMaterial.depthWrite=w.opacity>.98;w.frameMaterial.opacity=1;w.frameMaterial.transparent=false;w.frameMaterial.depthWrite=true;
      const viewDirection=camera.position.clone().sub(w.group.position).normalize();
      const grazing=1-Math.max(0,viewDirection.dot(w.normal));
      w.glassMaterial.opacity=(.065+.24*Math.pow(grazing,3))*w.opacity;
    }
  }
}
