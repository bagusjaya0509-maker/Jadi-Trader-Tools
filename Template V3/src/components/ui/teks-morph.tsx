import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════════════════════════════════
   TEKS YANG MELELEH DARI SATU KATA KE KATA BERIKUTNYA
   ══════════════════════════════════════════════════════════════════════
   Dua lapis teks bertumpuk. Yang lama diburamkan sampai hilang sementara
   yang baru menajam dari buram — dan sebuah filter SVG "threshold"
   menyatukan piksel setengah-transparan keduanya jadi satu bentuk. Itu yang
   membuat hurufnya terlihat meleleh, bukan sekadar memudar bergantian.

   Diadaptasi dari komponen MorphingText yang dikirim pemilik. Yang diubah,
   dan alasannya:

     · `"use client"` dan `//@ts-nocheck` dibuang. Yang pertama arahan
       Next.js dan tidak berarti apa-apa di Vite; yang kedua mematikan
       pemeriksaan tipe untuk SELURUH berkas — harga yang terlalu mahal
       untuk menghemat tiga anotasi.

     · Kelas ukuran bawaannya (h-16, text-[40pt], lg:text-[6rem]) TIDAK
       dibawa. Judul ini sudah punya ukurannya sendiri lewat
       `.parallax__title`, dan dua sumber ukuran yang bertengkar akan
       dimenangkan siapa pun yang kebetulan belakangan di berkas CSS.

     · Kata pertama ditulis SEBELUM animasi mulai — lihat catatan panjang
       di bawah.
   ══════════════════════════════════════════════════════════════════════ */

const LAMA_MORPH = 1.5;    // detik satu lelehan

/* ── BERAPA LAMA SEBUAH KATA DIAM SEBELUM MELELEH LAGI ────────────────
   Aslinya 0,5 detik untuk semua kata. Dengan lelehan 1,5 detik itu berarti
   satu kata utuh cuma bertahan setengah detik dari dua detik siklusnya —
   tiga perempat waktunya layar menampilkan huruf yang sedang buram.

   Sekarang 1,4 detik untuk kata biasa: cukup untuk dibaca tanpa terasa
   berhenti.

   Dan kata PERTAMA dapat jatah sendiri, 3,4 detik. Ia bukan sekadar salah
   satu dari delapan kata — ia nama produknya, satu-satunya yang harus
   diingat orang yang baru mendarat di halaman ini. Kata sifat yang lewat
   boleh cepat; namanya tidak. */
const LAMA_DIAM = 1.4;     // detik berhenti di kata biasa
const LAMA_DIAM_AWAL = 3.4; // detik berhenti di kata pertama (nama produk)

function kurangGerak(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

function useMorph(teks: string[]) {
  const indeks = useRef(0);
  const maju = useRef(0);
  const diam = useRef(0);
  const waktu = useRef(Date.now());

  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);

  const pasangGaya = useCallback((bagian: number) => {
    const [p, q] = [a.current, b.current];
    if (!p || !q || !teks.length) return;

    q.style.filter = `blur(${Math.min(8 / bagian - 8, 100)}px)`;
    q.style.opacity = `${Math.pow(bagian, 0.4) * 100}%`;

    const balik = 1 - bagian;
    p.style.filter = `blur(${Math.min(8 / balik - 8, 100)}px)`;
    p.style.opacity = `${Math.pow(balik, 0.4) * 100}%`;

    p.textContent = teks[indeks.current % teks.length];
    q.textContent = teks[(indeks.current + 1) % teks.length];
  }, [teks]);

  /* ── KATA PERTAMA DITULIS SEBELUM BINGKAI PERTAMA ──────────────────
     Aslinya kedua span dibiarkan KOSONG sampai requestAnimationFrame
     berjalan. Di halaman biasa itu tidak terasa — bingkai pertama datang
     belasan milidetik kemudian.

     Tapi rAF tidak selalu berjalan: di tab latar, di panel pratinjau yang
     tidak tampil, dan pada perangkat yang menghemat daya, ia bisa ditunda
     tanpa batas. Yang terjadi kemudian bukan animasi yang tersendat,
     melainkan JUDUL HALAMAN DEPAN YANG KOSONG — kegagalan yang jauh lebih
     mahal daripada animasi yang tidak jalan.

     Jadi kata pertama ditulis sinkron saat mount. Kalau animasinya tidak
     pernah mulai, yang terlihat "Jadi Trader" diam — persis seperti
     sebelum ada animasi. */
  useLayoutEffect(() => {
    const [p, q] = [a.current, b.current];
    if (!p || !q || !teks.length) return;
    p.textContent = teks[0];
    p.style.opacity = '100%';
    p.style.filter = 'none';
    q.textContent = teks[1 % teks.length];
    q.style.opacity = '0%';
    q.style.filter = 'none';
  }, [teks]);

  const lelehkan = useCallback(() => {
    maju.current -= diam.current;
    diam.current = 0;
    let bagian = maju.current / LAMA_MORPH;
    if (bagian > 1) {
      /* Kata yang SEDANG SELESAI muncul adalah yang berikutnya, karena
         `indeks` baru bertambah beberapa baris di bawah. Salah satu langkah
         di sini membuat jeda panjangnya jatuh ke kata sebelum atau sesudah
         nama produknya — terlihat seperti satu kata acak yang lebih lambat
         daripada yang lain. */
      const berikut = (indeks.current + 1) % teks.length;
      diam.current = berikut === 0 ? LAMA_DIAM_AWAL : LAMA_DIAM;
      bagian = 1;
    }
    pasangGaya(bagian);
    if (bagian === 1) indeks.current++;
  }, [pasangGaya, teks.length]);

  const tahan = useCallback(() => {
    maju.current = 0;
    const [p, q] = [a.current, b.current];
    if (!p || !q) return;
    q.style.filter = 'none';
    q.style.opacity = '100%';
    p.style.filter = 'none';
    p.style.opacity = '0%';
  }, []);

  useEffect(() => {
    /* Yang menyetel perangkatnya mengurangi gerak tidak dipaksa melihat
       huruf meleleh terus-menerus di layar pertama yang ia buka. Kata
       pertamanya sudah terpasang oleh useLayoutEffect di atas. */
    if (kurangGerak()) return;

    let bingkai = 0;
    const jalan = () => {
      bingkai = requestAnimationFrame(jalan);
      const kini = Date.now();
      const dt = (kini - waktu.current) / 1000;
      waktu.current = kini;
      diam.current -= dt;
      if (diam.current <= 0) lelehkan();
      else tahan();
    };
    jalan();
    return () => cancelAnimationFrame(bingkai);
  }, [lelehkan, tahan]);

  return { a, b };
}

/* Filter ambang batas: piksel yang setengah transparan dipaksa jadi
   sepenuhnya ada atau sepenuhnya hilang. Itu yang menyambungkan dua huruf
   buram yang saling bertumpang jadi satu bentuk yang meleleh. */
function FilterAmbang() {
  return (
    <svg className="hidden" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="jt-ambang">
          <feColorMatrix in="SourceGraphic" type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 255 -140" />
        </filter>
      </defs>
    </svg>
  );
}

export function TeksMorph({ teks, className }: { teks: string[]; className?: string }) {
  const { a, b } = useMorph(teks);
  return (
    /* `aria-label` memuat kata pertamanya dan isinya disembunyikan dari
       pembaca layar: kalimat yang berganti tiap dua detik akan dibacakan
       ulang tanpa henti, dan itu bukan judul — itu gangguan. */
    <span className={cn('teks-morph', className)} aria-label={teks[0]}>
      <span aria-hidden="true" ref={a} className="teks-morph__lapis" />
      <span aria-hidden="true" ref={b} className="teks-morph__lapis" />
      <FilterAmbang />
    </span>
  );
}
