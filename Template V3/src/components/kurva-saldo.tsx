import { useEffect, useMemo, useRef, useState } from 'react';
import type { RingkasAnalisa } from '@/lib/analisa';
import { cn, uang, tanggalPendek } from '@/lib/utils';

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

/** Sama seperti titikSaldo, tapi membawa WAKTU tiap titik.
 *
 *  Dipisah, bukan menggantikan: titikSaldo dipakai di tempat lain yang cuma
 *  butuh deret angkanya, dan menambah medan ke sana berarti setiap
 *  pemakainya ikut menanggung bentuk yang tidak ia perlukan.
 *
 *  Titik pertama waktunya 0 — ia keadaan SEBELUM sinyal mana pun, bukan
 *  sebuah peristiwa. Yang membaca tooltip di titik itu diberi tulisan
 *  "modal awal", bukan tanggal yang tidak pernah terjadi. */
export function titikSaldoRinci(sinyal: RingkasAnalisa[], modal: number): { saldo: number; waktu: number }[] {
  const selesai = sinyal
    .filter((s) => typeof s.hasilDolar === 'number')
    .sort((a, b) => (a.waktuHasil || a.dibuat) - (b.waktuHasil || b.dibuat));
  const out = [{ saldo: modal, waktu: 0 }];
  let saldo = modal;
  for (const s of selesai) {
    saldo += s.hasilDolar as number;
    out.push({ saldo, waktu: s.waktuHasil || s.dibuat });
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
  return { d, X, Y };
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
  { sinyal, modal, kelas, interaktif }: {
    sinyal: RingkasAnalisa[]; modal: number; kelas?: string;
    /** Menyalakan penunjuk: garis tegak, titik, dan kotak berisi P/L pada
     *  posisi tetikus. Mati secara bawaan — kurva sekecil 40 px di kartu
     *  lama tidak punya ruang untuk ditunjuk, dan penunjuk yang muncul di
     *  grafik setinggi jempol lebih menghalangi daripada menerangkan. */
    interaktif?: boolean;
  },
) {
  const nilai = useMemo(() => titikSaldo(sinyal, modal), [sinyal, modal]);
  const rinci = useMemo(() => titikSaldoRinci(sinyal, modal), [sinyal, modal]);
  /** Titik yang sedang ditunjuk. null = tetikusnya sedang tidak di atas. */
  const [tunjuk, setTunjuk] = useState<number | null>(null);
  const kotak = useRef<HTMLSpanElement | null>(null);
  const [ukuran, setUkuran] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = kotak.current;
    if (!el) return;
    /* contentRect, bukan offsetWidth: yang dipakai menggambar adalah ruang
       DI DALAM kotaknya, dan pembacaan lewat offsetWidth memaksa layout
       dihitung ulang tiap kali — di halaman berisi belasan kartu, itu
       belasan perhitungan tiap kali jendela digeser satu piksel. */
    const pakai = (w: number, h: number) =>
      setUkuran((s) => ((s.w === w && s.h === h) ? s : { w, h }));

    /* DIUKUR SEKALI DI SINI, tidak menunggu ResizeObserver.
       ──────────────────────────────────────────────────────────────────
       Terbukti perlu: di kartu analis yang baru, kurvanya duduk sebagai
       lapisan berposisi absolut dengan tinggi persen, dan di susunan itu
       observer-nya tidak pernah melaporkan apa pun — ukurannya tetap 0x0
       selamanya, jadi grafiknya tidak digambar sama sekali sementara
       kotaknya nyata 190x172 di layar.

       Pengukuran langsung menjawab pertanyaan yang sama tanpa menunggu
       peristiwa: berapa ukuran kotak ini SEKARANG. Observer tetap dipasang
       untuk perubahan sesudahnya — jendela digeser, panel dilipat. */
    const r0 = el.getBoundingClientRect();
    pakai(Math.round(r0.width), Math.round(r0.height));

    const ro = new ResizeObserver((entri) => {
      const r = entri[0]?.contentRect;
      if (!r) return;
      /* contentRect bisa 0 saat induknya sedang disembunyikan; kalau
         dipakai, grafik yang sudah tergambar ikut hilang dan tidak pernah
         kembali karena ukuran berikutnya tidak berubah lagi. */
      if (r.width < 1 && r.height < 1) return;
      pakai(Math.round(r.width), Math.round(r.height));
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
  const { d, X, Y } = siap ? jalur(nilai, w, h, pad, modal) : { d: '', X: () => 0, Y: () => 0 };

  /* id gradien DIBEDAKAN per warna, bukan per pemakaian. Beberapa kartu
     tampil bersamaan di satu layar; id yang sama di semua kartu membuat
     yang belakangan menimpa definisi yang pertama, dan seluruh kartu ikut
     berwarna sama dengan kartu terakhir. */
  const idGrad = naik ? 'gradSaldoNaik' : 'gradSaldoTurun';

  /* Titik terdekat dari posisi tetikus. Dihitung dari LEBAR PER LANGKAH,
     bukan dengan mencari jarak ke tiap titik: deretnya sudah berjarak
     seragam di sumbu X, jadi satu pembagian sudah tepat dan tidak ikut
     melambat saat sinyalnya ratusan. */
  const cariTitik = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!siap || !interaktif) return;
    const r = e.currentTarget.getBoundingClientRect();
    const langkah = w / Math.max(1, nilai.length - 1);
    const i = Math.round((e.clientX - r.left) / langkah);
    setTunjuk(Math.min(nilai.length - 1, Math.max(0, i)));
  };

  const t = tunjuk !== null ? rinci[tunjuk] : null;
  const pl = t ? t.saldo - modal : 0;

  return (
    <span ref={kotak} className={cn('relative block', kelas)}
          onPointerMove={cariTitik}
          onPointerLeave={() => setTunjuk(null)}>
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

            {/* PENUNJUK. Garis tegak dulu, titik belakangan — kalau
                dibalik, garisnya menimpa titik dan ujungnya tampak
                terpotong pada layar ber-DPI rendah. */}
            {t && (
              <>
                <line x1={X(tunjuk!)} y1={0} x2={X(tunjuk!)} y2={h}
                      stroke={warna} strokeOpacity={0.35} strokeWidth={1} />
                <circle cx={X(tunjuk!)} cy={Y(t.saldo)} r={3.5}
                        fill={warna} stroke="#09090b" strokeWidth={1.5} />
              </>
            )}
          </svg>
        </>
      )}
      {/* KOTAK ANGKA, di luar svg supaya hurufnya ikut aturan huruf halaman
          — teks di dalam svg tidak mewarisi kelas Tailwind dan harus
          diukur sendiri di setiap layar.

          Dijepit ke dalam kotaknya: di titik paling kanan, kotak yang
          berpusat pada garisnya akan setengah keluar kartu. */}
      {siap && t && (
        <span className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-950/95 px-1.5 py-1 text-center leading-tight"
              style={{ left: Math.min(Math.max(X(tunjuk!), 34), Math.max(34, w - 34)) }}>
          <span className={cn('angka block text-[11px] font-semibold',
            pl > 0 ? 'text-emerald-400' : pl < 0 ? 'text-red-400' : 'text-zinc-300')}>
            {uang(t.saldo)}
          </span>
          <span className="block text-[9px] text-zinc-500">
            {t.waktu ? tanggalPendek(t.waktu) : 'modal awal'}
          </span>
        </span>
      )}
    </span>
  );
}
