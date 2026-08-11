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
  /** Foto profil Google. Kosong kalau akunnya tidak punya. */
  foto: string;
  /** Email yang SUDAH disensor sebelum ditulis — lihat catatan di `samarkan`. */
  email: string;
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
            foto: String(v.foto ?? ''),
            email: String(v.email ?? ''),
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

/** "bagusjaya0509@gmail.com" -> "bag•••••09@gmail.com".
 *
 *  Disensor DI SINI, sebelum ditulis — bukan saat ditampilkan. Alamat lengkap
 *  yang tersimpan di dokumen publik tetap bisa dibaca siapa pun lewat konsol
 *  peramban, dan menyensornya di layar cuma menyembunyikannya dari mata,
 *  bukan dari pengumpul alamat email.
 *
 *  Yang disisakan cukup untuk dikenali pemiliknya sendiri dan cukup untuk
 *  terlihat sebagai alamat sungguhan, tapi tidak cukup untuk dikirimi surat. */
export function samarkan(email: string) {
  const [nama, domain] = email.split('@');
  if (!nama || !domain) return '';
  if (nama.length <= 4) return `${nama[0]}•••@${domain}`;
  return `${nama.slice(0, 3)}${'•'.repeat(Math.min(5, nama.length - 5))}${nama.slice(-2)}@${domain}`;
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
    foto: p.photoURL ?? '',
    email: samarkan(p.email ?? ''),
    /* Waktu server, bukan waktu perangkat. Jam yang salah di satu laptop
       tidak boleh menaruh ulasan di puncak daftar selamanya. */
    waktu: serverTimestamp(),
  });
}

export async function hapusUlasan(id: string) {
  await deleteDoc(doc(db, 'ulasan', id));
}
