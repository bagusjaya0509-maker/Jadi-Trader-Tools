import { useEffect, useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { Upload, Plus, RefreshCw, Wallet, TrendingUp, Banknote, Scale, Radio } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import {
  ASET, KEWAJIBAN, PORTO_BULANAN, WARNA_KATEGORI,
  rupiah, rupiahRingkas, type KategoriAset,
} from '@/data/porto';

/* ════════════════════════════════════════════════════════════════════════
   PERSONAL AREA — pelacak portofolio
   ════════════════════════════════════════════════════════════════════════
   Dua cara mengisi: unggah Excel/CSV, atau ketik manual. Keduanya belum
   tersambung — ini kerangka tampilannya.

   BAGIAN YANG SUDAH HIDUP: nilai aset yang punya `simbol` ikut bergerak
   mengikuti harga pasar. Di prototipe ini pergerakannya disimulasikan tiap
   6 detik supaya perilakunya bisa dinilai; menyambungkannya ke harga Binance
   nanti tinggal mengganti satu fungsi.

   Kenapa hanya sebagian aset yang bergerak: saldo bank dan emas fisik tidak
   berubah tiap detik. Membuat SEMUANYA berkedip akan terlihat canggih tapi
   berbohong.
   ════════════════════════════════════════════════════════════════════════ */

const KATEGORI: KategoriAset[] = ['Kripto', 'Sekuritas', 'Emas', 'Bank', 'E-Wallet', 'Tunai'];

export default function PersonalArea() {
  /* Faktor harga pasar per simbol. 1 = harga sama seperti saat dicatat. */
  const [faktor, setFaktor] = useState<Record<string, number>>({});
  const [berdenyut, setBerdenyut] = useState(false);

  useEffect(() => {
    // Simulasi pergerakan harga. Diganti fetch ke /api/tickers saat disambung.
    const jam = setInterval(() => {
      setFaktor((lama) => {
        const baru = { ...lama };
        ['BTCUSDT', 'ETHUSDT', 'XAUTUSDT'].forEach((s) => {
          const kini = baru[s] ?? 1;
          baru[s] = Math.max(0.7, Math.min(1.4, kini * (1 + (Math.random() - 0.5) * 0.006)));
        });
        return baru;
      });
      setBerdenyut(true);
      setTimeout(() => setBerdenyut(false), 700);
    }, 6000);
    return () => clearInterval(jam);
  }, []);

  const asetHidup = useMemo(
    () => ASET.map((a) => ({ ...a, nilaiKini: a.simbol ? a.nilai * (faktor[a.simbol] ?? 1) : a.nilai })),
    [faktor]
  );

  const totalAset = asetHidup.reduce((s, a) => s + a.nilaiKini, 0);
  const totalKewajiban = KEWAJIBAN.reduce((s, k) => s + k.nilai, 0);
  const portoBersih = totalAset - totalKewajiban;
  const likuid = asetHidup
    .filter((a) => a.kategori !== 'Emas' && a.kategori !== 'Sekuritas')
    .reduce((s, a) => s + a.nilaiKini, 0);

  const perKategori = KATEGORI.map((k) => ({
    nama: k,
    nilai: asetHidup.filter((a) => a.kategori === k).reduce((s, a) => s + a.nilaiKini, 0),
  })).filter((k) => k.nilai > 0);

  const bulanIni = PORTO_BULANAN[PORTO_BULANAN.length - 1];
  const bulanLalu = PORTO_BULANAN[PORTO_BULANAN.length - 2];
  const tumbuh = ((bulanIni.porto - bulanLalu.porto) / bulanLalu.porto) * 100;

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Aset Kotor"    nilai={rupiahRingkas(totalAset)}      catatan={`${ASET.length} pos tercatat`} Ikon={Wallet} />
        <KartuKpi label="Porto Bersih"  nilai={rupiahRingkas(portoBersih)}    delta={Number(tumbuh.toFixed(1))} Ikon={TrendingUp} />
        <KartuKpi label="Liquid Cash"   nilai={rupiahRingkas(likuid)}         catatan="tanpa emas & sekuritas" Ikon={Banknote} />
        <KartuKpi label="Total Bon"     nilai={rupiahRingkas(totalKewajiban)} catatan={`${KEWAJIBAN.length} kewajiban`} Ikon={Scale} warna="text-red-400" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Komposisi */}
        <Panel>
          <PanelHead
            judul="Komposisi Porto"
            sub="Sebaran aset menurut jenisnya."
            kanan={
              <span className={cn(
                'flex items-center gap-1.5 text-[11px] transition-colors',
                berdenyut ? 'text-emerald-400' : 'text-zinc-600'
              )}>
                <Radio className="size-3" /> live
              </span>
            }
          />
          <div className="px-5 pb-5">
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={perKategori} dataKey="nilai" nameKey="nama"
                    innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none"
                    isAnimationActive={false}
                  >
                    {perKategori.map((k) => (
                      <Cell key={k.nama} fill={WARNA_KATEGORI[k.nama as KategoriAset]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }: any) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
                          <div className="text-[11px] text-zinc-500">{payload[0].name}</div>
                          <div className="angka text-[12.5px] text-zinc-100">{rupiah(payload[0].value)}</div>
                          <div className="text-[11px] text-zinc-500">
                            {((payload[0].value / totalAset) * 100).toFixed(1)}% dari total
                          </div>
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {perKategori.map((k) => (
                <div key={k.nama} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: WARNA_KATEGORI[k.nama as KategoriAset] }} />
                  <span className="flex-1 text-zinc-400">{k.nama}</span>
                  <span className="angka text-zinc-300">{((k.nilai / totalAset) * 100).toFixed(1)}%</span>
                  <span className="angka w-24 text-right text-zinc-500">{rupiahRingkas(k.nilai)}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Perkembangan */}
        <Panel className="lg:col-span-2">
          <PanelHead judul="Perkembangan Porto" sub="Dua belas bulan terakhir." />
          <div className="h-[300px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PORTO_BULANAN} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPorto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffcd75" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#ffcd75" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="bulan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={56}
                       tickFormatter={(v) => `${Math.round(v / 1_000_000)}jt`} />
                <Tooltip
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
                        <div className="text-[11px] text-zinc-500">{label}</div>
                        <div className="angka text-[12.5px] text-zinc-100">{rupiah(payload[0].value)}</div>
                      </div>
                    ) : null
                  }
                  cursor={{ stroke: 'rgba(255,255,255,.12)' }}
                />
                <Area type="monotone" dataKey="porto" stroke="#ffcd75" strokeWidth={1.8} fill="url(#gPorto)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Pemasukan vs pengeluaran */}
      <Panel className="mt-4">
        <PanelHead judul="Pemasukan vs Pengeluaran" sub="Arus kas bulanan dan selisih bersihnya." />
        <div className="h-[240px] px-2 pb-4">
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
                      {payload.map((p: any) => (
                        <div key={p.dataKey} className="angka text-[12.5px]" style={{ color: p.color }}>
                          {p.name}: {rupiah(p.value)}
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
      </Panel>

      {/* Daftar aset + cara mengisi */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead
            judul="Rincian Aset"
            sub="Pos bertanda live ikut bergerak mengikuti harga pasar."
            kanan={
              <button className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
                <Plus className="size-3.5" /> Tambah pos
              </button>
            }
          />
          <div className="px-5 pb-5">
            <TabelBungkus className="max-h-[420px] overflow-y-auto">
              <Tabel>
                <thead className="sticky top-0 bg-zinc-950">
                  <tr><Th>Pos</Th><Th>Jenis</Th><Th className="text-right">Nilai</Th><Th className="text-right">Porsi</Th></tr>
                </thead>
                <tbody>
                  {asetHidup.map((a) => (
                    <Tr key={a.nama}>
                      <Td>
                        <span className="text-zinc-200">{a.nama}</span>
                        {a.simbol && (
                          <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] text-emerald-500">live</span>
                        )}
                      </Td>
                      <Td>
                        <span className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                          <span className="size-2 rounded-sm" style={{ background: WARNA_KATEGORI[a.kategori] }} />
                          {a.kategori}
                        </span>
                      </Td>
                      <Td className="angka text-right text-zinc-100">{rupiah(a.nilaiKini)}</Td>
                      <Td className="angka text-right text-zinc-500">{((a.nilaiKini / totalAset) * 100).toFixed(1)}%</Td>
                    </Tr>
                  ))}
                  <Tr className="border-t border-zinc-800">
                    <Td className="font-medium text-zinc-100" colSpan={2}>Aset Kotor</Td>
                    <Td className="angka text-right font-medium text-zinc-100">{rupiah(totalAset)}</Td>
                    <Td className="angka text-right text-zinc-500">100%</Td>
                  </Tr>
                </tbody>
              </Tabel>
            </TabelBungkus>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHead judul="Sumber Data" sub="Unggah lembar, atau isi manual." />
            <div className="space-y-3 px-5 pb-5">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-center transition-colors hover:border-zinc-600 hover:bg-zinc-900/40">
                <Upload className="size-5 text-zinc-500" strokeWidth={1.8} />
                <span className="text-[12.5px] text-zinc-300">Unggah Excel / CSV</span>
                <span className="text-[11px] text-zinc-600">Kolom: Tanggal · Pos · Nilai · Jenis</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" />
              </label>

              <div className="rounded-lg border border-zinc-800/60 p-3">
                <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Isi manual</div>
                <div className="space-y-2">
                  <input placeholder="Nama pos, mis. Bank Mandiri"
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Nilai (Rp)" inputMode="numeric"
                      className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600" />
                    <select className="h-9 w-full cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[12.5px] text-zinc-300 outline-none">
                      {KATEGORI.map((k) => <option key={k}>{k}</option>)}
                    </select>
                  </div>
                  <button className="w-full cursor-pointer rounded-md bg-zinc-100 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white">
                    Simpan pos
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[11.5px] leading-relaxed text-zinc-600">
                <RefreshCw className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Pos dengan simbol pasar disegarkan tiap 6 detik. Saldo bank dan emas fisik
                  tidak ikut berkedip — nilainya memang tidak berubah tiap detik.
                </span>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHead judul="Kewajiban" sub="Dikurangkan dari aset kotor." />
            <div className="px-5 pb-5">
              <TabelBungkus>
                <Tabel>
                  <tbody>
                    {KEWAJIBAN.map((k) => (
                      <Tr key={k.nama}>
                        <Td className="text-zinc-300">{k.nama}</Td>
                        <Td className="angka text-right text-red-400">{rupiah(k.nilai)}</Td>
                      </Tr>
                    ))}
                    <Tr className="border-t border-zinc-800">
                      <Td className="font-medium text-zinc-100">Porto Bersih</Td>
                      <Td className="angka text-right font-medium text-zinc-100">{rupiah(portoBersih)}</Td>
                    </Tr>
                  </tbody>
                </Tabel>
              </TabelBungkus>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
