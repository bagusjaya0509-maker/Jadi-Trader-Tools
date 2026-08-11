import type {
  IChartApi, ISeriesApi, ISeriesPrimitive, Logical, SeriesAttachedParameter, SeriesType, Time,
} from 'lightweight-charts';

/* ════════════════════════════════════════════════════════════════════════
   PENGGAMBAR ISIAN PINE
   ════════════════════════════════════════════════════════════════════════
   Primitive kanvas untuk dua bentuk yang TIDAK bisa dibuat dari seri garis:

   · KOTAK TERISI  — box.new dengan bgcolor. Sebelumnya cuma tepinya yang
     digambar sebagai dua garis tipis; zona Supply/Demand yang seharusnya
     bidang merah tua malah tampil sebagai sepasang garis pucat yang tidak
     dikenali siapa pun sebagai zonanya sendiri.
   · POLIGON ISIAN — linefill.new di antara dua garis miring: pewarna
     tengah channel paralel.

   Digambar di zOrder 'bottom' — di BAWAH lilin, persis TradingView: zona
   adalah latar, bukan tirai yang menutupi harga.

   Koordinatnya LOGIKA BAR, bukan waktu: logicalToCoordinate menerima indeks
   masa depan (kotak yang menjulur ke kanan melewati lilin terakhir) tanpa
   perlu mengarang stempel waktu untuk bar yang belum lahir.
   ════════════════════════════════════════════════════════════════════════ */

export interface KotakIsi {
  b1: number; b2: number; atas: number; bawah: number;
  isi: string | null; tepi: string | null;
}
export interface PoligonIsi {
  x1: number; ya1: number; yb1: number;
  x2: number; ya2: number; yb2: number;
  warna: string;
}

interface RuangMedia { context: CanvasRenderingContext2D }
interface TargetKanvas { useMediaCoordinateSpace(f: (ruang: RuangMedia) => void): void }

export class PenggambarIsi implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private seri: ISeriesApi<SeriesType> | null = null;
  private minta: (() => void) | null = null;
  private kotak: KotakIsi[] = [];
  private poli: PoligonIsi[] = [];

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.seri = p.series;
    this.minta = () => p.requestUpdate();
  }

  detached() { this.chart = null; this.seri = null; this.minta = null; }

  setData(kotak: KotakIsi[], poli: PoligonIsi[]) {
    this.kotak = kotak;
    this.poli = poli;
    this.minta?.();
  }

  paneViews() {
    return [{
      zOrder: () => 'bottom' as const,
      renderer: () => ({
        draw: (target: TargetKanvas) => {
          const c = this.chart, s = this.seri;
          if (!c || !s || (!this.kotak.length && !this.poli.length)) return;
          const skala = c.timeScale();
          target.useMediaCoordinateSpace(({ context: ctx }) => {
            const X = (b: number) => skala.logicalToCoordinate(b as Logical);
            const Y = (v: number) => s.priceToCoordinate(v);
            for (const k of this.kotak) {
              const x1 = X(k.b1), x2 = X(k.b2), y1 = Y(k.atas), y2 = Y(k.bawah);
              if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
              const kiri = Math.min(x1, x2), puncak = Math.min(y1, y2);
              const lebar = Math.abs(x2 - x1), tinggi = Math.abs(y2 - y1);
              if (k.isi) { ctx.fillStyle = k.isi; ctx.fillRect(kiri, puncak, lebar, tinggi); }
              if (k.tepi) { ctx.strokeStyle = k.tepi; ctx.lineWidth = 1; ctx.strokeRect(kiri, puncak, lebar, tinggi); }
            }
            for (const f of this.poli) {
              const x1 = X(f.x1), x2 = X(f.x2);
              const ya1 = Y(f.ya1), yb1 = Y(f.yb1), ya2 = Y(f.ya2), yb2 = Y(f.yb2);
              if (x1 == null || x2 == null || ya1 == null || yb1 == null || ya2 == null || yb2 == null) continue;
              ctx.fillStyle = f.warna;
              ctx.beginPath();
              ctx.moveTo(x1, ya1);
              ctx.lineTo(x2, ya2);
              ctx.lineTo(x2, yb2);
              ctx.lineTo(x1, yb1);
              ctx.closePath();
              ctx.fill();
            }
          });
        },
      }),
    }];
  }
}
