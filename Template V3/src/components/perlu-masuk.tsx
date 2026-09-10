import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { TombolMasuk } from '@/components/gerbang';

/* ════════════════════════════════════════════════════════════════════════
   PERLU MASUK — kartu penjelasan, bukan lemparan ke halaman login
   ════════════════════════════════════════════════════════════════════════
   Dipakai halaman yang TIDAK ikut dibuka mode preview. Melempar pengunjung
   ke halaman akses membuat kliknya terasa seperti galat: ia menekan satu
   menu, mendarat di tempat yang tidak ia minta, dan tidak pernah tahu apa
   yang sebenarnya ada di balik menu itu.

   Jadi orangnya TETAP di halaman yang ia tuju. Yang berbeda cuma isinya —
   penjelasan tentang apa yang ada di sini, kenapa ia butuh akun, dan tombol
   masuknya di tempat itu juga. Sesudah masuk, `tamuPreview` di halaman
   pemanggil berubah jadi false dan halamannya langsung menggambar isinya
   tanpa berpindah ke mana pun.

   Alasannya SELALU disebut, bukan cuma "terkunci". Halaman ini di luar
   preview karena isinya bukan dari Firestore — jadi tidak ada Security
   Rules yang ikut menjaganya, dan yang tampil kalau dibiarkan bukan data
   contoh melainkan hasil kerja yang sungguhan.
   ════════════════════════════════════════════════════════════════════════ */
export function PerluMasuk({ judul, ket, poin }: {
  judul: string;
  ket: ReactNode;
  /** [judul, keterangan] — isi yang sebenarnya ada di balik pintu ini. */
  poin: [string, string][];
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/40 px-3 py-1.5 text-zinc-400">
          <Lock className="size-4" strokeWidth={2} />
          <span className="text-[10.5px] font-semibold uppercase tracking-wider">Perlu masuk</span>
        </div>

        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-50">{judul}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">{ket}</p>

        <ul className="mt-5 flex flex-col gap-2.5 border-t border-zinc-800 pt-5">
          {poin.map(([j, k]) => (
            <li key={j} className="flex gap-2.5">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-zinc-600" />
              <div>
                <div className="text-[12.5px] font-medium text-zinc-200">{j}</div>
                <div className="text-[11.5px] leading-relaxed text-zinc-500">{k}</div>
              </div>
            </li>
          ))}
        </ul>

        {/* items-start, bukan items-center: TombolMasuk bisa menumpuk dua
            tombol (Google + Discord), dan yang di sebelahnya harus
            sejajar baris pertama — bukan mengambang di antaranya. */}
        <div className="mt-5 flex flex-wrap items-start gap-2.5">
          <TombolMasuk />
          <Link to="/dashboard"
            className="rounded-md border border-zinc-800 px-4 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
            Kembali ke Dashboard
          </Link>
        </div>

        <p className="mt-3.5 text-[11.5px] leading-relaxed text-zinc-600">
          Masuk saja sudah cukup — halaman ini tidak menunggu lisensi aktif,
          dan preview yang sedang berjalan tidak ikut berakhir.
        </p>
      </div>
    </div>
  );
}
