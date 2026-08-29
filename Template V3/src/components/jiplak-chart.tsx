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

   ── YANG MENYAMBUNGKAN KEDUANYA: MATA, BUKAN ANGKA ──────────────────────
   Dulu harga tepi atas & bawah gambarnya diketik tangan, lalu gambarnya
   diregangkan supaya level yang sama jatuh di ketinggian yang sama dengan
   chart di kanan. Betul secara hitungan, dan tetap dibuang — karena untuk
   memakainya orang harus membaca dua angka dari sumbu harga di gambar,
   mengetiknya, lalu memeriksa hasilnya; dan begitu chart di kanan di-zoom,
   dua angka itu tidak salah, cuma tidak lagi menolong.

   Sekarang gambarnya digeser dan di-zoom langsung dengan roda dan seretan,
   seperti gambar lain mana pun. Menyamakan levelnya jadi pekerjaan mata,
   selesai dalam sedetik, dan tidak ada angka yang perlu benar lebih dulu.
   ════════════════════════════════════════════════════════════════════════ */

export interface AturJiplak {
  id: string;
  url: string;
  /** Bagian lebar layar untuk panel acuan. Diubah dengan menarik batasnya. */
  lebar: number;
  /** Perbesaran gambar. 1 = selebar panelnya. */
  zoom: number;
  /** Geseran gambar dalam piksel, dari pojok kiri-atas panel. */
  x: number;
  y: number;
}

export const JIPLAK_BAWAAN = { lebar: 0.42, zoom: 1, x: 0, y: 0 };

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
                Roda untuk zoom, seret untuk menggeser, klik dua kali untuk
                mengembalikan. Batas antara gambar dan chart ditarik dengan
                mouse.
              </p>

              <button onClick={() => ubah({ ...nilai, zoom: 1, x: 0, y: 0 })}
                className="w-full cursor-pointer rounded border border-zinc-800 py-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-100">
                Kembalikan ukuran gambar
              </button>

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
