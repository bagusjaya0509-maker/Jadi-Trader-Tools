import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   PRIMITIF EFFERD
   ════════════════════════════════════════════════════════════════════════
   Dipisah ke berkas sendiri supaya kelima layar (Dashboard, Screener,
   Journal, Marketplace, Owner) memakai kartu, judul, dan delta yang SAMA
   PERSIS. Kalau tiap layar menulis kartunya sendiri, dalam dua putaran
   revisi radius dan padding-nya pasti sudah berbeda-beda.
   ════════════════════════════════════════════════════════════════════════ */

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-zinc-800/80 bg-zinc-900/40', className)}
      {...props}
    />
  );
}

export function PanelHead({
  judul,
  sub,
  kanan,
  className,
}: {
  /* Bukan `string`: judul kadang membawa lencana di sebelahnya —
     "beta", jumlah, status. Memaksanya jadi teks polos berarti lencana
     itu terusir ke `kanan`, tempat tombol berada, dan ia berhenti
     terbaca sebagai keterangan judul. */
  judul: React.ReactNode;
  sub?: string;
  kanan?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 p-5 pb-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-100">{judul}</h2>
        {sub && <p className="mt-0.5 text-[12.5px] text-zinc-500">{sub}</p>}
      </div>
      {kanan}
    </div>
  );
}

/** Badge delta hijau/merah dengan panah, persis pola Efferd. */
export function Delta({ nilai, sufiks = 'vs last week' }: { nilai: number; sufiks?: string }) {
  const naik = nilai >= 0;
  const Ikon = naik ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12px]', naik ? 'text-emerald-500' : 'text-red-400')}>
      <Ikon className="size-3.5" strokeWidth={2.2} />
      <span className="angka">{Math.abs(nilai)}%</span>
      {sufiks && <span className="text-zinc-500">{sufiks}</span>}
    </span>
  );
}

/** Badge tren yang menempel di kepala kartu grafik (mis. "↗ 66.9%"). */
export function BadgeTren({ nilai }: { nilai: number }) {
  const naik = nilai >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium',
        naik ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'
      )}
    >
      {naik ? <ArrowUpRight className="size-3.5" strokeWidth={2.2} /> : <ArrowDownRight className="size-3.5" strokeWidth={2.2} />}
      <span className="angka">{Math.abs(nilai)}%</span>
    </span>
  );
}

/** Kartu KPI: label kecil, angka besar, delta di bawah, ikon opsional di
 *  pojok kanan. Ikonnya sengaja OPSIONAL — di baris yang keempat kartunya
 *  sudah punya arti sendiri, ikon tambahan cuma menambah bising. */
export function KartuKpi({
  label,
  nilai,
  delta,
  deltaSufiks,
  catatan,
  Ikon,
  warna,
}: {
  label: string;
  nilai: string;
  delta?: number;
  /** Apa yang dibandingkan. Bawaannya "vs last week", dan itu keliru untuk
   *  kartu yang membandingkan hari ini dengan kemarin — angka benar dengan
   *  keterangan salah tetap salah. */
  deltaSufiks?: string;
  catatan?: string;
  /* LucideIcon, bukan ComponentType buatan sendiri: komponen lucide
     dibungkus forwardRef dan propTypes-nya lebih longgar, jadi tipe manual
     yang lebih sempit selalu ditolak. */
  Ikon?: LucideIcon;
  warna?: string;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] text-zinc-500">{label}</div>
          <div className={cn('angka mt-2 text-[28px] font-semibold leading-none tracking-tight text-zinc-100', warna)}>
            {nilai}
          </div>
          <div className="mt-2.5">
            {typeof delta === 'number'
              ? <Delta nilai={delta} sufiks={deltaSufiks} />
              : <span className="text-[12px] text-zinc-500">{catatan}</span>}
          </div>
        </div>
        {Ikon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-500">
            <Ikon className="size-4" strokeWidth={1.8} />
          </div>
        )}
      </div>
    </Panel>
  );
}

export function TipGrafik({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
      <div className="text-[11px] text-zinc-500">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="angka text-[12.5px] text-zinc-100">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('en-US') : p.value}
        </div>
      ))}
    </div>
  );
}

/* Tabel ringan dengan gaya Efferd. Pembungkus overflow WAJIB: yang boleh
   menggeser adalah tabelnya, bukan halamannya. */
export function TabelBungkus({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-x-auto', className)} {...props} />;
}
export function Tabel({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-[13px]', className)} {...props} />;
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'whitespace-nowrap border-b border-zinc-800/80 pb-2.5 pr-4 text-left text-[11.5px] font-medium text-zinc-500',
        className
      )}
      {...props}
    />
  );
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-zinc-800/50 py-3 pr-4 align-middle', className)} {...props} />;
}
export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-zinc-900/50', className)} {...props} />;
}
