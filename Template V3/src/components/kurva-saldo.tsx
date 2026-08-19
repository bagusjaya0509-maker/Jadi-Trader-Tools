import { useEffect, useMemo, useRef, useState } from 'react';
import type { RingkasAnalisa } from '@/lib/analisa';
import { cn, uang } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   KURVA SALDO SATU ANALIS
   ════════════════════════════════════════════════════════════════════════
   Berdiri sendiri, bukan di dalam halaman yang memakainya: kurva ini duduk
   di KARTU ANALIS di daftar kanal — layar tempat orang memilih siapa yang
   akan ia ikuti. Di situlah pertanyaannya muncul, dan di situ pula ia harus
   dijawab; menunggu sampai kanalnya dibuka berarti menyuruh orang masuk
   dulu ke tujuh kanal untuk membandingkan tujuh analis.

   ── ANGKANYA ESTIMASI, DAN ITU HARUS TERTULIS ──────────────────────────
   Ini BUKAN uang sungguhan siapa pun. Ia hasil satu model: modal awal
   tetap, risiko tetap per sinyal, tiap sinyal dianggap diikuti penuh.
   Analisnya mungkin tidak pernah memegang modal sebesar itu.

   Model yang sama dipakai papan peringkat, dan angkanya datang dari server
   lewat medan hasilDolar — berkas ini tidak menghitung ulang apa pun selain
   menjumlahkannya berurutan.

   ── DIGAMBAR TANGAN, BUKAN PAKAI RECHARTS ──────────────────────────────
   Recharts sudah ada di proyek ini, tapi ia potongan ±380 kB yang cuma
   dimuat halaman yang benar-benar memerlukannya. Untuk satu garis tanpa
   sumbu, tooltip, dan legenda, yang diperlukan cuma sebuah path.
   ════════════════════════════════════════════════════════════════════════ */

/** Saldo kumulatif, berurutan menurut waktu sinyal SELESAI.
 *
 *  Titik pertama modal awal, sebelum sinyal mana pun. Tanpa itu kurvanya
 *  mulai dari hasil sinyal PERTAMA, dan hasil pertama yang kebetulan menang
 *  membuat grafiknya seolah tidak pernah berada di bawah modal. */
export function titikSaldo(sinyal: RingkasAnalisa[], modal: number): number[] {
  const selesai = sinyal
    .filter((s) => typeof s.hasilDolar === 'number')
    .sort((a, b) => (a.waktuHasil || a.dibuat) - (b.waktuHasil || b.dibuat));
  const out = [modal];
  let saldo = modal;
  for (const s of selesai) {
    saldo += s.hasilDolar as number;
    out.push(saldo);
  }
  return out;
}

function jalur(nilai: number[], W: number, H: number, pad: number, modal: number) {
  /* Rentangnya SELALU memuat garis modal. Kalau tidak, akun yang tidak
     pernah menyentuh modal awal menggambar garis modalnya di luar bidang —
     dan pembaca kehilangan satu-satunya patokan yang membuat kurvanya
     berarti. */
  const min = Math.min(...nilai, modal);
  const max = Math.max(...nilai, modal);
  const rentang = max - min || 1;
  const X = (i: number) => (i / (nilai.length - 1)) * W;
  const Y = (v: number) => pad + (1 - (v - min) / rentang) * (H - pad * 2);
  const d = nilai.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
  return { d, Y };
}

/** Versi mungil untuk kartu analis: garis saja, tanpa angka dan tanpa
 *  keterangan — keduanya sudah berdiri di kotak sebelahnya.
 *
 *  ── DIUKUR, BUKAN DIREGANGKAN ────────────────────────────────────────
 *  Versi pertama memakai viewBox tetap 120×44 dengan
 *  preserveAspectRatio="none", dan itu berarti gambarnya DIREGANGKAN ke
 *  ukuran kotaknya. Akibatnya bukan sekadar kurang rapi: kurva yang sama
 *  terbaca LANDAI di jendela lebar dan CURAM di jendela sempit, karena
 *  sumbu mendatarnya melar sementara sumbu tegaknya tidak. Kemiringan
 *  garis adalah satu-satunya hal yang dibaca orang dari grafik seukuran
 *  ini, dan kemiringan yang berubah mengikuti lebar jendela adalah
 *  grafik yang berbohong dengan sopan.
 *
 *  Sekarang kotaknya diukur ResizeObserver dan jalurnya digambar dalam
 *  piksel sungguhan, jadi tidak ada peregangan sama sekali — bentuknya
 *  tetap sama di lebar berapa pun, cuma ruangnya yang bertambah.
 *
 *  Wadahnya SELALU dirender walau datanya belum siap. Kalau tidak,
 *  ResizeObserver tidak punya apa pun untuk diamati, dan grafiknya tidak
 *  akan pernah tahu ukurannya sendiri.
 */
export function SparklineSaldo(
  { sinyal, modal, kelas }: { sinyal: RingkasAnalisa[]; modal: number; kelas?: string },
) {
  const nilai = useMemo(() => titikSaldo(sinyal, modal), [sinyal, modal]);
  const kotak = useRef<HTMLSpanElement | null>(null);
  const [ukuran, setUkuran] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = kotak.current;
    if (!el) return;
    /* contentRect, bukan offsetWidth: yang dipakai menggambar adalah ruang
       DI DALAM kotaknya, dan pembacaan lewat offsetWidth memaksa layout
       dihitung ulang tiap kali — di halaman berisi belasan kartu, itu
       belasan perhitungan tiap kali jendela digeser satu piksel. */
    const ro = new ResizeObserver((entri) => {
      const r = entri[0].contentRect;
      setUkuran((s) => {
        const w = Math.round(r.width), h = Math.round(r.height);
        return (s.w === w && s.h === h) ? s : { w, h };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = ukuran;
  /* Ambang 8 px: di bawah itu kotaknya belum benar-benar tergambar (mis.
     satu frame pertama, atau induknya sedang display:none), dan menggambar
     jalur di ruang selebar nol menghasilkan path yang tidak sah. */
  const siap = nilai.length >= 2 && w > 8 && h > 8;

  const akhir = nilai[nilai.length - 1];
  const naik = akhir >= modal;
  const warna = naik ? '#34d399' : '#f87171';
  const pad = 4;
  const { d, Y } = siap ? jalur(nilai, w, h, pad, modal) : { d: '', Y: () => 0 };

  /* id gradien DIBEDAKAN per warna, bukan per pemakaian. Beberapa kartu
     tampil bersamaan di satu layar; id yang sama di semua kartu membuat
     yang belakangan menimpa definisi yang pertama, dan seluruh kartu ikut
     berwarna sama dengan kartu terakhir. */
  const idGrad = naik ? 'gradSaldoNaik' : 'gradSaldoTurun';

  return (
    <span ref={kotak} className={cn('relative block', kelas)}>
      {siap && (
        <>
          <svg width={w} height={h} viewBox={'0 0 ' + w + ' ' + h} className="block" aria-hidden>
            <defs>
              <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={warna} stopOpacity={0.3} />
                <stop offset="100%" stopColor={warna} stopOpacity={0} />
              </linearGradient>
            </defs>
            <line x1="0" y1={Y(modal)} x2={w} y2={Y(modal)}
                  stroke="#3f3f46" strokeWidth={1} strokeDasharray="3 3" />
            <path d={d + ' L' + w + ',' + h + ' L0,' + h + ' Z'} fill={'url(#' + idGrad + ')'} />
            <path d={d} fill="none" stroke={warna} strokeWidth={1.6}
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* SUDUT, MENGIKUTI ARAHNYA — bukan mengikuti titik akhir garisnya.

              Untung di kanan ATAS, rugi di kanan BAWAH. Kurva yang naik
              berakhir tinggi dan yang turun berakhir rendah, jadi sudutnya
              selalu jatuh di sisi yang sama dengan ujung garisnya.

              Tanpa latar dan tanpa tepi: alas gelap di dalam kotak yang
              sudah bertepi menambah bidang ketiga di ruang setinggi 40
              piksel. */}
          <span className={cn('absolute right-0 text-[7px] leading-none tabular-nums text-zinc-100',
                              naik ? 'top-0' : 'bottom-0')}>
            {uang(akhir)}
          </span>
        </>
      )}
    </span>
  );
}
