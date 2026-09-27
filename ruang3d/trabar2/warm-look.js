import * as THREE from 'three';

// Art direction from the owner's September reference: honey oak, charcoal,
// warm architectural light and restrained cool accents on the terminals.
export const WARM_LOOK = Object.freeze({
  exposure: 1.03,
  environmentIntensity: .76,
  background: '#292a28',
  ground: '#33332f',
  sky: '#e5effa',
  bounce: '#867157',
  ambient: .78,
  sunlight: '#fff0d9',
  sunlightIntensity: 5.0,
  fill: '#e5edfa',
  fillIntensity: .48,
  glass: '#d5dfdc',
});

const palette = {
  wall: ['#50524f', .65, .06],
  cap: ['#777870', .45, .12],
  seam: ['#333633', .56, .05],
  cabinet: ['#a19c91', .48, .04],
  white: ['#e9e7e1', .54, .01],
  grey: ['#a5aaa6', .79, .01],
  greydesk: ['#55534e', .43, .04],
  carpet: ['#737367', .98, 0],
  darkcarpet: ['#68645b', 1, 0],
  teal: ['#658383', .67, .02],
  darkteal: ['#355559', .60, .04],
  orange: ['#e77919', .32, .04],
  burnt: ['#b55c2b', .43, .01],
  ochre: ['#bc883c', .47, .01],
  wood: ['#c6a06c', .39, .02],
  darkwood: ['#62442e', .51, .01],
  door: ['#9c7142', .43, .01],
  doorline: ['#65472c', .48, .01],
  chrome: ['#a6aaa5', .27, .80],
  brass: ['#ad8d57', .31, .67],
  leaf1: ['#233a22', .85, 0],
  leaf2: ['#3e5931', .83, 0],
  leaf3: ['#67804a', .81, 0],
  leaf4: ['#879455', .83, 0],
};

// Fine wood relief and satin varnish: deterministic material maps, not a
// second colour image. The original oak plank texture remains intact.
function oakSurfaceMaps(){
  const size=512,bump=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);
  let seed=1327;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const grain=Math.sin(y*.88+Math.sin(x*.027)*1.8)+.4*Math.sin(y*2.3+x*.035);
    const n=random(),i=(y*size+x)*4;
    const h=Math.round(126+grain*12+(n-.5)*9);
    const r=Math.round(182+grain*9+(n-.5)*14);
    bump.set([h,h,h,255],i);rough.set([r,r,r,255],i);
  }
  return [bump,rough].map(data=>{
    const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);
    t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
  });
}

export function applyWarmMaterials(office){
  const visited=new Set();
  let oakMaps;
  office.traverse(object=>{
    if(!object.isMesh)return;
    if(object.material?.name==='Natural oak planks'){
      const source=object.material;oakMaps??=oakSurfaceMaps();
      object.material=new THREE.MeshPhysicalMaterial({
        name:source.name,map:source.map,color:'#fff9ef',side:source.side,
        roughness:.43,roughnessMap:oakMaps[1],bumpMap:oakMaps[0],bumpScale:.007,
        metalness:0,clearcoat:.26,clearcoatRoughness:.32,envMapIntensity:1.0,
      });
    }
    for(const m of Array.isArray(object.material)?object.material:[object.material]){
      if(!m||visited.has(m))continue;
      visited.add(m);
      const p=palette[m.name];
      if(p){m.color.set(p[0]);m.roughness=p[1];m.metalness=p[2];}
      if(m.name==='Natural oak planks'){
        m.color.set('#fff9ef');m.envMapIntensity=1.0;
      }
      if(m.name==='Warm linear LEDs'){
        m.color.set('#ffe9c2');m.emissive.set('#ffd39a');m.emissiveIntensity=3;
      }
    }
  });
}

export function addWarmCove(scene,layout){
  // Follow the existing rear and right wall contour, leaving the front open.
  const end=layout.floor.findIndex(p=>p[0]>7.2&&p[2]>4);
  if(end<2)return;
  const rear=layout.stair?.straightRear;
  const boundary=rear?[[rear.x0,0,rear.z],...layout.floor.slice(rear.joinIndex,end+1)]:layout.floor.slice(0,end+1);
  const points=boundary.map((p,i)=>{
    const inward=new THREE.Vector3(-.65-p[0],0,.25-p[2]).normalize().multiplyScalar(.10);
    if(rear&&i<2)inward.set(0,0,.1);
    return new THREE.Vector3(p[0]+inward.x,3.12,p[2]+inward.z);
  });
  const strip={material:new THREE.MeshStandardMaterial({name:'Dimmable perimeter LED',color:'#fff0cf',emissive:'#ffd19a',emissiveIntensity:3.2,roughness:.36})};
  for(const p of [[-3.1,2.8,-6.4],[4.0,2.8,-5.6],[6.9,2.8,1.5]]){
    const l=new THREE.PointLight('#ffdcaa',7,7,2);l.position.fromArray(p);scene.add(l);
  }
  if(layout.expansion){
    const b=layout.expansion.bounds,x0=b[0][0]+.24,x1=b[1][0]-.24,z0=9.12,z1=b[1][2]-.24;
    const corners=[[x0,3.12,z0],[x1,3.12,z0],[x1,3.12,z1],[x0,3.12,z1],[x0,3.12,z0]].map(p=>new THREE.Vector3(...p));
    const path=new THREE.CurvePath();
    for(let i=1;i<corners.length;i++)path.add(new THREE.LineCurve3(corners[i-1],corners[i]));
    const extensionStrip=new THREE.Mesh(new THREE.TubeGeometry(path,100,.018,6,false),strip.material);
    extensionStrip.name='Lampu perimeter kantor tambahan';scene.add(extensionStrip);
  }
  if(layout.stair){
    const points=[[-21.48,5.60,8.16],[-21.48,5.60,-7.10],[-9.15,5.60,-7.10]].map(p=>new THREE.Vector3(...p));
    const path=new THREE.CurvePath();for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(points[i-1],points[i]));
    const led=new THREE.Mesh(new THREE.TubeGeometry(path,48,.018,6,false),strip.material);led.name='Lampu perimeter atrium tangga';scene.add(led);
  }
}
