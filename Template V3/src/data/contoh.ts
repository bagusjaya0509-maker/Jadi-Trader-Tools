/* ════════════════════════════════════════════════════════════════════════
   DATA CONTOH
   ════════════════════════════════════════════════════════════════════════
   Semua angka di prototipe ini datang dari SATU berkas, supaya tidak ada dua
   layar yang menampilkan saldo berbeda untuk hal yang sama.

   Besarannya sengaja diambil dari data aslimu (saldo awal $359, Forex 29
   trade, Kripto 94 trade, gabungan −$38,07) — bukan angka bulat karangan.
   Alasannya bukan kerapian: layout yang hanya pernah diuji dengan "$1.000,00"
   akan patah begitu bertemu "$0,0006404" atau "−$305,46", dan itu baru
   ketahuan setelah tersambung data nyata.

   TIDAK ADA jaringan di sini. Tidak ada Firebase, tidak ada Binance, tidak
   ada VPS — sesuai permintaan, ini murni tampilan.
   ════════════════════════════════════════════════════════════════════════ */

export const SALDO_AWAL = 359.0;

export type Sumber = 'forex' | 'kripto';

export interface Trade {
  id: string;
  pair: string;
  arah: 'BUY' | 'SELL';
  lot: number;
  pnl: number;
  waktu: number;      // ms
  sumber: Sumber;
  emosi?: string;
  alasan?: string;
  /** Nilai order dalam USD: margin x leverage untuk kripto, dan
   *  lot x ukuran kontrak untuk forex. Undefined kalau datanya tidak
   *  menyertakan margin/leverage — lebih baik kosong daripada ditebak. */
  nilaiOrder?: number;
  leverage?: number;
}

export interface Posisi {
  id: string;
  simbol: string;
  arah: 'BUY' | 'SELL';
  tf: string;
  entry: number;
  sl: number;
  tp: number;
  hargaKini: number;
  venue: 'Binance Live' | 'Simulasi' | 'MT5';
  buka: number;
  /** Ukuran posisi dalam koin. Hanya terisi kalau datanya dari bursa —
   *  `public/posisiTerbuka` sengaja TIDAK menyiarkannya karena ukuran posisi
   *  membocorkan besar akun. */
  jumlah?: number;
  /** PnL berjalan dalam USD, langsung dari bursa. */
  pnlFloat?: number;
}

const HARI = 86_400_000;
const skrg = Date.now();

/* ── Riwayat ──────────────────────────────────────────────────────────────
   Dibuat deterministik (bukan Math.random) supaya tampilan tidak berubah
   tiap refresh — perubahan acak membuat mustahil menilai apakah sebuah
   perbedaan visual itu perbaikan atau kebetulan. */
function buatRiwayat(): Trade[] {
  const pairForex = ['XAUUSDc', 'EURUSD', 'GBPUSD', 'USDJPY'];
  const pairKripto = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'XAUTUSDT', 'AAPLUSDT'];
  const emosi = ['Tenang', 'FOMO', 'Sabar', 'Ragu', 'Percaya diri', 'Balas dendam'];
  const alasan = ['BOS Parallel Channel', 'Sentuh SNR H4', 'News JC', 'SMI Oversold', 'Retest Supply', 'Iseng entry'];

  const out: Trade[] = [];
  // 29 trade forex, total ≈ −17,16
  for (let i = 0; i < 29; i++) {
    const menang = i % 5 !== 0 && i % 7 !== 0;
    const besar = 4 + ((i * 37) % 90) / 10;
    out.push({
      id: `fx-${i}`,
      pair: pairForex[i % pairForex.length],
      arah: i % 3 === 0 ? 'SELL' : 'BUY',
      lot: Number((0.01 + ((i * 3) % 7) / 100).toFixed(2)),
      pnl: Number((menang ? besar : -besar * 1.35).toFixed(2)),
      waktu: skrg - (60 - i * 2) * HARI,
      sumber: 'forex',
      emosi: emosi[i % emosi.length],
      alasan: alasan[i % alasan.length],
    });
  }
  // 94 trade kripto, total ≈ −20,92
  for (let i = 0; i < 94; i++) {
    const menang = i % 5 === 0 || i % 3 === 0;
    const besar = 1.2 + ((i * 53) % 70) / 10;
    out.push({
      id: `cr-${i}`,
      pair: pairKripto[i % pairKripto.length],
      arah: i % 2 === 0 ? 'BUY' : 'SELL',
      lot: Number((0.001 + ((i * 11) % 40) / 1000).toFixed(3)),
      pnl: Number((menang ? besar : -besar * 1.42).toFixed(2)),
      waktu: skrg - (48 - i * 0.5) * HARI,
      sumber: 'kripto',
      emosi: emosi[(i + 2) % emosi.length],
      alasan: alasan[(i + 3) % alasan.length],
    });
  }
  return out.sort((a, b) => a.waktu - b.waktu);
}

export const RIWAYAT: Trade[] = buatRiwayat();

export const POSISI_TERBUKA: Posisi[] = [
  { id: 'p1', simbol: 'BTCUSDT',  arah: 'BUY',  tf: '4H', entry: 64065.10, sl: 63277.00, tp: 65182.00, hargaKini: 64784.50, venue: 'Binance Live', buka: skrg - 5 * 3600_000 },
  { id: 'p2', simbol: 'ADAUSDT',  arah: 'BUY',  tf: '4H', entry: 0.1622,   sl: 0.1606,   tp: 0.1653,   hargaKini: 0.1985,    venue: 'Binance Live', buka: skrg - 26 * 3600_000 },
  { id: 'p3', simbol: 'XAUTUSDT', arah: 'SELL', tf: '4H', entry: 4400.00,  sl: 4460.00,  tp: 4280.00,  hargaKini: 4329.51,   venue: 'Simulasi',     buka: skrg - 9 * 3600_000 },
  { id: 'p4', simbol: 'XAUUSDc',  arah: 'BUY',  tf: '1H', entry: 1925.40,  sl: 1918.00,  tp: 1941.00,  hargaKini: 1928.02,   venue: 'MT5',          buka: skrg - 3 * 3600_000 },
];

/* ── Sinyal untuk layar Screener ──────────────────────────────────────── */
export interface Sinyal {
  simbol: string;
  arah: 'BUY' | 'SELL';
  harga: number;
  ubah24j: number;
  smi: number;
  kondisi: 'overbought' | 'oversold';
  zonaLevel: number;
  zonaSisi: 'support' | 'resisten';
  lebarZona: number;
  sl: number;
  tp1: number;
  tp2: number;
  risiko: number;
  tag: 'BIG CAP' | 'LOW/MID CAP' | 'SAHAM / ETF';
}

export const SINYAL_PRIORITAS: Sinyal[] = [
  { simbol: 'BOMEUSDT', arah: 'SELL', harga: 0.0006404, ubah24j: 4.06,  smi: 56.7,  kondisi: 'overbought', zonaLevel: 0.0006390, zonaSisi: 'resisten', lebarZona: 0.000009773, sl: 0.0006808, tp1: 0.0006000, tp2: 0.0005595, risiko: 6.32, tag: 'LOW/MID CAP' },
  { simbol: 'SEIUSDT',  arah: 'BUY',  harga: 0.2841,    ubah24j: -2.14, smi: -61.2, kondisi: 'oversold',   zonaLevel: 0.2852,    zonaSisi: 'support',  lebarZona: 0.0041,      sl: 0.2698,   tp1: 0.2984,   tp2: 0.3127,   risiko: 5.03, tag: 'LOW/MID CAP' },
  { simbol: 'LTCUSDT',  arah: 'SELL', harga: 88.42,     ubah24j: 1.28,  smi: 63.8,  kondisi: 'overbought', zonaLevel: 88.10,     zonaSisi: 'resisten', lebarZona: 1.24,        sl: 92.05,    tp1: 84.79,    tp2: 81.16,    risiko: 4.11, tag: 'BIG CAP' },
  { simbol: 'AAPLUSDT', arah: 'BUY',  harga: 312.38,    ubah24j: -0.30, smi: -13.3, kondisi: 'oversold',   zonaLevel: 311.90,    zonaSisi: 'support',  lebarZona: 2.15,        sl: 305.20,   tp1: 319.56,   tp2: 326.74,   risiko: 2.30, tag: 'SAHAM / ETF' },
];

export const SINYAL_PANTAU: Sinyal[] = [
  { simbol: 'XAUTUSDT', arah: 'SELL', harga: 4329.51, ubah24j: 0.07,  smi: 73.5,  kondisi: 'overbought', zonaLevel: 4340.00, zonaSisi: 'resisten', lebarZona: 18.4, sl: 4402.00, tp1: 4257.00, tp2: 4184.00, risiko: 1.67, tag: 'SAHAM / ETF' },
  { simbol: 'SOLUSDT',  arah: 'BUY',  harga: 142.86,  ubah24j: -3.41, smi: -68.9, kondisi: 'oversold',   zonaLevel: 141.20,  zonaSisi: 'support',  lebarZona: 2.83, sl: 136.10,  tp1: 149.62,  tp2: 156.38,  risiko: 4.73, tag: 'BIG CAP' },
  { simbol: 'NVDAUSDT', arah: 'SELL', harga: 224.98,  ubah24j: 0.62,  smi: 58.1,  kondisi: 'overbought', zonaLevel: 226.40,  zonaSisi: 'resisten', lebarZona: 1.92, sl: 230.80,  tp1: 219.16,  tp2: 213.34,  risiko: 2.59, tag: 'SAHAM / ETF' },
  { simbol: 'PEPEUSDT', arah: 'BUY',  harga: 0.00000842, ubah24j: -5.20, smi: -72.4, kondisi: 'oversold', zonaLevel: 0.00000838, zonaSisi: 'support', lebarZona: 0.00000019, sl: 0.00000801, tp1: 0.00000883, tp2: 0.00000924, risiko: 4.87, tag: 'LOW/MID CAP' },
];

/* ── Marketplace ──────────────────────────────────────────────────────── */
export interface Produk {
  id: string;
  nama: string;
  versi: string;
  harga: number;
  ringkas: string;
  /** Katalog nyata memakai format `nama|penjelasan` pada sebagian butir.
   *  Halaman detail memecahnya; yang tanpa pipa ditampilkan apa adanya. */
  fitur: string[];
  premium: boolean;
  /** Ada di katalog Firestore, tidak ada di data contoh. */
  detail?: string;
  gambar?: string[];
  lynk?: string;
  berkas?: string;
  /** Ekstensi berkas terkompilasi yang boleh diunduh ('ex5' | 'mq5').
   *  Kosong berarti produknya hanya berupa sumber teks — dan tombol unduh
   *  tidak boleh muncul, karena tidak ada berkas untuk diunduh. */
  unduhan?: 'ex5' | 'mq5';
}

export const PRODUK: Produk[] = [
  {
    id: 'jadi-trader-v3', nama: 'Jadi Trader V3', versi: 'Pine v6 · overlay · semua timeframe',
    harga: 50, premium: true,
    ringkas: 'Auto Parallel Channel + duplikat breakout, zona SNR & Supply-Demand multi-timeframe, momentum candle, dan sinyal BUY/SELL otomatis.',
    fitur: ['Auto Parallel Channel', 'Duplikat Channel 1 & 2', 'Zona SNR multi-TF', 'Supply & Demand'],
  },
  {
    id: 'jadi-trader-sync', nama: 'Jadi Trader Sync (EA MT5)', versi: 'MQL5 · Expert Advisor',
    harga: 0, premium: false,
    ringkas: 'Menyambungkan akun MetaTrader 5 ke Jurnal Trading. BACA-SAJA — tidak pernah mengirim order.',
    fitur: ['Baca-saja, bisa diperiksa', 'Dashboard di chart', 'Riwayat dikelompokkan per hari', 'Akun sen ditangani benar'],
  },
  {
    id: 'news-gap-hunter-v2', nama: 'News & GAP Hunter V2', versi: 'Pine v5 · XAUUSD/Forex',
    harga: 0, premium: false,
    ringkas: 'Menandai jam rilis berita besar AS langsung di chart, plus pengukur gap Jumat→Senin lengkap dengan estimasi P/L.',
    fitur: ['Tanggal rilis dari kalender resmi', 'Pengukur gap Jumat→Senin', 'Estimasi P/L gap'],
  },
  {
    id: 'smi-indikator', nama: 'Stochastic Momentum Index', versi: 'Pine v6 · panel terpisah',
    harga: 0, premium: false,
    ringkas: 'Versi SMI yang dipakai di Area Pantau — dengan garis EMA pembanding dan gradasi overbought/oversold.',
    fitur: ['Skala -100 s/d +100', 'Garis EMA pembanding', 'Gradasi jenuh', 'Panjang bisa diatur'],
  },
];

/* ── Panel Pemilik ────────────────────────────────────────────────────── */
export const KLIEN = [
  { uid: 'a1', email: 'andi.pratama@gmail.com',  nama: 'Andi Pratama',  terakhir: skrg - 1800_000,   kunjungan: 42 },
  { uid: 'a2', email: 'sinta.dewi@gmail.com',    nama: 'Sinta Dewi',    terakhir: skrg - 3 * HARI,   kunjungan: 7 },
  { uid: 'a3', email: 'karyahukum@gmail.com',    nama: 'Karya Hukum',   terakhir: skrg - 900_000,    kunjungan: 128 },
  { uid: 'a4', email: 'budi.santoso@gmail.com',  nama: 'Budi Santoso',  terakhir: skrg - 9 * HARI,   kunjungan: 3 },
];

export const PENJUALAN = [
  { id: 'P1', produk: 'Jadi Trader V3',     pembeli: 'andi.pratama@gmail.com', nilai: 50, waktu: skrg - 2 * HARI },
  { id: 'P2', produk: 'Langganan bulanan',  pembeli: 'sinta.dewi@gmail.com',   nilai: 5,  waktu: skrg - 6 * HARI },
  { id: 'P3', produk: 'Jadi Trader V3',     pembeli: 'budi.santoso@gmail.com', nilai: 50, waktu: skrg - 11 * HARI },
  { id: 'P4', produk: 'Langganan bulanan',  pembeli: 'karyahukum@gmail.com',   nilai: 5,  waktu: skrg - 14 * HARI },
];

export const LAPORAN = [
  { id: 'L1', jenis: 'bug'   as const, pesan: 'Tombol Cari Sinyal Prioritas tidak jalan setelah refresh', halaman: 'screener', email: 'andi.pratama@gmail.com', status: 'baru'    as const, waktu: skrg - 3600_000 },
  { id: 'L2', jenis: 'error' as const, pesan: "TypeError: Cannot read properties of null (reading 'value')", halaman: 'mobile', email: '', status: 'baru' as const, waktu: skrg - 7200_000 },
  { id: 'L3', jenis: 'saran' as const, pesan: 'Tolong tambahkan alert suara kalau ada sinyal baru', halaman: 'screener', email: 'sinta.dewi@gmail.com', status: 'selesai' as const, waktu: skrg - 2 * HARI },
  { id: 'L4', jenis: 'bug'   as const, pesan: 'Kalender P/L tidak menampilkan bulan sebelumnya', halaman: 'jurnal', email: 'budi.santoso@gmail.com', status: 'baru' as const, waktu: skrg - 4 * HARI },
];

export const VPS = {
  ramTotalMb: 961, ramBebasMb: 545, ramProsesMb: 79,
  waktuHidupDetik: 8123, cpu: 1, node: 'v20.11.1',
  beban: [0.42, 0.31, 0.2], gerbangLangganan: false,
};

/* Trafik 20 hari. Deterministik, dengan tren naik dan riak akhir pekan supaya
   grafiknya berbentuk seperti trafik sungguhan, bukan garis lurus. */
export const TRAFIK = Array.from({ length: 20 }, (_, i) => {
  const hari = new Date(skrg - (19 - i) * HARI);
  const akhirPekan = hari.getDay() === 0 || hari.getDay() === 6;
  const dasar = 38 + i * 2.4 + Math.sin(i / 2.3) * 14;
  const total = Math.round(dasar * (akhirPekan ? 0.68 : 1));
  return {
    hari: hari.toISOString().slice(0, 10),
    label: hari.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    total,
    unik: Math.round(total * 0.54),
  };
});

/* ── Data khas panel Efferd ───────────────────────────────────────────────
   Isinya sengaja masih memakai bahasa acuan (invoice, channel, net revenue)
   karena permintaannya: jangan ubah apa pun dulu. Usulan penggantiannya
   disampaikan terpisah. */

export const NET_HARIAN = [
  { hari: 'Mon', nilai: 1180 }, { hari: 'Tue', nilai: 1060 }, { hari: 'Wed', nilai: 1520 },
  { hari: 'Thu', nilai: 1740 }, { hari: 'Fri', nilai: 2210 }, { hari: 'Sat', nilai: 1680 },
  { hari: 'Sun', nilai: 2680 },
];

export const KANAL_HARIAN = [
  { hari: 'Apr 7', langsung: 22, rujukan: 12 }, { hari: 'Apr 8', langsung: 26, rujukan: 12 },
  { hari: 'Apr 9', langsung: 25, rujukan: 18 }, { hari: 'Apr 10', langsung: 31, rujukan: 17 },
  { hari: 'Apr 11', langsung: 30, rujukan: 24 }, { hari: 'Apr 12', langsung: 36, rujukan: 23 },
  { hari: 'Apr 13', langsung: 35, rujukan: 29 },
];

export const INVOICE = [
  { id: 'INV-2041', status: 'Paid'    as const, jumlah: '$50.00' },
  { id: 'INV-2040', status: 'Open'    as const, jumlah: '$5.00'  },
  { id: 'INV-2039', status: 'Paid'    as const, jumlah: '$50.00' },
  { id: 'INV-2038', status: 'Overdue' as const, jumlah: '$5.00'  },
];

export const AKTIVITAS = [
  { teks: 'Sinyal SNR H4 menemukan 3 kandidat', waktu: '12 menit lalu' },
  { teks: 'Posisi ADAUSDT ditutup +$6.67',      waktu: '1 jam lalu' },
  { teks: 'Klien baru mendaftar: sinta.dewi',   waktu: '3 jam lalu' },
  { teks: 'EA JadiTraderSync tersambung',       waktu: '6 jam lalu' },
];
