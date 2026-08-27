import { readFileSync, writeFileSync } from 'node:fs';

/* ════════════════════════════════════════════════════════════════════════
   Level ikut di daftar publik — untuk sinyal yang memang sudah terbuka.
   ════════════════════════════════════════════════════════════════════════
   Kartu sinyal tidak bisa menampilkan entry maupun P/L berjalan karena
   levelnya baru dijemput saat orangnya menekan "Buka di Chart" — satu
   permintaan per kartu, sengaja ditunda supaya membuka kanal tidak
   menembakkan belasan permintaan sekaligus. Akibatnya kartu cuma bisa
   menampilkan angka milik ANALISNYA (winrate, jumlah selesai), bukan
   angka milik sinyal yang sedang dibaca.

   Yang diperbaiki bukan waktu penjemputannya, melainkan tempatnya: level
   ikut di daftar untuk sinyal yang gerbangnya memang sudah terbuka.

   GERBANGNYA SAMA PERSIS dengan yang sudah dipakai `sampul` satu baris di
   bawah — gratis, atau sudah selesai. Itu bukan pilihan baru: sampulnya
   sudah publik dengan syarat itu, dan /api/analisa/isi memberikan level
   yang sama kepada siapa pun yang meminta untuk sinyal yang sama. Tidak
   ada yang bocor di sini yang belum bisa diambil dengan satu klik.

   Sinyal BERBAYAR yang belum dibeli tetap tertutup — levelnya barang yang
   dijual, dan itulah satu-satunya hal yang dijaga gerbang ini.
   ════════════════════════════════════════════════════════════════════════ */

const berkas = process.argv[2] || 'server.js';
let s = readFileSync(berkas, 'utf8');

if (s.includes('isiTerbuka:')) {
  console.log('level di daftar sudah ada — tidak ada yang diubah.');
  process.exit(0);
}

const J = "    sampul: (a.harga === 0 || sampulTerbuka(a)) ? ((a.galeri || [])[0] || {}).url || '' : '',";
if (s.split(J).length - 1 !== 1) {
  console.error('GAGAL: jangkar sampul tidak ditemukan persis satu kali.');
  process.exit(1);
}

const BARU = `    /* Level untuk kartu: entry buat ditampilkan, entry+SL buat menghitung
       P/L berjalan. Gerbangnya sama dengan sampul tepat di bawah ini. */
    isiTerbuka: (a.harga === 0 || sampulTerbuka(a)) && a.isi
      ? { entry: Number(a.isi.entry) || 0, sl: Number(a.isi.sl) || 0, tp: Number(a.isi.tp) || 0 }
      : null,
` + J;

s = s.replace(J, BARU);
writeFileSync(berkas, s);
console.log('isiTerbuka ditambahkan ke daftar publik.');
