import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Memuat } from '@/components/memuat';

/* ════════════════════════════════════════════════════════════════════════
   WALLET TRACKING
   ════════════════════════════════════════════════════════════════════════
   Tiga sub-halaman yang menjawab tiga pertanyaan berbeda tentang uang orang
   lain — dan itulah alasan ketiganya duduk di satu menu:

     Dompet Pantauan — dompet perp on-chain siapa yang sedang dipegang apa
     Posisi Copy     — mana yang kita ikuti, dan bagaimana hasilnya
     Coin Hunter     — koin presale yang ditunggu listingnya

   ── KENAPA DIPINDAH KE SINI ─────────────────────────────────────────────
   Dompet Pantauan dulu tinggal DI DALAM satu kanal di Copy Signal: ia baru
   terlihat sesudah orang membuka kartu agen "AI Wallet". Halaman yang cuma
   bisa ditemukan lewat halaman lain akan dibuka jauh lebih jarang daripada
   yang pantas — dan yang ini justru salah satu yang paling menarik untuk
   dilihat orang baru.

   Sekarang ia punya barisnya sendiri di sidebar. Kanal "AI Wallet" di Copy
   Signal tetap ada sebagai kartu agen, tapi membukanya mengarahkan ke sini:
   satu isi, satu tempat. Dua salinan yang sama-sama hidup adalah dua
   tempat yang harus diperbaiki setiap kali ada satu perubahan.

   ── SUB-HALAMAN DIBACA DARI ALAMAT ──────────────────────────────────────
   Pola yang sama dengan Copy Signal dan Maintenance: `?sub=…`, supaya
   sidebar bisa menunjuk langsung ke tab mana pun dan tautannya bisa
   dikirim ke orang lain. Tab yang cuma hidup di dalam state tidak bisa
   ditaut siapa pun.
   ════════════════════════════════════════════════════════════════════════ */

/* Ketiganya dimuat malas dan itu bukan formalitas. Dompet Pantauan menarik
   keadaan tiap 60 detik; Coin Hunter memanggil GeckoTerminal tiap 60 detik.
   Menyeret keduanya ke bundel halaman berarti pembaca yang cuma membuka
   salah satunya tetap mengunduh kode yang satunya lagi. */
const PanelWalletAgen = lazy(() =>
  import('@/components/panel-wallet-agen').then((m) => ({ default: m.PanelWalletAgen })));
const CoinHunter = lazy(() => import('@/halaman/CoinListing'));

const SUB = [
  { id: 'dompet', label: 'Dompet Pantauan' },
  /* Hanya pemilik. Setelan salin digerbangi server dan tidak ada pembaca
     lain yang punya satu pun barisnya — tab yang selamanya kosong mengajari
     orang bahwa tab di halaman ini tidak selalu berisi, dan pelajaran itu
     ia bawa ke tab yang sebenarnya berisi. */
  { id: 'copy', label: 'Posisi Copy', hanyaPemilik: true },
  { id: 'hunter', label: 'Coin Hunter' },
] as const;

type IdSub = typeof SUB[number]['id'];

export default function WalletTracking() {
  const { pemilik } = useAuth();
  const [cari, setCari] = useSearchParams();

  const tampil = SUB.filter((s) => !('hanyaPemilik' in s && s.hanyaPemilik) || pemilik);

  /* Sub yang diminta alamat hanya diterima kalau ia benar-benar ada di
     daftar yang tampil. Tanpa syarat itu, `?sub=copy` yang ditebak-tebak
     akan menggambar bilah tab dengan tab terpilih yang tombolnya tidak ada
     di mana pun — layar yang tidak bisa ditinggalkan tanpa menyunting
     alamat. Gerbang sungguhannya tetap di server; yang ini menjaga layarnya
     tidak pernah mencoba. */
  const diminta = cari.get('sub') as IdSub | null;
  const sub: IdSub = diminta && tampil.some((s) => s.id === diminta) ? diminta : 'dompet';

  /* Bawaan TIDAK ditulis ke alamat, sisanya ditulis. Menyunting parameter
     yang sedang berlaku, bukan menulis objek baru: bentuk yang menyerahkan
     objek utuh menghapus parameter lain yang kebetulan sedang menempel. */
  const pindah = (id: IdSub) => {
    const b = new URLSearchParams(cari);
    if (id === 'dompet') b.delete('sub'); else b.set('sub', id);
    setCari(b, { replace: true });
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-start gap-2.5">
        <Wallet className="mt-0.5 size-5 shrink-0 text-zinc-500" strokeWidth={1.8} />
        <div className="min-w-0">
          <h1 className="text-[16px] font-semibold text-zinc-100">Wallet Tracking</h1>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">
            Mengikuti uang yang bergerak di on-chain — dompet perp yang dipantau,
            posisi yang kita ikuti, dan koin presale yang menunggu listing.
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-zinc-800">
        {tampil.map((s) => (
          <button key={s.id} onClick={() => pindah(s.id)}
            className={cn('-mb-px cursor-pointer border-b-2 px-3 py-1.5 text-[12.5px] transition-colors',
              sub === s.id ? 'border-zinc-100 font-medium text-zinc-100'
                           : 'border-transparent text-zinc-500 hover:text-zinc-300')}>
            {s.label}
          </button>
        ))}
      </div>

      <Suspense fallback={<Memuat pesan="Memuat panel…" />}>
        {sub === 'hunter'
          ? <CoinHunter tanpaBantalan />
          /* Bilah tab digambar DI SINI, jadi panelnya diminta tidak
             menggambar bilahnya sendiri — dua bilah tab bertumpuk untuk
             pilihan yang sama persis adalah cacat yang paling mudah dibuat
             saat memindahkan komponen ke halaman baru. */
          : <PanelWalletAgen pemilik={pemilik} tab={sub === 'copy' ? 'salin' : 'dompet'} />}
      </Suspense>
    </div>
  );
}
