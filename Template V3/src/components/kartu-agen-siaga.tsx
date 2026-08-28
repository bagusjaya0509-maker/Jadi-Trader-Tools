import { Sparkles, Radar, Clock } from 'lucide-react';
import { AvatarAnalis } from '@/components/avatar-analis';
import type { AgenHadir } from '@/lib/analisa';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   KARTU AGEN SIAGA — agen yang terdaftar tapi belum memposting
   ════════════════════════════════════════════════════════════════════════
   Agen hanya memposting saat ada setup. Agen tren menunggu tembusan Donchian
   55 bar di 4H, dan itu bisa diam berhari-hari; selama itu ia tidak punya
   satu pun baris di daftar analisa, jadi kartu analis biasa — yang seluruh
   isinya dijahit dari `sinyal[0]` — tidak mungkin dibangun untuknya.

   KOMPONEN TERSENDIRI, bukan kartu analis yang ditambali penjaga di
   mana-mana. Kartu itu membaca nama, foto, winrate, kurva saldo, dan
   rentang tanggal, semuanya dari sinyal pertamanya. Menyisipkan kelompok
   kosong ke sana berarti belasan `?.` baru di jalur yang dipakai SEMUA
   analis — risiko dipikul kartu yang sudah bekerja demi kartu yang belum
   ada isinya.

   YANG DITAMPILKAN CUMA YANG BENAR-BENAR DIKETAHUI: strategi, berapa
   pasangan yang dipindai, dan kapan terakhir memindai. Tidak ada winrate
   nol, tidak ada kurva datar, tidak ada "0%" — angka nol di kartu rekam
   jejak terbaca sebagai kinerja buruk, padahal artinya belum ada apa-apa.
   Itu perbedaan yang mahal kalau salah dibaca calon pembeli.

   `terakhirPindai` ADA GUNANYA DI LUAR HIASAN. Agen dijalankan cron di
   server; cron yang mati tidak mengeluh, ia cuma berhenti. Cap waktu yang
   berhenti bergerak adalah satu-satunya tanda yang terlihat tanpa membuka
   SSH — karena itu ia ditulis apa adanya, dan berubah jadi peringatan
   kuning begitu lewat ambang di bawah.
   ════════════════════════════════════════════════════════════════════════ */

/** Ambang "diam terlalu lama", per timeframe.
 *
 *  Agen 1H dijalankan tiap jam, agen 4H tiap empat jam. Satu ambang tunggal
 *  akan salah untuk salah satunya: cukup longgar untuk 4H berarti agen 1H
 *  bisa mati enam jam tanpa tanda apa pun, dan cukup ketat untuk 1H berarti
 *  agen 4H tampak rusak sepanjang waktu di antara dua pindainya.
 *
 *  Diberi kelonggaran 2,5x jarak jadwalnya — satu pindai terlewat karena
 *  jaringan Binance lambat itu wajar dan tidak perlu diteriakkan. */
function batasDiam(tf: string) {
  const jam = tf === '4h' ? 4 : tf === '1h' ? 1 : tf === '15m' ? 0.25 : 1;
  return jam * 2.5 * 3_600_000;
}

function jedaSingkat(ms: number) {
  const detik = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (detik < 90) return 'baru saja';
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

/** @param keRuang  Kalau ada, KARTUNYA bisa diklik untuk masuk.
 *
 *  Bawaannya tidak ada, dan itu benar untuk hampir semua agen: kartu siaga
 *  berarti agennya belum memposting apa pun, jadi kanalnya benar-benar
 *  kosong — pintu yang membuka ruang kosong cuma memindahkan kekecewaan
 *  satu klik lebih dalam.
 *
 *  Kecualinya kartu yang PUNYA ISI SELAIN SINYAL. Kartu AI Chart begitu:
 *  ia ruang kerja pemiliknya, penuh chart yang menunggu disaring, dan
 *  "belum ada sinyal" justru keadaan normalnya. Tanpa pintu, satu-satunya
 *  jalan ke sana adalah mengetik alamatnya sendiri — dan itu persis yang
 *  dilaporkan sebagai "tidak bisa diklik". */
export function KartuAgenSiaga({ agen, keRuang }: { agen: AgenHadir; keRuang?: () => void }) {
  const diam = Date.now() - agen.terakhirPindai > batasDiam(agen.tf);

  return (
    /* KARTUNYA SENDIRI yang diklik, bukan tombol di dalamnya.
       ──────────────────────────────────────────────────────────────────
       Versi pertama memasang tombol "Buka ruang penyaringan" di kaki
       kartu. Bekerja, tapi salah: kartu ini SUDAH yang paling tinggi di
       raknya (218px lawan 202px milik kartu analis), dan di grid satu
       baris selalu ikut setinggi yang tertinggi — jadi satu tombol di
       sini melarkan SETIAP kartu di barisnya. Keputusan pemilik: cukup
       kartunya yang bisa diklik.

       Aman ditumpuk begitu karena kartu siaga TIDAK menerima klik kanan
       untuk menyemat (hanya kartu analis yang punya), jadi tidak ada dua
       niat yang berebut bidang yang sama.

       role + tabIndex + Enter/Spasi dipasang hanya SAAT bisa diklik: div
       yang tidak melakukan apa-apa tapi mengaku tombol adalah janji palsu
       bagi pembaca layar, dan singgahan tab yang tidak menuju ke mana pun
       cuma memperpanjang jalan orang yang memakai papan ketik. */
    <div onClick={keRuang}
         role={keRuang ? 'button' : undefined}
         tabIndex={keRuang ? 0 : undefined}
         onKeyDown={keRuang ? (e) => {
           if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); keRuang(); }
         } : undefined}
         className={cn('relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40',
           keRuang && 'cursor-pointer transition-colors hover:border-violet-500/40')}>
      {/* Latar sapuan radar, sangat redup. Kartu ini tidak punya kurva saldo
          seperti tetangganya, dan tanpa apa pun di belakangnya ia terbaca
          seperti kartu yang gagal dimuat, bukan kartu yang sedang menunggu. */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 block w-[58%]"
            style={{ background: 'linear-gradient(to left, rgba(167,139,250,0.10), transparent 80%)' }} />

      <div className="relative px-4 pb-4 pt-4">
        <div className="flex items-start gap-2.5">
          <AvatarAnalis nama={agen.nama} foto="" uid={agen.uid}
                        className="size-9" kelasHuruf="text-[13px]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13.5px] font-semibold tracking-tight text-zinc-100">
                {agen.nama}
              </span>
              <span title="Ditulis agen AI, bukan orang"
                    className="inline-flex shrink-0 items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[9.5px] font-medium text-violet-300">
                <Sparkles className="size-2.5" /> AI
              </span>
            </div>
            <span className="block text-[10.5px] text-zinc-500">
              Memantau {agen.pasangan} pasangan · {agen.tf.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Aturannya ditulis terbuka. Agen yang menyembunyikan cara kerjanya
            meminta kepercayaan tanpa memberi apa pun untuk diperiksa — dan
            justru keterbukaan itu yang membedakannya dari sinyal jual-beli
            yang biasa beredar. */}
        <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-400">
          {agen.strategi}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-2.5">
          <span className={cn('inline-flex items-center gap-1.5 text-[11px]',
            diam ? 'text-amber-400' : 'text-emerald-500')}>
            <Radar className={cn('size-3', !diam && 'animate-pulse')} strokeWidth={2} />
            {diam ? 'Pindai tertunda' : 'Siaga'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10.5px] text-zinc-500">
            <Clock className="size-3" strokeWidth={2} />
            Pindai {jedaSingkat(agen.terakhirPindai)}
          </span>
        </div>

        {/* Kalimat penutup menyebut keadaannya apa adanya: belum ada sinyal,
            dan itu memang cara kerjanya. Tanpa kalimat ini kartunya terbaca
            seperti kartu analis yang datanya belum termuat.

            DIPENDEKKAN JADI DUA BARIS, dan itu bukan soal gaya bahasa. Kartu
            ini yang paling tinggi di raknya (218px lawan 202px milik kartu
            analis biasa), dan di grid kartu satu baris selalu ikut setinggi
            yang tertinggi — jadi tiga baris kalimat di sini membuat kartu
            analis di sebelahnya menyisakan sejalur gelap mati di bawah
            isinya. Satu baris yang dihemat di sini menghapus jalur itu di
            semua tetangganya. */}
        <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
          Belum ada sinyal. Diam itu normal — agen memposting hanya saat
          aturannya terpenuhi.
        </p>
      </div>
    </div>
  );
}
