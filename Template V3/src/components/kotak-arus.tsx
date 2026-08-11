import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Trash2, Loader2 } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, uang, tanggalPendek } from '@/lib/utils';
import { simpanArus, hapusArus, arusBersih, type Arus } from '@/lib/tulis-jurnal';
import type { Sumber } from '@/data/contoh';

/* ════════════════════════════════════════════════════════════════════════
   SETORAN & PENARIKAN
   ════════════════════════════════════════════════════════════════════════
   Tanpa ini, saldo jurnal tidak akan pernah cocok dengan saldo broker begitu
   ada uang masuk atau keluar — dan selisihnya diam-diam terbaca sebagai
   "hitungan jurnalnya salah".

   Yang penting: arus kas TIDAK masuk ke P/L. Setoran $500 yang dicatat
   sebagai profit akan menaikkan winrate, P/L bersih, dan profit factor
   sekaligus — tiga angka yang justru dipakai untuk menilai apakah cara
   berdagangnya berhasil.
   ════════════════════════════════════════════════════════════════════════ */

const KELAS_ISIAN =
  'h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 ' +
  'outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600';

export function KotakArus({ sumber, arus, bisaTulis, ringkas = false }: {
  sumber: Sumber; arus: Arus[]; bisaTulis: boolean;
  /* `ringkas` = versi sempit yang muat di baris KPI: satu baris isian dan
     riwayat yang lebih pendek. Bukan komponen terpisah — dua salinan tata
     letak untuk isi yang sama pasti berselisih dalam dua putaran revisi. */
  ringkas?: boolean;
}) {
  const [jenis, setJenis] = useState<'setor' | 'tarik'>('setor');
  const [nilai, setNilai] = useState('');
  const [catatan, setCatatan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');

  const milikku = arus.filter((a) => a.sumber === sumber);
  const bersih = arusBersih(arus, sumber);
  const totalSetor = milikku.filter((a) => a.jenis === 'setor').reduce((s, a) => s + a.nilai, 0);
  const totalTarik = milikku.filter((a) => a.jenis === 'tarik').reduce((s, a) => s + a.nilai, 0);

  async function tambah() {
    const n = Number(nilai.replace(/[^\d.-]/g, ''));
    if (!isFinite(n) || n <= 0) { setPesan('Nilai harus angka lebih dari nol.'); return; }
    setSibuk(true); setPesan('');
    try {
      await simpanArus({ sumber, jenis, nilai: n, waktu: Date.now(), catatan: catatan.trim() });
      setNilai(''); setCatatan('');
      setPesan(`${jenis === 'setor' ? 'Setoran' : 'Penarikan'} ${uang(n)} tercatat.`);
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally { setSibuk(false); }
  }

  return (
    <Panel className={ringkas ? 'p-5' : undefined}>
      {ringkas ? (
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <span className="text-[12.5px] text-zinc-500">Setoran &amp; Penarikan</span>
          <span className={cn('angka text-[12.5px]', bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
            {uang(bersih, true)}
          </span>
        </div>
      ) : (
        <PanelHead
          judul="Setoran & Penarikan"
          sub="Uang masuk dan keluar — tidak dihitung sebagai profit."
          kanan={
            <span className={cn('angka text-[12.5px]', bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
              {uang(bersih, true)}
            </span>
          }
        />
      )}
      <div className={ringkas ? undefined : 'px-5 pb-5'}>
        <div className={cn('flex gap-3 text-[11.5px]', ringkas ? 'mb-2' : 'mb-3')}>
          <span className="text-zinc-500">Masuk <span className="angka text-emerald-500">{uang(totalSetor)}</span></span>
          <span className="text-zinc-500">Keluar <span className="angka text-red-400">{uang(totalTarik)}</span></span>
        </div>

        <div className={cn('grid gap-2', ringkas ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-4')}>
          <div className="flex overflow-hidden rounded-md border border-zinc-800">
            {(['setor', 'tarik'] as const).map((j) => (
              <button key={j} onClick={() => setJenis(j)} disabled={!bisaTulis}
                className={cn('flex flex-1 cursor-pointer items-center justify-center gap-1 py-2 text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  jenis === j ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200')}>
                {j === 'setor' ? <ArrowDownToLine className="size-3.5" /> : <ArrowUpFromLine className="size-3.5" />}
                {j === 'setor' ? 'Setor' : 'Tarik'}
              </button>
            ))}
          </div>
          <input value={nilai} onChange={(e) => setNilai(e.target.value)} inputMode="decimal"
                 placeholder="Nilai ($)" disabled={!bisaTulis} className={cn(KELAS_ISIAN, 'angka')} />
          {!ringkas && (
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)}
                   placeholder="Catatan (opsional)" disabled={!bisaTulis} className={KELAS_ISIAN} />
          )}
          <button onClick={() => void tambah()} disabled={sibuk || !bisaTulis}
            className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-100 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
            {sibuk && <Loader2 className="size-3.5 animate-spin" />} Catat
          </button>
        </div>

        {pesan && <div className="mt-2 text-[11.5px] text-zinc-400">{pesan}</div>}

        {milikku.length > 0 && (
          <div className={cn('mt-3 overflow-y-auto', ringkas ? 'max-h-[86px]' : 'max-h-[160px]')}>
            {milikku.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-zinc-800/50 py-2 text-[12.5px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] uppercase',
                    a.jenis === 'setor' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400')}>
                    {a.jenis}
                  </span>
                  <span className="truncate text-zinc-400">{a.catatan || tanggalPendek(a.waktu)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={cn('angka', a.jenis === 'setor' ? 'text-emerald-500' : 'text-red-400')}>
                    {a.jenis === 'setor' ? '+' : '−'}{uang(a.nilai)}
                  </span>
                  <button onClick={() => { if (confirm('Hapus catatan ini?')) void hapusArus(a.id); }}
                          disabled={!bisaTulis} aria-label="Hapus"
                          className="cursor-pointer rounded p-1 text-zinc-700 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:opacity-40">
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
