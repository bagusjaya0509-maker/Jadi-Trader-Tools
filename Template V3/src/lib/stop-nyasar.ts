import type { OrderBursa } from '@/lib/admin';
import { kunciPasar } from '@/lib/simbol';

/* ════════════════════════════════════════════════════════════════════════
   STOP NYASAR — SL/TP yang tertinggal tanpa posisi (YATIM)
   ════════════════════════════════════════════════════════════════════════
   Di Binance Futures dan Hyperliquid, SL dan TP bukan bagian dari order
   entry-nya. Mereka order tersendiri yang menempel pada SIMBOL, bukan pada
   posisi. Akibatnya posisinya bisa sudah tertutup (kena TP, ditutup
   manual, atau pending-nya dibatalkan) sementara stop-nya masih hidup.
   Hari ini ia tidak melakukan apa-apa. Lalu simbol yang sama dibuka lagi,
   dan stop lama itu menembak posisi baru di harga yang sudah tidak relevan.

   Itu satu-satunya yang dilaporkan di sini: stop tanpa posisi DAN tanpa
   pending order di simbol dan bursa yang sama.

   ── "MENUMPUK" DICABUT 27 SEP 2026 ─────────────────────────────────
   Dulu ada jenis kedua: dua SL/TP sejenis di posisi yang masih hidup,
   dengan alasan SL ganda bisa membuka posisi BERLAWANAN — yang pertama
   menutup posisi, yang kedua membuka arah sebaliknya.

   Alasan itu tidak berlaku di sistem ini. Semua SL/TP yang dipasang
   backend bersifat reduceOnly (Binance `reduceOnly: 'true'` di algoOrder,
   Hyperliquid `r: true`), dan backend bahkan HANYA menggolongkan sebuah
   order sebagai SL/TP kalau ia reduceOnly/closePosition — yang tidak,
   dianggap order pembuka (pending). Order reduceOnly tidak bisa membuka
   posisi, jadi stop tambahan paling jauh jadi cadangan yang diam.

   Yang terjadi justru sebaliknya, dilaporkan pemilik lewat TAO di
   Hyperliquid: dua kali entry dengan SL/TP masing-masing (SL 222,36 dan
   173,80), lalu 75% posisi ditutup. Versi pertama menandai SL 222,36
   "tidak menjaga apa pun" dan menawarkan membatalkannya — padahal itu stop
   yang kena PERTAMA. Diperbaiki agar menilai siapa yang kena duluan, lalu
   pemilik memutuskan peringatannya tidak diperlukan sama sekali selama
   posisinya masih ada dan SL/TP-nya masih terpasang. Keputusan itu benar
   karena alasan di atas: tidak ada bahaya yang tersisa untuk diperingatkan.

   Begitu posisinya tertutup, stop-stop tambahan itu otomatis menjadi
   YATIM — dan saat itulah ia dilaporkan di sini, serta dibersihkan
   penyapu di backend (sapu-stop.js).
   ════════════════════════════════════════════════════════════════════════ */

export interface StopNyasar {
  order: OrderBursa;
  sebab: 'yatim';
  /** Kalimat yang bisa langsung dibaca orang — dipakai di layar DAN di
   *  kotak konfirmasi, supaya yang dikatakan dan yang dibatalkan sama. */
  ket: string;
}

/* ── DIHITUNG PER BURSA, BUKAN PER SIMBOL ────────────────────────
   FARTCOINUSDT bisa terbuka di Binance DAN Hyperliquid sekaligus. Kalau
   dikelompokkan per simbol saja, posisi di satu bursa "menyelamatkan" stop
   yatim di bursa lainnya — dan sebaliknya, stop yang sah bisa dilaporkan
   yatim karena posisinya dicari di bursa yang salah. Kuncinya bursa+simbol. */
export function cariStopNyasar(
  stop: OrderBursa[],
  posisi: { simbol: string; jumlah: number; bursa?: 'binance' | 'hyperliquid'; arah?: 'BUY' | 'SELL' }[],
  pending: { simbol: string; bursa?: 'binance' | 'hyperliquid' }[],
): StopNyasar[] {
  const hasil: StopNyasar[] = [];
  const kunci = [...new Set(stop.map((s) => kunciPasar(s.bursa, s.simbol)))];

  for (const k of kunci) {
    const milik = stop.filter((s) => kunciPasar(s.bursa, s.simbol) === k
                                     && (s.jenis === 'SL' || s.jenis === 'TP'));
    if (!milik.length) continue;
    /* Baris posisi APA PUN di simbol+bursa ini cukup — termasuk yang
       jumlahnya tidak terbaca (0). Lebih baik diam soal stop yang mungkin
       masih menjaga sesuatu daripada menawarkan membatalkannya. */
    const adaPosisi = posisi.some((p) => kunciPasar(p.bursa, p.simbol) === k);
    /* Masih pending: stop-nya memang menunggu entry-nya jadi. Itu rencana
       yang belum berjalan, bukan stop yatim. */
    const adaPending = pending.some((o) => kunciPasar(o.bursa, o.simbol) === k);
    if (adaPosisi || adaPending) continue;

    milik.forEach((o) => hasil.push({
      order: o, sebab: 'yatim',
      ket: 'tidak ada posisi maupun pending order di simbol ini',
    }));
  }
  return hasil;
}
