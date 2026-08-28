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

export type JenisAlat = 'ukur' | 'fib' | 'kotak' | 'garis' | 'posisi' | 'rayH';

/** Alat yang bisa DIPEGANG di bilah.

    Alat posisi punya dua tombol — beli dan jual — tapi keduanya
    menghasilkan gambar berjenis 'posisi' yang sama. Yang membedakan cuma
    `arah`-nya, jadi mereka bukan jenis gambar tersendiri: satu jalur
    penggambaran, satu jalur uji-kena, satu jalur seretan. */
export type AlatPegang = Exclude<JenisAlat, 'posisi'> | 'posisiBeli' | 'posisiJual';

export interface GambarAlat {
  id: string;
  jenis: JenisAlat;
  /** Stempel waktu (ms) dan harga kedua ujungnya. */
  t1: number; h1: number;
  t2: number; h2: number;
  /** Harga KETIGA — hanya alat 'posisi' yang memakainya: h1 entry,
      h2 take profit, h3 stop loss.

      Opsional, bukan wajib. Empat alat lama memang cuma punya dua sudut,
      dan gambar yang sudah tersimpan di localStorage orang tidak akan
      pernah membawa medan ini — kalau dijadikan wajib, semua kotak SNR
      dan fibonacci yang sudah ada langsung tidak sah bentuknya. */
  h3?: number;
  /** Arah posisi, hanya untuk jenis 'posisi'. Disimpan, bukan disimpulkan
      dari letak target — lihat alasannya di penggambarnya. */
  arah?: 'beli' | 'jual';
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
          /* `mediaSize` ikut diambil: garis harga menjulur sampai TEPI
             panel, dan tepi itu cuma diketahui dari sini — koordinat
             gambarnya sendiri tidak tahu selebar apa kanvasnya. */
          target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
            ctx.font = "10px 'IBM Plex Sans', sans-serif";
            ctx.textBaseline = 'middle';
            const Y = (v: number) => s.priceToCoordinate(v);

            /* Label bersalut. Teks polos di atas pita tembus pandang hilang
               begitu sebatang lilin lewat di belakangnya — dan angka SL
               yang kadang terbaca kadang tidak lebih buruk daripada tidak
               ada angka sama sekali. */
            const chip = (x: number, y: number, teks: string, rgb: string, rataKanan = false) => {
              const w = ctx.measureText(teks).width;
              const px = rataKanan ? x - w - 14 : x;
              ctx.fillStyle = `rgba(${rgb},.92)`;
              ctx.beginPath();
              ctx.roundRect(px, y - 8.5, w + 14, 17, 4);
              ctx.fill();
              ctx.fillStyle = '#09090b';
              ctx.fillText(teks, px + 7, y);
            };
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
              const terpilih = 'id' in g && !!g.id && g.id === this.pilih;
              if (terpilih) {
                const titik: [number, number][] = g.jenis === 'rayH'
                  /* Satu pegangan saja: garis harga cuma punya SATU titik
                     yang berarti — pangkalnya. Ujung kanannya ditentukan
                     tepi panel, bukan oleh orangnya, jadi pegangan di sana
                     akan menjanjikan tarikan yang tidak ada. */
                  ? [[x1, y1]]
                  : g.jenis === 'garis'
                  ? [[x1, y1], [x2, y2]]
                  : g.jenis === 'posisi'
                    /* Posisi punya TIGA harga dan satu rentang waktu, bukan
                       dua sudut. Pegangan harga duduk di TENGAH garisnya
                       masing-masing, pegangan waktu di kedua ujung garis
                       entry — supaya tidak ada satu titik pun yang berarti
                       dua hal sekaligus. */
                    ? [[kiri, y1], [kanan, y1],
                       [(kiri + kanan) / 2, y2],
                       [(kiri + kanan) / 2, Y(g.h3 ?? g.h1) ?? y1]]
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

              /* ── ALAT POSISI: entry, stop loss, take profit ───────────
                 Tiga harga dalam satu gambar. h1 entry, h2 target, h3 stop.

                 Hijau ke arah target, merah ke arah stop — dua warna yang
                 sudah berarti untung dan rugi di seluruh aplikasi ini, jadi
                 arah risikonya terbaca sebelum angkanya sempat dibaca.

                 Yang membuatnya ALAT, bukan sekadar dua kotak berwarna:
                 rasio imbal-risiko dihitung dari jarak ketiga garisnya
                 sendiri dan ikut berubah tiap kali salah satunya ditarik.
                 Itu pertanyaan yang benar-benar ditanyakan orang sebelum
                 masuk posisi, dan menghitungnya di kepala sambil melihat
                 chart adalah cara paling umum salah hitung. */
              if (g.jenis === 'posisi') {
                const hSl = g.h3 ?? g.h1;
                const y3 = Y(hSl);
                if (y3 == null) continue;
                const lebar = Math.max(kanan - kiri, 1);

                /* TANPA BINGKAI LUAR. Kotak berbingkai penuh punya dua sisi
                   TEGAK yang tidak mewakili apa pun: tidak ada harga di
                   sana, tidak ada yang bisa ditarik di sana. Justru sisi
                   tegak itu yang paling merebut mata, karena dialah satu-
                   satunya garis di alat ini yang memotong lilin. Yang
                   bermakna cuma tiga garis MENDATAR — target, entry, stop —
                   dan dua bidang warna di antaranya. */
                const pita = (yA: number, yB: number, rgb: string) => {
                  ctx.fillStyle = `rgba(${rgb},.13)`;
                  ctx.fillRect(kiri, Math.min(yA, yB), lebar, Math.abs(yB - yA));
                };
                pita(y1, y2, '16,185,129');    // entry → target
                pita(y1, y3, '248,113,113');   // entry → stop

                /* Cuma garis ENTRY yang digambar. Batas atas dan bawah sudah
                   ditandai oleh tepi bidang warnanya sendiri — menggarisi
                   tepi yang memang sudah kelihatan tidak menambah keterangan
                   apa pun, cuma menambah satu garis lagi yang melintasi
                   lilin.

                   Entry beda kedudukannya: ia bukan tepi, ia PERBATASAN
                   antara dua bidang. Tanpa garis, ia cuma tempat dua warna
                   bersentuhan — dan justru harga itu yang paling perlu
                   terbaca persis. */
                ctx.save();
                ctx.setLineDash([4, 3]);
                ctx.strokeStyle = 'rgba(228,228,231,.85)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(kiri, y1); ctx.lineTo(kanan, y1);
                ctx.stroke();
                ctx.restore();

                /* ANGKA HANYA SAAT TERPILIH. Chart yang berisi beberapa
                   setup, masing-masing dengan empat label menempel, berubah
                   jadi dinding angka yang menutupi lilin yang justru mau
                   dibaca. Bidang warnanya sudah cukup untuk tahu ada setup
                   di situ; angkanya baru perlu saat setup itu sedang
                   dikerjakan — dan saat itu ia pasti sedang terpilih.

                   Semua hitungannya ikut masuk ke dalam sini: tidak ada
                   gunanya menghitung rasio imbal-risiko yang tidak akan
                   digambar. */
                if (terpilih) {
                  /* Persen yang ditulis adalah UNTUNG-RUGI di level itu,
                     bukan jarak harga. Pada posisi jual harga naik berarti
                     rugi — menuliskan "+10%" di bidang merah cuma karena
                     stopnya kebetulan di atas entry adalah kalimat yang
                     salah arah, dan justru paling mudah dipercaya orang
                     yang sedang buru-buru menaruh order.

                     Arahnya dari MEDANNYA sendiri, bukan disimpulkan dari
                     letak target. Kalau disimpulkan, menarik target
                     melewati entry akan mengubah posisi beli jadi posisi
                     jual diam-diam — padahal yang sebenarnya terjadi adalah
                     setup beli yang targetnya di bawah entry, yaitu setup
                     rugi. Justru itu yang paling perlu terlihat, bukan
                     disembunyikan dengan membalik artinya.

                     Gambar dari sebelum medan arah ada tidak punya nilai
                     itu; untuk mereka geometri dipakai sebagai tebakan. */
                  const arah = g.arah === 'jual' ? -1 : g.arah === 'beli' ? 1 : g.h2 >= g.h1 ? 1 : -1;
                  const laba = (v: number) => (g.h1 !== 0 ? ((arah * (v - g.h1)) / g.h1) * 100 : 0);
                  const untung = Math.abs(g.h2 - g.h1);
                  const rugi = arah * (g.h1 - hSl);
                  const pT = laba(g.h2), pS = laba(hSl);
                  const tanda = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

                  /* Label duduk DI DALAM bidangnya masing-masing, di sisi
                     garis yang menghadap entry. Ditaruh di luar, TP dan SL
                     saling bertukar tempat begitu arahnya dibalik. */
                  chip(kiri + 4, y2 + (y2 < y1 ? 10 : -10),
                    `TP ${hargaTeks(g.h2)}  ${tanda(pT)}`, '16,185,129');
                  chip(kiri + 4, y3 + (y3 < y1 ? 10 : -10),
                    `SL ${hargaTeks(hSl)}  ${tanda(pS)}`, '248,113,113');
                  chip(kiri + 4, y1, rugi > 0 ? `RR 1:${(untung / rugi).toFixed(2)}` : 'RR —', '228,228,231');
                  chip(kanan - 4, y1, `Entry ${hargaTeks(g.h1)}`, '228,228,231', true);
                }
                continue;
              }

              if (g.jenis === 'rayH') {
                /* GARIS HARGA — menjulur ke KANAN saja, dari titik yang
                   diklik sampai tepi panel.
                   ────────────────────────────────────────────────────────
                   Bukan garis penuh selebar chart: yang ditandai orang
                   adalah level yang berlaku SEJAK saat itu, dan garis yang
                   juga menjulur ke masa lalu mengaku level itu sudah
                   berlaku sebelum ia ada. Model yang sama dengan horizontal
                   ray di TradingView, dan itu memang yang diminta.

                   Angkanya ditulis di UJUNG KANAN, di kolom yang sama
                   dengan sumbu harga — tempat mata sudah terbiasa mencari
                   angka. Ditulis di ujung kiri ia akan menabrak lilin. */
                const y = y1;
                const xMulai = x1;
                const xUjung = mediaSize.width;
                ctx.strokeStyle = 'rgba(250,204,21,.95)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(xMulai, y); ctx.lineTo(xUjung, y);
                ctx.stroke();
                /* Titik pangkal: penanda bahwa garisnya PUNYA awal, dan
                   pegangan yang terlihat untuk menyeretnya. */
                ctx.fillStyle = 'rgba(250,204,21,.95)';
                ctx.beginPath();
                ctx.arc(xMulai, y, 3, 0, Math.PI * 2);
                ctx.fill();

                /* ANGKANYA TIDAK DITULIS DI SINI.
                   ────────────────────────────────────────────────────────
                   Versi pertama mencetaknya sebagai kotak kuning di ujung
                   kanan kanvas. Terbaca, tapi salah tempat: ia mengambang
                   di atas lilin sementara SEMUA angka harga lain di layar
                   ini — harga berjalan, SL, TP, Ask — duduk di dalam kolom
                   sumbu harga. Satu angka yang berdiri di luar barisan
                   memaksa mata mencarinya di tempat yang berbeda tiap kali.

                   Sekarang angkanya ditumpangkan ke sumbu lewat price line
                   ber-`lineVisible: false` di chart-lilin — jadi yang
                   keluar cuma kotak angkanya, di kolom yang sama dengan
                   harga berjalan, sementara garis rayanya tetap digambar di
                   sini. */
                continue;
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
