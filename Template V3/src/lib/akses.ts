import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { bacaKoneksi } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   AKSES PERINTIS — 20 gratis, 80 berbayar, 30 hari
   ════════════════════════════════════════════════════════════════════════
   Angka kuotanya hidup di server, bukan di sini. Berkas ini cuma bertanya.
   Penghitung yang dihitung di browser bisa dibaca ulang dengan angka apa
   pun oleh siapa saja yang membuka DevTools, dan kuota yang bisa dikarang
   sendiri bukan kuota.

   Rute kuota sengaja TANPA login: halaman akses harus bisa mengatakan
   "tinggal 19 dari 20" kepada orang yang belum punya akun sama sekali.
   ════════════════════════════════════════════════════════════════════════ */

const PROXY_BAWAAN = 'https://103-253-145-38.sslip.io';

/** bacaKoneksi() sengaja mengembalikan kosong sebelum login — jadi untuk
 *  rute publik alamatnya diambil apa adanya, dengan bawaan VPS. */
function dasar() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}

export interface Kuota {
  gratisTerpakai: number; gratisTotal: number; gratisSisa: number; gratisHabis: boolean;
  bayarTerpakai: number; bayarTotal: number; bayarSisa: number; bayarHabis: boolean;
  hari: number;
  /** Sakelar pemilik di Maintenance. Saat mati, kartu kuota dan tombol minta
   *  DISEMBUNYIKAN — bukan sekadar dimatikan. Kuota yang tetap terpampang
   *  saat pendaftaran tutup cuma mengundang pertanyaan yang jawabannya
   *  "tidak bisa". */
  bukaPermintaan: boolean;
}

export const KUOTA_KOSONG: Kuota = {
  gratisTerpakai: 0, gratisTotal: 20, gratisSisa: 20, gratisHabis: false,
  bayarTerpakai: 0, bayarTotal: 80, bayarSisa: 80, bayarHabis: false, hari: 30,
  /* Bawaan MATI, bukan hidup. Nilai ini dipakai selama jawaban server belum
     datang; kalau hidup, kartu kuota berkedip muncul lalu hilang begitu
     server bilang pendaftaran ditutup. Lebih baik terlambat sedetik daripada
     menampilkan sesuatu yang langsung ditarik kembali. */
  bukaPermintaan: false,
};

/** Link checkout Rp 17.900. Produknya bernama "Request Access". */
export const LINK_BAYAR = 'https://lynk.id/karyahukum_store/66nd63r733k8/checkout';

export type StatusMinta = 'baru' | 'disetujui' | 'ditolak';

export interface Permintaan {
  id: string;
  uid?: string;
  email?: string;
  nama?: string;
  jenis?: 'gratis' | 'bayar';
  produk: string;
  catatan?: string;
  bukti?: string;
  status: StatusMinta;
  waktu: number;
  berakhir?: number;
  kode?: string;
}

async function kepalaLogin(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu.');
  return { Authorization: 'Bearer ' + (await u.getIdToken()), 'Content-Type': 'application/json' };
}

/* ── Publik: sisa kuota ──────────────────────────────────────────────── */
export function useKuota(): { kuota: Kuota; memuat: boolean; galat: string | null; muatUlang: () => void } {
  const [kuota, setKuota] = useState<Kuota>(KUOTA_KOSONG);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [putaran, setPutaran] = useState(0);

  useEffect(() => {
    let hidup = true;
    setMemuat(true);
    fetch(`${dasar()}/api/akses/kuota`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Server menjawab ${r.status}`))))
      .then((j) => { if (hidup) { setKuota({ ...KUOTA_KOSONG, ...j }); setGalat(null); setMemuat(false); } })
      .catch((e) => { if (hidup) { setGalat(e.message); setMemuat(false); } });
    return () => { hidup = false; };
  }, [putaran]);

  return { kuota, memuat, galat, muatUlang: useCallback(() => setPutaran((n) => n + 1), []) };
}

/* ── Pengguna: kirim permintaan & lihat miliknya sendiri ─────────────── */
export async function mintaAkses(opsi: {
  jenis: 'gratis' | 'bayar'; catatan?: string; bukti?: string;
}): Promise<{ ok: boolean; sudahAda?: boolean; id?: string }> {
  const r = await fetch(`${dasar()}/api/lisensi/minta`, {
    method: 'POST',
    headers: await kepalaLogin(),
    body: JSON.stringify({
      jenis: opsi.jenis,
      produk: 'jadi-trader-v3',
      catatan: (opsi.catatan ?? '').slice(0, 300),
      bukti: (opsi.bukti ?? '').slice(0, 300),
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j;
}

export async function permintaanSaya(): Promise<Permintaan[]> {
  const r = await fetch(`${dasar()}/api/lisensi/minta/saya`, { headers: await kepalaLogin() });
  if (!r.ok) throw new Error(`Server menjawab ${r.status}`);
  const j = await r.json();
  return (j.permintaan ?? []) as Permintaan[];
}

/** Tukar kode lisensi jadi akses. Kode diikat ke akun pertama yang
 *  menukarnya — tanpa itu satu kode bisa disebar ke seratus orang dan kuota
 *  20/80 tidak berarti apa-apa. */
export async function aktifkanKode(kode: string) {
  const r = await fetch(`${dasar()}/api/akses/aktifkan`, {
    method: 'POST',
    headers: await kepalaLogin(),
    body: JSON.stringify({ kode: kode.trim().toUpperCase() }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j as { ok: boolean; berakhir?: number; firestoreOk?: boolean };
}

export interface SetelanAkses extends Kuota { bukaPermintaan: boolean; }

/* ── Pemilik: setelan akses ─────────────────────────────────────────── */
export async function bacaSetelanAkses(): Promise<SetelanAkses> {
  const r = await fetch(`${dasar()}/api/akses/setelan`, { headers: kepalaPemilik() });
  if (r.status === 401) throw new Error('App Token ditolak.');
  if (!r.ok) throw new Error(`Server menjawab ${r.status}`);
  return (await r.json()) as SetelanAkses;
}

export async function simpanSetelanAkses(nilai: {
  bukaPermintaan?: boolean; gratisTotal?: number; bayarTotal?: number; hari?: number;
}): Promise<SetelanAkses> {
  const r = await fetch(`${dasar()}/api/akses/setelan`, {
    method: 'POST', headers: kepalaPemilik(), body: JSON.stringify(nilai),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j as SetelanAkses;
}

/* ── Pemilik: daftar & putuskan ──────────────────────────────────────── */
function kepalaPemilik(): Record<string, string> {
  const t = bacaKoneksi().token.trim();
  if (!t) throw new Error('App Token belum diisi di Integrations.');
  return { 'X-App-Token': t, 'Content-Type': 'application/json' };
}

export async function daftarPermintaan(): Promise<{ permintaan: Permintaan[]; baru: number }> {
  const r = await fetch(`${dasar()}/api/lisensi/permintaan`, { headers: kepalaPemilik() });
  if (r.status === 401) throw new Error('App Token ditolak.');
  if (!r.ok) throw new Error(`Server menjawab ${r.status}`);
  const j = await r.json();
  return { permintaan: (j.permintaan ?? []) as Permintaan[], baru: Number(j.baru) || 0 };
}

export async function putuskanPermintaan(id: string, tindakan: 'setujui' | 'tolak') {
  const r = await fetch(`${dasar()}/api/lisensi/permintaan/putuskan`, {
    method: 'POST',
    headers: kepalaPemilik(),
    body: JSON.stringify({ id, tindakan }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j as { ok: boolean; status: string; kode?: string; berakhir?: number; firestoreOk?: boolean };
}

/** Login Discord: backend menyelesaikan OAuth lalu mengarahkan balik dengan
 *  `#discord=<token>`, yang sudah ditangani di lib/auth.tsx saat modul dimuat.
 *
 *  `balik` WAJIB dikirim. Backend mencocokkannya dengan daftar alamat yang
 *  sah sebelum mengarahkan siapa pun — tanpa itu ia menjawab "Alamat balik
 *  tidak dikenal", dan tombolnya cuma menampilkan JSON galat. Daftar itu ada
 *  supaya token login tidak bisa dialihkan ke situs orang lain. */
export function masukDiscord() {
  const balik = window.location.origin + window.location.pathname;
  window.location.href = `${dasar()}/api/auth/discord?balik=${encodeURIComponent(balik)}`;
}
