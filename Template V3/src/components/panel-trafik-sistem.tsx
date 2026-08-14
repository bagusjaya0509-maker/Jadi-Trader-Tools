import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Panel, PanelHead, BadgeTren, TipGrafik } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { useTrafik, useStatusVps } from '@/lib/admin';

/* ════════════════════════════════════════════════════════════════════════
   TRAFIK & KESEHATAN SISTEM — pindahan dari halaman Traffic & Sales
   ════════════════════════════════════════════════════════════════════════
   Dua panel ini tidak pernah benar-benar sekeluarga dengan penjualan.
   Kunjungan situs dan beban CPU adalah pertanyaan "apakah mesinnya sehat";
   penjualan dan pengeluaran adalah pertanyaan "apakah usahanya untung".
   Ditumpuk di satu halaman, keduanya saling mengaburkan: laporan keuangan
   jadi harus digulir melewati grafik trafik, dan pemeriksaan kesehatan VPS
   harus dicari di halaman bernama Sales.

   Sekarang keduanya tinggal di Maintenance, satu keluarga dengan panel
   kesehatan sistem yang sudah ada di sana.

   Dijadikan komponen tersendiri, bukan disalin: kode yang disalin akan
   berbeda dalam tiga bulan, dan yang berbeda diam-diam adalah angka.
   ════════════════════════════════════════════════════════════════════════ */

function Kabar({ memuat, galat, kosong, teksKosong }: {
  memuat: boolean; galat: string | null; kosong: boolean; teksKosong: string;
}) {
  if (memuat) return <div className="py-6 text-center text-[12.5px] text-zinc-500">Memuat…</div>;
  if (galat) return <div className="py-6 text-center text-[12.5px] text-amber-400/90">{galat}</div>;
  if (kosong) return <div className="py-6 text-center text-[12.5px] text-zinc-600">{teksKosong}</div>;
  return null;
}

export function PanelTrafikSistem() {
  const trafik = useTrafik();
  const vps = useStatusVps();

  const hariIni = trafik.data[trafik.data.length - 1];
  const kemarin = trafik.data[trafik.data.length - 2];
  const ramPakai = vps.data.ramTotalMb - vps.data.ramBebasMb;

  /* Tren dihitung dari dua hari yang benar-benar ada. Delta tetap yang
     ditulis di kode adalah janji yang tidak pernah ditepati datanya. */
  const trenKunjungan = hariIni && kemarin && kemarin.total > 0
    ? Number((((hariIni.total - kemarin.total) / kemarin.total) * 100).toFixed(1))
    : null;

  /* Halaman mana yang paling ramai — dari rincian per halaman yang memang
     sudah dikirim backend. */
  const perHalaman = useMemo(() => {
    const peta = new Map<string, number>();
    trafik.data.forEach((h) => Object.entries(h.halaman).forEach(([n, v]) =>
      peta.set(n, (peta.get(n) ?? 0) + Number(v))));
    return [...peta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [trafik.data]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHead
          judul="Website traffic"
          sub="Kunjungan harian & pengunjung unik, 90 hari terakhir."
          kanan={trenKunjungan !== null ? <BadgeTren nilai={trenKunjungan} /> : undefined}
        />
        <div className="h-[260px] px-2 pb-4">
          {trafik.memuat || trafik.galat || !trafik.data.length ? (
            <div className="px-3 pt-3">
              <Kabar memuat={trafik.memuat} galat={trafik.galat} kosong={!trafik.data.length}
                     teksKosong="Belum ada kunjungan tercatat." />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafik.data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTraf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fafafa" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#fafafa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={36} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
                <Tooltip content={<TipGrafik />} cursor={{ stroke: 'rgba(255,255,255,.12)' }} />
                <Area type="monotone" dataKey="total" name="Kunjungan" stroke="#fafafa" strokeWidth={1.8} fill="url(#gTraf)" dot={false} />
                <Area type="monotone" dataKey="unik" name="Unik" stroke="#71717a" strokeWidth={1.4} strokeDasharray="4 3" fill="none" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        {perHalaman.length > 0 && (
          <div className="border-t border-zinc-800/80 px-5 py-3">
            <div className="mb-2 text-[11px] text-zinc-500">Halaman paling ramai</div>
            <div className="flex flex-wrap gap-1.5">
              {perHalaman.map(([nama, n]) => (
                <span key={nama} className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[11.5px] text-zinc-400">
                  {nama} <span className="angka text-zinc-200">{n}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHead
          judul="Infrastructure health"
          sub="Status VPS yang melayani proxy, lisensi, dan jembatan MT5."
          kanan={
            <button onClick={vps.muatUlang} title="Segarkan"
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
              <RefreshCw className={cn('size-3.5', vps.memuat && 'animate-spin')} /> Segarkan
            </button>
          }
        />
        <div className="space-y-3 px-5 pb-5">
          {(vps.memuat || vps.galat) && (
            <Kabar memuat={vps.memuat} galat={vps.galat} kosong={false} teksKosong="" />
          )}
          {!vps.memuat && !vps.galat && (
            <>
              <div className="rounded-lg border border-zinc-800/60 p-3">
                <div className="mb-2 flex justify-between text-[12.5px]">
                  <span className="text-zinc-400">RAM terpakai</span>
                  <span className="angka text-zinc-100">{ramPakai} / {vps.data.ramTotalMb} MB</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-zinc-100 to-zinc-400"
                       style={{ width: `${vps.data.ramTotalMb ? (ramPakai / vps.data.ramTotalMb) * 100 : 0}%` }} />
                </div>
              </div>
              {[
                {
                  Ikon: CheckCircle2, warna: 'text-emerald-500', judul: 'Backend online',
                  ket: `${vps.data.ramProsesMb} MB · uptime ${Math.floor(vps.data.waktuHidupDetik / 3600)} jam · Node ${vps.data.node}`,
                },
                {
                  /* Ambang 1,0 per core adalah definisi "beban penuh" di
                     Linux: satu proses siap jalan per core. Di atas itu ada
                     antrean, dan itulah yang perlu terlihat. */
                  Ikon: (vps.data.beban[0] ?? 0) > vps.data.cpu ? AlertCircle : CheckCircle2,
                  warna: (vps.data.beban[0] ?? 0) > vps.data.cpu ? 'text-amber-500' : 'text-emerald-500',
                  judul: (vps.data.beban[0] ?? 0) > vps.data.cpu ? 'Beban CPU tinggi' : 'Beban CPU normal',
                  ket: `${vps.data.beban.join(' / ')} pada ${vps.data.cpu} core`,
                },
                {
                  Ikon: vps.data.gerbangLangganan ? CheckCircle2 : AlertCircle,
                  warna: vps.data.gerbangLangganan ? 'text-emerald-500' : 'text-amber-500',
                  judul: vps.data.gerbangLangganan ? 'Gerbang langganan aktif' : 'Gerbang langganan mati',
                  ket: vps.data.gerbangLangganan
                    ? 'Data pasar hanya untuk pelanggan aktif'
                    : 'GERBANG_LANGGANAN belum dinyalakan — proxy terbuka untuk semua yang login',
                },
              ].map(({ Ikon, warna, judul, ket }) => (
                <div key={judul} className="flex items-start gap-3 rounded-lg border border-zinc-800/60 p-3">
                  <Ikon className={`mt-0.5 size-4 shrink-0 ${warna}`} strokeWidth={2} />
                  <div className="min-w-0">
                    <div className="text-[13px] text-zinc-200">{judul}</div>
                    <div className="text-[12px] text-zinc-500">{ket}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
