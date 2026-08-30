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

/* ══ MEMPERKAYA BARIS TERATAS ══════════════════════════════════════════
   Papan peringkat cuma menjawab "siapa yang untung". Tiga hal yang membuat
   orang benar-benar bisa memilih siapa yang dipantau tidak ada di sana:
   seberapa sering ia menang, sudah berapa lama ia hidup, dan sekarang
   sedang memegang apa.

   ── ONGKOSNYA SANGAT TIMPANG, DAN ITU MEMBENTUK RANCANGANNYA ─────────
   Diukur di VPS ini untuk satu dompet:

       clearinghouseState            6 KB   291 ms   -> posisi terbuka
       userNonFundingLedgerUpdates   4 KB    86 ms   -> umur dompet
       userFills                   632 KB   420 ms   -> win rate

   Dua yang pertama praktis gratis. Yang ketiga seratus lima puluh kali
   lebih berat, dan 953 dompet berarti 600 MB per putaran — mustahil.

   Jadi yang diperkaya cuma barisan TERATAS yang benar-benar dilihat orang:
   30 teratas per pita ukuran akun pada jendela bulan, yang memang tampilan
   bawaan panelnya. Sisanya menulis tanda hubung — dan tanda hubung yang
   jujur lebih baik daripada angka yang dikarang untuk mengisi kolom.

   ── UMUR DARI BUKU BESAR, BUKAN DARI FILL ───────────────────────────
   Temuan yang mengubah kualitas angkanya: `userFills` dibatasi 2000 baris,
   jadi fill tertuanya BUKAN awal hidup dompet — untuk dompet ramai ia cuma
   dua bulan lalu. `userNonFundingLedgerUpdates` memulangkan setoran dan
   penarikan sejak awal, dan baris tertuanya adalah setoran pertama: umur
   yang sebenarnya. Untuk dompet yang diuji, fill tertua 30 Juni 2026
   sementara setoran pertama 1 Mei 2025 — selisih sebelas bulan.

   Dan ia 158 kali lebih murah daripada sumber yang salah itu. */
const PERKAYA_PER_PITA = Number(process.env.WALLET_PERKAYA || 30);

/* ══ DUA TAHAP, KARENA ONGKOSNYA BEDA SERATUS KALI ═════════════════════
   Versi pertama memperkaya 30 teratas per pita, dan hanya pada jendela
   BULAN. Akibatnya kolom "Posisi sekarang" kosong untuk sebelas dari empat
   puluh baris — dan begitu saringan jendelanya diganti ke Hari atau Semua,
   yang muncul barisan dompet yang belum pernah diperiksa sama sekali.

   Yang dulu menyatukan keduanya: satu fungsi menarik ketiga sumbernya
   sekaligus. Padahal ongkosnya sama sekali tidak sebanding —

       clearinghouseState     6 KB    -> posisi terbuka
       ledgerUpdates          4 KB    -> umur dompet
       userFills            632 KB    -> win rate, RR

   Posisi seratus kali lebih murah daripada riwayat. Menyatukannya berarti
   membayar harga riwayat untuk mendapatkan posisi, dan itulah kenapa
   jangkauannya terpaksa dipersempit sampai kolomnya bolong.

   Sekarang dipisah:

     TAHAP RINGAN  — posisi saja, untuk SETIAP baris yang mungkin tampil
                     di layar: 40 teratas × 3 pita × 4 jendela. Sekitar 200
                     dompet unik, 6 KB masing-masing = ±1,2 MB per putaran.
     TAHAP PENUH   — posisi + umur + WR + RR, tetap 30 teratas per pita
                     pada jendela bulan. Di sinilah 632 KB-nya dibayar,
                     dan cuma untuk baris yang benar-benar dibandingkan
                     orang saat memilih dompet.

   Yang penuh dijalankan LEBIH DULU. Kalau putarannya terpotong di tengah,
   yang hilang harus bagian yang paling tidak dirindukan. */
const TAMPIL_PER_PITA = Number(process.env.WALLET_TAMPIL || 40);
const JEDA_RINGAN = Number(process.env.WALLET_JEDA_RINGAN || 700);
const JENDELA_SEMUA = ['day', 'week', 'month', 'allTime'];
const KELUAR_RINCI = path.join(__dirname, 'wallet-peringkat-rinci.json');

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── DIBATASI LAJU, DAN INI DIPELAJARI DARI KEGAGALAN ──────────────────
   Percobaan pertama menembak 90 dompet secepat mungkin dan selesai dalam 12
   detik — yang mustahil untuk 270 permintaan yang salah satunya 632 KB.
   Hasilnya: cuma 20 dari 90 yang terisi. Sisanya ditolak Hyperliquid, dan
   penolakannya cepat, senyap, serta terbaca sebagai "sukses tapi kosong".

   Kegagalan yang cepat memang selalu terlihat seperti keberhasilan yang
   cepat, dan itu sebabnya durasi yang terlalu bagus untuk dipercaya patut
   dicurigai sebelum hasilnya diperiksa.

   Sekarang satu percobaan ulang dengan jeda, dan jeda tetap antar dompet.
   Sembilan puluh dompet jadi sekitar dua menit — tidak masalah untuk cron
   yang jalan empat kali sehari. */
const JEDA_LAJU = Number(process.env.WALLET_JEDA_LAJU || 1200);

async function hlq(badan, ulang = 1) {
  try {
    const r = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(badan), signal: AbortSignal.timeout(25000),
    });
    if (r.status === 429 || r.status >= 500) {
      if (ulang > 0) { await tidur(3000); return hlq(badan, ulang - 1); }
      return null;
    }
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    if (ulang > 0) { await tidur(2000); return hlq(badan, ulang - 1); }
    return null;
  }
}

/* Aturan pengelompokan yang SAMA dengan pemantau dan layar: koin+arah sama,
   jarak kurang dari lima menit = satu penutupan. Tiga tempat menghitung
   win rate, dan tiga penggaris yang berbeda berarti tiga angka yang tidak
   bisa dibandingkan dengan apa pun. */
/* ── RR RATA-RATA: UKURAN MENANG DIBAGI UKURAN KALAH ───────────────────
   Win rate sendirian menipu. Trader yang menang 80% tapi tiap kalah
   menghapus empat kemenangan sedang rugi pelan-pelan, dan angka 80% itu
   yang membuatnya terlihat hebat. Yang melengkapinya rasio ukuran: rata-rata
   penutupan untung dibagi rata-rata penutupan rugi.

   Dua-duanya diperlukan dan tidak bisa saling menggantikan. WR 40% dengan
   RR 3 lebih menguntungkan daripada WR 70% dengan RR 0,3, dan tidak ada
   satu angka pun yang bisa mengatakan itu sendirian.

   Dihitung dari PENUTUPAN yang sudah dikelompokkan, bukan dari fill: satu
   keluar yang terpotong seratus keping akan memberi seratus "kerugian
   kecil" dan meruntuhkan rata-ratanya. */
function wrDari(fills) {
  const tutup = (Array.isArray(fills) ? fills : [])
    .filter((f) => Number(f.closedPnl) !== 0)
    .sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
  const g = [];
  for (const l of tutup) {
    const k = g[g.length - 1];
    const t = Number(l.time) || 0;
    if (k && k.koin === l.coin && k.dir === l.dir && t - k.waktu <= 300000) {
      k.pnl += Number(l.closedPnl) || 0; k.waktu = t;
    } else {
      g.push({ koin: l.coin, dir: l.dir, pnl: Number(l.closedPnl) || 0, waktu: t });
    }
  }
  const menang = g.filter((x) => x.pnl > 0).length;
  const untung = g.filter((x) => x.pnl > 0).map((x) => x.pnl);
  const rugi = g.filter((x) => x.pnl < 0).map((x) => Math.abs(x.pnl));
  const rata = (d) => (d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0);
  const mRata = rata(untung);
  const kRata = rata(rugi);
  /* null kalau belum pernah rugi — RR tak hingga bukan angka yang bisa
     dibandingkan, dan menuliskannya sebagai angka besar membuat dompet
     dengan tiga trade menang terlihat mengalahkan semuanya. */
  const rr = kRata > 0 && mRata > 0 ? Math.round((mRata / kRata) * 100) / 100 : null;
  return {
    tutup: g.length, menang,
    wr: g.length ? Math.round(menang / g.length * 100) : null,
    rr,
    menangRata: Math.round(mRata),
    kalahRata: Math.round(kRata),
  };
}

/* Posisi SAJA. Satu permintaan, 6 KB. Dipakai untuk barisan yang cuma
   perlu mengisi kolom "Posisi sekarang" dan rangkuman Wallet View. */
async function posisiSaja(alamat) {
  const isi = await hlq({ type: 'clearinghouseState', user: alamat });
  /* null = permintaannya gagal, BUKAN dompetnya kosong. Dua-duanya terlihat
     sama dari sini kalau tidak dibedakan, dan menyimpan yang gagal sebagai
     "sudah diperiksa, tidak punya posisi" adalah kabar bohong yang tidak
     akan pernah diperiksa ulang. */
  if (!isi) return null;

  const posisi = [];
  for (const p of ((isi.assetPositions) || [])) {
    const po = p.position || {};
    const sz = Number(po.szi) || 0;
    if (!sz) continue;
    posisi.push({
      koin: String(po.coin || '?'),
      arah: sz > 0 ? 'L' : 'S',
      nilai: Math.round(Math.abs(Number(po.positionValue) || 0)),
      pnl: Math.round(Number(po.unrealizedPnl) || 0),
      entry: Number(po.entryPx) || 0,
    });
  }
  posisi.sort((a, b) => b.nilai - a.nilai);

  return {
    posisi: posisi.slice(0, 12),
    jmlPosisi: posisi.length,
    /* Ditandai supaya layar tahu bedanya "belum diperiksa" dan "diperiksa,
       tapi hanya posisinya". Tanda hubung di kolom WR untuk baris ringan
       adalah jawaban yang benar, bukan kekurangan yang perlu ditutupi. */
    ringan: true,
    lahir: 0, wr: null, rr: null,
    menangRata: 0, kalahRata: 0, tutup: 0, fill: 0, terpotong: false,
  };
}

async function perkaya(alamat) {
  const [isi, buku, fills] = await Promise.all([
    hlq({ type: 'clearinghouseState', user: alamat }),
    hlq({ type: 'userNonFundingLedgerUpdates', user: alamat, startTime: 0 }),
    hlq({ type: 'userFills', user: alamat }),
  ]);

  const posisi = [];
  for (const p of ((isi && isi.assetPositions) || [])) {
    const po = p.position || {};
    const sz = Number(po.szi) || 0;
    if (!sz) continue;
    posisi.push({
      koin: String(po.coin || '?'),
      arah: sz > 0 ? 'L' : 'S',
      nilai: Math.round(Math.abs(Number(po.positionValue) || 0)),
      pnl: Math.round(Number(po.unrealizedPnl) || 0),
      /* Harga masuknya ikut dibawa. Sudah ada di jawaban yang sama, tidak
         menambah satu permintaan pun — dan tanpanya layar cuma bisa bilang
         "enam dompet long BTC" tanpa bisa bilang di harga berapa, yang
         justru bagian yang menentukan masih layak ikut atau sudah telat. */
      entry: Number(po.entryPx) || 0,
    });
  }
  posisi.sort((a, b) => b.nilai - a.nilai);

  const waktuBuku = (Array.isArray(buku) ? buku : []).map((x) => Number(x.time) || 0).filter(Boolean);
  const w = wrDari(fills);

  return {
    /* Dua belas, bukan enam. Angka ini bukan cuma soal panjang tampilan:
       rangkuman "berapa dompet memegang koin X" dihitung dari daftar INI,
       jadi memotongnya di enam berarti dompet dengan sepuluh posisi diam-
       diam tidak dihitung untuk empat koin terakhirnya. */
    posisi: posisi.slice(0, 12),
    jmlPosisi: posisi.length,
    /* Setoran pertama = umur sebenarnya. 0 kalau buku besarnya tidak
       terbaca — dan nol DIBEDAKAN dari "baru saja dibuat" di layar. */
    lahir: waktuBuku.length ? Math.min(...waktuBuku) : 0,
    wr: w.wr,
    rr: w.rr,
    menangRata: w.menangRata,
    kalahRata: w.kalahRata,
    tutup: w.tutup,
    fill: Array.isArray(fills) ? fills.length : 0,
    terpotong: Array.isArray(fills) && fills.length >= 2000,
  };
}

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

  /* ── Perkaya barisan teratas ────────────────────────────────────────
     Berurutan, bukan berbarengan. Tiga puluh respons userFills sekaligus
     berarti sekitar 19 MB tertahan di memori pada saat yang sama, di VPS
     yang cuma punya 275 MB sisa — dan skrip ini sudah memakai 200 MB untuk
     mem-parse papannya sendiri beberapa detik sebelumnya. */
  const teratas = (jendela, pita, batas) => daftar
    .filter((x) => x.w[jendela] && x.akun >= pita.bawah && x.akun < pita.atas)
    .sort((a, b) => b.w[jendela].pnl - a.w[jendela].pnl)
    .slice(0, batas)
    .map((x) => x.alamat);

  const perluRinci = [];
  for (const p of PITA) {
    for (const a of teratas('month', p, PERKAYA_PER_PITA)) {
      if (!perluRinci.includes(a)) perluRinci.push(a);
    }
  }

  /* Semua yang BISA muncul di layar, lintas jendela dan lintas pita. Yang
     sudah masuk daftar penuh dikeluarkan — memeriksanya dua kali cuma
     membuang waktu untuk jawaban yang identik. */
  const perluPosisi = [];
  for (const j of JENDELA_SEMUA) {
    for (const p of PITA) {
      for (const a of teratas(j, p, TAMPIL_PER_PITA)) {
        if (!perluRinci.includes(a) && !perluPosisi.includes(a)) perluPosisi.push(a);
      }
    }
  }

  catat('memperkaya', perluRinci.length, 'dompet teratas (penuh) +',
        perluPosisi.length, 'dompet (posisi saja)…');

  const rinci = {};
  let n = 0;
  for (const a of perluRinci) {
    try {
      const d = await perkaya(a);
      /* Yang KOSONG tidak disimpan. Baris tanpa WR maupun umur berarti
         permintaannya ditolak, bukan dompetnya tidak punya riwayat — dan
         menyimpannya membuat putaran berikutnya mengira ia sudah diperiksa. */
      if (d.wr !== null || d.lahir || d.jmlPosisi) {
        d.waktu = Date.now();
        rinci[a] = d;
        n++;
      }
    } catch (e) { /* satu dompet gagal tidak menjatuhkan sisanya */ }
    await tidur(JEDA_LAJU);
  }

  /* Tahap ringan. Jedanya lebih pendek karena permintaannya seratus kali
     lebih kecil — tapi tetap ADA, karena yang dibatasi bursa jumlah
     permintaan, bukan jumlah bita. */
  let nr = 0;
  for (const a of perluPosisi) {
    try {
      const d = await posisiSaja(a);
      /* Dompet yang benar-benar flat TETAP disimpan. Ia berbeda dengan
         dompet yang belum diperiksa, dan layar menghitung penyebutnya dari
         perbedaan itu — "dari 19 dompet yang terbaca" cuma jujur kalau
         yang flat ikut terhitung sebagai terbaca. */
      if (d) { d.waktu = Date.now(); rinci[a] = d; nr++; }
    } catch (e) { /* satu dompet gagal tidak menjatuhkan sisanya */ }
    await tidur(JEDA_RINGAN);
  }
  catat('posisi saja tersimpan ·', nr, 'dompet');
  try {
    const semenR = KELUAR_RINCI + '.tmp';
    fs.writeFileSync(semenR, JSON.stringify({ diperbarui: Date.now(), rinci }));
    fs.renameSync(semenR, KELUAR_RINCI);
    catat('rincian tersimpan ·', n, 'dompet ·',
      Math.round(fs.statSync(KELUAR_RINCI).size / 1024), 'KB');
  } catch (e) { catat('rincian gagal disimpan:', e.message); }
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
