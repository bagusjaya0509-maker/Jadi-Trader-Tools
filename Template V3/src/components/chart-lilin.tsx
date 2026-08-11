import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChart, CandlestickSeries, LineSeries, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type IPriceLine, type Time,
} from 'lightweight-charts';
import type { Lilin } from '@/lib/pasar';
import { cn, harga as fHarga } from '@/lib/utils';
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
  bisaSeret?: boolean;
}

export function ChartLilin({
  lilin, garis, trade, tinggi = 420, hingga, garisHarga, onKlikBar, smi, mundur, pojok,
  garisSeret, onSeret, hamparanBawah,
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
  /** Panel yang ditumpangkan di bagian bawah area harga — dipakai kendali
   *  replay, supaya ia menyatu dengan grafik alih-alih memanjangkan halaman. */
  hamparanBawah?: React.ReactNode;
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

  /* ── Menerjemahkan harga -> koordinat layar ────────────────────────
     Dipakai label harga dan garis seret. Disegarkan tiap 200 ms, bukan
     dihitung sekali: skala harga bergeser saat orang men-zoom, menggeser,
     atau saat lilin baru masuk — dan tidak ada satu peristiwa pun yang
     menandai semuanya. Satu panggilan `priceToCoordinate` per 200 ms terlalu
     murah untuk diperdebatkan. */
  const [koordinat, setKoordinat] = useState<Record<string, number>>({});
  const seret = useRef<{ id: string; mulaiY: number } | null>(null);

  const hargaDariY = useCallback((y: number) => {
    const s = seri.current;
    if (!s || !kotak.current) return null;
    const rect = kotak.current.getBoundingClientRect();
    const v = s.coordinateToPrice(y - rect.top);
    return typeof v === 'number' && isFinite(v) ? v : null;
  }, []);

  useEffect(() => {
    const hitung = () => {
      const s = seri.current;
      if (!s) return;
      const out: Record<string, number> = {};
      (garisSeret ?? []).forEach((g) => {
        const y = s.priceToCoordinate(g.harga);
        if (typeof y === 'number') out[g.id] = y;
      });
      const t = lilin.closes.length
        ? s.priceToCoordinate(lilin.closes[(hingga === undefined ? lilin.closes.length : Math.min(lilin.closes.length, hingga + 1)) - 1])
        : null;
      if (typeof t === 'number') out.__harga = t;
      setKoordinat(out);
    };
    hitung();
    const jam = setInterval(hitung, 200);
    return () => clearInterval(jam);
  }, [garisSeret, lilin, hingga]);

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

  const hargaTerakhir = lilin.closes.length
    ? lilin.closes[(hingga === undefined ? lilin.closes.length : Math.min(lilin.closes.length, hingga + 1)) - 1]
    : undefined;

  return (
    <div className="relative">
      <div ref={kotak} style={{ height: tinggi }} className="w-full" />

      {/* Harga + hitung mundur dalam SATU kotak, menempel di garis harga —
          sama seperti TradingView. Dua kotak terpisah bergeser sendiri-sendiri
          saat skalanya berubah dan terbaca sebagai dua hal yang tak
          berhubungan; yang sebenarnya terjadi adalah satu hal: harga sekarang,
          dan berapa lama lagi lilinnya menutup. */}
      {mundur && hargaTerakhir !== undefined && koordinat.__harga !== undefined && (
        <div className="pointer-events-none absolute right-0 z-10 pr-0.5"
             style={{ top: koordinat.__harga, transform: 'translateY(-50%)' }}>
          <div className="flex flex-col items-end rounded bg-zinc-100 px-1.5 py-0.5 leading-tight text-zinc-950 shadow">
            <span className="angka text-[10.5px] font-medium tabular-nums">{fHarga(hargaTerakhir)}</span>
            <span className="angka text-[9.5px] tabular-nums opacity-70">{mundur}</span>
          </div>
        </div>
      )}

      {/* Garis entry / SL / TP yang bisa digeser. */}
      {(garisSeret ?? []).map((g) => {
        const y = koordinat[g.id];
        if (y === undefined) return null;
        const bisa = g.bisaSeret !== false && !!onSeret;
        return (
          <div key={g.id}
               className={cn('absolute left-0 right-0 z-10 flex items-center',
                 bisa ? 'cursor-ns-resize' : 'pointer-events-none')}
               style={{ top: y, transform: 'translateY(-50%)', height: 14 }}
               onMouseDown={bisa ? (e) => mulaiSeret(g.id, e) : undefined}>
            <div className="h-px flex-1" style={{
              background: `repeating-linear-gradient(90deg, ${g.warna} 0 6px, transparent 6px 11px)`,
            }} />
            <span className="angka mr-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-950 shadow"
                  style={{ background: g.warna }}>
              {g.label} {fHarga(g.harga)}
            </span>
          </div>
        );
      })}

      {pojok && <div className="absolute left-2 top-2 z-20">{pojok}</div>}

      {/* Kendali replay ditumpangkan di dasar area harga, bukan di panel
          terpisah di bawah chart — latarnya tembus supaya menyatu dengan
          grafiknya. */}
      {hamparanBawah && (
        <div className="absolute inset-x-2 z-20" style={{ bottom: smi ? 132 : 34 }}>
          {hamparanBawah}
        </div>
      )}
    </div>
  );
}
