require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
// maxAge: sejak halaman mengirim header Authorization, tiap permintaan data
// pasar berubah jadi "preflighted" - peramban menembak OPTIONS dulu sebelum
// GET. Satu pemindaian 100 koin jadi 200 perjalanan bolak-balik ke VPS, bukan
// 100. Dengan maxAge, hasil preflight-nya disimpan peramban (Chrome membatasi
// di 2 jam), jadi ongkos itu dibayar sekali saja, bukan tiap permintaan.
app.use(cors({ maxAge: 86400 }));
// Kompresi gzip. Respons data pasar itu JSON berulang - biasanya menyusut ~85%.
// Tanpa ini, /api/tickers terkirim mentah (~1,9 MB) ke tiap user tiap belasan
// detik, dan bandwidth VPS jadi batas pertama yang jebol saat user bertambah.
try {
  const compression = require('compression');
  app.use(compression());
} catch (e) {
  console.warn('Paket "compression" belum terpasang - respons dikirim tanpa gzip. Jalankan: npm i compression');
}
// Parser JSON umum: batas bawaan (100 KB) sudah lebih dari cukup untuk semua
// endpoint trading. TAPI ia harus MELEWATI rute unggah gambar - kalau tidak,
// dialah yang menolak duluan dengan PayloadTooLargeError dan batas besar yang
// dipasang di rute itu tidak pernah kebagian. Gejalanya di browser:
// "Unexpected token '<'", karena Express membalas error itu sebagai HTML.
// /api/mt5/lapor ikut di sini karena alasan yang SAMA: laporan EA bisa lebih
// besar dari 100 KB (riwayat 30 hari akun yang ramai), dan kalau parser global
// menolak duluan, batas 512 KB yang dipasang di rutenya tidak pernah kebagian.
const RUTE_UNGGAH = ['/api/gambar', '/api/mt5/lapor', '/api/mt5/klines', '/api/produk/unggah'];
app.use((req, res, next) => {
  if (RUTE_UNGGAH.indexOf(req.path) >= 0) return next();
  express.json()(req, res, next);
});

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;
// PENTING: default ke testnet Futures. Jangan ganti ke live sebelum benar-benar yakin.
const BASE_URL = process.env.BINANCE_BASE_URL || 'https://testnet.binancefuture.com';
const APP_TOKEN = process.env.APP_TOKEN;

if (!API_KEY || !API_SECRET) {
  console.error('BINANCE_API_KEY / BINANCE_API_SECRET belum di-set di file .env');
  process.exit(1);
}

if (!APP_TOKEN) {
  console.error('APP_TOKEN belum di-set di file .env (token rahasia buat proteksi endpoint)');
  process.exit(1);
}

// Proteksi endpoint sensitif: browser/tool harus kirim header X-App-Token yang cocok
function requireToken(req, res, next) {
  const sentToken = req.headers['x-app-token'];
  if (sentToken !== APP_TOKEN) {
    return res.status(401).json({ error: 'Token tidak valid atau tidak dikirim (header X-App-Token)' });
  }
  next();
}

function sign(queryString) {
  return crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
}

async function futuresRequest(method, path, params) {
  const timestamp = Date.now();
  const query = new URLSearchParams({ ...params, timestamp, recvWindow: 5000 }).toString();
  const signature = sign(query);
  const url = `${BASE_URL}${path}?${query}&signature=${signature}`;
  const res = await axios({ method, url, headers: { 'X-MBX-APIKEY': API_KEY } });
  return res.data;
}

// ── Penghitung kesehatan ───────────────────────────────────────────────────
// Angka mentah untuk panel Kesehatan Server di Maintenance V3. Sekadar
// penghitung di memori proses - nol lagi setiap restart, dan itu tidak
// apa-apa: yang ingin dijawab adalah "AKHIR-AKHIR INI beratnya seperti apa",
// bukan arsip forensik. Audit keamanan sungguhan butuh alat server terpisah.
const hitungan = {
  sejak: Date.now(),
  total: 0,
  tolakanAuth: 0,     // 401/403 - token salah / akses tanpa hak
  kena429: 0,         // rate limit tersentuh
  galat5xx: 0,
  perMenit: [],       // [{menit, n}] 60 entri terakhir
};
app.use((req, res, next) => {
  hitungan.total++;
  const menit = Math.floor(Date.now() / 60000);
  const akhir = hitungan.perMenit[hitungan.perMenit.length - 1];
  if (akhir && akhir.menit === menit) akhir.n++;
  else {
    hitungan.perMenit.push({ menit, n: 1 });
    if (hitungan.perMenit.length > 60) hitungan.perMenit.shift();
  }
  res.on('finish', () => {
    if (res.statusCode === 401 || res.statusCode === 403) hitungan.tolakanAuth++;
    else if (res.statusCode === 429) hitungan.kena429++;
    else if (res.statusCode >= 500) hitungan.galat5xx++;
  });
  next();
});

// Pemakaian disk, di-cache semenit - df tidak berubah sedetik-detik.
let diskCache = { waktu: 0, isi: null };
function bacaDisk() {
  if (Date.now() - diskCache.waktu < 60000 && diskCache.isi) return diskCache.isi;
  try {
    const { execSync } = require('child_process');
    const baris = execSync("df -k / | tail -1", { timeout: 4000 }).toString().trim().split(/\s+/);
    const totalMb = Math.round(Number(baris[1]) / 1024);
    const terpakaiMb = Math.round(Number(baris[2]) / 1024);
    diskCache = { waktu: Date.now(), isi: { totalMb, terpakaiMb, persen: Math.round((terpakaiMb / totalMb) * 100) } };
  } catch (e) {
    diskCache = { waktu: Date.now(), isi: null };
  }
  return diskCache.isi;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, baseUrl: BASE_URL });
});

// Cek saldo & posisi akun Futures - dipakai buat pastikan koneksi & key sudah benar
app.get('/api/account', requireToken, async (req, res) => {
  try {
    const data = await futuresRequest('GET', '/fapi/v2/account', {});
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.response ? e.response.data : e.message });
  }
});

// Pasang SL (full quantity) + TP1(qty1) + TP2 opsional(qty2) untuk posisi yang
// SUDAH terbuka di Binance - dipakai baik langsung setelah entry MARKET,
// maupun belakangan setelah entry LIMIT/STOP_MARKET (pending) akhirnya
// ke-fill. Order kondisional (STOP_MARKET/TAKE_PROFIT_MARKET) wajib lewat
// /fapi/v1/algoOrder (algoType:'CONDITIONAL', harga pemicu di triggerPrice)
// sejak migrasi wajib Binance 2025-12-09 - /fapi/v1/order akan selalu ditolak
// -4120 untuk order kondisional.
async function attachSlTp({ symbol, side, quantity, sl, tp1, qty1, tp2, qty2 }) {
  const closeSide = side === 'BUY' ? 'SELL' : 'BUY';
  const slOrder = await futuresRequest('POST', '/fapi/v1/algoOrder', {
    algoType: 'CONDITIONAL', symbol, side: closeSide, type: 'STOP_MARKET', triggerPrice: sl, quantity, reduceOnly: 'true'
  });
  const tp1Order = await futuresRequest('POST', '/fapi/v1/algoOrder', {
    algoType: 'CONDITIONAL', symbol, side: closeSide, type: 'TAKE_PROFIT_MARKET', triggerPrice: tp1, quantity: qty1, reduceOnly: 'true'
  });
  let tp2Order = null;
  if (tp2 && qty2) {
    tp2Order = await futuresRequest('POST', '/fapi/v1/algoOrder', {
      algoType: 'CONDITIONAL', symbol, side: closeSide, type: 'TAKE_PROFIT_MARKET', triggerPrice: tp2, quantity: qty2, reduceOnly: 'true'
    });
  }
  return { slOrder, tp1Order, tp2Order };
}

// Buka posisi Futures: set leverage + isolated margin, lalu ENTRY sesuai
// entryType, lalu pasang SL/TP1/TP2 (langsung, kecuali entry-nya masih
// pending/belum fill).
// entryType: 'MARKET' (default, "Otomatis") | 'LIMIT' (Buy/Sell Limit) |
// 'STOP_MARKET' (Buy/Sell Stop). Untuk LIMIT/STOP_MARKET wajib kirim
// entryPrice (harga limit / harga trigger stop) - order ini akan MENGGANTUNG
// dulu di Binance (belum ada posisi), jadi SL/TP1/TP2 BELUM dipasang di sini -
// tool client wajib polling /api/positions, dan begitu positionAmt berubah
// dari 0 (artinya order pending sudah ke-fill), panggil
// /api/trade/futures/attach-sltp pakai actual fill price dari situ.
// Body: { symbol, side: 'BUY'|'SELL', quantity, leverage, entryType?, entryPrice?, sl, tp1, qty1, tp2?, qty2? }
// tp2/qty2 opsional - kalau tidak dikirim, cuma 1 TP dipasang untuk full quantity.
app.post('/api/trade/futures', requireToken, async (req, res) => {
  const { symbol, side, quantity, leverage, entryType, entryPrice, sl, tp1, qty1, tp2, qty2 } = req.body;
  const type = entryType || 'MARKET';

  if (!symbol || !side || !quantity || !sl || !tp1 || !qty1) {
    return res.status(400).json({ error: 'symbol, side, quantity, sl, tp1, dan qty1 wajib diisi' });
  }
  if (type !== 'MARKET' && (!entryPrice || entryPrice <= 0)) {
    return res.status(400).json({ error: 'entryPrice wajib diisi untuk entryType LIMIT/STOP_MARKET' });
  }

  // Tiap langkah ditandai (stage) supaya kalau Binance nolak, kita tahu PERSIS
  // order mana yang gagal dan parameter apa yang dikirim - bukan cuma pesan
  // generik "precision" tanpa konteks.
  let stage = 'leverage';
  try {
    // 1. Set leverage untuk simbol ini
    await futuresRequest('POST', '/fapi/v1/leverage', { symbol, leverage: leverage || 10 });

    // 2. Set isolated margin (abaikan error - biasanya artinya sudah isolated)
    stage = 'marginType';
    try {
      await futuresRequest('POST', '/fapi/v1/marginType', { symbol, marginType: 'ISOLATED' });
    } catch (e) { /* sudah isolated - aman diabaikan */ }

    // 3. Entry - MARKET langsung eksekusi, LIMIT resting order biasa (masih
    // lewat /fapi/v1/order, LIMIT bukan order kondisional jadi tidak kena
    // migrasi algoOrder), STOP_MARKET (Buy/Sell Stop) adalah entry KONDISIONAL
    // (bukan reduceOnly, ini yang MEMBUKA posisi) jadi wajib lewat algoOrder.
    stage = 'entryOrder';
    let entryOrder, isAlgoEntry = false;
    if (type === 'MARKET') {
      entryOrder = await futuresRequest('POST', '/fapi/v1/order', { symbol, side, type: 'MARKET', quantity });
    } else if (type === 'LIMIT') {
      entryOrder = await futuresRequest('POST', '/fapi/v1/order', {
        symbol, side, type: 'LIMIT', price: entryPrice, quantity, timeInForce: 'GTC'
      });
    } else if (type === 'STOP_MARKET') {
      isAlgoEntry = true;
      entryOrder = await futuresRequest('POST', '/fapi/v1/algoOrder', {
        algoType: 'CONDITIONAL', symbol, side, type: 'STOP_MARKET', triggerPrice: entryPrice, quantity
      });
    } else {
      return res.status(400).json({ error: `entryType tidak dikenal: ${type} (gunakan MARKET, LIMIT, atau STOP_MARKET)` });
    }

    // Entry LIMIT/STOP_MARKET masih PENDING (belum tentu langsung ke-fill,
    // posisi belum tentu terbuka) - JANGAN pasang SL/TP dulu, biar client
    // yang memantau lewat /api/positions lalu panggil attach-sltp begitu
    // posisi benar-benar terbuka.
    if (type !== 'MARKET') {
      return res.json({ entryOrder, pending: true, isAlgoEntry });
    }

    // 4-5. MARKET: posisi langsung terbuka, pasang SL/TP1/TP2 sekarang juga.
    stage = 'slTpOrder';
    const { slOrder, tp1Order, tp2Order } = await attachSlTp({ symbol, side, quantity, sl, tp1, qty1, tp2, qty2 });

    res.json({ entryOrder, slOrder, tp1Order, tp2Order });
  } catch (e) {
    res.status(500).json({
      stage,
      sentParams: { symbol, side, quantity, leverage, entryType: type, entryPrice, sl, tp1, qty1, tp2, qty2 },
      error: e.response ? e.response.data : e.message
    });
  }
});

// Pasang SL/TP1/TP2 untuk posisi yang SUDAH terbuka (dipanggil oleh client
// setelah entry LIMIT/STOP_MARKET pending terdeteksi sudah fill lewat
// /api/positions - lihat komentar di /api/trade/futures di atas).
// Body: { symbol, side, quantity, sl, tp1, qty1, tp2?, qty2? }
app.post('/api/trade/futures/attach-sltp', requireToken, async (req, res) => {
  const { symbol, side, quantity, sl, tp1, qty1, tp2, qty2 } = req.body;
  if (!symbol || !side || !quantity || !sl || !tp1 || !qty1) {
    return res.status(400).json({ error: 'symbol, side, quantity, sl, tp1, dan qty1 wajib diisi' });
  }
  try {
    const result = await attachSlTp({ symbol, side, quantity, sl, tp1, qty1, tp2, qty2 });
    res.json(result);
  } catch (e) {
    res.status(500).json({
      sentParams: { symbol, side, quantity, sl, tp1, qty1, tp2, qty2 },
      error: e.response ? e.response.data : e.message
    });
  }
});

// Batalkan order ENTRY yang masih pending/belum fill (Buy/Sell Limit atau
// Buy/Sell Stop) - dipanggil dari tombol "Batalkan Order" di tool untuk entry
// yang belum tereksekusi. isAlgo:true untuk entry STOP_MARKET (algoOrder),
// false untuk LIMIT (order biasa).
// Body: { symbol, orderId, isAlgo }
app.post('/api/trade/futures/cancel-order', requireToken, async (req, res) => {
  const { symbol, orderId, isAlgo } = req.body;
  if (!symbol || !orderId) return res.status(400).json({ error: 'symbol dan orderId wajib diisi' });
  try {
    const result = isAlgo
      ? await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: orderId })
      : await futuresRequest('DELETE', '/fapi/v1/order', { symbol, orderId });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.response ? e.response.data : e.message });
  }
});

// Ubah SL/TP1/TP2 untuk posisi live yang SUDAH terbuka (dipanggil dari tombol
// "Edit SL/TP" di tabel Posisi Terbuka). Cuma level yang dikirim (bukan
// undefined) yang diubah - level lain dibiarkan seperti apa adanya. Untuk tiap
// level yang diubah: batalkan order lama (kalau ID-nya ada - aman diabaikan
// kalau gagal, mungkin sudah ke-trigger duluan), lalu pasang order baru di
// harga/quantity baru.
// Body: { symbol, side: 'BUY'|'SELL' (arah entry asli),
//   sl?, slQuantity?, oldSlOrderId?,
//   tp1?, tp1Quantity?, oldTp1OrderId?,
//   tp2?, tp2Quantity?, oldTp2OrderId? }
app.post('/api/trade/futures/edit-sltp', requireToken, async (req, res) => {
  const { symbol, side, sl, slQuantity, oldSlOrderId, tp1, tp1Quantity, oldTp1OrderId, tp2, tp2Quantity, oldTp2OrderId } = req.body;
  if (!symbol || !side) return res.status(400).json({ error: 'symbol dan side wajib diisi' });
  if (!sl && !tp1 && !tp2) return res.status(400).json({ error: 'isi minimal salah satu dari sl, tp1, atau tp2 untuk diubah' });

  const closeSide = side === 'BUY' ? 'SELL' : 'BUY';
  const result = {};
  let stage = 'idle';
  try {
    if (sl) {
      stage = 'sl';
      if (oldSlOrderId) {
        try { await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: oldSlOrderId }); }
        catch (e) { /* mungkin sudah ke-trigger/kadaluarsa - aman diabaikan, tetap lanjut pasang yang baru */ }
      }
      if (!slQuantity) throw new Error('slQuantity wajib diisi kalau mengubah sl');
      result.slOrder = await futuresRequest('POST', '/fapi/v1/algoOrder', {
        algoType: 'CONDITIONAL', symbol, side: closeSide, type: 'STOP_MARKET', triggerPrice: sl, quantity: slQuantity, reduceOnly: 'true'
      });
    }
    if (tp1) {
      stage = 'tp1';
      if (oldTp1OrderId) {
        try { await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: oldTp1OrderId }); }
        catch (e) { /* aman diabaikan */ }
      }
      if (!tp1Quantity) throw new Error('tp1Quantity wajib diisi kalau mengubah tp1');
      result.tp1Order = await futuresRequest('POST', '/fapi/v1/algoOrder', {
        algoType: 'CONDITIONAL', symbol, side: closeSide, type: 'TAKE_PROFIT_MARKET', triggerPrice: tp1, quantity: tp1Quantity, reduceOnly: 'true'
      });
    }
    if (tp2) {
      stage = 'tp2';
      if (oldTp2OrderId) {
        try { await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: oldTp2OrderId }); }
        catch (e) { /* aman diabaikan */ }
      }
      if (!tp2Quantity) throw new Error('tp2Quantity wajib diisi kalau mengubah tp2');
      result.tp2Order = await futuresRequest('POST', '/fapi/v1/algoOrder', {
        algoType: 'CONDITIONAL', symbol, side: closeSide, type: 'TAKE_PROFIT_MARKET', triggerPrice: tp2, quantity: tp2Quantity, reduceOnly: 'true'
      });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({
      stage,
      sentParams: { symbol, side, sl, slQuantity, tp1, tp1Quantity, tp2, tp2Quantity },
      error: e.response ? e.response.data : e.message
    });
  }
});

// Tutup posisi Futures secara manual (dipanggil dari tombol "Close Posisi" di
// tool untuk posisi live). Batalkan dulu SL/TP1/TP2 algo order yang masih
// pending (kalau gagal dibatalkan - misal sudah ke-trigger duluan - aman
// diabaikan), baru kirim MARKET reduceOnly untuk menutup sisa posisi yang ada.
// Body: { symbol, side: 'BUY'|'SELL' (arah entry asli), quantity, slOrderId, tp1OrderId, tp2OrderId }
app.post('/api/trade/futures/close', requireToken, async (req, res) => {
  const { symbol, side, quantity, slOrderId, tp1OrderId, tp2OrderId } = req.body;

  if (!symbol || !side || !quantity) {
    return res.status(400).json({ error: 'symbol, side, dan quantity wajib diisi' });
  }

  let stage = 'cancelSl';
  try {
    if (slOrderId) {
      try { await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: slOrderId }); }
      catch (e) { /* mungkin sudah ke-trigger/kadaluarsa duluan - aman diabaikan */ }
    }

    stage = 'cancelTp1';
    if (tp1OrderId) {
      try { await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: tp1OrderId }); }
      catch (e) { /* aman diabaikan */ }
    }

    stage = 'cancelTp2';
    if (tp2OrderId) {
      try { await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: tp2OrderId }); }
      catch (e) { /* aman diabaikan */ }
    }

    stage = 'closeOrder';
    const closeSide = side === 'BUY' ? 'SELL' : 'BUY';
    const closeOrder = await futuresRequest('POST', '/fapi/v1/order', {
      symbol, side: closeSide, type: 'MARKET', quantity, reduceOnly: 'true'
    });

    res.json({ closeOrder });
  } catch (e) {
    res.status(500).json({
      stage,
      sentParams: { symbol, side, quantity, slOrderId, tp1OrderId, tp2OrderId },
      error: e.response ? e.response.data : e.message
    });
  }
});

// Pindahkan SL ke breakeven (harga entry) untuk sisa quantity - dipanggil
// otomatis oleh tool begitu TP1 kena (posisi berkurang separuh). Batalkan SL
// lama, pasang SL baru di harga breakeven untuk quantity yang tersisa.
// Body: { symbol, side: 'BUY'|'SELL' (arah entry asli), quantity (sisa), oldSlOrderId, breakevenPrice }
app.post('/api/trade/futures/move-sl-be', requireToken, async (req, res) => {
  const { symbol, side, quantity, oldSlOrderId, breakevenPrice } = req.body;
  if (!symbol || !side || !quantity || !breakevenPrice) {
    return res.status(400).json({ error: 'symbol, side, quantity, dan breakevenPrice wajib diisi' });
  }

  let stage = 'cancelOldSl';
  try {
    if (oldSlOrderId) {
      try { await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: oldSlOrderId }); }
      catch (e) { /* mungkin sudah ke-trigger/kadaluarsa - aman diabaikan, tetap lanjut pasang yang baru */ }
    }

    stage = 'newSlOrder';
    const closeSide = side === 'BUY' ? 'SELL' : 'BUY';
    const newSlOrder = await futuresRequest('POST', '/fapi/v1/algoOrder', {
      algoType: 'CONDITIONAL', symbol, side: closeSide, type: 'STOP_MARKET', triggerPrice: breakevenPrice, quantity, reduceOnly: 'true'
    });

    res.json({ newSlOrder });
  } catch (e) {
    res.status(500).json({
      stage,
      sentParams: { symbol, side, quantity, oldSlOrderId, breakevenPrice },
      error: e.response ? e.response.data : e.message
    });
  }
});

// Cek status semua posisi Futures (dipakai tool buat deteksi posisi yang
// SUDAH tertutup otomatis di Binance lewat TP/SL, tapi belum diketahui tool
// karena tool cuma tahu lewat klik "Close Posisi" manual atau cek ini).
// Juga sekalian kirim entryPrice & unRealizedProfit ASLI dari Binance, supaya
// tool bisa sinkron data posisi (bukan cuma andalan catatan sendiri yang bisa
// meleset karena slip harga saat entry).
// Return: [{ symbol, positionAmt, entryPrice, unRealizedProfit }] - positionAmt
// 0 artinya sudah tidak ada posisi.
app.get('/api/positions', requireToken, async (req, res) => {
  try {
    const data = await futuresRequest('GET', '/fapi/v2/positionRisk', {});
    const positions = (Array.isArray(data) ? data : []).map(p => ({
      symbol: p.symbol,
      positionAmt: parseFloat(p.positionAmt),
      entryPrice: parseFloat(p.entryPrice),
      unRealizedProfit: parseFloat(p.unRealizedProfit)
    }));
    res.json({ positions });
  } catch (e) {
    res.status(500).json({ error: e.response ? e.response.data : e.message });
  }
});

/* GET /api/open-orders  ->  SL & TP yang SEDANG terpasang di bursa
   ──────────────────────────────────────────────────────────────────────────
   Order entry kripto dari web memang sudah memasang STOP_MARKET dan
   TAKE_PROFIT_MARKET di Binance - tapi /fapi/v2/positionRisk tidak
   menyebutkannya sama sekali, jadi web menampilkan posisi tanpa SL/TP dan
   jurnal menulis "belum dipasang" untuk posisi yang stopnya justru aman.

   Yang dipulangkan sengaja RINGKAS: satu baris per simbol berisi harga
   pemicu SL dan TP. Sumbernya bursa, bukan catatan kita sendiri - jadi
   SL yang digeser lewat aplikasi Binance pun ikut terbaca. */
app.get('/api/open-orders', requireToken, async (req, res) => {
  try {
    const data = await futuresRequest('GET', '/fapi/v1/openOrders', {});
    const perSimbol = {};
    (Array.isArray(data) ? data : []).forEach(o => {
      const s = o.symbol;
      if (!perSimbol[s]) perSimbol[s] = { simbol: s, sl: 0, tp: 0 };
      const pemicu = parseFloat(o.stopPrice) || 0;
      if (!pemicu) return;
      if (o.type === 'STOP_MARKET' || o.type === 'STOP') perSimbol[s].sl = pemicu;
      if (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT') perSimbol[s].tp = pemicu;
    });
    res.json({ ok: true, order: Object.values(perSimbol) });
  } catch (e) {
    res.status(500).json({ error: e.response ? e.response.data : e.message });
  }
});

// Riwayat income asli (REALIZED_PNL, komisi/exchange fee & funding fee) dari
// Binance - dipakai buat sinkron biaya & PNL ASLI, bukan estimasi/rumus sendiri.
// Query:
//   ?since=TIMESTAMP_MS  (opsional, default 7 hari terakhir versi Binance)
//   ?all=1               (opsional, ambil SEMUA record sejak `since` dengan
//                         paginasi otomatis - dipakai halaman Jurnal untuk
//                         sinkronisasi riwayat penuh)
// Binance membatasi 1000 record per panggilan, jadi untuk riwayat panjang
// harus diambil bertahap: tiap batch penuh, lanjut dari waktu record terakhir.
/* GET /api/user-trades?symbol=BTCUSDT&since=<ms>
   ──────────────────────────────────────────────────────────────────────────
   Fill sesungguhnya dari Binance, lengkap dengan orderId, harga, dan
   realizedPnl. Dipakai screener untuk MENGETAHUI - bukan menebak - apa yang
   menutup sebuah posisi.

   Sebelum ini, saat posisi hilang dari Binance, screener menebak TP atau SL
   dari harga mana yang lebih dekat. Kalau posisinya ditutup manual lewat
   aplikasi Binance, tebakan itu tetap menuliskan "TP1" atau "Stop Loss" -
   jurnalnya jadi berisi keterangan yang salah, dan itu justru merusak evaluasi
   yang jadi tujuan jurnalnya. Dengan orderId asli, jawabannya pasti: cocok
   dengan order SL kita berarti SL, cocok TP berarti TP, tidak cocok keduanya
   berarti ditutup dari tempat lain. */
app.get('/api/user-trades', requireToken, async (req, res) => {
  const symbol = String(req.query.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!symbol) return res.status(400).json({ error: 'symbol wajib diisi' });
  try {
    const params = { symbol, limit: 100 };
    if (req.query.since) params.startTime = req.query.since;
    const data = await futuresRequest('GET', '/fapi/v1/userTrades', params);
    // Dipangkas: screener cuma butuh ini, dan respons mentah ikut membawa
    // banyak field yang tidak dipakai.
    const ringkas = (Array.isArray(data) ? data : []).map(t => ({
      orderId: String(t.orderId),
      time: t.time,
      side: t.side,
      price: parseFloat(t.price),
      qty: parseFloat(t.qty),
      realizedPnl: parseFloat(t.realizedPnl),
      commission: parseFloat(t.commission)
    }));
    res.json({ ok: true, trades: ringkas });
  } catch (e) {
    const status = (e.response && e.response.status) || 500;
    res.status(status).json({ error: e.response ? e.response.data : e.message });
  }
});

app.get('/api/income', requireToken, async (req, res) => {
  try {
    const params = {};
    if (req.query.since) params.startTime = req.query.since;

    if (!req.query.all) {
      const data = await futuresRequest('GET', '/fapi/v1/income', params);
      return res.json({ income: data });
    }

    const MAX_PAGES = 30;          // pengaman: maks 30.000 record per permintaan
    const PAGE_SIZE = 1000;        // batas maksimum Binance
    let semua = [];
    let start = req.query.since ? parseInt(req.query.since, 10) : undefined;
    let halaman = 0;
    let terpotong = false;

    for (; halaman < MAX_PAGES; halaman++) {
      const p = { limit: PAGE_SIZE };
      if (start !== undefined) p.startTime = start;
      const batch = await futuresRequest('GET', '/fapi/v1/income', p);
      if (!Array.isArray(batch) || batch.length === 0) break;
      semua = semua.concat(batch);
      if (batch.length < PAGE_SIZE) break;

      const waktuTerakhir = parseInt(batch[batch.length - 1].time, 10);
      // Pengaman anti-loop: kalau waktu tidak maju, hentikan.
      if (!(waktuTerakhir > (start || 0))) break;
      start = waktuTerakhir + 1;
      if (halaman === MAX_PAGES - 1) terpotong = true;
    }

    res.json({ income: semua, halaman: halaman + 1, terpotong });
  } catch (e) {
    res.status(500).json({ error: e.response ? e.response.data : e.message });
  }
});

// Batalkan sisa order SL/TP algo yang masih menggantung (dipakai setelah tool
// mendeteksi posisi sudah tertutup sendiri di Binance via TP/SL - salah satu
// order (yang tidak ke-trigger) masih tersisa dan perlu dibersihkan).
app.post('/api/trade/futures/cancel-pending', requireToken, async (req, res) => {
  const { symbol, slOrderId, tp1OrderId, tp2OrderId } = req.body;
  if (!symbol) return res.status(400).json({ error: 'symbol wajib diisi' });
  const results = {};
  if (slOrderId) {
    try { results.sl = await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: slOrderId }); }
    catch (e) { results.sl = { skipped: true }; /* sudah ke-trigger/kadaluarsa - aman diabaikan */ }
  }
  if (tp1OrderId) {
    try { results.tp1 = await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: tp1OrderId }); }
    catch (e) { results.tp1 = { skipped: true }; }
  }
  if (tp2OrderId) {
    try { results.tp2 = await futuresRequest('DELETE', '/fapi/v1/algoOrder', { symbol, algoId: tp2OrderId }); }
    catch (e) { results.tp2 = { skipped: true }; }
  }
  res.json(results);
});

// ═══════════════════════════════════════════════════════
// KALENDER EKONOMI (NFP / CPI / PPI / FOMC / Unemployment Claims)
// ═══════════════════════════════════════════════════════
// Diambil dari server, BUKAN dari browser: penyedia kalender umumnya memblokir
// permintaan lintas-domain, dan hasilnya di-cache supaya berapa pun device yang
// membuka tools cuma jadi satu kali ambil per 15 menit.
// Sengaja TANPA requireToken - ini data publik, tidak menyentuh akun Binance,
// dan dipakai halaman sebelum user mengisi token.
const NEWS_CACHE_MS = 15 * 60 * 1000;
const NEWS_SUMBER = [
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json'
];
let newsCache = { at: 0, data: null, sumber: null };

function normalisasiDampak(v) {
  const t = String(v || '').toLowerCase();
  if (t.includes('high')) return 'high';
  if (t.includes('medium') || t.includes('moderate')) return 'medium';
  if (t.includes('low')) return 'low';
  return 'holiday';
}

// Angka kalender bisa berupa "220K", "3.2%", "-0.1%", "" atau null.
// Dikembalikan apa adanya untuk ditampilkan, plus versi numerik untuk hitung
// selisih forecast vs actual. Yang tidak bisa diurai -> null, bukan 0, supaya
// tidak salah dianggap "actual sama dengan forecast".
function keAngka(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t) return null;
  const m = t.replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)\s*([KMB%]?)/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  const suf = (m[2] || '').toUpperCase();
  if (suf === 'K') n *= 1e3;
  else if (suf === 'M') n *= 1e6;
  else if (suf === 'B') n *= 1e9;
  return n;
}

function petakanEvent(e) {
  const waktu = e.date ? Date.parse(e.date) : NaN;
  return {
    judul: e.title || e.event || '-',
    mataUang: e.country || e.currency || '-',
    waktu: isFinite(waktu) ? waktu : null,   // epoch ms, UTC - browser yang mengubah ke zona lokal
    dampak: normalisasiDampak(e.impact),
    actual: e.actual || null,
    forecast: e.forecast || null,
    previous: e.previous || null,
    actualNum: keAngka(e.actual),
    forecastNum: keAngka(e.forecast),
    previousNum: keAngka(e.previous)
  };
}

async function ambilKalender() {
  let errTerakhir = null;
  for (const url of NEWS_SUMBER) {
    try {
      const r = await axios.get(url, {
        timeout: 12000,
        headers: { 'User-Agent': 'JadiTraderTools/1.0' }
      });
      const raw = Array.isArray(r.data) ? r.data : (r.data && Array.isArray(r.data.events) ? r.data.events : null);
      if (!raw) throw new Error('format tidak dikenali');
      const events = raw.map(petakanEvent).filter(e => e.waktu !== null);
      events.sort((a, b) => a.waktu - b.waktu);
      return { events, sumber: url };
    } catch (e) {
      errTerakhir = e;
    }
  }
  throw errTerakhir || new Error('semua sumber gagal');
}

app.get('/api/news', async (req, res) => {
  const sekarang = Date.now();
  const paksa = req.query.refresh === '1';
  if (!paksa && newsCache.data && (sekarang - newsCache.at) < NEWS_CACHE_MS) {
    return res.json({ ok: true, cached: true, umurDetik: Math.round((sekarang - newsCache.at) / 1000),
                      sumber: newsCache.sumber, events: newsCache.data });
  }
  try {
    const hasil = await ambilKalender();
    newsCache = { at: sekarang, data: hasil.events, sumber: hasil.sumber };
    res.json({ ok: true, cached: false, umurDetik: 0, sumber: hasil.sumber, events: hasil.events });
  } catch (e) {
    // Kalau pengambilan gagal tapi masih ada cache lama, kirim cache lama -
    // kalender basi jauh lebih berguna daripada panel kosong.
    if (newsCache.data) {
      return res.json({ ok: true, cached: true, basi: true,
                        umurDetik: Math.round((sekarang - newsCache.at) / 1000),
                        sumber: newsCache.sumber, events: newsCache.data,
                        peringatan: 'gagal memuat data baru, menampilkan cache terakhir' });
    }
    res.status(502).json({ ok: false, error: 'Gagal memuat kalender: ' + (e && e.message ? e.message : 'tidak diketahui') });
  }
});

// ═══════════════════════════════════════════════════════
// ████████  PROXY DATA PASAR (publik, tanpa token)  ████████
// ═══════════════════════════════════════════════════════
// Screener memanggil Binance LANGSUNG dari browser. Di negara yang memblokir
// Binance (mis. Indonesia lewat ISP), semua permintaan itu gagal ("Failed to
// fetch") sehingga web tampil kosong walau akun sudah aktif. VPS ini tidak kena
// blokir, jadi ia meneruskan permintaan data PUBLIK (klines & ticker 24h) atas
// nama browser. Tidak butuh API key & tidak menyentuh akun trading - murni data
// pasar - karena itu tanpa requireToken supaya user lain bisa memakainya.
// Ada cache singkat + batas laju supaya tidak membebani VPS & kena rate limit
// Binance (bobot IP dibagi bersama dengan endpoint trading).

const MKT_SPOT = 'https://api.binance.com';
const MKT_FUT  = 'https://fapi.binance.com';

const mktCache = new Map();              // key -> { at, data }
const KLINES_TTL_MS  = 20 * 1000;        // candle terakhir cukup segar di 20 dtk
const TICKERS_TTL_MS = 15 * 1000;

function cacheAmbil(key, ttl) {
  const c = mktCache.get(key);
  if (c && (Date.now() - c.at) < ttl) return c.data;
  return null;
}
function cacheSimpan(key, data) {
  mktCache.set(key, { at: Date.now(), data });
  // jaga jangan sampai membengkak tanpa batas
  if (mktCache.size > 800) {
    const tertua = [...mktCache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 200);
    tertua.forEach(([k]) => mktCache.delete(k));
  }
}

// Batas laju sederhana per IP (data publik, jadi cukup longgar).
const mktHits = new Map();
const MKT_WINDOW_MS = 60 * 1000;
const MKT_MAX_PER_WINDOW = 600;          // 1 pindaian ~100 koin masih muat
function batasLaju(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const now = Date.now();
  const h = mktHits.get(ip);
  if (!h || (now - h.at) > MKT_WINDOW_MS) {
    mktHits.set(ip, { at: now, n: 1 });
    return next();
  }
  h.n += 1;
  if (h.n > MKT_MAX_PER_WINDOW) {
    return res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi sebentar lagi' });
  }
  next();
}

/* ══════════════════════════════════════════════════════════════════════════
   GERBANG LANGGANAN untuk data pasar
   ══════════════════════════════════════════════════════════════════════════
   Penguncian di halaman web bisa dilewati siapa pun yang membuka view-source,
   jadi fitur berbayar harus dijaga DI SINI juga. Alurnya:

     1. Peramban mengirim  Authorization: Bearer <ID token Firebase>
     2. Tanda tangan token diperiksa terhadap sertifikat publik Google
        (RS256). Tidak perlu service-account key - cuma kunci PUBLIK, jadi
        tidak ada rahasia baru yang harus disimpan di VPS.
     3. Dokumen langganan/{uid} dibaca lewat Firestore REST MEMAKAI TOKEN
        PENGGUNA ITU SENDIRI. Aturan Firestore mengizinkan orang membaca
        dokumennya sendiri, jadi ini jalan tanpa hak istimewa apa pun - dan
        pengguna tetap tidak bisa memalsukan isinya karena update/delete
        ditolak aturan.

   Dimatikan secara bawaan. Nyalakan lewat .env:  GERBANG_LANGGANAN=1
   Sengaja begitu supaya server ini bisa di-deploy lebih dulu tanpa memutus
   siapa pun; gerbangnya baru dinyalakan sesudah halaman webnya ikut naik.
   ══════════════════════════════════════════════════════════════════════════ */
const GERBANG_LANGGANAN = process.env.GERBANG_LANGGANAN === '1';
const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || 'jadi-trader-tools';
const OWNER_UID = process.env.OWNER_UID || 'EOrakx0QnSVgsi6BECSOXvUM9kG3';
const HARI_COBA = parseInt(process.env.HARI_COBA, 10) || 30;
const SERTIFIKAT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let sertifCache = { data: null, sampai: 0 };
async function ambilSertifikat() {
  if (sertifCache.data && Date.now() < sertifCache.sampai) return sertifCache.data;
  const r = await axios.get(SERTIFIKAT_URL, { timeout: 8000 });
  // Google memberi tahu masa berlakunya lewat Cache-Control; dihormati supaya
  // sertifikatnya tidak ditarik ulang tiap permintaan, tapi juga tidak basi.
  const cc = String(r.headers['cache-control'] || '');
  const m = cc.match(/max-age=(\d+)/);
  const umur = m ? parseInt(m[1], 10) * 1000 : 3600 * 1000;
  sertifCache = { data: r.data, sampai: Date.now() + Math.max(60000, umur - 60000) };
  return r.data;
}

function b64urlKeJson(s) {
  return JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

async function verifikasiIdToken(token) {
  const bagian = String(token || '').split('.');
  if (bagian.length !== 3) throw new Error('bentuk token salah');
  const header = b64urlKeJson(bagian[0]);
  const isi = b64urlKeJson(bagian[1]);
  if (header.alg !== 'RS256') throw new Error('algoritma token tidak didukung');

  const kini = Math.floor(Date.now() / 1000);
  if (!isi.exp || isi.exp < kini) throw new Error('token kedaluwarsa');
  if (isi.aud !== FB_PROJECT) throw new Error('token bukan untuk proyek ini');
  if (isi.iss !== 'https://securetoken.google.com/' + FB_PROJECT) throw new Error('penerbit token salah');
  if (!isi.sub) throw new Error('token tanpa uid');

  const sertif = await ambilSertifikat();
  const pem = sertif[header.kid];
  if (!pem) throw new Error('kunci penanda tangan tidak dikenal');

  const v = crypto.createVerify('RSA-SHA256');
  v.update(bagian[0] + '.' + bagian[1]);
  v.end();
  const sah = v.verify(crypto.createPublicKey(pem), Buffer.from(bagian[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
  if (!sah) throw new Error('tanda tangan token tidak cocok');

  return { uid: isi.sub, email: isi.email || '' };
}

// Status langganan dicache per-uid supaya satu kali pemindaian (puluhan
// permintaan klines) tidak jadi puluhan pembacaan Firestore.
const langgananCache = new Map();
const LANGGANAN_TTL_MS = 5 * 60 * 1000;

function waktuField(f) {
  if (!f) return null;
  if (f.timestampValue) return Date.parse(f.timestampValue);
  if (f.integerValue) return parseInt(f.integerValue, 10);
  return null;
}

async function statusLangganan(uid, idToken) {
  if (uid === OWNER_UID) return { aktif: true, alasan: 'pemilik' };
  const cached = langgananCache.get(uid);
  if (cached && Date.now() < cached.sampai) return cached.nilai;

  let nilai;
  try {
    const url = 'https://firestore.googleapis.com/v1/projects/' + FB_PROJECT
              + '/databases/(default)/documents/langganan/' + encodeURIComponent(uid);
    const r = await axios.get(url, {
      headers: { Authorization: 'Bearer ' + idToken },
      timeout: 8000,
      validateStatus: s => (s >= 200 && s < 300) || s === 404
    });
    if (r.status === 404) {
      // Dokumennya dibuat halaman web saat login. Kalau belum ada, berarti
      // masa cobanya memang belum pernah dimulai.
      nilai = { aktif: false, alasan: 'belum ada masa coba' };
    } else {
      const f = (r.data && r.data.fields) || {};
      const kini = Date.now();
      const bayar = waktuField(f.bayarSampai);
      const mulai = waktuField(f.mulai);
      if (bayar && bayar > kini) nilai = { aktif: true, alasan: 'berlangganan', sampai: bayar };
      else if (mulai && (mulai + HARI_COBA * 86400000) > kini) nilai = { aktif: true, alasan: 'masa coba', sampai: mulai + HARI_COBA * 86400000 };
      else nilai = { aktif: false, alasan: 'masa coba habis' };
    }
  } catch (e) {
    // Firestore tidak terjawab bukan salah pengguna. Menolak di sini berarti
    // orang yang sudah bayar ikut terkunci saat Google sedang lambat.
    nilai = { aktif: true, alasan: 'status tidak terbaca (dibiarkan lewat)' };
  }
  langgananCache.set(uid, { nilai, sampai: Date.now() + LANGGANAN_TTL_MS });
  return nilai;
}

async function butuhLangganan(req, res, next) {
  if (!GERBANG_LANGGANAN) return next();
  const h = String(req.headers.authorization || '');
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Butuh login', kode: 'LANGGANAN_LOGIN' });
  }
  try {
    const { uid } = await verifikasiIdToken(token);
    const st = await statusLangganan(uid, token);
    if (!st.aktif) {
      return res.status(402).json({ error: 'Masa coba habis — fitur sinyal butuh langganan', kode: 'LANGGANAN_HABIS' });
    }
    req.uid = uid;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesi tidak sah: ' + (e.message || 'token ditolak'), kode: 'LANGGANAN_TOKEN' });
  }
}

const INTERVAL_SAH = new Set(['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M']);

// GET /api/klines?symbol=BTCUSDT&interval=1h&limit=250
// Meniru perilaku fetchKlines di screener: coba Spot dulu, kalau simbolnya tidak
// ada di Spot (mis. koin yang cuma listing di Futures) jatuh balik ke Futures.
app.get('/api/klines', batasLaju, butuhLangganan, async (req, res) => {
  const symbol = String(req.query.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const interval = String(req.query.interval || '');
  let limit = parseInt(req.query.limit, 10);
  if (!symbol) return res.status(400).json({ error: 'symbol wajib diisi' });
  if (!INTERVAL_SAH.has(interval)) return res.status(400).json({ error: 'interval tidak sah' });
  if (!Number.isFinite(limit) || limit < 1) limit = 250;
  if (limit > 1000) limit = 1000;

  const key = `k:${symbol}:${interval}:${limit}`;
  // fresh=1 = jalur chart live V3: satu simbol yang sedang ditatap orangnya.
  // Cache-nya dipendekkan ke 2,5 dtk, BUKAN dimatikan - dua tab chart yang
  // sama tetap berbagi satu permintaan. Pemindaian screener (puluhan simbol
  // sekaligus) tidak memakai fresh, jadi pelindung 20 dtk-nya tetap utuh.
  const ttl = req.query.fresh === '1' ? 2500 : KLINES_TTL_MS;
  const cached = cacheAmbil(key, ttl);
  if (cached) return res.json(cached);

  const path = `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const pathFut = `/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  try {
    let data, market = 'spot';
    try {
      const r = await axios.get(MKT_SPOT + path, { timeout: 12000 });
      data = r.data;
    } catch (e1) {
      const r2 = await axios.get(MKT_FUT + pathFut, { timeout: 12000 });
      data = r2.data;
      market = 'futures';
    }
    const hasil = { ok: true, market, data };
    cacheSimpan(key, hasil);
    res.json(hasil);
  } catch (e) {
    const status = (e.response && e.response.status) || 502;
    res.status(status).json({ error: 'Gagal ambil klines ' + symbol + ': ' + (e.message || 'tidak diketahui') });
  }
});

// GET /api/tickers -> ticker 24 jam (harga & %24h)
// Respons Binance mentah ~1,9 MB (3.600+ simbol x 20+ field). Dengan banyak user
// yang menariknya tiap belasan detik, itu membebani bandwidth VPS jauh sebelum
// rate limit Binance jadi masalah. Karena screener HANYA memakai pasangan USDT
// dan HANYA field lastPrice + priceChangePercent, respons disaring & dipangkas
// di sini (turun jadi puluhan KB), lalu masih di-gzip oleh middleware.
//   ?quote=USDT (bawaan)  -> hanya pasangan berakhiran USDT
//   ?quote=all            -> semua simbol (tetap dipangkas fieldnya)
//   ?full=1               -> field lengkap apa adanya (untuk keperluan lain)
app.get('/api/tickers', batasLaju, butuhLangganan, async (req, res) => {
  const quote = String(req.query.quote || 'USDT').toUpperCase();
  const full = req.query.full === '1';
  const key = `tickers:${quote}:${full ? 'full' : 'slim'}`;
  const cached = cacheAmbil(key, TICKERS_TTL_MS);
  if (cached) return res.json(cached);
  try {
    const r = await axios.get(MKT_SPOT + '/api/v3/ticker/24hr', { timeout: 15000 });
    let rows = Array.isArray(r.data) ? r.data : [];
    if (quote !== 'ALL') rows = rows.filter(t => typeof t.symbol === 'string' && t.symbol.endsWith(quote));
    if (!full) rows = rows.map(t => ({
      symbol: t.symbol,
      lastPrice: t.lastPrice,
      priceChangePercent: t.priceChangePercent
    }));
    const hasil = { ok: true, jumlah: rows.length, data: rows };
    cacheSimpan(key, hasil);
    res.json(hasil);
  } catch (e) {
    const status = (e.response && e.response.status) || 502;
    res.status(status).json({ error: 'Gagal ambil tickers: ' + (e.message || 'tidak diketahui') });
  }
});

// GET /api/ticker-price?symbol=BTCUSDT -> harga terakhir 1 simbol
app.get('/api/ticker-price', batasLaju, butuhLangganan, async (req, res) => {
  const symbol = String(req.query.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!symbol) return res.status(400).json({ error: 'symbol wajib diisi' });
  const key = 'p:' + symbol;
  const cached = cacheAmbil(key, TICKERS_TTL_MS);
  if (cached) return res.json(cached);
  try {
    let data;
    try {
      const r = await axios.get(MKT_SPOT + '/api/v3/ticker/price?symbol=' + symbol, { timeout: 10000 });
      data = r.data;
    } catch (e1) {
      const r2 = await axios.get(MKT_FUT + '/fapi/v1/ticker/price?symbol=' + symbol, { timeout: 10000 });
      data = r2.data;
    }
    const hasil = { ok: true, data };
    cacheSimpan(key, hasil);
    res.json(hasil);
  } catch (e) {
    const status = (e.response && e.response.status) || 502;
    res.status(status).json({ error: 'Gagal ambil harga ' + symbol + ': ' + (e.message || 'tidak diketahui') });
  }
});

// ── Presisi qty/harga per simbol ────────────────────────────────────────────
// Dipakai halaman MOBILE sebelum mengirim order. Halaman desktop mengambil
// exchangeInfo langsung dari fapi.binance.com, tapi dari HP itu diblokir ISP -
// dan presisi TIDAK BOLEH ditebak: Binance menolak order (-1111) kalau jumlah
// desimalnya tidak sesuai aturan simbol. Endpoint ini cuma BACA, tidak menyentuh
// order apa pun. Tetap di belakang token supaya tidak jadi endpoint publik baru.
const FILTER_TTL_MS = 6 * 60 * 60 * 1000;   // aturan simbol jarang berubah
app.get('/api/symbol-filters', batasLaju, requireToken, async (req, res) => {
  const symbol = String(req.query.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!symbol) return res.status(400).json({ error: 'symbol wajib diisi' });
  const key = 'f:' + symbol;
  const cached = cacheAmbil(key, FILTER_TTL_MS);
  if (cached) return res.json(cached);
  try {
    const r = await axios.get(BASE_URL + '/fapi/v1/exchangeInfo?symbol=' + symbol, { timeout: 12000 });
    // JANGAN pakai symbols[0]: endpoint ini kadang tidak benar-benar memfilter
    // sesuai ?symbol=, jadi index 0 bisa simbol LAIN. Cari yang cocok eksplisit.
    const info = ((r.data && r.data.symbols) || []).find(s => s.symbol === symbol);
    if (!info) return res.status(404).json({ error: 'Simbol ' + symbol + ' tidak ada di exchangeInfo Futures' });
    const f = info.filters || [];
    const marketLot = f.find(x => x.filterType === 'MARKET_LOT_SIZE');
    const lot       = f.find(x => x.filterType === 'LOT_SIZE');
    const price     = f.find(x => x.filterType === 'PRICE_FILTER');
    const hasil = {
      ok: true,
      symbol,
      quantityPrecision: info.quantityPrecision,
      pricePrecision: info.pricePrecision,
      // Order MARKET mengikuti MARKET_LOT_SIZE kalau ada - presisinya kadang
      // beda dari LOT_SIZE biasa dan Binance menolak kalau salah pakai.
      stepSize: marketLot ? marketLot.stepSize : (lot ? lot.stepSize : null),
      tickSize: price ? price.tickSize : null,
      orderTypes: info.orderTypes || []
    };
    cacheSimpan(key, hasil);
    res.json(hasil);
  } catch (e) {
    const status = (e.response && e.response.status) || 502;
    res.status(status).json({ error: 'Gagal ambil filter ' + symbol + ': ' + (e.message || 'tidak diketahui') });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// MARKETPLACE — penyajian kode indikator berbayar
// ════════════════════════════════════════════════════════════════════════════
// Kenapa lewat backend, bukan file .txt di GitHub Pages:
// berkas di Pages punya URL publik yang gampang ditebak, jadi indikator $50
// bisa diambil siapa saja tanpa bayar - pagar harganya cuma hiasan. Di sini
// sumbernya TIDAK PERNAH ada di repo publik; ia hanya keluar kalau kode
// lisensi pembeli sudah diaktifkan pemilik, dan keluar sudah ber-watermark.
const fs = require('fs');
const path = require('path');

const PRODUK_DIR   = path.join(__dirname, 'produk');          // .txt sumber (jangan di-commit ke repo publik)
const LISENSI_FILE = path.join(__dirname, 'lisensi.json');

function lisensiBaca() {
  try { return JSON.parse(fs.readFileSync(LISENSI_FILE, 'utf8')); }
  catch (e) { return { aktif: [] }; }
}
function lisensiTulis(d) {
  fs.writeFileSync(LISENSI_FILE, JSON.stringify(d, null, 2));
}
function sidikDari(kode) {
  return crypto.createHash('sha256').update('sidik|' + kode).digest('hex').slice(0, 10);
}

// Penyisipan penanda — HARUS sama persis dengan versi di marketplace.html,
// supaya pelacak kebocoran di panel pemilik bisa membacanya kembali.
function sisipkanPenanda(sumber, kode) {
  const inti = kode.replace(/^JT3-/, '').replace(/-/g, '');
  const a = inti.substr(0, 4), b = inti.substr(4, 4), c = inti.substr(8, 4);
  const eol = sumber.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const baris = sumber.split(/\r?\n/);
  const stempel = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  let iVer = baris.findIndex(l => l.indexOf('//@version') === 0);
  if (iVer < 0) iVer = 0;
  baris.splice(iVer + 1, 0, '// build ' + stempel + '.' + a.toLowerCase() + ' — dist ' + b.toLowerCase());

  const iInd = baris.findIndex(l => l.indexOf('indicator(') >= 0);
  if (iInd >= 0) {
    baris.splice(iInd + 1, 0, '', '// revisi internal — jangan diubah', '_rev = "' + a + c + '"');
  }

  let tengah = Math.floor(baris.length * 0.55);
  for (let i = tengah; i < baris.length; i++) {
    if (baris[i].indexOf('// ═══') === 0) { tengah = i; break; }
  }
  baris.splice(tengah, 0, '// ref-' + b.toLowerCase() + c.toLowerCase() + ' (' + stempel + ')');

  baris.push('');
  baris.push('// ' + stempel + '-' + a.toLowerCase() + b.toLowerCase() + c.toLowerCase());
  return baris.join(eol);
}

// --- Pemilik: aktifkan kode pembeli (butuh App Token) ---
app.post('/api/lisensi/aktifkan', batasLaju, requireToken, (req, res) => {
  const kode = String((req.body && req.body.kode) || '').trim().toUpperCase();
  if (!/^JT3-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kode)) {
    return res.status(400).json({ error: 'Format kode tidak valid' });
  }
  const d = lisensiBaca();
  const sidik = sidikDari(kode);
  if (d.aktif.some(x => x.sidik === sidik)) return res.json({ ok: true, sudahAda: true, sidik });
  // Kode ASLI tidak disimpan - cukup sidiknya, supaya bocornya berkas
  // lisensi.json tidak membuat orang bisa mengunduh produk.
  d.aktif.push({
    sidik,
    produk: String((req.body && req.body.produk) || 'jadi-trader-v3'),
    catatan: String((req.body && req.body.catatan) || '').slice(0, 120),
    tgl: Date.now()
  });
  lisensiTulis(d);
  res.json({ ok: true, sidik });
});

// --- Pemilik: daftar & cabut ---
app.get('/api/lisensi/daftar', batasLaju, requireToken, (req, res) => {
  res.json({ ok: true, aktif: lisensiBaca().aktif });
});
app.post('/api/lisensi/cabut', batasLaju, requireToken, (req, res) => {
  const sidik = String((req.body && req.body.sidik) || '');
  const d = lisensiBaca();
  const n = d.aktif.length;
  d.aktif = d.aktif.filter(x => x.sidik !== sidik);
  lisensiTulis(d);
  res.json({ ok: true, dicabut: n - d.aktif.length });
});

/* ── PERMINTAAN LISENSI ────────────────────────────────────────────────────
   Sampai sekarang satu-satunya jalur adalah pemilik mengetik kode lalu
   mengaktifkannya. Pembelinya sendiri tidak punya cara memberi tahu bahwa ia
   sudah membayar — jalurnya lewat WhatsApp, dan yang lewat WhatsApp gampang
   terlewat.

   Tiga rute di bawah menutup lingkaran itu: pembeli mengirim permintaan,
   pemilik melihatnya di panel Maintenance, lalu menyetujui — dan penyetujuan
   itulah yang MENERBITKAN kodenya. Tidak ada langkah manual di antaranya
   yang bisa lupa dikerjakan.

   Emailnya diambil dari ID TOKEN yang sudah diverifikasi, bukan dari kiriman
   halaman. Tanpa itu siapa pun bisa mengirim permintaan atas nama orang lain,
   dan daftar yang harus dipercaya pemilik justru jadi tidak bisa dipercaya. */

function lisensiPermintaan(d) {
  if (!Array.isArray(d.permintaan)) d.permintaan = [];
  return d.permintaan;
}

/* Kode JT3-XXXX-XXXX-XXXX. Huruf yang mudah tertukar (I, O, 0, 1) dibuang:
   kode ini dibacakan lewat telepon dan disalin tangan, dan satu karakter
   salah berarti pembeli mengira lisensinya tidak aktif. */
function buatKodeLisensi() {
  const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const blok = () => Array.from({ length: 4 }, () =>
    HURUF[crypto.randomBytes(1)[0] % HURUF.length]).join('');
  return `JT3-${blok()}-${blok()}-${blok()}`;
}

// --- Pembeli: kirim permintaan aktivasi ---
app.post('/api/lisensi/minta', batasLaju, butuhLogin, async (req, res) => {
  const h = String(req.headers.authorization || '');
  let email = '', nama = '';
  try {
    const v = await verifikasiIdToken(h.slice(7));
    email = v.email || '';
    nama = v.name || '';
  } catch (e) {}

  const b = req.body || {};
  const d = lisensiBaca();
  const daftar = lisensiPermintaan(d);

  /* Satu permintaan terbuka per orang per produk. Tanpa penjaga ini, tombol
     yang ditekan berkali-kali karena dikira tidak jalan akan membanjiri panel
     pemilik dengan baris yang sama. */
  const produk = String(b.produk || 'jadi-trader-v3').slice(0, 60);
  const sudah = daftar.find(x => x.uid === req.uid && x.produk === produk && x.status === 'baru');
  if (sudah) return res.json({ ok: true, sudahAda: true, id: sudah.id });

  const item = {
    id: 'R' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    uid: req.uid,
    email,
    nama: String(b.nama || nama || '').slice(0, 80),
    produk,
    catatan: String(b.catatan || '').slice(0, 300),
    bukti: String(b.bukti || '').slice(0, 300),
    status: 'baru',
    waktu: Date.now()
  };
  daftar.unshift(item);
  if (daftar.length > 500) daftar.length = 500;
  lisensiTulis(d);
  res.json({ ok: true, id: item.id });
});

// --- Pembeli: lihat permintaannya sendiri (bukan milik orang lain) ---
app.get('/api/lisensi/minta/saya', batasLaju, butuhLogin, (req, res) => {
  const daftar = lisensiPermintaan(lisensiBaca());
  res.json({
    ok: true,
    permintaan: daftar.filter(x => x.uid === req.uid).map(x => ({
      id: x.id, produk: x.produk, status: x.status, waktu: x.waktu,
      // Kode dikembalikan HANYA kepada pemiliknya sendiri, dan hanya
      // setelah disetujui.
      kode: x.status === 'disetujui' ? (x.kode || '') : ''
    }))
  });
});

// --- Pemilik: daftar permintaan ---
app.get('/api/lisensi/permintaan', batasLaju, requireToken, (req, res) => {
  const daftar = lisensiPermintaan(lisensiBaca());
  res.json({
    ok: true,
    permintaan: daftar.slice(0, 300),
    baru: daftar.filter(x => x.status === 'baru').length
  });
});

// --- Pemilik: setujui / tolak ---
app.post('/api/lisensi/permintaan/putuskan', batasLaju, requireToken, (req, res) => {
  const b = req.body || {};
  const id = String(b.id || '');
  const tindakan = b.tindakan === 'tolak' ? 'tolak' : 'setujui';

  const d = lisensiBaca();
  const daftar = lisensiPermintaan(d);
  const item = daftar.find(x => x.id === id);
  if (!item) return res.status(404).json({ error: 'Permintaan tidak ada' });
  if (item.status !== 'baru') return res.json({ ok: true, sudahDiputus: item.status, kode: item.kode || '' });

  if (tindakan === 'tolak') {
    item.status = 'ditolak';
    item.diputusPada = Date.now();
    lisensiTulis(d);
    return res.json({ ok: true, status: 'ditolak' });
  }

  /* Menyetujui = menerbitkan kode DAN mengaktifkannya dalam satu operasi.
     Kalau dipisah jadi dua langkah, ada keadaan di mana permintaannya sudah
     "disetujui" tapi lisensinya belum aktif — dan pembelinya menunggu
     sesuatu yang tidak akan datang. */
  const kode = String(b.kode || '').trim().toUpperCase() || buatKodeLisensi();
  if (!/^JT3-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kode)) {
    return res.status(400).json({ error: 'Format kode tidak valid' });
  }
  const sidik = sidikDari(kode);
  if (!d.aktif.some(x => x.sidik === sidik)) {
    d.aktif.push({
      sidik,
      produk: item.produk,
      catatan: (item.email || item.nama || '').slice(0, 120),
      tgl: Date.now()
    });
  }
  item.status = 'disetujui';
  item.kode = kode;
  item.sidik = sidik;
  item.diputusPada = Date.now();
  lisensiTulis(d);
  res.json({ ok: true, status: 'disetujui', kode, sidik });
});

// --- Pembeli: cek status (publik, hanya menerima sidik, bukan kodenya) ---
app.get('/api/lisensi/cek', batasLaju, (req, res) => {
  const sidik = String(req.query.sidik || '');
  res.json({ ok: true, aktif: lisensiBaca().aktif.some(x => x.sidik === sidik) });
});

// --- Pembeli: ambil kode indikator (hanya kalau lisensinya aktif) ---
app.get('/api/produk', batasLaju, (req, res) => {
  const id = String(req.query.id || '').replace(/[^a-z0-9-]/g, '');
  const kode = String(req.query.kode || '').trim().toUpperCase();
  if (!id) return res.status(400).json({ error: 'id produk wajib diisi' });
  if (!/^JT3-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kode)) {
    return res.status(400).json({ error: 'Kode lisensi tidak valid' });
  }
  if (!lisensiBaca().aktif.some(x => x.sidik === sidikDari(kode))) {
    return res.status(403).json({ error: 'Lisensi belum aktif. Selesaikan pembayaran lalu minta penjual mengaktifkan kodemu.' });
  }
  const berkas = path.join(PRODUK_DIR, id + '.txt');
  // Jaga-jaga terhadap path traversal walau id sudah disaring.
  if (!berkas.startsWith(PRODUK_DIR)) return res.status(400).json({ error: 'id tidak valid' });
  fs.readFile(berkas, 'utf8', (err, isi) => {
    if (err) return res.status(404).json({ error: 'Sumber produk belum tersedia di server' });
    res.json({ ok: true, id, kode: sisipkanPenanda(isi, kode) });
  });
});

/* --- Pemilik: unggah SUMBER produk -----------------------------------------
   Sumber premium tidak boleh ada di repo publik, jadi satu-satunya cara
   memasukkannya adalah lewat sini. Menerima teks apa adanya (Pine, MQ5, apa pun
   yang bisa ditempel) ATAU berkas biner ber-base64 untuk .ex5 yang tidak bisa
   ditempel sebagai teks.

   Sengaja TIDAK memakai nama berkas kiriman: namanya diturunkan dari id produk
   yang sudah disaring, supaya "../../etc/passwd" tidak punya jalan masuk. */
app.post('/api/produk/unggah', batasLaju, requireToken, express.json({ limit: '12mb' }), (req, res) => {
  const b = req.body || {};
  const id = String(b.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!id) return res.status(400).json({ error: 'id produk wajib diisi (huruf kecil, angka, tanda hubung)' });

  // Ekstensi dibatasi daftar putih. .ex5 & .mq5 untuk EA MetaTrader, .txt untuk
  // Pine dan teks lain.
  const EKST = { txt: '.txt', mq5: '.mq5', ex5: '.ex5' };
  const jenis = String(b.jenis || 'txt').toLowerCase();
  if (!EKST[jenis]) return res.status(400).json({ error: 'jenis harus txt, mq5, atau ex5' });

  let isi;
  if (b.base64) {
    try { isi = Buffer.from(String(b.base64).replace(/^data:[^,]*,/, ''), 'base64'); }
    catch (e) { return res.status(400).json({ error: 'base64 tidak terbaca' }); }
  } else {
    const teks = String(b.teks || '');
    if (!teks.trim()) return res.status(400).json({ error: 'isi kode kosong' });
    isi = Buffer.from(teks, 'utf8');
  }
  if (isi.length > 8 * 1024 * 1024) {
    return res.status(413).json({ error: 'berkas ' + (isi.length / 1048576).toFixed(1) + ' MB, batasnya 8 MB' });
  }

  const berkas = path.join(PRODUK_DIR, id + EKST[jenis]);
  if (!berkas.startsWith(PRODUK_DIR)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    fs.mkdirSync(PRODUK_DIR, { recursive: true });
    fs.writeFileSync(berkas, isi, { mode: 0o600 });

    /* Penanda "produk ini gratis". Backend tidak punya katalog - harga hanya ada
       di Firestore - jadi tanpa penanda ini server tidak punya cara membedakan
       mana yang boleh dibagikan bebas dan mana yang harus menunggu lisensi.
       Diputuskan saat unggah, oleh pemilik, lewat token. */
    const tanda = path.join(PRODUK_DIR, id + '.gratis');
    if (b.gratis) fs.writeFileSync(tanda, '1');
    else if (fs.existsSync(tanda)) fs.unlinkSync(tanda);
  } catch (e) {
    return res.status(500).json({ error: 'gagal menyimpan: ' + e.message });
  }
  res.json({ ok: true, id, berkas: path.basename(berkas), ukuran: isi.length, gratis: !!b.gratis });
});

/* Sumber produk GRATIS - publik, tanpa lisensi apa pun.

   Dulu kode produk gratis ditulis sebagai teks literal di dalam marketplace.html
   (peta SUMBER_GRATIS). Akibatnya produk baru yang ditambahkan lewat Panel
   Pemilik selalu berakhir "Kode indikator ini belum tersedia di halaman":
   katalognya bisa dibuat dari web, tapi kodenya cuma bisa ditambah dengan
   mengedit HTML lalu mengunggahnya ulang. */
app.get('/api/produk/gratis', batasLaju, (req, res) => {
  const id = String(req.query.id || '').replace(/[^a-z0-9-]/g, '');
  const jenis = String(req.query.jenis || 'txt').toLowerCase();
  const EKST = { txt: '.txt', mq5: '.mq5' };
  if (!id || !EKST[jenis]) return res.status(400).json({ error: 'id / jenis tidak valid' });

  const tanda = path.join(PRODUK_DIR, id + '.gratis');
  if (!tanda.startsWith(PRODUK_DIR) || !fs.existsSync(tanda)) {
    return res.status(403).json({ error: 'Produk ini tidak ditandai gratis' });
  }
  const berkas = path.join(PRODUK_DIR, id + EKST[jenis]);
  fs.readFile(berkas, 'utf8', (err, isi) => {
    if (err) return res.status(404).json({ error: 'Sumber produk belum tersedia di server' });
    res.json({ ok: true, id, jenis, kode: isi });
  });
});

// Daftar sumber yang sudah ada - supaya panel pemilik bisa menunjukkan produk
// mana yang sumbernya sudah terpasang dan mana yang masih kosong.
app.get('/api/produk/sumber', batasLaju, requireToken, (req, res) => {
  let d = [];
  try {
    d = fs.readdirSync(PRODUK_DIR).map(n => {
      const st = fs.statSync(path.join(PRODUK_DIR, n));
      return { berkas: n, ukuran: st.size, tgl: st.mtimeMs };
    }).sort((a, b) => b.tgl - a.tgl);
  } catch (e) {}
  res.json({ ok: true, sumber: d });
});

/* Pembeli mengunduh berkas BINER (.ex5) - tidak bisa ditempel sebagai teks,
   jadi tidak bisa lewat /api/produk yang mengembalikan JSON. Gerbangnya sama
   persis: lisensi harus aktif.

   Catatan jujur: berkas biner TIDAK bisa disisipi penanda lisensi seperti yang
   dilakukan pada sumber teks, jadi kalau .ex5 ini bocor, tidak ada cara
   melacak dari salinannya siapa pembeli aslinya. */
app.get('/api/produk/berkas', batasLaju, (req, res) => {
  const id = String(req.query.id || '').replace(/[^a-z0-9-]/g, '');
  const kode = String(req.query.kode || '').trim().toUpperCase();
  const jenis = String(req.query.jenis || 'ex5').toLowerCase();
  const EKST = { ex5: '.ex5', mq5: '.mq5' };
  if (!id || !EKST[jenis]) return res.status(400).json({ error: 'id / jenis tidak valid' });

  // Produk bertanda gratis dilewatkan tanpa lisensi - EA sinkronisasi jurnal
  // memang dibagikan bebas, dan memintanya punya kode lisensi cuma menghalangi.
  const tanda = path.join(PRODUK_DIR, id + '.gratis');
  const gratis = tanda.startsWith(PRODUK_DIR) && fs.existsSync(tanda);
  if (!gratis) {
    if (!/^JT3-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kode)) {
      return res.status(400).json({ error: 'Kode lisensi tidak valid' });
    }
    if (!lisensiBaca().aktif.some(x => x.sidik === sidikDari(kode))) {
      return res.status(403).json({ error: 'Lisensi belum aktif.' });
    }
  }
  const berkas = path.join(PRODUK_DIR, id + EKST[jenis]);
  if (!berkas.startsWith(PRODUK_DIR)) return res.status(400).json({ error: 'id tidak valid' });
  if (!fs.existsSync(berkas)) return res.status(404).json({ error: 'Berkas belum tersedia di server' });
  res.download(berkas, id + EKST[jenis]);
});

// ── Gambar produk marketplace ───────────────────────────────────────────────
// Tangkapan layar indikator disimpan di VPS lalu disajikan sebagai berkas biasa.
// Alternatifnya menaruh gambar sebagai base64 di Firestore - tapi satu dokumen
// dibatasi 1 MiB, dan beberapa tangkapan layar chart saja sudah melewatinya.
const GAMBAR_DIR = path.join(__dirname, 'gambar');
try { fs.mkdirSync(GAMBAR_DIR, { recursive: true }); } catch (e) {}

// Dibaca publik (memang untuk dipajang di halaman jualan), cache 1 hari.
app.use('/gambar', express.static(GAMBAR_DIR, { maxAge: '1d' }));

// ── Aplikasi V3 (React) ─────────────────────────────────────────────────────
// Disajikan sebagai berkas statis dari /root/v3, sejajar dengan folder aplikasi
// ini - sengaja DI LUAR direktori backend supaya `npm ci` atau penggantian
// server.js tidak pernah menyentuhnya.
//
// Cache dibedakan dan itu bukan detail sepele:
//   · berkas di assets/ namanya berhash, jadi isinya tidak akan pernah berubah
//     untuk nama yang sama - aman disimpan lama (immutable).
//   · index.html TIDAK boleh di-cache. Ia yang memuat daftar nama berhash itu;
//     kalau ikut disimpan, peramban akan meminta potongan versi lama setelah
//     rilis berikutnya dan layarnya jadi putih.
// Situs V2 (HTML) — disajikan supaya bisa DITANAM di dalam V3 tanpa melintasi
// domain. Sama-domain itu bukan kerapian: Firebase menyimpan sesi login di
// IndexedDB per-origin, jadi kalau V2 ditanam dari domain lain, orang yang
// sudah masuk di V3 diminta masuk lagi di dalam bingkainya.
//
// index.html V2 SENGAJA tidak ikut: ia pengalih yang akan melempar pengunjung
// keluar dari bingkai.
const V2_DIR = path.join(__dirname, '..', 'v2');
app.use('/v2', express.static(V2_DIR, {
  setHeaders: function (res, berkas) {
    // Berkas V2 tidak berhash, jadi tidak boleh disimpan lama - sekali kamu
    // memperbarui screener, yang lama akan bertahan di peramban orang.
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

const V3_DIR = path.join(__dirname, '..', 'v3');
app.use('/v3', express.static(V3_DIR, {
  setHeaders: function (res, berkas) {
    if (/[\/]assets[\/]/.test(berkas)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

const JENIS_GAMBAR = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

// Batas 12mb: base64 menggelembungkan berkas ~33%, jadi foto 8 MB tiba di sini
// sebagai ~11 MB teks. Parser ini HANYA berlaku untuk rute ini (lihat
// RUTE_UNGGAH di atas) - endpoint lain tetap memakai batas kecil yang aman.
app.post('/api/gambar', batasLaju, requireToken, express.json({ limit: '12mb' }), (req, res) => {
  const dataUrl = String((req.body && req.body.dataUrl) || '');
  const m = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Format gambar tidak dikenali (harus PNG/JPG/WebP)' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) {
    return res.status(413).json({ error: 'Gambar ' + (buf.length / 1048576).toFixed(1) + ' MB, batasnya 8 MB' });
  }

  const aman = String((req.body && req.body.nama) || 'gambar')
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 40);
  const berkas = aman + '-' + Date.now().toString(36) + JENIS_GAMBAR[m[1]];
  try {
    fs.writeFileSync(path.join(GAMBAR_DIR, berkas), buf);
  } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan: ' + e.message });
  }
  const asal = (req.headers['x-forwarded-proto'] || 'https') + '://' + req.headers.host;
  res.json({ ok: true, berkas, url: asal + '/gambar/' + berkas, ukuran: buf.length });
});

app.get('/api/gambar/daftar', batasLaju, requireToken, (req, res) => {
  let d = [];
  try {
    d = fs.readdirSync(GAMBAR_DIR).map(n => {
      const st = fs.statSync(path.join(GAMBAR_DIR, n));
      return { berkas: n, ukuran: st.size, tgl: st.mtimeMs };
    }).sort((a, b) => b.tgl - a.tgl);
  } catch (e) {}
  res.json({ ok: true, gambar: d });
});

app.post('/api/gambar/hapus', batasLaju, requireToken, (req, res) => {
  const n = String((req.body && req.body.berkas) || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!n) return res.status(400).json({ error: 'nama berkas wajib diisi' });
  const p = path.join(GAMBAR_DIR, n);
  if (!p.startsWith(GAMBAR_DIR)) return res.status(400).json({ error: 'nama tidak valid' });
  try { fs.unlinkSync(p); } catch (e) { return res.status(404).json({ error: 'berkas tidak ada' }); }
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════════════════════════
   JEMBATAN MT5 (baca-saja)
   ══════════════════════════════════════════════════════════════════════════
   MT5 tidak punya API cloud: datanya cuma bisa keluar dari terminal MT5 yang
   benar-benar berjalan. Jadi yang mengirim ke sini adalah sebuah Expert
   Advisor (JadiTraderSync.mq5) yang dipasang pengguna di terminalnya sendiri.

   Kenapa lewat EA, bukan meminta password investor lalu server ini yang login:
   cara itu mengharuskan terminal MT5 berjalan di sisi kita, dan VPS ini cuma
   961 MB RAM tanpa swap sementara satu terminal MT5 di Wine butuh 400-700 MB.
   Menaruhnya di sini berarti mempertaruhkan proses yang sedang memantau posisi
   Binance live. Dengan EA, beban server tambahannya cuma menerima JSON.

   Yang MASUK dari EA  : POST /api/mt5/lapor   (dijaga Kode Pasangan)
   Yang KELUAR ke web  : GET  /api/mt5/status  (dijaga ID token Firebase)

   Kode Pasangan itu rahasia pembawa: siapa pun yang memegangnya bisa mengirim
   data atas nama pengguna itu. Karena itu ia MENGUNCI ke satu nomor akun MT5
   pada laporan pertama - laporan berikutnya dari nomor akun lain ditolak,
   sampai pemiliknya sengaja membuat kode baru.
   ══════════════════════════════════════════════════════════════════════════ */
const MT5_FILE = path.join(__dirname, 'mt5.json');

function mt5Baca() {
  try { return JSON.parse(fs.readFileSync(MT5_FILE, 'utf8')); }
  catch (e) { return { kode: {}, data: {} }; }
}
function mt5Tulis(d) {
  fs.writeFileSync(MT5_FILE, JSON.stringify(d, null, 2));
}

// Alfabet tanpa huruf/angka yang mudah tertukar saat disalin tangan (0/O, 1/I).
const ALFABET_KODE = '3479ACDEFHJKLMNPQRTUVWXY';
function buatKodePasangan() {
  let s = '';
  const b = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) s += ALFABET_KODE[b[i] % ALFABET_KODE.length];
  return 'JTM5-' + s.slice(0, 4) + '-' + s.slice(4, 8);
}

// Identitas saja - TANPA syarat langganan. Dipakai endpoint yang perlu tahu
// "ini siapa" tapi tidak boleh ikut mati saat gerbang langganan dinyalakan.
async function butuhLogin(req, res, next) {
  const h = String(req.headers.authorization || '');
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Butuh login', kode: 'LOGIN' });
  try {
    const { uid } = await verifikasiIdToken(token);
    req.uid = uid;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesi tidak sah: ' + (e.message || 'token ditolak'), kode: 'TOKEN' });
  }
}

// --- Web: minta / putar ulang Kode Pasangan ---
app.post('/api/mt5/kode', batasLaju, butuhLogin, (req, res) => {
  const d = mt5Baca();
  // Kode lama milik uid ini dibuang - memutar kode berarti memutus EA lama.
  Object.keys(d.kode).forEach(k => { if (d.kode[k].uid === req.uid) delete d.kode[k]; });
  const kode = buatKodePasangan();
  d.kode[kode] = { uid: req.uid, dibuat: Date.now(), login: null };
  mt5Tulis(d);
  res.json({ ok: true, kode });
});

// --- Web: status sambungan + data MT5 terakhir ---
app.get('/api/mt5/status', batasLaju, butuhLogin, (req, res) => {
  const d = mt5Baca();
  const kode = Object.keys(d.kode).find(k => d.kode[k].uid === req.uid) || null;
  const isi = d.data[req.uid] || null;
  res.json({
    ok: true,
    kode,
    terhubung: !!(isi && (Date.now() - isi.diterima) < 5 * 60 * 1000),
    data: isi
  });
});

// --- Web: putuskan sambungan ---
app.post('/api/mt5/putus', batasLaju, butuhLogin, (req, res) => {
  const d = mt5Baca();
  Object.keys(d.kode).forEach(k => { if (d.kode[k].uid === req.uid) delete d.kode[k]; });
  delete d.data[req.uid];
  mt5Tulis(d);
  res.json({ ok: true });
});

// --- EA: kirim laporan ---
// Batas 512 KB: 15 posisi + 30 hari riwayat jauh di bawah itu, tapi batasnya
// tetap dipasang supaya satu terminal yang salah setel tidak bisa membanjiri
// disk VPS yang cuma 24 GB.
app.post('/api/mt5/lapor', batasLaju, express.json({ limit: '512kb' }), (req, res) => {
  const b = req.body || {};
  const kode = String(b.kode || '').trim().toUpperCase();
  if (!/^JTM5-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kode)) {
    return res.status(400).json({ error: 'Kode Pasangan tidak valid' });
  }
  const d = mt5Baca();
  const rec = d.kode[kode];
  if (!rec) return res.status(403).json({ error: 'Kode Pasangan tidak dikenal atau sudah diputar ulang' });

  const login = String(b.akun && b.akun.login || '');
  if (!login) return res.status(400).json({ error: 'nomor akun wajib ada' });
  // Kunci ke akun pertama yang memakai kode ini.
  if (rec.login && rec.login !== login) {
    return res.status(409).json({ error: 'Kode ini sudah terpakai untuk akun MT5 lain. Buat kode baru di halaman web.' });
  }
  if (!rec.login) { rec.login = login; d.kode[kode] = rec; }

  /* Riwayat DIGABUNG per tiket, bukan ditimpa.

     Laporan EA itu potret jendela waktu, dan jendela itu bisa bergeser maju
     (pengguna mengubah tanggal mulai, atau memakai jendela HariRiwayat).
     Kalau tiap laporan menimpa isi lama, trade yang keluar dari jendela ikut
     lenyap dari catatan - jurnal jadi "berkurang sendiri" tanpa sebab yang
     terlihat. Dengan penggabungan, jendela boleh bergeser sesuka hati:
     yang sudah pernah masuk tetap tersimpan.

     Nomor tiket deal di MT5 unik dan tidak pernah dipakai ulang, jadi aman
     dipakai sebagai kunci. Laporan terbaru menang kalau tiketnya sama. */
  const lama = d.data[rec.uid] || {};
  const peta = new Map();
  (Array.isArray(lama.riwayat) ? lama.riwayat : []).forEach(x => {
    if (x && x.tiket) peta.set(String(x.tiket), x);
  });
  (Array.isArray(b.riwayat) ? b.riwayat : []).forEach(x => {
    if (x && x.tiket) peta.set(String(x.tiket), x);
  });
  const gabungan = Array.from(peta.values())
    .sort((p, q) => (Number(q.waktuTutup) || 0) - (Number(p.waktuTutup) || 0))
    .slice(0, 3000);   // ~600 KB per pengguna di kasus terburuk; disk VPS 21 GB bebas

  /* Ringkasan harian digabung per KUNCI (tanggal|simbol|arah), dan laporan
     terbaru selalu menang. Ini penting: kelompok hari ini terus BERUBAH
     sepanjang hari setiap ada posisi baru tertutup, jadi ia harus diperbarui
     di tempat - bukan ditambahkan sebagai baris baru. */
  const petaRingkas = new Map();
  (Array.isArray(lama.ringkas) ? lama.ringkas : []).forEach(x => {
    if (x && x.kunci) petaRingkas.set(String(x.kunci), x);
  });
  (Array.isArray(b.ringkas) ? b.ringkas : []).forEach(x => {
    if (x && x.kunci) petaRingkas.set(String(x.kunci), x);
  });
  const ringkasGabungan = Array.from(petaRingkas.values())
    .sort((p, q) => String(q.tanggal || '').localeCompare(String(p.tanggal || '')))
    .slice(0, 800);

  d.data[rec.uid] = {
    diterima: Date.now(),
    ringkas: ringkasGabungan,
    akun: b.akun || {},
    // Posisi TERBUKA justru harus ditimpa: yang sudah tertutup wajib hilang
    // dari daftar, kalau digabung ia akan menempel selamanya.
    posisi: Array.isArray(b.posisi) ? b.posisi.slice(0, 200) : [],
    riwayat: gabungan,
    riwayatDari: Number(b.riwayatDari) || (lama.riwayatDari || 0),
    versiEa: String(b.versiEa || '')
  };
  mt5Tulis(d);
  res.json({ ok: true, uid: rec.uid.slice(0, 6) + '…' });
});

/* ══════════════════════════════════════════════════════════════════════════
   EA v2 (TRADE-FI): ANTREAN PERINTAH & DATA CHART MT5
   ══════════════════════════════════════════════════════════════════════════
   Perintah dibuat pengguna dari WEB (dijaga ID token), diambil EA lewat
   Kode Pasangan, dan hasil eksekusinya dilaporkan balik. Format balasan
   untuk EA text/plain baris-per-perintah `id|aksi|simbol|arah|lot|sl|tp|tiket`
   — MQL5 tidak punya parser JSON, dan menyuruhnya menebak JSON adalah
   sumber bug yang tidak perlu.

   Perintah yang berumur > 5 menit KEDALUWARSA tanpa dieksekusi: perintah
   trading yang tertunda lama bukan lagi keinginan pembuatnya — pasar sudah
   pindah. Lebih baik gagal terbuka daripada terisi di harga yang tidak
   pernah disetujui siapa pun.
   ══════════════════════════════════════════════════════════════════════════ */
const MT5_KLINES_FILE = path.join(__dirname, 'mt5-klines.json');
/* Tick terakhir per simbol — DI MEMORI saja. Satu tulisan disk per detik
   demi angka yang basi dalam sedetik adalah cara mengaus-auskan disk VPS;
   restart pm2 kehilangan ticknya dan itu bukan kehilangan apa-apa. */
const MT5_TICK = {};
const DUR_TF = { '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000 };
function mt5KlinesBaca() {
  try { return JSON.parse(fs.readFileSync(MT5_KLINES_FILE, 'utf8')); } catch (e) { return {}; }
}
function mt5KlinesTulis(d) { fs.writeFileSync(MT5_KLINES_FILE, JSON.stringify(d)); }

function uidDariKode(kodeMentah) {
  const kode = String(kodeMentah || '').trim().toUpperCase();
  if (!/^JTM5-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kode)) return null;
  const d = mt5Baca();
  const rec = d.kode[kode];
  return rec ? { uid: rec.uid, d } : null;
}

// --- Web: antre perintah trading ---
app.post('/api/mt5/perintah/kirim', batasLaju, butuhLogin, (req, res) => {
  const b = req.body || {};
  const aksi = String(b.aksi || '').toUpperCase();
  if (['BUKA', 'UBAH', 'TUTUP'].indexOf(aksi) < 0) return res.status(400).json({ error: 'aksi harus BUKA/UBAH/TUTUP' });
  const simbol = String(b.simbol || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const arah = String(b.arah || '').toUpperCase();
  const lot = Number(b.lot) || 0;
  const sl = Number(b.sl) || 0;
  const tp = Number(b.tp) || 0;
  const tiket = String(b.tiket || '').replace(/[^0-9]/g, '');
  if (aksi === 'BUKA') {
    if (!simbol) return res.status(400).json({ error: 'simbol wajib' });
    if (arah !== 'BUY' && arah !== 'SELL') return res.status(400).json({ error: 'arah harus BUY/SELL' });
    // Pagar lot keras di SERVER, bukan cuma di EA: salah ketik 10 jadi 100
    // harus mati di sini, sebelum menyentuh akun siapa pun.
    if (!(lot > 0) || lot > 10) return res.status(400).json({ error: 'lot harus 0–10' });
  }
  if ((aksi === 'UBAH' || aksi === 'TUTUP') && !tiket) return res.status(400).json({ error: 'tiket wajib' });
  const d = mt5Baca();
  if (!d.perintah) d.perintah = {};
  const antre = d.perintah[req.uid] || [];
  const id = 'c' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
  antre.push({ id, aksi, simbol, arah, lot, sl, tp, tiket, status: 'antre', dibuat: Date.now(), pesan: '' });
  d.perintah[req.uid] = antre.slice(-50);
  mt5Tulis(d);
  res.json({ ok: true, id });
});

// --- Web: pantau nasib perintah ---
app.get('/api/mt5/perintah/status', batasLaju, butuhLogin, (req, res) => {
  const d = mt5Baca();
  res.json({ ok: true, perintah: ((d.perintah && d.perintah[req.uid]) || []).slice(-20) });
});

// --- EA: ambil perintah antre (sekali ambil, langsung ditandai) ---
app.get('/api/mt5/perintah', batasLaju, (req, res) => {
  const r = uidDariKode(req.query.kode);
  if (!r) return res.status(403).type('text/plain').send('');
  const d = r.d;
  const antre = (d.perintah && d.perintah[r.uid]) || [];
  const kini = Date.now();
  const baris = [];
  let ubah = false;
  for (const q of antre) {
    if (q.status !== 'antre') continue;
    if (kini - q.dibuat > 5 * 60 * 1000) { q.status = 'kedaluwarsa'; ubah = true; continue; }
    q.status = 'terkirim'; q.diambil = kini; ubah = true;
    baris.push([q.id, q.aksi, q.simbol, q.arah, q.lot, q.sl, q.tp, q.tiket].join('|'));
  }
  if (ubah) mt5Tulis(d);
  res.type('text/plain').send(baris.join('\n'));
});

// --- EA: lapor hasil eksekusi ---
app.post('/api/mt5/perintah/hasil', batasLaju, (req, res) => {
  const b = req.body || {};
  const r = uidDariKode(b.kode);
  if (!r) return res.status(403).json({ error: 'kode tidak dikenal' });
  const d = r.d;
  const antre = (d.perintah && d.perintah[r.uid]) || [];
  const q = antre.find(x => x.id === String(b.id || ''));
  if (q) {
    q.status = b.ok ? 'sukses' : 'gagal';
    q.pesan = String(b.pesan || '').slice(0, 200);
    q.tiketHasil = String(b.tiket || '');
    q.selesai = Date.now();
    mt5Tulis(d);
  }
  res.json({ ok: true });
});

// --- EA: kirim OHLC chart MT5 (label web: sumber "Trade-Fi") ---
app.post('/api/mt5/klines', batasLaju, express.json({ limit: '1mb' }), (req, res) => {
  const b = req.body || {};
  const r = uidDariKode(b.kode);
  if (!r) return res.status(403).json({ error: 'kode tidak dikenal' });
  const simbol = String(b.simbol || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const tf = String(b.tf || '');
  if (!simbol || ['5m', '15m', '1h', '4h', '1d'].indexOf(tf) < 0) {
    return res.status(400).json({ error: 'simbol/tf tidak sah' });
  }
  const data = (Array.isArray(b.data) ? b.data : [])
    .filter(x => Array.isArray(x) && x.length >= 5 && x.every(v => isFinite(Number(v))))
    .slice(-600);
  if (!data.length) return res.status(400).json({ error: 'data kosong' });
  const k = mt5KlinesBaca();
  if (!k[simbol]) k[simbol] = {};
  k[simbol][tf] = { diperbarui: Date.now(), data };
  /* Spec simbol (nilai dolar per lot per 1.0 harga) menumpang kiriman
     klines — EA yang tahu tick value broker & mata uang akunnya, bukan
     web. Dipakai web menghitung dolar SL/TP tiket MT5. */
  const nilaiLot = Number(b.nilaiLot);
  if (isFinite(nilaiLot) && nilaiLot > 0) k[simbol].spec = { nilaiLot, diperbarui: Date.now() };
  mt5KlinesTulis(k);
  res.json({ ok: true, n: data.length });
});

// --- EA: tick per detik — bikin harga web menempel harga MT5 ---
app.post('/api/mt5/tick', batasLaju, (req, res) => {
  const b = req.body || {};
  const r = uidDariKode(b.kode);
  if (!r) return res.status(403).json({ error: 'kode tidak dikenal' });
  const simbol = String(b.simbol || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const bid = Number(b.bid);
  if (!simbol || !isFinite(bid) || bid <= 0) return res.status(400).json({ error: 'tick tidak sah' });
  /* Ask menyusul di EA v2.02 — v2.01 tidak mengirimnya, jadi 0 berarti
     "belum ada", bukan "spread nol". Web menyembunyikan garis Ask-nya. */
  const ask = Number(b.ask);
  /* tb = jam BROKER dalam ms (EA v2.03) — timeline yang sama dengan
     stempel waktu bar OHLC dari CopyRates. `waktu` (jam server sendiri)
     tetap dipakai untuk uji kesegaran; tb untuk uji BATAS LILIN. Dua jam
     itu selisih 2-3 jam (broker EET), dan mencampurnya adalah sumber bug
     lilin meregang-lalu-melompat di chart web. */
  const tb = Number(b.t) * 1000;
  MT5_TICK[simbol] = {
    bid, ask: isFinite(ask) && ask > 0 ? ask : 0,
    waktu: Date.now(), tb: isFinite(tb) && tb > 0 ? tb : 0,
  };
  res.json({ ok: true });
});

// --- Web: daftar simbol MT5 + tick terakhirnya — pilihan chart & watchlist ---
app.get('/api/mt5/simbol', batasLaju, (req, res) => {
  res.json({ ok: true, simbol: Object.keys(mt5KlinesBaca()), harga: MT5_TICK });
});

/* ══════════════════════════════════════════════════════════════════════════
   SINYAL PANTAUAN — hasil kurasi agen Pemburu Sinyal
   ══════════════════════════════════════════════════════════════════════════
   Sinyal yang lolos disiplin agen (pair, arah, entry, SL, TP LENGKAP —
   tanpa SL ditolak) disimpan di sinyal.json dan disajikan publik di sini.
   Penulisan lewat SSH oleh agen; endpoint tulis via web menyusul bersama
   panel kurasinya. */
const SINYAL_FILE = path.join(__dirname, 'sinyal.json');
app.get('/api/sinyal', batasLaju, (req, res) => {
  try {
    const d = JSON.parse(fs.readFileSync(SINYAL_FILE, 'utf8'));
    /* `diperiksa` = kapan agen TERAKHIR MEMERIKSA ruangnya, bukan kapan
       sinyal terakhir masuk. Dua hal yang berbeda, dan situs perlu yang
       pertama: "belum ada sinyal baru" hanya menenangkan kalau orang tahu
       agennya memang baru saja melihat. Diambil dari waktu ubah kabar
       terakhir kalau ada; kalau belum pernah, dari berkas sinyalnya. */
    let diperiksa = 0;
    try { diperiksa = fs.statSync(KABAR_FILE).mtimeMs; } catch (e) {}
    if (!diperiksa) { try { diperiksa = fs.statSync(SINYAL_FILE).mtimeMs; } catch (e) {} }
    res.json({
      ok: true,
      sinyal: Array.isArray(d.sinyal) ? d.sinyal : [],
      diperiksa: Math.round(diperiksa) || 0,
    });
  } catch (e) {
    res.json({ ok: true, sinyal: [], diperiksa: 0 });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   KABAR AGEN — isi lonceng notifikasi di situs
   ══════════════════════════════════════════════════════════════════════════
   Agen Pemburu Sinyal memantau ruang sinyal komunitas. Setiap kali ada
   POSTINGAN BARU di sana ia menaruh satu kabar di sini, dan lonceng di
   pojok kanan atas situs menghitungnya sebagai notifikasi belum dibaca.

   Kenapa kabar terpisah dari /api/sinyal: tidak semua postingan lolos jadi
   sinyal. Postingan tanpa SL ditolak dari panel sinyal — tapi orangnya
   tetap berhak tahu bahwa analis di ruang itu baru saja bicara. Yang satu
   daftar level siap pakai, yang satu pemberitahuan bahwa ada yang baru.

   Menulis butuh APP_TOKEN (requireToken). Membaca terbuka: notifikasi ini
   memang untuk semua pengunjung situs, dan isinya bukan rahasia. */
const KABAR_FILE = path.join(__dirname, 'kabar.json');
function kabarBaca() {
  try {
    const d = JSON.parse(fs.readFileSync(KABAR_FILE, 'utf8'));
    return Array.isArray(d.kabar) ? d.kabar : [];
  } catch (e) { return []; }
}

app.get('/api/kabar', batasLaju, (req, res) => {
  res.json({ ok: true, kabar: kabarBaca() });
});

app.post('/api/kabar', batasLaju, requireToken, (req, res) => {
  const b = req.body || {};
  const judul = String(b.judul || '').slice(0, 200).trim();
  if (!judul) return res.status(400).json({ error: 'judul wajib diisi' });

  const kabar = kabarBaca();
  /* id yang SAMA menimpa, tidak menumpuk: agen yang memeriksa ruang tiap
     setengah jam akan melihat postingan yang sama berkali-kali, dan lonceng
     yang berbunyi ulang untuk kabar yang sudah dibaca adalah cara tercepat
     membuat orang mematikan notifikasinya. */
  const id = String(b.id || 'k' + Date.now().toString(36)).slice(0, 80).replace(/[^\w.:-]/g, '');
  const baris = {
    id,
    judul,
    detail: String(b.detail || '').slice(0, 500),
    sumber: String(b.sumber || '').slice(0, 120),
    /* 'sinyal' = postingan yang lolos jadi level siap pakai (ada di panel
       Sinyal Pantauan); 'pantau' = ada postingan baru, tapi belum/tidak
       jadi sinyal. Situs memakai ini untuk warna lencananya. */
    jenis: b.jenis === 'sinyal' ? 'sinyal' : 'pantau',
    pair: String(b.pair || '').slice(0, 20).toUpperCase(),
    tautan: String(b.tautan || '').slice(0, 300),
    waktu: Number(b.waktu) > 0 ? Number(b.waktu) : Date.now(),
  };
  const sisa = kabar.filter(x => x.id !== id);
  sisa.unshift(baris);
  /* 50 kabar terakhir: lonceng bukan arsip, dan berkasnya harus tetap
     bisa dibaca sekali tulis tanpa mikir. */
  fs.writeFileSync(KABAR_FILE, JSON.stringify({ kabar: sisa.slice(0, 50) }, null, 2));
  res.json({ ok: true, id, total: Math.min(sisa.length, 50) });
});

/* ══════════════════════════════════════════════════════════════════════════
   CACHE DOKUMEN PUBLIK FIRESTORE
   ══════════════════════════════════════════════════════════════════════════
   Kuota baca Firestore PERNAH HABIS (429) dan halaman depan tampil kosong —
   setiap pengunjung membaca Firestore langsung, dan kuotanya milik bersama.
   Sekarang pengunjung membaca VPS: satu penyegaran per menit menggantikan
   satu baca per pengunjung, dan salinan TERAKHIR YANG BAIK tetap disajikan
   saat kuota di hulu sedang habis. Halaman depan tidak boleh kosong hanya
   karena Google sedang menghitung ulang jatah kita.
   ══════════════════════════════════════════════════════════════════════════ */
/* Cache-nya DI DISK, bukan cuma memori: restart pm2 tidak boleh membuat
   halaman depan kosong lagi, dan snapshot terakhir yang baik lebih berharga
   daripada kesegaran — angka pameran berubah paling cepat harian. */
const PUBLIK_FILE = path.join(__dirname, 'publik-cache.json');
let PUBLIK_CACHE = {};
try { PUBLIK_CACHE = JSON.parse(fs.readFileSync(PUBLIK_FILE, 'utf8')); } catch (e) { PUBLIK_CACHE = {}; }
function publikSimpan() {
  try { fs.writeFileSync(PUBLIK_FILE, JSON.stringify(PUBLIK_CACHE)); } catch (e) { /* disk penuh — memori tetap jalan */ }
}
const PUBLIK_BOLEH = ['ringkasanAkun', 'posisiTerbuka', 'jurnalShowcase'];

async function publikSegarkan(dok) {
  const r = await axios.get(
    'https://firestore.googleapis.com/v1/projects/jadi-trader-tools/databases/(default)/documents/public/' + dok,
    { timeout: 10000 });
  PUBLIK_CACHE[dok] = { waktu: Date.now(), isi: r.data };
  publikSimpan();
  return r.data;
}

/* Menghangat SENDIRI tiap 5 menit: saat kuota Firestore pulih dari 429,
   cache terisi tanpa menunggu pengunjung pertama — dan sejak saat itu
   halaman depan tidak pernah lagi bergantung pada nasib kuota. */
setInterval(() => {
  PUBLIK_BOLEH.forEach(dok => { publikSegarkan(dok).catch(() => { /* kuota masih habis */ }); });
}, 5 * 60 * 1000);
app.get('/api/publik/:dok', batasLaju, async (req, res) => {
  const dok = String(req.params.dok || '').replace(/[^A-Za-z0-9]/g, '');
  if (PUBLIK_BOLEH.indexOf(dok) < 0) return res.status(404).json({ error: 'dokumen tidak dikenal' });
  const c = PUBLIK_CACHE[dok];
  if (c && Date.now() - c.waktu < 60000) return res.json(c.isi);
  try {
    res.json(await publikSegarkan(dok));
  } catch (e) {
    if (c) return res.json(c.isi);   // hulu 429 → salinan terakhir yang baik
    const status = (e.response && e.response.status) || 502;
    res.status(status).json({ error: 'Firestore menjawab ' + status });
  }
});

// --- Web: baca OHLC MT5 — bentuk balasannya SAMA dengan /api/klines ---
app.get('/api/mt5/klines', batasLaju, (req, res) => {
  const simbol = String(req.query.symbol || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const tf = String(req.query.interval || '');
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 500));
  const k = mt5KlinesBaca();
  const isi = k[simbol] && k[simbol][tf];
  if (!isi) return res.json({ ok: true, sumber: 'mt5', diperbarui: 0, data: [] });
  let rows = isi.data.slice(-limit);
  /* Lilin terakhir DIHIDUPKAN dengan tick: kiriman penuh datang tiap ±5
     menit, tapi tick datang tiap detik. Tanpa tambalan ini harga web
     tertinggal beberapa menit dari MT5 — dan chart live yang telat lima
     menit terasa mati. Tick yang jatuh SETELAH lilin terakhir berakhir
     membuka lilin sintetis baru, jadi grafiknya terus berdetak di antara
     dua kiriman penuh. */
  const tick = MT5_TICK[simbol];
  const dur = DUR_TF[tf] || 0;
  if (tick && dur && rows.length && (Date.now() - tick.waktu) < 30000) {
    const akhir = rows[rows.length - 1].map(Number);
    /* Batas lilin diuji dengan JAM BROKER (tb, EA v2.03) karena stempel
       bar juga jam broker. Memakai jam server sendiri di sini (tick lama
       tanpa tb) membuat tick tak pernah dianggap melewati batas — lilin
       terakhir terus diregangkan memakan bar berikutnya, lalu melompat
       terkoreksi saat kiriman OHLC penuh tiba. */
    const tTick = tick.tb || tick.waktu;
    if (tTick >= akhir[0] + dur) {
      const buka = akhir[0] + Math.floor((tTick - akhir[0]) / dur) * dur;
      rows = rows.concat([[buka, tick.bid, tick.bid, tick.bid, tick.bid]]);
    } else {
      akhir[4] = tick.bid;
      if (tick.bid > akhir[2]) akhir[2] = tick.bid;
      if (tick.bid < akhir[3]) akhir[3] = tick.bid;
      rows = rows.slice(0, -1).concat([akhir]);
    }
  }
  res.json({
    ok: true, sumber: 'mt5', diperbarui: isi.diperbarui,
    spec: k[simbol].spec || null,
    /* Tick bid/ask ikut dipulangkan: web sudah memanggil rute ini tiap
       beberapa detik untuk lilinnya — harga ask menumpang gratis di sini
       daripada membuka satu jalur polling baru. */
    tick: MT5_TICK[simbol] || null,
    data: rows,
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   LAPORAN, TRAFIK, PENJUALAN  —  bahan halaman Pemilik
   ══════════════════════════════════════════════════════════════════════════
   Disimpan sebagai berkas JSON di samping lisensi.json & mt5.json. Bukan
   database sungguhan, dan itu memang cukup: volumenya kecil (laporan dan
   kunjungan, bukan tick pasar), VPS-nya 1 core / 961 MB, dan menambah Postgres
   di sana justru memakan RAM yang tidak ada.

   Yang perlu dijaga: berkasnya ditulis ulang utuh tiap kali, jadi tiap daftar
   DIBATASI. Tanpa batas, berkas terus tumbuh sampai satu penulisan memakan
   detik dan disk 24 GB jadi taruhannya.
   ══════════════════════════════════════════════════════════════════════════ */
const LAPOR_FILE = path.join(__dirname, 'laporan.json');

function laporBaca() {
  try { return JSON.parse(fs.readFileSync(LAPOR_FILE, 'utf8')); }
  catch (e) { return { laporan: [], kunjungan: {}, penjualan: [] }; }
}
function laporTulis(d) { fs.writeFileSync(LAPOR_FILE, JSON.stringify(d, null, 2)); }

const JENIS_LAPOR = new Set(['bug', 'saran', 'error']);
const BATAS_LAPORAN = 1000;
const BATAS_PENJUALAN = 2000;

// --- Kirim laporan (bug / saran dari pengguna, atau error otomatis) ---------
// Login TIDAK diwajibkan: error justru sering terjadi tepat saat sesi bermasalah,
// dan laporan yang hilang karena syarat login adalah laporan yang paling
// dibutuhkan. Kalau token ada, uid & email ikut dicatat.
app.post('/api/lapor', batasLaju, async (req, res) => {
  const b = req.body || {};
  const jenis = String(b.jenis || 'bug').toLowerCase();
  if (!JENIS_LAPOR.has(jenis)) return res.status(400).json({ error: 'jenis tidak dikenal' });
  const pesan = String(b.pesan || '').trim().slice(0, 4000);
  if (!pesan) return res.status(400).json({ error: 'pesan kosong' });

  let uid = '', email = '';
  const h = String(req.headers.authorization || '');
  if (h.startsWith('Bearer ')) {
    try { const v = await verifikasiIdToken(h.slice(7)); uid = v.uid; email = v.email || ''; } catch (e) {}
  }

  const d = laporBaca();
  d.laporan.unshift({
    id: 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    jenis, pesan,
    halaman: String(b.halaman || '').slice(0, 200),
    versi: String(b.versi || '').slice(0, 40),
    agen: String(req.headers['user-agent'] || '').slice(0, 200),
    uid, email,
    status: 'baru',
    waktu: Date.now()
  });
  if (d.laporan.length > BATAS_LAPORAN) d.laporan.length = BATAS_LAPORAN;
  laporTulis(d);
  res.json({ ok: true });
});

// --- Pemilik: daftar & ubah status laporan ---------------------------------
app.get('/api/lapor/daftar', batasLaju, requireToken, (req, res) => {
  const d = laporBaca();
  const jenis = String(req.query.jenis || '');
  const hasil = jenis ? d.laporan.filter(x => x.jenis === jenis) : d.laporan;
  res.json({ ok: true, laporan: hasil.slice(0, 300), total: d.laporan.length });
});

app.post('/api/lapor/status', batasLaju, requireToken, (req, res) => {
  const id = String((req.body && req.body.id) || '');
  const status = String((req.body && req.body.status) || 'selesai');
  const d = laporBaca();
  const l = d.laporan.find(x => x.id === id);
  if (!l) return res.status(404).json({ error: 'laporan tidak ada' });
  l.status = status;
  laporTulis(d);
  res.json({ ok: true });
});

/* --- Trafik ---------------------------------------------------------------
   Dihitung per HARI per halaman, bukan disimpan per kunjungan. Menyimpan tiap
   kunjungan berarti berkasnya tumbuh tanpa batas untuk pertanyaan yang tidak
   pernah ditanyakan ("kunjungan nomor 4.212 jam berapa?"). Yang dipakai cuma
   jumlahnya, jadi yang disimpan cuma jumlahnya.

   "unik" dihitung dari sidik kasar (IP + user-agent) yang di-hash - tidak ada
   IP mentah yang tersimpan. */
app.post('/api/kunjungan', batasLaju, (req, res) => {
  const b = req.body || {};
  const halaman = String(b.halaman || 'lain').slice(0, 60).replace(/[^a-zA-Z0-9._-]/g, '');
  const hari = new Date().toISOString().slice(0, 10);
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const sidik = crypto.createHash('sha256')
    .update(ip + '|' + (req.headers['user-agent'] || '') + '|' + hari)
    .digest('hex').slice(0, 16);

  const d = laporBaca();
  d.kunjungan[hari] = d.kunjungan[hari] || { total: 0, halaman: {}, sidik: [] };
  const k = d.kunjungan[hari];
  k.total++;
  k.halaman[halaman] = (k.halaman[halaman] || 0) + 1;
  if (k.sidik.indexOf(sidik) < 0) { k.sidik.push(sidik); if (k.sidik.length > 5000) k.sidik.shift(); }

  // Simpan 90 hari terakhir saja.
  const hariUrut = Object.keys(d.kunjungan).sort();
  while (hariUrut.length > 90) delete d.kunjungan[hariUrut.shift()];

  laporTulis(d);
  res.json({ ok: true });
});

app.get('/api/kunjungan/ringkas', batasLaju, requireToken, (req, res) => {
  const d = laporBaca();
  const keluar = Object.keys(d.kunjungan).sort().map(h => ({
    hari: h,
    total: d.kunjungan[h].total,
    unik: (d.kunjungan[h].sidik || []).length,
    halaman: d.kunjungan[h].halaman
  }));
  res.json({ ok: true, harian: keluar });
});

// --- Penjualan (dicatat manual - Lynk tidak mengirim webhook ke sini) -------
app.post('/api/penjualan', batasLaju, requireToken, (req, res) => {
  const b = req.body || {};
  const nilai = parseFloat(b.nilai);
  if (!isFinite(nilai)) return res.status(400).json({ error: 'nilai tidak sah' });
  const d = laporBaca();
  d.penjualan.unshift({
    id: 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    produk: String(b.produk || '').slice(0, 80),
    pembeli: String(b.pembeli || '').slice(0, 120),
    nilai,
    catatan: String(b.catatan || '').slice(0, 200),
    waktu: Number(b.waktu) || Date.now()
  });
  if (d.penjualan.length > BATAS_PENJUALAN) d.penjualan.length = BATAS_PENJUALAN;
  laporTulis(d);
  res.json({ ok: true });
});

app.get('/api/penjualan/daftar', batasLaju, requireToken, (req, res) => {
  res.json({ ok: true, penjualan: laporBaca().penjualan.slice(0, 500) });
});

app.post('/api/penjualan/hapus', batasLaju, requireToken, (req, res) => {
  const id = String((req.body && req.body.id) || '');
  const d = laporBaca();
  const n = d.penjualan.length;
  d.penjualan = d.penjualan.filter(x => x.id !== id);
  laporTulis(d);
  res.json({ ok: true, dihapus: n - d.penjualan.length });
});

/* --- Daftar klien ---------------------------------------------------------
   Aturan Firestore SENGAJA melarang siapa pun membaca dokumen orang lain, dan
   itu termasuk melarang pemilik me-list seluruh koleksi. Bagus untuk privasi,
   tapi berarti daftar klien tidak bisa diambil dari sana.

   Jadi dicatat di sini: email diambil dari ID TOKEN yang sudah diverifikasi,
   bukan dari kiriman klien - klien tidak bisa mendaftarkan email orang lain. */
app.post('/api/klien/hadir', batasLaju, butuhLogin, async (req, res) => {
  const h = String(req.headers.authorization || '');
  let email = '';
  try { const v = await verifikasiIdToken(h.slice(7)); email = v.email || ''; } catch (e) {}

  const d = laporBaca();
  d.klien = d.klien || {};
  const k = d.klien[req.uid] || { pertama: Date.now(), kunjungan: 0 };
  k.email = email || k.email || '';
  k.nama = String((req.body && req.body.nama) || k.nama || '').slice(0, 80);
  k.terakhir = Date.now();
  k.kunjungan = (k.kunjungan || 0) + 1;
  d.klien[req.uid] = k;
  laporTulis(d);
  res.json({ ok: true });
});

app.get('/api/klien/daftar', batasLaju, requireToken, (req, res) => {
  const d = laporBaca();
  const klien = Object.keys(d.klien || {}).map(uid => Object.assign({ uid }, d.klien[uid]))
    .sort((a, b) => (b.terakhir || 0) - (a.terakhir || 0));
  res.json({ ok: true, klien, total: klien.length });
});

// --- Status VPS ------------------------------------------------------------
app.get('/api/status-vps', batasLaju, requireToken, (req, res) => {
  const os = require('os');
  const bebas = os.freemem(), total = os.totalmem();
  res.json({
    ok: true,
    waktuHidupDetik: Math.round(process.uptime()),
    waktuHidupMesinDetik: Math.round(os.uptime()),
    ramTotalMb: Math.round(total / 1048576),
    ramBebasMb: Math.round(bebas / 1048576),
    ramProsesMb: Math.round(process.memoryUsage().rss / 1048576),
    beban: os.loadavg().map(x => Math.round(x * 100) / 100),
    cpu: os.cpus().length,
    node: process.version,
    baseUrl: BASE_URL,
    gerbangLangganan: GERBANG_LANGGANAN,
    disk: bacaDisk(),
    permintaan: {
      sejak: hitungan.sejak,
      total: hitungan.total,
      // rata-rata per menit dari 5 menit PENUH terakhir (menit berjalan
      // belum selesai, memasukkannya membuat angkanya selalu tampak turun)
      perMenit: (() => {
        const m = hitungan.perMenit.slice(0, -1).slice(-5);
        return m.length ? Math.round(m.reduce((s, x) => s + x.n, 0) / m.length) : 0;
      })(),
      tolakanAuth: hitungan.tolakanAuth,
      kena429: hitungan.kena429,
      galat5xx: hitungan.galat5xx,
    },
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// COPY TRADING — analisa berbayar antar pengguna
// ═══════════════════════════════════════════════════════════════════════════
// Disimpan sebagai berkas JSON seperti lisensi & produk — bukan Firestore,
// karena backend ini tidak memegang kredensial admin Firestore, dan pola
// berkas+token sudah terbukti di rute lisensi. Pembayaran v1 manual: pembeli
// transfer -> kirim bukti -> ANALISNYA menyetujui -> isi terbuka. Gerbang
// pembayaran otomatis menyusul lewat halaman Billing.
const ANALISA_FILE = path.join(__dirname, 'analisa.json');
function analisaBaca() {
  try { return JSON.parse(fs.readFileSync(ANALISA_FILE, 'utf8')); }
  catch (e) { return { daftar: [] }; }
}
function analisaTulis(d) { fs.writeFileSync(ANALISA_FILE, JSON.stringify(d, null, 2)); }

// Daftar publik: TANPA isi terkunci, TANPA daftar pembeli/permintaan.
app.get('/api/analisa', batasLaju, (req, res) => {
  const d = analisaBaca();
  res.json({ daftar: d.daftar.map(a => ({
    id: a.id, uid: a.uid, nama: a.nama, judul: a.judul, pasangan: a.pasangan,
    arah: a.arah, harga: a.harga, ringkas: a.ringkas, dibuat: a.dibuat,
    snapshot: a.snapshot || null, jumlahPembeli: (a.pembeli || []).length,
  })) });
});

app.post('/api/analisa', batasLaju, butuhLogin, (req, res) => {
  const { judul, pasangan, arah, harga, ringkas, isi, snapshot, nama } = req.body || {};
  if (!judul || !pasangan || !isi || !isi.entry) {
    return res.status(400).json({ error: 'judul, pasangan, dan isi (entry/sl/tp/alasan) wajib diisi' });
  }
  const d = analisaBaca();
  if (d.daftar.filter(a => a.uid === req.uid).length >= 20) {
    return res.status(400).json({ error: 'Maksimal 20 analisa per akun. Hapus yang lama dulu.' });
  }
  const id = 'an' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  d.daftar.unshift({
    id, uid: req.uid, nama: String(nama || 'Analis').slice(0, 40),
    judul: String(judul).slice(0, 80), pasangan: String(pasangan).slice(0, 20).toUpperCase(),
    arah: arah === 'SELL' ? 'SELL' : 'BUY',
    harga: Math.max(0, Number(harga) || 0),
    ringkas: String(ringkas || '').slice(0, 280),
    isi: {
      entry: Number(isi.entry) || 0, sl: Number(isi.sl) || 0, tp: Number(isi.tp) || 0,
      alasan: String(isi.alasan || '').slice(0, 2000),
    },
    snapshot: snapshot && typeof snapshot === 'object' ? {
      saldo: Number(snapshot.saldo) || 0, winrate: Number(snapshot.winrate) || 0,
      pf: Number(snapshot.pf) || 0, jumlah: Number(snapshot.jumlah) || 0,
      kurva: Array.isArray(snapshot.kurva) ? snapshot.kurva.slice(-60).map(Number) : [],
    } : null,
    dibuat: Date.now(), pembeli: [], permintaan: [],
  });
  analisaTulis(d);
  res.json({ ok: true, id });
});

app.delete('/api/analisa', batasLaju, butuhLogin, (req, res) => {
  const d = analisaBaca();
  const a = d.daftar.find(x => x.id === String(req.query.id || ''));
  if (!a) return res.status(404).json({ error: 'Analisa tidak ditemukan' });
  if (a.uid !== req.uid) return res.status(403).json({ error: 'Bukan analisamu' });
  d.daftar = d.daftar.filter(x => x.id !== a.id);
  analisaTulis(d);
  res.json({ ok: true });
});

// Isi terkunci: penulis, gratis, atau pembeli yang sudah disetujui.
app.get('/api/analisa/isi', batasLaju, butuhLogin, (req, res) => {
  const d = analisaBaca();
  const a = d.daftar.find(x => x.id === String(req.query.id || ''));
  if (!a) return res.status(404).json({ error: 'Analisa tidak ditemukan' });
  const boleh = a.uid === req.uid || a.harga === 0 || (a.pembeli || []).includes(req.uid);
  if (!boleh) return res.status(403).json({ error: 'Terkunci - kirim permintaan akses dulu', kode: 'KUNCI' });
  res.json({ ok: true, isi: a.isi });
});

app.post('/api/analisa/minta', batasLaju, butuhLogin, (req, res) => {
  const { id, bukti, nama } = req.body || {};
  const d = analisaBaca();
  const a = d.daftar.find(x => x.id === String(id || ''));
  if (!a) return res.status(404).json({ error: 'Analisa tidak ditemukan' });
  if (a.uid === req.uid) return res.status(400).json({ error: 'Ini analisamu sendiri' });
  if ((a.pembeli || []).includes(req.uid)) return res.json({ ok: true, status: 'sudah' });
  a.permintaan = a.permintaan || [];
  const ada = a.permintaan.find(p => p.uid === req.uid && p.status === 'baru');
  if (ada) return res.json({ ok: true, status: 'menunggu' });
  a.permintaan.push({
    uid: req.uid, nama: String(nama || '').slice(0, 40),
    bukti: String(bukti || '').slice(0, 300), waktu: Date.now(), status: 'baru',
  });
  analisaTulis(d);
  res.json({ ok: true, status: 'menunggu' });
});

// Permintaan masuk untuk SEMUA analisaku + status permintaanKU ke analisa lain.
app.get('/api/analisa/saya', batasLaju, butuhLogin, (req, res) => {
  const d = analisaBaca();
  const masuk = [];
  const statusku = {};
  d.daftar.forEach(a => {
    if (a.uid === req.uid) {
      (a.permintaan || []).filter(p => p.status === 'baru')
        .forEach(p => masuk.push({ id: a.id, judul: a.judul, uid: p.uid, nama: p.nama, bukti: p.bukti, waktu: p.waktu }));
    }
    if ((a.pembeli || []).includes(req.uid)) statusku[a.id] = 'pembeli';
    else if ((a.permintaan || []).some(p => p.uid === req.uid && p.status === 'baru')) statusku[a.id] = 'menunggu';
  });
  res.json({ ok: true, masuk, statusku });
});

app.post('/api/analisa/putuskan', batasLaju, butuhLogin, (req, res) => {
  const { id, uid, tindakan } = req.body || {};
  const d = analisaBaca();
  const a = d.daftar.find(x => x.id === String(id || ''));
  if (!a) return res.status(404).json({ error: 'Analisa tidak ditemukan' });
  if (a.uid !== req.uid) return res.status(403).json({ error: 'Hanya penulisnya yang boleh memutuskan' });
  const p = (a.permintaan || []).find(x => x.uid === uid && x.status === 'baru');
  if (!p) return res.status(404).json({ error: 'Permintaan tidak ditemukan' });
  p.status = tindakan === 'setujui' ? 'disetujui' : 'ditolak';
  if (tindakan === 'setujui') {
    a.pembeli = a.pembeli || [];
    if (!a.pembeli.includes(uid)) a.pembeli.push(uid);
  }
  analisaTulis(d);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN DISCORD — OAuth2 -> token kustom Firebase
// ═══════════════════════════════════════════════════════════════════════════
// Butuh tiga hal di .env: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, dan
// FIREBASE_ADMIN_KEY (path berkas kunci akun layanan). Tanpa salah satunya,
// /status menjawab siap:false dan tombolnya tidak muncul di situs — fitur
// yang setengah terpasang tidak boleh tampak seperti fitur yang rusak.
const DISCORD_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_RAHASIA = process.env.DISCORD_CLIENT_SECRET || '';
const ADMIN_KEY_PATH = process.env.FIREBASE_ADMIN_KEY || '';
const DISCORD_REDIRECT = 'https://103-253-145-38.sslip.io/api/auth/discord/callback';
let firebaseAdmin = null;
function ambilAdmin() {
  if (firebaseAdmin) return firebaseAdmin;
  if (!ADMIN_KEY_PATH || !fs.existsSync(ADMIN_KEY_PATH)) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(require(ADMIN_KEY_PATH)) });
    }
    firebaseAdmin = admin;
    return admin;
  } catch (e) { console.error('firebase-admin gagal:', e.message); return null; }
}
const discordState = new Map();

app.get('/api/auth/discord/status', batasLaju, (req, res) => {
  res.json({ siap: !!(DISCORD_ID && DISCORD_RAHASIA && ambilAdmin()) });
});

const BALIK_SAH = [
  'https://103-253-145-38.sslip.io',
  'https://bagusjaya0509-maker.github.io',
  'http://localhost:5190', 'http://localhost:5173',
];

app.get('/api/auth/discord', batasLaju, (req, res) => {
  if (!DISCORD_ID || !DISCORD_RAHASIA) return res.status(501).json({ error: 'Login Discord belum dikonfigurasi (DISCORD_CLIENT_ID/SECRET)' });
  if (!ambilAdmin()) return res.status(501).json({ error: 'Kunci admin Firebase belum terpasang (FIREBASE_ADMIN_KEY)' });
  const balik = String(req.query.balik || '');
  if (!BALIK_SAH.some(b => balik.startsWith(b))) return res.status(400).json({ error: 'Alamat balik tidak dikenal' });
  const state = require('crypto').randomBytes(16).toString('hex');
  discordState.set(state, { balik, waktu: Date.now() });
  for (const pasang of discordState) { if (Date.now() - pasang[1].waktu > 600000) discordState.delete(pasang[0]); }
  const url = 'https://discord.com/oauth2/authorize?client_id=' + DISCORD_ID
    + '&response_type=code&scope=identify%20email'
    + '&redirect_uri=' + encodeURIComponent(DISCORD_REDIRECT)
    + '&state=' + state;
  res.redirect(url);
});

app.get('/api/auth/discord/callback', batasLaju, async (req, res) => {
  const kode = String(req.query.code || '');
  const s = discordState.get(String(req.query.state || ''));
  discordState.delete(String(req.query.state || ''));
  if (!s || !kode) return res.status(400).send('State tidak sah atau kedaluwarsa. Coba login lagi.');
  try {
    const tok = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: DISCORD_ID, client_secret: DISCORD_RAHASIA,
      grant_type: 'authorization_code', code: kode, redirect_uri: DISCORD_REDIRECT,
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 12000 });
    const me = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + tok.data.access_token }, timeout: 12000,
    });
    const admin = ambilAdmin();
    const uid = 'discord:' + me.data.id;
    const kustom = await admin.auth().createCustomToken(uid, {
      discord: true, namaDiscord: me.data.username || '', emailDiscord: me.data.email || '',
    });
    res.redirect(s.balik + '#discord=' + encodeURIComponent(kustom));
  } catch (e) {
    console.error('discord callback:', e.message);
    res.status(500).send('Login Discord gagal: ' + (e.response ? JSON.stringify(e.response.data).slice(0, 120) : e.message));
  }
});

// ── Penangan error terakhir ────────────────────────────────────────────────
// Bawaan Express membalas error sebagai HALAMAN HTML. Untuk pemanggil yang
// mengharapkan JSON, itu muncul sebagai pesan membingungkan
// "Unexpected token '<', \"<!DOCTYPE \"..." yang sama sekali tidak menyebut
// masalah sebenarnya. Di sini semuanya diseragamkan jadi JSON.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const kode = err && (err.status || err.statusCode) || 500;
  let pesan = (err && err.message) || 'Kesalahan server';
  if (err && err.type === 'entity.too.large') {
    pesan = 'Data yang dikirim terlalu besar untuk endpoint ini';
  }
  res.status(kode).json({ error: pesan });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Trading backend (Futures) jalan di port ${PORT} (base: ${BASE_URL})`);
});
