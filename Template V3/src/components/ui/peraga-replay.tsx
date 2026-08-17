import { useEffect, useMemo, useState } from 'react';
import { useGerakMinim } from '@/lib/gerak-minim';

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

   ── ANGKANYA TIDAK MENGAKU SEBAGAI PASAR MANA PUN ───────────────────────
   Tidak ada nama simbol, tidak ada sumbu harga, tidak ada satu angka harga
   pun di layar — yang tampil hanya bentuk lilin. Jadi tidak ada yang bisa
   dibaca sebagai level pasar sungguhan, dan itu memang syaratnya: halaman
   ini dibaca orang yang sedang menimbang keputusan uang.

   Deretnya dibangkitkan dari BENIH TETAP. Grafik yang berubah tiap muat
   membuat orang mengira ia data langsung — persis kesan yang dihindari.
   ════════════════════════════════════════════════════════════════════════ */

const JUMLAH_LILIN = 42;
/** Sampai sini "riwayat" yang sudah terlihat; sisanya yang diputar. */
const MULAI = 18;
const JEDA_TICK = 60;

/* Panjang tiap babak dalam tick. Disetel supaya satu putaran penuh ±9 detik:
   cukup lambat untuk terbaca, cukup pendek untuk tidak membosankan. */
const T_PILIH = 22;                 // garis menyapu memilih titik mulai
const T_PER_LILIN = 4;              // satu lilin tiap 4 tick
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

const L = 300, T = 128;
const LEBAR_LILIN = L / JUMLAH_LILIN;

export function PeragaReplay() {
  const deret = useMemo(buatDeret, []);
  const gerakMinim = useGerakMinim();
  const [tick, setTick] = useState(0);

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

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-2 font-mono text-[10px] text-neutral-500">
        <span className="rounded border border-white/[0.08] px-1.5 py-0.5">4 Jam</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${
            gerakMinim ? 'bg-neutral-600' : memilih ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          {gerakMinim ? 'replay' : memilih ? 'pilih titik mulai' : 'memutar'}
        </span>
      </div>

      <svg viewBox={`0 0 ${L} ${T}`} className="h-32 w-full" role="img"
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

        {terakhir && (
          <line x1="0" x2={L} y1={y(terakhir.c)} y2={y(terakhir.c)} strokeDasharray="3 3"
                stroke={terakhir.c >= terakhir.o ? '#34d399' : '#f87171'} strokeWidth="1" opacity="0.5" />
        )}

        {/* Garis pemutar. Kuning saat memilih, putih redup saat berjalan. */}
        {!gerakMinim && (
          <line x1={xGaris} x2={xGaris} y1="0" y2={T} strokeWidth="1"
                stroke={memilih ? 'rgba(251,191,36,0.85)' : 'rgba(255,255,255,0.25)'} />
        )}
      </svg>
    </div>
  );
}
