import { useMemo } from 'react';
import { buatLilin } from '@/data/porto';

/* ════════════════════════════════════════════════════════════════════════
   MINI CHART KARTU SINYAL
   ════════════════════════════════════════════════════════════════════════
   Meniru mini chart di Area Pantau versi lama: lilin kecil, zona SNR
   digambar sebagai pita, dan panel SMI tipis di bawahnya.

   Zona digambar sebagai PITA setinggi ±0,5 ATR, bukan garis tunggal. Itu
   bukan hiasan — harga jarang menyentuh angka persis, dan garis tunggal
   membuat sentuhan yang sah terlihat meleset.
   ════════════════════════════════════════════════════════════════════════ */

interface Props {
  seed: number;
  arah: 'BUY' | 'SELL';
  /** Level zona relatif: 0 = dasar chart, 1 = puncak. */
  zonaPada: number;
  smi: number;
}

export function MiniChart({ seed, arah, zonaPada, smi }: Props) {
  const data = useMemo(() => buatLilin(46, 100 + seed * 7), [seed]);

  const W = 300, Hc = 92, Hs = 26, gap = 6;
  const H = Hc + gap + Hs;

  const lo = Math.min(...data.map((d) => d.l));
  const hi = Math.max(...data.map((d) => d.h));
  const bantal = (hi - lo) * 0.12;
  const min = lo - bantal, max = hi + bantal;

  const lebar = W / data.length;
  const badan = Math.max(1.2, lebar * 0.58);
  const Y = (v: number) => (1 - (v - min) / (max - min)) * Hc;
  const X = (i: number) => i * lebar + lebar / 2;

  const yZona = zonaPada * Hc;
  const tinggiZona = Hc * 0.075;
  const resisten = arah === 'SELL';

  // Garis SMI: dipetakan dari -100..100 ke tinggi panel.
  const titikSmi = data.map((_, i) => {
    const v = Math.sin(i / 5.5 + seed) * 62 + (smi / 100) * 34;
    return `${X(i).toFixed(1)},${(Hc + gap + (1 - (v + 100) / 200) * Hs).toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ height: 118 }} aria-hidden>
      {/* Zona SNR */}
      <rect
        x={0} y={yZona - tinggiZona / 2} width={W} height={tinggiZona}
        fill={resisten ? 'rgba(239,68,68,.16)' : 'rgba(16,185,129,.16)'}
      />
      <line
        x1={0} x2={W} y1={yZona} y2={yZona}
        stroke={resisten ? 'rgba(239,68,68,.55)' : 'rgba(16,185,129,.55)'}
        strokeWidth={1} strokeDasharray="3 3"
      />
      <text
        x={4} y={yZona - tinggiZona / 2 - 3}
        fill={resisten ? '#ef4444' : '#10b981'} fontSize={7} fontFamily="IBM Plex Mono"
      >
        {resisten ? 'R1 4H' : 'S1 4H'}
      </text>

      {/* Lilin */}
      {data.map((d, i) => {
        const naik = d.c >= d.o;
        const warna = naik ? '#10b981' : '#ef4444';
        return (
          <g key={i} opacity={0.9}>
            <line x1={X(i)} x2={X(i)} y1={Y(d.h)} y2={Y(d.l)} stroke={warna} strokeWidth={0.7} />
            <rect
              x={X(i) - badan / 2} y={Y(Math.max(d.o, d.c))}
              width={badan} height={Math.max(0.8, Math.abs(Y(d.o) - Y(d.c)))} fill={warna}
            />
          </g>
        );
      })}

      {/* Panel SMI */}
      <line x1={0} x2={W} y1={Hc + gap + Hs / 2} y2={Hc + gap + Hs / 2} stroke="rgba(255,255,255,.07)" strokeWidth={1} />
      <polyline points={titikSmi} fill="none" stroke="#a1a1aa" strokeWidth={1} />
      <text x={4} y={Hc + gap + 8} fill="#52525b" fontSize={7} fontFamily="IBM Plex Mono">SMI</text>
    </svg>
  );
}
