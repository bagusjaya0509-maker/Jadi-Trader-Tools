import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Play, Loader2, RefreshCw, Radio, TriangleAlert, History,
  Layers, ChevronDown, Settings2, Code2, X, Ruler, Rows3, Square, Eraser, Minus, TrendingUp,
  FlaskConical, GripVertical } from 'lucide-react';
import { PanelNews } from '@/components/panel-news';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga, tanggalPendek } from '@/lib/utils';
import { ChartLilin, type Garis, type GarisHarga, type GarisSeret, type PosisiChartMt5 } from '@/components/chart-lilin';
import { PanelReplay, type AksiOrder, type JenisEntry } from '@/components/panel-replay';
import { PojokOrder } from '@/components/pojok-order';
import { kirimOrderNyata, ubahSlTpNyata, batalPendingNyata, tutupPosisiNyata, tickSimbol, keTick, type MetodeTp } from '@/lib/order-nyata';
import { kirimPerintahMt5, tungguHasilMt5 } from '@/lib/mt5-order';
import { DockPine, type InfoPine, type KendaliPine } from '@/components/dock-pine';
import { WatchChart } from '@/components/watch-chart';
import { PanelPosisiTerbuka, type OrderSunting } from '@/components/panel-posisi-terbuka';
import type { JenisAlat, GambarAlat } from '@/lib/plugin-alat';
import type { HasilPine } from '@/lib/pine';
import { bacaSetelanChart, simpanSetelanChart } from '@/lib/replay';
import { ambilKlines, ambilKlinesSebelum, bacaSpekMt5, bacaTickMt5, daftarSimbolMt5, type Lilin } from '@/lib/pasar';
import { useAkunMt5, segarkanAkunMt5 } from '@/lib/akun';
/* Langsung dari admin, BUKAN lewat usePosisi(): yang dibutuhkan di sini
   cuma daftar order bursa, sementara usePosisi() juga memasang listener
   Firestore. Halaman chart dibuka lama dan sering — menambah satu
   listener di sini adalah cara pelan-pelan menghabiskan kuota untuk data
   yang tidak dipakainya. */
import { usePosisiBinance, bacaStopBursa } from '@/lib/admin';
import {
  jalankanUji, garisIndikator, zonaSnr, deretSmi, SETELAN_BAWAAN,
  type Setelan, type HasilUji,
} from '@/lib/backtest';
import { SIMBOL_DASAR, simbolDasarMt5 } from '@/lib/simbol';

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
  { nilai: '5m', label: '5 Menit' },
  { nilai: '15m', label: '15 Menit' },
  { nilai: '1h', label: '1 Jam' },
  { nilai: '4h', label: '4 Jam' },
  { nilai: '1d', label: 'Harian' },
];

/** Durasi tiap timeframe dalam milidetik. */
const DURASI_TF: Record<string, number> = {
  '5m': 5 * 60_000, '15m': 15 * 60_000, '1h': 3_600_000,
  '4h': 4 * 3_600_000, '1d': 24 * 3_600_000,
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
function rapikanSimbol(s: string): string {
  const t = s.trim();
  return /^MT5:/i.test(t) ? 'MT5:' + t.slice(4) : t.toUpperCase();
}

export default function ChartBacktest() {
  /* Simbol & timeframe boleh datang dari alamatnya: `#/chart?simbol=ETHUSDT`.
     Itulah yang dipakai menu klik-kanan di Screener Entry untuk membuka koin
     tertentu di sini, dan juga yang membuat halaman ini bisa ditandai. */
  const [cari] = useSearchParams();
  /* Urutan sumber: ALAMAT dulu, lalu setelan tersimpan, baru bawaan.
     Alamat menang karena ia perbuatan yang baru saja dilakukan — klik kanan
     di screener harus membuka koin yang diklik, bukan koin kemarin. */
  const awal = bacaSetelanChart();
  const { data: posisiBursa, order: orderBursa, segarkan: segarkanBursa } = usePosisiBinance();
  const akunMt5 = useAkunMt5();
  const [simbol, setSimbol] = useState(() => rapikanSimbol(cari.get('simbol') || awal.simbol || 'BTCUSDT'));
  const [tf, setTf] = useState(() => {
    const t = (cari.get('tf') || awal.tf || '4h').toLowerCase();
    return ['5m', '15m', '1h', '4h', '1d'].includes(t) ? t : '4h';
  });

  /* Alamat yang berubah saat halaman sudah terbuka ikut diikuti — klik kanan
     di screener dua kali berturut-turut harus berpindah dua kali. */
  useEffect(() => {
    const s = cari.get('simbol');
    if (s) setSimbol(rapikanSimbol(s));
    const x = (cari.get('tf') || '').toLowerCase();
    if (x && ['5m', '15m', '1h', '4h', '1d'].includes(x)) setTf(x);
  }, [cari]);
  const [lilin, setLilin] = useState<Lilin>({ opens: [], highs: [], lows: [], closes: [], times: [] });
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
  const [alat, setAlat] = useState<JenisAlat | null>(null);
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
    setGambarAlat((d) => {
      const b = [...d, { ...g, id: 'g' + Date.now() }];
      try { localStorage.setItem(`jt.alat.${simbol}|${tf}`, JSON.stringify(b)); } catch { /* privat */ }
      return b;
    });
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
  useEffect(() => { setGambarPilih(null); }, [simbol, tf, alat]);
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
  const [alatTutup, setAlatTutup] = useState(() => {
    try { return localStorage.getItem('jt.alatTutup') === '1'; } catch { return false; }
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
        await batalPendingNyata({ symbol: sunting.simbol, orderId: sunting.tiket ?? '' });
        setSuntingKabar('Pending order dibatalkan.');
        segarkanBursa();
        setSunting(null);
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
      setSuntingKabar(e instanceof Error ? e.message : 'Gagal mengakhiri order');
    } finally { setSuntingSibuk(false); }
  }

  const [kendaliReplay, setKendaliReplay] = useState<React.ReactNode>(null);
  /* Arah tiket yang sedang disusun. null = belum ada tiket, chart cuma
     menggambar rencana dari kartu screener kalau ada. */
  const [draf, setDraf] = useState<'BUY' | 'SELL' | null>(null);
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
    if (!simbol.startsWith('MT5:')) return '[]';
    const dasarS = simbol.slice(4);
    return JSON.stringify(akunMt5.posisi
      .filter((p) => p.simbol.toUpperCase().indexOf(dasarS) === 0)
      .map((p) => ({ tiket: p.tiket, arah: p.arah, lot: p.lot, entry: p.hargaBuka, sl: p.sl, tp: p.tp })));
  }, [simbol, akunMt5.posisi]);
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
  const jangkarQty = useCallback((e?: number, s?: number, risikoD?: number) => {
    if (e && s && e !== s && risikoD) qtyDemo.current = risikoD / Math.abs(e - s);
  }, []);
  useEffect(() => {
    if (!draf || !aksi || aksi.mode !== 'demo') return;
    jangkarQty(rencana.entry ?? aksi.hargaKini, rencana.sl, aksi.risiko);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draf, demoSetelan.modal, demoSetelan.risikoPersen]);
  useEffect(() => {
    if (!draf || !aksi || aksi.mode !== 'demo' || seretTangan.current) return;
    const u = aksi.usul(draf);
    if (u && u.sl && u.tp) {
      setRencana((r) => ({ ...r, sl: u.sl, tp: u.tp }));
      jangkarQty(u.entry, u.sl, aksi.risiko);
    }
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
    dipasang.current = kunci;
    if (sl || tp || entryUrl) {
      setRencana({
        entry: entryUrl ?? lilin.closes[lilin.closes.length - 1] ?? undefined,
        sl, tp,
      });
      /* Entry dari sinyal adalah KEPUTUSAN, bukan tebakan — jadi penyusul
         harga otomatis berhenti ikut campur begitu ia dipasang. */
      if (entryUrl) entryDigeser.current = true;
    }
  }, [cari, simbol, lilin]);

  /* Entry menyusul harga terakhir selama belum ada posisi dan belum digeser
     sendiri — supaya garisnya tidak menggantung jauh dari lilin terbaru. */
  const entryDigeser = useRef(false);
  useEffect(() => {
    if (entryDigeser.current || aksiPosisi) return;
    const h = lilin.closes[lilin.closes.length - 1];
    if (h && (rencana.sl || rencana.tp)) setRencana((r) => ({ ...r, entry: h }));
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
          setGalat(simbol.startsWith('MT5:')
            ? 'Belum ada data dari terminal MT5 — buka MT5 dengan EA Trade-Fi Sync v2 terpasang; chart terisi begitu EA mengirim (± tiap 5 menit).'
            : 'Data tidak diterima. Proxy VPS mungkin sedang tidak menjawab.');
        }
        else { setLilin(l); setGalat(''); }
      } catch (e) {
        if (hidup) setGalat(e instanceof Error ? e.message : 'Gagal mengambil data');
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

  const garis: Garis[] = useMemo(() => {
    const keluar: Garis[] = [];
    if (set.strategi === 'ema' && lilin.closes.length) {
      const g = garisIndikator(lilin, set);
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
  }, [lilin, set, pine]);

  /* Zona dihitung sampai bar yang SEDANG tampil, bukan sampai bar terakhir.
     Selama replay, menggambar zona dari data masa depan adalah cara paling
     halus untuk membuat latihannya berbohong. */
  const zona = useMemo(
    () => (tampilSnr && lilin.closes.length ? zonaSnr(lilin, replayIdx ?? undefined) : null),
    [tampilSnr, lilin, replayIdx]
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
    return tampilSmi && lilin.closes.length >= 30 ? deretSmi(lilin) : null;
  }, [tampilSmi, lilin, pine]);

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
      const ketEntry = `· ${sunting.arah}`;
      const ketStop = '';
      if (sunting.entry) g.push({
        id: 'entry', harga: sunting.entry, warna: '#d4d4d8', label: 'Entry',
        ket: ketEntry,
        bisaSeret: true,
      });
      if (suntingSl) g.push({ id: 'sl', harga: suntingSl, warna: '#f87171', label: 'SL', ket: ketStop, bisaSeret: true });
      if (suntingTp) g.push({ id: 'tp', harga: suntingTp, warna: '#10b981', label: 'TP', ket: ketStop, bisaSeret: true });
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
  }, [sunting, panelUbah, suntingSl, suntingTp, aksiPosisi, aksiTunda, rencana, aksi, draf, labelJenis, nyataSetelan, lotMt5, nilaiLotMt5, simbol]);

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

      /* POSISI TERBUKA — entry, SL, dan TP.
         ──────────────────────────────────────────────────────────────
         Sebelumnya cuma pending order yang digambar, jadi begitu order
         terisi garisnya JUSTRU HILANG — persis di saat ia paling
         dibutuhkan. Posisi yang sedang berjalan tanpa garis di chart
         berarti stop dan target cuma angka di tabel; mata tidak bisa
         menilai jaraknya terhadap harga sekarang. */
      for (const p of akunMt5.posisi.filter((p) => cocok(p.simbol))) {
        const nomor = akunMt5.posisi.length > 1 ? ` #${p.tiket}` : '';
        if (p.hargaBuka) g.push({
          harga: p.hargaBuka, warna: 'rgba(212,212,216,.85)',
          label: `${p.arah} ${p.lot} lot${nomor}`,
        });
        /* SL/TP hanya digambar kalau memang terpasang. Nol berarti tidak
           ada — menggambarnya di harga 0 akan meremukkan skala chart. */
        if (p.sl > 0) g.push({ harga: p.sl, warna: 'rgba(248,113,113,.85)', label: `SL${nomor}` });
        if (p.tp > 0) g.push({ harga: p.tp, warna: 'rgba(16,185,129,.85)', label: `TP${nomor}` });
      }

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
  }, [orderBursa, simbol, aksiTunda, akunMt5.pending, akunMt5.posisi, aksi?.mode]);

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
    const v = ketik.trim().toUpperCase();
    /* Bentuk yang jelas bukan simbol tidak dikirim ke proxy sama sekali;
       kotaknya dikembalikan ke simbol yang sedang tampil supaya tidak ada
       yang mengira grafiknya sedang menampilkan apa yang tertulis. */
    /* Awalan MT5: = sumber Trade-Fi (OHLC dari terminal MT5 lewat EA v2). */
    if (!/^(MT5:)?[A-Z0-9]{3,15}$/.test(v)) { setKetik(simbol); return; }
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
  const tinggiChart = tinggiManual ?? Math.max(460, tinggiLayar - (tampilSmi ? 343 : 303));
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
    <div className="p-4 sm:p-6">
      {/* ── Bilah kendali ── */}
      <Panel>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[168px]">
            <label className="mb-1 block text-[11px] text-zinc-500">Simbol</label>
            {/* Diketik dulu, DIKOMIT belakangan.
                ──────────────────────────────────────────────────────────
                Sebelumnya tiap huruf langsung jadi simbol aktif: mengetik
                "ETHUSDT" menembakkan tujuh permintaan ke proxy, enam di
                antaranya untuk simbol yang tidak ada ("E", "ET", "ETH"…).
                Yang terlihat adalah halaman tersendat lalu grafiknya hilang
                diganti pesan galat — bukan karena pencariannya rusak, tapi
                karena setiap ketukan diperlakukan sebagai keputusan. */}
            <input list="simbolChart" value={ketik}
                   onChange={(e) => {
                     const v = rapikanSimbol(e.target.value);
                     setKetik(v);
                     /* Memilih dari daftar langsung berlaku — itu memang
                        sebuah pilihan, bukan setengah kata. */
                     if (SIMBOL_DASAR.includes(v) || simbolMt5.some((s) => 'MT5:' + s === v)) setSimbol(v);
                   }}
                   onKeyDown={(e) => { if (e.key === 'Enter') komitSimbol(); }}
                   onBlur={komitSimbol}
                   placeholder="BTCUSDT"
                   className={cn(KELAS_ISIAN, 'angka')} />
            <datalist id="simbolChart">
              {/* Sumber Trade-Fi di urutan teratas — satu-satunya entri yang
                  bukan Binance, jadi ia yang paling butuh terlihat ada. */}
              {simbolMt5.map((s) => (
                <option key={'MT5:' + s} value={'MT5:' + s}>Trade-Fi — dari MT5 (EA v2)</option>
              ))}
              {SIMBOL_DASAR.map((s) => <option key={s} value={s} />)}
            </datalist>
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

          <div className="ml-auto flex items-center gap-3">
            <span className={cn('flex items-center gap-1.5 text-[11px]', memuat ? 'text-zinc-600' : 'text-emerald-500')}>
              <Radio className="size-3" /> {memuat ? 'memuat' : 'live · 3 dtk'}
            </span>
            <button onClick={() => { setSegar((n) => n + 1); setKunciChart((n) => n + 1); }}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
              <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} /> Segarkan
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
            <div className="relative">
              <button onClick={() => setMenuInd((v) => !v)}
                className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors',
                  menuInd ? 'border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100')}>
                <Layers className="size-3.5" /> Indikator
                {(Number(tampilSnr) + Number(tampilSmi) + (pineInfo ? 1 : 0)) > 0 && (
                  <span className="rounded bg-zinc-800 px-1 text-[10px] text-zinc-300">
                    {Number(tampilSnr) + Number(tampilSmi) + (pineInfo ? 1 : 0)}
                  </span>
                )}
                <ChevronDown className="size-3" />
              </button>
              {menuInd && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuInd(false)} />
                  <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded-lg border border-zinc-800 bg-zinc-950 p-1.5 shadow-2xl">
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
            <button onClick={() => {
                if (replayIdx !== null) { setReplayIdx(null); return; }
                mulaiReplay.current?.();
              }}
              title={replayIdx !== null ? 'Keluar dari replay' : 'Mulai replay dari 60% data'}
              className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors',
                replayIdx !== null
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100')}>
              <History className="size-3.5" /> Replay
              {replayIdx !== null && <span className="angka text-[10.5px]">bar {replayIdx + 1}</span>}
            </button>
          </div>
        </div>

        {galat && (
          <div className="flex items-start gap-2 border-t border-zinc-800/80 px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <span className="text-[12.5px] text-amber-200/90">{galat}</span>
          </div>
        )}

        <div className="border-t border-zinc-800/80 px-2 pb-2">
          {/* relative + overflow-hidden: rumah semua hamparan chart — legend,
              alat gambar, dock Pine, dan watchlist yang meluncur dari kanan.
              Tanpa overflow-hidden, panel yang sedang tersembunyi
              (translate-x-full) melebarkan halaman. */}
          {/* Grafik dan watchlist SEJAJAR, bukan bertumpuk: kolom kiri
              menyusut saat pembatas ditarik, jadi lilin di tepi kanan
              tidak pernah tertutup daftar. */}
          <div className="flex">
          <div ref={areaChart} className="relative min-w-0 grow overflow-hidden">
          {lilin.times.length > 0
            ? <ChartLilin key={`${simbol}|${tf}|${kunciChart}`}
                          lilin={lilinGabung} garis={garis} trade={replayIdx === null ? hasil?.trade : undefined}
                          tinggi={tinggiChart} hingga={replayIdx ?? undefined} smi={smi}
                          garisHarga={[...garisHarga, ...garisZona, ...garisOrder]}
                          /* KLIK CHART = PINDAHKAN POSISI REPLAY — tapi HANYA
                              kalau tidak ada alat gambar yang sedang dipakai.

                              Sebelumnya syaratnya cuma "replay sedang jalan",
                              dan akibatnya alat gambar tidak bisa dipakai sama
                              sekali selama replay: tiap klik untuk menaruh atau
                              memindahkan garis JUGA menggeser posisi replay,
                              jadi chartnya melompat tepat saat orangnya sedang
                              membidik. Terbaca sebagai "grafiknya maju sendiri",
                              padahal yang terjadi satu klik dikerjakan dua kali
                              oleh dua fitur yang tidak saling tahu.

                              Dua keadaan yang menahan: `alat` (sedang memegang
                              alat, hendak menggambar baru) dan `gambarPilih`
                              (sebuah gambar sedang dipilih, hendak digeser).
                              Di luar keduanya, klik tetap memindahkan replay
                              seperti biasa. */
                          onKlikBar={replayIdx === null || alat || gambarPilih ? undefined : setReplayIdx}
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
                          pojok={aksi ? (
                            <PojokOrder
                              posisi={aksi.posisi} hargaKini={aksi.hargaKini}
                              draf={draf} rencana={rencana} mode={aksi.mode}
                              jenis={labelJenis} risiko={aksi.risiko} qtyDemo={qtyDemo.current}
                              tunda={aksiTunda} onBatalTunda={aksi.batalTunda}
                              onGantiMode={(m) => {
                                aksi.gantiMode(m);
                                setKabarNyata('');
                                /* Pindah ke LATIHAN membersihkan garisnya.
                                   Level order sungguhan yang tertinggal di
                                   mode demo akan terbaca sebagai rencana
                                   latihan — dan menggesernya di sana tidak
                                   mengubah apa pun di bursa. */
                                if (m === 'demo') {
                                  setRencana({});
                                  setDraf(null);
                                  entryDigeser.current = false;
                                }
                              }}
                              onPilih={(arah) => {
                                setDraf(arah);
                                setKabarNyata('');
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
                                if (sisiBenar) { setRencana((r) => ({ ...r, entry: e })); return; }
                                const u = aksi.usul(arah);
                                if (u) setRencana({ entry: u.entry, sl: u.sl || undefined, tp: u.tp || undefined });
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
                              onTutup={aksi.tutup} mati={aksi.mati} />
                          ) : undefined} />
            : <div className="flex h-[440px] items-center justify-center text-[12.5px] text-zinc-600">
                {memuat ? 'Memuat lilin…' : 'Tidak ada data untuk simbol ini.'}
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
                 className={cn('absolute z-20 cursor-move', !letakPakai && 'bottom-2 right-2')}>
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
              yang bisa diklik sedekat itu bikin salah tekan. */}
          <div className="pointer-events-none absolute right-24 top-2 z-20 flex flex-col items-end gap-1">
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

          {/* ── Alat gambar — bilah MENDATAR di dasar chart ─────────
              Dulu tegak di tengah sisi kiri, dan di situ ia berdiri tepat
              di jalur panel order yang terbuka dari pojok kiri atas:
              begitu ordernya panjang, keduanya bertumpuk dan tombol alat
              jadi tidak bisa ditekan. Dasar chart kosong dan tetap
              kosong berapa pun isi panel ordernya.

              Klik gambar (mode kursor) untuk memilihnya, Delete untuk
              menghapus; penghapus menghapus yang terpilih dulu, semuanya
              kalau tidak ada yang terpilih. */}
          {alatTutup ? (
            <button onClick={() => aturAlatTutup(false)} title="Buka bilah alat gambar"
              style={letakAlat ? { left: letakAlat.x, top: letakAlat.y } : undefined}
              className={cn('absolute z-20 flex size-7 cursor-pointer items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-950/85 text-zinc-500 backdrop-blur-sm transition-colors hover:text-zinc-200',
                !letakAlat && 'bottom-2 left-2')}>
              <Ruler className="size-3.5" />
            </button>
          ) : (
          <div onPointerDown={mulaiSeretAlat}
               style={letakAlat ? { left: letakAlat.x, top: letakAlat.y } : undefined}
               className={cn('absolute z-20 flex cursor-move flex-row items-center gap-0.5 rounded-lg border border-zinc-800/80 bg-zinc-950/85 p-1 backdrop-blur-sm',
                 !letakAlat && 'bottom-2 left-2')}>
            {/* Pegangan seret di ujung kiri — memberi tahu bilahnya bisa
                dipindah tanpa perlu dicoba dulu. */}
            <GripVertical className="size-3.5 shrink-0 text-zinc-700" />
            {([
              ['garis', TrendingUp, 'Garis tren — tarik dari titik ke titik'],
              ['ukur', Ruler, 'Ukur % kenaikan / penurunan — klik lalu tarik'],
              ['fib', Rows3, 'Fibonacci retracement — tarik dari swing ke swing'],
              ['kotak', Square, 'Kotak SNR manual — tarik membentuk zonanya'],
            ] as const).map(([j, Ikon, judul]) => (
              <button key={j} onClick={() => setAlat(alat === j ? null : j)} title={judul}
                className={cn('flex size-7 cursor-pointer items-center justify-center rounded transition-colors',
                  alat === j ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100')}>
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
          <WatchChart simbol={simbol} onPilih={setSimbol} onLebar={setLebarWatch} />
          </div>
          {/* Pegangan tinggi chart: diseret = diatur, dilepas = dikunci dan
              diingat sebagai bawaan, klik dua kali = kembali otomatis. */}
          <div onPointerDown={mulaiSeretTinggi}
               onDoubleClick={() => { setTinggiManual(null); try { localStorage.removeItem('jt.tinggiChart'); } catch { /* privat */ } }}
               title="Seret untuk mengatur tinggi chart — dilepas, ukurannya diingat. Klik dua kali: kembali otomatis."
               className="group flex h-3 w-full cursor-ns-resize items-center justify-center">
            <div className="h-[3px] w-16 rounded-full bg-zinc-800 transition-colors group-hover:bg-zinc-500" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-zinc-800/80 px-4 py-2 text-[11.5px] text-zinc-600">
          <span className="flex min-w-0 items-center gap-2 truncate">
            <span className="truncate">
              {lilinGabung.times.length} lilin · {simbol} {TF.find((x) => x.nilai === tf)?.label} · lewat proxy VPS
              {hasil?.trade.length ? ` · ${hasil.trade.length} penanda trade` : ''}
            </span>
            {/* Binance memberi maksimum 1000 lilin PER PERMINTAAN, bukan
                seluruhnya. Tombol ini menarik potongan berikutnya ke belakang
                dan menyambungnya — ditekan tiga kali di TF harian, chartnya
                mundur sampai 2018.

                Ditaruh di kaki chart, bukan di bilah kendali atas: ia baru
                dicari SESUDAH orangnya menggulir mentok ke kiri, dan di situlah
                matanya sudah berada. MT5 tidak punya rute untuk meminta lilin
                lebih tua, jadi tombolnya tidak ditawarkan sama sekali di sana —
                lebih jujur daripada tombol yang selalu menjawab "tidak ada". */}
            {!simbol.startsWith('MT5:') && !habisRiwayat && (
              <button
                onClick={() => void muatLebihLama()}
                disabled={muatLama}
                title="Tarik 1000 lilin sebelum yang paling tua"
                className="shrink-0 cursor-pointer rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                {muatLama ? 'Memuat…' : '← Muat lebih lama'}
              </button>
            )}
            {habisRiwayat && (
              <span className="shrink-0 text-zinc-700">riwayat terjauh</span>
            )}
          </span>
          {/* Backtest disembunyikan di balik ikon di pojok chart, bukan
              dibentangkan di bawahnya. Alasannya bukan sekadar ruang:
              hasilnya masih beta, dan panel yang selalu terbuka membuat
              angkanya terbaca sebagai bagian tetap halaman — padahal ia
              sedang diuji. Yang dibuka atas kemauan sendiri dibaca dengan
              kewaspadaan yang berbeda. */}
          <button
            onClick={() => setBacktestBuka((v) => !v)}
            title={backtestBuka ? 'Tutup panel Backtest' : 'Buka panel Backtest (beta)'}
            className={cn('flex shrink-0 cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors',
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
                       tampil={replayIdx !== null}
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
          <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] px-4 py-2.5 text-[12px] leading-relaxed text-amber-200/80">
            <span className="font-medium">Backtest masih beta.</span>
            <span className="text-amber-200/60">
              {' '}Angkanya dihitung dari data lilin yang sedang tampil dan belum memperhitungkan
              slippage maupun spread yang berubah-ubah. Pakai sebagai pembanding kasar antar setelan,
              bukan sebagai janji hasil.
            </span>
          </div>
      {/* ── Setelan uji ── */}
          <Panel className="mt-4">
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
              <Panel className="mt-4 px-5 py-6 text-center text-[12.5px] text-zinc-500">{hasil.catatan}</Panel>
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

                <Panel className="mt-4">
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

      {/* ── Posisi Terbuka ──────────────────────────────────────────
          Dipindah ke sini dari Jurnal. Alasannya bukan kerapian: posisi
          terbuka adalah sesuatu yang masih bisa DIPERBUAT — SL-nya
          digeser, ditutup, ditambah — dan semua perbuatan itu terjadi di
          halaman ini. Jurnal tempat menilai yang sudah lewat. */}
      {/* Tanpa judul section: tiap panel sudah menyebut pasarnya sendiri,
          persis seperti di Dashboard. Judul di atas dua panel yang
          masing-masing sudah berjudul cuma mengulang. */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelPosisiTerbuka sumber="kripto" onSunting={bukaSunting} onTutup={tutupDariTabel} />
        <PanelPosisiTerbuka sumber="forex" onSunting={bukaSunting} onTutup={tutupDariTabel} />
      </div>
    </div>
  );
}
