import * as React from 'react';
import { Crown, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   TABEL PERINGKAT
   ════════════════════════════════════════════════════════════════════════
   Baris milik orang yang sedang melihat DISOROT dan selalu ikut terlihat,
   walau peringkatnya jauh di bawah halaman yang sedang dibuka. Papan
   peringkat yang mengharuskan orang mencari dirinya sendiri lewat empat
   halaman adalah papan yang tidak dibaca dua kali.
   ════════════════════════════════════════════════════════════════════════ */

export interface LeaderboardRankingItem {
  userId: string;
  rank: number;
  userName: string;
  byline?: string;
  value: number;
  agen?: boolean;
}

function nilaiUang(n: number) {
  const tanda = n < 0 ? '−' : '+';
  const a = Math.abs(n);
  if (a >= 1000) return `${tanda}$${(a / 1000).toFixed(1)}k`;
  return `${tanda}$${a.toFixed(a < 100 ? 1 : 0)}`;
}

function Baris({ r, aku }: { r: LeaderboardRankingItem; aku: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border px-3 py-2',
      aku ? 'border-zinc-600 bg-zinc-800/60' : 'border-transparent hover:bg-zinc-900/60',
    )}>
      <span className="angka w-5 shrink-0 text-center text-[12px] text-zinc-500">{r.rank}</span>
      {r.rank <= 3
        ? <Crown className={cn('size-3.5 shrink-0',
            r.rank === 1 ? 'text-amber-400' : r.rank === 2 ? 'text-zinc-300' : 'text-orange-400')} />
        : <span className="size-3.5 shrink-0" />}
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-[11px] font-semibold text-zinc-200">
        {(r.userName || '?').trim()[0]?.toUpperCase() ?? '?'}
      </span>
      <span className="min-w-0 grow">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] text-zinc-200">{r.userName}</span>
          {r.agen && <Sparkles className="size-3 shrink-0 text-sky-300" aria-label="AI Agent" />}
          {aku && <span className="shrink-0 rounded bg-zinc-700 px-1 text-[9.5px] text-zinc-200">kamu</span>}
        </span>
        {r.byline && <span className="block truncate text-[10.5px] text-zinc-600">{r.byline}</span>}
      </span>
      <span className={cn('angka shrink-0 text-[12.5px] font-semibold',
        r.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
        {nilaiUang(r.value)}
      </span>
    </div>
  );
}

export function LeaderboardRankings({ rankings, currentUserId, showPagination, defaultPageSize = 10 }: {
  rankings: LeaderboardRankingItem[];
  currentUserId?: string;
  showPagination?: boolean;
  defaultPageSize?: number;
}) {
  const [ukuran, setUkuran] = React.useState(defaultPageSize);
  const [hal, setHal] = React.useState(0);

  const jmlHal = Math.max(1, Math.ceil(rankings.length / ukuran));
  /* Halaman dijepit saat daftarnya menyusut — tanpa ini, menyaring daftar
     saat sedang di halaman 3 menampilkan layar kosong tanpa penjelasan. */
  const halAman = Math.min(hal, jmlHal - 1);
  const potong = rankings.slice(halAman * ukuran, halAman * ukuran + ukuran);

  const akuDiPotongan = potong.some((r) => r.userId === currentUserId);
  const aku = rankings.find((r) => r.userId === currentUserId);

  if (!rankings.length) {
    return (
      <p className="py-8 text-center text-[12.5px] leading-relaxed text-zinc-600">
        Belum ada analis yang sinyalnya selesai. Peringkat muncul setelah ada
        sinyal yang menyentuh SL atau TP — bukan setelah ada yang memposting.
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-0.5">
        {potong.map((r) => <Baris key={r.userId} r={r} aku={r.userId === currentUserId} />)}
      </div>

      {/* Baris sendiri ditempel di bawah kalau tidak ikut di halaman ini. */}
      {aku && !akuDiPotongan && (
        <div className="mt-2 border-t border-zinc-800/60 pt-2">
          <Baris r={aku} aku />
        </div>
      )}

      {showPagination && rankings.length > defaultPageSize && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-800/60 pt-3 text-[11.5px] text-zinc-500">
          <label className="flex items-center gap-1.5">
            Tampil
            <select value={ukuran}
              onChange={(e) => { setUkuran(Number(e.target.value)); setHal(0); }}
              className="cursor-pointer rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-zinc-300 outline-none">
              {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className="ml-auto flex items-center gap-2">
            <button onClick={() => setHal((n) => Math.max(0, n - 1))} disabled={halAman === 0}
              aria-label="Halaman sebelumnya"
              className="cursor-pointer rounded p-1 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30">
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="angka">Hal {halAman + 1} dari {jmlHal}</span>
            <button onClick={() => setHal((n) => Math.min(jmlHal - 1, n + 1))} disabled={halAman >= jmlHal - 1}
              aria-label="Halaman berikutnya"
              className="cursor-pointer rounded p-1 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30">
              <ChevronRight className="size-3.5" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
