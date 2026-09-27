/* ════════════════════════════════════════════════════════════════════
   HALAMAN KONTROL TRADING FLOOR
   ════════════════════════════════════════════════════════════════════
   Pasangan kendali.js. Halaman ini tidak memegang logika ruangan sama
   sekali: ia menampilkan potret panel yang dikirim ruangan, lalu
   mengirim balik setiap klik, geseran, dan pilihan untuk dijalankan di
   sana pada elemen aslinya. Alasan memilih cermin, bukan perintah
   bernama, ada di kepala kendali.js.
   ════════════════════════════════════════════════════════════════════ */

const KANAL = 'jt-trabar2-kendali';
const ch = new BroadcastChannel(KANAL);
const $ = (s) => document.querySelector(s);
const slot = {};
document.querySelectorAll('[data-akar]').forEach((s) => { slot[s.dataset.akar] = s; });

let lantai = null, lantaiDengar = 0, pernahPotret = false;
/* Elemen yang baru disentuh di SINI. Potret dari ruangan tiba ±200 ms
   di belakang; tanpa jeda ini geseran yang sedang diseret melompat
   mundur ke nilai lamanya, dan huruf yang sedang diketik tertimpa. */
let sentuh = { el: null, t: 0 };
const JEDA_SENTUH = 1500;

/* ── GAYA PANEL DIPAKAI ULANG, TANPA BLOK LAYAR SEMPIT ────────────────
   Panel di sini memakai style.css milik ruangan apa adanya — menyalinnya
   berarti dua salinan yang pelan-pelan berselisih. Tapi style.css ditulis
   untuk panel yang MENGAMBANG di atas ruangan 3D: di bawah 760 px ia
   mengecilkan panel sudut pandang jadi kolom ikon tanpa tulisan, dan di
   bawah 1100 px menyempitkan panel robot. Di halaman ini lebar jendela
   tidak ada hubungannya dengan ruang di atas kanvas, jadi blok
   @media(max-width/max-height) dibuang sebelum gayanya dipasang.
   Tata letak halaman ini sendiri diurus kontrol.css. */
async function muatGaya() {
  const bersihkan = (css) => css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@media\s*\((?:max-width|max-height)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const teks = await Promise.all(['./style.css', './panel.css'].map((u) =>
    fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.text() : '')).catch(() => '')));
  const st = document.createElement('style');
  st.textContent = teks.map(bersihkan).join('\n');
  document.head.insertBefore(st, document.getElementById('kd-gaya'));
}
muatGaya();

/* ── SAMBUNGAN ────────────────────────────────────────────────────────
   Detak tiap detik. Selama belum punya ruangan, detaknya meminta semua
   ruangan yang terbuka memperkenalkan diri; yang pertama menjawab
   dipegang. Kalau ruangan itu diam 3,5 detik (ditutup, dimuat ulang,
   tabnya dibekukan peramban), pegangannya dilepas dan pencarian mulai
   lagi — ruangan yang dimuat ulang tersambung kembali sendiri. */
function kirim(m) { ch.postMessage(m); }
function detak() { kirim({ t: 'kontrol', ke: lantai, minta: !lantai }); }

function tampilStatus(k) {
  const el = $('#kd-status');
  el.dataset.k = k;
  el.textContent = {
    tersambung: 'Tersambung ke ruangan',
    memuat: 'Tersambung — ruangan masih memuat',
    hilang: 'Ruangan tidak terbuka',
    tunggu: 'Mencari ruangan…',
  }[k];
  const putus = k === 'hilang' || k === 'tunggu';
  document.body.classList.toggle('kd-putus', putus);
  $('#kd-kosong').hidden = !(putus && !pernahPotret);
}

setInterval(() => {
  if (lantai && Date.now() - lantaiDengar > 3500) { lantai = null; tampilStatus('hilang'); }
  detak();
}, 1000);
setTimeout(() => { if (!lantai) tampilStatus('hilang'); }, 2500);
tampilStatus('tunggu');
detak();

ch.onmessage = ({ data: m }) => {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'halo') {
    if (!lantai) { lantai = m.dari; kirim({ t: 'kontrol', ke: lantai, minta: true }); }
    if (m.dari !== lantai) return;
    lantaiDengar = Date.now();
    const s = $('#kd-panel-ruang');
    s.checked = !m.bersih;
    s.disabled = !!m.latar;
    tampilStatus(m.siap ? 'tersambung' : 'memuat');
    return;
  }
  if (m.dari !== lantai) return;
  if (m.t === 'potret') {
    lantaiDengar = Date.now();
    for (const [nama, h] of Object.entries(m.isi || {})) pasang(nama, h);
    if (!pernahPotret) { pernahPotret = true; $('#kd-kosong').hidden = true; }
  } else if (m.t === 'pamit') {
    lantai = null;
    tampilStatus('hilang');
  }
};

$('#kd-panel-ruang').addEventListener('change', (e) => {
  if (lantai) kirim({ t: 'layar', ke: lantai, bersih: !e.target.checked });
});

/* ── MEMASANG POTRET ──────────────────────────────────────────────────
   Tidak pernah innerHTML utuh. Mengganti seluruh panel lima kali sedetik
   menutup dropdown yang sedang dibuka, mereset posisi gulir daftar lagu,
   dan melepas fokus dari isian. Yang dilakukan: menyamakan simpul demi
   simpul, dan hanya menyentuh yang memang berbeda. */
function pasang(nama, h) {
  const s = slot[nama];
  if (!s) return;
  const t = document.createElement('template');
  t.innerHTML = String(h).trim();
  const baru = t.content.firstElementChild;
  if (!baru) return;
  const lama = s.firstElementChild;
  if (!lama || lama.tagName !== baru.tagName) {
    const n = document.importNode(baru, true);
    s.replaceChildren(n);
    terapkanNilai(n);
    return;
  }
  samakan(lama, baru);
}

function baruDisentuh(el) { return sentuh.el === el && Date.now() - sentuh.t < JEDA_SENTUH; }

function nilaiDari(a, b) {
  if (baruDisentuh(a)) return;
  if (b.hasAttribute('data-kd-cek')) a.checked = b.getAttribute('data-kd-cek') === '1';
  else if (b.hasAttribute('data-kd-nilai')) {
    const v = b.getAttribute('data-kd-nilai');
    if (a.value !== v) a.value = v;
  }
}
function terapkanNilai(akar) {
  const daftar = akar.matches?.('input,select,textarea') ? [akar] : [];
  akar.querySelectorAll?.('input,select,textarea').forEach((e) => daftar.push(e));
  daftar.forEach((e) => nilaiDari(e, e));
}

function samakan(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) {
    const n = document.importNode(b, true);
    a.replaceWith(n);
    if (n.nodeType === 1) terapkanNilai(n);
    return;
  }
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  /* `open` milik halaman ini: <details> Warna robot dan Atur auto tour
     dibuka-tutup di sini, tidak dipaksa ikut keadaannya di ruangan. */
  for (const at of [...a.attributes]) if (at.name !== 'open' && !b.hasAttribute(at.name)) a.removeAttribute(at.name);
  for (const at of b.attributes) if (at.name !== 'open' && a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') { nilaiDari(a, b); return; }
  const ac = a.childNodes, bc = b.childNodes;
  for (let i = 0; i < bc.length; i++) {
    if (i < ac.length) samakan(ac[i], bc[i]);
    else { const n = document.importNode(bc[i], true); a.appendChild(n); if (n.nodeType === 1) terapkanNilai(n); }
  }
  while (ac.length > bc.length) a.lastChild.remove();
  if (a.tagName === 'SELECT') nilaiDari(a, b);
}

/* ── MENGIRIM AKSI ────────────────────────────────────────────────────
   Alamat elemen = deret indeks anak dari akar panelnya. Struktur di sini
   salinan persis struktur di ruangan, jadi deret yang sama menunjuk
   elemen yang sama di sana. */
function jalur(el, akarEl) {
  const j = [];
  while (el && el !== akarEl) {
    const p = el.parentElement;
    if (!p) return null;
    j.unshift(Array.prototype.indexOf.call(p.children, el));
    el = p;
  }
  return el === akarEl ? j : null;
}

function aksi(jenis, el) {
  const s = el.closest('[data-akar]');
  if (!s || !lantai) return;
  const akarEl = s.firstElementChild;
  if (!akarEl || !akarEl.contains(el)) return;
  const j = jalur(el, akarEl);
  if (!j) return;
  const m = { t: 'aksi', ke: lantai, akar: s.dataset.akar, jalur: j, tag: el.tagName, jenis };
  if (jenis !== 'click') m.nilai = el.value;
  kirim(m);
}

const CENTANG = 'input[type=checkbox],input[type=radio]';
const ISIAN = 'select,textarea,input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])';

document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof Element) || !t.closest('[data-akar]')) return;
  if (t.closest('a[href]') || t.closest('summary')) return;
  let el = t;
  while (el && !(el instanceof HTMLElement)) el = el.parentElement;
  if (!el) return;
  /* Klik pada tulisan label: peramban sendiri akan menembakkan klik
     kedua ke kotak centangnya. Yang kedua itu yang dikirim — mengirim
     keduanya berarti centangnya dibalik dua kali, alias tidak berubah. */
  /* Tombol Joget di ruangan membuka menu popover di atasnya. Di sini
     menunya sudah terbentang sebagai kartu sendiri, jadi tombolnya
     menunjuk ke sana alih-alih membuka popover yang tidak terlihat. */
  if (el.closest('#joget-btn') && el.closest('[data-akar="kamera"]')) {
    const k = document.getElementById('kd-joget');
    k.scrollIntoView({ behavior: 'smooth', block: 'center' });
    k.classList.remove('kd-sorot'); void k.offsetWidth; k.classList.add('kd-sorot');
    return;
  }
  const lab = el.closest('label');
  if (lab && lab.control && !el.matches('input,select,textarea,button')) return;
  if (el.matches(ISIAN)) return; // lewat input/change di bawah
  sentuh = { el, t: Date.now() };
  aksi('click', el);
}, true);

for (const jenis of ['input', 'change']) {
  document.addEventListener(jenis, (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.closest('[data-akar]') || el.matches(CENTANG)) return;
    sentuh = { el, t: Date.now() };
    aksi(jenis, el);
  }, true);
}

/* Enter di isian teks (nama sudut) menekan tombol di sebelahnya — di
   ruangan, Enter itu ditangani pendengar keydown yang tidak ikut
   tercermin. */
document.addEventListener('keydown', (e) => {
  const el = e.target;
  if (e.key !== 'Enter' || !(el instanceof HTMLInputElement) || el.type !== 'text' || !el.closest('[data-akar]')) return;
  const tombol = el.parentElement?.querySelector('button');
  if (!tombol) return;
  e.preventDefault();
  aksi('input', el);
  sentuh = { el: null, t: 0 }; // biarkan isian dikosongkan ruangan sesudah tersimpan
  aksi('click', tombol);
});
