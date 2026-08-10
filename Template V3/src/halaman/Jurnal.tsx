import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Plus, Pencil } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, BadgeTren, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, tanggalPendek } from '@/lib/utils';
import { statGabungan, kurvaEkuitas, plPerHari } from '@/lib/hitung';
import { useRiwayat, useSaldoAwal } from '@/lib/data';
import { LabelContoh } from '@/components/gerbang';

function Kalender({ pl }: { pl: Map<string, number> }) {
  const kini = new Date();
  const tahun = kini.getFullYear();
  const bulan = kini.getMonth();
  const jmlHari = new Date(tahun, bulan + 1, 0).getDate();
  const geser = (new Date(tahun, bulan, 1).getDay() + 6) % 7;
  const maks = Math.max(1, ...[...pl.values()].map(Math.abs));

  const sel: (null | { hari: number; nilai?: number })[] = [
    ...Array(geser).fill(null),
    ...Array.from({ length: jmlHari }, (_, i) => ({
      hari: i + 1,
      nilai: pl.get(new Date(tahun, bulan, i + 1).toISOString().slice(0, 10)),
    })),
  ];
  const total = sel.reduce((s, c) => s + (c?.nilai ?? 0), 0);

  return (
    <div>
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
        <span className="text-zinc-500">Total bulan ini</span>
        <span className={cn('angka', total >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(total, true)}</span>
      </div>
    </div>
  );
}

export default function Jurnal() {
  const [saring, setSaring] = useState<'semua' | 'forex' | 'kripto'>('semua');
  const { data: RIWAYAT, contoh } = useRiwayat();
  const SALDO_AWAL = useSaldoAwal();

  const trade = useMemo(
    () => (saring === 'semua' ? RIWAYAT : RIWAYAT.filter((t) => t.sumber === saring)),
    [saring, RIWAYAT]
  );
  const stat = statGabungan(trade, SALDO_AWAL);
  const semua = statGabungan(RIWAYAT, SALDO_AWAL);
  const kurva = useMemo(() => kurvaEkuitas(RIWAYAT, SALDO_AWAL), [RIWAYAT, SALDO_AWAL]);
  const pl = useMemo(() => plPerHari(RIWAYAT), [RIWAYAT]);

  const emosi = useMemo(() => {
    const peta = new Map<string, { n: number; pnl: number }>();
    RIWAYAT.forEach((t) => {
      if (!t.emosi) return;
      const p = peta.get(t.emosi) ?? { n: 0, pnl: 0 };
      peta.set(t.emosi, { n: p.n + 1, pnl: p.pnl + t.pnl });
    });
    return [...peta.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [RIWAYAT]);

  return (
    <div className="p-4 sm:p-6">
      {contoh && <div className="mb-4"><LabelContoh tampil /></div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Total trade"   nilai={String(stat.jumlah)} catatan={`${stat.menang} menang · ${stat.kalah} kalah`} />
        <KartuKpi label="Win rate"      nilai={persen(stat.winrate)} delta={2.4} />
        <KartuKpi label="Net P/L"       nilai={uang(stat.bersih, true)} delta={stat.bersih >= 0 ? 4.1 : -4.1} />
        <KartuKpi label="Profit factor" nilai={stat.faktorProfit === null ? '—' : stat.faktorProfit === Infinity ? '∞' : stat.faktorProfit.toFixed(2)} catatan="gross profit / gross loss" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead
            judul="Equity curve"
            sub={`Dari ${uang(SALDO_AWAL)} ke ${uang(semua.saldo)} · ${RIWAYAT.length} transaksi.`}
            kanan={<BadgeTren nilai={Number(((semua.bersih / SALDO_AWAL) * 100).toFixed(1))} />}
          />
          <div className="h-[280px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kurva} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gEq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fafafa" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#fafafa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={48} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={48}
                       tickFormatter={(v) => `$${v}`} domain={['dataMin - 8', 'dataMax + 8']} />
                <Tooltip content={<TipGrafik />} cursor={{ stroke: 'rgba(255,255,255,.12)' }} />
                <Area type="monotone" dataKey="nilai" name="Equity" stroke="#fafafa" strokeWidth={1.8} fill="url(#gEq)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHead judul="P/L calendar" sub={new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} />
          <div className="px-5 pb-5"><Kalender pl={pl} /></div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHead
            judul="Trade history"
            sub="Riwayat gabungan Forex dan Kripto."
            kanan={
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 rounded-md bg-zinc-900 p-0.5">
                  {(['semua', 'forex', 'kripto'] as const).map((s) => (
                    <button key={s} onClick={() => setSaring(s)}
                      className={cn('cursor-pointer rounded px-2.5 py-1 text-[11.5px] capitalize transition-colors',
                        saring === s ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
                      {s}
                    </button>
                  ))}
                </div>
                <button className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
                  <Plus className="size-3.5" /> Add
                </button>
              </div>
            }
          />
          <div className="px-5 pb-5">
            <TabelBungkus className="max-h-[380px] overflow-y-auto">
              <Tabel>
                <thead className="sticky top-0 bg-zinc-950">
                  <tr>
                    <Th>Date</Th><Th>Pair</Th><Th>Side</Th>
                    <Th className="text-right">Lot</Th><Th className="text-right">P/L</Th>
                    <Th>Emotion</Th><Th>Setup</Th><Th />
                  </tr>
                </thead>
                <tbody>
                  {[...trade].sort((a, b) => b.waktu - a.waktu).slice(0, 40).map((t) => (
                    <Tr key={t.id}>
                      <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(t.waktu)}</Td>
                      <Td className="whitespace-nowrap text-zinc-200">{t.pair}</Td>
                      <Td><span className={cn('text-[11.5px]', t.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>{t.arah}</span></Td>
                      <Td className="angka text-right text-zinc-400">{t.lot}</Td>
                      <Td className={cn('angka text-right', t.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(t.pnl, true)}</Td>
                      <Td className="whitespace-nowrap text-[12px] text-zinc-400">{t.emosi}</Td>
                      <Td className="max-w-[150px] truncate text-[12px] text-zinc-500" title={t.alasan}>{t.alasan}</Td>
                      <Td>
                        <button className="cursor-pointer text-zinc-600 transition-colors hover:text-zinc-200" aria-label="Sunting">
                          <Pencil className="size-3.5" />
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabel>
            </TabelBungkus>
          </div>
        </Panel>

        <Panel>
          <PanelHead judul="Emotion pattern" sub="Emosi saat entry vs hasilnya." />
          <div className="px-5 pb-5">
            <div className="max-h-[300px] overflow-y-auto pr-1">
              {emosi.map(([nama, d]) => (
                <div key={nama} className="flex items-center justify-between border-b border-zinc-800/50 py-2.5 text-[13px]">
                  <span className="text-zinc-300">{nama}</span>
                  <span className="flex items-center gap-3">
                    <span className="angka text-[11.5px] text-zinc-600">{d.n}×</span>
                    <span className={cn('angka', d.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(d.pnl, true)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
