import { smiSeries, atr, findPivots, SMI_K, SMI_D, SMI_EMA } from '@/lib/jt-scan-core';
import type { Lilin } from '@/lib/pasar';
import {
  butuhPerBar, jalankanPineBar,
  type SegmenPine, type PenandaPine, type KotakPine, type IsianPine, type InputPine,
} from '@/lib/pine-bar';

export type { SegmenPine, PenandaPine, KotakPine, IsianPine, InputPine } from '@/lib/pine-bar';

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
  /** Dari mesin per-bar: trendline miring (line.new), label, dan kotak. */
  segmen?: SegmenPine[];
  penanda?: PenandaPine[];
  kotak?: KotakPine[];
  /** Isian antar-garis (linefill) — pewarna tengah channel paralel. */
  isian?: IsianPine[];
  /** input.* yang ditemukan skrip — bahan panel setelan ala TradingView. */
  input?: InputPine[];
}

const WARNA: Record<string, string> = {
  red: '#f87171', green: '#10b981', blue: '#60a5fa', orange: '#fb923c',
  yellow: '#fbbf24', purple: '#a78bfa', white: '#fafafa', gray: '#a1a1aa',
  aqua: '#22d3ee', lime: '#84cc16', teal: '#2dd4bf', fuchsia: '#e879f9',
  maroon: '#b91c1c', navy: '#3b82f6', olive: '#a3a300', silver: '#d4d4d8',
};

const PALET_URUT = ['#fbbf24', '#60a5fa', '#10b981', '#f87171', '#a78bfa', '#22d3ee'];

/* ── Pembantu deret ──────────────────────────────────────────────────── */

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

/* EMA yang TAHAN NULL — dipakai ta.ema untuk deret hasil ekspresi.
   ────────────────────────────────────────────────────────────────────────
   Implementasi scan-core menerima array angka murni (screener selalu
   mengumpankan closes utuh), tapi deret dari ekspresi Pine hampir selalu
   berawalan null: ta.highest(x, n) kosong di n-1 bar pertama, dan NaN yang
   masuk EMA scan-core menular ke SELURUH hasil. Di sini benihnya SMA dari p
   nilai sah pertama — persis aturan ta.ema di Pine. */
function emaDeret(d: Deret, p: number): Deret {
  const out: Deret = new Array(d.length).fill(null);
  const alfa = 2 / (p + 1);
  let sebelum: number | null = null, jum = 0, hitung = 0;
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    if (v == null || !isFinite(v)) continue;
    if (sebelum === null) {
      jum += v; hitung++;
      if (hitung === p) { sebelum = jum / p; out[i] = sebelum; }
    } else {
      sebelum = sebelum + alfa * (v - sebelum);
      out[i] = sebelum;
    }
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

    /* String — muncul sebagai judul/argumen input. Nilainya bukan deret,
       jadi di posisi ekspresi ia dibaca sebagai NaN yang sah: skrip yang
       menaruh string di tengah aritmetika memang tidak menghasilkan angka. */
    if (this.lihat('"') || this.lihat("'")) {
      const kutip = this.teks[this.pos];
      let j = this.pos + 1;
      while (j < this.teks.length && this.teks[j] !== kutip) j++;
      this.pos = j + 1;
      return this.riwayat(konstanta(NaN, this.n));
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

    if (id === 'true') return this.riwayat(konstanta(1, this.n));
    if (id === 'false') return this.riwayat(konstanta(0, this.n));
    /* Warna & enum tampilan yang nyasar ke posisi ekspresi (color.red,
       display.none, format.price) tidak menghentikan skrip — mereka bukan
       angka, dan NaN adalah jawaban paling jujur untuk itu. */
    if (/^(color|display|format|location|shape|size|plot\.style|hline\.style|line\.style|extend|xloc|yloc)\./.test(id)) {
      return this.riwayat(konstanta(NaN, this.n));
    }

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

  /* Melompati SATU nilai argumen tanpa menafsirkannya — dipakai untuk
     argumen bernama (minval=1, color=color.new(...)) yang tidak mengubah
     deret apa pun. Kurung dan string di dalamnya dihormati supaya koma
     milik pemanggilan bersarang tidak dikira pemisah argumen. */
  private lompatiNilai() {
    let dalam = 0;
    while (this.pos < this.teks.length) {
      const c = this.teks[this.pos];
      if (c === '"' || c === "'") {
        const kutip = c; this.pos++;
        while (this.pos < this.teks.length && this.teks[this.pos] !== kutip) this.pos++;
        this.pos++;
        continue;
      }
      if (c === '(' || c === '[') dalam++;
      else if (c === ')' || c === ']') { if (dalam === 0) return; dalam--; }
      else if (c === ',' && dalam === 0) return;
      this.pos++;
    }
  }

  private argumen(): Deret[] {
    if (!this.ambil('(')) throw new Error('kurung buka hilang');
    const arg: Deret[] = [];
    if (this.ambil(')')) return arg;
    for (;;) {
      this.lewatiSpasi();
      /* Argumen BERNAMA (title=, minval=, color=, display=) dilompati:
         semuanya metadata tampilan atau batasan editor, bukan angka yang
         mengubah deret. Menolaknya berarti menolak hampir semua skrip
         TradingView asli — yang selalu menulis argumen dengan nama. */
      const bernama = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.exec(this.teks.slice(this.pos));
      if (bernama) {
        this.pos += bernama[0].length;
        this.lompatiNilai();
        arg.push(konstanta(NaN, this.n));
      } else if (this.lihat('"') || this.lihat("'")) {
        /* String posisi (judul) — dicatat sebagai NaN; plot() membaca judul
           lewat jalur teksnya sendiri. */
        const kutip = this.teks[this.pos];
        let j = this.pos + 1;
        while (j < this.teks.length && this.teks[j] !== kutip) j++;
        this.pos = j + 1;
        arg.push(konstanta(NaN, this.n));
      } else {
        arg.push(this.banding());
      }
      if (this.ambil(',')) continue;
      if (this.ambil(')')) return arg;
      throw new Error('koma atau kurung tutup hilang');
    }
  }

  private bulat(d: Deret | undefined, namaFungsi: string): number {
    const v = d?.find((x) => x != null && isFinite(x));
    if (v == null || !isFinite(v)) throw new Error(`${namaFungsi}: panjang periode harus angka`);
    return Math.max(1, Math.round(v));
  }

  private panggil(id: string): Deret {
    const a = this.argumen();
    const n = this.n, l = this.l;
    const satu = () => a[0] ?? konstanta(NaN, n);

    switch (id) {
      case 'ta.sma': return sma(satu(), this.bulat(a[1], id));
      case 'ta.ema': return emaDeret(satu(), this.bulat(a[1], id));
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

      /* input.* mengembalikan nilai BAWAANNYA — di TradingView nilainya bisa
         diubah lewat dialog setelan; di sini dialognya adalah mengedit
         angka default-nya langsung di skrip. */
      case 'input': case 'input.int': case 'input.float': case 'input.bool':
      case 'input.source': case 'input.string': case 'input.timeframe':
        return satu();

      case 'math.round': return satu().map((x) => (x == null ? null : Math.round(x)));
      case 'math.floor': return satu().map((x) => (x == null ? null : Math.floor(x)));
      case 'math.ceil': return satu().map((x) => (x == null ? null : Math.ceil(x)));
      case 'math.sqrt': return satu().map((x) => (x == null || x < 0 ? null : Math.sqrt(x)));
      case 'math.pow': return petakan2(a[0], a[1], (x, y) => Math.pow(x, y));
      case 'math.avg': {
        let acc = a[0] ?? konstanta(NaN, n);
        for (let k = 1; k < a.length; k++) acc = petakan2(acc, a[k], (x, y) => x + y);
        return acc.map((x) => (x == null ? null : x / a.length));
      }
      case 'ta.cross':
        return petakan2(
          petakan2(a[0], a[1], (x, y) => (x > y ? 1 : 0)),
          geser(petakan2(a[0], a[1], (x, y) => (x > y ? 1 : 0)), 1),
          (kini, lalu) => (kini !== lalu ? 1 : 0)
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

/** `overlay=` dari deklarasi `indicator()` / `study()` / `strategy()`.
 *
 *  KENAPA INI PENTING: baris deklarasi selama ini DILEWATI mentah-mentah,
 *  jadi satu-satunya penentu "ini osilator atau bukan" adalah tebakan nama
 *  plot lewat regex di atas. Regex itu tidak punya batas kata — judul yang
 *  memuat "osc" atau "smi" di tengah kata pun ikut kena — dan akibatnya
 *  indikator OVERLAY seperti Jadi Trader V3 dianggap punya osilator, lalu
 *  merebut panel bawah dari SMI yang sedang dipakai orangnya.
 *
 *  Skripnya sendiri sudah menyatakan tempatnya. Membacanya jauh lebih
 *  benar daripada menebak dari nama.
 *
 *  null = tidak dinyatakan; pemanggil boleh kembali menebak. */
function bacaOverlay(kode: string): boolean | null {
  const m = /^\s*(?:indicator|study|strategy)\s*\(([\s\S]*?)\)\s*$/m.exec(kode);
  if (!m) return null;
  const o = /overlay\s*=\s*(true|false)/i.exec(m[1]);
  return o ? o[1].toLowerCase() === 'true' : null;
}

/** Apakah satu plot digambar di panel bawah.
 *
 *  overlay=true  -> TIDAK PERNAH, apa pun namanya.
 *  overlay=false -> selalu, karena itu memang maksud skripnya.
 *  tidak dinyatakan -> tebak dari namanya, seperti sebelumnya. */
function apaOsilator(overlay: boolean | null, judul: string): boolean {
  if (overlay === true) return false;
  if (overlay === false) return true;
  return OSILATOR.test(judul);
}

export function jalankanPine(kode: string, l: Lilin, tf = '4h',
                             setelan?: Record<string, number | boolean | string>): HasilPine {
  /* ── Dua mesin, satu pintu ─────────────────────────────────────────
     Skrip dengan `if`/`for`/`var`/`:=`/array/line.new memakai model
     eksekusi per-bar milik Pine — model vektor di bawah tidak akan pernah
     menjalankannya dengan benar, cuma menolaknya baris demi baris.
     Skrip semacam itu dialihkan ke mesin per-bar; skrip indikator
     sederhana tetap lewat jalur vektor yang lebih cepat. */
  const overlay = bacaOverlay(kode);
  if (butuhPerBar(kode)) {
    const h = jalankanPineBar(kode, l, tf, setelan ?? {});
    return {
      plot: h.plotSeri.map((p) => ({
        judul: p.judul, warna: p.warna, nilai: p.nilai,
        osilator: apaOsilator(overlay, p.judul),
      })),
      hline: h.hline,
      galat: h.galat,
      dilewati: h.dilewati,
      segmen: h.segmen,
      penanda: h.penanda,
      kotak: h.kotak,
      isian: h.isian,
      input: h.input,
    };
  }

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

  /* ── Penyambung baris ────────────────────────────────────────────────
     Skrip TradingView asli membiarkan pemanggilan panjang melipat ke bawah
     (fill(a, b,\n  color = ...)). Baris dengan kurung yang belum seimbang
     digabung dengan baris berikutnya sebelum diurai — tanpa ini setiap
     potongan lanjutannya jadi satu galat yang membingungkan. */
  const mentahSemua = kode.split(/\r?\n/);
  const baris: { teks: string; no: number }[] = [];
  for (let i = 0; i < mentahSemua.length; i++) {
    let t = mentahSemua[i];
    const no = i + 1;
    const hitung = (s: string) => {
      let d = 0, dalamStr: string | null = null;
      for (const c of s.replace(/\/\/.*$/, '')) {
        if (dalamStr) { if (c === dalamStr) dalamStr = null; continue; }
        if (c === '"' || c === "'") dalamStr = c;
        else if (c === '(' || c === '[') d++;
        else if (c === ')' || c === ']') d--;
      }
      return d;
    };
    let saldo = hitung(t);
    while (saldo > 0 && i + 1 < mentahSemua.length) {
      i++;
      t += ' ' + mentahSemua[i].trim();
      saldo += hitung(mentahSemua[i]);
    }
    baris.push({ teks: t, no });
  }

  /* Baris GAMBAR & PERINGATAN dilewati tanpa dianggap galat: fill, bgcolor,
     plotshape, line.new, label, box, table, alert — semuanya kosmetik atau
     di luar kemampuan panel harga kita. Skrip yang memakainya tetap jalan;
     garisnya saja yang tidak ikut. */
  const HANYA_GAMBAR = /^(fill|bgcolor|plotshape|plotchar|plotcandle|plotbar|barcolor|bgFill|alertcondition|alert|line\.|label\.|box\.|table\.|array\.|matrix\.|strategy\.)/;

  baris.forEach(({ teks: mentah, no: nomorBaris }) => {
    const i = nomorBaris - 1;
    void i;
    let b = mentah.replace(/\/\/.*$/, '').trim();
    if (!b || DILEWATI.test(mentah)) return;

    /* `var float x = ...`, `float x = ...` — kata kunci deklarasi dilepas;
       yang penting namanya dan ekspresinya. */
    b = b.replace(/^var\s+/, '').replace(/^(float|int|bool|color|string|series\s+float|series\s+int)\s+(?=[A-Za-z_])/, '');

    try {
      if (HANYA_GAMBAR.test(b)) {
        dilewati.push(`baris ${nomorBaris}: ${b.slice(0, 48)} — perintah gambar/peringatan, dilewati`);
        return;
      }

      /* `x = plot(...)` dan `x = hline(...)` — di Pine hasilnya objek plot
         yang dipakai fill(); fill dilewati, jadi variabelnya cukup dicatat
         sebagai nilai hline/NaN supaya baris berikutnya tidak tersandung. */
      const tugasPlot = /^([A-Za-z_][A-Za-z0-9_]*)\s*:?=\s*(plot|hline)\s*\(/.exec(b);
      if (tugasPlot) {
        lingkup.set(tugasPlot[1], konstanta(NaN, n));
        b = b.slice(b.indexOf('=') + 1).trim();
      }

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

        let judul = '', warna = '', sembunyi = false;
        const ekspresi = bagian[0].trim();
        bagian.slice(1).forEach((s) => {
          const st = s.trim();
          /* Judul boleh bernama (title="SMI") ATAU posisi ("SMI"). */
          const j = /title\s*=\s*["']([^"']*)["']/.exec(st);
          if (j) judul = j[1];
          else if (/^["'][^"']*["']$/.test(st) && !judul) judul = st.slice(1, -1);
          /* Warna: color.red, color=color.red, color=color.new(color.red, 40),
             color=#26a69a — semuanya bentuk yang benar-benar dipakai orang. */
          const w = /color\s*[=(]\s*(?:color\.new\s*\(\s*)?color\.([a-z]+)/i.exec(st)
                 ?? /^color\.([a-z]+)$/i.exec(st);
          if (w) warna = WARNA[w[1].toLowerCase()] ?? warna;
          const hex = /color\s*=\s*(#[0-9a-fA-F]{6})/.exec(st);
          if (hex) warna = hex[1];
          if (/display\s*=\s*display\.none/.test(st)) sembunyi = true;
        });
        /* plot(x, display=display.none) memang MINTA tidak digambar. */
        if (sembunyi) return;

        const nilai = new Pengurai(lingkup, n, l).urai(ekspresi);
        if (isHline) {
          const v = nilai.find((x) => x != null && isFinite(x));
          if (v != null) hline.push({ nilai: v, warna: warna || 'rgba(255,255,255,.2)' });
          return;
        }
        plot.push({
          judul: judul || ekspresi.slice(0, 24),
          warna: warna || PALET_URUT[plot.length % PALET_URUT.length],
          nilai,
          osilator: apaOsilator(overlay, judul || ekspresi),
        });
        return;
      }

      /* Penetapan variabel: `nama = ekspresi` atau `nama := ekspresi`. */
      const tugas = /^([A-Za-z_][A-Za-z0-9_]*)\s*:?=\s*(.+)$/.exec(b);
      if (tugas) {
        lingkup.set(tugas[1], new Pengurai(lingkup, n, l).urai(tugas[2]));
        return;
      }

      dilewati.push(`baris ${nomorBaris}: ${b.slice(0, 60)}`);
    } catch (e) {
      galat.push(`baris ${nomorBaris}: ${e instanceof Error ? e.message : 'gagal diurai'}`);
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
