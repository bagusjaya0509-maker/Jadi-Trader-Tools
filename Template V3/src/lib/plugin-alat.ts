import type {
  IChartApi, ISeriesApi, ISeriesPrimitive, Logical, SeriesAttachedParameter, SeriesType, Time,
} from 'lightweight-charts';

/* ════════════════════════════════════════════════════════════════════════
   ALAT GAMBAR CHART — garis tren, ukur %, fibonacci, kotak SNR
   ════════════════════════════════════════════════════════════════════════
   Primitive kanvas kedua di samping penggambar isian Pine. Yang ini milik
   TANGAN orangnya: garis pengukur persentase, fibonacci retracement, dan
   kotak support/resistance yang digambar sendiri.

   Koordinatnya STEMPEL WAKTU, bukan indeks bar. Indeks bergeser setiap
   lilin baru lahir — gambar yang menempel pada indeks akan merayap ke kiri
   satu bar tiap jam. Waktu tidak merayap.

   Waktu di MASA DEPAN (kotak yang ditarik melewati lilin terakhir) tidak
   dikenal skala waktu; posisinya diekstrapolasi lewat sumbu logika dari
   bar terakhir + durasi timeframe.
   ════════════════════════════════════════════════════════════════════════ */

export type JenisAlat = 'ukur' | 'fib' | 'kotak' | 'garis';

export interface GambarAlat {
  id: string;
  jenis: JenisAlat;
  /** Stempel waktu (ms) dan harga kedua ujungnya. */
  t1: number; h1: number;
  t2: number; h2: number;
}

interface MetaAlat { tAkhir: number; tfMs: number; n: number }

interface RuangMedia { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }
interface TargetKanvas { useMediaCoordinateSpace(f: (ruang: RuangMedia) => void): void }

/** Level fibonacci baku — urutan menggambar dari 0 ke 1. */
const LEVEL_FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

function hargaTeks(v: number): string {
  if (!isFinite(v)) return '—';
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (v >= 1) return v.toFixed(2);
  return v.toPrecision(4);
}

export class PenggambarAlat implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private seri: ISeriesApi<SeriesType> | null = null;
  private minta: (() => void) | null = null;
  private gambar: GambarAlat[] = [];
  private pratinjau: Omit<GambarAlat, 'id'> | null = null;
  private pilih: string | null = null;
  private meta: MetaAlat = { tAkhir: 0, tfMs: 3_600_000, n: 0 };

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.seri = p.series;
    this.minta = () => p.requestUpdate();
  }

  detached() { this.chart = null; this.seri = null; this.minta = null; }

  setData(gambar: GambarAlat[], meta: MetaAlat) {
    this.gambar = gambar;
    this.meta = meta;
    this.minta?.();
  }

  setPratinjau(p: Omit<GambarAlat, 'id'> | null) {
    this.pratinjau = p;
    this.minta?.();
  }

  setPilih(id: string | null) {
    this.pilih = id;
    this.minta?.();
  }

  private X(t: number): number | null {
    const c = this.chart;
    if (!c) return null;
    const skala = c.timeScale();
    const x = skala.timeToCoordinate(Math.floor(t / 1000) as Time);
    if (x != null) return x;
    /* Waktu di luar data (masa depan / sebelum jendela) — lewat sumbu
       logika, yang memang tak terbatas. */
    const { tAkhir, tfMs, n } = this.meta;
    if (!n || !tfMs) return null;
    return skala.logicalToCoordinate((n - 1 + (t - tAkhir) / tfMs) as Logical);
  }

  paneViews() {
    return [{
      zOrder: () => 'top' as const,
      renderer: () => ({
        draw: (target: TargetKanvas) => {
          const s = this.seri;
          if (!s || (!this.gambar.length && !this.pratinjau)) return;
          target.useMediaCoordinateSpace(({ context: ctx }) => {
            ctx.font = "10px 'IBM Plex Sans', sans-serif";
            ctx.textBaseline = 'middle';
            const Y = (v: number) => s.priceToCoordinate(v);
            const semua: (GambarAlat | (Omit<GambarAlat, 'id'> & { id?: string }))[] =
              this.pratinjau ? [...this.gambar, this.pratinjau] : this.gambar;

            for (const g of semua) {
              const x1 = this.X(g.t1), x2 = this.X(g.t2);
              const y1 = Y(g.h1), y2 = Y(g.h2);
              if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
              const kiri = Math.min(x1, x2), kanan = Math.max(x1, x2);

              /* Gambar TERPILIH: PEGANGAN BULAT di titik jangkarnya sendiri,
                 tanpa bingkai putus-putus.
                 ────────────────────────────────────────────────────────
                 Bingkai kotak berbohong tentang bentuknya — trendline
                 miring dikurung persegi panjang yang sebagian besar isinya
                 bukan garis itu, dan orang jadi mengira yang terpilih
                 adalah kotaknya. Pegangan di ujung justru menunjukkan dua
                 hal sekaligus: mana yang terpilih, DAN di mana ia bisa
                 ditarik untuk diperpanjang. */
              if ('id' in g && g.id && g.id === this.pilih) {
                const titik: [number, number][] = g.jenis === 'garis'
                  ? [[x1, y1], [x2, y2]]
                  /* Kotak, ukur, fib ditarik dari sudut ke sudut — jadi
                     pegangannya di empat sudut yang benar-benar ada. */
                  : [[x1, y1], [x2, y2], [x1, y2], [x2, y1]];
                ctx.save();
                for (const [hx, hy] of titik) {
                  ctx.beginPath();
                  ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
                  ctx.fillStyle = '#09090b';
                  ctx.fill();
                  ctx.lineWidth = 1.5;
                  ctx.strokeStyle = '#fafafa';
                  ctx.stroke();
                }
                ctx.restore();
              }

              if (g.jenis === 'garis') {
                /* Garis tren: ruas lurus dari titik ke titik, dengan titik
                   kecil di kedua ujung sebagai pegangan visual. Biru muda —
                   warna yang belum dipakai ukur (hijau/merah), fib (emas),
                   maupun kotak (kelabu), jadi trendline langsung dikenali. */
                ctx.strokeStyle = 'rgba(96,165,250,.95)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(96,165,250,.95)';
                for (const [ux, uy] of [[x1, y1], [x2, y2]]) {
                  ctx.beginPath();
                  ctx.arc(ux, uy, 2.2, 0, Math.PI * 2);
                  ctx.fill();
                }
                continue;
              }

              if (g.jenis === 'kotak') {
                const atas = Math.min(y1, y2), bawah = Math.max(y1, y2);
                ctx.fillStyle = 'rgba(148,163,184,.10)';
                ctx.fillRect(kiri, atas, kanan - kiri, bawah - atas);
                ctx.strokeStyle = 'rgba(148,163,184,.45)';
                ctx.lineWidth = 1;
                ctx.strokeRect(kiri, atas, kanan - kiri, bawah - atas);
                continue;
              }

              if (g.jenis === 'ukur') {
                const naik = g.h2 >= g.h1;
                const rgb = naik ? '16,185,129' : '248,113,113';
                const atas = Math.min(y1, y2), bawah = Math.max(y1, y2);
                ctx.fillStyle = `rgba(${rgb},.12)`;
                ctx.fillRect(kiri, atas, kanan - kiri, bawah - atas);
                ctx.strokeStyle = `rgba(${rgb},.6)`;
                ctx.lineWidth = 1;
                ctx.strokeRect(kiri, atas, kanan - kiri, bawah - atas);
                /* Panah arah di tengah — dari harga awal ke harga akhir. */
                const xt = (kiri + kanan) / 2;
                ctx.beginPath();
                ctx.moveTo(xt, y1); ctx.lineTo(xt, y2);
                ctx.stroke();
                /* Mata panah di ujung harga akhir — pangkalnya 5 px di
                   belakang ujung, mengikuti arah gerak. */
                ctx.beginPath();
                ctx.moveTo(xt, y2);
                ctx.lineTo(xt - 3.5, y2 + (naik ? 5 : -5));
                ctx.lineTo(xt + 3.5, y2 + (naik ? 5 : -5));
                ctx.closePath();
                ctx.fillStyle = `rgba(${rgb},.85)`;
                ctx.fill();

                const pct = g.h1 !== 0 ? ((g.h2 - g.h1) / g.h1) * 100 : 0;
                const bar = this.meta.tfMs ? Math.abs(Math.round((g.t2 - g.t1) / this.meta.tfMs)) : 0;
                const teks = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%  ·  ${hargaTeks(Math.abs(g.h2 - g.h1))}  ·  ${bar} bar`;
                const lebarT = ctx.measureText(teks).width;
                const px = xt - lebarT / 2 - 7;
                const py = (naik ? atas : bawah) + (naik ? -20 : 8);
                ctx.fillStyle = `rgba(${rgb},.92)`;
                ctx.beginPath();
                ctx.roundRect(px, py, lebarT + 14, 17, 4);
                ctx.fill();
                ctx.fillStyle = '#09090b';
                ctx.fillText(teks, px + 7, py + 9);
                continue;
              }

              /* fib: level 0 di h1 (awal tarikan), level 1 di h2 (ujung) —
                 orang menarik dari swing awal ke swing akhir, dan level
                 retracement dihitung ke arah tarikan itu. */
              for (const lv of LEVEL_FIB) {
                const harga = g.h1 + (g.h2 - g.h1) * lv;
                const y = Y(harga);
                if (y == null) continue;
                const kuat = lv === 0 || lv === 1;
                const emas = lv === 0.618;
                ctx.strokeStyle = emas ? 'rgba(245,158,11,.75)' : `rgba(212,212,216,${kuat ? '.55' : '.3'})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(kiri, y); ctx.lineTo(kanan, y);
                ctx.stroke();
                ctx.fillStyle = emas ? 'rgba(245,158,11,.9)' : 'rgba(212,212,216,.7)';
                ctx.fillText(`${lv}  ${hargaTeks(harga)}`, kiri + 4, y - 7);
              }
            }
          });
        },
      }),
    }];
  }
}
