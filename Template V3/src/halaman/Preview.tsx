import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { mulaiPreview } from '@/lib/preview';
import { useAuth } from '@/lib/auth';

/* ════════════════════════════════════════════════════════════════════════
   /preview — PINTU MASUK, bukan halaman
   ════════════════════════════════════════════════════════════════════════
   Versi pertama halaman ini adalah satu halaman ringkasan buatan sendiri.
   Itu salah menafsirkan permintaannya: yang diminta bukan ringkasan,
   melainkan WEBSITE ASLINYA yang bisa dijelajahi — Dashboard, Screener,
   Jurnal, Chart & Entry, Copy Signal — supaya orangnya merasakan bentuk
   yang sesungguhnya, bukan brosur tentang bentuk itu.

   Jadi berkas ini tidak menggambar apa pun. Ia menyalakan mode preview
   lalu menyerahkan orangnya ke Chart & Entry yang asli. Seluruh sisanya —
   sidebar, perpindahan halaman, tiap panel — adalah aplikasi yang sama
   persis dengan yang dipakai pelanggan.

   ── KENAPA CHART & ENTRY, BUKAN DASHBOARD ────────────────────────────
   Diminta pemilik 7 Sep 2026, dan alasannya bisa dibaca dari kedua
   halamannya. Dashboard adalah RINGKASAN atas data yang orangnya belum
   punya: di mode preview isinya angka contoh, dan halaman pertama yang
   memperlihatkan untung-rugi karangan tidak menjelaskan alat apa yang
   sedang ditawarkan. Chart & Entry adalah ALATNYA sendiri — grafik yang
   hidup, indikator yang bisa dinyalakan, tiket order, replay — dan ia
   sama berguna bagi orang yang belum punya satu transaksi pun.

   Yang sudah dijelajahi tetap utuh: sidebar-nya sama, Dashboard tinggal
   satu klik. Yang berubah cuma halaman mana yang dilihat lebih dulu.

   Konsekuensinya yang paling berharga: tidak ada halaman kembar yang
   harus ikut diperbarui tiap kali panel aslinya berubah. Halaman tiruan
   akan selalu tertinggal, dan versi tertinggal dari etalase produk lebih
   buruk daripada tidak punya etalase.

   Yang sudah masuk TIDAK dialihkan ke sini — ia langsung ke Dashboard
   miliknya. Menyeret orang yang punya akses ke mode contoh berarti
   menyembunyikan datanya sendiri di balik angka karangan.
   ════════════════════════════════════════════════════════════════════════ */

export default function Preview() {
  const { pengguna, memuat } = useAuth();

  useEffect(() => {
    if (!memuat && !pengguna) mulaiPreview();
  }, [memuat, pengguna]);

  if (memuat) return null;
  return <Navigate to="/chart-entry" replace />;
}
