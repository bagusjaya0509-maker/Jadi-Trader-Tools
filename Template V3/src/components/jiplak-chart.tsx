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

   ── TIGA PERCOBAAN, DAN KENAPA YANG KETIGA YANG DIPAKAI ─────────────────
   1. Hamparan dengan transform persen. Bisa dipaskan, tapi paskannya hilang
      begitu chart digeser sekali — gambarnya terikat ke LAYAR, bukan ke
      harga.
   2. Hamparan dengan tambatan koordinat chart. Menempel benar dan ikut
      bergerak, tapi tetap sulit dipakai: dua chart yang ditumpuk berarti dua
      kisi, dua rangkaian lilin, dan dua warna berebut ruang yang sama.
      Menipiskan opasitasnya cuma memilih mana yang lebih sulit dibaca.
   3. LAYAR TERBELAH. Gambar acuan di kiri dengan ketajaman PENUH, chart
      sungguhan di kanan tanpa apa pun di atasnya. Keputusan pemilik, dan
      benar: acuan itu untuk DIBACA, bukan untuk dijiplak garis demi garis.

   ── YANG MENYAMBUNGKAN KEDUANYA: HARGA, DIISI TANGAN ────────────────────
   Harga atas dan bawah gambarnya diketik sendiri — dibaca dari sumbu harga
   di gambar itu. Begitu terisi, gambarnya digeser dan diregangkan supaya
   level yang sama jatuh di ketinggian yang sama dengan chart di kanan: zona
   di kiri bisa dibaca lurus mendatar ke kanan, tanpa menghitung apa pun.

   Sengaja TIDAK ditebak dari gambarnya. Angka hasil tebakan yang dipakai
   menaruh garis harga adalah kesalahan yang tidak kelihatan sebagai
   kesalahan — ia cuma terlihat seperti level yang meleset sedikit.
   ════════════════════════════════════════════════════════════════════════ */

export interface AturJiplak {
  id: string;
  url: string;
  /** Bagian lebar layar untuk panel acuan (0,2–0,6). */
  lebar: number;
  /** Harga di tepi atas & bawah GAMBAR. 0 = belum diisi. */
  hargaAtas: number;
  hargaBawah: number;
}

export const JIPLAK_BAWAAN = { lebar: 0.42, hargaAtas: 0, hargaBawah: 0 };

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
              <p className="text-[10.5px] leading-relaxed text-zinc-500">
                Isi harga di tepi ATAS dan BAWAH gambarnya — dibaca dari sumbu
                harga di gambar itu sendiri. Levelnya lalu sejajar dengan chart
                di kanan.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {([['hargaAtas', 'Harga atas'], ['hargaBawah', 'Harga bawah']] as const).map(([k, label]) => (
                  <label key={k} className="block">
                    <span className="text-[10.5px] text-zinc-500">{label}</span>
                    <input
                      className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-[11.5px] text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                      inputMode="decimal" placeholder="—"
                      value={nilai[k] ? String(nilai[k]) : ''}
                      /* Titik ATAU koma: papan angka ponsel di Indonesia
                         memberi koma, dan Number('4,6') itu NaN. */
                      onChange={(e) => {
                        const v = Number(e.target.value.trim().replace(',', '.'));
                        ubah({ ...nilai, [k]: isFinite(v) && v > 0 ? v : 0 });
                      }} />
                  </label>
                ))}
              </div>

              <label className="block">
                <span className="flex items-center justify-between text-[11px] text-zinc-500">
                  Lebar panel
                  <span className="tabular-nums text-zinc-400">{Math.round(nilai.lebar * 100)}%</span>
                </span>
                <input type="range" min={0.2} max={0.6} step={0.01} value={nilai.lebar}
                       onChange={(e) => ubah({ ...nilai, lebar: Number(e.target.value) })}
                       className="mt-1 w-full cursor-pointer accent-zinc-300" />
              </label>

              <button onClick={lepas}
                className="w-full cursor-pointer rounded border border-zinc-700 py-1 text-[11px] text-zinc-400 transition-colors hover:text-red-400">
                Tutup panel acuan
              </button>
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
