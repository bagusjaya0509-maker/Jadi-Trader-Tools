import { useMemo, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  CheckCircle2, AlertCircle, Clock, Plus, RefreshCw, Trash2, KeyRound, ShieldAlert,
} from 'lucide-react';
import { Panel, PanelHead, KartuKpi, BadgeTren, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, tanggalPendek } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import {
  useTrafik, useKlien, usePenjualan, useLaporan, useLisensi, useStatusVps,
  usePermintaanLisensi,
  catatPenjualan, hapusPenjualan, tandaiLaporan, cabutLisensi,
} from '@/lib/admin';

/* Traffic & Sales memakai kerangka Efferd yang sama persis dengan Dashboard:
   empat KPI di atas, dua panel besar, lalu panel-panel bawah. Yang berbeda
   cuma isinya — supaya berpindah antar halaman tidak terasa berpindah situs.

   Seluruh isinya sekarang datang dari backend VPS. Sebelumnya halaman ini
   memakai data contoh: tiga klien karangan, empat penjualan karangan, dan
   grafik trafik dua puluh hari yang tidak pernah terjadi. Halaman untuk
   mengambil keputusan adalah tempat paling buruk untuk angka karangan. */

function jamLalu(ms: number) {
  if (!ms) return '—';
  const menit = Math.round((Date.now() - ms) / 60000);
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.round(jam / 24)} hari lalu`;
}

/** Satu tempat untuk "belum ada apa-apa" dan "gagal mengambil".
 *
 *  Panel kosong tanpa keterangan selalu terbaca sebagai kerusakan. Yang
 *  membedakan "belum ada penjualan" dari "App Token salah" cuma kalimat
 *  ini — dan dua keadaan itu menuntut tindakan yang sama sekali berbeda. */
function Kabar({ memuat, galat, kosong, teksKosong }: {
  memuat: boolean; galat: string | null; kosong: boolean; teksKosong: string;
}) {
  if (memuat) return <div className="py-6 text-center text-[12.5px] text-zinc-600">Memuat…</div>;
  if (galat) return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2} />
      <div className="text-[12.5px] text-amber-200/90">{galat}</div>
    </div>
  );
  if (kosong) return <div className="py-6 text-center text-[12.5px] text-zinc-600">{teksKosong}</div>;
  return null;
}

export default function Pemilik() {
  const { pemilik } = useAuth();
  const trafik = useTrafik();
  const klien = useKlien();
  const penjualan = usePenjualan();
  const laporan = useLaporan();
  const lisensi = useLisensi();
  const vps = useStatusVps();
  /* Permintaan lisensi dipakai untuk menautkan tiap kode aktif ke pembelinya.
     Kode yang tidak punya pasangan permintaan berarti diaktifkan tangan lewat
     panel V2 — biasanya uji coba, dan itu perlu terlihat sebagai apa adanya
     alih-alih tercampur dengan pembelian sungguhan. */
  const permintaan = usePermintaanLisensi();

  const [pesan, setPesan] = useState('');
  const [form, setForm] = useState({ produk: '', pembeli: '', nilai: '', catatan: '' });
  const [sibuk, setSibuk] = useState(false);

  const totalPenjualan = penjualan.data.reduce((s, p) => s + p.nilai, 0);
  const laporanBaru = laporan.data.filter((l) => l.status === 'baru').length;
  const hariIni = trafik.data[trafik.data.length - 1];
  const kemarin = trafik.data[trafik.data.length - 2];
  const ramPakai = vps.data.ramTotalMb - vps.data.ramBebasMb;

  /* Tren dihitung dari dua hari yang benar-benar ada. Delta tetap (+12,4%)
     yang ditulis di kode adalah janji yang tidak pernah ditepati datanya. */
  const trenKunjungan = hariIni && kemarin && kemarin.total > 0
    ? Number((((hariIni.total - kemarin.total) / kemarin.total) * 100).toFixed(1))
    : null;

  /* Penjualan per bulan, dari catatan penjualan yang sungguhan. Panel ini
     dulu menggambar `PORTO_BULANAN` — pemasukan & pengeluaran pribadi dalam
     rupiah yang tidak punya sumber di mana pun. */
  const perBulan = useMemo(() => {
    const peta = new Map<string, { bulan: string; nilai: number; jumlah: number }>();
    penjualan.data.forEach((p) => {
      const d = new Date(p.waktu);
      const kunci = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = peta.get(kunci) ?? {
        bulan: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }), nilai: 0, jumlah: 0,
      };
      b.nilai += p.nilai; b.jumlah += 1;
      peta.set(kunci, b);
    });
    return [...peta.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [penjualan.data]);

  /* Halaman mana yang paling ramai — dari rincian per halaman yang memang
     sudah dikirim backend, tapi selama ini tidak pernah ditampilkan. */
  const perHalaman = useMemo(() => {
    const peta = new Map<string, number>();
    trafik.data.forEach((h) => Object.entries(h.halaman).forEach(([n, v]) =>
      peta.set(n, (peta.get(n) ?? 0) + Number(v))));
    return [...peta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [trafik.data]);

  async function tambahPenjualan() {
    const nilai = Number(form.nilai);
    if (!form.produk.trim()) { setPesan('Nama produk wajib diisi.'); return; }
    if (!isFinite(nilai) || nilai <= 0) { setPesan('Nilai penjualan harus angka lebih dari nol.'); return; }
    setSibuk(true);
    try {
      await catatPenjualan({ produk: form.produk.trim(), pembeli: form.pembeli.trim(), nilai, catatan: form.catatan.trim() });
      setForm({ produk: '', pembeli: '', nilai: '', catatan: '' });
      setPesan('Penjualan tercatat.');
      penjualan.muatUlang();
    } catch (e) {
      setPesan('Gagal mencatat: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setSibuk(false); }
  }

  async function jalankan(kerja: () => Promise<unknown>, kabar: string, segarkan: () => void) {
    setSibuk(true);
    try { await kerja(); setPesan(kabar); segarkan(); }
    catch (e) { setPesan('Gagal: ' + (e instanceof Error ? e.message : 'tidak diketahui')); }
    finally { setSibuk(false); }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Revenue" nilai={uang(totalPenjualan)}
                  catatan={`${penjualan.data.length} penjualan tercatat`} />
        <KartuKpi label="Active clients" nilai={String(klien.data.length)}
                  catatan="akun yang pernah masuk" />
        <KartuKpi label="Visits today" nilai={String(hariIni?.total ?? 0)}
                  delta={trenKunjungan ?? undefined} deltaSufiks="vs kemarin"
                  catatan={hariIni ? `${hariIni.unik} pengunjung unik` : 'belum ada kunjungan hari ini'} />
        <KartuKpi label="Open reports" nilai={String(laporanBaru)}
                  catatan={`${laporan.data.length} laporan total`} />
      </div>

      {pesan && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-[12.5px] text-zinc-300">
          {pesan}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
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

      {/* ── Penjualan per bulan ── */}
      <Panel className="mt-4">
        <PanelHead judul="Penjualan per Bulan" sub="Dari catatan penjualan yang kamu masukkan." />
        <div className="h-[240px] px-2 pb-4">
          {perBulan.length === 0 ? (
            <div className="px-3 pt-3">
              <Kabar memuat={penjualan.memuat} galat={penjualan.galat} kosong
                     teksKosong="Belum ada penjualan tercatat. Tambahkan lewat kotak di bawah." />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perBulan} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="bulan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                       tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<TipGrafik />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="nilai" name="Penjualan" fill="#10b981" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pencatatan manual — Lynk tidak mengirim webhook ke backend, jadi
            satu-satunya cara penjualan masuk ke laporan adalah dicatat di
            sini. Tanpa kotak ini, panel penjualan selamanya kosong. */}
        <div className="border-t border-zinc-800/80 px-5 py-4">
          <div className="mb-2 text-[11px] text-zinc-500">Catat penjualan baru</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            <input value={form.produk} onChange={(e) => setForm({ ...form, produk: e.target.value })}
                   placeholder="Produk" disabled={!pemilik}
                   className="h-9 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50 sm:col-span-2" />
            <input value={form.pembeli} onChange={(e) => setForm({ ...form, pembeli: e.target.value })}
                   placeholder="Pembeli (email)" disabled={!pemilik}
                   className="h-9 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
            <input value={form.nilai} onChange={(e) => setForm({ ...form, nilai: e.target.value })}
                   placeholder="Nilai ($)" inputMode="decimal" disabled={!pemilik}
                   className="angka h-9 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
            <button onClick={() => void tambahPenjualan()} disabled={sibuk || !pemilik}
                    title={pemilik ? undefined : 'Hanya pemilik yang boleh mencatat penjualan'}
                    className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-zinc-100 px-3 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="size-3.5" /> Catat
            </button>
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHead judul="Recent sales" sub="Penjualan terakhir yang tercatat." />
          <div className="px-5 pb-5">
            <Kabar memuat={penjualan.memuat} galat={penjualan.galat} kosong={!penjualan.data.length}
                   teksKosong="Belum ada penjualan." />
            {penjualan.data.length > 0 && (
              <TabelBungkus>
                <Tabel>
                  <thead><tr><Th>Tanggal</Th><Th>Produk</Th><Th className="text-right">Nilai</Th><Th /></tr></thead>
                  <tbody>
                    {penjualan.data.slice(0, 12).map((p) => (
                      <Tr key={p.id}>
                        <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(p.waktu)}</Td>
                        <Td className="text-zinc-300">
                          {p.produk}
                          {p.pembeli && <div className="text-[11px] text-zinc-600">{p.pembeli}</div>}
                        </Td>
                        <Td className="angka text-right text-emerald-500">{uang(p.nilai)}</Td>
                        <Td className="text-right">
                          <button
                            onClick={() => void jalankan(() => hapusPenjualan(p.id), 'Catatan penjualan dihapus.', penjualan.muatUlang)}
                            disabled={sibuk || !pemilik} aria-label={`Hapus catatan ${p.produk}`}
                            className="cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40">
                            <Trash2 className="size-3.5" />
                          </button>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Tabel>
              </TabelBungkus>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHead judul="Client health" sub="Akun yang pernah masuk dan seberapa aktif."
                     kanan={<span className="angka text-[12px] text-zinc-500">{klien.data.length}</span>} />
          <div className="space-y-2.5 px-5 pb-5">
            <Kabar memuat={klien.memuat} galat={klien.galat} kosong={!klien.data.length}
                   teksKosong="Belum ada klien yang masuk." />
            {klien.data.map((k) => (
              <div key={k.uid} className="flex items-center justify-between rounded-lg border border-zinc-800/60 p-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-zinc-200">{k.email || k.uid}</div>
                  <div className="text-[11.5px] text-zinc-500">
                    {k.nama ? `${k.nama} · ` : ''}{jamLalu(k.terakhir)}
                  </div>
                </div>
                <span className="angka shrink-0 text-[12.5px] text-zinc-400">{k.kunjungan}×</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead judul="Activity" sub="Laporan bug, saran, dan error dari pengguna."
                     kanan={
                       <button onClick={laporan.muatUlang} title="Segarkan"
                               className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
                         <RefreshCw className={cn('size-3.5', laporan.memuat && 'animate-spin')} />
                       </button>
                     } />
          <div className="max-h-[460px] overflow-y-auto px-5 pb-5">
            <Kabar memuat={laporan.memuat} galat={laporan.galat} kosong={!laporan.data.length}
                   teksKosong="Belum ada laporan." />
            {laporan.data.slice(0, 40).map((l) => (
              <div key={l.id} className="flex gap-3 py-2.5">
                <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                  <Clock className="size-3 text-zinc-500" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] uppercase',
                      l.jenis === 'error' ? 'bg-red-500/10 text-red-400'
                        : l.jenis === 'saran' ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-amber-500/10 text-amber-400'
                    )}>{l.jenis}</span>
                    {l.status === 'baru' ? (
                      <button
                        onClick={() => void jalankan(() => tandaiLaporan(l.id, 'selesai'), 'Laporan ditandai selesai.', laporan.muatUlang)}
                        disabled={sibuk || !pemilik}
                        className="cursor-pointer text-[10px] text-zinc-500 underline-offset-2 transition-colors hover:text-emerald-500 hover:underline disabled:cursor-not-allowed disabled:opacity-50">
                        tandai selesai
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-600/80">{l.status}</span>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-3 text-[12.5px] text-zinc-300">{l.pesan}</div>
                  <div className="text-[11.5px] text-zinc-600">
                    {l.halaman}{l.email ? ` · ${l.email}` : ''} · {jamLalu(l.waktu)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Lisensi ── */}
      <Panel className="mt-4">
        <PanelHead judul="Aktivasi & Lisensi" sub="Kode lisensi produk yang sedang aktif."
                   kanan={<span className="angka text-[12px] text-zinc-500">{lisensi.data.length} aktif</span>} />
        <div className="px-5 pb-5">
          <Kabar memuat={lisensi.memuat} galat={lisensi.galat} kosong={!lisensi.data.length}
                 teksKosong="Belum ada lisensi aktif." />
          {lisensi.data.length > 0 && (
            <TabelBungkus>
              <Tabel>
                <thead><tr><Th>Produk</Th><Th>Pemilik</Th><Th>Asal</Th><Th>Sidik</Th><Th>Aktif sejak</Th><Th /></tr></thead>
                <tbody>
                  {lisensi.data.map((l) => {
                    const dariMinta = permintaan.data.find((x) => x.sidik === l.sidik || (x.status === 'disetujui' && x.email && x.email === l.catatan));
                    return (
                    <Tr key={l.sidik}>
                      <Td className="text-zinc-300">{l.produk}</Td>
                      <Td className="text-zinc-400">{dariMinta?.email || l.catatan || '—'}</Td>
                      <Td>
                        {dariMinta ? (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-500">
                            permintaan disetujui
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500"
                                title="Diaktifkan langsung lewat panel, tanpa permintaan dari pembeli — biasanya uji coba">
                            aktivasi manual
                          </span>
                        )}
                      </Td>
                      {/* Sidik, bukan kodenya. Backend memang tidak pernah
                          menyimpan kode aslinya — hanya hash-nya. */}
                      <Td className="angka text-zinc-600">{l.sidik}</Td>
                      <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(l.tgl)}</Td>
                      <Td className="text-right">
                        <button
                          onClick={() => {
                            if (!confirm(`Cabut lisensi "${l.catatan || l.sidik}"?\n\nPemakainya langsung kehilangan akses.`)) return;
                            void jalankan(() => cabutLisensi(l.sidik), 'Lisensi dicabut.', lisensi.muatUlang);
                          }}
                          disabled={sibuk || !pemilik}
                          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11.5px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40">
                          <KeyRound className="size-3.5" /> Cabut
                        </button>
                      </Td>
                    </Tr>
                    );
                  })}
                </tbody>
              </Tabel>
            </TabelBungkus>
          )}
          <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-600">
            Backend hanya menyimpan SIDIK kodenya, bukan kode aslinya — bocornya berkas lisensi
            tidak membuat siapa pun bisa mengunduh produk. Kode yang bisa dibaca ulang hanya ada
            di baris permintaan yang disetujui, di halaman Maintenance.
          </p>
        </div>
      </Panel>
    </div>
  );
}
