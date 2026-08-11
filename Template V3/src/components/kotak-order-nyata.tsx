import { useState } from 'react';
import { TriangleAlert, Loader2, ExternalLink, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, uang, harga as fHarga } from '@/lib/utils';
import { bacaKoneksi, koneksiLengkap } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   ORDER SUNGGUHAN DARI HALAMAN CHART
   ════════════════════════════════════════════════════════════════════════
   Jalurnya sama persis dengan tombol Open Real Order di Screener Entry:
   `POST /api/trade/futures` ke VPS milik pengguna sendiri, dijaga App Token.
   Kunci API Binance tidak pernah menyentuh halaman ini — ia hanya ada di
   `.env` VPS-nya.

   PENJAGA. Tanpa Backend URL dan App Token, tombolnya tidak bisa ditekan
   sama sekali dan yang muncul adalah penunjuk ke Integrations. Tombol yang
   bisa ditekan lalu gagal dengan 401 adalah cara terburuk menyampaikan
   "kamu belum memasang apa pun".

   Ini UANG SUNGGUHAN. Karena itu ada konfirmasi berisi angka yang akan
   dikirim — bukan "yakin?" yang bisa diklik tanpa dibaca.
   ════════════════════════════════════════════════════════════════════════ */

const KELAS_ISIAN =
  'h-8 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[12px] text-zinc-200 ' +
  'outline-none transition-colors hover:border-zinc-700 focus-visible:border-zinc-600';

export function KotakOrderNyata({ simbol, hargaKini, arahTerkunci, slAwal, tpAwal, onBatal }: {
  simbol: string;
  hargaKini?: number;
  /* Arah yang SUDAH dipilih di tiket chart. Kalau ada, kotak ini tidak lagi
     menawarkan dua tombol — menawarkan arah lagi setelah arahnya dipilih
     adalah kesempatan kedua untuk salah tekan, bukan keleluasaan. */
  arahTerkunci?: 'BUY' | 'SELL';
  slAwal?: number;
  tpAwal?: number;
  onBatal?: () => void;
}) {
  const koneksi = bacaKoneksi();
  const siap = koneksiLengkap(koneksi);

  const [modal, setModal] = useState(100);
  const [leverage, setLeverage] = useState(4);
  const [sl, setSl] = useState(slAwal ? String(slAwal) : '');
  const [tp, setTp] = useState(tpAwal ? String(tpAwal) : '');
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [gagal, setGagal] = useState(false);

  const nilaiOrder = modal * leverage;
  const qty = hargaKini ? nilaiOrder / hargaKini : 0;

  if (!siap) {
    return (
      <div className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div className="min-w-0 text-[12.5px] leading-relaxed text-amber-200/90">
          Order sungguhan butuh Backend URL dan App Token milik VPS-mu sendiri.
          <Link to="/integrasi" className="ml-1 inline-flex items-center gap-1 text-amber-300 underline underline-offset-2">
            Pasang di Integrations <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    );
  }

  async function kirim(arah: 'BUY' | 'SELL') {
    if (!hargaKini) { setGagal(true); setKabar('Harga belum termuat.'); return; }
    const slN = Number(sl) || 0;
    const tpN = Number(tp) || 0;

    /* Konfirmasi menyebut ANGKA, bukan pertanyaan umum. Yang perlu diperiksa
       sebelum uang bergerak adalah besarnya, bukan niatnya. */
    const rincian = [
      `${arah} ${simbol}`,
      `Nilai order ${uang(nilaiOrder)} (modal ${uang(modal)} × ${leverage})`,
      `Perkiraan qty ${qty.toFixed(6)} @ ${fHarga(hargaKini)}`,
      slN ? `SL ${fHarga(slN)}` : 'TANPA STOP LOSS',
      tpN ? `TP ${fHarga(tpN)}` : 'tanpa take profit',
    ].join('\n');
    if (!confirm(`Kirim order SUNGGUHAN ke Binance?\n\n${rincian}\n\nUang sungguhan akan bergerak.`)) return;

    setSibuk(true); setKabar(''); setGagal(false);
    try {
      const dasar = koneksi.url.trim().replace(/\/+$/, '');
      const r = await fetch(`${dasar}/api/trade/futures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': koneksi.token.trim() },
        body: JSON.stringify({
          symbol: simbol, side: arah, type: 'MARKET',
          margin: modal, leverage,
          ...(slN ? { sl: slN } : {}), ...(tpN ? { tp1: tpN } : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ? JSON.stringify(j.error).slice(0, 180) : `Backend menjawab ${r.status}`);
      setKabar(`Order terkirim — ${arah} ${simbol} ${uang(nilaiOrder)}. Posisinya muncul di Dashboard dan jurnal kripto.`);
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
          <label className="mb-1 block text-[11px] text-zinc-500">SL (opsional)</label>
          <input value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" className={cn(KELAS_ISIAN, 'angka')} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">TP (opsional)</label>
          <input value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" className={cn(KELAS_ISIAN, 'angka')} />
        </div>
        {arahTerkunci ? (
          <button onClick={() => void kirim(arahTerkunci)} disabled={sibuk}
            className={cn('mt-[18px] flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[12px] font-semibold transition-colors disabled:opacity-50 sm:col-span-2',
              arahTerkunci === 'BUY'
                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-red-500/20 text-red-300 hover:bg-red-500/30')}>
            {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : null} Kirim {arahTerkunci} sungguhan
          </button>
        ) : (
          <>
            <button onClick={() => void kirim('BUY')} disabled={sibuk}
              className="mt-[18px] flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-emerald-500/20 text-[12px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-50">
              {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : null} BUY
            </button>
            <button onClick={() => void kirim('SELL')} disabled={sibuk}
              className="mt-[18px] flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-red-500/20 text-[12px] font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:opacity-50">
              {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : null} SELL
            </button>
          </>
        )}
      </div>

      {kabar && (
        <div className={cn('mt-2 text-[12px]', gagal ? 'text-amber-300/90' : 'text-emerald-400')}>{kabar}</div>
      )}
      <div className="mt-2 text-[11px] leading-relaxed text-zinc-600">
        Dikirim ke VPS milikmu sendiri, bukan ke server kami. Kunci API Binance tidak pernah
        menyentuh halaman ini. Harga eksekusi adalah harga PASAR saat order sampai di bursa —
        bukan {hargaKini ? fHarga(hargaKini) : 'harga di layar'}, yang bisa sudah berubah.
      </div>
    </div>
  );
}
