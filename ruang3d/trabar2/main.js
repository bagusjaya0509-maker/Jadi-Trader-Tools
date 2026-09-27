import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

import {createMorningRenderer} from './morning-render.js';
import {Joget,PANGGUNG} from './joget.js';
/* ── MUSIK PANGGUNG ────────────────────────────────────────────────────
   `musik.js` dan kelima lagunya SUDAH ADA di server ini, lengkap dengan
   BPM per gerakan dan pemetaan jam audio ke fase langkah. Yang tidak ada
   cuma sambungannya: main.js memanggil `joget.perbarui(dt,npcs)` tanpa
   argumen ketiga, dan tidak seorang pun mengimpor Musik.

   Jadi lagunya terpasang, terdengar nol. Disambungkan di sini. */
import {Musik,LAGU,BAWAAN} from './musik.js';
import {RobotPerformance,PerformanceAudio,BeatCamera,EMOTIONS} from './robot-performance.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {Navigation,stations,roster,clamp,smooth,wrapAngle,marketSeries} from './simulation.js';
import * as HIDUP from './hidup.js';

import {WARM_LOOK,applyWarmMaterials,addWarmCove} from './warm-look.js';
import {typeAtKeyboard} from './keyboard-ik.js';
import {RoomEnvelope} from './room-envelope.js';
import {captureRoomReflections} from './morning-render.js';
import {QUALITY,readQuality,saveQuality,bacaKustom,simpanKustom} from './quality.js';
import {refineRoom,refineNavigation} from './room-refinements.js';
import {LayoutStore} from './layout-store.js';
import {colorRobot,setRobotPaint,resetRobotPaint,PAINT_PRESETS} from './robot-colors.js';
import {restoreDocumentMaterials} from './document-materials.js';
import {applyNumericTransform} from './object-transform.js';
import {createMarketBoard,updateMarketBoard,reserveMarketBoard,MARKET_BOARD_ASSETS} from './market-board.js';
import {StairRoute,moveInTraffic,walkStairSegment,stepOnStairs,clearOfRobots} from './robot-navigation.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

/* ── PROFIL EFEKTIF = PROFIL + SETELAN TANGAN ────────────────────────
   `profilMutu` dipakai belasan tempat di berkas ini dan tetap berupa objek
   biasa — yang berubah cuma cara ia disusun. Menyusunnya sekali di sini
   lebih aman daripada menyuruh tiap pemakainya ingat menimpakan setelan
   manual sendiri; yang lupa tidak akan terlihat sebagai galat, cuma
   sebagai satu setelan yang diam-diam tidak berlaku. */
let perluasanRef=null,atasRef=null,lantaiKembali=[];
let kustomMutu=bacaKustom();
function susunProfil(nama){return Object.assign({},QUALITY[nama],kustomMutu);}
let mutu=readQuality(),profilMutu=susunProfil(mutu),lastDraw=0,roomReflectionReady=false,selubung=null,robotTemplate=null;
const iconPaths={office:'M3 21h18M5 21V5h14v16M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2',monitor:'M3 4h18v12H3zM8 21h8m-4-5v5',chart:'M3 3v18h18M6 15l4-5 4 3 6-7',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M15 3a4 4 0 0 1 0 8m7 10v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',layers:'M12 3 2 8l10 5 10-5-10-5M2 12l10 5 10-5M2 16l10 5 10-5',focus:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',hand:'M8 13V5a2 2 0 0 1 4 0v7-9a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-1-6-4l-3-4a2 2 0 0 1 3-2l1 1',orbit:'M21 12a9 9 0 1 1-5-8M22 3l-1 5-5-1M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',follow:'M12 22v-4m0-12V2M2 12h4m12 0h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0',film:'M3 4h18v16H3zM7 4v16m10-16v16M3 8h4m10 0h4M3 16h4m10 0h4',pause:'M8 5v14M16 5v14',play:'m8 4 12 8-12 8V4Z',help:'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',full:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5'};
const icon=(name)=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[name]||iconPaths.focus}"/></svg>`;
$$('[data-icon]').forEach(e=>e.outerHTML=icon(e.dataset.icon));
for(const [id,name] of [['help-btn','help'],['ui-btn','eye'],['restore-ui','eye'],['fullscreen-btn','full'],['pause-btn','pause']])$('#'+id).innerHTML=icon(name);
const state={time:0,paused:false,speed:1,mode:'orbit',selected:0,cutaway:true,labels:true,loaded:false};
const joget=new Joget();
const musik=new Musik();
/* Indeks lagu yang SEDANG dipasang. `pilih()` async dan dipanggil dari
   loop render; tanpa penanda ini ia akan dipanggil 60 kali per detik untuk
   lagu yang sama, dan tiap panggilan membatalkan yang sebelumnya lewat
   penghitung `request` di dalamnya. */
let musikIndeks=-1;
/* Lagu yang DIPILIH orangnya. -1 = otomatis: tiap gerakan memakai lagu
   bawaan pasangannya. Disimpan per perangkat — ini preferensi, bukan data,
   dan ruangannya toh cuma dibuka pemilik. */
/* ── JAM POSE: NAIK TERUS, SUMBERNYA BOLEH BERGANTI ──────────────────
   Dilaporkan pemilik 23 Sep 2026: saat efek slow motion menyala, musiknya
   ikut melambat dan bunyinya jelek.

   Betul, dan itu sambungan saya sendiri: `playbackRate` diikatkan ke tempo
   tarian, jadi tempo 0,32x menurunkan nada lagunya sepertiga oktaf lebih.
   Yang diminta slow motion adalah GERAKANNYA, bukan lagunya.

   Tapi melepasnya tidak cukup dengan menyetel rate ke 1: joget.js memakai
   jam musik MENGGANTIKAN jam internalnya (`tPose = jamMusik ?? this.t`).
   Kalau lagunya berjalan normal sementara tariannya lambat, tariannya ikut
   normal lagi — slow motion-nya hilang.

   Jadi yang dikirim bukan jam lagunya mentah, melainkan jam POSE yang
   dirawat di sini: ia selalu naik, dan yang berganti cuma SUMBER
   kenaikannya.

     tempo & kecepatan = 1  -> naik mengikuti lagu (terkunci ketukan)
     selain itu             -> naik mengikuti dt x tempo (slow / cepat)

   Selisihnya ditambahkan, bukan disalin, sehingga perpindahan sumber tidak
   pernah melompat. Melompat di sini berarti seluruh robot berganti pose
   seketika — dan itu jauh lebih terlihat daripada tidak terkunci ketukan. */
let jamPose=0,jamLaguSebelum=null;
let laguPilihan=(function(){
  const v=parseInt(localStorage.getItem('jt.trabar.lagu')||'-1',10);
  return Number.isFinite(v)&&v>=0&&v<LAGU.length?v:-1;
})();
function laguSekarang(){return laguPilihan>=0?LAGU[laguPilihan]:BAWAAN[joget.gerakan];}
/* ── LAGU HABIS = PANGGUNG BUBAR ─────────────────────────────────────
   Diminta pemilik 27 Sep 2026. "Lagunya habis" berarti tiga hal yang
   berbeda, tergantung mode:

     Lagu pilihan (1-25)         diputar SEKALI; habis -> bubar.
     Otomatis, gerakan dikunci   pengiring gerakan itu diputar sekali;
                                 habis -> bubar.
     Otomatis, bergantian        pengiringnya berganti tiap gerakan dan
                                 tidak pernah sampai ujung, jadi yang
                                 dihitung PUTARAN: sepuluh gerakan
                                 selesai -> bubar.

   Satu pengecualian: lagu yang habis SEBELUM penarinya sampai di panggung
   diulang dari awal, bukan membubarkan. Ada lagu 12 detik di daftar,
   sedangkan robot terjauh butuh sampai 14 detik untuk tiba — tanpa
   pengecualian ini mereka berjalan ke panggung lalu langsung pulang.

   Bisa dimatikan dari menu Joget ("Berhenti saat lagu habis"). Mati =
   perilaku lama: lagu diulang terus sampai panggung ditutup tangan. */
let jogetBerhentiHabis=(function(){try{return localStorage.getItem('jt.trabar.jogetHabis')!=='0';}catch(e){return true;}})();
let modeSebelumJoget=null;
musik.setUlang(!jogetBerhentiHabis);
musik.onHabis=()=>{
  if(!joget.aktif||!jogetBerhentiHabis)return;
  const medley=laguPilihan<0&&joget.kunci===null;
  if(joget.fase!=='joget'||medley){musik.dariAwal();return;}
  tutupPanggung('Lagu selesai — robot kembali ke meja.',true);
};
const performanceAudio=new PerformanceAudio(),beatCamera=new BeatCamera();
let scene,camera,renderer,controls,pasca,nav,npcs=[],office,layout,tween=null,tourIndex=0,tourTimer=0,wallMeshes=[],screens=[],pickTargets=[],frame=0,lastUI=0,lastScreen=-10,giliranLayar=0,followPrevious=null,lastTime=performance.now(),interacting=false;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let toastTimer,marketBoard,stairRoute=null;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2800);}
function fail(error){console.error(error);$('#loading').classList.remove('done');$('#loading-text').textContent='Kantor belum berhasil dimuat. Periksa koneksi dan dukungan WebGL browser, lalu coba lagi.';$('#loading-note').textContent='Chrome atau Edge desktop disarankan';$('#retry-btn').hidden=false;$('#retry-btn').onclick=()=>location.reload();}
window.addEventListener('error',e=>{if(!state.loaded)fail(e.error||e.message);});
window.addEventListener('unhandledrejection',e=>{if(!state.loaded)fail(e.reason);});

function setupRenderer(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,profilMutu.pixelRatio));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=WARM_LOOK.exposure;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;$('#world').appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Kantor 3D. Seret untuk memutar, scroll untuk zoom.');
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();state.paused=true;toast('Tampilan 3D terhenti. Muat ulang halaman untuk melanjutkan.');});
  scene=new THREE.Scene();scene.background=new THREE.Color(WARM_LOOK.background);scene.fog=new THREE.Fog(WARM_LOOK.background,160,300);
  camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.07,320);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.minDistance=1.8;controls.maxDistance=200;controls.maxPolarAngle=Math.PI*.74;controls.minPolarAngle=.045;controls.rotateSpeed=.65;controls.zoomSpeed=.85;controls.panSpeed=.7;controls.screenSpacePanning=true;controls.listenToKeyEvents(window);
  controls.target.set(3.4,1.45,-1.35);camera.position.set(-6.3,1.85,3.25);controls.update();
  const pmrem=new THREE.PMREMGenerator(renderer);const env=new RoomEnvironment();scene.environment=pmrem.fromScene(env,.045).texture;scene.environmentIntensity=WARM_LOOK.environmentIntensity;env.dispose();pmrem.dispose();
  const hemi=new THREE.HemisphereLight(WARM_LOOK.sky,WARM_LOOK.bounce,WARM_LOOK.ambient);scene.add(hemi);
  const key=new THREE.DirectionalLight(WARM_LOOK.sunlight,WARM_LOOK.sunlightIntensity);
  key.name='Morning sunlight through rear glazing';key.position.set(-14,8,-14);key.target.position.set(0,0,0);
  key.castShadow=true;const shadowSize=Math.min(renderer.capabilities.maxTextureSize,profilMutu.shadowSize);
  key.shadow.mapSize.set(shadowSize,shadowSize);
  key.position.set(-16,14,-13);key.target.position.set(-.65,0,8);
  Object.assign(key.shadow.camera,{left:-21,right:21,top:23,bottom:-23,near:.5,far:75});
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias=.012;key.shadow.bias=-.000035;key.shadow.radius=2;scene.add(key,key.target);
  const fill=new THREE.DirectionalLight(WARM_LOOK.fill,WARM_LOOK.fillIntensity);fill.position.set(10,8,8);scene.add(fill);
  // This is the studio backdrop, not the office floor. Hidden ceiling shadow
  // occluders must not project enormous black silhouettes outside the model.
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:WARM_LOOK.ground,roughness:.86,metalness:.05}));ground.name='Latar studio';ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=false;ground.userData.takBisaDiatur=true;scene.add(ground);
  const grid=new THREE.GridHelper(140,70,'#44443b','#36372f');grid.position.y=-.158;grid.material.transparent=true;grid.material.opacity=.10;grid.userData.takBisaDiatur=true;scene.add(grid);
  controls.addEventListener('start',()=>{interacting=true;tween=null;if(state.mode==='cinema')setMode('orbit',false);});controls.addEventListener('end',()=>{interacting=false;});
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);pasca?.resize();});
  let start={x:0,y:0};renderer.domElement.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};});renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||editMode||e.ctrlKey||e.metaKey||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5||!state.loaded)return;pick(e);});
  renderer.domElement.addEventListener('contextmenu',e=>{e.preventDefault();if(state.loaded&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<6)pickKanan(e);});
}
function officeCenter(){const b=layout?.stair?.bounds||layout?.expansion?.bounds;return b?V((b[0][0]+b[1][0])*.5,.7,(b[0][2]+b[1][2])*.5):V(-.65,.7,.25);}
function overviewPosition(){const mobile=Math.max(1,1.1/(innerWidth/innerHeight));return officeCenter().add(V(31,34,40).multiplyScalar(mobile));}


function box(size,position,color,metalness=.2){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.5,metalness}));m.position.set(...position);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}

function loadOffice(gltf,extension,desks,stair){
  office=gltf.scene;
  /* ── DUA OBJEK LANTAI DISIMPAN, SISANYA TETAP DIBUANG ────────────────
     Dilaporkan pemilik 26 Sep 2026: mematikan "Perluasan kantor" membuat
     lantainya bolong. Sebabnya perluasan tidak sekadar MENAMBAH ruangan —
     ia menggantikan bagian kantor utama, dan yang digantikan dibuang
     permanen di baris ini. Begitu penggantinya bisa disembunyikan,
     pembuangan permanen itu berubah jadi lubang.

     ── KENAPA CUMA DUA, DAN KENAPA SESEMPIT INI ────────────────────────
     Percobaan 26 Sep: mengembalikan lebih banyak dari ini memunculkan
     tembok besar melengkung yang seharusnya tidak ada. Dikembalikan ke nol
     oleh pemilik, temboknya hilang — jadi batas amannya terbukti ada di
     sekitar sini, bukan ditebak.

     Yang dikembalikan HANYA dua pelat lantai, dan keduanya tidak mungkin
     terbaca sebagai tembok — tingginya 9 cm dan 5 cm:

       office-002  Oak floor, continuous custom footprint  17,3 x 0,09 x 15,8
       office-003  Dark thin foundation rim                17,3 x 0,05 x 15,8

     Yang TIDAK dikembalikan, dan tetap dibuang permanen seperti semula:
     office-001 (Dinding belakang dan kiri), office-004 (Curved white upper
     frontage beam), office-132, dan office-062..077.

     Selubung ruangan (plafon, jendela, garis denah) SENGAJA tidak
     disentuh sama sekali di putaran ini. Satu perubahan, satu hal yang
     bisa dinilai. */
  /* ── SATU PELAT SAJA, BUKAN DUA ──────────────────────────────────────
     Dilaporkan pemilik 26 Sep 2026, dan ini pengamatan yang langsung
     menunjuk sebabnya: "kalau ambient occlusion-nya dicentang langsung
     muncul garis."

     `office-003` (Dark thin foundation rim) berukuran 17,3 x 15,8 — persis
     sama dengan `office-002` — dan duduk di ketinggian yang nyaris sama:
     0,05 lawan 0,09 meter. Dua permukaan sedekat itu tidak terlihat apa-apa
     pada render biasa; yang membacanya prapas kedalaman milik SSAO.
     Selisih 4 cm itu jatuh di sekitar `maxDistance` (0,008 m) yang dipakai
     `InteriorContactPass`, jadi tiap tepi pertemuannya dihitung sebagai
     sudut yang harus digelapkan — dan yang tergambar garis panjang
     mengikuti bentuk lantainya.

     Rim-nya memang tidak dibutuhkan sendirian: ia tepi bawah lantai, dan
     yang menutup lubang adalah papan oaknya. Dilepas, garisnya tidak punya
     dua permukaan untuk diperbandingkan lagi. */
  const lantaiPengganti=new Set(['office-002']);
  const replaced=new Set(['office-132',...(layout.expansion?.replacedObjects||[]),...(layout.stair?.replacedObjects||[]),...Array.from({length:16},(_,i)=>'office-'+String(62+i).padStart(3,'0'))]),removed=[];
  lantaiKembali=[];
  office.traverse(o=>{
    const id=o.userData.objectId;
    if(!replaced.has(id))return;
    if(lantaiPengganti.has(id)){
      /* Disimpan, bukan dibuang: disembunyikan sekarang, dimunculkan lagi
         persis saat penggantinya disembunyikan. `takBisaDiatur` supaya ia
         tidak masuk daftar "Pilih objek" — ini bagian bangunan, bukan
         perabot yang boleh digeser. */
      o.visible=false;o.userData.takBisaDiatur=true;lantaiKembali.push(o);
      return;
    }
    removed.push(o);
  });
  for(const o of removed)o.removeFromParent();
  /* Rujukan disimpan supaya keduanya bisa disembunyikan belakangan.
     Bukan dicari ulang lewat traverse: sesudah `office.add`, isinya
     bercampur dengan kantor utama dan tidak ada penanda yang membedakan
     "ini bagian perluasan" selain rujukan ini sendiri. */
  perluasanRef=extension?.scene||null;atasRef=stair?.scene||null;
  if(extension)office.add(extension.scene);
  office.add(desks.scene);
  if(stair)office.add(stair.scene);
  refineRoom(office,layout);
  office.updateMatrixWorld(true);
  for(let i=0;i<8;i++){
    stations['analis'+i].keyboard=office.getObjectByName('Keyboard_Analis_'+i);
    stations['analis'+i].chair=office.getObjectByName('Kursi_Analis_'+i);
    const parts=[office.getObjectByName('Monitor_Analis_'+i),office.getObjectByName('Layar_Analis_'+i)];
    const g=new THREE.Group();g.name='Monitor analis '+(i+1);
    g.userData={objectId:'analyst-monitor-'+i,objectName:g.name,category:'FURNITURE',selectAsWhole:true};
    const bounds=new THREE.Box3();for(const p of parts)if(p)bounds.expandByObject(p);
    g.position.copy(bounds.getCenter(V()));office.add(g);g.updateMatrixWorld(true);
    for(const p of parts)if(p){delete p.userData.objectId;p.userData.selectAsWhole=false;g.attach(p);}
  }
  scene.add(office);
  office.traverse(o=>{
    if(!o.isMesh)return;
    let parent=o;while(parent&&!parent.userData.category)parent=parent.parent;
    const category=parent?.userData.category||'STATIC';o.userData.category=category;
    o.castShadow=category!=='FLOOR';o.receiveShadow=true;
    if(category==='WALL')o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(let i=0;i<mats.length;i++){
      let m=mats[i];if(!m)continue;m.envMapIntensity=.6;
      if(m.name==='Clear architectural glass'||m.name==='Architectural glass'){
        const glass=new THREE.MeshStandardMaterial({name:'Architectural glass',color:WARM_LOOK.glass,transparent:true,opacity:.105,metalness:.08,roughness:.15,depthWrite:false,side:THREE.DoubleSide});
        if(Array.isArray(o.material))o.material[i]=glass;else o.material=glass;
        o.castShadow=false;o.renderOrder=3;
      }
      if(category==='WALL'){m.transparent=false;m.opacity=1;m.depthWrite=true;m.userData.baseOpacity=1;o.castShadow=false;}
    }
    if(category==='WALL')wallMeshes.push(o);
  });
  applyWarmMaterials(office);restoreDocumentMaterials(office);addWarmCove(scene,layout);office.updateMatrixWorld(true);
  office.traverse(o=>{
    if(!o.userData.objectId||['WALL','FLOOR','PARTITION','CARPET'].includes(o.userData.category))return;
    const bounds=new THREE.Box3().setFromObject(o),size=bounds.getSize(V());
    o.userData.focus={point:bounds.getCenter(V()),distance:Math.max(1.8,size.length()*1.5),label:o.userData.objectName||o.name};
    pickTargets.push(o);
  });
}


function chart(ctx,x,y,w,h,seed,time,small=false,koin=null,tf=HIDUP.TF_BAWAAN){
  const data=(koin&&HIDUP.deret(koin,tf,48))||marketSeries(seed,48,time);

  let lo=Math.min(...data.map(p=>p.low)),hi=Math.max(...data.map(p=>p.high));
  const bantal=(hi-lo)*.09||Math.abs(hi)*.001||.4;
  lo-=bantal;hi+=bantal;
  const cy=v=>y+h-(v-lo)/(hi-lo)*h;

  const lajur=small?52:62,pw=Math.max(40,w-lajur);
  ctx.strokeStyle='#17313d';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const yy=y+i*h/4;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+pw,yy);ctx.stroke();}
  for(let i=0;i<=6;i++){const xx=x+i*pw/6;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+h);ctx.stroke();}
  const step=pw/data.length;
  for(let i=0;i<data.length;i++){
    const p=data[i],xx=x+i*step+step*.5,color=p.close>=p.open?'#68d5b0':'#dd7b73';
    ctx.fillStyle=color;ctx.strokeStyle=color;
    ctx.beginPath();ctx.moveTo(xx,cy(p.high));ctx.lineTo(xx,cy(p.low));ctx.stroke();
    ctx.fillRect(xx-step*.3,cy(Math.max(p.open,p.close)),step*.6,Math.max(2,Math.abs(cy(p.open)-cy(p.close))));
    ctx.globalAlpha=.25;ctx.fillRect(xx-step*.3,y+h+6,step*.6,p.volume*.35);ctx.globalAlpha=1;
  }
  ctx.strokeStyle='#d7ab68';ctx.lineWidth=1.6;ctx.beginPath();
  data.forEach((p,i)=>{const start=Math.max(0,i-7),avg=data.slice(start,i+1).reduce((a,q)=>a+q.close,0)/(i-start+1);
    if(i)ctx.lineTo(x+(i+.5)*step,cy(avg));else ctx.moveTo(x+.5*step,cy(avg));});
  ctx.stroke();

  ctx.fillStyle='#6b8797';ctx.font=`${small?11:13}px ui-monospace,monospace`;ctx.textAlign='right';
  for(let i=0;i<=4;i++){
    const v=hi-(hi-lo)*i/4,yy=y+i*h/4+(i===0?10:i===4?-3:4);
    ctx.fillText(HIDUP.angka(v),x+w-3,yy);
  }
  ctx.textAlign='left';

  const akhir=data[data.length-1];
  if(akhir){
    const yy=Math.max(y+8,Math.min(y+h-3,cy(akhir.close)));
    const naik=akhir.close>=akhir.open;
    ctx.fillStyle=naik?'#1c4a3d':'#4a2320';
    ctx.fillRect(x+pw+2,yy-(small?8:10),lajur-5,small?16:20);
    ctx.fillStyle=naik?'#8ee7c0':'#f3a29a';
    ctx.font=`${small?11:13}px ui-monospace,monospace`;ctx.textAlign='right';
    ctx.fillText(HIDUP.angka(akhir.close),x+w-3,yy+(small?4:5));ctx.textAlign='left';
  }
  ctx.fillStyle='#8aa8b8';ctx.font=`${small?12:16}px monospace`;
  const cap=i=>{const d=data[Math.max(0,Math.min(data.length-1,i))];return d&&d.t?HIDUP.jam(new Date(d.t)):'--:--';};
  ctx.fillText(cap(0),x,y+h+48);
  ctx.fillText(cap(data.length>>1),x+pw*.45,y+h+48);
  ctx.fillText(cap(data.length-1),x+pw-52,y+h+48);
}

function paintTerminal(canvas,kind,time=0,koinLayar=null,tf=HIDUP.TF_BAWAAN){const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.fillStyle='#08141d';ctx.fillRect(0,0,w,h);
  const boardAssets=kind.endsWith('-left')?MARKET_BOARD_ASSETS.slice(0,3):kind.endsWith('-right')?MARKET_BOARD_ASSETS.slice(3):MARKET_BOARD_ASSETS;
  const hidup=HIDUP.statusPasar().live,pct=u=>u===null?'--':(u>=0?'+':'\u2212')+Math.abs(u).toFixed(2)+'%',warna=u=>u===null?'#89a0b0':u>=0?'#78d6b2':'#df8e85';
  if(kind.startsWith('wall')){
    ctx.fillStyle='#e0eaf0';ctx.font='600 30px sans-serif';ctx.fillText('GLOBAL MARKETS',38,47);
    ctx.fillStyle='#89a0b0';ctx.font='16px monospace';ctx.fillText('PERPETUAL 1m  /  HYPERLIQUID  /  SATU JAM TERAKHIR',38,80);
    ctx.fillStyle=hidup?'#8ddbba':'#e6ae65';ctx.fillText(hidup?'DATA LANGSUNG  \u2022  '+HIDUP.jam():'DATA BELUM LENGKAP',w-400,48);
    ctx.fillStyle='#18313d';ctx.fillRect(36,105,w-72,1);
    boardAssets.forEach((koin,i)=>{const x=38+i*(w-55)/boardAssets.length,cw=(w-120)/boardAssets.length,u=HIDUP.ubah(koin);
      ctx.fillStyle='#b8ced9';ctx.font='19px monospace';ctx.fillText(koin+' / USD',x,149);
      ctx.fillStyle='#f0f6f8';ctx.font='500 35px sans-serif';ctx.fillText(HIDUP.angka(HIDUP.harga(koin)),x,194);
      ctx.fillStyle=warna(u);ctx.font='17px monospace';ctx.fillText(pct(u),x+cw-92,147);
      chart(ctx,x,222,cw-20,h-320,2+i*3.4,time,false,koin);});
    ctx.fillStyle='#819bab';ctx.font='14px monospace';ctx.fillText('MULTI-ASSET RESEARCH     |     RISK FIRST     |     DESK ONLINE',38,h-21);
  }else if(kind.startsWith('ticker')){
    ctx.fillStyle='#93aebb';ctx.font='600 26px monospace';ctx.fillText('HYPERLIQUID  /',30,61);
    boardAssets.forEach((koin,i)=>{const u=HIDUP.ubah(koin);ctx.fillStyle=warna(u);
      ctx.fillText(koin+'  '+HIDUP.angka(HIDUP.harga(koin))+'   '+pct(u),300+i*(w-330)/boardAssets.length,61,(w-330)/boardAssets.length-18);});
  }else{
    const koin=koinLayar||'BTC',hidup=HIDUP.segar(koin,tf),harga=HIDUP.harga(koin,tf),u=HIDUP.ubah(koin,tf);
    ctx.fillStyle='#d6e5ed';ctx.font='600 29px sans-serif';ctx.fillText(koin+' / USD',24,42);
    ctx.fillStyle='#89a6b6';ctx.font='15px monospace';ctx.fillText('PERPETUAL / '+tf+' \u00b7 HYPERLIQUID',24,68);
    ctx.fillStyle=warna(u);ctx.font='22px monospace';ctx.fillText(HIDUP.angka(harga),w-250,44);
    ctx.font='13px monospace';ctx.fillText(pct(u),w-250,68);
    ctx.globalAlpha=hidup?.35+.65*Math.abs(Math.sin(time*2.2)):.22;ctx.fillStyle=hidup?'#8ddbba':'#708d9e';
    ctx.beginPath();ctx.arc(w-42,38,7,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle='#708d9e';ctx.font='12px monospace';ctx.fillText(hidup?HIDUP.jam():(harga===null?'SIMULASI':'TERTUNDA'),w-104,71);
    chart(ctx,24,105,w*.73,h-190,2,time,true,koin,tf);
    ctx.fillStyle='#102630';ctx.fillRect(w*.79,92,1,h-120);ctx.font='12px monospace';ctx.fillStyle='#91aab8';ctx.fillText('ILUSTRASI DEPTH',w*.80,110);

    const poros=harga||100.12,tick=poros*.0006;
    const des=poros>=1000?1:poros>=10?3:poros>=1?4:6;
    for(let i=0;i<15;i++){ctx.fillStyle=i<7?'#db8f8a':'#82cab0';
      ctx.fillText((poros+(7-i)*tick).toFixed(des),w*.82,137+i*19);
      ctx.globalAlpha=.12;ctx.fillRect(w*.82,124+i*19,35+Math.abs(Math.sin(i*2.4+time*.6))*70,15);ctx.globalAlpha=1;}
    ctx.fillStyle='#8dabbb';ctx.font='13px monospace';ctx.fillText('RESEARCH   /   POSITIONS   /   JOURNAL',24,h-20);
  }
}

function marketTexture(kind,koin=null,tf=HIDUP.TF_BAWAAN){const c=document.createElement('canvas');c.width=kind.startsWith('wall')||kind.startsWith('ticker')?(kind.endsWith('-left')?1536:kind.endsWith('-right')?1024:2560):768;c.height=kind.startsWith('wall')?640:kind.startsWith('ticker')?96:512;
  if(koin)HIDUP.langgan(koin,tf);paintTerminal(c,kind,0,koin,tf);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;

  const rek={canvas:c,texture:tex,kind,koin,tf};screens.push(rek);return rek;}
function screenMaterial(texture){return new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide});}
function setupMarkets(){

  let antre=0;
  const koinBerikut=()=>HIDUP.KOIN_LAYAR[antre++%HIDUP.KOIN_LAYAR.length];

  for(const k of MARKET_BOARD_ASSETS)HIDUP.langgan(k,HIDUP.TF_BAWAAN);
  const dindingPasar=['left','right'].map(side=>marketTexture('wall-'+side).texture),pitaHarga=['left','right'].map(side=>marketTexture('ticker-'+side).texture);
  for(const s of layout.screens.filter(s=>!s.art)){const kind=s.art?'wall':'terminal';const rek=s.art?null:marketTexture('terminal',koinBerikut());const plane=new THREE.Mesh(new THREE.PlaneGeometry(...s.size),screenMaterial(s.art?dindingPasar:rek.texture));if(rek)plane.userData.layar=rek;plane.position.fromArray(s.position);plane.quaternion.fromArray(s.quaternion);plane.position.add(V(0,0,.013).applyQuaternion(plane.quaternion));plane.name=s.art?'Dinding pasar':('Layar '+(rek?rek.koin:''));plane.userData.focus={label:s.art?'Market wall':'Trading desk',point:plane.position.clone(),distance:s.art?5.1:3};scene.add(plane);pickTargets.push(plane);}
  marketBoard=createMarketBoard(scene,dindingPasar,pitaHarga);pickTargets.push(marketBoard);updateMarketBoard(marketBoard,stations.market);reserveMarketBoard(marketBoard,nav);
  // Enam terminal analis di meja oak — satu untuk tiap kursi teal, jadi
  // meja panjang ini yang jadi ruang trading analis, bukan ruang rapat.

  MEJA_ANALIS.forEach((m,i)=>{const x=m.x,z=m.sisi>0?.17:-.15;
    const p=office.getObjectByName('Layar_Analis_'+i);
    if(!p){console.warn('[3d] Layar_Analis_'+i+' tidak ada di office.glb');return;}
    const rek=marketTexture('terminal',koinBerikut());
    p.material=screenMaterial(rek.texture);
    p.userData.layar=rek;p.name='Layar analis '+rek.koin;
    p.userData.focus={label:'Ruang trading analis',point:V(x,1.1,z),distance:4.2};pickTargets.push(p);});
  // Small area lights reflect the new market panels onto the room.

  for(const z of [-1,4]){const l=new THREE.PointLight('#aad6ff',2.5,3,2);l.position.set(1,1.5,z);scene.add(l);}
  const hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
  for(const s of [{p:[1.63,.94,-.82],size:[2.15,.18,1.3],label:'Central trading desk',d:4.3},{p:[-2.79,.88,.015],size:[4.1,.15,1.12],label:'Forex research desk',d:5},{p:[.49,1.065,4.26],size:[4.05,.15,.88],label:'Crypto desk',d:5},{p:[3.22,.88,-6],size:[2,.15,2],label:'Ruang rapat',d:4.6}]){const hit=new THREE.Mesh(new THREE.BoxGeometry(...s.size),hitMaterial);hit.position.fromArray(s.p);hit.userData.focus={label:s.label,point:hit.position.clone(),distance:s.d};scene.add(hit);pickTargets.push(hit);}
}

const KURSI_X=[-3.891,-2.791,-1.691,-0.591];
const MEJA_ANALIS=[...KURSI_X.map(x=>({x,sisi:-1})),...KURSI_X.map(x=>({x,sisi:1}))];
MEJA_ANALIS.forEach((m,i)=>{stations['analis'+i]={label:'Ruang trading analis',activity:'Menjaga sinyal berjalan',kind:'type',
  position:[m.x,m.sisi>0?1.04:-1],look:[m.x,m.sisi>0?.1:-.06],
  tempat:[m.x,m.sisi>0?.95:-.87],dudukY:.496,duration:900,duduk:true};});

Object.assign(stations,{
  sofa:{label:'Sofa oranye',activity:'Menunggu peluang sambil bersandar',kind:'coffee',
    position:[4.7,-1.5],look:[3.4,-1.55],tempat:[5.5,-1.55],dudukY:.535,duration:24,duduk:true},
  sofa2:{label:'Sofa oranye kedua',activity:'Mengawasi ruangan',kind:'coffee',
    position:[4.7,1.45],look:[3.4,1.47],tempat:[5.45,1.47],dudukY:.535,duration:22,duduk:true},
  bistro:{label:'Meja bistro',activity:'Melepas penat sebentar',kind:'coffee',
    position:[4.35,3.3],look:[3.99,2.54],tempat:[4.95,3.75],dudukY:.46,duration:19,duduk:true},
  teras:{label:'Kursi dekat jendela',activity:'Menikmati ruangan',kind:'coffee',
    position:[4.9,4.2],look:[4.33,4.46],tempat:[5.46,4.58],dudukY:.444,duration:18,duduk:true},
  pohon:{label:'Kursi bawah pohon',activity:'Istirahat di sudut hijau',kind:'coffee',
    position:[-5.6,-3.2],look:[-7.4,-3.1],tempat:[-6.01,-3.48],dudukY:.494,duration:20,duduk:true},
  taman:{label:'Sudut tanaman',activity:'Meregangkan badan',kind:'review',position:[-6.6,-.55],look:[-7.6,-1.1],duration:15},
});
const SANTAI=['sofa','bistro','sofa2','teras','pohon','lounge','research','briefing','stairLounge'];

const DUDUK={

  pahaTurun:.15, betisMaju:.2,

  pangkalPaha:.59,

  bantal:.035};

function kumpulkanKursi(st){
  if(!st.tempat||!office)return;
  const MIRIP=/chair|kursi|seat cushion|swivel|caster|five-star|splayed|stool/i;
  const pusat=new THREE.Vector3(st.tempat[0],0,st.tempat[1]);

  const arah=new THREE.Vector3(st.tempat[0]-st.look[0],0,st.tempat[1]-st.look[1]);
  if(arah.lengthSq()<1e-6)arah.set(0,0,1);
  arah.normalize();
  const bagian=[];
  const w=new THREE.Vector3(),q=new THREE.Quaternion();
  if(st.chair){
    st.chair.parent.getWorldQuaternion(q);
    st.kursi=[{o:st.chair,asal:st.chair.position.clone(),arah:arah.clone().applyQuaternion(q.invert())}];return;
  }
  office.traverse(o=>{
    if(!o.isMesh||!MIRIP.test(o.name||''))return;
    o.getWorldPosition(w);
    if(Math.hypot(w.x-pusat.x,w.z-pusat.z)>.6)return;
    o.parent.getWorldQuaternion(q);
    bagian.push({o,asal:o.position.clone(),
                 arah:arah.clone().applyQuaternion(q.invert())});
  });
  if(bagian.length)st.kursi=bagian;
}

const TARIK_KURSI=.34;
function geserKursi(st){
  if(!st.kursi)return;
  const t=smooth(st.tarik||0);
  for(const b of st.kursi)if(atur.objek!==b.o)b.o.position.copy(b.asal).addScaledVector(b.arah,t*TARIK_KURSI);
}

function ukurKursi(st){
  if(!st.tempat)return;
  if(st.chair){
    const p=st.chair.getWorldPosition(V());st.tempat=[p.x,p.z];st.dudukY=p.y+(st.chair.userData.seatHeight??.435)*st.chair.scale.y;
    st.hadap=Math.atan2(st.look[0]-p.x,st.look[1]-p.z);
    const forward=st.chair.userData.seatForwardOffset??.09;
    st.tempatDuduk=[p.x+Math.sin(st.hadap)*forward,p.z+Math.cos(st.hadap)*forward];
    st.position=[p.x-Math.sin(st.hadap)*.16,p.z-Math.cos(st.hadap)*.16];
    /* ── SANDARANNYA DIUKUR, BUKAN DIPERCAYA ─────────────────────────
       Dilaporkan pemilik 23 Sep 2026: punggung robot menembus sandaran
       kursi analis.

       Sebabnya angka `seatForwardOffset` di dalam GLB: 0,09 m. Itu
       nilai yang ditulis pembuat asetnya, dan untuk kursi INI ia salah.
       Diukur dari mesh kursinya sendiri (sinar di sumbu z, x=0, ruang
       lokal kursi) permukaan DEPAN sandarannya ada di:

         y 0,59 -> z -0,161      y 0,74 -> z -0,201
         y 0,64 -> z -0,171      y 0,79 -> z -0,216
         y 0,69 -> z -0,184

       Punggung robot — ransel di belakang badannya — berada 0,29 sampai
       0,305 m di belakang titik duduknya. Dengan maju 0,09 m,
       punggungnya mendarat di z -0,20 sementara sandarannya sudah mulai
       di z -0,161: robotnya tenggelam 5 cm ke dalam sandaran, dan itu
       yang terlihat di layar.

       Yang benar 0,144 m. Tapi angka itu TIDAK ditulis di sini juga:
       `ukurMajuDuduk` sudah ada dan sudah dipakai kursi-kursi lain — ia
       menembakkan sinar ke sandaran dan menghitung sendiri. Dulu cabang
       ini melewatinya karena kursi yang dikenali namanya dianggap sudah
       membawa ukurannya sendiri. Ternyata ukurannya yang dibawa itu
       yang salah.

       Memanggilnya di sini berarti kursi yang digeser atau diganti lewat
       "Pilih objek" ikut terukur ulang — `ukurKursi` dipanggil lagi tiap
       kali kursinya dipindah. */
    ukurMajuDuduk(st,new THREE.Raycaster());
    return;
  }
  const rc=new THREE.Raycaster();
  const [tx,tz]=st.tempat;
  const kena=[];
  for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){
    const x=tx+i*.09,z=tz+j*.09;
    rc.set(V(x,2.4,z),V(0,-1,0));

    const tumpuk=rc.intersectObject(office,true);
    const h=tumpuk.find(t=>t.point.y>.30&&t.point.y<.72);
    if(h)kena.push({x,z,y:h.point.y});
  }
  if(kena.length<6)return;

  const laci=new Map();
  for(const p of kena){const k=Math.round(p.y/.02);laci.set(k,(laci.get(k)||0)+1);}
  let terbaik=null,banyak=0;
  for(const [k,n] of laci)if(n>banyak||(n===banyak&&k<terbaik)){terbaik=k;banyak=n;}
  const bidang=terbaik*.02;
  const atas=kena.filter(p=>Math.abs(p.y-bidang)<.04);
  if(atas.length<6)return;
  st.tempat=[atas.reduce((a,p)=>a+p.x,0)/atas.length,
             atas.reduce((a,p)=>a+p.z,0)/atas.length];
  st.dudukY=atas.reduce((a,p)=>a+p.y,0)/atas.length;

  const asal=V(st.tempat[0],st.dudukY+.15,st.tempat[1]);
  let sx=0,sz=0;
  rc.far=.5;
  for(let a=0;a<16;a++){
    const t=a/16*Math.PI*2,dx=Math.sin(t),dz=Math.cos(t);
    rc.set(asal,V(dx,0,dz));
    const h=rc.intersectObject(office,true)[0];

    if(h){const b=1-h.distance/.5;sx+=dx*b;sz+=dz*b;}
  }
  rc.far=Infinity;
  if(Math.hypot(sx,sz)>.35)st.hadap=Math.atan2(-sx,-sz);
  ukurMajuDuduk(st,rc);
}

const PUNGGUNG_ROBOT=.305;   // kedalaman punggung di belakang titik duduk
const MAJU_MAKS=.18;         // lebih dari ini robot duduk di ujung dudukan
function ukurMajuDuduk(st,rc){
  if(!st.tempat||!office)return;
  const h=st.hadap!==undefined
    ? st.hadap
    : Math.atan2(st.look[0]-st.tempat[0],st.look[1]-st.tempat[1]);
  const fx=Math.sin(h),fz=Math.cos(h);
  let maju=0;
  rc.far=1.3;

  for(const dy of [.15,.20,.25,.30,.35]){
    const a=V(st.tempat[0]+fx*.55,st.dudukY+dy,st.tempat[1]+fz*.55);
    rc.set(a,V(-fx,0,-fz));

    for(const k of rc.intersectObject(office,true)){
      const d=(k.point.x-st.tempat[0])*fx+(k.point.z-st.tempat[1])*fz;
      if(d>-.02)continue;
      maju=Math.max(maju,d+PUNGGUNG_ROBOT);
      break;
    }
  }
  rc.far=Infinity;
  maju=Math.min(maju,MAJU_MAKS);
  if(maju>.01){
    st.tempatDuduk=[st.tempat[0]+fx*maju,st.tempat[1]+fz*maju];
    st.majuDuduk=maju;
  }
}

const _qA=new THREE.Quaternion(),_qB=new THREE.Quaternion(),_vA=new THREE.Vector3();
function arahkanTulang(tulang,arah,bobot){
  if(!tulang||!tulang.parent)return;
  tulang.updateWorldMatrix(true,false);
  tulang.getWorldQuaternion(_qA);
  _vA.set(0,1,0).applyQuaternion(_qA).normalize();
  _qA.premultiply(_qB.setFromUnitVectors(_vA,arah));
  tulang.parent.getWorldQuaternion(_qB);
  _qA.premultiply(_qB.invert());
  tulang.quaternion.slerp(_qA,bobot);
}

let daftarPemain=roster;
const esc=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const seatByUid=new Map();
const KURSI=['analis0','analis1','analis2','analis3','analis4','analis5','analis6','analis7','futures','crypto','market'];

function bagiKursi(analis){
  const present=new Set(analis.map(a=>a.uid));for(const uid of seatByUid.keys())if(!present.has(uid))seatByUid.delete(uid);
  const taken=new Set(seatByUid.values());
  for(const a of [...analis].sort((a,b)=>String(a.uid).localeCompare(String(b.uid))))if(!seatByUid.has(a.uid)){
    const slot=KURSI.slice(0,8).find(k=>!taken.has(k));seatByUid.set(a.uid,slot);taken.add(slot);
  }
  return analis.map((a,i)=>{const home=seatByUid.get(a.uid),sibuk=a.sinyalDiketahui===false||a.sinyal.length>0;
    return {sibuk,home,rute:sibuk?[home]:[home,SANTAI[i%SANTAI.length],home,SANTAI[(i+3)%SANTAI.length]]};});
}

function pemainDariAnalis(a,i,bagi){
  return {name:HIDUP.uang(a.pnl),role:a.nama,route:bagi[i].rute,
          offset:i*3.2,home:bagi[i].home,analis:a,punya:bagi[i].sibuk};
}

async function segarkanAnalis(){
  if(joget.aktif)return;
  let list;
  try{list=(await HIDUP.daftarAnalis()).slice(0,8);}catch(e){HIDUP.kabar.kartuGalat=e.message;return;}
  HIDUP.kabar.kartuGalat=null;
  if(!list.length){HIDUP.kabar.kartuGalat='Belum ada analis yang memenuhi syarat';return;}
  const selectedUid=npcs[state.selected]?.profile.analis?.uid;
  const byUid=new Map(npcs.filter(n=>n.profile.analis).map(n=>[n.profile.analis.uid,n]));
  const assignment=bagiKursi(list),keep=new Set();
  daftarPemain=list.map((a,i)=>pemainDariAnalis(a,i,assignment));
  const next=list.map((a,i)=>{
    let n=byUid.get(a.uid);
    if(!n)n=new NPC(i,robotTemplate);
    else{
      n.performance?.observe(a,state.time,performanceAudio);
      const previous=n.profile.route.join('|');
      n.index=i;n.profile=daftarPemain[i];
      if(!n.excursion&&previous!==n.profile.route.join('|')){n.routeIndex=-1;n.depart();}
    }
    n.label.textContent=n.profile.name;keep.add(n);return n;
  });
  for(const n of npcs)if(!keep.has(n)){
    n.mixer.stopAllAction();n.mixer.uncacheRoot(n.model);n.group.removeFromParent();n.label.remove();
    for(const m of [n.ring,n.bayang]){m.removeFromParent();m.geometry.dispose();m.material.dispose();}
    for(const m of n.paintMaterials||[])m.dispose();
    if(stairRoute?.owner===n)stairRoute.release(n);
    pickTargets=pickTargets.filter(o=>o!==n.group);
  }
  npcs=next;pasangChip();
  $$('[data-npc]').forEach(b=>b.onclick=()=>selectNPC(+b.dataset.npc));
  state.selected=Math.max(0,npcs.findIndex(n=>n.profile.analis?.uid===selectedUid));
  updateUI();
}

async function susunPemain(){
  const bawaan=Array.from({length:8},(_,i)=>({name:'DEMO–'+String(i+1).padStart(2,'0'),role:'Robot demo',home:'analis'+i,route:['analis'+i,'research',SANTAI[i%SANTAI.length]],offset:i*3.2,analis:null,punya:false}));
  try{
    const analis=(await HIDUP.daftarAnalis()).slice(0,8);
    if(!analis.length)throw Error('Belum ada analis yang memenuhi syarat');
    HIDUP.kabar.kartuGalat=null;
    const bagi=bagiKursi(analis);
    return analis.map((a,i)=>pemainDariAnalis(a,i,bagi));
  }catch(e){
    HIDUP.kabar.kartuGalat=e.message;
    console.warn('papan peringkat analis tidak terbaca:',e.message);
    return bawaan;
  }
}

function pasangChip(){
  const w=$('#npc-select');if(!w)return;

  w.classList.toggle('banyak',daftarPemain.length>6);
  w.innerHTML=daftarPemain.map((p,i)=>'<button class="npc-chip'+(i?'':' active')+'" data-npc="'+i+
    '" title="'+esc(p.role)+'">'+String(i+1).padStart(2,'0')+'</button>').join('');
}

function petakAngka(judul,teks,kelas){
  return '<div class="petak"><span>'+judul+'</span><strong class="'+(kelas||'')+'">'+teks+'</strong></div>';
}

function pasangDompet(n){
  const el=$('#dompet');if(!el)return;
  const a=n.profile.analis;
  if(!a){
    const sebab=HIDUP.kabar.kartuGalat;
    el.innerHTML='<p class="dompet-mati">Mode demo — robot bawaan, bukan analis papan peringkat.'+
      (sebab?'<br><span class="dompet-sebab">'+esc(sebab)+'</span>':'')+'</p>';
    return;
  }
  const kelas=a.pnl>0?'naik':a.pnl<0?'turun':'diam';

  const sinyal=a.sinyal.map(g=>{
    const turun=g.arah==='SELL';
    return '<li'+(g.terisi?'':' class="tunggu" title="Order belum terisi"')+'>'+
      '<span class="p-koin">'+esc(g.pasangan)+'</span>'+
      '<span class="p-arah '+(turun?'turun':'naik')+'">'+(turun?'SELL':'BUY')+'</span>'+
      '<span class="p-tf">'+esc(g.tf)+'</span></li>';
  }).join('');
  el.innerHTML='<div class="dompet-kepala"><span>'+esc(a.nama)+'</span>'+
      '<code>'+(a.agen?'AI Agent':'analis')+'</code></div>'+
    '<div class="dompet-angka">'+
      petakAngka('Hasil',HIDUP.uang(a.pnl),kelas)+
      petakAngka('Menang',a.menang+'/'+a.total,'')+
      petakAngka('Winrate',Math.round(a.winrate)+'%',a.winrate>=50?'naik':'turun')+
    '</div>'+
    (a.sinyalDiketahui===false?'<p class="dompet-mati">Data sinyal belum tersedia.</p>':sinyal?'<ul class="dompet-posisi">'+sinyal+'</ul>'
           :'<p class="dompet-mati">Tidak ada sinyal berjalan — analis ini sedang menunggu peluang.</p>');
}

const popup = {el: null, jenis: null, acuan: null, x: 0, y: 0};

function tutupPopup(){
  if(!popup.el)return;
  popup.el.remove();popup.el=null;popup.jenis=null;popup.acuan=null;
}

function bukaPopup(x,y,isi){
  tutupPopup();
  const el=document.createElement('aside');
  el.className='chrome panel popup-atur';
  el.innerHTML=isi;
  document.body.appendChild(el);

  const w=el.offsetWidth,h=el.offsetHeight;
  el.style.left=Math.max(8,Math.min(x+14,innerWidth-w-8))+'px';
  el.style.top=Math.max(8,Math.min(y+14,innerHeight-h-8))+'px';
  popup.el=el;popup.x=x;popup.y=y;
  return el;
}

const kepalaPopup=(eyebrow)=>'<div class="npc-title"><span class="eyebrow">'+eyebrow+
  '</span><button type="button" data-tutup>Tutup \u2715</button></div>';

function popupRobot(n,x,y){
  const a=n.profile.analis;
  const kelas=v=>v>0?'naik':v<0?'turun':'diam';
  let isi=kepalaPopup('Data analis');
  if(a){
    isi+='<h2 class="npc-name">'+esc(a.nama)+'</h2>'+
      '<div class="npc-role">'+(a.agen?'AI Agent':'Analis')+' \u00b7 papan peringkat bulan ini</div>'+
      '<div class="dompet-angka">'+
        '<div class="petak"><span>Winrate</span><strong class="'+(a.winrate>=50?'naik':'turun')+'">'+
          Math.round(a.winrate)+'%</strong></div>'+
        '<div class="petak"><span>Trade</span><strong>'+a.menang+'/'+a.total+'</strong></div>'+
        '<div class="petak"><span>Floating</span><strong class="'+
          (a.berjalan===null?'diam':kelas(a.berjalan))+'">'+
          (a.berjalan===null?'\u2014':HIDUP.uang(a.berjalan))+'</strong></div>'+
      '</div>'+
      '<div class="small-stats"><span>Hasil <strong class="'+kelas(a.pnl)+'">'+
        HIDUP.uang(a.pnl)+'</strong></span><span>'+
        (a.sinyal.length?a.sinyal.length+' sinyal berjalan':'menunggu peluang')+'</span></div>';
  }else{
    const sebab=HIDUP.kabar.kartuGalat;
    isi+='<h2 class="npc-name">'+esc(n.profile.name)+'</h2>'+
      '<p class="dompet-mati">Mode demo \u2014 robot bawaan, bukan analis papan peringkat.'+
      (sebab?'<br><span class="dompet-sebab">'+esc(sebab)+'</span>':'')+'</p>';
  }
  bukaPopup(x,y,isi);
  popup.jenis='robot';popup.acuan=n;
}

function popupLayar(rek,x,y){
  const koin=HIDUP.KOIN_PILIHAN.map(k=>'<button type="button" class="pilih'+
    (k===rek.koin?' aktif':'')+'" data-koin="'+k+'">'+k+'</button>').join('');
  const tf=HIDUP.TF.map(t=>'<button type="button" class="pilih'+
    (t.id===rek.tf?' aktif':'')+'" data-tf="'+t.id+'">'+t.label+'</button>').join('');
  const u=HIDUP.ubah(rek.koin,rek.tf);
  bukaPopup(x,y,kepalaPopup('Atur monitor')+
    '<h2 class="npc-name">'+esc(rek.koin)+'</h2>'+
    '<div class="npc-role">Timeframe '+esc(rek.tf)+' \u00b7 Hyperliquid'+
      (u===null?'':' \u00b7 '+(u>=0?'+':'\u2212')+Math.abs(u).toFixed(2)+'%')+'</div>'+
    '<div class="atur-judul">Koin</div><div class="atur-grid">'+koin+'</div>'+
    '<div class="atur-judul">Timeframe</div><div class="atur-grid tf">'+tf+'</div>');
  popup.jenis='layar';popup.acuan=rek;
}

addEventListener('click',(e)=>{
  if(!popup.el)return;
  if(!popup.el.contains(e.target)){tutupPopup();return;}
  if(e.target.closest('[data-tutup]')){tutupPopup();return;}
  if(popup.jenis!=='layar')return;
  const rek=popup.acuan;
  const bK=e.target.closest('[data-koin]'),bT=e.target.closest('[data-tf]');
  if(!bK&&!bT)return;
  if(bK)rek.koin=bK.dataset.koin;
  if(bT)rek.tf=bT.dataset.tf;

  HIDUP.langgan(rek.koin,rek.tf);
  paintTerminal(rek.canvas,rek.kind,state.time,rek.koin,rek.tf);
  rek.texture.needsUpdate=true;
  popupLayar(rek,popup.x,popup.y);
});

function pickKanan(e){
  pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(pickTargets,true).find(h=>objekTerlihat(h.object));
  let o=hit&&hit.object;
  while(o){
    if(o.userData.npc){popupRobot(o.userData.npc,e.clientX,e.clientY);return;}
    if(o.userData.layar){popupLayar(o.userData.layar,e.clientX,e.clientY);return;}
    o=o.parent;
  }
  tutupPopup();
}

const riwayat = [];
function catatLangkah(o) {
  if (!o) return;
  riwayat.push({o, p: o.position.clone(), r: o.rotation.clone(),deleted:!!o.userData.deleted});
  if (riwayat.length > 50) riwayat.shift();
}
function urungLangkah() {
  const l = riwayat.pop();
  if (!l) { toast('Tidak ada lagi yang bisa diurungkan.'); return; }
  l.o.position.copy(l.p); l.o.rotation.copy(l.r);l.o.userData.deleted=l.deleted;l.o.visible=!l.deleted;commitObjectPosition(l.o);fillObjectCatalog();
  if (atur.objek === l.o && atur.kotak) { atur.kotak.update(); hudAtur(); }
  toast('Satu langkah diurungkan.');
}

function kembalikanSemua() {
  let jml = 0;
  scene.traverse((o) => {
    const a = o.userData.aturAwal;
    if (!a) return;
    if (!o.position.equals(a.p) || o.rotation.x !== a.r.x || o.rotation.y !== a.r.y || o.rotation.z !== a.r.z) jml++;
    o.position.copy(a.p); o.rotation.copy(a.r);o.userData.deleted=false;o.visible=true;commitObjectPosition(o);
  });
  riwayat.length = 0;fillObjectCatalog();
  if (atur.kotak) { atur.kotak.update(); hudAtur(); }
  toast(jml ? jml + ' objek dikembalikan ke tempat semula.' : 'Semuanya sudah di tempat semula.');
}

let editMode=false;const objectCatalog=[];
const atur = {objek:null, kotak:null, seret:false, bidang:null, genggam:new THREE.Vector3(),
  layarY:0, awalY:0};

function namaObjek(o){
  if(o.userData.npc)return o.userData.npc.profile.role||o.userData.npc.profile.name;
  return o.userData.objectName||o.name||o.type;
}

function perabotTerdekat(titik){
  const a=layout&&layout.anchors;if(!a)return '';
  let nama='',jarak=1e9;
  for(const [n,v] of Object.entries(a)){
    if(!v||!v.position)continue;
    const d=Math.hypot(v.position[0]-titik.x,v.position[2]-titik.z);
    if(d<jarak){jarak=d;nama=n;}
  }
  return jarak<1.6?nama:'';
}

function aturLepas(){
  if(atur.kotak){scene.remove(atur.kotak);atur.kotak.geometry.dispose();atur.kotak=null;}
  atur.objek=null;atur.seret=false;controls.enabled=true;
  $('#hud-atur')?.remove();
}

function aturPilih(o,titik){
  aturLepas();
  atur.objek=o;
  atur.kotak=new THREE.BoxHelper(o,'#ffbe78');
  atur.kotak.material.depthTest=false;atur.kotak.renderOrder=30;
  scene.add(atur.kotak);
  atur.dekat=titik?perabotTerdekat(titik):'';
  hudAtur();
}

function hudAtur(){
  const o=atur.objek;if(!o)return;
  let el=$('#hud-atur');
  if(!el){
    el=document.createElement('aside');
    el.className='chrome panel hud-atur';el.id='hud-atur';
    document.body.appendChild(el);
  }
  const p=o.position,d=(v)=>v.toFixed(2);
  el.innerHTML='<div class="npc-title"><span class="eyebrow">Mode atur</span>'+
    '<button type="button" data-lepas>Lepas \u2715</button></div>'+
    '<h2 class="npc-name">'+esc(namaObjek(o))+'</h2>'+
    (atur.dekat?'<div class="npc-role">terdekat: '+esc(atur.dekat)+'</div>':'')+
    (/^(WALL|FLOOR)__/.test(o.name||'')
      ?'<p class="hud-catat">Ini bidang bangunan, bukan perabot \u2014 ia tetap satu kesatuan.</p>':'')+
    '<form data-transform><fieldset><legend>Posisi · meter</legend><div class="transform-grid">'+
    ['x','y','z'].map(axis=>'<label>'+axis.toUpperCase()+'<input name="p-'+axis+'" aria-label="Posisi '+axis.toUpperCase()+'" type="number" required min="-500" max="500" step="any" value="'+d(p[axis])+'"></label>').join('')+
    '</div></fieldset><fieldset><legend>Rotasi · derajat</legend><div class="transform-grid">'+
    ['x','y','z'].map(axis=>'<label>'+axis.toUpperCase()+'<input name="r-'+axis+'" aria-label="Rotasi '+axis.toUpperCase()+'" type="number" required step="any" value="'+(o.rotation[axis]*180/Math.PI).toFixed(1)+'"></label>').join('')+
    '</div></fieldset><button type="submit" class="soft-button lebar">Terapkan posisi &amp; rotasi</button></form>'+
    '<div class="npc-actions"><button class="soft-button" type="button" data-salin>Salin posisi</button>'+
      '<button class="soft-button" type="button" data-balik>Kembalikan ini</button></div>'+
    '<div class="npc-actions"><button class="soft-button" data-delete>'+ (o.userData.deleted?'Pulihkan objek':'Hapus objek')+'</button><button class="soft-button" data-undo>Urungkan</button></div>'+
    '<button class="soft-button lebar" type="button" data-balik-semua>Kembalikan seluruh tata letak</button>'+
    '<p class="hud-catat">Ctrl+seret geser \u00b7 Shift+Ctrl+seret naik-turun \u00b7 '+
      'Q/E putar \u00b7 panah geser halus \u00b7 Esc lepas</p>'+
    '<div class="object-nudge"><button data-nudge="x:-.1">←</button><button data-nudge="z:-.1">↑</button><button data-nudge="x:.1">→</button><button data-nudge="z:.1">↓</button><button data-nudge="y:.1">Naik</button><button data-nudge="y:-.1">Turun</button><button data-turn="-.261799">↶</button><button data-turn=".261799">↷</button></div>';
}

addEventListener('keydown',e=>{if(e.target.closest?.('[data-transform]'))e.stopPropagation();},true);
addEventListener('submit',e=>{
 const form=e.target.closest('[data-transform]');if(!form)return;e.preventDefault();
 const o=atur.objek;if(!o||!allowLayoutEdit())return;
 const values={position:['x','y','z'].map(a=>form.elements['p-'+a].value),rotation:['x','y','z'].map(a=>form.elements['r-'+a].value)};
 catatLangkah(o);if(!applyNumericTransform(o,values)){riwayat.pop();toast('Isi angka posisi dan rotasi yang valid.');return;}
 commitObjectPosition(o);atur.kotak.update();hudAtur();toast('Posisi dan rotasi diterapkan.');
});

function ingatAwal(o){
  if(o.userData.aturAwal)return;
  o.userData.aturAwal={p:o.position.clone(),r:o.rotation.clone()};
}

function aturSinar(e){
  pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
  raycaster.setFromCamera(pointer,camera);
  const abai=new Set([atur.kotak]);
  const kena=raycaster.intersectObjects(scene.children,true)
    .filter(h=>objekTerlihat(h.object)&&selectableRoot(h.object)&&!abai.has(h.object)&&h.object.type!=='GridHelper'
      &&!h.object.userData.takBisaDiatur
      &&!(h.object.material&&h.object.material.colorWrite===false));
  return kena[0]||null;
}

addEventListener('pointerdown',(e)=>{
  if(!state.loaded||e.button!==0||!(editMode||e.ctrlKey||e.metaKey))return;
  if(e.target!==renderer.domElement)return;
  if(!allowLayoutEdit())return;
  const h=aturSinar(e);
  if(!h){aturLepas();return;}

  let kena=h;

  let sasaran;
  if(kena.object.userData.npc){
    selectNPC(kena.object.userData.npc.index);return; // Characters keep their own live activity.
  }else if(kena.object.parent&&kena.object.parent.parent
           &&kena.object.parent.parent.userData.hasilBelah){
    sasaran=kena.object.parent;                             // perabot hasil belah
  }else{
    sasaran=kena.object;
    let p=kena.object;
    while(p&&p!==office&&p!==scene){if(p.userData.selectAsWhole){sasaran=p;break;}p=p.parent;}
  }
  ingatAwal(sasaran);
  catatLangkah(sasaran);
  aturPilih(sasaran,kena.point);

  const dunia=new THREE.Vector3();sasaran.getWorldPosition(dunia);
  atur.genggam.copy(dunia).sub(h.point);
  atur.bidang=new THREE.Plane(new THREE.Vector3(0,1,0),-h.point.y);
  atur.seret=true;atur.layarY=e.clientY;atur.awalY=sasaran.position.y;
  controls.enabled=false;
  e.preventDefault();
});

addEventListener('pointermove',(e)=>{
  if(!atur.seret||!atur.objek)return;
  const o=atur.objek;
  if(e.shiftKey){

    o.position.y=atur.awalY+(atur.layarY-e.clientY)*.004;
  }else{
    pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
    raycaster.setFromCamera(pointer,camera);
    const titik=new THREE.Vector3();
    if(!raycaster.ray.intersectPlane(atur.bidang,titik))return;
    titik.add(atur.genggam);
    if(o.parent)o.parent.worldToLocal(titik);
    o.position.x=titik.x;o.position.z=titik.z;
  }
  atur.kotak.update();hudAtur();
});

addEventListener('pointerup',()=>{
  if(!atur.seret)return;
  atur.seret=false;controls.enabled=true;
  if(atur.objek){atur.awalY=atur.objek.position.y;commitObjectPosition(atur.objek);}
});

addEventListener('click',(e)=>{
  const el=$('#hud-atur');if(!el||!el.contains(e.target))return;
  if(e.target.closest('[data-lepas]')){aturLepas();return;}
  const o=atur.objek;if(!o||!allowLayoutEdit())return;
  if(e.target.closest('[data-delete]')){toggleObjectDeleted(o);return;}
  if(e.target.closest('[data-undo]')){urungLangkah();return;}
  const nudge=e.target.closest('[data-nudge]'),turn=e.target.closest('[data-turn]');
  if(nudge||turn){catatLangkah(o);if(nudge){const [axis,amount]=nudge.dataset.nudge.split(':');o.position[axis]+=Number(amount);}else o.rotation.y+=Number(turn.dataset.turn);commitObjectPosition(o);atur.kotak.update();hudAtur();return;}
  if(e.target.closest('[data-balik-semua]')){kembalikanSemua();return;}
  if(e.target.closest('[data-balik]')){
    const a=o.userData.aturAwal;
    if(a){catatLangkah(o);o.position.copy(a.p);o.rotation.copy(a.r);o.userData.deleted=false;o.visible=true;commitObjectPosition(o);atur.kotak.update();hudAtur();}
    return;
  }
  if(e.target.closest('[data-salin]')){
    const t=JSON.stringify({nama:namaObjek(o),
      posisi:o.position.toArray().map(v=>+v.toFixed(3)),
      rotasi:['x','y','z'].map(axis=>+(o.rotation[axis]*180/Math.PI).toFixed(1))});
    navigator.clipboard?.writeText(t).then(()=>toast('Posisi disalin.'),
      ()=>toast('Peramban menolak menyalin. Angkanya ada di panel.'));
  }
});

// Replan around robots already standing at their dance slots. Without this,
// a late arrival can keep aiming through the completed front row.
function routeFor(npc,destination){
  const start=[npc.group.position.x,npc.group.position.z,Math.max(0,npc.group.position.y-.012)];
  if(stairRoute&&((destination[2]||0)>1||start[2]>.025))return stairRoute.path(start,destination,(a,b)=>groundRouteFor(npc,a,b));
  return groundRouteFor(npc,start,destination);
}
function groundRouteFor(npc,start,destination){
  const rows=nav.rows,walkable=nav.walkable,blocked=new Set();
  for(const other of npcs){
    if(other===npc||other.group.position.y>.10)continue;
    const p=other.group.position;
    if(Math.hypot(p.x-destination[0],p.z-destination[1])<.55)continue;
    const [cx,cz]=nav.cell(p.x,p.z),radius=Math.ceil(.84/nav.step);
    for(let j=cz-radius;j<=cz+radius;j++)for(let i=cx-radius;i<=cx+radius;i++){
      if(!nav.isFree(i,j))continue;
      const key=j*nav.width+i,w=nav.world(key);
      if(Math.hypot(w[0]-p.x,w[1]-p.z)<.84)blocked.add(key);
    }
  }
  if(!blocked.size)return nav.path(start,destination);
  try{
    nav.rows=rows.map((row,j)=>[...row].map((v,i)=>blocked.has(j*nav.width+i)?'#':v).join(''));
    nav.walkable=walkable.filter(k=>!blocked.has(k));
    const path=nav.path(start,destination);
    if(path.length>1)return path;
  }finally{nav.rows=rows;nav.walkable=walkable;}
  return nav.path(start,destination);
}

class NPC {
  constructor(index,gltf){this.index=index;this.profile=daftarPemain[index];this.tulang={};
    this.istirahat={};this.dudukLerp=0;this.model=clone(gltf.scene);this.group=new THREE.Group();this.group.add(this.model);scene.add(this.group);this.group.userData.npc=this;this.model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.npc=this;if(o.morphTargetDictionary)this.face=o;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.envMapIntensity=.85);}if(o.isBone){
        this.tulang[o.name]=o;this.tulang[o.name.replace(/[^A-Za-z0-9]/g,'')]=o;const qi=o.quaternion.clone();this.istirahat[o.name]=qi;this.istirahat[o.name.replace(/[^A-Za-z0-9]/g,'')]=qi;if(o.name==='CTRL-head')this.head=o;}});colorRobot(this);this.mixer=new THREE.AnimationMixer(this.model);this.actions={};gltf.animations.forEach(a=>this.actions[a.name]=this.mixer.clipAction(a));this.routeIndex=0;this.macet=0;this.ulangJalur=0;this.station=stations[this.profile.route[0]];const p=nav.world(nav.nearest(...this.station.position));this.group.position.set(p[0],.012,p[1]);this.heading=Math.atan2(this.station.look[0]-p[0],this.station.look[1]-p[1]);this.group.rotation.y=this.heading;this.moving=false;this.dwell=this.profile.offset;this.path=[];this.pathIndex=0;this.elapsed=0;this.wave=0;this.play('05_Typing');this.label=document.createElement('div');this.label.className='scene-label';this.label.textContent=this.profile.name;$('#labels').appendChild(this.label);pickTargets.push(this.group);

    if(!NPC.terukur){NPC.terukur=true;this.model.updateWorldMatrix(true,true);
      const paha=this.tulang['CTRLthighL'];
      if(paha){const v=new THREE.Vector3();paha.getWorldPosition(v);
        const t=Math.round((v.y-this.group.position.y)*1000)/1000;
        if(t>.2&&t<1.4)DUDUK.pangkalPaha=t;}}

    if(!NPC.tekstur){const c=document.createElement('canvas');c.width=c.height=128;
      const x=c.getContext('2d'),g=x.createRadialGradient(64,64,4,64,64,62);
      g.addColorStop(0,'rgba(6,14,20,.55)');g.addColorStop(.55,'rgba(6,14,20,.24)');
      g.addColorStop(1,'rgba(6,14,20,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
      NPC.tekstur=new THREE.CanvasTexture(c);}
    this.bayang=new THREE.Mesh(new THREE.PlaneGeometry(1.05,1.05),
      new THREE.MeshBasicMaterial({map:NPC.tekstur,transparent:true,depthWrite:false,toneMapped:false}));
    this.bayang.rotation.x=-Math.PI/2;this.bayang.renderOrder=1;scene.add(this.bayang);

    this.ring=new THREE.Mesh(new THREE.RingGeometry(.46,.475,60),new THREE.MeshBasicMaterial({color:'#ffbe78',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));this.ring.rotation.x=-Math.PI/2;this.ring.position.y=.025;scene.add(this.ring);
  }

  bolehDi(x,z){const [cx,cz]=nav.cell(x,z);
    return nav.isFree(cx,cz)&&(!nav.allowed||nav.allowed.has(cz*nav.width+cx));}
  kemajuan(dist,dt){
    this.tMaju=(this.tMaju||0)+dt;
    if(this.jarakLalu===undefined)this.jarakLalu=dist;
    if(this.tMaju<2.4)return false;
    const maju=this.jarakLalu-dist;this.jarakLalu=dist;this.tMaju=0;return maju<.12;
  }
  aturUlangKemajuan(){this.jarakLalu=undefined;this.tMaju=0;}
  planRoute(destination){return routeFor(this,destination);}
  movePath(dt){
    const next=this.path[this.pathIndex];
    if(!next){this.velocity={x:0,z:0};this.moving=false;this.onStairs=false;this.dwell=0;
      if(this.joget)this.tibaPanggung();else this.play(this.station.kind==='type'?'05_Typing':'01_Idle_Loop');return;}
    const p=this.group.position,dx=next[0]-p.x,dz=next[1]-p.z,dist=Math.hypot(dx,dz);
    this.onStairs=!!next[3];
    if(dist<(this.onStairs?.012:.035)){
      if(this.onStairs)p.y=(next[2]||0)+.012;
      this.pathIndex++;this.aturUlangKemajuan();return;
    }
    const heading=this.onStairs?walkStairSegment(this,next,dt,npcs):moveInTraffic(this,dx,dz,dist,dt,nav,npcs);
    if(heading!==null){this.heading+=wrapAngle(heading-this.heading)*Math.min(1,dt*7);this.macet=0;
      this.play('03_Walk_In_Place');this.tempoJalan(this.onStairs?.72:1);}
    else{this.velocity={x:0,z:0};this.macet=(this.macet||0)+dt;this.play('01_Idle_Loop');}
    if(!this.onStairs&&(this.macet>2.0||this.kemajuan(dist,dt))){
      const target=this.joget?this.jogetTujuan:this.station.position;
      const path=routeFor(this,target);if(path.length>1){this.path=path;this.pathIndex=1;}
      this.macet=0;this.aturUlangKemajuan();
    }
  }

  tempoJalan(f){
    if(this.currentClip==='03_Walk_In_Place'&&this.action)
      this.action.setEffectiveTimeScale(1.5*Math.max(.45,f));
  }
  play(name){const next=this.actions[name]||this.actions['01_Idle_Loop'];if(next===this.action)return;next.reset().setEffectiveTimeScale(name==='03_Walk_In_Place'?1.5:1).setEffectiveWeight(1).play();if(this.action)this.action.crossFadeTo(next,.38,false);this.action=next;this.currentClip=name;}

  depart(){
    let selected=null,index=this.routeIndex;
    for(let tries=1;tries<=this.profile.route.length;tries++){
      const next=(this.routeIndex+tries)%this.profile.route.length,key=this.profile.route[next],candidate=stations[key];
      if(!candidate||candidate.disembunyikan||candidate.chair?.userData.deleted)continue;
      if(npcs.some(o=>o!==this&&(o.station===candidate||(o.profile.home===key))))continue;
      selected=candidate;index=next;break;
    }
    // When every destination is reserved, keep the current place and retry.
    if(!selected){this.dwell=Math.max(0,this.station.duration-3);return;}
    this.station=selected;this.routeIndex=index;this.path=routeFor(this,this.station.position);this.pathIndex=1;
    this.moving=this.path.length>1;this.dwell=0;this.aturUlangKemajuan();if(this.moving)this.play('03_Walk_In_Place');
  }
  pulang(){
    const home=this.profile.home||this.profile.route.find(k=>/^analis/.test(k));
    const reserved=home&&stations[home];
    this.station=reserved||this.stasiunSebelum||this.station;
    this.routeIndex=Math.max(0,this.profile.route.indexOf(home));
    this.path=routeFor(this,this.station.position);this.pathIndex=1;this.moving=this.path.length>1;this.dwell=0;
    this.aturUlangKemajuan();if(this.moving)this.play('03_Walk_In_Place');
  }

  langkahJoget(dt){
    if(!this.jogetBerangkat){
      // Fill the inner stage positions first; leave an aisle for late arrivals.
      if(npcs.some(o=>o!==this&&o.joget&&o.jogetUrutan<this.jogetUrutan-1&&!o.jogetSampai)){
        this.velocity={x:0,z:0};this.play('01_Idle_Loop');return;
      }
      this.jogetBerangkat=true;
      this.path=this.planRoute(this.jogetTujuan);this.pathIndex=this.path.length>1?1:0;
    }
    if(this.jogetSampai){

      const h=Math.atan2(PANGGUNG.hadap[0]-this.group.position.x,PANGGUNG.hadap[1]-this.group.position.z);
      this.heading+=wrapAngle(h-this.heading)*Math.min(1,dt*5);

      if(this.jogetTujuan){
        const p=this.group.position;
        const d=Math.hypot(this.jogetTujuan[0]-p.x,this.jogetTujuan[1]-p.z);
        if(d<.5){const k=Math.min(1,dt*2.2);
          const x=p.x+(this.jogetTujuan[0]-p.x)*k,z=p.z+(this.jogetTujuan[1]-p.z)*k;if(clearOfRobots(this,x,z,npcs)){p.x=x;p.z=z;}}
      }
      return;
    }

    this.movePath(dt);
  }
  tibaPanggung(){this.jogetSampai=true;this.moving=false;this.path=[];this.tunggu=0;this.play('01_Idle_Loop');}
  greet(){this.wave=3;this.play('02_Wave');}
  update(dt,time){this.elapsed+=dt;
    if(this.joget){this.langkahJoget(dt);}
    else if(this.wave>0){this.wave-=dt;if(this.wave<=0)this.play(this.moving?'03_Walk_In_Place':this.station.kind==='type'?'05_Typing':'01_Idle_Loop');}
    else if(this.moving){this.movePath(dt);}
    else{this.dwell+=dt;
      // Sel navigasi berhenti di depan kursi; sisanya ditempuh dengan geser halus.

      const t=this.station.chair?.userData.deleted?this.station.position:this.station.tempatDuduk||this.station.tempat;
      if(t){const dx=t[0]-this.group.position.x,dz=t[1]-this.group.position.z;
        if(Math.hypot(dx,dz)<1.4){const k=Math.min(1,dt*1.5),x=this.group.position.x+dx*k,z=this.group.position.z+dz*k;if(clearOfRobots(this,x,z,npcs)){this.group.position.x=x;this.group.position.z=z;}}}

      const desired=(this.station.duduk&&this.station.hadap!==undefined)
        ? this.station.hadap
        : Math.atan2(this.station.look[0]-this.group.position.x,this.station.look[1]-this.group.position.z);this.heading+=wrapAngle(desired-this.heading)*Math.min(1,dt*4);if(this.dwell>this.station.duration&&!this.excursion)this.depart();else this.play(this.station.kind==='type'?'05_Typing':'01_Idle_Loop');}

    if(!this.moving)this.velocity={x:0,z:0};this.group.rotation.y=this.heading;this.mixer.update(dt);
    stepOnStairs(this,stairRoute,time);
    // Duduk: mixer sudah menulis pose, sekarang pahanya ditekuk.

    if(this.station.duduk){
      const dx=this.group.position.x-this.station.position[0];
      const dz=this.group.position.z-this.station.position[1];
      if(Math.hypot(dx,dz)<1.8&&this.dudukLerp<.6)this.station.tarikMau=true;
    }
    const mauDuduk=!this.joget&&!this.moving&&this.wave<=0&&!!this.station.duduk&&!this.station.chair?.userData.deleted&&!npcs.some(o=>o!==this&&o.station===this.station&&o.index<this.index);
    this.dudukLerp=clamp(this.dudukLerp+(mauDuduk?dt*2.2:-dt*3.4),0,1);
    if(this.dudukLerp>.002){const t=smooth(this.dudukLerp);
      const maju=new THREE.Vector3(Math.sin(this.heading),0,Math.cos(this.heading));
      const arahPaha=maju.clone().setY(-DUDUK.pahaTurun).normalize();
      const arahBetis=maju.clone().multiplyScalar(DUDUK.betisMaju).setY(-1).normalize();

      const pangku=this.station.kind!=='type';
      const samping=new THREE.Vector3(maju.z,0,-maju.x);
      for(const sisi of ['L','R']){
        arahkanTulang(this.tulang['CTRLthigh'+sisi],arahPaha,t);
        arahkanTulang(this.tulang['CTRLshin'+sisi],arahBetis,t);
        if(!pangku)continue;
        const sisiTanda=sisi==='L'?1:-1;
        arahkanTulang(this.tulang['CTRLupperarm'+sisi],
          maju.clone().multiplyScalar(.22).addScaledVector(samping,.16*sisiTanda).setY(-1).normalize(),t);
        arahkanTulang(this.tulang['CTRLforearm'+sisi],
          maju.clone().multiplyScalar(.9).addScaledVector(samping,.1*sisiTanda).setY(-.45).normalize(),t);
      }

      const dudukan=this.station.dudukY||.5;
      this.model.position.y=(dudukan+DUDUK.bantal-DUDUK.pangkalPaha)*t;}
    else if(this.model.position.y)this.model.position.y=0;

    if(!this.joget&&this.station.kind==='type'&&this.dudukLerp>.002)typeAtKeyboard(this,time,smooth(this.dudukLerp));
    if(this.joget&&!joget.pose(this))this.model.position.y=0;
    for(const key of ['CTRLhead','CTRLneck']){const bone=this.tulang[key];if(bone&&this.istirahat[key])bone.quaternion.copy(this.istirahat[key]);}
    if(!this.performance){this.performance=new RobotPerformance(this);this.performance.observe(this.profile.analis,time,performanceAudio);}
    this.performance.update(dt,time);

    const dudukT=this.dudukLerp||0;
    this.bayang.position.set(this.group.position.x,this.group.position.y-.006,this.group.position.z);
    this.bayang.visible=!this.onStairs;
    this.bayang.scale.setScalar(1-dudukT*.25);
    this.bayang.material.opacity=1-dudukT*.35;
    this.ring.position.y=this.group.position.y+.013;this.ring.position.x=this.group.position.x;this.ring.position.z=this.group.position.z;this.ring.material.opacity=this.index===state.selected?.62:0;
  }
}

function moveCamera(position,target,duration=1.6){tween={from:camera.position.clone(),to:position.clone(),targetFrom:controls.target.clone(),targetTo:target.clone(),elapsed:0,duration};followPrevious=null;}
function selectNPC(index,focus=true){state.selected=(index+npcs.length)%npcs.length;$$('[data-npc]').forEach(b=>b.classList.toggle('active',+b.dataset.npc===state.selected));followPrevious=null;updateUI();if($('#emotion-select'))$('#emotion-select').value=npcs[state.selected]?.performance?.manual||'auto';if(focus)focusNPC();}
function focusNPC(){const npc=npcs[state.selected];if(!npc)return;const target=npc.group.position.clone().add(V(0,1.1,0));const offset=V(1.8,1.0,3.0).applyAxisAngle(V(0,1,0),npc.heading);moveCamera(target.clone().add(offset),target,1.5);if(state.mode==='cinema')setMode('orbit',false);$$('[data-view]').forEach(b=>b.classList.remove('active'));}
function setMode(mode,adjust=true){state.mode=mode;$$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('#camera-name').textContent={orbit:'Orbit bebas / 360°',follow:'Mengikuti robot',cinema:'Auto tour / sinematik'}[mode];followPrevious=null;controls.autoRotate=false;if(mode==='follow'&&adjust)focusNPC();if(mode==='cinema'){tourTimer=0;tourIndex=-1;nextTour();}else if(adjust&&mode==='orbit')tween=null;}
const presets={
  interior:()=>({position:V(-6.3,1.85,3.25),target:V(3.4,1.45,-1.35),label:'Dalam ruangan · plafon otomatis'}),
  overview:()=>({position:overviewPosition(),target:officeCenter(),label:'Seluruh kantor · tiga area terhubung'}),
  desk:()=>({position:V(-6.3,2.3,3.45),target:V(-2.2,1.1,.01),label:'Meja analis · delapan monitor'}),
  market:()=>updateMarketBoard(marketBoard),
  meeting:()=>({position:V(-1.3,4.7,-1.6),target:V(2.9,.9,-5.9),label:'Ruang rapat'}),
  top:()=>({position:officeCenter().add(V(0,52*Math.max(1,1.1/(innerWidth/innerHeight)),.02)),target:officeCenter(),label:'Tampak atas · denah gabungan'}),
  expansion:()=>({position:V(1.9,2.15,8.1),target:V(-.3,1.2,18.3),label:'Kantor tambahan · area kerja'}),
  stairs:()=>({position:V(-6.8,3.3,5.4),target:V(-15,2.1,-.9),label:'Kantor kiri · ruang bertangga'}),
};

/* ── SUDUT KAMERA SENDIRI & AUTO TOUR YANG BISA DIATUR ───────────────
   Dilaporkan pemilik 27 Sep 2026: sudut auto tour "itu itu saja dan tidak
   variatif". Diukur dari kodenya, memang begitu: delapan bidikan dengan
   urutan terkunci, sepuluh detik masing-masing, putaran pelan yang sama
   persis — dan "Trading desk" serta "Tampak atas" tidak pernah ikut.

   Yang ditambahkan:
     1. Sudut sendiri. Bingkai kamera di mode Bebas, beri nama, simpan.
        Tersimpan di peramban ini dan langsung ikut auto tour.
     2. Tour bisa diatur: sudut mana yang ikut, lama tiap sudut, urutan
        berurutan atau acak.
     3. Gerak kamera bervariasi: tiap bidikan memilih sendiri arah dan laju
        putarnya, dan apakah kamera mendekat, menjauh, atau diam. Bidikan
        robot memilih robot dan sisi yang berlainan.

   Bidikan di area yang sedang disembunyikan (Perluasan kantor, Lantai
   atas) dilewati — tanpa itu tour berhenti sepuluh detik menatap ruangan
   yang tidak digambar. */
const KUNCI_SUDUT='jt.trabar.sudutKustom',KUNCI_TUR='jt.trabar.tur';
function bacaJSON(k,awal){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??awal;}catch(e){return awal;}}
function tulisJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
let sudutKustom=(function(){
  const v=bacaJSON(KUNCI_SUDUT,[]);
  return Array.isArray(v)?v.filter(x=>x&&typeof x.id==='string'&&typeof x.nama==='string'
    &&Array.isArray(x.p)&&Array.isArray(x.t)&&x.p.length===3&&x.t.length===3
    &&[...x.p,...x.t].every(Number.isFinite)):[];
})();
let tur=Object.assign({lama:10,acak:true,variasi:true,mati:[]},bacaJSON(KUNCI_TUR,{}));
if(!Array.isArray(tur.mati))tur.mati=[];
if(![6,10,15,25].includes(+tur.lama))tur.lama=10;
let turTerakhir=null,turGerak={putar:.022,dorong:0};
const TUR_BAWAAN=[
  ['overview','Seluruh kantor'],['robot-a','Robot · dari dekat'],['desk','Trading desk'],
  ['interior','Dalam ruangan'],['meeting','Ruang rapat'],['robot-b','Robot · sisi lain'],
  ['top','Tampak atas'],['market','Market wall'],['expansion','Kantor tambahan'],['stairs','Kantor bertangga'],
];
/* Aturan letak yang sama dengan lampu (areaLampu): x <= -12 lantai atas,
   z >= 10 perluasan. */
function diAreaTersembunyi(x,z,sembunyi){return (x<=-12&&sembunyi.has('atas'))||(z>=10&&sembunyi.has('perluasan'));}
function turTersembunyi(k,sembunyi){
  if(k==='expansion')return sembunyi.has('perluasan');
  if(k==='stairs')return sembunyi.has('atas');
  if(k.startsWith('k:')){const x=sudutKustom.find(s=>'k:'+s.id===k);return !x||diAreaTersembunyi(x.t[0],x.t[2],sembunyi);}
  return false;
}
function daftarTur(){
  const sembunyi=areaSembunyi();
  return [...TUR_BAWAAN.map(b=>b[0]),...sudutKustom.map(x=>'k:'+x.id)]
    .filter(k=>!tur.mati.includes(k)&&!turTersembunyi(k,sembunyi));
}
function bidikanRobot(sisi){
  const sembunyi=areaSembunyi();
  const calon=npcs.filter(n=>n.group&&!diAreaTersembunyi(n.group.position.x,n.group.position.z,sembunyi));
  const n=tur.variasi&&calon.length?calon[Math.floor(Math.random()*calon.length)]:npcs[state.selected];
  const target=n.group.position.clone().add(V(0,1.15,0));
  let off=V(sisi>0?2.2:-2.1,1.25,3.2);
  if(tur.variasi){
    off=V(0,0,3.1+Math.random()*1.6).applyAxisAngle(V(0,1,0),(Math.random()*2-1)*1.3);
    off.y=.7+Math.random()*1.1;
  }
  return {position:target.clone().add(off.applyAxisAngle(V(0,1,0),n.heading)),target,label:n.profile?.name||'Robot'};
}
function bidikanTur(k){
  if(k==='robot-a')return bidikanRobot(1);
  if(k==='robot-b')return bidikanRobot(-1);
  if(k.startsWith('k:')){const x=sudutKustom.find(s=>'k:'+s.id===k);return {position:V(...x.p),target:V(...x.t),label:x.nama};}
  return presets[k]();
}
function simpanSudut(){
  const isian=$('#sudut-nama');
  const nama=((isian&&isian.value)||'').trim().slice(0,40)||('Sudut saya '+(sudutKustom.length+1));
  const r=v=>Math.round(v*1000)/1000;
  sudutKustom.push({id:Date.now().toString(36),nama,p:camera.position.toArray().map(r),t:controls.target.toArray().map(r)});
  tulisJSON(KUNCI_SUDUT,sudutKustom);
  if(isian)isian.value='';
  gambarSudut();toast('Sudut "'+nama+'" tersimpan dan ikut auto tour.');
}
function pakaiSudut(id){
  const x=sudutKustom.find(s=>s.id===id);if(!x)return;
  setMode('orbit',false);moveCamera(V(...x.p),V(...x.t),1.8);
  $$('[data-view]').forEach(b=>b.classList.remove('active'));
  $$('[data-sudut]').forEach(b=>b.classList.toggle('active',b.dataset.sudut===id));
  $('#camera-name').textContent=x.nama;
}
function hapusSudut(id){
  sudutKustom=sudutKustom.filter(x=>x.id!==id);tur.mati=tur.mati.filter(k=>k!=='k:'+id);
  tulisJSON(KUNCI_SUDUT,sudutKustom);tulisJSON(KUNCI_TUR,tur);gambarSudut();
}
/* Dibangun dengan textContent, bukan innerHTML: nama sudut diketik
   bebas oleh pemiliknya. */
function gambarSudut(){
  const kotak=$('#sudut-daftar');
  if(kotak){
    kotak.replaceChildren();
    if(!sudutKustom.length){
      const p=document.createElement('p');p.className='sudut-kosong';
      p.textContent='Belum ada. Atur kamera di mode Bebas, lalu simpan di bawah.';kotak.appendChild(p);
    }
    for(const x of sudutKustom){
      const baris=document.createElement('div');baris.className='sudut-baris';
      const b=document.createElement('button');b.className='view-button sudut-item';b.dataset.sudut=x.id;b.title='Pindah ke '+x.nama;
      const sp=document.createElement('span');sp.textContent=x.nama;b.appendChild(sp);
      const h=document.createElement('button');h.className='sudut-hapus';h.dataset.sudutHapus=x.id;
      h.title='Hapus sudut ini';h.setAttribute('aria-label','Hapus '+x.nama);h.textContent='×';
      baris.append(b,h);kotak.appendChild(baris);
    }
  }
  const tk=$('#tur-daftar');
  if(tk){
    tk.replaceChildren();
    for(const [k,label] of [...TUR_BAWAAN,...sudutKustom.map(x=>['k:'+x.id,x.nama])]){
      const l=document.createElement('label');l.className='toggle-row';
      const sp=document.createElement('span');sp.textContent=label;
      const cb=document.createElement('input');cb.type='checkbox';cb.dataset.tur=k;cb.checked=!tur.mati.includes(k);
      l.append(sp,cb);tk.appendChild(l);
    }
  }
}
function wireSudut(){
  gambarSudut();
  $('#sudut-simpan')?.addEventListener('click',simpanSudut);
  $('#sudut-nama')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();simpanSudut();}});
  $('#sudut-daftar')?.addEventListener('click',e=>{
    const h=e.target.closest('[data-sudut-hapus]');
    if(h){
      /* Dua langkah: satu klik meleset tidak boleh membuang sudut yang
         dibingkai dengan susah payah. */
      if(h.dataset.yakin!=='1'){
        h.dataset.yakin='1';h.textContent='Hapus?';h.classList.add('yakin');
        setTimeout(()=>{if(h.isConnected){h.dataset.yakin='';h.textContent='×';h.classList.remove('yakin');}},3000);
        return;
      }
      hapusSudut(h.dataset.sudutHapus);return;
    }
    const b=e.target.closest('[data-sudut]');if(b)pakaiSudut(b.dataset.sudut);
  });
  $('#tur-daftar')?.addEventListener('change',e=>{
    const cb=e.target.closest('[data-tur]');if(!cb)return;
    tur.mati=cb.checked?tur.mati.filter(k=>k!==cb.dataset.tur):[...new Set([...tur.mati,cb.dataset.tur])];
    tulisJSON(KUNCI_TUR,tur);
  });
  const lama=$('#tur-lama');
  if(lama){lama.value=String(tur.lama);lama.addEventListener('change',()=>{tur.lama=+lama.value||10;tulisJSON(KUNCI_TUR,tur);});}
  const acak=$('#tur-acak');
  if(acak){acak.checked=tur.acak;acak.addEventListener('change',()=>{tur.acak=acak.checked;tulisJSON(KUNCI_TUR,tur);});}
  const vr=$('#tur-variasi');
  if(vr){vr.checked=tur.variasi;vr.addEventListener('change',()=>{tur.variasi=vr.checked;tulisJSON(KUNCI_TUR,tur);});}
}

function tandaiLagu(){
  document.querySelectorAll('[data-lagu]').forEach(b=>{
    b.classList.toggle('active',+b.dataset.lagu===laguPilihan);});
}
/* Satu pintu untuk menutup panggung — dipakai tombol "Tutup panggung" dan
   oleh lagu yang habis. Dua jalan yang masing-masing menulis langkahnya
   sendiri cepat atau lambat berselisih satu langkah.

   Yang ditutup OTOMATIS mengembalikan kamera ke Auto tour kalau tadinya
   di sana: siaran yang ditinggal jalan tidak boleh berhenti menatap
   panggung kosong. Yang ditutup tangan dibiarkan — orangnya sedang
   memegang kamera. */
function tutupPanggung(pesan,otomatis=false){
  if(!joget.aktif)return;
  joget.selesai(npcs,stations);performanceAudio.stopVoice();beatCamera.clear(camera);
  $('#camera-name').textContent='Orbit bebas / 360°';
  $('#joget-menu').hidden=true;$('#joget-btn').setAttribute('aria-expanded','false');
  tandaiMenuJoget();
  if(otomatis&&modeSebelumJoget==='cinema')setMode('cinema');
  modeSebelumJoget=null;
  if(pesan)toast(pesan);
}
function tandaiMenuJoget(){
  $$('[data-joget]').forEach(b=>{const i=+b.dataset.joget;
    b.classList.toggle('active',joget.aktif&&(i<0?joget.kunci===null:joget.kunci===i));});
  $('#joget-tutup').hidden=!joget.aktif;
  $('#joget-btn').classList.toggle('active',joget.aktif);
  $('#joget-btn').setAttribute('aria-pressed',String(joget.aktif));
  $('#dance-tempo-status').textContent=(joget.tempo<.6?'Slow motion':joget.tempo>1.3?'Cepat':'Normal')+' · '+joget.tempo.toFixed(2)+'×';
}
function setView(key){const p=presets[key]();setMode('orbit',false);moveCamera(p.position,p.target,1.8);$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===key));$$('[data-sudut]').forEach(b=>b.classList.remove('active'));$('#camera-name').textContent=p.label;}
function nextTour(){
  tourTimer=0;
  const d=daftarTur();
  if(!d.length){const p=presets.overview();moveCamera(p.position,p.target,3.5);$('#camera-name').textContent='Auto tour · tidak ada sudut yang dicentang';return;}
  let i;
  if(tur.acak&&d.length>1){do{i=Math.floor(Math.random()*d.length);}while(d[i]===turTerakhir);}
  else i=(tourIndex+1)%d.length;
  tourIndex=i;turTerakhir=d[i];
  const p=bidikanTur(d[i]);
  turGerak=tur.variasi
    ?{putar:(Math.random()<.5?-1:1)*(.012+Math.random()*.03),dorong:[0,.014,-.012][Math.floor(Math.random()*3)],L0:null}
    :{putar:.022,dorong:0,L0:null};
  moveCamera(p.position,p.target,3.5);
  $('#camera-name').textContent='Auto tour · '+(i+1)+' / '+d.length+(p.label?' · '+String(p.label).split(' · ')[0]:'');
}
function updateCamera(dt){beatCamera.clear(camera);if(tween){const t=tween;t.elapsed+=dt;const k=smooth(clamp(t.elapsed/t.duration,0,1));camera.position.lerpVectors(t.from,t.to,k);controls.target.lerpVectors(t.targetFrom,t.targetTo,k);if(k>=1){tween=null;followPrevious=controls.target.clone();}}else if(state.mode==='follow'&&!interacting){const n=npcs[state.selected];const target=n.group.position.clone().add(V(0,1.1,0));const delta=target.clone().sub(controls.target).multiplyScalar(Math.min(1,dt*6));camera.position.add(delta);controls.target.add(delta);}else if(state.mode==='cinema'&&!interacting){const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(V(0,1,0),dt*turGerak.putar);if(turGerak.dorong){turGerak.L0??=offset.length();offset.setLength(Math.min(turGerak.L0*1.2,Math.max(turGerak.L0*.8,offset.length()*(1-dt*turGerak.dorong))));}camera.position.copy(controls.target).add(offset);}if(state.mode==='cinema'){tourTimer+=dt;if(tourTimer>tur.lama)nextTour();}controls.update();camera.position.y=Math.max(.18,camera.position.y);}
function pick(e){pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickTargets,true).find(h=>objekTerlihat(h.object));if(!hit)return;let o=hit.object;while(o){if(o.userData.npc){selectNPC(o.userData.npc.index);return;}if(o.userData.focus){const f=o.userData.focus;setMode('orbit',false);const dir=camera.position.clone().sub(controls.target).normalize();moveCamera(f.point.clone().addScaledVector(dir,f.distance),f.point,1.3);toast(f.label);return;}o=o.parent;}}

function updateUI(){updateDataStatus();const n=npcs[state.selected];if(!n)return;updatePaintControls(n);pasangDompet(n);$('#npc-name').textContent=n.profile.name;$('#npc-role').textContent=n.profile.role+' · '+n.colorName;$('#activity').textContent=n.joget?(n.jogetSampai?'Joget · '+joget.namaGerakan:'Menuju panggung'):n.wave>0?'Menyapa kamu':n.moving?'Menuju '+n.station.label.toLowerCase():n.station.activity;$('#npc-area').textContent=n.station.label;$('#npc-emotion').textContent=EMOTIONS[n.performance?.mood]||'Fokus';if($('#emotion-select')&&document.activeElement!==$('#emotion-select'))$('#emotion-select').value=n.performance?.manual||'auto';$('#task-progress').style.width=(n.wave>0?100*(1-n.wave/3):n.moving?100*n.pathIndex/Math.max(1,n.path.length):100*clamp(n.dwell/n.station.duration,0,1))+'%';$('#clock').textContent='JADITRADER · '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})+' WIB';}
function updateLabels(){for(const n of npcs){const p=n.group.position.clone().add(V(0,1.95,0)).project(camera);const show=state.labels&&p.z>-1&&p.z<1&&Math.abs(p.x)<.98&&Math.abs(p.y)<.92;n.label.style.display=show?'block':'none';n.label.style.left=(p.x*.5+.5)*innerWidth+'px';n.label.style.top=(-p.y*.5+.5)*innerHeight+'px';n.label.classList.toggle('selected',n.index===state.selected);}}
function updateWalls(dt){
 const direction=controls.target.clone().sub(camera.position),distance=direction.length();raycaster.set(camera.position,direction.normalize());raycaster.far=distance;
 const root=o=>{let p=o;while(p.parent&&p.parent!==scene&&p.parent!==office){if(p.userData.objectId)break;p=p.parent;}return p;};
 const blocked=new Set((state.cutaway?raycaster.intersectObjects(wallMeshes,false):[]).map(h=>root(h.object)));
 for(const o of wallMeshes){const group=root(o);group.visible=!group.userData.deleted&&!blocked.has(group);}
 raycaster.far=Infinity;
}

function loop(now){requestAnimationFrame(loop);detakFps(now);if(now-lastDraw<1000/profilMutu.fps-1)return;lastDraw=now;const realDt=Math.min((now-lastTime)/1000,.1);lastTime=now;if(!state.loaded)return;const dt=state.paused?0:realDt*state.speed;state.time+=dt;HIDUP.detak(realDt);
  /* ── JAM UTAMA MENARI ADALAH LAGUNYA ────────────────────────────────
     `joget.perbarui` menerima jam musik sebagai argumen ketiga dan
     memakainya menggantikan dt yang ditumpuk sendiri. Alasannya tertulis
     di joget.js: dt yang ditumpuk meleset dari ketukan sesudah beberapa
     puluh detik, dan meleset dari ketukan adalah satu-satunya hal yang
     dinilai mata saat melihat orang menari.

     `waktu()` memulangkan null kalau lagunya tidak berbunyi — peramban
     menahan autoplay, berkasnya hilang, atau panggungnya belum mulai — dan
     di situ joget.js kembali memakai dt. Jadi tariannya tetap jalan tanpa
     musik, cuma tidak terikat ketukan. */
  /* `aktif`, bukan `fase==='joget'` — dan itu inti permintaan pemilik
     23 Sep 2026: "saat klik joget itu musicnya bisa langsung masuk ga
     nunggu robot siap joget".

     Antara klik dan langkah pertama ada fase `kumpul`: robot berjalan
     dari mejanya ke panggung, dan yang terjauh butuh sampai 14 detik.
     Selama itu layarnya bergerak tanpa suara sama sekali.

     Ada untungnya yang kedua, dan ini yang lebih penting daripada
     kesan: `play()` sekarang dipanggil pada bingkai SESUDAH kliknya,
     bukan empat belas detik kemudian. Peramban menolak autoplay yang
     terlalu jauh dari sentuhan orangnya — jadi musik yang dulu kadang
     tidak mau bunyi sama sekali sekarang berangkat di dalam jendela
     izin yang sama dengan kliknya. */
  if(joget.aktif){
    /* Penanda yang dibandingkan BUKAN nomor gerakan lagi, melainkan nama
       berkas lagunya: dalam mode pilihan-sendiri, gerakan boleh berganti
       tanpa lagunya ikut berganti — dan mengganti `src` di tengah lagu
       memulangkannya ke detik nol. */
    const lg=laguSekarang();
    if(lg&&musikIndeks!==lg.b){musikIndeks=lg.b;void musik.pasang(lg);}
    /* Laju lagu SELALU 1: yang boleh melambat gerakannya, bukan nadanya.
       Jeda tetap diteruskan — lagu yang jalan terus saat simulasi dijeda
       adalah dua hal yang mengaku satu. */
    musik.transport(state.paused,1);
    const w=musik.waktu();
    const terkunci=w!==null&&Math.abs(joget.tempo-1)<.02&&state.speed===1;
    if(terkunci){
      if(jamLaguSebelum!==null)jamPose+=Math.max(0,w-jamLaguSebelum);
      jamLaguSebelum=w;
    }else{jamPose+=dt*joget.tempo;jamLaguSebelum=null;}
  }else if(musikIndeks!==-1&&joget.fase==='mati'){musikIndeks=-1;musik.matikan();jamLaguSebelum=null;}
  joget.perbarui(dt,npcs,joget.fase==='joget'?jamPose:null);
  if(jogetBerhentiHabis&&joget.fase==='joget'&&laguPilihan<0&&joget.kunci===null&&joget.putaranPenuh)
    tutupPanggung('Sepuluh gerakan selesai — robot kembali ke meja.',true);
  for(const st of Object.values(stations)){
    if(!st.kursi)continue;
    st.tarik=clamp((st.tarik||0)+(st.tarikMau?dt*2.6:-dt*2),0,1);
    st.tarikMau=false;
    geserKursi(st);
  }
  if(joget.ganti){$('#camera-name').textContent='Joget · '+joget.ganti;toast('Joget · '+joget.ganti);joget.ganti='';}
  stairRoute?.tick(dt,npcs,joget.aktif);
  for(const n of npcs)n.update(dt,state.time);updateCamera(realDt);beatCamera.apply(camera,joget,state.paused,interacting||atur.seret);performanceAudio.dance(joget,npcs,state.paused);selubung?.update(camera,realDt);if(frame%8===0)updateWalls(realDt*8);updateLabels();if(now-lastScreen>profilMutu.screenInterval*1000/3){

    const sekali=Math.max(1,Math.ceil(screens.length/3));
    for(let k=0;k<sekali;k++){const s=screens[(giliranLayar+k)%screens.length];
      paintTerminal(s.canvas,s.kind,state.time,s.koin,s.tf);s.texture.needsUpdate=true;}
    giliranLayar=(giliranLayar+sekali)%screens.length;lastScreen=now;}if(now-lastUI>200){updateUI();lastUI=now;}for(const o of objectCatalog)if(o.userData.deleted)o.visible=false;pasca.render(realDt);frame++;}

function togglePause(){state.paused=!state.paused;if(state.paused)performanceAudio.stopVoice();$('#pause-btn').innerHTML=icon(state.paused?'play':'pause');$('#pause-btn').setAttribute('aria-label',state.paused?'Lanjutkan simulasi':'Jeda simulasi');toast(state.paused?'Aktivitas robot dijeda. Kamera tetap bisa digerakkan.':'Aktivitas robot dilanjutkan.');}
function toggleUI(){document.body.classList.toggle('hide-ui');}
/** Ganti PROFIL: seluruh setelan tangan dibuang. Lihat catatan di
 *  quality.js — profil adalah "kembalikan ke keadaan yang saya tahu". */
function setQuality(value){
  if(!QUALITY[value])return;
  mutu=value;kustomMutu={};simpanKustom(kustomMutu);
  profilMutu=susunProfil(mutu);saveQuality(value);
  terapkanMutu('Kualitas '+profilMutu.label+' diterapkan.');
  isiPanelMutu();
}

/** Ubah SATU setelan tangan. Nilai yang sama dengan profilnya dihapus dari
 *  lapisan, bukan disimpan — supaya "kembalikan ke profil" benar-benar
 *  mengosongkan, dan supaya medan yang tidak disentuh tetap ikut berubah
 *  saat profilnya berganti. */
function setMutuKustom(medan,nilai){
  if(QUALITY[mutu][medan]===nilai)delete kustomMutu[medan];
  else kustomMutu[medan]=nilai;
  simpanKustom(kustomMutu);
  profilMutu=susunProfil(mutu);
  terapkanMutu();
}

function terapkanMutu(pesan){
  pasca?.dispose();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,profilMutu.pixelRatio));
  renderer.setSize(innerWidth,innerHeight);
  scene.traverse(o=>{
    if(!o.isLight||!o.castShadow)return;
    const size=Math.min(renderer.capabilities.maxTextureSize,profilMutu.shadowSize);
    o.shadow.mapSize.set(size,size);o.shadow.map?.dispose();o.shadow.map=null;
    o.shadow.needsUpdate=true;
  });
  if(profilMutu.reflectionSize&&!roomReflectionReady){
    const visible=npcs.map(n=>n.group.visible);npcs.forEach(n=>n.group.visible=false);
    try{captureRoomReflections(renderer,scene,profilMutu.reflectionSize);roomReflectionReady=true;}
    finally{npcs.forEach((n,i)=>n.group.visible=visible[i]);}
  }
  /* ── BAYANGAN: SAKELAR SEBENARNYA, BUKAN UKURAN PETA NOL ───────────
     Mematikan `renderer.shadowMap.enabled` menghapus SATU LINTASAN GAMBAR
     penuh — seluruh ruangan digambar dua kali tiap frame selama ia menyala,
     sekali untuk peta bayangan dan sekali untuk kamera. Itu sebabnya ia
     kendali paling atas di panel dan paling terasa di angka fps. */
  renderer.shadowMap.enabled=profilMutu.bayangan!==false&&profilMutu.shadowSize>0;
  renderer.shadowMap.needsUpdate=true;
  /* Robot: 7 x 26 mesh berbulu yang ikut digambar ke peta bayangan tiap
     frame karena merekalah satu-satunya yang BERGERAK — benda diam bisa
     memakai peta yang sama berulang, robot tidak. */
  for(const n of (npcs||[]))n.model?.traverse(o=>{if(o.isMesh)o.castShadow=profilMutu.bayanganRobot!==false;});
  terapkanAreaKantor();setLightBudget();pasca=createMorningRenderer(renderer,scene,camera,profilMutu);
  lastDraw=0;if(pesan)toast(pesan);
}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Mode layar penuh tidak tersedia pada tampilan ini.');}}
/* ══ PANEL SETELAN KUALITAS ═══════════════════════════════════════════════
   Ikon gerigi di bilah atas. Isi panel SELALU dibaca ulang dari
   `profilMutu` yang sedang berlaku — bukan disimpan sendiri di dalam
   panelnya — supaya mengganti profil dari dropdown mana pun langsung
   terlihat di seluruh kendali, dan tidak ada dua sumber kebenaran yang
   suatu hari berselisih.

   PENGHITUNG FPS di kepalanya bukan hiasan: tanpa angka yang bergerak,
   tiap sakelar di bawahnya cuma bisa dinilai dengan perasaan. Dengan
   angka itu, pemilik bisa mematikan bayangan dan MELIHAT bedanya — itu
   yang membuat panel ini alat ukur, bukan sekadar daftar kenop. */
let fpsHitung=0,fpsWaktu=0;
function detakFps(now){
  fpsHitung++;
  if(!fpsWaktu){fpsWaktu=now;return;}
  if(now-fpsWaktu<500)return;
  const f=Math.round(fpsHitung*1000/(now-fpsWaktu));
  fpsHitung=0;fpsWaktu=now;
  const el=$('#mutu-fps');
  if(el&&!$('#mutu-panel').hidden)el.textContent=f+' fps';
}

function isiPanelMutu(){
  const p=$('#mutu-panel');if(!p)return;
  const set=(id,nilai)=>{const e=$(id);if(e)e.value=String(nilai);};
  const cek=(id,nilai)=>{const e=$(id);if(e)e.checked=!!nilai;};
  set('#mutu-profil',mutu);
  set('#quality-select',mutu);
  set('#mutu-bayangan',profilMutu.bayangan===false?0:profilMutu.shadowSize);
  cek('#mutu-bayangan-robot',profilMutu.bayanganRobot!==false);
  set('#mutu-lampu',profilMutu.lampu||'semua');
  set('#mutu-res',profilMutu.pixelRatio);
  $('#mutu-res-nilai').textContent=Number(profilMutu.pixelRatio).toFixed(2)+'x';
  set('#mutu-fps-batas',profilMutu.fps);
  cek('#mutu-bloom',profilMutu.bloom);
  cek('#mutu-ao',profilMutu.ao);
  cek('#mutu-pantul',profilMutu.reflectionSize>0);
  cek('#mutu-kantor-perluasan',profilMutu.kantorPerluasan!==false);
  cek('#mutu-kantor-atas',profilMutu.kantorAtas!==false);
  cek('#mutu-lampu-atap',profilMutu.lampuAtap!==false);
  set('#mutu-layar',profilMutu.screenInterval);
  $('#mutu-layar-nilai').textContent=Number(profilMutu.screenInterval).toFixed(1).replace('.',',')+' dtk';
}

function bukaPanelMutu(buka){
  const p=$('#mutu-panel');if(!p)return;
  p.hidden=!buka;
  $('#mutu-btn')?.setAttribute('aria-expanded',String(buka));
  if(buka)isiPanelMutu();
}

function wirePanelMutu(){
  if(!$('#mutu-panel'))return;
  $('#mutu-btn').onclick=()=>bukaPanelMutu($('#mutu-panel').hidden);
  $('#mutu-tutup').onclick=()=>bukaPanelMutu(false);
  $('#mutu-profil').onchange=e=>setQuality(e.target.value);
  /* Bayangan: "Mati" bukan ukuran peta nol — ia mematikan seluruh lintasan
     gambarnya. Dua medan diubah sekaligus supaya menyalakannya lagi
     mengembalikan ukuran yang dipilih, bukan ukuran nol. */
  $('#mutu-bayangan').onchange=e=>{
    const v=Number(e.target.value);
    if(v===0){setMutuKustom('bayangan',false);}
    else{kustomMutu.shadowSize=v;setMutuKustom('bayangan',true);}
    isiPanelMutu();
  };
  $('#mutu-bayangan-robot').onchange=e=>setMutuKustom('bayanganRobot',e.target.checked);
  $('#mutu-lampu').onchange=e=>setMutuKustom('lampu',e.target.value);
  $('#mutu-res').oninput=e=>{
    const v=Number(e.target.value);
    $('#mutu-res-nilai').textContent=v.toFixed(2)+'x';
    setMutuKustom('pixelRatio',v);
  };
  $('#mutu-fps-batas').onchange=e=>setMutuKustom('fps',Number(e.target.value));
  $('#mutu-bloom').onchange=e=>setMutuKustom('bloom',e.target.checked);
  $('#mutu-ao').onchange=e=>setMutuKustom('ao',e.target.checked);
  /* Pantulan dinyalakan ke 128: ukuran profil Seimbang. Menyalakannya ke
     ukuran profil Tinggi dari profil Ringan akan memberi ongkos yang tidak
     diminta siapa pun. */
  $('#mutu-pantul').onchange=e=>setMutuKustom('reflectionSize',e.target.checked?128:0);
  $('#mutu-kantor-perluasan').onchange=e=>setMutuKustom('kantorPerluasan',e.target.checked);
  $('#mutu-kantor-atas').onchange=e=>setMutuKustom('kantorAtas',e.target.checked);
  $('#mutu-lampu-atap').onchange=e=>setMutuKustom('lampuAtap',e.target.checked);
  $('#mutu-layar').oninput=e=>{
    const v=Number(e.target.value);
    $('#mutu-layar-nilai').textContent=v.toFixed(1).replace('.',',')+' dtk';
    setMutuKustom('screenInterval',v);
  };
  $('#mutu-reset').onclick=()=>{
    kustomMutu={};simpanKustom(kustomMutu);
    profilMutu=susunProfil(mutu);
    terapkanMutu('Setelan dikembalikan ke profil '+profilMutu.label+'.');
    isiPanelMutu();
  };
  isiPanelMutu();
}

function wireUI(){
  wirePanelMutu();wireSudut();
  $('#quality-select').value=mutu;$('#quality-select').disabled=false;$('#quality-select').onchange=e=>setQuality(e.target.value);
  $$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$$('[data-npc]').forEach(b=>b.onclick=()=>selectNPC(+b.dataset.npc));$('#next-npc').onclick=()=>selectNPC(state.selected+1);$('#focus-btn').onclick=()=>focusNPC();$('#wave-btn').onclick=()=>{performanceAudio.unlock();npcs[state.selected].greet();performanceAudio.say('greeting',npcs[state.selected],true);focusNPC();toast(npcs[state.selected].profile.name+' menyapamu.');};$('#joget-btn').onclick=()=>{

    const m=$('#joget-menu');m.hidden=!m.hidden;
    $('#joget-btn').setAttribute('aria-expanded',String(!m.hidden));
    if(!m.hidden)tandaiMenuJoget();
  };

  addEventListener('pointerdown',e=>{
    const m=$('#joget-menu');
    if(m.hidden||$('.joget-wrap').contains(e.target))return;
    m.hidden=true;$('#joget-btn').setAttribute('aria-expanded','false');
  });
  /* Volume musik BERDIRI SENDIRI dari volume efek (PerformanceAudio).
     Yang satu lagu yang berbunyi terus, yang satu langkah dan nada
     profit yang berbunyi sekejap — menyatukannya di satu geseran berarti
     mengecilkan musik ikut membisukan umpan balik. */
  /* ── DAFTAR LAGU ────────────────────────────────────────────────────
     Dibangun dari kode, bukan ditulis di index.html: 26 tombol yang
     diketik tangan adalah 26 kesempatan agar nomor berkas dan labelnya
     berselisih, dan selisih itu baru ketahuan saat lagunya salah bunyi.

     Labelnya membawa durasi dan BPM. Nama berkasnya sendiri tidak
     mengatakan apa-apa (video aslinya bernama "Download (7)"), jadi durasi
     itulah satu-satunya cara mengenali lagu tanpa memutar semuanya. */
  (function(){
    const kotak=$('#lagu-daftar');if(!kotak)return;
    const mmss=(d)=>Math.floor(d/60)+':'+String(d%60).padStart(2,'0');
    const buat=(i,label,ket)=>{
      const b=document.createElement('button');
      b.className='joget-item lagu-item';b.dataset.lagu=String(i);
      b.innerHTML='<span>'+label+'</span><span class="lagu-ket">'+ket+'</span>';
      b.onclick=()=>{
        laguPilihan=i;
        try{localStorage.setItem('jt.trabar.lagu',String(i));}catch(e){}
        tandaiLagu();
        /* Kalau panggungnya sedang jalan, langsung berganti — menunggu
           gerakan berikutnya membuat pilihannya terasa tidak menanggapi. */
        if(joget.fase==='joget'){const lg=laguSekarang();if(lg){musikIndeks=lg.b;void musik.pasang(lg);}}
      };
      return b;
    };
    kotak.appendChild(buat(-1,'Otomatis','ikut gerakan'));
    LAGU.forEach((l,i)=>kotak.appendChild(buat(i,'Lagu '+(i+1),mmss(l.d)+' · '+l.bpm+' BPM')));
    tandaiLagu();
  })();

  (function(){
    const g=$('#musik-vol');if(!g)return;
    let v=parseFloat(localStorage.getItem('jt.trabar.musikVol')||'0.48');
    if(!isFinite(v))v=.48;
    g.value=String(v);musik.setVolume(v);
    const out=$('#musik-vol-nilai');if(out)out.textContent=Math.round(v*100)+'%';
    g.addEventListener('input',()=>{
      const n=parseFloat(g.value);musik.setVolume(isFinite(n)?n:.48);
      if(out)out.textContent=Math.round((isFinite(n)?n:.48)*100)+'%';
      try{localStorage.setItem('jt.trabar.musikVol',g.value);}catch(e){}
    });
  })();
  (function(){
    const k=$('#joget-habis');if(!k)return;
    k.checked=jogetBerhentiHabis;
    k.addEventListener('change',()=>{
      jogetBerhentiHabis=k.checked;musik.setUlang(!k.checked);
      try{localStorage.setItem('jt.trabar.jogetHabis',k.checked?'1':'0');}catch(e){}
    });
  })();
  $$('[data-joget]').forEach(b=>b.onclick=()=>{
    performanceAudio.unlock();const i=+b.dataset.joget;
    if(joget.aktif){joget.pilihGerakan(i);}
    else{
      modeSebelumJoget=state.mode;joget.mulai(npcs,nav,i);beatCamera.shot=-1;beatCamera.lastView=null;

      setMode('orbit',false);
      moveCamera(V(PANGGUNG.x+4.68,2.35,PANGGUNG.z+4.51),V(PANGGUNG.x,.95,PANGGUNG.z),2.2);
      $('#camera-name').textContent='Panggung joget';
    }
    tandaiMenuJoget();
  });
  $('#joget-tutup').onclick=()=>tutupPanggung();

  setInterval(tandaiMenuJoget,700);$('#pause-btn').onclick=togglePause;$('#speed-btn').onclick=()=>{state.speed=state.speed===1?2:state.speed===2?.5:1;$('#speed-btn').textContent=state.speed+'×';};$('#cutaway-toggle').onchange=e=>state.cutaway=e.target.checked;$('#labels-toggle').onchange=e=>state.labels=e.target.checked;$('#fullscreen-btn').onclick=fullscreen;$('#ui-btn').onclick=toggleUI;$('#restore-ui').onclick=toggleUI;$('#help-btn').onclick=()=>$('#help').showModal();$('#close-help').onclick=()=>$('#help').close();$('#help').onclick=e=>{if(e.target===$('#help')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
  addEventListener('keydown',e=>{if(!state.loaded||$('#help').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const key=e.key.toLowerCase();if(key===' '){e.preventDefault();togglePause();}if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault();urungLangkah();return;}if(e.key==='Escape'){tutupPopup();aturLepas();}
    if(atur.objek&&allowLayoutEdit()){
      if(key==='delete'||key==='backspace'){e.preventDefault();toggleObjectDeleted(atur.objek);return;}
      if(['q','e','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown'].includes(key)||['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.key))catatLangkah(atur.objek);
      const o=atur.objek,langkah=e.shiftKey?.15:.02,sudut=(e.shiftKey?15:2)*Math.PI/180;
      let kena=true;
      if(key==='q')o.rotation.y+=sudut;
      else if(key==='e')o.rotation.y-=sudut;
      else if(e.key==='ArrowLeft')o.position.x-=langkah;
      else if(e.key==='ArrowRight')o.position.x+=langkah;
      else if(e.key==='ArrowUp')o.position.z-=langkah;
      else if(e.key==='ArrowDown')o.position.z+=langkah;
      else if(e.key==='PageUp')o.position.y+=langkah;
      else if(e.key==='PageDown')o.position.y-=langkah;
      else kena=false;
      if(kena){e.preventDefault();commitObjectPosition(o);atur.kotak.update();hudAtur();return;}
    }
    if(key==='h')toggleUI();if(key==='f')fullscreen();const k=['overview','desk','market','meeting','top','interior','expansion','stairs'][+key-1];if(k)setView(k);});
}

function updateDataStatus(){
  const market=HIDUP.statusPasar(),label=$('.sim-label');
  label.textContent=market.live?'PASAR LIVE':market.any?'PASAR TERTUNDA':'PASAR DEMO';
  label.dataset.state=market.live?'live':'offline';
  const e=$('#analyst-status');if(e){
    const live=npcs.filter(n=>n.profile.analis).length;
    e.textContent=HIDUP.kabar.sinyalGalat?'Data sinyal tertunda':HIDUP.kabar.kartuGalat?(live?'Data analis tertunda':'Data analis belum tersedia'):live+' analis · JadiTrader';
    e.dataset.state=(HIDUP.kabar.kartuGalat||HIDUP.kabar.sinyalGalat)?'offline':'live';
  }
}

async function start(){try{
  setupRenderer();
  const progress={office:0,robot:0,'office-extension':0,'analyst-desks':0,'stair-office':0};
  const loader=new GLTFLoader(new THREE.LoadingManager());
  const asset=name=>loader.loadAsync('./assets/'+name+'.glb',event=>{
    progress[name]=event.lengthComputable?event.loaded/event.total:Math.min(.85,event.loaded/(16*1024*1024));
    const pct=12+Object.values(progress).reduce((a,b)=>a+b,0)/5*80;
    $('#loading-progress').style.width=pct+'%';$('#loading-note').textContent=Math.round(pct)+'% · Kantor, meja analis & robot';
  });
  const json=name=>fetch('./assets/'+name+'.json').then(r=>{if(!r.ok)throw Error(name+' missing');return r.json();});
  const dataTask=susunPemain();
  const result=await Promise.all([asset('office'),asset('robot'),json('office-layout'),json('navigation'),
    new THREE.TextureLoader().loadAsync('./assets/city-panorama.png'),asset('office-extension'),json('office-extension'),asset('analyst-desks'),asset('stair-office'),json('stair-office')]);
  layout=result[2];layout.expansion=result[6];layout.stair=result[9];Object.assign(stations,layout.expansion.stations,layout.stair.stations);
  const coffee=layout.anchors['Left coffee station']?.position;if(coffee){stations.coffee.look=[coffee[0],coffee[2]];stations.coffee.position=[coffee[0],coffee[2]+1.05];}
  nav=new Navigation(result[3]);loadOffice(result[0],result[5],result[7],result[8]);refineNavigation(nav);stairRoute=new StairRoute(nav,office,stations);
  camera.position.copy(overviewPosition());controls.target.copy(officeCenter());controls.update();
  result[4].colorSpace=THREE.SRGBColorSpace;result[4].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  selubung=new RoomEnvelope(scene,office,layout,result[4]);selubung.update(camera,10);
  scene.traverse(o=>{if(o.isLight&&(o.isRectAreaLight||o.isSpotLight||o.isPointLight)&&o.name!=='Soft daylight from glazing'){o.userData.baseBrightness=o.intensity;ceilingLights.push(o);}if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.emissiveIntensity>0&&!ceilingEmissions.has(m)){ceilingEmissions.set(m,m.emissiveIntensity);}});
  setupMarkets();registerObjects();for(const o of objectCatalog)ingatAwal(o);
  await loadSavedLayout();void HIDUP.mulaiPasar();
  captureRoomReflections(renderer,scene,profilMutu.reflectionSize);roomReflectionReady=!!profilMutu.reflectionSize;
  for(const st of Object.values(stations))if(st.duduk){ukurKursi(st);kumpulkanKursi(st);}
  robotTemplate=result[1];daftarPemain=await dataTask;pasangChip();
  npcs=daftarPemain.map((_,i)=>new NPC(i,robotTemplate));
  for(const n of npcs)if(npcs.some(o=>o!==n&&o.station===n.station&&o.index<n.index))n.depart();
  /* Ikut dipanggil di MUAT PERTAMA, bukan cuma saat setelannya diubah.
     Tanpa ini, area yang disembunyikan kemarin akan tergambar lagi tiap
     halaman dibuka — setelan yang tersimpan tapi tidak berlaku sampai
     disentuh sekali lebih membingungkan daripada setelan yang tidak ada. */
  terapkanAreaKantor();setLightBudget();pasca=createMorningRenderer(renderer,scene,camera,profilMutu);
  wireUI();wirePerformance();selectNPC(0,false);setMode('cinema');
  $('#loading-progress').style.width='100%';$('#loading-text').textContent='Trading floor siap';
  await renderer.compileAsync(scene,camera);state.loaded=true;$('#loading').classList.add('done');lastTime=performance.now();requestAnimationFrame(loop);
  setInterval(segarkanAnalis,60000);setTimeout(()=>$('#loading').remove(),800);document.body.classList.toggle('compact',innerWidth<480);
}catch(error){fail(error);}}
start();

function objekTerlihat(o){
 for(let p=o;p;p=p.parent)if(!p.visible)return false;
 const mats=Array.isArray(o.material)?o.material:[o.material];
 return !mats.length||mats.some(m=>m&&m.colorWrite!==false&&(!m.transparent||m.opacity>.12));
}
function commitObjectPosition(o,save=true){
 o.updateWorldMatrix(true,true);
 if(o===marketBoard){updateMarketBoard(marketBoard,stations.market);reserveMarketBoard(marketBoard,nav);}
 for(const st of Object.values(stations))if(st.chair===o){
  for(const b of st.kursi||[])b.asal.copy(o.position).addScaledVector(b.arah,-smooth(st.tarik||0)*TARIK_KURSI);
  ukurKursi(st);
 }
 if(save&&o.userData.objectId){const chair=Object.values(stations).find(st=>st.chair===o);const position=chair?.kursi?.[0]?.asal||o.position;
  layoutStore.record(o.userData.objectId,{p:position.toArray(),r:[o.rotation.x,o.rotation.y,o.rotation.z],deleted:!!o.userData.deleted});}
}
function layoutStatus(message,kind=''){
 const el=$('#layout-status');if(el){el.textContent=message;el.dataset.kind=kind;}
 if($('#layout-signin'))$('#layout-signin').hidden=kind!=='signin';
 if($('#layout-reload'))$('#layout-reload').hidden=!['conflict','load-error'].includes(kind);
}
const layoutStore=new LayoutStore(layoutStatus);
function allowLayoutEdit(){if(layoutStore.ready&&layoutStore.auth&&!layoutStore.conflict)return true;$('#object-panel').hidden=false;toast('Buka Pilih objek untuk memuat atau masuk dan menyimpan tata letak.');return false;}
async function loadSavedLayout(){
 const saved=await layoutStore.load();if(!saved)return;
 for(const st of Object.values(stations))st.tarik=0;
 for(const o of objectCatalog){const base=o.userData.aturAwal;if(base){o.position.copy(base.p);o.rotation.copy(base.r);}o.userData.deleted=false;o.visible=true;}
 for(const o of objectCatalog){const v=saved[o.userData.objectId];if(!v)continue;o.position.fromArray(v.p);o.rotation.set(...v.r);o.userData.deleted=v.deleted;o.visible=!v.deleted;}
 scene.updateMatrixWorld(true);for(const o of objectCatalog)commitObjectPosition(o,false);fillObjectCatalog();
}
function toggleObjectDeleted(o){
 catatLangkah(o);o.userData.deleted=!o.userData.deleted;o.visible=!o.userData.deleted;commitObjectPosition(o);fillObjectCatalog();hudAtur();
 toast(o.userData.deleted?'Objek dihapus. Gunakan Urungkan untuk memulihkan.':'Objek dipulihkan.');
}

function registerObjects(){
 const seen=new Set();let serial=0;
 scene.traverse(o=>{
  if(o.type.endsWith('Helper')||o.userData.npc||o.userData.takBisaDiatur)return;
  if(o.isMesh){const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>m.colorWrite===false))return;}
  if(o.userData.objectId){if(!seen.has(o)){objectCatalog.push(o);seen.add(o);}return;}
  if(!o.isMesh)return;
  for(let p=o.parent;p&&p!==scene;p=p.parent)if(p.userData.objectId)return;
  if(/shadow|contact|ground|studio|occlusion/i.test(o.name))return;
  const path=[];for(let p=o;p&&p!==scene;p=p.parent)path.unshift((p.name||p.type)+':'+(p.parent?.children.indexOf(p)??0));let hash=2166136261;for(const char of path.join('/'))hash=Math.imul(hash^char.charCodeAt(0),16777619);
  o.userData.objectId='detail-'+(hash>>>0).toString(16);o.userData.objectName=o.name||('Detail ruangan '+serial);o.userData.selectAsWhole=true;
  objectCatalog.push(o);seen.add(o);
 });
 objectCatalog.sort((a,b)=>namaObjek(a).localeCompare(namaObjek(b),'id'));
}
function fillObjectCatalog(){
 const term=$('#object-search').value.toLocaleLowerCase('id');const rows=objectCatalog.filter(o=>(namaObjek(o)+' '+o.userData.category+' '+o.userData.objectId).toLocaleLowerCase('id').includes(term));
 const list=$('#object-list'),selected=list.value;list.replaceChildren();
 for(const o of rows){const option=document.createElement('option');option.value=o.uuid;option.textContent=(o.userData.deleted?'[Dihapus] ':'')+namaObjek(o);list.appendChild(option);}
 list.value=selected;$('#object-count').textContent=rows.length+' / '+objectCatalog.length+' objek';
}
function wirePerformance(){
 const paintStatus=()=>{const n=npcs[state.selected];$('#robot-paint-status').textContent=n?.paintSaved?'Tersimpan di browser ini.':'Warna diterapkan; penyimpanan browser tidak tersedia.';updatePaintControls(n);};
 const changePaint=(hex,shade)=>{const n=npcs[state.selected];if(setRobotPaint(n,hex,shade))paintStatus();};
 for(const [name,hex] of PAINT_PRESETS){const b=document.createElement('button');b.type='button';b.className='paint-swatch';b.style.backgroundColor=hex;b.dataset.paint=hex;b.title=name;b.setAttribute('aria-label','Warna '+name);b.setAttribute('aria-pressed','false');b.onclick=()=>changePaint(hex,npcs[state.selected]?.paintShade);$('#robot-palette').appendChild(b);}
 $('#robot-color').oninput=e=>changePaint(e.target.value,npcs[state.selected]?.paintShade);
 $('#robot-shade').oninput=e=>changePaint(npcs[state.selected]?.paintHex,+e.target.value/100);
 $('#robot-paint-reset').onclick=()=>{resetRobotPaint(npcs[state.selected]);paintStatus();};
 $('#visit-upstairs').onclick=()=>{const n=npcs[state.selected];if(joget.aktif){toast('Tutup panggung sebelum menjelajah tangga.');return;}stairRoute.request(n);stairRoute.delay=0;toast(stairRoute.owner?'Robot menunggu giliran naik tangga.':'Robot akan menjelajah lantai atas.');};
 $('#dance-tempo').onchange=e=>joget.tempoMode=e.target.value;
 $('#beat-toggle').checked=beatCamera.enabled;$('#beat-toggle').onchange=e=>{beatCamera.enabled=e.target.checked;beatCamera.clear(camera);};
 $('#emotion-select').onchange=e=>{performanceAudio.unlock();const n=npcs[state.selected];n.performance?.setMood(e.target.value,state.time);if(e.target.value==='sad')performanceAudio.say('loss',n,true);else if(e.target.value==='happy')performanceAudio.say('cheer',n,true);};
 $('#object-mode').onclick=()=>{
  editMode=!editMode;$('#object-mode').setAttribute('aria-pressed',String(editMode));$('#object-panel').hidden=!editMode;if(editMode){setMode('orbit',false);for(const st of Object.values(stations)){st.tarik=0;geserKursi(st);}fillObjectCatalog();toast('Pilih benda di ruangan atau dari daftar.');}else aturLepas();
 };
 $('#object-search').oninput=fillObjectCatalog;
 $('#layout-save').onclick=()=>layoutStore.save();$('#layout-reload').onclick=()=>loadSavedLayout();
 $('#object-undo').onclick=()=>{if(allowLayoutEdit())urungLangkah();};
 $('#beat-angles').checked=beatCamera.angles;$('#beat-angles').onchange=e=>{beatCamera.angles=e.target.checked;beatCamera.shot=-1;};
 $('#beat-strength').oninput=e=>beatCamera.strength=+e.target.value;
 addEventListener('beforeunload',e=>{if(layoutStore.dirty){e.preventDefault();e.returnValue='';}});
 $('#object-list').onchange=e=>{
  const o=objectCatalog.find(o=>o.uuid===e.target.value);if(!o)return;
  ingatAwal(o);aturPilih(o);const bounds=new THREE.Box3().setFromObject(o),point=bounds.getCenter(V()),distance=Math.max(1.8,bounds.getSize(V()).length()*1.1);
  const direction=camera.position.clone().sub(controls.target).normalize();moveCamera(point.clone().addScaledVector(direction,distance),point,1.0);
 };
 $('#object-close').onclick=()=>$('#object-mode').click();
 $('#ceiling-brightness').oninput=e=>setCeilingBrightness(+e.target.value);
 $$('[data-brightness]').forEach(b=>b.onclick=()=>setCeilingBrightness(+b.dataset.brightness));
 let value=.75;try{value=Number(localStorage.getItem('floor-ceiling')??.75);}catch{}setCeilingBrightness(value);
}
function updatePaintControls(n){
 if(!n?.paintColor)return;
 if(document.activeElement!==$('#robot-color'))$('#robot-color').value=n.paintHex;
 if(document.activeElement!==$('#robot-shade'))$('#robot-shade').value=Math.round(n.paintShade*100);
 $('#robot-color-value').textContent=n.paintHex.toUpperCase();$('#robot-shade-value').textContent=Math.round(n.paintShade*100)+'%';
 $('#robot-paint-owner').textContent=n.profile.name;
 $('#robot-paint-status').textContent=n.paintSaved===false?'Warna diterapkan; penyimpanan browser tidak tersedia.':'Tersimpan di browser ini.';
 $$('[data-paint]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.paint===n.paintHex)));
}
const ceilingLights=[],ceilingEmissions=new Map();
function setCeilingBrightness(value){
 value=clamp(Number.isFinite(value)?value:.75,0,2);$('#ceiling-brightness').value=value;$('#ceiling-value').textContent=Math.round(value*100)+'%';
 for(const light of ceilingLights)light.intensity=light.userData.baseBrightness*value;
 for(const [m,base] of ceilingEmissions)m.emissiveIntensity=base*value;
 try{localStorage.setItem('floor-ceiling',String(value));}catch{}
}

/* ══ AREA KANTOR YANG DISEMBUNYIKAN ═══════════════════════════════════════
   Diminta pemilik 26 Sep 2026: "kantor ke-2 itu masih belum dipakai
   sebenarnya, jangan dihapus aja cukup di-hide biar ga ke-render, tapi
   nanti ada tombol untuk ditampilkan lagi."

   Yang disembunyikan BUKAN cuma geometrinya. Tiga hal sekaligus, dan yang
   kedua justru yang paling menentukan:

     1. Geometri  — `visible=false` membuat three.js melewati seluruh
                    cabangnya, termasuk di lintasan bayangan.
     2. LAMPU     — tiga belas RectAreaLight itu berdiri SENDIRI di scene,
                    bukan anak dari kantornya. Menyembunyikan ruangannya
                    tanpa lampunya berarti membayar penuh biaya termahal
                    ruangan ini untuk ruangan yang tidak digambar.
     3. Stasiun   — robot punya rute ke `research`, `briefing`, dan
                    `stairLounge`. Tanpa penandaan ini mereka tetap berjalan
                    ke sana, dan yang terlihat adalah robot yang melangkah
                    masuk ke kekosongan.

   Lampunya dipetakan dari LETAKNYA, bukan dari nomor urut: larik `pools` di
   room-envelope.js boleh bertambah suatu hari, dan daftar indeks yang
   ditulis tangan akan diam-diam salah sesudahnya.

     x <= -12  -> lantai atas & tangga   (3 lampu)
     z >= 10   -> perluasan kantor       (6 lampu)
     sisanya   -> kantor utama           (4 lampu) */
function areaLampu(l){
  return l.position.x<=-12?'atas':l.position.z>=10?'perluasan':'utama';
}
function areaSembunyi(){
  const s=new Set();
  if(profilMutu.kantorPerluasan===false)s.add('perluasan');
  if(profilMutu.kantorAtas===false)s.add('atas');
  return s;
}
function terapkanAreaKantor(){
  const sembunyi=areaSembunyi();
  if(perluasanRef)perluasanRef.visible=!sembunyi.has('perluasan');
  if(atasRef)atasRef.visible=!sembunyi.has('atas');
  /* Lantai asli muncul KEBALIKAN dari penggantinya — tepat satu dari
     keduanya terlihat, tidak pernah dua-duanya dan tidak pernah nol. */
  for(const o of lantaiKembali)o.visible=sembunyi.has('perluasan');

  /* Stasiun ditandai, lalu yang sedang menuju ke sana dipulangkan. Tanpa
     langkah kedua, robot yang SUDAH berjalan ke ruangan tersembunyi akan
     tetap sampai dan duduk di sana. */
  const petaArea={};
  for(const k of Object.keys(layout?.expansion?.stations||{}))petaArea[k]='perluasan';
  for(const k of Object.keys(layout?.stair?.stations||{}))petaArea[k]='atas';
  for(const [k,area] of Object.entries(petaArea)){
    if(stations[k])stations[k].disembunyikan=sembunyi.has(area);
  }
  for(const n of (npcs||[])){
    const kunci=Object.keys(stations).find(k=>stations[k]===n.station);
    if(kunci&&stations[kunci]?.disembunyikan)n.depart();
  }
}

function setLightBudget(){
 if(!selubung?.workLights)return;
 /* Dibaca dari SETELAN, bukan dari nama profil. Dulu `mutu==='low'` —
    jadi begitu lampunya bisa diatur sendiri, memilih "Hemat" di profil
    Tinggi tidak akan berpengaruh sama sekali. */
 const p=profilMutu.lampu||'semua';
 /* 'mati' = daftar kosong, bukan null. null berarti SEMUA lampu terlihat —
    dan itu kebalikan persis dari yang diminta. Perbedaan satu nilai yang
    membalikkan artinya seperti ini pantas ditulis, bukan diingat. */
 const kept=p==='mati'?[]:p==='hemat'?[0,4,8,11]:p==='sedang'?[0,1,4,6,7,8,10,11]:null;
 /* Dua syarat, dan keduanya harus lulus: lampu menyala kalau ia masuk jatah
    profil DAN areanya tidak sedang disembunyikan. Memakai salah satunya
    saja berarti menyembunyikan ruangan tapi tetap membayar lampunya, atau
    sebaliknya. */
 const sembunyi=areaSembunyi();
 /* ── MEREDUPKAN BUKAN MEMATIKAN ──────────────────────────────────────
    Penggeser "Lampu plafon" yang sudah ada mengubah `intensity`. Ditarik
    ke 0% ruangannya memang gelap — tapi TIDAK ADA satu pun siklus GPU
    yang dihemat: three.js tetap mengirim lampunya ke shader dan tetap
    menghitung LTC per piksel, cuma hasilnya dikali nol.

    Yang benar-benar melepas biayanya `visible=false`. Lampu yang tidak
    terlihat dikeluarkan dari daftar lampu, program shader-nya disusun
    ulang dengan lampu lebih sedikit, dan barulah ongkos per pikselnya
    turun. Itu beda yang memisahkan "redup" dari "hemat", dan itu yang
    dijawab sakelar ini.

    Diminta pemilik 26 Sep 2026 supaya ia bisa mengujinya sendiri. */
 const mati=profilMutu.lampuAtap===false;
 selubung.workLights.forEach((l,i)=>{
   l.visible=!mati&&(!kept||kept.includes(i))&&!sembunyi.has(areaLampu(l));
 });
 /* Downlight sorot di plafon dan titik cahaya lain ikut, dan itu perlu
    disebut: mereka BUKAN bagian `workLights`, jadi seluruh kendali lampu
    sebelum ini tidak pernah menyentuhnya sama sekali. Empat SpotLight
    dengan bayangan menyala bukan ongkos yang kecil. */
 for(const l of ceilingLights){
   if(!selubung.workLights.includes(l))l.visible=!mati;
 }
}

function selectableRoot(o){
 for(let p=o;p&&p!==scene;p=p.parent){if(p.userData.takBisaDiatur)return null;if(p.userData.objectId||p.userData.npc)return p;}return null;
}
