import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { PenyediaAuth } from '@/lib/auth';
import { catatKunjungan } from '@/lib/admin';
import { AppShell } from '@/components/app-shell';
import HeroSection from '@/components/ui/glassmorphism-trust-hero';

/* HashRouter: GitHub Pages tidak bisa mengarahkan /dashboard ke index.html,
   jadi jalur seperti itu 404 begitu di-refresh. #/dashboard bekerja di mana
   saja tanpa konfigurasi server. */

/* ── Pemuatan malas ───────────────────────────────────────────────────────
   Hanya Beranda yang dimuat di awal. Sisanya menyusul saat rutenya dibuka.

   Ini bukan optimasi yang dicari-cari: sebelum dipecah, membuka halaman
   depan berarti mengunduh Recharts, Firestore, dan kedua belas layar
   sekaligus — 1,5 MB untuk sebuah halaman yang isinya satu hero. Orang yang
   pertama kali mendarat di situs ini belum tentu akan masuk; membuatnya
   menunggu seluruh aplikasi termuat dulu adalah cara termahal kehilangan
   mereka.

   AppShell tetap dimuat awal karena ia kerangka semua rute lain, dan
   memisahkannya cuma menambah satu kedipan tanpa menghemat apa pun. */
/* Setiap rilis mengubah nama berkas potongan (namanya berhash). Halaman yang
   SEDANG TERBUKA saat kamu deploy masih memegang daftar nama yang lama, jadi
   begitu orang itu pindah halaman, permintaannya 404 dan React melempar
   "Failed to fetch dynamically imported module" — layar putih, tanpa
   penjelasan apa pun bagi yang mengalaminya.

   Bukan kemungkinan teoretis: ini terjadi di pengujian pertama setelah build
   diganti. Penanganannya memuat ulang halaman sekali, karena index.html yang
   baru berisi daftar nama yang benar. Penanda sesi mencegahnya jadi lingkaran
   tak berujung kalau ternyata penyebabnya bukan itu. */
const KUNCI_MUAT_ULANG = 'jt.potonganUsang';

function muat<T>(impor: () => Promise<T>): Promise<T> {
  return impor().catch((e) => {
    let sudah = true;
    try { sudah = sessionStorage.getItem(KUNCI_MUAT_ULANG) === '1'; } catch { /* mode privat */ }
    if (!sudah) {
      try { sessionStorage.setItem(KUNCI_MUAT_ULANG, '1'); } catch { /* abaikan */ }

      /* `location.reload()` saja TIDAK cukup — dan ini sudah dibuktikan
         gagal saat diuji. GitHub Pages menyajikan index.html dengan
         Cache-Control, jadi muat ulang biasa mengambilnya dari cache
         peramban: daftar nama potongan yang lama kembali lagi, dan
         layarnya tetap putih.

         Menambahkan parameter yang selalu berubah membuat URL-nya berbeda,
         sehingga peramban wajib mengambil index.html yang baru. Hash-nya
         ikut dibawa supaya orangnya kembali ke halaman yang sama. */
      const u = new URL(window.location.href);
      u.searchParams.set('r', Date.now().toString(36));
      window.location.replace(u.toString());

      // Jangan pernah selesai: halaman sedang diganti, dan me-render apa pun
      // di sini cuma menampilkan kedipan sebelum dokumennya dibuang.
      return new Promise<T>(() => {});
    }
    throw e;
  });
}

const Dashboard     = lazy(() => muat(() => import('@/components/dashboard').then((m) => ({ default: m.Dashboard }))));
/* #/screener menampilkan screener V2 yang ASLI, ditanam apa adanya.
   Versi React-nya masih ada di halaman/Screener.tsx dan bisa dibuka di
   #/screener-react — berguna untuk membandingkan, dan pemindainya
   (lib/pindai.ts) tetap dipakai kalau nanti ada section yang diport. */
const Screener      = lazy(() => muat(() => import('@/halaman/ScreenerV2')));
const ScreenerReact = lazy(() => muat(() => import('@/halaman/Screener')));
const ChartBacktest = lazy(() => muat(() => import('@/halaman/Chart')));
const Jurnal        = lazy(() => muat(() => import('@/halaman/Jurnal')));
const PersonalArea  = lazy(() => muat(() => import('@/halaman/PersonalArea')));
const Marketplace   = lazy(() => muat(() => import('@/halaman/Marketplace')));
const Integrasi     = lazy(() => muat(() => import('@/halaman/Integrasi')));
const Pemilik       = lazy(() => muat(() => import('@/halaman/Pemilik')));
const Maintenance   = lazy(() => muat(() => import('@/halaman/Maintenance')));
const Billing       = lazy(() => muat(() => import('@/halaman/Billing')));
const Dokumentasi   = lazy(() => muat(() => import('@/halaman/Dokumentasi')));
const Changelog     = lazy(() => muat(() => import('@/halaman/Changelog')));
const CopyTrading   = lazy(() => muat(() => import('@/halaman/Analisa')));

/* ── Pramuat halaman lain SAAT SENGGANG ─────────────────────────────────
   Tiap halaman adalah potongan JS terpisah yang baru diunduh saat pertama
   dikunjungi — itulah jeda "pindah halaman kok lama" yang terasa, apalagi
   lewat CDN GitHub Pages. Setelah halaman pertama tenang, sisanya ditarik
   diam-diam di waktu senggang; kunjungan berikutnya tinggal membuka berkas
   yang sudah ada di cache. Kegagalan diabaikan — ini percepatan, bukan
   keharusan, dan halaman yang gagal dipramuat tetap termuat normal saat
   benar-benar dibuka. */
if (typeof window !== 'undefined') {
  const pramuat = () => {
    [
      () => import('@/components/dashboard'),
      () => import('@/halaman/Jurnal'),
      () => import('@/halaman/Chart'),
      () => import('@/halaman/ScreenerV2'),
      () => import('@/halaman/Marketplace'),
      () => import('@/halaman/Analisa'),
      () => import('@/halaman/Integrasi'),
      () => import('@/halaman/PersonalArea'),
      () => import('@/halaman/Maintenance'),
      () => import('@/halaman/Pemilik'),
    ].forEach((f, i) => setTimeout(() => { f().catch(() => { /* nanti saat dibuka */ }); }, i * 400));
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => setTimeout(pramuat, 2000), { timeout: 8000 });
  } else {
    setTimeout(pramuat, 5000);
  }
}

function KeAtas() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  /* Catat kunjungan ke backend — inilah yang mengisi grafik trafik dan
     "Halaman paling ramai" di Traffic & Sales. V2 sudah melakukannya lewat
     jt-lapor.js sejak lama; V3 belum sama sekali, jadi setiap kunjungan ke
     versi baru ini tidak pernah terhitung di mana pun.

     Dipasang di sini, bukan di tiap halaman: satu tempat berarti halaman
     yang ditambahkan besok ikut terhitung tanpa perlu diingat. */
  useEffect(() => {
    const halaman = pathname === '/' ? 'v3-beranda' : 'v3-' + pathname.replace(/^\/+/, '');
    catatKunjungan(halaman);
  }, [pathname]);

  /* Penanda dibersihkan setelah satu rute berhasil dimuat. Kalau dibiarkan,
     kegagalan berikutnya di sesi yang sama — misalnya deploy kedua di hari
     yang sama — tidak akan ditolong lagi. */
  useEffect(() => {
    const t = setTimeout(() => {
      try { sessionStorage.removeItem(KUNCI_MUAT_ULANG); } catch { /* abaikan */ }
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  return null;
}

/** Ditampilkan selama potongan rute diunduh. Sengaja hanya satu putaran kecil
 *  di tengah, bukan kerangka abu-abu: potongannya sampai dalam ratusan
 *  milidetik, dan kerangka yang berkedip lebih mengganggu daripada jeda. */
function Menunggu() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-5 animate-spin text-zinc-600" />
    </div>
  );
}

/* Beranda = hero apa adanya, tanpa sidebar — halaman depan tugasnya
   meyakinkan, bukan mengoperasikan. */
function Beranda() {
  return (
    <div className="w-full h-screen overflow-y-auto bg-zinc-950">
      <HeroSection />
    </div>
  );
}

function Kerangka() {
  return (
    <AppShell>
      <Suspense fallback={<Menunggu />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <PenyediaAuth>
      <HashRouter>
        <KeAtas />
        <Routes>
          <Route path="/" element={<Beranda />} />
          <Route element={<Kerangka />}>
            <Route path="/dashboard"   element={<Dashboard />} />
            <Route path="/screener"        element={<Screener />} />
            <Route path="/screener-react"  element={<ScreenerReact />} />
            <Route path="/chart"       element={<ChartBacktest />} />
            <Route path="/jurnal"      element={<Jurnal />} />
            <Route path="/personal"    element={<PersonalArea />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/copy"        element={<CopyTrading />} />
            <Route path="/integrasi"   element={<Integrasi />} />
            <Route path="/pemilik"     element={<Pemilik />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/tagihan"     element={<Billing />} />
            <Route path="/dokumentasi" element={<Dokumentasi />} />
            <Route path="/changelog"   element={<Changelog />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </PenyediaAuth>
  );
}
