import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

/* PNG dibuat dari favicon.svg yang SAMA, bukan digambar ulang — kalau
   lambangnya diperbaiki nanti, jalankan ulang skrip ini dan semua ukuran
   ikut benar. Menggambar tiap ukuran dengan tangan adalah cara pasti
   membuat 32 px dan 180 px diam-diam berbeda bentuk. */
const svg = readFileSync('public/favicon.svg', 'utf8');

/* apple-touch-icon TANPA sudut membulat: iOS memasang maskernya sendiri,
   dan tile yang sudah bulat lalu dimasker lagi menghasilkan tepi bergerigi
   dengan pita hitam di keempat sudutnya.

   Garis tepinya ikut dibuang. Di tile 32 px ia penegas bentuk yang berguna;
   diperbesar ke 180 px ia jadi bingkai abu selebar 5 px mengelilingi ikon —
   terbaca sebagai kesalahan cetak, bukan sebagai desain. */
const kotak = svg
  .replace('rx="7.5"', 'rx="0"')
  .replace(/\n\s*<rect x="\.5"[^/]*\/>/, '');

/* ── IKON PWA ──────────────────────────────────────────────────────────
   Dibuat dari favicon.svg yang SAMA. Sempat dibuat dari brand/logo-ikon —
   lambang lilin+panah — dan itu lambang LAMA; hasilnya aplikasi terpasang
   memakai identitas yang berbeda dari tabnya sendiri.

   MASKABLE PUNYA GEOMETRI SENDIRI, bukan berkas yang sama dipakai ulang.
   Android memotong ikon jadi lingkaran dan hanya menjamin 80% bagian tengah
   selamat. Di lambang ini batang tertinggi mulai pada y=2.6 dari 32, yaitu
   8% dari tepi atas — LEBIH RAPAT daripada 10% yang dijamin, jadi ujung
   batangnya akan terpotong. Karena itu versi maskable memuat lambangnya
   pada 76% di atas kanvas penuh: sudutnya boleh dipotong, isinya tidak.

   Latarnya PADAT (#09090b), bukan transparan: bagian yang dipotong masker
   akan digambar putih oleh peluncur Android kalau alfanya kosong. */
const skala = (isi, n, muat, bulat) => `<style>
  *{margin:0;padding:0}
  html,body{width:${n}px;height:${n}px;overflow:hidden;background:${bulat ? 'transparent' : '#09090b'}}
  .bingkai{width:${n}px;height:${n}px;display:flex;align-items:center;justify-content:center}
  svg{display:block;width:${Math.round(n * muat)}px;height:${Math.round(n * muat)}px}
</style><div class="bingkai">${isi}</div>`;

const b = await chromium.launch();
for (const [nama, isi, n, muat, tembus] of [
  ['public/favicon-32.png', svg, 32, 1, true],
  ['public/favicon-48.png', svg, 48, 1, true],
  ['public/apple-touch-icon.png', kotak, 180, 1, true],
  /* purpose "any": tile membulat apa adanya, sama dengan yang di tab. */
  ['public/pwa-192.png', svg, 192, 1, true],
  ['public/pwa-512.png', svg, 512, 1, true],
  /* purpose "maskable": persegi tanpa tepi, lambang mengecil ke 76%. */
  ['public/pwa-maskable-192.png', kotak, 192, 0.76, false],
  ['public/pwa-maskable-512.png', kotak, 512, 0.76, false],
]) {
  const p = await b.newPage({ viewport: { width: n, height: n }, deviceScaleFactor: 1 });
  await p.setContent(skala(isi, n, muat, tembus));
  await p.waitForTimeout(250);
  const buf = await p.screenshot({ omitBackground: tembus });
  writeFileSync(nama, buf);
  console.log(`${nama.padEnd(34)} ${n}x${n}  ${buf.length} bita`);
  await p.close();
}
await b.close();
