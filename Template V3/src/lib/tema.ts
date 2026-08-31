import { useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   TEMA — untuk yang warnanya TIDAK bisa lewat CSS
   ════════════════════════════════════════════════════════════════════════
   Hampir seluruh aplikasi berganti tema tanpa tahu apa-apa: warnanya
   ditulis sebagai kelas Tailwind, dan Tailwind v4 menyusunnya jadi
   variabel CSS yang tinggal ditimpa (lihat blok [data-tema='terang'] di
   index.css). Tidak ada satu pun komponen yang perlu diubah.

   Ada satu golongan yang tidak ikut: yang menggambar di KANVAS. Grafik
   lilin memakai lightweight-charts, dan pustaka itu menerima warna
   sebagai string biasa lewat JavaScript — bukan CSS. `currentColor` pun
   tidak berlaku di sana, karena tidak ada elemen SVG yang mewarisi apa
   pun. Warnanya harus benar-benar dihitung ulang saat temanya berganti.

   Berkas ini menyediakan satu-satunya jalan untuk itu, supaya tiap
   komponen kanvas tidak membuat pengamatnya sendiri-sendiri.
   ════════════════════════════════════════════════════════════════════════ */

export type Tema = 'gelap' | 'terang';

export function temaSekarang(): Tema {
  if (typeof document === 'undefined') return 'gelap';
  return document.documentElement.getAttribute('data-tema') === 'terang' ? 'terang' : 'gelap';
}

/** Ikut berubah saat tombol tema ditekan, tanpa muat ulang halaman. */
export function useTema(): Tema {
  const [tema, setTema] = useState<Tema>(temaSekarang);

  useEffect(() => {
    /* MutationObserver, bukan even kustom: tombol temanya cuma memasang
       atribut di <html>, dan siapa pun boleh melakukannya — termasuk
       konsol peramban saat sedang diperiksa. Mengamati atributnya
       menangkap semua cara, bukan cuma cara yang kita ingat. */
    const pengamat = new MutationObserver(() => setTema(temaSekarang()));
    pengamat.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-tema'],
    });
    setTema(temaSekarang());
    return () => pengamat.disconnect();
  }, []);

  return tema;
}

/* ── Warna grafik lilin, satu tabel untuk dua tema ──────────────────────
   Nilai gelap SENGAJA disalin apa adanya dari yang sudah dipakai selama
   ini, bukan ditulis ulang "yang mirip". Tema gelap tidak boleh berubah
   sedikit pun oleh perubahan ini, dan cara paling murah memastikannya
   adalah menyalin angkanya persis. */
export const WARNA_CHART = {
  gelap: {
    teks: '#a1a1aa',
    /* 4% -> 7%. Dinaikkan bukan karena kisinya kurang terang, tapi karena
       garis TEGAK-nya praktis hilang.

       Keduanya memakai warna yang sama, tapi tidak sama nasibnya: garis
       mendatar duduk di tiap label skala harga — rapat, sejajar, dan mata
       menangkapnya sebagai pola. Garis tegak cuma digambar di penanda
       waktu, segelintir saja selebar layar, dan tiap satunya harus melewati
       kerumunan lilin. Pada 4% ia kalah oleh lilin yang dilewatinya, dan
       chartnya terbaca "cuma punya garis mendatar".

       Tujuh persen masih bisikan — di bidang kosong ia nyaris tak terlihat
       — tapi cukup untuk bertahan saat menyeberangi badan lilin. */
    kisi: 'rgba(255,255,255,.07)',
    batasSkala: 'rgba(255,255,255,.08)',
    bidik: 'rgba(255,255,255,.2)',
    labelBidik: '#27272a',
    garisNol: 'rgba(255,255,255,.14)',
    /* Pembatas antara panel lilin dan panel SMI. Tanpa nilai ini pustakanya
       memakai bawaannya sendiri — abu terang yang di atas latar hampir
       hitam terbaca sebagai GARIS PUTIH membelah chart. Ia pembatas, bukan
       pengumuman: tugasnya memberi tahu ada dua panel, bukan menarik mata
       ke dirinya sendiri. */
    pisahPane: 'rgba(255,255,255,.06)',
    pisahPaneSorot: 'rgba(255,255,255,.16)',
  },
  terang: {
    teks: '#52525b',
    /* Alfanya dinaikkan, bukan disamakan. Putih 4% di atas hitam
       menghasilkan beda 10 tingkat; hitam 4% di atas putih cuma 10 tingkat
       juga — tapi mata jauh lebih peka pada garis gelap di bidang terang,
       jadi angka yang sama terasa lebih ramai. Diturunkan sedikit supaya
       kisinya tetap berbisik. */
    kisi: 'rgba(0,0,0,.09)',
    batasSkala: 'rgba(0,0,0,.12)',
    bidik: 'rgba(0,0,0,.35)',
    labelBidik: '#334155',
    garisNol: 'rgba(0,0,0,.18)',
    pisahPane: 'rgba(0,0,0,.09)',
    pisahPaneSorot: 'rgba(0,0,0,.2)',
  },
} as const;
