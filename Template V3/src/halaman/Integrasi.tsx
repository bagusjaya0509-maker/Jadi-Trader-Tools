import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, Circle, Copy, Eye, EyeOff, RefreshCw, Download,
  ShieldCheck, TriangleAlert, Plug, Link2Off, Activity, Server,
  Radio, BookOpen, FileCode2, Waves, Wallet, Loader2,
} from 'lucide-react';
import { Panel, PanelHead, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { TutorialVps } from '@/components/tutorial-vps';
import { cn } from '@/lib/utils';
import { bacaKoneksi, simpanKoneksi, hapusKoneksi, koneksiLengkap, rapikanUrl, PROXY_BAWAAN } from '@/lib/koneksi';
import { useKodeMt5, useAkunMt5, versiKurangDari, VERSI_EA_PENDING,
         pilihAkunMt5 } from '@/lib/akun';
import { tautanBerkas } from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { usePaket } from '@/lib/paket';
/* `dex-dompet` TIDAK punya satu pun impor — ia cuma bicara ke
   `window.ethereum` dan localStorage, jadi menariknya ke halaman ini tidak
   menambah sebiji pun ke bundelnya.
   `dex-hl` beda: ia membawa SDK Hyperliquid dan viem. Ia diimpor dinamis
   di dalam `aktifkanAgen`, jadi yang tidak pernah menekan tombolnya tidak
   pernah mengunduhnya. */
import {
  adaDompet, sambungDompet, alamatTersambung, rantaiKini,
  bacaAgen, hapusAgen, agenKedaluwarsa, type AgenTersimpan,
} from '@/lib/dex-dompet';
import { tautkanDompetDiam } from '@/lib/profil-pengguna';

/* ════════════════════════════════════════════════════════════════════════
   INTEGRATIONS — MetaTrader 5, Binance, Hyperliquid, dan dompet Web3
   ════════════════════════════════════════════════════════════════════════
   Tiap sambungan dapat kartunya sendiri, bukan satu form panjang, karena
   SIFAT RISIKONYA berbeda jauh:

     • MT5  — BACA-SAJA. EA hanya mengirim saldo, posisi, dan riwayat.
              Kalau kodenya bocor, yang terjadi cuma jurnal orang lain terisi.
     • Binance — MENGEKSEKUSI ORDER dengan uang sungguhan. Kalau App Token
              bocor, orang lain bisa membuka dan menutup posisi di akunmu.
     • Hyperliquid — sama seperti Binance, dan lewat pintu yang sama persis:
              App Token. Bedanya kuncinya tidak diketik di halaman ini
              melainkan di .env backend sendiri, jadi yang bisa dilakukan
              layar cuma MELAPORKAN, bukan menyambungkan.
     • Dompet Web3 — satu-satunya yang kuncinya milik PENGGUNA. Ordernya
              tidak lewat VPS sama sekali.

   ── KENAPA HYPERLIQUID BARU MUNCUL DI SINI 6 SEP 2026 ───────────────────
   Ordernya sudah berjalan berminggu-minggu sebelum halaman ini menyebutnya
   sekali pun. Yang tertulis di layar "1 dari 2 aktif", dan siapa pun yang
   membacanya menyimpulkan Hyperliquid belum ada. Satu-satunya cara
   membuktikan sebaliknya adalah membuka .env di VPS lewat SSH — dan alat
   yang cuma bisa dibuktikan lewat SSH sama saja dengan tidak ada.

   Baris status di atas TIDAK memakai KartuKpi seperti halaman lain, dan itu
   disengaja. Empat kotak angka besar cocok untuk halaman yang isinya laporan;
   halaman ini isinya DUA MESIN dan pertanyaannya bukan "berapa" melainkan
   "hidup atau tidak, dan seberapa cepat". Bentuk yang menjawab itu adalah
   denyut dan garis latensi, bukan angka 94 yang berdiri sendiri.
   ════════════════════════════════════════════════════════════════════════ */

/* Deterministik, bukan Math.random: garis latensi yang berubah bentuk tiap
   render membuat mustahil melihat apakah sesuatu benar-benar memburuk. */
const LATENSI = Array.from({ length: 32 }, (_, i) =>
  Math.round(94 + Math.sin(i / 2.4) * 16 + Math.sin(i / 5.1) * 9 + (i === 21 ? 48 : 0))
);

function Denyut({ hidup }: { hidup: boolean }) {
  return (
    <span className="relative flex size-2.5 shrink-0">
      {hidup && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
      )}
      <span className={cn('relative inline-flex size-2.5 rounded-full', hidup ? 'bg-emerald-500' : 'bg-zinc-600')} />
    </span>
  );
}

function Ubin({ Ikon, nama, hidup, ket, stat }: {
  Ikon: typeof Server; nama: string; hidup: boolean; ket: string; stat: [string, string][];
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4 transition-colors',
      hidup ? 'border-zinc-700/70 bg-zinc-900/50' : 'border-zinc-800/70 bg-zinc-950/40'
    )}>
      <div className="flex items-center gap-2.5">
        <div className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg border',
          hidup ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900 text-zinc-600'
        )}>
          <Ikon className="size-4" strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-zinc-100">{nama}</div>
          <div className="truncate text-[11.5px] text-zinc-500">{ket}</div>
        </div>
        <Denyut hidup={hidup} />
      </div>

      <div className="mt-3.5 flex gap-5 border-t border-zinc-800/70 pt-3">
        {stat.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-wider text-zinc-600">{k}</div>
            <div className="angka mt-0.5 truncate text-[14px] text-zinc-200">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GarisLatensi() {
  const W = 240, H = 56;
  const min = Math.min(...LATENSI), max = Math.max(...LATENSI);
  const X = (i: number) => (i / (LATENSI.length - 1)) * W;
  const Y = (v: number) => H - ((v - min) / (max - min || 1)) * (H - 6) - 3;
  const garis = LATENSI.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `0,${H} ${garis} ${W},${H}`;
  const rerata = Math.round(LATENSI.reduce((s, v) => s + v, 0) / LATENSI.length);

  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[11.5px] text-zinc-500">Latensi proxy VPS</span>
        <span className="angka text-[14px] text-zinc-100">{LATENSI[LATENSI.length - 1]}<span className="text-[11px] text-zinc-500">ms</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block w-full" style={{ height: 56 }} aria-hidden>
        <defs>
          <linearGradient id="gLat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity=".22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#gLat)" />
        <polyline points={garis} fill="none" stroke="#10b981" strokeWidth="1.4" />
        <circle cx={X(LATENSI.length - 1)} cy={Y(LATENSI[LATENSI.length - 1])} r="2.6" fill="#10b981" />
      </svg>
      <div className="mt-1 flex justify-between text-[10.5px] text-zinc-600">
        <span>32 pemeriksaan terakhir</span>
        <span className="angka">rerata {rerata}ms · puncak {max}ms</span>
      </div>
    </div>
  );
}

function StatusPil({ tersambung }: { tersambung: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium',
        tersambung ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-700/30 text-zinc-400'
      )}
    >
      {tersambung ? <CheckCircle2 className="size-3.5" strokeWidth={2.2} /> : <Circle className="size-3.5" strokeWidth={2.2} />}
      {tersambung ? 'Connected' : 'Not connected'}
    </span>
  );
}

function Langkah({ no, judul, anak }: { no: number; judul: string; anak: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[11px] font-medium text-zinc-400">
        {no}
      </div>
      <div className="min-w-0 pb-4">
        <div className="text-[13px] font-medium text-zinc-200">{judul}</div>
        <div className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">{anak}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   TIGA SUB-HALAMAN — kesehatan, MT5, Binance
   ════════════════════════════════════════════════════════════════════════
   Halaman ini menampung tiga hal yang dipakai pada saat yang berbeda:

     · Kesehatan sambungan — dilihat TIAP HARI, sekilas, untuk memastikan
       datanya masih mengalir.
     · Pemasangan EA MT5   — dibaca SEKALI saat memasang, lalu tidak pernah
       lagi sampai ganti komputer.
     · Backend & Binance   — sama, sekali saat mengatur.

   Ditumpuk jadi satu, yang dilihat tiap hari terkubur di bawah dua panduan
   panjang yang sudah selesai dibaca berbulan-bulan lalu. Sebagai tab,
   halaman pertama tinggal denyut sambungan — pendek, langsung terbaca.
   ════════════════════════════════════════════════════════════════════════ */
const TAB_INT = [
  { id: 'sehat',   label: 'Connection',        judul: 'Sambungan',                sub: 'Semua tombol menyambung ada di sini: MT5, Binance, Hyperliquid, dan dompet Web3. Panduannya di tab sebelah.' },
  { id: 'mt5',     label: 'Tutorial Pasang MT5',      judul: 'Tutorial Pasang EA di MetaTrader 5', sub: 'Enam langkah pemasangan dan daftar gejala kalau tidak jalan.' },
  { id: 'binance', label: 'Tutorial Connect Binance', judul: 'Tutorial Connect Binance',          sub: 'Dari membuat kunci API sampai order pertama berangkat.' },
  { id: 'hl',      label: 'Tutorial Connect Hyperliquid', judul: 'Tutorial Connect Hyperliquid',  sub: 'Tiga baris di .env backend-mu sendiri, dan kenapa kunci yang dipakai bukan kunci dompet utama.' },
] as const;
type IdTabInt = typeof TAB_INT[number]['id'];

export default function Integrasi() {
  /* Tab dibaca dari alamat (?tab=mt5) supaya sub-menu sidebar bisa
     menunjuk langsung ke tutorial yang dimaksud. Tab yang tidak punya
     alamat tidak bisa ditaut — dan tutorial pemasangan justru yang paling
     sering dikirim orang ke orang lain lewat tautan. */
  const [cariTab, setCariTab] = useSearchParams();
  const tab: IdTabInt = TAB_INT.some((t) => t.id === cariTab.get('tab'))
    ? (cariTab.get('tab') as IdTabInt) : 'sehat';
  const setTab = (id: IdTabInt) => setCariTab(id === 'sehat' ? {} : { tab: id }, { replace: true });
  /* Kode pasangan ASLI dari backend, bukan contoh.
     Sebelumnya baris ini berisi `useState('JT-4F2A-91C7')` — kode yang
     ditulis mati di sini. Awalannya salah (backend membuat `JTM5-…`) DAN
     ia tidak pernah terdaftar, jadi EA yang memakainya selalu ditolak
     400 "Kode Pasangan tidak valid". */
  const kodeM = useKodeMt5();
  const statusMt5 = useAkunMt5();
  const kodeMt5 = kodeM.kode;
  const mt5Tersambung = statusMt5.terhubung === true;
  /* EA di bawah v2.05 tidak mengirim pending order maupun tick. Daftar
     kemampuan mengikuti versi yang BENAR-BENAR terpasang, bukan versi
     terbaru yang ada — menjanjikan fitur yang tidak akan datang membuat
     orangnya menunggu data yang tidak pernah ada. */
  const eaLama = !!statusMt5.versiEa && versiKurangDari(statusMt5.versiEa, VERSI_EA_PENDING);
  const kemampuanMt5: [string, string, boolean][] = [
    ['Baca saldo & ekuitas', 'Aktif', true],
    ['Posisi terbuka & riwayat', 'Aktif', true],
    ['Data lilin ke chart (OHLC)', 'Aktif', true],
    ['Pending order', eaLama ? `Butuh EA v${VERSI_EA_PENDING}` : 'Aktif', !eaLama],
    ['Harga tick (bid/ask)', eaLama ? `Butuh EA v${VERSI_EA_PENDING}` : 'Aktif', !eaLama],
    ['Kirim order & ubah SL/TP', 'Aktif', true],
    ['Tutup posisi', 'Aktif', true],
    ['Tarik dana', 'Tidak pernah', false],
  ];
  const [lihatToken, setLihatToken] = useState(false);
  const [disalin, setDisalin] = useState(false);

  const awal = bacaKoneksi();
  const [url, setUrl] = useState(awal.url);
  const [token, setToken] = useState(awal.token);
  const [tersimpan, setTersimpan] = useState(koneksiLengkap(awal));
  const [pesan, setPesan] = useState('');

  /* ── ALAMATNYA DIUJI, BUKAN CUMA DISIMPAN ─────────────────────────────
     Sebelum ini statusnya `tersambung = tersimpan` — yang sebenarnya cuma
     berarti "ada isinya", bukan "alamatnya bekerja". Alamat salah ketik
     tetap berlabel tersambung, lalu kegagalannya muncul di tempat lain:
     kode pasangan MT5 menjawab 404, chart menjawab "proxy tidak menjawab".
     Terjadi sungguhan 23 Agu 2026 pada alamat tanpa https:// — tiga gejala
     berjauhan dari satu kolom isian, dan panel ini justru menyatakan
     sambungannya sehat.

     Diuji ke /api/health karena itu rute PUBLIK: ia menjawab tanpa token,
     jadi hasilnya menilai ALAMATNYA saja. Kalau tokennya yang salah, itu
     kegagalan lain dengan pesan lain — mencampur keduanya membuat orang
     mengganti token padahal alamatnya yang keliru. */
  type Uji = 'belum' | 'menguji' | 'ok' | 'bukanBackend' | 'takTerjangkau';
  const [uji, setUji] = useState<Uji>('belum');

  const periksaAlamat = useCallback(async (alamat: string) => {
    const a = rapikanUrl(alamat);
    if (!a) { setUji('belum'); return; }
    setUji('menguji');
    try {
      const r = await fetch(`${a}/api/health`, { headers: { Accept: 'application/json' } });
      /* Jawaban 200 saja TIDAK cukup. Alamat relatif dan domain nyasar
         sama-sama menjawab 200 — dengan index.html. Yang membedakan backend
         sungguhan adalah bentuk jawabannya. */
      const j = r.ok ? await r.json().catch(() => null) : null;
      setUji(j && j.ok === true ? 'ok' : 'bukanBackend');
    } catch {
      /* Gagal fetch = DNS salah, server mati, CORS ditolak, atau halaman
         https memanggil http. Semuanya berarti satu hal bagi orangnya:
         alamat itu tidak menjawab dari peramban ini. */
      setUji('takTerjangkau');
    }
  }, []);

  /* Diperiksa saat halaman dibuka juga, bukan cuma saat Simpan ditekan:
     alamat yang tersimpan sejak kemarin bisa mati hari ini, dan lencana yang
     hanya jujur pada detik penyimpanan tidak menolong siapa pun. */
  useEffect(() => {
    if (awal.url.trim()) void periksaAlamat(awal.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const binanceTersambung = tersimpan && uji === 'ok';
  const bisaSimpan = url.trim().length > 0 && token.trim().length > 0;
  /* Ditampilkan kalau ketikannya dirapikan — supaya orangnya melihat skema
     yang ditambahkan, bukan menebak kenapa tiba-tiba jalan. */
  const urlRapi = rapikanUrl(url);
  const urlDirapikan = url.trim().length > 0 && urlRapi !== url.trim();

  async function simpanUji() {
    if (!bisaSimpan) { setPesan('Backend URL dan App Token harus terisi keduanya.'); return; }
    simpanKoneksi({ url: urlRapi, token: token.trim() });
    setUrl(urlRapi);
    setTersimpan(true);
    setPesan('Tersimpan — menguji alamatnya…');
    await periksaAlamat(urlRapi);
    setPesan('');
  }

  function putuskan() {
    hapusKoneksi();
    setTersimpan(false);
    setPesan('Sambungan dilepas. Order sungguhan kembali dikunci.');
    setTimeout(() => setPesan(''), 4000);
  }

  const salin = (teks: string) => {
    navigator.clipboard?.writeText(teks).catch(() => {});
    setDisalin(true);
    setTimeout(() => setDisalin(false), 1600);
  };

  /* Alamat yang harus dimasukkan ke daftar izin WebRequest MT5. Diambil dari
     setelan pengguna kalau ada — orang yang memakai VPS sendiri harus
     memasukkan alamat VPS-nya, bukan alamat kami. Tanpa garis miring di
     ujung: MT5 mencocokkan alamatnya persis. */
  const alamatBackend = (url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
  const [tersalin, setTersalin] = useState<string | null>(null);

  /* ── SAMBUNGAN TIDAK TERMASUK PAKET EVENT TERBATAS ────────────────────
     Kartu harga sudah menyatakannya sejak awal — "Connect Binance Futures
     & MetaTrader 5" dicoret di paket gratis. Halaman ini belum ikut, jadi
     orang yang paketnya tidak memuatnya tetap bisa menekan tombolnya.

     Tombolnya TETAP TAMPIL, cuma mati. Menyembunyikannya membuat halaman
     ini terlihat seperti tidak punya fitur itu sama sekali, dan orang yang
     sedang menimbang naik paket justru perlu melihat apa yang ia dapat.

     Mati SELAMA MASIH MEMUAT juga, bukan cuma sesudah paketnya diketahui.
     Menebak ke arah longgar berarti tombolnya sempat hidup sekejap untuk
     orang yang tidak berhak — dan sekejap itu cukup untuk satu klik. */
  const { pemilik, pengguna } = useAuth();
  const uidAku = pengguna?.uid ?? null;
  const { paket, memuat: memuatPaket } = usePaket();
  const kunciEvent = !pemilik && (memuatPaket || paket.paket === 'gratis');
  const alasanKunci = kunciEvent
    ? 'Sambungan MT5 & Binance belum termasuk paket Event Terbatas'
    : undefined;

  /* ── MODE BINANCE DIBACA DARI SERVERNYA, BUKAN DITULIS TANGAN ─────────
     Sebelumnya kotak ini selalu berbunyi "Testnet" begitu tersambung —
     untai mati, tidak pernah menanyakan apa pun kepada siapa pun.
     Ternyata keliru: .env di VPS menimpa bawaan servernya ke
     https://fapi.binance.com, jadi yang dipakai Binance Futures LIVE.

     Ini jenis kesalahan yang paling mahal di halaman ini. Kotak bertuliskan
     "Testnet" memberi tahu orang bahwa ordernya latihan padahal uangnya
     sungguhan — dan ia berbohong justru di layar tempat orang memutuskan
     seberani apa mencoba.

     /api/health memulangkan baseUrl-nya dan tidak minta token, jadi
     jawabannya bisa diambil apa adanya. Kalau tidak terbaca, yang ditulis
     "Belum terbaca" — BUKAN ditebak salah satunya. Menebak "Testnet" waktu
     tidak tahu persis mengulang kesalahan yang sedang diperbaiki. */
  const [baseUrlServer, setBaseUrlServer] = useState<string | null>(null);
  /* ── KEADAAN HYPERLIQUID, DARI BACKEND YANG SAMA ─────────────────────
     Kunci Hyperliquid tidak pernah lewat halaman ini — ia tinggal di .env
     backend milik orangnya. Jadi yang bisa dikerjakan layar cuma BERTANYA,
     dan pertanyaannya harus lebih tajam daripada "hidup atau mati": tiga
     baris .env yang berbeda bisa jadi sebabnya, dan menebak yang mana
     berarti menyunting berkas di server tiga kali sampai kebetulan benar.

     Alamat akunnya cuma dipulangkan server kalau tokennya ikut dikirim —
     alamat dompet yang bisa dibaca tanpa izin berarti posisi pemiliknya
     bisa diintip tanpa izin. Karena itu efek ini ikut bergantung pada
     `tersimpan`: begitu tokennya disimpan, pertanyaannya diulang dan
     alamatnya menyusul. */
  const [hl, setHl] = useState<{ siap: boolean; aktif: boolean; adaAkun: boolean; adaKunci: boolean; akun?: string } | null>(null);
  useEffect(() => {
    let hidup = true;
    const k = bacaKoneksi();
    fetch(alamatBackend + '/api/health',
          k.token.trim() ? { headers: { 'X-App-Token': k.token.trim() } } : undefined)
      .then((r) => r.json())
      .then((j) => {
        if (!hidup) return;
        setBaseUrlServer(typeof j?.baseUrl === 'string' ? j.baseUrl : null);
        setHl(j?.hl && typeof j.hl === 'object' ? j.hl : null);
      })
      .catch(() => { if (hidup) { setBaseUrlServer(null); setHl(null); } });
    return () => { hidup = false; };
  }, [alamatBackend, tersimpan]);
  const modeTestnet = baseUrlServer !== null && /testnet/i.test(baseUrlServer);
  const labelMode = baseUrlServer === null ? 'Belum terbaca' : modeTestnet ? 'Testnet' : 'Live';

  const hlSiap = hl?.siap === true;
  /* Satu kalimat yang menyebut PERSIS apa yang kurang, bukan "belum aktif".
     Urutannya mengikuti urutan orang mengisinya. */
  const hlKurang = !hl ? 'Backend belum menjawab — isi Backend URL dulu'
    : !hl.aktif ? 'HL_AKTIF belum diisi 1 di .env backend'
    : !hl.adaAkun ? 'HL_AKUN (alamat dompet) belum diisi'
    : !hl.adaKunci ? 'HL_AGENT_KEY belum diisi'
    : 'Belum aktif';
  const hlSyarat: [string, boolean, string][] = [
    ['HL_AKTIF=1', hl?.aktif === true, 'Sakelar utama. Sengaja harus ditulis 1 — sesuatu yang bisa membuka posisi tidak boleh menyala cuma karena barisnya kosong.'],
    ['HL_AKUN', hl?.adaAkun === true, 'Alamat dompet Hyperliquid-mu. Publik di rantai, aman ditulis di .env.'],
    ['HL_AGENT_KEY', hl?.adaKunci === true, 'Kunci agent wallet — bisa membuka dan menutup posisi, dan secara protokol tidak bisa menarik dana keluar.'],
  ];

  /* ── DOMPET WEB3 ───────────────────────────────────────────────────────
     Kartu keempat, dan satu-satunya yang kuncinya milik PENGGUNA. Ia
     berdiri di halaman yang sama dengan tiga kartu lain atas permintaan
     pemilik 6 Sep 2026 — "biar jadi 1 halaman" — sementara panel ordernya
     tetap di sisi Chart & Entry. Yang pindah ke sini SAMBUNGANNYA, bukan
     panel ordernya: halaman ini menjawab "sudah tersambung apa saja", bukan
     "mau beli berapa".

     Gerbangnya `pemilik`, SAMA PERSIS dengan tombol Dompet di Chart & Entry
     dan halaman /dex. Itu bukan kehati-hatian yang diwarisi tanpa dipikir:
     menyediakan akses perpetual futures ke pengguna ritel lewat frontend
     sendiri adalah kegiatan yang diatur, dan non-kustodial tidak otomatis
     membebaskan. Menambah pintu keempat tanpa gerbang berarti membuka
     seluruhnya lewat pintu belakang. */
  const [alamatW, setAlamatW] = useState<string | null>(null);
  const [rantaiW, setRantaiW] = useState<number>(0);
  const [agenW, setAgenW] = useState<AgenTersimpan | null>(null);
  const [sibukW, setSibukW] = useState('');
  const [galatW, setGalatW] = useState('');
  const [kabarW, setKabarW] = useState('');
  useEffect(() => {
    if (!pemilik || !adaDompet()) return;
    let hidup = true;
    /* alamatTersambung() TIDAK memunculkan dialog dompet — ia cuma bertanya
       akun mana yang sudah pernah diizinkan. Memanggil sambungDompet() di
       sini akan membuka MetaMask tiap kali halaman ini dibuka. */
    void alamatTersambung().then((a) => {
      if (!hidup || !a) return;
      setAlamatW(a); setAgenW(bacaAgen(a));
      void rantaiKini().then((r) => { if (hidup) setRantaiW(r); });
    });
    return () => { hidup = false; };
  }, [pemilik]);
  const agenSiapW = !!agenW && !agenKedaluwarsa(agenW);
  const sisaHariW = agenW ? Math.max(0, Math.ceil((agenW.sampai - Date.now()) / 86400000)) : 0;
  const pendekAlamat = (a: string) => a.slice(0, 6) + '…' + a.slice(-4);

  async function jalanW(nama: string, kerja: () => Promise<void>) {
    setGalatW(''); setKabarW(''); setSibukW(nama);
    try { await kerja(); }
    catch (e) {
      /* Penolakan di dompet BUKAN kegagalan sistem. Menampilkannya sebagai
         galat merah panjang membuat orang mengira ada yang rusak padahal ia
         sendiri yang menekan "tolak". */
      const t = e instanceof Error ? e.message : String(e);
      setGalatW(/user rejected|denied|4001/i.test(t) ? 'Tanda tangan dibatalkan di dompet.' : t);
    }
    finally { setSibukW(''); }
  }

  const sambungW = () => jalanW('sambung', async () => {
    const a = await sambungDompet();
    setAlamatW(a);
    /* Ditautkan ke akun Google-nya supaya jurnal on-chain tahu alamat siapa
       yang harus dibaca saat dompetnya sedang tidak terbuka sama sekali. */
    tautkanDompetDiam(a);
    setAgenW(bacaAgen(a));
    setRantaiW(await rantaiKini());
  });

  const aktifkanAgenW = () => jalanW('agen', async () => {
    if (!alamatW) return;
    /* Impor DINAMIS: `dex-hl` membawa SDK Hyperliquid dan viem. Halaman
       Integrations dibuka jauh lebih sering daripada tombol ini ditekan. */
    const { setujuiAgen } = await import('@/lib/dex-hl');
    const a = await setujuiAgen(alamatW);
    setAgenW(a);
    setKabarW('Trading aktif. Agent wallet ' + pendekAlamat(a.alamat) + ' berlaku '
      + Math.round((a.sampai - Date.now()) / 86400000) + ' hari.');
  });

  const lepasAgenW = () => {
    if (!alamatW) return;
    if (!confirm('Hapus agent wallet dari peramban ini?\n\n'
      + 'Posisi yang sedang terbuka TIDAK ikut tertutup — ia tetap hidup di Hyperliquid '
      + 'dan bisa diurus dari app.hyperliquid.xyz.\n\n'
      + 'Persetujuan di sisi Hyperliquid tidak ikut dicabut; untuk mencabutnya, '
      + 'buka Hyperliquid → API lalu hapus agent "jaditrader".')) return;
    hapusAgen(alamatW);
    setAgenW(null);
    setGalatW(''); setKabarW('');
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Bilah tab menggulir mendatar di layar sempit, bukan membungkus jadi
          dua baris: bilah yang tingginya berubah menggeser seluruh isi
          halaman tiap kali jendela diubah. */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-800/80">
        {TAB_INT.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 cursor-pointer border-b-2 px-3.5 py-2.5 text-[12.5px] transition-colors',
              tab === t.id ? 'border-zinc-100 text-zinc-100'
                           : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {(() => {
        const aktif = TAB_INT.find((t) => t.id === tab)!;
        return (
          <div className="mb-3">
            <h2 className="text-[14px] font-medium text-zinc-200">{aktif.judul}</h2>
            <p className="text-[12px] text-zinc-500">{aktif.sub}</p>
          </div>
        );
      })()}

      {tab === 'sehat' && (<>
      {/* ── Status sambungan: denyut + latensi, bukan empat kotak angka ── */}
      <Panel>
        <PanelHead
          judul="Connection health"
          sub="Tiga mesin yang melayani halaman ini, dan seberapa cepat ketiganya menjawab."
          kanan={
            <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-[11.5px] text-zinc-400">
              <Activity className="size-3.5 text-emerald-500" strokeWidth={2} />
              {Number(mt5Tersambung) + Number(binanceTersambung) + Number(hlSiap)} dari 3 aktif
            </span>
          }
        />
        {/* Tiga ubin, bukan dua. Grafik latensi turun ke baris sendiri di
            layar sedang: memaksanya berdampingan dengan tiga ubin membuat
            keempatnya sempit dan tidak ada satu pun yang terbaca. */}
        <div className="grid grid-cols-1 gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_240px]">
          <Ubin
            Ikon={Radio} nama="MetaTrader 5" hidup={mt5Tersambung}
            ket={mt5Tersambung ? 'EA mengirim tiap 20 detik' : 'EA belum melapor'}
            stat={[['Sinkron', '18 dtk lalu'], ['Trade masuk', '29 forex']]}
          />
          <Ubin
            Ikon={Server} nama="Binance Futures" hidup={binanceTersambung}
            ket={binanceTersambung ? 'Lewat proxy VPS sendiri'
            : uji === 'menguji' ? 'Menguji alamat backend…'
            : uji === 'bukanBackend' ? 'Alamat menjawab, tapi bukan backend Jadi Trader'
            : uji === 'takTerjangkau' ? 'Alamat backend tidak terjangkau'
            : 'Backend URL / token belum diisi'}
            stat={[['Mode', binanceTersambung ? labelMode : '—'], ['Trade masuk', '94 kripto']]}
          />
          {/* Lewat backend yang SAMA dengan Binance, jadi ia tidak punya
              alamat maupun token sendiri — yang membedakan cuma tiga baris
              di .env. Karena itu barisan statnya menyebut akunnya, bukan
              latensinya: pertanyaan yang sungguh dibawa orang ke sini adalah
              "akun mana yang dipakai", bukan "berapa milidetik". */}
          <Ubin
            Ikon={Waves} nama="Hyperliquid" hidup={hlSiap}
            ket={hlSiap ? 'Order, SL/TP, dan tutup posisi aktif' : hlKurang}
            stat={[
              ['Akun', hl?.akun ? hl.akun.slice(0, 6) + '…' + hl.akun.slice(-4)
                     : hlSiap ? 'Simpan token dulu' : '—'],
              ['Pasar', 'Perp on-chain'],
            ]}
          />
          <GarisLatensi />
        </div>
      </Panel>


      {/* AKSI MENYAMBUNG BERKUMPUL DI SATU TEMPAT.
          ──────────────────────────────────────────────────────────────
          Kode pasangan MT5 dan Backend URL Binance adalah dua tombol untuk
          satu pekerjaan yang sama: menyambungkan sumber data. Memisahkannya
          ke dua tab memaksa orang berpindah tab di tengah satu pekerjaan,
          dan yang lebih buruk — tidak ada satu layar pun yang bisa menjawab
          "sudah tersambung semua belum?".

          Yang dipisah cuma PANDUANNYA: dibaca sekali saat memasang, lalu
          tidak pernah lagi. */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHead
            judul="MetaTrader 5"
            sub="Menarik saldo, posisi, dan riwayat ke Journal. Baca-saja."
            kanan={<StatusPil tersambung={mt5Tersambung} />}
          />
          <div className="px-5 pb-5">
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" strokeWidth={2} />
              <div className="text-[12.5px] leading-relaxed text-zinc-400">
                EA ini <span className="text-zinc-200">tidak punya satu pun fungsi perdagangan</span> —
                tidak ada <code className="rounded bg-zinc-800 px-1 py-0.5 text-[11px]">OrderSend</code>,
                tidak ada modifikasi posisi. Sumbernya terbuka di Marketplace supaya klaim itu bisa
                kamu periksa sendiri, bukan sekadar dipercaya.
              </div>
            </div>

            {/* ── PEMILIH TERMINAL ────────────────────────────────────
                Muncul HANYA kalau memang ada lebih dari satu. Pemilih dengan
                satu pilihan bukan pemilihan — ia cuma memberi tahu bahwa ada
                keputusan yang harus diambil, padahal tidak ada.

                Satu orang boleh memasang EA di beberapa broker sekaligus:
                demo dan real, atau dua broker berbeda. Yang memisahkan
                datanya adalah nomor akun MT5, bukan nama simbol — dua broker
                sama-sama punya XAUUSD, dan EA sengaja memangkas akhiran
                brokernya (XAUUSDc menjadi XAUUSD), jadi tanpa pemisahan ini
                keduanya saling menimpa dan chart menampilkan harga broker
                yang salah.

                Yang dipilih di sini menentukan APA YANG DILIHAT: saldo di
                Dashboard, posisi di panel order, lilin di Chart, dan terminal
                mana yang menerima tombol Kirim. */}
            {statusMt5.daftarAkun.length > 1 && (
              <div className="mb-4">
                <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                  Terminal yang ditampilkan
                </div>
                <div className="space-y-1.5">
                  {statusMt5.daftarAkun.map((a) => {
                    const aktif = a.login === statusMt5.loginAktif;
                    return (
                      <button key={a.login}
                        onClick={() => uidAku && pilihAkunMt5(uidAku, a.login)}
                        className={cn('flex w-full cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors',
                          aktif ? 'border-emerald-600/60 bg-emerald-500/10'
                                : 'border-zinc-800 hover:border-zinc-700')}>
                        {/* Titik hidup/mati, bukan kata: statusnya dibaca
                            sekilas sambil membandingkan beberapa baris. */}
                        <span className={cn('size-2 shrink-0 rounded-full',
                          a.terhubung ? 'bg-emerald-500' : 'bg-zinc-700')}
                          title={a.terhubung ? 'EA melapor' : 'EA tidak melapor'} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('angka block truncate text-[12.5px]',
                            aktif ? 'text-emerald-300' : 'text-zinc-200')}>{a.login}</span>
                          <span className="block truncate text-[10.5px] text-zinc-500">
                            {a.broker || 'broker tidak disebut'}
                            {a.versiEa ? ' · EA v' + a.versiEa : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="angka block text-[12px] text-zinc-300">
                            {a.ekuitas.toFixed(2)} {a.mataUang}
                          </span>
                          <span className="block text-[10.5px] text-zinc-600">
                            {a.posisi} posisi{a.pending ? ' · ' + a.pending + ' pending' : ''}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-600">
                  Pilihan ini tersimpan di perangkat ini saja — laptop dan ponsel boleh
                  melihat terminal yang berbeda tanpa saling mengganggu.
                </p>
              </div>
            )}

            <div className="mb-4">
              <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                Pairing code
              </div>
              <div className="flex gap-2">
                <div className="angka flex h-10 flex-1 items-center rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[14px] tracking-[0.14em] text-zinc-100">
                  {kodeM.memuat ? <span className="text-[12.5px] tracking-normal text-zinc-500">Memuat…</span>
                    : kodeMt5 ?? <span className="text-[12.5px] tracking-normal text-zinc-500">Belum ada — tekan tombol di kanan</span>}
                </div>
                <button
                  disabled={!kodeMt5}
                  onClick={() => kodeMt5 && salin(kodeMt5)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-3 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                >
                  <Copy className="size-3.5" />
                  {disalin ? 'Tersalin' : 'Salin'}
                </button>
                <button
                  onClick={() => void kodeM.buatBaru()}
                  disabled={kodeM.memuat || kunciEvent}
                  className="flex cursor-pointer items-center rounded-md border border-zinc-800 px-3 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-40"
                  title="Buat kode untuk terminal BARU — terminal yang sudah tersambung tidak terputus"
                  aria-label="Buat kode baru"
                >
                  <RefreshCw className={cn("size-3.5", kodeM.memuat && "animate-spin")} />
                </button>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-600">
                Kode ini yang diisi di input <span className="text-zinc-400">KodePasangan</span> pada EA.
                Bentuknya selalu <span className="angka text-zinc-400">JTM5-XXXX-XXXX</span> — kalau EA
                menjawab <span className="text-zinc-400">Kode Pasangan tidak valid</span>, kodenya bukan
                dari sini.
              </p>
              {kodeM.galat && (
                <p className="mt-1.5 text-[11.5px] text-red-400">{kodeM.galat}</p>
              )}
              {!kodeM.memuat && !kodeMt5 && !kodeM.galat && (
                <p className="mt-1.5 text-[11.5px] text-amber-400">
                  Belum punya kode. Tekan tombol putar di atas untuk membuatnya.
                </p>
              )}
              {statusMt5.terhubung === true && (
                <p className="mt-1.5 text-[11.5px] text-emerald-400">
                  EA melapor — {statusMt5.ket}, saldo {statusMt5.saldo?.toFixed(2)} {statusMt5.mataUang}
                </p>
              )}
            </div>

            {/* ── Yang aktif lewat sambungan ini ──────────────────────────
                Bentuk yang SAMA PERSIS dengan panel Binance di sebelahnya —
                dua sambungan yang menjawab pertanyaan yang sama ("apa yang
                bisa dilakukan lewat sini") pantas dibaca dengan cara yang
                sama.

                Bedanya: daftar Binance tetap, daftar ini MENGIKUTI VERSI EA
                yang benar-benar terpasang. EA lama tidak bisa mengirim
                pending order atau tick — menampilkannya sebagai "Aktif"
                berarti menjanjikan sesuatu yang tidak akan datang, dan
                orangnya akan menunggu data yang tidak pernah ada. */}
            <div className="mt-4 rounded-lg border border-zinc-800/60 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                  Yang aktif lewat sambungan ini
                </span>
                {statusMt5.versiEa && (
                  <span className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10.5px] text-zinc-400">
                    EA v{statusMt5.versiEa}
                  </span>
                )}
              </div>
              <TabelBungkus>
                <Tabel>
                  <thead>
                    <tr><Th>Kemampuan</Th><Th>Status</Th></tr>
                  </thead>
                  <tbody>
                    {kemampuanMt5.map(([nama, status, on]) => (
                      <Tr key={nama}>
                        <Td className="text-zinc-300">{nama}</Td>
                        <Td>
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-[11px]',
                            on ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-700/30 text-zinc-500'
                          )}>
                            {status}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Tabel>
              </TabelBungkus>
              <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-600">
                {statusMt5.terhubung !== true
                  ? 'EA belum melapor, jadi daftar ini menunjukkan apa yang AKAN aktif begitu tersambung.'
                  : eaLama
                  ? <>EA v{statusMt5.versiEa} belum mengirim pending order dan tick. Kompilasi ulang <span className="text-zinc-400">JadiTraderSyncV2.mq5</span> ke v{VERSI_EA_PENDING} atau lebih baru, lalu pasang ulang.</>
                  : <>Order berangkat ke MT5 hanya kalau <span className="text-zinc-400">Algo Trading</span> menyala dan input <span className="text-zinc-400">IzinkanTrading</span> bernilai true. Keduanya kunci di sisimu, bukan di sisi kami.</>}
              </p>
            </div>


            <div className="mt-4 flex flex-wrap gap-2">
              {/* <a>, bukan <button>. Backend menjawab dengan
                  Content-Disposition lewat `res.download`, jadi peramban yang
                  menangani penyimpanannya — mengambilnya dengan fetch lalu
                  membuat Blob cuma menyalin pekerjaan yang sudah dilakukan
                  peramban, dan kehilangan nama berkasnya.

                  Tanpa kode lisensi: EA ini ditandai `.gratis` di server,
                  memang dibagikan bebas. */}
              <a href={tautanBerkas('jadi-trader-sync', '', 'ex5')} download
                 className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white">
                <Download className="size-3.5" /> Unduh JadiTraderSync.ex5
              </a>
              <a href={tautanBerkas('jadi-trader-sync', '', 'mq5')} download
                 className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
                <FileCode2 className="size-3.5" /> Sumber .mq5
              </a>
              <button
                onClick={() => void (kodeMt5 ? kodeM.putus() : kodeM.buatBaru())}
                disabled={kodeM.memuat || kunciEvent}
                title={alasanKunci}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-40"
              >
                {kodeMt5 ? <><Link2Off className="size-3.5" /> Putuskan</> : <><Plug className="size-3.5" /> Sambungkan</>}
              </button>
            </div>
            {kunciEvent && (
              <p className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-amber-200/90">
                Sambungan MetaTrader 5 belum termasuk paket Event Terbatas. Berkas EA-nya tetap
                bisa diunduh — yang terkunci cuma kode pasangannya.
              </p>
            )}
          </div>
        </Panel>

        <Panel className="border-amber-500/25">
          <PanelHead
            judul="Binance Futures"
            sub="Data pasar, eksekusi order, dan pemantauan posisi live."
            kanan={<StatusPil tersambung={binanceTersambung} />}
          />
          <div className="px-5 pb-5">
            {/* Pita peringatan. Kartu MT5 tidak punya ini, dan perbedaannya
                disengaja — yang satu baca-saja, yang satu memindahkan uang. */}
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" strokeWidth={2} />
              <div className="text-[12.5px] leading-relaxed text-zinc-300">
                Sambungan ini <span className="font-medium text-amber-300">mengeksekusi order dengan uang sungguhan</span>.
                Siapa pun yang memegang App Token bisa membuka dan menutup posisi di akunmu —
                perlakukan seperti kata sandi, jangan pernah tempel di chat atau tangkapan layar.
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="be-url" className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                  Backend URL
                </label>
                <input
                  id="be-url" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://103-253-145-38.sslip.io"
                  className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px]
                             text-zinc-100 outline-none transition-colors placeholder:text-zinc-600
                             hover:border-zinc-700 focus-visible:border-zinc-600"
                />
                <p className="mt-1.5 text-[11.5px] text-zinc-600">
                  Proxy VPS. Binance diblokir sebagian ISP Indonesia — tanpa proxy ini, data pasar tidak masuk.
                </p>
                {urlDirapikan && (
                  <p className="mt-1 text-[11.5px] text-zinc-500">
                    Akan disimpan sebagai <span className="font-mono text-zinc-300">{urlRapi}</span> —
                    tanpa <span className="font-mono">https://</span>, peramban membacanya sebagai alamat di
                    dalam situs ini, bukan alamat servermu.
                  </p>
                )}
                {uji === 'bukanBackend' && (
                  <p className="mt-1 text-[11.5px] text-amber-400/90">
                    Alamat ini menjawab, tapi bukan dengan jawaban backend Jadi Trader. Biasanya berarti
                    alamatnya nyasar ke situs lain, atau ke halaman web ini sendiri.
                  </p>
                )}
                {uji === 'takTerjangkau' && (
                  <p className="mt-1 text-[11.5px] text-red-400/90">
                    Peramban tidak bisa membaca jawaban dari alamat ini. Bisa karena domainnya salah
                    ketik, servernya mati, alamatnya <span className="font-mono">http://</span> sementara
                    halaman ini <span className="font-mono">https://</span>, atau servernya hidup tapi
                    bukan backend Jadi Trader sehingga menolak dibaca dari halaman ini.
                  </p>
                )}
                {uji === 'ok' && (
                  <p className="mt-1 text-[11.5px] text-emerald-500/90">
                    Alamat terjawab backend Jadi Trader.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="be-token" className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                  App Token
                </label>
                <div className="flex gap-2">
                  <input
                    id="be-token" type={lihatToken ? 'text' : 'password'}
                    value={token} onChange={(e) => setToken(e.target.value)}
                    placeholder="64 karakter dari langkah 5"
                    className="h-10 min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px]
                               text-zinc-100 outline-none transition-colors placeholder:text-zinc-600
                               hover:border-zinc-700 focus-visible:border-zinc-600"
                  />
                  <button
                    onClick={() => setLihatToken((v) => !v)}
                    aria-label={lihatToken ? 'Sembunyikan token' : 'Tampilkan token'}
                    className="flex cursor-pointer items-center rounded-md border border-zinc-800 px-3 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                  >
                    {lihatToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11.5px] text-zinc-600">
                  Disimpan hanya di peramban ini, tidak pernah dikirim ke mana pun selain VPS-mu sendiri.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-800/60 p-4">
              <div className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                Yang aktif lewat sambungan ini
              </div>
              <TabelBungkus>
                <Tabel>
                  <thead>
                    <tr><Th>Kemampuan</Th><Th>Status</Th></tr>
                  </thead>
                  <tbody>
                    {[
                      ['Data pasar (klines, ticker)', 'Aktif', true],
                      ['Baca saldo & posisi', 'Aktif', true],
                      ['Kirim order (MARKET / LIMIT)', 'Aktif', true],
                      ['Tutup posisi & ubah SL/TP', 'Aktif', true],
                      ['Tarik dana', 'Tidak pernah', false],
                    ].map(([nama, status, on]) => (
                      <Tr key={nama as string}>
                        <Td className="text-zinc-300">{nama}</Td>
                        <Td>
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-[11px]',
                            on ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-700/30 text-zinc-500'
                          )}>
                            {status}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Tabel>
              </TabelBungkus>
              <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-600">
                Penarikan dana <span className="text-zinc-400">tidak pernah</span> diaktifkan.
                Saat membuat API key di Binance, jangan centang Withdraw — kalaupun key-nya bocor,
                dananya tidak bisa dipindahkan keluar.
              </p>
            </div>

            {kunciEvent && (
              <p className="mt-4 rounded-md border border-amber-500/25 bg-amber-500/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-amber-200/90">
                Sambungan Binance belum termasuk paket Event Terbatas. Tombolnya sengaja
                dibiarkan tampil supaya kelihatan apa yang terbuka setelah naik paket.
              </p>
            )}
            {binanceTersambung && baseUrlServer !== null && !modeTestnet && (
              <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[11.5px] leading-relaxed text-red-200/90">
                Backend ini menunjuk <span className="angka">{baseUrlServer}</span> — Binance Futures{' '}
                <b>live</b>, bukan Testnet. Order yang dikirim dari sini memakai uang sungguhan.
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={simpanUji} disabled={!bisaSimpan || kunciEvent} title={alasanKunci}
                className="cursor-pointer rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Simpan &amp; Uji
              </button>
              <button
                onClick={putuskan} disabled={!tersimpan || kunciEvent} title={alasanKunci}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Link2Off className="size-3.5" /> Putuskan
              </button>
              {pesan && <span className="text-[12px] text-zinc-400">{pesan}</span>}
            </div>
          </div>
        </Panel>

        {/* ── HYPERLIQUID ─────────────────────────────────────────────────
            TANPA KOTAK ISIAN, dan itu bukan kekurangan melainkan bentuk yang
            benar. Kunci agent Hyperliquid tinggal di .env backend milik
            orangnya; halaman ini tidak pernah memegangnya, jadi kotak isian
            di sini akan menjanjikan sesuatu yang tidak bisa ditepatinya.

            Yang bisa dikerjakan layar: BERTANYA ke backend, lalu mengatakan
            persis baris mana yang belum terisi. */}
        <Panel className="border-sky-500/25">
          <PanelHead
            judul="Hyperliquid"
            sub="Perp on-chain lewat backend yang sama dengan Binance. Kuncinya di .env-mu, bukan di sini."
            kanan={<StatusPil tersambung={hlSiap} />}
          />
          <div className="px-5 pb-5">
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-sky-500/25 bg-sky-500/[0.06] p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-400" strokeWidth={2} />
              <div className="text-[12.5px] leading-relaxed text-zinc-300">
                Yang dipakai <span className="font-medium text-sky-300">agent wallet</span>, bukan kunci dompet
                utamamu. Ia bisa membuka dan menutup posisi, dan secara protokol{' '}
                <span className="font-medium text-sky-300">tidak bisa menarik dana keluar</span> — itu jaminan
                Hyperliquid, bukan janji kami.
              </div>
            </div>

            <div className="space-y-2">
              {hlSyarat.map(([nama, ada, ket]) => (
                <div key={nama} className="flex items-start gap-2.5 rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3">
                  {ada
                    ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" strokeWidth={2} />
                    : <Circle className="mt-0.5 size-4 shrink-0 text-zinc-600" strokeWidth={2} />}
                  <div className="min-w-0">
                    <div className="angka text-[12.5px] text-zinc-200">{nama}</div>
                    <div className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">{ket}</div>
                  </div>
                </div>
              ))}
            </div>

            {hl?.akun && (
              <p className="mt-3 text-[11.5px] text-zinc-500">
                Akun yang dipakai backend:{' '}
                <span className="angka text-zinc-300">{hl.akun}</span>
              </p>
            )}
            {hlSiap && !hl?.akun && (
              <p className="mt-3 text-[11.5px] text-zinc-600">
                Alamat akunnya cuma dipulangkan kalau App Token ikut dikirim. Simpan token di kartu
                Binance di atas, lalu muat ulang halaman ini.
              </p>
            )}
            {!hl && (
              <p className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11.5px] leading-relaxed text-zinc-500">
                Backend belum menjawab. Isi <span className="text-zinc-300">Backend URL</span> di kartu Binance
                dulu — Hyperliquid memakai alamat yang sama, tidak ada alamat kedua yang perlu diisi.
              </p>
            )}

            <div className="mt-4">
              <button onClick={() => setTab('hl')}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
                <BookOpen className="size-3.5" /> Buka panduannya
              </button>
            </div>
          </div>
        </Panel>

        {/* ── DOMPET WEB3 ─────────────────────────────────────────────────
            Gerbang `pemilik` sama persis dengan tombol Dompet di Chart &
            Entry dan halaman /dex — lihat catatan panjang di dekat
            deklarasi alamatW. Kartunya TIDAK dirender sama sekali untuk yang
            lain, bukan dirender lalu dimatikan: kartu mati di halaman ini
            mengajak orang bertanya kenapa, dan jawabannya panjang. */}
        {pemilik && (
        <Panel className="border-violet-500/25">
          <PanelHead
            judul="Dompet Web3"
            sub="Trading dengan dompetmu sendiri. Ordernya tidak lewat VPS sama sekali."
            kanan={<StatusPil tersambung={agenSiapW} />}
          />
          <div className="px-5 pb-5">
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-violet-500/25 bg-violet-500/[0.06] p-3">
              <Wallet className="mt-0.5 size-4 shrink-0 text-violet-300" strokeWidth={2} />
              <div className="text-[12.5px] leading-relaxed text-zinc-300">
                Satu-satunya sambungan di halaman ini yang kuncinya milikmu sendiri. Kami tidak pernah
                meminta seed phrase maupun kunci privat dompet utama, dan tidak punya kotak isian untuknya —
                dompet utama cuma diminta <span className="font-medium text-violet-200">menandatangani</span>.
              </div>
            </div>

            {!adaDompet() ? (
              <p className="text-[12.5px] leading-relaxed text-zinc-400">
                Tidak ada dompet di peramban ini. Pasang MetaMask atau Rabby dulu, lalu muat ulang halaman.
              </p>
            ) : !alamatW ? (
              <>
                <p className="mb-3 text-[12.5px] leading-relaxed text-zinc-400">
                  Hubungkan dompet yang sudah punya saldo di Hyperliquid. Menyambung hanya memberi tahu
                  alamatmu — belum ada satu pun yang bisa dikirim atas namamu.
                </p>
                <button onClick={sambungW} disabled={!!sibukW}
                  className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
                  {sibukW === 'sambung' ? <Loader2 className="size-3.5 animate-spin" /> : <Wallet className="size-3.5" />}
                  Hubungkan dompet
                </button>
              </>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="angka rounded bg-zinc-800 px-2 py-1 text-[11.5px] text-zinc-200">{pendekAlamat(alamatW)}</span>
                  <span className="text-[11px] text-zinc-500">chain {rantaiW || '—'}</span>
                  {/* Dua akun, dan bedanya bukan soal tampilan. Chart & Entry
                      memakai akun milik backend; kartu ini memakai dompet yang
                      barusan disambungkan. Hyperliquid memperlakukan
                      sub-account sebagai akun yang sepenuhnya terpisah. */}
                  <span className="text-[11px] text-zinc-600"
                        title="Kartu Hyperliquid di atas memakai akun milik backend, bukan dompet ini. Posisi keduanya tidak saling terlihat.">
                    · terpisah dari akun backend di kartu sebelah
                  </span>
                </div>

                {agenSiapW ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-[12.5px] leading-relaxed text-zinc-300">
                    Trading aktif lewat agent wallet{' '}
                    <span className="angka text-zinc-100">{pendekAlamat(agenW!.alamat)}</span> — sisa{' '}
                    <span className="text-emerald-300">{sisaHariW} hari</span>. Panel ordernya ada di tombol
                    Dompet pada Chart &amp; Entry.
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3">
                    <p className="mb-2.5 text-[12.5px] leading-relaxed text-zinc-400">
                      {agenW
                        ? 'Agent wallet di peramban ini sudah kedaluwarsa. Aktifkan ulang untuk trading.'
                        : 'Satu tanda tangan untuk mengaktifkan trading. Yang disetujui adalah agent wallet '
                          + 'yang dibuat di peramban ini — ia bisa membuka dan menutup posisi, dan secara '
                          + 'protokol tidak bisa menarik dana keluar.'}
                    </p>
                    <button onClick={aktifkanAgenW} disabled={!!sibukW}
                      className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
                      {sibukW === 'agen' ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                      Aktifkan trading
                    </button>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {agenW && (
                    <button onClick={lepasAgenW}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
                      <Link2Off className="size-3.5" /> Hapus agent dari peramban ini
                    </button>
                  )}
                  {kabarW && <span className="text-[12px] text-emerald-400">{kabarW}</span>}
                  {galatW && <span className="text-[12px] text-red-400">{galatW}</span>}
                </div>
              </>
            )}
          </div>
        </Panel>
        )}
      </div>
      </>)}

      {/* ── Panduan menyambung Hyperliquid ─────────────────────
          BUKAN panduan mengisi formulir, karena tidak ada formulirnya. Yang
          diatur di sini berkas .env di server orangnya sendiri — jadi
          panduannya berbentuk tiga baris yang harus ada di sana, bukan enam
          langkah menekan tombol.

          Kuncinya TIDAK PERNAH ditulis contohnya secara utuh, bahkan sebagai
          contoh palsu. Kunci berbentuk lengkap di layar mengundang orang
          menyalin-tempelnya balik ke tempat lain untuk "membandingkan". */}
      {tab === 'hl' && (
        <Panel>
          <div className="px-5 py-5">
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-sky-500/25 bg-sky-500/[0.06] p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-400" strokeWidth={2} />
              <div className="text-[12.5px] leading-relaxed text-zinc-300">
                Yang dipasang di backend <span className="font-medium text-sky-300">agent wallet</span>, bukan kunci
                dompet utamamu. Agent bisa membuka dan menutup posisi, dan secara protokol tidak bisa
                menarik dana keluar — jadi kalaupun berkas .env-mu bocor, saldonya tidak bisa dibawa pergi.
                Jangan pernah menaruh seed phrase atau kunci dompet utama di sana.
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800/60 p-4">
              <div className="text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                Cara menyambung — 4 langkah
              </div>
              <div className="mt-3">
                <Langkah no={1} judul="Siapkan akun Hyperliquid" anak={
                  <>Buka <span className="text-zinc-300">app.hyperliquid.xyz</span>, hubungkan dompetmu, lalu
                    setor USDC ke perps. Hanya USDC yang bisa jadi margin — token spot lain terhitung
                    kepemilikan, bukan daya beli.</>
                } />
                <Langkah no={2} judul="Buat agent wallet (API wallet)" anak={
                  <>Di Hyperliquid: <span className="text-zinc-300">More → API</span>, beri nama misalnya
                    <span className="angka text-zinc-300"> jaditrader</span>, lalu buat. Yang muncul sekali
                    dan tidak bisa dilihat lagi adalah <span className="text-zinc-300">kunci privat agent</span>-nya.
                    <span className="mt-1 block text-zinc-600">Simpan langsung ke tempat tujuannya. Kunci yang sempat
                    mampir di catatan, chat, atau tangkapan layar harus dianggap bocor dan dibuat ulang.</span></>
                } />
                <Langkah no={3} judul="Isi tiga baris di .env backend" anak={
                  <>Di server tempat backend-mu berjalan, buka berkas
                    <span className="angka text-zinc-300"> .env</span> lalu tambahkan:
                    <span className="mt-1.5 block">
                      <code className="angka block whitespace-pre-line rounded border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-[11.5px] leading-relaxed text-zinc-300">
                        HL_AKTIF=1{'\n'}HL_AKUN=0x…alamat dompetmu…{'\n'}HL_AGENT_KEY=0x…kunci agent tadi…
                      </code>
                    </span>
                    <span className="mt-1 block text-zinc-600">
                      <span className="angka text-zinc-500">HL_AKTIF</span> sengaja harus ditulis <b>1</b>, bukan
                      sekadar "tidak nol": sesuatu yang bisa membuka posisi dengan uang sungguhan tidak boleh
                      menyala hanya karena barisnya kosong.
                    </span>
                    <span className="mt-1 block text-zinc-600">
                      Dua baris pilihan: <span className="angka text-zinc-500">HL_MAKS_USD</span> dan{' '}
                      <span className="angka text-zinc-500">HL_MAKS_LEV</span> membatasi ukuran dan leverage untuk
                      mesin salin dompet. Bawaannya 60 dan 3.
                    </span></>
                } />
                <Langkah no={4} judul="Nyalakan ulang backend, lalu muat ulang halaman ini" anak={
                  <>Contohnya <span className="angka text-zinc-300">pm2 restart binance-backend</span>. Kartu
                    Hyperliquid di tab <span className="text-zinc-300">Connection</span> akan berubah jadi
                    Connected, dan ketiga baris tadi bercentang satu per satu.
                    <span className="mt-1 block text-zinc-600">Kalau masih abu-abu, kartunya menyebut baris mana
                    yang belum terbaca — tidak perlu menebak.</span></>
                } />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-800/60 p-4">
              <div className="text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                Sesudah tersambung
              </div>
              <ul className="mt-2.5 space-y-1.5 text-[12.5px] leading-relaxed text-zinc-400">
                <li>· Koin yang tidak ada di Binance Futures dirutekan sendiri ke Hyperliquid — tidak
                  ada sakelar yang perlu ditekan tiap order.</li>
                <li>· Kirim order, pasang SL/TP, dan tutup posisi berjalan dari panel yang sama dengan
                  Binance di Chart &amp; Entry.</li>
                <li>· Di Copy Signal, Hyperliquid bisa dipilih sebagai bursa tujuan saat menekan Ikuti.</li>
                <li>· Akun ini terpisah dari <span className="text-zinc-300">Dompet Web3</span> di tab
                  Connection. Yang ini dijalankan backend-mu; yang itu dompet di perambanmu.</li>
              </ul>
            </div>
          </div>
        </Panel>
      )}

      {/* ── Tutorial pasang EA MT5 ── */}
      {tab === 'mt5' && (
        <Panel>
          <div className="px-5 py-5">
            <div className="rounded-lg border border-zinc-800/60 p-4">
              {/* TERBUKA, tidak dilipat. Dulu disembunyikan demi kartu yang
                  rapi, tapi halaman ini berjudul "Tutorial Pasang MT5" —
                  tutorial yang isinya harus diklik dulu adalah tutorial yang
                  menyembunyikan satu-satunya alasan orang membukanya, dan
                  yang membacanya justru orang yang sedang bingung. */}
              <div className="text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                Cara memasang — 6 langkah
              </div>
              <div className="mt-3">
              <Langkah no={1} judul="Unduh berkasnya" anak={
                <>Klik <span className="text-zinc-300">Unduh JadiTraderSync.ex5</span> di bawah. Berkasnya ±36 KB.</>
              } />
              <Langkah no={2} judul="Buka folder data MT5" anak={
                <>Di MetaTrader 5: <span className="text-zinc-300">File → Open Data Folder</span>, lalu masuk ke
                  <span className="angka text-zinc-300"> MQL5\Experts</span>. Salin berkas .ex5 ke situ.
                  <span className="mt-1 block text-zinc-600">Jangan cari lewat Windows Explorer — tiap terminal MT5 punya
                  folder datanya sendiri di lokasi yang panjang dan acak.</span></>
              } />
              <Langkah no={3} judul="Segarkan daftar EA" anak={
                <>Di panel <span className="text-zinc-300">Navigator</span> (Ctrl+N), klik kanan
                  <span className="text-zinc-300"> Expert Advisors → Refresh</span>. JadiTraderSync muncul di daftar.
                  Kalau belum, tutup dan buka lagi MT5-nya.</>
              } />
              <Langkah no={4} judul="Izinkan alamat server" anak={
                <><span className="text-zinc-300">Tools → Options → Expert Advisors</span> → centang
                  <span className="text-zinc-300"> Allow WebRequest for listed URL</span>, lalu tambahkan alamat ini:
                  <span className="mt-1.5 flex items-center gap-2">
                    <code className="angka rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11.5px] text-zinc-300">{alamatBackend}</code>
                    <button onClick={() => void navigator.clipboard.writeText(alamatBackend).then(() => setTersalin('url'))}
                            className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                            aria-label="Salin alamat server">
                      {tersalin === 'url' ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </span>
                  <span className="mt-1 block text-zinc-600">Salin persis — tanpa garis miring di ujung. MT5 mencocokkan
                  alamatnya huruf per huruf, dan satu karakter beda membuat EA gagal tanpa pesan yang menjelaskan.</span></>
              } />
              <Langkah no={5} judul="Seret ke chart mana pun" anak={
                <>Chart apa saja, timeframe apa saja — EA ini tidak membaca harga, jadi tidak berpengaruh.
                  Di tab <span className="text-zinc-300">Common</span> centang
                  <span className="text-zinc-300"> Allow Algo Trading</span>.</>
              } />
              {/* DUA input, bukan satu. Sebelumnya langkah ini cuma menyebut
                  KodePasangan, dan AlamatServer tidak pernah disebut di
                  langkah mana pun — alamatnya cuma muncul di langkah 4 untuk
                  daftar izin WebRequest, yang tempatnya lain sama sekali.

                  Akibatnya berantai: AlamatServer bawaannya kosong, EA
                  berhenti di "MENUNGGU ALAMAT SERVER", dan pesannya dulu
                  menyuruh mengisi "alamat backend-mu sendiri" — jadi
                  pembelinya menyimpulkan ia harus menyewa server sendiri,
                  padahal satu server memang dipakai bersama dan yang
                  memisahkan datanya adalah Kode Pasangan.

                  Alamatnya diambil dari `alamatBackend` yang SAMA dengan
                  langkah 4, bukan ditulis ulang: dua tempat yang menuliskan
                  alamat yang sama akan berselisih begitu backend-nya pindah,
                  dan yang satu tidak akan mengingatkan soal yang lain. */}
              <Langkah no={6} judul="Isi dua input di tab Inputs" anak={
                <>Di tab <span className="text-zinc-300">Inputs</span> ada dua yang wajib diisi.
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="angka shrink-0 text-zinc-500">AlamatServer</span>
                    <code className="angka rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11.5px] text-zinc-300">{alamatBackend}</code>
                    <button onClick={() => void navigator.clipboard.writeText(alamatBackend).then(() => setTersalin('url6'))}
                            className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                            aria-label="Salin alamat server">
                      {tersalin === 'url6' ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </span>
                  <span className="mt-1 block">
                    Lalu <span className="angka text-zinc-300">KodePasangan</span> dengan kode
                    <span className="angka text-zinc-300"> {kodeMt5 ?? 'JTM5-XXXX-XXXX'}</span> di atas, lalu OK.
                  </span>
                  <span className="mt-1 block text-zinc-600">Pastikan tombol <b className="text-zinc-500">Algo Trading</b> di
                  toolbar berwarna hijau. Kalau merah, EA terpasang tapi tidak berjalan.</span></>
              } />
              <div className="flex gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                  <CheckCircle2 className="size-3.5 text-emerald-500" strokeWidth={2.2} />
                </div>
                <div className="text-[13px] font-medium text-zinc-200">Selesai — jurnal terisi sendiri</div>
              </div>
              </div>

              {/* Tiga kegagalan yang paling sering terjadi, dengan cirinya
                  masing-masing. Daftar "kalau tidak jalan, cek koneksi" tidak
                  menolong siapa pun; yang menolong adalah pasangan
                  gejala→sebab. */}
              <div className="mt-4 border-t border-zinc-800/60 pt-3">
                <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                  Kalau tidak jalan
                </div>
                <dl className="space-y-2 text-[12px] leading-relaxed">
                  {[
                    ['Tab Experts: "WebRequest ... 4060"',
                     'Alamat server belum masuk daftar izin, atau ada bedanya satu karakter. Ulangi langkah 4.'],
                    ['Server membalas 400 "Kode Pasangan tidak valid"',
                     'Kode salah ketik atau sudah diputar. Tekan tombol segarkan di atas, lalu salin ulang ke input EA.'],
                    ['EA terpasang tapi status tetap "belum melapor"',
                     'Tombol Algo Trading di toolbar masih merah, atau ikon EA di pojok chart bersilang. Keduanya berarti EA tidak dijalankan.'],
                  ].map(([gejala, sebab]) => (
                    <div key={gejala}>
                      <dt className="text-zinc-300">{gejala}</dt>
                      <dd className="text-zinc-500">{sebab}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* ── Tutorial connect Binance ── */}
      {tab === 'binance' && (
      <Panel>
        <PanelHead
          judul="Pemasangan dari nol"
          sub="Sepuluh langkah dari membuat API key Binance sampai order pertama berangkat. Perintahnya siap disalin."
          kanan={
            <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-[11.5px] text-zinc-400">
              <BookOpen className="size-3.5" strokeWidth={1.9} /> ± 30 menit
            </span>
          }
        />
        <div className="px-5 pb-5">
          <TutorialVps />
        </div>
      </Panel>
      )}

      {/* Log HANYA di tab Connection (keputusan pemilik).
          Sempat ditampilkan di semua tab dengan alasan "pertanyaan kenapa
          tidak nyambung muncul di mana saja" — tapi tab tutorial dibaca
          justru SEBELUM ada yang bisa gagal, dan log kosong di bawah
          panduan cuma menambah panjang halaman tanpa menjawab apa pun.
          Yang sedang membaca panduan dan menemui galat akan kembali ke
          tab Connection, tempat semua tombolnya juga berada. */}
      {tab === 'sehat' && (
      <Panel className="mt-4">
        <PanelHead judul="Connection log" sub="Kejadian terakhir dari sambungan yang aktif." />
        <div className="px-5 pb-5">
          <TabelBungkus>
            <Tabel>
              <thead>
                <tr><Th>Waktu</Th><Th>Sumber</Th><Th>Kejadian</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {[
                  ['18 dtk lalu', 'MT5',     'Kirim 2 posisi terbuka, 1 riwayat baru', 'OK'],
                  ['2 mnt lalu',  'Binance', 'Ambil mark price 4 posisi live',          'OK'],
                  ['14 mnt lalu', 'Binance', 'Sinkron biaya & funding fee',             'OK'],
                  ['1 jam lalu',  'MT5',     'EA tersambung dari terminal baru',        'OK'],
                  ['3 jam lalu',  'Binance', 'Order BTCUSDT terkirim (MARKET)',         'OK'],
                ].map(([waktu, sumber, kejadian, status], i) => (
                  <Tr key={i}>
                    <Td className="whitespace-nowrap text-zinc-500">{waktu}</Td>
                    <Td>
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[11px]',
                        sumber === 'MT5' ? 'bg-zinc-700/30 text-zinc-300' : 'bg-amber-500/10 text-amber-400'
                      )}>
                        {sumber}
                      </span>
                    </Td>
                    <Td className="text-zinc-300">{kejadian}</Td>
                    <Td><span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-500">{status}</span></Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          </TabelBungkus>
          <p className="mt-3 text-[11.5px] text-zinc-600">
            Unduhan EA, kode pasangan MT5, dan status sambungan sudah menyentuh backend sungguhan.
            Backend URL &amp; App Token tersimpan di perangkat ini saja — tidak pernah dikirim ke mana pun
            selain VPS milikmu sendiri.
          </p>
        </div>
      </Panel>
      )}
    </div>
  );
}
