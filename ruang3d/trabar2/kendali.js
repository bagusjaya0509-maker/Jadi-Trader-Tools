/* ════════════════════════════════════════════════════════════════════
   KENDALI JARAK — layar ruangan bersih, panelnya di halaman sendiri
   ════════════════════════════════════════════════════════════════════
   Diminta pemilik 27 Sep 2026: panel Sudut pandang, Setelan kualitas,
   Robot terpilih, dan bilah Bebas / Ikuti robot / Auto tour / Joget
   dipindah ke SATU halaman kontrol yang terpisah, supaya layar Trading
   Floor bersih dari panel.

   ── KENAPA DICERMINKAN, BUKAN DIPINDAHKAN ────────────────────────────
   Panelnya TETAP tinggal di halaman ini, cuma disembunyikan. Halaman
   kontrol (kontrol.html) menampilkan salinannya, dan setiap klik, geser,
   atau pilihan di sana dikirim balik ke sini lalu dijalankan pada elemen
   ASLINYA — jadi penangan di main.js yang menjawab, persis seperti kalau
   tombolnya ditekan di sini.

   Dua jalan lain sudah ditimbang dan ditolak:

   1. Menulis ulang tiap kontrol sebagai perintah bernama (ganti-sudut,
      atur-bayangan, ...). main.js memasang puluhan penangan langsung ke
      elemennya. Menerjemahkan semuanya berarti puluhan kesempatan
      berselisih, dan tiap kontrol baru wajib diingat untuk diterjemahkan
      juga — yang terlupa jadi tombol yang tidak melakukan apa-apa.
   2. Memindahkan simpul DOM-nya ke jendela lain (adoptNode). Penangannya
      ikut pindah, tapi main.js mencari elemennya lewat
      `document.querySelector` di setiap bingkai. Begitu simpulnya pindah
      dokumen pencariannya pulang null, dan updateUI() melempar galat di
      setiap bingkai. Kalau jendela kontrol ditutup, panelnya ikut musnah.

   Cermin tidak punya dua masalah itu. Halaman kontrol ditutup, macet,
   atau tidak pernah dibuka — ruangan ini tidak merasakan apa-apa. Dan
   kontrol baru yang kelak ditambahkan ke panel ikut tercermin sendiri.

   ── SALURANNYA ──────────────────────────────────────────────────────
   BroadcastChannel: satu asal, satu peramban, tanpa server. Dua sisi
   saling menemukan walau dimuat ulang bergantian, dan tidak bergantung
   pada `window.opener` — jadi halaman kontrol boleh dibuka dari markah,
   dan ruangan yang ditanam iframe di /trading-floor ikut terkendali.
   ════════════════════════════════════════════════════════════════════ */

const KANAL = 'jt-trabar2-kendali';
const NAMA_JENDELA = 'jt-trabar2-kontrol';
const KUNCI_BERSIH = 'jt.trabar.layarBersih';

/* Akar yang dicerminkan. Nama di kiri dipakai halaman kontrol untuk
   menaruhnya; selektor di kanan menunjuk elemen asli di halaman ini. */
const AKAR = {
  kamera: '.director',
  /* Menu joget tinggal DI DALAM bilah kamera (popover di atas tombol
     Joget), tapi di halaman kontrol ia kartu sendiri. Dicerminkan dua
     kali: salinan di dalam bilah kamera disembunyikan di sana. */
  joget: '#joget-menu',
  kameraInfo: '.camera-info',
  sudut: '.view-panel',
  robot: '.npc-panel',
  mutu: '#mutu-panel',
  objek: '#object-mode',
  status: '.sim-label',
  toast: '#toast',
};

const html = document.documentElement;
/* Mode latar (?latar=1) punya aturan sembunyi-tampilnya sendiri yang
   dikendalikan halaman induknya. Layar bersih tidak ikut campur di sana. */
const modeLatar = new URLSearchParams(location.search).has('latar');
const saya = Math.random().toString(36).slice(2, 10);
const ch = 'BroadcastChannel' in window ? new BroadcastChannel(KANAL) : null;
let terkirim = {}, kontrolTerakhir = 0;

function bacaBersih() { try { return localStorage.getItem(KUNCI_BERSIH) !== '0'; } catch (e) { return true; } }
function setBersih(v, simpan = true) {
  html.classList.toggle('bersih', !!v);
  if (simpan) try { localStorage.setItem(KUNCI_BERSIH, v ? '1' : '0'); } catch (e) { /* tetap berlaku sesi ini */ }
  halo();
}

/* ── POTRET ───────────────────────────────────────────────────────────
   cloneNode menyalin ATRIBUT, bukan keadaan. Nilai geseran, pilihan
   select, dan centang yang diubah skrip sesudah halaman dimuat tidak ada
   di atribut mana pun — jadi dibaca dari elemen aslinya lalu ditempel ke
   salinan sebagai data-kd-*. */
function potret(el) {
  const c = el.cloneNode(true);
  const asal = el.querySelectorAll('input,select,textarea');
  const salin = c.querySelectorAll('input,select,textarea');
  asal.forEach((x, i) => {
    const y = salin[i];
    if (x.type === 'checkbox' || x.type === 'radio') y.setAttribute('data-kd-cek', x.checked ? '1' : '0');
    else y.setAttribute('data-kd-nilai', x.value);
  });
  /* Panel setelan kualitas tertutup di sini (atribut hidden), tapi di
     halaman kontrol semua panel selalu terbuka. */
  c.removeAttribute('hidden');
  return c.outerHTML;
}

function kirimPotret(penuh = false) {
  if (!ch) return;
  const isi = {};
  let ada = false;
  for (const [nama, sel] of Object.entries(AKAR)) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const h = potret(el);
    if (penuh || terkirim[nama] !== h) { isi[nama] = h; terkirim[nama] = h; ada = true; }
  }
  if (ada) ch.postMessage({ t: 'potret', dari: saya, isi, penuh });
}

function halo() {
  ch?.postMessage({
    t: 'halo', dari: saya, latar: modeLatar,
    bersih: html.classList.contains('bersih'),
    /* #loading diberi kelas done saat siap, lalu dicabut 0,8 detik
       kemudian — dua-duanya berarti ruangan sudah jalan. */
    siap: !document.getElementById('loading') || !!document.querySelector('#loading.done'),
  });
}

/* ── MENJALANKAN AKSI DARI HALAMAN KONTROL ────────────────────────────
   Alamat elemennya berupa deret indeks anak dari akarnya, dan nama
   tagnya ikut dikirim sebagai pagar. Kalau DOM di sini sudah berubah
   sejak potret terakhir (daftar dompet digambar ulang, misalnya), aksi
   itu lebih baik jatuh diam daripada menekan tombol yang salah. */
function cari(m) {
  const sel = AKAR[m.akar];
  if (!sel || !Array.isArray(m.jalur)) return null;
  let el = document.querySelector(sel);
  for (const i of m.jalur) { el = el?.children[i]; if (!el) return null; }
  return el && el.tagName === m.tag ? el : null;
}

function jalankan(m) {
  const el = cari(m);
  if (!el) return;
  if (m.jenis === 'click') {
    /* Ikon di dalam tombol berupa SVG, dan SVGElement tidak punya
       .click(). Naik sampai ketemu yang punya. */
    let x = el;
    while (x && typeof x.click !== 'function') x = x.parentElement;
    x?.click();
  } else if ((m.jenis === 'input' || m.jenis === 'change') && 'value' in el) {
    if (el.value !== m.nilai) el.value = m.nilai;
    el.dispatchEvent(new Event(m.jenis, { bubbles: true }));
  }
  setTimeout(() => kirimPotret(), 40);
}

if (ch) {
  ch.onmessage = ({ data: m }) => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'kontrol') {
      if (m.ke && m.ke !== saya) return;
      kontrolTerakhir = Date.now();
      if (m.minta) { halo(); kirimPotret(true); }
      return;
    }
    if (m.ke !== saya) return;
    kontrolTerakhir = Date.now();
    if (m.t === 'aksi') jalankan(m);
    else if (m.t === 'layar' && !modeLatar) setBersih(!!m.bersih);
  };
  setInterval(halo, 1000);
  /* Potret dikirim hanya selama ada halaman kontrol yang mendengar.
     Tanpa pendengar, menyalin delapan panel lima kali sedetik cuma
     membakar waktu yang seharusnya dipakai menggambar ruangan. */
  setInterval(() => { if (Date.now() - kontrolTerakhir < 4000) kirimPotret(); }, 200);
  addEventListener('pagehide', () => ch.postMessage({ t: 'pamit', dari: saya }));
}

if (!modeLatar) setBersih(bacaBersih(), false);
else halo();

/* ── MEMBUKA HALAMAN KONTROL ──────────────────────────────────────────
   Dipicu ikon gerigi di pojok kanan atas, meniru tombol lepas panel di
   multi chart (Chart & Entry): satu klik, halamannya berdiri di jendela
   sendiri. Jendela bernama: menekan Kontrol untuk kedua kalinya memunculkan
   jendela yang sudah ada, tidak membuka yang baru dan tidak memuat
   ulangnya. Kalau popup ditolak peramban, tautan <a target> di tombolnya
   tetap bekerja sendiri — terbuka sebagai tab, bukan gagal diam-diam. */
function bukaKontrol(e) {
  const w = window.open('', NAMA_JENDELA, 'popup,width=1320,height=920');
  if (!w) return;
  e?.preventDefault();
  let di = '';
  try { di = w.location.href; } catch (_) { /* jendela lintas-asal: arahkan ulang */ }
  if (!di.includes('/kontrol.html')) w.location.href = new URL('./kontrol.html', location.href).href;
  w.focus();
}
document.getElementById('kontrol-btn')?.addEventListener('click', bukaKontrol);

addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (document.getElementById('help')?.open) return;
  const k = e.key.toLowerCase();
  if (k === 'k') bukaKontrol();
  else if (k === 'p' && !modeLatar) setBersih(!html.classList.contains('bersih'));
});
