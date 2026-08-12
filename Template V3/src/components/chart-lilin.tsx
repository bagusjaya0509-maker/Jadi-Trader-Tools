import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChart, CandlestickSeries, LineSeries, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type IPriceLine, type Logical, type Time,
} from 'lightweight-charts';
import type { Lilin } from '@/lib/pasar';
import { cn, harga as fHarga } from '@/lib/utils';
import type { TradeUji } from '@/lib/backtest';
import type { SegmenPine, PenandaPine, KotakPine, IsianPine } from '@/lib/pine-bar';
import { PenggambarIsi } from '@/lib/plugin-isi';
import { PenggambarAlat, type GambarAlat, type JenisAlat } from '@/lib/plugin-alat';

/* ════════════════════════════════════════════════════════════════════════
   CHART LILIN
   ════════════════════════════════════════════════════════════════════════
   lightweight-charts, bukan SVG tulisan tangan seperti sebelumnya.
   Alasannya berubah karena tuntutannya berubah: chart yang cuma dipandang
   memang tidak butuh pustaka, tapi chart yang harus di-zoom, digeser, punya
   crosshair, dan menampilkan penanda entry/exit di posisi yang tepat —
   itu ribuan baris kalau ditulis sendiri, dan hasilnya tetap kalah halus.

   45 kB gzip, Apache-2.0, dari pembuat TradingView sendiri. Dimuat malas
   bersama halaman Chart, jadi tidak menyentuh halaman lain sama sekali.
   ════════════════════════════════════════════════════════════════════════ */

export interface Garis { nama: string; nilai: (number | null)[]; warna: string }

export interface GarisHarga { harga: number; warna: string; label: string }

/* ── Tinggi panel SMI ──────────────────────────────────────────────────
   Bawaannya 80 px — cukup untuk membaca arah dan silangnya, dan tidak
   bertabrakan dengan kendali replay yang menumpang di dasar area harga.

   Tinggi yang DIPILIH orangnya (menyeret pembatas panel) menang atas
   bawaan dan bertahan melintasi muat ulang. Efek yang menggambar ulang SMI
   berjalan tiap kali data disegarkan; tanpa penyimpanan ini, setiap
   penyegaran mengembalikan tinggi panel ke bawaan — persis bug "saya sudah
   atur kok balik sendiri". */
const KUNCI_TINGGI_SMI = 'jt.tinggiSmi';
const TINGGI_SMI_BAWAAN = 80;

function bacaTinggiSmi(): number {
  try {
    const n = Number(localStorage.getItem(KUNCI_TINGGI_SMI));
    return n >= 40 && n <= 400 ? n : TINGGI_SMI_BAWAAN;
  } catch { return TINGGI_SMI_BAWAAN; }
}

/** Garis yang bisa DIGESER: entry, SL, TP.
 *
 *  Digambar sebagai elemen DOM di atas kanvas, bukan sebagai price line
 *  bawaan lightweight-charts. Alasannya satu: price line bawaan tidak bisa
 *  diseret sama sekali, dan menggesernya adalah cara paling wajar mengubah
 *  level sebelum order dikirim. */
export interface GarisSeret {
  id: 'entry' | 'sl' | 'tp';
  harga: number;
  warna: string;
  label: string;
  /** Keterangan di belakang harga: risiko dolar, jenis order. */
  ket?: string;
  bisaSeret?: boolean;
}

/** Posisi MT5 terbuka yang digambar di chart — datang dari laporan EA.
 *
 *  Digambar sebagai PRICE LINE bawaan lightweight-charts, bukan elemen DOM
 *  seperti GarisSeret. Alasannya kebalikan dari alasan GarisSeret: garis
 *  posisi harus MENEMBUS sampai ke sumbu harga dengan label kotak yang ikut
 *  bergerak — persis garis harga berjalan di MetaTrader — dan itu persis
 *  yang price line lakukan gratis. Yang tetap DOM cuma tiga hamparan tipis:
 *  PnL polos di atas garis entry, pegangan seret SL/TP, dan tombol Kirim. */
export interface PosisiChartMt5 {
  tiket: string;
  arah: 'BUY' | 'SELL';
  lot: number;
  entry: number;
  sl: number;
  tp: number;
}

export function ChartLilin({
  lilin, garis, trade, tinggi = 420, hingga, garisHarga, onKlikBar, smi, mundur, pojok,
  garisSeret, onSeret, onHapusGaris, hamparanBawah, segmen, penandaPine, kotakPine, isianPine,
  alat, onAlatSelesai, gambarAlat, gambarPilih, onPilihGambar,
  posisiMt5, onUbahPosisi, hargaAsk,
}: {
  lilin: Lilin;
  garis?: Garis[];
  trade?: TradeUji[];
  tinggi?: number;
  /* Gambar hanya sampai indeks ini — dipakai mode replay. `undefined` berarti
     seluruhnya. Pemotongan terjadi di SINI, bukan di pemanggil, supaya
     indikator dan penanda ikut terpotong pada batas yang sama persis. */
  hingga?: number;
  /** Garis horizontal (entry, SL, TP) untuk posisi yang sedang dibuka. */
  garisHarga?: GarisHarga[];
  /** Klik pada chart -> indeks bar. Dipakai untuk memulai replay dari situ. */
  onKlikBar?: (idx: number) => void;
  /** Deret SMI + garis sinyalnya, digambar di panel bawah. */
  smi?: { smi: (number | null)[]; signal: (number | null)[] } | null;
  /** Sisa waktu lilin berjalan, ditempel di sisi harga seperti TradingView. */
  mundur?: string;
  /** Isi pojok kiri atas chart — dipakai panel BUY/SELL. */
  pojok?: React.ReactNode;
  /** Garis entry/SL/TP yang bisa digeser. */
  garisSeret?: GarisSeret[];
  /** Dipanggil saat sebuah garis selesai digeser. */
  onSeret?: (id: GarisSeret['id'], harga: number) => void;
  /** Hapus satu garis lewat tombol ✕ di labelnya. */
  onHapusGaris?: (id: GarisSeret['id']) => void;
  /** Panel yang ditumpangkan di bagian bawah area harga — dipakai kendali
   *  replay, supaya ia menyatu dengan grafik alih-alih memanjangkan halaman. */
  hamparanBawah?: React.ReactNode;
  /** Trendline miring dari Pine (line.new) — bar → waktu di sini. */
  segmen?: SegmenPine[];
  /** Label BUY/SELL dari Pine (label.new / plotshape). */
  penandaPine?: PenandaPine[];
  /** Kotak zona dari Pine (box.new) — isi + bingkainya di kanvas. */
  kotakPine?: KotakPine[];
  /** Isian antar dua garis (linefill) — pewarna tengah channel paralel. */
  isianPine?: IsianPine[];
  /** Alat gambar yang sedang dipegang — null berarti kursor biasa. */
  alat?: JenisAlat | null;
  /** Dipanggil saat satu tarikan alat selesai. */
  onAlatSelesai?: (g: Omit<GambarAlat, 'id'>) => void;
  /** Gambar tangan yang sudah jadi — ukur, fib, kotak. */
  gambarAlat?: GambarAlat[];
  /** Gambar yang sedang terpilih (bingkai + pegangan). */
  gambarPilih?: string | null;
  /** Klik pada gambar memilihnya; klik ruang kosong membatalkan. */
  onPilihGambar?: (id: string | null) => void;
  /** Posisi MT5 terbuka — price line entry/SL/TP + PnL + seret SL/TP. */
  posisiMt5?: PosisiChartMt5[];
  /** Kirim SL/TP baru sebuah posisi ke EA; resolve true kalau EA sukses.
   *  Tanpa handler ini SL/TP posisinya tidak bisa diseret sama sekali. */
  onUbahPosisi?: (tiket: string, sl: number, tp: number) => Promise<boolean>;
  /** Harga permintaan (ask) MT5 — garis penanda spread di atas bid. */
  hargaAsk?: number;
}) {
  const kotak = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const seri = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const seriGaris = useRef<ISeriesApi<'Line'>[]>([]);
  const penanda = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const seriSmi = useRef<ISeriesApi<'Line'>[]>([]);
  const garisPos = useRef<IPriceLine[]>([]);
  const isiPine = useRef<PenggambarIsi | null>(null);
  const alatPrim = useRef<PenggambarAlat | null>(null);
  /* Handler klik disimpan di ref supaya langganannya dipasang SEKALI.
     Melanggan ulang tiap render menumpuk pendengar di chart yang sama. */
  const klikRef = useRef(onKlikBar);
  klikRef.current = onKlikBar;

  /* Chart dibuat SEKALI. Membuatnya ulang tiap data berubah akan mengembalikan
     zoom dan posisi geser ke awal setiap 15 detik — dan chart yang melompat
     sendiri saat sedang dibaca lebih buruk daripada tidak ada chart. */
  useEffect(() => {
    if (!kotak.current) return;
    const c = createChart(kotak.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#a1a1aa',
        fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,.04)' },
        horzLines: { color: 'rgba(255,255,255,.04)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,.08)', timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,.2)', labelBackgroundColor: '#27272a' },
        horzLine: { color: 'rgba(255,255,255,.2)', labelBackgroundColor: '#27272a' },
      },
      autoSize: true,
    });
    chart.current = c;
    seri.current = c.addSeries(CandlestickSeries, {
      upColor: '#10b981', downColor: '#f87171',
      borderUpColor: '#10b981', borderDownColor: '#f87171',
      wickUpColor: '#10b981', wickDownColor: '#f87171',
    });
    /* Penggambar isian — zona S/R terisi warna dan pewarna tengah channel,
       digambar LANGSUNG di kanvas panel harga lewat primitive. Seri garis
       tidak bisa mengisi bidang di antara dua garis miring; kanvas bisa. */
    const prim = new PenggambarIsi();
    seri.current.attachPrimitive(prim);
    isiPine.current = prim;
    const primAlat = new PenggambarAlat();
    seri.current.attachPrimitive(primAlat);
    alatPrim.current = primAlat;
    c.subscribeClick((p) => {
      if (klikRef.current && typeof p.logical === 'number') klikRef.current(Math.round(p.logical));
    });

    return () => { c.remove(); chart.current = null; seri.current = null; seriGaris.current = []; penanda.current = null; garisPos.current = []; isiPine.current = null; alatPrim.current = null; };
  }, []);

  /* Data lilin */
  useEffect(() => {
    if (!seri.current || !lilin.times.length) return;
    const batas = hingga === undefined ? lilin.times.length : Math.max(1, Math.min(lilin.times.length, hingga + 1));
    seri.current.setData(lilin.times.slice(0, batas).map((t, i) => ({
      /* lightweight-charts memakai DETIK, bukan milidetik. Mengirim ms
         menaruh setiap lilin di tahun 58.000 dan sumbunya jadi kosong. */
      time: Math.floor(t / 1000) as Time,
      open: lilin.opens[i], high: lilin.highs[i], low: lilin.lows[i], close: lilin.closes[i],
    })));
  }, [lilin, hingga]);

  /* Garis harga posisi (entry / SL / TP) */
  useEffect(() => {
    const s = seri.current;
    if (!s) return;
    garisPos.current.forEach((g) => s.removePriceLine(g));
    garisPos.current = (garisHarga ?? []).map((g) => s.createPriceLine({
      price: g.harga, color: g.warna, lineWidth: 1,
      lineStyle: 2, axisLabelVisible: true, title: g.label,
    }));
  }, [garisHarga]);

  /* ── Panel SMI ──────────────────────────────────────────────────────
     Panel TERPISAH (paneIndex 1), bukan ditumpuk di atas harga: SMI bergerak
     di rentang -100..100 sementara harga di puluhan ribu, dan menggabungkan
     keduanya di satu sumbu membuat salah satunya jadi garis lurus. */
  /* Seri SMI dibuat saat indikatornya MENYALA — sekali, bukan tiap bar.
     ──────────────────────────────────────────────────────────────────────
     Efek lama membongkar-pasang seri setiap `hingga` berubah — sekali per
     bar replay. Tiap bongkar-pasang membuat panel 1 lenyap sekejap lalu
     lahir lagi dengan tinggi bawaan, dan pembatas panelnya tampak meloncat
     naik-turun sepanjang replay. Datanya sendiri cukup di-setData. */
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    seriSmi.current.forEach((s) => { try { c.removeSeries(s); } catch { /* sudah lepas */ } });
    seriSmi.current = [];
    if (!smi || !lilin.times.length) return;

    const buat = (warna: string, tebal: 1 | 2) => {
      const s = c.addSeries(LineSeries, {
        color: warna, lineWidth: tebal, priceLineVisible: false, lastValueVisible: false,
      }, 1);
      seriSmi.current.push(s);
    };
    buat('#fbbf24', 2);
    buat('#60a5fa', 1);

    /* Ambang jenuh +50 / -50 — angka yang SAMA dengan SMI_OB dan SMI_OS di
       jt-scan-core, yaitu ambang yang dipakai kartu sinyal untuk menyebut
       sebuah koin overbought atau oversold. Garis di sini harus sama persis
       dengan ambang di sana, kalau tidak chart dan kartu akan berbeda
       pendapat tentang koin yang sama. */
    const acuan = seriSmi.current[0];
    if (acuan) {
      [50, -50].forEach((v) => acuan.createPriceLine({
        price: v, color: 'rgba(255,255,255,.14)', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: false, title: '',
      }));
    }
    try { c.panes()[1]?.setHeight(tinggiSmi.current); } catch { /* versi tanpa panes API */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smi === null, lilin.times.length === 0]);

  /* Data SMI dipotong lewat setData pada seri yang SAMA — pembatas panel
     tidak tersentuh, jadi ia diam selama replay berjalan bar demi bar. */
  useEffect(() => {
    if (!smi || seriSmi.current.length < 2 || !lilin.times.length) return;
    const batas = hingga === undefined ? lilin.times.length : Math.max(1, Math.min(lilin.times.length, hingga + 1));
    const isi = (nilai: (number | null)[]) =>
      lilin.times.slice(0, batas)
        .map((t, i) => ({ time: Math.floor(t / 1000) as Time, value: nilai[i] }))
        .filter((x): x is { time: Time; value: number } => x.value != null && isFinite(x.value));
    seriSmi.current[0].setData(isi(smi.smi));
    seriSmi.current[1].setData(isi(smi.signal));
  }, [smi, lilin, hingga]);

  /* Garis indikator */
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    /* Jendela pandang DISIMPAN lalu DIPULIHKAN. Membongkar-pasang seri —
       apalagi yang datanya menjulur ke masa depan — menggeser pemetaan
       skala waktu, dan chart tampak berjalan maju-mundur sendiri setiap
       data disegarkan. Zoom dan posisi geser milik orangnya, bukan milik
       penyegaran data. */
    const rentang = c.timeScale().getVisibleLogicalRange();
    seriGaris.current.forEach((s) => c.removeSeries(s));
    seriGaris.current = [];
    (garis ?? []).forEach((g) => {
      const s = c.addSeries(LineSeries, {
        color: g.warna, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      const batas = hingga === undefined ? lilin.times.length : Math.max(1, Math.min(lilin.times.length, hingga + 1));
      s.setData(
        lilin.times.slice(0, batas)
          .map((t, i) => ({ time: Math.floor(t / 1000) as Time, value: g.nilai[i] }))
          .filter((x): x is { time: Time; value: number } => x.value != null && isFinite(x.value))
      );
      seriGaris.current.push(s);
    });
    if (rentang) { try { c.timeScale().setVisibleLogicalRange(rentang); } catch { /* chart baru */ } }
  }, [garis, lilin, hingga]);

  /* ── Trendline & kotak dari Pine ───────────────────────────────────
     line.new Pine memakai KOORDINAT BAR; lightweight-charts memakai waktu.
     Bar di dalam data dipetakan langsung; bar di masa depan (garis yang
     diperpanjang ke kanan) diekstrapolasi dari durasi timeframe — chart
     menerima stempel waktu masa depan sebagai ruang kosong. */
  const seriPine = useRef<ISeriesApi<'Line'>[]>([]);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    /* Alasan yang sama dengan garis indikator: gambar Pine dibongkar-pasang
       saat dihitung ulang, dan tanpa pemulihan rentang setiap hitung ulang
       melempar jendela pandang ke tempat lain. */
    const rentang = c.timeScale().getVisibleLogicalRange();
    seriPine.current.forEach((s) => { try { c.removeSeries(s); } catch { /* lepas */ } });
    seriPine.current = [];
    if (!lilin.times.length) { isiPine.current?.setData([], []); return; }
    const n = lilin.times.length;
    const tfMs = n > 1 ? lilin.times[1] - lilin.times[0] : 3_600_000;
    const waktuBar = (x: number) => {
      const b = Math.round(x);
      const ms = b < n ? lilin.times[Math.max(0, b)] : lilin.times[n - 1] + (b - (n - 1)) * tfMs;
      return Math.floor(ms / 1000) as Time;
    };
    const gambarGaris = (x1: number, y1: number, x2: number, y2: number, warna: string, lebar: number, gaya: 'solid' | 'dashed' | 'dotted') => {
      if (x1 === x2) return;
      let [a, va, b, vb] = x1 < x2 ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
      const s = c.addSeries(LineSeries, {
        color: warna, lineWidth: Math.min(4, Math.max(1, Math.round(lebar))) as 1 | 2 | 3 | 4,
        lineStyle: gaya === 'dashed' ? 2 : gaya === 'dotted' ? 1 : 0,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      /* Titik antara ikut digambar supaya garisnya lurus melintasi bar —
         dua titik saja cukup untuk lightweight-charts, tapi bar renggang
         (whitespace masa depan) butuh titik nyata di tiap ujung. */
      const kemiringan = (vb - va) / (b - a);
      const data: { time: Time; value: number }[] = [];
      for (let x = Math.max(0, Math.floor(a)); x <= b; x++) {
        data.push({ time: waktuBar(x), value: va + kemiringan * (x - a) });
      }
      if (data.length >= 2) { s.setData(data); seriPine.current.push(s); }
      else { try { c.removeSeries(s); } catch { /* kosong */ } }
    };
    (segmen ?? []).forEach((g) => {
      let { x1, y1, x2, y2 } = g;
      const kemiringan = x2 !== x1 ? (y2 - y1) / (x2 - x1) : 0;
      if (g.perpanjang === 'left' || g.perpanjang === 'both') { y1 = y1 + kemiringan * (0 - x1); x1 = 0; }
      if (g.perpanjang === 'right' || g.perpanjang === 'both') { const xr = n - 1 + 15; y2 = y2 + kemiringan * (xr - x2); x2 = xr; }
      gambarGaris(x1, y1, x2, y2, g.warna, g.lebar, g.gaya);
    });
    /* Kotak & isian BUKAN seri garis — mereka bidang, dan bidang digambar
       sebagai bidang: primitive kanvas mengisi persegi/poligonnya di bawah
       lilin, persis zona Supply/Demand dan fill channel di TradingView.
       Model lama (dua garis tepi per kotak) itulah sumber "garis putih
       misterius": zona yang kehilangan isinya. */
    isiPine.current?.setData(
      (kotakPine ?? []).map((k) => ({ b1: k.kiri, b2: k.kanan, atas: k.atas, bawah: k.bawah, isi: k.warna, tepi: k.garis })),
      (isianPine ?? []).map((f) => {
        let { x2, y2a, y2b } = f;
        if (f.perpanjang === 'right' && x2 > f.x1) {
          const xr = n - 1 + 15;
          if (xr > x2) {
            y2a = y2a + ((y2a - f.y1a) / (x2 - f.x1)) * (xr - x2);
            y2b = y2b + ((y2b - f.y1b) / (x2 - f.x1)) * (xr - x2);
            x2 = xr;
          }
        }
        return { x1: f.x1, ya1: f.y1a, yb1: f.y1b, x2, ya2: y2a, yb2: y2b, warna: f.warna };
      })
    );
    if (rentang) { try { c.timeScale().setVisibleLogicalRange(rentang); } catch { /* chart baru */ } }
  }, [segmen, kotakPine, isianPine, lilin]);

  /* Penanda entry & exit tiap trade hasil backtest */
  useEffect(() => {
    if (!seri.current) return;
    /* Plugin penanda dibuat sekali lalu dipakai ulang. Memanggil
       createSeriesMarkers tiap render menumpuk plugin di seri yang sama. */
    const p = penanda.current ?? (penanda.current = createSeriesMarkers(seri.current, []));
    const tanda = (trade ?? []).flatMap((t) => [
      {
        time: Math.floor(t.masukWaktu / 1000) as Time,
        position: (t.arah === 'BUY' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
        color: t.arah === 'BUY' ? '#10b981' : '#f87171',
        shape: (t.arah === 'BUY' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
        text: `#${t.no}`,
      },
      {
        time: Math.floor(t.keluarWaktu / 1000) as Time,
        position: (t.arah === 'BUY' ? 'aboveBar' : 'belowBar') as 'belowBar' | 'aboveBar',
        /* Warna mengikuti HASIL, bukan arah — yang ingin dilihat sekilas dari
           penanda keluar adalah menang atau kalah. */
        color: t.pnl >= 0 ? '#10b981' : '#f87171',
        shape: 'circle' as const,
        text: t.sebab,
      },
    ]);
    /* Label Pine ikut lewat plugin penanda yang sama — satu saluran untuk
       semua tanda di atas lilin. */
    (penandaPine ?? []).forEach((m) => {
      if (m.bar < 0 || m.bar >= lilin.times.length) return;
      tanda.push({
        time: Math.floor(lilin.times[m.bar] / 1000) as Time,
        position: (m.posisi === 'bawah' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
        color: m.warna,
        shape: (m.posisi === 'bawah' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
        text: m.teks.split('\n')[0].slice(0, 18),
      });
    });
    tanda.sort((a, b) => (a.time as number) - (b.time as number));
    p.setMarkers(tanda);
  }, [trade, penandaPine, lilin]);

  /* ── Gambar tangan: data + interaksi tariknya ──────────────────────
     Saat sebuah alat dipegang, seret-geser chart DIMATIKAN dan kursor jadi
     crosshair: satu gerakan tarik = satu gambar. Koordinatnya stempel
     waktu, jadi gambarnya tidak merayap saat lilin baru lahir. */
  useEffect(() => {
    const n = lilin.times.length;
    const tfMs = n > 1 ? lilin.times[1] - lilin.times[0] : 3_600_000;
    alatPrim.current?.setData(gambarAlat ?? [], { tAkhir: n ? lilin.times[n - 1] : 0, tfMs, n });
  }, [gambarAlat, lilin]);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.applyOptions({ handleScroll: !alat, handleScale: !alat });
    if (kotak.current) kotak.current.style.cursor = alat ? 'crosshair' : '';
  }, [alat]);

  useEffect(() => { alatPrim.current?.setPilih(gambarPilih ?? null); }, [gambarPilih]);

  /* ── Memilih gambar dengan klik (mode kursor biasa) ─────────────────
     Klik = mousedown+mouseup yang nyaris tidak bergerak; seretan panning
     chart bukan pilihan. Uji-kenanya kotak pembatas berpelonggar 8 px —
     garis setipis 1 px mustahil diklik persis. */
  const acuanPilih = useRef({ alat, gambarAlat });
  acuanPilih.current = { alat, gambarAlat };
  useEffect(() => {
    if (!onPilihGambar) return;
    const el = kotak.current;
    if (!el) return;
    let awal: { x: number; y: number } | null = null;
    const turun = (e: MouseEvent) => { awal = { x: e.clientX, y: e.clientY }; };
    const klik = (e: MouseEvent) => {
      const { alat: a, gambarAlat: gs } = acuanPilih.current;
      if (a) return;
      if (awal && Math.hypot(e.clientX - awal.x, e.clientY - awal.y) > 5) return;
      const c = chart.current, s = seri.current;
      if (!c || !s) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const X = (t: number): number | null => {
        const x = c.timeScale().timeToCoordinate(Math.floor(t / 1000) as Time);
        if (x != null) return x;
        const times = acuan.current.lilin.times;
        if (times.length < 2) return null;
        const tfMs = times[1] - times[0];
        return c.timeScale().logicalToCoordinate((times.length - 1 + (t - times[times.length - 1]) / tfMs) as Logical);
      };
      let kena: string | null = null;
      const daftar = gs ?? [];
      for (let i = daftar.length - 1; i >= 0; i--) {
        const g = daftar[i];
        const x1 = X(g.t1), x2 = X(g.t2);
        const y1 = s.priceToCoordinate(g.h1), y2 = s.priceToCoordinate(g.h2);
        if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
        if (px >= Math.min(x1, x2) - 8 && px <= Math.max(x1, x2) + 8
          && py >= Math.min(y1, y2) - 8 && py <= Math.max(y1, y2) + 8) { kena = g.id; break; }
      }
      onPilihGambar(kena);
    };
    el.addEventListener('mousedown', turun);
    el.addEventListener('click', klik);
    return () => { el.removeEventListener('mousedown', turun); el.removeEventListener('click', klik); };
  }, [onPilihGambar]);

  const tarikAlat = useRef<{ t1: number; h1: number } | null>(null);
  useEffect(() => {
    if (!alat || !onAlatSelesai) return;
    const el = kotak.current;
    if (!el) return;

    const posisiDari = (e: MouseEvent): { t: number; h: number } | null => {
      const c = chart.current, s = seri.current;
      if (!c || !s) return null;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const paneH = paneHargaRef.current || rect.height;
      const y = Math.min(Math.max(e.clientY - rect.top, 2), paneH - 2);
      const h = s.coordinateToPrice(y);
      if (typeof h !== 'number' || !isFinite(h)) return null;
      /* Waktu dari koordinat; di luar data (kanan lilin terakhir) jatuh ke
         sumbu logika + durasi timeframe. */
      const t = c.timeScale().coordinateToTime(x);
      if (t != null) return { t: (t as number) * 1000, h };
      const l = c.timeScale().coordinateToLogical(x);
      const times = acuan.current.lilin.times;
      if (l == null || times.length < 2) return null;
      const tfMs = times[1] - times[0];
      return { t: times[times.length - 1] + (l - (times.length - 1)) * tfMs, h };
    };

    const turun = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const p = posisiDari(e);
      if (!p) return;
      tarikAlat.current = { t1: p.t, h1: p.h };
      alatPrim.current?.setPratinjau({ jenis: alat, t1: p.t, h1: p.h, t2: p.t, h2: p.h });
      e.preventDefault();
      e.stopPropagation();
    };
    const gerak = (e: MouseEvent) => {
      const a = tarikAlat.current;
      if (!a) return;
      const p = posisiDari(e);
      if (!p) return;
      alatPrim.current?.setPratinjau({ jenis: alat, t1: a.t1, h1: a.h1, t2: p.t, h2: p.h });
    };
    const lepas = (e: MouseEvent) => {
      const a = tarikAlat.current;
      if (!a) return;
      tarikAlat.current = null;
      alatPrim.current?.setPratinjau(null);
      const p = posisiDari(e);
      /* Klik tanpa tarikan bukan gambar — titik tunggal tidak menyimpan
         informasi apa pun. */
      if (p && (Math.abs(p.t - a.t1) > 1 || p.h !== a.h1)) {
        onAlatSelesai({ jenis: alat, t1: a.t1, h1: a.h1, t2: p.t, h2: p.h });
      }
    };
    /* Fase capture: menang atas penangan chart & garis seret. */
    el.addEventListener('mousedown', turun, true);
    window.addEventListener('mousemove', gerak);
    window.addEventListener('mouseup', lepas);
    return () => {
      el.removeEventListener('mousedown', turun, true);
      window.removeEventListener('mousemove', gerak);
      window.removeEventListener('mouseup', lepas);
      tarikAlat.current = null;
      alatPrim.current?.setPratinjau(null);
    };
  }, [alat, onAlatSelesai]);

  /* ── Menempelkan hamparan ke skala harga ───────────────────────────
     Posisinya ditulis LANGSUNG ke gaya elemennya di dalam
     requestAnimationFrame, bukan lewat state React.

     Sebelumnya ini setInterval 200 ms yang memanggil setState. Dua akibatnya
     terasa keduanya: label bergerak dalam langkah 200 ms sementara kanvasnya
     bergerak tiap frame — jadi saat grafik digeser naik-turun labelnya
     tertinggal di belakang dan terlihat lepas dari harganya; dan tiap
     perpindahan memaksa React menggambar ulang seluruh chart.

     Menulis style.top di dalam rAF membuat label dan kanvas bergerak pada
     frame yang SAMA, dan React tidak dilibatkan sama sekali. */
  const tinggiSmi = useRef(bacaTinggiSmi());
  const labelRef = useRef<HTMLDivElement>(null);
  const garisRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const hamparanRef = useRef<HTMLDivElement>(null);
  const seret = useRef<{ id: string; mulaiY: number } | null>(null);
  /* Tinggi panel harga, diisi pasang() saat terbaca. Penjepit seret dan
     penyembunyi label memakai angka yang SAMA — kalau tidak, harga hasil
     jepitan bisa jatuh di wilayah yang penyembunyinya anggap "di luar". */
  const paneHargaRef = useRef(0);

  /* ── Ubahan SL/TP posisi MT5 ────────────────────────────────────────
     Satu ubahan hidup pada satu waktu: nilai yang sedang diseret MENANG
     atas nilai broker di garisnya (pratinjau), lalu menunggu tombol
     Kirim. `terkirim` menahan pratinjaunya setelah EA sukses — laporan
     EA berikutnya butuh beberapa detik, dan garis yang melompat balik ke
     nilai lama selama jeda itu terlihat seperti perintah yang gagal.

     Nilainya hidup DI DUA TEMPAT dengan sengaja: state React hanya untuk
     kapan tombol Kirim tampil (berubah saat seretan mulai/lepas), dan
     ref untuk nilai per-gerakan kursor. Kalau tiap mousemove menyentuh
     state, seluruh chart digambar ulang puluhan kali per detik — itulah
     "berat" yang dirasakan saat menyeret. */
  type UbahMt5 = {
    tiket: string; sl: number; tp: number;
    bidang: 'sl' | 'tp'; sibuk: boolean; terkirim: boolean;
  };
  const [ubah, setUbah] = useState<UbahMt5 | null>(null);
  const ubahRef = useRef<UbahMt5 | null>(null);
  const aturUbah = useCallback((v: UbahMt5 | null) => { ubahRef.current = v; setUbah(v); }, []);
  const seretUbah = useRef<{ tiket: string; bidang: 'sl' | 'tp' } | null>(null);
  const garisPosMt5 = useRef<IPriceLine[]>([]);
  /* SL/TP per tiket dipegang lewat peta supaya seretan bisa MENGGESER
     garis yang sudah ada (applyOptions) alih-alih membongkar-pasang
     semua price line tiap gerakan. */
  const petaGarisMt5 = useRef<Map<string, IPriceLine>>(new Map());
  const garisAsk = useRef<IPriceLine | null>(null);

  /* Nilai terbaru dibaca dari ref di dalam rAF. Kalau dibaca dari closure,
     loopnya harus dipasang ulang tiap render — dan itu mengalahkan
     tujuannya. */
  const acuan = useRef({ garisSeret, lilin, hingga, posisiMt5 });
  acuan.current = { garisSeret, lilin, hingga, posisiMt5 };

  const hargaDariY = useCallback((y: number) => {
    const s = seri.current;
    if (!s || !kotak.current) return null;
    const rect = kotak.current.getBoundingClientRect();
    /* DIJEPIT ke panel harga. Tanpa penjepit, seretan yang lewat tepi chart
       terus menghasilkan harga — garisnya mengikuti kursor ke panel SMI dan
       ke panel-panel di bawahnya. Batasnya bukan layar; batasnya panel
       harga. */
    const paneH = paneHargaRef.current || rect.height;
    const yRel = Math.min(Math.max(y - rect.top, 2), paneH - 2);
    const v = s.coordinateToPrice(yRel);
    return typeof v === 'number' && isFinite(v) ? v : null;
  }, []);

  const pasang = useCallback(() => {
    const s = seri.current, c = chart.current;
    if (!s || !c) return;
    const { garisSeret: gs, lilin: l, hingga: hg, posisiMt5: pm } = acuan.current;
    /* Nilai seretan dibaca dari ref, bukan state — rAF ini yang membuat
       strip & tombol mengikuti kursor tanpa render React per gerakan. */
    const ub = ubahRef.current;

    /* Lebar skala harga dibaca tiap kali, bukan sekali: ia berubah sendiri
       begitu angkanya bertambah satu digit. */
    let lebar = 0;
    try { lebar = c.priceScale('right').width(); } catch { /* versi lama */ }

    try {
      const h0 = c.panes()[0].getHeight();
      if (h0 > 0) paneHargaRef.current = h0;
    } catch { /* versi lama */ }
    const paneHarga = paneHargaRef.current;

    const taruh = (el: HTMLDivElement | undefined | null, nilai: number | undefined) => {
      if (!el) return;
      const y = nilai === undefined ? null : s.priceToCoordinate(nilai);
      /* Label yang harganya di luar jendela zoom DISEMBUNYIKAN, bukan
         digambar nyasar di panel sebelah. Garis SL yang menempel di panel
         backtest bukan informasi; itu kebocoran tata letak. */
      if (typeof y === 'number' && isFinite(y) && y >= -2 && (!paneHarga || y <= paneHarga + 2)) {
        el.style.top = y + 'px';
        el.style.visibility = 'visible';
      } else {
        el.style.visibility = 'hidden';
      }
    };

    (gs ?? []).forEach((g) => taruh(garisRef.current.get(g.id), g.harga));

    /* Hamparan posisi MT5. Garis-garisnya sendiri price line (digambar
       kanvas oleh chart-nya); yang ditempatkan di sini cuma tiga penumpang
       DOM-nya: label BUY/SELL polos di ATAS garis entry, pegangan seret
       di level SL/TP (nilai seretan menang atas nilai broker), dan tombol
       Kirim yang menempel di garis yang terakhir dipegang. */
    (pm ?? []).forEach((p) => {
      const u = ub && ub.tiket === p.tiket ? ub : null;
      const elLab = garisRef.current.get('lab-' + p.tiket);
      if (elLab) {
        const y = s.priceToCoordinate(p.entry);
        /* Batas atas 12 px, bukan -2: elemen ini duduk DI ATAS garisnya
           (translateY -100%), jadi garis di tepi atas berarti teksnya
           sudah keluar jendela. */
        if (typeof y === 'number' && isFinite(y) && y >= 12 && (!paneHarga || y <= paneHarga + 2)) {
          elLab.style.top = (y - 3) + 'px';
          elLab.style.visibility = 'visible';
        } else elLab.style.visibility = 'hidden';
      }
      const slPos = u ? u.sl : p.sl;
      taruh(garisRef.current.get(`ubah-${p.tiket}-sl`), slPos > 0 ? slPos : undefined);
      const tpPos = u ? u.tp : p.tp;
      taruh(garisRef.current.get(`ubah-${p.tiket}-tp`), tpPos > 0 ? tpPos : undefined);
    });
    const elTombol = garisRef.current.get('ubah-tombol');
    if (elTombol && ub) taruh(elTombol, ub.bidang === 'tp' ? ub.tp : ub.sl);

    /* Garis order berhenti DI TEPI skala harga, tidak menerobos ke bawah
       angka-angkanya. Elemen DOM membentang selebar komponen; tanpa batas
       ini garis entry tampak seperti coretan pucat menimpa sumbu harga. */
    if (lebar) garisRef.current.forEach((el) => { el.style.right = (lebar + 2) + 'px'; });

    const n = hg === undefined ? l.closes.length : Math.min(l.closes.length, hg + 1);
    taruh(labelRef.current, l.closes[n - 1]);
    if (labelRef.current && lebar) labelRef.current.style.width = lebar + 'px';

    /* Kendali replay berhenti tepat di garis harga, tidak menerobos ke bawah
       skalanya — panel yang menutupi angka harga membuat satu-satunya hal
       yang selalu ingin dibaca jadi tidak terbaca. */
    if (hamparanRef.current) hamparanRef.current.style.right = (lebar + 4) + 'px';

    /* Tinggi panel SMI dibaca balik dari chart-nya.
       ──────────────────────────────────────────────────────────────────
       lightweight-charts tidak memberi tahu saat pembatas panel diseret,
       jadi satu-satunya cara tahu adalah membacanya. Nilai yang berubah
       berarti orangnya baru menyeret — simpan, supaya jadi bawaannya
       sendiri untuk seterusnya. Kendali replay ikut digeser supaya tetap
       duduk di atas panel SMI, bukan di belakangnya. */
    try {
      const panes = c.panes();
      if (panes.length > 1) {
        const h = panes[1].getHeight();
        /* h = 0 berarti panelnya BELUM diukur (tab latar, frame pertama) —
           bukan berarti panelnya setipis nol. Jangan simpan, jangan geser. */
        if (h >= 40) {
          if (Math.abs(h - tinggiSmi.current) > 1) {
            tinggiSmi.current = h;
            try { localStorage.setItem(KUNCI_TINGGI_SMI, String(Math.round(h))); } catch { /* privat */ }
          }
          if (hamparanRef.current) hamparanRef.current.style.bottom = (h + 36) + 'px';
        }
      } else if (hamparanRef.current) {
        hamparanRef.current.style.bottom = '34px';
      }
    } catch { /* versi tanpa panes API */ }
  }, []);

  /* Dipasang SEKALI segera setelah menggambar, di luar rAF.
     ────────────────────────────────────────────────────────────────────
     requestAnimationFrame berhenti total saat tabnya tidak terlihat. Tanpa
     panggilan langsung ini, membuka halaman di tab latar lalu berpindah ke
     sana akan menampilkan garis dan label yang belum punya posisi. */
  useEffect(pasang, [pasang, garisSeret, lilin, hingga, mundur, smi, posisiMt5, ubah]);

  useEffect(() => {
    let raf = 0;
    const tik = () => { raf = requestAnimationFrame(tik); pasang(); };
    raf = requestAnimationFrame(tik);
    /* Tab yang kembali terlihat memasang ulang segera — rAF baru bangun satu
       frame kemudian, dan satu frame dengan label di tempat lama sudah cukup
       untuk terlihat seperti label yang lepas. */
    const bangun = () => { if (!document.hidden) pasang(); };
    document.addEventListener('visibilitychange', bangun);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', bangun); };
  }, [pasang]);

  /* Label harga bawaan dimatikan saat kita menggambar penggantinya sendiri —
     dua label di tempat yang sama saling menimpa. */
  useEffect(() => {
    seri.current?.applyOptions({ lastValueVisible: !mundur });
  }, [mundur]);

  /* ── Menyeret ──────────────────────────────────────────────────────
     Pendengar dipasang di window, bukan di garisnya: kalau kursor keluar
     dari garis setipis 1 px saat digeser cepat — dan itu selalu terjadi —
     seretannya akan putus di tengah jalan. */
  useEffect(() => {
    if (!onSeret) return;
    const gerak = (e: MouseEvent) => {
      if (!seret.current) return;
      e.preventDefault();
      const h = hargaDariY(e.clientY);
      if (h !== null) onSeret(seret.current.id as GarisSeret['id'], h);
    };
    const lepas = () => {
      if (!seret.current) return;
      seret.current = null;
      document.body.style.cursor = '';
      /* Interaksi chart dinyalakan lagi — dimatikan saat mulai menyeret
         supaya menggeser garis tidak ikut menggeser grafiknya. */
      chart.current?.applyOptions({ handleScroll: true, handleScale: true });
    };
    window.addEventListener('mousemove', gerak);
    window.addEventListener('mouseup', lepas);
    return () => {
      window.removeEventListener('mousemove', gerak);
      window.removeEventListener('mouseup', lepas);
    };
  }, [onSeret, hargaDariY]);

  function mulaiSeret(id: string, e: React.MouseEvent) {
    if (!onSeret) return;
    e.preventDefault();
    e.stopPropagation();
    seret.current = { id, mulaiY: e.clientY };
    document.body.style.cursor = 'ns-resize';
    chart.current?.applyOptions({ handleScroll: false, handleScale: false });
  }

  /* ── Garis posisi MT5: PRICE LINE, bukan overlay DOM ────────────────
     createPriceLine menempel sampai KE DALAM sumbu harga dengan label
     kotak yang ikut bergerak bersama kanvas — persis garis posisi
     MetaTrader. Garis entry TANPA title: label BUY/SELL-nya teks polos
     DOM di atas garisnya (permintaan pemiliknya — tanpa kotak), dan
     angka levelnya sudah ada di label sumbu.

     Efek ini jalan hanya saat DAFTAR POSISI atau status ubahan berubah —
     bukan tiap laporan EA (identitas posisiMt5 distabilkan pemanggil) dan
     bukan tiap gerakan kursor (seretan memakai applyOptions langsung). */
  useEffect(() => {
    const s = seri.current;
    if (!s) return;
    const buat = (price: number, color: string, title: string, lineStyle: number, kunci?: string) => {
      try {
        const g = s.createPriceLine({ price, color, lineWidth: 1, lineStyle, axisLabelVisible: true, title });
        garisPosMt5.current.push(g);
        if (kunci) petaGarisMt5.current.set(kunci, g);
      } catch { /* seri sedang dibongkar ulang */ }
    };
    (posisiMt5 ?? []).forEach((p) => {
      const u = ubahRef.current && ubahRef.current.tiket === p.tiket ? ubahRef.current : null;
      buat(p.entry, p.arah === 'BUY' ? '#10b981' : '#f87171', '', 2);
      const slPos = u ? u.sl : p.sl;
      if (slPos > 0) buat(slPos, '#f87171', 'SL', 1, p.tiket + '-sl');
      const tpPos = u ? u.tp : p.tp;
      if (tpPos > 0) buat(tpPos, '#10b981', 'TP', 1, p.tiket + '-tp');
    });
    return () => {
      garisPosMt5.current.forEach((g) => { try { s.removePriceLine(g); } catch { /* dibongkar */ } });
      garisPosMt5.current = [];
      petaGarisMt5.current.clear();
    };
  }, [posisiMt5, ubah]);

  /* Harga permintaan (ask): garis titik jarang — jaraknya ke garis harga
     bid adalah SPREAD, dan di emas spread bukan pembulatan. Garisnya
     DIGESER (applyOptions), bukan dibongkar-pasang: nilainya berganti
     tiap beberapa detik dan membuat ulang price line sesering itu adalah
     kerja sia-sia. Baru muncul kalau EA v2.02+ yang mengirim tick. */
  useEffect(() => {
    const s = seri.current;
    if (!s) return;
    const ada = !!hargaAsk && isFinite(hargaAsk) && hargaAsk > 0;
    if (!ada) {
      if (garisAsk.current) { try { s.removePriceLine(garisAsk.current); } catch { /* lepas */ } garisAsk.current = null; }
      return;
    }
    if (garisAsk.current) {
      try { garisAsk.current.applyOptions({ price: hargaAsk }); } catch { /* lepas */ }
    } else {
      try {
        garisAsk.current = s.createPriceLine({
          price: hargaAsk, color: '#60a5fa', lineWidth: 1, lineStyle: 4, axisLabelVisible: true, title: 'Ask',
        });
      } catch { /* seri dibongkar */ }
    }
  }, [hargaAsk]);

  /* Ubahan menutup hidupnya sendiri saat laporan EA berikutnya sudah
     MEMBAWA nilai barunya, atau posisinya lenyap (tertutup dari mana pun).
     Selama masih diseret ia tidak boleh ditutup — saat mousedown nilainya
     masih sama persis dengan nilai broker. */
  useEffect(() => {
    if (!ubah || ubah.sibuk || seretUbah.current) return;
    const p = (posisiMt5 ?? []).find((x) => x.tiket === ubah.tiket);
    if (!p) { aturUbah(null); return; }
    /* Toleransi RELATIF, bukan persamaan persis: EA merapikan harga ke
       digit simbol sebelum memasangnya, jadi 2412.3456 yang dikirim
       kembali sebagai 2412.35 — dan itu tetap "sudah terpasang". */
    const dekat = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(b) * 1e-5, 1e-9);
    if (dekat(ubah.sl, p.sl) && dekat(ubah.tp, p.tp)) aturUbah(null);
  }, [posisiMt5, ubah, aturUbah]);

  /* Seret SL/TP posisi — pendengar di window, alasan yang sama dengan
     seret garis tiket: kursor selalu lolos dari strip setipis 14 px.
     Tiap gerakan cuma menyentuh REF + menggeser price line-nya langsung
     (applyOptions); React baru dilibatkan saat kursor DILEPAS. */
  useEffect(() => {
    if (!onUbahPosisi) return;
    const gerak = (e: MouseEvent) => {
      const su = seretUbah.current;
      const u = ubahRef.current;
      if (!su || !u || u.tiket !== su.tiket) return;
      e.preventDefault();
      const h = hargaDariY(e.clientY);
      if (h === null) return;
      ubahRef.current = { ...u, [su.bidang]: h };
      try { petaGarisMt5.current.get(su.tiket + '-' + su.bidang)?.applyOptions({ price: h }); } catch { /* lepas */ }
    };
    const lepas = () => {
      if (!seretUbah.current) return;
      seretUbah.current = null;
      document.body.style.cursor = '';
      chart.current?.applyOptions({ handleScroll: true, handleScale: true });
      /* Komit nilai akhir ke state: tombol Kirim tampil. Klik polos tanpa
         perpindahan dibubarkan efek penutup di atas. */
      if (ubahRef.current) aturUbah({ ...ubahRef.current });
    };
    window.addEventListener('mousemove', gerak);
    window.addEventListener('mouseup', lepas);
    return () => {
      window.removeEventListener('mousemove', gerak);
      window.removeEventListener('mouseup', lepas);
    };
  }, [onUbahPosisi, hargaDariY, aturUbah]);

  function mulaiSeretUbah(p: PosisiChartMt5, bidang: 'sl' | 'tp', e: React.MouseEvent) {
    if (!onUbahPosisi) return;
    e.preventDefault();
    e.stopPropagation();
    seretUbah.current = { tiket: p.tiket, bidang };
    const u = ubahRef.current;
    aturUbah(u && u.tiket === p.tiket && !u.terkirim
      ? { ...u, bidang, sibuk: false }
      : { tiket: p.tiket, sl: p.sl, tp: p.tp, bidang, sibuk: false, terkirim: false });
    document.body.style.cursor = 'ns-resize';
    chart.current?.applyOptions({ handleScroll: false, handleScale: false });
  }

  async function kirimUbah() {
    if (!ubah || !onUbahPosisi || ubah.sibuk) return;
    const kirim = ubah;
    aturUbah({ ...kirim, sibuk: true });
    const ok = await onUbahPosisi(kirim.tiket, kirim.sl, kirim.tp);
    /* Sukses: tombolnya hilang tapi PRATINJAUNYA bertahan sampai laporan
       EA menyusul (efek penutup di atas yang membubarkannya). Gagal:
       tombol tetap ada — nilainya masih di tempat, tinggal coba lagi
       atau Batal. */
    const u = ubahRef.current;
    if (u && u.tiket === kirim.tiket) aturUbah({ ...u, sibuk: false, terkirim: ok });
  }

  const idxAkhir = (hingga === undefined ? lilin.closes.length : Math.min(lilin.closes.length, hingga + 1)) - 1;
  const hargaTerakhir = idxAkhir >= 0 ? lilin.closes[idxAkhir] : undefined;
  /* Warna mengikuti arah lilin terakhir — aturan yang SAMA dengan label
     bawaan lightweight-charts yang baru saja dimatikan. Menggantinya dengan
     satu warna tetap justru membuat penggantinya terlihat seperti tempelan,
     karena ia jadi satu-satunya hal di chart yang tidak ikut aturan. */
  const naik = idxAkhir >= 0 && lilin.closes[idxAkhir] >= lilin.opens[idxAkhir];

  return (
    <div className="relative overflow-hidden">
      <div ref={kotak} style={{ height: tinggi }} className="w-full" />

      {/* Hitung mundur DI DALAM label harga, bukan di sebelahnya.
          ────────────────────────────────────────────────────────────────
          Ini MENGGANTI label bawaan lightweight-charts, bukan menumpuk di
          atasnya: lebarnya diambil dari lebar skala harga yang sebenarnya,
          dan posisinya ditulis tiap frame — jadi ia menempati tempat yang
          sama persis dengan label yang tadi dimatikan. Itulah beda
          "tertanam" dengan "tempelan": bukan warnanya, tapi apakah ia
          bergerak pada frame yang sama dengan kanvasnya. */}
      {mundur && hargaTerakhir !== undefined && (
        <div ref={labelRef}
             className={cn('angka pointer-events-none absolute right-0 z-10 px-1 py-[3px] text-center leading-[1.15] tabular-nums',
               naik ? 'bg-emerald-500 text-zinc-950' : 'bg-red-400 text-zinc-950')}
             style={{ transform: 'translateY(-50%)', visibility: 'hidden' }}>
          <div className="text-[10.5px] font-medium">{fHarga(hargaTerakhir)}</div>
          <div className="text-[9.5px] opacity-75">{mundur}</div>
        </div>
      )}

      {/* Garis entry / SL / TP yang bisa digeser. */}
      {(garisSeret ?? []).map((g) => {
        const bisa = g.bisaSeret !== false && !!onSeret;
        return (
          <div key={g.id}
               ref={(el) => {
                 if (el) garisRef.current.set(g.id, el);
                 else garisRef.current.delete(g.id);
               }}
               className={cn('absolute left-0 right-0 z-10 flex items-center',
                 bisa ? 'cursor-ns-resize' : 'pointer-events-none')}
               style={{ transform: 'translateY(-50%)', height: 14, visibility: 'hidden' }}
               onMouseDown={bisa ? (e) => mulaiSeret(g.id, e) : undefined}>
            <div className="h-px flex-1" style={{
              background: `repeating-linear-gradient(90deg, ${g.warna} 0 6px, transparent 6px 11px)`,
            }} />
            {/* ✕ menghapus garis INI saja — order yang batal harus bisa
                dibersihkan dari chart tanpa menunggu apa pun. */}
            {bisa && onHapusGaris && (
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onHapusGaris(g.id); }}
                title={`Hapus garis ${g.label}`}
                className="mr-1 flex size-[14px] shrink-0 cursor-pointer items-center justify-center rounded-sm text-[10px] font-bold leading-none text-zinc-950 opacity-80 shadow transition-opacity hover:opacity-100"
                style={{ background: g.warna }}>
                ×
              </button>
            )}
            <span className="angka mr-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-950 shadow"
                  style={{ background: g.warna }}>
              {g.label} {fHarga(g.harga)}{g.ket ? ` ${g.ket}` : ''}
            </span>
          </div>
        );
      })}

      {/* Posisi MT5. Garis entry/SL/TP-nya PRICE LINE (menembus ke sumbu
          harga — digambar chart-nya sendiri); di DOM tinggal label
          BUY/SELL + lot sebagai TEKS POLOS di atas garis entry — tanpa
          kotak, tanpa angka, tanpa PnL berjalan (angka yang berdetak tiap
          laporan EA memaksa chart menggambar ulang terus-menerus). */}
      {(posisiMt5 ?? []).map((p) => (
        <div key={'lab-' + p.tiket}
             ref={(el) => {
               if (el) garisRef.current.set('lab-' + p.tiket, el);
               else garisRef.current.delete('lab-' + p.tiket);
             }}
             className={cn('angka pointer-events-none absolute left-3 z-10 pr-1.5 text-right text-[10.5px] font-semibold tabular-nums',
               p.arah === 'BUY' ? 'text-emerald-400' : 'text-red-400')}
             style={{ transform: 'translateY(-100%)', visibility: 'hidden',
               textShadow: '0 1px 4px rgba(9,9,11,.95), 0 0 2px rgba(9,9,11,.9)' }}>
          {p.arah} {p.lot}
        </div>
      ))}

      {/* Pegangan seret SL/TP posisi — strip transparan 14 px di level
          garisnya. Menyeret menampilkan tombol Kirim; tanpa menekan Kirim
          tidak ada apa pun yang berangkat ke MT5. */}
      {onUbahPosisi && (posisiMt5 ?? []).map((p) => (['sl', 'tp'] as const).map((b) => (
        <div key={`ubah-${p.tiket}-${b}`}
             ref={(el) => {
               if (el) garisRef.current.set(`ubah-${p.tiket}-${b}`, el);
               else garisRef.current.delete(`ubah-${p.tiket}-${b}`);
             }}
             title={`Seret ${b.toUpperCase()} posisi #${p.tiket}`}
             className="absolute left-0 z-10 cursor-ns-resize"
             style={{ transform: 'translateY(-50%)', height: 14, visibility: 'hidden' }}
             onMouseDown={(e) => mulaiSeretUbah(p, b, e)} />
      )))}

      {/* Tombol keputusan ubahan — menempel di garis yang terakhir
          dipegang, tepat di kiri sumbu harga. */}
      {ubah && !ubah.terkirim && onUbahPosisi && (
        <div ref={(el) => {
               if (el) garisRef.current.set('ubah-tombol', el);
               else garisRef.current.delete('ubah-tombol');
             }}
             className="absolute z-20 flex items-center gap-1.5"
             style={{ transform: 'translateY(-50%)', visibility: 'hidden' }}>
          <button onClick={() => void kirimUbah()} disabled={ubah.sibuk}
                  className="flex cursor-pointer items-center rounded-md bg-zinc-100 px-2 py-1 text-[10.5px] font-semibold leading-none text-zinc-950 shadow-lg transition-colors hover:bg-white disabled:cursor-default disabled:opacity-60">
            {ubah.sibuk ? 'Mengirim…' : `Kirim SL/TP → MT5`}
          </button>
          {!ubah.sibuk && (
            <button onClick={() => aturUbah(null)}
                    className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-[10.5px] leading-none text-zinc-300 shadow transition-colors hover:text-zinc-100">
              Batal
            </button>
          )}
        </div>
      )}

      {pojok && <div className="absolute left-2 top-2 z-20">{pojok}</div>}

      {/* Kendali replay ditumpangkan di dasar area harga, bukan di panel
          terpisah di bawah chart — latarnya tembus supaya menyatu dengan
          grafiknya. */}
      {/* left-14: logo atribusi TradingView duduk di pojok kiri bawah panel
          harga, dan lisensi lightweight-charts mensyaratkan ia terlihat —
          kendalinya yang minggir, bukan logonya. */}
      {hamparanBawah && (
        <div ref={hamparanRef} className="absolute left-14 z-20" style={{ bottom: smi ? 120 : 34 }}>
          {hamparanBawah}
        </div>
      )}
    </div>
  );
}
