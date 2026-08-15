import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, uang } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   KALENDER UNTUNG-RUGI
   ════════════════════════════════════════════════════════════════════════
   Dulu tinggal di dalam Jurnal.tsx. Diangkat ke sini saat halaman Performa
   Signal membutuhkan kalender yang sama persis — dan menyalinnya berarti
   dua salinan yang akan berselisih pelan-pelan, termasuk salinan dari bug
   zona waktu di bawah yang sudah pernah diperbaiki sekali.

   Satu prop: peta `YYYY-MM-DD` -> nilai. Sumbernya boleh apa saja —
   transaksi jurnal, hasil sinyal — karena komponen ini tidak tahu dan tidak
   perlu tahu angkanya berasal dari mana.
   ════════════════════════════════════════════════════════════════════════ */

export function KalenderPl({ pl, satuanNol = 'Total bulan ini' }: {
  pl: Map<string, number>;
  /** Label baris total. Jurnal menyebutnya "Total bulan ini"; halaman lain
   *  boleh menyebutnya lain tanpa perlu menyalin seluruh komponen. */
  satuanNol?: string;
}) {
  /* Bulan yang sedang dilihat, sebagai offset dari bulan berjalan.
     0 = bulan ini, -1 = bulan lalu. Menyimpan offset, bukan objek Date,
     membuat "maju/mundur satu bulan" tidak perlu memikirkan panjang bulan
     maupun pergantian tahun — Date(tahun, bulan-1, 1) sudah benar sendiri
     bahkan untuk Januari. */
  const [geserBulan, setGeserBulan] = useState(0);

  /* Bulan-bulan yang BENAR-BENAR punya isi, dari data. Dipakai untuk tombol
     lompat: menawarkan Maret yang kosong sama saja dengan menyuruh orang
     menebak-nebak di mana datanya. */
  const bulanBerisi = useMemo(() => {
    const set = new Set<string>();
    pl.forEach((_, kunci) => set.add(kunci.slice(0, 7)));
    return [...set].sort();
  }, [pl]);

  const acuan = new Date();
  const dilihat = new Date(acuan.getFullYear(), acuan.getMonth() + geserBulan, 1);
  const tahun = dilihat.getFullYear();
  const bulan = dilihat.getMonth();
  const jmlHari = new Date(tahun, bulan + 1, 0).getDate();
  const geser = (new Date(tahun, bulan, 1).getDay() + 6) % 7;
  const maks = Math.max(1, ...[...pl.values()].map(Math.abs));

  const sel: (null | { hari: number; nilai?: number })[] = [
    ...Array(geser).fill(null),
    ...Array.from({ length: jmlHari }, (_, i) => ({
      hari: i + 1,
      /* Kunci tanggal LOKAL, bukan toISOString(). toISOString() mengubah ke
         UTC, jadi tanggal 1 jam 00:00 WIB jatuh ke tanggal 30 bulan lalu —
         dan seluruh kalender bergeser satu hari. */
      nilai: pl.get(`${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`),
    })),
  ];
  const total = sel.reduce((s, c) => s + (c?.nilai ?? 0), 0);

  const kunciDilihat = `${tahun}-${String(bulan + 1).padStart(2, '0')}`;
  const adaData = bulanBerisi.includes(kunciDilihat);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={() => setGeserBulan((n) => n - 1)} aria-label="Bulan sebelumnya"
          className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-[12.5px] text-zinc-300">
          {dilihat.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          {!adaData && <span className="ml-1.5 text-[11px] text-zinc-600">· kosong</span>}
        </span>
        <button onClick={() => setGeserBulan((n) => Math.min(0, n + 1))} disabled={geserBulan >= 0}
          aria-label="Bulan berikutnya"
          className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Lompat langsung ke bulan yang ada isinya. Menekan panah enam kali
          untuk sampai ke Juli adalah gesekan yang tidak perlu ketika
          daftarnya sudah kita punya. */}
      {bulanBerisi.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {bulanBerisi.map((b) => {
            const [y, m] = b.split('-').map(Number);
            const off = (y - acuan.getFullYear()) * 12 + (m - 1 - acuan.getMonth());
            return (
              <button key={b} onClick={() => setGeserBulan(off)}
                className={cn('cursor-pointer rounded px-1.5 py-0.5 text-[10.5px] transition-colors',
                  off === geserBulan ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 text-zinc-500 hover:text-zinc-200')}>
                {new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-2 grid grid-cols-7 gap-1">
        {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => (
          <div key={i} className="text-center text-[10.5px] text-zinc-600">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {sel.map((c, i) => {
          if (!c) return <div key={i} />;
          const ada = typeof c.nilai === 'number';
          const untung = (c.nilai ?? 0) >= 0;
          const kuat = ada ? Math.min(0.45, (Math.abs(c.nilai!) / maks) * 0.45) : 0;
          return (
            <div
              key={i}
              title={ada ? `${c.hari}: ${uang(c.nilai!)}` : undefined}
              className={cn(
                'flex aspect-square flex-col items-center justify-center rounded-md border text-[10.5px]',
                ada ? (untung ? 'border-emerald-500/25' : 'border-red-500/25') : 'border-zinc-800/50 text-zinc-600'
              )}
              style={ada ? { background: untung ? `rgba(16,185,129,${kuat})` : `rgba(239,68,68,${kuat})` } : undefined}
            >
              <span className={ada ? 'text-zinc-200' : ''}>{c.hari}</span>
              {ada && (
                <span className={cn('angka text-[8.5px]', untung ? 'text-emerald-400' : 'text-red-400')}>
                  {c.nilai! >= 0 ? '+' : ''}{c.nilai!.toFixed(0)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-[12.5px]">
        <span className="text-zinc-500">{satuanNol}</span>
        <span className={cn('angka', total >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(total, true)}</span>
      </div>
    </div>
  );
}
