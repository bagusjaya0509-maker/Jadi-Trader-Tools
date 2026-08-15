import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   PODIUM TIGA BESAR
   ════════════════════════════════════════════════════════════════════════
   Bentuknya mengikuti contoh yang diminta: juara 1 di tengah dan paling
   tinggi, 2 di kiri, 3 di kanan. Yang TIDAK diambil dari contohnya adalah
   paletnya — contoh itu memakai token shadcn (bg-card, text-muted-foreground)
   yang tidak ada di proyek ini, dan menambahkannya berarti menyeret satu
   sistem warna kedua ke dalam antarmuka yang seluruhnya sudah zinc gelap.

   Avatar memakai huruf awal, bukan foto. Analis di sini dikenali dari nama
   akunnya; menarik foto profil dari penyedia login berarti mengirim
   permintaan ke domain lain untuk setiap baris papan peringkat, dan CSP di
   halaman ini memblokirnya.
   ════════════════════════════════════════════════════════════════════════ */

export interface LeaderboardRanking {
  userId: string;
  userName: string;
  rank: number;
  value: number;
  /** Keterangan kecil di bawah nilai — mis. "72% · 18 sinyal". */
  byline?: string;
  /** Ditulis agen AI, bukan orang. Dipakai menandai barisnya. */
  agen?: boolean;
}

/** Tinggi balok per peringkat. Bukan sekadar hiasan: beda tingginya yang
 *  membuat urutan terbaca sekejap tanpa harus membaca angkanya. */
const TINGGI: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' };
const WARNA: Record<number, string> = {
  1: 'bg-gradient-to-b from-amber-400/30 to-amber-500/10 border-amber-500/40',
  2: 'bg-gradient-to-b from-zinc-400/20 to-zinc-500/5 border-zinc-500/40',
  3: 'bg-gradient-to-b from-orange-700/25 to-orange-800/10 border-orange-700/40',
};
const MAHKOTA: Record<number, string> = { 1: 'text-amber-400', 2: 'text-zinc-300', 3: 'text-orange-400' };

function Avatar({ nama, peringkat }: { nama: string; peringkat: number }) {
  const huruf = (nama || '?').trim()[0]?.toUpperCase() ?? '?';
  return (
    <div className="relative">
      <div className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 font-semibold text-zinc-100 ring-1',
        peringkat === 1 ? 'size-14 text-[18px] ring-amber-500/50' : 'size-11 text-[15px] ring-zinc-700',
      )}>
        {huruf}
      </div>
      <Crown className={cn('absolute -bottom-1 left-1/2 size-4 -translate-x-1/2', MAHKOTA[peringkat])}
             strokeWidth={2.5} />
    </div>
  );
}

function nilaiRingkas(n: number) {
  const tanda = n < 0 ? '-' : '+';
  const a = Math.abs(n);
  if (a >= 1000) return `${tanda}$${(a / 1000).toFixed(1)}k`;
  return `${tanda}$${a.toFixed(0)}`;
}

export function LeaderboardPodium({ rankings, className }: {
  rankings: LeaderboardRanking[];
  className?: string;
}) {
  /* Urutan TAMPILAN 2-1-3, bukan urutan data. Dicari per peringkat, bukan
     diambil per indeks: papan dengan kurang dari tiga analis tidak boleh
     menaruh orang di podium yang bukan miliknya. */
  const cari = (r: number) => rankings.find((x) => x.rank === r);
  const susunan = [cari(2), cari(1), cari(3)];
  if (!cari(1)) return null;

  return (
    <div className={cn('flex items-end justify-center gap-3', className)}>
      {susunan.map((r, i) =>
        r ? (
          <div key={r.userId} className="flex w-[30%] max-w-[130px] flex-col items-center">
            <Avatar nama={r.userName} peringkat={r.rank} />
            <div className="mt-2.5 w-full truncate text-center text-[11.5px] text-zinc-300" title={r.userName}>
              {r.userName}
            </div>
            <div className={cn('angka text-center text-[12.5px] font-semibold',
              r.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {nilaiRingkas(r.value)}
            </div>
            {r.byline && (
              <div className="truncate text-center text-[10px] text-zinc-600" title={r.byline}>{r.byline}</div>
            )}
            <div className={cn('mt-2 flex w-full items-start justify-center rounded-t-lg border border-b-0 pt-1.5',
              TINGGI[r.rank], WARNA[r.rank])}>
              <span className="angka text-[13px] font-semibold text-zinc-200">{r.rank}</span>
            </div>
          </div>
        ) : (
          /* Slot kosong tetap memakan tempat supaya juara 1 tidak bergeser
             dari tengah saat analisnya baru dua orang. */
          <div key={`kosong-${i}`} className="w-[30%] max-w-[130px]" aria-hidden />
        ),
      )}
    </div>
  );
}
