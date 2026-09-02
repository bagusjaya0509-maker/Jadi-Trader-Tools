/* ══════════════════════════════════════════════════════════════════════════
   hyperliquid.js — eksekusi order di Hyperliquid untuk salin dompet
   ══════════════════════════════════════════════════════════════════════════
   Dompet yang dipantau HIDUP di Hyperliquid. Menyalinnya di sini berarti
   bursa yang sama, instrumen yang sama, dan tidak ada penerjemahan nama —
   salinan yang paling setia yang bisa dibuat. Binance tetap ada sebagai
   jalur pilihan; yang memilih penggunanya, per dompet.

   ── TIGA HAL YANG SUDAH MEMAKAN WAKTU, DITULIS SUPAYA TIDAK TERULANG ───

   1. AKUN UNIFIED: SALDONYA TIDAK ADA DI `accountValue`.
      `clearinghouseState.marginSummary.accountValue` untuk sub-account ini
      menjawab **0** padahal saldonya USDC 300. Di akun unified, dananya
      tercatat di `spotClearinghouseState`. Memakai accountValue sebagai
      pemeriksa margin berarti SETIAP order ditolak sendiri sebelum
      berangkat — dan gejalanya terlihat seperti "tidak terjadi apa-apa",
      bukan seperti galat.

   2. AGENT DISETUJUI DI AKUN UTAMA, BUKAN DI SUB-ACCOUNT.
      `extraAgents` pada sub-account menjawab `[]`, dan itu NORMAL —
      bukan tanda otorisasinya gagal. Eksekusi ke sub-account dilakukan
      dengan menandatangani memakai kunci agent lalu mengoper
      `{ vaultAddress: <sub-account> }`. Sudah dibuktikan lewat
      `updateLeverage` yang menjawab `{status:'ok'}`.

   3. HYPERLIQUID TIDAK PUNYA ORDER "MARKET".
      Yang ada limit IOC. Order pasar ditiru dengan menaruh harga yang
      MENYEBERANGI buku — di atas ask untuk beli, di bawah bid untuk jual.
      Selisihnya (`SELISIH_PASAR`) bukan slippage yang kita terima, cuma
      batas seberapa jauh order boleh mengejar; yang tidak terisi dalam
      seketika langsung batal, itulah arti IOC.

   ── ATURAN ANGKA HYPERLIQUID ───────────────────────────────────────────
   Ukuran dibulatkan ke `szDecimals` milik koinnya. Harga punya dua batas
   sekaligus: maksimal 5 angka penting, DAN maksimal `6 - szDecimals`
   desimal. Melanggar salah satunya membuat order ditolak dengan pesan
   yang tidak menyebut angka mana yang salah.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

require('dotenv').config();

const AKUN = (process.env.HL_AKUN || '').trim();
const KUNCI = (process.env.HL_AGENT_KEY || '').trim();
/* Sengaja `=== '1'`, bukan `!== '0'` — alasan yang sama dengan
   WALLET_OTO_BUKA: sesuatu yang bisa memasukkan uang ke posisi baru tidak
   boleh menyala hanya karena tidak ada yang menuliskan angka nol. */
const HL_AKTIF = process.env.HL_AKTIF === '1';
const HL_MAKS_USD = Math.max(1, Number(process.env.HL_MAKS_USD || 60));
const HL_MAKS_LEV = Math.max(1, Number(process.env.HL_MAKS_LEV || 3));
const SELISIH_PASAR = 0.03;   // 3% ruang mengejar buku untuk IOC

let _hl = null;
function pustaka() {
  if (!_hl) {
    const hl = require('@nktkas/hyperliquid');
    const { Wallet } = require('ethers');
    const transport = new hl.HttpTransport();
    _hl = {
      info: new hl.InfoClient({ transport }),
      /* Klien eksekusi dibuat hanya kalau kuncinya ada. Membuatnya dengan
         kunci kosong melempar di tempat yang jauh dari sebabnya. */
      ex: KUNCI ? new hl.ExchangeClient({ wallet: new Wallet(KUNCI), transport }) : null,
    };
  }
  return _hl;
}

function siap() {
  return !!(HL_AKTIF && AKUN && KUNCI);
}

/* Daftar koin + aturan angkanya. Diingat: universe berubah saat ada koin
   baru listing, bukan tiap menit. */
let _meta = null, _metaWaktu = 0;
const META_UMUR = 30 * 60 * 1000;
async function meta() {
  if (_meta && Date.now() - _metaWaktu < META_UMUR) return _meta;
  _meta = await pustaka().info.meta();
  _metaWaktu = Date.now();
  return _meta;
}

/** Indeks aset + szDecimals untuk sebuah koin, atau null kalau koin itu
 *  tidak diperdagangkan di Hyperliquid perps. null = jawaban, bukan galat. */
async function asetHl(koin) {
  const k = String(koin || '').trim();
  const m = await meta();
  const i = (m.universe || []).findIndex(
    (u) => String(u.name).toUpperCase() === k.toUpperCase());
  if (i < 0) return null;
  return { indeks: i, szDecimals: Number(m.universe[i].szDecimals) || 0,
           maxLeverage: Number(m.universe[i].maxLeverage) || 1, nama: m.universe[i].name };
}

/** Saldo yang benar-benar bisa dipakai membuka posisi, dalam USD.
 *  Menjumlahkan DUA sumber karena akun unified menaruh dananya di spot
 *  sementara akun biasa menaruhnya di perps — lihat catatan (1) di atas. */
async function saldoHl() {
  const { info } = pustaka();
  const [perp, spot] = await Promise.all([
    info.clearinghouseState({ user: AKUN }),
    info.spotClearinghouseState({ user: AKUN }),
  ]);
  const diPerps = Number(perp?.withdrawable) || 0;
  const usdc = (spot?.balances || []).find((b) => String(b.coin).toUpperCase() === 'USDC');
  const diSpot = Number(usdc?.total) || 0;
  return {
    bisaDipakai: diPerps + diSpot,
    diPerps, diSpot,
    /* Lima medan pertama sudah lama dipakai; sisanya ditambahkan untuk
       panel Posisi Copy, yang harus bisa menjawab "uangku terpakai berapa
       dan seberapa jauh dari likuidasi" -- dua pertanyaan yang tidak bisa
       dijawab dari nilai posisi dan PnL saja.

       Semuanya sudah ada di jawaban clearinghouseState; yang kurang selama
       ini cuma pengambilannya. Tidak ada panggilan tambahan ke Hyperliquid. */
    posisi: (perp?.assetPositions || []).map((p) => ({
      koin: p.position.coin,
      arah: Number(p.position.szi) > 0 ? 'LONG' : 'SHORT',
      ukuran: Math.abs(Number(p.position.szi)),
      nilai: Number(p.position.positionValue) || 0,
      pnl: Number(p.position.unrealizedPnl) || 0,
      entry: Number(p.position.entryPx) || 0,
      margin: Number(p.position.marginUsed) || 0,
      likuidasi: Number(p.position.liquidationPx) || 0,
      leverage: Number(p.position.leverage && p.position.leverage.value) || 0,
    })),
  };
}

/** Harga tengah sebuah koin. */
async function hargaHl(koin) {
  const semua = await pustaka().info.allMids();
  const h = Number(semua[koin]);
  return h > 0 ? h : 0;
}

/* ── PEMBULATAN ANGKA SESUAI ATURAN HYPERLIQUID ───────────────────────── */

function bulatUkuran(n, szDecimals) {
  const f = Math.pow(10, szDecimals);
  /* toPrecision(12) membuang debu biner sebelum dibulatkan ke bawah —
     alasan yang sama dengan keStep di jalur Binance. */
  return Math.floor(Number((n * f).toPrecision(12))) / f;
}

/** Harga yang memenuhi KEDUA batas Hyperliquid sekaligus: maksimal 5 angka
 *  penting dan maksimal `6 - szDecimals` desimal. Yang lebih ketat menang. */
function bulatHarga(h, szDecimals) {
  const maksDesimal = Math.max(0, 6 - szDecimals);
  const lima = Number(h.toPrecision(5));
  return Number(lima.toFixed(maksDesimal));
}

/** Buka posisi UNTUK MESIN SALIN. `usd` MARGIN, nilai posisinya usd x
 *  leverage — konvensi yang sama dengan jalur Binance supaya satu angka di
 *  layar tidak berarti dua hal berbeda tergantung bursanya.
 *
 *  ── PAGAR NOMINAL MILIK FUNGSI INI, BUKAN MILIK MODULNYA ───────────────
 *  HL_MAKS_USD dan HL_MAKS_LEV diberlakukan DI SINI dan hanya di sini.
 *  Order manual dari Chart & Entry memakai `orderHl()` di bawah, yang
 *  sengaja tanpa pagar nominal — keputusan pemilik 2 Sep 2026.
 *
 *  Dipisah jadi DUA FUNGSI, bukan satu fungsi dengan bendera `tanpaBatas`.
 *  Bedanya menentukan: dengan bendera, satu pemanggil yang keliru meneruskan
 *  `true` membuat mesin salin — yang berjalan tanpa ada yang menonton —
 *  kehilangan pagarnya. Dengan dua fungsi, mesin salin tidak punya jalan ke
 *  jalur tanpa pagar sama sekali; ia tidak memanggilnya.
 *
 *  Perbedaan lain yang disengaja: fungsi ini TIDAK memasang SL/TP. Salinan
 *  keluar saat dompet sumbernya keluar, bukan saat harga menyentuh angka
 *  yang kita karang sendiri. */
async function bukaHl({ koin, arah, usd, leverage = 1 }) {
  if (!siap()) throw new Error('Hyperliquid belum aktif (HL_AKTIF/HL_AKUN/HL_AGENT_KEY)');

  const nilaiUsd = Number(usd);
  if (!(nilaiUsd > 0)) throw new Error('usd wajib angka lebih dari nol');
  if (nilaiUsd > HL_MAKS_USD) {
    throw new Error(`usd ${nilaiUsd} melewati batas HL_MAKS_USD (${HL_MAKS_USD})`);
  }

  const aset = await asetHl(koin);
  if (!aset) throw new Error(`${koin} tidak ada di Hyperliquid perps`);

  const lev = Math.max(1, Math.min(HL_MAKS_LEV, aset.maxLeverage, Math.round(leverage) || 1));
  const harga = await hargaHl(aset.nama);
  if (!(harga > 0)) throw new Error(`Harga ${koin} tidak terbaca`);

  const saldo = await saldoHl();
  if (saldo.bisaDipakai < nilaiUsd) {
    throw new Error(`Saldo $${saldo.bisaDipakai.toFixed(2)} kurang dari ukuran order $${nilaiUsd}`);
  }

  const ukuran = bulatUkuran((nilaiUsd * lev) / harga, aset.szDecimals);
  if (!(ukuran > 0)) {
    throw new Error(`Ukuran $${nilaiUsd} terlalu kecil untuk ${koin} `
                  + `(harga ${harga}, ${aset.szDecimals} desimal) — membulat jadi nol`);
  }

  const beli = arah === 'BUY' || arah === 'LONG';
  const hargaKirim = bulatHarga(harga * (beli ? 1 + SELISIH_PASAR : 1 - SELISIH_PASAR),
                                aset.szDecimals);

  /* Leverage disetel DULU dan terpisah. Kalau digabung ke order, kegagalan
     menyetel leverage terbaca sebagai kegagalan order — dan yang kedua
     menuntun orang memeriksa hal yang salah. Isolated: kerugian satu koin
     tidak menyeret margin koin lain. */
  const { ex } = pustaka();
  await ex.updateLeverage({ asset: aset.indeks, isCross: false, leverage: lev },
                          { vaultAddress: AKUN });

  const hasil = await ex.order({
    orders: [{
      a: aset.indeks,
      b: beli,
      p: String(hargaKirim),
      s: String(ukuran),
      r: false,
      /* IOC, bukan GTC: yang tidak terisi seketika DIBATALKAN. Order
         menggantung di buku bukan tiruan dari dompet yang sudah masuk
         pasar — ia janji yang mungkin terisi berjam-jam kemudian di
         keadaan yang sudah lain. */
      t: { limit: { tif: 'Ioc' } },
    }],
    grouping: 'na',
  }, { vaultAddress: AKUN });

  const st = hasil?.response?.data?.statuses?.[0];
  if (st?.error) throw new Error(st.error);
  const isi = st?.filled;
  return {
    ok: true, koin: aset.nama, arah: beli ? 'BUY' : 'SELL',
    ukuran, hargaKirim, leverage: lev,
    terisi: isi ? { ukuran: Number(isi.totalSz), harga: Number(isi.avgPx) } : null,
    mentah: st,
  };
}


/* ══════════════════════════════════════════════════════════════════════════
   ORDER MANUAL DARI CHART & ENTRY
   ══════════════════════════════════════════════════════════════════════════
   Semua di bawah ini melayani panel order di web, dan sengaja dibentuk
   MENIRU jalur Binance sedekat mungkin: nama medan yang sama, bentuk jawaban
   yang sama, urutan langkah yang sama. Alasannya bukan kerapian — panel
   order, garis chart, jurnal, dan dashboard semuanya sudah membaca bentuk
   Binance. Bentuk yang berbeda berarti setiap pembacanya harus tahu ada dua
   bursa, dan yang terlewat satu akan diam-diam menampilkan angka kosong.

   ── TIGA HAL YANG BERBEDA DARI BINANCE, DAN HARUS DIINGAT ───────────────

   1. TIDAK ADA ORDER MARKET. Yang ada limit IOC yang menyeberangi buku.
      Akibatnya: order bisa TERISI SEBAGIAN. SL dan TP karena itu disizing
      dari FILL YANG SUNGGUHAN, bukan dari quantity yang diminta. Memasang
      stop seukuran permintaan pada posisi yang cuma terisi 60% berarti stop
      yang lebih besar dari posisinya — ditolak bursa, dan yang terbaca di
      layar cuma "gagal" tanpa sebab.

   2. SIMBOLNYA TELANJANG. Hyperliquid menyebut koinnya `BTC`, bukan
      `BTCUSDT`. Di perbatasan modul ini nama itu diterjemahkan ke bentuk
      Binance supaya layar lama jalan tanpa disentuh, dan nama aslinya tetap
      dibawa di medan `koin`.

   3. TRIGGER ORDER BUTUH HARGA LIMIT JUGA. `isMarket: true` saja tidak
      cukup: `p` tetap dipakai sebagai batas seberapa jauh order boleh
      mengejar sesudah terpicu. `p` yang sama persis dengan harga pemicu bisa
      tidak terisi ketika harga melompat melewatinya — persis keadaan saat
      sebuah stop paling dibutuhkan. Jadi `p` ditaruh di BALIK pemicu.
   ══════════════════════════════════════════════════════════════════════════ */

/** `BTC` -> `BTCUSDT`. Dipakai di perbatasan supaya pembaca lama tidak perlu
 *  tahu ada bursa kedua. */
function keSimbol(koin) { return String(koin || '').toUpperCase() + 'USDT'; }

/** `BTCUSDT` -> `BTC`. Kebalikan keSimbol; menerima yang sudah telanjang. */
function keKoin(simbol) {
  return String(simbol || '').toUpperCase().replace(/USDT$/, '');
}

/** Satu order trigger reduceOnly — SL atau TP.
 *  `beliMasuk` arah POSISINYA, bukan arah ordernya: yang menutup selalu
 *  kebalikannya, dan menyerahkan arah penutup ke pemanggil adalah cara
 *  membuat kekeliruan yang cuma terlihat saat stop benar-benar kena. */
function orderTrigger({ aset, beliMasuk, pemicu, ukuran, jenis }) {
  const tutupBeli = !beliMasuk;
  const px = bulatHarga(pemicu, aset.szDecimals);
  const kejar = bulatHarga(pemicu * (tutupBeli ? 1 + SELISIH_PASAR : 1 - SELISIH_PASAR),
                           aset.szDecimals);
  return {
    a: aset.indeks, b: tutupBeli, p: String(kejar),
    s: String(ukuran), r: true,
    t: { trigger: { isMarket: true, triggerPx: String(px), tpsl: jenis } },
  };
}

/** Memeriksa SL/TP berada di sisi yang benar terhadap harga masuk.
 *  Hyperliquid MENERIMA stop di sisi yang salah — ia langsung terpicu dan
 *  menutup posisi yang baru saja dibuka, dalam hitungan detik, dan yang
 *  terbaca orang cuma "posisi saya hilang sendiri". Binance menolaknya;
 *  di sini penolakan itu harus kita sendiri yang melakukan. */
function periksaSisi({ beli, entry, sl, tp1, tp2 }) {
  const salah = [];
  if (sl > 0) {
    if (beli && sl >= entry) salah.push(`SL ${sl} harus DI BAWAH entry ${entry} untuk posisi BUY`);
    if (!beli && sl <= entry) salah.push(`SL ${sl} harus DI ATAS entry ${entry} untuk posisi SELL`);
  }
  for (const [nama, tp] of [['TP1', tp1], ['TP2', tp2]]) {
    if (!(tp > 0)) continue;
    if (beli && tp <= entry) salah.push(`${nama} ${tp} harus DI ATAS entry ${entry} untuk posisi BUY`);
    if (!beli && tp >= entry) salah.push(`${nama} ${tp} harus DI BAWAH entry ${entry} untuk posisi SELL`);
  }
  if (salah.length) throw new Error(salah.join('; '));
}

/** Order manual. Bentuk parameternya SENGAJA sama dengan POST
 *  /api/trade/futures supaya rute di server bisa meneruskannya apa adanya.
 *
 *  TANPA PAGAR NOMINAL — keputusan pemilik 2 Sep 2026. Gerbangnya
 *  `requireToken` di server (App Token pemilik), bukan angka di sini.
 *  Satu-satunya batas yang tersisa adalah `maxLeverage` milik koinnya
 *  sendiri, dan itu aturan bursa, bukan pilihan kita. */
async function orderHl({ koin, arah, quantity, leverage = 1,
                         entryType = 'MARKET', entryPrice,
                         sl, tp1, qty1, tp2, qty2 }) {
  if (!siap()) throw new Error('Hyperliquid belum aktif (HL_AKTIF/HL_AKUN/HL_AGENT_KEY)');

  const nama = keKoin(koin);
  const aset = await asetHl(nama);
  if (!aset) throw new Error(`${nama} tidak ada di Hyperliquid perps`);

  const beli = arah === 'BUY' || arah === 'LONG';
  const lev = Math.max(1, Math.min(aset.maxLeverage, Math.round(Number(leverage)) || 1));
  const ukuran = bulatUkuran(Number(quantity), aset.szDecimals);
  if (!(ukuran > 0)) {
    throw new Error(`Ukuran ${quantity} membulat jadi nol untuk ${aset.nama} `
                  + `(${aset.szDecimals} desimal)`);
  }

  const pasar = await hargaHl(aset.nama);
  if (!(pasar > 0)) throw new Error(`Harga ${aset.nama} tidak terbaca`);

  /* Diperiksa terhadap harga yang BENAR-BENAR jadi acuan masuknya: pasar
     untuk MARKET, harga pesanan untuk LIMIT. Memakai harga pasar untuk
     keduanya akan meloloskan SL yang salah sisi pada order limit yang
     jauh dari harga sekarang. */
  const acuan = entryType === 'MARKET' ? pasar : Number(entryPrice);
  periksaSisi({ beli, entry: acuan, sl: Number(sl) || 0,
                tp1: Number(tp1) || 0, tp2: Number(tp2) || 0 });

  /* ── DITOLAK SEBELUM ADA JEJAK ────────────────────────────────────────
     Pemeriksaan ini dulu duduk SESUDAH updateLeverage, dan itu keliru:
     entryType yang tidak didukung tetap sempat mengubah leverage koin di
     akun sebelum ditolak. Tidak merugikan uang, tapi ia meninggalkan
     setelan yang tidak diminta siapa pun — dan setelan yang berubah tanpa
     sebab adalah jenis kejutan yang paling sulit ditelusuri belakangan.

     Ketahuan dari ujinya sendiri, bukan dari membaca ulang kodenya. */
  if (entryType !== 'MARKET' && entryType !== 'LIMIT') {
    /* STOP_MARKET (entry kondisional) belum dibuka dengan sengaja: ia butuh
       trigger order yang BUKAN reduceOnly, dan urutan "terpicu -> terisi ->
       baru pasang SL" tidak punya pemantau di jalur Hyperliquid seperti yang
       dipunyai jalur Binance. Ditolak terang-terangan; tombol yang diam
       lebih buruk daripada tombol yang menolak. */
    throw new Error(`entryType ${entryType} belum didukung di Hyperliquid `
                  + `(pakai MARKET atau LIMIT)`);
  }

  const { ex } = pustaka();
  await ex.updateLeverage({ asset: aset.indeks, isCross: false, leverage: lev },
                          { vaultAddress: AKUN });

  /* ── ENTRY LIMIT: menggantung, SL/TP MENYUSUL ───────────────────────────
     Sama persis dengan jalur Binance: yang belum terisi belum punya posisi,
     dan stop untuk posisi yang belum ada adalah stop yang akan menutup
     posisi lain yang kebetulan terbuka duluan di koin yang sama. Klien
     memantau lewat /api/positions lalu memanggil attach-sltp. */
  if (entryType === 'LIMIT') {
    const px = bulatHarga(Number(entryPrice), aset.szDecimals);
    const hasil = await ex.order({
      orders: [{ a: aset.indeks, b: beli, p: String(px), s: String(ukuran),
                 r: false, t: { limit: { tif: 'Gtc' } } }],
      grouping: 'na',
    }, { vaultAddress: AKUN });
    const st = hasil?.response?.data?.statuses?.[0];
    if (st?.error) throw new Error(st.error);
    return {
      ok: true, bursa: 'hyperliquid', pending: true,
      koin: aset.nama, simbol: keSimbol(aset.nama),
      arah: beli ? 'BUY' : 'SELL', ukuran, harga: px, leverage: lev,
      orderId: String(st?.resting?.oid || ''),
    };
  }

  /* ── ENTRY MARKET: IOC menyeberangi buku ────────────────────────────── */
  const hargaKirim = bulatHarga(pasar * (beli ? 1 + SELISIH_PASAR : 1 - SELISIH_PASAR),
                                aset.szDecimals);
  const hasil = await ex.order({
    orders: [{ a: aset.indeks, b: beli, p: String(hargaKirim), s: String(ukuran),
               r: false, t: { limit: { tif: 'Ioc' } } }],
    grouping: 'na',
  }, { vaultAddress: AKUN });
  const st = hasil?.response?.data?.statuses?.[0];
  if (st?.error) throw new Error(st.error);

  const isi = st?.filled;
  const terisi = isi ? bulatUkuran(Number(isi.totalSz), aset.szDecimals) : 0;
  if (!(terisi > 0)) {
    throw new Error(`Order ${aset.nama} tidak terisi sama sekali `
                  + `(IOC, harga mengejar ${hargaKirim})`);
  }
  const hargaIsi = isi ? Number(isi.avgPx) : pasar;

  /* SL/TP disizing dari `terisi`, BUKAN `ukuran`. Lihat catatan (1) di
     kepala bagian ini. */
  const pasang = await pasangSltpHl({
    koin: aset.nama, beli, ukuran: terisi,
    sl, tp1, qty1, tp2, qty2, bersihkanDulu: false,
  });

  return {
    ok: true, bursa: 'hyperliquid', pending: false,
    koin: aset.nama, simbol: keSimbol(aset.nama),
    arah: beli ? 'BUY' : 'SELL',
    ukuran: terisi, diminta: ukuran,
    sebagian: terisi < ukuran,
    harga: hargaIsi, leverage: lev,
    sltp: pasang,
  };
}

/** Memasang SL/TP pada posisi yang SUDAH terbuka.
 *  `bersihkanDulu` membatalkan trigger reduceOnly yang masih menggantung
 *  untuk koin itu — wajib saat mengganti SL/TP, dan harus TIDAK dilakukan
 *  tepat sesudah entry (belum ada apa-apa untuk dibatalkan, dan satu
 *  panggilan batal yang gagal akan menjatuhkan order yang sudah terisi). */
async function pasangSltpHl({ koin, beli, ukuran, sl, tp1, qty1, tp2, qty2,
                              bersihkanDulu = true }) {
  if (!siap()) throw new Error('Hyperliquid belum aktif');
  const nama = keKoin(koin);
  const aset = await asetHl(nama);
  if (!aset) throw new Error(`${nama} tidak ada di Hyperliquid perps`);
  const { ex } = pustaka();

  /* Arah & ukuran dibaca dari POSISI SUNGGUHAN kalau tidak dipasok. Yang
     memanggil dari luar (attach-sltp, edit-sltp) tidak selalu tahu keduanya,
     dan menebaknya dari niat pemanggil adalah cara memasang stop terbalik. */
  let arahBeli = beli, sz = Number(ukuran) || 0;
  if (arahBeli === undefined || !(sz > 0)) {
    const saldo = await saldoHl();
    const pos = saldo.posisi.find((p) => p.koin.toUpperCase() === aset.nama.toUpperCase());
    if (!pos) throw new Error(`Tidak ada posisi ${aset.nama} untuk dipasangi SL/TP`);
    if (arahBeli === undefined) arahBeli = pos.arah === 'LONG';
    if (!(sz > 0)) sz = pos.ukuran;
  }
  sz = bulatUkuran(sz, aset.szDecimals);
  if (!(sz > 0)) throw new Error(`Ukuran posisi ${aset.nama} membulat jadi nol`);

  if (bersihkanDulu) await batalTriggerHl(aset.nama);

  /* TP parsial DIJEPIT ke ukuran posisi. Jumlah qty yang melebihi posisi
     membuat order terakhir ditolak — dan yang ditolak biasanya TP2,
     sehingga yang terlihat cuma "TP2 tidak muncul" tanpa sebab. */
  const orders = [];
  const t1 = Number(tp1) || 0, t2 = Number(tp2) || 0;
  let q1 = Math.min(bulatUkuran(Number(qty1) || sz, aset.szDecimals), sz);
  if (t1 > 0 && !(q1 > 0)) q1 = sz;
  const sisa = bulatUkuran(Math.max(0, sz - q1), aset.szDecimals);
  const q2 = Math.min(bulatUkuran(Number(qty2) || sisa, aset.szDecimals), sisa);

  if (t1 > 0) {
    orders.push(orderTrigger({ aset, beliMasuk: arahBeli, pemicu: t1, ukuran: q1, jenis: 'tp' }));
  }
  if (t2 > 0 && q2 > 0) {
    orders.push(orderTrigger({ aset, beliMasuk: arahBeli, pemicu: t2, ukuran: q2, jenis: 'tp' }));
  }
  /* SL menutup SELURUH posisi, bukan sepotong. TP boleh parsial karena
     mengambil untung sebagian itu strategi; stop sebagian bukan stop. */
  if (Number(sl) > 0) {
    orders.push(orderTrigger({ aset, beliMasuk: arahBeli, pemicu: Number(sl), ukuran: sz, jenis: 'sl' }));
  }
  if (!orders.length) return { dipasang: 0 };

  const hasil = await ex.order({ orders, grouping: 'na' }, { vaultAddress: AKUN });
  const statuses = hasil?.response?.data?.statuses || [];
  const galat = statuses.map((x, i) => x?.error ? `#${i + 1}: ${x.error}` : null).filter(Boolean);
  /* Galat TIDAK dilempar: entry-nya sudah terisi dan uangnya sudah di
     pasar. Melempar di sini membuat rute menjawab 500, dan yang membacanya
     menyimpulkan ordernya gagal — lalu mengirim ulang. Yang benar:
     laporkan posisinya terbuka DAN stopnya gagal dipasang. */
  return {
    dipasang: statuses.filter((x) => !x?.error).length,
    diminta: orders.length,
    galat: galat.length ? galat : null,
    ukuran: sz, tp1: t1 || null, qty1: t1 ? q1 : null,
    tp2: t2 || null, qty2: t2 && q2 ? q2 : null, sl: Number(sl) || null,
  };
}

/** Membatalkan SEMUA trigger reduceOnly milik satu koin. Order entry yang
 *  menggantung sengaja dibiarkan — ia bukan SL/TP, dan mencabutnya saat
 *  orang cuma mau menggeser stop adalah kejutan yang mahal. */
async function batalTriggerHl(koin) {
  const nama = keKoin(koin);
  const aset = await asetHl(nama);
  if (!aset) return { dibatalkan: 0 };
  const daftar = await pendingHl();
  const punya = daftar.filter((o) => o.koin.toUpperCase() === aset.nama.toUpperCase()
                                  && (o.jenis === 'SL' || o.jenis === 'TP'));
  if (!punya.length) return { dibatalkan: 0 };
  const hasil = await pustaka().ex.cancel({
    cancels: punya.map((o) => ({ a: aset.indeks, o: Number(o.id) })),
  }, { vaultAddress: AKUN });
  const statuses = hasil?.response?.data?.statuses || [];
  return { dibatalkan: statuses.filter((x) => x === 'success').length, diminta: punya.length };
}

/** Membatalkan SATU order berdasarkan oid. */
async function batalHl({ koin, id }) {
  if (!siap()) throw new Error('Hyperliquid belum aktif');
  const aset = await asetHl(keKoin(koin));
  if (!aset) throw new Error(`${koin} tidak ada di Hyperliquid perps`);
  const hasil = await pustaka().ex.cancel({
    cancels: [{ a: aset.indeks, o: Number(id) }],
  }, { vaultAddress: AKUN });
  const st = hasil?.response?.data?.statuses?.[0];
  if (st && st !== 'success' && st.error) throw new Error(st.error);
  return { ok: true, koin: aset.nama, id: String(id) };
}

/** Memindahkan SL ke harga masuk. TP yang sudah terpasang DIPERTAHANKAN:
 *  memindahkan stop bukan alasan membatalkan rencana keluarnya. */
async function slKeBeHl(koin) {
  if (!siap()) throw new Error('Hyperliquid belum aktif');
  const aset = await asetHl(keKoin(koin));
  if (!aset) throw new Error(`${koin} tidak ada di Hyperliquid perps`);
  const saldo = await saldoHl();
  const pos = saldo.posisi.find((p) => p.koin.toUpperCase() === aset.nama.toUpperCase());
  if (!pos) throw new Error(`Tidak ada posisi ${aset.nama}`);
  if (!(pos.entry > 0)) throw new Error(`Harga masuk ${aset.nama} tidak terbaca`);

  /* Cuma SL yang dicabut, TP dibiarkan. */
  const daftar = await pendingHl();
  const slLama = daftar.filter((o) => o.koin.toUpperCase() === aset.nama.toUpperCase()
                                   && o.jenis === 'SL');
  if (slLama.length) {
    await pustaka().ex.cancel({
      cancels: slLama.map((o) => ({ a: aset.indeks, o: Number(o.id) })),
    }, { vaultAddress: AKUN });
  }

  const beli = pos.arah === 'LONG';
  const hasil = await pustaka().ex.order({
    orders: [orderTrigger({ aset, beliMasuk: beli, pemicu: pos.entry,
                            ukuran: bulatUkuran(pos.ukuran, aset.szDecimals), jenis: 'sl' })],
    grouping: 'na',
  }, { vaultAddress: AKUN });
  const st = hasil?.response?.data?.statuses?.[0];
  if (st?.error) throw new Error(st.error);
  return { ok: true, koin: aset.nama, sl: pos.entry, ukuran: pos.ukuran };
}

/** Posisi terbuka dalam BENTUK BINANCE (/api/positions).
 *  `positionAmt` bertanda seperti Binance: positif long, negatif short. */
async function posisiHl() {
  if (!siap()) return [];
  const { info } = pustaka();
  const [st, mids] = await Promise.all([
    info.clearinghouseState({ user: AKUN }),
    info.allMids().catch(() => ({})),
  ]);
  const ang = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : 0; };
  return (st?.assetPositions || []).map((a) => {
    const p = a.position;
    const szi = ang(p.szi);
    return {
      symbol: keSimbol(p.coin),
      positionAmt: szi,
      entryPrice: ang(p.entryPx),
      unRealizedProfit: ang(p.unrealizedPnl),
      markPrice: ang(mids[p.coin]),
      liquidationPrice: ang(p.liquidationPx),
      leverage: ang(p.leverage && p.leverage.value),
      isolatedMargin: ang(p.marginUsed),
      notional: Math.abs(ang(p.positionValue)),
      marginType: (p.leverage && p.leverage.type) || 'isolated',
      /* Dua medan TAMBAHAN, tidak ada di jawaban Binance. Yang membaca
         bentuk lama mengabaikannya; yang perlu tahu bursanya punya
         jawabannya tanpa menebak dari nama simbol. */
      bursa: 'hyperliquid',
      koin: p.coin,
    };
  }).filter((p) => p.positionAmt !== 0);
}

/** Order menggantung dalam BENTUK `daftar` milik /api/open-orders. */
async function pendingHl() {
  if (!siap()) return [];
  const daftar = await pustaka().info.frontendOpenOrders({ user: AKUN });
  const ang = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : 0; };
  return (Array.isArray(daftar) ? daftar : []).map((o) => {
    const tipe = String(o.orderType || '');
    const reduce = o.reduceOnly === true;
    /* Penggolongannya dibaca dari orderType, dengan `isPositionTpsl` dan
       reduceOnly sebagai penguat. Hyperliquid menulis "Stop Market",
       "Take Profit Market", "Limit" — bukan kode seperti Binance. */
    const jenis = !reduce && !o.isTrigger ? 'ENTRY'
      : /stop/i.test(tipe) ? 'SL'
      : /take\s*profit/i.test(tipe) ? 'TP'
      : reduce ? 'LAIN' : 'ENTRY';
    return {
      id: String(o.oid),
      simbol: keSimbol(o.coin),
      koin: o.coin,
      jenis, tipe,
      arah: o.side === 'B' ? 'BUY' : 'SELL',
      pemicu: ang(o.triggerPx),
      harga: ang(o.limitPx),
      qty: ang(o.sz),
      algo: !!o.isTrigger,
      status: 'NEW',
      dibuat: Number(o.timestamp) || 0,
      bursa: 'hyperliquid',
    };
  });
}

/** Tutup posisi, seluruhnya atau sebagian. reduceOnly — bursa menolak kalau
 *  ia justru akan menambah, pagar yang tidak bergantung pada benarnya kode
 *  di sini.
 *
 *  `qty` opsional: tanpa itu seluruh posisi ditutup, seperti dulu. Dengan
 *  itu ditutup sebanyak yang diminta, DIJEPIT ke ukuran posisi — meminta
 *  lebih dari yang dipegang bukan alasan menolak, ia cuma berarti "tutup
 *  semua", dan itu yang paling mungkin dimaksud orangnya. */
async function tutupHl(koin, qty) {
  if (!siap()) throw new Error('Hyperliquid belum aktif');
  const aset = await asetHl(koin);
  if (!aset) throw new Error(`${koin} tidak ada di Hyperliquid perps`);

  const saldo = await saldoHl();
  const pos = saldo.posisi.find((p) => String(p.koin).toUpperCase() === aset.nama.toUpperCase());
  if (!pos) return { ok: true, kosong: true };

  const harga = await hargaHl(aset.nama);
  const beli = pos.arah === 'SHORT';
  const hargaKirim = bulatHarga(harga * (beli ? 1 + SELISIH_PASAR : 1 - SELISIH_PASAR),
                                aset.szDecimals);

  const mau = Number(qty) > 0 ? Math.min(Number(qty), pos.ukuran) : pos.ukuran;
  const ukuran = bulatUkuran(mau, aset.szDecimals);
  if (!(ukuran > 0)) {
    throw new Error(`Ukuran tutup ${mau} membulat jadi nol untuk ${aset.nama}`);
  }

  const hasil = await pustaka().ex.order({
    orders: [{
      a: aset.indeks, b: beli, p: String(hargaKirim),
      s: String(ukuran),
      r: true, t: { limit: { tif: 'Ioc' } },
    }],
    grouping: 'na',
  }, { vaultAddress: AKUN });

  const st = hasil?.response?.data?.statuses?.[0];
  if (st?.error) throw new Error(st.error);
  /* Tutup PENUH mencabut SL/TP yang tersisa. Tanpa ini, stop untuk posisi
     yang sudah tidak ada tetap menggantung di buku — dan ia akan MEMBUKA
     posisi baru arah berlawanan begitu terpicu, karena reduceOnly pada
     posisi nol tidak punya yang bisa dikurangi. Tutup sebagian tidak
     dibersihkan: sisanya masih perlu dijaga. */
  const penuh = ukuran >= bulatUkuran(pos.ukuran, aset.szDecimals);
  let bersih = null;
  if (penuh) { try { bersih = await batalTriggerHl(aset.nama); } catch (e) { bersih = { galat: e.message }; } }
  return { ok: true, koin: aset.nama, ditutup: ukuran, penuh,
           terisi: st?.filled || null, sltpDicabut: bersih };
}

module.exports = {
  siap, asetHl, saldoHl, hargaHl, bulatUkuran, bulatHarga,
  /* Mesin salin — berpagar HL_MAKS_USD/LEV. */
  bukaHl,
  /* Order manual dari Chart & Entry — tanpa pagar nominal, digerbangi
     requireToken di server. Lihat catatan panjang di atas bukaHl. */
  orderHl, pasangSltpHl, batalTriggerHl, batalHl, slKeBeHl,
  /* Dipakai kedua jalur. */
  tutupHl, posisiHl, pendingHl, keSimbol, keKoin,
  batas: { HL_MAKS_USD, HL_MAKS_LEV },
};
