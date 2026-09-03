import { X } from 'lucide-react';
import { cn, uang, harga as fHarga } from '@/lib/utils';
import { ChartLilin, type GarisHarga, type TampilanChart } from '@/components/chart-lilin';
import type { Lilin } from '@/lib/pasar';
import type { BandingSalinan } from '@/components/panel-posisi-terbuka';

/* ════════════════════════════════════════════════════════════════════════
   CHART DOMPET SUMBER — SEPARUH KIRI AREA CHART
   ════════════════════════════════════════════════════════════════════════
   Menjawab satu pertanyaan yang tidak bisa dijawab tabel: seberapa dekat
   posisi saya dengan posisi dompet yang saya ikuti — DI HARGA, bukan di
   angka.

   ── KENAPA BUKAN DIALOG LAGI ───────────────────────────────────────────
   Versi pertamanya popup berisi dua kolom angka. Itu menjawab "berapa",
   tapi tidak menjawab "di mana": entry yang meleset 2,5% terbaca sebagai
   satu baris teks, padahal yang ingin dilihat orang adalah SEBERAPA JAUH
   garis itu dari garisnya sendiri di lilin yang sama. Diminta pemilik 3 Sep
   2026 dipindah ke chart.

   ── LILINNYA DIPAKAI BERSAMA, TIDAK DITARIK LAGI ───────────────────────
   Chart ini menerima `lilin` yang SAMA dengan chart utama. Bukan
   penghematan kecil: menariknya sendiri berarti dua permintaan untuk
   pasangan yang sama, dua jadwal penyegaran yang tidak pernah tepat
   berbarengan, dan dua chart bersebelahan yang menampilkan lilin terakhir
   berbeda — yang justru terbaca sebagai salah satunya rusak.

   Konsekuensinya tegas dan disengaja: panel ini HANYA benar selama chart
   utama menampilkan pasangan yang sama. Karena itu `onBanding` di halaman
   chart memindahkan simbolnya lebih dulu sebelum membuka panel ini.
   ════════════════════════════════════════════════════════════════════════ */

export function ChartBanding({ banding, lilin, tinggi, tampilan, onTutup }: {
  banding: BandingSalinan;
  lilin: Lilin;
  tinggi: number;
  tampilan?: TampilanChart;
  onTutup: () => void;
}) {
  const s = banding.sumber;
  const h = banding.salinan.hidup;

  /* Garis dompet sumber. Entry SELALU; likuidasi hanya kalau bursanya
     benar-benar melaporkannya — nol di medan itu berarti "tidak ada", dan
     menggambar garis likuidasi di harga nol menempelkannya ke dasar layar
     sebagai janji yang tidak pernah dibuat siapa pun. */
  const garis: GarisHarga[] = [];
  if (s?.entry) {
    garis.push({
      harga: s.entry,
      warna: s.arah === 'LONG' ? 'rgba(16,185,129,.9)' : 'rgba(248,113,113,.9)',
      /* P/L IKUT DI LABEL GARISNYA, bukan di sudut panel. Diminta begitu,
         dan alasannya benar: yang ingin diketahui saat melihat garis entry
         adalah "posisi ini sedang untung atau rugi", dan jawaban yang
         duduk di tempat lain menuntut mata berpindah untuk menyambungkan
         dua hal yang sebenarnya satu. */
      label: `${s.arah} ${uang(s.pnl, true)}`,
    });
  }
  if (s?.likuidasi) {
    garis.push({ harga: s.likuidasi, warna: 'rgba(234,179,8,.75)', label: 'Likuidasi' });
  }

  const marginSumber = s && s.leverage > 0 ? s.nilai / s.leverage : 0;
  const roeSumber = marginSumber > 0 ? (s!.pnl / marginSumber) * 100 : null;
  const roeKita = h?.terbaca && typeof h.roe === 'number' ? h.roe : null;
  const beli = String(banding.salinan.arahSumber || '').toUpperCase() !== 'SHORT';
  const selisih = s && s.entry > 0 && h?.entry
    ? ((h.entry - s.entry) / s.entry) * 100 * (beli ? 1 : -1)
    : null;
  const pst = (n: number | null) => (n === null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-2.5 py-1.5">
        <span className="text-[11.5px] font-medium text-zinc-200">Dompet sumber</span>
        <span className="truncate text-[10.5px] text-zinc-500">{banding.nama}</span>
        <button onClick={onTutup} aria-label="Tutup perbandingan"
                title="Tutup — chart kembali utuh"
                className="ml-auto shrink-0 cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
          <X className="size-3.5" />
        </button>
      </div>

      {!s ? (
        <p className="p-3 text-[11.5px] leading-relaxed text-amber-200/90">
          Posisi di dompet sumber sudah tidak terbaca — kemungkinan ia baru menutupnya.
          Salinan Anda akan ikut ditutup pada putaran berikutnya.
        </p>
      ) : (
        <>
          {/* Chart tanpa hiasan: tanpa panel osilator, tanpa tanda air, tanpa
              alat gambar. Ini bukan chart untuk dikerjakan — ia pembanding,
              dan tiap kendali tambahan di sini mengundang orang mengubah
              sesuatu di chart yang bukan miliknya. */}
          {/* 128 px, DIUKUR di peramban: kepala 31 px + kotak angka 92 px =
              123 px, sisanya jarak. Angka sebelumnya 92 dan itu kurang 31 px
              — baris ROE terpotong keluar dari panel, dan baris yang hilang
              dari kotak berisi empat angka tidak terbaca sebagai "terpotong"
              melainkan sebagai "cuma ada tiga". */}
          <ChartLilin lilin={lilin} tinggi={Math.max(180, tinggi - 128)}
                      garisHarga={garis} tampilan={tampilan} />

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-zinc-800 px-2.5 py-2 text-[10.5px]">
            <span className="text-zinc-500">Entry dompet</span>
            <span className="angka text-right text-zinc-300">{fHarga(s.entry)}</span>
            <span className="text-zinc-500">Entry saya</span>
            <span className="angka text-right text-zinc-300">{h?.entry ? fHarga(h.entry) : '—'}</span>
            <span className="text-zinc-500">Selisih entry</span>
            <span className={cn('angka text-right',
              selisih === null ? 'text-zinc-600' : selisih <= 0 ? 'text-emerald-500' : 'text-red-400')}>
              {pst(selisih)}
            </span>
            <span className="text-zinc-500">ROE dompet / saya</span>
            <span className="angka text-right">
              <span className={cn(roeSumber === null ? 'text-zinc-600' : roeSumber >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {pst(roeSumber)}
              </span>
              <span className="text-zinc-600"> / </span>
              <span className={cn(roeKita === null ? 'text-zinc-600' : roeKita >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {pst(roeKita)}
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
