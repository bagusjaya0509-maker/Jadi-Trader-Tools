import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Penggabung className standar shadcn: clsx untuk kondisional, twMerge untuk
 *  menyelesaikan bentrok utility Tailwind (mis. p-4 vs p-6 -> yang terakhir). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ── Pemformat angka ──────────────────────────────────────────────────────
   Ditaruh di sini, bukan diulang di tiap layar: satu-satunya cara memastikan
   $1.234,50 ditulis sama di Beranda, Dashboard, dan Jurnal. */
export function uang(n: number | null | undefined, tanda = false) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  const abs = Math.abs(n);
  const s = abs >= 1000
    ? abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : abs.toFixed(2);
  const awalan = n < 0 ? '-' : tanda && n > 0 ? '+' : '';
  return `${awalan}$${s}`;
}

export function persen(n: number | null | undefined, desimal = 1) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return `${n.toFixed(desimal)}%`;
}

/** Harga kripto rentangnya ekstrem (BTC $64.000 vs BOME $0,00064), jadi jumlah
 *  desimalnya menyesuaikan besaran — bukan dipatok dua angka di belakang koma. */
export function harga(n: number | null | undefined) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  if (n >= 1000) return `$${n.toFixed(2)}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
}

export function tanggalPendek(ms: number) {
  return new Date(ms).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

/** Tanggal angka penuh: `12-08-26` (hari-bulan-tahun).
 *
 *  Dipakai di tempat yang butuh TAHUNNYA ikut terbaca. `tanggalPendek`
 *  sengaja membuang tahun supaya ringkas, dan itu benar untuk rentang yang
 *  jelas-jelas baru — tapi salah untuk cap "terakhir posting": analis yang
 *  berhenti sepuluh bulan lalu tertulis "24 Agu", persis sama dengan yang
 *  memposting kemarin. Yang membaca menyangka kanalnya masih hidup.
 *
 *  Urutan hari-bulan-tahun, bukan bulan-hari: itu urutan yang dipakai di
 *  Indonesia, dan 12-08-26 tidak boleh sempat terbaca sebagai 8 Desember.
 *
 *  `en-GB` dipilih karena ia memang memulangkan dd/mm/yy — locale `id-ID`
 *  memakai garis miring juga, tapi tahunnya empat angka pada sebagian mesin.
 *  Pemisahnya diganti tanda hubung supaya seragam di mana pun ia dirender. */
export function tanggalAngka(ms: number) {
  return new Date(ms)
    .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
    .replace(/\//g, '-');
}
