import { TrendingUp, TrendingDown, X, Check, Ban } from 'lucide-react';
import { cn, uang, harga as fHarga } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   TIKET ORDER DI POJOK CHART
   ════════════════════════════════════════════════════════════════════════
   Ditaruh di atas grafik, bukan di panel terpisah di bawahnya. Alasannya
   bukan kerapian: saat mengambil keputusan mata sedang di chart, dan
   memindahkan pandangan ke bawah layar untuk menekan tombol adalah tempat
   paling sering orang salah tekan arah.

   DUA LANGKAH, BUKAN SATU.
   ──────────────────────────────────────────────────────────────────────
   Menekan BUY tidak membuka posisi. Yang terjadi adalah tiga garis muncul
   di chart — entry, SL, TP — yang bisa digeser sampai letaknya benar, dan
   baru setelah "Kirim" ditekan ordernya berangkat.

   Satu klik yang langsung mengirim order dengan SL hasil tebakan rumus
   adalah cara tercepat memasang stop di tempat yang tidak pernah dipilih
   siapa pun. Level adalah keputusan; tombol hanya menjalankannya.
   ════════════════════════════════════════════════════════════════════════ */

export interface RencanaOrder { entry?: number; sl?: number; tp?: number }

const KELAS_ISIAN =
  'h-7 w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 text-[11px] text-zinc-100 ' +
  'outline-none transition-colors focus-visible:border-zinc-500';

export function PojokOrder({
  posisi, hargaKini, draf, rencana, mode,
  onPilih, onUbah, onKirim, onBatal, onTutup, onGantiMode, mati,
}: {
  posisi: { arah: 'BUY' | 'SELL'; masuk: number; sl: number; tp: number; pnl: number } | null;
  hargaKini?: number;
  /** Arah tiket yang sedang disusun. null = belum ada tiket. */
  draf: 'BUY' | 'SELL' | null;
  rencana: RencanaOrder;
  mode: 'demo' | 'real';
  onPilih: (arah: 'BUY' | 'SELL') => void;
  onUbah: (r: RencanaOrder) => void;
  onKirim: () => void;
  onBatal: () => void;
  onTutup: () => void;
  onGantiMode: (m: 'demo' | 'real') => void;
  mati?: boolean;
}) {
  const nyata = mode === 'real';

  const Lencana = (
    <button onClick={() => onGantiMode(nyata ? 'demo' : 'real')}
      title={nyata ? 'Ganti ke latihan (demo)' : 'Ganti ke order sungguhan (real)'}
      className={cn('cursor-pointer rounded px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide transition-colors',
        nyata ? 'bg-red-500/25 text-red-300 hover:bg-red-500/35'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200')}>
      {nyata ? 'REAL' : 'DEMO'}
    </button>
  );

  /* ── Posisi sudah berjalan ─────────────────────────────────────────── */
  if (posisi) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/90 px-2 py-1.5 backdrop-blur-sm">
        {Lencana}
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

  /* ── Tiket sedang disusun ──────────────────────────────────────────── */
  if (draf) {
    const { entry, sl, tp } = rencana;
    /* Risk : Reward dihitung dari level yang SEDANG terpasang, bukan dari
       setelan. Angka ini satu-satunya cara tahu apakah seretan barusan
       merusak rencananya — dan ia harus ikut berubah selagi digeser. */
    const risk = entry && sl ? Math.abs(entry - sl) : 0;
    const reward = entry && tp ? Math.abs(tp - entry) : 0;
    const rr = risk > 0 && reward > 0 ? reward / risk : null;
    /* SL di sisi yang salah bukan sekadar RR jelek — ia order yang langsung
       kena begitu terkirim. Ditahan di sini, bukan ditolak backend. */
    const arahBenar = !entry || !sl || !tp
      ? false
      : draf === 'BUY' ? sl < entry && tp > entry : sl > entry && tp < entry;

    const Isian = ({ k, label, warna }: { k: 'entry' | 'sl' | 'tp'; label: string; warna: string }) => (
      <label className="block">
        <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide" style={{ color: warna }}>{label}</span>
        <input value={rencana[k] === undefined ? '' : String(Number(rencana[k]!.toFixed(6)))}
               inputMode="decimal"
               onChange={(e) => onUbah({ ...rencana, [k]: Number(e.target.value) || undefined })}
               className={cn(KELAS_ISIAN, 'angka w-[86px]')} />
      </label>
    );

    return (
      <div className={cn('rounded-lg border bg-zinc-900/92 px-2.5 py-2 backdrop-blur-sm',
        nyata ? 'border-red-500/40' : 'border-zinc-700')}>
        <div className="mb-1.5 flex items-center gap-2">
          {Lencana}
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold',
            draf === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
            {draf}
          </span>
          <span className="text-[10.5px] text-zinc-500">geser garisnya di chart</span>
        </div>

        <div className="flex items-end gap-1.5">
          <Isian k="entry" label="Entry" warna="#d4d4d8" />
          <Isian k="sl" label="SL" warna="#f87171" />
          <Isian k="tp" label="TP" warna="#10b981" />
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10.5px] text-zinc-500">
            R:R <span className={cn('angka', rr && rr >= 1.5 ? 'text-emerald-400' : 'text-zinc-300')}>
              {rr ? rr.toFixed(2) : '—'}
            </span>
          </span>
          <button onClick={onKirim} disabled={!arahBenar || mati}
            title={arahBenar ? undefined : 'SL dan TP harus berada di sisi yang benar terhadap entry'}
            className={cn('ml-auto flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              nyata ? 'bg-red-500/25 text-red-200 hover:bg-red-500/35'
                    : 'bg-zinc-100 text-zinc-950 hover:bg-white')}>
            <Check className="size-3" /> {nyata ? 'Kirim order' : 'Kirim'}
          </button>
          <button onClick={onBatal} title="Batalkan tiket"
            className="flex cursor-pointer items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200">
            <Ban className="size-3" /> Batal
          </button>
        </div>
      </div>
    );
  }

  /* ── Diam: pilih arah ──────────────────────────────────────────────── */
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/85 px-1.5 py-1.5 backdrop-blur-sm">
      {Lencana}
      <button onClick={() => onPilih('BUY')} disabled={mati}
        className="flex cursor-pointer items-center gap-1 rounded bg-emerald-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40">
        <TrendingUp className="size-3.5" /> BUY
      </button>
      <button onClick={() => onPilih('SELL')} disabled={mati}
        className="flex cursor-pointer items-center gap-1 rounded bg-red-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40">
        <TrendingDown className="size-3.5" /> SELL
      </button>
      {hargaKini !== undefined && (
        <span className="angka px-1 text-[11px] text-zinc-500">{fHarga(hargaKini)}</span>
      )}
    </div>
  );
}
