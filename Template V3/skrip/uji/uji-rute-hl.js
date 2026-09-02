/* Uji rute gabungan + pembagi bursa. TIDAK mengirim order yang sah:
   yang dikirim sengaja salah sisi supaya ditolak sebelum berangkat. */
require('dotenv').config({ path: '/root/binance-trading-backend/.env' });
const T = (process.env.APP_TOKEN || '').trim();
const DASAR = 'http://localhost:4000';
const K = { 'X-App-Token': T, 'Content-Type': 'application/json' };

const ambil = async (jalur, badan) => {
  const r = await fetch(DASAR + jalur, badan
    ? { method: 'POST', headers: K, body: JSON.stringify(badan) }
    : { headers: K });
  return { kode: r.status, j: await r.json().catch(() => ({})) };
};

(async () => {
  let lulus = 0, gagal = 0;
  const cek = (nama, syarat, tambahan) => {
    if (syarat) { console.log('  ok     ' + nama); lulus++; }
    else { console.log('  GAGAL  ' + nama + (tambahan ? ' — ' + tambahan : '')); gagal++; }
  };

  console.log('== /api/positions ==');
  const p = await ambil('/api/positions');
  const perP = {};
  (p.j.positions || []).forEach((x) => { perP[x.bursa] = (perP[x.bursa] || 0) + 1; });
  console.log('   kode', p.kode, '| jumlah', (p.j.positions || []).length,
              '| per bursa', JSON.stringify(perP), '| gagalHl:', p.j.gagalHl);
  cek('menjawab 200', p.kode === 200, 'kode ' + p.kode);
  cek('tiap baris punya medan bursa',
      (p.j.positions || []).every((x) => x.bursa === 'binance' || x.bursa === 'hyperliquid'));
  cek('gagalHl null (Hyperliquid terbaca)', p.j.gagalHl === null || p.j.gagalHl === undefined,
      String(p.j.gagalHl));

  console.log('\n== /api/open-orders ==');
  const o = await ambil('/api/open-orders');
  const perO = {};
  (o.j.daftar || []).forEach((x) => { perO[x.bursa] = (perO[x.bursa] || 0) + 1; });
  console.log('   kode', o.kode, '| daftar', (o.j.daftar || []).length,
              '| per bursa', JSON.stringify(perO), '| algoGagal:', o.j.algoGagal,
              '| gagalHl:', o.j.gagalHl);
  cek('menjawab 200', o.kode === 200, 'kode ' + o.kode);
  cek('gagalHl null', o.j.gagalHl === null || o.j.gagalHl === undefined, String(o.j.gagalHl));

  console.log('\n== pembagi bursa: order sengaja SALAH SISI, tidak akan berangkat ==');
  /* CASHCAT tidak ada di Binance Futures -> harus dibagi ke Hyperliquid,
     lalu ditolak oleh pemeriksa sisi milik orderHl. Galat yang membawa
     bursa:'hyperliquid' membuktikan pembagiannya benar tanpa satu pun
     order sungguhan berangkat. */
  const hl = await ambil('/api/trade/futures', {
    symbol: 'CASHCAT', side: 'BUY', quantity: 1000,
    sl: 999999, tp1: 1000000, qty1: 1000,     // SL di ATAS entry -> ditolak
  });
  console.log('   CASHCAT ->', JSON.stringify(hl.j).slice(0, 220));
  cek('CASHCAT dibagi ke Hyperliquid', hl.j.bursa === 'hyperliquid', JSON.stringify(hl.j).slice(0, 120));
  cek('ditolak pemeriksa sisi SL', /harus DI BAWAH entry/.test(String(hl.j.error || '')),
      String(hl.j.error).slice(0, 120));

  /* BTCUSDT ADA di Binance -> harus tetap ke Binance. Dikirim dengan
     quantity nol supaya Binance yang menolaknya, bukan kita. */
  const bn = await ambil('/api/trade/futures', {
    symbol: 'BTCUSDT', side: 'BUY', quantity: 0.00000001,
    sl: 1, tp1: 999999, qty1: 0.00000001,
  });
  const dariHl = bn.j.bursa === 'hyperliquid';
  console.log('   BTCUSDT ->', JSON.stringify(bn.j).slice(0, 220));
  cek('BTCUSDT TIDAK dibelokkan ke Hyperliquid', !dariHl);

  /* Paksa bursa lewat medan tegas: BTC ADA di Hyperliquid juga, dan panel
     order yang sedang menatap chart Hyperliquid harus bisa memilihnya. */
  const paksa = await ambil('/api/trade/futures', {
    symbol: 'BTCUSDT', side: 'BUY', quantity: 0.001, bursa: 'hyperliquid',
    sl: 999999, tp1: 1000000, qty1: 0.001,    // salah sisi -> ditolak
  });
  console.log('   BTCUSDT paksa HL ->', JSON.stringify(paksa.j).slice(0, 220));
  cek('medan bursa tegas mengalahkan tebakan', paksa.j.bursa === 'hyperliquid',
      JSON.stringify(paksa.j).slice(0, 120));

  console.log('\nlulus ' + lulus + ' / gagal ' + gagal);
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.log('GALAT UJI: ' + e.message); process.exit(1); });
