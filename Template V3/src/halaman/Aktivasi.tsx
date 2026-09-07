import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Loader2, ShieldCheck, Clock, ArrowRight, TriangleAlert, KeyRound,
} from 'lucide-react';
import { useAuth, pesanAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { mintaAkses, permintaanSaya, masukDiscord, bacaPaketMinta, bacaProdukLynk, NAMA_PAKET, PRODUK_LYNK, KUNCI_LISENSI_LOKAL, type Permintaan } from '@/lib/akses';
import { Copy, Check, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   AKTIVASI — tujuan link yang dikirim Lynk setelah pembayaran
   ════════════════════════════════════════════════════════════════════════
   Lynk mengirim satu link tetap ke setiap pembeli begitu pembayarannya
   lunas. Link itu diarahkan ke halaman ini.

   ── KENAPA HALAMAN TERSENDIRI, BUKAN /akses SAJA ───────────────────────
   Orang yang sampai ke sini SUDAH MEMBAYAR. Menyuruhnya membaca lagi
   "pilih gratis atau berbayar" dan menekan "Sudah bayar — kirim
   permintaan" adalah meminta ia membuktikan sesuatu yang sudah ia
   lakukan. Di sini permintaannya dicatat SENDIRI begitu ia masuk; yang
   tersisa baginya cuma satu langkah: login.

   ── BAGAIMANA PEMILIK MEMBEDAKAN PEMBAYAR DARI PEMINTA BIASA ───────────
   Permintaan dari halaman ini ditandai `bukti: "lynk"`. Di panel
   Permintaan Akses & Lisensi ia muncul dengan lencana Lynk, jadi pemilik
   tahu baris mana yang harus dicocokkan dengan daftar Orders di lynk.id.

   Pencocokannya lewat EMAIL — email akun Google/Discord di sini disamakan
   dengan email pembeli di pesanan Lynk. Lynk tidak menitipkan nomor
   pesanan di link kirimannya, jadi tidak ada yang bisa dibaca otomatis
   dari alamat halaman; berpura-pura ada akan menghasilkan pencocokan yang
   kelihatan otomatis padahal menebak.

   ── PAKETNYA DIBEDAKAN LEWAT ALAMAT, 6 Sep 2026 ────────────────────────
   Tiap produk di Lynk sekarang mengirim pembelinya ke alamat yang berbeda:
   ?paket=testing, ?paket=premium3, ?paket=tahunan. Sebelumnya ketiganya
   mendarat di alamat yang sama dan pemilik harus membuka daftar Orders
   untuk tahu yang mana — pekerjaan yang berulang tiap pembelian.

   YANG DIBAWA CUMA LABELNYA, BUKAN AKSESNYA. Alamat halaman datang dari
   peramban; siapa pun bisa mengetik ?paket=tahunan. Kalau nilai itu
   memberi akses, satu tautan yang tersebar sekali di grup Telegram sama
   dengan lisensi tahunan gratis untuk semua pembacanya. Jadi server
   menyimpannya di `paketMinta` yang TERPISAH dari `paket`, dan yang boleh
   mengisi `paket` tetap cuma persetujuan pemilik.

   Yang hilang bukan pengamanannya, melainkan pekerjaan mencocokkannya:
   pemilik melihat "minta: Akses Tahunan" langsung di barisnya.

   ── TIGA JALAN MASUK, SATU MUARA ───────────────────────────────────────
   1. Bayar lewat Lynk  → halaman ini → pemilik menyetujui
   2. Punya kode        → /akses, tukar kodenya sendiri, langsung aktif
   3. Diberi pemilik    → pemilik menyetujui langsung dari Maintenance
   Ketiganya berakhir di tempat yang sama: `langganan/{uid}.bayarSampai`.
   ════════════════════════════════════════════════════════════════════════ */

/** Penanda sumber. Disimpan di kolom `bukti` yang memang sudah ada, bukan
 *  dengan menambah kolom baru di backend — satu kata di kolom yang sudah
 *  ditampilkan panel pemilik jauh lebih murah daripada satu rute baru yang
 *  harus di-deploy ulang ke VPS. */
export const PENANDA_LYNK = 'lynk';

function Langkah({ n, judul, ket, keadaan }: {
  n: number; judul: string; ket: string; keadaan: 'selesai' | 'sedang' | 'nanti';
}) {
  return (
    <div className="flex gap-3">
      <div className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
        keadaan === 'selesai' ? 'bg-emerald-500/15 text-emerald-400'
          : keadaan === 'sedang' ? 'bg-zinc-100 text-zinc-950'
          : 'bg-zinc-800/60 text-zinc-600',
      )}>
        {keadaan === 'selesai' ? <CheckCircle2 className="size-3.5" /> : n}
      </div>
      <div className="min-w-0 pb-4">
        <div className={cn('text-[13px]', keadaan === 'nanti' ? 'text-zinc-500' : 'text-zinc-100')}>{judul}</div>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">{ket}</p>
      </div>
    </div>
  );
}

export default function Aktivasi() {
  const { pengguna, memuat: memuatAuth, pemilik, langganan } = useAuth();
  const arahkan = useNavigate();
  /* DIBACA SEKALI SAAT LAHIR, bukan tiap render. Alamatnya tidak berubah
     selama halaman ini terbuka, dan membacanya ulang cuma memberi peluang
     nilai berbeda masuk ke permintaan yang sudah terkirim. */
  const [paketDibeli] = useState(() =>
    bacaPaketMinta(new URLSearchParams(window.location.search).get('paket')));
  /* Pembelian Marketplace lewat pintu yang sama. `?produk=` menggantikan
     `?paket=`; keduanya tidak pernah dipakai bersamaan karena satu produk
     Lynk menjual satu hal. */
  const [produkDibeli] = useState(() =>
    bacaProdukLynk(new URLSearchParams(window.location.search).get('produk')));
  const [punyaku, setPunyaku] = useState<Permintaan[] | null>(null);
  const [galat, setGalat] = useState('');
  const [mengirim, setMengirim] = useState(false);
  /* Sekali saja per sesi. Tanpa penjaga ini, tiap render ulang (mis. token
     Firebase disegarkan) menembakkan permintaan lagi — dan antrean pemilik
     terisi lima baris untuk satu orang yang sama. */
  const sudahCoba = useRef(false);

  /* ── DUA MACAM PEMBELIAN, DUA MACAM "SUDAH" ────────────────────────
     Membeli AKSES selesai begitu langganannya aktif — tidak ada yang perlu
     dilakukan lagi di sini, jadi halaman mengantar ke Dashboard.

     Membeli PRODUK tidak pernah "sudah" karena langganan. Yang ditunggu
     KODE LISENSI-nya, dan pemegang paket Testing atau Premium 3 Bulan yang
     membeli indikator tetap butuh kode itu. Dilaporkan pemilik 6 Sep 2026:
     tautan pembelian Indikator V3 mendarat di layar "Akses aktif — kamu
     diarahkan ke Dashboard", dan kodenya tidak pernah terlihat.

     Jadi `sudahAktif` cuma bermakna untuk mode akses. Di mode produk ia
     dipaksa false, dan seluruh cabang yang bergantung padanya ikut diam. */
  const modeProduk = !!produkDibeli;
  const sudahAktif = !modeProduk && (pemilik || langganan.status === 'aktif');
  const namaProduk = produkDibeli ? PRODUK_LYNK[produkDibeli] : '';

  async function masukGoogle() {
    setGalat('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      /* Halaman yang PALING tidak boleh menampilkan kalimat Inggris mentah:
         di sinilah orang yang baru saja membayar mendarat. */
      setGalat(pesanAuth(e));
    }
  }

  /* Begitu login terdeteksi: baca permintaan yang sudah ada, dan kalau
     belum ada — catatkan sendiri. Inilah satu-satunya hal yang membedakan
     halaman ini dari /akses. */
  useEffect(() => {
    if (!pengguna || sudahAktif) return;
    let hidup = true;
    (async () => {
      try {
        const daftar = await permintaanSaya();
        if (!hidup) return;
        setPunyaku(daftar);
        const produkIni = produkDibeli || 'jadi-trader-v3';
        const ada = daftar.find((p) => p.produk === produkIni && p.status !== 'ditolak');
        if (ada || sudahCoba.current) return;
        sudahCoba.current = true;
        setMengirim(true);
        await mintaAkses({
          jenis: 'bayar',
          catatan: produkDibeli
            ? `Pembelian lewat Lynk — ${PRODUK_LYNK[produkDibeli]}`
            : paketDibeli
              ? `Pembayaran lewat Lynk — ${NAMA_PAKET[paketDibeli]}`
              : 'Pembayaran lewat Lynk — dibuka dari link kiriman otomatis',
          bukti: PENANDA_LYNK,
          ...(paketDibeli ? { paketMinta: paketDibeli } : {}),
          ...(produkDibeli ? { produk: produkDibeli } : {}),
        });
        if (!hidup) return;
        setPunyaku(await permintaanSaya());
      } catch (e) {
        if (hidup) setGalat(e instanceof Error ? e.message : 'Gagal mencatat pembayaran');
      } finally {
        if (hidup) setMengirim(false);
      }
    })();
    return () => { hidup = false; };
  }, [pengguna, sudahAktif]);

  const produkIni = produkDibeli || 'jadi-trader-v3';
  const terakhir = punyaku?.find((p) => p.produk === produkIni) ?? null;
  const tercatat = !!terakhir && terakhir.status !== 'ditolak';
  /* Kode lisensi yang sudah terbit untuk produk INI. Server hanya
     memulangkannya kepada pemilik permintaannya sendiri dan hanya sesudah
     disetujui — jadi kalau ada isinya, ia sah. */
  const kodeTerbit = modeProduk && terakhir?.status === 'disetujui' && terakhir.kode
    ? terakhir.kode : '';
  const [tersalin, setTersalin] = useState(false);

  /* Begitu kodenya terbit, dititipkan ke perangkat ini di kunci yang sama
     dengan yang dibaca Marketplace. Orangnya sampai di sana dengan kolom
     kode sudah terisi — mengetik ulang 19 karakter adalah gesekan yang tidak
     perlu untuk barang yang sudah dibayar. */
  useEffect(() => {
    if (!kodeTerbit) return;
    try { localStorage.setItem(KUNCI_LISENSI_LOKAL, kodeTerbit); } catch { /* mode privat */ }
  }, [kodeTerbit]);

  /* ── MENUNGGU TANPA MUAT ULANG ──────────────────────────────────────
     Persetujuan datang beberapa menit sampai beberapa jam kemudian, dan
     orang yang membiarkan tab ini terbuka pantas melihat kodenya muncul
     sendiri. Dua puluh detik cukup: rute /minta/saya ringan, dan yang
     ditunggu bukan sesuatu yang berubah tiap detik. Berhenti begitu kodenya
     ada atau permintaannya ditolak. */
  useEffect(() => {
    if (!modeProduk || !pengguna || !terakhir || terakhir.status !== 'baru') return;
    const jam = window.setInterval(() => {
      permintaanSaya().then(setPunyaku).catch(() => { /* coba lagi putaran berikutnya */ });
    }, 20_000);
    return () => window.clearInterval(jam);
  }, [modeProduk, pengguna, terakhir]);

  function salinKode() {
    if (!kodeTerbit) return;
    navigator.clipboard?.writeText(kodeTerbit).catch(() => {});
    setTersalin(true);
    setTimeout(() => setTersalin(false), 1600);
  }

  /* Sudah aktif = tidak ada lagi yang perlu dilakukan di sini. */
  useEffect(() => {
    if (sudahAktif) {
      const t = setTimeout(() => arahkan('/dashboard'), 2200);
      return () => clearTimeout(t);
    }
  }, [sudahAktif, arahkan]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-5">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeSlideIn 0.8s ease-out forwards; opacity: 0; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
      `}</style>

      <div className="w-full max-w-[440px]">
        <Link to="/" className="animate-fade-in mb-6 inline-block text-[12px] text-zinc-500 transition-colors hover:text-zinc-300">
          ← Kembali ke beranda
        </Link>

        <div className="animate-fade-in delay-100 mb-6">
          <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-1.5">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              {modeProduk ? 'Pembelian diterima' : 'Pembayaran diterima'}
            </span>
          </div>
          {/* Judulnya menyebut BARANGNYA. "Aktifkan aksesmu" untuk orang yang
              baru membayar indikator terbaca sebagai halaman yang salah —
              dan memang salah, sampai 6 Sep 2026. */}
          <h1 className="text-4xl font-medium leading-[0.95] tracking-tighter text-zinc-50 sm:text-5xl">
            {modeProduk ? 'Ambil ' : 'Aktifkan '}
            <span className="bg-gradient-to-br from-white via-white to-[#ffcd75] bg-clip-text text-transparent">
              {modeProduk ? namaProduk : 'aksesmu'}
            </span>
          </h1>
          <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-zinc-400">
            {modeProduk ? (
              <>Terima kasih sudah membeli. Masuk dengan akunmu, dan kode lisensinya{' '}
                <span className="text-zinc-200">terbit di halaman ini</span> begitu pesananmu dicocokkan.</>
            ) : (
              <>Terima kasih sudah membeli. Satu langkah lagi: masuk dengan akun yang akan
                kamu pakai, supaya aksesnya bisa <span className="text-zinc-200">diikat ke akun itu</span>.</>
            )}
          </p>
        </div>

        {memuatAuth ? (
          <div className="animate-fade-in delay-200 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-[12.5px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" /> Memeriksa sesi…
          </div>
        ) : sudahAktif ? (
          <div className="animate-fade-in delay-200 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
            <div className="flex items-center gap-2 text-[14px] font-medium text-emerald-400">
              <CheckCircle2 className="size-4" /> Akses aktif
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">
              Semuanya sudah terbuka. Kamu diarahkan ke Dashboard sebentar lagi.
            </p>
            <Link to="/dashboard"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-100 px-5 py-2.5 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-white">
              Buka aplikasi <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : !pengguna ? (
          <div className="animate-fade-in delay-200 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-[13.5px] font-medium text-zinc-200">Masuk untuk mengaitkan pembayaran</div>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              Pakai akun dengan email yang sama seperti saat membayar — itu yang
              dicocokkan dengan pesananmu.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button onClick={() => void masukGoogle()}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 py-2.5 text-[12.5px] font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
                <svg className="size-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button onClick={masukDiscord}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 py-2.5 text-[12.5px] font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
                <svg className="size-4" viewBox="0 0 24 24" fill="#5865F2">
                  <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.955 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z"/>
                </svg>
                Discord
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in delay-200 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            {mengirim ? (
              <div className="flex items-center gap-2 text-[12.5px] text-zinc-400">
                <Loader2 className="size-3.5 animate-spin" /> Mencatat pembayaranmu…
              </div>
            ) : kodeTerbit ? (
              <>
                {/* ── KODE LISENSI TERBIT ─────────────────────────────
                    Inilah yang ditunggu pembeli produk, dan inilah yang
                    dulu tidak pernah tampil. Kodenya ditulis besar, bisa
                    disalin, dan tombol di bawahnya membawa ke produknya
                    dengan kolom kode sudah terisi (lihat useEffect
                    localStorage di atas). */}
                <div className="flex items-center gap-2 text-[13.5px] font-medium text-emerald-400">
                  <CheckCircle2 className="size-4" /> Kode lisensi {namaProduk} terbit
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <code className="angka flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-[15px] tracking-wider text-zinc-50">
                    {kodeTerbit}
                  </code>
                  <button onClick={salinKode} aria-label="Salin kode lisensi"
                    className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-700 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
                    {tersalin ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                  </button>
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
                  Kode ini milikmu sendiri — sudah disimpan di perangkat ini dan ikut dikirim ke{' '}
                  <span className="text-zinc-300">{pengguna.email}</span>. Salinan produk yang kamu
                  ambil memuat penanda lisensimu.
                </p>
                <Link to={`/marketplace?produk=${encodeURIComponent(produkIni)}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-100 px-5 py-2.5 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-white">
                  <ShoppingBag className="size-3.5" /> Ambil {namaProduk} <ArrowRight className="size-3.5" />
                </Link>
              </>
            ) : tercatat ? (
              <>
                <div className="flex items-center gap-2 text-[13.5px] font-medium text-zinc-100">
                  <Clock className="size-4 text-[#ffcd75]" /> Menunggu pencocokan
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                  {modeProduk ? (
                    <>Pembelianmu sudah masuk antrean atas nama{' '}
                      <span className="text-zinc-300">{pengguna.email}</span>. Begitu penjual mencocokkannya
                      dengan pesanan di Lynk, kode lisensinya muncul <span className="text-zinc-300">di sini</span>{' '}
                      dan dikirim ke emailmu. Halaman ini memeriksanya sendiri — tidak perlu dimuat ulang.</>
                  ) : (
                    <>Pembayaranmu sudah masuk antrean atas nama{' '}
                      <span className="text-zinc-300">{pengguna.email}</span>. Pemilik mencocokkannya
                      dengan pesanan di Lynk, lalu aksesnya dibuka. Kamu tidak perlu mengirim apa pun lagi.</>
                  )}
                </p>
              </>
            ) : (
              <div className="flex items-start gap-2 text-[12.5px] leading-relaxed text-zinc-400">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <span>
                  Permintaanmu belum tercatat{galat ? ` — ${galat}` : ''}. Muat ulang halaman ini,
                  atau kirim manual lewat halaman akses.
                </span>
              </div>
            )}

            <div className="mt-4 border-t border-zinc-800/70 pt-4">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Alurnya</div>
              <Langkah n={1} keadaan="selesai" judul="Pembayaran di Lynk"
                       ket="Selesai — link ini hanya dikirim setelah pembayaran lunas." />
              <Langkah n={2} keadaan="selesai" judul="Masuk dengan akunmu"
                       ket={`Terhubung sebagai ${pengguna.email ?? pengguna.uid.slice(0, 8)}.`} />
              <Langkah n={3} keadaan={kodeTerbit ? 'selesai' : tercatat ? 'sedang' : 'nanti'} judul="Penjual mencocokkan pesanan"
                       ket="Dicocokkan lewat email pesanan Lynk. Biasanya tidak lama." />
              {modeProduk ? (
                <Langkah n={4} keadaan={kodeTerbit ? 'sedang' : 'nanti'} judul={`Kode lisensi terbit — ambil ${namaProduk}`}
                         ket="Kodenya muncul di atas dan sudah terisi di Marketplace. Tempel sekali, produknya turun." />
              ) : (
                <Langkah n={4} keadaan="nanti" judul="Akses terbuka 30 hari"
                         ket="Berlaku otomatis di akun ini — tanpa kode, tanpa langkah tambahan." />
              )}
            </div>
          </div>
        )}

        {!sudahAktif && !kodeTerbit && (
          <p className="animate-fade-in delay-300 mt-5 text-[11.5px] leading-relaxed text-zinc-600">
            <KeyRound className="mr-1 inline size-3" />
            {modeProduk ? (
              <>Sudah punya kode lisensi produk ini?{' '}
                <Link to={`/marketplace?produk=${encodeURIComponent(produkIni)}`}
                  className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-200">
                  Tempel langsung di Marketplace
                </Link>{' '}
                — tidak perlu menunggu apa pun.</>
            ) : (
              <>Punya kode aktivasi dari pembelian sebelumnya?{' '}
                <Link to="/akses" className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-200">
                  Tukar di halaman akses
                </Link>{' '}
                — kode berlaku langsung tanpa menunggu ditinjau.</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
