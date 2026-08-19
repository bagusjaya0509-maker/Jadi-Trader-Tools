/* ════════════════════════════════════════════════════════════════════════
   IDENTITAS BADAN USAHA — satu-satunya tempat data ini ditulis
   ════════════════════════════════════════════════════════════════════════
   Dipakai di footer halaman depan DAN di kartu Penyelenggara halaman Legal.
   Ditaruh di modul sendiri, bukan diekspor dari Legal.tsx: halaman Legal
   dimuat malas, dan mengimpornya dari halaman depan akan menyeret seluruh
   dokumen hukum ke dalam bundel yang dimuat lebih dulu — beberapa puluh kB
   teks yang tidak dibaca siapa pun di layar pertama.

   ── ALAMAT SENGAJA HANYA SAMPAI TINGKAT KOTA ───────────────────────────
   Alamat lengkap di NIB adalah RUMAH pemilik yang dipakai sebagai alamat
   kantor. Menampilkannya di situs berarti mengindeks alamat rumah seseorang
   ke mesin pencari, dan itu tidak menambah kepercayaan apa pun: yang bisa
   diperiksa orang adalah NOMOR NIB di OSS, bukan nama jalannya.

   Jangan pernah melengkapi `kota` jadi alamat penuh "supaya lebih meyakinkan".
   ════════════════════════════════════════════════════════════════════════ */

export const BADAN = {
  nama: 'PT Solusi Bursa Nusantara',
  nib: '1508260003215',

  /* Nomor permohonan Pendaftaran PSE Lingkup Privat, terbit 15 Agu 2026 di
     pse.komdigi.go.id — status TERDAFTAR untuk sistem elektronik "Jadi
     Trader Tools" (jaditrader.co.id).

     Dicantumkan di Kebijakan Privasi karena UU PDP menuntut identitas
     pengendali data yang bisa DIPERIKSA, bukan sekadar disebut: nomor ini
     bisa dicocokkan orang di portal PSE. */
  tdpse: '20260815-J6BNT',

  kota: 'Kota Mataram, Nusa Tenggara Barat, Indonesia',

  /* Sama dengan `kota` tapi TANPA nama kotanya — dipakai footer halaman
     depan. Bukan pengganti `kota`: halaman Legal dan Pendaratan tetap
     memakai yang lengkap karena di sana identitas badan usaha memang harus
     bisa dicocokkan, sementara footer cuma perlu menyatakan asalnya.

     Dua medan, bukan satu yang dipotong saat digambar: memotong untai di
     tempat pemakaian berarti aturan pemotongannya hidup di komponen, dan
     komponen berikutnya akan memotongnya dengan cara lain. */
  wilayah: 'Nusa Tenggara Barat - Indonesia',
  email: 'business@jaditrader.co.id',

  /* Nomor telepon usaha, sama dengan yang terdaftar di NIB (085947720369).
     Disimpan dalam format internasional TANPA tanda plus dan tanpa nol
     depan, karena itu yang diminta wa.me: 0859… menjadi 62859…

     Sebelumnya tautan Help Center menunjuk 6281234567890 — nomor contoh
     yang ikut tersalin dari template. Siapa pun yang mengkliknya mendarat
     di percakapan dengan orang asing, dan pengirimnya tidak pernah tahu
     pesannya tidak sampai. */
  waNomor: '6285947720369',
  waTampil: '0859-4772-0369',
} as const;

/** Tautan WhatsApp siap pakai. Dipakai Help Center dan Documentation. */
export const WA_LINK = `https://wa.me/${BADAN.waNomor}`;
