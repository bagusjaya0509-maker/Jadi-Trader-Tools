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
  kota: 'Kota Mataram, Nusa Tenggara Barat, Indonesia',
  email: 'business@jaditrader.co.id',
} as const;
