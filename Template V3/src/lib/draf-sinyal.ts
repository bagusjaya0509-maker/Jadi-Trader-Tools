/* ════════════════════════════════════════════════════════════════════════
   SERAH-TERIMA DRAF SINYAL — Chart & Entry → Copy Signal
   ════════════════════════════════════════════════════════════════════════
   Analis menyusun rencananya di Chart & Entry (di sanalah alat gambar,
   watchlist, indikator, dan data MT5 berada), lalu mengirimnya ke formulir
   Copy Signal beserta tangkapan layar chartnya sebagai sampul.

   KENAPA TIDAK LEWAT ALAMAT. Level bisa saja dititipkan di query string
   seperti arah sebaliknya (Copy Signal → Chart) — tapi sampulnya tidak:
   tangkapan layar JPEG ratusan kilobyte tidak muat di URL, dan memaksanya
   ke sana akan membuat alamat yang tidak bisa disalin, tidak bisa
   di-bookmark, dan ditolak sebagian peramban.

   KENAPA sessionStorage, BUKAN localStorage. Draf ini barang sekali pakai
   untuk satu perpindahan halaman. Di localStorage ia akan bertahan setelah
   peramban ditutup, dan orang yang membuka Copy Signal seminggu kemudian
   mendapati formulirnya terisi rencana lama yang sudah tidak berlaku —
   lengkap dengan sampul chart dari harga minggu lalu. sessionStorage mati
   bersama tabnya, persis seumur niat yang membuatnya.

   Draf DIHAPUS begitu dibaca. Kalau tidak, menyegarkan halaman Copy Signal
   akan mengisi ulang formulir yang barusan sengaja dikosongkan orangnya.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.drafSinyal';

export interface DrafSinyal {
  pasangan: string;
  tf: string;
  arah: 'BUY' | 'SELL';
  entry: number;
  sl: number;
  tp: number;
  /** Tangkapan layar chart sebagai data URL JPEG. Kosong bila pemotretnya
   *  gagal — formulirnya tetap terisi level, cuma tanpa sampul. */
  sampul: string;
  /** Ukuran posisi yang DIBEKUKAN tiket chart saat dibuka (risiko dolar
   *  dibagi jarak SL saat itu). Dibawa serta supaya angka dolar di formulir
   *  Copy Signal sama persis dengan yang barusan terlihat di chart.
   *
   *  Tanpa ini keduanya memakai model berbeda: chart membekukan qty
   *  sehingga menggeser SL MENGUBAH dolarnya, sementara formulir memakai
   *  "1% dari $1.000" mati yang selalu −$10 berapa pun jarak SL-nya. Dua
   *  angka benar menurut modelnya masing-masing, dan tetap saja tidak
   *  cocok di layar yang sama. Kosong = disusun langsung di formulir,
   *  tanpa melewati chart. */
  qty?: number;
  waktu: number;
}

/** Umur maksimum draf. Rencana yang disusun dua jam lalu pada chart 5 menit
 *  sudah bukan rencana yang sama; membiarkannya terisi diam-diam lebih
 *  berbahaya daripada formulir kosong. */
const UMUR_MAKS_MS = 30 * 60 * 1000;

export function simpanDraf(d: Omit<DrafSinyal, 'waktu'>): boolean {
  try {
    sessionStorage.setItem(KUNCI, JSON.stringify({ ...d, waktu: Date.now() }));
    return true;
  } catch (e) {
    /* Kuota sessionStorage penuh — hampir selalu karena sampulnya besar.
       Dicoba ulang TANPA sampul: level yang sampai tanpa gambar jauh lebih
       berguna daripada kegagalan diam-diam yang membuat tombolnya terlihat
       rusak. */
    try {
      sessionStorage.setItem(KUNCI, JSON.stringify({ ...d, sampul: '', waktu: Date.now() }));
      return true;
    } catch (e2) { return false; }
  }
}

export function ambilDraf(): DrafSinyal | null {
  try {
    const t = sessionStorage.getItem(KUNCI);
    if (!t) return null;
    sessionStorage.removeItem(KUNCI);          // sekali pakai
    const d = JSON.parse(t) as DrafSinyal;
    if (!d || typeof d.entry !== 'number') return null;
    if (Date.now() - (d.waktu || 0) > UMUR_MAKS_MS) return null;
    return d;
  } catch (e) { return null; }
}
