/* ════════════════════════════════════════════════════════════════════════
   NOTIFIKASI — tiga saluran yang sengaja dipisah
   ════════════════════════════════════════════════════════════════════════
   Lonceng, amplop, dan changelog terlihat mirip, tapi isinya tidak boleh
   dicampur. Sekali dicampur, orang berhenti membuka ketiganya:

     · NEWS      (lonceng) — kejadian PASAR. Hidup beberapa jam, lalu basi.
                 Yang membacanya sedang memutuskan entry, jadi urutannya
                 waktu, bukan kepentingan.
     · PESAN     (amplop)  — kejadian AKUN. Paket mau habis, VPS mati,
                 langganan gagal ditagih. Selalu punya satu tindakan jelas.
     · CHANGELOG (sidebar) — kejadian PRODUK. Tidak mendesak, tapi harus
                 bisa ditelusuri: nomor versi, tanggal, dan daftar butir.
   ════════════════════════════════════════════════════════════════════════ */

export interface Berita {
  id: string;
  dampak: 'tinggi' | 'sedang' | 'rendah';
  mata: string;
  waktu: string;
  judul: string;
  detail?: string;
  baru?: boolean;
}

/* Berita dampak tinggi ditaruh di atas hanya kalau waktunya juga paling
   dekat. Menaikkan berita lama karena "dampaknya tinggi" membuat orang
   membaca kabar kemarin sebagai kabar sekarang. */
/* SENGAJA KOSONG — dan ini yang paling penting dari ketiganya.
   ──────────────────────────────────────────────────────────────────────
   Dulu berisi enam berita contoh dengan waktu RELATIF yang ditulis mati:
   "CPI Amerika Serikat · 32 mnt lagi" tetap berbunyi "32 mnt lagi"
   selamanya, hari ini maupun tahun depan.

   Di aplikasi lain itu cuma tampilan yang basi. Di aplikasi TRADING itu
   informasi pasar yang salah: ada orang yang menahan entry karena mengira
   rilis CPI tinggal setengah jam lagi, atau justru masuk karena mengira
   "arus keluar ETF $214 juta" baru terjadi satu jam lalu. Angka-angka itu
   tidak pernah nyata sekali pun.

   Loncengnya tidak jadi kosong: kabar agen Pemburu Sinyal yang NYATA
   tetap tampil di sana (lihat `useKabarAgen` di app-shell). Kalender
   berita sungguhan bisa dipasang nanti dari sumber yang benar-benar
   hidup — sampai saat itu, tidak ada lebih jujur daripada palsu. */
export const NEWS: Berita[] = [];

export interface PesanAkun {
  id: string;
  jenis: 'peringatan' | 'kabar';
  judul: string;
  isi: string;
  aksi?: string;
  aksiKe?: string;
  waktu: string;
  baru?: boolean;
}

/* SENGAJA KOSONG.
   ──────────────────────────────────────────────────────────────────────
   Dulu berisi lima pesan contoh, dan tiap satunya salah untuk orang yang
   baru mendaftar hari ini:

     · "Paket Screener habis dalam 4 hari" — menakuti tanpa sebab; ia
       belum punya paket apa pun.
     · "Laporan Juli: 123 transaksi, winrate 51,2%" — itu angka ORANG
       LAIN, terbaca sebagai riwayatnya sendiri.
     · "VPS dipindah ke sslip.io" — bukan cuma basi, sekarang menyesatkan:
       alamatnya sudah jaditrader.co.id.

   Amplop ini tidak dibiarkan kosong: `app-shell` mengisinya dengan kabar
   PRIBADI yang nyata (berhasil masuk, akses disetujui) dari
   `lib/kabar-pribadi`. Kosong berarti memang belum ada yang terjadi — dan
   itu jawaban yang jujur, jauh lebih baik daripada panel ramai yang
   isinya tidak satu pun tentang orang yang sedang membacanya.

   Pengumuman produk sungguhan boleh masuk ke sini nanti, satu per satu,
   saat memang ada yang perlu diumumkan. */
export const PESAN: PesanAkun[] = [];

export interface ButirRilis {
  jenis: 'baru' | 'perbaikan' | 'peningkatan';
  teks: string;
}

export interface Rilis {
  versi: string;
  tanggal: string;
  judul: string;
  ringkas: string;
  sorotan?: string;
  butir: ButirRilis[];
}

/* Urutan: terbaru dulu. CHANGELOG[0] yang tampil di kotak sidebar. */
export const CHANGELOG: Rilis[] = [
  {
    versi: 'v3.5',
    tanggal: '23 Agustus 2026',
    judul: 'Ulasan yang bisa dijawab, laporan yang mengisi sendiri',
    ringkas: 'Suka dan balasan di Marketplace, Sales Report terbagi dua, dan pemasukan lisensi terhitung otomatis.',
    sorotan:
      'Dua hal yang selama ini dikerjakan tangan sekarang berjalan sendiri. Pemasukan dari lisensi berbayar tidak ' +
      'perlu dicatat ulang — ia terhitung langsung dari permintaan yang kamu setujui di Maintenance, memakai harga ' +
      'yang berlaku saat permintaannya dibuat. Dan ulasan di Marketplace berhenti jadi papan satu arah: siapa pun ' +
      'yang sudah masuk bisa menyukai dan membalasnya.',
    butir: [
      { jenis: 'baru', teks: 'Suka dan balasan di tiap ulasan Marketplace — terbuka untuk semua pengguna yang sudah masuk.' },
      { jenis: 'baru', teks: 'Saringan etalase: All Product, Premium, Indikator, EA MT5, dan Free, masing-masing membawa jumlahnya.' },
      { jenis: 'baru', teks: 'Sales Report dibagi dua: Cash Flow untuk uang masuk-keluar, Lisensi & Klien untuk siapa yang memakai.' },
      { jenis: 'baru', teks: 'Pemasukan lisensi terhitung sendiri dari Maintenance, lengkap dengan grafik pemasukan vs pengeluaran per bulan.' },
      { jenis: 'baru', teks: 'Aktivasi & Lisensi dipecah per tingkat — Gratis, Testing, Premium 3 Bulan, Tahunan, dan Produk Marketplace — masing-masing berwarna sendiri.' },
      { jenis: 'baru', teks: 'Pesan otomatis saat permintaan akses disetujui atau ditolak: sampai ke surel pemohon sekaligus tampil di halaman aksesnya.' },
      { jenis: 'baru', teks: 'Peraga cara kerja Supertrend di Marketplace — pita yang berpindah sisi saat tren berbalik.' },
      { jenis: 'baru', teks: 'Laporan bug dan saran pengguna pindah ke Maintenance → Error & Fixing, dengan saringan yang belum dibereskan.' },
      { jenis: 'peningkatan', teks: 'Nama indikator tidak lagi menutupi lilin — daftarnya kini di panel Indikator, lengkap dengan setelan input, buka kode, dan lepas.' },
      { jenis: 'peningkatan', teks: 'Panel akun menyebut nama paketmu, bukan cuma "Aktif", plus keterangan Copy Signal termasuk atau tidak.' },
      { jenis: 'peningkatan', teks: 'Kurva saldo di kartu analis digambar melengkung — mulus, tapi puncaknya tetap persis puncak datanya.' },
      { jenis: 'perbaikan', teks: 'Pembeli paket berbayar sempat dibaca sebagai pengguna gratis, sehingga Copy Signal terkunci untuk yang sudah membayar. Seluruh lisensi aktif diperbaiki.' },
      { jenis: 'perbaikan', teks: 'Kartu "Riwayat lebih lama" di chart berhenti melompat ke kanan saat chart digeser ke kiri.' },
      { jenis: 'perbaikan', teks: 'Catatan pemilik pada permintaan yang sudah diputus tidak pernah muncul kembali di panelnya — sekarang tersimpan dan terbaca.' },
      { jenis: 'perbaikan', teks: 'Halaman Marketplace jauh lebih hemat kuota: ulasan, suka, dan balasan tidak lagi diunduh seluruhnya tiap kunjungan.' },
    ],
  },
  {
    versi: 'v3.4',
    tanggal: '10 Agustus 2026',
    judul: 'Order sungguhan dari Area Entry',
    ringkas: 'Kirim order Binance langsung dari screener, lewat VPS sendiri — tanpa membuka aplikasi lain.',
    sorotan:
      'Sampai rilis ini, sinyal berhenti sebagai bacaan: kamu melihat entry, SL, dan TP, lalu pindah ke aplikasi ' +
      'lain untuk mengeksekusinya. Jeda pindah aplikasi itu yang paling sering mengubah rencana — harga bergerak, ' +
      'ukuran lot diubah "sedikit saja", SL ditarik lebih jauh. Sekarang order berangkat dari layar yang sama ' +
      'dengan yang menghitung levelnya.',
    butir: [
      { jenis: 'baru', teks: 'Tombol Open Real Order di Area Entry, mengirim MARKET/LIMIT ke Binance Futures lewat proxy VPS-mu sendiri.' },
      { jenis: 'baru', teks: 'Penjaga sambungan: tombol order ditolak dengan penjelasan kalau Backend URL atau App Token belum diisi.' },
      { jenis: 'baru', teks: 'Tutorial pemasangan lengkap di Integrations — dari membuat API key Binance sampai pm2 startup, dengan kode siap salin.' },
      { jenis: 'peningkatan', teks: 'Area Pantau kembali ke bentuk aslinya: ceklist saja. Entry, SL, dan TP hanya muncul di Parallel Signal.' },
      { jenis: 'perbaikan', teks: 'Peraga Parallel Channel di Marketplace sekarang benar-benar bergerak dan garis channel-nya sejajar.' },
    ],
  },
  {
    versi: 'v3.3',
    tanggal: '2 Agustus 2026',
    judul: 'Notifikasi dipisah tiga saluran',
    ringkas: 'Lonceng untuk berita pasar, amplop untuk kabar akun, changelog untuk pembaruan produk.',
    sorotan:
      'Satu ikon lonceng yang menampung semuanya membuat kabar "paket habis 4 hari lagi" tenggelam di antara ' +
      'enam berita pasar. Dipisah supaya yang mendesak tidak perlu bersaing dengan yang menarik.',
    butir: [
      { jenis: 'baru', teks: 'Lonceng berisi kalender berita dengan badge dampak tinggi/sedang/rendah.' },
      { jenis: 'baru', teks: 'Amplop berisi peringatan langganan, status VPS, dan kabar rilis — tiap butir punya satu tindakan.' },
      { jenis: 'baru', teks: 'Help Center langsung menuju WhatsApp, Discord, atau email.' },
      { jenis: 'peningkatan', teks: 'Popup berita tetap muncul saat membuka menu portofolio, jadi rilis besar tidak terlewat.' },
    ],
  },
  {
    versi: 'v3.2',
    tanggal: '24 Juli 2026',
    judul: 'Personal Area & Chart Backtest',
    ringkas: 'Pelacak portofolio rupiah dan editor indikator dengan chart lilin sendiri.',
    butir: [
      { jenis: 'baru', teks: 'Personal Area: aset, kewajiban, arus kas bulanan, dan perkembangan portofolio.' },
      { jenis: 'baru', teks: 'Chart & Backtest: chart lilin SVG, alat gambar, dan kotak editor Pine/MQL5.' },
      { jenis: 'peningkatan', teks: 'Journal memakai perhitungan saldo yang sama dengan Dashboard — tidak ada lagi dua angka berbeda.' },
    ],
  },
  {
    versi: 'v3.1',
    tanggal: '15 Juli 2026',
    judul: 'Sinyal Prioritas melebur ke Parallel Signal',
    ringkas: 'Tiga mode filter menggantikan dua section yang isinya tumpang tindih.',
    butir: [
      { jenis: 'peningkatan', teks: 'Mode Sinyal SNR H4, Sentuh SNR, dan Parallel Only dalam satu pemilih.' },
      { jenis: 'perbaikan', teks: 'Klik kartu sinyal membuka chart 4 jam, bukan 5 menit.' },
      { jenis: 'perbaikan', teks: 'Koin yang dihapus lewat klik kanan tidak muncul lagi saat dicari manual.' },
      { jenis: 'baru', teks: 'Sebelas simbol TradFi Binance (AAPL, NVDA, dan lainnya) masuk Area Pantau.' },
    ],
  },
];
