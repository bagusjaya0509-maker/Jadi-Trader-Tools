import { useEffect, useState } from 'react';
import { bacaKoneksi } from '@/lib/koneksi';

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

const PROXY_BAWAAN = 'https://103-253-145-38.sslip.io';
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
    const tarik = () => {
      fetch(`${dasar()}/api/kabar`)
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
