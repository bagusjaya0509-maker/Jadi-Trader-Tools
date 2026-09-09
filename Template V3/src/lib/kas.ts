/* ═══════════════════════════════════════════════════════════════════════
   kas.ts — catatan pemasukan & pengeluaran (Personal Area → Catatan Kas)
   ═══════════════════════════════════════════════════════════════════════
   TEMPATNYA `users/{uid}/porto/arus`, dokumen yang SUDAH ditulis agen
   pemilik lewat arus.js di VPS sejak Agustus 2026. Halaman ini membaca dan
   menulis ke tempat yang sama, jadi catatan yang pernah dicatat agen
   langsung tampil, dan yang dicatat di sini terbaca agen. Dua sumber
   kebenaran untuk angka uang adalah cara paling pasti membuat keduanya
   salah — komentar itu ada di arus.js, dan berlaku juga di sini.

   Satu dokumen, bukan satu koleksi: pembacaan halaman = satu baca Firestore,
   apa pun jumlah barisnya. Dibatasi 1000 baris terakhir (sekitar 200 KB)
   seperti di arus.js; di atas itu yang tertua digulung keluar. Untuk
   catatan harian itu tiga tahun lebih.

   Aturan Firestore `users/{uid}/{sub=**}` yang sudah terpasang menjaganya:
   hanya pemilik akun yang bisa membaca dan menulis. Bot Telegram menulis
   lewat firebase-admin di VPS, melewati aturan — tapi ke dokumen yang sama.
   ═══════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/data';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';
import type { JenisKas } from '@/lib/urai-kas';

export type { JenisKas };
export { KATEGORI_KELUAR, KATEGORI_MASUK, uraiKas, uraiBanyak, rupiahKas, labelAsing, KURS_CADANGAN } from '@/lib/urai-kas';
export type { PetaKurs, HasilUrai } from '@/lib/urai-kas';

export type Dicatat = 'manual' | 'otomatis' | 'telegram' | 'agen';

export interface BarisKas {
  id: string;
  /** YYYY-MM-DD */
  tanggal: string;
  jenis: JenisKas;
  jumlah: number;
  kategori: string;
  judul: string;
  dicatat: Dicatat;
  /** Tempat uangnya: Bank, E-Wallet, Tunai, Kripto, Sekuritas, Emas. */
  akun?: string;
  /** Ketikan aslinya, kalau lahir dari pengurai — supaya salah baca bisa dilacak. */
  teks?: string;
  /* ── Jejak konversi mata uang ────────────────────────────────────────
     Disimpan supaya angka rupiahnya bisa dipertanggungjawabkan setahun
     lagi. Tanpa kurs yang dipakai, "Rp7.051.448" hanyalah angka yang tidak
     bisa diperiksa ulang — kurs hari ini bukan kurs waktu itu. */
  mataUang?: string;
  jumlahAsli?: number;
  kurs?: number;
}

export const BATAS_BARIS = 1000;

export function idKas(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Nama kategori dari arus.js lama huruf kecil semua ("server", "lainnya").
   Ditampilkan dengan huruf besar di depan supaya sejajar dengan yang baru,
   tanpa mengubah datanya. */
export function namaKategori(k: string): string {
  const s = String(k || 'Lainnya').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Lainnya';
}

function bersihkan(b: Partial<BarisKas>): BarisKas {
  const jumlah = Math.round(Number(b.jumlah));
  if (!Number.isFinite(jumlah) || jumlah <= 0) throw new Error('Jumlah harus angka lebih dari nol.');
  if (jumlah > 1e11) throw new Error('Jumlah tidak masuk akal (lebih dari 100 miliar) — periksa jumlah nolnya.');
  const jenis: JenisKas = b.jenis === 'masuk' ? 'masuk' : 'keluar';
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(b.tanggal)) ? String(b.tanggal) : new Date().toISOString().slice(0, 10);
  const judul = String(b.judul || '').trim().slice(0, 120) || namaKategori(String(b.kategori || 'Lainnya'));
  const baris: BarisKas = {
    id: b.id || idKas(), tanggal, jenis, jumlah,
    kategori: namaKategori(String(b.kategori || 'Lainnya')),
    judul, dicatat: b.dicatat || 'manual',
  };
  /* `undefined` ditolak Firestore — field opsional hanya ikut kalau berisi. */
  if (b.akun) baris.akun = String(b.akun).slice(0, 40);
  if (b.teks) baris.teks = String(b.teks).slice(0, 200);
  if (b.mataUang) baris.mataUang = String(b.mataUang).slice(0, 8);
  if (Number.isFinite(Number(b.jumlahAsli))) baris.jumlahAsli = Number(b.jumlahAsli);
  if (Number.isFinite(Number(b.kurs))) baris.kurs = Number(b.kurs);
  return baris;
}

export interface HasilKas {
  daftar: BarisKas[];
  memuat: boolean;
  galat: string | null;
  /** Ada akun yang login — tanpa ini kotak catat cuma bisa mengurai, tidak menyimpan. */
  siap: boolean;
  tambah: (baris: Array<Partial<BarisKas>>) => Promise<BarisKas[]>;
  hapus: (id: string) => Promise<void>;
}

export function useKas(): HasilKas {
  const { pengguna, memuat: memuatAuth } = useAuth();
  const [daftar, setDaftar] = useState<BarisKas[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (memuatAuth) return;
    if (!pengguna) { setDaftar([]); setMemuat(false); return; }
    setMemuat(true);
    return onSnapshot(doc(db, 'users', pengguna.uid, 'porto', 'arus'),
      (s) => {
        const d = s.data();
        const isi = Array.isArray(d?.transaksi) ? (d!.transaksi as Partial<BarisKas>[]) : [];
        setDaftar(isi.filter((b) => b && b.id && Number(b.jumlah) > 0).map((b) => ({
          id: String(b.id), tanggal: String(b.tanggal || ''), jenis: b.jenis === 'masuk' ? 'masuk' : 'keluar',
          jumlah: Number(b.jumlah) || 0, kategori: namaKategori(String(b.kategori || 'Lainnya')),
          judul: String(b.judul || ''), dicatat: (b.dicatat as Dicatat) || 'agen',
          ...(b.akun ? { akun: String(b.akun) } : {}), ...(b.teks ? { teks: String(b.teks) } : {}),
          ...(b.mataUang ? { mataUang: String(b.mataUang) } : {}),
          ...(Number.isFinite(Number(b.jumlahAsli)) ? { jumlahAsli: Number(b.jumlahAsli) } : {}),
          ...(Number.isFinite(Number(b.kurs)) ? { kurs: Number(b.kurs) } : {}),
        })));
        setMemuat(false); setGalat(null);
      },
      (e) => { console.warn('kas:', e); setGalat(e.message); setMemuat(false); }
    );
  }, [pengguna, memuatAuth]);

  /* Transaksi, bukan setDoc: dua tab (atau tab + Telegram) yang menulis
     bersamaan tidak boleh saling menimpa baris. Firestore mengulang
     transaksinya kalau dokumen berubah di tengah jalan. */
  const tambah = useCallback(async (baris: Array<Partial<BarisKas>>) => {
    if (!pengguna) throw new Error('Masuk dulu untuk menyimpan catatan.');
    const bersih = baris.map(bersihkan);
    const ref = doc(db, 'users', pengguna.uid, 'porto', 'arus');
    await runTransaction(db, async (tx) => {
      const s = await tx.get(ref);
      const lama = Array.isArray(s.data()?.transaksi) ? (s.data()!.transaksi as BarisKas[]) : [];
      const gabung = [...lama, ...bersih].slice(-BATAS_BARIS);
      tx.set(ref, { transaksi: gabung, _updatedAt: Date.now() }, { merge: true });
    });
    return bersih;
  }, [pengguna]);

  const hapus = useCallback(async (id: string) => {
    if (!pengguna) throw new Error('Masuk dulu.');
    const ref = doc(db, 'users', pengguna.uid, 'porto', 'arus');
    await runTransaction(db, async (tx) => {
      const s = await tx.get(ref);
      const lama = Array.isArray(s.data()?.transaksi) ? (s.data()!.transaksi as BarisKas[]) : [];
      tx.set(ref, { transaksi: lama.filter((b) => b.id !== id), _updatedAt: Date.now() }, { merge: true });
    });
  }, [pengguna]);

  return { daftar, memuat, galat, siap: !!pengguna, tambah, hapus };
}

/* ── Ringkasan per bulan ─────────────────────────────────────────────── */
export function kunciBulan(d: Date = new Date()): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
export function geserBulan(kunci: string, n: number): string {
  const [t, b] = kunci.split('-').map(Number);
  return kunciBulan(new Date(t, b - 1 + n, 1));
}
export function namaBulan(kunci: string): string {
  const [t, b] = kunci.split('-').map(Number);
  return new Date(t, b - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}
export function ringkasBulan(daftar: BarisKas[], bulan: string) {
  const isi = daftar.filter((b) => b.tanggal.startsWith(bulan));
  const masuk = isi.filter((b) => b.jenis === 'masuk').reduce((s, b) => s + b.jumlah, 0);
  const keluar = isi.filter((b) => b.jenis === 'keluar').reduce((s, b) => s + b.jumlah, 0);
  const perKategori = (jenis: JenisKas) => {
    const peta = new Map<string, number>();
    for (const b of isi) if (b.jenis === jenis) peta.set(b.kategori, (peta.get(b.kategori) || 0) + b.jumlah);
    return [...peta.entries()].map(([nama, nilai]) => ({ nama, nilai })).sort((a, b) => b.nilai - a.nilai);
  };
  return { isi, masuk, keluar, selisih: masuk - keluar, kategoriKeluar: perKategori('keluar'), kategoriMasuk: perKategori('masuk') };
}

/* ── Tautan Telegram ────────────────────────────────────────────────────
   Kodenya dibuat SERVER, bukan peramban: bot yang menerima "/start KODE"
   harus bisa menemukan uid-nya tanpa menelusuri seluruh koleksi users.
   Server menyimpan kode → uid selama 10 menit; sesudah tersambung, bot
   menulis `users/{uid}/telegram/tautan` dan halaman ini menyimaknya lewat
   Firestore — tidak ada polling ke VPS. */
function dasar() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}
async function kepalaLogin(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu.');
  return { Authorization: 'Bearer ' + (await u.getIdToken()), 'Content-Type': 'application/json' };
}

export interface KodeTelegram { kode: string; bot: string; tautan: string; berlakuDetik: number }

export async function mintaKodeTelegram(): Promise<KodeTelegram> {
  const r = await fetch(`${dasar()}/api/kas/telegram/kode`, { method: 'POST', headers: await kepalaLogin() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Gagal membuat kode (${r.status})`);
  return j as KodeTelegram;
}
export async function lepasTelegram(): Promise<void> {
  const r = await fetch(`${dasar()}/api/kas/telegram/lepas`, { method: 'POST', headers: await kepalaLogin() });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `Gagal melepas (${r.status})`); }
}

export interface TautanTelegram { tgId: string; nama: string; waktu: number }

export function useTautanTelegram(): { tautan: TautanTelegram | null; memuat: boolean } {
  const { pengguna, memuat: memuatAuth } = useAuth();
  const [tautan, setTautan] = useState<TautanTelegram | null>(null);
  const [memuat, setMemuat] = useState(true);
  useEffect(() => {
    if (memuatAuth) return;
    if (!pengguna) { setTautan(null); setMemuat(false); return; }
    return onSnapshot(doc(db, 'users', pengguna.uid, 'telegram', 'tautan'),
      (s) => {
        const d = s.data();
        setTautan(d && d.tgId ? { tgId: String(d.tgId), nama: String(d.nama || ''), waktu: Number(d.waktu) || 0 } : null);
        setMemuat(false);
      },
      () => { setTautan(null); setMemuat(false); }
    );
  }, [pengguna, memuatAuth]);
  return { tautan, memuat };
}
