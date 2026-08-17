import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/* Menangkap tampilan tiap halaman dari server dev LOKAL.
   Gerbang login sudah punya jalan pintas dev bawaan (App.tsx: `!import.meta
   .env.DEV`), jadi tidak ada kredensial yang disentuh sama sekali — dan
   cabang itu memang tidak ada di bundel produksi.

   Yang tertangkap adalah keadaan APA ADANYA: tanpa login, data contoh.
   Tidak ada angka yang disunting; kalau layarnya menulis "data contoh",
   itu memang yang dilihat orang baru. */

const KELUAR = 'C:/Users/Admin/Documents/Obsidian Vault/Jadi Trader Tools/Template V3/public/tangkapan';
const DASAR = 'http://localhost:5190/#';

const HALAMAN = [
  ['screener',    '/screener'],
  ['dashboard',   '/dashboard'],
  ['chart',       '/chart?simbol=BTCUSDT&tf=4h'],
  ['jurnal',      '/jurnal'],
  /* Copy Signal dipotret APA ADANYA — papan peringkat terbuka. Dua varian
     lain sudah dicoba dan lebih buruk: melipat peringkat menyisakan 60%
     layar kosong, dan tab Posting Signal butuh login jadi isinya cuma satu
     kalimat ajakan masuk. */
  ['copy',        '/copy'],
];

mkdirSync(KELUAR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  /* 1600 × 1,25 = 2000 px. Kotak di /template melebar ~988 px CSS, jadi
     2000 px persis cukup untuk layar 2×; lebih dari itu cuma menambah
     bita yang tidak pernah terlihat. */
  deviceScaleFactor: 1.25,
  colorScheme: 'dark',
});
const page = await ctx.newPage();

for (const [nama, rute] of HALAMAN) {
  try {
    /* Muat ulang penuh tiap halaman, bukan pindah hash: rute malas + data
       yang diambil sekali di mount membuat pindah-hash menampilkan sisa
       halaman sebelumnya. */
    /* BUKAN networkidle: dashboard, screener, chart, dan jurnal menarik
       data pasar terus-menerus, jadi jaringannya tidak pernah diam dan
       goto selalu kehabisan waktu. Yang dipakai domcontentloaded + jeda
       tetap yang cukup panjang untuk grafik selesai digambar. */
    await page.goto(DASAR + rute, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(7000);   // grafik & data pasar menyusul

    /* Yang disembunyikan HANYA tempelan login: One Tap Google (iframe pihak
       ketiga yang mengambang di pojok) dan tombol Masuk Google/Discord.
       Ketiganya milik keadaan "belum masuk" — bukan bagian dari alat yang
       sedang diperlihatkan, dan ia menutupi bilah atas.

       Tidak ada yang lain disentuh. Angka, grafik, dan pita "data contoh"
       tetap apa adanya: yang tertangkap harus benar-benar layar yang akan
       dilihat orang, bukan versi yang dirapikan supaya terlihat lebih baik
       dari kenyataannya. */
    await page.addStyleTag({ content: `
      iframe[src*="accounts.google.com"],
      [id*="credential_picker"],
      div[aria-labelledby="credential_picker"] { display: none !important; }
    ` });
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        const t = (b.textContent || '').trim();
        if (t === 'Masuk dengan Google' || t === 'Masuk dengan Discord') {
          b.style.display = 'none';
        }
      }
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${KELUAR}/${nama}.png` });
    const judul = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 90));
    console.log(`ok   ${nama.padEnd(12)} ${judul}`);
  } catch (e) {
    console.log(`GAGAL ${nama.padEnd(12)} ${String(e.message).slice(0, 120)}`);
  }
}

await browser.close();
console.log('\nselesai →', KELUAR);
