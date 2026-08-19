import { useMemo } from 'react';
import type { RingkasAnalisa } from '@/lib/analisa';

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
 *  keterangan — keduanya sudah berdiri di kotak sebelahnya. */
export function SparklineSaldo(
  { sinyal, modal, kelas }: { sinyal: RingkasAnalisa[]; modal: number; kelas?: string },
) {
  const nilai = useMemo(() => titikSaldo(sinyal, modal), [sinyal, modal]);
  if (nilai.length < 2) return null;

  const akhir = nilai[nilai.length - 1];
  const naik = akhir >= modal;
  const warna = naik ? '#34d399' : '#f87171';
  const W = 120, H = 44, pad = 4;
  const { d, Y } = jalur(nilai, W, H, pad, modal);

  /* id gradien DIBEDAKAN per warna, bukan per pemakaian. Beberapa kartu
     tampil bersamaan di satu layar; id yang sama di semua kartu membuat
     yang belakangan menimpa definisi yang pertama, dan seluruh kartu ikut
     berwarna sama dengan kartu terakhir. */
  const idGrad = naik ? 'gradSaldoNaik' : 'gradSaldoTurun';

  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none"
         className={kelas} aria-hidden>
      <defs>
        <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={warna} stopOpacity={0.3} />
          <stop offset="100%" stopColor={warna} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line x1="0" y1={Y(modal)} x2={W} y2={Y(modal)}
            stroke="#3f3f46" strokeWidth={1} strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke" />
      <path d={d + ' L' + W + ',' + H + ' L0,' + H + ' Z'} fill={'url(#' + idGrad + ')'} />
      {/* vectorEffect: tanpa ini tebal garisnya ikut melar saat
          preserveAspectRatio="none" meregangkan viewBox ke lebar kotaknya. */}
      <path d={d} fill="none" stroke={warna} strokeWidth={1.6}
            vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
