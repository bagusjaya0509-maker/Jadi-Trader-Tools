import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { CheckCircle2, AlertCircle, Clock, Quote, Save } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, BadgeTren, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, tanggalPendek } from '@/lib/utils';
import { KLIEN, PENJUALAN, LAPORAN, VPS, TRAFIK } from '@/data/contoh';
import { PORTO_BULANAN, KATA_HARI_INI, rupiahRingkas } from '@/data/porto';

/* Traffic & Sales memakai kerangka Efferd yang sama persis dengan Dashboard:
   empat KPI di atas, dua panel besar, lalu tiga panel bawah. Yang berbeda
   cuma isinya — supaya berpindah antar halaman tidak terasa berpindah situs. */

function jamLalu(ms: number) {
  const menit = Math.round((Date.now() - ms) / 60000);
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.round(jam / 24)} hari lalu`;
}

export default function Pemilik() {
  const penjualan = PENJUALAN.reduce((s, p) => s + p.nilai, 0);
  const baru = LAPORAN.filter((l) => l.status === 'baru').length;
  const hariIni = TRAFIK[TRAFIK.length - 1];
  const ramPakai = VPS.ramTotalMb - VPS.ramBebasMb;

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Revenue"       nilai={uang(penjualan)} delta={12.4} />
        <KartuKpi label="Active clients" nilai={String(KLIEN.length)} delta={8.7} />
        <KartuKpi label="Visits today"  nilai={String(hariIni.total)} delta={3.1} />
        <KartuKpi label="Open reports"  nilai={String(baru)} delta={-0.4} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHead
            judul="Website traffic"
            sub="Daily visits and unique visitors, last 20 days."
            kanan={<BadgeTren nilai={41.8} />}
          />
          <div className="h-[260px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TRAFIK} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTraf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fafafa" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#fafafa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={36} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip content={<TipGrafik />} cursor={{ stroke: 'rgba(255,255,255,.12)' }} />
                <Area type="monotone" dataKey="total" name="Visits" stroke="#fafafa" strokeWidth={1.8} fill="url(#gTraf)" dot={false} />
                <Area type="monotone" dataKey="unik" name="Unique" stroke="#71717a" strokeWidth={1.4} strokeDasharray="4 3" fill="none" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHead judul="Infrastructure health" sub="Status VPS yang melayani proxy, lisensi, dan jembatan MT5." />
          <div className="space-y-3 px-5 pb-5">
            <div className="rounded-lg border border-zinc-800/60 p-3">
              <div className="mb-2 flex justify-between text-[12.5px]">
                <span className="text-zinc-400">RAM terpakai</span>
                <span className="angka text-zinc-100">{ramPakai} / {VPS.ramTotalMb} MB</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-gradient-to-r from-zinc-100 to-zinc-400"
                     style={{ width: `${(ramPakai / VPS.ramTotalMb) * 100}%` }} />
              </div>
            </div>
            {[
              { Ikon: CheckCircle2, warna: 'text-emerald-500', judul: 'Backend online', ket: `${VPS.ramProsesMb} MB · uptime ${Math.floor(VPS.waktuHidupDetik / 3600)} jam` },
              { Ikon: CheckCircle2, warna: 'text-emerald-500', judul: 'Beban CPU normal', ket: `${VPS.beban.join(' / ')} pada ${VPS.cpu} core` },
              { Ikon: AlertCircle,  warna: 'text-amber-500',   judul: 'Gerbang langganan mati', ket: 'GERBANG_LANGGANAN belum dinyalakan' },
            ].map(({ Ikon, warna, judul, ket }) => (
              <div key={judul} className="flex items-start gap-3 rounded-lg border border-zinc-800/60 p-3">
                <Ikon className={`mt-0.5 size-4 shrink-0 ${warna}`} strokeWidth={2} />
                <div className="min-w-0">
                  <div className="text-[13px] text-zinc-200">{judul}</div>
                  <div className="text-[12px] text-zinc-500">{ket}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Laporan bulanan ── */}
      <Panel className="mt-4">
        <PanelHead
          judul="Laporan Bulanan"
          sub="Pemasukan, pengeluaran, dan selisih bersih per bulan."
          kanan={<BadgeTren nilai={18.4} />}
        />
        <div className="h-[260px] px-2 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={PORTO_BULANAN} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
              <XAxis dataKey="bulan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={52}
                     tickFormatter={(v) => `${Math.round(v / 1_000_000)}jt`} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,.04)' }}
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
                      <div className="text-[11px] text-zinc-500">{label}</div>
                      {payload.map((x: any) => (
                        <div key={x.dataKey} className="angka text-[12.5px]" style={{ color: x.color }}>
                          {x.name}: {rupiahRingkas(x.value)}
                        </div>
                      ))}
                    </div>
                  ) : null
                }
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} iconType="square" iconSize={9} />
              <Bar dataKey="masuk"  name="Masuk"  fill="#10b981" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar dataKey="keluar" name="Keluar" fill="#ef4444" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="border-t border-zinc-800/80 px-5 py-3">
          <TabelBungkus>
            <Tabel>
              <thead>
                <tr><Th>Bulan</Th><Th className="text-right">Masuk</Th><Th className="text-right">Keluar</Th>
                    <Th className="text-right">Bersih</Th><Th className="text-right">Porto akhir</Th></tr>
              </thead>
              <tbody>
                {PORTO_BULANAN.slice(-6).reverse().map((b) => (
                  <Tr key={b.bulan}>
                    <Td className="text-zinc-300">{b.bulan}</Td>
                    <Td className="angka text-right text-emerald-500">{rupiahRingkas(b.masuk)}</Td>
                    <Td className="angka text-right text-red-400">{rupiahRingkas(b.keluar)}</Td>
                    <Td className={cn('angka text-right', b.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {rupiahRingkas(b.bersih)}
                    </Td>
                    <Td className="angka text-right text-zinc-100">{rupiahRingkas(b.porto)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          </TabelBungkus>
        </div>
      </Panel>

      {/* ── Kata-kata hari ini ── */}
      <Panel className="mt-4">
        <PanelHead
          judul="Kata-kata Hari Ini"
          sub="Tampil di beranda semua pengguna. Diisi pemilik."
          kanan={
            <button className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
              <Save className="size-3.5" /> Terbitkan
            </button>
          }
        />
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-500">Isi pesan</label>
            <textarea
              rows={4}
              defaultValue={KATA_HARI_INI.isi}
              className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[13px]
                         leading-relaxed text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input defaultValue={KATA_HARI_INI.oleh} placeholder="Ditulis oleh"
                className="h-9 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600" />
              <input type="date" defaultValue="2026-08-09"
                className="h-9 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-300 outline-none hover:border-zinc-700 focus-visible:border-zinc-600" />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] text-zinc-500">Pratinjau</div>
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/60 p-5">
              <Quote className="mb-3 size-5 text-zinc-700" strokeWidth={1.8} />
              <p className="text-[15px] leading-relaxed text-zinc-200">{KATA_HARI_INI.isi}</p>
              <div className="mt-3 text-[12px] text-zinc-500">
                — {KATA_HARI_INI.oleh} · {KATA_HARI_INI.tgl}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHead judul="Recent sales" sub="Open amounts and payment status." />
          <div className="px-5 pb-5">
            <TabelBungkus>
              <Tabel>
                <thead><tr><Th>Date</Th><Th>Product</Th><Th className="text-right">Amount</Th></tr></thead>
                <tbody>
                  {PENJUALAN.map((p) => (
                    <Tr key={p.id}>
                      <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(p.waktu)}</Td>
                      <Td className="text-zinc-300">{p.produk}</Td>
                      <Td className="angka text-right text-emerald-500">{uang(p.nilai)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabel>
            </TabelBungkus>
          </div>
        </Panel>

        <Panel>
          <PanelHead judul="Client health" sub="Akun yang pernah masuk dan seberapa aktif." />
          <div className="space-y-2.5 px-5 pb-5">
            {KLIEN.map((k) => (
              <div key={k.uid} className="flex items-center justify-between rounded-lg border border-zinc-800/60 p-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-zinc-200">{k.email}</div>
                  <div className="text-[11.5px] text-zinc-500">{jamLalu(k.terakhir)}</div>
                </div>
                <span className="angka shrink-0 text-[12.5px] text-zinc-400">{k.kunjungan}×</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead judul="Activity" sub="Laporan bug, saran, dan error dari pengguna." />
          <div className="px-5 pb-5">
            {LAPORAN.map((l) => (
              <div key={l.id} className="flex gap-3 py-2.5">
                <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                  <Clock className="size-3 text-zinc-500" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] uppercase',
                      l.jenis === 'error' ? 'bg-red-500/10 text-red-400'
                        : l.jenis === 'saran' ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-amber-500/10 text-amber-400'
                    )}>{l.jenis}</span>
                    {l.status === 'baru' && <span className="text-[10px] text-zinc-600">baru</span>}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[12.5px] text-zinc-300">{l.pesan}</div>
                  <div className="text-[11.5px] text-zinc-600">{l.halaman} · {jamLalu(l.waktu)}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
