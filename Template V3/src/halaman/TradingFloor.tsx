import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Maximize2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth';

/* ════════════════════════════════════════════════════════════════════════
   TRADING FLOOR — HALAMANNYA SENDIRI
   ════════════════════════════════════════════════════════════════════════
   Diminta pemilik 23 Sep 2026: halaman baru untuk Trading Floor versi
   terbaru. Yang lama tetap hidup sebagai panel kecil di Copy Signal
   (`performa-signal.tsx`, iframe ke /3d/trading-floor) dan tidak disentuh.

   ── KENAPA IFRAME, DAN KENAPA RUANGANNYA TIDAK IKUT DI REPO ────────────
   Ruangannya Three.js murni dengan 70 MB aset — office, robot, kantor
   tambahan, kantor bertangga, meja analis, panorama kota. Tiga akibatnya:

   1. Memanggil Three.js dari React berarti dua pengelola siklus hidup
      berebut satu kanvas WebGL. Iframe memberi ruangan itu dokumennya
      sendiri, dan yang terjadi di dalamnya tidak bisa menjatuhkan aplikasi.

   2. Asetnya TIDAK boleh tinggal di `public/`. Workflow bangun-v3 menukar
      SELURUH /root/v3 tiap ada push, dan 70 MB yang ikut tiap deploy
      berarti tiap perbaikan satu baris CSS mengirim ulang seluruh kantor.
      Ruangannya tinggal di /root/ruang3d di VPS, di luar jangkauan deploy,
      dan disajikan modul `ruang.js` di alamat /trabar2.

   3. Alamat itu digerbangi kuki ruangan yang sama dengan /ruang dan
      /trabar — pemilik saja. Gerbangnya di server, bukan di sini; halaman
      ini cuma bingkainya.

   ── VERSI PERTAMA TETAP ADA DI /trabar ─────────────────────────────────
   Sengaja. Ia sudah ditautkan dan sudah dipakai; mengganti isinya di
   tempat berarti satu rilis yang gagal menghapus satu-satunya versi yang
   terbukti jalan. Dua alamat, dua salinan.
   ════════════════════════════════════════════════════════════════════════ */

const RUANG = '/trabar2/';

export default function TradingFloor() {
  const { pemilik } = useAuth();
  /* Kunci pemuatan ulang. Ruangan 3D yang tersendat lebih sering pulih
     dengan dimuat ulang daripada dengan ditunggu — dan memuat ulang TAB
     berarti menunggu aplikasi React ikut bangun lagi. */
  const [kunci, setKunci] = useState(0);

  if (!pemilik) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
          <h1 className="text-[15px] font-semibold text-zinc-100">Trading Floor</h1>
          <p className="mt-1.5 max-w-lg text-[12.5px] leading-relaxed text-zinc-500">
            Ruangan ini masih terbatas untuk pemilik. Isinya menampilkan posisi dan sinyal
            akun sungguhan, jadi aksesnya menunggu sampai bagian itu siap dibuka untuk
            pengguna lain.
          </p>
          <Link to="/copy-signal"
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-sky-400 hover:text-sky-300">
            <ArrowLeft className="size-3.5" /> Kembali ke Copy Signal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--tinggi-kepala,56px))] min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-2 pt-3 md:px-6">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-zinc-100">Trading Floor</h1>
          <p className="mt-0.5 text-[11.5px] text-zinc-500">
            Kantor 3D dengan analis, dompet, dan sinyal yang sedang berjalan.
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setKunci((n) => n + 1)}
            title="Muat ulang ruangan — tanpa memuat ulang aplikasi"
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
            <RotateCcw className="size-3.5" /> Muat ulang
          </button>
          {/* Dibuka di tab sendiri, bukan layar penuh lewat API: ruangan ini
              punya tombol layar penuhnya SENDIRI di pojok kanan atas, dan dua
              kendali layar penuh yang bertumpuk saling membatalkan. Yang ini
              untuk yang mau ruangannya berdiri sendiri di satu tab. */}
          <a href={RUANG} target="_blank" rel="noreferrer"
            title="Buka ruangan di tab sendiri"
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
            <Maximize2 className="size-3.5" /> Tab sendiri
          </a>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-4 pb-4 md:px-6 md:pb-6">
        <div className="h-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
          {/* `allow="fullscreen; autoplay"` — dua-duanya dipakai ruangannya:
              tombol layar penuh miliknya sendiri, dan musik latar yang
              mulai sesudah sentuhan pertama. Tanpa `autoplay` di daftar
              izin, iframe lintas-dokumen tidak pernah boleh berbunyi walau
              orangnya sudah menekan tombolnya. */}
          <iframe
            key={kunci}
            src={RUANG}
            title="Trading Floor"
            allow="fullscreen; autoplay"
            className="size-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
