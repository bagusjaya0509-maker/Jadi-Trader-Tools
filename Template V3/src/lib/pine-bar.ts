import type { Lilin } from '@/lib/pasar';

/* ════════════════════════════════════════════════════════════════════════
   PENERJEMAH PINE PER-BAR
   ════════════════════════════════════════════════════════════════════════
   Mesin KEDUA di samping penerjemah vektor di pine.ts — untuk skrip yang
   memakai model eksekusi Pine yang sebenarnya: seluruh skrip dijalankan
   ulang PADA SETIAP BAR, `var` bertahan antar bar, `if`/`for` bercabang,
   array tumbuh, dan line/label/box digambar-hapus sepanjang jalan.

   Skrip macam BreakRetest (pivot → trendline → break → retest → rescan)
   tidak mungkin dijalankan model vektor: keadaannya dibangun bar demi bar,
   dan garisnya di-refit tiap pivot baru. Satu-satunya cara menjalankannya
   dengan benar adalah meniru model eksekusinya, bukan menambal per fungsi.

   YANG DIDUKUNG
     pernyataan : penetapan (= dan :=), `var`/anotasi tipe, if/else if/else,
                  for a to b [by s] (arah otomatis), break/continue,
                  fungsi satu-baris `nama(p) => ekspresi`
     ekspresi   : aritmetika % juga, banding, and/or/not, ternary ?:,
                  riwayat x[i] (deret bawaan & variabel), string, warna
     bawaan     : open high low close hl2 hlc3 ohlc4 bar_index na
                  barstate.islast/isconfirmed, timeframe.*, syminfo.*
     fungsi     : na(x), nz, math.*, ta.atr/sma/ema/rma/rsi/highest/lowest/
                  change/pivothigh/pivotlow (sumber bawaan, panjang konstan),
                  input.* (nilai bawaan), color.new/rgb, str.tostring
     array      : new/new<float>/new_int/new_float, push, get, set, size,
                  shift, pop, clear
     gambar     : line.new/delete/set_xy2, label.new/delete, box.new/delete,
                  plot, plotshape, hline → diterjemahkan ke chart kita;
                  table.*, alert*, linefill.* → dicatat lalu dilewati

   BATAS YANG DIAKUI TERBUKA: strategy.*, matrix, dan while belum ada —
   barisnya ditolak dengan nomor. request.security dievaluasi di timeframe
   chart (bukan TF yang diminta), dengan catatan yang menyebutkannya.
   ════════════════════════════════════════════════════════════════════════ */

export interface SegmenPine {
  x1: number; y1: number; x2: number; y2: number;
  warna: string; lebar: number; gaya: 'solid' | 'dashed' | 'dotted';
  perpanjang: 'none' | 'left' | 'right' | 'both';
}
export interface PenandaPine {
  bar: number; harga: number; teks: string; warna: string;
  posisi: 'atas' | 'bawah';
}
export interface KotakPine {
  kiri: number; atas: number; kanan: number; bawah: number;
  /* null = tidak digambar. Warna `na` di Pine berarti TAK TERLIHAT, bukan
     "pakai warna bawaan" — kotak isi-saja tampil tanpa bingkai, kotak
     bingkai-saja tampil tanpa isi. */
  warna: string | null; garis: string | null;
}
/** Isian antar dua garis (linefill) — pewarna tengah channel paralel. */
export interface IsianPine {
  x1: number; y1a: number; y1b: number; x2: number; y2a: number; y2b: number;
  warna: string; perpanjang: 'none' | 'right';
}
/** Satu input.* yang ditemukan di skrip — bahan panel setelan di UI. */
export interface InputPine {
  kunci: string; judul: string; grup: string;
  jenis: 'int' | 'float' | 'bool' | 'color' | 'string' | 'lain';
  bawaan: number | boolean | string | null;
  pilihan?: string[];
}

export interface HasilPineBar {
  plotSeri: { judul: string; warna: string; nilai: (number | null)[] }[];
  segmen: SegmenPine[];
  penanda: PenandaPine[];
  kotak: KotakPine[];
  isian: IsianPine[];
  input: InputPine[];
  hline: { nilai: number; warna: string }[];
  galat: string[];
  dilewati: string[];
}

/* ── Nilai runtime ───────────────────────────────────────────────────── */
type Nilai = number | boolean | string | null | NilaiArray | RefGambar;
interface NilaiArray { jenis: 'array'; isi: Nilai[] }
interface RefGambar { jenis: 'line' | 'label' | 'box' | 'table' | 'linefill'; id: number }

const WARNA: Record<string, string> = {
  red: '#f87171', green: '#10b981', blue: '#60a5fa', orange: '#fb923c',
  yellow: '#fbbf24', purple: '#a78bfa', white: '#fafafa', gray: '#a1a1aa',
  aqua: '#22d3ee', lime: '#84cc16', teal: '#2dd4bf', fuchsia: '#e879f9',
  maroon: '#b91c1c', navy: '#3b82f6', olive: '#a3a300', silver: '#d4d4d8',
  black: '#18181b',
};

/* ── NAMA PINE v4 TANPA NAMESPACE ────────────────────────────────────────
   Pine v5 memindahkan hampir semua fungsi ke dalam namespace: `sma` jadi
   `ta.sma`, `max` jadi `math.max`. Mesin ini ditulis untuk v5.

   Tapi skrip yang beredar di TradingView -- dan yang orang tempelkan ke
   sini -- sebagian besar masih v4, karena skrip populer jarang ditulis
   ulang. Menolaknya dengan "fungsi sma belum didukung" membuat mesin ini
   tampak jauh lebih sempit daripada kenyataannya: perhitungannya SUDAH ada,
   cuma namanya beda satu awalan.

   Dipetakan HANYA ke fungsi yang benar-benar ada di berkas ini. Memetakan
   nama ke sesuatu yang juga belum ada cuma memindahkan galatnya, dan pesan
   galat yang menyebut nama yang tidak pernah ditulis orangnya lebih
   membingungkan daripada pesan aslinya. */
const ALIAS_V4: Record<string, string> = {
  sma: 'ta.sma', ema: 'ta.ema', rma: 'ta.rma', rsi: 'ta.rsi',
  change: 'ta.change', atr: 'ta.atr',
  highest: 'ta.highest', lowest: 'ta.lowest',
  pivothigh: 'ta.pivothigh', pivotlow: 'ta.pivotlow',
  max: 'math.max', min: 'math.min', abs: 'math.abs',
  round: 'math.round', floor: 'math.floor', ceil: 'math.ceil',
  sqrt: 'math.sqrt', pow: 'math.pow', avg: 'math.avg',
  tostring: 'str.tostring',
};

function warnaTransp(hex: string, transp: number): string {
  const m = /^#([0-9a-fA-F]{6})/.exec(hex);
  if (!m) return hex;
  const a = Math.round((1 - Math.min(100, Math.max(0, transp)) / 100) * 255);
  return `#${m[1]}${a.toString(16).padStart(2, '0')}`;
}

/* ── AST ─────────────────────────────────────────────────────────────── */
type Ekspr =
  | { j: 'angka'; v: number } | { j: 'teks'; v: string } | { j: 'nama'; v: string }
  | { j: 'una'; op: string; a: Ekspr }
  | { j: 'bin'; op: string; a: Ekspr; b: Ekspr }
  | { j: 'ternary'; c: Ekspr; a: Ekspr; b: Ekspr }
  | { j: 'riwayat'; a: Ekspr; i: Ekspr }
  | { j: 'larik'; isi: Ekspr[] }
  | { j: 'panggil'; nama: string; arg: Ekspr[]; namaArg: Record<string, Ekspr> };

type Stmt =
  | { j: 'tugas'; nama: string; e: Ekspr; deklarasiVar: boolean; ulang: boolean; baris: number }
  | { j: 'ekspresi'; e: Ekspr; baris: number }
  | { j: 'if'; cabang: { kondisi: Ekspr | null; isi: Stmt[] }[]; baris: number }
  | { j: 'for'; nama: string; dari: Ekspr; ke: Ekspr; langkah: Ekspr | null; isi: Stmt[]; baris: number }
  | { j: 'while'; kondisi: Ekspr; isi: Stmt[]; baris: number }
  | { j: 'break'; baris: number } | { j: 'continue'; baris: number }
  | { j: 'fungsi'; nama: string; param: string[]; e: Ekspr | null; isi: Stmt[]; baris: number };

class GalatBaris extends Error { constructor(public baris: number, pesan: string) { super(pesan); } }

/* ── Pengurai ekspresi (Pratt sederhana) ─────────────────────────────── */
class Pengurai {
  pos = 0;
  constructor(private t: string, private baris: number) {}

  private err(p: string): never { throw new GalatBaris(this.baris, p); }
  private spasi() { while (this.pos < this.t.length && /\s/.test(this.t[this.pos])) this.pos++; }
  lihat(s: string) { this.spasi(); return this.t.startsWith(s, this.pos); }
  ambil(s: string) { if (this.lihat(s)) { this.pos += s.length; return true; } return false; }
  habis() { this.spasi(); return this.pos >= this.t.length; }

  urai(): Ekspr {
    const e = this.ternary();
    return e;
  }

  ternary(): Ekspr {
    const c = this.atau();
    this.spasi();
    if (this.ambil('?')) {
      const a = this.ternary();
      if (!this.ambil(':')) this.err('ternary tanpa ":"');
      const b = this.ternary();
      return { j: 'ternary', c, a, b };
    }
    return c;
  }
  private atau(): Ekspr {
    let a = this.dan();
    for (;;) { this.spasi();
      if (/^or\b/.test(this.t.slice(this.pos))) { this.pos += 2; a = { j: 'bin', op: 'or', a, b: this.dan() }; }
      else return a;
    }
  }
  private dan(): Ekspr {
    let a = this.banding();
    for (;;) { this.spasi();
      if (/^and\b/.test(this.t.slice(this.pos))) { this.pos += 3; a = { j: 'bin', op: 'and', a, b: this.banding() }; }
      else return a;
    }
  }
  private banding(): Ekspr {
    let a = this.jumlah();
    for (;;) { this.spasi();
      const op = ['>=', '<=', '==', '!=', '>', '<'].find((o) => this.lihat(o));
      /* `?` milik ternary — jangan makan `<` dari `<=` yang tidak ada. */
      if (!op) return a;
      this.pos += op.length;
      a = { j: 'bin', op, a, b: this.jumlah() };
    }
  }
  private jumlah(): Ekspr {
    let a = this.kali();
    for (;;) { this.spasi();
      if (this.ambil('+')) a = { j: 'bin', op: '+', a, b: this.kali() };
      else if (this.t[this.pos] === '-' && !this.t.startsWith('-=', this.pos)) { this.pos++; a = { j: 'bin', op: '-', a, b: this.kali() }; }
      else return a;
    }
  }
  private kali(): Ekspr {
    let a = this.una();
    for (;;) { this.spasi();
      if (this.ambil('*')) a = { j: 'bin', op: '*', a, b: this.una() };
      else if (this.t[this.pos] === '/' && !this.t.startsWith('//', this.pos)) { this.pos++; a = { j: 'bin', op: '/', a, b: this.una() }; }
      else if (this.ambil('%')) a = { j: 'bin', op: '%', a, b: this.una() };
      else return a;
    }
  }
  private una(): Ekspr {
    this.spasi();
    if (/^not\b/.test(this.t.slice(this.pos))) { this.pos += 3; return { j: 'una', op: 'not', a: this.una() }; }
    if (this.ambil('-')) return { j: 'una', op: '-', a: this.una() };
    return this.pasca();
  }
  private pasca(): Ekspr {
    let a = this.atom();
    for (;;) {
      this.spasi();
      if (this.t[this.pos] === '[') {
        this.pos++;
        const i = this.ternary();
        if (!this.ambil(']')) this.err('kurung siku tutup hilang');
        a = { j: 'riwayat', a, i };
      } else return a;
    }
  }
  private atom(): Ekspr {
    this.spasi();
    if (this.ambil('(')) {
      const e = this.ternary();
      if (!this.ambil(')')) this.err('kurung tutup hilang');
      return e;
    }
    /* Larik literal [a, b, c] — bentuk yang dipakai options= milik
       input.string. Aman dari tabrakan dengan riwayat x[n]: riwayat hanya
       muncul SETELAH sebuah atom, ini di posisi atom. */
    if (this.ambil('[')) {
      const isi: Ekspr[] = [];
      if (!this.ambil(']')) {
        for (;;) {
          isi.push(this.ternary());
          if (this.ambil(',')) continue;
          if (this.ambil(']')) break;
          this.err('koma atau ] hilang di larik');
        }
      }
      return { j: 'larik', isi };
    }
    const c = this.t[this.pos];
    /* Warna heksadesimal literal — color.new(#8B0000, 70) adalah bentuk
       yang benar-benar dipakai orang di input.color. Nilainya string warna,
       sama seperti color.red. */
    if (c === '#') {
      const hex = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?/.exec(this.t.slice(this.pos));
      if (hex) { this.pos += hex[0].length; return { j: 'teks', v: hex[0].slice(0, 7) }; }
    }
    if (c === '"' || c === "'") {
      let j = this.pos + 1;
      while (j < this.t.length && this.t[j] !== c) j++;
      const v = this.t.slice(this.pos + 1, j);
      this.pos = j + 1;
      return { j: 'teks', v };
    }
    const angka = /^\d+(\.\d+)?([eE]\d+)?/.exec(this.t.slice(this.pos));
    if (angka) { this.pos += angka[0].length; return { j: 'angka', v: Number(angka[0]) }; }
    const nama = /^[A-Za-z_][A-Za-z0-9_.]*(<[A-Za-z]+>)?/.exec(this.t.slice(this.pos));
    if (!nama) this.err(`tidak paham "${this.t.slice(this.pos, this.pos + 18)}"`);
    this.pos += nama[0].length;
    const id = nama[0].replace(/<[A-Za-z]+>/, '');
    this.spasi();
    if (this.t[this.pos] === '(') {
      this.pos++;
      const arg: Ekspr[] = [];
      const namaArg: Record<string, Ekspr> = {};
      this.spasi();
      if (!this.ambil(')')) {
        for (;;) {
          this.spasi();
          const nm = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.exec(this.t.slice(this.pos));
          if (nm) { this.pos += nm[0].length; namaArg[nm[1]] = this.ternary(); }
          else arg.push(this.ternary());
          if (this.ambil(',')) continue;
          if (this.ambil(')')) break;
          this.err('koma atau kurung tutup hilang di argumen');
        }
      }
      return { j: 'panggil', nama: id, arg, namaArg };
    }
    return { j: 'nama', v: id };
  }
}

/* ── Pengurai pernyataan (indentasi) ─────────────────────────────────── */
function uraiBlok(baris: { teks: string; no: number; indent: number }[], mulai: number, indentInduk: number, dilewati: string[]): { stmt: Stmt[]; lanjut: number } {
  const stmt: Stmt[] = [];
  let i = mulai;
  while (i < baris.length) {
    const b = baris[i];
    if (b.indent <= indentInduk) break;

    const isi = b.teks;
    /* Baris yang murni kosmetik/di luar jangkauan panel dicatat, bukan
       digalatkan — skrip tetap jalan tanpa mereka.

       `fill(` SUDAH TIDAK di sini. Ia dibuang di tahap urai, jadi bentuk
       fill(plotA, plotB) yang kini digambar tidak akan pernah sampai ke
       evaluator — dan penanganannya di sana tampak tidak bekerja tanpa satu
       pun galat. Penyaringan bentuk yang belum didukung dipindah ke
       evaluator, yang bisa MELIHAT argumennya; pengurai cuma melihat teks
       dan tidak bisa membedakan fill antar plot dari fill antar hline. */
    if (/^(table\.|alertcondition\s*\(|alert\s*\(|barcolor\s*\(|bgcolor\s*\()/.test(isi)) {
      dilewati.push(`baris ${b.no}: ${isi.slice(0, 44)} — dilewati (kosmetik/di luar panel)`);
      i++;
      continue;
    }

    if (/^if\b/.test(isi)) {
      const cabang: { kondisi: Ekspr | null; isi: Stmt[] }[] = [];
      let j = i;
      for (;;) {
        const t = baris[j].teks;
        let kondisi: Ekspr | null = null;
        if (/^if\b/.test(t)) kondisi = new Pengurai(t.slice(2).trim(), baris[j].no).urai();
        else if (/^else if\b/.test(t)) kondisi = new Pengurai(t.slice(7).trim(), baris[j].no).urai();
        /* else → kondisi null */
        const dalam = uraiBlok(baris, j + 1, baris[j].indent, dilewati);
        cabang.push({ kondisi, isi: dalam.stmt });
        j = dalam.lanjut;
        if (j < baris.length && baris[j].indent === b.indent && /^else( if\b)?/.test(baris[j].teks)) continue;
        break;
      }
      stmt.push({ j: 'if', cabang, baris: b.no });
      i = j;
      continue;
    }

    const whileM = /^while\s+(.+)$/.exec(isi);
    if (whileM) {
      const dalam = uraiBlok(baris, i + 1, b.indent, dilewati);
      stmt.push({ j: 'while', kondisi: new Pengurai(whileM[1], b.no).urai(), isi: dalam.stmt, baris: b.no });
      i = dalam.lanjut;
      continue;
    }

    const forM = /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s+to\s+(.+?)(?:\s+by\s+(.+))?$/.exec(isi);
    if (forM) {
      const dalam = uraiBlok(baris, i + 1, b.indent, dilewati);
      stmt.push({
        j: 'for', nama: forM[1],
        dari: new Pengurai(forM[2], b.no).urai(),
        ke: new Pengurai(forM[3], b.no).urai(),
        langkah: forM[4] ? new Pengurai(forM[4], b.no).urai() : null,
        isi: dalam.stmt, baris: b.no,
      });
      i = dalam.lanjut;
      continue;
    }

    if (isi === 'break') { stmt.push({ j: 'break', baris: b.no }); i++; continue; }
    if (isi === 'continue') { stmt.push({ j: 'continue', baris: b.no }); i++; continue; }

    /* Fungsi buatan skrip — dua bentuk yang sama-sama dipakai orang:
       satu-baris  : nama(p) => ekspresi
       multi-baris : nama(p) =>            <- tidak ada apa pun setelah =>
                         pernyataan...     <- blok menjorok
       Nilai baliknya (kalau ada) adalah pernyataan TERAKHIR badan —
       aturan Pine yang sebenarnya. */
    const fnM = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>\s*(.*)$/.exec(isi);
    if (fnM) {
      const param = fnM[2].split(',').map((s) => s.trim().replace(/^(?:series\s+)?(?:float|int|bool|color|string|line|label|box|array<[A-Za-z]+>)\s+/, '')).filter(Boolean);
      if (fnM[3].trim()) {
        stmt.push({ j: 'fungsi', nama: fnM[1], param, e: new Pengurai(fnM[3], b.no).urai(), isi: [], baris: b.no });
        i++;
      } else {
        const dalam = uraiBlok(baris, i + 1, b.indent, dilewati);
        stmt.push({ j: 'fungsi', nama: fnM[1], param, e: null, isi: dalam.stmt, baris: b.no });
        i = dalam.lanjut;
      }
      continue;
    }

    /* Penetapan: [var] [tipe] nama = / := / += / -= / *= / /= ekspresi.
       Bentuk gabungan diurai jadi `nama = nama <op> (ekspresi)` — semantik
       yang sama, tanpa cabang baru di mesinnya. */
    const tM = /^(var\s+)?(?:(?:float|int|bool|color|string|linefill|line|label|box|table|polyline|array<[A-Za-z]+>|array)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(:=|[+\-*/]?=)(?!=)\s*(.+)$/.exec(isi);
    if (tM && !/^(if|for|else)\b/.test(isi)) {
      const op = tM[3];
      let ekspresi: Ekspr = new Pengurai(tM[4], b.no).urai();
      if (op.length === 2 && op !== ':=') {
        ekspresi = { j: 'bin', op: op[0], a: { j: 'nama', v: tM[2] }, b: ekspresi };
      }
      stmt.push({
        j: 'tugas', nama: tM[2],
        e: ekspresi,
        deklarasiVar: !!tM[1], ulang: op === ':=', baris: b.no,
      });
      i++;
      continue;
    }

    /* Pernyataan ekspresi (array.push(...), line.delete(...), dst.) */
    stmt.push({ j: 'ekspresi', e: new Pengurai(isi, b.no).urai(), baris: b.no });
    i++;
  }
  return { stmt, lanjut: i };
}

/** Buang komentar `//` dari SATU baris, dengan menghormati tanda petik.
 *
 *  Urutannya penting dan pernah salah: baris yang kurungnya belum tertutup
 *  digabung dulu dengan baris berikutnya, BARU komentarnya dibuang. Hasil
 *  gabungan tidak punya baris baru, jadi satu `/​/` di tengahnya menghapus
 *  seluruh sisa ekspresi — `array.from(` yang argumennya masing-masing
 *  berkomentar akan berakhir sebagai kurung buka tanpa isi.
 *
 *  Gejalanya menyesatkan: mesin melapor "tidak paham" di baris pembuka,
 *  padahal barisnya benar dan yang rusak adalah cara kita menyusunnya.
 *  Karena itu komentar dibuang PER BARIS, sebelum digabung.
 *
 *  Tanda petik dihormati supaya `str.tostring(x, "#.##")` dan alamat
 *  "https://..." di dalam teks tidak ikut terpotong. */
/** Baris yang jelas BELUM selesai walau kurungnya seimbang.
 *
 *  Pine membolehkan satu pernyataan melipat ke baris berikutnya selama
 *  lanjutannya menjorok — dan skrip kalender ekonomi memakainya terus:
 *
 *      isNFP = enableNFP and (f_inNewsWindow(time, nfpDates, winMs) or
 *           (nfpEx1_on and time >= nfpEx1_t and time < nfpEx1_t + winMs))
 *
 *  Baris pertama kurungnya seimbang, jadi hitungan kurung saja menyatakan
 *  "sudah selesai" — padahal ia berakhir dengan `or` dan jelas menunggu
 *  operan berikutnya. Yang diperiksa di sini operator yang menggantung di
 *  ujung baris, bukan indentasi lanjutannya: indentasi di Pine punya arti
 *  lain (blok if/for), dan memakainya untuk dua hal sekaligus membuat
 *  keduanya salah di kasus pinggir. */
export function belumSelesaiPine(s: string): boolean {
  const t = s.trimEnd();
  /* `nama(a, b) =>` di ujung baris adalah KEPALA fungsi multi-baris, dan
     itu pernyataan yang sudah utuh — badannya tinggal di baris-baris
     menjorok di bawahnya. Tanpa pengecualian ini, kepalanya tersambung ke
     baris pertama badannya, fungsinya berubah jadi satu-baris, dan sisa
     badannya jatuh ke tingkat atas — di mana parameternya tidak ada.
     Galat yang muncul menyebut "arr belum didefinisikan", jauh dari
     penyebabnya. */
  if (/=>$/.test(t)) return false;
  return /(?:\b(?:and|or|not)|[+\-*/%,?:]|[=<>!]=?)$/.test(t);
}

export function buangKomentar(s: string): string {
  let dalam: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (dalam) {
      if (c === '\\') { i++; continue; }
      if (c === dalam) dalam = null;
      continue;
    }
    if (c === '"' || c === "'") { dalam = c; continue; }
    if (c === '/' && s[i + 1] === '/') return s.slice(0, i);
  }
  return s;
}

/* ── Waktu & zona waktu ──────────────────────────────────────────────
   Indikator berbasis kalender ekonomi (NFP, CPI, FOMC) berdiri di atas
   satu hal: "jam berapa bar ini menurut New York". Tanpa zona waktu yang
   benar, seluruh penandanya meleset beberapa jam — dan melesetnya TIDAK
   terlihat sebagai galat, cuma sebagai label di lilin yang salah. Itu
   sebabnya bagian ini memakai Intl, bukan offset tetap yang ditulis
   tangan: America/New_York bergeser sendiri saat DST, dan rilis 08:30 ET
   di bulan Januari bukan jam UTC yang sama dengan 08:30 ET di bulan Juli.

   Bentuk "GMT+3" tetap ditangani terpisah karena itu yang dipakai untuk
   jam broker, dan broker memang tidak mengenal DST. */
function offsetZonaMenit(ms: number, tz: string): number {
  const z = String(tz || '').trim();
  const tetap = /^(?:GMT|UTC)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i.exec(z);
  if (tetap) {
    const tanda = tetap[1] === '-' ? -1 : 1;
    return tanda * (parseInt(tetap[2], 10) * 60 + (tetap[3] ? parseInt(tetap[3], 10) : 0));
  }
  if (!z || /^(?:GMT|UTC|Z|Etc\/UTC|Etc\/GMT)$/i.test(z)) return 0;
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: z, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p: Record<string, string> = {};
    for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
    const dinding = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((dinding - (ms - (ms % 1000))) / 60000);
  } catch {
    /* Zona tidak dikenal Intl → diperlakukan UTC. Lebih baik meleset
       seragam daripada melempar galat di tengah indikator. */
    return 0;
  }
}

/** Pecahan waktu dinding di zona tertentu. `hari` mengikuti Pine:
 *  Minggu = 1 … Sabtu = 7. */
function bagianWaktu(ms: number, tz: string) {
  const d = new Date(ms + offsetZonaMenit(ms, tz) * 60000);
  return {
    tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1, tanggal: d.getUTCDate(),
    jam: d.getUTCHours(), menit: d.getUTCMinutes(), detik: d.getUTCSeconds(),
    hari: d.getUTCDay() + 1,
  };
}

/** Waktu dinding → stempel UTC. Dihitung dua kali karena offsetnya sendiri
 *  bergantung pada instant yang sedang dicari: tebakan pertama memakai
 *  offset di sekitar tanggal itu, tebakan kedua mengoreksinya kalau
 *  tebakan pertama mendarat di sisi lain pergantian DST. */
function keStempel(tz: string, y: number, bln: number, tgl: number, jam: number, menit: number): number {
  const dinding = Date.UTC(y, bln - 1, tgl, jam, menit);
  let hasil = dinding;
  for (let i = 0; i < 2; i++) hasil = dinding - offsetZonaMenit(hasil, tz) * 60000;
  return hasil;
}

/** Angka → teks mengikuti format Pine ("#.##", "0.0000", format.mintick). */
function formatAngka(x: number, fmt: string | null, mintick: number): string {
  if (!fmt || fmt === 'format.inherit') return String(+x.toFixed(6));
  if (fmt === 'format.mintick') {
    const desimal = Math.max(0, Math.round(-Math.log10(mintick)));
    return x.toFixed(Math.min(10, desimal));
  }
  if (fmt === 'format.percent') return x.toFixed(2) + '%';
  if (fmt === 'format.volume') return String(Math.round(x));
  /* Pola gaya "#.##" / "0.000": jumlah tanda di belakang titik = jumlah
     desimal. '#' berarti boleh dibuang kalau nol, '0' berarti dipaksa
     tampil — bedanya terlihat pada "1.5" vs "1.50". */
  const p = /^([#0]*)(?:\.([#0]+))?$/.exec(String(fmt).trim());
  if (!p) return String(+x.toFixed(6));
  const desimal = p[2] ? p[2].length : 0;
  const teks = x.toFixed(desimal);
  if (p[2] && p[2].includes('#') && !p[2].includes('0')) {
    return teks.replace(/\.?0+$/, '');
  }
  return teks;
}

/* ── Deret bantu (dipakai ta.*) ──────────────────────────────────────── */
function atrDeret(h: number[], l: number[], c: number[], p: number): (number | null)[] {
  const n = c.length, tr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    tr[i] = i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
  }
  const out: (number | null)[] = new Array(n).fill(null);
  let acc: number | null = null;
  for (let i = 0; i < n; i++) {
    if (i === p - 1) { acc = tr.slice(0, p).reduce((s, x) => s + x, 0) / p; out[i] = acc; }
    else if (acc !== null) { acc = (acc * (p - 1) + tr[i]) / p; out[i] = acc; }
  }
  return out;
}
function pivotDeret(sumber: number[], kiri: number, kanan: number, tinggi: boolean): (number | null)[] {
  const n = sumber.length, out: (number | null)[] = new Array(n).fill(null);
  for (let i = kiri; i < n - kanan; i++) {
    let ok = true;
    for (let j = i - kiri; j <= i + kanan && ok; j++) {
      if (j === i) continue;
      if (tinggi ? sumber[j] >= sumber[i] : sumber[j] <= sumber[i]) ok = false;
    }
    if (ok) out[i + kanan] = sumber[i]; /* terkonfirmasi `kanan` bar kemudian */
  }
  return out;
}

/* ── Mesin ───────────────────────────────────────────────────────────── */
class Mesin {
  varPersisten = new Map<string, Nilai>();
  lingkup = new Map<string, Nilai>();
  fungsi = new Map<string, { param: string[]; e: Ekspr | null; isi: Stmt[] }>();
  riwayat = new Map<string, Nilai[]>();
  gambar = new Map<number, { jenis: string; data: Record<string, Nilai> }>();
  idGambar = 1;
  bar = 0;
  kedalamanFungsi = 0;
  plotNilai = new Map<string, { warna: string; nilai: (number | null)[]; sembunyi?: boolean }>();
  /* Isian antar-plot dari fill(plotA, plotB). Dikumpulkan di sini, bukan di
     `gambar` seperti linefill: yang ini lahir per BAR selama skrip berjalan,
     bukan sebagai objek yang bisa dihapus lagi. */
  isianPlot: IsianPine[] = [];
  penanda: PenandaPine[] = [];
  hlines: { nilai: number; warna: string }[] = [];
  cacheTa = new Map<string, (number | null)[]>();
  dilewatiSekali = new Set<string>();
  daftarInput: InputPine[] = [];
  private inputKunci = new Set<string>();

  constructor(private l: Lilin, private n: number, public dilewati: string[], private tf: string,
              private setelan: Record<string, number | boolean | string> = {}) {}

  private err(baris: number, p: string): never { throw new GalatBaris(baris, p); }

  angka(v: Nilai): number | null {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    return null;
  }
  benar(v: Nilai): boolean {
    if (v == null) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return isFinite(v) && v !== 0;
    return true;
  }

  jalankanStmt(daftar: Stmt[]): 'break' | 'continue' | null {
    for (const s of daftar) {
      switch (s.j) {
        case 'fungsi': this.fungsi.set(s.nama, { param: s.param, e: s.e, isi: s.isi }); break;
        case 'tugas': {
          if (s.deklarasiVar) {
            if (!this.varPersisten.has(s.nama)) this.varPersisten.set(s.nama, this.eval(s.e, s.baris));
            this.lingkup.set(s.nama, this.varPersisten.get(s.nama)!);
          } else {
            const v = this.eval(s.e, s.baris);
            this.lingkup.set(s.nama, v);
            if (this.varPersisten.has(s.nama)) this.varPersisten.set(s.nama, v);
          }
          if (s.ulang && this.varPersisten.has(s.nama)) {
            /* `x := v` pada var → nilainya baru sudah ditulis di atas. */
          }
          break;
        }
        case 'ekspresi': this.eval(s.e, s.baris); break;
        case 'if': {
          for (const c of s.cabang) {
            if (c.kondisi === null || this.benar(this.eval(c.kondisi, s.baris))) {
              const r = this.jalankanStmt(c.isi);
              if (r) return r;
              break;
            }
          }
          break;
        }
        case 'for': {
          const dari = this.angka(this.eval(s.dari, s.baris));
          const ke = this.angka(this.eval(s.ke, s.baris));
          if (dari == null || ke == null) break;
          let langkah = s.langkah ? (this.angka(this.eval(s.langkah, s.baris)) ?? 1) : (dari <= ke ? 1 : -1);
          if (langkah === 0) langkah = 1;
          let jaga = 0;
          for (let i = dari; langkah > 0 ? i <= ke : i >= ke; i += langkah) {
            if (++jaga > 20000) this.err(s.baris, 'perulangan terlalu panjang (>20000)');
            this.lingkup.set(s.nama, i);
            const r = this.jalankanStmt(s.isi);
            if (r === 'break') break;
          }
          break;
        }
        case 'while': {
          let jaga = 0;
          while (this.benar(this.eval(s.kondisi, s.baris))) {
            if (++jaga > 20000) this.err(s.baris, 'while terlalu panjang (>20000)');
            const r = this.jalankanStmt(s.isi);
            if (r === 'break') break;
          }
          break;
        }
        case 'break': return 'break';
        case 'continue': return 'continue';
      }
    }
    return null;
  }

  deretBawaan(nama: string): number[] | null {
    const l = this.l;
    switch (nama) {
      case 'open': return l.opens; case 'high': return l.highs;
      case 'low': return l.lows; case 'close': return l.closes;
      /* `time` sebagai DERET, bukan angka tunggal: skrip menulis
         `time[1]` untuk membandingkan bar ini dengan bar sebelumnya —
         itulah cara mendeteksi "bar pertama hari Senin". Dijadikan deret
         di sini membuat riwayatnya jalan sendiri, tanpa penanganan
         khusus di mana pun. */
      case 'time': case 'time_close': return l.times;
      /* TURUNAN sebagai DERET, bukan cuma nilai per bar.
         ta.sma/ta.ema dan kawan-kawan mencari sumbernya lewat deretBawaan
         dan JATUH KE `close` kalau namanya tidak dikenal -- tanpa galat.
         Jadi sebelum ini `sma(hl2, 20)` diam-diam menghitung sma(close,20):
         angka yang salah, tanpa satu pun tanda bahwa ia salah. */
      case 'hl2': case 'hlc3': case 'ohlc4': case 'tr': return this.deretTurunan(nama);
      default: return null;
    }
  }

  /* Dihitung sekali per deret lalu disimpan: dipanggil per bar, dan
     menyusun ulang seluruh larik tiap bar membuat skrip 3000 lilin
     mengerjakan jutaan operasi untuk jawaban yang tidak pernah berubah. */
  private turunan = new Map<string, number[]>();
  private deretTurunan(nama: string): number[] {
    const ada = this.turunan.get(nama);
    if (ada) return ada;
    const l = this.l, n = l.closes.length;
    const out = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      if (nama === 'hl2') out[i] = (l.highs[i] + l.lows[i]) / 2;
      else if (nama === 'hlc3') out[i] = (l.highs[i] + l.lows[i] + l.closes[i]) / 3;
      else if (nama === 'ohlc4') out[i] = (l.opens[i] + l.highs[i] + l.lows[i] + l.closes[i]) / 4;
      else {
        /* True range. Bar pertama tidak punya close sebelumnya, dan Pine
           memakai high-low apa adanya di sana. */
        const hl = l.highs[i] - l.lows[i];
        out[i] = i === 0 ? hl : Math.max(
          hl,
          Math.abs(l.highs[i] - l.closes[i - 1]),
          Math.abs(l.lows[i] - l.closes[i - 1]),
        );
      }
    }
    this.turunan.set(nama, out);
    return out;
  }

  eval(e: Ekspr, baris: number): Nilai {
    switch (e.j) {
      case 'angka': return e.v;
      case 'teks': return e.v;
      case 'nama': return this.nilaiNama(e.v, baris);
      case 'una': {
        const a = this.eval(e.a, baris);
        if (e.op === 'not') return !this.benar(a);
        const n = this.angka(a);
        return n == null ? null : -n;
      }
      case 'ternary': return this.benar(this.eval(e.c, baris)) ? this.eval(e.a, baris) : this.eval(e.b, baris);
      case 'bin': {
        if (e.op === 'and') return this.benar(this.eval(e.a, baris)) && this.benar(this.eval(e.b, baris));
        if (e.op === 'or') return this.benar(this.eval(e.a, baris)) || this.benar(this.eval(e.b, baris));
        const a = this.eval(e.a, baris), b = this.eval(e.b, baris);
        if (e.op === '==') return a === b || (this.angka(a) !== null && this.angka(a) === this.angka(b));
        if (e.op === '!=') return !(a === b || (this.angka(a) !== null && this.angka(a) === this.angka(b)));
        /* `+` di Pine juga MENYAMBUNG TEKS. Tanpa ini, label yang disusun
           dari potongan ("Gap: " + teks + "\n" + angka) berubah jadi null
           dan tergambar sebagai label kosong — muncul di tempat yang benar,
           tapi tanpa satu huruf pun. Kegagalan yang paling membingungkan
           karena tidak ada galat sama sekali.

           Hanya berlaku kalau salah satu sisinya memang teks; angka +
           angka tetap penjumlahan. */
        if (e.op === '+' && (typeof a === 'string' || typeof b === 'string')) {
          const keTeks = (v: Nilai): string => {
            if (v == null) return 'na';
            if (typeof v === 'number') return String(+v.toFixed(6));
            if (typeof v === 'boolean') return v ? 'true' : 'false';
            return typeof v === 'string' ? v : '';
          };
          return keTeks(a) + keTeks(b);
        }
        const x = this.angka(a), y = this.angka(b);
        if (x == null || y == null) {
          if (['>', '<', '>=', '<='].includes(e.op)) return false;
          return null;
        }
        switch (e.op) {
          case '+': return x + y; case '-': return x - y;
          case '*': return x * y; case '/': return y === 0 ? null : x / y;
          case '%': return y === 0 ? null : x % y;
          case '>': return x > y; case '<': return x < y;
          case '>=': return x >= y; case '<=': return x <= y;
        }
        return null;
      }
      case 'riwayat': {
        const i = this.angka(this.eval(e.i, baris));
        if (i == null || i < 0) this.err(baris, 'indeks riwayat harus angka ≥ 0');
        const ofs = Math.round(i);
        if (e.a.j === 'nama') {
          const deret = this.deretBawaan(e.a.v);
          if (deret) { const k = this.bar - ofs; return k >= 0 ? deret[k] : null; }
          const riw = this.riwayat.get(e.a.v);
          if (riw) {
            /* SALAH SATU INDEKS sebelum ini: rumusnya riw[riw.length - ofs - 1],
               jadi x[1] memulangkan nilai DUA bar lalu, x[2] tiga bar lalu, dan
               seterusnya.

               Saat bar ke-i berjalan, riw berisi bar 0..i-1 -- panjangnya i.
               Bar sebelumnya ada di riw[i - 1], yaitu riw[riw.length - 1].

               Akibatnya tidak pernah berupa galat, cuma angka yang meleset satu
               bar. Pada skrip yang menumpuk nilainya sendiri (up := max(up,
               up[1])) selisih itu membuat tumpukannya tidak pernah terbentuk:
               Supertrend jadi gigi gergaji dengan 373 pergantian tren padahal
               seharusnya 66. */
            const k = riw.length - ofs;
            return ofs === 0 ? this.lingkup.get(e.a.v) ?? null : (k >= 0 ? riw[k] : null);
          }
          /* `bar_index[n]` punya jawaban pasti tanpa perlu menyimpan
             riwayat: nomor bar sekarang dikurangi n. Sebelum ini ia jatuh
             ke cabang "tanpa riwayat" dan mengembalikan null — dan
             line.new(bar_index[1], ...) yang koordinat kirinya null
             dibuang diam-diam. Garis gap Jumat→Senin tidak pernah muncul,
             tanpa satu pun galat yang menjelaskan kenapa. */
          if (e.a.v === 'bar_index') { const k = this.bar - ofs; return k >= 0 ? k : null; }
          /* variabel tanpa riwayat: [0] = nilai kini */
          if (ofs === 0) return this.nilaiNama(e.a.v, baris);
          return null;
        }
        /* riwayat atas ekspresi: hanya deret bawaan yang punya masa lalu */
        this.err(baris, 'riwayat [n] hanya untuk deret bawaan atau variabel');
        break;
      }
      case 'larik': return { jenis: 'array', isi: e.isi.map((x) => this.eval(x, baris)) };
      case 'panggil': return this.panggil(e, baris);
    }
  }

  nilaiNama(nama: string, baris: number): Nilai {
    if (this.lingkup.has(nama)) return this.lingkup.get(nama)!;
    if (this.varPersisten.has(nama)) return this.varPersisten.get(nama)!;
    const deret = this.deretBawaan(nama);
    if (deret) return deret[this.bar];
    switch (nama) {
      case 'hl2': return (this.l.highs[this.bar] + this.l.lows[this.bar]) / 2;
      case 'hlc3': return (this.l.highs[this.bar] + this.l.lows[this.bar] + this.l.closes[this.bar]) / 3;
      case 'ohlc4': return (this.l.opens[this.bar] + this.l.highs[this.bar] + this.l.lows[this.bar] + this.l.closes[this.bar]) / 4;
      case 'na': return null;
      case 'true': return true; case 'false': return false;
      case 'bar_index': return this.bar;
      case 'volume': return 0;
      case 'barstate.islast': return this.bar === this.n - 1;
      case 'barstate.isconfirmed': return true;
      /* FORMAT TRADINGVIEW, bukan format kita: skrip menulis
         `timeframe.period == "60"` untuk 1 jam dan `"15"` untuk 15 menit.
         Mengembalikan "1h" membuat SEMUA gerbang timeframe skrip tertutup
         diam-diam — duplikat channel dan EMA khusus TF kecil tidak pernah
         tergambar, tanpa satu pun galat. */
      case 'timeframe.period': {
        const m = /^(\d+)m$/.exec(this.tf);
        if (m) return m[1];
        const h = /^(\d+)h$/.exec(this.tf);
        if (h) return String(Number(h[1]) * 60);
        if (this.tf === '1d') return 'D';
        if (this.tf === '1w') return 'W';
        return this.tf;
      }
      /* Panjang timeframe chart dalam detik. Indikator siklus memakainya
         sebagai GERBANG ("hanya tampil di 4H ke atas"), jadi kalau tidak
         didukung bukan satu baris yang hilang — seluruh deteksinya tidak
         pernah jalan dan chartnya kosong tanpa sebab yang terlihat. */
      case 'timeframe.in_seconds': {
        const m = /^(\d+)([mhdw])$/.exec(this.tf);
        if (!m) return 3600;
        const n = Number(m[1]);
        return n * ({ m: 60, h: 3600, d: 86400, w: 604800 }[m[2]] ?? 3600);
      }
      case 'timeframe.isdaily': return this.tf === '1d' || this.tf === 'D';
      case 'timeframe.isweekly': return this.tf === '1w' || this.tf === 'W';
      case 'timeframe.isintraday': return !['1d', 'D', '1w', 'W'].includes(this.tf);
      case 'syminfo.tickerid': case 'syminfo.ticker': return 'CHART';
      case 'syminfo.mintick': return 0.01;
      /* Minggu = 1 … Sabtu = 7, persis penomoran Pine. Kalau dinomori
         dari nol seperti JavaScript, `dayofweek(time) == dayofweek.monday`
         akan cocok di hari Minggu — dan tidak ada yang terlihat salah
         sampai seseorang membandingkan penandanya dengan kalender. */
      case 'dayofweek.sunday': return 1;
      case 'dayofweek.monday': return 2;
      case 'dayofweek.tuesday': return 3;
      case 'dayofweek.wednesday': return 4;
      case 'dayofweek.thursday': return 5;
      case 'dayofweek.friday': return 6;
      case 'dayofweek.saturday': return 7;
      /* Tanpa argumen, fungsi waktu Pine memakai waktu bar berjalan. */
      case 'dayofweek': return bagianWaktu(this.l.times[this.bar] ?? 0, '').hari;
      case 'hour': return bagianWaktu(this.l.times[this.bar] ?? 0, '').jam;
      case 'minute': return bagianWaktu(this.l.times[this.bar] ?? 0, '').menit;
      case 'year': return bagianWaktu(this.l.times[this.bar] ?? 0, '').tahun;
      case 'month': return bagianWaktu(this.l.times[this.bar] ?? 0, '').bulan;
      case 'dayofmonth': return bagianWaktu(this.l.times[this.bar] ?? 0, '').tanggal;
    }
    if (/^color\./.test(nama)) return WARNA[nama.slice(6)] ?? '#a1a1aa';
    /* Konstanta gaya/tempat: nilainya namanya sendiri. */
    if (/^(extend|line\.style_|label\.style_|box\.style_|shape|size|location|position|xloc|yloc|display|format|alert|plot\.style_|hline\.style_|barmerge|scale|order|font)\b/.test(nama) || /\.(style_|freq_)/.test(nama)) {
      return nama;
    }
    this.err(baris, `variabel "${nama}" belum didefinisikan`);
  }

  private taCache(kunci: string, buat: () => (number | null)[]): number | null {
    let d = this.cacheTa.get(kunci);
    if (!d) { d = buat(); this.cacheTa.set(kunci, d); }
    return d[this.bar] ?? null;
  }

  panggil(e: Extract<Ekspr, { j: 'panggil' }>, baris: number): Nilai {
    /* Nama v4 diterjemahkan ke padanan v5 SEBELUM apa pun yang lain.
       Fungsi buatan skrip menang: orang yang menulis `f(x) => ...` bernama
       `avg` berhak memakai miliknya sendiri, dan membajaknya jadi math.avg
       akan mengubah hasil skripnya tanpa memberi tahu apa pun. */
    const aliasV4 = ALIAS_V4[e.nama];
    if (aliasV4 && !this.fungsi.has(e.nama)) e = { ...e, nama: aliasV4 };

    /* i = -1 dipakai pemanggil untuk "hanya lewat nama" — tanpa penjaga
       bawah, e.arg[-1] lolos dan mesinnya jatuh di tengah bar. */
    const arg = (i: number) => (i >= 0 && i < e.arg.length ? this.eval(e.arg[i], baris) : null);
    const nArg = (i: number) => this.angka(arg(i));
    const dapat = (nm: string, i: number): Nilai => (e.namaArg[nm] ? this.eval(e.namaArg[nm], baris) : arg(i));
    /* Warna argumen punya TIGA keadaan yang berbeda artinya:
       tidak ditulis → warna bawaan; ditulis string → warna itu;
       ditulis na → null = JANGAN digambar. Pola lama `?? bawaan` menghapus
       keadaan ketiga — garis yang diminta tak terlihat malah tampil kelabu
       pucat. Itulah "garis putih misterius" di sekitar zona S/R. */
    const warnaOpsi = (nm: string, i: number, bawaan: string | null): string | null => {
      const ada = nm in e.namaArg || (i >= 0 && i < e.arg.length);
      if (!ada) return bawaan;
      const v = dapat(nm, i);
      return typeof v === 'string' ? v : null;
    };
    const l = this.l;

    switch (e.nama) {
      /* ── dasar ── */
      case 'na': return arg(0) == null;
      case 'nz': { const v = arg(0); return v == null ? (arg(1) ?? 0) : v; }
      case 'int': case 'float': return nArg(0);
      case 'bool': return this.benar(arg(0));
      case 'str.tostring': {
        const v = arg(0);
        if (v == null) return 'na';
        if (typeof v !== 'number') return String(v);
        const fmt = e.arg.length > 1 || 'format' in e.namaArg ? dapat('format', 1) : null;
        return formatAngka(v, typeof fmt === 'string' ? fmt : null, 0.01);
      }

      /* ── Waktu & kalender ────────────────────────────────────────────
         Inilah yang membuat indikator berbasis jadwal rilis bisa jalan:
         tanpa timestamp() dan dayofweek(), seluruh array tanggal NFP/CPI
         cuma angka yang tidak pernah cocok dengan bar mana pun. */
      /* Dipanggil sebagai fungsi — `timeframe.in_seconds()`. Argumennya
         opsional (TF lain); kalau disebut, kita tetap menjawab TF chart
         dan mengakuinya di catatan, bukan mengarang jawaban. */
      case 'timeframe.in_seconds': return this.nilaiNama('timeframe.in_seconds', baris);
      case 'timestamp': {
        /* Tiga bentuk yang benar-benar dipakai orang:
             timestamp("2026-08-07 08:30")
             timestamp(tz, y, m, d, jam, menit)
             timestamp(y, m, d, jam, menit)                */
        const a0 = arg(0);
        if (e.arg.length === 1 && typeof a0 === 'string') {
          const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(a0.trim());
          if (!m) return null;
          return keStempel('', +m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
        }
        const adaTz = typeof a0 === 'string';
        const tz = adaTz ? a0 : '';
        const g = adaTz ? 1 : 0;
        const y = nArg(g), bln = nArg(g + 1), tgl = nArg(g + 2);
        if (y == null || bln == null || tgl == null) return null;
        return keStempel(tz, y, bln, tgl, nArg(g + 3) ?? 0, nArg(g + 4) ?? 0);
      }
      case 'dayofweek': case 'hour': case 'minute': case 'second':
      case 'year': case 'month': case 'dayofmonth': case 'weekofyear': {
        /* Argumen pertama waktu, kedua zona — keduanya opsional. Kalau
           zonanya tidak disebut, Pine memakai zona bursa; kita memakai
           UTC dan mengatakannya di catatan, bukan menebak. */
        const t = e.arg.length ? nArg(0) : (this.l.times[this.bar] ?? null);
        if (t == null) return null;
        const z = e.arg.length > 1 ? arg(1) : '';
        const w = bagianWaktu(t, typeof z === 'string' ? z : '');
        switch (e.nama) {
          case 'dayofweek': return w.hari;
          case 'hour': return w.jam;
          case 'minute': return w.menit;
          case 'second': return w.detik;
          case 'year': return w.tahun;
          case 'month': return w.bulan;
          case 'dayofmonth': return w.tanggal;
          default: {
            const awal = Date.UTC(w.tahun, 0, 1);
            const kini = Date.UTC(w.tahun, w.bulan - 1, w.tanggal);
            return Math.floor((kini - awal) / 604800000) + 1;
          }
        }
      }
      case 'math.min': { const xs = e.arg.map((_, i) => nArg(i)).filter((x): x is number => x != null); return xs.length ? Math.min(...xs) : null; }
      case 'math.max': { const xs = e.arg.map((_, i) => nArg(i)).filter((x): x is number => x != null); return xs.length ? Math.max(...xs) : null; }
      case 'math.abs': { const x = nArg(0); return x == null ? null : Math.abs(x); }
      case 'math.round': { const x = nArg(0); return x == null ? null : Math.round(x); }
      case 'math.floor': { const x = nArg(0); return x == null ? null : Math.floor(x); }
      case 'math.ceil': { const x = nArg(0); return x == null ? null : Math.ceil(x); }
      case 'math.sqrt': { const x = nArg(0); return x == null || x < 0 ? null : Math.sqrt(x); }
      case 'math.pow': { const x = nArg(0), y = nArg(1); return x == null || y == null ? null : Math.pow(x, y); }
      case 'math.avg': { const xs = e.arg.map((_, i) => nArg(i)).filter((x): x is number => x != null); return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null; }

      /* ── input.* — bawaan skrip ATAU setelan orangnya ────────────────
         Tiap input DIDAFTAR (judul, jenis, grup, bawaan) supaya panel Pine
         bisa menggambar dialog setelannya sendiri seperti TradingView —
         centang tampilkan sinyal, ganti warna, ubah periode — tanpa
         menyunting skripnya. Nilai yang dipilih orangnya menang. */
      case 'input': case 'input.int': case 'input.float': case 'input.bool':
      case 'input.string': case 'input.timeframe': case 'input.source': case 'input.color':
      /* input.time menyimpan STEMPEL WAKTU, dan itu sudah dihasilkan
         timestamp() di argumen bawaannya — jadi ia cukup ikut jalur yang
         sama. Tanpa case ini, `input.time(timestamp(...))` jatuh ke
         "fungsi tidak dikenal" dan seluruh blok tanggal tambahan mati. */
      case 'input.time': {
        const mentah = dapat('defval', 0);
        const bawaan = e.nama === 'input.color'
          ? (typeof mentah === 'string' ? mentah : '#a1a1aa')
          : mentah;
        const judulV = dapat('title', 1);
        const judul = typeof judulV === 'string' ? judulV : '';
        const kunci = judul || `baris ${baris}`;
        if (!this.inputKunci.has(kunci)) {
          this.inputKunci.add(kunci);
          const grupV = e.namaArg.group ? this.eval(e.namaArg.group, baris) : null;
          const pilV = e.namaArg.options ? this.eval(e.namaArg.options, baris) : null;
          const jenis: InputPine['jenis'] =
            e.nama === 'input.bool' ? 'bool'
            : e.nama === 'input.int' ? 'int'
            : e.nama === 'input.float' ? 'float'
            : e.nama === 'input.color' ? 'color'
            : e.nama === 'input.string' ? 'string'
            : e.nama === 'input'
              /* `type=input.integer` gaya v4. DIBACA DARI POHONNYA, bukan
                 dievaluasi: `input.integer` bukan nilai yang dikenal mesin
                 ini, dan mengevaluasinya akan melempar "variabel belum
                 didefinisikan" untuk argumen yang sebenarnya cuma
                 keterangan. Tanpa ini ATR Period tampil sebagai kolom
                 desimal — bisa diisi 10,5 untuk sesuatu yang dihitung
                 dalam jumlah bar. */
              ? (() => {
                  const t = e.namaArg.type;
                  const nm = t && t.j === 'nama' ? t.v : '';
                  if (nm === 'input.integer' || nm === 'input.int') return 'int' as const;
                  if (nm === 'input.bool') return 'bool' as const;
                  if (nm === 'input.string') return 'string' as const;
                  if (nm === 'input.float') return 'float' as const;
                  return typeof bawaan === 'boolean' ? 'bool' as const
                       : typeof bawaan === 'string' ? 'string' as const
                       : 'float' as const;
                })()
              : 'lain';
          this.daftarInput.push({
            kunci, judul: judul || kunci,
            grup: typeof grupV === 'string' ? grupV : '',
            jenis,
            bawaan: bawaan !== null && typeof bawaan === 'object' ? null : bawaan,
            pilihan: pilV !== null && typeof pilV === 'object' && 'isi' in (pilV as NilaiArray)
              ? (pilV as NilaiArray).isi.filter((x): x is string => typeof x === 'string')
              : undefined,
          });
        }
        const atur = this.setelan[kunci];
        return atur !== undefined ? atur : bawaan;
      }

      /* ── warna ── */
      case 'color.new': {
        const c = arg(0), t = nArg(1) ?? 0;
        return typeof c === 'string' ? warnaTransp(c, t) : '#a1a1aa';
      }
      case 'color.rgb': {
        const r = nArg(0) ?? 0, g = nArg(1) ?? 0, b = nArg(2) ?? 0;
        return `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
      }

      /* ── ta.* — sumber bawaan, panjang konstan; dihitung sekali ── */
      case 'ta.atr': { const p = nArg(0) ?? 14; return this.taCache(`atr${p}`, () => atrDeret(l.highs, l.lows, l.closes, Math.round(p))); }
      case 'ta.pivothigh': case 'ta.pivotlow': {
        const tinggi = e.nama === 'ta.pivothigh';
        let kiri: number, kanan: number;
        if (e.arg.length >= 3) { kiri = nArg(1) ?? 5; kanan = nArg(2) ?? 5; }
        else { kiri = nArg(0) ?? 5; kanan = nArg(1) ?? kiri; }
        return this.taCache(`piv${tinggi}${kiri},${kanan}`, () =>
          pivotDeret(tinggi ? l.highs : l.lows, Math.round(kiri), Math.round(kanan), tinggi));
      }
      case 'ta.highest': case 'ta.lowest': {
        const maks = e.nama === 'ta.highest';
        const sumber = e.arg.length >= 2 && e.arg[0].j === 'nama' ? this.deretBawaan(e.arg[0].v) : (maks ? l.highs : l.lows);
        const p = Math.round((e.arg.length >= 2 ? nArg(1) : nArg(0)) ?? 14);
        const src = sumber ?? (maks ? l.highs : l.lows);
        return this.taCache(`${e.nama}${p}:${e.arg[0]?.j === 'nama' ? e.arg[0].v : ''}`, () => {
          const out: (number | null)[] = new Array(this.n).fill(null);
          for (let i = p - 1; i < this.n; i++) {
            let best = src[i - p + 1];
            for (let j = i - p + 2; j <= i; j++) best = maks ? Math.max(best, src[j]) : Math.min(best, src[j]);
            out[i] = best;
          }
          return out;
        });
      }
      case 'ta.sma': case 'ta.ema': case 'ta.rma': case 'ta.rsi': case 'ta.change': {
        const namaSrc = e.arg[0]?.j === 'nama' ? e.arg[0].v : 'close';
        const src = this.deretBawaan(namaSrc) ?? l.closes;
        const p = Math.round(nArg(1) ?? (e.nama === 'ta.change' ? 1 : 14));
        return this.taCache(`${e.nama}${p}:${namaSrc}`, () => {
          const n = this.n, out: (number | null)[] = new Array(n).fill(null);
          if (e.nama === 'ta.change') { for (let i = p; i < n; i++) out[i] = src[i] - src[i - p]; return out; }
          if (e.nama === 'ta.sma') {
            let s = 0;
            for (let i = 0; i < n; i++) { s += src[i]; if (i >= p) s -= src[i - p]; if (i >= p - 1) out[i] = s / p; }
            return out;
          }
          /* ema / rma / rsi */
          const alfa = e.nama === 'ta.ema' ? 2 / (p + 1) : 1 / p;
          if (e.nama === 'ta.rsi') {
            let up: number | null = null, dn: number | null = null;
            let su = 0, sd = 0;
            for (let i = 1; i < n; i++) {
              const naik = Math.max(0, src[i] - src[i - 1]), turun = Math.max(0, src[i - 1] - src[i]);
              if (up === null) {
                su += naik; sd += turun;
                if (i === p) { up = su / p; dn = sd / p; out[i] = dn === 0 ? 100 : 100 - 100 / (1 + up / dn); }
              } else {
                up = (up * (p - 1) + naik) / p; dn = ((dn as number) * (p - 1) + turun) / p;
                out[i] = dn === 0 ? 100 : 100 - 100 / (1 + up / dn);
              }
            }
            return out;
          }
          let acc: number | null = null, s = 0;
          for (let i = 0; i < n; i++) {
            if (acc === null) { s += src[i]; if (i === p - 1) { acc = s / p; out[i] = acc; } }
            else { acc = acc + alfa * (src[i] - acc); out[i] = acc; }
          }
          return out;
        });
      }

      /* ── array ── */
      case 'array.new': case 'array.new_float': case 'array.new_int': case 'array.new_bool':
      case 'array.new_string': case 'array.new_line': case 'array.new_label': case 'array.new_box':
        return { jenis: 'array', isi: [] };
      /* array.from(...) — dipakai untuk daftar tanggal yang ditulis tangan.
         Argumennya dievaluasi apa adanya, jadi `array.from(timestamp(...),
         timestamp(...))` langsung jadi larik stempel waktu. */
      case 'array.from': return { jenis: 'array', isi: e.arg.map((_, i) => arg(i)) } as NilaiArray;
      /* Ringkasan larik — dipakai indikator siklus untuk merata-ratakan
         panjang cycle sebelumnya lalu memproyeksikan yang berikutnya. */
      case 'array.avg': case 'array.sum': case 'array.min': case 'array.max': {
        const a = arg(0) as NilaiArray;
        if (a?.jenis !== 'array') return null;
        const xs = a.isi.map((v) => this.angka(v)).filter((x): x is number => x != null);
        if (!xs.length) return null;
        if (e.nama === 'array.min') return Math.min(...xs);
        if (e.nama === 'array.max') return Math.max(...xs);
        const jum = xs.reduce((s, x) => s + x, 0);
        return e.nama === 'array.sum' ? jum : jum / xs.length;
      }
      case 'array.push': { const a = arg(0) as NilaiArray; if (a?.jenis === 'array') a.isi.push(arg(1)); return null; }
      case 'array.pop': { const a = arg(0) as NilaiArray; return a?.jenis === 'array' ? (a.isi.pop() ?? null) : null; }
      case 'array.shift': { const a = arg(0) as NilaiArray; return a?.jenis === 'array' ? (a.isi.shift() ?? null) : null; }
      case 'array.unshift': { const a = arg(0) as NilaiArray; if (a?.jenis === 'array') a.isi.unshift(arg(1)); return null; }
      case 'array.size': { const a = arg(0) as NilaiArray; return a?.jenis === 'array' ? a.isi.length : 0; }
      case 'array.get': { const a = arg(0) as NilaiArray; const i = nArg(1); return a?.jenis === 'array' && i != null ? (a.isi[Math.round(i)] ?? null) : null; }
      case 'array.set': { const a = arg(0) as NilaiArray; const i = nArg(1); if (a?.jenis === 'array' && i != null) a.isi[Math.round(i)] = arg(2); return null; }
      case 'array.clear': { const a = arg(0) as NilaiArray; if (a?.jenis === 'array') a.isi.length = 0; return null; }

      /* ── gambar ── */
      case 'line.new': {
        const id = this.idGambar++;
        this.gambar.set(id, {
          jenis: 'line',
          data: {
            x1: dapat('x1', 0), y1: dapat('y1', 1), x2: dapat('x2', 2), y2: dapat('y2', 3),
            extend: dapat('extend', -1) ?? 'extend.none',
            color: warnaOpsi('color', -1, '#a1a1aa'),
            width: dapat('width', -1) ?? 1,
            style: dapat('style', -1) ?? 'line.style_solid',
          },
        });
        return { jenis: 'line', id };
      }
      case 'line.delete': { const r = arg(0) as RefGambar; if (r?.jenis === 'line') this.gambar.delete(r.id); return null; }
      case 'line.set_xy2': {
        const r = arg(0) as RefGambar;
        const g = r?.jenis === 'line' ? this.gambar.get(r.id) : undefined;
        if (g) { g.data.x2 = arg(1); g.data.y2 = arg(2); }
        return null;
      }
      case 'line.set_xy1': {
        const r = arg(0) as RefGambar;
        const g = r?.jenis === 'line' ? this.gambar.get(r.id) : undefined;
        if (g) { g.data.x1 = arg(1); g.data.y1 = arg(2); }
        return null;
      }
      /* line.copy — duplikat garis: beginilah skrip channel membuat garis
         paralelnya. Salinannya mandiri; mengubah salinan tidak menyentuh
         aslinya, persis Pine. */
      case 'line.copy': case 'label.copy': case 'box.copy': {
        const r = arg(0) as RefGambar;
        const g = r && typeof r === 'object' && 'id' in r ? this.gambar.get(r.id) : undefined;
        if (!g) return null;
        const id = this.idGambar++;
        this.gambar.set(id, { jenis: g.jenis, data: { ...g.data } });
        return { jenis: g.jenis as RefGambar['jenis'], id };
      }
      case 'label.new': {
        const id = this.idGambar++;
        this.gambar.set(id, {
          jenis: 'label',
          data: {
            x: dapat('x', 0), y: dapat('y', 1), text: dapat('text', 2) ?? '',
            style: dapat('style', -1) ?? 'label.style_label_down',
            color: dapat('color', -1) ?? '#a1a1aa',
          },
        });
        return { jenis: 'label', id };
      }
      case 'label.delete': { const r = arg(0) as RefGambar; if (r?.jenis === 'label') this.gambar.delete(r.id); return null; }
      case 'box.new': {
        const id = this.idGambar++;
        this.gambar.set(id, {
          jenis: 'box',
          data: {
            left: dapat('left', 0), top: dapat('top', 1), right: dapat('right', 2), bottom: dapat('bottom', 3),
            bgcolor: warnaOpsi('bgcolor', -1, 'rgba(160,160,160,.15)'),
            border_color: warnaOpsi('border_color', -1, '#a1a1aa'),
          },
        });
        return { jenis: 'box', id };
      }
      case 'box.delete': { const r = arg(0) as RefGambar; if (r?.jenis === 'box') this.gambar.delete(r.id); return null; }

      /* Setter gambar — satu penangan untuk seluruh keluarga set_*. Skrip
         yang menggambar kotak lalu mengubah teks/tepinya tiap bar memakai
         ini terus-menerus; menolak satu setter berarti menolak skripnya. */
      /* Ditangani lewat pola di bawah switch — set_* apa pun. */
      case 'table.new': return { jenis: 'table', id: this.idGambar++ };

      /* request.security: dievaluasi di TIMEFRAME CHART, bukan timeframe
         yang diminta — halaman ini hanya memegang satu deret lilin. Hasilnya
         BERBEDA dari TradingView di bagian yang memang multi-timeframe;
         itu disebut terbuka di catatan, bukan disembunyikan. Menolaknya
         sama sekali membuat seluruh skrip mati karena satu baris. */
      case 'request.security': {
        if (!this.dilewatiSekali.has('request.security')) {
          this.dilewatiSekali.add('request.security');
          this.dilewati.push('request.security() — dievaluasi di timeframe chart (bukan TF yang diminta); hasil bagian multi-TF akan berbeda dari TradingView');
        }
        return arg(2);
      }
      /* linefill.new(garisA, garisB, warna) — ISI di antara dua garis:
         beginilah channel paralel diwarnai tengahnya di TradingView.
         Referensi garisnya disimpan; penerjemahan ke poligon terjadi di
         akhir, saat kedua garisnya sudah selesai di-refit. */
      case 'linefill.new': {
        const id = this.idGambar++;
        this.gambar.set(id, {
          jenis: 'linefill',
          data: { a: arg(0), b: arg(1), color: warnaOpsi('color', 2, 'rgba(96,165,250,.10)') },
        });
        return { jenis: 'linefill', id };
      }
      case 'linefill.delete': { const r = arg(0) as RefGambar; if (r?.jenis === 'linefill') this.gambar.delete(r.id); return null; }

      /* ── keluaran ── */
      case 'plot': {
        const judulV = dapat('title', 1);
        const judul = typeof judulV === 'string' ? judulV : `plot${this.plotNilai.size + 1}`;
        const warnaV = dapat('color', -1);
        let p = this.plotNilai.get(judul);
        if (!p) {
          p = { warna: typeof warnaV === 'string' ? warnaV : '#fbbf24', nilai: new Array(this.n).fill(null) };
          this.plotNilai.set(judul, p);
        }
        if (typeof warnaV === 'string') p.warna = warnaV;
        /* plot(x, color = kondisi ? warna : na): warna na berarti bar ini
           DISEMBUNYIKAN — begitulah plot bersyarat dibuat di Pine. Menaruh
           nilainya dengan warna bawaan menggambar garis yang di TradingView
           tidak pernah ada. */
        if ('color' in e.namaArg && warnaV == null) return null;
        /* linewidth=0 berarti TIDAK DIGAMBAR. Di Pine itu cara membuat plot
           penanda yang cuma dipakai sebagai batas fill -- Supertrend memakai
           `plot(ohlc4, linewidth=0)` persis untuk itu. Tanpa penghormatan
           ini, garis bantu yang di TradingView tak terlihat tergambar di
           sini sebagai garis melintang di tengah lilin: bukan galat, tapi
           jelas bukan indikator yang orangnya tempelkan.

           Nilainya TETAP disimpan -- fill() di bawah membutuhkannya. Yang
           disembunyikan cuma garisnya. */
        const lebarV = this.angka(dapat('linewidth', -1));
        if (lebarV === 0) p.sembunyi = true;
        p.nilai[this.bar] = this.angka(arg(0));
        /* Judulnya dipulangkan sebagai PEGANGAN: `upPlot = plot(...)` lalu
           `fill(mPlot, upPlot, ...)` adalah bentuk baku di Pine, dan tanpa
           nilai balik apa pun fill tidak punya cara menemukan seri mana
           yang dimaksud. */
        return judul;
      }
      case 'plotshape': case 'plotchar': {
        const v = arg(0);
        if (this.benar(v)) {
          const gaya = String(dapat('style', -1) ?? '');
          const lokasi = String(dapat('location', -1) ?? '');
          const warnaV = dapat('color', -1);
          /* HANYA `text`. `title` adalah nama di legenda, BUKAN tulisan di
             chart — TradingView tidak pernah mencetaknya di atas lilin.
             Memakainya sebagai cadangan membuat setiap plotshape berjudul
             ikut menuliskan judulnya: Supertrend jadi bertabur "UpTrend
             Begins" dan "DownTrend Begins" di sepanjang chart, padahal di
             TradingView yang tampil cuma bulatan kecil. */
          const teksV = dapat('text', -1);
          const ofs = this.angka(dapat('offset', -1)) ?? 0;
          const bawah = lokasi.includes('below') || gaya.includes('up');
          const barPos = Math.max(0, Math.min(this.n - 1, this.bar + Math.round(ofs)));
          /* location.absolute berarti "taruh di NILAI yang diberikan", bukan
             di ujung lilin. Supertrend menaruh penandanya tepat di garis
             trennya; dipaksa ke high/low, penandanya melayang jauh dari
             garis yang seharusnya ia tunjuk. */
          const nilaiAbs = this.angka(v);
          const hargaAbs = lokasi.includes('absolute') && nilaiAbs != null && isFinite(nilaiAbs)
            ? nilaiAbs
            : (bawah ? l.lows[barPos] : l.highs[barPos]);
          this.penanda.push({
            bar: barPos,
            harga: hargaAbs,
            teks: typeof teksV === 'string' ? teksV : '',
            warna: typeof warnaV === 'string' ? warnaV : '#a1a1aa',
            posisi: bawah ? 'bawah' : 'atas',
          });
        }
        return null;
      }
      case 'hline': {
        if (this.bar === 0) {
          const v = nArg(0);
          const w = dapat('color', -1);
          if (v != null) this.hlines.push({ nilai: v, warna: typeof w === 'string' ? w : 'rgba(255,255,255,.2)' });
        }
        return null;
      }

      /* ── diabaikan dengan sadar ── */
      case 'indicator': case 'study': case 'strategy':
        if (!this.dilewatiSekali.has(e.nama)) {
          this.dilewatiSekali.add(e.nama);
          this.dilewati.push(`${e.nama}() — dilewati (kosmetik/peringatan di luar panel)`);
        }
        return null;

      case 'fill': {
        /* Bentuk fill(plotA, plotB, color): dua pegangan judul yang
           dipulangkan plot(). Digambar sebagai satu segi empat per bar --
           bentuk yang sama dengan linefill, jadi penggambar kanvasnya tidak
           perlu tahu bedanya.

           Bentuk lain (fill antar hline, fill dengan gradien) belum
           ditangani dan tetap jatuh ke daftar "dilewati" di bawah. */
        const ka = arg(0), kb = arg(1);
        const pa = typeof ka === 'string' ? this.plotNilai.get(ka) : undefined;
        const pb = typeof kb === 'string' ? this.plotNilai.get(kb) : undefined;
        if (pa && pb) {
          if (this.bar > 0) {
            const i = this.bar, j = i - 1;
            const y1a = pa.nilai[j], y1b = pb.nilai[j], y2a = pa.nilai[i], y2b = pb.nilai[i];
            const warnaV = dapat('color', 2);
            /* Bar yang salah satu ujungnya kosong DILEWATI, bukan dijembatani:
               plot bersyarat memang putus saat trennya berbalik, dan
               menyambungnya akan mewarnai daerah yang di TradingView memang
               kosong. */
            if (y1a != null && y1b != null && y2a != null && y2b != null && typeof warnaV === 'string') {
              /* Bawaan transp fill di Pine 90 -- nyaris tembus pandang.
                 Memakai warna pekat apa adanya akan menutupi lilin yang
                 justru sedang dibaca. */
              const tr = this.angka(dapat('transp', -1));
              this.isianPlot.push({
                x1: j, y1a, y1b, x2: i, y2a, y2b,
                warna: warnaTransp(warnaV, tr == null ? 90 : tr),
                perpanjang: 'none',
              });
            }
          }
          return null;
        }
        if (!this.dilewatiSekali.has(e.nama)) {
          this.dilewatiSekali.add(e.nama);
          this.dilewati.push(`${e.nama}() — bentuk ini dilewati (hanya fill antar plot yang digambar)`);
        }
        return null;
      }
      case 'alert': case 'alertcondition': case 'bgcolor': case 'barcolor':
      case 'table.cell': case 'table.clear':
        if (!this.dilewatiSekali.has(e.nama)) {
          this.dilewatiSekali.add(e.nama);
          this.dilewati.push(`${e.nama}() — dilewati (kosmetik/peringatan di luar panel)`);
        }
        return null;
    }

    /* Setter gambar generik: (line|label|box).set_<apa pun>. Keluarga ini
       puluhan anggotanya dan skrip nyata memakai kombinasi yang berbeda-
       beda; mendaftar satu-satu berarti selalu ketinggalan satu. Properti
       yang tidak dikenal penggambar cukup tersimpan tanpa efek — lebih baik
       daripada menghentikan skrip. */
    const setM = /^(line|label|box)\.set_([a-z0-9_]+)$/.exec(e.nama);
    if (setM) {
      const r = arg(0) as RefGambar;
      const g = r && typeof r === 'object' && 'id' in r ? this.gambar.get(r.id) : undefined;
      if (g) {
        const prop = setM[2];
        if (prop === 'xy') { g.data.x = arg(1); g.data.y = arg(2); }
        else if (prop === 'lefttop') { g.data.left = arg(1); g.data.top = arg(2); }
        else if (prop === 'rightbottom') { g.data.right = arg(1); g.data.bottom = arg(2); }
        else g.data[prop] = arg(1);
      }
      return null;
    }
    /* Getter gambar generik — get_x1/get_price dsb. */
    const getM = /^(line|label|box)\.get_([a-z0-9_]+)$/.exec(e.nama);
    if (getM) {
      const r = arg(0) as RefGambar;
      const g = r && typeof r === 'object' && 'id' in r ? this.gambar.get(r.id) : undefined;
      return g ? (g.data[getM[2]] ?? null) : null;
    }

    /* Fungsi buatan skrip — parameter dibayangi lalu dipulihkan; badan
       multi-baris dijalankan sebagai pernyataan, nilai baliknya nilai
       pernyataan terakhir (ekspresi atau penetapan), meniru Pine. */
    const f = this.fungsi.get(e.nama);
    if (f) {
      if (++this.kedalamanFungsi > 40) { this.kedalamanFungsi = 0; this.err(baris, 'fungsi terlalu dalam (rekursif?)'); }
      const simpan = f.param.map((p) => [p, this.lingkup.get(p)] as const);
      f.param.forEach((p, i) => this.lingkup.set(p, arg(i)));
      let hasil: Nilai = null;
      if (f.e) {
        hasil = this.eval(f.e, baris);
      } else if (f.isi.length) {
        const akhir = f.isi[f.isi.length - 1];
        this.jalankanStmt(f.isi.slice(0, -1));
        if (akhir.j === 'ekspresi') hasil = this.eval(akhir.e, baris);
        else { this.jalankanStmt([akhir]); hasil = akhir.j === 'tugas' ? (this.lingkup.get(akhir.nama) ?? null) : null; }
      }
      simpan.forEach(([p, v]) => (v === undefined ? this.lingkup.delete(p) : this.lingkup.set(p, v)));
      this.kedalamanFungsi--;
      return hasil;
    }

    this.err(baris, `fungsi "${e.nama}" belum didukung`);
  }
}

/* ── Deteksi: skrip ini butuh mesin per-bar? ─────────────────────────── */
export function butuhPerBar(kode: string): boolean {
  return /^\s*(if|for)\b|:=|=>|^var\s|\barray\.|line\.new|label\.new|box\.new|barstate\.|bar_index/m.test(kode);
}

/* ── Titik masuk ─────────────────────────────────────────────────────── */
export function jalankanPineBar(kode: string, l: Lilin, tf = '4h',
                                setelan: Record<string, number | boolean | string> = {}): HasilPineBar {
  const n = l.closes.length;
  const galat: string[] = [];
  const dilewati: string[] = [];

  /* Baris → daftar dengan indentasi; sambung baris berkurung belum tutup. */
  const mentah = kode.split(/\r?\n/);
  const baris: { teks: string; no: number; indent: number }[] = [];
  for (let i = 0; i < mentah.length; i++) {
    /* Komentar dibuang PER BARIS, sebelum penggabungan — lihat alasannya
       di buangKomentar(). */
    let teks = buangKomentar(mentah[i]);
    const no = i + 1;
    const hitung = (s: string) => {
      let d = 0, dalam: string | null = null;
      for (const c of s) {
        if (dalam) { if (c === dalam) dalam = null; continue; }
        if (c === '"' || c === "'") dalam = c;
        else if (c === '(' || c === '[') d++;
        else if (c === ')' || c === ']') d--;
      }
      return d;
    };
    let saldo = hitung(teks);
    while (i + 1 < mentah.length) {
      const berikut = buangKomentar(mentah[i + 1]);
      /* Kurung belum tutup -> pasti sambung. Kurung sudah seimbang ->
         sambung hanya kalau barisnya berakhir dengan operator menggantung
         DAN masih ada isi di baris berikutnya (baris kosong mengakhiri
         pernyataan, bukan menunggunya). */
      if (!(saldo > 0 || (belumSelesaiPine(teks) && berikut.trim() !== ''))) break;
      i++;
      teks += ' ' + berikut.trim();
      saldo += hitung(berikut);
    }
    if (!teks.trim()) continue;
    const indent = /^\s*/.exec(teks)![0].replace(/\t/g, '    ').length;
    baris.push({ teks: teks.trim(), no, indent });
  }

  /* Urai seluruh program sekali. Galat urai menghentikan (dengan nomor
     baris) — program setengah terurai akan berjalan setengah benar, dan
     itu lebih berbahaya daripada tidak jalan. */
  let program: Stmt[];
  try {
    program = uraiBlok(
      [{ teks: '', no: 0, indent: -1 }, ...baris].slice(1).map((b) => ({ ...b, indent: b.indent + 1 })),
      0, 0, dilewati
    ).stmt;
  } catch (e) {
    const g = e instanceof GalatBaris ? `baris ${e.baris}: ${e.message}` : (e instanceof Error ? e.message : 'gagal diurai');
    return { plotSeri: [], segmen: [], penanda: [], kotak: [], isian: [], input: [], hline: [], galat: [g], dilewati };
  }

  const mesin = new Mesin(l, n, dilewati, tf, setelan);
  const namaTugas = new Set<string>();
  const kumpulNama = (ss: Stmt[]) => ss.forEach((s) => {
    if (s.j === 'tugas') namaTugas.add(s.nama);
    if (s.j === 'if') s.cabang.forEach((c) => kumpulNama(c.isi));
    if (s.j === 'for' || s.j === 'while') kumpulNama(s.isi);
  });
  kumpulNama(program);

  for (let bar = 0; bar < n; bar++) {
    mesin.bar = bar;
    mesin.lingkup = new Map();
    try {
      mesin.jalankanStmt(program);
    } catch (e) {
      const pesan = e instanceof GalatBaris ? `baris ${e.baris}: ${e.message}` : (e instanceof Error ? e.message : 'galat');
      if (!galat.includes(pesan)) galat.push(pesan);
      if (galat.length > 20) break;
    }
    /* Riwayat: nilai bar ini disimpan supaya `x[1]` bar depan membacanya. */
    for (const nama of namaTugas) {
      const v = mesin.lingkup.has(nama) ? mesin.lingkup.get(nama)! : (mesin.varPersisten.get(nama) ?? null);
      let riw = mesin.riwayat.get(nama);
      if (!riw) { riw = []; mesin.riwayat.set(nama, riw); }
      riw.push(typeof v === 'object' ? null : v);
      if (riw.length > 500) riw.shift();
    }
  }

  /* ── Objek gambar → bentuk chart kita ─────────────────────────────── */
  const segmen: SegmenPine[] = [];
  const kotak: KotakPine[] = [];
  const isian: IsianPine[] = [...mesin.isianPlot];
  for (const g of mesin.gambar.values()) {
    const d = g.data;
    const num = (v: Nilai) => (typeof v === 'number' && isFinite(v) ? v : null);
    if (g.jenis === 'line') {
      const x1 = num(d.x1), y1 = num(d.y1), x2 = num(d.x2), y2 = num(d.y2);
      if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
      /* Warna na = garis yang sengaja tak terlihat (pegangan linefill,
         atau garis yang disembunyikan bersyarat) — dilewati, bukan
         dikelabukan. */
      if (typeof d.color !== 'string') continue;
      const gayaS = String(d.style ?? '');
      const ext = String(d.extend ?? '');
      segmen.push({
        x1, y1, x2, y2,
        warna: d.color,
        lebar: num(d.width) ?? 1,
        gaya: gayaS.includes('dash') ? 'dashed' : gayaS.includes('dot') ? 'dotted' : 'solid',
        perpanjang: ext.includes('both') ? 'both' : ext.includes('left') ? 'left' : ext.includes('right') ? 'right' : 'none',
      });
    } else if (g.jenis === 'label') {
      const x = num(d.x), y = num(d.y);
      if (x == null || y == null) continue;
      const gaya = String(d.style ?? '');
      mesin.penanda.push({
        bar: Math.max(0, Math.min(n - 1, Math.round(x))), harga: y,
        teks: String(d.text ?? ''),
        warna: typeof d.color === 'string' ? d.color : '#a1a1aa',
        posisi: gaya.includes('_up') ? 'bawah' : 'atas',
      });
    } else if (g.jenis === 'box') {
      const kiri = num(d.left), atas = num(d.top), kanan = num(d.right), bawah = num(d.bottom);
      if (kiri == null || atas == null || kanan == null || bawah == null) continue;
      const warnaIsi = typeof d.bgcolor === 'string' ? d.bgcolor : null;
      const warnaTepi = typeof d.border_color === 'string' ? d.border_color : null;
      if (warnaIsi === null && warnaTepi === null) continue;
      kotak.push({ kiri, atas, kanan, bawah, warna: warnaIsi, garis: warnaTepi });
    } else if (g.jenis === 'linefill') {
      /* Poligon di antara dua garis. Garis yang sudah dihapus skripnya
         membuat isiannya ikut hilang — persis TradingView. */
      const amb = (r: Nilai) => (r && typeof r === 'object' && 'id' in r ? mesin.gambar.get((r as RefGambar).id) : undefined);
      const ga = amb(d.a), gb = amb(d.b);
      const warna = typeof d.color === 'string' ? d.color : null;
      if (!ga || !gb || ga.jenis !== 'line' || gb.jenis !== 'line' || !warna) continue;
      const ax1 = num(ga.data.x1), ay1 = num(ga.data.y1), ax2 = num(ga.data.x2), ay2 = num(ga.data.y2);
      const bx1 = num(gb.data.x1), by1 = num(gb.data.y1), bx2 = num(gb.data.x2), by2 = num(gb.data.y2);
      if (ax1 == null || ay1 == null || ax2 == null || ay2 == null
        || bx1 == null || by1 == null || bx2 == null || by2 == null) continue;
      const xAwal = Math.min(ax1, bx1), xAkhir = Math.max(ax2, bx2);
      if (xAkhir <= xAwal) continue;
      const nilaiDi = (x1: number, y1: number, x2: number, y2: number, x: number) =>
        x2 === x1 ? y1 : y1 + ((y2 - y1) / (x2 - x1)) * (x - x1);
      const extA = String(ga.data.extend ?? ''), extB = String(gb.data.extend ?? '');
      isian.push({
        x1: xAwal,
        y1a: nilaiDi(ax1, ay1, ax2, ay2, xAwal), y1b: nilaiDi(bx1, by1, bx2, by2, xAwal),
        x2: xAkhir,
        y2a: nilaiDi(ax1, ay1, ax2, ay2, xAkhir), y2b: nilaiDi(bx1, by1, bx2, by2, xAkhir),
        warna,
        perpanjang: extA.includes('right') || extA.includes('both') || extB.includes('right') || extB.includes('both')
          ? 'right' : 'none',
      });
    }
  }

  return {
    plotSeri: [...mesin.plotNilai.entries()]
      .filter(([, p]) => !p.sembunyi)
      .map(([judul, p]) => ({ judul, warna: p.warna, nilai: p.nilai })),
    segmen,
    penanda: mesin.penanda,
    kotak,
    isian,
    input: mesin.daftarInput,
    hline: mesin.hlines,
    galat,
    dilewati,
  };
}
