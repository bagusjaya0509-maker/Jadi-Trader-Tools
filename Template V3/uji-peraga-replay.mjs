/* Membuktikan bahwa peraga replay di halaman depan benar-benar BERJALAN,
   dan berjalan dengan urutan yang dimaksud: memilih titik mulai dulu, baru
   lilin sesudahnya terbuka satu per satu, lalu berhenti dan mengulang.

   Kenapa diuji di sini dan bukan dilihat di browser: pane pratinjau
   berjalan tersembunyi, dan Chrome mencekik interval yang sudah lama hidup
   di halaman tersembunyi sampai ±1 tick per menit. Layar yang tampak diam
   di sana BUKAN bukti kodenya diam — dan sebaliknya, "kelihatan bergerak"
   juga bukan bukti urutannya benar. Yang bisa dijawab pasti cuma pemetaan
   tick -> keadaan, dan itulah yang diperiksa di bawah.

   Sumbernya dibaca LANGSUNG lewat esbuild, bukan disalin tangan: salinan
   tangan akan tetap lulus walau berkas aslinya berubah.

   Jalankan: node uji-peraga-replay.mjs */

import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const berkas = new URL('./src/components/ui/peraga-replay.tsx', import.meta.url);
let sumber = readFileSync(berkas, 'utf8');

/* Komponen React-nya tidak ikut diuji — yang diuji fungsi murninya. Impor
   dan JSX dibuang supaya modulnya bisa dimuat tanpa React sama sekali. */
sumber = sumber
  .replace(/^import[\s\S]*?;$/gm, '')
  .replace(/export function PeragaReplay[\s\S]*$/, '');

const js = transformSync(sumber, { loader: 'ts', format: 'esm' }).code;
const { keadaanReplay } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

let lulus = 0, gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (ok) { lulus++; return; }
  gagal++;
  console.log(`GAGAL  ${nama}\n   dapat ${JSON.stringify(dapat)}\n   harap ${JSON.stringify(harap)}`);
};

const MULAI = 18, JUMLAH = 42;

/* ── Babak 1: memilih titik mulai ───────────────────────────────────────
   Selama ini lilin TIDAK boleh bertambah. Kalau ia sudah maju sambil garis
   masih menyapu, yang tersampaikan bukan "kamu memilih dari mana" — cuma
   dua benda bergerak sekaligus tanpa urutan. */
cek('tick 0 mulai dari kiri', keadaanReplay(0).xGaris, 0);
cek('tick 0 di babak pilih', keadaanReplay(0).babak, 'pilih');
cek('lilin diam selama memilih',
  [0, 5, 11, 21].map((t) => keadaanReplay(t).sampai), [MULAI, MULAI, MULAI, MULAI]);
cek('garis menyapu maju',
  keadaanReplay(5).xGaris < keadaanReplay(15).xGaris, true);

/* ── Babak 2: memutar ── */
cek('tepat sesudah memilih, mulai memutar', keadaanReplay(22).babak, 'putar');
cek('lilin pertama terbuka di titik mulai', keadaanReplay(22).sampai, MULAI);
cek('satu lilin tiap 4 tick', keadaanReplay(26).sampai, MULAI + 1);
cek('empat lilin sesudah 16 tick', keadaanReplay(38).sampai, MULAI + 4);
cek('garis menempel di lilin terakhir',
  Math.round(keadaanReplay(38).xGaris * 100) / 100,
  Math.round((MULAI + 4) * (300 / JUMLAH) * 100) / 100);

/* ── Babak 3: berhenti di ujung, lalu mengulang ── */
{
  const T_PILIH = 22, T_PUTAR = (JUMLAH - MULAI) * 4 + 1;
  const ujung = T_PILIH + T_PUTAR;
  cek('sampai lilin terakhir', keadaanReplay(ujung - 1).sampai, JUMLAH);
  cek('menahan di ujung', keadaanReplay(ujung + 5).babak, 'tahan');
  cek('tidak melewati jumlah lilin', keadaanReplay(ujung + 20).sampai, JUMLAH);

  /* Yang paling mudah rusak diam-diam: putarannya harus KEMBALI ke awal.
     Tanpa ini peraganya berhenti selamanya di bingkai terakhir, dan itu
     tidak akan terlihat sebagai rusak — cuma sebagai gambar diam. */
  const T_TOTAL = ujung + 26;
  cek('mengulang dari awal', keadaanReplay(T_TOTAL), keadaanReplay(0));
  cek('mengulang lagi di putaran ketiga', keadaanReplay(T_TOTAL * 2 + 7), keadaanReplay(7));
  cek('tick negatif tidak merusak', keadaanReplay(-1).sampai >= MULAI, true);
}

/* ── Kurangi gerak: diam di keadaan AKHIR, bukan kosong ─────────────────
   Kotak kosong akan terbaca sebagai gagal memuat. Yang hilang harus
   geraknya saja, isinya tetap utuh. */
{
  const d = keadaanReplay(0, true);
  cek('gerak minim: semua lilin tampil', d.sampai, JUMLAH);
  cek('gerak minim: tidak di babak pilih', d.memilih, false);
  cek('gerak minim: tetap sama di tick mana pun',
    keadaanReplay(999, true), keadaanReplay(0, true));
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
