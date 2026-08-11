import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { cn, uang, harga as fHarga } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   TOMBOL BUY / SELL DI POJOK CHART
   ════════════════════════════════════════════════════════════════════════
   Ditaruh di atas grafik, bukan di panel terpisah di bawahnya. Alasannya
   bukan kerapian: saat mengambil keputusan, mata sedang di chart — dan
   memindahkan pandangan ke bawah layar untuk menekan tombol adalah tempat
   paling sering orang salah tekan arah.

   Kompak dengan sengaja. Setelan ukuran dan risiko tetap di panel replay;
   yang ada di sini hanya perbuatan yang harus cepat.
   ════════════════════════════════════════════════════════════════════════ */

export function PojokOrder({ posisi, hargaKini, onBuka, onTutup, mati }: {
  posisi: { arah: 'BUY' | 'SELL'; masuk: number; sl: number; tp: number; pnl: number } | null;
  hargaKini?: number;
  onBuka: (arah: 'BUY' | 'SELL') => void;
  onTutup: () => void;
  mati?: boolean;
}) {
  if (posisi) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/90 px-2 py-1.5 backdrop-blur-sm">
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold',
          posisi.arah === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
          {posisi.arah}
        </span>
        <span className="angka text-[11px] text-zinc-400">{fHarga(posisi.masuk)}</span>
        <span className={cn('angka text-[11.5px] font-medium', posisi.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {uang(posisi.pnl, true)}
        </span>
        <button onClick={onTutup} title="Tutup posisi"
          className="flex cursor-pointer items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-500">
          <X className="size-3" /> Tutup
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/85 px-1.5 py-1.5 backdrop-blur-sm">
      <button onClick={() => onBuka('BUY')} disabled={mati}
        className="flex cursor-pointer items-center gap-1 rounded bg-emerald-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40">
        <TrendingUp className="size-3.5" /> BUY
      </button>
      <button onClick={() => onBuka('SELL')} disabled={mati}
        className="flex cursor-pointer items-center gap-1 rounded bg-red-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40">
        <TrendingDown className="size-3.5" /> SELL
      </button>
      {hargaKini !== undefined && (
        <span className="angka px-1 text-[11px] text-zinc-500">{fHarga(hargaKini)}</span>
      )}
    </div>
  );
}
