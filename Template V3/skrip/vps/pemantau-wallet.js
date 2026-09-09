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
const fs = require('fs');
const path = require('path');
const { bacaDompet, catatWallet, batasTerakhir } = require('./wallet-vps');
const { simbolBinance } = require('./simbol-bursa');
const HL = require('./hyperliquid');
const SalinDompet = require('./salin-dompet');

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

/* ── LONCENG UNTUK KOIN YANG DITIRU ────────────────────────────────────
   Berbunyi HANYA untuk pasangan dompet+koin yang ditandai ditiru. Kalau
   setiap transaksi setiap dompet berbunyi, loncengnya akan berdering
   ratusan kali sehari dan yang pertama kali diabaikan orang adalah lonceng
   yang selalu berbunyi.

   Yang paling penting dari semua kabar di sini: dompet yang ditiru MENUTUP
   posisinya sementara posisi kita masih terbuka. Itu keadaan yang mahal
   kalau terlambat diketahui, dan satu-satunya alasan lonceng ini ada. */
function bacaTiru(DIR) {
  try {
    const d = JSON.parse(require('fs').readFileSync(path.join(DIR, 'wallet-tiru.json'), 'utf8'));
    return (d.tiru || []);
  } catch (e) { return []; }
}

async function lonceng(baris) {
  if (!APP_TOKEN) return;
  try {
    await fetch(DASAR + '/api/kabar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
      body: JSON.stringify(baris),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) { catat('lonceng gagal:', e && e.message); }
}

async function bunyikanTiruan(baru, dompet) {
  const tiru = bacaTiru(DIR);
  if (!tiru.length || !baru.length) return;
  const nama = new Map(dompet.map((d) => [d.alamat, d.nama]));

  for (const l of baru) {
    const cocok = tiru.some((t) => t.alamat === l.alamat && t.koin === String(l.koin).toUpperCase());
    if (!cocok) continue;
    const menutup = /close/i.test(l.dir || '');
    await lonceng({
      /* Id memuat hash fill-nya: satu transaksi cuma boleh berbunyi sekali,
         dan pindaian berikutnya tidak boleh mengulanginya. */
      id: 'tiru-' + String(l.hash || '').slice(0, 24) + '-' + l.koin,
      judul: (menutup ? 'Dompet yang kamu tiru MENUTUP ' : 'Dompet yang kamu tiru menambah ') + l.koin,
      detail: (nama.get(l.alamat) || 'Dompet') + ' · ' + (l.dir || l.arah) + ' ' + l.ukuran
            + ' @ ' + l.harga + (l.pnl ? ' · realisasi ' + Math.round(l.pnl) : ''),
      sumber: NAMA_AGEN,
      jenis: 'pantau',
      tautan: tautanDompet(l.alamat, l.koin),
      waktu: l.waktu,
    });
    catat('  lonceng tiruan:', l.koin, l.dir);
  }
}

/* ══ AUTO-CLOSE ════════════════════════════════════════════════════════
   Menutup posisi tiruan saat dompet sumbernya sudah tidak memegangnya lagi.
   HANYA menutup. Membuka posisi tidak ada di berkas ini dan tidak akan
   ditambahkan tanpa keputusan terpisah.

   ── KENAPA MENUTUP BOLEH DIOTOMATISKAN DAN MEMBUKA BELUM ──────────────
   Keduanya sama-sama mengirim uang sungguhan, tapi tidak sama risikonya.
   Perintah tutup dikirim dengan `reduceOnly` — bursa menolaknya kalau ia
   akan menambah posisi, jadi kesalahan terburuk yang mungkin terjadi adalah
   keluar dari posisi yang seharusnya ditahan. Perintah buka tidak punya
   pagar setara: kesalahan terburuknya adalah masuk ke posisi yang tidak
   pernah diinginkan siapa pun, dengan ukuran yang salah, di koin yang
   salah.

   ── LIMA PAGAR ────────────────────────────────────────────────────────
   1. Cuma koin yang DITANDAI ditiru, dan cuma yang sakelarnya dinyalakan
      satu per satu. Tidak ada satu sakelar untuk semuanya.
   2. Cuma saat dompet sumbernya BENAR-BENAR FLAT di koin itu — bukan
      berkurang, bukan separuh. Pengurangan sebagian adalah keputusan yang
      berbeda, dan menirunya menuntut ukuran yang harus dihitung.
   3. DUA PINDAIAN berturut-turut. Satu jawaban API yang kebetulan kosong
      cukup untuk menutup posisi yang sebenarnya masih hidup, dan itu
      kesalahan yang tidak bisa dibatalkan.
   4. `reduceOnly` di sisi bursa. Pagar terakhir yang tidak bergantung pada
      benarnya kode di sini.
   5. Sakelar mati darurat lewat WALLET_OTO_TUTUP=0, dan tiap eksekusi
      berbunyi di lonceng serta tercatat di log aktivitas.

   Yang TIDAK ada: menutup posisi yang tidak pernah ditandai. Kalau
   penandanya hilang, penjaganya diam — bukan menebak. */
const OTO_AKTIF = process.env.WALLET_OTO_TUTUP !== '0';
const KONFIRMASI_PERLU = Math.max(2, Number(process.env.WALLET_OTO_KONFIRMASI || 2));

/* -- AUTO-OPEN: HARUS DINYALAKAN, TIDAK BISA LUPA DIMATIKAN ----------
   Perhatikan bedanya dengan baris di atas. Auto-close memakai `!== '0'`
   -- hidup kecuali sengaja dimatikan. Auto-open memakai `=== '1'` --
   MATI kecuali sengaja dinyalakan.

   Ketidaksimetrisan itu disengaja, dan alasannya sama dengan alasan
   auto-open tidak pernah ada di berkas ini sampai sekarang: perintah
   tutup dikirim reduceOnly dan kesalahan terburuknya keluar dari posisi
   yang seharusnya ditahan. Perintah buka tidak punya pagar setara. Sesuatu
   yang bisa memasukkan uang ke posisi baru tidak boleh menyala hanya
   karena tidak ada yang menuliskan angka nol di berkas env. */
const BUKA_AKTIF = process.env.WALLET_OTO_BUKA === '1';
/* Berapa posisi salinan boleh hidup bersamaan. Bukan batas dolar -- itu
   sudah dijaga rutenya di server; ini batas BANYAKNYA, supaya dompet yang
   membuka sepuluh koin sekaligus tidak menyeret kita ikut sepuluh. */
const BUKA_MAKS_POSISI = Math.max(1, Number(process.env.WALLET_OTO_BUKA_MAKS || 3));

function tulisTiru(DIR, tiru) {
  const F = path.join(DIR, 'wallet-tiru.json');
  try {
    const semen = F + '.tmp';
    require('fs').writeFileSync(semen, JSON.stringify({ tiru }, null, 2));
    require('fs').renameSync(semen, F);
  } catch (e) { /* penanda gagal ditulis bukan alasan menjatuhkan pemantau */ }
}

async function posisikuBursa() {
  if (!APP_TOKEN) return null;
  try {
    const r = await fetch(DASAR + '/api/positions', {
      headers: { 'X-App-Token': APP_TOKEN }, signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.positions || []).filter((p) => Math.abs(Number(p.positionAmt) || 0) > 0);
  } catch (e) { return null; }
}

/* ══ MENIRU PEMBUKAAN POSISI ═══════════════════════════════════════════
   Kembaran jagaTiruan di sisi sebaliknya. Yang perlu dijelaskan bukan cara
   kerjanya -- itu terbaca dari kodenya -- melainkan kapan ia MENOLAK
   bekerja, karena di situlah seluruh keamanannya berada.

   ── HANYA PERALIHAN, BUKAN KEADAAN ────────────────────────────────────
   Pemicunya BUKAN "dompet sumber sedang memegang koin ini". Kalau begitu,
   menyalakan sakelarnya hari ini akan langsung menyalin posisi yang sudah
   dibuka tiga hari lalu di harga yang sudah jauh lewat -- persis kebalikan
   dari yang diminta, yaitu ikut MASUK saat ia masuk.

   Yang dipicu peralihan `tidak pegang` -> `pegang`, dan peralihan itu cuma
   bisa dilihat kalau keadaan sebelumnya diingat. Itu guna `sumberPegang`.

   Perhatikan bahwa `undefined` -> pegang TIDAK menghitung. Pindaian
   pertama sesudah sakelarnya dinyalakan cuma MENCATAT keadaan, tidak
   bertindak. Tanpa aturan itu, menyalakan sakelar sama saja dengan
   menyalin apa pun yang kebetulan sedang terbuka saat itu.

   ── PAGAR LAIN ────────────────────────────────────────────────────────
   1. Sakelar per pasangan dompet+koin, dinyalakan satu per satu.
   2. Dua pindaian berturut-turut, sama dengan sisi tutup.
   3. Tidak menambah posisi yang sudah kita punya di simbol itu.
   4. Batas banyaknya posisi salinan yang hidup bersamaan.
   5. Batas dolar dan leverage ada di rute servernya, bukan di sini --
      gerbang terakhir sebelum uang bergerak tidak boleh cuma ada di
      pemanggil.
   6. Koin yang tidak ada di Binance dilaporkan, bukan didiamkan. */
async function kirimSalin(simbol, arah, usd, leverage) {
  const r = await fetch(DASAR + '/api/trade/futures/salin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
    body: JSON.stringify({ symbol: simbol, side: arah, usd, leverage }),
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('server menjawab ' + r.status));
  return j;
}

/* ══ MEMILIH BURSA ═════════════════════════════════════════════════════
   Pilihan penggunanya, per dompet, disimpan di `t.bursa`:

     'binance'      cuma Binance. Koin yang tidak ada di sana dilewati.
     'hyperliquid'  cuma Hyperliquid. Bursa asal dompetnya, jadi tidak ada
                    penerjemahan nama dan tidak ada koin yang hilang.
     'dua'          Binance DIUTAMAKAN; Hyperliquid jadi jaring untuk koin
                    yang tidak terdaftar di Binance.

   Kenapa Binance yang diutamakan pada 'dua' dan bukan sebaliknya: itu
   keputusan pemilik, dan alasannya masuk akal -- jalur Binance yang sedang
   diuji, dan menyalin di bursa BERBEDA dari sumbernya adalah justru yang
   ingin ia amati. Hyperliquid lebih setia, tapi kesetiaan bukan satu-
   satunya yang sedang diukur di sini.

   Bawaan `undefined` diperlakukan 'binance': penanda yang dibuat sebelum
   pilihan ini ada tidak boleh tiba-tiba mengirim order ke bursa yang tidak
   pernah dipilih siapa pun. */
/* ══ ADAPTOR BURSA UNTUK MESIN SALIN ═══════════════════════════════════
   Mesin salin tidak tahu apa-apa tentang Binance maupun Hyperliquid — ia
   cuma memanggil `buka` dan `tutup`. Seluruh pengetahuan tentang bursa
   tinggal di sini, dan itu yang membuat mesinnya bisa diuji dengan bursa
   tiruan tanpa satu pun sambungan jaringan.

   Perutean 'dua': Binance DIUTAMAKAN, Hyperliquid jadi jaring untuk koin
   yang tidak terdaftar di sana. */
const adaptorBursa = {
  async buka({ koin, arah, usd, leverage, bursa, sesuaikanMinimum = false }) {
    const mauHl = bursa === 'hyperliquid';
    const mauDua = bursa === 'dua';

    if (!mauHl) {
      let simbol = null;
      try {
        simbol = await simbolBinance(koin, { dasar: DASAR, token: APP_TOKEN, catat });
      } catch (e) {
        /* Bursa bisu -- BUKAN "koinnya tidak ada". Dilempar supaya mesin
           mencatatnya sebagai kegagalan dan mencoba lagi, bukan sebagai
           koin yang perlu dilempar ke Hyperliquid. */
        throw new Error('Binance belum bisa ditanya: ' + (e && e.message));
      }
      if (simbol) {
        const r = await fetch(DASAR + '/api/trade/futures/salin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
          body: JSON.stringify({ symbol: simbol, side: arah, usd, leverage, sesuaikanMinimum }),
          signal: AbortSignal.timeout(30000),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || ('server menjawab ' + r.status));
        /* `usd` dari server = margin yang BENAR-BENAR terpakai; berbeda dari
           yang diminta kalau ukurannya dinaikkan ke minimum bursa. */
        return { bursa: 'binance', simbol, usd: Number(j.usd) > 0 ? Number(j.usd) : usd, disesuaikan: j.disesuaikan === true };
      }
      if (!mauDua) throw new Error(koin + ' tidak ada di Binance Futures');
    }

    if (!HL.siap()) throw new Error('Hyperliquid belum aktif (HL_AKTIF)');
    const aset = await HL.asetHl(koin);
    if (!aset) throw new Error(koin + ' tidak ada di Binance maupun Hyperliquid');
    const h = await HL.bukaHl({ koin: aset.nama, arah, usd, leverage, sesuaikanMinimum });
    return { bursa: 'hyperliquid', simbol: h.koin, usd: Number(h.usd) > 0 ? Number(h.usd) : usd, disesuaikan: h.disesuaikan === true };
  },

  /* ── POTRET POSISI KITA SENDIRI, SATU BENTUK UNTUK DUA BURSA ──────
     Mesin salinan cuma perlu tahu "posisi ini sekarang bagaimana" dan
     tidak boleh peduli bahwa Binance menyebutnya `unRealizedProfit`
     sementara Hyperliquid menyebutnya `unrealizedPnl`. Penerjemahannya
     berhenti di sini, seperti buka dan tutup di atas.

     Kegagalan dipulangkan sebagai daftar KOSONG untuk bursa yang bisu,
     bukan sebagai lemparan: kalau Hyperliquid sedang tidak menjawab,
     posisi Binance tetap layak ditampilkan. Yang hilang cuma separuh
     angkanya, dan itu jauh lebih baik daripada panel kosong. */
  async posisiku() {
    const keluar = [];

    const bn = await posisikuBursa();
    for (const p of (bn || [])) {
      const qty = Number(p.positionAmt) || 0;
      if (!qty) continue;
      const entry = Number(p.entryPrice) || 0;
      const mark = Number(p.markPrice) || 0;
      const lev = Number(p.leverage) || 0;
      /* Nilai posisi dari harga PASAR, bukan harga masuk: yang ditanyakan
         adalah seberapa besar posisi ini sekarang, bukan seberapa besar ia
         waktu dibuka. Jatuh ke harga masuk kalau mark belum terbaca. */
      const nilai = Math.abs(Number(p.notional) || (Math.abs(qty) * (mark || entry)));
      /* Cross tidak punya margin terpisah -- yang benar untuknya adalah
         nilai posisi dibagi leverage, dan itulah angka yang dipakai bursa
         sendiri saat menghitung margin yang tertahan. */
      const isolasi = Number(p.isolatedMargin) || 0;
      keluar.push({
        bursa: 'binance',
        simbol: String(p.symbol || '').toUpperCase(),
        koin: String(p.symbol || '').toUpperCase().replace(/(USDT|USDC|BUSD)$/, ''),
        arah: qty > 0 ? 'LONG' : 'SHORT',
        qty: Math.abs(qty), entry, mark, notional: nilai,
        margin: isolasi > 0 ? isolasi : (lev > 0 ? nilai / lev : 0),
        upnl: Number(p.unRealizedProfit) || 0,
        likuidasi: Number(p.liquidationPrice) || 0,
        leverage: lev,
      });
    }

    if (HL.siap()) {
      try {
        const s = await HL.saldoHl();
        for (const p of (s.posisi || [])) {
          const uk = Number(p.ukuran) || 0;
          keluar.push({
            bursa: 'hyperliquid',
            simbol: String(p.koin || '').toUpperCase(),
            koin: String(p.koin || '').toUpperCase(),
            arah: p.arah,
            qty: uk,
            entry: Number(p.entry) || 0,
            /* Hyperliquid tidak memulangkan mark secara langsung; nilai
               posisi dibagi ukuran ADALAH harga pasarnya. */
            mark: uk > 0 ? (Number(p.nilai) || 0) / uk : 0,
            notional: Number(p.nilai) || 0,
            margin: Number(p.margin) || 0,
            upnl: Number(p.pnl) || 0,
            likuidasi: Number(p.likuidasi) || 0,
            leverage: Number(p.leverage) || 0,
          });
        }
      } catch (e) { catat('  posisiku: Hyperliquid bisu -', (e && e.message) || '?'); }
    }

    return keluar;
  },

  async tutup({ koin, simbol, bursa, arah }) {
    if (bursa === 'hyperliquid') { await HL.tutupHl(simbol || koin); return; }

    /* Ukurannya DIBACA dari bursa, bukan diingat dari waktu membuka.
       Posisi bisa terisi sebagian, ditambah tangan, atau sudah tertutup
       sendiri kena likuidasi -- dan menutup memakai angka yang kita catat
       dulu berarti mengirim perintah untuk posisi yang mungkin sudah tidak
       berbentuk seperti itu lagi. */
    const punyaku = await posisikuBursa();
    if (punyaku === null) throw new Error('posisi bursa tidak terbaca');
    const pos = punyaku.find((p) => String(p.symbol).toUpperCase() === String(simbol).toUpperCase());
    if (!pos) return;   // sudah tidak ada -- tidak ada yang perlu ditutup

    const jumlah = Math.abs(Number(pos.positionAmt) || 0);
    if (!(jumlah > 0)) return;

    const r = await fetch(DASAR + '/api/trade/futures/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
      body: JSON.stringify({
        symbol: simbol,
        /* Arah ORDER PENUTUP, kebalikan dari arah posisinya. Dibaca dari
           tanda positionAmt, bukan dari `arah` yang kita catat: yang di
           bursa itulah yang sedang ditutup. */
        side: Number(pos.positionAmt) > 0 ? 'SELL' : 'BUY',
        quantity: String(jumlah),
      }),
      signal: AbortSignal.timeout(30000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('server menjawab ' + r.status));
  },
};

function bursaPenanda(t) {
  const b = String(t.bursa || 'binance').toLowerCase();
  return (b === 'hyperliquid' || b === 'dua') ? b : 'binance';
}

async function bukaTiruan(posisiDompet) {
  if (!BUKA_AKTIF) return;
  const tiru = bacaTiru(DIR);
  const perlu = tiru.filter((t) => t.otoBuka === true && Number(t.usd) > 0);
  if (!perlu.length) return;

  const punyaku = await posisikuBursa();
  /* Sama seperti sisi tutup: bursa yang bisu dan bursa yang menjawab
     "tidak ada posisi" terlihat sama dari sini, dan yang kedua tidak boleh
     disimpulkan dari yang pertama. */
  if (punyaku === null) { catat('auto-open: posisi bursa tidak terbaca, dilewati'); return; }

  let berubah = false;
  for (const t of perlu) {
    const sumber = posisiDompet.find(
      (p) => p.alamat === t.alamat && String(p.koin).toUpperCase() === t.koin);
    const pegangSekarang = !!sumber;
    const pegangTadi = t.sumberPegang;
    if (pegangTadi !== pegangSekarang) { t.sumberPegang = pegangSekarang; berubah = true; }

    if (!pegangSekarang) {
      if (t.bukaKonfirmasi) { t.bukaKonfirmasi = 0; berubah = true; }
      continue;
    }
    /* Pindaian pertama: catat saja. Lihat catatan panjang di atas. */
    if (pegangTadi !== false) continue;

    const bursa = bursaPenanda(t);

    /* -- HYPERLIQUID SAJA: tidak perlu bertanya ke Binance sama sekali -- */
    if (bursa === 'hyperliquid') {
      if (!HL.siap()) {
        catat('  auto-open:', t.koin, 'dilewati - Hyperliquid belum aktif (HL_AKTIF)');
        continue;
      }
      const aset = await HL.asetHl(t.koin).catch(() => null);
      if (!aset) {
        if (t.takAdaDiBursa !== true) {
          t.takAdaDiBursa = true; berubah = true;
          await lonceng({
            id: 'salin-tiada-hl-' + String(t.alamat).slice(0, 10) + '-' + t.koin,
            judul: t.koin + ' tidak ada di Hyperliquid \u2014 tidak disalin',
            detail: 'Dompet yang kamu tiru membuka ' + t.koin + ', tapi koin itu tidak '
                  + 'diperdagangkan di Hyperliquid perps.',
            sumber: NAMA_AGEN, jenis: 'wallet', waktu: Date.now(),
          });
        }
        continue;
      }
      if (t.takAdaDiBursa) { t.takAdaDiBursa = false; berubah = true; }

      const punyaHl = await HL.saldoHl().catch(() => null);
      if (!punyaHl) { catat('  auto-open: saldo Hyperliquid tidak terbaca, dilewati'); continue; }
      if (punyaHl.posisi.some((p) => String(p.koin).toUpperCase() === aset.nama.toUpperCase())) {
        if (t.bukaKonfirmasi) { t.bukaKonfirmasi = 0; berubah = true; }
        continue;
      }

      t.bukaKonfirmasi = (t.bukaKonfirmasi || 0) + 1; berubah = true;
      if (t.bukaKonfirmasi < KONFIRMASI_PERLU) {
        catat('  auto-open:', t.koin, 'HL konfirmasi', t.bukaKonfirmasi + '/' + KONFIRMASI_PERLU);
        continue;
      }
      if (punyaHl.posisi.length >= BUKA_MAKS_POSISI) {
        catat('  auto-open:', t.koin, 'ditahan - sudah', punyaHl.posisi.length, 'posisi di HL');
        continue;
      }

      try {
        const h = await HL.bukaHl({
          koin: aset.nama, arah: sumber.arah === 'SHORT' ? 'SELL' : 'BUY',
          usd: Number(t.usd), leverage: Math.max(1, Number(t.leverage) || 1),
        });
        t.bukaKonfirmasi = 0; t.terakhirBuka = Date.now();
        t.simbolBuka = aset.nama; t.bursaBuka = 'hyperliquid'; berubah = true;
        if (t.otoTutup !== true) t.otoTutup = true;
        catat('  AUTO-OPEN HL', h.arah, h.koin, 'ukuran', h.ukuran,
              h.terisi ? '(terisi ' + h.terisi.ukuran + ' @ ' + h.terisi.harga + ')' : '(belum terisi)');
        await lonceng({
          id: 'salin-buka-hl-' + aset.nama + '-' + Date.now(),
          judul: 'Salin dompet di Hyperliquid: ' + h.arah + ' ' + h.koin,
          detail: 'Mengikuti ' + (sumber.nama || t.alamat.slice(0, 8)) + ' yang membuka '
                + sumber.arah + ' ' + t.koin + '. Ukuran ' + t.usd + ' USD, ' + h.leverage + 'x'
                + (h.terisi ? ', terisi ' + h.terisi.ukuran + ' @ ' + h.terisi.harga : '') + '.',
          sumber: NAMA_AGEN, jenis: 'wallet', waktu: Date.now(),
        });
      } catch (e) {
        catat('  auto-open HL GAGAL', t.koin + ':', e && e.message);
        await lonceng({
          id: 'salin-gagal-hl-' + t.koin + '-' + Date.now(),
          judul: 'Salin dompet gagal di Hyperliquid: ' + t.koin,
          detail: String((e && e.message) || 'tidak diketahui'),
          sumber: NAMA_AGEN, jenis: 'wallet', waktu: Date.now(),
        });
      }
      continue;
    }

    let simbol;
    try {
      simbol = await simbolBinance(t.koin, { dasar: DASAR, token: APP_TOKEN, catat });
    } catch (e) {
      catat('  auto-open: simbol', t.koin, 'belum bisa dipastikan -', e && e.message);
      continue;
    }

    /* -- 'dua': Binance tidak punya koinnya -> dilempar ke Hyperliquid -- */
    if (!simbol && bursa === 'dua' && HL.siap()) {
      const aset = await HL.asetHl(t.koin).catch(() => null);
      if (aset) {
        t.bukaKonfirmasi = (t.bukaKonfirmasi || 0) + 1; berubah = true;
        if (t.bukaKonfirmasi < KONFIRMASI_PERLU) continue;
        try {
          const h = await HL.bukaHl({
            koin: aset.nama, arah: sumber.arah === 'SHORT' ? 'SELL' : 'BUY',
            usd: Number(t.usd), leverage: Math.max(1, Number(t.leverage) || 1),
          });
          t.bukaKonfirmasi = 0; t.terakhirBuka = Date.now();
          t.simbolBuka = aset.nama; t.bursaBuka = 'hyperliquid'; berubah = true;
          if (t.otoTutup !== true) t.otoTutup = true;
          catat('  AUTO-OPEN HL (jaring)', h.arah, h.koin, h.ukuran);
          await lonceng({
            id: 'salin-buka-hl-' + aset.nama + '-' + Date.now(),
            judul: 'Salin di Hyperliquid: ' + h.arah + ' ' + h.koin,
            detail: t.koin + ' tidak ada di Binance, jadi disalin di Hyperliquid. Ukuran '
                  + t.usd + ' USD, ' + h.leverage + 'x.',
            sumber: NAMA_AGEN, jenis: 'wallet', waktu: Date.now(),
          });
        } catch (e) {
          catat('  auto-open HL (jaring) GAGAL', t.koin + ':', e && e.message);
        }
        continue;
      }
    }

    if (!simbol) {
      /* Jawaban, bukan galat -- dan jawaban yang HARUS sampai ke orangnya,
         kalau tidak ia menyangka salinannya berjalan padahal koin itu
         dilewati diam-diam. Dibunyikan sekali per koin; penandanya baru
         dilepas kalau suatu saat koinnya benar-benar listing. */
      if (t.takAdaDiBinance !== true) {
        t.takAdaDiBinance = true; berubah = true;
        await lonceng({
          id: 'salin-tiada-' + String(t.alamat).slice(0, 10) + '-' + t.koin,
          judul: t.koin + ' tidak ada di Binance \u2014 tidak disalin',
          detail: 'Dompet yang kamu tiru membuka ' + t.koin + ', tapi koin itu tidak terdaftar di '
                + 'Binance Futures. Posisinya tidak dibuka di sana.',
          sumber: NAMA_AGEN, jenis: 'wallet', waktu: Date.now(),
        });
        catat('  auto-open:', t.koin, 'tidak ada di Binance - dilewati');
      }
      continue;
    }
    if (t.takAdaDiBinance) { t.takAdaDiBinance = false; berubah = true; }

    /* Sudah pegang simbol itu -> tidak menambah. Menambah adalah keputusan
       berbeda dengan ukuran yang harus dihitung sendiri. */
    if (punyaku.find((p) => String(p.symbol).toUpperCase() === simbol)) {
      if (t.bukaKonfirmasi) { t.bukaKonfirmasi = 0; berubah = true; }
      continue;
    }

    t.bukaKonfirmasi = (t.bukaKonfirmasi || 0) + 1; berubah = true;
    if (t.bukaKonfirmasi < KONFIRMASI_PERLU) {
      catat('  auto-open:', t.koin, 'konfirmasi', t.bukaKonfirmasi + '/' + KONFIRMASI_PERLU);
      continue;
    }

    if (punyaku.length >= BUKA_MAKS_POSISI) {
      catat('  auto-open:', t.koin, 'ditahan - sudah', punyaku.length, 'posisi terbuka (batas', BUKA_MAKS_POSISI + ')');
      continue;
    }

    const arah = sumber.arah === 'SHORT' ? 'SELL' : 'BUY';
    const usd = Number(t.usd);
    const lev = Math.max(1, Number(t.leverage) || 1);
    try {
      const hasil = await kirimSalin(simbol, arah, usd, lev);
      t.bukaKonfirmasi = 0;
      t.terakhirBuka = Date.now();
      t.simbolBuka = simbol;
      berubah = true;
      /* Ditandai supaya penjaga tutup punya pasangannya: yang dibuka
         otomatis wajib bisa ditutup otomatis juga. */
      if (t.otoTutup !== true) { t.otoTutup = true; }
      catat('  AUTO-OPEN', arah, simbol, 'qty', hasil.quantity, '(~' + usd + ' USD, ' + lev + 'x)');
      await lonceng({
        id: 'salin-buka-' + simbol + '-' + Date.now(),
        judul: 'Salin dompet: ' + arah + ' ' + simbol,
        detail: 'Mengikuti ' + (sumber.nama || t.alamat.slice(0, 8)) + ' yang membuka ' + sumber.arah
              + ' ' + t.koin + '. Ukuran ' + usd + ' USD, leverage ' + lev + 'x, qty ' + hasil.quantity + '.',
        sumber: NAMA_AGEN, jenis: 'wallet', waktu: Date.now(),
        tautan: '/chart-entry?simbol=' + simbol,
      });
    } catch (e) {
      catat('  auto-open GAGAL', simbol + ':', e && e.message);
      await lonceng({
        id: 'salin-gagal-' + simbol + '-' + Date.now(),
        judul: 'Salin dompet gagal: ' + simbol,
        detail: String((e && e.message) || 'tidak diketahui'),
        sumber: NAMA_AGEN, jenis: 'wallet', waktu: Date.now(),
      });
    }
  }

  if (berubah) tulisTiru(DIR, tiru);
}

async function jagaTiruan(posisiDompet) {
  if (!OTO_AKTIF) return;
  const tiru = bacaTiru(DIR);
  const perlu = tiru.filter((t) => t.otoTutup === true);
  if (!perlu.length) return;

  const punyaku = await posisikuBursa();
  /* null = TIDAK BISA BERTANYA ke bursa. Diam, bukan menutup: bursa yang
     tidak menjawab dan bursa yang menjawab "tidak ada posisi" terlihat sama
     dari sini, dan yang kedua tidak boleh disimpulkan dari yang pertama. */
  if (punyaku === null) { catat('auto-close: posisi bursa tidak terbaca, dilewati'); return; }

  let berubah = false;
  for (const t of perlu) {
    /* -- DITUTUP DI TEMPAT IA DIBUKA ----------------------------------
       `bursaBuka` dicatat saat posisinya dibuka. Tanpa itu penjaga ini
       akan mencari posisi Hyperliquid di daftar posisi Binance, tidak
       menemukannya, lalu menyimpulkan "tidak punya apa-apa" -- dan posisi
       sungguhan di Hyperliquid ditinggal terbuka selamanya. */
    if (t.bursaBuka === 'hyperliquid') {
      if (!HL.siap()) continue;
      const sumberMasihHl = posisiDompet.some(
        (p) => p.alamat === t.alamat && String(p.koin).toUpperCase() === t.koin);
      if (sumberMasihHl) { if (t.konfirmasi) { t.konfirmasi = 0; berubah = true; } continue; }
      t.konfirmasi = (t.konfirmasi || 0) + 1; berubah = true;
      if (t.konfirmasi < KONFIRMASI_PERLU) continue;
      try {
        const h = await HL.tutupHl(t.simbolBuka || t.koin);
        t.konfirmasi = 0; t.otoTutup = false; t.bursaBuka = null; berubah = true;
        if (!h.kosong) {
          catat('  AUTO-CLOSE HL', t.koin, 'ditutup', h.ditutup);
          await lonceng({
            id: 'salin-tutup-hl-' + t.koin + '-' + Date.now(),
            judul: 'Posisi ' + t.koin + ' ditutup di Hyperliquid',
            detail: 'Dompet yang kamu tiru sudah tidak memegang ' + t.koin + '.',
            sumber: NAMA_AGEN, jenis: 'wallet', waktu: Date.now(),
          });
        }
      } catch (e) { catat('  auto-close HL GAGAL', t.koin + ':', e && e.message); }
      continue;
    }

    /* -- NAMA KOINNYA DITERJEMAHKAN, BUKAN DITEMPELI 'USDT' -----------
       Dulu di sini `t.koin + 'USDT'`. Untuk BTC benar; untuk kPEPE ia
       menghasilkan KPEPEUSDT -- simbol yang tidak pernah ada di Binance,
       tidak pernah cocok dengan posisi mana pun, dan GAGAL TANPA SUARA:
       penjaganya cuma menyimpulkan "aku tidak punya posisi itu" lalu
       berjalan terus. Sakelar auto-close-nya menyala di layar tapi tidak
       pernah bisa mengeksekusi apa pun. */
    let simbol;
    try {
      simbol = await simbolBinance(t.koin, { dasar: DASAR, token: APP_TOKEN, catat });
    } catch (e) {
      /* BISU, bukan "tidak ada". Bursa yang tidak menjawab tidak boleh
         membuat penjaga ini menyimpulkan apa pun -- alasan yang sama
         dengan penjaga `punyaku === null` di atas. */
      catat('  auto-close: simbol', t.koin, 'belum bisa dipastikan -', e && e.message);
      continue;
    }
    if (!simbol) {
      /* Koinnya memang tidak terdaftar di Binance Futures. Kalau begitu
         posisi tiruannya tidak mungkin pernah dibuka di sana, jadi tidak
         ada yang perlu ditutup. Bukan galat -- jawaban. */
      if (t.konfirmasi) { t.konfirmasi = 0; berubah = true; }
      continue;
    }
    const milik = punyaku.find((p) => String(p.symbol).toUpperCase() === simbol);
    const sumberMasih = posisiDompet.some(
      (p) => p.alamat === t.alamat && String(p.koin).toUpperCase() === t.koin);

    /* Sumbernya masih pegang, ATAU aku memang tidak punya posisi -> tidak
       ada yang perlu dikerjakan, dan hitungan konfirmasinya direset. */
    if (sumberMasih || !milik) {
      if (t.konfirmasi) { t.konfirmasi = 0; berubah = true; }
      continue;
    }

    t.konfirmasi = (t.konfirmasi || 0) + 1;
    berubah = true;
    if (t.konfirmasi < KONFIRMASI_PERLU) {
      catat('auto-close: ' + t.koin + ' menunggu konfirmasi ' + t.konfirmasi + '/' + KONFIRMASI_PERLU);
      continue;
    }

    const jumlah = Math.abs(Number(milik.positionAmt) || 0);
    const arah = Number(milik.positionAmt) > 0 ? 'BUY' : 'SELL';
    catat('auto-close: MENUTUP', simbol, arah, jumlah, '— sumbernya sudah flat');
    try {
      const r = await fetch(DASAR + '/api/trade/futures/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
        body: JSON.stringify({ symbol: simbol, side: arah, quantity: jumlah }),
        signal: AbortSignal.timeout(25000),
      });
      const j = await r.json().catch(() => ({}));
      const sukses = r.ok && !j.error;
      catat(sukses ? '   tertutup' : '   GAGAL: ' + JSON.stringify(j).slice(0, 200));

      await lonceng({
        id: 'oto-tutup-' + simbol + '-' + Date.now(),
        judul: sukses ? 'Posisi ' + simbol + ' ditutup otomatis' : 'Auto-close ' + simbol + ' GAGAL',
        detail: sukses
          ? 'Dompet yang kamu tiru sudah tidak memegang ' + t.koin + '. Posisi ' + arah + ' '
            + jumlah + ' ditutup dengan market reduce-only.'
          : 'Percobaan menutup ditolak bursa. Posisinya MASIH TERBUKA — periksa sendiri sekarang.',
        /* Ikut membawa alamat: yang paling ingin dilihat orang sesudah
           membaca "posisinya ditutup otomatis" adalah chart koin itu,
           beserta apa yang sedang dipegang dompet sumbernya sekarang. */
        sumber: NAMA_AGEN, jenis: 'pantau',
        tautan: tautanDompet(t.alamat, t.koin), waktu: Date.now(),
      });

      /* Penandanya dimatikan sesudah dieksekusi, berhasil maupun gagal.
         Berhasil: tidak ada lagi yang perlu ditutup. Gagal: mencoba lagi
         tiap menit tanpa ada yang melihat adalah cara mengirim dua puluh
         order gagal sebelum orangnya bangun. */
      t.otoTutup = false;
      t.konfirmasi = 0;
      t.terakhir = { waktu: Date.now(), sukses, jumlah, arah };
    } catch (e) {
      catat('   auto-close galat:', e && e.message);
      t.konfirmasi = 0;
    }
  }
  if (berubah) tulisTiru(DIR, tiru);
}

/* ── DOMPET BARU SAJA MEMBUKA POSISI ───────────────────────────────────
   Auto-open sengaja belum dibangun; ini penggantinya, dan untuk sementara
   mungkin lebih baik: kabarnya sampai dalam hitungan detik, tapi yang
   memutuskan tetap orang.

   ── DIBANDINGKAN ANTAR PINDAIAN, BUKAN DIBACA DARI FILL ───────────────
   Fill "Open Long" muncul setiap kali dompet MENAMBAH posisi. Satu masuk
   bertahap bisa memberi dua puluh fill pembuka, dan dua puluh lonceng untuk
   satu keputusan adalah lonceng yang segera dimatikan orang.

   Yang dicari kejadian yang berbeda: koin yang tadinya TIDAK ADA di daftar
   posisi dompet itu, sekarang ada. Itu terjadi sekali per posisi, berapa
   pun jumlah fill yang membentuknya — dan itulah yang benar-benar berarti
   "dia baru saja membuka sesuatu". */
function kunciPosisi(p) { return p.alamat + '|' + String(p.koin).toUpperCase(); }

function posisiSebelumnya(DIR) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, 'wallet-aktivitas.json'), 'utf8'));
    return new Set((d.posisi || []).map(kunciPosisi));
  } catch (e) { return null; }
}

async function bunyikanPosisiBaru(lama, baru) {
  /* null = belum pernah ada potret sebelumnya. Diam: seluruh isi dompet akan
     terlihat "baru dibuka", dan belasan lonceng sekaligus untuk posisi yang
     sudah lama ada adalah kabar yang salah. */
  if (lama === null) return;
  for (const p of baru) {
    if (lama.has(kunciPosisi(p))) continue;
    const jamBuka = new Date().toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    await lonceng({
      /* Menit ikut di dalam id: kalau posisi yang sama muncul-hilang-muncul
         dalam satu menit karena jawaban API berkedip, loncengnya tidak
         berbunyi dua kali. */
      id: 'buka-' + kunciPosisi(p).replace(/[^\w|]/g, '') + '-' + Math.floor(Date.now() / 60000),
      judul: p.nama + ' membuka ' + p.arah + ' ' + p.koin,
      detail: 'Entry ' + p.entry + ' · ukuran ' + p.ukuran
            + (p.leverage ? ' · ' + p.leverage + 'x' : '')
            + ' · nilai $' + Math.round(p.nilai).toLocaleString('id-ID')
            + (p.likuidasi ? ' · likuidasi ' + p.likuidasi : '')
            + ' · terpantau ' + jamBuka,
      sumber: NAMA_AGEN, jenis: 'pantau',
      tautan: tautanDompet(p.alamat, p.koin), waktu: Date.now(),
    });
    catat('  lonceng posisi baru:', p.nama, p.arah, p.koin, '@', p.entry);
  }
}

/* ── UMUR DOMPET, DARI SETORAN PERTAMA ─────────────────────────────────
   Bukan dari fill tertua: userFills dibatasi 2000 baris, jadi untuk dompet
   ramai transaksi tertuanya cuma dua bulan lalu — bukan awal hidupnya.
   Buku besar setoran memulangkan seluruh riwayatnya dan cuma 4 KB.

   Ditarik SEKALI per enam jam, bukan tiap pindaian. Umur dompet berubah nol
   kali dalam sehari, dan menariknya tiap menit berarti 1.440 permintaan
   untuk angka yang sama persis. */
const UMUR_SEGAR = 6 * 60 * 60 * 1000;

/* ══ KENAPA RIWAYAT PENUH TIDAK BOLEH DITARIK TIAP MENIT ═══════════════
   Versi pertama memanggil `userFills` di SETIAP putaran — 632 KB per
   dompet, tiap 60 detik. Dengan sepuluh dompet itu 7,4 GB PER HARI, untuk
   data yang 99,99% sama dengan menit sebelumnya. Sebagai perbandingan,
   seluruh VPS ini baru memindahkan 33 GB masuk dalam 7,5 minggu uptime.

   Yang benar-benar dibutuhkan tiap putaran cuma fill BARU sejak yang
   terakhir tercatat, dan Hyperliquid punya rutenya: `userFillsByTime`
   dengan `startTime`. Untuk jendela beberapa menit ia memulangkan 0,0 KB.

   Diuji sebelum dipakai, dan uji pertamanya nyaris menipu: enam dompet
   dibandingkan pada jendela enam jam dan semuanya memulangkan nol lawan
   nol — "cocok" yang tidak membuktikan apa pun. Baru pada jendela yang
   memang berisi fill perbandingannya berarti: 337, 1.042, dan 1.935 fill
   cocok satu per satu lewat hash+waktu+ukuran. Isinya sama persis.

   Riwayat PENUH tetap ditarik, tapi enam jam sekali — ia cuma dipakai
   menghitung WR, RR, dan umur riwayat, dan ketiganya tidak berubah berarti
   dalam hitungan menit. */
const RIWAYAT_SEGAR = Number(process.env.WALLET_RIWAYAT_JAM || 6) * 60 * 60 * 1000;

async function segarkanUmur(dompet, lamaSeumur) {
  const out = {};
  for (const d of dompet) {
    const lama = lamaSeumur && lamaSeumur[d.alamat];
    if (lama && lama.lahir && Date.now() - (lama.lahirDicek || 0) < UMUR_SEGAR) {
      out[d.alamat] = { lahir: lama.lahir, lahirDicek: lama.lahirDicek };
      continue;
    }
    try {
      const r = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'userNonFundingLedgerUpdates', user: d.alamat, startTime: 0 }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const w = (Array.isArray(j) ? j : []).map((x) => Number(x.time) || 0).filter(Boolean);
      if (w.length) out[d.alamat] = { lahir: Math.min(...w), lahirDicek: Date.now() };
    } catch (e) { /* satu gagal tidak menjatuhkan sisanya */ }
  }
  return out;
}

/* ══ ALAMAT YANG DITUJU SEBUAH LONCENG ═════════════════════════════════
   Sampai sekarang tiap lonceng dompet dikirim dengan `tautan: ''` — ia
   memberi tahu ada kejadian, lalu berhenti di situ. Yang membacanya harus
   membuka Chart & Entry sendiri, mengetik simbolnya sendiri, dan mencari
   sendiri dompet mana yang tadi disebut. Tiga langkah untuk mengerjakan
   satu hal yang sudah diketahui persis oleh loncengnya.

   `?dompet=` bukan parameter baru: ia sudah dipakai tombol "List in Chart"
   di kartu dompet, dan sudah membuka panel kiri berisi seluruh posisi
   dompet itu — persis bilah yang sama dengan panel acuan jiplak. Yang
   kurang cuma satu: tidak ada yang pernah menuliskannya ke dalam lonceng.

   ── KENAPA SIMBOLNYA IKUT, DAN KENAPA IA BISA MELESET ────────────────
   Koin di Hyperliquid tidak selalu punya pasangan USDT di Binance (PURR,
   CASHCAT, dan sebagian koin kecil lain). Untuk koin-koin itu chartnya
   akan kosong — tapi panel kirinya TETAP terisi seluruh posisi dompetnya,
   jadi yang mendarat di sana masih bisa mengklik koin lain. Mendarat di
   chart kosong dengan daftar yang benar di sebelahnya lebih baik daripada
   tidak punya pintu sama sekali. */
function tautanDompet(alamat, koin) {
  const k = String(koin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const a = String(alamat || '').toLowerCase();
  if (!a) return '';
  return '/chart-entry?simbol=' + encodeURIComponent(k + 'USDT')
       + '&dompet=' + encodeURIComponent(a);
}

async function pindai() {
  const dompet = bacaDompet(DIR);
  if (!dompet.length) {
    catatWallet(DIR, { denyut: Date.now(), posisi: [], galat: '' });
    return;
  }

  await segarkanPetaSpot();
  const batas = batasTerakhir(DIR);
  /* Dibaca SEKALI di awal putaran, bukan per dompet: ia menentukan apakah
     riwayat penuh perlu ditarik, dan membacanya belasan kali dari berkas
     yang sama cuma menambah I/O untuk jawaban yang identik. */
  let seumurLama = {};
  try { seumurLama = JSON.parse(fs.readFileSync(path.join(DIR, 'wallet-aktivitas.json'), 'utf8')).seumur || {}; }
  catch (e) { /* putaran pertama */ }

  const semuaBaru = [];
  const semuaPosisi = [];
  const seumur = {};
  /* ── NILAI AKUN DICATAT WALAU POSISINYA NOL ──────────────────────────
     Sampai sekarang angka ini cuma menumpang di tiap baris posisi. Dompet
     yang menutup semuanya lalu menarik dananya jadi tidak punya satu baris
     pun yang membawanya — dan di layar ia terlihat PERSIS sama dengan
     dompet yang gagal dibaca: dua-duanya "tidak ada posisi".

     Dilaporkan pemilik 5 Sep 2026: ia melihat belasan "Close Long" berumur
     puluhan menit di satu dompet, tidak menemukan satu pun posisi terbuka
     di atasnya, lalu bertanya apakah posisinya memang tidak terekam.
     Jawabannya tidak: dompet itu memang kosong, akunnya $0. Yang kurang
     bukan pencatatannya, melainkan satu angka yang mengatakannya. */
  const nilaiAkunPer = {};
  /* Alamat yang jawabannya BENAR-BENAR diterima putaran ini. Dipakai cermin
     untuk membedakan "dompetnya menutup semua posisi" dari "kita gagal
     bertanya" — dua keadaan yang menghasilkan daftar posisi yang sama
     persis: kosong. */
  const terbaca = new Set();
  const gagal = [];
  /* ── PALING BANYAK DUA TARIKAN PENUH PER PUTARAN ─────────────────────
     Riwayat penuh (userFills, 2000 fill) basi serentak untuk semua dompet
     tiap 6 jam, dan dua belas tarikan 2000 fill dalam satu detik dijawab
     Hyperliquid dengan HTTP 429 untuk hampir semuanya (log 6 Sep 12:07 &
     18:10). Dompet yang gagal dibaca tidak punya posisi di putaran itu —
     dan itulah yang membuat cermin Copy Signal menganggap posisinya hilang.
     Dijatah dua per putaran: yang basi tetap segar dalam enam menit, tanpa
     sekali pun menabrak batas laju. */
  let jatahPenuh = 2;

  for (const d of dompet) {
    try {
      /* Batas waktu dihitung DULU: ia yang menentukan jendela permintaan,
         bukan cuma dipakai menyaring hasilnya. Di situlah penghematannya. */
      const sejak = batas[d.alamat] || Number(d.sejak) || Date.now();

      /* Riwayat penuh cuma kalau belum pernah ada, atau sudah basi. Kalau
         tidak, yang ditarik hanya fill sesudah `sejak` — beberapa kilobita,
         sering nol. */
      const seumurLamaIni = seumurLama[d.alamat];
      const basi = !seumurLamaIni
        || !seumurLamaIni.dicek
        || Date.now() - seumurLamaIni.dicek > RIWAYAT_SEGAR;
      const perluPenuh = basi && jatahPenuh > 0;
      if (perluPenuh) jatahPenuh -= 1;

      const [isi, fills] = await Promise.all([
        tanya({ type: 'clearinghouseState', user: d.alamat }),
        perluPenuh
          ? tanya({ type: 'userFills', user: d.alamat })
          /* startTime, BUKAN startTime+1: pagar `> sejak` di bawah tetap
             dipasang, jadi fill tepat di batasnya tidak masuk dua kali.
             Menggeser batasnya di sini akan membuat dua tempat memutuskan
             hal yang sama, dan dua tempat yang harus sepakat selamanya
             cepat atau lambat berselisih. */
          : tanya({ type: 'userFillsByTime', user: d.alamat, startTime: sejak }),
      ]);

      terbaca.add(d.alamat);
      const nilaiAkun = Number(isi?.marginSummary?.accountValue) || 0;
      /* Ditulis SEBELUM perulangan posisi, jadi ia tetap tercatat untuk
         dompet yang tidak punya satu posisi pun — justru dompet itu yang
         paling butuh angkanya. */
      nilaiAkunPer[d.alamat] = Math.round(nilaiAkun * 100) / 100;
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
      /* Ditulis HANYA dari riwayat penuh. Menghitung WR dari jendela
         beberapa menit akan memberi "0 penutupan, WR kosong" dan menimpa
         angka yang benar dengan angka yang tidak berarti — kerusakan yang
         terlihat seperti dompet yang tiba-tiba kehilangan rekam jejaknya.

         Kalau tarikan penuhnya gagal, yang lama DIPERTAHANKAN. Data lama
         yang benar mengalahkan data baru yang kosong. */
      if (perluPenuh && Array.isArray(fills) && fills.length) {
        seumur[d.alamat] = riwayatBursa(fills);
        seumur[d.alamat].dicek = Date.now();
      } else if (seumurLamaIni) {
        seumur[d.alamat] = seumurLamaIni;
      }
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

  /* Potret LAMA dibaca sebelum ditimpa — sesudahnya tidak ada lagi cara
     tahu apa yang berubah. */
  const posisiLama = posisiSebelumnya(DIR);

  /* Umur digabung ke `seumur` yang sudah ada, bukan berkas sendiri: keduanya
     menjawab pertanyaan yang sama ("dompet ini sudah berapa lama dan
     sebagus apa") dan dibaca bersamaan di layar. */
  const umur = await segarkanUmur(dompet, seumurLama);
  for (const a of Object.keys(umur)) {
    seumur[a] = Object.assign({}, seumur[a] || {}, umur[a]);
  }
  /* Ditempel PALING AKHIR supaya ia tidak bisa terhapus oleh penggabungan
     di atas — dan hanya untuk dompet yang benar-benar terbaca putaran ini.
     Dompet yang gagal dibaca mempertahankan angka lamanya, sama seperti
     WR dan umurnya: data lama yang benar mengalahkan nol yang baru. */
  for (const a of Object.keys(nilaiAkunPer)) {
    seumur[a] = Object.assign({}, seumur[a] || {}, { nilaiAkun: nilaiAkunPer[a] });
  }

  /* Dibunyikan SEBELUM disimpan? Tidak — sesudah. Kalau prosesnya mati di
     tengah, catatan yang sudah tersimpan tanpa lonceng lebih baik daripada
     lonceng yang berbunyi untuk transaksi yang tidak pernah tercatat. */
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

  try { await bunyikanPosisiBaru(posisiLama, semuaPosisi); }
  catch (e) { catat('lonceng posisi baru gagal:', e && e.message); }

  try { await bunyikanTiruan(semuaBaru, dompet); }
  catch (e) { catat('lonceng tiruan gagal:', e && e.message); }

  /* SESUDAH potret disimpan, dan itu penting: kalau proses ini mati di
     tengah penerbitan, catatan posisinya sudah aman di berkas dan putaran
     berikutnya melanjutkan dari keadaan yang benar. */
  try { await cerminPutaran(DIR, dompet, semuaPosisi, semuaBaru, terbaca); }
  catch (e) { catat('cermin dompet gagal:', e && e.message); }

  /* Dijalankan dengan potret posisi yang BARU SAJA dibaca di putaran ini,
     bukan dengan berkas yang tersimpan. Membaca ulang berkasnya berarti
     memutuskan dari data yang usianya satu putaran — dan satu putaran cukup
     untuk sebuah posisi dibuka lagi. */
  try { await jagaTiruan(semuaPosisi); }
  catch (e) { catat('auto-close gagal:', e && e.message); }

  /* SESUDAH auto-close, bukan sebelum. Kalau sebuah koin ditutup dan
     dibuka lagi dalam satu putaran, urutan ini yang benar: keluar dulu,
     baru pertimbangkan masuk. Urutan terbalik akan melihat posisi yang
     sebentar lagi ditutup sebagai "sudah punya" lalu melewatkannya. */
  try { await bukaTiruan(semuaPosisi); }
  catch (e) { catat('auto-open gagal:', e && e.message); }

  /* ── SALIN DOMPET (per dompet, menggantikan penandaan per koin) ──── */
  try {
    await SalinDompet.putaran({
      dir: DIR, posisiDompet: semuaPosisi, catat,
      lonceng: (b) => lonceng({ ...b, sumber: NAMA_AGEN, jenis: 'wallet', waktu: Date.now() }),
      bursa: adaptorBursa,
    });
  } catch (e) { catat('salin dompet gagal:', e && e.message); }
}

/* ══ CERMIN DOMPET -> COPY SIGNAL ══════════════════════════════════════
   Dompet yang ditandai `analis: true` di daftar pantau punya kartunya
   SENDIRI di Copy Signal, terpisah dari kartu "AI Wallet" milik pemantau
   ini. Tiap posisi yang ia buka jadi satu sinyal; tiap posisi yang ia tutup
   menutup sinyal itu dengan hasil dompetnya sendiri.

   ── TANPA SL DAN TP, DAN ITU DISENGAJA ──────────────────────────────────
   Dompet perp on-chain kebanyakan tidak memasang keduanya di bursa. Yang
   dikirim ke sini adalah apa yang benar-benar terlihat: harga masuk, arah,
   ukuran. Mengarang SL dari likuidasi atau TP dari "rata-rata target"
   berarti menerbitkan rencana yang tidak pernah dipunyai orangnya.

   Akibatnya penilai harga di server melewatkannya sendiri — dua-duanya
   sudah berhenti pada `if (!entry || !sl) continue;` — dan yang menutupnya
   HARUS proses ini, lewat /api/analisa/agen/tutup.

   ── HASILNYA DIUKUR TERHADAP MARGIN ─────────────────────────────────────
   Tidak ada SL berarti tidak ada satuan risiko. Yang dipakai sebagai
   penggantinya: laba/rugi dibagi MARGIN yang dompet itu pertaruhkan
   (nilai posisi dibagi leverage). +0,4 berarti ia menutup dengan untung 40%
   dari marginnya sendiri. Itu ukuran yang benar-benar terjadi, bukan
   perbandingan terhadap stop yang tidak ada.

   ── SATU BERKAS PENGHUBUNG ──────────────────────────────────────────────
   `wallet-cermin.json` memetakan alamat|KOIN ke id sinyalnya. Tanpa itu,
   posisi yang tutup tidak punya cara menemukan sinyal mana yang harus
   diselesaikan, dan papan akan penuh sinyal yang berjalan selamanya. */
const CERMIN_FILE = 'wallet-cermin.json';

function bacaCermin(DIR) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, CERMIN_FILE), 'utf8'));
    return (j && typeof j === 'object' && j.buka) ? j : { buka: {} };
  } catch (e) { return { buka: {} }; }
}

function tulisCermin(DIR, d) {
  const tmp = path.join(DIR, CERMIN_FILE) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, path.join(DIR, CERMIN_FILE));
}

/** Margin yang dipertaruhkan posisi ini. 0 kalau tidak terbaca — dan 0
 *  dipakai untuk MELEWATI penutupan, bukan untuk membagi: pembagian dengan
 *  nol memulangkan Infinity, dan Infinity yang lolos ke papan peringkat
 *  memenangkan kartu itu selamanya. */
function marginPosisi(p) {
  const lev = Number(p.leverage) || 0;
  const nilai = Math.abs(Number(p.nilai) || 0);
  return lev > 0 ? nilai / lev : 0;
}

async function kirimSinyalDompet(d, p) {
  const arah = p.arah === 'LONG' ? 'BUY' : 'SELL';
  const r = await fetch(DASAR + '/api/analisa/agen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
    body: JSON.stringify({
      agenNama: d.nama,
      dompet: true,
      judul: arah + ' ' + p.koin + ' mengikuti dompet',
      pasangan: p.koin + 'USDT',
      arah,
      tf: '1h',
      pasar: 'kripto',
      ringkas: 'Dompet ' + d.nama + ' membuka ' + p.arah + ' ' + p.koin
             + ' di ' + p.entry + (p.leverage ? ' · ' + p.leverage + 'x' : '')
             + ' · nilai $' + Math.round(p.nilai).toLocaleString('id-ID')
             + '. Tanpa SL dan TP — persis seperti yang dipasang dompetnya.',
      isi: {
        entry: p.entry, sl: 0, tp: 0,
        alasan: 'Cermin posisi on-chain. Sinyal ini tidak memasang stop loss '
              + 'maupun take profit karena dompet yang dicerminkan tidak '
              + 'memasangnya di bursa. Ia selesai saat dompet itu menutup '
              + 'posisinya, dengan hasil apa adanya.'
              + (p.likuidasi ? ' Harga likuidasi dompet: ' + p.likuidasi + '.' : ''),
      },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('server menjawab ' + r.status));
  return j.id;
}

async function tutupSinyalDompet(id, rr) {
  const r = await fetch(DASAR + '/api/analisa/agen/tutup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
    body: JSON.stringify({ id, rr }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || ('server menjawab ' + r.status));
  }
}

/** Satu putaran cermin: posisi baru diterbitkan, posisi yang hilang ditutup.
 *
 *  `fillBaru` adalah transaksi yang MEMANG SUDAH ditarik putaran ini — dari
 *  situ laba/rugi penutupan dibaca (`closedPnl`). Kalau posisinya hilang
 *  tanpa satu pun fill terlihat di jendela ini (mis. pemantau sempat mati),
 *  dipakai P/L mengambang terakhir yang tercatat: kurang tepat, tapi jauh
 *  lebih dekat daripada menganggapnya impas. */
function persenDari(bagian, dasar) {
  return dasar > 0 ? Math.round((bagian / dasar) * 1000) / 10 : 0;
}

/* Harga rata-rata tertimbang fill koin itu di putaran ini — harga tempat
   penambahan/pengurangannya benar-benar terjadi. Nol kalau tidak ada fill
   (pemanggil jatuh ke entry rata-rata posisi). */
function hargaFillPutaran(fillBaru, alamat, koin) {
  let u = 0, n = 0;
  for (const f of (Array.isArray(fillBaru) ? fillBaru : [])) {
    if (f.alamat !== alamat || String(f.koin).toUpperCase() !== koin) continue;
    const q = Math.abs(Number(f.ukuran) || 0);
    u += q; n += q * (Number(f.harga) || 0);
  }
  return u > 0 ? Math.round((n / u) * 1e8) / 1e8 : 0;
}

async function ubahSinyalDompet(rec) {
  const r = await fetch(DASAR + '/api/analisa/agen/ubah', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
    body: JSON.stringify({
      id: rec.id, entry: rec.entry, ukuran: rec.ukuran, ukuranMaks: rec.ukuranMaks, tahap: rec.tahap,
    }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || ('server menjawab ' + r.status));
  }
}

/* ── JEJAK UKURAN: SATU SINYAL PER POSISI, BUKAN SATU PER PENAMBAHAN ────
   Hyperliquid memegang SATU posisi bersih per koin: menambah tidak membuka
   posisi kedua, ia menggeser ukuran dan entry rata-ratanya (entryPx). Yang
   diminta pemilik 7 Sep 2026: kartu sinyalnya juga satu — entry ikut
   rata-rata baru saat ditambah, dan tiap pengurangan dicatat sebagai
   "tutup X% dari posisi terbesarnya" beserta P/L fill-nya, supaya orang
   yang menyalin tahu berapa yang sudah direalisasikan dompetnya.

   Persennya DARI UKURAN TERBESAR yang pernah dipegang, bukan dari ukuran
   sesaat sebelumnya: "tutup 50%" dua kali berturut-turut dari sisa yang
   makin kecil membuat orang mengira posisinya sudah habis, padahal masih
   seperempat. Dari puncaknya, angkanya bisa dijumlahkan.

   Catatan lama (sebelum medan ini ada) diisi ukuran pada pertemuan
   pertama tanpa tahap — tidak ada yang bisa dikatakan tentang apa yang
   terjadi sebelum kita mulai menghitung. Memulangkan true kalau ada yang
   berubah di catatannya. */
async function jejakUkuran(rec, p, fillBaru, alamat, koin) {
  const kini = Number(p.ukuran) || 0;
  if (!(kini > 0)) return false;
  if (!(Number(rec.ukuran) > 0)) {
    rec.ukuran = kini; rec.ukuranMaks = kini; rec.tahap = rec.tahap || [];
    return true;
  }
  const lama = Number(rec.ukuran);
  const selisih = kini - lama;
  if (Math.abs(selisih) <= lama * 0.001) return false;

  rec.tahap = rec.tahap || [];
  rec.ukuranMaks = Math.max(Number(rec.ukuranMaks) || 0, kini);
  const hargaFill = hargaFillPutaran(fillBaru, alamat, koin);
  if (selisih > 0) {
    /* entryPx Hyperliquid SUDAH rata-rata tertimbang seluruh posisi. */
    rec.entry = Number(p.entry) || rec.entry;
    rec.margin = Math.max(Number(rec.margin) || 0, marginPosisi(p));
    rec.tahap.push({
      w: Date.now(), j: 'tambah',
      persen: persenDari(selisih, rec.ukuranMaks),
      harga: hargaFill || Number(p.entry) || 0, ukuran: selisih,
    });
  } else {
    const pnlFill = (Array.isArray(fillBaru) ? fillBaru : [])
      .filter((f) => f.alamat === alamat && String(f.koin).toUpperCase() === koin)
      .reduce((t, f) => t + (Number(f.pnl) || 0), 0);
    /* P/L parsial DIAKUMULASI ke pnlTutup: penutupan akhir nanti memakai
       jumlah seluruh realisasi, bukan cuma keping terakhirnya. */
    rec.pnlTutup = (Number(rec.pnlTutup) || 0) + pnlFill;
    rec.tahap.push({
      w: Date.now(), j: 'kurang',
      persen: persenDari(-selisih, rec.ukuranMaks),
      harga: hargaFill || 0, ukuran: -selisih,
      pnl: Math.round(pnlFill * 100) / 100,
    });
  }
  if (rec.tahap.length > 60) rec.tahap = rec.tahap.slice(-60);
  rec.ukuran = kini;
  try { await ubahSinyalDompet(rec); }
  catch (e) { catat('cermin gagal memperbarui', rec.id, koin, '—', e && e.message); }
  return true;
}

async function cerminPutaran(DIR, dompet, posisi, fillBaru, terbaca) {
  if (!APP_TOKEN) return;
  /* ── DUA HIMPUNAN, DAN BEDANYA YANG DULU MENGHAPUS SINYAL ──────────────
     `semuaAnalis` = dompet yang sakelar analisnya menyala. `analis` =
     yang dari antaranya BERHASIL DIBACA putaran ini. Dulu cuma ada yang
     kedua, dan ia dipakai untuk memutuskan "sakelarnya dicabut" — jadi
     tiap kali Hyperliquid menjawab 429 (tiap 6 jam, saat 12 tarikan
     riwayat penuh berangkat serentak), dompetnya terlihat seperti dicabut,
     catatannya dibuang, dan putaran berikutnya posisi yang SAMA terbit
     sebagai sinyal baru. Dompet a99c9e punya 11 pasang "BUY HYPE" +
     "BUY BTC" dengan entry identik karena ini. Dompet yang tidak terbaca
     sekarang cuma dilewati: tidak dibuka, tidak ditutup, tidak dibuang. */
  const semuaAnalis = dompet.filter((d) => d.analis);
  const analis = semuaAnalis.filter((d) => !terbaca || terbaca.has(d.alamat));
  if (!semuaAnalis.length) return;

  const c = bacaCermin(DIR);
  c.buka = c.buka || {};
  let berubah = false;

  const alamatAnalis = new Set(semuaAnalis.map((d) => d.alamat));
  const alamatTerbaca = new Set(analis.map((d) => d.alamat));
  const hidup = new Map();
  for (const p of posisi) {
    if (alamatAnalis.has(p.alamat)) hidup.set(p.alamat + '|' + String(p.koin).toUpperCase(), p);
  }

  /* ── Posisi baru -> sinyal baru ─────────────────────────────────────── */
  for (const [kunci, p] of hidup) {
    const ada = c.buka[kunci];
    if (ada) {
      /* P/L mengambang terakhir disimpan tiap putaran — ia jadi jaring
         pengaman saat penutupannya tidak terlihat lewat fill. */
      if (Number.isFinite(Number(p.pnl))) { ada.pnlAkhir = Number(p.pnl); berubah = true; }
      const [alamatIni, koinIni] = kunci.split('|');
      if (await jejakUkuran(ada, p, fillBaru, alamatIni, koinIni)) berubah = true;
      continue;
    }
    const d = analis.find((x) => x.alamat === p.alamat);
    const margin = marginPosisi(p);
    if (!p.entry || margin <= 0) {
      catat('cermin dilewati (entry/margin tidak terbaca):', p.nama, p.koin);
      continue;
    }
    try {
      const id = await kirimSinyalDompet(d, p);
      c.buka[kunci] = {
        id, dibuka: Date.now(), margin, arah: p.arah, entry: p.entry, pnlAkhir: Number(p.pnl) || 0,
        ukuran: Number(p.ukuran) || 0, ukuranMaks: Number(p.ukuran) || 0, tahap: [],
      };
      berubah = true;
      catat('cermin: sinyal', id, 'dari', d.nama, p.arah, p.koin, '@', p.entry);
    } catch (e) {
      catat('cermin gagal memposting', p.koin, '—', e && e.message);
    }
  }

  /* ── Posisi hilang -> sinyal ditutup ──────────────────────────────────
     TAPI TIDAK PADA PUTARAN PERTAMA IA MENGHILANG. Hyperliquid sesekali
     memulangkan daftar posisi yang belum lengkap, dan bacaan yang gagal
     total sudah disaring di atas — yang tersisa kedipan: posisi ada di
     putaran N, tidak ada di N+1, ada lagi di N+2.

     Tanpa pagar ini kedipan itu menutup sinyalnya lalu membuka sinyal BARU
     untuk posisi yang sama, dan papan mencatat satu perdagangan sebagai dua
     kemenangan. Terlihat di data: BTC milik Dompet 118ce6 tercatat +83,80
     DAN +81,96; ETH +60,69 DAN +58,35 — pasangan-pasangan yang selisihnya
     cuma pergerakan harga beberapa menit.

     Dua putaran (dua menit) cukup: penutupan sungguhan tetap tercatat satu
     menit kemudian, dan kedipan satu putaran tidak pernah lolos. */
  for (const kunci of Object.keys(c.buka)) {
    if (hidup.has(kunci)) {
      if (c.buka[kunci].hilang) { c.buka[kunci].hilang = 0; berubah = true; }
      continue;
    }
    const rec = c.buka[kunci];
    const [alamat, koin] = kunci.split('|');
    if (!alamatAnalis.has(alamat)) {
      /* Sakelar analisnya dicabut sementara posisinya masih terbuka.
         Catatannya dibuang tanpa menutup sinyal: yang mencabut memilih
         berhenti mencerminkan, bukan menyatakan hasilnya. */
      delete c.buka[kunci]; berubah = true; continue;
    }
    /* Tidak terbaca putaran ini = tidak tahu apa-apa. Bukan hilang, bukan
       hidup — dilewati, dan hitungan `hilang`-nya tidak bertambah. */
    if (!alamatTerbaca.has(alamat)) continue;
    /* Fill penutupan dikumpulkan LINTAS PUTARAN, bukan cuma dari putaran
       ini: penutupannya terjadi di putaran saat posisinya menghilang, dan
       kita baru menutup sinyalnya satu putaran sesudahnya. Tanpa ini
       angkanya selalu jatuh ke cadangan. */
    const fillKini = (Array.isArray(fillBaru) ? fillBaru : [])
      .filter((f) => f.alamat === alamat && String(f.koin).toUpperCase() === koin)
      .reduce((t, f) => t + (Number(f.pnl) || 0), 0);
    rec.pnlTutup = (Number(rec.pnlTutup) || 0) + fillKini;

    rec.hilang = (Number(rec.hilang) || 0) + 1;
    if (rec.hilang < 2) { berubah = true; continue; }

    /* P/L SUNGGUHAN dari fill kalau ada. Cadangannya P/L mengambang
       terakhir — dan itu memang taksiran, bukan hasil: ia dipakai hanya
       kalau bursa tidak pernah menunjukkan isian penutupnya sama sekali. */
    const pnl = rec.pnlTutup !== 0 ? rec.pnlTutup : (Number(rec.pnlAkhir) || 0);
    const margin = Number(rec.margin) || 0;
    if (margin <= 0) { delete c.buka[kunci]; berubah = true; continue; }
    const rr = Math.round((pnl / margin) * 10000) / 10000;
    /* Sisa posisinya dicatat sebagai tahap terakhir SEBELUM ditutup, supaya
       jumlah persen di kartu menutup ke 100 dan orang tahu berapa yang
       dilepas di ujung — bukan cuma bahwa ia selesai. */
    if (Number(rec.ukuranMaks) > 0 && Number(rec.ukuran) > 0) {
      rec.tahap = rec.tahap || [];
      rec.tahap.push({
        w: Date.now(), j: 'kurang',
        persen: persenDari(Number(rec.ukuran), Number(rec.ukuranMaks)),
        harga: hargaFillPutaran(fillBaru, alamat, koin) || 0,
        ukuran: Number(rec.ukuran), pnl: Math.round(fillKini * 100) / 100,
      });
      rec.ukuran = 0;
      try { await ubahSinyalDompet(rec); }
      catch (e) { catat('cermin gagal mencatat tahap akhir', rec.id, '—', e && e.message); }
    }
    try {
      await tutupSinyalDompet(rec.id, rr);
      catat('cermin: tutup', rec.id, koin, 'pnl $' + pnl.toFixed(2), '=', rr + 'R');
    } catch (e) {
      catat('cermin gagal menutup', rec.id, '—', e && e.message);
    }
    /* Dibuang APA PUN hasil panggilannya. Kalau server menolak (mis. sinyalnya
       sudah selesai lewat jalan lain), menyimpannya cuma membuat putaran
       berikutnya mencoba lagi selamanya untuk posisi yang sudah tidak ada. */
    delete c.buka[kunci];
    berubah = true;
  }

  if (berubah) tulisCermin(DIR, c);
}

/** Kartu tiap dompet analis lahir SEBELUM posisi pertamanya, sama seperti
 *  agen lain. Dompet yang sedang tidak pegang apa-apa dan dompet yang belum
 *  pernah didaftarkan sama-sama papan kosong tanpa ini. */
async function daftarHadirAnalis(dompet) {
  if (!APP_TOKEN) return;
  for (const d of dompet.filter((x) => x.analis)) {
    try {
      await fetch(DASAR + '/api/analisa/agen/hadir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
        body: JSON.stringify({
          nama: d.nama,
          strategi: 'Cermin dompet perp on-chain ' + d.alamat.slice(0, 6) + '…' + d.alamat.slice(-4)
                  + '. Tiap posisi yang dibuka dompet ini diterbitkan apa adanya — '
                  + 'tanpa SL dan tanpa TP, karena dompetnya tidak memasangnya — '
                  + 'dan ditutup saat dompetnya menutup posisi.',
          pasangan: 0,
          tf: '1h',
        }),
      });
    } catch (e) { catat('daftar hadir analis gagal:', d.nama, e && e.message); }
  }
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
  await daftarHadirAnalis(bacaDompet(DIR));
  await pindai();
  setInterval(() => { void pindai().catch((e) => catat('putaran gagal:', e && e.message)); }, JEDA);
  /* Daftar hadir disegarkan tiap jam supaya "terakhir pindai" di papan
     tidak membeku dan agennya terbaca mati padahal ia bekerja. */
  setInterval(() => {
    void daftarHadir();
    /* Daftar dompet dibaca ULANG tiap jam, bukan dipakai yang di awal:
       dompet yang dijadikan analis siang hari tidak boleh menunggu proses
       ini di-restart supaya kartunya lahir. */
    void daftarHadirAnalis(bacaDompet(DIR));
  }, 60 * 60 * 1000);
})().catch((e) => {
  console.error('[' + jam() + '] pemantau dompet berhenti:', e && e.message);
  process.exit(1);
});
