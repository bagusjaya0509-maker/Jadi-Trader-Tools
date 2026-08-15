import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

/* ════════════════════════════════════════════════════════════════════════
   FIREBASE — sambungan tunggal
   ════════════════════════════════════════════════════════════════════════
   Nilai di bawah ini AMAN berada di dalam kode dan boleh masuk Git.

   Itu bukan kelalaian dan bukan kompromi: `apiKey` Firebase Web bukan
   rahasia, ia pengenal proyek. Google sendiri mendokumentasikannya begitu.
   Yang benar-benar menjaga data adalah Security Rules yang berjalan di
   server Google — dan itulah sebabnya aturan di `aturan-v3.rules` jauh
   lebih penting daripada menyembunyikan kunci ini.

   Menaruhnya di variabel lingkungan justru menyesatkan: hasil build Vite
   tetap menuliskannya apa adanya ke dalam berkas JS yang bisa dibuka siapa
   pun lewat view-source. Yang didapat cuma rasa aman, bukan keamanan.
   ════════════════════════════════════════════════════════════════════════ */

const konfigurasi = {
  apiKey: 'AIzaSyB4cWVI-k3q16TmRCbM_lbJwgtjxIs_Weo',
  /* DOMAIN SENDIRI, bukan jadi-trader-tools.firebaseapp.com — dan ini
     perbaikan login Safari, bukan soal merek.
     ────────────────────────────────────────────────────────────────────
     Alur login Google bolak-balik lewat halaman pembantu di `authDomain`.
     Selama authDomain-nya firebaseapp.com, halaman itu pihak KETIGA bagi
     jaditrader.co.id — dan Safari (ITP) memblokir storage pihak ketiga.
     Akibat nyatanya sudah terjadi: pengguna MacBook memilih akun Google,
     berhasil, lalu terlempar balik ke halaman login karena hasil loginnya
     tersangkut di storage yang diblokir. Tanpa satu pun pesan galat.

     Dengan authDomain = domain sendiri, seluruh alur jadi SATU origin dan
     tidak ada storage pihak ketiga yang perlu diblokir. Syaratnya dua, dan
     keduanya sudah dipasang:
     1. Caddy meneruskan `/__/auth/*` ke jadi-trader-tools.firebaseapp.com
        (halaman pembantunya tetap milik Firebase, cuma disajikan dari sini);
     2. `https://jaditrader.co.id/__/auth/handler` terdaftar sebagai
        redirect URI di OAuth client Google Cloud.
     Jangan kembalikan ke firebaseapp.com tanpa mencabut keduanya. */
  authDomain: 'jaditrader.co.id',
  projectId: 'jadi-trader-tools',
  storageBucket: 'jadi-trader-tools.firebasestorage.app',
  messagingSenderId: '171244479105',
  appId: '1:171244479105:web:9b421850801b6678d8e380',
};

export const app = initializeApp(konfigurasi);
export const auth = getAuth(app);

/* Firestore SENGAJA tidak diimpor di berkas ini.
   ─────────────────────────────────────────────────────────────────────────
   Berkas ini berada di jalur muat awal — ia dibutuhkan sebelum apa pun bisa
   tahu ada yang login atau tidak. Kalau `getFirestore` dipanggil di sini,
   seluruh pustaka Firestore (±450 kB mentah) ikut terunduh oleh SETIAP
   pengunjung halaman depan, termasuk yang cuma melihat sekilas lalu pergi
   dan tidak pernah menyentuh satu dokumen pun.

   Yang memakai Firestore cuma dua: `data.ts` (diimpor halaman-halaman yang
   dimuat malas) dan pembacaan status langganan di `auth.tsx` — dan yang
   kedua hanya berjalan SESUDAH ada yang benar-benar masuk. Keduanya
   mengambil instansnya sendiri lewat `getFirestore(app)`, yang aman
   dipanggil berulang: Firebase mengembalikan instans yang sama. */

export const penyediaGoogle = new GoogleAuthProvider();
/* Selalu tanya akun mana yang dipakai. Tanpa ini, orang yang punya dua akun
   Google diam-diam masuk dengan yang salah dan melihat jurnal kosong —
   lalu mengira datanya hilang. */
penyediaGoogle.setCustomParameters({ prompt: 'select_account' });

/** UID pemilik. Dipakai untuk membuka halaman Administration.
 *  Ini hanya untuk TAMPILAN — penjagaan sesungguhnya ada di Security Rules,
 *  yang memakai uid yang sama. Menyembunyikan menu tidak menjaga apa pun. */
export const UID_PEMILIK = 'EOrakx0QnSVgsi6BECSOXvUM9kG3';
