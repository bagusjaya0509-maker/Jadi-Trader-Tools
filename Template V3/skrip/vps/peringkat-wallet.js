#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   peringkat-wallet.js — menyaring papan peringkat Hyperliquid
   ══════════════════════════════════════════════════════════════════════════
   Menjawab pertanyaan yang tersisa dari fase pertama agen dompet: dompet
   MANA yang layak dipantau. Tanpa ini satu-satunya cara menambah dompet
   adalah menempel alamat 42 karakter yang harus dicari sendiri di luar.

   ── KENAPA PROSES SENDIRI, BUKAN DI DALAM PEMANTAU ───────────────────────
   Papan peringkatnya 36 MB dan 44 ribu baris. Mem-parse-nya memuncak di
   sekitar 120 MB, dan VPS ini punya 961 MB dengan 275 MB tersisa. Angka itu
   muat — tapi cuma kalau puncaknya PULANG setelah selesai.

   Di dalam proses yang hidup 24 jam, memori sebesar itu diminta ke sistem
   lalu ditahan heap-nya sampai proses mati; enam jam sekali ia diminta lagi.
   Di proses yang hidup sepuluh detik, ia pulang seluruhnya begitu keluar.
   Dan kalau toh kehabisan, yang mati cuma skrip ini — bukan telinga dompet
   yang sedang mencatat transaksi.

   ── KENAPA BUKAN LANGSUNG DARI PERAMBAN ──────────────────────────────────
   36 MB per pembukaan panel. Yang membukanya sering menumpang tethering.

   ── SUMBERNYA HOST LAIN ──────────────────────────────────────────────────
   stats-data.hyperliquid.xyz, BUKAN api.hyperliquid.xyz — yang terakhir
   menjawab 422 untuk {"type":"leaderboard"}. Dua nama yang mirip untuk dua
   layanan yang berbeda; salah pilih menghasilkan galat yang terbaca seperti
   permintaan yang salah bentuk.

   Pakai: node peringkat-wallet.js
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const SUMBER = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
const KELUAR = path.join(__dirname, 'wallet-peringkat.json');

/* Saringan mutu. Tanpa keduanya daftar ini didominasi akun receh: satu
   deposit 100 dolar yang jadi 200 memberi ROI 100% dan duduk di atas dana
   yang menghasilkan sejuta dolar. ROI tanpa modal yang berarti bukan
   prestasi, cuma pembagian angka kecil. */
const MIN_AKUN = Number(process.env.WALLET_MIN_AKUN || 10000);
const MIN_PNL_ROI = Number(process.env.WALLET_MIN_PNL_ROI || 5000);
const PER_DAFTAR = Number(process.env.WALLET_PER_DAFTAR || 120);

const JENDELA = ['day', 'week', 'month', 'allTime'];

function jam() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
function catat(...a) { console.log('[' + jam() + ']', ...a); }

/* Nama yang dipasang sendiri pemiliknya — TEKS PIHAK LAIN, bukan data kita.
   Dipotong dan dibersihkan dari aksara kendali di sini supaya yang sampai ke
   layar sudah sepanjang yang wajar; isinya tetap ditampilkan apa adanya
   sebagai teks, tidak pernah diperlakukan sebagai perintah apa pun. */
function bersihNama(v) {
  return String(v || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

/* ── ROI HYPERLIQUID SENGAJA TIDAK DIPAKAI ────────────────────────────
   Angkanya tidak bisa dipertanggungjawabkan di layar. Contoh nyata dari
   tarikan pertama: akun 30.223 dolar dengan untung 115.524 dolar diberi ROI
   115.524% — pembaginya jelas bukan ukuran akun, melainkan sesuatu yang
   sangat kecil (kemungkinan setoran awal jendela). Menampilkannya berarti
   menaruh angka enam digit di kolom persen dan berharap tidak ada yang
   bertanya dari mana.

   Yang dipakai `rasio` = untung dibagi ukuran akun SEKARANG. Ia bukan ROI
   sejati — akun yang tumbuh sudah memuat untungnya di penyebut, jadi
   nilainya selalu merendahkan. Tapi ia bisa dijelaskan dalam satu kalimat,
   sebanding antar-dompet, dan tidak bisa meledak: pertumbuhan murni tidak
   pernah melewati 100%. Angka yang jujur merendah mengalahkan angka yang
   mengesankan tapi tidak ada yang tahu artinya. */
/* -- TIDAK ADA KOLOM PERSEN, DAN ITU KEPUTUSAN ------------------------
   Tiga kandidat dicoba dengan data sungguhan, ketiganya dibuang:

     - `roi` terbitan Hyperliquid memberi 115.524% untuk akun 30 ribu
       dolar. Pembaginya bukan ukuran akun, dan tidak ada cara
       menjelaskannya di layar.
     - untung dibagi ukuran akun memberi 7.700% untuk akun 32 ribu dolar
       yang untung 2,5 juta. Bukan salah hitung: orangnya menarik untungnya
       keluar, jadi akun yang tersisa kecil. Yang diurutkan jadi "siapa yang
       paling banyak menarik dana", bukan siapa yang paling pandai.
     - untung dibagi volume memberi 5.820%. Volume yang dilaporkan jelas
       bukan seluruh perputaran yang menghasilkan untung itu.

   Ketiganya gagal karena alasan yang sama: pnl, accountValue, dan vlm dari
   sumber ini tidak merujuk ke periode dan cakupan yang sama, jadi rasio apa
   pun di antara mereka mengukur sesuatu yang tidak jelas apa.

   Yang bisa dipertanggungjawabkan cuma `pnl` itu sendiri. Supaya dana
   raksasa tidak selamanya menguasai puncak dan trader menengah tidak pernah
   kelihatan, pembandingnya dibatasi lewat PITA UKURAN AKUN -- membandingkan
   yang sebanding, dengan angka yang semuanya milik bursanya sendiri. Tidak
   ada satu pun angka di papan ini yang kita karang. */
function ambilJendela(baris) {
  const w = {};
  for (const [nama, isi] of (baris.windowPerformances || [])) {
    if (!JENDELA.includes(nama)) continue;
    w[nama] = {
      pnl: Math.round(Number(isi.pnl) || 0),
      vlm: Math.round(Number(isi.vlm) || 0),
    };
  }
  return w;
}

/** Pita ukuran akun. Batasnya bulat dan sengaja kasar: gunanya memisahkan
 *  dana institusi dari akun perorangan, bukan menggolongkan dengan presisi
 *  yang tidak ada artinya. */
const PITA = [
  { id: 'kecil', bawah: 0, atas: 1e6 },
  { id: 'menengah', bawah: 1e6, atas: 1e7 },
  { id: 'semua', bawah: 0, atas: Infinity },
];

(async () => {
  const t0 = Date.now();
  catat('menarik papan peringkat…');
  const r = await fetch(SUMBER, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);

  /* ── LEWAT DISK, BUKAN LANGSUNG r.json() ─────────────────────────────
     Diukur di VPS ini: r.json() memuncak di 262 MB, mengalirkannya ke
     berkas lalu mem-parse berkasnya memuncak di 162 MB. Selisihnya 100 MB
     dari 275 MB yang tersisa — bukan penghematan yang bisa diabaikan.

     Sebabnya r.json() menahan tiga bentuk data yang sama sekaligus di
     puncak yang sama: penyangga bita mentahnya, untai teks hasil
     penerjemahannya, lalu pohon objeknya. Aliran ke disk membuang yang
     pertama dari memori sepenuhnya. */
  const semen = path.join(os.tmpdir(), 'hl-peringkat-' + process.pid + '.json');
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(semen));
  let semua = [];
  try {
    const mentah = JSON.parse(fs.readFileSync(semen, 'utf8'));
    semua = Array.isArray(mentah && mentah.leaderboardRows) ? mentah.leaderboardRows : [];
  } finally {
    try { fs.unlinkSync(semen); } catch (e) { /* sudah hilang */ }
  }
  catat('diterima', semua.length, 'baris dalam', ((Date.now() - t0) / 1000).toFixed(1), 'detik');
  if (!semua.length) throw new Error('papan peringkat kosong');

  const layak = [];
  for (const x of semua) {
    const akun = Number(x.accountValue) || 0;
    if (akun < MIN_AKUN) continue;
    const alamat = String(x.ethAddress || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(alamat)) continue;
    layak.push({ alamat, nama: bersihNama(x.displayName), akun: Math.round(akun), w: ambilJendela(x) });
  }
  catat('lolos saringan akun >= ' + MIN_AKUN + ':', layak.length);

  const pilih = new Map();
  const ambil = (saring, nilai) => {
    const d = layak.filter(saring).sort((a, b) => nilai(b) - nilai(a)).slice(0, PER_DAFTAR);
    for (const x of d) pilih.set(x.alamat, x);
    return d.length;
  };
  /* Diambil PER PITA, bukan sekali untuk semuanya. Kalau cuma top-120
     keseluruhan yang disimpan, pita "akun kecil" nanti disaring dari daftar
     yang isinya dana raksasa -- dan menghasilkan lima baris, atau nol. */
  for (const j of JENDELA) {
    const bagian = PITA.map((p) => p.id + ' ' + ambil(
      (x) => x.w[j] && x.akun >= p.bawah && x.akun < p.atas,
      (x) => x.w[j].pnl,
    ));
    catat('  ' + j + ' · ' + bagian.join(' · '));
  }

  const daftar = [...pilih.values()];
  const isi = {
    /* Waktu tarikannya IKUT DISIMPAN. Papan peringkat berumur enam jam masih
       berguna, tapi hanya kalau umurnya kelihatan — angka tanpa tanggal
       terbaca seperti angka hari ini, dan itu satu-satunya cara ia menipu. */
    diperbarui: Date.now(),
    sumber: 'Hyperliquid',
    minAkun: MIN_AKUN,
    minPnlRoi: MIN_PNL_ROI,
    total: semua.length,
    daftar,
  };
  const semenKeluar = KELUAR + '.tmp';
  fs.writeFileSync(semenKeluar, JSON.stringify(isi));
  fs.renameSync(semenKeluar, KELUAR);
  catat('tersimpan', daftar.length, 'dompet ·',
    Math.round(fs.statSync(KELUAR).size / 1024), 'KB ·',
    ((Date.now() - t0) / 1000).toFixed(1), 'detik total');
  process.exit(0);
})().catch((e) => {
  console.error('[' + jam() + '] GAGAL:', e && e.message);
  /* Berkas lama SENGAJA dibiarkan. Papan peringkat kemarin masih menjawab
     pertanyaan yang sama dengan cukup baik; berkas kosong tidak menjawab
     apa-apa dan terbaca seperti fitur yang rusak. */
  process.exit(1);
});
