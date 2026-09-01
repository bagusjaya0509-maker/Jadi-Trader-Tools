/* ══════════════════════════════════════════════════════════════════════
   PILIHAN PENGGUNA ATAS DATA CONTOH
   ══════════════════════════════════════════════════════════════════════
   'kosong'  = mulai dari nol, jangan tampilkan contoh lagi
   'biarkan' = tetap tampilkan contoh (spanduknya saja yang hilang)
   null      = belum memilih

   ── KENAPA BERKAS SENDIRI, PADAHAL CUMA DUA FUNGSI ────────────────────
   Karena keduanya MURNI localStorage — tidak menyentuh Firestore sama
   sekali — tapi mereka dulu tinggal di `lib/data.ts`, yang menarik seluruh
   SDK Firestore.

   `lib/contoh-pratinjau.ts` memanggil `bacaPilihanContoh` untuk menjawab
   satu pertanyaan sepele: "boleh tampilkan data contoh?". Ia dipakai
   `lib/akun.ts`, yang ikut bundel awal. Rollup memuat modul UTUH, bukan
   sepotong, jadi satu pembacaan localStorage menyeret 647 kB Firestore ke
   halaman depan — diunduh setiap pengunjung yang bahkan belum login.

   Dipisah begini, rantainya putus tanpa mengubah satu pun perilaku.
   `data.ts` MENGEKSPOR ULANG keduanya supaya pemanggil lama tidak perlu
   diubah, dan yang tidak butuh Firestore bisa mengambil langsung dari
   sini.

   Kalau menambah fungsi ke berkas ini nanti: JAGA ia tetap bebas
   Firestore. Satu impor `firebase/firestore` di sini mengembalikan 647 kB
   itu ke halaman depan tanpa satu pun galat yang memberi tahu.
   ══════════════════════════════════════════════════════════════════════ */

export function bacaPilihanContoh(uid: string): 'kosong' | 'biarkan' | null {
  try {
    const v = localStorage.getItem(`jt.pilihanContoh.${uid}`);
    return v === 'kosong' || v === 'biarkan' ? v : null;
  } catch { return null; }
}

export function simpanPilihanContoh(uid: string, v: 'kosong' | 'biarkan') {
  try { localStorage.setItem(`jt.pilihanContoh.${uid}`, v); } catch { /* privat */ }
  window.dispatchEvent(new CustomEvent('jt:pilihan-contoh'));
}
