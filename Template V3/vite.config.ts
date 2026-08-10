import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

/* base './' supaya hasil build bisa ditaruh di subfolder GitHub Pages
   (/Jadi-Trader-Tools/) tanpa mengubah apa pun. */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
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
