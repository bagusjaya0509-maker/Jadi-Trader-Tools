/* ════════════════════════════════════════════════════════════════════════
   TEKS HERO BERANDA
   ════════════════════════════════════════════════════════════════════════
   Modul KECIL yang sengaja tidak mengimpor apa pun: halaman depan adalah
   satu-satunya pemakainya yang dimuat sebelum login, dan menyeret firebase
   ke sana demi dua kalimat adalah harga yang salah.

   Tiga lapis, yang atas menang:
     1. localStorage  — suntingan orangnya sendiri lewat ikon pensil,
                        jadi bawaan pribadinya di perangkat itu.
     2. Firestore     — teks yang diterbitkan pemilik dari Maintenance,
                        menumpang dokumen public/ringkasanAkun yang memang
                        sudah diambil halaman depan (nol permintaan baru).
     3. Bawaan        — konstanta di bawah ini.
   ════════════════════════════════════════════════════════════════════════ */

export const JUDUL_BERANDA = 'Setidaknya kalau\nbelum profit\njangan sampai Lose.';
export const SUB_BERANDA =
  'Satu trade yang terukur lebih baik daripada banyak trade asal-asalan. ' +
  'Buat trading plan terbaikmu untuk Jadi Trader Profitable!';

export function bacaTeksLokal(): { judul: string; sub: string } {
  try {
    return {
      judul: localStorage.getItem('jt.heroJudul') ?? '',
      sub: localStorage.getItem('jt.heroSub') ?? '',
    };
  } catch { return { judul: '', sub: '' }; }
}

export function simpanTeksLokal(judul: string, sub: string) {
  try {
    if (judul) localStorage.setItem('jt.heroJudul', judul);
    else localStorage.removeItem('jt.heroJudul');
    if (sub) localStorage.setItem('jt.heroSub', sub);
    else localStorage.removeItem('jt.heroSub');
  } catch { /* mode privat */ }
}
