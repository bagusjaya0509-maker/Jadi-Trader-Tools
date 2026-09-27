import * as THREE from 'three';

export const ROBOT_COLORS=[
 ['Oranye','#ff780b'],['Biru','#087bff'],['Hijau','#20bb43'],['Ungu','#8835ee'],
 ['Kuning','#ffc20a'],['Toska','#00c5cc'],['Merah','#f42631'],['Magenta','#ed2791'],
];
export const PAINT_PRESETS=[...ROBOT_COLORS,['Hitam','#111820']];
const PAINT_STORAGE='jaditrader-robot-paint-v1',DEFAULT_SHADE=.60;
const validHex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
function paintKey(npc){return npc.profile.analis?.uid!=null?'analyst:'+npc.profile.analis.uid:'seat:'+(npc.profile.home??npc.index);}
function savedPaint(){try{const data=JSON.parse(localStorage.getItem(PAINT_STORAGE)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}catch{return {};}}
function rememberPaint(npc,reset=false){
 try{const saved=savedPaint();if(reset)delete saved[npc.paintKey];else saved[npc.paintKey]={hex:npc.paintHex,shade:npc.paintShade};localStorage.setItem(PAINT_STORAGE,JSON.stringify(saved));npc.paintSaved=true;}catch{npc.paintSaved=false;}
}
export function setRobotPaint(npc,hex,shade,{persist=true}={}){
 if(!npc?.paintColor||!validHex(hex))return false;
 npc.paintHex=hex.toLowerCase();npc.paintShade=THREE.MathUtils.clamp(Number.isFinite(shade)?shade:DEFAULT_SHADE,.05,1);
 npc.paintColor.set(npc.paintHex).multiplyScalar(npc.paintShade);
 npc.colorName=PAINT_PRESETS.find(p=>p[1]===npc.paintHex)?.[0]||'Kustom';
 for(const m of npc.paintMaterials||[])if(m.map)m.userData.robotPaint=npc.paintHex;
 if(persist)rememberPaint(npc);return true;
}
export function resetRobotPaint(npc){
 if(!npc?.defaultPaint)return;
 setRobotPaint(npc,npc.defaultPaint.hex,DEFAULT_SHADE,{persist:false});rememberPaint(npc,true);
}

// Replace only the orange paint in the original atlas. The black joints,
// visor, white face and purple insignia retain their original textures.
export function colorRobot(npc){
 const slot=Number(npc.profile.home?.match(/analis(\d+)/)?.[1]??npc.index)%ROBOT_COLORS.length;
 const [name,hex]=ROBOT_COLORS[slot],paint=new THREE.Color(hex),copies=new Map();
 npc.colorName=name;npc.paintKey=paintKey(npc);npc.paintColor=paint;npc.defaultPaint={hex,shade:DEFAULT_SHADE};
 npc.model.traverse(o=>{if(!o.isMesh)return;
  const tint=material=>{
   if(copies.has(material))return copies.get(material);
   const m=material.map?new THREE.MeshPhysicalMaterial():material.clone();
   if(material.map){THREE.MeshStandardMaterial.prototype.copy.call(m,material);m.defines={STANDARD:'',PHYSICAL:''};}
   copies.set(material,m);m.envMapIntensity=1.05;
   if(m.map){
    m.clearcoat=.38;m.clearcoatRoughness=.24;
    m.onBeforeCompile=shader=>{
     shader.uniforms.robotPaint={value:paint};
     shader.fragmentShader='uniform vec3 robotPaint;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
       vec3 originalPaint = diffuseColor.rgb;
       float orangeMask = smoothstep(0.04, 0.15, originalPaint.r-originalPaint.g)
         * smoothstep(0.005, 0.06, originalPaint.g-originalPaint.b);
       float paintDetail = clamp(pow(max(originalPaint.r, 0.001), 0.62), 0.20, 1.0);
       diffuseColor.rgb = mix(originalPaint, robotPaint * paintDetail, orangeMask);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
       roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor, 0.24, 0.34), orangeMask);`)
      .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
       metalnessFactor = mix(metalnessFactor, 0.02, orangeMask);`)
      .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
       #ifdef USE_CLEARCOAT
        material.clearcoat *= orangeMask;
       #endif`)
      // Keep creases and joint shadows, but soften the atlas AO on coloured
      // shells so the shaded sides retain their colour beneath the ceiling.
      .replace('#include <aomap_fragment>',THREE.ShaderChunk.aomap_fragment.replace(
       '( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity',
       '( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity * mix(1.0, 0.58, orangeMask)'))
      .replace('#include <tonemapping_fragment>',`#include <tonemapping_fragment>
       float paintLuma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
       gl_FragColor.rgb = mix(gl_FragColor.rgb,
        clamp(mix(vec3(paintLuma), gl_FragColor.rgb, 1.16), 0.0, 1.0), orangeMask);`);
    };
    m.customProgramCacheKey=()=> 'robot-gloss-paint-v2';
    m.userData.robotPaint=hex;
   }
   return m;
  };
  o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);
 });
 npc.paintMaterials=[...copies.values()];
 const saved=savedPaint()[npc.paintKey];
 setRobotPaint(npc,validHex(saved?.hex)?saved.hex:hex,Number.isFinite(saved?.shade)?saved.shade:DEFAULT_SHADE,{persist:false});
}
