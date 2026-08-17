import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, ChevronRight, TriangleAlert, Eye, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { discordSiap, mulaiLoginDiscord } from '@/lib/analisa';
import { modePreview, akhiriPreview } from '@/lib/preview';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   GERBANG — masuk, status langganan, dan penanda data contoh
   ════════════════════════════════════════════════════════════════════════
   Aplikasi ini TIDAK mengunci pengunjung di halaman login. Yang belum masuk
   tetap melihat seluruh antarmuka, terisi data contoh dan diberi label jujur.

   Alasannya praktis: layar login kosong tidak menjelaskan apa pun tentang
   apa yang dibeli. Orang perlu melihat bentuk jurnalnya dulu untuk tahu ia
   ingin punya. Yang dijaga bukan tampilannya — melainkan datanya, dan itu
   dijaga Security Rules di server, bukan oleh menyembunyikan halaman.
   ════════════════════════════════════════════════════════════════════════ */

/** Logo Google digambar sebagai path, bukan diunduh — CSP di GitHub Pages
 *  memblokir gambar lintas-domain, dan logo yang gagal muat pada tombol
 *  login membuat tombolnya terlihat rusak. */
function IkonGoogle({ kelas = 'size-4' }: { kelas?: string }) {
  return (
    <svg className={kelas} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

export function TombolMasuk({ penuh }: { penuh?: boolean }) {
  const { masuk, galat } = useAuth();
  const [jalan, setJalan] = useState(false);
  const [adaDiscord, setAdaDiscord] = useState(false);
  useEffect(() => { void discordSiap().then(setAdaDiscord); }, []);

  async function klik() {
    setJalan(true);
    await masuk();
    setJalan(false);
  }

  return (
    <div className={penuh ? 'w-full' : ''}>
      <button
        onClick={klik} disabled={jalan}
        className={cn(
          'flex cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-100 px-3.5 py-2',
          'text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-60',
          penuh && 'w-full py-2.5'
        )}
      >
        {jalan ? <Loader2 className="size-4 animate-spin" /> : <IkonGoogle />}
        {jalan ? 'Membuka…' : 'Masuk dengan Google'}
      </button>
      {/* Discord hanya tampil kalau backend menyatakan siap — fitur yang
          belum dikonfigurasi bukan tombol yang boleh gagal saat diklik. */}
      {adaDiscord && (
        <button onClick={mulaiLoginDiscord}
          className={cn(
            'mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[#5865F2]/40',
            'bg-[#5865F2]/10 px-3.5 py-2 text-[12.5px] font-medium text-[#8b93f8] transition-colors hover:bg-[#5865F2]/20',
            penuh && 'w-full py-2.5'
          )}>
          Masuk dengan Discord
        </button>
      )}
      {galat && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-red-400">{galat}</p>
      )}
    </div>
  );
}

/** Avatar + menu. Menggantikan bulatan abu-abu mati di bilah atas. */
export function MenuPengguna() {
  const { pengguna, langganan, keluar, pemilik, memuat } = useAuth();
  const [buka, setBuka] = useState(false);

  /* Selama auth belum menjawab, TIDAK menampilkan apa pun yang menyimpulkan.
     ──────────────────────────────────────────────────────────────────────
     Firebase memulihkan sesi dari IndexedDB secara asinkron; selama ~300 ms
     pertama `pengguna` masih null meski orangnya sudah masuk. Menampilkan
     "Masuk dengan Google" di jeda itu membuat tombol login berkedip tiap
     kali halaman disegarkan — dan sekilas terlihat seperti sesi yang putus.

     Bulatan abu berukuran sama dengan avatar menahan tempatnya, jadi tidak
     ada yang bergeser saat fotonya datang. */
  if (memuat) {
    return <span className="size-7 shrink-0 animate-pulse rounded-full bg-zinc-800" aria-hidden />;
  }

  /* MODE PREVIEW: tidak ada tombol masuk di pojok ini.
     ──────────────────────────────────────────────────────────────────────
     Bukan sekadar kerapian. `TombolMasuk` menggambar DUA tombol bertumpuk
     (Google lalu Discord), sementara bilah atas ini setinggi satu baris —
     jadi yang kedua meluber ke bawah dan menindih panel di halaman. Yang
     terlihat orangnya: dua kotak putih melayang di atas isinya.

     Ajakan masuk tidak hilang, cuma pindah ke tempat yang benar: pita
     preview tepat di bawah bilah ini sudah membawa "Coba dengan akunku",
     lengkap dengan kalimat yang menjelaskan kenapa. Satu ajakan yang
     dijelaskan mengalahkan dua tombol telanjang di pojok. */
  if (!pengguna && modePreview()) return null;
  if (!pengguna) return <TombolMasuk />;

  const huruf = (pengguna.displayName || pengguna.email || '?').trim()[0].toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setBuka((v) => !v)}
        aria-label="Menu akun"
        className="block cursor-pointer overflow-hidden rounded-full ring-1 ring-zinc-700 transition-colors hover:ring-zinc-500"
      >
        {pengguna.photoURL ? (
          /* referrerPolicy wajib: lh3.googleusercontent.com membalas 403
             untuk permintaan dengan Referer yang tidak dikenalnya, dan
             fotonya jadi kotak kosong di domain sendiri. */
          <img src={pengguna.photoURL} alt="" referrerPolicy="no-referrer" className="size-7 object-cover" />
        ) : (
          <span className="flex size-7 items-center justify-center bg-gradient-to-br from-zinc-600 to-zinc-800 text-[11px] font-semibold text-zinc-100">
            {huruf}
          </span>
        )}
      </button>

      {buka && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setBuka(false)} />
          <div className="absolute right-0 top-9 z-50 w-[258px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="border-b border-zinc-800 px-4 py-3">
              <div className="truncate text-[12.5px] text-zinc-100">{pengguna.displayName || 'Tanpa nama'}</div>
              <div className="truncate text-[11.5px] text-zinc-500">{pengguna.email}</div>
              {pemilik && (
                <span className="mt-1.5 inline-block rounded bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                  Pemilik
                </span>
              )}
            </div>

            <div className="border-b border-zinc-800 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-600">Akses</div>
              <div className="mt-1 flex items-baseline gap-2">
                {/* Pemilik didahulukan atas status langganan — sama alasannya
                    dengan PitaLangganan: gerbang memakai dua sumber, dan
                    membaca satu saja menulis "Habis" untuk orang yang
                    aksesnya justru tidak bisa dicabut. */}
                <span className={cn('text-[13px]',
                  pemilik ? 'text-amber-400'
                    : langganan.status === 'aktif' ? 'text-emerald-400'
                    : langganan.status === 'pratinjau' ? 'text-sky-300'
                    : langganan.status === 'habis' ? 'text-red-400' : 'text-zinc-400')}>
                  {pemilik ? 'Penuh'
                    : langganan.status === 'aktif' ? 'Aktif'
                    : langganan.status === 'pratinjau' ? 'Pratinjau'
                    : langganan.status === 'habis' ? 'Habis' : 'Belum diketahui'}
                </span>
                {/* Pratinjau diukur JAM, langganan diukur hari — memakai satu
                    satuan untuk keduanya menulis "sisa 1 hari" untuk sisa dua
                    menit, dan itu kebohongan yang baru ketahuan saat layarnya
                    mendadak terkunci. */}
                {!pemilik && langganan.status === 'pratinjau' && langganan.sisaMs !== null && (
                  <span className="angka text-[11.5px] text-zinc-500">sisa {sisaTerbaca(langganan.sisaMs)}</span>
                )}
                {!pemilik && langganan.status === 'aktif' && langganan.sisaHari !== null && (
                  <span className="angka text-[11.5px] text-zinc-500">sisa {langganan.sisaHari} hari</span>
                )}
              </div>
              {/* Pemilik tidak punya tagihan dan tidak perlu meminta akses —
                  keduanya tautan yang menuju halaman yang tidak menjawab
                  apa pun untuknya. */}
              {!pemilik && (
                <Link to={langganan.status === 'aktif' ? '/tagihan' : '/akses'} onClick={() => setBuka(false)}
                  className="mt-2 inline-flex items-center gap-1 text-[12px] text-zinc-300 hover:text-zinc-100">
                  {langganan.status === 'aktif' ? 'Kelola tagihan' : 'Minta akses penuh'} <ChevronRight className="size-3" />
                </Link>
              )}
            </div>

            <button
              onClick={() => { setBuka(false); keluar(); }}
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left text-[12.5px] text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              <LogOut className="size-3.5" /> Keluar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** "3 jam 12 menit", "48 menit", "kurang dari semenit". Dipakai di dua
 *  tempat, jadi ditulis sekali di sini supaya keduanya tidak pernah
 *  membulatkan dengan cara yang berbeda. */
export function sisaTerbaca(ms: number): string {
  if (ms <= 0) return 'habis';
  const menit = Math.floor(ms / 60_000);
  if (menit < 1) return 'kurang dari semenit';
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  if (jam < 1) return `${menit} menit`;
  return sisaMenit ? `${jam} jam ${sisaMenit} menit` : `${jam} jam`;
}

/* ════════════════════════════════════════════════════════════════════════
   PITA AKSES — pratinjau berjalan, atau pratinjau habis
   ════════════════════════════════════════════════════════════════════════
   Selama pratinjau, pita ini TIDAK BISA DITUTUP. Alasannya bukan estetika:
   satu-satunya hal yang membedakan pratinjau dari akses penuh adalah
   jamnya, dan menyembunyikan jam berarti orangnya menyusun jurnal seharian
   tanpa tahu bahwa besok layarnya terkunci. Tombol tutup pada keterangan
   sepenting itu adalah tombol untuk melupakan kabar buruk.

   Sesudah habis, pita boleh ditutup — pesannya sudah tersampaikan, dan
   gerbangnya sendiri yang menahan.
   ════════════════════════════════════════════════════════════════════════ */
export function PitaLangganan() {
  const { pengguna, langganan, pemilik } = useAuth();
  const [tutup, setTutup] = useState(false);
  /* Detak per menit supaya hitungannya turun sendiri. Bukan per detik:
     layarnya tidak perlu setepat itu, dan render tiap detik di seluruh
     aplikasi adalah ongkos yang tidak dibayar apa pun. */
  const [, detak] = useState(0);
  useEffect(() => {
    if (langganan.status !== 'pratinjau') return;
    const t = setInterval(() => detak((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [langganan.status]);

  /* ── Pengunjung mode preview ──────────────────────────────────────────
     Ia belum masuk, jadi cabang di bawah tidak berlaku untuknya — tapi
     justru dialah yang paling perlu diberi tahu. Seluruh angka yang ia
     lihat karangan, dan satu-satunya yang membuat itu jujur adalah
     kalimat yang mengatakannya.

     TIDAK bisa ditutup. Tombol tutup pada keterangan sepenting ini adalah
     tombol untuk melupakan bahwa yang dilihat bukan kenyataan. */
  if (!pengguna && modePreview()) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-sky-500/25 bg-sky-500/[0.07] px-4 py-2.5 text-[12.5px]">
        <Eye className="size-4 shrink-0 text-sky-300" strokeWidth={2} />
        <span className="flex-1 text-zinc-300">
          <span className="font-medium text-sky-200">Mode preview</span> — kamu sedang menjelajah
          website yang sesungguhnya, tapi seluruh angkanya <b>data contoh</b>. Berpindah halaman
          bebas; menyimpan perubahan baru bisa setelah masuk.
        </span>
        <Link to="/pratinjau"
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
          Coba dengan akunku
        </Link>
        <button onClick={() => { akhiriPreview(); window.location.hash = '#/'; }}
          className="cursor-pointer text-[12px] text-zinc-500 underline underline-offset-2 hover:text-zinc-300">
          Keluar preview
        </button>
      </div>
    );
  }

  if (!pengguna) return null;

  /* PEMILIK tidak pernah melihat pita ini.
     ────────────────────────────────────────────────────────────────────
     Pemilik lolos gerbang lewat jalur `pemilik`, BUKAN lewat status
     langganan — dan status langganannya sendiri terhitung 'habis', karena
     ia memang tidak punya `bayarSampai` dan tidak pernah mengambil
     pratinjau. Tanpa penjaga ini, satu-satunya orang yang aksesnya paling
     tidak mungkin dicabut justru disuruh "minta kode akses" tiap kali
     membuka Dashboard.

     Pelajarannya lebih luas dari satu pita: layar yang menyimpulkan hak
     akses dari `langganan.status` saja akan selalu salah untuk pemilik,
     karena gerbangnya memakai DUA sumber. Yang membaca hak akses harus
     membaca keduanya. */
  if (pemilik) return null;

  const pratinjau = langganan.status === 'pratinjau';
  /* 'habis' hanya bisa terlihat sekejap: begitu statusnya berubah,
     gerbang melempar orangnya ke /akses. Pitanya tetap ada supaya
     detik-detik itu tidak berupa layar yang berubah tanpa penjelasan. */
  const habis = langganan.status === 'habis';
  if (!pratinjau && !habis) return null;
  if (habis && tutup) return null;

  const sisa = pratinjau && langganan.berakhir ? +langganan.berakhir - Date.now() : 0;

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-[12.5px]',
      habis ? 'border-red-500/25 bg-red-500/[0.07]' : 'border-sky-500/25 bg-sky-500/[0.06]',
    )}>
      {habis
        ? <TriangleAlert className="size-4 shrink-0 text-red-400" strokeWidth={2} />
        : <Eye className="size-4 shrink-0 text-sky-300" strokeWidth={2} />}
      <span className="flex-1 text-zinc-300">
        {habis ? (
          <>Pratinjau sudah habis. Minta kode akses, atau tanyakan sisa kuota gratis ke pemilik.</>
        ) : (
          <>
            <span className="font-medium text-sky-200">Mode pratinjau</span> — sisa{' '}
            <span className="angka text-sky-200">{sisaTerbaca(sisa)}</span>. Isi yang tampil adalah data
            contoh, dan sesudah ini perlu kode akses.
          </>
        )}
      </span>
      <Link to="/akses"
        className="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
        Minta akses
      </Link>
      {habis && (
        <button onClick={() => setTutup(true)} aria-label="Tutup"
          className="cursor-pointer text-zinc-600 hover:text-zinc-300">✕</button>
      )}
    </div>
  );
}

/** Label kecil "data contoh". Dipasang di layar yang sedang memakai data
 *  contoh karena belum ada yang masuk — supaya tidak ada yang mengira angka
 *  itu miliknya. */
export function LabelContoh({ tampil }: { tampil: boolean }) {
  if (!tampil) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-400">
      <Eye className="size-3" /> data contoh — masuk untuk melihat punyamu
    </span>
  );
}


/* ── Spanduk data contoh untuk akun baru ─────────────────────────────────
   TIGA keadaan, bukan dua, dan yang ketiga yang paling penting.

   Sebelum ini pilihannya cuma "mulai dari nol" atau "biarkan contohnya",
   dan yang kedua tidak menyalin apa pun — ia hanya menahan tampilan supaya
   tetap memperlihatkan konstanta di dalam kode. Akibatnya orang yang baru
   saja menjelajahi preview lalu masuk melihat seluruh bentuk yang membuatnya
   tertarik menguap: jurnalnya sendiri kosong, dan tidak ada satu tombol pun
   yang bisa mengembalikannya.

   Sekarang "Impor" benar-benar MENULIS ke jurnalnya, sekali, atas
   permintaannya. Dan karena menulis, ia wajib bisa dibatalkan — keadaan
   ketiga: jurnal yang berisi transaksi contoh selalu membawa tombol
   hapusnya sendiri. Pilihan yang tidak bisa dibatalkan bukan pilihan.
   ──────────────────────────────────────────────────────────────────────── */
import { useAuth as useAuthGerbang } from '@/lib/auth';
import { bacaPilihanContoh, simpanPilihanContoh } from '@/lib/data';
import { useState as useStateGerbang } from 'react';
import { imporContoh, hapusImporContoh, AWALAN_CONTOH } from '@/lib/impor-contoh';
import type { Trade } from '@/data/contoh';

export function SpandukContoh({ contoh, riwayat = [] }: { contoh: boolean; riwayat?: Trade[] }) {
  const { pengguna } = useAuthGerbang();
  const [, setV] = useStateGerbang(0);
  const [sibuk, setSibuk] = useStateGerbang<'' | 'impor' | 'hapus'>('');
  const [kabar, setKabar] = useStateGerbang('');

  if (!pengguna) return null;

  /* IMPOR STATIS, dan sebelumnya dinamis — itu bug yang dilaporkan.
     ──────────────────────────────────────────────────────────────────────
     `await import('@/lib/impor-contoh')` memecah kodenya jadi potongan
     terpisah bernama hash, misalnya `impor-contoh-D1OOC03W.js`. Nama itu
     berubah TIAP BUILD. Halaman yang sudah terbuka — atau yang dimuat dari
     index.html versi cache — memegang daftar nama LAMA, jadi begitu
     tombolnya ditekan permintaannya 404 dan yang terbaca orangnya:
     "Failed to fetch dynamically imported module".

     App.tsx punya penawarnya (`muat()`, memuat ulang sekali dengan
     parameter pembeda), tapi itu cuma membungkus rute malas — bukan impor
     dinamis di dalam komponen seperti ini.

     Alih-alih menyalin penawar itu ke sini, impornya dijadikan statis.
     Alasannya: penghematannya memang tidak ada. Berkas ini sudah menarik
     lib/data.ts, yang menarik data/contoh.ts — tempat 123 transaksi contoh
     itu SEBENARNYA tinggal. Yang dipecah tadi cuma ~1 kB fungsi tulis.
     Satu kilobita bukan harga yang pantas untuk satu kelas kegagalan. */
  async function jalankan(apa: 'impor' | 'hapus') {
    if (!pengguna) return;
    setSibuk(apa); setKabar('');
    try {
      if (apa === 'impor') {
        const n = await imporContoh(pengguna.uid);
        setKabar(`${n} transaksi contoh masuk ke jurnalmu. Angka di seluruh halaman ikut terisi.`);
      } else {
        await hapusImporContoh(pengguna.uid);
        simpanPilihanContoh(pengguna.uid, 'kosong');
        setKabar('Data contoh dihapus. Jurnalmu kembali kosong.');
      }
    } catch (e) {
      setKabar('Gagal: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setSibuk(''); }
  }

  /* KEADAAN 3 didahulukan. Jurnal yang berisi transaksi contoh harus selalu
     mengatakannya — termasuk berbulan-bulan sesudah imporya, saat orangnya
     sudah lupa dan mulai membaca winrate itu sebagai rekam jejaknya sendiri. */
  if (adaContohDiRiwayat(riwayat)) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3">
        <Eye className="size-4 shrink-0 text-amber-400" strokeWidth={2} />
        <span className="text-[12.5px] text-amber-100/90">
          Jurnal ini berisi <b>transaksi contoh</b> hasil impor — bukan hasil tradingmu.
          Hapus kapan saja, transaksimu sendiri tidak ikut terhapus.
        </span>
        <span className="ml-auto flex items-center gap-3">
          {kabar && <span className="text-[11.5px] text-amber-200/70">{kabar}</span>}
          <button onClick={() => void jalankan('hapus')} disabled={!!sibuk}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-50">
            {sibuk === 'hapus' && <Loader2 className="size-3.5 animate-spin" />}
            {sibuk === 'hapus' ? 'Menghapus…' : 'Hapus data contoh'}
          </button>
        </span>
      </div>
    );
  }

  if (!contoh) return null;
  if (bacaPilihanContoh(pengguna.uid) !== null) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-sky-500/25 bg-sky-500/[0.05] px-4 py-3">
      <span className="text-[12.5px] text-sky-200/90">
        Akunmu masih kosong, jadi halaman ini menampilkan <b>data contoh</b> dulu.
        Mau disalin jadi milikmu supaya bisa diutak-atik?
      </span>
      <span className="ml-auto flex items-center gap-3">
        {kabar && <span className="text-[11.5px] text-sky-200/70">{kabar}</span>}
        <button onClick={() => { simpanPilihanContoh(pengguna.uid, 'kosong'); setV((x) => x + 1); }}
          disabled={!!sibuk}
          className="cursor-pointer rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-500 disabled:opacity-50">
          Mulai dari nol
        </button>
        <button onClick={() => void jalankan('impor')} disabled={!!sibuk}
          className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-60">
          {sibuk === 'impor' && <Loader2 className="size-3.5 animate-spin" />}
          {sibuk === 'impor' ? 'Menyalin…' : 'Impor data contoh'}
        </button>
      </span>
    </div>
  );
}

/* Memakai AWALAN_CONTOH yang SUNGGUHAN, bukan salinan tulisan tangan.
   Sempat ditulis ulang di sini waktu impornya masih dinamis — dua tempat
   memegang satu string, dijaga sebaris uji. Begitu impornya jadi statis,
   alasan itu hilang dan salinannya ikut dibuang: yang menulis id dan yang
   mengenalinya sekarang membaca konstanta yang sama persis. */
function adaContohDiRiwayat(riwayat: Trade[]): boolean {
  return riwayat.some((t) => t.id.startsWith(AWALAN_CONTOH));
}
