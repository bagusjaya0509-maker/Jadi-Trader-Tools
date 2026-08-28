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

   Alamatnya /testing. Ia rute React biasa — halaman ini memang untuk
   melihat komponennya, bukan untuk dibaca mesin pencari, jadi tidak ada
   alasan membuatnya statis.
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
   demo-nya. */
const Testing: React.FC = () => (
  <div className="dark min-h-screen bg-black text-white">
    <LinkPreviewDemoSecond />
  </div>
);

export default Testing;

/* Catatan kecil, supaya tidak dibongkar orang lain nanti: pembungkus di atas
   sengaja ditulis `React.FC`. `import React from "react"` ada di baris kedua
   berkas ini karena ia bagian dari demo yang ditempel apa adanya — dan
   `noUnusedLocals` menolak impor yang tidak terpakai. Yang dibuat memakainya
   pembungkus MILIK SAYA, bukan kode kiriman pemilik. */
