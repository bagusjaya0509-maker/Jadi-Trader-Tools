import { WeaveSpinner } from '@/components/ui/weave-spinner';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   MEMUAT — satu-satunya keadaan "sedang memuat" di seluruh aplikasi
   ════════════════════════════════════════════════════════════════════════
   Dilaporkan pemilik: "di halaman screener itu kadang posisinya ga sama,
   mungkin pengaruh dari V2."

   Bukan pengaruh V2. Diperiksa, dan yang ditemukan justru empat penempatan
   berbeda yang ditulis terpisah di lima tempat:

     absolute inset-0            ScreenerV2   -> pas di tengah seluruh area
     px-5 pb-10 pt-4             Screener     -> ikut aliran, nempel ke atas
     py-10 + justify-center      Analisa      -> tengah mendatar saja
     py-10 TANPA justify-center  chart-agen,  -> menempel ke KIRI
                                 wallet-agen
     h-40 + justify-center       chart-agen   -> tengah, tapi kotaknya beda

   Di halaman screener dua di antaranya bisa muncul bergantian — loader V3
   dan loader iframe V2 — jadi spinner-nya benar-benar berpindah tempat
   tergantung mana yang sedang tampil. Itu yang terlihat.

   ── KENAPA SATU KOMPONEN, BUKAN SATU KELAS TAILWIND YANG DISALIN ────────
   Kelas yang disalin ke lima berkas akan menyimpang lagi begitu salah satu
   disunting orang yang tidak tahu ada empat kembarannya. Yang memegang
   penempatan harus SATU benda; kalau tidak, "posisinya sama" cuma berlaku
   sampai sunting berikutnya.

   Pemakaian:
     <Memuat />                          di dalam panel biasa
     <Memuat pesan="Memindai 21 koin…" />
     <Memuat className="absolute inset-0" />   kalau induknya sudah relative
   ════════════════════════════════════════════════════════════════════════ */

/** Satu ukuran untuk semua tempat. 0,6 x 160px = 96px — muat di panel
 *  setinggi 160px dengan sisa napas, dan masih terbaca di layar penuh.
 *  Sengaja TANPA prop ukuran: begitu tiap pemanggil boleh memilih
 *  sendiri, ia akan memilih sendiri, dan "sama di mana-mana" selesai. */
const SKALA = 0.6;

export function Memuat({ pesan, className }: {
  /** Kalimat di bawah spinner. Kosongkan kalau konteksnya sudah jelas. */
  pesan?: string;
  /** Hanya untuk PENGURUNGAN — misalnya `absolute inset-0` atau warna latar
   *  panel. Penempatan di dalamnya tidak bisa diubah dari sini, dan memang
   *  itu maksudnya. */
  className?: string;
}) {
  return (
    <div className={cn(
      /* min-h menahan tinggi supaya spinner tidak terjepit jadi garis saat
         induknya kebetulan tidak punya tinggi — keadaan yang sering muncul
         justru pada saat memuat, karena isinya memang belum ada. */
      'flex min-h-[200px] w-full flex-col items-center justify-center gap-3',
      className,
    )}>
      <WeaveSpinner skala={SKALA} />
      {pesan && (
        <p className="px-4 text-center text-[13px] text-zinc-500">{pesan}</p>
      )}
    </div>
  );
}
