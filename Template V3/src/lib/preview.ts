/* ════════════════════════════════════════════════════════════════════════
   MODE PREVIEW — menjelajah website asli tanpa masuk
   ════════════════════════════════════════════════════════════════════════
   Bukan halaman tiruan. Yang dibuka adalah aplikasi yang SAMA PERSIS —
   sidebar, Dashboard, Screener, Jurnal, Chart & Entry, Copy Signal — dan
   orangnya berpindah halaman seperti biasa. Bedanya cuma satu: ia belum
   masuk, jadi yang tampil data contoh.

   ── KENAPA INI AMAN, dan kenapa ia bukan "melewati keamanan" ──────────
   Gerbang di App.tsx adalah penjaga TAMPILAN, bukan penjaga data. Yang
   menjaga data adalah Firestore Security Rules di server, dan aturan itu
   menolak SEMUA pembacaan tanpa auth. Mode preview tidak menyentuhnya
   sama sekali: pengunjungnya memang tidak punya sesi, jadi tidak ada satu
   dokumen pun yang bisa ia baca, dan tidak ada satu pun yang bisa ia
   tulis.

   Yang ia lihat persis sama dengan yang dilihat pengunjung yang belum
   masuk hari ini — hanya saja sekarang ia boleh berpindah halaman alih-
   alih dilempar ke /akses di klik pertama. Tidak ada satu bit pun data
   orang lain yang berpindah tangan karena ini.

   Prinsip yang sama sudah tertulis di gerbang.tsx sejak awal: "Yang
   dijaga bukan tampilannya — melainkan datanya, dan itu dijaga Security
   Rules di server, bukan oleh menyembunyikan halaman."

   ── KENAPA sessionStorage, bukan localStorage ────────────────────────
   Preview berakhir saat tabnya ditutup. localStorage akan membuat orang
   yang besok kembali mendapati dirinya masih dalam mode preview tanpa
   pernah memintanya — dan lebih buruk, seseorang yang SUDAH punya akses
   bisa terjebak melihat data contoh tanpa tahu kenapa.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.preview';

export function mulaiPreview() {
  try { sessionStorage.setItem(KUNCI, '1'); } catch { /* privat */ }
  pendengar.forEach((f) => f());
}

export function akhiriPreview() {
  try { sessionStorage.removeItem(KUNCI); } catch { /* privat */ }
  pendengar.forEach((f) => f());
}

/** Sedang menjelajah sebagai pengunjung preview?
 *
 *  Dipanggil di jalur render gerbang, jadi ia harus MURAH dan tidak
 *  pernah melempar — sessionStorage bisa ditolak di mode privat. */
export function modePreview(): boolean {
  try { return sessionStorage.getItem(KUNCI) === '1'; } catch { return false; }
}

const pendengar = new Set<() => void>();
export function langgananPreview(f: () => void): () => void {
  pendengar.add(f);
  return () => { pendengar.delete(f); };
}

/* ── Jatah "sekali lihat" ────────────────────────────────────────────────
   REPLAY — latihan eksekusi di atas data pasar sungguhan — bisa dipakai
   berjam-jam tanpa pernah menyentuh alasan untuk mendaftar. Sekali, bukan
   nol: satu kali cukup untuk merasakan bentuknya, dan itu memang yang perlu
   dilihat sebelum memutuskan. Yang dibatasi cuma PENGULANGANNYA.

   SCREENER AREA dulu ikut di sini. Dicabut 10 Sep 2026 (pemilik): halaman
   itu sekarang minta akun sejak klik pertama, dan menjelaskannya lewat
   kartu <PerluMasuk> di halamannya sendiri. Aturan yang tinggal satu tempat
   tidak bisa menyimpang dari dirinya sendiri.

   Di sessionStorage bersama penanda previewnya sendiri, jadi semuanya lahir
   dan mati bersamaan. Yang sudah masuk tidak pernah melewati pemeriksaan
   ini — pemanggilnya wajib memastikan tidak ada sesi. */
export type Jatah = 'replay';

const kunciJatah = (nama: Jatah) => `jt.preview.${nama}`;

export function jatahTerpakai(nama: Jatah): boolean {
  try { return sessionStorage.getItem(kunciJatah(nama)) === '1'; } catch { return false; }
}

export function pakaiJatah(nama: Jatah) {
  try { sessionStorage.setItem(kunciJatah(nama), '1'); } catch { /* privat */ }
}
