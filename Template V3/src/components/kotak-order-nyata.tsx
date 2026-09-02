import { useEffect, useRef, useState } from 'react';
import { TriangleAlert, Loader2, ExternalLink, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, uang, harga as fHarga } from '@/lib/utils';
import { bacaKoneksi, koneksiLengkap } from '@/lib/koneksi';
import { bacaPasar } from '@/lib/pasar';

/* ════════════════════════════════════════════════════════════════════════
   ORDER SUNGGUHAN DARI HALAMAN CHART
   ════════════════════════════════════════════════════════════════════════
   Jalurnya sama persis dengan Open Real Order di Screener Entry:
   `POST /api/trade/futures` ke VPS milik pengguna sendiri, dijaga App Token.
   Kunci API Binance tidak pernah menyentuh halaman ini — ia hanya ada di
   `.env` VPS-nya.

   BENTUK PERMINTAANNYA MENGIKUTI BACKEND, BUKAN SEBALIKNYA.
   ──────────────────────────────────────────────────────────────────────
   Backend menuntut `quantity`, `sl`, `tp1`, `qty1` — dan menolak tanpa
   semuanya, karena posisi tanpa proteksi adalah kejadian nyata yang pernah
   menggantung (SANDUSDT). Kuantitas dibulatkan menurut aturan simbol dari
   `/api/symbol-filters`; menebak presisinya berarti ditolak Binance dengan
   -1111 tepat saat ordernya paling ingin masuk.

   LIMA METODE TP — SAMA PERSIS dengan Area Entry di Screener:
   partial / nopartial / tp1only / tp2only / slplus. Dua di antaranya
   (nopartial, slplus) bergantung pada pemantau berkala yang hidup di
   halaman Screener Entry; batas itu ditulis di layar, bukan disembunyikan.
   ════════════════════════════════════════════════════════════════════════ */

const KELAS_ISIAN =
  'h-8 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[12px] text-zinc-200 ' +
  'outline-none transition-colors hover:border-zinc-700 focus-visible:border-zinc-600';

const METODE = [
  { nilai: 'partial', label: 'TP1 & TP2 — partial 50% di TP1, SL ke BE' },
  { nilai: 'nopartial', label: 'TP1 & TP2 — SL ke BE di TP1, tanpa partial' },
  { nilai: 'tp1only', label: 'SL & TP1 saja (1× risiko)' },
  { nilai: 'tp2only', label: 'SL & TP2 saja (2× risiko)' },
  { nilai: 'slplus', label: 'SL+ — partial 50% di TP1, SL naik tiap 1× risiko' },
] as const;
type Metode = typeof METODE[number]['nilai'];

/** Pembulatan ke kelipatan step — aturan yang sama dengan roundToStep di V2. */
function keStep(n: number, step: number, presisi: number | null) {
  const v = Math.floor(n / step) * step;
  return v.toFixed(presisi ?? 6);
}

export function KotakOrderNyata({ simbol, hargaKini, arahTerkunci, slAwal, tpAwal, entryAwal, jenisAwal, onBatal }: {
  simbol: string;
  hargaKini?: number;
  /* Arah yang SUDAH dipilih di tiket chart. Kalau ada, kotak ini tidak lagi
     menawarkan dua tombol — menawarkan arah lagi setelah arahnya dipilih
     adalah kesempatan kedua untuk salah tekan, bukan keleluasaan. */
  arahTerkunci?: 'BUY' | 'SELL';
  slAwal?: number;
  tpAwal?: number;
  /** Harga entry dari garis yang digeser di chart. */
  entryAwal?: number;
  /** Jenis order hasil LETAK garis entry: MARKET / LIMIT / STOP. */
  jenisAwal?: 'MARKET' | 'LIMIT' | 'STOP';
  onBatal?: () => void;
}) {
  /* ── BURSA TUJUAN MENGIKUTI CHART YANG SEDANG DILIHAT ─────────────────
     Bukan saklar terpisah, dan bukan tebakan server. `bacaPasar` menyimpan
     pasar yang BENAR-BENAR dipakai proxy untuk menggambar lilin simbol ini,
     jadi order berangkat ke bursa yang candle-nya sedang ditatap orangnya.

     Alternatifnya lebih buruk. Saklar sendiri menambah satu keputusan tiap
     order dan pasti suatu saat tertinggal di posisi yang salah. Menyerahkan
     ke tebakan server berarti layar tidak tahu ke mana ordernya pergi —
     dan mengirim order Binance sambil menatap chart Hyperliquid adalah
     jebakan yang cepat atau lambat menggigit.

     ── "BELUM TAHU" BUKAN "BINANCE" ────────────────────────────────────
     Versi pertama menjatuhkan pasar yang belum terbaca ke 'binance' dan
     mengirimnya TEGAS. Itu keliru dengan cara yang mahal: medan yang tegas
     mengalahkan tebakan server, jadi order CASHCAT — koin yang justru jadi
     alasan jalur ini dibangun — akan dipaksa ke Binance dan ditolak di
     sana, hanya karena layar kebetulan belum sempat mencatat pasarnya.

     Sekarang medan itu DIHILANGKAN saat pasarnya belum terbaca, dan server
     memakai tebakannya sendiri (ada di Binance? ke Binance; kalau tidak,
     coba Hyperliquid). Bawaan yang benar untuk "tidak tahu" adalah diam,
     bukan menebak dengan nada yakin. */
  const pasarSimbol = bacaPasar(simbol);
  const bursa: 'binance' | 'hyperliquid' | null =
    pasarSimbol === 'hyperliquid' ? 'hyperliquid' : pasarSimbol ? 'binance' : null;
  const namaBursa = bursa === 'hyperliquid' ? 'Hyperliquid'
                  : bursa === 'binance' ? 'Binance' : 'otomatis';
  const koneksi = bacaKoneksi();
  const siap = koneksiLengkap(koneksi);

  const [modal, setModal] = useState(100);
  const [leverage, setLeverage] = useState(4);
  const [sl, setSl] = useState(slAwal ? String(slAwal) : '');
  const [tp, setTp] = useState(tpAwal ? String(tpAwal) : '');
  const [metode, setMetode] = useState<Metode>('partial');
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [gagal, setGagal] = useState(false);
  /* Order pending yang baru terkirim — dipantau sampai terisi supaya SL/TP
     bisa dipasang. Tanpa pemantauan ini, entry LIMIT/STOP yang ke-fill
     berdiri TANPA proteksi sampai seseorang kebetulan memeriksanya. */
  const [pantau, setPantau] = useState<{ arah: 'BUY' | 'SELL'; qty: string; sl: string; tp1: string; qty1: string; tp2?: string; qty2?: string } | null>(null);
  const jagaPantau = useRef(pantau);
  jagaPantau.current = pantau;

  const jenis = jenisAwal ?? 'MARKET';
  const hargaEntry = jenis === 'MARKET' ? hargaKini : (entryAwal ?? hargaKini);
  const nilaiOrder = modal * leverage;
  const qtyKasar = hargaEntry ? nilaiOrder / hargaEntry : 0;

  /* ── Pemantau fill untuk entry LIMIT/STOP ──────────────────────────── */
  useEffect(() => {
    if (!pantau) return;
    const dasar = koneksi.url.trim().replace(/\/+$/, '');
    const jam = setInterval(async () => {
      const pj = jagaPantau.current;
      if (!pj) return;
      try {
        const r = await fetch(`${dasar}/api/positions`, { headers: { 'X-App-Token': koneksi.token.trim() } });
        const j = await r.json();
        const pos = (Array.isArray(j) ? j : j.positions ?? []).find(
          (x: { symbol?: string; positionAmt?: string }) => x.symbol === simbol && Math.abs(Number(x.positionAmt)) > 0
        );
        if (!pos) return;
        /* Terisi → pasang SL/TP1/TP2 lewat rute yang memang disediakan
           backend untuk kasus ini. */
        await fetch(`${dasar}/api/trade/futures/attach-sltp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-App-Token': koneksi.token.trim() },
          body: JSON.stringify({
            ...(bursa ? { bursa } : {}),
            symbol: simbol, side: pj.arah, quantity: pj.qty,
            sl: pj.sl, tp1: pj.tp1, qty1: pj.qty1,
            ...(pj.tp2 && pj.qty2 ? { tp2: pj.tp2, qty2: pj.qty2 } : {}),
          }),
        });
        setPantau(null);
        setKabar(`Entry terisi — SL/TP terpasang untuk ${simbol}.`);
      } catch { /* coba lagi putaran berikutnya */ }
    }, 10_000);
    return () => clearInterval(jam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantau !== null]);

  if (!siap) {
    return (
      <div className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div className="min-w-0 text-[12.5px] leading-relaxed text-amber-200/90">
          Order sungguhan butuh Backend URL dan App Token milik VPS-mu sendiri.
          <Link to="/integrations" className="ml-1 inline-flex items-center gap-1 text-amber-300 underline underline-offset-2">
            Pasang di Integrations <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    );
  }

  async function kirim(arah: 'BUY' | 'SELL') {
    if (!hargaEntry) { setGagal(true); setKabar('Harga belum termuat.'); return; }
    const slN = Number(sl) || 0;
    const tpN = Number(tp) || 0;
    if (slN <= 0 || tpN <= 0) {
      setGagal(true);
      setKabar('SL dan TP wajib terisi — backend menolak posisi tanpa proteksi, dan itu disengaja.');
      return;
    }
    const sisiBenar = arah === 'BUY' ? slN < hargaEntry && tpN > hargaEntry : slN > hargaEntry && tpN < hargaEntry;
    if (!sisiBenar) {
      setGagal(true);
      setKabar('SL/TP berada di sisi yang salah terhadap harga entry.');
      return;
    }

    setSibuk(true); setKabar(''); setGagal(false);
    const dasar = koneksi.url.trim().replace(/\/+$/, '');
    try {
      /* Aturan presisi simbol — WAJIB sebelum menghitung qty. */
      const rf = await fetch(`${dasar}/api/symbol-filters?symbol=${simbol}`, {
        headers: { 'X-App-Token': koneksi.token.trim() },
      });
      const f = await rf.json();
      if (!rf.ok) throw new Error(f.error || `symbol-filters menjawab ${rf.status}`);
      const stepSize: number = f.stepSize || 0.001;
      const tickSize: number = f.tickSize || 0.01;
      const qP: number | null = f.quantityPrecision ?? null;
      const pP: number | null = f.pricePrecision ?? null;

      const qtyStr = keStep(qtyKasar, stepSize, qP);
      if (Number(qtyStr) <= 0) throw new Error('Modal terlalu kecil untuk lot minimum simbol ini.');
      const slStr = keStep(slN, tickSize, pP);

      /* TP1 = 1× risiko, TP2 = 2× risiko — rumus yang sama dengan Area Entry.
         Kotak TP yang diisi orangnya (atau digeser di chart) dipakai sebagai
         TP1; TP2 dihitung dari jarak SL. */
      const jarak = Math.abs(hargaEntry - slN);
      const tp2N = arah === 'BUY' ? hargaEntry + jarak * 2 : hargaEntry - jarak * 2;
      const tp1Str = keStep(tpN, tickSize, pP);
      const tp2Str = keStep(tp2N, tickSize, pP);

      let qty1 = qtyStr, tp1Kirim = tp1Str, tp2Kirim: string | undefined, qty2Kirim: string | undefined;
      if (metode === 'partial' || metode === 'slplus') {
        const setengah = keStep(Number(qtyStr) / 2, stepSize, qP);
        const sisa = (Number(qtyStr) - Number(setengah)).toFixed(qP ?? 6);
        if (Number(setengah) > 0 && Number(sisa) > 0) {
          qty1 = setengah;
          if (metode === 'partial') { tp2Kirim = tp2Str; qty2Kirim = sisa; }
          /* slplus TIDAK mengirim tp2 sebagai order — level itu dikelola
             pemantau ratchet di halaman Screener Entry, sama seperti di V2. */
        }
      } else if (metode === 'nopartial' || metode === 'tp2only') {
        tp1Kirim = tp2Str; /* satu TP penuh di 2× risiko */
      }

      const rincian = [
        `${arah} ${simbol} · ${jenis === 'MARKET' ? 'Market' : `${arah === 'BUY' ? 'Buy' : 'Sell'} ${jenis === 'STOP' ? 'Stop' : 'Limit'} @ ${fHarga(hargaEntry)}`}`,
        `Nilai order ${uang(nilaiOrder)} (modal ${uang(modal)} × ${leverage}) · qty ${qtyStr}`,
        `SL ${slStr} · TP1 ${tp1Kirim} (qty ${qty1})${tp2Kirim ? ` · TP2 ${tp2Kirim} (qty ${qty2Kirim})` : ''}`,
        `Metode: ${METODE.find((m) => m.nilai === metode)?.label}`,
      ].join('\n');
      /* Dulu selalu menulis "ke Binance". Kalimat konfirmasi yang menyebut
         bursa yang salah lebih buruk daripada tidak menyebut bursa sama
         sekali: ia meyakinkan orangnya tentang hal yang keliru, tepat pada
         detik ia menimbang uang sungguhan. */
      const kalimatBursa = bursa
        ? `Kirim order SUNGGUHAN ke ${namaBursa}?`
        : 'Kirim order SUNGGUHAN? (bursanya dipilih server — pasar simbol ini belum terbaca di layar)';
      if (!confirm(`${kalimatBursa}\n\n${rincian}\n\nUang sungguhan akan bergerak.`)) { setSibuk(false); return; }

      const r = await fetch(`${dasar}/api/trade/futures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': koneksi.token.trim() },
        body: JSON.stringify({
          /* Dikirim TEGAS. Server punya tebakannya sendiri sebagai cadangan,
             tapi yang tahu chart mana yang sedang dibuka cuma layar ini. */
          ...(bursa ? { bursa } : {}),
          symbol: simbol, side: arah, quantity: qtyStr, leverage,
          entryType: jenis === 'MARKET' ? 'MARKET' : jenis === 'LIMIT' ? 'LIMIT' : 'STOP_MARKET',
          entryPrice: jenis === 'MARKET' ? undefined : keStep(hargaEntry, tickSize, pP),
          sl: slStr, tp1: tp1Kirim, qty1,
          ...(tp2Kirim ? { tp2: tp2Kirim, qty2: qty2Kirim } : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const tahap = j.stage ? `[gagal di: ${j.stage}] ` : '';
        throw new Error(tahap + (j.error ? JSON.stringify(j.error).slice(0, 200) : `Backend menjawab ${r.status}`));
      }
      if (j.pending) {
        setPantau({ arah, qty: qtyStr, sl: slStr, tp1: tp1Kirim, qty1, tp2: tp2Kirim, qty2: qty2Kirim });
        setKabar(`Order ${jenis} menggantung di Binance — halaman ini memantau tiap 10 detik dan memasang SL/TP begitu terisi. Biarkan tab-nya terbuka.`);
      } else {
        setKabar(`Order terkirim — ${arah} ${simbol} ${uang(nilaiOrder)}. Posisinya muncul di Dashboard dan jurnal kripto.`);
      }
    } catch (e) {
      setGagal(true);
      setKabar(e instanceof Error ? e.message : 'Gagal mengirim order');
    } finally { setSibuk(false); }
  }

  return (
    <div className="rounded-lg border border-red-500/25 bg-red-500/[0.03] p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <Radio className="size-3.5 text-red-400" />
        <span className="text-[11.5px] font-medium uppercase tracking-wider text-red-400">
          Live · order sungguhan{arahTerkunci ? ` · ${arahTerkunci} ${simbol}` : ''}
          {jenis !== 'MARKET' && ` · ${jenis === 'STOP' ? 'Stop' : 'Limit'} @ ${hargaEntry ? fHarga(hargaEntry) : '—'}`}
        </span>
        {/* Lencana bursa, SELALU terlihat — bukan cuma saat Hyperliquid.
            Lencana yang muncul hanya untuk satu keadaan mengajari orang
            membaca ketiadaannya sebagai "biasa saja", dan ketiadaan yang
            berarti sesuatu adalah tanda yang paling mudah terlewat. Warnanya
            sama dengan yang dipakai panel Posisi Copy untuk bursa yang sama:
            satu lambang, satu arti, di seluruh aplikasi. */}
        <span
          title={bursa
            ? `Order berangkat ke ${namaBursa} — mengikuti pasar chart yang sedang tampil.`
            : 'Pasar simbol ini belum terbaca di layar; server yang memilih bursanya.'}
          className={cn('rounded px-1.5 py-0.5 text-[10.5px] font-medium',
            bursa === 'hyperliquid' ? 'bg-sky-500/15 text-sky-300'
            : bursa === 'binance' ? 'bg-amber-500/15 text-amber-300'
            : 'bg-zinc-700/50 text-zinc-400')}>
          {namaBursa}
        </span>
        <span className="ml-auto text-[11.5px] text-zinc-500">
          Nilai order <span className="angka text-zinc-300">{uang(nilaiOrder)}</span>
        </span>
        {onBatal && (
          <button onClick={onBatal}
            className="cursor-pointer rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200">
            Batal
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">Modal ($)</label>
          <input type="number" value={modal} onChange={(e) => setModal(Number(e.target.value) || 0)} className={cn(KELAS_ISIAN, 'angka')} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">Leverage</label>
          <input type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value) || 1)} className={cn(KELAS_ISIAN, 'angka')} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">SL</label>
          <input value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" className={cn(KELAS_ISIAN, 'angka')} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">TP1</label>
          <input value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" className={cn(KELAS_ISIAN, 'angka')} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-[11px] text-zinc-500">Metode TP</label>
          <select value={metode} onChange={(e) => setMetode(e.target.value as Metode)}
                  className={cn(KELAS_ISIAN, 'cursor-pointer')}>
            {METODE.map((m) => <option key={m.nilai} value={m.nilai}>{m.label}</option>)}
          </select>
        </div>

        {arahTerkunci ? (
          <button onClick={() => void kirim(arahTerkunci)} disabled={sibuk}
            className={cn('flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[12px] font-semibold transition-colors disabled:opacity-50 sm:col-span-3',
              arahTerkunci === 'BUY'
                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-red-500/20 text-red-300 hover:bg-red-500/30')}>
            {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : null} Kirim {arahTerkunci} sungguhan
          </button>
        ) : (
          <>
            <button onClick={() => void kirim('BUY')} disabled={sibuk}
              className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-emerald-500/20 text-[12px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-50">
              {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : null} BUY
            </button>
            <button onClick={() => void kirim('SELL')} disabled={sibuk}
              className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-red-500/20 text-[12px] font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:opacity-50">
              {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : null} SELL
            </button>
          </>
        )}
      </div>

      {kabar && (
        <div className={cn('mt-2 text-[12px]', gagal ? 'text-amber-300/90' : 'text-emerald-400')}>{kabar}</div>
      )}
      <div className="mt-2 text-[11px] leading-relaxed text-zinc-600">
        TP2 dihitung otomatis 2× jarak SL, mengikuti rumus Area Entry. Metode{' '}
        <span className="text-zinc-400">nopartial</span> dan <span className="text-zinc-400">SL+</span>{' '}
        butuh pemantau yang hidup di halaman Screener Entry — pindah-BE dan ratchet SL berjalan selama
        halaman itu terbuka. Kunci API Binance tidak pernah menyentuh halaman ini.
      </div>
    </div>
  );
}
