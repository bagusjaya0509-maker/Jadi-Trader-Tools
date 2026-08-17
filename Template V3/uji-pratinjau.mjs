/* Uji hitungLangganan tanpa merender apa pun.
   Logika gerbang tidak boleh dibuktikan "dengan melihat layar" — kasus
   yang paling penting justru yang tidak bisa dilihat: dokumen lama, jam
   perangkat yang dimundurkan, dan detik-detik di sekitar batas. */

import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

/* Sumbernya dibaca dan bagian murninya dipotong, bukan disalin tangan:
   salinan tangan akan tetap lulus walaupun berkas aslinya berubah. */
const src = readFileSync('src/lib/auth.tsx', 'utf8');
const potong = (dari, sampai) => {
  const a = src.indexOf(dari);
  const b = src.indexOf(sampai, a);
  if (a < 0 || b < 0) throw new Error(`potongan tidak ketemu: ${dari}`);
  return src.slice(a, b);
};

/* Tipe dibuang oleh esbuild, bukan oleh regex. Regex sempat dipakai dan
   gagal pada anotasi tipe KEMBALIAN — dan alat ukur yang salah lebih
   berbahaya daripada tidak mengukur sama sekali. */
const bagian = [
  potong('const JAM_PRATINJAU', 'export type StatusLangganan'),
  /* Sampai `const Konteks`, bukan sampai `const KosongLangganan` —
     KosongLangganan sendiri dipulangkan hitungLangganan untuk dokumen
     kosong, jadi ia harus ikut masuk. */
  potong('const WARISAN_SEBELUM', 'const Konteks'),
  potong('function keTanggal', '\nfunction hitungLangganan'),
  potong('function hitungLangganan', '\nexport function PenyediaAuth'),
].join('\n');

/* `export` dibuang dulu: potongannya ikut membawa mulaiPratinjau yang
   ber-export, dan esbuild akan memancarkan module.exports yang tidak ada
   artinya di dalam new Function. Fungsi itu sendiri tidak dipanggil di
   sini — ia cuma perlu bisa di-parse. */
const js = transformSync(bagian.replace(/^export /gm, ''), { loader: 'ts', format: 'cjs' }).code;
const hitungLangganan = new Function(`${js}; return hitungLangganan;`)();

const JAM = 3_600_000;
/* keTanggal memakai `v instanceof Timestamp`, jadi yang dioper harus
   sebuah KELAS. Kelas kosong sudah cukup: nilai uji kita berupa Date,
   yang memang tidak pernah instanceof kelas ini. */
class T {}

let lulus = 0, gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = dapat === harap;
  ok ? lulus++ : gagal++;
  console.log(`${ok ? ' ok  ' : 'GAGAL'} ${nama.padEnd(52)} ${dapat}${ok ? '' : `  (harap ${harap})`}`);
};

const skrg = Date.now();
const st = (d) => hitungLangganan(d, T).status;

/* ── YANG PALING PENTING ──────────────────────────────────────────────
   Login biasa TIDAK memberi pratinjau. Ini pemisah antara corong /akses
   (kuota event 30 hari) dan tombol Preview di /template. Kalau kasus ini
   pernah memulangkan 'pratinjau', event kuotanya kehilangan gunanya —
   dan itu persis kebocoran yang membuat masa coba dicabut 13 Agu.      */
cek('LOGIN BIASA (mulai saja, baru detik ini)', st({ mulai: new Date(skrg) }), 'habis');
cek('login biasa sejak kemarin', st({ mulai: new Date(skrg - 20 * JAM) }), 'habis');

/* Pratinjau dihitung dari field `pratinjau`, bukan `mulai`. */
const p = (ms, mulaiMs = skrg - 500 * JAM) =>
  st({ mulai: new Date(mulaiMs), pratinjau: new Date(ms) });

cek('pratinjau baru ditekan', p(skrg), 'pratinjau');
cek('pratinjau 1 jam lalu', p(skrg - 1 * JAM), 'pratinjau');
cek('pratinjau 23 jam 59 menit lalu', p(skrg - 23.98 * JAM), 'pratinjau');
cek('pratinjau 24 jam + 1 detik lalu', p(skrg - 24 * JAM - 1000), 'habis');
cek('pratinjau 3 hari lalu', p(skrg - 72 * JAM), 'habis');
cek('akun lama yang menekan preview hari ini', p(skrg - 2 * JAM, skrg - 720 * JAM), 'pratinjau');

/* bayarSampai selalu menang: orang yang sudah membayar tidak boleh
   terkunci hanya karena pratinjaunya sudah lewat. */
const bayar = (sampaiMs, pratinjauMs) =>
  st({ mulai: new Date(skrg - 720 * JAM), pratinjau: new Date(pratinjauMs), bayarSampai: new Date(sampaiMs) });
cek('pratinjau habis TAPI sudah bayar', bayar(skrg + 720 * JAM, skrg - 720 * JAM), 'aktif');
cek('pratinjau masih jalan DAN sudah bayar', bayar(skrg + 720 * JAM, skrg - 1 * JAM), 'aktif');
cek('pratinjau habis dan bayar juga habis', bayar(skrg - 1 * JAM, skrg - 720 * JAM), 'habis');

cek('dokumen kosong', st({}), 'tidakDiketahui');

/* Sisa waktu harus jam, bukan hari yang dibulatkan ke atas. */
const l = hitungLangganan({ mulai: new Date(skrg - 500 * JAM), pratinjau: new Date(skrg - 23.9 * JAM) }, T);
cek('sisaMs < 1 jam saat tersisa 6 menit', l.sisaMs < JAM, true);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
