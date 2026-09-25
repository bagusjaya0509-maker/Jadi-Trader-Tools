import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
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

   PENCARIAN ditaruh di SINI, bukan di masing-masing panel, karena alasan
   yang sama dengan komponen ini ada sejak awal: dua daftar bersebelahan
   yang satu bisa dicari dan satunya tidak akan terbaca sebagai dua hal
   berbeda jenis. Diminta pemilik 25 Sep 2026 — dengan 67 lisensi aktif dan
   ratusan permintaan, menemukan satu orang berarti menekan "Tampilkan
   semua" lalu menggulir sambil membaca.
   ════════════════════════════════════════════════════════════════════════ */

export function DaftarLipat<T>({ data, batasAwal = 10, kosong, render, awalTerbuka = true,
                                tekstCari, petunjukCari = 'Cari email…' }: {
  data: T[];
  /** Berapa baris ditampilkan sebelum "Tampilkan semua". */
  batasAwal?: number;
  /** Isi saat daftarnya kosong. */
  kosong: React.ReactNode;
  /** Penggambar satu baris. `no` sudah 1-based. */
  render: (butir: T, no: number) => React.ReactNode;
  awalTerbuka?: boolean;
  /** Teks yang boleh dicari dari satu butir. Tanpa ini kotak carinya tidak
   *  muncul sama sekali.
   *
   *  Pemanggil yang menentukan isinya, bukan komponen ini: bentuk datanya
   *  berbeda di tiap panel, dan menebaknya dari nama medan ('email', 'mail',
   *  …) akan diam-diam berhenti benar begitu ada medan baru. */
  tekstCari?: (butir: T) => string;
  petunjukCari?: string;
}) {
  const [buka, setBuka] = useState(awalTerbuka);
  const [semua, setSemua] = useState(false);
  const [kata, setKata] = useState('');

  /* Disaring SEBELUM dipotong batasAwal — kalau dibalik, mencari orang
     ke-empat puluh cuma akan mencarinya di sepuluh baris pertama dan
     memulangkan "tidak ada", jawaban yang salah dengan meyakinkan.

     `useMemo` karena `tekstCari` merangkai untai untuk tiap butir, dan
     daftar ini bisa berisi ratusan baris yang digambar ulang tiap ketukan
     tombol di kotak cari. */
  const saring = kata.trim().toLowerCase();
  const disaring = useMemo(() => {
    if (!saring || !tekstCari) return data;
    return data.filter((b) => tekstCari(b).toLowerCase().includes(saring));
  }, [data, saring, tekstCari]);

  if (!data.length) return <>{kosong}</>;

  /* Kotak cari muncul hanya kalau daftarnya memang lebih panjang daripada
     yang tampil. Di bawah itu semuanya sudah kelihatan, dan kotak cari cuma
     menambah satu benda yang harus dilewati mata. Pengecualian: kalau
     sedang ADA kata yang diketik, kotaknya wajib tetap ada — hasil saringan
     yang menyusut jadi tiga baris tidak boleh menghilangkan cara
     membatalkannya. */
  const adaCari = !!tekstCari && (data.length > batasAwal || !!kata);

  const tampil = semua ? disaring : disaring.slice(0, batasAwal);
  const sisa = disaring.length - tampil.length;

  return (
    <div>
      <button onClick={() => setBuka((v) => !v)}
        className="mb-2 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-[11.5px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300">
        {buka ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {buka ? 'Sembunyikan daftar' : `Tampilkan daftar (${data.length})`}
        {/* Saat menyaring, DUA angka yang disebut: yang ketemu dan yang ada.
            Satu angka saja ("3 baris") membuat daftar yang sedang disaring
            tidak bisa dibedakan dari daftar yang memang cuma berisi tiga. */}
        <span className="ml-auto angka text-[11px] text-zinc-600">
          {saring ? `${disaring.length} dari ${data.length}` : `${data.length} baris`}
        </span>
      </button>

      {buka && (
        <>
          {adaCari && (
            <div className="relative mb-2.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
              <input
                value={kata}
                onChange={(e) => { setKata(e.target.value); setSemua(false); }}
                placeholder={petunjukCari}
                aria-label={petunjukCari}
                className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-900/60 pl-8 pr-8 text-[12px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600"
              />
              {!!kata && (
                <button onClick={() => setKata('')} aria-label="Hapus pencarian"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {saring && disaring.length === 0 ? (
            /* Kalimatnya menyebut kata yang dicari. "Tidak ada hasil" tanpa
               menyebut apa yang dicari adalah kalimat yang sama untuk salah
               ketik dan untuk orang yang memang belum terdaftar. */
            <p className="py-4 text-center text-[12.5px] text-zinc-600">
              Tidak ada yang cocok dengan “{kata.trim()}”.
            </p>
          ) : (
          <div className="space-y-2.5">
            {tampil.map((b, i) => render(b, i + 1))}
          </div>
          )}

          {sisa > 0 && (
            <button onClick={() => setSemua(true)}
              className="mt-2.5 w-full cursor-pointer rounded-md border border-zinc-800 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
              Tampilkan {sisa} lainnya
            </button>
          )}
          {semua && disaring.length > batasAwal && (
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
