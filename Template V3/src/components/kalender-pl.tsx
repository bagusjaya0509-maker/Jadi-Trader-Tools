import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BarisHari } from '@/lib/hitung';
import { cn, uang } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   KALENDER UNTUNG-RUGI
   ════════════════════════════════════════════════════════════════════════
   Dulu tinggal di dalam Jurnal.tsx. Diangkat ke sini saat halaman Performa
   Signal membutuhkan kalender yang sama persis — dan menyalinnya berarti
   dua salinan yang akan berselisih pelan-pelan, termasuk salinan dari bug
   zona waktu di bawah yang sudah pernah diperbaiki sekali.

   Satu prop wajib: peta `YYYY-MM-DD` -> nilai. Sumbernya boleh apa saja —
   transaksi jurnal, hasil sinyal — karena komponen ini tidak tahu dan tidak
   perlu tahu angkanya berasal dari mana.

   `rincian` opsional. Yang punya rinciannya mendapat gelembung; yang tidak
   punya tetap mendapat kalender yang sama persis seperti sebelumnya.
   ════════════════════════════════════════════════════════════════════════ */

/** Lebar gelembung, dipakai juga untuk menjepitnya ke dalam layar. */
const LEBAR_GELEMBUNG = 244;
/** Berapa banyak pair yang ditampilkan sebelum sisanya dirangkum. */
const MAKS_BARIS = 7;

/* ── HANYA SATU GELEMBUNG DI SELURUH HALAMAN ────────────────────────────
   Halaman Jurnal memasang DUA kalender: Trade-Fi dan Kripto. Masing-masing
   punya keadaannya sendiri, jadi tanpa ini gelembung yang dikunci di
   kalender atas tetap menggantung saat orangnya membuka gelembung di
   kalender bawah — dua kotak melayang sekaligus, dan yang atas sudah tidak
   ada hubungannya dengan apa yang sedang dilihat.

   Ketahuan saat menguji di peramban. Diselesaikan dengan pengumuman
   sederhana antar-instans, bukan dengan mengangkat keadaannya ke pemanggil:
   pemanggil tidak punya urusan dengan gelembung siapa yang sedang terbuka,
   dan `KalenderPl` dipakai di dua halaman berbeda. */
const pendengarBuka = new Set<(pemilik: object) => void>();

interface Buka {
  kunci: string;
  hari: number;
  /** Posisi selnya di layar saat gelembungnya dibuka. */
  kotak: DOMRect;
  /** Dibuka lewat klik, bukan lewat lewatnya tetikus. Yang diklik bertahan
   *  sampai ditutup — itu satu-satunya cara isinya bisa dibaca di ponsel,
   *  yang tidak punya "arahkan tetikus" sama sekali. */
  terkunci: boolean;
}

export function KalenderPl({ pl, rincian, satuanNol = 'Total bulan ini' }: {
  pl: Map<string, number>;
  /** Kunci HARUS sama dengan `pl` — lihat `kunciHari` di lib/hitung.ts. */
  rincian?: Map<string, BarisHari[]>;
  /** Label baris total. Jurnal menyebutnya "Total bulan ini"; halaman lain
   *  boleh menyebutnya lain tanpa perlu menyalin seluruh komponen. */
  satuanNol?: string;
}) {
  /* Bulan yang sedang dilihat, sebagai offset dari bulan berjalan.
     0 = bulan ini, -1 = bulan lalu. Menyimpan offset, bukan objek Date,
     membuat "maju/mundur satu bulan" tidak perlu memikirkan panjang bulan
     maupun pergantian tahun — Date(tahun, bulan-1, 1) sudah benar sendiri
     bahkan untuk Januari. */
  const [geserBulan, setGeserBulan] = useState(0);
  const [buka, setBuka] = useState<Buka | null>(null);
  const gelembungRef = useRef<HTMLDivElement | null>(null);
  /** Penanda instans ini. Objek kosong sudah cukup — yang dibutuhkan cuma
   *  sesuatu yang tidak pernah sama dengan milik instans lain. */
  const sayaRef = useRef({});

  const tutup = useCallback(() => setBuka(null), []);
  /** Buka milik sendiri, dan minta yang lain menutup. */
  const bukaPunyaku = useCallback((b: Buka) => {
    setBuka(b);
    pendengarBuka.forEach((f) => f(sayaRef.current));
  }, []);

  useEffect(() => {
    const saya = sayaRef.current;
    const dengar = (pemilik: object) => { if (pemilik !== saya) setBuka(null); };
    pendengarBuka.add(dengar);
    return () => { pendengarBuka.delete(dengar); };
  }, []);

  /* ── KAPAN GELEMBUNGNYA HARUS PERGI ──────────────────────────────────
     Posisinya `fixed` dan dihitung dari letak sel PADA SAAT DIBUKA. Begitu
     halamannya bergulir, angka itu basi dan gelembungnya melayang di tempat
     yang tidak menunjuk apa-apa. Menghitung ulang tiap frame gulir bisa
     saja, tapi gelembung yang mengejar-ngejar selnya lebih mengganggu
     daripada gelembung yang menutup.

     Escape ikut, dan klik di luar ikut — keduanya cuma berlaku untuk yang
     TERKUNCI; yang muncul karena tetikus lewat sudah punya jalan keluarnya
     sendiri. */
  useEffect(() => {
    if (!buka) return;
    const pergi = () => setBuka(null);
    const tombol = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(null); };
    const luar = (e: MouseEvent) => {
      if (!buka.terkunci) return;
      const g = gelembungRef.current;
      if (g && !g.contains(e.target as Node)) setBuka(null);
    };
    window.addEventListener('scroll', pergi, true);
    window.addEventListener('resize', pergi);
    window.addEventListener('keydown', tombol);
    document.addEventListener('mousedown', luar);
    return () => {
      window.removeEventListener('scroll', pergi, true);
      window.removeEventListener('resize', pergi);
      window.removeEventListener('keydown', tombol);
      document.removeEventListener('mousedown', luar);
    };
  }, [buka]);

  /* Bulan-bulan yang BENAR-BENAR punya isi, dari data. Dipakai untuk tombol
     lompat: menawarkan Maret yang kosong sama saja dengan menyuruh orang
     menebak-nebak di mana datanya. */
  const bulanBerisi = useMemo(() => {
    const set = new Set<string>();
    pl.forEach((_, kunci) => set.add(kunci.slice(0, 7)));
    return [...set].sort();
  }, [pl]);

  const acuan = new Date();
  const dilihat = new Date(acuan.getFullYear(), acuan.getMonth() + geserBulan, 1);
  const tahun = dilihat.getFullYear();
  const bulan = dilihat.getMonth();
  const jmlHari = new Date(tahun, bulan + 1, 0).getDate();
  const geser = (new Date(tahun, bulan, 1).getDay() + 6) % 7;
  const maks = Math.max(1, ...[...pl.values()].map(Math.abs));

  const sel: (null | { hari: number; kunci: string; nilai?: number })[] = [
    ...Array(geser).fill(null),
    ...Array.from({ length: jmlHari }, (_, i) => {
      /* Kunci tanggal LOKAL, bukan toISOString(). toISOString() mengubah ke
         UTC, jadi tanggal 1 jam 00:00 WIB jatuh ke tanggal 30 bulan lalu —
         dan seluruh kalender bergeser satu hari. Pasangannya `kunciHari()`
         di lib/hitung.ts, yang menyusun petanya dengan aturan yang sama. */
      const kunci = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      return { hari: i + 1, kunci, nilai: pl.get(kunci) };
    }),
  ];
  const total = sel.reduce((s, c) => s + (c?.nilai ?? 0), 0);

  const kunciDilihat = `${tahun}-${String(bulan + 1).padStart(2, '0')}`;
  const adaData = bulanBerisi.includes(kunciDilihat);

  const barisBuka = buka ? (rincian?.get(buka.kunci) ?? []) : [];
  const totalBuka = barisBuka.reduce((s, b) => s + b.pnl, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={() => { tutup(); setGeserBulan((n) => n - 1); }} aria-label="Bulan sebelumnya"
          className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-[12.5px] text-zinc-300">
          {dilihat.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          {!adaData && <span className="ml-1.5 text-[11px] text-zinc-600">· kosong</span>}
        </span>
        <button onClick={() => { tutup(); setGeserBulan((n) => Math.min(0, n + 1)); }} disabled={geserBulan >= 0}
          aria-label="Bulan berikutnya"
          className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Lompat langsung ke bulan yang ada isinya. Menekan panah enam kali
          untuk sampai ke Juli adalah gesekan yang tidak perlu ketika
          daftarnya sudah kita punya. */}
      {bulanBerisi.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {bulanBerisi.map((b) => {
            const [y, m] = b.split('-').map(Number);
            const off = (y - acuan.getFullYear()) * 12 + (m - 1 - acuan.getMonth());
            return (
              <button key={b} onClick={() => { tutup(); setGeserBulan(off); }}
                className={cn('cursor-pointer rounded px-1.5 py-0.5 text-[10.5px] transition-colors',
                  off === geserBulan ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 text-zinc-500 hover:text-zinc-200')}>
                {new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-2 grid grid-cols-7 gap-1">
        {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => (
          <div key={i} className="text-center text-[10.5px] text-zinc-600">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {sel.map((c, i) => {
          if (!c) return <div key={i} />;
          const ada = typeof c.nilai === 'number';
          const untung = (c.nilai ?? 0) >= 0;
          const kuat = ada ? Math.min(0.45, (Math.abs(c.nilai!) / maks) * 0.45) : 0;
          const punyaRincian = ada && !!rincian?.get(c.kunci)?.length;
          const isi = (
            <>
              <span className={ada ? 'text-zinc-200' : ''}>{c.hari}</span>
              {ada && (
                <span className={cn('angka text-[8.5px]', untung ? 'text-emerald-400' : 'text-red-400')}>
                  {c.nilai! >= 0 ? '+' : ''}{c.nilai!.toFixed(0)}
                </span>
              )}
            </>
          );
          const kelas = cn(
            'flex aspect-square w-full flex-col items-center justify-center rounded-md border text-[10.5px]',
            ada ? (untung ? 'border-emerald-500/25' : 'border-red-500/25') : 'border-zinc-800/50 text-zinc-600',
            punyaRincian && 'cursor-pointer transition-shadow hover:ring-1 hover:ring-zinc-500',
            buka?.kunci === c.kunci && 'ring-1 ring-zinc-300',
          );
          const gaya = ada
            ? { background: untung ? `rgba(16,185,129,${kuat})` : `rgba(239,68,68,${kuat})` }
            : undefined;

          /* Sel tanpa rincian tetap <div> dengan `title` seperti dulu —
             tombol yang tidak melakukan apa-apa saat ditekan lebih buruk
             daripada teks biasa, dan pembaca layar ikut menyebutnya
             "tombol" tanpa ada yang bisa dilakukan. */
          if (!punyaRincian) {
            return (
              <div key={i} title={ada ? `${c.hari}: ${uang(c.nilai!)}` : undefined}
                   className={kelas} style={gaya}>{isi}</div>
            );
          }
          const bukaDari = (el: HTMLElement, terkunci: boolean) =>
            bukaPunyaku({ kunci: c.kunci, hari: c.hari, kotak: el.getBoundingClientRect(), terkunci });
          return (
            <button
              key={i}
              type="button"
              className={kelas}
              style={gaya}
              aria-label={`${c.hari}: ${uang(c.nilai!)} — lihat rincian per pair`}
              onMouseEnter={(e) => { if (!buka?.terkunci) bukaDari(e.currentTarget, false); }}
              onMouseLeave={() => setBuka((b) => (b && !b.terkunci && b.kunci === c.kunci ? null : b))}
              onFocus={(e) => { if (!buka?.terkunci) bukaDari(e.currentTarget, false); }}
              onBlur={() => setBuka((b) => (b && !b.terkunci && b.kunci === c.kunci ? null : b))}
              onClick={(e) => {
                /* Klik pada hari yang gelembungnya sedang terkunci = tutup.
                   Di ponsel itu satu-satunya cara menutupnya tanpa menebak
                   harus menyentuh di mana. */
                if (buka?.terkunci && buka.kunci === c.kunci) { setBuka(null); return; }
                bukaDari(e.currentTarget, true);
              }}
            >
              {isi}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-[12.5px]">
        <span className="text-zinc-500">{satuanNol}</span>
        <span className={cn('angka', total >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(total, true)}</span>
      </div>

      {/* ── GELEMBUNG RINCIAN ─────────────────────────────────────────────
          Lewat portal ke <body>, bukan di dalam kisinya.

          Kalendernya duduk di dalam kartu ber-`rounded-xl`, dan kartu itu
          punya tetangga yang menumpuk. Gelembung yang digambar di dalam
          kisi harus melawan dua hal sekaligus: pemotongan oleh kartu yang
          membungkusnya, dan konteks penumpukan yang membuat `z-index`
          berlaku hanya di dalam kartu itu. Portal menghindari keduanya
          tanpa satu pun `overflow: visible` yang harus dititipkan ke
          komponen lain.

          Harganya: posisinya dihitung sendiri, dan ia tidak ikut bergulir —
          itu sebabnya gelembungnya menutup saat halaman digulir. */}
      {buka && barisBuka.length > 0 && createPortal(
        (() => {
          const k = buka.kotak;
          /* Dijepit ke dalam layar. Hari Senin ada di tepi kiri kisi dan
             Minggu di tepi kanan; tanpa jepitan ini gelembung keduanya
             separuh keluar layar. */
          const kiri = Math.max(8, Math.min(
            k.left + k.width / 2 - LEBAR_GELEMBUNG / 2,
            window.innerWidth - LEBAR_GELEMBUNG - 8));
          /* Di paruh bawah layar gelembungnya naik ke atas selnya. Kalender
             ini duduk di bawah lipatan pada layar pendek, dan gelembung
             yang selalu turun akan jatuh di luar jendela. */
          const keAtas = k.top > window.innerHeight / 2;
          const atas = keAtas ? k.top - 8 : k.bottom + 8;
          const tanggal = new Date(`${buka.kunci}T00:00:00`);
          return (
            <div
              ref={gelembungRef}
              role="dialog"
              aria-label={`Rincian ${buka.kunci}`}
              style={{
                position: 'fixed', left: kiri, top: atas, width: LEBAR_GELEMBUNG,
                transform: keAtas ? 'translateY(-100%)' : undefined, zIndex: 60,
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-950/95 p-3 shadow-xl backdrop-blur-sm"
            >
              <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-zinc-800 pb-2">
                <span className="text-[11.5px] text-zinc-300">
                  {tanggal.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className={cn('angka text-[12px]', totalBuka >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {uang(totalBuka, true)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {barisBuka.slice(0, MAKS_BARIS).map((b) => (
                  <div key={b.pair} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11px] text-zinc-400">{b.pair}</span>
                    <span className="flex shrink-0 items-baseline gap-1.5">
                      {/* Jumlah transaksi cuma disebut kalau lebih dari
                          satu. "1x" di tiap baris adalah lima karakter yang
                          tidak pernah menjawab pertanyaan siapa pun. */}
                      {b.n > 1 && <span className="text-[9.5px] text-zinc-600">{b.n}x</span>}
                      <span className={cn('angka text-[11px]', b.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {uang(b.pnl, true)}
                      </span>
                    </span>
                  </div>
                ))}
                {barisBuka.length > MAKS_BARIS && (() => {
                  /* Sisanya dibawa BESERTA jumlahnya. Tanpa angka itu,
                     baris-baris yang tampil tidak pernah berjumlah sama
                     dengan total di kepalanya — dan orang yang menjumlahkan
                     sendiri akan mengira salah satunya keliru.

                     Ketahuan saat menguji di peramban: hari dengan 9 pair
                     menampilkan tujuh yang berjumlah +$13,09 di bawah judul
                     yang menulis +$12,87. Dua-duanya benar; yang hilang
                     cuma keterangan −$0,22-nya. */
                  const sisa = barisBuka.slice(MAKS_BARIS);
                  const jumlah = sisa.reduce((s, b) => s + b.pnl, 0);
                  return (
                    <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[10px] text-zinc-600">
                      <span>+ {sisa.length} pair lain</span>
                      <span className={cn('angka', jumlah >= 0 ? 'text-emerald-400/70' : 'text-red-400/70')}>
                        {uang(jumlah, true)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })(),
        document.body)}
    </div>
  );
}
