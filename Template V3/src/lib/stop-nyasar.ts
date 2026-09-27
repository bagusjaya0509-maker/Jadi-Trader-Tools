import type { OrderBursa } from '@/lib/admin';
import { kunciPasar } from '@/lib/simbol';

/* ════════════════════════════════════════════════════════════════════════
   STOP NYASAR — SL/TP yang tidak menjaga apa pun
   ════════════════════════════════════════════════════════════════════════
   Di Binance Futures, SL dan TP bukan bagian dari order entry-nya. Mereka
   order tersendiri yang menempel pada SIMBOL, bukan pada posisi. Akibatnya
   dua hal bisa terjadi tanpa terlihat di mana pun:

   1. YATIM — posisinya sudah tertutup (kena TP, ditutup manual, atau
      pending-nya dibatalkan) tapi stop-nya masih hidup. Hari ini ia tidak
      melakukan apa-apa. Lalu simbol yang sama dibuka lagi, dan stop lama
      itu menembak posisi baru di harga yang sudah tidak relevan.

   2. MENUMPUK — SL diubah, yang baru terpasang, yang lama gagal atau lupa
      dibatalkan. Sekarang ada dua SL yang masing-masing menutup SELURUH
      posisi. Yang pertama kena menutup posisinya; yang kedua membuka
      posisi BERLAWANAN sebesar itu juga.

   ── MENUMPUK DINILAI DARI SIAPA YANG KENA DULUAN ─────────────────────
   Versi pertama mengurutkan menurut WAKTU DIBUAT dan menganggap yang
   lebih tua sudah "diganti". Dilaporkan pemilik 27 Sep 2026 lewat TAO di
   Hyperliquid: dua kali entry, masing-masing dengan SL/TP sendiri —

     entry 1   SL 222,36   TP 495,55   qty 0,123
     entry 2   SL 173,80   TP 631,39   qty 0,319

   lalu 75% posisi ditutup, sisa 0,111. Pendeteksi lama menandai SL 222,36
   "tidak menjaga apa pun" dan menawarkan membatalkannya — padahal justru
   itu stop yang akan kena PERTAMA kalau harga turun. Mengikuti tombolnya
   berarti melebarkan stop sisa posisi dari 222 ke 173.

   Yang benar: urutkan menurut harga yang tersentuh lebih dulu. Stop yang
   ditandai hanya yang TIDAK MUNGKIN kena, karena stop-stop yang lebih
   dekat sudah menutup seluruh posisi lebih dulu. Membatalkannya tidak
   pernah menambah risiko, apa pun urutan pembuatannya. Kasus lama yang
   dijaga tetap tertangkap: SL yang digeser mendekat meninggalkan SL lama
   yang lebih jauh, dan yang jauh itulah yang ditandai.

   Yang TIDAK dianggap menumpuk: TP bertingkat. Metode TP1/TP2 memasang dua
   TP yang masing-masing setengah posisi — jumlahnya pas, dan mematikan
   salah satunya justru merusak rencana yang sengaja dibuat. Karena itu
   ukurannya yang dijumlahkan, bukan barisnya yang dihitung.
   ════════════════════════════════════════════════════════════════════════ */

export interface StopNyasar {
  order: OrderBursa;
  sebab: 'yatim' | 'tumpuk';
  /** Kalimat yang bisa langsung dibaca orang — dipakai di layar DAN di
   *  kotak konfirmasi, supaya yang dikatakan dan yang dibatalkan sama. */
  ket: string;
}

/* ── DIHITUNG PER BURSA, BUKAN PER SIMBOL ────────────────────────
   FARTCOINUSDT terbuka di Binance DAN Hyperliquid sekaligus. Dikelompokkan
   per simbol, TP Binance dan TP Hyperliquid bertemu di satu keranjang, lalu
   penjaga "menumpuk" di bawah menyimpulkan salah satunya kelebihan — dan
   menawarkan membatalkannya. Keduanya sah; yang keliru pengelompokannya.

   Bahayanya nyata dan satu arah: tombol Bersihkan akan mencabut stop yang
   benar-benar menjaga uang, di bursa yang bahkan tidak sedang dilihat. */
/** Harga pemicu untuk kalimat di layar: tanpa nol berlebih, tanpa notasi
 *  ilmiah untuk koin receh. */
function hargaTeks(n: number): string {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 4 : 8 });
}

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
    const pos = posisi.find((p) => kunciPasar(p.bursa, p.simbol) === k);
    const adaPending = pending.some((o) => kunciPasar(o.bursa, o.simbol) === k);

    if (!pos && !adaPending) {
      milik.forEach((o) => hasil.push({
        order: o, sebab: 'yatim',
        ket: 'tidak ada posisi maupun pending order di simbol ini',
      }));
      continue;
    }
    /* Masih pending: stop-nya memang menunggu entry-nya jadi. Itu bukan
       tumpukan, itu rencana yang belum berjalan. */
    if (!pos || pos.jumlah <= 0) continue;

    /* Posisi LONG ditutup order SELL. Arah posisinya dipakai kalau
       pemanggil memberikannya; kalau tidak, dibaca dari sisi order
       penutupnya sendiri. */
    const panjang = pos.arah ? pos.arah === 'BUY' : milik.every((o) => o.arah === 'SELL');

    for (const jenis of ['SL', 'TP'] as const) {
      /* Pemicu yang tidak diketahui tidak bisa diurutkan, jadi tidak pernah
         ditandai — lebih baik diam daripada menawarkan membatalkan stop
         yang tidak bisa dinilai. */
      const sejenis = milik.filter((s) => s.jenis === jenis && s.pemicu > 0);
      if (sejenis.length < 2) continue;
      /* Kena duluan: SL long = pemicu TERTINGGI, TP long = TERENDAH;
         posisi short kebalikannya. Pemicu sama persis: yang lebih baru
         dianggap pengganti, yang lama yang ditandai. */
      const naik = (jenis === 'SL') !== panjang;
      sejenis.sort((a, b) => (a.pemicu === b.pemicu
        ? b.dibuat - a.dibuat
        : naik ? a.pemicu - b.pemicu : b.pemicu - a.pemicu));
      const terdekat = sejenis[0];
      let tertutup = 0;
      for (const o of sejenis) {
        if (tertutup >= pos.jumlah * 0.999) {
          hasil.push({
            order: o, sebab: 'tumpuk',
            ket: `tidak akan pernah kena — ${jenis} di ${hargaTeks(terdekat.pemicu)} lebih dekat dan sudah menutup seluruh posisi`,
          });
          continue;
        }
        /* qty 0 berarti closePosition: satu order itu menutup berapa pun
           besarnya posisi. */
        tertutup += o.qty > 0 ? o.qty : pos.jumlah;
      }
    }
  }
  return hasil;
}
