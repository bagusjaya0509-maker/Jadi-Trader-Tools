import type { Trade } from '@/data/contoh';
import type { Stat } from '@/lib/hitung';

/* ════════════════════════════════════════════════════════════════════════
   CATATAN EVALUASI DARI ANGKA JURNAL
   ════════════════════════════════════════════════════════════════════════
   Angka statistik saja tidak memberi tahu apa yang harus diubah. "Winrate
   67,9%" terdengar bagus sampai kamu tahu profit factor-nya 0,79 — artinya
   sering menang tapi kalahnya jauh lebih besar, dan itu pola yang paling
   sering menghabiskan akun secara perlahan.

   Yang ditulis di sini adalah pembacaan atas gabungan angkanya, bukan
   nasihat: tiap kalimat menyebut ANGKA yang menjadi dasarnya supaya bisa
   dibantah. Catatan evaluasi yang tidak bisa ditelusuri ke datanya sendiri
   cuma tebakan yang ditulis dengan percaya diri.
   ════════════════════════════════════════════════════════════════════════ */

export interface Catatan {
  nada: 'baik' | 'awas' | 'buruk';
  teks: string;
}

const HARI = 86_400_000;

/** Pembacaan atas winrate + profit factor bersama-sama. */
export function bacaStatistik(s: Stat): Catatan | null {
  if (s.jumlah < 10) return null;
  const pf = s.faktorProfit;
  /* `winrate` bertipe nullable karena jurnal kosong tidak punya winrate.
     Di sini jumlahnya sudah pasti >= 10, jadi nilainya ada — tapi
     menuliskannya sekali lebih jelas daripada `!` di enam tempat. */
  const wr = s.winrate ?? 0;

  if (pf !== null && pf !== Infinity && pf < 1 && wr >= 60) {
    return {
      nada: 'buruk',
      teks: `Sering menang (${wr.toFixed(0)}%) tapi profit factor ${pf.toFixed(2)} — rata-rata kalahmu lebih besar daripada rata-rata menang. Ini pola akun yang habis perlahan meski terasa "lebih banyak benar".`,
    };
  }
  if (pf !== null && pf < 1) {
    return {
      nada: 'buruk',
      teks: `Profit factor ${pf === Infinity ? '∞' : pf.toFixed(2)} di bawah 1 — total rugi melampaui total untung. Yang perlu dilihat dulu bukan winrate, melainkan ukuran rugi per transaksi.`,
    };
  }
  if (wr < 40 && pf !== null && pf >= 1.3) {
    return {
      nada: 'baik',
      teks: `Winrate ${wr.toFixed(0)}% terlihat rendah, tapi profit factor ${pf === Infinity ? '∞' : pf.toFixed(2)} berarti yang menang jauh lebih besar daripada yang kalah. Pola ini normal untuk pendekatan mengikuti tren.`,
    };
  }
  if (pf !== null && pf >= 1.5) {
    return {
      nada: 'baik',
      teks: `Profit factor ${pf === Infinity ? '∞' : pf.toFixed(2)} dengan winrate ${wr.toFixed(0)}% — untung dan rugi berimbang sehat. Yang menjaga ini tetap begitu adalah ukuran risiko yang tidak berubah-ubah.`,
    };
  }
  return {
    nada: 'awas',
    teks: `Profit factor ${pf === null ? '—' : pf.toFixed(2)} masih di sekitar titik impas. Selisih sekecil ini gampang berbalik jadi minus begitu ada satu transaksi berukuran tidak biasa.`,
  };
}

/** Pembacaan atas P/L bersih: apa yang membuatnya begitu. */
export function bacaPnl(trade: Trade[], s: Stat): Catatan | null {
  if (s.jumlah < 10) return null;

  const rugi = trade.filter((t) => t.pnl < 0).map((t) => Math.abs(t.pnl));
  const untung = trade.filter((t) => t.pnl > 0).map((t) => t.pnl);

  /* Satu kerugian yang jauh di atas kebiasaan hampir selalu berarti ukuran
     lot yang dinaikkan, bukan pasar yang bergerak lebih jauh. */
  if (rugi.length >= 5) {
    const rerata = rugi.reduce((a, b) => a + b, 0) / rugi.length;
    const terbesar = Math.max(...rugi);
    if (terbesar > rerata * 4) {
      return {
        nada: 'buruk',
        teks: `Kerugian terbesarmu ${(terbesar / rerata).toFixed(1)}× rata-rata rugi biasanya. Selisih sebesar itu jarang datang dari pasar — biasanya dari lot yang dinaikkan di satu transaksi.`,
      };
    }
  }

  /* Terlalu banyak transaksi dalam satu hari. Median dipakai sebagai
     pembanding, bukan rata-rata: satu hari 40 transaksi menarik rata-rata
     naik sehingga hari itu sendiri terlihat wajar. */
  const perHari = new Map<string, number>();
  trade.forEach((t) => {
    const d = new Date(t.waktu);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    perHari.set(k, (perHari.get(k) ?? 0) + 1);
  });
  const hitung = [...perHari.values()].sort((a, b) => a - b);
  if (hitung.length >= 5) {
    const median = hitung[Math.floor(hitung.length / 2)] || 1;
    const puncak = hitung[hitung.length - 1];
    if (puncak >= median * 4 && puncak >= 8) {
      return {
        nada: 'awas',
        teks: `Ada hari dengan ${puncak} transaksi, sementara biasanya ${median}. Lonjakan sebesar ini biasanya balas dendam setelah rugi, bukan setup yang tiba-tiba banyak.`,
      };
    }
  }

  /* Satu kemenangan menopang seluruh hasil. */
  if (untung.length >= 5) {
    const total = untung.reduce((a, b) => a + b, 0);
    const terbesar = Math.max(...untung);
    if (total > 0 && terbesar / total > 0.4) {
      return {
        nada: 'awas',
        teks: `${((terbesar / total) * 100).toFixed(0)}% dari seluruh untungmu datang dari SATU transaksi. Tanpa transaksi itu hasilnya jauh berbeda — dan itu belum bisa disebut konsisten.`,
      };
    }
  }

  /* Transaksi tanpa alasan tertulis. */
  const tanpaAlasan = trade.filter((t) => !(t.alasan ?? '').trim()).length;
  if (tanpaAlasan / trade.length > 0.5) {
    return {
      nada: 'awas',
      teks: `${tanpaAlasan} dari ${trade.length} transaksi tanpa alasan tertulis. Yang tidak dicatat alasannya tidak bisa dievaluasi ulang — dan jurnal yang tidak bisa dievaluasi tidak melakukan apa pun.`,
    };
  }

  /* Frekuensi tinggi secara umum. */
  const rentang = trade.length > 1
    ? (Math.max(...trade.map((t) => t.waktu)) - Math.min(...trade.map((t) => t.waktu))) / HARI
    : 0;
  if (rentang >= 3 && trade.length / rentang > 20) {
    return {
      nada: 'awas',
      teks: `Rata-rata ${(trade.length / rentang).toFixed(0)} transaksi per hari. Pada frekuensi itu biaya dan spread jadi lawan terbesar, bukan arah pasarnya.`,
    };
  }

  return s.bersih >= 0
    ? {
        nada: 'baik',
        teks: `Hasil bersih ${s.bersih >= 0 ? 'positif' : 'negatif'} tanpa satu transaksi yang mendominasi dan tanpa lonjakan frekuensi. Ini bentuk hasil yang bisa diulang.`,
      }
    : {
        nada: 'awas',
        teks: 'Hasil bersih masih minus, tapi tidak ada satu sebab tunggal yang menonjol — perbaikannya ada di ukuran rugi rata-rata, bukan pada satu transaksi tertentu.',
      };
}
