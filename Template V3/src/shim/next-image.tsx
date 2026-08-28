/* ════════════════════════════════════════════════════════════════════════
   PENGGANTI `next/image` UNTUK PROYEK VITE
   ════════════════════════════════════════════════════════════════════════
   KENAPA ADA. Komponen yang dikirim pemilik ditulis untuk Next.js dan
   mengimpor `next/image`. Proyek ini Vite + React Router — modul itu tidak
   ada, dan build-nya gagal dengan galat resolusi modul yang bahkan tidak
   menyebut Next.

   Dua cara memperbaikinya:
     a. Menyunting komponennya — dan pemilik sudah tiga kali bilang JANGAN.
     b. Menyediakan modulnya, jadi kodenya jalan apa adanya.

   Yang dipakai (b). Berkas ini dipetakan ke `next/image` lewat alias di
   vite.config.ts, sehingga komponen aslinya bisa ditempel huruf per huruf
   tanpa satu baris pun disunting.

   YANG DITIRU: src, width, height, alt, className, style. Yang DITERIMA
   lalu diabaikan: `quality`, `layout`, `priority` — ketiganya perintah untuk
   pengoptimal gambar milik Next, dan pengoptimal itu memang tidak ada di
   sini. Menerimanya penting supaya React tidak melempar atribut tak dikenal
   ke DOM; mengabaikannya jujur, karena tidak ada yang bisa dilakukan
   dengannya.
   ════════════════════════════════════════════════════════════════════════ */
import React from 'react';

type Props = {
  src: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  quality?: number;
  layout?: string;
  priority?: boolean;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'>;

export default function Image({
  src, width, height, alt = '', className, style,
  quality: _quality, layout: _layout, priority, ...sisa
}: Props) {
  return (
    <img
      src={src}
      width={width}
      height={height}
      alt={alt}
      className={className}
      style={style}
      /* `priority` di Next berarti "muat lebih dulu". Padanan terdekatnya
         di HTML biasa: eager + fetchPriority tinggi. */
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      {...sisa}
    />
  );
}
