import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChart, CandlestickSeries, LineSeries, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type IPriceLine, type Logical, type Time,
} from 'lightweight-charts';
import type { Lilin } from '@/lib/pasar';
import { cn, harga as fHarga } from '@/lib/utils';
import type { TradeUji } from '@/lib/backtest';
import type { SegmenPine, PenandaPine, KotakPine, IsianPine } from '@/lib/pine-bar';
import { PenggambarIsi } from '@/lib/plugin-isi';
import { PenggambarAlat, type GambarAlat, type JenisAlat } from '@/lib/plugin-alat';
import { useTema, temaSekarang, WARNA_CHART } from '@/lib/tema';

/* ════════════════════════════════════════════════════════════════════════
   CHART LILIN
   ════════════════════════════════════════════════════════════════════════
   lightweight-charts, bukan SVG tulisan tangan seperti sebelumnya.
   Alasannya berubah karena tuntutannya berubah: chart yang cuma dipandang
   memang tidak butuh pustaka, tapi chart yang harus di-zoom, digeser, punya
   crosshair, dan menampilkan penanda entry/exit di posisi yang tepat —
   itu ribuan baris kalau ditulis sendiri, dan hasilnya tetap kalah halus.

   45 kB gzip, Apache-2.0, dari pembuat TradingView sendiri. Dimuat malas
   bersama halaman Chart, jadi tidak menyentuh halaman lain sama sekali.
   ════════════════════════════════════════════════════════════════════════ */

export interface Garis { nama: string; nilai: (number | null)[]; warna: string }

/* ── Presisi sumbu harga ───────────────────────────────────────────────
   lightweight-charts memakai bawaan `minMove: 0.01` kalau tidak diberi
   tahu. Untuk BTC di 64.000 itu wajar; untuk GBPUSD di 1,35 sumbu kanan
   cuma bisa menaruh label tiap 0,01 — jadi seluruh layar hanya memuat
   1.36 / 1.35 / 1.34 / 1.33, dan harga di antaranya tidak punya angka
   sama sekali. Untuk koin sen lebih parah: THETA di 0,1337 membuat dua
   label berbeda sama-sama tertulis "0.14".

   Presisinya diambil dari DATANYA SENDIRI, bukan dari daftar tebakan per
   simbol. Berapa desimal yang dipakai bursa/broker adalah pernyataan
   mereka tentang tick terkecil simbol itu — MT5 mengirim GBPUSD 5 desimal,
   Binance mengirim ENJ 5 desimal, BTC 2. Membacanya berarti sumbu kita
   ikut benar untuk simbol yang belum pernah kita lihat. */
function desimalDeret(closes: number[]): number {
  let maks = 0;
  for (let i = Math.max(0, closes.length - 200); i < closes.length; i++) {
    const v = closes[i];
    if (!isFinite(v)) continue;
    const s = String(v);
    if (s.indexOf('e') >= 0 || s.indexOf('E') >= 0) continue;  // notasi ilmiah
    const titik = s.indexOf('.');
    if (titik >= 0) maks = Math.max(maks, s.length - titik - 1);
    if (maks >= 8) return 8;
  }
  return maks;
}

function formatHarga(closes: number[]): { precision: number; minMove: number } {
  const akhir = closes.length ? Math.abs(closes[closes.length - 1]) : 0;
  /* Lantai menurut besaran: deret yang kebetulan bulat semua (harga diam di
     angka genap) tidak boleh membuat sumbunya jadi bilangan bulat. */
  const lantai = akhir >= 1000 ? 2 : akhir >= 1 ? 4 : akhir > 0 ? 5 : 2;
  const d = Math.min(8, Math.max(lantai, desimalDeret(closes)));
  return { precision: d, minMove: Number(Math.pow(10, -d).toFixed(d)) };
}

export interface GarisHarga { harga: number; warna: string; label: string }

/* ── Tinggi panel SMI ──────────────────────────────────────────────────
   Bawaannya 80 px — cukup untuk membaca arah dan silangnya, dan tidak
   bertabrakan dengan kendali replay yang menumpang di dasar area harga.

   Tinggi yang DIPILIH orangnya (menyeret pembatas panel) menang atas
   bawaan dan bertahan melintasi muat ulang. Efek yang menggambar ulang SMI
   berjalan tiap kali data disegarkan; tanpa penyimpanan ini, setiap
   penyegaran mengembalikan tinggi panel ke bawaan — persis bug "saya sudah
   atur kok balik sendiri". */
const KUNCI_TINGGI_SMI = 'jt.tinggiSmi';
const TINGGI_SMI_BAWAAN = 80;

function bacaTinggiSmi(): number {
  try {
    const n = Number(localStorage.getItem(KUNCI_TINGGI_SMI));
    return n >= 40 && n <= 400 ? n : TINGGI_SMI_BAWAAN;
  } catch { return TINGGI_SMI_BAWAAN; }
}

/** Garis yang bisa DIGESER: entry, SL, TP.
 *
 *  Digambar sebagai elemen DOM di atas kanvas, bukan sebagai price line
 *  bawaan lightweight-charts. Alasannya satu: price line bawaan tidak bisa
 *  diseret sama sekali, dan menggesernya adalah cara paling wajar mengubah
 *  level sebelum order dikirim. */
export interface GarisSeret {
  id: 'entry' | 'sl' | 'tp';
  harga: number;
  warna: string;
  label: string;
  /** Keterangan di belakang harga: risiko dolar, jenis order. */
  ket?: string;
  bisaSeret?: boolean;
}

/** Posisi MT5 terbuka yang digambar di chart — datang dari laporan EA.
 *
 *  Digambar sebagai PRICE LINE bawaan lightweight-charts, bukan elemen DOM
 *  seperti GarisSeret. Alasannya kebalikan dari alasan GarisSeret: garis
 *  posisi harus MENEMBUS sampai ke sumbu harga dengan label kotak yang ikut
 *  bergerak — persis garis harga berjalan di MetaTrader — dan itu persis
 *  yang price line lakukan gratis. Yang tetap DOM cuma tiga hamparan tipis:
 *  PnL polos di atas garis entry, pegangan seret SL/TP, dan tombol Kirim. */
export interface PosisiChartMt5 {
  tiket: string;
  arah: 'BUY' | 'SELL';
  lot: number;
  entry: number;
  sl: number;
  tp: number;
}

export function ChartLilin({
  lilin, garis, trade, tinggi = 420, hingga, garisHarga, onKlikBar, smi, mundur, pojok,
  garisSeret, onSeret, onKlikGaris, onHapusGaris, hamparanBawah, segmen, penandaPine, kotakPine, isianPine,
  alat, onAlatSelesai, gambarAlat, gambarPilih, onPilihGambar, onUbahGambar,
  posisiMt5, onUbahPosisi, hargaAsk, kunciUkuran, bagikanFoto,
}: {
  /** Diberi SATU fungsi pemotret begitu chartnya siap. Dipakai halaman yang
   *  perlu sampul analisa; yang diserahkan cuma kemampuan memotret, bukan
   *  objek chartnya — lihat catatan di tempat pemasangannya. */
  bagikanFoto?: (ambil: () => string | null) => void;
  lilin: Lilin;
  /** Berubah = kolom chart berubah lebar; chart diukur ulang.
   *  Nilainya tidak dipakai, cuma perubahannya. */
  kunciUkuran?: number;
  garis?: Garis[];
  trade?: TradeUji[];
  tinggi?: number;
  /* Gambar hanya sampai indeks ini — dipakai mode replay. `undefined` berarti
     seluruhnya. Pemotongan terjadi di SINI, bukan di pemanggil, supaya
     indikator dan penanda ikut terpotong pada batas yang sama persis. */
  hingga?: number;
  /** Garis horizontal (entry, SL, TP) untuk posisi yang sedang dibuka. */
  garisHarga?: GarisHarga[];
  /** Klik pada chart -> indeks bar. Dipakai untuk memulai replay dari situ. */
  onKlikBar?: (idx: number) => void;
  /** Deret SMI + garis sinyalnya, digambar di panel bawah. */
  smi?: { smi: (number | null)[]; signal: (number | null)[] } | null;
  /** Sisa waktu lilin berjalan, ditempel di sisi harga seperti TradingView. */
  mundur?: string;
  /** Isi pojok kiri atas chart — dipakai panel BUY/SELL. */
  pojok?: React.ReactNode;
  /** Garis entry/SL/TP yang bisa digeser. */
  garisSeret?: GarisSeret[];
  /** Dipanggil saat sebuah garis selesai digeser. */
  onSeret?: (id: GarisSeret['id'], harga: number) => void;
  /** Garisnya DISENTUH — diklik saja, atau diklik lalu diseret. Dipisah
   *  dari onSeret karena menyentuh dan menggeser adalah dua maksud yang
   *  berbeda: yang satu "saya mau mengurus garis ini", yang satu "nilainya
   *  jadi sekian". Halaman chart memakainya untuk memunculkan panel ubah
   *  order hanya ketika garisnya benar-benar dituju. */
  onKlikGaris?: (id: GarisSeret['id']) => void;
  /** Hapus satu garis lewat tombol ✕ di labelnya. */
  onHapusGaris?: (id: GarisSeret['id']) => void;
  /** Panel yang ditumpangkan di bagian bawah area harga — dipakai kendali
   *  replay, supaya ia menyatu dengan grafik alih-alih memanjangkan halaman. */
  hamparanBawah?: React.ReactNode;
  /** Trendline miring dari Pine (line.new) — bar → waktu di sini. */
  segmen?: SegmenPine[];
  /** Label BUY/SELL dari Pine (label.new / plotshape). */
  penandaPine?: PenandaPine[];
  /** Kotak zona dari Pine (box.new) — isi + bingkainya di kanvas. */
  kotakPine?: KotakPine[];
  /** Isian antar dua garis (linefill) — pewarna tengah channel paralel. */
  isianPine?: IsianPine[];
  /** Alat gambar yang sedang dipegang — null berarti kursor biasa. */
  alat?: JenisAlat | null;
  /** Dipanggil saat satu tarikan alat selesai. */
  onAlatSelesai?: (g: Omit<GambarAlat, 'id'>) => void;
  /** Gambar tangan yang sudah jadi — ukur, fib, kotak. */
  gambarAlat?: GambarAlat[];
  /** Gambar yang sedang terpilih (bingkai + pegangan). */
  gambarPilih?: string | null;
  /** Klik pada gambar memilihnya; klik ruang kosong membatalkan. */
  onPilihGambar?: (id: string | null) => void;
  /** Gambar terpilih digeser utuh, atau salah satu ujungnya ditarik.
   *  Tanpa handler ini gambar tetap beku setelah tertempel. */
  onUbahGambar?: (id: string, ubah: Partial<Pick<GambarAlat, 't1' | 'h1' | 't2' | 'h2'>>) => void;
  /** Posisi MT5 terbuka — price line entry/SL/TP + PnL + seret SL/TP. */
  posisiMt5?: PosisiChartMt5[];
  /** Kirim SL/TP baru sebuah posisi ke EA; resolve true kalau EA sukses.
   *  Tanpa handler ini SL/TP posisinya tidak bisa diseret sama sekali. */
  onUbahPosisi?: (tiket: string, sl: number, tp: number) => Promise<boolean>;
  /** Harga permintaan (ask) MT5 — garis penanda spread di atas bid. */
  hargaAsk?: number;
}) {
  const kotak = useRef<HTMLDivElement>(null);
  /* Diisi saat chart dibuat; dipanggil efek di bawah tiap kolomnya
     berubah lebar. */
  const ukurLagi = useRef<(() => void) | null>(null);
  const chart = useRef<IChartApi | null>(null);
  /* Grafik ini KANVAS, bukan SVG — warnanya tidak ikut variabel CSS
     seperti sisa aplikasi, jadi temanya harus dibaca dan dipasang
     tangan. Lihat catatan lengkapnya di lib/tema.ts. */
  const tema = useTema();
  const seri = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const seriGaris = useRef<ISeriesApi<'Line'>[]>([]);
  const penanda = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const seriSmi = useRef<ISeriesApi<'Line'>[]>([]);
  const garisPos = useRef<IPriceLine[]>([]);
  const isiPine = useRef<PenggambarIsi | null>(null);
  const alatPrim = useRef<PenggambarAlat | null>(null);
  /* Handler klik disimpan di ref supaya langganannya dipasang SEKALI.
     Melanggan ulang tiap render menumpuk pendengar di chart yang sama. */
  const klikRef = useRef(onKlikBar);
  /* Pemotret disimpan di ref, dan `bagikanFoto` juga — supaya efek pembuatan
     chart (yang sengaja berdependensi kosong agar chartnya tidak dibuat
     ulang tiap render) tetap memakai callback terbaru tanpa menjadikannya
     dependensi. */
  const fotoRef = useRef<(() => string | null) | null>(null);
  const bagikanFotoRef = useRef(bagikanFoto);
  bagikanFotoRef.current = bagikanFoto;
  useEffect(() => { if (fotoRef.current) bagikanFoto?.(fotoRef.current); }, [bagikanFoto]);
  klikRef.current = onKlikBar;

  /* Chart dibuat SEKALI. Membuatnya ulang tiap data berubah akan mengembalikan
     zoom dan posisi geser ke awal setiap 15 detik — dan chart yang melompat
     sendiri saat sedang dibaca lebih buruk daripada tidak ada chart. */
  useEffect(() => {
    if (!kotak.current) return;
    const c = createChart(kotak.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: WARNA_CHART[temaSekarang()].teks,
        fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: WARNA_CHART[temaSekarang()].kisi },
        horzLines: { color: WARNA_CHART[temaSekarang()].kisi },
      },
      rightPriceScale: { borderColor: WARNA_CHART[temaSekarang()].batasSkala },
      timeScale: { borderColor: WARNA_CHART[temaSekarang()].batasSkala, timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: WARNA_CHART[temaSekarang()].bidik, labelBackgroundColor: WARNA_CHART[temaSekarang()].labelBidik },
        horzLine: { color: WARNA_CHART[temaSekarang()].bidik, labelBackgroundColor: WARNA_CHART[temaSekarang()].labelBidik },
      },
      /* autoSize BAWAAN PUSTAKA TIDAK DIPAKAI.
         Diukur langsung: saat kolom chart menyempit karena watchlist
         ditarik keluar, `.tv-lightweight-charts` ikut menyempit tapi
         tabel di dalamnya tetap terkunci di lebar lama — lilinnya
         terpotong, bukan mengecil. Pengamat sendiri di bawah ini
         memanggil resize() dengan angka yang benar-benar terukur, jadi
         perilakunya tidak bergantung pada penafsiran pustaka terhadap
         perubahan tata letak flex. */
      width: kotak.current.clientWidth || 600,
      height: tinggi,
    });
    chart.current = c;

    /* Ukuran mengikuti wadahnya. Dipasang di sini, bukan di efek
       terpisah, supaya pengamatnya hidup dan mati bersama chartnya —
       pengamat yang menyintasi chart akan memanggil resize() pada objek
       yang sudah dibuang. */
    const wadah = kotak.current;
    const ukurUlang = () => {
      const l = wadah.clientWidth, t = wadah.clientHeight;
      if (l > 0 && t > 0) c.resize(l, t);
    };
    /* TIGA pemicu, sengaja bertumpuk — dan itu bukan kelebihan:
         · ResizeObserver menangkap perubahan tata letak apa pun;
         · window.resize menangkap jendela yang diubah ukurannya;
         · prop `kunciUkuran` menangkap kolom yang menyempit karena
           watchlist ditarik.
       ResizeObserver saja SEHARUSNYA cukup, tapi ia tidak menyala di
       semua lingkungan — terukur nol panggilan di panel pratinjau
       walau elemennya jelas berubah lebar. Chart yang tidak ikut
       menyempit memotong lilin di tepi kanan tanpa tanda apa pun, dan
       itu terlalu mahal untuk digantungkan pada satu mekanisme yang
       tidak bisa dipastikan ada. Memanggil resize() dua kali dengan
       angka yang sama tidak berbiaya. */
    const pengamat = new ResizeObserver(ukurUlang);
    pengamat.observe(wadah);
    window.addEventListener('resize', ukurUlang);
    ukurLagi.current = ukurUlang;
    seri.current = c.addSeries(CandlestickSeries, {
      upColor: '#10b981', downColor: '#f87171',
      borderUpColor: '#10b981', borderDownColor: '#f87171',
      wickUpColor: '#10b981', wickDownColor: '#f87171',
      priceFormat: { type: 'price', ...formatHarga(lilin.closes) },
    });
    /* Penggambar isian — zona S/R terisi warna dan pewarna tengah channel,
       digambar LANGSUNG di kanvas panel harga lewat primitive. Seri garis
       tidak bisa mengisi bidang di antara dua garis miring; kanvas bisa. */
    const prim = new PenggambarIsi();
    seri.current.attachPrimitive(prim);
    isiPine.current = prim;
    const primAlat = new PenggambarAlat();
    seri.current.attachPrimitive(primAlat);
    alatPrim.current = primAlat;
    c.subscribeClick((p) => {
      if (klikRef.current && typeof p.logical === 'number') klikRef.current(Math.round(p.logical));
    });

    /* Pemotret diserahkan ke pemanggil SEBAGAI FUNGSI, bukan dengan
       membocorkan objek chart-nya. Halaman yang butuh sampul cuma perlu
       satu kemampuan — memotret — dan memberi seluruh API chart untuk itu
       berarti halaman lain bisa diam-diam ikut menyetel skala, seri, atau
       menghapusnya.

       SELURUH KANVAS DI DALAM WADAH DITUMPUK, bukan cuma hasil
       `takeScreenshot()`.
       ────────────────────────────────────────────────────────────────────
       Catatan lama di sini menyatakan takeScreenshot() "memuat lilin,
       indikator, DAN alat gambar". Ternyata tidak: kotak SNR yang digambar
       orang hilang dari sampulnya. Sebabnya `PenggambarAlat` menggambar di
       lapisan `zOrder: 'top'`, dan lapisan itu kanvas terpisah yang tidak
       ikut terpotret.

       Menurunkan zOrder-nya akan menaruh alat gambar DI BAWAH lilin — bukan
       perbaikan, cuma memindah cacatnya. Jadi yang dilakukan: hasil potret
       dipakai sebagai alas, lalu tiap kanvas yang benar-benar ada di dalam
       wadah ditempelkan di atasnya pada posisinya sendiri. Apa pun yang
       digambar ke kanvas — alat gambar sekarang, apa pun yang ditambahkan
       nanti — ikut, tanpa perlu tahu lapisan mana milik siapa.

       Yang tetap TIDAK ikut: panel HTML melayang (tiket order, label garis
       yang sedang diseret, bilah alat). Mereka bukan kanvas, dan itu
       disebutkan di layar pratinjau sampul. */
    fotoRef.current = () => {
      try {
        const alas = c.takeScreenshot();
        const wadah = kotak.current;
        if (!wadah) return alas.toDataURL('image/jpeg', 0.85);

        const gabung = document.createElement('canvas');
        gabung.width = alas.width;
        gabung.height = alas.height;
        const ctx = gabung.getContext('2d');
        if (!ctx) return alas.toDataURL('image/jpeg', 0.85);
        ctx.drawImage(alas, 0, 0);

        /* Kanvas dalam berukuran piksel perangkat tapi DILETAKKAN dalam
           piksel CSS. Skalanya diturunkan dari lebar potret dibagi lebar
           wadah — bukan dari devicePixelRatio, yang bisa berbeda dari yang
           dipakai pustaka saat menggambar. */
        const rw = wadah.getBoundingClientRect();
        if (!rw.width) return gabung.toDataURL('image/jpeg', 0.85);
        const skala = alas.width / rw.width;

        for (const el of Array.from(wadah.querySelectorAll('canvas'))) {
          if (!el.width || !el.height) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          ctx.drawImage(el,
            (r.left - rw.left) * skala, (r.top - rw.top) * skala,
            r.width * skala, r.height * skala);
        }
        return gabung.toDataURL('image/jpeg', 0.85);
      } catch (e) { return null; }
    };
    bagikanFotoRef.current?.(fotoRef.current);

    return () => { pengamat.disconnect(); window.removeEventListener('resize', ukurUlang); ukurLagi.current = null; c.remove(); chart.current = null; seri.current = null; seriGaris.current = []; penanda.current = null; garisPos.current = []; isiPine.current = null; alatPrim.current = null; };
  }, []);

  /* Kolom chart berubah lebar (watchlist ditarik) → ukur ulang.
     Dipisah dari efek pembuatan chart supaya tidak membuat ulang
     chartnya — membuat ulang berarti zoom dan posisi geser kembali ke
     awal, dan itu terasa seperti kehilangan pekerjaan. */
  useEffect(() => {
    if (!ukurLagi.current) return;
    /* Diukur DUA KALI: sekali segera (tata letak flex sudah dihitung
       ulang saat efek ini jalan), sekali lagi sesaat kemudian untuk
       menangkap transisi CSS yang belum selesai.

       Memakai timer, bukan requestAnimationFrame: rAF tidak berjalan di
       halaman yang tidak sedang digambar — tab latar, atau panel
       pratinjau yang tidak tampil — dan chart yang ukurannya menunggu
       frame yang tidak pernah datang akan tetap salah lebar sampai
       disentuh. Timer jalan tanpa syarat itu. */
    ukurLagi.current();
    const id = window.setTimeout(() => ukurLagi.current?.(), 120);
    return () => window.clearTimeout(id);
  }, [kunciUkuran, tinggi]);

  /* ── Warna ikut tema ──────────────────────────────────────────────
     Dipasang lewat applyOptions, BUKAN dengan membuat ulang chartnya.
     Membuat ulang berarti kehilangan rentang yang sedang dilihat, alat
     gambar yang sedang terpasang, dan posisi gulir — mahal sekali untuk
     sesuatu yang cuma pergantian warna.

     Yang TIDAK ikut berubah: warna lilin naik/turun. Hijau dan merah itu
     arti, bukan hiasan, dan keduanya sudah cukup pekat untuk terbaca di
     atas putih maupun hitam. */
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const w = WARNA_CHART[tema];
    c.applyOptions({
      layout: { textColor: w.teks },
      grid: { vertLines: { color: w.kisi }, horzLines: { color: w.kisi } },
      rightPriceScale: { borderColor: w.batasSkala },
      timeScale: { borderColor: w.batasSkala },
      crosshair: {
        vertLine: { color: w.bidik, labelBackgroundColor: w.labelBidik },
        horzLine: { color: w.bidik, labelBackgroundColor: w.labelBidik },
      },
    });
  }, [tema]);

  /* Penanda apa yang TERAKHIR digambar, dipakai memutuskan jalur cepat.
     Disimpan di ref, bukan state: ia tidak boleh memicu render sendiri. */
  const terakhirBatas = useRef(0);
  const terakhirLilin = useRef<unknown>(null);
  const terakhirBatasSmi = useRef(0);
  const terakhirSmi = useRef<unknown>(null);
  const terakhirLilinSmi = useRef<unknown>(null);

  /* Data lilin */
  useEffect(() => {
    if (!seri.current) return;
    const c = chart.current;
    if (!lilin.times.length) return;
    /* Rentang yang SEDANG DILIHAT disimpan dulu, dipasang lagi sesudah
       setData.
       ────────────────────────────────────────────────────────────────
       setData membuat lightweight-charts menggulir sendiri ke ujung
       kanan data. Untuk penyegaran harga biasa itu benar — lilin baru
       memang ada di ujung. Tapi saat REPLAY, `hingga` memotong datanya:
       ujung kanan berpindah jauh ke masa lalu, chart melompat ke sana,
       dan orangnya kehilangan tempat yang baru saja ia bidik.

       Dua efek lain di bawah (garis & alat) sudah memakai pola yang sama
       persis. Efek inilah satu-satunya yang terlewat — dan karena ia yang
       memegang lilinnya, justru dialah yang paling terlihat melompat. */
    const batas = hingga === undefined ? lilin.times.length : Math.max(1, Math.min(lilin.times.length, hingga + 1));

    /* ── JALUR CEPAT: replay maju satu bar ────────────────────────────────
       Kasus yang paling sering saat replay berjalan, dan satu-satunya yang
       benar-benar butuh cepat. `update()` menyentuh SATU lilin; `setData`
       menyusun ulang semuanya. Di 3000 bar bedanya bukan halus — itu selisih
       antara replay yang mengalir dan replay yang tersendat.

       Sengaja TIDAK menyimpan-memulihkan visible range di sini: yang membuat
       chart melompat adalah setData, bukan update. Melewatinya menghilangkan
       dua operasi tata letak lagi per tick. */
    const jalurCepatReplay =
      terakhirLilin.current === lilin &&
      batas === terakhirBatas.current + 1 &&
      batas <= lilin.times.length;

    if (jalurCepatReplay) {
      const i = batas - 1;
      seri.current.update({
        time: Math.floor(lilin.times[i] / 1000) as Time,
        open: lilin.opens[i], high: lilin.highs[i], low: lilin.lows[i], close: lilin.closes[i],
      });
      terakhirBatas.current = batas;
      return;
    }

    terakhirLilin.current = lilin;
    terakhirBatas.current = batas;

    const tampak = c?.timeScale().getVisibleRange() ?? null;
    seri.current.setData(lilin.times.slice(0, batas).map((t, i) => ({
      /* lightweight-charts memakai DETIK, bukan milidetik. Mengirim ms
         menaruh setiap lilin di tahun 58.000 dan sumbunya jadi kosong. */
      time: Math.floor(t / 1000) as Time,
      open: lilin.opens[i], high: lilin.highs[i], low: lilin.lows[i], close: lilin.closes[i],
    })));

    /* Dikembalikan berdasarkan WAKTU, bukan nomor bar.
       ────────────────────────────────────────────────────────────────
       Versi sebelumnya menyimpan getVisibleLogicalRange() — nomor bar.
       Itu gagal persis pada kasus yang paling penting: memotong 3000 bar
       jadi 2154 membuat nomor yang disimpan (mis. 2500–3010) menunjuk ke
       LUAR data, pustaka membetulkannya sendiri, dan chart melompat.
       Lebih buruk lagi, efek garis di bawah lalu menyimpan posisi yang
       sudah terlanjur melompat itu dan menguncinya.

       Waktu tidak bergeser saat data dipotong: 3 Februari tetap 3
       Februari. Jadi jendela yang sama tetap menunjuk lilin yang sama.

       Kalau jendelanya menjulur melewati lilin terakhir (persis yang
       terjadi saat titik replay dipilih), jendelanya DIGESER KIRI dengan
       lebar yang sama — bukan dipendekkan. Lebar tetap berarti tingkat
       zoom tidak berubah; yang berubah cuma bar terakhir kini duduk di
       tepi kanan, tempat orangnya memang akan melanjutkan. */
    if (tampak && c && batas > 1) {
      const akhirData = Math.floor(lilin.times[batas - 1] / 1000);
      const dari = Number(tampak.from), ke = Number(tampak.to);
      const lebar = ke - dari;
      const keBaru = Math.min(ke, akhirData);
      const dariBaru = keBaru - lebar;
      /* Tidak dipaksakan kalau jendelanya jadi mulai sebelum lilin
         pertama — rentang yang lebih lebar daripada datanya membuat
         pustaka menggambar sumbu waktu yang tidak masuk akal. */
      const awalData = Math.floor(lilin.times[0] / 1000);
      try {
        c.timeScale().setVisibleRange({
          from: (dariBaru < awalData ? awalData : dariBaru) as Time,
          to: keBaru as Time,
        });
      } catch { /* chart baru / rentang tidak sah */ }
    }
  }, [lilin, hingga]);

  /* Garis harga posisi (entry / SL / TP) */
  useEffect(() => {
    const s = seri.current;
    if (!s) return;
    garisPos.current.forEach((g) => s.removePriceLine(g));
    garisPos.current = (garisHarga ?? []).map((g) => s.createPriceLine({
      price: g.harga, color: g.warna, lineWidth: 1,
      lineStyle: 2, axisLabelVisible: true, title: g.label,
    }));
  }, [garisHarga]);

  /* ── Panel SMI ──────────────────────────────────────────────────────
     Panel TERPISAH (paneIndex 1), bukan ditumpuk di atas harga: SMI bergerak
     di rentang -100..100 sementara harga di puluhan ribu, dan menggabungkan
     keduanya di satu sumbu membuat salah satunya jadi garis lurus. */
  /* Seri SMI dibuat saat indikatornya MENYALA — sekali, bukan tiap bar.
     ──────────────────────────────────────────────────────────────────────
     Efek lama membongkar-pasang seri setiap `hingga` berubah — sekali per
     bar replay. Tiap bongkar-pasang membuat panel 1 lenyap sekejap lalu
     lahir lagi dengan tinggi bawaan, dan pembatas panelnya tampak meloncat
     naik-turun sepanjang replay. Datanya sendiri cukup di-setData. */
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    seriSmi.current.forEach((s) => { try { c.removeSeries(s); } catch { /* sudah lepas */ } });
    seriSmi.current = [];
    if (!smi || !lilin.times.length) return;

    const buat = (warna: string, tebal: 1 | 2) => {
      const s = c.addSeries(LineSeries, {
        color: warna, lineWidth: tebal, priceLineVisible: false, lastValueVisible: false,
      }, 1);
      seriSmi.current.push(s);
    };
    buat('#fbbf24', 2);
    buat('#60a5fa', 1);

    /* Ambang jenuh +50 / -50 — angka yang SAMA dengan SMI_OB dan SMI_OS di
       jt-scan-core, yaitu ambang yang dipakai kartu sinyal untuk menyebut
       sebuah koin overbought atau oversold. Garis di sini harus sama persis
       dengan ambang di sana, kalau tidak chart dan kartu akan berbeda
       pendapat tentang koin yang sama. */
    const acuan = seriSmi.current[0];
    if (acuan) {
      [50, -50].forEach((v) => acuan.createPriceLine({
        price: v, color: WARNA_CHART[temaSekarang()].garisNol, lineWidth: 1, lineStyle: 2,
        axisLabelVisible: false, title: '',
      }));
    }
    try { c.panes()[1]?.setHeight(tinggiSmi.current); } catch { /* versi tanpa panes API */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smi === null, lilin.times.length === 0]);

  /* Data SMI dipotong lewat setData pada seri yang SAMA — pembatas panel
     tidak tersentuh, jadi ia diam selama replay berjalan bar demi bar. */
  useEffect(() => {
    if (!smi || seriSmi.current.length < 2 || !lilin.times.length) return;
    const batas = hingga === undefined ? lilin.times.length : Math.max(1, Math.min(lilin.times.length, hingga + 1));

    /* Jalur cepat yang sama dengan seri lilin: maju satu bar cuma perlu
       menyentuh satu titik di tiap seri, bukan menyusun ulang keduanya.
       Bobotnya sepadan dengan lilin — dua seri sepanjang data yang sama. */
    const jalurCepatSmi =
      terakhirSmi.current === smi &&
      terakhirLilinSmi.current === lilin &&
      batas === terakhirBatasSmi.current + 1;

    if (jalurCepatSmi) {
      const i = batas - 1;
      const t = Math.floor(lilin.times[i] / 1000) as Time;
      /* Nilai null dilewati, tidak dipaksakan: isi() memang membuangnya, dan
         mengirim null ke update() membuat pustaka melempar. */
      const v0 = smi.smi[i], v1 = smi.signal[i];
      if (v0 != null && isFinite(v0)) seriSmi.current[0].update({ time: t, value: v0 });
      if (v1 != null && isFinite(v1)) seriSmi.current[1].update({ time: t, value: v1 });
      terakhirBatasSmi.current = batas;
      return;
    }

    terakhirSmi.current = smi;
    terakhirLilinSmi.current = lilin;
    terakhirBatasSmi.current = batas;

    const isi = (nilai: (number | null)[]) =>
      lilin.times.slice(0, batas)
        .map((t, i) => ({ time: Math.floor(t / 1000) as Time, value: nilai[i] }))
        .filter((x): x is { time: Time; value: number } => x.value != null && isFinite(x.value));
    seriSmi.current[0].setData(isi(smi.smi));
    seriSmi.current[1].setData(isi(smi.signal));
  }, [smi, lilin, hingga]);

  /* Garis indikator */
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    /* Jendela pandang DISIMPAN lalu DIPULIHKAN. Membongkar-pasang seri —
       apalagi yang datanya menjulur ke masa depan — menggeser pemetaan
       skala waktu, dan chart tampak berjalan maju-mundur sendiri setiap
       data disegarkan. Zoom dan posisi geser milik orangnya, bukan milik
       penyegaran data. */
    const rentang = c.timeScale().getVisibleLogicalRange();
    seriGaris.current.forEach((s) => c.removeSeries(s));
    seriGaris.current = [];
    (garis ?? []).forEach((g) => {
      const s = c.addSeries(LineSeries, {
        color: g.warna, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      const batas = hingga === undefined ? lilin.times.length : Math.max(1, Math.min(lilin.times.length, hingga + 1));
      s.setData(
        lilin.times.slice(0, batas)
          .map((t, i) => ({ time: Math.floor(t / 1000) as Time, value: g.nilai[i] }))
          .filter((x): x is { time: Time; value: number } => x.value != null && isFinite(x.value))
      );
      seriGaris.current.push(s);
    });
    if (rentang) { try { c.timeScale().setVisibleLogicalRange(rentang); } catch { /* chart baru */ } }
  }, [garis, lilin, hingga]);

  /* ── Trendline & kotak dari Pine ───────────────────────────────────
     line.new Pine memakai KOORDINAT BAR; lightweight-charts memakai waktu.
     Bar di dalam data dipetakan langsung; bar di masa depan (garis yang
     diperpanjang ke kanan) diekstrapolasi dari durasi timeframe — chart
     menerima stempel waktu masa depan sebagai ruang kosong. */
  const seriPine = useRef<ISeriesApi<'Line'>[]>([]);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    /* Alasan yang sama dengan garis indikator: gambar Pine dibongkar-pasang
       saat dihitung ulang, dan tanpa pemulihan rentang setiap hitung ulang
       melempar jendela pandang ke tempat lain. */
    const rentang = c.timeScale().getVisibleLogicalRange();
    seriPine.current.forEach((s) => { try { c.removeSeries(s); } catch { /* lepas */ } });
    seriPine.current = [];
    if (!lilin.times.length) { isiPine.current?.setData([], []); return; }
    const n = lilin.times.length;
    const tfMs = n > 1 ? lilin.times[1] - lilin.times[0] : 3_600_000;
    const waktuBar = (x: number) => {
      const b = Math.round(x);
      const ms = b < n ? lilin.times[Math.max(0, b)] : lilin.times[n - 1] + (b - (n - 1)) * tfMs;
      return Math.floor(ms / 1000) as Time;
    };
    const gambarGaris = (x1: number, y1: number, x2: number, y2: number, warna: string, lebar: number, gaya: 'solid' | 'dashed' | 'dotted') => {
      if (x1 === x2) return;
      let [a, va, b, vb] = x1 < x2 ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
      const s = c.addSeries(LineSeries, {
        color: warna, lineWidth: Math.min(4, Math.max(1, Math.round(lebar))) as 1 | 2 | 3 | 4,
        lineStyle: gaya === 'dashed' ? 2 : gaya === 'dotted' ? 1 : 0,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      /* Titik antara ikut digambar supaya garisnya lurus melintasi bar —
         dua titik saja cukup untuk lightweight-charts, tapi bar renggang
         (whitespace masa depan) butuh titik nyata di tiap ujung. */
      const kemiringan = (vb - va) / (b - a);
      const data: { time: Time; value: number }[] = [];
      for (let x = Math.max(0, Math.floor(a)); x <= b; x++) {
        data.push({ time: waktuBar(x), value: va + kemiringan * (x - a) });
      }
      if (data.length >= 2) { s.setData(data); seriPine.current.push(s); }
      else { try { c.removeSeries(s); } catch { /* kosong */ } }
    };
    (segmen ?? []).forEach((g) => {
      let { x1, y1, x2, y2 } = g;
      const kemiringan = x2 !== x1 ? (y2 - y1) / (x2 - x1) : 0;
      if (g.perpanjang === 'left' || g.perpanjang === 'both') { y1 = y1 + kemiringan * (0 - x1); x1 = 0; }
      if (g.perpanjang === 'right' || g.perpanjang === 'both') { const xr = n - 1 + 15; y2 = y2 + kemiringan * (xr - x2); x2 = xr; }
      gambarGaris(x1, y1, x2, y2, g.warna, g.lebar, g.gaya);
    });
    /* Kotak & isian BUKAN seri garis — mereka bidang, dan bidang digambar
       sebagai bidang: primitive kanvas mengisi persegi/poligonnya di bawah
       lilin, persis zona Supply/Demand dan fill channel di TradingView.
       Model lama (dua garis tepi per kotak) itulah sumber "garis putih
       misterius": zona yang kehilangan isinya. */
    isiPine.current?.setData(
      (kotakPine ?? []).map((k) => ({ b1: k.kiri, b2: k.kanan, atas: k.atas, bawah: k.bawah, isi: k.warna, tepi: k.garis })),
      (isianPine ?? []).map((f) => {
        let { x2, y2a, y2b } = f;
        if (f.perpanjang === 'right' && x2 > f.x1) {
          const xr = n - 1 + 15;
          if (xr > x2) {
            y2a = y2a + ((y2a - f.y1a) / (x2 - f.x1)) * (xr - x2);
            y2b = y2b + ((y2b - f.y1b) / (x2 - f.x1)) * (xr - x2);
            x2 = xr;
          }
        }
        return { x1: f.x1, ya1: f.y1a, yb1: f.y1b, x2, ya2: y2a, yb2: y2b, warna: f.warna };
      })
    );
    if (rentang) { try { c.timeScale().setVisibleLogicalRange(rentang); } catch { /* chart baru */ } }
  }, [segmen, kotakPine, isianPine, lilin]);

  /* Penanda entry & exit tiap trade hasil backtest */
  useEffect(() => {
    if (!seri.current) return;
    /* Plugin penanda dibuat sekali lalu dipakai ulang. Memanggil
       createSeriesMarkers tiap render menumpuk plugin di seri yang sama. */
    const p = penanda.current ?? (penanda.current = createSeriesMarkers(seri.current, []));
    const tanda = (trade ?? []).flatMap((t) => [
      {
        time: Math.floor(t.masukWaktu / 1000) as Time,
        position: (t.arah === 'BUY' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
        color: t.arah === 'BUY' ? '#10b981' : '#f87171',
        shape: (t.arah === 'BUY' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
        text: `#${t.no}`,
      },
      {
        time: Math.floor(t.keluarWaktu / 1000) as Time,
        position: (t.arah === 'BUY' ? 'aboveBar' : 'belowBar') as 'belowBar' | 'aboveBar',
        /* Warna mengikuti HASIL, bukan arah — yang ingin dilihat sekilas dari
           penanda keluar adalah menang atau kalah. */
        color: t.pnl >= 0 ? '#10b981' : '#f87171',
        shape: 'circle' as const,
        text: t.sebab,
      },
    ]);
    /* Label Pine ikut lewat plugin penanda yang sama — satu saluran untuk
       semua tanda di atas lilin. */
    (penandaPine ?? []).forEach((m) => {
      if (m.bar < 0 || m.bar >= lilin.times.length) return;
      tanda.push({
        time: Math.floor(lilin.times[m.bar] / 1000) as Time,
        position: (m.posisi === 'bawah' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
        color: m.warna,
        shape: (m.posisi === 'bawah' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
        text: m.teks.split('\n')[0].slice(0, 18),
      });
    });
    tanda.sort((a, b) => (a.time as number) - (b.time as number));
    p.setMarkers(tanda);
  }, [trade, penandaPine, lilin]);

  /* ── Gambar tangan: data + interaksi tariknya ──────────────────────
     Saat sebuah alat dipegang, seret-geser chart DIMATIKAN dan kursor jadi
     crosshair: satu gerakan tarik = satu gambar. Koordinatnya stempel
     waktu, jadi gambarnya tidak merayap saat lilin baru lahir. */
  useEffect(() => {
    const n = lilin.times.length;
    const tfMs = n > 1 ? lilin.times[1] - lilin.times[0] : 3_600_000;
    alatPrim.current?.setData(gambarAlat ?? [], { tAkhir: n ? lilin.times[n - 1] : 0, tfMs, n });
  }, [gambarAlat, lilin]);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.applyOptions({ handleScroll: !alat, handleScale: !alat });
    if (kotak.current) kotak.current.style.cursor = alat ? 'crosshair' : '';
  }, [alat]);

  useEffect(() => { alatPrim.current?.setPilih(gambarPilih ?? null); }, [gambarPilih]);
  /* Dibaca di dalam penangan mousedown yang dipasang SEKALI — kalau dibaca
     dari closure, penangannya harus dipasang ulang tiap kali pilihan
     berubah, dan seretan yang sedang berjalan ikut putus. */
  const pilihRef = useRef(gambarPilih ?? null);
  pilihRef.current = gambarPilih ?? null;

  /* ── Memilih gambar dengan klik (mode kursor biasa) ─────────────────
     Klik = mousedown+mouseup yang nyaris tidak bergerak; seretan panning
     chart bukan pilihan. Uji-kenanya kotak pembatas berpelonggar 8 px —
     garis setipis 1 px mustahil diklik persis. */
  const acuanPilih = useRef({ alat, gambarAlat });
  acuanPilih.current = { alat, gambarAlat };
  useEffect(() => {
    if (!onPilihGambar) return;
    const el = kotak.current;
    if (!el) return;
    let awal: { x: number; y: number } | null = null;
    const turun = (e: MouseEvent) => { awal = { x: e.clientX, y: e.clientY }; };
    const klik = (e: MouseEvent) => {
      const { alat: a, gambarAlat: gs } = acuanPilih.current;
      if (a) return;
      if (awal && Math.hypot(e.clientX - awal.x, e.clientY - awal.y) > 5) return;
      const c = chart.current, s = seri.current;
      if (!c || !s) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const X = (t: number): number | null => {
        const x = c.timeScale().timeToCoordinate(Math.floor(t / 1000) as Time);
        if (x != null) return x;
        const times = acuan.current.lilin.times;
        if (times.length < 2) return null;
        const tfMs = times[1] - times[0];
        return c.timeScale().logicalToCoordinate((times.length - 1 + (t - times[times.length - 1]) / tfMs) as Logical);
      };
      let kena: string | null = null;
      const daftar = gs ?? [];
      for (let i = daftar.length - 1; i >= 0; i--) {
        const g = daftar[i];
        const x1 = X(g.t1), x2 = X(g.t2);
        const y1 = s.priceToCoordinate(g.h1), y2 = s.priceToCoordinate(g.h2);
        if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
        if (g.jenis === 'garis') {
          /* Garis tren diagonal: kotak pembatasnya luas — yang diuji JARAK
             ke ruasnya, supaya hanya klik di dekat garisnya yang memilih,
             bukan seluruh area segitiga kosong di sekitarnya. */
          const dx = x2 - x1, dy = y2 - y1;
          const pj = dx * dx + dy * dy;
          const t = pj ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / pj)) : 0;
          if (Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) <= 7) { kena = g.id; break; }
          continue;
        }
        if (px >= Math.min(x1, x2) - 8 && px <= Math.max(x1, x2) + 8
          && py >= Math.min(y1, y2) - 8 && py <= Math.max(y1, y2) + 8) { kena = g.id; break; }
      }
      onPilihGambar(kena);
    };
    el.addEventListener('mousedown', turun);
    el.addEventListener('click', klik);
    return () => { el.removeEventListener('mousedown', turun); el.removeEventListener('click', klik); };
  }, [onPilihGambar]);

  /* ── Menggeser & menarik ujung gambar yang sudah tertempel ───────────
     Gambar yang sudah jadi dulu BEKU: satu-satunya cara memperbaiki
     trendline yang meleset dua piksel adalah menghapusnya lalu menggambar
     ulang dari nol. Sekarang gambar terpilih bisa digeser utuh, dan tiap
     ujungnya bisa ditarik sendiri — jadi memperpanjang trendline tidak
     lagi berarti kehilangan sudut yang sudah pas.

     Yang dipegang selama seretan: waktu & harga, bukan piksel. Chart yang
     ikut bergeser di tengah seretan (harga baru masuk) tidak menyeret
     gambarnya ikut pindah. */
  const seretGambar = useRef<
    { id: string; mode: 'geser' | 'ujung1' | 'ujung2'; awal: GambarAlat; t: number; h: number } | null
  >(null);

  useEffect(() => {
    if (!onUbahGambar) return;
    const el = kotak.current;
    if (!el) return;

    const posisiDari = (e: MouseEvent) => {
      const c = chart.current, s = seri.current;
      if (!c || !s) return null;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const paneH = paneHargaRef.current || rect.height;
      const y = Math.min(Math.max(e.clientY - rect.top, 2), paneH - 2);
      const h = s.coordinateToPrice(y);
      if (typeof h !== 'number' || !isFinite(h)) return null;
      const t = c.timeScale().coordinateToTime(x);
      if (t != null) return { t: (t as number) * 1000, h, x, y };
      const l = c.timeScale().coordinateToLogical(x);
      const times = acuan.current.lilin.times;
      if (l == null || times.length < 2) return null;
      const tfMs = times[1] - times[0];
      return { t: times[times.length - 1] + (l - (times.length - 1)) * tfMs, h, x, y };
    };

    const koordinat = (g: GambarAlat) => {
      const c = chart.current, s = seri.current;
      if (!c || !s) return null;
      const X = (t: number): number | null => {
        const x = c.timeScale().timeToCoordinate(Math.floor(t / 1000) as Time);
        if (x != null) return x;
        const times = acuan.current.lilin.times;
        if (times.length < 2) return null;
        const tfMs = times[1] - times[0];
        return c.timeScale().logicalToCoordinate((times.length - 1 + (t - times[times.length - 1]) / tfMs) as Logical);
      };
      const x1 = X(g.t1), x2 = X(g.t2);
      const y1 = s.priceToCoordinate(g.h1), y2 = s.priceToCoordinate(g.h2);
      if (x1 == null || x2 == null || y1 == null || y2 == null) return null;
      return { x1, y1, x2, y2 };
    };

    const turun = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const { alat: a, gambarAlat: gs } = acuanPilih.current;
      if (a) return;                       // sedang memegang alat: itu menggambar baru
      const pilihId = pilihRef.current;
      if (!pilihId) return;                // hanya gambar TERPILIH yang bisa digeser
      const g = (gs ?? []).find((x) => x.id === pilihId);
      if (!g) return;
      const p = posisiDari(e);
      const k = koordinat(g);
      if (!p || !k) return;

      /* Pegangan menang atas badan: ujung yang berada di dalam badan kotak
         tetap harus bisa ditarik sendiri. */
      const dekat = (hx: number, hy: number) => Math.hypot(p.x - hx, p.y - hy) <= 9;
      let mode: 'geser' | 'ujung1' | 'ujung2' | null = null;
      if (dekat(k.x1, k.y1)) mode = 'ujung1';
      else if (dekat(k.x2, k.y2)) mode = 'ujung2';
      else if (g.jenis !== 'garis' && dekat(k.x1, k.y2)) mode = 'ujung1';
      else if (g.jenis !== 'garis' && dekat(k.x2, k.y1)) mode = 'ujung2';
      else {
        /* Di dalam badannya? Untuk garis: dekat ruasnya. Untuk yang lain:
           di dalam kotaknya. */
        if (g.jenis === 'garis') {
          const dx = k.x2 - k.x1, dy = k.y2 - k.y1;
          const pj = dx * dx + dy * dy;
          const tt = pj ? Math.max(0, Math.min(1, ((p.x - k.x1) * dx + (p.y - k.y1) * dy) / pj)) : 0;
          if (Math.hypot(p.x - (k.x1 + tt * dx), p.y - (k.y1 + tt * dy)) <= 7) mode = 'geser';
        } else if (p.x >= Math.min(k.x1, k.x2) - 4 && p.x <= Math.max(k.x1, k.x2) + 4
          && p.y >= Math.min(k.y1, k.y2) - 4 && p.y <= Math.max(k.y1, k.y2) + 4) {
          mode = 'geser';
        }
      }
      if (!mode) return;

      seretGambar.current = { id: g.id, mode, awal: { ...g }, t: p.t, h: p.h };
      document.body.style.cursor = mode === 'geser' ? 'move' : 'grabbing';
      chart.current?.applyOptions({ handleScroll: false, handleScale: false });
      e.preventDefault();
      e.stopPropagation();
    };

    const gerak = (e: MouseEvent) => {
      const sg = seretGambar.current;
      if (!sg) return;
      const p = posisiDari(e);
      if (!p) return;
      e.preventDefault();
      const a = sg.awal;
      if (sg.mode === 'geser') {
        const dt = p.t - sg.t, dh = p.h - sg.h;
        onUbahGambar(sg.id, { t1: a.t1 + dt, h1: a.h1 + dh, t2: a.t2 + dt, h2: a.h2 + dh });
      } else if (sg.mode === 'ujung1') {
        onUbahGambar(sg.id, { t1: p.t, h1: p.h });
      } else {
        onUbahGambar(sg.id, { t2: p.t, h2: p.h });
      }
    };

    const lepas = () => {
      if (!seretGambar.current) return;
      seretGambar.current = null;
      document.body.style.cursor = '';
      chart.current?.applyOptions({ handleScroll: true, handleScale: true });
    };

    /* Fase capture supaya menang atas penangan geser chart bawaan.
       POINTER events, bukan mouse: di layar sentuh, seretan jari tidak
       pernah membangkitkan mousemove — semua seretan di chart ini mati
       total di HP sebelum diganti. pointercancel disamakan dengan lepas:
       peramban yang merebut gerakan (mis. memutuskan ini scroll) tidak
       boleh meninggalkan seretan menggantung. */
    el.addEventListener('pointerdown', turun, true);
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
    window.addEventListener('pointercancel', lepas);
    return () => {
      el.removeEventListener('pointerdown', turun, true);
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      window.removeEventListener('pointercancel', lepas);
      seretGambar.current = null;
    };
  }, [onUbahGambar]);

  const tarikAlat = useRef<{ t1: number; h1: number } | null>(null);
  useEffect(() => {
    if (!alat || !onAlatSelesai) return;
    const el = kotak.current;
    if (!el) return;

    const posisiDari = (e: MouseEvent): { t: number; h: number } | null => {
      const c = chart.current, s = seri.current;
      if (!c || !s) return null;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const paneH = paneHargaRef.current || rect.height;
      const y = Math.min(Math.max(e.clientY - rect.top, 2), paneH - 2);
      const h = s.coordinateToPrice(y);
      if (typeof h !== 'number' || !isFinite(h)) return null;
      /* Waktu dari koordinat; di luar data (kanan lilin terakhir) jatuh ke
         sumbu logika + durasi timeframe. */
      const t = c.timeScale().coordinateToTime(x);
      if (t != null) return { t: (t as number) * 1000, h };
      const l = c.timeScale().coordinateToLogical(x);
      const times = acuan.current.lilin.times;
      if (l == null || times.length < 2) return null;
      const tfMs = times[1] - times[0];
      return { t: times[times.length - 1] + (l - (times.length - 1)) * tfMs, h };
    };

    const turun = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const p = posisiDari(e);
      if (!p) return;
      tarikAlat.current = { t1: p.t, h1: p.h };
      alatPrim.current?.setPratinjau({ jenis: alat, t1: p.t, h1: p.h, t2: p.t, h2: p.h });
      e.preventDefault();
      e.stopPropagation();
    };
    const gerak = (e: MouseEvent) => {
      const a = tarikAlat.current;
      if (!a) return;
      const p = posisiDari(e);
      if (!p) return;
      alatPrim.current?.setPratinjau({ jenis: alat, t1: a.t1, h1: a.h1, t2: p.t, h2: p.h });
    };
    const lepas = (e: MouseEvent) => {
      const a = tarikAlat.current;
      if (!a) return;
      tarikAlat.current = null;
      alatPrim.current?.setPratinjau(null);
      const p = posisiDari(e);
      /* Klik tanpa tarikan bukan gambar — titik tunggal tidak menyimpan
         informasi apa pun. */
      if (p && (Math.abs(p.t - a.t1) > 1 || p.h !== a.h1)) {
        onAlatSelesai({ jenis: alat, t1: a.t1, h1: a.h1, t2: p.t, h2: p.h });
      }
    };
    /* pointercancel ≠ pointerup: koordinat pada cancel tidak bisa
       dipercaya, jadi tarikannya DIBUANG, bukan dikomit jadi gambar. */
    const batal = () => { tarikAlat.current = null; alatPrim.current?.setPratinjau(null); };
    /* Fase capture: menang atas penangan chart & garis seret. Pointer,
       bukan mouse — supaya menggambar dengan jari juga jalan.

       Selama alat terpasang, geser/zoom chart DIMATIKAN: stopPropagation
       menahan mousedown dari lightweight-charts, tapi pustaka itu memasang
       pendengar touchstart-nya sendiri yang tidak ikut tertahan — di HP,
       menarik kotak SNR jadi sekaligus menggeser chartnya. */
    chart.current?.applyOptions({ handleScroll: false, handleScale: false });
    el.addEventListener('pointerdown', turun, true);
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
    window.addEventListener('pointercancel', batal);
    return () => {
      chart.current?.applyOptions({ handleScroll: true, handleScale: true });
      el.removeEventListener('pointerdown', turun, true);
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      window.removeEventListener('pointercancel', batal);
      tarikAlat.current = null;
      alatPrim.current?.setPratinjau(null);
    };
  }, [alat, onAlatSelesai]);

  /* ── Menempelkan hamparan ke skala harga ───────────────────────────
     Posisinya ditulis LANGSUNG ke gaya elemennya di dalam
     requestAnimationFrame, bukan lewat state React.

     Sebelumnya ini setInterval 200 ms yang memanggil setState. Dua akibatnya
     terasa keduanya: label bergerak dalam langkah 200 ms sementara kanvasnya
     bergerak tiap frame — jadi saat grafik digeser naik-turun labelnya
     tertinggal di belakang dan terlihat lepas dari harganya; dan tiap
     perpindahan memaksa React menggambar ulang seluruh chart.

     Menulis style.top di dalam rAF membuat label dan kanvas bergerak pada
     frame yang SAMA, dan React tidak dilibatkan sama sekali. */
  const tinggiSmi = useRef(bacaTinggiSmi());
  const labelRef = useRef<HTMLDivElement>(null);
  const garisRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const hamparanRef = useRef<HTMLDivElement>(null);
  const seret = useRef<{ id: string; mulaiY: number } | null>(null);
  /* Tinggi panel harga, diisi pasang() saat terbaca. Penjepit seret dan
     penyembunyi label memakai angka yang SAMA — kalau tidak, harga hasil
     jepitan bisa jatuh di wilayah yang penyembunyinya anggap "di luar". */
  const paneHargaRef = useRef(0);

  /* ── Ubahan SL/TP posisi MT5 ────────────────────────────────────────
     Satu ubahan hidup pada satu waktu: nilai yang sedang diseret MENANG
     atas nilai broker di garisnya (pratinjau), lalu menunggu tombol
     Kirim. `terkirim` menahan pratinjaunya setelah EA sukses — laporan
     EA berikutnya butuh beberapa detik, dan garis yang melompat balik ke
     nilai lama selama jeda itu terlihat seperti perintah yang gagal.

     Nilainya hidup DI DUA TEMPAT dengan sengaja: state React hanya untuk
     kapan tombol Kirim tampil (berubah saat seretan mulai/lepas), dan
     ref untuk nilai per-gerakan kursor. Kalau tiap mousemove menyentuh
     state, seluruh chart digambar ulang puluhan kali per detik — itulah
     "berat" yang dirasakan saat menyeret. */
  type UbahMt5 = {
    tiket: string; sl: number; tp: number;
    bidang: 'sl' | 'tp'; sibuk: boolean; terkirim: boolean;
  };
  const [ubah, setUbah] = useState<UbahMt5 | null>(null);
  const ubahRef = useRef<UbahMt5 | null>(null);
  const aturUbah = useCallback((v: UbahMt5 | null) => { ubahRef.current = v; setUbah(v); }, []);
  const seretUbah = useRef<{ tiket: string; bidang: 'sl' | 'tp' } | null>(null);
  /* Garis mana yang sedang DIPILIH. Bawaannya tidak ada: garis order polos
     saja — angkanya sudah tercetak di sumbu harga, dan nama serta tombol
     hapus di badan chart cuma menutupi lilin yang sedang dibaca.

     Nama dan tanda × baru muncul di garis yang diklik. Alasannya bukan
     kerapian semata: × adalah tombol yang MENGHAPUS, dan tombol hapus yang
     selalu tergeletak di dekat harga adalah tombol yang cepat atau lambat
     tersenggol. Menyembunyikannya sampai garisnya dipilih membuat menghapus
     jadi dua langkah yang disengaja, bukan satu klik refleks. */
  const [garisAktif, setGarisAktif] = useState<string | null>(null);

  const garisPosMt5 = useRef<IPriceLine[]>([]);
  /* Price line untuk garis SERET (Entry/SL/TP tiket & order yang disunting).
     Terpisah dari garisPosMt5 supaya keduanya bisa dibongkar sendiri-sendiri:
     yang satu berubah tiap laporan EA, yang ini tiap seretan. */
  const garisSeretHarga = useRef<IPriceLine[]>([]);
  /* SL/TP per tiket dipegang lewat peta supaya seretan bisa MENGGESER
     garis yang sudah ada (applyOptions) alih-alih membongkar-pasang
     semua price line tiap gerakan. */
  const petaGarisMt5 = useRef<Map<string, IPriceLine>>(new Map());
  const garisAsk = useRef<IPriceLine | null>(null);

  /* Nilai terbaru dibaca dari ref di dalam rAF. Kalau dibaca dari closure,
     loopnya harus dipasang ulang tiap render — dan itu mengalahkan
     tujuannya. */
  const acuan = useRef({ garisSeret, lilin, hingga, posisiMt5 });
  acuan.current = { garisSeret, lilin, hingga, posisiMt5 };

  const hargaDariY = useCallback((y: number) => {
    const s = seri.current;
    if (!s || !kotak.current) return null;
    const rect = kotak.current.getBoundingClientRect();
    /* DIJEPIT ke panel harga. Tanpa penjepit, seretan yang lewat tepi chart
       terus menghasilkan harga — garisnya mengikuti kursor ke panel SMI dan
       ke panel-panel di bawahnya. Batasnya bukan layar; batasnya panel
       harga. */
    const paneH = paneHargaRef.current || rect.height;
    const yRel = Math.min(Math.max(y - rect.top, 2), paneH - 2);
    const v = s.coordinateToPrice(yRel);
    return typeof v === 'number' && isFinite(v) ? v : null;
  }, []);

  const pasang = useCallback(() => {
    const s = seri.current, c = chart.current;
    if (!s || !c) return;
    const { garisSeret: gs, lilin: l, hingga: hg, posisiMt5: pm } = acuan.current;
    /* Nilai seretan dibaca dari ref, bukan state — rAF ini yang membuat
       strip & tombol mengikuti kursor tanpa render React per gerakan. */
    const ub = ubahRef.current;

    /* Lebar skala harga dibaca tiap kali, bukan sekali: ia berubah sendiri
       begitu angkanya bertambah satu digit. */
    let lebar = 0;
    try { lebar = c.priceScale('right').width(); } catch { /* versi lama */ }

    try {
      const h0 = c.panes()[0].getHeight();
      if (h0 > 0) paneHargaRef.current = h0;
    } catch { /* versi lama */ }
    const paneHarga = paneHargaRef.current;

    const taruh = (el: HTMLDivElement | undefined | null, nilai: number | undefined) => {
      if (!el) return;
      const y = nilai === undefined ? null : s.priceToCoordinate(nilai);
      /* Label yang harganya di luar jendela zoom DISEMBUNYIKAN, bukan
         digambar nyasar di panel sebelah. Garis SL yang menempel di panel
         backtest bukan informasi; itu kebocoran tata letak. */
      if (typeof y === 'number' && isFinite(y) && y >= -2 && (!paneHarga || y <= paneHarga + 2)) {
        el.style.top = y + 'px';
        el.style.visibility = 'visible';
      } else {
        el.style.visibility = 'hidden';
      }
    };

    (gs ?? []).forEach((g) => taruh(garisRef.current.get(g.id), g.harga));

    /* Hamparan posisi MT5. Garis-garisnya sendiri price line (digambar
       kanvas oleh chart-nya); yang ditempatkan di sini cuma tiga penumpang
       DOM-nya: label BUY/SELL polos di ATAS garis entry, pegangan seret
       di level SL/TP (nilai seretan menang atas nilai broker), dan tombol
       Kirim yang menempel di garis yang terakhir dipegang. */
    (pm ?? []).forEach((p) => {
      const u = ub && ub.tiket === p.tiket ? ub : null;
      const elLab = garisRef.current.get('lab-' + p.tiket);
      if (elLab) {
        const y = s.priceToCoordinate(p.entry);
        /* Batas atas 12 px, bukan -2: elemen ini duduk DI ATAS garisnya
           (translateY -100%), jadi garis di tepi atas berarti teksnya
           sudah keluar jendela. */
        if (typeof y === 'number' && isFinite(y) && y >= 12 && (!paneHarga || y <= paneHarga + 2)) {
          elLab.style.top = (y - 3) + 'px';
          elLab.style.visibility = 'visible';
        } else elLab.style.visibility = 'hidden';
      }
      const slPos = u ? u.sl : p.sl;
      taruh(garisRef.current.get(`ubah-${p.tiket}-sl`), slPos > 0 ? slPos : undefined);
      const tpPos = u ? u.tp : p.tp;
      taruh(garisRef.current.get(`ubah-${p.tiket}-tp`), tpPos > 0 ? tpPos : undefined);
    });
    const elTombol = garisRef.current.get('ubah-tombol');
    if (elTombol && ub) taruh(elTombol, ub.bidang === 'tp' ? ub.tp : ub.sl);

    /* Garis order berhenti DI TEPI skala harga, tidak menerobos ke bawah
       angka-angkanya. Elemen DOM membentang selebar komponen; tanpa batas
       ini garis entry tampak seperti coretan pucat menimpa sumbu harga. */
    if (lebar) garisRef.current.forEach((el) => { el.style.right = (lebar + 2) + 'px'; });

    const n = hg === undefined ? l.closes.length : Math.min(l.closes.length, hg + 1);
    taruh(labelRef.current, l.closes[n - 1]);
    if (labelRef.current && lebar) labelRef.current.style.width = lebar + 'px';

    /* Kendali replay berhenti tepat di garis harga, tidak menerobos ke bawah
       skalanya — panel yang menutupi angka harga membuat satu-satunya hal
       yang selalu ingin dibaca jadi tidak terbaca. */
    if (hamparanRef.current) hamparanRef.current.style.right = (lebar + 4) + 'px';

    /* Tinggi panel SMI dibaca balik dari chart-nya.
       ──────────────────────────────────────────────────────────────────
       lightweight-charts tidak memberi tahu saat pembatas panel diseret,
       jadi satu-satunya cara tahu adalah membacanya. Nilai yang berubah
       berarti orangnya baru menyeret — simpan, supaya jadi bawaannya
       sendiri untuk seterusnya. Kendali replay ikut digeser supaya tetap
       duduk di atas panel SMI, bukan di belakangnya. */
    try {
      const panes = c.panes();
      if (panes.length > 1) {
        const h = panes[1].getHeight();
        /* h = 0 berarti panelnya BELUM diukur (tab latar, frame pertama) —
           bukan berarti panelnya setipis nol. Jangan simpan, jangan geser. */
        if (h >= 40) {
          if (Math.abs(h - tinggiSmi.current) > 1) {
            tinggiSmi.current = h;
            try { localStorage.setItem(KUNCI_TINGGI_SMI, String(Math.round(h))); } catch { /* privat */ }
          }
          if (hamparanRef.current) hamparanRef.current.style.bottom = (h + 36) + 'px';
        }
      } else if (hamparanRef.current) {
        hamparanRef.current.style.bottom = '34px';
      }
    } catch { /* versi tanpa panes API */ }
  }, []);

  /* Dipasang SEKALI segera setelah menggambar, di luar rAF.
     ────────────────────────────────────────────────────────────────────
     requestAnimationFrame berhenti total saat tabnya tidak terlihat. Tanpa
     panggilan langsung ini, membuka halaman di tab latar lalu berpindah ke
     sana akan menampilkan garis dan label yang belum punya posisi. */
  useEffect(pasang, [pasang, garisSeret, lilin, hingga, mundur, smi, posisiMt5, ubah]);

  useEffect(() => {
    let raf = 0;
    const tik = () => { raf = requestAnimationFrame(tik); pasang(); };
    raf = requestAnimationFrame(tik);
    /* Tab yang kembali terlihat memasang ulang segera — rAF baru bangun satu
       frame kemudian, dan satu frame dengan label di tempat lama sudah cukup
       untuk terlihat seperti label yang lepas. */
    const bangun = () => { if (!document.hidden) pasang(); };
    document.addEventListener('visibilitychange', bangun);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', bangun); };
  }, [pasang]);

  /* Presisi sumbu MENGIKUTI simbol yang sedang tampil. Chart dibuat sekali
     dan dipakai ulang saat berpindah koin, jadi tanpa ini GBPUSD akan
     mewarisi presisi BTC — dan sumbunya kembali cuma punya empat angka. */
  useEffect(() => {
    const s = seri.current;
    if (!s || !lilin.closes.length) return;
    s.applyOptions({ priceFormat: { type: 'price', ...formatHarga(lilin.closes) } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lilin.closes.length, lilin.closes[lilin.closes.length - 1]]);

  /* Label harga bawaan dimatikan saat kita menggambar penggantinya sendiri —
     dua label di tempat yang sama saling menimpa. */
  useEffect(() => {
    seri.current?.applyOptions({ lastValueVisible: !mundur });
  }, [mundur]);

  /* ── Menyeret ──────────────────────────────────────────────────────
     Pendengar dipasang di window, bukan di garisnya: kalau kursor keluar
     dari garis setipis 1 px saat digeser cepat — dan itu selalu terjadi —
     seretannya akan putus di tengah jalan. */
  useEffect(() => {
    if (!onSeret) return;
    const gerak = (e: MouseEvent) => {
      if (!seret.current) return;
      e.preventDefault();
      const h = hargaDariY(e.clientY);
      if (h !== null) onSeret(seret.current.id as GarisSeret['id'], h);
    };
    const lepas = () => {
      if (!seret.current) return;
      seret.current = null;
      document.body.style.cursor = '';
      /* Interaksi chart dinyalakan lagi — dimatikan saat mulai menyeret
         supaya menggeser garis tidak ikut menggeser grafiknya. */
      chart.current?.applyOptions({ handleScroll: true, handleScale: true });
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
    window.addEventListener('pointercancel', lepas);
    return () => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      window.removeEventListener('pointercancel', lepas);
    };
  }, [onSeret, hargaDariY]);

  function mulaiSeret(id: string, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    /* Diberitahukan lebih dulu, sebelum urusan seret: klik yang tidak
       jadi digeser pun tetap sebuah maksud. */
    onKlikGaris?.(id as GarisSeret['id']);
    if (!onSeret) return;
    seret.current = { id, mulaiY: e.clientY };
    document.body.style.cursor = 'ns-resize';
    chart.current?.applyOptions({ handleScroll: false, handleScale: false });
  }

  /* ── Garis posisi MT5: PRICE LINE, bukan overlay DOM ────────────────
     createPriceLine menempel sampai KE DALAM sumbu harga dengan label
     kotak yang ikut bergerak bersama kanvas — persis garis posisi
     MetaTrader. Garis entry TANPA title: label BUY/SELL-nya teks polos
     DOM di atas garisnya (permintaan pemiliknya — tanpa kotak), dan
     angka levelnya sudah ada di label sumbu.

     Efek ini jalan hanya saat DAFTAR POSISI atau status ubahan berubah —
     bukan tiap laporan EA (identitas posisiMt5 distabilkan pemanggil) dan
     bukan tiap gerakan kursor (seretan memakai applyOptions langsung). */
  useEffect(() => {
    const s = seri.current;
    if (!s) return;
    const buat = (price: number, color: string, title: string, lineStyle: number, kunci?: string) => {
      try {
        const g = s.createPriceLine({ price, color, lineWidth: 1, lineStyle, axisLabelVisible: true, title });
        garisPosMt5.current.push(g);
        if (kunci) petaGarisMt5.current.set(kunci, g);
      } catch { /* seri sedang dibongkar ulang */ }
    };
    /* EKOR TIKET, bukan tiket penuh. Nomor MT5 sepanjang sepuluh angka
       ("#4165473634") memakan lebih banyak ruang daripada level yang
       ditandainya, dan yang dibutuhkan mata cuma pembeda antar posisi —
       bukan nomor yang bisa dibacakan lewat telepon. Empat angka terakhir
       cukup untuk itu, dan nomor lengkapnya tetap ada di tabel posisi.
       Hanya muncul kalau posisinya memang lebih dari satu. */
    const daftar = posisiMt5 ?? [];
    const ekor = daftar.length > 1
      ? (t: string | number) => ' #' + String(t).slice(-4)
      : () => '';
    daftar.forEach((p) => {
      const u = ubahRef.current && ubahRef.current.tiket === p.tiket ? ubahRef.current : null;
      buat(p.entry, p.arah === 'BUY' ? '#10b981' : '#f87171', '', 2);
      const slPos = u ? u.sl : p.sl;
      if (slPos > 0) buat(slPos, '#f87171', 'SL' + ekor(p.tiket), 1, p.tiket + '-sl');
      const tpPos = u ? u.tp : p.tp;
      if (tpPos > 0) buat(tpPos, '#10b981', 'TP' + ekor(p.tiket), 1, p.tiket + '-tp');
    });
    return () => {
      garisPosMt5.current.forEach((g) => { try { s.removePriceLine(g); } catch { /* dibongkar */ } });
      garisPosMt5.current = [];
      petaGarisMt5.current.clear();
    };
  }, [posisiMt5, ubah]);

  /* ── Garis seret ikut menembus ke SUMBU HARGA ───────────────────────
     Overlay DOM di atas kanvas menggambar garis dan gagangnya, tapi
     angkanya berhenti di tepi chart — sumbu harga di kanan tidak tahu
     apa-apa tentangnya. Akibatnya SL/TP/Entry jadi satu-satunya level
     penting yang harganya TIDAK tercetak di tempat mata sudah terbiasa
     mencarinya: kolom yang sama dengan harga terkini.

     Price line di sini murni untuk LABEL SUMBU-nya. Garis visual dan
     seretannya tetap milik overlay DOM — lineWidth 1 dengan warna yang
     sama membuat keduanya bertindih rapi, bukan jadi dua garis.

     title dikosongkan: kotak sumbu hanya memuat angka, persis seperti
     kotak harga terkini. Namanya (Entry/SL/TP) sudah ada di gagang
     seretnya di dalam chart. */
  useEffect(() => {
    const s = seri.current;
    if (!s) return;

    /* ── SATU LEVEL, SATU ANGKA DI SUMBU ────────────────────────────
       Garis posisi MT5 sudah menulis angkanya sendiri ke sumbu (berlabel
       "SL"/"TP"). Sesudah sebuah rencana dikirim jadi order, garis
       rencananya TETAP ADA di level yang sama — memang disengaja, supaya
       bisa dipakai menyusun layer berikutnya — dan ia menulis angka
       KEDUA di level yang sama persis, kali ini tanpa nama.

       Hasilnya tiap SL dan TP punya dua kotak angka bertumpuk di sumbu:
       satu bertuliskan "TP 4444.756", satu lagi "4444.756" polos. Dengan
       dua posisi jadi empat, dan sumbu harga berhenti bisa dibaca.

       Yang dimatikan LABELNYA saja, bukan garisnya. Garis rencananya
       tetap hidup dan tetap bisa diseret; begitu digeser menjauh dari
       level posisi, angkanya muncul kembali dengan sendirinya. */
    const berlabel: number[] = [];
    for (const p of posisiMt5 ?? []) {
      const u = ubahRef.current && ubahRef.current.tiket === p.tiket ? ubahRef.current : null;
      if (p.entry) berlabel.push(p.entry);
      const sl = u ? u.sl : p.sl;
      if (sl > 0) berlabel.push(sl);
      const tp = u ? u.tp : p.tp;
      if (tp > 0) berlabel.push(tp);
    }
    /* AMBANGNYA SATU TICK TAMPILAN, bukan angka relatif yang dikarang.
       ──────────────────────────────────────────────────────────────
       Versi pertama memakai 1e-7 dari harga. Itu jauh LEBIH KETAT
       daripada presisi yang dipakai chart menulis angkanya: di emas
       1e-7 berarti 0,0004 sementara sumbunya menulis tiga desimal
       (0,001). Akibatnya dua level yang berbeda 0,0005 — tampil sebagai
       angka yang SAMA PERSIS di layar — tetap dianggap berbeda dan
       keduanya diberi label. Itulah kenapa TP menyatu tapi SL tidak:
       TP-nya kebetulan sama sampai ke bit terakhir, SL-nya tidak.

       minMove dibaca dari seri, bukan dihitung ulang dari `lilin`:
       memasukkan `lilin` ke dependensi berarti seluruh price line
       dibongkar-pasang tiap lilin baru datang. Nilainya sudah dijaga
       tetap mutakhir oleh efek priceFormat di atas, dan telat sedikit
       pun tidak berbahaya — ia cuma ambang pembanding. */
    const fmt = (s.options() as { priceFormat?: { minMove?: number } }).priceFormat;
    const tick = fmt?.minMove && fmt.minMove > 0 ? fmt.minMove : 1e-6;
    /* DIBULATKAN KE PETAK TICK, bukan dibandingkan selisihnya.
       Selisih < tick gagal justru di kasus paling jelas: 4398,507 dikurangi
       4398,506 menghasilkan 0,0009999999995 di float — lebih kecil dari
       0,001, jadi dua level yang jelas-jelas berbeda ikut disatukan.

       Membulatkan keduanya ke petak yang sama persis dengan yang dipakai
       sumbu menulis angkanya membuat kriterianya jadi apa adanya: satu
       angka kalau memang tercetak sama, dua kalau tercetak beda. */
    const kePetak = (x: number) => Math.round(x / tick);
    const petak = berlabel.map(kePetak);
    const kembar = (a: number) => petak.includes(kePetak(a));

    (garisSeret ?? []).forEach((g) => {
      if (!g.harga) return;
      try {
        garisSeretHarga.current.push(s.createPriceLine({
          price: g.harga, color: g.warna, lineWidth: 1, lineStyle: 2,
          axisLabelVisible: !kembar(g.harga), title: '',
        }));
      } catch { /* seri sedang dibongkar ulang */ }
    });
    return () => {
      garisSeretHarga.current.forEach((g) => { try { s.removePriceLine(g); } catch { /* dibongkar */ } });
      garisSeretHarga.current = [];
    };
  }, [garisSeret, posisiMt5, ubah]);

  /* Harga permintaan (ask): garis titik jarang — jaraknya ke garis harga
     bid adalah SPREAD, dan di emas spread bukan pembulatan. Garisnya
     DIGESER (applyOptions), bukan dibongkar-pasang: nilainya berganti
     tiap beberapa detik dan membuat ulang price line sesering itu adalah
     kerja sia-sia. Baru muncul kalau EA v2.02+ yang mengirim tick. */
  useEffect(() => {
    const s = seri.current;
    if (!s) return;
    const ada = !!hargaAsk && isFinite(hargaAsk) && hargaAsk > 0;
    if (!ada) {
      if (garisAsk.current) { try { s.removePriceLine(garisAsk.current); } catch { /* lepas */ } garisAsk.current = null; }
      return;
    }
    if (garisAsk.current) {
      try { garisAsk.current.applyOptions({ price: hargaAsk }); } catch { /* lepas */ }
    } else {
      try {
        garisAsk.current = s.createPriceLine({
          price: hargaAsk, color: '#60a5fa', lineWidth: 1, lineStyle: 4, axisLabelVisible: true, title: 'Ask',
        });
      } catch { /* seri dibongkar */ }
    }
  }, [hargaAsk]);

  /* Ubahan menutup hidupnya sendiri saat laporan EA berikutnya sudah
     MEMBAWA nilai barunya, atau posisinya lenyap (tertutup dari mana pun).
     Selama masih diseret ia tidak boleh ditutup — saat mousedown nilainya
     masih sama persis dengan nilai broker. */
  useEffect(() => {
    if (!ubah || ubah.sibuk || seretUbah.current) return;
    const p = (posisiMt5 ?? []).find((x) => x.tiket === ubah.tiket);
    if (!p) { aturUbah(null); return; }
    /* Toleransi RELATIF, bukan persamaan persis: EA merapikan harga ke
       digit simbol sebelum memasangnya, jadi 2412.3456 yang dikirim
       kembali sebagai 2412.35 — dan itu tetap "sudah terpasang". */
    const dekat = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(b) * 1e-5, 1e-9);
    if (dekat(ubah.sl, p.sl) && dekat(ubah.tp, p.tp)) aturUbah(null);
  }, [posisiMt5, ubah, aturUbah]);

  /* Seret SL/TP posisi — pendengar di window, alasan yang sama dengan
     seret garis tiket: kursor selalu lolos dari strip setipis 14 px.
     Tiap gerakan cuma menyentuh REF + menggeser price line-nya langsung
     (applyOptions); React baru dilibatkan saat kursor DILEPAS. */
  useEffect(() => {
    if (!onUbahPosisi) return;
    const gerak = (e: MouseEvent) => {
      const su = seretUbah.current;
      const u = ubahRef.current;
      if (!su || !u || u.tiket !== su.tiket) return;
      e.preventDefault();
      const h = hargaDariY(e.clientY);
      if (h === null) return;
      ubahRef.current = { ...u, [su.bidang]: h };
      try { petaGarisMt5.current.get(su.tiket + '-' + su.bidang)?.applyOptions({ price: h }); } catch { /* lepas */ }
    };
    const lepas = () => {
      if (!seretUbah.current) return;
      seretUbah.current = null;
      document.body.style.cursor = '';
      chart.current?.applyOptions({ handleScroll: true, handleScale: true });
      /* Komit nilai akhir ke state: tombol Kirim tampil. Klik polos tanpa
         perpindahan dibubarkan efek penutup di atas. */
      if (ubahRef.current) aturUbah({ ...ubahRef.current });
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
    window.addEventListener('pointercancel', lepas);
    return () => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      window.removeEventListener('pointercancel', lepas);
    };
  }, [onUbahPosisi, hargaDariY, aturUbah]);

  function mulaiSeretUbah(p: PosisiChartMt5, bidang: 'sl' | 'tp', e: React.PointerEvent) {
    if (!onUbahPosisi) return;
    e.preventDefault();
    e.stopPropagation();
    seretUbah.current = { tiket: p.tiket, bidang };
    const u = ubahRef.current;
    aturUbah(u && u.tiket === p.tiket && !u.terkirim
      ? { ...u, bidang, sibuk: false }
      : { tiket: p.tiket, sl: p.sl, tp: p.tp, bidang, sibuk: false, terkirim: false });
    document.body.style.cursor = 'ns-resize';
    chart.current?.applyOptions({ handleScroll: false, handleScale: false });
  }

  async function kirimUbah() {
    if (!ubah || !onUbahPosisi || ubah.sibuk) return;
    const kirim = ubah;
    aturUbah({ ...kirim, sibuk: true });
    const ok = await onUbahPosisi(kirim.tiket, kirim.sl, kirim.tp);
    /* Sukses: tombolnya hilang tapi PRATINJAUNYA bertahan sampai laporan
       EA menyusul (efek penutup di atas yang membubarkannya). Gagal:
       tombol tetap ada — nilainya masih di tempat, tinggal coba lagi
       atau Batal. */
    const u = ubahRef.current;
    if (u && u.tiket === kirim.tiket) aturUbah({ ...u, sibuk: false, terkirim: ok });
  }

  const idxAkhir = (hingga === undefined ? lilin.closes.length : Math.min(lilin.closes.length, hingga + 1)) - 1;
  const hargaTerakhir = idxAkhir >= 0 ? lilin.closes[idxAkhir] : undefined;
  /* Warna mengikuti arah lilin terakhir — aturan yang SAMA dengan label
     bawaan lightweight-charts yang baru saja dimatikan. Menggantinya dengan
     satu warna tetap justru membuat penggantinya terlihat seperti tempelan,
     karena ia jadi satu-satunya hal di chart yang tidak ikut aturan. */
  const naik = idxAkhir >= 0 && lilin.closes[idxAkhir] >= lilin.opens[idxAkhir];

  return (
    /* onPointerDownCapture, BUKAN onPointerDown: fase capture berjalan dari
       luar ke dalam, jadi pilihan lama dibersihkan LEBIH DULU, lalu garis
       yang kebetulan ditekan menyalakan pilihannya sendiri. Dengan bubbling
       biasa urutannya terbalik (dalam dulu, luar belakangan) dan pilihan
       yang baru saja dibuat langsung terhapus lagi. Pointer, bukan mouse:
       gagang garis di bawah memakai pointerdown, dan sentuhan yang jadi
       seretan tidak pernah membangkitkan mousedown sama sekali. */
    <div className="relative overflow-hidden" onPointerDownCapture={() => setGarisAktif(null)}>
      <div ref={kotak} style={{ height: tinggi }} className="w-full" />

      {/* Hitung mundur DI DALAM label harga, bukan di sebelahnya.
          ────────────────────────────────────────────────────────────────
          Ini MENGGANTI label bawaan lightweight-charts, bukan menumpuk di
          atasnya: lebarnya diambil dari lebar skala harga yang sebenarnya,
          dan posisinya ditulis tiap frame — jadi ia menempati tempat yang
          sama persis dengan label yang tadi dimatikan. Itulah beda
          "tertanam" dengan "tempelan": bukan warnanya, tapi apakah ia
          bergerak pada frame yang sama dengan kanvasnya. */}
      {mundur && hargaTerakhir !== undefined && (
        <div ref={labelRef}
             className={cn('angka pointer-events-none absolute right-0 z-10 px-1 py-[3px] text-center leading-[1.15] tabular-nums',
               naik ? 'bg-emerald-500 text-zinc-950' : 'bg-red-400 text-zinc-950')}
             style={{ transform: 'translateY(-50%)', visibility: 'hidden' }}>
          <div className="text-[10.5px] font-medium">{fHarga(hargaTerakhir)}</div>
          <div className="text-[9.5px] opacity-75">{mundur}</div>
        </div>
      )}

      {/* Garis entry / SL / TP yang bisa digeser. */}
      {(garisSeret ?? []).map((g) => {
        const bisa = g.bisaSeret !== false && !!onSeret;
        return (
          <div key={g.id}
               ref={(el) => {
                 if (el) garisRef.current.set(g.id, el);
                 else garisRef.current.delete(g.id);
               }}
               className={cn('absolute left-0 right-0 z-10 flex items-center',
                 /* touch-none WAJIB di gagang: tanpa itu peramban HP membaca
                    seretan jari sebagai scroll halaman, membatalkan pointer
                    (pointercancel), dan garisnya tidak pernah pindah. */
                 bisa ? 'cursor-ns-resize touch-none' : 'pointer-events-none')}
               style={{ transform: 'translateY(-50%)', height: 14, visibility: 'hidden' }}
               onPointerDown={bisa ? (e) => { setGarisAktif(g.id); mulaiSeret(g.id, e); } : undefined}>
            <div className="h-px flex-1" style={{
              background: `repeating-linear-gradient(90deg, ${g.warna} 0 6px, transparent 6px 11px)`,
            }} />
            {/* ✕ menghapus garis INI saja — order yang batal harus bisa
                dibersihkan dari chart tanpa menunggu apa pun. */}
            {bisa && onHapusGaris && garisAktif === g.id && (
              <button
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onHapusGaris(g.id); }}
                title={`Hapus garis ${g.label}`}
                className="mr-1 flex size-[14px] shrink-0 cursor-pointer items-center justify-center rounded-sm text-[10px] font-bold leading-none text-zinc-950 opacity-80 shadow transition-opacity hover:opacity-100"
                style={{ background: g.warna }}>
                ×
              </button>
            )}
            {garisAktif === g.id && (
            <span className="angka mr-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-950 shadow"
                  style={{ background: g.warna }}>
              {/* HANYA NAMANYA. Angkanya sudah tergambar di sumbu harga
                  sebelah kanan — price line milik chart menaruhnya di sana
                  dengan gaya yang sama persis dengan harga terkini. Menulis
                  ulang di sini berarti satu angka yang sama muncul dua kali
                  di satu layar, dan yang panjang justru menutupi lilin.

                  `ket` juga tidak lagi ditempel. Kalimat "klik untuk ubah"
                  menjelaskan sesuatu yang sudah dijelaskan kursornya
                  (ns-resize) dan hanya perlu dibaca sekali seumur hidup —
                  sesudah itu ia cuma teks yang menghalangi harga. */}
              {g.label}
            </span>
            )}
          </div>
        );
      })}

      {/* Posisi MT5. Garis entry/SL/TP-nya PRICE LINE (menembus ke sumbu
          harga — digambar chart-nya sendiri); di DOM tinggal label
          BUY/SELL + lot sebagai TEKS POLOS di atas garis entry — tanpa
          kotak, tanpa angka, tanpa PnL berjalan (angka yang berdetak tiap
          laporan EA memaksa chart menggambar ulang terus-menerus). */}
      {(posisiMt5 ?? []).map((p) => (
        <div key={'lab-' + p.tiket}
             ref={(el) => {
               if (el) garisRef.current.set('lab-' + p.tiket, el);
               else garisRef.current.delete('lab-' + p.tiket);
             }}
             className={cn('angka pointer-events-none absolute left-3 z-10 pr-1.5 text-right text-[10.5px] font-semibold tabular-nums',
               p.arah === 'BUY' ? 'text-emerald-400' : 'text-red-400')}
             style={{ transform: 'translateY(-100%)', visibility: 'hidden',
               textShadow: '0 1px 4px rgba(9,9,11,.95), 0 0 2px rgba(9,9,11,.9)' }}>
          {p.arah} {p.lot}
          {(posisiMt5 ?? []).length > 1 && ' #' + String(p.tiket).slice(-4)}
        </div>
      ))}

      {/* Pegangan seret SL/TP posisi — strip transparan 14 px di level
          garisnya. Menyeret menampilkan tombol Kirim; tanpa menekan Kirim
          tidak ada apa pun yang berangkat ke MT5. */}
      {onUbahPosisi && (posisiMt5 ?? []).map((p) => (['sl', 'tp'] as const).map((b) => (
        <div key={`ubah-${p.tiket}-${b}`}
             ref={(el) => {
               if (el) garisRef.current.set(`ubah-${p.tiket}-${b}`, el);
               else garisRef.current.delete(`ubah-${p.tiket}-${b}`);
             }}
             title={`Seret ${b.toUpperCase()} posisi #${p.tiket}`}
             className="absolute left-0 z-10 cursor-ns-resize touch-none"
             style={{ transform: 'translateY(-50%)', height: 14, visibility: 'hidden' }}
             onPointerDown={(e) => mulaiSeretUbah(p, b, e)} />
      )))}

      {/* Tombol keputusan ubahan — menempel di garis yang terakhir
          dipegang, tepat di kiri sumbu harga. */}
      {ubah && !ubah.terkirim && onUbahPosisi && (
        <div ref={(el) => {
               if (el) garisRef.current.set('ubah-tombol', el);
               else garisRef.current.delete('ubah-tombol');
             }}
             className="absolute z-20 flex items-center gap-1.5"
             style={{ transform: 'translateY(-50%)', visibility: 'hidden' }}>
          <button onClick={() => void kirimUbah()} disabled={ubah.sibuk}
                  className="flex cursor-pointer items-center rounded-md bg-zinc-100 px-2 py-1 text-[10.5px] font-semibold leading-none text-zinc-950 shadow-lg transition-colors hover:bg-white disabled:cursor-default disabled:opacity-60">
            {ubah.sibuk ? 'Mengirim…' : `Kirim SL/TP → MT5`}
          </button>
          {!ubah.sibuk && (
            <button onClick={() => aturUbah(null)}
                    className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-[10.5px] leading-none text-zinc-300 shadow transition-colors hover:text-zinc-100">
              Batal
            </button>
          )}
        </div>
      )}

      {pojok && <div className="absolute left-2 top-2 z-20">{pojok}</div>}

      {/* Kendali replay ditumpangkan di dasar area harga, bukan di panel
          terpisah di bawah chart — latarnya tembus supaya menyatu dengan
          grafiknya. */}
      {/* left-14: logo atribusi TradingView duduk di pojok kiri bawah panel
          harga, dan lisensi lightweight-charts mensyaratkan ia terlihat —
          kendalinya yang minggir, bukan logonya. */}
      {/* right-2 HANYA di ponsel (sm:right-auto mengembalikannya di layar
          lebar). Bilah kendalinya digeser mendatar di sana, dan sebuah
          wadah yang lebarnya "auto" tidak pernah bisa menggeser apa pun —
          ia cuma tumbuh sampai isinya muat lalu meluber keluar chart. Batas
          kanan inilah yang memberinya lebar untuk digeser. */}
      {hamparanBawah && (
        <div ref={hamparanRef} className="absolute left-14 right-2 z-20 sm:right-auto"
             style={{ bottom: smi ? 120 : 34 }}>
          {hamparanBawah}
        </div>
      )}
    </div>
  );
}
