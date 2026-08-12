import { bacaKoneksi } from '@/lib/koneksi';

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

const PROXY_BAWAAN = 'https://103-253-145-38.sslip.io';

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

/* `segar` = jalur cepat untuk SATU chart yang sedang ditatap.
   ──────────────────────────────────────────────────────────────────────
   Pemindaian screener meminta puluhan simbol sekaligus — cache 15 detik di
   sana adalah pelindung, bukan penghambat. Chart live kebalikannya: satu
   simbol, satu penonton, dan 15 detik terasa seperti harga yang membeku.
   Jalur segar memakai umur cache 2,5 detik dan meminta backend melewati
   cache server-nya (fresh=1). Beban: satu chart @3 dtk = 20 permintaan per
   menit — Binance mengizinkan 1200 bobot per menit, klines berbobot 2,
   jadi ini 3% dari jatah. */
export async function ambilKlines(simbol: string, tf: string, batas = 200, segar = false): Promise<Lilin> {
  const kunci = `${simbol}|${tf}|${batas}`;
  const ada = simpanan.get(kunci);
  if (ada && Date.now() - ada.waktu < (segar ? 2_500 : UMUR_MS)) return ada.isi;

  try {
    /* Simbol "MT5:XAUUSD" = sumber TRADE-FI: OHLC yang dikirim EA v2 dari
       terminal MT5 pengguna, bukan dari Binance. Bentuk balasan servernya
       sudah disamakan dengan /api/klines, jadi seluruh halaman — chart,
       indikator, replay, backtest — bekerja tanpa tahu bedanya. */
    const mt5 = simbol.startsWith('MT5:');
    const r = await fetch(mt5
      ? `${dasar()}/api/mt5/klines?symbol=${encodeURIComponent(simbol.slice(4))}&interval=${tf}&limit=${batas}`
      : `${dasar()}/api/klines?symbol=${encodeURIComponent(simbol)}&interval=${tf}&limit=${batas}${segar ? '&fresh=1' : ''}`);
    if (!r.ok) return KOSONG;
    const j = await r.json();
    /* Backend membungkus balasan Binance jadi {ok, data}. Bentuk mentah
       Binance sendiri berupa array-of-array, jadi keduanya diterima —
       proxy yang lebih lama pernah meneruskan apa adanya. */
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

export interface Ticker { lastPrice: number; ubah24j: number }

let tickerCache: { waktu: number; isi: Record<string, Ticker> } | null = null;

/** Semua ticker 24 jam sekaligus. Satu permintaan untuk ratusan simbol jauh
 *  lebih murah daripada satu permintaan per simbol. */
export async function ambilTickers(): Promise<Record<string, Ticker>> {
  if (tickerCache && Date.now() - tickerCache.waktu < UMUR_MS) return tickerCache.isi;
  try {
    const r = await fetch(`${dasar()}/api/tickers`);
    if (!r.ok) return tickerCache?.isi ?? {};
    const j = await r.json();
    const daftar: any[] = Array.isArray(j) ? j : (j?.data ?? []);
    const peta: Record<string, Ticker> = {};
    for (const t of daftar) {
      if (!t?.symbol) continue;
      peta[t.symbol] = {
        lastPrice: Number(t.lastPrice) || 0,
        ubah24j: Number(t.priceChangePercent) || 0,
      };
    }
    tickerCache = { waktu: Date.now(), isi: peta };
    return peta;
  } catch {
    return tickerCache?.isi ?? {};
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
