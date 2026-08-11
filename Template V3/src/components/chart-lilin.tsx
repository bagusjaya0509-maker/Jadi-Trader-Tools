import { useEffect, useRef } from 'react';
import {
  createChart, CandlestickSeries, LineSeries, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type IPriceLine, type Time,
} from 'lightweight-charts';
import type { Lilin } from '@/lib/pasar';
import type { TradeUji } from '@/lib/backtest';

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

export function ChartLilin({ lilin, garis, trade, tinggi = 420, hingga, garisHarga, onKlikBar, smi, mundur, pojok }: {
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
}) {
  const kotak = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const seri = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const seriGaris = useRef<ISeriesApi<'Line'>[]>([]);
  const penanda = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const seriSmi = useRef<ISeriesApi<'Line'>[]>([]);
  const garisPos = useRef<IPriceLine[]>([]);
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
    c.subscribeClick((p) => {
      if (klikRef.current && typeof p.logical === 'number') klikRef.current(Math.round(p.logical));
    });

    return () => { c.remove(); chart.current = null; seri.current = null; seriGaris.current = []; penanda.current = null; garisPos.current = []; };
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
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    seriSmi.current.forEach((s) => { try { c.removeSeries(s); } catch { /* sudah lepas */ } });
    seriSmi.current = [];
    if (!smi || !lilin.times.length) return;

    const batas = hingga === undefined ? lilin.times.length : Math.max(1, Math.min(lilin.times.length, hingga + 1));
    const buat = (nilai: (number | null)[], warna: string, tebal: 1 | 2) => {
      const s = c.addSeries(LineSeries, {
        color: warna, lineWidth: tebal, priceLineVisible: false, lastValueVisible: false,
      }, 1);
      s.setData(
        lilin.times.slice(0, batas)
          .map((t, i) => ({ time: Math.floor(t / 1000) as Time, value: nilai[i] }))
          .filter((x): x is { time: Time; value: number } => x.value != null && isFinite(x.value))
      );
      seriSmi.current.push(s);
    };
    buat(smi.smi, '#fbbf24', 2);
    buat(smi.signal, '#60a5fa', 1);

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
    try { c.panes()[1]?.setHeight(110); } catch { /* versi tanpa panes API */ }
  }, [smi, lilin, hingga]);

  /* Garis indikator */
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
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
  }, [garis, lilin, hingga]);

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
    ]).sort((a, b) => (a.time as number) - (b.time as number));
    p.setMarkers(tanda);
  }, [trade]);

  return (
    <div className="relative">
      <div ref={kotak} style={{ height: tinggi }} className="w-full" />

      {/* Hitung mundur MENEMPEL di sisi skala harga, sejajar label harga
          terakhir — sama seperti TradingView. Ditumpangkan sebagai elemen
          biasa, bukan digambar ke kanvas: lightweight-charts tidak punya
          jalan untuk menambah label di sana, dan menggambarnya sendiri
          berarti ikut mengurus posisi tiap kali skalanya bergeser. */}
      {mundur && (
        <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 pr-1">
          <span className="angka rounded bg-zinc-800/95 px-1.5 py-0.5 text-[10.5px] tabular-nums text-zinc-300 ring-1 ring-zinc-700">
            {mundur}
          </span>
        </div>
      )}

      {pojok && <div className="absolute left-2 top-2 z-10">{pojok}</div>}
    </div>
  );
}
