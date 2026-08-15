import * as React from 'react';
import { cn } from '@/lib/utils';
import { LeaderboardPodium, type LeaderboardRanking } from '@/components/ui/leaderboard-podium';
import { LeaderboardRankings, type LeaderboardRankingItem } from '@/components/ui/leaderboard-rankings';

/* ════════════════════════════════════════════════════════════════════════
   KARTU PAPAN PERINGKAT
   ════════════════════════════════════════════════════════════════════════
   Bentuknya mengikuti komponen yang diminta, dengan tiga penyesuaian yang
   disengaja:

   · Palet zinc gelap, bukan token shadcn (bg-card / text-muted-foreground).
     Token itu tidak ada di proyek ini, dan menambahkannya berarti menyeret
     sistem warna kedua ke antarmuka yang sudah punya satu.
   · Teksnya Indonesia, sama seperti seluruh aplikasi.
   · Ada `catatan` — tempat menyatakan atas dasar apa peringkat ini disusun.
     Papan peringkat tanpa keterangan cara hitungnya mengundang orang
     menyimpulkan sendiri, dan kesimpulan itu biasanya lebih percaya diri
     daripada datanya.
   ════════════════════════════════════════════════════════════════════════ */

export interface LeaderboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  fromDate?: string | Date;
  toDate?: string | Date;
  podiumRankings: LeaderboardRanking[];
  rankings: LeaderboardRankingItem[];
  currentUserId?: string;
  catatan?: React.ReactNode;
}

function formatTanggal(d?: string | Date) {
  if (!d) return '';
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const LeaderboardCard = React.forwardRef<HTMLDivElement, LeaderboardCardProps>(
  ({ className, title = 'Papan Peringkat', fromDate, toDate, podiumRankings, rankings,
     currentUserId, catatan, ...props }, ref) => {
    const dari = formatTanggal(fromDate);
    const sampai = formatTanggal(toDate);

    return (
      <div ref={ref}
        className={cn('rounded-xl border border-zinc-800 bg-zinc-900/40 p-5', className)}
        {...props}>
        <div className="mb-5">
          <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
          {(dari || sampai) && (
            <p className="mt-0.5 text-[11.5px] text-zinc-500">{dari} – {sampai}</p>
          )}
        </div>

        <LeaderboardPodium rankings={podiumRankings} className="mb-6" />

        <LeaderboardRankings
          rankings={rankings}
          currentUserId={currentUserId}
          showPagination
          defaultPageSize={10}
        />

        {catatan && (
          <p className="mt-4 border-t border-zinc-800/60 pt-3 text-[11px] leading-relaxed text-zinc-600">
            {catatan}
          </p>
        )}
      </div>
    );
  },
);
LeaderboardCard.displayName = 'LeaderboardCard';
