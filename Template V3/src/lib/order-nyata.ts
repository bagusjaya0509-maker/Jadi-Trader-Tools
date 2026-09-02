import { bacaKoneksi, koneksiLengkap, PROXY_BAWAAN } from '@/lib/koneksi';
import { bacaPasar } from '@/lib/pasar';
import { uang, harga as fHarga } from '@/lib/utils';
import { mulaiKirim, tandaiTerkirim, tandaiGagal } from '@/lib/order-sementara';

/* ════════════════════════════════════════════════════════════════════════
   ORDER SUNGGUHAN — satu jalur untuk seluruh V3, DUA bursa
   (Binance Futures dan Hyperliquid perps; yang memilih `bursaSimbol`)
   ════════════════════════════════════════════════════════════════════════
   Bentuk permintaannya MENGIKUTI Area Entry V2 baris demi baris: qty
   dibulatkan dengan aturan simbol dari `/api/symbol-filters`, TP1 = level
   yang dipilih orangnya, TP2 = 2× jarak SL, dan lima metode TP dipetakan
   persis seperti di V2 (partial / nopartial / tp1only / tp2only / slplus).

   Pengaman yang sama juga ikut: simbol tanpa dukungan STOP_MARKET /
   TAKE_PROFIT_MARKET DITOLAK SEBELUM entry — kejadian SANDUSDT (entry
   berhasil, SL gagal terpasang, posisi menggantung tanpa proteksi) tidak
   boleh terulang lewat jalur mana pun.

   Entry LIMIT / STOP menggantung di bursa tanpa SL/TP; pemantau di bawah
   memeriksa tiap 10 detik dan memasang SL/TP lewat `attach-sltp` begitu
   terisi — selama tab-nya masih terbuka.
   ════════════════════════════════════════════════════════════════════════ */

export type MetodeTp = 'partial' | 'nopartial' | 'tp1only' | 'tp2only' | 'slplus';

/* ── URUTAN & LABEL: YANG PALING SEDERHANA DI ATAS ──────────────────────
   `tp1only` naik ke puncak dan jadi bawaan (2 Sep 2026, permintaan pemilik:
   "jangan langsung ditentukan tp parsial dll biar ga bingung").

   Alasannya bukan selera. Bawaan lama `partial` diam-diam MENGUBAH dua hal
   yang tidak diminta siapa pun: ukurannya dipotong separuh di TP1, dan TP2
   dipasang di 2x jarak SL — level yang TIDAK PERNAH digambar orangnya di
   chart. Jadi garis TP yang ia seret dengan hati-hati cuma berlaku untuk
   setengah posisi, dan setengah lagi keluar di tempat yang ia tidak pilih.

   `tp1only` tidak menambahkan apa pun: satu TP, di garis yang memang ia
   taruh, untuk SELURUH ukuran. Yang mau partial tinggal memilihnya — dan
   memilih sesuatu yang menambah aturan jauh lebih tidak berbahaya daripada
   mendapatkannya tanpa memilih.

   Labelnya juga diperbaiki. "(1x risiko)" mengandaikan TP-nya berada di 1R,
   padahal ia berada di mana pun garis TP diletakkan — keterangan yang
   menyebut angka yang belum tentu benar lebih buruk daripada tanpa angka. */
export const METODE_TP: { nilai: MetodeTp; label: string }[] = [
  { nilai: 'tp1only', label: 'SL & TP saja — satu TP di garismu, ukuran penuh' },
  { nilai: 'partial', label: 'TP1 & TP2 — partial 50% di TP1, SL ke BE' },
  { nilai: 'nopartial', label: 'TP1 & TP2 — SL ke BE di TP1, tanpa partial' },
  { nilai: 'tp2only', label: 'SL & TP saja — TP di 2× jarak SL' },
  { nilai: 'slplus', label: 'SL+ — partial 50%, SL naik tiap 1× risiko' },
];

export interface PermintaanNyata {
  simbol: string;
  /** Timeframe chart saat order dikirim — dipakai catatan posisi screener. */
  tf?: string;
  arah: 'BUY' | 'SELL';
  modal: number;
  leverage: number;
  /** Harga entry dari garis di chart. Untuk MARKET dipakai harga terakhir. */
  entry: number;
  jenis: 'MARKET' | 'LIMIT' | 'STOP';
  sl: number;
  tp: number;
  metode: MetodeTp;
  /** Emosi & alasan dari tiket — masuk record posisi screener dan jurnal. */
  emosi?: string;
  alasan?: string;
}

/* ── BURSA TUJUAN, SATU SUMBER ────────────────────────────────────────────
   Sama dengan yang dipakai kotak order di chart: pasar yang BENAR-BENAR
   dipakai proxy untuk menggambar lilin simbol ini. Ditulis sekali di sini
   supaya lima pemanggil di bawah tidak masing-masing menurunkannya sendiri
   dan berselisih pada simbol yang kebetulan ada di dua bursa.

     ── "BELUM TAHU" BUKAN "BINANCE" ────────────────────────────────────
     Versi pertama menjatuhkan pasar yang belum terbaca ke 'binance' dan
     mengirimnya TEGAS. Itu keliru dengan cara yang mahal: medan yang tegas
     mengalahkan tebakan server, jadi order CASHCAT — koin yang justru jadi
     alasan jalur ini dibangun — akan dipaksa ke Binance dan ditolak di
     sana, hanya karena layar kebetulan belum sempat mencatat pasarnya.

     Sekarang medan itu DIHILANGKAN saat pasarnya belum terbaca, dan server
     memakai tebakannya sendiri (ada di Binance? ke Binance; kalau tidak,
     coba Hyperliquid). Bawaan yang benar untuk "tidak tahu" adalah diam,
     bukan menebak dengan nada yakin. */
function bursaSimbol(simbol: string): 'binance' | 'hyperliquid' | null {
  const p = bacaPasar(simbol);
  return p === 'hyperliquid' ? 'hyperliquid' : p ? 'binance' : null;
}

/** Potongan `{ bursa }` yang boleh langsung disebar ke badan permintaan —
 *  kosong kalau pasarnya belum terbaca. */
function medanBursa(simbol: string): { bursa?: 'binance' | 'hyperliquid' } {
  const b = bursaSimbol(simbol);
  return b ? { bursa: b } : {};
}

/* Cache filter simbol seumur 10 menit. Bukan localStorage: aturan bursa
   boleh basi beberapa menit, tapi tidak boleh selamat dari hari ke hari —
   dan kegagalan mengambilnya harus tetap terasa, bukan tertutup data lama. */
const cacheFilter = new Map<string, { waktu: number; isi: any }>();
const UMUR_FILTER_MS = 10 * 60 * 1000;

async function ambilFilter(dasar: string, simbol: string, kepala: Record<string, string>) {
  const kena = cacheFilter.get(simbol);
  if (kena && Date.now() - kena.waktu < UMUR_FILTER_MS) return kena.isi;
  const rf = await fetch(`${dasar}/api/symbol-filters?symbol=${simbol}`, { headers: kepala });
  const f = await rf.json();
  if (!rf.ok) throw new Error(f.error || `symbol-filters menjawab ${rf.status}`);
  cacheFilter.set(simbol, { waktu: Date.now(), isi: f });
  return f;
}

function keStep(n: number, step: number, presisi: number | null) {
  /* ── step <= 0 BERARTI "JANGAN BULATKAN DI SINI" ───────────────────
     Dipakai jalur Hyperliquid, yang aturan angkanya bukan step/tick
     melainkan "5 angka penting DAN maksimal 6 - szDecimals desimal" —
     dan yang tahu szDecimals tiap koin cuma server.

     Tanpa cabang ini, `n / 0` = Infinity, `Math.floor(Infinity) * 0` =
     NaN, dan qty berangkat sebagai string "NaN". Itu bukan teori: order
     CASHCAT pertama ditolak dengan "Ukuran NaN membulat jadi nol untuk
     CASHCAT (0 desimal)" — 2 Sep 2026, dilaporkan pemilik dari layar.

     toFixed(12) lalu buang nol ekor, BUKAN String(n): String memberi
     notasi eksponen untuk angka kecil ("1e-7"), dan Hyperliquid menolak
     harga berbentuk itu. */
  if (!(step > 0)) {
    return n.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  }

  /* -- PEMBAGIANNYA DIRAPIKAN DULU ---------------------------------
     `n / step` di IEEE-754 sering meleset sedikit DI BAWAH bilangan
     bulat yang seharusnya, dan Math.floor mengubah meleset sedikit itu
     jadi kesalahan SATU STEP PENUH:

         3.3   / 0.1   = 32.99999999999999  -> floor 32 -> 3.2
         117.6 / 0.1   = 1175.9999999999998 -> floor 1175 -> 117.5
         0.29  / 0.01  = 28.999999999999996 -> floor 28  -> 0.28

     Yang terkirim ke Binance lalu berbeda dari yang tertulis di tiket --
     bukan karena pembulatan step bursa, melainkan karena aritmetika kita
     sendiri. Selisihnya kecil (satu tick) tapi ia nyata, dan ia menggeser
     SL/TP serta qty ke arah yang tidak pernah diminta siapa pun.

     toPrecision(12) membuang debu binernya sebelum dibulatkan ke bawah.
     Dua belas angka penting jauh di atas presisi harga bursa mana pun,
     jadi nilai yang memang BUKAN kelipatan step tetap turun ke step di
     bawahnya seperti seharusnya -- yang berubah cuma yang sebenarnya
     sudah pas. */
  const v = Math.floor(Number((n / step).toPrecision(12))) * step;
  return v.toFixed(presisi ?? 6);
}

/** Kirim order sungguhan. Melempar Error dengan pesan yang bisa langsung
 *  ditampilkan; mengembalikan pesan sukses + apakah entrinya menggantung. */
export async function kirimOrderNyata(p: PermintaanNyata): Promise<{ pesan: string; pending: boolean }> {
  const koneksi = bacaKoneksi();
  if (!koneksiLengkap(koneksi)) {
    throw new Error('Backend URL & App Token belum dipasang — buka Integrations dulu.');
  }
  if (!p.entry || !p.sl || !p.tp) throw new Error('Entry, SL, dan TP wajib terisi.');
  const sisiBenar = p.arah === 'BUY' ? p.sl < p.entry && p.tp > p.entry : p.sl > p.entry && p.tp < p.entry;
  if (!sisiBenar) throw new Error('SL/TP berada di sisi yang salah terhadap entry.');

  const dasar = koneksi.url.trim().replace(/\/+$/, '');
  const kepala = { 'Content-Type': 'application/json', 'X-App-Token': koneksi.token.trim() };

  /* Aturan presisi simbol — WAJIB. Menebak jumlah desimal berarti ditolak
     Binance dengan -1111 tepat saat ordernya paling ingin masuk.

     Di-CACHE per sesi: permintaan ini berangkat SEBELUM dialog konfirmasi,
     jadi dialah jeda antara menekan Kirim dan munculnya angka yang harus
     disetujui. Aturan presisi berubah nyaris tidak pernah (VPS pun
     menyimpannya 6 jam); menunggu jaringan untuk data yang sudah kita
     pegang membuat tombolnya terasa berat tanpa alasan. */
  /* ── SIMBOL HYPERLIQUID TIDAK PUNYA FILTER BINANCE ────────────────────
     `/api/symbol-filters` bertanya ke Binance. Untuk koin yang memang tidak
     ada di sana, jawabannya kosong dan bawaannya dipakai — tickSize 0,01.

     Itu MERUSAK, bukan cuma tidak akurat: CASHCAT diperdagangkan di 0,27,
     jadi SL 0,2612 dibulatkan jadi 0,26 dan TP 0,2884 jadi 0,29. Angka yang
     disetujui orangnya di dialog bukan angka yang berangkat, dan selisihnya
     berada persis di tempat yang paling menentukan hasil trade-nya.

     Hyperliquid punya aturan angkanya sendiri (5 angka penting, maksimal
     6 - szDecimals desimal) dan `orderHl` di server sudah membulatkan dengan
     aturan itu. Jadi jalur ini mengirim angka MENTAH dan membiarkan yang
     tahu aturannya yang membulatkan. */
  /* null (pasar belum terbaca) diperlakukan sebagai BUKAN Hyperliquid:
     jalur Binance yang mengambil filter presisi adalah perilaku lama, dan
     ketidaktahuan tidak boleh mengubahnya. */
  const keHl = bursaSimbol(p.simbol) === 'hyperliquid';
  /* Filter TETAP diambil untuk Hyperliquid: rutenya sekarang menjawab
     simbol HL juga. Yang dijawabnya cuma aturan UKURAN (szDecimals), dan
     itu justru bagian yang paling perlu — qty angka TURUNAN yang dihitung
     layar, jadi layar dan bursa wajib membulatkannya dengan cara yang sama.
     Kalau tidak, angka yang disetujui di tiket bukan angka yang berangkat.

     Harga sengaja dijawab null oleh server dan diteruskan sebagai 0 di
     sini: aturan harga Hyperliquid dua lapis dan tidak bisa diwakili satu
     tickSize. `keStep` dengan step 0 berarti "jangan bulatkan di sini" —
     server yang punya `bulatHarga` yang mengerjakannya. */
  const f = await ambilFilter(dasar, p.simbol, kepala);
  const stepSize: number = Number(f.stepSize) > 0 ? Number(f.stepSize) : (keHl ? 0 : 0.001);
  const tickSize: number = Number(f.tickSize) > 0 ? Number(f.tickSize) : (keHl ? 0 : 0.01);
  const qP: number | null = f.quantityPrecision ?? null;
  const pP: number | null = f.pricePrecision ?? null;
  /* Kosong untuk Hyperliquid: dua pengaman di bawah menanyakan dukungan
     STOP_MARKET/TAKE_PROFIT_MARKET, dan itu pertanyaan tentang Binance.
     Menjawabnya dengan daftar kosong membuat keduanya dilewati — yang benar,
     karena di Hyperliquid setiap perp mendukung trigger order. */
  const orderTypes: string[] = keHl ? [] : (Array.isArray(f.orderTypes) ? f.orderTypes : []);

  /* Pengaman PALING PENTING — sama dengan V2. */
  if (orderTypes.length && (!orderTypes.includes('STOP_MARKET') || !orderTypes.includes('TAKE_PROFIT_MARKET'))) {
    throw new Error(`${p.simbol} tidak mendukung STOP_MARKET/TAKE_PROFIT_MARKET otomatis — order dibatalkan sebelum entry, pilih simbol lain.`);
  }
  if (p.jenis === 'LIMIT' && orderTypes.length && !orderTypes.includes('LIMIT')) {
    throw new Error(`${p.simbol} tidak mendukung order LIMIT.`);
  }

  const qtyStr = keStep((p.modal * p.leverage) / p.entry, stepSize, qP);
  if (Number(qtyStr) <= 0) throw new Error('Modal terlalu kecil untuk lot minimum simbol ini.');
  const slStr = keStep(p.sl, tickSize, pP);
  const jarak = Math.abs(p.entry - p.sl);
  const tp2N = p.arah === 'BUY' ? p.entry + jarak * 2 : p.entry - jarak * 2;
  const tp1Fmt = keStep(p.tp, tickSize, pP);
  const tp2Fmt = keStep(tp2N, tickSize, pP);

  /* Pemetaan metode — SALINAN SETIA cabang-cabang V2. */
  let qty1 = qtyStr, tp1Kirim = tp1Fmt, tp2Kirim: string | undefined, qty2Kirim: string | undefined;
  if (p.metode === 'partial' || p.metode === 'slplus') {
    const setengah = keStep(Number(qtyStr) / 2, stepSize, qP);
    const sisa = (Number(qtyStr) - Number(setengah)).toFixed(qP ?? 6);
    if (Number(setengah) > 0 && Number(sisa) > 0) {
      qty1 = setengah;
      /* slplus TIDAK mengirim tp2 sebagai order asli — level itu dikelola
         pemantau ratchet di halaman Screener Entry, persis seperti V2. */
      if (p.metode === 'partial') { tp2Kirim = tp2Fmt; qty2Kirim = sisa; }
    }
  } else if (p.metode === 'nopartial' || p.metode === 'tp2only') {
    tp1Kirim = tp2Fmt; /* satu TP penuh di 2× risiko */
  }

  const labelJenis = p.jenis === 'MARKET' ? 'Market'
    : `${p.arah === 'BUY' ? 'Buy' : 'Sell'} ${p.jenis === 'STOP' ? 'Stop' : 'Limit'} @ ${fHarga(p.entry)}`;
  const rincian = [
    `${p.arah} ${p.simbol} · ${labelJenis}`,
    `Nilai order ${uang(p.modal * p.leverage)} (modal ${uang(p.modal)} × ${p.leverage}) · qty ${qtyStr}`,
    `SL ${slStr} · TP1 ${tp1Kirim} (qty ${qty1})${tp2Kirim ? ` · TP2 ${tp2Kirim} (qty ${qty2Kirim})` : ''}`,
    `Metode: ${METODE_TP.find((m) => m.nilai === p.metode)?.label}`,
  ].join('\n');
  /* ── KALIMAT INI DULU SELALU MENULIS "ke Binance" ─────────────────────
     Ia salah sejak jalur Hyperliquid ada, dan salahnya jenis yang paling
     buruk: bukan diam, melainkan MEYAKINKAN orangnya tentang hal yang
     keliru, tepat pada detik ia menimbang uang sungguhan.

     Ketahuan bukan dari membaca kode, melainkan dari memeriksa bundel yang
     BENAR-BENAR tayang dan menemukan kalimat lama masih di sana — sesudah
     versi yang sudah diperbaiki dikira sudah terpasang. */
  const bTujuan = bursaSimbol(p.simbol);
  const kalimatBursa = bTujuan === 'hyperliquid' ? 'Kirim order SUNGGUHAN ke Hyperliquid?'
    : bTujuan === 'binance' ? 'Kirim order SUNGGUHAN ke Binance?'
    : 'Kirim order SUNGGUHAN? (bursanya dipilih server — pasar simbol ini belum terbaca di layar)';
  if (!confirm(`${kalimatBursa}\n\n${rincian}\n\nUang sungguhan akan bergerak.`)) {
    return { pesan: 'Dibatalkan.', pending: false };
  }

  /* BARIS SEMENTARA DIPASANG DI SINI — sesudah orangnya menyetujui, sebelum
     permintaannya berangkat. Order butuh beberapa detik sampai ke Binance
     dan tabel Posisi Terbuka baru menampilkannya pada putaran baca
     berikutnya; selama jeda itu layar kosong, dan yang dirasakan bukan
     "sedang menunggu" melainkan "ordernya gagal". Orang yang mengira
     ordernya gagal MEMESAN LAGI — dua order untuk satu niat.

     Ditaruh di lib, bukan di halaman Chart, supaya setiap pemanggil
     kirimOrderNyata ikut mendapatkannya tanpa mengulang kode yang sama. */
  const idSementara = mulaiKirim({
    simbol: p.simbol, arah: p.arah,
    jenis: p.jenis === 'MARKET' ? 'Market' : p.jenis === 'LIMIT' ? 'Limit' : 'Stop',
    harga: p.jenis === 'MARKET' ? (p.entry || 0) : Number(keStep(p.entry, tickSize, pP)),
    qty: Number(qtyStr) || 0,
    sl: Number(slStr) || 0,
    tp: Number(tp1Kirim) || 0,
    /* MARKET langsung jadi POSISI; LIMIT/STOP menggantung sebagai PENDING.
       Bedanya menentukan daftar mana yang dipakai memeriksa apakah bursa
       sudah benar-benar mencatatnya. */
    menjadi: p.jenis === 'MARKET' ? 'posisi' : 'pending',
  });

  let r: Response;
  let j: any;
  try {
    r = await fetch(`${dasar}/api/trade/futures`, {
      method: 'POST', headers: kepala,
      body: JSON.stringify({
        ...medanBursa(p.simbol),
        symbol: p.simbol, side: p.arah, quantity: qtyStr, leverage: p.leverage,
        entryType: p.jenis === 'MARKET' ? 'MARKET' : p.jenis === 'LIMIT' ? 'LIMIT' : 'STOP_MARKET',
        entryPrice: p.jenis === 'MARKET' ? undefined : keStep(p.entry, tickSize, pP),
        sl: slStr, tp1: tp1Kirim, qty1,
        ...(tp2Kirim ? { tp2: tp2Kirim, qty2: qty2Kirim } : {}),
      }),
    });
    j = await r.json().catch(() => ({}));
  } catch (e) {
    /* Jaringan putus sebelum jawaban datang. Ini keadaan yang PALING perlu
       dikatakan apa adanya: ordernya bisa saja sudah sampai ke bursa. */
    tandaiGagal(idSementara, 'Jaringan terputus — periksa Binance sebelum mengirim ulang.');
    throw e;
  }
  if (!r.ok) {
    const tahap = j.stage ? `[gagal di: ${j.stage}] ` : '';
    const pesan = tahap + (j.error ? JSON.stringify(j.error).slice(0, 200) : `Backend menjawab ${r.status}`);
    tandaiGagal(idSementara, pesan);
    throw new Error(pesan);
  }
  tandaiTerkirim(idSementara);

  /* ── Catat ke registry posisi Screener Entry ──────────────────────
     V2 menampilkan tabel Posisi Terbuka dari `emaScreenerPrioritySim_v1`
     di localStorage — dan karena tempelan V2 berbagi origin dengan V3,
     menulis di sini membuat order dari halaman Chart LANGSUNG muncul di
     screener, ikut tersinkron ke cloud V2, dan ikut dikelola pemantau
     BE/ratchet-nya. Bentuk record menyalin recordLivePosition V2. */
  try {
    const KUNCI_PSIM = 'emaScreenerPrioritySim_v1';
    const simpanan = JSON.parse(localStorage.getItem(KUNCI_PSIM) || '{"positions":{},"history":[]}');
    simpanan.positions = simpanan.positions || {};
    const key = p.simbol + '_' + (p.tf || '4h') + '_LIVE_' + Date.now();
    const tp1Num = (p.metode === 'nopartial') ? Number(tp1Fmt) : Number(tp1Kirim);
    const tp2Num = qty2Kirim ? Number(tp2Kirim) : (p.metode === 'nopartial' ? Number(tp2Fmt) : null);
    simpanan.positions[key] = {
      key, source: p.simbol, tfLabel: p.tf || '4h', tfValue: p.tf || '4h', dir: p.arah,
      entryPrice: p.entry, entryTime: Date.now(),
      sl: Number(slStr), tp1: tp1Num, tp2: tp2Num,
      qty1: Number(qty1), qty2: qty2Kirim ? Number(qty2Kirim) : null,
      tp1Hit: false, tp2Hit: false,
      margin: p.modal, leverage: p.leverage, qty: Number(qtyStr),
      venue: 'live-real',
      liveOrderId: j.entryOrder?.orderId ?? j.entryOrderId ?? null,
      liveSlOrderId: j.slOrder?.orderId ?? null,
      liveTp1OrderId: j.tp1Order?.orderId ?? null,
      liveTp2OrderId: j.tp2Order?.orderId ?? null,
      entryMethod: p.metode, virtualTp1: p.metode === 'nopartial' ? Number(tp1Fmt) : null,
      signalType: 'chart-backtest', preEmosi: p.emosi || '', preAlasan: p.alasan || 'Order dari Chart & Backtest V3',
      ...(j.pending ? { pending: true, entryPriceTarget: p.entry, isAlgoEntry: !!j.isAlgoEntry } : {}),
    };
    localStorage.setItem(KUNCI_PSIM, JSON.stringify(simpanan));
  } catch { /* localStorage penuh/privat — ordernya sendiri sudah terkirim */ }

  if (j.pending) {
    mulaiPantau({ simbol: p.simbol, arah: p.arah, qty: qtyStr, sl: slStr, tp1: tp1Kirim, qty1, tp2: tp2Kirim, qty2: qty2Kirim });
    return {
      /* Bursanya disebut, bukan diandaikan. Kalimat ini muncul tepat
         sesudah uang berangkat, dan menyebut bursa yang salah di situ
         mengirim orang memeriksa akun yang tidak ada ordernya. */
      pesan: `Order ${labelJenis} menggantung di ${bTujuan === 'hyperliquid' ? 'Hyperliquid' : 'Binance'}. Halaman ini memantau tiap 10 detik dan memasang SL/TP begitu terisi — biarkan tab-nya terbuka.`,
      pending: true,
    };
  }
  return { pesan: `Order terkirim — ${p.arah} ${p.simbol} ${uang(p.modal * p.leverage)}. Posisinya muncul di Dashboard dan jurnal kripto.`, pending: false };
}

/* ── Pemantau fill untuk entry LIMIT/STOP ────────────────────────────────
   Modul-level: bertahan selama tab hidup, berapa pun komponen yang
   bongkar-pasang. Berhenti sendiri setelah SL/TP terpasang atau 24 jam. */
const pantauan = new Map<string, ReturnType<typeof setInterval>>();

function mulaiPantau(d: { simbol: string; arah: 'BUY' | 'SELL'; qty: string; sl: string; tp1: string; qty1: string; tp2?: string; qty2?: string }) {
  const kunci = `${d.simbol}|${Date.now()}`;
  const mulaiMs = Date.now();
  const jam = setInterval(async () => {
    if (Date.now() - mulaiMs > 86_400_000) { clearInterval(jam); pantauan.delete(kunci); return; }
    const koneksi = bacaKoneksi();
    if (!koneksiLengkap(koneksi)) return;
    const dasar = koneksi.url.trim().replace(/\/+$/, '');
    const kepala = { 'Content-Type': 'application/json', 'X-App-Token': koneksi.token.trim() };
    try {
      const r = await fetch(`${dasar}/api/positions`, { headers: kepala });
      const j = await r.json();
      const pos = (Array.isArray(j) ? j : j.positions ?? []).find(
        (x: { symbol?: string; positionAmt?: string }) => x.symbol === d.simbol && Math.abs(Number(x.positionAmt)) > 0
      );
      if (!pos) return;
      await fetch(`${dasar}/api/trade/futures/attach-sltp`, {
        method: 'POST', headers: kepala,
        body: JSON.stringify({
          ...medanBursa(d.simbol),
          symbol: d.simbol, side: d.arah, quantity: d.qty,
          sl: d.sl, tp1: d.tp1, qty1: d.qty1,
          ...(d.tp2 && d.qty2 ? { tp2: d.tp2, qty2: d.qty2 } : {}),
        }),
      });
      clearInterval(jam); pantauan.delete(kunci);
    } catch { /* coba lagi putaran berikutnya */ }
  }, 10_000);
  pantauan.set(kunci, jam);
}

/* ══════════════════════════════════════════════════════════════════════
   UBAH SL/TP ORDER YANG SUDAH TERPASANG
   ══════════════════════════════════════════════════════════════════════
   Binance tidak punya "geser trigger price". Cara mengubah conditional
   order adalah MEMBATALKAN yang lama lalu memasang yang baru, dan itu
   dikerjakan backend dalam satu permintaan supaya tidak ada jendela
   waktu di mana posisinya tak terlindungi karena tab tertutup di antara
   dua panggilan.

   Id order lama dikirim supaya yang dibatalkan benar-benar order ini,
   bukan "SL apa pun di simbol ini" — akun yang punya beberapa stop di
   satu pair akan kehilangan yang salah.
   ══════════════════════════════════════════════════════════════════════ */
export interface UbahSlTp {
  symbol: string;
  side: 'BUY' | 'SELL';
  sl?: number;
  slQuantity?: number;
  oldSlOrderId?: string;
  tp1?: number;
  tp1Quantity?: number;
  oldTp1OrderId?: string;
}

export async function ubahSlTpNyata(p: UbahSlTp): Promise<void> {
  const { url, token } = bacaKoneksi();
  const dasar = (url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
  if (!token.trim()) throw new Error('App Token belum diisi di Integrations.');
  const r = await fetch(`${dasar}/api/trade/futures/edit-sltp`, {
    method: 'POST',
    headers: { 'X-App-Token': token.trim(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...p, ...medanBursa(p.symbol) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    /* Pesan bursa dibawa apa adanya kalau ada — "would immediately
       trigger" jauh lebih berguna daripada "gagal 500". */
    const rinci = typeof j?.error === 'object' ? (j.error.msg ?? JSON.stringify(j.error)) : j?.error;
    throw new Error(rinci ? String(rinci) : `Backend menjawab ${r.status}`);
  }
}

/** Batalkan pending order kripto yang belum ke-fill. */
export async function batalPendingNyata(p: { symbol: string; orderId: string; isAlgo?: boolean }): Promise<void> {
  const { url, token } = bacaKoneksi();
  const dasar = (url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
  if (!token.trim()) throw new Error('App Token belum diisi di Integrations.');
  /* cancel-order, BUKAN cancel-pending. Yang kedua namanya menjanjikan
     hal ini tapi isinya cuma mengurus SL/TP: ia menerima slOrderId /
     tp1OrderId / tp2OrderId dan MENGABAIKAN orderId. Permintaan hapus
     dijawab 200 dengan objek kosong — order tetap hidup di bursa
     sementara layar berkata sudah dibatalkan. Kegagalan diam yang paling
     berbahaya bentuknya: ia terlihat berhasil. */
  const r = await fetch(`${dasar}/api/trade/futures/cancel-order`, {
    method: 'POST',
    headers: { 'X-App-Token': token.trim(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: p.symbol, orderId: p.orderId, isAlgo: p.isAlgo !== false,
                           ...medanBursa(p.symbol) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof j?.error === 'object' ? (j.error.msg ?? JSON.stringify(j.error)) : (j?.error ?? `Backend menjawab ${r.status}`));
}

/** Tutup posisi kripto di harga pasar. SL/TP yang masih menggantung ikut
 *  dibatalkan backend — stop yatim yang tertinggal akan menembak posisi
 *  BERIKUTNYA di pair yang sama. */
export async function tutupPosisiNyata(p: {
  symbol: string; side: 'BUY' | 'SELL'; quantity: number;
  slOrderId?: string; tp1OrderId?: string;
}): Promise<void> {
  const { url, token } = bacaKoneksi();
  const dasar = (url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
  if (!token.trim()) throw new Error('App Token belum diisi di Integrations.');
  const r = await fetch(`${dasar}/api/trade/futures/close`, {
    method: 'POST',
    headers: { 'X-App-Token': token.trim(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...p, ...medanBursa(p.symbol) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof j?.error === 'object' ? (j.error.msg ?? JSON.stringify(j.error)) : (j?.error ?? `Backend menjawab ${r.status}`));
}


/** Tick size simbol dari bursa, di-cache per simbol.
 *
 *  Membulatkan harga memakai "jumlah desimal harga lain" cuma tebakan
 *  yang kebetulan sering benar. Yang menentukan sah atau tidaknya sebuah
 *  harga adalah tickSize simbol itu — BTCUSDT 0.1, THETAUSDT 0.0001 —
 *  dan bursa menolak apa pun di luar kelipatannya dengan "Precision is
 *  over the maximum defined for this asset". Ditolak berarti stop yang
 *  dikira terpasang sebenarnya tidak ada. */
const tickCache = new Map<string, number>();

export async function tickSimbol(simbol: string): Promise<number> {
  const ada = tickCache.get(simbol);
  if (ada) return ada;
  const { url, token } = bacaKoneksi();
  const dasar = (url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
  if (!token.trim()) return 0;
  try {
    const r = await fetch(`${dasar}/api/symbol-filters?symbol=${encodeURIComponent(simbol)}`, {
      headers: { 'X-App-Token': token.trim() },
    });
    if (!r.ok) return 0;
    const j = await r.json();
    const t = Number(j.tickSize) || 0;
    if (t > 0) tickCache.set(simbol, t);
    return t;
  } catch { return 0; }
}

/** Bulatkan ke kelipatan tick terdekat, dengan desimal yang benar. */
export function keTick(nilai: number, tick: number): number {
  if (!tick || tick <= 0) return nilai;
  const desimal = Math.max(0, Math.min(10, String(tick).includes('.') ? String(tick).split('.')[1].replace(/0+$/, '').length : 0));
  return Number((Math.round(nilai / tick) * tick).toFixed(desimal));
}
