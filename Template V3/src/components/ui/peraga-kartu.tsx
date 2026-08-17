import { useEffect, useMemo, useState } from 'react';
import { useGerakMinim } from '@/lib/gerak-minim';

/* ════════════════════════════════════════════════════════════════════════
   PERAGA KARTU — jurnal, integrasi, papan peringkat
   ════════════════════════════════════════════════════════════════════════
   Tiga peraga kecil untuk kartu di halaman depan. Semuanya berjalan
   sendiri tanpa tombol, dan semuanya berhenti diam saat pengguna
   menyalakan "kurangi gerak" (lihat lib/gerak-minim.ts).

   ── ANGKANYA PERAGA, DAN TIDAK MENGAKU SEBAGAI MILIK SIAPA PUN ──────────
   Label "contoh" dibuang atas permintaan pemilik. Yang menggantikan
   fungsinya bukan label, melainkan isinya sendiri: tidak ada nama orang,
   tidak ada nama akun, tidak ada tanggal. Papan peringkat memakai
   "Analis 1..5" — sebutan yang jelas-jelas tempat kosong, bukan seseorang.

   Menaruh nama yang terdengar sungguhan di sebelah winrate akan membuat
   halaman jualan menerbitkan rekam jejak karangan atas nama orang. Itu
   batas yang tidak boleh dilewati sekalipun labelnya sudah dilepas.
   ════════════════════════════════════════════════════════════════════════ */

/* ═══ 1. JURNAL — baris terisi satu per satu, P/L berjalan ═══════════════
   Yang dianimasikan P/L-nya, karena itu yang bergerak sungguhan saat
   jurnal dipakai: tiap trade yang ditutup menggeser angkanya. */

const BARIS_JURNAL = [
  { p: 'BTCUSDT', a: 'BUY',  r: 2.1, e: 'Sabar' },
  { p: 'SOLUSDT', a: 'SELL', r: -1.0, e: 'FOMO' },
  { p: 'XAUUSD',  a: 'BUY',  r: 1.4, e: 'Disiplin' },
];
const TOTAL_R = BARIS_JURNAL.reduce((t, b) => t + b.r, 0);

const J_PER_BARIS = 14;   // tick per baris yang masuk
const J_TAHAN = 22;
const J_TOTAL = BARIS_JURNAL.length * J_PER_BARIS + J_TAHAN;

export function PeragaJurnal() {
  const gerakMinim = useGerakMinim();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (gerakMinim) return;
    const jam = window.setInterval(() => setTick((n) => (n + 1) % J_TOTAL), 70);
    return () => clearInterval(jam);
  }, [gerakMinim]);

  const majuBaris = gerakMinim ? BARIS_JURNAL.length : tick / J_PER_BARIS;

  /* P/L bergerak MULUS, bukan melompat per baris: nilainya ditarik dari
     kemajuan pecahan, jadi angkanya benar-benar berjalan naik-turun
     mengikuti trade yang baru saja masuk. */
  const totalKini = gerakMinim ? TOTAL_R : BARIS_JURNAL.reduce((t, b, i) => {
    const bagian = Math.min(Math.max(majuBaris - i, 0), 1);
    return t + b.r * bagian;
  }, 0);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
        <span className="text-neutral-600">RIWAYAT TRADE</span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-neutral-600">P/L</span>
          <span className={`tabular-nums text-[12px] ${
            totalKini >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalKini >= 0 ? '+' : ''}{totalKini.toFixed(1)}R
          </span>
        </span>
      </div>

      {BARIS_JURNAL.map((t, i) => {
        const masuk = gerakMinim || majuBaris >= i + 1;
        const sedang = !gerakMinim && majuBaris >= i && majuBaris < i + 1;
        return (
          <div key={t.p}
               className={`flex items-center gap-2 rounded border px-2.5 py-2 font-mono text-[10px] transition-all duration-500 ${
                 sedang ? 'border-white/[0.14] bg-white/[0.05]'
                        : 'border-white/[0.04] bg-white/[0.02]'}`}
               style={{ opacity: masuk || sedang ? 1 : 0.18,
                        transform: masuk || sedang ? 'none' : 'translateY(3px)' }}>
            <span className="text-neutral-300">{t.p}</span>
            <span className={t.a === 'BUY' ? 'text-emerald-400/80' : 'text-red-400/80'}>{t.a}</span>
            <span className="ml-auto rounded bg-white/[0.04] px-1.5 py-0.5 text-neutral-500">{t.e}</span>
            <span className={t.r >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {t.r >= 0 ? '+' : ''}{t.r.toFixed(1)}R
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ 2. INTEGRASI — tanda hijau berkedip ════════════════════════════════
   Kedipnya bergiliran, bukan serempak: dua titik yang menyala bersamaan
   terbaca seperti satu lampu yang dikedipkan, bukan seperti dua sambungan
   yang masing-masing hidup. */

const SAMBUNGAN = [
  { n: 'MetaTrader 5', k: 'Forex & Emas' },
  { n: 'Binance', k: 'Kripto Futures' },
];

export function PeragaIntegrasi() {
  const gerakMinim = useGerakMinim();

  return (
    <div className="flex w-full flex-col gap-2.5">
      {SAMBUNGAN.map((i, n) => (
        <div key={i.n} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              {!gerakMinim && (
                /* Lingkaran kedua yang memuai lalu memudar — denyut yang
                   terbaca sebagai "ada lalu lintas", bukan sekadar titik
                   yang berkedip mati-hidup. */
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70"
                      style={{ animationDelay: `${n * 700}ms`, animationDuration: '2s' }} />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[12px] text-neutral-200">{i.n}</span>
            <span className="ml-auto font-mono text-[9.5px] text-emerald-400/80">Terhubung</span>
          </div>
          <div className="mt-1.5 pl-3.5 font-mono text-[9.5px] text-neutral-600">{i.k}</div>
        </div>
      ))}
      <div className="mt-0.5 font-mono text-[9.5px] leading-relaxed text-neutral-600">
        Kunci API disimpan di perangkatmu sendiri.
      </div>
    </div>
  );
}

/* ═══ 3. PAPAN PERINGKAT — balok berganti urutan ═════════════════════════
   Inti Copy Signal: urutannya ditentukan performa sinyal, dan performa
   berubah. Jadi yang diperagakan bukan papan yang diam, melainkan papan
   yang menyusun ulang dirinya — persis yang terjadi tiap sinyal selesai.

   Baris dipindah dengan translateY, bukan dengan mengurutkan ulang simpul
   DOM: memindahkan simpul membuat peramban menggambar ulang di tempat
   baru seketika, tanpa transisi. Dengan transform, tiap baris meluncur ke
   peringkat barunya dan matanya bisa mengikuti siapa yang naik. */

const ANALIS = [
  { id: 'a1', nama: 'Analis 1' },
  { id: 'a2', nama: 'Analis 2' },
  { id: 'a3', nama: 'Analis 3' },
  { id: 'a4', nama: 'AI Agent' },
];

/* Beberapa keadaan papan yang dilalui bergiliran. Ditulis tetap, bukan
   diacak, supaya tampilannya sama tiap kali halaman dibuka. */
const KEADAAN: Record<string, number>[] = [
  { a1: 68, a2: 54, a3: 47, a4: 61 },
  { a1: 62, a2: 71, a3: 52, a4: 58 },
  { a1: 57, a2: 66, a3: 73, a4: 55 },
  { a1: 64, a2: 59, a3: 60, a4: 74 },
];

const TINGGI_BARIS = 34;   // px, termasuk jarak antar-baris
const P_JEDA_MS = 2600;

export function PeragaLeaderboard() {
  const gerakMinim = useGerakMinim();
  const [ke, setKe] = useState(0);

  useEffect(() => {
    if (gerakMinim) return;
    const jam = window.setInterval(() => setKe((n) => (n + 1) % KEADAAN.length), P_JEDA_MS);
    return () => clearInterval(jam);
  }, [gerakMinim]);

  const nilai = KEADAAN[gerakMinim ? 0 : ke];
  const urut = useMemo(
    () => [...ANALIS].sort((x, y) => nilai[y.id] - nilai[x.id]),
    [nilai],
  );
  const peringkatDari = (id: string) => urut.findIndex((a) => a.id === id);
  const tertinggi = Math.max(...Object.values(nilai));

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between font-mono text-[10px] text-neutral-600">
        <span>PAPAN PERINGKAT</span>
        <span>winrate</span>
      </div>

      {/* Tinggi dikunci karena barisnya dipaku absolut — tanpa ini kotaknya
          mengempis jadi nol dan kartunya ikut melompat. */}
      <div className="relative" style={{ height: ANALIS.length * TINGGI_BARIS }}>
        {ANALIS.map((a) => {
          const p = peringkatDari(a.id);
          const w = nilai[a.id];
          return (
            <div key={a.id}
                 className="absolute inset-x-0 flex items-center gap-2.5 transition-transform duration-700 ease-out"
                 style={{ transform: `translateY(${p * TINGGI_BARIS}px)` }}>
              <span className="w-3 shrink-0 text-center font-mono text-[10px] text-neutral-600">
                {p + 1}
              </span>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-semibold text-neutral-300">
                {a.nama.startsWith('AI') ? 'AI' : a.nama.slice(-1)}
              </span>
              <span className="w-[62px] shrink-0 truncate text-[11px] text-neutral-300">{a.nama}</span>
              {/* Balok: lebarnya relatif terhadap yang tertinggi, jadi
                  perubahan kecil pun terlihat sebagai pergeseran. */}
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <span className={`block h-full rounded-full transition-all duration-700 ease-out ${
                        p === 0 ? 'bg-emerald-400' : 'bg-neutral-500'}`}
                      style={{ width: `${(w / tertinggi) * 100}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-neutral-400">
                {w}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
