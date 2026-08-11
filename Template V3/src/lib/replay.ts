import { atr } from '@/lib/jt-scan-core';
import type { Lilin } from '@/lib/pasar';

/* ════════════════════════════════════════════════════════════════════════
   REPLAY — latihan eksekusi di atas data pasar sungguhan
   ════════════════════════════════════════════════════════════════════════
   Chart digambar sampai bar ke-N saja, lalu N digeser satu per satu. Yang
   membuatnya bermanfaat sebagai latihan bukan animasinya, melainkan bahwa
   kamu TIDAK BISA melihat bar berikutnya — sama seperti saat pasar sungguhan
   berjalan.

   Kenapa ini dipilih daripada mengambil chart TradingView: isi <iframe>
   lintas-domain tidak bisa dibaca halaman kita (aturan same-origin), jadi
   "menangkap" grafiknya mustahil secara teknis dan melanggar ketentuan
   layanan mereka kalau pun bisa. Data lilin dari proxy VPS sudah ada di
   tangan kita, dan itu sumber yang sama yang dipakai screener.

   POSISI MANUAL. Buy/sell dieksekusi di harga CLOSE bar yang sedang tampil —
   bar itu memang sudah selesai terbentuk, jadi harganya sah untuk dipakai.
   SL/TP diperiksa terhadap high/low bar-bar SESUDAHNYA, dan kalau satu bar
   menyentuh keduanya yang dianggap kena adalah SL. Alasannya sama dengan di
   mesin backtest: data lilin tidak tahu mana yang lebih dulu, dan menebak
   yang menguntungkan membuat setiap latihan terasa lebih mudah daripada
   pasar sebenarnya.
   ════════════════════════════════════════════════════════════════════════ */

export interface PosisiReplay {
  id: string;
  arah: 'BUY' | 'SELL';
  masukIdx: number;
  masuk: number;
  sl: number;
  tp: number;
  /** Ukuran dalam unit, dihitung dari risiko. */
  unit: number;
  risiko: number;
}

export interface TradeReplay extends PosisiReplay {
  no: number;
  keluarIdx: number;
  keluar: number;
  sebab: 'TP' | 'SL' | 'Manual';
  pnl: number;
  masukWaktu: number;
  keluarWaktu: number;
}

export const KECEPATAN = [
  { x: 1, ms: 1000 },
  { x: 2, ms: 500 },
  { x: 4, ms: 250 },
  { x: 10, ms: 100 },
  { x: 30, ms: 33 },
];

/** SL bawaan = 1,5 × ATR dari bar yang sedang tampil.
 *
 *  Angka mutlak tidak bisa jadi bawaan: 1,5 ATR itu $900 di BTC dan
 *  $0,0004 di SHIB. Yang menyeberang antar simbol cuma kelipatan ATR. */
export function usulSlTp(l: Lilin, idx: number, arah: 'BUY' | 'SELL', kaliAtr = 1.5, rr = 2) {
  const a = atr(l.highs, l.lows, l.closes, 14)[idx];
  const harga = l.closes[idx];
  if (!isFinite(a) || a <= 0 || !isFinite(harga)) return { sl: 0, tp: 0 };
  const jarak = a * kaliAtr;
  return arah === 'BUY'
    ? { sl: harga - jarak, tp: harga + jarak * rr }
    : { sl: harga + jarak, tp: harga - jarak * rr };
}

/** Apakah posisi tersentuh SL/TP pada bar `idx`? */
export function periksaKena(p: PosisiReplay, l: Lilin, idx: number): { kena: 'SL' | 'TP'; harga: number } | null {
  if (idx <= p.masukIdx) return null;
  const kenaSl = p.arah === 'BUY' ? l.lows[idx] <= p.sl : l.highs[idx] >= p.sl;
  const kenaTp = p.arah === 'BUY' ? l.highs[idx] >= p.tp : l.lows[idx] <= p.tp;
  /* SL diperiksa DULU — lihat catatan di kepala berkas. */
  if (p.sl > 0 && kenaSl) return { kena: 'SL', harga: p.sl };
  if (p.tp > 0 && kenaTp) return { kena: 'TP', harga: p.tp };
  return null;
}

export function hitungPnl(p: PosisiReplay, keluar: number, biayaPersen = 0.08) {
  const kotor = (keluar - p.masuk) * p.unit * (p.arah === 'BUY' ? 1 : -1);
  return kotor - p.masuk * p.unit * (biayaPersen / 100);
}

export interface RingkasReplay {
  jumlah: number;
  menang: number;
  winrate: number;
  bersih: number;
  faktorProfit: number | null;
  ekuitas: number;
}

export function ringkasReplay(trade: TradeReplay[], modal: number): RingkasReplay {
  const menang = trade.filter((t) => t.pnl > 0);
  const untung = menang.reduce((s, t) => s + t.pnl, 0);
  const rugi = Math.abs(trade.filter((t) => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0));
  const bersih = trade.reduce((s, t) => s + t.pnl, 0);
  return {
    jumlah: trade.length,
    menang: menang.length,
    winrate: trade.length ? (menang.length / trade.length) * 100 : 0,
    bersih,
    faktorProfit: rugi > 0 ? untung / rugi : untung > 0 ? Infinity : null,
    ekuitas: modal + bersih,
  };
}

/* ════════════════════════════════════════════════════════════════════════
   MENYIMPAN SESI REPLAY
   ════════════════════════════════════════════════════════════════════════
   Posisi yang sedang terbuka dan trade yang sudah tercatat bertahan setelah
   halaman disegarkan, dan hanya hilang kalau dihapus sendiri. Alasannya
   sederhana: menutup tab tidak seharusnya menghapus catatan latihan, sama
   seperti menutup tab tidak menghapus jurnal.

   Disimpan per SIMBOL + TIMEFRAME. Satu penyimpanan bersama akan membuat
   posisi BTC 4 jam muncul di chart ETH 5 menit, dan indeks barnya menunjuk
   waktu yang sama sekali berbeda.
   ════════════════════════════════════════════════════════════════════════ */

export interface SesiReplay {
  idx: number | null;
  posisi: PosisiReplay | null;
  trade: TradeReplay[];
  modal: number;
}

const AWALAN = 'jt.replay.';

const kunciSesi = (simbol: string, tf: string) => `${AWALAN}${simbol}.${tf}`;

export function bacaSesi(simbol: string, tf: string): SesiReplay | null {
  try {
    const mentah = localStorage.getItem(kunciSesi(simbol, tf));
    if (!mentah) return null;
    const s = JSON.parse(mentah);
    return {
      idx: typeof s.idx === 'number' ? s.idx : null,
      posisi: s.posisi ?? null,
      trade: Array.isArray(s.trade) ? s.trade : [],
      modal: Number(s.modal) || 1000,
    };
  } catch { return null; }
}

export function simpanSesi(simbol: string, tf: string, s: SesiReplay) {
  try { localStorage.setItem(kunciSesi(simbol, tf), JSON.stringify(s)); }
  catch { /* mode privat / kuota — sesi cukup hidup di memori halaman */ }
}

export function hapusSesi(simbol: string, tf: string) {
  try { localStorage.removeItem(kunciSesi(simbol, tf)); } catch { /* abaikan */ }
}
