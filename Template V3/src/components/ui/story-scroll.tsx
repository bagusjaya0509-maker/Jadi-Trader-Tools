import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

/* ── BILAH ALAMAT PONSEL JANGAN MEMICU HITUNG ULANG ─────────────────────
   Dilaporkan pemilik 8 Sep 2026: di ponsel, gambar yang baru dilewati
   "naik turun mirip bergetar", dan getarnya berlanjut sesudah jari
   diangkat.

   Sebabnya bukan animasinya. Peramban ponsel menyembunyikan lalu
   memunculkan bilah alamat sepanjang orang menggulir, dan tiap perubahan
   itu adalah `resize` di mata halaman. ScrollTrigger menghitung ulang
   seluruh titik start/end setiap kali resize datang, sasaran rotasinya
   bergeser, dan `scrub: 0,4` mengejar sasaran yang baru saja pindah. Yang
   terlihat: panel yang sudah lewat bergoyang naik-turun, dan goyangannya
   baru berhenti sesudah bilah alamatnya selesai bergerak — yaitu beberapa
   saat SESUDAH jari diangkat.

   `ignoreMobileResize` menyuruh ScrollTrigger mengabaikan resize yang cuma
   mengubah TINGGI viewport di perangkat sentuh. Perubahan lebar — yang
   berarti perangkatnya benar-benar diputar — tetap memicu hitung ulang,
   jadi tata letaknya tidak pernah tertinggal basi.

   Disetel di tingkat modul, sekali, bukan di dalam efek: ia setelan global
   ScrollTrigger, dan memanggilnya berulang tiap komponen dipasang cuma
   menulis nilai yang sama berkali-kali. */
ScrollTrigger.config({ ignoreMobileResize: true });

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
  /* DIBACA SAAT INISIALISASI, bukan disetel belakangan lewat useEffect.
     Dulu nilainya selalu mulai dari `false` lalu dikoreksi sesudah render
     pertama. Untuk orang yang mematikan animasi di sistemnya, itu berarti
     satu frame animasi tetap tergambar sebelum permintaannya dipatuhi —
     dan justru frame pertama itu yang paling terlihat.

     Fungsi pengawal dipakai (bukan nilai langsung) supaya matchMedia cuma
     dipanggil sekali, bukan tiap render. */
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  /* ── KEADAAN AWAL DIPASANG SEBELUM FRAME PERTAMA DIGAMBAR ────────────
     Ini yang memperbaiki kelebatan di halaman depan.

     Lima layar tur ini bertumpuk di kotak yang sama. Yang memisahkannya
     rotasi 30° pada layar ke-2 sampai ke-5 — dan rotasi itu dipasang di
     dalam useGSAP, yang seperti useEffect baru berjalan SESUDAH peramban
     menggambar. Jadi frame pertama menampilkan kelimanya bertumpuk tanpa
     rotasi sama sekali, dan yang terlihat adalah yang paling belakang di
     urutan DOM: layar 05 "Copy Signal". Sepersekian detik kemudian useGSAP
     jalan, keempat layar belakang terlipat, dan yang muncul jadi 01
     "Chart & Entry".

     Itulah "gambar berubah sepersekian detik" yang dilaporkan: bukan
     gambar yang gagal dimuat, melainkan gambar yang BENAR datang
     terlambat satu frame.

     useLayoutEffect berjalan sesudah React menempelkan DOM tapi SEBELUM
     peramban menggambar, jadi keadaan awalnya sudah benar di frame
     pertama. Isinya sengaja cuma penataan awal — pembuatan ScrollTrigger
     tetap di useGSAP, karena itu pekerjaan yang mengukur tata letak dan
     tidak boleh menahan gambar pertama.

     Rangkap dengan gsap.set di useGSAP? Ya, dan itu disengaja: menyetel
     nilai yang sama dua kali tidak berbiaya, sedangkan mencabutnya dari
     sana membuat perbaikan ini jadi satu-satunya yang menahan tata
     letaknya — dan kalau suatu hari baris ini terhapus, kerusakannya
     kembali tanpa ada yang menghubungkannya ke sini. */
  useLayoutEffect(() => {
    if (!containerRef.current || reducedMotion) return;
    const seksi = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>('[data-flow-section]'),
    );
    seksi.forEach((s, i) => {
      s.style.zIndex = String(i + 1);
      if (i === 0) return;
      const dalam = s.querySelector<HTMLElement>('.flow-art-container');
      if (dalam) dalam.style.transform = 'rotate(30deg)';
    });
  }, [reducedMotion]);

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

              /* ── PANEL YANG SUDAH SELESAI DIKUNCI ────────────────────
                 Diminta pemilik 8 Sep 2026: begitu orang mulai menarik
                 panel berikutnya, panel sebelumnya tidak boleh bergerak
                 lagi.

                 `scrub: 0.4` menyuruh GSAP MENGEJAR posisi gulir, bukan
                 menempel padanya — dan pengejaran itu tidak berhenti di
                 garis akhir: 0,4 detik sesudah panel ini selesai, sudutnya
                 masih menyusut sepersekian derajat menuju nol. Di layar
                 lebar itu tidak terlihat. Di ponsel, jari yang sudah
                 beralih menarik panel BERIKUTNYA sementara panel ini masih
                 merapikan diri terbaca persis seperti yang dilaporkan:
                 gambar sebelumnya ikut bergerak.

                 Melewati garis akhir, sudutnya dipatok ke nilai akhir
                 seketika. Yang hilang cuma ekor 0,4 detik yang memang
                 sedang menuju ke sana; yang didapat panel yang benar-benar
                 diam begitu giliran berikutnya dimulai.

                 onLeaveBack mengerjakan kebalikannya supaya menggulir
                 kembali ke atas tetap mengembalikannya ke sudut 30° tanpa
                 menyisakan sisa dari ekor yang sama. */
              onLeave: (self) => { self.animation?.progress(1); },
              onLeaveBack: (self) => { self.animation?.progress(0); },
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

  /* ══ BERGULIR SENDIRI ══════════════════════════════════════════════════
     Diminta pemilik 6 Sep 2026, dan ia memperbaiki cacat yang sudah terukur
     waktu turnya dipanjangkan jadi delapan layar: kotak ini MENAHAN roda
     tetikus (data-lenis-prevent) sampai isinya habis. Delapan seksi = 4.512
     px gulir di dalam kotak sebelum halaman mau bergerak sedikit pun —
     sekitar empat puluh putaran roda. Pengunjung yang cuma ingin membaca
     ke bawah merasa halamannya macet.

     Sekarang turnya berjalan sendiri, dan yang tidak tertarik tinggal
     menunggu beberapa detik sampai kotaknya habis lalu halaman lanjut.

     ── SEKALI JALAN, TIDAK BERPUTAR ─────────────────────────────────────
     Godaan besarnya membuatnya berulang. Dua sebab kenapa tidak:
     pertama, kembali ke seksi 01 berarti kotaknya menahan roda LAGI, jadi
     jebakannya kembali tiap satu putaran. Kedua, orang yang sedang membaca
     keterangan seksi 08 akan disentak balik ke awal tanpa pernah memintanya.
     Berhenti di seksi terakhir membuat kotaknya "habis" — dan kotak yang
     habis meneruskan gulirannya ke halaman seperti kotak biasa.

     ── BERHENTI PERMANEN BEGITU DISENTUH ────────────────────────────────
     Sekali orangnya menggulir, menyeret, atau menekan tombol panah, dia
     yang memegang kendali dan tidak dikembalikan. Carousel yang menyambung
     lagi sesudah diambil alih adalah carousel yang berebut dengan
     pembacanya — dan yang kalah selalu pembacanya, karena mesin tidak
     pernah lelah.

     ── BARU MULAI SAAT BENAR-BENAR TERLIHAT ─────────────────────────────
     Tanpa IntersectionObserver, turnya sudah habis sebelum orangnya sampai
     ke situ: halaman depan dibuka di atas, kotak ini beberapa layar di
     bawah. Yang tersisa cuma seksi terakhir, dan tujuh layar pertama tidak
     pernah dilihat siapa pun. */
  useEffect(() => {
    const kotak = containerRef.current;
    if (!kotak || reducedMotion) return;

    const seksi = Array.from(kotak.querySelectorAll<HTMLElement>('[data-flow-section]'));
    if (seksi.length < 2) return;

    let hidup = true;
    let diambilAlih = false;
    let jam = 0;
    let rafId = 0;

    const berhenti = () => {
      diambilAlih = true;
      window.clearTimeout(jam);
      cancelAnimationFrame(rafId);
    };
    /* `passive` — pendengar ini TIDAK pernah memanggil preventDefault, dan
       tanpa penanda itu peramban menahan guliran sepersekian detik menunggu
       kepastian. Di kotak yang justru urusannya menggulir, jeda itu terasa. */
    const opsi = { passive: true } as AddEventListenerOptions;
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((n) =>
      kotak.addEventListener(n, berhenti, opsi));

    /* Satu langkah = satu tinggi kotak, dianimasikan sendiri alih-alih
       `behavior:'smooth'`. Durasi bawaan peramban tidak bisa diatur dan
       berbeda-beda; ScrollTrigger di sini memakai scrub 0,4 yang perlu
       laju yang bisa ditebak supaya rotasinya tidak tersendat. */
    const luncur = (ke: number, lama: number) => {
      const dari = kotak.scrollTop;
      const jarak = ke - dari;
      const mulai = performance.now();
      const langkah = (kini: number) => {
        if (!hidup || diambilAlih) return;
        const t = Math.min(1, (kini - mulai) / lama);
        /* easeInOutCubic: berangkat dan mendarat pelan. Laju rata membuat
           tiap perpindahan terbaca sebagai sentakan mekanis. */
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        kotak.scrollTop = dari + jarak * e;
        if (t < 1) rafId = requestAnimationFrame(langkah);
        else jadwalkan();
      };
      rafId = requestAnimationFrame(langkah);
    };

    const JEDA_BACA = 3200;   // waktu berhenti di tiap layar
    const LAMA_GESER = 950;
    /* ── LANGKAH PERTAMA BERANGKAT CEPAT ───────────────────────────────
       Dilaporkan pemilik dari layar HP: sampai ke bagian gambar, lalu diam.
       Yang ia tunggu bukan gulirannya melainkan jeda baca 3,2 detik SEBELUM
       langkah pertama — dan selama detik-detik itu tidak ada satu pun tanda
       bahwa kotaknya akan bergerak sendiri.

       Jeda baca masuk akal untuk layar KEDUA dan seterusnya: waktu itu
       orangnya memang sedang membaca keterangan yang barusan masuk. Untuk
       layar pertama ia belum membaca apa pun — ia baru saja sampai. Dan
       gerakan yang muncul segera adalah satu-satunya cara kotak ini memberi
       tahu bahwa ia berjalan sendiri; yang diam tiga detik terbaca sebagai
       gambar mati, lalu digulir lewat. */
    const JEDA_PERTAMA = 700;
    /* Layar terakhir ditahan lebih lama sebelum diputar ulang. Ia penutup —
       dan penutup yang langsung dirobek terbaca sebagai kesalahan, bukan
       sebagai awal putaran berikutnya. */
    const JEDA_PENUTUP = 4200;
    const LAMA_PUTAR_ULANG = 1500;
    let langkahPertama = true;

    /* Deklarasi fungsi, bukan const — `luncur` di atas memanggilnya dan ia
       memanggil `luncur`, jadi salah satunya harus terangkat. Akibatnya
       TypeScript kehilangan penyempitan `kotak` di sini (badan fungsi
       terangkat dianggap bisa jalan sebelum penjaganya), jadi elemennya
       dibaca ulang di dalam — sekaligus benar secara perilaku: kalau
       komponennya sudah dilepas, `current` memang sudah null. */
    function jadwalkan() {
      const k = containerRef.current;
      if (!hidup || diambilAlih || !k) return;
      const maks = k.scrollHeight - k.clientHeight;

      /* ── SAMPAI DI LAYAR TERAKHIR: PUTAR ULANG KE LAYAR 1 ────────────
         Diminta pemilik. Saya sempat sengaja TIDAK memutarnya, dan
         keberatannya tetap berlaku jadi ditulis di sini alih-alih hilang:
         kotak ini menahan roda tetikus sampai isinya habis, jadi kembali ke
         layar 1 berarti delapan layar guliran itu menghadang lagi. Orang
         yang menonton satu putaran penuh lalu ingin lanjut ke bawah harus
         melewatinya sekali lagi.

         Yang meredam: satu sentuhan apa pun menghentikan putaran ini
         PERMANEN (lihat `berhenti` di atas). Jadi jebakannya cuma ada
         selama orangnya memang sedang menonton — dan begitu ia mencoba
         menggulir, kendalinya kembali padanya dan tidak diambil lagi.

         Diputar dengan animasi 1,5 detik, bukan lompat ke nol. Lompatan
         seketika membuat delapan panel bertumpuk berpindah dalam satu
         frame, dan ScrollTrigger yang memakai scrub 0,4 akan mengejarnya
         dengan rotasi yang tersendat. Yang meluncur terbaca sebagai
         "mengulang dari awal". */
      if (k.scrollTop >= maks - 2) {
        jam = window.setTimeout(() => {
          if (!hidup || diambilAlih) return;
          luncur(0, LAMA_PUTAR_ULANG);
        }, JEDA_PENUTUP);
        return;
      }

      const jeda = langkahPertama ? JEDA_PERTAMA : JEDA_BACA;
      langkahPertama = false;
      jam = window.setTimeout(() => {
        if (!hidup || diambilAlih) return;
        luncur(Math.min(maks, k.scrollTop + k.clientHeight), LAMA_GESER);
      }, jeda);
    }

    /* Ambang 0,35, bukan 0,5. Di HP kotak ini tinggi separuh layar atau
       kurang, dan menunggunya setengah terlihat berarti menunggu orangnya
       menggulir lebih jauh dulu — padahal gambarnya sudah kelihatan sejak
       sepertiga masuk. Di layar lebar bedanya tidak terasa. */
    const pengamat = new IntersectionObserver((entri) => {
      for (const e of entri) {
        if (e.isIntersecting && !diambilAlih) { pengamat.disconnect(); jadwalkan(); }
      }
    }, { threshold: 0.35 });
    pengamat.observe(kotak);

    return () => {
      hidup = false;
      pengamat.disconnect();
      window.clearTimeout(jam);
      cancelAnimationFrame(rafId);
      ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((n) =>
        kotak.removeEventListener(n, berhenti, opsi));
    };
  }, [reducedMotion, childCount(children)]);

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
