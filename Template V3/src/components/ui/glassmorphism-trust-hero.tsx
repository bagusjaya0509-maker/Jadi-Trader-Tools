import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LineChart, Wallet, Crown, Check, X, RotateCcw } from "lucide-react";
import { useAngkaPameran, usePosisiPameran, PAMERAN_CONTOH } from "@/lib/pameran";
import { useAuth } from "@/lib/auth";
import { JUDUL_BERANDA, SUB_BERANDA, bacaTeksLokal, simpanTeksLokal } from "@/lib/teks-beranda";

/* ── Grafik portofolio hero, digambar tangan ──────────────────────────────
   Dulu ini <AreaChart> Recharts, dan itu menyeret 115 kB (gzip) ke HALAMAN
   DEPAN — halaman yang paling sering dibuka orang yang belum tentu masuk.

   Yang ditampilkan cuma satu garis mulus tanpa sumbu, tooltip, atau
   interaksi apa pun. Semua yang membuat Recharts layak dipakai tidak
   terpakai di sini. Ini keputusan yang sama dengan chart lilin di halaman
   Chart: pustaka grafik dibayar per kilobyte, bukan per fitur yang dipakai.
   Halaman lain tetap memakai Recharts — di sana tooltip dan legenda memang
   dibutuhkan, dan potongannya dimuat hanya saat halamannya dibuka. */
function GrafikPorto({ nilai }: { nilai: number[] }) {
  const W = 300, H = 80, pad = 4;
  if (nilai.length < 2) return null;
  const min = Math.min(...nilai), max = Math.max(...nilai);
  const rentang = max - min || 1;
  const X = (i: number) => (i / (nilai.length - 1)) * W;
  const Y = (v: number) => pad + (1 - (v - min) / rentang) * (H - pad * 2);

  /* Kurva Catmull-Rom disederhanakan jadi Bezier kubik. Garis lurus antar
     titik terlihat seperti gigi gergaji pada 12 titik di lebar 300 px. */
  const titik = nilai.map((v, i) => [X(i), Y(v)] as const);
  let d = `M${titik[0][0]},${titik[0][1]}`;
  for (let i = 0; i < titik.length - 1; i++) {
    const [x0, y0] = titik[Math.max(0, i - 1)];
    const [x1, y1] = titik[i];
    const [x2, y2] = titik[i + 1];
    const [x3, y3] = titik[Math.min(titik.length - 1, i + 2)];
    d += ` C${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="gradPortoHero" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffcd75" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#ffcd75" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#gradPortoHero)" />
      {/* vectorEffect: tanpa ini garisnya ikut melar saat preserveAspectRatio
          none meregangkan viewBox ke lebar panel. */}
      <path d={d} fill="none" stroke="#ffcd75" strokeWidth={1.8}
            vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import { uang, persen } from "@/lib/utils";

/* ── Ikon koin ─────────────────────────────────────────────────────────────
   Lucide tidak punya logo kripto, dan mengunduh logo asli berarti bergantung
   pada aset pihak lain yang bisa hilang kapan saja (persis yang baru saja
   terjadi pada gambar latar). Jadi dipakai monogram bulat berwarna khas tiap
   koin — terbaca sebagai ikon, tidak pernah gagal dimuat, dan tetap konsisten
   kalau nanti ada koin baru. */
const WARNA_KOIN: Record<string, string> = {
  BTC: "#f7931a", ETH: "#8a92b2", SOL: "#14f195", ADA: "#0033ad",
  XAUT: "#d4af37", BOME: "#e35c2b", SEI: "#9e1f19", LTC: "#a6a9aa",
  AAPL: "#a2aaad", NVDA: "#76b900", XAUUSD: "#d4af37", PEPE: "#4a9c2d",
};

function IkonKoin({ simbol }: { simbol: string }) {
  const nama = simbol.replace("USDT", "").replace("c", "");
  const warna = WARNA_KOIN[nama] ?? "#71717a";
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white ring-1 ring-white/15"
      style={{ background: `linear-gradient(140deg, ${warna}, ${warna}66)` }}
      aria-hidden
    >
      {nama.slice(0, 3)}
    </span>
  );
}

/** "2 bln", "1 thn 3 bln" — sejak transaksi paling lama.
 *
 *  Diukur dari DATA, bukan dari tanggal yang ditulis tangan: transaksi
 *  pertama adalah bukti paling awal bahwa alat ini benar-benar dipakai. */
function lamaPakai(sejak: number) {
  /* Naik bertahap: hari -> minggu -> bulan -> tahun. Satuannya berganti
     tepat saat satuan lama berhenti berarti — "45 hari" masih terbaca, "400
     hari" tidak lagi.

     Tidak pernah mengembalikan tanda hubung. Kalau stempelnya belum ada,
     jawabannya "baru mulai" — itu tetap kalimat yang benar, sementara "—"
     terbaca sebagai sesuatu yang rusak. */
  if (!sejak || !isFinite(sejak)) return 'baru mulai';
  const hari = Math.floor((Date.now() - sejak) / 86_400_000);
  if (hari < 1) return 'hari ini';
  if (hari < 7) return `${hari} hari`;
  if (hari < 30) {
    const mgg = Math.floor(hari / 7);
    return `${mgg} minggu`;
  }
  if (hari < 365) {
    const bulan = Math.floor(hari / 30);
    return `${bulan} bulan`;
  }
  const thn = Math.floor(hari / 365);
  const sisaBulan = Math.floor((hari % 365) / 30);
  return sisaBulan ? `${thn} thn ${sisaBulan} bln` : `${thn} tahun`;
}

/* ── Pulpen bertanda tangan ──────────────────────────────────────────────
   Mengikuti gambar rujukan pemilik: pulpen miring — tutup, badan, mata pena
   runcing, penjepit berbulatan — di atas satu coretan tanda tangan berkait.

   Dua keputusan yang beda dari rujukannya, keduanya karena tempatnya:
   rujukan itu siluet HITAM di atas putih, di sini dibalik jadi terang sebab
   hitam di latar zinc-950 lenyap sama sekali; dan coretannya dibuat keemasan
   supaya pada 20 piksel ia tidak melebur jadi satu gumpalan dengan badan
   penanya — sekaligus itu satu-satunya bagian yang memang pantas memakai
   warna aksen merek.

   Geometrinya dihitung pada satu sumbu miring: tutup, badan, dan mata pena
   berbagi kemiringan yang sama persis, dan penjepitnya menurun sejajar sumbu
   itu. Menggambarnya dengan kira-kira menghasilkan pena yang patah. */
function IkonPena({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 26" className={className} aria-hidden>
      <g fill="#fafafa" stroke="#fafafa" strokeWidth="0.55" strokeLinejoin="round">
        <path d="M18.81 2.13 L22.19 3.87 L19.15 9.76 L15.77 8.02 Z" />
        <path d="M15.37 8.80 L18.75 10.54 L15.79 16.27 L12.41 14.53 Z" />
        <path d="M12.36 15.29 L15.20 16.75 L12.50 18.50 Z" />
      </g>
      <path d="M21.5 2.7 C22.6 2.9 23.3 3.6 23.1 4.4 L21.04 8.30"
            fill="none" stroke="#fafafa" strokeWidth="1.05" strokeLinecap="round" />
      <circle cx="20.81" cy="8.74" r="0.8" fill="#fafafa" />
      <path d="M1.5 22.9 C2.9 20.9 4.4 23.8 5.8 22.9 C6.6 22.3 6.2 18.6 8.0 18.6 C10.0 18.6 9.2 22.3 10.9 23.1 C12.2 23.7 13.1 21.9 14.5 22.4 C15.5 22.8 16.1 23.2 17.2 22.5"
            fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const StatItem = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col items-center justify-center transition-transform hover:-translate-y-1 cursor-default">
    <span className="text-xl font-bold text-white sm:text-2xl">{value}</span>
    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium sm:text-xs">{label}</span>
  </div>
);

/* ── Tiga suasana latar ───────────────────────────────────────────────────
   Desainnya SATU — lorong berkabut dengan gerbang bercahaya — digeser rona
   warnanya jadi tiga suasana: emas hangat, magenta-cyan, terakota-biru.
   Klik di bagian kosong halaman menggilirnya; pilihannya diingat. */
const LATAR = ['hero-bg.webp', 'hero-bg2.webp', 'hero-bg3.webp']
  .map((n) => import.meta.env.BASE_URL + n);

export default function HeroSection() {
  /* Hero memakai angka PAMERAN — jurnal yang memang sengaja dipublikasikan,
     bukan data pengguna yang sedang masuk. Diambil lewat REST API dengan
     `fetch` biasa, bukan SDK: SDK-nya menyeret ±450 kB ke halaman yang
     paling sering dibuka orang yang belum tentu masuk. */
  const nyata = useAngkaPameran();
  const posisi = usePosisiPameran();

  /* Kartu statistik: jurnal showcase ASLI hanya untuk yang sudah masuk.
     Pengunjung tanpa akun mendapat angka ilustrasi berlabel "contoh" —
     jurnal pemilik (termasuk saat minus) bukan konsumsi orang asing di
     halaman jualan. Selama status auth belum diketahui, pengunjunglah
     asumsinya: salah tebak sebentar cuma berarti anggota melihat kartu
     contoh sekejap, bukan orang asing melihat rapor pribadi sekejap. */
  const { pengguna } = useAuth();
  const pameran = pengguna ? nyata : PAMERAN_CONTOH;

  /* ── Teks hero: lokal > terbitan pemilik > bawaan ── */
  const [teks, setTeks] = useState(() => {
    const l = bacaTeksLokal();
    return { judul: l.judul || JUDUL_BERANDA, sub: l.sub || SUB_BERANDA };
  });
  useEffect(() => {
    /* Teks terbitan pemilik dipakai HANYA kalau perangkat ini belum punya
       suntingannya sendiri — bawaan pribadi mengalahkan bawaan situs. */
    const l = bacaTeksLokal();
    if (l.judul || l.sub) return;
    if (pameran.judul || pameran.sub) {
      setTeks({ judul: pameran.judul || JUDUL_BERANDA, sub: pameran.sub || SUB_BERANDA });
    }
  }, [pameran.judul, pameran.sub]);

  const [sunting, setSunting] = useState(false);
  const [draf, setDraf] = useState({ judul: '', sub: '' });

  const [latar, setLatar] = useState(() => {
    try {
      const n = Number(localStorage.getItem('jt.latarBeranda'));
      return n >= 0 && n < LATAR.length ? n : 0;
    } catch { return 0; }
  });
  function gantiLatar() {
    setLatar((l) => {
      const b = (l + 1) % LATAR.length;
      try { localStorage.setItem('jt.latarBeranda', String(b)); } catch { /* privat */ }
      return b;
    });
  }

  const barisJudul = teks.judul.split('\n').map((b) => b.trim()).filter(Boolean);
  const barisEmas = barisJudul.length > 1 ? 1 : -1;
  const potonganSub = teks.sub.split('Jadi Trader Profitable!');

  return (
    <div
      className="relative w-full bg-zinc-950 text-white overflow-hidden font-sans"
      /* Klik di area kosong menggilir latarnya. Tautan, tombol, dan kotak
         sunting dikecualikan — mereka punya pekerjaannya sendiri. */
      onClick={(e) => {
        if (sunting) return;
        if ((e.target as HTMLElement).closest('a,button,input,textarea,select,[data-tanpa-latar]')) return;
        gantiLatar();
      }}
    >
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-fade-in { animation: fadeSlideIn 0.8s ease-out forwards; opacity: 0; }
        .animate-marquee { animation: marquee 40s linear infinite; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
      `}</style>

      {/* Ketiga latar dirender bertumpuk dan cuma opacity-nya yang berganti —
          pergantian gambar jadi pudar-silang halus, bukan kedipan putih
          menunggu unduhan. */}
      {LATAR.map((src, i) => (
        <div key={src} aria-hidden
          className={"pointer-events-none absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-700 " +
            (latar === i ? "opacity-40" : "opacity-0")}
          style={{
            backgroundImage: `url('${src}')`,
            maskImage: "linear-gradient(180deg, transparent, black 0%, black 70%, transparent)",
            WebkitMaskImage: "linear-gradient(180deg, transparent, black 0%, black 70%, transparent)",
          }}
        />
      ))}

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-24 pb-12 sm:px-6 md:pt-32 md:pb-20 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8 items-start">

          {/* --- KOLOM KIRI --- */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-8 pt-8">

            <div className="animate-fade-in delay-100">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md transition-colors hover:bg-white/10">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  Jadi Trader Journey
                  {/* Pena, bukan bintang: judul dan subjudul halaman ini
                      BISA DIUBAH — diklik, disunting di tempat, tersimpan
                      sebagai bawaan perangkat ini. */}
                  <button
                    onClick={() => { setDraf({ judul: teks.judul, sub: teks.sub }); setSunting(true); }}
                    title="Ubah judul & subjudul halaman ini"
                    className="cursor-pointer transition-transform hover:scale-110">
                    <IkonPena className="w-5 h-5" />
                  </button>
                </span>
              </div>
            </div>

            {sunting ? (
              <div className="animate-fade-in space-y-3 max-w-xl" data-tanpa-latar>
                <label className="block">
                  <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                    Judul besar — satu baris per baris tampil; baris kedua bergradasi emas
                  </span>
                  <textarea value={draf.judul} rows={3} spellCheck={false} autoFocus
                    onChange={(e) => setDraf((d) => ({ ...d, judul: e.target.value }))}
                    className="w-full resize-y rounded-xl border border-white/15 bg-white/5 p-4 text-2xl font-medium tracking-tight text-white outline-none backdrop-blur-md focus-visible:border-white/30" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Subjudul</span>
                  <textarea value={draf.sub} rows={3} spellCheck={false}
                    onChange={(e) => setDraf((d) => ({ ...d, sub: e.target.value }))}
                    className="w-full resize-y rounded-xl border border-white/15 bg-white/5 p-4 text-base text-zinc-200 outline-none backdrop-blur-md focus-visible:border-white/30" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const judul = draf.judul.trim() || JUDUL_BERANDA;
                      const sub = draf.sub.trim() || SUB_BERANDA;
                      simpanTeksLokal(judul, sub);
                      setTeks({ judul, sub });
                      setSunting(false);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200">
                    <Check className="w-4 h-4" /> Simpan
                  </button>
                  <button onClick={() => setSunting(false)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm text-white transition-colors hover:bg-white/10">
                    <X className="w-4 h-4" /> Batal
                  </button>
                  <button
                    onClick={() => { simpanTeksLokal('', ''); setTeks({ judul: JUDUL_BERANDA, sub: SUB_BERANDA }); setSunting(false); }}
                    title="Hapus suntingan perangkat ini dan kembali ke teks bawaan"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
                    <RotateCcw className="w-4 h-4" /> Bawaan
                  </button>
                </div>
                <p className="text-[11.5px] leading-relaxed text-zinc-500">
                  Tersimpan sebagai bawaan di perangkat ini. Untuk mengubahnya bagi semua pengunjung,
                  pakai Maintenance → Teks Beranda.
                </p>
              </div>
            ) : (
              <>
                {/* Judul dipecah per baris, dan gradien emas hanya di SATU
                    baris. Kalau seluruh judul diberi gradien, tidak ada lagi
                    yang ditonjolkan — semuanya sama-sama berteriak. */}
                <h1
                  className="animate-fade-in delay-200 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-medium tracking-tighter leading-[0.95]"
                  style={{
                    maskImage: "linear-gradient(180deg, black 0%, black 80%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(180deg, black 0%, black 80%, transparent 100%)"
                  }}
                >
                  {barisJudul.map((b, i) => (
                    <span key={i}>
                      {i === barisEmas
                        ? <span className="bg-gradient-to-br from-white via-white to-[#ffcd75] bg-clip-text text-transparent">{b}</span>
                        : b}
                      {i < barisJudul.length - 1 && <br />}
                    </span>
                  ))}
                </h1>

                <p className="animate-fade-in delay-300 max-w-xl text-lg text-zinc-400 leading-relaxed">
                  {potonganSub.length > 1
                    ? (
                      <>
                        {potonganSub[0]}
                        <span className="text-zinc-200">Jadi Trader Profitable!</span>
                        {potonganSub.slice(1).join('Jadi Trader Profitable!')}
                      </>
                    )
                    : teks.sub}
                </p>
              </>
            )}

            <div className="animate-fade-in delay-400 flex flex-col sm:flex-row gap-4">
              <Link
                to="/dashboard"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-zinc-950 transition-all hover:scale-[1.02] hover:bg-zinc-200 active:scale-[0.98]"
              >
                View Portfolio
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                to="/chart"
                className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10 hover:border-white/20"
              >
                <LineChart className="w-4 h-4" />
                Open Chart
              </Link>
            </div>
          </div>

          {/* --- KOLOM KANAN --- */}
          <div className="lg:col-span-5 space-y-6 lg:mt-12">

            {/* Kartu statistik */}
            <div className="animate-fade-in delay-500 relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                    <Wallet className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    {/* `saldo`, BUKAN titik terakhir kurva.
                        ────────────────────────────────────────────────────
                        Kurva itu saldo berjalan BULAN INI; titik akhirnya
                        bukan total saldo. Karena itu halaman depan sempat
                        menulis $290 sementara Dashboard menulis $808 — dua
                        angka yang keduanya benar untuk pertanyaan berbeda,
                        dan yang ditanyakan di sini adalah total saldonya. */}
                    <div className="angka text-3xl font-bold tracking-tight text-white">
                      {pameran.siap ? uang(pameran.saldo) : '—'}
                    </div>
                    <div className="text-sm text-zinc-400">Total Saldo</div>
                  </div>
                </div>

                {/* Menggantikan bilah "Client Satisfaction": kurva saldo
                    jurnal. Bilah kemajuan cuma bisa bilang "98%"; garis ini
                    bilang ARAH — dan arah itu yang sebenarnya dibeli orang.

                    Kurvanya mengikuti transaksi sungguhan, jadi ia boleh
                    turun. Grafik yang selalu naik ke kanan atas di halaman
                    depan produk trading adalah hal pertama yang membuat
                    pembaca yang paham berhenti percaya. */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">
                      {pameran.contoh ? 'Perkembangan akun · contoh' : 'Perkembangan akun'}
                    </span>
                    {pameran.siap && (
                      <span className={pameran.tumbuh >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                        {pameran.tumbuh >= 0 ? "+" : ""}{pameran.tumbuh.toFixed(1)}%{' '}
                        <span className={pameran.bersih >= 0 ? 'font-normal text-emerald-400/90' : 'font-normal text-red-400/90'}>
                          {uang(pameran.bersih, true)}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="h-20 w-full">
                    <GrafikPorto nilai={pameran.kurva} />
                  </div>
                </div>

                <div className="h-px w-full bg-white/10 mb-6" />

                <div className="grid grid-cols-3 gap-4 text-center">
                  <StatItem value={lamaPakai(pameran.sejak)} label="Dipakai" />
                  <div className="w-px h-full bg-white/10 mx-auto" />
                  <StatItem value={pameran.siap ? persen(pameran.winrate) : '—'} label="Winrate" />
                  <div className="w-px h-full bg-white/10 mx-auto" />
                  <StatItem value={pameran.siap ? pameran.jumlah.toLocaleString('id-ID') : '—'} label="Transaksi" />
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                  {/* Label contoh TAMPIL PERTAMA dan berwarna beda — bukan
                      disembunyikan di sudut. Peraga berlabel jelas adalah
                      tangkapan layar produk; angka tanpa label di halaman
                      jualan terbaca sebagai rekam jejak, dan rekam jejak
                      karangan persis yang dilarang halaman Disclaimer kita
                      sendiri. */}
                  {pameran.contoh && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-medium tracking-wide text-amber-200">
                      CONTOH TAMPILAN
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    ACTIVE
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-300">
                    <Crown className="w-3 h-3 text-yellow-500" />
                    PREMIUM
                  </div>
                </div>
              </div>
            </div>

            {/* Marquee: posisi yang sedang terbuka, bukan logo klien */}
            <div className="animate-fade-in delay-500 relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 py-8 backdrop-blur-xl">
              <h3 className="mb-6 px-8 text-sm font-medium text-zinc-400">
                Posisi Sedang Terbuka
                <span className="ml-2 text-zinc-600">{posisi.length}</span>
              </h3>

              <div
                className="relative flex overflow-hidden"
                style={{
                  maskImage: "linear-gradient(to right, transparent, black 20%, black 80%, transparent)",
                  WebkitMaskImage: "linear-gradient(to right, transparent, black 20%, black 80%, transparent)"
                }}
              >
                <div className="animate-marquee flex gap-10 whitespace-nowrap px-4">
                  {posisi.length === 0 && (
                    <span className="px-4 text-sm text-zinc-600">Tidak ada posisi terbuka saat ini.</span>
                  )}
                  {/* Diulang tiga kali supaya marquee-nya tidak pernah putus.
                      Yang TIDAK ditampilkan: persentase pergerakan. Harga
                      terkini butuh proxy berbayar yang memang tidak terbuka
                      untuk pengunjung yang belum masuk, dan menghitungnya dari
                      harga entry berarti selalu menulis "+0,00%" — angka yang
                      terlihat seperti fakta padahal cuma tanda "tidak tahu". */}
                  {[...posisi, ...posisi, ...posisi].map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5 transition-all hover:scale-105 cursor-default">
                      <IkonKoin simbol={p.simbol} />
                      <span className="text-lg font-bold text-white tracking-tight">
                        {p.simbol.replace("USDT", "")}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        p.arah === "BUY" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}>
                        {p.arah}
                      </span>
                      <span className="text-sm tabular-nums text-zinc-400">{p.tf}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
