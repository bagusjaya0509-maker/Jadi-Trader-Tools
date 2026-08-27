import { app } from '@/lib/firebase';
import {
  initializeFirestore, getFirestore, persistentLocalCache,
  persistentMultipleTabManager, type Firestore,
} from 'firebase/firestore';

/* ════════════════════════════════════════════════════════════════════════
   SATU INSTANS FIRESTORE, DENGAN CACHE LOKAL
   ════════════════════════════════════════════════════════════════════════
   Riwayat jurnal dibaca lewat TIGA pendengar (kripto, forex, xau), masing-
   masing sampai 2.000 dokumen. Firestore menagih satu baca per dokumen saat
   pendengar menyala — dan pendengar itu menyala LAGI tiap kali halaman
   dimuat: tiap refresh, tiap tab baru, tiap kali sesi auth berbunyi ulang.

   Dashboard adalah halaman pertama yang terbuka tiap kali aplikasi dibuka,
   dan ia ikut memuat riwayat penuh lewat useRingkasanAkun(). Jadi ongkos
   itu dibayar sebelum orangnya menyentuh apa pun. Tanggal 27 Agu 2026
   kuota harian Firestore benar-benar habis — SETIAP pembacaan dijawab
   429 RESOURCE_EXHAUSTED, dan angka yang gagal dihitung tampil sebagai nol
   di layar (hitungan suka, jumlah balasan) sehingga terbaca seperti fitur
   yang rusak.

   ── KENAPA CACHE, BUKAN MEMOTONG BATASNYA ──────────────────────────────
   Menurunkan 2.000 ke angka kecil memang memotong biaya, TAPI daftar itu
   bukan cuma mengisi tabel: `statGabungan()` memakainya untuk menghitung
   saldo, winrate, dan profit factor, dan `Analisa.tsx` memakainya untuk
   snapshot rekam jejak yang dilampirkan saat memposting sinyal. Memotongnya
   berarti angka uang berubah diam-diam, tanpa satu pun galat — kerusakan
   yang paling sulit ketahuan.

   Cache menyelesaikan sebab yang sebenarnya: bukan "2.000 terlalu banyak",
   melainkan "2.000 dibaca ULANG dari server tiap kali". Muat pertama tetap
   membaca semuanya; sesudah itu pendengarnya dilayani dari IndexedDB dan
   server hanya mengirim dokumen yang BERUBAH. Semua angka tetap dihitung
   dari data yang sama utuhnya.

   ── SATU PINTU, KARENA URUTANNYA MENENTUKAN ────────────────────────────
   `initializeFirestore` HANYA boleh dipanggil sebelum `getFirestore`
   pertama; sesudah itu ia melempar. Sebelumnya ada tiga tempat memanggil
   `getFirestore(app)` sendiri-sendiri — data.ts dan dua fungsi di auth.tsx.
   Auth berjalan lebih dulu (status login diperiksa sejak awal), jadi
   menaruh initializeFirestore di data.ts saja akan kalah cepat: instans
   tanpa cache sudah terlanjur dibuat, dan cache-nya diam-diam tidak pernah
   aktif. Semua sekarang lewat `ambilDb()`.

   ── SENGAJA BUKAN DI firebase.ts ───────────────────────────────────────
   Berkas itu ada di jalur muat awal. Mengimpor Firestore di sana menyeret
   ±450 kB ke setiap pengunjung halaman depan, termasuk yang cuma melihat
   sekilas. Berkas ini hanya diimpor data.ts (halaman yang dimuat malas) dan
   auth.tsx lewat impor dinamis — jadi jalur muat awalnya tetap bersih.
   ════════════════════════════════════════════════════════════════════════ */

let instans: Firestore | null = null;

/** Instans Firestore aplikasi. Aman dipanggil berulang dan dari mana pun. */
export function ambilDb(): Firestore {
  if (instans) return instans;
  try {
    instans = initializeFirestore(app, {
      /* Banyak tab memang keadaan normal di sini — chart di satu tab,
         jurnal di tab lain. Tanpa pengurus multi-tab, tab kedua gagal
         mengambil kunci cache dan diam-diam turun ke cache memori: tab itu
         membayar penuh lagi, dan gejalanya tidak terlihat sama sekali. */
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    /* Sudah dimulai lebih dulu di suatu tempat (mis. muat ulang modul saat
       pengembangan). Instans yang sudah ada dipakai apa adanya — memaksakan
       yang baru cuma melempar lagi. */
    instans = getFirestore(app);
  }
  return instans;
}
