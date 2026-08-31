/* DIBUAT OTOMATIS oleh skrip/bangun-artikel.py — jangan disunting tangan.
   Sumbernya skrip/artikel-isi.py; berkas ini ditulis ULANG tiap kali artikel
   dibangun, jadi suntingan di sini hilang tanpa peringatan. */

export type BlokJenis = 'p' | 'h2' | 'ul' | 'ol' | 'catatan' | 'gambar';

/* Untuk 'gambar', isi berbentuk [berkas, keterangan] — dua unsur,
   bukan daftar butir seperti pada 'ul'/'ol'. */

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
    "menit": 3,
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
        "jenis": "gambar",
        "isi": [
          "mt5-langkah-3-navigator.webp",
          "Langkah 3 — panel Navigator sesudah disegarkan. <b>JadiTraderSync</b> muncul di bawah daftar Expert Advisors. Kalau belum ada di situ, berkas .ex5-nya belum masuk ke folder yang benar dan langkah 2 perlu diulang."
        ]
      },
      {
        "jenis": "gambar",
        "isi": [
          "mt5-langkah-4-webrequest.webp",
          "Langkah 4 — <code>Tools &rarr; Options &rarr; Experts</code>. Yang wajib: <b>Allow WebRequest for listed URL</b> tercentang, dan alamat servernya ada di daftar. Dua baris di atasnya sengaja ditutup karena itu isi daftar milik akun contoh; punyamu akan berbeda."
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
        "jenis": "gambar",
        "isi": [
          "tradingview-langkah-4-favorit.webp",
          "Langkah 4 — tombol <code>Indicators</code> di toolbar atas, lalu <b>Favorites</b>. Indikator yang bintangnya sudah terisi akan selalu ada di daftar ini, di layout mana pun kamu membukanya. Yang belum difavoritkan cuma menempel di layout yang sedang terbuka."
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
  },
  {
    "slug": "cara-membuat-jurnal-trading-di-excel",
    "jenis": "edukasi",
    "judul": "Cara Membuat Jurnal Trading di Excel (dan Kapan Excel Mulai Merepotkan)",
    "ringkas": "Kolom apa saja yang wajib ada, rumus winrate dan profit factor yang benar, dan tiga hal yang membuat jurnal Excel berhenti diisi.",
    "menit": 2,
    "gambar": "/artikel/gambar/cara-membuat-jurnal-trading-di-excel.webp",
    "isi": [
      {
        "jenis": "p",
        "isi": "Jurnal trading di Excel itu titik awal yang benar. Gratis, seluruhnya kamu yang pegang, dan tidak ada yang perlu didaftarkan. Halaman ini soal cara membuatnya supaya betul-betul terpakai — dan soal titik di mana Excel biasanya mulai ditinggalkan."
      },
      {
        "jenis": "h2",
        "isi": "Kolom yang wajib ada"
      },
      {
        "jenis": "p",
        "isi": "Jurnal gagal bukan karena kolomnya kurang, tapi karena kolomnya terlalu banyak. Sepuluh ini sudah cukup untuk menjawab hampir semua pertanyaan yang nanti kamu ajukan ke diri sendiri:"
      },
      {
        "jenis": "ol",
        "isi": [
          "<b>Tanggal &amp; jam entry</b> — jam penting; banyak orang baru sadar rugi terbesarnya menumpuk di jam tertentu.",
          "<b>Pair / simbol</b>",
          "<b>Arah</b> — buy atau sell.",
          "<b>Lot</b>",
          "<b>Harga entry</b>",
          "<b>Stop loss</b> — diisi <i>sebelum</i> posisi jalan, bukan sesudah.",
          "<b>Take profit</b>",
          "<b>Harga exit</b>",
          "<b>P/L bersih</b> — sesudah swap dan komisi, bukan angka kotor.",
          "<b>Alasan entry</b> — satu kalimat. Ini kolom yang paling sering dikosongkan, dan paling berguna waktu dibaca ulang sebulan kemudian."
        ]
      },
      {
        "jenis": "catatan",
        "isi": "Kolom <b>emosi</b> boleh ditambah, tapi jangan dijadikan angka. Gunanya muncul belakangan — saat pola \"entry karena takut ketinggalan\" sudah cukup banyak untuk dijumlahkan."
      },
      {
        "jenis": "h2",
        "isi": "Rumus yang sering salah"
      },
      {
        "jenis": "p",
        "isi": "Dua angka ini yang paling sering dihitung keliru, dan keduanya menyesatkan ke arah yang sama: membuat hasilmu terlihat lebih baik dari kenyataan."
      },
      {
        "jenis": "p",
        "isi": "<b>Winrate.</b> Kalau kolom P/L ada di <code>I</code>, winrate-nya <code>=COUNTIF(I:I,\">0\")/COUNT(I:I)</code>. Yang sering terjadi: pembaginya dipakai <code>COUNTA</code>, dan baris kosong ikut terhitung sebagai transaksi."
      },
      {
        "jenis": "p",
        "isi": "<b>Profit factor.</b> Total untung dibagi total rugi: <code>=SUMIF(I:I,\">0\")/ABS(SUMIF(I:I,\"&lt;0\"))</code>. Angka ini lebih jujur daripada winrate. Winrate 80% dengan profit factor 0,7 berarti kamu sering menang kecil dan sesekali kalah besar — dan akunnya tetap habis."
      },
      {
        "jenis": "p",
        "isi": "<b>Kalau akunmu akun cent</b>, seluruh angka P/L harus dibagi 100 sebelum masuk jurnal. Kalau tidak, riwayatmu terbaca seratus kali lebih untung dari kenyataan."
      },
      {
        "jenis": "h2",
        "isi": "Tiga hal yang membuat jurnal Excel berhenti diisi"
      },
      {
        "jenis": "ul",
        "isi": [
          "<b>Pengisiannya manual.</b> Sesudah trade ke-30, mengetik ulang sepuluh kolom terasa seperti pekerjaan. Yang pertama dilewati biasanya trade yang rugi — dan itu justru yang paling perlu dicatat.",
          "<b>Diisi dari ingatan.</b> Dicatat malam hari, dari yang teringat. Ingatan memihak diri sendiri: yang menang diingat lengkap, yang kalah diingat samar.",
          "<b>Tidak pernah dibaca ulang.</b> Berkas terisi rapi selama tiga bulan, lalu tidak pernah dibuka lagi. Jurnal yang tidak dibaca sama saja dengan jurnal yang tidak ada."
        ]
      },
      {
        "jenis": "h2",
        "isi": "Kapan Excel sudah tidak cukup"
      },
      {
        "jenis": "p",
        "isi": "Selama kamu masih rutin mengisinya, Excel tidak perlu diganti. Penggantinya baru masuk akal kalau yang berhenti adalah pengisiannya, bukan tradingnya."
      },
      {
        "jenis": "p",
        "isi": "Bedanya cuma satu: dari mana datanya datang. Di Excel kamu yang mengetik; kalau terminalmu yang mengirim sendiri tiap transaksi tertutup, kolom angkanya tidak pernah bolong dan tidak pernah dibulatkan oleh ingatan. Yang tersisa buatmu cuma kolom alasan entry — satu kalimat yang memang cuma kamu yang tahu."
      }
    ],
    "terkait": [
      {
        "slug": "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
        "judul": "Cara Menghubungkan MetaTrader 5 ke Jurnal Trading Otomatis",
        "gambar": "/artikel/gambar/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis.webp"
      },
      {
        "slug": "akun-sen-mt5-jurnal-seratus-kali-lipat",
        "judul": "Akun Sen di MT5 Bisa Membuat Jurnalmu Terlihat 100× Lebih Untung",
        "gambar": "/artikel/gambar/akun-sen-mt5-jurnal-seratus-kali-lipat.webp"
      }
    ]
  },
  {
    "slug": "cara-backtest-strategi-trading-gratis",
    "jenis": "edukasi",
    "judul": "Cara Backtest Strategi Trading Gratis di TradingView dan MT5",
    "ringkas": "Tiga cara backtest tanpa bayar, batas masing-masing, dan sebab paling sering hasil backtest jauh lebih bagus daripada hasil live.",
    "menit": 2,
    "gambar": "/artikel/gambar/cara-backtest-strategi-trading-gratis.webp",
    "isi": [
      {
        "jenis": "p",
        "isi": "Backtest itu menguji aturan entry-mu pada harga yang sudah lewat. Tujuannya bukan mencari strategi yang menang terus — tapi mengetahui seperti apa rasanya kalah beruntun sebelum uang sungguhan ikut."
      },
      {
        "jenis": "h2",
        "isi": "1. Replay chart — paling jujur, paling lambat"
      },
      {
        "jenis": "p",
        "isi": "Chart dimundurkan ke tanggal tertentu, lalu dimajukan satu lilin sekali. Kamu memutuskan tanpa bisa melihat lilin berikutnya."
      },
      {
        "jenis": "p",
        "isi": "Ini satu-satunya cara yang menguji <b>kamu</b>, bukan cuma aturannya. Backtest yang dilihat sekaligus dari kanan ke kiri selalu terlihat gampang, karena matamu sudah tahu ke mana harga pergi."
      },
      {
        "jenis": "p",
        "isi": "Di TradingView fiturnya bernama <code>Bar Replay</code> dan tersedia di paket gratis dengan batas: timeframe harian ke atas saja. Untuk intraday ia berbayar."
      },
      {
        "jenis": "h2",
        "isi": "2. Strategy Tester MT5 — paling cepat, paling gampang menipu"
      },
      {
        "jenis": "p",
        "isi": "Kalau aturanmu sudah berbentuk EA, MT5 bisa menjalankan lima tahun data dalam hitungan menit lewat <code>View &rarr; Strategy Tester</code>. Gratis, dan datanya diambil dari brokermu sendiri."
      },
      {
        "jenis": "p",
        "isi": "Tiga hal yang membuat hasilnya terlalu bagus, dan ketiganya diam:"
      },
      {
        "jenis": "ul",
        "isi": [
          "<b>Model \"Open prices only\"</b> — paling cepat, dan paling jauh dari kenyataan. Pakai <code>Every tick based on real ticks</code>.",
          "<b>Spread tetap.</b> Bawaannya spread ideal. Di jam berita spread melebar, dan justru di situ banyak SL tersentuh.",
          "<b>Komisi dan swap tidak ikut</b> kalau simbolnya tidak diatur seperti akun sungguhanmu."
        ]
      },
      {
        "jenis": "h2",
        "isi": "3. Backtest manual di Excel — paling merepotkan, paling dimengerti"
      },
      {
        "jenis": "p",
        "isi": "Gulir chart ke belakang, catat tiap setup yang memenuhi aturanmu ke spreadsheet, lalu hitung hasilnya. Lambat, tapi kamu jadi hafal seperti apa setupmu terlihat — dan itu tidak didapat dari laporan yang dihasilkan mesin."
      },
      {
        "jenis": "h2",
        "isi": "Kenapa backtest bagus tapi live babak belur"
      },
      {
        "jenis": "p",
        "isi": "Hampir selalu satu dari empat ini, dan tidak satu pun berhubungan dengan strateginya:"
      },
      {
        "jenis": "ol",
        "isi": [
          "<b>Kamu tahu masa depannya.</b> Waktu backtest, lilin sesudahnya sudah ada di layar. Otak memakainya tanpa kamu sadari.",
          "<b>Aturannya berubah di tengah jalan.</b> Sesudah tiga kali kalah beruntun, ambangnya digeser sedikit. Di backtest penggeseran itu tidak tercatat di mana pun.",
          "<b>Biaya tidak dihitung.</b> Spread, komisi, dan swap kecil per transaksi, tapi seratus transaksi kemudian ia bukan angka kecil lagi.",
          "<b>Lotnya berbeda.</b> Di backtest lot tetap. Di live lot dinaikkan waktu yakin dan diturunkan waktu takut — dan itu strategi yang berbeda dari yang diuji."
        ]
      },
      {
        "jenis": "catatan",
        "isi": "Aturan praktis: backtest yang tidak pernah menunjukkan periode rugi beruntun bukan strategi bagus, melainkan backtest yang salah. Setiap strategi punya periode buruk; kalau tidak kelihatan, artinya periode itu belum diuji."
      }
    ],
    "terkait": [
      {
        "slug": "cara-memasang-indikator-pine-di-tradingview",
        "judul": "Cara Memasang Indikator Pine di TradingView (dan Satu Sebab Gagal yang Paling Sering)",
        "gambar": "/artikel/gambar/cara-memasang-indikator-pine-di-tradingview.webp"
      },
      {
        "slug": "cara-membuat-jurnal-trading-di-excel",
        "judul": "Cara Membuat Jurnal Trading di Excel (dan Kapan Excel Mulai Merepotkan)",
        "gambar": "/artikel/gambar/cara-membuat-jurnal-trading-di-excel.webp"
      }
    ]
  },
  {
    "slug": "cara-pasang-ea-di-mt5-pc-dan-android",
    "jenis": "edukasi",
    "judul": "Cara Pasang EA di MT5 (dan Kenapa Tidak Bisa di Android atau iPhone)",
    "ringkas": "Langkah memasang Expert Advisor di MT5 desktop, dan jawaban jujur untuk pertanyaan yang paling sering muncul soal HP.",
    "menit": 2,
    "gambar": "/artikel/gambar/cara-pasang-ea-di-mt5-pc-dan-android.webp",
    "isi": [
      {
        "jenis": "p",
        "isi": "Pertanyaan ini muncul terus dengan dua bentuk: cara memasangnya di PC, dan cara memasangnya di HP. Yang kedua jawabannya pendek, dan lebih baik diketahui sekarang daripada sesudah dua jam mencari."
      },
      {
        "jenis": "h2",
        "isi": "Di Android dan iPhone: tidak bisa, dan bukan karena salah setelan"
      },
      {
        "jenis": "p",
        "isi": "Aplikasi MetaTrader 5 untuk Android dan iOS <b>tidak menjalankan EA sama sekali</b>. Bukan disembunyikan di menu, bukan perlu izin tambahan — memang tidak ada. Aplikasi HP dibuat untuk melihat chart dan mengirim order manual."
      },
      {
        "jenis": "p",
        "isi": "Jadi kalau kamu mencari menu <code>Experts</code> di aplikasi HP dan tidak ketemu, tidak ada yang salah dengan HP-mu."
      },
      {
        "jenis": "p",
        "isi": "Yang sebenarnya dilakukan orang yang \"menjalankan EA dari HP\": EA-nya jalan di MT5 desktop pada sebuah VPS yang menyala 24 jam, dan HP cuma dipakai memantau. Itu dua hal yang berbeda."
      },
      {
        "jenis": "h2",
        "isi": "Di PC: enam langkah"
      },
      {
        "jenis": "ol",
        "isi": [
          "Buka <code>File &rarr; Open Data Folder</code>. Jangan mencarinya lewat Windows Explorer — tiap terminal MT5 punya foldernya sendiri di lokasi yang panjang dan acak.",
          "Masuk ke <code>MQL5\\Experts</code>, salin berkas <code>.ex5</code> atau <code>.mq5</code> ke situ.",
          "Kembali ke MT5, buka Navigator dengan <code>Ctrl+N</code>, klik kanan <code>Expert Advisors &rarr; Refresh</code>.",
          "Seret nama EA-nya ke chart mana pun.",
          "Di tab <code>Common</code>, centang <code>Allow Algo Trading</code>.",
          "Pastikan tombol <b>Algo Trading</b> di toolbar berwarna hijau."
        ]
      },
      {
        "jenis": "catatan",
        "isi": "Kalau EA-nya perlu menghubungi alamat internet, alamat itu wajib dimasukkan ke <code>Tools &rarr; Options &rarr; Experts &rarr; Allow WebRequest for listed URL</code>. Tanpa itu EA berjalan tapi tidak mengirim apa-apa, dan tidak ada pesan galat yang menjelaskan."
      },
      {
        "jenis": "h2",
        "isi": "Beda .mq5 dan .ex5"
      },
      {
        "jenis": "ul",
        "isi": [
          "<code>.ex5</code> — sudah dikompilasi, tinggal pakai. Kodenya tidak bisa dibaca.",
          "<code>.mq5</code> — kode sumbernya. Perlu dibuka di MetaEditor dan ditekan <code>Compile</code> dulu sampai menghasilkan .ex5."
        ]
      },
      {
        "jenis": "p",
        "isi": "Kalau EA-nya muncul di Navigator tapi tidak bisa diseret ke chart, biasanya yang tersalin cuma .mq5 dan belum pernah dikompilasi."
      },
      {
        "jenis": "h2",
        "isi": "Satu peringatan soal EA gratisan"
      },
      {
        "jenis": "p",
        "isi": "Pencarian \"EA MT5 free download\" menghasilkan banyak sekali berkas. EA berjalan dengan izin penuh atas akunmu: ia bisa membuka dan menutup posisi tanpa bertanya. Berkas .ex5 tidak bisa dibaca isinya, jadi tidak ada cara memeriksa apa yang ia lakukan sebelum ia melakukannya."
      },
      {
        "jenis": "p",
        "isi": "Kalau tetap mau mencoba, coba di akun demo dulu — bukan di akun kecil yang \"tidak apa-apa kalau habis\"."
      }
    ],
    "terkait": [
      {
        "slug": "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
        "judul": "Cara Menghubungkan MetaTrader 5 ke Jurnal Trading Otomatis",
        "gambar": "/artikel/gambar/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis.webp"
      },
      {
        "slug": "akun-sen-mt5-jurnal-seratus-kali-lipat",
        "judul": "Akun Sen di MT5 Bisa Membuat Jurnalmu Terlihat 100× Lebih Untung",
        "gambar": "/artikel/gambar/akun-sen-mt5-jurnal-seratus-kali-lipat.webp"
      }
    ]
  },
  {
    "slug": "cara-hitung-lot-forex-dan-akun-cent",
    "jenis": "edukasi",
    "judul": "Cara Hitung Lot Forex dari Risiko (dan Bedanya di Akun Cent)",
    "ringkas": "Rumus lot yang berangkat dari jarak stop loss, bukan dari perasaan — plus koreksi yang wajib dipakai di akun cent.",
    "menit": 2,
    "gambar": "/artikel/gambar/cara-hitung-lot-forex-dan-akun-cent.webp",
    "isi": [
      {
        "jenis": "p",
        "isi": "Kebanyakan orang menentukan lot lebih dulu, lalu menaruh stop loss di tempat yang enak dilihat. Urutan itu terbalik, dan itu sebab paling umum satu transaksi bisa menghabiskan sepertiga akun."
      },
      {
        "jenis": "h2",
        "isi": "Urutannya: risiko dulu, lot belakangan"
      },
      {
        "jenis": "ol",
        "isi": [
          "<b>Tentukan berapa rupiah yang boleh hilang</b> di transaksi ini. Umumnya 1–2% dari saldo. Saldo 10 juta, risiko 1% = Rp100.000.",
          "<b>Tentukan di mana setupmu gugur.</b> Ini titik stop loss, dan ia ditentukan chart — bukan oleh angka yang enak diingat.",
          "<b>Ukur jaraknya dalam pip</b> dari entry ke titik itu.",
          "<b>Baru hitung lotnya.</b>"
        ]
      },
      {
        "jenis": "h2",
        "isi": "Rumusnya"
      },
      {
        "jenis": "p",
        "isi": "<b>Lot = Risiko ÷ (Jarak SL dalam pip × Nilai per pip per lot)</b>"
      },
      {
        "jenis": "p",
        "isi": "Untuk pair dengan USD di belakang (EURUSD, GBPUSD), 1 lot standar bernilai sekitar $10 per pip. Contoh: risiko $100, stop loss 50 pip. Lot = 100 ÷ (50 × 10) = <b>0,2 lot</b>."
      },
      {
        "jenis": "p",
        "isi": "Untuk XAUUSD 1 lot umumnya $10 per 0,1 pergerakan harga, dan tiap broker bisa berbeda. Periksa <code>Specification</code> simbolnya, jangan pakai angka dari artikel mana pun — termasuk yang ini."
      },
      {
        "jenis": "h2",
        "isi": "Di akun cent, satuannya seratus kali lebih kecil"
      },
      {
        "jenis": "p",
        "isi": "Akun cent menampilkan saldo dalam sen, bukan dolar. Saldo yang tertulis 50.000 berarti $500. Ini sumber kesalahan yang mahal: 1 lot di akun cent bukan 1 lot di akun standar."
      },
      {
        "jenis": "ul",
        "isi": [
          "<b>Saldo:</b> bagi 100 untuk mendapat nilai dolarnya.",
          "<b>Risiko:</b> hitung dari saldo dolarnya, bukan dari angka layar.",
          "<b>Lot:</b> 1 lot cent ≈ 0,01 lot standar.",
          "<b>Jurnal:</b> seluruh P/L wajib dibagi 100. Kalau tidak, riwayatmu terbaca seratus kali lebih untung dari kenyataan."
        ]
      },
      {
        "jenis": "catatan",
        "isi": "Akun cent gunanya melatih <b>kebiasaan</b> dengan uang kecil, bukan mengejar untung kecil. Kalau lot-nya dibesarkan sampai risikonya setara akun standar, seluruh gunanya hilang."
      },
      {
        "jenis": "h2",
        "isi": "Kalau masih dihitung pakai kalkulator HP"
      },
      {
        "jenis": "p",
        "isi": "Tidak ada yang salah dengan kalkulator. Yang salah adalah saat hitungan itu dilewati — dan ia paling sering dilewati persis di keadaan yang paling butuh: waktu harga bergerak cepat dan kamu takut ketinggalan."
      },
      {
        "jenis": "p",
        "isi": "Itu sebabnya aturan lot lebih baik dipindahkan keluar dari kepala. Aturan yang ada di kepala harus diingat waktu panik; aturan yang ada di alat jalan sendiri."
      }
    ],
    "terkait": [
      {
        "slug": "akun-sen-mt5-jurnal-seratus-kali-lipat",
        "judul": "Akun Sen di MT5 Bisa Membuat Jurnalmu Terlihat 100× Lebih Untung",
        "gambar": "/artikel/gambar/akun-sen-mt5-jurnal-seratus-kali-lipat.webp"
      },
      {
        "slug": "cara-membuat-jurnal-trading-di-excel",
        "judul": "Cara Membuat Jurnal Trading di Excel (dan Kapan Excel Mulai Merepotkan)",
        "gambar": "/artikel/gambar/cara-membuat-jurnal-trading-di-excel.webp"
      }
    ]
  }
];
