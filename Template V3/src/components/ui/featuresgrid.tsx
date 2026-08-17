/* Ditempel apa adanya dari sumbernya. SATU baris dibuang: `import { cn }`
   — template aslinya mengimpornya tanpa pernah memakainya, dan tsconfig
   proyek ini menyalakan noUnusedLocals sehingga build GAGAL karenanya.
   Tidak ada satu pun kelas, teks, atau struktur yang disentuh. */
import { CandlestickChart, NotebookPen, PlugZap, Users } from "lucide-react";
import { PeragaReplay } from "@/components/ui/peraga-replay";

export const Component = () => {
  /* Jarak ATAS dipangkas (py-24/sm:py-32 -> pt-12/sm:pt-16), bawahnya
     dibiarkan. Bagian ini menyusul tepat di bawah tur layar, dan dua ruang
     kosong besar yang bertumpuk membuat halamannya terbaca seperti
     terputus — orang mengira isinya sudah habis lalu berhenti menggulir. */
  return (
    /* ── GARIS TEMPELAN DI BATAS ATAS SEKSI INI ──────────────────────────
       Riwayatnya perlu diingat supaya tidak diputar ulang dari nol.

       Latar seksi ini hitam murni rgb(0,0,0), sementara halaman di atasnya
       dulu zinc-950 rgb(9,9,11). Selisih sebelas tingkat itu tidak terlihat
       sebagai "dua warna", tapi tepi tempat keduanya bertemu jadi garis
       lurus setajam penggaris melintasi seluruh lebar layar.

       Itulah garis yang dua kali dikira berasal dari bias cahaya di hero.
       Bukan — dan karena itu dua putaran penghalusan gradien tidak pernah
       menyentuhnya sama sekali. Penyebabnya loncatan warna latar.

       Sekarang SELURUH halaman ini hitam murni dan seluruh cahayanya
       dimatikan, atas permintaan pemilik. Aturan yang tersisa satu:
       seksi mana pun yang ditambahkan ke halaman ini harus memakai warna
       latar yang sama persis. Satu seksi ber-zinc-950 sudah cukup untuk
       memunculkan garis itu lagi. */
    <section className="relative w-full bg-black pt-12 pb-24 font-sans text-white sm:pt-16 sm:pb-32 selection:bg-white selection:text-black">
      <div className="relative mx-auto max-w-6xl px-6 md:px-8">

        {/* Section Header */}
        <div className="mb-16 flex flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-xs font-medium uppercase tracking-widest text-neutral-400">
            Jadi Trader Tools
          </div>
          {/* Skalanya diturunkan satu tingkat (4xl/5xl/6xl -> 3xl/4xl/5xl) dan
              kotaknya dilebarkan. Ukuran lama dipilih untuk "Everything you
              need." — tiga kata. Kalimat Indonesianya lima kali lebih panjang,
              dan pada 6xl ia memakan seluruh layar sampai kartu-kartu di
              bawahnya tidak pernah terlihat tanpa menggulir dua kali. */}
          {/* Skalanya diturunkan satu tingkat (4xl/5xl/6xl -> 3xl/4xl/5xl) dan
              kotaknya dilebarkan 4xl -> 5xl. Ukuran lama dipilih untuk
              "Everything you need." — tiga kata.

              Lebarnya diukur, bukan ditebak: pada 48px baris penutupnya
              butuh 944px sementara max-w-4xl cuma 896px, jadi "Gambler."
              selalu jatuh sendirian ke baris berikutnya. max-w-5xl (1024px)
              memberi kelonggaran yang cukup. */}
          <h2 className="mb-4 max-w-5xl text-balance text-3xl font-medium tracking-tighter text-white sm:text-4xl md:text-5xl">
            Semua Tools Yang Dibuat Diarahkan Menjadi Sistem Paksa Untuk Bisa
            Mendisiplinkan Diri <br className="hidden sm:block" />
            {/* Satu baris HANYA dari lg ke atas. Di bawah itu ruangnya
                memang tidak cukup (768px cuma menyediakan ~704px untuk
                kalimat yang butuh 944px), dan memaksakan nowrap di sana
                bukan membuatnya satu baris — ia membuat seluruh halaman
                bisa digeser ke samping. */}
            <span className="text-neutral-600 lg:whitespace-nowrap">
              Untuk Membentuk Jiwa Trader, Bukan Gambler.
            </span>
          </h2>
          <p className="max-w-2xl text-balance text-base text-neutral-400 sm:text-lg">
            Tujuan tools ini dibuat karena dari sekian pengalaman yang ada, satu-satunya
            penyebab gagal menjadi trader profitable bukanlah teknik analisanya — tapi
            psikologi dan konsistensi terhadap risk dan reward saat trading.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">

          {/* ── Kartu 1: Chart & Entry (replay yang bisa dimainkan) ──────
              Keempat kartu di bawah ini dulu berisi peraga infrastruktur
              milik template asalnya — latensi edge node, kunci API, webhook.
              Tidak satu pun dari itu ada di produk ini, dan halaman jualan
              yang memperagakan fitur yang tidak dimiliki adalah janji yang
              harus ditagih orang setelah membayar. Diganti dengan empat
              layar yang benar-benar ada: Chart & Entry, Jurnal, Integrasi,
              Copy Signal.

              Yang ini SATU-SATUNYA yang interaktif, dan itu disengaja:
              replay tidak bisa dijelaskan gambar diam — yang membuatnya
              masuk akal justru bahwa lanjutannya belum kelihatan. */}
          <div className="group flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black transition-colors hover:border-white/[0.15] md:col-span-2">
            <div className="relative flex flex-1 items-center justify-center p-8">
              <div className="w-full max-w-md">
                <PeragaReplay />
              </div>
            </div>
            <div className="border-t border-white/[0.04] bg-white/[0.01] p-6">
              <div className="mb-2 flex items-center gap-2 text-white">
                <CandlestickChart className="h-4 w-4" />
                <h3 className="text-sm font-medium">Chart &amp; Entry — Replay</h3>
              </div>
              <p className="text-sm text-neutral-400">
                Putar ulang pergerakan harga bar demi bar dan ambil keputusan tanpa tahu
                lanjutannya. Coba tombol Putar di atas — begitulah cara alatnya bekerja.
              </p>
            </div>
          </div>

          {/* ── Kartu 2: Jurnal ────────────────────────────────────────── */}
          <div className="group flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black transition-colors hover:border-white/[0.15]">
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="flex w-full flex-col gap-2">
                <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-neutral-600">
                  <span>RIWAYAT TRADE</span>
                  <span className="rounded border border-white/[0.08] px-1.5 py-0.5">contoh</span>
                </div>
                {[
                  { p: 'BTCUSDT', a: 'BUY', r: '+2,1R', u: true, e: 'Sabar' },
                  { p: 'SOLUSDT', a: 'SELL', r: '-1,0R', u: false, e: 'FOMO' },
                  { p: 'XAUUSD', a: 'BUY', r: '+1,4R', u: true, e: 'Disiplin' },
                ].map((t) => (
                  <div key={t.p}
                       className="flex items-center gap-2 rounded border border-white/[0.04] bg-white/[0.02] px-2.5 py-2 font-mono text-[10px]">
                    <span className="text-neutral-300">{t.p}</span>
                    <span className={t.a === 'BUY' ? 'text-emerald-400/80' : 'text-red-400/80'}>{t.a}</span>
                    <span className="ml-auto rounded bg-white/[0.04] px-1.5 py-0.5 text-neutral-500">{t.e}</span>
                    <span className={t.u ? 'text-emerald-400' : 'text-red-400'}>{t.r}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-white/[0.04] bg-white/[0.01] p-6">
              <div className="mb-2 flex items-center gap-2 text-white">
                <NotebookPen className="h-4 w-4" />
                <h3 className="text-sm font-medium">Jurnal</h3>
              </div>
              <p className="text-sm text-neutral-400">
                Tiap trade tercatat lengkap dengan emosi yang menyertainya — di situ pola
                yang menggerogoti akun mulai kelihatan.
              </p>
            </div>
          </div>

          {/* ── Kartu 3: Integrasi ─────────────────────────────────────── */}
          <div className="group flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black transition-colors hover:border-white/[0.15]">
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="flex w-full flex-col gap-2.5">
                {[
                  { n: 'MetaTrader 5', k: 'Forex & Emas', s: 'Terhubung' },
                  { n: 'Binance', k: 'Kripto Futures', s: 'Terhubung' },
                ].map((i) => (
                  <div key={i.n} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[12px] text-neutral-200">{i.n}</span>
                      <span className="ml-auto font-mono text-[9.5px] text-emerald-400/80">{i.s}</span>
                    </div>
                    <div className="mt-1.5 pl-3.5 font-mono text-[9.5px] text-neutral-600">{i.k}</div>
                  </div>
                ))}
                <div className="mt-0.5 font-mono text-[9.5px] leading-relaxed text-neutral-600">
                  Kunci API disimpan di perangkatmu sendiri.
                </div>
              </div>
            </div>
            <div className="border-t border-white/[0.04] bg-white/[0.01] p-6">
              <div className="mb-2 flex items-center gap-2 text-white">
                <PlugZap className="h-4 w-4" />
                <h3 className="text-sm font-medium">Integrasi</h3>
              </div>
              <p className="text-sm text-neutral-400">
                Sambungkan MT5 dan Binance, lalu posisi serta riwayatmu masuk sendiri —
                tidak perlu dicatat ulang satu per satu.
              </p>
            </div>
          </div>

          {/* ── Kartu 4: Copy Signal ───────────────────────────────────── */}
          <div className="group flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black transition-colors hover:border-white/[0.15] md:col-span-2">
            <div className="relative flex flex-1 items-center justify-center p-8">
              <div className="flex w-full max-w-sm flex-col gap-2.5">
                <div className="flex items-center justify-between font-mono text-[10px] text-neutral-600">
                  <span>PAPAN SINYAL</span>
                  <span className="rounded border border-white/[0.08] px-1.5 py-0.5">contoh</span>
                </div>
                {[
                  { i: 'R', n: 'Analis', w: '68%', g: 'Scalping', s: 'Berjalan', warna: 'text-sky-400' },
                  { i: 'A', n: 'AI Agent', w: '54%', g: 'Intraday', s: 'Menunggu harga', warna: 'text-amber-400' },
                ].map((a) => (
                  <div key={a.i} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-neutral-300">
                      {a.i}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] text-neutral-200">{a.n}</span>
                      <span className="block font-mono text-[9.5px] text-neutral-600">{a.g}</span>
                    </span>
                    <span className="ml-auto text-right">
                      <span className="block font-mono text-[12px] text-emerald-400">{a.w}</span>
                      <span className={`block font-mono text-[9.5px] ${a.warna}`}>{a.s}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-white/[0.04] bg-white/[0.01] p-6">
              <div className="mb-2 flex items-center gap-2 text-white">
                <Users className="h-4 w-4" />
                <h3 className="text-sm font-medium">Copy Signal</h3>
              </div>
              <p className="text-sm text-neutral-400">
                Sinyal dari analis lain dan agen AI, dinilai dari rekam jejak sinyalnya
                sendiri — winrate, gaya trading, dan tingkat risikonya dihitung dari harga
                yang sudah terjadi, bukan dari klaim yang ditulis pemiliknya.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
