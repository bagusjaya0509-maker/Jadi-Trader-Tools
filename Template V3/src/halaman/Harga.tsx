import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import Pricing_05 from '@/components/ui/ruixen-pricing05';

/* ════════════════════════════════════════════════════════════════════════
   HALAMAN HARGA DI DALAM APLIKASI — DIGAMBAR SEBAGAI LAPISAN
   ════════════════════════════════════════════════════════════════════════
   Ada karena halaman depan TIDAK BISA dipakai untuk ini.

   Rute "/" bercabang: yang belum login melihat halaman pendaratan berikut
   bagian harganya, yang sudah login melihat Beranda. Jadi tautan "/#harga"
   yang dipasang di layar-layar terkunci mendarat di halaman yang tidak
   punya jangkar itu — tombolnya ditekan, alamatnya berubah, dan tidak
   terjadi apa-apa. Persis keadaan yang paling membingungkan: bukan galat,
   bukan berhasil, cuma diam.

   Yang membaca halaman ini justru orang yang PALING mungkin membeli: ia
   sudah masuk, sudah memakai alatnya, dan baru saja membentur batas
   paketnya. Ia tidak boleh disuruh keluar dulu untuk melihat harganya.

   ── KENAPA LAPISAN, BUKAN HALAMAN PENUH ─────────────────────────────────
   Diminta pemilik 5 Sep 2026, dan bentuknya memang lebih tepat: daftar
   harga dibuka DI TENGAH pekerjaan — habis kena batas screener, habis
   menekan tombol yang terkunci — lalu ditutup dan pekerjaannya dilanjutkan.
   Halaman penuh memutus alur itu: ia mengganti seluruh layar, dan yang
   menutupnya harus mencari sendiri jalan kembali ke tempat ia tadi.

   ── RUTENYA TETAP RUTE, DAN ITU SENGAJA ─────────────────────────────────
   `/harga` tidak diubah jadi keadaan lokal. Alamatnya sudah tersebar:
   dipasang di lima layar terkunci, dan yang paling penting — dikirim di
   SURAT PENGINGAT. Alamat yang diketik langsung atau dibuka dari surat
   harus tetap sampai, dan dengan bentuk ini ia sampai: lapisannya tergambar
   di atas kerangka aplikasi, bukan di ruang kosong.

   Menutupnya memakai `navigate(-1)` — kembali ke tempat orangnya tadi,
   bukan ke alamat tetap yang ditebak berkas ini. Yang datang dari surat
   tidak punya riwayat untuk dimundurkan, jadi ada cadangannya: Dashboard.

   Komponennya SAMA dengan yang di halaman depan, bukan salinan. Dua daftar
   harga yang harus diperbarui bersamaan adalah dua daftar harga yang suatu
   hari berbeda — dan yang berbeda di sini adalah angka yang ditagihkan.
   ════════════════════════════════════════════════════════════════════════ */

export default function Harga() {
  const navigate = useNavigate();

  /* Panjang riwayat DIBACA SAAT LAHIR, bukan saat tombolnya ditekan.
     `history.length` ikut bertambah oleh navigasi apa pun yang terjadi
     selagi lapisan ini terbuka, dan yang ingin diketahui adalah "apakah ada
     tempat untuk kembali SAAT ia dibuka" — bukan sesudahnya. */
  const adaRiwayat = typeof window !== 'undefined' && window.history.length > 1;

  function tutup() {
    if (adaRiwayat) navigate(-1);
    else navigate('/dashboard', { replace: true });
  }

  /* Escape menutup. Lapisan yang cuma bisa ditutup lewat satu tombol kecil
     di sudut adalah lapisan yang terasa menjebak — aturan yang sama sudah
     dipakai lapisan rincian dompet. */
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') tutup(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Diportal ke body, bukan digambar di dalam kerangka. Kolom isi kerangka
     punya `overflow` sendiri; lapisan yang lahir di dalamnya akan terpotong
     di tepi kolom itu alih-alih menutupi layar. */
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
         onClick={tutup}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

      <div onClick={(e) => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-label="Paket & harga"
           className="relative my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Tombol tutup MELAYANG di atas isinya, bukan di bilah kepala
            sendiri. Blok harganya sudah punya judul besarnya sendiri
            ("Pilih Akses Sesuai Kebutuhanmu"); menambah bilah kepala kedua
            di atasnya berarti dua judul bertumpuk untuk satu isi. */}
        <button onClick={tutup} aria-label="Tutup"
          className="absolute right-3 top-3 z-10 cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950/80 p-1.5 text-zinc-400 backdrop-blur transition-colors hover:border-zinc-700 hover:text-zinc-100">
          <X className="size-4" />
        </button>

        {/* Jarak bawaan bloknya py-24 — benar di halaman depan, di mana ia
            satu seksi di antara seksi lain. Di dalam lapisan ia meninggalkan
            ruang kosong sebesar layar di atas kartunya.

            Dikecilkan lewat pemilih anak, BUKAN margin negatif: `[&>section]`
            menghasilkan pemilih turunan yang kekhususannya lebih tinggi
            daripada kelas py-24 di seksinya, jadi ia menang tanpa perlu
            !important dan tanpa mengubah komponen tempelannya. */}
        <div className="[&>section]:bg-transparent [&>section]:py-6 sm:[&>section]:py-8">
          <Pricing_05 />
        </div>
      </div>
    </div>,
    document.body,
  );
}
