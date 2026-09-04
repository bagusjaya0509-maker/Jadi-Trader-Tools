import { useEffect, useRef } from 'react';

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


/* ════════════════════════════════════════════════════════════════════════
   DROPDOWN: MENUTUP SAAT DIKLIK DI LUAR
   ════════════════════════════════════════════════════════════════════════
   Saudara `useTutupLuar` di atas, untuk kasus yang berbeda. Yang di atas
   untuk MODAL, yang punya lapisan latar sendiri; yang ini untuk DROPDOWN
   yang menempel pada tombolnya dan tidak punya latar apa pun.

   Pindah ke sini dari app-shell.tsx 4 Sep 2026. Sebelumnya ia tinggal di
   sana tanpa diekspor, dipakai tiga dropdown bilah atas — sementara menu
   profil di `gerbang.tsx` memakai cara sendiri yang tidak bekerja. Ia tidak
   bisa sekadar mengimpor dari app-shell: app-shell justru mengimpor
   `MenuPengguna` dari gerbang, jadi keduanya akan saling memanggil.

   ── KENAPA PENDENGAR DI DOKUMEN, BUKAN LAPISAN PENANGKAP KLIK ───────────
   Cara yang tampak lebih sederhana adalah menaruh `fixed inset-0` di bawah
   panelnya. Itulah yang dulu dipakai menu profil, dan ia TIDAK PERNAH
   BEKERJA: bilah atas memakai `backdrop-blur`, dan `backdrop-filter`
   menjadikan elemennya BLOK PENAMPUNG bagi keturunan `position: fixed`.
   Jadi `inset-0` bukan seluruh layar melainkan seluruh BILAH — diukur di
   peramban: tinggi 55 px, bukan 800. Klik di badan halaman lewat begitu
   saja di bawahnya.

   Pendengar di dokumen tidak bisa dikalahkan susunan lapis siapa pun.

   `mousedown`, bukan `click`: yang menentukan DI MANA tekanan dimulai.
   Memblok teks di dalam panel lalu melepas tetikus di luar tidak boleh
   menutupnya — sebab yang sama dengan yang ditulis panjang di atas.
   ════════════════════════════════════════════════════════════════════════ */
export function usePenutupLuar<T extends HTMLElement>(saatTutup: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const klik = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) saatTutup();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') saatTutup(); };
    document.addEventListener('mousedown', klik);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', klik);
      document.removeEventListener('keydown', esc);
    };
  }, [saatTutup]);
  return ref;
}
