import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';
import { auth } from '@/lib/firebase';

/* ════════════════════════════════════════════════════════════════════════
   DATA PASAR — klines & ticker lewat proxy VPS
   ════════════════════════════════════════════════════════════════════════
   Selalu lewat proxy, TIDAK PERNAH langsung ke Binance. Sebagian ISP
   Indonesia memblokirnya — Indosat bahkan membajak sertifikat TLS
   `fapi.binance.com` — sehingga permintaan langsung dari peramban gagal
   dengan "Failed to fetch" tanpa penjelasan, dan screener-nya tampak kosong
   padahal tidak ada yang rusak.

   Rute proxy ini publik dan tanpa token (`/api/klines`, `/api/tickers`,
   `/api/ticker-price`), dengan cache 15–20 detik di sisi server. Jadi
   pengunjung yang belum mengatur apa pun tetap melihat data.
   ════════════════════════════════════════════════════════════════════════ */


function dasar() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}

export interface Lilin {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  times: number[];
}

const KOSONG: Lilin = { opens: [], highs: [], lows: [], closes: [], times: [] };

/* Cache di memori. Satu pemindaian meminta 4 jam DAN 5 menit untuk simbol
   yang sama, dan beberapa section memakai simbol yang beririsan — tanpa ini
   satu klik "Cari Sinyal" bisa mengirim permintaan yang sama tiga kali. */
const simpanan = new Map<string, { waktu: number; isi: Lilin }>();
const UMUR_MS = 15_000;

/* -- Preferensi pasar kripto: futures dulu, atau spot dulu ---------------
   FUTURES adalah bawaannya, dan itu keputusan produk, bukan teknis: order
   dari aplikasi ini dieksekusi di Binance Futures, jadi lilin yang dianalisa
   -- chart, screener, backtest -- harus datang dari instrumen yang sama.
   Perp menyapu lebih dalam daripada spot karena likuidasi, dan zona SNR dari
   lilin spot bisa melewatkan sweep yang sungguh terjadi persis di level SL.

   GLOBAL, bukan per halaman: screener yang membaca pasar berbeda dari chart
   akan berbeda pendapat tentang koin yang sama, dan keduanya tampil
   berdampingan di layar yang sama.

   Backend tetap jatuh balik per simbol (XAUT-nya futures, WBTC-nya spot
   saja), jadi preferensi ini aman untuk semua simbol -- lihat medan `market`
   di balasannya untuk tahu yang benar-benar melayani. */
const KUNCI_PASAR = 'jt.pasarKripto';
type PasarKripto = 'futures' | 'spot';

function bacaPasarPilihan(): PasarKripto {
  try {
    return localStorage.getItem(KUNCI_PASAR) === 'spot' ? 'spot' : 'futures';
  } catch { return 'futures'; }
}

let pasarPilihan: PasarKripto = bacaPasarPilihan();

export function pasarKripto(): PasarKripto { return pasarPilihan; }

export function aturPasarKripto(p: PasarKripto) {
  pasarPilihan = p;
  try { localStorage.setItem(KUNCI_PASAR, p); } catch { /* privat */ }
  /* Cache lama berisi lilin pasar sebelumnya. Dibuang seluruhnya, bukan
     ditunggu kedaluwarsa: 15 detik menatap lilin pasar yang salah setelah
     menekan tombol adalah 15 detik yang meyakinkan orangnya tombol itu
     rusak. */
  simpanan.clear();
}

/* `segar` = jalur cepat untuk SATU chart yang sedang ditatap.
   ──────────────────────────────────────────────────────────────────────
   Pemindaian screener meminta puluhan simbol sekaligus — cache 15 detik di
   sana adalah pelindung, bukan penghambat. Chart live kebalikannya: satu
   simbol, satu penonton, dan 15 detik terasa seperti harga yang membeku.
   Jalur segar memakai umur cache 2,5 detik dan meminta backend melewati
   cache server-nya (fresh=1). Beban: satu chart @3 dtk = 20 permintaan per
   menit — Binance mengizinkan 1200 bobot per menit, klines berbobot 2,
   jadi ini 3% dari jatah. */
/** Menarik potongan lilin SEBELUM `sebelumMs`. Dipakai tombol "Muat lebih
 *  lama" di chart.
 *
 *  Binance membatasi 1000 lilin PER PERMINTAAN, bukan seluruhnya — jadi
 *  riwayat panjang disusun dari beberapa potongan yang disambung. Titik
 *  sambungnya `waktu lilin tertua − 1 ms`: dengan begitu potongan berikutnya
 *  berhenti tepat sebelum yang sudah dipegang, dan tidak ada lilin kembar
 *  yang harus disaring di sisi chart.
 *
 *  TIDAK memakai cache memori: tiap potongan diminta sekali seumur sesi, dan
 *  menyimpannya berarti menahan megabyte data yang tidak akan diminta lagi. */
export async function ambilKlinesSebelum(simbol: string, tf: string, sebelumMs: number, batas = 1000): Promise<Lilin> {
  try {
    const mt5 = simbol.startsWith('MT5:');
    /* MT5 tidak punya penomoran halaman: EA mengirim apa yang ada di
       terminalnya, dan tidak ada rute untuk meminta yang lebih tua.
       Dikembalikan kosong supaya tombolnya bisa mengatakan itu apa adanya,
       bukan berputar selamanya. */
    if (mt5) return KOSONG;
    const r = await fetch(
      `${dasar()}/api/klines?symbol=${encodeURIComponent(simbol)}&interval=${tf}&limit=${batas}&endTime=${sebelumMs}&market=${pasarPilihan}`);
    if (!r.ok) return KOSONG;
    const j = await r.json();
    const baris = Array.isArray(j) ? j : (j?.data ?? []);
    if (!Array.isArray(baris) || !baris.length) return KOSONG;
    /* Bentuknya PERSIS sama dengan ambilKlines — termasuk `times` dalam
       MILIDETIK mentah, bukan detik. Sempat di sini dibagi 1000, dan
       akibatnya bukan galat melainkan lilin lama yang mendarat di tahun
       1970: chart tetap menggambar, cuma sumbu waktunya jadi tidak masuk
       akal. Dua fungsi yang mengisi struktur yang sama wajib mengisinya
       dengan satuan yang sama. */
    return {
      times: baris.map((k: unknown[]) => Number(k[0])),
      opens: baris.map((k: unknown[]) => Number(k[1])),
      highs: baris.map((k: unknown[]) => Number(k[2])),
      lows: baris.map((k: unknown[]) => Number(k[3])),
      closes: baris.map((k: unknown[]) => Number(k[4])),
    };
  } catch {
    return KOSONG;
  }
}

export async function ambilKlines(simbol: string, tf: string, batas = 200, segar = false): Promise<Lilin> {
  /* Pasarnya IKUT ke dalam kunci. Tanpa itu, menekan tombol spot/futures
     memulangkan lilin pasar lama dari cache selama umurnya -- bug yang
     tampak persis seperti "tombolnya tidak bekerja". */
  const kunci = `${pasarPilihan}|${simbol}|${tf}|${batas}`;
  const ada = simpanan.get(kunci);
  if (ada && Date.now() - ada.waktu < (segar ? 2_500 : UMUR_MS)) return ada.isi;

  try {
    /* Simbol "MT5:XAUUSD" = sumber TRADE-FI: OHLC yang dikirim EA v2 dari
       terminal MT5 pengguna, bukan dari Binance. Bentuk balasan servernya
       sudah disamakan dengan /api/klines, jadi seluruh halaman — chart,
       indikator, replay, backtest — bekerja tanpa tahu bedanya. */
    const mt5 = simbol.startsWith('MT5:');
    const alamat = mt5
      ? `${dasar()}/api/mt5/klines?symbol=${encodeURIComponent(simbol.slice(4))}&interval=${tf}&limit=${batas}`
      : `${dasar()}/api/klines?symbol=${encodeURIComponent(simbol)}&interval=${tf}&limit=${batas}&market=${pasarPilihan}${segar ? '&fresh=1' : ''}`;

    /* -- Coba ulang, HANYA untuk jalur chart hidup (segar) ---------------
       Chart menarik ulang tiap 3 detik. Satu kedipan koneksi -- dan sambungan
       tethering memang berkedip -- membuat satu permintaan gagal, dan tanpa
       percobaan ulang kegagalan sekejap itu langsung jadi peringatan di
       layar orangnya.

       SENGAJA tidak berlaku untuk screener (`segar` false): satu pemindaian
       menyentuh puluhan simbol sekaligus, dan mengulang semuanya saat Binance
       benar-benar mati berarti pemindaian yang gagal dua kali lebih lama.
       Chart itu satu simbol, satu permintaan -- di sanalah pengulangan murah.

       Galat 4xx TIDAK diulang: simbol yang tidak ada tetap tidak ada pada
       percobaan kedua, dan mengulangnya cuma menunda jawaban yang sudah pasti. */
    const percobaan = segar ? 3 : 1;
    /* Rute MT5 butuh token; rute Binance tidak dan tidak boleh diberi —
       menempelkan Bearer di permintaan publik cuma membocorkan token ke
       jalur yang tidak memerlukannya. */
    const kepalaLilin = mt5 ? await kepalaMt5() : null;
    let r: Response | null = null;
    for (let ke = 0; ke < percobaan; ke++) {
      if (ke > 0) await new Promise((res) => setTimeout(res, ke * 400));
      try {
        r = await fetch(alamat, kepalaLilin ? { headers: kepalaLilin } : undefined);
      } catch { r = null; }             // jaringan putus -- layak diulang
      if (r && r.ok) break;
      if (r && r.status >= 400 && r.status < 500) return KOSONG;
      r = null;
    }
    if (!r) return KOSONG;
    const j = await r.json();
    /* Spec MT5 (dolar per lot per 1.0 harga) menumpang balasan klines —
       dihitung EA dari tick value broker + mata uang akun, disimpan di
       sini untuk dipakai tiket order menghitung dolar SL/TP. */
    /* Ditandai supaya layar bisa menyebutnya apa adanya. Grafik acuan yang
       tidak diberi label akan dibaca orang sebagai harga brokernya sendiri —
       dan ia baru sadar keliru saat ordernya meleset. */
    if (mt5) {
      const dasar = simbol.slice(4);
      ACUAN_MT5.set(dasar, !!j?.acuan);
      /* Feed acuan memulangkan nama polos — akhiran broker pemilik bukan
         akhiran broker pembacanya, jadi ia tidak disiarkan. */
      if (typeof j?.nama === 'string' && j.nama) NAMA_MT5.set(dasar, j.nama);
    }
    if (mt5 && j?.spec && Number(j.spec.nilaiLot) > 0) {
      SPEK_MT5.set(simbol.slice(4), Number(j.spec.nilaiLot));
    }
    /* Tick bid/ask ikut menumpang: chart MT5 memuat ulang klines tiap
       beberapa detik, jadi menumpangkan tick di balasan yang SAMA memberi
       harga ask segar tanpa satu permintaan jaringan tambahan pun. */
    if (mt5 && j?.tick && Number(j.tick.bid) > 0) {
      TICK_MT5.set(simbol.slice(4), {
        bid: Number(j.tick.bid),
        ask: Number(j.tick.ask) || 0,
        waktu: Number(j.tick.waktu) || Date.now(),
      });
    }
    /* Backend membungkus balasan Binance jadi {ok, data}. Bentuk mentah
       Binance sendiri berupa array-of-array, jadi keduanya diterima —
       proxy yang lebih lama pernah meneruskan apa adanya. */
    /* Pasar yang BENAR-BENAR melayani simbol ini. Proxy memilih sendiri:
       BTCUSDT dilayani spot, BTCDOMUSDT futures karena ia tidak ada di spot.
       Jadi tidak boleh ditebak dari nama simbol maupun dari BINANCE_BASE_URL
       backend -- keduanya akan salah untuk sebagian koin, dan menulis jenis
       pasar yang keliru di chart adalah kebohongan di tempat orang menakar
       seberani apa masuk. */
    if (j?.market === 'spot' || j?.market === 'futures' || j?.market === 'hyperliquid') {
      PASAR.set(simbol, j.market);
    }

    const baris: any[] = Array.isArray(j) ? j : (j?.data ?? []);
    if (!Array.isArray(baris) || !baris.length) return KOSONG;

    const isi: Lilin = {
      times: baris.map((k) => Number(k[0])),
      opens: baris.map((k) => Number(k[1])),
      highs: baris.map((k) => Number(k[2])),
      lows: baris.map((k) => Number(k[3])),
      closes: baris.map((k) => Number(k[4])),
    };
    simpanan.set(kunci, { waktu: Date.now(), isi });
    return isi;
  } catch {
    return KOSONG;
  }
}

const PASAR = new Map<string, 'spot' | 'futures' | 'hyperliquid'>();

/** Pasar yang melayani simbol ini menurut balasan proxy terakhir, atau null
 *  kalau belum pernah diminta. Dipakai tanda air chart.
 *
 *  `hyperliquid` ada sejak proxy jatuh ke sana untuk koin yang tidak
 *  terdaftar di Binance. Dibedakan, bukan disamakan dengan 'futures':
 *  keduanya memang kontrak perpetual, tapi yang ditanyakan tanda air bukan
 *  cuma "kontraknya apa" melainkan "datanya dari mana". */
export function bacaPasar(simbol: string): 'spot' | 'futures' | 'hyperliquid' | null {
  return PASAR.get(simbol) ?? null;
}

const SPEK_MT5 = new Map<string, number>();
const TICK_MT5 = new Map<string, { bid: number; ask: number; waktu: number }>();

/** Tick MT5 terakhir yang menumpang balasan klines — bahan garis Ask di
 *  chart. `ask` 0 berarti EA-nya masih v2.01 (belum mengirim ask). */
export function bacaTickMt5(simbolDasar: string): { bid: number; ask: number; waktu: number } | null {
  return TICK_MT5.get(simbolDasar) ?? null;
}

/** Dolar per 1 lot per 1.0 pergerakan harga untuk simbol MT5 — null kalau
 *  EA belum pernah mengirimkannya (build lama). */
export function bacaSpekMt5(simbolDasar: string): number | null {
  return SPEK_MT5.get(simbolDasar) ?? null;
}

/* ── RUTE MT5 SEKARANG BUTUH LOGIN ──────────────────────────────────────
   Selama data MT5 disimpan global — satu laci untuk semua broker — ketiga
   rutenya terbuka tanpa autentikasi, dan itu berarti siapa pun tanpa akun
   bisa membaca daftar simbol DAN harga hidup dari terminal SEMUA pengguna.
   Sejak datanya dipisah per pengguna, rutenya menuntut token: tanpa itu
   server tidak tahu laci siapa yang harus dibuka.

   Diam saat belum login — memulangkan kosong, BUKAN melempar. Halaman Chart
   memanggil ini tiap beberapa detik, dan pengunjung yang belum masuk memang
   tidak punya terminal MT5. Itu keadaan normal, bukan galat yang pantas
   diteriakkan ke konsol tiga kali semenit. */
async function kepalaMt5(): Promise<Record<string, string> | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try { return { Authorization: 'Bearer ' + (await u.getIdToken()) }; }
  catch { return null; }
}

/** Simbol MT5 yang datanya sudah ada di server — EA di chart pair lain
 *  otomatis menambah daftarnya. */
/** Simbol MT5 mana yang datanya datang dari feed ACUAN pemilik, bukan dari
 *  terminal pemakainya sendiri. */
const ACUAN_MT5 = new Map<string, boolean>();
export function bacaAcuanMt5(simbolDasar: string): boolean {
  return ACUAN_MT5.get(simbolDasar) === true;
}

/** Nama simbol APA ADANYA di terminal orangnya (XAUUSDc, BTCUSDm, …).
 *
 *  EA memangkas akhiran broker sebelum mengirim lilin, jadi kuncinya selalu
 *  nama dasar. Yang di MT5-nya tertulis "XAUUSDc" lalu di web tertulis
 *  "XAUUSD" wajar bertanya apakah itu pasangan yang sama — dan di akun sen,
 *  dua nama mirip memang bisa berarti nilai lot yang berbeda seratus kali.
 *
 *  UNTUK DITAMPILKAN SAJA. Kunci pencarian data tetap nama dasar; kalau
 *  keduanya ikut berubah, lilin yang sudah tersimpan jadi yatim. */
const NAMA_MT5 = new Map<string, string>();
export function bacaNamaMt5(simbolDasar: string): string {
  return NAMA_MT5.get(simbolDasar) || simbolDasar;
}

export async function daftarSimbolMt5(): Promise<string[]> {
  try {
    /* Tanpa token pun tetap dipanggil: server memulangkan feed ACUAN milik
       pemilik untuk yang belum memasang EA. Menahannya di sini akan membuat
       Trade-Fi terlihat kosong bagi calon pembeli — persis orang yang paling
       perlu melihat bahwa fiturnya bekerja. */
    const kepala = await kepalaMt5();
    const r = await fetch(`${dasar()}/api/mt5/simbol`, kepala ? { headers: kepala } : undefined);
    const j = await r.json();
    /* Peta nama ikut diserap di sini supaya daftar simbol pun sudah bisa
       menampilkan ejaan terminal orangnya, bukan menunggu chartnya dibuka. */
    if (j?.nama && typeof j.nama === 'object') {
      for (const [dasar, nama] of Object.entries(j.nama)) {
        if (typeof nama === 'string' && nama) NAMA_MT5.set(dasar, nama);
      }
    }
    return Array.isArray(j?.simbol) ? j.simbol.filter((x: unknown) => typeof x === 'string') : [];
  } catch { return []; }
}

/** Tick MT5 terakhir per simbol dasar — harga watchlist Trade-Fi. */
export async function hargaTickMt5(): Promise<Record<string, { bid: number; waktu: number }>> {
  try {
    const kepala = await kepalaMt5();
    const r = await fetch(`${dasar()}/api/mt5/simbol`, kepala ? { headers: kepala } : undefined);
    const j = await r.json();
    return j?.harga && typeof j.harga === 'object' ? j.harga : {};
  } catch { return {}; }
}

export interface Ticker {
  lastPrice: number;
  ubah24j: number;
  /** Bursa asal barisnya. `undefined` = Binance — server hanya menandai
   *  baris Hyperliquid, karena menuliskannya di 3.600 baris Binance demi
   *  keseragaman menambah puluhan kB ke jawaban yang memang diramping. */
  bursa?: 'binance' | 'hyperliquid';
}

let tickerCache: { waktu: number; isi: Record<string, Ticker> } | null = null;
let tickerCacheHl: { waktu: number; isi: Record<string, Ticker> } | null = null;

/** Semua ticker 24 jam sekaligus. Satu permintaan untuk ratusan simbol jauh
 *  lebih murah daripada satu permintaan per simbol. */
/** `sertakanHl` menarik juga koin Hyperliquid yang tidak ada di Binance.
 *
 *  Diminta, bukan bawaan — dan cache-nya TERPISAH. Screener memakai daftar
 *  ini sebagai semesta pemindaian; kalau satu pemanggil yang memintanya
 *  mengisi cache bersama, screener akan memindai ratusan koin yang klinenya
 *  tidak ia punya, hanya karena watchlist kebetulan dibuka lebih dulu. */
export async function ambilTickers(sertakanHl = false): Promise<Record<string, Ticker>> {
  const simpan = sertakanHl ? tickerCacheHl : tickerCache;
  if (simpan && Date.now() - simpan.waktu < UMUR_MS) return simpan.isi;
  try {
    const r = await fetch(`${dasar()}/api/tickers${sertakanHl ? '?hl=1' : ''}`);
    if (!r.ok) return simpan?.isi ?? {};
    const j = await r.json();
    const daftar: any[] = Array.isArray(j) ? j : (j?.data ?? []);
    const peta: Record<string, Ticker> = {};
    for (const t of daftar) {
      if (!t?.symbol) continue;
      peta[t.symbol] = {
        lastPrice: Number(t.lastPrice) || 0,
        ubah24j: Number(t.priceChangePercent) || 0,
        bursa: t.bursa === 'hyperliquid' ? 'hyperliquid' : 'binance',
      };
    }
    if (sertakanHl) tickerCacheHl = { waktu: Date.now(), isi: peta };
    else tickerCache = { waktu: Date.now(), isi: peta };
    return peta;
  } catch {
    return simpan?.isi ?? {};
  }
}

/** Benar kalau proxy menjawab sama sekali. Dipakai layar untuk membedakan
 *  "tidak ada sinyal" dari "tidak bisa menghubungi server" — dua keadaan
 *  yang terlihat sama persis kalau tidak dibedakan. */
export async function proxyHidup(): Promise<boolean> {
  try {
    const r = await fetch(`${dasar()}/api/health`);
    return r.ok;
  } catch {
    return false;
  }
}
