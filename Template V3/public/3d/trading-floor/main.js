import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {Navigation,stations,roster,clamp,smooth,wrapAngle,marketSeries} from './simulation.js';
import * as HIDUP from './hidup.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const iconPaths={office:'M3 21h18M5 21V5h14v16M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2',monitor:'M3 4h18v12H3zM8 21h8m-4-5v5',chart:'M3 3v18h18M6 15l4-5 4 3 6-7',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M15 3a4 4 0 0 1 0 8m7 10v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',layers:'M12 3 2 8l10 5 10-5-10-5M2 12l10 5 10-5M2 16l10 5 10-5',focus:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',hand:'M8 13V5a2 2 0 0 1 4 0v7-9a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-1-6-4l-3-4a2 2 0 0 1 3-2l1 1',orbit:'M21 12a9 9 0 1 1-5-8M22 3l-1 5-5-1M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',follow:'M12 22v-4m0-12V2M2 12h4m12 0h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0',film:'M3 4h18v16H3zM7 4v16m10-16v16M3 8h4m10 0h4M3 16h4m10 0h4',pause:'M8 5v14M16 5v14',play:'m8 4 12 8-12 8V4Z',help:'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',full:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5'};
const icon=(name)=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[name]||iconPaths.focus}"/></svg>`;
$$('[data-icon]').forEach(e=>e.outerHTML=icon(e.dataset.icon));
for(const [id,name] of [['help-btn','help'],['ui-btn','eye'],['restore-ui','eye'],['fullscreen-btn','full'],['pause-btn','pause']])$('#'+id).innerHTML=icon(name);
const state={time:0,paused:false,speed:1,mode:'orbit',selected:0,cutaway:true,labels:true,loaded:false};
let scene,camera,renderer,controls,nav,npcs=[],office,layout,tween=null,tourIndex=0,tourTimer=0,wallMeshes=[],screens=[],pickTargets=[],frame=0,lastUI=0,lastScreen=-10,giliranLayar=0,followPrevious=null,lastTime=performance.now(),interacting=false;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2800);}
function fail(error){console.error(error);$('#loading').classList.remove('done');$('#loading-text').textContent='Kantor belum berhasil dimuat. Periksa koneksi dan dukungan WebGL browser, lalu coba lagi.';$('#loading-note').textContent='Chrome atau Edge desktop disarankan';$('#retry-btn').hidden=false;$('#retry-btn').onclick=()=>location.reload();}
window.addEventListener('error',e=>{if(!state.loaded)fail(e.error||e.message);});
window.addEventListener('unhandledrejection',e=>{if(!state.loaded)fail(e.reason);});

function setupRenderer(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,innerWidth<760?1.25:1.75));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;$('#world').appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Kantor 3D. Seret untuk memutar, scroll untuk zoom.');
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();state.paused=true;toast('Tampilan 3D terhenti. Muat ulang halaman untuk melanjutkan.');});
  scene=new THREE.Scene();scene.background=new THREE.Color('#0c1923');scene.fog=new THREE.Fog('#0c1923',42,100);
  camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.07,180);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.minDistance=1.8;controls.maxDistance=72;controls.maxPolarAngle=Math.PI/2-.025;controls.minPolarAngle=.045;controls.rotateSpeed=.65;controls.zoomSpeed=.85;controls.panSpeed=.7;controls.screenSpacePanning=true;controls.listenToKeyEvents(window);
  controls.target.set(-.65,.7,.25);camera.position.copy(overviewPosition());controls.update();
  const pmrem=new THREE.PMREMGenerator(renderer);const env=new RoomEnvironment();scene.environment=pmrem.fromScene(env,.045).texture;scene.environmentIntensity=.5;env.dispose();pmrem.dispose();
  /* Cahaya sekitar dulu 1,8 — cukup terang untuk mengisi setiap bayangan
     sampai rata dengan lantainya. Diturunkan supaya yang gelap tetap
     gelap; kehilangan terangnya diganti lampu utama di bawah. */
  const hemi=new THREE.HemisphereLight('#d9eeff','#76624e',.95);scene.add(hemi);
  const key=new THREE.DirectionalLight('#fff0db',4.2);key.position.set(-7,17,11);key.castShadow=true;key.shadow.mapSize.set(innerWidth<760?1024:2048,innerWidth<760?2048:4096);/* Kamera bayangan dirapatkan ke ruangannya (dulu ±14 m, separuhnya
     langit kosong). Petak yang sama kini menutup wilayah lebih kecil,
     jadi tiap teksel bayangan menutup ~5 mm alih-alih ~1,4 cm — itu
     bedanya antara tepi bayangan yang tajam dan yang berlumur. */
  Object.assign(key.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:42});key.shadow.camera.updateProjectionMatrix();
  /* normalBias 0,035 mendorong bayangan MENJAUH dari benda yang
     menaunginya — cukup untuk menghapus bayangan kontak di kaki kursi
     dan telapak robot. Dikecilkan; jerawat bayangan ditahan bias biasa. */
  key.shadow.normalBias=.012;key.shadow.bias=-.00012;key.shadow.radius=2;scene.add(key);scene.add(key.target);
  const fill=new THREE.DirectionalLight('#9ac8ee',.85);fill.position.set(10,8,-8);scene.add(fill);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:'#10202b',roughness:.94,metalness:.05}));ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=true;/* Latar, bukan perabot: memilihnya tidak pernah berguna dan ia selalu
     kena sinar lebih dulu kalau klik meleset. */
  ground.name='Lantai luar';ground.userData.takBisaDiatur=true;scene.add(ground);
  const grid=new THREE.GridHelper(140,70,'#203541','#172c39');grid.position.y=-.158;grid.material.transparent=true;grid.material.opacity=.24;grid.userData.takBisaDiatur=true;scene.add(grid);
  controls.addEventListener('start',()=>{interacting=true;tween=null;if(state.mode==='cinema')setMode('orbit',false);});controls.addEventListener('end',()=>{interacting=false;});
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  let start={x:0,y:0};renderer.domElement.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};});renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||e.ctrlKey||e.metaKey||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5||!state.loaded)return;pick(e);});
  /* Menu peramban selalu ditahan supaya klik kanan bisa dipakai
     ruangan; panelnya sendiri hanya terbit kalau tetikus tidak
     bergeser — geser kanan tetap menggeser kamera seperti biasa. */
  renderer.domElement.addEventListener('contextmenu',e=>{e.preventDefault();
    if(!state.loaded||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;pickKanan(e);});
}
function overviewPosition(){const mobile=Math.max(1,1.1/(innerWidth/innerHeight));return V(15,14.5,20).multiplyScalar(mobile);}

function box(size,position,color,metalness=.2){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.5,metalness}));m.position.set(...position);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
/* Kaca arsitektur. Tembok pakai kadar buram sedikit lebih tinggi supaya
   bidangnya masih terbaca sebagai dinding, bukan lubang. */
function kaca(nama,opacity,warna){return new THREE.MeshStandardMaterial({name:nama,color:warna,
  transparent:true,opacity,metalness:.16,roughness:.1,depthWrite:false,side:THREE.DoubleSide});}
// 'doorline' adalah daun pintunya (ochre), 'door' rangka di sekelilingnya.
const KACA_TEMBOK=['wall'],KACA_PINTU=['doorline','door'];
function loadOffice(gltf){office=gltf.scene;scene.add(office);office.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;/* Lantai tidak perlu menaungi apa pun dan justru jadi sumber jerawat
     bayangan kalau ikut menyorot dirinya sendiri. */
  if(o.userData.category==='FLOOR')o.castShadow=false;if(o.userData.category==='WALL')o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();const mats=Array.isArray(o.material)?o.material:[o.material];for(let i=0;i<mats.length;i++){let m=mats[i];if(!m)continue;m.envMapIntensity=.6;if(o.userData.category==='GLASS'||m.name.toLowerCase().includes('glass')&&m.transmission>0){const glass=new THREE.MeshStandardMaterial({name:'Architectural glass',color:'#b7d8dd',transparent:true,opacity:.12,metalness:.15,roughness:.25,depthWrite:false,side:THREE.DoubleSide});if(Array.isArray(o.material))o.material[i]=glass;else o.material=glass;o.castShadow=false;o.renderOrder=3;}if(KACA_TEMBOK.includes(m.name)){const g=kaca('Kaca dinding',.17,'#cddfe4');g.userData.baseOpacity=.17;if(Array.isArray(o.material))o.material[i]=g;else o.material=g;o.castShadow=false;o.renderOrder=2;continue;}if(KACA_PINTU.includes(m.name)){const g=kaca('Kaca pintu',.3,'#bcd6dd');g.userData.baseOpacity=.3;if(Array.isArray(o.material))o.material[i]=g;else o.material=g;o.castShadow=false;o.renderOrder=2;continue;}if(o.userData.category==='WALL'){m.transparent=true;m.userData.baseOpacity=1;o.castShadow=false;}}if(o.userData.category==='WALL')wallMeshes.push(o);});}

function chart(ctx,x,y,w,h,seed,time,small=false,koin=null,tf=HIDUP.TF_BAWAAN){
  const data=(koin&&HIDUP.deret(koin,tf,48))||marketSeries(seed,48,time);
  /* ── BANTALAN SEBANDING, BUKAN ANGKA MATI ─────────────────────────────
     Dulu `-.4` dan `+.4`. Itu cocok untuk deret sintetis yang selalu
     berkisar di 100; untuk harga sungguhan ia meratakan grafiknya. Rentang
     DOGE satu jam 0,00054 — ±0,4 membuat seluruh gerakan menempati 0% tinggi
     kanvas. Sekarang bantalannya sepersepuluh rentangnya sendiri, jadi koin
     seharga 78.000 dan koin seharga 0,08 sama terbacanya.

     Dua cadangan berurutan untuk pasar yang benar-benar diam: sepermil
     harga, lalu 0,4 kalau harganya pun nol. Rentang nol berarti pembagian
     nol di `cy()`, dan yang tergambar sesudah itu bukan grafik melainkan
     kanvas kosong. */
  let lo=Math.min(...data.map(p=>p.low)),hi=Math.max(...data.map(p=>p.high));
  const bantal=(hi-lo)*.09||Math.abs(hi)*.001||.4;
  lo-=bantal;hi+=bantal;
  const cy=v=>y+h-(v-lo)/(hi-lo)*h;
  /* Lajur kanan disisihkan untuk angka harga. Menumpuknya di atas lilin
     berarti angka yang tertimpa batang, dan angka harga yang setengah
     terbaca lebih buruk daripada tidak ada. */
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
  /* Angka harga di tiap garis kisi. Yang paling atas digeser turun dan yang
     paling bawah digeser naik supaya keduanya tidak terpotong tepi kanvas. */
  ctx.fillStyle='#6b8797';ctx.font=`${small?11:13}px ui-monospace,monospace`;ctx.textAlign='right';
  for(let i=0;i<=4;i++){
    const v=hi-(hi-lo)*i/4,yy=y+i*h/4+(i===0?10:i===4?-3:4);
    ctx.fillText(HIDUP.angka(v),x+w-3,yy);
  }
  ctx.textAlign='left';
  /* Harga terakhir ditandai di lajur yang sama — mata mencari "sekarang di
     mana" lebih dulu daripada mencari batas atas dan bawah. */
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
  const hidup=HIDUP.kabar.pasarHidup,pct=u=>u===null?'--':(u>=0?'+':'\u2212')+Math.abs(u).toFixed(2)+'%',warna=u=>u===null?'#89a0b0':u>=0?'#78d6b2':'#df8e85';
  if(kind==='wall'){
    ctx.fillStyle='#e0eaf0';ctx.font='600 30px sans-serif';ctx.fillText('GLOBAL MARKETS',38,47);
    ctx.fillStyle='#89a0b0';ctx.font='16px monospace';ctx.fillText('PERPETUAL 1m  /  HYPERLIQUID  /  SATU JAM TERAKHIR',38,80);
    ctx.fillStyle=hidup?'#8ddbba':'#e6ae65';ctx.fillText(hidup?'DATA LANGSUNG  \u2022  '+HIDUP.jam():'SIMULASI  \u2022  RESEARCH FLOOR',w-400,48);
    ctx.fillStyle='#18313d';ctx.fillRect(36,105,w-72,1);
    HIDUP.TRIO.forEach((koin,i)=>{const x=38+i*(w-55)/3,cw=(w-120)/3,u=HIDUP.ubah(koin);
      ctx.fillStyle='#b8ced9';ctx.font='19px monospace';ctx.fillText(koin+' / USD',x,149);
      ctx.fillStyle='#f0f6f8';ctx.font='500 35px sans-serif';ctx.fillText(HIDUP.angka(HIDUP.harga(koin)),x,194);
      ctx.fillStyle=warna(u);ctx.font='17px monospace';ctx.fillText(pct(u),x+cw-92,147);
      chart(ctx,x,222,cw-20,h-320,2+i*3.4,time,false,koin);});
    ctx.fillStyle='#819bab';ctx.font='14px monospace';ctx.fillText('MULTI-ASSET RESEARCH     |     RISK FIRST     |     DESK ONLINE',38,h-21);
  }else if(kind==='ticker'){
    ctx.fillStyle='#93aebb';ctx.font='600 26px monospace';ctx.fillText('HYPERLIQUID  /',30,61);
    HIDUP.TRIO.forEach((koin,i)=>{const u=HIDUP.ubah(koin);ctx.fillStyle=warna(u);
      ctx.fillText(koin+'  '+HIDUP.angka(HIDUP.harga(koin))+'   '+pct(u),300+i*400,61);});
  }else{
    const koin=koinLayar||'BTC',harga=HIDUP.harga(koin,tf),u=HIDUP.ubah(koin,tf);
    ctx.fillStyle='#d6e5ed';ctx.font='600 29px sans-serif';ctx.fillText(koin+' / USD',24,42);
    ctx.fillStyle='#89a6b6';ctx.font='15px monospace';ctx.fillText('PERPETUAL / '+tf+' \u00b7 HYPERLIQUID',24,68);
    ctx.fillStyle=warna(u);ctx.font='22px monospace';ctx.fillText(HIDUP.angka(harga),w-250,44);
    ctx.font='13px monospace';ctx.fillText(pct(u),w-250,68);
    ctx.globalAlpha=hidup?.35+.65*Math.abs(Math.sin(time*2.2)):.22;ctx.fillStyle=hidup?'#8ddbba':'#708d9e';
    ctx.beginPath();ctx.arc(w-42,38,7,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle='#708d9e';ctx.font='12px monospace';ctx.fillText(hidup?HIDUP.jam():'SIMULASI',w-104,71);
    chart(ctx,24,105,w*.73,h-190,2,time,true,koin,tf);
    ctx.fillStyle='#102630';ctx.fillRect(w*.79,92,1,h-120);ctx.font='12px monospace';ctx.fillStyle='#91aab8';ctx.fillText('ORDER BOOK',w*.82,110);
    /* Tangga harga SEBANDING, dan lantai 0,01 dibuang. Kesalahan yang sama
       dengan bantalan grafik: 0,01 per baris masuk akal untuk koin seharga
       ratusan, tapi untuk DOGE seharga 0,0858 ia berarti 12% per baris —
       order book yang membentang dari 0,0158 sampai 0,1558. */
    const poros=harga||100.12,tick=poros*.0006;
    const des=poros>=1000?1:poros>=10?3:poros>=1?4:6;
    for(let i=0;i<15;i++){ctx.fillStyle=i<7?'#db8f8a':'#82cab0';
      ctx.fillText((poros+(7-i)*tick).toFixed(des),w*.82,137+i*19);
      ctx.globalAlpha=.12;ctx.fillRect(w*.82,124+i*19,35+Math.abs(Math.sin(i*2.4+time*.6))*70,15);ctx.globalAlpha=1;}
    ctx.fillStyle='#8dabbb';ctx.font='13px monospace';ctx.fillText('RESEARCH   /   POSITIONS   /   JOURNAL',24,h-20);
  }
}
/* Satu kanvas per PANGGILAN, bukan per jenis. Dulu jenisnya yang jadi
   kunci dan lima tekstur dibagikan ke semua layar — itulah sebabnya
   selusin monitor menggambar tiga grafik yang sama. */
function marketTexture(kind,koin=null,tf=HIDUP.TF_BAWAAN){const c=document.createElement('canvas');c.width=kind==='wall'?1536:kind==='ticker'?1536:768;c.height=kind==='wall'?640:kind==='ticker'?96:512;
  if(koin)HIDUP.langgan(koin,tf);paintTerminal(c,kind,0,koin,tf);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  /* REKAMNYA yang dipulangkan, bukan teksturnya: planenya perlu menunjuk
     balik ke sini supaya klik kanan tahu layar mana yang sedang diatur. */
  const rek={canvas:c,texture:tex,kind,koin,tf};screens.push(rek);return rek;}
function screenMaterial(texture){return new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide});}
function setupMarkets(){
  /* Antrean koin, diambil satu per satu. Habis daftarnya baru berputar
     dari awal — dengan empat belas koin untuk dua belas monitor itu
     tidak pernah terjadi, tapi ruangan yang nanti ditambah layarnya
     tidak boleh mati karena kehabisan nama. */
  let antre=0;
  const koinBerikut=()=>HIDUP.KOIN_LAYAR[antre++%HIDUP.KOIN_LAYAR.length];
  /* Dinding & pita memakai TRIO, dan langganannya didaftarkan di sini
     karena keduanya tidak lewat jalur koin per layar. */
  for(const k of HIDUP.TRIO)HIDUP.langgan(k,HIDUP.TF_BAWAAN);
  const dindingPasar=marketTexture('wall').texture,pitaHarga=marketTexture('ticker').texture;
  for(const s of layout.screens){const kind=s.art?'wall':'terminal';const rek=s.art?null:marketTexture('terminal',koinBerikut());const plane=new THREE.Mesh(new THREE.PlaneGeometry(...s.size),screenMaterial(s.art?dindingPasar:rek.texture));if(rek)plane.userData.layar=rek;plane.position.fromArray(s.position);plane.quaternion.fromArray(s.quaternion);plane.position.add(V(0,0,.013).applyQuaternion(plane.quaternion));plane.name=s.art?'Dinding pasar':('Layar '+(rek?rek.koin:''));plane.userData.focus={label:s.art?'Market wall':'Trading desk',point:plane.position.clone(),distance:s.art?5.1:3};scene.add(plane);pickTargets.push(plane);}
  const art=layout.screens.find(s=>s.art);if(art){const p=new THREE.Mesh(new THREE.PlaneGeometry(5.3,.33),screenMaterial(pitaHarga));p.position.copy(V().fromArray(art.position));p.position.y=2.88;p.quaternion.fromArray(art.quaternion);p.position.add(V(0,0,.045).applyQuaternion(p.quaternion));scene.add(p);}
  // Enam terminal analis di meja oak — satu untuk tiap kursi teal, jadi
  // meja panjang ini yang jadi ruang trading analis, bukan ruang rapat.
  MEJA_ANALIS.forEach((m,i)=>{const x=m.x,z=m.sisi>0?.17:-.15,hadap=m.sisi>0?0:Math.PI;
    box([.065,.31,.065],[x,1.01,z],'#26353e',.6);box([.91,.57,.045],[x,1.29,z],'#18242b',.4);
    const rek=marketTexture('terminal',koinBerikut());
    const p=new THREE.Mesh(new THREE.PlaneGeometry(.85,.51),screenMaterial(rek.texture));
    p.userData.layar=rek;
    p.position.set(x,1.29,z+(m.sisi>0?.025:-.025));p.rotation.y=hadap;p.name='Layar analis '+rek.koin;scene.add(p);
    p.userData.focus={label:'Ruang trading analis',point:V(x,1.1,z),distance:4.2};pickTargets.push(p);
    box([.42,.022,.26],[x,.885,z+(m.sisi>0?.11:-.11)],'#20313b',.35);});
  // Small area lights reflect the new market panels onto the room.
  const marketGlow=new THREE.PointLight('#7abdbd',13,6,2);marketGlow.position.set(6.5,2.1,0);scene.add(marketGlow);
  for(const z of [-1,4]){const l=new THREE.PointLight('#aad6ff',2.5,3,2);l.position.set(1,1.5,z);scene.add(l);}
  const hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
  for(const s of [{p:[1.63,.94,-.82],size:[2.15,.18,1.3],label:'Central trading desk',d:4.3},{p:[-2.79,.88,.015],size:[4.1,.15,1.12],label:'Forex research desk',d:5},{p:[.49,1.065,4.26],size:[4.05,.15,.88],label:'Crypto desk',d:5},{p:[3.22,.88,-6],size:[2,.15,2],label:'Ruang rapat',d:4.6}]){const hit=new THREE.Mesh(new THREE.BoxGeometry(...s.size),hitMaterial);hit.position.fromArray(s.p);hit.userData.focus={label:s.label,point:hit.position.clone(),distance:s.d};scene.add(hit);pickTargets.push(hit);}
}

/* ── Ruang trading analis ────────────────────────────────────────────────
   Meja oak panjang punya enam kursi teal; itulah ruang trading analis di
   ruangan ini. Robot yang dompetnya masih memegang posisi menempati salah
   satu kursi dan tidak beranjak, sisanya berkeliling menikmati ruangan. */
const MEJA_ANALIS=[{x:-3.86,sisi:-1},{x:-2.81,sisi:-1},{x:-1.76,sisi:-1},{x:-3.86,sisi:1},{x:-2.81,sisi:1},{x:-1.76,sisi:1}];
MEJA_ANALIS.forEach((m,i)=>{stations['analis'+i]={label:'Ruang trading analis',activity:'Menjaga sinyal berjalan',kind:'type',
  position:[m.x,m.sisi>0?1.04:-1],look:[m.x,m.sisi>0?.1:-.06],
  tempat:[m.x,m.sisi>0?.95:-.87],dudukY:.496,duration:900,duduk:true};});
/* Kursi santai. Robot yang dompetnya belum punya posisi menunggu harga di
   sini: benar-benar duduk, bukan berdiri mematung. */
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
const SANTAI=['sofa','bistro','sofa2','teras','pohon','lounge'];

/* ── DUDUK ────────────────────────────────────────────────────────────
   Rig ini tidak punya klip duduk, jadi pahanya ditekuk sesudah mixer
   menulis pose tiap frame.

   Sumbu diukur, bukan ditebak: sumbu +Y lokal tiap tulang berjalan
   SEPANJANG tulang dan menunjuk ke BAWAH di pose istirahat. Memutar −90°
   pada sumbu X lokal membawanya dari "ke bawah" ke "ke depan"; itulah paha
   yang mendatar. Betisnya diputar balik +72° supaya menggantung.

   Kakinya memang tidak menyentuh lantai, dan itu benar: kursi kantor di
   model ini tingginya 0,50 m sementara seluruh kaki robotnya cuma 0,54 m.
   Robot sekecil ini di kursi sebesar itu memang duduk dengan kaki
   menggantung — memaksanya menapak berarti kakinya harus lurus, dan yang
   lurus itu namanya berdiri. */
const DUDUK={
  /* ARAH, bukan sudut tambahan. Menambah sudut di atas pose animasi tidak
     bisa diandalkan: klip 05_Typing sendiri sudah menekuk kaki sedikit,
     jadi "putar −80°" mendarat di tempat yang berbeda dari yang dihitung
     di atas kertas — terukur meleset 20°. Menunjuk arah dunia menghasilkan
     pose yang sama berapa pun sumbangan klipnya.

     Paha hampir mendatar ke depan, betis menggantung sedikit condong. */
  pahaTurun:.15, betisMaju:.2,
  /* Jarak dari telapak ke pangkal paha, diukur dari modelnya sendiri saat
     robot pertama dibangun. Tidak ditulis tetap: mengganti model berarti
     angka tetap itu diam-diam salah. */
  pangkalPaha:.59,
  /* Pinggul duduk sedikit DI ATAS bidang dudukan, bukan tepat di garisnya:
     tepat di garis membuat badannya terlihat separuh tenggelam. */
  bantal:.035};

/* Mengarahkan satu tulang ke arah DUNIA tertentu. Sumbu +Y lokal tiap
   tulang di rig ini berjalan sepanjang tulang (terukur: sumbu Y paha
   menunjuk lurus ke bawah di pose istirahat).

   `bobot` memungkinkan peralihan halus: 0 = pose animasi apa adanya,
   1 = persis menghadap arah yang diminta. */
/* ── MENGUKUR KURSI YANG SESUNGGUHNYA ─────────────────────────────────
   Titik duduk, tinggi dudukan, dan arah hadap tidak lagi ditulis tangan.
   Angka tangan hanya benar untuk satu perabot di satu tempat; begitu
   kursinya digeser, diganti, atau ditambah, angkanya diam-diam salah — dan
   itu yang terlihat sebagai robot duduk menyerong dan setengah menembus.

   Yang dikerjakan sekali saat muat:
     · sinar ke bawah pada petak kecil → bidang dudukan, tengahnya, tingginya
     · sinar mendatar setinggi pinggang → sandaran & lengan kursi

   Robot lalu menghadap MENJAUHI sandaran, persis yang orang lakukan saat
   duduk. Kalau petaknya tidak menemukan bidang yang masuk akal, angka
   bawaan stasiunnya dibiarkan — mengukur yang gagal tidak boleh lebih
   buruk daripada tidak mengukur. */
function ukurKursi(st){
  if(!st.tempat)return;
  const rc=new THREE.Raycaster();
  const [tx,tz]=st.tempat;
  const kena=[];
  for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){
    const x=tx+i*.09,z=tz+j*.09;
    rc.set(V(x,2.4,z),V(0,-1,0));
    /* SELURUH tumpukan sinar, bukan yang teratas saja. Di atas kursi bisa
       ada monitor, daun, atau lampu; kalau cuma benda pertama yang dilihat,
       dudukannya tidak pernah ketemu dan kursinya dikira bukan kursi —
       itulah sebabnya tujuh dari sebelas kursi luput di percobaan pertama. */
    const tumpuk=rc.intersectObject(office,true);
    const h=tumpuk.find(t=>t.point.y>.30&&t.point.y<.72);
    if(h)kena.push({x,z,y:h.point.y});
  }
  if(kena.length<6)return;
  /* Bidang PALING LUAS, bukan yang tertinggi.
     ──────────────────────────────────────────────────────────────────
     Mengambil yang tertinggi terlihat masuk akal dan salah: di kursi
     kantor, titik tertinggi dalam petak ini adalah tepi atas SANDARAN
     (0,71 m), bukan dudukannya (0,50 m) — robotnya akan didudukkan di
     punggung kursi. Dudukan selalu bidang mendatar terlebar di sekitar
     situ, jadi yang dicari modusnya: tinggi dibulatkan ke laci 2 cm,
     laci dengan penghuni terbanyak yang menang. */
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
  /* Setinggi punggung bawah, bukan pinggang: tepi atas sandaran kursi
     kantor ada di 0,71 m, dan sinar setinggi itu lewat persis di atasnya. */
  const asal=V(st.tempat[0],st.dudukY+.15,st.tempat[1]);
  let sx=0,sz=0;
  rc.far=.5;
  for(let a=0;a<16;a++){
    const t=a/16*Math.PI*2,dx=Math.sin(t),dz=Math.cos(t);
    rc.set(asal,V(dx,0,dz));
    const h=rc.intersectObject(office,true)[0];
    /* Yang dekat menekan lebih kuat: sandaran menempel, tanaman di
       seberang ruangan tidak boleh ikut memutar badannya. */
    if(h){const b=1-h.distance/.5;sx+=dx*b;sz+=dz*b;}
  }
  rc.far=Infinity;
  if(Math.hypot(sx,sz)>.35)st.hadap=Math.atan2(-sx,-sz);
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

/* Kursi kerja, berurutan. Enam kursi teal di meja oak lebih dulu — itu
   ruang trading analisnya — lalu meja-meja lain kalau yang sedang memegang
   sinyal lebih dari enam. Berurutan, bukan lewat sisa bagi indeks, supaya
   dua robot tidak pernah dikirim ke kursi yang sama. */
const KURSI=['analis0','analis1','analis2','analis3','analis4','analis5','futures','crypto','market'];

function bagiKursi(analis){
  let kursi=0;
  return analis.map((a,i)=>{
    const sibuk=a.sinyal.length>0;
    return {sibuk,rute:sibuk?[KURSI[kursi++%KURSI.length]]
      :[SANTAI[i%6],SANTAI[(i+2)%6],SANTAI[(i+4)%6],SANTAI[(i+5)%6]]};
  });
}

/* Namanya jumlah cuannya, bukan ROBO-0x — itu yang diminta pemilik: satu
   pandang ke ruangan sudah memberi tahu siapa yang sedang menghasilkan. */
function pemainDariAnalis(a,i,bagi){
  return {name:HIDUP.uang(a.pnl),role:a.nama,route:bagi[i].rute,
          offset:i*3.2,analis:a,punya:bagi[i].sibuk};
}

/* Papan ditarik ulang tiap menit. Yang penting bukan angkanya saja: analis
   yang sinyal terakhirnya baru ditutup harus berdiri dari kursinya, dan
   yang baru memposting harus duduk. */
async function segarkanAnalis(){
  if(!npcs.length)return;
  let analis;
  try{analis=await HIDUP.daftarAnalis();}catch(e){HIDUP.kabar.kartuGalat=e.message;return;}
  HIDUP.kabar.kartuGalat=null;
  if(analis.length!==npcs.length)return;   // jumlahnya berubah: tunggu muat ulang
  const bagi=bagiKursi(analis);
  analis.forEach((a,i)=>{
    const n=npcs[i],p=n.profile;
    p.analis=a;p.name=HIDUP.uang(a.pnl);p.role=a.nama;
    n.label.textContent=p.name;
    if(bagi[i].sibuk!==p.punya){
      p.punya=bagi[i].sibuk;p.route=bagi[i].rute;n.routeIndex=-1;n.depart();
    }
  });
  updateUI();
}

/* Kegagalan DICATAT, bukan ditelan. Ruangan yang diam-diam jatuh ke tiga
   robot demo terlihat persis seperti ruangan yang bekerja, dan sebabnya
   baru ketahuan sesudah dilihat berhari-hari. */
async function susunPemain(){
  const bawaan=roster.map(r=>({...r,analis:null,punya:false}));
  try{
    const analis=await HIDUP.daftarAnalis();
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
  /* Lebih dari enam robot: chip dibungkus, bukan dipaksa satu baris. */
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
      (sebab?'<br><span class="dompet-sebab">Sebab: '+esc(sebab)+'</span>':'')+'</p>';
    return;
  }
  const kelas=a.pnl>0?'naik':a.pnl<0?'turun':'diam';
  /* Tiga kolom, bukan empat: pasar sudah tersirat di nama pasangannya, dan
     kolom keempat itulah yang mendorong panel melebar sampai terpotong. */
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
    (sinyal?'<ul class="dompet-posisi">'+sinyal+'</ul>'
           :'<p class="dompet-mati">Tidak ada sinyal berjalan — analis ini sedang menunggu peluang.</p>');
}

/* ── PANEL MELAYANG: DATA ANALIS & PENGATUR MONITOR ─────────────────────
   Satu panel untuk dua isi, bentuknya meminjam "Robot terpilih" di sisi
   kanan (pemilik, 10 Sep 2026). Kartu 3D melayang yang dipakai sebelumnya
   dilepas: ia menghadap kamera dan tidak bisa digulir, sementara yang
   dibutuhkan di sini daftar tujuh belas koin yang bisa diklik satu per satu.

   DOM, bukan objek 3D — daftar bergulir dan tombol sudah gratis di HTML,
   dan panel sisi ruangan ini memang sudah HTML sejak awal. */
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
  /* Ditahan di dalam jendela: klik kanan di tepi kanan atau bawah tidak
     boleh menerbitkan panel yang separuhnya di luar layar. */
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
      (sebab?'<br><span class="dompet-sebab">Sebab: '+esc(sebab)+'</span>':'')+'</p>';
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

/* Satu pendengar untuk seluruh isi panel: tombolnya digambar ulang tiap kali
   pilihan berubah, jadi pendengar yang dipasang per tombol akan ikut hilang
   dan harus dipasang lagi setiap kali. */
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
  /* Didaftarkan DAN digambar seketika. Lilin barunya mungkin baru sampai
     sedetik kemudian; sampai saat itu layarnya menggambar apa adanya, bukan
     membeku di koin yang sudah tidak dipilih lagi. */
  HIDUP.langgan(rek.koin,rek.tf);
  paintTerminal(rek.canvas,rek.kind,state.time,rek.koin,rek.tf);
  rek.texture.needsUpdate=true;
  popupLayar(rek,popup.x,popup.y);
});

/* Klik kanan: robot \u2192 datanya, monitor \u2192 pengaturnya, selain itu tutup. */
function pickKanan(e){
  pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(pickTargets,true)[0];
  let o=hit&&hit.object;
  while(o){
    if(o.userData.npc){popupRobot(o.userData.npc,e.clientX,e.clientY);return;}
    if(o.userData.layar){popupLayar(o.userData.layar,e.clientX,e.clientY);return;}
    o=o.parent;
  }
  tutupPopup();
}

/* ── MEMBELAH MESH GABUNGAN JADI PERABOT ────────────────────────────────
   `office.glb` digabung per material sejak diekspor: seluruh kursi teal satu
   mesh, seluruh daun satu mesh. Supaya satu kursi bisa diseret sendiri, mesh
   itu dibelah saat PERTAMA KALI disentuh Ctrl+klik.

   Tiga langkah:
   1. Verteks dilas menurut posisi. Tanpa ini satu kursi pecah jadi belasan
      keping, karena jahitan UV memisahkan verteks yang sebenarnya berimpit.
   2. Union-find atas segitiga → pulau-pulau yang benar-benar menyatu.
   3. Tiap pulau dijodohkan ke ANCHOR TERDEKAT. Anchor itulah daftar perabot
      yang sesungguhnya (71 nama di office-layout.json), dan itu yang membuat
      "sandaran + dudukan + kaki + roda" berkumpul jadi satu kursi alih-alih
      empat kepingan lepas.

   Atribut buffer DIPAKAI BERSAMA; yang berbeda cuma indeksnya. Menyalin
   posisi/normal/uv tiap kelompok berarti melipatgandakan memori untuk data
   yang isinya sama persis. Tiap kelompok dibungkus Group yang duduk di
   pusatnya sendiri supaya perputarannya berporos di badannya, bukan di titik
   asal ruangan. */
const sudahBelah = {siap: false};

function anchorTerdekat(x, z, batas) {
  const a = layout && layout.anchors;
  if (!a) return null;
  let nama = null, jarak = batas;
  for (const [n, v] of Object.entries(a)) {
    if (!v || !v.position) continue;
    const d = Math.hypot(v.position[0] - x, v.position[2] - z);
    if (d < jarak) { jarak = d; nama = n; }
  }
  return nama;
}

/** Pulau-pulau satu mesh, sudah dijodohkan ke anchor. Map<nama, [indeks]>. */
function pulauPerAnchor(mesh) {
  const geo = mesh.geometry, pos = geo.attributes.position;
  if (!geo.index || !pos) return null;
  const n = pos.count, arr = geo.index.array;
  /* 1. Las menurut posisi, dibulatkan ke milimeter. Tanpa ini satu kursi
        pecah jadi belasan keping: jahitan UV memisahkan verteks yang
        sebenarnya berimpit. */
  const peta = new Map(), wakil = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.round(pos.getX(i) * 1000) + ',' + Math.round(pos.getY(i) * 1000)
      + ',' + Math.round(pos.getZ(i) * 1000);
    const ada = peta.get(k);
    if (ada === undefined) { peta.set(k, i); wakil[i] = i; } else wakil[i] = ada;
  }
  /* 2. Union-find atas segitiga → pulau yang benar-benar menyatu. */
  const induk = new Int32Array(n);
  for (let i = 0; i < n; i++) induk[i] = i;
  const cari = (a) => { while (induk[a] !== a) { induk[a] = induk[induk[a]]; a = induk[a]; } return a; };
  const gabung = (a, b) => { a = cari(a); b = cari(b); if (a !== b) induk[b] = a; };
  for (let t = 0; t < arr.length; t += 3) {
    const a = wakil[arr[t]], b = wakil[arr[t + 1]], c = wakil[arr[t + 2]];
    gabung(a, b); gabung(b, c);
  }
  const pulau = new Map();
  for (let t = 0; t < arr.length; t += 3) {
    const r = cari(wakil[arr[t]]);
    let g = pulau.get(r);
    if (!g) { g = {tri: [], sx: 0, sz: 0, jml: 0}; pulau.set(r, g); }
    g.tri.push(arr[t], arr[t + 1], arr[t + 2]);
    g.sx += pos.getX(arr[t]); g.sz += pos.getZ(arr[t]); g.jml++;
  }
  /* 3. Tiap pulau ke anchor terdekat. Anchor office-layout.json ITULAH
        daftar perabot yang sesungguhnya — 71 nama — dan itu yang
        menyatukan sandaran, dudukan, kaki, dan roda jadi satu kursi. */
  const kelompok = new Map();
  for (const g of pulau.values()) {
    const nama = anchorTerdekat(g.sx / g.jml, g.sz / g.jml, 1.4) || ('Sisa ' + mesh.name);
    let k = kelompok.get(nama);
    if (!k) { k = []; kelompok.set(nama, k); }
    for (const v of g.tri) k.push(v);
  }
  return kelompok;
}

/* ── SEMUA MESH SEKALIGUS ────────────────────────────────────────────────
   Satu perabot terbuat dari beberapa MATERIAL — kursi kantor itu dudukan
   oranye + kaki hitam + tiang krom — dan tiap material hidup di mesh
   gabungan yang berbeda. Membelah satu mesh saja berarti yang terpilih cuma
   bagian sematerial dengan titik yang diklik, dan kursinya terseret
   sebagian. Karena itu seluruh `STATIC__*` dibelah bersamaan, lalu pulau
   dari mesh mana pun yang jatuh ke anchor yang sama dikumpulkan jadi satu
   Group.

   Dikerjakan sekali, saat Ctrl+klik pertama: menjalankannya waktu memuat
   berarti menunggu tanpa alasan bagi orang yang cuma mau melihat ruangan. */
function siapkanPerabot() {
  if (sudahBelah.siap) return;
  sudahBelah.siap = true;
  const asli = [];
  office.traverse((o) => { if (o.isMesh && /^STATIC__/.test(o.name || '')) asli.push(o); });
  const perAnchor = new Map();
  for (const m of asli) {
    const kel = pulauPerAnchor(m);
    if (!kel) continue;
    for (const [nama, tri] of kel) {
      let g = perAnchor.get(nama);
      if (!g) { g = []; perAnchor.set(nama, g); }
      g.push({mesh: m, tri});
    }
  }
  const wadah = new THREE.Group();
  wadah.name = 'perabot';
  wadah.userData.hasilBelah = true;
  for (const [nama, bagian] of perAnchor) {
    /* Batas GABUNGAN semua bagian: porosnya harus di tengah kursi utuh,
       bukan di tengah dudukannya saja. */
    let nx = Infinity, ny = Infinity, nz = Infinity, xx = -Infinity, xy = -Infinity, xz = -Infinity;
    for (const b of bagian) {
      const pos = b.mesh.geometry.attributes.position;
      for (const i of b.tri) {
        const X = pos.getX(i), Y = pos.getY(i), Z = pos.getZ(i);
        if (X < nx) nx = X; if (X > xx) xx = X;
        if (Y < ny) ny = Y; if (Y > xy) xy = Y;
        if (Z < nz) nz = Z; if (Z > xz) xz = Z;
      }
    }
    const pusat = new THREE.Vector3((nx + xx) / 2, (ny + xy) / 2, (nz + xz) / 2);
    const grup = new THREE.Group();
    grup.name = nama;
    grup.position.copy(pusat);
    for (const b of bagian) {
      const geo = b.mesh.geometry, pos = geo.attributes.position;
      const sub = new THREE.BufferGeometry();
      for (const k of Object.keys(geo.attributes)) sub.setAttribute(k, geo.attributes[k]);
      sub.setIndex(b.tri);
      /* Batas dihitung TANGAN dari daftar indeks. `computeBoundingBox()`
         menelusuri seluruh atribut dan mengabaikan indeks — karena
         atributnya dipakai bersama, tiap bagian akan memulangkan kotak
         seluruh mesh gabungannya. */
      let a1 = Infinity, b1 = Infinity, c1 = Infinity, a2 = -Infinity, b2 = -Infinity, c2 = -Infinity;
      for (const i of b.tri) {
        const X = pos.getX(i), Y = pos.getY(i), Z = pos.getZ(i);
        if (X < a1) a1 = X; if (X > a2) a2 = X;
        if (Y < b1) b1 = Y; if (Y > b2) b2 = Y;
        if (Z < c1) c1 = Z; if (Z > c2) c2 = Z;
      }
      sub.boundingBox = new THREE.Box3(new THREE.Vector3(a1, b1, c1), new THREE.Vector3(a2, b2, c2));
      sub.boundingSphere = new THREE.Sphere(
        new THREE.Vector3((a1 + a2) / 2, (b1 + b2) / 2, (c1 + c2) / 2),
        .5 * Math.hypot(a2 - a1, b2 - b1, c2 - c1));
      const m2 = new THREE.Mesh(sub, b.mesh.material);
      m2.position.copy(pusat).negate();
      m2.castShadow = b.mesh.castShadow;
      m2.receiveShadow = b.mesh.receiveShadow;
      m2.userData.category = b.mesh.userData.category;
      grup.add(m2);
    }
    wadah.add(grup);
  }
  for (const m of asli) { m.visible = false; m.userData.takBisaDiatur = true; }
  office.add(wadah);
  return perAnchor.size;
}

/* ── RIWAYAT UBAHAN ─────────────────────────────────────────────────────
   Ctrl+Z mengembalikan satu langkah. Dicatat SEBELUM tiap perubahan, bukan
   sesudah — yang perlu disimpan keadaan lama, dan sesudah berubah keadaan
   itu sudah tidak ada lagi di mana pun. Lima puluh langkah cukup untuk
   menata satu ruangan dan tidak menahan memori apa pun yang berarti. */
const riwayat = [];
function catatLangkah(o) {
  if (!o) return;
  riwayat.push({o, p: o.position.clone(), r: o.rotation.clone()});
  if (riwayat.length > 50) riwayat.shift();
}
function urungLangkah() {
  const l = riwayat.pop();
  if (!l) { toast('Tidak ada lagi yang bisa diurungkan.'); return; }
  l.o.position.copy(l.p); l.o.rotation.copy(l.r);
  if (atur.objek === l.o && atur.kotak) { atur.kotak.update(); hudAtur(); }
  toast('Satu langkah diurungkan.');
}
/* Semua yang pernah disentuh dikembalikan sekaligus. `aturAwal` dicatat saat
   objek pertama kali dipilih, jadi daftar ini persis berisi yang berubah. */
function kembalikanSemua() {
  let jml = 0;
  scene.traverse((o) => {
    const a = o.userData.aturAwal;
    if (!a) return;
    if (!o.position.equals(a.p) || o.rotation.x !== a.r.x || o.rotation.y !== a.r.y || o.rotation.z !== a.r.z) jml++;
    o.position.copy(a.p); o.rotation.copy(a.r);
  });
  riwayat.length = 0;
  if (atur.kotak) { atur.kotak.update(); hudAtur(); }
  toast(jml ? jml + ' objek dikembalikan ke tempat semula.' : 'Semuanya sudah di tempat semula.');
}

/* ── MODE ATUR OBJEK ────────────────────────────────────────────────────
   Ctrl+klik memilih apa pun yang kena sinar; sesudah terpilih ia bisa
   digeser (Ctrl+seret) dan diputar (Q/E). Diminta pemilik 10 Sep 2026 untuk
   menata ruangan sendiri.

   ── BATASNYA ─────────────────────────────────────────────────────────
   `office.glb` digabung PER MATERIAL: seluruh kursi teal adalah satu mesh
   `STATIC__teal`, seluruh tanaman satu mesh, dan seterusnya. Memilih satu
   kursi berarti memilih semuanya. Itu bukan sesuatu yang bisa diperbaiki di
   sini — geometrinya memang sudah menyatu sejak diekspor — jadi panelnya
   MENYEBUTKANNYA, dan sekalian menyebut nama perabot terdekat dari titik
   yang diklik supaya masih ada cara menunjuk benda yang dimaksud.

   Robot dan benda buatan kode ini (monitor, kaki, papan ketik) berdiri
   sendiri-sendiri dan bisa dipindah satu per satu. */
const atur = {objek:null, kotak:null, seret:false, bidang:null, genggam:new THREE.Vector3(),
  layarY:0, awalY:0};

function namaObjek(o){
  if(o.userData.npc)return o.userData.npc.profile.role||o.userData.npc.profile.name;
  return o.name||o.type;
}

/* Perabot terdekat dari satu titik, dibaca dari anchor office-layout.json.
   Satu-satunya cara menyebut "kursi teal yang mana" saat mesh-nya gabungan. */
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
  const putar=Math.round(o.rotation.y*180/Math.PI);
  el.innerHTML='<div class="npc-title"><span class="eyebrow">Mode atur</span>'+
    '<button type="button" data-lepas>Lepas \u2715</button></div>'+
    '<h2 class="npc-name">'+esc(namaObjek(o))+'</h2>'+
    (atur.dekat?'<div class="npc-role">terdekat: '+esc(atur.dekat)+'</div>':'')+
    (/^(WALL|FLOOR)__/.test(o.name||'')
      ?'<p class="hud-catat">Ini bidang bangunan, bukan perabot \u2014 ia tetap satu kesatuan.</p>':'')+
    '<div class="hud-angka"><span>X '+d(p.x)+'</span><span>Y '+d(p.y)+'</span>'+
      '<span>Z '+d(p.z)+'</span><span>\u21bb '+putar+'\u00b0</span></div>'+
    '<div class="npc-actions"><button class="soft-button" type="button" data-salin>Salin posisi</button>'+
      '<button class="soft-button" type="button" data-balik>Kembalikan ini</button></div>'+
    '<button class="soft-button lebar" type="button" data-balik-semua>Kembalikan seluruh tata letak</button>'+
    '<p class="hud-catat">Ctrl+seret geser \u00b7 Shift+Ctrl+seret naik-turun \u00b7 '+
      'Q/E putar \u00b7 panah geser halus \u00b7 Esc lepas</p>';
}

/* Kedudukan awal tiap objek disimpan saat pertama kali disentuh, jadi
   "Kembalikan" selalu punya tempat untuk pulang tanpa memuat ulang halaman. */
function ingatAwal(o){
  if(o.userData.aturAwal)return;
  o.userData.aturAwal={p:o.position.clone(),r:o.rotation.clone()};
}

function aturSinar(e){
  pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
  raycaster.setFromCamera(pointer,camera);
  const abai=new Set([atur.kotak]);
  const kena=raycaster.intersectObjects(scene.children,true)
    .filter(h=>h.object.visible&&!abai.has(h.object)&&h.object.type!=='GridHelper'
      &&!h.object.userData.takBisaDiatur
      &&!(h.object.material&&h.object.material.colorWrite===false));
  return kena[0]||null;
}

addEventListener('pointerdown',(e)=>{
  if(!state.loaded||e.button!==0||!(e.ctrlKey||e.metaKey))return;
  if(e.target!==renderer.domElement)return;
  const h=aturSinar(e);
  if(!h){aturLepas();return;}
  /* Mesh gabungan dibelah lebih dulu, lalu sinarnya ditembakkan ULANG —
     yang kena sekarang perabot tunggal, bukan seluruh kelompok material. */
  let kena=h;
  /* Sekali per kunjungan: seluruh perabot dipisahkan, lalu sinarnya
     ditembakkan ULANG supaya yang kena perabot tunggal — bukan kelompok
     material. Butuh sekitar sedetik dan halamannya memang berhenti sejenak;
     itu ongkos yang cuma dibayar orang yang benar-benar menata. */
  if(!sudahBelah.siap&&/^STATIC__/.test(kena.object.name||'')){
    const jml=siapkanPerabot();
    toast(jml+' perabot siap ditata.');
    const lagi=aturSinar(e);if(lagi)kena=lagi;
  }
  /* Sasarannya ditentukan TEGAS, bukan dengan menaiki rantai induk sampai
     mentok. Yang mentok itu `office`, dan memilihnya berarti menyeret
     seluruh kantor sekaligus — terbaca di panel sebagai "Scene". */
  let sasaran;
  if(kena.object.userData.npc){
    sasaran=kena.object.userData.npc.group;                 // robot: satu badan
  }else if(kena.object.parent&&kena.object.parent.parent
           &&kena.object.parent.parent.userData.hasilBelah){
    sasaran=kena.object.parent;                             // perabot hasil belah
  }else{
    sasaran=kena.object;                                    // sisanya: meshnya sendiri
  }
  ingatAwal(sasaran);
  catatLangkah(sasaran);
  aturPilih(sasaran,kena.point);
  /* Genggamannya dicatat supaya bendanya tidak melompat ke bawah kursor. */
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
    /* Naik-turun dari gerak tegak kursor: bidang tegak yang menghadap kamera
       terasa melompat saat kameranya miring, dan yang dibutuhkan di sini
       cuma "naikkan sedikit". */
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
  if(atur.objek)atur.awalY=atur.objek.position.y;
});

addEventListener('click',(e)=>{
  const el=$('#hud-atur');if(!el||!el.contains(e.target))return;
  if(e.target.closest('[data-lepas]')){aturLepas();return;}
  const o=atur.objek;if(!o)return;
  if(e.target.closest('[data-balik-semua]')){kembalikanSemua();return;}
  if(e.target.closest('[data-balik]')){
    const a=o.userData.aturAwal;
    if(a){catatLangkah(o);o.position.copy(a.p);o.rotation.copy(a.r);atur.kotak.update();hudAtur();}
    return;
  }
  if(e.target.closest('[data-salin]')){
    const t=JSON.stringify({nama:namaObjek(o),
      posisi:o.position.toArray().map(v=>+v.toFixed(3)),
      putar:+(o.rotation.y*180/Math.PI).toFixed(1)});
    navigator.clipboard?.writeText(t).then(()=>toast('Posisi disalin.'),
      ()=>toast('Peramban menolak menyalin. Angkanya ada di panel.'));
  }
});

class NPC {
  constructor(index,gltf){this.index=index;this.profile=daftarPemain[index];this.tulang={};this.dudukLerp=0;this.model=clone(gltf.scene);this.group=new THREE.Group();this.group.add(this.model);scene.add(this.group);this.group.userData.npc=this;this.model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.npc=this;if(o.morphTargetDictionary)this.face=o;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.envMapIntensity=.85);}if(o.isBone){/* Dua kunci untuk tiap tulang: nama apa adanya, dan nama tanpa
         tanda baca. GLTFLoader membuang titik di `CTRL-thigh.L`, dan
         pencarian yang memakai nama asli GLB memulangkan undefined tiap
         frame tanpa satu pun galat. */
        this.tulang[o.name]=o;this.tulang[o.name.replace(/[^A-Za-z0-9]/g,'')]=o;if(o.name==='CTRL-head')this.head=o;}});this.mixer=new THREE.AnimationMixer(this.model);this.actions={};gltf.animations.forEach(a=>this.actions[a.name]=this.mixer.clipAction(a));this.routeIndex=0;this.macet=0;this.ulangJalur=0;this.station=stations[this.profile.route[0]];const p=nav.world(nav.nearest(...this.station.position));this.group.position.set(p[0],.012,p[1]);this.heading=Math.atan2(this.station.look[0]-p[0],this.station.look[1]-p[1]);this.group.rotation.y=this.heading;this.moving=false;this.dwell=this.profile.offset;this.path=[];this.pathIndex=0;this.elapsed=0;this.wave=0;this.play('05_Typing');this.label=document.createElement('div');this.label.className='scene-label';this.label.textContent=this.profile.name;$('#labels').appendChild(this.label);pickTargets.push(this.group);
    /* Sekali saja, dari robot pertama: tinggi pangkal paha di atas telapak.
       Dipakai semua robot — modelnya sama persis. */
    if(!NPC.terukur){NPC.terukur=true;this.model.updateWorldMatrix(true,true);
      const paha=this.tulang['CTRLthighL'];
      if(paha){const v=new THREE.Vector3();paha.getWorldPosition(v);
        const t=Math.round((v.y-this.group.position.y)*1000)/1000;
        if(t>.2&&t<1.4)DUDUK.pangkalPaha=t;}}
    /* ── BAYANGAN KONTAK ──────────────────────────────────────────────
       Bayangan matahari yang lembut tidak pernah benar-benar menempel di
       kaki, dan tanpa titik gelap di bawahnya robot selalu terlihat sedikit
       melayang di atas lantai. Satu bulatan gradien yang mengikuti badannya
       jauh lebih meyakinkan daripada menaikkan resolusi peta bayangan, dan
       ongkosnya satu tekstur untuk semua robot. */
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
  /* ── SALING MENYINGKIR ─────────────────────────────────────────────
     Dibawa dari ruang pertama (11 Sep 2026), supaya kedua ruangan bergerak
     dengan aturan yang sama. Sebelumnya di sini yang ada cuma perlambatan,
     dan dua benda yang pelan tetap saja menempati ruang yang sama — tujuh
     robot saling menembus badan.

     `hindar` bekerja SEBELUM melangkah: arah jalan dibelokkan menjauh dari
     robot terdekat, jadi terlihat mengalah lebih dulu alih-alih tabrakan
     yang dikoreksi sesudah terjadi.

     `pisah` bekerja sesudahnya sebagai jaring pengaman, termasuk untuk yang
     sedang berdiri diam. Hanya robot berindeks LEBIH BESAR yang bergeser,
     supaya keduanya tidak saling mendorong dan bergetar di tempat. */
  /* O(1) lewat petak, BUKAN nav.nearest(): nearest memindai seluruh petak
     bebas, dan memanggilnya tujuh kali per robot per frame berarti ratusan
     ribu perbandingan tiap gambar. */
  bolehDi(x,z){const [cx,cz]=nav.cell(x,z);
    return nav.isFree(cx,cz)&&(!nav.allowed||nav.allowed.has(cz*nav.width+cx));}
  hindar(){let ax=0,az=0;const p=this.group.position;
    for(const o of npcs){if(o===this)continue;
      const dx=p.x-o.group.position.x,dz=p.z-o.group.position.z,d=Math.hypot(dx,dz);
      if(d>.95||d<1e-4)continue;const w=(.95-d)/.95;ax+=dx/d*w;az+=dz/d*w;}
    return [ax,az];}
  /* Tujuh arah, bukan dua: lurus lalu serong makin lebar ke kiri dan kanan.
     Yang cuma mencoba dua arah berhenti selamanya begitu keduanya terhalang. */
  majuKe(vx,vz,step){const p=this.group.position;
    for(const a of [0,.55,-.55,1.1,-1.1,1.7,-1.7]){
      const c=Math.cos(a),s2=Math.sin(a),dx=vx*c-vz*s2,dz=vx*s2+vz*c;
      if(this.bolehDi(p.x+dx*step,p.z+dz*step)){p.x+=dx*step;p.z+=dz*step;return Math.atan2(dx,dz);}}
    return null;}
  pisah(){const p=this.group.position;
    for(const o of npcs){if(o===this||this.index<o.index)continue;
      const dx=p.x-o.group.position.x,dz=p.z-o.group.position.z,d=Math.hypot(dx,dz);
      if(d>=.58||d<1e-4)continue;const geser=.58-d,nx=p.x+dx/d*geser,nz=p.z+dz/d*geser;
      if(this.bolehDi(nx,nz)){p.x=nx;p.z=nz;}}}
  play(name){const next=this.actions[name]||this.actions['01_Idle_Loop'];if(next===this.action)return;next.reset().setEffectiveTimeScale(name==='03_Walk_In_Place'?1.5:1).setEffectiveWeight(1).play();if(this.action)this.action.crossFadeTo(next,.38,false);this.action=next;this.currentClip=name;}
  depart(){this.routeIndex=(this.routeIndex+1)%this.profile.route.length;this.station=stations[this.profile.route[this.routeIndex]];this.path=nav.path([this.group.position.x,this.group.position.z],this.station.position);this.pathIndex=1;this.moving=this.path.length>1;this.dwell=0;if(this.moving)this.play('03_Walk_In_Place');}
  greet(){this.wave=3;this.play('02_Wave');}
  update(dt,time){this.elapsed+=dt;
    if(this.wave>0){this.wave-=dt;if(this.wave<=0)this.play(this.moving?'03_Walk_In_Place':this.station.kind==='type'?'05_Typing':'01_Idle_Loop');}
    else if(this.moving){const next=this.path[this.pathIndex];
      if(!next){this.moving=false;this.dwell=0;this.play(this.station.kind==='type'?'05_Typing':'01_Idle_Loop');}
      else{
        const dx=next[0]-this.group.position.x,dz=next[1]-this.group.position.z,dist=Math.hypot(dx,dz);
        const [ax,az]=this.hindar();let speed=.54;if(ax||az)speed*=.7;
        const step=Math.min(dist,speed*dt);
        if(dist>.001){
          let vx=dx/dist+ax*1.7,vz=dz/dist+az*1.7;const vl=Math.hypot(vx,vz)||1;vx/=vl;vz/=vl;
          const arah=this.majuKe(vx,vz,step);
          if(arah!==null){this.heading+=wrapAngle(arah-this.heading)*Math.min(1,dt*6);this.macet=Math.max(0,this.macet-dt*1.5);}
          else this.macet+=dt;
        }
        /* Tiga perempat detik tanpa satu pun arah yang bisa ditempuh berarti
           jalannya memang tertutup, bukan sekadar berpapasan. Jalur dihitung
           ulang DARI POSISI SEKARANG; kalau dua kali pun masih buntu, badannya
           dikembalikan ke petak bebas terdekat. */
        if(this.macet>.75){this.macet=0;this.ulangJalur++;
          if(this.ulangJalur>2){const w=nav.world(nav.nearest(this.group.position.x,this.group.position.z));
            this.group.position.x=w[0];this.group.position.z=w[1];this.ulangJalur=0;}
          /* Jalur dihitung ulang ke stasiun YANG SAMA — `depart()` akan
             melompat ke stasiun berikutnya, dan robot yang tersangkut
             sebentar tidak seharusnya membatalkan tujuannya. */
          this.path=nav.path([this.group.position.x,this.group.position.z],this.station.position);
          this.pathIndex=1;this.moving=this.path.length>1;return;}
        if(dist<.055){this.pathIndex++;this.ulangJalur=0;}
      }}
    else{this.dwell+=dt;
      // Sel navigasi berhenti di depan kursi; sisanya ditempuh dengan geser halus.
      const t=this.station.tempat;
      if(t){const dx=t[0]-this.group.position.x,dz=t[1]-this.group.position.z;
        if(Math.hypot(dx,dz)<1.4){const k=Math.min(1,dt*1.5);this.group.position.x+=dx*k;this.group.position.z+=dz*k;}}
      /* Duduk: hadapnya ditentukan KURSI, bukan titik pandang stasiun.
         Titik pandang benar untuk yang berdiri; untuk yang duduk ia
         memutar badan menyerong terhadap sandarannya. */
      const desired=(this.station.duduk&&this.station.hadap!==undefined)
        ? this.station.hadap
        : Math.atan2(this.station.look[0]-this.group.position.x,this.station.look[1]-this.group.position.z);this.heading+=wrapAngle(desired-this.heading)*Math.min(1,dt*4);if(this.dwell>this.station.duration)this.depart();else this.play(this.station.kind==='type'?'05_Typing':'01_Idle_Loop');}
    this.pisah();this.group.rotation.y=this.heading;this.mixer.update(dt);
    // Duduk: mixer sudah menulis pose, sekarang pahanya ditekuk.
    const mauDuduk=!this.moving&&this.wave<=0&&!!this.station.duduk;
    this.dudukLerp=clamp(this.dudukLerp+(mauDuduk?dt*2.2:-dt*3.4),0,1);
    if(this.dudukLerp>.002){const t=smooth(this.dudukLerp);
      const maju=new THREE.Vector3(Math.sin(this.heading),0,Math.cos(this.heading));
      const arahPaha=maju.clone().setY(-DUDUK.pahaTurun).normalize();
      const arahBetis=maju.clone().multiplyScalar(DUDUK.betisMaju).setY(-1).normalize();
      /* Meja kerja dibiarkan memakai klip 05_Typing — lengannya memang
         sedang mengetik. Yang duduk santai lengannya diletakkan di
         pangkuan: klip diam menggantungkannya lurus ke bawah, dan di atas
         bantalan sofa itu berarti telapaknya masuk ke dalam sofa. */
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
      /* Turunnya DIHITUNG dari tinggi dudukan kursi yang ditempati, bukan
         satu angka untuk semua: sofa 3,9 cm lebih tinggi daripada kursi
         teal, dan selisih sebesar itu sudah terlihat sebagai melayang. */
      const dudukan=this.station.dudukY||.5;
      this.model.position.y=(dudukan+DUDUK.bantal-DUDUK.pangkalPaha)*t;}
    else if(this.model.position.y)this.model.position.y=0;
    if(this.face){const d=this.face.morphTargetDictionary,v=this.face.morphTargetInfluences;v.fill(0);const blinkPhase=(time+this.index*1.23)%(4.9+this.index*.6),blink=blinkPhase<.2?Math.sin(blinkPhase/.2*Math.PI):0;const set=(k,n)=>{if(d[k]!==undefined)v[d[k]]=n;};set('Blink_L',blink);set('Blink_R',blink);set('Look_X',Math.sin(time*.4+this.index)*.25);set('Look_Y',this.station.kind==='type'&&!this.moving?-.15:.08);if(this.wave>0){set('Happy',.9);set('Smile',1);}else if(this.station.kind==='coffee'&&!this.moving){set('Happy',.4);set('Smile',.7);}else if(this.station.kind==='review'&&!this.moving){set('Mouth_Open',Math.max(0,Math.sin(time*4))*.13);}}
    /* Ikut turun saat duduk, dan mengecil — bayangan kontak yang tetap
       selebar berdiri membuat robot duduk terlihat mengambang. */
    const dudukT=this.dudukLerp||0;
    this.bayang.position.set(this.group.position.x,.006,this.group.position.z);
    this.bayang.scale.setScalar(1-dudukT*.25);
    this.bayang.material.opacity=1-dudukT*.35;
    this.ring.position.x=this.group.position.x;this.ring.position.z=this.group.position.z;this.ring.material.opacity=this.index===state.selected?.62:0;
  }
}

function moveCamera(position,target,duration=1.6){tween={from:camera.position.clone(),to:position.clone(),targetFrom:controls.target.clone(),targetTo:target.clone(),elapsed:0,duration};followPrevious=null;}
function selectNPC(index,focus=true){state.selected=(index+npcs.length)%npcs.length;$$('[data-npc]').forEach(b=>b.classList.toggle('active',+b.dataset.npc===state.selected));followPrevious=null;updateUI();if(focus)focusNPC();}
function focusNPC(){const npc=npcs[state.selected];if(!npc)return;const target=npc.group.position.clone().add(V(0,1.1,0));const offset=V(1.8,1.0,3.0).applyAxisAngle(V(0,1,0),npc.heading);moveCamera(target.clone().add(offset),target,1.5);if(state.mode==='cinema')setMode('orbit',false);$$('[data-view]').forEach(b=>b.classList.remove('active'));}
function setMode(mode,adjust=true){state.mode=mode;$$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('#camera-name').textContent={orbit:'Orbit bebas / 360°',follow:'Mengikuti robot',cinema:'Auto tour / sinematik'}[mode];followPrevious=null;controls.autoRotate=false;if(mode==='follow'&&adjust)focusNPC();if(mode==='cinema'){tourTimer=0;tourIndex=-1;nextTour();}else if(adjust&&mode==='orbit')tween=null;}
const presets={
  overview:()=>({position:overviewPosition(),target:V(-.65,.7,.25),label:'Seluruh kantor'}),
  desk:()=>({position:V(-.5,4.3,8.8),target:V(.6,1.2,3.8),label:'Trading desk'}),
  market:()=>({position:V(1.1,2.9,2.3),target:V(7.05,1.8,0),label:'Market wall'}),
  meeting:()=>({position:V(-1.3,4.7,-1.6),target:V(2.9,.9,-5.9),label:'Ruang rapat'}),
  top:()=>({position:V(-.6,27,.3),target:V(-.6,0,.1),label:'Tampak atas'}),
};
function setView(key){const p=presets[key]();setMode('orbit',false);moveCamera(p.position,p.target,1.8);$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===key));$('#camera-name').textContent=p.label;}
function nextTour(){tourIndex=(tourIndex+1)%6;tourTimer=0;let p;if(tourIndex===1||tourIndex===4){const n=npcs[state.selected],target=n.group.position.clone().add(V(0,1.15,0));p={position:target.clone().add(V(tourIndex===1?2.2:-2.1,1.25,3.2).applyAxisAngle(V(0,1,0),n.heading)),target};}else p=presets[['overview','desk','market','meeting','top','desk'][tourIndex]]();moveCamera(p.position,p.target,3.5);$('#camera-name').textContent='Auto tour · '+(tourIndex+1)+' / 6';}
function updateCamera(dt){if(tween){const t=tween;t.elapsed+=dt;const k=smooth(clamp(t.elapsed/t.duration,0,1));camera.position.lerpVectors(t.from,t.to,k);controls.target.lerpVectors(t.targetFrom,t.targetTo,k);if(k>=1){tween=null;followPrevious=controls.target.clone();}}else if(state.mode==='follow'&&!interacting){const n=npcs[state.selected];const target=n.group.position.clone().add(V(0,1.1,0));const delta=target.clone().sub(controls.target).multiplyScalar(Math.min(1,dt*6));camera.position.add(delta);controls.target.add(delta);}else if(state.mode==='cinema'&&!interacting){const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(V(0,1,0),dt*.022);camera.position.copy(controls.target).add(offset);}if(state.mode==='cinema'){tourTimer+=dt;if(tourTimer>10)nextTour();}controls.update();camera.position.y=Math.max(.18,camera.position.y);}
function pick(e){pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickTargets,true)[0];if(!hit)return;let o=hit.object;while(o){if(o.userData.npc){selectNPC(o.userData.npc.index);return;}if(o.userData.focus){const f=o.userData.focus;setMode('orbit',false);const dir=camera.position.clone().sub(controls.target).normalize();moveCamera(f.point.clone().addScaledVector(dir,f.distance),f.point,1.3);toast(f.label);return;}o=o.parent;}}

function updateUI(){const n=npcs[state.selected];if(!n)return;pasangDompet(n);$('#npc-name').textContent=n.profile.name;$('#npc-role').textContent=n.profile.role;$('#activity').textContent=n.wave>0?'Menyapa kamu':n.moving?'Menuju '+n.station.label.toLowerCase():n.station.activity;$('#npc-area').textContent=n.station.label;$('#npc-emotion').textContent=n.wave>0?'Senang':n.moving?'Berjalan':n.station.kind==='coffee'?'Santai':'Fokus';$('#task-progress').style.width=(n.wave>0?100*(1-n.wave/3):n.moving?100*n.pathIndex/Math.max(1,n.path.length):100*clamp(n.dwell/n.station.duration,0,1))+'%';const minutes=9*60+Math.floor(state.time*2);$('#clock').textContent='TRADING SESSION · '+String(Math.floor(minutes/60)%24).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
function updateLabels(){for(const n of npcs){const p=n.group.position.clone().add(V(0,1.95,0)).project(camera);const show=state.labels&&p.z>-1&&p.z<1&&Math.abs(p.x)<.98&&Math.abs(p.y)<.92;n.label.style.display=show?'block':'none';n.label.style.left=(p.x*.5+.5)*innerWidth+'px';n.label.style.top=(-p.y*.5+.5)*innerHeight+'px';n.label.classList.toggle('selected',n.index===state.selected);}}
function updateWalls(dt){const dir=controls.target.clone().sub(camera.position),distance=dir.length();raycaster.set(camera.position,dir.normalize());raycaster.far=distance;const hits=state.cutaway?raycaster.intersectObjects(wallMeshes,false):[];const blocked=new Set(hits.map(h=>h.object));for(const o of wallMeshes){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){const asal=m.userData.baseOpacity!==undefined?m.userData.baseOpacity:1,desired=blocked.has(o)?Math.min(asal,.08):asal;m.opacity=THREE.MathUtils.lerp(m.opacity,desired,Math.min(1,dt*8));m.depthWrite=m.opacity>.95;}}raycaster.far=Infinity;}
function loop(now){requestAnimationFrame(loop);const realDt=Math.min((now-lastTime)/1000,.05);lastTime=now;if(!state.loaded)return;const dt=state.paused?0:realDt*state.speed;state.time+=dt;HIDUP.detak(realDt);for(const n of npcs)n.update(dt,state.time);updateCamera(realDt);if(frame%8===0)updateWalls(realDt*8);updateLabels();if(state.time-lastScreen>.3){
    /* BERGILIRAN, bukan serempak. Empat belas kanvas 768x512 yang
       digambar ulang bersamaan terasa sebagai patahan berkala;
       sepertiganya tiap giliran tidak terasa, dan tiap layar tetap
       tergambar ulang di bawah satu detik. */
    const sekali=Math.max(1,Math.ceil(screens.length/3));
    for(let k=0;k<sekali;k++){const s=screens[(giliranLayar+k)%screens.length];
      paintTerminal(s.canvas,s.kind,state.time,s.koin,s.tf);s.texture.needsUpdate=true;}
    giliranLayar=(giliranLayar+sekali)%screens.length;lastScreen=state.time;}if(now-lastUI>200){updateUI();lastUI=now;}renderer.render(scene,camera);frame++;}

function togglePause(){state.paused=!state.paused;$('#pause-btn').innerHTML=icon(state.paused?'play':'pause');$('#pause-btn').setAttribute('aria-label',state.paused?'Lanjutkan simulasi':'Jeda simulasi');toast(state.paused?'Aktivitas robot dijeda. Kamera tetap bisa digerakkan.':'Aktivitas robot dilanjutkan.');}
function toggleUI(){document.body.classList.toggle('hide-ui');}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Mode layar penuh tidak tersedia pada tampilan ini.');}}
function wireUI(){
  $$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$$('[data-npc]').forEach(b=>b.onclick=()=>selectNPC(+b.dataset.npc));$('#next-npc').onclick=()=>selectNPC(state.selected+1);$('#focus-btn').onclick=()=>focusNPC();$('#wave-btn').onclick=()=>{npcs[state.selected].greet();focusNPC();toast(npcs[state.selected].profile.name+' menyapamu.');};$('#pause-btn').onclick=togglePause;$('#speed-btn').onclick=()=>{state.speed=state.speed===1?2:state.speed===2?.5:1;$('#speed-btn').textContent=state.speed+'×';};$('#cutaway-toggle').onchange=e=>state.cutaway=e.target.checked;$('#labels-toggle').onchange=e=>state.labels=e.target.checked;$('#fullscreen-btn').onclick=fullscreen;$('#ui-btn').onclick=toggleUI;$('#restore-ui').onclick=toggleUI;$('#help-btn').onclick=()=>$('#help').showModal();$('#close-help').onclick=()=>$('#help').close();$('#help').onclick=e=>{if(e.target===$('#help')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
  addEventListener('keydown',e=>{if(!state.loaded||$('#help').open||/INPUT|TEXTAREA/.test(e.target.tagName))return;const key=e.key.toLowerCase();if(key===' '){e.preventDefault();togglePause();}if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault();urungLangkah();return;}if(e.key==='Escape'){tutupPopup();aturLepas();}
    if(atur.objek){
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
      if(kena){e.preventDefault();atur.kotak.update();hudAtur();return;}
    }
    if(key==='h')toggleUI();if(key==='f')fullscreen();const k=['overview','desk','market','meeting','top'][+key-1];if(k)setView(k);});
}

async function start(){try{setupRenderer();HIDUP.mulaiPasar();const progress={office:0,robot:0};const manager=new THREE.LoadingManager();const loader=new GLTFLoader(manager);const asset=(name)=>loader.loadAsync('./assets/'+name+'.glb',event=>{progress[name]=event.lengthComputable?event.loaded/event.total:Math.min(.85,event.loaded/(16*1024*1024));const pct=12+(progress.office+progress.robot)*40;$('#loading-progress').style.width=pct+'%';$('#loading-note').textContent=Math.round(pct)+'% · '+(progress.office>=1?'Robot & animasi':'Geometri kantor');});const results=await Promise.all([asset('office'),asset('robot'),fetch('./assets/office-layout.json').then(r=>{if(!r.ok)throw Error('Layout missing');return r.json();}),fetch('./assets/navigation.json').then(r=>{if(!r.ok)throw Error('Navigation missing');return r.json();})]);layout=results[2];nav=new Navigation(results[3]);loadOffice(results[0]);setupMarkets();for(const st of Object.values(stations))if(st.duduk)ukurKursi(st);daftarPemain=await susunPemain();pasangChip();npcs=daftarPemain.map((_,i)=>new NPC(i,results[1]));wireUI();selectNPC(0,false);$('#loading-progress').style.width='100%';$('#loading-text').textContent='Trading floor siap';await renderer.compileAsync(scene,camera);state.loaded=true;$('#loading').classList.add('done');lastTime=performance.now();requestAnimationFrame(loop);setInterval(segarkanAnalis,60000);setTimeout(()=>$('#loading').remove(),800);document.body.classList.toggle('compact',innerWidth<480);}
catch(error){fail(error);}}
start();
