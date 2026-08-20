import { Check, Minus, Sparkles, X } from 'lucide-react';
import { cn, persen } from '@/lib/utils';
import type { AturanPapan, PerformaAnalis } from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   BELUM MEMENUHI SYARAT PAPAN — daftar terbuka, bukan catatan kaki
   ════════════════════════════════════════════════════════════════════════
   Sebelumnya bagian ini satu baris abu-abu: "AI Agent — butuh 5 sinyal
   selesai bulan ini, baru 2." Benar, tapi ia terbaca sebagai keterangan
   sistem, bukan sebagai penilaian yang bisa diperiksa siapa pun.

   Sekarang tiap syarat punya KOLOMNYA SENDIRI dengan angka yang terukur
   di sebelah batas yang berlaku. Yang gagal diwarnai; yang lolos tetap
   ditulis. Itu bedanya "kamu ditolak" dengan "ini rapormu" — dan papan
   peringkat yang menentukan sinyal siapa yang ditiru orang harus bisa
   memperlihatkan rapornya.

   TERBUKA UNTUK SEMUA, termasuk yang belum login. Aturan yang cuma bisa
   dibaca anggota adalah penyaringan diam-diam bagi orang di luar, dan
   yang paling perlu tahu kenapa seseorang tidak muncul justru orang yang
   sedang menimbang apakah papan ini layak dipercaya.

   ANGKANYA TIDAK DIHITUNG DI SINI. Semua nilai dan semua ambang datang
   dari server; layar cuma menjodohkan nilai dengan ambangnya untuk
   menentukan warna. `sebabTidakLayak` tetap dicetak apa adanya di bawah
   tiap baris, dan ITU yang berlaku kalau suatu saat keduanya berbeda —
   warnanya hiasan, kalimat itu putusannya. */

interface Syarat {
  judul: string;
  nilai: string;
  batas: string;
  /** null = belum ada yang bisa diukur. Sengaja dibedakan dari gagal:
   *  analis yang belum punya sinyal selesai belum melanggar apa pun. */
  lolos: boolean | null;
}

function syaratAnalis(a: PerformaAnalis, aturan?: AturanPapan): Syarat[] {
  const minSinyal = a.minSinyal ?? aturan?.minSinyal;
  const slMaksBatas = aturan?.slMaksPersen;
  const ddBatas = aturan?.ddMaksPersen;

  return [
    {
      judul: 'Sinyal selesai',
      nilai: String(a.total),
      batas: minSinyal === undefined ? '' : `min ${minSinyal}`,
      lolos: minSinyal === undefined ? null : a.total >= minSinyal,
    },
    {
      /* Jarak SL, BUKAN "risiko". Sinyal berisi entry/SL/TP dan tidak
         pernah berisi ukuran posisi — persentase modal ditentukan lot yang
         dipakai penirunya. Menyebutnya risiko berarti mengaku mengukur
         sesuatu yang memang tidak kita punya. */
      judul: 'Jarak SL terjauh',
      nilai: persen(a.slMaks),
      batas: slMaksBatas === undefined ? '' : `maks ${slMaksBatas}%`,
      lolos: a.slMaks == null || slMaksBatas === undefined ? null : a.slMaks <= slMaksBatas,
    },
    {
      judul: 'Drawdown',
      nilai: persen(a.ddPersen),
      batas: ddBatas === undefined ? '' : `maks ${ddBatas}%`,
      lolos: a.ddPersen === undefined || ddBatas === undefined ? null : a.ddPersen <= ddBatas,
    },
    {
      /* Pelanggaran TIDAK menggugurkan bulan ini — ia menaikkan jumlah
         sinyal yang diminta bulan depan. Ditulis begitu di batasnya supaya
         tidak ada yang mengira ini vonis. */
      judul: 'Pelanggaran',
      nilai: String(a.pelanggaran ?? 0),
      batas: (a.pelanggaran ?? 0) > 0 ? 'menambah syarat bulan depan' : 'bersih',
      lolos: (a.pelanggaran ?? 0) === 0,
    },
  ];
}

function KotakSyarat({ s }: { s: Syarat }) {
  const Ikon = s.lolos === false ? X : s.lolos === true ? Check : Minus;

  return (
    <div
      className={cn(
        'rounded-md border px-2.5 py-1.5',
        s.lolos === false
          ? 'border-red-500/30 bg-red-500/[0.07]'
          : s.lolos === true
            ? 'border-zinc-800 bg-zinc-900/40'
            : 'border-zinc-800/70 bg-zinc-900/20',
      )}>
      <div className="mb-0.5 flex items-center gap-1">
        <span className="truncate text-[10px] uppercase tracking-wide text-zinc-500">{s.judul}</span>
        {/* Ikon DI SAMPING warna, bukan menggantikannya. Yang tidak bisa
            membedakan merah dari abu — sekitar satu dari dua belas laki-laki —
            tetap membaca lolos atau tidaknya dari bentuk. */}
        <Ikon
          className={cn(
            'ml-auto size-3 shrink-0',
            s.lolos === false ? 'text-red-400' : s.lolos === true ? 'text-emerald-500/70' : 'text-zinc-700',
          )}
          strokeWidth={2.5}
        />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className={cn('angka text-[13px] font-medium', s.lolos === false ? 'text-red-300' : 'text-zinc-200')}>
          {s.nilai}
        </span>
        {s.batas && <span className="text-[10.5px] text-zinc-600">{s.batas}</span>}
      </div>
    </div>
  );
}

export function PapanBelumLayak({ analis, aturan }: { analis: PerformaAnalis[]; aturan?: AturanPapan }) {
  if (analis.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800/60">
      <div className="border-b border-zinc-800/60 bg-zinc-900/30 px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[12px] font-medium text-zinc-300">Belum memenuhi syarat papan</span>
          <span className="angka rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10.5px] text-zinc-400">
            {analis.length}
          </span>
        </div>
        {/* Kalimat ini yang membuat daftarnya terbaca sebagai aturan, bukan
            sebagai kuasa. Tanpa "sama untuk semua" dan "dihitung otomatis",
            analis yang tidak muncul akan menyimpulkan papannya diatur. */}
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          Syaratnya sama untuk semua analis dan dihitung otomatis dari sinyal yang sudah selesai —
          tidak ada satu pun angka di bawah ini yang bisa diisi tangan.
        </p>
      </div>

      <ul className="divide-y divide-zinc-800/60">
        {analis.map((a) => {
          const syarat = syaratAnalis(a, aturan);
          const sebab = a.sebabTidakLayak ?? [];

          return (
            <li key={a.uid} className="px-3 py-3 sm:px-4">
              <div className="mb-2 flex items-center gap-2">
                {a.foto ? (
                  <img src={a.foto} alt="" className="size-6 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400">
                    {a.nama.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="truncate text-[12.5px] font-medium text-zinc-200">{a.nama}</span>
                {a.agen && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-violet-500/12 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                    <Sparkles className="size-2.5" /> AI Agent
                  </span>
                )}
                <span className="ml-auto shrink-0 rounded border border-zinc-700/70 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  Belum masuk papan
                </span>
              </div>

              {/* Dua kolom di ponsel, empat di layar lebar. Bukan tabel: tabel
                  empat kolom di 375 px menuntut gulir mendatar, dan yang
                  digulir ke samping tidak pernah dibaca. */}
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {syarat.map((s) => (
                  <KotakSyarat key={s.judul} s={s} />
                ))}
              </div>

              {sebab.length > 0 && (
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                  {sebab.join('; ')}.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
