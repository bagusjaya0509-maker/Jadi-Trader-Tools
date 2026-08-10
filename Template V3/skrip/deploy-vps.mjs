#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   DEPLOY KE VPS — satu perintah, tanpa GitHub
   ════════════════════════════════════════════════════════════════════════
     npm run deploy

   Membangun, mengirim ke VPS, dan memasang di /root/v3 — yang disajikan
   backend di https://103-253-145-38.sslip.io/v3/

   Dipakai kunci SSH `~/.ssh/id_jaditrader_deploy` yang sudah ada di
   authorized_keys VPS. Tidak ada kata sandi yang diminta atau disimpan.

   ── KENAPA TUKAR FOLDER, BUKAN SALIN DI ATASNYA ────────────────────────
   Nama berkas di assets/ berhash dan berubah tiap rilis. Menyalin di atas
   folder lama meninggalkan berkas rilis-rilis sebelumnya selamanya — dalam
   sepuluh rilis, /root/v3 berisi sepuluh set assets dan tidak ada cara tahu
   mana yang masih terpakai.

   Jadi rilis baru diekstrak ke folder terpisah dulu, diperiksa, baru
   ditukar. Kalau ekstraksinya gagal di tengah, folder yang sedang tayang
   belum tersentuh sama sekali. Yang lama disimpan sebagai /root/v3.lama —
   satu perintah untuk kembali kalau ada yang salah.
   ════════════════════════════════════════════════════════════════════════ */

import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VPS = 'root@103.253.145.38';
const KUNCI = join(process.env.USERPROFILE || process.env.HOME || '', '.ssh', 'id_jaditrader_deploy');
const ALAMAT = 'https://103-253-145-38.sslip.io/v3/';

function jalan(cmd, args, opsi = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', ...opsi });
}

/** `C:\Users\x` → `/c/Users/x`.
 *
 *  tar, scp, dan ssh di sini adalah biner Git Bash: mereka memperlakukan
 *  segmen sebelum titik dua sebagai NAMA HOST. Jalur Windows apa adanya
 *  membuat tar mencoba menghubungi mesin bernama "C" dan gagal dengan
 *  "Cannot connect to C: resolve failed" — pesan yang tidak menyebut jalur
 *  sama sekali, jadi penyebabnya tidak kelihatan. */
function keJalurPosix(p) {
  return p.replace(/^([A-Za-z]):[\\/]/, (_, d) => `/${d.toLowerCase()}/`).replace(/\\/g, '/');
}

if (!existsSync(KUNCI)) {
  console.error(`\n✖ Kunci SSH tidak ditemukan: ${KUNCI}`);
  console.error('  → Tanpa itu deploy tidak bisa jalan. Kuncinya dibuat saat setup VPS.\n');
  process.exit(1);
}

console.log('\n── 1/4  Membangun ───────────────────────────────────────\n');
try {
  execSync('npm run build', { cwd: AKAR, stdio: 'inherit' });
} catch {
  console.error('\n✖ Build gagal. Tidak ada yang dikirim — yang tayang tetap versi lama.\n');
  process.exit(1);
}

console.log('\n── 2/4  Mengemas & mengirim ─────────────────────────────\n');
/* Semua dijalankan dengan cwd = AKAR dan jalur RELATIF, jadi tidak ada
   huruf drive yang bisa disalahartikan sebagai nama host. Kunci SSH tetap
   absolut karena letaknya di luar folder ini — karena itu dikonversi. */
const kunciPosix = keJalurPosix(KUNCI);
jalan('tar', ['czf', 'dist.tar.gz', '-C', 'dist', '.'], { cwd: AKAR });
jalan('scp', ['-i', kunciPosix, '-o', 'BatchMode=yes', 'dist.tar.gz', `${VPS}:/tmp/v3.tar.gz`], { cwd: AKAR });
jalan('rm', ['-f', 'dist.tar.gz'], { cwd: AKAR });
console.log('  terkirim.');

console.log('\n── 3/4  Memasang di VPS ─────────────────────────────────\n');
const pasang = `
set -e
rm -rf /root/v3.baru && mkdir -p /root/v3.baru
tar xzf /tmp/v3.tar.gz -C /root/v3.baru
test -f /root/v3.baru/index.html
test -d /root/v3.baru/assets
echo "  $(find /root/v3.baru -type f | wc -l) berkas, $(du -sh /root/v3.baru | cut -f1)"
rm -rf /root/v3.lama
[ -d /root/v3 ] && mv /root/v3 /root/v3.lama || true
mv /root/v3.baru /root/v3
rm -f /tmp/v3.tar.gz
echo "  terpasang."
`.trim();
console.log(jalan('ssh', ['-i', kunciPosix, '-o', 'BatchMode=yes', VPS, pasang]).trimEnd());

console.log('\n── 4/4  Memeriksa ───────────────────────────────────────\n');
/* Memeriksa lewat internet, bukan lewat SSH: yang perlu dibuktikan bukan
   "berkasnya ada di disk" melainkan "orang di luar bisa membukanya".
   Dipakai fetch bawaan Node, bukan curl — curl versi Windows gagal menulis
   ke /dev/null dan keluar dengan kode 23 walaupun permintaannya sukses. */
let kode = '—';
try {
  const r = await fetch(ALAMAT, { signal: AbortSignal.timeout(30_000) });
  kode = String(r.status);
} catch (e) {
  kode = 'gagal: ' + (e instanceof Error ? e.message : String(e));
}
console.log(`  ${ALAMAT} → HTTP ${kode}`);

if (kode !== '200') {
  console.error('\n✖ Situsnya tidak menjawab 200. Untuk mengembalikan versi sebelumnya:');
  console.error(`  ssh -i "${KUNCI}" ${VPS} "rm -rf /root/v3 && mv /root/v3.lama /root/v3"\n`);
  process.exit(1);
}

console.log(`
✔ Selesai.  ${ALAMAT}

  Versi sebelumnya masih ada di /root/v3.lama. Kalau ada yang salah:
  ssh -i "${kunciPosix}" ${VPS} "rm -rf /root/v3 && mv /root/v3.lama /root/v3"
`);
