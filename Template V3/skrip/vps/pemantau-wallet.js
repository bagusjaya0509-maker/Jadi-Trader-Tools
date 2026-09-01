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
  async buka({ koin, arah, usd, leverage, bursa }) {
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
          body: JSON.stringify({ symbol: simbol, side: arah, usd, leverage }),
          signal: AbortSignal.timeout(30000),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || ('server menjawab ' + r.status));
        return { bursa: 'binance', simbol };
      }
      if (!mauDua) throw new Error(koin + ' tidak ada di Binance Futures');
    }

    if (!HL.siap()) throw new Error('Hyperliquid belum aktif (HL_AKTIF)');
    const aset = await HL.asetHl(koin);
    if (!aset) throw new Error(koin + ' tidak ada di Binance maupun Hyperliquid');
    const h = await HL.bukaHl({ koin: aset.nama, arah, usd, leverage });
    return { bursa: 'hyperliquid', simbol: h.koin };
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
  const gagal = [];

  for (const d of dompet) {
    try {
      /* Batas waktu dihitung DULU: ia yang menentukan jendela permintaan,
         bukan cuma dipakai menyaring hasilnya. Di situlah penghematannya. */
      const sejak = batas[d.alamat] || Number(d.sejak) || Date.now();

      /* Riwayat penuh cuma kalau belum pernah ada, atau sudah basi. Kalau
         tidak, yang ditarik hanya fill sesudah `sejak` — beberapa kilobita,
         sering nol. */
      const seumurLamaIni = seumurLama[d.alamat];
      const perluPenuh = !seumurLamaIni
        || !seumurLamaIni.dicek
        || Date.now() - seumurLamaIni.dicek > RIWAYAT_SEGAR;

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
