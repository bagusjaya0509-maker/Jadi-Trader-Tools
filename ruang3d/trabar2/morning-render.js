import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// Capture this room's windows, timber and luminous ceiling for the PBR
// reflections. Capture before adding NPCs so reflections never freeze a robot.
export function captureRoomReflections(renderer,scene,size=128){
  if(!size)return;
  const cubeTarget=new THREE.WebGLCubeRenderTarget(size,{type:THREE.HalfFloatType});
  const probe=new THREE.CubeCamera(.08,60,cubeTarget);probe.position.set(-.6,1.45,.2);
  const originalAutoUpdate=renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  const generator=new THREE.PMREMGenerator(renderer);
  try{
    probe.update(renderer,scene);
    const reflection=generator.fromCubemap(cubeTarget.texture);
    const oldEnvironment=scene.environment;
    scene.environment=reflection.texture;oldEnvironment?.dispose();
  }finally{
    renderer.shadowMap.autoUpdate=originalAutoUpdate;
    cubeTarget.dispose();generator.dispose();
  }
}

// Keep glazing, fading walls and the shadow-only roof out of the normal/depth
// prepass. Otherwise transparent windows incorrectly become solid AO blockers.
export class InteriorContactPass extends SSAOPass {
  _renderOverride(renderer,...args){
    const hidden=[];
    this.scene.traverse(o=>{
      if(!o.isMesh||!o.visible)return;
      const materials=Array.isArray(o.material)?o.material:[o.material];
      if(o.userData.excludeFromAO||materials.some(m=>m.transparent&&m.opacity<.98)){
        hidden.push(o);o.visible=false;
      }
    });
    const updateShadows=renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate=false;
    try{super._renderOverride(renderer,...args);}
    finally{for(const o of hidden)o.visible=true;renderer.shadowMap.autoUpdate=updateShadows;}
  }
}

export function createMorningRenderer(renderer,scene,camera,profile){
  if(!profile.bloom&&!profile.ao)return {resize(){},render(){renderer.render(scene,camera);},dispose(){}};
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:profile.samples});
  const composer=new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  let contact;
  if(profile.ao){
  contact=new InteriorContactPass(scene,camera,1,1,24);
  contact.kernelRadius=.42;contact.minDistance=.00009;contact.maxDistance=.008;
  // Scale is in metres; make this contact shading, not a room-wide dark filter.
  contact.ssaoMaterial.fragmentShader=contact.ssaoMaterial.fragmentShader.replace(
    'vec3( 1.0 - occlusion )','vec3( 1.0 - occlusion * 0.65 )');
  composer.addPass(contact);
  }
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.19,.42,2.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const resize=()=>{
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth,innerHeight);
  };
  resize();
  return {resize,render:dt=>composer.render(dt),dispose(){
    for(const pass of composer.passes)pass.dispose?.();
    // r180's SSAOPass disposer omits these two GPU allocations.
    contact?.ssaoMaterial.dispose();contact?.noiseTexture.dispose();composer.dispose();
  }};
}
