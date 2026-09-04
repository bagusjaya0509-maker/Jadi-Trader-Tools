import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { PanelCopyTradeFi } from '@/components/panel-copy-tradefi';
import {
  Play, Loader2, RefreshCw, Radio, TriangleAlert, History,
  Layers, ChevronDown, ChevronUp, Settings2, Code2, X, Ruler, Rows3, Square, Eraser, Minus, TrendingUp,
  MoveRight,
  FlaskConical, GripHorizontal, Maximize2, Minimize2, SquareArrowUp, SquareArrowDown,
  Settings, RotateCcw, LayoutGrid, Link2 } from 'lucide-react';
import { PanelNews } from '@/components/panel-news';
import { simpanDraf } from '@/lib/draf-sinyal';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga, tanggalPendek } from '@/lib/utils';
import { ChartLilin, TAMPILAN_BAWAAN, type Garis, type GarisHarga, type GarisKlik, type GarisSeret, type PosisiChartMt5, type TampilanChart } from '@/components/chart-lilin';
import { barisPendingKripto, rencanaLokal } from '@/lib/pending-kripto';
import { POLOS, UTAMA, ID_PANEL, TF_PANEL, kirimBus, dengarBus, nyalakanMulti, replayDipegangLain, pegangReplay } from '@/lib/multi-chart';
import { PanelReplay, type AksiOrder, type JenisEntry } from '@/components/panel-replay';
import { PojokOrder } from '@/components/pojok-order';
import { kirimOrderNyata, ubahSlTpNyata, batalPendingNyata, tutupPosisiNyata, tickSimbol, keTick, type MetodeTp } from '@/lib/order-nyata';
import { kirimPerintahMt5, tungguHasilMt5 } from '@/lib/mt5-order';
import { DockPine, type InfoPine, type KendaliPine } from '@/components/dock-pine';
import { WatchChart } from '@/components/watch-chart';
import { PanelPosisiTerbuka, type OrderSunting, type BandingSalinan } from '@/components/panel-posisi-terbuka';
import { ChartBanding } from '@/components/chart-banding';
import { PanelDex } from '@/components/panel-dex';
import type { AlatPegang, GambarAlat } from '@/lib/plugin-alat';
import type { HasilPine } from '@/lib/pine';
import { bacaSetelanChart, simpanSetelanChart, usulSlTp } from '@/lib/replay';
import { atr } from '@/lib/jt-scan-core';
import { ambilKlines, ambilKlinesSebelum, aturPasarKripto, bacaAcuanMt5, bacaNamaMt5, bacaPasar, bacaSpekMt5, bacaTickMt5, daftarSimbolMt5, pasarKripto, type Lilin } from '@/lib/pasar';
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
import { simbolDasarMt5, useSimbol, bacaAktif, tambahSimbol } from '@/lib/simbol';
import { useAuth } from '@/lib/auth';
import { modePreview, jatahTerpakai, pakaiJatah } from '@/lib/preview';
import { usePaket, pakaiKuota, teksSisa } from '@/lib/paket';
import { JIPLAK_BAWAAN, type AturJiplak } from '@/components/jiplak-chart';
import type { PosisiDompet, KeadaanDompet, Peringkat,
  JendelaPeringkat, PitaAkun } from '@/lib/wallet-agen';
import { peringkatDompet } from '@/lib/wallet-agen';
import { PanelBelah } from '@/components/panel-belah';
/* Halaman Screener UTUH, dipasang di panel kiri. Bukan salinan bingkainya:
   komponen itu membawa gerbang kuotanya sendiri, dan screener adalah alat
   berbayar yang tiap pindainya memanggil proxy untuk ratusan simbol.
   Menyalin bingkainya tanpa gerbangnya akan mengubah alamat ini jadi
   screener gratis tanpa batas.

   `lazy`, bukan impor statis: berkasnya 43 kB dan mayoritas kunjungan ke
   chart tidak membukanya. */
const ScreenerTertanam = lazy(() => import('@/halaman/ScreenerV2'));

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

/* Daftarnya tinggal di `lib/multi-chart.ts` — SATU sumber untuk halaman ini
   dan untuk panel multi-chart. Dulu keduanya menyimpan salinan sendiri yang
   isinya sama persis, dan menambah satu timeframe berarti mengingat dua
   tempat. Yang lupa tidak menghasilkan galat: panelnya cuma diam-diam
   kehilangan pilihan itu. */
const TF = TF_PANEL;

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

/* ── GAMBAR ALAT MILIK SIMBOL, BUKAN SIMBOL+TIMEFRAME ────────────────────
   Dulu kuncinya `jt.alat.<simbol>|<tf>`, jadi garis yang ditarik di Harian
   tidak ada sama sekali saat chart yang sama dibuka di 4 jam. Itu keliru
   membaca apa yang ditandai orang: level 2.437 pada ETH adalah level yang
   sama pada timeframe mana pun — yang berganti cuma seberapa jauh ke
   belakang layarnya melihat, bukan harganya.

   Ujung gambar disimpan sebagai stempel waktu mutlak dan harga, dan
   penggambarnya sudah tahu memetakan waktu yang tidak jatuh persis di satu
   bar (lewat sumbu logika). Jadi tidak ada yang perlu dihitung ulang saat
   timeframe-nya berganti — yang menahannya selama ini cuma kuncinya. */
const kunciAlat = (simbol: string) => `jt.alat.${simbol}`;

function simpanAlat(simbol: string, daftar: GambarAlat[]) {
  try { localStorage.setItem(kunciAlat(simbol), JSON.stringify(daftar)); }
  catch { /* mode privat, atau kuotanya penuh */ }
}

/** Membaca gambar satu simbol, SEKALIGUS mengangkat yang masih tersimpan di
 *  kunci per-timeframe yang lama.
 *
 *  Pemindahannya wajib, bukan kerapian: tanpa ini perubahan kunci akan
 *  terbaca sebagai "semua gambar saya hilang" — kerusakan yang jauh lebih
 *  buruk daripada cacat yang sedang diperbaiki. */
function bacaAlat(simbol: string): GambarAlat[] {
  const kunci = kunciAlat(simbol);
  let daftar: GambarAlat[] = [];
  try {
    const d = JSON.parse(localStorage.getItem(kunci) ?? '[]');
    if (Array.isArray(d)) daftar = d;
  } catch { /* rusak — diperlakukan kosong, lalu ditimpa di bawah */ }

  let lama: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      /* Awalan LENGKAP dengan garis tegaknya. Tanpa itu `jt.alat.BTC`
         ikut menyapu `jt.alat.BTCUSDT|1h`, dan gambar simbol lain
         berpindah ke simbol yang salah tanpa ada yang tahu. */
      if (k && k.startsWith(kunci + '|')) lama.push(k);
    }
  } catch { return daftar; }
  if (!lama.length) return daftar;

  /* Diurutkan supaya hasil gabungannya tidak bergantung pada urutan
     localStorage, yang tidak dijamin peramban mana pun. */
  lama = lama.sort();
  const ada = new Set(daftar.map((g) => g.id));
  for (const k of lama) {
    try {
      const d = JSON.parse(localStorage.getItem(k) ?? '[]');
      if (Array.isArray(d)) {
        for (const g of d) {
          if (g && g.id && !ada.has(g.id)) { ada.add(g.id); daftar.push(g as GambarAlat); }
        }
      }
    } catch { /* satu kunci rusak tidak boleh menjatuhkan sisanya */ }
    try { localStorage.removeItem(k); } catch { /* privat */ }
  }
  simpanAlat(simbol, daftar);
  return daftar;
}

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

/** Petak warna di panel setelan, urut baca: badan dulu baru ekor.
 *
 *  Outline TIDAK ada di sini walaupun ia juga warna. Petak di daftar ini
 *  memakai `<input type="color">` polos yang tidak bisa menyimpan null,
 *  sementara outline butuh keadaan ketiga -- "ikut badan" -- yang justru
 *  jadi bawaannya. Ia dapat barisnya sendiri di panel, sebentuk dengan
 *  baris "Latar chart" yang punya persoalan yang sama. */
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
    /* Outline: null itu NILAI YANG SAH (ikut badan), jadi ia diperiksa
       terpisah dari warnanya. Kalau cuma `warnaSah` yang dipakai, orang yang
       sengaja mengembalikan outline ke ikut-badan akan mendapati pilihannya
       diam-diam kembali ke warna lamanya tiap halaman dimuat -- karena null
       ditolak dan nilai bawaan yang menang. */
    (['garisNaik', 'garisTurun'] as const).forEach((k) => {
      if (warnaSah(o[k])) hasil[k] = o[k] as string;
      else if (o[k] === null) hasil[k] = null;
    });
    if (warnaSah(o.latar)) hasil.latar = o.latar;
    if (typeof o.kisi === 'boolean') hasil.kisi = o.kisi;
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

/* ── PASANGAN PENGGANTI YANG MUNGKIN DIMAKSUD ────────────────────────────
   Koin yang datang dari daftar chart pantauan dan dari dompet Hyperliquid
   memakai penamaan bursanya sendiri, dan sebagiannya tidak ada di Binance
   dengan nama itu. Yang paling sering: awalan `k` untuk kelipatan seribu —
   kPEPE di Hyperliquid adalah 1000PEPE di Binance, dan PEPE polos di spot.

   Yang dikembalikan CUMA TEBAKAN NAMA. Fungsi ini tidak tahu, dan tidak
   berpura-pura tahu, apakah dua nama itu aset yang sama; kelipatannya pun
   berbeda. Karena itu hasilnya ditawarkan sebagai tombol, tidak pernah
   dipakai sendiri — chart yang diam-diam berpindah ke harga seribu kali
   beda adalah kesalahan yang tidak terlihat sampai ada order dikirim.

   Kosong kalau tidak ada tebakan yang layak. Menawarkan sesuatu untuk tiap
   salah ketik akan membuat tombolnya berhenti berarti. */
function alternatifSimbol(simbol: string): string[] {
  const s = String(simbol || '').toUpperCase();
  /* MT5 punya dunia nama sendiri (sufiks broker: c, .m, micro) dan tebakan
     di sana lebih sering salah daripada benar. */
  if (!s || s.startsWith('MT5:')) return [];

  const m = s.match(/^(.+?)(USDT|USDC|USD)$/);
  if (!m) return [];
  const [, dasar, mata] = m;

  const calon: string[] = [];
  /* K di depan = kelipatan seribu di Hyperliquid. Dua kemungkinan di
     Binance: nama polosnya (spot) dan 1000-nya (futures). */
  if (/^K[A-Z0-9]{2,}$/.test(dasar)) {
    calon.push(dasar.slice(1) + mata, '1000' + dasar.slice(1) + mata);
  }
  /* Arah sebaliknya, untuk yang datang dengan nama Binance ke tempat yang
     memakai nama polos. */
  if (/^1000[A-Z0-9]{2,}$/.test(dasar)) calon.push(dasar.slice(4) + mata);
  /* USDC jarang punya pasangan di Binance; USDT hampir selalu ada. */
  if (mata === 'USDC') calon.push(dasar + 'USDT');

  return [...new Set(calon)].filter((x) => x !== s).slice(0, 3);
}

/* Nama parameter simbol dibaca DUA EJAAN: `simbol` (dipakai semua tautan
   di dalam aplikasi) dan `symbol` (yang ditulis orang, dan yang dipakai
   alat luar mana pun).

   Bukan kerapian. Kalau ejaannya tidak dikenali, simbolnya diam-diam
   diabaikan dan chart jatuh ke simbol terakhir yang diingat -- SEMENTARA
   entry/sl/tp dari alamat yang sama tetap terbaca, karena nama ketiganya
   memang sudah benar. Hasilnya level emas 4.632 tergambar di chart Bitcoin
   79.269: tidak ada galat, tidak ada peringatan, cuma tiga label harga yang
   menempel di dasar layar sementara panel tiketnya ikut hidup.

   Persis itu yang terjadi pada alamat
   ?symbol=MT5:XAUUSD&entry=4632.29&sl=4637.84&tp=4626.74 */
/* ════════════════════════════════════════════════════════════════════════
   DAFTAR POSISI DOMPET, DI PANEL KIRI CHART
   ════════════════════════════════════════════════════════════════════════
   Dibuka dari kartu dompet lewat `?dompet=<alamat>`. Gunanya satu: dompet
   yang memegang enam belas posisi menuntut enam belas kali bolak-balik ke
   panel Copy Signal kalau chartnya harus dibuka satu per satu. Dengan
   daftarnya duduk di samping chart, berpindah pasangan tinggal satu klik.

   Memakai slot panel kiri yang SAMA dengan gambar jiplak — lebar yang bisa
   ditarik, batas yang bisa dipegang, chart yang menyusut sendiri. Tidak ada
   tata letak kedua yang harus dijaga sepakat.

   Baris yang simbolnya tidak ada di Binance TETAP DITAMPILKAN. Token yang
   lahir dan hidup di Hyperliquid saja (PURR, CASHCAT) akan membuka chart
   kosong, dan itu lebih jujur daripada daftar yang diam-diam berbeda dari
   yang orang lihat di dompetnya. */
/* ── DAFTAR KONSENSUS DI PANEL KIRI ────────────────────────────────────
   Saudara kandung DaftarPosisiDompet, dan sengaja dibuat semirip mungkin:
   dua daftar yang berperilaku sama harus terlihat sama.

   Bedanya isinya. Yang satu menjawab "dompet ini pegang apa saja", yang ini
   menjawab "koin ini dipegang siapa saja, dan sebagus apa rekam jejak
   mereka". Yang kedua itulah yang dipakai memilih koin mana yang layak
   dibuka chartnya — dan sebelum ini, menjawabnya berarti bolak-balik ke
   Copy Signal untuk tiap koin. */
/* Satu daftar untuk DUA sumber: konsensus dompet pantauan, dan Wallet View
   dari papan peringkat. Bentuk datanya sengaja disamakan di pemanggil
   supaya komponennya cukup satu — dua daftar yang berperilaku sama tapi
   ditulis dua kali akan berbeda dalam sebulan, dan yang berbeda selalu
   bagian yang jarang dilihat. */
function DaftarKonsensus({ grup, aktif, pilih, keluar, judul, sub }: {
  grup: { koin: string; nL: number; nS: number; wrL: number | null; wrS: number | null;
          entry: number; nilai: number }[];
  aktif: string;
  pilih: (simbol: string) => void;
  keluar: () => void;
  judul?: string;
  sub?: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex items-start gap-2 border-b border-zinc-800 bg-zinc-950 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-zinc-100">{judul || 'Konsensus dompet'}</p>
          <p className="text-[10.5px] text-zinc-600">{sub || grup.length + ' koin · WR rata-rata tiap sisi'}</p>
        </div>
        <button onClick={keluar} title="Tutup daftar dan kembali"
          className="shrink-0 cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {grup.map((g) => {
          const sim = g.koin + 'USDT';
          const ini = sim === aktif;
          return (
            <button key={g.koin} onClick={() => pilih(sim)}
              className={cn('flex w-full cursor-pointer flex-col gap-0.5 border-b border-zinc-800/60 px-2.5 py-1.5 text-left transition-colors',
                ini ? 'bg-zinc-800/70' : 'hover:bg-zinc-900')}>
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className={cn('text-[12px] font-semibold', ini ? 'text-zinc-50' : 'text-zinc-200')}>{g.koin}</span>
                {g.nL > 0 && (
                  <span className="text-[10.5px] font-semibold text-emerald-400">
                    {g.nL}L{g.wrL !== null && <span className="font-normal text-zinc-600"> {g.wrL}%</span>}
                  </span>
                )}
                {g.nS > 0 && (
                  <span className="text-[10.5px] font-semibold text-red-400">
                    {g.nS}S{g.wrS !== null && <span className="font-normal text-zinc-600"> {g.wrS}%</span>}
                  </span>
                )}
                <span className="ml-auto text-[10px] tabular-nums text-zinc-600">
                  ${g.nilai >= 1e6 ? (g.nilai / 1e6).toFixed(1) + 'jt' : Math.round(g.nilai / 1000) + 'rb'}
                </span>
              </span>
              <span className="text-[10px] tabular-nums text-zinc-600">
                rata entry {g.entry ? g.entry.toFixed(g.entry > 100 ? 0 : 4) : '—'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DaftarPosisiDompet({ posisi, aktif, pilih, keluar }: {
  posisi: PosisiDompet[];
  aktif: string;
  pilih: (simbol: string) => void;
  keluar: () => void;
}) {
  const simbolDari = (koin: string) => String(koin || '').toUpperCase().replace(/^@/, '') + 'USDT';
  const nama = posisi.length ? posisi[0].nama : '';
  const total = posisi.reduce((n, p) => n + p.pnl, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex items-start gap-2 border-b border-zinc-800 bg-zinc-950 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-zinc-100">{nama || 'Dompet pantauan'}</p>
        <p className="text-[10.5px] text-zinc-600">
          {posisi.length} posisi ·{' '}
          <span className={total >= 0 ? 'text-emerald-400/90' : 'text-red-400/90'}>
            {total >= 0 ? '+' : '−'}${Math.abs(total).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
          </span>{' '}mengambang
        </p>
        </div>
        {/* Pintu keluar. Mode belah dua ini dimasuki dari halaman lain, dan
            tanpa jalan pulang satu-satunya cara keluar adalah menyunting
            alamatnya sendiri — yang tidak akan terpikir oleh siapa pun yang
            sedang membaca chart. */}
        <button onClick={keluar} title="Tutup daftar dan kembali"
          className="shrink-0 cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {posisi.map((p, i) => {
          const sim = simbolDari(p.koin);
          const ini = sim === aktif;
          return (
            <button key={p.koin + i} onClick={() => pilih(sim)}
              className={cn('flex w-full cursor-pointer flex-col gap-0.5 border-b border-zinc-800/60 px-2.5 py-1.5 text-left transition-colors',
                ini ? 'bg-zinc-800/70' : 'hover:bg-zinc-900')}>
              <span className="flex items-baseline gap-1.5">
                <span className={cn('text-[12px] font-semibold', ini ? 'text-zinc-50' : 'text-zinc-200')}>{p.koin}</span>
                <span className={cn('text-[10.5px] font-semibold',
                  p.arah === 'LONG' ? 'text-emerald-400' : 'text-red-400')}>{p.arah}</span>
                {p.leverage > 0 && <span className="text-[10px] text-zinc-600">{p.leverage}×</span>}
                <span className={cn('ml-auto text-[11px] font-medium tabular-nums',
                  p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {p.pnl >= 0 ? '+' : '−'}${Math.abs(p.pnl).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                </span>
              </span>
              <span className="text-[10px] tabular-nums text-zinc-600">
                entry {p.entry}
                {p.likuidasi > 0 && <span className="text-amber-400/70"> · likuidasi {p.likuidasi}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function ambilSimbol(cari: URLSearchParams): string {
  return cari.get('simbol') || cari.get('symbol') || '';
}

/* Identitasnya harus TETAP. Array literal baru tiap render membuat ChartLilin
   membongkar-pasang seluruh price line-nya tiap kali — dan halaman ini render
   ulang tiap tick harga. */
const KOSONG_POSISI: PosisiChartMt5[] = [];

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
  const [simbol, setSimbol] = useState(() => rapikanSimbol(ambilSimbol(cari) || awal.simbol || 'BTCUSDT'));
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
    const s = ambilSimbol(cari) || null;
    if (s) setSimbol(rapikanSimbol(s));
    const x = (cari.get('tf') || '').toLowerCase();
    if (x && TF.some((y) => y.nilai === x)) setTf(x);
  }, [cari]);

  /* ── ALAMAT IKUT SIMBOL, BUKAN CUMA SEBALIKNYA ─────────────────────
     Dilaporkan pemilik: mengganti pasangan lalu me-refresh mengembalikan
     koin LAMA — koin yang tadi dibuka dari daftar chart pantauan.

     Sebabnya alirannya cuma satu arah. `?simbol=` dibaca ke dalam state,
     tapi tidak ada satu tempat pun yang menuliskannya kembali: kotak simbol
     mengubah state saja. Sesudah refresh, alamatlah yang menang — dan
     alamat itu masih menyimpan koin dari tautan yang dibuka setengah jam
     lalu. Kotak isian dan alamat menunjuk dua koin berbeda, dan yang
     dipercaya peramban justru yang tidak terlihat.

     `replace`, bukan `push`: mengetik simbol bukan perpindahan halaman, dan
     tombol Kembali yang harus ditekan enam kali karena orangnya mencoba
     enam koin adalah tombol Kembali yang rusak. */
  useEffect(() => {
    if ((ambilSimbol(cari) || '') === simbol) return;
    const q = new URLSearchParams(cari);
    q.set('simbol', simbol);
    navigasi({ search: '?' + q.toString() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simbol]);
  const [lilin, setLilin] = useState<Lilin>({ opens: [], highs: [], lows: [], closes: [], times: [] });
  /* Dibaca di dalam penarikan data untuk memutuskan apakah kegagalan layak
     jadi peringatan. Ref, bukan state: penarikannya berjalan di dalam efek
     yang sengaja TIDAK berdependensi pada lilin -- kalau iya, setiap data
     masuk akan membatalkan dan menjadwalkan ulang pollingnya sendiri. */
  const lilinRef = useRef(lilin);
  lilinRef.current = lilin;

  /* ── LILIN DIKOSONGKAN SAAT SIMBOL/TF BERGANTI ────────────────────────
     Ada aturan sengaja di jalur penarikan data: penarikan yang GAGAL tidak
     boleh menghapus chart yang sudah tergambar. Itu benar untuk kedipan
     koneksi pada simbol yang sama — memasang peringatan merah di atas chart
     yang baik-baik saja memberitahu orangnya ada yang rusak padahal tidak.

     Tapi aturan itu tidak membedakan "gagal menarik simbol yang SAMA" dari
     "simbol BARU yang memang tidak punya data". Akibatnya: mengetik simbol
     yang tidak ada — mis. EURUSD tanpa awalan MT5: — meninggalkan lilin
     simbol sebelumnya di layar sementara seluruh label berganti. Chart
     menampilkan harga EMAS 4677 dengan tulisan besar "EURUSD, 1H", dan
     tidak ada satu pun tanda bahwa itu keliru.

     Ini kelas kesalahan yang paling berbahaya di aplikasi trading: bukan
     galat yang terlihat, melainkan angka yang salah yang terlihat benar.
     Orang bisa mengambil keputusan di atasnya.

     Dikosongkan DI SINI, sebelum penarikan pertama simbol barunya, jadi
     kegagalan pada simbol baru meninggalkan chart kosong beserta pesannya —
     sementara kegagalan pada simbol yang sama tetap tidak menghapus apa pun,
     persis seperti sebelumnya. */
  useEffect(() => {
    setLilin({ opens: [], highs: [], lows: [], closes: [], times: [] });
    lilinRef.current = { opens: [], highs: [], lows: [], closes: [], times: [] };
  }, [simbol, tf]);
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
  /* Pasangan pengganti yang MUNGKIN dimaksud, saat simbolnya tidak
     berdata. Kosong = tidak ada tebakan yang layak ditawarkan. */
  const [usulSimbol, setUsulSimbol] = useState<string[]>([]);
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
  const { pengguna, pemilik } = useAuth();
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

  /* ── URUNG (Ctrl+Z) ──────────────────────────────────────────────────
     Tumpukan potret `gambarAlat` SEBELUM tiap perubahan. Potret utuh, bukan
     daftar perintah yang bisa dibalik: jumlah gambarnya puluhan, satu potret
     cuma beberapa kilobita, dan perintah-yang-dibalik butuh pasangan balikan
     untuk tiap jenis perubahan -- termasuk yang belum ditulis nanti. Yang
     lupa dibuatkan pasangannya akan gagal diam-diam, dan urung yang salah
     lebih buruk daripada tidak ada urung.

     Di ref, bukan state: menekan Ctrl+Z tidak boleh menggambar ulang halaman
     hanya karena tumpukannya berubah, dan penangan papan tik di bawah butuh
     nilai terkini tanpa dipasang ulang tiap kali riwayatnya bertambah.

     `gambarRef` cermin state yang sudah dipasang. Potretnya diambil DI LUAR
     pembaru setState -- menyentuh ref di dalam pembaru berarti efek samping
     di jalur yang React boleh jalankan dua kali di mode ketat, dan
     tumpukannya akan berisi entri kembar. */
  const gambarRef = useRef(gambarAlat);
  gambarRef.current = gambarAlat;
  const riwayatGambar = useRef<{ tumpuk: GambarAlat[][]; tanda: string; waktu: number }>(
    { tumpuk: [], tanda: '', waktu: 0 });

  const catatRiwayat = useCallback((tanda = '') => {
    const r = riwayatGambar.current;
    const kini = Date.now();
    /* PEREDAM SERETAN. Menggeser gambar memanggil ubahGambar puluhan kali
       per detik dari penangan gerak mouse; tanpa ini satu seretan jadi
       puluhan langkah urung, dan Ctrl+Z cuma menggeser gambarnya balik
       beberapa piksel -- terbaca sebagai fitur yang rusak.

       Jendelanya dihitung dari panggilan TERAKHIR, bukan yang pertama, jadi
       seretan sepanjang apa pun tetap satu langkah selama jarinya tidak
       berhenti. Berhenti lebih dari sedetik memang layak jadi langkah baru:
       di situ orangnya sudah selesai dengan gerakan yang satu. */
    if (tanda && tanda === r.tanda && kini - r.waktu < 1000) { r.waktu = kini; return; }
    r.tumpuk.push(gambarRef.current);
    /* Dibatasi supaya tab yang dibuka seharian tidak menyimpan ribuan
       potret. Yang tertua dibuang -- urung sejauh 60 langkah sudah jauh
       melampaui yang pernah dipakai orang dalam satu sesi menggambar. */
    if (r.tumpuk.length > 60) r.tumpuk.shift();
    r.tanda = tanda; r.waktu = kini;
  }, []);

  useEffect(() => {
    setGambarAlat(bacaAlat(simbol));
    setAlat(null);
    /* Riwayat urung ikut dibuang. Gambar milik SIMBOL, jadi potret dari BTC
       yang dipulihkan di atas ETH akan menempelkan gambar yang tidak pernah
       ada di sana -- lalu menyimpannya ke kunci ETH.

       BERGANTUNG PADA SIMBOL SAJA. Berganti timeframe tidak lagi memuat
       ulang apa pun: gambarnya memang himpunan yang sama, dan membuang
       riwayat urung tiap kali orang menengok 4 jam lalu kembali ke Harian
       akan menghapus jejak yang justru paling ingin diurungkan. */
    riwayatGambar.current = { tumpuk: [], tanda: '', waktu: 0 };
  }, [simbol]);

  /* ── PANEL LAIN DI MULTI-CHART ──────────────────────────────────────
     Tiap panel iframe punya halaman Chart-nya sendiri, dan localStorage
     dibagi di antara mereka. Tanpa pendengar ini, garis yang ditarik di
     panel Harian tidak muncul di panel 4 jam sampai salah satunya dimuat
     ulang -- persis keluhan yang sedang diperbaiki, cuma berpindah dari
     antar-timeframe ke antar-panel.

     `storage` memang tidak berbunyi di tab yang menulisnya sendiri, dan itu
     yang membuatnya aman dipakai di sini: panel yang sedang digambari tidak
     akan menimpa dirinya di tengah seretan. */
  useEffect(() => {
    const kunci = kunciAlat(simbol);
    const dengar = (e: StorageEvent) => {
      if (e.key !== kunci) return;
      try {
        const d = JSON.parse(e.newValue ?? '[]');
        if (Array.isArray(d)) setGambarAlat(d as GambarAlat[]);
      } catch { /* tulisan setengah jadi -- dilewati, yang berikutnya utuh */ }
    };
    window.addEventListener('storage', dengar);
    return () => window.removeEventListener('storage', dengar);
  }, [simbol]);
  /* Hasil Pine dari simbol lama DIBUANG saat chart berganti — garis di
     level 64.000 milik BTC yang tergambar di chart ONE 0,0009 membuat
     skala harga meledak dan grafiknya "rusak". Skrip aktif dihitung ulang
     sendiri oleh dock begitu data simbol baru tiba. */
  useEffect(() => { setPine(null); }, [simbol, tf]);
  const tambahGambar = useCallback((g: Omit<GambarAlat, 'id'>) => {
    const id = 'g' + Date.now();
    catatRiwayat();
    setGambarAlat((d) => {
      const b = [...d, { ...g, id }];
      simpanAlat(simbol, b);
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
  }, [simbol]);
  /* Menggeser gambar / menarik ujungnya. Disimpan ke kunci simbol yang SAMA
     dengan penambahan — gambar yang dipindah lalu kembali ke tempat lama
     saat halaman dibuka ulang lebih menjengkelkan daripada gambar yang
     tidak bisa dipindah sama sekali. */
  const ubahGambar = useCallback((id: string, ubah: Partial<GambarAlat>) => {
    /* Bertanda id gambarnya: seretan panjang jadi SATU langkah urung, tapi
       menggeser gambar lain sesudahnya tetap langkah tersendiri. */
    catatRiwayat('ubah:' + id);
    setGambarAlat((d) => {
      const b = d.map((g) => (g.id === id ? { ...g, ...ubah } : g));
      simpanAlat(simbol, b);
      return b;
    });
  }, [simbol]);
  /* Gambar TERPILIH: klik gambarnya di mode kursor biasa, hapus dengan
     Delete/Backspace, batal pilih dengan Escape. */
  const [gambarPilih, setGambarPilih] = useState<string | null>(null);
  /* Ganti SIMBOL: yang terpilih sudah tidak ada di layar. Ganti timeframe
     tidak lagi membatalkan pilihan — gambarnya masih di sana, cuma dilihat
     dari jarak yang lain. */
  useEffect(() => { setGambarPilih(null); }, [simbol]);
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
        catatRiwayat();
        setGambarAlat((d) => {
          const b = d.filter((g) => g.id !== gambarPilih);
          simpanAlat(simbol, b);
          return b;
        });
        setGambarPilih(null);
      }
      if (e.key === 'Escape') setGambarPilih(null);
      /* Ctrl+Z (Cmd+Z di Mac). Ditaruh SESUDAH penjaga INPUT/TEXTAREA di
         atas: di dalam kolom teks, Ctrl+Z milik kolom itu, dan merebutnya
         akan mengurungkan gambar sementara orangnya sedang membetulkan
         ketikan di kolom simbol. */
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const r = riwayatGambar.current;
        const sebelum = r.tumpuk.pop();
        /* preventDefault HANYA kalau benar-benar ada yang diurungkan.
           Menahannya saat tumpukan kosong akan mematikan urung bawaan
           peramban di seluruh halaman tanpa memberi apa pun sebagai
           gantinya. */
        if (!sebelum) return;
        e.preventDefault();
        r.tanda = ''; r.waktu = 0;
        setGambarAlat(sebelum);
        simpanAlat(simbol, sebelum);
        /* Pilihan dilepas kalau gambarnya sudah tidak ada di potret yang
           dipulihkan -- pilihan yang menunjuk gambar yang tidak tergambar
           membuat tombol hapus menyala untuk sesuatu yang tak terlihat. */
        setGambarPilih((sekarang) => (sekarang && sebelum.some((g) => g.id === sekarang) ? sekarang : null));
      }
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [gambarPilih, simbol, tf, catatRiwayat]);
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
  /* ── TEPI KIRI CHART, BUKAN TEPI KIRI AREA ────────────────────────
     `areaChart` memuat panel kiri (daftar dompet/konsensus/acuan jiplak)
     DAN grafiknya. Semua hamparan dijangkarkan ke sana, jadi begitu panel
     kirinya terbuka, `left: 8` berhenti berarti "di tepi lilin" dan mulai
     berarti "di atas daftar" — bilah alat gambar duduk menimpa isi panel,
     yang justru terlihat seperti bilahnya yang salah tempat.

     Panelnya melaporkan berapa piksel yang ia makan; angka itu ditambahkan
     ke letak bilahnya dan dikurangkan dari jepitan seretannya. Letak yang
     TERSIMPAN tetap relatif terhadap chart, jadi menutup panel tidak
     memindahkan bilah yang sudah ditaruh orangnya. */
  const [sisaKiri, setSisaKiri] = useState(0);
  /* DUA panel kiri, dua pelapor. `PanelBelah` berdiri di LUAR ChartLilin
     (Screener, konsensus, wallet view); `panelKiri` berdiri di DALAM-nya
     (acuan jiplak, chart banding, dan panel Dompet). Keduanya bisa terbuka
     bersamaan, jadi yang dipakai menggeser bilah alat adalah JUMLAHNYA —
     memakai salah satu saja membuat bilahnya tetap tertimpa persis pada
     kombinasi yang paling sering dipakai. Panel Dompet tertimpa karena
     sumber kedua ini dulu tidak ada sama sekali. */
  const [sisaKiriDalam, setSisaKiriDalam] = useState(0);
  const kiriTotal = sisaKiri + sisaKiriDalam;
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
      lx: letakAlat ? letakAlat.x : (b0 ? kotakBilah.left - b0.left - kiriTotal : 8),
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
        x: Math.max(4, Math.min(b.width - kiriTotal - 36, x)),
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
    ? { left: letakAlat.x + kiriTotal, top: letakAlat.y,
        transform: geserAlat ? `translateY(${geserAlat}px)` : undefined }
    /* `left` inline juga untuk letak bawaannya — kelas `left-2` tidak bisa
       ikut bergeser saat panel kirinya membuka, dan bilah yang bawaannya
       menimpa daftar adalah cacat yang dilihat orang lebih dulu daripada
       bilah yang pernah dipindah. */
    : { left: kiriTotal + 8,
        transform: `translateY(calc(-50% + ${geserAlat}px))` };

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

  /* -- Melepas order yang sedang dilihat -----------------------------
     Kebalikan dari bukaSunting: chart kembali seperti sebelum barisnya
     diklik. Semua yang dipasang di sana dilepas di sini -- kalau tidak,
     order berikutnya yang dipilih akan mewarisi sisa yang lama: teks SL
     yang belum sempat dikirim, pesan galat dari order sebelumnya, atau
     tick simbol yang salah karena masih milik koin yang tadi.

     sidikBroker ikut dikosongkan supaya efek "ikut broker" memperlakukan
     pemilihan berikutnya sebagai perubahan pertama, bukan lanjutan. */
  function lepasSunting() {
    setSunting(null);
    setPanelUbah(false);
    setSuntingSlTeks('');
    setSuntingTpTeks('');
    setSuntingKabar('');
    setTickAktif(0);
    sidikBroker.current = '';
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
    /* Sidik awal dipasang di sini juga. Tanpa ini efek "ikut broker" di
       bawah melihat nilai broker sebagai perubahan pertama dan langsung
       menyetel ulang isian yang baru saja diisi baris-baris di bawah. */
    sidikBroker.current = `${o.tiket ?? o.simbol}|${o.sl}|${o.tp}`;
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

  /* Dua penjaga gabungan di bawah ini SENGAJA ADA meskipun panelnya sudah
     tidak menggambar tombol Kirim maupun Tutup untuk baris gabungan.

     Bukan kehati-hatian berlebihan: akhiriOrder() juga dipanggil dari
     tutupDariTabel() dengan objek yang dioper langsung, tanpa lewat panel
     sama sekali. Penjaga yang cuma hidup di lapisan tampilan akan bocor
     begitu pemanggil kedua muncul -- dan yang bocor di sini adalah perintah
     UBAH bertiket kosong, atau TUTUP seukuran gabungan yang menutup sesuatu
     yang bukan satu posisi. */
  async function kirimSunting() {
    if (!sunting) return;
    if (sunting.gabungan) {
      setSuntingKabar('Ini gabungan ' + sunting.gabungan + ' order. Lepas gabungannya di tabel, lalu pilih ordernya satu per satu.');
      return;
    }
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
    /* Ditulis di sini, dibaca sesudah `finally` — lihat catatannya di
       ujung fungsi ini. */
    let tuntas = false;
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
        if (hasil.status === 'sukses') tuntas = true;
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

        /* ── HYPERLIQUID SUDAH MENGGANTINYA SEKALIGUS ────────────────────
           Dua bursa, dua cara mengganti stop, dan bedanya menentukan:

             Binance      pasang yang baru, lalu batalkan yang lama satu per
                          satu dari sini (order lama tidak hilang sendiri).
             Hyperliquid  `pasangSltpHl` MENCABUT semua trigger koin itu
                          lebih dulu, baru memasang yang baru — satu tarikan
                          napas di server.

           Jadi untuk Hyperliquid, oid lama sudah tidak ada saat baris di
           bawah menjangkaunya. Pembatalannya melempar "tidak ketemu", itu
           dihitung gagal, dan layar melaporkan "order lama gagal dibatalkan,
           batalkan manual di Binance" untuk order yang justru sudah rapi
           tercabut — di bursa yang bahkan bukan Binance.

           Dilaporkan pemilik 2 Sep 2026 saat menggeser SL CASHCAT. Diperiksa
           langsung ke Hyperliquid: stop barunya terpasang, yang lama memang
           sudah tidak ada. Peringatannya yang keliru, bukan ordernya.

           Peringatan palsu tentang uang lebih berbahaya daripada diam: ia
           mengirim orang membuka aplikasi bursa untuk membereskan sesuatu
           yang tidak perlu dibereskan, dan pelan-pelan mengajarinya
           mengabaikan peringatan yang sama saat suatu hari benar. */
        const borongan = bacaPasar(sunting.simbol) === 'hyperliquid';
        const sisa: string[] = [];
        if (!borongan) {
          for (const o of stopLama) {
            try { await batalPendingNyata({ symbol: sunting.simbol, orderId: o.id, isAlgo: true }); }
            catch { sisa.push(`${o.jenis} ${o.pemicu}`); }
          }
        }
        /* Sisa yang gagal dibatalkan DIKATAKAN, tidak ditelan. Stop yatim
           yang tertinggal akan menembak posisi berikutnya, dan pemiliknya
           harus tahu sekarang — bukan saat itu terjadi. */
        if (sisa.length) {
          /* Sisa yang gagal dibatalkan DIKATAKAN, tidak ditelan — dan
             tidak perlu menunggu konfirmasi, karena keadaannya sudah
             jelas keliru. */
          segarkanBursa();
          setSuntingKabar(`SL/TP baru terpasang, tapi ${sisa.length} order lama gagal dibatalkan (${sisa.join(', ')}). Batalkan manual di ${borongan ? 'Hyperliquid' : 'Binance'}.`);
        } else {
          setSuntingKabar('Terkirim — menunggu bursa mencatatnya…');
          const tercatat = await tungguStopBursa(sunting.simbol, slBaru, tpBaru);
          segarkanBursa();
          setSuntingKabar(tercatat
            ? 'Berhasil — bursa sudah mencatat SL/TP barunya.'
            : 'Sudah dikirim dan diterima bursa, tapi daftar ordernya belum berubah. JANGAN kirim ulang — tiap kiriman memasang stop baru. Tunggu sebentar lalu periksa Posisi Terbuka.');
          if (tercatat) tuntas = true;
        }
      }
    } catch (e) {
      setSuntingKabar(e instanceof Error ? e.message : 'Gagal mengirim perubahan');
    } finally { setSuntingSibuk(false); }

    /* ── PANELNYA MENUTUP SENDIRI, TAPI HANYA KALAU BERHASIL ────────────
       Diminta pemilik 3 Sep 2026: sesudah Kirim, panelnya tidak perlu
       tinggal di layar.

       Yang TIDAK ikut ditutup: kegagalan, dan dua keadaan setengah jadi —
       stop lama yang gagal dibatalkan, dan bursa yang belum mencatat
       perubahannya. Ketiganya punya kalimat yang harus dibaca, dan
       `suntingKabar` cuma tergambar DI DALAM panel ini: menutupnya berarti
       membuang satu-satunya tempat kalimat itu muncul. Yang paling mahal di
       antaranya kalimat "JANGAN kirim ulang" — menghilangkannya justru
       mengundang perbuatan yang ia larang.

       `setPanelUbah(false)` langsung, BUKAN `tutupPanelUbah()`: yang kedua
       mengembalikan isian ke nilai broker yang lama, dan itu perilaku
       "batal" — kebalikan dari yang baru saja berhasil dikirim. */
    if (tuntas) { setPanelUbah(false); setSuntingKabar(''); }
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
    /* Gabungan tidak punya P/L tunggal yang bisa dicari. Pencarian di
       bawah mengambil SATU posisi menurut simbol -- untuk tumpukan 19
       order ia akan memulangkan P/L salah satunya saja lalu memasangnya
       sebagai P/L seluruh tumpukan. Angka gabungannya sudah benar di
       kolom P/L tabel; di sini lebih baik tidak ada angka daripada angka
       yang salah sembilan belas kali lipat. */
    if (!sunting || sunting.jenis !== 'posisi' || sunting.gabungan) return null;
    if (sunting.pasar === 'mt5') {
      const p = akunMt5.posisi.find((x) => x.tiket === sunting.tiket);
      return p ? p.profit : null;
    }
    const p = posisiBursa.find((x) => x.simbol === sunting.simbol);
    return p ? p.pnl : null;
  }, [sunting, akunMt5.posisi, posisiBursa]);

  /* ── ORDER YANG DISUNTING MENGIKUTI BROKER ──────────────────────────
     Dua keluhan yang ternyata satu sebab: `sunting` tidak pernah menengok
     lagi ke broker setelah dipilih.

     (a) Tutup posisi di MT5 -> garisnya tetap di chart sampai halaman
         dimuat ulang. Garis posisi (`posisiMt5`) memang ikut hilang, tapi
         `sunting` masih memegang order itu dan `garisSeret` terus
         menggambar entry/SL/TP-nya. Order yang sudah tidak ada tapi masih
         bergaris terbaca sebagai posisi yang masih hidup -- kesalahan
         paling mahal yang bisa dilakukan chart ini.

     (b) Geser SL lalu Kirim -> garisnya jadi DUA. Yang satu garis posisi
         di nilai broker yang belum berubah, yang satu garis seret di nilai
         baru. Keduanya sah pada saat itu, tapi begitu broker menjawab,
         tidak ada yang menarik isian panel ke nilai yang sudah terpasang,
         jadi keduanya tinggal berdampingan.

     Diselesaikan sekaligus: kalau ordernya lenyap, sunting dilepas; kalau
     nilai brokernya BERGERAK, isian panel ikut disetel ke nilai itu, dan
     garis seretnya jatuh tepat di atas garis posisi -- kembali jadi satu.

     Disetel HANYA saat nilai brokernya berubah, bukan tiap laporan EA.
     EA melapor tiap beberapa detik dengan angka yang sama; menyetel ulang
     tiap laporan akan menghapus angka yang sedang diketik atau digeser
     orangnya sebelum sempat ditekan Kirim. */
  const sidikBroker = useRef('');
  useEffect(() => {
    const o = sunting;
    /* Sedang mengirim: jangan disentuh. Di tengah pengiriman nilai broker
       memang masih yang lama, dan menariknya balik ke situ persis
       membatalkan apa yang sedang dikirim di depan mata orangnya. */
    if (!o || suntingSibuk) return;
    /* Baris gabungan tidak menunjuk satu order pun -- tidak ada yang bisa
       dicari maupun disamakan. */
    if (o.gabungan) { sidikBroker.current = ''; return; }

    let kini: { sl: number; tp: number } | null = null;
    if (o.pasar === 'mt5') {
      const p = akunMt5.posisi.find((x) => x.tiket === o.tiket);
      const t = akunMt5.pending.find((x) => x.tiket === o.tiket);
      const sumber = p ?? t ?? null;
      if (sumber) kini = { sl: sumber.sl, tp: sumber.tp };
    } else if (o.jenis === 'pending') {
      /* Pending kripto dikenali dari id-nya; SL/TP tidak dilaporkan di
         daftar order, jadi yang diperiksa cuma masih-ada atau tidak. */
      if (orderBursa.some((x) => x.id === (o.tiket ?? ''))) return;
    } else if (posisiBursa.some((x) => x.simbol === o.simbol)) {
      return;
    }

    if (!kini) {
      /* HILANG DARI BROKER. Ditutup dari MT5, kena SL/TP, atau dibatalkan
         dari mana pun -- semuanya berakhir sama: tidak ada lagi yang boleh
         digambar maupun dikirimi perubahan. */
      sidikBroker.current = '';
      setSunting(null);
      setPanelUbah(false);
      setSuntingSlTeks('');
      setSuntingTpTeks('');
      setSuntingKabar('');
      return;
    }

    const sidik = `${o.tiket ?? o.simbol}|${kini.sl}|${kini.tp}`;
    if (sidik === sidikBroker.current) return;
    sidikBroker.current = sidik;
    setSuntingSlTeks(kini.sl ? String(kini.sl) : '');
    setSuntingTpTeks(kini.tp ? String(kini.tp) : '');
  }, [sunting, suntingSibuk, akunMt5.posisi, akunMt5.pending, posisiBursa, orderBursa]);

  /* Menutup order yang DIPILIH DARI TABEL, tanpa harus masuk mode sunting
     dulu. Fitur tutupnya sebenarnya sudah ada sejak lama, tapi tersembunyi
     di balik dua langkah — klik baris, lalu klik garis di chart — dan
     pemilik sendiri menyimpulkan Trade-Fi "belum punya fitur tutup".
     Fitur yang ada tapi tidak ditemukan sama saja dengan tidak ada.

     Order-nya dibuka di chart lebih dulu supaya orangnya MELIHAT apa yang
     akan ditutup — konfirmasi berisi nama dan P/L tetap muncul sesudahnya. */
  /* Pensil di tabel: buka ordernya DAN panel ubahnya sekaligus.
     Berbeda dari klik baris, yang sengaja berhenti di garisnya saja —
     lihat catatan di prop `onUbah` milik TabelPosisi. */
  /* ── PERBANDINGAN SALINAN: BELAHAN KIRI AREA CHART ──────────────────
     Diminta pemilik 3 Sep 2026 — sebelumnya popup dua kolom angka. Popup
     itu menjawab "berapa" tapi tidak "di mana": entry yang meleset 2,5%
     terbaca sebagai satu baris teks, padahal yang ingin dilihat orang
     adalah seberapa jauh garisnya dari garisnya sendiri di lilin yang sama.

     Simbolnya DIPINDAH lebih dulu. Chart pembanding memakai lilin yang sama
     dengan chart utama — kalau simbolnya tidak ikut pindah, panel kiri akan
     menggambar garis entry ZEC di atas lilin BTC, dan itu bukan kurang
     tepat melainkan salah. */
  const [bandingSalin, setBandingSalin] = useState<BandingSalinan | null>(null);

  /* ── PANEL DOMPET DI SISI CHART ──────────────────────────────────────
     Bentuk B dari dua pilihan yang ditimbang bersama pemilik 3 Sep 2026.
     Yang TIDAK dipilih: menjalin "mode dompet" ke seluruh Chart & Entry —
     itu menyentuh tujuh titik pengirim order di dua berkas plus dua berkas
     pembaca posisi, semuanya di jalur uang yang sekarang sudah jalan.

     Yang dipilih: chartnya dari sini, panel ordernya dari `/dex` yang sudah
     jadi dan sudah teruji. NOL cabang baru di jalur uang lama — panel itu
     memang tidak pernah lewat sini; ia bicara langsung ke Hyperliquid dari
     peramban.

     Konsekuensi yang diterima dengan sadar: seret SL/TP di chart TIDAK
     berlaku untuk posisi dompet. Garis-garis itu milik jalur backend, dan
     membuatnya melayani dua tuan adalah persis percabangan yang sedang
     dihindari. */
  const [dexBuka, setDexBuka] = useState(false);

  /* Satu slot kiri, dua penghuni. Yang terakhir dibuka menang, dan yang
     kalah DITUTUP — bukan diantre: panel yang tiba-tiba muncul kembali saat
     yang lain ditutup adalah panel yang tidak diminta siapa pun. */
  function bukaDex(v: boolean) { setDexBuka(v); if (v) setBandingSalin(null); }

  function bukaBandingSalin(b: BandingSalinan) {
    setSimbol(rapikanSimbol(b.simbol));
    setBandingSalin(b);
    setDexBuka(false);
  }

  /* Panel ikut tertutup saat simbolnya berpindah ke pasangan lain — dengan
     alasan yang sama: perbandingan yang lilinnya sudah bukan miliknya lebih
     buruk daripada tidak ada perbandingan. */
  useEffect(() => {
    if (bandingSalin && rapikanSimbol(bandingSalin.simbol) !== simbol) setBandingSalin(null);
  }, [simbol, bandingSalin]);

  function ubahDariTabel(o: OrderSunting) {
    bukaSunting(o);
    setPanelUbah(true);
  }

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
    if (sunting.gabungan) {
      /* alert, bukan diam. Kalau perintah ini pernah sampai ke sini, yang
         menekannya sedang mengira ia menutup sebuah posisi -- dan tidak
         terjadi apa-apa tanpa penjelasan terbaca sebagai tombol rusak,
         lalu ditekan lagi. */
      alert('Ini gabungan ' + sunting.gabungan + ' order.\n\nLepas gabungannya di tabel lalu tutup satu per satu \u2014 satu klik yang menutup ' + sunting.gabungan + ' posisi sekaligus tidak bisa dibatalkan.');
      return;
    }
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
        /* Alasan yang sama dengan jalur ubah SL/TP: `tutupHl` mencabut
           sendiri stop yang tersisa begitu posisinya tertutup PENUH, jadi
           membatalkannya lagi dari sini cuma menghasilkan galat palsu. */
        const boronganTutup = bacaPasar(sunting.simbol) === 'hyperliquid';
        const sisaTutup: string[] = [];
        if (!boronganTutup) {
          for (const o of milik.filter((x) => x.jenis === 'SL' || x.jenis === 'TP')) {
            try { await batalPendingNyata({ symbol: sunting.simbol, orderId: o.id, isAlgo: true }); }
            catch { sisaTutup.push(`${o.jenis} ${o.pemicu}`); }
          }
        }
        setSuntingKabar(sisaTutup.length
          ? `Posisi ditutup, tapi ${sisaTutup.length} stop lama gagal dibatalkan (${sisaTutup.join(', ')}). Batalkan manual di ${bacaPasar(sunting.simbol) === 'hyperliquid' ? 'Hyperliquid' : 'Binance'}.`
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
  /* Identitas sinyal yang membuka halaman ini lewat "Buka di Chart" pada
     kartu sinyal. Tiga hal bergantung padanya: tombol Batal yang pulang ke
     halaman sinyalnya, ikon copy di tiket, dan panel perhitungan lotnya.
     Kosong = jalur biasa, ketiganya tidak muncul. */
  const sinyalAsal = cari.get('sinyal');
  const kanalAsal = cari.get('kanal');
  const analisAsal = cari.get('analis') || '';
  const [copySinyalBuka, setCopySinyalBuka] = useState(false);
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
    /* ── ALAMAT PULANG IKUT DIBAWA ────────────────────────────────────
       Formulir posting adalah SINGGAHAN, bukan tujuan. Yang membukanya
       datang dari chart dengan tiket order di layar, dan sebagian akan
       membatalkannya di tengah jalan — SL-nya belum pas, harganya sudah
       lari. Menutup formulir lalu mendarat di daftar sinyal orang lain
       berarti chart yang tadi ditinggalkan harus dicari sendiri, lengkap
       dengan simbol dan timeframe-nya.

       Alamatnya diambil dari halaman yang SEDANG dibuka, bukan dirakit
       dari `simbol` dan `tf`. Merakitnya sendiri berarti menebak ulang
       apa yang sudah diketahui persis — dan tebakan itu akan meleset
       untuk setiap parameter yang ditambahkan nanti (jiplak, konsensus,
       walletview) tanpa ada yang ingat memperbaruinya di sini. */
    const pulang = encodeURIComponent(window.location.pathname + window.location.search);
    const tujuan = '/copy-signal?sub=posting&dari=' + pulang;

    if (POLOS) {
      kirimBus({ jenis: 'navigasi', ke: tujuan });
      setKabarKirimSinyal('Draf terkirim — formulir posting terbuka di jendela tools.');
      return;
    }
    navigasi(tujuan);
  }
  /* Setelan order sungguhan — hidup di halaman supaya label risiko di
     garis chart dihitung dari angka yang SAMA dengan yang akan dikirim. */
  const [nyataSetelan, setNyataSetelan] = useState<{ modal: number; leverage: number; metode: MetodeTp }>(
    /* metode 'tp1only', bukan 'partial': bawaan tidak boleh menambahkan
       aturan yang tidak diminta. Lihat catatan panjang di METODE_TP. */
    { modal: 100, leverage: 4, metode: 'tp1only' });
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
  /* Daftar simbol HIDUP — ikut berubah saat koin ditambah dari sini, dari
     Screener, atau dari tab lain. Menggantikan konstanta `SIMBOL_DASAR`
     yang dibekukan saat modul dimuat. */
  const { aktif: simbolAktif } = useSimbol();

  /* ── KOIN YANG DICARI SENDIRI IKUT TERCATAT ─────────────────────────
     Dilaporkan pemilik: mengetik USELESSUSDT memunculkan chartnya, tapi
     namanya tidak pernah ada di kotak cari sesudah itu. Ia harus diketik
     ulang huruf per huruf tiap kali.

     Sebabnya dua, dan keduanya di berkas ini:
       · `tambahSimbol()` SUDAH ada di lib/simbol.ts dan bekerja, tapi cuma
         dipanggil dari halaman Screener React. Chart & Entry tidak pernah
         memanggilnya.
       · Kotak carinya membaca `SIMBOL_DASAR` -- larik tulis tangan yang
         dibekukan saat modul dimuat -- jadi mencatat pun percuma; daftar
         yang dibaca bukan daftar yang ditulis.

     DICATAT SESUDAH LILINNYA DATANG, bukan saat diketik. Salah ketik yang
     langsung tercatat akan menempel di daftar selamanya sebagai simbol yang
     tidak pernah bisa dimuat, dan tidak ada di layar ini yang menjelaskan
     dari mana ia datang.

     Dijaga `Set`: pengambilan lilin berulang tiap 3 detik, dan menulis ke
     localStorage tiga kali per detik untuk simbol yang sama adalah kerja
     yang seluruhnya dibuang. Yang sudah ada di daftar juga ditandai --
     supaya tidak ada satu pun penulisan untuk koin yang memang sudah
     tercatat sejak awal. */
  const simbolTercatat = useRef<Set<string>>(new Set());
  const catatSimbol = useCallback((s: string) => {
    /* MT5 punya sumber daftarnya sendiri (dilaporkan EA), dan menaruh nama
       broker di daftar kripto membuatnya muncul di kotak cari sebagai
       pasangan Binance yang tidak pernah ada. */
    if (!s || s.startsWith('MT5:')) return;
    if (simbolTercatat.current.has(s)) return;
    simbolTercatat.current.add(s);
    if (bacaAktif().includes(s)) return;
    tambahSimbol(s);
  }, []);

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

  /* ── SL & TP DALAM DOLAR, DI SEBELAH ANGKANYA ────────────────────────
     Diminta pemilik 3 Sep 2026. Harga saja menuntut orangnya menghitung
     sendiri berapa uang yang dipertaruhkan tiap kali garisnya digeser —
     dan itu perhitungan yang tidak pernah benar-benar dilakukan di tengah
     seretan.

     Rumusnya berbeda per pasar dan tidak bisa disatukan:
       kripto    jumlah koin x jarak harga
       Trade-Fi  lot x dolar per lot per 1,0 harga (dilaporkan EA)
     Menyamakan keduanya berarti salah satunya meleset 100x lipat.

     BERTANDA, bukan nilai mutlak. SL yang digeser MELEWATI entry (BUY: ke
     atas) mengunci UNTUNG, bukan kerugian — menuliskannya sebagai angka
     merah membuat orang mengira ia sedang memperbesar risiko justru pada
     saat ia menghapusnya. Rumus yang sama dipakai SL dan TP; yang
     membedakan hasilnya cuma di sisi mana harganya duduk. */
  const unitSunting = useMemo(() => {
    if (!sunting || sunting.gabungan) return 0;
    return sunting.pasar === 'mt5' ? sunting.ukuran * nilaiLotMt5 : sunting.ukuran;
  }, [sunting, nilaiLotMt5]);

  /** null = tidak bisa dihitung. Ditulis apa adanya sebagai tanda hubung —
   *  nol di tempat ini terbaca "tidak ada risiko", yang justru kebalikan
   *  dari "tidak diketahui". */
  function uangDiHarga(h: number): number | null {
    if (!sunting || !(h > 0) || !(sunting.entry > 0) || !(unitSunting > 0)) return null;
    return (h - sunting.entry) * unitSunting * (sunting.arah === 'BUY' ? 1 : -1);
  }
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
    /* -- Yang SEDANG DIPILIH digambar sekali saja --------------------
       Mengklik baris Trade-Fi memasang entry/SL/TP-nya sebagai garis
       seret (garisSeret), sementara posisi yang sama juga digambar di
       sini sebagai garis posisi broker. Levelnya identik, jadi hasilnya
       dua garis bertumpuk di piksel yang sama dengan dua label berebut
       tempat di sumbu kanan -- dan yang di bawah tidak pernah terbaca.

       Yang dilepas garis brokernya, bukan garis seretnya: yang dipilih
       orangnya adalah order ITU, dan garis seret yang bisa ditarik
       adalah kendalinya. Begitu pilihannya dilepas -- klik di kanvas
       kosong -- garis broker kembali apa adanya. */
    const disunting = sunting?.pasar === 'mt5' ? sunting.tiket : undefined;
    return JSON.stringify(akunMt5.posisi
      .filter((p) => p.simbol.toUpperCase().indexOf(dasarS) === 0 && p.tiket !== disunting)
      .map((p) => ({ tiket: p.tiket, arah: p.arah, lot: p.lot, entry: p.hargaBuka, sl: p.sl, tp: p.tp })));
  }, [simbol, akunMt5.posisi, aksi?.mode, sunting]);
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
      /* LAPORAN BARU DIMINTA, BUKAN DITUNGGU.
         ──────────────────────────────────────────────────────────────
         Daftar posisi dipoll tiap 30 detik (JEDA_MS di lib/akun). Tanpa
         permintaan ini, sesudah SL berhasil dipindahkan chart masih
         menggambar nilai LAMA sampai setengah menit berikutnya — dan
         pratinjau seretan bertahan selama itu juga, karena satu-satunya
         tanda "sudah terpasang" adalah laporan yang belum datang.

         Diminta juga saat GAGAL: yang perlu dipastikan bukan cuma
         perubahannya masuk, tapi juga bahwa yang tergambar setelahnya
         adalah keadaan broker sesungguhnya. */
      segarkanAkunMt5();
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
  /* ── LEVEL YANG BUKAN MILIK SIMBOL INI DIBUANG DARI DATANYA ──────────
     Menyaringnya saat MENGGAMBAR saja tidak cukup, dan itu terbukti waktu
     diuji: dengan alamat ?simbol=BTCUSDT&entry=4632&sl=4637&tp=4626, garis
     di chart memang tidak muncul — tapi panel tiketnya tetap terbuka
     berisi 4632,3 / 4637,8 / 4626,7 di atas chart Bitcoin. Itu justru
     bahaya yang sesungguhnya: satu tekan Kirim di panel itu menghitung
     ukuran dari level pasar yang sama sekali berbeda.

     Jadi rencananya dibuang dari STATE, bukan cuma disembunyikan dari
     layar. Menyembunyikan sesuatu yang masih bisa ditekan bukan penjagaan.

     Kenapa efek terpisah, bukan disaring saat rencananya dipasang: waktu
     alamat dibaca, lilinnya belum datang — tidak ada harga pembanding sama
     sekali. Efek ini menunggu sampai ada lilin, baru menilai.

     Ambang 10x sengaja longgar; rencana trade tidak pernah berjarak
     sepuluh kali lipat dari harga berjalan untuk instrumen yang sama. */
  useEffect(() => {
    const acuan = lilin.closes[lilin.closes.length - 1];
    if (!acuan) return;
    const nyasar = (x?: number) => !!x && (x / acuan > 10 || x / acuan < 0.1);
    if (!nyasar(rencana.entry) && !nyasar(rencana.sl) && !nyasar(rencana.tp)) return;
    setRencana({});
    setDraf(null);
    setDariSinyal(false);
    entryDigeser.current = false;
  }, [simbol, lilin.closes, rencana.entry, rencana.sl, rencana.tp]);

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
    const simbolAlamat = rapikanSimbol(ambilSimbol(cari));
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
  /* ── SERETAN YANG DITINGGALKAN, DIKEMBALIKAN ─────────────────────────
     Nilai garis SEBELUM seretan pertama disimpan di sini. Kalau orangnya
     menyeret lalu tidak berbuat apa-apa — tidak Kirim, tidak Batal — dan
     mengeklik kanvas kosong atau menekan Esc, garisnya kembali ke angka
     ini. Tanpa jalan pulang itu, salah seret hanya bisa ditebus dengan
     memuat ulang halaman — dan yang paling sering salah seret justru
     garis rencana orang lain yang datang dari kartu sinyal.

     Snapshot dibuang (tanpa dikembalikan) begitu ada TINDAKAN: Kirim,
     Batal, mengetik angka sendiri, atau konteksnya berganti. Tindakan
     berarti angkanya sudah jadi keputusan, bukan lagi seretan nyasar. */
  const kembalikanSeret = useRef<() => void>(() => {});
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') kembalikanSeret.current(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const seretAsal = useRef<
    | { jenis: 'rencana'; nilai: { entry?: number; sl?: number; tp?: number } }
    | { jenis: 'sunting'; sl: number; tp: number }
    | null
  >(null);
  /* Esc memakai pengembali yang SAMA dengan klik kanvas kosong — dua
     pintu, satu perilaku. Diisi ulang TIAP RENDER supaya closure-nya
     selalu memegang setter dan snapshot terbaru. */
  kembalikanSeret.current = () => {
    const a = seretAsal.current;
    if (!a) return;
    seretAsal.current = null;
    if (a.jenis === 'sunting') { setSuntingSl(a.sl); setSuntingTp(a.tp); }
    else setRencana(a.nilai);
  };
  /* ── ENTRY MENYUSUL HARGA SELAMA BELUM DISERET ──────────────────────
     Dulu hanya bergerak saat LILIN BARU lahir — di TF 4 jam itu berarti
     garisnya bisa tertinggal berjam-jam di belakang harga, dan tiket yang
     dimaksudkan "masuk sekarang" berangkat sebagai limit tanpa ada yang
     memilihnya. Sekarang harga hidup yang jadi acuan; jumlah lilin tetap
     jadi dep supaya pergantian simbol tetap menyegarkannya.

     PENJEPIT 0,05% adalah pengeremnya: selama garisnya masih di dalam pita
     yang dianggap Market, objek yang sama dipulangkan dan React tidak
     menggambar ulang apa pun. Tanpa itu, tiap denyut harga menggambar ulang
     seluruh chart. Ia pindah hanya saat pindahnya berarti. */
  useEffect(() => {
    if (entryDigeser.current || aksiPosisi || seretTangan.current) return;
    const h = aksi?.hargaKini || lilin.closes[lilin.closes.length - 1];
    if (!h) return;
    setRencana((r) => {
      if (!r.sl && !r.tp) return r;
      if (r.entry && Math.abs(r.entry - h) / h < 0.0005) return r;
      const geser = r.entry ? h - r.entry : 0;
      if (!geser) return { ...r, entry: h };
      return {
        entry: h,
        sl: r.sl ? r.sl + geser : r.sl,
        tp: r.tp ? r.tp + geser : r.tp,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lilin.closes.length, aksi?.hargaKini]);

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
  /* Ejaan terminalnya sendiri di sini juga, bukan cuma di baris bawah.
     Baris ATAS itu yang besar dan yang benar-benar dibaca; membetulkan baris
     bawah saja meninggalkan dua ejaan berbeda dalam satu tanda air, dan itu
     lebih membingungkan daripada satu ejaan yang salah. */
  const airOtomatis = (mt5 ? bacaNamaMt5(simbol.slice(4)) : simbol) + ', ' + tf.toUpperCase();
  const tandaAir = useMemo(() => {
    if (!tampilan.tandaAir) return undefined;
    /* Nama simbolnya sekarang HANYA di baris atas, lewat airOtomatis —
       lihat catatan di bawah soal kenapa baris bawah tidak mengulanginya. */
    const jenis = bacaPasar(simbol);
    const pasar = mt5 ? 'TRADE-FI'
      : jenis === 'futures' || jenis === 'hyperliquid' ? 'PERP'
      : jenis === 'spot' ? 'SPOT' : '';
    /* Teks sendiri hanya mengganti baris ATAS. Baris bawah tetap jenis
       pasarnya: itu keterangan yang tidak bisa diarang orangnya, dan justru
       paling berguna ketika baris atasnya sudah diganti jadi nama sendiri. */
    /* Nama BROKER, bukan sekadar "TRADE-FI". Sejak satu orang bisa memasang
       EA di beberapa broker sekaligus, "BTCUSD TRADE-FI" tidak lagi memberi
       tahu apa pun yang menentukan: Exness cent dan HFM standar punya
       BTCUSD yang sama namanya, harga yang mirip, dan nilai lot yang berbeda
       seratus kali. Grafik yang tidak menyebut brokernya membuat orang
       membaca chart satu akun sambil mengira sedang melihat yang lain.

       Hanya untuk Trade-Fi: chart kripto memang tidak punya broker, dan
       menambahkan baris kosong di sana cuma mengotori. */
    /* Baris bawah TIDAK mengulang nama simbolnya — baris atas sudah
       menulisnya besar-besar tepat di atasnya, dan mengulangnya dua kali
       hanya membuat tanda airnya lebih ramai tanpa menambah satu pun
       keterangan. Yang tersisa keterangan jenis pasarnya saja.

       Kecuali untuk feed acuan: di sana "ACUAN" tetap ditulis, karena itu
       peringatan — bukan label. Yang membaca grafik acuan sambil mengira itu
       brokernya sendiri harus punya lebih dari satu tempat untuk sadar. */
    /* Kripto menyebut BURSANYA juga, bukan cuma jenis kontraknya. Sekarang
       ada dua sumber data di aplikasi ini — Binance dan terminal MT5 — dan
       tanda air yang cuma menulis "PERP" menjawab setengah pertanyaan:
       kontraknya apa, tapi bukan datanya dari mana. Sisi Trade-Fi sudah
       menyebut sumbernya; sisi kripto jadi setara. */
    /* -- BURSANYA DIBACA, BUKAN DITULIS MATI --------------------------
       Dulu di sini `pasar + ' · Binance'` apa adanya. Itu benar selama
       kripto cuma punya satu sumber. Sejak proxy jatuh ke Hyperliquid untuk
       koin yang tidak terdaftar di Binance, tanda air yang tetap menulis
       "Binance" berbohong tentang satu-satunya hal yang tidak bisa
       diverifikasi pembacanya sendiri: dari mana lilin ini datang.

       Dan itu bukan kesalahan kosmetik. Harga koin yang sama bisa berbeda
       antar bursa, dan orang yang membaca chart Hyperliquid sambil mengira
       itu Binance akan menaruh level di angka yang tidak pernah tersentuh
       di tempat ia mengeksekusi. */
    const bursaKripto = jenis === 'hyperliquid' ? 'Hyperliquid' : 'Binance';
    const bawah = mt5
      ? (bacaAcuanMt5(simbol.slice(4)) ? 'ACUAN' : 'TRADE-FI')
      : (pasar ? pasar + ' · ' + bursaKripto : '');
    return {
      utama: tampilan.tandaAirTeks.trim() || airOtomatis,
      sub: bawah || undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simbol, tf, mt5, lilin, airOtomatis, tampilan.tandaAir, tampilan.tandaAirTeks,
      akunMt5.daftarAkun, akunMt5.loginAktif]);

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
            /* Permintaannya BERHASIL tapi kosong — itu lebih sering berarti
               simbolnya tidak ada daripada proxinya mati. Menyalahkan proxy
               untuk simbol yang salah ketik mengirim orangnya memeriksa
               server selama setengah jam. */
            setUsulSimbol(alternatifSimbol(simbol));
            setGalat(simbol.startsWith('MT5:')
              ? 'Belum ada data dari terminal MT5 untuk simbol ini — pastikan EA Trade-Fi Sync terpasang di chart pasangan itu; datanya masuk ± tiap 5 menit.'
              : `Tidak ada data untuk "${simbol}". Pasangan kripto Binance berakhiran USDT (mis. EURUSDT); untuk pasangan MetaTrader pakai awalan MT5: dan pastikan EA-nya terpasang.`);
          }
        }
        else { setLilin(l); setGalat(''); setUsulSimbol([]); catatSimbol(simbol); }
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
  }, [simbol, tf, segar, replayIdx !== null, catatSimbol]);

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
  /* ── ZONA ENTRY: DUA BATASNYA, BUKAN CUMA TITIK TENGAHNYA ───────────
     Sinyal sering menyebut zona ("4449-4456"), bukan satu harga. Tiket
     order memang cuma bisa memuat satu angka — satu order punya satu harga
     masuk — tapi CHART tidak punya batasan itu, dan yang dibuang saat cuma
     titik tengahnya digambar justru bagian yang menentukan: seberapa lebar
     ruang masuknya, dan apakah harga sekarang masih di dalamnya.

     Digambar tipis dan tanpa warna arah. Ia bukan level keputusan seperti
     SL dan TP; ia daerah. Memberinya warna dan ketebalan yang sama akan
     membuat lima garis berteriak sama keras, dan yang paling penting —
     SL — kehilangan tempatnya. */
  const garisZonaEntry = useMemo<GarisHarga[]>(() => {
    const z = (cari.get('zona') || '').split('-').map(Number).filter((x) => Number.isFinite(x) && x > 0);
    if (z.length !== 2) return [];
    const [a, b] = z[0] <= z[1] ? [z[0], z[1]] : [z[1], z[0]];
    /* Zona setipis nol bukan zona — itu satu harga yang kebetulan ditulis
       dua kali, dan dua garis bertumpuk di tempat yang sama cuma menebalkan
       garis entry tanpa memberi tahu apa pun. */
    if (a === b) return [];
    /* Label KOSONG, dan itu disengaja. `title` digambar sebagai kotak yang
       menjorok ke dalam kanvas, sementara harganya SUDAH tertulis di sumbu
       kanan oleh `axisLabelVisible`. Dua tempat untuk satu angka berarti
       satu di antaranya cuma menutupi lilin — dan yang menutupi lilin
       adalah yang di dalam kanvas.

       Pola yang sama dipakai zona SNR di bawah: cuma garis tengahnya yang
       diberi nama ("R"/"S"), batas-batasnya dibiarkan tanpa teks. */
    return [
      { harga: b, warna: 'rgba(255,255,255,.32)', label: '' },
      { harga: a, warna: 'rgba(255,255,255,.32)', label: '' },
    ];
  }, [cari]);

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
  /* ════════════════════════════════════════════════════════════════
     SATU GERBANG UNTUK SELURUH GARIS UANG SUNGGUHAN
     ════════════════════════════════════════════════════════════════
     Bug ini sudah kambuh berkali-kali: pindah ke DEMO atau COPY, tapi
     garis posisi/order NYATA masih tergambar. Tiap kali diperbaiki di
     tempat kejadiannya, dan tiap kali muncul lagi dari sumber garis yang
     lain.

     Sebabnya bukan salah satu gerbangnya — sebabnya JUMLAHNYA. Syarat
     `aksi?.mode === 'real'` disalin ke tiap sumber garis: posisi MT5,
     order menggantung, garis seret, garis Ask. Empat tempat berarti empat
     kesempatan untuk lupa, dan sumber garis KELIMA yang ditambahkan
     nanti akan lupa lagi — karena tidak ada yang memaksanya ingat.

     Gerbangnya sekarang di PINTU, bukan di tiap kamar: satu-satunya jalan
     garis nyata sampai ke ChartLilin adalah lewat prop-prop di bawah, dan
     semuanya dikosongkan sekaligus saat modenya bukan real. Gerbang di
     dalam tiap sumber DIBIARKAN — dua lapis tidak berbahaya. Tapi yang
     MENJAMIN sekarang cuma satu, dan ia mustahil dilewati sumber baru. */
  const modeNyata = aksi?.mode === 'real';

  /* Chart acuan yang dijiplak di belakang lilin. Di ingatan saja, tidak
     disimpan: ia alat bantu sesaat saat menyusun zona, bukan setelan
     tampilan. Yang tersimpan di localStorage akan menempel di layar orang
     berhari-hari kemudian tanpa ia ingat pernah memasangnya. */
  const [jiplak, setJiplak] = useState<AturJiplak | null>(null);

  /* ── DIBUKA DARI PANEL CHART PANTAUAN ────────────────────────────────
     `?jiplak=<id>` membawa satu chart arsip langsung terpasang. Tanpa ini
     pintu dari panelnya cuma mendaratkan orang di Chart & Entry kosong,
     lalu ia harus mencari sendiri chart yang BARUSAN ia klik — di daftar
     yang isinya belasan chart mirip.

     Sekali saja per id: `terpasang` menahan pemasangan ulang saat render
     berikutnya, dan tanpa itu setiap render menarik gambarnya lagi. */
  /* ── DAFTAR POSISI DOMPET ────────────────────────────────────────────
     Ditarik sekali per alamat, lalu disegarkan tiap menit — sama irama
     dengan pemantau di server, jadi angka mengambang di daftar ini tidak
     pernah lebih dari satu putaran tertinggal dari panelnya. */
  const dompetMinta = cari.get('dompet');
  /* `?konsensus=1` memakai penarikan yang SAMA — bedanya cuma apa yang
     disaring darinya. Menariknya dua kali untuk dua tampilan atas data yang
     identik berarti dua permintaan yang bisa berselisih isinya. */
  const konsensusMinta = cari.get('konsensus') === '1';
  const walletviewMinta = cari.get('walletview') === '1';

  /* -- DAFTAR SCREENER DI PANEL KIRI --------------------------------
     Dinyalakan dari Screener Area, dan yang tampil di panel kiri adalah
     HALAMAN SCREENER ITU SENDIRI -- seluruh sectionnya, bukan ringkasan
     per koin. Klik kartu di dalamnya memindah chart di sebelahnya tanpa
     halaman ini berpindah ke mana pun. */
  const screenerMinta = cari.get('screener') === '1';
  const [posisiDompet, setPosisiDompet] = useState<PosisiDompet[]>([]);
  const [semuaDompet, setSemuaDompet] = useState<KeadaanDompet | null>(null);
  useEffect(() => {
    if (!pemilik || (!dompetMinta && !konsensusMinta)) { setPosisiDompet([]); setSemuaDompet(null); return; }
    let hidup = true;
    const tarik = () => {
      void import('@/lib/wallet-agen').then(({ keadaanDompet }) => keadaanDompet()).then((d) => {
        if (!hidup || !d) return;
        setSemuaDompet(d);
        setPosisiDompet(dompetMinta ? d.posisi.filter((p) => p.alamat === dompetMinta) : []);
      });
    };
    tarik();
    const jam = setInterval(tarik, 60000);
    return () => { hidup = false; clearInterval(jam); };
  }, [pemilik, dompetMinta, konsensusMinta]);

  /* Dikelompokkan di sini, bukan di panelnya: hitungannya dipakai DUA kali —
     sekali untuk daftarnya, sekali untuk garis rata-rata entry di chart. */
  /* ── WALLET VIEW ──────────────────────────────────────────────────
     Sumbernya papan peringkat, bukan dompet pantauan — dua kumpulan yang
     berbeda, dan tidak boleh dicampur. Saringannya dibaca dari URL supaya
     daftar di sini persis sama dengan yang tadi dilihat di panelnya. */
  const [papan, setPapan] = useState<Peringkat | null>(null);
  useEffect(() => {
    if (!pemilik || !walletviewMinta) { setPapan(null); return; }
    let hidup = true;
    const j = (cari.get('j') || 'month') as JendelaPeringkat;
    const pt = (cari.get('pita') || 'kecil') as PitaAkun;
    void peringkatDompet(j, pt, 40).then((d) => { if (hidup && d) setPapan(d); });
    return () => { hidup = false; };
  }, [pemilik, walletviewMinta, cari]);

  const grupWalletView = useMemo(() => {
    if (!walletviewMinta || !papan) return [];
    type Sisi = { wr: number | null; nilai: number; entry: number }[];
    const peta = new Map<string, { koin: string; L: Sisi; S: Sisi }>();
    for (const b of papan.daftar) {
      if (!b.rinci) continue;
      /* Satu dompet satu suara per koin+arah — alasannya sama dengan di
         panelnya, dan disalin ke sini justru supaya keduanya tidak bisa
         berselisih hitungan. */
      const unik = new Set<string>();
      for (const q of b.rinci.posisi) {
        const k = String(q.koin).toUpperCase();
        const kk = k + '|' + q.arah;
        if (unik.has(kk)) continue;
        unik.add(kk);
        if (!peta.has(k)) peta.set(k, { koin: k, L: [], S: [] });
        (q.arah === 'L' ? peta.get(k)!.L : peta.get(k)!.S).push({
          wr: b.rinci.wr, nilai: Math.abs(q.nilai) || 0, entry: Number(q.entry) || 0,
        });
      }
    }
    const wrRata = (sisi: Sisi) => {
      const v = sisi.map((x) => x.wr).filter((x): x is number => x !== null);
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    };
    return [...peta.values()]
      .filter((g) => g.L.length + g.S.length >= 2)
      .map((g) => {
        const dominan = g.L.length >= g.S.length ? g.L : g.S;
        const e = dominan.map((x) => x.entry).filter((x) => x > 0);
        return {
          koin: g.koin, nL: g.L.length, nS: g.S.length,
          wrL: wrRata(g.L), wrS: wrRata(g.S),
          entry: e.length ? e.reduce((a, b) => a + b, 0) / e.length : 0,
          arahDominan: (g.L.length >= g.S.length ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
          nilai: [...g.L, ...g.S].reduce((a, x) => a + x.nilai, 0),
        };
      })
      .sort((a, b) => (b.nL + b.nS) - (a.nL + a.nS));
  }, [walletviewMinta, papan]);

  const grupKonsensus = useMemo(() => {
    if (!konsensusMinta || !semuaDompet) return [];
    const seumur = semuaDompet.seumur || {};
    const peta = new Map<string, { koin: string; L: PosisiDompet[]; S: PosisiDompet[] }>();
    for (const p of semuaDompet.posisi) {
      const k = p.koin.toUpperCase();
      if (!peta.has(k)) peta.set(k, { koin: k, L: [], S: [] });
      (p.arah === 'LONG' ? peta.get(k)!.L : peta.get(k)!.S).push(p);
    }
    const wrRata = (sisi: PosisiDompet[]) => {
      const v = sisi.map((p) => seumur[p.alamat]).filter((r) => r && r.tutup > 0)
        .map((r) => (r.menang / r.tutup) * 100);
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    };
    return [...peta.values()]
      .filter((g) => g.L.length + g.S.length >= 2)
      .map((g) => {
        const dominan = g.L.length >= g.S.length ? g.L : g.S;
        const e = dominan.map((p) => p.entry).filter((x) => x > 0);
        return {
          koin: g.koin, nL: g.L.length, nS: g.S.length,
          wrL: wrRata(g.L), wrS: wrRata(g.S),
          entry: e.length ? e.reduce((a, b) => a + b, 0) / e.length : 0,
          arahDominan: (g.L.length >= g.S.length ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
          nilai: [...g.L, ...g.S].reduce((a, p) => a + p.nilai, 0),
        };
      })
      .sort((a, b) => (b.nL + b.nS) - (a.nL + a.nS));
  }, [konsensusMinta, semuaDompet]);

  /* ── SATU DAFTAR, DUA SUMBER ───────────────────────────────────────
     Konsensus dompet dan Wallet View menjawab pertanyaan yang sama dengan
     kumpulan dompet yang berbeda. Dari sini ke bawah keduanya diperlakukan
     sebagai satu daftar — lompatan simbol, garis rata entry, dan panel
     kirinya tidak perlu tahu asalnya, dan tiap tempat yang harus tahu
     adalah satu tempat lagi yang bisa lupa diperbarui.

     Konsensus menang kalau keduanya diminta bersamaan: ia dari dompet yang
     Anda pilih sendiri, dan pilihan sendiri lebih spesifik daripada papan
     peringkat yang disusun bursa. */
  const grupKiri = grupKonsensus.length ? grupKonsensus : grupWalletView;

  /* Chart berpindah ke posisi PERTAMA begitu daftarnya tiba — sekali saja.
     Mendarat di BTCUSDT bawaan sementara daftar di sebelahnya berisi enam
     belas posisi lain berarti satu klik yang seharusnya tidak perlu, dan
     memaksanya tiap penyegaran akan menarik orang kembali ke baris pertama
     tiap menit sementara ia sedang membaca baris kesembilan. */
  /* Sama alasannya dengan mode dompet: mendarat di BTCUSDT bawaan sementara
     daftar di sebelahnya berisi enam koin lain berarti satu klik yang
     seharusnya tidak perlu. Sekali saja — memaksanya tiap penyegaran akan
     menarik orang kembali ke baris pertama tiap menit. */
  const konsensusDilompati = useRef(false);
  useEffect(() => {
    if ((!konsensusMinta && !walletviewMinta) || !grupKiri.length
        || konsensusDilompati.current) return;
    konsensusDilompati.current = true;
    if (ambilSimbol(cari)) return;
    setSimbol(rapikanSimbol(grupKiri[0].koin + 'USDT'));
  }, [konsensusMinta, walletviewMinta, grupKiri, cari]);

  const dompetDilompati = useRef<string | null>(null);
  useEffect(() => {
    if (!dompetMinta || !posisiDompet.length) return;
    if (dompetDilompati.current === dompetMinta) return;
    if (ambilSimbol(cari)) { dompetDilompati.current = dompetMinta; return; }
    dompetDilompati.current = dompetMinta;
    setSimbol(rapikanSimbol(posisiDompet[0].koin.toUpperCase().replace(/^@/, '') + 'USDT'));
  }, [dompetMinta, posisiDompet, cari]);

  /* ── GARIS OTOMATIS UNTUK POSISI YANG SEDANG DILIHAT ────────────────
     Diminta pemilik: mengklik koin harus langsung menggambar entry-nya.

     Yang digambar cuma yang BENAR-BENAR ada di data: harga masuk dan harga
     likuidasi. SL dan TP sengaja tidak — dompet-dompet ini diperiksa lewat
     frontendOpenOrders dan tidak satu pun memasang order pemicu. Menggambar
     garis SL yang tidak pernah dipasang pemiliknya berarti mengarang
     rencana orang lain, di layar yang dipakai meniru rencana itu.

     Likuidasi diberi warna amber, bukan merah: ia bukan stop yang dipilih,
     melainkan batas yang dipaksakan bursa. Dua hal yang sangat berbeda dan
     tidak boleh terbaca sama. */
  const garisDompet = useMemo<GarisHarga[]>(() => {
    if (!posisiDompet.length) return [];
    const p = posisiDompet.find(
      (x) => x.koin.toUpperCase().replace(/^@/, '') + 'USDT' === simbol.replace(/^MT5:/i, ''));
    if (!p) return [];
    const g: GarisHarga[] = [];
    if (p.entry > 0) {
      g.push({ harga: p.entry, warna: p.arah === 'LONG' ? 'rgba(52,211,153,.85)' : 'rgba(248,113,113,.85)',
        label: p.arah + ' ' + p.ukuran });
    }
    if (p.likuidasi > 0) g.push({ harga: p.likuidasi, warna: 'rgba(251,191,36,.75)', label: 'Likuidasi' });
    return g;
  }, [posisiDompet, simbol]);

  /* ── GARIS RATA-RATA ENTRY KONSENSUS ─────────────────────────────────
     Satu garis, dan ia yang paling berguna dari seluruh mode ini: harga
     yang dianggap layak oleh dompet-dompet yang sepakat. Jarak harga
     sekarang terhadapnya langsung menjawab apakah ikut masuk sekarang
     masih setara atau sudah terlambat — pertanyaan yang selama ini dijawab
     dengan mengingat angka dari halaman lain. */
  const garisKonsensus = useMemo<GarisHarga[]>(() => {
    if (!grupKiri.length) return [];
    const bersih = simbol.replace(/^MT5:/i, '').toUpperCase();
    const g = grupKiri.find((x) => x.koin + 'USDT' === bersih);
    if (!g || !g.entry) return [];
    return [{
      harga: g.entry,
      warna: g.arahDominan === 'LONG' ? 'rgba(52,211,153,.7)' : 'rgba(248,113,113,.7)',
      label: 'Rata ' + (g.arahDominan === 'LONG' ? g.nL + 'L' : g.nS + 'S'),
    }];
  }, [grupKiri, simbol]);

  const jiplakMinta = cari.get('jiplak');
  const jiplakTerpasang = useRef<string | null>(null);
  useEffect(() => {
    if (!pemilik || !jiplakMinta || jiplakTerpasang.current === jiplakMinta) return;
    jiplakTerpasang.current = jiplakMinta;
    let hidup = true;
    let dipakai: string | null = null;
    void import('@/lib/chart-agen').then(({ gambarChart }) => gambarChart(jiplakMinta)).then((u) => {
      if (!hidup) { if (u) URL.revokeObjectURL(u); return; }
      if (!u) return;
      dipakai = u;
      setJiplak({ id: jiplakMinta, url: u, ...JIPLAK_BAWAAN });
    });
    /* Object URL yang belum sempat terpakai dilepas saat halamannya
       ditinggalkan di tengah pengambilan. Yang SUDAH terpasang dilepas
       oleh JiplakChart saat diganti atau dilepas — bukan di sini, kalau
       tidak gambarnya mati begitu efek ini dibersihkan. */
    return () => { hidup = false; if (dipakai && !jiplakTerpasang.current) URL.revokeObjectURL(dipakai); };
  }, [pemilik, jiplakMinta]);

  /* ── RENCANA YANG SUDAH JADI ORDER SUNGGUHAN ──────────────────────
     Dua keputusan yang masing-masing benar, bertemu jadi bug:

     (a) Sesudah order real berangkat, `rencana` SENGAJA dipertahankan —
         level yang sedang menjaga uang tidak boleh hilang dari layar tepat
         saat ia mulai berlaku.
     (b) REAL -> COPY sengaja TIDAK membersihkan rencana — orangnya sedang
         mengubah rencananya jadi sinyal untuk diposting, dan levelnya
         justru yang ia bawa.

     Bertemunya: level order SUNGGUHAN ikut terbawa ke layar berlabel COPY,
     dan tergambar sebagai garis yang tampak masih bisa diseret.

     Penandanya di sini. Rencana yang BELUM dikirim tetap boleh dibawa ke
     COPY (itu fiturnya); yang SUDAH jadi order tidak boleh — ia bukan
     rencana lagi, ia posisi, dan posisi digambar jalur lain yang sudah
     bergerbang mode. */
  const rencanaTerkirim = useRef(false);

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
      /* GABUNGAN: garisnya tampil, tapi MATI.
         ──────────────────────────────────────────────────────────────
         Baris gabungan tidak menunjuk satu order pun, jadi menyeret SL-nya
         adalah perintah tanpa sasaran. Garisnya tetap digambar karena
         justru itu yang dicari orang saat mengklik baris berlapis: harga
         rata-rata tertimbang adalah titik impas seluruh tumpukan, dan itu
         satu-satunya tempat angka tersebut terlihat di chart.

         Keterangannya menyebut jumlah ordernya, bukan cuma arahnya --
         garis yang tidak mau digeser tanpa penjelasan terbaca sebagai
         antarmuka rusak, bukan sebagai garis yang memang bukan kendali. */
      const sedangHapus = !!hapusMenunggu;
      const gabung = sunting.gabungan;
      const ketEntry = sedangHapus ? '· menghapus…'
        : gabung ? `· ${sunting.arah} · rata-rata ${gabung} order`
        : `· ${sunting.arah}`;
      const ketStop = sedangHapus ? '· menghapus…' : gabung ? '· rata-rata' : '';
      if (sunting.entry) g.push({
        id: 'entry', harga: sunting.entry, warna: sedangHapus ? '#71717a' : '#d4d4d8', label: 'Entry',
        ket: ketEntry,
        bisaSeret: !sedangHapus && !gabung,
      });
      if (suntingSl) g.push({ id: 'sl', harga: suntingSl, warna: sedangHapus ? '#7f5f5f' : '#f87171', label: 'SL', ket: ketStop, bisaSeret: !sedangHapus && !gabung });
      if (suntingTp) g.push({ id: 'tp', harga: suntingTp, warna: sedangHapus ? '#4a6b5e' : '#10b981', label: 'TP', ket: ketStop, bisaSeret: !sedangHapus && !gabung });
      return g;
    }
    /* ── PENJAGA SKALA ────────────────────────────────────────────────
       Level yang jaraknya berkali-kali lipat dari harga berjalan BUKAN
       milik simbol yang sedang tampil, dan menggambarnya tidak pernah
       benar. Emas di 4.632 pada chart Bitcoin di 79.269 tergambar sebagai
       tiga label yang menempel di dasar layar -- dan panel tiketnya ikut
       hidup, jadi satu tekan Kirim di situ menghitung ukuran dari level
       pasar yang sama sekali berbeda.

       Penyebab langsungnya sudah diperbaiki di atas (ejaan parameter),
       tapi penjaga ini menutup SELURUH KELASNYA: tautan lama yang masih
       beredar, tautan salin-tempel yang simbolnya terpotong, atau apa pun
       yang belum terpikir. Level yang tidak masuk skala DIBUANG, bukan
       digambar kecil-kecil di pojok.

       Ambang 10x sengaja longgar: rencana trade tidak pernah berjarak
       sepuluh kali lipat dari harga berjalan untuk instrumen yang sama,
       jadi tidak ada level sah yang bisa tersaring. Yang tersaring hanya
       level milik instrumen lain.

       Posisi & pending order NYATA tidak ikut disaring -- keduanya datang
       dari broker beserta simbolnya sendiri dan sudah disaring di sumber. */
    /* Acuannya jatuh ke harga lilin terakhir kalau modul order tidak hidup.
       Tanpa cadangan itu penjaganya mati persis pada keadaan yang paling
       mungkin membawa level nyasar: chart yang dibuka dari sebuah tautan,
       sebelum apa pun sempat tersambung.

       Dibaca dari REF, bukan dari state: memo ini tidak perlu dihitung
       ulang tiap lilin baru datang, dan harga yang telat satu lilin tidak
       mungkin mengubah penilaian berskala sepuluh kali lipat. */
    const tutupTerakhir = lilinRef.current.closes[lilinRef.current.closes.length - 1];
    const acuanSkala = aksi?.hargaKini || tutupTerakhir || 0;
    const seSkala = (x?: number) => {
      if (!x || !acuanSkala) return x;
      const r = x / acuanSkala;
      return r > 0.1 && r < 10 ? x : undefined;
    };
    const sumber = aksiPosisi
      ? { entry: aksiPosisi.masuk, sl: aksiPosisi.sl, tp: aksiPosisi.tp }
      : aksiTunda
      ? { entry: aksiTunda.entry, sl: aksiTunda.sl, tp: aksiTunda.tp }
      : { entry: seSkala(rencana.entry), sl: seSkala(rencana.sl), tp: seSkala(rencana.tp) };
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
  /* Garis pending PLUS bekal untuk membukanya.
     ────────────────────────────────────────────────────────────────────
     `GarisHarga` cuma butuh harga/warna/label; dua medan tambahan di sini
     ikut menumpang supaya sumber garis dan sumber pilihan TIDAK PERNAH
     terpisah. Kalau daftar klik dihitung di memo lain, keduanya bisa
     menyimpang satu putaran — dan yang menyimpang adalah order MANA yang
     dibuka saat garisnya disentuh. */
  type GarisOrderChart = GarisHarga & { id: string; pilih: OrderSunting };

  const garisOrder = useMemo<GarisOrderChart[]>(() => {
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

      const g: GarisOrderChart[] = [];

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
          id: o.tiket,
          /* Bentuknya disamakan PERSIS dengan yang dibangun baris pending di
             panel Posisi Terbuka — dua jalan masuk ke order yang sama harus
             menghasilkan pilihan yang sama, kalau tidak satu di antaranya
             mengubah sesuatu yang berbeda dari yang terlihat. */
          pilih: {
            pasar: 'mt5', jenis: 'pending',
            simbolChart: `MT5:${simbolDasarMt5(o.simbol)}`,
            simbol: o.simbol, arah: o.arah,
            entry: o.harga, sl: o.sl, tp: o.tp,
            ukuran: o.lot, tiket: o.tiket,
          },
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
    /* SL/TP pending kripto TIDAK ada di ordernya sendiri — di Binance
       Futures keduanya order kondisional terpisah yang cuma terikat pada
       simbol. `barisPendingKripto` sudah menjodohkannya, dan dipakai ulang
       di sini alih-alih ditulis lagi: penjodohan yang disalin akan
       menyimpang dari panel pada hari salah satunya disunting. */
    const petaPend = new Map(barisPendingKripto(
      orderBursa.filter((o) => o.jenis === 'ENTRY'),
      orderBursa.filter((o) => o.jenis === 'SL' || o.jenis === 'TP'),
      rencanaLokal(),
    ).map((b) => [b.kunci, b]));

    return milik.map((o, i): GarisOrderChart => {
      const b = petaPend.get(o.id);
      return {
        harga: o.pemicu || o.harga,
        warna: o.arah === 'BUY' ? 'rgba(251,191,36,.85)' : 'rgba(251,146,60,.85)',
        label: `${o.arah === 'BUY' ? 'Buy' : 'Sell'} ${/STOP/.test(o.tipe) ? 'Stop' : 'Limit'}${banyak ? ` ${i + 1}` : ''}`,
        id: o.id,
        pilih: {
          pasar: 'kripto', jenis: 'pending',
          simbolChart: o.simbol, simbol: o.simbol, arah: o.arah,
          entry: o.pemicu || o.harga,
          /* RENCANA TIDAK IKUT. SL/TP yang masih catatan lokal belum ada di
             bursa; menggambarnya sebagai garis yang bisa diseret lalu
             dikirim cuma menghasilkan galat — dan sebelum galatnya muncul,
             layar sudah terlanjur memperlihatkan stop yang tidak menjaga
             apa pun. Aturan yang sama dipakai panel. */
          sl: b && !b.rencana ? b.sl : 0,
          tp: b && !b.rencana ? b.tp : 0,
          ukuran: o.qty, tiket: o.id,
        },
      };
    });
  /* akunMt5.posisi DIKELUARKAN dari dependensi bersama blok yang memakainya.
     Bukan sekadar rapi-rapi: EA melapor tiap beberapa detik dengan array
     posisi BARU yang isinya sama, jadi dependensi ini menghitung ulang
     seluruh garis order — lalu ChartLilin membongkar-pasang price line-nya
     — beberapa detik sekali, selamanya, untuk hasil yang identik. Itulah
     salah satu sumber "chart terasa berat" yang sudah dicatat di berkas
     ini. Posisi kini digambar ChartLilin lewat prop `posisiMt5`, yang
     identitasnya memang sudah distabilkan lewat kunci JSON. */
  }, [orderBursa, simbol, aksiTunda, akunMt5.pending, aksi?.mode]);

  /* Sasaran klik untuk tiap garis pending. Diturunkan dari `garisOrder`,
     bukan dihitung ulang — lihat catatan di atas memo itu. */
  const garisKlikOrder = useMemo<GarisKlik[]>(
    () => garisOrder.map((g) => ({
      id: g.id, harga: g.harga, judul: `${g.label} — klik untuk mengubah`,
    })),
    [garisOrder]);

  /* ── GARIS PENDING DISENTUH ────────────────────────────────────────────
     Dilaporkan pemilik 2 Sep 2026: "kalau garis order diklik dia langsung
     ke-select jadi biru, nah kalau limit order itu garisnya ga bisa
     di-select jadi ga bisa diubah-ubah."

     Sebabnya bukan gerbang yang lupa dibuka. Garis posisi lahir dari klik
     baris di panel, jadi ia SUDAH berupa hamparan DOM begitu tergambar;
     garis pending digambar chart sendiri sebagai price line, dan price line
     tidak menerima klik dari siapa pun. Jalannya memang tidak pernah ada.

     Panel ubahnya dibuka SEKALIGUS di sini, berbeda dari garis posisi yang
     menunggu satu klik lagi. Alasannya bukan ketidakkonsistenan: untuk
     posisi, klik pertama terjadi di TABEL dan sering cuma ingin melihat
     "stop saya di mana", jadi garisnya dulu, panelnya belakangan. Garis
     pending sudah tergambar sepanjang waktu tanpa diminta — satu-satunya
     alasan orang mengarahkan kursor ke sana dan menekannya adalah karena
     ia mau mengurus order itu. */
  function pilihGarisOrder(id: string) {
    const g = garisOrder.find((x) => x.id === id);
    if (!g) return;
    bukaSunting(g.pilih);
    setPanelUbah(true);
  }

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
  /* Ejaan untuk DITAMPILKAN di kotak simbol. `simbol` sendiri tetap nama
     dasar — ia kunci routing yang dipakai mencari lilin di penyimpanan, dan
     mengganti nilainya berarti mencari simbol yang tidak ada di sana. Yang
     berbeda cuma yang terbaca orang. */
  const tampilSimbol = useCallback((s: string) =>
    (s.startsWith('MT5:') ? 'MT5:' + bacaNamaMt5(s.slice(4)) : s), []);

  const [ketik, setKetik] = useState(() => tampilSimbol(simbol));
  useEffect(() => { setKetik(tampilSimbol(simbol)); }, [simbol, tampilSimbol]);

  /* Nama asli baru diketahui SESUDAH lilin pertamanya tiba — sebelum itu
     peta namanya masih kosong dan kotaknya terpaksa menulis nama dasar.
     Efek ini membetulkannya begitu datanya sampai.

     Hanya mengganti kalau isinya PERSIS ejaan routing, yaitu belum disentuh
     siapa pun. Tanpa penjaga itu, tiap penyegaran data akan menghapus apa
     yang sedang diketik orangnya di tengah kalimat. */
  useEffect(() => {
    setKetik((k) => (k === simbol ? tampilSimbol(simbol) : k));
  }, [simbol, lilin, tampilSimbol]);
  function komitSimbol() {
    const mentah = ketik.trim();
    if (!mentah) { setKetik(tampilSimbol(simbol)); return; }

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
    /* Dicocokkan terhadap DUA ejaan: nama dasar dan nama asli terminalnya.
       Orang yang menyalin "XAUUSDc" dari MT5-nya harus ketemu, dan itu justru
       ejaan yang paling mungkin ia ketik. */
    const cocokMt5 = simbolMt5.find((s) =>
      s.toLowerCase() === tanpaAwalan.toLowerCase()
      || bacaNamaMt5(s).toLowerCase() === tanpaAwalan.toLowerCase());
    if (cocokMt5) {
      const penuh = 'MT5:' + cocokMt5;
      /* Yang tampil ejaan terminalnya; yang dikirim tetap nama dasar. */
      setKetik('MT5:' + bacaNamaMt5(cocokMt5));
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
    if (!/^(MT5:)?[A-Za-z0-9._#-]{2,20}$/.test(v)) { setKetik(tampilSimbol(simbol)); return; }
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
      /* LABEL memakai ejaan terminal orangnya (XAUUSDc), NILAI tetap nama
         dasar (MT5:XAUUSD) — itu kunci yang dipakai mencari lilinnya. Kalau
         nilainya ikut berubah, rutenya mencari simbol yang tidak ada di
         penyimpanan dan chartnya kosong tanpa pesan apa pun. */
      ...simbolMt5.map((s) => ({ nilai: 'MT5:' + s, label: bacaNamaMt5(s), sumber: 'Trade-Fi · MT5' })),
      /* Daftar HIDUP, bukan `SIMBOL_DASAR` yang beku. Inilah yang membuat
         koin hasil pencarian sendiri muncul di sini pada kunjungan
         berikutnya -- dan yang membuat koin yang diblokir dari Screener
         benar-benar hilang dari sini juga. */
      ...simbolAktif.map((s) => ({ nilai: s, label: s, sumber: 'Kripto · Binance' })),
    ];
    return (q ? semua.filter((o) => o.label.toLowerCase().includes(q)) : semua).slice(0, 40);
  }, [ketik, simbolMt5, simbolAktif]);

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
          {/* Selebar isinya, bukan 120 px.
              ──────────────────────────────────────────────────────────
              `min-w-[120px]` masuk akal waktu labelnya berbunyi "15 Menit".
              Sejak label jadi singkatan, yang terpanjang cuma "Weekly" --
              dan sisanya jadi ruang kosong yang tidak dipakai apa pun
              sambil mendorong harga terakhir menjauh dari simbolnya.

              96 px, bukan pas-pasan: panah bawaan `select` digambar sistem
              operasi dan lebarnya berbeda-beda antar peramban. Menyisakan
              napas lebih murah daripada label yang terpotong di mesin yang
              tidak pernah saya lihat. */}
          <div className="w-[96px] shrink-0">
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
            {simbol.startsWith('MT5:') && (() => {
              /* Lencana ini menyebut BROKER, bukan cuma "MT5". Ia duduk tepat
                 di sebelah harga — tempat mata jatuh sebelum menekan Buy —
                 jadi di sinilah kekeliruan akun paling mahal. Exness cent dan
                 HFM standar punya XAUUSD yang sama namanya dan harga yang
                 mirip; yang membedakan cuma nilai lot, seratus kali lipat.

                 Nomor akun ikut karena satu orang bisa punya DUA akun di
                 broker yang sama (demo dan real Exness, misalnya) — nama
                 brokernya identik, nomornya tidak. */
              /* ACUAN vs MILIK SENDIRI — dua keadaan yang TIDAK BOLEH
                 terlihat sama. Grafik acuan datang dari terminal pemilik
                 situs, bukan dari broker pembacanya; harganya bisa meleset
                 beberapa dolar dan nilai lotnya bisa berbeda seratus kali.
                 Yang membaca grafik acuan sambil mengira itu brokernya
                 sendiri baru sadar keliru saat ordernya meleset — jadi
                 warnanya pun dibedakan, bukan cuma kalimatnya. */
              const dariAcuan = bacaAcuanMt5(simbol.slice(4));
              const ak = akunMt5.daftarAkun.find((a) => a.login === akunMt5.loginAktif);
              if (dariAcuan) {
                return (
                  <span className="mb-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sky-300"
                        title="Grafik ACUAN dari terminal Jadi Trader, bukan dari brokermu. Pasang EA Trade-Fi Sync di MT5-mu supaya chart memakai harga brokermu sendiri — spread dan nilai lot tiap broker berbeda.">
                    ACUAN · belum pasang EA
                  </span>
                );
              }
              /* PENDEK. Lencana ini duduk tepat di sebelah angka harga, dan
                 keterangan panjang di sini mendorong harganya menyempit —
                 padahal harga yang justru dibaca tiap detik. Broker dan nomor
                 akunnya pindah ke kepala panel "Order Terbuka — Trade-Fi",
                 tempat pertanyaannya memang "order ini di akun mana".
                 Rinciannya tetap ada di judul (tooltip) lencana ini. */
              return (
                <span className="mb-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300"
                      title={ak
                        ? `OHLC dari terminal ${ak.broker || 'MT5'} akun ${ak.login}, dikirim EA Trade-Fi Sync tiap beberapa menit. Order REAL di simbol ini berangkat ke terminal itu, bukan Binance.`
                        : 'OHLC dari terminal MT5-mu, dikirim EA Trade-Fi Sync. Order REAL di simbol ini berangkat ke MT5, bukan Binance.'}>
                  TRADE-FI
                </span>
              );
            })()}
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
                    {/* Baris skrip = SATU tombol pasang/lepas + tiga ikon
                        yang dulu melayang di chart. Bukan satu tombol besar
                        lagi: tombol di dalam tombol tidak sah di HTML, dan
                        peramban menyusunnya jadi bersaudara yang klik-nya
                        saling merebut. Jadi barisnya kini div, dengan tombol
                        utama yang memuai mengisi sisa ruang. */}
                    {(kendaliPine?.daftar ?? []).map((s) => (
                      <div key={s.id} className="flex items-center rounded-md pr-1 transition-colors hover:bg-zinc-900">
                        <button
                          onClick={() => {
                            if (!kendaliPine) return;
                            if (s.aktif) kendaliPine.nonaktif(); else kendaliPine.jalankan(s.id);
                            setMenuInd(false);
                          }}
                          title={s.aktif ? 'Lepas dari chart' : 'Pasang di chart'}
                          className="flex min-w-0 grow cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left">
                          <span className={cn('size-2 shrink-0 rounded-full', s.aktif ? 'bg-emerald-500' : 'border border-zinc-700')} />
                          <span className="min-w-0 grow truncate text-[12px] text-zinc-200">{s.nama}</span>
                          {/* Kata "aktif" DIHAPUS untuk yang sedang jalan:
                              titik hijau sudah mengatakannya, dan ruang itu
                              sekarang dipakai ketiga ikon. "pasang" tetap —
                              ia mengajak, bukan melaporkan. */}
                          {!s.aktif && <span className="shrink-0 text-[10.5px] text-zinc-600">pasang</span>}
                        </button>
                        {/* Hanya untuk yang sedang terpasang. Menyetel input
                            atau melepas skrip yang tidak ada di chart adalah
                            perintah tanpa sasaran. */}
                        {s.aktif && (
                          <>
                            {pineInfo?.adaInput && (
                              <button onClick={() => { bukaDock('input'); setMenuInd(false); }}
                                title="Setelan input" aria-label="Setelan input"
                                className="shrink-0 cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:text-zinc-100">
                                <Settings2 className="size-3.5" />
                              </button>
                            )}
                            <button onClick={() => { bukaDock('editor'); setMenuInd(false); }}
                              title="Buka kodenya" aria-label="Buka kodenya"
                              className="shrink-0 cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:text-zinc-100">
                              <Code2 className="size-3.5" />
                            </button>
                          </>
                        )}
                        {/* SILANG = HAPUS SKRIPNYA, bukan melepas dari chart.
                            Melepas sudah jadi tugas baris utamanya — menekan
                            namanya memasang, menekan lagi melepas — jadi
                            silang yang cuma melepas mengerjakan hal yang
                            sudah punya kendali sendiri, dan menyisakan
                            daftar skrip yang tidak bisa dibersihkan tanpa
                            membuka dock editor dulu.

                            Tampil di SEMUA baris, bukan cuma yang terpasang:
                            yang paling ingin dibuang orang justru skrip yang
                            tidak pernah ia pakai. Konfirmasinya ada di
                            hapusId — permanen, jadi wajib ditanya. */}
                        <button onClick={() => kendaliPine?.hapus(s.id)}
                          disabled={(kendaliPine?.daftar.length ?? 0) <= 1}
                          title="Hapus skrip ini" aria-label="Hapus skrip ini"
                          className="shrink-0 cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30">
                          <X className="size-3.5" />
                        </button>
                      </div>
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

            {/* ── DOMPET: PANEL ORDER NON-KUSTODIAL DI SISI CHART ────────
                Pemilik saja, sampai ada pendapat hukum — gerbang yang sama
                dengan halaman /dex, dipasang di penyambungnya dan bukan di
                dalam panelnya. Panel adalah alat; yang berhak memutuskan
                siapa boleh memegangnya adalah yang memasangnya.

                Berpendar saat menyala, seperti tombol Replay: keduanya
                mengubah ARTI dari apa yang ada di layar, dan keadaan yang
                mengubah arti harus terlihat tanpa dicari. */}
            {pemilik && (
              <button onClick={() => bukaDex(!dexBuka)}
                title={dexBuka
                  ? 'Tutup panel dompet'
                  : 'Trading dengan dompet sendiri — order langsung ke Hyperliquid, tidak lewat server'}
                className={cn('flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px] transition-colors sm:px-2.5',
                  dexBuka
                    ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                    : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100')}>
                <Link2 className="size-3.5" />
                <span className={cn(dexBuka ? 'inline' : 'hidden sm:inline')}>Dompet</span>
              </button>
            )}

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
            <div className="min-w-0">
              <span className="text-[12.5px] text-amber-200/90">{galat}</span>

              {/* ── USUL, BUKAN PERPINDAHAN OTOMATIS ──────────────────────
                  Chart bisa menebak bahwa KPEPEUSDT yang datang dari daftar
                  chart pantauan sama dengan PEPEUSDT di Binance. Yang TIDAK
                  bisa ditebaknya: apakah dua nama itu benar-benar aset yang
                  sama, dan berapa kelipatannya. kPEPE Hyperliquid = 1000
                  PEPE; berpindah diam-diam berarti menampilkan chart dengan
                  harga seribu kali beda dari yang diminta, tanpa satu pun
                  tanda bahwa penggantian terjadi.

                  Jadi tebakannya ditawarkan, dan yang menekan tombolnya
                  orang yang tahu koin apa yang sedang dicarinya. */}
              {usulSimbol.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11.5px] text-zinc-500">Mungkin maksudnya:</span>
                  {usulSimbol.map((u) => (
                    <button key={u} onClick={() => setSimbol(rapikanSimbol(u))}
                      title={`Ganti simbol ke ${u} — periksa sendiri apakah ini aset yang sama`}
                      className="cursor-pointer rounded-md border border-amber-500/40 px-2 py-0.5 text-[11.5px] text-amber-200/90 transition-colors hover:border-amber-400 hover:bg-amber-500/10">
                      {u}
                    </button>
                  ))}
                  <span className="text-[11px] text-zinc-600">· pastikan sendiri asetnya sama</span>
                </div>
              )}
            </div>
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
          {/* ── DAFTAR DOMPET DI LUAR ChartLilin, BUKAN DI DALAMNYA ────
              ChartLilin dipasang dengan key yang memuat `simbol`, jadi
              seluruh komponennya dibongkar-pasang tiap kali pasangannya
              berganti. Untuk chart itu memang disengaja. Tapi daftar yang
              duduk di dalamnya ikut mati bersamanya, dan yang terlihat
              orang adalah panel kiri yang berkedip tiap pindah koin.

              Kedipnya tidak bisa dihilangkan dari dalam subpohon yang
              dikunci — apa pun di sana ikut dibongkar. Jadi panelnya berdiri
              di luar, dan yang berganti cuma chart di kanannya.

              Jiplak TIDAK dipindah: panel acuannya memang harus sejajar
              dengan kanvas, dan ia tetap di dalam ChartLilin. */}
          <PanelBelah tinggi={tinggiChart} onLebar={setSisaKiri}
            /* Screener membawa kartu selebar layar; 28% membuatnya terpotong
               jadi satu kolom sempit. Daftar dompet tetap 28% -- isinya baris
               teks pendek, dan melebarkannya cuma memakan chart. */
            lebarAwal={screenerMinta ? 0.42 : 0.28}
            kiri={!jiplak && screenerMinta ? (
              /* Screener didahulukan: ia dinyalakan lewat satu klik yang
                 disengaja dari halaman lain, sementara konsensus dan wallet
                 view menyala dari parameter yang bisa tertinggal di alamat.
                 Yang baru saja ditekan orang menang. */
              <div className="flex h-full flex-col">
                <div className="sticky top-0 z-10 flex items-start gap-2 border-b border-zinc-800 bg-zinc-950 px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-zinc-100">Screener Area</p>
                    <p className="text-[10.5px] text-zinc-600">klik kartu untuk memindah chart di sebelah</p>
                  </div>
                  <button onClick={() => {
                    const q = new URLSearchParams(cari);
                    q.delete('screener');
                    navigasi({ search: q.toString() ? '?' + q.toString() : '' }, { replace: true });
                  }} title="Tutup screener"
                    className="shrink-0 cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <Suspense fallback={
                    <p className="flex items-center gap-2 px-2.5 py-6 text-[12px] text-zinc-500">
                      <Loader2 className="size-3.5 animate-spin" /> Memuat screener…
                    </p>
                  }>
                    {/* 34 px = tinggi kepala panel di atasnya. Tanpa dikurangi,
                        bingkainya melebihi wadahnya dan baris terakhir screener
                        tidak pernah bisa dijangkau. */}
                    <ScreenerTertanam tinggi={Math.max(240, tinggiChart - 34)}
                      onPilihSimbol={(v) => {
                        setSimbol(rapikanSimbol(v.simbol));
                        if (v.tf) setTf(v.tf);
                      }} />
                  </Suspense>
                </div>
              </div>
            ) : !jiplak && grupKiri.length ? (
              <DaftarKonsensus grup={grupKiri}
                judul={grupKonsensus.length ? 'Konsensus dompet' : 'Wallet View'}
                sub={grupKonsensus.length
                  ? grupKiri.length + ' koin · WR rata-rata tiap sisi'
                  : grupKiri.length + ' koin · papan peringkat, min. 2 dompet'}
                aktif={simbol}
                pilih={(x) => setSimbol(rapikanSimbol(x))}
                keluar={() => {
                  /* Dua-duanya dibuang, bukan yang sedang aktif saja.
                     Menutup daftar sementara satu parameter tertinggal di
                     URL berarti daftar yang lain langsung menggantikannya —
                     tombol tutup yang malah menukar isi. */
                  const q = new URLSearchParams(cari);
                  q.delete('konsensus');
                  q.delete('walletview');
                  q.delete('j');
                  q.delete('pita');
                  setSemuaDompet(null);
                  setPapan(null);
                  navigasi({ search: q.toString() ? '?' + q.toString() : '' }, { replace: true });
                }} />
            ) : !jiplak && posisiDompet.length ? (
              <DaftarPosisiDompet posisi={posisiDompet} aktif={simbol}
                pilih={(x) => setSimbol(rapikanSimbol(x))}
                keluar={() => {
                  const q = new URLSearchParams(cari);
                  q.delete('dompet');
                  setPosisiDompet([]);
                  navigasi({ search: q.toString() ? '?' + q.toString() : '' }, { replace: true });
                }} />
            ) : undefined}>
          {lilin.times.length > 0
            ? <ChartLilin key={`${simbol}|${tf}|${kunciChart}`}
                          lilin={lilinGabung} garis={garis} trade={replayIdx === null ? hasil?.trade : undefined}
                          tinggi={tinggiChart} hingga={replayIdx ?? undefined} smi={smi}
                          garisHarga={[...garisHarga, ...garisZonaEntry, ...garisZona, ...garisDompet, ...garisKonsensus, ...(modeNyata ? garisOrder : [])]}
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
                          onKlikKosong={() => {
                            /* Seretan yang belum diputuskan dikembalikan
                               dulu. Klik di tempat lain adalah PEMBATALAN,
                               bukan persetujuan diam-diam. */
                            const a = seretAsal.current;
                            if (a) {
                              seretAsal.current = null;
                              if (a.jenis === 'sunting') { setSuntingSl(a.sl); setSuntingTp(a.tp); }
                              else setRencana(a.nilai);
                            }
                            /* -- Klik di luar garis MENUTUP order itu ----
                               Mengklik baris di Posisi Terbuka menggambar
                               entry/SL/TP-nya di chart. Dulu garis itu
                               tinggal di sana sampai ada yang menekan x di
                               labelnya -- jadi sesudah sekadar mengintip
                               "stop saya di mana", chart ditinggali garis
                               order yang tidak sedang diurus siapa pun,
                               dan garis order yang menganggur tidak bisa
                               dibedakan dari garis order yang sedang
                               dipertimbangkan.

                               Berlaku sama untuk kripto dan Trade-Fi:
                               keduanya lewat `sunting` yang sama.

                               DUA LANGKAH kalau panel ubahnya terbuka.
                               Panel itu berisi tombol Kirim dan Tutup
                               posisi, dan isiannya bisa sedang diketik.
                               Satu klik nyasar di chart tidak boleh
                               sekaligus membuang ketikan DAN menghilangkan
                               ordernya dari layar; klik pertama menutup
                               panel (dan mengembalikan level ke nilai
                               broker, persis seperti tombol silangnya),
                               klik kedua baru melepas garisnya. */
                            if (!suntingAktif.current) return;
                            if (panelUbah) { tutupPanelUbah(); return; }
                            lepasSunting();
                          }}
                          onLebarKiri={setSisaKiriDalam}
                          panelKiri={dexBuka ? (
                            <div className="flex h-full flex-col">
                              <div className="flex items-center gap-2 border-b border-zinc-800 px-2.5 py-1.5">
                                <span className="text-[11.5px] font-medium text-zinc-200">Dompet saya</span>
                                <span className="truncate text-[10px] text-zinc-500">order langsung ke Hyperliquid</span>
                                <button onClick={() => setDexBuka(false)} aria-label="Tutup panel dompet"
                                        className="ml-auto shrink-0 cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
                                  <X className="size-3.5" />
                                </button>
                              </div>
                              <div className="min-h-0 grow">
                                <PanelDex sempit koinChart={simbol.replace(/USDT$/, '')} />
                              </div>
                            </div>
                          ) : bandingSalin ? (
                            <ChartBanding banding={bandingSalin} lilin={lilinGabung}
                                          tinggi={tinggiChart} tampilan={tampilan}
                                          onTutup={() => setBandingSalin(null)} />
                          ) : undefined}
                          garisSeret={garisSeret}
                          onSeret={(id, h) => {
                            if (sunting) {
                              if (sunting.gabungan) return;
                              if (!seretAsal.current) {
                                seretAsal.current = { jenis: 'sunting', sl: suntingSl, tp: suntingTp };
                              }
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
                            if (!seretAsal.current) {
                              seretAsal.current = { jenis: 'rencana', nilai: { ...rencana } };
                            }
                            if (id === 'entry') entryDigeser.current = true;
                            seretTangan.current = true;
                            setRencana((r) => ({ ...r, [id]: h }));
                          }}
                          garisKlik={modeNyata ? garisKlikOrder : undefined}
                          onKlikGarisOrder={pilihGarisOrder}
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
                          jiplak={jiplak}
                          /* Isian harganya duduk di kaki panel acuan, di
                             dalam ChartLilin — halaman ini cuma menyimpan
                             hasilnya. Digabung, bukan ditimpa: yang berubah
                             satu medan, dan mengirim objek utuh dari sana
                             berarti medan lain ikut ditulis ulang setiap
                             kali salah satunya disunting. */
                          onUbahJiplak={(p) => setJiplak((j) => (j ? { ...j, ...p } : j))}
                          /* Parameter URL-nya ikut dibuang. Kalau tidak,
                             `?jiplak=` yang tertinggal akan memasang ulang
                             gambar yang sama pada muat berikutnya — tombol
                             tutup yang tidak benar-benar menutup. */
                          onLepasJiplak={() => {
                            setJiplak(null);
                            jiplakTerpasang.current = null;
                            const q = new URLSearchParams(cari);
                            q.delete('jiplak');
                            navigasi({ search: q.toString() ? '?' + q.toString() : '' }, { replace: true });
                          }}

                          posisiMt5={modeNyata ? posisiMt5Chart : KOSONG_POSISI}
                          onUbahPosisi={simbol.startsWith('MT5:') ? ubahPosisiMt5 : undefined}
                          hargaAsk={modeNyata ? askTampil : undefined}
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
                              simbol={simbol}
                              posisi={aksi.posisi} hargaKini={aksi.hargaKini}
                              draf={draf} rencana={rencana} mode={aksi.mode}
                              jenis={labelJenis}
                              /* Menarik entry ke harga pasar, DAN menggeser
                                 SL/TP sejauh yang sama: jarak risikonya
                                 milik orangnya, dan memindahkan entry tanpa
                                 memindahkan stop diam-diam mengubah berapa
                                 dolar yang ia pertaruhkan.

                                 `entryDigeser` dinolkan supaya sesudah ini
                                 garisnya ikut menyusul harga sendiri —
                                 menekan Market lalu melihat garisnya
                                 tertinggal lagi semenit kemudian adalah
                                 tombol yang cuma setengah bekerja. */
                              onMarket={aksi.hargaKini ? () => {
                                const h = aksi.hargaKini as number;
                                setRencana((r) => {
                                  const geser = r.entry ? h - r.entry : 0;
                                  return {
                                    entry: h,
                                    sl: r.sl && geser ? r.sl + geser : r.sl,
                                    tp: r.tp && geser ? r.tp + geser : r.tp,
                                  };
                                });
                                entryDigeser.current = false;
                              } : undefined}
                              risiko={aksi.risiko} qtyDemo={qtyTampil}
                              tunda={aksiTunda} onBatalTunda={aksi.batalTunda}
                              onCopySinyal={sinyalAsal && kanalAsal ? () => setCopySinyalBuka(true) : undefined}
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
                                /* SUDAH JADI ORDER = TIDAK IKUT PINDAH MODE.
                                   Berlaku juga untuk 'menuju-copy': yang boleh
                                   dibawa ke COPY adalah RENCANA, dan rencana
                                   yang sudah dikirim bukan rencana lagi. Tanpa
                                   ini, garis order sungguhan tetap tergambar
                                   di layar berlabel COPY — persis keluhan
                                   "baru kirim, langsung ganti mode, garisnya
                                   masih ada". */
                                if (m !== 'real' && rencanaTerkirim.current) {
                                  setRencana({});
                                  setDraf(null);
                                  entryDigeser.current = false;
                                }
                                if (m === 'real') rencanaTerkirim.current = false;
                                /* ORDER NYATA YANG SEDANG DISUNTING IKUT DILEPAS.
                                   ────────────────────────────────────────────
                                   Selama ini keluar dari REAL cuma BERHENTI
                                   MENGGAMBAR garisnya (lihat penjaga mode di
                                   garisSeret) — `sunting` sendiri tetap
                                   menunjuk order sungguhan itu. Akibatnya
                                   panel ubah SL/TP tetap hidup di layar yang
                                   sudah berlabel DEMO/COPY, dan tombol
                                   Kirim-nya masih mengarah ke bursa. Menekan
                                   Kirim di sana mengubah order sungguhan dari
                                   mode latihan.

                                   Berlaku untuk COPY juga: 'menuju-copy' boleh
                                   menyelamatkan RENCANA (level yang mau
                                   diposting jadi sinyal), tapi tidak boleh
                                   menyelamatkan pegangan ke order broker —
                                   sinyal yang diposting bukan order siapa pun.

                                   Sengaja tanpa syarat `sebab`: apa pun
                                   alasannya, begitu modenya bukan real, tidak
                                   ada order nyata yang boleh tetap terpegang. */
                                if (m !== 'real') {
                                  setSunting(null);
                                  setPanelUbah(false);
                                  setSuntingSlTeks('');
                                  setSuntingTpTeks('');
                                  setSuntingKabar('');
                                }
                              }}
                              onPilih={(arah) => {
                                setDraf(arah);
                                setKabarNyata('');
                                /* Tiket BARU: penandanya gugur. Menekan
                                   BUY/SELL berarti orangnya menyusun rencana
                                   berikutnya, bukan menatap order yang sudah
                                   berangkat. */
                                rencanaTerkirim.current = false;
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
                                seretAsal.current = null;
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
                                seretAsal.current = null;
                                /* Datang dari kartu sinyal? Batal berarti
                                   kembali ke tempat asalnya — bukan berdiri
                                   di chart kosong mencari jalan pulang. */
                                if (sinyalAsal && kanalAsal) {
                                  navigasi('/copy-signal?kanal=' + encodeURIComponent(kanalAsal));
                                }
                                entryDigeser.current = false;
                                seretTangan.current = false;
                                /* Jangkar ikut dilepas: tiket berikutnya
                                   harus menghitung ukurannya sendiri, bukan
                                   mewarisi ukuran rencana yang dibatalkan. */
                                qtyDemo.current = 0; setQtyTampil(0);
                              }}
                              onKirim={() => {
                                seretAsal.current = null;
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
                                          rencanaTerkirim.current = true;
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
                                    if (h.pesan !== 'Dibatalkan.') {
                                      setDraf(null);
                                      rencanaTerkirim.current = true;
                                    }
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
          </PanelBelah>

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
              {/* ── LATARNYA DIKEMBALIKAN ────────────────────────────────
                  Dulu di sini tertulis "tanpa bingkai dan latar — ia bagian
                  dari chart, bukan kartu yang menumpang di atasnya". Niatnya
                  benar untuk panel yang isinya cuma tiga baris teks tipis.

                  Tapi panelnya sudah tidak begitu lagi: ada kotak isian
                  bergaris, dan sejak angka dolar dapat latarnya sendiri,
                  separuh isinya berkotak sementara separuhnya menembus lilin.
                  Dilaporkan pemilik 3 Sep 2026 — "belum di background semua",
                  dan setengah berlatar memang lebih buruk daripada dua-duanya:
                  yang tidak berlatar terbaca sebagai tercecer, bukan sebagai
                  menyatu.

                  Gayanya DISAMAKAN dengan bilah alat gambar yang berdiri
                  beberapa piksel di sebelahnya — rounded-lg, border-zinc-800/80,
                  bg-zinc-950/85, backdrop-blur. Dua benda melayang di satu
                  chart yang digambar dengan dua bahasa berbeda terbaca sebagai
                  dua aplikasi.

                  Lebarnya 252 -> 272 px, dan itu bukan pelebaran: Tailwind
                  memakai border-box, jadi p-2.5 memakan 20 px dari dalam.
                  272 - 20 = 252 px isi — persis lebar yang sudah diukur
                  menampung baris kepalanya. */}
              {/* ── 208 px, DAN TIAP ANGKANYA DIUKUR ────────────────────────
                  Riwayatnya: 210 -> 268 (kolom dolar masuk) -> 252 -> 246 -> 208.
                  Yang menahannya selalu sama dan baru ketahuan sesudah tiap
                  bagian diukur SENDIRI-SENDIRI:

                    kepala BERISI nama bursa   221 px   <- biang keladinya
                    kepala tanpa nama bursa    129 px
                    bursa + P/L satu baris     164 px
                    baris SL/TP alami          165 px

                  Nama bursa di baris kepala memaksa panel 221 px demi satu kata,
                  dan sisanya menganggur di semua baris lain. Diturunkan ke baris
                  kedua bersama P/L, penahannya jatuh ke baris SL/TP.

                  186 px isi + 20 padding + 2 tepi = 208 px. Isian `grow`
                  menghabiskan sisanya, jadi tidak ada lagi celah — tidak di
                  tengah baris, tidak juga di ujungnya. */}
              <div className="w-[208px] shrink-0 rounded-lg border border-zinc-800/80 bg-zinc-950/85 p-2.5 text-[11.5px] backdrop-blur-sm">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-zinc-200">{sunting.simbol}</span>
                                <span className={cn('text-[10.5px]', sunting.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                                  {sunting.arah}
                                </span>
                                {/* Nama bursa PINDAH ke baris kedua — lihat catatan di
                                    atas lebar panel. */}
                                {/* Menutup PANELNYA saja — garis ordernya tetap
                                    di chart, jadi tinggal diklik lagi kalau
                                    berubah pikiran.

                                    Silang di pojok, bukan tombol bertulisan di
                                    barisan bawah: di sana ia berdiri sebaris
                                    dengan "Tutup posisi", dan dua kendali
                                    bersebelahan yang sama-sama diawali "Tutup"
                                    tapi satu menutup gambar sementara satunya
                                    menutup uang adalah pasangan yang tidak
                                    boleh dibiarkan.

                                    stopPropagation: seluruh panel ini bisa
                                    diseret lewat onPointerDown, dan tanpa ini
                                    menekan silangnya ikut memulai seretan. */}
                                <button
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={tutupPanelUbah}
                                  aria-label="Tutup panel"
                                  title="Tutup panel — garis ordernya tetap di chart"
                                  /* `ml-auto` KEMBALI, dan kali ini benar. Yang dulu
                                     salah bukan penempatannya di pojok — itu memang
                                     tempat tombol tutup di dialog mana pun — melainkan
                                     LEBAR PANELNYA: 272 px membuat jaraknya menganga
                                     ratusan piksel. Panelnya sekarang 208 px, dan
                                     jaraknya jadi sekadar jarak judul. */
                                  className="ml-auto shrink-0 cursor-pointer self-center rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
                                  <X className="size-3" />
                                </button>
                              </div>
                              {/* Bursa DAN P/L dalam satu baris. Diukur: "posisi ·
                                  Hyperliquid · P/L +$103,97" = 164 px, sementara baris
                                  kepala berisi bursa memakan 221 px. Menurunkannya ke
                                  sini memotong 57 px dari lebar minimum panel — dan
                                  keduanya memang satu kalimat: di mana posisinya, dan
                                  sedang bagaimana. */}
                              <div className="mt-0.5 truncate text-[10.5px] text-zinc-500">
                                {sunting.jenis === 'pending' ? 'pending' : 'posisi'} · {sunting.pasar === 'mt5'
                                  ? 'Trade-Fi'
                                  : bacaPasar(sunting.simbol) === 'hyperliquid' ? 'Hyperliquid' : 'Binance'}
                                {pnlSunting !== null && (<>
                                  {' · P/L '}
                                  <span className={cn('angka', pnlSunting >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                                    {uang(pnlSunting, true)}
                                  </span>
                                </>)}
                              </div>
                              {/* GABUNGAN: keterangan, bukan kendali.
                                  ──────────────────────────────────────
                                  Isian SL/TP dan tombol Kirim di bawah ini
                                  semuanya bekerja pada SATU order. Baris
                                  gabungan tidak punya satu pun -- ia
                                  ringkasan. Menampilkan kendalinya lalu
                                  menolak saat ditekan lebih buruk daripada
                                  tidak menampilkannya sama sekali: yang
                                  ditawarkan layar harus bisa dilakukan.

                                  Yang TETAP tampil di atas: simbol, arah,
                                  dan P/L berjalan. Ketiganya benar untuk
                                  gabungan persis seperti untuk order
                                  tunggal. */}
                              {sunting.gabungan ? (
                                <div className="mt-1.5 text-[10.5px] leading-relaxed text-zinc-500">
                                  Garis di harga rata-rata{' '}
                                  <span className="text-zinc-300">{sunting.gabungan} order</span>
                                  {' '}— itu titik impas tumpukannya.
                                  <span className="mt-1 block text-zinc-600">
                                    Untuk mengubah SL/TP, lepas gabungannya di tabel lalu pilih ordernya.
                                  </span>
                                </div>
                              ) : (<>
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
                                  {/* ── MEMENUHI BARISNYA, SESUDAH PANELNYA DIPERAS ──
                                      Sempat dibuat menyesuaikan panjang angkanya
                                      (`calc(<n>ch + 14px)`) karena di panel 268 px ia
                                      melar sampai 182 px untuk angka yang butuh 43.

                                      Tapi menyesuaikan isi memindahkan celahnya, bukan
                                      menghapusnya: kotaknya mengecil dan ruang kosongnya
                                      pindah ke ujung kanan baris. Dilaporkan lagi, dan
                                      benar — celah di ujung sama menganggurnya dengan
                                      celah di tengah.

                                      Yang menghapusnya: PANELNYA yang diperas sampai
                                      sepas barisnya, lalu isian dibiarkan `grow`. Di
                                      lebar isi 186 px, isian dapat 82 px — cukup untuk
                                      "0.00012345" (63 px teks + 12 px padding + 2 px
                                      tepi = 77 px) tanpa menyisakan lapangan kosong. */}
                                  <input
                                    value={nilai}
                                    inputMode="decimal"
                                    placeholder="seret garisnya"
                                    onFocus={() => { if (!nilai && aksi?.hargaKini) atur(String(aksi.hargaKini)); }}
                                    onChange={(e) => atur(e.target.value.replace(/[^\d.,-]/g, '').replace(',', '.'))}
                                    className="angka h-6 min-w-0 grow rounded border border-zinc-800 bg-zinc-900/80 px-1.5 text-right text-[11px] text-zinc-200 outline-none placeholder:text-[9.5px] placeholder:text-zinc-700 focus-visible:border-zinc-600" />
                                  {/* ── DIDEKATKAN, DAN DIBERI LATAR ──────────────────
                                      Dilaporkan pemilik 3 Sep 2026: angkanya terlalu jauh
                                      dan terlihat aneh tanpa latar.

                                      `ml-auto` DICABUT. Ia dulu mendorong angka dolar ke
                                      tepi kanan panel, jadi seluruh ruang sisa jatuh tepat
                                      di antara harga dan dolarnya — dua angka yang justru
                                      satu kalimat ("di harga sekian, uangnya sekian")
                                      dipisahkan sejauh mungkin. Sekarang ia duduk langsung
                                      di sebelah isiannya, dan ruang sisa jatuh di ujung
                                      baris tempat ia tidak memisahkan apa pun.

                                      LATAR TANPA GARIS TEPI. Sebelumnya teks telanjang di
                                      sebelah kotak isian bergaris — dua hal sederajat yang
                                      digambar dengan dua bahasa berbeda, dan yang tanpa
                                      kotak terbaca seperti tercecer. Latar tanpa garis
                                      membuatnya sederajat tanpa menjadikannya isian kedua
                                      yang mengundang diketik.

                                      Lebar TETAP, bukan menyesuaikan isi: angkanya berubah
                                      tiap piksel seretan, dan kotak yang ikut melar akan
                                      berkedip-kedip sepanjang garisnya ditarik. 72 px =
                                      54 px untuk "-$1.234,56" (diukur) + 12 px padding +
                                      sisa. */}
                                  {(() => {
                                    const d = uangDiHarga(Number(nilai) || 0);
                                    return (
                                      <span className={cn('angka w-[72px] shrink-0 rounded bg-zinc-800/70 px-1.5 py-0.5 text-right text-[10.5px] tabular-nums',
                                        d === null ? 'text-zinc-600' : d >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                                        {d === null ? '—' : uang(d, true)}
                                      </span>
                                    );
                                  })()}
                                </label>
                              ))}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                {/* MEMANJANG mengisi barisnya. Diminta pemilik 3 Sep
                                    2026: tombol sekecil "Kirim" di panel selebar ini
                                    meninggalkan baris terakhir yang hampir seluruhnya
                                    kosong, dan baris kosong di bawah dua baris berisi
                                    terbaca sebagai panel yang belum selesai digambar.

                                    `grow`, bukan `w-full`: untuk order pending ada
                                    tombol "Hapus order" di sebelahnya, dan `w-full`
                                    akan mendorongnya turun ke baris sendiri. `grow`
                                    mengisi apa pun yang tersisa — penuh saat sendirian,
                                    sisanya saat berdua.

                                    "Ubah Posisi", bukan "Kirim": yang dikirim memang
                                    perubahan, tapi kata "Kirim" tidak menyebut APA yang
                                    dikirim — dan di panel yang juga punya tombol
                                    penghapus, tombol yang tidak menyebutkan akibatnya
                                    adalah tombol yang ditekan sambil menebak. Untuk
                                    pending ia berbunyi "Ubah Order": yang disunting
                                    memang belum jadi posisi, dan menyebutnya posisi
                                    berarti menjanjikan sesuatu yang belum ada. */}
                                <button onClick={() => void kirimSunting()} disabled={suntingSibuk}
                                  className="flex grow cursor-pointer items-center justify-center gap-1 rounded bg-zinc-100 px-2 py-1 text-[10.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
                                  {suntingSibuk ? <Loader2 className="size-3 animate-spin" /> : null}
                                  {sunting.jenis === 'pending' ? 'Ubah Order' : 'Ubah Posisi'}
                                </button>
                                {/* LATARNYA MENYEBUT AKIBATNYA, bukan jenis
                                    tombolnya. Merah di seluruh aplikasi ini
                                    berarti "hati-hati"; di sini yang perlu
                                    diketahui sebelum menekan bukan bahayanya
                                    melainkan hasilnya: menutup sekarang itu
                                    memanen atau merealisasikan rugi.

                                    Sumbernya P/L berjalan yang sama dengan
                                    yang tertulis di atas -- angka dan warna
                                    tidak mungkin berselisih.

                                    Pending order TIDAK diwarnai: ia belum
                                    punya P/L sama sekali, dan hijau di
                                    "Hapus order" akan menjanjikan untung yang
                                    tidak ada. Begitu juga saat P/L belum
                                    terbaca -- warna yang dikarang lebih buruk
                                    daripada tidak berwarna. */}
{/* ── "TUTUP POSISI" DICABUT DARI SINI ─────────────────────────
                                    Diminta pemilik 3 Sep 2026: "kadang saya
                                    salah klik di sana".

                                    Alasannya kuat. Panel ini dibuka untuk
                                    SATU maksud — menggeser SL/TP — dan tombol
                                    yang mengakhiri posisi berdiri sebaris
                                    dengan tombol yang menyimpannya, berjarak
                                    beberapa piksel, di panel yang bisa
                                    diseret ke mana saja. Dua tindakan yang
                                    akibatnya sejauh itu tidak boleh
                                    bertetangga.

                                    Tidak ada yang hilang: tombol Tutup ada di
                                    tiap baris Posisi Terbuka, tempat orang
                                    bisa membaca dulu P/L, size, dan simbolnya
                                    sebelum menekan.

                                    "Hapus order" untuk PENDING TETAP ADA, dan
                                    itu bukan setengah hati. Pending kripto
                                    tidak punya tombol hapus di panel tabel
                                    (ikon tong sampah di sana sengaja hanya
                                    untuk Trade-Fi, karena sebagian baris
                                    kripto masih rencana lokal), jadi
                                    mencabutnya di sini akan menghapus
                                    satu-satunya jalan yang tersisa. Yang
                                    dibuang tombol yang punya pengganti; yang
                                    tinggal tombol yang tidak. */}
                                {sunting.jenis === 'pending' && (
                                  <button onClick={() => void akhiriOrder()} disabled={suntingSibuk}
                                    className="cursor-pointer rounded px-2 py-1 text-[10.5px] text-red-400/90 transition-colors hover:bg-red-500/10 disabled:opacity-50">
                                    Hapus order
                                  </button>
                                )}
                              </div>
                              </>)}
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
            {/* NAMA INDIKATOR DIBUANG DARI CHART atas permintaan pemilik.
                Dulu di sini berbaris "Supertrend", "Zona SNR", "SMI",
                masing-masing dengan ikonnya sendiri.

                Alasannya masuk akal begitu indikatornya lebih dari satu:
                tiga baris teks di pojok kanan-atas menutupi lilin justru di
                sisi yang paling sering dibaca -- harga terkini. Dan daftar
                yang sama sudah ada di panel Indikator di bilah atas, lengkap
                dengan pencacahnya. Satu daftar, bukan dua yang harus
                dijaga tetap sepakat.

                Ketiga ikonnya -- setelan input, buka kode, lepas -- ikut
                pindah ke baris skrip di panel itu. */}
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
                !letakAlat && 'top-1/2')}>
              <Ruler className="size-3.5" />
            </button>
          ) : (
          <div onPointerDown={(e) => { bangunkanAlat(); mulaiSeretAlat(e); }}
               onPointerEnter={bangunkanAlat}
               ref={(el) => { alatRef.current = el; }}
               style={gayaAlat}
               className={cn('absolute z-20 flex cursor-move touch-none flex-col items-center gap-0.5 rounded-lg border border-zinc-800/80 bg-zinc-950/85 p-1 backdrop-blur-sm transition-transform duration-300',
                 !letakAlat && 'top-1/2')}>
            {/* Pegangan seret di ujung ATAS — memberi tahu bilahnya bisa
                dipindah tanpa perlu dicoba dulu. GripHorizontal, bukan
                Vertical: titik-titiknya harus melintang terhadap arah
                bilahnya supaya terbaca sebagai pegangan, bukan sebagai
                tombol keempat yang kebetulan bergaris. */}
            <GripHorizontal className="size-3.5 shrink-0 text-zinc-700" />
            {/* ── KENAPA JIPLAK TIDAK ADA DI SINI LAGI ──────────────────
                Dulu tombolnya duduk di bilah ini, digerbangi `pemilik`.
                Gerbangnya benar, tapi tempatnya salah: bilah alat gambar
                adalah perkakas trading yang dipakai SEMUA pengguna, dan
                menaruh pintu ke arsip pribadi di tengahnya berarti satu
                gerbang yang keliru — satu kali salah membaca peran, satu
                kali render sebelum peran terbaca — memamerkan sesuatu yang
                tidak boleh terlihat.

                Sekarang jalan masuknya cuma satu: daftar arsip di ruang
                analis, yang menautkan `?jiplak=<id>` dan sudah digerbangi
                di sisi server. Jalan keluarnya ikut pindah, ke tombol ✕ di
                gambar acuannya sendiri. */}
            {([
              ['garis', TrendingUp, 'Garis tren — tarik dari titik ke titik', ''],
              /* Garis harga: sekali klik, bukan tarikan. Ditaruh tepat di
                 bawah garis tren karena keduanya sama-sama "garis" bagi yang
                 mencarinya — yang membedakan cuma satu miring, satu mendatar
                 menancap di harga. */
              ['rayH', MoveRight, 'Garis harga — klik sekali di level yang mau ditandai, menjulur ke kanan', 'text-amber-400'],
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
                  catatRiwayat();
                  setGambarAlat((d) => {
                    const b = d.filter((g) => g.id !== gambarPilih);
                    simpanAlat(simbol, b);
                    return b;
                  });
                  setGambarPilih(null);
                  return;
                }
                if (!gambarAlat.length) return;
                if (!confirm(`Hapus ${gambarAlat.length} gambar di ${simbol}? Berlaku di semua timeframe.`)) return;
                /* Justru yang PALING perlu bisa diurung: satu klik keliru di
                   sini menghapus seluruh gambar di simbol ini sekaligus. */
                catatRiwayat();
                setGambarAlat([]);
                simpanAlat(simbol, []);
              }}
              disabled={!gambarAlat.length && !gambarPilih}
              title={gambarPilih ? 'Hapus gambar terpilih (Delete)' : 'Hapus semua gambar di simbol ini (semua timeframe)'}
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
            {/* GERIGI PINDAH KE UJUNG KANAN, berjejer dengan ikon multi —
                lihat kelompok ikon di bawah. Dulu ia sendirian di pojok kiri,
                terpisah sejauh lebar chart dari satu-satunya sakelar lain di
                baris ini; dua kendali sejenis yang dipakai bergantian tidak
                punya alasan duduk di ujung yang berlawanan. */}
            <span className="flex min-w-0 items-center gap-2 truncate">
              {hasil?.trade.length ? (
                <span className="truncate">{hasil.trade.length} penanda trade</span>
              ) : null}
            </span>

            {/* ── Kelompok ikon: multi-chart lalu gerigi ─────────────────
                Posisinya DIUKUR, bukan dikira-kira, dan inilah percobaan
                keempat — tiga yang pertama menggeser dengan angka yang
                kelihatan masuk akal di kode lalu meleset di layar.

                Kelompok ini lebarnya 50 px: ikon 22 + celah 6 + ikon 22.
                Hamparan induknya membentang x 266-1494, y 807-845.

                  · Datar — celah antara tulisan "Backtest" dan lencana
                    "beta" di baris bawah membentang x 1437-1443, berpusat
                    di 1440. Supaya celah ANTAR-IKON jatuh tepat di sana,
                    tepi kanan kelompok harus di 1465 -> right 29 px.

                  · Tegak — bottom 12 px (bottom-3). Semula 24 px, yang
                    menaruh ikon tepat di pusat baris label sumbu waktu
                    (y 796-824, pusat 810). Pemilik minta diturunkan
                    setengahnya: 24 -> 12, jadi pusatnya turun ke 822 dan
                    ikonnya duduk di tepi bawah baris sumbu, bukan di
                    tengahnya. Masih 12 px di atas baris Backtest yang
                    mulai di y 845, jadi keduanya tidak bersinggungan.

                Hasilnya: celah antar-ikon tepat segaris dengan celah
                "Backtest beta" di bawahnya, dan keduanya duduk di petak
                1410-1480 x 796-824 -- sudut kosong tempat sumbu waktu
                bertemu sumbu harga, satu-satunya bagian kaki chart yang
                tidak pernah berisi angka.

                ABSOLUTE, bukan transform, dan sama sekali bukan margin.
                Ketiganya sempat dicoba:

                  · Margin menambah tinggi SELURUH baris flex, dan baris
                    yang berjangkar ke dasar tumbuh ke atas -- membawa
                    serta tetangga yang tidak diminta pindah. Itu yang
                    dulu menyeret gerigi ikut naik.

                  · Transform memang cuma menggeser gambarnya, TAPI ia
                    membuat kotak penampung baru untuk keturunan
                    `position: fixed`. Lapisan penutup panel gerigi di
                    dalam sini `fixed inset-0` -- di bawah leluhur
                    ber-transform ia menciut jadi 50x22 px, dan klik di
                    luar panel berhenti menutupnya.

                Absolute tidak punya dua cacat itu: tidak menyentuh tinggi
                baris, tidak membuat kotak penampung untuk fixed. `bottom`
                diukur dari tepi bawah hamparan yang berjangkar `bottom-0`,
                jadi angkanya tidak ikut berubah saat isi baris kosong. */}
            <div className="pointer-events-auto absolute bottom-3 right-[29px] flex items-center gap-1.5">
              {!POLOS && (
                <button onClick={() => nyalakanMulti(simbol, tf)}
                  title="Multi-chart — bagi layar jadi beberapa panel chart"
                  aria-label="Multi-chart"
                  className="flex cursor-pointer items-center rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300">
                  <LayoutGrid className="size-3.5" strokeWidth={2} />
                </button>
              )}
              {/* Tanpa latar gelap, sama seperti gerigi. Latar itu dulu perlu
                  saat ikonnya melayang di atas lilin; di petak kosong sudut
                  sumbu ia hanya jadi kotak yang tidak menutupi apa-apa. */}
              <div className="relative">
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
                  {/* Terbuka ke ATAS dan ke KIRI. Dulu left-0, dari waktu
                      gerigi masih di pojok kiri; dari tempatnya yang baru di
                      x~1443, panel selebar 288 px yang berjangkar ke kiri
                      berakhir di 1731 -- jauh di luar layar 1500 px. */}
                  <div className="absolute bottom-full right-0 z-40 mb-1 w-72 rounded-lg border border-zinc-800 bg-zinc-950 p-1.5 text-left shadow-2xl">
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

                    {/* -- Outline lilin -------------------------------------
                        Dua baris sendiri, bukan dua petak lagi di grid warna
                        di atas. Petak di grid itu `<input type="color">`
                        polos yang tidak bisa menyimpan null, sementara
                        outline justru BAWAANNYA null: ikut warna badan,
                        persis tampilan sebelum setelan ini ada.

                        Bentuknya sengaja disamakan dengan baris "Latar
                        chart" di bawah -- keduanya punya persoalan yang
                        sama (warna + satu keadaan "otomatis"), jadi
                        keduanya layak dibaca dengan cara yang sama. */}
                    <div className="mt-1 border-t border-zinc-800/70 px-2 pb-1.5 pt-1.5">
                      <span className="block text-[11.5px] text-zinc-200">Outline lilin</span>
                      {([['garisNaik', 'naik', 'naik'], ['garisTurun', 'turun', 'turun']] as const).map(([kunci, badan, label]) => (
                        <div key={kunci} className="mt-1.5 flex items-center gap-2">
                          {/* Petaknya menunjukkan warna BADAN saat sedang ikut
                              badan -- itu memang warna yang tampak di layar
                              sekarang. Menaruh hitam di sini akan menyarankan
                              outline hitam yang tidak dipakai di mana pun. */}
                          <input type="color" value={tampilan[kunci] ?? tampilan[badan]}
                                 aria-label={`Warna outline lilin ${label}`}
                                 onChange={(e) => setTampilan((t) => ({ ...t, [kunci]: e.target.value }))}
                                 className="size-5 shrink-0 cursor-pointer rounded border border-zinc-700 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0" />
                          <span className="min-w-0 grow">
                            <span className="block text-[11.5px] capitalize text-zinc-200">{label}</span>
                            <span className="block font-mono text-[10px] uppercase text-zinc-600">{tampilan[kunci] ?? 'ikut badan'}</span>
                          </span>
                          <button onClick={() => setTampilan((t) => ({ ...t, [kunci]: null }))} disabled={tampilan[kunci] === null}
                            className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-default disabled:text-zinc-700 disabled:hover:bg-transparent">
                            Ikut badan
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* -- Garis bantu ---------------------------------------
                        Sakelar, bukan pemilih warna. Warnanya sudah ikut tema
                        dan sudah benar di terang maupun gelap; yang orang
                        minta bukan warna lain, melainkan chart yang bersih. */}
                    <div className="mt-1 border-t border-zinc-800/70 px-2 pb-1.5 pt-1.5">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={tampilan.kisi}
                               onChange={(e) => setTampilan((t) => ({ ...t, kisi: e.target.checked }))}
                               className="size-3.5 shrink-0 cursor-pointer accent-emerald-500" />
                        <span className="min-w-0 grow">
                          <span className="block text-[11.5px] text-zinc-200">Garis bantu</span>
                          <span className="block text-[10px] text-zinc-600">
                            {tampilan.kisi ? 'Kisi vertikal & horizontal tampil' : 'Chart bersih tanpa kisi'}
                          </span>
                        </span>
                      </label>
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
            </div>
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
              <PanelPosisiTerbuka sumber="kripto" onSunting={bukaSunting} onTutup={tutupDariTabel} onUbahSlTp={ubahDariTabel} onBanding={bukaBandingSalin} tanpaBingkai={POLOS} menyatu />
              <PanelPosisiTerbuka sumber="forex" onSunting={bukaSunting} onTutup={tutupDariTabel} onUbahSlTp={ubahDariTabel} tanpaBingkai={POLOS} menyatu />
            </div>
          )}
        </>
      )}

      {/* Panel salin-satu untuk sinyal yang membuka halaman ini. Level yang
          dipakai adalah yang SEDANG tampil di rencana — kalau orangnya
          sempat menggeser garisnya, yang disalin ya rencananya sekarang,
          bukan angka lama dari alamat. */}
      {copySinyalBuka && sinyalAsal && (
        <PanelCopyTradeFi
          sinyalId={sinyalAsal}
          analisUid={kanalAsal || undefined}
          pasangan={simbol.replace(/^MT5:/i, '')}
          arah={cari.get('arah') === 'SELL' ? 'SELL' : 'BUY'}
          entry={Number(rencana.entry) || Number(cari.get('entry')) || 0}
          sl={Number(rencana.sl) || Number(cari.get('sl')) || 0}
          tp={Number(rencana.tp) || Number(cari.get('tp')) || 0}
          penulis={analisAsal || 'Analis'}
          tutup={() => setCopySinyalBuka(false)}
        />
      )}
    </div>
  );
}
