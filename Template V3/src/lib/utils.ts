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
