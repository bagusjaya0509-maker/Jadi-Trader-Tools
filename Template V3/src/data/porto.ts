/* ══════════════════════════════════════════════════════════════════════════
   DATA TAMBAHAN — portofolio pribadi, laporan bulanan, backtest, testimoni
   ══════════════════════════════════════════════════════════════════════════
   Dipisah dari contoh.ts supaya berkas itu tetap terbaca. Semuanya masih
   data contoh: tidak ada jaringan, tidak ada Firebase, tidak ada Binance.
   ══════════════════════════════════════════════════════════════════════════ */

export type KategoriAset = 'Kripto' | 'Bank' | 'Sekuritas' | 'Emas' | 'E-Wallet' | 'Tunai';

export interface Aset {
  nama: string;
  nilai: number;              // rupiah
  kategori: KategoriAset;
  /** Simbol Binance kalau nilainya ikut harga pasar. Kosong = statis. */
  simbol?: string;
}

/* Angkanya diambil apa adanya dari lembar yang kamu kirim. Disimpan sebagai
   angka murni, bukan string berformat — supaya bisa dijumlah dan digambar;
   titik ribuan itu urusan tampilan, bukan urusan data. */
export const ASET: Aset[] = [
  { nama: 'Trust Wallet',      nilai: 25_650_000, kategori: 'Kripto',    simbol: 'ETHUSDT' },
  { nama: 'Metamask',          nilai:  8_568_000, kategori: 'Kripto',    simbol: 'ETHUSDT' },
  { nama: 'Emas Fisik',        nilai: 21_074_000, kategori: 'Emas',      simbol: 'XAUTUSDT' },
  { nama: 'Hyperliquid Dex',   nilai: 72_576_000, kategori: 'Kripto',    simbol: 'BTCUSDT' },
  { nama: 'Binance',           nilai:  5_076_000, kategori: 'Kripto',    simbol: 'BTCUSDT' },
  { nama: 'Bybit Kripto',      nilai:  4_050_000, kategori: 'Kripto',    simbol: 'BTCUSDT' },
  { nama: 'Bybit Trade-Fi',    nilai:          0, kategori: 'Sekuritas' },
  { nama: 'Exness',            nilai:  6_120_000, kategori: 'Sekuritas' },
  { nama: 'Mandiri Sekuritas', nilai: 23_400_000, kategori: 'Sekuritas' },
  { nama: 'Bank Mandiri',      nilai: 11_400_000, kategori: 'Bank' },
  { nama: 'Bank SMBC',         nilai:    137_000, kategori: 'Bank' },
  { nama: 'Sea Bank',          nilai:    111_000, kategori: 'Bank' },
  { nama: 'Bank Central Asia', nilai:     17_000, kategori: 'Bank' },
  { nama: 'Valas',             nilai:    472_200, kategori: 'Tunai' },
  { nama: 'Cash Fisik',        nilai:    900_000, kategori: 'Tunai' },
  { nama: 'Shopee',            nilai:    169_000, kategori: 'E-Wallet' },
  { nama: 'OVO',               nilai:    130_000, kategori: 'E-Wallet' },
  { nama: 'Gopay',             nilai:     78_000, kategori: 'E-Wallet' },
  { nama: 'Grabjob',           nilai:    290_000, kategori: 'E-Wallet' },
];

export const KEWAJIBAN = [
  { nama: 'Flexi Cash + bunga',     nilai:          0 },
  { nama: 'Kredit Mandiri + bunga', nilai: 68_534_000 },
  { nama: 'Sisa Uang Arisan',       nilai:    500_000 },
  { nama: 'Saldo Blokir',           nilai:  6_275_420 },
];

export const WARNA_KATEGORI: Record<KategoriAset, string> = {
  Kripto:     '#fafafa',
  Sekuritas:  '#a1a1aa',
  Emas:       '#ffcd75',
  Bank:       '#71717a',
  'E-Wallet': '#52525b',
  Tunai:      '#3f3f46',
};

/* Riwayat porto 12 bulan. Deterministik supaya grafiknya tidak berubah tiap
   refresh — angka yang bergeser sendiri membuat mustahil menilai apakah
   sebuah perbedaan visual itu perbaikan atau kebetulan. */
export const PORTO_BULANAN = [
  'Sep 25', 'Okt 25', 'Nov 25', 'Des 25', 'Jan 26', 'Feb 26',
  'Mar 26', 'Apr 26', 'Mei 26', 'Jun 26', 'Jul 26', 'Agu 26',
].map((bulan, i) => {
  const porto = 128_000_000 + i * 4_400_000 + Math.sin(i / 1.7) * 6_200_000;
  const masuk = 6_500_000 + Math.sin(i / 2.1) * 2_400_000;
  const keluar = 4_800_000 + Math.cos(i / 1.9) * 1_900_000;
  return {
    bulan,
    porto: Math.round(porto),
    masuk: Math.round(masuk),
    keluar: Math.round(keluar),
    bersih: Math.round(masuk - keluar),
  };
});

/** Saldo per tanggal — bulan lalu vs bulan ini (untuk panel perbandingan). */
export const SALDO_PER_TANGGAL = Array.from({ length: 30 }, (_, i) => ({
  tgl: String(i + 1),
  bulanLalu: Math.round(340 + Math.sin(i / 3.2) * 18 + i * 0.35),
  bulanIni: Math.round(352 + Math.sin(i / 2.7) * 22 + i * 0.62),
}));

/** Hasil trading per bulan — menggantikan "Net revenue" di Dashboard. */
export const TRADING_BULANAN = [
  { bulan: 'Mar', pnl: 42.18, trade: 14 },
  { bulan: 'Apr', pnl: -18.4, trade: 21 },
  { bulan: 'Mei', pnl: 31.06, trade: 18 },
  { bulan: 'Jun', pnl: -26.72, trade: 25 },
  { bulan: 'Jul', pnl: 12.94, trade: 19 },
  { bulan: 'Agu', pnl: -38.07, trade: 26 },
];

/** Order MT5 terbuka — menggantikan "Billing health" di Dashboard. */
export const POSISI_MT5 = [
  { tiket: '#48120344', pair: 'XAUUSDc', arah: 'BUY' as const, lot: 0.02, entry: 1925.4, kini: 1928.02, pnl: 5.24, sl: 1918.0, tp: 1941.0 },
  { tiket: '#48120351', pair: 'EURUSD', arah: 'SELL' as const, lot: 0.05, entry: 1.0842, kini: 1.0831, pnl: 5.5, sl: 1.0876, tp: 1.079 },
  { tiket: '#48120362', pair: 'GBPUSD', arah: 'BUY' as const, lot: 0.03, entry: 1.2714, kini: 1.2698, pnl: -4.8, sl: 1.266, tp: 1.279 },
];

export const TESTIMONI = [
  { nama: 'Andi Pratama', produk: 'Jadi Trader V3', bintang: 5, tgl: '2 hari lalu', isi: 'Channel-nya rapi, tidak berubah-ubah tiap refresh seperti indikator lain. Sinyal SNR H4 yang paling sering saya pakai.' },
  { nama: 'Sinta Dewi', produk: 'Jadi Trader Sync', bintang: 5, tgl: '5 hari lalu', isi: 'Jurnal saya akhirnya terisi sendiri. Dulu selalu bolong karena malas catat manual.' },
  { nama: 'Budi Santoso', produk: 'Jadi Trader V3', bintang: 4, tgl: '1 minggu lalu', isi: 'Bagus, tapi butuh waktu memahami logika duplikat channel-nya. Dokumentasinya bisa dilengkapi.' },
  { nama: 'Karya Hukum', produk: 'News & GAP Hunter', bintang: 5, tgl: '2 minggu lalu', isi: 'Tanggal rilis beritanya akurat, termasuk yang tertunda waktu shutdown kemarin.' },
];

/* ── Lilin untuk chart backtest ──────────────────────────────────────────
   Random-walk dengan seed TETAP. Kalau memakai Math.random, bentuk chart
   berubah tiap kali halaman dibuka dan hasil backtest jadi tidak mungkin
   dibandingkan antar percobaan. */
export interface Lilin { t: number; o: number; h: number; l: number; c: number; v: number }

export function buatLilin(jumlah = 160, awal = 64000): Lilin[] {
  let seed = 42;
  const acak = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const out: Lilin[] = [];
  let harga = awal;
  const mulai = Date.now() - jumlah * 4 * 3600_000;
  for (let i = 0; i < jumlah; i++) {
    const o = harga;
    const c = o * (1 + (acak() - 0.47) * 0.018);
    const rentang = Math.abs(c - o) + o * (0.002 + acak() * 0.006);
    out.push({
      t: mulai + i * 4 * 3600_000,
      o, c,
      h: Math.max(o, c) + rentang * acak() * 0.6,
      l: Math.min(o, c) - rentang * acak() * 0.6,
      v: Math.round(120 + acak() * 380),
    });
    harga = c;
  }
  return out;
}

export const HASIL_BACKTEST = {
  totalTrade: 64, menang: 37, kalah: 27,
  winrate: 57.8, profitFactor: 1.42,
  netPnl: 1284.6, maxDrawdown: -318.4,
  rerataMenang: 92.15, rerataKalah: -71.8,
  terpanjangMenang: 6, terpanjangKalah: 4,
};

export const KATA_HARI_INI = {
  isi: 'Pasar tidak membayar keberanian. Pasar membayar kesabaran yang punya rencana.',
  oleh: 'Bagus Jaya',
  tgl: 'Sabtu, 9 Agustus 2026',
};

/** Rupiah ringkas: 180.218.200 -> "Rp 180,2 jt". Dipakai di kartu KPI yang
 *  ruangnya sempit; tabel tetap memakai angka penuh supaya bisa dicocokkan. */
export function rupiahRingkas(n: number) {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const tanda = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${tanda}Rp ${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} m`;
  if (abs >= 1_000_000) return `${tanda}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  if (abs >= 1_000) return `${tanda}Rp ${Math.round(abs / 1_000)} rb`;
  return `${tanda}Rp ${abs}`;
}

export function rupiah(n: number) {
  if (!isFinite(n)) return '—';
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}
