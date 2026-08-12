import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { cn, harga as fHarga } from '@/lib/utils';
import { ambilTickers, hargaTickMt5, daftarSimbolMt5, type Ticker } from '@/lib/pasar';
import { SIMBOL_DASAR } from '@/lib/simbol';

/* ════════════════════════════════════════════════════════════════════════
   WATCHLIST CHART — panel geser di sisi kanan grafik
   ════════════════════════════════════════════════════════════════════════
   Daftar pantauan yang menyatu dengan chartnya, ala TradingView: pegangan
   tipis di tepi kanan, LEBARNYA BISA DITARIK dari tepi kirinya dan diingat,
   satu klik pada barisnya mengganti simbol chart.

   Dua jenis baris hidup berdampingan:
     · koin Binance — harga & perubahan 24 jam dari /api/tickers
     · pair Trade-Fi (MT5:XAUUSD dst.) — harga tick dari EA v2, disegarkan
       tiap 5 detik selama panelnya terbuka
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.watchChart';
const KUNCI_LEBAR = 'jt.watchLebar';
const BAWAAN = ['MT5:XAUUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUTUSDT'];

function bacaDaftar(): string[] {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI) ?? 'null');
    if (Array.isArray(d) && d.length) return d.filter((x) => typeof x === 'string');
  } catch { /* privat */ }
  return BAWAAN;
}

function bacaLebar(): number {
  try {
    const n = Number(localStorage.getItem(KUNCI_LEBAR));
    return n >= 180 && n <= 420 ? n : 236;
  } catch { return 236; }
}

export function WatchChart({ buka, onToggle, simbol, onPilih }: {
  buka: boolean;
  onToggle: () => void;
  simbol: string;
  onPilih: (s: string) => void;
}) {
  const [daftar, setDaftar] = useState<string[]>(bacaDaftar);
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [tickMt5, setTickMt5] = useState<Record<string, { bid: number; waktu: number }>>({});
  const [pilihanMt5, setPilihanMt5] = useState<string[]>([]);
  const [ketik, setKetik] = useState('');
  const [lebar, setLebar] = useState(bacaLebar);

  function simpan(d: string[]) {
    setDaftar(d);
    try { localStorage.setItem(KUNCI, JSON.stringify(d)); } catch { /* privat */ }
  }

  /* Harga ditarik HANYA selagi panelnya terbuka. Binance tiap 30 detik
     (umur cache servernya), tick MT5 tiap 5 detik — ia memang sumber yang
     berdetak per detik, dan watchlist ingin memperlihatkan detaknya. */
  useEffect(() => {
    if (!buka) return;
    let hidup = true;
    const tarikBinance = () => void ambilTickers().then((t) => { if (hidup) setTickers(t); }).catch(() => { /* diam */ });
    const tarikMt5 = () => void hargaTickMt5().then((t) => { if (hidup) setTickMt5(t); }).catch(() => { /* diam */ });
    tarikBinance();
    tarikMt5();
    void daftarSimbolMt5().then((d) => { if (hidup) setPilihanMt5(d); });
    const jamB = setInterval(tarikBinance, 30_000);
    const jamM = setInterval(tarikMt5, 5_000);
    return () => { hidup = false; clearInterval(jamB); clearInterval(jamM); };
  }, [buka]);

  function tambah() {
    const v = ketik.trim().toUpperCase();
    if (!/^(MT5:)?[A-Z0-9]{3,15}$/.test(v) || daftar.includes(v)) { setKetik(''); return; }
    simpan([...daftar, v]);
    setKetik('');
  }

  /* Tepi kiri panel BISA DITARIK — lebar pilihan orangnya diingat. */
  function mulaiTarikLebar(e: React.PointerEvent) {
    e.preventDefault();
    const awalX = e.clientX, awalL = lebar;
    const jepit = (n: number) => Math.min(420, Math.max(180, n));
    const gerak = (ev: PointerEvent) => setLebar(jepit(awalL + (awalX - ev.clientX)));
    const lepas = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      try { localStorage.setItem(KUNCI_LEBAR, String(Math.round(jepit(awalL + (awalX - ev.clientX))))); } catch { /* privat */ }
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
  }

  return (
    <div
      className={cn(
        'absolute inset-y-0 right-0 z-20 border-l border-zinc-800 bg-zinc-950/[.96] backdrop-blur transition-transform duration-300',
        buka ? 'translate-x-0' : 'translate-x-full')}
      style={{ width: lebar }}>
      {/* Pegangan buka-tutup — selalu terlihat di tepi kiri panel. */}
      <button onClick={onToggle}
        title={buka ? 'Tutup watchlist' : 'Buka watchlist'}
        className="absolute -left-[22px] top-1/2 flex h-14 w-[22px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-md border border-r-0 border-zinc-800 bg-zinc-900/95 text-zinc-500 transition-colors hover:text-zinc-200">
        {buka ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
      </button>

      {/* Penarik lebar — strip tipis di tepi kiri. */}
      {buka && (
        <div onPointerDown={mulaiTarikLebar}
             title="Tarik untuk mengatur lebar"
             className="absolute inset-y-0 -left-1 z-10 w-2 cursor-ew-resize" />
      )}

      <div className="flex h-full flex-col">
        <div className="border-b border-zinc-800 px-3 py-2">
          <div className="mb-1.5 text-[12px] font-medium text-zinc-200">Watchlist</div>
          <div className="flex items-center gap-1">
            <input list="watchSimbol" value={ketik}
                   onChange={(e) => setKetik(e.target.value.toUpperCase())}
                   onKeyDown={(e) => { if (e.key === 'Enter') tambah(); }}
                   placeholder="Tambah pair…"
                   className="angka h-7 min-w-0 grow rounded border border-zinc-800 bg-zinc-900 px-2 text-[11.5px] text-zinc-200 outline-none focus-visible:border-zinc-600" />
            <datalist id="watchSimbol">
              {pilihanMt5.filter((s) => !daftar.includes('MT5:' + s)).map((s) => (
                <option key={'MT5:' + s} value={'MT5:' + s}>Trade-Fi — MT5</option>
              ))}
              {SIMBOL_DASAR.filter((s) => !daftar.includes(s)).map((s) => <option key={s} value={s} />)}
            </datalist>
            <button onClick={tambah} title="Tambah"
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100">
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="gulir-senyap min-h-0 grow overflow-y-auto py-1">
          {daftar.map((s) => {
            const mt5 = s.startsWith('MT5:');
            const dasarS = mt5 ? s.slice(4) : s;
            const t = mt5 ? undefined : tickers[s];
            const tk = mt5 ? tickMt5[dasarS] : undefined;
            const naik = (t?.ubah24j ?? 0) >= 0;
            return (
              <div key={s}
                   onClick={() => onPilih(s)}
                   className={cn('group flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-zinc-900/70',
                     s === simbol && 'bg-zinc-900/50')}>
                <div className="min-w-0 grow">
                  <div className={cn('flex items-center gap-1.5 truncate text-[12px]', s === simbol ? 'text-zinc-100' : 'text-zinc-300')}>
                    {mt5 ? dasarS : (<>{s.replace('USDT', '')}<span className="text-zinc-600">/USDT</span></>)}
                    {mt5 && (
                      <span className="rounded bg-amber-500/15 px-1 text-[8.5px] font-semibold tracking-wide text-amber-300">MT5</span>
                    )}
                  </div>
                  <div className="angka text-[11px] text-zinc-500">
                    {mt5 ? (tk ? fHarga(tk.bid) : '—') : (t ? fHarga(t.lastPrice) : '—')}
                  </div>
                </div>
                <span className={cn('angka shrink-0 text-[11px]', mt5 ? 'text-zinc-600' : naik ? 'text-emerald-500' : 'text-red-400')}>
                  {mt5
                    ? (tk && Date.now() - tk.waktu < 30_000 ? 'live' : '')
                    : (t ? `${naik ? '+' : ''}${t.ubah24j.toFixed(2)}%` : '')}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); simpan(daftar.filter((x) => x !== s)); }}
                  title={`Hapus ${s}`}
                  className="hidden shrink-0 cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:text-red-400 group-hover:block">
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
          {daftar.length === 0 && (
            <p className="px-3 py-6 text-center text-[11.5px] text-zinc-600">Watchlist kosong — tambah pair di atas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
