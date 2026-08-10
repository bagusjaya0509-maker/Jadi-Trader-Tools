import { useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   DAFTAR KOIN, FAVORIT, DAN KOIN YANG DIHAPUS
   ════════════════════════════════════════════════════════════════════════
   Kunci localStorage-nya SAMA PERSIS dengan yang dipakai screener V2
   (`emaScreenerActiveSymbols_v1`, `emaScreenerFavorites_v1`). Itu disengaja:
   selama kedua versi masih hidup berdampingan, koin yang kamu bintangi di
   V2 langsung terlihat berbintang di V3 dan sebaliknya. Memakai kunci baru
   akan membuat keduanya punya daftar favorit sendiri-sendiri tanpa ada yang
   memberi tahu.

   Dokumen `users/{uid}` di Firestore juga menyimpan kunci yang sama, jadi
   ini tetap satu keluarga data — bukan cabang baru.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI_AKTIF = 'emaScreenerActiveSymbols_v1';
const KUNCI_FAVORIT = 'emaScreenerFavorites_v1';
const KUNCI_BLOKIR = 'emaScreenerBlockedSymbols_v1';
const ACARA = 'jt:simbol-berubah';

/** Daftar dasar, disalin dari BASE_SYMBOLS milik screener V2. */
export const SIMBOL_DASAR = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','TRXUSDT','TONUSDT','AVAXUSDT',
  'LINKUSDT','DOTUSDT','LTCUSDT','SUIUSDT','BCHUSDT','HBARUSDT',
  'ATOMUSDT','NEARUSDT','APTUSDT','ARBUSDT','OPUSDT','INJUSDT','SANDUSDT','MANAUSDT','GALAUSDT','CHZUSDT',
  'ENJUSDT','ZILUSDT','IOTAUSDT','ALGOUSDT','XLMUSDT','VETUSDT','FILUSDT','EGLDUSDT','THETAUSDT','XTZUSDT',
  'EOSUSDT','KAVAUSDT','ROSEUSDT','CELOUSDT','ANKRUSDT','DYDXUSDT','RUNEUSDT','ICPUSDT','LDOUSDT','ETCUSDT',
  'GRTUSDT','AAVEUSDT','UNIUSDT','MKRUSDT','COMPUSDT','SNXUSDT','CRVUSDT','STXUSDT','IMXUSDT','CAKEUSDT',
  '1INCHUSDT','SUSHIUSDT','YFIUSDT','BATUSDT','KSMUSDT','NEOUSDT','STORJUSDT','LRCUSDT','WOOUSDT','GMTUSDT',
  'MASKUSDT','ZECUSDT','APEUSDT','AXSUSDT','TWTUSDT','PENDLEUSDT','ARUSDT','GMXUSDT','FETUSDT','RENDERUSDT',
  'TIAUSDT','SEIUSDT','ORDIUSDT','JUPUSDT','PYTHUSDT','ARKMUSDT','ONDOUSDT','ENAUSDT','STRKUSDT','JTOUSDT',
  'NOTUSDT','ZKUSDT','ZROUSDT','ETHFIUSDT','ALTUSDT','DYMUSDT','MANTAUSDT','AEVOUSDT',
  'PEPEUSDT','SHIBUSDT','WIFUSDT','BONKUSDT','FLOKIUSDT','BOMEUSDT',
  'XAUTUSDT','XAGUSDT','XAUUSDT','PAXGUSDT',
  'AAPLUSDT','TSLAUSDT','NVDAUSDT','MSFTUSDT','GOOGLUSDT','AMZNUSDT','METAUSDT','SPYUSDT','QQQUSDT',
  'COINUSDT','MSTRUSDT',
];

/** Simbol TradFi Binance — saham & ETF, bukan kripto. Dipisah karena
 *  jam pasarnya berbeda dan kartunya diberi label sendiri. */
export const SIMBOL_TRADFI = new Set([
  'AAPLUSDT','TSLAUSDT','NVDAUSDT','MSFTUSDT','GOOGLUSDT','AMZNUSDT','METAUSDT',
  'SPYUSDT','QQQUSDT','COINUSDT','MSTRUSDT',
]);

const BIGCAP = new Set([
  'BTC','ETH','BNB','SOL','XRP','ADA','DOGE','TRX','TON','AVAX',
  'LINK','DOT','LTC','SUI','BCH','HBAR',
]);

export type Tier = 'BIG CAP' | 'LOW/MID CAP' | 'SAHAM / ETF';

export function tierSimbol(simbol: string): Tier {
  if (SIMBOL_TRADFI.has(simbol)) return 'SAHAM / ETF';
  return BIGCAP.has(simbol.replace('USDT', '')) ? 'BIG CAP' : 'LOW/MID CAP';
}

/* ── Penyimpanan ──────────────────────────────────────────────────────── */
function baca<T>(kunci: string, bawaan: T): T {
  try {
    const m = localStorage.getItem(kunci);
    return m ? (JSON.parse(m) as T) : bawaan;
  } catch {
    return bawaan;
  }
}

function tulis(kunci: string, nilai: unknown) {
  try { localStorage.setItem(kunci, JSON.stringify(nilai)); } catch { /* mode privat */ }
  window.dispatchEvent(new CustomEvent(ACARA));
}

export const bacaFavorit = () => baca<string[]>(KUNCI_FAVORIT, []);
export const bacaDiblokir = () => baca<string[]>(KUNCI_BLOKIR, []);

export function bacaAktif(): string[] {
  const tersimpan = baca<string[]>(KUNCI_AKTIF, []);
  const diblokir = new Set(bacaDiblokir());
  const dasar = tersimpan.length ? tersimpan : SIMBOL_DASAR;
  return dasar.filter((s) => !diblokir.has(s));
}

export function togglFavorit(simbol: string) {
  const f = bacaFavorit();
  tulis(KUNCI_FAVORIT, f.includes(simbol) ? f.filter((x) => x !== simbol) : [...f, simbol]);
}

/** Menghapus koin dari pemindaian. Dicatat di daftar blokir, BUKAN hanya
 *  dibuang dari daftar aktif — kalau cuma dibuang, koin itu muncul lagi
 *  begitu seseorang mencarinya manual, dan penghapusannya terasa tidak
 *  bekerja. Ini bug yang sama yang pernah diperbaiki di V2. */
export function blokirSimbol(simbol: string) {
  const b = bacaDiblokir();
  if (!b.includes(simbol)) tulis(KUNCI_BLOKIR, [...b, simbol]);
}

export function pulihkanSimbol(simbol?: string) {
  const b = bacaDiblokir();
  tulis(KUNCI_BLOKIR, simbol ? b.filter((x) => x !== simbol) : []);
}

/** Menambah koin lewat pencarian manual. Kalau sebelumnya diblokir,
 *  blokirnya ikut dicabut — orang yang mencarinya jelas ingin melihatnya. */
export function tambahSimbol(simbol: string) {
  const s = simbol.trim().toUpperCase();
  if (!s) return;
  const penuh = s.endsWith('USDT') ? s : s + 'USDT';
  pulihkanSimbol(penuh);
  const aktif = baca<string[]>(KUNCI_AKTIF, SIMBOL_DASAR);
  if (!aktif.includes(penuh)) tulis(KUNCI_AKTIF, [penuh, ...aktif]);
  else window.dispatchEvent(new CustomEvent(ACARA));
}

/** Hook yang ikut berubah saat daftar disunting dari mana pun — termasuk
 *  dari tab lain yang membuka screener V2. */
export function useSimbol() {
  const [aktif, setAktif] = useState<string[]>(bacaAktif);
  const [favorit, setFavorit] = useState<string[]>(bacaFavorit);
  const [diblokir, setDiblokir] = useState<string[]>(bacaDiblokir);

  useEffect(() => {
    const segarkan = () => {
      setAktif(bacaAktif());
      setFavorit(bacaFavorit());
      setDiblokir(bacaDiblokir());
    };
    window.addEventListener(ACARA, segarkan);
    window.addEventListener('storage', segarkan);
    return () => {
      window.removeEventListener(ACARA, segarkan);
      window.removeEventListener('storage', segarkan);
    };
  }, []);

  return { aktif, favorit, diblokir };
}
