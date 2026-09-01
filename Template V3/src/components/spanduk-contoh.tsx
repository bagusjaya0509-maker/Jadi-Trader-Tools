import { useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { bacaPilihanContoh, simpanPilihanContoh } from '@/lib/pilihan-contoh';
import { imporContoh, hapusImporContoh, AWALAN_CONTOH } from '@/lib/impor-contoh';
import type { Trade } from '@/data/contoh';

/* ── Spanduk data contoh untuk akun baru ─────────────────────────────────
   TIGA keadaan, bukan dua, dan yang ketiga yang paling penting.

   Sebelum ini pilihannya cuma "mulai dari nol" atau "biarkan contohnya",
   dan yang kedua tidak menyalin apa pun — ia hanya menahan tampilan supaya
   tetap memperlihatkan konstanta di dalam kode. Akibatnya orang yang baru
   saja menjelajahi preview lalu masuk melihat seluruh bentuk yang membuatnya
   tertarik menguap: jurnalnya sendiri kosong, dan tidak ada satu tombol pun
   yang bisa mengembalikannya.

   Sekarang "Impor" benar-benar MENULIS ke jurnalnya, sekali, atas
   permintaannya. Dan karena menulis, ia wajib bisa dibatalkan — keadaan
   ketiga: jurnal yang berisi transaksi contoh selalu membawa tombol
   hapusnya sendiri. Pilihan yang tidak bisa dibatalkan bukan pilihan.

   ── KENAPA BERKAS SENDIRI, BUKAN DI DALAM gerbang.tsx ──────────────────
   Dulu ia tinggal di ujung `gerbang.tsx`, dan itu diam-diam mahal.

   `app-shell.tsx` mengambil `MenuPengguna` dan `PitaLangganan` dari
   gerbang; `App.tsx` mengambil app-shell secara STATIS. Rollup memuat satu
   modul utuh, bukan sepotong — jadi rantainya jadi:

     App.tsx → app-shell → gerbang → lib/data → firebase/firestore

   Akibatnya SELURUH SDK Firestore (647 kB terminifikasi) masuk ke bundel
   awal dan diunduh setiap pengunjung halaman depan — orang yang belum
   login, yang tidak pernah membaca satu dokumen pun. Terukur: bundel awal
   1048 kB, dan halaman depan menarik 2,6 MB sebelum menampilkan apa-apa.

   Bagian gerbang yang lain (`TombolMasuk`, `MenuPengguna`, `PitaLangganan`,
   `LabelContoh`) tidak menyentuh Firestore sama sekali. Yang menariknya
   cuma komponen ini, dan satu-satunya pemakainya `dashboard.tsx` yang
   memang sudah potongan malas — tempat Firestore boleh ikut, karena
   dashboard tanpa data memang tidak ada gunanya.

   Jadi JANGAN mengimpor berkas ini dari app-shell atau dari mana pun yang
   ikut bundel awal. Kalau suatu hari spanduk ini perlu muncul di kerangka,
   muat ia dengan `lazy()`, bukan impor statis.
   ──────────────────────────────────────────────────────────────────────── */

export function SpandukContoh({ contoh, riwayat = [] }: { contoh: boolean; riwayat?: Trade[] }) {
  const { pengguna } = useAuth();
  const [, setV] = useState(0);
  const [sibuk, setSibuk] = useState<'' | 'impor' | 'hapus'>('');
  const [kabar, setKabar] = useState('');

  if (!pengguna) return null;

  /* IMPOR STATIS, dan sebelumnya dinamis — itu bug yang dilaporkan.
     ──────────────────────────────────────────────────────────────────────
     `await import('@/lib/impor-contoh')` memecah kodenya jadi potongan
     terpisah bernama hash, misalnya `impor-contoh-D1OOC03W.js`. Nama itu
     berubah TIAP BUILD. Halaman yang sudah terbuka — atau yang dimuat dari
     index.html versi cache — memegang daftar nama LAMA, jadi begitu
     tombolnya ditekan permintaannya 404 dan yang terbaca orangnya:
     "Failed to fetch dynamically imported module".

     App.tsx punya penawarnya (`muat()`, memuat ulang sekali dengan
     parameter pembeda), tapi itu cuma membungkus rute malas — bukan impor
     dinamis di dalam komponen seperti ini.

     Alih-alih menyalin penawar itu ke sini, impornya dijadikan statis.
     Alasannya: penghematannya memang tidak ada. Berkas ini sudah menarik
     lib/data.ts, yang menarik data/contoh.ts — tempat 123 transaksi contoh
     itu SEBENARNYA tinggal. Yang dipecah tadi cuma ~1 kB fungsi tulis.
     Satu kilobita bukan harga yang pantas untuk satu kelas kegagalan.

     Itu tetap benar sesudah berkas ini dipisah: yang mahal (Firestore)
     sekarang cuma ikut ke potongan dashboard, bukan ke bundel awal. */
  async function jalankan(apa: 'impor' | 'hapus') {
    if (!pengguna) return;
    setSibuk(apa); setKabar('');
    try {
      if (apa === 'impor') {
        const n = await imporContoh(pengguna.uid);
        setKabar(`${n} transaksi contoh masuk ke jurnalmu. Angka di seluruh halaman ikut terisi.`);
      } else {
        await hapusImporContoh(pengguna.uid);
        simpanPilihanContoh(pengguna.uid, 'kosong');
        setKabar('Data contoh dihapus. Jurnalmu kembali kosong.');
      }
    } catch (e) {
      setKabar('Gagal: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setSibuk(''); }
  }

  /* KEADAAN 3 didahulukan. Jurnal yang berisi transaksi contoh harus selalu
     mengatakannya — termasuk berbulan-bulan sesudah imporya, saat orangnya
     sudah lupa dan mulai membaca winrate itu sebagai rekam jejaknya sendiri. */
  if (adaContohDiRiwayat(riwayat)) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3">
        <Eye className="size-4 shrink-0 text-amber-400" strokeWidth={2} />
        <span className="text-[12.5px] text-amber-100/90">
          Jurnal ini berisi <b>transaksi contoh</b> hasil impor — bukan hasil tradingmu.
          Hapus kapan saja, transaksimu sendiri tidak ikut terhapus.
        </span>
        <span className="ml-auto flex items-center gap-3">
          {kabar && <span className="text-[11.5px] text-amber-200/70">{kabar}</span>}
          <button onClick={() => void jalankan('hapus')} disabled={!!sibuk}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-50">
            {sibuk === 'hapus' && <Loader2 className="size-3.5 animate-spin" />}
            {sibuk === 'hapus' ? 'Menghapus…' : 'Hapus data contoh'}
          </button>
        </span>
      </div>
    );
  }

  if (!contoh) return null;
  if (bacaPilihanContoh(pengguna.uid) !== null) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-sky-500/25 bg-sky-500/[0.05] px-4 py-3">
      <span className="text-[12.5px] text-sky-200/90">
        Akunmu masih kosong, jadi halaman ini menampilkan <b>data contoh</b> dulu.
        Mau disalin jadi milikmu supaya bisa diutak-atik?
      </span>
      <span className="ml-auto flex items-center gap-3">
        {kabar && <span className="text-[11.5px] text-sky-200/70">{kabar}</span>}
        <button onClick={() => { simpanPilihanContoh(pengguna.uid, 'kosong'); setV((x) => x + 1); }}
          disabled={!!sibuk}
          className="cursor-pointer rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-500 disabled:opacity-50">
          Mulai dari nol
        </button>
        <button onClick={() => void jalankan('impor')} disabled={!!sibuk}
          className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-60">
          {sibuk === 'impor' && <Loader2 className="size-3.5 animate-spin" />}
          {sibuk === 'impor' ? 'Menyalin…' : 'Impor data contoh'}
        </button>
      </span>
    </div>
  );
}

/* Memakai AWALAN_CONTOH yang SUNGGUHAN, bukan salinan tulisan tangan.
   Sempat ditulis ulang di sini waktu impornya masih dinamis — dua tempat
   memegang satu string, dijaga sebaris uji. Begitu impornya jadi statis,
   alasan itu hilang dan salinannya ikut dibuang: yang menulis id dan yang
   mengenalinya sekarang membaca konstanta yang sama persis. */
function adaContohDiRiwayat(riwayat: Trade[]): boolean {
  return riwayat.some((t) => t.id.startsWith(AWALAN_CONTOH));
}
