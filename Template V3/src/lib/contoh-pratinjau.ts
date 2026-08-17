import type { StatusAkun, PosisiBroker, PendingBroker } from '@/lib/akun';
import type { Performa, PerformaAnalis } from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   DATA PRATINJAU — isi yang dilihat orang sebelum punya data sendiri
   ════════════════════════════════════════════════════════════════════════
   Dipakai di dua tempat yang sebenarnya satu: pengunjung yang sedang
   memakai pratinjau 24 jam, dan pengguna baru yang jurnalnya masih kosong.
   Keduanya menghadapi masalah yang sama — layar kosong tidak menjelaskan
   apa pun tentang alat yang sedang ditawarkan.

   ── SATU ATURAN YANG TIDAK BOLEH DILANGGAR ────────────────────────────
   Data ini harus SELALU bisa dikenali sebagai contoh. Bukan karena
   kerapian, melainkan karena satu jenis kebohongan yang mahal: kalau
   panel MT5 menampilkan saldo dan posisi tanpa penanda, orang akan
   mengira terminalnya SUDAH tersambung — lalu menutup MetaTrader dan
   mengira posisinya tetap terpantau. `terhubung: false` dan keterangan
   yang menyebut "contoh" bukan hiasan; itu bagian dari datanya.

   ── KENAPA ANGKANYA BEGINI ────────────────────────────────────────────
   Semuanya deterministik — tidak ada Math.random, tidak ada Date.now()
   yang membuat tampilan berbeda tiap muat. Perubahan acak membuat
   mustahil menilai apakah selisih visual itu perbaikan atau kebetulan.

   Angkanya dibuat menyerupai akun yang DIKELOLA, bukan akun yang menang
   terus: ada bulan merah, ada trade rugi beruntun, ada emosi "FOMO" yang
   berujung minus. Jurnal yang isinya kemenangan semua tidak
   memperlihatkan gunanya jurnal — justru baris rugi yang membuat orang
   mengerti kenapa alat ini ada.
   ════════════════════════════════════════════════════════════════════════ */

const JAM = 3_600_000;
const HARI = 86_400_000;

/* Jangkar waktu TETAP, bukan Date.now(). Semua "x jam lalu" dihitung
   mundur dari sini saat dipakai, jadi urutannya stabil sementara
   tampilan relatifnya tetap masuk akal. */
export const SEKARANG_CONTOH = Date.now();

/* ── Trade-Fi / MT5 ──────────────────────────────────────────────────────
   Panel "Order Terbuka — Trade-Fi" adalah yang paling sering kosong,
   karena ia butuh MetaTrader hidup DAN EA terpasang. Pengunjung yang
   belum punya keduanya melihat kotak kosong bertuliskan $0.00, dan itu
   satu-satunya kesan yang ia bawa tentang fitur Trade-Fi. */
const POSISI_MT5: PosisiBroker[] = [
  { tiket: '51884213', simbol: 'XAUUSDc', arah: 'BUY',  lot: 0.04, hargaBuka: 1921.35, hargaKini: 1928.02, sl: 1913.80, tp: 1939.50, profit: 26.68, waktuBuka: SEKARANG_CONTOH - 7 * JAM },
  { tiket: '51884190', simbol: 'EURUSD',  arah: 'SELL', lot: 0.10, hargaBuka: 1.08420, hargaKini: 1.08267, sl: 1.08760, tp: 1.07850, profit: 15.30, waktuBuka: SEKARANG_CONTOH - 19 * JAM },
  { tiket: '51883977', simbol: 'USDJPY',  arah: 'BUY',  lot: 0.06, hargaBuka: 147.220, hargaKini: 146.985, sl: 146.700, tp: 148.400, profit: -9.58, waktuBuka: SEKARANG_CONTOH - 2 * HARI },
];

const PENDING_MT5: PendingBroker[] = [
  { tiket: '51884402', simbol: 'XAUUSDc', jenis: 'SELL_LIMIT', arah: 'SELL', lot: 0.04, harga: 1942.00, sl: 1949.50, tp: 1926.00, waktu: SEKARANG_CONTOH - 3 * JAM },
  { tiket: '51884377', simbol: 'GBPUSD',  jenis: 'BUY_STOP',   arah: 'BUY',  lot: 0.08, harga: 1.27340, sl: 1.26900, tp: 1.28200, waktu: SEKARANG_CONTOH - 11 * JAM },
];

/** Akun MT5 contoh.
 *
 *  `terhubung: false` DISENGAJA dan tidak boleh diubah jadi true. Panel
 *  membaca bendera itu untuk memutuskan menampilkan lencana tersambung —
 *  dan lencana tersambung yang tidak benar adalah cara tercepat membuat
 *  orang menutup MetaTrader-nya sambil merasa aman. */
export const AKUN_MT5_CONTOH: StatusAkun = {
  terhubung: false,
  saldo: 528.39,
  ekuitas: 560.79,
  mataUang: 'USD',
  ket: 'Data contoh — sambungkan MetaTrader 5 untuk melihat akunmu',
  posisi: POSISI_MT5,
  pending: PENDING_MT5,
  versiEa: '2.07',
};

/* ── Copy Signal ─────────────────────────────────────────────────────────
   Papan peringkat kosong adalah masalah "hari pertama" yang klasik: ia
   baru berisi setelah ada sinyal yang benar-benar selesai kena SL/TP,
   dan sampai itu terjadi halamannya terlihat seperti fitur yang belum
   jadi. Contoh ini memperlihatkan bentuk akhirnya.

   Peringkatnya sengaja TIDAK seragam menang: yang teratas pun punya
   winrate 61%, dan ada analis yang minus. Papan peringkat yang semua
   isinya hijau bukan papan peringkat, itu iklan. */
/** Kalender harian deterministik untuk satu analis.
 *  Dibuat dari deret tetap, bukan acak — lihat alasan di kepala berkas. */
function harian(benih: number, hari: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < hari; i++) {
    const t = new Date(SEKARANG_CONTOH - i * HARI);
    const nilai = ((i * benih) % 17) - 7;          // -7..9, berulang
    if (nilai === 0) continue;                      // hari tanpa sinyal
    const kunci = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    out[kunci] = Number((nilai * 1.4).toFixed(2));
  }
  return out;
}

function analis(
  uid: string, nama: string, agen: boolean,
  menang: number, kalah: number, batal: number, hasilDolar: number, benih: number,
): PerformaAnalis {
  const total = menang + kalah;
  return {
    uid, nama, agen, menang, kalah, batal, total,
    winrate: total ? menang / total : 0,
    hasilDolar,
    terakhir: SEKARANG_CONTOH - benih * 3 * JAM,
    harian: harian(benih, 45),
  };
}

/** Papan peringkat contoh dalam bentuk `Performa` yang SAMA PERSIS dengan
 *  jawaban backend — jadi layarnya tidak perlu tahu ini contoh, dan tidak
 *  ada cabang tampilan kedua yang bisa berselisih dengan yang asli. */
export const PERFORMA_CONTOH: Performa = {
  modal: 1000,
  risikoPersen: 1,
  berjalan: 7,
  analis: [
    analis('c-agen',  'AI Agent',       true,  22, 14, 5,  118.4, 2),
    analis('c-rizal', 'Rizal Maulana',  false, 15, 10, 3,  74.5,  5),
    analis('c-dwi',   'Dwi Anggara',    false, 17, 13, 3,  52.0,  3),
    analis('c-sari',  'Sari Puspita',   false, 8,  8,  3,  6.8,   7),
    /* Satu analis MINUS, dan itu disengaja. Papan peringkat yang semua
       isinya hijau bukan papan peringkat — itu iklan, dan orang yang
       paham pasar akan langsung tahu angkanya disetel. */
    analis('c-bagas', 'Bagas Prakoso',  false, 9,  13, 2, -41.6,  11),
  ],
};

/* ── Aktivitas Dashboard ─────────────────────────────────────────────────
   Kolom Activity yang cuma berisi dua baris membuat panelnya terlihat
   separuh jadi. Yang ditulis di sini jenis kejadian yang memang muncul
   di pemakaian nyata — order terkirim, TP kena, SL kena, EA melapor —
   supaya orang bisa menebak apa yang akan ia lihat nanti. */
export interface AktivitasContoh {
  id: string;
  teks: string;
  waktu: number;
  jenis: 'order' | 'tutup' | 'sistem';
}

export const AKTIVITAS_CONTOH: AktivitasContoh[] = [
  { id: 'a1', jenis: 'order',  teks: 'Posisi XAUUSDc BUY 0,04 terbuka di MetaTrader 5',   waktu: SEKARANG_CONTOH - 7 * JAM },
  { id: 'a2', jenis: 'tutup',  teks: 'SOLUSDT BUY ditutup TP1 +$14,20',                    waktu: SEKARANG_CONTOH - 11 * JAM },
  { id: 'a3', jenis: 'order',  teks: 'Sell Limit XAUUSDc dipasang di 1942,00',             waktu: SEKARANG_CONTOH - 3 * JAM },
  { id: 'a4', jenis: 'tutup',  teks: 'ETHUSDT SELL ditutup SL −$9,80',                     waktu: SEKARANG_CONTOH - 1 * HARI },
  { id: 'a5', jenis: 'sistem', teks: 'EA JadiTraderSync v2.07 melapor — 3 posisi terbuka', waktu: SEKARANG_CONTOH - 2 * JAM },
  { id: 'a6', jenis: 'tutup',  teks: 'BTCUSDT BUY ditutup TP2 +$31,05',                    waktu: SEKARANG_CONTOH - 2 * HARI },
  { id: 'a7', jenis: 'order',  teks: 'Posisi ADAUSDT BUY terbuka di Binance Live',          waktu: SEKARANG_CONTOH - 3 * HARI },
  { id: 'a8', jenis: 'tutup',  teks: 'XAUUSDc SELL ditutup manual +$4,60',                  waktu: SEKARANG_CONTOH - 4 * HARI },
];

/* ── Boleh menampilkan contoh? ───────────────────────────────────────────
   Pilihan "pakai contoh / mulai dari nol" SUDAH punya rumahnya sendiri:
   `bacaPilihanContoh(uid)` di lib/data.ts, yang diisi spanduk biru di
   Dashboard. Berkas ini SENGAJA tidak membuat sakelar kedua.

   Sempat ditulis begitu — satu kunci localStorage baru bernama
   `jt.dataContoh` — lalu dicabut. Dua tempat menyimpan satu keputusan
   adalah cacat yang sama persis dengan yang baru saja hampir memadamkan
   database: berkas panduan aturan Firestore yang berbeda dari yang
   tayang. Yang kedua akan selalu tertinggal, dan tidak ada yang tahu
   kapan.

   Yang belum masuk tidak punya uid, jadi tidak punya pilihan tersimpan —
   dan memang seharusnya begitu: pengunjung yang sedang menimbang produk
   justru orang yang paling butuh melihat layarnya terisi. */
import { bacaPilihanContoh } from '@/lib/data';
import { auth } from '@/lib/firebase';

/** Boleh menampilkan data contoh?
 *
 *  `adaDataNyata` yang menentukan lebih dulu: data contoh tidak boleh
 *  menutupi data sungguhan walau cuma satu baris. Jurnal yang baru berisi
 *  satu trade tetap harus memperlihatkan trade ITU, bukan riwayat
 *  karangan yang lebih ramai. */
export function pakaiContoh(adaDataNyata: boolean): boolean {
  if (adaDataNyata) return false;
  const uid = auth.currentUser?.uid;
  if (!uid) return true;                       // belum masuk → selalu contoh
  return bacaPilihanContoh(uid) !== 'kosong';  // sudah masuk → hormati pilihannya
}
