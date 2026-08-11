import { ema, smiSeries, atr, findPivots, SMI_K, SMI_D, SMI_EMA, SMI_OB, SMI_OS } from '@/lib/jt-scan-core';
import type { Lilin } from '@/lib/pasar';

/* ════════════════════════════════════════════════════════════════════════
   MESIN BACKTEST
   ════════════════════════════════════════════════════════════════════════
   Memakai fungsi indikator yang SAMA dengan screener — `smiSeries`, `ema`,
   dan `atr` diimpor dari jt-scan-core, salinan verbatim milik V2. Kalau
   backtest memakai perhitungan sendiri, hasilnya akan berselisih dengan
   sinyal yang muncul di Screener Entry, dan tidak ada cara mengetahui mana
   yang benar.

   ASUMSI YANG DINYATAKAN TERBUKA, karena semua backtest berbohong kalau
   asumsinya disembunyikan:

     · Entry di harga OPEN lilin BERIKUTNYA setelah sinyal, bukan di close
       lilin sinyalnya. Masuk di close lilin yang baru saja menutup adalah
       hal yang tidak mungkin dilakukan, dan itulah sumber "hasil backtest
       bagus, live-nya jelek" yang paling umum.
     · SL dan TP diperiksa terhadap HIGH/LOW tiap lilin sesudahnya.
     · Kalau satu lilin menyentuh SL DAN TP sekaligus, yang dianggap kena
       adalah SL. Data harian tidak tahu mana yang lebih dulu, dan menebak
       yang menguntungkan akan membuat setiap hasil terlalu bagus.
     · Biaya per transaksi (spread + fee) dikurangkan dari tiap trade.
   ════════════════════════════════════════════════════════════════════════ */

export interface Setelan {
  /** Strategi: 'smi' = silang SMI dari zona jenuh, 'ema' = silang EMA. */
  strategi: 'smi' | 'ema';
  emaCepat: number;
  emaLambat: number;
  /** Jarak SL dalam kelipatan ATR. */
  slAtr: number;
  /** Rasio imbalan terhadap risiko. 2 = TP dua kali jarak SL. */
  rr: number;
  /** Modal awal untuk kurva ekuitas. */
  modal: number;
  /** Persen modal yang dipertaruhkan tiap transaksi. */
  risikoPersen: number;
  /** Biaya bolak-balik dalam persen dari nilai posisi. */
  biayaPersen: number;
}

export const SETELAN_BAWAAN: Setelan = {
  strategi: 'smi', emaCepat: 9, emaLambat: 21,
  slAtr: 1.5, rr: 2, modal: 1000, risikoPersen: 1, biayaPersen: 0.08,
};

export interface TradeUji {
  no: number;
  arah: 'BUY' | 'SELL';
  masukIdx: number;
  keluarIdx: number;
  masukWaktu: number;
  keluarWaktu: number;
  masuk: number;
  keluar: number;
  sl: number;
  tp: number;
  sebab: 'TP' | 'SL' | 'Akhir data';
  pnl: number;
  ekuitas: number;
}

export interface HasilUji {
  trade: TradeUji[];
  jumlah: number;
  menang: number;
  kalah: number;
  winrate: number;
  bersih: number;
  faktorProfit: number | null;
  drawdown: number;
  ekuitasAkhir: number;
  kurva: { waktu: number; nilai: number }[];
  /** Kenapa hasilnya kosong, kalau kosong. */
  catatan: string;
}

const KOSONG: HasilUji = {
  trade: [], jumlah: 0, menang: 0, kalah: 0, winrate: 0, bersih: 0,
  faktorProfit: null, drawdown: 0, ekuitasAkhir: 0, kurva: [], catatan: '',
};

/** Sinyal per lilin: 1 = beli, -1 = jual, 0 = diam. */
function sinyal(l: Lilin, s: Setelan): number[] {
  const n = l.closes.length;
  const keluar = new Array(n).fill(0);

  if (s.strategi === 'ema') {
    const cepat = ema(l.closes, s.emaCepat);
    const lambat = ema(l.closes, s.emaLambat);
    for (let i = 1; i < n; i++) {
      if (cepat[i - 1] == null || lambat[i - 1] == null || cepat[i] == null || lambat[i] == null) continue;
      const sebelum = cepat[i - 1] - lambat[i - 1];
      const kini = cepat[i] - lambat[i];
      if (sebelum <= 0 && kini > 0) keluar[i] = 1;
      else if (sebelum >= 0 && kini < 0) keluar[i] = -1;
    }
    return keluar;
  }

  /* SMI: silang %K terhadap garis EMA-nya, DAN hanya dari zona jenuh.
     Syarat kedua itu yang membedakannya dari osilator biasa — silang di
     tengah rentang terjadi puluhan kali dan hampir semuanya derau. */
  const smi = smiSeries(l.highs, l.lows, l.closes, SMI_K, SMI_D, SMI_EMA);
  const k = smi?.smi ?? [];
  /* Garis pembandingnya bernama `signal` di jt-scan-core, bukan `ema` —
     itu EMA dari SMI, dan namanya di sumber aslinya yang menentukan. */
  const e = smi?.signal ?? [];
  for (let i = 1; i < n; i++) {
    if (k[i - 1] == null || e[i - 1] == null || k[i] == null || e[i] == null) continue;
    const naik = k[i - 1] <= e[i - 1] && k[i] > e[i];
    const turun = k[i - 1] >= e[i - 1] && k[i] < e[i];
    if (naik && k[i - 1] < SMI_OS) keluar[i] = 1;
    else if (turun && k[i - 1] > SMI_OB) keluar[i] = -1;
  }
  return keluar;
}

export function jalankanUji(l: Lilin, s: Setelan): HasilUji {
  const n = l.closes.length;
  if (n < 60) return { ...KOSONG, catatan: `Butuh minimal 60 lilin, yang ada ${n}.` };

  const sig = sinyal(l, s);
  const atrArr = atr(l.highs, l.lows, l.closes, 14);

  const trade: TradeUji[] = [];
  const kurva: { waktu: number; nilai: number }[] = [{ waktu: l.times[0], nilai: s.modal }];
  let ekuitas = s.modal;
  let puncak = s.modal;
  let ddTerdalam = 0;
  let i = 1;

  while (i < n - 1) {
    const arah = sig[i];
    if (!arah) { i++; continue; }

    /* Masuk di OPEN lilin berikutnya. Lihat catatan asumsi di kepala berkas. */
    const masukIdx = i + 1;
    const masuk = l.opens[masukIdx];
    const a = atrArr[i];
    if (!isFinite(masuk) || !isFinite(a) || a <= 0) { i++; continue; }

    const jarakSl = a * s.slAtr;
    const sl = arah > 0 ? masuk - jarakSl : masuk + jarakSl;
    const tp = arah > 0 ? masuk + jarakSl * s.rr : masuk - jarakSl * s.rr;

    /* Ukuran posisi dari risiko, bukan dari modal penuh. Inilah yang membuat
       kurva ekuitasnya berarti: tiap transaksi mempertaruhkan persentase yang
       sama, persis seperti aturan yang dipakai di jurnal. */
    const risikoUang = ekuitas * (s.risikoPersen / 100);
    const unit = risikoUang / jarakSl;

    let keluarIdx = -1, keluarHarga = 0;
    let sebab: TradeUji['sebab'] = 'Akhir data';

    for (let j = masukIdx; j < n; j++) {
      const kenaSl = arah > 0 ? l.lows[j] <= sl : l.highs[j] >= sl;
      const kenaTp = arah > 0 ? l.highs[j] >= tp : l.lows[j] <= tp;
      /* SL diperiksa DULU — lihat catatan asumsi. */
      if (kenaSl) { keluarIdx = j; keluarHarga = sl; sebab = 'SL'; break; }
      if (kenaTp) { keluarIdx = j; keluarHarga = tp; sebab = 'TP'; break; }
    }
    if (keluarIdx < 0) { keluarIdx = n - 1; keluarHarga = l.closes[n - 1]; sebab = 'Akhir data'; }

    const kotor = (keluarHarga - masuk) * unit * (arah > 0 ? 1 : -1);
    const biaya = masuk * unit * (s.biayaPersen / 100);
    const pnl = kotor - biaya;

    ekuitas += pnl;
    puncak = Math.max(puncak, ekuitas);
    ddTerdalam = Math.max(ddTerdalam, puncak > 0 ? (puncak - ekuitas) / puncak : 0);

    trade.push({
      no: trade.length + 1,
      arah: arah > 0 ? 'BUY' : 'SELL',
      masukIdx, keluarIdx,
      masukWaktu: l.times[masukIdx], keluarWaktu: l.times[keluarIdx],
      masuk, keluar: keluarHarga, sl, tp, sebab, pnl, ekuitas,
    });
    kurva.push({ waktu: l.times[keluarIdx], nilai: ekuitas });

    /* Lanjut dari lilin SESUDAH posisi ditutup. Tanpa ini satu sinyal bisa
       membuka posisi baru tiap lilin selama trennya berlanjut, dan hasilnya
       menggandakan risiko yang tidak pernah benar-benar diambil. */
    i = keluarIdx + 1;
  }

  if (!trade.length) {
    return { ...KOSONG, kurva, ekuitasAkhir: s.modal, catatan: 'Tidak ada sinyal pada rentang ini. Coba timeframe lain atau strategi lain.' };
  }

  const menang = trade.filter((t) => t.pnl > 0);
  const kalah = trade.filter((t) => t.pnl <= 0);
  const untung = menang.reduce((a, t) => a + t.pnl, 0);
  const rugi = Math.abs(kalah.reduce((a, t) => a + t.pnl, 0));

  return {
    trade,
    jumlah: trade.length,
    menang: menang.length,
    kalah: kalah.length,
    winrate: (menang.length / trade.length) * 100,
    bersih: ekuitas - s.modal,
    faktorProfit: rugi > 0 ? untung / rugi : untung > 0 ? Infinity : null,
    drawdown: ddTerdalam * 100,
    ekuitasAkhir: ekuitas,
    kurva,
    catatan: '',
  };
}

/** Garis indikator untuk digambar di atas chart. */
export function garisIndikator(l: Lilin, s: Setelan) {
  if (s.strategi === 'ema') {
    return {
      cepat: ema(l.closes, s.emaCepat),
      lambat: ema(l.closes, s.emaLambat),
    };
  }
  return { cepat: null, lambat: null };
}

/* ════════════════════════════════════════════════════════════════════════
   LOGIKA SINYAL DI ATAS CHART
   ════════════════════════════════════════════════════════════════════════
   Zona SNR dan penanda SMI digambar dengan fungsi yang SAMA dengan screener
   (jt-scan-core), jadi yang terlihat di sini adalah zona yang sama persis
   dengan yang dipakai kartu sinyal — bukan versi mirip yang dihitung ulang.
   ════════════════════════════════════════════════════════════════════════ */

export interface Zona { nilai: number; atas: number; bawah: number }
export interface ZonaSnrPenuh { resisten: Zona | null; support: Zona | null; atr: number }

/** Zona SNR — SALINAN PERSIS logika `checkSnrRetestSignal` di screener V2.
 *
 *  Yang penting bukan "ada pivot di sini", melainkan ZONA di sekitar pivot
 *  terakhir: pivot ± 0,5 ATR. Itulah yang digambar kartu Area Pantau sebagai
 *  pita, dan itulah yang dipakai menilai sentuhan — sebuah garis tunggal
 *  tidak pernah tersentuh persis, jadi memakai garis membuat separuh sinyal
 *  hilang tanpa sebab yang terlihat.
 *
 *  Pivot kiri/kanan 10, bukan 5. Angka itu bukan selera: dengan 5, riak kecil
 *  ikut terhitung pivot dan zonanya berpindah tiap beberapa bar.
 */
export function zonaSnr(l: Lilin, batasIdx?: number): ZonaSnrPenuh {
  const n = batasIdx === undefined ? l.closes.length : Math.min(l.closes.length, batasIdx + 1);
  const kosong: ZonaSnrPenuh = { resisten: null, support: null, atr: 0 };
  if (n < 30) return kosong;

  const highs = l.highs.slice(0, n);
  const lows = l.lows.slice(0, n);
  const closes = l.closes.slice(0, n);

  const puncak = findPivots(highs, 10, 10, true) as { index: number; value: number }[];
  const lembah = findPivots(lows, 10, 10, false) as { index: number; value: number }[];
  const a = atr(highs, lows, closes, 14)[n - 1];
  if (!isFinite(a) || a <= 0) return kosong;

  const tol = a * 0.5;
  const buat = (p?: { value: number }): Zona | null =>
    p ? { nilai: p.value, atas: p.value + tol, bawah: p.value - tol } : null;

  return {
    resisten: buat(puncak[puncak.length - 1]),
    support: buat(lembah[lembah.length - 1]),
    atr: a,
  };
}

/** Garis SMI untuk panel bawah — dikembalikan sebagai deret biasa supaya
 *  penggambarnya tidak perlu tahu apa pun tentang cara menghitungnya. */
export function deretSmi(l: Lilin) {
  const s = smiSeries(l.highs, l.lows, l.closes, SMI_K, SMI_D, SMI_EMA);
  return { smi: s?.smi ?? [], signal: s?.signal ?? [] };
}
