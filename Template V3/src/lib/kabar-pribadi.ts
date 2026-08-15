import { useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   KABAR PRIBADI — kejadian yang menimpa AKUN INI, bukan pasar
   ════════════════════════════════════════════════════════════════════════
   Lonceng sebelumnya hanya berisi kabar agen Pemburu Sinyal. Isinya benar
   dan hidup, tapi tidak satu pun peristiwa itu tentang ORANG yang sedang
   melihatnya — jadi loncengnya terasa seperti hiasan yang kebetulan
   berbunyi, bukan alat yang memberitahunya sesuatu.

   Di sini dicatat kejadian yang benar-benar menimpa akunnya: berhasil
   masuk, akses disetujui, masa coba menipis. Kejadiannya NYATA — dipicu
   oleh peristiwa sungguhan di aplikasi, bukan contoh yang ditanam supaya
   loncengnya kelihatan ramai.

   ── KENAPA DI PERAMBAN, BUKAN DI SERVER ────────────────────────────────
   Kejadian ini milik satu orang di satu perangkat, umurnya pendek, dan
   tidak ada yang perlu mengauditnya. Menyimpannya di Firestore berarti
   menambah tulisan pada tiap login untuk data yang hilang pun tidak apa-apa
   — dan kuota baca Firestore sudah pernah habis sekali di proyek ini.

   ── DIKUNCI PER UID ────────────────────────────────────────────────────
   Kuncinya memuat uid. Tanpa itu, dua akun yang bergantian login di satu
   peramban akan saling melihat kabar milik yang lain — kebocoran kecil yang
   terasa besar begitu terjadi sekali.
   ════════════════════════════════════════════════════════════════════════ */

export type JenisKabarPribadi = 'masuk' | 'akses' | 'peringatan';

export interface KabarPribadi {
  /** Sengaja deterministik (mis. `masuk:<waktu login>`) supaya kejadian yang
   *  sama tidak tercatat dua kali saat halaman dimuat ulang. */
  id: string;
  jenis: JenisKabarPribadi;
  judul: string;
  detail: string;
  waktu: number;
}

/* Cukup untuk beberapa hari pemakaian normal, dan tetap jauh di bawah batas
   localStorage. Yang terlama dibuang lebih dulu. */
const BATAS = 30;
const PERISTIWA = 'jt:kabar-pribadi';

function kunci(uid: string) {
  return `jt.kabarPribadi.${uid}`;
}

export function bacaKabarPribadi(uid: string): KabarPribadi[] {
  if (!uid) return [];
  try {
    const isi = JSON.parse(localStorage.getItem(kunci(uid)) ?? '[]');
    return Array.isArray(isi) ? isi.filter((k) => k && k.id && k.judul) : [];
  } catch { return []; }
}

/** Catat satu kejadian. Aman dipanggil berulang: id yang sama diabaikan.
 *  Tidak pernah melempar — lonceng tidak boleh menjatuhkan apa pun. */
export function catatKabarPribadi(uid: string, k: Omit<KabarPribadi, 'waktu'> & { waktu?: number }) {
  if (!uid || !k?.id) return;
  try {
    const lama = bacaKabarPribadi(uid);
    if (lama.some((x) => x.id === k.id)) return;
    const baru = [{ ...k, waktu: k.waktu ?? Date.now() }, ...lama].slice(0, BATAS);
    localStorage.setItem(kunci(uid), JSON.stringify(baru));
    /* Beri tahu tab INI. `storage` hanya berbunyi di tab LAIN, jadi tanpa
       peristiwa buatan ini loncengnya baru berubah setelah pindah halaman —
       persis keluhan yang membuat fitur ini dibuat. */
    window.dispatchEvent(new CustomEvent(PERISTIWA, { detail: uid }));
  } catch { /* penyimpanan penuh atau mode privat — kabar boleh hilang */ }
}

export function useKabarPribadi(uid: string | null | undefined): KabarPribadi[] {
  const [daftar, setDaftar] = useState<KabarPribadi[]>(() => bacaKabarPribadi(uid ?? ''));

  useEffect(() => {
    if (!uid) { setDaftar([]); return; }
    const segarkan = () => setDaftar(bacaKabarPribadi(uid));
    segarkan();
    window.addEventListener(PERISTIWA, segarkan);
    /* Tab lain menulis kabar (mis. login di tab sebelah) — ikut tersegarkan
       di sini supaya dua tab tidak menampilkan lonceng yang berbeda. */
    window.addEventListener('storage', segarkan);
    return () => {
      window.removeEventListener(PERISTIWA, segarkan);
      window.removeEventListener('storage', segarkan);
    };
  }, [uid]);

  return daftar;
}
