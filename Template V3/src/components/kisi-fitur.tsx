import { LineChart, NotebookPen, Radar, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   KISI FITUR — bento untuk halaman pendaratan
   ════════════════════════════════════════════════════════════════════════
   Kartu fitur di bawah kisi ini MENGATAKAN apa yang didapat. Kisi ini
   MEMPERLIHATKANNYA. Dua pekerjaan berbeda, jadi dua bagian berbeda:
   orang yang belum percaya tidak dibujuk oleh daftar poin, ia dibujuk oleh
   melihat layarnya.

   YANG DITIRU ADALAH LAYAR SUNGGUHAN, bukan ilustrasi. Tiap kotak di sini
   memakai warna, radius, dan ukuran huruf yang sama persis dengan panel
   aslinya di aplikasi — supaya yang dilihat calon pengguna memang yang akan
   ia temui, bukan versi cantik yang dibuat untuk brosur.

   ANGKANYA CONTOH, DAN DIKATAKAN BEGITU. Angka yang dipakai sama dengan
   peraga di kepala halaman (BTCUSDT 63.572 / 63.215 / 64.482) supaya satu
   halaman bercerita satu hal, dan R:R-nya dihitung sungguhan dari ketiganya
   — 910 : 357 = 1 : 2,55. Menaruh rasio yang tidak cocok dengan levelnya
   sendiri di halaman jualan alat trading adalah cara tercepat kehilangan
   orang yang paling teliti, yaitu orang yang paling ingin kita dapatkan.

   Tanpa tipografi baru. Godaan besarnya memasang display face agar bagian
   ini "terlihat premium"; hasilnya halaman yang terbelah dua. Yang menarik
   perhatian di sini isinya, bukan hurufnya.
   ════════════════════════════════════════════════════════════════════════ */

/** Label tempat, bukan nomor urut. Fitur-fitur ini BUKAN urutan langkah —
 *  memberi "01 / 02 / 03" akan menyiratkan tahapan yang tidak ada. Yang
 *  benar-benar berguna: di menu mana barang ini tinggal. */
function Tempat({ anak }: { anak: string }) {
  return (
    <span className="angka text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffcd75]/70">
      {anak}
    </span>
  );
}

function Kartu({ tempat, ikon: Ikon, judul, kalimat, lebar, children }: {
  tempat: string;
  ikon: typeof LineChart;
  judul: string;
  kalimat: string;
  /** Kartu lebar mengisi dua kolom di layar besar. */
  lebar?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      'group flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-zinc-900',
      'bg-zinc-900/30 transition-colors hover:border-zinc-800',
      lebar && 'md:col-span-2',
    )}>
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8">{children}</div>
      <div className="border-t border-zinc-900 bg-zinc-950/40 p-6">
        <Tempat anak={tempat} />
        <div className="mt-2 flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ffcd75]/10 text-[#ffcd75]">
            <Ikon className="size-4" />
          </span>
          <h3 className="text-[15px] font-semibold text-zinc-100">{judul}</h3>
        </div>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-zinc-400">{kalimat}</p>
      </div>
    </div>
  );
}

/* ── Peraga 1: tiket order dengan garis yang bisa ditarik ──────────────
   Inilah satu-satunya hal yang benar-benar membedakan produk ini dari
   dashboard mana pun: garis di chart ADALAH ordernya. Maka ia yang dapat
   kotak terbesar, dan pegangan seretnya digambar — bukan disebut. */
function PeragaTiket() {
  const baris = [
    { label: 'TP',    nilai: '64.482', warna: 'text-emerald-400', garis: 'bg-emerald-500/40', atas: '14%' },
    { label: 'Entry', nilai: '63.572', warna: 'text-zinc-200',    garis: 'bg-zinc-500/50',    atas: '52%' },
    { label: 'SL',    nilai: '63.215', warna: 'text-red-400',     garis: 'bg-red-500/40',     atas: '78%' },
  ];
  return (
    <div className="w-full max-w-[440px]">
      <div className="relative h-[170px] rounded-xl border border-zinc-800/80 bg-zinc-950">
        {baris.map((b) => (
          <div key={b.label} className="absolute inset-x-0 flex items-center gap-2 px-3"
               style={{ top: b.atas }}>
            <span className={cn('angka w-9 shrink-0 text-[10px] font-semibold', b.warna)}>{b.label}</span>
            <span className={cn('h-px flex-1', b.garis)} />
            <span className={cn('angka shrink-0 rounded px-1.5 py-0.5 text-[10.5px]',
              'border border-zinc-800 bg-zinc-900', b.warna)}>
              {b.nilai}
            </span>
            {/* Pegangan seret — cuma di garis SL, karena itu garis yang
                paling sering dipindahkan orang saat posisi sudah jalan. */}
            {b.label === 'SL' && (
              <span className="absolute -right-1 flex h-4 w-4 items-center justify-center rounded
                               border border-red-500/50 bg-zinc-950 text-[8px] text-red-400">
                ↕
              </span>
            )}
          </div>
        ))}
        <span className="absolute bottom-2 left-3 text-[10px] text-zinc-600">
          tarik garisnya — SL di brokermu ikut pindah
        </span>
      </div>

      {/* Baris risiko: rasio DIHITUNG dari ketiga level di atas. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-zinc-800/80
                      bg-zinc-950 px-3 py-2.5">
        <span className="text-[10.5px] text-zinc-500">
          R : R <span className="angka text-[13px] font-semibold text-emerald-400">1 : 2,55</span>
        </span>
        <span className="text-[10.5px] text-zinc-500">
          Risk SL <span className="angka text-[13px] font-semibold text-red-400">−$10,00</span>
        </span>
        <span className="text-[10.5px] text-zinc-500">
          TP <span className="angka text-[13px] font-semibold text-emerald-400">+$25,50</span>
        </span>
        <span className="ml-auto rounded bg-zinc-100 px-2 py-1 text-[10.5px] font-semibold text-zinc-950">
          Kirim
        </span>
      </div>
    </div>
  );
}

/* ── Peraga 2: pola emosi ────────────────────────────────────────────── */
function PeragaEmosi() {
  const pola = [
    { nama: 'Balas dendam', lebar: '86%', rugi: true },
    { nama: 'FOMO',         lebar: '64%', rugi: true },
    { nama: 'Sesuai plan',  lebar: '31%', rugi: false },
  ];
  return (
    <div className="flex w-full flex-col gap-3">
      {pola.map((p) => (
        <div key={p.nama}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11.5px] text-zinc-300">{p.nama}</span>
            <span className={cn('angka text-[11px]', p.rugi ? 'text-red-400' : 'text-emerald-400')}>
              {p.lebar}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
            <div className={cn('h-full rounded-full', p.rugi ? 'bg-red-500/50' : 'bg-emerald-500/50')}
                 style={{ width: p.lebar }} />
          </div>
        </div>
      ))}
      <p className="mt-1 text-[10.5px] leading-relaxed text-zinc-600">
        Bagian trade rugi yang membawa emosi itu.
      </p>
    </div>
  );
}

/* ── Peraga 3: kunci API tinggal di VPS ──────────────────────────────── */
function PeragaKunci() {
  return (
    <div className="w-full font-mono text-[10.5px] leading-relaxed">
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3">
        <div className="text-zinc-600">VPS-mu</div>
        <div className="mt-1 break-all text-zinc-400">
          BINANCE_KEY=<span className="text-[#ffcd75]/80">••••••••••••••••</span>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-zinc-900 pt-3 text-zinc-500">
          <span className="motion-safe:animate-pulse size-1.5 rounded-full bg-emerald-500" />
          order terkirim
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-dashed border-zinc-800/60 p-3 text-zinc-600">
        <div>Browser</div>
        <div className="mt-1 text-zinc-700">tidak pernah memegang kuncinya</div>
      </div>
    </div>
  );
}

/* ── Peraga 4: satu pindaian, seluruh watchlist ──────────────────────── */
function PeragaPindai() {
  const hasil = [
    { pair: 'BTCUSDT',   tf: '4J', smi: 'Oversold',   arah: 'naik' },
    { pair: 'XAUUSD',    tf: '1J', smi: 'Overbought', arah: 'turun' },
    { pair: 'ETHUSDT',   tf: '4J', smi: 'Netral',     arah: null },
    { pair: 'THETAUSDT', tf: '4J', smi: 'Oversold',   arah: 'naik' },
  ];
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-1.5">
      {hasil.map((h) => (
        <div key={h.pair}
             className="flex items-center gap-3 rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 py-2">
          <span className="angka w-[86px] shrink-0 text-[11.5px] text-zinc-200">{h.pair}</span>
          <span className="angka w-6 shrink-0 text-[10px] text-zinc-600">{h.tf}</span>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px]',
            h.smi === 'Oversold' ? 'bg-emerald-500/10 text-emerald-400'
              : h.smi === 'Overbought' ? 'bg-red-500/10 text-red-400'
              : 'bg-zinc-800 text-zinc-500')}>
            {h.smi}
          </span>
          <span className="ml-auto text-[10.5px] text-zinc-600">
            {h.arah ? `zona ${h.arah}` : '—'}
          </span>
        </div>
      ))}
      <p className="mt-1 text-[10.5px] text-zinc-600">
        Satu pindaian menyentuh seluruh watchlist, bukan satu chart per kali.
      </p>
    </div>
  );
}

export function KisiFitur() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-16 md:py-24">
      <div className="mb-10 flex flex-col items-center text-center md:mb-14">
        <span className="mb-5 inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/40
                         px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Contoh tampilan
        </span>
        <h2 className="max-w-[760px] text-balance text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl md:text-4xl">
          Garis di chart itu ordermu.
        </h2>
        <p className="mt-4 max-w-[620px] text-balance text-[15px] leading-relaxed text-zinc-400">
          Bukan gambar keputusan yang lalu kamu ketik ulang di aplikasi broker. Kamu menarik
          garisnya di sini, dan stop loss di brokermu yang pindah.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kartu lebar tempat="Chart & Entry" ikon={LineChart}
               judul="Tarik garisnya, brokermu ikut"
               kalimat="Entry, SL, dan TP hidup di chart — bukan di formulir terpisah. Geser garisnya lalu kirim; risiko dolarnya ikut berubah karena ukuran posisinya tetap, persis seperti position tool yang sudah kamu kenal.">
          <PeragaTiket />
        </Kartu>

        <Kartu tempat="Journal" ikon={NotebookPen}
               judul="Emosi mana yang paling mahal"
               kalimat="Tiap posisi dicatat bersama emosinya, lalu Pola Emosi memperlihatkan mana yang paling sering muncul di trade rugi.">
          <PeragaEmosi />
        </Kartu>

        <Kartu tempat="Integrations" ikon={ShieldCheck}
               judul="Kunci API tinggal di VPS-mu"
               kalimat="Order berangkat lewat backend milikmu sendiri. Browser tidak pernah memegang kunci Binance-mu, dan kami pun tidak.">
          <PeragaKunci />
        </Kartu>

        <Kartu lebar tempat="Screener Area" ikon={Radar}
               judul="Satu pindaian, seluruh watchlist"
               kalimat="Area Pantau membaca SMI dan zona SNR di semua pair yang kamu pantau sekaligus — termasuk emas dan indeks lewat MT5. Berhenti membuka chart satu per satu untuk mencari setup yang itu-itu juga.">
          <PeragaPindai />
        </Kartu>
      </div>

      <p className="mt-6 text-center text-[11px] text-zinc-600">
        Angka pada contoh di atas bukan data pasar berjalan.
      </p>
    </section>
  );
}
