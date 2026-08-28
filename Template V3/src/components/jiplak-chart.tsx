import { useEffect, useRef, useState } from 'react';
import { Images, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { daftarChart, gambarChart, type ChartPantauan } from '@/lib/chart-agen';

/* ════════════════════════════════════════════════════════════════════════
   JIPLAK CHART — chart acuan di belakang lilin, seperti menjiplak sketsa
   ════════════════════════════════════════════════════════════════════════
   Chart yang diambil agen dipasang tembus di belakang chart sungguhan,
   supaya zona yang digambar orang lain bisa ditiru ke harga yang sebenarnya
   berjalan. Persis kertas kalkir di atas gambar: yang di bawah cuma acuan,
   yang jadi tetap yang digambar sendiri.

   ── SEMUA PENGATURAN DI PANEL, TIDAK ADA YANG DISERET DI CHART ─────────
   Menyeret gambarnya langsung memang lebih enak — tapi itu menuntut
   lapisannya menangkap tetikus, dan satu lapisan penuh yang menangkap
   tetikus mematikan geser, zoom, dan seluruh alat gambar di bawahnya.
   Harga itu terlalu mahal untuk kenyamanan menyeret. Jadi lapisannya
   `pointer-events-none` mutlak, dan penyetelnya di sini.

   ── HANYA PEMILIK ──────────────────────────────────────────────────────
   Arsipnya digerbangi uid pemilik di server; komponen ini cuma tidak
   dipasang untuk orang lain. Kalau toh terpasang, daftarnya pulang null
   dan yang tampil kalimat "tidak ada" — bukan kebocoran.
   ════════════════════════════════════════════════════════════════════════ */

export interface AturJiplak {
  id: string;
  url: string;
  opacity: number;
  skala: number;
  x: number;
  y: number;
}

export const JIPLAK_BAWAAN = { opacity: 0.28, skala: 1, x: 0, y: 0 };

function Geser({ label, nilai, min, maks, langkah, satuan, ubah }: {
  label: string; nilai: number; min: number; maks: number; langkah: number;
  satuan: string; ubah: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] text-zinc-500">
        {label}
        <span className="tabular-nums text-zinc-400">{Math.round(nilai * (satuan === '%' ? 100 : 1))}{satuan}</span>
      </span>
      <input type="range" min={min} max={maks} step={langkah} value={nilai}
             onChange={(e) => ubah(Number(e.target.value))}
             className="mt-1 w-full cursor-pointer accent-zinc-300" />
    </label>
  );
}

export function JiplakChart({ nilai, ubah }: {
  nilai: AturJiplak | null;
  ubah: (v: AturJiplak | null) => void;
}) {
  const [buka, setBuka] = useState(false);
  const [chart, setChart] = useState<ChartPantauan[] | null>(null);
  const [muat, setMuat] = useState(false);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const wadah = useRef<HTMLDivElement | null>(null);

  /* Daftarnya baru diminta saat panelnya dibuka. Menariknya saat chart
     dimuat berarti setiap kunjungan ke Chart & Entry membayar satu
     permintaan untuk panel yang mungkin tidak pernah disentuh. */
  useEffect(() => {
    if (!buka || chart) return;
    setMuat(true);
    void daftarChart(true).then((d) => { setChart(d || []); setMuat(false); });
  }, [buka, chart]);

  /* Klik di luar menutup. Bukan hiasan: panel ini menutupi lilin, dan
     panel yang menutupi lilin harus bisa disingkirkan tanpa mencari
     tombolnya. */
  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setBuka(false);
    };
    window.addEventListener('pointerdown', luar);
    return () => window.removeEventListener('pointerdown', luar);
  }, [buka]);

  /* Object URL yang sedang terpasang DILEPAS saat diganti atau saat
     komponennya pergi. Tanpa ini tiap penggantian gambar meninggalkan satu
     salinan penuh di memori tab sampai tabnya ditutup. */
  const urlLama = useRef<string | null>(null);
  useEffect(() => () => { if (urlLama.current) URL.revokeObjectURL(urlLama.current); }, []);

  async function pilih(c: ChartPantauan) {
    if (nilai && nilai.id === c.id) { lepas(); return; }
    setSibuk(c.id);
    const u = await gambarChart(c.id);
    setSibuk(null);
    if (!u) return;
    if (urlLama.current) URL.revokeObjectURL(urlLama.current);
    urlLama.current = u;
    ubah({ id: c.id, url: u, ...JIPLAK_BAWAAN });
  }

  function lepas() {
    if (urlLama.current) { URL.revokeObjectURL(urlLama.current); urlLama.current = null; }
    ubah(null);
  }

  return (
    <div ref={wadah} className="relative">
      <button onClick={() => setBuka((v) => !v)}
        title="Jiplak chart — pasang chart acuan tembus di belakang lilin"
        className={cn('flex size-7 cursor-pointer items-center justify-center rounded transition-colors',
          nilai ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100')}>
        <Images className="size-3.5" />
      </button>

      {buka && (
        <div className="absolute left-9 top-0 z-30 w-64 rounded-lg border border-zinc-800 bg-zinc-950/95 p-2.5 shadow-xl backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-zinc-200">Jiplak chart</span>
            <button onClick={() => setBuka(false)}
              className="cursor-pointer rounded p-0.5 text-zinc-500 hover:text-zinc-200">
              <X className="size-3.5" />
            </button>
          </div>

          {nilai && (
            <div className="mb-2 space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
              <Geser label="Ketebalan" nilai={nilai.opacity} min={0.05} maks={0.9} langkah={0.01}
                     satuan="%" ubah={(n) => ubah({ ...nilai, opacity: n })} />
              <Geser label="Skala" nilai={nilai.skala} min={0.4} maks={2.5} langkah={0.01}
                     satuan="×" ubah={(n) => ubah({ ...nilai, skala: n })} />
              <Geser label="Geser mendatar" nilai={nilai.x} min={-60} maks={60} langkah={1}
                     satuan="%" ubah={(n) => ubah({ ...nilai, x: n })} />
              <Geser label="Geser tegak" nilai={nilai.y} min={-60} maks={60} langkah={1}
                     satuan="%" ubah={(n) => ubah({ ...nilai, y: n })} />
              <div className="flex gap-1.5 pt-0.5">
                <button onClick={() => ubah({ ...nilai, ...JIPLAK_BAWAAN })}
                  className="flex-1 cursor-pointer rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 transition-colors hover:text-zinc-100">
                  Atur ulang
                </button>
                <button onClick={lepas}
                  className="flex-1 cursor-pointer rounded border border-zinc-700 py-1 text-[11px] text-zinc-400 transition-colors hover:text-red-400">
                  Lepas
                </button>
              </div>
            </div>
          )}

          {muat && (
            <div className="flex items-center gap-2 py-3 text-[12px] text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" /> Mengambil daftar…
            </div>
          )}

          {!muat && chart && chart.length === 0 && (
            <p className="py-3 text-[11.5px] leading-relaxed text-zinc-500">
              Belum ada chart di arsip. Chart baru masuk sendiri dari ruang
              pantauan agen.
            </p>
          )}

          {!muat && chart && chart.length > 0 && (
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {chart.map((c) => (
                <button key={c.id} onClick={() => void pilih(c)}
                  className={cn('flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left transition-colors',
                    nilai && nilai.id === c.id
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200')}>
                  <span className="min-w-0 flex-1 truncate text-[11.5px]">
                    {c.keterangan || '(tanpa keterangan)'}
                  </span>
                  {sibuk === c.id && <Loader2 className="size-3 shrink-0 animate-spin" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
