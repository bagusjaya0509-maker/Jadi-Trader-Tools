import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HARGA_PERINTIS_TEKS, MASA_AKSES_HARI } from '@/lib/harga-akses';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   BAGIAN HARGA — ditempel dari blok pricing, isinya diganti yang sebenarnya
   ════════════════════════════════════════════════════════════════════════
   Rangkanya dari blok sumbernya: tiga kartu, kartu tengah ditonjolkan,
   lencana di pojok, daftar fitur bercentang. Yang TIDAK ikut ditempel:

   · TIGA TINGKAT KARANGAN. Blok aslinya menjual $0 / $9 / $19 dengan
     tangga fitur — "5 anggota tim", "50GB penyimpanan", "akses API".
     Produk ini tidak punya tangga itu. Yang dijual cuma SATU hal, dan
     bedanya bukan di isi melainkan di KETERSEDIAAN: tempat gratisnya
     terbatas dan habis, dan akses perintis adalah cara masuk setelah
     habis. Mengarang pembeda fitur akan jadi janji yang tidak bisa
     ditepati begitu ada yang membayar lalu mencarinya.

   · framer-motion. Blok aslinya menariknya masuk hanya untuk menggeser
     background-position lencana "Populer". Itu ~50 kB gzip di JALUR MUAT
     PERTAMA halaman depan demi satu kilau yang CSS sudah bisa sejak lama.
     Diganti @keyframes kilau di index.css — tampilannya sama persis.

   · `bg-black text-white` untuk kartu unggulan. Blok aslinya menganggap
     halamannya PUTIH, jadi kartu hitam menonjol. Halaman ini gelap; kartu
     hitam di atas hitam justru hilang. Penonjolannya dipindah ke cincin
     emas — warna yang sudah dipakai tombol bayar di halaman Akses, jadi
     orang mengenalinya sebelum sampai ke sana.

   · Angka sisa tempat. Ada dan hidup, tapi datangnya dari Firestore, dan
     halaman depan harus bebas Firestore. Angka itu tinggal di halaman
     Akses; di sini cukup dinyatakan bahwa tempatnya memang terbatas.
   ════════════════════════════════════════════════════════════════════════ */

interface Tingkat {
  nama: string;
  harga: string;
  satuan: string | null;
  catatan: string;
  tombol: string;
  tuju: string;
  unggulan: boolean;
  isi: string[];
}

const TINGKAT: Tingkat[] = [
  {
    nama: 'Akses gratis',
    harga: 'Rp 0',
    satuan: `/ ${MASA_AKSES_HARI} hari`,
    catatan: 'Selama tempatnya masih ada. Dibuka bergelombang, bukan sekaligus.',
    tombol: 'Ambil tempat gratis',
    tuju: '#/akses',
    unggulan: false,
    isi: [
      'Chart replay yang bisa mengeksekusi order',
      'Screener SMI & SNR seluruh watchlist',
      'Jurnal yang terisi sendiri dari broker',
      'Sambungan Binance Futures & MetaTrader 5',
      'Alat gambar: SNR, fibonacci, posisi SL/TP',
    ],
  },
  {
    nama: 'Akses perintis',
    harga: HARGA_PERINTIS_TEKS,
    satuan: `/ ${MASA_AKSES_HARI} hari`,
    catatan: 'Jalan masuk saat tempat gratis sudah habis. Isinya sama persis.',
    tombol: 'Ambil akses perintis',
    tuju: '#/akses',
    unggulan: true,
    isi: [
      'Semua yang ada di akses gratis',
      'Tidak perlu menunggu gelombang berikutnya',
      'Ikut menentukan yang dikerjakan berikutnya',
      'Bicara langsung dengan yang membangunnya',
    ],
  },
  {
    nama: 'Alat tambahan',
    harga: 'Dijual terpisah',
    satuan: null,
    catatan: 'Bukan langganan. Dibeli sekali, per alat, tanpa perlu akses aktif.',
    tombol: 'Lihat marketplace',
    tuju: '#/marketplace',
    unggulan: false,
    isi: [
      'Trade-Fi Sync — jembatan MetaTrader 5',
      'Indikator siap pasang',
      'Lisensi per perangkat',
      'Pembaruan mengikuti versi terbarunya',
    ],
  },
];

export default function HargaAkses() {
  return (
    <section id="harga" className="border-t border-zinc-900 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-medium tracking-tighter text-white sm:text-4xl md:text-5xl">
            Satu produk, satu harga
          </h2>
          {/* Kalimat ini menjelaskan kenapa tidak ada tangga paket — kalau
              tidak, tiga kartu dengan isi yang mirip terbaca sebagai
              kelalaian, bukan sebagai keputusan. */}
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
            Tidak ada paket Silver, Gold, atau Platinum. Yang dipakai orang yang membayar
            sama persis dengan yang dipakai orang yang tidak. Bedanya cuma tempat: yang
            gratis jumlahnya terbatas dan habis.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {TINGKAT.map((t) => (
            <Card
              key={t.nama}
              className={cn(
                'flex flex-col border-zinc-800 bg-zinc-950/60',
                /* Cincin, bukan latar terang. Kartu unggulan yang diberi
                   latar terang di halaman gelap berubah jadi lubang putih
                   yang menarik mata menjauh dari tulisannya sendiri. */
                t.unggulan && 'border-[#ffcd75]/45 ring-1 ring-[#ffcd75]/20',
              )}
            >
              <CardHeader className="gap-0 space-y-0 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-[15px] font-semibold text-zinc-300">
                    {t.nama}
                  </CardTitle>
                  {t.unggulan && (
                    <span className="animate-kilau rounded-full border border-[#ffcd75]/30 bg-[linear-gradient(to_right,#ffcd75,#fff1cf,#ffcd75)] bg-clip-text px-2.5 py-0.5 text-[11px] font-medium text-transparent [background-size:200%]">
                      Paling banyak dipilih
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'text-[34px] font-semibold leading-none tracking-tighter',
                      t.unggulan ? 'text-[#ffcd75]' : 'text-white',
                      /* "Dijual terpisah" bukan angka — kalau diberi ukuran
                         angka, ia jadi kalimat raksasa yang memenuhi kartu. */
                      !t.satuan && 'text-[19px] tracking-tight',
                    )}
                  >
                    {t.harga}
                  </span>
                  {t.satuan && (
                    <span className="text-[13px] font-medium text-zinc-500">{t.satuan}</span>
                  )}
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-zinc-500">{t.catatan}</p>
              </CardHeader>

              <CardContent className="flex grow flex-col">
                <Button
                  asChild
                  variant={t.unggulan ? 'default' : 'outline'}
                  className={cn(
                    'w-full',
                    t.unggulan && 'bg-[#ffcd75] text-zinc-950 hover:bg-[#ffd98f]',
                  )}
                >
                  <a href={t.tuju}>{t.tombol}</a>
                </Button>

                <ul className="mt-6 flex flex-col gap-3 text-[13px] text-zinc-400">
                  {t.isi.map((baris) => (
                    <li key={baris} className="flex items-start gap-2.5">
                      <Check
                        className={cn(
                          'mt-0.5 size-3.5 shrink-0',
                          t.unggulan ? 'text-[#ffcd75]' : 'text-emerald-500',
                        )}
                      />
                      <span className="leading-relaxed">{baris}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Wajib ada dan wajib di sini, bukan cuma di halaman Legal: bagian
            harga adalah tempat orang memutuskan membayar, dan itu titik
            paling gampang disalahpahami sebagai janji hasil. */}
        <p className="mt-8 max-w-3xl text-[12px] leading-relaxed text-zinc-600">
            Jadi Trader Tools adalah perangkat bantu analisa dan pencatatan. Bukan
            penasihat investasi, bukan pengelola dana, dan tidak menjanjikan hasil apa pun.
            Keputusan dan risiko transaksi sepenuhnya ada pada Anda.
        </p>
      </div>
    </section>
  );
}
