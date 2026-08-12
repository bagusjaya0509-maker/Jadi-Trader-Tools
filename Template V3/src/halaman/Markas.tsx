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
   Halaman TERPISAH dari terminal (rute /markas, tidak ada di sidebar):
   pusat kendali pasukan agen AI yang kelak berjalan 24 jam di VPS agen.
   Konsep visualnya kantor isometrik — tiap agen punya mejanya sendiri —
   mengikuti rujukan gaya "office agent 3D" milik pemilik.

   YANG JUJUR HARUS DIKATAKAN: halaman ini adalah CETAK BIRU + pusat
   kendali. Satu-satunya agen yang benar-benar bekerja hari ini adalah
   ARSITEK (sesi Claude yang membangun situs ini). Sisanya menunggu dua
   hal yang memang keputusan pemilik: VPS kedua untuk menjalankan agen
   24 jam, dan langganan yang menanggung model-modelnya. Meja yang
   digambar sebelum orangnya duduk bukan kebohongan selama papan namanya
   ditulis "menunggu" — dan di sini semuanya ditulis.
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

/* Jalur teknis: apa yang SUDAH terpasang hari ini vs yang menunggu. */
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
      `}</style>

      {/* Lantai kantor: kisi perspektif — isyarat "ruangan", bukan dekorasi
          berat. WebGL sungguhan menunggu versi berikutnya; kisi CSS ini
          nol kilobyte pustaka. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 h-[46vh] opacity-[.22]"
        style={{
          backgroundImage: 'linear-gradient(rgba(201,162,75,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,75,.35) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          transform: 'perspective(420px) rotateX(58deg)',
          transformOrigin: 'bottom',
          maskImage: 'linear-gradient(180deg, transparent, black 45%)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent, black 45%)',
        }} />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center gap-3">
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

        {/* ── Meja para agen ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
