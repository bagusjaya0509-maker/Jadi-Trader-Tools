import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

/* ════════════════════════════════════════════════════════════════════════
   STORY-SCROLL — salinan dari sumbernya, dengan SATU penyimpangan sadar
   ════════════════════════════════════════════════════════════════════════
   Aslinya komponen ini mengambil alih seluruh halaman: tiap seksi setinggi
   layar, dan ScrollTrigger membaca gulir JENDELA. Di sini ia dipasang di
   dalam kotak gambar hero halaman /template — jadi:

   - `min-h-screen` menjadi `min-h-full`: "satu layar" berarti satu tinggi
     kotak, bukan satu tinggi monitor;
   - setiap ScrollTrigger diberi `scroller` yang menunjuk kontainer ini,
     karena yang digulir orangnya adalah kotaknya, bukan jendela — tanpa
     itu semua pin dan rotasi menunggu gulir halaman yang tidak pernah
     berhubungan dengan kotak;
   - `'use client'` dibuang (ini SPA Vite, bukan Next).

   Selebihnya — rotasi 30° dari kiri-bawah, pin bertumpuk, zIndex
   berjenjang, penghormatan prefers-reduced-motion — persis sumbernya.
   ════════════════════════════════════════════════════════════════════════ */

gsap.registerPlugin(ScrollTrigger);

function cx(...parts: Array<string | undefined | false | null>): string {
  return parts.filter(Boolean).join(' ');
}

export interface FlowSectionProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  'aria-label'?: string;
}

export const FlowSection: React.FC<FlowSectionProps> = ({
  className,
  style = {},
  children,
  'aria-label': ariaLabel,
}) => (
  <section
    data-flow-section
    aria-label={ariaLabel}
    /* h-full WAJIB berdampingan dengan min-h-full, dan alasannya hanya
       kelihatan pada seksi TERAKHIR.

       `min-h-full` saja membuat tinggi seksi tetap `auto`. Empat seksi
       pertama tidak terpengaruh: ScrollTrigger menyematkannya, dan
       penyematan memasang tinggi eksplisit. Seksi terakhir tidak
       disematkan — tingginya tetap auto, jadi `min-h-full` di kotak
       dalamnya (persentase terhadap induk ber-tinggi auto) tidak
       menghasilkan apa-apa, dan kotak itu menyusut ke tinggi isinya.
       Terukur: gambar seksi terakhir setinggi 187 px, bukan 555 — sisanya
       tembus ke seksi di bawahnya, jadi dua layar terlihat bertumpuk.

       height:100% menjadikan tingginya pasti, dan persentase di dalamnya
       punya sesuatu untuk dihitung. */
    className={cx('relative h-full min-h-full w-full overflow-hidden', className)}
  >
    <div
      data-flow-inner
      className={cx(
        'flow-art-container relative flex min-h-full w-full flex-col justify-between gap-6 px-[4vw] pt-[clamp(2rem,8vw,4vw)] pb-[4vw]',
        'will-change-transform',
      )}
      style={{ transformOrigin: 'bottom left', ...style }}
    >
      {children}
    </div>
  </section>
);

export interface FlowArtProps {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

const childCount = (children: React.ReactNode) => React.Children.count(children);

const FlowArt: React.FC<FlowArtProps> = ({
  children,
  className,
  'aria-label': ariaLabel = 'Story scroll',
}) => {
  const containerRef = useRef<HTMLElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useGSAP(
    () => {
      if (!containerRef.current || reducedMotion) return;

      /* Kontainer inilah yang digulir — SETIAP trigger wajib menyebutnya.
         ScrollTrigger yang dibiarkan memakai bawaannya akan mendengarkan
         jendela, yang di halaman ini tidak menggulirkan kotak sama sekali. */
      const scroller = containerRef.current;

      const sections = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>('[data-flow-section]'),
      );
      if (sections.length === 0) return;

      const triggers: ScrollTrigger[] = [];

      sections.forEach((section, i) => {
        gsap.set(section, { zIndex: i + 1 });

        const inner = section.querySelector<HTMLElement>('.flow-art-container');
        if (!inner) return;

        if (i > 0) {
          /* force3D + backface: memaksa panel ini jadi lapisan GPU sendiri.
             Tanpa itu peramban me-raster ulang seluruh kotak tiap kali
             sudutnya berubah — di ponsel itu yang paling mahal, dan
             bingkai yang jatuh terlihat sebagai getar. */
          gsap.set(inner, {
            rotation: 30, transformOrigin: 'bottom left',
            force3D: true, backfaceVisibility: 'hidden',
          });
          const tween = gsap.to(inner, {
            rotation: 0,
            ease: 'none',
            force3D: true,
            scrollTrigger: {
              scroller,
              trigger: section,
              start: 'top bottom',
              end: 'top 25%',
              /* ── KENAPA 0,4 DAN BUKAN `true` ────────────────────────────
                 `scrub: true` memetakan sudut LANGSUNG ke posisi gulir.
                 Di desktop mulus karena guliran datang halus, tapi di
                 ponsel guliran sampai sebagai lompatan besar yang jarang —
                 dan tiap lompatan jadi patahan rotasi yang terlihat
                 sebagai getar pada gambar yang sedang naik.

                 Angka (detik) menyuruh GSAP MENGEJAR posisi itu, bukan
                 menempel padanya: lompatan gulir diserap jadi gerak
                 pendek yang halus. 0,4 cukup untuk meredam tanpa membuat
                 panelnya terasa terlambat mengikuti jari. */
              scrub: 0.4,
            },
          });
          if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
        }

        if (i < sections.length - 1) {
          triggers.push(
            ScrollTrigger.create({
              scroller,
              trigger: section,
              start: 'bottom bottom',
              end: 'bottom top',
              pin: true,
              pinSpacing: false,
            }),
          );
        }
      });

      ScrollTrigger.refresh();

      return () => {
        triggers.forEach((t) => t.kill());
      };
    },
    { scope: containerRef, dependencies: [childCount(children), reducedMotion] },
  );

  return (
    <main
      ref={containerRef}
      aria-label={ariaLabel}
      /* ── data-lenis-prevent WAJIB ADA ────────────────────────────────
         Halaman depan menjalankan Lenis (dibawa komponen parallax), dan
         Lenis menangkap `wheel` di seluruh dokumen lalu menerjemahkannya
         jadi gulir HALAMAN. Kotak ini menggulir dirinya sendiri, jadi
         tanpa atribut ini rodanya dirampas: terukur di situs tayang —
         roda di atas kotak membuat scrollTop kotak tetap 0 sementara
         scrollY halaman lompat 300 px. Panelnya terkunci di seksi 01 dan
         empat seksi sisanya tidak pernah bisa dicapai.

         Atribut ini memberitahu Lenis untuk melepas kejadian yang berasal
         dari dalam sini dan membiarkan gulir asli bekerja. Namanya dicek
         langsung di paket terpasang (lenis 1.0.42), bukan dihafal. */
      data-lenis-prevent
      className={cx('gulir-senyap h-full w-full overflow-y-auto overflow-x-hidden', className)}
    >
      {children}
    </main>
  );
};

export default FlowArt;
