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

const b = await chromium.launch();
for (const [nama, isi, n] of [
  ['public/favicon-32.png', svg, 32],
  ['public/favicon-48.png', svg, 48],
  ['public/apple-touch-icon.png', kotak, 180],
]) {
  const p = await b.newPage({ viewport: { width: n, height: n }, deviceScaleFactor: 1 });
  await p.setContent(
    `<style>*{margin:0;padding:0}html,body{width:${n}px;height:${n}px;overflow:hidden}
     svg{display:block;width:${n}px;height:${n}px}</style>${isi}`);
  await p.waitForTimeout(250);
  const buf = await p.screenshot({ omitBackground: true });
  writeFileSync(nama, buf);
  console.log(`${nama.padEnd(30)} ${n}x${n}  ${buf.length} bita`);
  await p.close();
}
await b.close();
