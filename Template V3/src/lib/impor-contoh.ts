import { doc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/data';
import { kunciUrut } from '@/lib/tulis-jurnal';
import { RIWAYAT, type Trade } from '@/data/contoh';

/* ════════════════════════════════════════════════════════════════════════
   IMPOR DATA CONTOH KE JURNAL SENDIRI
   ════════════════════════════════════════════════════════════════════════
   Yang dilihat pengunjung di mode preview adalah data contoh yang tidak
   tersimpan di mana pun — ia hidup sebagai konstanta di dalam kode. Begitu
   orangnya masuk, layar berganti ke jurnalnya sendiri yang masih kosong,
   dan seluruh bentuk yang tadi membuatnya tertarik hilang dalam sekejap.

   Fungsi ini menawarkan jalan ketiga: SALIN contoh itu jadi miliknya, satu
   kali, atas permintaannya. Bukan diam-diam saat halaman dibuka — menulis
   ratusan transaksi ke akun orang tanpa diminta adalah hal yang tidak bisa
   ditebak akibatnya oleh yang mengalaminya.

   ── YANG DISALIN 60 HARI TERAKHIR, BUKAN SETAHUN ──────────────────────
   Sejak 3 Okt 2026 contohnya setahun penuh, sekitar 950 transaksi. Menyalin
   semuanya berarti 950 tulisan Firestore tiap kali seseorang menekan satu
   tombol — dua puluh pendaftar sehari menghabiskan jatah tulis harian
   seluruh situs, dan yang pertama gagal sesudah itu adalah jurnal
   SUNGGUHAN milik pengguna lain. Dua bulan (~150 baris) cukup untuk
   menghidupkan setiap panel, dan ongkosnya sama dengan contoh lama.

   ── TIGA HAL YANG MEMBUAT INI AMAN ────────────────────────────────────

   1. AWALAN ID `contoh-`. Transaksi hasil migrasi V2 memakai id `fx-…` dan
      `cr-…` — id yang SAMA PERSIS dengan konstanta di data/contoh.ts.
      Menulis tanpa awalan berarti menimpa transaksi sungguhan pemilik
      dengan angka karangan, dan itu tidak bisa dibatalkan.

   2. BISA DIHAPUS SEKALIGUS. Yang dihapus adalah setiap dokumen berawalan
      `contoh-` yang MEMANG ADA di jurnalnya — dibaca dari daftar yang sudah
      dimuat layar, bukan dihitung ulang dari contoh hari ini. Contohnya
      bergulir mengikuti tanggal, jadi id yang "seharusnya ada" besok sudah
      berbeda dari yang ditulis hari ini; menghitung ulang akan meninggalkan
      baris contoh yang tidak bisa dihapus lagi. Pilihan yang tidak bisa
      dibatalkan bukan pilihan, itu jebakan.

   3. POSISI TERBUKA TIDAK IKUT. Posisi dan pending order adalah keadaan
      bursa yang sedang berjalan, bukan catatan. Menuliskannya berarti
      aplikasi menyatakan ada tiga posisi kripto hidup di Binance yang
      sebenarnya tidak ada — dan orang yang memercayainya akan menutup
      terminalnya sambil merasa terjaga.

   `_asal: 'contoh-v3'` ikut ditulis supaya asalnya tetap terbaca dari
   dokumennya sendiri, bukan cuma dari idnya.
   ════════════════════════════════════════════════════════════════════════ */

/** Awalan id transaksi hasil impor. Dipakai untuk menulis, menghapus, DAN
 *  mengenali — satu string di satu tempat, jadi ketiganya tidak bisa
 *  berselisih. */
export const AWALAN_CONTOH = 'contoh-';

/** Batas tulis satu batch Firestore adalah 500. 400 memberi ruang kalau
 *  daftar contohnya bertambah nanti, tanpa perlu ada yang ingat. */
const PER_BATCH = 400;

/** Berapa hari ke belakang yang disalin — lihat catatan di kepala berkas. */
const HARI_IMPOR = 60;

const idContoh = (t: Trade) => AWALAN_CONTOH + t.id;

function bahanImpor(): Trade[] {
  const batas = Date.now() - HARI_IMPOR * 86_400_000;
  return RIWAYAT.filter((t) => t.waktu >= batas);
}

/* ── ID IMPOR VERSI LAMA ─────────────────────────────────────────────────
   Sebelum 3 Okt 2026 contohnya 123 baris ber-id `fx-0…28` dan `cr-0…93`,
   jadi yang tertulis di jurnal orang adalah `contoh-fx-0` dst. Daftar ini
   memastikan tombol hapus tetap menjangkaunya walau jurnalnya sedang
   tidak termuat utuh. Menghapus dokumen yang tidak ada bukan galat. */
const ID_IMPOR_LAMA: string[] = [
  ...Array.from({ length: 29 }, (_, i) => `${AWALAN_CONTOH}fx-${i}`),
  ...Array.from({ length: 94 }, (_, i) => `${AWALAN_CONTOH}cr-${i}`),
];

/** Sudah ada transaksi contoh di jurnal ini?
 *
 *  Dibaca dari daftar transaksi yang MEMANG SUDAH dimuat layar, bukan dari
 *  penanda terpisah di localStorage. Penanda begitu akan salah begitu
 *  orangnya membuka akun yang sama di perangkat lain — dan lebih buruk,
 *  ia jadi sumber kebenaran kedua yang bisa berselisih dengan datanya. */
export function adaContohTerimpor(riwayat: Trade[]): boolean {
  return riwayat.some((t) => t.id.startsWith(AWALAN_CONTOH));
}

/** Salin transaksi contoh 60 hari terakhir ke `users/{uid}/transaksi`.
 *  Mengembalikan jumlah yang ditulis. */
export async function imporContoh(uid: string): Promise<number> {
  const bahan = bahanImpor();
  for (let i = 0; i < bahan.length; i += PER_BATCH) {
    const batch = writeBatch(db);
    for (const t of bahan.slice(i, i + PER_BATCH)) {
      batch.set(doc(db, 'users', uid, 'transaksi', idContoh(t)), {
        simbol: t.pair.toUpperCase(),
        arah: t.arah,
        sumber: t.sumber,
        /* Forex diukur lot, kripto diukur jumlah koin — bentuk yang sama
           dengan yang ditulis simpanTrade, supaya pembacanya tidak perlu
           tahu transaksi ini datang dari mana. */
        ukuran: t.sumber === 'forex' ? { lot: t.lot }
          /* Nilai order & leverage ikut, supaya kolom Size Order di jurnal
             kripto terisi seperti di preview — `keTrade` membacanya dari
             `ukuran.nilai` dan `ukuran.leverage`. */
          : { qty: t.lot, ...(t.nilaiOrder ? { nilai: t.nilaiOrder } : {}), ...(t.leverage ? { leverage: t.leverage } : {}) },
        pnl: t.pnl,
        masukWaktu: Timestamp.fromMillis(t.waktu),
        keluarWaktu: Timestamp.fromMillis(t.waktu),
        psikologi: {
          emosiMasuk: t.emosi ?? 'Netral',
          emosiEvaluasi: t.emosi ?? 'Netral',
          alasanMasuk: t.alasan ?? '',
          /* KATA-KATANYA TIDAK BEBAS, dan ini bukan soal gaya bahasa.
             `keTrade` di lib/data.ts masih mengenali transaksi latihan lama
             dari teksnya — transaksi replay sebelum ada field `latihan`
             cuma meninggalkan jejak berupa kalimat. Dua frasa yang dicarinya
             adalah "latihan replay" dan "bukan transaksi sungguhan"; memakai
             salah satunya di sini membuat SELURUH baris hasil impor terhitung
             latihan, dikeluarkan dari statistik, dan angka Dashboard tetap
             nol sesudah impor. Ketahuan oleh uji-impor-contoh.mjs, bukan
             oleh mata. */
          catatan: 'Data contoh dari mode preview — disalin ke jurnalmu, bukan hasil trading nyata.',
        },
        kunciUrut: kunciUrut(t.sumber, t.waktu),
        /* `latihan` SENGAJA false. Bendera itu berarti "hasil replay" dan
           membuat barisnya dikeluarkan dari winrate, Net P/L, dan profit
           factor — kalau dipakai di sini, seluruh angka Dashboard tetap nol
           sesudah impor dan tombolnya terlihat tidak melakukan apa-apa. */
        latihan: false,
        _asal: 'contoh-v3',
      });
    }
    await batch.commit();
  }
  return bahan.length;
}

/** Hapus seluruh transaksi hasil impor: setiap id berawalan `contoh-` yang
 *  ada di `riwayat` (jurnal yang sedang termuat), ditambah id impor versi
 *  lama. Transaksi milik orangnya sendiri tidak pernah berawalan itu, jadi
 *  tidak ada yang bisa ikut terhapus. Menghapus dokumen yang tidak ada
 *  bukan galat di Firestore, jadi ini aman dijalankan berapa kali pun. */
export async function hapusImporContoh(uid: string, riwayat: Trade[]): Promise<number> {
  const id = [...new Set([
    ...riwayat.map((t) => t.id).filter((x) => x.startsWith(AWALAN_CONTOH)),
    ...ID_IMPOR_LAMA,
  ])];
  for (let i = 0; i < id.length; i += PER_BATCH) {
    const batch = writeBatch(db);
    for (const x of id.slice(i, i + PER_BATCH)) {
      batch.delete(doc(db, 'users', uid, 'transaksi', x));
    }
    await batch.commit();
  }
  return id.length;
}
