import { useRef } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   MENUTUP MODAL DENGAN KLIK DI LUAR — tanpa menutupnya saat menyeret teks
   ════════════════════════════════════════════════════════════════════════
   Pola yang biasa dipakai adalah `onClick={tutup}` di lapisan latar, dengan
   `stopPropagation` di kotaknya. Itu bekerja untuk klik biasa, dan GAGAL
   persis pada satu hal yang paling menyakitkan:

     Blok seluruh teks di sebuah textarea, lalu lepas tombol mouse sedikit
     di luar kotaknya.

   Peramban menembakkan `click` ke ELEMEN LELUHUR BERSAMA dari tempat
   mousedown dan mouseup. Karena mousedown di dalam kotak dan mouseup di
   latar, leluhur bersamanya adalah lapisan latar itu sendiri — jadi
   `onClick` menyala walaupun orangnya tidak pernah bermaksud mengklik
   latar. Modal tertutup, dan seluruh isian yang belum disimpan hilang.

   Yang membuat ini mahal: kejadiannya justru saat orang sedang MENYUNTING
   dengan sungguh-sungguh — memilih teks lama untuk menggantinya. Makin
   panjang tulisannya, makin besar peluang mouse-nya keluar sedikit.

   Perbaikannya: ingat DI MANA seretan dimulai. Latar hanya menutup kalau
   mousedown DAN mouseup keduanya terjadi di latar.
   ════════════════════════════════════════════════════════════════════════ */

export function useTutupLuar(tutup: () => void) {
  const mulaiDiLatar = useRef(false);

  return {
    onMouseDown: (e: React.MouseEvent) => {
      /* currentTarget = lapisan latar; target = yang benar-benar ditekan.
         Sama berarti tekanannya memang di latar, bukan di kotak isinya. */
      mulaiDiLatar.current = e.target === e.currentTarget;
    },
    onClick: (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && mulaiDiLatar.current) {
        mulaiDiLatar.current = false;
        tutup();
      }
    },
  };
}
