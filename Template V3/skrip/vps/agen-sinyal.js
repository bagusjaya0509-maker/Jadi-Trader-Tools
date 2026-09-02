#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   AGEN SINYAL — dua trader forward test tanpa modal
   ════════════════════════════════════════════════════════════════════════
   Dua agen memposting ke /api/analisa/agen dan dinilai papan peringkat Copy
   Signal dengan metrik yang sama persis dengan analis manusia. Tidak ada
   pengukur khusus yang bisa memihak mereka.

   KENAPA BUKAN LLM YANG MEMUTUSKAN ENTRY. Model bahasa sangat pandai
   menyusun alasan yang terdengar masuk akal, dan sangat buruk menilai
   apakah sebuah edge itu nyata. Ia selalu punya penjelasan — untuk
   keputusan benar maupun salah — dan itu membuat hasilnya tidak bisa
   dibantah. Yang di bawah ini aturan tetap: bisa dihitung ulang siapa pun,
   dan tidak berubah pendapat karena kalimatnya disusun berbeda.

   HANYA BAR YANG SUDAH TUTUP. Lilin terakhir dari Binance masih berjalan;
   memakainya berarti sinyal bisa muncul lalu hilang di dalam bar yang sama,
   dan rekam jejaknya jadi fiksi. Dibuang satu kali di `klines()`.

   `evaluasi()` MURNI — hanya menerima deret bar, tidak menyentuh jaringan.
   Itu yang membuat uji-agen.js bisa menjalankan keputusan yang sama persis
   di atas ribuan bar sejarah. Kalau backtest memakai salinan logikanya,
   yang teruji adalah salinannya, bukan yang benar-benar memposting.
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');

const AKAR = '/root/binance-trading-backend';
try { require('dotenv').config({ path: path.join(AKAR, '.env') }); } catch (e) { /* uji lokal */ }

const TOKEN = process.env.APP_TOKEN;
const BINANCE = (process.env.BINANCE_BASE_URL || 'https://fapi.binance.com').replace(/\/$/, '');
const LOKAL = 'http://127.0.0.1:' + (process.env.PORT || 4000);

/* ── Ongkos bolak-balik Binance Futures ─────────────────────────────────
   Taker 0,04% per sisi = 0,08% pulang-pergi. Angka inilah yang membunuh
   scalping: kalau jarak SL cuma 0,25%, ongkos memakan sepertiga risiko dan
   sistemnya harus jauh lebih tajam daripada kelihatannya sekadar untuk
   impas. Dipakai sebagai LANTAI jarak stop, bukan sekadar catatan kaki. */
const ONGKOS_PP = 0.0008;

/* Tetap `const` meski satu strategi ditambahkan sesudahnya: yang dilarang
   const adalah mengikat ulang namanya, bukan menambah kunci ke objeknya. */
const STRATEGI = {
  tren: {
    nama: 'Agen Tren',
    tf: '4h',
    pasangan: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
               'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TONUSDT'],
    lookback: 55,       // Donchian klasik — sedikit knob, sedikit ruang menipu diri
    atrKali: 2.0,
    rr: 3.0,            // TP = 3x jarak stop
    filterTren: false,  // breakout-nya SENDIRI yang jadi penanda tren
    stopMin: 0.008,     // 0,8% -> ongkos = 10% dari risiko. Longgar di 4H.
  },
  /* ── AGEN CEPAT — intraday, BUKAN scalping 15m ────────────────────────
     Dimintanya agen scalping, supaya datanya terkumpul jauh lebih cepat
     daripada enam bulan yang dibutuhkan agen tren. Yang dikirim intraday
     1H, dan alasannya terukur, bukan selera.

     Versi 15m-nya dijalankan lebih dulu di uji-agen.js: 763 trade, win rate
     34,7% melawan impas 33,3% — jadi sinyalnya PUNYA edge tipis, +32R
     kotor. Lalu ongkos memakan 139R dan hasilnya -107R. Sebabnya satu
     angka: stop rata-rata 0,49%, sementara ongkos pulang-pergi 0,08%, jadi
     0,18R terbakar setiap trade sedangkan edge-nya cuma 0,04R.

     Sapuan 16 kombinasi memastikan itu bukan kebetulan: pada stop sempit
     (atr 1,2) hanya 1 dari 8 sel positif; pada stop lebar (atr 2,5) ada 6
     dari 8. Sumbu yang menentukan adalah lebar stop, persis seperti yang
     diramalkan aritmetika ongkos sebelum diukur. Di 1H dengan atr 2,5,
     ongkos turun ke 0,045R — seperempat beban versi 15m.

     ANGKA YANG PANTAS DIHARAPKAN +0,02 sampai +0,04R per trade, bukan
     +0,216R yang keluar dari sapuan. Yang terakhir itu hasil MEMILIH sel
     terbaik dari 16, dan uji luar-sampel memangkasnya jadi +0,040R di
     periode lain dan +0,015R di tujuh koin yang tidak ikut disapu. Tipis,
     tapi positif di dua pemeriksaan yang tidak bisa dicurangi pemilihan.

     Sepuluh pasangan, bukan tiga: ketujuh koin tambahan diuji sebagai
     kelompok di luar sampel dan hasilnya positif, dan lebih banyak
     pasangan berarti sampel penuh lebih cepat — yang memang tujuan agen
     ini. Sebaran per koin juga lebar (XRP +18R, DOGE -11R); menjalankan
     tiga saja berarti mempertaruhkan kesimpulan pada koin mana yang
     kebetulan terpilih. */
  cepat: {
    nama: 'Agen Cepat',
    tf: '1h',
    pasangan: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
               'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TONUSDT'],
    lookback: 20,
    atrKali: 2.5,
    rr: 2.0,
    /* SEARAH TREN 4H, WAJIB. Melawan arah di kripto adalah cara tercepat
       tertabrak: pergerakan searah tren jauh lebih sering berlanjut
       daripada berbalik. */
    filterTren: true,
    /* Lantai 0,35% jarang mengikat di 1H dengan atr 2,5 — ia pengaman untuk
       jam-jam paling sepi, bukan pengatur utama. */
    stopMin: 0.0035,
  },
  /* ── AGEN MOMENTUM — logika Momentum Candle Sekolah Trading ───────────
     Deteksi candle-nya SALINAN skrip Pine milik pemilik, bagian 10-13:
     badan >= ambang, total ekor <= 30% dari (badan+ekor), mode agresif,
     lalu disaring arah EMA.

     AMBANG DITERJEMAHKAN, BUKAN DITEBAK. Skrip aslinya memakai pip tetap
     per pasangan (BTCUSD 80/120/160 di M5/M15/M30). Angka tetap tidak bisa
     dibawa ke sepuluh koin -- dan lebih buruk, ia membusuk sendiri: 80
     dolar adalah 0,10% saat BTC 77.000 dan 0,27% saat BTC 30.000, jadi
     indikatornya berubah arti mengikuti harga tanpa ada yang menyetelnya.
     Diukur ulang, ketiga ambang BTC itu ternyata 0,49x / 0,47x / 0,42x
     ATR(14) -- sebaran cuma 15%, jadi yang dimaksud pembuatnya memang
     kelipatan volatilitas. 0,46x yang dipakai di sini.

     TIMEFRAME 4H, dan itu BUKAN pilihan selera. Skripnya untuk M5/M15/M30;
     ketiganya diuji dan ketiganya rugi -- bukan karena sinyalnya jelek,
     melainkan karena ongkos. Win rate ADA DI ATAS impas hampir di semua
     timeframe (34,7% lawan 33,3%), tapi ongkos pulang-pergi memakan 0,27R
     per trade di 15m, 0,16R di 30m, 0,11R di 1H, dan baru 0,040R di 4H.
     Edge-nya sekitar 0,05-0,09R, jadi hanya di 4H ia selamat.

     ENTRY DI TEMBUSAN, bukan di harga tutup. Ini yang tidak tertulis di
     mana pun -- videonya tidak bisa diambil transkripnya dan situs
     resminya menolak koneksi. Jadi kedua tafsir dijalankan berdampingan di
     data yang sama, dan "tembus" menang di 8 DARI 8 perbandingan (empat
     timeframe x dua rasio). Bukan satu sel beruntung; itu urutan.

     Order ini MENUNGGU HARGA: entry di ujung candle yang belum tersentuh.
     Kalau tidak tertembus dalam 3 bar ia DIBATALKAN -- lihat sapuBasi() di
     bawah. Tanpa pembatalan itu, order yang baru tersentuh berhari-hari
     kemudian tetap dihitung, dan papan peringkat menilai sistem yang
     berbeda dari yang diukur.

     Angka terukurnya: +0,089R dasar, +0,156R dengan filter EMA (1.017
     trade / 500 hari). Luar sampel: +0,049R di paruh tua, +0,152R di paruh
     muda, +0,021R di delapan koin yang tidak ikut memilih. Yang pantas
     diharapkan ada di kisaran bawah itu, bukan di +0,156R. */
  momentum: {
    nama: 'Agen Momentum',
    jenis: 'momentum',
    /* ── XAUUSD SAJA, M15, METODE VIDEO ────────────────────────────────
       Permintaan pemilik, dan ia yang memutuskan sesudah angkanya
       dibentangkan. Yang perlu diketahui siapa pun yang membaca ini
       kemudian:

       SUMBER LILIN BUKAN BINANCE. Binance Futures tidak punya XAUUSD sama
       sekali, jadi memindahkan daftar pasangannya saja akan membuat agen
       ini diam selamanya tanpa satu pun galat. Lilinnya datang dari
       terminal MT5 pemilik lewat rute yang sama persis dengan chart di
       situs -- lihat klinesMt5().

       TP 27,2% ITU PILIHAN SADAR PEMILIK, BUKAN HASIL PENGUKURAN. Diuji di
       3000 bar XAUUSD miliknya sendiri dengan spread nyata 0,26 USD,
       susunan ini rugi di kedua paruh sejarah (-0,054 dan +0,042 per
       trade) dan gagal uji belah-dua. Menggeser satu angka ini ke 1.618
       membuatnya untung di kedua paruh (+0,033 dan +0,041) DAN untung di
       M15/30m/4H sekaligus -- plateau, bukan puncak. Pemilik memilih tetap
       persis video supaya yang diuji ke depan adalah metode aslinya.
       Kalau suatu saat papan peringkatnya membenarkan pengukuran ini,
       yang perlu diubah cuma tpFib di bawah.

       ENTRY RETEST, BUKAN MARKET. Videonya menyebut tiga cara: market,
       retest 23,6%, atau layering. Layering butuh dua order untuk satu
       ide dan tidak bisa diwakili satu sinyal. Dari dua sisanya, retest
       terukur jauh lebih baik di SETIAP timeframe (M15: 45,3% -> 52,7%
       winrate), jadi yang dipakai itu -- masih di dalam videonya. */
    tf: '15m',
    sumber: 'mt5',
    pasangan: ['XAUUSD'],
    entryFib: 0.236,     // limit menunggu retest, opsi dari video
    tpFib: 1.272,        // TP di 127,2% fibo candle -- "27,2%" di video
    rr: 1,               // SL 1:1 dengan TP, sesuai video
    /* Spread XAUUSD Exness-MT5Real20 terukur 0,26 USD pada harga ~4670 =
       0,00557%. Ongkos Binance (0,08%) empat belas kali lebih mahal, dan
       memakainya di sini akan menolak hampir semua setup gold. */
    ongkosPp: 0.0000557,
    ambangAtr: 0.46,     // hasil kalibrasi dari pip skrip aslinya
    ekorMaks: 0.30,      // bagian 2 skrip Pine: "Max Wick % dari Total Candle"
    konservatif: false,  // bagian 1: mode Agresif (terukur lebih baik)
    emaLen: 50,          // bagian 4: filter tren EMA
    barKedaluwarsa: 6,   // retest tak datang 6 bar (90 menit) -> batal
    /* ── LAYERING: MARKET + LIMIT BERBAGI SL ────────────────────────────
       Opsi ketiga di video, dan diminta pemilik. DIMATIKAN karena diukur di
       3000 bar XAUUSD-nya sendiri, dan yang mematikannya bukan selera:

         kaki limit, SL 1:1 dari entry sendiri   +0,009R / trade  (ini yang jalan)
         kaki market, SL 1:1 dari tutup candle   -0,153R / trade
         kaki market, SL di ujung candle         -0,052R / trade  (WR 68,7%!)
         market + limit berbagi SL, gabungan     -0,143R / trade

       Sebabnya struktural, bukan kebetulan: entry market ada di harga tutup
       candle, jadi SL 1:1 dari situ mendarat 0,272xR -- masih DI DALAM badan
       candle yang baru saja terbentuk. Harga hampir selalu menoleh ke dalam
       badan itu sesudah momentum, jadi stopnya diuji oleh tarikan napas
       biasa, bukan oleh ide yang salah.

       Baris WR 68,7% patut diingat: menang sering, tetap rugi. Stop jauh,
       target dekat.

       Nyalakan dengan mengubah satu kata di bawah kalau ingin tetap
       memforward-test versi videonya apa adanya. */
    kakiMarket: false,
  },

  /* ══════════════════════════════════════════════════════════════════
     AGEN FVG — sweep likuiditas -> CHoCH -> FVG -> retrace
     ══════════════════════════════════════════════════════════════════
     RANGKANYA dari enam carousel yang dikirim pemilik. ANGKANYA tidak, dan
     itu harus jelas bagi siapa pun yang membacanya nanti: 40 slide itu
     berisi 11 label, nol angka, nol timeframe, dan enam contoh menang tanpa
     satu pun contoh kalah. Yang konsisten di 5 dari 6 cuma urutannya.

     Semua angka di bawah dipilih dengan pengukuran di 53 deret harga (49
     pasangan kripto + 4 timeframe gold), bukan dikutip.

     HASIL TERUKUR pada susunan ini: 145 trade, winrate 39,3%, RR rata-rata
     2,99, bersih +0,237R per trade, positif di KEDUA paruh waktu
     (+0,789 / +0,192).

     KENAPA barValid 8 DAN BUKAN 15. Ini satu-satunya parameter yang
     benar-benar menentukan, dan kurvanya monoton di dua pasar yang ongkosnya
     sepuluh kali berbeda:
         barValid  5    8     10    15
         kripto   .150 .196  .174  .034
         gold     .385 .447  .279  .039
     FVG yang tidak dikunjungi ulang dalam 8 bar sudah kehilangan artinya —
     harganya pergi tanpa mengisi celah itu, dan masuk belakangan berarti
     masuk ke keadaan pasar yang sudah lain.

     KENAPA SL DI BALIK FVG, BUKAN DI BALIK EKSTREM SWEEP. Sumbernya punya
     dua-duanya di carousel berbeda. Diadu langsung:
         di balik FVG    145 trade, WR 39,3%, RR 2,99, +0,237R
         di balik sweep   17 trade, WR 41,2%, RR 1,97, +0,035R
     Stop lebar menaikkan winrate dua poin lalu memangkas RR jadi separuh,
     dan menyaring habis 88% setupnya karena RR-nya tak lagi memadai. RR
     indah dan stop lebar di sumbernya tidak pernah muncul di setup yang
     sama — setelah diukur, memang tidak bisa.

     WINRATE 39% ITU BUKAN KERUSAKAN. Di RR 3, ekspektasinya 0,39x3 - 0,61 =
     +0,56R kotor. Sistem RR-tinggi memang kalah lebih sering daripada
     menang; yang menentukan besar kemenangannya.
     ══════════════════════════════════════════════════════════════════ */
  fvg: {
    nama: 'Agen FVG',
    jenis: 'fvg',
    tf: '1h',
    sumber: 'auto',        // ...USDT -> Binance, selain itu -> feed MT5
    pasangan: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
               'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TONUSDT', 'DOTUSDT', 'LTCUSDT',
               'NEARUSDT', 'APTUSDT', 'ATOMUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT',
               'SUIUSDT', 'SEIUSDT', 'TIAUSDT', 'XAUUSD'],
    pivot: 5,              // bar kiri-kanan untuk mengesahkan swing
    barSweep: 8,           // batas menunggu harga close balik sesudah menyapu
    barChoch: 15,          // batas menunggu penembusan struktur
    barKedaluwarsa: 8,     // order limit hangus sesudah 8 bar -- lihat catatan
    celahAtr: 0.05,        // celah FVG minimal, relatif ATR(14)
    bufferSl: 0.25,        // SL sejauh 0,25x tinggi FVG di balik kotaknya
    rrMin: 1.2,
  },

  /* ══════════════════════════════════════════════════════════════════
     AGEN FABLE — breakout range gold 4H, SISI BELI SAJA
     ══════════════════════════════════════════════════════════════════
     Strategi ini tidak berasal dari sumber mana pun. Ia hasil pencarian
     sendiri sesudah DELAPAN hipotesis lain gugur: momentum lintas-aset,
     kontrarian, short-terkuat kripto, peringkat funding, carry funding
     netral-pasar, breakout per sesi, breakout sisi-jual, dan breakout
     dua-arah. Semuanya mati di kontrol beta atau tidak bertahan pindah
     timeframe.

     ATURANNYA: range 3 bar terakhir (12 jam). Harga menembus ATAS range
     -> BUY di level tembusan, SL di dasar range, TP 1,5x jarak SL.
     Tembusan ke BAWAH diabaikan -- sisi jual terukur -0,168R.

     DUA ANGKA, DAN YANG BERLAKU ADALAH YANG LEBIH KECIL.

       backtest terpisah : 251 trade, WR 49%, +0,207R, DD 14,4%
       KODE INI SENDIRI  : 263 trade, WR 42%, +0,047R, DD 25,3%

     Keduanya menulis aturan yang sama dan tidak bisa didamaikan. Yang
     mengikat adalah baris kedua -- ia diukur dengan menjalankan fungsi
     yang benar-benar memposting ke papan, bukan salinannya. Di sesi yang
     sama, backtest terpisah sudah DUA KALI melahirkan angka yang tidak
     bisa direproduksi kode produksi (FVG +0,779R yang ternyata bug, dan
     momentum). Jadi asumsinya: yang tinggi salah sampai terbukti sebaliknya.

     +0,047R per trade itu praktis nol. Modal 1000 -> 1109 dalam 663 hari,
     dengan drawdown 25,3% -- lebih buruk per satuan risiko daripada
     sekadar memegang gold (1764, DD 28,5%). Agen ini TIDAK terbukti
     mengalahkan beli-dan-tahan.

     KENAPA INI BUKAN BETA, dan ini yang paling penting. Vonis pertama
     saya justru 'ini cuma beta' -- gold naik 76% di periode uji, jadi
     sistem yang cuma membeli pasti terlihat untung. Vonis itu SALAH, dan
     yang membantahnya pengukuran per rezim:

         saat gold NAIK  : +0,196R
         saat gold TURUN : +0,228R   <-- lebih besar

     Beta tidak bisa begitu. Beta hanya menghasilkan saat naik. Empat dari
     lima susunan BUY justru lebih baik di rezim turun.

     Pembandingnya: beli-dan-tahan gold memberi hasil nyaris sama
     (1764) tapi dengan drawdown 28,5% -- dua kali lipat. Per satuan
     risiko, aturan ini sekitar 1,8x lebih baik.

     BATAS YANG HARUS DIINGAT: ini hasil SATU instrumen. Aturan yang sama
     persis diuji di 24 pasangan kripto 4H dan RUGI DI SEMUANYA -- kolam
     2706 trade, -0,232R. Winrate-nya 32% di kripto lawan 49% di gold:
     breakout gold berlanjut, breakout kripto palsu, karena kripto
     dikuasai perburuan likuidasi sementara gold punya aliran institusi
     di baliknya. Ceritanya masuk akal, tapi satu instrumen tidak bisa
     membuktikan dirinya sendiri. Perlakukan sebagai hipotesis kuat yang
     sedang diforward-test, bukan kepastian.
     ══════════════════════════════════════════════════════════════════ */
  fable: {
    nama: 'Agen Fable',
    jenis: 'fable',
    tf: '4h',
    sumber: 'mt5',
    pasangan: ['XAUUSD'],
    nRange: 3,            // range 3 bar = 12 jam
    rrTp: 1.5,
    barKedaluwarsa: 8,    // tembusan tak datang 8 bar (32 jam) -> batal
    ongkosPp: 0.0000557,  // spread gold 0,26 USD pada ~4670
  },
};

/* ── Hitungan ───────────────────────────────────────────────────────── */
function atr(bar, n) {
  if (bar.length < n + 1) return 0;
  let jum = 0;
  for (let i = bar.length - n; i < bar.length; i++) {
    const p = bar[i - 1].c;
    jum += Math.max(bar[i].h - bar[i].l, Math.abs(bar[i].h - p), Math.abs(bar[i].l - p));
  }
  return jum / n;
}

const ema = (nilai, n) => {
  const k = 2 / (n + 1);
  return nilai.reduce((a, v, i) => (i ? v * k + a * (1 - k) : v));
};


/* ══ HITUNGAN SNR — PORTING HARFIAH DARI SCREENER V2 ══════════════════════
   Semua fungsi di blok ini disalin baris demi baris dari
   Template V2 Premium/ema-cross-screener_3.html, bukan ditulis ulang dari
   ingatan tentang "apa itu SNR". Alasannya diminta pemilik dengan kalimat
   "logicnya sesuai perhitungan": kalau angkanya menyimpang sedikit saja dari
   yang dulu ia lihat di layar, agen ini bukan lagi menguji metode itu — ia
   menguji tafsiran saya tentang metode itu, dan hasilnya tidak bisa dipakai
   untuk memutuskan apa pun.

   Kesetaraannya diuji, bukan diklaim: skrip/uji/uji-snr-vs-v2.js memotong
   fungsi ASLI dari berkas HTML-nya, menjalankan keduanya di deret harga acak
   yang sama, lalu membandingkan bar demi bar.

   ── DUA FUNGSI YANG SUDAH ADA DI BERKAS INI TIDAK BISA DIPAKAI ──────────
   `ema()` di atas mengembalikan SATU ANGKA (reduce tanpa larik); smiSeries
   butuh DERET. Dan `atr()` di atas rata-rata biasa dari n TR terakhir,
   sedangkan screener memakai perataan Wilder. Zona SNR lebarnya ATR x 0,5 —
   memakai ATR yang berbeda berarti kotak yang berbeda, dan sentuhan yang
   berbeda. Jadi keduanya diporting terpisah dengan nama sendiri, bukan
   dipaksa memakai yang sudah ada. */

/** EMA yang mengembalikan DERET (screener: ema). */
function emaSeri(nilai, n) {
  const k = 2 / (n + 1);
  const keluar = [nilai[0]];
  for (let i = 1; i < nilai.length; i++) keluar.push(nilai[i] * k + keluar[i - 1] * (1 - k));
  return keluar;
}

/** ATR perataan Wilder (screener: atr). Berbeda dari atr() di atas. */
function atrWilder(bar, n) {
  const j = bar.length;
  const tr = new Array(j).fill(0);
  for (let i = 0; i < j; i++) {
    if (i === 0) { tr[i] = bar[i].h - bar[i].l; continue; }
    tr[i] = Math.max(bar[i].h - bar[i].l,
                     Math.abs(bar[i].h - bar[i - 1].c),
                     Math.abs(bar[i].l - bar[i - 1].c));
  }
  const keluar = new Array(j).fill(null);
  if (j <= n) return keluar;
  let jum = 0;
  for (let i = 1; i <= n; i++) jum += tr[i];
  keluar[n] = jum / n;
  for (let i = n + 1; i < j; i++) keluar[i] = (keluar[i - 1] * (n - 1) + tr[i]) / n;
  return keluar;
}

/** Pivot (screener: findPivots). Bar ke-i pivot kalau tidak ada yang lebih
 *  tinggi (atau lebih rendah) di `kiri` bar sebelumnya dan `kanan` sesudahnya. */
function cariPivot(nilai, kiri, kanan, tinggi) {
  const keluar = [];
  for (let i = kiri; i < nilai.length - kanan; i++) {
    let pivot = true;
    for (let j = i - kiri; j <= i + kanan; j++) {
      if (j === i) continue;
      if (tinggi ? nilai[j] > nilai[i] : nilai[j] < nilai[i]) { pivot = false; break; }
    }
    if (pivot) keluar.push({ i: i, nilai: nilai[i] });
  }
  return keluar;
}

const SMI_K = 14, SMI_D = 3, SMI_EMA = 3;
const SMI_OB = 50, SMI_OS = -50;

/** Stochastic Momentum Index (screener: smiSeries). */
function smiSeri(bar, panjangK, panjangD, panjangEma) {
  const j = bar.length;
  const rel = new Array(j).fill(null);
  const rentang = new Array(j).fill(null);
  for (let i = panjangK - 1; i < j; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let k = i - panjangK + 1; k <= i; k++) {
      if (bar[k].h > hh) hh = bar[k].h;
      if (bar[k].l < ll) ll = bar[k].l;
    }
    rel[i] = bar[i].c - (hh + ll) / 2;
    rentang[i] = hh - ll;
  }
  const mulai = panjangK - 1;
  if (mulai >= j) return { smi: new Array(j).fill(null), sinyal: new Array(j).fill(null) };
  const emaEma = (a) => emaSeri(emaSeri(a, panjangD), panjangD);
  const atas = emaEma(rel.slice(mulai));
  const bawah = emaEma(rentang.slice(mulai));
  const inti = atas.map((v, i) => (bawah[i] === 0 ? 0 : 200 * (v / bawah[i])));
  const sig = emaSeri(inti, panjangEma);
  const smi = new Array(j).fill(null), sinyal = new Array(j).fill(null);
  for (let i = 0; i < inti.length; i++) { smi[mulai + i] = inti[i]; sinyal[mulai + i] = sig[i]; }
  return { smi: smi, sinyal: sinyal };
}

/** SMI ekstrem (screener: cekSmiEkstrem). Arah = arah pembalikan yang mungkin. */
function smiEkstrem(bar) {
  const st = smiSeri(bar, SMI_K, SMI_D, SMI_EMA);
  const j = st.smi.length;
  const k = st.smi[j - 1], kSblm = st.smi[j - 2];
  if (k === null || k === undefined) return null;
  let kondisi = null;
  if (k <= SMI_OS) kondisi = 'oversold';
  else if (k >= SMI_OB) kondisi = 'overbought';
  if (!kondisi) return null;
  let mulaiBalik = false;
  if (kSblm !== null && kSblm !== undefined) {
    mulaiBalik = kondisi === 'oversold' ? (k > kSblm) : (k < kSblm);
  }
  return { kondisi: kondisi, arah: kondisi === 'oversold' ? 'BUY' : 'SELL', k: k, mulaiBalik: mulaiBalik };
}

/** Sentuhan zona SNR 4 jam oleh satu candle (screener: snrTouchH4M5).
 *  Zona = pivot(10,10) 4 jam, maksimal 2 per sisi, pita ATR(14) x 0,5.
 *  "Sentuh" = EKOR masuk ke dalam pita; yang menembus habis bukan sentuhan. */
function sentuhZonaSnr(bar4, kandil) {
  const a = atrWilder(bar4, 14)[bar4.length - 1];
  if (!(a > 0)) return null;
  const tol = a * 0.5;
  const res = cariPivot(bar4.map((b) => b.h), 10, 10, true).slice(-2).map((p) => p.nilai);
  const sup = cariPivot(bar4.map((b) => b.l), 10, 10, false).slice(-2).map((p) => p.nilai);

  const o = kandil.o, hi = kandil.h, lo = kandil.l, c = kandil.c;
  const badan = Math.abs(c - o);
  const ekorAtas = hi - Math.max(o, c);
  const ekorBawah = Math.min(o, c) - lo;

  let terbaik = null;
  res.forEach((lvl) => {
    if (hi >= lvl - tol && hi <= lvl + tol) {
      const jarak = Math.abs(hi - lvl);
      if (!terbaik || jarak < terbaik.jarak) {
        terbaik = { sisi: 'R', level: lvl, jarak: jarak, arah: 'SELL', tolak: ekorAtas > badan, tol: tol };
      }
    }
  });
  sup.forEach((lvl) => {
    if (lo <= lvl + tol && lo >= lvl - tol) {
      const jarak = Math.abs(lo - lvl);
      if (!terbaik || jarak < terbaik.jarak) {
        terbaik = { sisi: 'S', level: lvl, jarak: jarak, arah: 'BUY', tolak: ekorBawah > badan, tol: tol };
      }
    }
  });
  return terbaik;
}

/** SL di luar kotak SNR + setengah tinggi kotaknya (screener: slFromSnrZone).
 *  Kotak = level +- ATR*0,5, jadi tingginya ATR; setengahnya ruang sapuan. */
function slDariZonaSnr(arah, harga, bar4, atrNow) {
  const tolZona = atrNow * 0.5;
  const sapuan = atrNow * 0.5;
  if (arah === 'SELL') {
    const res = cariPivot(bar4.map((b) => b.h), 10, 10, true).slice(-2).map((p) => p.nilai);
    const lvl = res.length ? Math.max.apply(null, res) : null;
    const dasar = (lvl != null && lvl > harga)
      ? lvl : Math.max.apply(null, bar4.slice(-15).map((b) => b.h));
    return dasar + tolZona + sapuan;
  }
  const sup = cariPivot(bar4.map((b) => b.l), 10, 10, false).slice(-2).map((p) => p.nilai);
  const lvl = sup.length ? Math.min.apply(null, sup) : null;
  const dasar = (lvl != null && lvl < harga)
    ? lvl : Math.min.apply(null, bar4.slice(-15).map((b) => b.l));
  return dasar - tolZona - sapuan;
}

/* ══ AGEN SNR ═════════════════════════════════════════════════════════════
   Dua syarat, keduanya wajib, persis seperti di screener:

     1. SMI di 4 JAM ekstrem  -> oversold = BUY, overbought = SELL
     2. Candle 5 MENIT menyentuh zona SNR yang ditarik dari 4 jam

   Arah datang dari kondisi besar, waktu masuk dari sentuhan halus.
   Entry market, SL di luar kotak + ruang sapuan, TP 1:1 dengan SL.

   ── SATU PENYIMPANGAN YANG DISENGAJA, DAN HARUS DIKETAHUI ───────────────
   Screener memeriksa candle 5 menit yang MASIH BERJALAN — pertanyaannya di
   sana "sedang menyentuh", karena orangnya sedang melihat layar dan bisa
   menekan tombol saat itu juga.

   Agen ini berjalan terjadwal, dan klines() sudah membuang lilin berjalan.
   Jadi yang diperiksa candle 5 menit yang BARU TUTUP. Bukan kelalaian:
   sentuhan pada candle berjalan bisa hilang sebelum candle itu tutup, dan
   sinyal yang diposting dari ekor yang kemudian lenyap adalah sinyal yang
   tidak pernah benar-benar ada. Papan peringkat menilainya sungguhan;
   ia tidak boleh menilai sesuatu yang menguap.

   ── KENAPA ADA SNR LURUS PADAHAL YANG DIMINTA YANG BALIK ────────────────
   `snr` didefinisikan karena `snrBalik` menyebarnya, dan mendefinisikan
   sesuatu di sini TIDAK membuatnya berjalan: agen dipilih lewat argumen
   baris perintah, jadi yang jalan hanya yang dijadwalkan. Ia ada supaya
   pembanding lurusnya tinggal dijadwalkan kalau suatu saat pemilik ingin
   tahu apakah membalik memang menolong — tanpa itu, papan peringkatnya
   cuma punya satu angka tanpa acuan. */
function evaluasiSnr(s, bar, bar4) {
  if (!bar4 || bar4.length < 60 || !bar.length) return null;

  const smi = smiEkstrem(bar4);
  if (!smi) return null;                        // 4 jam tidak ekstrem -> bukan kandidat

  const x = bar[bar.length - 1];                // candle 5 menit yang baru tutup
  const sentuh = sentuhZonaSnr(bar4, x);
  if (!sentuh) return null;                     // tidak menyentuh zona -> bukan kandidat
  if (s.wajibTolak && !sentuh.tolak) return null;
  if (s.wajibSearah && sentuh.arah !== smi.arah) return null;

  const a = atrWilder(bar4, 14)[bar4.length - 1];
  if (!(a > 0)) return null;

  const harga = x.c;
  const sl = slDariZonaSnr(smi.arah, harga, bar4, a);
  const risiko = Math.abs(harga - sl);
  if (!(risiko > 0)) return null;
  const risikoPersen = (risiko / harga) * 100;
  if (risikoPersen > s.risikoMaks || risikoPersen < s.risikoMin) return null;

  /* Ongkos bolak-balik harus muat jauh di dalam risikonya. Tanpa pagar ini,
     setup dengan stop sangat rapat terlihat bagus di atas kertas lalu habis
     dimakan biaya — cacat yang sama sudah dijaga di agen-agen lain. */
  if (risiko < harga * s.ongkosPp * 4) return null;

  const tp = smi.arah === 'BUY' ? harga + risiko : harga - risiko;

  const dasar = {
    jarak: risiko, atr: a, batas: sentuh.level, waktu: x.t, contoh: x.c,
    kakiLimit: null, sisiZona: sentuh.sisi, levelZona: sentuh.level,
    smiK: smi.k, smiKondisi: smi.kondisi, mulaiBalik: smi.mulaiBalik,
    tolak: sentuh.tolak, searah: sentuh.arah === smi.arah,
  };

  if (s.balik) {
    /* Dicerminkan di sekitar entry, cara yang SAMA dengan Agen Momentum
       Balik. Karena TP-nya 1:1 dengan SL, pencerminan menukar tempat
       keduanya dan perbandingannya tetap 1:1 — jadi yang berubah benar-benar
       cuma sisinya, bukan ukuran risikonya. */
    return Object.assign({}, dasar, {
      arah: smi.arah === 'BUY' ? 'SELL' : 'BUY',
      entry: harga,
      sl: 2 * harga - sl,
      tp: 2 * harga - tp,
      arahAsli: smi.arah,
    });
  }

  return Object.assign({}, dasar, { arah: smi.arah, entry: harga, sl: sl, tp: tp });
}

/* ══ AGEN MOMENTUM BALIK — cermin dari Agen Momentum ═══════════════════════
   Diminta pemilik: metode PERSIS sama, posisinya diambil terbalik.

   Setelannya DISALIN dengan spread, bukan ditulis ulang. Itu disengaja:
   yang sedang diuji adalah "apakah sisi seberang lebih baik", dan
   pertanyaan itu cuma punya arti kalau tidak ada satu pun angka lain yang
   ikut berbeda. Menyalin dengan tangan berarti suatu hari salah satunya
   diubah dan yang lain tidak, lalu perbandingannya diam-diam berhenti
   membandingkan apa pun.

   Disusun DI SINI, bukan di dalam literal di atas: sebuah objek tidak bisa
   menyalin saudaranya sendiri sebelum objeknya selesai dibentuk.

   NAMANYA BERBEDA, dan itu bukan kosmetik. Kartu agen di papan berkunci
   nama tampilan, jadi nama baru = kartu baru = riwayat yang bersih. Dengan
   nama yang sama, catatan cermin dan catatan aslinya bercampur di satu
   kartu dan tidak ada yang bisa dipisahkan lagi sesudahnya. */
STRATEGI.momentumBalik = {
  ...STRATEGI.momentum,
  nama: 'Agen Momentum Balik',
  balik: true,
};

/* ══ AGEN SNR ═════════════════════════════════════════════════════════════
   Metode yang dulu ada di screener sebagai "Sinyal SNR", diminta pemilik
   dihidupkan lagi sebagai agen — dengan posisi TERBALIK.

   Angka-angka di bawah TIDAK dipilih di sini. Semuanya datang dari
   ema-cross-screener_3.html apa adanya:

     SMI 14/3/3, ambang +-50   cekSmiEkstrem
     pivot 10 kiri / 10 kanan  findPivots, maksimal 2 zona per sisi
     lebar pita ATR(14) x 0,5  srAtrMult di indikator Jadi Trader V3
     SL = tepi kotak + ATR*0,5 slFromSnrZone (ruang sapuan likuiditas)
     TP 1:1 dengan SL          cariSinyalSnrH4M5
     risiko 0,03% - 12%        pagar yang sama

   Yang saya tambahkan cuma `ongkosPp`: screener tidak punya pagar ongkos
   karena ia cuma MENAMPILKAN kandidat untuk dinilai mata, sementara agen ini
   memposting sinyal yang dinilai papan peringkat sungguhan. Setup dengan stop
   sangat rapat menang di atas kertas lalu habis dimakan biaya. */
STRATEGI.snr = {
  nama: 'Agen SNR',
  jenis: 'snr',
  /* TF-nya DUA, dan itu inti metodenya: arah dari 4 jam, waktu masuk dari
     5 menit. `tf` di sini yang dipakai pelari untuk mengambil lilin utama;
     yang 4 jam diambil terpisah, lihat penyambungannya di bawah. */
  tf: '5m',
  sumber: 'binance',
  pasangan: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
             'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TONUSDT', 'DOTUSDT', 'LTCUSDT',
             'NEARUSDT', 'APTUSDT', 'ATOMUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT',
             'SUIUSDT', 'SEIUSDT', 'TIAUSDT'],
  risikoMin: 0.03,
  risikoMaks: 12,
  ongkosPp: 0.0008,      // Binance Futures taker pp, sama dengan agen kripto lain
  /* Dua saringan yang di screener berupa PILIHAN di layar, di sini dimatikan
     supaya yang diforward-test adalah metode dasarnya — bukan metode dasar
     plus dua tapisan yang belum pernah diukur.

       wajibTolak   ekor penolakan harus lebih panjang dari badan
       wajibSearah  sisi zona harus searah SMI (oversold ketemu support)

     Screener menampilkan `searah` sebagai penanda, bukan sebagai syarat, dan
     catatannya menyebut tegas: sisi zona berlawanan "bukan alasan membuang
     kandidatnya". Jadi bawaannya mengikuti itu. */
  wajibTolak: false,
  wajibSearah: false,
  barKedaluwarsa: 12,    // 12 x 5 menit = satu jam
};

/* Yang DIMINTA pemilik. Sama persis dengan di atas kecuali satu bendera —
   dan `balik` itu tidak menyentuh satu pun syarat masuknya: deteksi SMI,
   penarikan zona, sentuhan, dan jarak SL/TP dihitung dengan angka yang sama.
   Yang dicerminkan hanya sisinya, di sekitar entry. */
STRATEGI.snrBalik = {
  ...STRATEGI.snr,
  nama: 'Agen SNR Balik',
  balik: true,
};


/* Pembulatan mengikuti banyak desimal harga simbolnya. Angka dengan sembilan
   desimal ditolak Binance, dan di papan publik terbaca sebagai kecerobohan. */
function rapikan(x, contoh) {
  const des = (String(contoh).split('.')[1] || '').length;
  return Number(x.toFixed(Math.min(des, 8)));
}

/* Candle momentum menurut skrip Pine Sekolah Trading, bagian 10-12.
   Ditulis terpisah dari evaluasi() supaya bisa dibandingkan baris demi baris
   dengan skrip aslinya oleh siapa pun yang memegang keduanya. */
function candleMomentum(s, bar, i) {
  const x = bar[i];
  const badan = Math.abs(x.c - x.o);
  const ambang = atr(bar.slice(0, i + 1), 14) * s.ambangAtr;
  if (!ambang || badan < ambang) return null;

  const ekorAtas = x.h - Math.max(x.o, x.c);
  const ekorBawah = Math.min(x.o, x.c) - x.l;
  const ekorTotal = ekorAtas + ekorBawah;
  /* Rumus persis skrip aslinya: ekor dibandingkan terhadap SELURUH candle
     (badan + ekor), bukan terhadap badannya saja. */
  if (ekorTotal / (badan + ekorTotal) > s.ekorMaks) return null;

  const naik = x.c > x.o, turun = x.c < x.o;
  if (!naik && !turun) return null;

  /* Bagian 11, mode Konservatif: ekor di sisi lawan harus lebih pendek. */
  if (s.konservatif) {
    if (naik && !(ekorBawah < ekorAtas)) return null;
    if (turun && !(ekorAtas < ekorBawah)) return null;
  }
  return { arah: naik ? 'BUY' : 'SELL', badan: badan, ambang: ambang,
           ekorPersen: ekorTotal / (badan + ekorTotal) * 100 };
}

function evaluasiMomentum(s, bar) {
  if (bar.length < s.emaLen + 20) return null;
  const i = bar.length - 1;
  const m = candleMomentum(s, bar, i);
  if (!m) return null;

  /* Bagian 13: searah tren EMA. Dihitung di timeframe yang sama -- yang
     dipakai arahnya, dan menariknya dari TF lain cuma menambah satu
     permintaan jaringan untuk jawaban yang sama. */
  const tutup = bar.slice(Math.max(0, i - s.emaLen * 3), i + 1).map((z) => z.c);
  const e = ema(tutup, s.emaLen);
  if ((m.arah === 'BUY') !== (bar[i].c > e)) return null;

  const x = bar[i];
  const R = x.h - x.l;
  if (!R) return null;
  const beli = m.arah === 'BUY';

  /* ── TP DULU, SL MENGIKUTINYA ──────────────────────────────────────
     Urutannya penting dan berlawanan dengan cara biasa. Di kebanyakan
     sistem, SL ditaruh di tempat yang membuktikan idenya salah, lalu TP
     dikalikan dari situ. Videonya kebalikannya: targetnya ditentukan dulu
     dari fibo candle momentum, baru SL dipasang sejauh jarak yang sama
     (1:1).

     Akibatnya harus disadari: lebar SL jadi TURUNAN dari lebar TP, bukan
     dari struktur pasar. TP yang sempit menghasilkan SL yang sempit --
     dan di gold, SL sempit adalah SL yang kena noise. Itulah sebab angka
     terukurnya seperti yang dicatat di konfigurasi. */
  const tp = beli ? x.l + R * s.tpFib : x.h - R * s.tpFib;

  /* Titik retest 23,6%, dipakai kedua jalur di bawah. */
  const eLim = beli ? x.h - R * s.entryFib : x.l + R * s.entryFib;

  /* ── ENTRY UTAMA ──────────────────────────────────────────────────
     Sakelar mati (bawaan): SATU kaki limit di retest, SL 1:1 dari entry-nya
     sendiri. Susunan ini yang terukur positif.

     Sakelar hidup: kaki MARKET di harga tutup candle, dan kaki limitnya
     menyusul di bawah dengan SL yang sama. Lihat catatan panjang di
     konfigurasi sebelum menyalakannya. */
  const entry = s.kakiMarket ? x.c : eLim;
  const jarak = Math.abs(tp - entry);
  if (jarak <= 0) return null;
  const sl = beli ? entry - jarak : entry + jarak;

  /* Ongkos tidak boleh memakan lebih dari seperempat risiko. Angkanya
     diambil dari s.ongkosPp kalau ada -- gold di broker jauh lebih murah
     daripada taker Binance, dan memakai angka Binance di sini menolak
     hampir semua setup yang sah. */
  const ongkos = s.ongkosPp || ONGKOS_PP;
  if (jarak < entry * ongkos * 4) return null;

  /* ── KAKI 2: LIMIT di retest 23,6%, BERBAGI SL DAN TP DENGAN KAKI 1 ──
     Ini layering, opsi ketiga di video: satu di market, satu lagi menunggu
     harga menoleh. Keduanya lahir dari SATU candle momentum, jadi keduanya
     pantas dibatalkan oleh harga yang sama dan dipanen di harga yang sama.

     Karena entry-nya lebih baik sementara SL-nya tidak bergeser, kaki ini
     otomatis punya RR lebih besar dari 1 -- pada candle yang memicu sinyal
     25 Agu 2026 pukul 02:00: risiko 8,43 USD lawan imbalan 11,92, RR 1,41.

     PAGAR YANG WAJIB ADA. Kalau candle momentumnya tutup tepat di ujungnya
     tanpa ekor, SL bersama itu mendarat cuma 0,036xR dari entry limit --
     stop 0,8 dolar di gold, yang tersapu dalam hitungan detik dan mencatat
     kekalahan yang tidak ada hubungannya dengan idenya. Kaki kedua dibuang
     kalau risikonya di bawah 30% risiko kaki pertama, atau kalau harga
     retest-nya ternyata sudah di seberang SL/TP. Lebih baik satu kaki
     daripada dua yang satunya omong kosong. */
  const risikoLim = Math.abs(eLim - sl);
  const imbalanLim = Math.abs(tp - eLim);
  const masukAkal = beli ? (eLim > sl && eLim < tp) : (eLim < sl && eLim > tp);
  const kakiLimit = (s.kakiMarket && masukAkal && imbalanLim > 0
      && risikoLim >= entry * ongkos * 4 && risikoLim >= jarak * 0.3)
    ? { entry: eLim, sl: sl, tp: tp, jarak: risikoLim }
    : null;

  /* ══ POSISI DICERMINKAN ══════════════════════════════════════════════
     Diminta pemilik 1 Sep 2026: metode PERSIS sama, tapi sisinya dibalik --
     yang analisisnya bilang BUY dieksekusi SELL.

     DICERMINKAN, BUKAN SEKADAR DIGANTI LABELNYA. Menukar kata "BUY" jadi
     "SELL" sambil membiarkan SL di bawah dan TP di atas menghasilkan order
     yang tidak berarti apa-apa: stop-nya di sisi yang menguntungkan dan
     targetnya di sisi yang merugikan. Yang benar adalah memantulkan kedua
     level itu terhadap harga entry -- pemicunya tetap di harga yang sama,
     jaraknya tetap sama, cuma sisinya bertukar. Itulah "mengambil sisi
     seberang dari trade yang sama".

     Entry TIDAK ikut dipantulkan. Ia titik pantulnya sendiri: order ini
     menunggu harga menyentuh level retest, dan level itu tidak berubah
     hanya karena yang menunggunya berpindah sisi.

     ── YANG PERLU DIINGAT SAAT MEMBACA HASILNYA ──────────────────────
     Membalik strategi yang rugi TIDAK otomatis menghasilkan yang untung.
     Ongkos dibayar di kedua arah: kalau edge bersihnya -0,05R sudah
     termasuk ongkos c, maka edge kotornya (-0,05 + c) dan kebalikannya
     (0,05 - c) -- yang bersih tinggal (0,05 - 2c). Susunan ini terukur
     -0,054 dan +0,042 di dua paruh sejarah (lihat catatan konfigurasi di
     atas), jadi yang pantas diharapkan dari cerminnya juga sekitar nol,
     bukan kebalikan dari kerugiannya.

     Yang membuatnya tetap layak dijalankan: ia BERDAMPINGAN dengan yang
     asli, di kartu terpisah, memakai candle yang sama persis. Sesudah
     cukup trade, papan peringkat menjawab pertanyaannya dengan angka --
     dan itu lebih murah daripada berdebat tentangnya. */
  if (s.balik) {
    const slB = 2 * entry - sl;
    const tpB = 2 * entry - tp;
    const beliB = !beli;
    /* Kaki limit diperiksa ULANG untuk arah yang baru. Pagar aslinya
       menolak kaki yang retest-nya sudah di seberang SL/TP, dan "seberang"
       berarti hal yang berlawanan sesudah dicerminkan. */
    const masukAkalB = beliB ? (eLim > slB && eLim < tpB) : (eLim < slB && eLim > tpB);
    const risikoLimB = Math.abs(eLim - slB);
    const imbalanLimB = Math.abs(tpB - eLim);
    const kakiLimitB = (s.kakiMarket && masukAkalB && imbalanLimB > 0
        && risikoLimB >= entry * ongkos * 4 && risikoLimB >= jarak * 0.3)
      ? { entry: eLim, sl: slB, tp: tpB, jarak: risikoLimB }
      : null;
    return {
      arah: beliB ? 'BUY' : 'SELL',
      entry: entry, sl: slB, tp: tpB, kakiLimit: kakiLimitB,
      jarak: jarak, atr: m.ambang / s.ambangAtr, batas: entry,
      waktu: x.t, ekorPersen: m.ekorPersen, ema: e, tinggiCandle: R,
      contoh: x.c,
      /* Arah ASLI ikut dibawa supaya keterangan sinyalnya bisa jujur:
         "candle momentum naik, posisi diambil terbalik". Tanpa ini kartunya
         menampilkan SELL untuk candle hijau dan terbaca seperti kekeliruan. */
      arahAsli: m.arah,
    };
  }

  return {
    arah: m.arah, entry: entry, sl: sl, tp: tp, kakiLimit: kakiLimit,
    jarak: jarak, atr: m.ambang / s.ambangAtr, batas: entry,
    waktu: x.t, ekorPersen: m.ekorPersen, ema: e, tinggiCandle: R,
    /* Harga candle MENTAH, dipakai sebagai contoh banyak desimal. Entry dan
       TP di atas hasil hitungan fibo, jadi keduanya membawa noise float
       (4644.028344...). Membulatkan dengan mencontoh angka itu sendiri
       menghasilkan enam desimal untuk simbol yang cuma punya tiga -- di
       papan publik terbaca sebagai kecerobohan, dan tidak ada broker yang
       menerima harga sedetail itu. */
    contoh: x.c,
  };
}

/* ── AGEN FABLE ──────────────────────────────────────────────────────────
   Range diambil dari nRange bar TERAKHIR yang sudah tutup, lalu order
   menunggu dipasang di atasnya. Kalau harga sudah berada di atas range
   itu, setupnya dilewati -- memasang stop di level yang sudah dilewati
   berarti memasang order yang langsung tereksekusi di harga buruk, dan
   itu bukan yang diukur. */
function evaluasiFable(s, bar) {
  const n = bar.length;
  if (n < s.nRange + 5) return null;
  let hi = -Infinity, lo = Infinity;
  for (let k = n - s.nRange; k < n; k++) {
    if (bar[k].h > hi) hi = bar[k].h;
    if (bar[k].l < lo) lo = bar[k].l;
  }
  const R = hi - lo;
  if (!(R > 0)) return null;

  /* ENTRY = puncak range, TAPI TIDAK PERNAH DI BAWAH HARGA SEKARANG.
     Versi pertama membuang setup yang bar terakhirnya sudah menutup di
     puncak range -- dan justru itu yang menghasilkan: close kuat di ujung
     atas berarti kelanjutan. Membuangnya menyisakan setup yang paling
     lemah, dan hasilnya jatuh dari +0,207R ke +0,047R.

     Dipakai max() supaya tidak pernah mengaku dapat harga yang sudah
     lewat: kalau harga sekarang di atas puncak range, entry-nya harga
     sekarang, bukan angka yang enak di masa lalu. */
  const kini = bar[n - 1].c;
  const entry = Math.max(hi, kini), sl = lo, jarak = entry - sl;
  if (!(jarak > 0)) return null;
  const tp = entry + jarak * s.rrTp;
  const ongkos = s.ongkosPp || ONGKOS_PP;
  if (jarak < entry * ongkos * 4) return null;

  return {
    arah: 'BUY', entry: entry, sl: sl, tp: tp, jarak: jarak,
    atr: atr(bar.slice(Math.max(0, n - 41), n), 14), batas: hi,
    waktu: bar[n - 1].t, contoh: kini, rr: s.rrTp,
  };
}

/* ── AGEN FVG ────────────────────────────────────────────────────────────
   Menjalankan mesin keadaan di atas SELURUH deret, lalu memulangkan setup
   HANYA kalau ia lahir di bar terakhir. Bentuk ini disengaja: fungsinya
   tetap murni (bar masuk, sinyal keluar) sehingga backtest menjalankan
   keputusan yang sama persis, dan cron yang memanggilnya tiap jam tidak
   perlu menyimpan keadaan apa pun di antara panggilan.

   TANPA MELIHAT MASA DEPAN. Pivot baru dianggap ada setelah s.pivot bar di
   kanannya terbentuk. Fraktal yang dibaca dari data lengkap membuat setiap
   backtest SMC terlihat hebat, karena swing-nya baru "ada" sesudah harga
   membuktikannya. */
function evaluasiFvg(s, bar) {
  const n = bar.length;
  if (n < s.pivot * 2 + 60) return null;
  const L = s.pivot;
  const pivH = [], pivL = [];
  const calon = [];
  let hasil = null;

  for (let i = 0; i < n; i++) {
    const p = i - L;
    if (p - L >= 0) {
      let hi = true, lo = true;
      for (let k = p - L; k <= p + L; k++) {
        if (k === p) continue;
        if (bar[k].h >= bar[p].h) hi = false;
        if (bar[k].l <= bar[p].l) lo = false;
      }
      if (hi) pivH.push({ i: p, v: bar[p].h });
      if (lo) pivL.push({ i: p, v: bar[p].l });
    }
    const b = bar[i];
    const a14 = atr(bar.slice(Math.max(0, i - 40), i + 1), 14);

    for (let z = calon.length - 1; z >= 0; z--) {
      const c = calon[z];
      const beli = c.arah === 'BUY';
      if (i - c.iSweep > s.barSweep + s.barChoch) { calon.splice(z, 1); continue; }

      if (c.tahap === 1) {
        if (i - c.iSweep > s.barSweep) { calon.splice(z, 1); continue; }
        if (beli ? b.l < c.garis : b.h > c.garis) c.ekstrem = beli ? Math.min(c.ekstrem, b.l) : Math.max(c.ekstrem, b.h);
        if (beli ? b.c > c.garis : b.c < c.garis) {
          const lawan = beli ? pivH : pivL;
          let ch = null;
          for (let y = lawan.length - 1; y >= 0; y--) if (lawan[y].i < c.iSweep) { ch = lawan[y]; break; }
          if (!ch) { calon.splice(z, 1); continue; }
          c.tahap = 2; c.ch = ch.v;
        }
        continue;
      }

      if (c.tahap === 2) {
        if (!(beli ? b.c > c.ch : b.c < c.ch)) continue;
        let f = null;
        for (let k = i; k >= Math.max(c.iSweep, 2); k--) {
          const x = bar[k - 2], d = bar[k];
          if (!(beli ? x.h < d.l : x.l > d.h)) continue;
          const atas = beli ? d.l : x.l, bawah = beli ? x.h : d.h;
          f = { atas, bawah, tinggi: atas - bawah }; break;
        }
        if (!f || !a14 || f.tinggi < a14 * s.celahAtr) { calon.splice(z, 1); continue; }

        const entry = beli ? f.atas : f.bawah;
        const sl = beli ? f.bawah - f.tinggi * s.bufferSl : f.atas + f.tinggi * s.bufferSl;
        const seberang = beli ? pivH[pivH.length - 1] : pivL[pivL.length - 1];
        if (!seberang) { calon.splice(z, 1); continue; }
        const tp = seberang.v;
        const jarak = Math.abs(entry - sl), imbalan = Math.abs(tp - entry);
        if (jarak <= 0 || (beli ? tp <= entry : tp >= entry) || imbalan / jarak < s.rrMin) {
          calon.splice(z, 1); continue;
        }
        const ongkos = s.ongkosPp || ONGKOS_PP;
        if (jarak < entry * ongkos * 4) { calon.splice(z, 1); continue; }

        if (i === n - 1) {
          hasil = { arah: c.arah, entry: entry, sl: sl, tp: tp, jarak: jarak,
                    atr: a14, batas: c.garis, waktu: b.t, contoh: b.c,
                    fvgAtas: f.atas, fvgBawah: f.bawah, rr: imbalan / jarak };
        }
        calon.splice(z, 1);
      }
    }

    if (calon.length < 12) {
      for (const arah of ['BUY', 'SELL']) {
        const beli = arah === 'BUY';
        const lst = beli ? pivL : pivH;
        const g = lst[lst.length - 1];
        if (!g || g.i >= i) continue;
        if (!(beli ? b.l < g.v : b.h > g.v)) continue;
        if (calon.some((c) => c.arah === arah && c.garis === g.v)) continue;
        calon.push({ arah, tahap: 1, garis: g.v, iSweep: i, ekstrem: beli ? b.l : b.h });
      }
    }
  }
  return hasil;
}

/* ── KEPUTUSAN. Murni: bar masuk, sinyal keluar. ─────────────────────────
   `bar` berakhir di lilin yang BARU SAJA tutup — pemanggil yang bertanggung
   jawab tidak menyertakan lilin berjalan. `bar4h` hanya dipakai kalau
   strateginya menyaring arah tren. */
function evaluasi(s, bar, bar4h) {
  if (s.jenis === 'snr') return evaluasiSnr(s, bar, bar4h);
  if (s.jenis === 'momentum') return evaluasiMomentum(s, bar);
  if (s.jenis === 'fvg') return evaluasiFvg(s, bar);
  if (s.jenis === 'fable') return evaluasiFable(s, bar);
  if (bar.length < s.lookback + 20) return null;

  const kini = bar[bar.length - 1];
  const jendela = bar.slice(-1 - s.lookback, -1);   // TIDAK termasuk bar kini
  let tertinggi = -Infinity, terendah = Infinity;
  for (const b of jendela) { if (b.h > tertinggi) tertinggi = b.h; if (b.l < terendah) terendah = b.l; }

  let arah = null;
  if (kini.c > tertinggi) arah = 'BUY';
  else if (kini.c < terendah) arah = 'SELL';
  if (!arah) return null;

  if (s.filterTren) {
    if (!bar4h || bar4h.length < 60) return null;
    const tutup = bar4h.map((b) => b.c);
    const trenNaik = ema(tutup.slice(-50), 20) > ema(tutup.slice(-100), 50);
    if ((arah === 'BUY') !== trenNaik) return null;   // lawan arah tren: lewati
  }

  const a = atr(bar, 14);
  if (!a) return null;

  /* Pasarnya terlalu sepi untuk menutup ongkos. Dilewati, bukan dipaksakan
     dengan stop yang dilebarkan sampai tidak masuk akal. */
  if (a * s.atrKali < kini.c * ONGKOS_PP * 2) return null;

  const jarak = Math.max(a * s.atrKali, kini.c * s.stopMin);
  const entry = kini.c;
  return {
    arah: arah,
    entry: entry,
    sl: arah === 'BUY' ? entry - jarak : entry + jarak,
    tp: arah === 'BUY' ? entry + jarak * s.rr : entry - jarak * s.rr,
    jarak: jarak,
    atr: a,
    batas: arah === 'BUY' ? tertinggi : terendah,
    waktu: kini.t,
  };
}

/* ── Jaringan ───────────────────────────────────────────────────────── */
async function ambil(url, opsi) {
  const r = await fetch(url, opsi);
  if (!r.ok) throw new Error(url.split('?')[0] + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return r.json();
}

async function klines(symbol, interval, limit, akhir) {
  const u = BINANCE + '/fapi/v1/klines?symbol=' + symbol + '&interval=' + interval
          + '&limit=' + limit + (akhir ? '&endTime=' + akhir : '');
  const j = await ambil(u);
  const bar = j.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
  /* Lilin berjalan dibuang HANYA saat mengambil data terkini. Dengan
     `endTime` di masa lalu, bar terakhir sudah tutup dan membuangnya justru
     menghilangkan data. */
  return akhir ? bar : bar.slice(0, -1);
}

/* ── LILIN DARI TERMINAL MT5 ────────────────────────────────────────────
   Lewat rute HTTP yang sama persis dengan yang dipakai chart di situs,
   BUKAN dengan membaca mt5-klines.json langsung. Dua alasan:

   1. Berkasnya ditulis server.js sementara agen ini berjalan. Membacanya
      di tengah penulisan memberi JSON yang separuh -- jarang, dan justru
      karena jarang ia akan muncul sebagai satu sinyal aneh berbulan-bulan
      kemudian tanpa bisa diulang.

   2. Rutenya yang memutuskan laci siapa yang dipakai (termasuk jatuh ke
      feed acuan pemilik). Menyalin aturan itu ke sini berarti dua tempat
      memutuskan hal yang sama, dan suatu saat keduanya akan berselisih --
      agen memposting dari harga yang tidak pernah dilihat siapa pun di
      layar.

   Lilin terakhir dibuang: ia masih berjalan, sama seperti di Binance. */
async function klinesMt5(symbol, interval, limit) {
  const u = LOKAL + '/api/mt5/klines?symbol=' + encodeURIComponent(symbol)
          + '&interval=' + encodeURIComponent(interval) + '&limit=' + limit;
  const j = await ambil(u);
  const d = (j && j.data) || [];
  return d.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })).slice(0, -1);
}

function bungkus(kunci, s, pasangan, sn) {
  const persen = (sn.jarak / sn.entry * 100).toFixed(2);

  if (s.jenis === 'fable') {
    return {
      pasangan: pasangan, tf: s.tf, arah: sn.arah, agenNama: s.nama,
      pasar: /USDT$/.test(pasangan) ? 'kripto' : 'tradefi',
      judul: pasangan + ' BUY \u2014 breakout range ' + s.nRange + ' bar',
      ringkas: 'Harga menembus atas range ' + s.nRange + ' bar terakhir. Stop di dasar range ('
             + persen + '%), target ' + s.rrTp + 'R.',
      isi: {
        entry: rapikan(sn.entry, sn.contoh), sl: rapikan(sn.sl, sn.contoh), tp: rapikan(sn.tp, sn.contoh),
        alasan: 'Range ' + s.nRange + ' bar ' + s.tf + ' terakhir: ' + rapikan(sn.sl, sn.contoh)
              + ' sampai ' + rapikan(sn.entry, sn.contoh) + '. Buy Stop di atas range, stop di dasarnya, '
              + 'target ' + s.rrTp + 'R. Tembusan ke bawah sengaja diabaikan \u2014 sisi jual terukur rugi. '
              + 'Batal sendiri kalau tidak tertembus dalam ' + s.barKedaluwarsa + ' bar. '
              + 'Aturan tetap, hasil riset sendiri \u2014 forward test satu instrumen.',
      },
    };
  }

  if (s.jenis === 'snr') {
    const arahAsal = sn.arahAsli || sn.arah;
    const zona = sn.sisiZona === 'R' ? 'resistance' : 'support';
    const kondisi = sn.smiKondisi === 'oversold' ? 'oversold' : 'overbought';
    /* Kalimat ini yang menjaga kartunya tidak terbaca seperti kerusakan.
       Tanpa itu, pembaca melihat "SMI oversold" berdampingan dengan posisi
       SELL dan menyimpulkan ada yang salah — padahal itu justru yang
       sedang diuji. */
    const kataBalik = s.balik ? ' Posisi diambil TERBALIK dari arah metodenya.' : '';
    return {
      pasangan: pasangan, tf: s.tf, arah: sn.arah, agenNama: s.nama,
      pasar: /USDT$/.test(pasangan) ? 'kripto' : 'tradefi',
      judul: pasangan.replace('USDT', '') + ' ' + sn.arah + ' \u2014 SNR + SMI 4H',
      ringkas: 'SMI 4 jam ' + kondisi + ' dan candle 5 menit menyentuh zona '
             + zona + ' 4 jam.' + kataBalik + ' Stop di luar kotak zona ('
             + persen + '%), target 1:1.',
      isi: {
        entry: rapikan(sn.entry, sn.contoh), sl: rapikan(sn.sl, sn.contoh),
        tp: rapikan(sn.tp, sn.contoh),
        alasan: 'SMI(14,3,3) di 4 jam menyentuh ' + kondisi + ' (' + sn.smiK.toFixed(1)
              + ', ambang ' + (arahAsal === 'BUY' ? SMI_OS : SMI_OB) + ')'
              + (sn.mulaiBalik ? ' dan sudah mulai berbalik' : ' dan masih meluncur') + '. '
              + 'Candle 5 menit yang baru tutup menyentuh zona ' + zona + ' di '
              + rapikan(sn.levelZona, sn.contoh) + ', ditarik dari pivot(10,10) 4 jam '
              + 'dengan pita ATR(14)x0,5. Ekor '
              + (sn.tolak ? 'penolakan lebih panjang dari badan' : 'tidak lebih panjang dari badan')
              + '; sisi zona ' + (sn.searah ? 'searah' : 'berlawanan') + ' dengan SMI. '
              + 'Stop di luar kotak ditambah setengah tinggi kotak sebagai ruang sapuan '
              + 'likuiditas, target sejauh jarak yang sama (1:1). '
              + 'Perhitungan diporting utuh dari screener \u2014 forward test.'
              + (s.balik
                 ? ' CERMIN: SMI, zona, sentuhan, dan jarak SL/TP PERSIS sama dengan '
                 + 'Agen SNR; yang dibalik hanya sisinya \u2014 metode memberi '
                 + arahAsal + ', dieksekusi ' + sn.arah + '.'
                 : ''),
      },
    };
  }

  if (s.jenis === 'fvg') {
    const arahKata = sn.arah === 'BUY' ? 'naik' : 'turun';
    const sisi = sn.arah === 'BUY' ? 'sell side' : 'buy side';
    return {
      pasangan: pasangan, tf: s.tf, arah: sn.arah, agenNama: s.nama,
      pasar: /USDT$/.test(pasangan) ? 'kripto' : 'tradefi',
      judul: pasangan.replace('USDT', '') + ' ' + sn.arah + ' \u2014 sweep + FVG',
      ringkas: 'Likuiditas ' + sisi + ' disapu lalu struktur berbalik ' + arahKata
             + '. Limit menunggu harga kembali ke FVG (' + persen + '%), target di likuiditas seberang.',
      isi: {
        entry: rapikan(sn.entry, sn.contoh), sl: rapikan(sn.sl, sn.contoh), tp: rapikan(sn.tp, sn.contoh),
        alasan: 'Harga menyapu likuiditas ' + sisi + ' di ' + rapikan(sn.batas, sn.contoh)
              + ' lalu close kembali di sisi asalnya, kemudian menembus struktur (CHoCH). '
              + 'Candle impuls meninggalkan FVG ' + rapikan(sn.fvgBawah, sn.contoh) + '\u2013'
              + rapikan(sn.fvgAtas, sn.contoh) + '; entry limit di tepi FVG, stop 0,25x tinggi FVG di baliknya, '
              + 'target di likuiditas seberang (RR ' + sn.rr.toFixed(2) + '). '
              + 'Batal sendiri kalau harga tidak kembali dalam ' + s.barKedaluwarsa + ' bar. '
              + 'Aturan tetap \u2014 forward test.',
      },
    };
  }

  if (s.jenis === 'momentum') {
    /* Arah CANDLE-nya, bukan arah posisinya. Untuk agen cermin keduanya
       berlawanan, dan menulis "candle momentum bearish" untuk candle hijau
       adalah kekeliruan yang akan dilaporkan pembaca pertama yang teliti. */
    const arahKata = (sn.arahAsli || sn.arah) === 'BUY' ? 'bullish' : 'bearish';
    /* Satu kalimat yang menjelaskan kenapa posisinya berlawanan dengan
       candle-nya. Tanpa ini kartunya terbaca seperti kerusakan, bukan
       seperti percobaan yang disengaja. */
    const kataBalik = s.balik
      ? ' Posisi diambil TERBALIK dari arah candle-nya.'
      : '';
    const fibE = (s.entryFib * 100).toFixed(1).replace('.0', '');
    const fibT = (s.tpFib * 100).toFixed(1).replace('.0', '');
    /* KATA-KATANYA IKUT SAKELAR, BUKAN IKUT TANDA KAKI.
       Waktu layering dimatikan, tidak ada kaki yang ditandai 'limit' --
       padahal kaki tunggalnya MEMANG limit di retest fibo. Akibatnya kartu
       berbunyi "masuk market di harga tutup candle" untuk order yang
       sebenarnya menunggu harga balik, dan pembacanya menyangka statusnya
       yang salah. Dilaporkan pemilik 25 Agu 2026. */
    const limit = s.kakiMarket ? sn.kaki === 'limit' : true;
    const rr = (Math.abs(sn.tp - sn.entry) / sn.jarak).toFixed(2);
    return {
      pasangan: pasangan, tf: s.tf, arah: sn.arah, agenNama: s.nama,
      /* Gold bukan kripto. Aturannya disamakan dengan yang dipakai server
         (lihat /api/analisa): berakhiran USDT = kripto, selain itu tradefi.
         Salah di sini berarti penilai mencari harganya di Binance, dan
         sinyalnya tidak akan pernah selesai. */
      pasar: /USDT$/.test(pasangan) ? 'kripto' : 'tradefi',
      judul: pasangan.replace('USDT', '') + ' ' + sn.arah + ' — momentum candle',
      ringkas: 'Candle momentum ' + arahKata + ' di ' + s.tf + '.' + kataBalik + ' '
             + (limit
                ? 'Limit menunggu retest ' + fibE + '% fibo. SL dan TP sama dengan kaki market-nya, jadi RR ' + rr + '.'
                : 'Masuk market di harga tutup candle. TP di ' + fibT + '% fibo, SL 1:1 dengan TP (' + persen + '%).'),
      isi: {
        entry: rapikan(sn.entry, sn.contoh || sn.entry), sl: rapikan(sn.sl, sn.contoh || sn.entry),
        tp: rapikan(sn.tp, sn.contoh || sn.entry),
        alasan: 'Candle ' + arahKata + ' dengan badan minimal ' + s.ambangAtr
              + 'x ATR(14) dan total ekor ' + sn.ekorPersen.toFixed(0)
              + '% (batas ' + (s.ekorMaks * 100) + '%). '
              + 'Searah EMA' + s.emaLen + ' di ' + s.tf + '. '
              + 'Entry limit di retest ' + fibE + '% fibo candle itu; TP di ' + fibT
              + '% fibo, SL dipasang sejauh jarak yang sama dengan TP (1:1). '
              + 'Batal sendiri kalau retest tidak datang dalam ' + s.barKedaluwarsa
              + ' bar. Metode Momentum Candle Sekolah Trading (Riski Aditama), '
              + 'aturan tetap — forward test.'
              + (s.balik
                 ? ' CERMIN: deteksi candle, filter EMA, dan jarak level PERSIS sama '
                 + 'dengan Agen Momentum; yang dibalik hanya sisinya — candle '
                 + arahKata + ' dieksekusi ' + sn.arah + '.'
                 : ''),
      },
    };
  }

  return {
    pasangan: pasangan, tf: s.tf, arah: sn.arah, agenNama: s.nama, pasar: 'kripto',
    judul: pasangan.replace('USDT', '') + ' ' + sn.arah + ' — '
         + (kunci === 'tren' ? 'breakout tren' : 'intraday searah tren'),
    ringkas: 'Tembus ' + s.lookback + ' bar ' + s.tf + '. Stop ' + s.atrKali
           + '×ATR (' + persen + '%), target ' + s.rr + 'R.',
    isi: {
      entry: rapikan(sn.entry, sn.entry), sl: rapikan(sn.sl, sn.entry), tp: rapikan(sn.tp, sn.entry),
      alasan: 'Harga tutup ' + (sn.arah === 'BUY' ? 'di atas tertinggi' : 'di bawah terendah')
            + ' ' + s.lookback + ' bar terakhir (' + rapikan(sn.batas, sn.entry) + '). '
            + 'ATR(14) = ' + rapikan(sn.atr, sn.entry) + ', stop ' + s.atrKali + '×ATR = '
            + persen + '%, target ' + s.rr + 'R. '
            + (s.filterTren ? 'Searah tren EMA20/50 di 4H. ' : '')
            + 'Aturan tetap — tanpa penilaian manusia maupun model bahasa. Forward test.',
    },
  };
}

/* -- PENYAPU ORDER BASI --------------------------------------------------
   Order menunggu yang tidak tertembus dalam `barKedaluwarsa` bar dibatalkan.

   Ini BUKAN kerapian tampilan. Aturan yang diukur membatalkan setup yang
   tidak berlanjut tiga bar; kalau ordernya dibiarkan hidup, sebagian akan
   tersentuh berhari-hari kemudian dan tetap dihitung sebagai trade. Papan
   peringkatnya lalu menilai sistem yang BERBEDA dari yang di-backtest, dan
   angkanya jadi tidak berarti apa-apa.

   Yang sudah TERISI tidak disentuh -- servernya juga menolaknya. Menarik
   order yang harganya sudah datang sama dengan menghapus trade yang sedang
   rugi. */
function msPerBar(tf) {
  return tf === '4h' ? 14400000 : tf === '1h' ? 3600000 : tf === '30m' ? 1800000 : 900000;
}

function sudahBasi(s, a) {
  if (!s.barKedaluwarsa) return false;
  if (!a.agen || a.nama !== s.nama || a.hasil) return false;
  /* `terisi` datang dari penilai server. Kalau penilainya belum sempat
     berjalan nilainya undefined, dan di sini itu diperlakukan sebagai BELUM
     terisi -- lalu servernya yang memutuskan: penjaga di rutenya menolak
     pembatalan order yang sudah tersentuh, jadi tebakan yang salah di sisi
     ini tidak bisa menghapus trade yang sudah jalan. */
  if (a.terisi) return false;
  return Date.now() - Number(a.dibuat || 0) >= msPerBar(s.tf) * s.barKedaluwarsa;
}

async function sapuBasi(s, daftar, kering) {
  const basi = daftar.filter((a) => sudahBasi(s, a));
  for (const a of basi) {
    console.log('  batal (basi ' + s.barKedaluwarsa + ' bar):', a.pasangan, a.id);
    if (kering) continue;
    try {
      await ambil(LOKAL + '/api/analisa/agen/batal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': TOKEN },
        body: JSON.stringify({
          id: a.id,
          alasan: 'Tidak tertembus dalam ' + s.barKedaluwarsa + ' bar ' + s.tf
                + ' - momentum yang tidak berlanjut bukan lagi momentum.',
        }),
      });
    } catch (e) { console.error('    gagal batal .', e.message); }
  }
  return basi.length;
}

async function utama() {
  const pilih = process.argv[2];
  const kering = process.argv.indexOf('--kering') >= 0;
  const s = STRATEGI[pilih];
  if (!s) { console.error('pakai: agen-sinyal.js tren|cepat|momentum [--kering]'); process.exit(1); }

  /* Sinyal yang MASIH BERJALAN milik agen ini. Memposting ulang pasangan
     yang sama berarti menghitung satu ide sebagai dua trade — dan papan
     peringkatnya berbohong ke arah yang menguntungkan agennya. */
  let sedangJalan = new Set();
  try {
    const d = await ambil(LOKAL + '/api/analisa');
    const daftarSemua = d.daftar || [];
    /* Order basi disapu LEBIH DULU. Kalau tidak, pasangan yang ordernya sudah
       kedaluwarsa tetap terbaca "sedang jalan" dan setup barunya dilewati --
       agennya berhenti memposting koin itu sampai ada yang membereskan
       ordernya dengan tangan. */
    const dibatalkan = await sapuBasi(s, daftarSemua, kering);
    if (dibatalkan) console.log('  ' + dibatalkan + ' order menunggu dibatalkan karena basi');
    sedangJalan = new Set(daftarSemua
      .filter((a) => a.agen && a.nama === s.nama && !a.hasil && !sudahBasi(s, a))
      .map((a) => a.pasangan));
  } catch (e) { console.error('gagal baca daftar analisa:', e.message); }

  let terkirim = 0;
  const hasil = [];
  for (const p of s.pasangan) {
    if (sedangJalan.has(p)) continue;
    try {
      /* EMA50 butuh sejarah jauh lebih panjang daripada Donchian 55. */
      const perlu = s.jenis === 'momentum'
        ? Math.max(s.emaLen * 3 + 30, 200)
        : s.jenis === 'fvg' ? 600
        : s.jenis === 'fable' ? 300
        /* SNR cuma memeriksa SATU candle 5 menit — yang baru tutup. Yang
           butuh sejarah panjang justru deret 4 jam-nya, dan itu diambil
           terpisah di bawah. Menarik 130 bar 5 menit di sini berarti 21 jam
           data yang tidak pernah dibaca, dikalikan 21 pasangan tiap putaran. */
        : s.jenis === 'snr' ? 40
        : Math.max(s.lookback + 40, 130);
      /* Mode 'auto': pasangan berakhiran USDT diambil dari Binance, selain itu
         dari feed MT5 pemilik. Agen FVG memindai keduanya sekaligus, dan
         menaruh aturan pemilihan sumber di satu tempat mencegah dua tempat
         yang suatu saat berselisih. */
      const lewatMt5 = s.sumber === 'mt5' || (s.sumber === 'auto' && !/USDT$/.test(p));
      const bar = lewatMt5
        ? await klinesMt5(p, s.tf, Math.max(perlu, 500))
        : await klines(p, s.tf, perlu);

      /* ── PENJAGA LILIN BASI ─────────────────────────────────────────
         Feed MT5 hanya hidup selama terminal pemilik menyala. Kalau
         terminalnya mati, lilinnya BERHENTI DIPERBARUI tanpa memberi
         galat apa pun -- rutenya tetap menjawab 200 dengan data lama.

         Tanpa penjaga ini agen akan membaca candle kemarin sebagai candle
         yang baru tutup, lalu memposting sinyal dengan harga yang sudah
         lewat berjam-jam. Papan peringkatnya kemudian menilainya dengan
         harga sekarang, dan hasilnya bukan sekadar salah -- ia acak.

         Tiga bar: satu bar untuk lilin yang baru tutup, satu kelonggaran
         untuk kiriman EA yang datang tiap +-5 menit, satu lagi untuk
         jaringan yang tersendat. */
      if (lewatMt5 && bar.length) {
        const usia = Date.now() - bar[bar.length - 1].t;
        if (usia > msPerBar(s.tf) * 3) {
          console.error('  lewat', p, '· lilin MT5 basi ('
            + Math.round(usia / 60000) + ' menit) — terminal MT5 kemungkinan mati');
          continue;
        }
      }

      /* Deret 4 jam dipakai dua agen dengan kebutuhan berbeda: filter tren
         cukup 130 bar, sedangkan SNR butuh 250 — pivot(10,10) memakan 20 bar
         di tiap ujungnya dan SMI(14,3,3) punya pemanasannya sendiri, jadi
         deret pendek menghasilkan zona yang berbeda dari yang dilihat orang
         di screener. Angkanya disamakan dengan fetchKlines di sana. */
      const b4 = (s.jenis === 'snr')
        ? await klines(p, '4h', 250)
        : s.filterTren ? await klines(p, '4h', 130) : null;
      const sn = evaluasi(s, bar, b4);
      if (sn) {
        hasil.push(bungkus(pilih, s, p, sn));
        /* Kaki kedua diposting sebagai sinyal TERSENDIRI, bukan catatan di
           dalam sinyal pertama. Papan peringkat menilai per sinyal: kalau
           dua entry dijejalkan ke satu kartu, cuma satu yang bisa dihitung
           menang atau kalah, dan yang satunya hilang dari rekam jejak. */
        if (sn.kakiLimit) {
          hasil.push(bungkus(pilih, s, p,
            Object.assign({}, sn, sn.kakiLimit, { kaki: 'limit', kakiLimit: null })));
        }
      }
    } catch (e) { console.error('  lewat', p, '·', e.message); }
  }

  console.log('[' + new Date().toISOString() + '] ' + s.nama + ': ' + hasil.length
            + ' sinyal (dari ' + s.pasangan.length + ' pasangan, '
            + sedangJalan.size + ' sedang jalan)');

  for (const sn of hasil) {
    console.log('  ->', sn.pasangan, sn.arah, 'entry', sn.isi.entry, 'sl', sn.isi.sl, 'tp', sn.isi.tp);
    if (kering) continue;
    try {
      await ambil(LOKAL + '/api/analisa/agen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': TOKEN },
        body: JSON.stringify(sn),
      });
      console.log('     terkirim');
      terkirim++;
    } catch (e) { console.error('     GAGAL kirim ·', e.message); }
  }

  /* ── DENYUT KEHADIRAN ─────────────────────────────────────────────────
     Dikirim SELALU, termasuk saat nol sinyal — justru terutama saat nol
     sinyal. Agen tren bisa diam berhari-hari menunggu tembusan, dan tanpa
     denyut ini papan Copy Signal tidak punya apa pun untuk ditampilkan:
     pemilik maupun pengguna melihat papan yang seolah tidak punya agen
     sama sekali.

     Cap waktunya juga satu-satunya cara melihat penjadwalnya masih hidup
     tanpa membuka SSH. Cron yang mati tidak mengeluh; ia cuma berhenti,
     dan yang berhenti diam-diam bisa berminggu-minggu tidak ketahuan.

     Di mode kering TIDAK dikirim: menjalankan uji coba tidak boleh
     mengubah angka yang dibaca orang di layar. */
  if (!kering) {
    try {
      await ambil(LOKAL + '/api/analisa/agen/hadir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': TOKEN },
        body: JSON.stringify({
          nama: s.nama, tf: s.tf, pasangan: s.pasangan.length, sinyalBaru: terkirim,
          strategi: pilih === 'fable'
            ? 'Breakout atas range ' + s.nRange + ' bar ' + s.tf + ' di gold. Stop di dasar range, target '
              + s.rrTp + 'R. Sisi jual diabaikan. Terukur 49% winrate, +0,207R per trade di 684 hari.'
            : pilih === 'fvg'
            ? 'Sapuan likuiditas lalu CHoCH, entry limit di FVG yang ditinggalkan candle impuls. '
              + 'Stop ' + s.bufferSl + 'x tinggi FVG, target di likuiditas seberang, RR minimal ' + s.rrMin + '.'
            : pilih === 'momentum'
            ? 'Candle momentum (badan min ' + s.ambangAtr + 'xATR, ekor maks '
              + (s.ekorMaks * 100) + '%) searah EMA' + s.emaLen
              + '. Limit di retest ' + (s.entryFib * 100).toFixed(1) + '% fibo, TP di '
              + (s.tpFib * 100).toFixed(1) + '% fibo, SL 1:1 dengan TP.'
            : pilih === 'tren'
            ? 'Tembus Donchian ' + s.lookback + ' bar. Stop ' + s.atrKali
              + '×ATR(14), target ' + s.rr + 'R.'
            : 'Tembus ' + s.lookback + ' bar searah tren EMA20/50 di 4H. Stop '
              + s.atrKali + '×ATR(14), target ' + s.rr + 'R.',
        }),
      });
    } catch (e) { console.error('  denyut kehadiran gagal ·', e.message); }
  }
}

module.exports = { STRATEGI, evaluasi, atr, ema, klines, ONGKOS_PP };

/* Hanya jalan kalau dipanggil langsung — supaya uji-agen.js bisa
   me-require berkas ini tanpa ikut memposting sinyal ke papan publik. */
if (require.main === module) {
  utama().catch((e) => { console.error('agen gagal:', e.message); process.exit(1); });
}
