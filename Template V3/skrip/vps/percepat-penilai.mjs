import { readFileSync, writeFileSync } from 'node:fs';

/* ════════════════════════════════════════════════════════════════════════
   Penilai sinyal: tiap 5 menit → tiap 1 menit.
   ════════════════════════════════════════════════════════════════════════
   Kartu yang masih berbunyi "Berjalan" delapan menit sesudah harganya kena
   SL bukan sekadar lambat — di papan yang dipakai orang memilih siapa yang
   ditiru, ia angka yang salah selama delapan menit. Jeda totalnya dua
   lapis: feed lilin EA (±3 menit, milik EA) dan putaran penilai (5 menit,
   milik berkas ini). Yang bisa dipangkas dari server cuma lapis kedua.

   Biayanya hampir nol: penilai membaca dua berkas JSON lokal dan menulis
   hanya saat ada yang berubah. Lima menit dulu dipilih saat bentuk datanya
   masih dibaca ulang penuh — sekarang tidak lagi relevan.
   ════════════════════════════════════════════════════════════════════════ */

const berkas = process.argv[2] || 'server.js';
let s = readFileSync(berkas, 'utf8');

const LAMA = "const NILAI_JEDA_MS = 5 * 60 * 1000;   // periksa tiap 5 menit";
const BARU = "const NILAI_JEDA_MS = 60 * 1000;   // tiap menit — kartu 'Berjalan' padahal sudah kena SL adalah angka salah di papan peringkat";

const n = s.split(LAMA).length - 1;
if (n === 0 && s.includes('const NILAI_JEDA_MS = 60 * 1000;')) {
  console.log('sudah tertambal — tidak ada yang diubah.');
  process.exit(0);
}
if (n !== 1) {
  console.error('GAGAL: baris NILAI_JEDA_MS tidak ditemukan persis satu kali (' + n + ').');
  process.exit(1);
}

s = s.replace(LAMA, BARU);
writeFileSync(berkas, s);
console.log('penilai sekarang berjalan tiap 60 detik.');
