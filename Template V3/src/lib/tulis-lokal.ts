/* ════════════════════════════════════════════════════════════════════════
   MENULIS KE FIRESTORE TANPA MENUNGGU SERVER
   ════════════════════════════════════════════════════════════════════════
   Firestore menerapkan tulisan ke cache lokal SEKETIKA, lalu menyinkronkannya
   ke server di latar belakang. Janji yang dipulangkan `setDoc` baru selesai
   saat SERVER menjawab — bukan saat tulisannya berlaku.

   Bedanya tidak kelihatan sampai jaringannya lambat, dan waktu itu ia
   kelihatan sekali. Laporan pemiliknya persis begini:

     "loadingnya lama... tapi sebenarnya bisa masuk angkanya, setelah saya
      refresh angkanya tetap masuk kok, tampilannya aja yang seperti masih
      loading"

   Itu bukan dua gejala, itu satu sebab. Angkanya memang sudah masuk —
   pendengar `onSnapshot` menerima tulisan lokal itu dalam hitungan
   milidetik, dan IndexedDB menyimpannya sehingga ia selamat dari refresh.
   Yang menggantung cuma LAYARNYA, karena kodenya menulis begini:

     setSibuk(true);
     await simpanArus(...);     // <- menunggu server
     setPesan('tercatat');
     setSibuk(false);

   Tombolnya berputar menunggu jawaban jaringan untuk sesuatu yang sudah
   terjadi. Formulirnya tetap terisi, pesan berhasilnya tidak muncul, dan
   orangnya menekan tombolnya lagi — menulis catatan yang sama dua kali.

   ── KENAPA INI AMAN, BUKAN "POKOKNYA JANGAN TUNGGU" ────────────────────
   Firestore mengantre tulisan yang belum terkirim di IndexedDB dan
   mencobanya lagi sendiri — melewati jaringan mati, tab yang ditutup, dan
   peramban yang direstart. Jadi "sudah tersimpan" memang benar; yang belum
   pasti cuma "sudah sampai server", dan itu bukan pertanyaan yang sedang
   ditanyakan orang yang baru menekan Simpan.

   Yang HILANG adalah pelaporan galat serentak. Itu diganti, bukan dibuang:
   `saatGagal` tetap dipanggil kalau tulisannya benar-benar ditolak (aturan
   keamanan, medan `undefined`, dokumen terlalu besar) — cuma datangnya
   belakangan, sama seperti galat sungguhan datang belakangan.

   ── YANG TIDAK BOLEH MEMAKAI INI ───────────────────────────────────────
   Apa pun yang keputusan BERIKUTNYA bergantung pada jawaban server:
   penukaran kode lisensi, pengiriman order, pembayaran. Di sana menunggu
   memang benar, karena yang ditunggu bukan "tersimpan" melainkan
   "diterima". Berkas ini untuk catatan pribadi pengguna di jurnalnya
   sendiri — yang tidak ada pihak kedua di dalamnya.
   ════════════════════════════════════════════════════════════════════════ */

/** Menjalankan tulisan Firestore tanpa menahan layar sampai server menjawab.
 *
 *  Kembali SEKETIKA. Galat yang datang belakangan diteruskan ke `saatGagal`
 *  — dan kalau pemanggilnya tidak menyediakannya, tetap dicatat ke konsol:
 *  tulisan yang ditolak diam-diam adalah data yang hilang tanpa ada yang
 *  tahu, dan itu jauh lebih buruk daripada tombol yang berputar. */
export function tulisLatar(kerja: Promise<unknown>, saatGagal?: (pesan: string) => void) {
  void kerja.catch((e) => {
    const pesan = e instanceof Error ? e.message : 'Gagal menyimpan';
    console.warn('[tulis-latar] tulisan ditolak:', pesan);
    saatGagal?.(pesan);
  });
}
