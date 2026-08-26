import { useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   GERAK — pemicu animasi masuk yang tidak bisa tersangkut
   ════════════════════════════════════════════════════════════════════════
   Transisi CSS butuh DUA nilai. Elemen yang lahir langsung di keadaan
   akhirnya tidak punya nilai kedua, jadi tidak ada yang ditransisikan dan
   panelnya muncul kaku begitu saja. Pola yang benar: pasang dalam keadaan
   awal, lalu sebingkai kemudian pindah ke keadaan akhir.

   Ditaruh di sini, bukan disalin ke tiap panel, karena bagian yang paling
   mudah salah bukan kelasnya melainkan PEMICUNYA — lihat catatan
   requestAnimationFrame di bawah.
   ════════════════════════════════════════════════════════════════════════ */

/** Pengguna yang meminta gerak dikurangi tidak mendapat animasi apa pun.
 *  Bukan versi lebih cepat: nol. */
export function useKurangGerak() {
  const [diam, setDiam] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ubah = () => setDiam(mq.matches);
    mq.addEventListener('change', ubah);
    return () => mq.removeEventListener('change', ubah);
  }, []);
  return diam;
}

/**
 * `tampil` bernilai false pada render pertama sesudah `aktif` menyala, lalu
 * true sebingkai kemudian — cukup untuk melepas transisi CSS.
 *
 * @param aktif  Untuk panel yang DIPASANG-DILEPAS (`{buka && <Panel/>}`),
 *               biarkan kosong: pemasangannya sendiri sudah jadi tanda.
 *               Untuk panel yang markup-nya menempel di komponen induk yang
 *               tidak ikut dilepas, oper keadaan bukanya — tanpa itu hook
 *               ini menyala sekali saat halaman dimuat dan sudah terlanjur
 *               `true` jauh sebelum ada yang mengklik.
 */
export function useMuncul(aktif = true) {
  const diam = useKurangGerak();
  const [tampil, setTampil] = useState(false);

  useEffect(() => {
    if (!aktif) { setTampil(false); return; }
    if (diam) { setTampil(true); return; }

    /* DUA PEMICU, dan yang kedua bukan hiasan: requestAnimationFrame
       BERHENTI BERDETAK di tab yang tidak dikomposisi (latar, jendela
       tertutup, pratinjau yang tidak ditampilkan). Kalau ia satu-satunya
       pemicu, panelnya tersangkut di keadaan awal — terpasang, terbaca
       pembaca layar, tapi opacity 0 dan tinggi 0. Terukur: 600 ms sesudah
       diklik masih "0". Pewaktu tetap jalan di sana, jadi ia yang menjamin
       panelnya selalu sampai ke keadaan terbuka. */
    let dua = 0;
    const satu = requestAnimationFrame(() => {
      dua = requestAnimationFrame(() => setTampil(true));
    });
    const jaring = setTimeout(() => setTampil(true), 120);

    return () => {
      cancelAnimationFrame(satu);
      cancelAnimationFrame(dua);
      clearTimeout(jaring);
    };
  }, [aktif, diam]);

  return { tampil, diam };
}
