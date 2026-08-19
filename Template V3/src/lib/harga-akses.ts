import { useEffect, useState } from 'react';
import { PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   HARGA PAKET AKSES
   ════════════════════════════════════════════════════════════════════════
   Jangan tertukar dengan `harga.ts` di sebelah: yang itu harga PASAR
   (useHargaPasar, useHargaTradeFi). Yang ini harga PRODUK ini.

   Sumbernya `/api/akses/kuota` — rute yang sama yang sudah dipakai halaman
   Akses untuk menghitung sisa tempat, dan yang memang PUBLIK tanpa token
   karena justru dibaca sebelum orangnya punya akun.

   Harga menumpang di rute itu, bukan berdiri sendiri, dan itu keputusan:
   halaman harga menanyakan dua hal sekaligus — berapa harganya dan masih
   ada tempat atau tidak. Dua permintaan untuk satu pertanyaan berarti dua
   kesempatan gagal, dan dua keadaan yang bisa berbeda umur.

   BUKAN Firestore. Halaman depan adalah jalur muat pertama; mengimpor SDK
   Firestore ke sana menambah ratusan kilobyte sebelum orangnya sempat
   membaca satu kalimat. Satu fetch memberikan angka yang sama.

   Nilai bawaan di bawah dipakai selama jawaban server belum datang DAN
   kalau permintaannya gagal. Halaman harga yang kosong lebih buruk
   daripada halaman harga yang sedetik menampilkan angka bawaan — yang
   pertama terlihat rusak, yang kedua tidak terlihat sama sekali.
   ════════════════════════════════════════════════════════════════════════ */

export interface HargaPaket {
  /** Harga paket, dalam DOLAR. */
  hargaTesting: number;
  /** Harga coret paket testing. 0 berarti tidak ada coretan. */
  hargaTestingCoret: number;
  hargaPremium3: number;
  hargaTahunan: number;
  /** Sakelar kartu event gratis dari Maintenance. */
  eventGratis: boolean;
  /** Tautan checkout per paket. KOSONG berarti paketnya belum bisa dibeli,
      dan kartunya tampil "Available soon" dengan tombol mati. Server hanya
      menerima https:// — nilai ini jadi href di halaman depan, dan untai
      bebas berarti menerima "javascript:..." yang jalan di peramban
      pengunjung. */
  linkTesting: string;
  linkPremium3: string;
  linkTahunan: string;
  gratisTotal: number;
  gratisSisa: number;
  gratisHabis: boolean;
  bukaPermintaan: boolean;
  hari: number;
}

export const HARGA_BAWAAN: HargaPaket = {
  hargaTesting: 1,
  hargaTestingCoret: 5,
  hargaPremium3: 10,
  hargaTahunan: 100,
  eventGratis: true,
  linkTesting: '',
  linkPremium3: '',
  linkTahunan: '',
  gratisTotal: 20,
  gratisSisa: 20,
  gratisHabis: false,
  /* Bawaan MATI. Nilai ini berlaku selama jawaban server belum datang;
     kalau hidup, kartu event berkedip muncul lalu hilang begitu server
     bilang pendaftaran ditutup. Lebih baik terlambat sedetik daripada
     menjanjikan tempat yang tidak ada. */
  bukaPermintaan: false,
  hari: 30,
};

/* ── BATAS PEMAKAIAN PER PAKET ──────────────────────────────────────────
   Angka yang membedakan paket satu dengan lainnya. Ditaruh di sini, bukan
   ditulis langsung di kartu harga, karena tempat ini akan dibaca DUA pihak:
   kartu harga yang menjanjikannya, dan penegakan batas yang menghitungnya.

   Kalau angkanya ditulis di kartu saja, halaman harga dan perilaku aplikasi
   akan berpisah pelan-pelan — dan yang paling mungkin terjadi bukan orang
   protes karena dibatasi, tapi orang membayar lebih untuk batas yang
   ternyata tidak pernah ditegakkan.

   PENTING: sampai penegakannya dibangun, angka-angka ini baru JANJI. Tidak
   ada penghitung pemakaian di Screener maupun Replay. */
export const BATAS = {
  /** Paket event gratis. */
  gratis: { screener: 10, replay: 20 },
  /** Paket testing — lima kali lipat paket gratis. */
  testing: { screener: 50, replay: 100 },
} as const;

/** Uang dolar tanpa desimal kalau bulat: $1, $10, $100, $1.5. */
export function usd(n: number): string {
  return '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));
}

export function useHargaPaket(): HargaPaket {
  const [h, setH] = useState<HargaPaket>(HARGA_BAWAAN);
  useEffect(() => {
    let hidup = true;
    fetch(`${PROXY_BAWAAN}/api/akses/kuota`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!hidup || !d || d.ok !== true) return;
        /* Digabung dengan bawaan, bukan dipakai apa adanya: server versi
           lama belum punya medan harga, dan kartu bertuliskan "$undefined"
           lebih buruk daripada kartu bertuliskan harga bawaan. */
        setH({ ...HARGA_BAWAAN, ...d, bukaPermintaan: d.bukaPermintaan === true });
      })
      .catch(() => { /* halaman harga tetap tampil dengan angka bawaan */ });
    return () => { hidup = false; };
  }, []);
  return h;
}

/* ── Harga akses lama, dalam rupiah ─────────────────────────────────────
   Dipakai halaman Akses, yang tautan bayarnya menuju satu produk Lynk
   berharga tetap. Angkanya TIDAK boleh diganti sendiri tanpa mengganti
   produk Lynk-nya — harga yang tertulis dan harga yang ditagih wajib sama. */
export const HARGA_PERINTIS = 17_900;
export const HARGA_PERINTIS_TEKS = 'Rp 17.900';
export const MASA_AKSES_HARI = 30;
