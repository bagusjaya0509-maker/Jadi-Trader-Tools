import { useEffect, useState } from 'react';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   KABAR AGEN — pemberitahuan dari Pemburu Sinyal
   ════════════════════════════════════════════════════════════════════════
   Agen memantau ruang sinyal komunitas dan menaruh satu kabar di VPS tiap
   kali ada postingan baru. Lonceng situs membacanya di sini.

   Dibaca dari VPS, bukan Firestore, dengan alasan yang sama seperti cache
   dokumen publik: kuota baca Firestore pernah habis dan halaman depan
   tampil kosong. Notifikasi tidak boleh jadi beban kuota — ia diminta tiap
   menit oleh setiap tab yang terbuka.

   Batas yang diakui terbuka: kabar hanya bertambah selagi agennya berjalan
   (tugas terjadwal di Claude Code milik pemilik). Kalau mesinnya mati, yang
   berhenti adalah kabar barunya — kabar lama tetap tersaji.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI_DIBACA = 'jt.kabarDibaca';

export interface KabarAgen {
  id: string;
  judul: string;
  detail: string;
  sumber: string;
  jenis: 'sinyal' | 'pantau';
  pair: string;
  tautan: string;
  waktu: number;
}

function dasar(): string {
  return (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
}

/** Stempel waktu kabar terbaru yang sudah dilihat orangnya. */
export function bacaTerakhirDibaca(): number {
  try { return Number(localStorage.getItem(KUNCI_DIBACA)) || 0; } catch { return 0; }
}

export function tandaiKabarDibaca(waktu: number) {
  try { localStorage.setItem(KUNCI_DIBACA, String(waktu)); } catch { /* privat */ }
}

export function useKabarAgen(): { kabar: KabarAgen[]; belum: number; tandai: () => void } {
  const [kabar, setKabar] = useState<KabarAgen[]>([]);
  const [dibaca, setDibaca] = useState(bacaTerakhirDibaca);

  useEffect(() => {
    let hidup = true;
    /* ── TOKEN IKUT KALAU ADA, DAN TIDAK WAJIB ────────────────────────
        /api/kabar tetap terbuka untuk tamu: lonceng yang kosong sampai
        orangnya login membuat kabar agen — yang memang untuk umum — tidak
        pernah terlihat oleh pengunjung.

        Yang dibuka token ini cuma bagian PRIBADI-nya: pengingat masa akses
        yang dialamatkan lewat uid, satu-satunya jalan menghubungi orang
        yang tidak punya alamat surel. Tanpa token, server mengirim persis
        apa yang ia kirim sebelumnya.

        `getIdToken()` gagal diam-diam kalau sesinya sudah basi; kegagalan
        itu jatuh ke permintaan tanpa token, bukan ke lonceng yang kosong. */
    const tarik = () => {
      void (async () => {
        let kepala: Record<string, string> = {};
        try {
          const { auth } = await import('@/lib/firebase');
          const u = auth.currentUser;
          if (u) kepala = { Authorization: 'Bearer ' + (await u.getIdToken()) };
        } catch { /* tamu, atau sesi basi -> ambil yang umum saja */ }
        tarikDengan(kepala);
      })();
    };
    const tarikDengan = (kepala: Record<string, string>) => {
      fetch(`${dasar()}/api/kabar`, { headers: kepala })
        .then((r) => r.json())
        .then((j) => {
          if (!hidup || !Array.isArray(j?.kabar)) return;
          setKabar(j.kabar.filter((k: KabarAgen) => k && k.judul));
        })
        .catch(() => { /* lonceng sepi lebih baik daripada lonceng karangan */ });
    };
    tarik();
    const jam = setInterval(tarik, 60_000);
    return () => { hidup = false; clearInterval(jam); };
  }, []);

  const belum = kabar.filter((k) => k.waktu > dibaca).length;

  const tandai = () => {
    const paling = kabar.reduce((m, k) => Math.max(m, k.waktu), 0);
    if (paling > 0) { tandaiKabarDibaca(paling); setDibaca(paling); }
  };

  return { kabar, belum, tandai };
}

/** "3 menit lalu" — kabar agen dicap waktu absolut, bukan teks siap pakai
 *  seperti NEWS, karena umurnya dihitung saat dibaca. */
export function umurKabar(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return 'baru saja';
  if (d < 3600) return `${Math.floor(d / 60)} menit lalu`;
  if (d < 86400) return `${Math.floor(d / 3600)} jam lalu`;
  return `${Math.floor(d / 86400)} hari lalu`;
}
