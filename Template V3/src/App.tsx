import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { PenyediaAuth, useAuth } from '@/lib/auth';
import { modePreview } from '@/lib/preview';
import { catatKunjungan } from '@/lib/admin';
import { AppShell } from '@/components/app-shell';
import Pendaratan from '@/halaman/Pendaratan';
import Akses from '@/halaman/Akses';

/* ── BrowserRouter, sejak 17 Agu 2026 ────────────────────────────────────
   Dulu HashRouter, dengan alasan yang benar pada zamannya: situsnya
   disajikan GitHub Pages, yang tidak bisa mengarahkan /dashboard ke
   index.html, jadi alamat seperti itu 404 begitu di-refresh.

   Alasan itu sudah gugur. Situsnya sekarang dilayani Express di VPS, dan
   fallback SPA-nya sudah terpasang di sana (cari FALLBACK_SPA di server.js).

   Yang dibeli dengan pindah ini bukan kerapian. HashRouter menaruh seluruh
   rute sesudah tanda pagar, dan peramban TIDAK PERNAH mengirim bagian itu
   ke server — jadi bagi Google seluruh situs ini cuma SATU alamat. Ke-15
   halaman runtuh jadi satu, dan sitemap yang berisi lebih dari satu baris
   hanya menghasilkan laporan duplikat. Sekarang tiap halaman punya alamat
   sendiri yang bisa diindeks, dibagikan, dan muncul sendiri di hasil
   pencarian.

   TAUTAN LAMA TIDAK DIBIARKAN MATI. Dua lapis menanganinya:
     1. Cuplikan di <head> index.html menulis ulang /#/apa-pun jadi /apa-pun
        sebelum React menyala — ini yang menyelamatkan tautan Lynk sesudah
        pembayaran, yang alamatnya tersimpan di luar kendali kita.
     2. Rute `Alias` di bawah memetakan slug lama ke slug baru. */

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

/* Hero lama sekarang halaman kedua (/beranda), jadi ikut dimalaskan.
   Pintu depannya Template — lihat catatan di rute "/". */
const HeroLama      = lazy(() => muat(() => import('@/components/ui/glassmorphism-trust-hero')));
const Dashboard     = lazy(() => muat(() => import('@/components/dashboard').then((m) => ({ default: m.Dashboard }))));
/* #/screener menampilkan screener V2 yang ASLI, ditanam apa adanya.
   Versi React-nya masih ada di halaman/Screener.tsx dan bisa dibuka di
   #/screener-react — berguna untuk membandingkan, dan pemindainya
   (lib/pindai.ts) tetap dipakai kalau nanti ada section yang diport. */
const Screener      = lazy(() => muat(() => import('@/halaman/ScreenerV2')));
const ScreenerReact = lazy(() => muat(() => import('@/halaman/Screener')));
const Aktivasi      = lazy(() => muat(() => import('@/halaman/Aktivasi')));
/* PINTU DEPAN situs (rute "/"), bukan lagi halaman contoh yang berdiri
   sendiri seperti dulu.

   TETAP dimuat lazy, dan itu pilihan sadar: kalau diimpor eager, seluruh
   isinya (tur lima layar + empat peraga beranimasi) ikut masuk bundel utama
   dan ditanggung juga oleh pengguna yang sudah login — orang yang justru
   tidak pernah melihat halaman ini. Ongkosnya sekejap <Menunggu /> saat
   kunjungan pertama. Kalau kelak waktu muat pertama jadi masalah, di sinilah
   tempat menukarnya. */
const Template      = lazy(() => muat(() => import('@/halaman/Template')));
const Pratinjau     = lazy(() => muat(() => import('@/halaman/Pratinjau')));
const Preview       = lazy(() => muat(() => import('@/halaman/Preview')));
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
const HalamanHarga  = lazy(() => muat(() => import('@/halaman/Harga')));
const Markas        = lazy(() => muat(() => import('@/halaman/Markas')));
const Sosmed        = lazy(() => muat(() => import('@/halaman/Sosmed')));

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

/* ── PINTU DEPAN: dua wajah di satu alamat ──────────────────────────────
   Belum login  -> halaman jualan (Template).
   Sudah login  -> hero lama, halaman utama sebelum diubah.

   Alasannya: halaman jualan itu untuk orang yang belum kenal produknya.
   Menyodorkannya lagi ke orang yang sudah masuk sama saja menjual barang
   yang sudah dibelinya, dan bikin ia harus mencari jalan sendiri kembali
   ke tools.

   ── `memuat` WAJIB dihormati, dan ini bukan kehati-hatian berlebihan ────
   Status login Firebase tidak tersedia seketika. Kalau baris ini langsung
   memutuskan berdasarkan `pengguna` yang masih null, SETIAP pengguna yang
   sudah login akan melihat kedipan halaman jualan lebih dulu sebelum
   halamannya ditukar — persis kesan yang sedang dihindari, dan justru
   paling kelihatan di sambungan lambat karena kedipannya makin lama.

   Karena itu selama `memuat` tidak ada yang dirender kecuali penanda
   tunggu. Menebak lebih dulu lalu memperbaiki belakangan bukan pilihan di
   halaman pertama yang dilihat orang. */
function PintuDepan() {
  const { pengguna, memuat } = useAuth();
  if (memuat) return <Menunggu />;
  return pengguna ? <Beranda /> : <Template />;
}

/* Hero lama, tanpa sidebar. Sekarang dipakai DUA tempat: rute /beranda,
   dan pintu depan untuk pengguna yang sudah login (lihat PintuDepan). */
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
  const { memuat, pemilik, langganan, pengguna } = useAuth();
  const lokasi = useLocation();

  if (memuat) return <Menunggu />;
  /* `warisan` ikut membuka: akun yang sudah ada sebelum gerbang ini dipasang
     tidak pernah diminta meminta akses, jadi melemparnya ke halaman
     permintaan sama saja mengunci orang di luar rumahnya sendiri. */
  /* Server dev LOKAL membuka gerbang tanpa login — halaman di dalamnya harus
     bisa diperiksa dan diperbaiki tanpa kredensial. `import.meta.env.DEV`
     bernilai false saat build, jadi cabang ini tidak ada di bundel produksi. */
  /* MODE PREVIEW membuka kerangkanya untuk pengunjung yang BELUM MASUK.
     ────────────────────────────────────────────────────────────────────
     Syarat `!pengguna` itu bagian terpenting dari baris ini, bukan
     pelengkap: preview hanya berlaku untuk orang tanpa sesi. Yang sudah
     masuk tetap diurus gerbang seperti biasa, jadi tidak ada cara
     memakai mode ini untuk melewati akses berbayar dengan akun sendiri.

     Yang dibuka cuma TAMPILAN. Tanpa sesi, Firestore Security Rules
     menolak setiap pembacaan dan penulisan — jadi yang terlihat hanya
     data contoh yang memang sudah disiapkan untuk pengunjung. */
  const preview = modePreview() && !pengguna;
  /* ── /docs DIBUKA UNTUK PUBLIK, 21 Agu 2026 ─────────────────────────
     Dokumentasi di balik gerbang langganan itu keliru dua kali.

     Pertama: dokumentasi MENJUAL produk, ia bukan produknya. Orang yang
     mencari "cara sambungkan MT5 ke jurnal" lalu menemukan halaman ini
     adalah calon pembeli, bukan orang yang mencuri sesuatu.

     Kedua, dan ini yang terukur: sepuluh bagiannya persis pertanyaan yang
     diketik orang di Google. Diperiksa 21 Agu 2026 — situs ini cuma punya
     empat halaman yang bisa dibaca tanpa login, dan yang isinya paling
     layak dicari justru terkunci. Perayap yang membuka /docs menerima
     layar minta-akses, sama seperti pengunjung.

     Dikecualikan DI SINI, bukan dengan memindahkan rutenya keluar
     Kerangka: halamannya tetap butuh AppShell di sekelilingnya, dan rute
     yang dipindah keluar kehilangan seluruh bingkainya. */
  if (!import.meta.env.DEV && !preview && lokasi.pathname !== '/docs'
      && !(pemilik || langganan.status === 'aktif' || langganan.status === 'pratinjau')) {
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

/** Alamat lama → alamat baru. Tautan yang sudah tersebar tidak boleh mati
 *  hanya karena kita memperbaiki penamaan; `replace` dipakai supaya tombol
 *  Back tidak memantul balik ke alamat lama lalu dialihkan lagi. `search`
 *  dan `hash` ikut dibawa — tanpa itu /chart?simbol=BTCUSDT mendarat di
 *  chart kosong. */
function Alias({ ke }: { ke: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={ke + search + hash} replace />;
}

export default function App() {
  return (
    <PenyediaAuth>
      <BrowserRouter>
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
          {/* PINTU DEPAN, dua wajah — lihat PintuDepan di atas. Belum login
              dapat halaman jualan, sudah login dapat hero lama.

              DI LUAR gerbang, dan memang harus: yang mendarat di sini
              justru orang yang belum punya akses. */}
          <Route path="/" element={<PintuDepan />} />
          {/* Alamat lamanya DIPERTAHANKAN, bukan dihapus: alamat ini sudah
              dibagikan dan dipakai memeriksa hasil selama halamannya
              digarap. Menghapusnya membuat tautan yang beredar jatuh ke
              rute "*" dan terlihat seperti halamannya hilang. */}
          <Route path="/template" element={<Template />} />
          {/* Hero lama. Bukan dibuang — isinya masih utuh dan bisa dipakai
              lagi kalau dibutuhkan. */}
          <Route path="/homeuser" element={<Beranda />} />
          {/* Halaman pendaratan versi lain, tidak ditautkan dari mana pun.
              Disimpan sebagai pembanding tampilan. */}
          <Route path="/landing" element={<Pendaratan />} />
          {/* DI LUAR gerbang, dan memang harus: halaman ini justru tempat
              orang yang belum punya akses memulai pratinjaunya. */}
          <Route path="/tour" element={<Pratinjau />} />
          {/* Etalase penuh TANPA login. Di luar gerbang, dan memang harus:
              orang yang sedang menimbang produk tidak boleh disuruh
              mendaftar untuk melihat bentuk barangnya. */}
          <Route path="/preview" element={<Preview />} />
          <Route path="/akses" element={<Akses />} />
          {/* Tujuan link kiriman otomatis Lynk sesudah pembayaran. DI LUAR
              gerbang: orang yang baru membayar belum punya akses apa pun,
              jadi gerbang yang menahannya di sini akan memantulkannya ke
              halaman minta-akses — persis langkah yang sudah ia lewati. */}
          <Route path="/aktivasi" element={<Aktivasi />} />
          {/* Markas Agen SENGAJA di luar kerangka terminal — halaman
              terpisah untuk pusat kendali agen AI, bukan bagian dasbor. */}
          <Route path="/hq" element={<Penjaga><Markas /></Penjaga>} />
          {/* Legal WAJIB di luar gerbang. Orang membaca disclaimer dan
              ketentuan refund JUSTRU sebelum membayar — kalau halaman ini
              berada di dalam Kerangka, calon pembeli yang mengkliknya
              dilempar ke halaman minta-akses dan tidak pernah sampai ke
              dokumen yang sedang ia cari. Disclaimer yang hanya bisa dibaca
              orang yang sudah terlanjur membeli tidak melindungi siapa pun. */}
          <Route path="/legal" element={<Legal />} />
          <Route element={<Kerangka />}>
            <Route path="/dashboard"      element={<Dashboard />} />
            <Route path="/screener"       element={<Screener />} />
            <Route path="/screener-react" element={<ScreenerReact />} />
            <Route path="/chart-entry"    element={<ChartBacktest />} />
            <Route path="/journal"        element={<Jurnal />} />
            <Route path="/personal-area"  element={<PersonalArea />} />
            <Route path="/marketplace"    element={<Marketplace />} />
            <Route path="/copy-signal"    element={<CopyTrading />} />
            <Route path="/integrations"   element={<Integrasi />} />
            <Route path="/owner"          element={<Pemilik />} />
            <Route path="/social"         element={<Sosmed />} />
            <Route path="/maintenance"    element={<Maintenance />} />
            <Route path="/billing"        element={<Billing />} />
            {/* Daftar paket DI DALAM aplikasi. Ada karena halaman depan
                tidak bisa dipakai untuk ini: "/" merender Beranda begitu
                orangnya login, jadi tautan "/#harga" mendarat di halaman
                yang tidak punya jangkar itu — tombolnya ditekan, tidak
                terjadi apa-apa.

                Komponennya SAMA dengan yang di halaman depan, bukan salinan.
                Dua daftar harga yang harus diperbarui bersamaan adalah dua
                daftar harga yang suatu hari berbeda. */}
            <Route path="/harga"          element={<HalamanHarga />} />
            <Route path="/docs"           element={<Dokumentasi />} />
            <Route path="/changelog"      element={<Changelog />} />
          </Route>

          {/* ── ALAMAT LAMA ─────────────────────────────────────────────────
              Dipertahankan sebagai pengalih, bukan dihapus. Alamat-alamat ini
              sudah tersebar di bookmark, riwayat peramban, tangkapan layar
              tutorial, dan pesan WhatsApp — dan yang membukanya besok tidak
              akan mengira "namanya berubah", ia akan mengira situsnya rusak.

              /akses dan /aktivasi TIDAK boleh sekadar dihapus dalam keadaan
              apa pun: /aktivasi adalah tempat Lynk melempar orang SESUDAH
              mereka membayar, dan alamat itu tersimpan di setelan Lynk — di
              luar jangkauan kode ini. */}
          <Route path="/beranda"     element={<Alias ke="/homeuser" />} />
          <Route path="/pendaratan"  element={<Alias ke="/landing" />} />
          <Route path="/pratinjau"   element={<Alias ke="/tour" />} />
          <Route path="/markas"      element={<Alias ke="/hq" />} />
          <Route path="/chart"       element={<Alias ke="/chart-entry" />} />
          <Route path="/jurnal"      element={<Alias ke="/journal" />} />
          <Route path="/personal"    element={<Alias ke="/personal-area" />} />
          <Route path="/copy"        element={<Alias ke="/copy-signal" />} />
          <Route path="/integrasi"   element={<Alias ke="/integrations" />} />
          <Route path="/pemilik"     element={<Alias ke="/owner" />} />
          <Route path="/sosmed"      element={<Alias ke="/social" />} />
          <Route path="/tagihan"     element={<Alias ke="/billing" />} />
          <Route path="/dokumentasi" element={<Alias ke="/docs" />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </PenyediaAuth>
  );
}
