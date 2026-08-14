import { auth } from '@/lib/firebase';
import { PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   COPY TRADING — klien untuk rute /api/analisa di VPS
   ════════════════════════════════════════════════════════════════════════
   Analisa disimpan di backend VPS (berkas JSON), bukan Firestore: backend
   tidak punya kredensial admin Firestore, sementara pola berkas+ID-token
   sudah terbukti pada rute lisensi & MT5. Isi terkunci tidak pernah ikut
   daftar publik — ia diminta terpisah dan backend yang memutuskan boleh
   atau tidak, bukan tombol di layar.
   ════════════════════════════════════════════════════════════════════════ */

const DASAR = PROXY_BAWAAN;

export interface RingkasAnalisa {
  id: string; uid: string; nama: string; judul: string; pasangan: string;
  arah: 'BUY' | 'SELL'; harga: number; ringkas: string; dibuat: number;
  jumlahPembeli: number;
  snapshot: { saldo: number; winrate: number; pf: number; jumlah: number; kurva: number[] } | null;
}
export interface IsiAnalisa { entry: number; sl: number; tp: number; alasan: string }
export interface PermintaanMasuk { id: string; judul: string; uid: string; nama: string; bukti: string; waktu: number }

async function idToken(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu untuk memakai Copy Trading.');
  return u.getIdToken();
}

async function panggil(jalur: string, opsi: RequestInit = {}, pakaiToken = true) {
  const kepala: Record<string, string> = { 'Content-Type': 'application/json' };
  if (pakaiToken) kepala.Authorization = `Bearer ${await idToken()}`;
  const r = await fetch(`${DASAR}${jalur}`, { ...opsi, headers: kepala });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j;
}

export async function daftarAnalisa(): Promise<RingkasAnalisa[]> {
  const j = await panggil('/api/analisa', {}, false);
  return j.daftar ?? [];
}

export async function kirimAnalisa(d: {
  judul: string; pasangan: string; arah: 'BUY' | 'SELL'; harga: number;
  ringkas: string; isi: IsiAnalisa; nama: string;
  snapshot: RingkasAnalisa['snapshot'];
}) {
  return panggil('/api/analisa', { method: 'POST', body: JSON.stringify(d) });
}

export async function hapusAnalisa(id: string) {
  return panggil(`/api/analisa?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function bukaIsi(id: string): Promise<IsiAnalisa> {
  const j = await panggil(`/api/analisa/isi?id=${encodeURIComponent(id)}`);
  return j.isi;
}

export async function mintaAkses(id: string, bukti: string, nama: string) {
  return panggil('/api/analisa/minta', { method: 'POST', body: JSON.stringify({ id, bukti, nama }) });
}

export async function statusSaya(): Promise<{ masuk: PermintaanMasuk[]; statusku: Record<string, string> }> {
  const j = await panggil('/api/analisa/saya');
  return { masuk: j.masuk ?? [], statusku: j.statusku ?? {} };
}

export async function putuskanAkses(id: string, uid: string, tindakan: 'setujui' | 'tolak') {
  return panggil('/api/analisa/putuskan', { method: 'POST', body: JSON.stringify({ id, uid, tindakan }) });
}

/* ── Login Discord ──────────────────────────────────────────────────────
   Tombolnya hanya muncul kalau backend menyatakan siap — fitur yang belum
   dikonfigurasi tidak boleh tampil sebagai tombol yang gagal saat diklik. */
export async function discordSiap(): Promise<boolean> {
  try {
    const r = await fetch(`${DASAR}/api/auth/discord/status`);
    const j = await r.json();
    return !!j.siap;
  } catch { return false; }
}

export function mulaiLoginDiscord() {
  const balik = window.location.origin + window.location.pathname;
  window.location.href = `${DASAR}/api/auth/discord?balik=${encodeURIComponent(balik)}`;
}
