import { useCallback, useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { ambilSentimen, zonaSentimen, type Sentimen } from '@/lib/coin-listing';

/* ════════════════════════════════════════════════════════════════════════
   SENTIMEN PASAR — Fear & Greed
   ════════════════════════════════════════════════════════════════════════
   KONTEKS, BUKAN SINYAL — dan itu ditulis di panelnya sendiri, bukan cuma
   di komentar ini.

   Indeksnya tidak tahu apa pun tentang token presale yang ditunggu di
   halaman ini. Ia mengukur suasana pasar kripto secara keseluruhan, sekali
   sehari. Gunanya muncul justru SESUDAH koinnya listing: hari pertama
   sebuah token adalah hari paling ramai sepanjang umurnya, dan tahu pasar
   sedang serakah atau ketakutan mengubah arti dari angka kelipatan yang
   muncul di kartu-kartu di bawah.

   Yang TIDAK dilakukan panel ini: menyimpulkan. Tidak ada "saatnya jual",
   tidak ada panah hijau yang berarti bagus. Situs ini menandatangani setiap
   suratnya dengan "bukan nasihat investasi"; panel yang diam-diam memberi
   saran membatalkan kalimat itu.
   ════════════════════════════════════════════════════════════════════════ */

/** Busur 3/4 lingkaran. SVG mentah, bukan pustaka grafik: satu angka
 *  dengan satu busur tidak sebanding dengan menyeret Recharts ke potongan
 *  halaman ini — lihat catatan bundel awal di data.ts. */
function Busur({ nilai, warna }: { nilai: number; warna: string }) {
  const R = 52, TEBAL = 9;
  const MULAI = 135, RENTANG = 270;                 // busur terbuka di bawah
  const sudut = (d: number) => (d * Math.PI) / 180;
  const titik = (d: number) => ({
    x: 64 + R * Math.cos(sudut(d)),
    y: 64 + R * Math.sin(sudut(d)),
  });
  const jalur = (dari: number, ke: number) => {
    const a = titik(dari), b = titik(ke);
    return `M ${a.x} ${a.y} A ${R} ${R} 0 ${ke - dari > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
  };
  const akhir = MULAI + (Math.max(0, Math.min(100, nilai)) / 100) * RENTANG;

  return (
    <svg viewBox="0 0 128 128" className="size-[128px] shrink-0" aria-hidden>
      <path d={jalur(MULAI, MULAI + RENTANG)} fill="none" stroke="#27272a"
        strokeWidth={TEBAL} strokeLinecap="round" />
      {akhir > MULAI + 0.5 && (
        <path d={jalur(MULAI, akhir)} fill="none" stroke={warna}
          strokeWidth={TEBAL} strokeLinecap="round" />
      )}
    </svg>
  );
}

/** Garis 30 hari. Tanpa sumbu dan tanpa angka — yang ditanyakan cuma
 *  "arahnya ke mana", dan sumbu untuk pertanyaan itu adalah hiasan. */
function Garis({ data }: { data: { t: number; v: number }[] }) {
  if (data.length < 2) return null;
  const L = 260, T = 40;
  const d = data.map((p, i) => {
    const x = (i / (data.length - 1)) * L;
    const y = T - (Math.max(0, Math.min(100, p.v)) / 100) * T;
    return `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 -2 ${L} ${T + 4}`} preserveAspectRatio="none"
      className="h-10 w-full" aria-hidden>
      {/* Garis netral 50 sebagai acuan diam. Tanpa itu, naik-turunnya
          terbaca relatif terhadap dirinya sendiri saja. */}
      <line x1="0" y1={T / 2} x2={L} y2={T / 2} stroke="#27272a" strokeWidth="1" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke="#71717a" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Banding({ label, nilai, kini }: { label: string; nilai: number | null; kini: number }) {
  if (nilai === null) return null;
  const beda = kini - nilai;
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="text-zinc-500">{label}</span>
      <span className="angka text-zinc-400">
        {nilai}
        <span className={cn('ml-1.5',
          beda > 0 ? 'text-amber-300/80' : beda < 0 ? 'text-sky-300/80' : 'text-zinc-600')}>
          {beda > 0 ? '+' : ''}{beda}
        </span>
      </span>
    </div>
  );
}

export function PanelSentimen() {
  const [s, setS] = useState<Sentimen | null>(null);
  const [muat, setMuat] = useState(true);
  const [gagal, setGagal] = useState(false);

  const tarik = useCallback(async () => {
    setMuat(true);
    const j = await ambilSentimen();
    setS(j); setGagal(!j); setMuat(false);
  }, []);

  useEffect(() => { void tarik(); }, [tarik]);

  const zona = s ? zonaSentimen(s.nilai) : null;

  return (
    <Panel className="mb-4">
      <PanelHead
        judul="Sentimen Pasar"
        sub="Fear & Greed Index — suasana pasar kripto keseluruhan, diperbarui sekali sehari."
        kanan={
          <button onClick={() => void tarik()} aria-label="Segarkan"
            className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
            <RotateCcw className={cn('size-3.5', muat && 'animate-spin')} />
          </button>
        }
      />
      <div className="px-5 pb-5">
        {gagal ? (
          <p className="py-4 text-center text-[12.5px] text-zinc-600">
            Sumber sentimen tidak terjangkau. Tekan segarkan untuk mencoba lagi.
          </p>
        ) : !s ? (
          <div className="h-[128px]" />   /* menahan tinggi supaya tidak melompat */
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="relative shrink-0">
                <Busur nilai={s.nilai} warna={zona!.cincin} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={cn('angka text-[30px] leading-none', zona!.kelas)}>{s.nilai}</div>
                  <div className="mt-1 text-[10.5px] text-zinc-500">dari 100</div>
                </div>
              </div>

              <div className="min-w-[150px] flex-1">
                <div className={cn('text-[15px] font-semibold', zona!.kelas)}>{zona!.nama}</div>
                <p className="mt-0.5 text-[11.5px] text-zinc-600">
                  {s.basi
                    ? 'Angka terakhir yang tersimpan — sumbernya sedang tidak terjangkau.'
                    : `Diperbarui ${new Date(s.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
                </p>
                <div className="mt-3 space-y-1.5">
                  <Banding label="Kemarin" nilai={s.kemarin} kini={s.nilai} />
                  <Banding label="Sepekan lalu" nilai={s.pekanLalu} kini={s.nilai} />
                </div>
              </div>
            </div>

            {s.riwayat.length > 1 && (
              <div className="mt-4">
                <Garis data={s.riwayat} />
                <div className="mt-1 flex justify-between text-[10.5px] text-zinc-600">
                  <span>30 hari lalu</span><span>hari ini</span>
                </div>
              </div>
            )}

            {/* Kalimat ini bagian dari fiturnya, bukan penafian yang
                ditempel belakangan. Angka besar berwarna di layar trading
                akan dibaca sebagai instruksi kalau tidak ada yang bilang
                sebaliknya. */}
            <p className="mt-4 border-t border-zinc-800/60 pt-3 text-[11.5px] leading-relaxed text-zinc-600">
              Angka ini mengukur suasana pasar kripto secara keseluruhan — ia tidak tahu apa pun
              tentang koin yang kamu pantau di bawah. Pakai sebagai latar saat membaca kelipatan
              hari pertama, bukan sebagai aba-aba beli atau jual.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}
