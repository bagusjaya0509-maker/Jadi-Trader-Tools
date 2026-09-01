import { useEffect, useState } from 'react';
import {
  LazyMotion, domAnimation, m, AnimatePresence, type Transition,
} from 'framer-motion';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════════════════════════════════
   SATU KATA TETAP, SISANYA BERGANTI
   ══════════════════════════════════════════════════════════════════════
   Kata yang tetap ditulis penuh di kiri; kata di kanannya melebar dari nol,
   diam sebentar, lalu menyempit lagi sambil kata berikutnya melebar. Sebuah
   garis tegak berkedip di ujungnya seperti kursor yang sedang mengetik.

   Diadaptasi dari komponen yang dikirim pemilik. Yang diubah, dan
   alasannya:

     · `"use client"` dibuang — arahan Next.js, tidak berarti apa-apa di
       Vite.

     · Impornya dari `framer-motion`, BUKAN `motion/react`. Kedua nama itu
       pustaka yang sama (`motion` nama barunya), dan proyek ini sudah
       memasang framer-motion 13.1.1 yang mengekspor LazyMotion,
       domAnimation, m, dan AnimatePresence — sudah diperiksa satu per
       satu. Memasang `motion` juga berarti dua pustaka animasi hidup
       berdampingan di satu bundel: puluhan kilobita untuk kode yang sudah
       ada, dan dua sumber kebenaran untuk hal yang sama.

     · Ungu jadi BIRU, permintaan pemilik. Warnanya dinaikkan terangnya
       (300–600, bukan 400–800) karena tempat pertamanya dipakai adalah
       judul di atas FOTO gunung, bukan latar putih. Biru-800 di atas foto
       senja praktis tidak terbaca.

     · `text-4xl md:text-7xl` DIPERTAHANKAN sebagai bawaan, tapi ia memang
       dimaksudkan untuk ditimpa: `cn` di proyek ini memakai tailwind-merge,
       jadi pemanggil yang mengirim ukurannya sendiri akan menang. Di hero,
       ukurannya datang dari `.parallax__title`.
   ══════════════════════════════════════════════════════════════════════ */

interface TextLoopProps {
  staticText?: string;
  rotatingTexts?: string[];
  className?: string;
  interval?: number;
  transition?: Transition;
  staticTextClassName?: string;
  rotatingTextClassName?: string;
  backgroundClassName?: string;
  cursorClassName?: string;
}

export default function TextLoop({
  staticText = 'Jadi Trader',
  rotatingTexts = ['Profitable', 'Charting', 'Screening'],
  className,
  interval = 3000,
  transition = { duration: 0.8, ease: 'easeInOut' },
  staticTextClassName,
  rotatingTextClassName,
  backgroundClassName,
  cursorClassName,
}: TextLoopProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % rotatingTexts.length);
    }, interval);
    return () => clearInterval(timer);
  }, [rotatingTexts.length, interval]);

  return (
    <LazyMotion features={domAnimation}>
      <div
        className={cn(
          'flex flex-row items-center justify-start w-fit text-4xl md:text-7xl font-medium tracking-tight',
          className,
        )}
      >
        <span className={cn('mr-3 whitespace-nowrap', staticTextClassName)}>
          {staticText}
        </span>
        <div className="relative flex items-center">
          {/* ── `initial={false}` BUKAN PENGHEMATAN, TAPI PENGAMAN ────────
              Tanpa ini kata pertama masuk lewat animasi width 0 → auto,
              dan animasi itu digerakkan requestAnimationFrame. Selama rAF
              belum berdetak — tab dibuka di latar belakang, pengguna pindah
              tab saat halaman memuat, peramban menahan frame untuk halaman
              yang tidak terlihat — elemennya diam di keadaan awalnya:
              `width: 0px; opacity: 0`.

              Artinya judulnya terbaca "Jadi Trader" dengan kursor berkedip
              dan TIDAK ADA APA-APA di sebelahnya. Sudah terlihat sendiri
              waktu diperiksa: 0 frame rAF per detik, elemennya bertahan di
              opacity 0 selama sebelas detik walau timernya terus berdetak.

              `initial={false}` membuat anak yang sudah ada saat pertama
              dipasang langsung berada di keadaan akhirnya. Pergantian kata
              berikutnya tetap beranimasi seperti biasa — dan kalau rAF
              membeku di tengah jalan, yang tertinggal di layar kata LAMA
              yang masih terlihat, bukan ruang kosong. Kedua kegagalannya
              jatuh ke sisi yang benar. */}
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={rotatingTexts[index]}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={transition}
              className="overflow-hidden whitespace-nowrap relative"
            >
              {/* Kotak gradien di belakang katanya. */}
              <div
                className={cn(
                  'absolute inset-0',
                  'bg-gradient-to-r from-transparent via-blue-300/20 to-blue-400/30',
                  'dark:from-transparent dark:via-blue-950/30 dark:to-blue-900/50',
                  backgroundClassName,
                )}
              />

              <span
                className={cn(
                  'relative bg-clip-text text-transparent',
                  'bg-gradient-to-r from-sky-300 to-blue-600',
                  'dark:from-sky-300 dark:to-blue-500 pr-1',
                  rotatingTextClassName,
                )}
              >
                {rotatingTexts[index]}
              </span>
            </m.div>
          </AnimatePresence>

          {/* Garis kursor. */}
          <m.div
            className={cn(
              'w-[3px] md:w-[4px] bg-blue-400 h-[1.10em] sm:h-[1em]',
              cursorClassName,
            )}
            animate={{ opacity: [1, 0.5] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />
        </div>
      </div>
    </LazyMotion>
  );
}
