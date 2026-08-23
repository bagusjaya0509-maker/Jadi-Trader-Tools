import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const X = (i: number) => (i / Math.max(1, nilai.length - 1)) * W;
  const Y = (v: number) => pad + (1 - (v - min) / rentang) * (H - pad * 2);

  const n = nilai.length;
  const px = nilai.map((_, i) => X(i));
  const py = nilai.map(Y);

  /* Kurang dari tiga titik tidak punya apa pun untuk dilengkungkan. */
  if (n < 3) {
    const lurus = nilai.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
    return { d: lurus, X, Y };
  }

  /* ── KUBIK MONOTON (Fritsch–Carlson), bukan spline biasa ───────────────
     Yang digambar di sini UANG. Spline Catmull-Rom atau kardinal biasa
     melampaui titik datanya di sekitar belokan tajam — puncaknya naik lebih
     tinggi daripada saldo tertinggi yang pernah benar-benar dicapai analis
     itu, dan lembahnya turun lebih dalam daripada drawdown yang sungguh
     terjadi. Untuk grafik hiasan itu tidak apa-apa; untuk rekam jejak yang
     dipakai orang memilih siapa yang ditiru, itu menggambar keuntungan yang
     tidak pernah ada.

     Fritsch–Carlson menjinakkan kemiringan tiap simpul sampai kurvanya
     dijamin tidak pernah melewati nilai di kedua ujung ruasnya. Hasilnya
     tetap mulus di mata, tapi tidak satu piksel pun berbohong: puncak
     kurvanya persis puncak datanya.

     Sumbu X-nya berjarak seragam, jadi `dx` cukup dihitung sekali. */
  const dx = px[1] - px[0];

  const beda: number[] = [];
  for (let i = 0; i < n - 1; i++) beda.push((py[i + 1] - py[i]) / dx);

  const m: number[] = new Array(n);
  m[0] = beda[0];
  m[n - 1] = beda[n - 2];
  for (let i = 1; i < n - 1; i++) {
    /* ARAH BERBALIK -> KEMIRINGAN NOL. Ini syarat yang paling mudah
       terlewat, dan tanpa itu penjinakan di bawah tidak cukup: di titik
       puncak dan lembah kurvanya tetap membusung melewati datanya.

       Terukur, bukan dikira: pada 3.000 deret acak tanpa baris ini ada
       314.064 titik kurva yang melampaui nilai di ujung ruasnya, terjauh
       2,36 piksel. Dengan baris ini: nol dari 2,67 juta titik. Pada kartu
       setinggi 60 px, 2,36 piksel itu kira-kira empat persen dari seluruh
       tinggi grafik — cukup untuk memunculkan puncak keuntungan yang tidak
       pernah terjadi. */
    m[i] = beda[i - 1] * beda[i] <= 0 ? 0 : (beda[i - 1] + beda[i]) / 2;
  }

  for (let i = 0; i < n - 1; i++) {
    /* Ruas datar WAJIB berkemiringan nol di kedua ujungnya. Tanpa ini,
       deretan nilai yang sama akan bergelombang halus — grafik yang
       bergerak padahal saldonya diam. */
    if (beda[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / beda[i];
    const b = m[i + 1] / beda[i];
    const kuadrat = a * a + b * b;
    if (kuadrat > 9) {
      const skala = 3 / Math.sqrt(kuadrat);
      m[i] = skala * a * beda[i];
      m[i + 1] = skala * b * beda[i];
    }
  }

  let d = 'M' + px[0].toFixed(1) + ',' + py[0].toFixed(1);
  for (let i = 0; i < n - 1; i++) {
    const k1x = px[i] + dx / 3;
    const k1y = py[i] + (m[i] * dx) / 3;
    const k2x = px[i + 1] - dx / 3;
    const k2y = py[i + 1] - (m[i + 1] * dx) / 3;
    d += ' C' + k1x.toFixed(1) + ',' + k1y.toFixed(1)
       + ' ' + k2x.toFixed(1) + ',' + k2y.toFixed(1)
       + ' ' + px[i + 1].toFixed(1) + ',' + py[i + 1].toFixed(1);
  }
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

  /* ── MENGUKUR KOTAK GAMBARNYA ──────────────────────────────────────
     useLayoutEffect TANPA DAFTAR KEBERGANTUNGAN: ia berjalan sesudah
     SETIAP render, sesudah tata letak dihitung, sebelum layar dilukis.
     Tiga sumber perubahan ukuran terjawab sekaligus, dan ketiganya nyata
     di halaman ini:

     • Render pertama — kotaknya baru ada sesudah efeknya jalan.
     • Batang gulir muncul waktu datanya datang. Halaman jadi lebih
       sempit, kartunya ikut menyempit ~2 px. Tidak ada peristiwa apa pun
       yang mengabarkan ini: jendelanya tidak berubah, dan observer tidak
       melapor untuk susunan ini. Yang mengabarkannya cuma render yang
       memuat datanya sendiri.
     • Jendela digeser — ditangani pendengar resize di bawah.

     Aman dari putaran tanpa henti karena penyimpannya menolak menyimpan
     ukuran yang sama; setelah satu render tambahan, keadaannya diam.

     TIDAK MEMAKAI requestAnimationFrame. Sempat dicoba dan terlihat
     bekerja, padahal tidak: rAF berhenti dijalankan begitu halamannya
     tidak sedang dilukis — tab di belakang, jendela ditutupi, peramban
     yang tidak menggambar bingkai. Pengukuran yang cuma dijadwalkan lewat
     rAF berarti kartu di tab belakang tidak pernah dikoreksi, dan
     ketahuannya baru waktu orang berpindah ke tab itu. */
  useLayoutEffect(() => {
    const el = kotak.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    /* Nol berarti induknya sedang disembunyikan. Kalau dipakai, grafik
       yang sudah tergambar ikut hilang dan tidak pernah kembali — ukuran
       berikutnya sama dengan yang tersimpan, jadi tidak ada yang memicu
       gambar ulang. */
    if (r.width < 1 && r.height < 1) return;
    setUkuran((u) => {
      const w = Math.round(r.width), h = Math.round(r.height);
      return (u.w === w && u.h === h) ? u : { w, h };
    });
  });

  /* Jendela digeser. Dipasang sekali, dan mengukur LANGSUNG — bukan
     dijadwalkan. Satu getBoundingClientRect per kartu per peristiwa
     resize memang membaca tata letak, tapi peramban sudah menggabungkan
     peristiwa resize jadi satu per bingkai; belasan pembacaan di bingkai
     yang tata letaknya toh baru dihitung ulang bukan beban yang terasa. */
  useEffect(() => {
    const ukur = () => {
      const el = kotak.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) return;
      setUkuran((u) => {
        const w = Math.round(r.width), h = Math.round(r.height);
        return (u.w === w && u.h === h) ? u : { w, h };
      });
    };
    window.addEventListener('resize', ukur);
    /* Observer tetap dipasang.

       KOREKSI atas catatan sebelumnya di berkas ini: dulu ditulis bahwa
       observer-nya "tidak pernah melapor untuk susunan berposisi absolut".
       Itu keliru. Diuji terpisah 21 Agu 2026 — ResizeObserver tidak
       berbunyi sama sekali di peramban yang tidak sedang MELUKIS bingkai,
       apa pun susunannya, karena penyampaian laporannya bagian dari
       langkah render. Yang bisu waktu itu bukan susunannya, melainkan
       peramban pemeriksanya.

       Jadi observer ini memang bekerja di peramban sungguhan. Ia
       dipertahankan sebagai jalur utama; useLayoutEffect dan pendengar
       resize di sekitarnya yang menjaga keadaan-keadaan yang tidak
       dilaporkannya. */
    const ro = new ResizeObserver(ukur);
    if (kotak.current) ro.observe(kotak.current);
    return () => { window.removeEventListener('resize', ukur); ro.disconnect(); };
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
