import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { PenyediaAuth, useAuth } from '@/lib/auth';
import { catatKunjungan } from '@/lib/admin';
import { AppShell } from '@/components/app-shell';
import Pendaratan from '@/halaman/Pendaratan';
import Akses from '@/halaman/Akses';

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

/* Hero lama sekarang halaman kedua, jadi ikut dimalaskan. Yang dimuat di
   awal cuma Pendaratan — halaman yang benar-benar dilihat orang lebih
   dulu. */
const HeroLama      = lazy(() => muat(() => import('@/components/ui/glassmorphism-trust-hero')));
const Dashboard     = lazy(() => muat(() => import('@/components/dashboard').then((m) => ({ default: m.Dashboard }))));
/* #/screener menampilkan screener V2 yang ASLI, ditanam apa adanya.
   Versi React-nya masih ada di halaman/Screener.tsx dan bisa dibuka di
   #/screener-react — berguna untuk membandingkan, dan pemindainya
   (lib/pindai.ts) tetap dipakai kalau nanti ada section yang diport. */
const Screener      = lazy(() => muat(() => import('@/halaman/ScreenerV2')));
const ScreenerReact = lazy(() => muat(() => import('@/halaman/Screener')));
const Aktivasi      = lazy(() => muat(() => import('@/halaman/Aktivasi')));
/* Halaman contoh template, berdiri sendiri — tidak ditautkan dari mana pun
   dan tidak memuat sepotong pun isi situs ini. Dimuat lazy supaya berkas
   dan gambar CDN-nya tidak ikut membebani jalur muat awal. */
const Template      = lazy(() => muat(() => import('@/halaman/Template')));
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
const Legal         = lazy(() => muat(() => import('@/halaman/Legal')));
const CopyTrading   = lazy(() => muat(() => import('@/halaman/Analisa')));
const Markas        = lazy(() => muat(() => import('@/halaman/Markas')));

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

/* Hero lama, tanpa sidebar. Dipindah dari "/" ke "/beranda" saat halaman
   Pendaratan mengambil alih pintu depan: isinya masih dipakai (tombol View
   Portfolio & Open Chart), dan menghapusnya cuma membuang sesuatu yang
   sudah jadi tanpa alasan. */
function Beranda() {
  return (
    <div className="w-full h-screen overflow-y-auto bg-zinc-950">
      <Suspense fallback={<Menunggu />}>
        <HeroLama />
      </Suspense>
    </div>
  );
}

/* ── Gerbang akses ───────────────────────────────────────────────────────
   Seluruh aplikasi ada di balik kerangka ini, jadi menjaganya di satu tempat
   menjaga semuanya sekaligus. Menempelkan pemeriksaan di tiap tombol berarti
   tombol yang lupa dipasangi diam-diam jadi pintu belakang — dan alamat
   halamannya tetap bisa diketik langsung.

   Yang membuka pintu HANYA `bayarSampai` di masa depan, yang cuma ditulis
   server saat kamu menyetujui permintaan. Masa coba 30 hari otomatis TIDAK
   lagi memberi akses: kalau ia masih berlaku, siapa pun yang login langsung
   masuk tanpa persetujuan, dan batas 20 orang itu tidak berarti apa-apa. */
/** Satu-satunya tempat yang memutuskan boleh-tidaknya masuk. Dipakai
 *  Kerangka DAN halaman di luar kerangka, supaya tidak ada dua definisi
 *  "punya akses" yang bisa berselisih diam-diam. */
function usePenjaga() {
  const { memuat, pemilik, langganan } = useAuth();
  const lokasi = useLocation();
  /* Lisensi aktif, ATAU pratinjau 24 jam yang belum habis.
     ────────────────────────────────────────────────────────────────────
     Masa coba 30 hari dicabut 13 Agu 2026 karena bocor: siapa pun yang
     login sekali punya akses sebulan, jadi gerbang persetujuan tidak
     berarti apa-apa. Pratinjau ini SENGAJA jauh lebih pendek — cukup
     untuk melihat seluruh isinya sekali duduk, terlalu pendek untuk
     dipakai bekerja, jadi orang yang serius tetap harus meminta akses.

     `warisan` TETAP tidak membuka gerbang. Penanda itu cuma menyatakan
     "akun lama", dan membiarkannya membuka pintu berarti setiap akun yang
     dibuat sebelum 13 Agu punya akses permanen tanpa pernah disetujui. */
  const boleh = pemilik || langganan.status === 'aktif' || langganan.status === 'pratinjau';
  const keAkses = <Navigate to={`/akses?dari=${encodeURIComponent(lokasi.pathname)}`} replace />;
  return { memuat, boleh, keAkses };
}

/** Pembungkus untuk halaman yang TIDAK memakai AppShell — Markas Agen.
 *  Sebelumnya ia berada di luar Kerangka dan karena itu terbuka untuk siapa
 *  saja: cukup mengetik #/markas dan pusat kendali agennya terbuka tanpa
 *  persetujuan apa pun. Rute di luar gerbang adalah pintu belakang, seberapa
 *  pun tidak sengajanya. */
function Penjaga({ children }: { children: ReactNode }) {
  const { memuat, boleh, keAkses } = usePenjaga();
  if (memuat) return <Menunggu />;
  if (!boleh) return keAkses;
  return <>{children}</>;
}

function Kerangka() {
  const { memuat, pemilik, langganan } = useAuth();
  const lokasi = useLocation();

  if (memuat) return <Menunggu />;
  /* `warisan` ikut membuka: akun yang sudah ada sebelum gerbang ini dipasang
     tidak pernah diminta meminta akses, jadi melemparnya ke halaman
     permintaan sama saja mengunci orang di luar rumahnya sendiri. */
  /* Server dev LOKAL membuka gerbang tanpa login — halaman di dalamnya harus
     bisa diperiksa dan diperbaiki tanpa kredensial. `import.meta.env.DEV`
     bernilai false saat build, jadi cabang ini tidak ada di bundel produksi. */
  if (!import.meta.env.DEV && !(pemilik || langganan.status === 'aktif' || langganan.status === 'pratinjau')) {
    return <Navigate to={`/akses?dari=${encodeURIComponent(lokasi.pathname)}`} replace />;
  }
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
        {/* SATU Suspense membungkus SELURUH Routes.
            Sebelumnya Suspense hanya ada di dalam Kerangka, jadi setiap rute
            malas DI LUAR gerbang melempar "A component suspended while
            responding to synchronous input" dan halamannya kosong. Ditemukan
            saat menambah /legal, lalu terbukti bukan bug baru: /aktivasi
            mengalaminya juga — dan itu halaman tempat pembeli MENDARAT
            sesudah membayar lewat Lynk. Orang yang baru saja mengirim uang
            melihat layar kosong, dan tidak ada satu pun galat yang muncul
            di sisi kita.

            Ditaruh di sini, bukan ditambal satu per satu di tiap rute: rute
            yang ditambahkan besok ikut terlindungi tanpa perlu diingat. */}
        <Suspense fallback={<Menunggu />}>
        <Routes>
          <Route path="/" element={<Beranda />} />
          {/* DITUNDA. Halaman pendaratan sudah jadi tapi BELUM jadi pintu
              depan — pemiliknya ingin alurnya dulu yang benar: belum masuk
              lihat halaman ini, sudah masuk langsung ke tools, dan klik logo
              tidak menariknya keluar dari tools. Sampai itu dirancang, ia
              hidup di alamat sendiri supaya bisa dilihat tanpa mengganggu
              siapa pun. */}
          <Route path="/pendaratan" element={<Pendaratan />} />
          <Route path="/template" element={<Template />} />
          <Route path="/akses" element={<Akses />} />
          {/* Tujuan link kiriman otomatis Lynk sesudah pembayaran. DI LUAR
              gerbang: orang yang baru membayar belum punya akses apa pun,
              jadi gerbang yang menahannya di sini akan memantulkannya ke
              halaman minta-akses — persis langkah yang sudah ia lewati. */}
          <Route path="/aktivasi" element={<Aktivasi />} />
          {/* Markas Agen SENGAJA di luar kerangka terminal — halaman
              terpisah untuk pusat kendali agen AI, bukan bagian dasbor. */}
          <Route path="/markas" element={<Penjaga><Markas /></Penjaga>} />
          {/* Legal WAJIB di luar gerbang. Orang membaca disclaimer dan
              ketentuan refund JUSTRU sebelum membayar — kalau halaman ini
              berada di dalam Kerangka, calon pembeli yang mengkliknya
              dilempar ke halaman minta-akses dan tidak pernah sampai ke
              dokumen yang sedang ia cari. Disclaimer yang hanya bisa dibaca
              orang yang sudah terlanjur membeli tidak melindungi siapa pun. */}
          <Route path="/legal" element={<Legal />} />
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
        </Suspense>
      </HashRouter>
    </PenyediaAuth>
  );
}
