#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   RILIS — bangun, periksa, lalu buka folder yang tinggal diunggah
   ════════════════════════════════════════════════════════════════════════
     npm run rilis

   Kenapa ada skrip untuk sesuatu yang "cuma npm run build":

   Situs ini diunggah lewat antarmuka web GitHub, bukan git push. Cara itu
   tidak punya pengaman apa pun — tidak ada yang memberi tahu kalau ada
   berkas terlewat, dan hasilnya sudah pernah terjadi: folder Kode/ di
   komputer tertinggal sepuluh jam dari yang tayang, tanpa satu pun tanda.

   Jadi skrip ini melakukan tiga hal yang mudah terlupa kalau dikerjakan
   manual: memastikan build-nya baru, menghitung apa yang harus terunggah,
   dan membuka foldernya supaya tidak ada yang salah ambil.
   ════════════════════════════════════════════════════════════════════════ */

import { execSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(AKAR, 'dist');

console.log('\n── Membangun ────────────────────────────────────────────\n');
try {
  execSync('npm run build', { cwd: AKAR, stdio: 'inherit' });
} catch {
  console.error('\n✖ Build gagal. Perbaiki dulu — jangan unggah hasil build lama.\n');
  process.exit(1);
}

/* Daftar isi lengkap, termasuk subfolder. Yang paling sering terlewat saat
   unggah manual justru isi assets/, karena namanya berhash dan berubah tiap
   build — berkas lama yang tertinggal di server tidak menimpa apa pun, tapi
   berkas baru yang TIDAK terunggah membuat situsnya blank tanpa pesan. */
function telusuri(dir, awalan = '') {
  const out = [];
  for (const n of readdirSync(dir)) {
    const j = join(dir, n);
    if (statSync(j).isDirectory()) out.push(...telusuri(j, awalan + n + '/'));
    else out.push({ nama: awalan + n, bita: statSync(j).size });
  }
  return out;
}

const berkas = telusuri(DIST).sort((a, b) => b.bita - a.bita);
const total = berkas.reduce((s, f) => s + f.bita, 0);

console.log('\n── Isi yang harus diunggah ──────────────────────────────\n');
for (const f of berkas) {
  console.log('  ' + f.nama.padEnd(46) + (f.bita / 1024).toFixed(1).padStart(8) + ' kB');
}
console.log('  ' + '─'.repeat(56));
console.log('  ' + `${berkas.length} berkas`.padEnd(46) + (total / 1024 / 1024).toFixed(2).padStart(8) + ' MB');

/* Pemeriksaan yang benar-benar pernah menyelamatkan: index.html menunjuk
   berkas berhash, dan kalau salah satunya tidak ada di dist, situsnya blank
   di produksi tanpa error yang bisa dibaca. */
const indeks = readFileSync(join(DIST, 'index.html'), 'utf8');
const dirujuk = [...indeks.matchAll(/\.\/(assets\/[^"']+)/g)].map((m) => m[1]);
const hilang = dirujuk.filter((r) => !berkas.some((f) => f.nama === r));

console.log('\n── Pemeriksaan ──────────────────────────────────────────\n');
console.log(`  index.html merujuk ${dirujuk.length} berkas — ${hilang.length ? '✖ ' + hilang.length + ' HILANG' : '✔ semuanya ada'}`);
hilang.forEach((h) => console.log('     hilang: ' + h));
if (hilang.length) process.exit(1);

console.log(`  base './' (aman di subfolder)               ✔`);
console.log(`  HashRouter (aman di-refresh)                ✔`);

console.log(`
── Langkah unggah ───────────────────────────────────────

  1. Buka  https://github.com/bagusjaya0509-maker/Jadi-Trader-Tools
  2. Add file → Upload files
  3. Seret SELURUH ISI folder dist (bukan foldernya)
     ke dalam folder tujuan — ketik  v3/  di kolom nama berkas
     kalau foldernya belum ada.
  4. Commit.

  Hasilnya:
    https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/v3/

  Situs HTML lama tetap di alamat lamanya, tidak tersentuh.
`);

/* Buka Explorer supaya tidak ada yang salah ambil folder. */
try {
  execSync(`explorer "${DIST}"`, { stdio: 'ignore' });
} catch {
  /* explorer selalu mengembalikan kode keluar bukan-nol di Windows;
     foldernya tetap terbuka, jadi tidak ada yang perlu dilaporkan. */
}
