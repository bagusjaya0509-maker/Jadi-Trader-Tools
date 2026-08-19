/* ════════════════════════════════════════════════════════════════════════
   HARGA AKSES — satu sumber, tanpa impor apa pun
   ════════════════════════════════════════════════════════════════════════
   Jangan tertukar dengan `harga.ts` di sebelah: yang itu soal harga PASAR
   (useHargaPasar, useHargaTradeFi). Yang ini soal harga PRODUK ini.

   Berkas ini SENGAJA tidak mengimpor apa-apa, dan itu bukan kebetulan.

   Angka yang sama dibutuhkan di dua tempat yang berbeda sifatnya: bagian
   harga di halaman depan, dan halaman Akses tempat orang benar-benar
   membayar. Halaman Akses sudah memuat Firestore; halaman depan TIDAK
   BOLEH — ia jalur muat pertama, dan menarik SDK Firebase ke sana menambah
   ratusan kilobyte sebelum orangnya sempat membaca satu kalimat.

   Kalau angkanya diambil dari lib/akses.ts (yang mengimpor firebase),
   sekadar MENYEBUT harga di halaman depan sudah cukup untuk menyeret
   seluruh SDK-nya ikut. Jadi angkanya tinggal di sini, sendirian, dan
   kedua halaman membacanya dari tempat yang sama.

   Ditulis dua rupa karena keduanya memang dipakai: RUPIAH untuk hitungan,
   dan bentuk tertulisnya untuk ditampilkan. Memformat 17900 jadi
   "Rp 17.900" di tiap tempat pemakaian adalah cara paling gampang membuat
   satu halaman menulis "Rp17.900" dan halaman lain "Rp 17,900".
   ════════════════════════════════════════════════════════════════════════ */

/** Harga akses perintis dalam rupiah. */
export const HARGA_PERINTIS = 17_900;

/** Bentuk tertulisnya, sudah lengkap dengan "Rp". */
export const HARGA_PERINTIS_TEKS = 'Rp 17.900';

/** Lama akses dalam hari. Nilai SEBENARNYA datang dari server lewat
    `useKuota().hari` — yang ini cuma untuk tempat yang tidak boleh
    menyentuh Firestore, dan harus disamakan kalau masa berlakunya diubah
    dari Maintenance. */
export const MASA_AKSES_HARI = 30;
