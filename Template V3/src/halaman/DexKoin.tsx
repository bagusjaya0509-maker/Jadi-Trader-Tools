import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, ShieldCheck, ShieldQuestion, TriangleAlert } from 'lucide-react';
import { Panel } from '@/components/efferd-ui';
import { Memuat } from '@/components/memuat';
import { ChartLilin } from '@/components/chart-lilin';
/* smiSeries langsung dari inti screener, BUKAN `deretSmi` dari
   lib/backtest.
   ──────────────────────────────────────────────────────────────────────
   `deretSmi` cuma pembungkus tiga baris di atas smiSeries yang sama, tapi
   mengimpornya menyeret seluruh potongan backtest: 236 kB (76 kB gzip)
   demi satu osilator. Diukur di keluaran build, bukan ditaksir.

   Potongan jt-scan-core yang dipakai sekarang 5,5 kB. Konstantanya ikut
   diambil dari sana juga, jadi SMI di halaman ini memakai periode yang
   sama persis dengan screener dan Chart & Entry — bukan salinan angka
   yang bisa menyimpang sendiri. */
import { smiSeries, SMI_K, SMI_D, SMI_EMA } from '@/lib/jt-scan-core';
import { PanelBeliKoin } from '@/components/panel-beli-koin';
import type { Lilin } from '@/lib/pasar';
import { cn } from '@/lib/utils';
import {
  ambilLilinDex, ambilAmanDex, tulisHarga, tulisUsd,
  type KolamDex, type TfDex, type KoinPantau, type FaktaAman,
} from '@/lib/coin-listing';

/* ════════════════════════════════════════════════════════════════════════
   KOIN DEX — GRAFIK DAN BELI, DI JALURNYA SENDIRI
   ════════════════════════════════════════════════════════════════════════
   Halaman ini lahir dari satu keputusan pemilik, 21 Sep 2026: mode DEX
   "punya jalan tersendiri aja biar semuanya bisa bekerja sesuai dengan jalan
   originalnya dex".

   Keputusan itu bukan soal tata letak. Koin DEX berjalan dengan aturan yang
   memang berbeda dari koin bursa, dan tiap perbedaannya punya akibat di
   layar:

   • Harganya milik KOLAM, bukan milik token. Satu token bisa punya sepuluh
     kolam dengan sepuluh harga; yang dipakai di sini yang paling dalam,
     dan nomor kolamnya ditulis supaya bisa dicocokkan sendiri.
   • Tidak ada order book, tidak ada leverage, tidak ada SL/TP. Yang terjadi
     sesudah tombol beli ditekan cuma satu: token pindah ke dompet.
   • Kontraknya bisa berbuat hal-hal yang tidak bisa dilakukan koin bursa —
     mencetak pasokan baru, membekukan saldo, mengubah dirinya sendiri.
     Karena itu pemeriksaan kontrak duduk SEJAJAR dengan grafik di sini,
     bukan di halaman lain.

   ── KENAPA BUKAN DI CHART & ENTRY ───────────────────────────────────────
   Pernah dipertimbangkan dan sengaja tidak dilakukan. Chart & Entry berisi
   panel order Hyperliquid: leverage, SL, TP, likuidasi. Menaruh pembelian
   spot tanpa pelindung apa pun di sebelahnya berarti dua tombol beli
   bersebelahan yang akibatnya berbeda jauh — dan kebiasaan tangan tidak
   membaca label.

   Jadi jalurnya dipisah sejak alamatnya: /dex-koin, dibuka dari baris
   Lintasan Koin, dan pulang ke sana.
   ════════════════════════════════════════════════════════════════════════ */

/* Disalin apa adanya dari Chart & Entry. Bukan karena malas mencari
   abstraksi: dua halaman chart yang isiannya berbeda setengah piksel
   terbaca sebagai dua produk, dan yang dikeluhkan pemilik memang itu —
   "agak beda tampilannya". */
const KELAS_ISIAN =
  'h-9 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 text-[12.5px] text-zinc-200 ' +
  'outline-none transition-colors hover:border-zinc-700 focus-visible:border-zinc-600';

/* ── SEBERAPA SERING LILINNYA DITARIK ULANG ──────────────────────────
   Tidak ada websocket untuk kolam DEX — GeckoTerminal cuma punya HTTP,
   jadi hidupnya chart ini berarti menarik ulang, bukan mendengarkan.

   Selangnya mengikuti timeframe karena itu yang menentukan kapan ada
   yang baru untuk dilihat: lilin 1 hari tidak berubah bentuk tiap menit,
   dan menariknya tiap menit cuma membakar kuota tanpa menambah satu
   piksel pun. Pemilik memakai PC tethering; angka-angka ini dipilih
   dengan itu di kepala.

   Batas gratis GeckoTerminal 30 permintaan/menit. Yang paling rapat di
   sini (20 detik) memakai 6/menit — dua permintaan per tarikan, karena
   kolam terdalamnya ikut dicari ulang. */
/** Panjang satu lilin, dalam milidetik. Dipakai untuk menjawab satu
 *  pertanyaan: apakah lilin TERBARU yang kita punya itu lilin yang sedang
 *  berjalan, atau lilin lama yang sesudahnya tidak ada transaksi sama
 *  sekali. */
const PANJANG: Record<TfDex, number> = {
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
};

const DETAK: Record<TfDex, number> = {
  '5m': 20_000,
  '15m': 30_000,
  '1h': 60_000,
  '4h': 120_000,
  '1d': 300_000,
};

const TF: { nilai: TfDex; label: string }[] = [
  { nilai: '5m', label: '5m' },
  { nilai: '15m', label: '15m' },
  { nilai: '1h', label: '1H' },
  { nilai: '4h', label: '4H' },
  { nilai: '1d', label: '1D' },
];

/** Penjelajah blok per jaringan, untuk membuka kontraknya sendiri. */
const PENJELAJAH: Record<string, (a: string) => string> = {
  solana: (a) => `https://solscan.io/token/${a}`,
  eth: (a) => `https://etherscan.io/token/${a}`,
  bsc: (a) => `https://bscscan.com/token/${a}`,
  base: (a) => `https://basescan.org/token/${a}`,
  arbitrum: (a) => `https://arbiscan.io/token/${a}`,
  polygon_pos: (a) => `https://polygonscan.com/token/${a}`,
};

/** Tinggi chart diturunkan dari TINGGI LAYAR, sama seperti Chart & Entry.
 *
 *  Angka tetap 440px membuat chartnya duduk di sepertiga atas layar 1440p
 *  dengan ruang kosong di bawahnya — dan chart yang tidak memakai tinggi
 *  yang tersedia adalah perbedaan pertama yang terlihat saat dua halaman
 *  dibandingkan berdampingan.
 *
 *  Potongannya lebih kecil daripada Chart & Entry (270 lawan 343) karena
 *  halaman ini tidak punya bilah kepala setinggi itu. */
function useTinggiChart(): number {
  const [tinggi, setTinggi] = useState(() =>
    typeof window === 'undefined' ? 460 : Math.max(420, window.innerHeight - 270));
  useEffect(() => {
    const ukur = () => setTinggi(Math.max(420, window.innerHeight - 270));
    window.addEventListener('resize', ukur);
    return () => window.removeEventListener('resize', ukur);
  }, []);
  return tinggi;
}

export default function DexKoin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tinggiChart = useTinggiChart();

  const jaringan = params.get('jaringan') || '';
  const alamat = params.get('alamat') || '';
  /* Simbol ikut di alamat halaman supaya judulnya sudah benar pada frame
     pertama. Ia cuma hiasan — kalau tidak dikirim, nama kolamnya yang
     dipakai, dan kalau itu pun belum ada, potongan alamatnya. */
  const simbolAwal = params.get('simbol') || '';
  const kolamAwal = params.get('kolam') || '';

  const [tf, setTf] = useState<TfDex>('1h');
  const [lilin, setLilin] = useState<Lilin | null>(null);
  const [kolam, setKolam] = useState<KolamDex | null>(kolamAwal ? { kolam: kolamAwal } : null);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState('');
  /** Kapan lilinnya terakhir benar-benar berganti isi. Dipakai lencana
   *  detak supaya "hidup" itu bisa dibuktikan, bukan cuma dijanjikan. */
  const [segarPada, setSegarPada] = useState(0);
  /** Jam yang berdetak tiap 5 detik. Tanpa ini umur data di lencana
   *  tertulis sekali lalu diam — dan angka yang diam justru meyakinkan
   *  orang bahwa datanya baru, padahal ia bisa sudah sepuluh menit. */
  const [sekarang, setSekarang] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setSekarang(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);

  const [aman, setAman] = useState<FaktaAman | undefined>(undefined);
  const [periksa, setPeriksa] = useState(false);

  /* ── LILIN ──────────────────────────────────────────────────────────
     `diam` untuk tarikan detak: ia TIDAK menyalakan keadaan memuat dan
     TIDAK menghapus galat yang sedang tampil.

     Dua-duanya disengaja. Spinner yang berkedip tiap 20 detik di halaman
     yang sedang dibaca orang terbaca sebagai halaman yang bermasalah;
     dan galat yang dibersihkan oleh tarikan latar lalu muncul lagi
     sedetik kemudian adalah kedipan yang tidak menyampaikan apa pun.

     Kolamnya SENGAJA tidak dikirim balik pada tarikan detak (lihat
     pemanggilnya): dengan `?kolam=` server melewati pencarian kolam dan
     ikut melewati harga, likuiditas, serta volume terbarunya — grafiknya
     hidup sementara angka di bawahnya membeku. */
  const tarik = useCallback(async (t: TfDex, pakaiKolam?: string, diam = false) => {
    if (!jaringan || !alamat) return;
    if (!diam) { setMuat(true); setGalat(''); }
    const h = await ambilLilinDex(jaringan, alamat, t, pakaiKolam);
    if (!diam) setMuat(false);
    if ('error' in h) { if (!diam) setGalat(h.error); return; }
    /* DIGABUNG, bukan diganti.
       ──────────────────────────────────────────────────────────────
       Permintaan pertama mencari kolam terdalam dan memulangkan fakta
       lengkapnya. Permintaan berikutnya mengirim id kolam itu kembali
       supaya pencariannya tidak diulang — dan server lalu memulangkan
       id-nya saja, tanpa harga, likuiditas, atau nama DEX.

       Menimpanya mentah-mentah membuat seluruh baris fakta berubah jadi
       "—" begitu timeframe-nya diganti sekali. Id kolamnya tidak pernah
       berubah di sepanjang halaman ini, jadi fakta lama tetap fakta
       kolam yang sama. */
    if (h.kolam) {
      const k = h.kolam;
      setKolam((lama) => ({ ...(lama ?? {}), ...k, kolam: k.kolam }));
    }
    if (!h.lilin.length) {
      /* Tarikan detak yang pulang kosong TIDAK mengosongkan grafik yang
         sudah tergambar. Kolam sepi kadang memulangkan daftar kosong
         sesaat, dan chart yang hilang lalu muncul lagi lebih buruk
         daripada chart yang tertinggal beberapa detik. */
      if (diam) return;
      setLilin(null);
      setGalat(h.kolam
        ? 'Kolamnya ada, tapi belum ada transaksi yang cukup untuk membentuk lilin di timeframe ini. Coba timeframe yang lebih kecil.'
        : 'Token ini belum punya kolam di DEX mana pun, jadi belum ada harga untuk digambar.');
      return;
    }
    setLilin({
      times: h.lilin.map((b) => b[0]),
      opens: h.lilin.map((b) => b[1]),
      highs: h.lilin.map((b) => b[2]),
      lows: h.lilin.map((b) => b[3]),
      closes: h.lilin.map((b) => b[4]),
      volumes: h.lilin.map((b) => b[5]),
    });
    setSegarPada(Date.now());
  }, [jaringan, alamat]);

  useEffect(() => { void tarik(tf, kolam?.kolam || kolamAwal || undefined); }, [tf, tarik]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── DETAK ───────────────────────────────────────────────────────────
     Berhenti saat tabnya tidak dilihat, dan menarik sekali begitu ia
     dilihat lagi.

     Bukan kesopanan: tab yang ditinggal terbuka semalam akan menarik
     ribuan kali tanpa satu mata pun melihat hasilnya, dan yang membayar
     itu kuota pemiliknya. Kembali ke tabnya juga harus langsung
     menunjukkan yang terbaru — menunggu selang berikutnya berarti orang
     membaca harga lama justru pada detik ia kembali untuk memeriksanya.

     `tarikRef` supaya selangnya tidak dipasang ulang tiap render: isi
     `tarik` berubah identitasnya setiap `jaringan`/`alamat` berubah, dan
     interval yang dibongkar-pasang kehilangan hitungannya. */
  const tarikRef = useRef(tarik);
  tarikRef.current = tarik;
  useEffect(() => {
    if (!jaringan || !alamat) return;
    let id: number | undefined;
    const mulai = () => {
      if (id !== undefined) return;
      id = window.setInterval(() => { void tarikRef.current(tf, undefined, true); }, DETAK[tf]);
    };
    const henti = () => {
      if (id !== undefined) { window.clearInterval(id); id = undefined; }
    };
    const lihat = () => {
      if (document.visibilityState === 'visible') { void tarikRef.current(tf, undefined, true); mulai(); }
      else henti();
    };
    if (document.visibilityState === 'visible') mulai();
    document.addEventListener('visibilitychange', lihat);
    return () => { henti(); document.removeEventListener('visibilitychange', lihat); };
  }, [tf, jaringan, alamat]);

  /* ── KONTRAK ────────────────────────────────────────────────────────
     Dijalankan sendiri saat halaman dibuka, tidak menunggu ditekan.
     Alasannya sederhana: yang tidak ditekan tidak akan pernah dibaca, dan
     satu-satunya saat pemeriksaan ini berguna adalah SEBELUM membeli. */
  const periksaKontrak = useCallback(async () => {
    if (!jaringan || !alamat) return;
    setPeriksa(true);
    const a = await ambilAmanDex(jaringan, alamat);
    setPeriksa(false);
    if (a) setAman(a);
  }, [jaringan, alamat]);

  useEffect(() => { void periksaKontrak(); }, [periksaKontrak]);

  /* Panel osilator di kaki chart — persis yang ada di Chart & Entry.
     30 lilin adalah syarat SMI itu sendiri, bukan pilihan gaya: di bawah
     itu nilainya belum stabil, dan osilator yang belum stabil tergambar
     sebagai garis liar yang terbaca seperti sinyal. Kolam DEX muda sering
     ada di bawah ambang ini, dan di sana panelnya memang tidak muncul. */
  const smi = useMemo(
    () => {
      if (!lilin || lilin.closes.length < 30) return null;
      const d = smiSeries(lilin.highs, lilin.lows, lilin.closes, SMI_K, SMI_D, SMI_EMA);
      return d ? { smi: d.smi, signal: d.signal } : null;
    },
    [lilin],
  );

  /* Perubahan 24 jam, dihitung dari lilinnya sendiri.
     ──────────────────────────────────────────────────────────────────
     Dicari lilin terakhir yang stempelnya <= 24 jam sebelum lilin
     terakhir, lalu dibandingkan penutupannya. BUKAN "lilin pertama
     dibanding terakhir": rentang itu berubah-ubah mengikuti timeframe,
     jadi angka yang sama akan berarti sehari di satu TF dan dua bulan di
     TF lain — sementara yang membacanya tetap membacanya sebagai "hari
     ini".

     `null` kalau datanya belum menjangkau 24 jam ke belakang. Angka yang
     dihitung dari enam jam lalu tapi dilabeli 24 jam adalah kebohongan
     kecil yang dipakai orang untuk mengambil keputusan. */
  const ubah24 = useMemo(() => {
    if (!lilin || lilin.times.length < 2) return null;
    const n = lilin.times.length;
    const akhir = lilin.closes[n - 1];
    const batas = lilin.times[n - 1] - 24 * 60 * 60 * 1000;
    if (lilin.times[0] > batas) return null;
    let i = n - 1;
    while (i > 0 && lilin.times[i] > batas) i -= 1;
    const awal = lilin.closes[i];
    if (!(awal > 0) || !Number.isFinite(akhir)) return null;
    return ((akhir - awal) / awal) * 100;
  }, [lilin]);

  /* ── KENAPA GARISNYA TIDAK BERGERAK ──────────────────────────────
     Dilaporkan pemilik 21 Sep 2026: "tapi garisnya itu ga gerak sama
     sekali kenapa ya". Detaknya jalan — lencananya bahkan menulis "30
     dtk lalu" — tapi lilinnya diam.

     Ternyata bukan grafiknya. Kolam mmETH di Base diperiksa langsung ke
     GeckoTerminal: lilin 4 jam TERBARU yang ada bertanggal 21 Sep 00:00,
     hampir 8 jam sebelumnya, dan di antara 18 Sep 16:00 dan 20 Sep 16:00
     tidak ada lilin sama sekali. Kolamnya cuma ditransaksikan beberapa
     kali sehari; bar untuk periode berjalan belum lahir karena belum ada
     satu pun transaksi di dalamnya.

     Jadi yang salah bukan datanya, melainkan yang DILAPORKAN lencana:
     ia menulis kapan KITA terakhir bertanya, bukan seberapa baru
     jawabannya. Di pasar bursa dua angka itu praktis sama, jadi
     perbedaannya tidak pernah terasa. Di kolam DEX sepi keduanya bisa
     berselisih berjam-jam — dan lencana hijau berdenyut di sebelah
     grafik yang membeku adalah janji yang tidak ditepati.

     Sekarang yang dilaporkan umur LILIN TERAKHIR, dan kalau lilin
     periode berjalan belum ada, halamannya mengatakannya dengan kalimat
     penuh. */
  const umurLilin = lilin && lilin.times.length
    ? sekarang - lilin.times[lilin.times.length - 1]
    : null;
  /** Lilin periode berjalan sudah lahir — artinya ada transaksi di dalam
   *  periode ini, dan grafiknya memang sedang bergerak. */
  const lilinBerjalan = umurLilin !== null && umurLilin < PANJANG[tf];

  const hargaKini = lilin ? lilin.closes[lilin.closes.length - 1] : (kolam?.harga ?? 0);

  const simbol = simbolAwal || (kolam?.nama || '').split('/')[0].trim() || alamat.slice(0, 6);

  /* `KoinPantau` bikinan, bukan baris daftar pantau. Panel beli cuma
     membaca alamat, jaringan, simbol, dan fakta keamanannya — sisanya
     medan daftar pantau yang tidak berlaku di sini dan diisi netral. */
  const koin: KoinPantau = useMemo(() => ({
    alamat, jaringan, nama: simbol, simbol, catatan: '',
    beliUsd: 0, beliToken: 0, status: 'listing',
    dibuat: 0, diperiksa: aman?.diperiksa || 0, putaran: 0,
    aman,
  }), [alamat, jaringan, simbol, aman]);

  if (!jaringan || !alamat) {
    return (
      <div className="p-4 md:p-6">
        <Panel className="p-5">
          <p className="text-[12.5px] text-zinc-400">
            Alamat halaman ini kurang lengkap — jaringan dan alamat kontraknya harus ikut.
          </p>
          <Link to="/wallet-tracking?sub=hunter"
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-sky-400 hover:text-sky-300">
            <ArrowLeft className="size-3.5" /> Kembali ke Coin Hunter
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <Link to="/wallet-tracking?sub=hunter"
        className="mb-2 inline-flex items-center gap-1.5 text-[11.5px] text-zinc-500 transition-colors hover:text-zinc-300">
        <ArrowLeft className="size-3.5" /> Lintasan Koin
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ── Grafik ───────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <Panel className="overflow-hidden">
            {/* ── BILAH ALAT, SUSUNAN CHART & ENTRY ──────────────────────
                Medan berlabel di kiri, harga terakhir di sebelahnya,
                tombol di kanan — urutan yang sama, tinggi isian yang sama,
                jarak yang sama. Bedanya cuma isinya: di sana simbol bursa
                yang bisa diketik, di sini koin yang sudah ditentukan
                alamat halamannya, jadi ia kotak mati. */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 py-3">
              <div>
                <div className="mb-1 text-[10.5px] text-zinc-500">Koin</div>
                <div className={cn(KELAS_ISIAN, 'flex items-center gap-2')}>
                  <span className="font-medium">{simbol}</span>
                  <span className="text-[10.5px] text-zinc-500">{jaringan}</span>
                </div>
              </div>

              <div>
                <div className="mb-1 text-[10.5px] text-zinc-500">Timeframe</div>
                <select value={tf} onChange={(e) => setTf(e.target.value as TfDex)}
                  className={cn(KELAS_ISIAN, 'cursor-pointer')}>
                  {TF.map((x) => <option key={x.nilai} value={x.nilai}>{x.label}</option>)}
                </select>
              </div>

              <div className="min-w-0">
                <div className="mb-1 text-[10.5px] text-zinc-500">Harga terakhir</div>
                <div className="flex h-9 flex-wrap items-center gap-2">
                  <span className="angka text-[15px] font-semibold text-zinc-100">
                    {hargaKini > 0 ? tulisHarga(hargaKini) : '—'}
                  </span>
                  {/* Hanya kalau datanya memang menjangkau 24 jam. Lihat
                      catatan di `ubah24` — labelnya menjanjikan rentang,
                      dan rentangnya harus benar-benar ada. */}
                  {ubah24 !== null && (
                    <span className={cn('angka text-[12px]',
                      ubah24 >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {ubah24 >= 0 ? '+' : ''}{ubah24.toFixed(2)}% <span className="text-zinc-600">24j</span>
                    </span>
                  )}
                  {kolam?.dex && (
                    <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      {kolam.dex}
                    </span>
                  )}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2 self-end pb-0.5">
                {/* ── BUKTI BAHWA IA HIDUP ────────────────────────────
                    Titik berdenyut saja tidak cukup: animasi yang berputar
                    tanpa henti juga berputar saat datanya macet. Yang
                    membuktikan adalah UMUR data terakhir, dan itu yang
                    ditulis di sebelahnya. */}
                {segarPada > 0 && umurLilin !== null && (
                  <span title={`Terakhir ditarik ${umurSegar(segarPada, sekarang)}`}
                    className="hidden items-center gap-1.5 text-[10.5px] text-zinc-600 sm:flex">
                    {/* Berdenyut HANYA kalau lilin periode berjalan memang
                        sudah ada. Titik hijau berdenyut di sebelah grafik
                        yang membeku persis menyesatkan seperti angka yang
                        tidak pernah berubah. */}
                    <span className="relative flex size-1.5">
                      {lilinBerjalan && (
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                      )}
                      <span className={cn('relative inline-flex size-1.5 rounded-full',
                        lilinBerjalan ? 'bg-emerald-500' : 'bg-zinc-600')} />
                    </span>
                    {lilinBerjalan
                      ? 'lilin berjalan'
                      : `lilin terakhir ${umurRingkas(umurLilin)} lalu`}
                  </span>
                )}
                <button onClick={() => void tarik(tf, kolam?.kolam)}
                  title="Tarik ulang lilin dari kolamnya"
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 sm:px-2.5">
                  <RefreshCw className={cn('size-3.5', muat && 'animate-spin')} />
                  <span className="hidden sm:inline">Segarkan</span>
                </button>
              </div>
            </div>

            {/* Baris keterangan kolam. Di Chart & Entry tempat ini dipakai
                kabar galat dan batas jatah replay; di sini dipakai satu
                hal yang cuma berlaku untuk koin DEX dan tidak punya
                padanan di bursa: token yang sama bisa punya banyak kolam
                dengan harga berbeda-beda. */}
            {/* ── GRAFIK DIAM KARENA KOLAMNYA DIAM ──────────────────────
                Kalimat ini menjawab pertanyaan yang pasti muncul dan sampai
                sekarang tidak dijawab siapa pun di layar: "kenapa tidak
                bergerak?". Jawabannya bukan soal sambungan atau grafik —
                di kolam DEX, bar cuma lahir kalau ada yang bertransaksi.

                Ditaruh di sini, bukan sebagai catatan kaki di bawah chart:
                yang bertanya sedang menatap bilah harga, dan jawaban yang
                harus dicari dengan menggulir sama saja dengan tidak ada. */}
            {umurLilin !== null && !lilinBerjalan && (
              <div className="border-t border-amber-500/20 bg-amber-500/[0.04] px-4 py-2 text-[11px] leading-relaxed text-amber-200/80">
                Belum ada transaksi di lilin yang sedang berjalan — yang terakhir{' '}
                <b>{umurRingkas(umurLilin)} lalu</b>. Grafiknya tidak akan bergerak sampai ada
                yang menukar di kolam ini, dan itu normal untuk kolam sesepi ini
                {kolam?.volume24 ? <> (volume 24 jam {tulisUsd(kolam.volume24)})</> : null}.
              </div>
            )}

            {kolam && (kolam.jumlahKolam ?? 0) > 1 && (
              <div className="border-t border-zinc-800/80 px-4 py-2 text-[11px] leading-relaxed text-zinc-500">
                Digambar dari kolam paling dalam. Token ini punya {kolam.jumlahKolam} kolam —
                harga di kolam lain bisa berbeda, dan yang dangkal bisa berbeda jauh.
              </div>
            )}

            {/* `px-2 pb-2` + garis pemisah: kerangka yang sama persis
                dengan area chart di Chart & Entry. */}
            <div className="border-t border-zinc-800/80 px-2 pb-2">
              {muat && !lilin ? (
                <Memuat pesan="Menarik lilin dari kolam DEX…" className="min-h-[420px]" />
              ) : galat && !lilin ? (
                <div className="flex min-h-[420px] items-center justify-center p-6">
                  <p className="max-w-md text-center text-[12.5px] leading-relaxed text-zinc-500">{galat}</p>
                </div>
              ) : lilin ? (
                <ChartLilin key={`${jaringan}|${alamat}|${tf}`} lilin={lilin}
                  tinggi={tinggiChart} muatPenuh smi={smi} pitaSmi
                  tandaAir={{ utama: simbol, sub: `${jaringan} · ${tf}` }} />
              ) : null}
            </div>
          </Panel>

          {/* ── JUMLAH LILIN ITU KABAR, BUKAN CATATAN KAKI ─────────────
              GeckoTerminal cuma menerbitkan bar untuk periode yang benar-
              benar ada transaksinya — jeda tidak diisi. Jadi deret 10 lilin
              di timeframe 1 jam TIDAK berarti kolamnya berumur 10 jam; bisa
              jadi ia berumur seminggu dan cuma diperdagangkan sepuluh jam
              di antaranya.

              Perbedaan itu menentukan. Chart yang terlihat rapat dan
              berkelanjutan, padahal barnya melompati dua hari sunyi, akan
              dibaca sebagai tren — dan yang dibaca sebagai tren dijadikan
              alasan membeli. */}
          {lilin && lilin.times.length < 60 && (
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-zinc-600">
              Cuma {lilin.times.length} lilin di timeframe ini — bar hanya terbit untuk jam
              yang ada transaksinya, dan jeda sepi tidak diisi. Jarak antarbar di layar
              belum tentu sama dengan jarak waktu sebenarnya.
            </p>
          )}

          {/* Fakta kolam. Ditaruh di bawah grafik, bukan di kolom kanan:
              yang di kanan adalah urusan membeli, dan angka-angka ini
              urusan menilai — dua hal yang lebih baik tidak berdempetan. */}
          {kolam && (
            <Panel className="mt-3 p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {/* Dari lilin terakhir, bukan `kolam.harga`: keduanya
                    datang dari sumber yang sama tapi yang satu ikut
                    disegarkan detak dan yang satu tidak — dan dua harga
                    berbeda di satu layar membuat dua-duanya tidak
                    dipercaya. */}
                <Fakta k="Harga" v={hargaKini > 0 ? tulisHarga(hargaKini) : '—'} />
                <Fakta k="Likuiditas kolam" v={kolam.likuiditas ? tulisUsd(kolam.likuiditas) : '—'} />
                <Fakta k="Volume 24 jam" v={kolam.volume24 ? tulisUsd(kolam.volume24) : '—'} />
                <Fakta k="FDV" v={kolam.fdv ? tulisUsd(kolam.fdv) : '—'} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-zinc-800/60 pt-2.5 text-[10.5px] text-zinc-600">
                <span className="angka break-all">kolam {kolam.kolam}</span>
                {PENJELAJAH[jaringan] && (
                  <a href={PENJELAJAH[jaringan](alamat)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-500/80 hover:text-sky-400">
                    <ExternalLink className="size-3" /> kontraknya di penjelajah blok
                  </a>
                )}
              </div>
            </Panel>
          )}
        </div>

        {/* ── Kolom beli ───────────────────────────────────────────── */}
        <div className="w-full shrink-0 space-y-3 lg:w-[350px]">
          <KartuKontrak aman={aman} sedang={periksa} onPeriksa={() => void periksaKontrak()} />
          <PanelBeliKoin koin={koin} onTutup={() => navigate('/wallet-tracking?sub=hunter')} />
        </div>
      </div>
    </div>
  );
}

/** Umur data terakhir, sependek mungkin — ia duduk di bilah alat, bukan
 *  di paragraf. Di atas satu jam berhenti menghitung: kalau sudah selama
 *  itu, yang perlu diketahui bukan berapa menit tepatnya melainkan bahwa
 *  detaknya memang berhenti. */
function umurSegar(ms: number, sekarang: number): string {
  const d = Math.max(0, Math.round((sekarang - ms) / 1000));
  if (d < 10) return 'baru saja';
  if (d < 60) return `${d} dtk lalu`;
  const m = Math.floor(d / 60);
  if (m < 60) return `${m} mnt lalu`;
  return 'lebih dari sejam lalu';
}

/** Selisih waktu sependek mungkin: "12 dtk", "4 mnt", "7,9 jam",
 *  "3 hari". Jam memakai satu desimal karena di rentang itulah selisihnya
 *  paling menentukan — "7 jam" dan "8 jam" terbaca sama, padahal beda satu
 *  periode lilin 4 jam penuh. */
function umurRingkas(selisih: number): string {
  const d = Math.max(0, Math.round(selisih / 1000));
  if (d < 60) return `${d} dtk`;
  const m = Math.floor(d / 60);
  if (m < 60) return `${m} mnt`;
  const j = selisih / 3_600_000;
  if (j < 24) return `${j.toFixed(1).replace('.', ',')} jam`;
  return `${Math.floor(j / 24)} hari`;
}

function Fakta({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] text-zinc-600">{k}</div>
      <div className="angka mt-0.5 truncate text-[12.5px] text-zinc-200">{v}</div>
    </div>
  );
}

/* ── PEMERIKSAAN KONTRAK ────────────────────────────────────────────────
   Tiga keadaan, dan ketiganya harus terlihat BERBEDA:

     belum diperiksa  — kita tidak tahu apa-apa
     tidak terbaca    — sudah dicoba, penyedianya tidak punya jawaban
     sudah diperiksa  — ada temuan, atau tidak ada

   Sebelum ini yang pertama dan yang terakhir tampil sama persis: diam.
   Token yang belum pernah diperiksa terbaca seperti token yang sudah lolos
   pemeriksaan — dan diam adalah cara paling buruk untuk menyampaikan
   "tidak tahu" tepat di sebelah tombol beli. */
function KartuKontrak({ aman, sedang, onPeriksa }: {
  aman: FaktaAman | undefined; sedang: boolean; onPeriksa: () => void;
}) {
  const temuan: string[] = [];
  if (aman && !aman.kosong) {
    if (aman.bisaCetak) temuan.push('pasokan masih bisa dicetak');
    if (aman.bisaBekukan) temuan.push('saldo bisa dibekukan');
    if (aman.bisaDiubah) temuan.push('kontraknya masih bisa diubah');
    if ((aman.pajakJual ?? 0) > 10) temuan.push(`pajak jual ${aman.pajakJual}%`);
    if ((aman.pajakBeli ?? 0) > 10) temuan.push(`pajak beli ${aman.pajakBeli}%`);
  }

  const keadaan = sedang ? 'jalan' : !aman ? 'belum' : aman.kosong ? 'buta' : temuan.length ? 'bahaya' : 'bersih';

  const gaya = {
    jalan:  { bingkai: 'border-zinc-800', ikon: <Loader2 className="size-3.5 animate-spin text-zinc-500" /> },
    belum:  { bingkai: 'border-amber-500/30 bg-amber-500/[0.05]', ikon: <ShieldQuestion className="size-3.5 text-amber-400" /> },
    buta:   { bingkai: 'border-amber-500/25 bg-amber-500/[0.04]', ikon: <ShieldQuestion className="size-3.5 text-amber-400/80" /> },
    bahaya: { bingkai: 'border-red-500/40 bg-red-500/[0.06]', ikon: <TriangleAlert className="size-3.5 text-red-400" /> },
    bersih: { bingkai: 'border-zinc-800', ikon: <ShieldCheck className="size-3.5 text-emerald-500/80" /> },
  }[keadaan];

  return (
    <Panel className={cn('p-3', gaya.bingkai)}>
      <div className="flex gap-2">
        <span className="mt-0.5 shrink-0">{gaya.ikon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12.5px] font-medium text-zinc-200">Pemeriksaan kontrak</h3>

          {keadaan === 'jalan' && (
            <p className="mt-1 text-[11.5px] text-zinc-500">Sedang memeriksa…</p>
          )}
          {keadaan === 'belum' && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-amber-200/90">
              Kontrak ini <b>belum diperiksa</b>. Itu bukan berarti aman — berarti belum ada
              yang melihatnya.
            </p>
          )}
          {keadaan === 'buta' && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-amber-200/90">
              Kontraknya <b>tidak bisa dibaca</b> pemeriksa keamanan. Sering terjadi pada token
              yang sangat baru — dan artinya tetap sama: tidak ada yang bisa dipastikan.
            </p>
          )}
          {keadaan === 'bahaya' && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-red-200/90">
              Ditemukan: {temuan.join(', ')}.
              <span className="text-red-200/60"> Bukan bukti penipuan — tapi berarti pemiliknya
                masih bisa berbuat sesuatu pada tokenmu sesudah kamu membelinya.</span>
            </p>
          )}
          {keadaan === 'bersih' && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
              Tidak ditemukan bendera bahaya yang biasa: tidak bisa dicetak lagi, saldo tidak
              bisa dibekukan, kontraknya terkunci. Pemeriksaan ini hanya membaca kontrak —
              ia tidak tahu apa pun soal niat pembuatnya.
            </p>
          )}

          {!sedang && (
            <button onClick={onPeriksa}
              className="mt-2 cursor-pointer text-[11px] text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-300 hover:underline">
              Periksa ulang
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}
