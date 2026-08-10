import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Rocket, Crosshair, Package, Plug, BookOpen, Calculator,
  CreditCard, ShieldCheck, LifeBuoy, Library, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { Panel } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   DOCUMENTATION
   ════════════════════════════════════════════════════════════════════════
   Isi halaman ini dipilih dari pertanyaan yang BENAR-BENAR ditanyakan orang,
   bukan dari daftar bab yang biasa ada di dokumentasi produk.

   Yang paling sering ditanya bukan "bagaimana cara memasang" melainkan
   "kenapa koin ini muncul dan koin itu tidak" — karena itu bab logika sinyal
   ditaruh nomor dua, di atas panduan pemasangan. Dokumentasi yang menyimpan
   jawaban itu di bab sembilan akan tetap ditanyakan lewat WhatsApp.

   Yang SENGAJA tidak ada di sini: janji hasil, contoh "profit bulan lalu",
   dan tutorial strategi. Ketiganya bukan dokumentasi — itu pemasaran, dan
   menempatkannya di sini merusak kepercayaan pada bab yang lain.
   ════════════════════════════════════════════════════════════════════════ */

function K({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[11.5px] text-zinc-200">{children}</code>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-zinc-400">{children}</p>;
}

function Daftar({ butir }: { butir: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {butir.map((b, i) => (
        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-zinc-400">
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-zinc-600" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

function Rumus({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 font-mono text-[12px] leading-relaxed text-zinc-300">
      {children}
    </div>
  );
}

interface Artikel {
  id: string;
  judul: string;
  ringkas: string;
  Ikon: LucideIcon;
  kata: string;
  isi: React.ReactNode;
}

const ARTIKEL: Artikel[] = [
  {
    id: 'mulai',
    judul: 'Mulai cepat',
    ringkas: 'Dari daftar akun sampai sinyal pertama, tanpa memasang apa pun.',
    Ikon: Rocket,
    kata: 'mulai daftar trial login pertama kali onboarding',
    isi: (
      <>
        <P>
          Screener bisa dipakai tanpa memasang indikator, tanpa VPS, dan tanpa menghubungkan akun
          apa pun. Tiga hal itu baru diperlukan kalau kamu ingin mengeksekusi order atau mengisi
          jurnal otomatis.
        </P>
        <Daftar butir={[
          <>Masuk dengan akun Google. Masa coba 30 hari berjalan otomatis, tanpa kartu.</>,
          <>Buka <Link to="/screener" className="text-zinc-200 underline decoration-zinc-700 underline-offset-2 hover:decoration-zinc-400">Screener Entry</Link>. Area Pantau terisi sendiri setiap kali data 4 jam diperbarui.</>,
          <>Klik <K>Buka chart 4 jam</K> pada kartu mana pun untuk memeriksa sinyalnya di TradingView sebelum percaya.</>,
          <>Kalau ingin mencoba eksekusi tanpa risiko, pakai <K>Open Demo Order</K> di Area Entry — posisinya tercatat di tabel yang sama dengan order sungguhan.</>,
        ]} />
        <P>
          Order sungguhan sengaja dikunci sampai VPS terpasang. Itu bukan pembatasan paket:
          order dikirim dari server milikmu sendiri, jadi tanpa server itu tidak ada yang bisa
          mengirimnya.
        </P>
      </>
    ),
  },
  {
    id: 'logika',
    judul: 'Bagaimana sinyal dihitung',
    ringkas: 'Syarat persis Area Pantau, tiga mode Parallel Signal, dan cara zona SNR dibentuk.',
    Ikon: Crosshair,
    kata: 'sinyal logic snr smi parallel channel sweep zona rezim btc',
    isi: (
      <>
        <P>
          <span className="text-zinc-200">Area Pantau</span> adalah daftar pengawasan. Sebuah koin masuk
          kalau ketiga syarat ini terpenuhi bersamaan:
        </P>
        <Daftar butir={[
          <>SMI timeframe 4 jam berada di wilayah jenuh — di atas +40 (overbought) atau di bawah −40 (oversold).</>,
          <>Candle 5 menit yang sedang berjalan menyentuh zona SNR yang digambar dari timeframe 4 jam, bukan dari 5 menit.</>,
          <>Lebar zona masih wajar. Zona yang terlalu lebar berarti pivot-nya tidak jelas, dan SL yang dihasilkan jadi tidak masuk akal.</>,
        ]} />
        <P>
          Kartu di Area Pantau tidak menampilkan entry, SL, atau TP. Itu disengaja: koin di daftar ini
          baru memenuhi syarat untuk <em>dilihat</em>, belum tentu untuk dientry.
        </P>

        <P>
          <span className="text-zinc-200">Parallel Signal</span> punya tiga mode, dan bedanya hanya pada
          syarat mana yang diwajibkan:
        </P>
        <Daftar butir={[
          <><K>Sinyal SNR H4</K> — channel + sentuhan zona SNR 4 jam. Timeframe terkunci: 4 jam untuk zona, 5 menit untuk sentuhan.</>,
          <><K>Sentuh SNR</K> — channel + level support/resistance mana pun, tidak harus dari 4 jam.</>,
          <><K>Parallel Only</K> — murni pantulan channel, zona SNR diabaikan. Sinyal terbanyak, kualitas paling beragam.</>,
        ]} />

        <P>
          Channel digambar dari pivot high dan pivot low, lalu rail keduanya dipaksa sejajar. Sinyal
          BUY terbit kalau wick menembus rail bawah tetapi <span className="text-zinc-200">close kembali
          ke dalam</span> channel — bukan sekadar harga mendekati garis. Pola itu yang disebut
          liquidity sweep, dan menunggu close adalah satu-satunya cara membedakannya dari breakout
          yang benar-benar tembus.
        </P>

        <P>
          <span className="text-zinc-200">Rezim BTC</span> di kepala tiap section adalah SMI 4 jam BTC.
          Ia tidak menyaring apa pun — fungsinya konteks. Sinyal BUY altcoin saat rezim BTC SELL
          punya peluang berbeda dengan sinyal yang sama saat rezim BUY.
        </P>
      </>
    ),
  },
  {
    id: 'risiko',
    judul: 'Ukuran posisi, SL, dan TP',
    ringkas: 'Rumus yang dipakai Area Entry — termasuk kenapa SL diberi ruang setengah lebar zona.',
    Ikon: Calculator,
    kata: 'risiko lot ukuran posisi sl tp leverage margin sweep',
    isi: (
      <>
        <P>SL tidak ditaruh persis di tepi zona, melainkan setengah lebar zona di luarnya:</P>
        <Rumus>
          SL_buy&nbsp; = batas_bawah_zona − (lebar_zona ÷ 2)<br />
          SL_sell = batas_atas_zona&nbsp; + (lebar_zona ÷ 2)
        </Rumus>
        <P>
          Alasannya bukan kehati-hatian umum. Sweep hampir selalu mampir sedikit di luar zona sebelum
          berbalik — SL yang ditempel persis di tepi akan kena justru pada skenario yang sinyalnya
          benar.
        </P>

        <P>TP memakai rasio terhadap jarak SL, bukan level tetap:</P>
        <Rumus>
          risiko&nbsp; = |entry − SL|<br />
          TP1 = entry ± (risiko × 1)&nbsp;&nbsp;→ 1:1<br />
          TP2 = entry ± (risiko × 2)&nbsp;&nbsp;→ 1:2
        </Rumus>

        <P>Ukuran posisi dihitung mundur dari modal yang kamu isi, bukan dari saldo total:</P>
        <Rumus>
          qty = (modal_per_posisi × leverage) ÷ harga_entry
        </Rumus>
        <P>
          Kolom <K>Risk</K> pada kartu Parallel Signal adalah jarak entry ke SL dalam persen harga —
          bukan persen saldo. Angka 5% di situ berarti harga perlu bergerak 5% melawanmu untuk kena
          SL; berapa dolar yang hilang tergantung modal dan leverage yang kamu isi sendiri.
        </P>
      </>
    ),
  },
  {
    id: 'produk',
    judul: 'Indikator & Expert Advisor',
    ringkas: 'Pemasangan Jadi Trader V3, SMI, News & GAP Hunter, dan EA JadiTraderSync.',
    Ikon: Package,
    kata: 'indikator pine mql5 ea pasang install tradingview metatrader',
    isi: (
      <>
        <P>
          Indikator Pine dipasang lewat Pine Editor TradingView: tempel kodenya, klik <K>Add to chart</K>,
          lalu simpan ke favorit supaya bisa dipakai di layout mana pun. Versi Pine tertulis di kartu
          produknya masing-masing — v6 tidak bisa dikompilasi di layout yang masih dikunci v5.
        </P>
        <Daftar butir={[
          <><span className="text-zinc-200">Jadi Trader V3</span> — overlay. Channel, duplikat channel 1 & 2, zona SNR multi-TF, dan sinyal BUY/SELL.</>,
          <><span className="text-zinc-200">Stochastic Momentum Index</span> — panel terpisah. Ini SMI yang sama dengan yang dipakai Area Pantau.</>,
          <><span className="text-zinc-200">News & GAP Hunter V2</span> — overlay untuk XAUUSD dan forex.</>,
          <><span className="text-zinc-200">JadiTraderSync</span> — EA MT5, bukan indikator. Ditaruh di <K>MQL5/Experts</K> lalu diseret ke chart mana pun.</>,
        ]} />
        <P>
          Sumber EA dibuka di Marketplace supaya klaim "baca-saja" bisa diperiksa, bukan sekadar
          dipercaya: cari <K>OrderSend</K> di dalamnya — tidak akan ketemu.
        </P>
      </>
    ),
  },
  {
    id: 'sambungan',
    judul: 'Menyambungkan MT5 dan Binance',
    ringkas: 'Pairing code MT5, VPS proxy, dan App Token. Tutorial langkah demi langkah.',
    Ikon: Plug,
    kata: 'koneksi vps binance api token mt5 pairing proxy sslip',
    isi: (
      <>
        <P>
          Dua sambungan, dua sifat risiko yang berbeda jauh. MT5 hanya mengirim data ke jurnal;
          Binance mengeksekusi order dengan uang sungguhan. Karena itu keduanya diatur di tempat
          terpisah dengan peringatan yang berbeda.
        </P>
        <Daftar butir={[
          <><span className="text-zinc-200">MT5</span> — salin pairing code dari Integrations, isikan ke input <K>KodePasangan</K> pada EA. Selesai.</>,
          <><span className="text-zinc-200">Binance</span> — perlu VPS sendiri. Binance diblokir sebagian ISP Indonesia, jadi permintaan harus lewat proxy di luar jaringan itu.</>,
        ]} />
        <P>
          Tutorial lengkapnya — dari membuat API key sampai <K>pm2 startup</K>, dengan kode siap
          salin — ada di halaman Integrations.
        </P>
        <Link to="/integrasi"
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
          Buka tutorial pemasangan <ChevronRight className="size-3.5" />
        </Link>
      </>
    ),
  },
  {
    id: 'jurnal',
    judul: 'Jurnal: dari mana angkanya',
    ringkas: 'Saldo awal, akun sen, penggabungan forex dan kripto, serta cara P/L dihitung.',
    Ikon: BookOpen,
    kata: 'jurnal saldo equity winrate akun sen cent pnl riwayat',
    isi: (
      <>
        <P>
          Saldo di Dashboard dan Journal dihitung dari satu sumber: saldo awal ditambah seluruh P/L
          yang sudah direalisasi. Posisi terbuka tidak ikut — ia tampil terpisah sebagai floating,
          karena mencampur keduanya membuat kurva ekuitas berubah setiap detik tanpa ada transaksi
          yang benar-benar terjadi.
        </P>
        <Daftar butir={[
          <><span className="text-zinc-200">Akun sen</span> dideteksi dari mata uang akun MT5 dan dibagi 100 sebelum masuk jurnal. Tanpa ini, akun sen terlihat 100× lebih untung.</>,
          <><span className="text-zinc-200">Forex dan kripto</span> disimpan terpisah lalu digabung saat ditampilkan. Winrate gabungan memakai jumlah transaksi, bukan rata-rata dua winrate.</>,
          <><span className="text-zinc-200">Swap dan komisi</span> ikut dihitung ke dalam P/L tiap transaksi, bukan dijadikan baris sendiri.</>,
        ]} />
        <P>
          Kolom emosi dan alasan entry diisi manual. Keduanya tidak memengaruhi angka apa pun —
          gunanya muncul belakangan, saat pola "entry karena FOMO" bisa dijumlahkan.
        </P>
      </>
    ),
  },
  {
    id: 'langganan',
    judul: 'Masa coba, langganan, dan tagihan',
    ringkas: 'Apa yang berhenti saat masa coba habis, dan apa yang tetap bisa dibuka.',
    Ikon: CreditCard,
    kata: 'trial langganan bayar harga tagihan berlangganan paket 30 hari',
    isi: (
      <>
        <P>
          Masa coba 30 hari berjalan sejak login pertama, tanpa kartu. Setelahnya Screener berbiaya
          $5 per bulan.
        </P>
        <Daftar butir={[
          <>Yang berhenti: Area Pantau, Parallel Signal, dan Area Entry berhenti memuat data.</>,
          <>Yang tetap jalan: Journal, Personal Area, Marketplace, dan seluruh riwayat transaksimu. Data yang sudah masuk tidak pernah dikunci di balik langganan.</>,
          <>Indikator gratis di Marketplace tetap bisa diunduh setelah masa coba habis.</>,
        ]} />
        <P>
          Nomor kartu tidak pernah melewati server kami — kolomnya datang dari iframe penyedia
          pembayaran. Yang kami simpan hanya status langganan dan tanggal berakhirnya.
        </P>
      </>
    ),
  },
  {
    id: 'keamanan',
    judul: 'Keamanan & data',
    ringkas: 'Apa yang disimpan, di mana, dan apa yang tidak pernah kami pegang.',
    Ikon: ShieldCheck,
    kata: 'keamanan privasi api key withdraw token firestore data',
    isi: (
      <>
        <P>Yang tidak pernah kami simpan, dalam bentuk apa pun:</P>
        <Daftar butir={[
          <>API key dan secret Binance. Keduanya hanya ada di file <K>.env</K> di VPS milikmu sendiri.</>,
          <>App Token. Disimpan di localStorage peramban ini saja, dikirim hanya ke alamat VPS yang kamu isi.</>,
          <>Nomor kartu, kata sandi MT5, dan kata sandi investor.</>,
        ]} />
        <P>
          Saat membuat API key di Binance, <span className="text-zinc-200">jangan centang Withdraw</span> dan
          batasi ke IP VPS-mu. Dengan dua pengaturan itu, key yang bocor sekalipun tidak bisa
          memindahkan dana keluar.
        </P>
        <P>
          Yang kami simpan di Firestore: email, status langganan, riwayat transaksi yang dikirim EA,
          dan catatan jurnal yang kamu tulis sendiri. Posisi terbuka yang tampil ke publik hanya
          berisi simbol, arah, entry, SL, TP, dan waktu buka — tanpa ukuran lot, margin, atau nilai
          dolar.
        </P>
      </>
    ),
  },
  {
    id: 'masalah',
    judul: 'Pemecahan masalah',
    ringkas: 'Enam keluhan yang paling sering masuk, dengan penyebab dan jalan keluarnya.',
    Ikon: LifeBuoy,
    kata: 'error masalah gagal tidak muncul troubleshoot bug 401 blokir',
    isi: (
      <>
        <Daftar butir={[
          <><span className="text-zinc-200">Area Pantau kosong terus.</span> Kalau tidak ada koin yang memenuhi ketiga syarat, daftarnya memang kosong — itu bukan error. Longgarkan dengan mode Parallel Only untuk memastikan.</>,
          <><span className="text-zinc-200">Data pasar tidak masuk.</span> Binance diblokir sebagian ISP Indonesia. Ganti DNS atau — lebih andal — pakai proxy VPS di Integrations.</>,
          <><span className="text-zinc-200">Open Real Order ditolak.</span> Backend URL atau App Token kosong. Keduanya diisi di Integrations.</>,
          <><span className="text-zinc-200">Order dijawab 401.</span> App Token di peramban berbeda dengan <K>APP_TOKEN</K> di <K>.env</K> VPS. Setelah mengubah <K>.env</K>, jalankan <K>pm2 restart</K> — proses lama masih memegang nilai lama.</>,
          <><span className="text-zinc-200">EA tersambung tapi jurnal tidak terisi.</span> WebRequest belum diizinkan, atau alamat server belum ditambahkan di daftar putih MT5.</>,
          <><span className="text-zinc-200">Jurnal berbeda antar perangkat.</span> Muncul kalau dua perangkat mengedit offline lalu keduanya sinkron. Buka jurnal di satu perangkat sampai selesai, baru pindah.</>,
        ]} />
      </>
    ),
  },
  {
    id: 'glosarium',
    judul: 'Glosarium',
    ringkas: 'Istilah yang dipakai di seluruh aplikasi, ditulis sekali di sini.',
    Ikon: Library,
    kata: 'istilah glosarium arti definisi snr smi sweep pivot rezim',
    isi: (
      <div className="space-y-3">
        {[
          ['SNR', 'Support & Resistance. Di aplikasi ini selalu berbentuk zona (punya lebar), bukan garis tunggal — pivot jarang berhenti di harga yang sama persis dua kali.'],
          ['SMI', 'Stochastic Momentum Index. Skala −100 sampai +100; nol berarti harga persis di tengah rentangnya. Di atas +40 disebut jenuh beli, di bawah −40 jenuh jual.'],
          ['Parallel channel', 'Dua garis sejajar yang digambar dari pivot high dan pivot low. Rail atas dan bawah dipaksa punya kemiringan sama.'],
          ['Sweep', 'Wick menembus level lalu close kembali ke dalam. Berbeda dengan breakout, yang close-nya tetap di luar.'],
          ['Rezim BTC', 'SMI 4 jam BTC, dipakai sebagai konteks membaca sinyal altcoin. Bukan filter — tidak ada sinyal yang disembunyikan karenanya.'],
          ['Floating', 'P/L posisi yang masih terbuka. Tidak dihitung ke saldo sampai posisinya ditutup.'],
          ['Pairing code', 'Kode enam karakter yang menghubungkan satu terminal MT5 ke satu akun di sini. Bisa dibuat ulang kapan saja.'],
          ['App Token', 'Kata sandi antara peramban dan VPS-mu. Bukan API key Binance — API key tidak pernah meninggalkan VPS.'],
        ].map(([istilah, arti]) => (
          <div key={istilah} className="border-l-2 border-zinc-800 pl-3.5">
            <div className="text-[12.5px] font-medium text-zinc-200">{istilah}</div>
            <div className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">{arti}</div>
          </div>
        ))}
      </div>
    ),
  },
];

export default function Dokumentasi() {
  const [cari, setCari] = useState('');
  const [aktif, setAktif] = useState('mulai');

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return ARTIKEL;
    return ARTIKEL.filter((a) =>
      (a.judul + ' ' + a.ringkas + ' ' + a.kata).toLowerCase().includes(q)
    );
  }, [cari]);

  const artikel = hasil.find((a) => a.id === aktif) ?? hasil[0];

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* ── Indeks ── */}
        <div className="min-w-0">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              value={cari} onChange={(e) => setCari(e.target.value)}
              placeholder="Cari di dokumentasi…"
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 pl-9 pr-3 text-[12.5px]
                         text-zinc-200 outline-none transition-colors placeholder:text-zinc-600
                         hover:border-zinc-700 focus-visible:border-zinc-600"
            />
          </div>

          <nav className="lg:sticky lg:top-[72px]">
            {hasil.length === 0 ? (
              <p className="px-2 py-6 text-[12.5px] text-zinc-500">Tidak ada bab yang cocok dengan “{cari}”.</p>
            ) : hasil.map(({ id, judul, ringkas, Ikon }) => (
              <button
                key={id} onClick={() => setAktif(id)}
                className={cn(
                  'mb-1 flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors',
                  artikel?.id === id ? 'bg-zinc-800/70' : 'hover:bg-zinc-900'
                )}
              >
                <Ikon className={cn('mt-0.5 size-4 shrink-0', artikel?.id === id ? 'text-zinc-100' : 'text-zinc-500')} strokeWidth={1.8} />
                <span className="min-w-0">
                  <span className={cn('block text-[13px]', artikel?.id === id ? 'text-zinc-100' : 'text-zinc-300')}>{judul}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-zinc-600">{ringkas}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* ── Isi ── */}
        {artikel && (
          <Panel className="min-w-0 p-6 sm:p-7">
            <div className="flex items-center gap-2.5">
              <artikel.Ikon className="size-5 text-zinc-400" strokeWidth={1.8} />
              <h1 className="text-[20px] font-semibold tracking-tight text-zinc-50">{artikel.judul}</h1>
            </div>
            <p className="mt-1.5 text-[13px] text-zinc-500">{artikel.ringkas}</p>
            <div className="mt-6 max-w-2xl space-y-4">{artikel.isi}</div>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-zinc-800/80 pt-5">
              <span className="text-[12.5px] text-zinc-500">Belum terjawab?</span>
              <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer"
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
                Tanya lewat WhatsApp
              </a>
              <a href="mailto:bagusjaya0509@gmail.com"
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
                Kirim email
              </a>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
