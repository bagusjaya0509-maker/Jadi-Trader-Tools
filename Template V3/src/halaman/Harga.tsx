import Pricing_05 from '@/components/ui/ruixen-pricing05';

/* ════════════════════════════════════════════════════════════════════════
   HALAMAN HARGA DI DALAM APLIKASI
   ════════════════════════════════════════════════════════════════════════
   Ada karena halaman depan TIDAK BISA dipakai untuk ini.

   Rute "/" bercabang: yang belum login melihat halaman pendaratan berikut
   bagian harganya, yang sudah login melihat Beranda. Jadi tautan "/#harga"
   yang dipasang di layar-layar terkunci mendarat di halaman yang tidak
   punya jangkar itu — tombolnya ditekan, alamatnya berubah, dan tidak
   terjadi apa-apa. Persis keadaan yang paling membingungkan: bukan galat,
   bukan berhasil, cuma diam.

   Yang membaca halaman ini justru orang yang PALING mungkin membeli: ia
   sudah masuk, sudah memakai alatnya, dan baru saja membentur batas
   paketnya. Ia tidak boleh disuruh keluar dulu untuk melihat harganya.

   Komponennya SAMA dengan yang di halaman depan, bukan salinan. Dua daftar
   harga yang harus diperbarui bersamaan adalah dua daftar harga yang suatu
   hari berbeda — dan yang berbeda di sini adalah angka yang ditagihkan.
   ════════════════════════════════════════════════════════════════════════ */

export default function Harga() {
  /* -my-24 mengimbangi py-24 bawaan bloknya. Di halaman depan jarak selega
     itu benar karena ia satu seksi di antara seksi lain; di dalam kerangka
     aplikasi ia meninggalkan ruang kosong sebesar layar di atas kartunya. */
  return (
    <div className="p-4 sm:p-6">
      <div className="-my-16 sm:-my-20">
        <Pricing_05 />
      </div>
    </div>
  );
}
