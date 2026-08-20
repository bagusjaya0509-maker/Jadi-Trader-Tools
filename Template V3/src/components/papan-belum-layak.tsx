import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, Minus, Sparkles, X } from 'lucide-react';
import { cn, persen } from '@/lib/utils';
import type { AturanPapan, PerformaAnalis } from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   BELUM MEMENUHI SYARAT PAPAN — rapor terbuka, bukan catatan kaki
   ════════════════════════════════════════════════════════════════════════
   Sebelumnya satu baris abu-abu: "AI Agent — butuh 5 sinyal selesai bulan
   ini, baru 2." Benar, tapi terbaca sebagai keterangan sistem, bukan
   sebagai penilaian yang bisa diperiksa siapa pun.

   Sekarang tiap syarat punya KOLOMNYA SENDIRI: angka terukur di sebelah
   ambang yang berlaku. Yang gagal diwarnai, yang lolos tetap ditulis.
   Itu bedanya "kamu ditolak" dengan "ini rapormu" — dan papan yang
   menentukan sinyal siapa yang ditiru orang harus bisa memperlihatkan
   rapornya.

   ANGKANYA TIDAK DIHITUNG DI SINI. Semua nilai dan semua ambang datang
   dari server; layar cuma menjodohkan nilai dengan ambangnya untuk
   menentukan warna. `sebabTidakLayak` dicetak apa adanya di bawah tiap
   nama, dan ITU yang berlaku kalau suatu saat keduanya berbeda —
   warnanya hiasan, kalimat itu putusannya.

   DUA BENTUK, SATU DATA. Tabel di layar lebar; kartu di ponsel. Tabel
   enam kolom di 375 px menuntut gulir mendatar, dan yang digulir ke
   samping tidak pernah dibaca. Keduanya membaca `barisAnalis()` yang
   sama, jadi tidak ada versi yang bisa tertinggal sendirian. */

const PER_HALAMAN = 5;

interface Sel {
  nilai: string;
  batas: string;
  /** null = belum ada yang bisa diukur. Sengaja dibedakan dari gagal:
   *  analis tanpa sinyal selesai belum melanggar apa pun. */
  lolos: boolean | null;
  /** Untuk pengurutan. null selalu jatuh ke bawah. */
  urut: number | null;
}

interface Baris {
  uid: string;
  nama: string;
  foto?: string;
  agen: boolean;
  sebab: string;
  sinyal: Sel;
  jarakSl: Sel;
  drawdown: Sel;
  pelanggaran: Sel;
}

function barisAnalis(a: PerformaAnalis, aturan?: AturanPapan): Baris {
  const minSinyal = a.minSinyal ?? aturan?.minSinyal;
  const slBatas = aturan?.slMaksPersen;
  const ddBatas = aturan?.ddMaksPersen;
  const langgar = a.pelanggaran ?? 0;

  return {
    uid: a.uid,
    nama: a.nama,
    foto: a.foto,
    agen: a.agen,
    sebab: (a.sebabTidakLayak ?? []).join('; '),
    sinyal: {
      nilai: String(a.total),
      batas: minSinyal === undefined ? '' : `min ${minSinyal}`,
      lolos: minSinyal === undefined ? null : a.total >= minSinyal,
      urut: a.total,
    },
    jarakSl: {
      /* "Jarak SL", BUKAN "risiko". Sinyal berisi entry/SL/TP dan tidak
         pernah berisi ukuran posisi — persentase modal ditentukan lot yang
         dipakai penirunya. Menyebutnya risiko berarti mengaku mengukur
         sesuatu yang memang tidak kita punya. */
      nilai: persen(a.slMaks),
      batas: slBatas === undefined ? '' : `maks ${slBatas}%`,
      lolos: a.slMaks == null || slBatas === undefined ? null : a.slMaks <= slBatas,
      urut: a.slMaks ?? null,
    },
    drawdown: {
      nilai: persen(a.ddPersen),
      batas: ddBatas === undefined ? '' : `maks ${ddBatas}%`,
      lolos: a.ddPersen === undefined || ddBatas === undefined ? null : a.ddPersen <= ddBatas,
      urut: a.ddPersen ?? null,
    },
    pelanggaran: {
      /* Pelanggaran TIDAK menggugurkan bulan ini — ia menaikkan jumlah
         sinyal yang diminta bulan depan. Ditulis begitu di batasnya supaya
         tidak ada yang mengira ini vonis. */
      nilai: String(langgar),
      batas: langgar > 0 ? 'menambah syarat bulan depan' : 'bersih',
      lolos: langgar === 0,
      urut: langgar,
    },
  };
}

type KunciUrut = 'nama' | 'sinyal' | 'jarakSl' | 'drawdown' | 'pelanggaran';

/** Ikon lolos/gagal. ADA DI SAMPING WARNA, bukan menggantikannya: yang
 *  tidak bisa membedakan merah dari abu — sekitar satu dari dua belas
 *  laki-laki — tetap membaca hasilnya dari bentuk. */
function IkonHasil({ lolos, className }: { lolos: boolean | null; className?: string }) {
  const Ikon = lolos === false ? X : lolos === true ? Check : Minus;
  return (
    <Ikon
      className={cn(
        'shrink-0',
        lolos === false ? 'text-red-400' : lolos === true ? 'text-emerald-500/70' : 'text-zinc-700',
        className,
      )}
      strokeWidth={2.5}
    />
  );
}

interface UrutKini { kunci: KunciUrut; naik: boolean }

function KepalaKolom({ kunci, judul, urut, onUrut }: {
  kunci: KunciUrut; judul: string; urut: UrutKini; onUrut: (k: KunciUrut) => void;
}) {
  const aktif = urut.kunci === kunci;
  return (
    <th className="px-3 py-2 font-medium">
      <button
        onClick={() => onUrut(kunci)}
        aria-sort={aktif ? (urut.naik ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] uppercase tracking-wide transition-colors',
          aktif ? 'text-zinc-300' : 'text-zinc-500 hover:text-zinc-300',
        )}>
        {judul}
        {aktif
          ? (urut.naik ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)
          : <ChevronsUpDown className="size-3 text-zinc-700" />}
      </button>
    </th>
  );
}

function Angka({ s }: { s: Sel }) {
  return (
    <div className="flex items-center gap-1.5">
      <IkonHasil lolos={s.lolos} className="size-3" />
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <span className={cn('angka text-[12.5px] font-medium', s.lolos === false ? 'text-red-300' : 'text-zinc-200')}>
          {s.nilai}
        </span>
        {s.batas && <span className="text-[10.5px] text-zinc-600">{s.batas}</span>}
      </span>
    </div>
  );
}

function Nama({ b }: { b: Baris }) {
  return (
    <div className="flex items-center gap-2.5">
      {b.foto ? (
        <img src={b.foto} alt="" className="size-7 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-medium text-zinc-400">
          {b.nama.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 space-y-px">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] font-medium text-zinc-200">{b.nama}</span>
          {b.agen && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-violet-500/12 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
              <Sparkles className="size-2.5" /> AI Agent
            </span>
          )}
        </div>
        {/* Sebabnya duduk DI BAWAH NAMA, tempat yang di tabel semacam ini
            biasanya diisi surel. Alasannya sama: keterangan yang melekat
            pada orangnya, bukan kolom sendiri yang harus dicari mata. */}
        {b.sebab && (
          <div className="truncate text-[11px] text-zinc-600" title={b.sebab}>
            {b.sebab}
          </div>
        )}
      </div>
    </div>
  );
}

function LencanaStatus() {
  return (
    <span className="inline-flex items-center rounded-md border border-red-500/30 bg-red-500/[0.07] px-2 py-0.5 text-[11px] font-medium text-red-300">
      Belum layak
    </span>
  );
}

export function PapanBelumLayak({ analis, aturan }: { analis: PerformaAnalis[]; aturan?: AturanPapan }) {
  const [urut, setUrut] = useState<UrutKini>({ kunci: 'sinyal', naik: false });
  const [halaman, setHalaman] = useState(0);

  const baris = useMemo(() => analis.map((a) => barisAnalis(a, aturan)), [analis, aturan]);

  const terurut = useMemo(() => {
    const salinan = [...baris];
    salinan.sort((x, y) => {
      if (urut.kunci === 'nama') {
        return urut.naik ? x.nama.localeCompare(y.nama) : y.nama.localeCompare(x.nama);
      }
      /* Yang belum terukur SELALU di bawah, ke arah mana pun urutannya.
         Menaruh "—" di puncak daftar terbaca seperti nilai terbaik. */
      const a = x[urut.kunci].urut;
      const b = y[urut.kunci].urut;
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return urut.naik ? a - b : b - a;
    });
    return salinan;
  }, [baris, urut]);

  const jumlahHalaman = Math.max(1, Math.ceil(terurut.length / PER_HALAMAN));
  const halamanKini = Math.min(halaman, jumlahHalaman - 1);
  const awal = halamanKini * PER_HALAMAN;
  const tampil = terurut.slice(awal, awal + PER_HALAMAN);

  if (analis.length === 0) return null;

  const gantiUrut = (kunci: KunciUrut) => {
    setUrut((p) => (p.kunci === kunci ? { kunci, naik: !p.naik } : { kunci, naik: false }));
    setHalaman(0);
  };

  return (
    <div className="border-y border-zinc-800/60">
      {/* KEPALA PANEL DICABUT — permintaan pemilik. Judul, hitungan, dan
          kalimat pengantarnya hilang; yang tersisa tabelnya sendiri.

          Nama kolom sudah menerangkan apa yang diukur, dan sebab per baris
          tetap tercetak di bawah tiap nama — jadi pertanyaan "kenapa dia
          tidak masuk papan" tetap terjawab di layar tanpa kalimat
          pembukanya. */}
      {/* ── TABEL, layar sedang ke atas ──────────────────────────────── */}
      <div className="hidden sm:block">
        <table className="w-full border-collapse text-left [&_td:first-child]:pl-0 [&_td:last-child]:pr-0 [&_th:first-child]:pl-0 [&_th:last-child]:pr-0">
          <thead>
            <tr className="border-b border-zinc-800/60">
              <KepalaKolom kunci="nama" judul="Analis" urut={urut} onUrut={gantiUrut} />
              <KepalaKolom kunci="sinyal" judul="Sinyal selesai" urut={urut} onUrut={gantiUrut} />
              <KepalaKolom kunci="jarakSl" judul="Jarak SL terjauh" urut={urut} onUrut={gantiUrut} />
              <KepalaKolom kunci="drawdown" judul="Drawdown" urut={urut} onUrut={gantiUrut} />
              <KepalaKolom kunci="pelanggaran" judul="Pelanggaran" urut={urut} onUrut={gantiUrut} />
              <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {tampil.map((b) => (
              <tr key={b.uid} className="transition-colors hover:bg-zinc-900/30">
                <td className="max-w-[260px] px-3 py-2.5"><Nama b={b} /></td>
                <td className="px-3 py-2.5"><Angka s={b.sinyal} /></td>
                <td className="px-3 py-2.5"><Angka s={b.jarakSl} /></td>
                <td className="px-3 py-2.5"><Angka s={b.drawdown} /></td>
                <td className="px-3 py-2.5"><Angka s={b.pelanggaran} /></td>
                <td className="px-3 py-2.5 text-right"><LencanaStatus /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── KARTU, ponsel ────────────────────────────────────────────── */}
      <ul className="divide-y divide-zinc-800/60 sm:hidden">
        {tampil.map((b) => (
          <li key={b.uid} className="py-3">
            <div className="mb-2 flex items-start gap-2">
              <div className="min-w-0 flex-1"><Nama b={b} /></div>
              <LencanaStatus />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {([
                ['Sinyal selesai', b.sinyal],
                ['Jarak SL terjauh', b.jarakSl],
                ['Drawdown', b.drawdown],
                ['Pelanggaran', b.pelanggaran],
              ] as const).map(([judul, s]) => (
                <div key={judul}>
                  <div className="mb-0.5 truncate text-[10px] uppercase tracking-wide text-zinc-500">{judul}</div>
                  <Angka s={s} />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {/* ── Halaman ──────────────────────────────────────────────────────
          Digambar HANYA kalau barisnya memang lebih dari sehalaman.
          Penomoran halaman untuk satu baris adalah kendali yang tidak
          mengendalikan apa pun — dan kendali mati mengajari orang bahwa
          tombol di layar ini boleh diabaikan. */}
      {terurut.length > PER_HALAMAN && (
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/60 py-2">
          <span className="angka text-[11px] text-zinc-600">
            {awal + 1}–{Math.min(awal + PER_HALAMAN, terurut.length)} dari {terurut.length}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setHalaman((p) => Math.max(0, p - 1))}
              disabled={halamanKini === 0}
              aria-label="Halaman sebelumnya"
              className="flex cursor-pointer items-center rounded border border-zinc-800 p-1 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-default disabled:opacity-40 disabled:hover:border-zinc-800">
              <ChevronLeft className="size-3.5" />
            </button>
            {Array.from({ length: jumlahHalaman }, (_, i) => (
              <button
                key={i}
                onClick={() => setHalaman(i)}
                aria-current={i === halamanKini ? 'page' : undefined}
                className={cn(
                  'angka cursor-pointer rounded border px-2 py-0.5 text-[11px] transition-colors',
                  i === halamanKini
                    ? 'border-zinc-700 bg-zinc-800 text-zinc-100'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300',
                )}>
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setHalaman((p) => Math.min(jumlahHalaman - 1, p + 1))}
              disabled={halamanKini >= jumlahHalaman - 1}
              aria-label="Halaman berikutnya"
              className="flex cursor-pointer items-center rounded border border-zinc-800 p-1 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-default disabled:opacity-40 disabled:hover:border-zinc-800">
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
