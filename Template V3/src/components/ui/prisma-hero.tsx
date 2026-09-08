import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   PRISMA — huruf yang naik kata demi kata
   ════════════════════════════════════════════════════════════════════════
   Dari templat yang dikirim pemilik 8 Sep 2026, dipakai sebagai tampilan
   KETIGA panel kiri halaman gerbang, di samping Foto dan Lonceng.

   ── YANG DIAMBIL DAN YANG TIDAK ─────────────────────────────────────────
   Yang diambil: gerakan hurufnya (tiap kata naik dengan jeda berurutan),
   tumpukan lapisannya (latar, bintik, tirai gelap), dan tata letaknya —
   satu kata besar di bawah, keterangan kecil di sebelahnya.

   Yang TIDAK diambil: bilah menu contohnya ("Our story", "Collective", …)
   karena halaman gerbang tidak punya menu, dan VIDEO LATARNYA. Videonya
   ditaruh di CloudFront milik orang lain; menautkannya dari halaman masuk
   berarti tampilan gerbang kita bergantung pada berkas yang tidak bisa
   kita jaga — hari ia dihapus, yang tersisa kotak hitam di halaman yang
   paling tidak boleh terlihat rusak. Latarnya memakai gambar merek sendiri
   yang sudah ada di public/.

   `WordsPullUp` diekspor terpisah karena gerakannya berguna di luar tema
   ini juga, dan komponen yang cuma bisa dipakai satu tempat tidak perlu
   jadi berkas sendiri.
   ════════════════════════════════════════════════════════════════════════ */

interface WordsPullUpProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  /** Jeda antar kata, detik. Makin panjang kalimatnya makin kecil angkanya
   *  — delapan kata dengan jeda 0,08 s berarti kata terakhir baru muncul
   *  0,64 detik sesudah yang pertama, dan sesudah itu ia terbaca lamban. */
  jeda?: number;
  /** Menunda seluruh rangkaian; dipakai supaya baris kedua mulai sesudah
   *  baris pertama selesai, bukan berbarengan. */
  mulai?: number;
}

export const WordsPullUp = ({ text, className = '', style, jeda = 0.08, mulai = 0 }: WordsPullUpProps) => {
  const ref = useRef<HTMLDivElement>(null);
  /* once: true — animasinya dimainkan SEKALI. Panel gerbang tidak digulir,
     tapi tanpa ini ia ikut main lagi tiap kali komponennya digambar ulang,
     dan huruf yang melompat tiap kali kuota disegarkan terbaca seperti
     kedipan, bukan sambutan. */
  const isInView = useInView(ref, { once: true });
  const words = text.split(' ');

  return (
    <div ref={ref} className={`inline-flex flex-wrap ${className}`} style={style}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: mulai + i * jeda, ease: [0.16, 1, 0.3, 1] }}
          className="relative inline-block"
          style={{ marginRight: i === words.length - 1 ? 0 : '0.25em' }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
};

/* Bintik halus sebagai data-URI, bukan berkas gambar: satu permintaan
   jaringan lagi di halaman masuk untuk tekstur setipis ini tidak sepadan,
   dan berkas yang gagal dimuat meninggalkan bidang yang terlalu bersih
   dibanding rancangannya. */
const BINTIK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/** Panel kiri halaman gerbang — tampilan "Prisma".
 *
 *  Membawa keterangan mereknya sendiri, jadi pemanggilnya menyembunyikan
 *  keterangan bersama saat tema ini menyala. Dua baris nama merek di satu
 *  panel adalah pengulangan yang paling cepat terlihat. */
export function PanelGerbangPrisma({ gambar }: { gambar: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <img src={gambar} alt="" className="absolute inset-0 size-full object-cover" />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay"
        style={{ backgroundImage: BINTIK }}
      />

      {/* Dua tirai, dua tugas. Yang menurun menggelapkan kaki panel supaya
          huruf putih di bawah tetap terbaca berapa pun terangnya gambar;
          yang mendatar menyatukan sisi kanan panel dengan kolom isi di
          sebelahnya — sama seperti pada tampilan Foto. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-transparent to-zinc-950/90" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-zinc-950" />

      <div className="absolute inset-x-0 bottom-0 px-10 pb-10">
        {/* Ukurannya dari lebar PANEL (cqw), bukan lebar layar (vw).
            Panel ini tinggal sisa layar sesudah kolom isi selebar 560 px
            diambil, jadi ukuran yang dihitung dari layar akan melimpah di
            jendela sempit dan tenggelam di layar lebar. */}
        <h2
          className="font-medium leading-[0.85] tracking-[-0.06em] text-zinc-100"
          style={{ fontSize: 'clamp(2.75rem, 17cqw, 9rem)' }}
        >
          <WordsPullUp text="Jadi Trader" jeda={0.1} />
        </h2>

        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 max-w-[38ch] text-[12.5px] leading-relaxed text-zinc-400"
        >
          Chart, screener, jurnal, dan eksekusi Pasar Kripto &amp; Forex di satu layar.
        </motion.p>
      </div>
    </div>
  );
}
