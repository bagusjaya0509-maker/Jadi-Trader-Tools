import { useEffect, useState } from 'react';
import { Calculator, TriangleAlert } from 'lucide-react';
import { cn, uang } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   PENGHITUNG POSISI — menerjemahkan sinyal jadi ukuran yang aman DIIKUTI
   ════════════════════════════════════════════════════════════════════════
   Panel ini menjawab satu pertanyaan yang selama ini dibiarkan menggantung:
   "sinyal ini SL-nya sekian persen — saya harus masuk sebesar apa?"

   ── KENAPA IA PERLU ADA ────────────────────────────────────────────────
   Jarak SL BUKAN risiko. Risiko = ukuran posisi x jarak SL. Orang yang
   meniru sinyal ber-SL 2% dengan lot yang sama seperti sinyal ber-SL 0,2%
   menanggung sepuluh kali lipat — tanpa satu pun angka di layar yang
   memberitahunya.

   Yang membalik intuisi kebanyakan orang, dan karena itu ditulis terang di
   panelnya: SL yang LEBAR justru butuh leverage lebih KECIL. Untuk risiko
   1% dari $1.000 —

       SL 2%    -> posisi $500     (0,5x modal, tidak perlu leverage)
       SL 0,5%  -> posisi $2.000   (2x)
       SL 0,06% -> posisi $16.667  (16,7x)

   Justru stop yang rapat yang menuntut leverage besar, dan di situ selisih
   harga serta slippage memakan bagian yang jauh lebih besar dari risikonya.

   ── HANYA CATATAN ──────────────────────────────────────────────────────
   Tidak satu pun angka di sini mengubah sinyalnya, mengubah papan
   peringkat, atau terkirim ke mana pun. Ia hitungan di peramban orang yang
   sedang menimbang meniru — dan itu memang miliknya sendiri, karena modal
   dan toleransi risikonya juga miliknya sendiri.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.hitung.posisi';

type Simpanan = { modal: number; risiko: number; leverage: number };
const BAWAAN: Simpanan = { modal: 1000, risiko: 1, leverage: 10 };

function baca(): Simpanan {
  try {
    const j = JSON.parse(localStorage.getItem(KUNCI) || '{}');
    return {
      modal: Number(j.modal) > 0 ? Number(j.modal) : BAWAAN.modal,
      risiko: Number(j.risiko) > 0 ? Number(j.risiko) : BAWAAN.risiko,
      leverage: Number(j.leverage) > 0 ? Number(j.leverage) : BAWAAN.leverage,
    };
  } catch { return BAWAAN; }
}

const ISIAN = 'w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[12px] text-zinc-200 outline-none transition-colors focus:border-zinc-600';

export function HitungPosisi({ entry, sl, kripto }: {
  entry: number; sl: number; kripto: boolean;
}) {
  const [n, setN] = useState<Simpanan>(baca);

  /* Disimpan supaya tidak perlu diketik ulang di tiap sinyal. Modal dan
     toleransi risiko orang tidak berubah dari kartu ke kartu; memaksanya
     mengisi ulang tiap kali membuat panel ini lebih merepotkan daripada
     menghitung sendiri di kalkulator. */
  useEffect(() => {
    try { localStorage.setItem(KUNCI, JSON.stringify(n)); } catch { /* mode privat */ }
  }, [n]);

  if (!(entry > 0) || !(sl > 0)) return null;

  const jarakPersen = (Math.abs(entry - sl) / entry) * 100;
  if (!(jarakPersen > 0)) return null;

  const risikoDolar = n.modal * (n.risiko / 100);
  const nilaiPosisi = risikoDolar / (jarakPersen / 100);
  const levMin = nilaiPosisi / n.modal;
  const marginTerpakai = nilaiPosisi / n.leverage;
  const kurangMargin = marginTerpakai > n.modal;
  /* Di atas 10x, satu gerak kecil melawan sudah memakan sebagian besar
     margin. Angkanya bukan hukum — ia ambang untuk MENYEBUTKAN, bukan
     untuk melarang. */
  const levTinggi = levMin > 10;

  const ubah = (k: keyof Simpanan) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setN((s) => ({ ...s, [k]: Math.max(0, Number(e.target.value) || 0) }));

  return (
    <div className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-300">
        <Calculator className="size-3.5 text-zinc-500" />
        Ukuran posisi supaya risikomu pas
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-zinc-500">Modal ($)</span>
          <input value={n.modal} onChange={ubah('modal')} inputMode="decimal" className={cn(ISIAN, 'angka')} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-zinc-500">Risiko (%)</span>
          <input value={n.risiko} onChange={ubah('risiko')} inputMode="decimal" className={cn(ISIAN, 'angka')} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-zinc-500">Leverage (x)</span>
          <input value={n.leverage} onChange={ubah('leverage')} inputMode="decimal" className={cn(ISIAN, 'angka')} />
        </label>
      </div>

      <div className="mt-3 space-y-1 text-[11.5px]">
        <Baris k="Jarak SL sinyal ini" v={jarakPersen.toFixed(2) + '%'} />
        <Baris k={`Rugi kalau kena SL (${n.risiko}% modal)`} v={uang(risikoDolar)} />
        <Baris k="Nilai posisi yang dipakai" v={uang(nilaiPosisi)} tebal />
        {kripto && <Baris k="Jumlah kontrak" v={(nilaiPosisi / entry).toPrecision(4)} />}
        <Baris k={`Margin terpakai di ${n.leverage}x`} v={uang(marginTerpakai)}
               warna={kurangMargin ? 'text-red-400' : undefined} />
        <Baris k="Leverage minimum yang dibutuhkan"
               v={levMin <= 1 ? 'tidak perlu leverage' : levMin.toFixed(1) + 'x'} />
      </div>

      {kurangMargin && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md border border-red-500/30 bg-red-500/[0.05] px-2.5 py-2 text-[11px] leading-relaxed text-red-300/90">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Margin yang dibutuhkan lebih besar dari modalmu. Naikkan leverage ke minimal{' '}
          <span className="angka">{levMin.toFixed(1)}x</span>, atau turunkan risikonya.
        </p>
      )}

      {!kurangMargin && levTinggi && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/[0.05] px-2.5 py-2 text-[11px] leading-relaxed text-amber-200/90">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          SL sinyal ini rapat, jadi risiko {n.risiko}% menuntut leverage{' '}
          <span className="angka">{levMin.toFixed(1)}x</span>. Di leverage setinggi itu selisih
          harga dan slippage memakan bagian besar dari risikomu — dan jarak ke likuidasi jadi
          pendek kalau SL-nya sempat terlewat.
        </p>
      )}

      <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
        {kripto
          ? 'Futures: ukuran posisi diatur lewat jumlah kontrak, dan leverage cuma menentukan berapa margin yang tertahan — bukan berapa yang kamu risikokan. Yang menentukan risikomu tetap jarak SL dikali ukuran posisi.'
          : 'MT5: bagi nilai posisi dengan ukuran kontrak simbolmu untuk mendapat lot (XAUUSD 100 oz per lot, pasangan forex 100.000 unit). Akun cent membaginya lagi dengan 100 — itulah cara memasang risiko kecil tanpa lot pecahan yang ditolak broker.'}
        {' '}Hitungan ini hanya catatan: ia tidak mengubah sinyalnya dan tidak terkirim ke mana pun.
      </p>
    </div>
  );
}

function Baris({ k, v, tebal, warna }: { k: string; v: string; tebal?: boolean; warna?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-zinc-500">{k}</span>
      <span className={cn('angka shrink-0', warna ?? (tebal ? 'font-semibold text-zinc-100' : 'text-zinc-300'))}>{v}</span>
    </div>
  );
}
