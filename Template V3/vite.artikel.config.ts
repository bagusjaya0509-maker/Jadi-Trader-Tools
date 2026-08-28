import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/* ════════════════════════════════════════════════════════════════════════
   BUNDEL TERPISAH UNTUK HALAMAN ARTIKEL STATIS
   ════════════════════════════════════════════════════════════════════════
   Halaman artikel bukan bagian dari aplikasi React — ia berkas HTML statis
   di `public/artikel/`, dan itu disengaja supaya isinya terbaca crawler.
   Tapi pemilik ingin komponen link-preview Aceternity yang SUNGGUHAN
   dipakai di sana, bukan tiruan CSS.

   Karena itu satu bundel kecil berdiri sendiri: React, Radix HoverCard, dan
   framer-motion dijadikan satu berkas IIFE yang bisa ditempel dengan satu
   <script defer>. Ia BUKAN bagian dari bundel aplikasi.

   NAMANYA TIDAK BER-HASH, dan itu perlu: halaman artikel ditulis Python
   yang tidak tahu hash apa pun. Konsekuensinya berkas ini harus disajikan
   dengan cache pendek — dan memang begitu, karena ia duduk di `public/`
   yang disajikan seperti berkas biasa, bukan seperti aset ber-hash.

   Pakai:  npx vite build --config vite.artikel.config.ts
   ════════════════════════════════════════════════════════════════════════ */
export default defineConfig({
  plugins: [react()],
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
    outDir: 'public',
    /* WAJIB false. outDir menunjuk ke public/, dan mengosongkannya berarti
       menghapus robots.txt, sitemap.xml, seluruh gambar, dan seluruh
       artikel yang sudah dibangun. */
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/artikel-pratinjau.tsx'),
      name: 'JTPratinjau',
      formats: ['iife'],
      fileName: () => 'artikel-pratinjau.js',
    },
    /* Tidak ada `external`: berkas ini harus jalan sendiri di halaman yang
       tidak memuat apa pun. */
    minify: 'esbuild',
    target: 'es2020',
  },
  define: { 'process.env.NODE_ENV': '"production"' },
});
