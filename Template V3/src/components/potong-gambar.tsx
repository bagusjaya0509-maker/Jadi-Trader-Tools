import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   PEMOTONG GAMBAR
   ════════════════════════════════════════════════════════════════════════
   Dipakai gambar analisa di formulir Copy Signal. Tangkapan layar yang
   dikirim orang hampir tidak pernah pas: ada bilah tugas, ada panel
   watchlist, ada setengah jendela lain di pinggirnya. Yang perlu dilihat
   pembeli cuma chart-nya.

   ── DIGAMBAR SENDIRI, BUKAN MEMASANG PUSTAKA ──────────────────────────
   Pemotong siap pakai yang umum berukuran 30-60 kB dan membawa gaya,
   tema, serta cara kerjanya sendiri yang harus didandani ulang supaya
   cocok dengan halaman ini. Yang diperlukan di sini satu persegi yang
   bisa digeser dan ditarik sudutnya, lalu satu panggilan drawImage.

   ── KOORDINAT: TAMPILAN vs ASLI ───────────────────────────────────────
   Persegi potongnya hidup di koordinat TAMPILAN — piksel di layar, yang
   sama dengan yang disentuh jari. Pemotongannya sendiri terjadi di
   koordinat ASLI gambar, yang bisa 4x lebih besar. Satu bilangan `skala`
   yang menjembatani keduanya, dan ia dihitung ulang tiap kali gambarnya
   selesai dimuat — bukan sekali di awal, karena lebar tampilannya
   bergantung pada lebar layar yang bisa berubah.
   ════════════════════════════════════════════════════════════════════════ */

/** Sisi terpanjang hasil potongan. Tangkapan layar 4K yang dipotong
 *  setengah masih menghasilkan untai base64 belasan MB — jauh di atas
 *  batas 5 MB servernya. 1600 px sudah lebih tajam dari lebar kolom mana
 *  pun yang menampilkannya. */
const SISI_MAKS = 1600;

/** Persegi terkecil yang masih masuk akal, dalam piksel tampilan. Di bawah
 *  ini sudutnya saling tindih dan tidak ada lagi yang bisa ditarik. */
const MIN = 32;

type Kotak = { x: number; y: number; w: number; h: number };
type Mode = 'geser' | 'nw' | 'ne' | 'sw' | 'se';

export function PotongGambar({ sumber, onSelesai, onBatal }: {
  sumber: string;
  onSelesai: (hasil: string) => void;
  onBatal: () => void;
}) {
  const gambar = useRef<HTMLImageElement | null>(null);
  const [siap, setSiap] = useState(false);
  const [kotak, setKotak] = useState<Kotak>({ x: 0, y: 0, w: 0, h: 0 });
  const seret = useRef<{ mode: Mode; x: number; y: number; awal: Kotak } | null>(null);

  /** Ukuran tampilan waktu perseginya terakhir dihitung. Ia yang membuat
   *  perbedaan "belum pernah diukur" dan "ukurannya berubah" bisa
   *  dibedakan — dua keadaan yang perlakuannya berlawanan. */
  const dasar = useRef<{ w: number; h: number } | null>(null);

  /* ── PERSEGINYA MENYESUAIKAN DIRI ───────────────────────────────────
     Ditemukan waktu menguji, bukan ditebak: kalau gambarnya selesai
     dimuat SEBELUM tata letaknya mapan — panel baru dibuka, tab masih di
     belakang — lebarnya terbaca nol, dan persegi 86% dari nol adalah
     persegi nol. Dulu itu permanen: pengukurannya cuma sekali di onLoad,
     jadi perseginya tidak pernah muncul lagi meski gambarnya kemudian
     tampil utuh.

     Dua keadaan, dua perlakuan:
     • BELUM PERNAH diukur   -> pasang persegi awal 86%, di tengah.
       Bukan 100%: persegi yang menempel persis di tepi tidak terlihat
       seperti sesuatu yang bisa ditarik.
     • Ukurannya BERUBAH     -> potongannya ikut diskalakan, bukan
       direset. Orang yang sudah menyusun potongannya lalu memutar HP
       tidak sedang meminta pekerjaannya dibatalkan. */
  function sesuaikan() {
    const el = gambar.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;

    const d = dasar.current;
    if (!d) {
      const w = r.width * 0.86, h = r.height * 0.86;
      dasar.current = { w: r.width, h: r.height };
      setKotak({ x: (r.width - w) / 2, y: (r.height - h) / 2, w, h });
      setSiap(true);
      return;
    }
    if (Math.abs(d.w - r.width) < 0.5 && Math.abs(d.h - r.height) < 0.5) return;
    const kx = r.width / d.w, ky = r.height / d.h;
    dasar.current = { w: r.width, h: r.height };
    setKotak((k) => ({ x: k.x * kx, y: k.y * ky, w: k.w * kx, h: k.h * ky }));
  }

  /* Sesudah SETIAP render, sesudah tata letak dihitung. Itu yang menangkap
     perubahan yang tidak punya peristiwanya sendiri — panel yang membuka,
     gambar yang baru selesai diurai. Aman dari putaran tanpa henti karena
     `sesuaikan` berhenti sendiri begitu ukurannya sama. */
  useLayoutEffect(sesuaikan);

  /* Tiga penjaga, karena ukuran gambar ini bisa berubah lewat tiga jalan
     yang tidak saling mengabari:

     • useLayoutEffect di atas  -> perubahan yang terjadi bersama render.
     • ResizeObserver           -> gambarnya sendiri berubah ukuran tanpa
       render dan tanpa jendela berubah. Ini elemen biasa di aliran tata
       letak, jadi observer-nya memang melapor di sini — beda dengan kurva
       saldo yang berposisi absolut dan tingginya persen.
     • resize jendela           -> jaring terakhir untuk peramban yang
       observer-nya tidak berbunyi.

     Ketiganya memanggil fungsi yang sama, dan fungsi itu berhenti sendiri
     kalau ukurannya tidak berubah — jadi tumpang tindihnya tidak
     menghasilkan pekerjaan ganda. */
  useEffect(() => {
    const el = gambar.current;
    window.addEventListener('resize', sesuaikan);
    const ro = new ResizeObserver(() => sesuaikan());
    if (el) ro.observe(el);
    return () => { window.removeEventListener('resize', sesuaikan); ro.disconnect(); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  function mulai(e: React.PointerEvent, mode: Mode) {
    e.preventDefault();
    e.stopPropagation();
    /* Dibungkus try: penangkapan penunjuk menolak pointerId yang sudah
       tidak aktif — jari yang terangkat lebih cepat dari peristiwanya,
       atau penunjuk buatan. Gagal menangkap bukan alasan menggagalkan
       seluruh seretan; yang hilang cuma kemampuan mengikuti jari di
       luar kotaknya. */
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* diabaikan */ }
    seret.current = { mode, x: e.clientX, y: e.clientY, awal: { ...kotak } };
  }

  function gerak(e: React.PointerEvent) {
    const s = seret.current;
    const el = gambar.current;
    if (!s || !el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    const a = s.awal;

    if (s.mode === 'geser') {
      /* Dijepit ke dalam gambar, bukan dibiarkan lewat lalu dibetulkan
         waktu dilepas: persegi yang sempat keluar bingkai lalu melompat
         balik membuat orang mengira geserannya meleset. */
      setKotak({
        ...a,
        x: Math.min(Math.max(0, a.x + dx), r.width - a.w),
        y: Math.min(Math.max(0, a.y + dy), r.height - a.h),
      });
      return;
    }

    /* Sudut: yang bergerak dua sisi, dua sisi lain diam. Ditulis sebagai
       tepi kiri/atas/kanan/bawah dulu, baru diubah balik jadi x/y/w/h —
       menghitung langsung dengan w dan h membuat persegi terbalik sendiri
       waktu ditarik melewati sisi seberangnya. */
    let kiri = a.x, atas = a.y, kanan = a.x + a.w, bawah = a.y + a.h;
    if (s.mode === 'nw' || s.mode === 'sw') kiri = Math.min(Math.max(0, a.x + dx), kanan - MIN);
    if (s.mode === 'ne' || s.mode === 'se') kanan = Math.max(Math.min(r.width, a.x + a.w + dx), kiri + MIN);
    if (s.mode === 'nw' || s.mode === 'ne') atas = Math.min(Math.max(0, a.y + dy), bawah - MIN);
    if (s.mode === 'sw' || s.mode === 'se') bawah = Math.max(Math.min(r.height, a.y + a.h + dy), atas + MIN);
    setKotak({ x: kiri, y: atas, w: kanan - kiri, h: bawah - atas });
  }

  function selesaiSeret(e: React.PointerEvent) {
    const s = seret.current;
    if (!s) return;
    seret.current = null;
    const el = e.target as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }

  function potong() {
    const el = gambar.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    /* Kotaknya harus benar-benar terukur. Kalau lebarnya nol — tab di
       belakang, induknya sedang display:none, gambarnya belum selesai
       dimuat — maka skala jadi Infinity, kanvasnya jadi 0x0, dan
       toDataURL memulangkan untai "data:," yang sah bentuknya tapi bukan
       gambar apa pun.

       Ditemukan waktu menguji: yang paling berbahaya bukan galatnya,
       melainkan TIDAK adanya galat. Untai itu diterima begitu saja lalu
       ikut terbit sebagai gambar analisa, dan sinyal yang sudah terbit
       tidak bisa dihapus. */
    if (!(r.width >= 1 && r.height >= 1 && el.naturalWidth >= 1)) return;
    const skala = el.naturalWidth / r.width;

    let lebar = Math.round(kotak.w * skala);
    let tinggi = Math.round(kotak.h * skala);
    /* Diperkecil kalau perlu, dengan nisbah dijaga. Dilakukan DI SINI dan
       bukan waktu berkasnya dipilih: yang menentukan besarnya untai
       terakhir adalah potongannya, bukan gambar utuhnya. */
    const terpanjang = Math.max(lebar, tinggi);
    if (terpanjang > SISI_MAKS) {
      const k = SISI_MAKS / terpanjang;
      lebar = Math.round(lebar * k);
      tinggi = Math.round(tinggi * k);
    }

    const kanvas = document.createElement('canvas');
    kanvas.width = Math.max(1, lebar);
    kanvas.height = Math.max(1, tinggi);
    const ktx = kanvas.getContext('2d');
    if (!ktx) return;

    /* Alas gelap dulu. Hasilnya JPEG, dan JPEG tidak mengenal tembus
       pandang — PNG bertepi transparan tanpa alas akan jadi hitam pekat
       yang tidak cocok dengan halaman mana pun. Warna ini alas situsnya. */
    ktx.fillStyle = '#09090b';
    ktx.fillRect(0, 0, kanvas.width, kanvas.height);
    ktx.drawImage(
      el,
      kotak.x * skala, kotak.y * skala, kotak.w * skala, kotak.h * skala,
      0, 0, kanvas.width, kanvas.height,
    );
    /* JPEG 0,9 — bukan PNG. Tangkapan chart penuh gradien dan anti-alias;
       PNG-nya bisa 8x lebih besar tanpa satu pun bedanya terlihat. */
    const hasil = kanvas.toDataURL('image/jpeg', 0.9);
    /* Diperiksa sekali lagi di ujungnya. Kanvas bisa juga gagal karena
       sebab lain (memori habis di HP lawas), dan kegagalannya berbentuk
       untai pendek yang sama — bukan pengecualian yang bisa ditangkap. */
    if (!hasil.startsWith('data:image/')) return;
    onSelesai(hasil);
  }

  const sudut = 'absolute size-3.5 rounded-[3px] border border-zinc-950 bg-zinc-100';

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[11.5px] font-medium text-zinc-300">Potong gambarnya</span>
        <span className="text-[11px] text-zinc-600">— geser persegi, tarik sudutnya</span>
      </div>

      <div className="flex justify-center overflow-hidden rounded border border-zinc-800 bg-zinc-950">
        <div className="relative inline-block select-none">
          <img ref={gambar} src={sumber} alt="Gambar yang sedang dipotong" onLoad={sesuaikan}
               draggable={false} className="block max-h-[46vh] max-w-full" />
          {siap && (
            <>
              {/* Bidang gelap di LUAR persegi, dipasang empat sisi. Satu
                  kotak dengan bayangan raksasa juga bisa, tapi bayangan
                  sebesar itu digambar ulang tiap gerakan jari dan
                  patah-patah di HP. */}
              <div className="pointer-events-none absolute inset-x-0 top-0 bg-zinc-950/65" style={{ height: kotak.y }} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-zinc-950/65" style={{ top: kotak.y + kotak.h }} />
              <div className="pointer-events-none absolute bg-zinc-950/65" style={{ top: kotak.y, height: kotak.h, left: 0, width: kotak.x }} />
              <div className="pointer-events-none absolute bg-zinc-950/65" style={{ top: kotak.y, height: kotak.h, left: kotak.x + kotak.w, right: 0 }} />

              <div
                onPointerDown={(e) => mulai(e, 'geser')}
                onPointerMove={gerak}
                onPointerUp={selesaiSeret}
                onPointerCancel={selesaiSeret}
                className="absolute cursor-move border border-zinc-100/90 touch-none"
                style={{ left: kotak.x, top: kotak.y, width: kotak.w, height: kotak.h }}
              >
                {([['nw', '-left-1.5 -top-1.5 cursor-nwse-resize'],
                   ['ne', '-right-1.5 -top-1.5 cursor-nesw-resize'],
                   ['sw', '-bottom-1.5 -left-1.5 cursor-nesw-resize'],
                   ['se', '-bottom-1.5 -right-1.5 cursor-nwse-resize']] as [Mode, string][])
                  .map(([m, pos]) => (
                    <div key={m}
                         onPointerDown={(e) => mulai(e, m)}
                         onPointerMove={gerak}
                         onPointerUp={selesaiSeret}
                         onPointerCancel={selesaiSeret}
                         className={cn(sudut, pos, 'touch-none')} />
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={potong} disabled={!siap}
          className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
          <Check className="size-3.5" /> Pakai potongan
        </button>
        {/* "Pakai utuh", bukan "Batal": yang menekan sudah memilih
            gambarnya, dan tombol bernama Batal di sebelah pemotong
            terbaca seperti membatalkan pilihan gambarnya juga. */}
        <button onClick={onBatal}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
          <X className="size-3.5" /> Pakai utuh
        </button>
      </div>
    </div>
  );
}
