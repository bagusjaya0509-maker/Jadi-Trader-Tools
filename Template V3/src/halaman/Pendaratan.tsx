import { Link } from 'react-router-dom';
import {
  ArrowRight, LineChart, Radar, NotebookPen, Code2, Bot, Plug,
  ShieldCheck, MoveVertical, Wallet,
} from 'lucide-react';
import { HeroWithMockup } from '@/components/blocks/hero-with-mockup';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   PENDARATAN — halaman pertama untuk orang yang belum masuk
   ════════════════════════════════════════════════════════════════════════
   Halaman depan sebelumnya (hero glassmorphism) langsung menawarkan "View
   Portfolio" dan "Open Chart" — dua tombol yang cuma masuk akal bagi orang
   yang SUDAH tahu situs ini apa. Orang yang baru mendarat belum tahu, dan
   tidak ada satu kalimat pun di layar pertama yang memberitahunya.

   Halaman ini tugasnya satu: menjelaskan alatnya cukup jelas sampai orang
   tahu apakah ini untuk dia. Bukan daftar fitur — daftar fitur menjawab
   "ada apa saja", sementara yang ditanyakan pengunjung adalah "apa yang
   berubah kalau saya pakai".
   ════════════════════════════════════════════════════════════════════════ */

/* ── Peraga terminal ─────────────────────────────────────────────────────
   Antarmuka sungguhan, bukan tangkapan layar.

   Tangkapan layar dashboard yang asli akan membawa saldo dan posisi
   pemiliknya ikut tayang di halaman publik — dan ikut memamerkan P/L
   berjalan yang kebetulan sedang merah. Angka di bawah ini contoh netral:
   yang dijual halaman ini kemampuan alatnya, bukan hasil trading siapa pun.
   Tidak ada janji hasil di sini, dan itu disengaja. */
function PeragaTerminal() {
  const posisi = [
    { pair: 'BTCUSDT', arah: 'BUY', size: '0,002', entry: '63.572,30', gerak: '+0,42%', naik: true },
    { pair: 'XAUUSD', arah: 'BUY', size: '0,05 lot', entry: '1.928,02', gerak: '+0,18%', naik: true },
    { pair: 'THETAUSDT', arah: 'SELL', size: '298', entry: '0,1341', gerak: '−0,26%', naik: false },
  ];
  return (
    <div className="flex w-full min-w-0 bg-zinc-950 text-left">
      {/* Bilah samping */}
      <div className="hidden w-[168px] shrink-0 flex-col gap-1 border-r border-zinc-900 p-3 sm:flex">
        <div className="mb-3 px-2 text-[11px] font-semibold tracking-tight text-zinc-300">
          Jadi Trader <span className="text-zinc-500">Tools</span>
        </div>
        {[
          ['Dashboard', false], ['Screener Area', false], ['Journal', false],
          ['Chart dan Entry', true], ['Marketplace', false], ['Integrations', false],
        ].map(([nama, aktif]) => (
          <div
            key={nama as string}
            className={cn(
              'rounded-md px-2 py-1.5 text-[11px]',
              aktif ? 'bg-zinc-800/70 text-zinc-100' : 'text-zinc-500',
            )}
          >
            {nama as string}
          </div>
        ))}
      </div>

      {/* Isi */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Posisi terbuka', '3'],
            ['Order menunggu', '2'],
            ['Pair dipantau', '24'],
            ['Broker tersambung', 'Binance · MT5'],
          ].map(([label, nilai]) => (
            <div key={label} className="rounded-lg border border-zinc-900 bg-zinc-900/40 p-2.5">
              <div className="text-[9.5px] uppercase tracking-wide text-zinc-600">{label}</div>
              <div className="angka mt-0.5 text-[13px] font-medium text-zinc-200">{nilai}</div>
            </div>
          ))}
        </div>

        {/* Chart dengan garis order */}
        <div className="relative overflow-hidden rounded-lg border border-zinc-900 bg-zinc-900/30 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10.5px] text-zinc-500">
            <span className="text-zinc-300">BTCUSDT</span>
            <span>· 4 Jam</span>
            <span className="ml-auto rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9.5px] text-zinc-400">
              klik garis untuk ubah
            </span>
          </div>
          <svg viewBox="0 0 420 120" className="h-[110px] w-full" preserveAspectRatio="none">
            {/* Lilin */}
            {Array.from({ length: 34 }).map((_, i) => {
              const naik = [0, 2, 3, 6, 7, 9, 12, 13, 16, 18, 19, 22, 25, 26, 29, 31, 32].includes(i);
              const x = 8 + i * 12;
              const tinggi = 14 + ((i * 37) % 34);
              const y = 30 + ((i * 23) % 46);
              return (
                <g key={i} stroke={naik ? '#10b981' : '#f87171'} fill={naik ? '#10b981' : '#f87171'}>
                  <line x1={x + 3} x2={x + 3} y1={y - 6} y2={y + tinggi + 6} strokeWidth="1" />
                  <rect x={x} y={y} width="6" height={tinggi} />
                </g>
              );
            })}
            {/* Garis TP / Entry / SL */}
            <line x1="0" x2="420" y1="24" y2="24" stroke="#10b981" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="0" x2="420" y1="62" y2="62" stroke="#d4d4d8" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="0" x2="420" y1="102" y2="102" stroke="#f87171" strokeWidth="1" strokeDasharray="4 3" />
          </svg>
          <div className="pointer-events-none absolute right-3 top-[42px] flex flex-col gap-[19px] text-[9px]">
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400">TP 64.482</span>
            <span className="rounded bg-zinc-100/10 px-1.5 py-0.5 text-zinc-300">Entry 63.572</span>
            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-400">SL 63.215</span>
          </div>
        </div>

        {/* Posisi terbuka */}
        <div className="rounded-lg border border-zinc-900 bg-zinc-900/30 p-3">
          <div className="mb-2 text-[10.5px] text-zinc-400">Posisi Terbuka</div>
          <div className="flex flex-col gap-1.5">
            {posisi.map((p) => (
              <div key={p.pair} className="flex items-center gap-2 text-[10.5px]">
                <span className="w-[74px] shrink-0 truncate text-zinc-300">{p.pair}</span>
                <span className={cn('w-8 shrink-0', p.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                  {p.arah}
                </span>
                <span className="angka hidden w-16 shrink-0 text-zinc-500 sm:block">{p.size}</span>
                <span className="angka w-20 shrink-0 text-zinc-500">{p.entry}</span>
                <span className={cn('angka ml-auto', p.naik ? 'text-emerald-500' : 'text-red-400')}>
                  {p.gerak}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Kartu alat ──────────────────────────────────────────────────────── */
function Alat({ ikon: Ikon, judul, kalimat, poin, gratis }: {
  ikon: typeof LineChart;
  judul: string;
  kalimat: string;
  poin: string[];
  gratis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-900 bg-zinc-900/30 p-6 transition-colors hover:border-zinc-800">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-[#ffcd75]/10 text-[#ffcd75]">
          <Ikon className="size-4" />
        </span>
        <h3 className="text-[15px] font-semibold text-zinc-100">{judul}</h3>
        {gratis && (
          <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-400">
            Gratis
          </span>
        )}
      </div>
      <p className="text-[13.5px] leading-relaxed text-zinc-400">{kalimat}</p>
      <ul className="flex flex-col gap-1.5">
        {poin.map((p) => (
          <li key={p} className="flex gap-2 text-[12.5px] leading-relaxed text-zinc-500">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-[#ffcd75]/60" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Pendaratan() {
  return (
    <div className="min-h-screen w-full overflow-y-auto bg-zinc-950">
      <HeroWithMockup
        title="Analisa, kirim order, dan catat alasannya di satu layar"
        description="Jadi Trader Tools menyatukan chart, screener, jurnal, dan eksekusi ke Binance Futures serta MetaTrader 5. Tidak perlu pindah aplikasi untuk mengubah stop loss — klik garisnya di chart, geser, kirim."
        primaryCta={{
          text: 'Mulai dari jurnal — gratis',
          href: '#/jurnal',
          icon: <NotebookPen className="mr-2 size-4" />,
        }}
        secondaryCta={{
          text: 'Lihat paket & harga',
          href: 'https://lynk.id/jaditrader_payment',
          icon: <Wallet className="mr-2 size-4" />,
        }}
      >
        <PeragaTerminal />
      </HeroWithMockup>

      {/* ── Masalah yang dijawab ──────────────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-4 py-16 md:py-24">
        <div className="mx-auto max-w-[760px] text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl md:text-4xl">
            Trading itu satu keputusan. Alatnya yang terpisah-pisah.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
            Chart di satu aplikasi, order di aplikasi broker, catatan di spreadsheet, sinyal di
            grup chat. Tiap pindah tempat adalah kesempatan untuk lupa — lupa memasang stop,
            lupa alasan masuk, lupa bahwa setup ini sudah tiga kali gagal.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Alat
            ikon={NotebookPen}
            judul="Jurnal"
            gratis
            kalimat="Tempat kamu mengetahui kebiasaanmu sendiri. Gratis selamanya, karena baru terasa gunanya setelah 30 hari diisi."
            poin={[
              'Emosi per posisi, lalu Pola Emosi memperlihatkan mana yang paling sering muncul di trade rugi',
              'Kalender: hari apa kamu paling sering salah',
              'Terisi sendiri dari Binance dan MT5 — tidak mengetik ulang',
            ]}
          />
          <Alat
            ikon={LineChart}
            judul="Chart dan Entry"
            kalimat="Chart yang bisa mengeksekusi. Order sungguhan berangkat dari sini, bukan dari tab lain."
            poin={[
              'Klik nama pair → entry, SL, TP-nya tergambar di chart',
              'Seret garisnya, kirim — SL/TP di brokermu ikut berubah',
              'Tutup posisi atau hapus pending order langsung dari garisnya',
            ]}
          />
          <Alat
            ikon={Radar}
            judul="Screener Area"
            kalimat="Berhenti membuka chart satu per satu untuk mencari setup yang itu-itu juga."
            poin={[
              'Area Pantau memindai SMI + SNR di seluruh watchlist sekaligus',
              'Parallel Signal: pair mana searah, mana berlawanan',
              'Watchlist tanpa batas, termasuk emas dan indeks',
            ]}
          />
          <Alat
            ikon={Code2}
            judul="Pine editor & backtest"
            kalimat="Tulis indikatormu sendiri dan jalankan di chart yang sama, tanpa pindah platform."
            poin={[
              'Mesin Pine sendiri — skrip TradingView-mu jalan di sini',
              'Dokter Pine memperbaiki skrip yang error',
              'Backtest dan replay bar-per-bar untuk latihan',
            ]}
          />
          <Alat
            ikon={Plug}
            judul="Sambungan broker"
            kalimat="Binance Futures lewat VPS sendiri, MetaTrader 5 lewat EA JadiTraderSync."
            poin={[
              'Kunci API tidak pernah lewat browser — hanya VPS-mu sendiri',
              'EA mengirim saldo, posisi, dan pending order ke situs',
              'Pair broker berakhiran (EURJPYc, XAUUSDm) dikenali otomatis',
            ]}
          />
          <Alat
            ikon={Bot}
            judul="Agen AI"
            kalimat="Membaca sinyal, mengevaluasi porto, memperbaiki skrip. Dibayar per pakai, bukan per bulan."
            poin={[
              'Sinyal mentah jadi order siap kirim — kamu yang menyetujui',
              'Evaluasi portofolio dan rencana eksekusi',
              'Token tidak hangus, tidak ada masa kedaluwarsa',
            ]}
          />
        </div>
      </section>

      {/* ── Pengaman ──────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-zinc-900/20">
        <div className="mx-auto max-w-[1280px] px-4 py-14 md:py-20">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                ikon: ShieldCheck,
                judul: 'Kunci API tinggal di VPS-mu',
                teks: 'Order dikirim lewat backend milikmu sendiri, bukan server bersama. Browser tidak pernah memegang kunci Binance-mu.',
              },
              {
                ikon: MoveVertical,
                judul: 'Batas lot yang kamu tentukan',
                teks: 'Perintah di atas batas ditolak, bukan dikecilkan diam-diam. Perintah yang lebih tua dari 5 menit kedaluwarsa sendiri.',
              },
              {
                ikon: NotebookPen,
                judul: 'Setiap order minta persetujuan',
                teks: 'Tidak ada yang berangkat tanpa kamu menekan kirim, termasuk yang disiapkan agen AI.',
              },
            ].map(({ ikon: Ikon, judul, teks }) => (
              <div key={judul} className="flex flex-col gap-2">
                <Ikon className="size-5 text-[#ffcd75]" />
                <h3 className="text-[14px] font-semibold text-zinc-100">{judul}</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">{teks}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ajakan penutup ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-4 py-16 text-center md:py-24">
        <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
          Mulai dari mencatat. Sisanya menyusul.
        </h2>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-zinc-400">
          Jurnalnya gratis selamanya dan tidak minta kartu kredit. Kalau setelah sebulan kamu
          merasa butuh melihat pasar lebih dulu sebelum entry, paketnya menunggu di situ.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/jurnal"
            className="group inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-[#ffcd75] to-[#c9a24b] px-7 py-3 text-sm font-semibold text-zinc-950 shadow-lg transition-all hover:from-[#ffcd75] hover:to-[#ffcd75]"
          >
            Buka jurnal gratis
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/dokumentasi"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-800 px-7 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900"
          >
            Baca dokumentasi
          </Link>
        </div>
      </section>
    </div>
  );
}
