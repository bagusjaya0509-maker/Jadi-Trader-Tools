// src/components/ui/component.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import './parallax-scrolling.css';
import { LogoJT } from '@/components/logo-jt';

/* ── LILIN DI PUNGGUNG GUNUNG ────────────────────────────────────────────
   Deret TETAP, bukan acak. Dekorasi yang berubah tiap kali halaman dimuat
   terbaca seperti data sungguhan yang sedang salah — dan bentuknya tidak
   bisa ditinjau desainnya kalau tiap kali dilihat ia berbeda.

   Bentuk deretnya sengaja meniru punggungan di belakangnya: naik panjang
   ke puncak sekitar tengah, lalu surut. Ia BUKAN data harga dan tidak
   berpura-pura begitu; ini bagian dari gambar, bukan grafik.
   ──────────────────────────────────────────────────────────────────────── */
/* Deret naik panjang lalu surut, meniru punggungan di belakangnya.
   Lima puluh enam langkah, bukan dua puluh delapan: pada lebar layar penuh
   jumlah yang sedikit membuat jarak antar lilin menganga dan ia terbaca
   sebagai titik-titik, bukan sebagai pasar. */
const LANGKAH = [
  2, 3, -1, 2, 4, -2, 3, 2, -1, 4, 2, -2, 5, 3,
  -1, 2, 4, -3, 3, 5, -2, 2, 4, -1, 3, 2, -3, 4,
  -2, 3, -4, 1, -3, -5, 2, -4, -2, -5, 1, -3, -4, -2,
  -5, 1, -4, -3, -5, 2, -4, -6, 1, -3, -5, -2, -4, -3,
];

const LILIN = (() => {
  /* Batas 6..54 dalam satuan viewBox setinggi 62 — menyisakan ruang untuk
     sumbu di kedua ujung tanpa terpotong. */
  let tinggi = 18;
  return LANGKAH.map((d, i) => {
    const buka = tinggi;
    tinggi = Math.max(6, Math.min(54, tinggi + d));
    const tutup = tinggi;
    /* Sumbu sebanding besar batangnya — lilin bersumbu sama panjang untuk
       badan besar dan kecil terbaca sebagai pola cetakan, bukan pasar. */
    const sumbu = Math.abs(d) * 0.6 + 1.2;
    return {
      i,
      atasBadan: Math.max(buka, tutup),
      tinggiBadan: Math.max(1.1, Math.abs(tutup - buka)),
      sumbuAtas: Math.max(buka, tutup) + sumbu,
      sumbuBawah: Math.min(buka, tutup) - sumbu,
      naik: tutup >= buka,
    };
  });
})();

export function ParallaxComponent() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  /* Senja = keadaan bawaan, dan itu keputusan pemiliknya: fotonya memang
     foto senja, dan versi "terang" yang dipucatkan dari foto malam selalu
     terlihat murah. Malam dibuat dari foto yang sama lewat filter. */
  const [suasana, setSuasana] = useState<'senja' | 'malam'>('senja');

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const triggerElement = parallaxRef.current?.querySelector('[data-parallax-layers]');

    let tl: gsap.core.Timeline | null = null;

    if (triggerElement) {
      /* Dipegang di variabel lokal supaya TypeScript tahu ia pasti ada di
         dalam blok ini; `tl` di luar sana boleh null karena pembersihan
         di bawah harus tetap aman kalau pemicunya tidak pernah ketemu. */
      const garis = gsap.timeline({
        scrollTrigger: {
          trigger: triggerElement,
          start: "0% 0%",
          end: "100% 0%",
          scrub: 0
        }
      });

      tl = garis;

      const layers = [
        { layer: "1", yPercent: 70 },
        { layer: "2", yPercent: 55 },
        { layer: "3", yPercent: 40 },
        { layer: "4", yPercent: 10 }
      ];

      layers.forEach((layerObj, idx) => {
        garis.to(
          triggerElement.querySelectorAll(`[data-parallax-layer="${layerObj.layer}"]`),
          {
            yPercent: layerObj.yPercent,
            ease: "none"
          },
          idx === 0 ? undefined : "<"
        );
      });
    }

    const lenis = new Lenis();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    return () => {
      /* HANYA milik komponen ini yang dibersihkan.
         ──────────────────────────────────────────────────────────────
         Versi aslinya memanggil ScrollTrigger.getAll().forEach(kill) —
         itu membunuh SEMUA ScrollTrigger di halaman, termasuk milik
         komponen lain yang tidak ada urusannya. Halaman ini punya
         animasi gulir sendiri (gambar tur yang di-scrub); begitu
         komponen ini dilepas, animasi itu ikut mati dan tidak ada
         galat apa pun yang menjelaskan kenapa.

         Timeline-nya membawa scrollTrigger-nya sendiri, jadi
         mematikan timeline sudah cukup. */
      tl?.scrollTrigger?.kill();
      tl?.kill();
      if (triggerElement) gsap.killTweensOf(triggerElement);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="parallax" data-suasana={suasana} ref={parallaxRef}>
      <section className="parallax__header">
        <div className="parallax__visuals">
          <div className="parallax__black-line-overflow"></div>
          <div data-parallax-layers className="parallax__layers">
            <img src="https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795be09b462b2e8ebf71_osmo-parallax-layer-3.webp" loading="eager" width="800" data-parallax-layer="1" alt="" className="parallax__layer-img" />
            <img src="https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795b4d5ac529e7d3a562_osmo-parallax-layer-2.webp" loading="eager" width="800" data-parallax-layer="2" alt="" className="parallax__layer-img" />
            <div data-parallax-layer="3" className="parallax__layer-title">
              <h2 className="parallax__title">Jadi Trader</h2>
            </div>
            {/* Lilin duduk DI ANTARA gunung dan latar depan, dan ikut
                lapisan 2 supaya ia bergerak bersama punggungan — bukan
                mengambang sendiri di depan seluruh gambar. */}
            <div data-parallax-layer="2" className="parallax__candles" aria-hidden="true">
              {/* preserveAspectRatio="none" meregangkan gambar mendatar jauh
                  lebih besar daripada tegak (sekitar 5x lawan 1,4x di layar
                  lebar). Karena itu lebar badan ditulis KECIL dalam satuan
                  viewBox — 2,4 satuan menjadi sekitar 12 px di layar. Ditulis
                  dengan angka yang terlihat wajar di viewBox, hasilnya batang
                  gepeng selebar tiga kali tingginya. */}
              <svg viewBox="0 0 280 62" preserveAspectRatio="none" className="parallax__candles-svg">
                {LILIN.map((c) => {
                  const x = c.i * 5 + 2.5;
                  const y = (v: number) => 62 - v;
                  return (
                    <g key={c.i} className={c.naik ? 'naik' : 'turun'}>
                      <line x1={x} x2={x} y1={y(c.sumbuAtas)} y2={y(c.sumbuBawah)}
                            vectorEffect="non-scaling-stroke" />
                      <rect x={x - 1.2} width="2.4" y={y(c.atasBadan)} height={c.tinggiBadan} />
                    </g>
                  );
                })}
              </svg>
            </div>
            <img src="https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795bb5aceca85011ad83_osmo-parallax-layer-1.webp" loading="eager" width="800" data-parallax-layer="4" alt="" className="parallax__layer-img" />
          </div>
          <div className="parallax__fade"></div>
          {/* Pemindah suasana. Kecil dan di pojok: ia mainan, bukan kendali
              utama halaman — dan halaman depan tidak boleh menyuruh orang
              memilih apa pun sebelum ia tahu produknya apa. */}
          <button type="button" className="parallax__suasana"
                  onClick={() => setSuasana((v) => (v === 'senja' ? 'malam' : 'senja'))}
                  aria-label={suasana === 'senja' ? 'Ubah ke suasana malam' : 'Ubah ke suasana senja'}>
            {suasana === 'senja' ? 'Malam' : 'Senja'}
          </button>
        </div>
      </section>
      <section className="parallax__content">
        {/* Lambang situs sendiri, bukan lambang Osmo. `currentColor`
            membuatnya ikut warna teks section ini — tidak perlu berkas
            terpisah untuk latar terang maupun gelap. */}
        <LogoJT className="osmo-icon-svg" />
      </section>
    </div>
  );
}
