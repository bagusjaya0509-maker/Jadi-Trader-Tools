/* ════════════════════════════════════════════════════════════════════════
   PENGGANTI `motion/react` — DIARAHKAN KE framer-motion YANG SUDAH ADA
   ════════════════════════════════════════════════════════════════════════
   Komponen dynamic-island-toc kiriman pemilik mengimpor dari "motion/react".
   Petunjuk pemasangannya menyuruh `npm i motion`. Itu TIDAK dilakukan, dan
   alasannya bukan malas:

   `motion` dan `framer-motion` adalah pustaka yang sama. Framer melepas
   namanya ke motion.dev, dan sejak itu keduanya terbit dari satu kode
   sumber dengan API yang sama persis. Proyek ini sudah memakai
   framer-motion 13.1.1 — dipakai link-preview, dan ikut ke bundel artikel.

   Memasang `motion` di sampingnya berarti DUA salinan pustaka animasi di
   satu bundel: dua penjadwal bingkai, dua konteks AnimatePresence, dan
   berkas artikel-pratinjau.js yang membengkak tanpa satu pun kemampuan
   baru. Komponen yang saling bertetangga (link-preview dan TOC ini) bahkan
   akan memakai runtime yang berbeda.

   Jadi sekali lagi: yang menyesuaikan diri LINGKUNGANNYA, bukan kodenya.
   Berkas komponennya tetap huruf per huruf seperti dikirim — lihat juga
   src/shim/next-image.tsx dan next-link.tsx yang lahir dari alasan sama.

   Terdaftar sebagai alias di vite.config.ts, vite.artikel.config.ts, dan
   "paths" tsconfig.json. Kalau suatu hari `motion` betul-betul dipasang,
   cukup cabut ketiga alias itu — berkas ini dan komponennya tidak perlu
   disentuh.
   ════════════════════════════════════════════════════════════════════════ */
export * from 'framer-motion';
