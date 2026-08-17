import { useCallback, useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   PIN ANALIS — miliknya sendiri, bukan sorotan bersama
   ════════════════════════════════════════════════════════════════════════
   "Bisa di-pin oleh siapa pun" punya dua bacaan, dan yang dipilih di sini
   sengaja yang lebih sempit:

     (a) siapa pun boleh menaruh analis di puncak papan UNTUK SEMUA ORANG
     (b) siapa pun boleh menandai analis untuk DIRINYA SENDIRI  ← ini

   Yang (a) adalah pengeras suara bersama tanpa penjaga: satu orang dengan
   beberapa akun bisa mendorong kanal mana pun ke posisi teratas papan yang
   dipakai orang menaruh uang. Papan ini sudah punya satu urutan yang tidak
   bisa dibeli — peringkat dari hasil sinyal — dan menaruh urutan kedua yang
   bisa dikerek ramai-ramai akan meniadakannya.

   Yang (b) memberi kegunaan yang sebenarnya diminta: analis yang diikuti
   naik ke atas, tidak perlu dicari ulang tiap kali halaman dibuka. Tidak
   ada yang bisa disalahgunakan karena tidak ada yang melihatnya.

   Disimpan di localStorage, bukan di server, dan itu keputusan: daftar
   "siapa yang saya ikuti" adalah tabiat trading seseorang. Selama ia tidak
   perlu ikut berpindah antar-perangkat, ia tidak perlu meninggalkan
   peramban — dan tamu preview yang belum login pun ikut kebagian fiturnya.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.analis.pin';

/** Peristiwa buatan sendiri. `storage` bawaan peramban HANYA menyala di tab
 *  LAIN, jadi tanpa ini dua daftar di halaman yang sama tidak akan pernah
 *  sepakat sampai halamannya dimuat ulang. */
const PERISTIWA = 'jt-pin-analis';

function baca(): string[] {
  try {
    const isi = JSON.parse(localStorage.getItem(KUNCI) || '[]');
    return Array.isArray(isi) ? isi.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

function tulis(daftar: string[]) {
  try { localStorage.setItem(KUNCI, JSON.stringify(daftar)); } catch { /* mode privat */ }
  window.dispatchEvent(new Event(PERISTIWA));
}

export function usePinAnalis() {
  const [pin, setPin] = useState<string[]>(baca);

  useEffect(() => {
    const segarkan = () => setPin(baca());
    window.addEventListener(PERISTIWA, segarkan);
    window.addEventListener('storage', segarkan);
    return () => {
      window.removeEventListener(PERISTIWA, segarkan);
      window.removeEventListener('storage', segarkan);
    };
  }, []);

  const ubah = useCallback((uid: string) => {
    const kini = baca();
    tulis(kini.includes(uid) ? kini.filter((x) => x !== uid) : [...kini, uid]);
  }, []);

  return {
    /** Cepat dan tidak peduli urutan — dipanggil sekali per kartu. */
    disematkan: (uid: string) => pin.includes(uid),
    ubahPin: ubah,
    jumlahPin: pin.length,
  };
}
