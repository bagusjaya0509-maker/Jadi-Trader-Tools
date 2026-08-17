import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════════
   PERAGA REPLAY — lilin yang benar-benar bisa dimainkan pengunjung
   ════════════════════════════════════════════════════════════════════════
   Kartu ini menjelaskan Chart & Entry, dan Chart & Entry gunanya satu:
   memutar ulang pergerakan harga bar demi bar supaya orang berlatih
   memutuskan tanpa tahu lanjutannya. Gambar diam tidak bisa menyampaikan
   itu — yang membuatnya masuk akal justru bahwa lanjutannya BELUM ada.
   Jadi peraganya dibuat betul-betul jalan, bukan tangkapan layar.

   ── ANGKANYA TIDAK BOLEH TERBACA SEBAGAI HARGA SUNGGUHAN ────────────────
   Ini halaman jualan, dan menaruh "BTCUSDT 64.150" di sini berarti
   menerbitkan level pasar karangan di tempat orang mengambil keputusan
   uang. Karena itu deretnya dibangkitkan dari benih tetap, sumbu harganya
   tidak diberi angka, dan simbolnya ditulis "CONTOH" — bukan nama pasar
   mana pun. Yang diperagakan cara alatnya bekerja, bukan suatu pasar.

   ── KENAPA BENIH TETAP, BUKAN Math.random ───────────────────────────────
   Bentuk grafiknya sama setiap kali halaman dibuka. Grafik yang berubah
   tiap muat membuat orang mengira ia data langsung — persis kesan yang
   sedang dihindari — dan membuat tampilannya mustahil diperiksa ulang.
   ════════════════════════════════════════════════════════════════════════ */

const JUMLAH_LILIN = 42;
/** Jeda antar-lilin saat diputar. 260 ms cukup pelan untuk terbaca sebagai
 *  "harga sedang berjalan", cukup cepat untuk selesai sebelum orang bosan. */
const JEDA_MS = 260;

interface Lilin { o: number; h: number; l: number; c: number; }

/** Acak berbenih (mulberry32). Dipakai supaya deretnya selalu sama. */
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
    /* Sedikit condong naik lalu terkoreksi di sepertiga akhir: bentuk yang
       memberi sesuatu untuk DIPUTUSKAN, bukan garis lurus yang tidak
       mengajarkan apa pun. */
    const arah = i > JUMLAH_LILIN * 0.66 ? -0.42 : 0.30;
    const o = harga;
    const langkah = (acak() - 0.5) * 2.6 + arah;
    const c = o + langkah;
    const h = Math.max(o, c) + acak() * 1.15;
    const l = Math.min(o, c) - acak() * 1.15;
    keluar.push({ o, h, l, c });
    harga = c;
  }
  return keluar;
}

export function PeragaReplay() {
  const deret = useMemo(buatDeret, []);
  /* Mulai dari sepertiga: kartu yang terbuka dengan bidang kosong terbaca
     sebagai gagal memuat, bukan sebagai undangan menekan Putar. */
  const AWAL = Math.floor(JUMLAH_LILIN / 3);
  const [sampai, setSampai] = useState(AWAL);
  const [jalan, setJalan] = useState(false);
  const jam = useRef<number | null>(null);

  const hentikan = useCallback(() => {
    if (jam.current !== null) { clearInterval(jam.current); jam.current = null; }
  }, []);

  useEffect(() => {
    if (!jalan) { hentikan(); return; }
    /* Updater-nya WAJIB murni — tidak boleh memanggil setJalan di dalam
       sini. React boleh menjalankan updater lebih dari sekali untuk satu
       pembaruan (StrictMode melakukannya secara sengaja), dan efek samping
       di dalamnya akan ikut berjalan berkali-kali. Berhentinya diurus
       efek terpisah di bawah, yang memang tempatnya. */
    jam.current = window.setInterval(() => {
      setSampai((n) => Math.min(n + 1, JUMLAH_LILIN));
    }, JEDA_MS);
    return hentikan;
  }, [jalan, hentikan]);

  /* Berhenti sendiri di lilin terakhir. */
  useEffect(() => {
    if (sampai >= JUMLAH_LILIN) setJalan(false);
  }, [sampai]);

  const selesai = sampai >= JUMLAH_LILIN;
  const tampil = deret.slice(0, sampai);

  /* Skala dikunci ke SELURUH deret, bukan ke lilin yang sudah tampil.
     Kalau ikut yang tampil, sumbunya melompat tiap bar baru dan seluruh
     grafik bergoyang — terbaca rusak, bukan berjalan. */
  const { atas, bawah } = useMemo(() => {
    const h = Math.max(...deret.map((d) => d.h));
    const l = Math.min(...deret.map((d) => d.l));
    const bantal = (h - l) * 0.08;
    return { atas: h + bantal, bawah: l - bantal };
  }, [deret]);

  const L = 300, T = 128, lebarLilin = L / JUMLAH_LILIN;
  const y = (v: number) => T - ((v - bawah) / (atas - bawah)) * T;

  const terakhir = tampil[tampil.length - 1];
  const naik = terakhir ? terakhir.c >= terakhir.o : true;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Bilah atas meniru Chart & Entry: simbol, timeframe, lalu Replay. */}
      <div className="flex items-center gap-2 font-mono text-[10px] text-neutral-500">
        <span className="rounded border border-white/[0.08] px-1.5 py-0.5 text-neutral-300">CONTOH</span>
        <span className="rounded border border-white/[0.08] px-1.5 py-0.5">4 Jam</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${jalan ? 'animate-pulse bg-emerald-400' : 'bg-neutral-600'}`} />
          {selesai ? 'replay selesai' : jalan ? 'memutar' : 'siap diputar'}
        </span>
      </div>

      <svg viewBox={`0 0 ${L} ${T}`} className="h-32 w-full" role="img"
           aria-label={`Peraga replay grafik, ${sampai} dari ${JUMLAH_LILIN} lilin ditampilkan`}>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={L} y1={T * g} y2={T * g} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        {tampil.map((d, i) => {
          const x = i * lebarLilin + lebarLilin / 2;
          const hijau = d.c >= d.o;
          const warna = hijau ? '#34d399' : '#f87171';
          const yo = y(d.o), yc = y(d.c);
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(d.h)} y2={y(d.l)} stroke={warna} strokeWidth="1" opacity="0.75" />
              <rect x={x - lebarLilin * 0.3} width={lebarLilin * 0.6}
                    y={Math.min(yo, yc)} height={Math.max(Math.abs(yc - yo), 1)}
                    fill={warna} />
            </g>
          );
        })}
        {/* Garis harga berjalan — penanda "sampai di sini yang kamu tahu". */}
        {terakhir && (
          <line x1="0" x2={L} y1={y(terakhir.c)} y2={y(terakhir.c)} strokeDasharray="3 3"
                stroke={naik ? '#34d399' : '#f87171'} strokeWidth="1" opacity="0.5" />
        )}
      </svg>

      <div className="flex items-center gap-2">
        <button
          onClick={() => { if (selesai) { setSampai(AWAL); setJalan(true); } else setJalan((v) => !v); }}
          className="flex cursor-pointer items-center gap-1.5 rounded border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white transition-colors hover:border-white/25"
        >
          {selesai ? <><RotateCcw className="h-3 w-3" /> Putar lagi</>
            : jalan ? <><Pause className="h-3 w-3" /> Jeda</>
            : <><Play className="h-3 w-3" /> Putar</>}
        </button>
        <button
          onClick={() => { setJalan(false); setSampai(AWAL); }}
          className="flex cursor-pointer items-center gap-1.5 rounded border border-white/[0.08] px-2.5 py-1 text-[11px] text-neutral-400 transition-colors hover:border-white/20 hover:text-white"
        >
          <RotateCcw className="h-3 w-3" /> Ulang
        </button>
        <span className="ml-auto font-mono text-[10px] text-neutral-600">
          {sampai}/{JUMLAH_LILIN} bar
        </span>
      </div>
    </div>
  );
}
