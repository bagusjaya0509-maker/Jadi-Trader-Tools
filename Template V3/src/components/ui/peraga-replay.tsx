import { useEffect, useMemo, useState } from 'react';
import { useGerakMinim } from '@/lib/gerak-minim';
/* Cuma konstantanya. `koneksi` sendiri ringan — Firebase di dalamnya
   diimpor dinamis, jadi kartu di halaman depan tidak menyeretnya. */
import { PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   PERAGA REPLAY — berjalan sendiri, tanpa tombol
   ════════════════════════════════════════════════════════════════════════
   Kartu ini menjelaskan Chart & Entry, dan gunanya satu: memutar ulang
   harga bar demi bar supaya orang berlatih memutuskan tanpa tahu
   lanjutannya. Gambar diam tidak bisa menyampaikan itu — yang membuatnya
   masuk akal justru bahwa lanjutannya BELUM ada.

   Urutannya meniru cara alatnya betul-betul dipakai, bukan sekadar
   bergerak: garis pemutar menyapu dulu untuk MEMILIH titik mulai, baru
   lilin sesudahnya terbuka satu per satu. Kalau langsung jalan, yang
   tersampaikan cuma "ada animasi", bukan "kamu yang menentukan dari mana".

   ── LILINNYA SEKARANG PASAR SUNGGUHAN ───────────────────────────────────
   Diminta pemilik 21 Sep 2026: "bisa pakai grafik asli ga?" Bisa, dan
   sekarang memang begitu — BTC/USDT 4 jam, ditarik dari proxy pasar yang
   sama dengan yang dipakai aplikasinya.

   Sebelumnya deretnya dibangkitkan dari benih tetap, dan alasannya ditulis
   di sini: halaman ini dibaca orang yang sedang menimbang keputusan uang,
   jadi jangan sampai ada yang terbaca sebagai level pasar. Keberatan itu
   TIDAK hilang, ia dijawab dengan cara lain:

     · tidak ada satu angka harga pun di layar, dan tidak ada sumbu harga —
       yang tampil cuma BENTUK pergerakannya;
     · pasangan dan timeframe-nya disebut terus terang, jadi tidak ada yang
       perlu ditebak tentang apa yang sedang dilihat;
     · yang diputar RIWAYAT yang sudah tertutup, bukan harga berjalan, dan
       kartunya memang menjelaskan fitur replay.

   Gerak lilin palsu di halaman jualan justru yang sulit dipertahankan: ia
   berbentuk pasar tapi bukan pasar, dan tidak ada label yang bisa
   menjelaskan itu tanpa terdengar seperti pengakuan.

   ── KALAU DATANYA TIDAK DATANG ──────────────────────────────────────────
   Deret benih tetap DIPERTAHANKAN sebagai cadangan, bukan dibuang. Kartu
   ini berdiri di halaman depan: proxy yang sedang sibuk, jaringan pengunjung
   yang putus, atau rute yang suatu hari berubah tidak boleh menyisakan kotak
   kosong di tempat pertama orang menilai produknya. Yang hilang saat itu
   cuma "aslinya", bukan kartunya.
   ════════════════════════════════════════════════════════════════════════ */

/* ── KERAPATAN MENGIKUTI LEBAR KARTUNYA ──────────────────────────────
   42 lilin dulu pas untuk kotak selebar 448px. Sesudah kartunya dibiarkan
   memakai lebar penuh dua kolom, jumlah yang sama berarti tiap lilin
   melar jadi ~17px — grafik yang terbaca seperti sedang di-zoom, bukan
   seperti layar yang memang selebar itu.

   64 memberi kerapatan yang sama seperti sebelumnya pada lebar barunya,
   dan kebetulan juga lebih jujur: makin banyak bar yang terlihat sekaligus
   memang alasan orang melebarkan chartnya sendiri. */
const JUMLAH_LILIN = 64;
/** Sampai sini "riwayat" yang sudah terlihat; sisanya yang diputar. */
const MULAI = 30;
const JEDA_TICK = 60;

/* Panjang tiap babak dalam tick. Disetel supaya satu putaran penuh ±9 detik:
   cukup lambat untuk terbaca, cukup pendek untuk tidak membosankan. */
const T_PILIH = 22;                 // garis menyapu memilih titik mulai
/* 3, bukan 4. Lilin yang diputar bertambah dari 24 jadi 34; dengan 4 tick
   per lilin satu putaran jadi ±15 detik — terlalu lama untuk kartu yang
   dilewati orang sambil menggulir. Pada 3 tick ia kembali ke ±9 detik,
   angka yang memang dipilih semula. */
const T_PER_LILIN = 3;              // satu lilin tiap 3 tick
/* +1 bukan tambalan asal: tanpanya lilin TERAKHIR baru terbuka tepat di
   tick pertama babak "tahan", jadi babak putar berakhir sementara satu
   lilin belum tampil. Ketahuan oleh uji-peraga-replay.mjs, bukan oleh
   mata — di layar selisih satu tick memang tidak terlihat. */
const T_PUTAR = (JUMLAH_LILIN - MULAI) * T_PER_LILIN + 1;
const T_TAHAN = 26;                 // berhenti sejenak di ujung
const T_TOTAL = T_PILIH + T_PUTAR + T_TAHAN;

interface Lilin { o: number; h: number; l: number; c: number; }

/** Keadaan peraga pada satu tick. Dipisah dari komponennya supaya bisa
 *  DIUJI: laju animasi mustahil diukur lewat DOM di tab tersembunyi —
 *  Chrome mencekik interval yang sudah lama hidup sampai ±1 tick/menit,
 *  jadi layar yang tampak diam di sana bukan bukti kodenya diam. */
export function keadaanReplay(tick: number, gerakMinim = false) {
  if (gerakMinim) {
    return { memilih: false, sampai: JUMLAH_LILIN, xGaris: L, babak: 'diam' as const };
  }
  const t = ((tick % T_TOTAL) + T_TOTAL) % T_TOTAL;
  const xMulai = MULAI * LEBAR_LILIN;

  if (t < T_PILIH) {
    return { memilih: true, sampai: MULAI, xGaris: (t / T_PILIH) * xMulai, babak: 'pilih' as const };
  }
  const sampai = Math.min(MULAI + Math.floor((t - T_PILIH) / T_PER_LILIN), JUMLAH_LILIN);
  return {
    memilih: false, sampai, xGaris: sampai * LEBAR_LILIN,
    babak: (t < T_PILIH + T_PUTAR ? 'putar' : 'tahan') as 'putar' | 'tahan',
  };
}

function acakBerbenih(benih: number) {
  return () => {
    benih |= 0; benih = (benih + 0x6D2B79F5) | 0;
    let t = Math.imul(benih ^ (benih >>> 15), 1 | benih);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buatDeret(): Lilin[] {
  const acak = acakBerbenih(20260817);
  const keluar: Lilin[] = [];
  let harga = 100;
  for (let i = 0; i < JUMLAH_LILIN; i++) {
    /* Naik dulu lalu terkoreksi di sepertiga akhir: bentuk yang memberi
       sesuatu untuk DIPUTUSKAN, bukan garis lurus yang tidak mengajarkan
       apa pun. */
    const arah = i > JUMLAH_LILIN * 0.66 ? -0.42 : 0.30;
    const o = harga;
    const c = o + (acak() - 0.5) * 2.6 + arah;
    keluar.push({ o, c, h: Math.max(o, c) + acak() * 1.15, l: Math.min(o, c) - acak() * 1.15 });
    harga = c;
  }
  return keluar;
}

/* 640, bukan 300: perbandingan sisi viewBox dibuat mendekati bentuk
   kartunya supaya peregangan mendatarnya tipis. */
const L = 640, T = 128;
const LEBAR_LILIN = L / JUMLAH_LILIN;

const PASANGAN = 'BTCUSDT';
const TF = '4h';

/** Lilin sungguhan dari proxy pasar. Memulangkan `null` untuk SETIAP
 *  kegagalan — jaringan, status, maupun bentuk data yang tidak terduga.
 *  Pemanggilnya cuma perlu tahu "ada atau tidak", dan cadangannya siap. */
async function ambilLilinAsli(): Promise<Lilin[] | null> {
  try {
    const r = await fetch(
      `${PROXY_BAWAAN}/api/klines?symbol=${PASANGAN}&interval=${TF}&limit=${JUMLAH_LILIN}`);
    if (!r.ok) return null;
    const j = await r.json();
    const baris: unknown[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
    if (baris.length < JUMLAH_LILIN) return null;
    const out = baris.slice(-JUMLAH_LILIN).map((b) => {
      const k = b as unknown[];
      return { o: Number(k[1]), h: Number(k[2]), l: Number(k[3]), c: Number(k[4]) };
    });
    /* Satu bar cacat merusak seluruh skala grafiknya — min/max dihitung dari
       semuanya, jadi satu NaN membuat kartunya kosong tanpa galat. Lebih baik
       menolak seluruh kirimannya dan memakai cadangan. */
    return out.every((d) => Number.isFinite(d.o) && Number.isFinite(d.h)
                         && Number.isFinite(d.l) && Number.isFinite(d.c)) ? out : null;
  } catch { return null; }
}

export function PeragaReplay() {
  const cadangan = useMemo(buatDeret, []);
  const [asli, setAsli] = useState<Lilin[] | null>(null);
  const deret = asli ?? cadangan;
  const gerakMinim = useGerakMinim();
  const [tick, setTick] = useState(0);

  /* Cadangan digambar LEBIH DULU, data aslinya menyusul. Menunggu jaringan
     sebelum menggambar apa pun berarti kartu kosong di paruh atas halaman
     depan selama beberapa ratus milidetik — dan kosong di situ terbaca
     sebagai rusak, bukan sebagai sedang memuat.

     Ticknya dikembalikan ke nol saat datanya datang supaya replay-nya mulai
     lagi dari babak "pilih titik mulai". Tanpa itu deretnya bertukar di
     tengah putaran: lilin yang sudah terbuka berganti bentuk sekaligus, dan
     yang terlihat adalah kedipan, bukan pergantian data. */
  useEffect(() => {
    let hidup = true;
    void ambilLilinAsli().then((d) => {
      if (!hidup || !d) return;
      setAsli(d);
      setTick(0);
    });
    return () => { hidup = false; };
  }, []);

  useEffect(() => {
    if (gerakMinim) return;                       // diam: tampilkan keadaan akhir
    const jam = window.setInterval(() => setTick((n) => (n + 1) % T_TOTAL), JEDA_TICK);
    return () => clearInterval(jam);
  }, [gerakMinim]);

  const { atas, bawah } = useMemo(() => {
    const h = Math.max(...deret.map((d) => d.h));
    const l = Math.min(...deret.map((d) => d.l));
    const bantal = (h - l) * 0.08;
    return { atas: h + bantal, bawah: l - bantal };
  }, [deret]);

  const y = (v: number) => T - ((v - bawah) / (atas - bawah)) * T;

  const { memilih, sampai, xGaris } = keadaanReplay(tick, gerakMinim);
  const tampil = deret.slice(0, sampai);
  const terakhir = tampil[tampil.length - 1];

  /* ── BRACKET ENTRY / SL / TP ─────────────────────────────────────────
     Kartunya bernama "Chart & Entry" tapi selama ini cuma memperagakan
     Chart-nya. Bracket inilah bagian Entry — dan ia bukan hiasan yang
     mengisi ruang kosong: ia muncul TEPAT sesudah titik mulai dipilih, lalu
     bertahan diam sementara bar-barnya datang satu per satu.

     Urutan itu yang menjadi seluruh isi kartu ini. Rencananya dipasang
     sebelum lanjutannya diketahui; sesudah itu yang berubah cuma harganya,
     bukan rencananya. Kalimat di kaki kartu mengatakan hal yang sama, dan
     kalimat selalu kalah oleh sesuatu yang bisa dilihat terjadi.

     Levelnya diturunkan dari rentang grafiknya sendiri, bukan angka tetap:
     dengan lilin pasar sungguhan, jarak yang dipatok akan terlihat masuk
     akal hari ini dan konyol bulan depan. Tidak ada satu angka harga pun
     ditulis — yang ditandai posisinya, bukan nilainya. */
  const bracket = useMemo(() => {
    const d = deret[MULAI - 1];
    if (!d) return null;
    const risiko = (atas - bawah) * 0.11;
    return { tp: d.c + risiko * 2, entry: d.c, sl: d.c - risiko };
  }, [deret, atas, bawah]);

  const xMulai = MULAI * LEBAR_LILIN;
  const tampilBracket = !memilih && !!bracket;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-2 font-mono text-[10px] text-neutral-500">
        {/* Pasangannya disebut hanya kalau lilinnya memang miliknya. Saat
            cadangan yang tergambar, menyebut "BTC/USDT" berarti menamai
            grafik dengan nama yang bukan datanya. */}
        <span className="rounded border border-white/[0.08] px-1.5 py-0.5">
          {asli ? 'BTC/USDT · 4 Jam' : '4 Jam'}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${
            gerakMinim ? 'bg-neutral-600' : memilih ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          {gerakMinim ? 'replay' : memilih ? 'pilih titik mulai' : 'memutar'}
        </span>
      </div>

      {/* `relative` menampung label bracket. Labelnya HTML, bukan <text>
          di dalam SVG — dengan preserveAspectRatio="none" seluruh isi SVG
          ikut melar mendatar, dan huruf yang melar terbaca sebagai cacat
          render. Garisnya boleh melar (memang harus), hurufnya tidak. */}
      <div className="relative">
      <svg viewBox={`0 0 ${L} ${T}`} preserveAspectRatio="none" className="h-32 w-full sm:h-36" role="img"
           aria-label="Peraga replay grafik: memilih titik mulai, lalu memutar harga bar demi bar">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={L} y1={T * g} y2={T * g}
                stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}

        {tampil.map((d, i) => {
          const x = i * LEBAR_LILIN + LEBAR_LILIN / 2;
          const warna = d.c >= d.o ? '#34d399' : '#f87171';
          const yo = y(d.o), yc = y(d.c);
          return (
            <g key={i}
               /* Lilin di luar riwayat diredupkan saat babak memilih: yang
                  sedang ditawarkan adalah masa lalu, bukan lanjutannya. */
               opacity={memilih && i >= MULAI ? 0.25 : 1}>
              <line x1={x} x2={x} y1={y(d.h)} y2={y(d.l)} stroke={warna} strokeWidth="1" opacity="0.75" />
              <rect x={x - LEBAR_LILIN * 0.3} width={LEBAR_LILIN * 0.6}
                    y={Math.min(yo, yc)} height={Math.max(Math.abs(yc - yo), 1)} fill={warna} />
            </g>
          );
        })}

        {tampilBracket && bracket && (
          <g>
            {/* Dua bidang tipis: imbalan di atas entry, risiko di bawahnya.
                Perbandingan keduanya terbaca sekali lihat tanpa satu angka
                pun — dan itu memang yang dinilai orang saat memasang
                rencana. */}
            <rect x={xMulai} width={L - xMulai} y={y(bracket.tp)}
                  height={Math.max(y(bracket.entry) - y(bracket.tp), 0)} fill="rgba(52,211,153,0.055)" />
            <rect x={xMulai} width={L - xMulai} y={y(bracket.entry)}
                  height={Math.max(y(bracket.sl) - y(bracket.entry), 0)} fill="rgba(248,113,113,0.055)" />
            {([['tp', '#34d399'], ['entry', 'rgba(255,255,255,0.45)'], ['sl', '#f87171']] as const)
              .map(([kunci, warna]) => (
                <line key={kunci} x1={xMulai} x2={L} y1={y(bracket[kunci])} y2={y(bracket[kunci])}
                      stroke={warna} strokeWidth="1" vectorEffect="non-scaling-stroke"
                      strokeDasharray={kunci === 'entry' ? '4 3' : undefined} />
              ))}
          </g>
        )}

        {terakhir && (
          <line x1="0" x2={L} y1={y(terakhir.c)} y2={y(terakhir.c)} strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                stroke={terakhir.c >= terakhir.o ? '#34d399' : '#f87171'} strokeWidth="1" opacity="0.5" />
        )}

        {/* Garis pemutar. Kuning saat memilih, putih redup saat berjalan. */}
        {!gerakMinim && (
          <line x1={xGaris} x2={xGaris} y1="0" y2={T} strokeWidth="1" vectorEffect="non-scaling-stroke"
                stroke={memilih ? 'rgba(251,191,36,0.85)' : 'rgba(255,255,255,0.25)'} />
        )}
      </svg>

      {tampilBracket && bracket && (
        <>
          {([['TP', bracket.tp, 'text-emerald-400'],
             ['Entry', bracket.entry, 'text-neutral-300'],
             ['SL', bracket.sl, 'text-red-400']] as const).map(([teks, nilai, kelas]) => (
            <span key={teks}
                  className={`pointer-events-none absolute right-0 -translate-y-1/2 bg-[#050505] pl-1.5 font-mono text-[9px] ${kelas}`}
                  style={{ top: y(nilai) }}>
              {teks}
            </span>
          ))}
        </>
      )}
      </div>
    </div>
  );
}
