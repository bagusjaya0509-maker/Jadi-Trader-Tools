import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   PROGRAM REFERRAL — sisi peramban
   ════════════════════════════════════════════════════════════════════════
   Diminta pemilik 8 Sep 2026. Berkas ini cuma tiga hal: menyimpan kode
   rujukan yang datang lewat ?ref=, melaporkannya ke server sesudah orang
   masuk, dan membaca/menulis halaman referral lewat rute bertoken.

   Yang TIDAK ada di sini: hitungan komisi. Semua angka datang dari
   server (referral.js di VPS) yang mencatat komisi hanya dari persetujuan
   berbayar yang sudah terjadi. Angka yang dihitung di peramban bisa
   dikarang siapa saja dari DevTools, dan komisi yang bisa dikarang bukan
   komisi.
   ════════════════════════════════════════════════════════════════════════ */

function dasar() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}

async function kepalaLogin(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu.');
  return { Authorization: 'Bearer ' + (await u.getIdToken()), 'Content-Type': 'application/json' };
}

function kepalaPemilik(): Record<string, string> {
  const t = bacaKoneksi().token.trim();
  if (!t) throw new Error('App Token belum diisi di Integrations.');
  return { 'X-App-Token': t, 'Content-Type': 'application/json' };
}

/* ── Kode yang tersimpan dari ?ref= ──────────────────────────────────────
   Ditulis oleh main.tsx SEBELUM React jalan (supaya router yang menghapus
   query tidak sempat menelannya), dibaca di sini. Kunci dan bentuknya
   harus sama persis dengan yang ada di main.tsx. */
export const KUNCI_REF = 'jt.ref';
const KUNCI_DILAPOR = 'jt.refDilapor';
/* 30 hari: cukup untuk orang yang membaca tautan hari ini dan baru masuk
   minggu depan; tidak selamanya, supaya kode dari setahun lalu tidak
   menempel ke akun yang tidak ada hubungannya. */
const MASA_REF_MS = 30 * 86400000;

export function bacaRefKode(): string {
  try {
    const raw = localStorage.getItem(KUNCI_REF);
    if (!raw) return '';
    const j = JSON.parse(raw) as { kode?: string; waktu?: number };
    if (!j.kode || !/^[A-Z0-9]{4,12}$/.test(j.kode)) return '';
    if (Date.now() - (Number(j.waktu) || 0) > MASA_REF_MS) return '';
    return j.kode;
  } catch { return ''; }
}

/** Dipanggil begitu ada pengguna masuk. Idempoten: sekali dilaporkan
 *  untuk satu uid, tidak dikirim lagi — apa pun jawabannya. Server yang
 *  memutuskan sah atau tidak; peramban cuma menyampaikan. */
export async function laporkanRef(uid: string): Promise<void> {
  const kode = bacaRefKode();
  if (!kode || !uid) return;
  let dilapor: Record<string, number> = {};
  try { dilapor = JSON.parse(localStorage.getItem(KUNCI_DILAPOR) || '{}'); } catch { dilapor = {}; }
  if (dilapor[uid]) return;
  try {
    const r = await fetch(`${dasar()}/api/referral/daftar`, {
      method: 'POST', headers: await kepalaLogin(), body: JSON.stringify({ kode }),
    });
    if (!r.ok) return;
    dilapor[uid] = Date.now();
    try { localStorage.setItem(KUNCI_DILAPOR, JSON.stringify(dilapor)); } catch { /* privat */ }
  } catch { /* jaringan — dicoba lagi di kunjungan berikutnya */ }
}

/* ── Bentuk data ─────────────────────────────────────────────────────── */
export type StatusRujukan = 'belum' | 'gratis' | 'bayar';
export type StatusKomisi = 'siap' | 'diajukan' | 'dibayar' | 'batal';
export type StatusPencairan = 'diajukan' | 'dibayar' | 'ditolak';

export interface SetelanReferral { aktif: boolean; persen: number; minimalRp: number; masaBulan: number }
export interface Rujukan { waktu: number; pengguna: string; email: string; status: StatusRujukan; paket: string; komisiRp: number }
export interface Komisi { id: string; waktu: number; paket: string; dari: string; usd: number; persen: number; jumlahUsd: number; jumlahRp: number; status: StatusKomisi }
export interface Pencairan { id: string; waktu: number; jumlahRp: number; jumlahUsd: number; bank: string; rekening: string; nama: string; status: StatusPencairan; diputusPada: number; catatan: string }
export interface RingkasReferral {
  terdaftar: number; membeli: number;
  totalRp: number; totalUsd: number; siapRp: number; siapUsd: number; diajukanRp: number; dibayarRp: number;
}
export interface DataReferral {
  kode: string; tautan: string; setelan: SetelanReferral; dirujukOleh: string;
  ringkas: RingkasReferral; rujukan: Rujukan[]; komisi: Komisi[]; pencairan: Pencairan[];
}

export async function referralSaya(): Promise<DataReferral> {
  const r = await fetch(`${dasar()}/api/referral/saya`, { headers: await kepalaLogin() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j as DataReferral;
}

export async function ajukanPencairan(b: { nama: string; bank: string; rekening: string }) {
  const r = await fetch(`${dasar()}/api/referral/cair`, {
    method: 'POST', headers: await kepalaLogin(), body: JSON.stringify(b),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j as { ok: boolean; id: string; jumlahRp: number };
}

/* ── Pemilik ─────────────────────────────────────────────────────────── */
export interface PencairanAdmin extends Pencairan { uid: string; email: string; komisiIds: string[] }
export interface KomisiAdmin extends Komisi { perujuk: string; perujukEmail: string; dariEmail: string; kurs: number; permintaanId: string }
export interface PerujukTeratas { uid: string; kode: string; email: string; nama: string; rujukan: number; komisiRp: number; membeli: number }
/** Satu baris = satu kali setelan berubah. Ada karena komisi pernah
 *  berbalik dari 50% ke 20% tanpa jejak apa pun (8 Sep 2026). */
export interface JejakSetelan { waktu: number; sebelum: SetelanReferral; sesudah: SetelanReferral }

export interface DataReferralAdmin {
  setelan: SetelanReferral;
  jejakSetelan?: JejakSetelan[];
  ringkas: { perujuk: number; rujukan: number; komisi: number; totalRp: number; siapRp: number; diajukanRp: number; dibayarRp: number; pencairanMenunggu: number };
  pencairan: PencairanAdmin[]; komisi: KomisiAdmin[]; perujukTeratas: PerujukTeratas[];
}

export async function referralAdmin(): Promise<DataReferralAdmin> {
  const r = await fetch(`${dasar()}/api/referral/admin`, { headers: kepalaPemilik() });
  if (r.status === 401) throw new Error('App Token ditolak.');
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j as DataReferralAdmin;
}

export async function putuskanPencairan(id: string, tindakan: 'bayar' | 'tolak', catatan = '') {
  const r = await fetch(`${dasar()}/api/referral/admin/pencairan`, {
    method: 'POST', headers: kepalaPemilik(), body: JSON.stringify({ id, tindakan, catatan }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j as { ok: boolean; status: StatusPencairan };
}

export async function simpanSetelanReferral(s: Partial<SetelanReferral>) {
  const r = await fetch(`${dasar()}/api/referral/admin/setelan`, {
    method: 'POST', headers: kepalaPemilik(), body: JSON.stringify(s),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j.setelan as SetelanReferral;
}

/* ── Pembantu tampilan ───────────────────────────────────────────────── */
export const rupiah = (n: number) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
export const dolar = (n: number) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ringkasSetelan = (s: SetelanReferral) =>
  `${s.persen}% · minimal ${rupiah(s.minimalRp)} · ${s.masaBulan} bulan · ${s.aktif ? 'aktif' : 'dijeda'}`;

export const NAMA_PAKET_REF: Record<string, string> = {
  testing: 'Starter 30 hari', premium3: 'Premium 3 bulan', tahunan: 'Tahunan', gratis: 'Akses gratis',
};
export const namaPaketRef = (p: string) => NAMA_PAKET_REF[p] || (p ? p : '—');
