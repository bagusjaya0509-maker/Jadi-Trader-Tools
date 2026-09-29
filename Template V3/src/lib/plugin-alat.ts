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

/* ── JENIS BARU 29 SEP 2026: bilah gambar ala TradingView ─────────────
   Diminta pemilik: alat gambar di Chart & Entry disamakan dengan bilah
   kiri Hyperliquid (yang sebenarnya TradingView Advanced Charts — library
   berlisensi, jadi tidak bisa diambil; yang dibuat di sini padanannya).

     sinar         ray — dari titik 1 melewati titik 2 sampai tepi panel
     garisPanjang  extended line — menjulur ke dua arah
     garisH        horizontal line — sekali klik, selebar panel
     garisV        vertical line — sekali klik, setinggi panel
     channel       parallel channel — garis dasar + garis sejajar (h3)
     panah         arrow — ruas dengan mata panah di titik 2
     kuas          brush — goresan bebas (`titik`)
     ukurHarga     price range — selisih harga & persen
     ukurWaktu     date range — jumlah bar & durasi

   Gambar lama tidak disentuh: medannya sama, dan jenis lama tetap
   digambar persis seperti sebelumnya. */
export type JenisAlat = 'ukur' | 'fib' | 'kotak' | 'garis' | 'posisi' | 'rayH'
  | 'sinar' | 'garisPanjang' | 'garisH' | 'garisV' | 'channel' | 'panah' | 'kuas'
  | 'ukurHarga' | 'ukurWaktu'
  /* Tahap 2, 29 Sep 2026: fib extension (tiga titik), teks, label harga.
     `zoomArea` BUKAN gambar — cuma rupa kotak pratinjau alat zoom; ia tidak
     pernah disimpan. */
  | 'fibExt' | 'teks' | 'labelHarga' | 'zoomArea';

/** Alat yang bisa DIPEGANG di bilah.

    Alat posisi punya dua tombol — beli dan jual — tapi keduanya
    menghasilkan gambar berjenis 'posisi' yang sama. Yang membedakan cuma
    `arah`-nya, jadi mereka bukan jenis gambar tersendiri: satu jalur
    penggambaran, satu jalur uji-kena, satu jalur seretan. */
export type AlatPegang = Exclude<JenisAlat, 'posisi' | 'zoomArea'> | 'posisiBeli' | 'posisiJual'
  /* Dua alat yang tidak menghasilkan gambar: perbesar area yang ditarik,
     dan kembali ke zoom sebelumnya. */
  | 'zoom' | 'zoomKeluar';

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
  /* Untuk 'channel', `h3` BUKAN harga mutlak melainkan SELISIH harga garis
     sejajar terhadap garis dasar. Selisih, supaya menarik salah satu ujung
     garis dasar tidak mengubah lebar channel-nya — lebar itulah yang
     sengaja ditentukan orangnya. */
  /** Goresan, hanya untuk 'kuas': pasangan [waktu ms, harga]. t1/h1 dan
      t2/h2 tetap diisi titik pertama & terakhir supaya semua jalur yang
      memeriksa kedua ujung tetap bekerja tanpa cabang khusus. */
  titik?: [number, number][];
  /** Waktu titik KETIGA — hanya 'fibExt' (titik C; harganya di `h3`). */
  t3?: number;
  /** Isi tulisan — hanya 'teks'. */
  teks?: string;
}

interface MetaAlat { tAkhir: number; tfMs: number; n: number }

interface RuangMedia { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }
interface TargetKanvas { useMediaCoordinateSpace(f: (ruang: RuangMedia) => void): void }

/** Level fibonacci baku — urutan menggambar dari 0 ke 1. */
const LEVEL_FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

const BIRU = 'rgba(96,165,250,.95)';
/** Level fib extension (trend-based) — dihitung dari titik C sejauh
 *  kelipatan jarak A→B. */
const LEVEL_FIB_EXT = [0, 0.382, 0.618, 1, 1.272, 1.618, 2, 2.618];

/* ── UKURAN KOTAK TEKS ──────────────────────────────────────────────────
   Satu pengukur untuk penggambar DAN uji-kena di chart-lilin: kotak yang
   digambar dan kotak yang bisa diklik harus kotak yang sama persis. Kanvas
   pengukurnya dibuat sekali. */
export const HURUF_TEKS = "12.5px 'IBM Plex Sans', sans-serif";
let pengukur: CanvasRenderingContext2D | null = null;
export function ukurTeks(teks: string): { w: number; h: number; baris: string[] } {
  const baris = (teks || ' ').split('\n');
  if (!pengukur && typeof document !== 'undefined') pengukur = document.createElement('canvas').getContext('2d');
  let w = 0;
  if (pengukur) {
    pengukur.font = HURUF_TEKS;
    for (const b of baris) w = Math.max(w, pengukur.measureText(b).width);
  } else w = Math.max(...baris.map((b) => b.length)) * 7;
  return { w: Math.ceil(w) + 14, h: baris.length * 16 + 8, baris };
}
const KUNING = 'rgba(250,204,21,.95)';

/** Potongan garis TAK BERUJUNG melalui (x1,y1)-(x2,y2) dengan persegi
 *  0..w × 0..h (Liang–Barsky), sebagai parameter t: 0 = titik 1, 1 = titik
 *  2. null kalau garisnya tidak melewati persegi, atau kedua titiknya sama.
 *  Dipakai sinar & garis panjang, yang ujungnya ditentukan tepi panel. */
export function potongGaris(
  x1: number, y1: number, x2: number, y2: number, w: number, h: number,
): { t0: number; t1: number } | null {
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return null;
  let t0 = -Infinity, t1 = Infinity;
  const p = [-dx, dx, -dy, dy];
  const q = [x1, w - x1, y1, h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
  }
  return t0 <= t1 ? { t0, t1 } : null;
}

/** Jarak titik (px,py) ke garis (x1,y1)-(x2,y2) dengan parameter dibatasi
 *  [tMin, tMax]: [0,1] ruas, [0,∞) sinar, (-∞,∞) garis penuh. Satu rumus
 *  untuk uji-kena dan untuk memutuskan seretan — kalau dua tempat menulis
 *  rumusnya sendiri, garis yang bisa diklik dan garis yang bisa diseret
 *  pelan-pelan jadi dua garis yang berbeda. */
export function jarakKeGaris(
  px: number, py: number, x1: number, y1: number, x2: number, y2: number,
  tMin = 0, tMax = 1,
): number {
  const dx = x2 - x1, dy = y2 - y1;
  const pj = dx * dx + dy * dy;
  if (!pj) return Math.hypot(px - x1, py - y1);
  const t = Math.max(tMin, Math.min(tMax, ((px - x1) * dx + (py - y1) * dy) / pj));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Lama waktu untuk label rentang waktu: "3 hari 4 jam", "4 jam 20 mnt". */
function durasiTeks(ms: number): string {
  const mnt = Math.round(ms / 60_000);
  const hari = Math.floor(mnt / 1440), jam = Math.floor((mnt % 1440) / 60), m = mnt % 60;
  if (hari) return jam ? `${hari} hari ${jam} jam` : `${hari} hari`;
  if (jam) return m ? `${jam} jam ${m} mnt` : `${jam} jam`;
  return `${m} mnt`;
}

/** Selisih garis sejajar channel; 0 untuk gambar tanpa medan itu. */
function d3OR(g: { h3?: number }): number { return g.h3 ?? 0; }

function waktuTeks(t: number): string {
  return new Date(t).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

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

  /* ── WAKTU -> KOORDINAT X ──────────────────────────────────────────────
     Tiga tingkat, dari yang paling bisa dipercaya ke yang paling terakhir.

     ── KENAPA TIDAK CUKUP timeToCoordinate ───────────────────────────────
     Ia cuma menjawab untuk waktu yang PERSIS jatuh di sebuah bar. Gambar
     disimpan sebagai stempel waktu mutlak dan hampir tidak pernah jatuh
     tepat di batas bar timeframe lain — trendline yang ditarik di 1 jam
     dibuka di 4 jam, stempelnya di menit ke-60 sementara bar 4 jam mulai
     tiap 4 jam. Jadi untuk gambar lintas timeframe, jawabannya hampir
     selalu null dan cadangannyalah yang benar-benar dipakai.

     ── KENAPA CADANGAN LAMA DIGANTI ──────────────────────────────────────
     Sebelumnya cadangannya `logicalToCoordinate(n - 1 + (t - tAkhir)/tfMs)`.
     Hitungannya benar di atas kertas — diperiksa pada kasus yang dilaporkan
     (USELESSUSDT 4 jam, garis 02 Sep 09:00 -> 06 Sep 17:00, n=1000,
     tfMs=4 jam): indeks logikanya 981 dan 1007, dua-duanya di tepi KANAN.
     Yang tergambar justru garis tegak menempel di tepi KIRI.

     Jadi yang meleset bukan aritmetikanya melainkan sumbu logikanya, dan
     tingkat kedua ini tidak lagi bergantung padanya: ia berangkat dari
     koordinat SEBUAH BAR SUNGGUHAN — yang sudah pasti benar karena
     digambar chart itu sendiri — lalu bergeser sejauh `barSpacing` per
     bar. Dua besaran yang dua-duanya milik chart, bukan turunan.

     Tingkat ketiga (sumbu logika) dibiarkan sebagai jaring terakhir: kalau
     bar terakhirnya sendiri tidak punya koordinat, tidak ada jangkar untuk
     dipakai, dan jawaban lama masih lebih baik daripada tidak menggambar. */
  private X(t: number): number | null {
    const c = this.chart;
    if (!c) return null;
    const skala = c.timeScale();
    const x = skala.timeToCoordinate(Math.floor(t / 1000) as Time);
    if (x != null) return x;

    const { tAkhir, tfMs, n } = this.meta;
    if (!n || !tfMs || !tAkhir) return null;

    const xAkhir = skala.timeToCoordinate(Math.floor(tAkhir / 1000) as Time);
    const lebarBar = skala.options().barSpacing;
    if (xAkhir != null && lebarBar > 0) {
      return xAkhir + ((t - tAkhir) / tfMs) * lebarBar;
    }
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
                const d3 = g.h3 ?? 0;
                const titik: [number, number][] = g.jenis === 'kuas'
                  /* Goresan bebas tidak punya jangkar yang berarti untuk
                     ditarik — ia cuma bisa digeser utuh. Tandanya dibuat di
                     goresannya sendiri (lihat cabang 'kuas'). */
                  ? []
                  : g.jenis === 'rayH' || g.jenis === 'garisH' || g.jenis === 'garisV' || g.jenis === 'labelHarga'
                  /* Satu pegangan saja: garis harga cuma punya SATU titik
                     yang berarti — pangkalnya. Ujung kanannya ditentukan
                     tepi panel, bukan oleh orangnya, jadi pegangan di sana
                     akan menjanjikan tarikan yang tidak ada. */
                  ? [[x1, y1]]
                  : g.jenis === 'garis' || g.jenis === 'sinar' || g.jenis === 'garisPanjang' || g.jenis === 'panah'
                  ? [[x1, y1], [x2, y2]]
                  : g.jenis === 'fibExt'
                    ? ([[x1, y1], [x2, y2]] as [number, number][]).concat(
                        g.t3 != null && g.h3 != null && this.X(g.t3) != null && Y(g.h3) != null
                          ? [[this.X(g.t3) as number, Y(g.h3) as number]] : [])
                  : g.jenis === 'teks'
                    /* Teks tidak diberi pegangan: ia digeser utuh, dan kotaknya
                       sendiri yang menandai terpilih (lihat cabang 'teks'). */
                    ? []
                  : g.jenis === 'channel'
                    /* Dua ujung garis dasar, dan satu pegangan LEBAR di
                       tengah garis sejajarnya. */
                    ? [[x1, y1], [x2, y2],
                       [(x1 + x2) / 2, ((Y(g.h1 + d3) ?? y1) + (Y(g.h2 + d3) ?? y2)) / 2]]
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

              /* Label bersalut yang TENGAHNYA di (x, y). */
              const chipTengah = (x: number, y: number, teks: string, rgb: string) => {
                const w = ctx.measureText(teks).width;
                chip(x - (w + 14) / 2, y, teks, rgb);
              };

              /* ── FIB EXTENSION (trend-based) ───────────────────────────
                 Tiga titik: A→B adalah gelombang yang diukur, C tempat
                 koreksinya berakhir. Level = C + (B − A) × rasio. Garis
                 putus-putus A→B→C selalu digambar — tanpa itu, dua level
                 yang mirip dari dua tarikan berbeda tidak bisa dibedakan
                 asal-usulnya. Selama C belum ditaruh, cuma A→B yang tampak. */
              if (g.jenis === 'fibExt') {
                const xC = g.t3 != null ? this.X(g.t3) : null;
                const yC = g.h3 != null ? Y(g.h3) : null;
                ctx.save();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = 'rgba(212,212,216,.55)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                if (xC != null && yC != null) ctx.lineTo(xC, yC);
                ctx.stroke();
                ctx.restore();
                if (xC == null || yC == null || g.h3 == null) continue;
                const panjang = Math.max(80, Math.abs(x2 - x1));
                for (const lv of LEVEL_FIB_EXT) {
                  const harga = g.h3 + (g.h2 - g.h1) * lv;
                  const y = Y(harga);
                  if (y == null) continue;
                  const emas = lv === 1.618, kuat = lv === 0 || lv === 1;
                  ctx.strokeStyle = emas ? 'rgba(245,158,11,.75)' : `rgba(212,212,216,${kuat ? '.55' : '.3'})`;
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(xC, y); ctx.lineTo(xC + panjang, y);
                  ctx.stroke();
                  ctx.fillStyle = emas ? 'rgba(245,158,11,.9)' : 'rgba(212,212,216,.7)';
                  ctx.fillText(`${lv}  ${hargaTeks(harga)}`, xC + 4, y - 7);
                }
                continue;
              }

              /* ── TEKS ──────────────────────────────────────────────────
                 Titik yang diklik adalah pojok KIRI-ATAS kotaknya: tempat
                 tulisannya mulai, sama seperti mengetik di mana pun. Latar
                 gelap setengah tembus supaya terbaca di atas lilin. */
              if (g.jenis === 'teks') {
                const u = ukurTeks(g.teks ?? '');
                ctx.save();
                ctx.font = HURUF_TEKS;
                ctx.fillStyle = 'rgba(9,9,11,.72)';
                ctx.beginPath();
                ctx.roundRect(x1, y1, u.w, u.h, 4);
                ctx.fill();
                if (terpilih) {
                  ctx.strokeStyle = 'rgba(250,250,250,.7)';
                  ctx.lineWidth = 1;
                  ctx.setLineDash([3, 3]);
                  ctx.stroke();
                }
                ctx.fillStyle = 'rgba(244,244,245,.96)';
                ctx.textBaseline = 'top';
                u.baris.forEach((b, i) => ctx.fillText(b, x1 + 7, y1 + 5 + i * 16));
                ctx.restore();
                continue;
              }

              /* ── LABEL HARGA ───────────────────────────────────────────
                 Titik di harga yang diklik, garis pendek ke kanan-atas, dan
                 kotak berisi angkanya — menandai SATU harga di SATU saat,
                 beda dengan garis harga yang menjulur. */
              if (g.jenis === 'labelHarga') {
                const teks = hargaTeks(g.h1);
                const w = ctx.measureText(teks).width + 14;
                ctx.strokeStyle = 'rgba(250,204,21,.9)';
                ctx.fillStyle = 'rgba(250,204,21,.95)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x1, y1, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x1, y1); ctx.lineTo(x1 + 10, y1 - 12);
                ctx.stroke();
                ctx.beginPath();
                ctx.roundRect(x1 + 10, y1 - 29, w, 17, 4);
                ctx.fill();
                ctx.fillStyle = '#09090b';
                ctx.fillText(teks, x1 + 17, y1 - 20.5);
                continue;
              }

              /* Pratinjau alat ZOOM — kotak putus-putus, tidak pernah disimpan. */
              if (g.jenis === 'zoomArea') {
                ctx.save();
                ctx.fillStyle = 'rgba(148,163,184,.10)';
                ctx.fillRect(kiri, 0, kanan - kiri, mediaSize.height);
                ctx.setLineDash([4, 3]);
                ctx.strokeStyle = 'rgba(148,163,184,.7)';
                ctx.lineWidth = 1;
                ctx.strokeRect(kiri + 0.5, 0.5, kanan - kiri - 1, mediaSize.height - 1);
                ctx.restore();
                continue;
              }

              /* ── SINAR & GARIS PANJANG ─────────────────────────────────
                 Ujungnya ditentukan TEPI PANEL, bukan titik kedua: sinar
                 menjulur dari titik 1 melewati titik 2, garis panjang ke
                 dua arah. Dipotong ke persegi panel supaya kanvas tidak
                 diminta menggambar ribuan piksel di luar layar. */
              if (g.jenis === 'sinar' || g.jenis === 'garisPanjang') {
                const r = potongGaris(x1, y1, x2, y2, mediaSize.width, mediaSize.height);
                if (r) {
                  const tA = g.jenis === 'sinar' ? Math.max(0, r.t0) : r.t0;
                  if (r.t1 > tA) {
                    const dx = x2 - x1, dy = y2 - y1;
                    ctx.strokeStyle = BIRU;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(x1 + tA * dx, y1 + tA * dy);
                    ctx.lineTo(x1 + r.t1 * dx, y1 + r.t1 * dy);
                    ctx.stroke();
                  }
                }
                ctx.fillStyle = BIRU;
                for (const [ux, uy] of [[x1, y1], [x2, y2]]) {
                  ctx.beginPath();
                  ctx.arc(ux, uy, 2.2, 0, Math.PI * 2);
                  ctx.fill();
                }
                continue;
              }

              /* GARIS HORIZONTAL — selebar panel, ke masa lalu juga. Beda
                 dengan garis harga (rayH) yang mulai dari titik klik. Warna
                 kuning yang sama: dua-duanya "level harga". Angkanya
                 menumpang sumbu harga lewat price line di chart-lilin. */
              if (g.jenis === 'garisH') {
                ctx.strokeStyle = KUNING;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(0, y1); ctx.lineTo(mediaSize.width, y1);
                ctx.stroke();
                continue;
              }

              /* GARIS VERTIKAL — menandai satu saat. Tanggalnya ditulis di
                 kaki panel hanya saat terpilih, alasan yang sama dengan
                 angka alat posisi: chart berisi beberapa garis tegak yang
                 masing-masing berlabel jadi pagar teks. */
              if (g.jenis === 'garisV') {
                ctx.strokeStyle = BIRU;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x1, 0); ctx.lineTo(x1, mediaSize.height);
                ctx.stroke();
                if (terpilih) chipTengah(x1, mediaSize.height - 14, waktuTeks(g.t1), '96,165,250');
                continue;
              }

              /* CHANNEL SEJAJAR — garis dasar, garis sejajar sejauh `h3`
                 harga, bidang tipis di antaranya, dan garis tengah putus-
                 putus. Garis tengah bukan hiasan: harga yang kembali ke
                 tengah channel adalah hal pertama yang dicari orang yang
                 menggambarnya. */
              if (g.jenis === 'channel') {
                const ya = Y(g.h1 + d3OR(g)), yb = Y(g.h2 + d3OR(g));
                if (ya == null || yb == null) continue;
                ctx.fillStyle = 'rgba(96,165,250,.08)';
                ctx.beginPath();
                ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x2, yb); ctx.lineTo(x1, ya);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = BIRU;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                ctx.moveTo(x1, ya); ctx.lineTo(x2, yb);
                ctx.stroke();
                ctx.save();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = 'rgba(96,165,250,.55)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x1, (y1 + ya) / 2); ctx.lineTo(x2, (y2 + yb) / 2);
                ctx.stroke();
                ctx.restore();
                continue;
              }

              /* PANAH — batangnya berhenti di pangkal mata panah supaya
                 ujungnya tajam, tidak tumpul tertutup ujung garis. */
              if (g.jenis === 'panah') {
                const warna = 'rgba(56,189,248,.95)';
                const sudut = Math.atan2(y2 - y1, x2 - x1);
                const p = 10;
                ctx.strokeStyle = warna;
                ctx.fillStyle = warna;
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2 - Math.cos(sudut) * p * 0.8, y2 - Math.sin(sudut) * p * 0.8);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 - p * Math.cos(sudut - 0.42), y2 - p * Math.sin(sudut - 0.42));
                ctx.lineTo(x2 - p * Math.cos(sudut + 0.42), y2 - p * Math.sin(sudut + 0.42));
                ctx.closePath();
                ctx.fill();
                continue;
              }

              /* KUAS — goresan bebas. Titik yang tidak punya koordinat
                 (jauh di luar data) memutus goresan, bukan menyambungnya
                 ke titik berikutnya lewat garis lurus yang tidak pernah
                 digambar orangnya. */
              if (g.jenis === 'kuas') {
                const pts = g.titik && g.titik.length ? g.titik : [[g.t1, g.h1], [g.t2, g.h2]] as [number, number][];
                const jalur = () => {
                  ctx.beginPath();
                  let mulai = true;
                  for (const [t, h] of pts) {
                    const x = this.X(t), y = Y(h);
                    if (x == null || y == null) { mulai = true; continue; }
                    if (mulai) { ctx.moveTo(x, y); mulai = false; } else ctx.lineTo(x, y);
                  }
                };
                ctx.save();
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                if (terpilih) {
                  jalur();
                  ctx.strokeStyle = 'rgba(250,250,250,.35)';
                  ctx.lineWidth = 6;
                  ctx.stroke();
                }
                jalur();
                ctx.strokeStyle = 'rgba(167,139,250,.95)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
                continue;
              }

              /* RENTANG HARGA & RENTANG WAKTU — dua bagian dari alat ukur
                 lama, masing-masing berdiri sendiri seperti di TradingView:
                 yang satu cuma menjawab "berapa jauh harganya", yang lain
                 "berapa lama". Warna langit, supaya tidak tertukar dengan
                 ukur lama yang hijau/merah. */
              if (g.jenis === 'ukurHarga' || g.jenis === 'ukurWaktu') {
                const rgb = '56,189,248';
                const atas = Math.min(y1, y2), bawah = Math.max(y1, y2);
                ctx.fillStyle = `rgba(${rgb},.10)`;
                ctx.fillRect(kiri, atas, kanan - kiri, bawah - atas);
                ctx.strokeStyle = `rgba(${rgb},.75)`;
                ctx.fillStyle = `rgba(${rgb},.9)`;
                ctx.lineWidth = 1;
                const mata = (tx: number, ty: number, ux: number, uy: number) => {
                  ctx.beginPath();
                  ctx.moveTo(tx, ty);
                  ctx.lineTo(tx - ux * 6 - uy * 3.5, ty - uy * 6 + ux * 3.5);
                  ctx.lineTo(tx - ux * 6 + uy * 3.5, ty - uy * 6 - ux * 3.5);
                  ctx.closePath();
                  ctx.fill();
                };
                if (g.jenis === 'ukurHarga') {
                  const xt = (kiri + kanan) / 2;
                  ctx.beginPath();
                  ctx.moveTo(kiri, y1); ctx.lineTo(kanan, y1);
                  ctx.moveTo(kiri, y2); ctx.lineTo(kanan, y2);
                  ctx.moveTo(xt, y1); ctx.lineTo(xt, y2);
                  ctx.stroke();
                  if (y2 !== y1) mata(xt, y2, 0, y2 > y1 ? 1 : -1);
                  const selisih = g.h2 - g.h1;
                  const pct = g.h1 ? (selisih / g.h1) * 100 : 0;
                  const tanda = selisih >= 0 ? '+' : '−';
                  /* Di sisi ujung tarikan; dibalik kalau tidak muat di
                     panel — label yang jatuh di luar kanvas tidak tergambar
                     sama sekali. */
                  const lyH = y2 < y1 ? atas - 13 : bawah + 13;
                  chipTengah(xt, lyH < 10 ? bawah + 13 : lyH > mediaSize.height - 10 ? atas - 13 : lyH,
                    `${tanda}${hargaTeks(Math.abs(selisih))}  (${tanda}${Math.abs(pct).toFixed(2)}%)`, rgb);
                } else {
                  const yt = (atas + bawah) / 2;
                  ctx.beginPath();
                  ctx.moveTo(x1, atas); ctx.lineTo(x1, bawah);
                  ctx.moveTo(x2, atas); ctx.lineTo(x2, bawah);
                  ctx.moveTo(x1, yt); ctx.lineTo(x2, yt);
                  ctx.stroke();
                  if (x2 !== x1) mata(x2, yt, x2 > x1 ? 1 : -1, 0);
                  const bar = this.meta.tfMs ? Math.abs(Math.round((g.t2 - g.t1) / this.meta.tfMs)) : 0;
                  chipTengah((kiri + kanan) / 2, bawah + 13 > mediaSize.height - 10 ? atas - 13 : bawah + 13, `${bar} bar  ·  ${durasiTeks(Math.abs(g.t2 - g.t1))}`, rgb);
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
