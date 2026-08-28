/* DIBUAT OTOMATIS oleh skrip/bangun-artikel.py — jangan disunting tangan.
   Sumbernya skrip/artikel-isi.py; berkas ini ditulis ULANG tiap kali artikel
   dibangun, jadi suntingan di sini hilang tanpa peringatan. */

export type BlokJenis = 'p' | 'h2' | 'ul' | 'ol' | 'catatan';

export interface Blok { jenis: BlokJenis; isi: string | string[] }

export interface Terkait { slug: string; judul: string; gambar: string }

export interface Artikel {
  slug: string; jenis: string; judul: string; ringkas: string;
  menit: number; gambar: string; isi: Blok[]; terkait: Terkait[];
}

export const ARTIKEL: Artikel[] = [
  {
    "slug": "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
    "jenis": "fitur",
    "judul": "Cara Menghubungkan MetaTrader 5 ke Jurnal Trading Otomatis",
    "ringkas": "Enam langkah memasang EA JadiTraderSync di MT5 supaya setiap transaksi masuk ke jurnal sendiri — tanpa menyalin satu baris pun dari riwayat.",
    "menit": 2,
    "gambar": "/artikel/gambar/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis.webp",
    "isi": [
      {
        "jenis": "p",
        "isi": "Mencatat jurnal dengan tangan gagal karena satu alasan yang sama pada semua orang: yang paling perlu dicatat justru transaksi yang paling malas dicatat. Trade yang rugi, yang diambil karena FOMO, yang SL-nya digeser — itu yang hilang dari catatan, dan itu juga yang seharusnya dibaca ulang."
      },
      {
        "jenis": "p",
        "isi": "Jalan keluarnya bukan disiplin yang lebih keras, tapi mencabut langkah menyalinnya. MetaTrader 5 bisa mengirim sendiri tiap transaksi yang tertutup ke jurnal, lewat sebuah Expert Advisor."
      },
      {
        "jenis": "h2",
        "isi": "Yang perlu disiapkan"
      },
      {
        "jenis": "ul",
        "isi": [
          "MetaTrader 5 di komputer (bukan aplikasi ponsel — EA hanya jalan di terminal desktop)",
          "Akun di jaditrader.co.id, untuk mengambil kode pasangan",
          "Berkas JadiTraderSync.ex5, sekitar 36 KB"
        ]
      },
      {
        "jenis": "h2",
        "isi": "Enam langkah"
      },
      {
        "jenis": "ol",
        "isi": [
          "<b>Unduh berkasnya.</b> Ambil JadiTraderSync.ex5 dari halaman Integrations.",
          "<b>Buka folder data MT5.</b> Di MetaTrader 5 pilih <code>File → Open Data Folder</code>, lalu masuk ke <code>MQL5\\Experts</code> dan salin berkas .ex5 ke situ. Jangan mencarinya lewat Windows Explorer — tiap terminal MT5 punya folder datanya sendiri di lokasi yang panjang dan acak.",
          "<b>Segarkan daftar EA.</b> Di panel Navigator (Ctrl+N), klik kanan <code>Expert Advisors → Refresh</code>. JadiTraderSync muncul di daftar. Kalau belum, tutup dan buka lagi MT5-nya.",
          "<b>Izinkan alamat server.</b> <code>Tools → Options → Expert Advisors</code>, centang <code>Allow WebRequest for listed URL</code>, lalu tambahkan alamat server yang tertulis di halaman Integrations. Salin persis, tanpa garis miring di ujung — MT5 mencocokkannya huruf per huruf, dan satu karakter beda membuat EA gagal tanpa pesan yang menjelaskan.",
          "<b>Seret ke chart mana pun.</b> Chart apa saja, timeframe apa saja: EA ini tidak membaca harga, jadi pilihan chart tidak berpengaruh. Di tab <code>Common</code> centang <code>Allow Algo Trading</code>.",
          "<b>Isi dua input.</b> Di tab <code>Inputs</code> ada dua yang wajib: <code>AlamatServer</code> (alamat yang sama dengan langkah 4) dan <code>KodePasangan</code> (kode dari halaman Integrations, bentuknya seperti JTM5-XXXX-XXXX). Lalu OK."
        ]
      },
      {
        "jenis": "catatan",
        "isi": "Pastikan tombol <b>Algo Trading</b> di toolbar MT5 berwarna hijau. Kalau merah, EA-nya terpasang tapi tidak berjalan sama sekali — dan tidak ada pesan galat yang memberitahumu."
      },
      {
        "jenis": "h2",
        "isi": "Kalau jurnalnya tetap kosong"
      },
      {
        "jenis": "ul",
        "isi": [
          "<b>Tab Experts menampilkan \"WebRequest ... 4060\"</b> — alamat server belum masuk daftar izin, atau ada bedanya satu karakter. Ulangi langkah 4.",
          "<b>EA tersambung tapi jurnal tidak terisi</b> — WebRequest belum diizinkan, atau alamat server belum ditambahkan ke daftar putih MT5.",
          "<b>Tombol Algo Trading merah</b> — klik sekali supaya hijau."
        ]
      },
      {
        "jenis": "h2",
        "isi": "Apakah EA ini bisa membuka posisi?"
      },
      {
        "jenis": "p",
        "isi": "Tidak, dan itu bisa kamu periksa sendiri alih-alih mempercayainya. Kode sumber EA-nya dibuka di Marketplace: cari <code>OrderSend</code> di dalamnya — perintah itu satu-satunya cara MQL5 mengirim order, dan ia tidak ada di sana. EA ini hanya membaca riwayat lalu mengirimkannya."
      },
      {
        "jenis": "p",
        "isi": "Sambungan MT5 dan sambungan Binance sengaja dipisah karena sifat risikonya berbeda jauh: MT5 hanya mengirim data, Binance mengeksekusi order dengan uang sungguhan."
      }
    ],
    "terkait": [
      {
        "slug": "cara-membuat-api-key-binance-yang-aman",
        "judul": "Cara Membuat API Key Binance yang Aman untuk Screener dan Chart",
        "gambar": "/artikel/gambar/cara-membuat-api-key-binance-yang-aman.webp"
      },
      {
        "slug": "akun-sen-mt5-jurnal-seratus-kali-lipat",
        "judul": "Akun Sen di MT5 Bisa Membuat Jurnalmu Terlihat 100× Lebih Untung",
        "gambar": "/artikel/gambar/akun-sen-mt5-jurnal-seratus-kali-lipat.webp"
      }
    ]
  },
  {
    "slug": "cara-membuat-api-key-binance-yang-aman",
    "jenis": "fitur",
    "judul": "Cara Membuat API Key Binance yang Aman untuk Screener dan Chart",
    "ringkas": "Satu centang yang tidak boleh diaktifkan, kenapa API key tidak pernah masuk ke peramban, dan apa bedanya dengan App Token.",
    "menit": 2,
    "gambar": "/artikel/gambar/cara-membuat-api-key-binance-yang-aman.webp",
    "isi": [
      {
        "jenis": "p",
        "isi": "API key Binance itu kunci rumah. Ia dibuat sekali, ditempel sekali, lalu dilupakan — dan justru karena dilupakan itulah ia berbahaya. Halaman ini soal cara membuatnya sehingga kalaupun bocor, kerugiannya terbatas."
      },
      {
        "jenis": "h2",
        "isi": "Satu centang yang menentukan segalanya"
      },
      {
        "jenis": "p",
        "isi": "Saat membuat API key di Binance, <b>jangan centang Withdraw</b>. Kalaupun key-nya bocor, penerimanya tidak bisa menarik saldomu ke mana pun. Ini bukan saran kehati-hatian umum — ini beda antara kehilangan kendali order dan kehilangan uangnya."
      },
      {
        "jenis": "catatan",
        "isi": "Aturan yang sama berlaku untuk kunci apa pun yang kamu buat di bursa mana pun: berikan izin sesempit yang dibutuhkan alatnya, bukan seluas yang diizinkan bursanya."
      },
      {
        "jenis": "h2",
        "isi": "Kenapa perlu VPS sendiri"
      },
      {
        "jenis": "p",
        "isi": "Binance diblokir sebagian ISP Indonesia. Permintaan dari peramban di jaringan itu tidak pernah sampai, dan gejalanya membingungkan: chart kosong, screener tidak mengisi, tanpa pesan galat yang jelas."
      },
      {
        "jenis": "p",
        "isi": "Karena itu permintaannya dilewatkan proxy di server di luar jaringan tersebut. Konsekuensinya sekaligus keuntungannya: API key-nya tinggal di berkas <code>.env</code> di VPS milikmu sendiri, dan tidak pernah dikirim ke peramban, ke situs ini, atau ke mana pun."
      },
      {
        "jenis": "h2",
        "isi": "App Token bukan API key"
      },
      {
        "jenis": "p",
        "isi": "Dua hal ini sering tertukar, padahal fungsinya berlawanan arah:"
      },
      {
        "jenis": "ul",
        "isi": [
          "<b>API key Binance</b> — kunci antara VPS-mu dan Binance. Hanya ada di VPS. Tidak pernah keluar dari sana.",
          "<b>App Token</b> — kata sandi 64 karakter antara peramban dan VPS-mu. Ia yang membuktikan bahwa yang memerintah adalah kamu."
        ]
      },
      {
        "jenis": "p",
        "isi": "Siapa pun yang memegang App Token bisa membuka dan menutup posisi di akunmu. Perlakukan seperti kata sandi, bukan seperti alamat."
      },
      {
        "jenis": "catatan",
        "isi": "Backend URL dan App Token tersimpan di perangkat yang kamu pakai saja — keduanya tidak pernah dikirim ke server kami."
      },
      {
        "jenis": "h2",
        "isi": "Yang tidak pernah kami simpan"
      },
      {
        "jenis": "ul",
        "isi": [
          "API key dan secret Binance",
          "Nomor kartu",
          "Kata sandi MT5 dan kata sandi investor"
        ]
      },
      {
        "jenis": "p",
        "isi": "Yang disimpan: email, status langganan, dan riwayat transaksi yang dikirim EA."
      },
      {
        "jenis": "h2",
        "isi": "Kalau data pasar tetap tidak masuk"
      },
      {
        "jenis": "p",
        "isi": "Ganti DNS bisa menolong sementara, tapi yang andal tetap proxy VPS yang diatur di halaman Integrations. Tutorial lengkapnya — dari membuat API key sampai <code>pm2 startup</code>, dengan perintah siap salin — ada di sana."
      }
    ],
    "terkait": [
      {
        "slug": "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
        "judul": "Cara Menghubungkan MetaTrader 5 ke Jurnal Trading Otomatis",
        "gambar": "/artikel/gambar/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis.webp"
      },
      {
        "slug": "kenapa-data-binance-tidak-masuk-di-indonesia",
        "judul": "Kenapa Data Binance Tidak Masuk di Indonesia, dan Cara Mengatasinya",
        "gambar": "/artikel/gambar/kenapa-data-binance-tidak-masuk-di-indonesia.webp"
      }
    ]
  },
  {
    "slug": "kenapa-data-binance-tidak-masuk-di-indonesia",
    "jenis": "fitur",
    "judul": "Kenapa Data Binance Tidak Masuk di Indonesia, dan Cara Mengatasinya",
    "ringkas": "Chart kosong dan screener yang tidak mengisi biasanya bukan bug aplikasi — melainkan blokir di jaringan ISP-mu.",
    "menit": 1,
    "gambar": "/artikel/gambar/kenapa-data-binance-tidak-masuk-di-indonesia.webp",
    "isi": [
      {
        "jenis": "p",
        "isi": "Gejalanya khas: aplikasinya terbuka normal, tombolnya jalan, tapi chart kripto kosong dan screener tidak pernah selesai memuat. Tidak ada pesan galat yang menjelaskan, karena dari sudut pandang peramban permintaannya memang tidak ditolak — ia cuma tidak pernah dijawab."
      },
      {
        "jenis": "h2",
        "isi": "Sebabnya di jaringan, bukan di aplikasi"
      },
      {
        "jenis": "p",
        "isi": "Binance diblokir sebagian ISP di Indonesia. Selama permintaan berangkat dari jaringan itu, ia tidak akan sampai — dan mengganti aplikasi, peramban, atau perangkat tidak mengubah apa pun."
      },
      {
        "jenis": "h2",
        "isi": "Dua cara, dan yang kedua yang bertahan"
      },
      {
        "jenis": "ul",
        "isi": [
          "<b>Ganti DNS.</b> Paling cepat dicoba dan kadang cukup. Tapi ia bergantung pada bagaimana ISP-mu memblokir, jadi bisa berhenti bekerja kapan saja tanpa pemberitahuan.",
          "<b>Proxy lewat VPS sendiri.</b> Permintaannya berangkat dari server di luar jaringan yang memblokir. Lebih repot dipasang sekali, lalu tidak perlu dipikirkan lagi."
        ]
      },
      {
        "jenis": "p",
        "isi": "Cara kedua punya efek samping yang justru bagus: API key Binance-mu tinggal di VPS itu, tidak pernah masuk ke peramban."
      },
      {
        "jenis": "catatan",
        "isi": "Untuk order sungguhan, proxy VPS bukan pilihan melainkan syarat. Eksekusi order sengaja dikunci sampai VPS-nya terpasang."
      }
    ],
    "terkait": [
      {
        "slug": "cara-membuat-api-key-binance-yang-aman",
        "judul": "Cara Membuat API Key Binance yang Aman untuk Screener dan Chart",
        "gambar": "/artikel/gambar/cara-membuat-api-key-binance-yang-aman.webp"
      },
      {
        "slug": "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
        "judul": "Cara Menghubungkan MetaTrader 5 ke Jurnal Trading Otomatis",
        "gambar": "/artikel/gambar/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis.webp"
      }
    ]
  },
  {
    "slug": "akun-sen-mt5-jurnal-seratus-kali-lipat",
    "jenis": "fitur",
    "judul": "Akun Sen di MT5 Bisa Membuat Jurnalmu Terlihat 100× Lebih Untung",
    "ringkas": "Kenapa akun cent perlu diperlakukan berbeda, dan bagaimana saldo, swap, komisi, serta winrate gabungan dihitung.",
    "menit": 1,
    "gambar": "/artikel/gambar/akun-sen-mt5-jurnal-seratus-kali-lipat.webp",
    "isi": [
      {
        "jenis": "p",
        "isi": "Akun sen memakai satuan yang seratus kali lebih kecil dari akun biasa. Kalau angkanya masuk jurnal apa adanya, seluruh riwayatmu terbaca seratus kali lebih untung dari kenyataan — dan yang berbahaya bukan angkanya, melainkan keputusan yang kamu ambil dari angka itu."
      },
      {
        "jenis": "p",
        "isi": "Akun sen dideteksi dari mata uang akun MT5, lalu dibagi 100 sebelum masuk jurnal."
      },
      {
        "jenis": "h2",
        "isi": "Saldo dihitung dari transaksi yang sudah selesai"
      },
      {
        "jenis": "p",
        "isi": "Saldo di Dashboard dan Journal berasal dari satu sumber: saldo awal ditambah seluruh P/L yang sudah direalisasi. Posisi yang masih terbuka tidak ikut — ia tampil terpisah sebagai floating."
      },
      {
        "jenis": "p",
        "isi": "Alasannya sederhana: mencampur keduanya membuat kurva ekuitas berubah tiap detik tanpa ada satu pun transaksi yang benar-benar terjadi. Kurva yang bergerak sendiri tidak bisa dipakai menilai apa pun."
      },
      {
        "jenis": "h2",
        "isi": "Swap dan komisi masuk ke dalam P/L"
      },
      {
        "jenis": "p",
        "isi": "Keduanya dihitung ke dalam P/L tiap transaksi, bukan dijadikan baris sendiri. Jadi angka yang kamu lihat adalah yang benar-benar masuk atau keluar dari akun, bukan angka kotor sebelum biaya."
      },
      {
        "jenis": "h2",
        "isi": "Winrate gabungan memakai jumlah transaksi"
      },
      {
        "jenis": "p",
        "isi": "Forex dan kripto disimpan terpisah lalu digabung saat ditampilkan. Winrate gabungannya dihitung dari jumlah transaksi, <b>bukan</b> rata-rata dua winrate."
      },
      {
        "jenis": "p",
        "isi": "Bedanya besar: 9 dari 10 trade forex menang dan 1 dari 90 trade kripto menang bukan berarti winrate-mu 50%. Rata-rata dua persentase menyembunyikan bahwa hampir semua transaksimu ada di sisi yang kalah."
      },
      {
        "jenis": "h2",
        "isi": "Kolom emosi tidak memengaruhi angka"
      },
      {
        "jenis": "p",
        "isi": "Kolom emosi dan alasan entry diisi manual, dan sengaja tidak dipakai menghitung apa pun. Gunanya muncul belakangan — saat pola \"entry karena FOMO\" sudah cukup banyak untuk dijumlahkan."
      }
    ],
    "terkait": [
      {
        "slug": "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
        "judul": "Cara Menghubungkan MetaTrader 5 ke Jurnal Trading Otomatis",
        "gambar": "/artikel/gambar/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis.webp"
      }
    ]
  },
  {
    "slug": "cara-memasang-indikator-pine-di-tradingview",
    "jenis": "fitur",
    "judul": "Cara Memasang Indikator Pine di TradingView (dan Satu Sebab Gagal yang Paling Sering)",
    "ringkas": "Menempel kode Pine, menyimpannya ke favorit, dan kenapa indikator v6 tidak mau dikompilasi di layout lama.",
    "menit": 1,
    "gambar": "/artikel/gambar/cara-memasang-indikator-pine-di-tradingview.webp",
    "isi": [
      {
        "jenis": "p",
        "isi": "Indikator Pine dipasang lewat Pine Editor di TradingView. Prosesnya pendek, dan satu-satunya langkah yang sering dilewati justru yang membuatnya berguna besok."
      },
      {
        "jenis": "h2",
        "isi": "Langkahnya"
      },
      {
        "jenis": "ol",
        "isi": [
          "Buka <code>Pine Editor</code> di bagian bawah layar TradingView.",
          "Tempel kode indikatornya.",
          "Klik <code>Add to chart</code>.",
          "<b>Simpan ke favorit.</b> Tanpa ini, indikatornya hanya menempel di layout yang sedang terbuka, dan besok kamu harus menempel ulang."
        ]
      },
      {
        "jenis": "h2",
        "isi": "Kalau gagal dikompilasi, cek versinya"
      },
      {
        "jenis": "p",
        "isi": "Versi Pine tertulis di kartu tiap produk. Indikator v6 <b>tidak bisa</b> dikompilasi di layout yang masih dikunci ke v5 — dan pesan galatnya biasanya menunjuk baris kode, bukan menyebut versinya, sehingga mudah disalahartikan sebagai kode yang rusak."
      },
      {
        "jenis": "h2",
        "isi": "Indikator dan Expert Advisor itu dua hal berbeda"
      },
      {
        "jenis": "ul",
        "isi": [
          "<b>Jadi Trader V3</b> — overlay: channel, duplikat channel 1 & 2, zona SNR multi-timeframe, dan sinyal BUY/SELL.",
          "<b>Stochastic Momentum Index</b> — panel terpisah, SMI yang sama dengan yang dipakai Area Pantau.",
          "<b>News &amp; GAP Hunter V2</b> — overlay untuk XAUUSD dan forex.",
          "<b>JadiTraderSync</b> — ini <b>EA MT5</b>, bukan indikator TradingView. Tempatnya di <code>MQL5/Experts</code>, bukan di Pine Editor."
        ]
      },
      {
        "jenis": "catatan",
        "isi": "Kesalahan yang sering terjadi: mencoba menempel EA MT5 ke Pine Editor. Keduanya bahasa yang berbeda dan platform yang berbeda."
      }
    ],
    "terkait": [
      {
        "slug": "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
        "judul": "Cara Menghubungkan MetaTrader 5 ke Jurnal Trading Otomatis",
        "gambar": "/artikel/gambar/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis.webp"
      }
    ]
  }
];
