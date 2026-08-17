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
   lalu menyerahkan orangnya ke Dashboard yang asli. Seluruh sisanya —
   sidebar, perpindahan halaman, tiap panel — adalah aplikasi yang sama
   persis dengan yang dipakai pelanggan.

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
  return <Navigate to="/dashboard" replace />;
}
