import{b as V,m as L,c as K,p as C,j as e,L as M,T as U,E as z,M as R}from"./index-TqsOTZW1.js";import{r as o,u as H,L as N}from"./react-C97iXi1P.js";import{P as Y}from"./perlu-masuk-D_SJ5ryD.js";import{R as F}from"./rotate-ccw-BFwNgb6Y.js";import"./firebase-Csnso1ng.js";import"./lock-HJ7Fjzbv.js";const J="https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html";function G(){const m=window.location.origin,c=window.location.pathname.replace(/\/[^/]*$/,"").replace(/\/v3\/?$/,"");return[...new Set([`${m}${c}/ema-cross-screener_3.html`,`${m}/v2/ema-cross-screener_3.html`,`${m}/ema-cross-screener_3.html`])]}const _=`
  /* Spinner emas "memeriksa sesi" milik V2 disembunyikan di sini — V3 sudah
     menampilkan loadernya sendiri, dan dua indikator memuat untuk satu
     halaman terbaca sebagai dua hal yang sedang rusak. Berlaku HANYA saat
     ditempel; V2 yang berdiri sendiri tetap memakai spinnernya. */
  .es-auth-loading{ display:none !important; }

  /* ─────────────────────────────────────────────────────────────────────
     SEMUA di berkas ini hanya menyentuh TAMPILAN, tidak satu pun logic.
     Yang diubah: huruf, warna, radius, dan tiga elemen yang disembunyikan.
     Berkas V2-nya sendiri TIDAK disunting sama sekali — ia tetap utuh dan
     tetap benar saat dibuka sebagai halaman berdiri sendiri.
     ───────────────────────────────────────────────────────────────────── */

  /* Lebar sidebar dinolkan DI SUMBERNYA, bukan dilawan di hilir.
     Cangkang V2 menulis \`body{padding-left:var(--v2-sisi)}\`; mengosongkan
     variabelnya membuat aturan itu menghitung 0 dengan sendirinya — tidak
     ada yang perlu dikalahkan lewat spesifisitas. */
  :root { --v2-sisi: 0px !important; --v2-sisi-kecil: 0px !important; }

  /* Cangkang V2: sidebar, laci, kaki halaman */
  .v2-sisi, .v2-tirai, .v2-buka-laci, #v2Kaki { display: none !important; }
  body, body.v2-ciut { padding-left: 0 !important; }

  /* Bilah pengguna & judul aplikasi — V3 sudah punya keduanya */
  .es-toprow, .es-user-bar { display: none !important; }
  .es-header .es-title { display: none !important; }

  /* ── Panel simulasi & live trading disembunyikan SELURUHNYA ──
     Keputusan pemilik 14 Agu 2026: halaman screener cukup Area Pantau dan
     Parallel Signal. Ringkasan KPI, tabel Posisi Terbuka, Entry Area
     (termasuk kotak Live Trading), dan Riwayat Transaksi — semuanya satu
     blok .es-sim-section — tidak lagi ditampilkan DI SINI.

     Disembunyikan, BUKAN dihapus dari berkas V2-nya: 194 titik di JS V2
     menulis ke elemen-elemen blok ini tanpa penjaga null, jadi menghapus
     DOM-nya membuat seluruh halaman mati oleh TypeError. Dengan CSS,
     mesin simulasinya tetap berjalan diam-diam dan V2 yang dibuka berdiri
     sendiri (tempat live trading tetap dipakai) tidak berubah sama sekali. */
  .es-sim-section { display: none !important; }

  /* Tombol & panel News PINDAH ke bilah kendali Chart & Entry (komponen
     components/panel-news.tsx, sumber data sama: /api/news). Disembunyikan
     di sini supaya tidak ada dua kalender yang bisa menampilkan isi berbeda
     saat salah satunya gagal memuat. Sama seperti blok di atas: hanya
     disembunyikan, JS kalendernya di V2 tetap utuh dan tetap jalan saat V2
     dibuka berdiri sendiri. */
  .es-econ-calendar-panel { display: none !important; }

  /* ── Huruf & warna mengikuti V3 ── */
  :root {
    --v2-radius: 12px;
  }
  body, .ema-screener, .es-header, button, input, select, textarea {
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  }
  /* Angka tetap tabular seperti di seluruh V3 — digit yang bergeser tiap
     harga berubah memaksa mata mencari ulang posisinya. */
  .es-price, .es-num, .angka, .es-sim-table td, .es-priority-levels,
  .es-card-price, .es-val { font-variant-numeric: tabular-nums !important; }

  .ema-screener { background: #09090b !important; color: #fafafa !important; }

  /* Panel & kartu: HANYA radius yang diseragamkan.
     ────────────────────────────────────────────────────────────────────
     Sempat di sini ada 'border-color' dan 'background' dengan !important,
     dan itu menghapus warna hijau/merah pada kartu sinyal — padahal warna
     itulah isi utamanya: BUY dan SELL dibedakan sebelum tulisannya dibaca.

     Warna netralnya sudah ikut V3 lewat variabel '--panel' dan '--border'
     di blok bawah, jadi tidak ada yang perlu dipaksa di sini. Aksen yang
     memang disengaja V2 dibiarkan hidup. */
  .es-priority-section, .es-card, .es-priority-card, .es-sim-wrap,
  .es-panel, .es-box, .es-news-pop {
    border-radius: 12px !important;
  }

  /* Kontrol: tinggi, radius, dan warna sama dengan <Pilih> di V3 */
  .ema-screener select, .ema-screener input[type="text"], .ema-screener input[type="number"] {
    height: 36px !important;
    border-radius: 6px !important;
    border: 1px solid #27272a !important;
    background: rgba(24,24,27,.6) !important;
    color: #d4d4d8 !important;
    font-size: 12.5px !important;
  }
  .ema-screener button {
    border-radius: 6px !important;
    font-size: 12px !important;
  }
  /* Tombol utama V3 = putih dengan teks gelap */
  .es-scan-btn, .es-priority-scan-btn, .es-pantau-scan-btn {
    background: #fafafa !important;
    color: #09090b !important;
    border: none !important;
    font-weight: 500 !important;
  }

  /* Judul section disamakan dengan PanelHead V3 */
  .es-section-head, .es-priority-header {
    font-size: 15px !important;
    font-weight: 600 !important;
    letter-spacing: -.01em !important;
    color: #fafafa !important;
  }

  /* Hijau/merah disamakan dengan emerald-500 / red-400 milik V3 supaya
     BUY di dalam bingkai tidak berbeda warna dengan BUY di luar bingkai. */
  .es-buy, .es-long, .profit, .es-up { color: #10b981 !important; }
  .es-sell, .es-short, .loss, .es-down { color: #f87171 !important; }

  /* ── Latar bercahaya V2 dimatikan ──
     '.v2-cahaya' menaruh dua bola kabur 640 px (emas & hijau) di belakang
     halaman, dan '.v2-grain' menaburkan bintik di atasnya. Keduanya bagus
     saat V2 berdiri sendiri — di dalam bingkai, keduanya jadi tambalan warna
     yang jelas berbeda dari latar rata V3 di sekelilingnya, dan justru
     menegaskan bahwa isi bingkai ini "halaman lain". */
  .v2-cahaya, .v2-grain { display: none !important; }

  /* Latar abu yang tersisa datang dari variabel tema V2, bukan dari satu
     elemen — '--bg' dan '--panel'-nya beberapa tingkat lebih terang daripada
     zinc-950 milik V3. Diselaraskan DI SUMBERNYA supaya setiap elemen yang
     memakainya ikut benar, tanpa perlu memburu selektor satu per satu. */
  :root, .ema-screener {
    --bg: #09090b !important;
    --bg-2: #09090b !important;
    --panel: rgba(24,24,27,.4) !important;
    --panel-2: rgba(24,24,27,.6) !important;
    --border: rgba(39,39,42,.8) !important;
  }
  html, body, .ema-screener, .es-main, .es-wrap, .es-content {
    background: #09090b !important;
    background-image: none !important;
  }

  /* ── Bayangan jatuh di tiap section dihapus ──
     V2 memakai 'box-shadow: 0 10px 30px rgba(0,0,0,.45)' untuk mengangkat
     panel dari latar. V3 memisahkan panel dengan GARIS, bukan bayangan —
     mencampur keduanya membuat panel di dalam bingkai terlihat melayang di
     atas panel di luarnya.

     Yang TIDAK ikut dimatikan: bayangan pada popup (news, menu koin) — di
     sana bayangan bukan hiasan melainkan penanda bahwa ia mengambang di atas
     halaman, dan tanpa itu popup terbaca menyatu dengan isi di belakangnya. */
  .es-priority-section, .es-card, .es-priority-card, .es-sim-wrap,
  .es-panel, .es-box, .es-pantau-card, .es-chart-box, .es-section {
    box-shadow: none !important;
  }

  /* Kotak Live Trading kini ikut tersembunyi bersama .es-sim-section di
     atas — aturan gaya untuknya tidak lagi diperlukan di sini. */

  /* Scrollbar tipis seperti sisa aplikasi */
  * { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
  *::-webkit-scrollbar { width: 9px; height: 9px; }
  *::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9px; }
  *::-webkit-scrollbar-track { background: transparent; }

  /* ══════════════════════════════════════════════════════════════════
     TEMA TERANG — BLOK TERPISAH, DI UJUNG, TIDAK MENYENTUH APA PUN DI ATAS
     ══════════════════════════════════════════════════════════════════
     Percobaan pertama keliru dan sempat tayang: seluruh warna di atas
     diubah jadi var(--color-zinc-*) supaya ikut tema. Nilai gelapnya
     memang terbukti identik — sudah diukur satu per satu — tapi yang
     TIDAK ikut diubah adalah variabel TEKS milik V2 sendiri:

         --text:#ece8de   --muted:#9a9ca4   --dim:#63656d

     Jadi latarnya memutih sementara tintanya tetap krem. Hasilnya bukan
     "belum selesai", melainkan lebih buruk daripada sebelumnya: yang tadi
     gelap-tapi-terbaca jadi terang-dan-tidak-terbaca. Nilai gelap di atas
     sudah dikembalikan persis seperti semula.

     Sekarang terangnya hidup di sini, di balik [data-tema='terang'].
     Selama atribut itu tidak ada di <html>, tidak satu pun baris di bawah
     ikut dihitung peramban — bukan "ditimpa nilai gelap", melainkan tidak
     pernah aktif. Tema gelap tidak bisa rusak oleh blok ini, dan itu
     jaminan susunannya, bukan janji saya.

     Warnanya memakai tangga yang SAMA dengan blok [data-tema='terang'] di
     index.css supaya bingkai dan isinya tidak berbeda keluarga abu.

     ── DISELARASKAN ULANG 8 Sep 2026 ─────────────────────────────────
     Versi sebelumnya cuma menimpa delapan alias abu (--bg, --panel,
     --muted, --dim …) dengan tangga slate lama. Diukur di dalam iframe
     pada tema terang: 124 dari 328 teks gagal 4,5:1. Yang tidak pernah
     ditimpa justru yang paling sering dipakai screener — --bull hijau V2
     #4f9e82 (tombol BUY NOW, lencana SMI: rasio 2,7), --gold #c9a24b
     (bintang, tag SAHAM/ETF: 2,3), --bear #c2544d (4,3) — ketiganya
     warna yang dibuat untuk latar hitam. Dan --dim slate #94a3b8 (2,5)
     dipakai untuk peringkat "#1 • TF 4H" di tiap kartu.

     Sekarang SEMUA alias V2 ditimpa (termasuk skema jurnal --ink/--ground
     yang dipakai berkas V2 lain di bingkai yang sama), dan variabel
     dasarnya --v2-* ikut — alias di :root cuma menunjuk ke sana, jadi
     yang memakai --v2-kertas-2 langsung pun ikut berubah. Nilainya
     salinan dari index.css: zinc netral yang lebih curam di ujung terang,
     merah #c81e1e. Hijau dan emasnya SATU tangga lebih pekat daripada
     V3 (#065f46, #92400e): di screener keduanya duduk di atas rona
     tipis warnanya sendiri (tombol BUY NOW, lencana SMI, tag SAHAM/ETF),
     dan di situ #047857 cuma 4,3 — terukur sesudah putaran pertama. */

  [data-tema='terang'] .ema-screener {
    background: #ffffff !important;
    color: #09090b !important;
  }
  [data-tema='terang'], [data-tema='terang'] .ema-screener {
    /* dasar V2 */
    --v2-hitam: #ffffff !important;
    --v2-hitam-2: #ffffff !important;
    --v2-panel: #f4f4f5 !important;
    --v2-panel-2: #e4e4e7 !important;
    --v2-panel-3: #d4d4d8 !important;
    --v2-garis: #d4d4d8 !important;
    --v2-garis-soft: #e4e4e7 !important;
    --v2-kertas: #09090b !important;
    --v2-kertas-2: #48484f !important;
    --v2-kertas-3: #62626a !important;
    --v2-emas: #92400e !important;
    --v2-emas-terang: #a16207 !important;
    --v2-emas-kabut: rgba(146,64,14,.10) !important;
    --v2-emas-garis: rgba(146,64,14,.35) !important;
    --v2-naik: #065f46 !important;
    --v2-naik-kabut: rgba(6,95,70,.09) !important;
    --v2-turun: #c81e1e !important;
    --v2-turun-kabut: rgba(200,30,30,.10) !important;
    /* alias screener */
    --bg: #ffffff !important;
    --bg-2: #ffffff !important;
    --panel: #f4f4f5 !important;
    --panel-2: #e4e4e7 !important;
    /* Chip filter (jtfFilter di berkas V2) memakai warna PADAT sendiri karena
       --panel-2 gelapnya tembus; ini padanan terangnya. */
    --jtf-chip: #e4e4e7 !important;
    --jtf-chip-sorot: #d4d4d8 !important;
    --jtf-pop: #ffffff !important;
    --border: #d4d4d8 !important;
    --text: #09090b !important;
    --muted: #48484f !important;
    --dim: #62626a !important;
    --gold: #92400e !important;
    --gold-soft: rgba(146,64,14,.10) !important;
    --gold-dim: rgba(146,64,14,.10) !important;
    --bull: #065f46 !important;
    --bear: #c81e1e !important;
    --bull-dim: rgba(6,95,70,.09) !important;
    --bear-dim: rgba(200,30,30,.10) !important;
    --bull-soft: rgba(6,95,70,.09) !important;
    --bear-soft: rgba(200,30,30,.10) !important;
    /* alias skema jurnal */
    --ground: #ffffff !important;
    --surface: #f4f4f5 !important;
    --surface-2: #e4e4e7 !important;
    --border-soft: #e4e4e7 !important;
    --ink: #09090b !important;
    --ink-dim: #48484f !important;
    --ink-faint: #62626a !important;
    --accent: #92400e !important;
    --accent-dim: #92400e !important;
    --accent-soft: rgba(146,64,14,.10) !important;
    --profit: #065f46 !important;
    --profit-soft: rgba(6,95,70,.09) !important;
    --loss: #c81e1e !important;
    --loss-soft: rgba(200,30,30,.10) !important;
  }
  [data-tema='terang'] html, [data-tema='terang'] body,
  [data-tema='terang'] .ema-screener, [data-tema='terang'] .es-main,
  [data-tema='terang'] .es-wrap, [data-tema='terang'] .es-content {
    background: #ffffff !important;
  }
  [data-tema='terang'] .ema-screener select,
  [data-tema='terang'] .ema-screener input[type="text"],
  [data-tema='terang'] .ema-screener input[type="number"] {
    border-color: #a1a1aa !important;
    background: #ffffff !important;
    color: #27272a !important;
  }
  /* Tombol utama ikut berbalik: di tema gelap ia putih dengan teks gelap,
     jadi di tema terang ia gelap dengan teks putih. "Putih" di sana
     berarti "permukaan paling menonjol", bukan putih harfiah. */
  /* ── TOMBOL PINDAI ────────────────────────────────────────────────
     Kelasnya .es-priority-btn — dipakai BERTIGA: "Cari Sinyal Pantau",
     "Cari Sinyal Parallel", dan "Cari Sinyal Prioritas ICT". Yang kedua
     berganti tulisan jadi "Cari Sinyal SNR H4" lewat JS, jadi ia tidak
     bisa dicari dari teksnya di berkas — id-nya esChBtn.

     Tiga nama yang saya tulis sebelumnya (.es-scan-btn,
     .es-priority-scan-btn, .es-pantau-scan-btn) TIDAK ADA di V2. Saya
     mengarangnya dari tebakan penamaan, dan aturan yang tidak pernah
     cocok tidak memberi tanda apa pun bahwa ia salah — ia cuma diam.
     Yang ini diambil dari sumber V2-nya.

     Aslinya: teks & tepi var(--gold) #c9a24b di atas var(--panel). Emas
     itu dibuat untuk latar gelap; di atas putih ia tinggal 2,5:1 dan
     nyaris hilang. Jadi emasnya digelapkan, bukan diganti warna lain —
     tombol ini penanda "aksi utama section" di seluruh V2, dan menukar
     warnanya di satu tema memutus hubungan itu.

     Ditulis dengan .ema-screener di depannya supaya menang tanpa harus
     bergantung pada urutan berkas. */
  [data-tema='terang'] .ema-screener .es-priority-btn {
    background: #ffffff !important;
    border-color: #a16207 !important;
    color: #854d0e !important;
  }
  [data-tema='terang'] .ema-screener .es-priority-btn:hover {
    background: #fbf3e4 !important;
  }

  /* ── DUA TOMBOL YANG DIKUNCI LEWAT ID ─────────────────────────────
     "Cari Sinyal Pantau" tetap tidak terbaca meski aturan
     .es-priority-btn di atas sudah benar. Sebabnya bukan kelasnya —
     V2 punya aturan TERPISAH ber-ID untuknya (baris 1349):

         #esLiveTradeBtn, #esPantauBtn { color:#fff !important; ... }

     Satu id itu bernilai (1,0,0); selektor saya di atas cuma (0,3,0).
     Keduanya !important, jadi yang menentukan kekhususannya — dan id
     menang. Itu sebabnya "Cari Sinyal SNR H4" ikut berubah sementara
     tetangganya tidak: yang kedua punya aturan id, yang pertama tidak.

     Disapu dulu sebelum ditambal: di SELURUH berkas V2 hanya ADA SATU
     aturan yang memaksa teks putih dengan !important, yaitu ini. Jadi
     memperbaikinya menutup seluruh kelas masalahnya, bukan satu contoh.

     Idnya dipakai balik supaya (1,1,0) > (1,0,0). #esLiveTradeBtn ikut
     meski kotak Live Trading sedang disembunyikan — ia berbagi aturan
     yang sama persis, dan meninggalkannya berarti menanam bug yang
     muncul entah kapan nanti saat kotak itu ditampilkan lagi.

     Teksnya netral gelap, BUKAN emas seperti tombol di atas. Di tema
     gelap tombol ini memang sengaja dibedakan: putih polos + kedip,
     bukan emas — dan perbedaan itu ikut dipertahankan.

     Kedipnya TIDAK dimatikan. chScanGlow cuma menganimasikan box-shadow
     merah<->hijau; ia penanda "tombol ini yang memulai pemindaian", dan
     itu berlaku di tema mana pun. */
  [data-tema='terang'] #esPantauBtn,
  [data-tema='terang'] #esLiveTradeBtn {
    color: #09090b !important;
    background: #ffffff !important;
    border-color: #a1a1aa !important;
  }
  [data-tema='terang'] #esPantauBtn:hover,
  [data-tema='terang'] #esLiveTradeBtn:hover {
    background: #f4f4f5 !important;
  }
  [data-tema='terang'] .es-section-head,
  [data-tema='terang'] .es-priority-header {
    color: #09090b !important;
  }
  [data-tema='terang'] * {
    scrollbar-color: #d4d4d8 transparent !important;
  }

  /* ══════════════════════════════════════════════════════════════════════
     BARIS FILTER SEBAGAI DERETAN CHIP
     ══════════════════════════════════════════════════════════════════════
     Diminta pemilik 9 Sep 2026, mengikuti komponen "Filters" yang ia kirim.
     Barisnya kini dibangun komponen jtfFilter di berkas V2 (skrip di ujung
     ema-cross-screener_3.html): tombol filter → jenis → nilai → chip.
     Empat <select> penyaring disembunyikan olehnya, jadi aturan select di
     bawah ini sekarang hanya menjangkau select kalender ekonomi — masih
     perlu, supaya bentuknya seragam dengan chip di sebelahnya.

     ── KENAPA DI SINI, BUKAN DI BERKAS V2 ────────────────────────────────
     Percobaan pertama menulisnya di ema-cross-screener_3.html, dan hasilnya
     RUSAK: aturan ".ema-screener select { background: … !important }" di
     blok atas berkas INI menimpa "background" sebagai shorthand, jadi
     gambar latarnya terhapus dan "background-repeat" kembali ke "repeat" —
     chevron 9 px berubah jadi deretan garis seperti barcode di seluruh
     lebar select. Sudah dipulihkan; berkas V2 kembali seperti semula.

     Pelajarannya: penampilan screener di dalam aplikasi dimiliki berkas
     ini, bukan berkas V2. Menaruhnya di dua tempat berarti dua aturan yang
     berkelahi lewat !important, dan yang menang bergantung pada urutan
     muat yang tidak dijamin siapa pun.

     ── KENAPA "!important" DAN URUTAN INI ────────────────────────────────
     Aturan yang ditimpa sendiri memakai !important, jadi ini satu-satunya
     cara menang. Kekhususannya juga dinaikkan lewat ".es-priority-controls"
     di tengah, dan bloknya sengaja ditaruh PALING AKHIR supaya juga menang
     atas blok "[data-tema='terang']" yang kekhususannya setara.

     ── SATU HAL YANG TIDAK IKUT DIPINJAM ─────────────────────────────────
     Contohnya punya ruas "is" di tengah tiap chip ("Priority is High").
     Itu masuk akal untuk filter berbentuk medan-operator-nilai. Di sini
     isinya pilihan, bukan perbandingan: "TF is 4 Jam" cuma menambah satu
     kata yang tidak menjelaskan apa pun.

     Warna ikonnya dipatok #7a7a80. background-image tidak bisa mewarisi
     currentColor, dan abu tengah itu satu-satunya nilai yang tetap terbaca
     di tema gelap maupun terang. */
  .ema-screener .es-priority-controls { gap: 6px !important; }

  .ema-screener .es-priority-controls select,
  .ema-screener .es-priority-controls .es-priority-btn,
  .ema-screener .es-priority-controls .es-ai-regime {
    height: 28px !important;
    border-radius: 5px !important;
    font-size: 12px !important;
  }

  .ema-screener .es-priority-controls select {
    -webkit-appearance: none !important;
    appearance: none !important;
    /* background-color, BUKAN shorthand: shorthand-lah yang tadi
       menghapus gambar latarnya sendiri. */
    background-color: var(--panel-2) !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a7a80' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") !important;
    background-repeat: no-repeat !important;
    background-position: right 8px center !important;
    background-size: 9px 9px !important;
    border-color: transparent !important;
    color: var(--muted) !important;
    padding: 0 24px 0 10px !important;
  }
  /* --panel-3 TIDAK ADA di dalam iframe (terukur: untai kosong), dan
     var() yang tak terdefinisi membuat deklarasinya batal -- latarnya
     hilang sama sekali begitu kursor lewat. --v2-panel-3 ada di kedua
     tema; fallback-nya tetap dipasang supaya sorotan paling buruk cuma
     "tidak berubah", bukan "jadi bening". */
  .ema-screener .es-priority-controls select:hover {
    background-color: var(--v2-panel-3, var(--panel-2)) !important;
    color: var(--text) !important;
  }

  /* ── CHIP FILTER (komponen jtfFilter di berkas V2) ─────────────────────
     Aturan ".ema-screener button { border-radius: 6px !important }" di atas
     memaksa SEMUA tombol jadi 6 px — termasuk ruas tengah chip yang harus
     siku supaya menyambung dengan tetangganya. Ditulis ulang di sini dengan
     !important yang sama; tanpa ini chip terlihat seperti tiga tombol
     terpisah, bukan satu pil bersambung. Warnanya tidak diatur di sini:
     chip memakai var(--panel-2)/--muted/--text yang sudah ikut tema. */
  .ema-screener .jtf-seg { border-radius: 0 !important; font-size: 12px !important; }
  .ema-screener .jtf-seg-awal { border-radius: 5px 0 0 5px !important; }
  .ema-screener .jtf-seg-akhir { border-radius: 0 5px 5px 0 !important; }
  .ema-screener .jtf-tambah, .ema-screener .jtf-reset { border-radius: 5px !important; }

  .ema-screener .es-priority-controls .es-ai-regime {
    background: var(--panel-2) !important;
    border-color: transparent !important;
  }

  /* Layar sempit: tingginya dikembalikan ke ukuran sentuh. Berkas V2 sudah
     menaikkannya jadi 38 px di bawah 820 px, dan aturan chip di atas
     memakai !important yang mengalahkannya — jadi angkanya ditulis ulang
     di sini, bukan dibiarkan kalah diam-diam. */
  @media (max-width: 820px) {
    .ema-screener .es-priority-controls select,
    .ema-screener .es-priority-controls .es-priority-btn,
    .ema-screener .es-priority-controls .es-ai-regime {
      height: 36px !important;
    }
  }

  [data-tema='terang'] *::-webkit-scrollbar-thumb {
    background: #d4d4d8 !important;
  }
`;function X({tinggi:m,onPilihSimbol:p}={}){const c=o.useRef(null),g=o.useCallback(()=>{var n;try{const r=(n=c.current)==null?void 0:n.contentDocument;if(!(r!=null&&r.documentElement))return;const a=document.documentElement.getAttribute("data-tema");a?r.documentElement.setAttribute("data-tema",a):r.documentElement.removeAttribute("data-tema")}catch{}},[]);o.useEffect(()=>{g();const n=new MutationObserver(g);return n.observe(document.documentElement,{attributes:!0,attributeFilter:["data-tema"]}),()=>n.disconnect()},[g]);const f=H();o.useEffect(()=>{const n=r=>{if(r.origin!==window.location.origin)return;const a=r.data;if(!a||a.jt!=="buka-chart"||typeof a.simbol!="string")return;const i=new URLSearchParams({simbol:a.simbol});typeof a.tf=="string"&&a.tf&&i.set("tf",a.tf);for(const s of["sl","tp"]){const d=Number(a[s]);isFinite(d)&&d>0&&i.set(s,String(d))}if((a.arah==="BUY"||a.arah==="SELL")&&i.set("arah",a.arah),p){const s=d=>{const u=Number(a[d]);return isFinite(u)&&u>0?u:void 0};p({simbol:a.simbol,tf:typeof a.tf=="string"&&a.tf?a.tf:void 0,sl:s("sl"),tp:s("tp"),arah:a.arah==="BUY"||a.arah==="SELL"?a.arah:void 0});return}i.set("screener","1"),f(`/chart-entry?${i}`)};return window.addEventListener("message",n),()=>window.removeEventListener("message",n)},[f,p]);const[k,x]=o.useState(null),[E,j]=o.useState(!1),[h,A]=o.useState(!1),[T,I]=o.useState(0),{pengguna:v}=V(),l=L()&&!v,{paket:w,muatUlang:S}=K(),[B,y]=o.useState(null),[P,D]=o.useState("");return o.useEffect(()=>{if(l||!v){y(!0);return}const n="jt.paket.screener.sesi";let r=!1;return(async()=>{try{if(sessionStorage.getItem(n)==="1"){r||y(!0);return}}catch{}const a=await C("screener");if(!r){if(a.boleh){try{sessionStorage.setItem(n,"1")}catch{}y(!0)}else D(a.alasan??"Jatah screener paket ini sudah habis."),y(!1);S()}})(),()=>{r=!0}},[l,v,S]),o.useEffect(()=>{if(l)return;let n=!0;return(async()=>{j(!1),A(!1),x(null);for(const r of G())try{const a=await fetch(r,{method:"HEAD"});if(!n)return;if(a.ok){x(r);return}}catch{}n&&x(J)})(),()=>{n=!1}},[T,l]),o.useEffect(()=>{if(!k||h)return;const n=setTimeout(()=>j(!0),15e3);return()=>clearTimeout(n)},[k,h]),B===!1?e.jsx("div",{className:"flex min-h-[70vh] items-center justify-center p-6",children:e.jsxs("div",{className:"w-full max-w-lg rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-6",children:[e.jsx("div",{className:"text-[14px] font-medium text-amber-300",children:"Jatah Screener sudah habis"}),e.jsxs("p",{className:"mt-2 text-[12.5px] leading-relaxed text-zinc-400",children:[P," Paket ",e.jsx("span",{className:"text-zinc-200",children:M[w.paket]})," memberi"," ",e.jsx("span",{className:"angka text-zinc-200",children:w.batas.screener})," kali akses per masa aktif, dan semuanya sudah terpakai. Jatahnya kembali penuh saat masa aktifmu diperpanjang."]}),e.jsxs("div",{className:"mt-4 flex flex-wrap gap-2",children:[e.jsx(N,{to:"/harga",className:"rounded-md bg-zinc-100 px-4 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:"Lihat paket tanpa batas"}),e.jsx(N,{to:"/dashboard",className:"rounded-md border border-zinc-800 px-4 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700",children:"Kembali ke Dashboard"})]})]})}):l?e.jsx(Y,{judul:"Screener Area",ket:e.jsxs(e.Fragment,{children:["Pemindai yang membaca ratusan simbol Binance langsung dari pasar. Angkanya ",e.jsx("b",{children:"bukan data contoh"}),", jadi tiap pemindaian benar-benar memanggil proxy pasar kami — itu alasan halaman ini minta akun, bukan karena isinya rahasia."]}),poin:[["Delapan section screener V2","Sinyal Entry Koin Favorit, Cross Hunter, BBMA, AI, News, panel simulasi, dan strip rezim BTC."],["Menyambung ke Chart & Entry","Klik satu simbol dari hasil pindai dan chartnya terbuka dengan setelan yang sama."],["Berjalan di atas data sekarang","Berbeda dari halaman preview lain — yang ini alat yang sesungguhnya, bukan peraga."]]}):E?e.jsxs("div",{className:"flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center",children:[e.jsx(U,{className:"size-6 text-amber-500",strokeWidth:1.9}),e.jsx("div",{className:"text-[14px] text-zinc-200",children:"Screener tidak bisa dimuat"}),e.jsxs("p",{className:"max-w-md text-[12.5px] leading-relaxed text-zinc-500",children:["Berkas ",e.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"ema-cross-screener_3.html"})," tidak ditemukan di alamat mana pun yang dicoba. Kalau ini di VPS, pastikan foldernya sudah diunggah ke"," ",e.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"/root/v2"}),"."]}),e.jsxs("div",{className:"mt-1 flex flex-wrap justify-center gap-2",children:[e.jsxs("button",{onClick:()=>I(n=>n+1),className:"flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:[e.jsx(F,{className:"size-3.5"})," Coba lagi"]}),e.jsxs("a",{href:"https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html",target:"_blank",rel:"noreferrer",className:"flex items-center gap-1.5 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:["Buka di tab baru ",e.jsx(z,{className:"size-3.5"})]})]})]}):e.jsx("div",{className:"relative",children:e.jsxs("div",{className:"bg-zinc-950",style:{height:m?`${m}px`:"calc(100vh - 56px)"},children:[!h&&e.jsx(R,{className:"absolute inset-0",pesan:"Memuat screener…"}),k&&e.jsx("iframe",{ref:c,src:k,title:"Crypto Screener",onLoad:n=>{var r;A(!0);try{const a=n.currentTarget,i=a.contentDocument;if(!i)return;if(l){const t=a.contentWindow;(r=t==null?void 0:t.jtModeTamu)==null||r.call(t)}if(!i.getElementById("jt-v3-tanpa-cangkang")){const t=i.createElement("style");t.id="jt-v3-tanpa-cangkang",t.textContent=_,(i.head||i.documentElement).appendChild(t)}g();const s=i.querySelector(".es-pantau-title");if(s&&(s.textContent="Koin Hunter"),s&&!p&&!i.getElementById("jt-buka-chart")){const t=i.createElement("button");t.id="jt-buka-chart",t.type="button",t.title="Buka di Chart & Entry — Koin Hunter ikut terpasang di panel kiri",t.setAttribute("aria-label","Buka di Chart dan Entry"),t.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" style="width:15px;height:15px;display:block"><path d="M3 2v11.5h11"/><path d="M5.5 5v5.5M5.5 4v1M5.5 10.5v1"/><path d="M9 3.5v6M9 2.5v1M9 9.5v1"/><path d="M12.5 6.5v4M12.5 5.5v1M12.5 10.5v1"/></svg>',t.style.cssText="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex:0 0 auto;border:1px solid #3a3f4b;border-radius:6px;background:transparent;color:inherit;cursor:pointer;padding:0;opacity:.75",t.addEventListener("mouseenter",()=>{t.style.opacity="1"}),t.addEventListener("mouseleave",()=>{t.style.opacity=".75"}),t.addEventListener("click",b=>{b.preventDefault(),b.stopPropagation(),f("/chart-entry?screener=1")}),s.style.display="flex",s.style.alignItems="center",s.style.gap="8px",s.insertBefore(t,s.firstChild)}const d=i.querySelector('[data-section="crosshunter"] .es-priority-title');d&&(d.textContent="Zona Pantau");const u=()=>{var t,b;(t=i.body)==null||t.style.setProperty("padding-left","0","important"),(b=i.body)==null||b.style.setProperty("padding-right","0","important")};u(),i.body&&new MutationObserver(u).observe(i.body,{attributes:!0,attributeFilter:["style","class"]})}catch{}},className:`block h-full w-full border-0 transition-opacity duration-200 ${h?"opacity-100":"opacity-0"}`,sandbox:"allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals",allow:"clipboard-write"})]})})}export{X as default};
