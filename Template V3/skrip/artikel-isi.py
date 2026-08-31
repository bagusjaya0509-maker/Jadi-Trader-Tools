# -*- coding: utf-8 -*-
"""Isi artikel /belajar — bahan mentahnya, terpisah dari perendernya.

KENAPA ARTIKEL STATIS, BUKAN HALAMAN REACT. Diperiksa 27 Agu 2026: HTML
mentah jaditrader.co.id memuat 122 karakter teks, dan 122 karakter itu
sebuah komentar HTML. Seluruh isi halaman digambar JavaScript. Google memang
menjalankan JS, tapi lebih lambat dan lebih sering menyerah — dan crawler
lain (Bing, mesin jawab AI) jauh lebih buruk. Situs ini praktis tidak punya
apa pun untuk diperingkatkan.

Artikel di sini dirender jadi berkas HTML sungguhan di `public/belajar/`,
disajikan apa adanya oleh server tanpa satu baris JavaScript pun.

DUA JENIS ARTIKEL, DAN YANG PERTAMA LEBIH PENTING:

  fitur     Cara memakai produk ini. Orang yang mengetik "cara
            menghubungkan MT5 ke website" sudah punya MT5, sudah mau
            menjurnal otomatis, dan tinggal mencari alatnya. Niatnya
            setinggi mungkin.
  edukasi   Konsep trading umum. Jangkauannya jauh lebih luas tapi niat
            belinya rendah; gunanya mengisi corong bagian atas.

SUMBER FAKTA TEKNISNYA `src/halaman/Integrasi.tsx` dan
`src/halaman/Dokumentasi.tsx` — bukan ingatan saya. Alamat server SENGAJA
tidak ditulis di sini: ia berubah waktu backend pindah, dan artikel yang
menuliskannya akan menyesatkan diam-diam. Pembaca disuruh menyalinnya dari
halaman Integrations, satu-satunya tempat yang selalu benar.
"""

# ── kepala halaman daftar ───────────────────────────────────────────────
# "Artikel" saja itu LABEL, bukan kalimat — ia menamai halamannya tapi tidak
# memberi satu pun alasan untuk membaca. Yang dipakai di bawah menyebut
# gejalanya langsung, karena orang yang mendarat di sini datang membawa satu
# masalah tertentu, bukan rasa ingin tahu umum.
#
# Dua kalimat penggantinya kalau yang sekarang mau ditukar:
#   "Yang tidak diajarkan waktu kamu buka akun"
#   "Baca dulu sebelum buka chart berikutnya"
AULA_JUDUL = "Jadi Trader Artikel | Perdalam Pemahamanmu Disini."

AULA_DESKRIPSI = "Latih Psikologi & Skill Trading Dalam 1 Halaman Tools."

# Label raksasa di belakang judul. Pendek, karena ia elemen grafis — bukan
# kalimat yang dibaca.
AULA_LABEL = "ARTIKEL"


# ── potongan yang dipakai berulang ──────────────────────────────────────
CTA = ("Semua yang dijelaskan di atas bisa dicoba tanpa membayar dan tanpa "
       "mendaftar lebih dulu lewat halaman pratinjau — akses penuh 24 jam.")

ARTIKEL = [

# ══════════════════════════════════════════════════════════════════════════
{
 "slug": "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
 "jenis": "fitur",
 "judul": "Cara Menghubungkan MetaTrader 5 ke Jurnal Trading Otomatis",
 "ringkas": ("Enam langkah memasang EA JadiTraderSync di MT5 supaya setiap "
             "transaksi masuk ke jurnal sendiri — tanpa menyalin satu baris pun "
             "dari riwayat."),
 "kunci": "menghubungkan mt5 ke website, jurnal trading otomatis, expert advisor mt5, jadi trader sync",
 "isi": [
  ("p", "Mencatat jurnal dengan tangan gagal karena satu alasan yang sama pada "
        "semua orang: yang paling perlu dicatat justru transaksi yang paling "
        "malas dicatat. Trade yang rugi, yang diambil karena FOMO, yang "
        "SL-nya digeser — itu yang hilang dari catatan, dan itu juga yang "
        "seharusnya dibaca ulang."),
  ("p", "Jalan keluarnya bukan disiplin yang lebih keras, tapi mencabut "
        "langkah menyalinnya. MetaTrader 5 bisa mengirim sendiri tiap "
        "transaksi yang tertutup ke jurnal, lewat sebuah Expert Advisor."),

  ("h2", "Yang perlu disiapkan"),
  ("ul", ["MetaTrader 5 di komputer (bukan aplikasi ponsel — EA hanya jalan di terminal desktop)",
          "Akun di jaditrader.co.id, untuk mengambil kode pasangan",
          "Berkas JadiTraderSync.ex5, sekitar 36 KB"]),

  ("h2", "Enam langkah"),
  ("ol", [
    "<b>Unduh berkasnya.</b> Ambil JadiTraderSync.ex5 dari halaman Integrations.",
    "<b>Buka folder data MT5.</b> Di MetaTrader 5 pilih <code>File → Open Data "
    "Folder</code>, lalu masuk ke <code>MQL5\\Experts</code> dan salin berkas "
    ".ex5 ke situ. Jangan mencarinya lewat Windows Explorer — tiap terminal MT5 "
    "punya folder datanya sendiri di lokasi yang panjang dan acak.",
    "<b>Segarkan daftar EA.</b> Di panel Navigator (Ctrl+N), klik kanan "
    "<code>Expert Advisors → Refresh</code>. JadiTraderSync muncul di daftar. "
    "Kalau belum, tutup dan buka lagi MT5-nya.",
    "<b>Izinkan alamat server.</b> <code>Tools → Options → Expert Advisors</code>, "
    "centang <code>Allow WebRequest for listed URL</code>, lalu tambahkan alamat "
    "server yang tertulis di halaman Integrations. Salin persis, tanpa garis "
    "miring di ujung — MT5 mencocokkannya huruf per huruf, dan satu karakter "
    "beda membuat EA gagal tanpa pesan yang menjelaskan.",
    "<b>Seret ke chart mana pun.</b> Chart apa saja, timeframe apa saja: EA ini "
    "tidak membaca harga, jadi pilihan chart tidak berpengaruh. Di tab "
    "<code>Common</code> centang <code>Allow Algo Trading</code>.",
    "<b>Isi dua input.</b> Di tab <code>Inputs</code> ada dua yang wajib: "
    "<code>AlamatServer</code> (alamat yang sama dengan langkah 4) dan "
    "<code>KodePasangan</code> (kode dari halaman Integrations, bentuknya "
    "seperti JTM5-XXXX-XXXX). Lalu OK.",
  ]),
  # Tangkapan layar SUNGGUHAN dari MT5, bukan gambar hiasan. Ditaruh sesudah
  # daftarnya, bukan di dalam tiap <li>: gambar di dalam butir bernomor
  # memutus penomorannya di sebagian peramban, dan langkah yang nomornya
  # kacau lebih membingungkan daripada langkah tanpa gambar.
  #
  # Cuma dua langkah yang bergambar, dan itu disengaja — dua ini yang
  # paling sering ditanya karena letaknya tersembunyi di dalam menu.
  # Langkah yang sudah jelas dari kalimatnya tidak dibuatkan gambar; gambar
  # yang tidak menjelaskan apa pun cuma memperberat halaman.
  ("gambar", ("mt5-langkah-3-navigator.webp",
              "Langkah 3 — panel Navigator sesudah disegarkan. "
              "<b>JadiTraderSync</b> muncul di bawah daftar Expert Advisors. "
              "Kalau belum ada di situ, berkas .ex5-nya belum masuk ke folder "
              "yang benar dan langkah 2 perlu diulang.")),
  ("gambar", ("mt5-langkah-4-webrequest.webp",
              "Langkah 4 — <code>Tools &rarr; Options &rarr; Experts</code>. "
              "Yang wajib: <b>Allow WebRequest for listed URL</b> tercentang, "
              "dan alamat servernya ada di daftar. Dua baris di atasnya "
              "sengaja ditutup karena itu isi daftar milik akun contoh; "
              "punyamu akan berbeda.")),
  ("catatan", "Pastikan tombol <b>Algo Trading</b> di toolbar MT5 berwarna "
              "hijau. Kalau merah, EA-nya terpasang tapi tidak berjalan sama "
              "sekali — dan tidak ada pesan galat yang memberitahumu."),

  ("h2", "Kalau jurnalnya tetap kosong"),
  ("ul", ["<b>Tab Experts menampilkan \"WebRequest ... 4060\"</b> — alamat server "
          "belum masuk daftar izin, atau ada bedanya satu karakter. Ulangi langkah 4.",
          "<b>EA tersambung tapi jurnal tidak terisi</b> — WebRequest belum "
          "diizinkan, atau alamat server belum ditambahkan ke daftar putih MT5.",
          "<b>Tombol Algo Trading merah</b> — klik sekali supaya hijau."]),

  ("h2", "Apakah EA ini bisa membuka posisi?"),
  ("p", "Tidak, dan itu bisa kamu periksa sendiri alih-alih mempercayainya. "
        "Kode sumber EA-nya dibuka di Marketplace: cari <code>OrderSend</code> "
        "di dalamnya — perintah itu satu-satunya cara MQL5 mengirim order, dan "
        "ia tidak ada di sana. EA ini hanya membaca riwayat lalu mengirimkannya."),
  ("p", "Sambungan MT5 dan sambungan Binance sengaja dipisah karena sifat "
        "risikonya berbeda jauh: MT5 hanya mengirim data, Binance mengeksekusi "
        "order dengan uang sungguhan."),
 ],
 "terkait": ["cara-membuat-api-key-binance-yang-aman",
             "akun-sen-mt5-jurnal-seratus-kali-lipat"],
},

# ══════════════════════════════════════════════════════════════════════════
{
 "slug": "cara-membuat-api-key-binance-yang-aman",
 "jenis": "fitur",
 "judul": "Cara Membuat API Key Binance yang Aman untuk Screener dan Chart",
 "ringkas": ("Satu centang yang tidak boleh diaktifkan, kenapa API key tidak "
             "pernah masuk ke peramban, dan apa bedanya dengan App Token."),
 "kunci": "api key binance, cara connect binance ke website, screener kripto, app token",
 "isi": [
  ("p", "API key Binance itu kunci rumah. Ia dibuat sekali, ditempel sekali, "
        "lalu dilupakan — dan justru karena dilupakan itulah ia berbahaya. "
        "Halaman ini soal cara membuatnya sehingga kalaupun bocor, kerugiannya "
        "terbatas."),

  ("h2", "Satu centang yang menentukan segalanya"),
  ("p", "Saat membuat API key di Binance, <b>jangan centang Withdraw</b>. "
        "Kalaupun key-nya bocor, penerimanya tidak bisa menarik saldomu ke mana "
        "pun. Ini bukan saran kehati-hatian umum — ini beda antara kehilangan "
        "kendali order dan kehilangan uangnya."),
  ("catatan", "Aturan yang sama berlaku untuk kunci apa pun yang kamu buat di "
              "bursa mana pun: berikan izin sesempit yang dibutuhkan alatnya, "
              "bukan seluas yang diizinkan bursanya."),

  ("h2", "Kenapa perlu VPS sendiri"),
  ("p", "Binance diblokir sebagian ISP Indonesia. Permintaan dari peramban di "
        "jaringan itu tidak pernah sampai, dan gejalanya membingungkan: chart "
        "kosong, screener tidak mengisi, tanpa pesan galat yang jelas."),
  ("p", "Karena itu permintaannya dilewatkan proxy di server di luar jaringan "
        "tersebut. Konsekuensinya sekaligus keuntungannya: API key-nya tinggal "
        "di berkas <code>.env</code> di VPS milikmu sendiri, dan tidak pernah "
        "dikirim ke peramban, ke situs ini, atau ke mana pun."),

  ("h2", "App Token bukan API key"),
  ("p", "Dua hal ini sering tertukar, padahal fungsinya berlawanan arah:"),
  ("ul", ["<b>API key Binance</b> — kunci antara VPS-mu dan Binance. Hanya ada "
          "di VPS. Tidak pernah keluar dari sana.",
          "<b>App Token</b> — kata sandi 64 karakter antara peramban dan VPS-mu. "
          "Ia yang membuktikan bahwa yang memerintah adalah kamu."]),
  ("p", "Siapa pun yang memegang App Token bisa membuka dan menutup posisi di "
        "akunmu. Perlakukan seperti kata sandi, bukan seperti alamat."),
  ("catatan", "Backend URL dan App Token tersimpan di perangkat yang kamu pakai "
              "saja — keduanya tidak pernah dikirim ke server kami."),

  ("h2", "Yang tidak pernah kami simpan"),
  ("ul", ["API key dan secret Binance",
          "Nomor kartu",
          "Kata sandi MT5 dan kata sandi investor"]),
  ("p", "Yang disimpan: email, status langganan, dan riwayat transaksi yang "
        "dikirim EA."),

  ("h2", "Kalau data pasar tetap tidak masuk"),
  ("p", "Ganti DNS bisa menolong sementara, tapi yang andal tetap proxy VPS "
        "yang diatur di halaman Integrations. Tutorial lengkapnya — dari "
        "membuat API key sampai <code>pm2 startup</code>, dengan perintah siap "
        "salin — ada di sana."),
 ],
 "terkait": ["cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
             "kenapa-data-binance-tidak-masuk-di-indonesia"],
},

# ══════════════════════════════════════════════════════════════════════════
{
 "slug": "kenapa-data-binance-tidak-masuk-di-indonesia",
 "jenis": "fitur",
 "judul": "Kenapa Data Binance Tidak Masuk di Indonesia, dan Cara Mengatasinya",
 "ringkas": ("Chart kosong dan screener yang tidak mengisi biasanya bukan bug "
             "aplikasi — melainkan blokir di jaringan ISP-mu."),
 "kunci": "binance diblokir indonesia, chart kripto kosong, proxy binance, dns binance",
 "isi": [
  ("p", "Gejalanya khas: aplikasinya terbuka normal, tombolnya jalan, tapi "
        "chart kripto kosong dan screener tidak pernah selesai memuat. Tidak "
        "ada pesan galat yang menjelaskan, karena dari sudut pandang peramban "
        "permintaannya memang tidak ditolak — ia cuma tidak pernah dijawab."),

  ("h2", "Sebabnya di jaringan, bukan di aplikasi"),
  ("p", "Binance diblokir sebagian ISP di Indonesia. Selama permintaan berangkat "
        "dari jaringan itu, ia tidak akan sampai — dan mengganti aplikasi, "
        "peramban, atau perangkat tidak mengubah apa pun."),

  ("h2", "Dua cara, dan yang kedua yang bertahan"),
  ("ul", ["<b>Ganti DNS.</b> Paling cepat dicoba dan kadang cukup. Tapi ia "
          "bergantung pada bagaimana ISP-mu memblokir, jadi bisa berhenti "
          "bekerja kapan saja tanpa pemberitahuan.",
          "<b>Proxy lewat VPS sendiri.</b> Permintaannya berangkat dari server "
          "di luar jaringan yang memblokir. Lebih repot dipasang sekali, lalu "
          "tidak perlu dipikirkan lagi."]),
  ("p", "Cara kedua punya efek samping yang justru bagus: API key Binance-mu "
        "tinggal di VPS itu, tidak pernah masuk ke peramban."),
  ("catatan", "Untuk order sungguhan, proxy VPS bukan pilihan melainkan syarat. "
              "Eksekusi order sengaja dikunci sampai VPS-nya terpasang."),
 ],
 "terkait": ["cara-membuat-api-key-binance-yang-aman",
             "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis"],
},

# ══════════════════════════════════════════════════════════════════════════
{
 "slug": "akun-sen-mt5-jurnal-seratus-kali-lipat",
 "jenis": "fitur",
 "judul": "Akun Sen di MT5 Bisa Membuat Jurnalmu Terlihat 100× Lebih Untung",
 "ringkas": ("Kenapa akun cent perlu diperlakukan berbeda, dan bagaimana saldo, "
             "swap, komisi, serta winrate gabungan dihitung."),
 "kunci": "akun sen mt5, akun cent, winrate gabungan, hitung profit jurnal",
 "isi": [
  ("p", "Akun sen memakai satuan yang seratus kali lebih kecil dari akun biasa. "
        "Kalau angkanya masuk jurnal apa adanya, seluruh riwayatmu terbaca "
        "seratus kali lebih untung dari kenyataan — dan yang berbahaya bukan "
        "angkanya, melainkan keputusan yang kamu ambil dari angka itu."),
  ("p", "Akun sen dideteksi dari mata uang akun MT5, lalu dibagi 100 sebelum "
        "masuk jurnal."),

  ("h2", "Saldo dihitung dari transaksi yang sudah selesai"),
  ("p", "Saldo di Dashboard dan Journal berasal dari satu sumber: saldo awal "
        "ditambah seluruh P/L yang sudah direalisasi. Posisi yang masih terbuka "
        "tidak ikut — ia tampil terpisah sebagai floating."),
  ("p", "Alasannya sederhana: mencampur keduanya membuat kurva ekuitas berubah "
        "tiap detik tanpa ada satu pun transaksi yang benar-benar terjadi. "
        "Kurva yang bergerak sendiri tidak bisa dipakai menilai apa pun."),

  ("h2", "Swap dan komisi masuk ke dalam P/L"),
  ("p", "Keduanya dihitung ke dalam P/L tiap transaksi, bukan dijadikan baris "
        "sendiri. Jadi angka yang kamu lihat adalah yang benar-benar masuk atau "
        "keluar dari akun, bukan angka kotor sebelum biaya."),

  ("h2", "Winrate gabungan memakai jumlah transaksi"),
  ("p", "Forex dan kripto disimpan terpisah lalu digabung saat ditampilkan. "
        "Winrate gabungannya dihitung dari jumlah transaksi, <b>bukan</b> "
        "rata-rata dua winrate."),
  ("p", "Bedanya besar: 9 dari 10 trade forex menang dan 1 dari 90 trade kripto "
        "menang bukan berarti winrate-mu 50%. Rata-rata dua persentase "
        "menyembunyikan bahwa hampir semua transaksimu ada di sisi yang kalah."),

  ("h2", "Kolom emosi tidak memengaruhi angka"),
  ("p", "Kolom emosi dan alasan entry diisi manual, dan sengaja tidak dipakai "
        "menghitung apa pun. Gunanya muncul belakangan — saat pola \"entry "
        "karena FOMO\" sudah cukup banyak untuk dijumlahkan."),
 ],
 "terkait": ["cara-menghubungkan-mt5-ke-jurnal-trading-otomatis"],
},

# ══════════════════════════════════════════════════════════════════════════
{
 "slug": "cara-memasang-indikator-pine-di-tradingview",
 "jenis": "fitur",
 "judul": "Cara Memasang Indikator Pine di TradingView (dan Satu Sebab Gagal yang Paling Sering)",
 "ringkas": ("Menempel kode Pine, menyimpannya ke favorit, dan kenapa indikator "
             "v6 tidak mau dikompilasi di layout lama."),
 "kunci": "cara pasang indikator tradingview, pine editor, pine script v6, indikator smi",
 "isi": [
  ("p", "Indikator Pine dipasang lewat Pine Editor di TradingView. Prosesnya "
        "pendek, dan satu-satunya langkah yang sering dilewati justru yang "
        "membuatnya berguna besok."),

  ("h2", "Langkahnya"),
  ("ol", ["Buka <code>Pine Editor</code> di bagian bawah layar TradingView.",
          "Tempel kode indikatornya.",
          "Klik <code>Add to chart</code>.",
          "<b>Simpan ke favorit.</b> Tanpa ini, indikatornya hanya menempel di "
          "layout yang sedang terbuka, dan besok kamu harus menempel ulang."]),
  # Tampilan "Favorites", BUKAN "My scripts". Keduanya menjelaskan langkah 4,
  # dan "My scripts" bahkan lebih jelas karena bintangnya ada yang terisi dan
  # ada yang tidak. Tapi daftar itu memuat SELURUH nama skrip milik pemilik,
  # termasuk yang belum dirilis — menerbitkannya sama dengan mengumumkan
  # daftar produk yang belum diumumkan.
  ("gambar", ("tradingview-langkah-4-favorit.webp",
              "Langkah 4 — tombol <code>Indicators</code> di toolbar atas, lalu "
              "<b>Favorites</b>. Indikator yang bintangnya sudah terisi akan "
              "selalu ada di daftar ini, di layout mana pun kamu membukanya. "
              "Yang belum difavoritkan cuma menempel di layout yang sedang "
              "terbuka.")),

  ("h2", "Kalau gagal dikompilasi, cek versinya"),
  ("p", "Versi Pine tertulis di kartu tiap produk. Indikator v6 <b>tidak bisa</b> "
        "dikompilasi di layout yang masih dikunci ke v5 — dan pesan galatnya "
        "biasanya menunjuk baris kode, bukan menyebut versinya, sehingga mudah "
        "disalahartikan sebagai kode yang rusak."),

  ("h2", "Indikator dan Expert Advisor itu dua hal berbeda"),
  ("ul", ["<b>Jadi Trader V3</b> — overlay: channel, duplikat channel 1 & 2, "
          "zona SNR multi-timeframe, dan sinyal BUY/SELL.",
          "<b>Stochastic Momentum Index</b> — panel terpisah, SMI yang sama "
          "dengan yang dipakai Area Pantau.",
          "<b>News &amp; GAP Hunter V2</b> — overlay untuk XAUUSD dan forex.",
          "<b>JadiTraderSync</b> — ini <b>EA MT5</b>, bukan indikator "
          "TradingView. Tempatnya di <code>MQL5/Experts</code>, bukan di Pine "
          "Editor."]),
  ("catatan", "Kesalahan yang sering terjadi: mencoba menempel EA MT5 ke Pine "
              "Editor. Keduanya bahasa yang berbeda dan platform yang berbeda."),
 ],
 "terkait": ["cara-menghubungkan-mt5-ke-jurnal-trading-otomatis"],
},

# ════════════════════════════════════════════════════════════════════════
# EMPAT ARTIKEL DI BAWAH DIPILIH DARI DATA, BUKAN DARI TEBAKAN (30 Agu 2026)
# ════════════════════════════════════════════════════════════════════════
# Lima artikel pertama judulnya ditebak. Hasilnya terbaca di Search Console
# sesudah tiga bulan: 27 klik, dan SELURUHNYA dari orang yang mengetik
# "jaditrader.co.id" — nama situsnya sendiri. Tiga kata kunci lain masing-
# masing 1 impresi. Nol penemuan dari orang yang belum tahu merek ini.
#
# Yang di bawah diambil dari saran otomatis Google berbahasa Indonesia:
# 2.719 frasa unik dari 23 benih, lalu disaring ke yang benar-benar bisa
# dijawab produk ini. Angka dalam kurung = berapa kali frasa itu muncul di
# saran; makin tinggi makin sentral di topiknya.
{
 "slug": "cara-membuat-jurnal-trading-di-excel",
 "jenis": "edukasi",
 "judul": "Cara Membuat Jurnal Trading di Excel (dan Kapan Excel Mulai Merepotkan)",
 "ringkas": ("Kolom apa saja yang wajib ada, rumus winrate dan profit factor "
             "yang benar, dan tiga hal yang membuat jurnal Excel berhenti diisi."),
 "kunci": ("cara membuat jurnal trading di excel, jurnal trading forex excel, "
           "jurnal trading excel download, cara membuat jurnal trading crypto, "
           "jurnal trading gratis"),
 "isi": [
  ("p", "Jurnal trading di Excel itu titik awal yang benar. Gratis, "
        "seluruhnya kamu yang pegang, dan tidak ada yang perlu didaftarkan. "
        "Halaman ini soal cara membuatnya supaya betul-betul terpakai — dan "
        "soal titik di mana Excel biasanya mulai ditinggalkan."),

  ("h2", "Kolom yang wajib ada"),
  ("p", "Jurnal gagal bukan karena kolomnya kurang, tapi karena kolomnya "
        "terlalu banyak. Sepuluh ini sudah cukup untuk menjawab hampir semua "
        "pertanyaan yang nanti kamu ajukan ke diri sendiri:"),
  ("ol", ["<b>Tanggal &amp; jam entry</b> — jam penting; banyak orang baru "
          "sadar rugi terbesarnya menumpuk di jam tertentu.",
          "<b>Pair / simbol</b>",
          "<b>Arah</b> — buy atau sell.",
          "<b>Lot</b>",
          "<b>Harga entry</b>",
          "<b>Stop loss</b> — diisi <i>sebelum</i> posisi jalan, bukan sesudah.",
          "<b>Take profit</b>",
          "<b>Harga exit</b>",
          "<b>P/L bersih</b> — sesudah swap dan komisi, bukan angka kotor.",
          "<b>Alasan entry</b> — satu kalimat. Ini kolom yang paling sering "
          "dikosongkan, dan paling berguna waktu dibaca ulang sebulan kemudian."]),
  ("catatan", "Kolom <b>emosi</b> boleh ditambah, tapi jangan dijadikan angka. "
              "Gunanya muncul belakangan — saat pola \"entry karena takut "
              "ketinggalan\" sudah cukup banyak untuk dijumlahkan."),

  ("h2", "Rumus yang sering salah"),
  ("p", "Dua angka ini yang paling sering dihitung keliru, dan keduanya "
        "menyesatkan ke arah yang sama: membuat hasilmu terlihat lebih baik "
        "dari kenyataan."),
  ("p", "<b>Winrate.</b> Kalau kolom P/L ada di <code>I</code>, winrate-nya "
        "<code>=COUNTIF(I:I,\">0\")/COUNT(I:I)</code>. Yang sering terjadi: "
        "pembaginya dipakai <code>COUNTA</code>, dan baris kosong ikut "
        "terhitung sebagai transaksi."),
  ("p", "<b>Profit factor.</b> Total untung dibagi total rugi: "
        "<code>=SUMIF(I:I,\">0\")/ABS(SUMIF(I:I,\"&lt;0\"))</code>. Angka ini "
        "lebih jujur daripada winrate. Winrate 80% dengan profit factor 0,7 "
        "berarti kamu sering menang kecil dan sesekali kalah besar — dan "
        "akunnya tetap habis."),
  ("p", "<b>Kalau akunmu akun cent</b>, seluruh angka P/L harus dibagi 100 "
        "sebelum masuk jurnal. Kalau tidak, riwayatmu terbaca seratus kali "
        "lebih untung dari kenyataan."),

  ("h2", "Tiga hal yang membuat jurnal Excel berhenti diisi"),
  ("ul", ["<b>Pengisiannya manual.</b> Sesudah trade ke-30, mengetik ulang "
          "sepuluh kolom terasa seperti pekerjaan. Yang pertama dilewati "
          "biasanya trade yang rugi — dan itu justru yang paling perlu dicatat.",
          "<b>Diisi dari ingatan.</b> Dicatat malam hari, dari yang teringat. "
          "Ingatan memihak diri sendiri: yang menang diingat lengkap, yang "
          "kalah diingat samar.",
          "<b>Tidak pernah dibaca ulang.</b> Berkas terisi rapi selama tiga "
          "bulan, lalu tidak pernah dibuka lagi. Jurnal yang tidak dibaca "
          "sama saja dengan jurnal yang tidak ada."]),

  ("h2", "Kapan Excel sudah tidak cukup"),
  ("p", "Selama kamu masih rutin mengisinya, Excel tidak perlu diganti. "
        "Penggantinya baru masuk akal kalau yang berhenti adalah "
        "pengisiannya, bukan tradingnya."),
  ("p", "Bedanya cuma satu: dari mana datanya datang. Di Excel kamu yang "
        "mengetik; kalau terminalmu yang mengirim sendiri tiap transaksi "
        "tertutup, kolom angkanya tidak pernah bolong dan tidak pernah "
        "dibulatkan oleh ingatan. Yang tersisa buatmu cuma kolom alasan "
        "entry — satu kalimat yang memang cuma kamu yang tahu."),
 ],
 "terkait": ["cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
             "akun-sen-mt5-jurnal-seratus-kali-lipat"],
},

{
 "slug": "cara-backtest-strategi-trading-gratis",
 "jenis": "edukasi",
 "judul": "Cara Backtest Strategi Trading Gratis di TradingView dan MT5",
 "ringkas": ("Tiga cara backtest tanpa bayar, batas masing-masing, dan sebab "
             "paling sering hasil backtest jauh lebih bagus daripada hasil live."),
 "kunci": ("cara backtest trading gratis, cara backtest di tradingview gratis, "
           "cara backtest di mt5 pc, cara backtest indikator di tradingview, "
           "replay chart"),
 "isi": [
  ("p", "Backtest itu menguji aturan entry-mu pada harga yang sudah lewat. "
        "Tujuannya bukan mencari strategi yang menang terus — tapi mengetahui "
        "seperti apa rasanya kalah beruntun sebelum uang sungguhan ikut."),

  ("h2", "1. Replay chart — paling jujur, paling lambat"),
  ("p", "Chart dimundurkan ke tanggal tertentu, lalu dimajukan satu lilin "
        "sekali. Kamu memutuskan tanpa bisa melihat lilin berikutnya."),
  ("p", "Ini satu-satunya cara yang menguji <b>kamu</b>, bukan cuma "
        "aturannya. Backtest yang dilihat sekaligus dari kanan ke kiri selalu "
        "terlihat gampang, karena matamu sudah tahu ke mana harga pergi."),
  ("p", "Di TradingView fiturnya bernama <code>Bar Replay</code> dan tersedia "
        "di paket gratis dengan batas: timeframe harian ke atas saja. Untuk "
        "intraday ia berbayar."),

  ("h2", "2. Strategy Tester MT5 — paling cepat, paling gampang menipu"),
  ("p", "Kalau aturanmu sudah berbentuk EA, MT5 bisa menjalankan lima tahun "
        "data dalam hitungan menit lewat <code>View &rarr; Strategy Tester</code>. "
        "Gratis, dan datanya diambil dari brokermu sendiri."),
  ("p", "Tiga hal yang membuat hasilnya terlalu bagus, dan ketiganya diam:"),
  ("ul", ["<b>Model \"Open prices only\"</b> — paling cepat, dan paling jauh "
          "dari kenyataan. Pakai <code>Every tick based on real ticks</code>.",
          "<b>Spread tetap.</b> Bawaannya spread ideal. Di jam berita spread "
          "melebar, dan justru di situ banyak SL tersentuh.",
          "<b>Komisi dan swap tidak ikut</b> kalau simbolnya tidak diatur "
          "seperti akun sungguhanmu."]),

  ("h2", "3. Backtest manual di Excel — paling merepotkan, paling dimengerti"),
  ("p", "Gulir chart ke belakang, catat tiap setup yang memenuhi aturanmu ke "
        "spreadsheet, lalu hitung hasilnya. Lambat, tapi kamu jadi hafal "
        "seperti apa setupmu terlihat — dan itu tidak didapat dari laporan "
        "yang dihasilkan mesin."),

  ("h2", "Kenapa backtest bagus tapi live babak belur"),
  ("p", "Hampir selalu satu dari empat ini, dan tidak satu pun berhubungan "
        "dengan strateginya:"),
  ("ol", ["<b>Kamu tahu masa depannya.</b> Waktu backtest, lilin sesudahnya "
          "sudah ada di layar. Otak memakainya tanpa kamu sadari.",
          "<b>Aturannya berubah di tengah jalan.</b> Sesudah tiga kali kalah "
          "beruntun, ambangnya digeser sedikit. Di backtest penggeseran itu "
          "tidak tercatat di mana pun.",
          "<b>Biaya tidak dihitung.</b> Spread, komisi, dan swap kecil per "
          "transaksi, tapi seratus transaksi kemudian ia bukan angka kecil lagi.",
          "<b>Lotnya berbeda.</b> Di backtest lot tetap. Di live lot dinaikkan "
          "waktu yakin dan diturunkan waktu takut — dan itu strategi yang "
          "berbeda dari yang diuji."]),
  ("catatan", "Aturan praktis: backtest yang tidak pernah menunjukkan periode "
              "rugi beruntun bukan strategi bagus, melainkan backtest yang "
              "salah. Setiap strategi punya periode buruk; kalau tidak "
              "kelihatan, artinya periode itu belum diuji."),
 ],
 "terkait": ["cara-memasang-indikator-pine-di-tradingview",
             "cara-membuat-jurnal-trading-di-excel"],
},

{
 "slug": "cara-pasang-ea-di-mt5-pc-dan-android",
 "jenis": "edukasi",
 "judul": "Cara Pasang EA di MT5 (dan Kenapa Tidak Bisa di Android atau iPhone)",
 "ringkas": ("Langkah memasang Expert Advisor di MT5 desktop, dan jawaban "
             "jujur untuk pertanyaan yang paling sering muncul soal HP."),
 "kunci": ("cara pasang ea di mt5, cara pasang ea di mt5 android, "
           "cara pasang ea di mt5 pc, cara pasang robot ea di mt5, "
           "expert advisor mt5"),
 "isi": [
  ("p", "Pertanyaan ini muncul terus dengan dua bentuk: cara memasangnya di "
        "PC, dan cara memasangnya di HP. Yang kedua jawabannya pendek, dan "
        "lebih baik diketahui sekarang daripada sesudah dua jam mencari."),

  ("h2", "Di Android dan iPhone: tidak bisa, dan bukan karena salah setelan"),
  ("p", "Aplikasi MetaTrader 5 untuk Android dan iOS <b>tidak menjalankan EA "
        "sama sekali</b>. Bukan disembunyikan di menu, bukan perlu izin "
        "tambahan — memang tidak ada. Aplikasi HP dibuat untuk melihat chart "
        "dan mengirim order manual."),
  ("p", "Jadi kalau kamu mencari menu <code>Experts</code> di aplikasi HP dan "
        "tidak ketemu, tidak ada yang salah dengan HP-mu."),
  ("p", "Yang sebenarnya dilakukan orang yang \"menjalankan EA dari HP\": "
        "EA-nya jalan di MT5 desktop pada sebuah VPS yang menyala 24 jam, dan "
        "HP cuma dipakai memantau. Itu dua hal yang berbeda."),

  ("h2", "Di PC: enam langkah"),
  ("ol", ["Buka <code>File &rarr; Open Data Folder</code>. Jangan mencarinya "
          "lewat Windows Explorer — tiap terminal MT5 punya foldernya sendiri "
          "di lokasi yang panjang dan acak.",
          "Masuk ke <code>MQL5\\Experts</code>, salin berkas <code>.ex5</code> "
          "atau <code>.mq5</code> ke situ.",
          "Kembali ke MT5, buka Navigator dengan <code>Ctrl+N</code>, klik "
          "kanan <code>Expert Advisors &rarr; Refresh</code>.",
          "Seret nama EA-nya ke chart mana pun.",
          "Di tab <code>Common</code>, centang <code>Allow Algo Trading</code>.",
          "Pastikan tombol <b>Algo Trading</b> di toolbar berwarna hijau."]),
  ("catatan", "Kalau EA-nya perlu menghubungi alamat internet, alamat itu "
              "wajib dimasukkan ke <code>Tools &rarr; Options &rarr; Experts "
              "&rarr; Allow WebRequest for listed URL</code>. Tanpa itu EA "
              "berjalan tapi tidak mengirim apa-apa, dan tidak ada pesan galat "
              "yang menjelaskan."),

  ("h2", "Beda .mq5 dan .ex5"),
  ("ul", ["<code>.ex5</code> — sudah dikompilasi, tinggal pakai. Kodenya "
          "tidak bisa dibaca.",
          "<code>.mq5</code> — kode sumbernya. Perlu dibuka di MetaEditor dan "
          "ditekan <code>Compile</code> dulu sampai menghasilkan .ex5."]),
  ("p", "Kalau EA-nya muncul di Navigator tapi tidak bisa diseret ke chart, "
        "biasanya yang tersalin cuma .mq5 dan belum pernah dikompilasi."),

  ("h2", "Satu peringatan soal EA gratisan"),
  ("p", "Pencarian \"EA MT5 free download\" menghasilkan banyak sekali "
        "berkas. EA berjalan dengan izin penuh atas akunmu: ia bisa membuka "
        "dan menutup posisi tanpa bertanya. Berkas .ex5 tidak bisa dibaca "
        "isinya, jadi tidak ada cara memeriksa apa yang ia lakukan sebelum ia "
        "melakukannya."),
  ("p", "Kalau tetap mau mencoba, coba di akun demo dulu — bukan di akun "
        "kecil yang \"tidak apa-apa kalau habis\"."),
 ],
 "terkait": ["cara-menghubungkan-mt5-ke-jurnal-trading-otomatis",
             "akun-sen-mt5-jurnal-seratus-kali-lipat"],
},

{
 "slug": "cara-hitung-lot-forex-dan-akun-cent",
 "jenis": "edukasi",
 "judul": "Cara Hitung Lot Forex dari Risiko (dan Bedanya di Akun Cent)",
 "ringkas": ("Rumus lot yang berangkat dari jarak stop loss, bukan dari "
             "perasaan — plus koreksi yang wajib dipakai di akun cent."),
 "kunci": ("cara hitung lot forex, cara hitung lot akun cent, "
           "cara hitung lot dan pip, lot size forex, akun cent berapa rupiah"),
 "isi": [
  ("p", "Kebanyakan orang menentukan lot lebih dulu, lalu menaruh stop loss "
        "di tempat yang enak dilihat. Urutan itu terbalik, dan itu sebab "
        "paling umum satu transaksi bisa menghabiskan sepertiga akun."),

  ("h2", "Urutannya: risiko dulu, lot belakangan"),
  ("ol", ["<b>Tentukan berapa rupiah yang boleh hilang</b> di transaksi ini. "
          "Umumnya 1–2% dari saldo. Saldo 10 juta, risiko 1% = Rp100.000.",
          "<b>Tentukan di mana setupmu gugur.</b> Ini titik stop loss, dan ia "
          "ditentukan chart — bukan oleh angka yang enak diingat.",
          "<b>Ukur jaraknya dalam pip</b> dari entry ke titik itu.",
          "<b>Baru hitung lotnya.</b>"]),

  ("h2", "Rumusnya"),
  ("p", "<b>Lot = Risiko ÷ (Jarak SL dalam pip × Nilai per pip per lot)</b>"),
  ("p", "Untuk pair dengan USD di belakang (EURUSD, GBPUSD), 1 lot standar "
        "bernilai sekitar $10 per pip. Contoh: risiko $100, stop loss 50 pip. "
        "Lot = 100 ÷ (50 × 10) = <b>0,2 lot</b>."),
  ("p", "Untuk XAUUSD 1 lot umumnya $10 per 0,1 pergerakan harga, dan tiap "
        "broker bisa berbeda. Periksa <code>Specification</code> simbolnya, "
        "jangan pakai angka dari artikel mana pun — termasuk yang ini."),

  ("h2", "Di akun cent, satuannya seratus kali lebih kecil"),
  ("p", "Akun cent menampilkan saldo dalam sen, bukan dolar. Saldo yang "
        "tertulis 50.000 berarti $500. Ini sumber kesalahan yang mahal: 1 lot "
        "di akun cent bukan 1 lot di akun standar."),
  ("ul", ["<b>Saldo:</b> bagi 100 untuk mendapat nilai dolarnya.",
          "<b>Risiko:</b> hitung dari saldo dolarnya, bukan dari angka layar.",
          "<b>Lot:</b> 1 lot cent ≈ 0,01 lot standar.",
          "<b>Jurnal:</b> seluruh P/L wajib dibagi 100. Kalau tidak, "
          "riwayatmu terbaca seratus kali lebih untung dari kenyataan."]),
  ("catatan", "Akun cent gunanya melatih <b>kebiasaan</b> dengan uang kecil, "
              "bukan mengejar untung kecil. Kalau lot-nya dibesarkan sampai "
              "risikonya setara akun standar, seluruh gunanya hilang."),

  ("h2", "Kalau masih dihitung pakai kalkulator HP"),
  ("p", "Tidak ada yang salah dengan kalkulator. Yang salah adalah saat "
        "hitungan itu dilewati — dan ia paling sering dilewati persis di "
        "keadaan yang paling butuh: waktu harga bergerak cepat dan kamu takut "
        "ketinggalan."),
  ("p", "Itu sebabnya aturan lot lebih baik dipindahkan keluar dari kepala. "
        "Aturan yang ada di kepala harus diingat waktu panik; aturan yang ada "
        "di alat jalan sendiri."),
 ],
 "terkait": ["akun-sen-mt5-jurnal-seratus-kali-lipat",
             "cara-membuat-jurnal-trading-di-excel"],
},

]
