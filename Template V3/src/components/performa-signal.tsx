import { useEffect, useMemo, useRef, useState } from 'react';
import { Ban, ChevronDown, ChevronRight, Eye, Sparkles, Target } from 'lucide-react';
import { KalenderPl } from '@/components/kalender-pl';
import { LeaderboardCard } from '@/components/ui/leaderboard-card';
import { cn, uang, persen, tanggalPendek } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import type { Performa, PerformaAnalis, RingkasAnalisa } from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   PERFORMA SIGNAL — dua bentuk, satu sumber angka
   ════════════════════════════════════════════════════════════════════════
   1. `PapanPeringkatSignal` duduk di ATAS Market Signal. Orang datang ke
      sana untuk mencari sinyal; sekalian di situ ia melihat siapa yang
      rekam jejaknya paling baik, tanpa harus pindah halaman.

   2. `PerformaAnalisSatu` mengisi panel "Lihat Performa Signal" — performa
      sinyal ORANG ITU saja. Yang dinilai pembeli adalah sinyalnya, bukan
      cara ia menjalankan akunnya sendiri: orang bisa saja pandai membaca
      pasar untuk orang lain tapi berantakan mengurus tradingnya sendiri,
      dan portofolio pribadi menjawab pertanyaan yang tidak sedang ditanya.

   SELURUH ANGKANYA TURUNAN, BUKAN KLAIM. Backend menghitungnya dari sinyal
   yang sudah menyentuh SL atau TP menurut lilin sungguhan; tidak ada kolom
   yang bisa diisi analis, dan pemilik pun tidak bisa menyetelnya.

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

/** Kalimat asumsi estimasi. Ditulis sekali, dipakai di kedua tempat —
 *  angka estimasi tidak boleh pernah muncul tanpa kalimat ini. */
function CatatanAsumsi({ modal, risikoPersen }: { modal: number; risikoPersen: number }) {
  return (
    <p className="text-[11px] leading-relaxed text-zinc-600">
      <span className="text-zinc-500">Cara estimasi dihitung:</span> modal {uang(modal)} dengan
      risiko {risikoPersen}% ({uang(modal * risikoPersen / 100)}) per sinyal. Kena TP menambah
      sebesar imbalan : risiko sinyal itu, kena SL mengurangi satu satuan risiko. Biaya,
      slippage, dan ukuran posisi yang sebenarnya <span className="text-zinc-500">tidak</span> ikut
      dihitung — ini gambaran rekam jejak, bukan hasil trading yang bisa dijanjikan.
    </p>
  );
}

/* ── 1. Papan peringkat untuk kepala Market Signal ────────────────────── */

export function PapanPeringkatSignal({ data }: { data: Performa | null }) {
  const { pengguna } = useAuth();
  const [buka, setBuka] = useState(true);

  const peringkat = useMemo(() => (data?.analis ?? []).map((a, i) => ({
    userId: a.uid, rank: i + 1, userName: a.nama, value: a.hasilDolar, agen: a.agen,
    /* Foto ikut dari server dan SUDAH menghormati pilihan anonim analisnya —
       layar ini tidak perlu tahu modenya, cukup: ada foto atau tidak. */
    foto: a.foto,
    byline: `${persen(a.winrate)} winrate · ${a.total} sinyal`,
  })), [data]);

  if (!data) return null;

  /* Cuma totalSinyal yang tersisa — dipakai penjaga "belum ada yang
     selesai", label di tombol lipat, dan catatan kaki papan peringkat.
     Jumlah menang dan estimasi hasil GABUNGAN ikut terbuang bersama empat
     KPI-nya: keduanya tidak dibaca siapa pun lagi. */
  const totalSinyal = data.analis.reduce((s, a) => s + a.total, 0);
  const semuaHari = data.analis.flatMap((a) => Object.keys(a.harian ?? {})).sort();

  /* BELUM ADA YANG SELESAI = satu baris, bukan panel kosong setinggi layar.
     Papan peringkat nol baris di kepala halaman mendorong sinyalnya — yang
     justru dicari orang — turun ke bawah lipatan tanpa memberi apa pun. */
  if (totalSinyal === 0) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-4 py-3">
        <Target className="size-3.5 shrink-0 text-zinc-600" />
        <span className="text-[12px] text-zinc-400">Papan peringkat belum terisi.</span>
        <span className="text-[11.5px] text-zinc-600">
          Peringkat muncul setelah harga menyentuh SL atau TP sebuah sinyal — bukan setelah ada yang
          memposting.{data.berjalan > 0 && ` Sekarang ${data.berjalan} sinyal masih berjalan.`}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <button onClick={() => setBuka((v) => !v)}
        className="mb-2 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-[11.5px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300">
        {buka ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {buka ? 'Sembunyikan papan peringkat' : 'Tampilkan papan peringkat analis'}
        {/* Label contoh WAJIB, dan ditaruh di baris yang sama dengan
            judulnya supaya ikut terbaca walau papannya dilipat. Papan
            peringkat adalah dasar orang memutuskan sinyal siapa yang
            ditiru; angka karangan tanpa label di sini bukan hiasan yang
            keliru, melainkan saran investasi palsu. */}
        {data.contoh && (
          <span className="inline-flex items-center gap-1 rounded bg-sky-500/12 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
            <Eye className="size-2.5" /> data contoh
          </span>
        )}
        <span className="angka ml-auto text-[11px] text-zinc-600">{totalSinyal} sinyal selesai</span>
      </button>

      {data.contoh && buka && (
        <p className="mb-2 px-1 text-[11.5px] leading-relaxed text-sky-200/70">
          Nama dan angka di papan ini <b>bukan analis sungguhan</b> — ia memperlihatkan
          bentuk peringkatnya saja. Rekam jejak yang benar muncul begitu kamu punya akses penuh.
        </p>
      )}

      {/* EMPAT KPI GABUNGAN DIHAPUS — keputusan pemilik 17 Agu 2026.
          ────────────────────────────────────────────────────────────────
          Angkanya adalah penjumlahan SELURUH analis, dan penjumlahan itu
          tidak menjawab pertanyaan yang membawa orang ke halaman ini:
          "sinyal siapa yang layak saya ikuti". Winrate gabungan 0% dari
          satu sinyal milik satu orang terbaca seperti vonis atas seluruh
          fiturnya. Papan peringkat di bawah menjawabnya per analis —
          itulah angka yang bisa ditindaklanjuti.

          Jumlah sinyal selesai TIDAK ikut hilang: ia sudah tertulis di
          ujung kanan tombol lipat di atas ("N sinyal selesai").

          `Kpi` tetap dipakai di kanal per-analis di bawah, jadi
          komponennya tidak ikut dibuang. */}
      {buka && (
        <div className="space-y-3">
          <LeaderboardCard
            /* Bingkai dan latar panelnya dimatikan lewat className, BUKAN
               dengan menyunting components/ui/leaderboard-card.tsx.
               Berkas itu primitif yang dipakai apa adanya; menghapus
               bingkainya di sumber berarti pemakai berikutnya mewarisi
               keputusan tampilan yang cuma berlaku untuk halaman ini.
               `cn` memakai tailwind-merge, jadi border-0 dan bg-transparent
               di sini benar-benar mengalahkan kelas bawaannya. */
            className="border-0 bg-transparent p-0"
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

          <CatatanAsumsi modal={data.modal} risikoPersen={data.risikoPersen} />
        </div>
      )}
    </div>
  );
}

/* ── 2. Performa sinyal SATU analis, untuk panel "Lihat Performa Signal" ───── */

export function PerformaAnalisSatu({ analis, modal, risikoPersen, berjalan, dibatalkan }: {
  analis: PerformaAnalis | null;
  modal: number;
  risikoPersen: number;
  /** Sinyal analis ini yang masih berjalan — bukan angka seluruh papan. */
  berjalan: number;
  /** Sinyal yang ia batalkan, lengkap dengan alasannya. */
  dibatalkan: RingkasAnalisa[];
}) {
  const harian = useMemo(() => {
    const m = new Map<string, number>();
    for (const [hari, nilai] of Object.entries(analis?.harian ?? {})) m.set(hari, nilai);
    return m;
  }, [analis]);

  const selesai = analis?.total ?? 0;
  const untung = (analis?.hasilDolar ?? 0) >= 0;

  return (
    <div className="space-y-3">
      {selesai === 0 ? (
        <div className="rounded-lg border border-zinc-800/60 px-4 py-6 text-center">
          <Target className="mx-auto mb-2.5 size-5 text-zinc-700" />
          <p className="text-[12.5px] text-zinc-400">Belum ada sinyalnya yang selesai.</p>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-[11.5px] leading-relaxed text-zinc-600">
            Performa muncul setelah harga menyentuh SL atau TP — bukan setelah ia memposting.
            {berjalan > 0 && ` Sekarang ${berjalan} sinyalnya masih berjalan.`}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Sinyal selesai" nilai={String(selesai)}
                 ket={berjalan > 0 ? `${berjalan} masih berjalan` : undefined} />
            <Kpi label="Menang / kalah" nilai={`${analis!.menang} / ${analis!.kalah}`} />
            <Kpi label="Winrate" nilai={persen(analis!.winrate)}
                 warna={analis!.winrate >= 50 ? 'text-emerald-400' : 'text-zinc-100'} />
            <Kpi label={`Estimasi dari ${uang(modal)}`} nilai={uang(analis!.hasilDolar, true)}
                 warna={untung ? 'text-emerald-400' : 'text-red-400'}
                 ket={`jadi ${uang(modal + analis!.hasilDolar)}`} />
          </div>

          <KurvaSaldo harian={harian} modal={modal} />

          <div className="rounded-lg border border-zinc-800/60 p-3.5">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[12.5px] text-zinc-300">Kalender hasil</span>
              <span className="text-[10.5px] text-zinc-600">saat harga menyentuh SL/TP</span>
            </div>
            <KalenderPl pl={harian} satuanNol="Total bulan ini" />
          </div>
        </>
      )}

      {/* ── Riwayat pembatalan ────────────────────────────────────────────
          Ikut tampil BERSAMA performanya, bukan di layar terpisah. Analis
          yang menarik sembilan dari sepuluh rencananya punya kebiasaan yang
          berhak diketahui orang yang mengikutinya — dan alasan yang cuma
          tersimpan di server sama saja dengan tidak ada. */}
      {dibatalkan.length > 0 && (
        <div className="rounded-lg border border-zinc-800/60 p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <Ban className="size-3.5 text-zinc-500" />
            <span className="text-[12.5px] text-zinc-300">Sinyal yang dibatalkan</span>
            <span className="angka ml-auto text-[11px] text-zinc-500">{dibatalkan.length}</span>
          </div>
          <p className="mb-2.5 text-[11px] leading-relaxed text-zinc-600">
            Order menunggu yang ditarik sebelum harganya datang. Tidak ikut winrate — tidak ada
            posisi yang pernah jalan — tapi tercatat permanen beserta alasannya.
          </p>
          <div className="space-y-2">
            {dibatalkan.map((s) => (
              <div key={s.id} className="rounded-md border border-zinc-800/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className={cn('text-[10px] font-semibold',
                    s.arah === 'BUY' ? 'text-emerald-400/80' : 'text-red-400/80')}>{s.arah}</span>
                  <span className="angka text-[12px] text-zinc-300">{s.pasangan}</span>
                  {s.jenisEntry && (
                    <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[9.5px] text-zinc-500">
                      {s.jenisEntry}
                    </span>
                  )}
                  <span className="ml-auto text-[10.5px] text-zinc-600">
                    {tanggalPendek(s.waktuHasil || s.dibuat)}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-400">
                  {s.alasanBatal || <span className="text-zinc-600">Tanpa alasan tercatat.</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {selesai > 0 && <CatatanAsumsi modal={modal} risikoPersen={risikoPersen} />}

      {analis?.agen && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-sky-300/70">
          <Sparkles className="mt-0.5 size-3 shrink-0" />
          Sinyal ini disusun agen AI dari data harga publik, bukan orang dengan jurnal trading.
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   KURVA SALDO — bentuk perjalanannya, bukan cuma angka akhirnya
   ════════════════════════════════════════════════════════════════════════
   KPI "Estimasi dari $1.000" sudah menyebut hasil akhirnya, tapi satu angka
   tidak bisa membedakan dua rekam jejak yang sangat berbeda: naik pelan
   dan rata, atau naik tinggi lalu jatuh lalu pulih. Keduanya bisa berakhir
   di angka yang sama, dan yang kedua jauh lebih berat dijalani.

   Kurva ini menjawab itu. Titik mulanya modal utuh, lalu tiap hari yang
   ada hasilnya menggesernya.

   ── DIGAMBAR SVG SENDIRI, BUKAN PUSTAKA GRAFIK ──────────────────────────
   Recharts sudah ada di proyek ini, tapi menariknya ke sini berarti
   menambah ratusan kilobita untuk satu garis polos. Yang dibutuhkan cuma
   satu <polyline> — dan itu tidak butuh pustaka apa pun.

   ── KENAPA LEBARNYA DIUKUR, BUKAN DITULIS TETAP ─────────────────────────
   Versi pertama memakai `viewBox="0 0 300 90"` pada elemen `w-full`, dan
   itu SALAH dengan cara yang tidak kelihatan dari kodenya.

   `preserveAspectRatio` bawaan SVG adalah `xMidYMid meet`: kalau rasio
   viewBox tidak sama dengan rasio elemennya, gambarnya diperkecil sampai
   muat di sisi TERPENDEK lalu ditaruh di TENGAH. Di panel selebar 602 px,
   viewBox 300x90 digambar apa adanya 300 px dan disisakan 151 px kosong di
   kiri DAN kanan — diukur, bukan diperkirakan. Kurvanya cuma memakai 50%
   panel, dan garis putus-putus modal awal berhenti jauh sebelum tepi,
   sehingga ia tidak lagi terbaca sebagai garis patokan.

   Menambahkan `preserveAspectRatio="none"` memang memenuhi lebarnya, tapi
   menariknya mendatar 2x: garis tegak jadi dua kali lebih tebal daripada
   garis mendatar, dan titik bulat di ujung berubah jadi lonjong.

   Jadi lebarnya diukur dan dipakai sebagai satuan gambar. Skalanya 1:1,
   tidak ada yang perlu diregangkan, dan tidak ada yang berubah bentuk.
   ════════════════════════════════════════════════════════════════════════ */
function KurvaSaldo({ harian, modal }: { harian: Map<string, number>; modal: number }) {
  /* ResizeObserver, bukan sekali ukur saat pasang: panel ini hidup di dalam
     modal yang lebarnya ikut lebar jendela, dan pengguna mengubah ukuran
     jendela. Sekali ukur menghasilkan kurva yang benar saat dibuka lalu
     salah selamanya sesudah jendelanya digeser. */
  const kotak = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(0);
  useEffect(() => {
    const el = kotak.current;
    if (!el) return;
    setLebar(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setLebar(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const titik = useMemo(() => {
    /* Diurutkan menurut TANGGAL, bukan urutan penyisipan Map. Kunci Map
       mempertahankan urutan masuk, dan hasil yang dinilai server belakangan
       bisa saja milik hari yang lebih awal — kurva yang mengikuti urutan
       masuk akan menggambar perjalanan yang tidak pernah terjadi. */
    const hari = [...harian.keys()].sort();
    let saldo = modal;
    const keluar = [{ hari: '', saldo }];
    for (const h of hari) {
      saldo += harian.get(h) ?? 0;
      keluar.push({ hari: h, saldo });
    }
    return keluar;
  }, [harian, modal]);

  if (titik.length < 2) return null;

  const nilai = titik.map((t) => t.saldo);
  const atas = Math.max(...nilai, modal);
  const bawah = Math.min(...nilai, modal);
  /* Bantalan supaya garisnya tidak menempel ke tepi kotak. Kalau seluruh
     nilainya sama (belum ada hasil), rentangnya nol dan pembagian di bawah
     menghasilkan NaN — karena itu ada batas bawah 1. */
  const rentang = Math.max(atas - bawah, 1);
  /* L = lebar sesungguhnya panel ini, diukur di atas. T tetap 90 karena
     tingginya memang dipatok `h-[90px]`.

     padX ADA karena titik terakhir adalah lingkaran ber-jari-jari 2,5:
     digambar tepat di x = L ia terpotong separuh oleh tepi SVG. Ini bukan
     soal kerapian — titik ujung itulah yang menandai saldo sekarang, dan
     setengah titik terbaca seperti garisnya berhenti mendadak. */
  const T = 90, padY = 6, padX = 4;
  const L = lebar;

  const x = (i: number) => padX + (i / (titik.length - 1)) * (L - padX * 2);
  const y = (v: number) => padY + (1 - (v - bawah) / rentang) * (T - padY * 2);

  const garis = titik.map((t, i) => `${x(i).toFixed(1)},${y(t.saldo).toFixed(1)}`).join(' ');
  const akhir = nilai[nilai.length - 1];
  const untung = akhir >= modal;
  const warna = untung ? '#34d399' : '#f87171';
  /* Garis modal awal: tanpa patokan ini, kurva yang turun dari $1.000 ke
     $990 terlihat sama saja dengan yang naik dari $980 — mata membaca
     bentuk, bukan sumbu. */
  const yModal = y(modal);

  return (
    <div className="rounded-lg border border-zinc-800/60 p-3.5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[12.5px] text-zinc-300">Perkembangan saldo</span>
        <span className="text-[10.5px] text-zinc-600">estimasi dari {uang(modal)}</span>
      </div>
      {/* Kotak pengukur. Tingginya dipatok supaya tata letaknya tidak
          melompat pada gambar pertama, saat lebarnya belum terukur. */}
      <div ref={kotak} className="h-[90px] w-full">
        {L > 0 && (
          <svg viewBox={`0 0 ${L} ${T}`} width={L} height={T} className="block" role="img"
               aria-label={`Kurva saldo estimasi, dari ${uang(modal)} menjadi ${uang(akhir)}`}>
            {/* Garis patokan menyeberang PENUH, dari tepi ke tepi. Ia
                mewakili "modal awal" — patokan yang berhenti di tengah
                panel berhenti pula jadi patokan. */}
            <line x1="0" x2={L} y1={yModal} y2={yModal} strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            <polyline points={garis} fill="none" stroke={warna} strokeWidth="1.75"
                      strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(titik.length - 1)} cy={y(akhir)} r="2.5" fill={warna} />
          </svg>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between font-mono text-[10.5px]">
        <span className="text-zinc-600">{uang(modal)}</span>
        <span className={untung ? 'text-emerald-400' : 'text-red-400'}>
          {uang(akhir)} ({akhir >= modal ? '+' : ''}{uang(akhir - modal, true)})
        </span>
      </div>
    </div>
  );
}
