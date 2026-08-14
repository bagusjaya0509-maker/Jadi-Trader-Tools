import { useEffect, useState } from 'react';
import { Upload, Trash2, RotateCcw, Plus, FileCode2, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { useProduk, simpanKatalogProduk } from '@/lib/data';
import { unggahGambar, keDataUrl, useLisensi, cabutLisensi } from '@/lib/admin';
import { tanggalPendek } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { PanelLisensi } from '@/components/panel-lisensi';
import { PanelSetelanAkses } from '@/components/panel-setelan-akses';
import { PanelKesehatan } from '@/components/panel-kesehatan';
import { PanelCelahPine } from '@/components/panel-celah-pine';
import { terbitkanTeksBeranda } from '@/lib/data';
import { JUDUL_BERANDA, SUB_BERANDA, bacaTeksLokal, simpanTeksLokal } from '@/lib/teks-beranda';

/* ════════════════════════════════════════════════════════════════════════
   MAINTENANCE — khusus pemilik
   ════════════════════════════════════════════════════════════════════════
   Semua yang bersifat mengubah katalog dikumpulkan di sini: tambah, sunting,
   buang, unggah sumber, unggah tangkapan layar.

   Dipisah dari Traffic & Sales dengan sengaja. Halaman itu untuk DIBACA
   berkali-kali sehari; halaman ini untuk MENGUBAH, dan jarang. Mencampur
   keduanya berarti tombol hapus produk selalu berada satu klik dari tempat
   kamu memeriksa penjualan.
   ════════════════════════════════════════════════════════════════════════ */

/* ── Lisensi aktif NYATA dari backend ────────────────────────────────────
   Menggantikan dua baris prototipe yang dulu ditulis tangan di sini —
   lisensi yang baru disetujui lewat panel Permintaan tidak pernah muncul,
   dan itu terbaca sebagai "fiturnya belum jalan" padahal backend-nya sudah.
   Cabut memanggil rute yang sama dengan V2. */
function PanelLisensiAktif() {
  const { data, memuat, galat, muatUlang } = useLisensi();
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState('');

  async function cabut(sidik: string) {
    if (!confirm(`Cabut lisensi ${sidik}?\n\nPembelinya tidak bisa lagi membuka sumber produk dengan kode ini.`)) return;
    setSibuk(sidik); setPesan('');
    try {
      await cabutLisensi(sidik);
      setPesan(`Lisensi ${sidik} dicabut.`);
      muatUlang();
    } catch (e) {
      setPesan('Gagal: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setSibuk(''); }
  }

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Lisensi Aktif"
        sub={`Kode yang sudah diaktifkan untuk pembeli · ${data.length} aktif.`}
        kanan={
          <button onClick={muatUlang} aria-label="Segarkan"
            className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
            <RotateCcw className={cn('size-3.5', memuat && 'animate-spin')} />
          </button>
        }
      />
      <div className="px-5 pb-5">
        {galat && <p className="mb-3 text-[12px] text-amber-300/90">{galat}</p>}
        {pesan && <p className="mb-3 text-[12px] text-zinc-400">{pesan}</p>}
        {data.length === 0 && !memuat ? (
          <p className="py-4 text-center text-[12.5px] text-zinc-600">
            Belum ada lisensi aktif. Menyetujui permintaan di panel atas akan menambahkannya ke sini.
          </p>
        ) : (
          <TabelBungkus>
            <Tabel>
              <thead><tr><Th>Sidik kode</Th><Th>Produk</Th><Th>Catatan</Th><Th>Aktif sejak</Th><Th /></tr></thead>
              <tbody>
                {data.map((l) => (
                  <Tr key={l.sidik}>
                    <Td className="angka text-zinc-300">{l.sidik}</Td>
                    <Td className="text-zinc-400">{l.produk || '—'}</Td>
                    <Td className="text-zinc-400">{l.catatan || '—'}</Td>
                    <Td className="whitespace-nowrap text-zinc-500">{l.tgl ? tanggalPendek(l.tgl) : '—'}</Td>
                    <Td className="text-right">
                      <button onClick={() => void cabut(l.sidik)} disabled={sibuk === l.sidik}
                        className="cursor-pointer rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50">
                        {sibuk === l.sidik ? 'Mencabut…' : 'Cabut'}
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
  );
}

/* ── Teks hero beranda ───────────────────────────────────────────────────
   Kalimat besar halaman depan diubah DI SINI, bukan di kode: pemilik
   mengetik, menekan Terbitkan, dan semua pengunjung membacanya lewat
   dokumen publik yang sama dengan angka pameran. */
function PanelTeksBeranda() {
  const [judul, setJudul] = useState(() => bacaTeksLokal().judul || JUDUL_BERANDA);
  const [sub, setSub] = useState(() => bacaTeksLokal().sub || SUB_BERANDA);
  const [kabar, setKabar] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function simpan() {
    simpanTeksLokal(judul.trim(), sub.trim());
    setSibuk(true); setKabar('');
    try {
      await terbitkanTeksBeranda(judul.trim(), sub.trim());
      setKabar('Diterbitkan — halaman depan memakai teks ini untuk semua pengunjung.');
    } catch {
      setKabar('Tersimpan di perangkat ini; penerbitan untuk semua pengunjung gagal (butuh akun pemilik).');
    } finally { setSibuk(false); }
  }

  return (
    <Panel className="mt-4">
      <PanelHead judul="Teks Beranda"
                 sub="Judul besar & subjudul hero halaman depan. Baris kedua judul otomatis bergradasi emas." />
      <div className="grid grid-cols-1 gap-4 px-5 pb-5 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-zinc-500">Judul besar — satu baris per baris tampil</span>
          <textarea value={judul} onChange={(e) => setJudul(e.target.value)} rows={3} spellCheck={false}
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[13px] leading-relaxed text-zinc-200 outline-none focus-visible:border-zinc-600" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-zinc-500">Subjudul — frasa "Jadi Trader Profitable!" otomatis disorot</span>
          <textarea value={sub} onChange={(e) => setSub(e.target.value)} rows={3} spellCheck={false}
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[13px] leading-relaxed text-zinc-200 outline-none focus-visible:border-zinc-600" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800/80 px-5 py-3">
        <button onClick={() => void simpan()} disabled={sibuk || !judul.trim() || !sub.trim()}
          className="cursor-pointer rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
          {sibuk ? 'Menerbitkan…' : 'Terbitkan'}
        </button>
        <button onClick={() => { setJudul(JUDUL_BERANDA); setSub(SUB_BERANDA); setKabar('Bawaan dimuat — tekan Terbitkan untuk memakainya.'); }}
          className="cursor-pointer rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
          Kembalikan bawaan
        </button>
        {kabar && <span className="text-[12px] text-zinc-500">{kabar}</span>}
      </div>
    </Panel>
  );
}

/** Judul pemisah antar urusan. Sengaja bukan panel: ia PENANDA, dan
 *  penanda yang punya bingkai sendiri akan bersaing perhatian dengan isi
 *  yang ditandainya. */
function Bagian({ judul, sub }: { judul: string; sub: string }) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <h2 className="text-[14px] font-medium text-zinc-200">{judul}</h2>
      <p className="text-[12px] text-zinc-500">{sub}</p>
    </div>
  );
}

export default function Maintenance() {
  /* Katalog NYATA dari Firestore, bukan salinan data contoh.
     Sebelumnya halaman ini memulai dari `PRODUK` dan menyimpan perubahannya
     di useState saja — jadi menghapus produk terlihat berhasil, tapi tidak
     pernah menyentuh apa pun, dan katalognya pulih sendiri setelah refresh.

     Yang disimpan adalah objek MENTAH dari Firestore, bukan hasil pemetaan.
     Katalog nyata punya field yang tidak ada di antarmuka `Produk` (detail,
     gambar, lynk, berkas); menulis ulang dari bentuk yang sudah dipetakan
     akan melucuti tangkapan layar dan tautan beli milik produk lain. */
  const { mentah, sampahMentah, memuat } = useProduk();
  const { pemilik } = useAuth();

  const [tayang, setTayang] = useState<any[]>([]);
  const [sampah, setSampah] = useState<any[]>([]);
  const [pesan, setPesan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  /* Formulir sunting. `pilih` menyimpan id produk yang sedang disunting;
     string kosong berarti "produk baru". Sebelumnya seluruh formulir ini
     memakai input tak terkendali tanpa satu pun handler — mengetik apa pun
     di sana lalu menekan "Simpan produk" tidak pernah terjadi apa-apa. */
  const [pilih, setPilih] = useState('');
  const [form, setForm] = useState({ id: '', nama: '', harga: '', versi: '', ringkas: '', fitur: '', sampul: '' });
  const [unggahSibuk, setUnggahSibuk] = useState(false);

  function muatKeForm(id: string) {
    setPilih(id);
    const p = tayang.find((x) => x.id === id);
    if (!p) { setForm({ id: '', nama: '', harga: '', versi: '', ringkas: '', fitur: '', sampul: '' }); return; }
    setForm({
      id: String(p.id ?? ''),
      nama: String(p.nama ?? ''),
      harga: String(p.harga ?? 0),
      versi: String(p.versi ?? ''),
      ringkas: String(p.ringkas ?? ''),
      fitur: Array.isArray(p.fitur) ? p.fitur.join('\n') : '',
      /* Sampul = gambar PERTAMA. Katalog tidak punya field sampul terpisah,
         dan menambahkannya berarti V2 yang membaca dokumen yang sama harus
         ikut diubah. Kesepakatan "yang pertama adalah sampul" tidak menuntut
         perubahan apa pun di sisi V2. */
      sampul: Array.isArray(p.gambar) && p.gambar.length ? String(p.gambar[0]) : '',
    });
  }

  async function pilihSampul(berkas: File | undefined) {
    if (!berkas) return;
    setUnggahSibuk(true); setPesan('');
    try {
      const url = await unggahGambar(await keDataUrl(berkas), form.id || 'sampul');
      setForm((f) => ({ ...f, sampul: url }));
      setPesan('Sampul terunggah. Tekan "Simpan produk" supaya ikut tersimpan di katalog.');
    } catch (e) {
      setPesan('Gagal mengunggah sampul: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setUnggahSibuk(false); }
  }

  async function simpanProduk() {
    const id = form.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!id) { setPesan('ID produk wajib diisi (huruf kecil, angka, tanda hubung).'); return; }
    if (!form.nama.trim()) { setPesan('Nama produk wajib diisi.'); return; }

    const lama = tayang.find((x) => x.id === (pilih || id));
    /* Sebar dari objek lama, bukan menyusun dari nol: katalog nyata punya
       field yang tidak ada di formulir ini (detail, lynk, berkas, unduhan),
       dan menulis ulang tanpanya akan melucutinya diam-diam. */
    const baru = {
      ...(lama ?? {}),
      id, nama: form.nama.trim(),
      harga: Number(form.harga) || 0,
      versi: form.versi.trim(),
      ringkas: form.ringkas.trim(),
      fitur: form.fitur.split('\n').map((s) => s.trim()).filter(Boolean),
      premium: (Number(form.harga) || 0) > 0,
      gambar: form.sampul
        ? [form.sampul, ...(Array.isArray(lama?.gambar) ? lama.gambar.slice(1) : [])]
        : (Array.isArray(lama?.gambar) ? lama.gambar : []),
    };

    const daftar = lama
      ? tayang.map((x) => (x.id === lama.id ? baru : x))
      : [...tayang, baru];

    if (await simpan(daftar, sampah, `${baru.nama} tersimpan.`)) {
      setTayang(daftar);
      setPilih(id);
    }
  }

  /* Katalog DAN tempat sampah sama-sama datang dari server, jadi keduanya
     ikut segar setiap kali dokumennya berubah — termasuk saat panel pemilik
     V2 mengubahnya dari tab lain. */
  useEffect(() => {
    if (!memuat) { setTayang(mentah); setSampah(sampahMentah); }
  }, [mentah, sampahMentah, memuat]);

  /* Satu-satunya penulis. Semua aksi memanggil ini supaya tidak ada jalur
     yang mengubah layar tanpa mengubah server — persis kekeliruan yang
     membuat penghapusan terasa berhasil padahal tidak. */
  async function simpan(daftarBaru: any[], sampahBaru: any[], kabar: string) {
    if (!pemilik) {
      setPesan('Hanya pemilik yang boleh mengubah katalog. Masuk dengan akun pemilik dulu.');
      return false;
    }
    setMenyimpan(true);
    try {
      /* Batas waktu 15 detik. `setDoc` baru selesai saat SERVER menjawab, dan
         kalau jaringannya putus ia menunggu tanpa batas — tombolnya terkunci
         selamanya tanpa satu pun pesan. Menunggu selamanya dan gagal terlihat
         sama persis di layar; yang membedakan cuma ada tidaknya kalimat ini. */
      await Promise.race([
        simpanKatalogProduk(daftarBaru, sampahBaru),
        new Promise((_, tolak) => setTimeout(
          () => tolak(new Error('server tidak menjawab dalam 15 detik — periksa koneksi, lalu coba lagi')), 15_000)),
      ]);
      setPesan(kabar);
      return true;
    } catch (e) {
      setPesan('Gagal menyimpan ke server: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
      return false;
    } finally {
      setMenyimpan(false);
    }
  }

  /* Tiap aksi menulis ke server DULU, layar menyusul kalau berhasil.
     Urutan itu penting: kalau layar diubah lebih dulu lalu simpan gagal,
     orang melihat produknya hilang padahal masih tayang untuk pembeli. */
  async function buang(id: string) {
    const p = tayang.find((x) => x.id === id);
    if (!p) return;
    const sisa = tayang.filter((x) => x.id !== id);
    const sampahBaru = [p, ...sampah];
    // Tanpa confirm(): itulah gunanya tempat sampah. Konfirmasi untuk aksi
    // yang bisa dibatalkan cuma menambah klik tanpa menambah keamanan.
    if (await simpan(sisa, sampahBaru, `${p.nama} dipindah ke tempat sampah — masih bisa dipulihkan.`)) {
      setTayang(sisa);
      setSampah(sampahBaru);
    }
  }
  async function pulihkan(id: string) {
    const p = sampah.find((x) => x.id === id);
    if (!p) return;
    const baru = [...tayang, p];
    const sampahBaru = sampah.filter((x) => x.id !== id);
    if (await simpan(baru, sampahBaru, `${p.nama} dipulihkan dan tayang lagi.`)) {
      setSampah(sampahBaru);
      setTayang(baru);
    }
  }
  async function musnahkan(id: string) {
    const p = sampah.find((x) => x.id === id);
    if (!p) return;
    // INI yang butuh konfirmasi — tidak ada jalan pulang.
    if (!confirm(`Hapus permanen "${p.nama}"?\n\nEntri katalognya hilang untuk selamanya.\nBerkas sumber di server TIDAK ikut terhapus.`)) return;
    const sampahBaru = sampah.filter((x) => x.id !== id);
    if (await simpan(tayang, sampahBaru, `${p.nama} dihapus permanen.`)) setSampah(sampahBaru);
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Halaman ini menampung lima urusan yang tidak berhubungan satu
          sama lain — kesehatan mesin, celah Pine, teks beranda, katalog
          produk, lisensi. Tanpa judul pemisah, semuanya terbaca sebagai
          satu tumpukan panel dan orang harus membaca isinya dulu untuk
          tahu sedang melihat apa. Judul section membuat halaman ini bisa
          DIPINDAI, bukan dibaca. */}
      {/* PALING ATAS, dan sengaja. Permintaan yang menunggu adalah satu-satunya
          hal di halaman ini yang membuat ORANG LAIN menunggu — sisanya bisa
          dikerjakan kapan saja. */}
      <Bagian judul="Permintaan Akses & Lisensi"
              sub="20 akses gratis dan 80 berbayar, masing-masing 30 hari. Persetujuan di sini yang membuka aplikasi." />
      <PanelSetelanAkses />
      <PanelLisensi />
      <PanelLisensiAktif />

      <Bagian judul="Kesehatan Sistem"
              sub="Sambungan backend, bursa, dan layanan pendukung." />
      <PanelKesehatan />

      <Bagian judul="Mesin Pine Script"
              sub="Celah yang ditemukan dari pemakaian nyata — bahan perbaikan berikutnya." />
      <PanelCelahPine />

      <Bagian judul="Situs & Konten"
              sub="Teks yang dilihat pengunjung sebelum masuk." />
      <PanelTeksBeranda />

      <Bagian judul="Katalog Produk"
              sub="Produk yang tayang di Marketplace, sumbernya, dan tempat sampahnya." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Produk tayang" nilai={String(tayang.length)} catatan="terlihat pengunjung" />
        <KartuKpi label="Di tempat sampah" nilai={String(sampah.length)} catatan="bisa dipulihkan" />
        <KartuKpi label="Sumber terpasang" nilai="2" catatan=".txt dan .ex5 di server" />
        <KartuKpi label="Tangkapan layar" nilai="7" catatan="total semua produk" />
      </div>

      {pesan && (
        /* Gagal dan berhasil TIDAK boleh terlihat sama. Pesan abu-abu seragam
           adalah salah satu sebab kegagalan penyimpanan lewat begitu saja. */
        <div className={cn('mt-4 rounded-lg border px-4 py-2.5 text-[12.5px]',
          /gagal|hanya pemilik/i.test(pesan)
            ? 'border-amber-500/30 bg-amber-500/5 text-amber-200/90'
            : 'border-zinc-800 bg-zinc-900/60 text-zinc-300')}>
          {pesan}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Daftar + sampah */}
        <Panel className="lg:col-span-2">
          <PanelHead
            judul="Kelola Produk"
            sub="Klik ✕ memindahkan ke tempat sampah, bukan menghapus."
            kanan={
              <button onClick={() => muatKeForm('')} disabled={!pemilik}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="size-3.5" /> Produk baru
              </button>
            }
          />
          <div className="px-5 pb-5">
            <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Tayang</div>
            <div className="flex flex-wrap gap-2">
              {tayang.length === 0 && <span className="text-[12.5px] text-zinc-600">Tidak ada produk tayang.</span>}
              {tayang.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 py-1.5 pl-3 pr-2 text-[12.5px]">
                  <span className="text-zinc-200">{p.nama}</span>
                  <span className={cn('angka text-[11px]', p.harga === 0 ? 'text-emerald-500' : 'text-amber-400')}>
                    {p.harga === 0 ? 'FREE' : `$${p.harga}`}
                  </span>
                  <button onClick={() => void buang(p.id)} disabled={menyimpan || !pemilik}
                    title={pemilik
                      ? (menyimpan ? 'Sedang menyimpan…' : `Buang ${p.nama}`)
                      : 'Hanya pemilik yang boleh mengubah katalog'}
                    aria-label={`Buang ${p.nama}`}
                    className="flex size-5 cursor-pointer items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400">
                    ×
                  </button>
                </span>
              ))}
            </div>

            {sampah.length > 0 && (
              <>
                <div className="mb-2 mt-5 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                  Tempat sampah — belum benar-benar hilang
                </div>
                <div className="flex flex-wrap gap-2">
                  {sampah.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-2.5 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 py-1.5 pl-3 pr-2 text-[12.5px] opacity-70">
                      <span className="text-zinc-400 line-through">{p.nama}</span>
                      <button onClick={() => void pulihkan(p.id)} disabled={menyimpan} aria-label={`Pulihkan ${p.nama}`}
                        className="flex size-5 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400">
                        <RotateCcw className="size-3" />
                      </button>
                      <button onClick={() => void musnahkan(p.id)} disabled={menyimpan} aria-label={`Hapus permanen ${p.nama}`}
                        className="flex size-5 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400">
                        <Trash2 className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </>
            )}

            <div className="mt-6 border-t border-zinc-800/60 pt-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Sunting produk</span>
                <select value={pilih} onChange={(e) => muatKeForm(e.target.value)}
                  className="h-8 cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[12px] text-zinc-300 outline-none">
                  <option value="">— produk baru —</option>
                  {tayang.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
                </select>
              </div>

              {/* Sampul produk. Gambarnya disimpan di VPS, bukan di Firestore:
                  satu dokumen dibatasi 1 MiB dan satu tangkapan layar saja
                  sudah melewatinya. */}
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="flex h-[68px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
                  {form.sampul
                    ? <img src={form.sampul} alt="Sampul produk" className="size-full object-cover"
                           onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : <ImageIcon className="size-5 text-zinc-700" strokeWidth={1.8} />}
                </div>
                <div>
                  <label className={cn('inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100',
                    pemilik && !unggahSibuk ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')}>
                    <Upload className="size-3.5" /> {unggahSibuk ? 'Mengunggah…' : 'Pilih sampul'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                           disabled={!pemilik || unggahSibuk}
                           onChange={(e) => void pilihSampul(e.target.files?.[0])} />
                  </label>
                  {form.sampul && (
                    <button onClick={() => setForm((f) => ({ ...f, sampul: '' }))}
                      className="ml-2 cursor-pointer text-[11.5px] text-zinc-500 underline-offset-2 hover:text-red-400 hover:underline">
                      hapus sampul
                    </button>
                  )}
                  <div className="mt-1 text-[11px] text-zinc-600">PNG / JPG / WebP, maksimal 8 MB. Tampil sebagai gambar kartu di Marketplace.</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">ID produk</label>
                  <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })}
                    placeholder="jadi-trader-v3" disabled={!pemilik}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Nama produk</label>
                  <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    placeholder="Jadi Trader V3" disabled={!pemilik}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Harga (0 = gratis)</label>
                  <input value={form.harga} onChange={(e) => setForm({ ...form, harga: e.target.value })}
                    placeholder="50" inputMode="numeric" disabled={!pemilik}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Versi / label</label>
                  <input value={form.versi} onChange={(e) => setForm({ ...form, versi: e.target.value })}
                    placeholder="Pine v6 · overlay" disabled={!pemilik}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-[11px] text-zinc-500">Ringkasan — muncul di kartu produk</label>
                <textarea rows={2} value={form.ringkas} onChange={(e) => setForm({ ...form, ringkas: e.target.value })}
                  disabled={!pemilik}
                  className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-[11px] text-zinc-500">Fitur — satu per baris, format Judul|keterangan</label>
                <textarea rows={3} value={form.fitur} onChange={(e) => setForm({ ...form, fitur: e.target.value })}
                  disabled={!pemilik}
                  className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
              </div>
              <button onClick={() => void simpanProduk()} disabled={menyimpan || !pemilik}
                className="mt-3 cursor-pointer rounded-md bg-zinc-100 px-4 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                {menyimpan ? 'Menyimpan…' : pilih ? 'Simpan perubahan' : 'Tambah produk'}
              </button>
            </div>
          </div>
        </Panel>

        {/* Unggah */}
        <div className="space-y-4">
          <Panel>
            <PanelHead judul="Unggah Sumber" sub="Kode yang diterima pembeli." />
            <div className="space-y-3 px-5 pb-5">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-center transition-colors hover:border-zinc-600 hover:bg-zinc-900/40">
                <FileCode2 className="size-5 text-zinc-500" strokeWidth={1.8} />
                <span className="text-[12.5px] text-zinc-300">Pilih berkas</span>
                <span className="text-[11px] text-zinc-600">.txt · .mq5 · .ex5</span>
                <input type="file" accept=".txt,.mq5,.ex5" className="hidden" />
              </label>
              <textarea rows={4} placeholder="…atau tempel kodenya langsung di sini"
                className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-[11.5px] text-zinc-300 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600" />
              <button className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-100 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white">
                <Upload className="size-3.5" /> Unggah sumber
              </button>
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-400" strokeWidth={2} />
                <span className="text-[11.5px] leading-relaxed text-zinc-400">
                  Harga 0 menandai sumbernya <span className="text-zinc-200">gratis</span> dan langsung bisa
                  disalin pengunjung. Harga di atas 0 tetap terkunci di balik kode lisensi.
                </span>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHead judul="Tangkapan Layar" sub="Dipajang di halaman detail produk." />
            <div className="space-y-3 px-5 pb-5">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-4 py-5 text-center transition-colors hover:border-zinc-600 hover:bg-zinc-900/40">
                <ImageIcon className="size-5 text-zinc-500" strokeWidth={1.8} />
                <span className="text-[12.5px] text-zinc-300">Unggah gambar</span>
                <span className="text-[11px] text-zinc-600">PNG · JPG · WebP · maks 8 MB</span>
                <input type="file" accept="image/*" className="hidden" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="group relative aspect-video overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
                    <div className="flex h-full items-center justify-center text-[10px] text-zinc-700">gbr {i}</div>
                    <button aria-label="Hapus gambar"
                      className="absolute right-1 top-1 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/70 text-zinc-400 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>

    </div>
  );
}
