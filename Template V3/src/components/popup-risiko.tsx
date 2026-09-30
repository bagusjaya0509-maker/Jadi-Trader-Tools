import { Link } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { umurKabar, type KabarAgen } from '@/lib/kabar';

/* ════════════════════════════════════════════════════════════════════════
   POP-UP PENGINGAT RISIKO — menggantung di bawah lonceng
   ════════════════════════════════════════════════════════════════════════
   Diminta pemilik 30 Sep 2026: kalau floating terlalu besar atau sudah
   overtrade, lonceng saja tidak cukup — angka merah kecil di pojok gampang
   terlewat justru saat orangnya sedang sibuk entry. Pop-up ini muncul
   sendiri begitu ada pengingat yang belum diakui, di halaman mana pun.

   Kabarnya disusun penjaga-risiko.js di VPS (aturan & batasnya di sana).
   Layar ini cuma menampilkan; ia tidak menghitung ulang apa pun.

   TANPA animasi masuk. Animasi yang digerakkan rAF tersangkut di opacity 0
   saat tab tidak tampil, dan pengingat yang tidak terlihat lebih buruk
   daripada pengingat yang muncul tanpa gaya.

   Posisinya meniru PanelKabar: di ponsel `fixed` selebar layar di bawah
   header, di layar lebar menggantung di tepi kanan lonceng. */

const LEVEL = {
  bahaya: { label: 'Bahaya', pil: 'bg-red-500/15 text-red-400', garis: 'border-red-500/40' },
  waspada: { label: 'Waspada', pil: 'bg-amber-500/15 text-amber-400', garis: 'border-amber-500/40' },
} as const;

export function PopupRisiko({ daftar, akui, bukaLonceng }: {
  /** Pengingat yang BELUM diakui, terbaru dulu. */
  daftar: KabarAgen[];
  akui: () => void;
  bukaLonceng: () => void;
}) {
  if (!daftar.length) return null;
  const tampil = daftar.slice(0, 3);
  const sisa = daftar.length - tampil.length;
  const bahaya = daftar.some((k) => k.level === 'bahaya');

  return (
    <div role="alertdialog" aria-labelledby="judul-popup-risiko"
      className={cn(
        'fixed inset-x-3 top-14 z-50 rounded-2xl border bg-zinc-950 p-4 shadow-2xl',
        'sm:absolute sm:inset-x-auto sm:right-0 sm:top-9 sm:w-[340px]',
        bahaya ? 'border-red-500/40' : 'border-amber-500/40',
      )}>
      <div className="flex items-start gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl',
          bahaya ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400')}>
          <ShieldAlert className="size-5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <div id="judul-popup-risiko" className="text-[14px] font-semibold text-zinc-100">Pengingat batas trading</div>
          <div className="mt-0.5 text-[12px] text-zinc-500">
            {daftar.length === 1 ? '1 batas terlewati' : `${daftar.length} batas terlewati`} · {umurKabar(daftar[0].waktu)}
          </div>
        </div>
        <button onClick={akui} aria-label="Tutup pengingat"
          className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200">
          <X className="size-4" />
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {tampil.map((k) => {
          const lv = LEVEL[k.level === 'bahaya' ? 'bahaya' : 'waspada'];
          return (
            <li key={k.id} className={cn('rounded-xl border-l-2 bg-zinc-900/70 px-3 py-2.5', lv.garis)}>
              {/* Judul TURUN BARIS, tidak dipotong: "…dari mo…" menghapus
                  bagian kalimat yang justru memberi arti angkanya. */}
              <div className="flex items-start gap-2">
                <span className={cn('mt-px shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide', lv.pil)}>
                  {lv.label}
                </span>
                <span className="min-w-0 text-[12.5px] font-semibold leading-snug text-zinc-100">{k.judul}</span>
              </div>
              {k.detail && <p className="mt-1 text-[11.5px] leading-snug text-zinc-400">{k.detail}</p>}
            </li>
          );
        })}
      </ul>
      {sisa > 0 && (
        <button onClick={bukaLonceng}
          className="mt-2 cursor-pointer text-[11.5px] text-zinc-400 underline-offset-2 hover:text-zinc-100 hover:underline">
          +{sisa} pengingat lain di lonceng
        </button>
      )}

      <div className="mt-3.5 flex items-center justify-end gap-2">
        <Link to="/chart-entry" onClick={akui}
          className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
          Lihat posisi
        </Link>
        <button onClick={akui}
          className="cursor-pointer rounded-lg bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold text-zinc-950 transition-colors hover:bg-white">
          Mengerti
        </button>
      </div>
    </div>
  );
}
