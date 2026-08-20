import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarAnalis } from '@/components/avatar-analis';

/* ════════════════════════════════════════════════════════════════════════
   PODIUM TIGA BESAR
   ════════════════════════════════════════════════════════════════════════
   Bentuknya mengikuti contoh yang diminta: juara 1 di tengah dan paling
   tinggi, 2 di kiri, 3 di kanan. Yang TIDAK diambil dari contohnya adalah
   paletnya — contoh itu memakai token shadcn (bg-card, text-muted-foreground)
   yang tidak ada di proyek ini, dan menambahkannya berarti menyeret satu
   sistem warna kedua ke dalam antarmuka yang seluruhnya sudah zinc gelap.

   Avatar memakai FOTO kalau analisnya mengunggah satu, huruf awal kalau
   tidak. Catatan lama di sini menyebut foto mustahil karena CSP memblokir
   permintaan ke domain penyedia login — itu benar untuk foto Google, dan
   tidak lagi berlaku: foto profil analis disimpan di VPS sendiri dan
   disajikan dari domain yang sama dengan halamannya.
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
  /** Foto profil, kosong kalau analisnya memilih anonim. */
  foto?: string;
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

function Avatar({ nama, peringkat, foto, uid }: {
  nama: string; peringkat: number; foto?: string; uid?: string;
}) {
  /* Cincinnya tetap di sini, BUKAN dipindah ke AvatarAnalis: emas untuk
     juara satu adalah bahasa podium ini sendiri, dan daftar peringkat di
     bawahnya tidak memakainya. */
  return (
    <div className="relative">
      <AvatarAnalis
        nama={nama} foto={foto} uid={uid}
        className={cn('ring-1',
          peringkat === 1 ? 'size-14 ring-amber-500/50' : 'size-11 ring-zinc-700')}
        kelasHuruf={peringkat === 1 ? 'text-[18px]' : 'text-[15px]'}
      />
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

export function LeaderboardPodium({ rankings, className, onPilih }: {
  rankings: LeaderboardRanking[];
  className?: string;
  /** Sama seperti di tabel peringkat: tiga orang yang sama, jadi tiga
   *  panel yang sama-sama bisa ditekan. Podium yang mati sementara
   *  barisnya hidup mengajari orang bahwa tekanannya kadang bekerja. */
  onPilih?: (userId: string) => void;
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
          <div key={r.userId} className={cn('flex w-[30%] max-w-[130px] flex-col items-center',
            onPilih && 'cursor-pointer')}
            {...(onPilih
              ? { role: 'button' as const, tabIndex: 0, title: `Buka performa ${r.userName}`,
                  onClick: () => onPilih(r.userId),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPilih(r.userId); }
                  } }
              : {})}>
            <Avatar nama={r.userName} peringkat={r.rank} foto={r.foto} uid={r.userId} />
            <div className="mt-2.5 w-full truncate text-center text-[11.5px] text-zinc-300" title={r.userName}>
              {r.userName}
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-[9px] uppercase tracking-wide text-zinc-600">PNL</span>
              <span className={cn('angka text-[12.5px] font-semibold',
                r.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {nilaiRingkas(r.value)}
              </span>
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
