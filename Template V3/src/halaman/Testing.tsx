"use client";
import React from "react";
import { LinkPreview } from "@/components/ui/link-preview";
import { ARTIKEL, type Artikel } from '@/artikel/isi';

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

/* ────────────────────────────────────────────────────────────────────────
   MULAI DARI SINI KODE SAYA. Yang di atas demo.tsx kiriman pemilik, utuh.
   ──────────────────────────────────────────────────────────────────────── */

/* Kelas paragraf DISALIN PERSIS dari demo di atas — itu seluruh gunanya
   halaman ini: melihat isi artikel yang sesungguhnya memakai tipografi yang
   sama, bukan memakai perkiraan saya soal tipografi itu. */
const KELAS_P = 'text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl text-left';

/* Teks artikel memuat <b> dan <code> yang ditulis penulisnya sendiri, bukan
   pengguna. Karena itu ia disisipkan sebagai HTML. Kalau suatu saat isinya
   datang dari luar, ini titik pertama yang harus diganti. */
function Teks({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function IsiArtikel({ artikel }: { artikel: Artikel }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16">
      <span className="mb-5 inline-block rounded-full border border-neutral-800 px-3 py-1 text-xs uppercase tracking-widest text-neutral-500">
        {artikel.jenis === 'fitur' ? 'Panduan' : 'Edukasi'} &middot; {artikel.menit} menit baca
      </span>

      <h1 className="mb-6 text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
        {artikel.judul}
      </h1>

      <p className={`${KELAS_P} mb-12`}>{artikel.ringkas}</p>

      {artikel.isi.map((blok, i) => {
        if (blok.jenis === 'h2') {
          return (
            <h2 key={i} className="mt-16 mb-5 text-2xl font-semibold tracking-tight text-white md:text-4xl">
              <Teks html={blok.isi as string} />
            </h2>
          );
        }
        if (blok.jenis === 'catatan') {
          return (
            <div key={i} className="mb-8 max-w-3xl rounded-lg border border-neutral-800 border-l-2 border-l-neutral-600 bg-neutral-950 px-6 py-5 text-base text-neutral-400 md:text-xl">
              <Teks html={blok.isi as string} />
            </div>
          );
        }
        if (blok.jenis === 'ul' || blok.jenis === 'ol') {
          const Tag = blok.jenis;
          return (
            <Tag key={i} className={`${KELAS_P} mb-8 list-outside space-y-4 pl-7 ${blok.jenis === 'ul' ? 'list-disc' : 'list-decimal'}`}>
              {(blok.isi as string[]).map((li, j) => (
                <li key={j}><Teks html={li} /></li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i} className={`${KELAS_P} mb-8`}>
            <Teks html={blok.isi as string} />
          </p>
        );
      })}

      {artikel.terkait.length > 0 && (
        <div className="mt-20 border-t border-neutral-800 pt-8">
          <h2 className="mb-4 text-xs uppercase tracking-widest text-neutral-500">Baca juga</h2>
          {artikel.terkait.map((t) => (
            <p key={t.slug} className="mb-3 text-xl md:text-3xl">
              {/* Di sinilah komponen kiriman pemilik dipakai untuk isi yang
                  sungguhan: gambarnya gambar artikel kita sendiri, jadi
                  kartunya benar-benar terisi — beda dengan demo di atas yang
                  gambarnya ditolak server Aceternity. */}
              <LinkPreview url={`/artikel/${t.slug}/`} imageSrc={t.gambar} isStatic className="font-bold">
                {t.judul}
              </LinkPreview>
            </p>
          ))}
        </div>
      )}
    </article>
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
    <IsiArtikel artikel={ARTIKEL[0]} />

    <div className="mx-auto max-w-3xl border-t border-neutral-900 px-4 pt-10">
      <p className="mb-8 text-xs uppercase tracking-widest text-neutral-600">
        Di bawah ini demo aslinya, apa adanya
      </p>
    </div>
    <LinkPreviewDemoSecond />
  </div>
);

export default Testing;
