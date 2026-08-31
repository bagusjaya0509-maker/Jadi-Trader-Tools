import { SUPERTREND_PINE } from '@/lib/pine';
import { MOMENTUM_CANDLE_PINE } from '@/lib/pine-momentum-candle';
import { SMI_PINE } from '@/lib/pine-smi';

/* ════════════════════════════════════════════════════════════════════════
   PASANG INDIKATOR DARI MARKETPLACE KE CHART
   ════════════════════════════════════════════════════════════════════════
   Marketplace menjual dua jenis barang yang sangat berbeda: EA MetaTrader,
   yang harus diunduh lalu dipasang di terminal sendiri, dan indikator Pine,
   yang sepenuhnya hidup di dalam aplikasi ini. Yang kedua tidak punya alasan
   untuk menyuruh orang menyalin-tempel kode: aplikasinya sendiri yang
   menyimpan daftar skrip, jadi ia bisa memasangnya sendiri.

   Berkas ini menulis ke penyimpanan yang SAMA dengan dock Pine
   (`jt.pineDaftar`) — bukan penyimpanan kedua yang harus disamakan. Dua
   daftar skrip yang seharusnya sama adalah dua daftar yang cepat atau
   lambat berbeda, dan yang berbeda di sini adalah indikator mana yang
   sebenarnya tergambar di chart.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI_DAFTAR = 'jt.pineDaftar';

interface SkripTersimpan { id: string; nama: string; kode: string; aktif: boolean }

/** Indikator Pine yang bisa dipasang langsung, dipetakan dari id produk
 *  marketplace. Produk yang tidak ada di sini — EA MT5, misalnya — tidak
 *  menampilkan tombol pasang sama sekali; tombol yang ada tapi tidak
 *  melakukan apa-apa lebih buruk daripada tombol yang tidak ada. */
export const INDIKATOR_TERPASANG: Record<string, { nama: string; kode: string }> = {
  'supertrend-indikator': { nama: 'Supertrend', kode: SUPERTREND_PINE },
  'momentum-candle-setra': {
    nama: 'Momentum Candle Setra', kode: MOMENTUM_CANDLE_PINE,
  },
  'smi-indikator': {
    nama: 'Stochastic Momentum Index (SMI)', kode: SMI_PINE,
  },
};

/** Cocokkan produk katalog dengan indikator yang bisa dipasang.
 *
 *  DICOCOKKAN LEWAT ID **ATAU** NAMA, dan itu bukan kelonggaran malas.
 *  Katalog yang tayang hidup di Firestore dan disusun lewat halaman
 *  Maintenance — id-nya diketik orang, bukan ditulis di kode ini. Kalau
 *  cocoknya hanya lewat id, satu huruf berbeda saat mengetik membuat tombol
 *  pasangnya hilang tanpa satu pun galat yang menjelaskan kenapa.
 *
 *  Nama dinormalkan: huruf kecil, tanpa spasi dan tanda hubung. Jadi
 *  "Supertrend", "Super Trend", dan "super-trend" sama-sama kena. */
function normal(t: string): string {
  /* Tanda pisah PANJANG ikut dibuang, bukan cuma hubung biasa. Nama produk
     diketik di halaman Maintenance, dan judul yang rapi biasanya memakai
     em-dash — sementara yang mengetiknya cepat memakai hubung biasa. Dua
     tulisan yang dimaksudkan sama akan gagal cocok karena satu karakter
     yang bahkan tidak terlihat bedanya, dan gejalanya persis yang paling
     sulit dilacak: tombol Pasang tidak muncul, tanpa satu pun galat. */
  return t.toLowerCase().replace(/[\s_\-‐-―]+/g, '');
}

export function kunciIndikator(produk: { id: string; nama: string }): string | null {
  if (produk.id in INDIKATOR_TERPASANG) return produk.id;
  const n = normal(produk.nama);
  for (const [kunci, ind] of Object.entries(INDIKATOR_TERPASANG)) {
    if (normal(ind.nama) === n) return kunci;
  }
  return null;
}

export function bisaDipasang(produk: { id: string; nama: string }): boolean {
  return kunciIndikator(produk) !== null;
}

export type HasilPasang = 'baru' | 'diperbarui' | 'sudahAda' | 'gagal';

/** Pasang indikator ke daftar skrip Pine, lalu jadikan ia yang aktif.
 *
 *  Kalau namanya sudah ada, kodenya DIPERBARUI alih-alih ditambah sebagai
 *  salinan kedua. Dua skrip bernama sama di satu daftar memaksa orang menebak
 *  mana yang sedang tergambar, dan menebak salah berarti membaca chart yang
 *  bukan yang ia kira. */
export function pasangIndikator(produk: { id: string; nama: string }): HasilPasang {
  const kunci = kunciIndikator(produk);
  const ind = kunci ? INDIKATOR_TERPASANG[kunci] : undefined;
  if (!ind || !kunci) return 'gagal';
  return pasangKodePine(kunci, ind.nama, ind.kode);
}

/* ── PASANG KODE YANG DATANG DARI LUAR ──────────────────────────────────
   Indikator BERBAYAR tidak boleh ikut tertanam di berkas ini. Apa pun yang
   ada di sini ikut terkirim ke setiap pengunjung sebagai bagian dari bundel
   JavaScript — siapa pun bisa membukanya lewat devtools dan mengambil produk
   yang dijual $47 tanpa membayar sepeser pun. Paywall-nya jadi hiasan.

   Karena itu kode indikator berbayar tetap di server, di balik pemeriksaan
   lisensi, dan baru sampai ke sini SESUDAH servernya meloloskan kodenya.
   Fungsi ini yang memasangnya. */
export function pasangKodePine(kunci: string, nama: string, kode: string): HasilPasang {
  if (!kode || !kode.trim()) return 'gagal';
  try {
    const mentah = localStorage.getItem(KUNCI_DAFTAR);
    const daftar: SkripTersimpan[] = mentah ? JSON.parse(mentah) : [];
    if (!Array.isArray(daftar)) return 'gagal';

    const adaIdx = daftar.findIndex((s) => s && s.nama === nama);
    /* Semua skrip lain dinonaktifkan: dock Pine menggambar yang `aktif`, dan
       memasang indikator yang tidak langsung tampil terbaca sebagai
       pemasangan yang gagal. */
    const lain = daftar.map((s) => ({ ...s, aktif: false }));

    if (adaIdx >= 0) {
      const sama = daftar[adaIdx].kode === kode;
      lain[adaIdx] = { ...lain[adaIdx], kode, aktif: true };
      localStorage.setItem(KUNCI_DAFTAR, JSON.stringify(lain));
      tandaiBerubah();
      return sama ? 'sudahAda' : 'diperbarui';
    }

    lain.push({ id: 'pasar-' + kunci, nama, kode, aktif: true });
    localStorage.setItem(KUNCI_DAFTAR, JSON.stringify(lain));
    tandaiBerubah();
    return 'baru';
  } catch {
    /* localStorage ditolak (mode privat). Tidak ada tempat menyimpan, jadi
       tidak ada yang bisa dijanjikan. */
    return 'gagal';
  }
}

/* Halaman Chart mungkin sedang terbuka di tab lain. Event `storage` hanya
   menyala di tab LAIN, tidak di tab yang menulis — jadi kalau nanti dock
   Pine perlu menyegarkan dirinya di tab yang sama, sinyalnya harus dikirim
   sendiri. Disiarkan sekarang supaya penerimanya bisa ditambahkan tanpa
   menyentuh berkas ini lagi. */
function tandaiBerubah() {
  try { window.dispatchEvent(new CustomEvent('jt:pine-daftar-berubah')); } catch { /* nonaktif */ }
}
