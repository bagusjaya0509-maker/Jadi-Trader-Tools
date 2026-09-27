import * as THREE from 'three';
import {PANGGUNG} from './joget.js';
export const EMOTIONS={auto:'Otomatis',neutral:'Datar',focus:'Fokus',happy:'Senang',sad:'Sedih',thinking:'Merenung',surprised:'Terkejut',confident:'Percaya diri',angry:'Kesal',sleepy:'Mengantuk'};
const targets={
 neutral:{},
 focus:{Look_Y:-.15,Angry:.08},happy:{Happy:.8,Smile:1,Eye_Size:.12},sad:{Sad:1,Frown:.85,Look_Y:-.45,Eye_Size:-.18},
 thinking:{Sad:.28,Frown:.3,Look_X:.40,Look_Y:-.30},surprised:{Eye_Size:.75,Mouth_Open:.70,Mouth_Wide:.22},
 confident:{Happy:.24,Smile:.58,Look_X:.16},angry:{Angry:.9,Frown:.65},sleepy:{Blink_L:.70,Blink_R:.70,Look_Y:-.25,Mouth_Open:.1},
};
const q=new THREE.Quaternion();
export class RobotPerformance{
 constructor(npc){
  this.n=npc;this.manual='auto';this.until=0;this.eventMood=null;this.mood='focus';this.speaking=0;this.levels={};this.last=null;
  this.ears=[];npc.group.updateMatrixWorld(true);
  for(const side of ['L','R']){
   const b=npc.tulang['CTRLear'+side];if(!b)continue;
   const world=b.getWorldQuaternion(new THREE.Quaternion());const right=new THREE.Vector3(1,0,0).applyQuaternion(npc.group.getWorldQuaternion(new THREE.Quaternion()));
   this.ears.push({bone:b,rest:npc.istirahat['CTRLear'+side].clone(),axis:right.applyQuaternion(world.invert()).normalize(),side:side==='L'?1:-1,angle:0});
  }
 }
 setMood(m,time){if(!(m in EMOTIONS))return;this.manual=m;this.until=time+18;}
 react(m,time){this.eventMood=m;this.eventUntil=time+14;}
 observe(data,time,audio){
  if(!data)return;
  const filled=new Set((data.sinyal||[]).filter(s=>s.terisi).map(s=>s.id||[s.pasangan,s.arah,s.tf,s.dibuat].join('|')));
  const now={uid:data.uid,total:data.total,pnl:data.pnl,filled};
  if(this.last?.uid===now.uid){
   if(now.total>this.last.total&&Math.abs(now.pnl-this.last.pnl)>.001){const won=now.pnl>this.last.pnl;this.react(won?'happy':'sad',time);audio.say(won?'profit':'loss',this.n);audio.effect(won?'profit':'loss');}
   else if([...filled].some(k=>!this.last.filled.has(k))){this.react('confident',time);audio.effect('fill');audio.say('fill',this.n);}
  }
  this.last=now;
 }
 update(dt,time){
  this.clock=time;const n=this.n;let mood='focus';
  if(this.manual!=='auto'&&time<this.until)mood=this.manual;
  else if(this.eventMood&&time<this.eventUntil)mood=this.eventMood;
  else if(n.jogetSampai||n.wave>0)mood='happy';
  else if(n.profile.analis?.pnl<0)mood=Math.floor((time+n.index*3)/12)%2?'thinking':'sad';
  else if(n.station.kind==='review')mood='thinking';
  else if(n.station.kind==='coffee')mood='happy';
  else if(n.profile.analis?.pnl>0)mood='confident';
  if(this.manual!=='auto'&&time>=this.until)this.manual='auto';
  this.mood=mood;const t=targets[mood],face=n.face;
  if(face){
   const d=face.morphTargetDictionary,v=face.morphTargetInfluences;v.fill(0);
   for(const name of Object.keys(d)){const want=t[name]||0;this.levels[name]=THREE.MathUtils.damp(this.levels[name]||0,want,7,dt);v[d[name]]=this.levels[name];}
   const b=(time+n.index*1.23)%(4.9+n.index*.6),blink=b<.18?Math.sin(b/.18*Math.PI):0;
   for(const key of ['Blink_L','Blink_R'])if(d[key]!==undefined)v[d[key]]=Math.max(v[d[key]],blink);
   if(d.Look_X!==undefined)v[d.Look_X]+=.07*Math.sin(time*.8+n.index);
   if(this.speakingAudio&&!this.speakingAudio.paused&&!this.speakingAudio.ended&&d.Mouth_Open!==undefined)v[d.Mouth_Open]=.16+.42*Math.abs(Math.sin(time*14));
  }
  const down=mood==='sad'?2.27:mood==='thinking'?1.65:mood==='sleepy'?1.95:mood==='angry'?.25:mood==='surprised'?-.30:mood==='happy'?-.16:0;
  for(const ear of this.ears){
   const flutter=mood==='happy'?Math.sin(time*5+ear.side)*.07:mood==='thinking'?Math.sin(time*.8)*.03:0;
   ear.angle=THREE.MathUtils.damp(ear.angle,down+flutter,6,dt);q.setFromAxisAngle(ear.axis,-ear.angle);ear.bone.quaternion.copy(ear.rest).multiply(q);
  }

 }
}
export class PerformanceAudio{
 constructor(){this.ctx=null;this.enabled=false;this.voices=false;this.volume=.65;this.voice=null;this.lastVoice=-100;this.lastBeat=-1;this.lastDance=-1;this.activeVoice=null;}
 unlock(){if(!this.enabled&&!this.voices)return;if(!this.ctx){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(C){this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);}}this.ctx?.resume().catch(()=>{});}
 setVolume(v){this.volume=v;if(this.master)this.master.gain.setTargetAtTime(v,this.ctx.currentTime,.05);if(this.voice)this.voice.volume=v;}
 effect(kind){
  const c=this.ctx;if(!this.enabled||!c||c.state!=='running')return;const now=c.currentTime;
  const tone=(f,end,duration,gain,type='sine',delay=0)=>{const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,now+delay);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+delay+duration);g.gain.setValueAtTime(gain,now+delay);g.gain.exponentialRampToValueAtTime(.0001,now+delay+duration);o.connect(g);g.connect(this.master);o.start(now+delay);o.stop(now+delay+duration+.02);};
  const hiss=(dur,vol,cut)=>{const b=c.createBuffer(1,Math.ceil(c.sampleRate*dur),c.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.exp(-i/a.length*7);const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=b;f.type='highpass';f.frequency.value=cut;g.gain.value=vol;src.connect(f);f.connect(g);g.connect(this.master);src.start();};
  if(kind==='step'){tone(95,42,.13,.23);hiss(.065,.08,500);}
  else if(kind==='clap'){hiss(.14,.16,1400);tone(420,220,.065,.04);}
  else if(kind==='swoosh')hiss(.17,.045,2900);
  else if(kind==='loss'){tone(280,170,.24,.10);tone(190,110,.36,.10,'triangle',.22);}
  else {const notes=kind==='profit'?[523,659,784]:[880,1175];notes.forEach((f,i)=>tone(f,f,.19,.085,'sine',i*.075));}
 }
 say(key,npc,force=false){
  if(!this.voices||!this.ctx)return;const now=this.ctx.currentTime;
  if(!force&&(now-this.lastVoice<7||this.voice&&!this.voice.paused))return;
  this.lastVoice=now;this.voice?.pause();const a=new Audio('./audio/'+key+'.mp3');this.voice=a;this.activeVoice=npc;
  a.volume=this.volume;a.playbackRate=.96+(npc?.index||0)%4*.035;a.preservesPitch=false;
  a.onplaying=()=>{if(npc?.performance)npc.performance.speakingAudio=a;if(npc?.performance)npc.performance.speaking=(npc.performance.clock||0)+Math.min(8,a.duration||4);};
  a.onended=()=>{if(npc?.performance)npc.performance.speaking=0;};
  a.play().catch(()=>{this.effect('fill');});
 }
 stopVoice(){this.voice?.pause();if(this.activeVoice?.performance)this.activeVoice.performance.speaking=0;}
 dance(joget,npcs,paused){
  if(paused||joget.fase!=='joget'){this.lastBeat=-1;return;}
  const beat=Math.floor(joget.tPose/.46),key=joget.gerakan;
  if(beat===this.lastBeat&&key===this.lastDance)return;this.lastBeat=beat;this.lastDance=key;
  if([0,2,4,5,8].includes(key))this.effect(key===8&&beat%4===3?'clap':'step');
  if(beat%2||[1,6,7,9].includes(key))this.effect('swoosh');
  if(beat%32===0)this.say('cheer',npcs[beat%Math.max(1,npcs.length)]);
 }
}
// Restore exact camera state before controls run: beat offsets never accumulate.
export class BeatCamera{
 constructor(){this.enabled=!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;this.base=null;this.angles=true;this.strength=.75;this.shot=-1;this.shotFrom=null;}
 clear(camera){if(!this.base)return;camera.position.copy(this.base.p);camera.quaternion.copy(this.base.q);camera.fov=this.base.fov;camera.updateProjectionMatrix();this.base=null;}
 apply(camera,joget,paused,interacting){
  if(!this.enabled||paused||interacting||joget.fase!=='joget')return;
  this.base={p:camera.position.clone(),q:camera.quaternion.clone(),fov:camera.fov};
  const b=joget.tPose/.46,phase=b%1,kick=Math.exp(-phase*10)*joget.bobot,accent=Math.floor(b)%4===0?1.35:1;
  if(this.angles){
   const shots=[[4.9,2.45,4.8],[-4.6,2.15,4.9],[1.0,3.6,6.0],[5.7,1.55,3.2],[-3.6,2.7,5.4]],index=Math.floor(b/8)%shots.length;
   const goal=new THREE.Vector3(PANGGUNG.x+shots[index][0],shots[index][1],PANGGUNG.z+shots[index][2]);
   if(index!==this.shot){this.shot=index;this.shotFrom=(this.lastView||camera.position).clone();}
   const blend=THREE.MathUtils.smoothstep(b%8,0,1.25);
   camera.position.lerpVectors(this.shotFrom||goal,goal,blend);
   camera.lookAt(PANGGUNG.x,1.05,PANGGUNG.z);
  }
  this.lastView=camera.position.clone();
  const fwd=new THREE.Vector3();camera.getWorldDirection(fwd);
  camera.fov=Math.max(25,this.base.fov-8.5*this.strength*kick*accent);
  camera.position.addScaledVector(fwd,.22*this.strength*kick);
  camera.translateY(.045*this.strength*kick);
  camera.rotateZ(Math.sin(b*Math.PI)*.018*this.strength*kick);camera.updateProjectionMatrix();
 }
}
