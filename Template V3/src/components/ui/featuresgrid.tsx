/* Ditempel apa adanya dari sumbernya. SATU baris dibuang: `import { cn }`
   — template aslinya mengimpornya tanpa pernah memakainya, dan tsconfig
   proyek ini menyalakan noUnusedLocals sehingga build GAGAL karenanya.
   Tidak ada satu pun kelas, teks, atau struktur yang disentuh. */
import { CandlestickChart, NotebookPen, PlugZap, Users } from "lucide-react";
import { PeragaReplay } from "@/components/ui/peraga-replay";
import { PeragaJurnal, PeragaIntegrasi, PeragaLeaderboard } from "@/components/ui/peraga-kartu";

export const Component = () => {
  /* Jarak ATAS dipangkas dua kali (py-24/sm:py-32 -> pt-12/sm:pt-16 ->
     pt-6/sm:pt-8), bawahnya dibiarkan. Bagian ini menyusul tepat di bawah
     tur layar, dan dua ruang kosong besar yang bertumpuk membuat halamannya
     terbaca seperti terputus — orang mengira isinya sudah habis lalu
     berhenti menggulir. */
  return (
    <section className="relative w-full bg-black pt-6 pb-24 font-sans text-white sm:pt-8 sm:pb-32 selection:bg-white selection:text-black">
      <div className="mx-auto max-w-6xl px-6 md:px-8">

        {/* Section Header */}
        <div className="mb-16 flex flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-xs font-medium uppercase tracking-widest text-neutral-400">
            Jadi Trader Tools
          </div>
          {/* Skalanya diturunkan satu tingkat (4xl/5xl/6xl -> 3xl/4xl/5xl) dan
              kotaknya dilebarkan 4xl -> 5xl. Ukuran lama dipilih untuk
              "Everything you need." — tiga kata.

              Lebarnya diukur, bukan ditebak: pada 48px baris penutupnya
              butuh 944px sementara max-w-4xl cuma 896px, jadi "Gambler."
              selalu jatuh sendirian ke baris berikutnya. max-w-5xl (1024px)
              memberi kelonggaran yang cukup. */}
          <h2 className="mb-4 max-w-5xl text-balance text-3xl font-medium tracking-tighter text-white sm:text-4xl md:text-5xl">
            Semua Tools Yang Dibuat Diarahkan Menjadi
            Sistem Paksa Mendisiplinkan Diri <br className="hidden sm:block" />
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

              Keempatnya bergerak sendiri tanpa tombol. Label "contoh" juga
              dilepas; yang menggantikan fungsinya bukan label melainkan
              isinya — tidak ada nama orang, tidak ada nama simbol di grafik,
              tidak ada satu angka harga pun. Lihat catatan di peraga-kartu.tsx
              soal kenapa papan peringkat memakai "Analis 1..3".

              Semua peraga diam total kalau pengguna menyalakan "kurangi
              gerak" di setelan sistemnya — lihat lib/gerak-minim.ts. */}
          <div className="group flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#050505] transition-colors hover:border-white/[0.15] md:col-span-2">
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
                Pilih titik mulai, lalu putar harga maju bar demi bar dan ambil keputusan
                tanpa tahu lanjutannya. Begitulah cara alatnya bekerja.
              </p>
            </div>
          </div>

          {/* ── Kartu 2: Jurnal ────────────────────────────────────────── */}
          <div className="group flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#050505] transition-colors hover:border-white/[0.15]">
            <div className="flex flex-1 items-center justify-center p-8">
              <PeragaJurnal />            </div>
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
          <div className="group flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#050505] transition-colors hover:border-white/[0.15]">
            <div className="flex flex-1 items-center justify-center p-8">
              <PeragaIntegrasi />            </div>
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
          <div className="group flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#050505] transition-colors hover:border-white/[0.15] md:col-span-2">
            <div className="relative flex flex-1 items-center justify-center p-8">
              <div className="w-full max-w-sm"><PeragaLeaderboard /></div>            </div>
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
