import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, ChevronRight, TriangleAlert, Eye, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { discordSiap, mulaiLoginDiscord } from '@/lib/analisa';
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
              <div className="text-[11px] uppercase tracking-wider text-zinc-600">Langganan</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={cn('text-[13px]',
                  langganan.status === 'aktif' ? 'text-emerald-400'
                    : langganan.status === 'coba' ? 'text-zinc-100'
                    : langganan.status === 'habis' ? 'text-red-400' : 'text-zinc-400')}>
                  {langganan.status === 'aktif' ? 'Aktif'
                    : langganan.status === 'coba' ? 'Masa coba'
                    : langganan.status === 'habis' ? 'Habis' : 'Belum diketahui'}
                </span>
                {langganan.sisaHari !== null && langganan.status !== 'habis' && (
                  <span className="angka text-[11.5px] text-zinc-500">sisa {langganan.sisaHari} hari</span>
                )}
              </div>
              <Link to="/tagihan" onClick={() => setBuka(false)}
                className="mt-2 inline-flex items-center gap-1 text-[12px] text-zinc-300 hover:text-zinc-100">
                Kelola tagihan <ChevronRight className="size-3" />
              </Link>
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

/** Pita peringatan saat masa coba mau habis atau sudah habis. */
export function PitaLangganan() {
  const { pengguna, langganan } = useAuth();
  const [tutup, setTutup] = useState(false);
  if (!pengguna || tutup) return null;

  const habis = langganan.status === 'habis';
  const segera = langganan.status === 'coba' && (langganan.sisaHari ?? 99) <= 7;
  if (!habis && !segera) return null;

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-[12.5px]',
      habis ? 'border-red-500/25 bg-red-500/[0.07]' : 'border-amber-500/25 bg-amber-500/[0.06]'
    )}>
      <TriangleAlert className={cn('size-4 shrink-0', habis ? 'text-red-400' : 'text-amber-400')} strokeWidth={2} />
      <span className="flex-1 text-zinc-300">
        {habis
          ? 'Masa coba habis. Jurnal masih bisa dibaca, tapi tidak bisa menyimpan perubahan baru.'
          : `Masa coba tersisa ${langganan.sisaHari} hari.`}
      </span>
      <Link to="/tagihan"
        className="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
        Perpanjang
      </Link>
      <button onClick={() => setTutup(true)} aria-label="Tutup"
        className="cursor-pointer text-zinc-600 hover:text-zinc-300">✕</button>
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
   Muncul HANYA saat pengguna sudah login tapi jurnalnya masih kosong dan
   layarnya sedang menampilkan data contoh. Dua pilihan, dua akibat yang
   jelas — dan keduanya bisa diubah lagi nanti dengan menambah/menghapus
   transaksi, jadi tidak ada yang permanen di sini. */
import { useAuth as useAuthGerbang } from '@/lib/auth';
import { bacaPilihanContoh, simpanPilihanContoh } from '@/lib/data';
import { useState as useStateGerbang } from 'react';

export function SpandukContoh({ contoh }: { contoh: boolean }) {
  const { pengguna } = useAuthGerbang();
  const [, setV] = useStateGerbang(0);
  if (!contoh || !pengguna) return null;
  if (bacaPilihanContoh(pengguna.uid) !== null) return null;
  const pilih = (p: 'kosong' | 'biarkan') => { simpanPilihanContoh(pengguna.uid, p); setV((x) => x + 1); };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-sky-500/25 bg-sky-500/[0.05] px-4 py-3">
      <span className="text-[12.5px] text-sky-200/90">
        Akunmu masih kosong, jadi halaman ini menampilkan <b>data contoh</b> dulu.
      </span>
      <span className="ml-auto flex gap-2">
        <button onClick={() => pilih('kosong')}
          className="cursor-pointer rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-500">
          Mulai dengan data kosong
        </button>
        <button onClick={() => pilih('biarkan')}
          className="cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
          Biarkan contohnya
        </button>
      </span>
    </div>
  );
}
