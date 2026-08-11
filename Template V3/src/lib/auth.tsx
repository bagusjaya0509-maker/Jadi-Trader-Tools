import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, signInWithCustomToken, signOut,
  type User,
} from 'firebase/auth';
import { app, auth, penyediaGoogle, UID_PEMILIK } from '@/lib/firebase';

/* ════════════════════════════════════════════════════════════════════════
   AUTENTIKASI + STATUS LANGGANAN
   ════════════════════════════════════════════════════════════════════════
   Keduanya digabung dalam satu context karena hampir setiap layar butuh
   keduanya sekaligus, dan memisahkannya berarti dua provider yang selalu
   dipasang berbarengan — abstraksi yang tidak pernah dipakai sendiri.

   MASA COBA. Dokumen `langganan/{uid}` dibuat SEKALI saat login pertama,
   dengan `mulai` = `serverTimestamp()`. Waktu server, bukan waktu perangkat:
   aturan Firestore menolak nilai yang bukan `request.time`, jadi memundurkan
   jam di HP tidak memperpanjang masa coba. Aturan itu juga menolak `update`
   dari pengguna biasa — masa coba tidak bisa di-reset sendiri.

   Kalau pembuatan dokumen gagal (offline, atau aturan menolak), aplikasi
   TIDAK mengunci pengguna. Jurnal seseorang bukan sandera dari kegagalan
   jaringan; yang dilakukan cuma menandai statusnya 'tidakDiketahui' dan
   membiarkan jalan — penjagaan sesungguhnya tetap di sisi server, yang akan
   menolak tulisan kalau memang tidak berhak.
   ════════════════════════════════════════════════════════════════════════ */

/* ── Login Discord: token kustom datang lewat hash ──────────────────────
   Backend VPS menyelesaikan OAuth Discord lalu mengarahkan balik ke sini
   dengan `#discord=<token>`. Diproses SEKALI di muat modul, sebelum router
   sempat menganggapnya alamat halaman — token sekali pakai tidak boleh
   nyangkut di riwayat peramban. */
if (typeof window !== 'undefined' && window.location.hash.startsWith('#discord=')) {
  const token = decodeURIComponent(window.location.hash.slice(9));
  window.history.replaceState(null, '', window.location.pathname + '#/dashboard');
  signInWithCustomToken(auth, token).catch((e) => {
    console.error('Login Discord gagal:', e);
  });
}

const HARI_COBA = 30;
const MS_HARI = 86_400_000;

export type StatusLangganan = 'coba' | 'aktif' | 'habis' | 'tidakDiketahui';

export interface Langganan {
  status: StatusLangganan;
  /** Sisa hari masa coba / langganan. null kalau tidak diketahui. */
  sisaHari: number | null;
  berakhir: Date | null;
}

interface Isi {
  pengguna: User | null;
  memuat: boolean;
  pemilik: boolean;
  langganan: Langganan;
  masuk: () => Promise<void>;
  keluar: () => Promise<void>;
  galat: string | null;
}

const KosongLangganan: Langganan = { status: 'tidakDiketahui', sisaHari: null, berakhir: null };
const Konteks = createContext<Isi | null>(null);

/** Timestamp dioper sebagai argumen karena kelasnya baru ada setelah impor
 *  dinamis di bawah — mengimpornya di puncak berkas justru membatalkan
 *  seluruh gunanya. */
function keTanggal(v: any, Timestamp: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate() as Date;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') { const d = new Date(v); return isNaN(+d) ? null : d; }
  return null;
}

/* Firestore diimpor DINAMIS di sini, dan itu bukan gaya-gayaan: berkas ini
   ada di jalur muat awal, sementara fungsi ini hanya berjalan SESUDAH ada
   yang benar-benar masuk. Dengan impor statis, ±450 kB pustaka Firestore
   ikut terunduh oleh setiap pengunjung halaman depan — termasuk yang cuma
   melihat sekilas lalu pergi. Jedanya jatuh saat login, ketika orangnya
   memang sedang menunggu sesuatu. */
async function bacaAtauBuatLangganan(uid: string): Promise<Langganan> {
  const { getFirestore, doc, getDoc, setDoc, serverTimestamp, Timestamp } =
    await import('firebase/firestore');
  const db = getFirestore(app);
  const ref = doc(db, 'langganan', uid);
  let cuplikan = await getDoc(ref);

  if (!cuplikan.exists()) {
    /* hasOnly(['mulai']) di aturan — jangan tambahkan field lain di sini,
       create-nya akan ditolak seluruhnya. */
    await setDoc(ref, { mulai: serverTimestamp() });
    cuplikan = await getDoc(ref);
  }

  const data = cuplikan.data() ?? {};
  const bayarSampai = keTanggal(data.bayarSampai, Timestamp);
  const skrg = Date.now();

  if (bayarSampai && +bayarSampai > skrg) {
    return {
      status: 'aktif',
      sisaHari: Math.ceil((+bayarSampai - skrg) / MS_HARI),
      berakhir: bayarSampai,
    };
  }

  const mulai = keTanggal(data.mulai, Timestamp);
  if (mulai) {
    const akhir = new Date(+mulai + HARI_COBA * MS_HARI);
    const sisa = Math.ceil((+akhir - skrg) / MS_HARI);
    return { status: sisa > 0 ? 'coba' : 'habis', sisaHari: Math.max(0, sisa), berakhir: akhir };
  }

  return KosongLangganan;
}

export function PenyediaAuth({ children }: { children: React.ReactNode }) {
  const [pengguna, setPengguna] = useState<User | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [langganan, setLangganan] = useState<Langganan>(KosongLangganan);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setPengguna(u);
      if (u) {
        /* Catat kehadiran ke backend supaya halaman Traffic & Sales punya
           daftar klien. Emailnya diambil backend dari ID token yang sudah
           diverifikasi, jadi halaman ini tidak bisa mendaftarkan email orang
           lain. Sengaja tidak di-await: daftar klien tidak boleh menahan
           tampilnya aplikasi. */
        void import('@/lib/admin').then((m) => m.catatKlienHadir());
        try {
          setLangganan(await bacaAtauBuatLangganan(u.uid));
        } catch (e) {
          console.warn('Status langganan tidak terbaca:', e);
          setLangganan(KosongLangganan);
        }
      } else {
        setLangganan(KosongLangganan);
      }
      setMemuat(false);
    });
  }, []);

  const nilai = useMemo<Isi>(() => ({
    pengguna,
    memuat,
    pemilik: pengguna?.uid === UID_PEMILIK,
    langganan,
    galat,
    masuk: async () => {
      setGalat(null);
      try {
        await signInWithPopup(auth, penyediaGoogle);
      } catch (e: any) {
        /* Popup diblokir peramban adalah kejadian biasa, bukan kegagalan —
           alihkan ke mode redirect daripada menyalahkan pengguna. */
        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, penyediaGoogle);
          return;
        }
        if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
        if (e?.code === 'auth/unauthorized-domain') {
          setGalat('Domain ini belum diizinkan di Firebase Console → Authentication → Settings → Authorized domains.');
          return;
        }
        setGalat(e?.message ?? 'Gagal masuk.');
      }
    },
    keluar: () => signOut(auth),
  }), [pengguna, memuat, langganan, galat]);

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

export function useAuth() {
  const k = useContext(Konteks);
  if (!k) throw new Error('useAuth dipakai di luar <PenyediaAuth>');
  return k;
}
