"use client";
import React from "react";
import { LinkPreview } from "@/components/ui/link-preview";

/* ════════════════════════════════════════════════════════════════════════
   HALAMAN TESTING — demo.tsx DITEMPEL APA ADANYA
   ════════════════════════════════════════════════════════════════════════
   Fungsi LinkPreviewDemoSecond di bawah adalah demo.tsx yang dikirim
   pemilik, huruf per huruf. Tidak satu baris pun disunting.

   Supaya bisa begitu, `next/image` dan `next/link` DISEDIAKAN sebagai modul
   sungguhan lewat alias di vite.config.ts → src/shim/. Yang menyesuaikan
   diri lingkungannya, bukan kodenya.

   ── DIKEMBALIKAN 28 AGU 2026 ────────────────────────────────────────────
   Sempat saya isi dengan artikel sungguhan supaya bentuknya bisa dinilai.
   Pemilik menilainya rusak dan minta dibatalkan, dengan satu syarat yang
   ditulis jelas: JANGAN mengubah struktur dan jenis font yang sudah ada.

   Jadi berkas ini kembali persis ke keadaan yang sudah disetujui — cuma
   demo-nya, tidak lebih. Data artikel `src/artikel/isi.ts` masih dibuat
   perendernya tapi tidak diimpor siapa pun lagi; ia tidak ikut ke bundel
   dan tidak menyentuh apa pun.
   ════════════════════════════════════════════════════════════════════════ */

export function LinkPreviewDemoSecond() {
  return (
    <div className="flex justify-center items-start h-[40rem] flex-col px-4">
      <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left mb-10">
        Visit{" "}
        <LinkPreview
          url="https://ui.aceternity.com"
          className="font-bold bg-clip-text text-transparent bg-gradient-to-br from-purple-500 to-pink-500"
        >
          Aceternity UI
        </LinkPreview>{" "}
        and for amazing Tailwind and Framer Motion components.
      </p>

      <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left ">
        I listen to{" "}
        <LinkPreview
          url="https://www.youtube.com/watch?v=S-z6vyR89Ig&list=RDMM&index=3"
          imageSrc="https://ui.aceternity.com/_next/image?url=%2Fimages%2Fimraan-hashmi.jpeg&w=640&q=50"
          isStatic
          className="font-bold"
        >
          this guy
        </LinkPreview>{" "}
        and I watch{" "}
        <LinkPreview
          url="/templates"
          imageSrc="https://ui.aceternity.com/_next/image?url=%2Fimages%2Ffight-club.jpeg&w=640&q=50"
          isStatic
          className="font-bold"
        >
          this movie
        </LinkPreview>{" "}
        twice a day
      </p>
    </div>
  );
}

/* Pembungkus rute. Demo aslinya tidak punya latar sendiri — di halaman
   terang ia tidak terbaca, karena kelas warnanya `dark:text-neutral-400`.
   Pembungkus ini yang memberi latar gelap, dan ia BUKAN bagian dari
   demo-nya.

   Ditulis `React.FC` dengan sengaja: `import React from "react"` ada di
   baris kedua berkas ini karena ia bagian dari demo yang ditempel apa
   adanya, dan `noUnusedLocals` menolak impor yang menganggur. Yang dibuat
   memakainya kode SAYA, bukan kode kiriman pemilik. */
const Testing: React.FC = () => (
  <div className="dark min-h-screen bg-black text-white">
    <LinkPreviewDemoSecond />
  </div>
);

export default Testing;
