import * as React from 'react';
import { Crown, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarAnalis } from '@/components/avatar-analis';

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
  /** Foto profil, kosong kalau analisnya memilih anonim. */
  foto?: string;
}

function nilaiUang(n: number) {
  const tanda = n < 0 ? '−' : '+';
  const a = Math.abs(n);
  if (a >= 1000) return `${tanda}$${(a / 1000).toFixed(1)}k`;
  return `${tanda}$${a.toFixed(a < 100 ? 1 : 0)}`;
}

function Baris({ r, aku, onPilih }: {
  r: LeaderboardRankingItem; aku: boolean; onPilih?: (userId: string) => void;
}) {
  /* onPilih, BUKAN prop `to`. Berkas ini primitif tampilan dan sengaja
     tidak tahu apa-apa soal react-router — memberinya alamat berarti
     setiap pemakai berikutnya mewarisi keputusan rute halaman ini.
     Ongkosnya disadari: sebagai tombol ia tidak bisa dibuka di tab baru
     dengan klik tengah. Yang dituju sub-halaman di rute yang sama, bukan
     dokumen berdiri sendiri, jadi tab baru memang bukan yang dicari. */
  const Bungkus = onPilih ? 'button' : 'div';
  return (
    <Bungkus
      {...(onPilih
        ? { type: 'button' as const, onClick: () => onPilih(r.userId),
            title: `Buka performa ${r.userName}` }
        : {})}
      className={cn(
      'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left',
      onPilih && 'cursor-pointer transition-colors',
      aku ? 'border-zinc-600 bg-zinc-800/60' : 'border-transparent hover:bg-zinc-900/60',
    )}>
      <span className="angka w-5 shrink-0 text-center text-[12px] text-zinc-500">{r.rank}</span>
      {r.rank <= 3
        ? <Crown className={cn('size-3.5 shrink-0',
            r.rank === 1 ? 'text-amber-400' : r.rank === 2 ? 'text-zinc-300' : 'text-orange-400')} />
        : <span className="size-3.5 shrink-0" />}
      <AvatarAnalis nama={r.userName} foto={r.foto} uid={r.userId}
                    className="size-7" kelasHuruf="text-[11px]" />
      <span className="min-w-0 grow">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] text-zinc-200">{r.userName}</span>
          {r.agen && <Sparkles className="size-3 shrink-0 text-sky-300" aria-label="AI Agent" />}
          {aku && <span className="shrink-0 rounded bg-zinc-700 px-1 text-[9.5px] text-zinc-200">kamu</span>}
        </span>
        {r.byline && <span className="block truncate text-[10.5px] text-zinc-600">{r.byline}</span>}
      </span>
      {/* ANGKANYA DIBERI NAMA. Tanpa label, "+$66.8" di ujung kanan baris
          bisa terbaca sebagai harga, saldo, atau biaya berlangganan —
          tiga hal yang sama masuk akalnya di halaman ini. */}
      <span className="shrink-0 text-[9.5px] uppercase tracking-wide text-zinc-600">PNL</span>
      <span className={cn('angka shrink-0 text-[12.5px] font-semibold',
        r.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
        {nilaiUang(r.value)}
      </span>
    </Bungkus>
  );
}

export function LeaderboardRankings({ rankings, currentUserId, showPagination, defaultPageSize = 10, onPilih }: {
  rankings: LeaderboardRankingItem[];
  currentUserId?: string;
  showPagination?: boolean;
  defaultPageSize?: number;
  /** Dipanggil saat sebuah baris ditekan. Tidak diberikan = barisnya
   *  sekadar tampilan, persis seperti sebelumnya. */
  onPilih?: (userId: string) => void;
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
        {potong.map((r) => <Baris key={r.userId} r={r} aku={r.userId === currentUserId} onPilih={onPilih} />)}
      </div>

      {/* Baris sendiri ditempel di bawah kalau tidak ikut di halaman ini. */}
      {aku && !akuDiPotongan && (
        <div className="mt-2 border-t border-zinc-800/60 pt-2">
          <Baris r={aku} aku onPilih={onPilih} />
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
