import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from 'recharts';
import { Wallet, Percent, TrendingUp, Scale, Clock } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, BadgeTren, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga } from '@/lib/utils';
import { statGabungan, statPer } from '@/lib/hitung';
import { AKTIVITAS } from '@/data/contoh';
import { useRiwayat, usePosisi, useSaldoAwal } from '@/lib/data';
import { useHargaPasar } from '@/lib/harga';
import { LabelContoh } from '@/components/gerbang';
import { TRADING_BULANAN, SALDO_PER_TANGGAL, POSISI_MT5 } from '@/data/porto';

/* ════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════════════════
   Kerangka Efferd dipertahankan persis — empat KPI, dua grafik, tiga panel
   bawah. Yang diganti isinya:

     Active users / Revenue / Conversion / New signups
       -> Total Saldo / Winrate / P/L Bersih / Profit Factor  (kripto + tradefi)
     Net revenue     -> Hasil trading bulanan
     Channel sales   -> Saldo bulan lalu vs bulan ini, per tanggal
     Recent invoices -> Posisi terbuka kripto
     Billing health  -> Order terbuka MT5 (trade-fi)
     Activity        -> tetap, tapi khusus aktivitas pengguna ini
   ════════════════════════════════════════════════════════════════════════ */

function TipUang({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
      <div className="text-[11px] text-zinc-500">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="angka text-[12.5px]" style={{ color: p.color }}>
          {p.name}: {uang(p.value, true)}
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { data: RIWAYAT, contoh } = useRiwayat();
  const { data: posisiMentah } = usePosisi();
  const hargaPasar = useHargaPasar(posisiMentah.map((p) => p.simbol));
  const POSISI_TERBUKA = posisiMentah.map((p) => ({ ...p, hargaKini: hargaPasar[p.simbol] ?? p.hargaKini }));
  const saldoAwal = useSaldoAwal();
  const stat = statGabungan(RIWAYAT, saldoAwal);
  const forex = statPer('forex');
  const kripto = statPer('kripto');

  const bulanIni = TRADING_BULANAN[TRADING_BULANAN.length - 1];
  const bulanLalu = TRADING_BULANAN[TRADING_BULANAN.length - 2];

  const akhirLalu = SALDO_PER_TANGGAL[SALDO_PER_TANGGAL.length - 1].bulanLalu;
  const akhirIni = SALDO_PER_TANGGAL[SALDO_PER_TANGGAL.length - 1].bulanIni;
  const selisihSaldo = ((akhirIni - akhirLalu) / akhirLalu) * 100;

  const pnlMt5 = POSISI_MT5.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="p-4 sm:p-6">
      {contoh && <div className="mb-4"><LabelContoh tampil /></div>}
      {/* ── KPI: gabungan kripto + trade-fi ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Total Saldo"   nilai={uang(stat.saldo)} catatan={`${stat.jumlah} transaksi · kripto + trade-fi`} Ikon={Wallet} />
        <KartuKpi label="Winrate"       nilai={persen(stat.winrate)} catatan={`${stat.menang} menang · ${stat.kalah} kalah`} Ikon={Percent} />
        <KartuKpi label="P/L Bersih"    nilai={uang(stat.bersih, true)} catatan={`${uang(stat.untung, true)} / -${uang(stat.rugi)}`} Ikon={TrendingUp} />
        <KartuKpi
          label="Profit Factor"
          nilai={stat.faktorProfit === null ? '—' : stat.faktorProfit === Infinity ? '∞' : stat.faktorProfit.toFixed(2)}
          catatan={(stat.faktorProfit ?? 0) >= 1 ? 'di atas titik impas' : 'di bawah titik impas'}
          Ikon={Scale}
        />
      </div>

      {/* ── Dua grafik ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHead
            judul="Hasil Trading Bulanan"
            sub="P/L per bulan, enam bulan terakhir."
            kanan={<BadgeTren nilai={Number((((bulanIni.pnl - bulanLalu.pnl) / Math.abs(bulanLalu.pnl)) * 100).toFixed(1))} />}
          />
          <div className="h-[260px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TRADING_BULANAN} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="bulan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                       tickFormatter={(v) => `$${v}`} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,.04)' }} content={<TipUang />} />
                {/* Warna batang mengikuti tanda P/L — bulan rugi tidak boleh
                    terlihat sama dengan bulan untung hanya karena tingginya
                    kebetulan mirip. */}
                <Bar dataKey="pnl" name="P/L" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {TRADING_BULANAN.map((b) => (
                    <Cell key={b.bulan} fill={b.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHead
            judul="Saldo Bulan Lalu vs Bulan Ini"
            sub="Dibandingkan per tanggal, bukan per total — supaya kelihatan di titik mana mulai menyimpang."
            kanan={<BadgeTren nilai={Number(selisihSaldo.toFixed(1))} />}
          />
          <div className="h-[260px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SALDO_PER_TANGGAL} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="tgl" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                       tickFormatter={(v) => `$${v}`} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip content={<TipGrafik />} cursor={{ stroke: 'rgba(255,255,255,.12)' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} iconType="plainline" iconSize={14} />
                <Line type="monotone" dataKey="bulanLalu" name="Bulan lalu" stroke="#71717a" strokeWidth={1.5}
                      strokeDasharray="4 3" dot={false} />
                <Line type="monotone" dataKey="bulanIni" name="Bulan ini" stroke="#fafafa" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* ── Tiga panel bawah ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHead
            judul="Posisi Terbuka — Kripto"
            sub="Order yang sedang berjalan di Binance."
            kanan={<span className="text-[11.5px] text-zinc-500">{POSISI_TERBUKA.length} posisi</span>}
          />
          <div className="px-5 pb-5">
            <TabelBungkus>
              <Tabel>
                <thead>
                  <tr><Th>Pair</Th><Th className="text-right">Entry</Th><Th className="text-right">Gerak</Th></tr>
                </thead>
                <tbody>
                  {POSISI_TERBUKA.map((p) => {
                    const gerak = ((p.hargaKini - p.entry) / p.entry) * 100 * (p.arah === 'BUY' ? 1 : -1);
                    return (
                      <Tr key={p.id}>
                        <Td>
                          <span className="text-zinc-200">{p.simbol.replace('USDT', '')}</span>
                          <span className={cn('ml-1.5 text-[10.5px]', p.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                            {p.arah}
                          </span>
                          <div className="text-[10.5px] text-zinc-600">{p.venue} · {p.tf}</div>
                        </Td>
                        <Td className="angka text-right text-zinc-400">{harga(p.entry)}</Td>
                        <Td className={cn('angka text-right', gerak >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                          {gerak >= 0 ? '+' : ''}{gerak.toFixed(2)}%
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Tabel>
            </TabelBungkus>
          </div>
        </Panel>

        <Panel>
          <PanelHead
            judul="Order Terbuka — Trade-Fi"
            sub="Dari MetaTrader 5, lewat EA JadiTraderSync."
            kanan={
              <span className={cn('angka text-[12.5px]', pnlMt5 >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {uang(pnlMt5, true)}
              </span>
            }
          />
          <div className="space-y-2.5 px-5 pb-5">
            {POSISI_MT5.map((p) => (
              <div key={p.tiket} className="rounded-lg border border-zinc-800/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-zinc-200">{p.pair}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                      p.arah === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400')}>
                      {p.arah}
                    </span>
                    <span className="angka text-[11px] text-zinc-600">{p.lot} lot</span>
                  </div>
                  <span className={cn('angka text-[12.5px]', p.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                    {uang(p.pnl, true)}
                  </span>
                </div>
                <div className="mt-1.5 flex gap-4 text-[11px] text-zinc-500">
                  <span>Entry <span className="angka text-zinc-400">{p.entry}</span></span>
                  <span>SL <span className="angka text-red-400/80">{p.sl}</span></span>
                  <span>TP <span className="angka text-emerald-500/80">{p.tp}</span></span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead judul="Activity" sub="Kejadian terakhir di akunmu." />
          <div className="px-5 pb-5">
            {AKTIVITAS.map((a, i) => (
              <div key={i} className="flex gap-3 py-2.5">
                <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                  <Clock className="size-3 text-zinc-500" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] text-zinc-200">{a.teks}</div>
                  <div className="text-[11.5px] text-zinc-500">{a.waktu}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Rincian sumber — supaya angka gabungan di atas bisa DIPERIKSA */}
      <Panel className="mt-4">
        <PanelHead judul="Rincian Sumber" sub="Dari mana angka gabungan di atas berasal." />
        <div className="px-5 pb-5">
          <TabelBungkus>
            <Tabel>
              <thead>
                <tr><Th>Sumber</Th><Th className="text-right">Trade</Th><Th className="text-right">Winrate</Th>
                    <Th className="text-right">Profit</Th><Th className="text-right">Loss</Th><Th className="text-right">Bersih</Th></tr>
              </thead>
              <tbody>
                {[['Trade-Fi (MT5)', forex], ['Kripto (Binance)', kripto]].map(([nama, s]: any) => (
                  <Tr key={nama}>
                    <Td className="text-zinc-300">{nama}</Td>
                    <Td className="angka text-right text-zinc-400">{s.jumlah}</Td>
                    <Td className="angka text-right text-zinc-400">{persen(s.winrate)}</Td>
                    <Td className="angka text-right text-emerald-500">{uang(s.untung, true)}</Td>
                    <Td className="angka text-right text-red-400">-{uang(s.rugi)}</Td>
                    <Td className={cn('angka text-right', s.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {uang(s.bersih, true)}
                    </Td>
                  </Tr>
                ))}
                <Tr className="border-t border-zinc-800">
                  <Td className="font-medium text-zinc-100">Gabungan</Td>
                  <Td className="angka text-right font-medium">{stat.jumlah}</Td>
                  <Td className="angka text-right font-medium">{persen(stat.winrate)}</Td>
                  <Td className="angka text-right font-medium text-emerald-500">{uang(stat.untung, true)}</Td>
                  <Td className="angka text-right font-medium text-red-400">-{uang(stat.rugi)}</Td>
                  <Td className={cn('angka text-right font-medium', stat.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                    {uang(stat.bersih, true)}
                  </Td>
                </Tr>
              </tbody>
            </Tabel>
          </TabelBungkus>
        </div>
      </Panel>
    </div>
  );
}

export default Dashboard;
