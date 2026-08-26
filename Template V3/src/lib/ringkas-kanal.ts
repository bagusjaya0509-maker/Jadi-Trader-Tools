import type { RingkasAnalisa, PerformaAnalis } from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   RINGKASAN KANAL ANALIS — semuanya DITURUNKAN, tidak satu pun diklaim
   ════════════════════════════════════════════════════════════════════════
   Kartu analis di Copy Signal sekarang menyebut gaya trading dan tingkat
   risiko. Keduanya TIDAK BOLEH jadi isian yang diisi analisnya sendiri,
   dan itu bukan soal kerapian data.

   Papan ini dipakai orang memutuskan sinyal siapa yang ia tiru dengan uang
   sungguhan. Label "Low risk" yang diketik sendiri oleh yang mau ditiru
   adalah iklan, bukan keterangan — dan ia akan selalu berbunyi "low".
   Diturunkan dari sinyal yang sudah terjadi, angkanya tidak bisa dikarang
   siapa pun, termasuk pemilik.

   ── YANG TIDAK BISA DITURUNKAN, DIKATAKAN TIDAK BISA ────────────────────
   Jarak SL sebagai persen harga akan jadi ukuran risiko terbaik — tapi
   entry/SL/TP TERKUNCI di daftar publik (hanya terbuka setelah dibeli).
   Jadi risikonya diturunkan dari sebaran hasilnya: penurunan terdalam
   (drawdown) dari deret hasil harian, dihitung dalam SATUAN RISIKO.

   Dan kalau sampelnya masih tipis, ia menjawab "belum cukup data" — bukan
   menebak "rendah". Analis baru yang dilabeli rendah-risiko karena belum
   pernah rugi adalah kebohongan yang paling mahal di halaman ini.
   ════════════════════════════════════════════════════════════════════════ */

/** Di bawah ini sinyal terlalu sedikit untuk menyimpulkan apa pun. Lima
 *  bukan angka keramat — ia sekadar batas terendah yang membuat satu
 *  kekalahan tidak langsung memindahkan seseorang dari "rendah" ke
 *  "tinggi". */
const MIN_SAMPEL_RISIKO = 5;

export type GayaTrading = 'Scalping' | 'Intraday' | 'Swing' | null;
export type TingkatRisiko = 'Rendah' | 'Sedang' | 'Tinggi' | null;

export interface RingkasKanal {
  total: number;
  /** Berapa kali sinyal kanal ini disalin orang, dijumlah dari seluruh
   *  sinyalnya.
   *
   *  PENYALINAN, bukan kepala orang. Satu orang yang menyalin lima sinyal
   *  terhitung lima. Data pembedanya memang tidak ada di ringkasan, dan
   *  menyebutnya "orang" berarti mengarang angka yang tidak dimiliki —
   *  jadi labelnya di layar berbunyi "disalin", bukan "pengikut". */
  pengcopy: number;
  /** Sudah kena TP. */
  profit: number;
  /** Sudah kena SL. */
  rugi: number;
  /** Ditarik penulisnya sebelum harganya datang. Bukan menang, bukan kalah. */
  batal: number;
  /** Entry sudah tersentuh, hasilnya belum keluar. */
  berjalan: number;
  /** Order menggantung yang entry-nya belum tersentuh. */
  pending: number;
  /** Kapan pending TERBARU diposting — 0 kalau tidak ada yang menggantung. */
  pendingTerbaru: number;
  winrate: number | null;
  gaya: GayaTrading;
  risiko: TingkatRisiko;
  /** Jarak SL rata-rata (% harga) dari server, diteruskan apa adanya ke
   *  lencananya. null = belum terukur. */
  slPersen: number | null;
  /** Kalimat yang menjelaskan dari mana risikonya diturunkan, atau kenapa
   *  ia belum bisa disimpulkan. Dipakai sebagai title tooltip — label tanpa
   *  cara membacanya cuma stempel. */
  alasanRisiko: string;
}

/** Menit per timeframe. Dipakai memutuskan gaya trading — bukan dari nama
 *  yang diketik analis, melainkan dari timeframe chart yang ia analisa. */
function menitTf(tf: string): number | null {
  const t = (tf || '').trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/^(\d+)\s*(m|menit|min)?$/);
  if (m) return Number(m[1]);
  const jam = t.match(/^(\d+)\s*(h|j|jam|hour)$/);
  if (jam) return Number(jam[1]) * 60;
  if (/^(d|1d|daily|harian)$/.test(t)) return 1440;
  if (/^(w|1w|weekly|mingguan)$/.test(t)) return 10080;
  return null;
}

/** Penurunan terdalam dari deret hasil harian, dalam SATUAN RISIKO.
 *
 *  Satu satuan = uang yang dipertaruhkan per sinyal menurut model papan
 *  peringkat. Dinyatakan begitu supaya angkanya berarti sama untuk semua
 *  orang, berapa pun modal yang dipakai pembacanya. */
function drawdownSatuan(harian: Record<string, number>, risikoPerSinyal: number): number {
  if (!(risikoPerSinyal > 0)) return 0;
  const hari = Object.keys(harian || {}).sort();
  let puncak = 0, kumulatif = 0, terdalam = 0;
  for (const h of hari) {
    kumulatif += Number(harian[h]) || 0;
    puncak = Math.max(puncak, kumulatif);
    terdalam = Math.max(terdalam, puncak - kumulatif);
  }
  return terdalam / risikoPerSinyal;
}

export function ringkasKanal(
  sinyal: RingkasAnalisa[],
  perf: PerformaAnalis | null,
  risikoPerSinyal: number,
): RingkasKanal {
  const profit = sinyal.filter((s) => s.hasil === 'tp').length;
  const rugi = sinyal.filter((s) => s.hasil === 'sl').length;
  const batal = sinyal.filter((s) => s.hasil === 'batal').length;

  /* Menggantung vs berjalan dibedakan dari `terisi`, bukan dari jenis
     ordernya: Buy Limit yang harganya sudah tersentuh SUDAH jadi posisi,
     dan menghitungnya sebagai "pending" membuat layar menjanjikan peluang
     yang sebenarnya sudah lewat. */
  const belumSelesai = sinyal.filter((s) => !s.hasil);
  const pendingDaftar = belumSelesai.filter(
    (s) => !s.terisi && !!s.jenisEntry && !/^market$/i.test(s.jenisEntry));
  const berjalan = belumSelesai.length - pendingDaftar.length;

  const selesai = profit + rugi;
  const winrate = selesai > 0 ? (profit / selesai) * 100 : null;

  /* ── Gaya trading ──
     Dari timeframe yang PALING SERING ia analisa, bukan rata-rata: analis
     yang biasa di M5 dan sesekali di Daily tetap scalper, sementara
     rata-ratanya akan menyebutnya intraday. */
  const menit = sinyal.map((s) => menitTf(s.tf || '')).filter((n): n is number => n !== null);
  let gaya: GayaTrading = null;
  if (menit.length) {
    const hitung = new Map<number, number>();
    for (const m of menit) hitung.set(m, (hitung.get(m) ?? 0) + 1);
    const tersering = [...hitung.entries()].sort((a, b) => b[1] - a[1])[0][0];
    gaya = tersering <= 15 ? 'Scalping' : tersering <= 240 ? 'Intraday' : 'Swing';
  }

  /* ── Tingkat risiko ── */
  let risiko: TingkatRisiko = null;
  let alasanRisiko = '';
  if (!perf || selesai < MIN_SAMPEL_RISIKO) {
    alasanRisiko = `Belum cukup data — butuh minimal ${MIN_SAMPEL_RISIKO} sinyal selesai, `
      + `baru ${selesai}. Menebak tingkat risiko dari sampel setipis ini akan menyesatkan.`;
  } else {
    const dd = drawdownSatuan(perf.harian ?? {}, risikoPerSinyal);
    risiko = dd <= 2 ? 'Rendah' : dd <= 5 ? 'Sedang' : 'Tinggi';
    alasanRisiko = `Diturunkan dari penurunan terdalam rekam jejaknya: ${dd.toFixed(1)}× `
      + `risiko per sinyal, dari ${selesai} sinyal selesai. `
      + `≤2 rendah, ≤5 sedang, di atas itu tinggi.`;
  }

  return {
    total: sinyal.length, profit, rugi, batal, berjalan,
    pengcopy: sinyal.reduce((j, s) => j + (Number(s.jumlahPembeli) || 0), 0),
    pending: pendingDaftar.length,
    pendingTerbaru: pendingDaftar.reduce((t, s) => Math.max(t, s.dibuat || 0), 0),
    winrate, gaya, risiko, alasanRisiko,
    slPersen: perf && typeof perf.slPersen === 'number' ? perf.slPersen : null,
  };
}
