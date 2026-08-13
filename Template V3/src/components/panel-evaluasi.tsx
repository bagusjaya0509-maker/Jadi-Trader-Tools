import { useMemo, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Panel, PanelHead } from '@/components/efferd-ui';
import {
  Chart, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/radar-chart';
import { cn } from '@/lib/utils';
import { evaluasi, saring } from '@/lib/evaluasi';
import type { Trade } from '@/data/contoh';

/* ════════════════════════════════════════════════════════════════════════
   PANEL EVALUASI PERFORMA
   ════════════════════════════════════════════════════════════════════════
   Bentuknya mengikuti kartu "Basic Info" yang biasa dipakai statistik game:
   satu angka besar di tengah, jaring laba-laba di kanan, rincian di kiri.
   Alasan bentuk itu dipilih bukan gaya-gayaan — jaring laba-laba memang
   bentuk terbaik untuk membandingkan enam ukuran sekaligus, dan yang ingin
   diketahui memang "sisi mana yang penyok", bukan nilai satu per satu.

   Semua angkanya dihitung dari transaksi jurnal; lihat lib/evaluasi.ts untuk
   alasan tiap ambang.
   ════════════════════════════════════════════════════════════════════════ */

const RENTANG = [
  { hari: 30, label: '30 hari' },
  { hari: 90, label: '90 hari' },
  { hari: 0, label: 'Semua' },
];

/* Nama pendek per sumbu, DIPETAKAN DARI KUNCI — bukan dipotong dari
   labelnya.
   ────────────────────────────────────────────────────────────────────────
   Versi sebelumnya memakai `label.split(' ')[0]`, dan itu menghasilkan dua
   sumbu bernama sama: "Kendali Overtrading" dan "Kendali Emosi" keduanya
   jadi "Kendali". Jaring dengan dua label identik tidak bisa dibaca — tidak
   ada cara tahu penyoknya yang mana. */
const NAMA_SUMBU: Record<string, string> = {
  konsistensi: 'Risiko',
  overtrade: 'Overtrading',
  drawdown: 'Drawdown',
  konsentrasi: 'Sebaran',
  alasan: 'Catatan',
  balas: 'Emosi',
};

function warnaSkor(n: number) {
  if (n >= 80) return '#10b981';
  if (n >= 60) return '#84cc16';
  if (n >= 40) return '#f59e0b';
  return '#ef4444';
}

export function PanelEvaluasi({ trade, saldoAwal }: { trade: Trade[]; saldoAwal: number }) {
  const [hari, setHari] = useState(0);
  const hasil = useMemo(() => evaluasi(saring(trade, hari), saldoAwal), [trade, hari, saldoAwal]);

  const warna = warnaSkor(hasil.skorTotal);
  const dataRadar = hasil.butir.map((b) => ({
    butir: NAMA_SUMBU[b.kunci] ?? b.label,
    skor: Math.round(b.skor),
    lulus: b.lulus,
  }));
  /* Jaringnya PUTIH, tidak ikut warna skor.
     ──────────────────────────────────────────────────────────────────────
     Sebelumnya bentuknya mewarisi warna skor total — merah saat skornya
     rendah. Dua hal jadi salah sekaligus: merah pekat di latar hitam sulit
     dibaca, dan warnanya mengulang informasi yang sudah disampaikan angka
     besar dan keenam bar di sebelahnya. Bentuknya cuma perlu menunjukkan
     BENTUK; keparahannya sudah punya tempatnya sendiri. */
  const konfigRadar = { skor: { label: 'Skor', color: '#fafafa' } } satisfies ChartConfig;

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Evaluasi Performa"
        sub="Ukuran yang dipakai firma evaluasi — dihitung dari jurnalmu sendiri."
        kanan={
          <div className="flex overflow-hidden rounded-md border border-zinc-800">
            {RENTANG.map((r) => (
              <button key={r.hari} onClick={() => setHari(r.hari)}
                className={cn('cursor-pointer px-2.5 py-1 text-[11.5px] transition-colors',
                  hari === r.hari ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200')}>
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {!hasil.cukupData ? (
        <div className="px-5 pb-6 pt-2 text-[12.5px] leading-relaxed text-zinc-500">
          Butuh minimal 5 transaksi untuk dinilai — sekarang ada {hasil.jumlah}.
          {/* Menampilkan nilai dari dua transaksi bukan penilaian, itu kebetulan
              yang diberi angka. Lebih baik diam sampai datanya cukup. */}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Kiri: skor besar + rincian butir */}
          <div>
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div>
                <div className="angka text-[44px] font-semibold leading-none tracking-tight" style={{ color: warna }}>
                  {hasil.skorTotal}
                </div>
                <div className="mt-1 text-[12px] text-zinc-500">dari 100</div>
              </div>
              <div className="mb-1">
                <div className="text-[15px] font-medium text-zinc-100">{hasil.peringkat}</div>
                <div className="text-[12px] text-zinc-500">
                  {hasil.jumlah} transaksi dinilai · {hasil.butir.filter((b) => b.lulus).length}/{hasil.butir.length} kriteria lolos
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {hasil.butir.map((b) => (
                <div key={b.kunci}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12.5px] text-zinc-300">
                      {b.label}
                      <span className="angka ml-2 text-[11px] text-zinc-600">{b.nilaiAsli}</span>
                    </span>
                    <span className={cn('angka text-[12px]', b.lulus ? 'text-emerald-500' : 'text-amber-400')}>
                      {Math.round(b.skor)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full transition-[width] duration-500"
                         style={{ width: `${Math.round(b.skor)}%`, background: warnaSkor(b.skor) }} />
                  </div>
                  <div className="mt-1 text-[11.5px] leading-relaxed text-zinc-600">{b.ket}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Kanan: jaring laba-laba */}
          <div className="flex flex-col items-center justify-center self-start">
            <Chart
              config={konfigRadar}
              className="mx-auto aspect-square max-h-[268px] w-full"
            >
              <RadarChart data={dataRadar} outerRadius="66%" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                {/* cursor={false}: garis penunjuk bawaan Recharts digambar
                    MENIMPA jaringnya, jadi bentuk yang justru sedang dibaca
                    orangnya tertutup tepat saat ia menunjuknya. */}
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent satuan=" / 100" indicator="dot" />}
                />
                <PolarGrid />
                <PolarAngleAxis
                  dataKey="butir"
                  /* Terang = lolos, redup = belum — memakai ambang butir itu
                     sendiri. Ambangnya berbeda-beda (60, 70, drawdown ≤10%,
                     sebaran ≤40%), jadi satu cincin ambang di jaring akan
                     berbohong untuk empat dari enam sumbu.

                     Dibedakan lewat TERANG-REDUP, bukan hijau-amber: yang
                     kedua mengulang warna bar di sebelah kiri, dan dua benda
                     berwarna sama yang menghitung hal berbeda membuat orang
                     mengira keduanya ukuran yang sama. */
                  tick={({ x, y, textAnchor, payload }: any) => {
                    const d = dataRadar.find((v) => v.butir === payload.value);
                    return (
                      <text
                        x={x} y={y} dy={4} textAnchor={textAnchor}
                        fontSize={10.5}
                        fill={d?.lulus ? '#fafafa' : '#71717a'}
                      >
                        {payload.value}
                      </text>
                    );
                  }}
                />
                {/* Skala DIKUNCI 0–100. Tanpa ini Recharts menskalakan ke
                    nilai tertinggi yang kebetulan ada, jadi enam butir yang
                    semuanya buruk tetap menggambar jaring penuh — bentuk
                    yang terlihat sehat justru saat keadaannya paling parah. */}
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickLine={false} />
                {/* Isian saja — tanpa garis tepi, tanpa titik. Garis tepi
                    setebal 1,6 px di sekeliling bentuk yang tiga sumbunya
                    bernilai nol menghasilkan segitiga bergaris tajam yang
                    terbaca sebagai kesalahan gambar, bukan sebagai data. */}
                <Radar
                  dataKey="skor"
                  stroke="none"
                  fill="var(--color-skor)"
                  fillOpacity={0.55}
                  isAnimationActive={false}
                />
              </RadarChart>
            </Chart>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-zinc-50" /> kriteria lolos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-zinc-600" /> belum lolos
              </span>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
