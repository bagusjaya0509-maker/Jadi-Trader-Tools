import { readFileSync, writeFileSync } from 'node:fs';

/* ════════════════════════════════════════════════════════════════════════
   Menanam satu baris require pengikut-copy-vps ke server.js — idempoten.
   ════════════════════════════════════════════════════════════════════════
   Berkas sendiri, BUKAN node -e di dalam perintah ssh: jangkarnya
   mengandung tanda kutip satu, dan kutip bersarang di ssh memutus untai
   tepat di tengahnya. Percobaan pertama gagal persis karena itu.
   ════════════════════════════════════════════════════════════════════════ */

const berkas = process.argv[2] || 'server.js';
let s = readFileSync(berkas, 'utf8');

if (s.includes('pengikut-copy-vps')) {
  console.log('sudah tertanam — tidak ada yang diubah.');
  process.exit(0);
}

const JANGKAR = "require('./mt5agen')(app, { requireToken, batasLaju, express, DIR: __dirname });";
const n = s.split(JANGKAR).length - 1;
if (n !== 1) {
  console.error(n === 0
    ? 'GAGAL: jangkar mt5agen tidak ditemukan di ' + berkas
    : 'GAGAL: jangkar mt5agen ditemukan ' + n + ' kali — menolak menebak.');
  process.exit(1);
}

const BARIS = JANGKAR + '\n\n'
  + '// Pengikut Copy Signal di server — 24 jam, khusus akun pemilik (pengikut-copy-vps.js).\n'
  + '// Menyalin sinyal analis yang diikuti ke terminal MT5 pemilik tanpa butuh tab peramban.\n'
  + "require('./pengikut-copy-vps')(app, { butuhLogin, batasLaju, express, DIR: __dirname });";

s = s.replace(JANGKAR, BARIS);
writeFileSync(berkas, s);
console.log('require pengikut-copy-vps ditanam sesudah mt5agen.');
