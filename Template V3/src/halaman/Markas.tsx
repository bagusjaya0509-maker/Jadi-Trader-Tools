import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Bot, Code2, Megaphone, Palette, Wallet, TrendingUp, Radar,
  CheckCircle2, CircleDashed, ShieldCheck, Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

/* ════════════════════════════════════════════════════════════════════════
   MARKAS AGEN — kantor AI Jadi Trader
   ════════════════════════════════════════════════════════════════════════
   Halaman TERPISAH dari terminal (rute /markas, tidak ada di sidebar).
   Konsep visual mengikuti rujukan pemilik (SAMS milik axial.studio):
   RUANGAN KANTOR ISOMETRIK 3D dengan robot agen yang berjalan-jalan —
   brankas, papan tulis rencana, dinding kanban, meja kerja, gerbang akses,
   sofa — plus strip keadaan agen di bawahnya.

   Adegannya CSS 3D MURNI: satu bidang lantai di-rotasi isometrik, benda
   berdiri dibangun dari kotak tiga-sisi, dan karakter "billboard" yang
   koordinatnya hidup di lantai tapi wajahnya selalu menghadap kamera —
   nol kilobyte pustaka 3D, dan tetap 60fps karena semuanya transform CSS.

   Yang jujur: hanya ARSITEK yang aktif (sesi Claude ini). Lima lainnya
   SIAP MANUAL — terdaftar sebagai subagent Claude Code di komputer
   pemilik — dan menunggu VPS agen untuk hidup 24 jam.
   ════════════════════════════════════════════════════════════════════════ */

const PEMILIK = 'bagusjaya0509@gmail.com';

interface Agen {
  id: string;
  nama: string;
  peran: string;
  model: string;
  Ikon: typeof Bot;
  warna: string;
  tugas: string[];
  status: 'aktif' | 'menunggu';
}

const AGEN: Agen[] = [
  {
    id: 'arsitek', nama: 'ARSITEK', peran: 'Developer & Keamanan',
    model: 'Fable 5 → Opus', Ikon: Code2, warna: '#f59e0b',
    tugas: [
      'Coding & pengembangan situs',
      'Kelola bug / error web',
      'Protokol keamanan anti-peretasan',
      'Pekerjaan berat & super sulit lainnya',
    ],
    status: 'aktif',
  },
  {
    id: 'penyiar', nama: 'PENYIAR', peran: 'Promosi & Layanan',
    model: 'Sonnet 5', Ikon: Megaphone, warna: '#60a5fa',
    tugas: [
      'Konten promosi situs & akun sosmed',
      'Posting sampai analisa hasilnya',
      'Layanan pelanggan / CS',
    ],
    status: 'menunggu',
  },
  {
    id: 'perupa', nama: 'PERUPA', peran: 'Desainer & Kreator',
    model: 'Sonnet 5 + alat gambar', Ikon: Palette, warna: '#e879f9',
    tugas: [
      'Ide konten & konsep desain',
      'Aset visual: poster, banner, kartu',
      'Konsistensi merek di semua kanal',
    ],
    status: 'menunggu',
  },
  {
    id: 'bendahara', nama: 'BENDAHARA', peran: 'Arus Kas & Bisnis',
    model: 'Sonnet 5', Ikon: Wallet, warna: '#10b981',
    tugas: [
      'Notulensi penjualan & pengeluaran',
      'Analisa pasar untuk bisnisnya',
      'Semua yang berkaitan dengan keuangan usaha',
    ],
    status: 'menunggu',
  },
  {
    id: 'porto', nama: 'PENGELOLA PORTO', peran: 'Divisi Hedge Fund · 1',
    model: 'Opus (keputusan) + Sonnet (pantau)', Ikon: TrendingUp, warna: '#c9a24b',
    tugas: [
      'Kelola data portofolio pengguna',
      'Trading mandiri dari sinyal pilihan pengguna',
      'Hasil otomatis tercatat ke jurnal',
    ],
    status: 'menunggu',
  },
  {
    id: 'sinyal', nama: 'PEMBURU SINYAL', peran: 'Divisi Hedge Fund · 2',
    model: 'Opus (eksekusi) + Sonnet (baca)', Ikon: Radar, warna: '#f87171',
    tugas: [
      'Baca sinyal Discord (mis. ruang Sekolah Trading)',
      'Hitung risiko dalam dolar dari SL/TP & pair',
      'Eksekusi lewat jalur MT5 / Binance yang SUDAH ada',
      'Selalu dengan setelan & persetujuan pengguna dulu',
    ],
    status: 'menunggu',
  },
];

const SUDAH = [
  'Antrean perintah MT5 (buka/ubah/tutup) + EA Trade-Fi Sync v2 — teruji',
  'Jalur order Binance Futures lewat backend VPS — dipakai Area Entry',
  'Jurnal Firestore + sinkron otomatis MT5 & Binance',
  'Chart web membaca data MT5 (OHLC + tick per detik)',
  'Bot Discord komunitas (aplikasi & server sudah berdiri)',
];

const MENUNGGU = [
  'VPS kedua khusus agen — upgrade ke 24 jam nonstop (mode manual sudah bisa duluan)',
  'Pembaca sinyal Discord otomatis (mode manual: lewat Chrome yang sudah login)',
  'Setelan risiko per pengguna untuk trading mandiri',
];

/* ── Bata 3D: kotak tiga sisi di ruang lantai ────────────────────────────
   Sisi yang MENGHADAP kamera setelah rotasi isometrik adalah sisi selatan
   (y = d) dan sisi timur (x = w); sisi lainnya tidak pernah terlihat, jadi
   tidak digambar — separuh biaya, hasil sama. */
function Kotak3D({ x, y, w, d, h, atas, kiri, kanan, radius = 6, anak, isiSelatan }: {
  x: number; y: number; w: number; d: number; h: number;
  atas: string; kiri: string; kanan: string; radius?: number;
  anak?: React.ReactNode;
  /** Isi yang ditempel di sisi selatan (menghadap kiri-bawah layar). */
  isiSelatan?: React.ReactNode;
}) {
  return (
    <div className="absolute" style={{ left: x, top: y, width: w, height: d, transformStyle: 'preserve-3d' }}>
      <div className="absolute inset-0" style={{ background: atas, borderRadius: radius, transform: `translateZ(${h}px)` }} />
      {/* rotateX(+90): sisi NAIK ke +Z — arah minus menenggelamkannya ke
          bawah lantai, dan yang tersisa cuma atap melayang. Wajah yang
          tampil adalah punggung bidangnya, jadi isinya dibalik lagi dengan
          scaleY(-1) supaya terbaca normal. */}
      <div className="absolute" style={{
        left: 0, top: d, width: w, height: h, background: kiri,
        transform: 'rotateX(90deg)', transformOrigin: 'top',
        borderRadius: `${radius}px ${radius}px 0 0`, overflow: 'hidden',
      }}>
        {isiSelatan && <div className="absolute inset-0" style={{ transform: 'scaleY(-1)' }}>{isiSelatan}</div>}
      </div>
      <div className="absolute" style={{
        left: w, top: 0, width: h, height: d, background: kanan,
        transform: 'rotateY(-90deg)', transformOrigin: 'left',
        borderRadius: `${radius}px 0 0 ${radius}px`, overflow: 'hidden',
      }} />
      {anak}
    </div>
  );
}

/* ── Papan billboard: berdiri di titik lantai, wajah selalu ke kamera ── */
function Papan({ x, y, z = 0, children, lebar }: {
  x: number; y: number; z?: number; children: React.ReactNode; lebar?: number;
}) {
  return (
    <div className="absolute" style={{ left: x, top: y, transformStyle: 'preserve-3d' }}>
      <div className="absolute"
        style={{
          left: lebar ? -lebar / 2 : undefined,
          bottom: 0,
          width: lebar,
          transform: `translateZ(${z}px) rotateZ(-45deg) rotateX(-57deg)`,
          transformOrigin: '50% 100%',
        }}>
        {children}
      </div>
    </div>
  );
}

/* ── Robot agen ──────────────────────────────────────────────────────────
   Badan kapsul + visor gelap + dua mata berkedip — bahasa rupa yang sama
   dengan rujukannya. Jalannya menggeser TITIK LANTAI (wrapper), bukan
   billboard-nya, jadi ia benar-benar berjalan di ruangan. */
function Robo({ x, y, warna, nama, jalan, tinggi = 40 }: {
  x: number; y: number; warna: string; nama: string;
  jalan?: string; tinggi?: number;
}) {
  return (
    <div className="absolute" style={{ left: x, top: y, transformStyle: 'preserve-3d' }}>
      <div className={jalan} style={{ transformStyle: 'preserve-3d' }}>
        <div className="absolute rounded-full"
          style={{ left: -14, top: -7, width: 28, height: 14, background: 'rgba(15,17,21,.18)', filter: 'blur(2px)' }} />
        <div className="robo-tegak" title={nama}
          style={{ transform: 'rotateZ(-45deg) rotateX(-57deg)', transformOrigin: '50% 100%', position: 'absolute', left: -15, bottom: 0 }}>
          <div className="robo-goyang" style={{
            width: 30, height: tinggi, borderRadius: 15,
            background: `linear-gradient(160deg, ${warna}, color-mix(in srgb, ${warna} 55%, #1c1e24))`,
            boxShadow: `0 4px 10px rgba(10,12,16,.35), inset 0 2px 3px rgba(255,255,255,.35)`,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', left: 4, top: 6, width: 22, height: 13,
              borderRadius: 7, background: '#101318',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <span className="robo-mata" style={{ width: 4, height: 5, borderRadius: 2, background: '#7dd3fc' }} />
              <span className="robo-mata" style={{ width: 4, height: 5, borderRadius: 2, background: '#7dd3fc' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Label pos kerja — pil putih kecil dengan titik warna, ala rujukan. */
function LabelPos({ x, y, z, titik, teks }: { x: number; y: number; z: number; titik: string; teks: string }) {
  return (
    <Papan x={x} y={y} z={z} lebar={120}>
      <div className="mx-auto flex w-max items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 shadow-lg">
        <span className="size-1.5 rounded-full" style={{ background: titik }} />
        <span className="whitespace-nowrap text-[9px] font-semibold text-zinc-700">{teks}</span>
      </div>
    </Papan>
  );
}

const KEADAAN = [
  { nama: 'Diam', mata: '● ●', warna: '#94a3b8' },
  { nama: 'Riset', mata: '≡ ≡', warna: '#60a5fa' },
  { nama: 'Aktif', mata: '● ●', warna: '#38bdf8' },
  { nama: 'Galat', mata: '✕ ✕', warna: '#f87171' },
  { nama: 'Offline', mata: '— —', warna: '#71717a' },
  { nama: 'Sukses', mata: '⌒ ⌒', warna: '#34d399' },
];

function Kantor3D() {
  return (
    <div className="adegan-bungkus relative mx-auto" aria-hidden>
      <div className="adegan">
        <div className="lantai">
          {/* Panggung lantai — ubin putih dengan tepian menebal. */}
          <Kotak3D x={0} y={0} w={520} d={520} h={16} radius={18}
            atas="repeating-linear-gradient(0deg, #eef0f4 0 51px, #dfe3ea 51px 52px), repeating-linear-gradient(90deg, #eef0f4 0 51px, #dfe3ea 51px 52px), #eef0f4"
            kiri="#c7ccd6" kanan="#b6bcc9" />

            {/* ── Dinding kanban (tepi y=0) — kotak tipis memakai geometri
                yang SUDAH terbukti benar di panggung; papan kanbannya
                menempel di sisi selatan yang menghadap kamera. */}
            <Kotak3D x={0} y={-12} w={520} d={12} h={150} radius={8}
              atas="#eceef3"
              kiri="linear-gradient(180deg, #f7f8fa, #e7eaf0)"
              kanan="#c9ceda"
              isiSelatan={
                <div className="absolute" style={{ left: 214, top: 16, width: 280, height: 118, background: '#ffffff', borderRadius: 8, boxShadow: '0 2px 8px rgba(90,100,120,.25)', padding: 8, display: 'flex', gap: 8 }}>
                  {[['#fca5a5', 3], ['#fcd34d', 2], ['#93c5fd', 3], ['#86efac', 2]].map(([warna, n], k) => (
                    <div key={k} style={{ flex: 1 }}>
                      <div style={{ height: 4, background: '#e2e5ec', borderRadius: 2, marginBottom: 6 }} />
                      {Array.from({ length: n as number }).map((_, i) => (
                        <div key={i} style={{ height: 16, background: `color-mix(in srgb, ${warna} 45%, #fff)`, border: `1px solid ${warna}`, borderRadius: 3, marginBottom: 5 }} />
                      ))}
                    </div>
                  ))}
                </div>
              } />

            {/* ── Dinding papan tulis (tepi x=0) — isinya di sisi timur.
                Sumbu lebar sisi itu berdiri jadi TINGGI dinding, jadi
                papannya digambar dalam bingkai yang diputar. */}
            <Kotak3D x={-12} y={0} w={12} d={520} h={150} radius={8}
              atas="#eceef3"
              kiri="#d3d8e2"
              kanan="linear-gradient(90deg, #f7f8fa, #e4e7ee)"
            />

            {/* Papan tulis BERDIRI BEBAS dekat dinding kiri — seperti
                papan beroda di rujukannya; billboard, jadi isinya selalu
                menghadap kamera dengan orientasi yang benar. */}
            <Papan x={86} y={210} z={0} lebar={124}>
              <div style={{ width: 124 }}>
                <div style={{ width: 124, height: 96, background: '#ffffff', borderRadius: 8, boxShadow: '0 3px 10px rgba(60,70,90,.35)', padding: 8 }}>
                  <div style={{ height: 5, width: '58%', background: '#c9a24b', borderRadius: 3 }} />
                  {[68, 46, 78].map((w, i) => (
                    <div key={i} style={{ height: 3.5, width: `${w}%`, background: '#d4d8e0', borderRadius: 2, marginTop: 6 }} />
                  ))}
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'flex-end', height: 26 }}>
                    {[10, 18, 14, 24, 20].map((h, i) => (
                      <div key={i} style={{ width: 8, height: h, background: i % 2 ? '#10b981' : '#93c5fd', borderRadius: 2 }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 18px' }}>
                  <div style={{ width: 4, height: 18, background: '#9aa2b1' }} />
                  <div style={{ width: 4, height: 18, background: '#9aa2b1' }} />
                </div>
              </div>
            </Papan>

            {/* ── Brankas ── */}
            <Kotak3D x={26} y={26} w={92} d={72} h={96} radius={8}
              atas="linear-gradient(135deg, #d8dce4, #b9bfcb)"
              kiri="linear-gradient(180deg, #aeb5c2, #8f97a7)"
              kanan="linear-gradient(180deg, #9aa2b1, #7d8595)"
              anak={
                <Papan x={46} y={76} z={34} lebar={40}>
                  <div style={{ width: 26, height: 26, margin: '0 auto', borderRadius: 999, border: '4px solid #6b7280', background: '#cfd4dd', boxShadow: 'inset 0 0 0 3px #aab1bd' }} />
                </Papan>
              } />

            {/* ── Meja kerja Arsitek + monitor ── */}
            <Kotak3D x={225} y={250} w={122} d={62} h={30} radius={6}
              atas="linear-gradient(135deg, #cfa176, #b8875c)"
              kiri="#9a6f49" kanan="#8a6240" />
            <Papan x={262} y={268} z={30} lebar={34}>
              <div style={{ width: 34, height: 24, background: '#14171d', borderRadius: 3, border: '2px solid #2a2f38', boxShadow: '0 2px 6px rgba(20,24,30,.4)' }}>
                <div style={{ margin: 3, height: 4, width: 20, background: '#c9a24b', borderRadius: 2 }} />
                <div style={{ margin: 3, height: 3, width: 14, background: '#3f4754', borderRadius: 2 }} />
              </div>
            </Papan>
            <Papan x={305} y={268} z={30} lebar={30}>
              <div style={{ width: 30, height: 22, background: '#14171d', borderRadius: 3, border: '2px solid #2a2f38' }}>
                <div style={{ margin: 3, height: 3, width: 16, background: '#10b981', borderRadius: 2 }} />
                <div style={{ margin: 3, height: 3, width: 10, background: '#3f4754', borderRadius: 2 }} />
              </div>
            </Papan>

            {/* ── Gerbang akses ── */}
            <Kotak3D x={432} y={168} w={20} d={20} h={58} radius={5}
              atas="#d3d7df" kiri="#a9b0bd" kanan="#969eae" />
            <Kotak3D x={432} y={252} w={20} d={20} h={58} radius={5}
              atas="#d3d7df" kiri="#a9b0bd" kanan="#969eae" />
            <Kotak3D x={438} y={192} w={8} d={56} h={46} radius={4}
              atas="rgba(125,211,252,.45)"
              kiri="rgba(125,211,252,.28)"
              kanan="rgba(125,211,252,.2)" />

            {/* ── Sofa lounge ── */}
            <Kotak3D x={58} y={382} w={112} d={52} h={30} radius={10}
              atas="linear-gradient(135deg, #fafbfc, #e8ebf0)"
              kiri="#cdd2db" kanan="#bfc5d0" />
            <Kotak3D x={58} y={370} w={112} d={14} h={52} radius={10}
              atas="#f2f4f7" kiri="#d5dae2" kanan="#c4cad4" />

            {/* ── Tanaman ── */}
            <Kotak3D x={470} y={52} w={26} d={26} h={20} radius={7}
              atas="#c9a24b" kiri="#a8853b" kanan="#96762f" />
            <Papan x={483} y={62} z={20} lebar={36}>
              <div style={{ width: 36, height: 34, margin: '0 auto', background: 'radial-gradient(circle at 40% 35%, #34d399, #059669)', borderRadius: '50% 50% 45% 55%' }} />
            </Papan>

            {/* ── Para robot ── */}
            <Robo x={286} y={330} warna="#f59e0b" nama="ARSITEK — aktif, di meja kerja" />
            <Robo x={112} y={412} warna="#f87171" nama="PEMBURU SINYAL — lounge" tinggi={34} />
            <Robo x={330} y={96} warna="#60a5fa" nama="PENYIAR" jalan="jalan-penyiar" />
            <Robo x={70} y={220} warna="#e879f9" nama="PERUPA" jalan="jalan-perupa" />
            <Robo x={150} y={100} warna="#10b981" nama="BENDAHARA" jalan="jalan-bendahara" />
            <Robo x={390} y={320} warna="#c9a24b" nama="PENGELOLA PORTO" jalan="jalan-porto" />

            {/* ── Label pos ── */}
            <LabelPos x={72} y={62} z={130} titik="#94a3b8" teks="Brankas · Rahasia" />
            <LabelPos x={286} y={280} z={92} titik="#f59e0b" teks="Meja 01 · Arsitek" />
            <LabelPos x={268} y={30} z={116} titik="#60a5fa" teks="Dinding Kanban · Pekerjaan" />
            <LabelPos x={442} y={262} z={96} titik="#34d399" teks="Gerbang Akses" />
            <LabelPos x={112} y={168} z={112} titik="#c9a24b" teks="Papan Tulis · Rencana" />

            {/* ── Kartu pemakaian model ── */}
            <Papan x={492} y={492} z={80} lebar={132}>
              <div className="rounded-lg bg-white/95 p-2 shadow-xl" style={{ width: 132 }}>
                <div className="mb-1 text-[8.5px] font-bold uppercase tracking-wide text-zinc-500">Pemakaian Model</div>
                {[['Fable 5', 72, '#c9a24b'], ['Opus', 44, '#f59e0b'], ['Sonnet 5', 58, '#60a5fa'], ['Haiku 4.5', 20, '#94a3b8']].map(([n, w, c]) => (
                  <div key={n as string} className="mb-1 flex items-center gap-1.5">
                    <span className="w-[42px] text-[8px] text-zinc-600">{n}</span>
                    <span className="h-[5px] grow rounded-full bg-zinc-200">
                      <span className="block h-full rounded-full" style={{ width: `${w}%`, background: c as string }} />
                    </span>
                  </div>
                ))}
              </div>
            </Papan>
        </div>
      </div>
    </div>
  );
}

export default function Markas() {
  const { pengguna } = useAuth();
  const [pilih, setPilih] = useState<string | null>(null);
  const pemilik = pengguna?.email === PEMILIK;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <style>{`
        @keyframes markasMasuk {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .markas-kartu { animation: markasMasuk .5s ease-out both; }

        .adegan-bungkus { height: 430px; width: 100%; max-width: 780px; overflow: visible; }
        .adegan { perspective: 1500px; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .lantai {
          position: relative; width: 520px; height: 520px;
          transform: rotateX(57deg) rotateZ(45deg);
          transform-style: preserve-3d;
        }
        @media (max-width: 860px) { .adegan { transform: scale(.72); } .adegan-bungkus { height: 330px; } }
        @media (max-width: 560px) { .adegan { transform: scale(.52); } .adegan-bungkus { height: 250px; } }

        .robo-goyang { animation: roboGoyang 1.6s ease-in-out infinite; transform-origin: 50% 100%; }
        @keyframes roboGoyang {
          0%, 100% { transform: rotate(-3deg) translateY(0); }
          50% { transform: rotate(3deg) translateY(-2px); }
        }
        .robo-mata { animation: roboKedip 4.2s infinite; }
        @keyframes roboKedip {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(.12); }
        }

        /* Rute jalan tiap agen — menggeser titik LANTAI-nya, dan mereka
           berhenti sejenak di tiap pos seperti orang sungguhan. */
        .jalan-penyiar { animation: jalanPenyiar 16s ease-in-out infinite; }
        @keyframes jalanPenyiar {
          0%, 12% { transform: translate(0, 0); }
          38%, 55% { transform: translate(-40px, 170px); }
          82%, 100% { transform: translate(0, 0); }
        }
        .jalan-perupa { animation: jalanPerupa 13s ease-in-out infinite; }
        @keyframes jalanPerupa {
          0%, 15% { transform: translate(0, 0); }
          45%, 60% { transform: translate(60px, 90px); }
          90%, 100% { transform: translate(0, 0); }
        }
        .jalan-bendahara { animation: jalanBendahara 18s ease-in-out infinite; }
        @keyframes jalanBendahara {
          0%, 10% { transform: translate(0, 0); }
          35%, 48% { transform: translate(80px, 140px); }
          70%, 80% { transform: translate(-30px, 60px); }
          95%, 100% { transform: translate(0, 0); }
        }
        .jalan-porto { animation: jalanPorto 14s ease-in-out infinite; }
        @keyframes jalanPorto {
          0%, 14% { transform: translate(0, 0); }
          42%, 58% { transform: translate(40px, -90px); }
          86%, 100% { transform: translate(0, 0); }
        }
      `}</style>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100">
            <ArrowLeft className="size-3.5" /> Beranda
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Markas Agen <span className="text-amber-400">·</span> Jadi Trader
            </h1>
            <p className="text-[12px] text-zinc-500">
              Kantor AI yang membesarkan situs ini — terpisah dari terminal, karena isinya urusan dapur.
            </p>
          </div>
          <span className={cn('ml-auto rounded-full border px-3 py-1 text-[11px]',
            pemilik ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300')}>
            {pemilik ? 'Pemilik — akses penuh' : 'Mode lihat — kendali khusus pemilik'}
          </span>
        </div>

        {/* ── RUANGAN KANTOR 3D ── */}
        <div className="markas-kartu overflow-hidden rounded-3xl border border-zinc-800/80 bg-gradient-to-b from-[#11141a] via-[#0d1015] to-zinc-950 pb-2 pt-6">
          <Kantor3D />
          {/* Strip keadaan agen — bahasa rupa yang sama dengan rujukan. */}
          <div className="mx-auto mt-2 flex max-w-xl flex-wrap items-center justify-center gap-3 px-4 pb-4">
            {KEADAAN.map((k) => (
              <div key={k.nama} className="flex flex-col items-center gap-1">
                <span className="flex h-8 w-11 items-center justify-center rounded-xl bg-[#101318] text-[10px] font-bold tracking-tight ring-1 ring-white/10"
                      style={{ color: k.warna }}>
                  {k.mata}
                </span>
                <span className="text-[9.5px] text-zinc-500">{k.nama}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Meja para agen ── */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGEN.map((a, i) => {
            const buka = pilih === a.id;
            return (
              <button key={a.id} onClick={() => setPilih(buka ? null : a.id)}
                className="markas-kartu group cursor-pointer rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 text-left backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-zinc-700"
                style={{ animationDelay: `${i * 70}ms` }}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl ring-1 ring-white/10"
                        style={{ background: `linear-gradient(140deg, ${a.warna}33, ${a.warna}11)` }}>
                    <a.Ikon className="size-5" style={{ color: a.warna }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold tracking-wide">{a.nama}</span>
                    <span className="block truncate text-[11px] text-zinc-500">{a.peran}</span>
                  </span>
                </div>
                <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-300">{a.model}</span>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium',
                    a.status === 'aktif' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/10 text-amber-300/90')}>
                    {a.status === 'aktif' ? 'AKTIF — sesi ini' : 'SIAP MANUAL · Claude Code'}
                  </span>
                </div>
                <ul className={cn('space-y-1 text-[11.5px] leading-relaxed text-zinc-400',
                  !buka && 'line-clamp-2')}>
                  {a.tugas.map((t) => <li key={t}>· {t}</li>)}
                </ul>
                {!buka && a.tugas.length > 2 && (
                  <span className="mt-1 block text-[10.5px] text-zinc-600 group-hover:text-zinc-500">klik untuk rincian…</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Cetak biru sambungan ── */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-zinc-200">
              <CheckCircle2 className="size-4 text-emerald-500" /> Fondasi yang SUDAH terpasang
            </div>
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-zinc-400">
              {SUDAH.map((s) => <li key={s} className="flex gap-2"><span className="text-emerald-500">✓</span>{s}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-zinc-200">
              <CircleDashed className="size-4 text-amber-400" /> Yang menunggu keputusanmu
            </div>
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-zinc-400">
              {MENUNGGU.map((s) => <li key={s} className="flex gap-2"><span className="text-amber-400">○</span>{s}</li>)}
            </ul>
          </div>
        </div>

        {/* ── Aturan rumah ── */}
        <div className="mt-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-zinc-200">
            <ShieldCheck className="size-4 text-zinc-400" /> Aturan rumah — tidak bisa ditawar
          </div>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12px] leading-relaxed text-zinc-400 sm:grid-cols-2">
            <li>· Agen TIDAK PERNAH mengeksekusi uang tanpa setelan & persetujuan pengguna.</li>
            <li>· Setiap eksekusi tercatat di jurnal — tidak ada trade tanpa jejak.</li>
            <li>· Kunci API & kredensial hidup di VPS, tidak pernah di halaman web.</li>
            <li>· Pagar risiko berlapis: batas lot di EA DAN di server, perintah basi kedaluwarsa.</li>
          </ul>
        </div>

        {/* ── Mode manual — cara memanggil agen HARI INI ── */}
        <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-5">
          <div className="mb-2 text-[13px] font-medium text-amber-300">
            Mode manual — jalan sekarang, tanpa VPS
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-zinc-400">
            Kelima agen sudah TERDAFTAR sebagai subagent Claude Code di komputer pemilik
            (<span className="font-mono text-zinc-500">~/.claude/agents/</span>). Buka Claude Code, lalu panggil
            dengan menyebut namanya:
          </p>
          <ul className="space-y-1.5 font-mono text-[11.5px] leading-relaxed text-zinc-300">
            <li>· "pakai subagent <span className="text-amber-300">penyiar</span>: buat 3 ide konten promosi minggu ini"</li>
            <li>· "pakai subagent <span className="text-amber-300">perupa</span>: rancang banner produk SMI"</li>
            <li>· "pakai subagent <span className="text-amber-300">bendahara</span>: rekap penjualan lisensi Agustus"</li>
            <li>· "pakai subagent <span className="text-amber-300">pengelola-porto</span>: evaluasi jurnal bulan ini"</li>
            <li>· "pakai subagent <span className="text-amber-300">pemburu-sinyal</span>: proses sinyal terbaru di Discord"</li>
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-500">
            Batasnya jujur: hidup hanya selama komputer & sesinya terbuka, memakai jatah langganan
            yang sama (agen berat mempercepat habisnya), dan eksekusi uang selalu berhenti menunggu
            persetujuanmu — di mode mana pun.
          </p>
        </div>

        <p className="mt-6 flex items-center gap-2 text-[11.5px] text-zinc-600">
          <Server className="size-3.5" />
          Begitu VPS agen tersedia, halaman ini berubah dari cetak biru menjadi ruang kendali 24 jam:
          status hidup tiap agen, log pekerjaannya, dan tombol jeda per meja.
        </p>
      </div>
    </div>
  );
}
