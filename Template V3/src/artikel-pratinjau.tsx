import { createRoot } from 'react-dom/client';
import { LinkPreview } from '@/components/ui/link-preview';

/* ════════════════════════════════════════════════════════════════════════
   PRATINJAU TAUTAN DI HALAMAN ARTIKEL STATIS
   ════════════════════════════════════════════════════════════════════════
   MASALAH YANG DIPECAHKAN. Pemilik ingin komponen link-preview Aceternity
   dipakai apa adanya di halaman baca artikel. Tapi halaman itu HTML statis
   tanpa satu baris JavaScript — dan itu bukan kebetulan, itu seluruh alasan
   ia dibuat: HTML mentah halaman depan cuma memuat 122 karakter teks karena
   semuanya digambar React, sementara tiap artikel memuat 3.584 karakter yang
   langsung terbaca crawler.

   Mengubah halaman artikel jadi rute React akan mengembalikannya ke keadaan
   yang baru saja diperbaiki.

   JALAN KELUARNYA: PENINGKATAN BERTAHAP. Teks artikel tetap ada di HTML,
   utuh, sebelum skrip apa pun jalan — jadi Google dan pembaca tanpa
   JavaScript mendapat semuanya. Berkas ini menyusul BELAKANGAN dan
   memasang komponen React yang sungguhan di atas tautan yang sudah ada.

   Yang didapat: HoverCard Radix, pegas framer-motion, dan geseran kartu
   mengikuti posisi kursor — tiga hal yang tidak bisa ditiru CSS.
   Yang tidak hilang: satu pun huruf dari HTML-nya.

   CARA MENANDAI TAUTANNYA. Perender menulis
       <a href="…" data-pratinjau data-gambar="/artikel/gambar/x.webp">
   dan berkas ini menggantinya dengan <LinkPreview isStatic imageSrc=…>.
   Kalau berkas ini gagal dimuat, yang tersisa tautan biasa yang tetap
   berfungsi — kegagalannya tidak pernah menghilangkan apa pun.
   ════════════════════════════════════════════════════════════════════════ */

/* Komponennya memakai kelas Tailwind. Halaman artikel TIDAK memuat Tailwind
   — memuatnya berarti menyeret lembar gaya seluruh aplikasi ke halaman yang
   sengaja dibuat ringan. Yang dibutuhkan cuma delapan aturan, jadi kedelapan
   aturan itu yang dipasang, bukan kerangkanya. */
const GAYA = `
.jt-pratinjau-akar{display:inline}
.shadow-xl{box-shadow:0 20px 45px rgba(0,0,0,.7)}
.rounded-xl{border-radius:12px}
.rounded-lg{border-radius:8px}
.block{display:block}
.p-1{padding:4px}
.bg-white{background:#fff}
.border-2{border-width:2px;border-style:solid}
.border-transparent{border-color:transparent}
.hover\\:border-neutral-200:hover{border-color:#e5e5e5}
`;

function pasangGaya() {
  if (document.getElementById('jt-pratinjau-gaya')) return;
  const el = document.createElement('style');
  el.id = 'jt-pratinjau-gaya';
  el.textContent = GAYA;
  document.head.appendChild(el);
}

function pasang() {
  const tautan = document.querySelectorAll<HTMLAnchorElement>('a[data-pratinjau]');
  if (!tautan.length) return;
  pasangGaya();

  tautan.forEach((a) => {
    const gambar = a.dataset.gambar;
    const url = a.getAttribute('href');
    if (!gambar || !url) return;

    /* Kartu tiruan-CSS dibuang di sini, bukan di CSS: selama JavaScript
       belum jalan ia yang bekerja, dan mencabutnya lebih awal berarti ada
       jeda waktu tidak ada pratinjau sama sekali. */
    const kartuCss = a.parentElement?.querySelector('.kartu-p');
    if (kartuCss) kartuCss.remove();

    const wadah = document.createElement('span');
    wadah.className = 'jt-pratinjau-akar';
    a.replaceWith(wadah);

    createRoot(wadah).render(
      <LinkPreview url={url} imageSrc={gambar} isStatic className="font-bold">
        {a.textContent}
      </LinkPreview>,
    );
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pasang);
} else {
  pasang();
}
