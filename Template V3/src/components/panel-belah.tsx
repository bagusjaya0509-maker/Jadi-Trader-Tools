import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   PANEL BELAH — panel kiri, batas yang ditarik, isi di kanan
   ════════════════════════════════════════════════════════════════════════
   Dibuat karena satu cacat yang tidak bisa diperbaiki di tempat asalnya.

   Versi pertama menaruh daftar posisi dompet DI DALAM ChartLilin, memakai
   ulang slot panel acuan jiplak. Secara tata letak itu benar dan tidak
   menggandakan apa pun. Tapi ChartLilin dipasang dengan
   `key={simbol|tf|kunciChart}` — dan kunci yang memuat simbol berarti
   SELURUH komponennya dibongkar-pasang tiap kali pasangannya berganti.

   Untuk chart itu memang disengaja: pustaka grafiknya menyimpan deret di
   dalam dirinya, dan membangunnya ulang lebih murah daripada memastikan
   tidak ada sisa deret lama. Tapi daftar di sebelahnya ikut dibongkar, dan
   yang terlihat orang adalah panel kiri yang berkedip tiap kali ia
   berpindah koin — persis yang dilaporkan.

   Kedipnya TIDAK BISA dihilangkan dari dalam: apa pun yang duduk di dalam
   subpohon yang dikunci akan ikut mati bersamanya. Jadi panelnya dipindah
   KELUAR, dan pembelah layarnya berdiri sendiri di sini.

   ── KENAPA BUKAN MENYALIN KODE PEMBELAHNYA ──────────────────────────────
   Karena kalau disalin, dua tempat harus sepakat selamanya soal cara
   membelah layar — dan yang satu pasti tertinggal saat yang lain
   diperbaiki. Berkas ini satu-satunya pemilik logika itu untuk pemakaian
   di luar jiplak; panel acuan jiplak tetap di dalam ChartLilin karena ia
   memang harus sejajar dengan kanvasnya.
   ════════════════════════════════════════════════════════════════════════ */

export function PanelBelah({ kiri, lebarAwal = 0.28, tinggi, onLebar, children }: {
  /** Isi panel kiri. null/undefined = tidak membelah sama sekali. */
  kiri?: ReactNode;
  lebarAwal?: number;
  /** Tinggi panel kiri, disamakan dengan tinggi chart di kanannya. */
  tinggi: number;
  /** Lebar yang DIMAKAN panel ini di sebelah kiri, dalam piksel — panelnya
   *  plus pembatasnya. 0 saat tidak membelah.
   *
   *  Ada karena hamparan di luar sini tidak punya cara lain mengetahuinya.
   *  Bilah alat gambar dijangkarkan ke area chart, dan area itu sekarang
   *  memuat panel ini juga: `left: 8` yang dulu berarti "8 px dari tepi
   *  kiri lilin" berubah diam-diam menjadi "8 px dari tepi kiri DAFTAR",
   *  dan bilahnya duduk menimpa isi panel. Lebarnya dikirim ke atas supaya
   *  yang melayang bisa menghitung tepi chart yang sebenarnya.
   *
   *  Piksel, bukan persen: yang memakainya menaruh `left` dalam piksel,
   *  dan menyeberangkan satuan di tengah jalan berarti dua tempat yang
   *  harus sepakat selamanya. */
  onLebar?: (px: number) => void;
  children: ReactNode;
}) {
  const [lebar, setLebar] = useState(lebarAwal);
  const [seret, setSeret] = useState<number | null>(null);
  const [bungkus, setBungkus] = useState<HTMLDivElement | null>(null);
  const w = seret ?? lebar;

  /* Diukur dari elemen sungguhan, bukan dihitung dari persen dikali lebar
     jendela: pembungkusnya ikut menyusut saat watchlist meluncur masuk, dan
     angka yang diturunkan dari jendela akan tetap percaya diri padahal
     salah.

     Dipasang SEBELUM `if (!kiri)` — sesudah cabang yang keluar lebih awal,
     efeknya cuma hidup sebagian waktu, dan jumlah hook yang berubah antar
     render adalah galat React, bukan pilihan gaya. */
  const kosong = !kiri;
  useEffect(() => {
    if (!onLebar) return;
    if (kosong || !bungkus) { onLebar(0); return; }
    /* +4: pembatasnya sendiri selebar 4 px. Tepi chart mulai sesudah
       PEMBATAS, bukan sesudah panelnya. */
    const kirim = () => onLebar(Math.round(bungkus.getBoundingClientRect().width * w) + 4);
    kirim();
    const ro = new ResizeObserver(kirim);
    ro.observe(bungkus);
    return () => ro.disconnect();
  }, [onLebar, kosong, bungkus, w]);

  if (!kiri) return <>{children}</>;

  return (
    <div ref={setBungkus} className="flex">
      <div className="shrink-0 overflow-hidden border-zinc-800 bg-zinc-950"
           style={{ width: `${(w * 100).toFixed(2)}%`, height: tinggi }}>
        <div className="h-full overflow-y-auto">{kiri}</div>
      </div>

      {/* Daerah tangkap 4 px, garis yang terlihat 1 px. Batas setipis
          garisnya sendiri menuntut ketepatan mouse yang tidak ada
          hubungannya dengan pekerjaan yang sedang dilakukan. */}
      <div className="group relative w-1 shrink-0 cursor-col-resize" style={{ height: tinggi }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const el = e.currentTarget;
          el.setPointerCapture(e.pointerId);
          const hitung = (g: PointerEvent) => {
            if (!bungkus) return null;
            const r = bungkus.getBoundingClientRect();
            if (r.width <= 0) return null;
            /* Dijepit 15–70%: panel yang menutup layar berarti tidak ada
               lagi chart untuk dilihat, dan itu kebalikan dari gunanya. */
            return Math.min(0.7, Math.max(0.15, (g.clientX - r.left) / r.width));
          };
          const gerak = (g: PointerEvent) => { const v = hitung(g); if (v !== null) setSeret(v); };
          const lepas = (g: PointerEvent) => {
            el.removeEventListener('pointermove', gerak);
            el.removeEventListener('pointerup', lepas);
            el.removeEventListener('pointercancel', lepas);
            const v = hitung(g);
            setSeret(null);
            if (v !== null) setLebar(v);
          };
          el.addEventListener('pointermove', gerak);
          el.addEventListener('pointerup', lepas);
          el.addEventListener('pointercancel', lepas);
        }}>
        <span aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-800 transition-colors group-hover:bg-zinc-500" />
        <span aria-hidden
          className={cn('pointer-events-none absolute left-1/2 top-1/2 h-8 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-500 transition-opacity',
            seret !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')} />
      </div>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
