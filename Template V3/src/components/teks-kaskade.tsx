import { memo, useMemo, useState, type CSSProperties, type ElementType, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   TEKS KASKADE — huruf berguling satu per satu saat disentuh kursor
   ════════════════════════════════════════════════════════════════════════
   Diadaptasi dari komponen "CascadeText" (21st.dev). Caranya bekerja tidak
   terlihat dari namanya, jadi ditulis di sini: tiap huruf punya SALINAN
   dirinya sendiri yang digambar `text-shadow` tepat satu ketinggian di
   bawahnya. Kotak pembungkusnya memotong apa pun di luar satu baris, jadi
   salinan itu tidak terlihat. Saat disentuh, tiap huruf digeser ke atas
   sejauh jarak yang sama persis — yang lama keluar dari kotak, yang baru
   masuk menggantikannya, dan pergeseran per huruf ditunda sedikit demi
   sedikit sehingga terbaca sebagai gelombang.

   ── TIGA HAL YANG DIUBAH DARI ASLINYA, SEMUANYA PUNYA SEBAB ────────────

   1. `"use client"` DICABUT. Itu penanda React Server Components milik
      Next.js; situs ini Vite SPA, seluruh komponennya sudah berjalan di
      peramban. Membiarkannya bukan salah, tapi ia mengaku sesuatu yang
      tidak ada di sini.

   2. TINGGI KOTAK DAN JARAK SALINAN DIPISAH DARI `1em`. Aslinya kotaknya
      setinggi 1em dan salinannya 1em di bawah — dan pada tinggi persis 1em,
      ekor huruf yang turun di bawah garis dasar (g, y, p, J pada banyak
      font) IKUT TERPOTONG. Judul "Jadi Trader Tools" adalah kasus itu.
      Sekarang keduanya satu angka yang sama (`jarak`, bawaan 1.15em):
      selama tinggi kotak = jarak salinan, salinannya tetap persis di luar
      pandangan, tapi ekor hurufnya dapat ruang.

   3. GAYA HURUF TIDAK LAGI DIPAKSA. Aslinya menempelkan `uppercase
      font-extrabold tracking-tight` di kelas dasarnya, jadi ia selalu
      terlihat seperti komponen contohnya alih-alih seperti judul yang
      memakainya. Di sini kelas dasarnya cuma yang MEMANG diperlukan
      mekanismenya (inline-block, overflow-hidden, dan sanak-saudaranya);
      selebihnya datang dari `className` pemanggil, digabung lewat `cn()`
      supaya utility yang bentrok benar-benar ditimpa — tanpa twMerge,
      "uppercase" bawaan dan "normal-case" milik pemanggil sama kuatnya dan
      yang menang ditentukan urutan di berkas CSS, bukan niat penulisnya.

   ── SATU BATAS YANG TIDAK BISA DILANGGAR ────────────────────────────────
   Salinannya digambar `currentColor`. Teks bergradien (`bg-clip-text
   text-transparent`) punya warna TRANSPARAN — jadi salinannya tak terlihat
   dan efeknya tidak terjadi sama sekali. Bukan bug yang bisa ditambal:
   text-shadow memang tidak bisa mewarisi gradien. Yang mau bergelombang
   harus berwarna padat.
   ════════════════════════════════════════════════════════════════════════ */

export interface TeksKaskadeProps {
  teks: string;
  /** Elemen pembungkusnya. Bawaannya `span` — bukan `a` seperti aslinya:
   *  yang paling sering dipakai di sini judul, dan tautan yang tidak menuju
   *  ke mana-mana adalah janji palsu bagi pembaca layar. */
  sebagai?: ElementType;
  href?: string;
  target?: string;
  className?: string;
  style?: CSSProperties;
  /** Jeda antar huruf, ms. Makin kecil makin serempak. */
  jeda?: number;
  /** Lama satu huruf berguling, ms. */
  durasi?: number;
  easing?: string;
  /** Warna diam. `inherit` = ikut induknya. */
  warna?: string;
  /** Warna sesudah disentuh. Kosong = tidak berubah warna. */
  warnaSentuh?: string;
  /** Tinggi kotak DAN jarak salinannya sekaligus — lihat catatan (2). */
  jarak?: string;
  arah?: 'atas' | 'bawah';
  /** Huruf ke-berapa gelombangnya mulai dihitung. Dipakai saat satu judul
   *  dipecah jadi beberapa baris tapi gelombangnya harus tetap menyambung. */
  mulaiDari?: number;
  onClick?: (e: MouseEvent) => void;
}

/** Benar kalau perangkatnya minta animasi dikurangi.
 *
 *  Dibaca sekali saat render, bukan dipantau: yang menyalakannya di tengah
 *  jalan sangat jarang, dan pendengar media query di komponen yang bisa
 *  muncul puluhan kali di satu halaman lebih mahal daripada yang ia beli. */
function hematGerak(): boolean {
  return typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export const TeksKaskade = memo(function TeksKaskade({
  teks,
  sebagai: Bungkus = 'span',
  href,
  target,
  className = '',
  style,
  jeda = 25,
  durasi = 250,
  easing = 'ease-in-out',
  warna = 'inherit',
  warnaSentuh,
  jarak = '1.15em',
  arah = 'atas',
  mulaiDari = 0,
  onClick,
}: TeksKaskadeProps) {
  const [sentuh, setSentuh] = useState(false);
  const diam = hematGerak();

  /* `Intl.Segmenter` memecah per GRAFEM, bukan per unit kode: emoji dan
     huruf beraksen tetap utuh alih-alih pecah jadi dua kotak. Jatuh ke
     spread biasa di peramban yang belum punya. */
  const huruf = useMemo(() => {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const pemecah = new Intl.Segmenter('id', { granularity: 'grapheme' });
      return Array.from(pemecah.segment(teks), (s) => s.segment);
    }
    return [...teks];
  }, [teks]);

  const tanda = arah === 'atas' ? 1 : -1;

  const props: Record<string, unknown> = {
    className: cn('relative inline-block cursor-default select-none align-bottom', className),
    style: {
      color: sentuh && warnaSentuh ? warnaSentuh : warna,
      transition: 'color .35s ease',
      lineHeight: 1,
      ...style,
    },
    onMouseEnter: () => setSentuh(true),
    onMouseLeave: () => setSentuh(false),
    onClick,
    /* Isinya `aria-hidden`, jadi nama yang terbaca harus dipasang di sini —
       tanpa ini pembaca layar menemukan elemen yang benar-benar kosong. */
    'aria-label': teks,
  };

  if (Bungkus === 'a') {
    props.href = href ?? '#';
    props.className = cn(props.className as string, 'cursor-pointer no-underline');
    if (target) {
      props.target = target;
      if (target === '_blank') props.rel = 'noopener noreferrer';
    }
  }

  return (
    <Bungkus {...props}>
      <span className="relative inline-flex overflow-hidden" style={{ height: jarak }} aria-hidden="true">
        {huruf.map((h, i) => (
          <span
            key={i}
            className="relative inline-block will-change-transform"
            style={{
              /* Salinan huruf, tepat sejauh `jarak` di seberangnya. */
              textShadow: `0 ${tanda === 1 ? '' : '-'}${jarak} currentColor`,
              transition: diam ? undefined : `transform ${durasi}ms ${easing}`,
              transitionDelay: diam ? undefined : `${(mulaiDari + i) * jeda}ms`,
              transform: sentuh && !diam
                ? `translateY(${tanda === 1 ? '-' : ''}${jarak})`
                : 'translateY(0)',
            }}
          >
            {/* Spasi biasa runtuh di `inline-block`; spasi tak-putus tidak. */}
            {h === ' ' ? ' ' : h}
          </span>
        ))}
      </span>
    </Bungkus>
  );
});
