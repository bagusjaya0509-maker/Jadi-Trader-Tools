import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Play, Loader2, RefreshCw, Radio, TriangleAlert, History,
  Layers, ChevronDown, ChevronUp, Settings2, Code2, X, Ruler, Rows3, Square, Eraser, Minus, TrendingUp,
  FlaskConical, GripHorizontal, Maximize2, Minimize2, SquareArrowUp, SquareArrowDown,
  Settings, RotateCcw, LayoutGrid } from 'lucide-react';
import { PanelNews } from '@/components/panel-news';
import { simpanDraf } from '@/lib/draf-sinyal';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga, tanggalPendek } from '@/lib/utils';
import { ChartLilin, TAMPILAN_BAWAAN, type Garis, type GarisHarga, type GarisSeret, type PosisiChartMt5, type TampilanChart } from '@/components/chart-lilin';
import { POLOS, UTAMA, ID_PANEL, kirimBus, dengarBus, nyalakanMulti, replayDipegangLain, pegangReplay } from '@/lib/multi-chart';
import { PanelReplay, type AksiOrder, type JenisEntry } from '@/components/panel-replay';
import { PojokOrder } from '@/components/pojok-order';
import { kirimOrderNyata, ubahSlTpNyata, batalPendingNyata, tutupPosisiNyata, tickSimbol, keTick, type MetodeTp } from '@/lib/order-nyata';
import { kirimPerintahMt5, tungguHasilMt5 } from '@/lib/mt5-order';
import { DockPine, type InfoPine, type KendaliPine } from '@/components/dock-pine';
import { WatchChart } from '@/components/watch-chart';
import { PanelPosisiTerbuka, type OrderSunting } from '@/components/panel-posisi-terbuka';
import type { AlatPegang, GambarAlat } from '@/lib/plugin-alat';
import type { HasilPine } from '@/lib/pine';
import { bacaSetelanChart, simpanSetelanChart, usulSlTp } from '@/lib/replay';
import { atr } from '@/lib/jt-scan-core';
import { ambilKlines, ambilKlinesSebelum, aturPasarKripto, bacaPasar, bacaSpekMt5, bacaTickMt5, daftarSimbolMt5, pasarKripto, type Lilin } from '@/lib/pasar';
import { useAkunMt5, segarkanAkunMt5 } from '@/lib/akun';
/* Langsung dari admin, BUKAN lewat usePosisi(): yang dibutuhkan di sini
   cuma daftar order bursa, sementara usePosisi() juga memasang listener
   Firestore. Halaman chart dibuka lama dan sering — menambah satu
   listener di sini adalah cara pelan-pelan menghabiskan kuota untuk data
   yang tidak dipakainya. */
import { usePosisiBinance, bacaStopBursa } from '@/lib/admin';
import {
  jalankanUji, garisIndikator, siapkanSnr, zonaSnrDari, deretSmi, SETELAN_BAWAAN,
  type Setelan, type HasilUji,
} from '@/lib/backtest';
import { SIMBOL_DASAR, simbolDasarMt5 } from '@/lib/simbol';
import { useAuth } from '@/lib/auth';
import { modePreview, jatahTerpakai, pakaiJatah } from '@/lib/preview';
import { usePaket, pakaiKuota, teksSisa } from '@/lib/paket';

/* ════════════════════════════════════════════════════════════════════════
   CHART & BACKTEST
   ════════════════════════════════════════════════════════════════════════
   Halaman ini dulu prototipe seluruhnya: lilin random-walk berseed tetap,
   panel hasil berisi angka contoh, tombol "Jalankan Backtest" tanpa
   penanganan klik. Sekarang ketiganya sungguhan.

   Datanya lewat proxy VPS yang sama dengan screener — bukan langsung ke
   Binance, yang diblokir sebagian ISP Indonesia. Indikatornya dihitung
   dengan fungsi yang SAMA dengan screener (jt-scan-core), jadi sinyal yang
   terlihat di sini adalah sinyal yang sama dengan yang muncul di Screener
   Entry. Kalau keduanya memakai perhitungan terpisah, selisihnya cuma soal
   waktu dan tidak akan ada yang tahu mana yang benar.

   BATAS YANG DIAKUI TERBUKA: ini backtest KRIPTO. Menguji EA MetaTrader
   butuh Strategy Tester MT5, yang berjalan di Windows dan bukan di halaman
   web — jalur itu menunggu VPS Windows tersendiri.
   ════════════════════════════════════════════════════════════════════════ */

const TF = [
  { nilai: '1m', label: '1 Menit' },
  { nilai: '5m', label: '5 Menit' },
  { nilai: '15m', label: '15 Menit' },
  { nilai: '30m', label: '30 Menit' },
  { nilai: '1h', label: '1 Jam' },
  { nilai: '4h', label: '4 Jam' },
  { nilai: '1d', label: 'Harian' },
];

/** Timeframe yang BENAR-BENAR dikirim EA Trade-Fi.
 *  ──────────────────────────────────────────────────────────────────────
 *  Binance melayani semua interval di atas, tapi MT5 tidak: yang ada di
 *  server cuma apa yang dikirim EA dari terminal orangnya. EA v2.03 ke
 *  bawah mengirim lima ini saja, jadi memilih 1m/30m pada simbol MT5
 *  menghasilkan chart kosong — dan chart kosong tanpa sebab yang terlihat
 *  adalah bug di mata pemakainya, bukan fitur yang belum ada.
 *
 *  Dipakai untuk menjelaskan, bukan untuk melarang: begitu EA diperbarui,
 *  timeframe-nya terisi sendiri tanpa halaman ini perlu diubah lagi. */
const TF_MT5 = ['5m', '15m', '1h', '4h', '1d'];

/** Durasi tiap timeframe dalam milidetik. */
const DURASI_TF: Record<string, number> = {
  '1m': 60_000, '5m': 5 * 60_000, '15m': 15 * 60_000, '30m': 30 * 60_000,
  '1h': 3_600_000, '4h': 4 * 3_600_000, '1d': 24 * 3_600_000,
};

/** 3725 -> "1:02:05". Jam disembunyikan kalau nol — "0:02:05" membuat mata
 *  membaca angka yang tidak membawa informasi apa pun. */
function jamMundur(detikTotal: number) {
  const d = Math.floor(detikTotal);
  const j = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60), s = d % 60;
  const dua = (n: number) => String(n).padStart(2, '0');
  return j > 0 ? `${j}:${dua(m)}:${dua(s)}` : `${m}:${dua(s)}`;
}

const KELAS_ISIAN =
  'h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 text-[12.5px] text-zinc-200 ' +
  'outline-none transition-colors hover:border-zinc-700 focus-visible:border-zinc-600';

function Angka({ label, nilai, atur, langkah = 1, min = 0 }: {
  label: string; nilai: number; atur: (n: number) => void; langkah?: number; min?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-zinc-500">{label}</label>
      <input type="number" value={nilai} step={langkah} min={min}
             onChange={(e) => atur(Number(e.target.value))}
             className={cn(KELAS_ISIAN, 'angka')} />
    </div>
  );
}

/** Rapikan simbol untuk chart.
 *
 *  Kripto ditulis huruf besar semua — Binance memang begitu. Simbol MT5
 *  TIDAK: nama simbol broker PEKA huruf besar-kecil, dan Exness memakai
 *  akhiran kecil ("EURJPYc", "XAUUSDc"). Meng-uppercase-nya mengubahnya
 *  jadi simbol yang tidak ada, dan chart menjawab "belum ada data dari
 *  terminal MT5" — pesan yang menunjuk ke EA, padahal EA-nya baik-baik
 *  saja dan yang salah nama yang kita cari. */
/* Berapa lama bilah alat gambar menganggur sebelum melipat sendiri.
   Sengaja lebih panjang daripada panel order: memilih alat lalu berpikir
   di mana menaruh garisnya memakan waktu, dan bilah yang lenyap di tengah
   pertimbangan itu memaksa mulai dari awal. */
const JEDA_LIPAT_ALAT_MS = 20_000;

/* -- Tampilan chart pilihan orangnya --------------------------------------
   Disimpan sendiri di localStorage, BUKAN lewat simpanSetelanChart: setelan
   di sana dikunci per simbol+timeframe, sementara warna adalah selera yang
   berlaku di semua chart. Orang yang memilih biru-oranye tidak sedang
   memilihnya "untuk BTCUSDT H4 saja".

   `jt.warnaLilin` adalah kunci versi pertama yang cuma menyimpan dua warna
   badan. Ia masih dibaca sebagai bahan pindahan supaya pilihan yang sudah
   dibuat tidak hilang begitu saja saat setelannya bertambah. */
const KUNCI_TAMPILAN = 'jt.tampilanChart';
const KUNCI_LAMA_WARNA = 'jt.warnaLilin';

/* Divalidasi, bukan dipercaya. Isi localStorage bisa disunting tangan atau
   tertinggal dari versi lama, dan warna yang tidak sah membuat
   lightweight-charts menggambar lilin transparan -- chart yang tampak kosong
   tanpa satu pun galat di konsol. */
const warnaSah = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

/** Lebih lebar daripada TampilanChart: dua medan terakhir tidak dikirim ke
 *  ChartLilin sebagai setelan, melainkan MENENTUKAN apakah prop `tandaAir`
 *  dikirim sama sekali dan apa isinya. Dipisah begitu supaya ChartLilin tidak
 *  perlu tahu ada pilihan on/off -- ia cuma menggambar apa yang diberikan. */
export type SetelanTampilan = TampilanChart & { tandaAir: boolean; tandaAirTeks: string };

const TAMPILAN_AWAL: SetelanTampilan = { ...TAMPILAN_BAWAAN, tandaAir: true, tandaAirTeks: '' };

/** Empat petak warna di panel setelan, urut baca: badan dulu baru ekor. */
const MEDAN_WARNA = [
  ['naik', 'Badan naik'], ['turun', 'Badan turun'],
  ['ekorNaik', 'Ekor naik'], ['ekorTurun', 'Ekor turun'],
] as const;

function bacaTampilan(): SetelanTampilan {
  const hasil: SetelanTampilan = { ...TAMPILAN_AWAL };
  const serap = (d: unknown) => {
    if (!d || typeof d !== 'object') return;
    const o = d as Record<string, unknown>;
    /* Per medan, bukan seluruh objek sekaligus: berkas dari versi lama tidak
       punya medan ekor, dan menolak seluruh isinya karena satu medan hilang
       akan membuang pilihan yang sah. */
    (['naik', 'turun', 'ekorNaik', 'ekorTurun'] as const).forEach((k) => {
      if (warnaSah(o[k])) hasil[k] = o[k];
    });
    if (warnaSah(o.latar)) hasil.latar = o.latar;
    if (typeof o.tandaAir === 'boolean') hasil.tandaAir = o.tandaAir;
    if (typeof o.tandaAirTeks === 'string') hasil.tandaAirTeks = o.tandaAirTeks.slice(0, 40);
  };
  try { serap(JSON.parse(localStorage.getItem(KUNCI_LAMA_WARNA) ?? 'null')); } catch { /* privat */ }
  try { serap(JSON.parse(localStorage.getItem(KUNCI_TAMPILAN) ?? 'null')); } catch { /* privat */ }
  /* Versi lama tidak punya warna ekor sama sekali. Yang benar adalah
     mengikuti badannya, bukan kembali ke hijau/merah bawaan: orang yang
     sudah memilih biru-ungu tidak sedang meminta ekor hijau. */
  try {
    const lama = JSON.parse(localStorage.getItem(KUNCI_LAMA_WARNA) ?? 'null');
    if (lama && !localStorage.getItem(KUNCI_TAMPILAN)) {
      if (warnaSah(lama.naik)) hasil.ekorNaik = lama.naik;
      if (warnaSah(lama.turun)) hasil.ekorTurun = lama.turun;
    }
  } catch { /* privat */ }
  return hasil;
}

function rapikanSimbol(s: string): string {
  const t = s.trim();
  return /^MT5:/i.test(t) ? 'MT5:' + t.slice(4) : t.toUpperCase();
}

export default function ChartBacktest() {
  /* Simbol & timeframe boleh datang dari alamatnya: `#/chart?simbol=ETHUSDT`.
     Itulah yang dipakai menu klik-kanan di Screener Entry untuk membuka koin
     tertentu di sini, dan juga yang membuat halaman ini bisa ditandai. */
  const [cari] = useSearchParams();
  const navigasi = useNavigate();
  /* Urutan sumber: ALAMAT dulu, lalu setelan tersimpan, baru bawaan.
     Alamat menang karena ia perbuatan yang baru saja dilakukan — klik kanan
     di screener harus membuka koin yang diklik, bukan koin kemarin. */
  const awal = bacaSetelanChart();
  const { data: posisiBursa, order: orderBursa, segarkan: segarkanBursa } = usePosisiBinance();
  const akunMt5 = useAkunMt5();
  const [simbol, setSimbol] = useState(() => rapikanSimbol(cari.get('simbol') || awal.simbol || 'BTCUSDT'));
  /* Daftar timeframe yang boleh datang dari alamat — DIAMBIL dari TF, bukan
     ditulis ulang. Dulu ini array terpisah berisi lima nilai, dan saat 1m
     dan 30m ditambahkan ke TF, `?tf=1m` diam-diam jatuh ke 4h: tautan yang
     menunjuk timeframe baru membuka timeframe yang salah tanpa memberi tahu
     siapa pun. Satu sumber, tidak bisa berselisih lagi. */
  const [tf, setTf] = useState(() => {
    const t = (cari.get('tf') || awal.tf || '4h').toLowerCase();
    return TF.some((x) => x.nilai === t) ? t : '4h';
  });

  /* Alamat yang berubah saat halaman sudah terbuka ikut diikuti — klik kanan
     di screener dua kali berturut-turut harus berpindah dua kali. */
  useEffect(() => {
    const s = cari.get('simbol');
    if (s) setSimbol(rapikanSimbol(s));
    const x = (cari.get('tf') || '').toLowerCase();
    if (x && TF.some((y) => y.nilai === x)) setTf(x);
  }, [cari]);
  const [lilin, setLilin] = useState<Lilin>({ opens: [], highs: [], lows: [], closes: [], times: [] });
  /* Dibaca di dalam penarikan data untuk memutuskan apakah kegagalan layak
     jadi peringatan. Ref, bukan state: penarikannya berjalan di dalam efek
     yang sengaja TIDAK berdependensi pada lilin -- kalau iya, setiap data
     masuk akan membatalkan dan menjadwalkan ulang pollingnya sendiri. */
  const lilinRef = useRef(lilin);
  lilinRef.current = lilin;
  /* Riwayat tambahan hasil "Muat lebih lama", DISIMPAN TERPISAH dari `lilin`.
     ────────────────────────────────────────────────────────────────────
     `lilin` disegarkan tiap 3 detik oleh polling harga. Kalau potongan lama
     ikut ditulis ke sana, penyegaran berikutnya akan menimpanya dan riwayat
     yang baru saja ditarik lenyap begitu saja — orangnya menekan tombol,
     melihat chart memanjang, lalu tiga detik kemudian kembali seperti semula
     tanpa penjelasan.

     Disimpan terpisah lalu disambung saat menggambar: polling boleh menimpa
     `lilin` sesukanya, riwayat lamanya tidak tersentuh. */
  const [riwayatLama, setRiwayatLama] = useState<Lilin | null>(null);
  const [muatLama, setMuatLama] = useState(false);
  const [habisRiwayat, setHabisRiwayat] = useState(false);
  /* Jendela pandang sedang menyentuh bar paling tua. Dilaporkan ChartLilin,
     dan hanya saat BERUBAH -- lihat catatan di sana. */
  const [diUjungKiri, setDiUjungKiri] = useState(false);
  /* Alasan penolakan dari SERVER, bukan hitungan sendiri. Kosong berarti
     belum pernah ditolak. */
  const [tolakRiwayat, setTolakRiwayat] = useState('');

  /* Potongan lama dibuang tiap ganti simbol atau timeframe — riwayat BTC
     harian tidak berarti apa-apa di chart ETH 15 menit, dan menyambungnya
     akan menggambar harga yang tidak pernah terjadi. */
  useEffect(() => { setRiwayatLama(null); setHabisRiwayat(false); }, [simbol, tf]);

  /* Lilin yang BENAR-BENAR digambar: riwayat lama di depan, data hidup di
     belakang. */
  const lilinGabung: Lilin = useMemo(() => {
    if (!riwayatLama || !riwayatLama.times.length) return lilin;
    /* Titik potong dicari dari WAKTU, bukan dari panjang array: polling bisa
       menggeser jendela `lilin` beberapa lilin ke depan di antara dua
       penyegaran, dan menyambung dengan asumsi panjang tetap akan
       menghasilkan lilin kembar atau lubang. */
    const mulaiHidup = lilin.times[0] ?? Infinity;
    let potong = riwayatLama.times.length;
    while (potong > 0 && riwayatLama.times[potong - 1] >= mulaiHidup) potong--;
    return {
      times:  [...riwayatLama.times.slice(0, potong),  ...lilin.times],
      opens:  [...riwayatLama.opens.slice(0, potong),  ...lilin.opens],
      highs:  [...riwayatLama.highs.slice(0, potong),  ...lilin.highs],
      lows:   [...riwayatLama.lows.slice(0, potong),   ...lilin.lows],
      closes: [...riwayatLama.closes.slice(0, potong), ...lilin.closes],
    };
  }, [riwayatLama, lilin]);

  async function muatLebihLama() {
    const tertua = (riwayatLama?.times[0] ?? lilin.times[0]) || 0;
    if (!tertua || muatLama) return;
    setMuatLama(true);
    try {
      /* SERVER yang memutuskan, sebelum satu lilin pun diminta. Dulu di sini
         ada penghitung localStorage; itu bukan pagar, cuma saran yang bisa
         dihapus lewat DevTools dalam tiga detik.

         pakaiKuota melepaskan pemakaian saat servernya sendiri bermasalah
         (lihat catatannya di lib/paket) -- lebih baik satu pemakaian tidak
         terhitung daripada pelanggan terkunci karena jaringan buruk. */
      const izin = await pakaiKuota('riwayat');
      if (!izin.boleh) {
        setTolakRiwayat(izin.alasan || 'Jatah riwayat paket ini sudah habis.');
        return;
      }
      setTolakRiwayat('');
      if (izin.paket) muatPaket();
      const potongan = await ambilKlinesSebelum(simbol, tf, tertua - 1);
      /* Kosong = sudah mentok. Ditandai supaya tombolnya berhenti menawarkan
         sesuatu yang tidak ada lagi, bukan diam-diam tidak melakukan apa-apa
         setiap kali ditekan. */
      if (!potongan.times.length) { setHabisRiwayat(true); return; }
      /* Kalau replay sedang berjalan, indeksnya DIGESER sebanyak lilin yang
         baru disisipkan di depan — supaya bar yang sedang ditonton tetap bar
         yang sama. Tanpa ini, menekan "Muat lebih lama" di tengah replay
         melompat mundur bertahun-tahun tanpa ada yang menyentuh penggeser. */
      setReplayIdx((i) => (i === null ? i : i + potongan.times.length));
      setRiwayatLama((lama) => lama ? {
        times:  [...potongan.times,  ...lama.times],
        opens:  [...potongan.opens,  ...lama.opens],
        highs:  [...potongan.highs,  ...lama.highs],
        lows:   [...potongan.lows,   ...lama.lows],
        closes: [...potongan.closes, ...lama.closes],
      } : potongan);
    } finally { setMuatLama(false); }
  }
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [segar, setSegar] = useState(0);
  const [kunciChart, setKunciChart] = useState(0);
  const [set, setSet] = useState<Setelan>(SETELAN_BAWAAN);
  const [hasil, setHasil] = useState<HasilUji | null>(null);
  const [uji, setUji] = useState(false);
  /* null = replay mati. Angkanya indeks bar terakhir yang boleh tampil. */
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  /* MODE BIDIK — sekali pakai, bukan keadaan yang menetap.
     ────────────────────────────────────────────────────────────────────
     Menekan Replay tidak langsung memulai; ia menyalakan mode ini, dan
     klik BERIKUTNYA di chart menentukan titik mulainya. Sesudah satu klik
     modenya padam sendiri.

     Kenapa sekali pakai, bukan "klik kapan saja saat replay jalan": area
     chart dipakai untuk banyak hal — memilih garis, menaruh alat, sekadar
     memfokuskan. Kalau tiap klik di sana memindahkan waktu, tidak ada
     lagi klik yang aman, dan orangnya harus terus mengingat chart sedang
     dalam mode berbahaya. Sekali pakai membalik bebannya: modenya jelas
     menyala, dipakai sekali, lalu hilang. */
  const [bidikReplay, setBidikReplay] = useState(false);
  /* ── Gulir tanpa batang di mode panel ─────────────────────────────────
     Bukan mematikan gulirnya: roda tetap bekerja, yang hilang cuma batang
     abu-abu di tepi. Di panel seperempat layar batang itu memakan lebar
     yang berarti dan mengumumkan "ada yang tidak muat" pada panel yang
     isinya justru sudah pas.

     Kelasnya dipasang ke <html> karena itulah yang menggulir di dalam
     iframe — menaruhnya di div mana pun tidak akan tersentuh. */
  useEffect(() => {
    if (!POLOS) return;
    document.documentElement.classList.add('gulir-senyap');
    return () => document.documentElement.classList.remove('gulir-senyap');
  }, []);

  /* ── Terima simbol yang DIKIRIM ke panel ini ───────────────────────────
     Watchlist di panel utama menawarkan "buka di Panel N" lewat klik kanan;
     yang sampai ke sini cuma pesan yang menyebut id panel ini. Tanpa
     penyaringan itu, satu pilihan akan mengubah simbol semua panel. */
  useEffect(() => {
    if (!POLOS || !ID_PANEL) return;
    return dengarBus((p) => {
      if (p && p.jenis === 'simbol' && p.panel === ID_PANEL && typeof p.simbol === 'string') {
        setSimbol(p.simbol);
      }
      if (p && p.jenis === 'tf' && p.panel === ID_PANEL && typeof p.tf === 'string') {
        setTf(p.tf);
      }
    });
  }, []);

  /* Kepala panel (bilah Simbol/TF/harga/kendali) bisa disembunyikan — HANYA
     di mode panel multi-chart. Di panel seperempat layar, bilah setinggi
     ±90px itu porsi yang serius; chart tunggal tidak butuh sakelar ini.

     BAWAANNYA TERSEMBUNYI di mode panel (permintaan pemilik). Alasannya
     bukan sekadar hemat ruang: simbol dan timeframe tiap panel sudah
     dipilih SEBELUM grid dibuka, jadi bilah pemilih itu menempati porsi
     terbesar panel untuk keputusan yang sudah selesai diambil. Yang masih
     dibutuhkan — simbol dan TF mana ini — tetap terbaca di strip ringkas
     penggantinya, dan satu klik mengembalikannya kalau memang mau diubah. */
  const [kepalaSembunyi, setKepalaSembunyi] = useState(POLOS);
  /* Tabel Posisi/Order Terbuka: ada tombol sembunyikan, dan di mode panel
     BAWAANNYA tersembunyi. Alasan pemilik konkret — menggulir ke bawah
     untuk melihat tabel membuat chartnya keluar layar, dan satu klik yang
     meleset di sana terasa seperti chartnya hilang. Yang tersembunyi tidak
     bisa ditabrak. */
  const [posisiSembunyi, setPosisiSembunyi] = useState(POLOS);
  /* ── Menu timeframe lewat KLIK KANAN di chart ─────────────────────────
     Hanya di mode polos. Panel yang dilepas jadi jendela sendiri tidak
     punya baris nomor panel — di sanalah pemilih TF hidup — jadi tanpa ini
     satu-satunya cara ganti timeframe di jendela lepasan adalah membuka
     bilah kepala dulu. Klik kanan langsung di chart memotong dua langkah,
     dan berlaku sama di panel maupun di jendela lepasan. */
  const [menuTf, setMenuTf] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!menuTf) return;
    const tutup = () => setMenuTf(null);
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuTf(null); };
    /* Ditunda satu putaran: klik kanan yang MEMBUKA menu masih menggelinding
       saat pendengar dipasang, dan tanpa penundaan ia menutup menunya
       sendiri. */
    const t = setTimeout(() => {
      document.addEventListener('click', tutup);
      document.addEventListener('contextmenu', tutup);
    }, 0);
    document.addEventListener('keydown', tekan);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', tutup);
      document.removeEventListener('contextmenu', tutup);
      document.removeEventListener('keydown', tekan);
    };
  }, [menuTf]);
  /* Sakelarnya TIDAK ada di sini lagi — ia pindah ke baris nomor panel di
     grid, sejajar ikon lepas-jendela. Dulu ada dua tempat yang menuliskan
     simbol dan TF: baris nomor panel di grid, dan strip ringkas di dalam
     panel. Dua baris berisi keterangan yang sama, bertumpuk, adalah dua
     kali ruang untuk satu keterangan. Panel sekarang cuma MENURUT. */
  useEffect(() => {
    if (!POLOS || !ID_PANEL) return;
    return dengarBus((p) => {
      if (p && p.jenis === 'kepala' && p.panel === ID_PANEL) {
        setKepalaSembunyi(!!p.sembunyi);
        /* Tinggi chart dihitung dari posisi chart; bilah yang muncul atau
           hilang menggesernya. Pengukurnya digantung ke event resize — picu
           yang itu juga, daripada menambah jalur hitung kedua. */
        setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
      }
    });
  }, []);

  /* Lapor ke grid tiap simbol/TF berubah, dari sebab APA PUN — dipilih di
     bilah kepala, dikirim lewat klik kanan, atau dipulihkan dari alamat.
     Grid memakainya untuk judul panel dan untuk menu "buka di panel mana",
     yang keduanya harus menyebut isi panel SEKARANG. */
  useEffect(() => {
    if (!POLOS || !ID_PANEL) return;
    kirimBus({ jenis: 'lapor', panel: ID_PANEL, simbol, tf });
  }, [simbol, tf]);
  /* Mode bidik dibatalkan tiap ganti simbol/timeframe — bidikan untuk
     chart lain tidak berarti apa-apa di sini. */
  useEffect(() => { setBidikReplay(false); }, [simbol, tf]);
  /* Padam juga begitu replay MULAI lewat jalan mana pun (play, penggeser).
     Tanpa ini klik di chart sesudahnya masih dianggap membidik dan
     melempar posisi replay yang sudah berjalan. */
  useEffect(() => { if (replayIdx !== null) setBidikReplay(false); }, [replayIdx]);

  /* Replay dikunci SATU konteks pada satu waktu — beberapa panel multi-chart
     yang me-replay bersamaan saling berebut CPU sampai semuanya tersendat.
     Kuncinya dipegang selama replay hidup; pelepasnya jalan saat replay
     selesai ATAU panelnya ditutup. Deps-nya boolean, bukan replayIdx utuh:
     kunci tidak perlu dilepas-pasang tiap bar maju. */
  const sedangReplay = replayIdx !== null;
  useEffect(() => {
    if (!sedangReplay) return;
    return pegangReplay();
  }, [sedangReplay]);

  /* ── Jatah replay untuk pengunjung preview ────────────────────────────
     `!pengguna` bukan pelengkap: penanda preview hidup di sessionStorage
     dan bisa TERTINGGAL di tab yang sama setelah orangnya masuk. Membaca
     modePreview() saja akan membatasi replay milik pelanggan yang sudah
     membayar — kegagalan yang paling mahal dari dua kemungkinan salah. */
  const { pengguna } = useAuth();
  const tamuPreview = modePreview() && !pengguna;
  /* Dua pagar berbeda untuk dua orang berbeda: `tamuPreview` menjaga
     pengunjung yang belum punya akun, `paketku` menjaga batas paket orang
     yang sudah masuk. Keduanya menjaga tombol yang sama dan itu bukan
     duplikasi — alasan membatasinya berbeda, jadi kalimatnya juga berbeda. */
  const { paket: paketku, muatUlang: muatPaket } = usePaket();
  const [kabarReplay, setKabarReplay] = useState('');
  /* Jatahnya ditandai terpakai saat replay BENAR-BENAR mulai, bukan saat
     tombolnya ditekan. Menekan Replay cuma menyalakan mode bidik, dan
     orang yang membatalkannya sebelum memilih titik belum melihat apa pun —
     menghabiskan jatahnya di situ adalah hukuman untuk keragu-raguan. */
  useEffect(() => {
    if (tamuPreview && replayIdx !== null) pakaiJatah('replay');
  }, [tamuPreview, replayIdx]);
  const [garisHarga, setGarisHarga] = useState<GarisHarga[]>([]);
  /* Panel Backtest tertutup saat halaman dibuka. Ia beta, dan yang beta
     tidak boleh menempati ruang tetap di layar seolah sudah matang. */
  const [backtestBuka, setBacktestBuka] = useState(false);
  /* Lebar watchlist naik ke sini HANYA sebagai pemicu ukur-ulang chart —
     kolomnya sendiri tetap diurus WatchChart. */
  const [lebarWatch, setLebarWatch] = useState(0);
  const [aksi, setAksi] = useState<AksiOrder | null>(null);
  const [pine, setPine] = useState<HasilPine | null>(null);
  /* ── Menu indikator, dock Pine, watchlist, alat gambar ─────────────
     SNR, SMI, dan skrip Pine kini satu keluarga di balik satu tombol
     Indikator; yang aktif tampil sebagai legend di pojok chart, persis
     TradingView. Dock Pine meluncur dari kanan supaya menyunting skrip
     tidak pernah kehilangan chartnya dari pandangan. */
  const [menuInd, setMenuInd] = useState(false);
  const [dockBuka, setDockBuka] = useState(false);
  const [dockTab, setDockTab] = useState<'editor' | 'input'>('editor');
  const [pineInfo, setPineInfo] = useState<InfoPine | null>(null);
  const [kendaliPine, setKendaliPine] = useState<KendaliPine | null>(null);
  /* Alat gambar tangan — ukur %, fibonacci, kotak SNR. Gambarnya milik
     SIMBOL+TF: kotak support BTC 1 jam tidak ada urusannya dengan ETH. */
  const [alat, setAlat] = useState<AlatPegang | null>(null);
  const [gambarAlat, setGambarAlat] = useState<GambarAlat[]>([]);
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(`jt.alat.${simbol}|${tf}`) ?? '[]') as GambarAlat[];
      setGambarAlat(Array.isArray(d) ? d : []);
    } catch { setGambarAlat([]); }
    setAlat(null);
  }, [simbol, tf]);
  /* Hasil Pine dari simbol lama DIBUANG saat chart berganti — garis di
     level 64.000 milik BTC yang tergambar di chart ONE 0,0009 membuat
     skala harga meledak dan grafiknya "rusak". Skrip aktif dihitung ulang
     sendiri oleh dock begitu data simbol baru tiba. */
  useEffect(() => { setPine(null); }, [simbol, tf]);
  const tambahGambar = useCallback((g: Omit<GambarAlat, 'id'>) => {
    const id = 'g' + Date.now();
    setGambarAlat((d) => {
      const b = [...d, { ...g, id }];
      try { localStorage.setItem(`jt.alat.${simbol}|${tf}`, JSON.stringify(b)); } catch { /* privat */ }
      return b;
    });
    /* Alat posisi langsung TERPILIH begitu ditempel. Angkanya cuma tampil
       saat terpilih, jadi tanpa ini yang baru saja ditaruh orang muncul
       sebagai dua bidang warna tanpa satu angka pun — dan pegangannya juga
       belum ada, padahal menggeser garis persis itu yang dikerjakan
       berikutnya. */
    if (g.jenis === 'posisi') setGambarPilih(id);
    /* Satu tarikan, satu gambar — kembali ke kursor biasa. Menggambar lagi
       tinggal menekan alatnya lagi; alat yang menempel diam-diam membuat
       seretan chart berikutnya jadi kotak yang tidak diminta. */
    setAlat(null);
  }, [simbol, tf]);
  /* Menggeser gambar / menarik ujungnya. Disimpan ke localStorage pada
     kunci simbol|tf yang SAMA dengan penambahan — gambar yang dipindah
     lalu kembali ke tempat lama saat halaman dibuka ulang lebih
     menjengkelkan daripada gambar yang tidak bisa dipindah sama sekali. */
  const ubahGambar = useCallback((id: string, ubah: Partial<GambarAlat>) => {
    setGambarAlat((d) => {
      const b = d.map((g) => (g.id === id ? { ...g, ...ubah } : g));
      try { localStorage.setItem(`jt.alat.${simbol}|${tf}`, JSON.stringify(b)); } catch { /* privat */ }
      return b;
    });
  }, [simbol, tf]);
  /* Gambar TERPILIH: klik gambarnya di mode kursor biasa, hapus dengan
     Delete/Backspace, batal pilih dengan Escape. */
  const [gambarPilih, setGambarPilih] = useState<string | null>(null);
  /* Ganti simbol/TF: yang terpilih sudah tidak ada di layar. */
  useEffect(() => { setGambarPilih(null); }, [simbol, tf]);
  /* MEMEGANG alat baru membatalkan pilihan, tapi MELEPASNYA tidak. Dulu
     keduanya satu efek dengan `alat` di daftar kebergantungan, dan itu
     baik-baik saja selama tidak ada alat yang memilih hasilnya sendiri:
     alat posisi menempel, memilih gambarnya, lalu melepaskan dirinya —
     dan pelepasan itu langsung mencabut pilihan yang baru saja dibuat. */
  useEffect(() => { if (alat) setGambarPilih(null); }, [alat]);
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const t = document.activeElement?.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && gambarPilih) {
        setGambarAlat((d) => {
          const b = d.filter((g) => g.id !== gambarPilih);
          try { localStorage.setItem(`jt.alat.${simbol}|${tf}`, JSON.stringify(b)); } catch { /* privat */ }
          return b;
        });
        setGambarPilih(null);
      }
      if (e.key === 'Escape') setGambarPilih(null);
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [gambarPilih, simbol, tf]);
  /* BAWAANNYA TERLIPAT — alasan yang sama dengan panel order: di layar
     ponsel bilah alat gambar memakan tepi chart sebelum ada satu pun
     gambar yang ingin dibuat. Yang pernah membukanya sendiri tetap
     menemukannya terbuka; cuma yang BELUM PERNAH memilih (null) yang
     dilipat. */
  const [alatTutup, setAlatTutup] = useState(() => {
    try {
      const v = localStorage.getItem('jt.alatTutup');
      return v === null ? true : v === '1';
    } catch { return true; }
  });
  /* ── Letak bilah alat: BISA DIPINDAH ────────────────────────────
     Posisi tetap selalu salah untuk sebagian orang: panel order membuka
     dari kiri atas, dock Pine dari kanan, dan tinggi chart bisa diseret.
     Apa pun sudut yang dipilih, ada susunan yang membuatnya menghalangi.
     Jadi tempatnya ditentukan pemakainya sendiri — diseret, lalu diingat
     per perangkat.

     Disimpan sebagai jarak dari kiri-atas area chart dalam piksel, bukan
     persen: chart yang tingginya diseret akan menggeser bilah yang
     posisinya berbasis persen, padahal orangnya tidak memindahkannya. */
  /* null = belum pernah dipindah → pakai tempat bawaannya (pojok kiri
     bawah, lewat kelas CSS). Menyimpan bawaan sebagai ANGKA piksel akan
     mengunci letaknya ke satu ukuran layar: yang pas di 1280 px jatuh di
     tengah chart pada layar 3440 px. Angka baru muncul setelah orangnya
     benar-benar memindahkannya. */
  const [letakAlat, setLetakAlat] = useState<{ x: number; y: number } | null>(() => {
    try {
      const d = JSON.parse(localStorage.getItem('jt.letakAlat') ?? 'null');
      if (d && typeof d.x === 'number' && typeof d.y === 'number') return d;
    } catch { /* privat */ }
    return null;
  });
  const areaChart = useRef<HTMLDivElement>(null);
  /** Kartu chart utuh — bilah kendali DAN grafiknya. Inilah yang dinaikkan
   *  ke layar penuh; `areaChart` tetap dipakai untuk mengukur lebar kanvas. */
  const kartuChart = useRef<HTMLDivElement>(null);
  /** Bilah kendali di kepala kartu. Tingginya diukur saat layar penuh
   *  supaya kanvasnya mengisi sisa jendela dengan tepat. */
  const bilahChart = useRef<HTMLDivElement>(null);

  function mulaiSeretAlat(e: React.PointerEvent) {
    /* Tombol alatnya sendiri tidak boleh ikut memicu seretan — kalau ikut,
       memilih alat jadi mustahil tanpa menggeser bilahnya. */
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const kotakBilah = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const b0 = areaChart.current?.getBoundingClientRect();
    /* Kalau belum pernah dipindah, titik awalnya diambil dari LETAK
       SEBENARNYA di layar — bukan dari angka bawaan yang tidak ada. */
    const awal = {
      x: e.clientX, y: e.clientY,
      lx: letakAlat ? letakAlat.x : (b0 ? kotakBilah.left - b0.left : 8),
      ly: letakAlat ? letakAlat.y : (b0 ? kotakBilah.top - b0.top : 8),
    };
    const batas = () => areaChart.current?.getBoundingClientRect();
    const hitung = (ev: PointerEvent) => {
      const b = batas();
      const x = awal.lx + (ev.clientX - awal.x);
      const y = awal.ly + (ev.clientY - awal.y);
      if (!b) return { x, y };
      /* Dijepit di dalam area chart, disisakan 36 px supaya bilahnya
         tidak bisa diseret keluar layar dan hilang selamanya. */
      return {
        x: Math.max(4, Math.min(b.width - 36, x)),
        y: Math.max(4, Math.min(b.height - 36, y)),
      };
    };
    const gerak = (ev: PointerEvent) => setLetakAlat(hitung(ev));
    const lepas = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      try { localStorage.setItem('jt.letakAlat', JSON.stringify(hitung(ev))); } catch { /* privat */ }
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
  }

  /* ── BILAH ALAT MENGHINDAR DARI TIKET ORDER ────────────────────────
     Tiket order dijangkarkan di pojok kiri-ATAS chart dan tumbuh ke
     bawah; bilah alat duduk di tepi kiri, di TENGAH. Di chart yang
     pendek — HP, atau jendela yang tingginya dikecilkan — keduanya
     bertemu, dan yang tertimbun bilah alatnya.

     Digeser sementara lewat transform, BUKAN dengan mengubah `letakAlat`.
     letakAlat adalah tempat yang dipilih orangnya sendiri dan disimpan;
     menimpanya berarti posisi pilihannya hilang diam-diam, dan ia tidak
     akan kembali saat tiketnya ditutup. */
  const alatRef = useRef<HTMLElement | null>(null);
  const pojokRef = useRef<HTMLDivElement>(null);
  const geserRef = useRef(0);
  const [geserAlat, setGeserAlat] = useState(0);
  useEffect(() => { geserRef.current = geserAlat; }, [geserAlat]);

  useEffect(() => {
    const hitung = () => {
      const a = alatRef.current, p = pojokRef.current;
      if (!a || !p) { setGeserAlat(0); return; }
      const ra = a.getBoundingClientRect();
      const rp = p.getBoundingClientRect();
      if (!rp.width || !rp.height) { setGeserAlat(0); return; }
      /* Kotak alat pada posisi ASLINYA: geseran yang sedang berlaku
         dikurangkan dulu. Tanpa ini tiap pengukuran menumpuk di atas
         pengukuran sebelumnya dan bilahnya merayap turun tanpa henti. */
      const atas = ra.top - geserRef.current;
      const bawah = ra.bottom - geserRef.current;
      const tindih = rp.left < ra.right && rp.right > ra.left
                  && rp.top < bawah && rp.bottom > atas;
      setGeserAlat(tindih ? Math.round(rp.bottom + 8 - atas) : 0);
    };
    hitung();
    /* ResizeObserver, bukan daftar state: tiket order melipat, membuka,
       dan berganti bentuk dari dalam dirinya sendiri — halaman ini tidak
       tahu kapan. Yang bisa diamati cuma akibatnya, yaitu ukurannya. */
    const ro = new ResizeObserver(hitung);
    if (alatRef.current) ro.observe(alatRef.current);
    if (pojokRef.current) ro.observe(pojokRef.current);
    window.addEventListener('resize', hitung);
    return () => { ro.disconnect(); window.removeEventListener('resize', hitung); };
  }, [aksi, alatTutup, letakAlat]);

  /* ── BILAH ALAT MELIPAT SENDIRI ────────────────────────────────────
     Hanya saat tidak ada alat yang sedang aktif — bilah yang melipat di
     tengah orang menarik garis fibonacci adalah kerusakan, bukan fitur.
     Penghitungnya disetel ulang tiap pointer menyentuh atau masuk ke
     areanya. */
  const [sentuhAlat, setSentuhAlat] = useState(0);
  const bangunkanAlat = () => setSentuhAlat((n) => n + 1);
  useEffect(() => {
    if (alatTutup || alat) return;
    const t = setTimeout(() => aturAlatTutup(true), JEDA_LIPAT_ALAT_MS);
    return () => clearTimeout(t);
  }, [alatTutup, alat, sentuhAlat]);

  /* Satu tempat menghitung posisi bilah alat, dipakai kedua wujudnya
     (terlipat dan terbuka) supaya keduanya tidak pernah menyimpang. */
  const gayaAlat: React.CSSProperties = letakAlat
    ? { left: letakAlat.x, top: letakAlat.y,
        transform: geserAlat ? `translateY(${geserAlat}px)` : undefined }
    : { transform: `translateY(calc(-50% + ${geserAlat}px))` };

  function aturAlatTutup(v: boolean) {
    setAlatTutup(v);
    try { localStorage.setItem('jt.alatTutup', v ? '1' : '0'); } catch { /* privat */ }
  }
  function bukaDock(t: 'editor' | 'input') {
    /* Watchlist tidak lagi perlu ditutup di sini: ia kolom sendiri,
       tidak menindih dock Pine yang meluncur di atas grafik. */
    setDockTab(t); setDockBuka(true); setMenuInd(false);
  }
  /* ── Sunting SL/TP order yang SUDAH ADA ─────────────────────────
     Diisi saat baris di panel Posisi Terbuka diklik. Selama terisi,
     chart menggambar tiga garis order itu — entry terkunci, SL & TP
     bisa diseret — dan sebuah bilah kecil menawarkan Kirim perubahan.

     Dipisah dari `rencana` (tiket yang sedang disusun) dengan sengaja:
     keduanya menggambar garis yang mirip, tapi akibat menekan Kirim
     sangat berbeda. Satu membuka posisi baru, satu mengubah yang sudah
     jalan; menyatukannya berarti satu salah klik bisa membuka order
     yang tidak diminta. */
  const [sunting, setSunting] = useState<OrderSunting | null>(null);
  /* Cermin `sunting` yang selalu mutakhir. akhiriOrder bisa dipanggil satu
     tick setelah setSunting (dari tombol Tutup di tabel), dan pada saat itu
     closure-nya masih memegang nilai render SEBELUMNYA — menutup order yang
     salah, atau tidak menutup apa pun. Ref tidak menunggu render. */
  const suntingAktif = useRef<OrderSunting | null>(null);
  suntingAktif.current = sunting;
  /* Disimpan sebagai TEKS, bukan angka. Isian angka yang menyimpan
     number tidak bisa diketik: "0." berubah jadi 0 di tengah ketikan dan
     titiknya hilang, jadi harga desimal mustahil dimasukkan tangan.
     Angkanya diurai saat dipakai, bukan saat diketik. */
  const [suntingSlTeks, setSuntingSlTeks] = useState('');
  const [suntingTpTeks, setSuntingTpTeks] = useState('');
  const suntingSl = Number(suntingSlTeks) || 0;
  const suntingTp = Number(suntingTpTeks) || 0;
  /* Harga hasil SERETAN dibulatkan ke jumlah desimal yang sama dengan
     harga entry-nya. Tanpa ini seretan menghasilkan angka penuh presisi
     mesin — 0.1288668232530828 — dan bursa menolaknya dengan "precision
     is over the maximum defined for this asset". Ditolak bursa berarti
     stop yang dikira sudah terpasang ternyata tidak ada; itu kegagalan
     yang mahal untuk sesuatu yang cuma soal pembulatan. */
  /* Tick simbol dari bursa — diambil sekali saat order dipilih. Nol
     berarti belum/ tidak diketahui; pembulatannya jatuh ke tebakan
     desimal, dan itu ditulis apa adanya alih-alih berpura-pura tahu. */
  const [tickAktif, setTickAktif] = useState(0);

  function bulatkanHarga(n: number, acuan: number): number {
    if (tickAktif > 0) return keTick(n, tickAktif);
    const teks = String(acuan);
    const titik = teks.indexOf('.');
    const desimal = titik < 0 ? 0 : Math.min(8, teks.length - titik - 1);
    return Number(n.toFixed(desimal));
  }
  const setSuntingSl = (n: number) => setSuntingSlTeks(n ? String(n) : '');
  const setSuntingTp = (n: number) => setSuntingTpTeks(n ? String(n) : '');
  /* ── Dua langkah: pilih dulu, baru ubah ────────────────────────────
     Mengklik nama pair MENAMPILKAN ordernya di chart — entry, SL, TP —
     dan berhenti di situ. Panel ubahnya baru muncul setelah salah satu
     garis itu diklik.

     Alasannya: kebanyakan klik pada nama pair cuma ingin MELIHAT, "stop
     saya sekarang di mana". Memunculkan panel berisi tombol Kirim dan
     Tutup posisi untuk maksud sebesar itu berarti alat pengubah uang
     terbuka sepanjang waktu, menutupi chart yang sedang dibaca. Panelnya
     sekarang menunggu sampai ada yang benar-benar menuju garisnya. */
  const [panelUbah, setPanelUbah] = useState(false);
  const [suntingSibuk, setSuntingSibuk] = useState(false);
  const [suntingKabar, setSuntingKabar] = useState('');

  /* Menutup panel ubah MENGEMBALIKAN seretan ke level aslinya.
     ────────────────────────────────────────────────────────────────────
     Dulu tombol tutup cuma menyembunyikan panelnya. Nilai hasil seretan
     tetap tersimpan, jadi garis SL/TP tetap tergambar di tempat baru —
     padahal Kirim tidak pernah ditekan dan broker masih memegang level
     yang lama.

     Itu jenis kebohongan yang paling mahal di layar trading: orangnya
     melihat stop di tempat yang ia inginkan, menutup panelnya karena
     merasa selesai, dan pergi dengan keyakinan bahwa posisinya terlindungi
     di situ. Yang melindunginya masih level lama, dan tidak ada satu pun
     tanda di layar yang mengatakannya.

     Sekarang menutup panel = membatalkan. Satu-satunya cara mengubah level
     adalah menekan Kirim. */
  function tutupPanelUbah() {
    setPanelUbah(false);
    setSuntingKabar('');
    setSuntingSlTeks(sunting?.sl ? String(sunting.sl) : '');
    setSuntingTpTeks(sunting?.tp ? String(sunting.tp) : '');
  }

  function bukaSunting(o: OrderSunting) {
    setSimbol(rapikanSimbol(o.simbolChart));
    /* PINDAH KE MODE REAL, otomatis.
       ──────────────────────────────────────────────────────────────────
       Yang diklik adalah posisi SUNGGUHAN di broker. Membukanya sementara
       chart masih di mode latihan berarti dua hal yang berlawanan tampil
       bersamaan: garis order nyata di atas chart yang sedang berpura-pura.
       Orangnya lalu menyeret SL — dan tidak ada satu pun tanda di layar
       apakah seretan itu akan mengubah posisi nyata atau cuma simulasi.

       Jadi modenya ikut berpindah. Tidak ada yang perlu ditebak: kalau
       yang tampil order nyata, chartnya dalam mode nyata. */
    aksi?.gantiMode('real');
    setSunting(o);
    /* Garisnya dulu, panelnya belakangan. */
    setPanelUbah(false);
    setSuntingSlTeks(o.sl ? String(o.sl) : '');
    setSuntingTpTeks(o.tp ? String(o.tp) : '');
    setSuntingKabar('');
    /* Kripto punya tickSize resmi; MT5 dibulatkan EA sendiri lewat
       RapikanHarga(), jadi tidak perlu diambil di sini. */
    setTickAktif(0);
    if (o.pasar === 'kripto') void tickSimbol(o.simbol).then(setTickAktif).catch(() => {});
  }

  /* ── Menunggu bursa MENCATAT, bukan sekadar MENERIMA ──────────────
     Panel ini dulu bilang "terkirim" begitu Binance menjawab 200. Tapi
     daftar order bursa baru menampilkan level barunya beberapa detik
     kemudian, dan tabel Posisi Terbuka baru membacanya di putaran 30
     detik berikutnya. Di sela itu layar bilang berhasil sementara
     angkanya masih yang lama — dan itu terbaca sebagai "belum masuk",
     jadi perubahannya dikirim lagi. Dikirim lagi bukan hal sepele:
     tiap kiriman memasang stop BARU. Dari situlah stop menumpuk.

     Jadi sekarang panelnya menunggu sampai bursa sendiri yang bilang
     levelnya sudah berubah, baru berkata berhasil — dan pada detik yang
     sama tabelnya dipaksa membaca ulang, supaya keduanya berubah
     berbarengan. */
  async function tungguStopBursa(simbol: string, sl: number, tp: number): Promise<boolean> {
    /* Toleransi relatif: harga yang dikirim sudah dibulatkan ke tick,
       tapi bursa memulangkannya dengan jumlah desimal versinya sendiri
       (63215.90 vs 63215.9). Membandingkan persis akan selalu meleset. */
    const sama = (dibursa: number, diminta: number) =>
      !diminta || (dibursa > 0 && Math.abs(dibursa - diminta) <= Math.max(diminta * 1e-4, 1e-9));
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 900));
      const kini = await bacaStopBursa(simbol);
      if (kini && sama(kini.sl, sl) && sama(kini.tp, tp)) return true;
    }
    return false;
  }

  async function kirimSunting() {
    if (!sunting) return;
    /* Dibulatkan lagi tepat sebelum kirim: angka yang DIKETIK tangan
       tidak lewat jalur seretan, dan 63160.98886568123 yang ditempel
       dari mana pun akan ditolak bursa sama saja. */
    const acuanKirim = sunting.sl || sunting.tp || aksi?.hargaKini || sunting.entry || 0;
    const slBaru = suntingSl ? bulatkanHarga(suntingSl, acuanKirim) : 0;
    const tpBaru = suntingTp ? bulatkanHarga(suntingTp, acuanKirim) : 0;
    if (!slBaru && !tpBaru) { setSuntingKabar('Isi SL atau TP dulu.'); return; }
    /* Pagar arah: SL di sisi yang salah bukan proteksi, itu perintah
       menutup rugi seketika. Ditolak di sini, bukan di bursa — pesan
       bursa berbunyi "would immediately trigger" dan tidak menjelaskan
       apa pun bagi yang belum pernah melihatnya. */
    const acuan = sunting.entry;
    if (acuan > 0 && slBaru > 0) {
      const salah = sunting.arah === 'BUY' ? slBaru >= acuan : slBaru <= acuan;
      if (salah) { setSuntingKabar(`SL ${sunting.arah === 'BUY' ? 'harus di bawah' : 'harus di atas'} harga entry.`); return; }
    }
    if (acuan > 0 && tpBaru > 0) {
      const salah = sunting.arah === 'BUY' ? tpBaru <= acuan : tpBaru >= acuan;
      if (salah) { setSuntingKabar(`TP ${sunting.arah === 'BUY' ? 'harus di atas' : 'harus di bawah'} harga entry.`); return; }
    }

    setSuntingSibuk(true);
    setSuntingKabar('Mengirim perubahan…');
    try {
      if (sunting.pasar === 'mt5') {
        const { id } = await kirimPerintahMt5({
          aksi: 'UBAH',
          tiket: sunting.tiket,
          sl: slBaru || undefined,
          tp: tpBaru || undefined,
          /* Pending order MT5: harga pemicunya ikut dipertahankan apa
             adanya — yang sedang diubah cuma SL/TP. */
          entry: sunting.jenis === 'pending' ? sunting.entry : undefined,
        });
        const hasil = await tungguHasilMt5(id);
        /* Jawaban EA sudah jawaban broker sungguhan — yang telat cuma
           tabelnya, yang membaca status tiap 30 detik. Dipaksa membaca
           ulang supaya panel dan tabel berubah berbarengan. */
        if (hasil.status === 'sukses') segarkanAkunMt5();
        setSuntingKabar(hasil.status === 'sukses' ? `Berhasil — ${hasil.pesan}` : `Gagal: ${hasil.pesan}`);
      } else {
        /* Kripto: order lama DIBATALKAN lalu dipasang ulang di harga
           baru — itulah cara Binance mengubah conditional order, dan
           backend sudah mengurus pembatalannya. Id order lamanya
           diambil dari daftar order bursa supaya yang dibatalkan
           benar-benar milik simbol ini. */
        /* SEMUA stop lama, bukan yang pertama ditemukan. Posisi yang
           dibuka bertahap punya beberapa SL/TP (TP1, TP2, sisa layering),
           dan membatalkan satu saja meninggalkan sisanya hidup: stop
           menumpuk melebihi ukuran posisi, lalu yang tersisa menembak
           posisi BERIKUTNYA di pair yang sama. */
        const milik = orderBursa.filter((x) => x.simbol === sunting.simbol);
        const stopLama = milik.filter((x) => x.jenis === 'SL' || x.jenis === 'TP');
        const qty = sunting.ukuran || stopLama[0]?.qty || 0;
        if (!qty) throw new Error('Ukuran posisi tidak diketahui — muat ulang halaman lalu coba lagi.');

        /* URUTANNYA DISENGAJA: pasang yang baru DULU, baru batalkan yang
           lama. Sebentar kelebihan stop tidak berbahaya — yang pertama
           kena menutup posisinya. Sebaliknya, membatalkan dulu lalu gagal
           memasang meninggalkan posisi TANPA stop sama sekali, dan itu
           kegagalan yang membakar uang. */
        await ubahSlTpNyata({
          symbol: sunting.simbol,
          side: sunting.arah,
          sl: slBaru || undefined,
          slQuantity: slBaru ? qty : undefined,
          tp1: tpBaru || undefined,
          tp1Quantity: tpBaru ? qty : undefined,
        });

        const sisa: string[] = [];
        for (const o of stopLama) {
          try { await batalPendingNyata({ symbol: sunting.simbol, orderId: o.id, isAlgo: true }); }
          catch { sisa.push(`${o.jenis} ${o.pemicu}`); }
        }
        /* Sisa yang gagal dibatalkan DIKATAKAN, tidak ditelan. Stop yatim
           yang tertinggal akan menembak posisi berikutnya, dan pemiliknya
           harus tahu sekarang — bukan saat itu terjadi. */
        if (sisa.length) {
          /* Sisa yang gagal dibatalkan DIKATAKAN, tidak ditelan — dan
             tidak perlu menunggu konfirmasi, karena keadaannya sudah
             jelas keliru. */
          segarkanBursa();
          setSuntingKabar(`SL/TP baru terpasang, tapi ${sisa.length} order lama gagal dibatalkan (${sisa.join(', ')}). Batalkan manual di Binance.`);
        } else {
          setSuntingKabar('Terkirim — menunggu bursa mencatatnya…');
          const tercatat = await tungguStopBursa(sunting.simbol, slBaru, tpBaru);
          segarkanBursa();
          setSuntingKabar(tercatat
            ? 'Berhasil — bursa sudah mencatat SL/TP barunya.'
            : 'Sudah dikirim dan diterima bursa, tapi daftar ordernya belum berubah. JANGAN kirim ulang — tiap kiriman memasang stop baru. Tunggu sebentar lalu periksa Posisi Terbuka.');
        }
      }
    } catch (e) {
      setSuntingKabar(e instanceof Error ? e.message : 'Gagal mengirim perubahan');
    } finally { setSuntingSibuk(false); }
  }

  /* Batalkan pending / tutup posisi. Dipisah dari kirimSunting karena
     akibatnya tidak bisa dibatalkan: yang satu mengubah level, yang satu
     mengakhiri ordernya. Keduanya minta konfirmasi yang MENYEBUT apa
     yang akan hilang — "Yakin?" tidak memberi tahu apa-apa. */
  /* Letak panel ubah order. null = belum dipernah dipindah → duduk di
     kanan panel order lewat kelas CSS. Angka baru muncul setelah
     orangnya menyeretnya, dengan alasan yang sama seperti bilah alat:
     bawaan berangka mengunci letaknya ke satu ukuran layar. */
  const [letakUbah, setLetakUbah] = useState<{ x: number; y: number } | null>(() => {
    try {
      const d = JSON.parse(localStorage.getItem('jt.letakUbah') ?? 'null');
      if (d && typeof d.x === 'number' && typeof d.y === 'number') return d;
    } catch { /* privat */ }
    return null;
  });

  function mulaiSeretUbah(e: React.PointerEvent) {
    /* Isian dan tombol tidak boleh memicu seretan — kalau ikut, mengetik
       harga jadi mustahil tanpa menggeser panelnya. */
    if ((e.target as HTMLElement).closest('input, button, select, label')) return;
    e.preventDefault();
    const kotak = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const b0 = areaChart.current?.getBoundingClientRect();
    const awal = {
      x: e.clientX, y: e.clientY,
      /* Pangkalnya letak yang SEDANG DIPAKAI, bukan yang diminta: kalau
         panelnya barusan dijepit karena chart mengecil, menyeret dari
         koordinat lama membuatnya melompat dulu sebelum ikut kursor. */
      lx: letakPakai ? letakPakai.x : (b0 ? kotak.left - b0.left : 290),
      ly: letakPakai ? letakPakai.y : (b0 ? kotak.top - b0.top : 8),
    };
    const hitung = (ev: PointerEvent) => {
      const b = areaChart.current?.getBoundingClientRect();
      const x = awal.lx + (ev.clientX - awal.x);
      const y = awal.ly + (ev.clientY - awal.y);
      if (!b) return { x, y };
      /* Dijepit dengan UKURAN PANELNYA, bukan angka tetap. Batas lama
         (b.width-60, b.height-40) membolehkan panel diseret sampai cuma
         sesobek ujungnya yang tersisa di layar. */
      const maxY = Math.max(4, b.height - kotak.height - 4);
      const atasTampak = Math.min(maxY, Math.max(4, 64 - b.top));
      const bawahTampak = Math.min(maxY, window.innerHeight - b.top - kotak.height - 8);
      const yPas = Math.max(4, Math.min(maxY, y));
      return {
        x: Math.max(4, Math.min(Math.max(4, b.width - kotak.width - 4), x)),
        y: bawahTampak >= atasTampak ? Math.max(atasTampak, Math.min(bawahTampak, yPas)) : yPas,
      };
    };
    const gerak = (ev: PointerEvent) => setLetakUbah(hitung(ev));
    const lepas = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      try { localStorage.setItem('jt.letakUbah', JSON.stringify(hitung(ev))); } catch { /* privat */ }
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
  }

  /* P/L berjalan order yang sedang disunting — dibaca dari sumber yang
     sama dengan panelnya, bukan dihitung ulang di sini. Dua tempat yang
     menghitung P/L dengan rumus sendiri akan berselisih cepat atau
     lambat, dan yang satu pasti salah. */
  const pnlSunting = useMemo(() => {
    if (!sunting || sunting.jenis !== 'posisi') return null;
    if (sunting.pasar === 'mt5') {
      const p = akunMt5.posisi.find((x) => x.tiket === sunting.tiket);
      return p ? p.profit : null;
    }
    const p = posisiBursa.find((x) => x.simbol === sunting.simbol);
    return p ? p.pnl : null;
  }, [sunting, akunMt5.posisi, posisiBursa]);

  /* Menutup order yang DIPILIH DARI TABEL, tanpa harus masuk mode sunting
     dulu. Fitur tutupnya sebenarnya sudah ada sejak lama, tapi tersembunyi
     di balik dua langkah — klik baris, lalu klik garis di chart — dan
     pemilik sendiri menyimpulkan Trade-Fi "belum punya fitur tutup".
     Fitur yang ada tapi tidak ditemukan sama saja dengan tidak ada.

     Order-nya dibuka di chart lebih dulu supaya orangnya MELIHAT apa yang
     akan ditutup — konfirmasi berisi nama dan P/L tetap muncul sesudahnya. */
  function tutupDariTabel(o: OrderSunting) {
    bukaSunting(o);
    /* Satu putaran render supaya `sunting` sudah terisi saat akhiriOrder
       membacanya. Tanpa jeda ini ia membaca state lama dan menutup order
       yang salah — atau tidak menutup apa pun. */
    setTimeout(() => { void akhiriOrder(o); }, 0);
  }

  /* ── Menunggu bursa BENAR-BENAR melepas order ────────────────────────
     Dulu garis Entry/SL/TP hilang begitu permintaan hapus dijawab 200.
     Itu terlalu dini: 200 berarti "Binance menerima perintahnya", bukan
     "ordernya sudah lepas". Selama beberapa detik sesudahnya order masih
     terdaftar di bursa sementara layar sudah bersih — dan layar yang
     lebih maju daripada kenyataan adalah bentuk kebohongan yang paling
     sulit disadari, karena ia terlihat seperti keberhasilan.

     Sekarang garisnya BERTAHAN sampai order itu benar-benar tidak ada
     lagi di daftar bursa, dengan label "menghapus…" supaya jelas ia
     sedang dalam perjalanan, bukan masih hidup normal. */
  const [hapusMenunggu, setHapusMenunggu] = useState<
    { id: string; sejak: number } | null>(null);
  const menungguHapus = useRef(false);

  useEffect(() => {
    if (!hapusMenunggu) return;
    /* Hilang dari daftar bursa = tuntas. Inilah satu-satunya bukti yang
       benar-benar berarti; sisanya cuma janji. */
    if (!orderBursa.some((o) => o.id === hapusMenunggu.id)) {
      setSuntingKabar('Order sudah lepas dari bursa.');
      setSunting(null);
      setHapusMenunggu(null);
      menungguHapus.current = false;
      setSuntingSibuk(false);
      return;
    }
    /* Batas 12 detik. Lewat itu kita TIDAK tahu, dan mengaku tidak tahu
       lebih berguna daripada menghapus garisnya sambil berharap. */
    if (Date.now() - hapusMenunggu.sejak > 12_000) {
      setSuntingKabar('Perintah hapus diterima, tapi bursa masih menampilkan ordernya. Periksa langsung di Binance sebelum mengirim ulang.');
      setHapusMenunggu(null);
      menungguHapus.current = false;
      setSuntingSibuk(false);
      return;
    }
    const t = setTimeout(() => segarkanBursa(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hapusMenunggu, orderBursa]);

  async function akhiriOrder(dipilih?: OrderSunting) {
    const sunting = dipilih ?? suntingAktif.current;
    if (!sunting) return;
    const nama = `${sunting.simbol} ${sunting.arah}`;
    const pesan = sunting.jenis === 'pending'
      ? `Batalkan pending order ${nama}?

Order ini belum jadi posisi — tidak ada rugi/untung yang terkunci.`
      : `Tutup posisi ${nama} sekarang di harga pasar?

${pnlSunting !== null ? `P/L berjalan: ${uang(pnlSunting, true)} — angka ini akan TERKUNCI begitu ditutup.` : 'P/L berjalan tidak diketahui.'}`;
    if (!confirm(pesan)) return;

    setSuntingSibuk(true);
    setSuntingKabar(sunting.jenis === 'pending' ? 'Membatalkan order…' : 'Menutup posisi…');
    try {
      if (sunting.pasar === 'mt5') {
        const { id } = await kirimPerintahMt5({ aksi: 'TUTUP', tiket: sunting.tiket });
        const hasil = await tungguHasilMt5(id);
        setSuntingKabar(hasil.status === 'sukses' ? `Selesai — ${hasil.pesan}` : `Gagal: ${hasil.pesan}`);
        if (hasil.status === 'sukses') { segarkanAkunMt5(); setSunting(null); }
      } else if (sunting.jenis === 'pending') {
        /* PENANDA DAFTAR IKUT DIKIRIM, tidak lagi ditebak.
           ────────────────────────────────────────────────────────────────
           Binance menyimpan order di dua daftar terpisah dengan endpoint
           hapus masing-masing: LIMIT di /fapi/v1/order, STOP/TP/SL di
           /fapi/v1/algoOrder. Sebelumnya baris ini tidak mengirim `isAlgo`
           sama sekali, dan nilai bawaannya TRUE — jadi setiap pending
           LIMIT dikirim ke endpoint algo dan dijawab -2011 "Unknown order
           sent.", ordernya tetap hidup di bursa.

           Bendera aslinya sudah dilaporkan /api/open-orders sebagai
           `algo`; tinggal dipakai. Bawaannya kini FALSE, bukan true:
           pending entry yang lazim adalah LIMIT. */
        const asli = orderBursa.find((x) => x.id === (sunting.tiket ?? ''));
        await batalPendingNyata({
          symbol: sunting.simbol,
          orderId: sunting.tiket ?? '',
          isAlgo: asli?.algo ?? false,
        });
        /* Garis SENGAJA tidak dihapus di sini. Yang baru terjadi cuma
           "Binance menerima perintahnya"; pembuktiannya menunggu order itu
           hilang dari daftar bursa, dan efek di atas yang mengurusnya. */
        setSuntingKabar('Perintah hapus diterima — menunggu bursa melepas ordernya…');
        menungguHapus.current = true;
        setHapusMenunggu({ id: sunting.tiket ?? '', sejak: Date.now() });
        segarkanBursa();
      } else {
        const milik = orderBursa.filter((x) => x.simbol === sunting.simbol);
        await tutupPosisiNyata({
          symbol: sunting.simbol, side: sunting.arah, quantity: sunting.ukuran,
        });
        /* SEMUA stop dibersihkan setelah posisinya tertutup. Stop yatim
           yang tertinggal tidak melakukan apa-apa hari ini — lalu menembak
           posisi berikutnya di pair yang sama, entah kapan. */
        const sisaTutup: string[] = [];
        for (const o of milik.filter((x) => x.jenis === 'SL' || x.jenis === 'TP')) {
          try { await batalPendingNyata({ symbol: sunting.simbol, orderId: o.id, isAlgo: true }); }
          catch { sisaTutup.push(`${o.jenis} ${o.pemicu}`); }
        }
        setSuntingKabar(sisaTutup.length
          ? `Posisi ditutup, tapi ${sisaTutup.length} stop lama gagal dibatalkan (${sisaTutup.join(', ')}). Batalkan manual di Binance.`
          : 'Posisi ditutup dan semua stop-nya dibersihkan.');
        segarkanBursa();
        setSunting(null);
      }
    } catch (e) {
      menungguHapus.current = false;
      setHapusMenunggu(null);
      setSuntingKabar(e instanceof Error ? e.message : 'Gagal mengakhiri order');
    } finally {
      /* Tetap SIBUK selama masih menunggu bursa: tombolnya belum boleh
         bisa ditekan lagi, dan orangnya belum boleh mengira semuanya
         selesai. Yang mematikannya efek penunggu di atas. */
      if (!menungguHapus.current) setSuntingSibuk(false);
    }
  }

  const [kendaliReplay, setKendaliReplay] = useState<React.ReactNode>(null);
  /* Arah tiket yang sedang disusun. null = belum ada tiket, chart cuma
     menggambar rencana dari kartu screener kalau ada. */
  const [draf, setDraf] = useState<'BUY' | 'SELL' | null>(null);

  /* ── Kirim rencana ke Copy Signal ─────────────────────────────────────
     Halaman ini yang punya alat gambar, watchlist, indikator, dan data
     MT5 — jadi di sinilah analisa disusun, bukan di chart mini yang
     ditempel ke formulir. Yang dikirim: pasangan, timeframe, arah, ketiga
     level, DAN tangkapan layar chartnya sebagai sampul.

     Sampulnya berharga justru karena memuat gambar analisanya — fibonacci,
     kotak SNR, garis tren. Chart polos berisi tiga garis tidak memberi
     tahu apa pun kepada calon pembeli. */
  const ambilFoto = useRef<null | (() => string | null)>(null);
  const [kabarKirimSinyal, setKabarKirimSinyal] = useState('');

  /* Level di layar ini datang dari analisa Copy Signal, bukan disusun
     sendiri. Dipakai menyalakan penanda COPY di tiket order — tampilannya
     identik (tiga garis, panel yang sama), dan rencana orang lain tidak
     boleh dikirim ke bursa karena dikira rencana sendiri.

     DIMATIKAN begitu orangnya menekan BUY/SELL sendiri — TAPI HANYA untuk
     COPY yang datang dari level orang lain. Lihat `copyManual` di bawah. */
  const [dariSinyal, setDariSinyal] = useState(() => cari.get('untuk') === 'sinyal');
  /** COPY yang datang dari NIAT orangnya, bukan dari level orang lain.
   *
   *  Dua jalan masuk yang tampak sama tapi berbeda maknanya:
   *
   *    · `?arah=&entry=&sl=&tp=` — level dari analisa orang lain. Begitu
   *      orangnya memilih arah sendiri, penandanya harus mati; kalau tidak
   *      ia berbohong soal asal rencananya.
   *    · `?untuk=sinyal` — datang dari tombol "Susun di Chart & Entry" di
   *      formulir Copy Signal. Ia MEMANG sedang menyusun sinyal, dan itu
   *      niat, bukan warisan. Menekan BUY adalah langkah PERTAMA dari niat
   *      itu, bukan pembatalannya.
   *
   *  Sempat disamakan, dan akibatnya mode COPY jatuh ke DEMO pada klik BUY
   *  pertama — persis di alur yang paling membutuhkannya. Tombol "Ke Copy
   *  Signal" pun ikut hilang bersamanya, karena ia hanya tampil di mode
   *  COPY: orangnya datang untuk menyusun sinyal lalu kehilangan satu-
   *  satunya tombol yang mengirimkannya. */
  const copyManual = useRef(cari.get('untuk') === 'sinyal');
  /* Alamat bisa berubah tanpa halaman dimuat ulang (klik dari kartu lain),
     jadi penandanya ikut dibaca lagi. */
  useEffect(() => {
    if (cari.get('untuk') !== 'sinyal') return;
    setDariSinyal(true);
    copyManual.current = true;
  }, [cari]);

  function kirimKeCopySignal() {
    if (!draf) { setKabarKirimSinyal('Pilih arah BUY atau SELL dulu di panel order.'); return; }
    const { entry, sl, tp } = rencana;
    if (!entry || !sl || !tp) { setKabarKirimSinyal('Entry, SL, dan TP harus terisi ketiganya.'); return; }

    const sampul = ambilFoto.current?.() ?? '';
    const ok = simpanDraf({
      pasangan: simbol, tf, arah: draf,
      entry, sl, tp, sampul,
      /* Qty beku ikut dikirim — inilah yang membuat "Risk SL" di formulir
         menampilkan angka yang sama dengan tiket ini, bukan −$10 mati. */
      qty: qtyDemo.current > 0 ? qtyDemo.current : undefined,
    });
    if (!ok) { setKabarKirimSinyal('Gagal menyiapkan draf — coba lagi.'); return; }
    /* Alamat TANPA level: level sudah ikut di draf, dan menaruhnya juga di
       query akan membuat dua sumber kebenaran yang bisa berselisih.

       TAPI TABNYA WAJIB DISEBUT. Dulu tujuannya '/copy-signal' polos, dan
       halaman itu membuka tab bawaannya — Daftar Signal. Formulir posting
       memang ikut terpasang (ia cuma disembunyikan), jadi drafnya tetap
       terbaca dan kolomnya tetap terisi — tapi orangnya mendarat di layar
       yang salah dan melihat daftar sinyal orang lain.

       Terbaca persis seperti gagal: tombol ditekan, chart berpindah
       halaman, tiket beserta garisnya hilang, dan yang muncul bukan
       formulir yang barusan ia tuju. Padahal tidak ada yang hilang — cuma
       tidak ada yang menunjukkannya.

       Ini juga sebabnya bug ini bertahan lama: tidak ada galat, tidak ada
       data yang rusak, dan yang salah cuma satu kata yang tidak ditulis. */
    /* Di dalam panel multi-chart / jendela chart lepasan, halaman ini
       TIDAK berpindah — drafnya sudah tersimpan (localStorage, dibagi
       semua jendela se-origin), jadi cukup menyuruh jendela tools membuka
       formulirnya. Panel kecil yang tiba-tiba berisi halaman Copy Signal
       bukan yang dimaksud siapa pun, dan chartnya sendiri tetap utuh. */
    if (POLOS) {
      kirimBus({ jenis: 'navigasi', ke: '/copy-signal?sub=posting' });
      setKabarKirimSinyal('Draf terkirim — formulir posting terbuka di jendela tools.');
      return;
    }
    navigasi('/copy-signal?sub=posting');
  }
  /* Setelan order sungguhan — hidup di halaman supaya label risiko di
     garis chart dihitung dari angka yang SAMA dengan yang akan dikirim. */
  const [nyataSetelan, setNyataSetelan] = useState<{ modal: number; leverage: number; metode: MetodeTp }>(
    { modal: 100, leverage: 4, metode: 'partial' });
  /* Setelan latihan — dulu di panel bawah yang baru muncul saat replay;
     order demo tidak bergantung replay, jadi setelannya ikut tiket. */
  const [demoSetelan, setDemoSetelan] = useState({ modal: 1000, risikoPersen: 1, kaliAtr: 1.5, rr: 2 });
  /* Emosi & alasan diisi SEBELUM kirim — masuk jurnal (demo) dan record
     posisi screener (real). Jurnal tanpa alasan cuma daftar angka. */
  const [catatanTiket, setCatatanTiket] = useState({ emosi: 'Netral', alasan: '' });
  /* Lot untuk order REAL simbol MT5 — bursa berjalan pakai qty dari modal ×
     leverage; MT5 berpikir dalam lot, jadi kolomnya memang beda. */
  const [lotMt5, setLotMt5] = useState(0.01);
  /* Simbol MT5 yang tersedia — EA yang dipasang di chart pair lain otomatis
     menambah daftar ini, tanpa menyentuh kode web. */
  const [simbolMt5, setSimbolMt5] = useState<string[]>(['XAUUSD']);
  useEffect(() => {
    let hidup = true;
    const tarik = () => void daftarSimbolMt5().then((d) => { if (hidup && d.length) setSimbolMt5(d); });
    tarik();
    /* Disegarkan berkala, bukan sekali: EA yang BARU dipasang di chart MT5
       lain mendaftarkan simbolnya sendiri ke server — tanpa penyegaran,
       daftar pilihan di sini beku sejak halaman dibuka dan simbol barunya
       "tidak ada" sampai orangnya memuat ulang. */
    const jam = setInterval(tarik, 30_000);
    return () => { hidup = false; clearInterval(jam); };
  }, []);
  /* Posisi MT5 yang sedang terbuka di simbol chart ini — sumber garis
     entry/SL/TP mode REAL. Garisnya milik BROKER: tetap ada selama
     posisinya hidup (dibuka dari web ataupun MT5), hilang sendiri saat
     SL/TP kena atau ditutup dari mana pun. */
  const nilaiLotMt5 = simbol.startsWith('MT5:') ? (bacaSpekMt5(simbol.slice(4)) ?? 100) : 0;
  /* ── Posisi MT5 di chart — ala garis posisi MetaTrader ──────────────
     Setiap posisi terbuka di simbol ini digambar ChartLilin sebagai price
     line entry/SL/TP yang menembus ke sumbu harga. Bukan pengganti garis
     tiket: rencana entry/SL/TP tetap bebas dipakai untuk LAYERING —
     menyusun posisi berikutnya selagi yang lama berjalan. Garisnya hilang
     sendiri saat posisinya tutup, dari SL/TP maupun tangan.

     Identitasnya distabilkan lewat KUNCI JSON, bukan useMemo biasa:
     laporan EA tiap beberapa detik membawa array posisi BARU dengan isi
     yang sama, dan tanpa kunci ini ChartLilin membongkar-pasang semua
     price line-nya tiap laporan — itulah "chart terasa berat". PnL
     sengaja TIDAK ikut (dan tidak ditampilkan): angka yang berdetak
     terus adalah pemicu gambar-ulang yang tak pernah berhenti. */
  const kunciPosisiMt5 = useMemo(() => {
    /* ── MODE LATIHAN TIDAK MENAMPILKAN POSISI NYATA ───────────────────
       Aturan yang sama sudah lama berlaku untuk garis ORDER menggantung
       (lihat garisOrder di bawah), tapi tidak pernah ikut dipasang di
       sini — jadi garis entry/SL/TP dari posisi MT5 yang benar-benar
       hidup tetap tergambar saat orangnya berpindah ke demo atau copy.

       Ini bukan sekadar tidak relevan, ia menyesatkan ke dua arah: yang
       sedang berlatih mengira SL itu bagian dari latihannya, atau yang
       punya posisi nyata mengira posisinya terlindungi padahal yang
       dilihat cuma sisa gambar dari mode sebelumnya. Uang sungguhan
       tidak boleh digambar di layar latihan.

       Kembali ke real, garisnya muncul lagi apa adanya — tidak ada yang
       dihapus, cuma tidak digambar. */
    if (aksi?.mode !== 'real') return '[]';
    if (!simbol.startsWith('MT5:')) return '[]';
    const dasarS = simbol.slice(4);
    return JSON.stringify(akunMt5.posisi
      .filter((p) => p.simbol.toUpperCase().indexOf(dasarS) === 0)
      .map((p) => ({ tiket: p.tiket, arah: p.arah, lot: p.lot, entry: p.hargaBuka, sl: p.sl, tp: p.tp })));
  }, [simbol, akunMt5.posisi, aksi?.mode]);
  const posisiMt5Chart = useMemo(() => JSON.parse(kunciPosisiMt5) as PosisiChartMt5[], [kunciPosisiMt5]);
  /* Tick bid/ask menumpang balasan klines MT5 yang memang sudah dipoll —
     dibaca ulang tiap render, dan render datang tiap data lilin segar. */
  const tickMt5 = simbol.startsWith('MT5:') ? bacaTickMt5(simbol.slice(4)) : null;

  /* ── Berapa desimal yang dipakai simbol ini ────────────────────────
     Panel tiket dulu menulis SL/TP dengan toFixed(6) untuk SEMUA simbol,
     dan hasilnya "4345.504523" di XAUUSD — angka yang tidak mungkin
     dikirim ke broker mana pun. Bukan sekadar jelek dibaca: SL/TP yang
     lebih presisi daripada simbolnya ditolak broker, dan stop yang
     ditolak adalah stop yang dikira terpasang padahal tidak ada.

     EA TIDAK melaporkan `digits`, jadi angkanya disimpulkan dari tick
     bid/ask yang memang datang dengan presisi asli broker (4334.488 =
     3 desimal). Diambil yang TERBANYAK dari bid dan ask: harga yang
     kebetulan bulat (4334.5) akan menyesatkan kalau dipakai sendirian.

     Untuk kripto, tick bursa sudah ditangani `bulatkanHarga`; di sini
     cukup jatuh ke presisi harga terakhir. */
  function desimalDari(...angka: (number | undefined)[]): number {
    let maks = 0;
    for (const n of angka) {
      if (!n || !isFinite(n)) continue;
      const t = String(n);
      const titik = t.indexOf('.');
      if (titik >= 0) maks = Math.max(maks, Math.min(8, t.length - titik - 1));
    }
    return maks;
  }
  const desimalHarga = simbol.startsWith('MT5:')
    ? desimalDari(tickMt5?.bid, tickMt5?.ask) || 2
    : desimalDari(lilin.closes[lilin.closes.length - 1]) || 2;
  /* Garis Ask HANYA di mode real. Di mode latihan tidak ada spread yang
     dibayar siapa pun, jadi garis kedua di dekat harga cuma menambah satu
     garis lagi yang harus diabaikan mata. */
  const askTampil = aksi?.mode === 'real' ? (tickMt5?.ask || undefined) : undefined;
  /* Seretan SL/TP posisi baru BERANGKAT saat tombol Kirim di chart
     ditekan — ChartLilin yang memegang pratinjau dan tombolnya, jalur
     kirimnya sama dengan order BUKA: antrean perintah → EA → laporan. */
  const ubahPosisiMt5 = useCallback(async (tiket: string, sl: number, tp: number): Promise<boolean> => {
    try {
      setKabarNyata(`Mengirim SL/TP baru #${tiket} ke EA…`);
      const { id } = await kirimPerintahMt5({ aksi: 'UBAH', tiket, sl, tp });
      const h = await tungguHasilMt5(id);
      const sukses = h.status === 'sukses';
      setKabarNyata(sukses ? `SL/TP #${tiket} terpasang di MT5 — ${h.pesan}` : `Ubahan #${tiket}: ${h.pesan}`);
      return sukses;
    } catch (e) {
      setKabarNyata(e instanceof Error ? e.message : 'Gagal mengirim ubahan SL/TP');
      return false;
    }
  }, []);

  /* Mengubah SL ×ATR / R:R saat tiket TERBUKA langsung menggeser garisnya —
     setelan yang baru berlaku untuk tiket berikutnya terasa seperti setelan
     yang rusak. Level hasil seretan tangan tidak disentuh: begitu orangnya
     menggeser sendiri, usulannya berhenti ikut campur. */
  const seretTangan = useRef(false);
  /* ── Qty demo DIJANGKARKAN, bukan dihitung ulang tiap seretan ────────
     Model lama: risiko dolar = modal × %risiko, titik — angkanya membeku
     di -$10 walau garis SL ditarik dua kali lebih jauh, karena ukuran
     posisinya diam-diam menyusut mengimbangi. Model sekarang meniru
     position tool TradingView: qty dibekukan saat tiket dibuka (risiko ÷
     jarak SL saat itu), dan MENGGESER garis mengubah dolarnya — SL menjauh
     berarti risiko membesar. Mengubah modal/%risiko/SL×ATR menjangkarkan
     ulang; menyeret garis tidak. */
  const qtyDemo = useRef(0);
  /* KEMBARAN STATE, bukan cuma ref.
     ──────────────────────────────────────────────────────────────────────
     Ref dibaca saat render tapi menulisnya TIDAK memicu render. Jadi
     jangkar yang dipasang di dalam efek baru terlihat pada render
     BERIKUTNYA — dan sampai saat itu tiketnya menampilkan angka dari jalur
     cadangan, yaitu −$10 mati. Yang dipakai menggambar sekarang state ini;
     ref-nya tetap ada untuk dibaca di dalam callback (kirim order, draf
     sinyal) tanpa ikut jadi dependency. */
  const [qtyTampil, setQtyTampil] = useState(0);
  const jangkarQty = useCallback((e?: number, s?: number, risikoD?: number) => {
    if (!e || !s || e === s || !risikoD) return;
    const q = risikoD / Math.abs(e - s);
    qtyDemo.current = q;
    setQtyTampil((lama) => (Math.abs(lama - q) > 1e-9 ? q : lama));
  }, []);
  /* Jangkar ULANG: tiket baru dibuka, atau modal/%risiko diubah. */
  useEffect(() => {
    if (!draf || !aksi || aksi.mode !== 'demo') return;
    jangkarQty(rencana.entry ?? aksi.hargaKini, rencana.sl, aksi.risiko);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draf, demoSetelan.modal, demoSetelan.risikoPersen]);
  /* ── Jangkar SUSULAN — ini yang selama ini hilang ────────────────────
     Efek di atas berhenti kalau `aksi` belum ada, dan `aksi` datang dari
     PanelReplay SESUDAH lilinnya termuat. Untuk tiket yang DIPULIHKAN dari
     sessionStorage, `draf` sudah terisi jauh sebelum itu — efeknya jalan
     sekali, menemui `aksi` null, lalu tidak pernah dipanggil lagi karena
     `draf` tidak berubah lagi.

     Akibatnya qty tinggal nol, tampilan jatuh ke jalur cadangan
     `risiko / jarak`, dan hasil kalinya SELALU tepat −$10 berapa pun garis
     SL digeser. Persis keluhan "angkanya tidak berubah": bukan jangkarnya
     yang salah hitung, melainkan tidak pernah ada jangkar sama sekali.

     Efek ini memasangnya begitu bahannya lengkap, dan berhenti ikut campur
     setelah terpasang — supaya menyeret garis tetap mengubah dolarnya,
     bukan menjangkarkan ulang.

     Dependency-nya `aksi`, BUKAN `rencana` — `rencana` dideklarasikan lebih
     bawah di berkas ini, dan menyebutnya di daftar dependency (yang
     dievaluasi saat render, bukan saat efek jalan) adalah galat TDZ. Untuk
     tiket pulihan itu tidak jadi soal: `rencana` sudah terisi bersamaan
     dengan `draf`, jauh sebelum `aksi` muncul. */
  useEffect(() => {
    if (qtyDemo.current > 0) return;
    if (!draf || !aksi || aksi.mode !== 'demo') return;
    jangkarQty(rencana.entry ?? aksi.hargaKini, rencana.sl, aksi.risiko);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draf, aksi]);
  /* ── SL ×ATR dan R : R MENGGESER GARISNYA SUNGGUHAN ──────────────────
     Dua kolom itu sebelumnya tidak melakukan apa-apa. Tiga sebab, dan
     ketiganya harus diperbaiki bersama:

     1. Efeknya berhenti kalau `seretTangan.current` — sekali seseorang
        menggeser garis, kedua kolom itu mati untuk selamanya di tiket itu.
        Tapi MENGUBAH ANGKANYA ADALAH PERMINTAAN EKSPLISIT; ia bukan usulan
        otomatis yang perlu tahu diri. Yang tetap tahu diri cuma usulan saat
        tiket baru dibuka.

     2. `aksi.usul()` memulangkan level yang SUDAH ada kalau sisinya masih
        benar (lihat `sahUsul` di panel-replay). Jadi efeknya memang jalan,
        lalu menyetel rencana ke angka yang sama persis. Tidak ada yang
        bergerak, tidak ada galat.

     3. `usulSlTp()` berjangkar pada HARGA PENUTUPAN TERAKHIR, bukan pada
        entry tiketnya. Untuk Buy Limit di 62.883 sementara harga 63.156,
        SL dan TP-nya dihitung dari 63.156 — R:R yang tampil lalu tidak
        cocok dengan jarak garis yang benar-benar terlihat di chart.

     Sekarang keduanya dihitung dari ENTRY TIKET, dan masing-masing hanya
     menyentuh yang jadi urusannya:
       · SL ×ATR  -> SL dipasang ulang dari ATR, TP menyusul memakai R:R.
       · R : R    -> SL DIBIARKAN (termasuk hasil seretan tangan), hanya TP
                     yang bergerak. Orang yang menaruh SL-nya di bawah swing
                     low tertentu tidak sedang meminta SL-nya dipindah. */
  const setelanTerpakai = useRef({ kaliAtr: demoSetelan.kaliAtr, rr: demoSetelan.rr });
  useEffect(() => {
    const lama = setelanTerpakai.current;
    const atrBerubah = lama.kaliAtr !== demoSetelan.kaliAtr;
    setelanTerpakai.current = { kaliAtr: demoSetelan.kaliAtr, rr: demoSetelan.rr };
    if (!draf || !aksi || aksi.mode !== 'demo') return;

    const entry = rencana.entry ?? aksi.hargaKini;
    if (!entry) return;
    const arahBuy = draf === 'BUY';

    let sl = rencana.sl;
    if (atrBerubah || !sl) {
      const idx = replayIdx ?? lilinGabung.closes.length - 1;
      const a = atr(lilinGabung.highs, lilinGabung.lows, lilinGabung.closes, 14)[idx];
      if (!Number.isFinite(a) || a <= 0) return;
      sl = arahBuy ? entry - a * demoSetelan.kaliAtr : entry + a * demoSetelan.kaliAtr;
    }
    const jarak = Math.abs(entry - sl);
    if (!jarak) return;
    const tp = arahBuy ? entry + jarak * demoSetelan.rr : entry - jarak * demoSetelan.rr;

    setRencana((r) => ({ ...r, sl, tp }));
    jangkarQty(entry, sl, aksi.risiko);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoSetelan.kaliAtr, demoSetelan.rr]);
  const [sibukNyata, setSibukNyata] = useState(false);
  const [kabarNyata, setKabarNyata] = useState('');
  const mulaiReplay = useRef<(() => void) | null>(null);
  /* Stabil dengan sengaja: fungsi baru tiap render akan memicu ulang efek
     yang memasangnya di panel replay, dan efek itu memanggil setState. */
  const simpanMulai = useCallback((f: (() => void) | null) => { mulaiReplay.current = f; }, []);

  /* SL & TP dari kartu screener, dibaca dari alamat. Dipakai sekali sebagai
     usulan saat membuka posisi replay — bukan dipaksakan, karena arah yang
     dipilih orangnya bisa berbeda dengan arah kartunya. */
  /* ── LEVEL RENCANA ──────────────────────────────────────────────────
     Entry, SL, dan TP yang tergambar di chart dan BISA DIGESER. Isinya bisa
     datang dari tiga tempat: kartu screener lewat alamat, posisi replay yang
     sedang terbuka, atau seretan orangnya sendiri.

     Angka terakhir setelah digeser itulah yang dipakai saat order dikirim —
     jadi menggeser garis di chart adalah cara mengubah level, bukan sekadar
     hiasan yang terpisah dari kotak isian. */
  const [rencana, setRencana] = useState<{ entry?: number; sl?: number; tp?: number }>({});

  /* ── Level yang datang dari halaman Copy Signal ───────────────────────
     `#/chart?simbol=BTCUSDT&tf=4h&arah=SELL&entry=63707&sl=64080&tp=62484`
     membuka tiket yang SUDAH terisi, dengan ketiga garisnya tergambar.

     Sebelum ini tautan "Buka di Chart" mengirim sl/tp/arah — dan halaman ini
     membuang semuanya, cuma membaca `simbol`. Jadi orang yang baru membayar
     sebuah analisa mendarat di chart kosong dan harus MENGETIK ULANG level
     yang barusan ia beli, dari ingatan. Setiap salah ketik di situ adalah
     stop loss yang meleset pada uang sungguhan.

     Dipasang SEKALI per kombinasi level, bukan tiap render: sesudah tiba di
     sini garisnya milik orangnya: ia boleh menggeser SL-nya, dan efek yang
     berjalan ulang akan menyeretnya balik ke angka analisa sambil ia
     memegang mouse. `kunci` berubah hanya kalau alamatnya benar-benar
     menunjuk analisa lain. */
  /* ── GARIS ORDER MILIK SATU SIMBOL SAJA ──────────────────────────────
     Dilaporkan pemilik: di chart BTCUSD muncul tiga label harga merah,
     putih, dan hijau di sekitar 4.400-4.500 — sisa Entry/SL/TP sinyal
     XAUUSD yang terbawa dari alamat, menempel di kaki sumbu karena
     angkanya tidak ada hubungannya dengan skala BTC di 72.000.

     Bukan sekadar jelek: garis order yang tertinggal di simbol lain adalah
     rencana yang tampak masih berlaku padahal tidak, dan panel tiketnya
     ikut hidup — satu tekan Kirim di situ mengirim ukuran yang dihitung
     dari level pasar yang berbeda sama sekali.

     Level itu milik SIMBOLNYA. Begitu simbolnya berganti, tiketnya dibuang
     seutuhnya — sama persis dengan yang dikerjakan tombol Batal.

     DIBANDINGKAN DENGAN REF, bukan dijalankan tiap render: pada render
     pertama simbolnya belum berganti dari apa pun, jadi rencana yang
     memang datang dari alamat ("Buka di Chart") tidak ikut terhapus.

     DITARUH DI ATAS efek pemasang level dari alamat. Waktu seseorang
     berpindah dari satu analisa ke analisa lain, kedua efek menyala pada
     render yang sama — dan React menjalankannya berurutan, jadi yang di
     atas membersihkan lebih dulu dan yang di bawah mengisinya kembali.
     Dibalik, yang tayang justru chart kosong. */
  const simbolTiket = useRef(simbol);
  useEffect(() => {
    if (simbolTiket.current === simbol) return;
    simbolTiket.current = simbol;

    /* SATU PENGECUALIAN, dan tanpanya perbaikan ini merusak "Buka di Chart".
       ──────────────────────────────────────────────────────────────────
       Urutan efek tidak cukup menyelamatkannya. Saat alamat berubah ke
       analisa bersimbol lain, efek penyelaras alamat memanggil setSimbol —
       dan simbol barunya baru tiba di RENDER BERIKUTNYA. Pada render yang
       sama, level dari alamat sudah dipasang; di render berikutnya efek ini
       melihat simbolnya berganti lalu menghapus level yang baru saja
       terpasang. Yang tayang: chart benar, garis hilang.

       Jadi kalau alamat yang sedang berlaku memang menunjuk simbol ini DAN
       membawa levelnya, tiketnya dibiarkan — level itu memang miliknya. */
    const simbolAlamat = rapikanSimbol(cari.get('simbol') || '');
    const bawaLevel = !!(cari.get('entry') || cari.get('sl') || cari.get('tp'));
    if (simbolAlamat === simbol && bawaLevel) return;

    setDraf(null); setRencana({}); setDariSinyal(false);
    setKabarNyata('');
    setCatatanTiket({ emosi: 'Netral', alasan: '' });
    entryDigeser.current = false;
    seretTangan.current = false;
    qtyDemo.current = 0; setQtyTampil(0);
  }, [simbol, cari]);

  const kunciAnalisa = `${cari.get('arah') || ''}|${cari.get('entry') || ''}|${cari.get('sl') || ''}|${cari.get('tp') || ''}`;
  const analisaTerpasang = useRef('');
  useEffect(() => {
    const arah = (cari.get('arah') || '').toUpperCase();
    if (arah !== 'BUY' && arah !== 'SELL') return;
    if (analisaTerpasang.current === kunciAnalisa) return;
    analisaTerpasang.current = kunciAnalisa;

    const angka = (k: string) => {
      const n = Number(cari.get(k));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    setDraf(arah);
    setRencana({ entry: angka('entry'), sl: angka('sl'), tp: angka('tp') });
    setDariSinyal(true);
    /* Mode TIDAK diubah otomatis. Membuka analisa orang lain tidak boleh
       diam-diam memindahkan seseorang ke mode order sungguhan — yang
       memutuskan uang sungguhan dipertaruhkan adalah orangnya, bukan
       sebuah tautan. */
  }, [cari, kunciAnalisa]);

  /* ── Tiket yang SELAMAT dari pindah halaman ──────────────────────────
     Pindah ke Journal lalu kembali ke sini dulu menghapus segalanya:
     panel BUY/SELL tertutup, entry/SL/TP yang sudah disusun hilang, lot
     dan catatan emosinya ikut. Padahal rencana trade adalah pekerjaan —
     kadang sepuluh menit menggeser garis — dan React membuang seluruhnya
     hanya karena komponennya dilepas.

     Disimpan di sessionStorage, bukan localStorage: rencana yang belum
     dikirim TIDAK boleh bangkit lagi besok pagi seolah masih berlaku.
     Ia hidup selama tab ini hidup, dan hilang saat orangnya menyegarkan
     halaman sendiri — persis yang diminta. */
  const KUNCI_TIKET = 'jt.tiketChart';
  const tiketDipulihkan = useRef(false);
  useEffect(() => {
    if (tiketDipulihkan.current) return;
    tiketDipulihkan.current = true;
    try {
      const t = JSON.parse(sessionStorage.getItem(KUNCI_TIKET) ?? 'null');
      if (!t || t.simbol !== simbol) return;
      if (t.rencana && (t.rencana.entry || t.rencana.sl || t.rencana.tp)) {
        setRencana(t.rencana);
        entryDigeser.current = true;   // level pulihan adalah keputusan, bukan tebakan
      }
      if (t.draf === 'BUY' || t.draf === 'SELL') setDraf(t.draf);
      if (t.catatan) setCatatanTiket(t.catatan);
      if (Number(t.lotMt5) > 0) setLotMt5(Number(t.lotMt5));
    } catch { /* rusak → mulai bersih */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    /* Hanya menyimpan kalau memang ADA yang disusun. Menulis objek kosong
       tiap render membuat penyegaran halaman memulihkan "tidak ada apa-apa"
       dan menimpa tiket yang masih hidup di tab lain. */
    const adaIsi = !!draf || !!(rencana.entry || rencana.sl || rencana.tp);
    try {
      if (adaIsi) {
        sessionStorage.setItem(KUNCI_TIKET, JSON.stringify({
          simbol, draf, rencana, catatan: catatanTiket, lotMt5,
        }));
      } else {
        sessionStorage.removeItem(KUNCI_TIKET);
      }
    } catch { /* mode privat */ }
  }, [simbol, draf, rencana, catatanTiket, lotMt5]);

  /* Level dari alamat dipasang SEKALI per kombinasi yang datang. Kalau
     dipasang tiap render, seretan orangnya akan terlempar balik ke angka
     kartu setiap kali komponennya menggambar ulang. */
  const dipasang = useRef('');
  useEffect(() => {
    const sl = Number(cari.get('sl')) || undefined;
    const tp = Number(cari.get('tp')) || undefined;
    /* ENTRY ikut dibaca dari alamat. Sinyal komunitas punya entry sendiri —
       memakai harga terakhir sebagai gantinya membuat R:R di chart berbeda
       dari R:R yang tertulis di kartunya, padahal keduanya menyebut sinyal
       yang sama. Kalau tidak dikirim, barulah harga terakhir dipakai. */
    const entryUrl = Number(cari.get('entry')) || undefined;
    const kunci = `${simbol}|${entryUrl ?? ''}|${sl ?? ''}|${tp ?? ''}`;
    if (dipasang.current === kunci) return;

    /* ── PENJAGA DITANDAI SESUDAH BEKERJA, BUKAN SEBELUM ────────────────
       Dulu `dipasang.current = kunci` dieksekusi tepat di sini, sebelum
       apa pun dipasang. Efek ini berjalan lebih dulu saat lilinnya BELUM
       datang — itu jalan yang normal, bukan kasus langka — jadi
       penjaganya sudah tertutup pada putaran kosong, dan putaran berikutnya
       (yang membawa lilin) keluar lebih awal tanpa memasang apa-apa.

       Terlihat sebagai: chart terbuka dari "Susun di Chart & Entry" dengan
       tiket yang kolomnya kosong dan chart tanpa garis. Tidak ada galat,
       karena memang tidak ada yang gagal — ada yang tidak pernah dijalankan.

       Sekarang penjaganya ditandai di dalam tiap cabang, sesudah kerjanya
       benar-benar terjadi. Cabang URL pun ikut: ia memakai harga penutupan
       terakhir sebagai entry cadangan, dan itu juga butuh lilin. */
    if (!lilin.closes.length) return;

    if (sl || tp || entryUrl) {
      dipasang.current = kunci;
      setRencana({
        entry: entryUrl ?? lilin.closes[lilin.closes.length - 1] ?? undefined,
        sl, tp,
      });
      /* Entry dari sinyal adalah KEPUTUSAN, bukan tebakan — jadi penyusul
         harga otomatis berhenti ikut campur begitu ia dipasang. */
      if (entryUrl) entryDigeser.current = true;
      return;
    }

    /* ── DATANG DARI "SUSUN DI CHART & ENTRY" TANPA MEMBAWA LEVEL ──────
       Tombol itu ditekan dari formulir Copy Signal yang kolom-kolomnya
       masih kosong, jadi alamatnya cuma membawa simbol dan arah. Akibatnya
       chart terbuka dengan tiket kosong dan chart polos: orangnya sampai
       di halaman yang benar lalu tidak punya apa pun untuk digeser —
       padahal MENGGESER GARIS itu satu-satunya alasan ia ke sini.

       Sekarang tiga garisnya langsung terpasang sebagai usulan: entry di
       harga terakhir, SL 1,5 x ATR, TP menyusul dengan R:R 2. Sama persis
       dengan yang muncul saat orang menekan BUY sendiri — jadi tidak ada
       perilaku kedua yang harus dipelajari, dan angkanya lahir dari ATR
       simbol itu, bukan dari persentase datar yang berarti $900 di BTC dan
       $0,0004 di SHIB.

       USULAN, BUKAN KEPUTUSAN: entryDigeser sengaja dibiarkan false supaya
       entry-nya tetap menyusul harga sampai orangnya menyeret sendiri —
       persis seperti tiket yang dibuka lewat tombol BUY. */
    const arahSinyal = (cari.get('arah') || '').toUpperCase();
    if (cari.get('untuk') === 'sinyal'
        && (arahSinyal === 'BUY' || arahSinyal === 'SELL')
        ) {
      dipasang.current = kunci;
      const idx = lilin.closes.length - 1;
      const u = usulSlTp(lilin, idx, arahSinyal);
      /* ARAHNYA IKUT DISETEL, bukan cuma levelnya.
         ────────────────────────────────────────────────────────────────
         Tanpa baris ini keduanya bisa berselisih, dan itu bukan
         kemungkinan teoretis — ia langsung terjadi saat diuji. Tiket yang
         dipulihkan dari sessionStorage membawa arah SELL dari pekerjaan
         sebelumnya, lalu blok ini menimpa levelnya dengan bentuk BUY dari
         alamat. Hasilnya SELL dengan SL di bawah entry dan TP di atas:
         sisinya salah, arahBenar di tiket jadi false, dan tombol
         "Ke Copy Signal" MATI.

         Yang terlihat orangnya cuma tombol yang tidak bisa ditekan tanpa
         sebab yang jelas — tidak ada galat, karena tidak ada yang gagal;
         dua sumber kebenaran yang tidak sepakat.

         Alamat yang menang di sini, dan itu disengaja: untuk=sinyal
         berarti orangnya BARU SAJA menekan "Susun di Chart & Entry" dengan
         arah yang ia pilih sendiri di formulir. Niat yang baru mengalahkan
         tiket yang tertinggal. */
      setDraf(arahSinyal);
      setRencana({
        entry: lilin.closes[idx],
        sl: u.sl || undefined,
        tp: u.tp || undefined,
      });
    }
  }, [cari, simbol, lilin]);

  /* ── Entry menyusul harga: SELURUH RENCANA IKUT, bukan entry sendirian ──
     Ini sebab R:R diam-diam meleset.

     Dulu tiap lilin baru cuma memindahkan ENTRY ke harga penutupan terakhir
     sementara SL dan TP tinggal di tempatnya. Jaraknya berubah sendiri: entry
     yang merangkak naik menjauh dari SL dan mendekat ke TP, jadi risiko
     membesar dan imbalan mengecil pada setiap lilin. Rencana yang disusun
     tepat 1 : 2 sampai di formulir Copy Signal sebagai 1 : 1,65 — tanpa ada
     yang menyentuh apa pun.

     Terukur pada kasus yang dilaporkan: entry 63.130,01 dengan SL 62.239,669
     dan TP 64.596,177. R:R = 2 tepat pada entry 63.025 — selisih seratus
     dolar merangkak, dan rasionya turun 18%.

     Sekarang ketiganya digeser dengan selisih yang SAMA. Bentuk rencananya
     tetap; yang berubah cuma letaknya. R:R tidak bisa lagi berubah tanpa ada
     yang mengubahnya.

     LEVEL HASIL SERETAN TANGAN TIDAK DIGESER SAMA SEKALI — dan entry-nya pun
     ikut diam. SL yang sengaja ditaruh di bawah swing low tertentu berhenti
     benar begitu digeser otomatis; sementara memindahkan entry sendirian
     mengulang persis cacat yang baru diperbaiki. Kalau orangnya sudah
     memutuskan, tiketnya berhenti bergerak sendiri. */
  const entryDigeser = useRef(false);
  useEffect(() => {
    if (entryDigeser.current || aksiPosisi || seretTangan.current) return;
    const h = lilin.closes[lilin.closes.length - 1];
    if (!h) return;
    setRencana((r) => {
      if (!r.sl && !r.tp) return r;
      const geser = r.entry ? h - r.entry : 0;
      if (!geser) return { ...r, entry: h };
      return {
        entry: h,
        sl: r.sl ? r.sl + geser : r.sl,
        tp: r.tp ? r.tp + geser : r.tp,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lilin.closes.length]);

  const usulSl = rencana.sl;
  const usulTp = rencana.tp;
  /* Zona SNR dari logika yang sama dengan screener. Dimatikan secara bawaan:
     empat garis mendatar di chart yang belum dibaca cuma menutupi lilinnya. */
  const [tampilSnr, setTampilSnr] = useState(awal.snr ?? false);
  const [tampilSmi, setTampilSmi] = useState(awal.smi ?? true);

  /* Simpan tiap kali salah satunya berubah. */
  useEffect(() => {
    simpanSetelanChart({ simbol, tf, snr: tampilSnr, smi: tampilSmi });
  }, [simbol, tf, tampilSnr, tampilSmi]);

  const [tampilan, setTampilan] = useState(bacaTampilan);
  /* Cermin React dari preferensi pasar di lib/pasar. Sumber kebenarannya di
     sana (screener memakainya tanpa React); state ini cuma supaya tombolnya
     ikut menggambar ulang. */
  const [pasarUi, setPasarUi] = useState(pasarKripto);
  const [menuTampilan, setMenuTampilan] = useState(false);

  /* -- Panel tampilan bekerja dengan DRAF --------------------------------
     Perubahan langsung terlihat di chart (pratinjau hidup: memilih warna
     tanpa melihat hasilnya cuma menebak), tapi TIDAK ada yang ditulis
     sebelum Simpan ditekan. Menutup panel lewat mana pun selain Simpan
     mengembalikan keadaan saat panel dibuka -- itulah yang dijanjikan
     sebuah tombol Simpan: yang belum disimpan belum terjadi. */
  const drafAwal = useRef<{ t: SetelanTampilan; p: ReturnType<typeof pasarKripto> } | null>(null);

  const bukaTutupTampilan = () => {
    if (menuTampilan) { batalTampilan(); return; }
    drafAwal.current = { t: tampilan, p: pasarUi };
    setMenuTampilan(true);
  };

  const batalTampilan = () => {
    const d = drafAwal.current;
    if (d) { setTampilan(d.t); setPasarUi(d.p); }
    setMenuTampilan(false);
  };

  const simpanTampilan = () => {
    try { localStorage.setItem(KUNCI_TAMPILAN, JSON.stringify(tampilan)); } catch { /* privat */ }
    /* Pasar diterapkan DI SINI, bukan saat tombolnya diklik: berpindah pasar
       berarti membuang cache dan menarik ulang seluruh lilin -- terlalu
       mahal untuk sekadar pratinjau, dan orang yang cuma menimbang-nimbang
       lalu menekan Batal tidak kehilangan apa pun. */
    if (pasarUi !== pasarKripto()) {
      aturPasarKripto(pasarUi);
      setRiwayatLama(null);
      setHabisRiwayat(false);
      setSegar((v) => v + 1);
    }
    setMenuTampilan(false);
  };
  const tampilanBawaan = (Object.keys(TAMPILAN_AWAL) as (keyof SetelanTampilan)[])
    .every((k) => tampilan[k] === TAMPILAN_AWAL[k]);

  /* Tanda air, susunan TradingView: "SIMBOL, TF" besar di atas, "SIMBOL
     JENIS-PASAR" kecil di bawah. Awalan "MT5:" dibuang -- itu penanda rute
     data untuk kita, bukan nama instrumen untuk orang yang membacanya.

     Jenis pasarnya DIBACA dari balasan proxy, tidak ditebak: BTCUSDT dilayani
     spot sementara BTCDOMUSDT futures, jadi satu kata tetap akan salah untuk
     sebagian koin. Selama belum terbaca, baris keduanya tidak ditulis sama
     sekali -- tanda air tanpa keterangan lebih baik daripada keterangan yang
     mungkin keliru. Bergantung pada `lilin` supaya ia dihitung ulang begitu
     lilin pertamanya tiba dan pasarnya sudah tercatat. */
  const mt5 = simbol.startsWith('MT5:');
  /* Dihitung terpisah karena dipakai DUA kali: sebagai isi tanda airnya, dan
     sebagai placeholder kolom teks di panel setelan. Placeholder yang
     menampilkan nilai otomatis yang sesungguhnya membuat aturan "kosongkan
     untuk otomatis" terlihat, bukan cuma tertulis. */
  const airOtomatis = (mt5 ? simbol.slice(4) : simbol) + ', ' + tf.toUpperCase();
  const tandaAir = useMemo(() => {
    if (!tampilan.tandaAir) return undefined;
    const nama = mt5 ? simbol.slice(4) : simbol;
    const jenis = bacaPasar(simbol);
    const pasar = mt5 ? 'TRADE-FI' : jenis === 'futures' ? 'PERP' : jenis === 'spot' ? 'SPOT' : '';
    /* Teks sendiri hanya mengganti baris ATAS. Baris bawah tetap jenis
       pasarnya: itu keterangan yang tidak bisa diarang orangnya, dan justru
       paling berguna ketika baris atasnya sudah diganti jadi nama sendiri. */
    return {
      utama: tampilan.tandaAirTeks.trim() || airOtomatis,
      sub: pasar ? nama + ' ' + pasar : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simbol, tf, mt5, lilin, airOtomatis, tampilan.tandaAir, tampilan.tandaAirTeks]);

  /* ── Data realtime ──────────────────────────────────────────────────
     Ditarik ulang tiap 15 detik, sama dengan umur cache di lib/pasar.ts —
     memintanya lebih sering hanya akan menerima salinan cache yang sama. */
  useEffect(() => {
    let hidup = true;
    async function tarik() {
      try {
        /* 1000, batas yang memang sudah diizinkan backend (dan batas satu
           permintaan Binance). Dulu 500 tanpa alasan yang tercatat — dan
           setengah dari yang boleh berarti setengah riwayat yang hilang
           tanpa ada yang menyadarinya.

           Dalam satuan waktu: 1000 lilin = ±5,5 bulan di TF 4 jam, ±2 tahun
           9 bulan di TF harian.

           LEBIH DARI ITU butuh penomoran halaman (permintaan berulang dengan
           startTime mundur), bukan sekadar angka yang dinaikkan. Binance
           membatasi 1000 PER PERMINTAAN, bukan seluruhnya. */
        /* MT5 meminta SEMUA yang tersimpan, kripto cukup 1000.
           ────────────────────────────────────────────────────────────
           Bedanya bukan selera: kripto punya penomoran halaman (tombol
           "Muat lebih lama" menarik potongan berikutnya lewat endTime),
           jadi 1000 per permintaan sudah cukup dan sisanya diambil saat
           diminta. Trade-Fi TIDAK punya rute itu — tidak ada cara meminta
           lilin lebih tua dari MT5 — jadi satu permintaan ini adalah
           satu-satunya kesempatan. Menjepitnya di 1000 berarti riwayat
           yang sudah dikirim EA dan sudah tersimpan di disk VPS tetap
           tidak pernah sampai ke layar. */
        const l = await ambilKlines(simbol, tf, simbol.startsWith('MT5:') ? 15000 : 1000, true);
        if (!hidup) return;
        if (!l.closes.length) {
          /* Polling yang gagal TIDAK memasang peringatan kalau chartnya sudah
             berisi. Penarikan berulang tiap 3 detik: satu kedipan koneksi
             cukup untuk menggagalkan satu permintaan, dan memasang peringatan
             merah di atas chart yang sedang tergambar baik-baik saja
             memberitahu orangnya ada yang rusak padahal tidak ada.

             Yang tampil tetap lilin terakhir yang berhasil -- sama seperti
             sebelumnya, karena setLilin memang cuma dipanggil saat berhasil.
             Yang berubah hanya: kegagalan sementara berhenti berteriak.
             Kalau memang chartnya kosong, peringatannya tetap muncul. */
          if (!lilinRef.current.closes.length) {
            setGalat(simbol.startsWith('MT5:')
              ? 'Belum ada data dari terminal MT5 — buka MT5 dengan EA Trade-Fi Sync v2 terpasang; chart terisi begitu EA mengirim (± tiap 5 menit).'
              : 'Data tidak diterima. Proxy VPS mungkin sedang tidak menjawab.');
          }
        }
        else { setLilin(l); setGalat(''); }
      } catch (e) {
        /* Alasan yang sama: galat tak terduga di tengah polling tidak boleh
           menghapus chart yang sudah terbaca. */
        if (hidup && !lilinRef.current.closes.length) {
          setGalat(e instanceof Error ? e.message : 'Gagal mengambil data');
        }
      } finally {
        if (hidup) setMemuat(false);
      }
    }
    setMemuat(true);
    void tarik();
    /* Selama replay, data TIDAK disegarkan. Array lilin yang berganti di
       tengah putar-ulang akan menggeser arti setiap indeks — posisi yang
       dibuka di bar 300 tiba-tiba menunjuk lilin yang berbeda. */
    if (replayIdx !== null) return () => { hidup = false; };
    /* 3 detik, bukan 15: chart yang sedang ditatap harus bergerak seperti
       pasar, dan bebannya sudah dihitung di lib/pasar.ts — 3% dari jatah
       rate limit Binance untuk satu chart. */
    const jam = setInterval(tarik, 3_000);
    return () => { hidup = false; clearInterval(jam); };
  }, [simbol, tf, segar, replayIdx !== null]);

  /* Hasil backtest DIBUANG saat simbol/timeframe/setelan berubah. Tabel
     trade dari BTC 4 jam yang masih terpampang di bawah chart ETH 5 menit
     adalah cara paling halus untuk salah membaca hasil. */
  useEffect(() => { setHasil(null); }, [simbol, tf, set]);
  /* Ganti simbol atau timeframe = keluar dari replay. Melanjutkan replay di
     atas deret lilin yang berbeda berarti setiap indeks menunjuk waktu yang
     lain, dan posisi yang sedang terbuka jadi tidak punya arti. */
  useEffect(() => { setReplayIdx(null); setGarisHarga([]); }, [simbol, tf]);

  /* SEMUA deret yang digambar per indeks WAJIB dihitung dari lilinGabung,
     bukan lilin. ChartLilin menggambar lilinGabung dan memetakan nilai[i] ke
     lilin ke-i; deret yang dihitung dari jendela live 1000 lilin akan
     mendarat di 1000 lilin TERTUA begitu "Muat lebih lama" menyisipkan
     riwayat di depan. Persis itulah yang terlihat: SMI menumpuk di ujung
     kiri chart sesudah riwayat ditarik. Pine sudah benar sejak lama --
     DockPine memang menerima lilinGabung. */
  const garis: Garis[] = useMemo(() => {
    const keluar: Garis[] = [];
    if (set.strategi === 'ema' && lilinGabung.closes.length) {
      const g = garisIndikator(lilinGabung, set);
      keluar.push({ nama: `EMA ${set.emaCepat}`, nilai: g.cepat ?? [], warna: '#fbbf24' });
      keluar.push({ nama: `EMA ${set.emaLambat}`, nilai: g.lambat ?? [], warna: '#60a5fa' });
    }
    /* Garis dari Pine ikut di panel harga; yang bersifat osilator (RSI, SMI)
       dikirim ke panel bawah lewat jalur `smi`. Memisahkannya di sini, bukan
       di penerjemah, supaya penerjemah tidak perlu tahu apa pun tentang cara
       menggambar. */
    (pine?.plot ?? []).filter((p) => !p.osilator)
      .forEach((p) => keluar.push({ nama: p.judul, nilai: p.nilai, warna: p.warna }));
    return keluar;
  }, [lilinGabung, set, pine]);

  /* Zona dihitung sampai bar yang SEDANG tampil, bukan sampai bar terakhir.
     Selama replay, menggambar zona dari data masa depan adalah cara paling
     halus untuk membuat latihannya berbohong. */
  /* Pivot & ATR dihitung SEKALI per set lilin — bukan tiap bar replay.
     Alasan lengkapnya di siapkanSnr (lib/backtest.ts): dulu useMemo ini
     bergantung pada replayIdx, jadi tiga penyalinan larik, dua pemindaian
     pivot, dan satu deret ATR penuh diulang empat kali sedetik di jalur
     render — sekitar 135.000 operasi per tick pada 3000 lilin, untuk
     menghasilkan tiga angka. */
  /* lilinGabung juga di sini, dan bukan cuma soal gambar: zonaSnrDari
     menerima replayIdx, yang merupakan indeks ke dalam lilinGabung. Memberi
     siapkanSnr deret yang berbeda berarti replay membaca pivot dari bar yang
     salah sesudah riwayat dimuat. */
  const siapSnr = useMemo(
    () => (tampilSnr && lilinGabung.closes.length ? siapkanSnr(lilinGabung) : null),
    [tampilSnr, lilinGabung]
  );

  /* Yang tersisa per bar: satu pencarian biner dan satu pembacaan larik. */
  const zona = useMemo(
    () => (siapSnr ? zonaSnrDari(siapSnr, replayIdx ?? undefined) : null),
    [siapSnr, replayIdx]
  );

  /* Zona digambar sebagai TIGA garis per sisi: batas atas, nilai pivotnya,
     dan batas bawah. Pita utuh butuh seri area tersendiri; tiga garis tipis
     menyampaikan hal yang sama dengan sepersepuluh kerumitannya, dan batas
     itulah yang sebenarnya dibaca saat menilai sentuhan. */
  const garisZona = useMemo(() => {
    if (!zona) return [];
    const g: GarisHarga[] = [];
    if (zona.resisten) {
      g.push({ harga: zona.resisten.atas, warna: 'rgba(248,113,113,.28)', label: '' });
      g.push({ harga: zona.resisten.nilai, warna: 'rgba(248,113,113,.7)', label: 'R' });
      g.push({ harga: zona.resisten.bawah, warna: 'rgba(248,113,113,.28)', label: '' });
    }
    if (zona.support) {
      g.push({ harga: zona.support.atas, warna: 'rgba(16,185,129,.28)', label: '' });
      g.push({ harga: zona.support.nilai, warna: 'rgba(16,185,129,.7)', label: 'S' });
      g.push({ harga: zona.support.bawah, warna: 'rgba(16,185,129,.28)', label: '' });
    }
    return g;
  }, [zona]);

  const smi = useMemo(() => {
    /* Osilator dari Pine MENGGANTI panel SMI bawaan saat ada — dua osilator
       di satu panel dengan skala berbeda tidak bisa dibaca, dan yang baru
       saja dijalankan orangnya adalah yang ingin dilihatnya. */
    const dariPine = (pine?.plot ?? []).filter((p) => p.osilator);
    if (dariPine.length) {
      return { smi: dariPine[0].nilai, signal: dariPine[1]?.nilai ?? [] };
    }
    return tampilSmi && lilinGabung.closes.length >= 30 ? deretSmi(lilinGabung) : null;
  }, [tampilSmi, lilinGabung, pine]);

  /* Pita jenuh cuma sah kalau panel bawah memang SMI. Skrip Pine yang
     menumpang panel yang sama boleh berskala apa saja -- rupiah, volume,
     0..100 -- dan pita +-50 di atasnya akan menyatakan jenuh di tempat yang
     bukan jenuh. */
  const smiAsli = useMemo(
    () => smi !== null && !(pine?.plot ?? []).some((p) => p.osilator),
    [smi, pine]
  );

  /* Posisi yang sedang terbuka MENANG atas rencana: kalau sudah masuk, yang
     digambar adalah level posisinya, bukan rancangan sebelumnya. */
  const aksiPosisi = aksi?.posisi ?? null;
  const aksiTunda = aksi?.tunda ?? null;

  /* Begitu posisinya SELESAI — SL kena, TP kena, atau ditutup manual — semua
     garisnya ikut hilang. Garis order yang sudah mati tapi masih tergambar
     akan terbaca sebagai order yang masih hidup, dan itu lebih menyesatkan
     daripada chart kosong. */
  const adaPosisiSebelumnya = useRef(false);
  useEffect(() => {
    if (adaPosisiSebelumnya.current && !aksiPosisi) {
      setRencana({});
      setDraf(null);
      entryDigeser.current = false;
    }
    adaPosisiSebelumnya.current = !!aksiPosisi;
  }, [aksiPosisi]);

  /* ── Jenis order dari LETAK garis entry ────────────────────────────
     Entry di harga pasar = Market. BUY di atas pasar = Buy Stop (mengejar
     tembusan), BUY di bawah = Buy Limit (menunggu diskon); SELL kebalikan
     persisnya. Aturan yang sama dengan bursa mana pun — dan karena jenisnya
     mengikuti seretan, menyeret garis entry ADALAH cara memilih jenis. */
  const jenisEntry: JenisEntry = useMemo(() => {
    const market = aksi?.hargaKini;
    const e = rencana.entry;
    if (!draf || !e || !market) return 'MARKET';
    if (Math.abs(e - market) / market < 0.0005) return 'MARKET';
    if (draf === 'BUY') return e > market ? 'STOP' : 'LIMIT';
    return e < market ? 'STOP' : 'LIMIT';
  }, [draf, rencana.entry, aksi?.hargaKini]);
  const labelJenis = jenisEntry === 'MARKET' ? 'Market'
    : `${draf === 'BUY' ? 'Buy' : 'Sell'} ${jenisEntry === 'STOP' ? 'Stop' : 'Limit'}`;
  const garisSeret: GarisSeret[] = useMemo(() => {
    /* Mode SUNTING menang atas semuanya: begitu sebuah order dipilih dari
       panel, yang digambar adalah order ITU — bukan rencana tiket yang
       kebetulan masih tersisa di layar. Dua set garis di satu chart tidak
       bisa dibedakan, dan yang diseret orangnya harus yang ia maksud. */
    /* Order yang sedang disunting SELALU order nyata. Alasan yang sama
       dengan garisOrder di bawah: di mode latihan ia tidak boleh tergambar.
       bukaSunting memang sudah memindahkan mode ke real, tapi orangnya bisa
       menekan Demo sesudahnya — dan saat itu garisnya harus ikut hilang,
       bukan tertinggal sebagai order yang tampak masih bisa diseret. */
    if (sunting && aksi?.mode === 'real') {
      const g: GarisSeret[] = [];
      /* Entry BISA DISERET, tapi ia tidak pindah — yang berubah SL atau
         TP, tergantung ke mana ia ditarik. Gerakan itu meniru cara orang
         memikirkannya: "dari harga masuk, turun sekian jadi stop; naik
         sekian jadi target". Menyeret dari garis yang sudah ada jauh
         lebih cepat daripada mencari garis SL yang memang belum pernah
         dipasang. */
      /* Sebelum panelnya dibuka, garisnya menjelaskan cara membukanya —
         garis yang bisa diklik tapi tidak mengatakannya sama saja dengan
         tidak ada. */
      /* Arahnya saja. Sisanya — "klik untuk ubah", "seret lalu Kirim" —
         sudah dijelaskan kursor dan tombolnya sendiri, dan di garis ia
         cuma teks panjang yang menutupi lilin. */
      /* SEDANG DIHAPUS: garisnya tetap ada tapi berhenti berpura-pura
         normal. Keterangannya berubah, dan seretnya dimatikan — menggeser
         SL milik order yang sedang dibatalkan adalah perintah yang tidak
         punya sasaran, dan membiarkannya bisa diseret mengundang orang
         mengirim perubahan ke order yang sebentar lagi tidak ada. */
      const sedangHapus = !!hapusMenunggu;
      const ketEntry = sedangHapus ? '· menghapus…' : `· ${sunting.arah}`;
      const ketStop = sedangHapus ? '· menghapus…' : '';
      if (sunting.entry) g.push({
        id: 'entry', harga: sunting.entry, warna: sedangHapus ? '#71717a' : '#d4d4d8', label: 'Entry',
        ket: ketEntry,
        bisaSeret: !sedangHapus,
      });
      if (suntingSl) g.push({ id: 'sl', harga: suntingSl, warna: sedangHapus ? '#7f5f5f' : '#f87171', label: 'SL', ket: ketStop, bisaSeret: !sedangHapus });
      if (suntingTp) g.push({ id: 'tp', harga: suntingTp, warna: sedangHapus ? '#4a6b5e' : '#10b981', label: 'TP', ket: ketStop, bisaSeret: !sedangHapus });
      return g;
    }
    const sumber = aksiPosisi
      ? { entry: aksiPosisi.masuk, sl: aksiPosisi.sl, tp: aksiPosisi.tp }
      : aksiTunda
      ? { entry: aksiTunda.entry, sl: aksiTunda.sl, tp: aksiTunda.tp }
      : rencana;
    const kunci = !!aksiPosisi || !!aksiTunda;
    const g: GarisSeret[] = [];

    /* Risiko & imbalan DITULIS DI GARISNYA.
       ─────────────────────────────────────────────────────────────────
       SL bukan sekadar harga — ia jumlah uang yang hilang kalau tersentuh.
       Untuk posisi yang sudah jalan, angkanya dari ukuran posisi
       sesungguhnya; untuk tiket yang sedang disusun, dari setelan risiko.
       Menaruhnya di label garis berarti menyeret garis LANGSUNG terlihat
       akibatnya dalam dolar, bukan cuma dalam harga. */
    const e = sumber.entry, s = sumber.sl, tpN = sumber.tp;
    let ketSl = '', ketTp = '';
    if (e && s && tpN) {
      if (aksiPosisi) {
        ketSl = `· -${uang(aksiPosisi.risiko)}`;
        ketTp = `· +${uang(aksiPosisi.unit * Math.abs(tpN - aksiPosisi.masuk))}`;
      } else if (aksi?.mode === 'real' && simbol.startsWith('MT5:')) {
        /* Tiket MT5 yang sedang disusun: lot × nilai per lot. */
        ketSl = `· -${uang(lotMt5 * nilaiLotMt5 * Math.abs(e - s))}`;
        ketTp = `· +${uang(lotMt5 * nilaiLotMt5 * Math.abs(tpN - e))}`;
      } else if (aksi?.mode === 'real') {
        /* Mode REAL: dolar dari ukuran order yang SEBENARNYA akan dikirim —
           qty = modal × leverage / entry, bukan dari setelan risiko demo. */
        const qty = (nyataSetelan.modal * nyataSetelan.leverage) / e;
        ketSl = `· -${uang(qty * Math.abs(e - s))}`;
        ketTp = `· +${uang(qty * Math.abs(tpN - e))}`;
      } else if (aksi) {
        /* Qty beku dari jangkar tiket — dolarnya MENGIKUTI garis yang
           digeser, seperti position tool TradingView. */
        const q = qtyDemo.current;
        if (q > 0) {
          ketSl = `· -${uang(q * Math.abs(e - s))}`;
          ketTp = `· +${uang(q * Math.abs(tpN - e))}`;
        } else {
          const r = aksi.risiko;
          ketSl = `· -${uang(r)}`;
          ketTp = `· +${uang(r * (Math.abs(tpN - e) / Math.abs(e - s)))}`;
        }
      }
    }
    const ketEntry = aksiTunda
      ? `· ${aksiTunda.arah === 'BUY' ? 'Buy' : 'Sell'} ${aksiTunda.jenis === 'STOP' ? 'Stop' : 'Limit'} menunggu`
      : draf ? `· ${labelJenis}` : '';

    if (sumber.entry) g.push({ id: 'entry', harga: sumber.entry, warna: '#d4d4d8', label: 'Entry', ket: ketEntry, bisaSeret: !kunci });
    if (sumber.sl) g.push({ id: 'sl', harga: sumber.sl, warna: '#f87171', label: 'SL', ket: ketSl, bisaSeret: !kunci });
    if (sumber.tp) g.push({ id: 'tp', harga: sumber.tp, warna: '#10b981', label: 'TP', ket: ketTp, bisaSeret: !kunci });
    return g;
  }, [sunting, panelUbah, suntingSl, suntingTp, aksiPosisi, aksiTunda, rencana, aksi, draf, labelJenis, nyataSetelan, lotMt5, nilaiLotMt5, simbol, hapusMenunggu]);

  /* ── Order yang BENAR-BENAR menggantung di bursa ────────────────────
     Sumbernya bursa, bukan keadaan halaman ini. Itulah yang membuatnya
     bertahan melewati kirim dan melewati refresh: yang digambar bukan
     ingatan chart tentang apa yang pernah dikirim, melainkan jawaban
     Binance atas pertanyaan "apa yang MASIH menggantung sekarang".
     Ingatan bisa basi — order yang dibatalkan lewat aplikasi HP akan
     tetap tergambar sampai halaman dimuat ulang. Jawaban bursa tidak.

     Satu garis per order, bukan satu garis per simbol: dua kali order di
     pair yang sama berarti dua kewajiban berbeda, dan meringkasnya jadi
     satu garis persis menyembunyikan order kedua. */
  const garisOrder = useMemo(() => {
    /* MODE LATIHAN TIDAK MENAMPILKAN ORDER NYATA.
       ──────────────────────────────────────────────────────────────────
       Garis ini menggambarkan uang sungguhan yang sedang dipertaruhkan.
       Di mode demo ia bukan sekadar tidak relevan — ia menyesatkan: orang
       yang sedang berlatih melihat SL di layar dan mengira itu bagian dari
       latihannya, atau sebaliknya mengira posisi nyatanya sudah terlindungi
       padahal yang dilihat cuma sisa gambar dari mode sebelumnya.

       Kembali ke mode real, garisnya muncul lagi apa adanya — tidak ada
       yang dihapus, cuma tidak digambar. */
    if (aksi?.mode !== 'real') return [];
    /* MT5 punya daftarnya sendiri — pending order dilaporkan EA, bukan
       diambil dari Binance. Simbol chart berawalan "MT5:" sementara EA
       melapor nama broker apa adanya (EURJPYc), jadi awalannya dikupas
       dulu sebelum dibandingkan. */
    if (simbol.startsWith('MT5:')) {
      const nama = simbol.slice(4).toUpperCase();
      /* NAMA DASAR di kedua sisi.
         ──────────────────────────────────────────────────────────────
         Dulu di sini `o.simbol.toUpperCase() === nama`, dan itu TIDAK
         PERNAH cocok di broker yang memakai akhiran: EA melapor
         "XAUUSDc", chart bertanya "XAUUSD", dan toUpperCase justru
         menghapus satu-satunya petunjuk bahwa huruf terakhir itu
         akhiran ("XAUUSDC"). Akibatnya tidak ada galat sama sekali —
         cuma chart yang selamanya bersih padahal ada order hidup.
         simbolDasarMt5 mengupas akhiran huruf kecil di NAMA MENTAH,
         jadi harus dipanggil sebelum huruf besar dipaksakan. */
      const cocok = (s: string) => simbolDasarMt5(s) === nama;

      const g: GarisHarga[] = [];

      /* POSISI TERBUKA SENGAJA TIDAK DIGAMBAR DI SINI.
         ──────────────────────────────────────────────────────────────
         Dulu blok ini menggambar entry, SL, dan TP tiap posisi MT5 —
         dan ChartLilin SUDAH menggambarnya sendiri lewat prop
         `posisiMt5`. Jadi tiap level punya DUA garis di harga yang sama
         persis, masing-masing dengan labelnya sendiri di sumbu harga.

         Dengan satu posisi itu terlihat seperti garis yang agak tebal.
         Dengan dua posisi hasilnya enam level digambar dua belas kali,
         dan sumbu harga jadi tumpukan angka yang saling menimpa — persis
         yang terjadi saat pemiliknya mencoba layering dua lot.

         Yang dipertahankan versi ChartLilin, bukan versi ini: di sana
         garisnya punya gagang seret SL/TP beserta alur "Kirim SL/TP →
         MT5". Yang di sini cuma gambar. Nomor tiket yang dulu ditulis di
         label ikut pindah ke sana supaya tidak ada yang hilang. */

      const milikMt5 = akunMt5.pending.filter((o) => cocok(o.simbol));
      const banyakMt5 = milikMt5.length > 1;
      for (const [i, o] of milikMt5.entries()) {
        g.push({
          harga: o.harga,
          warna: o.arah === 'BUY' ? 'rgba(251,191,36,.85)' : 'rgba(251,146,60,.85)',
          label: `${o.jenis.replace('_', ' ')}${banyakMt5 ? ` ${i + 1}` : ''}`,
        });
      }
      return g;
    }
    const milik = orderBursa.filter((o) => o.jenis === 'ENTRY' && o.simbol === simbol)
      /* Order yang SEDANG dipegang panel tiket sudah digambar sebagai
         garis Entry beserta rencana SL/TP-nya. Menggambarnya sekali lagi
         dari bursa menaruh dua garis di harga yang sama persis — terbaca
         seperti dua order padahal cuma satu. */
      .filter((o) => !(aksiTunda && Math.abs((o.pemicu || o.harga) - aksiTunda.entry) < 1e-9));
    /* Dinomori hanya kalau memang lebih dari satu: "Buy Stop 1" saat cuma
       ada satu order justru menimbulkan pertanyaan di mana yang kedua. */
    const banyak = milik.length > 1;
    return milik.map((o, i): GarisHarga => ({
      harga: o.pemicu || o.harga,
      warna: o.arah === 'BUY' ? 'rgba(251,191,36,.85)' : 'rgba(251,146,60,.85)',
      label: `${o.arah === 'BUY' ? 'Buy' : 'Sell'} ${/STOP/.test(o.tipe) ? 'Stop' : 'Limit'}${banyak ? ` ${i + 1}` : ''}`,
    }));
  /* akunMt5.posisi DIKELUARKAN dari dependensi bersama blok yang memakainya.
     Bukan sekadar rapi-rapi: EA melapor tiap beberapa detik dengan array
     posisi BARU yang isinya sama, jadi dependensi ini menghitung ulang
     seluruh garis order — lalu ChartLilin membongkar-pasang price line-nya
     — beberapa detik sekali, selamanya, untuk hasil yang identik. Itulah
     salah satu sumber "chart terasa berat" yang sudah dicatat di berkas
     ini. Posisi kini digambar ChartLilin lewat prop `posisiMt5`, yang
     identitasnya memang sudah distabilkan lewat kunci JSON. */
  }, [orderBursa, simbol, aksiTunda, akunMt5.pending, aksi?.mode]);

  const terakhir = lilin.closes[lilin.closes.length - 1];
  const sebelumnya = lilin.closes[lilin.closes.length - 2];
  const gerak = terakhir && sebelumnya ? ((terakhir - sebelumnya) / sebelumnya) * 100 : 0;

  /* ── Hitung mundur penutupan lilin ──────────────────────────────────
     Dihitung dari JAM SEKARANG, bukan dari waktu lilin terakhir. Klines
     yang kita terima disegarkan tiap 15 detik; kalau hitung mundurnya
     bersandar pada stempel lilin, angkanya akan melompat 15 detik sekali
     alih-alih berdetak.

     Batas lilin di Binance selalu kelipatan bulat dari durasinya sejak
     epoch (00:00, 04:00, 08:00 untuk 4 jam), jadi sisa waktunya bisa
     dihitung tanpa tahu kapan lilin terakhir dibuka. */
  /* Teks yang sedang diketik di kotak simbol, terpisah dari simbol aktif. */
  const [ketik, setKetik] = useState(simbol);
  useEffect(() => { setKetik(simbol); }, [simbol]);
  function komitSimbol() {
    const mentah = ketik.trim();
    if (!mentah) { setKetik(simbol); return; }

    /* ── DICOCOKKAN KE DAFTAR MT5 DULU ────────────────────────────────
       Orang mengetik "XAUUSD" karena itu nama yang ia kenal. Yang tahu
       emas harus ditulis "MT5:XAUUSDc" hanyalah kodenya — dan sebelum ini
       ketikan itu dikirim apa adanya ke Binance, bursa yang memang tidak
       punya simbol emas. Yang muncul: "Data tidak diterima. Proxy VPS
       mungkin sedang tidak menjawab" — pesan yang menuduh jaringan padahal
       permintaannya sendiri yang salah alamat.

       Tanpa peduli huruf besar-kecil, dan tanpa peduli apakah awalan
       "MT5:" ikut diketik. */
    const tanpaAwalan = mentah.replace(/^MT5:/i, '');
    const cocokMt5 = simbolMt5.find((s) => s.toLowerCase() === tanpaAwalan.toLowerCase());
    if (cocokMt5) {
      const penuh = 'MT5:' + cocokMt5;
      setKetik(penuh);
      if (penuh !== simbol) setSimbol(penuh);
      return;
    }

    /* rapikanSimbol, BUKAN toUpperCase(). Versi lama meng-uppercase apa pun
       — termasuk "MT5:XAUUSDc" jadi "MT5:XAUUSDC", simbol yang tidak ada di
       broker mana pun. Alasan lengkapnya ada di atas rapikanSimbol. */
    const v = rapikanSimbol(mentah);
    /* Bentuk yang jelas bukan simbol tidak dikirim ke proxy sama sekali;
       kotaknya dikembalikan ke simbol yang sedang tampil supaya tidak ada
       yang mengira grafiknya sedang menampilkan apa yang tertulis.
       Titik, garis bawah, dan pagar ikut diizinkan: nama simbol broker
       memakainya ("EURUSD.m", "#AAPL"). */
    if (!/^(MT5:)?[A-Za-z0-9._#-]{2,20}$/.test(v)) { setKetik(simbol); return; }
    if (v !== simbol) setSimbol(v);
  }

  /* ── Saran simbol ─────────────────────────────────────────────────────
     Dulu ini <datalist>. Di iOS Safari dukungannya tidak bisa diandalkan:
     kotaknya bisa diketik tapi TIDAK ADA satu pun pilihan yang muncul, dan
     tidak ada galat apa pun — dari sisi pengguna pencariannya sekadar mati.
     Satu-satunya jalan masuk yang tersisa di HP adalah lewat watchlist.

     Diganti daftar buatan sendiri: markup biasa, jadi ia berperilaku sama
     di semua peramban. Sumbernya ikut ditulis di tiap baris — "Trade-Fi ·
     MT5" atau "Kripto · Binance" — karena dari namanya saja XAUUSD dan
     BTCUSDT terlihat sejenis padahal datangnya dari dua tempat berbeda. */
  const [saranBuka, setSaranBuka] = useState(false);
  const saranSimbol = useMemo(() => {
    const q = ketik.trim().replace(/^MT5:/i, '').toLowerCase();
    const semua = [
      ...simbolMt5.map((s) => ({ nilai: 'MT5:' + s, label: s, sumber: 'Trade-Fi · MT5' })),
      ...SIMBOL_DASAR.map((s) => ({ nilai: s, label: s, sumber: 'Kripto · Binance' })),
    ];
    return (q ? semua.filter((o) => o.label.toLowerCase().includes(q)) : semua).slice(0, 40);
  }, [ketik, simbolMt5]);

  function pilihSimbol(v: string) {
    setKetik(v);
    setSaranBuka(false);
    if (v !== simbol) setSimbol(v);
  }

  const [detik, setDetik] = useState(0);

  /* ── Tinggi chart mengikuti LAYAR ──────────────────────────────────
     Angka tetap (680) menyisakan rongga di monitor tinggi dan meluber di
     laptop. Tingginya dihitung dari viewport dikurangi bilah-bilah di atas
     chart — tepi bawah panel jadi jatuh di sekitar akhir sidebar. */
  const [tinggiLayar, setTinggiLayar] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  useEffect(() => {
    const ukur = () => setTinggiLayar(window.innerHeight);
    window.addEventListener('resize', ukur);
    return () => window.removeEventListener('resize', ukur);
  }, []);
  /* Tinggi yang DISERET orangnya menang dan diingat — pegangannya di bawah
     chart; dilepas berarti dikunci jadi bawaan berikutnya. Tanpa seretan
     tersimpan, bawaannya dihitung supaya tepi bawah panel chart jatuh
     sejajar tautan "Learn more" di sidebar — tidak melewatinya. */
  const [tinggiManual, setTinggiManual] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem('jt.tinggiChart'));
      return v >= 360 && v <= 1600 ? v : null;
    } catch { return null; }
  });
  /* ── Layar penuh ──────────────────────────────────────────────────────
     Fullscreen API dipasang pada AREA CHART, bukan pada seluruh halaman:
     yang ingin dilihat lebar orangnya adalah lilinnya, dan sidebar plus
     bilah simbol yang ikut membesar cuma memindahkan sempitnya.

     Tingginya WAJIB ikut berubah. Kanvas lightweight-charts berukuran
     tetap dari prop `tinggi`; membiarkannya akan membuat layar penuh
     menampilkan chart setinggi semula di tengah bidang hitam — terlihat
     seperti fitur yang rusak, bukan seperti tidak ada fitur.

     `layarPenuh` diikuti dari EVENT, bukan dari tombol. Orang keluar dari
     layar penuh dengan Esc jauh lebih sering daripada dengan menekan
     tombolnya lagi, dan state yang cuma di-toggle tombol akan tertinggal
     menyala sesudah Esc. */
  const [penuhAsli, setPenuhAsli] = useState(false);

  /* ── LAYAR PENUH SEMU, untuk peramban yang tidak punya yang asli ──────
     iOS Safari TIDAK mendukung Element.requestFullscreen sama sekali —
     satu-satunya yang bisa layar penuh di sana adalah elemen <video>.
     Pemanggilannya tidak melempar galat dan tidak mencetak apa pun; ia
     cuma tidak terjadi. Dari sisi pengguna: tombolnya ditekan, tidak ada
     yang bergerak, dan tidak ada yang bisa dilaporkan.

     Karena itu ada mode semu: kartunya dipasang `fixed inset-0` sehingga
     menutupi viewport. Bukan layar penuh sungguhan — bilah alamat Safari
     tetap ada — tapi ia memberi yang sebenarnya dicari orang di HP, yaitu
     chart selebar dan setinggi mungkin.

     Dipakai juga sebagai jaring pengaman di peramban yang PUNYA API-nya
     tapi menolak permintaannya (izin, kebijakan iframe). */
  const [penuhSemu, setPenuhSemu] = useState(false);
  const layarPenuh = penuhAsli || penuhSemu;

  useEffect(() => {
    const ubah = () => setPenuhAsli(document.fullscreenElement === kartuChart.current);
    document.addEventListener('fullscreenchange', ubah);
    return () => document.removeEventListener('fullscreenchange', ubah);
  }, []);

  /* Esc tetap harus bekerja di mode semu — orang sudah terbiasa, dan mode
     yang cuma bisa ditutup lewat satu tombol kecil terasa seperti jebakan.
     Gulir halaman dikunci selama menyala: tanpa itu halaman di BELAKANG
     ikut bergulir saat orang menggeser chart. */
  useEffect(() => {
    if (!penuhSemu) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') setPenuhSemu(false); };
    document.addEventListener('keydown', tekan);
    const asal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tekan);
      document.body.style.overflow = asal;
    };
  }, [penuhSemu]);
  /* Tinggi kanvas saat layar penuh = tinggi jendela dikurangi bilah kendali
     yang IKUT tampil di atasnya. Bilahnya diukur, bukan ditaksir: isinya
     membungkus jadi dua baris di jendela sempit, dan angka tetap akan
     memotong chart persis sebanyak baris yang bertambah. */
  const [tinggiLayarPenuh, setTinggiLayarPenuh] = useState(0);
  useEffect(() => {
    if (!layarPenuh) return;
    const ukur = () => {
      const bilah = bilahChart.current?.offsetHeight ?? 0;
      /* 34 px: garis pemisah + padding kartu + ruang untuk pegangan seret
         tinggi di bawah chart. Tanpa sisa ini, sumbu waktunya terpotong. */
      setTinggiLayarPenuh(Math.max(240, window.innerHeight - bilah - 34));
    };
    /* Dua kali: sekali sekarang, sekali setelah browser selesai menata
       ulang jendela fullscreen — pengukuran pertama masih memakai tinggi
       jendela yang lama. */
    ukur();
    const t = setTimeout(ukur, 120);
    window.addEventListener('resize', ukur);
    return () => { clearTimeout(t); window.removeEventListener('resize', ukur); };
  }, [layarPenuh, tampilSmi]);
  const gantiLayarPenuh = useCallback(() => {
    /* Yang dinaikkan KARTUNYA, bukan area chart saja: bilah simbol,
       timeframe, harga terakhir, News, Indikator, dan Replay adalah alat
       yang justru dipakai sambil melihat chart lebar. Layar penuh yang
       membuang semuanya memaksa keluar-masuk tiap kali ganti timeframe. */
    const el = kartuChart.current;
    if (!el) return;

    if (penuhSemu) { setPenuhSemu(false); return; }
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }

    /* Dicek DULU, bukan dicoba lalu ditangkap: di iOS Safari
       requestFullscreen tidak ada sama sekali, jadi `?.()` menghasilkan
       undefined tanpa melempar apa pun — tidak ada yang bisa ditangkap,
       dan tombolnya diam. */
    if (document.fullscreenEnabled && typeof el.requestFullscreen === 'function') {
    /* requestFullscreen bisa gagal DUA CARA, dan keduanya harus jatuh ke
       mode semu:

       1. Promise-nya ditolak (izin, kebijakan) -> .catch()
       2. Ia MELEMPAR SERENTAK. Terukur di peramban tersemat:
          "TypeError: Permissions check failed" keluar sebelum promise-nya
          sempat ada, jadi .catch() tidak pernah tersentuh dan galatnya
          melompat keluar dari penangan klik. Yang terlihat orang: tombol
          ditekan, tidak ada yang bergerak, tidak ada yang bisa dilaporkan.

       try/catch DI LUAR menangkap keduanya. */
      try {
        void el.requestFullscreen().catch(() => setPenuhSemu(true));
      } catch { setPenuhSemu(true); }
      return;
    }
    setPenuhSemu(true);
  }, [penuhSemu]);

  /* ── TINGGI OTOMATIS DI MODE PANEL ────────────────────────────────────
     Tanpa ini panel memakai rumus chart tunggal, yang lantainya 460 px.
     Di panel seperempat layar (±330 px) isinya pasti melimpah: halaman
     tergulung dan sumbu waktu terpotong, dan orangnya harus menyeret
     pembatas grid untuk mengepaskan tiap panel satu per satu.

     Diukur dari POSISI CHART YANG SEBENARNYA (`areaChart`), bukan dari
     menjumlahkan tinggi bagian-bagian di atasnya. Yang di atas chart
     berubah-ubah — bilah kepala bisa disembunyikan, pita galat dan kabar
     replay muncul-hilang — dan setiap penjumlahan tangan akan meleset
     persis sebanyak bagian yang lupa dihitung. Jarak dari puncak chart ke
     dasar jendela selalu benar tanpa tahu apa saja yang ada di atasnya.

     Tidak ada umpan balik: `top` ditentukan oleh yang DI ATAS chart, bukan
     oleh tinggi chart itu sendiri. */
  const [tinggiPanel, setTinggiPanel] = useState(0);
  useEffect(() => {
    if (!POLOS) return;
    const ukur = () => {
      const atas = areaChart.current?.getBoundingClientRect().top ?? 0;
      /* 10 px, DIUKUR bukan ditaksir: dengan 6 px panel masih menyisakan
         2 px limpahan — cukup untuk memunculkan bilah gulir setipis rambut
         di tiap panel, yang terbaca sebagai "ada yang tidak muat" padahal
         chartnya sendiri sudah pas. Lantainya 150: di bawah itu chart tidak
         terbaca lagi, dan lebih baik panelnya bergulir sedikit daripada
         menampilkan kanvas setinggi dua baris teks. */
      setTinggiPanel(Math.max(150, Math.round(window.innerHeight - atas - 10)));
    };
    ukur();
    /* Dua kali: sekali sekarang, sekali setelah tata letak selesai —
       pengukuran pertama berjalan sebelum bilah kepala sempat menghilang,
       jadi `top`-nya masih yang lama. */
    const t = setTimeout(ukur, 120);
    window.addEventListener('resize', ukur);
    return () => { clearTimeout(t); window.removeEventListener('resize', ukur); };
  }, [kepalaSembunyi, tampilSmi, galat, kabarReplay]);

  const tinggiChart = layarPenuh && tinggiLayarPenuh
    ? tinggiLayarPenuh
    : POLOS && tinggiPanel
      ? tinggiPanel
      : tinggiManual ?? Math.max(460, tinggiLayar - (tampilSmi ? 343 : 303));
  const mulaiSeretTinggi = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const awalY = e.clientY, awalT = tinggiChart;
    const jepit = (x: number) => Math.min(1600, Math.max(360, x));
    const gerak = (ev: PointerEvent) => setTinggiManual(jepit(awalT + (ev.clientY - awalY)));
    const lepas = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      try { localStorage.setItem('jt.tinggiChart', String(Math.round(jepit(awalT + (ev.clientY - awalY))))); } catch { /* privat */ }
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
  }, [tinggiChart]);

  /* ── Panel ubah order tidak boleh kabur dari chart ─────────────────
     Letaknya disimpan sebagai koordinat DI DALAM area chart. Begitu
     areanya mengecil — batas tinggi chart diturunkan, jendela dikecilkan,
     watchlist dilebarkan — koordinat lama itu jatuh di luar area: panelnya
     terpotong di tepi atau melayang lepas dari grafiknya, seolah tidak
     ikut bergerak.

     Jadi letak yang DIMINTA (hasil seretan, yang diingat) disimpan apa
     adanya, sedangkan yang DIPAKAI dijepit ulang setiap ukurannya
     berubah — dengan tinggi panel yang diukur, bukan angka tebakan.
     Begitu areanya melebar lagi, panelnya kembali ke tempat pilihan
     pemiliknya sendiri; menimpa letak simpanan akan menghukum orang
     karena sempat mengecilkan chart sebentar. */
  const kotakUbah = useRef<HTMLDivElement>(null);
  const [letakPakai, setLetakPakai] = useState<{ x: number; y: number } | null>(letakUbah);

  useLayoutEffect(() => {
    if (!sunting || !panelUbah) return;
    const jepitUbah = () => {
      if (!letakUbah) { setLetakPakai(null); return; }
      const b = areaChart.current?.getBoundingClientRect();
      const k = kotakUbah.current?.getBoundingClientRect();
      if (!b || !k) return;
      const maxX = Math.max(4, b.width - k.width - 4);
      const maxY = Math.max(4, b.height - k.height - 4);
      const x = Math.max(4, Math.min(maxX, letakUbah.x));
      let y = Math.max(4, Math.min(maxY, letakUbah.y));

      /* ── Batas kedua: bagian chart yang BENAR-BENAR TERLIHAT ────────
         Muat di dalam kotak chart belum berarti terlihat. Chart ini
         setinggi 500+ px sementara jendelanya lebih pendek, jadi begitu
         halaman di-scroll, ujung atas chart naik ke luar layar — dan
         panel yang duduk di dekat ujung itu ikut hilang ke atas atau
         tertutup bilah judul yang menempel di puncak halaman (tinggi
         56 px, dan ia menang karena digambar belakangan).

         Yang terlihat itulah batas sebenarnya. Panel dijaga tetap berada
         di antara sisi bawah bilah judul dan sisi bawah layar — jadi ia
         bergeser mengikuti apa yang sedang kamu lihat, bukan mengikuti
         kotak yang sebagian sudah di luar layar. */
      const KEPALA = 56;
      const atasTampak = Math.min(maxY, Math.max(4, KEPALA + 8 - b.top));
      const bawahTampak = Math.min(maxY, window.innerHeight - b.top - k.height - 8);
      if (bawahTampak >= atasTampak) y = Math.max(atasTampak, Math.min(bawahTampak, y));

      setLetakPakai((l) => (l && l.x === x && l.y === y ? l : { x, y }));
    };
    jepitUbah();
    /* ResizeObserver menangkap perubahan yang tidak lewat state sama
       sekali: garis pembatas watchlist digeser, panel induknya melar. */
    const ro = new ResizeObserver(jepitUbah);
    if (areaChart.current) ro.observe(areaChart.current);
    window.addEventListener('resize', jepitUbah);
    /* capture: true — supaya scroll dari WADAH mana pun ikut tertangkap,
       bukan cuma scroll jendela. */
    window.addEventListener('scroll', jepitUbah, true);
    /* Jaring pengaman. Semua pemicu di atas berbasis KEJADIAN, dan
       kejadian bisa tidak sampai: scroll dengan inersia yang diredam,
       wadah yang menggulir tanpa memancarkan apa-apa, tata letak yang
       bergeser karena gambar selesai dimuat. Panel yang salah letak
       sekali lalu diam di situ adalah persis keluhannya — jadi letaknya
       diperiksa ulang lima kali sedetik selama panelnya terbuka.
       Ongkosnya dua getBoundingClientRect; setLetakPakai hanya menulis
       kalau angkanya benar-benar berubah, jadi tidak ada render sia-sia. */
    const denyut = setInterval(jepitUbah, 200);
    return () => {
      ro.disconnect();
      clearInterval(denyut);
      window.removeEventListener('resize', jepitUbah);
      window.removeEventListener('scroll', jepitUbah, true);
    };
  }, [sunting, panelUbah, letakUbah, tinggiChart]);

  /* ── Kunci remount chart ───────────────────────────────────────────
     Ganti simbol/timeframe atau tombol Segarkan MEMBANGUN ULANG komponen
     chart seutuhnya. Pernah ada keadaan chart kosong yang tidak bisa
     dipulihkan kecuali refresh halaman penuh — seri yang setengah terlepas
     di dalam lightweight-charts. Daripada memburu setiap jalur yang bisa
     meninggalkan seri yatim, remount memusnahkan seluruh kelasnya: kanvas
     baru, seri baru, nol keadaan sisa. Zoom memang ikut hilang — untuk
     simbol yang baru diganti itu justru yang diharapkan. */
  useEffect(() => {
    const durasi = DURASI_TF[tf] ?? 0;
    if (!durasi) return;
    const hitung = () => setDetik(Math.max(0, durasi - (Date.now() % durasi)) / 1000);
    hitung();
    const jam = setInterval(hitung, 1000);
    return () => clearInterval(jam);
  }, [tf]);

  function jalankan() {
    setUji(true);
    /* Beri satu bingkai supaya tombolnya sempat menampilkan keadaan sibuk.
       500 lilin selesai dalam belasan milidetik, dan tombol yang berubah
       lalu kembali dalam satu frame terlihat seperti tidak ditekan. */
    setTimeout(() => {
      setHasil(jalankanUji(lilin, set));
      setUji(false);
    }, 30);
  }

  return (
    /* Mode panel: TANPA jarak halaman. Padding 16-24 px di keempat sisi
       memakan ±10% panel seperempat layar untuk ruang kosong, dan
       pembatas grid sudah memisahkan panel satu dari yang lain.

       Halaman biasa: jaraknya dipangkas dari 16-24 px jadi SATU piksel
       atas permintaan pemilik ("99 persen menempel"). Sesudah latar
       kartunya dihilangkan, ruang kosong itu tidak lagi memisahkan apa pun
       -- yang memisahkan garis tepi kartu dan garis pembatas sidebar. Yang
       didapat: chart selebar mungkin tanpa satu pun elemen dihilangkan.

       1 px, bukan 0. Nol membuat kedua garis 1 px itu berdempet jadi satu
       pita 2 px yang terbaca sebagai garis tebal salah gambar, bukan
       sebagai dua pembatas. Satu piksel sela sudah cukup bagi mata untuk
       mengenali keduanya sebagai dua benda, dan pada layar biasa jaraknya
       praktis tidak terlihat. */
    <div className={POLOS ? '' : 'p-px'}>
      {/* ── Bilah kendali ── */}
      {/* Pembungkus ber-ref: Panel komponen fungsi tanpa forwardRef, jadi
          ref tidak bisa dipasang langsung padanya. Div ini yang dinaikkan
          ke layar penuh, dan ia memuat bilah kendali beserta grafiknya. */}
      <div ref={kartuChart}
           className={cn(layarPenuh && 'bg-zinc-950 p-1.5',
                         penuhSemu && 'fixed inset-0 z-50 overflow-y-auto')}>
      {/* Garis tepi kartu DIHILANGKAN di mode panel — permintaan pemilik.
          Di grid, tiap panel sudah punya garis pemisahnya sendiri; kartu
          bergaris di dalam kotak bergaris menghasilkan dua garis sejajar
          berjarak beberapa piksel, yang terbaca sebagai cacat penataan
          alih-alih sebagai pemisah. */}
      {/* TANPA LATAR, garis tepinya tinggal — permintaan pemilik. Latar
          kartu di halaman ini cuma satu tingkat lebih terang daripada
          halamannya, cukup untuk terbaca sebagai kotak tapi tidak cukup
          untuk memisahkan apa pun; yang benar-benar memisahkan garis
          tepinya. Menghapus latarnya membuat chart menyatu dengan
          halamannya dan yang tersisa persis pembatasnya saja. */}
      {/* SUDUT SIKU, bukan membulat — permintaan pemilik. Sudut membulat
          masuk akal saat kartunya berdiri sendiri di tengah halaman; begitu
          tepinya cuma satu piksel dari pembatas sidebar dan bilah atas,
          lengkungan itu menyisakan celah segitiga di keempat pojok, dan
          celah yang tidak simetris dengan garis lurus di sebelahnya
          terbaca sebagai salah pasang. Siku membuat keempat garis bertemu
          sebagai satu kotak utuh. */}
      <Panel className={POLOS ? 'rounded-none border-0 bg-transparent' : 'rounded-none bg-transparent'}>
        {/* `relative`: jangkar bagi panel News dan menu Indikator di HP.
            Keduanya dilepas dari tombolnya di layar kecil dan digantung
            ke bilah ini, supaya lebarnya mengikuti bilah dan tidak bisa
            keluar layar berapa pun posisi tombol pemicunya. */}
        {/* `hidden`, bukan dilepas dari pohon: ref bilahChart dipakai
            pengukur tinggi chart, dan menu News/Indikator digantung ke div
            ini. Elemen display:none ber-offsetHeight 0 — persis angka yang
            diinginkan pengukurnya. */}
        <div ref={bilahChart} className={cn('relative flex flex-wrap items-end gap-3 p-4', POLOS && kepalaSembunyi && 'hidden')}>
          <div className="static min-w-[168px] sm:relative">
            <label className="mb-1 block text-[11px] text-zinc-500">Simbol</label>
            {/* Diketik dulu, DIKOMIT belakangan.
                ──────────────────────────────────────────────────────────
                Sebelumnya tiap huruf langsung jadi simbol aktif: mengetik
                "ETHUSDT" menembakkan tujuh permintaan ke proxy, enam di
                antaranya untuk simbol yang tidak ada ("E", "ET", "ETH"…).
                Yang terlihat adalah halaman tersendat lalu grafiknya hilang
                diganti pesan galat — bukan karena pencariannya rusak, tapi
                karena setiap ketukan diperlakukan sebagai keputusan. */}
            <input value={ketik}
                   onChange={(e) => { setKetik(e.target.value); setSaranBuka(true); }}
                   onFocus={() => setSaranBuka(true)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') { komitSimbol(); setSaranBuka(false); e.currentTarget.blur(); }
                     if (e.key === 'Escape') setSaranBuka(false);
                   }}
                   onBlur={komitSimbol}
                   placeholder="BTCUSDT / XAUUSD"
                   autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                   className={cn(KELAS_ISIAN, 'angka')} />

            {saranBuka && saranSimbol.length > 0 && (
              <>
                <div className="fixed inset-0 z-30" onPointerDown={() => setSaranBuka(false)} />
                {/* inset-x-0 di HP, lebar tetap di layar lebar — sama seperti
                    panel News dan menu Indikator; jangkarnya bilah kendali. */}
                <div className="absolute inset-x-0 top-full z-40 mt-1 max-h-[min(60vh,320px)] w-auto overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-2xl sm:inset-x-auto sm:left-0 sm:w-72">
                  {saranSimbol.map((o) => (
                    <button key={o.nilai} type="button"
                      /* onPointerDown + preventDefault, BUKAN onClick.
                         Menyentuh daftar ini membuat kotak isian kehilangan
                         fokus lebih dulu, dan onBlur menjalankan komitSimbol
                         yang menutup daftarnya — kliknya tidak pernah sampai.
                         preventDefault menahan perpindahan fokus itu. */
                      onPointerDown={(e) => { e.preventDefault(); pilihSimbol(o.nilai); }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-zinc-900">
                      <span className="angka text-[12.5px] text-zinc-200">{o.label}</span>
                      <span className="ml-auto shrink-0 text-[10.5px] text-zinc-600">{o.sumber}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1 block text-[11px] text-zinc-500">Timeframe</label>
            <select value={tf} onChange={(e) => setTf(e.target.value)} className={cn(KELAS_ISIAN, 'cursor-pointer')}>
              {TF.map((x) => <option key={x.nilai} value={x.nilai}>{x.label}</option>)}
            </select>
          </div>

          <div className="flex items-end gap-3">
            <div>
              <div className="text-[11px] text-zinc-500">Harga terakhir</div>
              <div className="angka text-[19px] font-semibold leading-tight text-zinc-100">
                {terakhir ? harga(terakhir) : '—'}
              </div>
            </div>
            {terakhir && (
              <span className={cn('angka mb-1 text-[12.5px]', gerak >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {gerak >= 0 ? '+' : ''}{gerak.toFixed(2)}%
              </span>
            )}
            {simbol.startsWith('MT5:') && (
              <span className="mb-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300"
                    title="OHLC dari terminal MT5-mu, dikirim EA Trade-Fi Sync v2 tiap beberapa menit. Order REAL di simbol ini berangkat ke MT5, bukan Binance.">
                TRADE-FI · MT5
              </span>
            )}
            {/* Hitung mundurnya sekarang MENEMPEL di sisi skala harga di dalam
                chart, sejajar label harga — sama seperti TradingView. Di
                bilah atas ia jauh dari tempat mata sedang berada. */}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Status live PINDAH KE DALAM CHART di layar kecil.
                ──────────────────────────────────────────────────────────
                Di HP, bilah ini berebut ~180 px dengan empat tombol dan
                yang terlempar keluar layar adalah Replay — tombol paling
                kanan. "live · 3 dtk" adalah keterangan chart, bukan
                perintah: ia tidak perlu ruang di baris yang isinya tombol.
                Versi chart-nya ada di pojok kanan-atas grafik. */}
            <span className={cn('hidden items-center gap-1.5 text-[11px] sm:flex', memuat ? 'text-zinc-600' : 'text-emerald-500')}>
              <Radio className="size-3" /> {memuat ? 'memuat' : 'live · 3 dtk'}
            </span>
            {/* Label tombol disembunyikan di HP — ikonnya sudah dikenali,
                dan `title` tetap menjelaskan untuk yang ragu. */}
            <button onClick={() => { setSegar((n) => n + 1); setKunciChart((n) => n + 1); }}
              title="Segarkan data"
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 sm:px-2.5">
              <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
            {/* News pindah ke sini dari screener. Kalender ekonomi menjawab
                "aman tidak entry sekarang", dan pertanyaan itu muncul saat
                orang sedang menatap chart sambil menaruh SL — bukan saat
                sedang memilih koin. */}
            <PanelNews />
            {/* ── SATU menu untuk semua indikator ─────────────────────
                Dua checkbox yang berjajar akan jadi lima begitu indikator
                bertambah; menu tumbuh ke bawah, bilah kendali tidak. Skrip
                Pine yang pernah dijalankan ikut terdaftar di sini dan
                diingat — memasangnya kembali satu klik, bukan tempel-ulang. */}
            <div className="static sm:relative">
              <button onClick={() => setMenuInd((v) => !v)}
                title="Indikator"
                className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px] transition-colors sm:px-2.5',
                  menuInd ? 'border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100')}>
                <Layers className="size-3.5" />
                <span className="hidden sm:inline">Indikator</span>
                {(Number(tampilSnr) + Number(tampilSmi) + (pineInfo ? 1 : 0)) > 0 && (
                  <span className="rounded bg-zinc-800 px-1 text-[10px] text-zinc-300">
                    {Number(tampilSnr) + Number(tampilSmi) + (pineInfo ? 1 : 0)}
                  </span>
                )}
                <ChevronDown className="hidden size-3 sm:block" />
              </button>
              {menuInd && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuInd(false)} />
                  {/* Sama seperti panel News: inset-x-0 di HP supaya
                      lebarnya mengikuti bilah, right-0 w-72 di layar lebar. */}
                  <div className="absolute inset-x-0 top-full z-40 mt-1 w-auto rounded-lg border border-zinc-800 bg-zinc-950 p-1.5 shadow-2xl sm:inset-x-auto sm:right-0 sm:w-72">
                    <div className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Bawaan</div>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-900">
                      <input type="checkbox" checked={tampilSnr} onChange={(e) => setTampilSnr(e.target.checked)}
                             className="size-3.5 cursor-pointer accent-emerald-500" />
                      <span className="min-w-0">
                        <span className="block text-[12px] text-zinc-200">Zona SNR</span>
                        <span className="block truncate text-[10.5px] text-zinc-600">Support & resisten dari logika Screener Entry</span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-900">
                      <input type="checkbox" checked={tampilSmi} onChange={(e) => setTampilSmi(e.target.checked)}
                             className="size-3.5 cursor-pointer accent-emerald-500" />
                      <span className="min-w-0">
                        <span className="block text-[12px] text-zinc-200">SMI</span>
                        <span className="block truncate text-[10.5px] text-zinc-600">Panel osilator di bawah chart</span>
                      </span>
                    </label>
                    <div className="mt-1 flex items-center justify-between border-t border-zinc-800/70 px-2 pb-1 pt-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Pine Script</span>
                      <button onClick={() => bukaDock('editor')}
                        className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100">
                        + Buat / tempel
                      </button>
                    </div>
                    {(kendaliPine?.daftar ?? []).map((s) => (
                      <button key={s.id}
                        onClick={() => {
                          if (!kendaliPine) return;
                          if (s.aktif) kendaliPine.nonaktif(); else kendaliPine.jalankan(s.id);
                          setMenuInd(false);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-zinc-900">
                        <span className={cn('size-2 shrink-0 rounded-full', s.aktif ? 'bg-emerald-500' : 'border border-zinc-700')} />
                        <span className="min-w-0 grow truncate text-[12px] text-zinc-200">{s.nama}</span>
                        <span className="shrink-0 text-[10.5px] text-zinc-600">{s.aktif ? 'aktif' : 'pasang'}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* async: memakai jatah paket harus menunggu jawaban SERVER
                sebelum replaynya dibuka. Menjalankannya tanpa menunggu
                berarti replaynya mulai duluan lalu ditolak sesudahnya —
                dan yang terlihat orang adalah fitur yang menyala sebentar
                lalu mati sendiri. */}
            <button onClick={async () => {
                /* Sedang replay -> keluar. Sedang membidik -> batal.
                   Selain itu -> mulai membidik. Satu tombol, tiga keadaan
                   yang saling berurutan, jadi tidak perlu tombol kedua. */
                if (replayIdx !== null) { setReplayIdx(null); setBidikReplay(false); return; }
                /* Pengunjung preview: satu putaran, lalu tombolnya menjelaskan
                   diri sendiri alih-alih diam. Tombol mati tanpa kalimat
                   terbaca sebagai halaman rusak, bukan sebagai batas yang
                   disengaja — dan yang perlu tahu justru orang yang baru saja
                   menyukai fiturnya. */
                if (tamuPreview && jatahTerpakai('replay')) {
                  setKabarReplay('Replay di mode preview berlaku sekali. Masuk untuk memakainya sepuasnya — sesi latihanmu ikut tersimpan ke jurnal.');
                  return;
                }
                /* Jatah paket DIPAKAI SAAT MEMILIH TITIK MULAI, bukan saat
                   replaynya berjalan. Kalau dihitung tiap bar maju, satu
                   sesi latihan menghabiskan seluruh jatah bulan itu dalam
                   semenit. Satu kali tekan = satu sesi. */
                if (!tamuPreview && pengguna) {
                  const h = await pakaiKuota('replay');
                  muatPaket();
                  if (!h.boleh) { setKabarReplay(h.alasan ?? 'Jatah replay sudah habis.'); return; }
                }
                /* Konteks lain (panel multi-chart / jendela lepasan) sedang
                   me-replay: tolak DI SINI, sebelum jatah paket terpakai
                   sia-sia untuk sesi yang tidak akan dimulai. */
                if (replayDipegangLain()) {
                  setKabarReplay('Replay sedang berjalan di panel lain. Replay dibatasi satu panel bergiliran supaya tidak memberatkan — tutup dulu yang di sana.');
                  return;
                }
                setKabarReplay('');
                setBidikReplay((v) => !v);
              }}
              title={replayIdx !== null ? 'Keluar dari replay'
                : tamuPreview && jatahTerpakai('replay') ? 'Replay preview sudah terpakai — masuk untuk memakainya lagi'
                : bidikReplay ? 'Batal memilih titik mulai'
                : teksSisa(paketku, 'replay')
                  ? `Pilih titik mulai replay — ${teksSisa(paketku, 'replay')}`
                  : 'Pilih titik mulai replay — klik di chart'}
              className={cn('flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px] transition-colors sm:px-2.5',
                replayIdx !== null
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : bidikReplay
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                  : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100')}>
              <History className="size-3.5" />
              {/* Label disembunyikan di HP KECUALI saat modenya menyala.
                  Ikon jam-mundur sendirian sudah cukup untuk tombol diam,
                  tapi "sedang membidik" dan "sedang replay" adalah keadaan
                  BERBAHAYA — klik berikutnya di chart punya arti lain — dan
                  keadaan berbahaya harus tertulis, sesempit apa pun layarnya. */}
              <span className={cn(bidikReplay || replayIdx !== null ? 'inline' : 'hidden sm:inline')}>
                {bidikReplay ? 'Klik di chart…' : 'Replay'}
              </span>
              {replayIdx !== null && <span className="angka text-[10.5px]">bar {replayIdx + 1}</span>}
            </button>

            <button onClick={gantiLayarPenuh}
              title={layarPenuh ? 'Keluar dari layar penuh (Esc)' : 'Layar penuh — chart saja'}
              aria-label={layarPenuh ? 'Keluar dari layar penuh' : 'Layar penuh'}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 sm:px-2.5">
              {layarPenuh ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          </div>
        </div>

        {galat && (
          <div className="flex items-start gap-2 border-t border-zinc-800/80 px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <span className="text-[12.5px] text-amber-200/90">{galat}</span>
          </div>
        )}

        {/* Batas jatah replay — diletakkan tepat di bawah tombolnya, bukan
            sebagai popup. Yang baru saja ditekan ada di baris atas, dan
            jawabannya pantas muncul di tempat mata sudah berada. */}
        {kabarReplay && (
          <div className="flex flex-wrap items-center gap-2.5 border-t border-sky-500/20 bg-sky-500/[0.05] px-4 py-3">
            <History className="size-4 shrink-0 text-sky-300" strokeWidth={2} />
            <span className="flex-1 text-[12.5px] leading-relaxed text-sky-100/90">{kabarReplay}</span>
            <Link to="/tour"
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
              Masuk
            </Link>
            <button onClick={() => setKabarReplay('')} aria-label="Tutup"
              className="cursor-pointer px-1 text-zinc-500 transition-colors hover:text-zinc-300">✕</button>
          </div>
        )}

        {/* `relative`: jangkar hamparan kaki chart yang ada DI DALAMNYA. */}
        <div className="relative border-t border-zinc-800/80 px-2 pb-2">
          {/* relative + overflow-hidden: rumah semua hamparan chart — legend,
              alat gambar, dock Pine, dan watchlist yang meluncur dari kanan.
              Tanpa overflow-hidden, panel yang sedang tersembunyi
              (translate-x-full) melebarkan halaman. */}
          {/* Grafik dan watchlist SEJAJAR, bukan bertumpuk: kolom kiri
              menyusut saat pembatas ditarik, jadi lilin di tepi kanan
              tidak pernah tertutup daftar. */}
          <div className="flex">
          <div ref={areaChart} className="relative min-w-0 grow overflow-hidden"
               onContextMenu={POLOS ? (e) => {
                 /* Alat gambar memakai klik KIRI; klik kanan di chart tidak
                    dipakai apa pun, jadi tidak ada yang direbut di sini. */
                 e.preventDefault();
                 setMenuTf({ x: e.clientX, y: e.clientY });
               } : undefined}>
            {menuTf && (
              <div style={{ left: menuTf.x + 2, top: menuTf.y + 2 }}
                   onClick={(e) => e.stopPropagation()}
                   onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                   className="fixed z-[70] min-w-[132px] overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
                <div className="border-b border-zinc-800/80 px-2.5 pb-1.5 pt-1 text-[10.5px] text-zinc-500">
                  Timeframe
                </div>
                {TF.map((t) => (
                  <button key={t.nilai} onClick={() => { setTf(t.nilai); setMenuTf(null); }}
                    className={cn('flex w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-1.5 text-left text-[11.5px] transition-colors hover:bg-zinc-900',
                      t.nilai === tf ? 'text-emerald-400' : 'text-zinc-300')}>
                    {t.label}
                    <span className="angka text-[10px] text-zinc-600">{t.nilai}</span>
                  </button>
                ))}
              </div>
            )}
          {lilin.times.length > 0
            ? <ChartLilin key={`${simbol}|${tf}|${kunciChart}`}
                          lilin={lilinGabung} garis={garis} trade={replayIdx === null ? hasil?.trade : undefined}
                          tinggi={tinggiChart} hingga={replayIdx ?? undefined} smi={smi}
                          garisHarga={[...garisHarga, ...garisZona, ...garisOrder]}
                          /* Klik chart HANYA berlaku saat mode bidik menyala —
                              sekali, untuk menentukan titik mulai replay.
                              Sesudah itu modenya padam dan klik kembali tidak
                              berakibat apa-apa, jadi memilih garis atau
                              menaruh alat tetap aman seperti biasa. */
                          onKlikBar={bidikReplay ? ((i) => {
                            /* Dijepit ke dalam rentang data: klik di ruang
                               kosong sebelah kanan chart mengembalikan indeks
                               di luar array, dan replay yang mulai di luar
                               datanya menggambar chart kosong. Disisakan 2 bar
                               supaya selalu ada yang bisa dimajukan. */
                            const maks = lilinGabung.times.length - 2;
                            setReplayIdx(Math.max(0, Math.min(i, maks)));
                            setBidikReplay(false);
                          }) : undefined}
                          garisSeret={garisSeret}
                          onSeret={(id, h) => {
                            if (sunting) {
                              /* Acuan presisi diambil dari SL/TP yang sudah
                                 ada lebih dulu, bukan dari entry: harga entry
                                 di bursa adalah RATA-RATA fill, jadi desimalnya
                                 panjang dan bukan kelipatan tick. Harga pemicu
                                 SL/TP selalu kelipatan tick yang sah — itulah
                                 contoh yang benar untuk ditiru. */
                              const acuan = sunting.sl || sunting.tp || aksi?.hargaKini || sunting.entry || h;
                              const hb = bulatkanHarga(h, acuan);
                              if (id === 'sl') setSuntingSl(hb);
                              else if (id === 'tp') setSuntingTp(hb);
                              else if (id === 'entry') {
                                /* Sisi mana yang dimaksud ditentukan ARAH
                                   posisinya, bukan atas-bawah layar: untuk
                                   SELL, "di atas entry" justru stop. */
                                const rugi = sunting.arah === 'BUY' ? h < sunting.entry : h > sunting.entry;
                                if (rugi) setSuntingSl(hb); else setSuntingTp(hb);
                              }
                              return;
                            }
                            if (id === 'entry') entryDigeser.current = true;
                            seretTangan.current = true;
                            setRencana((r) => ({ ...r, [id]: h }));
                          }}
                          onKlikGaris={() => setPanelUbah(true)}
                          onHapusGaris={(id) => {
                            /* Dalam mode sunting, × pada salah satu garis
                               berarti "sudahi urusan order ini" — bukan
                               menghapus satu level dari rencana tiket, yang
                               memang tidak sedang digambar. */
                            if (sunting) { setSunting(null); setPanelUbah(false); setSuntingKabar(''); return; }
                            setRencana((r) => ({ ...r, [id]: undefined }));
                            if (id === 'entry') entryDigeser.current = false;
                          }}
                          segmen={pine?.segmen}
                          isianPine={pine?.isian}
                          penandaPine={pine?.penanda}
                          kotakPine={pine?.kotak}
                          alat={alat}
                          onAlatSelesai={tambahGambar}
                          gambarAlat={gambarAlat}
                          gambarPilih={gambarPilih}
                          onPilihGambar={setGambarPilih}
                          onUbahGambar={ubahGambar}
                          posisiMt5={posisiMt5Chart}
                          onUbahPosisi={simbol.startsWith('MT5:') ? ubahPosisiMt5 : undefined}
                          hargaAsk={askTampil}
                          kunciUkuran={lebarWatch}
                          mundur={DURASI_TF[tf] ? jamMundur(detik) : undefined}
                          hamparanBawah={kendaliReplay}
                          bagikanFoto={(ambil) => { ambilFoto.current = ambil; }}
                          tandaAir={tandaAir}
                          tampilan={tampilan}
                          pitaSmi={smiAsli}
                          onUjungKiri={setDiUjungKiri}
                          /* Binance memberi maksimum 1000 lilin PER
                             PERMINTAAN, bukan seluruhnya. Tombol ini menarik
                             potongan berikutnya ke belakang lalu
                             menyambungnya — ditekan tiga kali di TF harian,
                             chartnya mundur sampai 2018.

                             Muncul HANYA saat jendela pandang sudah mentok ke
                             kiri. Sebelum itu ia tidak dicari siapa pun, dan
                             tombol yang selalu ada di tepi chart menutupi
                             lilin yang justru sedang dibaca.

                             MT5 tidak punya rute untuk meminta lilin lebih
                             tua, jadi tidak ditawarkan sama sekali di sana —
                             lebih jujur daripada tombol yang selalu menjawab
                             "tidak ada". */
                          hamparanBarTertua={!diUjungKiri ? undefined : simbol.startsWith('MT5:') ? (
                            /* Trade-Fi TIDAK punya penomoran halaman: tidak
                               ada rute untuk meminta lilin lebih tua dari
                               MT5, jadi EA mengirim seluruh isi terminalnya
                               sekaligus dan tidak ada apa pun yang tersisa
                               untuk ditarik.

                               Dulu di sini tidak ada apa-apa. Diam itu yang
                               salah: orang yang menggeser mentok ke kiri di
                               Trade-Fi dan melihat kartunya lenyap membaca
                               itu sebagai fitur yang rusak, bukan sebagai
                               batas yang memang tidak ada. Alasannya sama
                               dengan kartu berbayar yang berbunyi alih-alih
                               jadi tombol mati. */
                            <p className="max-w-[13rem] rounded-lg border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-center text-[10.5px] leading-snug text-zinc-500 shadow-xl">
                              Trade-Fi mengirim seluruh riwayat yang ada di terminalmu sekaligus — tidak ada lilin lebih tua yang bisa ditarik.
                            </p>
                          ) : (
                            habisRiwayat ? (
                              <span className="rounded border border-zinc-800 bg-zinc-950/90 px-2 py-1 text-[10.5px] leading-none text-zinc-600 shadow">
                                riwayat terjauh
                              </span>
                            ) : tolakRiwayat ? (
                              /* Jatah habis MENURUT SERVER, bukan menurut
                                 hitungan browser. Kartunya berubah jadi
                                 ajakan, bukan tombol mati: tombol mati tanpa
                                 penjelasan terbaca sebagai kerusakan; kartu
                                 yang menyebut alasannya terbaca sebagai
                                 batas yang disengaja. */
                              <div className="w-44 rounded-lg border border-zinc-800 bg-zinc-950/95 p-3 text-center shadow-xl">
                                <History className="mx-auto size-5 text-amber-400/90" strokeWidth={1.75} />
                                <p className="mt-1.5 text-[11.5px] font-medium leading-snug text-zinc-200">
                                  Butuh riwayat lebih panjang?
                                </p>
                                <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                                  {tolakRiwayat} Akses berbayar membuka riwayat tanpa batas.
                                </p>
                                <Link to="/harga"
                                  className="mt-2 block cursor-pointer rounded-md bg-emerald-600 px-2 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500">
                                  Lihat paket
                                </Link>
                              </div>
                            ) : (
                              /* Kartu, bukan tombol telanjang -- meniru pola
                                 kartu riwayat TradingView: ikon, tombol
                                 utama, dan keterangan sisa jatah untuk yang
                                 gratis. */
                              <div className="w-44 rounded-lg border border-zinc-800 bg-zinc-950/95 p-3 text-center shadow-xl">
                                <History className="mx-auto size-5 text-zinc-400" strokeWidth={1.75} />
                                <p className="mt-1.5 text-[11.5px] font-medium leading-snug text-zinc-200">
                                  Riwayat lebih lama
                                </p>
                                <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                                  Tarik 1000 lilin sebelum yang paling tua.
                                </p>
                                <button
                                  onClick={() => void muatLebihLama()}
                                  disabled={muatLama}
                                  className="mt-2 w-full cursor-pointer rounded-md bg-emerald-600 px-2 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
                                  {muatLama ? 'Memuat\u2026' : 'Muat lebih lama'}
                                </button>
                                {/* Angka dari server, dan hanya kalau paketnya
                                    memang punya batas. Pratinjau dan paket
                                    berbayar memulangkan -1 = tanpa batas, dan
                                    menempelkan "sisa" pada sesuatu yang tak
                                    terbatas cuma membuat orang mengira ada
                                    hitungan yang sedang berjalan. */}
                                {paketku.batas.riwayat >= 0 && (
                                  <p className="mt-1.5 text-[9.5px] text-zinc-600">
                                    {teksSisa(paketku, 'riwayat') || `sisa ${paketku.sisa.riwayat} dari ${paketku.batas.riwayat}`}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                          pojok={aksi ? (
                            <div ref={pojokRef}>
                            <PojokOrder
                              posisi={aksi.posisi} hargaKini={aksi.hargaKini}
                              draf={draf} rencana={rencana} mode={aksi.mode}
                              jenis={labelJenis} risiko={aksi.risiko} qtyDemo={qtyTampil}
                              tunda={aksiTunda} onBatalTunda={aksi.batalTunda}
                              onGantiMode={(m, sebab) => {
                                aksi.gantiMode(m);
                                setKabarNyata('');
                                /* Pindah ke LATIHAN membersihkan garisnya.
                                   Level order sungguhan yang tertinggal di
                                   mode demo akan terbaca sebagai rencana
                                   latihan — dan menggesernya di sana tidak
                                   mengubah apa pun di bursa.

                                   KECUALI kalau 'demo' ini cuma persinggahan
                                   menuju COPY. Di situ orangnya sedang
                                   mengubah rencananya jadi sinyal untuk
                                   diposting, dan levelnya justru yang ia
                                   bawa — membuangnya memaksa ia menggambar
                                   ulang angka yang sama. */
                                if (m === 'demo' && sebab !== 'menuju-copy') {
                                  setRencana({});
                                  setDraf(null);
                                  entryDigeser.current = false;
                                }
                              }}
                              onPilih={(arah) => {
                                setDraf(arah);
                                setKabarNyata('');
                                /* COPY DARI TAUTAN dimatikan di sini, COPY YANG
                                   DIPILIH SENDIRI TIDAK.
                                   ────────────────────────────────────────────
                                   Dulu `dariSinyal` cuma berarti satu hal:
                                   level ini datang dari analisa orang lain.
                                   Memilih arah sendiri membuat penanda itu
                                   berbohong, jadi ia dimatikan — benar.

                                   Sejak lencananya jadi pemutar tiga mode,
                                   COPY juga berarti "aku sedang menyusun
                                   sinyal". Mematikannya saat orangnya menekan
                                   BUY/SELL berarti mode yang baru saja ia
                                   pilih lompat balik ke DEMO pada klik
                                   pertama — mode yang tidak bisa dipakai. */
                                if (!copyManual.current) setDariSinyal(false);
                                seretTangan.current = false;
                                /* Level yang SUDAH dipasang orangnya dipertahankan
                                   selama masih benar sisinya untuk arah ini.
                                   Menimpanya dengan usulan ATR akan membuang
                                   angka dari kartu screener yang baru saja
                                   diklik — dan itu justru alasan halaman ini
                                   dibuka. */
                                const e = rencana.entry ?? aksi.hargaKini;
                                const sisiBenar = e && rencana.sl && rencana.tp
                                  && (arah === 'BUY'
                                    ? rencana.sl < e && rencana.tp > e
                                    : rencana.sl > e && rencana.tp < e);
                                /* jangkarQty DIPANGGIL LANGSUNG di kedua
                                   cabang, bukan diserahkan ke efek. Efeknya
                                   memang ikut jalan, tapi ia menulis ref —
                                   tanpa render ulang — jadi tiket yang baru
                                   terbuka sempat menampilkan dolar dari
                                   cadangan −$10 mati sampai ada state lain
                                   yang berubah. Jangkar yang dipasang di
                                   sini ikut ter-render bersama rencananya. */
                                if (sisiBenar) {
                                  setRencana((r) => ({ ...r, entry: e }));
                                  jangkarQty(e, rencana.sl, aksi.risiko);
                                  return;
                                }
                                const u = aksi.usul(arah);
                                if (u) {
                                  setRencana({ entry: u.entry, sl: u.sl || undefined, tp: u.tp || undefined });
                                  jangkarQty(u.entry, u.sl, aksi.risiko);
                                }
                              }}
                              onTukarArah={() => {
                                /* MEMBALIK, BUKAN MENYUSUN ULANG.
                                   ──────────────────────────────────────────
                                   SL dan TP bertukar tempat apa adanya. Itu
                                   yang diminta, dan visualnya memang persis
                                   itu: garis SL pindah ke tempat garis TP,
                                   dan sebaliknya — sehingga sisinya langsung
                                   benar untuk arah yang baru.

                                   Levelnya dipertahankan, bukan dihitung
                                   ulang dari ATR, karena dua garis itu
                                   biasanya duduk di support/resisten
                                   sungguhan yang barusan dipilih orangnya.
                                   Menimpanya dengan usulan otomatis membuang
                                   pekerjaan yang justru membuat orang datang
                                   ke chart.

                                   YANG BERUBAH DAN PERLU DILIHAT: R:R ikut
                                   terbalik. Rencana 1:2 jadi 2:1, karena
                                   jarak yang tadinya risiko sekarang jadi
                                   imbalan. Angkanya tertulis di tiket, jadi
                                   perubahannya terlihat saat itu juga. */
                                const baru = draf === 'BUY' ? 'SELL' : 'BUY';
                                setDraf(baru);
                                setKabarNyata('');
                                setRencana((r) => {
                                  if (!r.sl || !r.tp) return r;
                                  const tukar = { ...r, sl: r.tp, tp: r.sl };
                                  /* Jangkar ukuran ikut dihitung ulang: jarak
                                     risikonya berubah, dan qty yang tidak ikut
                                     berubah berarti dolar risiko di tiket
                                     berbohong. */
                                  if (tukar.entry) jangkarQty(tukar.entry, tukar.sl, aksi.risiko);
                                  return tukar;
                                });
                              }}
                              onUbah={(r) => {
                                /* Entry yang DIKETIK sama sengajanya dengan
                                   yang diseret — dua-duanya keputusan, dan
                                   penyusul harga otomatis harus berhenti
                                   menimpanya. */
                                if (r.entry !== rencana.entry) entryDigeser.current = true;
                                setRencana(r);
                              }}
                              onBatal={() => {
                                /* Batal berarti BATAL SEUTUHNYA: tiket ditutup
                                   DAN garisnya ikut hilang. Garis order dari
                                   tiket yang sudah dibatalkan terbaca sebagai
                                   order yang masih hidup — dan tampak seperti
                                   coretan putih misterius memotong chart. */
                                setDraf(null); setKabarNyata('');
                                setRencana({});
                                entryDigeser.current = false;
                                seretTangan.current = false;
                                /* Jangkar ikut dilepas: tiket berikutnya
                                   harus menghitung ukurannya sendiri, bukan
                                   mewarisi ukuran rencana yang dibatalkan. */
                                qtyDemo.current = 0; setQtyTampil(0);
                              }}
                              onKirim={() => {
                                const { entry, sl, tp } = rencana;
                                if (!draf || !entry || !sl || !tp) return;
                                if (aksi.mode === 'real') {
                                  if (simbol.startsWith('MT5:')) {
                                    /* Jalur TRADE-FI: perintah masuk antrean
                                       server, EA v2 di terminal MT5 yang
                                       mengeksekusi, lalu nasibnya dijajaki
                                       sampai EA melapor. Sementara MARKET
                                       saja — pending order MT5 menyusul. */
                                    if (!(lotMt5 > 0)) { setKabarNyata('Isi lot dulu.'); return; }
                                    /* Pending order didukung sejak EA v2.04:
                                       entry yang jauh dari harga pasar menjadi
                                       Buy/Sell Stop atau Limit. JENISNYA
                                       diputuskan EA, bukan di sini — terminal
                                       yang tahu harga pasar pada detik
                                       eksekusi; layar ini datanya sudah
                                       beberapa detik umurnya. Yang dikirim
                                       niatnya: harga entry. */
                                    const entryKirim = jenisEntry === 'MARKET' ? 0 : entry;
                                    if (!confirm(`Kirim ke MT5:\n${labelJenis} ${draf} ${lotMt5} lot ${simbol.slice(4)}`
                                      + `${entryKirim ? `\nEntry ${entryKirim}` : ' (harga pasar)'}`
                                      + `\nSL ${sl}  ·  TP ${tp}\n\nEA & AutoTrading harus menyala.`)) return;
                                    setSibukNyata(true);
                                    setKabarNyata('Mengirim perintah ke EA…');
                                    void kirimPerintahMt5({ aksi: 'BUKA', simbol: simbol.slice(4), arah: draf, lot: lotMt5, sl, tp, entry: entryKirim })
                                      .then(async ({ id }) => {
                                        setKabarNyata('Perintah antre — EA menjemput tiap 5 detik…');
                                        const h = await tungguHasilMt5(id);
                                        setKabarNyata(
                                          h.status === 'sukses' ? `Terbuka di MT5 — ${h.pesan}`
                                          : h.status === 'gagal' ? `EA menolak: ${h.pesan}`
                                          : h.status === 'kedaluwarsa' ? 'Perintah kedaluwarsa — EA tidak menjemput dalam 5 menit.'
                                          : h.pesan);
                                        /* Rencana TIDAK dibuang: mode real
                                           akan menampilkan garis posisi
                                           broker menggantikannya, dan mode
                                           demo bisa memakai level yang sama
                                           lagi. */
                                        if (h.status === 'sukses') {
                                          /* BACA-ULANG SEGERA. Ini yang dulu
                                             hilang: dua jalur lain (ubah SL/TP
                                             dan tutup posisi) memanggilnya,
                                             jalur BUKA tidak — jadi panel
                                             Order Terbuka Trade-Fi baru
                                             memperlihatkan posisinya saat
                                             putaran 30 detik berikutnya
                                             kebetulan lewat. Layar bilang
                                             "Terbuka di MT5" sementara
                                             tabelnya masih kosong, dan jeda
                                             itu terbaca sebagai ordernya
                                             tidak masuk. */
                                          segarkanAkunMt5();
                                          setDraf(null);
                                        }
                                      })
                                      .catch((e) => setKabarNyata(e instanceof Error ? e.message : 'Gagal mengirim perintah'))
                                      .finally(() => setSibukNyata(false));
                                    return;
                                  }
                                  /* Konfirmasi berisi angka ada DI DALAM
                                     kirimOrderNyata — jalur yang sama persis
                                     dengan Area Entry V2, termasuk pengaman
                                     simbol tanpa STOP_MARKET. */
                                  setSibukNyata(true); setKabarNyata('');
                                  void kirimOrderNyata({
                                    simbol, tf, arah: draf,
                                    modal: nyataSetelan.modal, leverage: nyataSetelan.leverage,
                                    entry: jenisEntry === 'MARKET' ? (aksi.hargaKini ?? entry) : entry,
                                    jenis: jenisEntry, sl, tp, metode: nyataSetelan.metode,
                                    emosi: catatanTiket.emosi, alasan: catatanTiket.alasan,
                                  }).then((h) => {
                                    setKabarNyata(h.pesan);
                                    /* Garis entry/SL/TP TETAP TERPASANG setelah
                                       order sungguhan berangkat — sama seperti
                                       jalur MT5 di atas. Sebelumnya `rencana`
                                       dikosongkan, jadi begitu order kripto
                                       terkirim chartnya polos: level yang
                                       sedang menjaga uang justru hilang dari
                                       layar tepat saat ia mulai berlaku.
                                       Yang ditutup cuma tiketnya. */
                                    if (h.pesan !== 'Dibatalkan.') setDraf(null);
                                  }).catch((e) => {
                                    setKabarNyata(e instanceof Error ? e.message : 'Gagal mengirim order');
                                  }).finally(() => setSibukNyata(false));
                                  return;
                                }
                                aksi.kirim(draf, { entry, sl, tp }, jenisEntry, catatanTiket, qtyDemo.current || undefined);
                                setDraf(null);
                              }}
                              nyataSetelan={nyataSetelan} aturNyata={setNyataSetelan}
                              mt5={simbol.startsWith('MT5:')} lotMt5={lotMt5} aturLotMt5={setLotMt5}
                              nilaiLotMt5={nilaiLotMt5} desimalHarga={desimalHarga}
                              demoSetelan={demoSetelan} aturDemo={setDemoSetelan}
                              catatan={catatanTiket} aturCatatan={setCatatanTiket}
                              sibukNyata={sibukNyata} kabar={kabarNyata || undefined}
                              onTutup={aksi.tutup} mati={aksi.mati}
                              onKirimSinyal={kirimKeCopySignal}
                              kabarSinyal={kabarKirimSinyal || undefined}
                              dariSinyal={dariSinyal}
                              onGantiCopy={(v) => { copyManual.current = v; setDariSinyal(v); }} />
                            </div>
                          ) : undefined} />
            : <div className="flex h-[440px] flex-col items-center justify-center gap-1.5 px-6 text-center text-[12.5px] text-zinc-600">
                {memuat ? 'Memuat lilin…'
                  /* Kosong pada simbol Trade-Fi di timeframe yang belum
                     dikirim EA punya SEBAB yang diketahui — dan sebab yang
                     diketahui tidak boleh disampaikan sebagai "tidak ada
                     data", kalimat yang membuat orang mengira simbolnya
                     rusak lalu mencari-cari di tempat yang salah. */
                  : simbol.startsWith('MT5:') && !TF_MT5.includes(tf) ? (
                    <>
                      <span className="text-zinc-400">
                        Timeframe {TF.find((x) => x.nilai === tf)?.label ?? tf} belum dikirim EA Trade-Fi.
                      </span>
                      <span className="max-w-sm leading-relaxed">
                        EA yang terpasang mengirim {TF_MT5.join(', ')}. Untuk kripto Binance,
                        timeframe ini sudah bisa dipakai sekarang — pilih simbol non-MT5,
                        atau perbarui EA-nya dari Marketplace.
                      </span>
                    </>
                  ) : 'Tidak ada data untuk simbol ini.'}
              </div>}

          {/* ── Bilah SUNTING order ────────────────────────────────
              Muncul hanya saat sebuah order dipilih dari panel Posisi
              Terbuka. Ditaruh di dasar chart, bukan melayang di tengah:
              yang sedang dibaca orangnya adalah garis-garisnya, dan
              bilah yang menutupi harga justru menghalangi keputusan yang
              sedang diambil. */}
          {/* ── Panel ubah order — hamparan yang BISA DIPINDAH ────────
              Bawaannya duduk di kanan panel order; begitu diseret, letak
              pilihannya diingat. Alasannya sama dengan bilah alat: tidak
              ada satu sudut yang benar untuk semua susunan panel. */}
          {/* Ikut syarat mode yang sama dengan garisnya. Panel ubah SL/TP
              yang tertinggal setelah garisnya hilang menawarkan tombol
              Kirim untuk order yang tidak terlihat di mana pun — dan itu
              cara paling mudah mengirim perubahan ke order yang salah. */}
          {sunting && panelUbah && aksi?.mode === 'real' && (
            <div ref={kotakUbah} onPointerDown={mulaiSeretUbah}
                 style={letakPakai ? { left: letakPakai.x, top: letakPakai.y } : undefined}
                 /* z-20, setara bilah alat gambar — bilah judul halaman
                    ber-z-30, dan panel yang bisa menimpanya akan menutupi
                    navigasi. */
                 className={cn('absolute z-20 cursor-move touch-none', !letakPakai && 'bottom-2 right-2')}>
              {/* Tanpa bingkai dan latar — ia bagian dari chart, bukan
                  kartu yang menumpang di atasnya. */}
              <div className="w-[210px] shrink-0 text-[11.5px]">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-zinc-200">{sunting.simbol}</span>
                                <span className={cn('text-[10.5px]', sunting.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                                  {sunting.arah}
                                </span>
                                <span className="text-[10px] text-zinc-500">
                                  {sunting.jenis === 'pending' ? 'pending' : 'posisi'} · {sunting.pasar === 'mt5' ? 'Trade-Fi' : 'Binance'}
                                </span>
                              </div>
                              {pnlSunting !== null && (
                                <div className="mt-0.5 text-[10.5px] text-zinc-500">
                                  P/L berjalan{' '}
                                  <span className={cn('angka', pnlSunting >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                                    {uang(pnlSunting, true)}
                                  </span>
                                </div>
                              )}
                              {/* Klik kolomnya = garisnya langsung muncul di
                                  harga sekarang, siap diseret. Sebelumnya
                                  order tanpa SL sama sekali tidak punya garis
                                  untuk dipegang, jadi satu-satunya cara
                                  memasangnya adalah mengetik angkanya dari
                                  nol — padahal justru order tanpa SL yang
                                  paling perlu cepat dipasangi. */}
                              {([['SL', suntingSlTeks, setSuntingSlTeks, 'text-red-400/90'],
                                 ['TP', suntingTpTeks, setSuntingTpTeks, 'text-emerald-500/90']] as const).map(([nama, nilai, atur, warna]) => (
                                <label key={nama} className="mt-1 flex items-center gap-1.5">
                                  <span className={cn('w-5 text-[10.5px]', warna)}>{nama}</span>
                                  <input
                                    value={nilai}
                                    inputMode="decimal"
                                    placeholder="klik lalu seret garisnya"
                                    onFocus={() => { if (!nilai && aksi?.hargaKini) atur(String(aksi.hargaKini)); }}
                                    onChange={(e) => atur(e.target.value.replace(/[^\d.,-]/g, '').replace(',', '.'))}
                                    className="angka h-6 min-w-0 grow rounded border border-zinc-800 bg-zinc-900/80 px-1.5 text-right text-[11px] text-zinc-200 outline-none placeholder:text-[9.5px] placeholder:text-zinc-700 focus-visible:border-zinc-600" />
                                </label>
                              ))}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                <button onClick={() => void kirimSunting()} disabled={suntingSibuk}
                                  className="flex cursor-pointer items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-[10.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
                                  {suntingSibuk ? <Loader2 className="size-3 animate-spin" /> : null}
                                  Kirim
                                </button>
                                <button onClick={() => void akhiriOrder()} disabled={suntingSibuk}
                                  className="cursor-pointer rounded px-2 py-1 text-[10.5px] text-red-400/90 transition-colors hover:bg-red-500/10 disabled:opacity-50">
                                  {sunting.jenis === 'pending' ? 'Hapus order' : 'Tutup posisi'}
                                </button>
                                {/* Menutup PANELNYA saja — garis ordernya
                                    tetap di chart, jadi tinggal diklik lagi
                                    kalau berubah pikiran. Untuk melepas
                                    garisnya, pakai tanda × di ujung garis. */}
                                <button onClick={tutupPanelUbah}
                                  className="cursor-pointer rounded px-2 py-1 text-[10.5px] text-zinc-500 transition-colors hover:text-zinc-300">
                                  Tutup panel
                                </button>
                              </div>
                              {suntingKabar && (
                                <div className="mt-1 text-[10px] leading-relaxed text-zinc-400">{suntingKabar}</div>
                              )}
                            </div>
            </div>
          )}

          {/* ── Legend indikator ala TradingView — pojok kiri-atas ────
              Nama yang terpasang tertulis DI chartnya, dengan ikon setelan
              dan kode di sebelahnya. Indikator tanpa nama di layar adalah
              garis misterius; indikator yang bernama adalah alat. */}
          {/* right-24, bukan right-16: tombol × di ujung nama indikator
              dulu nyaris menempel pita harga di sumbu kanan, dan dua hal
              yang bisa diklik sedekat itu bikin salah tekan.

              DI HP seluruh kolom ini turun ke KANAN-BAWAH, dan status live
              ikut masuk ke dalamnya. Alasannya diukur, bukan dikira: di
              layar 375 px tiket order melebar sampai ~328 px dari kiri dan
              tingginya 220 px, jadi seluruh paruh ATAS chart adalah
              miliknya — apa pun yang ditaruh di sana tertimpa, termasuk
              nama indikator (keluhan aslinya) dan badge live di percobaan
              pertama perbaikan ini.

              Kanan-bawah satu-satunya sudut yang benar-benar bebas: tiket
              di kiri-atas, bilah alat di kiri-tengah, sumbu harga di tepi
              kanan. right-16 menjaga jarak dari sumbu itu. */}
          <div className="pointer-events-none absolute bottom-2 right-16 z-20 flex flex-col items-end gap-1 sm:bottom-auto sm:right-24 sm:top-2">
            {/* Status live — HP saja; di layar lebar ia tetap di bilah
                kendali, yang di sana memang muat. */}
            <div className={cn('flex items-center gap-1 rounded bg-zinc-950/70 px-1.5 py-0.5 text-[10px] backdrop-blur-sm sm:hidden',
              memuat ? 'text-zinc-500' : 'text-emerald-500')}>
              <Radio className="size-2.5" /> {memuat ? 'memuat' : 'live · 3 dtk'}
            </div>
            {pineInfo && (
              /* Tanpa latar: nama indikator adalah KETERANGAN chart, bukan
                     kartu tersendiri. Kotak gelap di atas lilin justru menutup
                     data yang sedang dibaca. */
              <div className="pointer-events-auto flex items-center gap-1 px-1 py-0.5">
                <span className="max-w-[200px] truncate text-[11px] text-zinc-200" title={pineInfo.nama}>{pineInfo.nama}</span>
                {pineInfo.adaInput && (
                  <button onClick={() => bukaDock('input')} title="Setelan input"
                    className="cursor-pointer rounded p-0.5 text-zinc-500 transition-colors hover:text-zinc-100">
                    <Settings2 className="size-3" />
                  </button>
                )}
                <button onClick={() => bukaDock('editor')} title="Buka kodenya"
                  className="cursor-pointer rounded p-0.5 text-zinc-500 transition-colors hover:text-zinc-100">
                  <Code2 className="size-3" />
                </button>
                <button onClick={() => kendaliPine?.nonaktif()} title="Lepas dari chart"
                  className="cursor-pointer rounded p-0.5 text-zinc-500 transition-colors hover:text-red-400">
                  <X className="size-3" />
                </button>
              </div>
            )}
            {tampilSnr && (
              <div className="pointer-events-auto flex items-center gap-1 px-1 py-0.5">
                <span className="text-[11px] text-zinc-300">Zona SNR</span>
                <button onClick={() => setTampilSnr(false)} title="Sembunyikan"
                  className="cursor-pointer rounded p-0.5 text-zinc-500 transition-colors hover:text-red-400">
                  <X className="size-3" />
                </button>
              </div>
            )}
            {tampilSmi && (
              <div className="pointer-events-auto flex items-center gap-1 px-1 py-0.5">
                <span className="text-[11px] text-zinc-300">SMI</span>
                <button onClick={() => setTampilSmi(false)} title="Sembunyikan"
                  className="cursor-pointer rounded p-0.5 text-zinc-500 transition-colors hover:text-red-400">
                  <X className="size-3" />
                </button>
              </div>
            )}
          </div>

          {/* ── Alat gambar — bilah TEGAK di sisi kiri chart ─────────
              Tegak seperti TradingView: itu bentuk yang sudah dikenali
              tangan, dan tinggi chart selalu lebih longgar daripada
              lebarnya — bilah mendatar memakan lebar yang justru dipakai
              membaca lilin.

              Bentrokan lama dengan panel order (keduanya dulu di pojok
              kiri atas) sudah tidak berlaku: bilahnya duduk di kiri-TENGAH
              dan tetap bisa diseret ke mana saja.

              Klik gambar (mode kursor) untuk memilihnya, Delete untuk
              menghapus; penghapus menghapus yang terpilih dulu, semuanya
              kalau tidak ada yang terpilih. */}
          {/* `gayaAlat`: posisi + geseran menghindar tiket order, digabung.
              -translate-y-1/2 pindah dari kelas ke gaya inline karena
              transform inline mengalahkan kelas Tailwind — dua-duanya
              tidak bisa hidup berdampingan, dan yang kalah jadi hilang
              tanpa suara. */}
          {alatTutup ? (
            <button onClick={() => aturAlatTutup(false)} title="Buka bilah alat gambar"
              ref={(el) => { alatRef.current = el; }}
              onPointerEnter={bangunkanAlat}
              style={gayaAlat}
              className={cn('absolute z-20 flex size-7 cursor-pointer items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-950/85 text-zinc-500 backdrop-blur-sm transition-[color,transform] duration-300 hover:text-zinc-200',
                !letakAlat && 'left-2 top-1/2')}>
              <Ruler className="size-3.5" />
            </button>
          ) : (
          <div onPointerDown={(e) => { bangunkanAlat(); mulaiSeretAlat(e); }}
               onPointerEnter={bangunkanAlat}
               ref={(el) => { alatRef.current = el; }}
               style={gayaAlat}
               className={cn('absolute z-20 flex cursor-move touch-none flex-col items-center gap-0.5 rounded-lg border border-zinc-800/80 bg-zinc-950/85 p-1 backdrop-blur-sm transition-transform duration-300',
                 !letakAlat && 'left-2 top-1/2')}>
            {/* Pegangan seret di ujung ATAS — memberi tahu bilahnya bisa
                dipindah tanpa perlu dicoba dulu. GripHorizontal, bukan
                Vertical: titik-titiknya harus melintang terhadap arah
                bilahnya supaya terbaca sebagai pegangan, bukan sebagai
                tombol keempat yang kebetulan bergaris. */}
            <GripHorizontal className="size-3.5 shrink-0 text-zinc-700" />
            {([
              ['garis', TrendingUp, 'Garis tren — tarik dari titik ke titik', ''],
              ['ukur', Ruler, 'Ukur % kenaikan / penurunan — klik lalu tarik', ''],
              ['fib', Rows3, 'Fibonacci retracement — tarik dari swing ke swing', ''],
              ['kotak', Square, 'Kotak SNR manual — tarik membentuk zonanya', ''],
              /* Dua tombol, satu alat. Arahnya harus ditentukan SEBELUM
                 ditempel — kalau tidak, sekali klik tidak cukup untuk tahu
                 mana target dan mana stop.

                 Ikonnya kotak berpanah: bentuk alatnya sendiri, plus arah
                 yang dituju. Diberi warna karena dua tombol bersebelahan
                 yang bentuknya nyaris sama dibedakan mata lewat warna dulu,
                 baru arah panahnya — dan hijau/merah di sini bukan hiasan,
                 itu warna yang persis akan muncul di chart. */
              ['posisiBeli', SquareArrowUp, 'Posisi BELI — klik sekali di chart, kotak SL/TP langsung tertempel', 'text-emerald-500'],
              ['posisiJual', SquareArrowDown, 'Posisi JUAL — klik sekali di chart, kotak SL/TP langsung tertempel', 'text-red-400'],
            ] as const).map(([j, Ikon, judul, warna]) => (
              <button key={j} onClick={() => setAlat(alat === j ? null : j)} title={judul}
                className={cn('flex size-7 cursor-pointer items-center justify-center rounded transition-colors',
                  alat === j ? 'bg-zinc-100 text-zinc-950'
                    : cn(warna || 'text-zinc-400', 'hover:bg-zinc-800 hover:text-zinc-100'))}>
                <Ikon className="size-3.5" />
              </button>
            ))}
            <button
              onClick={() => {
                if (gambarPilih) {
                  setGambarAlat((d) => {
                    const b = d.filter((g) => g.id !== gambarPilih);
                    try { localStorage.setItem(`jt.alat.${simbol}|${tf}`, JSON.stringify(b)); } catch { /* privat */ }
                    return b;
                  });
                  setGambarPilih(null);
                  return;
                }
                if (!gambarAlat.length) return;
                if (!confirm(`Hapus ${gambarAlat.length} gambar di ${simbol} ${tf}?`)) return;
                setGambarAlat([]);
                try { localStorage.setItem(`jt.alat.${simbol}|${tf}`, '[]'); } catch { /* privat */ }
              }}
              disabled={!gambarAlat.length && !gambarPilih}
              title={gambarPilih ? 'Hapus gambar terpilih (Delete)' : 'Hapus semua gambar di simbol & timeframe ini'}
              className="flex size-7 cursor-pointer items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-35">
              <Eraser className="size-3.5" />
            </button>
            <button onClick={() => aturAlatTutup(true)} title="Lipat bilah alat"
              className="flex size-7 cursor-pointer items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300">
              <Minus className="size-3.5" />
            </button>
          </div>
          )}

          {/* Dock Pine & watchlist SELALU terpasang (autorun skrip aktif dan
              harga watchlist hidup di dalamnya); yang berganti hanya
              geserannya. */}
          <DockPine buka={dockBuka} tab={dockTab} aturTab={setDockTab}
                    onTutup={() => setDockBuka(false)}
                    lilin={lilinGabung} simbol={simbol} tf={tf} hingga={replayIdx ?? undefined}
                    aturHasil={setPine} onInfo={setPineInfo} onKendali={setKendaliPine} />
          </div>
          {/* Watchlist beserta garis pembatasnya ditiadakan di panel BIASA:
              di lebar seperempat layar ia memakan ruang chart yang justru
              jadi alasan panel itu ada. Tetap hidup di panel UTAMA — dari
              sanalah pasangan dikirim ke panel lain lewat klik kanan, jadi
              satu watchlist melayani seluruh grid. */}
          {(!POLOS || UTAMA) && (
            <WatchChart simbol={simbol} onPilih={setSimbol} onLebar={setLebarWatch} />
          )}
          </div>
          {/* Pegangan tinggi chart: diseret = diatur, dilepas = dikunci dan
              diingat sebagai bawaan, klik dua kali = kembali otomatis. */}
          {/* Pegangan seret tinggi tidak ada gunanya di mode panel: tinggi
              chart di sana dihitung otomatis dari ruang yang tersedia, dan
              angka manual justru mengembalikan pemotongan yang baru saja
              dihilangkan. */}
          {!POLOS && (
            <div onPointerDown={mulaiSeretTinggi}
                 onDoubleClick={() => { setTinggiManual(null); try { localStorage.removeItem('jt.tinggiChart'); } catch { /* privat */ } }}
                 title="Seret untuk mengatur tinggi chart — dilepas, ukurannya diingat. Klik dua kali: kembali otomatis."
                 className="group flex h-3 w-full cursor-ns-resize touch-none items-center justify-center">
              <div className="h-[3px] w-16 rounded-full bg-zinc-800 transition-colors group-hover:bg-zinc-500" />
            </div>
          )}
          {/* MENGAMBANG DI DASAR CHART, bukan baris tersendiri — permintaan
              pemilik. Dilepas dari aliran, jadi satu baris hilang dari tinggi
              halaman dan ikonnya masuk ke dalam bingkai chart.

              pointer-events-none di wadahnya, auto di tiap kendali: pegangan
              seret tinggi ada TEPAT di bawah baris ini, dan wadah yang
              menangkap klik akan mematikannya di sepanjang lebar chart demi
              tiga tombol kecil. Yang menangkap hanya tombolnya sendiri.

              Ketiganya diberi latar gelap tembus pandang: mereka kini duduk di
              atas lilin, dan teks tanpa latar di atas lilin merah-hijau
              berubah keterbacaannya tiap kali harga bergerak. */}
          {/* z-25: DI ATAS bilah alat gambar (z-20), DI BAWAH dock Pine
              (z-30). Angkanya bukan selera — hamparan ini membuat KONTEKS
              TUMPUKAN sendiri, jadi panel setelan di dalamnya (z-40) tidak
              pernah bisa melampaui apa pun yang wadahnya sendiri kalahkan.

              Sempat z-10, dan bilah alat menembus panel setelan yang sedang
              terbuka: ikon pensil melayang di atas kotak warna. Sempat pula
              z-30, yang menyamakannya dengan dock Pine — dan panel yang
              menutupi separuh chart pantas berada di atas tiga ikon kecil
              di dasarnya, bukan sebaliknya. */}
          <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 z-[25] flex items-center gap-3 px-4 py-2 text-[11.5px] text-zinc-600',
            POLOS && 'hidden')}>
            {/* Gerigi duduk di pojok paling kiri kaki chart, TANPA teks. Ia
                setelan yang dibuka sesekali lalu ditutup; label tetap di sana
                menuntut perhatian setiap kali mata menyapu kaki chart, padahal
                yang dibaca di baris ini adalah jumlah lilin dan sumbernya. */}
            <div className="pointer-events-auto relative shrink-0">
              <button
                onClick={bukaTutupTampilan}
                title="Setelan tampilan chart"
                aria-label="Setelan tampilan chart"
                className={cn('flex cursor-pointer items-center rounded p-1 transition-colors',
                  menuTampilan ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300')}>
                <Settings className="size-3.5" strokeWidth={2} />
              </button>
              {menuTampilan && (
                <>
                  <div className="fixed inset-0 z-30" onClick={batalTampilan} />
                  {/* Terbuka ke ATAS dan ke KANAN. Tombolnya di pojok kiri
                      bawah: panel yang terbuka ke bawah atau ke kiri dari sana
                      keluar layar. */}
                  <div className="absolute bottom-full left-0 z-40 mb-1 w-72 rounded-lg border border-zinc-800 bg-zinc-950 p-1.5 text-left shadow-2xl">
                    <div className="px-2 pb-1 pt-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Lilin</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 px-2 pb-1.5">
                      {MEDAN_WARNA.map(([kunci, label]) => (
                        <label key={kunci} className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-2 py-1.5 transition-colors hover:bg-zinc-900">
                          {/* Petak warnanya distel tangan: bawaan peramban
                              memberi kotak berbingkai tebal dengan padding
                              dalam yang tidak bisa diikuti ukuran mana pun. */}
                          <input type="color" value={tampilan[kunci]} aria-label={label}
                                 onChange={(e) => setTampilan((t) => ({ ...t, [kunci]: e.target.value }))}
                                 className="size-5 shrink-0 cursor-pointer rounded border border-zinc-700 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0" />
                          <span className="min-w-0">
                            <span className="block truncate text-[11.5px] text-zinc-200">{label}</span>
                            <span className="block font-mono text-[10px] uppercase text-zinc-600">{tampilan[kunci]}</span>
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-1 border-t border-zinc-800/70 px-2 pb-1.5 pt-1.5">
                      <div className="flex items-center gap-2">
                        {/* Nilainya #09090b saat "ikut tema" supaya petaknya
                            menunjukkan warna yang benar-benar tampak sekarang,
                            bukan hitam pekat yang tidak dipakai di mana pun. */}
                        <input type="color" value={tampilan.latar ?? '#09090b'} aria-label="Warna latar chart"
                               onChange={(e) => setTampilan((t) => ({ ...t, latar: e.target.value }))}
                               className="size-5 shrink-0 cursor-pointer rounded border border-zinc-700 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0" />
                        <span className="min-w-0 grow">
                          <span className="block text-[11.5px] text-zinc-200">Latar chart</span>
                          <span className="block font-mono text-[10px] uppercase text-zinc-600">{tampilan.latar ?? 'ikut tema'}</span>
                        </span>
                        <button onClick={() => setTampilan((t) => ({ ...t, latar: null }))} disabled={tampilan.latar === null}
                          className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-default disabled:text-zinc-700 disabled:hover:bg-transparent">
                          Ikut tema
                        </button>
                      </div>
                    </div>

                    {/* Pasar kripto: futures bawaan, spot atas permintaan.
                        Berlaku untuk SEMUA data kripto -- chart, screener,
                        backtest -- bukan chart ini saja; dua bagian layar yang
                        membaca pasar berbeda akan berbeda pendapat tentang
                        koin yang sama. Trade-Fi tidak tersentuh tombol ini. */}
                    <div className="mt-1 border-t border-zinc-800/70 px-2 pb-1.5 pt-1.5">
                      <span className="block text-[11.5px] text-zinc-200">Pasar kripto</span>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {([['futures', 'Futures'], ['spot', 'Spot']] as const).map(([nilai, label]) => (
                          <button key={nilai}
                            onClick={() => setPasarUi(nilai)}
                            className={cn('cursor-pointer rounded-md border px-2 py-1.5 text-[11.5px] transition-colors',
                              pasarUi === nilai
                                ? 'border-emerald-600/60 bg-emerald-500/10 text-emerald-300'
                                : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200')}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] leading-snug text-zinc-600">
                        Berlaku untuk chart, screener, dan backtest. Simbol yang tidak punya pasar terpilih otomatis memakai pasar satunya.
                      </p>
                    </div>

                    <div className="mt-1 border-t border-zinc-800/70 px-2 pb-1.5 pt-1.5">
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <input type="checkbox" checked={tampilan.tandaAir}
                               onChange={(e) => setTampilan((t) => ({ ...t, tandaAir: e.target.checked }))}
                               className="size-3.5 cursor-pointer accent-emerald-500" />
                        <span className="text-[12px] text-zinc-200">Tanda air</span>
                      </label>
                      <input type="text" value={tampilan.tandaAirTeks} disabled={!tampilan.tandaAir}
                             onChange={(e) => setTampilan((t) => ({ ...t, tandaAirTeks: e.target.value.slice(0, 40) }))}
                             placeholder={airOtomatis} aria-label="Teks tanda air"
                             className="mt-1.5 w-full rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[11.5px] text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40" />
                      <p className="mt-1 text-[10px] leading-snug text-zinc-600">
                        Kosongkan untuk memakai nama pasangan dan timeframe. Baris kecil di bawahnya tetap jenis pasarnya.
                      </p>
                    </div>

                    {/* Pemulih duduk di DASAR panel, sesudah semua seksi, dan
                        selebar panelnya. Versi sebelumnya menaruhnya di baris
                        judul "Lilin" — dari sana ia terbaca sebagai pemulih
                        warna lilin saja, padahal ia mengembalikan latar dan
                        tanda air juga. Tombol yang cakupannya lebih luas dari
                        yang terbaca adalah tombol yang menghapus pekerjaan
                        orang tanpa peringatan.

                        Mati sendiri saat semuanya memang sudah bawaan: itu
                        sekaligus jawaban atas "apa setelanku sudah kembali?"
                        tanpa perlu memeriksa satu per satu. */}
                    <div className="mt-1 border-t border-zinc-800/70 px-2 pb-0.5 pt-1.5">
                      <button onClick={() => setTampilan({ ...TAMPILAN_AWAL })} disabled={tampilanBawaan}
                        title={tampilanBawaan ? 'Semua setelan sudah bawaan' : 'Kembalikan warna lilin, latar, dan tanda air ke bawaan'}
                        className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200 disabled:cursor-default disabled:border-zinc-900 disabled:text-zinc-700 disabled:hover:border-zinc-900 disabled:hover:bg-transparent disabled:hover:text-zinc-700">
                        <RotateCcw className="size-3" strokeWidth={2} />
                        {tampilanBawaan ? 'Sudah bawaan' : 'Kembalikan ke bawaan'}
                      </button>
                      {/* Simpan yang menonjol, Batal yang polos: sesudah
                          mengutak-atik warna, tindakan yang hampir selalu
                          dimaksudkan adalah menyimpan. */}
                      <div className="mt-1.5 flex gap-1.5">
                        <button onClick={batalTampilan}
                          className="flex-1 cursor-pointer rounded-md border border-zinc-800 px-2 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200">
                          Batal
                        </button>
                        <button onClick={simpanTampilan}
                          className="flex-1 cursor-pointer rounded-md bg-emerald-600 px-2 py-1.5 text-[11.5px] font-medium text-white transition-colors hover:bg-emerald-500">
                          Simpan
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Keterangan "N lilin · simbol · lewat proxy VPS" DIHAPUS atas
                permintaan pemilik: informasi teknis yang tidak dibaca siapa pun
                dalam pemakaian normal, tapi tampil permanen di layar setiap
                pengguna. Jumlah penanda trade dipertahankan -- ia hanya muncul
                sehabis backtest, dan orang yang baru menjalankan backtest
                sedang mencarinya. */}
            <span className="flex min-w-0 items-center gap-2 truncate">
              {hasil?.trade.length ? (
                <span className="truncate">{hasil.trade.length} penanda trade</span>
              ) : null}
            </span>
            {/* Multi-chart di UJUNG KANAN kaki chart — permintaan pemilik.
                ml-auto mendorongnya melewati sisa isi baris; Backtest tidak
                ikut terdorong karena sudah absolute. DISEMBUNYIKAN di mode
                polos: panel yang bisa membelah dirinya jadi empat panel lagi
                adalah cermin yang saling memantul. */}
            {!POLOS && (
              <button onClick={() => nyalakanMulti(simbol, tf)}
                title="Multi-chart — bagi layar jadi beberapa panel chart"
                aria-label="Multi-chart"
                /* mb-9 mr-12: DIANGKAT dari sudut, bukan menempel di pojok.
                 Sudut kanan-bawah chart bukan ruang kosong — di sana bertemu
                 kolom harga di kanan dan baris waktu di bawah, dan ikon yang
                 duduk di persimpangan keduanya menutupi dua keterangan
                 sekaligus. Digeser masuk sampai lepas dari kolom harga dan
                 naik sampai di atas baris waktu. */
              className="pointer-events-auto mb-9 ml-auto mr-12 flex shrink-0 cursor-pointer items-center rounded bg-zinc-950/70 p-1 text-zinc-500 backdrop-blur-sm transition-colors hover:text-zinc-300">
                <LayoutGrid className="size-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
        {/* Seluruh kaki chart — gerigi setelan, Backtest, ikon multi —
            disembunyikan di mode panel atas permintaan pemilik: dasar tiap
            panel jadi bersih, dan ketiganya adalah kendali seluruh ruang
            kerja, bukan kendali satu panel. Semuanya tetap ada di chart
            tunggal, satu klik "Tutup multi-chart" jauhnya. */}

        {/* BACKTEST TETAP DI BAWAH, tidak ikut naik ke dalam chart.
            Permintaan pemilik, dan alasannya jelas begitu dipakai: gerigi
            dan ikon multi adalah SAKELAR — ditekan sekali, selesai, dan
            hamparan kecil di pojok cocok untuk itu. Backtest adalah PINTU:
            ia membuka panel setinggi layar tepat di bawahnya, dan pintu
            yang berdiri di dalam ruangan yang ia buka membuat orang
            kehilangan arah begitu isinya muncul.

            Barisnya sendiri, bukan menumpang hamparan: ia harus tetap ada
            saat panelnya terbuka, dan hamparan di dasar chart akan tertutup
            isi panel itu.

            Disembunyikan di mode polos, sama dengan hamparan di atasnya —
            panel seperempat layar bukan tempat membaca hasil backtest. */}
        {/* RATA KANAN, sejajar di bawah ikon multi-chart. Ia punya panelnya
            sendiri, jadi menaruhnya di tengah membuat satu-satunya benda di
            baris ini menggantung tanpa apa pun di kiri-kanannya. pr-4 sama
            dengan px-4 hamparan di atasnya, supaya tepi kanannya segaris
            dengan ikon multi. */}
        <div className={cn('flex items-center justify-end border-t border-zinc-800/80 py-1.5 pr-4',
          POLOS && 'hidden')}>
          <button
            onClick={() => setBacktestBuka((v) => !v)}
            title={backtestBuka ? 'Tutup panel Backtest' : 'Buka panel Backtest (beta)'}
            className={cn('flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors',
              backtestBuka ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300')}>
            <FlaskConical className="size-3" strokeWidth={2} />
            Backtest
            <span className="rounded bg-amber-500/15 px-1 text-[9.5px] text-amber-400/90">beta</span>
          </button>
        </div>

        {/* SELALU terpasang, tampil hanya saat dibuka. Efeknya tetap jalan
            meski tidak menggambar apa pun — itulah yang membuat tombol
            BUY/SELL di pojok chart tersedia sejak halaman dibuka. */}
        <div className={cn(replayIdx !== null ? 'border-t border-zinc-800/80' : 'hidden')}>
          {/* lilinGabung, BUKAN lilin — replayIdx adalah INDEKS ke dalam
              array, dan chart menggambar lilinGabung. Begitu "Muat lebih
              lama" menyisipkan 2000 lilin di DEPAN, indeks yang sama
              menunjuk bar yang sama sekali berbeda: replay memberi harga
              dari 2021 sementara chart menggambar 2026, dan tiket entry
              lahir dengan SL/TP yang jaraknya tidak masuk akal.

              Tidak ada galat sama sekali — cuma angka yang salah, dan itu
              angka yang dipakai memasang stop. Dua tempat yang memakai
              indeks yang sama WAJIB memakai array yang sama. */}
          <PanelReplay lilin={lilinGabung} simbol={simbol} tf={tf} idx={replayIdx}
                       demoSetelan={demoSetelan}
                       setIdx={setReplayIdx} aturGaris={setGarisHarga}
                       aturAksi={setAksi} aturKendali={setKendaliReplay}
                       aturMulai={simpanMulai}
                       usulSl={usulSl} usulTp={usulTp}
                       /* `tampil` mengatur panel BAWAH (pesan & hasil latihan);
                          `bidik` mengatur bar kendali melayang di atas chart.
                          Dipisah karena keduanya muncul di saat yang berbeda:
                          barnya harus ada SEJAK tombol Replay ditekan, panel
                          bawahnya baru berarti setelah ada trade. */
                       tampil={replayIdx !== null}
                       bidik={bidikReplay} onBatalBidik={() => setBidikReplay(false)}
                       tanpaBingkai />
        </div>

        {/* ── Backtest (beta) — MENYATU dengan panel grafik ─────────
            Dulu panel terpisah di bawahnya. Disatukan seperti panel
            Replay karena isinya memang milik chart ini: setelan yang
            diubah di sana mengubah penanda trade DI grafik yang sama.
            Panel sendiri membuat keduanya terbaca sebagai dua alat yang
            kebetulan bertetangga. */}
        {backtestBuka && (
          <div className="border-t border-zinc-800/80">
      {/* ── Backtest (beta) — tampil hanya kalau dibuka dari ikon di
             pojok bawah chart ── */}
          <div className="mt-px border border-amber-500/25 bg-amber-500/[0.04] px-4 py-2.5 text-[12px] leading-relaxed text-amber-200/80">
            <span className="font-medium">Backtest masih beta.</span>
            <span className="text-amber-200/60">
              {' '}Angkanya dihitung dari data lilin yang sedang tampil dan belum memperhitungkan
              slippage maupun spread yang berubah-ubah. Pakai sebagai pembanding kasar antar setelan,
              bukan sebagai janji hasil.
            </span>
          </div>
      {/* ── Setelan uji ── */}
          <Panel className="mt-px rounded-none bg-transparent">
            <PanelHead
              judul="Backtest"
              sub="Dihitung dengan indikator yang sama persis dengan Screener Entry."
              kanan={
                <button onClick={jalankan} disabled={uji || lilin.closes.length < 60}
                  className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                  {uji ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  Jalankan Backtest
                </button>
              }
            />
            <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4 xl:grid-cols-7">
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">Strategi</label>
                <select value={set.strategi} onChange={(e) => setSet({ ...set, strategi: e.target.value as Setelan['strategi'] })}
                        className={cn(KELAS_ISIAN, 'cursor-pointer')}>
                  <option value="smi">SMI dari zona jenuh</option>
                  <option value="ema">Silang EMA</option>
                </select>
              </div>
              {set.strategi === 'ema' && (
                <>
                  <Angka label="EMA cepat" nilai={set.emaCepat} atur={(n) => setSet({ ...set, emaCepat: n })} min={2} />
                  <Angka label="EMA lambat" nilai={set.emaLambat} atur={(n) => setSet({ ...set, emaLambat: n })} min={3} />
                </>
              )}
              <Angka label="SL (× ATR)" nilai={set.slAtr} atur={(n) => setSet({ ...set, slAtr: n })} langkah={0.1} />
              <Angka label="Risk : Reward" nilai={set.rr} atur={(n) => setSet({ ...set, rr: n })} langkah={0.5} />
              <Angka label="Modal ($)" nilai={set.modal} atur={(n) => setSet({ ...set, modal: n })} langkah={100} />
              <Angka label="Risiko / trade (%)" nilai={set.risikoPersen} atur={(n) => setSet({ ...set, risikoPersen: n })} langkah={0.25} />
              <Angka label="Biaya (%)" nilai={set.biayaPersen} atur={(n) => setSet({ ...set, biayaPersen: n })} langkah={0.01} />
            </div>

            {/* Asumsi ditulis di layar, bukan disembunyikan di kode. Backtest tanpa
                asumsi yang terbaca adalah angka tanpa arti. */}
            <div className="border-t border-zinc-800/80 px-5 py-3 text-[11.5px] leading-relaxed text-zinc-600">
              Entry di harga <span className="text-zinc-400">open lilin berikutnya</span> setelah sinyal, bukan di
              close lilin sinyalnya. SL/TP diperiksa terhadap high/low tiap lilin; kalau satu lilin menyentuh
              keduanya, yang dianggap kena adalah <span className="text-zinc-400">SL</span> — data lilin tidak tahu
              mana yang lebih dulu, dan menebak yang menguntungkan membuat setiap hasil terlalu bagus.
            </div>
          </Panel>

          {/* ── Hasil ── */}
          {hasil && (
            hasil.catatan ? (
              <Panel className="mt-px rounded-none bg-transparent px-5 py-6 text-center text-[12.5px] text-zinc-500">{hasil.catatan}</Panel>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <KartuKpi label="Total Trade" nilai={String(hasil.jumlah)}
                            catatan={`${hasil.menang} menang · ${hasil.kalah} kalah`} />
                  <KartuKpi label="Winrate" nilai={persen(hasil.winrate)} catatan="dari transaksi selesai" />
                  <KartuKpi label="P/L Bersih" nilai={uang(hasil.bersih, true)}
                            warna={hasil.bersih >= 0 ? 'text-emerald-500' : 'text-red-400'}
                            catatan={`modal ${uang(set.modal)} → ${uang(hasil.ekuitasAkhir)}`} />
                  <KartuKpi label="Profit Factor"
                            nilai={hasil.faktorProfit === null ? '—' : hasil.faktorProfit === Infinity ? '∞' : hasil.faktorProfit.toFixed(2)}
                            catatan="gross profit / gross loss" />
                  <KartuKpi label="Max Drawdown" nilai={`${hasil.drawdown.toFixed(1)}%`}
                            warna={hasil.drawdown > 10 ? 'text-red-400' : undefined}
                            catatan="penurunan terdalam dari puncak" />
                </div>

                <Panel className="mt-px rounded-none bg-transparent">
                  <PanelHead judul="Daftar Trade" sub={`${hasil.jumlah} transaksi — penandanya ikut tergambar di chart.`} />
                  <div className="px-5 pb-5">
                    <TabelBungkus className="max-h-[380px] overflow-y-auto">
                      <Tabel>
                        <thead className="sticky top-0 bg-zinc-950">
                          <tr>
                            <Th>#</Th><Th>Masuk</Th><Th>Arah</Th>
                            <Th className="text-right">Entry</Th><Th className="text-right">Keluar</Th>
                            <Th>Sebab</Th><Th className="text-right">P/L</Th><Th className="text-right">Ekuitas</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {hasil.trade.map((t) => (
                            <Tr key={t.no}>
                              <Td className="angka text-zinc-600">{t.no}</Td>
                              <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(t.masukWaktu)}</Td>
                              <Td><span className={cn('text-[11.5px]', t.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>{t.arah}</span></Td>
                              <Td className="angka text-right text-zinc-400">{harga(t.masuk)}</Td>
                              <Td className="angka text-right text-zinc-400">{harga(t.keluar)}</Td>
                              <Td><span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                                t.sebab === 'TP' ? 'bg-emerald-500/10 text-emerald-500'
                                  : t.sebab === 'SL' ? 'bg-red-500/10 text-red-400'
                                  : 'bg-zinc-800 text-zinc-400')}>{t.sebab}</span></Td>
                              <Td className={cn('angka text-right', t.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                                {uang(t.pnl, true)}
                              </Td>
                              <Td className="angka text-right text-zinc-300">{uang(t.ekuitas)}</Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Tabel>
                    </TabelBungkus>
                  </div>
                </Panel>
              </>
            )
          )}
        </div>
        )}
      </Panel>
      </div>

      {/* ── Posisi Terbuka ──────────────────────────────────────────
          Dipindah ke sini dari Jurnal. Alasannya bukan kerapian: posisi
          terbuka adalah sesuatu yang masih bisa DIPERBUAT — SL-nya
          digeser, ditutup, ditambah — dan semua perbuatan itu terjadi di
          halaman ini. Jurnal tempat menilai yang sudah lewat. */}
      {/* Tanpa judul section: tiap panel sudah menyebut pasarnya sendiri,
          persis seperti di Dashboard. Judul di atas dua panel yang
          masing-masing sudah berjudul cuma mengulang. */}
      {/* Di panel multi-chart, tabel ini HANYA milik panel utama (utama=1,
          panel pertama grid). Empat salinan tabel yang isinya sama persis
          membuat tiap panel memanjang ke bawah tanpa menambah informasi. */}
      {(!POLOS || UTAMA) && (
        <>
          {/* Sakelar hanya ada di mode panel. Di chart tunggal tabel ini
              duduk di bawah chart tanpa mengganggu apa pun, dan sakelar
              untuk sesuatu yang tidak mengganggu cuma menambah kendali
              yang harus dipahami. */}
          {POLOS && (
            <button onClick={() => setPosisiSembunyi((v) => !v)}
              aria-label={posisiSembunyi ? 'Tampilkan posisi terbuka' : 'Sembunyikan posisi terbuka'}
              className="mt-1 flex w-full cursor-pointer items-center gap-1.5 border-t border-zinc-800/80 px-3 py-1.5 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300">
              {posisiSembunyi ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
              {posisiSembunyi ? 'Posisi & order terbuka' : 'Sembunyikan posisi & order'}
            </button>
          )}
          {!(POLOS && posisiSembunyi) && (
            /* SEJAJAR DENGAN GRAFIK, bukan berjarak sendiri. Sempat dibuat
               berjarak seperti sebelumnya, dan hasilnya justru terlihat
               tidak disengaja: satu kotak menempel ke pembatas, kotak di
               bawahnya menjorok ke dalam, tanpa apa pun yang menjelaskan
               kenapa. Keseragaman di sini lebih berarti daripada kelegaan
               tabelnya.

               gap-px, bukan gap-4: celah ANTAR kartu harus sama dengan celah
               ke tepi. Celah luar 1 px dengan celah tengah 16 px membuat
               kedua kartu terbaca sebagai dua benda terpisah yang kebetulan
               berdekatan, bukan sebagai satu bidang yang terbagi. */
            <div className={cn('grid grid-cols-1 lg:grid-cols-2',
              POLOS ? 'mt-0 gap-4' : 'mt-px gap-px')}>
              <PanelPosisiTerbuka sumber="kripto" onSunting={bukaSunting} onTutup={tutupDariTabel} tanpaBingkai={POLOS} menyatu />
              <PanelPosisiTerbuka sumber="forex" onSunting={bukaSunting} onTutup={tutupDariTabel} tanpaBingkai={POLOS} menyatu />
            </div>
          )}
        </>
      )}
    </div>
  );
}
