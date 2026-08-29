import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   DOMPET PANTAUAN — on-chain, hanya untuk pemilik
   ════════════════════════════════════════════════════════════════════════
   Fase MENCATAT. Agen membaca posisi dan setiap transaksi dompet perp
   Hyperliquid yang dipilih pemilik; tidak ada order yang dikirim ke mana
   pun, dan belum ada sinyal yang terbit ke publik.

   Digerbangi pemilik bukan karena alamatnya rahasia — alamat dompet memang
   data terbuka — melainkan karena KEPUTUSANNYA belum diuji: siapa yang
   layak dipantau, apalagi disalin, belum punya satu angka pun untuk
   dipertanggungjawabkan.
   ════════════════════════════════════════════════════════════════════════ */

export interface DompetPantau {
  alamat: string;
  nama: string;
  sejak: number;
  aktif?: boolean;
}

export interface PosisiDompet {
  alamat: string; nama: string; koin: string;
  arah: 'LONG' | 'SHORT';
  ukuran: number; entry: number; nilai: number; pnl: number;
  leverage: number; likuidasi: number; nilaiAkun: number;
}

export interface TransaksiDompet {
  waktu: number; alamat: string; nama: string; koin: string;
  arah: 'BUY' | 'SELL';
  /** Istilah Hyperliquid apa adanya: "Open Long", "Close Short", dst. */
  dir: string;
  harga: number; ukuran: number; nilai: number; pnl: number; hash: string;
}

export interface KeadaanDompet {
  dompet: DompetPantau[];
  posisi: PosisiDompet[];
  log: TransaksiDompet[];
  denyut: number;
  galat: string;
}

function dasar(): string {
  return (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
}

async function token(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try { return await u.getIdToken(); } catch { return null; }
}

/** null = tidak bisa bertanya, bukan "kosong". Dua jawaban yang berbeda. */
export async function keadaanDompet(): Promise<KeadaanDompet | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet`, { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) return null;
    const j = await r.json();
    return {
      dompet: Array.isArray(j?.dompet) ? j.dompet : [],
      posisi: Array.isArray(j?.posisi) ? j.posisi : [],
      log: Array.isArray(j?.log) ? j.log : [],
      denyut: Number(j?.denyut) || 0,
      galat: String(j?.galat || ''),
    };
  } catch { return null; }
}

/** Memulangkan pesan galatnya apa adanya: penolakan di sini hampir selalu
 *  "alamatnya salah bentuk" atau "sudah dipantau" — kalimat yang menjelaskan
 *  persis apa yang perlu diperbaiki. */
export async function tambahDompet(alamat: string, nama: string): Promise<{ ok: true } | { ok: false; pesan: string }> {
  const t = await token();
  if (!t) return { ok: false, pesan: 'Belum masuk.' };
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alamat, nama }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, pesan: String(j.error || 'Ditolak server (' + r.status + ').') };
    return { ok: true };
  } catch {
    return { ok: false, pesan: 'Tidak bisa menghubungi server.' };
  }
}

export async function hapusDompet(alamat: string): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet/${encodeURIComponent(alamat)}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + t },
    });
    return r.ok;
  } catch { return false; }
}
