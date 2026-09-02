/* ══════════════════════════════════════════════════════════════════════════
   JEJAK LISTING — pencatat harian lintasan koin DEX
   ══════════════════════════════════════════════════════════════════════════
   Dibuat 2 Sep 2026 atas permintaan pemilik. Tesisnya: token yang tumbuh di
   DEX lebih dulu, lalu diangkat ke CEX — dan yang ingin ia lihat adalah fase
   DEX-nya, sebelum pengumuman.

   ── KENAPA PERLU MENCATAT SENDIRI ───────────────────────────────────────
   Diperiksa dulu ke sumbernya, dan hasilnya membelah dua:

     harga & volume harian   ADA riwayatnya, 39+ bar, gratis dari GeckoTerminal
     likuiditas              cuma nilai SEKARANG
     jumlah pemegang         cuma nilai SEKARANG (GoPlus)

   Jadi separuh lintasan bisa ditarik surut, separuh lagi tidak. Yang tidak
   bisa itulah alasan berkas ini ada: tanpa catatan harian, "likuiditas
   menebal" dan "pemegang bertambah" tidak akan pernah bisa dijawab, berapa
   lama pun menunggu.

   ── KENAPA POTRET TIDAK CUKUP, DENGAN CONTOHNYA ─────────────────────────
   CATE/SOL lolos saringan potret 2 Sep 2026: likuiditas $1,78 jt, rasio
   volume/likuiditas 2,55, umur 38 hari. Terlihat sehat.

   Riwayat hariannya bercerita lain:
       24 Agu  $0,077   volume $24,4 jt
        2 Sep  $0,036   volume  $1,6 jt
   Volume runtuh 93% dalam sepuluh hari sementara harga turun separuh.

   Potret bilang sehat, lintasan bilang sekarat. Berkas ini memihak yang
   kedua.

   ── YANG TIDAK DIJANJIKAN ───────────────────────────────────────────────
   Ini TIDAK memprediksi listing CEX. Keputusan itu komersial — ada biaya
   listing, ada hubungan bisnis — dan tidak ada data publik yang memberi
   tanggalnya. Yang bisa dilakukan alat ini: menjaga daftar pendek berisi
   koin yang lintasannya naik, supaya ketika listing terjadi, peluangnya
   lebih besar datang dari daftar itu. Perbaikan peluang dasar, bukan ramalan.

   Dijalankan cron sekali sehari. Aman diulang: satu baris per koin per
   tanggal, pemanggilan kedua di hari yang sama menimpa, tidak menumpuk.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const AKAR = __dirname;
try { require('dotenv').config({ path: path.join(AKAR, '.env') }); } catch (e) { /* uji lokal */ }

/* Fungsi kolam & keamanan diambil dari listing-vps.js, BUKAN disalin.
   Satu aturan, satu tempat — kalau cara memilih kolam terdalam suatu hari
   diperbaiki di sana, pencatat ini ikut membaik tanpa disentuh. */
const { GT, JARINGAN, cariKolam, periksaAman } = require('./listing-vps').alat;

const BERKAS_PANTAU = path.join(AKAR, 'listing-pantau.json');
const BERKAS_JEJAK = path.join(AKAR, 'listing-jejak.json');

const HARI = 86400000;
const KERING = process.argv.includes('--kering');

/* ── Saringan kandidat ─────────────────────────────────────────────────────
   Angkanya sama dengan yang sudah diuji ke pasar sungguhan 2 Sep 2026: dari
   40 kolam teraktif di Base + Solana, 4 lolos. Bukan ambang yang dikarang —
   ambang yang sudah dilihat hasilnya. */
const SARING = {
  umurMinHari: 2,        // < 2 hari: belum ada apa pun untuk dinilai
  umurMaksHari: 120,     // > 4 bulan: bukan "baru listing" lagi
  likuiditasMin: 300000, // kolam tipis tidak bisa dimasuki modal sungguhan
  volume24Min: 200000,
  rasioMin: 0.15,        // volume/likuiditas di bawah ini = kolam mati
  rasioMaks: 8,          // di atas ini mencurigakan (perdagangan berputar)
  fdvPerLikMaks: 60,     // float tipis menopang valuasi besar
};

const JARINGAN_PINDAI = ['solana', 'base', 'eth', 'bsc', 'arbitrum'];
const MAKS_KANDIDAT = 40;   // pagar ukuran berkas + ongkos permintaan
const UMUR_BUANG_HARI = 21; // kandidat yang lama tidak lolos saringan dilupakan

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── PENGATUR LAJU ─────────────────────────────────────────────────────────
   GeckoTerminal gratis mengizinkan sekitar 30 permintaan per menit. Jalan
   kering pertama 2 Sep 2026 menabraknya telak: 429 di hampir semua
   permintaan, 6 dari 7 koin gagal dicatat.

   Yang salah bukan jumlah permintaannya — totalnya cuma ~90 untuk 40 koin.
   Yang salah jaraknya: jeda ditaruh per-langkah (3 detik antar jaringan,
   1,5 detik antar koin) padahal SATU koin bisa menembak tiga permintaan
   berturut-turut tanpa jeda di antaranya.

   Jadi jedanya dipindah ke satu gerbang yang dilewati SEMUA permintaan.
   3 detik = 20/menit, sepertiga di bawah batasnya. Satu putaran penuh jadi
   sekitar 5 menit; untuk pekerjaan yang jalan sekali sehari itu murah.

   Ditambah percobaan ulang: 429 bisa juga datang karena orang lain di IP
   yang sama sedang menarik data. Menyerah pada percobaan pertama berarti
   satu koin kehilangan satu hari dari deretnya — dan deret yang bolong
   itulah yang paling sulit diperbaiki belakangan. */
const JEDA_GT = 3000;
let gtTerakhir = 0;
async function gerbangGt() {
  const tunggu = JEDA_GT - (Date.now() - gtTerakhir);
  if (tunggu > 0) await tidur(tunggu);
  gtTerakhir = Date.now();
}

/** Jalankan `f` lewat gerbang laju; ulangi kalau kena 429. */
async function lewatGt(f, nama) {
  for (let coba = 1; coba <= 3; coba++) {
    await gerbangGt();
    try {
      return await f();
    } catch (e) {
      const kode = e.response ? e.response.status : 0;
      if (kode !== 429 || coba === 3) throw e;
      const mundur = coba * 20000;
      console.error('  429 pada ' + nama + ', tunggu ' + (mundur / 1000) + 'd lalu ulang');
      await tidur(mundur);
    }
  }
}



function baca(berkas, bawaan) {
  try { return JSON.parse(fs.readFileSync(berkas, 'utf8')); } catch (e) { return bawaan; }
}
function tulis(berkas, d) {
  /* Lewat berkas sementara lalu rename: cron bisa terputus di tengah, dan
     berkas jejak yang separuh tertulis akan dibaca panelnya sebagai data
     yang hilang — bukan sebagai berkas rusak. */
  const semen = berkas + '.tmp';
  fs.writeFileSync(semen, JSON.stringify(d, null, 2));
  fs.renameSync(semen, berkas);
}

/** Tanggal WIB, bukan UTC. Satu baris per koin per HARI KALENDER PEMILIK —
 *  cron jam 6 pagi WIB adalah 23:00 UTC hari sebelumnya, dan memakai UTC
 *  akan menaruh catatan Senin pagi ke dalam baris hari Minggu. */
function tanggalWib(ms) {
  return new Date((ms || Date.now()) + 7 * 3600000).toISOString().slice(0, 10);
}

const kunci = (jaringan, alamat) => jaringan + ':' + alamat.toLowerCase();

/* ── Riwayat harga & volume yang bisa ditarik SURUT ────────────────────────
   Dipanggil sekali saja per koin, saat pertama kali terlihat. Sesudah itu
   catatan harian kita sendiri yang meneruskan — menarik ulang 60 bar tiap
   hari untuk 40 koin adalah 40 permintaan yang mengembalikan data yang sudah
   kita punya. */
async function backfill(jaringan, kolam) {
  try {
    const r = await lewatGt(() => axios.get(
      `${GT}/networks/${jaringan}/pools/${kolam}/ohlcv/day?limit=60`,
      { timeout: 20000, headers: { accept: 'application/json' } }), 'ohlcv ' + kolam);
    const l = (r.data && r.data.data && r.data.data.attributes.ohlcv_list) || [];
    const keluar = {};
    for (const b of l) {
      const tgl = tanggalWib(Number(b[0]) * 1000);
      keluar[tgl] = { tgl, harga: Number(b[4]) || 0, volume24: Number(b[5]) || 0, surut: true };
    }
    return keluar;
  } catch (e) {
    console.error('  backfill gagal', jaringan, kolam, e.response ? e.response.status : e.message);
    return {};
  }
}

/** Kolam yang lolos saringan, dari daftar kolam teraktif tiap jaringan. */
async function kumpulkanKandidat() {
  const keluar = [];
  const kini = Date.now();
  let diperiksa = 0;
  const gugur = { umur: 0, likuiditas: 0, volume: 0, rasio: 0, fdv: 0 };

  for (const net of JARINGAN_PINDAI) {
    for (const jenis of ['trending_pools', 'pools']) {
      let d = [];
      try {
        const r = await lewatGt(() => axios.get(`${GT}/networks/${net}/${jenis}?page=1`,
          { timeout: 20000, headers: { accept: 'application/json' } }), net + '/' + jenis);
        d = (r.data && r.data.data) || [];
      } catch (e) {
        console.error('  lewat', net, jenis, e.response ? e.response.status : e.message);
      }
      for (const p of d) {
        const a = p.attributes || {};
        diperiksa++;
        const umur = (kini - Date.parse(a.pool_created_at || 0)) / HARI;
        if (!(umur >= SARING.umurMinHari && umur <= SARING.umurMaksHari)) { gugur.umur++; continue; }
        const lik = Number(a.reserve_in_usd) || 0;
        if (lik < SARING.likuiditasMin) { gugur.likuiditas++; continue; }
        const vol = Number((a.volume_usd || {}).h24) || 0;
        if (vol < SARING.volume24Min) { gugur.volume++; continue; }
        const rasio = vol / lik;
        if (rasio < SARING.rasioMin || rasio > SARING.rasioMaks) { gugur.rasio++; continue; }
        const fdv = Number(a.fdv_usd) || 0;
        if (lik > 0 && fdv / lik > SARING.fdvPerLikMaks) { gugur.fdv++; continue; }

        /* Alamat TOKEN, bukan alamat kolam. Satu token bisa punya belasan
           kolam; yang dilacak tokennya, dan cariKolam() yang memilih kolam
           terdalam tiap hari. Kalau likuiditas pindah ke kolam lain, jejak
           ini ikut pindah alih-alih mencatat kolam yang ditinggalkan. */
        const tok = ((p.relationships || {}).base_token || {}).data || {};
        const alamat = String(tok.id || '').split('_').pop();
        if (!alamat) continue;
        keluar.push({ jaringan: net, alamat, nama: a.name || '', kolam: a.address || '' });
      }
    }
  }
  console.log('  saringan: ' + diperiksa + ' kolam diperiksa, gugur '
    + Object.entries(gugur).map(([k, v]) => k + ' ' + v).join(', ')
    + ' -> ' + keluar.length + ' lolos');
  return keluar;
}

async function jalan() {
  const jejak = baca(BERKAS_JEJAK, { koin: {} });
  if (!jejak.koin) jejak.koin = {};
  const hariIni = tanggalWib();

  /* ── Siapa yang dicatat ───────────────────────────────────────────────
     Dua sumber, dan bedanya penting saat membersihkan nanti:

       PANTAUAN PEMILIK  tidak pernah dibuang, apa pun keadaannya. Koin yang
                         dibelinya di presale lalu hancur tetap harus punya
                         riwayat — itu justru catatan yang paling berguna
                         untuk dibaca ulang.
       KANDIDAT SARINGAN dibuang kalau lama tidak lolos. Ia cuma pinjaman
                         tempat sampai terbukti layak. */
  const target = new Map();

  const pantau = baca(BERKAS_PANTAU, {});
  for (const uid of Object.keys(pantau)) {
    for (const b of (pantau[uid] || [])) {
      if (!b || !b.jaringan || !b.alamat) continue;
      target.set(kunci(b.jaringan, b.alamat),
        { jaringan: b.jaringan, alamat: b.alamat, nama: b.nama || '', milikPemilik: true });
    }
  }
  console.log('  dari pantauan pemilik: ' + target.size + ' koin');

  for (const k of await kumpulkanKandidat()) {
    const kk = kunci(k.jaringan, k.alamat);
    if (!target.has(kk)) target.set(kk, { ...k, milikPemilik: false });
  }

  /* Yang sudah punya jejak ikut dicatat lagi meski hari ini tidak lolos
     saringan — deret yang bolong tidak bisa dibaca sebagai lintasan, dan
     justru hari-hari buruknya yang paling menjelaskan. */
  for (const kk of Object.keys(jejak.koin)) {
    if (target.has(kk)) continue;
    const c = jejak.koin[kk];
    const umurLupa = (Date.now() - (c.terlihat || 0)) / HARI;
    if (!c.milikPemilik && umurLupa > UMUR_BUANG_HARI) continue;   // dilupakan di bawah
    target.set(kk, { jaringan: c.jaringan, alamat: c.alamat, nama: c.nama, milikPemilik: c.milikPemilik });
  }

  const daftar = [...target.values()].slice(0, MAKS_KANDIDAT + 20);
  console.log('  total dicatat hari ini: ' + daftar.length);

  let baru = 0, gagal = 0;
  for (const t of daftar) {
    const kk = kunci(t.jaringan, t.alamat);
    let c = jejak.koin[kk];
    if (!c) {
      c = { jaringan: t.jaringan, alamat: t.alamat, nama: t.nama, simbol: '',
            milikPemilik: t.milikPemilik, mulai: Date.now(), hari: {} };
      jejak.koin[kk] = c;
      baru++;
    }
    if (t.milikPemilik) c.milikPemilik = true;

    try {
      /* cariKolam hidup di listing-vps.js dan menembak axios-nya sendiri,
         jadi ia tidak bisa dipaksa lewat gerbang dari dalam. Dibungkus dari
         luar: gerbangnya tetap dilewati, percobaan ulangnya tetap berlaku. */
      const k = await lewatGt(() => cariKolam(t.jaringan, t.alamat), 'kolam ' + kk);
      if (!k) { gagal++; continue; }
      c.nama = k.nama || c.nama;
      c.kolam = k.kolam;
      c.dex = k.dex;
      c.dibuatKolam = k.dibuatKolam || c.dibuatKolam || 0;
      c.terlihat = Date.now();

      /* Sekali seumur hidup koin ini: tarik riwayat harga & volume ke
         belakang. Setelah itu tidak pernah lagi. */
      if (!c.surutDitarik && k.kolam) {
        const lama = await backfill(t.jaringan, k.kolam);
        for (const tgl of Object.keys(lama)) {
          if (!c.hari[tgl]) c.hari[tgl] = lama[tgl];
        }
        c.surutDitarik = true;
      }

      /* Pemegang cuma ditarik untuk koin yang BENAR-BENAR dipantau pemilik,
         atau sekali seminggu untuk kandidat. GoPlus punya batas lajunya
         sendiri, dan 40 permintaan tiap hari untuk angka yang bergerak
         lambat adalah ongkos tanpa imbalan. */
      let pemegang = null;
      const perluPemegang = t.milikPemilik
        || !c.pemegangTerakhir || (Date.now() - c.pemegangTerakhir) > 7 * HARI;
      if (perluPemegang) {
        try {
          const a = await periksaAman(t.jaringan, t.alamat);
          if (a && !a.kosong && a.pemegang != null) {
            pemegang = a.pemegang;
            c.pemegangTerakhir = Date.now();
            c.simbol = a.simbol || c.simbol;
          }
        } catch (e) { /* keamanan gagal bukan alasan membuang barisnya */ }
        /* GoPlus API TERPISAH dari GeckoTerminal — batas lajunya sendiri,
           jadi ia tidak lewat gerbang GT. Jeda pendek sudah cukup. */
        await tidur(1200);
      }

      /* Baris hari ini. Menimpa kalau sudah ada — pemanggilan kedua di hari
         yang sama tidak menggandakan. `surut: false` menandai bahwa baris
         ini diukur langsung, bukan ditarik dari OHLCV; panelnya perlu tahu
         bedanya karena hanya baris langsung yang punya likuiditas. */
      c.hari[hariIni] = {
        tgl: hariIni,
        harga: k.harga,
        volume24: k.volume24,
        likuiditas: k.likuiditas,
        fdv: k.fdv,
        pemegang: pemegang != null ? pemegang : (c.hari[hariIni] || {}).pemegang ?? null,
        surut: false,
      };

      /* 120 hari terakhir. Lintasan yang lebih panjang dari itu bukan lagi
         cerita "baru listing". */
      const tgl = Object.keys(c.hari).sort();
      if (tgl.length > 120) for (const t2 of tgl.slice(0, tgl.length - 120)) delete c.hari[t2];
    } catch (e) {
      gagal++;
      console.error('  gagal', kk, e.response ? e.response.status : e.message);
    }
  }

  /* Lupakan kandidat yang lama tidak terlihat. Pantauan pemilik tidak
     pernah masuk ke sini. */
  let dilupakan = 0;
  for (const kk of Object.keys(jejak.koin)) {
    const c = jejak.koin[kk];
    if (c.milikPemilik) continue;
    if ((Date.now() - (c.terlihat || 0)) / HARI > UMUR_BUANG_HARI) { delete jejak.koin[kk]; dilupakan++; }
  }

  jejak.diperbarui = Date.now();
  const total = Object.keys(jejak.koin).length;
  console.log('[' + new Date().toISOString() + '] jejak-listing: '
    + total + ' koin (' + baru + ' baru, ' + gagal + ' gagal, ' + dilupakan + ' dilupakan)');

  if (KERING) { console.log('  --kering: berkas TIDAK ditulis'); return; }
  tulis(BERKAS_JEJAK, jejak);
}

jalan().catch((e) => { console.error('jejak-listing gagal:', e && e.message); process.exit(1); });
