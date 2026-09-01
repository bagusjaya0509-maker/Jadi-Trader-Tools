import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   COIN LISTING — menunggui koin presale sampai ia listing
   ════════════════════════════════════════════════════════════════════════
   Dibeli di situs proyeknya, dipegang di dompet sendiri, lalu menunggu.
   Yang dijaga halaman ini cuma satu momen: detik kolamnya muncul di DEX.

   Semua rutenya butuh token dan mengembalikan baris milik pemanggilnya
   saja. Isinya data keuangan pribadi — berapa dolar dibayar untuk berapa
   token — dan tidak ada satu pun bagian darinya yang pernah terbit ke
   pengguna lain, termasuk ke pemilik platform.
   ════════════════════════════════════════════════════════════════════════ */

function dasar(): string {
  return (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
}

async function token(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try { return await u.getIdToken(); } catch { return null; }
}

export interface PasarListing {
  kolam: string;
  nama: string;
  dex: string;
  harga: number;
  likuiditas: number;
  volume24: number;
  fdv: number;
  /** Kapan kolamnya dibuat menurut rantai — bukan kapan kita melihatnya. */
  dibuatKolam: number;
  jumlahKolam: number;
}

export interface FaktaAman {
  diperiksa: number;
  kosong?: boolean;
  bisaCetak?: boolean;
  bisaBekukan?: boolean;
  bisaDiubah?: boolean;
  pajakBeli?: number | null;
  pajakJual?: number | null;
  /** Persen pasokan di 10 dompet teratas. Tinggi ≠ penipuan. */
  terpusat?: number | null;
  pemegang?: number | null;
  namaAsli?: string;
  simbolAsli?: string;
}

export interface KoinPantau {
  alamat: string;
  jaringan: string;
  nama: string;
  simbol: string;
  catatan: string;
  /** Total dolar yang dibayar saat presale. */
  beliUsd: number;
  /** Jumlah token yang diterima. */
  beliToken: number;
  status: 'pantau' | 'listing' | 'berhenti';
  dibuat: number;
  diperiksa: number;
  putaran: number;
  galat?: string;
  /** Kolam yang sudah ada tapi terlalu dangkal untuk disebut listing. */
  benih?: { likuiditas: number; dibuatKolam: number };
  pasar?: PasarListing;
  listingKetahuan?: number;
  /** false = alarmnya belum dimatikan pembacanya. */
  dibaca?: boolean;
  puncakTerlihat?: { harga: number; waktu: number };
  aman?: FaktaAman;
}

export interface InfoJaringan {
  label: string;
  gas: string;
  goplus: string;
  pola: 'evm' | 'sol';
}

export interface IsiListing {
  daftar: KoinPantau[];
  jaringan: Record<string, InfoJaringan>;
  maks: number;
}

async function panggil(jalan: string, opsi?: RequestInit): Promise<any> {
  const t = await token();
  if (!t) return { error: 'Belum masuk.' };
  try {
    const r = await fetch(`${dasar()}${jalan}`, {
      ...opsi,
      headers: {
        ...(opsi?.body ? { 'content-type': 'application/json' } : {}),
        Authorization: 'Bearer ' + t,
      },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j.error || `Gagal (${r.status})` };
    return j;
  } catch (e) {
    return { error: 'Tidak bisa menghubungi server.' };
  }
}

export async function ambilListing(): Promise<IsiListing | null> {
  const j = await panggil('/api/listing');
  if (j.error) return null;
  return { daftar: j.daftar || [], jaringan: j.jaringan || {}, maks: j.maks || 20 };
}

export async function simpanKoin(v: {
  jaringan: string; alamat: string; nama?: string; simbol?: string;
  catatan?: string; beliUsd?: number; beliToken?: number;
}) {
  return panggil('/api/listing', { method: 'POST', body: JSON.stringify(v) });
}

export async function hapusKoin(jaringan: string, alamat: string) {
  return panggil(`/api/listing/${jaringan}/${encodeURIComponent(alamat)}`, { method: 'DELETE' });
}

export async function periksaSekarang(jaringan: string, alamat: string) {
  return panggil('/api/listing/periksa', { method: 'POST', body: JSON.stringify({ jaringan, alamat }) });
}

export async function periksaKeamanan(jaringan: string, alamat: string) {
  return panggil('/api/listing/aman', { method: 'POST', body: JSON.stringify({ jaringan, alamat }) });
}

export async function tandaiDibaca(alamat?: string) {
  return panggil('/api/listing/dibaca', { method: 'POST', body: JSON.stringify({ alamat }) });
}

/* ── Hitungan yang dipakai layar ────────────────────────────────────────
   Ditaruh di sini, bukan di komponen: harga presale muncul di tiga tempat
   berbeda di halaman itu, dan tiga salinan rumus pembagian adalah tiga
   kesempatan untuk tidak sengaja membaginya dengan nol. */

/** Harga per token saat presale, atau null kalau angkanya belum diisi. */
export function hargaPresale(k: KoinPantau): number | null {
  if (!(k.beliUsd > 0) || !(k.beliToken > 0)) return null;
  return k.beliUsd / k.beliToken;
}

/** Berapa kali lipat harga sekarang terhadap harga presale. */
export function kelipatan(k: KoinPantau): number | null {
  const p = hargaPresale(k);
  if (p == null || !k.pasar?.harga) return null;
  return k.pasar.harga / p;
}

/** Nilai token yang dipegang menurut harga kolam terdalam sekarang. */
export function nilaiSekarang(k: KoinPantau): number | null {
  if (!(k.beliToken > 0) || !k.pasar?.harga) return null;
  return k.beliToken * k.pasar.harga;
}

/** Harga sub-sen ditulis penuh, bukan dibulatkan jadi $0.00.
 *  Koin presale hampir selalu hidup di bawah satu sen, dan pembulatan yang
 *  wajar untuk BTC membuat seluruh halaman ini menampilkan angka nol. */
export function tulisHarga(h: number): string {
  if (!h) return '—';
  if (h >= 1) return '$' + h.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (h >= 0.0001) return '$' + h.toFixed(6);
  return '$' + h.toExponential(3).replace('e-', '×10⁻');
}

export function tulisUsd(n: number): string {
  if (!n) return '$0';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + ' M';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + ' jt';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + ' rb';
  return '$' + n.toFixed(0);
}
