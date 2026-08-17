/* Membuktikan DUA hal sekaligus pada ambilPerforma:
     1. penonton tanpa akses melihat contoh berlabel saat data masih tipis
     2. siapa pun yang PUNYA akses selalu melihat angka sungguhan

   Yang kedua yang paling penting: papan peringkat adalah dasar orang
   memutuskan sinyal siapa yang ditiru. Satu jalur saja yang bocor membuat
   angka karangan sampai ke orang yang bisa bertindak atasnya. */

import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const src = readFileSync('src/lib/analisa.ts', 'utf8');
const a = src.indexOf('export async function ambilPerforma');
const b = src.indexOf('\nexport async function hapusGambar');
if (a < 0 || b < 0) throw new Error('potongan ambilPerforma tidak ketemu');
const js = transformSync(src.slice(a, b).replace(/^export /gm, ''), { loader: 'ts', format: 'cjs' }).code;

/* Dua ketergantungan luar dipalsukan: `panggil` (jaringan) dan impor
   dinamis modul contoh. Yang diuji keputusannya, bukan jaringannya. */
let jawabanServer;
const panggil = async () => jawabanServer;
globalThis.__impor = async () => ({
  PERFORMA_CONTOH: { modal: 1000, risikoPersen: 1, berjalan: 7, analis: [
    { uid: 'c1', nama: 'Contoh A', agen: true, menang: 22, kalah: 14, batal: 5, total: 36, winrate: 0.61, hasilDolar: 118.4, terakhir: 0, harian: {} },
  ] },
});
const kode = js.replace(/await import\([^)]+\)/g, 'await globalThis.__impor()');
const ambilPerforma = new Function('panggil', `${kode}; return ambilPerforma;`)(panggil);

let lulus = 0, gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = dapat === harap;
  ok ? lulus++ : gagal++;
  console.log(`${ok ? ' ok  ' : 'GAGAL'} ${nama.padEnd(58)} ${dapat}${ok ? '' : `  (harap ${harap})`}`);
};

const analis = (total) => ({ uid: 'r', nama: 'Nyata', agen: false, menang: 1, kalah: total - 1, batal: 0, total, winrate: 0, hasilDolar: -10, terakhir: 0, harian: {} });

/* ── Yang PUNYA akses: selalu nyata, apa pun isinya ──────────────────── */
jawabanServer = { analis: [], berjalan: 3 };
cek('punya akses + papan KOSONG   -> nyata', !!(await ambilPerforma(false)).contoh, false);
jawabanServer = { analis: [analis(1)], berjalan: 3 };
cek('punya akses + 1 sinyal       -> nyata', !!(await ambilPerforma(false)).contoh, false);
cek('punya akses + 1 sinyal       -> analisnya nyata', (await ambilPerforma(false)).analis[0].nama, 'Nyata');

/* ── Penonton tanpa akses ────────────────────────────────────────────── */
jawabanServer = { analis: [analis(1)], berjalan: 3 };
cek('penonton + 1 sinyal          -> contoh', !!(await ambilPerforma(true)).contoh, true);
cek('penonton + 1 sinyal          -> berjalan dari server', (await ambilPerforma(true)).berjalan, 3);

jawabanServer = { analis: [analis(3)], berjalan: 0 };
cek('penonton + 3 sinyal          -> nyata (ambang)', !!(await ambilPerforma(true)).contoh, false);
jawabanServer = { analis: [analis(9)], berjalan: 0 };
cek('penonton + 9 sinyal          -> nyata', !!(await ambilPerforma(true)).contoh, false);

/* Bawaan parameternya WAJIB false — pemanggil yang lupa mengoper apa pun
   harus mendapat data nyata, bukan contoh. */
jawabanServer = { analis: [analis(1)], berjalan: 0 };
cek('tanpa argumen (bawaan)       -> nyata', !!(await ambilPerforma()).contoh, false);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
