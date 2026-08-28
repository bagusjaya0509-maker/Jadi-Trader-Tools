import { useEffect, useRef, useState } from 'react';
import { Crosshair, Images, Loader2, Lock, Maximize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { daftarChart, gambarChart, type ChartPantauan } from '@/lib/chart-agen';

/* ════════════════════════════════════════════════════════════════════════
   JIPLAK CHART — chart acuan di belakang lilin, seperti menjiplak sketsa
   ════════════════════════════════════════════════════════════════════════
   Chart yang diambil agen dipasang tembus di belakang chart sungguhan,
   supaya zona yang digambar orang lain bisa ditiru ke harga yang sebenarnya
   berjalan. Persis kertas kalkir di atas gambar: yang di bawah cuma acuan,
   yang jadi tetap yang digambar sendiri.

   ── KENAPA PENGGESER DIGANTI SERETAN ────────────────────────────────────
   Versi pertama memberi penggeser skala + geser mendatar/tegak, dan gambarnya
   dipasang dengan transform persen. Laporan pemilik: sulit dipaskan. Benar,
   tapi sebab yang sebenarnya lebih dalam daripada penggesernya kurang halus:

   transform persen mengikat gambar ke LAYAR, bukan ke harga. Jadi sekalipun
   berhasil dipaskan sempurna, satu geseran chart saja sudah membuatnya
   meleset lagi — gambarnya diam sementara lilin di bawahnya berjalan.
   Memaskan sesuatu yang tidak bisa tetap pas adalah pekerjaan tanpa ujung.

   Sekarang keempat sudutnya ditambatkan ke KOORDINAT CHART (indeks logis
   untuk mendatar, harga untuk tegak). Sekali dipaskan, ia menempel pada
   lilinnya: ikut geser, ikut zoom, ikut tarikan sumbu harga. Dan karena
   tambatannya berupa koordinat, memaskannya jadi wajar dilakukan LANGSUNG
   di gambarnya — seret untuk memindah, gulir untuk memperbesar.

   ── MODE ATUR vs KUNCI ──────────────────────────────────────────────────
   Seretan menuntut lapisannya menangkap tetikus, dan lapisan yang menangkap
   tetikus mematikan geser, zoom, dan seluruh alat gambar chart di bawahnya.
   Jadi ia cuma menyala di mode Atur. Begitu dikunci, lapisannya kembali
   tembus total dan chart-nya utuh seperti tidak ada apa-apa di atasnya.
   ════════════════════════════════════════════════════════════════════════ */

export interface TambatJiplak { kiri: number; kanan: number; atas: number; bawah: number }

export interface AturJiplak {
  id: string;
  url: string;
  opacity: number;
  /** Menangkap tetikus untuk diseret/digulir. Mati = chart utuh kembali. */
  atur: boolean;
  /** null = belum dipaskan; ChartLilin yang menghitung pas-awalnya dari
   *  rentang yang sedang terlihat, lalu melapor balik. */
  tambat: TambatJiplak | null;
}

/* Menyala di mode Atur sejak awal: gambar yang baru dipasang HAMPIR SELALU
   perlu dipaskan dulu, dan menyuruh orangnya menekan satu tombol lagi untuk
   memulai pekerjaan yang sudah pasti ia lakukan cuma menambah langkah. */
export const JIPLAK_BAWAAN = { opacity: 0.34, atur: true, tambat: null };

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

  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setBuka(false);
    };
    window.addEventListener('pointerdown', luar);
    return () => window.removeEventListener('pointerdown', luar);
  }, [buka]);

  /* Object URL yang sedang terpasang dilepas saat diganti atau saat
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
            <div className="mb-2 space-y-2 rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
              {/* Sakelar mode. Ditulis sebagai KEADAAN SEKARANG, bukan
                  sebagai perintah: tombol yang berbunyi "Kunci" saat sedang
                  terkunci selalu ambigu — dibaca "sudah terkunci" oleh
                  separuh orang dan "tekan untuk mengunci" oleh separuhnya. */}
              <div className="flex overflow-hidden rounded-md border border-zinc-800">
                {([[true, 'Atur', Crosshair], [false, 'Kunci', Lock]] as const).map(([v, label, Ikon]) => (
                  <button key={label} onClick={() => ubah({ ...nilai, atur: v })}
                    className={cn('flex flex-1 cursor-pointer items-center justify-center gap-1 py-1.5 text-[11.5px] font-medium transition-colors',
                      nilai.atur === v ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
                    <Ikon className="size-3" />{label}
                  </button>
                ))}
              </div>

              <p className="text-[10.5px] leading-relaxed text-zinc-500">
                {nilai.atur
                  ? 'Seret untuk memindah, gulir untuk memperbesar. Tahan Shift = melebar saja, Alt = meninggi saja. Chart di bawahnya berhenti merespons selama mode ini.'
                  : 'Gambarnya menempel pada harga dan waktu — ikut bergerak saat chart digeser atau di-zoom.'}
              </p>

              <label className="block">
                <span className="flex items-center justify-between text-[11px] text-zinc-500">
                  Ketebalan
                  <span className="tabular-nums text-zinc-400">{Math.round(nilai.opacity * 100)}%</span>
                </span>
                <input type="range" min={0.05} max={0.9} step={0.01} value={nilai.opacity}
                       onChange={(e) => ubah({ ...nilai, opacity: Number(e.target.value) })}
                       className="mt-1 w-full cursor-pointer accent-zinc-300" />
              </label>

              <div className="flex gap-1.5">
                {/* `tambat: null` = "hitung ulang pas-awalnya". Angkanya
                    dikembalikan ChartLilin, bukan dikarang di sini —
                    pemanggil tidak memegang skala chart-nya. */}
                <button onClick={() => ubah({ ...nilai, tambat: null })}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 transition-colors hover:text-zinc-100">
                  <Maximize2 className="size-3" /> Paskan ulang
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
