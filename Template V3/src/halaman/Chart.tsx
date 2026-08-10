import { useMemo, useState } from 'react';
import { Play, Upload, Code2, Crosshair, Minus, TrendingUp, Type, Trash2 } from 'lucide-react';
import { Panel, PanelHead, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen } from '@/lib/utils';
import { buatLilin, HASIL_BACKTEST, type Lilin } from '@/data/porto';

/* ════════════════════════════════════════════════════════════════════════
   CHART & BACKTEST
   ════════════════════════════════════════════════════════════════════════
   Lilin digambar dengan SVG tulisan tangan, bukan pustaka chart.

   Alasannya bukan gengsi: Recharts tidak punya candlestick bawaan, dan
   pustaka chart keuangan yang lengkap (lightweight-charts, dsb) menambah
   ratusan kilobyte untuk sesuatu yang di sini masih prototipe. SVG langsung
   memberi kendali penuh atas skala harga, dan itu yang paling menentukan
   apakah sebuah chart terasa benar.

   YANG BELUM ADA — dan ini disengaja, bukan terlewat:
     · Mesin backtest sungguhan. Angka di panel hasil masih contoh.
     · Penerjemah Pine/MQL5. Kotak editor sudah ada, penerjemahnya belum.
     · Data pasar nyata. Lilinnya random-walk dengan seed tetap.
   ════════════════════════════════════════════════════════════════════════ */

const TF = ['5m', '15m', '1H', '4H', '1D'];
const ALAT = [
  { Ikon: Crosshair, nama: 'Kursor' },
  { Ikon: Minus, nama: 'Garis horizontal' },
  { Ikon: TrendingUp, nama: 'Garis tren' },
  { Ikon: Type, nama: 'Teks' },
  { Ikon: Trash2, nama: 'Hapus semua' },
];

function Lilinan({ data }: { data: Lilin[] }) {
  const W = 1200, H = 460, padKanan = 62, padBawah = 26, padAtas = 10;

  const { min, max } = useMemo(() => {
    const lo = Math.min(...data.map((d) => d.l));
    const hi = Math.max(...data.map((d) => d.h));
    const bantal = (hi - lo) * 0.08;
    return { min: lo - bantal, max: hi + bantal };
  }, [data]);

  const lebarArea = W - padKanan;
  const lebarLilin = lebarArea / data.length;
  const badan = Math.max(1.5, lebarLilin * 0.62);
  const Y = (v: number) => padAtas + (1 - (v - min) / (max - min)) * (H - padAtas - padBawah);
  const X = (i: number) => i * lebarLilin + lebarLilin / 2;

  // Empat garis harga saja. Grid penuh berubah jadi kertas milimeter.
  const garis = Array.from({ length: 5 }, (_, i) => min + ((max - min) / 4) * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'clamp(300px, 46vh, 460px)' }} role="img" aria-label="Grafik lilin">
      {garis.map((g, i) => (
        <g key={i}>
          <line x1={0} x2={lebarArea} y1={Y(g)} y2={Y(g)} stroke="rgba(255,255,255,.05)" strokeWidth={1} />
          <text x={lebarArea + 8} y={Y(g) + 3.5} fill="#71717a" fontSize={10} fontFamily="IBM Plex Mono">
            {g.toFixed(0)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const naik = d.c >= d.o;
        const warna = naik ? '#10b981' : '#ef4444';
        const atas = Y(Math.max(d.o, d.c));
        const tinggi = Math.max(1, Math.abs(Y(d.o) - Y(d.c)));
        return (
          <g key={i}>
            <line x1={X(i)} x2={X(i)} y1={Y(d.h)} y2={Y(d.l)} stroke={warna} strokeWidth={1} />
            <rect x={X(i) - badan / 2} y={atas} width={badan} height={tinggi} fill={warna} />
          </g>
        );
      })}

      {/* Harga terakhir — garis putus + label, seperti chart sungguhan */}
      <line x1={0} x2={lebarArea} y1={Y(data[data.length - 1].c)} y2={Y(data[data.length - 1].c)}
            stroke="#fafafa" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
      <rect x={lebarArea + 2} y={Y(data[data.length - 1].c) - 9} width={58} height={18} rx={3} fill="#fafafa" />
      <text x={lebarArea + 31} y={Y(data[data.length - 1].c) + 4} fill="#09090b" fontSize={10}
            fontFamily="IBM Plex Mono" textAnchor="middle">
        {data[data.length - 1].c.toFixed(0)}
      </text>
    </svg>
  );
}

export default function ChartBacktest() {
  const [tf, setTf] = useState('4H');
  const [alatAktif, setAlatAktif] = useState('Kursor');
  const [jalan, setJalan] = useState(false);
  const [adaHasil, setAdaHasil] = useState(false);
  const data = useMemo(() => buatLilin(160), []);
  const H = HASIL_BACKTEST;

  function jalankan() {
    setJalan(true);
    // Jeda sengaja: memberi umpan balik bahwa sesuatu sedang dikerjakan.
    // Diganti pemanggilan mesin backtest sungguhan nanti.
    setTimeout(() => { setJalan(false); setAdaHasil(true); }, 1200);
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* ── Chart ── */}
        <Panel className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 p-3">
            <span className="px-1 text-[15px] font-semibold tracking-tight text-zinc-100">BTCUSDT</span>
            <span className="angka text-[13px] text-emerald-500">
              {data[data.length - 1].c.toFixed(2)}
            </span>

            <div className="ml-2 flex gap-0.5 rounded-md bg-zinc-900 p-0.5">
              {TF.map((t) => (
                <button key={t} onClick={() => setTf(t)}
                  className={cn(
                    'cursor-pointer rounded px-2.5 py-1 text-[11.5px] transition-colors',
                    tf === t ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  )}>
                  {t}
                </button>
              ))}
            </div>

            <div className="ml-auto flex gap-0.5 rounded-md bg-zinc-900 p-0.5">
              {ALAT.map(({ Ikon, nama }) => (
                <button key={nama} onClick={() => setAlatAktif(nama)} title={nama} aria-label={nama}
                  className={cn(
                    'cursor-pointer rounded p-1.5 transition-colors',
                    alatAktif === nama ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  )}>
                  <Ikon className="size-3.5" strokeWidth={1.8} />
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto p-2">
            <Lilinan data={data} />
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800/80 px-4 py-2.5 text-[11.5px] text-zinc-500">
            <span>160 lilin</span>
            <span>·</span>
            <span>TF {tf}</span>
            <span>·</span>
            <span>Alat: {alatAktif}</span>
            <span className="ml-auto rounded bg-zinc-800/60 px-2 py-0.5 text-zinc-400">data contoh</span>
          </div>
        </Panel>

        {/* ── Kanan: indikator + backtest ── */}
        <div className="min-w-0 space-y-4">
          <Panel>
            <PanelHead judul="Indikator" sub="Tempel kode, lalu pasang ke chart." />
            <div className="space-y-3 px-5 pb-5">
              <div className="flex gap-2">
                <select className="h-9 flex-1 cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 text-[12.5px] text-zinc-300 outline-none">
                  <option>Pine Script (TradingView)</option>
                  <option>MQL5 (MetaTrader 5)</option>
                </select>
                <button className="flex cursor-pointer items-center rounded-md border border-zinc-800 px-2.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100" aria-label="Unggah berkas">
                  <Upload className="size-3.5" />
                </button>
              </div>

              <textarea
                rows={7}
                spellCheck={false}
                defaultValue={'//@version=6\nindicator("Jadi Trader V3", overlay=true)\n\n// Tempel kode indikatormu di sini.\n// Setelah dipasang, sinyalnya digambar di chart\n// dan ikut dihitung saat backtest dijalankan.'}
                className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-[11.5px]
                           leading-relaxed text-zinc-300 outline-none transition-colors
                           hover:border-zinc-700 focus-visible:border-zinc-600"
              />

              <button className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-800 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
                <Code2 className="size-3.5" /> Pasang ke chart
              </button>

              <div className="space-y-1.5">
                {[
                  ['Jadi Trader V3', true],
                  ['SMI (14, 3, 3)', true],
                  ['EMA 9 / 21', false],
                ].map(([nama, aktif]) => (
                  <label key={nama as string} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-zinc-800/60 px-3 py-2 text-[12.5px] transition-colors hover:border-zinc-700">
                    <input type="checkbox" defaultChecked={aktif as boolean} className="accent-zinc-100" />
                    <span className="text-zinc-300">{nama}</span>
                  </label>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHead judul="Backtest" sub="Uji indikator pada rentang yang tampil." />
            <div className="space-y-3 px-5 pb-5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Modal awal</label>
                  <input defaultValue="1000" inputMode="numeric"
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 font-mono text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Risiko / trade</label>
                  <input defaultValue="1%"
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 font-mono text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600" />
                </div>
              </div>

              <button
                onClick={jalankan}
                disabled={jalan}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-100 py-2.5 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="size-3.5 fill-current" />
                {jalan ? 'Menjalankan…' : 'Jalankan Backtest'}
              </button>

              {!adaHasil ? (
                <p className="pt-1 text-center text-[11.5px] leading-relaxed text-zinc-600">
                  Belum ada hasil. Jalankan backtest untuk melihat laporan
                  keuntungan, kerugian, dan winrate.
                </p>
              ) : (
                <div className="space-y-2 rounded-lg border border-zinc-800/60 p-3">
                  {[
                    ['Total trade', String(H.totalTrade), ''],
                    ['Menang / Kalah', `${H.menang} / ${H.kalah}`, ''],
                    ['Winrate', persen(H.winrate), H.winrate >= 50 ? 'text-emerald-500' : 'text-red-400'],
                    ['Profit factor', H.profitFactor.toFixed(2), H.profitFactor >= 1 ? 'text-emerald-500' : 'text-red-400'],
                    ['Net P/L', uang(H.netPnl, true), H.netPnl >= 0 ? 'text-emerald-500' : 'text-red-400'],
                    ['Max drawdown', uang(H.maxDrawdown), 'text-red-400'],
                    ['Rata-rata menang', uang(H.rerataMenang), 'text-emerald-500'],
                    ['Rata-rata kalah', uang(H.rerataKalah), 'text-red-400'],
                  ].map(([k, v, w]) => (
                    <div key={k} className="flex justify-between border-b border-zinc-800/40 pb-1.5 text-[12.5px] last:border-0 last:pb-0">
                      <span className="text-zinc-500">{k}</span>
                      <span className={cn('angka', w || 'text-zinc-200')}>{v}</span>
                    </div>
                  ))}
                  <div className="pt-1 text-[10.5px] text-zinc-600">
                    Angka contoh — mesin backtest sungguhan belum tersambung.
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {adaHasil && (
        <Panel className="mt-4">
          <PanelHead judul="Daftar Trade Backtest" sub="Setiap entry dan exit yang dihasilkan indikator." />
          <div className="px-5 pb-5">
            <TabelBungkus className="max-h-[300px] overflow-y-auto">
              <Tabel>
                <thead className="sticky top-0 bg-zinc-950">
                  <tr><Th>#</Th><Th>Arah</Th><Th className="text-right">Entry</Th><Th className="text-right">Exit</Th>
                      <Th className="text-right">P/L</Th><Th>Sebab keluar</Th></tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }, (_, i) => {
                    const menang = i % 3 !== 1;
                    const entry = 63200 + i * 180;
                    const keluar = entry * (menang ? 1.014 : 0.991);
                    return (
                      <Tr key={i}>
                        <Td className="text-zinc-500">{i + 1}</Td>
                        <Td><span className={i % 2 ? 'text-red-400' : 'text-emerald-500'}>{i % 2 ? 'SELL' : 'BUY'}</span></Td>
                        <Td className="angka text-right text-zinc-300">{entry.toFixed(0)}</Td>
                        <Td className="angka text-right text-zinc-300">{keluar.toFixed(0)}</Td>
                        <Td className={cn('angka text-right', menang ? 'text-emerald-500' : 'text-red-400')}>
                          {uang(menang ? 92.15 : -71.8, true)}
                        </Td>
                        <Td className="text-[12px] text-zinc-500">{menang ? 'Take profit' : 'Stop loss'}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Tabel>
            </TabelBungkus>
          </div>
        </Panel>
      )}
    </div>
  );
}
