import type { KategoriAset } from '@/data/porto';
import type { PosAset, PosKewajiban } from '@/lib/porto';
import { idBaru } from '@/lib/porto';

/* ════════════════════════════════════════════════════════════════════════
   IMPOR LEMBAR PORTOFOLIO — .xlsx & .csv
   ════════════════════════════════════════════════════════════════════════
   Bentuk yang dibaca adalah lembar yang memang sudah dipakai: dua kolom,
   nama pos di kiri dan nilainya di kanan, dengan beberapa baris ringkasan
   yang harus DILEWATI ("Jumlah Total", "Total Asset", "Porto Bersih") dan
   satu blok kewajiban di bawahnya ("Kredit Mandiri+%", "Jumlah Bons").

   Kenapa tidak memakai SheetJS: paket `xlsx` di npm sudah tidak dirawat di
   sana (SheetJS pindah ke CDN sendiri), dan versi terakhir di npm membawa
   kerentanan yang tidak akan pernah ditambal. Sebuah .xlsx cuma ZIP berisi
   XML, dan peramban sudah punya pengurai XML — yang kurang cuma inflate,
   yang disediakan fflate dengan 8 kB.

   fflate dan pengurainya dimuat MALAS: orang yang tidak pernah mengimpor
   apa pun tidak perlu mengunduh satu byte pun untuk fitur ini.
   ════════════════════════════════════════════════════════════════════════ */

export interface BarisImpor {
  nama: string;
  nilai: number;
  /** Tebakan kategori — pengguna bisa mengubahnya di pratinjau. */
  kategori: KategoriAset | string;
  /** true = kewajiban (bon), bukan aset. */
  kewajiban: boolean;
  /** Ikut disimpan? Baris ringkasan otomatis tidak dicentang. */
  pakai: boolean;
}

/* Baris yang BUKAN pos — ia hasil penjumlahan pos-pos di atasnya. Ikut
   menyimpannya berarti setiap total terhitung dua kali. */
const POLA_RINGKASAN = /^(jumlah|total|porto|asset kotor|liquid|sub ?total|grand ?total)\b/i;

/* Penanda blok kewajiban. Begitu salah satunya terlihat, baris-baris
   sesudahnya dianggap bon sampai akhir lembar. */
const POLA_KEWAJIBAN = /(kredit|flexi|pinjam|hutang|utang|bon|arisan|cicilan|saldo blokir|paylater)/i;

const TEBAK: [RegExp, KategoriAset][] = [
  [/(binance|bybit|okx|kucoin|metamask|trust ?wallet|hyperliquid|dex|kripto|crypto|btc|eth|usdt)/i, 'Kripto'],
  [/(emas|gold|antam|xau|logam)/i, 'Emas'],
  [/(sekuritas|saham|stock|reksa|rdn|exness|mt5|broker|trade-?fi|forex)/i, 'Sekuritas'],
  [/(bank|bca|bri|bni|mandiri|smbc|sea ?bank|jago|jenius|permata|cimb)/i, 'Bank'],
  [/(ovo|gopay|dana|shopee|linkaja|e-?wallet|wallet)/i, 'E-Wallet'],
  [/(cash|tunai|valas|kas)/i, 'Tunai'],
];

function tebakKategori(nama: string): KategoriAset {
  for (const [pola, kat] of TEBAK) if (pola.test(nama)) return kat;
  return 'Bank';
}

/** "25.650.000" / "Rp 25,650,000" / "(6.275.420)" -> angka.
 *
 *  Format Indonesia memakai titik sebagai pemisah ribuan, jadi
 *  `Number("25.650.000")` menghasilkan NaN dan `parseFloat` menghasilkan
 *  25,65 — dua kesalahan yang sama-sama diam. Tanda kurung berarti negatif;
 *  itu konvensi akuntansi yang dipakai lembar aslinya. */
export function keAngka(teks: string): number | null {
  let s = String(teks).trim();
  if (!s || s === '-' || s === '–') return null;
  const negatif = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()]/g, '').replace(/rp/i, '').replace(/\s/g, '').replace(/^-/, '');
  /* Kalau ada koma DAN titik, yang terakhir muncul adalah pemisah desimal. */
  const koma = s.lastIndexOf(','), titik = s.lastIndexOf('.');
  if (koma >= 0 && titik >= 0) {
    s = koma > titik ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (koma >= 0) {
    /* Satu koma dengan tepat 3 digit di belakang hampir pasti ribuan
       ("1,169,000" yang sudah terpotong), bukan desimal. */
    s = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else {
    s = s.replace(/\.(?=\d{3}\b)/g, '');
  }
  const n = Number(s);
  return isFinite(n) ? (negatif ? -n : n) : null;
}

/** Baris mentah (array sel) -> daftar pos yang bisa dipratinjau. */
export function keBaris(baris: string[][]): BarisImpor[] {
  const keluar: BarisImpor[] = [];
  let modeKewajiban = false;

  for (const sel of baris) {
    /* Nama = sel teks pertama yang bukan tanggal; nilai = sel angka
       TERAKHIR di baris itu. Lembar aslinya punya kolom tanggal kosong di
       kiri, dan mengambil angka pertama akan menangkap tahunnya. */
    const nama = sel.find((c) => c && !/^\d{1,2}[-/]\w{3}[-/]\d{2,4}$/.test(c.trim()) && keAngka(c) === null)?.trim();
    if (!nama) continue;

    let nilai: number | null = null;
    for (let i = sel.length - 1; i >= 0; i--) {
      const n = keAngka(sel[i]);
      if (n !== null) { nilai = n; break; }
    }
    if (nilai === null) {
      /* Baris berjudul tanpa angka — biasanya kepala blok. Dipakai sebagai
         penanda kalau ia menyebut kewajiban. */
      if (POLA_KEWAJIBAN.test(nama)) modeKewajiban = true;
      continue;
    }

    const ringkasan = POLA_RINGKASAN.test(nama);
    if (!ringkasan && POLA_KEWAJIBAN.test(nama)) modeKewajiban = true;

    keluar.push({
      nama,
      nilai: Math.abs(nilai),
      kategori: modeKewajiban ? '' : tebakKategori(nama),
      kewajiban: modeKewajiban,
      /* Baris ringkasan ikut ditampilkan tapi TIDAK dicentang — supaya
         terlihat bahwa ia terbaca dan sengaja dilewati, bukan hilang. */
      pakai: !ringkasan,
    });
  }
  return keluar;
}

/* ── CSV ─────────────────────────────────────────────────────────────── */
function uraiCsv(teks: string): string[][] {
  const baris: string[][] = [];
  let sel = '', kini: string[] = [], dalamKutip = false;
  /* Pemisahnya dideteksi: Excel Indonesia menyimpan CSV dengan titik koma
     karena koma sudah dipakai sebagai desimal. Membaca titik koma sebagai
     teks biasa membuat seluruh baris jadi satu sel. */
  const pemisah = (teks.split('\n')[0].match(/;/g)?.length ?? 0) > (teks.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';

  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (dalamKutip) {
      if (c === '"') { if (teks[i + 1] === '"') { sel += '"'; i++; } else dalamKutip = false; }
      else sel += c;
    } else if (c === '"') dalamKutip = true;
    else if (c === pemisah) { kini.push(sel); sel = ''; }
    else if (c === '\n') { kini.push(sel); baris.push(kini); kini = []; sel = ''; }
    else if (c !== '\r') sel += c;
  }
  if (sel || kini.length) { kini.push(sel); baris.push(kini); }
  return baris;
}

/* ── XLSX ────────────────────────────────────────────────────────────── */
async function uraiXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const isi = unzipSync(new Uint8Array(buf));

  const ambil = (jalur: string) => (isi[jalur] ? strFromU8(isi[jalur]) : '');
  const xml = new DOMParser();

  /* sharedStrings: Excel menyimpan teks berulang sekali saja lalu merujuknya
     lewat indeks. Tanpa membacanya, semua sel teks terbaca sebagai angka. */
  const bersama: string[] = [];
  const ss = ambil('xl/sharedStrings.xml');
  if (ss) {
    const d = xml.parseFromString(ss, 'application/xml');
    d.querySelectorAll('si').forEach((si) => {
      /* Teks bisa terpecah ke banyak <t> kalau sebagian diformat berbeda. */
      bersama.push([...si.querySelectorAll('t')].map((x) => x.textContent ?? '').join(''));
    });
  }

  /* Lembar pertama. Nomor berkasnya tidak selalu sheet1.xml kalau ada lembar
     yang pernah dihapus, jadi diambil yang ada. */
  const namaLembar = Object.keys(isi).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort();
  if (!namaLembar.length) throw new Error('Berkas ini bukan .xlsx yang bisa dibaca.');
  const d = xml.parseFromString(ambil(namaLembar[0]), 'application/xml');

  const baris: string[][] = [];
  d.querySelectorAll('row').forEach((r) => {
    const sel: string[] = [];
    r.querySelectorAll('c').forEach((c) => {
      const tipe = c.getAttribute('t');
      const v = c.querySelector('v')?.textContent ?? '';
      if (tipe === 's') sel.push(bersama[Number(v)] ?? '');
      else if (tipe === 'inlineStr') sel.push(c.querySelector('t')?.textContent ?? '');
      else sel.push(v);
    });
    if (sel.some((x) => x !== '')) baris.push(sel);
  });
  return baris;
}

/** Titik masuk: berkas apa pun -> daftar pos siap pratinjau. */
export async function bacaLembar(berkas: File): Promise<BarisImpor[]> {
  const nama = berkas.name.toLowerCase();
  if (nama.endsWith('.csv') || nama.endsWith('.txt')) return keBaris(uraiCsv(await berkas.text()));
  if (nama.endsWith('.xlsx')) return keBaris(await uraiXlsx(await berkas.arrayBuffer()));
  if (nama.endsWith('.xls')) {
    /* .xls lama adalah format biner OLE2 yang sama sekali berbeda dari .xlsx.
       Menuliskan penguraiannya di sini akan jadi ratusan baris untuk format
       yang sudah diganti sejak 2007 — dan Excel bisa menyimpan ulang jadi
       .xlsx dengan dua klik. */
    throw new Error('Format .xls lama belum didukung. Simpan ulang sebagai .xlsx atau .csv di Excel.');
  }
  throw new Error('Pilih berkas .xlsx atau .csv.');
}

/** Baris terpilih -> pos siap simpan. */
export function keAsetDanKewajiban(baris: BarisImpor[]) {
  const aset: PosAset[] = [];
  const kewajiban: PosKewajiban[] = [];
  baris.filter((b) => b.pakai).forEach((b) => {
    if (b.kewajiban) kewajiban.push({ id: idBaru(), nama: b.nama, nilai: b.nilai });
    else aset.push({ id: idBaru(), nama: b.nama, nilai: b.nilai, kategori: b.kategori as KategoriAset });
  });
  return { aset, kewajiban };
}
