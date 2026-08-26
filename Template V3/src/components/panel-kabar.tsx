import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMuncul } from '@/lib/gerak';

/* ════════════════════════════════════════════════════════════════════════
   PANEL KABAR — satu bentuk untuk lonceng DAN amplop
   ════════════════════════════════════════════════════════════════════════
   Dulu kedua dropdown ini ditulis dua kali di app-shell, lengkap dengan
   catatan "kalau salah satu diubah, yang lain WAJIB ikut". Catatan seperti
   itu adalah pengakuan bahwa kodenya akan menyimpang — dan memang sempat
   menyimpang. Bentuknya sekarang tinggal di sini; app-shell tinggal
   mengisinya.

   Isi tetap berbeda dan memang harus berbeda: lonceng soal PASAR, amplop
   soal AKUN. Yang disatukan cuma wadahnya.
   ════════════════════════════════════════════════════════════════════════ */

/* Warna petak ikon MEMBAWA ARTI, bukan hiasan. Di tampilan lama arti itu
   dibawa lencana teks kecil ("sinyal", "tinggi") yang duduk di atas judul
   dan memakan satu baris penuh. Dipindah ke petak ikonnya: artinya tetap
   terbaca sekilas, barisnya berkurang satu. */
export type WarnaKabar = 'netral' | 'hijau' | 'biru' | 'kuning' | 'merah';

const PETAK: Record<WarnaKabar, string> = {
  netral: 'bg-zinc-800 text-zinc-400',
  hijau: 'bg-emerald-500/15 text-emerald-400',
  biru: 'bg-sky-500/15 text-sky-400',
  kuning: 'bg-amber-500/15 text-amber-400',
  merah: 'bg-red-500/15 text-red-400',
};

const LUWES = 'ease-[cubic-bezier(0.4,0,0.2,1)]';

/* Konteks dipakai supaya baris tidak perlu dioper `tampil` satu per satu.
   Barisnya ditulis di app-shell di dalam beberapa kelompok bersarang;
   mengoper prop lewat semua itu cuma menambah tempat untuk lupa. */
const Ktx = createContext<{ tampil: boolean; diam: boolean }>({ tampil: false, diam: false });

export function PanelKabar({
  ikon, judul, ringkas, tutup, children,
}: {
  ikon: ReactNode;
  judul: string;
  ringkas: string;
  tutup: () => void;
  children: ReactNode;
}) {
  /* Tanpa argumen: komponen ini HANYA dipasang saat panelnya dibuka, jadi
     pemasangannya sendiri sudah jadi tandanya. */
  const { tampil, diam } = useMuncul();

  /* ── DI PONSEL MELEBAR KE LAYAR, BUKAN MENGGANTUNG DI TOMBOLNYA ──
     Lebar tetap yang tepi kanannya menempel pada tombol lonceng membuat
     panelnya mulai di x = -120 pada layar 375 — seperlima isinya terpotong
     di luar layar kiri. Di ponsel ia `fixed` selebar layar dikurangi margin,
     digantung di bawah header (56 px, terukur). Fixed, bukan absolute: ia
     harus mengukur diri terhadap JENDELA, bukan terhadap tombol yang
     posisinya bergeser mengikuti isi header. */
  return (
    <div
      className={cn(
        'fixed inset-x-3 top-14 z-50 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl',
        'sm:absolute sm:inset-x-auto sm:right-0 sm:top-9 sm:w-[360px]',
        'transition-all duration-300 motion-reduce:transition-none', LUWES,
        tampil ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
      )}
    >
      <button
        type="button"
        onClick={tutup}
        className="flex w-full cursor-pointer select-none items-center gap-3 p-4 text-left"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300">
          {ikon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-zinc-100">{judul}</span>
          <span className="mt-0.5 block truncate text-[12px] text-zinc-500">{ringkas}</span>
        </span>
        <ChevronUp
          strokeWidth={2}
          className={cn('size-4 shrink-0 text-zinc-500 transition-transform duration-500 motion-reduce:transition-none',
            LUWES, tampil ? 'rotate-0' : 'rotate-180')}
        />
      </button>

      <div
        className={cn('grid transition-all duration-500 motion-reduce:transition-none', LUWES,
          tampil ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}
      >
        {/* Tiga lapis, semuanya perlu: yang dilipat grid harus overflow-hidden,
            dan yang menggulir harus di DALAMnya — kalau digabung, tinggi
            maksimum melawan lipatan dan panelnya tidak pernah menutup rapat. */}
        <div className="overflow-hidden">
          <div className="max-h-[380px] overflow-y-auto px-2 pb-3">
            <Ktx.Provider value={{ tampil, diam }}>{children}</Ktx.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GrupKabar({ ikon, label }: { ikon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 pb-0.5 pt-2.5">
      {ikon}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
  );
}

export function BarisKabar({
  urutan, ikon, warna = 'netral', tanda, judul, detail, waktu, aksi,
}: {
  urutan: number;
  ikon: ReactNode;
  warna?: WarnaKabar;
  tanda?: ReactNode;
  judul: string;
  detail?: ReactNode;
  waktu?: string;
  aksi?: ReactNode;
}) {
  const { tampil, diam } = useContext(Ktx);

  /* Jenjangnya DIBATASI tujuh. Tanpa batas, baris kedua belas muncul hampir
     sedetik setelah panelnya terbuka — dan daftar yang masih merangkak masuk
     saat orang sudah menggulir terbaca seperti panel yang tersendat, bukan
     panel yang beranimasi. */
  const jeda = tampil && !diam ? `${Math.min(urutan, 7) * 55}ms` : '0ms';

  return (
    <div
      style={{ transitionDelay: jeda }}
      className={cn('flex items-start gap-3 rounded-xl p-3 transition-all duration-500 motion-reduce:transition-none',
        LUWES, 'hover:bg-zinc-900/70',
        tampil ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0')}
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', PETAK[warna])}>
        {ikon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold leading-snug text-zinc-100">
          {tanda && <span className="angka mr-1.5 text-[11px] font-normal text-zinc-500">{tanda}</span>}
          {judul}
        </div>
        {detail && <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-zinc-500">{detail}</div>}
        {aksi && <div className="mt-1.5">{aksi}</div>}
      </div>
      {/* zinc-500, BUKAN zinc-600 seperti meta lain di aplikasi ini. Di tema
          terang zinc-600 memetakan ke #94a3b8: 2,6:1 di atas putih, di bawah
          ambang 4,5:1 dan cuma 11 px. Baris meta lain lolos karena lebih
          besar; cap waktu di sini tidak. */}
      {waktu && <span className="shrink-0 pt-0.5 text-[11px] text-zinc-500">{waktu}</span>}
    </div>
  );
}

export function KosongKabar({ ikon, judul, detail }: { ikon: ReactNode; judul: string; detail: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-zinc-900 text-zinc-600">
        {ikon}
      </span>
      <div className="mt-2.5 text-[12.5px] text-zinc-400">{judul}</div>
      <div className="mx-auto mt-1 max-w-[240px] text-[11.5px] leading-snug text-zinc-600">{detail}</div>
    </div>
  );
}
