import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, Target, Trophy } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { KalenderPl } from '@/components/kalender-pl';
import { LeaderboardCard } from '@/components/ui/leaderboard-card';
import { cn, uang, persen } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { ambilPerforma, type Performa, type PerformaAnalis } from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   PERFORMA SIGNAL
   ════════════════════════════════════════════════════════════════════════
   Menjawab satu pertanyaan yang selama ini tidak bisa dijawab papan Copy
   Signal: kalau sinyal-sinyal ini benar-benar dijalankan, hasilnya apa.

   SELURUH ANGKANYA TURUNAN, BUKAN KLAIM. Backend menghitungnya dari sinyal
   yang sudah menyentuh SL atau TP menurut lilin sungguhan; tidak ada kolom
   yang bisa diisi analis, dan pemilik pun tidak bisa menyetelnya. Papan
   peringkat yang bisa dikarang sendiri lebih buruk daripada tidak ada —
   ia membuat orang percaya pada angka yang tidak menanggung apa pun.

   ASUMSI ESTIMASI DISEBUT DI LAYAR, bukan disembunyikan di balik satu
   angka besar. Estimasi yang tidak menyatakan asumsinya adalah janji.
   ════════════════════════════════════════════════════════════════════════ */

function Kpi({ label, nilai, warna, ket }: {
  label: string; nilai: string; warna?: string; ket?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/60 p-3">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={cn('angka mt-0.5 text-[17px] font-semibold', warna ?? 'text-zinc-100')}>{nilai}</div>
      {ket && <div className="mt-0.5 text-[10.5px] text-zinc-600">{ket}</div>}
    </div>
  );
}

/** Kartu rekam jejak satu analis. Agen AI ditandai supaya pembaca tahu
 *  angka ini lahir dari mesin yang membaca lilin, bukan dari orang dengan
 *  jurnal — keduanya boleh salah, tapi salahnya berbeda jenis. */
function KartuAnalis({ a, modal, dipilih, onPilih }: {
  a: PerformaAnalis; modal: number; dipilih: boolean; onPilih: () => void;
}) {
  const untung = a.hasilDolar >= 0;
  return (
    <button onClick={onPilih}
      className={cn(
        'w-[300px] shrink-0 cursor-pointer rounded-xl border p-4 text-left transition-colors',
        dipilih ? 'border-zinc-600 bg-zinc-900/70' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700',
      )}>
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-[12px] font-semibold text-zinc-100">
          {(a.nama || '?').trim()[0]?.toUpperCase() ?? '?'}
        </span>
        <span className="min-w-0 grow">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-zinc-100">{a.nama}</span>
            {a.agen && (
              <span className="flex shrink-0 items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-sky-300">
                <Sparkles className="size-2.5" /> AI Agent
              </span>
            )}
          </span>
          <span className="block text-[10.5px] text-zinc-600">
            {a.total} sinyal selesai · {a.menang} menang / {a.kalah} kalah
          </span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Kpi label="Winrate" nilai={persen(a.winrate)}
             warna={a.winrate >= 50 ? 'text-emerald-400' : 'text-zinc-100'} />
        <Kpi label={`Estimasi dari ${uang(modal)}`} nilai={uang(a.hasilDolar, true)}
             warna={untung ? 'text-emerald-400' : 'text-red-400'}
             ket={`jadi ${uang(modal + a.hasilDolar)}`} />
      </div>
    </button>
  );
}

export function PerformaSignal() {
  const { pengguna } = useAuth();
  const [data, setData] = useState<Performa | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [pilih, setPilih] = useState<string>('semua');

  useEffect(() => {
    let hidup = true;
    ambilPerforma()
      .then((d) => { if (hidup) { setData(d); setMemuat(false); } })
      .catch((e) => { if (hidup) { setGalat(e instanceof Error ? e.message : 'Gagal memuat'); setMemuat(false); } });
    return () => { hidup = false; };
  }, []);

  /* Peta kalender mengikuti analis yang dipilih. "Semua" menjumlahkan
     harinya, bukan menampilkan salah satu — hari yang sama bisa berisi
     hasil dari beberapa analis sekaligus. */
  const petaHarian = useMemo(() => {
    const m = new Map<string, number>();
    if (!data) return m;
    const sumber = pilih === 'semua' ? data.analis : data.analis.filter((a) => a.uid === pilih);
    for (const a of sumber) {
      for (const [hari, nilai] of Object.entries(a.harian ?? {})) {
        m.set(hari, (m.get(hari) ?? 0) + nilai);
      }
    }
    return m;
  }, [data, pilih]);

  const peringkat = useMemo(() => (data?.analis ?? []).map((a, i) => ({
    userId: a.uid, rank: i + 1, userName: a.nama, value: a.hasilDolar, agen: a.agen,
    byline: `${persen(a.winrate)} winrate · ${a.total} sinyal`,
  })), [data]);

  if (memuat) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-zinc-500">
        <Loader2 className="size-4 animate-spin" /> Menghitung performa…
      </div>
    );
  }
  if (galat) {
    return <Panel className="px-5 py-10 text-center text-[13px] text-red-400/90">{galat}</Panel>;
  }
  if (!data) return null;

  const total = data.analis.reduce((s, a) => s + a.hasilDolar, 0);
  const totalSinyal = data.analis.reduce((s, a) => s + a.total, 0);
  const totalMenang = data.analis.reduce((s, a) => s + a.menang, 0);

  /* Rentang tanggal papan peringkat diambil dari data, bukan dipatok
     "minggu ini": memberi label rentang yang tidak sesuai isinya membuat
     angkanya salah dibaca. */
  const semuaHari = data.analis.flatMap((a) => Object.keys(a.harian ?? {})).sort();

  return (
    <div className="space-y-4">
      {/* Ringkasan seluruh papan */}
      <Panel>
        <PanelHead
          judul="Performa Signal"
          sub={`Dihitung dari sinyal yang sudah menyentuh SL atau TP. ${data.berjalan} sinyal masih berjalan dan belum ikut dihitung.`}
        />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
          <Kpi label="Sinyal selesai" nilai={String(totalSinyal)} />
          <Kpi label="Menang / kalah" nilai={`${totalMenang} / ${totalSinyal - totalMenang}`} />
          <Kpi label="Winrate gabungan"
               nilai={totalSinyal ? persen((totalMenang / totalSinyal) * 100) : '—'}
               warna={totalSinyal && totalMenang / totalSinyal >= 0.5 ? 'text-emerald-400' : undefined} />
          <Kpi label={`Estimasi dari ${uang(data.modal)}`} nilai={uang(total, true)}
               warna={total >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        </div>

        {/* Asumsinya ditulis, bukan disembunyikan. */}
        <p className="border-t border-zinc-800/60 px-5 py-3 text-[11px] leading-relaxed text-zinc-600">
          <span className="text-zinc-500">Cara estimasi dihitung:</span> modal {uang(data.modal)} dengan
          risiko {data.risikoPersen}% ({uang(data.modal * data.risikoPersen / 100)}) per sinyal. Kena TP
          menambah sebesar imbalan : risiko sinyal itu, kena SL mengurangi satu satuan risiko.
          Biaya, slippage, dan ukuran posisi yang sebenarnya <span className="text-zinc-500">tidak</span> ikut
          dihitung — ini gambaran rekam jejak, bukan hasil trading yang bisa dijanjikan.
        </p>
      </Panel>

      {totalSinyal === 0 ? (
        <Panel className="px-5 py-12 text-center">
          <Target className="mx-auto mb-3 size-6 text-zinc-700" />
          <p className="text-[13px] text-zinc-400">Belum ada sinyal yang selesai.</p>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-[12px] leading-relaxed text-zinc-600">
            Performa baru muncul setelah harga menyentuh SL atau TP sebuah sinyal — bukan setelah
            ada yang memposting. {data.berjalan > 0 && `Sekarang ada ${data.berjalan} sinyal yang masih berjalan.`}
          </p>
        </Panel>
      ) : (
        <>
          {/* Kartu per analis + kalender */}
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Panel className="min-w-0">
              <PanelHead judul="Rekam jejak per analis"
                         sub="Klik kartunya untuk menyaring kalender di sebelah." />
              <div className="flex gap-3 overflow-x-auto px-5 pb-5">
                <button onClick={() => setPilih('semua')}
                  className={cn('w-[150px] shrink-0 cursor-pointer rounded-xl border p-4 text-left transition-colors',
                    pilih === 'semua' ? 'border-zinc-600 bg-zinc-900/70' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700')}>
                  <Trophy className="mb-2 size-4 text-zinc-500" />
                  <div className="text-[13px] font-medium text-zinc-100">Semua analis</div>
                  <div className="angka mt-1 text-[15px] font-semibold text-zinc-200">{uang(total, true)}</div>
                </button>
                {data.analis.map((a) => (
                  <KartuAnalis key={a.uid} a={a} modal={data.modal}
                               dipilih={pilih === a.uid} onPilih={() => setPilih(a.uid)} />
                ))}
              </div>
            </Panel>

            <Panel className="flex min-w-0 flex-col">
              <PanelHead judul="Kalender hasil"
                         sub="Tanggalnya mengikuti kapan harga benar-benar menyentuh SL/TP." />
              <div className="grow px-5 pb-5">
                <KalenderPl pl={petaHarian} satuanNol="Total bulan ini" />
              </div>
            </Panel>
          </div>

          {/* Papan peringkat */}
          <LeaderboardCard
            title="Papan Peringkat Analis"
            fromDate={semuaHari[0]}
            toDate={semuaHari[semuaHari.length - 1]}
            currentUserId={pengguna?.uid}
            podiumRankings={peringkat.slice(0, 3)}
            rankings={peringkat}
            catatan={
              <>
                Diurutkan dari estimasi hasil, bukan dari jumlah pengikut atau
                banyaknya posting. {totalSinyal < 20 && (
                  <span className="text-amber-500/80">
                    Baru {totalSinyal} sinyal yang selesai — terlalu sedikit untuk menyimpulkan
                    siapa yang lebih baik. Urutannya belum berarti apa-apa.
                  </span>
                )}
              </>
            }
          />
        </>
      )}
    </div>
  );
}
