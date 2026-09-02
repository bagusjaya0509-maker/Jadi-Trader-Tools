/* ══════════════════════════════════════════════════════════════════════════
   uji-order-hl.js — pagar keselamatan orderHl(), TANPA mengirim order
   ══════════════════════════════════════════════════════════════════════════
   Dijalankan DI VPS (butuh .env dengan HL_AKUN/HL_AGENT_KEY):

       node skrip/uji/uji-order-hl.js

   ── KENAPA UJI INI ADA, DAN APA YANG SENGAJA TIDAK DIUJINYA ─────────────
   Order manual Hyperliquid tidak punya pagar nominal — keputusan pemilik
   2 Sep 2026. Artinya satu-satunya yang berdiri antara salah ketik dan uang
   sungguhan adalah pemeriksaan di dalam `orderHl` sendiri. Pemeriksaan
   semacam itu wajib punya ujinya; "sudah saya baca dan kelihatannya benar"
   bukan bukti.

   Yang TIDAK diuji di sini: order yang benar-benar berangkat. Itu menuntut
   uang sungguhan, dan uji yang menghabiskan uang tiap kali dijalankan adalah
   uji yang segera berhenti dijalankan. Jalur itu dibuktikan sekali, dengan
   tangan, dengan ukuran terkecil — bukan di berkas ini.

   ── YANG DIJAGA UJI INI ─────────────────────────────────────────────────
   1. SL/TP di sisi yang salah DITOLAK. Hyperliquid MENERIMA stop di sisi
      yang salah: ia langsung terpicu dan menutup posisi yang baru saja
      dibuka, dalam hitungan detik. Yang terbaca orang cuma "posisi saya
      hilang sendiri". Binance menolaknya; di jalur ini penolakan itu harus
      kita sendiri yang melakukan.
   2. Penolakan TIDAK MENINGGALKAN JEJAK. Tiap penolakan terjadi sebelum
      satu pun panggilan tulis ke bursa. Cacat ini pernah ada sungguhan:
      entryType yang tidak didukung sempat mengubah leverage koin sebelum
      ditolak, dan yang menemukannya uji ini, bukan pembacaan ulang kode.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const H = require('../../hyperliquid');

let lulus = 0, gagal = 0;

async function harusMenolak(nama, jalankan, cocok) {
  try {
    await jalankan();
    console.log('  GAGAL  ' + nama + ' — tidak melempar sama sekali');
    gagal++;
  } catch (e) {
    if (cocok.test(e.message)) { console.log('  ok     ' + nama); lulus++; }
    else { console.log('  GAGAL  ' + nama + ' — pesan tak terduga: ' + e.message); gagal++; }
  }
}

(async () => {
  if (!H.siap()) {
    console.log('Hyperliquid belum aktif (HL_AKTIF/HL_AKUN/HL_AGENT_KEY) — uji dilewati.');
    process.exit(0);
  }

  const hrg = await H.hargaHl('BTC');
  if (!(hrg > 0)) { console.log('Harga BTC tidak terbaca — uji dibatalkan.'); process.exit(1); }
  console.log('Harga BTC acuan: ' + hrg + '\n');

  console.log('── SL/TP di sisi yang salah ──────────────────────────────────');
  await harusMenolak('BUY, SL di ATAS entry',
    () => H.orderHl({ koin: 'BTC', arah: 'BUY', quantity: 0.001, sl: hrg * 1.05, tp1: hrg * 1.1 }),
    /SL .* harus DI BAWAH entry/);
  await harusMenolak('SELL, SL di BAWAH entry',
    () => H.orderHl({ koin: 'BTC', arah: 'SELL', quantity: 0.001, sl: hrg * 0.95, tp1: hrg * 0.9 }),
    /SL .* harus DI ATAS entry/);
  await harusMenolak('BUY, TP1 di BAWAH entry',
    () => H.orderHl({ koin: 'BTC', arah: 'BUY', quantity: 0.001, sl: hrg * 0.95, tp1: hrg * 0.9 }),
    /TP1 .* harus DI ATAS entry/);
  await harusMenolak('BUY, TP2 salah sisi ikut tertangkap',
    () => H.orderHl({ koin: 'BTC', arah: 'BUY', quantity: 0.001, sl: hrg * 0.95, tp1: hrg * 1.05, tp2: hrg * 0.9 }),
    /TP2 .* harus DI ATAS entry/);

  console.log('\n── LIMIT diperiksa terhadap harga PESANAN, bukan harga pasar ──');
  /* Kalau sisinya diukur dari harga pasar, SL ini lolos — ia memang di bawah
     pasar. Yang benar: ia DI ATAS harga pesanannya, jadi begitu limitnya
     terisi, stopnya langsung kena. */
  await harusMenolak('LIMIT jauh di bawah pasar, SL di atas harga pesanan',
    () => H.orderHl({ koin: 'BTC', arah: 'BUY', quantity: 0.001, entryType: 'LIMIT',
                      entryPrice: hrg * 0.5, sl: hrg * 0.6, tp1: hrg * 0.7 }),
    /SL .* harus DI BAWAH entry/);

  console.log('\n── Penolakan lain ────────────────────────────────────────────');
  await harusMenolak('koin yang tidak ada di Hyperliquid',
    () => H.orderHl({ koin: 'KOINPALSU', arah: 'BUY', quantity: 1, sl: 1, tp1: 2 }),
    /tidak ada di Hyperliquid perps/);
  await harusMenolak('ukuran yang membulat jadi nol',
    () => H.orderHl({ koin: 'BTC', arah: 'BUY', quantity: 0.0000001, sl: hrg * 0.95, tp1: hrg * 1.05 }),
    /membulat jadi nol/);
  await harusMenolak('entryType STOP_MARKET ditolak terang-terangan',
    () => H.orderHl({ koin: 'BTC', arah: 'BUY', quantity: 0.001, entryType: 'STOP_MARKET',
                      entryPrice: hrg, sl: hrg * 0.95, tp1: hrg * 1.05 }),
    /belum didukung di Hyperliquid/);

  console.log('\n── Penolakan tidak boleh meninggalkan jejak ──────────────────');
  /* Dibuktikan dari LUAR, bukan dari urutan baris: leverage BTC dibaca
     sebelum dan sesudah percobaan yang pasti ditolak. Kalau angkanya
     bergerak, ada panggilan tulis yang lolos sebelum penolakan. */
  const bacaLev = async () => {
    const s = await H.saldoHl();
    const p = s.posisi.find((x) => x.koin.toUpperCase() === 'BTC');
    return p ? p.leverage : null;
  };
  const sebelum = await bacaLev();
  try {
    await H.orderHl({ koin: 'BTC', arah: 'BUY', quantity: 0.001, entryType: 'STOP_MARKET',
                      entryPrice: hrg, sl: hrg * 0.95, tp1: hrg * 1.05, leverage: 7 });
  } catch (e) { /* memang harus melempar */ }
  const sesudah = await bacaLev();
  if (sebelum === null) {
    /* TIDAK dihitung lulus. Hyperliquid cuma melaporkan leverage untuk koin
       yang SEDANG dipegang, jadi tanpa posisi BTC perbandingan ini tidak
       membandingkan apa pun — dan uji yang lulus tanpa menguji lebih buruk
       daripada uji yang tidak ada: ia terbaca sebagai bukti.

       Jaga sungguhannya urutan baris di orderHl (penolakan entryType duduk
       SEBELUM updateLeverage). Yang ini menangkapnya hanya kalau kebetulan
       ada posisi BTC terbuka saat uji dijalankan. */
    console.log('  LEWAT  leverage tak terbaca tanpa posisi BTC — periksa ini '
              + 'lagi saat ada posisi terbuka');
  } else if (sebelum === sesudah) {
    console.log('  ok     leverage tidak tersentuh (' + String(sebelum) + ')');
    lulus++;
  } else {
    console.log('  GAGAL  leverage berubah ' + String(sebelum) + ' -> ' + String(sesudah)
              + ' padahal ordernya ditolak');
    gagal++;
  }

  console.log('\nlulus ' + lulus + ' / gagal ' + gagal);
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.log('GALAT UJI: ' + e.message); process.exit(1); });
