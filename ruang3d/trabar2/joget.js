/* ════════════════════════════════════════════════════════════════════════
   JOGET — robot berkumpul lalu menari berbarengan
   ════════════════════════════════════════════════════════════════════════
   Dipicu tangan lewat tombol. Nanti pemicunya bisa datang dari kabar
   TikTok, tapi urutannya tetap sama dan sengaja dipisah di sini supaya
   yang berubah cuma pemicunya, bukan tariannya.

   Tiga babak:
     kumpul   tiap robot berjalan ke slotnya di lantai kosong
     joget    semua menari berbarengan pada FASE YANG SAMA
     bubar    kembali ke rutenya masing-masing

   ── KENAPA TARIANNYA DITULIS, BUKAN DIAMBIL DARI KLIP ──────────────────
   robot.glb cuma punya lima klip: Idle, Wave, Walk, Expression, Typing.
   Tidak ada satu pun tarian di dalamnya, dan membuat klip baru berarti
   membuka Blender, meng-animasi, lalu mengekspor ulang model 14 MB — untuk
   sesuatu yang seluruhnya bisa ditulis sebagai fungsi waktu.

   Rignya FK penuh (hips, chest, neck, head, shoulder, upper_arm, forearm,
   hand, thigh, shin, foot di kedua sisi), jadi pose apa pun bisa disusun
   dari sinus dan sudut. Ongkosnya nol byte tambahan.

   ── FASE DIBAGI, BUKAN DIHITUNG SENDIRI-SENDIRI ────────────────────────
   Tiap robot memakai `t` yang sama persis. Kalau masing-masing memakai
   jamnya sendiri (elapsed miliknya), mereka akan menari pada beat yang
   bergeser beberapa milidetik — dan yang terlihat bukan tiga robot menari
   bersama, melainkan tiga robot menari sendiri-sendiri di tempat yang
   berdekatan. Yang membuat tarian kelompok terbaca adalah keserempakannya.
   ════════════════════════════════════════════════════════════════════════ */
import * as THREE from './vendor/three.module.js';

/* Titik paling kosong di lantai. Dihitung dari navigation.json: satu-satunya
   wilayah yang punya radius bebas 1,5 m ke segala arah — sisanya sudah
   dipenuhi meja, sofa, dan pot. */
export const PANGGUNG = { x: -3.85, z: 3.34, hadap: [1.5, 8.5] };

/* Satu langkah kaki. 0,46 detik ≈ 130 BPM, tempo lagu dansa yang lazim;
   dua langkah = satu putaran penuh tariannya. */
const LANGKAH = 0.46;

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _r = new THREE.Quaternion();

/** Pose satu tulang sebagai SIMPANGAN dari pose istirahatnya.
 *
 *  Memakai slerp, bukan copy: bobotnya yang membuat masuk dan keluar
 *  tarian jadi halus. Dengan copy, robot yang baru sampai di panggung akan
 *  melompat ke pose pertama tarian dalam satu frame. */
function pose(npc, nama, rx, ry, rz, bobot) {
  if(nama==='CTRLhead'||nama==='CTRLneck')return;
  const b = npc.tulang[nama];
  const r = npc.istirahat && npc.istirahat[nama];
  if (!b || !r) return;
  _r.copy(r).multiply(_q.setFromEuler(_e.set(rx, ry, rz)));
  b.quaternion.slerp(_r, bobot);
}

/* ── 1. THE GRIDDY ────────────────────────────────────────────────────
   Dipilih karena ia paling mungkin dikenali DAN paling mungkin ditulis:
   intinya cuma dua hal yang berjalan bersamaan — kaki bergantian
   menendang ke samping sambil badan naik-turun, dan kedua lengan memutar
   di sisi kepala. Tidak ada perpindahan tempat, tidak ada lompatan
   akrobatik, tidak ada pose yang menuntut jari presisi.

   Tarian yang lebih rumit (Renegade, Say So) menuntut urutan pose yang
   berganti tiap seperempat ketukan; itu bukan tidak mungkin ditulis, tapi
   menulisnya berarti menebak-nebak tanpa acuan gerak. Yang ini bisa
   diperiksa benar atau salahnya dari satu potret. */
function griddy(npc, t, bobot) {
  const f = (t / LANGKAH) * Math.PI * 2;

  /* Badan naik-turun DUA KALI lebih cepat daripada kakinya: tiap kaki yang
     mendarat memberi satu hentakan, dan dua kaki berarti dua hentakan per
     putaran. Inilah yang membuat gerakan terbaca sebagai mengikuti ketukan
     alih-alih mengambang. */
  const pantul = Math.abs(Math.sin(f));
  npc.model.position.y = pantul * 0.055;

  /* Pinggul ikut memutar berlawanan dengan kaki yang sedang keluar —
     tubuh yang kaku di atas kaki yang bergerak terlihat seperti boneka
     yang digoyang, bukan orang yang menari. */
  pose(npc, 'CTRLhips', -0.06 + pantul * 0.10, Math.sin(f) * 0.22, 0, bobot);
  pose(npc, 'CTRLchest', 0.05 - pantul * 0.08, -Math.sin(f) * 0.16, 0, bobot);
  pose(npc, 'CTRLneck', -0.04 + pantul * 0.06, 0, 0, bobot);
  pose(npc, 'CTRLhead', -0.10 + pantul * 0.08, Math.sin(f) * 0.12, 0, bobot);

  for (const sisi of ['L', 'R']) {
    const tanda = sisi === 'L' ? 1 : -1;
    const fase = f + (sisi === 'L' ? 0 : Math.PI);
    /* 0 saat kaki ini menumpu, 1 saat ia menendang ke samping. */
    const k = Math.max(0, Math.sin(fase));

    /* KAKI. Paha membuka ke samping (sumbu Z) sambil sedikit maju;
       betisnya menekuk ke belakang — tendangan Griddy memang menyilang
       ke luar, bukan mengangkat lutut lurus ke depan. */
    pose(npc, 'CTRLthigh' + sisi, -0.12 - 0.42 * k, 0, tanda * (0.30 + 0.38 * k), bobot);
    pose(npc, 'CTRLshin' + sisi, 0.26 + 0.62 * k, 0, 0, bobot);
    pose(npc, 'CTRLfoot' + sisi, -0.10 - 0.22 * k, 0, 0, bobot);

    /* LENGAN. Ini tanda tangan gerakannya: kedua lengan memutar di sisi
       kepala. Lingkarannya dibuat dari dua sinus berbeda fase seperempat
       putaran pada dua sumbu — itu definisi gerak melingkar, dan hasilnya
       jauh lebih hidup daripada mengayun maju-mundur di satu sumbu.

       Fase lengan SATU LANGKAH di belakang kaki: yang berlawanan dengan
       kaki yang sedang keluar. Lengan dan kaki sesisi yang bergerak
       bersamaan membuat siapa pun terlihat sedang berbaris, bukan menari. */
    const fl = fase + Math.PI;
    pose(npc, 'CTRLupperarm' + sisi,
      -1.05 + Math.sin(fl) * 0.45, 0, tanda * (0.55 + Math.cos(fl) * 0.30), bobot);
    pose(npc, 'CTRLforearm' + sisi,
      -1.15 - Math.cos(fl) * 0.35, 0, tanda * 0.15, bobot);
    pose(npc, 'CTRLhand' + sisi, Math.sin(fl) * 0.25, 0, 0, bobot);

    /* Jari ditekuk jadi lingkaran — tanda "OK" di sisi mata, bagian
       Griddy yang paling dikenali orang. Ditahan, tidak ikut berdenyut:
       jari yang ikut bergoyang tiap ketukan terbaca sebagai getaran. */
    pose(npc, 'CTRLfinger_1' + sisi, 0, 0, tanda * 0.9, bobot);
    pose(npc, 'CTRLfinger_2' + sisi, 0, 0, tanda * 0.5, bobot);
    pose(npc, 'CTRLfinger_3' + sisi, 0, 0, tanda * 0.5, bobot);
  }
}


/* ── 2. FLOSS ──────────────────────────────────────────────────────────
   Kedua lengan terkunci lurus mengayun ke satu sisi sementara PINGGUL
   mengayun ke sisi berlawanan, lalu bertukar. Satu-satunya hal yang
   membuatnya terbaca sebagai Floss dan bukan sekadar bergoyang adalah
   pertentangan itu — kalau pinggul dan lengan searah, yang terlihat orang
   yang sedang menghindari sesuatu.

   Satu lengan lewat DI DEPAN badan dan satunya DI BELAKANG, bergantian
   tiap ayunan. Itu bagian yang paling sering salah ditiru orang, dan
   justru yang paling menentukan siluetnya. */
function floss(npc, t, bobot) {
  const f = (t / (LANGKAH * 1.15)) * Math.PI * 2;
  const ayun = Math.sin(f);
  const pantul = Math.abs(Math.cos(f));

  npc.model.position.y = pantul * 0.03;
  pose(npc, 'CTRLhips', -0.05, ayun * 0.30, -ayun * 0.16, bobot);
  pose(npc, 'CTRLchest', 0.04, -ayun * 0.34, ayun * 0.20, bobot);
  pose(npc, 'CTRLhead', -0.06, -ayun * 0.18, 0, bobot);

  for (const sisi of ['L', 'R']) {
    const tanda = sisi === 'L' ? 1 : -1;
    /* Depan/belakang: lengan kiri di depan saat ayunan ke kanan, dan
       sebaliknya. `ry` yang memutar bahu inilah "lewat di depan". */
    const depan = ayun * tanda;
    pose(npc, 'CTRLupperarm' + sisi,
      -0.10 + depan * 0.55, depan * 0.5, tanda * 0.22 - ayun * 0.62, bobot);
    /* Siku nyaris lurus — Floss dengan siku menekuk berubah jadi gerakan
       lain yang tidak dikenali siapa pun. */
    pose(npc, 'CTRLforearm' + sisi, -0.12, 0, tanda * 0.06, bobot);
    pose(npc, 'CTRLhand' + sisi, 0, 0, 0, bobot);

    /* Kaki cuma menumpu dan ikut memantul: seluruh gerakan ada di atas
       pinggang. */
    pose(npc, 'CTRLthigh' + sisi, -0.06 - pantul * 0.10, 0, tanda * 0.14, bobot);
    pose(npc, 'CTRLshin' + sisi, 0.14 + pantul * 0.16, 0, 0, bobot);
  }
}

/* ── 3. GANGNAM ────────────────────────────────────────────────────────
   Paling tua di daftar ini dan justru paling dikenali lintas umur — itu
   sebabnya ia masuk. Dua fase bergantian tiap empat langkah:

     tali    kedua tangan menyatu di depan dada, kaki berlari di tempat
     lempar  lengan terangkat ke atas kepala memutar seperti melempar laso

   Yang membuatnya terbaca adalah KAKINYA: langkah kuda yang cepat dan
   pendek, bukan langkah santai. Karena itu kakinya memakai frekuensi dua
   kali lipat dari lengannya. */
function gangnam(npc, t, bobot) {
  const f = (t / (LANGKAH * 0.62)) * Math.PI * 2;          // kaki, cepat
  const siklus = (t / (LANGKAH * 5)) % 1;                  // tali <-> lempar
  const lempar = siklus > 0.5 ? Math.min(1, (siklus - 0.5) * 6) : 0;
  const pantul = Math.abs(Math.sin(f));

  npc.model.position.y = pantul * 0.075;
  pose(npc, 'CTRLhips', -0.10 + pantul * 0.08, Math.sin(f) * 0.12, 0, bobot);
  pose(npc, 'CTRLchest', 0.06, 0, 0, bobot);
  pose(npc, 'CTRLhead', -0.08 + lempar * 0.22, Math.sin(f * 0.5) * 0.2, 0, bobot);

  for (const sisi of ['L', 'R']) {
    const tanda = sisi === 'L' ? 1 : -1;
    const fase = f + (sisi === 'L' ? 0 : Math.PI);
    const k = Math.max(0, Math.sin(fase));

    /* Langkah kuda: lutut naik tinggi, betis melipat penuh ke belakang. */
    pose(npc, 'CTRLthigh' + sisi, -0.14 - 1.0 * k, 0, tanda * 0.12, bobot);
    pose(npc, 'CTRLshin' + sisi, 0.24 + 1.15 * k, 0, 0, bobot);
    pose(npc, 'CTRLfoot' + sisi, -0.12 - 0.3 * k, 0, 0, bobot);

    /* Tangan menyatu di depan dada, lalu terangkat memutar di atas kepala.
       Dua pose itu di-campur lewat `lempar` alih-alih dipatahkan: tangan
       yang berpindah seketika dari dada ke atas kepala terlihat seperti
       bingkai yang hilang. */
    const putar = Math.sin(f * 0.5) * 0.5 * lempar;
    pose(npc, 'CTRLupperarm' + sisi,
      -1.30 - lempar * 1.25 + putar, 0,
      -tanda * (0.42 - lempar * 0.22), bobot);
    pose(npc, 'CTRLforearm' + sisi,
      -1.05 + lempar * 0.75, 0, -tanda * (0.30 - lempar * 0.30), bobot);
    pose(npc, 'CTRLhand' + sisi, putar * 0.6, 0, 0, bobot);
  }
}

/* ── 4. HIT THE WOAH ───────────────────────────────────────────────────
   Satu-satunya gerakan di daftar ini yang bukan siklus halus, dan itu
   justru intinya: SAPUAN CEPAT lalu BERHENTI MENDADAK. Yang dilihat orang
   bukan sapuannya, melainkan diamnya — kalau lengan terus mengalir tanpa
   pernah mengunci, ia bukan Woah lagi.

   Karena itu waktunya dibagi tegas: 30% pertama bergerak, 70% sisanya
   MENAHAN. Selama menahan tidak ada satu pun sudut yang berubah kecuali
   denyut lutut yang sangat kecil — tubuh yang benar-benar beku selama
   setengah detik terlihat seperti animasi yang macet. */
function woah(npc, t, bobot) {
  const PERIODE = LANGKAH * 2.2;
  const u = (t % PERIODE) / PERIODE;
  const kiri = Math.floor(t / PERIODE) % 2 === 0;          // sisi bergantian
  const sapu = u < 0.3 ? smoothLokal(u / 0.3) : 1;
  const tahan = u < 0.3 ? 0 : 1;
  /* Denyut kecil selama menahan: 8 Hz, amplitudo sepersepuluh. Cukup untuk
     mengatakan "masih hidup", terlalu kecil untuk terbaca sebagai gerakan. */
  const denyut = tahan * Math.sin((u - 0.3) / 0.7 * Math.PI * 4) * 0.04;

  npc.model.position.y = -0.045 * sapu + denyut * 0.3;
  const arah = kiri ? 1 : -1;

  pose(npc, 'CTRLhips', -0.16 * sapu + denyut, arah * 0.24 * sapu, 0, bobot);
  pose(npc, 'CTRLchest', 0.10 * sapu, -arah * 0.20 * sapu, -arah * 0.12 * sapu, bobot);
  pose(npc, 'CTRLhead', -0.14 * sapu, arah * 0.30 * sapu, arah * 0.18 * sapu, bobot);

  for (const sisi of ['L', 'R']) {
    const tanda = sisi === 'L' ? 1 : -1;
    /* Lengan yang SEARAH dengan sapuan naik tinggi; yang berlawanan
       menyilang rendah di depan perut. Dua tinggi yang berbeda itu yang
       membuat siluetnya miring, dan miringnya itu Woah. */
    const atas = tanda === arah;
    pose(npc, 'CTRLupperarm' + sisi,
      (atas ? -1.85 : -0.95) * sapu - 0.12, 0,
      tanda * (atas ? 0.30 : -0.55) * sapu + tanda * 0.18, bobot);
    pose(npc, 'CTRLforearm' + sisi,
      (atas ? -1.65 : -1.30) * sapu - 0.10, 0, tanda * 0.10, bobot);
    pose(npc, 'CTRLhand' + sisi, -0.35 * sapu, 0, 0, bobot);

    /* Lutut menekuk dalam saat mengunci \u2014 seluruh badan turun, bukan cuma
       lengannya yang berhenti. */
    pose(npc, 'CTRLthigh' + sisi, -0.30 * sapu - 0.08, 0, tanda * (0.22 + 0.20 * sapu), bobot);
    pose(npc, 'CTRLshin' + sisi, 0.52 * sapu + 0.16, 0, 0, bobot);
    pose(npc, 'CTRLfoot' + sisi, -0.22 * sapu, 0, 0, bobot);
  }
}

/* ── 5. TOOSIE SLIDE ───────────────────────────────────────────────────
   Badan meluncur ke samping sambil satu lengan menggantung di atas kepala,
   dan sisi lengannya bertukar tiap kali arah luncurannya berbalik.

   Luncurannya dibuat dari pergeseran MODEL, bukan dari langkah kaki:
   telapak tetap menempel di lantai dan yang berpindah badannya. Itu yang
   membedakan "meluncur" dari "melangkah ke samping", dan bedanya jelas
   terlihat walau dari jauh. */
function toosie(npc, t, bobot) {
  const PERIODE = LANGKAH * 2.6;
  const f = (t / PERIODE) * Math.PI * 2;
  const geser = Math.sin(f);
  const kanan = geser >= 0;

  /* Digeser pada sumbu X LOKAL model \u2014 modelnya anak dari `group` yang
     sudah diputar mengikuti arah hadap, jadi X lokal selalu "samping"
     berapa pun arah panggungnya. */
  npc.model.position.x = geser * 0.20;
  npc.model.position.y = Math.abs(Math.cos(f)) * 0.025;

  pose(npc, 'CTRLhips', -0.05, geser * 0.18, -geser * 0.22, bobot);
  pose(npc, 'CTRLchest', 0.05, geser * 0.10, -geser * 0.14, bobot);
  pose(npc, 'CTRLhead', -0.10, geser * 0.26, -geser * 0.10, bobot);

  for (const sisi of ['L', 'R']) {
    const tanda = sisi === 'L' ? 1 : -1;
    /* Lengan yang di atas selalu BERLAWANAN dengan arah luncuran \u2014 itu
       yang membuat badannya terbaca condong, bukan jatuh. */
    const diAtas = kanan ? sisi === 'L' : sisi === 'R';
    const kuat = Math.min(1, Math.abs(geser) * 1.6);
    pose(npc, 'CTRLupperarm' + sisi,
      diAtas ? -2.05 * kuat - 0.15 : -0.20,
      0,
      tanda * (diAtas ? 0.10 : 0.30 + kuat * 0.25), bobot);
    pose(npc, 'CTRLforearm' + sisi,
      diAtas ? -0.55 * kuat - 0.10 : -0.45 - kuat * 0.35,
      0, tanda * 0.12, bobot);
    pose(npc, 'CTRLhand' + sisi, diAtas ? -0.3 * kuat : 0.2, 0, 0, bobot);

    /* Kaki mengangkang sedikit dan lutut menekuk mengikuti arah luncuran:
       kaki yang ditinggalkan lurus, kaki yang dituju menekuk menahan. */
    const menahan = (tanda > 0) === kanan;
    pose(npc, 'CTRLthigh' + sisi, -0.06, 0, tanda * (0.26 + Math.abs(geser) * 0.20), bobot);
    pose(npc, 'CTRLshin' + sisi, 0.12 + (menahan ? Math.abs(geser) * 0.42 : 0), 0, 0, bobot);
    pose(npc, 'CTRLfoot' + sisi, -0.08, 0, 0, bobot);
  }
}

/* Dipakai `woah`; ditulis lokal supaya joget.js tidak bergantung pada
   simulation.js hanya untuk satu kurva. */
function smoothLokal(x) { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); }

/* ── DAFTAR GERAKAN ────────────────────────────────────────────────────
   Namanya ikut karena ia ditampilkan di layar. Untuk siaran langsung itu
   bukan hiasan: penonton yang mengenali gerakannya akan menyebut namanya
   di kolom komentar, dan nama yang sudah tertulis di layar membuat
   percakapan itu dimulai satu langkah lebih awal. */
// Five additional choreographies. Time is expressed on the shared musical clock.
function shuffle(n,t,w){
 const b=t/LANGKAH,f=b*Math.PI,a=Math.sin(f),lift=Math.max(0,Math.sin(f*2));
 n.model.position.y=lift*.045;n.model.position.x=Math.sin(f)*.08;
 pose(n,'CTRLhips',-.06,0,-a*.09,w);pose(n,'CTRLchest',.04,-a*.12,a*.06,w);
 for(const s of ['L','R']){const k=s==='L'?1:-1,p=Math.max(0,a*k);
  pose(n,'CTRLthigh'+s,-.12-.62*p,0,k*.10,w);pose(n,'CTRLshin'+s,.14+.8*p,0,0,w);pose(n,'CTRLfoot'+s,-.1-.2*p,0,0,w);
  pose(n,'CTRLupperarm'+s,-.40+.48*a*k,0,k*.25,w);pose(n,'CTRLforearm'+s,-.78,0,0,w);pose(n,'CTRLhand'+s,.12*a,0,0,w);
 }
}
function disco(n,t,w){
 const b=t/LANGKAH,f=b*Math.PI,a=Math.sin(f),swap=Math.floor(b/4)%2;
 n.model.position.y=(1-Math.cos(f*2))*.015;
 pose(n,'CTRLhips',0,Math.sin(f/2)*.20,a*.13,w);pose(n,'CTRLchest',.04,0,-a*.13,w);
 for(const s of ['L','R']){const k=s==='L'?1:-1,up=(s==='L')===(swap===0),point=(1-Math.cos(f))*.5;
  pose(n,'CTRLupperarm'+s,up?-1.15-1.15*point:-.20,0,k*(up?.40:.22),w);pose(n,'CTRLforearm'+s,up?-.13:-1.05,0,k*.1,w);
  pose(n,'CTRLhand'+s,0,0,k*point*.2,w);pose(n,'CTRLthigh'+s,-.08,0,k*(.12+.13*Math.max(0,k*a)),w);pose(n,'CTRLshin'+s,.18+.12*Math.abs(a),0,0,w);
 }
}
function popLock(n,t,w){
 const b=t/LANGKAH,phase=b%2,side=Math.floor(b/2)%2?1:-1,pulse=Math.exp(-8*(b%1)),sweep=smoothLokal(Math.min(1,phase*2));
 n.model.position.y=.022*pulse;pose(n,'CTRLhips',-.09,side*.10,0,w);pose(n,'CTRLchest',-.05+pulse*.13,-side*.12,0,w);
 for(const s of ['L','R']){const k=s==='L'?1:-1;
  pose(n,'CTRLupperarm'+s,-.85-.22*pulse,side*.25*sweep,k*(.8+.16*pulse),w);pose(n,'CTRLforearm'+s,-1.4,0,k*side*.45*sweep,w);pose(n,'CTRLhand'+s,Math.sin(phase*Math.PI)*.45,0,k*.3,w);
  pose(n,'CTRLthigh'+s,-.18,0,k*.17,w);pose(n,'CTRLshin'+s,.31,0,0,w);pose(n,'CTRLfoot'+s,-.10,0,0,w);
 }
}
function stomp(n,t,w){
 const b=t/LANGKAH,f=b*Math.PI,up=Math.max(0,Math.sin(f)),other=Math.max(0,-Math.sin(f)),clap=(b%4)>2;
 n.model.position.y=.045*Math.sin((b%1)*Math.PI);pose(n,'CTRLhips',-.09,0,.045*Math.sin(f),w);pose(n,'CTRLchest',.05,0,0,w);
 for(const s of ['L','R']){const k=s==='L'?1:-1,l=s==='L'?up:other;
  pose(n,'CTRLthigh'+s,-.10-.65*l,0,k*.15,w);pose(n,'CTRLshin'+s,.16+.9*l,0,0,w);pose(n,'CTRLfoot'+s,-.08-.18*l,0,0,w);
  pose(n,'CTRLupperarm'+s,clap?-1.25:-.5-l*.35,0,clap?-k*.4:k*.24,w);pose(n,'CTRLforearm'+s,clap?-1.15:-.85,0,clap?-k*.25:0,w);pose(n,'CTRLhand'+s,0,0,clap?k*.25:0,w);
 }
}
function waveGroove(n,t,w){
 const b=t/LANGKAH,f=b*Math.PI/2,a=Math.sin(f);n.model.position.y=.02*(1-Math.cos(f*2));n.model.position.x=.065*a;
 pose(n,'CTRLhips',-.04,.10*a,-.12*a,w);pose(n,'CTRLchest',.04,-.12*a,.12*a,w);
 for(const s of ['L','R']){const k=s==='L'?1:-1,ph=f+(s==='L'?0:Math.PI);
  pose(n,'CTRLupperarm'+s,-.60+.30*Math.sin(ph),0,k*(.95+.27*Math.sin(ph)),w);pose(n,'CTRLforearm'+s,-.45-.55*(1+Math.sin(ph-.7)),0,0,w);pose(n,'CTRLhand'+s,.5*Math.sin(ph-1.4),0,k*.1,w);
  pose(n,'CTRLthigh'+s,-.1,0,k*(.15+.10*Math.max(0,k*a)),w);pose(n,'CTRLshin'+s,.2+.08*Math.abs(a),0,0,w);
 }
}

const GERAKAN = [
  { nama: 'The Griddy', pose: griddy },
  { nama: 'Floss', pose: floss },
  { nama: 'Gangnam Style', pose: gangnam },
  { nama: 'Hit the Woah', pose: woah },
  { nama: 'Toosie Slide', pose: toosie },
  {nama:'Robot Shuffle',pose:shuffle},
  {nama:'Disco Profit',pose:disco},
  {nama:'Pop & Lock',pose:popLock},
  {nama:'Stomp Rally',pose:stomp},
  {nama:'Wave Groove',pose:waveGroove},
];

/* Lama satu gerakan sebelum berganti. 11 detik ≈ 12 putaran Griddy —
   cukup lama untuk dikenali dan ditirukan, cukup pendek supaya yang
   menonton tidak sempat bosan sebelum yang berikutnya datang. */
const DURASI_GERAKAN = 16*LANGKAH;

/** Nama kelima gerakan, untuk menyusun menunya. */
export const NAMA_GERAKAN = GERAKAN.map((g) => g.nama);

export class Joget {
  constructor() {
    this.tempoMode='mix';this.tempo=1;this.tempoTime=0;
    this.fase = 'mati';      // mati | kumpul | joget | bubar
    this.t = 0;              // jam tarian, DIBAGI semua robot
    this.tKumpul = 0;        // lama menunggu yang belum sampai
    this.gerakan = 0;        // indeks di GERAKAN
    /* null = bergantian sendiri; angka = dikunci di gerakan itu. Untuk
       siaran keduanya perlu: bergantian saat ditinggal, dan dikunci saat
       penonton meminta satu gerakan tertentu. */
    this.kunci = null;
    this.tPose = 0;          // jam FASE gerakan — ikut lagu kalau ada
    this.bobot = 0;          // 0..1, campuran pose tarian terhadap klip
    /* Gerakan tempat satu putaran dimulai. Dalam mode bergantian dengan
       lagu Otomatis, pengiringnya berganti tiap gerakan dan tidak pernah
       sampai ujung — jadi "lagunya habis" diartikan sebagai seluruh
       sepuluh gerakan sudah dibawakan sekali. Lihat `putaranPenuh`. */
    this.putaranAwal = 0;
    this.putaranPenuh = false;
  }

  get aktif() { return this.fase !== 'mati'; }

  /** Slot di panggung. Baris depan dulu, baris kedua menyusul kalau
   *  robotnya lebih dari empat — satu baris berisi tujuh robot menjadi
   *  garis selebar enam meter yang tidak muat di satu layar. */
  slot(i, jumlah) {
    const depan = Math.min(jumlah, 4);
    const baris = i < depan ? 0 : 1;
    const dalam = baris === 0 ? i : i - depan;
    const isi = baris === 0 ? depan : jumlah - depan;
    const x = (dalam - (isi - 1) / 2) * 0.90;
    const z = baris * 1.00;
    /* ── SUMBUNYA DITURUNKAN DARI ARAH HADAP, BUKAN DARI ROTASI 2D BIASA
       Berkas ini memakai konvensi `heading = atan2(dx, dz)` — sama dengan
       seluruh main.js — sehingga vektor MAJU-nya (sin h, cos h), bukan
       (cos h, sin h) seperti rotasi 2D yang lazim. Versi pertama memakai
       matriks rotasi biasa dan hasilnya barisan yang miring 90° dari yang
       dimaksud: robotnya berbaris MENJAUH dari penonton, satu di belakang
       yang lain, dan yang terlihat cuma robot terdepan.

       maju    = (sin h, cos h)
       kanan   = (cos h, −sin h)   ← tegak lurus maju, dan itu arah barisan
       baris 2 = mundur satu meter, yaitu −maju */
    const h = Math.atan2(PANGGUNG.hadap[0] - PANGGUNG.x, PANGGUNG.hadap[1] - PANGGUNG.z);
    const c = Math.cos(h), s = Math.sin(h);
    return [PANGGUNG.x + x * c - z * s, PANGGUNG.z - x * s - z * c];
  }

  mulai(npcs, nav, pilihan = null) {
    if (this.fase !== 'mati') return;
    this.kunci = pilihan === null || pilihan < 0 ? null : pilihan;
    this.fase = 'kumpul';
    this.t = 0;
    this.tKumpul = 0;this.tempoTime=0;this.tempo=1;
    /* Mulai dari yang pertama tiap kali, bukan melanjutkan dari yang
       terakhir: urutan yang bisa ditebak jauh lebih berguna untuk siaran
       daripada urutan yang 'tidak mengulang'. Kalau satu gerakan DIKUNCI, ia
       yang jadi titik mulainya. */
    this.gerakan = this.kunci ?? 0;
    this.putaranAwal = this.gerakan; this.putaranPenuh = false;
    this.tPose = 0;
    /* ── SLOT DIBAGI MENURUT JARAK, BUKAN NOMOR URUT ────────────────
       Dulu robot ke-i selalu dapat slot ke-i. Karena nomor urut tidak ada
       hubungannya dengan letak mejanya, robot di pojok kanan bisa
       kebagian slot paling kiri — menyeberang ruangan penuh sementara
       robot yang sudah berdiri di sebelah slot itu berjalan ke arah
       sebaliknya. Dua perjalanan panjang yang saling menyilang, dan
       keduanya lewat lorong sempit yang sama.

       Pembagian rakus dari yang paling dekat: tiap slot diambil robot
       terdekat yang belum kebagian. Bukan yang optimal secara matematis,
       tapi menghapus hampir semua penyilangan — dan yang membuat
       kerumunan terlihat pintar memang itu, bukan jarak totalnya.

       Terukur: robot terjauh tiba 34,3 detik -> 20,0 detik. */
    const slotDunia = npcs.map((_, i) => {
      const t = this.slot(i, npcs.length);
      return nav.world(nav.nearest(t[0], t[1]));
    });
    // Fill the desk-side row first. Late arrivals use the open front edge,
    // so a completed formation never cages an empty middle slot.
    slotDunia.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
    const sisa = npcs.map((_, i) => i);
    const untuk = new Array(npcs.length);
    for (const sl of slotDunia) {
      let baik = 0;
      let dekat = Infinity;
      sisa.forEach((r, k) => {
        const n = npcs[r];
        const d = Math.hypot(n.group.position.x - sl[0], n.group.position.z - sl[1]);
        if (d < dekat) { dekat = d; baik = k; }
      });
      untuk[sisa[baik]] = sl;
      sisa.splice(baik, 1);
    }

    npcs.forEach((npc, i) => {
      const tujuan = untuk[i];
      npc.jogetUrutan=slotDunia.indexOf(tujuan);
      npc.jogetBerangkat=npc.group.position.y>.1;
      /* Tempat kerjanya dititipkan dulu; lihat pulang() di main.js. */
      npc.stasiunSebelum = npc.station;
      npc.rutePulang = npc.routeIndex;
      npc.joget = true;
      npc.jogetSampai = false;
      npc.jogetTujuan = tujuan;
      if(npc.excursion)npc.excursion='dance-return';
      const jalur = npc.planRoute(npc.jogetTujuan);
      /* ── TITIK BERDIRI JADI SINGGAHAN PERTAMA ────────────────────
         Robot yang sedang duduk berdiri PERSIS di kursinya, dengan meja
         tepat di depannya. Jalur lurus dari situ ke panggung menembus
         mejanya, dan penghindar menutup ketujuh arah yang dicobanya —
         robotnya berdiri diam sambil memutar badan, persis yang
         dilaporkan pemilik.

         Mundur dulu ke titik berdiri stasiunnya menyelesaikannya, dan
         kebetulan juga gerakan yang memang wajar: orang menggeser kursi,
         mundur, baru berjalan. */
      const awal = npc.dudukLerp>.2 && npc.station && npc.station.duduk ? [npc.station.position] : [];
      npc.path = awal.concat(jalur.length > 1 ? jalur.slice(1) : [npc.jogetTujuan]);
      npc.pathIndex = 0;
      npc.moving = true;
      npc.dudukLerp = 0;
      npc.wave = 0;
      npc.play(npc.moving ? '03_Walk_In_Place' : '01_Idle_Loop');
    });
  }

  selesai(npcs, stasiunPeta = {}) {
    if (this.fase === 'mati') return;
    this.fase = 'bubar';

    for (const npc of npcs) {
      npc.joget = false;
      npc.jogetSampai = false;
      npc.model.position.y = 0;
      npc.model.position.x = 0;
      /* Dikembalikan dengan berjalan, bukan diteleportasi. */
      npc.pulang();
    }
    this.fase = 'mati';
    this.bobot = 0;
  }

  tukar(npcs, nav, pilihan = null) { this.aktif ? this.selesai(npcs) : this.mulai(npcs, nav, pilihan); }

  /** Ganti gerakan tanpa membubarkan panggung. `i < 0` = kembali
   *  bergantian sendiri. */
  pilihGerakan(i) {
    this.kunci = i < 0 ? null : i;
    if (Number.isInteger(i) && i >= 0 && i < GERAKAN.length) this.gerakan = i;
    this.putaranAwal = this.gerakan; this.putaranPenuh = false;
    /* Bobot diturunkan supaya pergantiannya luruh lewat klip diam, bukan
       berpindah pose dalam satu bingkai. */
    this.bobot = 0.15;
    this.ganti = GERAKAN[this.gerakan].nama;
  }

  /** Dipanggil sekali per frame, SEBELUM npc.update(). */
  /** @param jamMusik Detik sejak ketukan pertama, atau null kalau musiknya
   *  mati. Dipakai sebagai JAM UTAMA kalau ada — lihat kepala musik.js:
   *  `dt` yang ditumpuk sendiri meleset dari ketukan sesudah beberapa puluh
   *  detik, dan meleset dari ketukan adalah satu-satunya hal yang dinilai
   *  mata saat melihat orang menari. */
  perbarui(dt, npcs, jamMusik = null) {
    if (this.fase === 'mati') { this.bobot = Math.max(0, this.bobot - dt * 2.5); return; }
    if (this.fase === 'kumpul') {
      this.tKumpul += dt;
      /* 14 detik, bukan 9: itu saat robot terjauh sudah hampir sampai.
         Dulu 9 detik masuk akal karena batas waktu ini MEMINDAHKAN yang
         belum tiba; sekarang ia cuma memulai musiknya, jadi angkanya
         dipilih dari yang sebenarnya — jarak tempuh robot terjauh. */
      if (npcs.every((n) => n.jogetSampai) || this.tKumpul > 14) {
        /* Batas waktu ini MEMULAI TARIAN, bukan menyatakan semua sudah
           sampai — dan bedanya besar.
           ────────────────────────────────────────────────────────────
           Versi pertama menandai seluruh robot `jogetSampai = true`.
           Akibatnya robot yang masih di seberang ruangan masuk ke cabang
           sudah-sampai, dan lerp perapian slot di sana MENYERET badannya
           melintasi lantai dalam sekejap. Dilaporkan pemilik: "tiba-tiba
           sampai panggung, terlihat tidak natural."

           Yang belum sampai sekarang TETAP BERJALAN, dan ikut menari
           begitu kakinya benar-benar tiba. Tarian yang dimulai bertujuh
           kurang satu selama beberapa detik jauh lebih kecil salahnya
           daripada satu robot yang meluncur. */
        this.fase = 'joget';
        this.t = 0;
        this.ganti = GERAKAN[this.gerakan].nama;
      }
    }
    if (this.fase === 'joget' && dt > 0) {
      const sebelum = this.t;
      /* DUA JAM, dan itu disengaja.
         ──────────────────────────────────────────────────────────────
         `t` selalu maju dari dt dan tidak pernah mundur — ia yang
         menghitung kapan gerakan berganti.

         `tPose` mengikuti pemutar lagu kalau ada, karena fase gerakan
         harus terkunci ke ketukan: kaki yang mendarat setengah ketukan
         di belakang kick terlihat seperti orang yang tidak mendengar
         musiknya.

         Versi sebelumnya memakai satu jam untuk keduanya, dan itu pecah
         begitu lagunya berbeda per gerakan: pemutar yang mengulang lagu
         melompat balik ke nol, penghitung siklus ikut melompat, dan
         gerakannya berganti tiap kali lagunya habis. */
      this.tempoTime+=dt;
      const phase=this.tempoTime%18;
      const target=this.tempoMode==='slow'?.32:this.tempoMode==='fast'?1.8:this.tempoMode==='normal'?1:
        phase<5?1:phase<9?.32:phase<12?1.8:phase<15?1:phase<16.5?.32:1.8;
      this.tempo+=(target-this.tempo)*Math.min(1,dt*4.5);
      this.t += dt*this.tempo;
      this.tPose = jamMusik !== null ? jamMusik : this.t;
      /* Berganti gerakan saat ambangnya terlewat. `t` TIDAK dinolkan:
         tiap gerakan menghitung fasenya sendiri lewat modulo, jadi
         menolkannya cuma akan membuat semuanya mulai dari pose yang sama
         persis — dan lima gerakan yang selalu dimulai dari satu pose
         terbaca sebagai satu gerakan panjang yang tersendat. */
      if (this.kunci === null
          && Math.floor(this.t / DURASI_GERAKAN) !== Math.floor(sebelum / DURASI_GERAKAN)) {
        this.gerakan = (this.gerakan + 1) % GERAKAN.length;
        if (this.gerakan === this.putaranAwal) this.putaranPenuh = true;
        /* Bobot diturunkan sebentar, bukan dipatahkan: selama 0,4 detik
           berikutnya pose lama luruh ke klip diam lalu naik lagi ke pose
           baru. Tanpa itu, seluruh badan berpindah pose dalam satu bingkai
           dan yang terlihat adalah kedutan, bukan pergantian gerakan. */
        this.bobot = 0.15;
        this.ganti = GERAKAN[this.gerakan].nama;
      }
      this.bobot = Math.min(1, this.bobot + dt * 2.2);
    }
  }

  /** Dipanggil dari npc.update() sesudah mixer menulis posenya. */
  /** Nama gerakan yang sedang berjalan — dipakai layar. */
  get namaGerakan() { return GERAKAN[this.gerakan].nama; }

  pose(npc) {
    if (!npc.jogetSampai || this.bobot <= 0.002) return false;
    /* Digeser dan dinolkan lagi tiap frame: `toosie` memakai
       model.position.x untuk meluncur, dan gerakan lain tidak. Tanpa
       penolan ini, robot yang berpindah dari Toosie ke Floss akan
       tertinggal di tempat luncuran terakhirnya selamanya. */
    npc.model.position.x = 0;
    GERAKAN[this.gerakan].pose(npc, this.tPose ?? this.t, this.bobot);
    return true;
  }
}
