import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, Trash2, RotateCcw, Plus, FileCode2, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import { PanelModerasiSinyal } from '@/components/panel-moderasi-sinyal';
import PanelLaporanPengguna from '@/components/panel-laporan-pengguna';
import { Panel, PanelHead, KartuKpi } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { useProduk, simpanKatalogProduk } from '@/lib/data';
import { unggahGambar, keDataUrl, useLisensi, cabutLisensi } from '@/lib/admin';
import { tanggalPendek } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { PanelLisensi, LencanaJenis, namaProduk } from '@/components/panel-lisensi';
import { PanelSetelanAkses } from '@/components/panel-setelan-akses';
import { PanelPengingat } from '@/components/panel-pengingat';
import { PanelTrafikSistem } from '@/components/panel-trafik-sistem';
import { PanelKesehatan } from '@/components/panel-kesehatan';
import { PanelLangganan } from '@/components/panel-langganan';
import { DaftarLipat, NomorBaris } from '@/components/daftar-lipat';
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

  /* Urut TERBARU → TERLAMA, arah yang sama dengan panel Permintaan di
     sebelahnya. Backend mengirimnya justru terbalik — baris didorong ke
     belakang tiap kali disetujui, jadi yang paling lama ada di depan — dan
     panel ini berdampingan dengan panel lain yang nomor barisnya dipadankan
     dengan mata. Urutan yang dipakai untuk memadankan harus ditulis, bukan
     diwarisi dari cara backend kebetulan menyimpan. */
  const urut = [...data].sort((a, b) => b.tgl - a.tgl);

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
    <Panel>
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
          /* Kartu, bukan tabel. Panel ini kini seleher dengan panel
             permintaan di sebelahnya, dan tabel lima kolom di lebar
             setengah layar akan dipotong oleh overflow-x-auto milik
             TabelBungkus — persis keluhan "panelnya terpotong". */
          <DaftarLipat
            data={urut}
            kosong={null}
            render={(l, no) => (
              /* Bentuk kartunya DISAMAKAN dengan panel Permintaan di
                 sebelahnya: susunan baris yang sama, padding yang sama,
                 dan penanda jenis di tempat yang sama. Sebelumnya kartu
                 di sini jauh lebih pendek dan isinya berbeda urutan, jadi
                 dua panel bersebelahan terbaca seperti dua daftar yang
                 tidak berhubungan.

                 Yang paling menentukan: EMAIL naik jadi baris utama,
                 menggantikan sidik. Sidik itu kunci basis data — yang
                 dicari mata di panel ini adalah SIAPA, bukan hash-nya. */
              <div key={l.sidik} className="rounded-lg border border-zinc-800/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <NomorBaris no={no} />
                      <span className="truncate text-[13px] text-zinc-200">{l.catatan || l.sidik}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-zinc-500">
                      <LencanaJenis slug={l.produk || ''} />
                      <span className="text-zinc-400">{namaProduk(l.produk || '')}</span>
                      <span>· {l.tgl ? tanggalPendek(l.tgl) : '—'}</span>
                    </div>
                    <div className="angka mt-1 truncate text-[11px] text-zinc-600">sidik {l.sidik}</div>
                  </div>
                  <button onClick={() => void cabut(l.sidik)} disabled={sibuk === l.sidik}
                    className="shrink-0 cursor-pointer rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50">
                    {sibuk === l.sidik ? 'Mencabut…' : 'Cabut'}
                  </button>
                </div>
              </div>
            )}
          />
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

/* ════════════════════════════════════════════════════════════════════════
   SUB-HALAMAN — lima urusan yang tidak berhubungan satu sama lain
   ════════════════════════════════════════════════════════════════════════
   Dulu kelimanya ditumpuk di satu halaman panjang, dipisah judul section.
   Judul memang membuatnya bisa dipindai, tapi tidak menyelesaikan hal yang
   sebenarnya mengganggu: untuk mengurus katalog produk, orang harus
   menggulir melewati permintaan akses, kesehatan sistem, celah Pine, dan
   teks beranda — empat hal yang sama sekali tidak sedang ia pikirkan.

   Sebagai tab, tiap urusan berdiri sendiri dan halamannya sependek isinya.
   Yang TIDAK diubah: urutannya. Permintaan akses tetap pertama dan tetap
   jadi tab bawaan, karena ia satu-satunya yang membuat ORANG LAIN
   menunggu — sisanya bisa dikerjakan kapan saja.
   ════════════════════════════════════════════════════════════════════════ */
const TAB = [
  { id: 'akses',   label: 'Akses & Lisensi', judul: 'Permintaan Akses & Lisensi', sub: '20 akses gratis dan 80 berbayar, masing-masing 30 hari. Persetujuan di sini yang membuka aplikasi.' },
  { id: 'produk',  label: 'Katalog Produk',  judul: 'Katalog Produk',             sub: 'Produk yang tayang di Marketplace, sumbernya, dan tempat sampahnya.' },
  { id: 'sistem',  label: 'Kesehatan Sistem', judul: 'Kesehatan Sistem',          sub: 'Sambungan backend, bursa, dan layanan pendukung.' },
  { id: 'langganan', label: 'Langganan & Lisensi', judul: 'Langganan & Lisensi', sub: 'Kapan domain, VPS, dan mailbox habis — plus lisensi aktif dan sisa kuota. Layanan yang habis tanpa diketahui mematikan situs tanpa ada yang salah di kodenya.' },
  { id: 'trafik',  label: 'Trafik & Server',  judul: 'Trafik & Server',           sub: 'Kunjungan situs dan beban VPS. Pindah dari halaman Sales — ini pertanyaan "mesinnya sehat", bukan "usahanya untung".' },
  { id: 'pine',    label: 'Mesin Pine',      judul: 'Mesin Pine Script',          sub: 'Celah yang ditemukan dari pemakaian nyata — bahan perbaikan berikutnya.' },
  { id: 'konten',  label: 'Situs & Konten',  judul: 'Situs & Konten',             sub: 'Teks yang dilihat pengunjung sebelum masuk.' },
  /* Moderasi duduk di SINI, bukan di kartu sinyal. Alat pengawasan yang
     menempel di layar tempat orang memilih sinyal membuat keduanya terlihat
     sebagai satu jenis tindakan — dan tombol hapus di antara tombol beli
     adalah tombol hapus yang cepat atau lambat tertekan. */
  { id: 'moderasi', label: 'Moderasi Sinyal', judul: 'Moderasi Sinyal',            sub: 'Menurunkan sinyal yang melanggar. Kewajiban pengawasan PSE, bukan alat penyuntingan — penulisnya sendiri tidak bisa menghapus rekam jejaknya.' },
  /* Pindah dari Sales Report, tempatnya dulu panel "Activity". Sales Report
     menjawab "usahanya untung berapa"; daftar ini menjawab "apa yang
     rusak". Dua pertanyaan yang tidak pernah ditanyakan bersamaan, dan yang
     kedua selalu kalah perhatian di sebelah angka pemasukan. */
  { id: 'bug',     label: 'Error & Fixing',  judul: 'Error & Fixing',             sub: 'Bug, saran, dan error yang dikirim pengguna dari dalam aplikasi.' },
] as const;
type IdTab = typeof TAB[number]['id'];

export default function Maintenance() {
  /* Tab dibaca dari alamat (?tab=produk) supaya sub-menu sidebar bisa
     menunjuk langsung ke sini. State lokal tetap jadi sumber saat orang
     mengklik tab di dalam halaman — alamatnya ikut ditulis agar tautan
     yang disalin membawa tab yang sedang dilihat. */
  const [cariTab, setCariTab] = useSearchParams();
  const tabDariAlamat = TAB.some((t) => t.id === cariTab.get('tab')) ? (cariTab.get('tab') as IdTab) : 'akses';
  const tab = tabDariAlamat;
  const setTab = (id: IdTab) => setCariTab(id === 'akses' ? {} : { tab: id }, { replace: true });
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
  const [form, setForm] = useState({ id: '', nama: '', harga: '', hargaAsal: '', versi: '', ringkas: '', fitur: '', sampul: '', lynk: '', detail: '' });
  const [unggahSibuk, setUnggahSibuk] = useState(false);

  function muatKeForm(id: string) {
    setPilih(id);
    const p = tayang.find((x) => x.id === id);
    if (!p) { setForm({ id: '', nama: '', harga: '', hargaAsal: '', versi: '', ringkas: '', fitur: '', sampul: '', lynk: '', detail: '' }); return; }
    setForm({
      id: String(p.id ?? ''),
      nama: String(p.nama ?? ''),
      harga: String(p.harga ?? 0),
      /* Kosong, BUKAN "0", kalau tidak ada promo — "0" di kotak ini akan
         tersimpan sebagai harga coret nol dan Marketplace menampilkan
         "$50  $0" yang terbaca sebagai barang gratis. */
      hargaAsal: p.hargaAsal ? String(p.hargaAsal) : '',
      versi: String(p.versi ?? ''),
      lynk: String((p as { lynk?: string }).lynk ?? ''),
      detail: String((p as { detail?: string }).detail ?? ''),
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
      /* Harga coret hanya disimpan kalau memang LEBIH BESAR dari harga
         berlaku. "Diskon" yang tidak menurunkan apa pun bukan sekadar
         tidak berguna — ia klaim yang salah di halaman jualan, dan itu
         jenis kesalahan yang merusak kepercayaan orang pada seluruh
         katalognya. Kalau tidak lolos, field-nya DIHAPUS, bukan disimpan
         nol: nol akan tergambar sebagai coretan "$0". */
      ...(Number(form.hargaAsal) > (Number(form.harga) || 0)
        ? { hargaAsal: Number(form.hargaAsal) }
        : { hargaAsal: undefined }),
      versi: form.versi.trim(),
      /* Tautan checkout. DIHAPUS, bukan disimpan string kosong, saat
         dikosongkan: Marketplace menggerbang tombol belinya dengan
         `{lynk && ...}` dan string kosong memang jatuh ke falsy -- tapi
         field kosong yang tetap tersimpan membuat katalog mentahnya
         penuh kunci yang tidak berarti apa-apa, dan pembaca berikutnya
         harus menebak apakah '' berarti "belum diisi" atau "sengaja
         dikosongkan". */
      ...(form.lynk.trim() ? { lynk: form.lynk.trim() } : { lynk: undefined }),
      ringkas: form.ringkas.trim(),
      /* Sama seperti lynk: DIHAPUS saat dikosongkan, bukan disimpan ''. */
      ...(form.detail.trim() ? { detail: form.detail.trim() } : { detail: undefined }),
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
      {/* Bilah tab menggulir mendatar di layar sempit, bukan membungkus
          jadi dua baris: bilah yang tingginya berubah menggeser seluruh
          isi halaman tiap kali jendela diubah. */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-800/80">
        {TAB.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 cursor-pointer border-b-2 px-3.5 py-2.5 text-[12.5px] transition-colors',
              tab === t.id
                ? 'border-zinc-100 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Judul & keterangan tetap ada di dalam tabnya. Tab yang cuma
          berisi panel tanpa kalimat pembuka memaksa orang menyimpulkan
          sendiri sedang melihat apa. */}
      {(() => {
        const aktif = TAB.find((t) => t.id === tab)!;
        return <Bagian judul={aktif.judul} sub={aktif.sub} />;
      })()}

      {/* Permintaan dan lisensi aktif BERDAMPINGAN: keduanya sisi dari satu
          keputusan — menyetujui permintaan di kiri menambah baris di kanan.
          Ditumpuk atas-bawah, menyetujui berarti menggulir untuk memastikan
          hasilnya masuk, lalu menggulir balik untuk permintaan berikutnya.

          Baru dua kolom di layar lebar (xl). Di bawah itu keduanya butuh
          lebar penuh: masing-masing memuat email, produk, tanggal, dan
          tombol dalam satu baris. */}
      {/* Jarak vertikal DIUKUR, bukan dikira-kira. Sebelumnya panel setelan
          menempel langsung ke grid di bawahnya — terukur 0 px, dan itulah
          "panel dempet" yang dilaporkan: induknya tidak memasang jarak
          apa pun antar-anak.

          mb-5 (20 px) dipilih supaya SAMA dengan gap-5 antar kolom, jadi
          jarak mendatar dan menurun sepadan. Ini penting justru karena
          panel setelan adalah FORMULIR yang diakhiri tombol Simpan:
          tombol yang berdempetan dengan kotak di bawahnya terbaca seolah
          milik kotak itu. */}
      {tab === 'akses' && (<>
        <div className="mb-5">
          <PanelSetelanAkses />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <PanelLisensi />
          <PanelLisensiAktif />
        </div>
        {/* Di luar grid dua kolom, dan sengaja. Panel ini daftar bercentang
            dengan alamat surel penuh di tiap baris; dipaksa selebar setengah
            layar, alamatnya terpotong justru pada bagian yang menentukan
            apakah pemiliknya berani menekan Kirim. */}
        <div className="mt-5">
          <PanelPengingat />
        </div>
      </>)}

      {tab === 'sistem' && <PanelKesehatan />}
      {tab === 'langganan' && <PanelLangganan />}

      {tab === 'trafik' && <PanelTrafikSistem />}

      {tab === 'pine' && <PanelCelahPine />}

      {tab === 'konten' && <PanelTeksBeranda />}

      {tab === 'moderasi' && <PanelModerasiSinyal />}
      {tab === 'bug' && <PanelLaporanPengguna />}

      {tab === 'produk' && (<>
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
                  {/* Harga coret duduk TEPAT DI SEBELAH harga berlaku, bukan
                      di baris lain: keduanya cuma berarti kalau dibaca
                      berpasangan, dan dipisah jarak orang gampang mengisi
                      salah satunya saja. */}
                  <label className="mb-1 block text-[11px] text-zinc-500">
                    Harga coret <span className="text-zinc-600">(promo, kosongkan kalau tidak ada)</span>
                  </label>
                  <input value={form.hargaAsal} onChange={(e) => setForm({ ...form, hargaAsal: e.target.value })}
                    placeholder="100" inputMode="numeric" disabled={!pemilik}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                  {/* Diperingatkan SEBELUM disimpan, bukan setelah. Angka yang
                      diam-diam dibuang membuat orang mengira promonya sudah
                      terpasang padahal tidak muncul di mana pun. */}
                  {form.hargaAsal.trim() !== '' && Number(form.hargaAsal) <= (Number(form.harga) || 0) && (
                    <p className="mt-1 text-[10.5px] leading-relaxed text-amber-400/90">
                      Harus lebih besar dari harga berlaku (${Number(form.harga) || 0}) — kalau tidak, coretannya tidak akan disimpan.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Versi / label</label>
                  <input value={form.versi} onChange={(e) => setForm({ ...form, versi: e.target.value })}
                    placeholder="Pine v6 · overlay" disabled={!pemilik}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                </div>
              </div>
              {/* -- Tautan checkout ------------------------------------------
                  Kolom ini SEBELUMNYA TIDAK ADA, dan ketiadaannya diam-diam
                  mematikan penjualan: Marketplace menggerbang tombol "Beli di
                  toko" dengan `{lynk && ...}`, jadi produk tanpa tautan tidak
                  menampilkan tombol apa pun -- bukan tombol mati yang terlihat
                  rusak, melainkan tidak ada sama sekali. Dari luar halamannya
                  terlihat baik-baik saja, dan tidak ada yang tahu barangnya
                  tidak bisa dibeli sampai ada yang mencoba membelinya.

                  Field-nya sendiri sudah lama ada di katalog dan sudah
                  diwariskan dengan benar oleh `...lama` saat menyimpan; yang
                  hilang cuma cara mengisinya tanpa membuka Firestore. */}
              <div className="mt-3">
                <label className="mb-1 block text-[11px] text-zinc-500">
                  Tautan checkout <span className="text-zinc-600">(Lynk / toko — kosongkan kalau belum dijual)</span>
                </label>
                <input value={form.lynk} onChange={(e) => setForm({ ...form, lynk: e.target.value })}
                  placeholder="https://lynk.id/toko/xxxx/checkout" disabled={!pemilik} inputMode="url"
                  className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                {/* Diperingatkan SEBELUM disimpan. Produk berbayar tanpa
                    tautan adalah barang yang dipajang tapi tidak bisa
                    dibeli, dan itu tidak terlihat di halaman etalasenya. */}
                {!form.lynk.trim() && (Number(form.harga) || 0) > 0 && (
                  <p className="mt-1 text-[10.5px] leading-relaxed text-amber-400/90">
                    Produk berbayar tanpa tautan checkout — tombol "Beli di toko" tidak akan muncul di Marketplace.
                  </p>
                )}
                {form.lynk.trim() !== '' && !/^https:\/\//i.test(form.lynk.trim()) && (
                  <p className="mt-1 text-[10.5px] leading-relaxed text-amber-400/90">
                    Tautan harus diawali https:// — tanpa itu tombolnya akan menuju alamat relatif di dalam situs ini.
                  </p>
                )}
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
              {/* -- Detail panjang ------------------------------------------
                  Ikut hilang dari formulir ini bersama `lynk`, dan celahnya
                  lebih berbahaya: `ringkas` cuma dua baris di kartu, sementara
                  `detail` adalah halaman jualannya — di situ harga, batasan,
                  dan cara pasang ditulis. Teks yang tidak bisa disunting
                  BERBOHONG diam-diam begitu produknya berubah, dan yang
                  membacanya calon pembeli, bukan pemiliknya.

                  Ketahuan dari Trade-Fi Sync: detailnya masih menulis "order
                  lewat web sementara ini MARKET saja" padahal EA-nya sudah
                  lama memasang pending order, dan masih menyebut harga
                  perkenalan $2 padahal katalognya $7. Satu menjual produknya
                  lebih rendah dari kemampuannya, satu lagi membuat pembeli
                  merasa dibohongi di halaman checkout. */}
              <div className="mt-3">
                <label className="mb-1 block text-[11px] text-zinc-500">
                  Detail panjang <span className="text-zinc-600">(halaman produk — baris kosong memisahkan paragraf)</span>
                </label>
                <textarea rows={8} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })}
                  disabled={!pemilik}
                  className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[12.5px] leading-relaxed text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                {/* Harga disebut di DUA tempat yang tidak saling tahu: angka
                    di kolom Harga, dan kalimat di detail. Yang satu berubah
                    tanpa yang lain adalah cara paling mudah memasang klaim
                    palsu di halaman jualan sendiri. */}
                {/\$\s?\d/.test(form.detail) && (
                  <p className="mt-1 text-[10.5px] leading-relaxed text-amber-400/90">
                    Detail menyebut angka dolar. Pastikan cocok dengan Harga (${Number(form.harga) || 0}
                    {Number(form.hargaAsal) > (Number(form.harga) || 0) ? ` dicoret dari $${Number(form.hargaAsal)}` : ''}) —
                    harga di teks tidak ikut berubah sendiri saat kolom Harga diubah.
                  </p>
                )}
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
      </>)}

    </div>
  );
}
