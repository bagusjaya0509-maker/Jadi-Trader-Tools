import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import {
  LayoutGrid, BarChart3, Briefcase, Users, Plug, CandlestickChart,
  Wallet, TrendingUp, Wrench, CreditCard, LifeBuoy, BookOpen,
  PanelLeft, Bell, Mail, X, Sparkles, MessageCircle, Send, AtSign,
  AlertTriangle, Newspaper, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { MenuPengguna, PitaLangganan } from '@/components/gerbang';
import { NEWS, PESAN, CHANGELOG } from '@/data/notifikasi';
import { LogoJT } from '@/components/logo-jt';
import { usePermintaanLisensi } from '@/lib/admin';

/* ════════════════════════════════════════════════════════════════════════
   APP SHELL — rekonstruksi Efferd Dashboard 2
   ════════════════════════════════════════════════════════════════════════
   Kode Efferd yang diberikan hanya pembungkusnya; isi app-shell dan
   dashboard tidak disertakan, jadi berkas ini dibangun ulang dari tangkapan
   layar. Kalau nanti sumber aslinya didapat, berkas ini yang perlu ditimpa.
   ════════════════════════════════════════════════════════════════════════ */

const NAV = [
  {
    grup: 'Trading',
    butir: [
      { ke: '/dashboard', label: 'Dashboard',     Ikon: LayoutGrid },
      { ke: '/screener',  label: 'Screener Entry', Ikon: BarChart3 },
      { ke: '/jurnal',    label: 'Journal',        Ikon: Briefcase },
    ],
  },
  {
    grup: 'Workspace',
    butir: [
      { ke: '/personal',    label: 'Personal Area',    Ikon: Wallet },
      { ke: '/chart',       label: 'Chart & Backtest', Ikon: CandlestickChart },
      { ke: '/marketplace', label: 'Marketplace',      Ikon: Users },
      { ke: '/integrasi',   label: 'Integrations',     Ikon: Plug },
    ],
  },
  {
    grup: 'Administration',
    butir: [
      { ke: '/pemilik',     label: 'Traffic & Sales', Ikon: TrendingUp },
      { ke: '/maintenance', label: 'Maintenance',     Ikon: Wrench },
      { ke: '/tagihan',     label: 'Billing',         Ikon: CreditCard },
    ],
  },
];

const JUDUL: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/screener': 'Screener Entry',
  '/screener-react': 'Screener Entry (React)',
  '/chart': 'Chart & Backtest',
  '/jurnal': 'Journal',
  '/personal': 'Personal Area',
  '/marketplace': 'Marketplace',
  '/integrasi': 'Integrations',
  '/pemilik': 'Traffic & Sales',
  '/maintenance': 'Maintenance',
  '/tagihan': 'Billing',
  '/dokumentasi': 'Documentation',
  '/changelog': 'Changelog',
};

/** Menutup panel saat diklik di luar. Dipakai tiga dropdown di bilah atas —
 *  tanpa ini, panel tetap menggantung dan menutupi isi halaman. */
function usePenutupLuar<T extends HTMLElement>(saatTutup: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const klik = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) saatTutup();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') saatTutup(); };
    document.addEventListener('mousedown', klik);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', klik);
      document.removeEventListener('keydown', esc);
    };
  }, [saatTutup]);
  return ref;
}

/* ── Penanda sudah dibaca ────────────────────────────────────────────────
   Lencana merah yang tidak pernah hilang berhenti berarti apa-apa: setelah
   dua hari orang tidak lagi bisa membedakan "ada yang baru" dari "ikon ini
   memang begitu".

   Disimpan di localStorage, bukan Firestore. Yang dicatat adalah SUDAH
   DIBACA DI PERANGKAT INI — dan itu memang milik perangkatnya; membuka di
   ponsel tidak seharusnya menandai apa yang dilihat di laptop sebagai sudah
   dibaca oleh orang yang berbeda.

   Yang disimpan penanda tiap butir, bukan cuma jumlahnya: kalau cuma
   jumlahnya, satu berita baru yang masuk akan langsung terhitung sudah
   dibaca karena totalnya kebetulan sama. */
function useSudahDibaca(kunci: string, id: string[]) {
  const [dibaca, setDibaca] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(kunci) ?? '[]')); }
    catch { return new Set(); }
  });

  const tandai = () => {
    const baru = new Set([...dibaca, ...id]);
    setDibaca(baru);
    try { localStorage.setItem(kunci, JSON.stringify([...baru])); } catch { /* mode privat */ }
  };

  const belum = id.filter((x) => !dibaca.has(x)).length;
  return { belum, tandai };
}

function Lonceng() {
  const [buka, setBuka] = useState(false);
  const ref = usePenutupLuar<HTMLDivElement>(() => setBuka(false));
  const { belum, tandai } = useSudahDibaca(
    'jt.newsDibaca',
    NEWS.filter((n) => n.baru).map((n) => n.judul)
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setBuka((v) => !v); tandai(); }}
        aria-label="Berita pasar"
        className="relative cursor-pointer text-zinc-400 transition-colors hover:text-zinc-100"
      >
        <Bell className="size-[18px]" strokeWidth={1.8} />
        {belum > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-zinc-950">
            {belum}
          </span>
        )}
      </button>

      {buka && (
        <div className="absolute right-0 top-9 z-50 w-[340px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <Newspaper className="size-4 text-zinc-400" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-zinc-100">Berita Pasar</span>
            <span className="ml-auto text-[11px] text-zinc-600">{belum} baru</span>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {NEWS.map((n) => (
              <div key={n.id} className={cn('border-b border-zinc-800/50 px-4 py-3 last:border-0', n.baru && 'bg-zinc-900/40')}>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'rounded px-1.5 py-0.5 text-[9.5px] font-medium uppercase',
                    n.dampak === 'tinggi' ? 'bg-red-500/15 text-red-400'
                      : n.dampak === 'sedang' ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-zinc-700/30 text-zinc-400'
                  )}>
                    {n.dampak}
                  </span>
                  <span className="angka text-[11px] text-zinc-500">{n.mata}</span>
                  <span className="ml-auto text-[11px] text-zinc-600">{n.waktu}</span>
                </div>
                <div className="mt-1.5 text-[12.5px] text-zinc-200">{n.judul}</div>
                {n.detail && <div className="mt-0.5 text-[11.5px] text-zinc-500">{n.detail}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Pesan() {
  const [buka, setBuka] = useState(false);
  const ref = usePenutupLuar<HTMLDivElement>(() => setBuka(false));
  const { belum, tandai } = useSudahDibaca(
    'jt.pesanDibaca',
    PESAN.filter((p) => p.baru).map((p) => p.judul)
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setBuka((v) => !v); tandai(); }}
        aria-label="Pemberitahuan"
        className="relative cursor-pointer text-zinc-400 transition-colors hover:text-zinc-100"
      >
        <Mail className="size-[18px]" strokeWidth={1.8} />
        {belum > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {belum}
          </span>
        )}
      </button>

      {buka && (
        <div className="absolute right-0 top-9 z-50 w-[340px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <Mail className="size-4 text-zinc-400" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-zinc-100">Pemberitahuan</span>
            <span className="ml-auto text-[11px] text-zinc-600">{belum} belum dibaca</span>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {PESAN.map((p) => (
              <div key={p.id} className={cn('flex gap-3 border-b border-zinc-800/50 px-4 py-3 last:border-0', p.baru && 'bg-zinc-900/40')}>
                <div className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                  p.jenis === 'peringatan' ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-800 text-zinc-400'
                )}>
                  {p.jenis === 'peringatan'
                    ? <AlertTriangle className="size-3.5" strokeWidth={2} />
                    : <Sparkles className="size-3.5" strokeWidth={2} />}
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] text-zinc-200">{p.judul}</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">{p.isi}</div>
                  {p.aksi && (
                    <Link to={p.aksiKe ?? '#'} onClick={() => setBuka(false)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-zinc-300 hover:text-zinc-100">
                      {p.aksi} <ChevronRight className="size-3" />
                    </Link>
                  )}
                  <div className="mt-1 text-[11px] text-zinc-600">{p.waktu}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Bantuan({ ciut }: { ciut: boolean }) {
  const [buka, setBuka] = useState(false);
  const ref = usePenutupLuar<HTMLDivElement>(() => setBuka(false));

  /* Help Center langsung mengarah ke saluran yang benar-benar dijawab
     manusia. Halaman "pusat bantuan" berisi artikel adalah tugas
     Documentation — mencampur keduanya membuat orang yang butuh jawaban
     cepat malah tersesat di daftar artikel. */
  const SALURAN = [
    { Ikon: MessageCircle, label: 'WhatsApp', ket: 'Balasan tercepat', href: 'https://wa.me/6281234567890', warna: 'text-emerald-400' },
    { Ikon: Send, label: 'Discord', ket: 'Diskusi & komunitas', href: '#', warna: 'text-indigo-400' },
    { Ikon: AtSign, label: 'Email', ket: 'bagusjaya0509@gmail.com', href: 'mailto:bagusjaya0509@gmail.com', warna: 'text-zinc-400' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setBuka((v) => !v)}
        title={ciut ? 'Help Center' : undefined}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100',
          ciut && 'justify-center px-0'
        )}
      >
        <LifeBuoy className="size-4 shrink-0" strokeWidth={1.8} />
        {!ciut && <span>Help Center</span>}
      </button>

      {buka && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[268px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="border-b border-zinc-800 px-4 py-2.5 text-[12.5px] font-medium text-zinc-100">
            Butuh bantuan?
          </div>
          {SALURAN.map(({ Ikon, label, ket, href, warna }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 border-b border-zinc-800/50 px-4 py-3 transition-colors last:border-0 hover:bg-zinc-900">
              <Ikon className={cn('size-4 shrink-0', warna)} strokeWidth={1.8} />
              <div className="min-w-0">
                <div className="text-[12.5px] text-zinc-200">{label}</div>
                <div className="truncate text-[11px] text-zinc-500">{ket}</div>
              </div>
              <ChevronRight className="ml-auto size-3.5 shrink-0 text-zinc-600" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* Popup berita di halaman portofolio.
 *
 *  Lonceng memindahkan berita ke dalam dropdown, dan itu perbaikan — tapi
 *  dropdown hanya terbuka kalau seseorang menyadari ada yang perlu dibuka.
 *  Personal Area adalah halaman yang paling lama dipandangi tanpa diklik,
 *  jadi di sinilah berita berdampak tinggi harus datang sendiri.
 *
 *  Hanya dampak TINGGI yang muncul, dan hanya sekali per sesi peramban.
 *  Toast yang muncul tiap kali pindah halaman berhenti dibaca dalam sehari. */
function PopupNews() {
  const { pathname } = useLocation();
  const [tampil, setTampil] = useState(false);
  const penting = NEWS.filter((n) => n.dampak === 'tinggi');

  useEffect(() => {
    /* Halaman screener, BUKAN Personal Area. Berita berdampak tinggi berguna
       tepat saat orang sedang mencari entry — di halaman catatan kekayaan
       pribadi ia cuma menutupi isi yang sedang dibaca. */
    if (pathname !== '/screener' || penting.length === 0) return;
    let sudah = false;
    try { sudah = sessionStorage.getItem('jt.newsPopup') === '1'; } catch { /* mode privat */ }
    if (sudah) return;
    const t = setTimeout(() => {
      setTampil(true);
      try { sessionStorage.setItem('jt.newsPopup', '1'); } catch { /* abaikan */ }
    }, 700);
    return () => clearTimeout(t);
  }, [pathname, penting.length]);

  if (!tampil) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-[60] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-amber-500/30 bg-zinc-950 shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
        <Newspaper className="size-3.5 text-amber-400" strokeWidth={2} />
        <span className="text-[12.5px] font-medium text-zinc-100">Berita berdampak tinggi</span>
        <button onClick={() => setTampil(false)} aria-label="Tutup"
          className="ml-auto cursor-pointer text-zinc-600 transition-colors hover:text-zinc-300">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        {penting.map((n) => (
          <div key={n.id} className="border-b border-zinc-800/50 px-4 py-3 last:border-0">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="angka text-zinc-500">{n.mata}</span>
              <span className="ml-auto text-zinc-600">{n.waktu}</span>
            </div>
            <div className="mt-1 text-[12.5px] text-zinc-200">{n.judul}</div>
            {n.detail && <div className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">{n.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [laci, setLaci] = useState(false);
  const [ciut, setCiut] = useState(false);
  const { pathname } = useLocation();
  const { pemilik } = useAuth();
  const judul = JUDUL[pathname] ?? 'Dashboard';
  /* Ikon halaman diambil dari tabel NAV yang sama dengan sidebar, jadi
     keduanya tidak bisa berbeda. Menyimpan daftar ikon kedua di sini akan
     berselisih dengan sidebar pada penambahan menu berikutnya. */
  const IkonHalaman = NAV.flatMap((g) => g.butir).find((b) => b.ke === pathname)?.Ikon ?? LayoutGrid;

  /* Permintaan lisensi yang belum diputus. Hanya ditanyakan kalau yang login
     memang pemilik — rutenya butuh App Token, dan memanggilnya untuk semua
     orang berarti satu permintaan gagal di tiap halaman untuk semua
     pengunjung. */
  const { data: permintaan } = usePermintaanLisensi();
  const lisensiBaru = pemilik ? permintaan.filter((x) => x.status === 'baru').length : 0;

  /* Lebar >= 768px dilacak di JS karena posisi sidebar diatur inline —
     media query CSS tidak bisa menyentuh inline style. */
  const [lebarMd, setLebarMd] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const ubah = (e: MediaQueryListEvent | MediaQueryList) => setLebarMd(e.matches);
    ubah(mq);
    mq.addEventListener('change', ubah);
    return () => mq.removeEventListener('change', ubah);
  }, []);

  const terbaru = CHANGELOG[0];

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <div
        onClick={() => setLaci(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden',
          laci ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      {/* Laci memakai inline style, bukan -translate-x-full: Tailwind v4 punya
          shim `*{--tw-translate-x:0}` di blok @supports yang bisa mengalahkan
          utility itu, dan lacinya tidak pernah menutup di HP. */}
      <aside
        style={{ transform: laci || lebarMd ? 'translateX(0)' : 'translateX(-100%)' }}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-zinc-800/80 bg-zinc-950',
          'transition-transform duration-200 md:sticky md:top-0 md:h-screen',
          ciut && 'md:w-[68px]'
        )}
      >
        <div className="flex h-14 items-center gap-2.5 px-4">
          {/* Merek mengarah ke beranda. Logo yang tidak bisa diklik adalah
              salah satu hal pertama yang dicoba orang saat ingin keluar dari
              sebuah aplikasi — dan tidak terjadi apa-apa selalu terbaca
              sebagai rusak. `to="/"` bukan `href`: HashRouter menangani ini
              tanpa memuat ulang seluruh aplikasi. */}
          <Link to="/" title="Ke halaman depan"
                className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80">
            <LogoJT className="size-[19px] shrink-0 text-zinc-100" />
            {!ciut && (
              <span className="truncate font-semibold tracking-tight">
                Jadi Trader <span className="text-zinc-500">Tools</span>
              </span>
            )}
          </Link>
          <button onClick={() => setLaci(false)} aria-label="Tutup menu"
            className="ml-auto cursor-pointer text-zinc-500 hover:text-zinc-100 md:hidden">
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {/* Administration disembunyikan dari yang bukan pemilik. Ini murni
              kerapian tampilan — halamannya sendiri dijaga Security Rules,
              yang memakai uid yang sama. Menu tersembunyi tidak pernah jadi
              pengamanan; siapa pun bisa mengetik #/pemilik. */}
          {NAV.filter((g) => g.grup !== 'Administration' || pemilik).map((g) => (
            <div key={g.grup} className="mb-5">
              {!ciut && <div className="px-2 pb-2 text-[11px] font-medium text-zinc-500">{g.grup}</div>}
              {g.butir.map(({ ke, label, Ikon }) => (
                <NavLink key={ke} to={ke} onClick={() => setLaci(false)} title={ciut ? label : undefined}
                  className={({ isActive }) => cn(
                    'mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] transition-colors',
                    ciut && 'justify-center px-0',
                    isActive ? 'bg-zinc-800/70 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                  )}
                >
                  {/* Lencana merah di pojok kiri-atas ikon, bukan di ujung
                      kanan baris: saat sidebar diciutkan yang tersisa hanya
                      ikonnya, dan lencana yang menempel pada baris akan ikut
                      hilang justru ketika ia paling dibutuhkan. */}
                  <span className="relative shrink-0">
                    <Ikon className="size-4" strokeWidth={1.8} />
                    {ke === '/maintenance' && lisensiBaru > 0 && (
                      <span className="absolute -left-1.5 -top-1 flex min-w-[15px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold leading-[15px] text-white">
                        {lisensiBaru > 9 ? '9+' : lisensiBaru}
                      </span>
                    )}
                  </span>
                  {!ciut && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Changelog: berisi pembaruan web yang benar-benar menarik, dan
            "Learn more" membuka laporan lengkap fitur terbaru. */}
        {!ciut && (
          <Link to="/changelog"
            className="mx-3 mb-3 block rounded-lg border border-zinc-800/80 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900/40">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3 text-amber-400" strokeWidth={2} />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Baru · {terbaru.versi}
              </span>
            </div>
            <div className="mt-1.5 text-[13px] font-medium text-zinc-100">{terbaru.judul}</div>
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">{terbaru.ringkas}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[12px] text-zinc-300">
              Learn more <ChevronRight className="size-3" />
            </span>
          </Link>
        )}

        <div className="border-t border-zinc-800/80 px-3 py-2">
          <Bantuan ciut={ciut} />
          <NavLink to="/dokumentasi" title={ciut ? 'Documentation' : undefined}
            className={({ isActive }) => cn(
              'flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] transition-colors hover:bg-zinc-900 hover:text-zinc-100',
              ciut && 'justify-center px-0',
              isActive ? 'text-zinc-100' : 'text-zinc-400'
            )}
          >
            <BookOpen className="size-4 shrink-0" strokeWidth={1.8} />
            {!ciut && <span>Documentation</span>}
          </NavLink>
          {!ciut && <div className="px-2 pb-1 pt-3 text-[11px] text-zinc-600">© 2026 Jadi Trader Tools</div>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/85 px-4 backdrop-blur">
          <button onClick={() => setLaci(true)} aria-label="Buka menu"
            className="cursor-pointer text-zinc-400 hover:text-zinc-100 md:hidden">
            <PanelLeft className="size-[18px]" />
          </button>
          <button onClick={() => setCiut((v) => !v)} aria-label="Ciutkan sidebar"
            className="hidden cursor-pointer text-zinc-400 hover:text-zinc-100 md:block">
            <PanelLeft className="size-[18px]" />
          </button>

          <div className="flex items-center gap-2">
            {/* Ikonnya mengikuti halaman yang sedang dibuka, bukan LayoutGrid
                untuk semuanya. Ikon yang tidak pernah berubah bukan penanda —
                ia cuma hiasan yang membuat setiap halaman terlihat seperti
                Dashboard. */}
            <IkonHalaman className="size-4 text-zinc-400" strokeWidth={1.8} />
            <span className="text-[13px] font-medium">{judul}</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Pesan />
            <Lonceng />
            <MenuPengguna />
          </div>
        </header>

        <PitaLangganan />

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <PopupNews />
    </div>
  );
}
