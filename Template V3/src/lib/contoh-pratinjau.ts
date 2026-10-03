import type { StatusAkun, PosisiBroker, PendingBroker } from '@/lib/akun';
import type { Performa, PerformaAnalis } from '@/lib/analisa';
/* `data/contoh.ts` tidak mengimpor apa pun saat berjalan (cuma tipe), jadi
   mengambil dari sana tidak menyeret Firestore ke bundel awal — berkas ini
   dipakai `lib/akun.ts`, yang ikut dimuat halaman depan. */
import { SALDO_FOREX_CONTOH } from '@/data/contoh';

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
/* Harga dari pasar 3 Okt 2026 (emas 4.149, EURUSD 1,1251), dan lot-nya
   sebesar yang dipakai riwayat contohnya: risiko beberapa dolar per posisi.
   Profit tiap baris = selisih harga x lot x ukuran kontrak (emas 100,
   forex 100.000) — dihitung, bukan dikira-kira, karena kolom Gerak dan
   kolom P/L di tabelnya berangkat dari bilangan yang sama.

   Satu posisi merah, sengaja: lihat catatan di kepala berkas. */
const POSISI_MT5: PosisiBroker[] = [
  { tiket: '51884213', simbol: 'XAUUSDc', arah: 'BUY',  lot: 0.01, hargaBuka: 4141.30, hargaKini: 4149.20, sl: 4134.50, tp: 4162.00, profit: 7.90,  waktuBuka: SEKARANG_CONTOH - 7 * JAM },
  { tiket: '51884190', simbol: 'EURUSD',  arah: 'SELL', lot: 0.03, hargaBuka: 1.12740, hargaKini: 1.12510, sl: 1.12960, tp: 1.12180, profit: 6.90,  waktuBuka: SEKARANG_CONTOH - 19 * JAM },
  { tiket: '51883977', simbol: 'GBPUSD',  arah: 'BUY',  lot: 0.02, hargaBuka: 1.28790, hargaKini: 1.28610, sl: 1.28540, tp: 1.29400, profit: -3.60, waktuBuka: SEKARANG_CONTOH - 2 * HARI },
];

const PENDING_MT5: PendingBroker[] = [
  { tiket: '51884402', simbol: 'XAUUSDc', jenis: 'SELL_LIMIT', arah: 'SELL', lot: 0.01, harga: 4172.00, sl: 4180.50, tp: 4150.00, waktu: SEKARANG_CONTOH - 3 * JAM },
  { tiket: '51884377', simbol: 'USDCAD',  jenis: 'BUY_STOP',   arah: 'BUY',  lot: 0.03, harga: 1.34250, sl: 1.33900, tp: 1.35000, waktu: SEKARANG_CONTOH - 11 * JAM },
];

const MENGAMBANG_MT5 = POSISI_MT5.reduce((s, p) => s + p.profit, 0);

/** Dolar per 1 lot per 1,0 gerak harga, untuk simbol akun CONTOH di atas —
 *  bilangan yang sama dengan yang dipakai menghitung `profit` tiap barisnya.
 *  Akun sungguhan mendapat angka ini dari EA-nya (`bacaSpekMt5`); yang ini
 *  cuma boleh dipakai saat yang tampil memang `AKUN_MT5_CONTOH`. */
export const SPEK_MT5_CONTOH: Record<string, number> = {
  XAUUSDc: 100, EURUSD: 100_000, GBPUSD: 100_000,
};

/** Akun MT5 contoh.
 *
 *  `terhubung: false` DISENGAJA dan tidak boleh diubah jadi true. Panel
 *  membaca bendera itu untuk memutuskan menampilkan lencana tersambung —
 *  dan lencana tersambung yang tidak benar adalah cara tercepat membuat
 *  orang menutup MetaTrader-nya sambil merasa aman.
 *
 *  Saldonya `SALDO_FOREX_CONTOH` — bilangan yang SAMA dengan hitungan
 *  jurnal Trade-Fi contoh, dan ekuitasnya saldo itu ditambah P/L mengambang
 *  di atas. Dulu dua angka mati ($528,39 / $560,79) yang tidak cocok dengan
 *  jurnalnya, jadi kartu saldo menulis "Selisih broker vs jurnal +$169,66"
 *  untuk akun yang dua-duanya karangan. */
export const AKUN_MT5_CONTOH: StatusAkun = {
  terhubung: false,
  saldo: SALDO_FOREX_CONTOH,
  ekuitas: Number((SALDO_FOREX_CONTOH + MENGAMBANG_MT5).toFixed(2)),
  mataUang: 'USD',
  ket: 'Data contoh — sambungkan MetaTrader 5 untuk melihat akunmu',
  posisi: POSISI_MT5,
  pending: PENDING_MT5,
  versiEa: '2.10',
  /* Contoh untuk pengunjung yang belum masuk: SATU terminal, supaya pemilih
     akunnya tidak muncul dan menjanjikan fitur yang belum ia punya. */
  daftarAkun: [],
  loginAktif: null,
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

/* ── Aktivitas Dashboard: TIDAK ADA daftar contohnya di sini ─────────────
   Pernah ada (`AKTIVITAS_CONTOH`, delapan baris tulisan tangan), dan tidak
   pernah dipakai siapa pun: kolom Activity di Dashboard dirakit dari
   kejadian yang memang ada di data — transaksi terakhir yang ditutup dan
   posisi yang sedang terbuka. Di mode preview bahan itu riwayat contoh
   dan posisi contoh, jadi kolomnya terisi sendiri dan isinya cocok dengan
   tabel di sebelahnya. Daftar kedua yang ditulis tangan cuma akan
   berselisih dengan itu. */

/* ── DI MANA DATA PRATINJAU KRIPTO TINGGAL ───────────────────────────────
   Posisi, pending, dan stop kripto untuk pengunjung ada di
   `data/contoh.ts` (POSISI_KRIPTO_CONTOH, PENDING_KRIPTO_CONTOH,
   STOP_KRIPTO_CONTOH), bukan di sini. Bukan pilihan gaya: `lib/data.ts`
   yang memakainya, dan berkas INI mengimpor `bacaPilihanContoh` dari
   lib/data.ts — menaruhnya di sini menutup lingkaran impor yang urutan
   inisialisasinya tergantung berkas mana yang kebetulan dievaluasi duluan.
   data/contoh.ts tidak mengimpor apa pun, jadi ia aman jadi sumbernya.

   Berkas ini sempat memuat satu set angka lain untuk halaman /preview yang
   berdiri sendiri — KPI, kurva saldo, baris posisi siap render. Halaman itu
   dibuang (previewnya sekarang website yang sesungguhnya), dan angkanya
   ikut dibuang bersamanya: data contoh yang tidak dipakai siapa pun tetap
   terbaca seperti sumber kebenaran kedua oleh yang membacanya besok.       */

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
/* DARI `@/lib/pilihan-contoh`, BUKAN `@/lib/data`. Berkas ini dipakai
   `lib/akun.ts` yang ikut bundel awal; mengambilnya dari data.ts menyeret
   647 kB Firestore ke halaman depan untuk satu pembacaan localStorage. */
import { bacaPilihanContoh } from '@/lib/pilihan-contoh';
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
