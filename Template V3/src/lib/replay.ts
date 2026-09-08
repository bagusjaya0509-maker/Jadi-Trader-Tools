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
  /** Emosi & alasan yang diisi di tiket — ikut tercatat ke jurnal. */
  emosi?: string;
  alasan?: string;
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
  /** Catatan evaluasi SESUDAH trade selesai — diisi di panel replay, bukan
   *  di tiket. `emosi`/`alasan` dari tiket adalah keadaan SEBELUM masuk;
   *  yang di sini penilaian sesudah tahu hasilnya. Keduanya disimpan
   *  karena justru selisihnya yang mengajari. */
  evaluasi?: string;
  emosiEvaluasi?: string;
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
  /** Catatan sesi — pelajaran dari keseluruhan latihan, bukan per trade. */
  catatan?: string;
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
      catatan: typeof s.catatan === 'string' ? s.catatan : '',
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

/* ════════════════════════════════════════════════════════════════════════
   ANALISA LATIHAN
   ════════════════════════════════════════════════════════════════════════
   Semua angka di panel jurnal latihan dihitung di sini, dari daftar trade
   yang sama — bukan dari state tampilan. Panelnya tinggal menggambar.

   Dihitung ulang tiap render, dan itu sengaja: sesi latihan puluhan trade,
   bukan ribuan, dan satu fungsi murni lebih mudah diuji daripada memo yang
   harus diberi tahu kapan ia basi.
   ════════════════════════════════════════════════════════════════════════ */

/** Pilihan emosi yang sama dengan tiket order (pojok-order.tsx). Ditulis di
 *  sini, bukan diimpor dari lib/emosi-posisi.ts: berkas itu mengimpor
 *  Firestore dan auth, dan panel replay ada di jalur muat awal halaman Chart. */
export const EMOSI_LATIHAN = ['Netral', 'Percaya Diri', 'Tenang', 'Ragu-ragu', 'FOMO', 'Panik', 'Balas Dendam'] as const;

export interface TitikEkuitas { no: number; ekuitas: number; waktu: number }

export interface KelompokReplay {
  nama: string;
  jumlah: number;
  menang: number;
  winrate: number;
  bersih: number;
}

export interface AnalisaReplay {
  /** Dimulai dari modal (no 0) supaya kurvanya punya titik awal. */
  kurva: TitikEkuitas[];
  puncak: number;
  lembah: number;
  /** Persen penurunan terdalam dari puncak ekuitas sebelumnya. */
  drawdownMaks: number;
  rataMenang: number;
  rataKalah: number;
  /** Dolar yang diharapkan per trade = winrate×rataMenang − lossrate×rataKalah. */
  ekspektasi: number;
  rasioRataRata: number | null;
  terbaik: TradeReplay | null;
  terburuk: TradeReplay | null;
  beruntunMenang: number;
  beruntunKalah: number;
  /** Rata-rata bar yang ditahan dari masuk sampai keluar. */
  rataBar: number;
  perArah: KelompokReplay[];
  perSebab: KelompokReplay[];
  /** Emosi SAAT MASUK dari tiket. Yang tidak mengisi dikelompokkan sebagai
   *  "Tidak dicatat" — bukan "Netral", karena tidak menulis bukan berarti
   *  tenang. */
  perEmosi: KelompokReplay[];
}

function kelompokkan(trade: TradeReplay[], kunci: (t: TradeReplay) => string): KelompokReplay[] {
  const peta = new Map<string, TradeReplay[]>();
  for (const t of trade) {
    const k = kunci(t);
    if (!peta.has(k)) peta.set(k, []);
    peta.get(k)!.push(t);
  }
  return [...peta.entries()].map(([nama, d]) => {
    const menang = d.filter((t) => t.pnl > 0).length;
    return {
      nama, jumlah: d.length, menang,
      winrate: d.length ? (menang / d.length) * 100 : 0,
      bersih: d.reduce((s, t) => s + t.pnl, 0),
    };
  }).sort((a, b) => b.jumlah - a.jumlah);
}

export function analisaReplay(trade: TradeReplay[], modal: number): AnalisaReplay {
  const urut = [...trade].sort((a, b) => a.no - b.no);
  const kurva: TitikEkuitas[] = [{ no: 0, ekuitas: modal, waktu: urut[0]?.masukWaktu ?? 0 }];
  let ekuitas = modal, puncak = modal, lembah = modal, ddMaks = 0;
  let runM = 0, runK = 0, maksM = 0, maksK = 0;
  for (const t of urut) {
    ekuitas += t.pnl;
    kurva.push({ no: t.no, ekuitas, waktu: t.keluarWaktu });
    if (ekuitas > puncak) puncak = ekuitas;
    if (ekuitas < lembah) lembah = ekuitas;
    const dd = puncak > 0 ? ((puncak - ekuitas) / puncak) * 100 : 0;
    if (dd > ddMaks) ddMaks = dd;
    if (t.pnl > 0) { runM += 1; runK = 0; } else { runK += 1; runM = 0; }
    maksM = Math.max(maksM, runM); maksK = Math.max(maksK, runK);
  }
  const menang = urut.filter((t) => t.pnl > 0);
  const kalah = urut.filter((t) => t.pnl <= 0);
  const rataMenang = menang.length ? menang.reduce((s, t) => s + t.pnl, 0) / menang.length : 0;
  const rataKalah = kalah.length ? Math.abs(kalah.reduce((s, t) => s + t.pnl, 0) / kalah.length) : 0;
  const pMenang = urut.length ? menang.length / urut.length : 0;
  const ekspektasi = pMenang * rataMenang - (1 - pMenang) * rataKalah;
  const rataBar = urut.length
    ? urut.reduce((s, t) => s + Math.max(0, t.keluarIdx - t.masukIdx), 0) / urut.length
    : 0;
  return {
    kurva, puncak, lembah, drawdownMaks: ddMaks,
    rataMenang, rataKalah, ekspektasi,
    rasioRataRata: rataKalah > 0 ? rataMenang / rataKalah : null,
    terbaik: urut.length ? urut.reduce((a, t) => (t.pnl > a.pnl ? t : a)) : null,
    terburuk: urut.length ? urut.reduce((a, t) => (t.pnl < a.pnl ? t : a)) : null,
    beruntunMenang: maksM, beruntunKalah: maksK, rataBar,
    perArah: kelompokkan(urut, (t) => t.arah),
    perSebab: kelompokkan(urut, (t) => (t.sebab === 'Manual' ? 'Tutup manual' : 'Kena ' + t.sebab)),
    perEmosi: kelompokkan(urut, (t) => t.emosi || 'Tidak dicatat'),
  };
}

/** Sesi latihan lain yang tersimpan di perangkat ini — untuk daftar
 *  "sesi lain" di panel, supaya latihan di simbol/TF berbeda tidak hilang
 *  dari pandangan. Cuma yang punya trade; sesi kosong bukan riwayat. */
export interface RingkasSesi { simbol: string; tf: string; jumlah: number; bersih: number; modal: number }

export function daftarSesi(): RingkasSesi[] {
  const hasil: RingkasSesi[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? '';
      if (!k.startsWith(AWALAN)) continue;
      const sisa = k.slice(AWALAN.length);
      const titik = sisa.lastIndexOf('.');
      if (titik < 0) continue;
      const simbol = sisa.slice(0, titik), tf = sisa.slice(titik + 1);
      const s = bacaSesi(simbol, tf);
      if (!s || !s.trade.length) continue;
      hasil.push({ simbol, tf, jumlah: s.trade.length, bersih: s.trade.reduce((a, t) => a + t.pnl, 0), modal: s.modal });
    }
  } catch { /* privat */ }
  return hasil.sort((a, b) => b.jumlah - a.jumlah);
}


/* ── Setelan halaman Chart ───────────────────────────────────────────────
   Simbol, timeframe, indikator yang menyala, dan setelan backtest bertahan
   setelah refresh. Membuka halaman lalu harus memilih ulang BTCUSDT, 4 jam,
   centang SNR, centang SMI — tiap kali — adalah pekerjaan yang tidak pernah
   menghasilkan apa pun.

   Di localStorage, bukan Firestore: ini preferensi tampilan perangkat ini,
   dan menyimpannya di server berarti satu tulisan tiap kali dropdown
   disentuh. */
export interface SetelanChart {
  simbol: string;
  tf: string;
  snr: boolean;
  smi: boolean;
  /** Overlay EMA di panel harga. */
  ema?: boolean;
  /** Periode KETIGA garis EMA, selalu tiga angka — termasuk yang sedang
   *  tidak digambar. Lihat `emaJumlah`. */
  emaPeriode?: number[];
  /** Warna ketiga garis, hex. Selalu tiga, sama seperti periodenya. */
  emaWarna?: string[];
  /** Tebal ketiga garis dalam piksel (1–4). */
  emaTebal?: number[];
  /** Berapa dari ketiga periode itu yang digambar (1–3).
   *
   *  Bentuk pertama tidak punya medan ini: panjang lariknya yang dianggap
   *  jumlahnya, supaya tidak ada dua medan yang bisa berselisih. Itu terbukti
   *  salah saat diuji di peramban — menurunkan jumlahnya MEMOTONG lariknya,
   *  jadi periode yang sudah diketik lenyap dan menaikkannya lagi
   *  mengembalikan bawaan, bukan angka orangnya.
   *
   *  Dua medan ini tidak bisa berselisih seperti yang dulu ditakutkan:
   *  lariknya selalu tiga (dipadkan saat dibaca), dan medan ini cuma
   *  memilih berapa yang dipakai. Tidak ada panjang yang perlu disepakati. */
  emaJumlah?: number;
}

const KUNCI_SETELAN = 'jt.chartSetelan';

export function bacaSetelanChart(): Partial<SetelanChart> {
  try { return JSON.parse(localStorage.getItem(KUNCI_SETELAN) ?? '{}'); }
  catch { return {}; }
}

export function simpanSetelanChart(s: SetelanChart) {
  try { localStorage.setItem(KUNCI_SETELAN, JSON.stringify(s)); }
  catch { /* mode privat — setelan cukup hidup di halaman ini */ }
}
