import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

/* ════════════════════════════════════════════════════════════════════════
   PENANDA VERSI BUILD
   ════════════════════════════════════════════════════════════════════════
   GitHub Pages menyajikan index.html dengan `Cache-Control: max-age=600`,
   dan itu tidak bisa diubah dari sisi kita. Selama sepuluh menit setelah
   deploy, peramban (dan CDN Fastly di depannya) masih menyajikan index.html
   LAMA — yang menunjuk ke nama berkas aset yang lama pula. Hasilnya:
   sudah di-push, workflow hijau, tapi layarnya tidak berubah sama sekali.

   Penandanya ditulis ke `versi.json` DAN ditanam ke dalam bundel. Aplikasi
   membandingkan keduanya; kalau berbeda, index.html yang dimuat sudah usang
   dan halaman dimuat ulang dengan parameter pembeda supaya cache-nya
   dilewati. Sama persis dengan cara V2 menangani masalah yang sama.

   VPS tidak punya masalah ini — di sana index.html disajikan `no-cache`. */
const VERSI_BUILD = String(Date.now());

function penandaVersi() {
  return {
    name: 'jt-penanda-versi',
    generateBundle(this: { emitFile: (f: unknown) => void }) {
      this.emitFile({
        type: 'asset',
        fileName: 'versi.json',
        source: JSON.stringify({ versi: VERSI_BUILD }),
      });
    },
  };
}

/* base './' supaya hasil build bisa ditaruh di subfolder GitHub Pages
   (/Jadi-Trader-Tools/) tanpa mengubah apa pun. */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), penandaVersi()],
  define: { __JT_VERSI__: JSON.stringify(VERSI_BUILD) },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      /* `next/image` dan `next/link` DISEDIAKAN, bukan disunting keluar dari
         komponennya. Komponen kiriman pemilik ditulis untuk Next.js; alih-alih
         mengubah kodenya (yang sudah berkali-kali diminta jangan), modulnya
         yang dibuat ada. Lihat src/shim/. */
      'next/image': path.resolve(__dirname, './src/shim/next-image.tsx'),
      'next/link': path.resolve(__dirname, './src/shim/next-link.tsx'),
    },
  },
  build: {
    /* Pustaka besar dipisah dari kode kita sendiri. Kode aplikasi berubah
       hampir tiap rilis; Recharts dan Firebase hampir tidak pernah. Kalau
       ketiganya menyatu dalam satu berkas, satu perbaikan teks memaksa
       semua pengunjung mengunduh ulang 400 kB pustaka yang sama sekali
       tidak berubah. Dipisah begini, cache peramban mereka tetap terpakai. */
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
