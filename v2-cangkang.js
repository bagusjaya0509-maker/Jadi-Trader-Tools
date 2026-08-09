/* ════════════════════════════════════════════════════════════════════════
   JADI TRADER — CANGKANG V2 (sidebar + topbar)
   ════════════════════════════════════════════════════════════════════════

   Menyuntikkan navigasi yang sama ke SETIAP halaman. Alasannya bukan sekadar
   hemat: halaman lama (screener 463 KB, jurnal 176 KB) tidak boleh dibongkar
   markup-nya. Menempelkan cangkang dari luar berarti tampilannya seragam
   tanpa satu baris pun logika trading disentuh.

   Cara pakai - dua baris di kepala halaman:
     <link rel="stylesheet" href="v2-tema.css">
     <script src="v2-cangkang.js" defer></script>

   Halaman menandai dirinya lewat atribut di <body>, mis:
     <body data-v2-halaman="screener">

   ── SOAL SEMBUNYI-OTOMATIS ────────────────────────────────────────────────
   Diminta: "hide otomatis dan hide manual saat selesai pakai".

   Ditafsirkan begini, dan tafsirannya sengaja konservatif:
     - MANUAL menang selamanya. Kalau kamu menciutkan sidebar sendiri, ia
       tidak akan membuka sendiri - tersimpan di localStorage.
     - OTOMATIS hanya berlaku kalau kamu TIDAK pernah memutuskan sendiri,
       dan hanya dipicu oleh dua hal yang jelas: layar sempit (<1180px),
       atau tetikus menjauh dari sidebar selama 6 detik penuh.
     - Otomatis TIDAK PERNAH menciutkan saat kursor masih di dalam sidebar,
       saat ada dropdown terbuka di dalamnya, atau saat halaman sedang
       memindai. Sidebar yang menutup sendiri di tengah pekerjaan itu
       menyebalkan, bukan pintar.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var KUNCI_CIUT   = 'v2SidebarCiut';      // '1' | '0' | null (belum diputuskan)
  var KUNCI_OTO    = 'v2SidebarOtomatis';  // '1' menyala (bawaan), '0' mati
  var JEDA_OTO_MS  = 6000;
  var LEBAR_SEMPIT = 1180;

  /* Peta halaman. `href` relatif supaya sama saja dijalankan dari berkas
     lokal maupun dari GitHub Pages. */
  var MENU = [
    { grup: 'Trading', butir: [
      { id:'home',       label:'Beranda',        href:'index.html',                ikon:'rumah' },
      { id:'dashboard',  label:'Dashboard',      href:'dashboard.html',            ikon:'kotak' },
      { id:'screener',   label:'Crypto Screener',href:'ema-cross-screener_3.html', ikon:'grafik' },
      { id:'jurnal',     label:'Jurnal Trading', href:'jurnal-trading.html',       ikon:'buku' }
    ]},
    { grup: 'Toko', butir: [
      { id:'marketplace',label:'Marketplace',    href:'marketplace.html',          ikon:'tas' }
    ]},
    { grup: 'Administrasi', butir: [
      { id:'pemilik',    label:'Panel Pemilik',  href:'pemilik.html',              ikon:'perisai', pemilikSaja:true }
    ]}
  ];

  /* Ikon SVG, bukan emoji - checklist poin 01 & daftar pra-kirim
     ui-ux-pro-max sama-sama menyebutnya. Digambar dengan stroke supaya
     ketebalannya seragam dengan tipografi di sekitarnya. */
  var IKON = {
    rumah:  '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>',
    kotak:  '<rect x="3" y="3" width="7.5" height="7.5" rx="1.4"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4"/>',
    grafik: '<path d="M3 20h18"/><path d="M6 20V10"/><path d="M11 20V4"/><path d="M16 20v-7"/>',
    buku:   '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M8 3v18"/>',
    tas:    '<path d="M4 8h16l-1.2 12H5.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    perisai:'<path d="M12 3l7.5 3v6c0 4.6-3.1 8.3-7.5 9.6C7.6 20.3 4.5 16.6 4.5 12V6z"/>',
    sisi:   '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9.5 4v16"/>'
  };

  function svg(nama){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
         + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IKON[nama]||'') + '</svg>';
  }

  function baca(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function tulis(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }

  /* Latar bercahaya + grain. Dipasang dari sini, bukan dari tiap halaman,
     supaya kedalamannya seragam di seluruh situs. */
  function pasangLatar(){
    if(document.querySelector('.v2-cahaya')) return;
    var c = document.createElement('div'); c.className = 'v2-cahaya';
    var g = document.createElement('div'); g.className = 'v2-grain';
    document.body.appendChild(c); document.body.appendChild(g);
  }

  var gaya = document.createElement('style');
  gaya.textContent = [
    /* Kerangka: sidebar tetap (fixed), isi halaman digeser lewat padding di
       <body>. Digeser dengan padding, bukan margin, supaya latar bercahaya
       yang position:fixed tetap menutupi seluruh layar. */
    '.v2-sisi{position:fixed;top:0;left:0;bottom:0;width:var(--v2-sisi);z-index:80;',
    '  display:flex;flex-direction:column;background:var(--v2-hitam-2);',
    '  border-right:1px solid var(--v2-garis);',
    '  transition:width var(--v2-sedang) var(--v2-keluar),transform var(--v2-sedang) var(--v2-keluar);}',
    'body.v2-ciut .v2-sisi{width:var(--v2-sisi-kecil);}',
    'body{padding-left:var(--v2-sisi);transition:padding-left var(--v2-sedang) var(--v2-keluar);}',
    'body.v2-ciut{padding-left:var(--v2-sisi-kecil);}',

    '.v2-sisi-kepala{display:flex;align-items:center;gap:10px;padding:18px 16px;',
    '  border-bottom:1px solid var(--v2-garis);min-height:64px;}',
    '.v2-merek{display:flex;align-items:center;gap:10px;overflow:hidden;flex:1;min-width:0;}',
    '.v2-merek-tanda{width:30px;height:30px;flex:0 0 auto;border-radius:8px;',
    '  background:linear-gradient(135deg,var(--v2-emas),#8a6c28);',
    '  display:flex;align-items:center;justify-content:center;',
    '  font-family:var(--v2-display);font-weight:700;font-size:14px;color:#0b0c0f;}',
    '.v2-merek-teks{min-width:0;}',
    '.v2-merek-teks .a{font-family:var(--v2-display);font-weight:600;font-size:14px;',
    '  letter-spacing:-.02em;white-space:nowrap;color:var(--v2-kertas);}',
    '.v2-merek-teks .b{font-family:var(--v2-angka);font-size:9.5px;letter-spacing:.14em;',
    '  text-transform:uppercase;color:var(--v2-kertas-3);white-space:nowrap;}',
    'body.v2-ciut .v2-merek-teks{display:none;}',

    '.v2-sisi-nav{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px 10px;}',
    '.v2-grup{margin-bottom:18px;}',
    '.v2-grup > span{display:block;padding:0 8px 7px;font-family:var(--v2-angka);font-size:9.5px;',
    '  letter-spacing:.14em;text-transform:uppercase;color:var(--v2-kertas-3);}',
    'body.v2-ciut .v2-grup > span{opacity:0;height:7px;overflow:hidden;}',

    '.v2-tautan{display:flex;align-items:center;gap:11px;padding:9px 10px;margin-bottom:2px;',
    '  border-radius:8px;color:var(--v2-kertas-2);font-size:13.5px;text-decoration:none;',
    '  white-space:nowrap;position:relative;',
    '  transition:background var(--v2-cepat) var(--v2-keluar),color var(--v2-cepat) var(--v2-keluar);}',
    '.v2-tautan svg{width:17px;height:17px;flex:0 0 auto;}',
    '.v2-tautan:hover{background:rgba(255,255,255,.045);color:var(--v2-kertas);}',
    '.v2-tautan.aktif{background:var(--v2-emas-kabut);color:var(--v2-emas);}',
    /* Penanda sisi kiri pada butir aktif - satu-satunya tanda yang tetap
       terbaca saat sidebar diciutkan jadi ikon saja. */
    '.v2-tautan.aktif::before{content:"";position:absolute;left:-10px;top:50%;transform:translateY(-50%);',
    '  width:3px;height:17px;border-radius:0 3px 3px 0;background:var(--v2-emas);}',
    'body.v2-ciut .v2-tautan span{display:none;}',
    'body.v2-ciut .v2-tautan{justify-content:center;padding:11px 0;}',

    /* Tooltip saat diciutkan - tanpa ini, sidebar ikon-saja jadi tebakan. */
    'body.v2-ciut .v2-tautan::after{content:attr(data-label);position:absolute;left:calc(100% + 12px);',
    '  padding:6px 11px;background:var(--v2-panel-2);border:1px solid var(--v2-garis);border-radius:7px;',
    '  font-size:12px;color:var(--v2-kertas);opacity:0;pointer-events:none;',
    '  transform:translateX(-6px);transition:opacity var(--v2-cepat),transform var(--v2-cepat);z-index:90;}',
    'body.v2-ciut .v2-tautan:hover::after{opacity:1;transform:none;}',

    '.v2-sisi-kaki{padding:12px;border-top:1px solid var(--v2-garis);}',
    '.v2-sisi-kaki .v2-catatan{font-size:11px;color:var(--v2-kertas-3);line-height:1.55;}',
    'body.v2-ciut .v2-sisi-kaki .v2-catatan{display:none;}',

    '.v2-ciut-tbl{display:flex;align-items:center;justify-content:center;width:30px;height:30px;',
    '  flex:0 0 auto;background:none;border:1px solid var(--v2-garis);border-radius:8px;',
    '  color:var(--v2-kertas-3);cursor:pointer;',
    '  transition:color var(--v2-cepat),border-color var(--v2-cepat);}',
    '.v2-ciut-tbl:hover{color:var(--v2-emas);border-color:var(--v2-emas-garis);}',
    '.v2-ciut-tbl svg{width:15px;height:15px;}',

    /* HP: sidebar keluar sebagai laci, bukan menyusut. Sidebar ikon-saja di
       layar 375px memakan 68px dari lebar yang sudah sempit - di HP navigasi
       harus PERGI, bukan mengecil. Ini "mobile yang dirancang" (poin 07). */
    '@media (max-width:860px){',
    '  body,body.v2-ciut{padding-left:0;}',
    '  .v2-sisi{transform:translateX(-100%);width:min(84vw,var(--v2-sisi));box-shadow:var(--v2-bayang-l);}',
    '  body.v2-laci .v2-sisi{transform:none;}',
    '  body.v2-ciut .v2-sisi{width:min(84vw,var(--v2-sisi));}',
    '  body.v2-ciut .v2-merek-teks,body.v2-ciut .v2-tautan span,body.v2-ciut .v2-grup>span{display:block;opacity:1;height:auto;}',
    '  body.v2-ciut .v2-tautan{justify-content:flex-start;padding:9px 10px;}',
    '  .v2-tirai{position:fixed;inset:0;z-index:79;background:rgba(0,0,0,.62);',
    '    opacity:0;pointer-events:none;transition:opacity var(--v2-sedang);}',
    '  body.v2-laci .v2-tirai{opacity:1;pointer-events:auto;}',
    '  .v2-buka-laci{position:fixed;top:12px;left:12px;z-index:78;width:42px;height:42px;',
    '    display:flex;align-items:center;justify-content:center;',
    '    background:var(--v2-panel);border:1px solid var(--v2-garis);border-radius:10px;',
    '    color:var(--v2-kertas);cursor:pointer;}',
    '  .v2-buka-laci svg{width:19px;height:19px;}',
    '}',
    '@media (min-width:861px){ .v2-tirai,.v2-buka-laci{display:none;} }'
  ].join('\n');

  function bangun(){
    if(document.querySelector('.v2-sisi')) return;

    /* Halaman lama ditulis TANPA tag <body> di sumbernya (browser yang
       membuatnya sendiri), jadi atribut di <body> tidak bisa dipakai untuk
       menandai halaman. Penanda dibaca dari <meta> lebih dulu, atribut body
       jadi cadangan untuk halaman V2 yang memang punya <body>. */
    var meta = document.querySelector('meta[name="v2-halaman"]');
    var halaman = (meta && meta.getAttribute('content'))
               || document.body.getAttribute('data-v2-halaman')
               || '';

    /* BERANDA TIDAK PAKAI SIDEBAR.

       Halaman depan tugasnya meyakinkan, bukan mengoperasikan. Sidebar berisi
       delapan tautan di sebelah kalimat pembuka justru memecah perhatian dari
       satu hal yang seharusnya dibaca duluan. Navigasinya lewat dua tombol di
       hero; sidebar baru muncul begitu masuk ke halaman kerja.

       Latar bercahaya tetap dipasang - itu bagian dari temanya, bukan bagian
       dari navigasi. */
    if(halaman === 'home'){
      document.body.classList.add('v2-tanpa-sisi');
      pasangLatar();
      window.V2Cangkang = {
        sibuk: function(){}, setPemilik: function(){}, kaki: function(){}
      };
      return;
    }
    document.head.appendChild(gaya);

    var sisi = document.createElement('aside');
    sisi.className = 'v2-sisi';
    sisi.setAttribute('aria-label', 'Navigasi utama');

    var html = ''
      + '<div class="v2-sisi-kepala">'
      +   '<div class="v2-merek">'
      +     '<div class="v2-merek-tanda">JT</div>'
      +     '<div class="v2-merek-teks"><div class="a">Jadi Trader</div><div class="b">Tools</div></div>'
      +   '</div>'
      +   '<button type="button" class="v2-ciut-tbl" id="v2Ciut" title="Ciutkan / lebarkan sidebar" aria-label="Ciutkan sidebar">'
      +     svg('sisi')
      +   '</button>'
      + '</div>'
      + '<nav class="v2-sisi-nav">';

    MENU.forEach(function(g){
      html += '<div class="v2-grup" ' + (g.butir.every(function(b){ return b.pemilikSaja; }) ? 'data-pemilik="1" style="display:none"' : '') + '>';
      html += '<span>' + g.grup + '</span>';
      g.butir.forEach(function(b){
        html += '<a class="v2-tautan' + (b.id === halaman ? ' aktif' : '') + '"'
             +  ' href="' + b.href + '" data-label="' + b.label + '"'
             +  (b.pemilikSaja ? ' data-pemilik="1"' : '') + '>'
             +  svg(b.ikon) + '<span>' + b.label + '</span></a>';
      });
      html += '</div>';
    });

    html += '</nav>'
      + '<div class="v2-sisi-kaki">'
      +   '<div class="v2-catatan" id="v2Kaki">Memuat status…</div>'
      + '</div>';

    sisi.innerHTML = html;
    document.body.insertBefore(sisi, document.body.firstChild);

    var tirai = document.createElement('div');
    tirai.className = 'v2-tirai';
    document.body.insertBefore(tirai, document.body.firstChild);

    var bukaLaci = document.createElement('button');
    bukaLaci.type = 'button';
    bukaLaci.className = 'v2-buka-laci';
    bukaLaci.setAttribute('aria-label', 'Buka menu');
    bukaLaci.innerHTML = svg('sisi');
    document.body.insertBefore(bukaLaci, document.body.firstChild);

    /* ── Ciut manual ──────────────────────────────────────────────────────
       Sekali kamu menekan tombol ini, keputusanmu dicatat dan otomatis
       berhenti ikut campur di layar lebar. */
    var tblCiut = document.getElementById('v2Ciut');
    function terapkan(ciut){ document.body.classList.toggle('v2-ciut', !!ciut); }

    var tersimpan = baca(KUNCI_CIUT);
    if(tersimpan !== null) terapkan(tersimpan === '1');
    else terapkan(window.innerWidth < LEBAR_SEMPIT);

    tblCiut.addEventListener('click', function(){
      var jadiCiut = !document.body.classList.contains('v2-ciut');
      terapkan(jadiCiut);
      tulis(KUNCI_CIUT, jadiCiut ? '1' : '0');
    });

    // Laci di HP
    function tutupLaci(){ document.body.classList.remove('v2-laci'); }
    bukaLaci.addEventListener('click', function(){ document.body.classList.toggle('v2-laci'); });
    tirai.addEventListener('click', tutupLaci);
    sisi.addEventListener('click', function(e){ if(e.target.closest('.v2-tautan')) tutupLaci(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') tutupLaci(); });

    /* ── Ciut otomatis ────────────────────────────────────────────────────
       Hanya jalan kalau kamu belum pernah memutuskan sendiri. */
    var jam = null;
    function otomatisBoleh(){
      if(baca(KUNCI_OTO) === '0') return false;
      if(baca(KUNCI_CIUT) !== null) return false;          // manual menang
      if(window.innerWidth <= 860) return false;           // di HP sudah pakai laci
      if(document.body.classList.contains('v2-sibuk')) return false;  // sedang memindai
      return true;
    }
    function jadwalkan(){
      clearTimeout(jam);
      if(!otomatisBoleh()) return;
      jam = setTimeout(function(){
        if(otomatisBoleh()) terapkan(true);
      }, JEDA_OTO_MS);
    }
    sisi.addEventListener('mouseenter', function(){
      clearTimeout(jam);
      if(baca(KUNCI_CIUT) === null) terapkan(false);   // dekati -> buka lagi
    });
    sisi.addEventListener('mouseleave', jadwalkan);
    window.addEventListener('resize', function(){
      if(baca(KUNCI_CIUT) !== null) return;
      terapkan(window.innerWidth < LEBAR_SEMPIT);
    });
    jadwalkan();

    pasangLatar();

    window.V2Cangkang = {
      /* Dipanggil halaman saat mulai/selesai memindai supaya sidebar tidak
         menutup sendiri di tengah pekerjaan. */
      sibuk: function(ya){ document.body.classList.toggle('v2-sibuk', !!ya); if(!ya) jadwalkan(); },
      /* Dipanggil v2-data.js setelah tahu siapa yang login. */
      setPemilik: function(ya){
        document.querySelectorAll('[data-pemilik="1"]').forEach(function(n){
          n.style.display = ya ? '' : 'none';
        });
      },
      kaki: function(teksHtml){
        var k = document.getElementById('v2Kaki');
        if(k) k.innerHTML = teksHtml;
      }
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bangun);
  else bangun();
})();
