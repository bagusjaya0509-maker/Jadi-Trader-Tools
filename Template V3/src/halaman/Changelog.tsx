import { Sparkles, Plus, Wrench, ArrowUpRight, Rss } from 'lucide-react';
import { Panel } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { CHANGELOG, type ButirRilis } from '@/data/notifikasi';

/* ════════════════════════════════════════════════════════════════════════
   CHANGELOG — laporan fitur terbaru
   ════════════════════════════════════════════════════════════════════════
   Rilis teratas dapat perlakuan berbeda: satu paragraf "kenapa ini dibuat",
   bukan cuma daftar butir. Daftar butir menjawab APA yang berubah; hanya
   paragraf yang bisa menjawab kenapa itu layak dibaca — dan pertanyaan kedua
   itu yang menentukan orang membuka changelog lagi bulan depan.
   ════════════════════════════════════════════════════════════════════════ */

const GAYA: Record<ButirRilis['jenis'], { label: string; kelas: string; Ikon: typeof Plus }> = {
  baru:        { label: 'Baru',      kelas: 'bg-emerald-500/12 text-emerald-400', Ikon: Plus },
  peningkatan: { label: 'Perbaikan', kelas: 'bg-sky-500/12 text-sky-400',         Ikon: ArrowUpRight },
  perbaikan:   { label: 'Bug fix',   kelas: 'bg-amber-500/12 text-amber-400',     Ikon: Wrench },
};

function Butir({ b }: { b: ButirRilis }) {
  const { label, kelas, Ikon } = GAYA[b.jenis];
  return (
    <li className="flex gap-3">
      <span className={cn('mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[10px] font-medium', kelas)}>
        <Ikon className="size-2.5" strokeWidth={2.6} />
        {label}
      </span>
      <span className="text-[13px] leading-relaxed text-zinc-300">{b.teks}</span>
    </li>
  );
}

export default function Changelog() {
  const [terbaru, ...lama] = CHANGELOG;

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        {/* ── Rilis terbaru ── */}
        <Panel className="overflow-hidden border-zinc-700/70">
          <div className="border-b border-zinc-800/80 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-medium text-amber-400">
                <Sparkles className="size-3" strokeWidth={2.4} /> Rilis terbaru
              </span>
              <span className="angka rounded-md border border-zinc-800 px-2 py-0.5 text-[11.5px] text-zinc-300">
                {terbaru.versi}
              </span>
              <span className="text-[11.5px] text-zinc-500">{terbaru.tanggal}</span>
            </div>

            <h1 className="mt-3 text-[24px] font-semibold leading-tight tracking-tight text-zinc-50">
              {terbaru.judul}
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-400">{terbaru.ringkas}</p>

            {terbaru.sorotan && (
              <p className="mt-4 border-l-2 border-zinc-700 pl-4 text-[13px] leading-relaxed text-zinc-400">
                {terbaru.sorotan}
              </p>
            )}
          </div>

          <ul className="space-y-3 p-6">
            {terbaru.butir.map((b, i) => <Butir key={i} b={b} />)}
          </ul>
        </Panel>

        {/* ── Rilis sebelumnya ── */}
        <div className="mb-3 mt-8 flex items-center gap-2 px-1">
          <Rss className="size-3.5 text-zinc-600" strokeWidth={2} />
          <h2 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">Rilis sebelumnya</h2>
        </div>

        <div className="space-y-4">
          {lama.map((r) => (
            <Panel key={r.versi} className="p-5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="angka text-[13px] font-semibold text-zinc-100">{r.versi}</span>
                <span className="text-[14px] font-medium tracking-tight text-zinc-200">{r.judul}</span>
                <span className="ml-auto text-[11.5px] text-zinc-600">{r.tanggal}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-zinc-500">{r.ringkas}</p>
              <ul className="mt-3.5 space-y-2.5">
                {r.butir.map((b, i) => <Butir key={i} b={b} />)}
              </ul>
            </Panel>
          ))}
        </div>

        <p className="mt-8 px-1 text-[11.5px] leading-relaxed text-zinc-600">
          Rilis lebih lama dari v3.1 tidak dicatat di sini — versi 1 dan 2 masih satu berkas HTML
          tanpa nomor rilis, dan menuliskan riwayatnya sekarang hanya akan jadi rekaan.
        </p>
      </div>
    </div>
  );
}
