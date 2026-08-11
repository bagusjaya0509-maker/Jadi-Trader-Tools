import { useState } from 'react';
import { TrendingUp, TrendingDown, X, Check, Ban, CandlestickChart, Minus, Hourglass } from 'lucide-react';
import { cn, uang, harga as fHarga } from '@/lib/utils';
import { METODE_TP, type MetodeTp } from '@/lib/order-nyata';

/* ════════════════════════════════════════════════════════════════════════
   TIKET ORDER DI POJOK CHART
   ════════════════════════════════════════════════════════════════════════
   Ditaruh di atas grafik, bukan di panel terpisah di bawahnya. Alasannya
   bukan kerapian: saat mengambil keputusan mata sedang di chart, dan
   memindahkan pandangan ke bawah layar untuk menekan tombol adalah tempat
   paling sering orang salah tekan arah.

   DUA LANGKAH, BUKAN SATU.
   ──────────────────────────────────────────────────────────────────────
   Menekan BUY tidak membuka posisi. Yang terjadi adalah tiga garis muncul
   di chart — entry, SL, TP — yang bisa digeser sampai letaknya benar, dan
   baru setelah "Kirim" ditekan ordernya berangkat.

   Satu klik yang langsung mengirim order dengan SL hasil tebakan rumus
   adalah cara tercepat memasang stop di tempat yang tidak pernah dipilih
   siapa pun. Level adalah keputusan; tombol hanya menjalankannya.
   ════════════════════════════════════════════════════════════════════════ */

export interface RencanaOrder { entry?: number; sl?: number; tp?: number }

const KELAS_ISIAN =
  'h-7 w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 text-[11px] text-zinc-100 ' +
  'outline-none transition-colors focus-visible:border-zinc-500';

const KUNCI_TUTUP = 'jt.pojokTutup';

export function PojokOrder({
  posisi, hargaKini, draf, rencana, mode, jenis, risiko, tunda, onBatalTunda,
  onPilih, onUbah, onKirim, onBatal, onTutup, onGantiMode, mati,
  nyataSetelan, aturNyata, sibukNyata, kabar, demoSetelan, aturDemo,
}: {
  posisi: { arah: 'BUY' | 'SELL'; masuk: number; sl: number; tp: number; pnl: number; risiko: number; unit: number } | null;
  hargaKini?: number;
  /** Label jenis order hasil letak garis entry: "Market", "Buy Limit", dst. */
  jenis?: string;
  /** Risiko dolar menurut setelan saat ini. */
  risiko?: number;
  /** Pending order demo yang sedang menunggu harganya tersentuh. */
  tunda?: { arah: 'BUY' | 'SELL'; jenis: 'MARKET' | 'LIMIT' | 'STOP'; entry: number; sl: number; tp: number } | null;
  onBatalTunda?: () => void;
  /** Arah tiket yang sedang disusun. null = belum ada tiket. */
  draf: 'BUY' | 'SELL' | null;
  rencana: RencanaOrder;
  mode: 'demo' | 'real';
  onPilih: (arah: 'BUY' | 'SELL') => void;
  onUbah: (r: RencanaOrder) => void;
  onKirim: () => void;
  onBatal: () => void;
  onTutup: () => void;
  onGantiMode: (m: 'demo' | 'real') => void;
  mati?: boolean;
  /** Setelan order sungguhan — modal, leverage, metode TP. Diangkat ke
   *  halaman supaya label risiko di garis chart memakai angka yang sama. */
  nyataSetelan?: { modal: number; leverage: number; metode: MetodeTp };
  aturNyata?: (s: { modal: number; leverage: number; metode: MetodeTp }) => void;
  sibukNyata?: boolean;
  /** Kabar terakhir dari pengiriman order (sukses/gagal/pending). */
  kabar?: string;
  /** Setelan demo — modal, % risiko, usulan SL×ATR dan R:R. Dulu di panel
   *  bawah yang cuma muncul saat replay; order demo tidak bergantung pada
   *  replay, jadi setelannya pun tidak boleh. */
  demoSetelan?: { modal: number; risikoPersen: number; kaliAtr: number; rr: number };
  aturDemo?: (s: { modal: number; risikoPersen: number; kaliAtr: number; rr: number }) => void;
}) {
  const nyata = mode === 'real';
  /* Terlipat atau terbuka — pilihan yang diingat. Saat ada tiket, posisi,
     atau pending, panelnya SELALU tampil: keadaan yang sedang membawa uang
     tidak boleh tersembunyi di balik ikon. */
  const [tutupPanel, setTutupPanel] = useState(() => {
    try { return localStorage.getItem(KUNCI_TUTUP) === '1'; } catch { return false; }
  });
  function aturTutup(v: boolean) {
    setTutupPanel(v);
    try { localStorage.setItem(KUNCI_TUTUP, v ? '1' : '0'); } catch { /* privat */ }
  }

  const Lencana = (
    <button onClick={() => onGantiMode(nyata ? 'demo' : 'real')}
      title={nyata ? 'Ganti ke latihan (demo)' : 'Ganti ke order sungguhan (real)'}
      className={cn('cursor-pointer rounded px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide transition-colors',
        nyata ? 'bg-red-500/25 text-red-300 hover:bg-red-500/35'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200')}>
      {nyata ? 'REAL' : 'DEMO'}
    </button>
  );

  /* ── Pending order menunggu ────────────────────────────────────────── */
  if (tunda) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-zinc-900/90 px-2 py-1.5 backdrop-blur-sm">
        {Lencana}
        <Hourglass className="size-3.5 text-amber-400" />
        <span className="text-[11px] text-amber-200/90">
          {tunda.arah === 'BUY' ? 'Buy' : 'Sell'} {tunda.jenis === 'STOP' ? 'Stop' : 'Limit'}{' '}
          <span className="angka">{fHarga(tunda.entry)}</span> menunggu
        </span>
        <button onClick={onBatalTunda} title="Batalkan pending order"
          className="flex cursor-pointer items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-500">
          <Ban className="size-3" /> Batal
        </button>
      </div>
    );
  }

  /* ── Posisi sudah berjalan ─────────────────────────────────────────── */
  if (posisi) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/90 px-2 py-1.5 backdrop-blur-sm">
        {Lencana}
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold',
          posisi.arah === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
          {posisi.arah}
        </span>
        <span className="angka text-[11px] text-zinc-400">{fHarga(posisi.masuk)}</span>
        <span className={cn('angka text-[11.5px] font-medium', posisi.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {uang(posisi.pnl, true)}
        </span>
        <button onClick={onTutup} title="Tutup posisi"
          className="flex cursor-pointer items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-500">
          <X className="size-3" /> Tutup
        </button>
      </div>
    );
  }

  /* ── Tiket sedang disusun ──────────────────────────────────────────── */
  if (draf) {
    const { entry, sl, tp } = rencana;
    /* Risk : Reward dihitung dari level yang SEDANG terpasang, bukan dari
       setelan. Angka ini satu-satunya cara tahu apakah seretan barusan
       merusak rencananya — dan ia harus ikut berubah selagi digeser. */
    const risk = entry && sl ? Math.abs(entry - sl) : 0;
    const reward = entry && tp ? Math.abs(tp - entry) : 0;
    const rr = risk > 0 && reward > 0 ? reward / risk : null;
    /* SL di sisi yang salah bukan sekadar RR jelek — ia order yang langsung
       kena begitu terkirim. Ditahan di sini, bukan ditolak backend. */
    const arahBenar = !entry || !sl || !tp
      ? false
      : draf === 'BUY' ? sl < entry && tp > entry : sl > entry && tp < entry;

    const Isian = ({ k, label, warna }: { k: 'entry' | 'sl' | 'tp'; label: string; warna: string }) => (
      <label className="block">
        <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide" style={{ color: warna }}>{label}</span>
        <input value={rencana[k] === undefined ? '' : String(Number(rencana[k]!.toFixed(6)))}
               inputMode="decimal"
               onChange={(e) => onUbah({ ...rencana, [k]: Number(e.target.value) || undefined })}
               className={cn(KELAS_ISIAN, 'angka w-[86px]')} />
      </label>
    );

    return (
      <div className={cn('rounded-lg border bg-zinc-900/92 px-2.5 py-2 backdrop-blur-sm',
        nyata ? 'border-red-500/40' : 'border-zinc-700')}>
        <div className="mb-1.5 flex items-center gap-2">
          {Lencana}
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold',
            draf === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
            {draf}
          </span>
          {/* Jenis order MENGIKUTI letak garis entry — geser ke atas harga
              dan tulisannya berubah sendiri. Keterangan inilah cara orangnya
              tahu seretan barusan mengubah jenis ordernya. */}
          {jenis && (
            <span className={cn('rounded px-1.5 py-0.5 text-[9.5px] font-medium',
              jenis === 'Market' ? 'bg-zinc-800 text-zinc-300' : 'bg-amber-500/15 text-amber-300')}>
              {jenis}
            </span>
          )}
          <span className="text-[10.5px] text-zinc-500">geser garisnya di chart</span>
        </div>

        <div className="flex items-end gap-1.5">
          <Isian k="entry" label="Entry" warna="#d4d4d8" />
          <Isian k="sl" label="SL" warna="#f87171" />
          <Isian k="tp" label="TP" warna="#10b981" />
        </div>

        {/* Ukuran latihan diatur DI SINI, bukan di panel bawah replay —
            order demo bisa dibuka tanpa menyentuh tombol replay sama
            sekali, jadi setelannya harus ikut tiketnya. */}
        {!nyata && demoSetelan && aturDemo && (
          <div className="mt-1.5 flex items-end gap-1.5">
            <label className="block">
              <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Modal $</span>
              <input value={demoSetelan.modal || ''} inputMode="decimal"
                     onChange={(e) => aturDemo({ ...demoSetelan, modal: Number(e.target.value) || 0 })}
                     className={cn(KELAS_ISIAN, 'angka w-[64px]')} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Risk %</span>
              <input value={demoSetelan.risikoPersen || ''} inputMode="decimal"
                     onChange={(e) => aturDemo({ ...demoSetelan, risikoPersen: Number(e.target.value) || 0 })}
                     className={cn(KELAS_ISIAN, 'angka w-[52px]')} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">SL ×ATR</span>
              <input value={demoSetelan.kaliAtr || ''} inputMode="decimal"
                     onChange={(e) => aturDemo({ ...demoSetelan, kaliAtr: Number(e.target.value) || 0 })}
                     className={cn(KELAS_ISIAN, 'angka w-[52px]')} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">R : R</span>
              <input value={demoSetelan.rr || ''} inputMode="decimal"
                     onChange={(e) => aturDemo({ ...demoSetelan, rr: Number(e.target.value) || 0 })}
                     className={cn(KELAS_ISIAN, 'angka w-[48px]')} />
            </label>
          </div>
        )}

        {/* Order sungguhan butuh UKURANNYA di tempat yang sama dengan
            levelnya — modal, leverage, dan metode TP yang persis sama
            dengan Area Entry. Tanpa ini tiketnya cuma setengah keputusan. */}
        {nyata && nyataSetelan && aturNyata && (
          <div className="mt-1.5 flex items-end gap-1.5">
            <label className="block">
              <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Modal $</span>
              <input value={nyataSetelan.modal || ''} inputMode="decimal"
                     onChange={(e) => aturNyata({ ...nyataSetelan, modal: Number(e.target.value) || 0 })}
                     className={cn(KELAS_ISIAN, 'angka w-[64px]')} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Lev</span>
              <input value={nyataSetelan.leverage || ''} inputMode="numeric"
                     onChange={(e) => aturNyata({ ...nyataSetelan, leverage: Number(e.target.value) || 1 })}
                     className={cn(KELAS_ISIAN, 'angka w-[44px]')} />
            </label>
            <label className="block grow">
              <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Metode TP</span>
              <select value={nyataSetelan.metode}
                      onChange={(e) => aturNyata({ ...nyataSetelan, metode: e.target.value as MetodeTp })}
                      className={cn(KELAS_ISIAN, 'w-full max-w-[190px] cursor-pointer')}>
                {METODE_TP.map((m) => <option key={m.nilai} value={m.nilai}>{m.label}</option>)}
              </select>
            </label>
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10.5px] text-zinc-500">
            R:R <span className={cn('angka', rr && rr >= 1.5 ? 'text-emerald-400' : 'text-zinc-300')}>
              {rr ? rr.toFixed(2) : '—'}
            </span>
          </span>
          {(() => {
            /* REAL: dolar dari ukuran order yang SEBENARNYA — qty = modal ×
               leverage / entry, dikali jarak harga. Angka risiko demo (persen
               dari modal latihan) di sini menyesatkan: ia bukan uang yang
               akan bergerak. */
            if (nyata && nyataSetelan && entry && sl && tp) {
              const qty = (nyataSetelan.modal * nyataSetelan.leverage) / entry;
              return (
                <span className="text-[10.5px] text-zinc-500">
                  <span className="angka text-red-400">-{uang(qty * Math.abs(entry - sl))}</span>
                  {' / '}
                  <span className="angka text-emerald-400">+{uang(qty * Math.abs(tp - entry))}</span>
                </span>
              );
            }
            if (!nyata && risiko !== undefined && rr !== null) {
              return (
                <span className="text-[10.5px] text-zinc-500">
                  <span className="angka text-red-400">-{uang(risiko)}</span>
                  {' / '}
                  <span className="angka text-emerald-400">+{uang(risiko * rr)}</span>
                </span>
              );
            }
            return null;
          })()}
          <button onClick={onKirim} disabled={!arahBenar || mati || sibukNyata}
            title={arahBenar ? undefined : 'SL dan TP harus berada di sisi yang benar terhadap entry'}
            className={cn('ml-auto flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              nyata ? 'bg-red-500/25 text-red-200 hover:bg-red-500/35'
                    : 'bg-zinc-100 text-zinc-950 hover:bg-white')}>
            <Check className="size-3" /> {sibukNyata ? 'Mengirim…' : nyata ? 'Kirim order' : 'Kirim'}
          </button>
          <button onClick={onBatal} title="Batalkan tiket"
            className="flex cursor-pointer items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200">
            <Ban className="size-3" /> Batal
          </button>
        </div>
        {kabar && <div className="mt-1.5 max-w-[320px] text-[10.5px] leading-relaxed text-zinc-400">{kabar}</div>}
      </div>
    );
  }

  /* ── Diam terlipat: cuma ikon ──────────────────────────────────────── */
  if (tutupPanel) {
    return (
      <button onClick={() => aturTutup(false)} title="Buka panel order"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/85 text-zinc-400 backdrop-blur-sm transition-colors hover:border-zinc-600 hover:text-zinc-100">
        <CandlestickChart className="size-4" />
      </button>
    );
  }

  /* ── Diam terbuka: pilih arah ──────────────────────────────────────── */
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/85 px-1.5 py-1.5 backdrop-blur-sm">
      {Lencana}
      <button onClick={() => onPilih('BUY')} disabled={mati}
        className="flex cursor-pointer items-center gap-1 rounded bg-emerald-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40">
        <TrendingUp className="size-3.5" /> BUY
      </button>
      <button onClick={() => onPilih('SELL')} disabled={mati}
        className="flex cursor-pointer items-center gap-1 rounded bg-red-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40">
        <TrendingDown className="size-3.5" /> SELL
      </button>
      {hargaKini !== undefined && (
        <span className="angka px-1 text-[11px] text-zinc-500">{fHarga(hargaKini)}</span>
      )}
      <button onClick={() => aturTutup(true)} title="Lipat jadi ikon"
        className="flex size-6 cursor-pointer items-center justify-center rounded text-zinc-600 transition-colors hover:text-zinc-300">
        <Minus className="size-3.5" />
      </button>
      {kabar && (
        <span className="max-w-[260px] px-1 text-[10.5px] leading-tight text-zinc-400">{kabar}</span>
      )}
    </div>
  );
}
