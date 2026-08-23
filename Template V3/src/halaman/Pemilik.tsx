import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Plus, Trash2, KeyRound, ShieldAlert, TrendingDown,
} from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, tanggalPendek } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useKurs } from '@/lib/kurs';
import { useHargaPaket } from '@/lib/harga-akses';
import {
  useKlien, usePenjualan, usePengeluaran, useLisensi,
  type PermintaanLisensi,
  usePermintaanLisensi,
  catatPenjualan, hapusPenjualan, catatPengeluaran, hapusPengeluaran,
  cabutLisensi,
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

/** Kelas gulir untuk daftar yang sudah kepanjangan.
 *
 *  AMBANGNYA JUMLAH BARIS, bukan tinggi piksel. Panel berisi lima baris
 *  tidak boleh kelihatan terpotong: batas tinggi yang dipasang terus-menerus
 *  membuat daftar pendek pun tampak seperti ada sisa yang tersembunyi, dan
 *  orang menggulir mencari sesuatu yang tidak ada.
 *
 *  Scrollbar-nya disembunyikan lewat .gulir-senyap — batang abu-abu di dalam
 *  kartu lebih berisik daripada isinya. Rodanya tetap jalan, dan di layar
 *  sentuh seretannya memang tidak pernah butuh batang.
 *
 *  Tingginya ditaksir dari tinggi baris yang sesungguhnya: baris tabel
 *  py-3 + border ≈ 45 px, kartu klien p-3 dua baris + gap ≈ 72 px. */
/* Lima tingkat lisensi, urut dari yang paling murah. Sub-judulnya sebuah
   FUNGSI, bukan untai jadi: harganya diambil dari setelan Maintenance dan
   halaman ini punya sakelar USD/IDR — angka yang ditulis mati di sini akan
   berbohong dua kali, saat harganya diubah dan saat tampilannya ditukar. */
const KELOMPOK_LISENSI = [
  { id: 'gratis',   judul: 'Gratis',              sub: () => 'Akses 30 hari tanpa biaya, dari kuota gratis.' },
  { id: 'testing',  judul: 'Testing — New Launch', sub: (f: (n: number) => string, h?: { hargaTesting: number; hargaTestingCoret: number }) =>
      h ? (h.hargaTestingCoret > h.hargaTesting ? `${f(h.hargaTesting)} · dari ${f(h.hargaTestingCoret)}` : f(h.hargaTesting)) : '' },
  { id: 'premium3', judul: 'Premium 3 Bulan',     sub: (f: (n: number) => string, h?: { hargaPremium3: number }) => (h ? f(h.hargaPremium3) : '') },
  { id: 'tahunan',  judul: 'Tahunan',             sub: (f: (n: number) => string, h?: { hargaTahunan: number }) => (h ? f(h.hargaTahunan) : '') },
  { id: 'market',   judul: 'Produk Marketplace',  sub: () => 'Indikator dan EA yang dibeli terpisah dari paket akses.' },
  { id: 'lain',     judul: 'Aktivasi Manual',     sub: () => 'Diaktifkan langsung lewat panel, tanpa permintaan dari pembeli — biasanya uji coba.' },
] as const;

const gulirJika = (jumlah: number, ambang: number, tinggi: string) =>
  jumlah > ambang ? `${tinggi} overflow-y-auto gulir-senyap` : '';

export default function Pemilik() {
  const { pemilik } = useAuth();
  const klien = useKlien();
  const penjualan = usePenjualan();
  const pengeluaran = usePengeluaran();
  const { kurs, setKurs, tampil, setTampil, fmt } = useKurs();
  const lisensi = useLisensi();
  /* Permintaan lisensi dipakai untuk menautkan tiap kode aktif ke pembelinya.
     Kode yang tidak punya pasangan permintaan berarti diaktifkan tangan lewat
     panel V2 — biasanya uji coba, dan itu perlu terlihat sebagai apa adanya
     alih-alih tercampur dengan pembelian sungguhan. */
  const permintaan = usePermintaanLisensi();
  /* Tabel harga paket, dari setelan Maintenance yang sama dengan halaman
     harga. Dipakai sebagai CADANGAN saja — permintaan yang sudah menyimpan
     `hargaSaat` memakai angkanya sendiri. */
  const harga = useHargaPaket();

  const [pesan, setPesan] = useState('');
  const [form, setForm] = useState({ produk: '', pembeli: '', nilai: '', catatan: '' });
  const [formKeluar, setFormKeluar] = useState({ keperluan: '', kategori: '', nilai: '', catatan: '', mata: 'usd' });
  const [sibuk, setSibuk] = useState(false);

  /* ── PEMASUKAN LISENSI, dihitung sendiri dari Maintenance ────────────
     Tiap permintaan berbayar yang DISETUJUI adalah satu penjualan. Tidak
     perlu dicatat ulang dengan tangan, dan tidak boleh: dua daftar untuk
     satu kejadian akan selalu berselisih, dan yang salah selalu yang tidak
     sedang dilihat.

     Harganya diambil dari `hargaSaat` — harga yang berlaku SAAT permintaan
     dibuat. Ini penting: harga paket bisa dinaikkan besok, dan pemasukan
     bulan lalu tidak boleh ikut berubah karenanya. Permintaan lama belum
     punya medan itu, jadi ada cadangan dari tabel harga sekarang; paket
     kosong diperlakukan sebagai testing, sama dengan cara panel lisensi
     menampilkannya.

     Tanggalnya `diputusPada`, bukan `waktu`: yang dicatat laporan ini
     adalah kapan uangnya masuk, bukan kapan orang menekan tombol minta. */
  const hargaLisensi = (x: PermintaanLisensi): number => {
    if (Number.isFinite(x.hargaSaat) && (x.hargaSaat as number) > 0) return x.hargaSaat as number;
    if (x.paket === 'tahunan') return harga.hargaTahunan;
    if (x.paket === 'premium3') return harga.hargaPremium3;
    return harga.hargaTesting;
  };
  const lisensiTerjual = useMemo(
    () => permintaan.data.filter((x) => x.status === 'disetujui' && x.jenis === 'bayar'),
    [permintaan.data]);
  const totalLisensi = useMemo(
    () => lisensiTerjual.reduce((s, x) => s + hargaLisensi(x), 0),
    [lisensiTerjual, harga]);

  const totalManual = penjualan.data.reduce((s, p) => s + p.nilai, 0);
  /* Omzet = lisensi otomatis + catatan tangan. Yang kedua tetap ada untuk
     pemasukan di luar lisensi — produk marketplace, jasa, apa pun yang
     tidak lewat panel Akses. */
  const totalPenjualan = totalLisensi + totalManual;
  const totalPengeluaran = pengeluaran.data.reduce((s, p) => s + p.nilai, 0);
  /* Laba BERSIH, bukan omzet. Halaman yang cuma menampilkan pemasukan
     membuat usaha terlihat lebih sehat daripada kenyataannya — dan itu
     justru angka yang dipakai memutuskan boleh belanja apa berikutnya. */
  const labaBersih = totalPenjualan - totalPengeluaran;


  /* Penjualan per bulan — DUA deret, bukan satu jumlah gabungan.
     Lisensi terisi sendiri dari Maintenance; manual dari kotak di bawah.
     Sengaja dipisah: kalau keduanya dilebur jadi satu batang, penjualan
     lisensi yang tanpa sengaja dicatat ulang dengan tangan akan terhitung
     dua kali dan tidak ada satu pun tanda di layar. Dua warna berdampingan
     membuat kembarannya langsung kelihatan. */
  const perBulan = useMemo(() => {
    type Bulan = { bulan: string; lisensi: number; manual: number; jumlah: number };
    const peta = new Map<string, Bulan>();
    const ambil = (t: number): Bulan => {
      const d = new Date(t);
      const kunci = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let b = peta.get(kunci);
      if (!b) {
        b = { bulan: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
              lisensi: 0, manual: 0, jumlah: 0 };
        peta.set(kunci, b);
      }
      return b;
    };
    lisensiTerjual.forEach((x) => {
      const b = ambil(x.diputusPada || x.waktu);
      b.lisensi += hargaLisensi(x); b.jumlah += 1;
    });
    penjualan.data.forEach((p) => {
      const b = ambil(p.waktu);
      b.manual += p.nilai; b.jumlah += 1;
    });
    return [...peta.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [penjualan.data, lisensiTerjual, harga]);


  /* Recent sales = lisensi + catatan tangan, DIURUT BERSAMA.
     Tanpa ini panel Revenue bilang "5 lisensi" sementara tabel di bawahnya
     bilang "Belum ada penjualan" — dua bagian layar yang sama-sama benar
     menurut sumbernya sendiri, dan sama-sama salah bagi yang membacanya.

     Baris lisensi TIDAK bisa dihapus dari sini. Sumber kebenarannya panel
     Akses & Lisensi di Maintenance; tombol hapus di dua tempat untuk satu
     catatan adalah cara membuat keduanya berselisih. */
  const barisJual = useMemo(() => {
    const namaPaket = (p?: string) =>
      p === 'tahunan' ? 'Tahunan' : p === 'premium3' ? 'Premium 3 bulan' : p === 'testing' ? 'Testing' : 'Akses';
    const dariLisensi = lisensiTerjual.map((x) => ({
      kunci: 'L' + x.id,
      waktu: x.diputusPada || x.waktu,
      produk: 'Lisensi — ' + namaPaket(x.paket),
      pembeli: x.email || x.nama || x.uid,
      nilai: hargaLisensi(x),
      /* Harga TERCATAT vs harga DITAKSIR. Permintaan lama tidak menyimpan
         hargaSaat, jadi angkanya diturunkan dari tabel harga sekarang —
         dan orang yang membaca laporan berhak tahu mana yang mana. */
      taksiran: !(Number.isFinite(x.hargaSaat) && (x.hargaSaat as number) > 0),
      manual: false as const, id: '',
    }));
    const dariTangan = penjualan.data.map((p) => ({
      kunci: 'M' + p.id, waktu: p.waktu, produk: p.produk, pembeli: p.pembeli,
      nilai: p.nilai, taksiran: false, manual: true as const, id: p.id,
    }));
    return [...dariLisensi, ...dariTangan].sort((a, b) => b.waktu - a.waktu);
  }, [lisensiTerjual, penjualan.data, harga]);

  /* ── LISENSI DIGOLONGKAN per tingkat harga ────────────────────────────
     Satu tabel berisi 24 baris tidak menjawab pertanyaan yang sebenarnya
     ditanyakan pemilik ke halaman ini: berapa yang gratis, berapa yang
     bayar, dan bayar yang mana. Menghitungnya dengan mata dari satu daftar
     panjang adalah pekerjaan yang komputernya bisa lakukan.

     Tingkatnya diambil dari PERMINTAAN yang berpasangan, bukan dari
     lisensinya — barisan lisensi hanya menyimpan sidik kode, produk, dan
     tanggal. Pasangannya lewat `sidik`; surel dipakai sebagai cadangan
     untuk baris lama yang sidiknya belum tercatat. */
  const golongan = (l: { sidik: string; produk: string; catatan: string }) => {
    if (l.produk && l.produk !== 'jadi-trader-v3') return 'market';
    const m = permintaan.data.find(
      (x) => x.sidik === l.sidik || (x.status === 'disetujui' && !!x.email && x.email === l.catatan));
    /* Tanpa permintaan berpasangan = diaktifkan tangan lewat panel V2,
       biasanya uji coba. Tidak dipaksa masuk "Gratis": itu akan membuat
       daftar gratis terlihat lebih panjang daripada kuota yang sebenarnya
       terpakai, dan kuota itulah yang dipakai memutuskan kapan pendaftaran
       ditutup. */
    if (!m) return 'lain';
    if (m.jenis !== 'bayar') return 'gratis';
    return m.paket === 'tahunan' ? 'tahunan' : m.paket === 'premium3' ? 'premium3' : 'testing';
  };
  const perGolongan = useMemo(() => {
    const kotak: Record<string, typeof lisensi.data> = {
      gratis: [], testing: [], premium3: [], tahunan: [], market: [], lain: [],
    };
    lisensi.data.forEach((l) => { kotak[golongan(l)].push(l); });
    return kotak;
  }, [lisensi.data, permintaan.data]);

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
    const diketik = Number(formKeluar.nilai);
    if (!formKeluar.keperluan.trim()) { setPesan('Keperluan wajib diisi.'); return; }
    if (!isFinite(diketik) || diketik <= 0) { setPesan('Nilai pengeluaran harus angka lebih dari nol.'); return; }
    /* Kurs nol berarti belum terbaca. Membagi dengannya menghasilkan
       Infinity yang lolos ke catatan keuangan dan merusak setiap total
       sesudahnya — lebih baik menolak dengan kalimat. */
    if (formKeluar.mata === 'idr' && !(kurs > 0)) {
      setPesan('Kurs dolar belum terbaca, jadi rupiahnya belum bisa dikonversi. Pilih $ dulu.');
      return;
    }
    const nilai = formKeluar.mata === 'idr'
      ? Math.round((diketik / kurs) * 100) / 100
      : diketik;
    setSibuk(true);
    try {
      await catatPengeluaran({
        keperluan: formKeluar.keperluan.trim(), kategori: formKeluar.kategori.trim(),
        nilai, catatan: formKeluar.catatan.trim(),
      });
      setFormKeluar({ keperluan: '', kategori: '', nilai: '', catatan: '', mata: formKeluar.mata });
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
        {/* Rinciannya disebut, bukan cuma jumlahnya. Angka gabungan tanpa
            asal-usul membuat orang menebak — dan tebakan pertama yang wajar
            adalah "ini cuma yang saya catat tangan". */}
        <KartuKpi label="Revenue" nilai={fmt(totalPenjualan)}
                  catatan={`${lisensiTerjual.length} lisensi (${fmt(totalLisensi)}) + ${penjualan.data.length} manual (${fmt(totalManual)})`} />
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
        <PanelHead judul="Penjualan per Bulan"
                   sub="Lisensi berbayar terisi sendiri dari Maintenance, dihitung memakai harga yang berlaku saat permintaannya dibuat. Batang manual untuk pemasukan di luar lisensi." />
        <div className={cn('h-[240px] px-2 pb-4', perBulan.length > 6 && 'overflow-x-auto gulir-senyap')}>
          {perBulan.length === 0 ? (
            <div className="px-3 pt-3">
              <Kabar memuat={penjualan.memuat} galat={penjualan.galat} kosong
                     teksKosong="Belum ada pemasukan. Panel ini terisi sendiri begitu ada permintaan berbayar yang disetujui di Maintenance — atau tambahkan penjualan lain lewat kotak di bawah." />
            </div>
          ) : (
            <div className="h-full"
                 style={perBulan.length > 6 ? { minWidth: perBulan.length * 64 } : undefined}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perBulan} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.09} />
                <XAxis dataKey="bulan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                       tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<TipGrafik />} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} />
                {/* Bertumpuk pada stackId yang sama: tinggi total = omzet
                    bulan itu, sementara tiap potongnya tetap terbaca
                    sendiri. Sudut membulat HANYA di potongan atas — kalau
                    keduanya membulat, tumpukannya terlihat seperti dua
                    batang terpisah yang kebetulan bersentuhan. */}
                <Bar dataKey="lisensi" stackId="a" name="Lisensi" fill="#10b981" fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="manual" stackId="a" name="Manual" fill="#38bdf8" fillOpacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
            </div>
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
            /* Enam baris, permintaan pemilik. Kepala tabelnya ikut tergulir
               — memakukannya butuh position:sticky pada <th>, dan itu
               keputusan untuk seluruh tabel di aplikasi ini, bukan untuk
               satu panel. */
            <TabelBungkus className={gulirJika(pengeluaran.data.length, 6, 'max-h-[300px]')}>
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
            {/* Satuan duduk MENEMPEL pada kolom nilainya, bukan berdiri
                sebagai kolom keenam. Ia bukan data tersendiri — ia
                keterangan tentang angka di sebelahnya, dan memisahkannya
                membuat orang bisa mengubah satu tanpa melihat yang lain. */}
            <div className="flex gap-1.5">
              <input value={formKeluar.nilai} onChange={(e) => setFormKeluar({ ...formKeluar, nilai: e.target.value })}
                     placeholder={formKeluar.mata === 'idr' ? 'Nilai (Rp)' : 'Nilai ($)'}
                     inputMode="decimal" disabled={!pemilik}
                     className="angka h-9 min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
              <select value={formKeluar.mata} onChange={(e) => setFormKeluar({ ...formKeluar, mata: e.target.value })}
                      disabled={!pemilik} aria-label="Satuan nilai pengeluaran"
                      className="h-9 w-[58px] shrink-0 cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50">
                <option value="usd">$</option>
                <option value="idr">Rp</option>
              </select>
            </div>
            <button onClick={() => void tambahPengeluaran()} disabled={sibuk || !pemilik}
                    title={pemilik ? undefined : 'Hanya pemilik yang boleh mencatat pengeluaran'}
                    className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 text-[12px] font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="size-3.5" /> Catat
            </button>
          </div>
          {formKeluar.mata === 'idr' && Number(formKeluar.nilai) > 0 && kurs > 0 && (
            <div className="angka mt-2 text-[11px] text-zinc-500">
              Tersimpan sebagai {fmt(Number(formKeluar.nilai) / kurs)} — kurs {kurs.toLocaleString('id-ID')}/USD.
            </div>
          )}
        </div>
      </Panel>

      {/* DUA kolom sekarang, dulu tiga. Panel "Activity" pindah ke
          Maintenance -> Error & Fixing; membiarkan gridnya tetap tiga
          menyisakan kolom kosong selebar sepertiga layar. */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHead judul="Recent sales" sub="Lisensi berbayar dan catatan tangan, diurut bersama." />
          <div className="px-5 pb-5">
            <Kabar memuat={penjualan.memuat || permintaan.memuat} galat={penjualan.galat} kosong={!barisJual.length}
                   teksKosong="Belum ada pemasukan." />
            {barisJual.length > 0 && (
              <TabelBungkus className={gulirJika(barisJual.length, 10, 'max-h-[480px]')}>
                <Tabel>
                  <thead><tr><Th>Tanggal</Th><Th>Produk</Th><Th className="text-right">Nilai</Th><Th /></tr></thead>
                  <tbody>
                    {barisJual.slice(0, 12).map((p) => (
                      <Tr key={p.kunci}>
                        <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(p.waktu)}</Td>
                        <Td className="text-zinc-300">
                          {p.produk}
                          {p.pembeli && <div className="text-[11px] text-zinc-600">{p.pembeli}</div>}
                        </Td>
                        <Td className="angka text-right text-emerald-500">
                          {p.taksiran && <span className="mr-0.5 text-zinc-600" title="Permintaan lama tidak menyimpan harganya — angka ini diturunkan dari tabel harga sekarang">≈</span>}
                          {fmt(p.nilai)}
                        </Td>
                        <Td className="text-right">
                          {p.manual ? (
                            <button
                              onClick={() => void jalankan(() => hapusPenjualan(p.id), 'Catatan penjualan dihapus.', penjualan.muatUlang)}
                              disabled={sibuk || !pemilik} aria-label={`Hapus catatan ${p.produk}`}
                              className="cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40">
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : (
                            <span className="whitespace-nowrap text-[10px] uppercase tracking-wider text-zinc-700"
                                  title="Terisi sendiri dari Akses & Lisensi — hapus permintaannya di sana kalau perlu">
                              otomatis
                            </span>
                          )}
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
          <div className={cn('space-y-2.5 px-5 pb-5', gulirJika(klien.data.length, 10, 'max-h-[560px]'))}>
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

      </div>

      {/* ── Lisensi, dibagi per tingkat ── */}
      <div className="mt-4 flex items-center justify-between px-1">
        <h2 className="text-[14px] font-medium text-zinc-200">Aktivasi &amp; Lisensi</h2>
        <span className="angka text-[12px] text-zinc-500">{lisensi.data.length} aktif</span>
      </div>
      <Kabar memuat={lisensi.memuat} galat={lisensi.galat} kosong={!lisensi.data.length}
             teksKosong="Belum ada lisensi aktif." />

      {lisensi.data.length > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {KELOMPOK_LISENSI.map((k) => {
            const baris = perGolongan[k.id] ?? [];
            /* Golongan "lain" hanya muncul kalau memang ada isinya —
               pemilik minta lima panel, dan panel keenam yang selalu kosong
               cuma jadi pertanyaan tanpa jawaban. Ia tetap ada untuk kasus
               nyata: lisensi yang diaktifkan tangan tanpa permintaan. */
            if (k.id === 'lain' && !baris.length) return null;
            return (
              <Panel key={k.id}>
                <PanelHead judul={k.judul} sub={(k.sub as (f: (n: number) => string, h?: typeof harga) => string)(fmt, harga)}
                           kanan={<span className="angka text-[12px] text-zinc-500">{baris.length}</span>} />
                <div className="px-5 pb-5">
                  {!baris.length ? (
                    <div className="py-4 text-center text-[12px] text-zinc-600">Belum ada.</div>
                  ) : (
                    <TabelBungkus className={gulirJika(baris.length, 8, 'max-h-[360px]')}>
                      <Tabel>
                        <thead><tr>
                          {k.id === 'market' && <Th>Produk</Th>}
                          <Th>Pemilik</Th><Th>Sidik</Th><Th>Aktif sejak</Th><Th />
                        </tr></thead>
                        <tbody>
                          {baris.map((l) => {
                            const m = permintaan.data.find(
                              (x) => x.sidik === l.sidik || (x.status === 'disetujui' && !!x.email && x.email === l.catatan));
                            return (
                              <Tr key={l.sidik}>
                                {k.id === 'market' && <Td className="text-zinc-300">{l.produk}</Td>}
                                <Td className="text-zinc-400">{m?.email || l.catatan || '—'}</Td>
                                {/* Sidik, bukan kodenya. Backend memang tidak
                                    pernah menyimpan kode aslinya. */}
                                <Td className="angka text-zinc-600">{l.sidik}</Td>
                                <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(l.tgl)}</Td>
                                <Td className="text-right">
                                  <button
                                    onClick={() => {
                                      if (!confirm(`Cabut lisensi "${m?.email || l.catatan || l.sidik}"?

Pemakainya langsung kehilangan akses.`)) return;
                                      void jalankan(() => cabutLisensi(l.sidik), 'Lisensi dicabut.', lisensi.muatUlang);
                                    }}
                                    disabled={sibuk || !pemilik}
                                    aria-label={`Cabut lisensi ${m?.email || l.sidik}`}
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
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-zinc-600">
        Tingkatnya dibaca dari permintaan yang berpasangan di Maintenance, bukan dari barisan
        lisensinya — yang itu hanya menyimpan SIDIK kode, bukan kode aslinya. Bocornya berkas
        lisensi tidak membuat siapa pun bisa mengunduh produk; kode yang bisa dibaca ulang hanya
        ada di baris permintaan yang disetujui.
      </p>
    </div>
  );
}
