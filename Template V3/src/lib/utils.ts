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

/** "12 menit lalu", "3 jam lalu", "2 hari lalu" — dan tanggal biasa begitu
 *  umurnya lewat sebulan.
 *
 *  ── KENAPA DI SINI, BUKAN DI KOMPONENNYA ───────────────────────────────
 *  Fungsi seperti ini sudah ditulis EMPAT KALI di berkas yang berbeda
 *  (dashboard, kartu-agen-siaga, panel-chart-agen, panel-laporan-pengguna),
 *  masing-masing dengan ambang batasnya sendiri. Akibatnya kejadian yang
 *  sama bisa tertulis "1 jam lalu" di satu panel dan "60 menit lalu" di
 *  panel sebelahnya. Yang kelima tidak ditambahkan; yang ini dipakai
 *  bersama, dan keempat yang lama boleh menyusul kapan saja.
 *
 *  Tanggal dipakai sesudah 30 hari karena di situlah angka relatif berhenti
 *  membantu: "47 hari lalu" menuntut pembacanya menghitung sendiri, sementara
 *  "12 Jul" langsung terbaca. */
export function waktuLalu(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !isFinite(ms) || ms <= 0) return '';
  const jarak = Math.max(0, Date.now() - ms);
  const menit = Math.floor(jarak / 60_000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  return hari < 30 ? `${hari} hari lalu` : tanggalPendek(ms);
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

/** "3 jam 12 menit", "48 menit", "kurang dari semenit".
 *
 *  Tinggal di sini, bukan di gerbang.tsx tempat asalnya, karena sekarang
 *  dipakai tiga layar: pita langganan, pita pratinjau, dan kartu profil.
 *  Satu penulisan berarti ketiganya tidak mungkin membulatkan dengan cara
 *  yang berbeda -- dan sisa waktu yang berbeda di dua sudut layar yang
 *  sama adalah jenis bug yang membuat orang berhenti mempercayai angkanya. */
export function sisaTerbaca(ms: number): string {
  if (ms <= 0) return 'habis';
  const menit = Math.floor(ms / 60_000);
  if (menit < 1) return 'kurang dari semenit';
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  if (jam < 1) return `${menit} menit`;
  return sisaMenit ? `${jam} jam ${sisaMenit} menit` : `${jam} jam`;
}
