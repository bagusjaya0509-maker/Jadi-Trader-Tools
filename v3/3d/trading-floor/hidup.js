/* Data hidup untuk ruang trabar.

   Dua jalur yang berdiri sendiri — kalau salah satu mati, ruangan tetap
   berjalan memakai data sintetis lama:

   1. Harga Hyperliquid (publik, CORS terbuka) untuk semua layar monitor.
   2. Kartu copy trade dari /api/ruang/potret milik sendiri. Jalur ini butuh
      token pemilik, jadi hanya hidup di https://jaditrader.co.id/trabar/
      tempat potongan Firebase disuntikkan saat pengiriman.

   Tidak ada kunci bursa di sini dan tidak boleh ada: halaman ini hanya
   membaca. */

const HL = 'https://api.hyperliquid.xyz/info';

/* Dinding pasar memakai ketiganya. */
export const TRIO = ['BTC', 'ETH', 'SOL'];

/* ── SATU KOIN UNTUK TIAP LAYAR ─────────────────────────────────────────
   Diminta pemilik 10 Sep 2026: tidak boleh ada dua monitor yang menggambar
   grafik yang sama. Sebelumnya seluruh ruangan cuma punya tiga tekstur yang
   dipakai bergantian, jadi dua belas monitor menampilkan tiga grafik.

   Ketiga koin dinding TIDAK ikut di daftar ini — kalau ikut, dindingnya
   sendiri yang mengulang salah satu monitor. Urutannya dari yang paling
   dikenal, jadi layar yang paling sering masuk kamera membawa nama yang
   langsung terbaca. Semuanya sudah dipastikan ada di Hyperliquid. */
export const KOIN_LAYAR = ['HYPE', 'BNB', 'XRP', 'DOGE', 'LINK', 'AVAX',
  'LTC', 'SUI', 'AAVE', 'ZEC', 'FARTCOIN', 'ENA', 'INJ', 'NEAR'];

/** Yang boleh dipilih dari menu klik kanan pada monitor. */
export const KOIN_PILIHAN = [...TRIO, ...KOIN_LAYAR];

/* Nama interval ditulis persis seperti yang diterima Hyperliquid. `menit`
   dipakai menghitung rentang yang diminta — 56 lilin untuk tiap timeframe,
   jadi bentuk grafiknya tetap sama padatnya di 1 menit maupun 1 hari. */
export const TF = [
  {id: '1m', label: '1m', menit: 1},
  {id: '5m', label: '5m', menit: 5},
  {id: '15m', label: '15m', menit: 15},
  {id: '1h', label: '1H', menit: 60},
  {id: '4h', label: '4H', menit: 240},
  {id: '1d', label: '1D', menit: 1440},
];
export const TF_BAWAAN = '1m';
const menitTf = (tf) => (TF.find(t => t.id === tf) || TF[0]).menit;

/** 'BTC|1m' -> {koin, tf, lilin:[{t,o,h,l,c,v}], harga, tampil, awal} */
export const pasar = Object.create(null);
export const kabar = {pasarHidup: false, galat: null, diperbarui: 0, kartuGalat: null};

/* BERKUNCI KOIN + TIMEFRAME.
   Berkunci koin saja terlihat cukup sampai dua layar memegang koin yang sama
   dengan timeframe berbeda — lalu yang satu menyajikan lilin milik yang lain
   tanpa satu pun galat, dan yang terbaca cuma "grafiknya kok begitu". */
export const kunciPasar = (koin, tf) => koin + '|' + tf;

async function tanya(isi) {
  const r = await fetch(HL, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(isi),
  });
  if (!r.ok) throw new Error('hyperliquid ' + r.status);
  return r.json();
}

async function muatLilin(koin, tf) {
  const kini = Date.now(), m = menitTf(tf);
  const d = await tanya({type: 'candleSnapshot', req: {
    coin: koin, interval: tf, startTime: kini - 60 * m * 60000, endTime: kini,
  }});
  const lilin = (d || []).slice(-56).map(c => ({
    t: c.t, o: +c.o, h: +c.h, l: +c.l, c: +c.c, v: +c.v || 0,
  })).filter(c => isFinite(c.c) && c.c > 0);
  if (!lilin.length) throw new Error('lilin kosong: ' + koin + ' ' + tf);
  const k = kunciPasar(koin, tf);
  const p = pasar[k] || (pasar[k] = {koin, tf});
  p.lilin = lilin;
  p.harga = lilin[lilin.length - 1].c;
  p.awal = lilin[0].o;
  if (!isFinite(p.tampil)) p.tampil = p.harga;
  kabar.pasarHidup = true;
  kabar.diperbarui = Date.now();
}

/* Harga tengah tiap beberapa detik. Lilin paling kanan ikut ditarik supaya
   batangnya benar-benar tumbuh, bukan cuma angkanya yang berganti. Satu
   permintaan menutup SEMUA koin, berapa pun timeframe yang sedang dipakai. */
async function tarikHarga() {
  const mids = await tanya({type: 'allMids'});
  for (const p of Object.values(pasar)) {
    const v = +mids[p.koin];
    if (!isFinite(v) || !v || !p.lilin) continue;
    p.harga = v;
    const akhir = p.lilin[p.lilin.length - 1];
    akhir.c = v;
    if (v > akhir.h) akhir.h = v;
    if (v < akhir.l) akhir.l = v;
  }
  kabar.diperbarui = Date.now();
}

/** Mendaftarkan satu pasangan koin+timeframe, dan menariknya SEKARANG kalau
 *  ia baru. Layar yang baru diganti tidak boleh menunggu putaran menit
 *  berikutnya cuma untuk memperlihatkan grafik pertamanya. */
export function langgan(koin, tf = TF_BAWAAN) {
  const k = kunciPasar(koin, tf);
  if (!pasar[k]) {
    pasar[k] = {koin, tf};
    void muatLilin(koin, tf).catch(() => { /* putaran berikutnya mencoba lagi */ });
  }
  return k;
}

let jalan = false;
export async function mulaiPasar() {
  if (jalan) return;
  jalan = true;
  /* Berombongan berempat, bukan semuanya sekaligus. Hyperliquid membatasi
     laju per alamat, dan satu ledakan permintaan di detik pertama membuat
     sebagian pulang dengan tangan kosong — layar yang memegangnya lalu diam
     memakai grafik sintetis sampai putaran berikutnya. */
  const segar = async () => {
    const daftar = Object.values(pasar);
    for (let i = 0; i < daftar.length; i += 4) {
      await Promise.all(daftar.slice(i, i + 4).map(p => muatLilin(p.koin, p.tf).catch(() => {})));
    }
    kabar.galat = null;
  };
  await segar();
  setInterval(segar, 60000);
  setInterval(() => tarikHarga().catch(e => { kabar.galat = e.message; }), 3000);
}

/** Angka besar yang dikejar perlahan supaya tidak melompat tiap kedipan. */
export function detak(dt) {
  for (const p of Object.values(pasar)) {
    if (!isFinite(p.harga)) continue;
    if (!isFinite(p.tampil)) { p.tampil = p.harga; continue; }
    p.tampil += (p.harga - p.tampil) * Math.min(1, dt * 3.2);
  }
}

/** Lilin dalam bentuk yang sama dengan marketSeries() sintetis. */
export function deret(koin, tf = TF_BAWAAN, jumlah = 48) {
  const p = pasar[kunciPasar(koin, tf)];
  if (!p || !p.lilin || p.lilin.length < 6) return null;
  const potong = p.lilin.slice(-jumlah);
  const puncak = Math.max(...potong.map(c => c.v)) || 1;
  return potong.map(c => ({
    open: c.o, high: c.h, low: c.l, close: c.c,
    volume: 1.5 + (c.v / puncak) * 7, t: c.t,
  }));
}

export function harga(koin, tf = TF_BAWAAN) {
  const p = pasar[kunciPasar(koin, tf)];
  return p && isFinite(p.tampil) ? p.tampil : null;
}

export function ubah(koin, tf = TF_BAWAAN) {
  const p = pasar[kunciPasar(koin, tf)];
  if (!p || !isFinite(p.harga) || !p.awal) return null;
  return (p.harga - p.awal) / p.awal * 100;
}

export function angka(v) {
  if (v === null) return '—';
  const desimal = v >= 1000 ? 2 : v >= 10 ? 3 : 4;
  return v.toLocaleString('en-US', {minimumFractionDigits: desimal, maximumFractionDigits: desimal});
}

export function jam(d = new Date()) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* ── Jalur kedua: PAPAN PERINGKAT ANALIS ────────────────────────────────
   Pemainnya bukan kartu copy wallet, melainkan analis yang LOLOS AMBANG
   papan peringkat (10 Sep 2026, pemilik). Papan itu superset dari dompet
   salin: tiap dompet yang diterbitkan jadi analis punya uid `agen:dompet-…`
   dan ikut dinilai dengan aturan yang sama seperti agen dan orang.

   Dua rute, keduanya TERBUKA tanpa token — itu yang membuat ruangan ini
   bisa dikerjakan di localhost dengan data sungguhan:
     /api/analisa/performa  → siapa yang layak + rekam jejaknya
     /api/analisa           → daftar sinyal; yang `hasil`-nya kosong = hidup

   Ambangnya TIDAK dihitung ulang di sini. Server yang memutuskan `layak`,
   dan aturan yang ditulis di dua tempat suatu hari akan berbeda — yang
   berbeda di sini menentukan siapa yang muncul sebagai robot. */

/* Halaman ini dilayani dari jaditrader.co.id saat tayang, tapi saat
   dikerjakan ia hidup di localhost. Kedua rute di atas mengizinkan
   lintas-asal, jadi cukup alamatnya yang berpindah. */
export const DASAR = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
  ? 'https://jaditrader.co.id' : '';

async function ambilJson(jalur) {
  const r = await fetch(DASAR + jalur);
  if (!r.ok) throw new Error(jalur + ' → ' + r.status);
  return r.json();
}

/* /api/analisa itu 260 KB — seluruh daftar analisa, bukan cuma yang hidup.
   Ruangan ini dibuat untuk ditinggal menyala berjam-jam saat siaran, jadi
   menariknya tiap menit berarti ratusan megabita sehari untuk data yang
   berubah beberapa kali saja. Papan peringkatnya sendiri (8 KB) tetap tiap
   menit; daftar sinyal disimpan tiga menit. */
const SIMPAN_SINYAL = 3 * 60000;
let sinyalCache = null, sinyalWaktu = 0;

/** Sinyal hidup per uid. `hasil` kosong = belum tp/sl/batal. */
async function sinyalHidup() {
  if (sinyalCache && Date.now() - sinyalWaktu < SIMPAN_SINYAL) return sinyalCache;
  const d = await ambilJson('/api/analisa');
  const peta = new Map();
  for (const x of (d.daftar || [])) {
    if (x.hasil) continue;
    const daftar = peta.get(x.uid) || [];
    daftar.push({
      pasangan: x.pasangan || '', arah: String(x.arah || '').toUpperCase(),
      tf: x.tf || '', pasar: x.pasar || '', dibuat: Number(x.dibuat) || 0,
      terisi: !!x.terisi,
    });
    peta.set(x.uid, daftar);
  }
  for (const daftar of peta.values()) daftar.sort((a, b) => b.dibuat - a.dibuat);
  sinyalCache = peta; sinyalWaktu = Date.now();
  return peta;
}

/* PnL BERJALAN — tambahan, bukan syarat.
   ──────────────────────────────────────────────────────────────────────
   Daftar analisa publik sengaja menyembunyikan harga entry sinyal yang
   masih hidup (`harga: 0`), jadi nilai mengambangnya TIDAK bisa dihitung
   dari sana. Yang punya angkanya cuma potret pemilik: tiap dompet salin
   membawa `berjalan` dari potret bursanya sendiri.

   Karena itu rute ini dicoba dan boleh gagal. Di localhost ia memang selalu
   gagal — tidak ada sesi pemilik di sana — dan panelnya menulis "—" alih-
   alih angka karangan. Dipadankan lewat NAMA, bukan uid: kartu menyimpan
   `nama` dompet dan papan peringkat memakai nama yang sama persis. */
async function pnlBerjalan() {
  if (typeof window.RUANG_TOKEN !== 'function') return null;
  try {
    const token = await window.RUANG_TOKEN();
    const r = await fetch(DASAR + '/api/ruang/potret', {headers: {authorization: 'Bearer ' + token}});
    if (!r.ok) return null;
    const d = await r.json();
    const kartu = (d.potret && d.potret.kartu) || [];
    const peta = new Map();
    for (const k of kartu) if (k.nama) peta.set(k.nama, Number(k.berjalan) || 0);
    return peta.size ? peta : null;
  } catch { return null; }
}

/** Analis yang layak masuk papan, terurut dari cuan terbesar. */
export async function daftarAnalis() {
  const [perf, hidup, berjalan] = await Promise.all([
    ambilJson('/api/analisa/performa'),
    sinyalHidup().catch(() => new Map()),
    pnlBerjalan(),
  ]);
  if (perf.contoh) throw new Error('papan peringkat sedang memulangkan data contoh');
  const layak = (perf.analis || []).filter(a => a.layak);
  if (!layak.length) throw new Error('belum ada analis yang lolos ambang papan');
  return layak
    .map(a => ({
      uid: a.uid, nama: a.nama || 'Analis', agen: !!a.agen,
      pnl: Number(a.hasilDolar) || 0,
      menang: Number(a.menang) || 0, kalah: Number(a.kalah) || 0,
      total: Number(a.total) || 0, winrate: Number(a.winrate) || 0,
      dd: Number(a.ddPersen) || 0, terakhir: Number(a.terakhir) || 0,
      sinyal: hidup.get(a.uid) || [],
      /* null = tidak bisa ditanyakan, BUKAN nol. Dua jawaban berbeda, dan
         panelnya harus bisa membedakannya. */
      berjalan: berjalan && berjalan.has(a.nama) ? berjalan.get(a.nama) : null,
    }))
    .sort((x, y) => y.pnl - x.pnl);
}

export function uang(v, tanda = true) {
  const n = Number(v) || 0;
  const s = Math.abs(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return (tanda ? (n > 0 ? '+$' : n < 0 ? '−$' : '$') : '$') + s;
}
