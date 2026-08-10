import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Plus, Pencil, Bitcoin, CandlestickChart } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, BadgeTren, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, tanggalPendek } from '@/lib/utils';
import { statGabungan, kurvaEkuitas, plPerHari } from '@/lib/hitung';
import { useRiwayat, useSaldoAwal } from '@/lib/data';
import { LabelContoh } from '@/components/gerbang';
import type { Trade } from '@/data/contoh';

/* ════════════════════════════════════════════════════════════════════════
   JOURNAL — DUA jurnal terpisah dalam satu halaman
   ════════════════════════════════════════════════════════════════════════
   Trade-Fi (forex/XAU lewat MT5) dan Kripto (Binance) dipisah, persis
   seperti V2. Sebelumnya keduanya digabung jadi satu daftar dengan tombol
   penyaring, dan itu menyembunyikan hal yang paling penting: keduanya
   punya kurva ekuitas, winrate, dan pola emosi yang BERBEDA. Satu akun bisa
   untung di forex sambil rugi di kripto, dan daftar gabungan membuat
   keduanya saling menutupi.

   Dashboard adalah PENJUMLAHAN kedua blok ini. Ketiganya membaca array
   yang sama (`useRiwayat()`), dibagi lewat field `sumber` — bukan tiga
   sumber terpisah yang kebetulan mirip.
   ════════════════════════════════════════════════════════════════════════ */

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

/** Satu blok jurnal lengkap: KPI, kurva ekuitas, kalender, riwayat, emosi.
 *
 *  Dipakai dua kali dengan daftar transaksi berbeda. Menuliskannya dua kali
 *  akan membuat kedua jurnal berbeda diam-diam dalam dua putaran revisi —
 *  persis yang terjadi pada `statPer` sebelum diperbaiki. */
function BlokJurnal({ judul, ket, Ikon, trade, saldoAwal, warna, idGradien }: {
  judul: string; ket: string; Ikon: typeof Bitcoin;
  trade: Trade[]; saldoAwal: number; warna: string; idGradien: string;
}) {
  const stat = statGabungan(trade, saldoAwal);
  const kurva = useMemo(() => kurvaEkuitas(trade, saldoAwal), [trade, saldoAwal]);
  const pl = useMemo(() => plPerHari(trade), [trade]);

  const emosi = useMemo(() => {
    const peta = new Map<string, { n: number; pnl: number }>();
    trade.forEach((t) => {
      if (!t.emosi) return;
      const p = peta.get(t.emosi) ?? { n: 0, pnl: 0 };
      peta.set(t.emosi, { n: p.n + 1, pnl: p.pnl + t.pnl });
    });
    return [...peta.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [trade]);

  const kosong = trade.length === 0;

  return (
    <section className="mt-6 first:mt-0">
      <div className="mb-3 flex items-center gap-2.5">
        <Ikon className={cn('size-4', warna)} strokeWidth={1.9} />
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-100">{judul}</h2>
        <span className="text-[12px] text-zinc-500">{ket}</span>
        <span className="angka ml-auto text-[12px] text-zinc-600">{trade.length} transaksi</span>
      </div>

      {kosong ? (
        <Panel className="px-5 py-10 text-center text-[13px] text-zinc-500">
          Belum ada transaksi {judul.toLowerCase()}.
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KartuKpi label="Total trade" nilai={String(stat.jumlah)} catatan={`${stat.menang} menang · ${stat.kalah} kalah`} />
            <KartuKpi label="Win rate" nilai={persen(stat.winrate)} catatan="dari transaksi selesai" />
            <KartuKpi label="Net P/L" nilai={uang(stat.bersih, true)}
                      warna={stat.bersih >= 0 ? 'text-emerald-500' : 'text-red-400'}
                      catatan={`untung ${uang(stat.untung)} · rugi ${uang(stat.rugi)}`} />
            <KartuKpi label="Profit factor"
                      nilai={stat.faktorProfit === null ? '—' : stat.faktorProfit === Infinity ? '∞' : stat.faktorProfit.toFixed(2)}
                      catatan="gross profit / gross loss" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <PanelHead
                judul="Kurva Ekuitas"
                sub={`Dari ${uang(saldoAwal)} ke ${uang(stat.saldo)} · ${trade.length} transaksi.`}
                kanan={saldoAwal > 0 ? <BadgeTren nilai={Number(((stat.bersih / saldoAwal) * 100).toFixed(1))} /> : undefined}
              />
              <div className="h-[280px] px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={kurva} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id={idGradien} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fafafa" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#fafafa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={48} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={48}
                           tickFormatter={(v) => `$${v}`} domain={['dataMin - 8', 'dataMax + 8']} />
                    <Tooltip content={<TipGrafik />} cursor={{ stroke: 'rgba(255,255,255,.12)' }} />
                    <Area type="monotone" dataKey="nilai" name="Ekuitas" stroke="#fafafa" strokeWidth={1.8}
                          fill={`url(#${idGradien})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel>
              <PanelHead judul="Kalender P/L" sub={new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} />
              <div className="px-5 pb-5"><Kalender pl={pl} /></div>
            </Panel>

            <Panel className="lg:col-span-2">
              <PanelHead
                judul="Riwayat Trade"
                sub={`40 transaksi terakhir dari ${trade.length}.`}
                kanan={
                  <button className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
                    <Plus className="size-3.5" /> Tambah
                  </button>
                }
              />
              <div className="px-5 pb-5">
                <TabelBungkus className="max-h-[380px] overflow-y-auto">
                  <Tabel>
                    <thead className="sticky top-0 bg-zinc-950">
                      <tr>
                        <Th>Tanggal</Th><Th>Pair</Th><Th>Arah</Th>
                        <Th className="text-right">Lot/Qty</Th><Th className="text-right">P/L</Th>
                        <Th>Emosi</Th><Th>Setup</Th><Th />
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
              <PanelHead judul="Pola Emosi" sub="Emosi saat entry vs hasilnya." />
              <div className="px-5 pb-5">
                {emosi.length === 0 ? (
                  <p className="py-6 text-center text-[12.5px] text-zinc-600">
                    Belum ada catatan emosi di jurnal ini.
                  </p>
                ) : (
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
                )}
              </div>
            </Panel>
          </div>
        </>
      )}
    </section>
  );
}

export default function Jurnal() {
  const { data: RIWAYAT, contoh } = useRiwayat();
  const saldoAwal = useSaldoAwal();

  const forex = useMemo(() => RIWAYAT.filter((t) => t.sumber === 'forex'), [RIWAYAT]);
  const kripto = useMemo(() => RIWAYAT.filter((t) => t.sumber === 'kripto'), [RIWAYAT]);
  const gabungan = statGabungan(RIWAYAT, saldoAwal);

  return (
    <div className="p-4 sm:p-6">
      {contoh && <div className="mb-4"><LabelContoh tampil /></div>}

      {/* Ringkasan gabungan di puncak — angka yang SAMA dengan Dashboard,
          karena keduanya menjumlahkan array yang sama. Ditaruh di sini
          supaya jelas bahwa kedua jurnal di bawah adalah pecahannya. */}
      <Panel className="p-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="text-[12.5px] text-zinc-500">Gabungan</span>
          <span className="angka text-[20px] font-semibold text-zinc-100">{uang(gabungan.saldo)}</span>
          <span className={cn('angka text-[13px]', gabungan.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
            {uang(gabungan.bersih, true)}
          </span>
          <span className="text-[12px] text-zinc-500">
            {gabungan.jumlah} transaksi · winrate {persen(gabungan.winrate)}
          </span>
          <span className="ml-auto text-[11.5px] text-zinc-600">
            saldo awal {uang(saldoAwal)} · Trade-Fi {forex.length} + Kripto {kripto.length}
          </span>
        </div>
      </Panel>

      {/* Saldo awal dibebankan ke blok Trade-Fi saja, dan nol untuk kripto.
          Kalau keduanya diberi saldo awal penuh, jumlah kedua kurva ekuitas
          jadi dua kali saldo awal — dan angka Dashboard tidak akan pernah
          cocok dengan penjumlahan kedua jurnal ini. */}
      <BlokJurnal
        judul="Jurnal Trade-Fi" ket="Forex & XAU lewat MetaTrader 5"
        Ikon={CandlestickChart} trade={forex} saldoAwal={saldoAwal}
        warna="text-amber-400" idGradien="gEqForex"
      />

      <BlokJurnal
        judul="Jurnal Kripto" ket="Binance Futures lewat Screener"
        Ikon={Bitcoin} trade={kripto} saldoAwal={0}
        warna="text-emerald-400" idGradien="gEqKripto"
      />
    </div>
  );
}
