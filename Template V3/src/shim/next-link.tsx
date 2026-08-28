/* ════════════════════════════════════════════════════════════════════════
   PENGGANTI `next/link` UNTUK PROYEK VITE
   ════════════════════════════════════════════════════════════════════════
   Alasannya sama dengan next-image: komponen yang dikirim pemilik ditulis
   untuk Next.js, dan proyek ini bukan Next. Daripada menyunting komponennya
   — yang sudah tiga kali diminta jangan — modulnya yang disediakan.

   `href` internal DIBIARKAN sebagai <a> biasa, bukan <Link> React Router.
   Alasannya: komponen ini juga dipakai di halaman artikel statis yang
   berada DI LUAR router. <Link> di luar Router melempar galat, dan galatnya
   menjatuhkan seluruh pohon React di halaman itu. <a> jalan di kedua tempat.
   ════════════════════════════════════════════════════════════════════════ */
import React from 'react';

type Props = {
  href: string;
  children?: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

export default function Link({ href, children, ...sisa }: Props) {
  return (
    <a href={href} {...sisa}>
      {children}
    </a>
  );
}
