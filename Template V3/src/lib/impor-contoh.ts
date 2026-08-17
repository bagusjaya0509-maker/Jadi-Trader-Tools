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
   123 transaksi ke akun orang tanpa diminta adalah hal yang tidak bisa
   ditebak akibatnya oleh yang mengalaminya.

   ── TIGA HAL YANG MEMBUAT INI AMAN ────────────────────────────────────

   1. AWALAN ID `contoh-`. Transaksi hasil migrasi V2 memakai id `fx-…` dan
      `cr-…` — id yang SAMA PERSIS dengan konstanta di data/contoh.ts.
      Menulis tanpa awalan berarti menimpa transaksi sungguhan pemilik
      dengan angka karangan, dan itu tidak bisa dibatalkan.

   2. BISA DIHAPUS SEKALIGUS. Karena idnya bisa dihitung, membatalkannya
      tidak perlu mencari apa pun — cukup hapus 123 id yang sama. Pilihan
      yang tidak bisa dibatalkan bukan pilihan, itu jebakan, dan menawarkan
      jebakan lebih buruk daripada tidak menawarkan apa-apa.

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

const idContoh = (t: Trade) => AWALAN_CONTOH + t.id;

/** Sudah ada transaksi contoh di jurnal ini?
 *
 *  Dibaca dari daftar transaksi yang MEMANG SUDAH dimuat layar, bukan dari
 *  penanda terpisah di localStorage. Penanda begitu akan salah begitu
 *  orangnya membuka akun yang sama di perangkat lain — dan lebih buruk,
 *  ia jadi sumber kebenaran kedua yang bisa berselisih dengan datanya. */
export function adaContohTerimpor(riwayat: Trade[]): boolean {
  return riwayat.some((t) => t.id.startsWith(AWALAN_CONTOH));
}

/** Salin seluruh transaksi contoh ke `users/{uid}/transaksi`.
 *  Mengembalikan jumlah yang ditulis. */
export async function imporContoh(uid: string): Promise<number> {
  for (let i = 0; i < RIWAYAT.length; i += PER_BATCH) {
    const batch = writeBatch(db);
    for (const t of RIWAYAT.slice(i, i + PER_BATCH)) {
      batch.set(doc(db, 'users', uid, 'transaksi', idContoh(t)), {
        simbol: t.pair.toUpperCase(),
        arah: t.arah,
        sumber: t.sumber,
        /* Forex diukur lot, kripto diukur jumlah koin — bentuk yang sama
           dengan yang ditulis simpanTrade, supaya pembacanya tidak perlu
           tahu transaksi ini datang dari mana. */
        ukuran: t.sumber === 'forex' ? { lot: t.lot } : { qty: t.lot },
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
  return RIWAYAT.length;
}

/** Hapus seluruh transaksi hasil impor. Menghapus dokumen yang tidak ada
 *  bukan galat di Firestore, jadi ini aman dijalankan berapa kali pun —
 *  dan tidak perlu membaca dulu untuk tahu mana yang ada. */
export async function hapusImporContoh(uid: string): Promise<number> {
  for (let i = 0; i < RIWAYAT.length; i += PER_BATCH) {
    const batch = writeBatch(db);
    for (const t of RIWAYAT.slice(i, i + PER_BATCH)) {
      batch.delete(doc(db, 'users', uid, 'transaksi', idContoh(t)));
    }
    await batch.commit();
  }
  return RIWAYAT.length;
}
