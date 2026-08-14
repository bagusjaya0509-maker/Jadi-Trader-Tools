import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Clock, Plus, RefreshCw, Trash2, KeyRound, ShieldAlert, TrendingDown,
} from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, tanggalPendek } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useKurs } from '@/lib/kurs';
import {
  useKlien, usePenjualan, usePengeluaran, useLaporan, useLisensi,
  usePermintaanLisensi,
  catatPenjualan, hapusPenjualan, catatPengeluaran, hapusPengeluaran,
  tandaiLaporan, cabutLisensi,
} from '@/lib/admin';

/* Traffic & Sales memakai kerangka Efferd yang sama persis dengan Dashboard:
   empat KPI di atas, dua panel besar, lalu panel-panel bawah. Yang berbeda
   cuma isinya — supaya berpindah antar halaman tidak terasa berpindah situs.

   Seluruh isinya sekarang datang dari backend VPS. Sebelumnya halaman ini
   memakai data contoh: tiga klien karangan, empat penjualan karangan, dan
   grafik trafik dua puluh hari yang tidak pernah terjadi. Halaman untuk
   mengambil keputusan adalah tempat paling buruk untuk angka karangan. */

/* Kategori pengeluaran yang tetap. Daftar pilihan, bukan teks bebas:
   "VPS", "vps", dan "Sewa VPS" akan jadi tiga pos berbeda saat dijumlahkan,
   dan laporan yang posnya bercabang sendiri berhenti bisa dibandingkan
   antar bulan. */
const KATEGORI_KELUAR = [
  'Server & Domain', 'Iklan & Promosi', 'Alat & Langganan',
  'Jasa & Tenaga', 'Legal & Perizinan', 'Lainnya',
];

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
  const klien = useKlien();
  const penjualan = usePenjualan();
  const pengeluaran = usePengeluaran();
  const { kurs, setKurs, tampil, setTampil, fmt } = useKurs();
  const laporan = useLaporan();
  const lisensi = useLisensi();
  /* Permintaan lisensi dipakai untuk menautkan tiap kode aktif ke pembelinya.
     Kode yang tidak punya pasangan permintaan berarti diaktifkan tangan lewat
     panel V2 — biasanya uji coba, dan itu perlu terlihat sebagai apa adanya
     alih-alih tercampur dengan pembelian sungguhan. */
  const permintaan = usePermintaanLisensi();

  const [pesan, setPesan] = useState('');
  const [form, setForm] = useState({ produk: '', pembeli: '', nilai: '', catatan: '' });
  const [formKeluar, setFormKeluar] = useState({ keperluan: '', kategori: '', nilai: '', catatan: '' });
  const [sibuk, setSibuk] = useState(false);

  const totalPenjualan = penjualan.data.reduce((s, p) => s + p.nilai, 0);
  const totalPengeluaran = pengeluaran.data.reduce((s, p) => s + p.nilai, 0);
  /* Laba BERSIH, bukan omzet. Halaman yang cuma menampilkan pemasukan
     membuat usaha terlihat lebih sehat daripada kenyataannya — dan itu
     justru angka yang dipakai memutuskan boleh belanja apa berikutnya. */
  const labaBersih = totalPenjualan - totalPengeluaran;


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

  async function tambahPengeluaran() {
    const nilai = Number(formKeluar.nilai);
    if (!formKeluar.keperluan.trim()) { setPesan('Keperluan wajib diisi.'); return; }
    if (!isFinite(nilai) || nilai <= 0) { setPesan('Nilai pengeluaran harus angka lebih dari nol.'); return; }
    setSibuk(true);
    try {
      await catatPengeluaran({
        keperluan: formKeluar.keperluan.trim(), kategori: formKeluar.kategori.trim(),
        nilai, catatan: formKeluar.catatan.trim(),
      });
      setFormKeluar({ keperluan: '', kategori: '', nilai: '', catatan: '' });
      setPesan('Pengeluaran tercatat.');
      pengeluaran.muatUlang();
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
      {/* ── Sakelar mata uang ──────────────────────────────────────────
          Semua nilai TERSIMPAN dalam dolar; ini cuma cara membacanya.
          Kursnya diketik sendiri, bukan diambil dari layanan kurs hidup:
          laporan yang angkanya berubah sendiri tiap hari tidak bisa
          dibandingkan antar bulan — "Agustus Rp 2,4 juta" hari ini bisa
          jadi "Rp 2,45 juta" minggu depan tanpa satu transaksi pun
          berubah. Kurs yang diketik sendiri selalu bisa
          dipertanggungjawabkan. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-zinc-800">
          {(['USD', 'IDR'] as const).map((m) => (
            <button key={m} onClick={() => setTampil(m)}
              className={cn('cursor-pointer px-3 py-1.5 text-[12px] transition-colors',
                tampil === m ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200')}>
              {m === 'USD' ? '$ USD' : 'Rp IDR'}
            </button>
          ))}
        </div>
        {tampil === 'IDR' && (
          <label className="flex items-center gap-2 text-[11.5px] text-zinc-500">
            1 USD =
            <input value={kurs} onChange={(e) => setKurs(Number(e.target.value))}
                   inputMode="numeric"
                   className="angka h-8 w-24 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[12px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600" />
            IDR
          </label>
        )}
        <span className="text-[11px] text-zinc-600">
          Semua nilai dicatat dalam dolar — ini cuma cara menampilkannya.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Revenue" nilai={fmt(totalPenjualan)}
                  catatan={`${penjualan.data.length} penjualan tercatat`} />
        <KartuKpi label="Active clients" nilai={String(klien.data.length)}
                  catatan="akun yang pernah masuk" />
        <KartuKpi label="Pengeluaran" nilai={fmt(totalPengeluaran)}
                  catatan={`${pengeluaran.data.length} pengeluaran tercatat`} />
        <KartuKpi label="Laba bersih" nilai={fmt(labaBersih)}
                  catatan={labaBersih >= 0 ? 'pemasukan dikurangi pengeluaran' : 'pengeluaran melebihi pemasukan'} />
      </div>

      {pesan && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-[12.5px] text-zinc-300">
          {pesan}
        </div>
      )}

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

      {/* ── Pengeluaran ────────────────────────────────────────────────
          Sejajar dengan penjualan, bukan disembunyikan di halaman lain:
          laba bersih cuma berarti kalau kedua sisinya terlihat berdampingan.
          Kalau pengeluaran harus dicari di tempat terpisah, yang dilihat
          orang tiap hari cuma pemasukan — dan usaha akan selalu tampak
          lebih sehat daripada kenyataannya. */}
      <Panel className="mt-4">
        <PanelHead judul="Pengeluaran" sub="Biaya yang keluar — VPS, domain, iklan, alat, apa pun."
                   kanan={
                     <span className="angka text-[12.5px] text-red-400/90">
                       −{fmt(totalPengeluaran)}
                     </span>
                   } />
        <div className="px-5 pb-5">
          <Kabar memuat={pengeluaran.memuat} galat={pengeluaran.galat} kosong={!pengeluaran.data.length}
                 teksKosong="Belum ada pengeluaran tercatat." />
          {pengeluaran.data.length > 0 && (
            <TabelBungkus>
              <Tabel>
                <thead><tr><Th>Tanggal</Th><Th>Keperluan</Th><Th>Kategori</Th><Th className="text-right">Nilai</Th><Th /></tr></thead>
                <tbody>
                  {pengeluaran.data.slice(0, 20).map((p) => (
                    <Tr key={p.id}>
                      <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(p.waktu)}</Td>
                      <Td className="text-zinc-200">
                        {p.keperluan}
                        {p.catatan && <div className="text-[11px] text-zinc-600">{p.catatan}</div>}
                      </Td>
                      <Td className="text-zinc-500">{p.kategori || '—'}</Td>
                      <Td className="angka text-right text-red-400/90">−{fmt(p.nilai)}</Td>
                      <Td className="text-right">
                        <button
                          onClick={() => {
                            /* Konfirmasi MENYEBUT apa yang dihapus. Catatan
                               keuangan yang hilang tidak bisa disusun ulang
                               dari ingatan. */
                            if (!confirm(`Hapus pengeluaran "${p.keperluan}" senilai ${fmt(p.nilai)}?`)) return;
                            void jalankan(() => hapusPengeluaran(p.id), 'Pengeluaran dihapus.', pengeluaran.muatUlang);
                          }}
                          disabled={sibuk || !pemilik}
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
        <div className="border-t border-zinc-800/80 px-5 py-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <TrendingDown className="size-3.5 text-red-400/80" /> Catat pengeluaran baru
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            <input value={formKeluar.keperluan} onChange={(e) => setFormKeluar({ ...formKeluar, keperluan: e.target.value })}
                   placeholder="Keperluan — mis. Sewa VPS Agustus" disabled={!pemilik}
                   className="h-9 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50 sm:col-span-2" />
            {/* Kategori sebagai daftar pilihan, bukan teks bebas: "VPS",
                "vps", dan "Sewa VPS" akan jadi tiga kategori berbeda saat
                nanti dijumlahkan per pos. */}
            <select value={formKeluar.kategori} onChange={(e) => setFormKeluar({ ...formKeluar, kategori: e.target.value })}
                    disabled={!pemilik}
                    className="h-9 cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50">
              <option value="">Kategori…</option>
              {KATEGORI_KELUAR.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input value={formKeluar.nilai} onChange={(e) => setFormKeluar({ ...formKeluar, nilai: e.target.value })}
                   placeholder="Nilai ($)" inputMode="decimal" disabled={!pemilik}
                   className="angka h-9 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
            <button onClick={() => void tambahPengeluaran()} disabled={sibuk || !pemilik}
                    title={pemilik ? undefined : 'Hanya pemilik yang boleh mencatat pengeluaran'}
                    className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 text-[12px] font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">
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
                        <Td className="angka text-right text-emerald-500">{fmt(p.nilai)}</Td>
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
