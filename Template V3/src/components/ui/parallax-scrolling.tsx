// src/components/ui/component.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import './parallax-scrolling.css';
import { LogoJT } from '@/components/logo-jt';

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
        {/* GAMBARNYA MILIK KITA SENDIRI, bukan lagi pinjaman CDN Osmo.
            Dua alasan, dan yang kedua yang memaksa: server orang lain bisa
            memindahkan berkasnya kapan saja dan hero ini ikut kosong — dan
            begitu gambarnya disunting sendiri, versi suntingan itu memang
            tidak ada di sana. */}
        <div className="parallax__visuals">
          <div className="parallax__black-line-overflow"></div>
          <div data-parallax-layers className="parallax__layers">
            <img src="/parallax/langit.webp" loading="eager" width="800" data-parallax-layer="1" alt="" className="parallax__layer-img" />
            <img src="/parallax/gunung-lilin.webp" loading="eager" width="800" data-parallax-layer="2" alt="" className="parallax__layer-img" />
            {/* Gunung versi malam, gambar utuh — bukan tempelan lilin bertopeng.
                Percobaan pertama memang begitu, dan hasilnya terlihat ngeblur
                dibanding senja: piksel setengah-tembus di tepi lilin membawa
                warna gunung TERANG, lalu MENGGANTIKAN gunung gelap di bawahnya,
                jadi tiap lilin dapat cincin kabut.

                Gambar ini dibakukan dengan cara yang berbeda: cahaya lilin
                dipisahkan dulu dari gunungnya, gunungnya digelapkan, lalu
                cahaya itu DITAMBAHKAN kembali utuh. Menambah, bukan mengganti —
                dan karena di luar lilin yang ditambahkan nol, tidak ada tepi
                topeng yang bisa terlihat sama sekali.

                Lapisannya tetap "2" supaya GSAP menggerakkannya dengan yPercent
                yang sama seperti gunung di bawahnya; keduanya tidak pernah
                bergeser satu sama lain saat digulir.

                fetchPriority rendah, tapi tetap eager: pada bukaan pertama ia
                50 kB yang belum tentu dipakai, jadi ia tidak boleh berebut jalur
                dengan tiga gambar yang memang langsung tampil. Menunda muatnya
                sampai tombolnya ditekan lebih hemat lagi — tapi itu menukar
                penghematan sekali dengan kedipan setiap kali beralih, dan
                pertukaran itu tidak sepadan. */}
            <img src="/parallax/gunung-malam.webp" loading="eager" fetchPriority="low" width="800" data-parallax-layer="2" alt="" className="parallax__layer-img parallax__layer-malam" />
            <div data-parallax-layer="3" className="parallax__layer-title">
              <h2 className="parallax__title">Jadi Trader</h2>
            </div>
            <img src="/parallax/depan.webp" loading="eager" width="800" data-parallax-layer="4" alt="" className="parallax__layer-img" />
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
