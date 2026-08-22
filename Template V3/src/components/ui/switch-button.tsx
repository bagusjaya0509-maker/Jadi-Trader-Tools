import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   SAKELAR GESER BERIKON
   ════════════════════════════════════════════════════════════════════════
   Ditempel dari komponen yang dikirim pemilik, dengan satu perubahan:
   impornya dari 'framer-motion', BUKAN 'motion/react'.

   Alasannya bukan selera. 'motion' itu nama baru untuk pustaka yang sama,
   dan proyek ini sudah memakai framer-motion v13. Memasang keduanya
   berarti dua salinan pustaka animasi yang sama ikut ke bundel — bukan
   dua fitur, dua kali berat yang sama. API yang dipakai di sini (motion.div,
   layout, transition spring) identik di kedua nama.

   Kelas warnanya dibiarkan apa adanya — bg-card-foreground/15 dan
   bg-background. Diperiksa dulu: kedua token itu memang ada di index.css
   untuk tema gelap MAUPUN terang, jadi sakelarnya ikut berganti warna
   sendiri saat temanya berpindah, tanpa satu baris tambahan.
   ════════════════════════════════════════════════════════════════════════ */

type SwitchProps = {
  value: boolean;
  onToggle: () => void;
  iconOn: ReactNode;
  iconOff: ReactNode;
  className?: string;
  /** Diteruskan ke tombolnya. Sakelar tanpa nama tidak terbaca pembaca
   *  layar sebagai apa pun selain "tombol" — dan sakelar tema yang tidak
   *  bisa dikenali orang yang memakai pembaca layar sama saja tidak ada. */
  title?: string;
  ariaLabel?: string;
  /** Ukuran kecil: setinggi satu baris teks, bukan setinggi tombol.
   *
   *  Diperlukan sejak sakelarnya duduk di sebelah merek di sidebar. Diukur
   *  di sana: teksnya 14 px dengan tinggi baris 21 px dan logonya 19 px,
   *  sementara sakelar bawaannya 28 px — ia jadi benda paling tinggi di
   *  baris itu, dan mata membaca yang paling tinggi sebagai yang paling
   *  penting. Yang paling penting di baris itu mereknya. */
  kecil?: boolean;
};

export function Switch({
  value,
  onToggle,
  iconOn,
  iconOff,
  className = '',
  title,
  ariaLabel,
  kecil = false,
}: SwitchProps) {
  /* Kelas ditulis PENUH per ukuran, bukan disambung dari potongan. Kelas
     Tailwind yang bertabrakan (w-12 dan w-9 sekaligus) tidak diselesaikan
     urutan penulisannya melainkan urutan di lembar gayanya — jadi yang
     menang tidak bisa diramalkan dari kode ini. */
  const lebar = kecil ? 'w-9' : 'w-12';
  const tuas = kecil ? 'size-4' : 'size-6';
  const isi = kecil ? 'size-3' : 'size-5';

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel ?? title}
      /* role switch + aria-checked, bukan tombol biasa: keadaan menyala
         atau mati di sini adalah isi informasinya, dan tanpa ini pembaca
         layar cuma membacakan namanya tanpa menyebut ia sedang di posisi
         mana. */
      role="switch"
      aria-checked={value}
      className={`bg-card-foreground/15 flex ${lebar} cursor-pointer rounded-full p-0.5 ${
        value ? 'justify-end' : 'justify-start'
      } ${className}`}
      onClick={onToggle}
    >
      <motion.div
        className={`flex justify-center items-center ${tuas} rounded-full bg-background`}
        layout
        transition={{
          type: 'spring',
          duration: 0.6,
          bounce: 0.2,
        }}
      >
        {value ? (
          <motion.div
            key="on"
            initial={{ opacity: 0, rotate: -60 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 60 }}
            transition={{ duration: 0.3 }}
            className={`flex justify-center items-center ${isi}`}
          >
            {iconOn}
          </motion.div>
        ) : (
          <motion.div
            key="off"
            initial={{ opacity: 0, rotate: 60 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: -60 }}
            transition={{ duration: 0.3 }}
            className={`flex justify-center items-center ${isi}`}
          >
            {iconOff}
          </motion.div>
        )}
      </motion.div>
    </button>
  );
}
