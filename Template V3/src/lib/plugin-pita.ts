import type {
  ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, SeriesType, Time,
} from 'lightweight-charts';

/* ════════════════════════════════════════════════════════════════════════
   PENGGAMBAR PITA MENDATAR
   ════════════════════════════════════════════════════════════════════════
   Bidang warna selebar panel di antara DUA NILAI pada sumbu harga — bukan
   di antara dua garis miring seperti PenggambarIsi. Ini padanan `fill()`
   antara dua `hline` di Pine, dan itulah bentuk yang dipakai tab Style SMI:
   satu pita redup di antara ambang jenuh, satu gradien hijau di atasnya,
   satu gradien merah di bawahnya.

   Dipisah dari PenggambarIsi, bukan ditumpangkan padanya. PenggambarIsi
   menempel di seri harga di pane 0 dan melayani Pine; kalau bentuk ini
   ikut masuk ke sana, satu kelas dipakai dua pane dengan dua sumbu harga
   yang sama sekali berbeda — dan bug koordinat di salah satunya akan
   muncul di keduanya.

   Koordinat X-nya BUKAN indeks bar: pita ini menyeberangi seluruh lebar
   panel, termasuk ruang kosong di kanan lilin terakhir, persis seperti
   hline. Jadi lebarnya diambil dari kanvasnya sendiri (`mediaSize`), bukan
   dari skala waktu.

   Digambar di zOrder 'bottom' — di BAWAH garis SMI. Pita yang menutupi
   garisnya sendiri akan mengubah warna garis itu, dan warna garis di sini
   adalah cara membedakan SMI dari EMA-nya.
   ════════════════════════════════════════════════════════════════════════ */

export interface Pita {
  /** Nilai batas pada sumbu harga panel. Urutannya bebas. */
  atas: number;
  bawah: number;
  /** Warna di batas `atas` dan di batas `bawah`. Isi dua-duanya sama untuk
   *  pita rata; beda untuk gradien tegak. Terima apa pun yang diterima
   *  kanvas, termasuk rgba dengan alfa nol. */
  warnaAtas: string;
  warnaBawah: string;
}

interface RuangMedia {
  context: CanvasRenderingContext2D;
  mediaSize: { width: number; height: number };
}
interface TargetKanvas { useMediaCoordinateSpace(f: (ruang: RuangMedia) => void): void }

export class PenggambarPita implements ISeriesPrimitive<Time> {
  private seri: ISeriesApi<SeriesType> | null = null;
  private minta: (() => void) | null = null;
  private pita: Pita[] = [];

  attached(p: SeriesAttachedParameter<Time>) {
    this.seri = p.series;
    this.minta = () => p.requestUpdate();
  }

  detached() { this.seri = null; this.minta = null; }

  setData(pita: Pita[]) {
    this.pita = pita;
    this.minta?.();
  }

  paneViews() {
    return [{
      zOrder: () => 'bottom' as const,
      renderer: () => ({
        draw: (target: TargetKanvas) => {
          const s = this.seri;
          if (!s || !this.pita.length) return;
          target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
            for (const p of this.pita) {
              const y1 = s.priceToCoordinate(p.atas);
              const y2 = s.priceToCoordinate(p.bawah);
              /* Nilai di luar rentang yang sedang tampak memulangkan null.
                 Itu wajar — panel SMI menskalakan diri pada data yang
                 terlihat, dan +120 sering berada di luar layar. Pitanya
                 dilewati, bukan dijepit ke tepi: pita yang dijepit akan
                 tampil sebagai garis tebal menempel di sisi panel, dan itu
                 terbaca sebagai level yang tidak pernah kita maksudkan. */
              if (y1 == null || y2 == null) continue;
              const puncak = Math.min(y1, y2), dasar = Math.max(y1, y2);
              const tinggi = dasar - puncak;
              if (tinggi < 0.5) continue;
              if (p.warnaAtas === p.warnaBawah) {
                ctx.fillStyle = p.warnaAtas;
              } else {
                const g = ctx.createLinearGradient(0, puncak, 0, dasar);
                g.addColorStop(0, p.warnaAtas);
                g.addColorStop(1, p.warnaBawah);
                ctx.fillStyle = g;
              }
              ctx.fillRect(0, puncak, mediaSize.width, tinggi);
            }
          });
        },
      }),
    }];
  }
}
