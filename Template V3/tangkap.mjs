import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/* Menangkap tampilan tiap halaman dari server dev LOKAL.
   Gerbang login sudah punya jalan pintas dev bawaan (App.tsx: `!import.meta
   .env.DEV`), jadi tidak ada kredensial yang disentuh sama sekali — dan
   cabang itu memang tidak ada di bundel produksi.

   Yang tertangkap adalah keadaan APA ADANYA: tanpa login, data contoh.
   Tidak ada angka yang disunting; kalau layarnya menulis "data contoh",
   itu memang yang dilihat orang baru.

   ── ALAMATNYA PATH, BUKAN HASH — DAN INI YANG DULU MEMBUATNYA DIAM ──────
   Skrip ini dulu memakai `http://localhost:5190/#` + rute. Waktu V3 pindah
   dari HashRouter ke BrowserRouter, `#/dashboard` berhenti berarti apa-apa:
   peramban membacanya sebagai jangkar di halaman "/", jadi SEMUA halaman
   dipotret sebagai halaman yang sama — dan tidak ada satu pun galat yang
   memberi tahu. Tangkapan di public/tangkapan/ berhenti diperbarui sejak
   17 Agustus 2026 karena itu; ketahuan 6 September saat pemilik bertanya
   kenapa gambar di halaman depan tidak menyusul isi situsnya.

   Kalau nanti routernya diganti lagi, YANG PERTAMA diperiksa adalah baris
   DASAR di bawah. */

const KELUAR = 'C:/Users/Admin/Documents/Obsidian Vault/Jadi Trader Tools/Template V3/public/tangkapan';
const DASAR = 'http://localhost:5190';

/* Nama berkas = kunci yang dipakai story-scroll-demo.tsx. Menggantinya di
   sini WAJIB diikuti di sana; tidak ada yang menghubungkan keduanya selain
   nama, dan gambar yang hilang tidak melempar galat — ia cuma kosong. */
/* Angka ketiga = jeda tambahan (ms) sebelum dipotret, untuk halaman yang
   butuh lebih lama dari 8 detik bawaan. Screener memuat bingkai V2 494 kB
   LALU memindai pasar di dalamnya — dipotret pada detik ke-8 yang tertangkap
   kerangka kosong yang belum berisi satu kartu pun. */
const HALAMAN = [
  ['chart',      '/chart-entry?simbol=BTCUSDT&tf=4h'],
  /* ── KENAPA /screener-react DAN BUKAN /screener ──────────────────────
     /screener adalah BINGKAI ke `ema-cross-screener_3.html` milik V2, dan
     V2 punya gerbang login Google-nya SENDIRI di dalam bingkai itu. Pengguna
     yang sudah masuk di jaditrader.co.id melewatinya tanpa sadar — sesi
     Firebase-nya satu domain — tapi kamera ini tidak masuk ke mana pun, jadi
     yang tertangkap cuma kotak "Login untuk melanjutkan".

     /screener-react halaman yang sama isinya: Koin Hunter dan Zona Pantau,
     dihitung mesin pindai yang sama persis (lib/pindai.ts). Ia rute yang
     memang dikirimkan produk ini, bukan halaman uji — jadi yang diperlihatkan
     tetap alat yang sungguh ada, cuma lewat cangkang yang tidak bergerbang.

     Judul bilahnya menulis "Screener Area (React)" dan itu SENGAJA DIBIARKAN.
     Menyuntingnya berarti mulai merapikan tangkapan layar, dan begitu satu
     kata boleh diganti, tidak ada lagi garis yang jelas untuk yang berikutnya. */
  ['screener',   '/screener-react', 8000],
  ['dashboard',  '/dashboard'],
  ['jurnal',     '/journal'],
  /* Copy Signal dipotret APA ADANYA — papan peringkat terbuka. Dua varian
     lain sudah dicoba dan lebih buruk: melipat peringkat menyisakan 60%
     layar kosong, dan tab Posting Signal butuh login jadi isinya cuma satu
     kalimat ajakan masuk. */
  ['copy',       '/copy-signal'],
  /* Tiga layar yang belum pernah ada di halaman depan sama sekali. Semuanya
     lahir sesudah tangkapan terakhir, dan itu justru bagian situs yang
     paling banyak berubah sejak Agustus. */
  ['wallet',     '/wallet-tracking'],
  /* Coin Hunter SENGAJA TIDAK DIPOTRET. Dicoba 6 Sep 2026 dan hasilnya
     tiga kotak kosong: daftarnya minta login, sentimen pasar dan Lintasan
     Koin DEX dua-duanya gagal terjangkau dari mesin lokal. Layar kosong di
     halaman jualan mengatakan hal yang salah tentang alat yang sebenarnya
     bekerja — dan Wallet Tracking di atas sudah mewakili menu yang sama. */
  ['personal',   '/personal-area'],
  ['marketplace', '/marketplace'],
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

try {
for (const [nama, rute, jedaEkstra] of HALAMAN) {
  try {
    /* Muat ulang penuh tiap halaman, bukan pindah rute lewat router: rute
       malas + data yang diambil sekali di mount membuat pindah-dalam-SPA
       menampilkan sisa halaman sebelumnya. */
    /* BUKAN networkidle: dashboard, screener, chart, dan jurnal menarik
       data pasar terus-menerus, jadi jaringannya tidak pernah diam dan
       goto selalu kehabisan waktu. Yang dipakai domcontentloaded + jeda
       tetap yang cukup panjang untuk grafik selesai digambar. */
    await page.goto(DASAR + rute, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(8000 + (jedaEkstra || 0));   // grafik & data pasar menyusul

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

    /* ── PENJAGA: HALAMAN YANG SALAH TIDAK BOLEH LOLOS DIAM-DIAM ─────────
       Pelajaran dari kerusakan hash di atas. Alamat yang tidak dikenal
       router dialihkan ke "/" (lihat Route path="*" di App.tsx), dan yang
       tertangkap jadi halaman jualan — sembilan kali, tanpa satu pun galat.
       Judul dokumen dan alamat yang sedang tampil dicatat supaya selisihnya
       kelihatan di log tanpa harus membuka gambarnya satu per satu. */
    const jalurAkhir = await page.evaluate(() => location.pathname + location.search);
    const teks = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 70));
    const nyasar = jalurAkhir === '/' && rute !== '/';
    await page.screenshot({ path: `${KELUAR}/${nama}.png` });
    console.log(`${nyasar ? 'NYASAR' : 'ok    '} ${nama.padEnd(12)} ${jalurAkhir.padEnd(38)} ${teks}`);
  } catch (e) {
    console.log(`GAGAL  ${nama.padEnd(12)} ${String(e.message).slice(0, 120)}`);
  }
}

} finally {
  await browser.close();
}
console.log('selesai →', KELUAR);
