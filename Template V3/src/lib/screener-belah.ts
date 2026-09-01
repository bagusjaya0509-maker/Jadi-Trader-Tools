/* ══════════════════════════════════════════════════════════════════════
   SERAH-TERIMA HASIL PINDAI SCREENER → PANEL KIRI CHART
   ══════════════════════════════════════════════════════════════════════
   Screener Area adalah bingkai berisi halaman V2 yang berdiri sendiri.
   Ia sudah lama bisa menyuruh induknya membuka satu simbol di Chart lewat
   `postMessage`. Yang belum: membawa SELURUH hasil pindainya, supaya
   halaman Chart bisa memasang daftar itu di panel kirinya dan orang bisa
   menelusuri koin satu per satu tanpa bolak-balik.

   ── KENAPA sessionStorage, BUKAN URL ─────────────────────────────────
   Hasil pindai bisa puluhan baris. Alamat halaman bukan tempat untuk itu:
   ada batas panjang yang berbeda-beda per peramban, dan alamat sepanjang
   itu tidak bisa dibaca, disalin, atau ditaut siapa pun.

   Bukan localStorage: daftar ini hasil satu kali pindai, bukan setelan.
   Membiarkannya bertahan melintasi sesi berarti orang yang membuka Chart
   besok pagi disambut daftar koin dari pemindaian kemarin sore — angka
   yang sudah basi tapi terlihat baru.

   ── SEMUANYA DIPERIKSA ULANG DI SINI ─────────────────────────────────
   Pengirimnya bingkai satu-asal, dan asalnya memang sudah diperiksa di
   ScreenerV2.tsx. Tapi "berasal dari asal yang benar" tidak sama dengan
   "isinya benar": bingkai itu memuat halaman lain yang punya sejarah,
   pemeliharaan, dan bug sendiri. Yang masuk ke layar Chart harus lolos
   bentuknya sendiri, bukan lolos karena pengirimnya dipercaya.
   ══════════════════════════════════════════════════════════════════════ */

export interface BarisScreener {
  simbol: string;
  tf: string;
  harga: number;
  ubah24: number;
  /** 'big' | 'low' — dari penanda kapitalisasi screener. */
  cap: string;
  /** Arah momentum kalau kartunya punya. */
  arah: 'BUY' | 'SELL' | '';
}

const KUNCI = 'jt.screenerBelah';

/* Timeframe yang dikenal Chart. Daftar tertutup, bukan sekadar "teks
   pendek": `tf` ikut ke alamat halaman dan dipakai memilih endpoint lilin,
   dan nilai asing di sana berubah jadi permintaan jaringan yang gagal
   dengan pesan yang tidak menjelaskan apa-apa. */
const TF_SAH = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w']);

/** Satu baris mentah → baris yang boleh dirender, atau null kalau tidak
 *  memenuhi bentuknya. Yang gagal DIBUANG diam-diam: satu baris cacat di
 *  tengah hasil pindai bukan alasan membatalkan seluruh daftarnya. */
function bersihkan(x: unknown): BarisScreener | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;

  const simbol = String(r.simbol ?? r.symbol ?? '').toUpperCase().trim();
  /* Bentuk simbol dikunci: huruf dan angka, 5–20 karakter. Ia masuk ke
     alamat halaman dan ke permintaan proxy. */
  if (!/^[A-Z0-9]{5,20}$/.test(simbol)) return null;

  const tf = String(r.tf ?? r.tfValue ?? '').trim();
  if (!TF_SAH.has(tf)) return null;

  const angka = (v: unknown) => {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  };

  const arah = r.arah === 'BUY' || r.arah === 'SELL' ? r.arah : '';

  return {
    simbol,
    tf,
    harga: angka(r.harga ?? r.price),
    ubah24: angka(r.ubah24 ?? r.change24h),
    cap: r.cap === 'big' ? 'big' : 'low',
    arah,
  };
}

/** Batas 60 baris. Panel kiri yang lebih panjang dari itu berhenti jadi
 *  daftar dan jadi gulungan — dan hasil pindai memang sudah diurutkan
 *  menurut kekuatan sinyalnya, jadi yang terpotong memang ekornya. */
const MAKS = 60;

export function simpanDaftarScreener(mentah: unknown): number {
  if (!Array.isArray(mentah)) return 0;
  const bersih: BarisScreener[] = [];
  for (const x of mentah) {
    const b = bersihkan(x);
    if (b) bersih.push(b);
    if (bersih.length >= MAKS) break;
  }
  try {
    if (bersih.length) sessionStorage.setItem(KUNCI, JSON.stringify(bersih));
    else sessionStorage.removeItem(KUNCI);
  } catch { /* mode privat — daftarnya hilang, chart tetap terbuka */ }
  return bersih.length;
}

export function bacaDaftarScreener(): BarisScreener[] {
  try {
    const s = sessionStorage.getItem(KUNCI);
    if (!s) return [];
    const d = JSON.parse(s);
    /* Diperiksa LAGI saat dibaca. Isi sessionStorage bisa disunting siapa
       saja yang membuka DevTools, dan yang menulisnya belum tentu versi
       kode yang sama dengan yang membacanya. */
    return Array.isArray(d) ? d.map(bersihkan).filter((x): x is BarisScreener => !!x) : [];
  } catch { return []; }
}

export function hapusDaftarScreener() {
  try { sessionStorage.removeItem(KUNCI); } catch { /* abaikan */ }
}
