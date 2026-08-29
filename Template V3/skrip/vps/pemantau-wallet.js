#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   pemantau-wallet.js — telinga untuk dompet Hyperliquid
   ══════════════════════════════════════════════════════════════════════════
   Membaca posisi dan SETIAP transaksi dompet yang dipilih pemilik, lalu
   menuliskannya ke wallet-aktivitas.json yang dibaca panel di web.

   ── HANYA MEMBACA ────────────────────────────────────────────────────────
   Tidak ada kunci pribadi di berkas ini, tidak ada order yang dikirim, tidak
   ada satu pun panggilan ke bursa. Endpoint yang dipakai publik dan tidak
   menuntut kunci API sama sekali — alamat dompet memang data terbuka.

   ── KENAPA POLLING, BUKAN WEBSOCKET ──────────────────────────────────────
   Hyperliquid menyediakan langganan WebSocket per alamat, dan untuk scalper
   itu memang satu-satunya cara. Tapi fase ini MENCATAT, bukan menyalin —
   dan untuk mencatat, tertinggal setengah menit tidak mengubah apa pun.

   Polling menang di hal yang justru penting sekarang: ia tidak punya
   keadaan yang bisa basi. Soket yang putus diam-diam adalah cara paling
   rapi kehilangan transaksi tanpa ada yang tahu, dan itu persis kegagalan
   yang sudah pernah terjadi di pemantau Telegram. Satu permintaan tiap
   putaran selalu memulangkan jawaban yang bisa diperiksa.

   Saat fase eksekusi tiba, WebSocket bisa dipasang di sampingnya — bukan
   menggantikannya.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

require('dotenv').config();
const path = require('path');
const { bacaDompet, catatWallet, batasTerakhir } = require('./wallet-vps');

const DIR = __dirname;
const API = 'https://api.hyperliquid.xyz/info';
const JEDA = Math.max(20, Number(process.env.WALLET_JEDA_DETIK || 60)) * 1000;
const NAMA_AGEN = process.env.WALLET_AGEN_NAMA || 'AI Wallet';
const DASAR = 'http://127.0.0.1:' + (process.env.PORT || 4000);
const APP_TOKEN = process.env.APP_TOKEN || '';

function jam() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
function catat(...a) { console.log('[' + jam() + ']', ...a); }

async function tanya(badan) {
  /* Batas waktu DIPASANG. Permintaan yang menggantung menahan seluruh
     putaran, dan pemantau yang macet di satu dompet terlihat persis seperti
     dompet yang sedang tidak bergerak. */
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(badan),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* ── Satu fill → satu baris catatan ────────────────────────────────────
   `dir` dipakai APA ADANYA dari Hyperliquid ("Open Long", "Close Short",
   "Settlement"). Menerjemahkannya sendiri berarti menebak arti istilah
   bursa lain, dan istilah yang salah terjemah lebih membingungkan daripada
   istilah asing yang jujur. */
/* ── Nama pasar spot ──────────────────────────────────────────────────
   Fill pasar spot memulangkan koinnya sebagai "@708", bukan "FXMR". Angka
   itu indeks internal Hyperliquid dan tidak berarti apa pun di layar —
   daftar transaksi yang isinya @708, @107, @1 sama saja dengan tidak
   mencatat koinnya. spotMeta memetakan indeks itu ke nama tokennya.

   Dipetakan sekali dan disimpan: isinya cuma bertambah saat ada pasar baru
   terdaftar, jadi menariknya tiap putaran berarti 130 KB tiap menit untuk
   jawaban yang hampir selalu sama. Perp ("BTC", "ETH") tidak lewat sini —
   namanya memang sudah nama. */
let petaSpot = {};
let petaJam = 0;

async function segarkanPetaSpot() {
  if (Date.now() - petaJam < 6 * 60 * 60 * 1000) return;
  try {
    const m = await tanya({ type: 'spotMeta' });
    const token = {};
    for (const t of (m?.tokens || [])) token[t.index] = t.name;
    const peta = {};
    for (const u of (m?.universe || [])) {
      const dasar = token[u?.tokens?.[0]];
      /* Hanya nama dasarnya. "FXMR/USDC" benar tapi boros di baris yang
         sudah padat, dan lawan pasangannya nyaris selalu USDC. */
      if (u?.name && dasar) peta[u.name] = dasar;
    }
    if (Object.keys(peta).length) { petaSpot = peta; petaJam = Date.now(); }
  } catch (e) { catat('peta spot gagal:', e && e.message); }
}

function namaKoin(k) {
  const s = String(k || '?');
  /* Yang tidak ketemu DIBIARKAN apa adanya, bukan diganti "?": "@912"
     setidaknya bisa dicari, sementara tanda tanya menghapus satu-satunya
     petunjuk yang ada. */
  return s.charAt(0) === '@' ? (petaSpot[s] || s) : s;
}

function keBaris(alamat, nama, f) {
  const ukuran = Number(f.sz) || 0;
  const harga = Number(f.px) || 0;
  return {
    waktu: Number(f.time) || Date.now(),
    alamat,
    nama,
    koin: namaKoin(f.coin),
    arah: f.side === 'B' ? 'BUY' : 'SELL',
    dir: String(f.dir || ''),
    harga,
    ukuran,
    /* Nilai dolar dihitung di sini, sekali. Layar yang menghitungnya
       sendiri akan mengulanginya di tiap render, dan dua tempat menghitung
       hal yang sama adalah dua tempat yang bisa berbeda hasil. */
    nilai: Math.round(harga * ukuran * 100) / 100,
    pnl: Number(f.closedPnl) || 0,
    hash: String(f.hash || ''),
  };
}

/* ── WR SEPANJANG RIWAYAT BURSA ────────────────────────────────────────
   Dihitung dari `fills` yang MEMANG SUDAH ditarik tiap pindaian. Tidak ada
   panggilan tambahan, tidak ada ongkos tambahan — sebelumnya seluruh array
   itu disaring lalu dibuang, padahal ia memuat riwayat yang justru paling
   ingin diketahui orang saat menimbang sebuah dompet.

   ── BUKAN "SEUMUR HIDUP", DAN ITU HARUS DITULIS ─────────────────────
   Hyperliquid memulangkan MAKSIMAL 2000 fill. Untuk dompet ramai itu cuma
   satu sampai dua bulan terakhir; untuk dompet sepi bisa bertahun. Jadi
   yang jujur disebut "sepanjang riwayat yang diberi bursa", bukan seumur
   hidup — dan tanggal fill tertuanya ikut disimpan supaya layar bisa
   mengatakan sejak kapan angkanya berlaku.

   `terpotong` menandai dompet yang riwayatnya memang menyentuh batas itu:
   WR 85% dari 2000 fill terakhir dan WR 85% dari seluruh hidup dompet
   adalah dua klaim yang berbeda, dan cuma satu yang bisa kita buktikan.

   Pengelompokan fill jadi penutupan memakai aturan yang SAMA dengan yang
   di layar (koin+arah sama, jarak < 5 menit = satu penutupan). Kalau
   berbeda, dua angka WR di kartu yang sama akan dihitung dengan dua
   penggaris — dan yang membaca tidak punya cara tahu. */
const JEDA_SATU_KELUAR = 5 * 60 * 1000;

function riwayatBursa(fills) {
  const tutup = (Array.isArray(fills) ? fills : [])
    .filter((f) => Number(f.closedPnl) !== 0)
    .slice()
    .sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));

  const grup = [];
  for (const l of tutup) {
    const g = grup[grup.length - 1];
    const koin = String(l.coin || '');
    const dir = String(l.dir || '');
    const t = Number(l.time) || 0;
    if (g && g.koin === koin && g.dir === dir && t - g.waktu <= JEDA_SATU_KELUAR) {
      g.pnl += Number(l.closedPnl) || 0;
      g.waktu = t;
    } else {
      grup.push({ koin, dir, pnl: Number(l.closedPnl) || 0, waktu: t });
    }
  }

  const menang = grup.filter((g) => g.pnl > 0).length;
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
  const untung = grup.filter((x) => x.pnl > 0).map((x) => x.pnl);
  const rugi = grup.filter((x) => x.pnl < 0).map((x) => Math.abs(x.pnl));
  const rata = (d) => (d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0);
  const mRata = rata(untung);
  const kRata = rata(rugi);
  const rr = kRata > 0 && mRata > 0 ? Math.round((mRata / kRata) * 100) / 100 : null;

  const waktu = (Array.isArray(fills) ? fills : []).map((f) => Number(f.time) || 0).filter(Boolean);
  return {
    fill: Array.isArray(fills) ? fills.length : 0,
    /* 2000 adalah batas yang diberikan bursa, bukan angka yang kita pilih.
       Ditulis sebagai perbandingan, bukan dipatok, supaya kalau batasnya
       berubah suatu hari penandanya ikut benar dengan sendirinya. */
    terpotong: Array.isArray(fills) && fills.length >= 2000,
    tutup: grup.length,
    menang,
    rr,
    menangRata: Math.round(mRata),
    kalahRata: Math.round(kRata),
    realisasi: Math.round(grup.reduce((n, g) => n + g.pnl, 0) * 100) / 100,
    sejak: waktu.length ? Math.min(...waktu) : 0,
  };
}

async function pindai() {
  const dompet = bacaDompet(DIR);
  if (!dompet.length) {
    catatWallet(DIR, { denyut: Date.now(), posisi: [], galat: '' });
    return;
  }

  await segarkanPetaSpot();
  const batas = batasTerakhir(DIR);
  const semuaBaru = [];
  const semuaPosisi = [];
  const seumur = {};
  const gagal = [];

  for (const d of dompet) {
    try {
      const [isi, fills] = await Promise.all([
        tanya({ type: 'clearinghouseState', user: d.alamat }),
        tanya({ type: 'userFills', user: d.alamat }),
      ]);

      const nilaiAkun = Number(isi?.marginSummary?.accountValue) || 0;
      for (const p of (isi?.assetPositions || [])) {
        const po = p.position || {};
        const sz = Number(po.szi) || 0;
        if (!sz) continue;
        semuaPosisi.push({
          alamat: d.alamat, nama: d.nama,
          koin: namaKoin(po.coin),
          arah: sz > 0 ? 'LONG' : 'SHORT',
          ukuran: Math.abs(sz),
          entry: Number(po.entryPx) || 0,
          nilai: Math.round(Math.abs(Number(po.positionValue) || 0) * 100) / 100,
          pnl: Math.round((Number(po.unrealizedPnl) || 0) * 100) / 100,
          leverage: Number(po?.leverage?.value) || 0,
          likuidasi: Number(po.liquidationPx) || 0,
          nilaiAkun: Math.round(nilaiAkun * 100) / 100,
        });
      }

      /* HANYA yang lebih baru dari yang sudah tercatat. userFills
         memulangkan riwayat panjang tiap kali dipanggil; tanpa batas ini
         setiap putaran akan menulis ulang seluruh riwayat, dan daftar
         transaksinya penuh oleh satu transaksi yang sama berulang-ulang. */
      /* Batas awal = SAAT DOMPET MULAI DIPANTAU, bukan nol. userFills
         memulangkan seluruh riwayat dompet — pada uji pertama satu alamat
         memulangkan 990 transaksi sekaligus, dan dompet seramai itu akan
         mendesak keluar catatan semua dompet lain dari daftar sebelum
         sempat dibaca.

         Riwayat lama juga bukan yang dijanjikan panel ini: yang dicatat
         adalah apa yang dilakukan dompet SELAMA kita memantaunya, supaya
         tiap baris punya waktu yang benar-benar kita saksikan. */
      seumur[d.alamat] = riwayatBursa(fills);

      const sejak = batas[d.alamat] || Number(d.sejak) || Date.now();
      const baru = (Array.isArray(fills) ? fills : [])
        .filter((f) => (Number(f.time) || 0) > sejak)
        .map((f) => keBaris(d.alamat, d.nama, f));
      semuaBaru.push(...baru);
      if (baru.length) catat(d.nama, '·', baru.length, 'transaksi baru');
    } catch (e) {
      gagal.push(d.nama + ': ' + (e && e.message));
      catat('gagal membaca', d.nama, '—', e && e.message);
    }
  }

  catatWallet(DIR, {
    log: semuaBaru,
    posisi: semuaPosisi,
    seumur,
    denyut: Date.now(),
    /* Kegagalan DITULIS, bukan cuma dicetak ke log pm2. Dompet yang gagal
       dibaca menghasilkan panel tanpa posisi — sama persis dengan dompet
       yang memang sedang kosong, dan tanpa baris ini keduanya tidak bisa
       dibedakan dari layar. */
    galat: gagal.join(' · '),
  });
}

/** Mendaftarkan diri di papan supaya kartunya ADA sebelum transaksi
 *  pertama. Tanpa ini "agennya hidup, dompetnya sedang diam" dan "agennya
 *  mati" sama-sama papan kosong. */
async function daftarHadir() {
  if (!APP_TOKEN) return;
  try {
    const r = await fetch(DASAR + '/api/analisa/agen/hadir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
      body: JSON.stringify({
        nama: NAMA_AGEN,
        strategi: 'Membaca posisi dan setiap transaksi dompet perp on-chain '
                + 'yang dipilih pemilik. Fase mencatat: tidak ada order yang '
                + 'dikirim, dan belum ada sinyal yang diterbitkan ke publik.',
        pasangan: bacaDompet(DIR).length,
        tf: '1h',
      }),
    });
    catat(r.ok ? 'terdaftar di papan sebagai ' + NAMA_AGEN : 'daftar hadir ditolak ' + r.status);
  } catch (e) { catat('daftar hadir gagal:', e.message); }
}

(async () => {
  catat('pemantau dompet hidup ·', bacaDompet(DIR).length, 'dompet · jeda', JEDA / 1000, 'detik');
  await daftarHadir();
  await pindai();
  setInterval(() => { void pindai().catch((e) => catat('putaran gagal:', e && e.message)); }, JEDA);
  /* Daftar hadir disegarkan tiap jam supaya "terakhir pindai" di papan
     tidak membeku dan agennya terbaca mati padahal ia bekerja. */
  setInterval(() => { void daftarHadir(); }, 60 * 60 * 1000);
})().catch((e) => {
  console.error('[' + jam() + '] pemantau dompet berhenti:', e && e.message);
  process.exit(1);
});
