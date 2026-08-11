import { bacaKoneksi, koneksiLengkap } from '@/lib/koneksi';
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
  arah: 'BUY' | 'SELL';
  modal: number;
  leverage: number;
  /** Harga entry dari garis di chart. Untuk MARKET dipakai harga terakhir. */
  entry: number;
  jenis: 'MARKET' | 'LIMIT' | 'STOP';
  sl: number;
  tp: number;
  metode: MetodeTp;
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
     Binance dengan -1111 tepat saat ordernya paling ingin masuk. */
  const rf = await fetch(`${dasar}/api/symbol-filters?symbol=${p.simbol}`, { headers: kepala });
  const f = await rf.json();
  if (!rf.ok) throw new Error(f.error || `symbol-filters menjawab ${rf.status}`);
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
