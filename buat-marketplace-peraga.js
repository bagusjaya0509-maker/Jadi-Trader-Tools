/* ══════════════════════════════════════════════════════════════════════════
   GENERATOR: menanam jt-peraga.js KE DALAM marketplace.html
   ══════════════════════════════════════════════════════════════════════════
   Kenapa ditanam, bukan dimuat lewat <script src>:
   berkas terpisah gampang tertinggal saat upload, dan kalau tertinggal
   halaman diam-diam jatuh ke peraga lama tanpa pesan apa pun - persis yang
   terjadi. Ditanam, marketplace.html berdiri sendiri: satu berkas diupload,
   animasinya pasti ikut.

   jt-peraga.js tetap jadi SATU-SATUNYA sumber (dipakai animasi-indikator.html
   untuk merekam video). Sesudah mengubahnya, jalankan lagi:

       node buat-marketplace-peraga.js

   ══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SUMBER = path.join(DIR, 'jt-peraga.js');
const TUJUAN = path.join(DIR, 'marketplace.html');

const AWAL = '<!-- MULAI jt-peraga (ditanam otomatis - jangan disunting di sini) -->';
const AKHIR = '<!-- SELESAI jt-peraga -->';

const mesin = fs.readFileSync(SUMBER, 'utf8');
let html = fs.readFileSync(TUJUAN, 'utf8');

// Pastikan tidak merusak halaman: isi mesin tidak boleh memuat </script>
if (/<\/script/i.test(mesin)) {
  throw new Error('jt-peraga.js memuat </script> - harus di-escape dulu');
}

const blok = AWAL + '\n<script>\n' + mesin + '\n</script>\n' + AKHIR;

const iA = html.indexOf(AWAL);
const iB = html.indexOf(AKHIR);

if (iA >= 0 && iB > iA) {
  // sudah pernah ditanam -> perbarui isinya
  html = html.slice(0, iA) + blok + html.slice(iB + AKHIR.length);
} else {
  // Pertama kali: gantikan PERSIS tag <script src="jt-peraga.js"></script>.
  // Pakai indexOf, bukan regex. Versi lama memakai pola /<!--[^]*?-->\s*.../
  // yang cocoknya mulai dari komentar HTML pertama di berkas, lalu menelan
  // seluruh isi halaman di antaranya - sekali jalan, separuh marketplace.html
  // ikut terhapus. Pencocokan literal tidak bisa melebar seperti itu.
  const TAG = '<script src="jt-peraga.js"></script>';
  const iT = html.indexOf(TAG);
  if (iT < 0) throw new Error('penanda pemasangan tidak ketemu di marketplace.html');
  if (html.indexOf(TAG, iT + TAG.length) >= 0) throw new Error('penanda pemasangan ada lebih dari satu');
  html = html.slice(0, iT) + blok + html.slice(iT + TAG.length);
}

// Jaring pengaman: bagian-bagian penting halaman harus MASIH ada di hasil.
// Kalau satu saja hilang, penyisipannya salah sasaran - batalkan sebelum
// menimpa berkasnya, bukan sesudah.
const WAJIB = [
  'id="kisiProduk"', 'id="panelOwner"', 'id="tirai"', 'id="lb"', 'id="toast"',
  'id="dtPeraga"', 'id="dtGaleri"', 'id="gbrKanvas"', 'id="ownGbrPetak"',
  'Cara Pasang Indikator',
  'firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'
];
const hilang = WAJIB.filter(function (s) { return html.indexOf(s) < 0; });
if (hilang.length) {
  throw new Error('dibatalkan - bagian ini hilang dari hasil: ' + hilang.join(', '));
}

fs.writeFileSync(TUJUAN, html);
console.log('jt-peraga ditanam ke marketplace.html (' + Math.round(mesin.length / 1024) + ' KB)');
console.log('ukuran marketplace.html: ' + (fs.statSync(TUJUAN).size / 1024).toFixed(0) + ' KB');
