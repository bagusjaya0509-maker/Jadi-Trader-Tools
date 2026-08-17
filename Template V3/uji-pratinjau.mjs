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

const js = transformSync(bagian, { loader: 'ts', format: 'cjs' }).code;
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
const st = (ms) => hitungLangganan({ mulai: new Date(ms) }, T).status;

cek('baru login detik ini', st(skrg), 'pratinjau');
cek('sudah 1 jam', st(skrg - 1 * JAM), 'pratinjau');
cek('sudah 23 jam 59 menit', st(skrg - 23.98 * JAM), 'pratinjau');
cek('tepat 24 jam + 1 detik', st(skrg - 24 * JAM - 1000), 'habis');
cek('sudah 3 hari', st(skrg - 72 * JAM), 'habis');
cek('dokumen lama (30 hari lalu)', st(skrg - 720 * JAM), 'habis');

/* Jam perangkat dimundurkan tidak bisa memperpanjang: `mulai` datang dari
   server, jadi memundurkan Date.now() justru MEMPERPENDEK, tidak pernah
   memperpanjang. Yang diuji di sini kebalikannya — `mulai` di MASA DEPAN
   (jam perangkat dimajukan/dimundurkan) tidak boleh memberi akses abadi. */
cek('mulai di masa depan (jam dicurangi)', st(skrg + 240 * JAM), 'pratinjau');

/* bayarSampai selalu menang atas pratinjau, dan pratinjau habis tidak
   boleh menutup orang yang sudah membayar. */
const bayar = (mulaiMs, sampaiMs) =>
  hitungLangganan({ mulai: new Date(mulaiMs), bayarSampai: new Date(sampaiMs) }, T).status;
cek('pratinjau habis TAPI sudah bayar', bayar(skrg - 720 * JAM, skrg + 720 * JAM), 'aktif');
cek('pratinjau habis dan bayar juga habis', bayar(skrg - 720 * JAM, skrg - 1 * JAM), 'habis');

cek('dokumen kosong', hitungLangganan({}, T).status, 'tidakDiketahui');

/* Sisa waktu harus jam, bukan hari yang dibulatkan ke atas. */
const l = hitungLangganan({ mulai: new Date(skrg - 23.9 * JAM) }, T);
cek('sisaMs < 1 jam saat tersisa 6 menit', l.sisaMs < JAM, true);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
