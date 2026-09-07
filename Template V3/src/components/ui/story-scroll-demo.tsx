import FlowArt, { FlowSection } from '@/components/ui/story-scroll';

/* ════════════════════════════════════════════════════════════════════════
   TUR LAYAR — isi kotak gambar hero di /template
   ════════════════════════════════════════════════════════════════════════
   Isi demo aslinya (platform seni berbahasa Inggris) diganti tangkapan
   layar aplikasi kita sendiri. Kerangkanya tetap milik template: lima
   seksi yang berputar masuk dan menumpuk saat kotaknya digulir.

   Tangkapannya diambil dari server dev lokal lewat Playwright
   (`tangkap.mjs`), pada keadaan APA ADANYA — belum masuk, data contoh.
   Tidak ada angka yang disunting supaya terlihat lebih baik: yang
   diperlihatkan harus benar-benar layar yang akan orang temui. Pita
   "data contoh" di beberapa layar sengaja dibiarkan.

   Yang disembunyikan saat memotret hanya tempelan login (One Tap Google
   dan tombol Masuk) — keduanya menutupi bilah atas dan bukan bagian dari
   alat yang sedang diperlihatkan.

   Ukuran huruf memakai clamp() berbatas px, BUKAN cqw. Container query
   menuntut `container-type: inline-size` pada kotaknya, dan properti itu
   memasang containment layout — persis hal yang bisa mematahkan pin
   ScrollTrigger. Huruf yang rapi tidak sepadan dengan risiko mematahkan
   gerakan yang jadi inti tempelan ini.
   ════════════════════════════════════════════════════════════════════════ */

const DASAR = import.meta.env.BASE_URL;

type Layar = {
  no: string;
  berkas: string;
  judul: string;
  ket: string;
  aksen: string;
};

/* Urutannya BUKAN urutan menu, melainkan urutan cerita: yang paling dulu
   ditunjukkan adalah layar yang paling menjelaskan produk ini. Chart &
   Entry nomor satu karena di situlah replay dan penyusunan order terjadi —
   inti yang dijual. Lalu berpindah ke luar: apa yang dicari (Screener),
   siapa yang sedang bergerak (Wallet Tracking, Copy Signal), baru kembali
   ke dalam untuk apa yang tercatat (Dashboard, Journal, Personal Area).

   Kalau daftar ini diubah lagi, `no` harus ikut dinomori ulang: angkanya
   ditulis tangan, tidak diturunkan dari indeks, jadi menukar dua entri
   tanpa memperbaiki `no` akan menampilkan "03" di posisi pertama.

   ── DARI LIMA JADI DELAPAN, 6 Sep 2026 ──────────────────────────────────
   Diminta pemilik: tiga menu tumbuh sejak Agustus dan tidak satu pun pernah
   terlihat di halaman depan. Yang ditambahkan Wallet Tracking, Personal
   Area, dan Marketplace.

   Coin Hunter TIDAK ikut walau ia menu tersendiri. Layarnya minta login
   sebelum menampilkan apa pun, jadi yang bisa dipotret cuma tiga kotak
   kosong — dan kotak kosong di halaman jualan mengatakan hal yang salah
   tentang alat yang sebenarnya bekerja.

   Aksennya sengaja berjauhan di roda warna, bukan sekadar "delapan warna
   cerah": dua seksi berurutan dengan biru yang mirip terbaca sebagai satu
   seksi yang gambarnya berganti, bukan sebagai dua layar berbeda. */
const LAYAR: Layar[] = [
  {
    no: '01', berkas: 'chart', aksen: '#60a5fa',
    judul: 'Chart & Entry',
    /* ── SUBJEK KALIMATNYA PENGGUNA, BUKAN KAMI ─────────────────────────
       "Ordernya berangkat ke Binance…" tidak menyebut siapa yang mengirim,
       dan kalimat tanpa pelaku dibaca sebagai: aplikasi inilah yang
       menempatkan order. Itu keliru — kunci API, VPS, dan akun bursanya
       milik pengguna, dan kami tidak pernah memegang dana siapa pun.

       Bukan soal gaya bahasa. Xendit menolak pengajuan merchant 19 Agu 2026
       dengan alasan "data tidak valid atau tidak memenuhi syarat dalam bukti
       bisnis (website)", sementara KBLI di NIB kami 62199 — pemrograman
       komputer. Kalimat yang membuat kami terbaca sebagai pihak yang
       mengeksekusi order membenturkan situs dengan izinnya sendiri. */
    ket: 'Susun entry, SL, dan TP dengan menggeser garis, lalu kirim ordernya ke Binance, Hyperliquid, atau MetaTrader 5 — lewat API key dan VPS milikmu sendiri, bukan server kami.',
  },
  {
    no: '02', berkas: 'screener', aksen: '#ffcd75',
    judul: 'Screener Area',
    ket: 'Pindai ratusan pair sekaligus. Yang lolos saring muncul dengan alasannya, bukan cuma tanda panah.',
  },
  {
    no: '03', berkas: 'wallet', aksen: '#2dd4bf',
    judul: 'Wallet Tracking',
    ket: 'Puluhan ribu dompet Hyperliquid diperingkat dari hasil trading-nya sendiri — kelihatan siapa yang sedang pegang apa, dan sejak harga berapa.',
  },
  {
    no: '04', berkas: 'copy', aksen: '#c084fc',
    judul: 'Copy Signal',
    /* Yang ditawarkan AKSES KE ALAT PEMANTAUNYA. Sinyalnya ditulis pengguna
       lain, agen, atau dibaca dari dompet publik on-chain — kami tidak
       mengurasi dan tidak menjualnya. "Kamu yang pilih" menaruh keputusan di
       tempat yang benar. */
    ket: 'Sinyal dari analis lain, agen AI, dan dompet on-chain — kamu yang pilih siapa yang mau diikuti. Urutannya dari rekam jejak sinyalnya sendiri, bukan jumlah pengikut.',
  },
  {
    no: '05', berkas: 'dashboard', aksen: '#34d399',
    judul: 'Dashboard',
    ket: 'Saldo, winrate, dan profit factor dihitung dari transaksimu sendiri — bukan dari angka yang kami karang.',
  },
  {
    no: '06', berkas: 'jurnal', aksen: '#f472b6',
    judul: 'Journal',
    ket: 'Kurva ekuitas dan kalender P/L terisi sendiri dari MetaTrader 5 dan Binance. Tidak ada yang diketik ulang.',
  },
  {
    no: '07', berkas: 'personal', aksen: '#fb923c',
    judul: 'Personal Area',
    ket: 'Bukan cuma akun trading. Emas, saham, tabungan, sampai utang duduk di satu tempat — dan pos bertanda live ikut bergerak mengikuti harga.',
  },
  {
    no: '08', berkas: 'marketplace', aksen: '#a3e635',
    judul: 'Marketplace',
    ket: 'Indikator dan EA yang dipakai terminal ini. Yang Pine berjalan di mesin aplikasi ini sendiri — dipasang sekali, langsung tergambar di chart.',
  },
];

export default function TurLayar() {
  return (
    <FlowArt aria-label="Tur layar Jadi Trader Tools">
      {LAYAR.map((l) => (
        <FlowSection key={l.berkas} aria-label={l.judul} style={{ backgroundColor: '#09090b', color: '#fff' }}>
          <img
            src={`${DASAR}tangkapan/${l.berkas}.png`}
            alt={`Tampilan halaman ${l.judul}`}
            /* max-w-none WAJIB: preflight Tailwind memasang img { max-width:
               100% } yang mengalahkan w-full pada elemen berposisi absolut
               dan membuat gambarnya menyusut dari sisi kanan. */
            className="absolute inset-0 size-full max-w-none object-cover object-left-top"
            loading="lazy"
            decoding="async"
          />
          {/* Peneduh dari bawah supaya keterangan tetap terbaca di atas
              tangkapan layar yang isinya terang di beberapa tempat. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(9,9,11,0.94) 0%, rgba(9,9,11,0.72) 22%, rgba(9,9,11,0.05) 48%, transparent 70%)' }}
          />
          <div className="relative mt-auto">
            <p
              className="text-[clamp(9px,1.3vw,13px)] font-semibold uppercase tracking-[0.24em]"
              style={{ color: l.aksen }}
            >
              {l.no} — {l.judul}
            </p>
            <p className="mt-1.5 max-w-[52ch] text-[clamp(11px,1.7vw,17px)] leading-snug text-zinc-200">
              {l.ket}
            </p>
          </div>
        </FlowSection>
      ))}
    </FlowArt>
  );
}
