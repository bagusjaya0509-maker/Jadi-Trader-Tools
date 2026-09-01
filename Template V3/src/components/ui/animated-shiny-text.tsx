import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════════════════════════════════
   TEKS BERKILAU
   ══════════════════════════════════════════════════════════════════════
   Gradien selebar dua kali kotaknya digeser bolak-balik di belakang huruf,
   lalu dipotong mengikuti bentuk hurufnya (`background-clip: text`). Yang
   terlihat: seberkas cahaya menyapu tulisan.

   Diadaptasi dari komponen yang dikirim pemilik. Empat hal yang diubah,
   dan alasannya:

     · **`as`** ditambahkan. Aslinya `motion.h1` mati. Halaman depan sudah
       punya satu <h1> di Template.tsx, dan dua <h1> di satu halaman bikin
       urutan judulnya kacau untuk pembaca layar maupun mesin pencari.
       Bawaannya tetap "h1" supaya pemakaian lain tidak berubah.

     · **Ukuran fontnya cuma dipasang kalau `textClassName` kosong.**
       Aslinya lima kelas ukuran (base sampai xl) selalu ikut, dan itu
       membuatnya mustahil dipakai di ukuran lain: tailwind-merge cuma
       mendamaikan kelas dalam varian yang sama, jadi pemanggil yang
       mengirim satu ukuran tetap kalah oleh `md:` dan `xl:` bawaannya.
       Sekarang pemanggil yang membawa kelasnya sendiri memegang penuh.

     · **`useReducedMotion`.** Ini animasi tanpa henti di judul terbesar
       halaman. Orang yang menyetel sistemnya untuk mengurangi gerakan
       sering melakukannya karena gerakan bikin pusing atau mual, dan yang
       paling mengganggu justru yang berulang selamanya di sudut mata.
       Gradiennya tetap terpasang — cuma berhenti bergerak.

     · Impor dari `framer-motion` seperti aslinya. Sudah terpasang di
       proyek ini (13.1.1); tidak ada paket baru.

   ── HATI-HATI DENGAN WARNANYA ────────────────────────────────────────
   Bawaannya berujung `#000`. Itu benar di atas latar polos — ujung
   sapuannya membaur ke gelap. Di atas FOTO ia bukan membaur melainkan
   menghilang: hurufnya jadi lubang yang menampilkan fotonya sendiri, dan
   yang terbaca bukan "memudar" tapi "rusak". Untuk latar bergambar,
   kirim gradien yang kedua ujungnya tetap terang.
   ══════════════════════════════════════════════════════════════════════ */

interface AnimatedTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  gradientColors?: string;
  gradientAnimationDuration?: number;
  hoverEffect?: boolean;
  className?: string;
  textClassName?: string;
  /** Tingkat judulnya. Bawaan "h1"; pakai "h2" kalau halamannya sudah punya. */
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

const AnimatedText = React.forwardRef<HTMLDivElement, AnimatedTextProps>(
  (
    {
      text,
      gradientColors = 'linear-gradient(90deg, #000, #fff, #000)',
      gradientAnimationDuration = 1,
      hoverEffect = false,
      className,
      textClassName,
      as = 'h1',
      ...props
    },
    ref,
  ) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const kurangiGerak = useReducedMotion();
    const Tag = motion[as];

    const textVariants: Variants = {
      initial: {
        backgroundPosition: '0 0',
      },
      animate: {
        backgroundPosition: '100% 0',
        transition: {
          duration: gradientAnimationDuration,
          repeat: Infinity,
          repeatType: 'reverse' as const,
        },
      },
    };

    return (
      <div
        ref={ref}
        className={cn('flex justify-center items-center py-8', className)}
        {...props}
      >
        <Tag
          className={cn(
            !textClassName &&
              'text-[2.5rem] sm:text-[3.5rem] md:text-[4rem] lg:text-[5rem] xl:text-[6rem] leading-normal',
            textClassName,
          )}
          style={{
            background: gradientColors,
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: isHovered ? '0 0 8px rgba(255,255,255,0.3)' : 'none',
          }}
          variants={textVariants}
          initial="initial"
          animate={kurangiGerak ? 'initial' : 'animate'}
          onHoverStart={() => hoverEffect && setIsHovered(true)}
          onHoverEnd={() => hoverEffect && setIsHovered(false)}
        >
          {text}
        </Tag>
      </div>
    );
  },
);

AnimatedText.displayName = 'AnimatedText';

export { AnimatedText };
