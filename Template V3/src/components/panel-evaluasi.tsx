import { useMemo, useState } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { evaluasi, saring } from '@/lib/evaluasi';
import type { Trade } from '@/data/contoh';

/* ════════════════════════════════════════════════════════════════════════
   PANEL EVALUASI PERFORMA
   ════════════════════════════════════════════════════════════════════════
   Bentuknya mengikuti kartu "Basic Info" yang biasa dipakai statistik game:
   satu angka besar di tengah, jaring laba-laba di kanan, rincian di kiri.
   Alasan bentuk itu dipilih bukan gaya-gayaan — jaring laba-laba memang
   bentuk terbaik untuk membandingkan enam ukuran sekaligus, dan yang ingin
   diketahui memang "sisi mana yang penyok", bukan nilai satu per satu.

   Semua angkanya dihitung dari transaksi jurnal; lihat lib/evaluasi.ts untuk
   alasan tiap ambang.
   ════════════════════════════════════════════════════════════════════════ */

const RENTANG = [
  { hari: 30, label: '30 hari' },
  { hari: 90, label: '90 hari' },
  { hari: 0, label: 'Semua' },
];

function warnaSkor(n: number) {
  if (n >= 80) return '#10b981';
  if (n >= 60) return '#84cc16';
  if (n >= 40) return '#f59e0b';
  return '#ef4444';
}

export function PanelEvaluasi({ trade, saldoAwal }: { trade: Trade[]; saldoAwal: number }) {
  const [hari, setHari] = useState(0);
  const hasil = useMemo(() => evaluasi(saring(trade, hari), saldoAwal), [trade, hari, saldoAwal]);

  const dataRadar = hasil.butir.map((b) => ({ butir: b.label.split(' ')[0], skor: Math.round(b.skor) }));
  const warna = warnaSkor(hasil.skorTotal);

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Evaluasi Performa"
        sub="Ukuran yang dipakai firma evaluasi — dihitung dari jurnalmu sendiri."
        kanan={
          <div className="flex overflow-hidden rounded-md border border-zinc-800">
            {RENTANG.map((r) => (
              <button key={r.hari} onClick={() => setHari(r.hari)}
                className={cn('cursor-pointer px-2.5 py-1 text-[11.5px] transition-colors',
                  hari === r.hari ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200')}>
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {!hasil.cukupData ? (
        <div className="px-5 pb-6 pt-2 text-[12.5px] leading-relaxed text-zinc-500">
          Butuh minimal 5 transaksi untuk dinilai — sekarang ada {hasil.jumlah}.
          {/* Menampilkan nilai dari dua transaksi bukan penilaian, itu kebetulan
              yang diberi angka. Lebih baik diam sampai datanya cukup. */}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Kiri: skor besar + rincian butir */}
          <div>
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div>
                <div className="angka text-[44px] font-semibold leading-none tracking-tight" style={{ color: warna }}>
                  {hasil.skorTotal}
                </div>
                <div className="mt-1 text-[12px] text-zinc-500">dari 100</div>
              </div>
              <div className="mb-1">
                <div className="text-[15px] font-medium text-zinc-100">{hasil.peringkat}</div>
                <div className="text-[12px] text-zinc-500">
                  {hasil.jumlah} transaksi dinilai · {hasil.butir.filter((b) => b.lulus).length}/{hasil.butir.length} kriteria lolos
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {hasil.butir.map((b) => (
                <div key={b.kunci}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12.5px] text-zinc-300">
                      {b.label}
                      <span className="angka ml-2 text-[11px] text-zinc-600">{b.nilaiAsli}</span>
                    </span>
                    <span className={cn('angka text-[12px]', b.lulus ? 'text-emerald-500' : 'text-amber-400')}>
                      {Math.round(b.skor)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full transition-[width] duration-500"
                         style={{ width: `${Math.round(b.skor)}%`, background: warnaSkor(b.skor) }} />
                  </div>
                  <div className="mt-1 text-[11.5px] leading-relaxed text-zinc-600">{b.ket}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Kanan: jaring laba-laba */}
          <div className="h-[260px] lg:h-auto">
            <ResponsiveContainer width="100%" height="100%" minHeight={240}>
              <RadarChart data={dataRadar} outerRadius="72%">
                <PolarGrid stroke="rgba(255,255,255,.08)" />
                <PolarAngleAxis dataKey="butir" tick={{ fill: '#71717a', fontSize: 10.5 }} />
                <Tooltip
                  content={({ active, payload }: any) => active && payload?.length ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
                      <div className="text-[11px] text-zinc-500">{payload[0].payload.butir}</div>
                      <div className="angka text-[12.5px] text-zinc-100">{payload[0].value} / 100</div>
                    </div>
                  ) : null}
                />
                <Radar dataKey="skor" stroke={warna} strokeWidth={1.6}
                       fill={warna} fillOpacity={0.18} isAnimationActive={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Panel>
  );
}
