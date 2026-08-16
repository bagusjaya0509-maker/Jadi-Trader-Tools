import { bacaKoneksi, koneksiLengkap, PROXY_BAWAAN } from '@/lib/koneksi';
import { uang, harga as fHarga } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   ORDER SUNGGUHAN KE BINANCE FUTURES — satu jalur untuk seluruh V3
   ════════════════════════════════════════════════════════════════════════
   Bentuk permintaannya MENGIKUTI Area Entry V2 baris demi baris: qty
   dibulatkan dengan aturan simbol dari `/api/symbol-filters`, TP1 = level
   yang dipilih orangnya, TP2 = 2× jarak SL, dan lima metode TP dipetakan
   persis seperti di V2 (partial / nopartial / tp1only / tp2only / slplus).

   Pengaman yang sama juga ikut: simbol tanpa dukungan STOP_MARKET /
   TAKE_PROFIT_MARKET DITOLAK SEBELUM entry — kejadian SANDUSDT (entry
   berhasil, SL gagal terpasang, posisi menggantung tanpa proteksi) tidak
   boleh terulang lewat jalur mana pun.

   Entry LIMIT / STOP menggantung di Binance tanpa SL/TP; pemantau di bawah
   memeriksa tiap 10 detik dan memasang SL/TP lewat `attach-sltp` begitu
   terisi — selama tab-nya masih terbuka.
   ════════════════════════════════════════════════════════════════════════ */

export type MetodeTp = 'partial' | 'nopartial' | 'tp1only' | 'tp2only' | 'slplus';

export const METODE_TP: { nilai: MetodeTp; label: string }[] = [
  { nilai: 'partial', label: 'TP1 & TP2 — partial 50% di TP1, SL ke BE' },
  { nilai: 'nopartial', label: 'TP1 & TP2 — SL ke BE di TP1, tanpa partial' },
  { nilai: 'tp1only', label: 'SL & TP1 saja (1× risiko)' },
  { nilai: 'tp2only', label: 'SL & TP2 saja (2× risiko)' },
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
  const v = Math.floor(n / step) * step;
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
  const f = await ambilFilter(dasar, p.simbol, kepala);
  const stepSize: number = f.stepSize || 0.001;
  const tickSize: number = f.tickSize || 0.01;
  const qP: number | null = f.quantityPrecision ?? null;
  const pP: number | null = f.pricePrecision ?? null;
  const orderTypes: string[] = Array.isArray(f.orderTypes) ? f.orderTypes : [];

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
  if (!confirm(`Kirim order SUNGGUHAN ke Binance?\n\n${rincian}\n\nUang sungguhan akan bergerak.`)) {
    return { pesan: 'Dibatalkan.', pending: false };
  }

  const r = await fetch(`${dasar}/api/trade/futures`, {
    method: 'POST', headers: kepala,
    body: JSON.stringify({
      symbol: p.simbol, side: p.arah, quantity: qtyStr, leverage: p.leverage,
      entryType: p.jenis === 'MARKET' ? 'MARKET' : p.jenis === 'LIMIT' ? 'LIMIT' : 'STOP_MARKET',
      entryPrice: p.jenis === 'MARKET' ? undefined : keStep(p.entry, tickSize, pP),
      sl: slStr, tp1: tp1Kirim, qty1,
      ...(tp2Kirim ? { tp2: tp2Kirim, qty2: qty2Kirim } : {}),
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const tahap = j.stage ? `[gagal di: ${j.stage}] ` : '';
    throw new Error(tahap + (j.error ? JSON.stringify(j.error).slice(0, 200) : `Backend menjawab ${r.status}`));
  }

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
      pesan: `Order ${labelJenis} menggantung di Binance. Halaman ini memantau tiap 10 detik dan memasang SL/TP begitu terisi — biarkan tab-nya terbuka.`,
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
    body: JSON.stringify(p),
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
    body: JSON.stringify({ symbol: p.symbol, orderId: p.orderId, isAlgo: p.isAlgo !== false }),
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
    body: JSON.stringify(p),
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
