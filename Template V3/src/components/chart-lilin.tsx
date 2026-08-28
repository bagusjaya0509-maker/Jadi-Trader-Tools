import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, CandlestickSeries, LineSeries, createSeriesMarkers, createTextWatermark,
  CrosshairMode,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type IPriceLine, type Logical, type Time,
  type ITextWatermarkPluginApi,
} from 'lightweight-charts';
import type { Lilin } from '@/lib/pasar';
import { cn, harga as fHarga } from '@/lib/utils';
import type { TradeUji } from '@/lib/backtest';
import type { SegmenPine, PenandaPine, KotakPine, IsianPine } from '@/lib/pine-bar';
import { PenggambarIsi } from '@/lib/plugin-isi';
import { PenggambarAlat, type GambarAlat, type AlatPegang } from '@/lib/plugin-alat';
import { PenggambarJenuh } from '@/lib/plugin-jenuh';
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

/** Tampilan chart yang bisa disetel orangnya. Badan dan ekor dipisah karena
 *  itu dua keputusan yang berbeda: badan menyatakan arah, ekor menyatakan
 *  seberapa jauh harga sempat pergi -- dan sebagian orang sengaja meredupkan
 *  ekornya supaya badannya lebih terbaca.
 *
 *  `latar` null berarti IKUT TEMA, bukan hitam. Menyimpan warna tema sebagai
 *  nilai tetap akan membekukannya: orang yang memilih latar saat mode gelap
 *  lalu pindah ke mode terang akan mendapat chart hitam di halaman putih,
 *  tanpa tahu kenapa.
 *
 *  `garisNaik`/`garisTurun` null berarti IKUT BADAN, dan null-nya penting.
 *  Sebelum ada medan ini, outline lilin memang selalu memakai warna badan;
 *  kalau bawaannya diisi warna tetap, orang yang sudah menyetel badannya
 *  jadi hijau terang akan tiba-tiba mendapat outline hijau bawaan di
 *  sekelilingnya -- perubahan yang tidak ia minta, muncul sendiri saat
 *  pembaruan dipasang. Null menjaga tampilan lamanya persis.
 *
 *  `kisi` false menyembunyikan garis bantu vertikal dan horizontal. Ia
 *  boolean, bukan warna: menyembunyikan dengan cara mengisi 'transparent'
 *  membuat keadaan mati tidak bisa dibedakan dari warna yang kebetulan
 *  transparan, dan `warnaSah` di halaman Chart akan membuangnya saat
 *  dibaca ulang.
 *
 *  Bahwa lightweight-charts menerima `visible: false` pada grid dipakai
 *  langsung, bukan diakali dengan warna transparan: garis transparan tetap
 *  digambar, dan tetap membayar ongkosnya tiap frame. */
export interface TampilanChart {
  naik: string;
  turun: string;
  ekorNaik: string;
  ekorTurun: string;
  /** null = ikut warna badan. Lihat catatan di atas. */
  garisNaik: string | null;
  garisTurun: string | null;
  latar: string | null;
  /** true = garis bantu tampil. */
  kisi: boolean;
}

/** Diekspor karena halaman Chart perlu angka yang SAMA untuk tombol
 *  "Bawaan" -- dua sumber angka yang seharusnya sama adalah dua angka yang
 *  cepat atau lambat berbeda. */
export const TAMPILAN_BAWAAN: TampilanChart = {
  naik: '#10b981',
  turun: '#f87171',
  ekorNaik: '#10b981',
  ekorTurun: '#f87171',
  garisNaik: null,
  garisTurun: null,
  latar: null,
  kisi: true,
};

/* -- Warna panel SMI -----------------------------------------------------
   Biru untuk SMI, oranye untuk EMA-nya -- urutan yang SAMA dengan skrip SMI
   Ergodic di TradingView. Sebelumnya terbalik, dan itu bukan soal selera:
   orang yang membaca chart yang sama di dua tempat mengenali garis lewat
   warnanya, bukan dengan membaca legenda tiap kali. Dua garis yang bertukar
   warna antar aplikasi terbaca sebagai silang yang berlawanan arah. */
const WARNA_SMI = '#60a5fa';
const WARNA_SMI_EMA = '#fbbf24';

/* Ambang jenuh, SATU tempat. Dipakai garis putus-putus DAN tepi pita, jadi
   keduanya tidak bisa lagi bergeser sendiri-sendiri. Angkanya harus sama
   dengan SMI_OB/SMI_OS di jt-scan-core -- kalau tidak, chart dan kartu
   screener akan berbeda pendapat tentang koin yang sama. */
const AMBANG_SMI = 50;

/* Kantong jenuh: MERAH di atas ambang beli, HIJAU di bawah ambang jual.
   Arah warnanya sengaja begitu -- yang diwarnai adalah peringatan, bukan
   arah harga. Kurva yang menembus ke atas berarti sudah terlalu jauh
   dibeli, dan itu bahaya bagi yang mau ikut naik.

   Sempat digambar sebagai pita mendatar selebar panel. Itu salah: pita
   mewarnai seluruh jalur ambang sepanjang waktu, termasuk ribuan bar yang
   tidak pernah jenuh, dan warna yang selalu ada berhenti berarti apa-apa. */
const WARNA_JENUH_SMI = {
  gelap: { beli: 'rgba(248,113,113,.30)', jual: 'rgba(52,211,153,.30)' },
  terang: { beli: 'rgba(220,38,38,.20)', jual: 'rgba(5,150,105,.20)' },
} as const;

function wilayahJenuhUntuk(tema: 'gelap' | 'terang', nilai: (number | null)[]) {
  const w = WARNA_JENUH_SMI[tema];
  return [
    { nilai, ambang: AMBANG_SMI, arah: 'atas' as const, warna: w.beli },
    { nilai, ambang: -AMBANG_SMI, arah: 'bawah' as const, warna: w.jual },
  ];
}

/* -- Warna tanda air -----------------------------------------------------
   Sangat samar dengan sengaja. Tanda air itu penanda "chart ini simbol apa"
   untuk mata yang baru mendarat di layar, bukan lapisan data -- ia harus
   kalah oleh lilin paling tipis sekalipun. Angkanya beda per tema karena
   mata jauh lebih peka pada tinta gelap di bidang terang. */
const WARNA_TANDA_AIR = {
  gelap: { utama: 'rgba(255,255,255,.085)', sub: 'rgba(255,255,255,.06)' },
  terang: { utama: 'rgba(0,0,0,.075)', sub: 'rgba(0,0,0,.055)' },
} as const;

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
  garisSeret, onSeret, onKlikGaris, onHapusGaris, onKlikKosong, hamparanBawah, segmen, penandaPine, kotakPine, isianPine,
  alat, onAlatSelesai, gambarAlat, gambarPilih, onPilihGambar, onUbahGambar,
  posisiMt5, onUbahPosisi, hargaAsk, kunciUkuran, bagikanFoto, tandaAir, tampilan, pitaSmi,
  jiplak,
  hamparanBarTertua, onUjungKiri,
}: {
  /** Nama pasangan yang dicetak samar di tengah area harga, seperti
   *  TradingView. `utama` nama simbolnya, `sub` baris kecil di bawahnya --
   *  timeframe dan sumber datanya. Tanpa prop ini tidak ada tanda air. */
  tandaAir?: { utama: string; sub?: string };
  /** Warna badan, ekor, dan latar pilihan orangnya. Tanpa ini dipakai
   *  TAMPILAN_BAWAAN. */
  tampilan?: TampilanChart;
  /** Gambar pita jenuh beli/jual di panel osilator. Dimatikan saat panel itu
   *  sedang dipakai osilator Pine: ambang +-50 adalah milik SMI, dan skrip
   *  Pine mana pun boleh berskala apa saja -- pita di skala yang salah
   *  menyatakan jenuh di tempat yang bukan jenuh. */
  pitaSmi?: boolean;
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
  /** Klik pada KANVAS KOSONG — bukan pada garis, alat, atau panel.
   *  Sentuhan pada garis ditangkap lapisan seretnya sendiri dan tidak
   *  pernah sampai ke sini, jadi pemanggil boleh memakainya sebagai
   *  "orangnya menaruh perhatian ke tempat lain". */
  onKlikKosong?: () => void;
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
  /** Ditempelkan pada LILIN TERTUA dan ikut bergeser bersamanya. Dipakai
   *  kartu "Muat lebih lama": yang ditawarkan kartu itu adalah data sebelum
   *  bar tersebut, jadi di sanalah tempatnya — bukan mengambang di tengah,
   *  yang tidak menunjuk apa pun.
   *
   *  Posisinya ditulis LANGSUNG ke style, bukan lewat state: satu geseran
   *  membangkitkan puluhan pembaruan koordinat, dan melewatkan semuanya ke
   *  React berarti puluhan render per detik demi menggeser satu kotak. */
  hamparanBarTertua?: React.ReactNode;
  /** Dipanggil saat lilin tertua masuk / keluar layar. Hanya saat BERUBAH,
   *  bukan tiap piksel geseran. */
  onUjungKiri?: (di: boolean) => void;
  /** Trendline miring dari Pine (line.new) — bar → waktu di sini. */
  segmen?: SegmenPine[];
  /** Label BUY/SELL dari Pine (label.new / plotshape). */
  penandaPine?: PenandaPine[];
  /** Kotak zona dari Pine (box.new) — isi + bingkainya di kanvas. */
  kotakPine?: KotakPine[];
  /** Isian antar dua garis (linefill) — pewarna tengah channel paralel. */
  isianPine?: IsianPine[];
  /** Alat gambar yang sedang dipegang — null berarti kursor biasa. */
  alat?: AlatPegang | null;
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
  onUbahGambar?: (id: string, ubah: Partial<Pick<GambarAlat, 't1' | 'h1' | 't2' | 'h2' | 'h3'>>) => void;
  /** Posisi MT5 terbuka — price line entry/SL/TP + PnL + seret SL/TP. */
  /** Chart acuan yang dipasang BERDAMPINGAN, bukan ditumpuk.
   *
   *  ── KENAPA BUKAN HAMPARAN LAGI ──────────────────────────────────────
   *  Dua percobaan sebelumnya menumpuknya di belakang lilin: pertama dengan
   *  transform persen, lalu dengan tambatan koordinat chart supaya ia ikut
   *  bergerak. Keduanya bekerja, dan keduanya tetap sulit dipakai —
   *  menumpuk dua chart berarti dua kisi, dua rangkaian lilin, dan dua
   *  warna yang saling menutupi di ruang yang sama. Menipiskan opasitasnya
   *  cuma memilih mana yang lebih sulit dibaca.
   *
   *  Keputusan pemilik: layar dibelah. Gambar acuannya di kiri dengan
   *  ketajaman PENUH — ia memang untuk dibaca, bukan untuk dijiplak garis
   *  demi garis — dan chart sungguhan di kanan, utuh tanpa apa pun di
   *  atasnya.
   *
   *  ── YANG MENYAMBUNGKAN KEDUANYA: HARGA ──────────────────────────────
   *  `hargaAtas`/`hargaBawah` diisi tangan, dibaca dari sumbu harga di
   *  gambarnya sendiri. Begitu terisi, gambarnya digeser dan diregangkan
   *  supaya level yang SAMA jatuh di ketinggian yang SAMA dengan chart di
   *  kanan. Jadi zona di gambar kiri bisa dibaca lurus mendatar ke kanan,
   *  tanpa menghitung apa pun.
   *
   *  Nol berarti belum diisi: gambarnya ditampilkan apa adanya, selebar
   *  panelnya. Menebak angkanya sendiri berarti menaruh garis harga di
   *  tempat yang tidak pernah dikatakan siapa pun. */
  jiplak?: { url: string; lebar: number; hargaAtas: number; hargaBawah: number } | null;
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
  /* Pegangan garis ambang +50/-50 disimpan. Ia price line, bukan bagian
     dari opsi chart, jadi applyOptions saat tema berganti tidak akan
     menyentuhnya kalau pegangannya dibuang begitu saja. */
  const garisAmbang = useRef<IPriceLine[]>([]);
  const jenuhPrim = useRef<PenggambarJenuh | null>(null);
  const garisPos = useRef<IPriceLine[]>([]);
  const isiPine = useRef<PenggambarIsi | null>(null);
  const alatPrim = useRef<PenggambarAlat | null>(null);

  /* ── JARAK ANTAR-BAR ────────────────────────────────────────────────
     Diambil dari MEDIAN selisih seluruh lilin, bukan dari dua lilin
     pertama seperti sebelumnya.

     Sebabnya bukan kehati-hatian teoretis. Pasar forex dan emas TUTUP
     akhir pekan, dan lilin tertua di deret 3000 bar kebetulan bisa jatuh
     tepat sebelum jeda itu. Diukur pada MT5:XAUUSD 1 jam yang sedang
     tayang: `times[1] - times[0]` = 50 JAM, sementara median selisihnya
     1 jam. 131 dari 2999 lilin punya jeda tidak normal, terbesar 74 jam.

     Angka itu dipakai SEMUA yang mengekstrapolasi ke luar data — garis
     Pine yang menjulur ke kanan, alat gambar yang ujungnya di masa depan,
     dan penempatan alat posisi. Semuanya meleset lima puluh kali lipat di
     simbol MT5, diam-diam, sejak sebelum alat posisi ada.

     Median, bukan rata-rata: rata-rata ikut tertarik oleh 131 jeda akhir
     pekan itu. Median tidak. Dihitung ulang hanya saat datanya berganti. */
  const tfMs = useMemo(() => {
    const t = lilin.times;
    if (t.length < 2) return 3_600_000;
    const d: number[] = [];
    for (let i = 1; i < t.length; i++) { const v = t[i] - t[i - 1]; if (v > 0) d.push(v); }
    if (!d.length) return 3_600_000;
    d.sort((a, b) => a - b);
    return d[d.length >> 1];
  }, [lilin]);
  /* Penangan tetikus dipasang SEKALI; kalau membaca `tfMs` dari closure,
     mereka akan memegang nilai dari render saat dipasang. */
  const tfRef = useRef(tfMs);
  tfRef.current = tfMs;
  /* Handler klik disimpan di ref supaya langganannya dipasang SEKALI.
     Melanggan ulang tiap render menumpuk pendengar di chart yang sama. */
  const klikRef = useRef(onKlikBar);
  const kosongRef = useRef(onKlikKosong);
  /* Uji-kena garis entry posisi. Isinya ditulis ulang tiap render (butuh
     daftar posisi terbaru), tapi wadahnya tetap — langganan klik di bawah
     dipasang sekali seumur chart. */
  const klikPosRef = useRef<(y?: number) => void>(() => {});
  /* Pemotret disimpan di ref, dan `bagikanFoto` juga — supaya efek pembuatan
     chart (yang sengaja berdependensi kosong agar chartnya tidak dibuat
     ulang tiap render) tetap memakai callback terbaru tanpa menjadikannya
     dependensi. */
  const fotoRef = useRef<(() => string | null) | null>(null);
  const bagikanFotoRef = useRef(bagikanFoto);
  bagikanFotoRef.current = bagikanFoto;
  useEffect(() => { if (fotoRef.current) bagikanFoto?.(fotoRef.current); }, [bagikanFoto]);
  klikRef.current = onKlikBar;
  kosongRef.current = onKlikKosong;

  /* Warna lilin dipegang di ref juga, dengan alasan yang sama seperti
     `bagikanFoto` di atas: efek pembuatan chart sengaja tidak berdependensi
     pada warna, karena mengganti warna tidak boleh membangun ulang chart
     dan membuang zoom serta posisi geser orangnya. */
  const rupa: TampilanChart = {
    naik: tampilan?.naik || TAMPILAN_BAWAAN.naik,
    turun: tampilan?.turun || TAMPILAN_BAWAAN.turun,
    ekorNaik: tampilan?.ekorNaik || TAMPILAN_BAWAAN.ekorNaik,
    ekorTurun: tampilan?.ekorTurun || TAMPILAN_BAWAAN.ekorTurun,
    /* `??` dan BUKAN `||`: null di sini punya arti (ikut badan), sementara
       `||` akan menyamakannya dengan string kosong dan menghapus bedanya. */
    garisNaik: tampilan?.garisNaik ?? null,
    garisTurun: tampilan?.garisTurun ?? null,
    latar: tampilan?.latar ?? null,
    kisi: tampilan?.kisi ?? true,
  };
  /* Outline yang benar-benar dipakai. Dihitung sekali di sini supaya tiga
     tempat yang memasangnya -- saat seri dibuat, saat warnanya diubah, dan
     larik dependensi efeknya -- tidak masing-masing menuliskan aturan
     jatuh-ke-badan sendiri dan suatu hari berselisih. */
  const garisNaikPakai = rupa.garisNaik ?? rupa.naik;
  const garisTurunPakai = rupa.garisTurun ?? rupa.turun;
  const rupaRef = useRef(rupa);
  rupaRef.current = rupa;

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
        /* `visible` dibaca dari ref karena efek ini berdependensi kosong --
           nilainya dibekukan saat mount, dan efek di bawah yang mengurus
           perubahan sesudahnya. */
        vertLines: { color: WARNA_CHART[temaSekarang()].kisi, visible: rupaRef.current.kisi },
        horzLines: { color: WARNA_CHART[temaSekarang()].kisi, visible: rupaRef.current.kisi },
      },
      rightPriceScale: { borderColor: WARNA_CHART[temaSekarang()].batasSkala },
      timeScale: { borderColor: WARNA_CHART[temaSekarang()].batasSkala, timeVisible: true, secondsVisible: false },
      crosshair: {
        /* ── NORMAL, BUKAN MAGNET ──────────────────────────────────────
           Bawaan pustaka adalah Magnet: selama kursor berada DI ATAS data,
           garis mendatarnya melompat ke harga lilin terdekat alih-alih
           mengikuti kursor. Di ruang kosong sebelah kanan — di depan lilin
           terakhir — tidak ada yang bisa ditempeli, jadi di sana ia
           mengikuti kursor dengan benar.

           Itulah persis gejala yang dilaporkan: "di atas lilin koordinatnya
           menempel di lilin, di depan lilin baru benar". Bukan dua perilaku
           yang berbeda, melainkan satu mode yang cuma punya sesuatu untuk
           ditempeli di salah satunya.

           Magnet salah untuk chart ini. Garis putus-putusnya dipakai
           MEMBACA HARGA di titik yang ditunjuk mata — menaruh SL, mengukur
           jarak, membaca level — dan harga yang melompat ke OHLC terdekat
           menjawab pertanyaan yang tidak diajukan. Yang ingin menempel ke
           harga lilin sudah punya alatnya sendiri: garis, kotak SNR, dan
           fibonacci. */
        mode: CrosshairMode.Normal,
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
      upColor: rupaRef.current.naik, downColor: rupaRef.current.turun,
      /* Outline jatuh ke warna badan kalau belum disetel sendiri -- itu
         tampilan yang sudah dikenal orang sebelum medan ini ada, dan
         pembaruan tidak boleh mengubah chart yang tidak diminta diubah. */
      borderUpColor: rupaRef.current.garisNaik ?? rupaRef.current.naik,
      borderDownColor: rupaRef.current.garisTurun ?? rupaRef.current.turun,
      wickUpColor: rupaRef.current.ekorNaik, wickDownColor: rupaRef.current.ekorTurun,
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
      klikPosRef.current(p.point?.y);
      kosongRef.current?.();
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
     atas putih maupun hitam. Sejak warnanya bisa disetel sendiri, ia punya
     efeknya sendiri di bawah -- tema tetap tidak menyentuhnya. */
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const w = WARNA_CHART[tema];
    c.applyOptions({
      layout: { textColor: w.teks },
      /* Kenapa `rupa.kisi` ikut di sini, bukan di efeknya sendiri: grid
         hanya punya DUA tempat pemasangan (saat dibuat dan di sini), dan
         menambah tempat ketiga berarti tiga salinan aturan yang sama.
         `rupa.kisi` cukup ditambahkan ke larik dependensi efek ini. */
      grid: {
        vertLines: { color: w.kisi, visible: rupa.kisi },
        horzLines: { color: w.kisi, visible: rupa.kisi },
      },
      rightPriceScale: { borderColor: w.batasSkala },
      timeScale: { borderColor: w.batasSkala },
      crosshair: {
        vertLine: { color: w.bidik, labelBackgroundColor: w.labelBidik },
        horzLine: { color: w.bidik, labelBackgroundColor: w.labelBidik },
      },
    });
    /* Garis ambang SMI diganti tangan. applyOptions di atas hanya menyentuh
       opsi chart; price line berdiri sendiri -- di mode terang ia tetap
       putih 14% di atas latar putih, yaitu tidak terlihat sama sekali. */
    garisAmbang.current.forEach((g) => {
      try { g.applyOptions({ color: w.garisNol }); } catch { /* serinya sudah dibongkar */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema, rupa.kisi]);

  /* -- Warna lilin & latar ----------------------------------------------
     Lewat applyOptions, bukan dengan membuat ulang serinya. Membuat ulang
     seri lilin berarti mengirim seluruh datanya lagi dan kehilangan jendela
     pandang -- mahal sekali untuk satu pergantian warna. */
  useEffect(() => {
    const s = seri.current;
    if (!s) return;
    try {
      s.applyOptions({
        upColor: rupa.naik, downColor: rupa.turun,
        borderUpColor: garisNaikPakai, borderDownColor: garisTurunPakai,
        wickUpColor: rupa.ekorNaik, wickDownColor: rupa.ekorTurun,
      });
    } catch { /* serinya sudah dibongkar */ }
    /* Yang didaftarkan nilai yang BENAR-BENAR dipakai, bukan `rupa.garisNaik`
       mentahnya. Kalau outline sedang ikut badan, mengubah warna badan harus
       ikut menggeser outline-nya -- dan itu hanya terbaca dari nilai
       sesudah jatuh-ke-badan. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rupa.naik, rupa.turun, rupa.ekorNaik, rupa.ekorTurun, garisNaikPakai, garisTurunPakai]);

  /* Latar dipisah dari efek tema di atas, dan sengaja BERJALAN SESUDAHNYA:
     'transparent' berarti menyerahkan latarnya ke halaman, yang sudah ikut
     tema sendiri. Jadi mematikan latar pilihan sendiri tidak perlu tahu
     warna tema apa pun -- ia cuma berhenti menutupi. */
  useEffect(() => {
    try {
      chart.current?.applyOptions({ layout: { background: { color: rupa.latar ?? 'transparent' } } });
    } catch { /* chartnya sudah dibuang */ }
  }, [rupa.latar, tema]);

  /* -- Ujung kiri riwayat -----------------------------------------------
     Dilanggan SEKALI (efek berdependensi kosong): pustaka memanggil balik
     tiap geseran, dan berlangganan ulang tiap data disegarkan akan menumpuk
     pendengar di chart yang sama.

     Yang dilaporkan cuma PERUBAHAN keadaan. Menggeser satu piksel di daerah
     ujung membangkitkan puluhan panggilan balik, dan setState pada nilai
     yang sama tetap menempuh seluruh jalur render React. */
  const onUjungRef = useRef(onUjungKiri);
  onUjungRef.current = onUjungKiri;
  const cekUjung = useRef<(() => void) | null>(null);
  const tempelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    let lalu: boolean | null = null;
    const cek = () => {
      let di = false;
      try {
        /* Koordinat lilin TERTUA, bukan sekadar "apakah sudah mentok".
           Dari satu angka ini dua hal diputuskan sekaligus: apakah kartunya
           layak tampil, dan di mana persisnya ia menempel. */
        const x0 = c.timeScale().logicalToCoordinate(0 as Logical);
        const lebar = kotak.current?.clientWidth ?? 0;
        di = x0 != null && x0 >= 0 && x0 <= lebar;

        const el = tempelRef.current;
        if (el && x0 != null) {
          /* SELALU di sebelah KIRI lilin tertua — di ruang kosong sebelum
             riwayatnya dimulai, tempat lilin yang mau ditarik itu nanti
             berada. Kartunya ikut bergeser ke kiri bersama chartnya.

             Dulu ada pembalik: kalau ruang di kiri tidak cukup, kartunya
             melompat ke KANAN lilin tertua. Niatnya menjaga kartunya tetap
             terlihat, tapi yang terasa dipakai adalah kartu yang menghindar
             — digeser ke kiri, ia malah maju ke kanan, melawan arah tangan.
             Pemilik menyebutnya persis begitu, dan ia benar: benda yang
             bergerak berlawanan dengan geseran terbaca sebagai rusak, bukan
             sebagai pintar.

             TANPA penjaga tepi, dan itu sengaja. Sempat ada `Math.max(8, …)`
             supaya kartunya tidak pernah hilang; akibatnya ia parkir di tepi
             kiri lalu DITIMPA lilin yang terus berjalan — persis kelakuan
             yang mau dihilangkan, cuma pindah tempat. Sekarang ia benar-benar
             ikut, sampai keluar layar kalau memang begitu.

             Itu tidak membuat tombolnya tak terjangkau, karena cara orang
             sampai ke sana memang berlawanan: untuk MENARIK riwayat lebih
             tua, chartnya digeser sampai muncul ruang kosong sebelum lilin
             pertama — dan di ruang kosong itulah kartunya berada, makin
             lebar ruangnya makin jelas ia terlihat. Kartunya menghilang
             justru pada keadaan ia tidak dibutuhkan: saat layar penuh lilin
             dan tidak ada ruang kosong sama sekali. */
          const lebarKartu = el.offsetWidth || 176;
          const kiri = x0 - lebarKartu - 12;
          el.style.transform = `translate(${Math.round(kiri)}px, -50%)`;
        }
      } catch { /* chartnya sudah dibuang */ }
      if (di !== lalu) { lalu = di; onUjungRef.current?.(di); }
    };
    cekUjung.current = cek;
    c.timeScale().subscribeVisibleLogicalRangeChange(cek);
    cek();
    return () => {
      cekUjung.current = null;
      try { c.timeScale().unsubscribeVisibleLogicalRangeChange(cek); } catch { /* sudah dibuang */ }
    };
  }, []);
  /* Data berubah = jumlah bar berubah = "mentok" bisa berubah tanpa satu pun
     geseran. Menyisipkan 1000 lilin lama harus MEMATIKAN tombolnya sendiri.

     DIJADWALKAN, bukan dipanggil langsung. Efek yang memasang lilin baru ke
     serinya duduk JAUH DI BAWAH efek ini, dan efek dijalankan React menurut
     urutan penulisannya. Memanggil cek() di sini berarti membaca jendela
     pandang SEBELUM lilin barunya masuk dan sebelum rentangnya dipulihkan —
     jawabannya masih jawaban lama, jadi kartunya tetap menyala walau
     riwayatnya sudah bertambah dan orangnya tidak lagi di ujung.

     setTimeout 0 menaruhnya di tugas berikutnya, sesudah SELURUH efek commit
     ini selesai; yang 250 ms menjaring pemulihan rentang yang baru mendarat
     di frame berikutnya. Menggantungkan urutan pada posisi baris di berkas
     ini terlalu rapuh — memindahkan satu efek saja akan mematahkannya lagi
     tanpa satu pun galat. */
  useEffect(() => {
    const t0 = window.setTimeout(() => cekUjung.current?.(), 0);
    const t1 = window.setTimeout(() => cekUjung.current?.(), 250);
    return () => { window.clearTimeout(t0); window.clearTimeout(t1); };
  }, [lilin]);

  /* Kartunya baru saja dipasang ke DOM: cek() sebelumnya berjalan saat
     elemennya belum ada, jadi posisinya masih -9999px. Layout effect, bukan
     effect biasa — ia berjalan sebelum peramban menggambar, jadi kartunya
     tidak pernah terlihat melompat dari luar layar ke tempatnya. */
  useLayoutEffect(() => { cekUjung.current?.(); }, [hamparanBarTertua]);

  /* -- Tanda air nama pasangan ------------------------------------------
     Plugin pane bawaan lightweight-charts v5 (createTextWatermark),
     dipasang di pane 0 -- pane harga. Bukan elemen DOM yang dihamparkan:
     tanda air yang hidup di DOM tidak ikut terbawa saat chartnya dipotret
     untuk sampul analisa, sementara yang digambar di kanvas ikut.

     Dependensinya HANYA tema dan teksnya. Chartnya sendiri dibuat sekali
     seumur komponen (efek di atas berdependensi kosong), jadi menambahkan
     kunciUkuran atau tinggi ke sini cuma akan membongkar-pasang tanda air
     tiap piksel pembatas watchlist digeser -- tanpa satu pun alasan. */
  const tandaAirRef = useRef<ITextWatermarkPluginApi<Time> | null>(null);
  const utamaAir = tandaAir?.utama;
  const subAir = tandaAir?.sub;
  useEffect(() => {
    const c = chart.current;
    if (!c || !utamaAir) return;
    const w = WARNA_TANDA_AIR[tema];
    const font = "'IBM Plex Sans', -apple-system, sans-serif";
    /* 46 dan 24, keduanya tanpa tebal -- proporsi dan bobot yang sama dengan
       tanda air TradingView. Sempat dibuat tebal; dibandingkan berdampingan,
       versi tebal terbaca sebagai judul yang menuntut dibaca, bukan sebagai
       penanda latar yang boleh diabaikan. */
    const baris: { text: string; color: string; fontSize: number; fontFamily: string }[] = [
      { text: utamaAir, color: w.utama, fontSize: 46, fontFamily: font },
    ];
    if (subAir) baris.push({ text: subAir, color: w.sub, fontSize: 24, fontFamily: font });
    try {
      const pane = c.panes()[0];
      if (!pane) return;
      tandaAirRef.current = createTextWatermark(pane, {
        horzAlign: 'center', vertAlign: 'center', lines: baris,
      });
    } catch { /* versi pustaka tanpa plugin tanda air */ }
    return () => {
      try { tandaAirRef.current?.detach(); } catch { /* chartnya sudah dibuang lebih dulu */ }
      tandaAirRef.current = null;
    };
  }, [tema, utamaAir, subAir]);

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
    garisAmbang.current = [];
    jenuhPrim.current = null;
    if (!smi || !lilin.times.length) return;

    const buat = (warna: string, tebal: 1 | 2) => {
      const s = c.addSeries(LineSeries, {
        color: warna, lineWidth: tebal, priceLineVisible: false, lastValueVisible: false,
      }, 1);
      seriSmi.current.push(s);
    };
    buat(WARNA_SMI, 2);
    buat(WARNA_SMI_EMA, 1);

    /* Ditempel di seri PERTAMA -- seri SMI-nya sendiri, bukan EMA-nya.
       Primitive membaca sumbu harga lewat serinya, dan kedua seri berbagi
       sumbu yang sama; yang pertama dipilih supaya kantongnya ikut hidup-mati
       bersama garis yang ambangnya ia tandai.

       Datanya dikosongkan di sini dan diisi efek di bawah, supaya cuma ada
       SATU tempat yang tahu cara menyusunnya. */
    const jenuhBaru = new PenggambarJenuh();
    seriSmi.current[0].attachPrimitive(jenuhBaru);
    jenuhPrim.current = jenuhBaru;

    /* Ambang jenuh +50 / -50 — angka yang SAMA dengan SMI_OB dan SMI_OS di
       jt-scan-core, yaitu ambang yang dipakai kartu sinyal untuk menyebut
       sebuah koin overbought atau oversold. Garis di sini harus sama persis
       dengan ambang di sana, kalau tidak chart dan kartu akan berbeda
       pendapat tentang koin yang sama. */
    const acuan = seriSmi.current[0];
    if (acuan) {
      garisAmbang.current = [AMBANG_SMI, -AMBANG_SMI].map((v) => acuan.createPriceLine({
        price: v, color: WARNA_CHART[temaSekarang()].garisNol, lineWidth: 1, lineStyle: 2,
        axisLabelVisible: false, title: '',
      }));
    }
    try { c.panes()[1]?.setHeight(tinggiSmi.current); } catch { /* versi tanpa panes API */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smi === null, lilin.times.length === 0]);

  /* Kantong jenuh menyala/padam, berganti tema, dan mengikuti data TANPA
     membongkar serinya. Efek di atas sengaja berdependensi sesempit mungkin
     supaya panel SMI tidak lenyap-sekejap tiap data disegarkan; menaruh
     `pitaSmi` di sana akan mengembalikan persis masalah itu setiap skrip
     Pine dijalankan. */
  useEffect(() => {
    const p = jenuhPrim.current;
    if (!p) return;
    if (!pitaSmi || !smi) { p.setData([]); return; }
    /* Dipotong pada batas yang SAMA dengan serinya. Tanpa ini kantongnya
       menjulur melewati bar terakhir replay -- mewarnai jenuh yang, di dalam
       latihan itu, belum terjadi. */
    const batas = hingga === undefined
      ? lilin.times.length
      : Math.max(1, Math.min(lilin.times.length, hingga + 1));
    p.setData(wilayahJenuhUntuk(tema, smi.smi.slice(0, batas)));
  }, [pitaSmi, tema, smi, lilin, hingga]);

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
    /* ── SATU SERI PER POTONGAN TERSAMBUNG ───────────────────────────
       lightweight-charts TIDAK memutus garis di titik kosong. Diuji
       langsung: satu seri dengan nilai di bar 0–9 dan 30–39, kosong di
       antaranya, tetap menggambar garis lurus menyeberangi lubangnya
       (189 piksel bertinta di daerah yang seharusnya bersih). Membuang
       nilai kosong maupun mengirimnya sebagai titik tanpa nilai sama saja
       hasilnya — keduanya pernah dicoba di sini.

       Jadi lubangnya dibuat dengan MEMISAHKAN SERINYA. Dua titik yang
       berada di seri berbeda tidak punya cara apa pun untuk tersambung.

       Ini yang membuat Supertrend benar: skripnya menggambar dua plot yang
       saling bergantian (plot.style_linebr), masing-masing kosong justru
       saat yang lain hidup. Dalam satu seri, keduanya jadi diagonal panjang
       yang menyilang seluruh chart.

       Indikator tanpa lubang (EMA dan kawan-kawan) tetap satu seri seperti
       sebelumnya — pemisahan hanya terjadi kalau memang ada lubang. */
    const batasGaris = hingga === undefined
      ? lilin.times.length
      : Math.max(1, Math.min(lilin.times.length, hingga + 1));
    (garis ?? []).forEach((g) => {
      /* Potongan dikumpulkan dulu, baru diputuskan berapa seri yang perlu
         dibuat. Membuat seri sambil berjalan berarti seri kosong terlanjur
         lahir untuk plot yang ternyata tidak pernah berisi. */
      const potongan: { time: Time; value: number }[][] = [];
      let jalan: { time: Time; value: number }[] = [];
      for (let i = 0; i < batasGaris; i++) {
        const v = g.nilai[i];
        if (v != null && isFinite(v)) {
          jalan.push({ time: Math.floor(lilin.times[i] / 1000) as Time, value: v });
        } else if (jalan.length) {
          potongan.push(jalan);
          jalan = [];
        }
      }
      if (jalan.length) potongan.push(jalan);
      if (!potongan.length) return;

      /* Pagar untuk deret yang berselang-seling tiap bar: ribuan seri akan
         membekukan chart, dan garis yang tersambung salah masih jauh lebih
         baik daripada halaman yang berhenti merespons. */
      const pecah = potongan.length <= 400 ? potongan : [potongan.flat()];
      pecah.forEach((titik) => {
        const s = c.addSeries(LineSeries, {
          color: g.warna, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
          /* Potongan sepanjang SATU bar tidak punya ruas untuk digambar —
             tanpa penanda titik ia lenyap tanpa jejak. */
          pointMarkersVisible: titik.length === 1,
        });
        s.setData(titik);
        seriGaris.current.push(s);
      });
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
    /* Tipe ditulis TEGAS, bukan disimpulkan dari dorongan pertama.
       Disimpulkan, bentuknya terkunci pada apa yang kebetulan dipakai
       penanda backtest ('arrowUp' | 'arrowDown') — dan penanda Pine yang
       meminta bulatan lalu ditolak typecheck, padahal pustakanya menerima. */
    type TandaChart = {
      time: Time; position: 'aboveBar' | 'belowBar';
      color: string; shape: 'circle' | 'arrowUp' | 'arrowDown'; text: string;
    };
    const tanda: TandaChart[] = (trade ?? []).flatMap<TandaChart>((t) => [
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
        /* Bentuk dari skripnya. Sebelumnya SELALU panah — plotshape yang
           meminta shape.circle tetap tergambar sebagai panah, dan chart
           penuh panah untuk sesuatu yang di TradingView cuma titik kecil. */
        shape: (m.bentuk === 'panahAtas' ? 'arrowUp'
              : m.bentuk === 'panahBawah' ? 'arrowDown'
              /* 'kotak' ikut ke bulatan: pustaka ini cuma punya circle,
                 arrowUp, dan arrowDown. Bulatan bentuk paling netral —
                 memaksa kotak jadi panah menambahkan ARAH yang tidak
                 pernah diminta skripnya. */
              : 'circle') as 'circle' | 'arrowUp' | 'arrowDown',
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
        const tfMs = tfRef.current;
        return c.timeScale().logicalToCoordinate((times.length - 1 + (t - times[times.length - 1]) / tfMs) as Logical);
      };
      let kena: string | null = null;
      const daftar = gs ?? [];
      for (let i = daftar.length - 1; i >= 0; i--) {
        const g = daftar[i];
        const x1 = X(g.t1), x2 = X(g.t2);
        const y1 = s.priceToCoordinate(g.h1), y2 = s.priceToCoordinate(g.h2);
        if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
        if (g.jenis === 'rayH') {
          /* Cuma ke KANAN dari pangkalnya, sesuai bentuk yang digambar.
             Kotak uji yang mencakup seluruh lebar akan membuat setiap klik
             sejajar garisnya — termasuk jauh di sebelah kirinya, di masa
             lalu yang tidak ditandai apa pun — memilih garis ini. */
          if (px >= x1 - 8 && Math.abs(py - y1) <= 7) { kena = g.id; break; }
          continue;
        }
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
        /* Alat posisi menyimpan stop loss di harga KETIGA, yang letaknya
           justru di luar rentang h1..h2. Kotak uji yang cuma memakai dua
           harga membuat separuh alatnya — seluruh pita merah — tidak bisa
           diklik sama sekali. */
        let ya = Math.min(y1, y2), yb = Math.max(y1, y2);
        if (g.jenis === 'posisi') {
          const y3 = s.priceToCoordinate(g.h3 ?? g.h1);
          if (y3 != null) { ya = Math.min(ya, y3); yb = Math.max(yb, y3); }
        }
        if (px >= Math.min(x1, x2) - 8 && px <= Math.max(x1, x2) + 8
          && py >= ya - 8 && py <= yb + 8) { kena = g.id; break; }
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
    { id: string; mode: 'geser' | 'ujung1' | 'ujung2' | 'tp' | 'sl'; awal: GambarAlat; t: number; h: number } | null
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
      const tfMs = tfRef.current;
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
        const tfMs = tfRef.current;
        return c.timeScale().logicalToCoordinate((times.length - 1 + (t - times[times.length - 1]) / tfMs) as Logical);
      };
      const x1 = X(g.t1), x2 = X(g.t2);
      const y1 = s.priceToCoordinate(g.h1), y2 = s.priceToCoordinate(g.h2);
      if (x1 == null || x2 == null || y1 == null || y2 == null) return null;
      const y3 = g.jenis === 'posisi' ? s.priceToCoordinate(g.h3 ?? g.h1) : null;
      return { x1, y1, x2, y2, y3 };
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
      let mode: 'geser' | 'ujung1' | 'ujung2' | 'tp' | 'sl' | null = null;
      if (g.jenis === 'posisi') {
        /* Pegangan alat posisi TIDAK di sudut kotak. Menarik sudut akan
           menggeser waktu dan harga sekaligus, dan menggeser TP tanpa
           sengaja adalah cara termudah membuat rasio imbal-risiko yang
           tertulis di layar berbohong. Jadi: waktu di dua ujung garis
           entry, harga di tengah garisnya masing-masing. */
        const kr = Math.min(k.x1, k.x2), kn = Math.max(k.x1, k.x2);
        const tg = (kr + kn) / 2;
        if (dekat(kr, k.y1)) mode = 'ujung1';
        else if (dekat(kn, k.y1)) mode = 'ujung2';
        else if (dekat(tg, k.y2)) mode = 'tp';
        else if (k.y3 != null && dekat(tg, k.y3)) mode = 'sl';
        else {
          const atas = Math.min(k.y1, k.y2, k.y3 ?? k.y1);
          const bawah = Math.max(k.y1, k.y2, k.y3 ?? k.y1);
          if (p.x >= kr - 4 && p.x <= kn + 4 && p.y >= atas - 4 && p.y <= bawah + 4) mode = 'geser';
        }
      }
      else if (dekat(k.x1, k.y1)) mode = 'ujung1';
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
      document.body.style.cursor = mode === 'geser' ? 'move'
        : mode === 'tp' || mode === 'sl' ? 'ns-resize'
        : g.jenis === 'posisi' ? 'ew-resize' : 'grabbing';
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
      if (a.jenis === 'posisi') {
        /* Waktu dan harga dipisah tegas: ujung kiri/kanan hanya melebarkan
           rentangnya, garis TP/SL hanya naik-turun. Menggeser badannya
           membawa ketiga harga sekaligus — setup yang sudah disusun tidak
           boleh berubah rasionya hanya karena dipindah ke swing lain. */
        const dh = p.h - sg.h;
        if (sg.mode === 'geser') {
          const dt = p.t - sg.t;
          onUbahGambar(sg.id, {
            t1: a.t1 + dt, t2: a.t2 + dt,
            h1: a.h1 + dh, h2: a.h2 + dh, h3: (a.h3 ?? a.h1) + dh,
          });
        } else if (sg.mode === 'ujung1') onUbahGambar(sg.id, { t1: p.t });
        else if (sg.mode === 'ujung2') onUbahGambar(sg.id, { t2: p.t });
        else if (sg.mode === 'tp') onUbahGambar(sg.id, { h2: p.h });
        else onUbahGambar(sg.id, { h3: p.h });
        return;
      }
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
      const tfMs = tfRef.current;
      return { t: times[times.length - 1] + (l - (times.length - 1)) * tfMs, h };
    };

    /* ── ALAT POSISI: SEKALI KLIK, LANGSUNG TERTEMPEL ─────────────────
       Empat alat lain butuh dua titik karena dua titiknya memang informasi:
       dari mana ke mana. Setup SL/TP tidak begitu — yang benar-benar
       ditentukan orang cuma satu harga masuk, dan dua garis di sekitarnya
       yang memang akan digeser sesudahnya. Memaksa menarik dulu berarti
       meminta orang memutuskan target SEBELUM melihat kotaknya, padahal
       justru kotaknya yang dipakai memutuskan.

       Arahnya sudah ditentukan di bilah (tombol beli atau jual), jadi satu
       klik cukup: entry di tempat yang diklik, target ke arah untung, stop
       ke arah sebaliknya pada jarak yang sama — rasio 1:1 sebagai titik
       awal yang jelas-jelas sementara.

       Jaraknya diambil dari yang SEDANG TERLIHAT, bukan persentase harga.
       Angka tetap seperti 1% menghasilkan kotak setipis rambut di chart
       yang di-zoom lebar, dan kotak yang menelan seluruh layar di chart
       yang sedang rapat. 14% tinggi layar dan 22% lebarnya selalu jatuh
       proporsional, di harga berapa pun dan zoom berapa pun. */
    /* ── GARIS HARGA: sekali klik, selesai ─────────────────────────────
       Ditarik seperti alat lain akan menuntut dua titik untuk sesuatu yang
       cuma punya satu nilai berarti — harganya. Tarikan mendatar yang
       tidak boleh mengubah apa pun adalah gerakan yang menipu. */
    if (alat === 'rayH') {
      const tempelRay = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const p = posisiDari(e);
        if (!p) return;
        onAlatSelesai({ jenis: 'rayH', t1: p.t, h1: p.h, t2: p.t, h2: p.h });
        e.preventDefault();
        e.stopPropagation();
      };
      el.addEventListener('pointerdown', tempelRay);
      return () => el.removeEventListener('pointerdown', tempelRay);
    }

    if (alat === 'posisiBeli' || alat === 'posisiJual') {
      const beli = alat === 'posisiBeli';
      /* Koordinat x → stempel waktu. Sama seperti posisiDari, tapi tanpa
         sumbu harga: yang dicari cuma di mana ujung kanan kotaknya jatuh. */
      const waktuDariX = (x: number): number | null => {
        const c = chart.current;
        if (!c) return null;
        const t = c.timeScale().coordinateToTime(x);
        if (t != null) return (t as number) * 1000;
        const l = c.timeScale().coordinateToLogical(x);
        const times = acuan.current.lilin.times;
        if (l == null || times.length < 2) return null;
        return times[times.length - 1] + (l - (times.length - 1)) * tfRef.current;
      };
      const tempel = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const c = chart.current, s = seri.current;
        if (!c || !s) return;
        const p = posisiDari(e);
        if (!p) return;
        const paneH = paneHargaRef.current || el.getBoundingClientRect().height;
        const hAtas = s.coordinateToPrice(2);
        const hBawah = s.coordinateToPrice(Math.max(paneH - 2, 4));
        if (typeof hAtas !== 'number' || typeof hBawah !== 'number') return;
        const jarak = Math.abs(hAtas - hBawah) * 0.14;
        if (!isFinite(jarak) || jarak <= 0) return;

        /* Lebarnya diukur dalam PIKSEL lalu dibalik jadi waktu, bukan
           dihitung "sekian bar dikali durasi timeframe".

           Versi pertama memakai perkalian itu dan hasilnya memanjang
           menutupi hampir seluruh chart. Bukan karena angkanya kebesaran:
           durasi satu bar yang dipakai mengalikan itu sendiri salah 50x
           di simbol MT5 (lihat catatan tfMs di atas). Perkalian apa pun
           terhadap besaran yang tidak tetap akan meleset, dan melesetnya
           menumpuk makin jauh ke kanan.

           Piksel tidak punya akhir pekan. 18% lebar panel selalu 18%
           lebar panel — di simbol apa pun, di zoom berapa pun. */
        const kotakEl = el.getBoundingClientRect();
        const xKlik = e.clientX - kotakEl.left;
        const t2 = waktuDariX(Math.min(xKlik + kotakEl.width * 0.18, kotakEl.width - 4));
        if (t2 == null || t2 <= p.t) return;

        onAlatSelesai({
          jenis: 'posisi', arah: beli ? 'beli' : 'jual',
          t1: p.t, h1: p.h, t2,
          h2: p.h + (beli ? jarak : -jarak),
          h3: p.h - (beli ? jarak : -jarak),
        });
        e.preventDefault();
        e.stopPropagation();
      };
      chart.current?.applyOptions({ handleScroll: false, handleScale: false });
      el.addEventListener('pointerdown', tempel, true);
      return () => {
        chart.current?.applyOptions({ handleScroll: true, handleScale: true });
        el.removeEventListener('pointerdown', tempel, true);
      };
    }

    const bentuk = (t1: number, h1: number, t2: number, h2: number): Omit<GambarAlat, 'id'> =>
      ({ jenis: alat, t1, h1, t2, h2 });

    const turun = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const p = posisiDari(e);
      if (!p) return;
      tarikAlat.current = { t1: p.t, h1: p.h };
      alatPrim.current?.setPratinjau(bentuk(p.t, p.h, p.t, p.h));
      e.preventDefault();
      e.stopPropagation();
    };
    const gerak = (e: MouseEvent) => {
      const a = tarikAlat.current;
      if (!a) return;
      const p = posisiDari(e);
      if (!p) return;
      alatPrim.current?.setPratinjau(bentuk(a.t1, a.h1, p.t, p.h));
    };
    const lepas = (e: MouseEvent) => {
      const a = tarikAlat.current;
      if (!a) return;
      tarikAlat.current = null;
      alatPrim.current?.setPratinjau(null);
      const p = posisiDari(e);
      /* Klik tanpa tarikan bukan gambar — titik tunggal tidak menyimpan
         informasi apa pun. */
      /* Klik tanpa tarikan bukan gambar — titik tunggal tidak menyimpan
         informasi apa pun. (Alat posisi justru sebaliknya: ia ditempel
         dengan sekali klik, dan tidak pernah sampai ke baris ini.) */
      if (p && (Math.abs(p.t - a.t1) > 1 || p.h !== a.h1)) {
        onAlatSelesai(bentuk(a.t1, a.h1, p.t, p.h));
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

  /* Jiplak: cuma elemennya yang perlu dipegang. Sejak ia pindah ke panel
     sendiri, tidak ada lagi seretan, tambatan, maupun keadaan yang harus
     dijaga — letaknya sepenuhnya turunan dari harga yang diketik. */
  const jiplakEl = useRef<HTMLImageElement | null>(null);
  const jiplakRef = useRef(jiplak);
  jiplakRef.current = jiplak;

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
    /** Nilai broker PADA SAAT tombol Kirim ditekan. Dipakai penutup di
     *  bawah untuk tahu bahwa broker sudah bergerak — walau tidak persis
     *  ke nilai yang diminta. */
    slKirim?: number; tpKirim?: number;
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

  /* ══ POSISI YANG SEDANG DISOROT ═════════════════════════════════
     Dengan beberapa posisi terbuka sekaligus, chart penuh garis merah dan
     hijau yang semuanya berbunyi "SL" dan "TP" — dan tidak ada apa pun di
     layar yang memberi tahu SL yang mana milik entry yang mana. Yang
     terbaca cuma levelnya, dan tiga level berdempetan terlihat seperti satu
     kelompok padahal milik tiga order berbeda.

     Mengklik garis entry menyorot SATU posisi: entry, SL, dan TP-nya
     berubah biru dan menebal bersamaan, jadi kelompoknya terbaca sekali
     lihat. Warna sorotnya sengaja BUKAN hijau atau merah — dua warna itu
     sudah dipakai untuk arah dan untung/rugi, dan memakainya untuk arti
     ketiga membuat ketiganya kabur.

     Sorotnya SEMENTARA: klik di tempat lain, tekan Esc, atau diamkan saja.
     Sorot yang menetap berarti pemakainya harus ingat mematikannya, dan
     yang lupa akan membaca posisi biru sebagai jenis posisi yang berbeda. */
  const [sorotPos, setSorotPos] = useState<string | null>(null);
  const sorotRef = useRef<string | null>(null);
  const aturSorot = useCallback((t: string | null) => {
    if (sorotRef.current === t) return;
    sorotRef.current = t; setSorotPos(t);
  }, []);

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
  /* Price line untuk GARIS HARGA (alat rayH) — hanya label sumbunya.
     Terpisah dari dua daftar price line lain supaya bisa dibongkar sendiri:
     yang ini berubah tiap kali orangnya menambah atau menghapus garis. */
  const garisRayHarga = useRef<IPriceLine[]>([]);

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

    /* ── Jiplakan: disejajarkan pada HARGA ───────────────────────────
       Dikerjakan di sini, bukan di efeknya sendiri, supaya ia bergerak di
       FRAME YANG SAMA dengan lilinnya. Dengan pendengar terpisah, gambarnya
       akan tertinggal sepersekian detik tiap kali chart digeser — dan
       acuan yang tertinggal justru menipu, karena ia terlihat seperti zona
       yang meleset.

       Hanya sumbu TEGAK yang disejajarkan. Sumbu waktunya sengaja tidak:
       chart acuan hampir selalu punya rentang waktu yang lain, dan
       memaksakannya sejajar akan meregangkan gambarnya sampai tidak
       terbaca. Yang dicari orang dari gambar itu levelnya, bukan
       tanggalnya. */
    const gj = jiplakEl.current;
    const jp = jiplakRef.current;
    if (gj && jp) {
      const punyaHarga = jp.hargaAtas > 0 && jp.hargaBawah > 0 && jp.hargaAtas > jp.hargaBawah;
      const yA = punyaHarga ? s.priceToCoordinate(jp.hargaAtas) : null;
      const yB = punyaHarga ? s.priceToCoordinate(jp.hargaBawah) : null;
      if (yA != null && yB != null && yB > yA) {
        gj.style.top = yA + 'px';
        gj.style.height = (yB - yA) + 'px';
      } else {
        /* Belum diisi (atau angkanya tidak masuk akal): tampil apa adanya
           dari atas panel. Dikosongkan TEGAS, bukan dibiarkan — nilai sisa
           dari pengisian sebelumnya akan menahan gambarnya di ketinggian
           yang sudah tidak berarti apa-apa. */
        gj.style.top = '0px';
        gj.style.height = '';
      }
    }

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
  /* Penunjuk ke pasang() yang SELALU mutakhir. Dipakai penangan seretan
     jiplak untuk memaksa satu penempatan ulang di tengah gerakan: rAF di
     bawah melewati frame yang sidik jarinya tidak berubah, dan menyeret
     GAMBARNYA memang tidak mengubah apa pun di sisi chart — jadi tanpa
     panggilan tegas ini gambarnya diam sampai ada hal lain yang bergerak. */
  const pasangRef = useRef(pasang);
  pasangRef.current = pasang;

  /* `jiplak` IKUT DEPENDENSI, dan ini bukan kelengkapan formalitas. Loop
     rAF melewati frame yang sidik jarinya tidak berubah — dan memasang
     gambar jiplakan tidak mengubah satu pun nilai di sidik jari itu
     (rentang, ukuran, sumbu harga semuanya tetap). Tanpa baris ini,
     gambar yang dipasang saat chart sedang diam akan tetap `visibility:
     hidden` sampai ada hal lain yang kebetulan bergerak. */
  useEffect(pasang, [pasang, garisSeret, lilin, hingga, mundur, smi, posisiMt5, ubah, jiplak]);

  /* ── LOOP rAF: TETAP JALAN, TAPI BERHENTI BEKERJA SAAT TIDAK ADA YANG
        BERUBAH ───────────────────────────────────────────────────────────
     Versi sebelumnya memanggil pasang() enam puluh kali per detik tanpa
     syarat, selamanya. Dihitung dari isinya: tiap panggilan melakukan 16
     pembacaan tata letak dan penulisan gaya — priceScale().width(),
     panes().getHeight(), getBoundingClientRect(), lalu menulis style.left
     dan style.bottom. Jadi kira-kira 960 operasi tata letak per detik
     dikerjakan terus-menerus, bahkan saat chartnya diam dan tidak ada satu
     piksel pun yang perlu berpindah.

     Itu pajak tetap yang dibayar sepanjang halaman terbuka. Ia baru terasa
     saat ada pekerjaan lain yang berebut frame yang sama — misalnya replay
     yang memajukan bar empat kali sedetik sambil indikator Pine menambah
     satu panel dan dua seri lagi untuk diukur.

     Loopnya TIDAK dihapus, dan itu disengaja. Label melayang di sini HTML
     yang ditumpuk di atas kanvas: ia harus mengikuti saat chart digeser
     atau di-zoom, dan pustaka tidak memberi satu kejadian pun yang
     menangkap semua caranya. Yang diubah cuma syaratnya — kalau tidak ada
     yang berubah sejak frame lalu, framenya dilewati.

     Sidik jarinya sengaja dari nilai yang MURAH dibaca: rentang logis
     disimpan pustaka di memori (bukan pembacaan DOM), clientWidth/Height
     hampir selalu terlayani dari cache, dan sisanya cuma angka yang sudah
     ada di tangan. Kalau salah satu berubah, frame itu tetap dikerjakan
     penuh seperti dulu — jadi tidak ada keadaan yang kehilangan
     pembaruannya, cuma keadaan diam yang berhenti membayar. */
  const sidikRef = useRef('');

  useEffect(() => {
    let raf = 0;
    const tik = () => {
      raf = requestAnimationFrame(tik);
      const c = chart.current, k = kotak.current;
      if (c && k) {
        let r: { from: number; to: number } | null = null;
        try { r = c.timeScale().getVisibleLogicalRange() as { from: number; to: number } | null; } catch { r = null; }
        const { hingga: hg, lilin: l, garisSeret: gs, posisiMt5: pm } = acuan.current;
        /* Tinggi panel IKUT sidik jari. Pembatas antara panel harga dan
           panel osilator bisa diseret orangnya, dan itu memindahkan dasar
           hamparan tanpa mengubah rentang, ukuran kotak, atau satu pun
           nilai lain di sini. Tanpa baris ini, label akan tertinggal di
           tempat lama sampai ada hal lain yang kebetulan berubah.

           getHeight() membaca keadaan yang sudah disimpan pustaka, bukan
           memaksa peramban menghitung tata letak — jadi ia murah, dan
           harganya sepadan untuk menutup celah ini. */
        let tinggiPane = '';
        try { tinggiPane = c.panes().map((p) => Math.round(p.getHeight())).join(','); } catch { /* versi lama */ }

        /* ── SUMBU HARGA WAJIB IKUT. Ini celah yang saya buat sendiri ────
           Versi pertama sidik jari ini cuma memuat rentang WAKTU, ukuran
           kotak, dan tinggi panel. Menarik-ulur skala HARGA mengubah
           pemetaan tegak saja — rentang waktu tetap, kotak tetap, panel
           tetap — jadi framenya dilewati dan garis entry/SL/TP tertinggal
           di tempat lama sampai ada hal lain yang kebetulan berubah.
           Dilaporkan pemiliknya, dan memang benar.

           Dua harga acuan, bukan satu: satu titik cuma menangkap
           GESERAN; dua titik yang berbeda menangkap geseran DAN
           perubahan skala, karena keduanya menentukan pemetaan
           harga-ke-piksel secara utuh. */
        const s0 = seri.current;
        let sumbuHarga = '';
        if (s0 && l.closes.length) {
          const pa = l.closes[l.closes.length - 1];
          const ya = s0.priceToCoordinate(pa);
          const yb = s0.priceToCoordinate(pa * 1.01);
          sumbuHarga = `${ya == null ? 'x' : Math.round(ya)},${yb == null ? 'x' : Math.round(yb)}`;
        }

        const sidik = [
          r ? Math.round(r.from * 100) : 'x', r ? Math.round(r.to * 100) : 'x',
          k.clientWidth, k.clientHeight, tinggiPane, sumbuHarga,
          hg ?? -1, l.times.length, gs?.length ?? 0, pm?.length ?? 0,
          ubahRef.current ? 'seret' : '-',
        ].join('|');
        /* Saat sesuatu SEDANG diseret, jangan pernah dilewati: nilai
           seretannya hidup di ref dan tidak masuk sidik jari mana pun. */
        if (sidik === sidikRef.current && !ubahRef.current) return;
        sidikRef.current = sidik;
      }
      pasang();
    };
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

  /* Dipasang tiap render supaya daftar posisinya selalu yang terbaru.
     Ambangnya PIKSEL (bukan harga): yang menentukan "kena" adalah jarak di
     layar, dan ambang dalam harga akan salah di tiap zoom dan tiap simbol.
     Yang TERDEKAT yang menang — di akun cent beberapa entry bisa berjarak
     beberapa piksel saja, dan memilih yang pertama ketemu berarti menyorot
     posisi tetangganya. */
  klikPosRef.current = (y) => {
    const s = seri.current;
    const daftar = acuan.current.posisiMt5 ?? [];
    if (!s || !daftar.length || y == null) { aturSorot(null); return; }
    let kena: string | null = null;
    let dekat = 7;
    for (const p of daftar) {
      if (!p.entry) continue;
      const ye = s.priceToCoordinate(p.entry);
      if (ye == null) continue;
      const d = Math.abs(ye - y);
      if (d < dekat) { dekat = d; kena = p.tiket; }
    }
    /* null = klik di tempat lain, dan itu memang perintah "kembali seperti
       semula" — bukan keadaan yang perlu dipertahankan. */
    aturSorot(kena);
  };

  /* Posisi yang tertutup tidak boleh meninggalkan sorot menggantung: sorot
     ke tiket yang sudah tidak ada cuma membuat efek di bawah bekerja
     sia-sia, dan warnanya menempel ke posisi lain begitu tiketnya dipakai
     ulang. */
  useEffect(() => {
    if (sorotRef.current && !(posisiMt5 ?? []).some((p) => p.tiket === sorotRef.current)) {
      aturSorot(null);
    }
  }, [posisiMt5, aturSorot]);

  /* Bubar sendiri kalau didiamkan. Esc disediakan karena itu tombol yang
     sudah dipakai membatalkan seretan garis di halaman ini — satu tombol,
     satu arti.

     Yang sedang DIPEGANG atau punya ubahan belum diputuskan dilewati:
     warnanya justru sedang dipakai untuk melihat SL/TP mana yang digeser,
     dan mencabutnya di tengah seretan persis membuang gunanya. */
  useEffect(() => {
    if (!sorotPos) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') aturSorot(null); };
    window.addEventListener('keydown', esc);
    const t = setTimeout(() => {
      if (seretUbah.current || ubahRef.current) return;
      aturSorot(null);
    }, 9000);
    return () => { window.removeEventListener('keydown', esc); clearTimeout(t); };
  }, [sorotPos, aturSorot]);

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
    const buat = (price: number, color: string, title: string, lineStyle: number,
                  kunci?: string, axisLabelVisible = true, tebal: 1 | 2 = 1) => {
      try {
        const g = s.createPriceLine({ price, color, lineWidth: tebal, lineStyle, axisLabelVisible, title });
        garisPosMt5.current.push(g);
        if (kunci) petaGarisMt5.current.set(kunci, g);
      } catch { /* seri sedang dibongkar ulang */ }
    };
    /* TANPA NOMOR TIKET. Dulu empat angka terakhir tiket ditempelkan ke
       label SL/TP saat posisinya lebih dari satu, sebagai pembeda. Keputusan
       pemilik 22 Agu 2026: dibuang. Di layar sungguhan angka itu menumpuk
       di sisi kanan bersama harga, dan yang dibaca orang saat menatap chart
       adalah LEVELNYA, bukan nomor administrasi posisinya.

       Konsekuensinya diterima dengan sadar: dengan beberapa posisi terbuka,
       dua garis TP sama-sama berbunyi "TP". Yang membedakan tinggal
       harganya di sumbu kanan, dan nomor lengkapnya tetap ada di tabel
       Posisi Terbuka. */
    /* ── SATU LEVEL, SATU GARIS ─────────────────────────────────────────
       Layering di akun cent membuka belasan order dengan SL yang SAMA
       PERSIS. Satu garis per posisi berarti belasan garis bertumpuk di
       piksel yang sama, masing-masing menuntut kotak angkanya sendiri di
       sumbu kanan — dan sumbu harga berubah jadi kolom "SL 80100.00" yang
       diulang enam kali, menutupi harga yang justru sedang dibaca.

       Digabung berdasarkan PETAK TICK, bukan selisih float: dua level yang
       tercetak sama di layar memang satu level bagi pembacanya, dan
       4398,507 − 4398,506 = 0,0009999999995 sudah cukup untuk menggagalkan
       perbandingan selisih.

       Warna ikut jadi kunci. Entry BUY hijau dan entry SELL merah di harga
       yang sama persis (posisi terkunci) adalah dua hal berbeda; menyatukan
       keduanya berarti salah satunya digambar dengan warna lawan arahnya —
       dan warna itulah yang dibaca lebih dulu daripada angkanya. */
    const daftar = posisiMt5 ?? [];
    const fmtG = (s.options() as { priceFormat?: { minMove?: number } }).priceFormat;
    const tickG = fmtG?.minMove && fmtG.minMove > 0 ? fmtG.minMove : 1e-6;
    const petakG = (x: number) => Math.round(x / tickG);

    type Level = { price: number; color: string; title: string; style: number; kunci: string[]; sorot: boolean };
    const unik = new Map<string, Level>();
    const kumpul = (price: number, color: string, title: string, style: number, kunci?: string, sorot = false) => {
      const k = `${title}|${color}|${petakG(price)}`;
      const ada = unik.get(k);
      /* Tiket yang berbagi garis DIDAFTARKAN SEMUA. Peta ini yang dipakai
         seretan SL/TP; kalau cuma tiket pertama yang terdaftar, menyeret SL
         tiket kedua tidak menggerakkan apa pun di layar walau perintahnya
         terkirim. Menyeret salah satunya menggerakkan garis bersamanya —
         memang begitu yang terlihat benar, dan begitu servernya menjawab,
         level yang berubah otomatis memisahkan diri jadi garis sendiri. */
      if (ada) { if (kunci) ada.kunci.push(kunci); return; }
      unik.set(k, { price, color, title, style, kunci: kunci ? [kunci] : [], sorot });
    };

    /* Biru langit, bukan biru tua: latarnya zinc-950, dan biru gelap di
       sana terbaca sebagai garis yang REDUP — kebalikan dari maksudnya. */
    const SOROT = '#60a5fa';
    daftar.forEach((p) => {
      const u = ubahRef.current && ubahRef.current.tiket === p.tiket ? ubahRef.current : null;
      const nyala = sorotPos === p.tiket;
      kumpul(p.entry, nyala ? SOROT : p.arah === 'BUY' ? '#10b981' : '#f87171', '', 2, undefined, nyala);
      const slPos = u ? u.sl : p.sl;
      if (slPos > 0) kumpul(slPos, nyala ? SOROT : '#f87171', 'SL', 1, p.tiket + '-sl', nyala);
      const tpPos = u ? u.tp : p.tp;
      if (tpPos > 0) kumpul(tpPos, nyala ? SOROT : '#10b981', 'TP', 1, p.tiket + '-tp', nyala);
    });

    /* ── LABEL YANG AKAN BERTABRAKAN DISEMBUNYIKAN ──────────────────────
       Menggabung yang sama persis belum cukup. Layering juga membuka order
       di harga yang BERBEDA TIPIS — 77259,52 / 77259,13 / 77258,55 — dan
       sumbu harga memaksa kotak-kotaknya saling menghindar, jadi tiga level
       yang berjarak satu dolar tergambar sebagai tiga baris berjauhan yang
       memanjang ke atas.

       Yang disembunyikan LABELNYA saja; garisnya tetap digambar di harga
       aslinya masing-masing. Tidak ada level yang hilang dari chart — yang
       hilang cuma angka kembar yang tidak terbaca.

       SL dan TP didahulukan daripada entry: kalau harus memilih satu angka
       untuk sekelompok level berdempetan, yang paling dicari mata adalah
       batas rugi dan target, bukan harga masuk yang sudah lewat.

       Ambangnya PIKSEL, bukan harga — yang menyebabkan tabrakan memang
       tinggi kotaknya di layar, dan ambang dalam harga akan salah di tiap
       zoom dan tiap simbol. Dihitung saat garisnya dibangun; sesudah
       zoom jauh ke dalam, beberapa label bisa tetap tersembunyi sampai
       posisinya berubah. Itu diterima: memasang ulang seluruh price line
       tiap frame zoom jauh lebih mahal daripada satu angka yang telat
       muncul. */
    const TINGGI_LABEL = 15;
    const urut = [...unik.values()].sort((a, b) => {
      /* Yang disorot paling depan: kalau harus memilih satu angka untuk
         sekelompok level berdempetan, yang sedang DIMINTA dilihat orangnya
         menang atas yang kebetulan ada di dekatnya. Sesudah itu urutan lama
         berlaku apa adanya — SL/TP dulu, entry belakangan. */
      const bobot = (x: Level) => (x.sorot ? 0 : x.title ? 1 : 2);
      return bobot(a) - bobot(b) || b.price - a.price;
    });
    const yTerpakai: number[] = [];
    urut.forEach((lv) => {
      let label = true;
      const y = s.priceToCoordinate(lv.price);
      if (y != null) {
        if (yTerpakai.some((v) => Math.abs(v - y) < TINGGI_LABEL)) label = false;
        else yTerpakai.push(y);
      }
      buat(lv.price, lv.color, lv.title, lv.style, undefined, label, lv.sorot ? 2 : 1);
      const g = garisPosMt5.current[garisPosMt5.current.length - 1];
      if (g) lv.kunci.forEach((k) => petaGarisMt5.current.set(k, g));
    });
    return () => {
      garisPosMt5.current.forEach((g) => { try { s.removePriceLine(g); } catch { /* dibongkar */ } });
      garisPosMt5.current = [];
      petaGarisMt5.current.clear();
    };
  }, [posisiMt5, ubah, sorotPos]);

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

  /* ── Angka garis harga masuk ke SUMBU ──────────────────────────────
     `lineVisible: false` — yang diminta cuma kotak angkanya di kolom sumbu,
     bukan garis kedua. Garis rayanya sendiri digambar penggambar alat di
     kanvas, menjulur ke kanan saja; price line tidak bisa melakukan itu
     (ia selalu selebar panel), jadi keduanya berbagi tugas: satu menggambar
     bentuknya, satu menaruh angkanya di tempat yang benar.

     Dibongkar-pasang seluruhnya tiap kali daftar gambarnya berubah.
     Menyeret gambar yang sudah ada memang membuat efek ini jalan lagi —
     tapi itu sudah keadaan yang memicu render React penuh, jadi tidak ada
     ongkos baru yang ditambahkan di sini. */
  useEffect(() => {
    const s = seri.current;
    if (!s) return;
    for (const g of (gambarAlat ?? [])) {
      if (g.jenis !== 'rayH') continue;
      try {
        garisRayHarga.current.push(s.createPriceLine({
          price: g.h1,
          color: 'rgba(250,204,21,.95)',
          lineWidth: 1,
          lineStyle: 0,
          lineVisible: false,
          axisLabelVisible: true,
          title: '',
        }));
      } catch (e) { /* seri sedang dibongkar ulang */ }
    }
    return () => {
      garisRayHarga.current.forEach((g) => { try { s.removePriceLine(g); } catch { /* dibongkar */ } });
      garisRayHarga.current = [];
    };
  }, [gambarAlat]);

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
    if (dekat(ubah.sl, p.sl) && dekat(ubah.tp, p.tp)) { aturUbah(null); return; }

    /* ── BROKER SUDAH BERGERAK = PRATINJAU SELESAI ────────────────────
       Syarat di atas menuntut KEDUA nilai cocok. Kalau broker cuma
       menerima sebagiannya — SL dipasang, TP ditolak karena terlalu dekat
       harga, misalnya — syarat itu tidak pernah terpenuhi dan pratinjaunya
       NYANGKUT selamanya: garis di harga yang diminta terus tergambar di
       samping garis yang benar-benar terpasang, dan dua-duanya berlabel.

       Yang menyesatkan bukan garis gandanya, melainkan garis yang
       menyatakan SL ada di tempat yang sebenarnya bukan.

       Begitu broker MENJAWAB — nilainya berubah dari yang tercatat saat
       Kirim ditekan, ke mana pun ia mendarat — jawabannya itulah yang
       benar. Pratinjau dibubarkan, dan yang tersisa di layar adalah nilai
       broker apa adanya. */
    if (ubah.terkirim && ubah.slKirim !== undefined && ubah.tpKirim !== undefined
        && (!dekat(ubah.slKirim, p.sl) || !dekat(ubah.tpKirim, p.tp))) {
      aturUbah(null);
    }
  }, [posisiMt5, ubah, aturUbah]);

  /* ── BATAS WAKTU PRATINJAU ──────────────────────────────────────────
     Jaring terakhir. Penutup di atas bergantung pada laporan yang BERUBAH;
     kalau brokernya menolak seluruh ubahan tanpa mengubah apa pun, tidak
     ada perubahan yang bisa dipakai sebagai tanda dan pratinjaunya
     menetap.

     LIMA detik, dan angka itu punya dasar. Daftar posisi dipoll tiap 30
     detik, jadi menunggu poll berikutnya bukan pilihan — karena itu
     pemanggil (ubahPosisiMt5) MEMINTA laporan baru begitu perintahnya
     dikonfirmasi. Laporan itu tiba sedetik dua detik kemudian, dan jalur
     normal di atas yang membubarkan pratinjaunya.

     Pewaktu ini hanya untuk sisa kasusnya: laporan datang tapi tidak ada
     yang berubah karena brokernya menolak. Lima detik cukup untuk
     kedatangan laporan yang sudah diminta, dan cukup singkat supaya garis
     yang salah tidak lama-lama dipandangi.

     Versi pertama memakai delapan detik dengan alasan "laporan EA datang
     tiap beberapa detik" — keliru, dan bukan cuma soal kelamaan: tanpa
     permintaan laporan di atas, pewaktu apa pun yang lebih pendek dari 30
     detik akan membubarkan pratinjau SEBELUM broker sempat melapor, dan
     garisnya balik ke nilai lama padahal kirimnya berhasil. */
  useEffect(() => {
    if (!ubah || !ubah.terkirim || ubah.sibuk) return;
    const t = setTimeout(() => {
      if (ubahRef.current && ubahRef.current.terkirim && !seretUbah.current) aturUbah(null);
    }, 5000);
    return () => clearTimeout(t);
  }, [ubah, aturUbah]);

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
    /* Nilai broker DIPOTRET SEBELUM dikirim. Sesudahnya ia mungkin sudah
       berubah, dan potret yang diambil belakangan tidak bisa lagi
       membedakan "broker menjawab" dari "broker diam". */
    const p0 = (acuan.current.posisiMt5 ?? []).find((x) => x.tiket === kirim.tiket);
    aturUbah({ ...kirim, sibuk: true, slKirim: p0 ? p0.sl : kirim.sl, tpKirim: p0 ? p0.tp : kirim.tp });
    const ok = await onUbahPosisi(kirim.tiket, kirim.sl, kirim.tp);
    /* Sukses: tombolnya hilang tapi PRATINJAUNYA bertahan sampai laporan
       EA menyusul (efek penutup di atas yang membubarkannya). Gagal:
       tombol tetap ada — nilainya masih di tempat, tinggal coba lagi
       atau Batal. */
    const u = ubahRef.current;
    if (u && u.tiket === kirim.tiket) aturUbah({ ...u, sibuk: false, terkirim: ok });
    /* GAGAL = pratinjaunya dibubarkan, bukan ditinggal di layar.
       Sebelumnya tombolnya sengaja dibiarkan supaya bisa dicoba lagi —
       tapi selama itu garisnya tetap menggambar SL di tempat yang broker
       TOLAK. Kalau perlu digeser lagi, garis aslinya masih ada dan masih
       bisa ditarik; yang tidak boleh bertahan adalah gambar yang salah. */
    if (!ok) {
      const v = ubahRef.current;
      if (v && v.tiket === kirim.tiket && !seretUbah.current) aturUbah(null);
    }
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
    /* ── LAYAR TERBELAH SAAT MENJIPLAK ────────────────────────────────
       Pembungkus luar jadi baris flex; panel acuan di kiri, chart di kanan.

       PEMBUNGKUS `relative` TETAP MELINGKUPI CHART SAJA, bukan keduanya.
       Seluruh hamparan di bawah — label harga, garis posisi, gagang seret,
       tombol Kirim — diposisikan dengan koordinat yang dihitung dari
       KANVAS. Kalau titik nol-nya digeser ke tepi kiri panel acuan, setiap
       satu dari mereka meleset sejauh lebar panel itu, dan melesetnya cuma
       muncul saat menjiplak: kerusakan yang gampang lolos ke tayang.

       Chart-nya menyusut sendiri lewat flex-1, dan ResizeObserver yang
       sudah terpasang di wadahnya yang memberi tahu pustakanya. */
    <div className="flex">
      {jiplak && (
        <div className="relative shrink-0 overflow-hidden border-r border-zinc-800 bg-zinc-950"
             style={{ width: `${Math.round(jiplak.lebar * 100)}%`, height: tinggi }}>
          {/* Ketajaman PENUH — tidak ada opasitas yang dikurangi. Gambar ini
              tidak menutupi apa pun, jadi tidak ada alasan menyulitkannya
              dibaca. */}
          <img ref={jiplakEl} src={jiplak.url} alt="" draggable={false}
               className="absolute inset-x-0 w-full select-none"
               style={{ top: 0 }} />
        </div>
      )}
      <div className="relative min-w-0 flex-1 overflow-hidden" onPointerDownCapture={() => setGarisAktif(null)}>
      <div ref={kotak} style={{ height: tinggi }} className="relative w-full" />

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
               sorotPos === p.tiket ? 'text-blue-400'
                 : p.arah === 'BUY' ? 'text-emerald-400' : 'text-red-400')}
             style={{ transform: 'translateY(-100%)', visibility: 'hidden',
               textShadow: '0 1px 4px rgba(9,9,11,.95), 0 0 2px rgba(9,9,11,.9)' }}>
          {/* Arah dan lot saja. Nomor tiketnya dibuang bersama yang di
              label SL/TP — lihat catatannya di efek garis posisi. */}
          {p.arah} {p.lot}
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

      {/* Menempel pada lilin tertua; posisinya ditulis cek() di atas.
          Mulai di -9999px supaya tidak sempat berkedip di tepi kiri sebelum
          koordinat pertamanya terhitung.

          pointer-events-none di pembungkusnya, auto di isinya: pembungkus
          yang menangkap tetikus akan mematikan geser, zoom, dan seluruh alat
          gambar di bawahnya -- kartu kecil yang membekukan chart adalah harga
          yang jauh terlalu mahal untuk sebuah ajakan. */}
      {hamparanBarTertua && (
        <div ref={tempelRef}
             className="pointer-events-none absolute left-0 top-1/2 z-20 will-change-transform"
             style={{ transform: 'translate(-9999px, -50%)' }}>
          <div className="pointer-events-auto">{hamparanBarTertua}</div>
        </div>
      )}

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
    </div>
  );
}
