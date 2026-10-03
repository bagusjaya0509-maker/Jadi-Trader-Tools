/* ════════════════════════════════════════════════════════════════════════
   DATA CONTOH
   ════════════════════════════════════════════════════════════════════════
   Semua angka di prototipe ini datang dari SATU berkas, supaya tidak ada dua
   layar yang menampilkan saldo berbeda untuk hal yang sama.

   Saldo awalnya ($359) diambil dari data aslimu, dan besaran tiap transaksi
   sengaja tidak bulat. Alasannya bukan kerapian: layout yang hanya pernah
   diuji dengan "$1.000,00" akan patah begitu bertemu "$0,0006404" atau
   "−$305,46", dan itu baru ketahuan setelah tersambung data nyata.

   Riwayatnya sendiri DIBANGKITKAN — setahun penuh, lihat `buatRiwayat`.

   TIDAK ADA jaringan di sini. Tidak ada Firebase, tidak ada Binance, tidak
   ada VPS — sesuai permintaan, ini murni tampilan.
   ════════════════════════════════════════════════════════════════════════ */

/* Impor TIPE saja — dihapus seluruhnya saat kompilasi, jadi berkas ini
   tetap daun tanpa satu pun ketergantungan runtime. Itu yang membuatnya
   aman diimpor lib/data.ts tanpa membuat lingkaran impor. */
import type { OrderBursa } from '@/lib/admin';

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
  /** Hasil latihan replay — tampil di riwayat, tapi tidak ikut statistik. */
  latihan?: boolean;
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
  venue: 'Binance Live' | 'Hyperliquid' | 'Simulasi' | 'MT5';
  buka: number;
  /** Ukuran posisi dalam koin. Hanya terisi kalau datanya dari bursa —
   *  `public/posisiTerbuka` sengaja TIDAK menyiarkannya karena ukuran posisi
   *  membocorkan besar akun. */
  jumlah?: number;
  /** PnL berjalan dalam USD, langsung dari bursa. */
  pnlFloat?: number;
  /** Funding yang sudah dibayar (negatif) atau diterima (positif) sejak
   *  posisi ini dibuka. null = tidak bisa dipastikan, undefined = belum
   *  dijawab. Keterangan lengkapnya di PosisiBursa.funding. */
  funding?: number | null;
}

/** Bursa tujuan PERINTAH untuk sebuah posisi — ditentukan oleh posisinya
 *  sendiri, bukan oleh pasar yang kebetulan sedang digambar chart.
 *
 *  ── KENAPA INI ADA ────────────────────────────────────────────────────
 *  Tombol Tutup dulu menurunkan bursanya dari `bacaPasar(simbol)` — pasar
 *  yang dipakai proxy MENGGAMBAR LILIN simbol itu. Untuk koin yang cuma ada
 *  di satu bursa jawabannya kebetulan selalu benar, dan itu yang membuatnya
 *  bertahan lama: CASHCAT, koin yang jadi alasan jalur Hyperliquid dibangun,
 *  memang tidak ada di Binance.
 *
 *  ASTER ada di keduanya. Posisinya dibuka di Hyperliquid, chartnya digambar
 *  dari Binance, jadi perintah tutupnya dikirim — dengan yakin, lewat medan
 *  `bursa` yang tegas — ke bursa yang tidak punya posisi itu. Dilaporkan
 *  pemilik 5 Sep 2026: "nyoba tutup ASTER yang pakai Hyperliquid tapi kok
 *  ga mau ketutup".
 *
 *  Yang tahu jawabannya sudah ada sejak awal: `venue`, dibaca dari jawaban
 *  bursa dan ditampilkan di barisnya sendiri. Ia cuma tidak pernah ikut
 *  sampai ke perintahnya.
 *
 *  `null` untuk Simulasi & MT5 — keduanya bukan bursa kripto, dan menebak
 *  salah satunya untuk mereka lebih buruk daripada diam. */
export function bursaPosisi(venue: Posisi['venue']): 'binance' | 'hyperliquid' | null {
  if (venue === 'Hyperliquid') return 'hyperliquid';
  if (venue === 'Binance Live') return 'binance';
  return null;
}

const HARI = 86_400_000;
const JAM = 3_600_000;
const MENIT = 60_000;
const skrg = Date.now();

/* ── Riwayat: SATU TAHUN PENUH, sampai jam ini ────────────────────────────
   Diminta pemilik 3 Okt 2026: "data mode preview di dashboard, journal dan
   personal area itu datanya di setiap panelnya berisi lengkap selama 1
   tahun penuh". Yang dilihatnya sebelum itu: kalender bulan berjalan
   kosong, Pola Emosi kosong, winrate 82% di sebelah P/L minus, dan saldo
   kripto negatif.

   Dua sebabnya, dan dua-duanya di sini:

   · Contoh lama cuma 123 transaksi dalam dua bulan terakhir, dan sengaja
     dirancang RUGI (meniru angka akun pemilik waktu itu).
   · Mode preview lalu menimpanya dengan 150 transaksi ASLI pemilik dari
     public/ringkasanAkun — dua minggu terakhir, tanpa emosi, tanpa setup,
     tanpa setoran. Statistik yang dihitung dari potongan 150 baris sebuah
     akun berisi ribuan baris tidak menggambarkan akun mana pun.

   Sekarang contohnya dibangkitkan: 12 bulan penuh ditambah bulan berjalan,
   tiap hari, dua jurnal. TIDAK ADA jaringan — satu-satunya masukan dari
   luar adalah jam.

   ── DETERMINISTIK PER TANGGAL KALENDER ────────────────────────────────
   Benih acaknya tanggal itu sendiri (20261003), bukan urutan hari sejak
   awal. Jadi 14 Maret selalu berisi transaksi yang sama, siapa pun yang
   membuka dan kapan pun: menyegarkan halaman tidak mengubah apa pun, dan
   besok yang bertambah cuma hari barunya. Transaksi hari ini muncul satu
   per satu mengikuti jam — contoh yang sudah memuat transaksi pukul 21.00
   padahal baru pukul 10.00 ketahuan karangan dalam sekali lihat.

   ── BUKAN AKUN YANG MENANG TERUS ──────────────────────────────────────
   `SUASANA_*` membuat beberapa bulan merah (dan bulannya berbeda untuk
   Trade-Fi dan Kripto, supaya dua jurnalnya tidak kembar). Emosi ikut
   menentukan hasil lewat `WATAK`: FOMO, serakah, dan balas dendam lebih
   sering kalah DAN kalahnya lebih besar. Itu yang membuat panel Pola Emosi
   dan Evaluasi punya sesuatu untuk dikatakan — jurnal yang isinya
   kemenangan semua tidak memperlihatkan gunanya jurnal.

   ── ID-NYA `s-…`, BUKAN `fx-…`/`cr-…` ─────────────────────────────────
   Transaksi hasil migrasi V2 milik pemilik memakai id `fx-12`, `cr-40`.
   Contoh lama memakai id yang sama persis; yang baru sengaja tidak, supaya
   tidak ada satu jalur pun — sunting, impor, hapus — tempat sebuah baris
   contoh bisa menunjuk dokumen sungguhan. */

/** Acak berbenih (mulberry32): benih sama, deret sama.
 *  Diekspor karena catatan kas contoh (data/kas-contoh.ts) memakainya juga —
 *  dua pembangkit acak di dua berkas contoh pasti berselisih pelan-pelan. */
export function acakBerbenih(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Bobot<T> = readonly (readonly [T, number])[];

function pilihBerbobot<T>(r: () => number, daftar: Bobot<T>): T {
  let x = r() * daftar.reduce((s, d) => s + d[1], 0);
  for (const [nilai, bobot] of daftar) { x -= bobot; if (x < 0) return nilai; }
  return daftar[daftar.length - 1][0];
}

/* Geseran peluang menang per bulan kalender (indeks 0 = Januari). */
const SUASANA_FOREX  = [0.06, -0.12, 0.04, 0.07, -0.03, 0.00, 0.07, -0.14, 0.05, 0.04, 0.06, -0.06];
const SUASANA_KRIPTO = [-0.05, -0.06, 0.07, 0.02, 0.06, -0.11, 0.05, -0.04, -0.02, 0.05, 0.08, -0.08];

/* Kosakatanya SAMA dengan menu emosi di modal trade (EMOSI_MASUK) — contoh
   yang memakai kata lain akan memperlihatkan pilihan yang tidak bisa
   dipilih orangnya sendiri. */
interface Watak { p: number; rugi: number; untung: number; alasan?: string }
const WATAK: Record<string, Watak> = {
  'Tenang':       { p:  0.07, rugi: 0.95, untung: 1.10 },
  'Percaya Diri': { p:  0.03, rugi: 1.00, untung: 1.05 },
  'Netral':       { p:  0.00, rugi: 1.00, untung: 1.00 },
  'Ragu-ragu':    { p: -0.05, rugi: 1.00, untung: 0.70 },
  'FOMO':         { p: -0.15, rugi: 1.25, untung: 0.90, alasan: 'Kejar harga, tanpa retest' },
  'Serakah':      { p: -0.10, rugi: 1.40, untung: 1.15, alasan: 'Tambah posisi di luar rencana' },
  'Balas Dendam': { p: -0.20, rugi: 1.55, untung: 0.85, alasan: 'Masuk lagi setelah rugi' },
};
const EMOSI_BIASA: Bobot<string> = [
  ['Tenang', 34], ['Percaya Diri', 22], ['Netral', 14], ['Ragu-ragu', 12], ['FOMO', 11], ['Serakah', 7],
];
/* Di bulan yang berat orangnya lebih sering terpancing — dan itu yang
   membuat bulan merahnya merah, bukan sekadar sial. */
const EMOSI_BURUK: Bobot<string> = [
  ['Tenang', 22], ['Percaya Diri', 16], ['Netral', 12], ['Ragu-ragu', 16], ['FOMO', 20], ['Serakah', 14],
];

const JUMLAH_FOREX: Bobot<number> = [[0, 10], [1, 48], [2, 30], [3, 12]];
const JUMLAH_KRIPTO: Bobot<number> = [[0, 11], [1, 43], [2, 31], [3, 12], [4, 3]];

/* [nama, lot terkecil x100, lot terbesar x100] */
const PAIR_FOREX: Bobot<readonly [string, number, number]> = [
  [['XAUUSDc', 1, 2], 46], [['EURUSD', 2, 5], 20], [['GBPUSD', 2, 4], 14],
  [['USDJPY', 2, 5], 11], [['USDCAD', 2, 4], 5], [['GBPJPY', 1, 3], 4],
];
/* [nama, kira-kira harganya] — harga cuma dipakai menurunkan jumlah koin
   dari nilai order, supaya kolom ukuran tidak berisi angka mustahil. */
const PAIR_KRIPTO: Bobot<readonly [string, number]> = [
  [['BTCUSDT', 84570], 26], [['ETHUSDT', 2677], 19], [['SOLUSDT', 119.4], 16],
  [['XRPUSDT', 1.489], 8], [['BNBUSDT', 767], 7], [['DOGEUSDT', 0.0931], 7],
  [['LINKUSDT', 13.99], 6], [['SUIUSDT', 1.156], 5], [['ADAUSDT', 0.246], 4], [['XAUTUSDT', 4149], 2],
];
const LEVERAGE: Bobot<number> = [[5, 2], [10, 4], [20, 3], [25, 1]];

const SETUP_FOREX = [
  'Sentuh SNR H4', 'BOS Parallel Channel', 'Retest Supply H1', 'Retest Demand H1',
  'Breakout channel + retest', 'Momentum candle M15', 'Rilis berita AS',
];
/* Gap cuma ada sesudah pasar tutup akhir pekan. Setup "GAP awal pekan" di
   hari Rabu adalah jenis kesalahan yang langsung dikenali orang yang
   memang trading — dan sesudah itu ia tidak percaya baris lainnya. */
const SETUP_FOREX_SENIN = [...SETUP_FOREX, 'GAP awal pekan', 'GAP awal pekan'];
const SETUP_KRIPTO = [
  'SNR H4 + SMI oversold', 'SNR H4 + SMI overbought', 'Sinyal prioritas screener', 'BOS Parallel Channel',
  'Retest Demand 4H', 'Retest Supply 4H', 'Breakout bervolume', 'Copy sinyal analis',
];

/* Risiko per transaksi dalam dolar — kira-kira setengah persen dari akun
   contohnya. Dijaga kecil dengan sengaja: 900 transaksi setahun dengan
   risiko 2% per transaksi menghasilkan kurva yang tidak dipunyai siapa pun. */
const RISIKO_FOREX = 1.9;
const RISIKO_KRIPTO = 2.6;

function isiHari(out: Trade[], sumber: Sumber, d: Date) {
  const fx = sumber === 'forex';
  const th = d.getFullYear(), bl = d.getMonth(), tg = d.getDate();
  const cap = th * 10000 + (bl + 1) * 100 + tg;
  const r = acakBerbenih(cap * (fx ? 31 : 37) + (fx ? 7 : 11));
  const awalHari = new Date(th, bl, tg).getTime();
  const suasana = (fx ? SUASANA_FOREX : SUASANA_KRIPTO)[bl];
  const n = pilihBerbobot(r, fx ? JUMLAH_FOREX : JUMLAH_KRIPTO);

  /* Trade-Fi mulai di sesi London/New York (sore–malam WIB); kripto
     sepanjang hari. */
  let jam = fx ? 13.5 + r() * 2.5 : 7.5 + r() * 5;
  let rugiTadi = false, waktuTadi = 0;

  for (let i = 0; i < n; i++) {
    /* Balas dendam hanya bisa lahir sesudah rugi, dan masuknya cepat —
       beberapa menit sesudah yang rugi ditutup. Jarak itu yang dibaca panel
       Evaluasi ("masuk lagi <15 menit setelah rugi"), jadi emosi dan
       angkanya menceritakan hal yang sama. */
    const balas = rugiTadi && r() < 0.22;
    const emosi = balas ? 'Balas Dendam' : pilihBerbobot(r, suasana < -0.05 ? EMOSI_BURUK : EMOSI_BIASA);
    const w = WATAK[emosi];
    const waktu = Math.round(balas
      ? waktuTadi + (4 + r() * 9) * MENIT
      : awalHari + Math.min(jam, 23.4) * JAM + r() * 30 * MENIT);

    const risiko = (fx ? RISIKO_FOREX : RISIKO_KRIPTO) * (0.85 + r() * 0.3);
    const peluang = Math.min(0.88, Math.max(0.12, (fx ? 0.56 : 0.52) + suasana + w.p));
    const menang = r() < peluang;
    /* Tidak semua menang penuh dan tidak semua kalah penuh: sebagian
       ditutup lebih awal — untung tipis, atau rugi yang dipotong sebelum
       menyentuh stop. Tanpa itu semua kerugian nyaris seragam, dan
       jurnal sungguhan tidak pernah serapi itu. */
    const besar = menang
      ? risiko * (r() < 0.14 ? 0.2 + r() * 0.4 : 0.8 + r() * 1.1) * w.untung
      : risiko * (r() < 0.12 ? 0.25 + r() * 0.3 : 0.65 + r() * 0.6) * w.rugi;
    const pnl = Number((menang ? besar : -besar).toFixed(2));
    const arah = r() < (fx ? 0.5 : 0.56) ? 'BUY' : 'SELL';
    const setup = fx ? (d.getDay() === 1 ? SETUP_FOREX_SENIN : SETUP_FOREX) : SETUP_KRIPTO;
    const alasan = w.alasan && r() < 0.7 ? w.alasan : setup[Math.floor(r() * setup.length)];
    const id = `${fx ? 's-fx' : 's-cr'}-${cap}-${i}`;

    if (fx) {
      const [pair, lotMin, lotMaks] = pilihBerbobot(r, PAIR_FOREX);
      const lot = (lotMin + Math.floor(r() * (lotMaks - lotMin + 1))) / 100;
      out.push({ id, pair, arah, lot, pnl, waktu, sumber, emosi, alasan });
    } else {
      const [pair, harga] = pilihBerbobot(r, PAIR_KRIPTO);
      /* Nilai order diturunkan dari P/L-nya: hasil $4 dari gerak 1,3%
         berarti ordernya sekitar $300. Dibalik begini supaya kolom Size
         Order dan kolom P/L tidak pernah saling membantah. */
      const gerak = 0.006 + r() * 0.016;
      const nilaiOrder = Math.min(1500, Math.max(60, Math.round(Math.abs(pnl) / gerak / 10) * 10));
      const leverage = pilihBerbobot(r, LEVERAGE);
      const lot = Number((nilaiOrder / harga).toPrecision(3));
      out.push({ id, pair, arah, lot, pnl, waktu, sumber, emosi, alasan, nilaiOrder, leverage });
    }

    jam += 1.2 + r() * 2.6;
    rugiTadi = !menang;
    waktuTadi = waktu;
  }
}

/** Tanggal 1, dua belas bulan sebelum bulan berjalan. Dipakai pembangkit
 *  riwayat DAN setoran contoh — keduanya harus berangkat dari hari yang
 *  sama, kalau tidak setoran pertamanya jatuh sebelum transaksi pertama. */
function awalContoh(): number {
  const kini = new Date(skrg);
  return new Date(kini.getFullYear(), kini.getMonth() - 12, 1).getTime();
}

function buatRiwayat(): Trade[] {
  const out: Trade[] = [];
  for (let d = new Date(awalContoh()); d.getTime() <= skrg;
       d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    /* MetaTrader tutup Sabtu–Minggu; kripto tidak pernah tutup. */
    if (d.getDay() !== 0 && d.getDay() !== 6) isiHari(out, 'forex', d);
    isiHari(out, 'kripto', d);
  }
  /* Hari ini dibangkitkan utuh lalu dipotong di jam sekarang — bukan
     dibangkitkan sebagian — supaya transaksi pagi tidak berubah saat sore. */
  return out.filter((t) => t.waktu <= skrg).sort((a, b) => a.waktu - b.waktu);
}

export const RIWAYAT: Trade[] = buatRiwayat();

/* ── Setoran & penarikan CONTOH ──────────────────────────────────────────
   Tanpa ini jurnal kripto contoh bermodal $0: kurvanya "dari $0,00",
   lencana persennya tidak pernah tergambar, dan kotak Setoran & Penarikan
   kosong — tiga dari keluhan "angkanya seperti tidak lengkap".

   ── KENAPA DI SINI, BUKAN DI useArusKas ───────────────────────────────
   Pernah ditaruh di hook itu selama satu rilis, dan akibatnya saldo
   Dashboard naik $1.800 untuk SETIAP akun yang belum pernah mencatat
   setoran (catatannya masih ada di lib/tulis-jurnal.ts). Hook itu tidak
   tahu apakah riwayat yang sedang tampil contoh atau sungguhan.

   Yang tahu adalah `useRiwayat().contoh`, jadi pemasangannya di dua
   pembaca yang memegang bendera itu (lib/ringkasan.ts dan halaman Jurnal),
   dengan satu aturan: arus contoh HANYA menemani riwayat contoh. Begitu
   satu transaksi sungguhan masuk, keduanya lenyap bersama. */
export interface ArusContoh {
  id: string; sumber: Sumber; jenis: 'setor' | 'tarik';
  nilai: number; waktu: number; catatan: string;
}

export const ARUS_CONTOH: ArusContoh[] = ([
  { id: 'contoh-arus-1', sumber: 'kripto', jenis: 'setor', nilai: 500, hari: 0,   jam: 9,  catatan: 'Modal awal Binance Futures' },
  { id: 'contoh-arus-2', sumber: 'forex',  jenis: 'setor', nilai: 200, hari: 76,  jam: 10, catatan: 'Top up akun MT5' },
  { id: 'contoh-arus-3', sumber: 'kripto', jenis: 'setor', nilai: 250, hari: 141, jam: 20, catatan: 'Top up dari gaji' },
  { id: 'contoh-arus-4', sumber: 'forex',  jenis: 'tarik', nilai: 100, hari: 248, jam: 11, catatan: 'Tarik profit ke bank' },
  { id: 'contoh-arus-5', sumber: 'kripto', jenis: 'tarik', nilai: 120, hari: 305, jam: 19, catatan: 'Tarik profit' },
] as const).map(({ hari, jam, ...a }) => ({ ...a, waktu: awalContoh() + hari * HARI + jam * JAM }))
  .sort((a, b) => b.waktu - a.waktu);

/** Saldo MetaTrader contoh = saldo awal + setoran bersih + P/L jurnal
 *  Trade-Fi contoh.
 *
 *  DIHITUNG, bukan ditulis. Dulu `AKUN_MT5_CONTOH.saldo` angka mati
 *  ($528,39) di sebelah jurnal yang menghitung $358, dan kartunya menulis
 *  "Selisih broker vs jurnal +$169,66" — untuk akun yang dua angkanya
 *  sama-sama karangan. Sekarang keduanya satu bilangan. */
export const SALDO_FOREX_CONTOH = Number((
  SALDO_AWAL
  + ARUS_CONTOH.filter((a) => a.sumber === 'forex').reduce((s, a) => s + (a.jenis === 'setor' ? a.nilai : -a.nilai), 0)
  + RIWAYAT.filter((t) => t.sumber === 'forex').reduce((s, t) => s + t.pnl, 0)
).toFixed(2));

/* ── Posisi & order kripto untuk PENGUNJUNG ──────────────────────────────
   Dipakai `usePosisi()` saat tidak ada sesi sama sekali. Bukan hiasan:
   sebelum ini pengunjung melihat SATU posisi milik pemilik dari
   `public/posisiTerbuka` sementara panel Trade-Fi di sebelahnya sudah punya
   tiga posisi dan dua pending. Dua panel berdampingan yang isinya sepadan
   di kenyataan, tapi timpang di layar, terbaca sebagai fitur yang belum jadi.

   ANGKANYA SALING COCOK dan itu syarat, bukan kerapian: pnlFloat tiap baris
   = (hargaKini − entry) x jumlah (dibalik untuk SELL), jadi kolom Gerak,
   P/L, Risk SL, dan Target TP semuanya berangkat dari bilangan yang sama.
   Layar yang angkanya tidak berjumlah ketahuan karangan dalam sepuluh detik.

   Satu posisi MERAH disengaja. Tiga baris hijau bukan etalase, itu iklan —
   dan orang yang paham pasar langsung tahu angkanya disetel.

   Harganya diambil dari pasar 3 Okt 2026 (BTC 84,5 ribu, SOL 119). Contoh
   yang entry-nya BTC 64 ribu terbaca seperti tangkapan layar lama.

   `POSISI_TERBUKA` yang dulu ada di atas blok ini dibuang: satu-satunya
   pemakainya nilai awal `usePosisi`, dan nilai awal berisi contoh adalah
   cara contoh menyamar jadi posisi sungguhan — lihat catatan di sana. */
export const POSISI_KRIPTO_CONTOH: Posisi[] = [
  { id: 'c-btc',  simbol: 'BTCUSDT',  arah: 'BUY',  tf: '4H', entry: 83420.00, sl: 82300.00, tp: 86400.00, hargaKini: 84570.20, venue: 'Binance Live', buka: skrg - 5 * JAM,  jumlah: 0.006, pnlFloat: 6.90 },
  { id: 'c-sol',  simbol: 'SOLUSDT',  arah: 'BUY',  tf: '4H', entry: 116.2000, sl: 113.4000, tp: 124.8000, hargaKini: 119.3800, venue: 'Binance Live', buka: skrg - 19 * JAM, jumlah: 2.6,   pnlFloat: 8.27 },
  { id: 'c-link', simbol: 'LINKUSDT', arah: 'SELL', tf: '1H', entry: 13.8200,  sl: 14.1500,  tp: 13.1000,  hargaKini: 13.9880,  venue: 'Binance Live', buka: skrg - 2 * HARI, jumlah: 21,    pnlFloat: -3.53 },
];

/* Bentuknya `OrderBursa` — SAMA PERSIS dengan jawaban /api/open-orders,
   supaya panel tidak perlu tahu ini contoh dan tidak ada cabang tampilan
   kedua yang bisa berselisih dengan yang asli. */
export const PENDING_KRIPTO_CONTOH: OrderBursa[] = [
  { id: 'c-o1', simbol: 'ETHUSDT',  jenis: 'ENTRY', tipe: 'LIMIT', arah: 'BUY',  pemicu: 0, harga: 2610.00, qty: 0.12, algo: false, dibuat: skrg - 4 * JAM },
  { id: 'c-o2', simbol: 'AVAXUSDT', jenis: 'ENTRY', tipe: 'STOP',  arah: 'SELL', pemicu: 10.6000, harga: 10.6000, qty: 28, algo: true, dibuat: skrg - 13 * JAM },
];

/* SL/TP pending SENGAJA order tersendiri, bukan field pada order entry-nya.
   Begitulah Binance Futures bekerja — stop menempel pada SIMBOL — dan
   contoh yang menyederhanakannya akan membuat panel menampilkan bentuk yang
   tidak pernah ada di akun sungguhan. */
export const STOP_KRIPTO_CONTOH: OrderBursa[] = [
  { id: 'c-s1', simbol: 'ETHUSDT',  jenis: 'SL', tipe: 'STOP_MARKET',         arah: 'SELL', pemicu: 2548.00, harga: 0, qty: 0.12, algo: true, dibuat: skrg - 4 * JAM },
  { id: 'c-s2', simbol: 'ETHUSDT',  jenis: 'TP', tipe: 'TAKE_PROFIT_MARKET',  arah: 'SELL', pemicu: 2760.00, harga: 0, qty: 0.12, algo: true, dibuat: skrg - 4 * JAM },
  { id: 'c-s3', simbol: 'AVAXUSDT', jenis: 'SL', tipe: 'STOP_MARKET',         arah: 'BUY',  pemicu: 11.0500, harga: 0, qty: 28, algo: true, dibuat: skrg - 13 * JAM },
  { id: 'c-s4', simbol: 'AVAXUSDT', jenis: 'TP', tipe: 'TAKE_PROFIT_MARKET',  arah: 'BUY',  pemicu: 9.8000,  harga: 0, qty: 28, algo: true, dibuat: skrg - 13 * JAM },
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
  /** Harga sebelum potongan — ditampilkan tercoret di sebelah harga
   *  berlaku. Kosong berarti tidak ada potongan; angka yang lebih kecil
   *  atau sama dengan harga berlaku diabaikan, karena "diskon" yang tidak
   *  menurunkan apa pun adalah kebohongan kecil yang tidak perlu. */
  hargaAsal?: number;
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
  {
    /* id-nya WAJIB sama dengan kunci di INDIKATOR_TERPASANG — itulah yang
       menyambungkan kartu ini dengan kode yang dipasang ke chart. */
    id: 'supertrend-indikator', nama: 'Supertrend', versi: 'Pine v4 · overlay · semua timeframe',
    harga: 0, premium: false,
    ringkas: 'Supertrend berbasis ATR dengan pita naik-turun yang berganti warna saat tren berbalik — versi yang berjalan di mesin Pine aplikasi ini, bukan tempelan TradingView.',
    fitur: ['Periode ATR bisa diatur', 'Faktor pengali bebas', 'Pita hijau/merah mengikuti arah tren', 'Penanda titik balik'],
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
