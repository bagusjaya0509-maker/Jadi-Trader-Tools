import {
  smiSeries, atr, detectParallelChannel, snrTouchH4M5,
  slFromSnrZone, mapLimited, pcUpperAt, pcLowerAt,
  SMI_K, SMI_D, SMI_EMA, SMI_OB, SMI_OS, PC_SIG_TOL_MULT, PC_SIG_FRESH,
} from '@/lib/jt-scan-core';
import { ambilKlines, ambilTickers, type Lilin } from '@/lib/pasar';
import { tierSimbol, type Tier } from '@/lib/simbol';

/* ════════════════════════════════════════════════════════════════════════
   PEMINDAI — orkestrasi di atas inti JTScan
   ════════════════════════════════════════════════════════════════════════
   Berkas ini TIDAK menghitung apa pun sendiri. Semua rumus — SMI, ATR,
   pivot, channel, sentuhan SNR, penempatan SL — dipanggil dari
   `jt-scan-core.ts`, yang salinan verbatim milik V2. Yang dikerjakan di
   sini cuma: ambil data, panggil rumusnya, susun jadi kartu.

   Pemisahan itu yang membuat V2 dan V3 tidak bisa memberi sinyal berbeda
   untuk koin yang sama. Begitu ada rumus yang ditulis ulang di sini,
   jaminan itu hilang.

   BATAS SERENTAK. Enam permintaan sekaligus, bukan seratus: proxy VPS
   membatasi 600 permintaan per menit per IP, dan memindai 120 koin × 2
   timeframe sekaligus akan menabrak batas itu dalam satu klik.
   ════════════════════════════════════════════════════════════════════════ */

const SERENTAK = 6;
const BATAS_LILIN = 200;

export type Arah = 'BUY' | 'SELL';
export type Kondisi = 'overbought' | 'oversold' | 'netral';

export interface SinyalPantau {
  simbol: string;
  arah: Arah;
  harga: number;
  ubah24j: number;
  smi: number;
  smiSinyal: number;
  kondisi: Kondisi;
  mulaiBalik: boolean;
  /** Sentuhan candle M5 pada zona SNR 4 jam. null = tidak menyentuh.
   *  `arah` ikut dibawa karena mode SNR H4 mensyaratkan sentuhannya searah
   *  dengan sinyal channel — resisten untuk SELL, support untuk BUY. */
  sentuh: { sisi: 'R' | 'S'; level: number; tolak: boolean; arah: Arah } | null;
  lebarZona: number;
  tf: string;
  tier: Tier;
}

export interface SinyalParallel extends SinyalPantau {
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  risikoPersen: number;
  /** Rail mana yang disentuh sebelum close balik ke dalam. */
  rail: 'atas' | 'bawah';
}

function terakhir<T>(a: T[]): T | undefined { return a[a.length - 1]; }

/** Salinan `cekSmiEkstrem` milik V2 — satu-satunya bagian yang tidak ada di
 *  jt-scan-core, karena di V2 ia hidup di badan halaman. Ambangnya tetap
 *  diambil dari inti (SMI_OB/SMI_OS), bukan ditulis ulang. */
function cekSmiEkstrem(l: Lilin) {
  const st = smiSeries(l.highs, l.lows, l.closes, SMI_K, SMI_D, SMI_EMA);
  const n = st.smi.length;
  const k = st.smi[n - 1], d = st.signal[n - 1], kPrev = st.smi[n - 2];
  if (k === null || k === undefined) return null;

  let kondisi: Kondisi | null = null;
  if (k <= SMI_OS) kondisi = 'oversold';
  else if (k >= SMI_OB) kondisi = 'overbought';
  if (!kondisi) return null;

  const arah: Arah = kondisi === 'oversold' ? 'BUY' : 'SELL';
  let mulaiBalik = false;
  if (kPrev !== null && kPrev !== undefined) {
    mulaiBalik = kondisi === 'oversold' ? k > kPrev : k < kPrev;
  }
  return { kondisi, arah, k, d, mulaiBalik };
}

/* ── Area Pantau ──────────────────────────────────────────────────────────
   Syaratnya persis logic V2: SMI ekstrem di TF terpilih, lalu diperiksa
   apakah candle 5 menit yang sedang berjalan sedang menyentuh zona SNR 4
   jam. Sentuhan itu TIDAK menggugurkan kartu kalau tidak terjadi — ia
   ditampilkan sebagai baris ceklist yang belum tercentang, supaya orang
   bisa melihat koin yang "hampir". */
async function satuPantau(
  simbol: string,
  tf: string,
  tickers: Record<string, { lastPrice: number; ubah24j: number }>
): Promise<SinyalPantau | null> {
  const l = await ambilKlines(simbol, tf, BATAS_LILIN);
  if (l.closes.length < 40) return null;

  const smi = cekSmiEkstrem(l);
  if (!smi) return null;   // belum ekstrem → belum layak dipantau

  const a = terakhir(atr(l.highs, l.lows, l.closes, 14)) || 0;
  if (!a) return null;

  const t = tickers[simbol];
  const harga = t?.lastPrice || terakhir(l.closes) || 0;
  if (!harga) return null;

  /* Zona SNR selalu dari 4 jam, walaupun kartunya sedang menampilkan TF
     lain. Itu bukan penyederhanaan: indikator Jadi Trader V3 memang
     mengambil zona lewat request.security(..., "240", ...) saat berada di
     TF kecil, jadi acuannya tetap besar. */
  const h4 = tf === '4h' ? l : await ambilKlines(simbol, '4h', BATAS_LILIN);
  const m5 = await ambilKlines(simbol, '5m', 3);
  let sentuh: SinyalPantau['sentuh'] = null;
  if (h4.closes.length >= 40 && m5.closes.length) {
    const i = m5.closes.length - 1;
    const hasil: any = snrTouchH4M5(h4, {
      open: m5.opens[i], high: m5.highs[i], low: m5.lows[i], close: m5.closes[i],
    });
    if (hasil) sentuh = { sisi: hasil.sisi, level: hasil.level, tolak: hasil.tolak, arah: hasil.arah };
  }

  return {
    simbol,
    arah: smi.arah,
    harga,
    ubah24j: t?.ubah24j ?? 0,
    smi: smi.k,
    smiSinyal: smi.d,
    kondisi: smi.kondisi,
    mulaiBalik: smi.mulaiBalik,
    sentuh,
    lebarZona: a * 0.5,
    tf,
    tier: tierSimbol(simbol),
  };
}

export async function pindaiPantau(simbol: string[], tf: string): Promise<SinyalPantau[]> {
  const tickers = await ambilTickers();
  const hasil = await mapLimited(simbol, SERENTAK, (s: string) => satuPantau(s, tf, tickers));
  return (hasil as any[])
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value as SinyalPantau)
    /* Yang SMI-nya sudah mulai berbalik ditaruh di atas: itu yang paling
       dekat dengan momen entry, dan daftar yang diurut abjad membuat
       orang memindai seluruh kolom untuk menemukannya. */
    .sort((a, b) => Number(b.mulaiBalik) - Number(a.mulaiBalik) || Math.abs(b.smi) - Math.abs(a.smi));
}

/* ── Parallel Signal ──────────────────────────────────────────────────────
   Sinyal terbit kalau harga MENYENTUH salah satu rail channel lalu close
   kembali ke dalam. Menunggu close inilah yang membedakannya dari breakout
   — tanpa syarat itu, setiap penembusan ikut terhitung sinyal pantulan. */
async function satuParallel(
  simbol: string,
  tf: string,
  wajibSnr: boolean,
  tickers: Record<string, { lastPrice: number; ubah24j: number }>
): Promise<SinyalParallel | null> {
  const l = await ambilKlines(simbol, tf, BATAS_LILIN);
  if (l.closes.length < 60) return null;

  const atrArr = atr(l.highs, l.lows, l.closes, 14);
  const a = terakhir(atrArr) || 0;
  if (!a) return null;

  const ch = detectParallelChannel(l.highs, l.lows, l.closes, atrArr, {});
  if (!ch) return null;

  const n = l.closes.length;
  const tol = a * PC_SIG_TOL_MULT;
  let rail: 'atas' | 'bawah' | null = null;
  let arah: Arah | null = null;

  /* Hanya beberapa candle terakhir yang dilihat (PC_SIG_FRESH). Sinyal dari
     sentuhan 50 candle lalu sudah tidak bisa dientry — menampilkannya cuma
     membuat daftar penuh peluang yang sudah lewat. */
  for (let i = n - 1; i >= Math.max(0, n - 1 - PC_SIG_FRESH); i--) {
    const bawah = pcLowerAt(ch, i);
    const atas = pcUpperAt(ch, i);
    if (l.lows[i] <= bawah + tol && l.closes[i] > bawah) { rail = 'bawah'; arah = 'BUY'; break; }
    if (l.highs[i] >= atas - tol && l.closes[i] < atas) { rail = 'atas'; arah = 'SELL'; break; }
  }
  if (!rail || !arah) return null;

  const t = tickers[simbol];
  const harga = t?.lastPrice || terakhir(l.closes) || 0;
  if (!harga) return null;

  const h4 = tf === '4h' ? l : await ambilKlines(simbol, '4h', BATAS_LILIN);
  const m5 = await ambilKlines(simbol, '5m', 3);
  let sentuh: SinyalPantau['sentuh'] = null;
  if (h4.closes.length >= 40 && m5.closes.length) {
    const i = m5.closes.length - 1;
    const hasil: any = snrTouchH4M5(h4, {
      open: m5.opens[i], high: m5.highs[i], low: m5.lows[i], close: m5.closes[i],
    });
    if (hasil) sentuh = { sisi: hasil.sisi, level: hasil.level, tolak: hasil.tolak, arah: hasil.arah };
  }
  /* Mode "Sinyal SNR H4" mensyaratkan sentuhan itu benar-benar terjadi DAN
     searah dengan sinyal channel. Channel BUY yang menyentuh resisten
     adalah dua sinyal yang saling melawan, bukan konfluensi. */
  if (wajibSnr && (!sentuh || sentuh.arah !== arah)) return null;

  const sl = slFromSnrZone(arah, harga, l.highs, l.lows, a);
  const risiko = Math.abs(harga - sl);
  if (!(risiko > 0)) return null;

  const st = smiSeries(l.highs, l.lows, l.closes, SMI_K, SMI_D, SMI_EMA);
  const k = terakhir(st.smi) ?? 0;
  const d = terakhir(st.signal) ?? 0;

  return {
    simbol,
    arah,
    harga,
    ubah24j: t?.ubah24j ?? 0,
    smi: k,
    smiSinyal: d,
    kondisi: k <= SMI_OS ? 'oversold' : k >= SMI_OB ? 'overbought' : 'netral',
    mulaiBalik: false,
    sentuh,
    lebarZona: a * 0.5,
    tf,
    tier: tierSimbol(simbol),
    entry: harga,
    sl,
    // TP1 = 1x risiko, TP2 = 2x — sama dengan V2.
    tp1: arah === 'BUY' ? harga + risiko : harga - risiko,
    tp2: arah === 'BUY' ? harga + risiko * 2 : harga - risiko * 2,
    risikoPersen: (risiko / harga) * 100,
    rail,
  };
}

export type ModeParallel = 'snrh4' | 'snr' | 'only';

export async function pindaiParallel(
  simbol: string[],
  tf: string,
  mode: ModeParallel
): Promise<SinyalParallel[]> {
  const tickers = await ambilTickers();
  /* Mode SNR H4 mengunci timeframe ke 4 jam — zona diambil dari sana, jadi
     memindai channel di TF lain lalu menyaringnya dengan zona 4 jam
     menghasilkan pasangan yang tidak pernah dimaksudkan indikatornya. */
  const tfPakai = mode === 'snrh4' ? '4h' : tf;
  const hasil = await mapLimited(simbol, SERENTAK,
    (s: string) => satuParallel(s, tfPakai, mode === 'snrh4', tickers));
  return (hasil as any[])
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value as SinyalParallel)
    .sort((a, b) => a.risikoPersen - b.risikoPersen);
}
