import { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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

/* ════════════════════════════════════════════════════════════════════════
   SUKA & BALASAN
   ════════════════════════════════════════════════════════════════════════
   Keduanya koleksi DATAR di akar, bukan subkoleksi di dalam tiap ulasan.
   Alasannya jumlah pendengar: subkoleksi berarti satu onSnapshot per
   ulasan, jadi seratus ulasan membuka seratus sambungan. Koleksi datar
   cukup dua — satu untuk semua suka, satu untuk semua balasan — berapa pun
   ulasannya.

   Id dokumen suka sengaja `${ulasanId}__${uid}`, bukan id acak. Itu yang
   membuat satu orang hanya bisa menyukai satu kali: tulisan kedua menimpa
   dokumen yang sama alih-alih menambah baris baru, dan aturan Firestore
   bisa memastikan idnya cocok dengan penulisnya. Dengan id acak, siapa pun
   bisa mengirim seribu suka untuk ulasan yang sama.

   Aturan Firestore-lah yang menegakkan semua itu. Kode di sini cuma
   antarmuka, dan siapa pun bisa melewatinya lewat konsol peramban.
   ════════════════════════════════════════════════════════════════════════ */

export interface Balasan {
  id: string;
  ulasanId: string;
  uid: string;
  nama: string;
  foto: string;
  isi: string;
  waktu: number;
}

const idSuka = (ulasanId: string, uid: string) => `${ulasanId}__${uid}`;

/** Suka per ulasan: berapa banyak, dan apakah AKU sudah menyukainya. */
export function useSuka(): { jumlah: Record<string, number>; punyaku: Set<string>; siap: boolean } {
  const [jumlah, setJumlah] = useState<Record<string, number>>({});
  const [punyaku, setPunyaku] = useState<Set<string>>(new Set());
  const [siap, setSiap] = useState(false);
  const aku = auth.currentUser?.uid ?? '';

  useEffect(() => {
    return onSnapshot(collection(db, 'ulasanSuka'),
      (s) => {
        const n: Record<string, number> = {};
        const milikku = new Set<string>();
        s.docs.forEach((d) => {
          const v = d.data();
          const uid = String(v.ulasanId ?? '');
          if (!uid) return;
          n[uid] = (n[uid] ?? 0) + 1;
          if (aku && String(v.uid ?? '') === aku) milikku.add(uid);
        });
        setJumlah(n); setPunyaku(milikku); setSiap(true);
      },
      (e) => { console.warn('suka:', e); setSiap(true); });
  }, [aku]);

  return { jumlah, punyaku, siap };
}

/** Menyukai / batal menyukai. Idempoten: menekan dua kali kembali ke semula. */
export async function tukarSuka(ulasanId: string, sedangSuka: boolean) {
  const p = auth.currentUser;
  if (!p) throw new Error('Masuk dulu untuk menyukai ulasan.');
  const ref = doc(db, 'ulasanSuka', idSuka(ulasanId, p.uid));
  if (sedangSuka) await deleteDoc(ref);
  else await setDoc(ref, { ulasanId, uid: p.uid, waktu: serverTimestamp() });
}

/** Balasan, dikelompokkan per ulasan dan diurut dari yang paling lama —
 *  percakapan dibaca dari atas ke bawah, bukan sebaliknya. */
export function useBalasan(): { per: Record<string, Balasan[]>; memuat: boolean } {
  const [per, setPer] = useState<Record<string, Balasan[]>>({});
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    return onSnapshot(collection(db, 'ulasanBalasan'),
      (s) => {
        const kotak: Record<string, Balasan[]> = {};
        s.docs.forEach((d) => {
          const v = d.data();
          const b: Balasan = {
            id: d.id,
            ulasanId: String(v.ulasanId ?? ''),
            uid: String(v.uid ?? ''),
            nama: String(v.nama ?? 'Pengguna'),
            foto: String(v.foto ?? ''),
            isi: String(v.isi ?? ''),
            waktu: v.waktu?.toMillis?.() ?? Date.now(),
          };
          if (!b.ulasanId) return;
          (kotak[b.ulasanId] ??= []).push(b);
        });
        Object.values(kotak).forEach((a) => a.sort((x, y) => x.waktu - y.waktu));
        setPer(kotak); setMemuat(false);
      },
      (e) => { console.warn('balasan:', e); setMemuat(false); });
  }, []);

  return { per, memuat };
}

export async function kirimBalasan(ulasanId: string, isi: string) {
  const p = auth.currentUser;
  if (!p) throw new Error('Masuk dulu untuk membalas.');
  if (!isi.trim()) throw new Error('Tulis dulu balasannya.');
  await addDoc(collection(db, 'ulasanBalasan'), {
    ulasanId,
    uid: p.uid,
    nama: p.displayName || (p.email ?? '').split('@')[0] || 'Pengguna',
    foto: p.photoURL ?? '',
    isi: isi.trim().slice(0, 400),
    waktu: serverTimestamp(),
  });
}

export async function hapusBalasan(id: string) {
  await deleteDoc(doc(db, 'ulasanBalasan', id));
}
