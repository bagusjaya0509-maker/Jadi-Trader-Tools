import type { OrderBursa } from '@/lib/admin';

/* ════════════════════════════════════════════════════════════════════════
   ORDER KRIPTO YANG MENUNGGU HARGA — satu penulisan untuk dua panel
   ════════════════════════════════════════════════════════════════════════
   Dipakai Dashboard DAN panel Posisi Terbuka di Chart & Entry. Sebelumnya
   keduanya memetakan sendiri-sendiri, dan hasilnya sudah menyimpang: yang
   di Chart menampilkan SL/TP beserta label "rencana", yang di Dashboard
   cuma qty dan harga. Dua panel berdampingan yang menjawab pertanyaan sama
   dengan isi berbeda memaksa orang menebak mana yang benar.

   ── KENAPA SL/TP HARUS DICARI, BUKAN DIBACA DARI ORDERNYA ───────────────
   Di Binance Futures, SL dan TP bukan bagian dari order entry. Keduanya
   order kondisional tersendiri yang menempel pada SIMBOL. Jadi baris
   pending tidak pernah membawa stopnya sendiri, dan sebelum pencarian ini
   ada kolomnya selalu kosong walau stopnya benar-benar terpasang — orang
   yang baru memasang SL lalu melihat kolom kosong wajar mengira
   pemasangannya gagal.

   ── DAN KENAPA ADA "RENCANA" ───────────────────────────────────────────
   Untuk entry yang BELUM terisi, di bursa memang belum ada stop apa pun:
   Binance menolak order reduceOnly selama posisinya belum ada. Rencananya
   ditulis lokal saat order dikirim, dan ditampilkan dengan label yang
   mengatakan itu. Angka tanpa keterangan terbaca sebagai stop yang sudah
   hidup di bursa — dan itu kebohongan yang baru ketahuan saat harganya
   lewat tanpa ada yang menahan.
   ════════════════════════════════════════════════════════════════════════ */

export interface BarisPending {
  kunci: string;
  simbol: string;
  arah: 'BUY' | 'SELL';
  /** Jumlah koin, sudah berformat Indonesia. */
  ukuran: string;
  /** "Limit", "STOP", dst — sudah dirapikan untuk dibaca. */
  jenis: string;
  harga: number;
  sl: number;
  tp: number;
  /** true = SL/TP-nya belum ada di bursa, baru catatan lokal. */
  rencana: boolean;
}

/** Rencana SL/TP order yang masih menggantung, dari catatan lokal.
 *
 *  Ditulis `kirimOrderNyata` saat ordernya berangkat, berikut liveOrderId
 *  dari jawaban Binance. Inilah satu-satunya tempat rencana itu hidup
 *  selama entry-nya belum terisi. */
export function rencanaLokal(): Map<string, { sl: number; tp: number }> {
  const peta = new Map<string, { sl: number; tp: number }>();
  try {
    const s = JSON.parse(localStorage.getItem('emaScreenerPrioritySim_v1') ?? '{}');
    for (const rec of Object.values<Record<string, unknown>>(s.positions ?? {})) {
      if (!rec || typeof rec !== 'object') continue;
      const id = rec.liveOrderId;
      if (id == null) continue;
      peta.set(String(id), { sl: Number(rec.sl) || 0, tp: Number(rec.tp1) || 0 });
    }
  } catch { /* localStorage privat/rusak — tampil tanpa rencana */ }
  return peta;
}

export function barisPendingKripto(
  pending: OrderBursa[],
  stop: OrderBursa[],
  rencana: Map<string, { sl: number; tp: number }>,
): BarisPending[] {
  return pending.map((o) => {
    /* Yang TERDEKAT ke harga entry yang ditampilkan. Satu simbol bisa punya
       beberapa stop hidup sekaligus (TP bertingkat, atau sisa perubahan yang
       gagal dibatalkan), dan memilih yang pertama ketemu berarti barisnya
       menampilkan stop milik rencana yang lain. */
    const dekat = (jenis: 'SL' | 'TP') => stop
      .filter((x) => x.simbol === o.simbol && x.jenis === jenis)
      .sort((a, b) => Math.abs(a.pemicu - o.harga) - Math.abs(b.pemicu - o.harga))[0];
    const sl = dekat('SL');
    const tp = dekat('TP');
    const rc = !sl && !tp ? rencana.get(String(o.id)) : undefined;
    return {
      kunci: o.id,
      simbol: o.simbol,
      arah: o.arah,
      ukuran: o.qty.toLocaleString('id-ID', { maximumFractionDigits: 4 }),
      jenis: o.tipe.replace('_MARKET', ' Stop').replace('LIMIT', 'Limit'),
      harga: o.pemicu || o.harga,
      sl: sl?.pemicu ?? rc?.sl ?? 0,
      tp: tp?.pemicu ?? rc?.tp ?? 0,
      rencana: !!rc,
    };
  });
}
