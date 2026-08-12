import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { cn, harga as fHarga } from '@/lib/utils';
import { ambilTickers, type Ticker } from '@/lib/pasar';
import { SIMBOL_DASAR } from '@/lib/simbol';

/* ════════════════════════════════════════════════════════════════════════
   WATCHLIST CHART — panel geser di sisi kanan grafik
   ════════════════════════════════════════════════════════════════════════
   Daftar koin yang menyatu dengan chartnya, ala TradingView: pegangan tipis
   di tepi kanan, ditarik terbuka saat dibutuhkan, satu klik pada barisnya
   mengganti simbol chart. Menambah koin dari sini, bukan bolak-balik ke
   kotak simbol di bilah atas.

   Harganya dari /api/tickers — permintaan yang SAMA dengan screener, sudah
   di-cache server 30 detik, jadi watchlist ini tidak menambah beban proxy
   sedikit pun yang berarti.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.watchChart';
const BAWAAN = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUTUSDT'];

function bacaDaftar(): string[] {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI) ?? 'null');
    if (Array.isArray(d) && d.length) return d.filter((x) => typeof x === 'string');
  } catch { /* privat */ }
  return BAWAAN;
}

export function WatchChart({ buka, onToggle, simbol, onPilih }: {
  buka: boolean;
  onToggle: () => void;
  simbol: string;
  onPilih: (s: string) => void;
}) {
  const [daftar, setDaftar] = useState<string[]>(bacaDaftar);
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [ketik, setKetik] = useState('');
  const bukaRef = useRef(buka);
  bukaRef.current = buka;

  function simpan(d: string[]) {
    setDaftar(d);
    try { localStorage.setItem(KUNCI, JSON.stringify(d)); } catch { /* privat */ }
  }

  /* Harga ditarik HANYA selagi panelnya terbuka — watchlist yang terlipat
     tidak berhak membebani jaringan. Sekali tarik saat dibuka, lalu tiap
     30 detik (umur cache servernya juga 30 detik). */
  useEffect(() => {
    if (!buka) return;
    let hidup = true;
    const tarik = () => void ambilTickers().then((t) => { if (hidup) setTickers(t); }).catch(() => { /* diam */ });
    tarik();
    const jam = setInterval(tarik, 30_000);
    return () => { hidup = false; clearInterval(jam); };
  }, [buka]);

  function tambah() {
    const v = ketik.trim().toUpperCase();
    if (!/^[A-Z0-9]{5,15}$/.test(v) || daftar.includes(v)) { setKetik(''); return; }
    simpan([...daftar, v]);
    setKetik('');
  }

  return (
    <div className={cn(
      'absolute inset-y-0 right-0 z-20 w-[236px] border-l border-zinc-800 bg-zinc-950/[.96] backdrop-blur transition-transform duration-300',
      buka ? 'translate-x-0' : 'translate-x-full')}>
      {/* Pegangan — selalu terlihat, menempel di tepi kiri panel. */}
      <button onClick={onToggle}
        title={buka ? 'Tutup watchlist' : 'Buka watchlist'}
        className="absolute -left-[22px] top-1/2 flex h-14 w-[22px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-md border border-r-0 border-zinc-800 bg-zinc-900/95 text-zinc-500 transition-colors hover:text-zinc-200">
        {buka ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
      </button>

      <div className="flex h-full flex-col">
        <div className="border-b border-zinc-800 px-3 py-2">
          <div className="mb-1.5 text-[12px] font-medium text-zinc-200">Watchlist</div>
          <div className="flex items-center gap-1">
            <input list="watchSimbol" value={ketik}
                   onChange={(e) => setKetik(e.target.value.toUpperCase())}
                   onKeyDown={(e) => { if (e.key === 'Enter') tambah(); }}
                   placeholder="Tambah koin…"
                   className="angka h-7 min-w-0 grow rounded border border-zinc-800 bg-zinc-900 px-2 text-[11.5px] text-zinc-200 outline-none focus-visible:border-zinc-600" />
            <datalist id="watchSimbol">
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
            const t = tickers[s];
            const naik = (t?.ubah24j ?? 0) >= 0;
            return (
              <div key={s}
                   onClick={() => onPilih(s)}
                   className={cn('group flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-zinc-900/70',
                     s === simbol && 'bg-zinc-900/50')}>
                <div className="min-w-0 grow">
                  <div className={cn('truncate text-[12px]', s === simbol ? 'text-zinc-100' : 'text-zinc-300')}>
                    {s.replace('USDT', '')}
                    <span className="text-zinc-600">/USDT</span>
                  </div>
                  <div className="angka text-[11px] text-zinc-500">{t ? fHarga(t.lastPrice) : '—'}</div>
                </div>
                <span className={cn('angka shrink-0 text-[11px]', naik ? 'text-emerald-500' : 'text-red-400')}>
                  {t ? `${naik ? '+' : ''}${t.ubah24j.toFixed(2)}%` : ''}
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
            <p className="px-3 py-6 text-center text-[11.5px] text-zinc-600">Watchlist kosong — tambah koin di atas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
