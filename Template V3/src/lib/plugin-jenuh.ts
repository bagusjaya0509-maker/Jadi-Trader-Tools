import type {
  IChartApi, ISeriesApi, ISeriesPrimitive, Logical, SeriesAttachedParameter, SeriesType, Time,
} from 'lightweight-charts';

/* ════════════════════════════════════════════════════════════════════════
   PENGGAMBAR WILAYAH JENUH
   ════════════════════════════════════════════════════════════════════════
   Mewarnai HANYA bagian kurva osilator yang melewati ambang — kantong kecil
   antara garis SMI dan garis ambangnya, persis seperti TradingView.

   Ini menggantikan pendekatan pita mendatar yang sempat dipakai: pita
   selebar panel mewarnai seluruh jalur ambang sepanjang waktu, termasuk
   ribuan bar yang tidak pernah jenuh sama sekali. Hasilnya panel yang
   ramai, dan warna yang selalu ada berhenti berarti apa-apa — yang justru
   ingin dilihat adalah SAAT MANA garisnya menembus.

   Titik potongnya DIINTERPOLASI, bukan dipatok ke bar terdekat. Tanpa itu
   tepi kantongnya melangkah seperti tangga di setiap bar masuk dan keluar,
   dan pada timeframe besar satu bar bisa selebar puluhan piksel.
   ════════════════════════════════════════════════════════════════════════ */

export interface WilayahJenuh {
  /** Deret nilai osilator per indeks bar. `null` memutus wilayahnya. */
  nilai: (number | null)[];
  /** Ambang jenuh. Yang diwarnai adalah bagian kurva DI LUAR ambang ini. */
  ambang: number;
  /** 'atas' mewarnai yang melebihi ambang, 'bawah' yang di bawahnya. */
  arah: 'atas' | 'bawah';
  warna: string;
}

interface RuangMedia { context: CanvasRenderingContext2D }
interface TargetKanvas { useMediaCoordinateSpace(f: (ruang: RuangMedia) => void): void }

export class PenggambarJenuh implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private seri: ISeriesApi<SeriesType> | null = null;
  private minta: (() => void) | null = null;
  private wilayah: WilayahJenuh[] = [];

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.seri = p.series;
    this.minta = () => p.requestUpdate();
  }

  detached() { this.chart = null; this.seri = null; this.minta = null; }

  setData(wilayah: WilayahJenuh[]) {
    this.wilayah = wilayah;
    this.minta?.();
  }

  paneViews() {
    return [{
      zOrder: () => 'bottom' as const,
      renderer: () => ({
        draw: (target: TargetKanvas) => {
          const c = this.chart, s = this.seri;
          if (!c || !s || !this.wilayah.length) return;
          const skala = c.timeScale();

          /* Hanya rentang yang tampak. Deret SMI sepanjang 3000 bar dilewati
             ulang tiap kali kanvas digambar — tiap geser, tiap gerak kursor,
             tiap bar replay maju. Yang benar-benar terlihat biasanya delapan
             puluhan bar. Dilonggarkan satu bar di tiap sisi supaya kantong
             yang cuma separuh masuk tetap utuh tepinya. */
          const tampak = skala.getVisibleLogicalRange();

          target.useMediaCoordinateSpace(({ context: ctx }) => {
            const X = (b: number) => skala.logicalToCoordinate(b as Logical);
            const Y = (v: number) => s.priceToCoordinate(v);

            for (const w of this.wilayah) {
              const n = w.nilai.length;
              if (!n) continue;
              const yAmbang = Y(w.ambang);
              if (yAmbang == null) continue;

              const dari = Math.max(0, Math.floor(tampak ? Number(tampak.from) - 1 : 0));
              const sampai = Math.min(n - 1, Math.ceil(tampak ? Number(tampak.to) + 1 : n - 1));
              if (sampai < dari) continue;

              /* Di luar ambang, bukan sekadar tidak sama: nilai yang persis
                 menyentuh ambang bukan jenuh, ia baru sampai di pintunya. */
              const luar = (v: number | null): v is number =>
                v != null && isFinite(v) && (w.arah === 'atas' ? v > w.ambang : v < w.ambang);

              /* Absis titik potong antara bar i dan i+1. Dipakai untuk tepi
                 kiri dan kanan kantong supaya keduanya berhenti tepat di
                 garis ambang, bukan di tengah bar sebelah. */
              const potong = (i: number, j: number): number | null => {
                const a = w.nilai[i], b = w.nilai[j];
                const xa = X(i), xb = X(j);
                if (a == null || b == null || xa == null || xb == null) return null;
                const beda = b - a;
                if (!isFinite(beda) || beda === 0) return xa;
                const t = Math.min(1, Math.max(0, (w.ambang - a) / beda));
                return xa + t * (xb - xa);
              };

              ctx.fillStyle = w.warna;
              let i = dari;
              while (i <= sampai) {
                if (!luar(w.nilai[i])) { i++; continue; }
                let akhir = i;
                while (akhir + 1 <= sampai && luar(w.nilai[akhir + 1])) akhir++;

                /* Tepi kiri: titik potong dengan bar sebelumnya kalau bar itu
                   ada dan berada di sisi lain; kalau tidak, tepat di barnya
                   sendiri — kantong yang mulai di tepi layar memang terpotong
                   di sana. */
                const xKiri = i > 0 && !luar(w.nilai[i - 1]) ? potong(i - 1, i) : X(i);
                const xKanan = akhir + 1 < n && !luar(w.nilai[akhir + 1])
                  ? potong(akhir, akhir + 1) : X(akhir);
                if (xKiri == null || xKanan == null) { i = akhir + 1; continue; }

                ctx.beginPath();
                ctx.moveTo(xKiri, yAmbang);
                let adaTitik = false;
                for (let k = i; k <= akhir; k++) {
                  const v = w.nilai[k];
                  const x = X(k), y = v == null ? null : Y(v);
                  if (x == null || y == null) continue;
                  ctx.lineTo(x, y);
                  adaTitik = true;
                }
                if (adaTitik) {
                  ctx.lineTo(xKanan, yAmbang);
                  ctx.closePath();
                  ctx.fill();
                }
                i = akhir + 1;
              }
            }
          });
        },
      }),
    }];
  }
}
