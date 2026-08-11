import { ema, smiSeries, atr, findPivots, SMI_K, SMI_D, SMI_EMA } from '@/lib/jt-scan-core';
import type { Lilin } from '@/lib/pasar';

/* ════════════════════════════════════════════════════════════════════════
   PENERJEMAH PINE SCRIPT — SUBSET
   ════════════════════════════════════════════════════════════════════════
   Menjalankan sebagian Pine v5/v6 di atas data lilin yang sudah ada, lalu
   mengembalikan deret `plot()` untuk digambar di chart.

   YANG PERLU DIKATAKAN TERUS TERANG: ini BUKAN Pine yang lengkap. Pine punya
   model eksekusi per-bar dengan tipe `series`, `request.security`, ratusan
   fungsi bawaan, dan aturan riwayat (`[1]`) yang menyentuh hampir setiap
   ekspresi. Menirunya seluruhnya adalah proyek berbulan-bulan, dan hasilnya
   tetap akan berbeda dari TradingView di kasus-kasus pinggir — yang justru
   paling sering jadi sumber sengketa "kenapa hasilnya beda".

   Jadi yang dikerjakan di sini adalah bagian yang bisa dikerjakan DENGAN
   BENAR, dan sisanya DITOLAK DENGAN JELAS. Skrip yang memakai sesuatu di
   luar daftar dukungan akan menyebut baris dan namanya, bukan diam-diam
   menghasilkan angka yang salah. Backtest yang salah tanpa suara jauh lebih
   berbahaya daripada backtest yang menolak jalan.

   YANG DIDUKUNG
     · deklarasi   : indicator(...) / study(...) — dibaca lalu dilewati
     · variabel    : nama = ekspresi
     · sumber      : open, high, low, close, hl2, hlc3, ohlc4, volume(0)
     · aritmetika  : + - * / dan tanda kurung
     · perbandingan: > < >= <= == !=  (menghasilkan 1/0)
     · riwayat     : ekspresi[n]
     · ta.*        : sma, ema, rma, wma, atr, rsi, highest, lowest, change,
                     crossover, crossunder, stdev
     · lain        : math.abs/max/min, nz(), na
     · khusus JT   : jt.smi(), jt.smiSignal(), jt.pivotHigh(), jt.pivotLow()
     · keluaran    : plot(ekspresi, title=..., color=color.xxx)
                     hline(nilai, ...)

   Fungsi `ta.ema`, `ta.atr`, dan SMI memakai implementasi yang SAMA dengan
   screener (jt-scan-core), bukan salinan baru — supaya indikator yang
   ditempel di sini tidak berselisih dengan kartu sinyal.
   ════════════════════════════════════════════════════════════════════════ */

export type Deret = (number | null)[];

export interface PlotPine {
  judul: string;
  warna: string;
  nilai: Deret;
  /** true kalau nilainya cocok digambar di panel bawah (osilator). */
  osilator: boolean;
}

export interface HasilPine {
  plot: PlotPine[];
  hline: { nilai: number; warna: string }[];
  galat: string[];
  /** Baris yang dilewati karena tidak didukung — bukan kesalahan fatal. */
  dilewati: string[];
}

const WARNA: Record<string, string> = {
  red: '#f87171', green: '#10b981', blue: '#60a5fa', orange: '#fb923c',
  yellow: '#fbbf24', purple: '#a78bfa', white: '#fafafa', gray: '#a1a1aa',
  aqua: '#22d3ee', lime: '#84cc16', teal: '#2dd4bf', fuchsia: '#e879f9',
  maroon: '#b91c1c', navy: '#3b82f6', olive: '#a3a300', silver: '#d4d4d8',
};

const PALET_URUT = ['#fbbf24', '#60a5fa', '#10b981', '#f87171', '#a78bfa', '#22d3ee'];

/* ── Pembantu deret ──────────────────────────────────────────────────── */

const bersih = (d: Deret): number[] => d.map((x) => (x == null || !isFinite(x) ? NaN : x));

function geser(d: Deret, n: number): Deret {
  if (n <= 0) return d;
  return d.map((_, i) => (i - n >= 0 ? d[i - n] : null));
}

function petakan2(a: Deret, b: Deret, f: (x: number, y: number) => number): Deret {
  const n = Math.max(a.length, b.length);
  const out: Deret = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const x = a[i], y = b[i];
    if (x == null || y == null || !isFinite(x) || !isFinite(y)) continue;
    const r = f(x, y);
    out[i] = isFinite(r) ? r : null;
  }
  return out;
}

function konstanta(v: number, n: number): Deret {
  return new Array(n).fill(v);
}

function sma(d: Deret, p: number): Deret {
  const out: Deret = new Array(d.length).fill(null);
  let jum = 0, hitung = 0;
  const antre: number[] = [];
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    if (v == null || !isFinite(v)) { antre.length = 0; jum = 0; hitung = 0; continue; }
    antre.push(v); jum += v; hitung++;
    if (hitung > p) { jum -= antre.shift()!; hitung--; }
    if (hitung === p) out[i] = jum / p;
  }
  return out;
}

function rma(d: Deret, p: number): Deret {
  /* Rata-rata bergerak Wilder — dipakai RSI dan ATR di Pine. BUKAN EMA:
     alfanya 1/p, bukan 2/(p+1), dan memakai EMA di sini membuat RSI
     berselisih beberapa poin dari TradingView. */
  const out: Deret = new Array(d.length).fill(null);
  let sebelum: number | null = null, jum = 0, hitung = 0;
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    if (v == null || !isFinite(v)) continue;
    if (sebelum === null) {
      jum += v; hitung++;
      if (hitung === p) { sebelum = jum / p; out[i] = sebelum; }
    } else {
      sebelum = (sebelum * (p - 1) + v) / p;
      out[i] = sebelum;
    }
  }
  return out;
}

function wma(d: Deret, p: number): Deret {
  const out: Deret = new Array(d.length).fill(null);
  const bobotTotal = (p * (p + 1)) / 2;
  for (let i = p - 1; i < d.length; i++) {
    let jum = 0, sah = true;
    for (let j = 0; j < p; j++) {
      const v = d[i - j];
      if (v == null || !isFinite(v)) { sah = false; break; }
      jum += v * (p - j);
    }
    if (sah) out[i] = jum / bobotTotal;
  }
  return out;
}

function ekstrem(d: Deret, p: number, cariMaks: boolean): Deret {
  const out: Deret = new Array(d.length).fill(null);
  for (let i = p - 1; i < d.length; i++) {
    let best: number | null = null, sah = true;
    for (let j = 0; j < p; j++) {
      const v = d[i - j];
      if (v == null || !isFinite(v)) { sah = false; break; }
      if (best === null || (cariMaks ? v > best : v < best)) best = v;
    }
    if (sah) out[i] = best;
  }
  return out;
}

function stdev(d: Deret, p: number): Deret {
  const rata = sma(d, p);
  const out: Deret = new Array(d.length).fill(null);
  for (let i = p - 1; i < d.length; i++) {
    const m = rata[i];
    if (m == null) continue;
    let jum = 0, sah = true;
    for (let j = 0; j < p; j++) {
      const v = d[i - j];
      if (v == null || !isFinite(v)) { sah = false; break; }
      jum += (v - m) ** 2;
    }
    if (sah) out[i] = Math.sqrt(jum / p);
  }
  return out;
}

function rsi(d: Deret, p: number): Deret {
  const naik: Deret = new Array(d.length).fill(null);
  const turun: Deret = new Array(d.length).fill(null);
  for (let i = 1; i < d.length; i++) {
    const a = d[i], b = d[i - 1];
    if (a == null || b == null) continue;
    naik[i] = Math.max(0, a - b);
    turun[i] = Math.max(0, b - a);
  }
  const rn = rma(naik, p), rt = rma(turun, p);
  return petakan2(rn, rt, (x, y) => (y === 0 ? 100 : 100 - 100 / (1 + x / y)));
}

/* ── Pengurai ekspresi ───────────────────────────────────────────────── */

class Pengurai {
  private teks = '';
  private pos = 0;
  constructor(private lingkup: Map<string, Deret>, private n: number, private l: Lilin) {}

  urai(teks: string): Deret {
    this.teks = teks;
    this.pos = 0;
    const d = this.banding();
    this.lewatiSpasi();
    if (this.pos < this.teks.length) throw new Error(`sisa yang tidak terbaca: "${this.teks.slice(this.pos)}"`);
    return d;
  }

  private lewatiSpasi() { while (this.pos < this.teks.length && /\s/.test(this.teks[this.pos])) this.pos++; }
  private lihat(s: string) { this.lewatiSpasi(); return this.teks.startsWith(s, this.pos); }
  private ambil(s: string) { if (this.lihat(s)) { this.pos += s.length; return true; } return false; }

  private banding(): Deret {
    let kiri = this.jumlah();
    for (;;) {
      this.lewatiSpasi();
      const op = ['>=', '<=', '==', '!=', '>', '<'].find((o) => this.lihat(o));
      if (!op) return kiri;
      this.pos += op.length;
      const kanan = this.jumlah();
      kiri = petakan2(kiri, kanan, (a, b) => {
        switch (op) {
          case '>': return a > b ? 1 : 0;
          case '<': return a < b ? 1 : 0;
          case '>=': return a >= b ? 1 : 0;
          case '<=': return a <= b ? 1 : 0;
          case '==': return a === b ? 1 : 0;
          default: return a !== b ? 1 : 0;
        }
      });
    }
  }

  private jumlah(): Deret {
    let kiri = this.kali();
    for (;;) {
      this.lewatiSpasi();
      if (this.ambil('+')) kiri = petakan2(kiri, this.kali(), (a, b) => a + b);
      else if (this.ambil('-')) kiri = petakan2(kiri, this.kali(), (a, b) => a - b);
      else return kiri;
    }
  }

  private kali(): Deret {
    let kiri = this.satuan();
    for (;;) {
      this.lewatiSpasi();
      if (this.ambil('*')) kiri = petakan2(kiri, this.satuan(), (a, b) => a * b);
      else if (this.ambil('/')) kiri = petakan2(kiri, this.satuan(), (a, b) => (b === 0 ? NaN : a / b));
      else return kiri;
    }
  }

  private satuan(): Deret {
    this.lewatiSpasi();
    if (this.ambil('-')) return petakan2(konstanta(0, this.n), this.satuan(), (a, b) => a - b);
    if (this.ambil('(')) {
      const d = this.banding();
      if (!this.ambil(')')) throw new Error('kurung tutup hilang');
      return this.riwayat(d);
    }

    /* Angka */
    const angka = /^-?\d+(\.\d+)?/.exec(this.teks.slice(this.pos));
    if (angka) { this.pos += angka[0].length; return this.riwayat(konstanta(Number(angka[0]), this.n)); }

    /* Nama / pemanggilan fungsi */
    const nama = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(this.teks.slice(this.pos));
    if (!nama) throw new Error(`tidak paham "${this.teks.slice(this.pos, this.pos + 20)}"`);
    this.pos += nama[0].length;
    const id = nama[0];

    if (this.lihat('(')) return this.riwayat(this.panggil(id));

    const v = this.lingkup.get(id);
    if (!v) throw new Error(`variabel "${id}" belum didefinisikan`);
    return this.riwayat(v);
  }

  /** `ekspresi[n]` — nilai n bar sebelumnya. */
  private riwayat(d: Deret): Deret {
    this.lewatiSpasi();
    if (!this.ambil('[')) return d;
    const isi = /^\d+/.exec(this.teks.slice(this.pos));
    if (!isi) throw new Error('indeks riwayat harus angka bulat');
    this.pos += isi[0].length;
    if (!this.ambil(']')) throw new Error('kurung siku tutup hilang');
    return geser(d, Number(isi[0]));
  }

  private argumen(): Deret[] {
    if (!this.ambil('(')) throw new Error('kurung buka hilang');
    const arg: Deret[] = [];
    if (this.ambil(')')) return arg;
    for (;;) {
      /* Argumen bernama (`title=...`) diabaikan di sini — plot() menanganinya
         sendiri sebelum ekspresi diurai. */
      arg.push(this.banding());
      if (this.ambil(',')) continue;
      if (this.ambil(')')) return arg;
      throw new Error('koma atau kurung tutup hilang');
    }
  }

  private bulat(d: Deret, namaFungsi: string): number {
    const v = d.find((x) => x != null);
    if (v == null || !isFinite(v)) throw new Error(`${namaFungsi}: panjang periode harus angka`);
    return Math.max(1, Math.round(v));
  }

  private panggil(id: string): Deret {
    const a = this.argumen();
    const n = this.n, l = this.l;
    const satu = () => a[0] ?? konstanta(NaN, n);

    switch (id) {
      case 'ta.sma': return sma(satu(), this.bulat(a[1], id));
      case 'ta.ema': return ema(bersih(satu()), this.bulat(a[1], id)) as Deret;
      case 'ta.rma': return rma(satu(), this.bulat(a[1], id));
      case 'ta.wma': return wma(satu(), this.bulat(a[1], id));
      case 'ta.rsi': return rsi(satu(), this.bulat(a[1], id));
      case 'ta.stdev': return stdev(satu(), this.bulat(a[1], id));
      case 'ta.highest': return ekstrem(satu(), this.bulat(a[1], id), true);
      case 'ta.lowest': return ekstrem(satu(), this.bulat(a[1], id), false);
      case 'ta.atr': return atr(l.highs, l.lows, l.closes, this.bulat(satu(), id)) as Deret;
      case 'ta.change': return petakan2(satu(), geser(satu(), a[1] ? this.bulat(a[1], id) : 1), (x, y) => x - y);
      case 'ta.crossover':
        return petakan2(
          petakan2(a[0], a[1], (x, y) => (x > y ? 1 : 0)),
          geser(petakan2(a[0], a[1], (x, y) => (x > y ? 1 : 0)), 1),
          (kini, lalu) => (kini === 1 && lalu === 0 ? 1 : 0)
        );
      case 'ta.crossunder':
        return petakan2(
          petakan2(a[0], a[1], (x, y) => (x < y ? 1 : 0)),
          geser(petakan2(a[0], a[1], (x, y) => (x < y ? 1 : 0)), 1),
          (kini, lalu) => (kini === 1 && lalu === 0 ? 1 : 0)
        );

      case 'math.abs': return satu().map((x) => (x == null ? null : Math.abs(x)));
      case 'math.max': return petakan2(a[0], a[1], (x, y) => Math.max(x, y));
      case 'math.min': return petakan2(a[0], a[1], (x, y) => Math.min(x, y));
      case 'nz': return satu().map((x) => (x == null || !isFinite(x) ? 0 : x));

      /* Fungsi khusus Jadi Trader — perhitungan yang SAMA dengan screener. */
      case 'jt.smi': return (smiSeries(l.highs, l.lows, l.closes, SMI_K, SMI_D, SMI_EMA)?.smi ?? []) as Deret;
      case 'jt.smiSignal': return (smiSeries(l.highs, l.lows, l.closes, SMI_K, SMI_D, SMI_EMA)?.signal ?? []) as Deret;
      case 'jt.pivotHigh': case 'jt.pivotLow': {
        const kiri = a[0] ? this.bulat(a[0], id) : 10;
        const kanan = a[1] ? this.bulat(a[1], id) : kiri;
        const tinggi = id === 'jt.pivotHigh';
        const p = findPivots(tinggi ? l.highs : l.lows, kiri, kanan, tinggi) as { index: number; value: number }[];
        /* Nilai pivot dibawa maju sampai pivot berikutnya — itulah yang
           membuatnya terlihat sebagai garis level, bukan titik terpencil. */
        const out: Deret = new Array(n).fill(null);
        let terakhir: number | null = null, ke = 0;
        for (let i = 0; i < n; i++) {
          while (ke < p.length && p[ke].index + kanan <= i) { terakhir = p[ke].value; ke++; }
          out[i] = terakhir;
        }
        return out;
      }

      default:
        throw new Error(`fungsi "${id}" belum didukung`);
    }
  }
}

/* ── Titik masuk ─────────────────────────────────────────────────────── */

const DILEWATI = /^\s*(\/\/|indicator\s*\(|study\s*\(|strategy\s*\(|import\s|\/\/@|$)/;
const OSILATOR = /rsi|smi|stoch|macd|momentum|osc/i;

export function jalankanPine(kode: string, l: Lilin): HasilPine {
  const n = l.closes.length;
  const lingkup = new Map<string, Deret>();
  const num = (a: number[]): Deret => a.map((x) => (isFinite(x) ? x : null));

  lingkup.set('open', num(l.opens));
  lingkup.set('high', num(l.highs));
  lingkup.set('low', num(l.lows));
  lingkup.set('close', num(l.closes));
  lingkup.set('hl2', petakan2(num(l.highs), num(l.lows), (a, b) => (a + b) / 2));
  lingkup.set('hlc3', petakan2(petakan2(num(l.highs), num(l.lows), (a, b) => a + b), num(l.closes), (a, b) => (a + b) / 3));
  lingkup.set('ohlc4', petakan2(
    petakan2(num(l.opens), num(l.highs), (a, b) => a + b),
    petakan2(num(l.lows), num(l.closes), (a, b) => a + b),
    (a, b) => (a + b) / 4
  ));
  /* `volume` disediakan sebagai nol, bukan dibiarkan tidak ada: proxy kita
     tidak mengirim volume, dan skrip yang memakainya harus GAGAL dengan
     jelas — bukan diam-diam memakai angka karangan. */
  lingkup.set('na', konstanta(NaN, n));

  const plot: PlotPine[] = [];
  const hline: { nilai: number; warna: string }[] = [];
  const galat: string[] = [];
  const dilewati: string[] = [];

  const baris = kode.split(/\r?\n/);
  baris.forEach((mentah, i) => {
    const b = mentah.replace(/\/\/.*$/, '').trim();
    if (!b || DILEWATI.test(mentah)) return;

    try {
      if (b.startsWith('plot(') || b.startsWith('hline(')) {
        const isHline = b.startsWith('hline(');
        const dalam = b.slice(b.indexOf('(') + 1, b.lastIndexOf(')'));
        /* Argumen dipecah di koma tingkat ATAS saja — koma di dalam kurung
           milik pemanggilan fungsi bersarang, bukan pemisah argumen plot. */
        const bagian: string[] = [];
        let dalamKurung = 0, mulai = 0;
        for (let k = 0; k < dalam.length; k++) {
          if (dalam[k] === '(') dalamKurung++;
          else if (dalam[k] === ')') dalamKurung--;
          else if (dalam[k] === ',' && dalamKurung === 0) { bagian.push(dalam.slice(mulai, k)); mulai = k + 1; }
        }
        bagian.push(dalam.slice(mulai));

        let judul = '', warna = '';
        const ekspresi = bagian[0].trim();
        bagian.slice(1).forEach((s) => {
          const j = /title\s*=\s*["']([^"']*)["']/.exec(s);
          if (j) judul = j[1];
          const w = /color\s*=\s*(?:color\.)?([a-z]+)/i.exec(s);
          if (w) warna = WARNA[w[1].toLowerCase()] ?? '';
        });

        const nilai = new Pengurai(lingkup, n, l).urai(ekspresi);
        if (isHline) {
          const v = nilai.find((x) => x != null);
          if (v != null) hline.push({ nilai: v, warna: warna || 'rgba(255,255,255,.2)' });
          return;
        }
        plot.push({
          judul: judul || ekspresi.slice(0, 24),
          warna: warna || PALET_URUT[plot.length % PALET_URUT.length],
          nilai,
          osilator: OSILATOR.test(judul || ekspresi),
        });
        return;
      }

      /* Penetapan variabel: `nama = ekspresi` atau `nama := ekspresi`. */
      const tugas = /^([A-Za-z_][A-Za-z0-9_]*)\s*:?=\s*(.+)$/.exec(b);
      if (tugas) {
        lingkup.set(tugas[1], new Pengurai(lingkup, n, l).urai(tugas[2]));
        return;
      }

      dilewati.push(`baris ${i + 1}: ${b.slice(0, 60)}`);
    } catch (e) {
      galat.push(`baris ${i + 1}: ${e instanceof Error ? e.message : 'gagal diurai'}`);
    }
  });

  return { plot, hline, galat, dilewati };
}

/** Contoh yang bisa langsung dijalankan — sekaligus dokumentasi hidup. */
export const CONTOH_PINE = `//@version=6
indicator("Contoh JT", overlay=true)

// EMA silang
cepat = ta.ema(close, 9)
lambat = ta.ema(close, 21)
plot(cepat, title="EMA 9", color=color.yellow)
plot(lambat, title="EMA 21", color=color.blue)

// Zona SNR dari pivot — perhitungan yang sama dengan Area Pantau
res = jt.pivotHigh(10, 10)
sup = jt.pivotLow(10, 10)
plot(res, title="Resisten", color=color.red)
plot(sup, title="Support", color=color.green)

// SMI di panel bawah
plot(jt.smi(), title="SMI", color=color.orange)
plot(jt.smiSignal(), title="SMI signal", color=color.aqua)
hline(50, color=color.gray)
hline(-50, color=color.gray)`;
