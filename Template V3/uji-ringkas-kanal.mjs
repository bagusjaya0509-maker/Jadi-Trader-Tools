/* Membuktikan bahwa angka di kartu analis Copy Signal DITURUNKAN dengan
   benar dari sinyal yang sudah terjadi.

   Kenapa dijaga uji, bukan dilihat sekilas di layar: kartu itu menyebut
   winrate, gaya trading, dan tingkat risiko seseorang, lalu orang lain
   memakainya memutuskan sinyal siapa yang ia tiru dengan uang sungguhan.
   Salah hitung di sini tidak terlihat rusak — ia terlihat seperti fakta.

   Tiga jebakan yang paling mudah masuk diam-diam:
     1. Order LIMIT yang harganya SUDAH tersentuh ikut terhitung "pending",
        sehingga layar menjanjikan peluang yang sebenarnya sudah lewat.
     2. Sinyal 'batal' ikut masuk penyebut winrate — pembatalan jadi
        terbaca sebagai kekalahan, dan analis yang jujur menarik rencananya
        malah dihukum.
     3. Drawdown dihitung menurut urutan kunci objek, bukan urutan tanggal.

   Sumbernya dibaca LANGSUNG lewat esbuild, bukan disalin tangan: salinan
   tangan akan tetap lulus walau berkas aslinya berubah.

   Jalankan: node uji-ringkas-kanal.mjs */

import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const sumber = readFileSync(new URL('./src/lib/ringkas-kanal.ts', import.meta.url), 'utf8');
const js = transformSync(sumber, { loader: 'ts', format: 'esm' }).code;
const { ringkasKanal } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

let lulus = 0, gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (ok) { lulus++; return; }
  gagal++;
  console.log(`GAGAL  ${nama}\n   dapat ${JSON.stringify(dapat)}\n   harap ${JSON.stringify(harap)}`);
};

/** Satu sinyal publik seadanya — hanya medan yang dipakai ringkasKanal. */
const s = (o) => ({
  id: 'x', uid: 'u', nama: 'A', judul: '', pasangan: 'BTCUSDT', arah: 'BUY',
  harga: 0, ringkas: '', dibuat: 1_700_000_000_000, jumlahPembeli: 0, ...o,
});

/* ── Hitungan dasar ─────────────────────────────────────────────────── */
{
  const r = ringkasKanal([
    s({ hasil: 'tp' }), s({ hasil: 'tp' }), s({ hasil: 'sl' }),
    s({ hasil: 'batal' }),
    s({ terisi: true }),                            // berjalan
    s({ jenisEntry: 'Buy Limit', terisi: false }),   // menggantung
    s({ jenisEntry: 'Market' }),                     // market -> berjalan
  ], null, 10);
  cek('total', r.total, 7);
  cek('profit', r.profit, 2);
  cek('rugi', r.rugi, 1);
  cek('batal', r.batal, 1);
  cek('pending', r.pending, 1);
  cek('berjalan', r.berjalan, 2);
  cek('winrate 2 dari 3', Math.round(r.winrate * 10) / 10, 66.7);
}

/* ── Jebakan 1: limit yang sudah terisi BUKAN pending ────────────────── */
cek('limit terisi -> berjalan',
  (() => { const r = ringkasKanal([s({ jenisEntry: 'Buy Limit', terisi: true })], null, 10);
           return [r.pending, r.berjalan]; })(), [0, 1]);

/* ── Jebakan 2: batal di luar winrate ────────────────────────────────── */
cek('batal tidak menurunkan winrate',
  ringkasKanal([s({ hasil: 'tp' }), s({ hasil: 'batal' })], null, 10).winrate, 100);

/* ── Belum ada yang selesai: null, BUKAN nol ─────────────────────────
   Nol terbaca sebagai rekam jejak buruk; null terbaca sebagai belum diuji. */
cek('winrate null saat belum ada yang selesai',
  ringkasKanal([s({ terisi: true }), s({ jenisEntry: 'Buy Stop' })], null, 10).winrate, null);

/* ── Gaya trading dari timeframe tersering ───────────────────────────── */
const gaya = (tfs) => ringkasKanal(tfs.map((tf) => s({ tf })), null, 10).gaya;
cek('tersering menang, bukan rata-rata', gaya(['5m', '5m', '5m', '1d']), 'Scalping');
/* Bentuk yang benar-benar dipakai aplikasi — lihat TF_MT5 di Chart.tsx.
   Kalau daftar itu berubah, uji ini yang harus berbunyi lebih dulu. */
cek('1m', gaya(['1m']), 'Scalping');
cek('15m', gaya(['15m']), 'Scalping');
cek('30m', gaya(['30m']), 'Intraday');
cek('1h', gaya(['1h']), 'Intraday');
cek('4h', gaya(['4h']), 'Intraday');
cek('1d', gaya(['1d']), 'Swing');
cek('1w', gaya(['1w']), 'Swing');
cek('tf kosong -> tanpa label', gaya(['', '']), null);
cek('tf tak dikenal -> tanpa label', gaya(['abc']), null);

/* ── Risiko menolak menyimpulkan dari sampel tipis ───────────────────── */
{
  const empat = [s({ hasil: 'tp' }), s({ hasil: 'tp' }), s({ hasil: 'sl' }), s({ hasil: 'sl' })];
  const r = ringkasKanal(empat, { harian: { '2026-08-01': -50 } }, 10);
  cek('4 sinyal selesai -> tanpa label risiko', r.risiko, null);
  cek('alasannya menyebut kurang data', /Belum cukup data/.test(r.alasanRisiko), true);
}

/* ── Risiko = drawdown dalam satuan risiko ───────────────────────────── */
{
  const lima = Array.from({ length: 5 }, () => s({ hasil: 'tp' }));
  cek('turun 1,5R -> Rendah', ringkasKanal(lima, { harian: { a: 30, b: -15 } }, 10).risiko, 'Rendah');
  cek('turun 4,5R -> Sedang', ringkasKanal(lima, { harian: { a: 30, b: -45 } }, 10).risiko, 'Sedang');
  const tinggi = ringkasKanal(lima, { harian: { a: 30, b: -80 } }, 10);
  cek('turun 8R -> Tinggi', tinggi.risiko, 'Tinggi');
  cek('alasannya menyebut angkanya', /8\.0×/.test(tinggi.alasanRisiko), true);

  /* Jebakan 3: kunci ditulis terbalik. Tanpa pengurutan tanggal,
     drawdown-nya terbaca 0 dan analis paling bergejolak justru dilabeli
     risiko rendah — kesalahan yang persis membalik artinya. */
  cek('urut tanggal, bukan urutan kunci',
    ringkasKanal(lima, { harian: { '2026-08-09': -60, '2026-08-01': 20 } }, 10).risiko, 'Tinggi');

  cek('tanpa data harian tidak melempar', ringkasKanal(lima, {}, 10).risiko, 'Rendah');
}

/* ── Waktu posting pending ───────────────────────────────────────────── */
{
  const r = ringkasKanal([
    s({ jenisEntry: 'Buy Limit', dibuat: 1000 }),
    s({ jenisEntry: 'Sell Stop', dibuat: 5000 }),
    s({ jenisEntry: 'Buy Limit', dibuat: 3000, hasil: 'tp' }),  // selesai
  ], null, 10);
  cek('pending + waktu terbaru', [r.pending, r.pendingTerbaru], [2, 5000]);
  cek('tanpa pending -> 0', ringkasKanal([s({ hasil: 'tp' })], null, 10).pendingTerbaru, 0);
}

/* ── Kanal kosong tidak boleh melempar ───────────────────────────────── */
{
  const r = ringkasKanal([], null, 10);
  cek('kanal kosong', [r.total, r.winrate, r.gaya, r.risiko], [0, null, null, null]);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
