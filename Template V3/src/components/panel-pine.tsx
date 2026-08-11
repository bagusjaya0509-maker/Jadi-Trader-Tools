import { useState } from 'react';
import { Code2, Play, Trash2, TriangleAlert, CheckCircle2, RotateCcw } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { jalankanPine, CONTOH_PINE, type HasilPine } from '@/lib/pine';
import type { Lilin } from '@/lib/pasar';

/* ════════════════════════════════════════════════════════════════════════
   PANEL PINE SCRIPT
   ════════════════════════════════════════════════════════════════════════
   Tempel indikator Pine, jalankan, dan hasil `plot()`-nya digambar di chart
   yang sama dengan harga.

   Skripnya disimpan per perangkat: indikator yang sedang dikembangkan tidak
   seharusnya hilang karena tab tertutup.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.pineKode';

export function PanelPine({ lilin, aturHasil }: {
  lilin: Lilin;
  aturHasil: (h: HasilPine | null) => void;
}) {
  const [kode, setKode] = useState(() => {
    try { return localStorage.getItem(KUNCI) ?? CONTOH_PINE; } catch { return CONTOH_PINE; }
  });
  const [hasil, setHasil] = useState<HasilPine | null>(null);
  const [buka, setBuka] = useState(false);

  function simpanKode(v: string) {
    setKode(v);
    try { localStorage.setItem(KUNCI, v); } catch { /* mode privat */ }
  }

  function jalankan() {
    if (!lilin.closes.length) return;
    const h = jalankanPine(kode, lilin);
    setHasil(h);
    /* Plot tetap dikirim ke chart meski ADA galat: skrip sepuluh baris yang
       satu barisnya salah masih menghasilkan sembilan garis yang benar, dan
       membuang semuanya membuat perbaikan jadi menebak dalam gelap. */
    aturHasil(h.plot.length ? h : null);
  }

  function bersihkan() {
    setHasil(null);
    aturHasil(null);
  }

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Pine Script"
        sub="Tempel indikator, jalankan, garisnya muncul di chart di atas."
        kanan={
          <span className="flex items-center gap-2">
            <button onClick={() => setBuka((v) => !v)}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
              <Code2 className="size-3.5" /> {buka ? 'Sembunyikan' : 'Buka editor'}
            </button>
            {hasil && (
              <button onClick={bersihkan}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-500 transition-colors hover:border-red-500/30 hover:text-red-400">
                <Trash2 className="size-3.5" /> Hapus dari chart
              </button>
            )}
          </span>
        }
      />

      {buka && (
        <div className="px-5 pb-5">
          <textarea
            value={kode} onChange={(e) => simpanKode(e.target.value)} spellCheck={false} rows={14}
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-200 outline-none focus-visible:border-zinc-600"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={jalankan} disabled={!lilin.closes.length}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
              <Play className="size-3.5" /> Jalankan di chart
            </button>
            <button onClick={() => simpanKode(CONTOH_PINE)}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
              <RotateCcw className="size-3.5" /> Contoh
            </button>
          </div>

          {hasil && (
            <div className="mt-3 space-y-2">
              {hasil.plot.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <div className="text-[12.5px] text-zinc-300">
                    {hasil.plot.length} garis digambar:{' '}
                    {hasil.plot.map((p) => (
                      <span key={p.judul} className="mr-2 inline-flex items-center gap-1">
                        <span className="size-2 rounded-sm" style={{ background: p.warna }} />
                        {p.judul}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {hasil.galat.length > 0 && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3">
                  <div className="mb-1 flex items-center gap-2 text-[12.5px] text-amber-300">
                    <TriangleAlert className="size-4" /> {hasil.galat.length} baris ditolak
                  </div>
                  <ul className="space-y-0.5 font-mono text-[11.5px] text-amber-200/80">
                    {hasil.galat.map((g) => <li key={g}>{g}</li>)}
                  </ul>
                </div>
              )}

              {hasil.dilewati.length > 0 && (
                <details className="rounded-lg border border-zinc-800/60 p-3">
                  <summary className="cursor-pointer text-[12px] text-zinc-500">
                    {hasil.dilewati.length} baris dilewati (bukan penetapan variabel atau plot)
                  </summary>
                  <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-zinc-600">
                    {hasil.dilewati.map((g) => <li key={g}>{g}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Batasnya ditulis TERBUKA, bukan ditemukan sendiri saat gagal. */}
          <div className="mt-3 border-t border-zinc-800/60 pt-3 text-[11.5px] leading-relaxed text-zinc-600">
            <span className="text-zinc-400">Yang didukung:</span> penetapan variabel (termasuk{' '}
            <span className="font-mono">var</span> dan argumen bernama), <span className="font-mono">input.*</span>{' '}
            (memakai nilai bawaannya), aritmetika, perbandingan, riwayat <span className="font-mono">[n]</span>,
            sumber harga (<span className="font-mono">open high low close hl2 hlc3 ohlc4</span>),{' '}
            <span className="font-mono">ta.sma ema rma wma atr rsi stdev highest lowest change
            cross crossover crossunder</span>, <span className="font-mono">math.*</span>,{' '}
            <span className="font-mono">nz</span>, judul & warna dari argumen plot (termasuk{' '}
            <span className="font-mono">color.new</span>), plus fungsi khusus{' '}
            <span className="font-mono">jt.smi() jt.smiSignal() jt.pivotHigh(l,r) jt.pivotLow(l,r)</span>{' '}
            yang memakai perhitungan sama persis dengan Screener Entry. Keluaran lewat{' '}
            <span className="font-mono">plot()</span> dan <span className="font-mono">hline()</span>.
            <div className="mt-1.5">
              <span className="text-zinc-400">Yang belum:</span>{' '}
              <span className="font-mono">request.security</span>, <span className="font-mono">strategy.*</span>,
              percabangan <span className="font-mono">if</span>, perulangan, larik, dan tipe kustom.
              Perintah gambar (<span className="font-mono">fill bgcolor plotshape line.new label box</span>)
              dilewati tanpa menghentikan skrip — garis utamanya tetap tergambar.
              Baris yang memakainya ditolak dengan menyebut nomor barisnya — bukan diam-diam
              menghasilkan angka yang salah, karena indikator yang salah tanpa suara jauh lebih
              berbahaya daripada indikator yang menolak jalan.
            </div>
          </div>
        </div>
      )}

      {!buka && (
        <p className={cn('px-5 pb-5 text-[12px] leading-relaxed', hasil ? 'text-zinc-400' : 'text-zinc-500')}>
          {hasil
            ? `${hasil.plot.length} garis dari skripmu sedang tergambar di chart.`
            : 'Indikator Pine milikmu bisa dijalankan langsung di chart ini — EMA, RSI, ATR, pivot, dan SMI dipakai dari perhitungan yang sama dengan Screener Entry.'}
        </p>
      )}
    </Panel>
  );
}
