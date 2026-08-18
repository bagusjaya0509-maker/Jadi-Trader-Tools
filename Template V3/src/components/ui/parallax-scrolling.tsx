// src/components/ui/component.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import { Moon, Sun } from 'lucide-react';
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

    /* Fungsinya dipegang di variabel supaya bisa DILEPAS lagi di bawah.
       Versi aslinya menuliskannya sebagai fungsi anonim langsung di dalam
       gsap.ticker.add, dan fungsi anonim tidak punya pegangan — ia tidak
       akan pernah bisa dicabut. Tiap kali komponen ini dipasang ulang,
       satu callback baru menumpuk, dan yang lama tetap memanggil raf()
       pada Lenis yang sudah dihancurkan. */
    const detak = (time: number) => { lenis.raf(time * 1000); };
    gsap.ticker.add(detak);
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

      /* Urutannya penting: cabut detaknya DULU, baru hancurkan Lenis.
         Terbalik, masih ada peluang satu frame memanggil raf() pada
         instance yang sudah mati. */
      gsap.ticker.remove(detak);
      gsap.ticker.lagSmoothing(500, 33);   // kembalikan bawaan GSAP
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
            {/* Malam adalah gambar tersendiri yang dilukis pemiliknya, bukan
                foto senja yang digelapkan. Bulan purnama, langit berbintang,
                salju kena cahaya bulan — hal-hal yang tidak akan pernah keluar
                dari sebuah filter, sekeras apa pun fotonya digelapkan.

                Lapisannya tetap "2" supaya GSAP menggerakkannya dengan yPercent
                yang sama seperti gunung di bawahnya; keduanya tidak pernah
                bergeser satu sama lain saat digulir.

                fetchPriority rendah, tapi tetap eager: pada bukaan pertama ia
                64 kB yang belum tentu dipakai, jadi ia tidak boleh berebut
                jalur dengan tiga gambar yang memang langsung tampil. Menunda
                muatnya sampai tombolnya ditekan lebih hemat lagi — tapi itu
                menukar penghematan sekali dengan kedipan setiap kali beralih,
                dan pertukaran itu tidak sepadan. */}
            <img src="/parallax/gunung-malam.webp" loading="eager" fetchPriority="low" width="800" data-parallax-layer="2" alt="" className="parallax__layer-img parallax__layer-malam" />
            <div data-parallax-layer="3" className="parallax__layer-title">
              <h2 className="parallax__title">Jadi Trader</h2>
            </div>
            <img src="/parallax/depan.webp" loading="eager" width="800" data-parallax-layer="4" alt="" className="parallax__layer-img" />
          </div>
          <div className="parallax__fade"></div>
          {/* Pemindah suasana. Kecil dan di pojok: ia mainan, bukan kendali
              utama halaman — dan halaman depan tidak boleh menyuruh orang
              memilih apa pun sebelum ia tahu produknya apa.

              Ikonnya menunjukkan TUJUAN, bukan keadaan sekarang: sedang senja
              maka yang tampil bulan, karena itulah yang akan terjadi kalau
              ditekan. Tombol yang menampilkan keadaan sekarang selalu ambigu —
              orang tidak tahu apakah ia lampu penanda atau sakelar.

              Tanpa teks ia jadi ikon telanjang, jadi aria-label-nya wajib dan
              title-nya dipasang supaya yang memakai tetikus juga dapat
              keterangan yang sama. */}
          <button type="button" className="parallax__suasana"
                  onClick={() => setSuasana((v) => (v === 'senja' ? 'malam' : 'senja'))}
                  title={suasana === 'senja' ? 'Ubah ke suasana malam' : 'Ubah ke suasana senja'}
                  aria-label={suasana === 'senja' ? 'Ubah ke suasana malam' : 'Ubah ke suasana senja'}>
            {suasana === 'senja'
              ? <Moon size={17} strokeWidth={1.75} aria-hidden="true" />
              : <Sun size={17} strokeWidth={1.75} aria-hidden="true" />}
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
