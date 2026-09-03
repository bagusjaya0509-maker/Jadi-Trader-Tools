/* Uji inti jurnal dompet: src/lib/jurnal-dompet-inti.ts
   ────────────────────────────────────────────────────────────────────────
   Jalankan: node skrip/uji/uji-jurnal-dompet.mjs
   (Node ≥ 22.6 melucuti tipe TypeScript sendiri; berkas intinya sengaja
   bebas impor `@/…` supaya bisa dimuat langsung tanpa Vite.)

   Tiap kasus di bawah adalah bentuk fill yang BENAR-BENAR keluar dari
   `userFillsByTime` — bukan bentuk yang enak diuji. Angka closedPnl ditulis
   apa adanya seperti yang dikirim Hyperliquid (per fill, kotor), karena
   yang dijumlahkan jurnal memang itu, bukan hasil hitung kita sendiri.   */

import { kelompokkanFill, tarikSemuaFill, perp } from '../../src/lib/jurnal-dompet-inti.ts';

let n = 0, gagal = 0;
function uji(nama, f) {
  n++;
  try { f(); console.log('OK    ' + nama); }
  catch (e) { gagal++; console.log('GAGAL ' + nama + '\n      ' + (e && e.message || e)); }
}
function sama(a, b, pesan) {
  if (a !== b) throw new Error((pesan || '') + ' → dapat ' + JSON.stringify(a) + ', harap ' + JSON.stringify(b));
}
function dekat(a, b, pesan, eps = 1e-6) {
  if (Math.abs(a - b) > eps) throw new Error((pesan || '') + ' → dapat ' + a + ', harap ' + b);
}

/* Pembuat fill ringkas. Semua angka dikirim sebagai STRING seperti API. */
let tidBerikut = 1000;
function F({ coin = 'ETH', side, px, sz, start, t, oid, pnl = 0, fee = 0, dir = '' }) {
  return {
    coin, side, px: String(px), sz: String(sz), startPosition: String(start),
    time: t, oid, tid: tidBerikut++, closedPnl: String(pnl), fee: String(fee), dir,
  };
}

/* ── 1. Long bulat sederhana ─────────────────────────────────────────── */
uji('long: buka 1@100, tutup 1@110 → satu trade BUY, masuk 100, keluar 110', () => {
  const t = kelompokkanFill([
    F({ side: 'B', px: 100, sz: 1, start: 0, t: 1, oid: 1, dir: 'Open Long' }),
    F({ side: 'A', px: 110, sz: 1, start: 1, t: 2, oid: 2, pnl: 10, fee: 0.05, dir: 'Close Long' }),
  ]);
  sama(t.length, 1, 'jumlah trade');
  sama(t[0].oid, 2, 'oid = order penutup');
  sama(t[0].arah, 'BUY');
  dekat(t[0].qty, 1); dekat(t[0].hargaMasuk, 100); dekat(t[0].hargaKeluar, 110);
  dekat(t[0].pnl, 10); dekat(t[0].fee, 0.05);
  sama(t[0].masukLengkap, true); sama(t[0].isian, 1); sama(t[0].waktu, 2);
});

/* ── 2. Short bulat ──────────────────────────────────────────────────── */
uji('short: jual 2@100, beli 2@90 → SELL, masuk 100, keluar 90', () => {
  const t = kelompokkanFill([
    F({ side: 'A', px: 100, sz: 2, start: 0, t: 1, oid: 1 }),
    F({ side: 'B', px: 90, sz: 2, start: -2, t: 2, oid: 2, pnl: 20 }),
  ]);
  sama(t.length, 1); sama(t[0].arah, 'SELL');
  dekat(t[0].hargaMasuk, 100); dekat(t[0].hargaKeluar, 90); dekat(t[0].qty, 2); dekat(t[0].pnl, 20);
});

/* ── 3. Tambah posisi, lalu dua order penutup ────────────────────────── */
uji('scale-in 1@100 + 1@120 (rata 110), tutup 1@130 & 1@140 → dua trade, masuk 110 keduanya', () => {
  const t = kelompokkanFill([
    F({ side: 'B', px: 100, sz: 1, start: 0, t: 1, oid: 1 }),
    F({ side: 'B', px: 120, sz: 1, start: 1, t: 2, oid: 2 }),
    F({ side: 'A', px: 130, sz: 1, start: 2, t: 3, oid: 3, pnl: 20 }),
    F({ side: 'A', px: 140, sz: 1, start: 1, t: 4, oid: 4, pnl: 30 }),
  ]);
  sama(t.length, 2);
  dekat(t[0].hargaMasuk, 110, 'masuk trade 1'); dekat(t[0].hargaKeluar, 130);
  dekat(t[1].hargaMasuk, 110, 'masuk trade 2 (rata tidak bergeser sesudah tutup sebagian)');
  dekat(t[1].hargaKeluar, 140);
});

/* ── 4. Tambah DI ANTARA dua penutupan → rata-rata sisa berubah ──────── */
uji('buka 1@100, tutup 0.5@120, tambah 1@200, tutup 1.5@150 → trade kedua masuk 166.67', () => {
  const t = kelompokkanFill([
    F({ side: 'B', px: 100, sz: 1, start: 0, t: 1, oid: 1 }),
    F({ side: 'A', px: 120, sz: 0.5, start: 1, t: 2, oid: 2, pnl: 10 }),
    F({ side: 'B', px: 200, sz: 1, start: 0.5, t: 3, oid: 3 }),
    F({ side: 'A', px: 150, sz: 1.5, start: 1.5, t: 4, oid: 4, pnl: 0 }),
  ]);
  sama(t.length, 2);
  dekat(t[0].hargaMasuk, 100);
  /* sisa 0.5@100 + 1@200 = 250 / 1.5 = 166.666… */
  dekat(t[1].hargaMasuk, 250 / 1.5, 'rata sesudah tambah');
  dekat(t[1].qty, 1.5);
});

/* ── 5. Membalik (flip) dalam satu fill ──────────────────────────────── */
uji('flip: long 1@100, jual 3@110 (Long > Short), beli 2@100 → BUY qty1 lalu SELL qty2 masuk 110', () => {
  const t = kelompokkanFill([
    F({ side: 'B', px: 100, sz: 1, start: 0, t: 1, oid: 1 }),
    F({ side: 'A', px: 110, sz: 3, start: 1, t: 2, oid: 2, pnl: 10, dir: 'Long > Short' }),
    F({ side: 'B', px: 100, sz: 2, start: -2, t: 3, oid: 3, pnl: 20, dir: 'Close Short' }),
  ]);
  sama(t.length, 2);
  sama(t[0].arah, 'BUY'); dekat(t[0].qty, 1, 'hanya bagian yang menutup'); dekat(t[0].hargaKeluar, 110);
  sama(t[1].arah, 'SELL'); dekat(t[1].qty, 2); dekat(t[1].hargaMasuk, 110, 'kaki baru dari sisa flip'); dekat(t[1].hargaKeluar, 100);
  sama(t[1].masukLengkap, true);
});

/* ── 6. Kaki dimulai sebelum jendela ─────────────────────────────────── */
uji('fill pertama sudah punya start 5 → masukLengkap false, hargaMasuk 0, qty tetap benar', () => {
  const t = kelompokkanFill([
    F({ side: 'B', px: 100, sz: 1, start: 5, t: 1, oid: 1 }),
    F({ side: 'A', px: 105, sz: 6, start: 6, t: 2, oid: 2, pnl: 12 }),
  ]);
  sama(t.length, 1);
  sama(t[0].masukLengkap, false); dekat(t[0].hargaMasuk, 0); dekat(t[0].qty, 6); dekat(t[0].pnl, 12);
});

uji('kaki tak lengkap ditutup habis, lalu kaki BARU dari nol → yang baru lengkap lagi', () => {
  const t = kelompokkanFill([
    F({ side: 'A', px: 105, sz: 6, start: 6, t: 1, oid: 1, pnl: 1 }),
    F({ side: 'B', px: 50, sz: 1, start: 0, t: 2, oid: 2 }),
    F({ side: 'A', px: 60, sz: 1, start: 1, t: 3, oid: 3, pnl: 10 }),
  ]);
  sama(t.length, 2);
  sama(t[0].masukLengkap, false);
  sama(t[1].masukLengkap, true); dekat(t[1].hargaMasuk, 50);
});

/* ── 7. Satu order, tiga fill parsial, fee negatif (rebate) ──────────── */
uji('satu oid dalam 3 fill → satu trade, isian 3, keluar VWAP, fee Σ termasuk negatif', () => {
  const t = kelompokkanFill([
    F({ side: 'B', px: 100, sz: 3, start: 0, t: 1, oid: 1 }),
    F({ side: 'A', px: 110, sz: 1, start: 3, t: 5, oid: 9, pnl: 10, fee: -0.001 }),
    F({ side: 'A', px: 112, sz: 1, start: 2, t: 6, oid: 9, pnl: 12, fee: 0.02 }),
    F({ side: 'A', px: 114, sz: 1, start: 1, t: 7, oid: 9, pnl: 14, fee: -0.001 }),
  ]);
  sama(t.length, 1); sama(t[0].isian, 3);
  dekat(t[0].hargaKeluar, 112); dekat(t[0].pnl, 36); dekat(t[0].fee, 0.018); sama(t[0].waktu, 7);
});

/* ── 8. Dua koin berjalinan → kaki terpisah ──────────────────────────── */
uji('ETH dan BTC berjalinan → dua trade independen, tidak saling mengganggu posisi', () => {
  const t = kelompokkanFill([
    F({ coin: 'ETH', side: 'B', px: 100, sz: 1, start: 0, t: 1, oid: 1 }),
    F({ coin: 'BTC', side: 'A', px: 50000, sz: 0.1, start: 0, t: 2, oid: 2 }),
    F({ coin: 'ETH', side: 'A', px: 110, sz: 1, start: 1, t: 3, oid: 3, pnl: 10 }),
    F({ coin: 'BTC', side: 'B', px: 49000, sz: 0.1, start: -0.1, t: 4, oid: 4, pnl: 100 }),
  ]);
  sama(t.length, 2);
  sama(t[0].koin, 'ETH'); sama(t[0].arah, 'BUY'); dekat(t[0].hargaMasuk, 100);
  sama(t[1].koin, 'BTC'); sama(t[1].arah, 'SELL'); dekat(t[1].hargaMasuk, 50000);
});

/* ── 9. Urutan waktu: masukan acak tetap benar ───────────────────────── */
uji('fill datang tidak urut → diurutkan waktu naik sebelum dirantai', () => {
  const t = kelompokkanFill([
    F({ side: 'A', px: 110, sz: 1, start: 1, t: 2, oid: 2, pnl: 10 }),
    F({ side: 'B', px: 100, sz: 1, start: 0, t: 1, oid: 1 }),
  ]);
  sama(t.length, 1); dekat(t[0].hargaMasuk, 100);
});

uji('dua fill di milidetik yang sama → urutan datang dipertahankan (sort stabil)', () => {
  const t = kelompokkanFill([
    F({ side: 'B', px: 100, sz: 1, start: 0, t: 7, oid: 1 }),
    F({ side: 'A', px: 120, sz: 1, start: 1, t: 7, oid: 2, pnl: 20 }),
  ]);
  sama(t.length, 1); dekat(t[0].hargaMasuk, 100); dekat(t[0].hargaKeluar, 120);
});

/* ── 10. Fill rusak dilewati tanpa merusak rantai ────────────────────── */
uji('fill sz "0" dan startPosition bukan angka dilewati; sisanya tetap benar', () => {
  const t = kelompokkanFill([
    F({ side: 'B', px: 100, sz: 1, start: 0, t: 1, oid: 1 }),
    { ...F({ side: 'B', px: 101, sz: 0, start: 1, t: 2, oid: 5 }) },
    { ...F({ side: 'B', px: 101, sz: 1, start: 'abc', t: 3, oid: 6 }) },
    F({ side: 'A', px: 110, sz: 1, start: 1, t: 4, oid: 2, pnl: 10 }),
  ]);
  sama(t.length, 1); dekat(t[0].qty, 1); dekat(t[0].hargaMasuk, 100);
});

/* ── 11. Settlement (delisting) = penutupan lewat angka, label apa pun ── */
uji('dir "Settlement" tetap terbaca sebagai penutupan dari angka posisi', () => {
  const t = kelompokkanFill([
    F({ side: 'B', px: 0.1, sz: 1000, start: 0, t: 1, oid: 1, dir: 'Open Long' }),
    F({ side: 'A', px: 0.08, sz: 1000, start: 1000, t: 2, oid: 2, pnl: -20, dir: 'Settlement' }),
  ]);
  sama(t.length, 1); sama(t[0].dir, 'Settlement'); dekat(t[0].pnl, -20); sama(t[0].arah, 'BUY');
});

/* ── 11b. HANYA PERP ──────────────────────────────────────────────────
   Ditemukan pada tinjauan 3 Sep 2026: fill spot dan pasar prediksi ikut
   dirantai dan melonjakkan Net P/L ratusan ribu dolar. `startPosition`
   spot adalah SALDO TOKEN, bukan posisi bertanda. */
uji('spot "@107" diabaikan seluruhnya → nol trade', () => {
  const t = kelompokkanFill([
    F({ coin: '@107', side: 'B', px: 24, sz: 100, start: 0, t: 1, oid: 1 }),
    F({ coin: '@107', side: 'A', px: 33, sz: 100, start: 100, t: 2, oid: 2, pnl: 5769.49 }),
  ]);
  sama(t.length, 0);
});

uji('spot bernama "PURR/USDC" dan pasar prediksi "#1100" juga diabaikan', () => {
  const t = kelompokkanFill([
    F({ coin: 'PURR/USDC', side: 'B', px: 1, sz: 10, start: 0, t: 1, oid: 1 }),
    F({ coin: 'PURR/USDC', side: 'A', px: 2, sz: 10, start: 10, t: 2, oid: 2, pnl: 10 }),
    F({ coin: '#1100', side: 'A', px: 1, sz: 70000, start: 70000, t: 3, oid: 3, pnl: 72998.47, dir: 'Settlement' }),
  ]);
  sama(t.length, 0);
});

uji('perp HIP-3 "xyz:GOLD" TETAP diterima — titik dua bukan penanda spot', () => {
  const t = kelompokkanFill([
    F({ coin: 'xyz:GOLD', side: 'B', px: 100, sz: 1, start: 0, t: 1, oid: 1 }),
    F({ coin: 'xyz:GOLD', side: 'A', px: 110, sz: 1, start: 1, t: 2, oid: 2, pnl: 10 }),
  ]);
  sama(t.length, 1); sama(t[0].koin, 'xyz:GOLD'); dekat(t[0].hargaMasuk, 100);
});

uji('spot bercampur perp → hanya perp yang jadi trade, P/L spot tidak ikut', () => {
  const t = kelompokkanFill([
    F({ coin: '@107', side: 'B', px: 24, sz: 100, start: 0, t: 1, oid: 1 }),
    F({ coin: 'BTC', side: 'B', px: 70000, sz: 1, start: 0, t: 2, oid: 2 }),
    F({ coin: '@107', side: 'A', px: 33, sz: 100, start: 100, t: 3, oid: 3, pnl: 900 }),
    F({ coin: 'BTC', side: 'A', px: 71000, sz: 1, start: 1, t: 4, oid: 4, pnl: 1000 }),
  ]);
  sama(t.length, 1); sama(t[0].koin, 'BTC'); dekat(t[0].pnl, 1000, 'P/L spot tidak ikut');
});

uji('perp(): bentuk nama diklasifikasi benar', () => {
  for (const k of ['BTC', 'HYPE', 'kPEPE', 'xyz:GOLD', 'vntl:ANTHROPIC', 'hyna:XPL']) {
    if (!perp(k)) throw new Error(k + ' harusnya perp');
  }
  for (const k of ['@107', '@5', 'PURR/USDC', '#1100', 'HYPE/USDC']) {
    if (perp(k)) throw new Error(k + ' harusnya BUKAN perp');
  }
});

/* ── 12. Tidak ada penutupan → tidak ada trade ───────────────────────── */
uji('hanya fill pembuka → nol trade (posisi masih terbuka bukan trade)', () => {
  sama(kelompokkanFill([F({ side: 'B', px: 100, sz: 1, start: 0, t: 1, oid: 1 })]).length, 0);
});

/* ── 13. Penarikan berhalaman ────────────────────────────────────────── */
async function ujiAsync(nama, f) {
  n++;
  try { await f(); console.log('OK    ' + nama); }
  catch (e) { gagal++; console.log('GAGAL ' + nama + '\n      ' + (e && e.message || e)); }
}

function halaman(dariT, jumlah) {
  /* jumlah fill, waktu dariT..dariT+jumlah-1, tid unik = waktu */
  return Array.from({ length: jumlah }, (_, i) => ({
    coin: 'ETH', side: 'B', px: '1', sz: '1', startPosition: '0',
    time: dariT + i, oid: 1, tid: dariT + i, closedPnl: '0', fee: '0',
  }));
}

/* Arah paginasi DIBUKTIKAN di API nyata 3 Sep 2026: 2000 fill TERTUA
   sejak startTime, jadi halaman berikutnya = memajukan startTime ke fill
   terbaru. Uji di bawah mengunci arah itu. */
await ujiAsync('halaman < 2000 → berhenti setelah satu permintaan', async () => {
  const minta = [];
  const h = await tarikSemuaFill('0xabc', 5, async (b) => { minta.push(b); return halaman(100, 10); });
  sama(h.halaman, 1); sama(h.fills.length, 10); sama(minta[0].startTime, 5);
  sama('endTime' in minta[0], false, 'tidak mengirim endTime');
  sama(minta[0].aggregateByTime, true);
});

await ujiAsync('halaman penuh 2000 → startTime MAJU ke fill terbaru, tid ganda di batas disaring', async () => {
  const minta = [];
  const h = await tarikSemuaFill('0xabc', 0, async (b) => {
    minta.push(b);
    if (b.startTime === 0) return halaman(1000, 2000);              // 1000..2999
    if (b.startTime === 2999) return halaman(2999, 2000);           // 2999..4998 (2999 ganda)
    return halaman(4998, 500);                                      // 4998..5497 (4998 ganda)
  });
  sama(minta.length, 3);
  sama(minta[1].startTime, 2999, 'maju ke terbaru halaman 1');
  sama(minta[2].startTime, 4998, 'maju ke terbaru halaman 2');
  sama(h.fills.length, 2000 + 1999 + 499, 'tid ganda di tiap batas dibuang');
  sama(h.fills[0].time, 1000, 'terurut naik'); sama(h.fills.at(-1).time, 5497);
  sama(h.terpotong, false);
});

await ujiAsync('halaman penuh tanpa fill baru → berhenti, bukan berputar', async () => {
  let k = 0;
  const h = await tarikSemuaFill('0xabc', 0, async () => { k++; return halaman(500, 2000); });
  sama(k, 2, 'halaman kedua identik → berhenti'); sama(h.fills.length, 2000);
});

await ujiAsync('batas maksHalaman → terpotong: true', async () => {
  let k = 0;
  const h = await tarikSemuaFill('0xabc', 0, async (b) => { k++; return halaman(b.startTime, 2000); }, 3);
  sama(k, 3); sama(h.terpotong, true); sama(h.fills.length, 2000 + 1999 + 1999);
});

console.log(gagal ? `\n${gagal} dari ${n} GAGAL` : `\nSemua ${n} lulus.`);
process.exit(gagal ? 1 : 0);
