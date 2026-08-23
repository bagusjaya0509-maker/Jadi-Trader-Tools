import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, BarChart3, Briefcase, Users, Plug, CandlestickChart,
  Wallet, TrendingUp, Wrench, CreditCard, LifeBuoy, BookOpen,
  PanelLeft, Bell, Mail, X, Sparkles, MessageCircle, Send, AtSign,
  AlertTriangle, Newspaper, ChevronRight, ChevronDown, Copy, Radar, UserCircle2, Crown,
  Sun, Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch-button';
import { MultiChart } from '@/components/multi-chart';
import { POLOS, dengarBus } from '@/lib/multi-chart';
import { BADAN, WA_LINK } from '@/lib/badan';
import { useAuth } from '@/lib/auth';
import { useKabarAgen, umurKabar } from '@/lib/kabar';
import { useKabarPribadi } from '@/lib/kabar-pribadi';
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

/* ── Kartu "Baru · vX.Y" ─────────────────────────────────────────────────
   Meluncur keluar dari garis pembatas Help Center saat sidebar dibuka,
   terpampang penuh beberapa detik, lalu MELIPAT sendiri hingga tersisa
   baris judulnya saja — kartu promo boleh menyapa, tidak boleh menginap.
   Diklik saat terlipat: terbuka penuh lagi (lalu melipat lagi sendiri);
   saat terbuka, kliknya adalah tautan ke changelog seperti biasa. */
function KartuBaru({ versi, judul, ringkas }: { versi: string; judul: string; ringkas: string }) {
  const [buka, setBuka] = useState(true);
  const [sembunyi, setSembunyi] = useState(false);
  useEffect(() => {
    if (!buka) return;
    const jeda = setTimeout(() => setBuka(false), 7000);
    return () => clearTimeout(jeda);
  }, [buka]);

  /* DI HP IA BENAR-BENAR HILANG, bukan cuma menyusut jadi baris judul.
     Di layar lebar sidebar-nya menetap dan baris "Baru - versi" itu murah:
     ia menempati ruang yang memang kosong. Di HP sidebar adalah laci yang
     digulir, dan baris itu duduk persis di antara menu terakhir dan Help
     Center — jadi tiap kali orang menggulir mencari menu, ia menabrak kartu
     promo yang urusannya sudah selesai.

     Ditunda 500 ms supaya melipatnya sempat terlihat: menghilang seketika
     terbaca seperti ada yang error, sedangkan menyusut lalu hilang terbaca
     sebagai sesuatu yang memang sudah selesai.

     Tidak bisa dibuka lagi di HP, dan itu memang yang diminta — isinya
     tetap ada di halaman Changelog, satu ketukan dari mana saja. */
  useEffect(() => {
    if (buka || sembunyi || window.innerWidth >= 768) return;
    const jeda = setTimeout(() => setSembunyi(true), 500);
    return () => clearTimeout(jeda);
  }, [buka, sembunyi]);

  if (sembunyi) return null;

  return (
    <Link to="/changelog"
      onClick={(e) => { if (!buka) { e.preventDefault(); setBuka(true); } }}
      className="animasi-kartu-baru mx-3 mb-3 block overflow-hidden rounded-lg border border-zinc-800/80 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900/40">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3 text-amber-400" strokeWidth={2} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Baru · {versi}
        </span>
        <ChevronRight className={cn('ml-auto size-3 text-zinc-600 transition-transform duration-300', buka && 'rotate-90')} />
      </div>
      {/* grid-rows 1fr/0fr: satu-satunya cara menganimasikan tinggi konten
          yang tidak diketahui tanpa menebak max-height. */}
      <div className={cn('grid transition-all duration-500 ease-in-out',
        buka ? 'mt-1.5 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0')}>
        <div className="min-h-0 overflow-hidden">
          <div className="text-[13px] font-medium text-zinc-100">{judul}</div>
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">{ringkas}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-[12px] text-zinc-300">
            Learn more <ChevronRight className="size-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

const NAV = [
  {
    grup: 'Trading',
    butir: [
      { ke: '/dashboard', label: 'Dashboard',     Ikon: LayoutGrid },
      { ke: '/screener',  label: 'Screener Area', Ikon: BarChart3 },
      { ke: '/journal',    label: 'Journal',        Ikon: Briefcase },
    ],
  },
  {
    grup: 'Workspace',
    butir: [
      { ke: '/personal-area',    label: 'Personal Area',    Ikon: Wallet },
      { ke: '/chart-entry',       label: 'Chart & Entry', Ikon: CandlestickChart },
      { ke: '/marketplace', label: 'Marketplace',      Ikon: Users },
      /* `sub` membuat menu ini bisa dibuka dengan panah: sub-halamannya
         terlihat dari sidebar tanpa harus mendarat dulu di halamannya.
         Alamat sub memakai query (?sub=…) yang dibaca halamannya sendiri —
         tab yang tidak bisa dituju lewat alamat tidak bisa ditaut siapa pun. */
      { ke: '/copy-signal',        label: 'Copy Signal',      Ikon: Copy,
        sub: [
          { ke: '/copy-signal',             label: 'Market Signal' },
          { ke: '/copy-signal?sub=posting', label: 'Posting Signal' },
        ] },
      { ke: '/integrations',   label: 'Integrations',     Ikon: Plug,
        sub: [
          { ke: '/integrations',             label: 'Connection' },
          { ke: '/integrations?tab=mt5',     label: 'Tutorial Pasang MT5' },
          { ke: '/integrations?tab=binance', label: 'Tutorial Connect Binance' },
        ] },
    ],
  },
  {
    /* Administration = urusan AKUN SENDIRI, terlihat semua orang.
       Billing DIPARKIR, bukan dihapus: rutenya tetap hidup supaya tautan
       lama tidak mati dan halamannya siap dinyalakan begitu pembayaran
       tersambung. Penanda "beta"-nya ada DI DALAM halaman (pita
       maintenance di puncaknya), bukan di sidebar — satu peringatan di
       satu tempat; lencana di menu cuma mengulanginya. */
    grup: 'Administration',
    butir: [
      { ke: '/billing',     label: 'Billing',          Ikon: CreditCard },
    ],
  },
  {
    /* Business = alat PEMILIK, disembunyikan dari yang lain.
       ──────────────────────────────────────────────────────────────────
       Dulu grup ini bernama "Administration" dan menampung Billing juga —
       dua hal yang sama sekali berbeda: Sales Report melihat penjualan
       SEMUA orang, Billing melihat tagihan SATU orang. Nama yang sama
       untuk keduanya membuat batas itu kabur persis di tempat yang paling
       tidak boleh kabur.

       Sempat bernama "Owner Page", lalu diganti: "Page" itu tunggal
       padahal grupnya memuat dua halaman, dan tidak ada nama grup lain
       yang memakai kata itu — Trading, Workspace, Administration semuanya
       kategori. "Business" sejajar dengan mereka dan jujur soal isinya
       (penjualan + pemeliharaan produk = urusan usaha), sekaligus tetap
       terbaca wajar kalau suatu saat ada admin selain pemiliknya.

       Mahkotanya sama dengan penanda premium di Marketplace — satu
       lambang, satu arti, di seluruh aplikasi. */
    grup: 'Business',
    hanyaPemilik: true,
    IkonGrup: Crown,
    butir: [
      { ke: '/owner',     label: 'Sales Report', Ikon: TrendingUp },
      { ke: '/maintenance', label: 'Maintenance',     Ikon: Wrench,
        sub: [
          { ke: '/maintenance',             label: 'Akses & Lisensi' },
          { ke: '/maintenance?tab=produk',  label: 'Katalog Produk' },
          { ke: '/maintenance?tab=sistem',  label: 'Kesehatan Sistem' },
          { ke: '/maintenance?tab=langganan', label: 'Langganan & Lisensi' },
          { ke: '/maintenance?tab=trafik',  label: 'Trafik & Server' },
          { ke: '/maintenance?tab=pine',    label: 'Mesin Pine' },
          { ke: '/maintenance?tab=konten',  label: 'Situs & Konten' },
        ] },
    ],
  },
];

const JUDUL: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/screener': 'Screener Area',
  '/screener-react': 'Screener Area (React)',
  '/chart-entry': 'Chart & Entry',
  '/journal': 'Journal',
  '/personal-area': 'Personal Area',
  '/copy-signal': 'Copy Signal',
  '/marketplace': 'Marketplace',
  '/integrations': 'Integrations',
  '/owner': 'Sales Report',
  '/maintenance': 'Maintenance',
  '/billing': 'Billing',
  '/docs': 'Documentation',
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

/* ── Pemindah tema gelap ↔ terang ────────────────────────────────────────
   Atributnya dipasang di <html>, BUKAN di kerangka ini. Alasannya bukan
   selera: modal-modal aplikasi diportal ke <body> (lihat catatan portal di
   Analisa.tsx), jadi kalau atributnya menempel di kerangka, tiap dialog
   yang terbuka akan lompat balik ke tema gelap sementara halaman di
   belakangnya terang.

   DISIMPAN di localStorage, dan di sini itu memang pantas — beda dengan
   pemindah suasana di hero halaman depan yang sengaja tidak diingat. Ini
   preferensi alat kerja: orang yang memilih terang karena ruangannya
   silau tidak mau memilih ulang tiap kali membuka aplikasinya.

   Pembacaan awal dilakukan di useState, bukan useEffect, supaya temanya
   sudah benar pada gambar pertama — useEffect berjalan SESUDAH render, dan
   itu berarti satu kedipan gelap sebelum berubah terang. */
type Tema = 'gelap' | 'terang';

function bacaTema(): Tema {
  try { return localStorage.getItem('jt.tema') === 'terang' ? 'terang' : 'gelap'; }
  catch { return 'gelap'; }
}

function TombolTema({ ciut = false }: { ciut?: boolean }) {
  const [tema, setTema] = useState<Tema>(bacaTema);

  useEffect(() => {
    const akar = document.documentElement;
    if (tema === 'terang') akar.setAttribute('data-tema', 'terang');
    else akar.removeAttribute('data-tema');
    try { localStorage.setItem('jt.tema', tema); } catch { /* mode privat */ }
  }, [tema]);

  const keTerang = tema === 'gelap';
  const nama = keTerang ? 'Ganti ke tema terang' : 'Ganti ke tema gelap';

  /* ── SEMPIT: ikon saja ──────────────────────────────────────────────
     Sakelar gesernya selebar 48 px dan sidebar yang menciut cuma 68 px —
     dipaksa masuk, ia mendorong logonya keluar. Yang tampil di situ
     tombol ikon seperti sebelumnya.

     Lambangnya menunjukkan TUJUAN, bukan keadaan sekarang — sama seperti
     pemindah suasana di halaman depan, supaya dua tombol di satu produk
     tidak berbicara dengan dua bahasa berbeda. */
  if (ciut) {
    return (
      <button
        onClick={() => setTema(keTerang ? 'terang' : 'gelap')}
        title={nama} aria-label={nama}
        className="cursor-pointer text-zinc-400 transition-colors hover:text-zinc-100"
      >
        {keTerang ? <Sun className="size-[18px]" strokeWidth={1.8} />
                  : <Moon className="size-[18px]" strokeWidth={1.8} />}
      </button>
    );
  }

  /* value = sedang TERANG. Dibaca begitu, bukan "keTerang", karena sakelar
     menyatakan KEADAAN — posisi tuasnya harus menjawab "sekarang mode
     apa", bukan "kalau ditekan jadi apa". Ikonnya yang tetap bicara
     tujuan, dan keduanya tidak bertabrakan: tuas di kanan berarti terang,
     dan yang tergambar di tuas itu bulan — jalan keluarnya. */
  return (
    <Switch
      kecil
      value={tema === 'terang'}
      onToggle={() => setTema(keTerang ? 'terang' : 'gelap')}
      title={nama}
      iconOn={<Moon className="size-2.5 text-zinc-300" strokeWidth={2.2} />}
      iconOff={<Sun className="size-2.5 text-zinc-300" strokeWidth={2.2} />}
    />
  );
}

function Lonceng() {
  const [buka, setBuka] = useState(false);
  const ref = usePenutupLuar<HTMLDivElement>(() => setBuka(false));
  const { belum, tandai } = useSudahDibaca(
    'jt.newsDibaca',
    NEWS.filter((n) => n.baru).map((n) => n.judul)
  );
  /* Kabar agen duduk DI ATAS berita pasar di panel yang sama, bukan di ikon
     ketiga. Alasannya sama dengan alasan lonceng/amplop/changelog dipisah:
     yang menentukan bukan siapa pengirimnya, tapi apakah isinya soal PASAR.
     Postingan sinyal baru di ruang komunitas adalah kejadian pasar — ia
     sekamar dengan kalender berita, bukan dengan kabar akun. */
  const agen = useKabarAgen();

  const totalBelum = belum + agen.belum;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setBuka((v) => !v); tandai(); agen.tandai(); }}
        aria-label="Berita pasar & kabar agen"
        className="relative cursor-pointer text-zinc-400 transition-colors hover:text-zinc-100"
      >
        <Bell className="size-[18px]" strokeWidth={1.8} />
        {totalBelum > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-zinc-950">
            {totalBelum}
          </span>
        )}
      </button>

      {buka && (
        /* ── DI PONSEL MELEBAR KE LAYAR, BUKAN MENGGANTUNG DI TOMBOLNYA ──
           Dulu selalu `absolute right-0 w-[340px]`: lebarnya tetap, dan
           tepi kanannya menempel pada tombol lonceng — yang duduk jauh dari
           tepi layar karena masih ada avatar di sebelahnya. Terukur di
           lebar 375: panelnya mulai di x = -120, jadi seperlima isinya
           terpotong di luar layar kiri. Judul "Berita Pasar" pun terbaca
           separuh.

           Di ponsel ia sekarang `fixed` selebar layar dikurangi margin,
           digantung di bawah header (56 px, terukur). Fixed, bukan
           absolute: ia harus mengukur diri terhadap JENDELA, bukan
           terhadap tombol yang posisinya bisa bergeser mengikuti isi
           header.

           Dari sm ke atas kembali ke perilaku lama — di sana 340 px muat
           dan menggantung di tombolnya justru lebih tepat. */
        <div className="fixed inset-x-3 top-14 z-50 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-9 sm:w-[340px]">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <Newspaper className="size-4 text-zinc-400" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-zinc-100">Berita Pasar</span>
            <span className="ml-auto text-[11px] text-zinc-600">{totalBelum} baru</span>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {/* ── Kabar agen Pemburu Sinyal ── */}
            {agen.kabar.length > 0 && (
              <div className="border-b border-zinc-800/70 bg-zinc-900/30">
                <div className="flex items-center gap-1.5 px-4 pb-1 pt-2.5">
                  <Radar className="size-3 text-red-400" strokeWidth={2} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Agen Pemburu Sinyal
                  </span>
                </div>
                {agen.kabar.slice(0, 8).map((k) => (
                  <div key={k.id} className="border-b border-zinc-800/40 px-4 py-2.5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[9.5px] font-medium uppercase',
                        k.jenis === 'sinyal' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400')}>
                        {k.jenis === 'sinyal' ? 'sinyal' : 'postingan'}
                      </span>
                      {k.pair && <span className="angka text-[11px] text-zinc-500">{k.pair}</span>}
                      <span className="ml-auto text-[11px] text-zinc-600">{umurKabar(k.waktu)}</span>
                    </div>
                    <div className="mt-1.5 text-[12.5px] leading-snug text-zinc-200">{k.judul}</div>
                    {k.detail && <div className="mt-0.5 text-[11.5px] leading-snug text-zinc-500">{k.detail}</div>}
                    <div className="mt-1 flex items-center gap-2">
                      {k.sumber && <span className="truncate text-[10.5px] text-zinc-600">{k.sumber}</span>}
                      {k.jenis === 'sinyal' && (
                        <Link to="/copy-signal" onClick={() => setBuka(false)}
                              className="ml-auto shrink-0 text-[10.5px] text-zinc-400 underline-offset-2 hover:text-zinc-100 hover:underline">
                          Lihat levelnya
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            {/* Benar-benar kosong = belum ada kejadian pasar yang tercatat.
                Dikatakan apa adanya; kotak kosong tanpa kalimat terbaca
                seperti panel yang gagal memuat. */}
            {agen.kabar.length === 0 && NEWS.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Newspaper className="mx-auto size-5 text-zinc-700" strokeWidth={1.6} />
                <div className="mt-2 text-[12.5px] text-zinc-400">Belum ada kabar pasar</div>
                <div className="mx-auto mt-1 max-w-[240px] text-[11.5px] leading-snug text-zinc-600">
                  Sinyal dari agen Pemburu Sinyal muncul di sini begitu ada yang masuk.
                </div>
              </div>
            )}
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

  /* Kabar PRIBADI — kejadian yang menimpa akun ini: berhasil masuk, akses
     disetujui. Awalnya ditaruh di lonceng, tapi lonceng sudah bermakna
     "PASAR" (berita + agen); kabar akun di sana terbaca sebagai berita pasar
     yang salah kamar. Amplop memang panel pemberitahuan akun, jadi ke sini.

     Penanda bacanya tetap 'jt.kabarPribadiDibaca' — terpisah dari penanda
     PESAN supaya membuka amplop untuk membaca pengumuman tidak diam-diam
     menghapus tanda pada kabar akun yang belum ditindak, dan supaya penanda
     lama pengguna tidak hangus saat kabarnya pindah panel. */
  const { pengguna } = useAuth();
  const pribadi = useKabarPribadi(pengguna?.uid);
  const [pribadiDibaca, setPribadiDibaca] = useState<number>(() => {
    try { return Number(localStorage.getItem('jt.kabarPribadiDibaca')) || 0; } catch { return 0; }
  });
  const pribadiBelum = pribadi.filter((k) => k.waktu > pribadiDibaca).length;
  const tandaiPribadi = () => {
    const paling = pribadi.reduce((m, k) => Math.max(m, k.waktu), 0);
    if (paling > pribadiDibaca) {
      setPribadiDibaca(paling);
      try { localStorage.setItem('jt.kabarPribadiDibaca', String(paling)); } catch { /* privat */ }
    }
  };

  const totalBelum = belum + pribadiBelum;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setBuka((v) => !v); tandai(); tandaiPribadi(); }}
        aria-label="Pemberitahuan"
        className="relative cursor-pointer text-zinc-400 transition-colors hover:text-zinc-100"
      >
        <Mail className="size-[18px]" strokeWidth={1.8} />
        {totalBelum > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-[#fff]">
            {totalBelum}
          </span>
        )}
      </button>

      {buka && (
        /* Sama persis dengan dropdown berita di atas — lihat catatannya di
           sana. Ditulis dua kali karena keduanya komponen terpisah; kalau
           salah satu diubah, yang lain WAJIB ikut. */
        <div className="fixed inset-x-3 top-14 z-50 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-9 sm:w-[340px]">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <Mail className="size-4 text-zinc-400" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-zinc-100">Pemberitahuan</span>
            <span className="ml-auto text-[11px] text-zinc-600">{totalBelum} belum dibaca</span>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {/* ── Kabar akun: kejadian NYATA milik orang ini ──
                Paling atas karena paling perlu ditindak. Kosong = tidak ada
                yang terjadi; sengaja TIDAK diisi contoh supaya panelnya
                tetap bisa dipercaya saat benar-benar berbunyi. */}
            {pribadi.length > 0 && (
              <div className="border-b border-zinc-800/70 bg-zinc-900/30">
                <div className="flex items-center gap-1.5 px-4 pb-1 pt-2.5">
                  <UserCircle2 className="size-3 text-amber-400" strokeWidth={2} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Akun kamu
                  </span>
                </div>
                {pribadi.slice(0, 6).map((k) => (
                  <div key={k.id} className="border-b border-zinc-800/40 px-4 py-2.5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[9.5px] font-medium uppercase',
                        k.jenis === 'akses' ? 'bg-emerald-500/15 text-emerald-400'
                          : k.jenis === 'peringatan' ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-zinc-700/30 text-zinc-400')}>
                        {k.jenis === 'akses' ? 'akses' : k.jenis === 'peringatan' ? 'perhatian' : 'sesi'}
                      </span>
                      <span className="ml-auto text-[11px] text-zinc-600">{umurKabar(k.waktu)}</span>
                    </div>
                    <div className="mt-1.5 text-[12.5px] leading-snug text-zinc-200">{k.judul}</div>
                    {k.detail && <div className="mt-0.5 text-[11.5px] leading-snug text-zinc-500">{k.detail}</div>}
                  </div>
                ))}
              </div>
            )}

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
            {/* Kosong = belum ada apa pun yang terjadi pada akun ini. Itu
                keadaan yang WAJAR untuk orang yang baru masuk, jadi
                kalimatnya menenangkan, bukan meminta maaf. */}
            {pribadi.length === 0 && PESAN.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Mail className="mx-auto size-5 text-zinc-700" strokeWidth={1.6} />
                <div className="mt-2 text-[12.5px] text-zinc-400">Belum ada pemberitahuan</div>
                <div className="mx-auto mt-1 max-w-[240px] text-[11.5px] leading-snug text-zinc-600">
                  Kabar tentang akunmu — akses disetujui, sesi baru — muncul di sini.
                </div>
              </div>
            )}
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
    { Ikon: MessageCircle, label: 'WhatsApp', ket: BADAN.waTampil, href: WA_LINK, warna: 'text-emerald-400' },
    { Ikon: Send, label: 'Discord', ket: 'Diskusi & komunitas', href: '#', warna: 'text-indigo-400' },
    /* Email USAHA, bukan email pribadi pemilik. Alamat pribadi di halaman
       bantuan berarti alamat itu ikut tersebar ke setiap pengguna, tidak
       bisa didelegasikan ke siapa pun, dan terbaca sebagai hobi ketimbang
       usaha berbadan hukum. Dibaca dari lib/badan.ts supaya sama persis
       dengan yang tertulis di halaman Legal dan footer. */
    { Ikon: AtSign, label: 'Email', ket: BADAN.email, href: `mailto:${BADAN.email}`, warna: 'text-zinc-400' },
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


export function AppShell({ children }: { children: React.ReactNode }) {
  const [laci, setLaci] = useState(false);
  const [ciut, setCiut] = useState(false);
  const { pathname, search } = useLocation();
  const { pemilik } = useAuth();
  const judul = JUDUL[pathname] ?? 'Dashboard';

  /* ── Sub-menu yang terbuka di sidebar ─────────────────────────────────
     Menu ber-`sub` punya panah untuk membuka daftar sub-halamannya.
     Menu yang halamannya SEDANG dibuka otomatis terbuka — orang yang
     berada di Performa Signal berhak melihat di mana dirinya tanpa
     mengklik panah dulu. Pilihan manual disimpan per menu supaya membuka
     satu tidak menutup yang lain. */
  const [subBuka, setSubBuka] = useState<Record<string, boolean>>({});
  const subTerbuka = (ke: string) => subBuka[ke] ?? pathname === ke;
  /* Aktif-tidaknya SUB dibandingkan dengan alamat penuh (path + query):
     NavLink bawaan hanya melihat pathname, jadi kedua sub /copy akan
     sama-sama menyala. */
  /* ── SUB-MENU YANG TUMBUH SAAT SEBUAH KANAL DIBUKA ────────────────────
     Kanal yang sedang dibaca hidup di alamat (?kanal=<uid>), jadi sidebar
     bisa mengetahuinya tanpa satu pun state dibagi antar komponen.

     Selama tidak ada kanal terbuka, menunya persis seperti semula. Begitu
     satu dibuka, "Market Signal" bertunas: Area Analis, dan di dalamnya dua
     tab yang memang ada di layarnya.

     Sidebar yang berhenti di "Market Signal" padahal orangnya sudah dua
     lapis di dalamnya membuat satu-satunya penunjuk posisi di aplikasi ini
     berbohong soal di mana orangnya berada. */
  const [cariUrl] = useSearchParams();
  const kanalUrl = cariUrl.get('kanal') || '';
  const alamatKanal = (tab?: string) =>
    `/copy-signal?kanal=${encodeURIComponent(kanalUrl)}${tab ? '&sub=' + tab : ''}`;

  function subDinamis(ke: string, sub: any[]) {
    if (ke !== '/copy-signal' || !kanalUrl) return sub;
    return sub.map((s: any) =>
      s.ke === '/copy-signal'
        ? {
            ...s,
            anak: [{
              ke: alamatKanal(),
              label: 'Area Analis',
              /* URUTANNYA MENGIKUTI TAB DI HALAMANNYA: Daftar Signal
                 dulu, Performa Signal sesudahnya. Sidebar dan tab yang
                 mengurutkan hal yang sama dengan urutan berbeda memaksa
                 orang membaca ulang tiap kali ia berpindah di antara
                 keduanya.

                 KEDUANYA MENYEBUT ?sub= SECARA TEGAS, dan itu memperbaiki
                 bug yang menempel di sini: 'Performa Signal' dulu memakai
                 alamatKanal() tanpa argumen, yaitu alamat kanal TANPA
                 ?sub= sama sekali. Selama tab bawaannya 'performa' itu
                 kebetulan benar. Begitu bawaannya diubah ke 'market',
                 menekan "Performa Signal" justru membuka Daftar Signal —
                 dan tidak ada yang berbunyi seperti galat, cuma tautan
                 yang mendarat di tempat yang salah.

                 Ikutannya juga hilang: subAktif() menandai tautan
                 tanpa-query sebagai aktif ketika alamat juga tanpa query,
                 jadi dulu "Area Analis" dan "Performa Signal" bisa
                 tersorot bersamaan. Sekarang cuma satu yang cocok.

                 Pelajarannya dicatat di sini karena akan terulang: tautan
                 yang menumpang pada NILAI BAWAAN akan diam-diam berubah
                 arah setiap kali bawaannya diganti. Sebutkan tujuannya. */
              anak: [
                { ke: alamatKanal('market'),   label: 'Daftar Signal' },
                { ke: alamatKanal('performa'), label: 'Performa Signal' },
              ],
            }],
          }
        : s);
  }

  const subAktif = (ke: string) => {
    const [p, q] = ke.split('?');
    if (p !== pathname) return false;
    if (!q) return search === '' || !search.includes('sub=') && !search.includes('tab=');
    return search.includes(q);
  };
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

  /* ── Bus antar-jendela ────────────────────────────────────────────────
     Panel multi-chart (iframe/popup) yang perlu membuka halaman lain —
     posting Copy Signal — MENYURUH jendela tools ini berpindah lewat bus,
     alih-alih berpindah sendiri di dalam panel kecilnya. Hanya jendela
     utama yang mendengar: konteks polos tidak pernah memasang pendengar,
     jadi pesan satu panel tidak memindahkan panel-panel lain. */
  const arahkan = useNavigate();
  useEffect(() => {
    if (POLOS) return;
    return dengarBus((p) => {
      if (p && p.jenis === 'navigasi' && typeof p.ke === 'string' && p.ke.startsWith('/')) {
        arahkan(p.ke);
      }
    });
  }, [arahkan]);

  /* ── Mode polos: isi tanpa kerangka ───────────────────────────────────
     Dipakai iframe panel multi-chart dan jendela chart lepasan. Sidebar
     dan bilah atas milik JENDELA TOOLS; menumbuhkannya di dalam panel
     seperempat layar cuma memakan tempat untuk navigasi yang memang tidak
     boleh terjadi di sana. Hooks di atas tetap berjalan (aturan React) —
     yang berbeda hanya bingkainya. */
  if (POLOS) {
    return <div className="min-h-screen bg-zinc-950 text-zinc-100">{children}</div>;
  }

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
        {/* px-5, BUKAN px-4. Diukur: logo merek dulu duduk 16 px dari
            tepi sementara ikon-ikon nav di bawahnya 20 px — merek
            menggantung 4 px lebih ke kiri daripada seluruh kolom di
            bawahnya. Selisih sekecil itu tidak terbaca sebagai angka,
            tapi terbaca sebagai "ada yang miring".

            Saat MENCIUT barisnya dipusatkan, sama seperti ikon nav yang
            memakai justify-center px-0. Sebelumnya logonya tetap
            menempel kiri sementara semua ikon di bawahnya di tengah —
            dan itu yang paling kelihatan, karena di keadaan itu logonya
            satu-satunya benda di barisnya. */}
        <div className={cn('flex h-14 items-center gap-2.5 px-5',
                            ciut && 'md:justify-center md:gap-0 md:px-0')}>
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
          {/* Sakelar tema DI SINI, bukan lagi di bilah atas. Permintaan
              pemilik. Letaknya juga masuk akal: tema itu setelan tampilan
              seluruh aplikasi, bukan sesuatu yang berhubungan dengan
              halaman yang sedang dibuka — dan bilah atas isinya hal-hal
              yang menempel pada halaman itu.

              ml-auto pindah ke sini karena ia yang sekarang jadi benda
              pertama di sisi kanan; tombol tutup di sebelahnya tinggal
              mengikut. */}
          <span className={cn('ml-auto', ciut && 'md:hidden')}><TombolTema /></span>
          <button onClick={() => setLaci(false)} aria-label="Tutup menu"
            className="cursor-pointer text-zinc-500 hover:text-zinc-100 md:hidden">
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {/* Grup bertanda `hanyaPemilik` disembunyikan dari yang lain. Ini
              murni kerapian tampilan — halamannya sendiri dijaga Security
              Rules, yang memakai uid yang sama. Menu tersembunyi tidak
              pernah jadi pengamanan; siapa pun bisa mengetik #/pemilik. */}
          {NAV.filter((g: any) => !g.hanyaPemilik || pemilik).map((g: any) => (
            <div key={g.grup} className="mb-5">
              {!ciut && (
                <div className="flex items-center gap-1.5 px-2 pb-2">
                  <span className="text-[11px] font-medium text-zinc-500">{g.grup}</span>
                  {g.IkonGrup && <g.IkonGrup className="size-3.5 shrink-0 text-amber-400" strokeWidth={2} />}
                </div>
              )}
              {/* Sidebar CIUT tinggal ikon, jadi judul grupnya hilang — dan
                  bersamanya hilang pula satu-satunya tanda bahwa dua menu di
                  bawah ini khusus pemilik. Mahkota kecil ini menggantikannya. */}
              {ciut && g.IkonGrup && (
                <div className="flex justify-center pb-1.5">
                  <g.IkonGrup className="size-3.5 text-amber-400/70" strokeWidth={2} />
                </div>
              )}
              {g.butir.map(({ ke, label, Ikon, sub }: any) => (
                <div key={ke}>
                  <div className="relative">
                    <NavLink to={ke} onClick={() => setLaci(false)} title={ciut ? label : undefined}
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
                          <span className="absolute -left-1.5 -top-1 flex min-w-[15px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold leading-[15px] text-[#fff]">
                            {lisensiBaru > 9 ? '9+' : lisensiBaru}
                          </span>
                        )}
                      </span>
                      {!ciut && <span>{label}</span>}
                    </NavLink>
                    {/* Panah pembuka sub-menu. Tombol TERPISAH dari tautannya:
                        mengklik nama tetap berpindah halaman, mengklik panah
                        hanya membuka daftar — dua niat yang berbeda tidak
                        boleh berebut satu klik. Hilang saat sidebar ciut,
                        karena sub-teks tidak punya tempat di lebar ikon. */}
                    {sub && !ciut && (
                      <button
                        onClick={() => setSubBuka((s) => ({ ...s, [ke]: !subTerbuka(ke) }))}
                        aria-label={subTerbuka(ke) ? `Tutup sub-menu ${label}` : `Buka sub-menu ${label}`}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                      >
                        <ChevronDown className={cn('size-3.5 transition-transform', subTerbuka(ke) && 'rotate-180')} />
                      </button>
                    )}
                  </div>
                  {sub && !ciut && subTerbuka(ke) && (
                    <div className="mb-1 ml-[17px] space-y-0.5 border-l border-zinc-800 py-1 pl-3">
                      {subDinamis(ke, sub).map((s: any) => (
                        <BarisSub key={s.ke} butir={s} aktif={subAktif}
                                  tutupLaci={() => setLaci(false)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* Changelog: berisi pembaruan web yang benar-benar menarik, dan
            "Learn more" membuka laporan lengkap fitur terbaru. */}
        {!ciut && <KartuBaru versi={terbaru.versi} judul={terbaru.judul} ringkas={terbaru.ringkas} />}

        <div className="border-t border-zinc-800/80 px-3 py-2">
          <Bantuan ciut={ciut} />
          <NavLink to="/docs" title={ciut ? 'Documentation' : undefined}
            className={({ isActive }) => cn(
              'flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] transition-colors hover:bg-zinc-900 hover:text-zinc-100',
              ciut && 'justify-center px-0',
              isActive ? 'text-zinc-100' : 'text-zinc-400'
            )}
          >
            <BookOpen className="size-4 shrink-0" strokeWidth={1.8} />
            {!ciut && <span>Documentation</span>}
          </NavLink>
          {/* Baris hak cipta sekaligus jalan masuk ke halaman Legal. Ditaruh
              di sini, bukan sebagai butir nav tersendiri: disclaimer dan
              ketentuan bukan alat yang dipakai sehari-hari, jadi menaruhnya
              sejajar Dashboard dan Journal hanya menambah kebisingan pada
              menu yang justru harus cepat dipindai. Tapi ia tetap harus ADA
              dan konsisten di setiap halaman — dan pojok bawah adalah tempat
              pertama orang mencarinya. */}
          {!ciut && (
            <div className="px-2 pb-1 pt-3 text-[11px] text-zinc-600">
              © 2026 Jadi Trader Tools ·{' '}
              <Link to="/legal" className="transition-colors hover:text-zinc-400">Legal - Privasi</Link>
            </div>
          )}
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
            {/* Sakelar tema tinggal di sidebar. Ia MUNCUL LAGI di sini
                hanya saat sidebar-nya menciut di layar lebar: isi barisnya
                tinggal 36 px, dan sakelar selebar 48 px akan mendorong
                logonya keluar. Bentuknya ikon, persis tempat asalnya —
                jadi yang berpindah cuma satu kendali, bukan dua kendali
                berbeda untuk hal yang sama. */}
            {ciut && <span className="hidden md:block"><TombolTema ciut /></span>}
            <Pesan />
            <Lonceng />
            <MenuPengguna />
          </div>
        </header>

        <PitaLangganan />

        {/* relative: grid multi-chart menimpa area konten INI SAJA —
            sidebar dan header tetap hidup, jadi jendela tools tetap bisa
            dipakai berpindah halaman selagi chart-chartnya berjalan. */}
        <main className="relative min-w-0 flex-1">
          {children}
          {/* Dipasang di sini, bukan di rute /chart-entry: komponen yang
              hidup di rute ikut mati saat rutenya ditinggalkan, dan iframe
              yang mati kehilangan seluruh keadaannya. Di sini ia cuma
              disembunyikan — panelnya terus berjalan di belakang halaman
              mana pun yang sedang dibuka. */}
          <MultiChart />
        </main>
      </div>

    </div>
  );
}

/* Menggambar satu butir sub-menu BESERTA keturunannya, berapa pun dalamnya.
   Ditulis rekursif, bukan dua lapis yang disalin: sidebar ini sudah punya
   tiga tingkat, dan tingkat keempat yang datang nanti tidak boleh menuntut
   penulisan ulang. */
function BarisSub({ butir, aktif, tutupLaci }: {
  butir: any;
  aktif: (ke: string) => boolean;
  tutupLaci: () => void;
}) {
  const punyaAnak = Array.isArray(butir.anak) && butir.anak.length > 0;

  /* TERBUKA sebagai bawaan, tidak seperti menu tingkat atas yang bawaannya
     tertutup. Bedanya bukan kelalaian: cabang ini cuma ADA saat orangnya
     sudah masuk ke dalam kanal, jadi menutupnya di awal berarti
     menyembunyikan persis apa yang barusan ia buka. Yang tingkat atas
     berbeda — semuanya selalu ada, dan membuka semuanya sekaligus membuat
     sidebarnya panjang tanpa ada yang meminta. */
  const [buka, setBuka] = useState(true);

  return (
    <>
      {/* relative + tombol menumpang: bidang tautannya tetap selebar penuh
          supaya mudah ditekan, dan panahnya duduk di atasnya. Menaruh
          keduanya berdampingan akan menyusutkan sasaran tautan tiap kali
          sebuah butir punya keturunan — dua butir bersebelahan jadi punya
          lebar klik berbeda tanpa alasan yang terlihat. */}
      <div className="relative">
        <Link to={butir.ke} onClick={tutupLaci}
          className={cn(
            'my-px block rounded-md px-2.5 py-[7px] text-[12px] leading-tight transition-colors',
            punyaAnak && 'pr-7',
            aktif(butir.ke)
              ? 'bg-zinc-800/50 text-zinc-100'
              : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200',
          )}
        >
          {butir.label}
        </Link>
        {punyaAnak && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBuka((b) => !b); }}
            aria-expanded={buka}
            aria-label={buka ? `Tutup sub-menu ${butir.label}` : `Buka sub-menu ${butir.label}`}
            className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <ChevronDown className={cn('size-3 transition-transform', buka && 'rotate-180')} />
          </button>
        )}
      </div>
      {punyaAnak && buka && (
        /* Garis tepinya menipis tiap turun satu tingkat — kedalaman terbaca
           dari beratnya, bukan cuma dari jaraknya. */
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-zinc-800/60 py-0.5 pl-2.5">
          {butir.anak.map((a: any) => (
            <BarisSub key={a.ke} butir={a} aktif={aktif} tutupLaci={tutupLaci} />
          ))}
        </div>
      )}
    </>
  );
}
