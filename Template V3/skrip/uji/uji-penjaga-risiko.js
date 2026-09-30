/* Uji evaluasi penjaga-risiko.js dengan angka karangan.
   Jalankan: node skrip/uji/uji-penjaga-risiko.js  (dari folder backend) */
const path = require('path');
const { evaluasi, INGAT_ULANG_MS } = require(process.env.MODUL || path.join(__dirname, '..', '..', 'penjaga-risiko.js'));

let lulus = 0, gagal = 0;
function cek(nama, benar) {
  if (benar) { lulus++; console.log('  ok  ', nama); }
  else { gagal++; console.log('  GAGAL', nama); }
}

const MENIT = 60_000;
const T0 = Date.UTC(2026, 8, 30, 3, 0, 0); // 10.00 WIB
function pos(simbol, pnl, nilai, bursa = 'binance', arah = 'BUY') {
  return { bursa, simbol, arah, label: simbol, kunci: bursa + ':' + simbol + ':' + arah, pnl, nilai };
}
function potret(posisi, modal = 1000) {
  return { modal, rincianModal: { binance: modal, hyperliquid: 0, mt5: 0 }, posisi,
           terbaca: { binance: true, hyperliquid: true, mt5: false } };
}
const idDari = (h) => h.temuan.map((t) => t.id + '=' + t.level);

console.log('floating & level');
let k = {};
let h = evaluasi(potret([pos('AUSDT', -20, 100)]), k, T0); k = h.keadaan;
cek('2% floating: tidak berbunyi', !h.temuan.some((t) => t.aturan === 'floating'));
cek('2% satu posisi: posisi waspada (batasnya 2%)', idDari(h).includes('risiko-posisi:binance:AUSDT:BUY=waspada'));
h = evaluasi(potret([pos('AUSDT', -35, 100)]), k, T0 + 2 * MENIT); k = h.keadaan;
cek('3.5%: floating waspada', idDari(h).includes('risiko-floating=waspada'));
cek('3.5% satu posisi: masih waspada, tidak berbunyi ulang', !h.temuan.some((t) => t.aturan === 'posisi'));
h = evaluasi(potret([pos('AUSDT', -36, 100)]), k, T0 + 4 * MENIT); k = h.keadaan;
cek('3.6% sesudahnya: diam', h.temuan.length === 0);
h = evaluasi(potret([pos('AUSDT', -65, 100)]), k, T0 + 6 * MENIT); k = h.keadaan;
cek('6.5%: floating naik ke bahaya', idDari(h).includes('risiko-floating=bahaya'));
h = evaluasi(potret([pos('AUSDT', -26, 100)]), k, T0 + 8 * MENIT); k = h.keadaan;
cek('2.6% (di atas 80% batas): diam, level bahaya tertahan', h.temuan.length === 0 && k.level.floating.level === 'bahaya');
h = evaluasi(potret([pos('AUSDT', -50, 100)]), k, T0 + 10 * MENIT); k = h.keadaan;
cek('5%: turun ke waspada tanpa bunyi', !h.temuan.some((t) => t.aturan === 'floating') && k.level.floating.level === 'waspada');
h = evaluasi(potret([pos('AUSDT', -70, 100)]), k, T0 + 12 * MENIT); k = h.keadaan;
cek('7%: naik lagi ke bahaya = bunyi', idDari(h).includes('risiko-floating=bahaya'));
h = evaluasi(potret([pos('AUSDT', -71, 100)]), k, T0 + 12 * MENIT + INGAT_ULANG_MS); k = h.keadaan;
cek('bahaya bertahan 6 jam: diingatkan ulang', idDari(h).includes('risiko-floating=bahaya'));
h = evaluasi(potret([pos('AUSDT', -10, 100)]), k, T0 + 14 * MENIT + INGAT_ULANG_MS); k = h.keadaan;
cek('1%: pulih, level dihapus', !k.level.floating);
h = evaluasi(potret([pos('AUSDT', -32, 100)]), k, T0 + 16 * MENIT + INGAT_ULANG_MS); k = h.keadaan;
cek('3.2% sesudah pulih: berbunyi lagi', idDari(h).includes('risiko-floating=waspada'));
h = evaluasi(potret([]), k, T0 + 18 * MENIT + INGAT_ULANG_MS); k = h.keadaan;
cek('posisi ditutup: level posisinya ikut hilang', !Object.keys(k.level).some((x) => x.startsWith('posisi:')));
cek('untung tidak dihitung rugi', !evaluasi(potret([pos('BUSDT', 90, 100)]), {}, T0).temuan.some((t) => t.aturan === 'floating'));

console.log('jumlah & eksposur');
const banyak = Array.from({ length: 6 }, (_, i) => pos('K' + i + 'USDT', 0, 400));
h = evaluasi(potret(banyak), {}, T0);
cek('6 posisi: jumlah waspada', idDari(h).includes('risiko-jumlah=waspada'));
cek('nilai 2400 / modal 1000 = 2.4x: eksposur diam', !h.temuan.some((t) => t.aturan === 'eksposur'));
h = evaluasi(potret(Array.from({ length: 10 }, (_, i) => pos('K' + i + 'USDT', 0, 550))), {}, T0);
cek('10 posisi: jumlah bahaya', idDari(h).includes('risiko-jumlah=bahaya'));
cek('5500 / 1000 = 5.5x: eksposur bahaya', idDari(h).includes('risiko-eksposur=bahaya'));

console.log('entry harian');
k = {};
h = evaluasi(potret([pos('AUSDT', 0, 10), pos('BUSDT', 0, 10)]), k, T0); k = h.keadaan;
cek('putaran pertama: posisi lama tidak dihitung entry', k.entri === 0);
let t = T0;
for (let i = 0; i < 6; i++) {
  t += 2 * MENIT;
  const isi = [pos('AUSDT', 0, 10), pos('BUSDT', 0, 10)].concat(Array.from({ length: i + 1 }, (_, j) => pos('N' + j + 'USDT', 0, 10)));
  h = evaluasi(potret(isi), k, t); k = h.keadaan;
}
cek('6 posisi baru: entri = 6', k.entri === 6);
cek('6 entry: overtrade waspada berbunyi', idDari(h).includes('risiko-entri=waspada'));
h = evaluasi(potret([pos('AUSDT', 0, 10)]), k, t + 2 * MENIT); k = h.keadaan;
h = evaluasi(potret([pos('AUSDT', 0, 10), pos('BUSDT', 0, 10)]), k, t + 4 * MENIT); k = h.keadaan;
cek('tutup lalu buka lagi = entry baru (7)', k.entri === 7);
h = evaluasi(potret([pos('AUSDT', 0, 10), pos('BUSDT', 0, 10), pos('ZUSDT', 0, 10)]), k, t + 30 * MENIT); k = h.keadaan;
cek('bacaan terakhir > 10 menit lalu: disemai ulang, tidak dihitung', k.entri === 7);
const besok = Date.UTC(2026, 9, 1, 3, 0, 0);
h = evaluasi(potret([pos('AUSDT', 0, 10)]), k, besok); k = h.keadaan;
cek('ganti hari WIB: entri kembali 0', k.entri === 0 && k.hari === '2026-10-01');
const gagalBaca = potret([]); gagalBaca.terbaca.binance = false;
h = evaluasi(gagalBaca, k, besok + 2 * MENIT); k = h.keadaan;
h = evaluasi(potret([pos('AUSDT', 0, 10)]), k, besok + 4 * MENIT); k = h.keadaan;
cek('bursa gagal dibaca: posisinya tidak dianggap baru saat terbaca lagi', k.entri === 0);

console.log('\n' + lulus + ' lulus, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
