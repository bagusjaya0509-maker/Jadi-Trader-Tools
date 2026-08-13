import type { OrderBursa } from '@/lib/admin';

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

export function cariStopNyasar(
  stop: OrderBursa[],
  posisi: { simbol: string; jumlah: number }[],
  pending: { simbol: string }[],
): StopNyasar[] {
  const hasil: StopNyasar[] = [];
  const simbol = [...new Set(stop.map((s) => s.simbol))];

  for (const sim of simbol) {
    const milik = stop.filter((s) => s.simbol === sim && (s.jenis === 'SL' || s.jenis === 'TP'));
    if (!milik.length) continue;
    const pos = posisi.find((p) => p.simbol === sim);
    const adaPending = pending.some((o) => o.simbol === sim);

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

    for (const jenis of ['SL', 'TP'] as const) {
      /* Terbaru dulu — "pakai yang terbaru, hapus yang lama". */
      const sejenis = milik.filter((s) => s.jenis === jenis).sort((a, b) => b.dibuat - a.dibuat);
      if (sejenis.length < 2) continue;
      let tertutup = 0;
      for (const o of sejenis) {
        if (tertutup >= pos.jumlah * 0.999) {
          hasil.push({
            order: o, sebab: 'tumpuk',
            ket: `${jenis} lama — sudah ada ${jenis} lebih baru yang menutupi seluruh posisi`,
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
