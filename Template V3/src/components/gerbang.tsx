import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TriangleAlert, Eye, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { discordSiap, mulaiLoginDiscord } from '@/lib/analisa';
import { modePreview, akhiriPreview } from '@/lib/preview';
import { KartuProfil } from '@/components/kartu-profil';
import { AvatarAnalis } from '@/components/avatar-analis';
import { fotoTersimpan } from '@/lib/profil-pengguna';
import { cn, sisaTerbaca } from '@/lib/utils';

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
  const { pengguna, memuat } = useAuth();
  const [buka, setBuka] = useState(false);
  const lokasi = useLocation();

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

  /* ── SATU TOMBOL, BUKAN DUA ──────────────────────────────────────────
     Baris ini dulu berbunyi `return <TombolMasuk />`, dan itu cacat yang
     sama persis dengan yang sudah dijelaskan tepat di atas untuk mode
     preview -- cuma penjaganya kurang satu keadaan.

     TombolMasuk menggambar DUA tombol bertumpuk (Google lalu Discord).
     Slot ini setinggi avatar, 28 px. Yang kedua meluber keluar bilah dan
     menindih isi halaman; yang pertama terpotong tepi atas. Dilaporkan
     pemilik dari ponselnya di /harga.

     Kenapa baru muncul sekarang padahal kodenya lama: sampai 21 Agu 2026
     tidak ada satu pun halaman berkerangka yang bisa dibuka tanpa sesi.
     /docs dibuka hari itu, /harga menyusul 2 Sep -- dan pengunjung tanpa
     sesi yang BUKAN mode preview baru sejak itu bisa sampai ke sini.
     Jadi cacatnya sudah ada dua minggu, cuma belum ada yang melihatnya.

     Gantinya satu tautan sebesar avatar yang digantikannya, menuju /akses
     -- halaman yang memang dirancang untuk masuk: kedua penyedia dengan
     tata letak yang benar, kuota, dan persetujuan risikonya. Menjejalkan
     itu semua ke pojok bilah adalah asal masalahnya.

     `dari` dibawa lengkap dengan query supaya orangnya kembali ke tempat
     yang sedang ia baca, bukan dilempar ke dashboard. */
  if (!pengguna) {
    const dari = encodeURIComponent(lokasi.pathname + lokasi.search);
    return (
      <Link
        to={`/akses?dari=${dari}`}
        className={cn(
          'flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-2.5',
          'text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white',
        )}
      >
        <LogIn className="size-3.5" />
        Masuk
      </Link>
    );
  }

  /* Foto yang DIUNGGAH SENDIRI menang atas foto Google — orang yang repot
     menggantinya di kartu profil sedang menyatakan foto akun Google-nya
     bukan yang ia mau dipakai.

     Dibaca dari cermin localStorage, bukan dari jaringan: bulatan 28 px ini
     digambar di setiap halaman, dan satu permintaan jaringan per pemuatan
     halaman demi sebuah avatar adalah ongkos yang dibayar semua orang. */
  const fotoBilah = fotoTersimpan(pengguna.uid) || pengguna.photoURL || '';

  return (
    <div className="relative">
      <button
        onClick={() => setBuka((v) => !v)}
        aria-label="Menu akun"
        className="block cursor-pointer overflow-hidden rounded-full ring-1 ring-zinc-700 transition-colors hover:ring-zinc-500"
      >
        {/* AvatarAnalis, bukan <img> sendiri: ia sudah membawa
            referrerPolicy="no-referrer" (lh3.googleusercontent.com membalas
            403 untuk Referer yang tidak dikenalnya) DAN penadah onError yang
            jatuh ke huruf awal. Penadah itu bukan kemewahan di sini — foto
            yang diunggah menunjuk berkas di VPS, dan berkas bisa hilang saat
            pemulihan; tanpa penadah yang tampil kotak rusak bawaan peramban,
            yang terbaca sebagai aplikasi rusak. */}
        <AvatarAnalis
          nama={pengguna.displayName || pengguna.email || '?'}
          foto={fotoBilah} uid={pengguna.uid}
          className="size-7" kelasHuruf="text-[11px]"
        />
      </button>

      {buka && (
        <>
          {/* Lapisan penangkap klik-di-luar. Tetap di z-40 supaya kartunya
              (z-50) berada di atasnya, dan tetap `fixed inset-0` supaya
              klik di sudut mana pun menutup menunya — termasuk di atas
              chart yang punya penangan klik sendiri. */}
          <div className="fixed inset-0 z-40" onClick={() => setBuka(false)} />
          <div className="absolute right-0 top-9 z-50">
            <KartuProfil tutup={() => setBuka(false)} />
          </div>
        </>
      )}
    </div>
  );
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
    /* ── Kenapa `basis-full` di ponsel, bukan sekadar `flex-wrap` ────────
       Dulu barisnya `flex-wrap` dengan teks ber-`flex-1`, dan itu tidak
       pernah membungkus: `flex-1` membuat teksnya boleh MENYUSUT tanpa
       batas, jadi tombol-tombolnya selalu "muat" di baris yang sama dan
       teksnya terperas jadi kolom selebar dua-tiga kata — satu kalimat
       jadi belasan baris di layar ponsel.

       `basis-full` memberi teks lebar dasar 100%, jadi tombolnya TERPAKSA
       turun ke baris berikutnya. Di sm ke atas dikembalikan ke satu baris
       (`sm:basis-0` + flex-1), karena di sana ruangnya memang cukup. */
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-sky-500/25 bg-sky-500/[0.07] px-4 py-2.5 text-[12.5px]">
        <span className="flex min-w-0 flex-1 basis-full items-start gap-2.5 sm:basis-0 sm:items-center">
          {/* mt-0.5 hanya di ponsel: di sana teksnya banyak baris, dan ikon
              yang dipusatkan terhadap blok tinggi terbaca melayang di
              tengah alinea alih-alih menandai awalnya. */}
          <Eye className="mt-0.5 size-4 shrink-0 text-sky-300 sm:mt-0" strokeWidth={2} />
          <span className="text-zinc-300">
            <span className="font-medium text-sky-200">Mode preview</span> — kamu sedang menjelajah
            website yang sesungguhnya, tapi seluruh angkanya <b>data contoh</b>. Berpindah halaman
            bebas; menyimpan perubahan baru bisa setelah masuk.
          </span>
        </span>
        <Link to="/tour"
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
          Coba dengan akunku
        </Link>
        {/* location.assign('/'), BUKAN location.hash = '#/'.
            Yang lama bekerja hanya selama aplikasi ini memakai HashRouter:
            mengubah tanda pagar memang memindahkan halaman waktu itu.
            Sesudah pindah ke BrowserRouter (17 Agu 2026) ia tidak lagi
            menavigasi apa pun — tombolnya akan terlihat rusak tanpa
            memunculkan satu pun galat.

            Muat ulang penuh memang disengaja di sini, tidak seperti tautan
            lain: keluar dari mode preview membuang seluruh data contoh, dan
            memulai dari halaman yang benar-benar bersih lebih dapat
            diandalkan daripada membujuk setiap panel melepas datanya. */}
        <button onClick={() => { akhiriPreview(); window.location.assign('/'); }}
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

/* -- SpandukContoh PINDAH ke src/components/spanduk-contoh.tsx ---------
   Bukan sekadar rapi-rapi. `app-shell.tsx` mengambil MenuPengguna dan
   PitaLangganan dari berkas ini, dan `App.tsx` mengambil app-shell secara
   STATIS. Rollup memuat satu modul UTUH, bukan sepotong -- jadi selama
   SpandukContoh masih di sini, rantainya:

     App.tsx -> app-shell -> gerbang -> lib/data -> firebase/firestore

   dan seluruh SDK Firestore (647 kB) ikut ke bundel awal, diunduh setiap
   pengunjung halaman depan yang bahkan belum login.

   Semua yang tersisa di berkas ini -- TombolMasuk, MenuPengguna,
   PitaLangganan, LabelContoh -- tidak menyentuh Firestore. JAGA TETAP
   BEGITU: satu impor `@/lib/data` di sini mengembalikan 647 kB itu ke
   halaman depan tanpa satu pun galat yang memberi tahu. */
