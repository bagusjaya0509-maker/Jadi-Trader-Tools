import { useCallback, useEffect, useState } from 'react';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, setDoc, serverTimestamp,
  query, where, limit, orderBy, getCountFromServer,
} from 'firebase/firestore';
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
    /* DIBATASI 50 dan diurut di server. Halaman ini tujuan iklan: tiap
       pengunjung membaca sebanyak dokumen yang dikirim pendengar ini, dan
       tanpa batas biayanya tumbuh selamanya mengikuti jumlah ulasan —
       dikalikan jumlah pengunjung. Lima puluh ulasan terbaru sudah lebih
       dari cukup untuk halaman jualan. */
    return onSnapshot(query(collection(db, 'ulasan'), orderBy('waktu', 'desc'), limit(50)),
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

/** Suka: HANYA milikku yang didengarkan, jumlahnya dihitung terpisah.
 *
 *  Dulu ini mendengarkan SELURUH koleksi `ulasanSuka`. Biayanya satu baca
 *  per dokumen suka, per pengunjung, tiap kali halaman dibuka — jadi seribu
 *  pengunjung iklan dikali tiga ratus suka adalah tiga ratus ribu baca
 *  sehari, untuk angka kecil di samping ikon jempol.
 *
 *  Sekarang dua bagian yang dipisah karena sifatnya memang berbeda:
 *
 *    · "apakah AKU menyukai" — kueri `where('uid','==',aku)`. Isinya cuma
 *      sebanyak ulasan yang pernah kusukai, bukan sebanyak suka sedunia.
 *      Pengunjung yang belum masuk tidak menjalankan kueri ini sama sekali.
 *
 *    · "berapa jumlahnya" — `getCountFromServer`, yang ditagih satu baca
 *      per seribu dokumen, bukan satu per dokumen. Ia sekali jalan, bukan
 *      pendengar: angka suka tidak perlu berubah sendiri di layar orang
 *      yang sedang membaca ulasan. */
export function useSuka(ulasanIds: string[]): {
  jumlah: Record<string, number>; punyaku: Set<string>; hitungUlang: () => void;
} {
  const [jumlah, setJumlah] = useState<Record<string, number>>({});
  const [punyaku, setPunyaku] = useState<Set<string>>(new Set());
  const [putaran, setPutaran] = useState(0);
  const aku = auth.currentUser?.uid ?? '';
  /* Digabung jadi satu untai supaya efeknya tidak berjalan ulang tiap
     render — array baru dengan isi sama tetap dianggap berubah oleh React. */
  const kunci = ulasanIds.join(',');

  useEffect(() => {
    if (!aku) { setPunyaku(new Set()); return; }
    return onSnapshot(query(collection(db, 'ulasanSuka'), where('uid', '==', aku)),
      (s) => setPunyaku(new Set(s.docs.map((d) => String(d.data().ulasanId ?? '')))),
      (e) => console.warn('suka saya:', e));
  }, [aku]);

  useEffect(() => {
    let hidup = true;
    const ids = kunci ? kunci.split(',') : [];
    if (!ids.length) { setJumlah({}); return; }
    (async () => {
      const hasil: Record<string, number> = {};
      await Promise.all(ids.map(async (id) => {
        try {
          const c = await getCountFromServer(
            query(collection(db, 'ulasanSuka'), where('ulasanId', '==', id)));
          hasil[id] = c.data().count;
        } catch (e) { console.warn('hitung suka:', e); }
      }));
      if (hidup) setJumlah(hasil);
    })();
    return () => { hidup = false; };
  }, [kunci, putaran]);

  return { jumlah, punyaku, hitungUlang: useCallback(() => setPutaran((n) => n + 1), []) };
}

/** JUMLAH BALASAN per ulasan — tanpa mengambil isinya.
 *
 *  Isi percakapan tetap ditunda sampai orangnya membuka (satu baca per
 *  balasan, dan sebagian besar pengunjung halaman iklan tidak pernah
 *  membukanya). Yang dibaca di sini cuma ANGKANYA, lewat
 *  `getCountFromServer` — ditagih satu baca per SERIBU dokumen, bukan satu
 *  per dokumen. Pola yang sama persis dengan hitungan suka di atas.
 *
 *  Kenapa angkanya perlu terlihat sebelum dibuka: tombol bertuliskan
 *  "Balas" tidak memberi tahu ada percakapan di baliknya, jadi percakapan
 *  yang sudah ada tidak pernah ditemukan siapa pun. "2 balasan" adalah
 *  undangan; "Balas" cuma perintah.
 *
 *  BIAYANYA TUMBUH SEIRING JUMLAH ULASAN, bukan jumlah balasan: satu kueri
 *  hitung per ulasan per kunjungan. Untuk puluhan ulasan itu recehan; kalau
 *  suatu hari ratusan, angkanya harus pindah jadi medan di dokumen
 *  ulasannya sendiri (dinaikkan saat membalas), supaya ikut gratis bersama
 *  daftar ulasan yang memang sudah dibaca. */
export function useJumlahBalasan(ulasanIds: string[]): {
  jumlah: Record<string, number>; hitungUlang: () => void;
} {
  const [jumlah, setJumlah] = useState<Record<string, number>>({});
  const [putaran, setPutaran] = useState(0);
  const kunci = ulasanIds.join(',');

  useEffect(() => {
    let hidup = true;
    const ids = kunci ? kunci.split(',') : [];
    if (!ids.length) { setJumlah({}); return; }
    (async () => {
      const hasil: Record<string, number> = {};
      await Promise.all(ids.map(async (id) => {
        try {
          const c = await getCountFromServer(
            query(collection(db, 'ulasanBalasan'), where('ulasanId', '==', id)));
          hasil[id] = c.data().count;
        } catch (e) { console.warn('hitung balasan:', e); }
      }));
      if (hidup) setJumlah(hasil);
    })();
    return () => { hidup = false; };
  }, [kunci, putaran]);

  return { jumlah, hitungUlang: useCallback(() => setPutaran((n) => n + 1), []) };
}

/** Menyukai / batal menyukai. Idempoten: menekan dua kali kembali ke semula. */
export async function tukarSuka(ulasanId: string, sedangSuka: boolean) {
  const p = auth.currentUser;
  if (!p) throw new Error('Masuk dulu untuk menyukai ulasan.');
  const ref = doc(db, 'ulasanSuka', idSuka(ulasanId, p.uid));
  if (sedangSuka) await deleteDoc(ref);
  else await setDoc(ref, { ulasanId, uid: p.uid, waktu: serverTimestamp() });
}

/** Balasan SATU ulasan, dimuat hanya saat percakapannya dibuka.
 *
 *  Dulu seluruh koleksi `ulasanBalasan` diunduh setiap halaman dibuka —
 *  termasuk balasan milik ulasan yang tidak pernah dilihat pengunjungnya.
 *  Sekarang tidak ada satu pun balasan terbaca sampai ada yang menekan
 *  "Balas".
 *
 *  Tanpa `orderBy` di server, dan itu disengaja: `where` + `orderBy` pada
 *  medan berbeda menuntut indeks komposit yang harus dibuat tangan di
 *  Console, dan kueri tanpa indeks itu GAGAL — bukan melambat, gagal. Lima
 *  puluh balasan diurut di browser tidak terasa oleh siapa pun. */
export function useBalasanUlasan(ulasanId: string, aktif: boolean): {
  data: Balasan[]; memuat: boolean;
} {
  const [data, setData] = useState<Balasan[]>([]);
  const [memuat, setMemuat] = useState(false);

  useEffect(() => {
    if (!aktif || !ulasanId) { setData([]); return; }
    setMemuat(true);
    return onSnapshot(
      query(collection(db, 'ulasanBalasan'), where('ulasanId', '==', ulasanId), limit(50)),
      (s) => {
        setData(s.docs.map((d): Balasan => {
          const v = d.data();
          return {
            id: d.id,
            ulasanId: String(v.ulasanId ?? ''),
            uid: String(v.uid ?? ''),
            nama: String(v.nama ?? 'Pengguna'),
            foto: String(v.foto ?? ''),
            isi: String(v.isi ?? ''),
            waktu: v.waktu?.toMillis?.() ?? Date.now(),
          };
        }).sort((x, y) => x.waktu - y.waktu));
        setMemuat(false);
      },
      (e) => { console.warn('balasan:', e); setMemuat(false); });
  }, [ulasanId, aktif]);

  return { data, memuat };
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
