import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   DAFTAR YANG BISA DILIPAT DAN DIBATASI
   ════════════════════════════════════════════════════════════════════════
   Dipakai dua panel yang berdampingan: Permintaan Akses dan Lisensi Aktif.
   Ditulis sekali karena keduanya harus BERPERILAKU SAMA — dua daftar
   bersebelahan yang satu bisa dilipat dan satunya tidak akan terbaca
   sebagai dua hal yang berbeda jenis, padahal cuma dua sisi dari keputusan
   yang sama.

   BATAS 10 BARIS. Daftar yang tumbuh tanpa batas mendorong panel di
   sebelahnya jadi jauh lebih pendek, dan di layar dua kolom itu berarti
   satu sisi kosong memanjang sementara sisi lain menggulir. Sepuluh cukup
   untuk memutuskan; sisanya dibuka kalau memang dicari.

   PENOMORAN dari 1, bukan 0, dan mengikuti urutan tampil. Nomor gunanya
   untuk menunjuk — "yang nomor 3" — dan nomor yang berubah kalau daftarnya
   disaring akan menunjuk baris yang salah, jadi ia dihitung dari daftar
   yang SEDANG ditampilkan.
   ════════════════════════════════════════════════════════════════════════ */

export function DaftarLipat<T>({ data, batasAwal = 10, kosong, render, awalTerbuka = true }: {
  data: T[];
  /** Berapa baris ditampilkan sebelum "Tampilkan semua". */
  batasAwal?: number;
  /** Isi saat daftarnya kosong. */
  kosong: React.ReactNode;
  /** Penggambar satu baris. `no` sudah 1-based. */
  render: (butir: T, no: number) => React.ReactNode;
  awalTerbuka?: boolean;
}) {
  const [buka, setBuka] = useState(awalTerbuka);
  const [semua, setSemua] = useState(false);

  if (!data.length) return <>{kosong}</>;

  const tampil = semua ? data : data.slice(0, batasAwal);
  const sisa = data.length - tampil.length;

  return (
    <div>
      <button onClick={() => setBuka((v) => !v)}
        className="mb-2 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-[11.5px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300">
        {buka ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {buka ? 'Sembunyikan daftar' : `Tampilkan daftar (${data.length})`}
        <span className="ml-auto angka text-[11px] text-zinc-600">{data.length} baris</span>
      </button>

      {buka && (
        <>
          <div className="space-y-2.5">
            {tampil.map((b, i) => render(b, i + 1))}
          </div>

          {sisa > 0 && (
            <button onClick={() => setSemua(true)}
              className="mt-2.5 w-full cursor-pointer rounded-md border border-zinc-800 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
              Tampilkan {sisa} lainnya
            </button>
          )}
          {semua && data.length > batasAwal && (
            <button onClick={() => setSemua(false)}
              className="mt-2.5 w-full cursor-pointer rounded-md border border-zinc-800 py-1.5 text-[11.5px] text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300">
              Ringkas lagi jadi {batasAwal}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Nomor urut baris. Lebar tetap supaya angka satu dan dua digit tidak
 *  menggeser isi barisnya. */
export function NomorBaris({ no, className }: { no: number; className?: string }) {
  return (
    <span className={cn('angka w-5 shrink-0 text-[11px] text-zinc-600', className)}>{no}.</span>
  );
}
