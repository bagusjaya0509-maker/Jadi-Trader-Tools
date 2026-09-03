import { Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { PanelDex } from '@/components/panel-dex';

/* ════════════════════════════════════════════════════════════════════════
   DEX TRADING — HALAMANNYA
   ════════════════════════════════════════════════════════════════════════
   Isinya PINDAH ke `components/panel-dex.tsx` 3 Sep 2026, dan halaman ini
   tinggal bingkainya: judul, gerbang pemilik, dan padding.

   Sebabnya panel yang sama kini juga dipasang di sisi chart di Chart &
   Entry. Menyalinnya ke sana berarti dua panel order yang harus dijaga
   tetap sepakat — dan yang tidak sepakat di antara dua panel order adalah
   ke mana uangnya berangkat.

   Gerbang `pemilik` tinggal DI SINI dan di penyambung yang satunya, bukan
   di dalam panelnya: panel adalah alat, dan yang berhak memutuskan siapa
   boleh memegang alat adalah yang memasangnya.
   ════════════════════════════════════════════════════════════════════════ */

export default function DexTrading() {
  const { pemilik } = useAuth();

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-start gap-2.5">
        <Wallet className="mt-0.5 size-5 shrink-0 text-zinc-500" strokeWidth={1.8} />
        <div className="min-w-0">
          <h1 className="text-[16px] font-semibold text-zinc-100">
            DEX Trading <span className="ml-1 align-middle text-[10.5px] font-medium text-amber-400">PROTOTIPE</span>
          </h1>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">
            Hubungkan dompet Anda sendiri dan trading langsung di Hyperliquid — tanpa
            menitipkan kunci, tanpa lewat server kami.
          </p>
        </div>
      </div>

      {!pemilik ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-[12.5px] leading-relaxed text-zinc-400">
          Halaman ini masih terbatas untuk pemilik. Ia mengirim order uang sungguhan ke
          Hyperliquid, dan gerbangnya dibuka setelah ada pendapat hukum — bukan setelah
          kodenya rapi.
        </div>
      ) : (
        <PanelDex />
      )}
    </div>
  );
}
