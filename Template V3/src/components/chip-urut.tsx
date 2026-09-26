import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpDown, Check, ChevronDown, Search } from 'lucide-react';
import { URUT_POSISI, type UrutPosisi } from '@/components/tabel-posisi';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   CHIP URUTAN — bentuk yang sama dengan filter Screener Area
   ════════════════════════════════════════════════════════════════════════
   Pemilik menegur 26 Sep 2026: "tampilan pilih filternya kok ga sebagus
   filter screener ya? apa kode fitur filter itu kamu ga nemu lagi?"

   Kodenya memang ada, dan memang tidak bisa dipakai ulang begitu saja:
   filter Screener Area itu komponen `jtfFilter` di dalam
   `Template V2 Premium/ema-cross-screener_3.html` — JavaScript polos yang
   menulis ke <select> tersembunyi, hidup di dalam iframe V2, dengan CSS
   yang memakai variabel tema V2 (`--jtf-chip`, `--jtf-pop`, `--gold`).
   Mengimpornya ke React bukan sekadar menyalin berkas.

   Jadi yang disalin UKURANNYA, satu per satu dari berkas itu — bukan
   kira-kira "mirip pil gelap":

     tinggi ruas          26px          .jtf-seg
     padding ruas         0 7px         .jtf-seg
     jarak antar-ruas     1px           .jtf-chip gap
     sudut ruas pertama   5px 0 0 5px   .jtf-seg-awal
     latar ruas           #27272a       --jtf-chip      (zinc-800)
     latar saat disorot   #3f3f46       --jtf-chip-sorot(zinc-700)
     lebar popover        224px         .jtf-pop
     latar popover        #18181b       --jtf-pop       (zinc-900)
     sudut popover        8px           .jtf-pop
     bayangan             0 12px 32px rgba(0,0,0,.35)
     tinggi kotak cari    34px          .jtf-pop-cari input
     tinggi maks daftar   260px         .jtf-pop-daftar
     padding butir        7px 8px       .jtf-item
     centang              margin-left:auto, warna emas

   Ruas pertama memakai `font-weight:600` dan warna teks penuh; ruas nilai
   memakai warna teredup. Itu yang membuat chip-nya terbaca sebagai satu
   benda berlabel, bukan dua tombol bersebelahan.

   ── KOTAK CARI IKUT, WALAU ISINYA CUMA TUJUH ─────────────────────────
   Di daftar sependek ini ia memang tidak banyak menolong. Tapi filter
   Timeframe di Screener juga cuma enam pilihan dan tetap punya kotak cari,
   dan yang diminta pemilik adalah bentuk yang SAMA — bukan bentuk yang
   saya nilai lebih pas untuk tujuh baris.

   ── TANPA SILANG ─────────────────────────────────────────────────────
   Diminta di pesan yang sama: "setelah user pilih maka otomatis menjadi
   default jadi ga perlu pakai tanda silang itu." Pilihannya memang sudah
   tersimpan per panel, jadi silang pencabut cuma mengulang apa yang bisa
   dilakukan dengan memilih "Bawaan bursa" di dalam daftarnya.
   ════════════════════════════════════════════════════════════════════════ */

const LEBAR_POP = 224;

export function ChipUrut({ nilai, atur, buka, setBuka }: {
  nilai: UrutPosisi | null;
  atur: (v: UrutPosisi | null) => void;
  buka: boolean;
  setBuka: (v: boolean) => void;
}) {
  const jangkarRef = useRef<HTMLSpanElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [kotak, setKotak] = useState<DOMRect | null>(null);
  const [cari, setCari] = useState('');

  /* Popover `fixed` lewat portal, sama seperti `.jtf-pop` yang dipasang ke
     <body>: kepala panel ini punya tetangga yang menumpuk, dan popover yang
     digambar di dalamnya ikut terpotong. */
  useEffect(() => {
    if (!buka) { setCari(''); return; }
    const el = jangkarRef.current;
    if (el) setKotak(el.getBoundingClientRect());
    const tutup = () => setBuka(false);
    const tombol = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false); };
    const luar = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (jangkarRef.current?.contains(e.target as Node)) return;
      setBuka(false);
    };
    window.addEventListener('scroll', tutup, true);
    window.addEventListener('resize', tutup);
    window.addEventListener('keydown', tombol);
    document.addEventListener('mousedown', luar);
    return () => {
      window.removeEventListener('scroll', tutup, true);
      window.removeEventListener('resize', tutup);
      window.removeEventListener('keydown', tombol);
      document.removeEventListener('mousedown', luar);
    };
  }, [buka, setBuka]);

  const label = nilai ? URUT_POSISI.find((u) => u.nilai === nilai)?.label : 'bawaan bursa';
  const kata = cari.trim().toLowerCase();
  const pilihan: { nilai: UrutPosisi | null; label: string }[] = [
    ...URUT_POSISI,
    { nilai: null, label: 'Bawaan bursa' },
  ].filter((u) => !kata || u.label.toLowerCase().includes(kata));

  return (
    <>
      {/* gap-px = jarak 1px antar-ruas, persis .jtf-chip */}
      <span ref={jangkarRef} className="inline-flex items-center gap-px text-[12px] leading-none">
        <button onClick={() => setBuka(!buka)}
          title="Urutkan baris di panel ini"
          className="flex h-[26px] cursor-pointer items-center gap-[5px] rounded-l-[5px] bg-zinc-800 px-[7px] font-semibold text-zinc-100 transition-colors hover:bg-zinc-700">
          <ArrowUpDown className="size-[13px] shrink-0" /> Urutan
        </button>
        <button onClick={() => setBuka(!buka)}
          className={cn('flex h-[26px] cursor-pointer items-center gap-[5px] rounded-r-[5px] bg-zinc-800 px-[7px] transition-colors hover:bg-zinc-700 hover:text-zinc-100',
            nilai ? 'text-zinc-400' : 'italic text-zinc-500')}>
          {label}
          <ChevronDown className="size-[13px] shrink-0 opacity-60" />
        </button>
      </span>

      {buka && kotak && createPortal(
        <div
          ref={popRef}
          role="listbox"
          aria-label="Urutan baris"
          style={{
            position: 'fixed', width: LEBAR_POP,
            /* Dijepit ke dalam layar — chip ini duduk di tepi kanan panel,
               dan popover selebar 224px yang dirata-kanankan begitu saja
               menggantung keluar jendela di layar sempit. */
            left: Math.max(8, Math.min(kotak.right - LEBAR_POP, window.innerWidth - LEBAR_POP - 8)),
            top: kotak.bottom + 6,
            boxShadow: '0 12px 32px rgba(0,0,0,.35)',
            zIndex: 10050,
          }}
          className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-[12.5px] text-zinc-200"
        >
          <div className="flex items-center gap-[7px] border-b border-zinc-800 px-2.5">
            <Search className="size-[13px] shrink-0 text-zinc-600" />
            <input
              autoFocus
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Urutan"
              className="h-[34px] min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </div>
          <div className="max-h-[260px] overflow-y-auto p-1">
            {pilihan.length === 0 ? (
              <p className="px-2 py-3.5 text-center text-zinc-600">Tidak ada yang cocok.</p>
            ) : pilihan.map((u) => {
              const aktif = u.nilai === nilai;
              return (
                <button
                  key={u.nilai ?? 'bawaan'}
                  role="option"
                  aria-selected={aktif}
                  onClick={() => { atur(u.nilai); setBuka(false); }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 py-[7px] text-left transition-colors hover:bg-zinc-800"
                >
                  {u.label}
                  <Check className={cn('ml-auto size-[13px] shrink-0 text-emas', !aktif && 'opacity-0')} />
                </button>
              );
            })}
          </div>
        </div>,
        document.body)}
    </>
  );
}
