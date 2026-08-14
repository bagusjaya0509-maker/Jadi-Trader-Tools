import { useEffect, useState } from 'react';
import { X, Trash2, Loader2 } from 'lucide-react';
import { Panel } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { simpanTrade, hapusTrade, type MasukanTrade } from '@/lib/tulis-jurnal';
import type { Trade, Sumber } from '@/data/contoh';
import { useTutupLuar } from '@/lib/tutup-luar';

/* ════════════════════════════════════════════════════════════════════════
   MODAL TAMBAH / SUNTING TRADE
   ════════════════════════════════════════════════════════════════════════
   Bentuk isiannya mengikuti V2 (`jurnal-trading.html`) supaya orang yang
   sudah terbiasa tidak perlu belajar ulang: tanggal, pair, arah, lot, entry,
   exit, P/L, alasan, dua emosi, catatan. Termasuk pilihan "Lainnya…" pada
   emosi — di V2 pilihan itu ada, dan menghapusnya berarti orang yang biasa
   menulis emosinya sendiri kehilangan tempatnya.
   ════════════════════════════════════════════════════════════════════════ */

const EMOSI_MASUK = ['Tenang', 'Percaya Diri', 'Ragu-ragu', 'FOMO', 'Serakah', 'Balas Dendam', 'Netral'];
const EMOSI_EVAL = ['Puas', 'Lega', 'Bangga', 'Menyesal', 'Kecewa', 'Frustrasi', 'Netral'];
const LAIN = '__lain';

/** ms -> "2026-08-11T14:30" untuk <input type="datetime-local">.
 *
 *  toISOString() TIDAK bisa dipakai: ia mengubah ke UTC, jadi jam 14:30 WIB
 *  muncul sebagai 07:30 di kotaknya. */
function keLokal(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Kolom({ label, anak, lebar }: { label: string; anak: React.ReactNode; lebar?: boolean }) {
  return (
    <div className={lebar ? 'sm:col-span-2' : undefined}>
      <label className="mb-1.5 block text-[11px] text-zinc-500">{label}</label>
      {anak}
    </div>
  );
}

const KELAS_ISIAN =
  'h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 ' +
  'outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600';

/** Emosi dengan pilihan bebas — persis perilaku "Lainnya…" di V2. */
function PilihEmosi({ nilai, atur, pilihan }: { nilai: string; atur: (v: string) => void; pilihan: string[] }) {
  const bebas = nilai !== '' && !pilihan.includes(nilai);
  const [modeBebas, setModeBebas] = useState(bebas);

  return (
    <>
      <select
        value={modeBebas ? LAIN : nilai}
        onChange={(e) => {
          if (e.target.value === LAIN) { setModeBebas(true); atur(''); }
          else { setModeBebas(false); atur(e.target.value); }
        }}
        className={cn(KELAS_ISIAN, 'cursor-pointer')}
      >
        {pilihan.map((x) => <option key={x} value={x}>{x}</option>)}
        <option value={LAIN}>Lainnya…</option>
      </select>
      {modeBebas && (
        <input autoFocus value={nilai} onChange={(e) => atur(e.target.value)}
               placeholder="Tulis emosi lain" className={cn(KELAS_ISIAN, 'mt-1.5')} />
      )}
    </>
  );
}

export function ModalTrade({ sumber, trade, tutup }: {
  sumber: Sumber;
  /** null = tambah baru. */
  trade: Trade | null;
  tutup: () => void;
}) {
  const [f, setF] = useState<MasukanTrade>(() => ({
    id: trade?.id,
    sumber,
    pair: trade?.pair ?? '',
    arah: trade?.arah ?? 'BUY',
    lot: trade?.lot ?? 0,
    masukHarga: 0,
    keluarHarga: 0,
    pnl: trade?.pnl ?? 0,
    waktu: trade?.waktu ?? Date.now(),
    emosiMasuk: trade?.emosi ?? 'Tenang',
    emosiEvaluasi: 'Netral',
    alasan: trade?.alasan ?? '',
    catatan: '',
  }));
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  /* Esc menutup. Modal yang hanya bisa ditutup dengan mouse selalu terasa
     seperti jebakan bagi yang mengetik cepat. */
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') tutup(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [tutup]);

  async function simpan() {
    if (!f.pair.trim()) { setGalat('Pair wajib diisi.'); return; }
    if (!isFinite(f.pnl)) { setGalat('P/L harus berupa angka.'); return; }
    setSibuk(true); setGalat('');
    try { await simpanTrade(f); tutup(); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan'); }
    finally { setSibuk(false); }
  }

  async function buang() {
    if (!trade) return;
    if (!confirm(`Hapus trade ${trade.pair}?\n\nCatatan ini hilang dari jurnal untuk selamanya.`)) return;
    setSibuk(true); setGalat('');
    try { await hapusTrade(trade.id); tutup(); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menghapus'); }
    finally { setSibuk(false); }
  }

  const satuan = sumber === 'forex' ? 'Lot' : 'Qty';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
         {...useTutupLuar(tutup)}>
      <Panel className="my-4 w-full max-w-2xl bg-zinc-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
              {trade ? 'Sunting Trade' : 'Tambah Trade'}
            </h2>
            <div className="mt-0.5 text-[12px] text-zinc-500">
              Jurnal {sumber === 'forex' ? 'Trade-Fi' : 'Kripto'}
            </div>
          </div>
          <button onClick={tutup} aria-label="Tutup"
                  className="cursor-pointer text-zinc-500 transition-colors hover:text-zinc-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
          <Kolom label="Tanggal & jam" anak={
            <input type="datetime-local" value={keLokal(f.waktu)}
                   onChange={(e) => setF({ ...f, waktu: new Date(e.target.value).getTime() || f.waktu })}
                   className={KELAS_ISIAN} />
          } />
          <Kolom label="Pair" anak={
            <input value={f.pair} onChange={(e) => setF({ ...f, pair: e.target.value })}
                   placeholder={sumber === 'forex' ? 'XAUUSD' : 'BTCUSDT'}
                   className={cn(KELAS_ISIAN, 'angka uppercase placeholder:normal-case')} />
          } />
          <Kolom label="Arah" anak={
            <select value={f.arah} onChange={(e) => setF({ ...f, arah: e.target.value as 'BUY' | 'SELL' })}
                    className={cn(KELAS_ISIAN, 'cursor-pointer')}>
              <option value="BUY">BUY</option><option value="SELL">SELL</option>
            </select>
          } />
          <Kolom label={`${satuan} size`} anak={
            <input value={String(f.lot)} inputMode="decimal"
                   onChange={(e) => setF({ ...f, lot: Number(e.target.value.replace(',', '.')) || 0 })}
                   className={cn(KELAS_ISIAN, 'angka')} />
          } />
          <Kolom label="Harga entry" anak={
            <input value={String(f.masukHarga)} inputMode="decimal"
                   onChange={(e) => setF({ ...f, masukHarga: Number(e.target.value.replace(',', '.')) || 0 })}
                   className={cn(KELAS_ISIAN, 'angka')} />
          } />
          <Kolom label="Harga exit" anak={
            <input value={String(f.keluarHarga)} inputMode="decimal"
                   onChange={(e) => setF({ ...f, keluarHarga: Number(e.target.value.replace(',', '.')) || 0 })}
                   className={cn(KELAS_ISIAN, 'angka')} />
          } />
          <Kolom label="Profit / Loss (USD)" anak={
            <input value={String(f.pnl)} inputMode="decimal"
                   onChange={(e) => setF({ ...f, pnl: Number(e.target.value.replace(',', '.')) || 0 })}
                   className={cn(KELAS_ISIAN, 'angka',
                     f.pnl > 0 ? 'text-emerald-400' : f.pnl < 0 ? 'text-red-400' : '')} />
          } />
          <Kolom label="Emosi saat entry" anak={
            <PilihEmosi nilai={f.emosiMasuk} atur={(v) => setF({ ...f, emosiMasuk: v })} pilihan={EMOSI_MASUK} />
          } />
          <Kolom label="Emosi evaluasi (setelah close)" anak={
            <PilihEmosi nilai={f.emosiEvaluasi} atur={(v) => setF({ ...f, emosiEvaluasi: v })} pilihan={EMOSI_EVAL} />
          } />
          <Kolom lebar label="Alasan entry / setup" anak={
            <textarea rows={2} value={f.alasan} onChange={(e) => setF({ ...f, alasan: e.target.value })}
                      placeholder="Cth: Break of structure H1 + retest order block"
                      className={cn(KELAS_ISIAN, 'h-auto resize-y py-2')} />
          } />
          <Kolom lebar label="Catatan / pelajaran" anak={
            <textarea rows={2} value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })}
                      placeholder="Apa yang bisa diperbaiki dari trade ini?"
                      className={cn(KELAS_ISIAN, 'h-auto resize-y py-2')} />
          } />
        </div>

        {galat && <div className="px-6 pb-2 text-[12.5px] text-amber-300/90">{galat}</div>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 px-6 py-4">
          {trade ? (
            <button onClick={() => void buang()} disabled={sibuk}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-red-500/25 px-3 py-2 text-[12px] text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50">
              <Trash2 className="size-3.5" /> Hapus Trade
            </button>
          ) : <span />}
          <div className="ml-auto flex gap-2">
            <button onClick={tutup} disabled={sibuk}
                    className="cursor-pointer rounded-md border border-zinc-800 px-4 py-2 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50">
              Batal
            </button>
            <button onClick={() => void simpan()} disabled={sibuk}
                    className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-4 py-2 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
              {sibuk && <Loader2 className="size-3.5 animate-spin" />} Simpan
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
