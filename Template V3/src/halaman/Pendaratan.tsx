import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { BADAN } from '@/lib/badan';
import { Header } from '@/components/ui/header-3';
import { HeroSection } from '@/components/ui/hero-3';

/* ════════════════════════════════════════════════════════════════════════
   PENDARATAN — halaman pertama untuk orang yang belum masuk
   ════════════════════════════════════════════════════════════════════════
   Dirombak total mengikuti pasangan header-3 + hero-3 (efferd/sshahaider):
   header sticky dengan dua menu jatuh, hero dengan animasi masuk bertingkat
   dan layar berbingkai yang melarut ke bawah.

   ISI BAGIAN TENGAH SENGAJA BELUM ADA. Keputusan pemilik: pasang kerangka
   tampilannya dulu 100%, isian menyusul, footer lama dipertahankan — ia
   satu-satunya bagian halaman yang memuat identitas hukum (NIB) dan
   disclaimer, dan itu tidak boleh ikut hilang selama masa transisi.

   Yang mengisi bingkai layar hero tetap PeragaTerminal — antarmuka tiruan
   kami sendiri, bukan tangkapan layar produk lain dari CDN template. */

/* ── Peraga terminal ── (dipertahankan dari versi sebelumnya) */
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

export default function Pendaratan() {
  return (
    <div className="min-h-screen w-full overflow-y-auto bg-background text-foreground">
      <Header />
      <main className="grow">
        <HeroSection>
          <PeragaTerminal />
        </HeroSection>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────
          Halaman ini satu-satunya yang dilihat orang SEBELUM membeli, jadi
          di sinilah identitas penyelenggara paling wajib berada — bukan
          cuma di dalam aplikasi yang baru terbuka setelah bayar.

          Nomor NIB ditulis lengkap dan sengaja: siapa pun bisa memeriksanya
          di OSS. Itu satu-satunya hal di footer ini yang benar-benar bisa
          diverifikasi orang asing, dan pembeda paling murah dari penjual
          alat trading yang cuma punya akun Telegram.

          Alamat berhenti di tingkat kota — lihat alasannya di lib/badan.ts. */}
      <footer className="border-t border-zinc-800/80">
        <div className="mx-auto max-w-[1280px] px-4 py-10">
          <p className="max-w-[720px] text-[12px] leading-relaxed text-zinc-500">
            Jadi Trader Tools menjual lisensi perangkat lunak alat bantu analisa pasar.{' '}
            <span className="text-zinc-400">
              Bukan nasihat investasi, dan kami tidak pernah mengelola dana siapa pun.
            </span>{' '}
            Trading berisiko kehilangan seluruh modal — hasil masa lalu bukan jaminan hasil
            di masa depan.
          </p>

          <div className="mt-6 flex flex-col gap-4 border-t border-zinc-800/60 pt-6 text-[12px] text-zinc-500 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <div className="text-zinc-400">{BADAN.nama}</div>
              <div>NIB {BADAN.nib}</div>
              <div>{BADAN.kota}</div>
              <div>
                <a href={`mailto:${BADAN.email}`} className="transition-colors hover:text-zinc-300">
                  {BADAN.email}
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link to="/legal" className="transition-colors hover:text-zinc-300">Disclaimer &amp; Privasi</Link>
              <Link to="/dokumentasi" className="transition-colors hover:text-zinc-300">Dokumentasi</Link>
              <span className="text-zinc-600">© 2026 Jadi Trader Tools</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
