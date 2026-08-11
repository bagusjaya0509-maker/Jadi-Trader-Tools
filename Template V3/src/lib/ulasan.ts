import { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/data';
import { auth } from '@/lib/firebase';

/* ════════════════════════════════════════════════════════════════════════
   ULASAN PENGGUNA
   ════════════════════════════════════════════════════════════════════════
   Halaman Marketplace memajang "Ulasan Pengguna" dengan keterangan
   "Ditulis langsung oleh pemakai, bukan kutipan pilihan" — sementara isinya
   adalah `TESTIMONI` dari data/porto.ts: empat ulasan karangan, lengkap
   dengan nama dan tanggal, dan tombol "Kirim ulasan" yang tidak melakukan
   apa pun. Itu bukan sekadar data contoh yang belum diganti; itu klaim
   tentang orang lain di halaman jualan.

   Jadi ulasannya dibuat sungguhan. Satu koleksi datar `ulasan/{id}`:

     · dibaca siapa saja — memang untuk dipajang
     · ditulis hanya oleh yang sudah masuk, dan `uid`-nya wajib sama dengan
       uid penulisnya, jadi tidak ada yang bisa mengatasnamakan orang lain
     · dihapus hanya oleh penulisnya sendiri atau pemilik

   Aturan Firestore-lah yang menegakkan itu semua; kode di halaman ini cuma
   antarmukanya, dan siapa pun bisa melewatinya lewat konsol browser.
   ════════════════════════════════════════════════════════════════════════ */

export interface Ulasan {
  id: string;
  uid: string;
  nama: string;
  bintang: number;
  isi: string;
  produk: string;
  waktu: number;
}

export function useUlasan(): { data: Ulasan[]; memuat: boolean; galat: string | null } {
  const [data, setData] = useState<Ulasan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, 'ulasan'),
      (s) => {
        setData(s.docs.map((d): Ulasan => {
          const v = d.data();
          return {
            id: d.id,
            uid: String(v.uid ?? ''),
            nama: String(v.nama ?? 'Pengguna'),
            /* Dijepit 1–5. Nilai di luar itu hanya bisa datang dari tulisan
               langsung ke Firestore, dan bintang ke-9 akan merusak tata
               letaknya tanpa memberi tahu siapa pun kenapa. */
            bintang: Math.min(5, Math.max(1, Number(v.bintang) || 0)),
            isi: String(v.isi ?? ''),
            produk: String(v.produk ?? ''),
            /* serverTimestamp() masih null sesaat setelah ditulis, sebelum
               server menjawab. Jatuh ke sekarang supaya ulasannya tidak
               melompat ke tahun 1970 selama satu detik itu. */
            waktu: v.waktu?.toMillis?.() ?? Date.now(),
          };
        }).sort((a, b) => b.waktu - a.waktu));
        setMemuat(false); setGalat(null);
      },
      (e) => { console.warn('ulasan:', e); setGalat(e.message); setMemuat(false); }
    );
  }, []);

  return { data, memuat, galat };
}

export async function kirimUlasan(u: { bintang: number; isi: string; produk: string }) {
  const p = auth.currentUser;
  if (!p) throw new Error('Masuk dulu untuk menulis ulasan.');
  if (!u.isi.trim()) throw new Error('Tulis dulu ulasannya.');
  if (u.bintang < 1 || u.bintang > 5) throw new Error('Beri bintang 1 sampai 5.');
  await addDoc(collection(db, 'ulasan'), {
    uid: p.uid,
    nama: p.displayName || (p.email ?? '').split('@')[0] || 'Pengguna',
    bintang: u.bintang,
    isi: u.isi.trim().slice(0, 600),
    produk: u.produk,
    /* Waktu server, bukan waktu perangkat. Jam yang salah di satu laptop
       tidak boleh menaruh ulasan di puncak daftar selamanya. */
    waktu: serverTimestamp(),
  });
}

export async function hapusUlasan(id: string) {
  await deleteDoc(doc(db, 'ulasan', id));
}
