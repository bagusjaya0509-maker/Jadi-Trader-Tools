import * as hl from '@nktkas/hyperliquid';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  dompetUtama, bacaAgen, simpanAgen, UMUR_AGEN_MS,
  type AgenTersimpan,
} from '@/lib/dex-dompet';

/* ════════════════════════════════════════════════════════════════════════
   HYPERLIQUID LANGSUNG DARI PERAMBAN
   ════════════════════════════════════════════════════════════════════════
   Tidak ada VPS di jalur ini. Peramban bicara langsung ke
   api.hyperliquid.xyz — diperiksa 3 Sep 2026, bursanya menjawab
   `access-control-allow-origin: *` untuk /info maupun /exchange, jadi tidak
   ada proxy yang perlu ditumpangi.

   Itu bukan sekadar hemat satu lompatan. Selama order tidak lewat server
   kami, tidak ada satu detik pun di mana kami memegang perintah orang lain
   — dan itulah beda antara "situs yang menampilkan bursa" dan "perantara".

   ── KEMBARAN NODE-NYA ADA, DAN HARUS DIUBAH BERSAMAAN ───────────────────
   `bulatUkuran` dan `bulatHarga` di bawah adalah SALINAN dari
   `skrip/vps/hyperliquid.js`. Duplikasi yang disengaja: yang satu CommonJS
   di VPS untuk akun pemilik, yang satu modul TS di peramban untuk akun
   pengguna, dan tidak ada satu berkas pun yang bisa dimuat keduanya.

   Enam baris, tapi enam baris yang menentukan order ditolak atau tidak.
   Kalau aturan angka Hyperliquid berubah, DUA berkas ini yang disunting,
   bukan satu. Ditulis di sini supaya yang menemukannya lebih dulu tahu ke
   mana harus menoleh.

   ── TIGA HAL YANG SELALU MENGEJUTKAN ORANG ──────────────────────────────
   1. TIDAK ADA ORDER MARKET. Yang ada limit IOC yang menyeberangi buku,
      jadi order bisa TERISI SEBAGIAN.
   2. HARGA PUNYA DUA BATAS SEKALIGUS: maksimal 5 angka penting DAN
      maksimal `6 - szDecimals` desimal. Yang lebih ketat menang. Melanggar
      salah satunya ditolak dengan pesan yang tidak menyebut angka mana.
   3. AKUN UNIFIED menaruh dananya di SPOT, jadi `accountValue` di perps
      menjawab nol untuk akun yang jelas-jelas berisi. Saldo yang bisa
      dipakai adalah jumlah keduanya.
   ════════════════════════════════════════════════════════════════════════ */

const transport = new hl.HttpTransport();
let _info: hl.InfoClient | null = null;
function info(): hl.InfoClient {
  if (!_info) _info = new hl.InfoClient({ transport });
  return _info;
}

/* ── ATURAN ANGKA ──────────────────────────────────────────────────────── */

export function bulatUkuran(n: number, szDecimals: number): number {
  const f = Math.pow(10, szDecimals);
  /* toPrecision(12) membuang debu biner sebelum dibulatkan ke bawah. Tanpa
     itu 0.1 * 3 memberi 0.30000000000000004 dan pembulatan ke bawah
     menghasilkan satu tick lebih kecil dari yang diminta. */
  return Math.floor(Number((n * f).toPrecision(12))) / f;
}

export function bulatHarga(h: number, szDecimals: number): number {
  const maksDesimal = Math.max(0, 6 - szDecimals);
  const lima = Number(h.toPrecision(5));
  return Number(lima.toFixed(maksDesimal));
}

/* ── META ──────────────────────────────────────────────────────────────── */

export interface AsetHl {
  indeks: number;
  nama: string;
  szDecimals: number;
  maksLeverage: number;
}

let _meta: AsetHl[] | null = null;
let _metaWaktu = 0;
const META_UMUR = 30 * 60 * 1000;

/** Daftar koin perps beserta aturan angkanya. Universe berubah saat ada
 *  koin baru listing, bukan tiap menit — jadi disimpan setengah jam. */
export async function daftarAset(): Promise<AsetHl[]> {
  if (_meta && Date.now() - _metaWaktu < META_UMUR) return _meta;
  const m = await info().meta();
  _meta = (m.universe ?? []).map((u, i) => ({
    indeks: i,
    nama: String(u.name),
    szDecimals: Number(u.szDecimals) || 0,
    maksLeverage: Number(u.maxLeverage) || 1,
  }));
  _metaWaktu = Date.now();
  return _meta;
}

/** null = koin itu tidak ada di Hyperliquid perps. Itu JAWABAN, bukan
 *  galat — dan membedakannya penting: "tidak ada" bisa ditampilkan,
 *  "bursanya tidak menjawab" harus dicoba lagi. */
export async function cariAset(koin: string): Promise<AsetHl | null> {
  const k = koin.trim().toUpperCase();
  const semua = await daftarAset();
  return semua.find((a) => a.nama.toUpperCase() === k) ?? null;
}

export async function hargaKini(koin: string): Promise<number> {
  const semua = await info().allMids() as Record<string, string>;
  const h = Number(semua[koin]);
  return h > 0 ? h : 0;
}

/* ── KEADAAN AKUN ──────────────────────────────────────────────────────── */

export interface PosisiDex {
  koin: string;
  arah: 'LONG' | 'SHORT';
  ukuran: number;
  nilai: number;
  entry: number;
  pnl: number;
  margin: number;
  likuidasi: number;
  leverage: number;
}

export interface KeadaanDex {
  bisaDipakai: number;
  diPerps: number;
  diSpot: number;
  nilaiAkun: number;
  posisi: PosisiDex[];
}

const ang = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };

export async function keadaanAkun(alamat: string): Promise<KeadaanDex> {
  const user = alamat as `0x${string}`;
  const [perp, spot] = await Promise.all([
    info().clearinghouseState({ user }),
    info().spotClearinghouseState({ user }),
  ]);
  const diPerps = ang(perp?.withdrawable);
  const usdc = (spot?.balances ?? []).find((b) => String(b.coin).toUpperCase() === 'USDC');
  const diSpot = ang(usdc?.total);
  return {
    bisaDipakai: diPerps + diSpot,
    diPerps,
    diSpot,
    nilaiAkun: ang(perp?.marginSummary?.accountValue) + diSpot,
    posisi: (perp?.assetPositions ?? []).map((p): PosisiDex => ({
      koin: String(p.position.coin),
      arah: ang(p.position.szi) > 0 ? 'LONG' : 'SHORT',
      ukuran: Math.abs(ang(p.position.szi)),
      nilai: ang(p.position.positionValue),
      entry: ang(p.position.entryPx),
      pnl: ang(p.position.unrealizedPnl),
      margin: ang(p.position.marginUsed),
      likuidasi: ang(p.position.liquidationPx),
      leverage: ang(p.position.leverage?.value),
    })),
  };
}

export interface OrderDex {
  oid: number;
  koin: string;
  arah: 'BUY' | 'SELL';
  harga: number;
  ukuran: number;
  jenis: string;
  reduceOnly: boolean;
  waktu: number;
}

export async function orderTerbuka(alamat: string): Promise<OrderDex[]> {
  const daftar = await info().frontendOpenOrders({ user: alamat as `0x${string}` });
  return (Array.isArray(daftar) ? daftar : []).map((o): OrderDex => ({
    oid: Number(o.oid),
    koin: String(o.coin),
    arah: o.side === 'B' ? 'BUY' : 'SELL',
    /* Trigger order menaruh harga pemicunya di `triggerPx`; `limitPx` di
       situ cuma batas kejaran sesudah terpicu. Menampilkan limitPx untuk
       sebuah stop berarti menulis angka yang bukan tempat stopnya kena. */
    harga: ang(o.triggerPx) || ang(o.limitPx),
    ukuran: ang(o.sz),
    jenis: String(o.orderType ?? 'Limit'),
    reduceOnly: o.reduceOnly === true,
    waktu: Number(o.timestamp) || 0,
  }));
}

/* ── AGENT WALLET ──────────────────────────────────────────────────────── */

/** Klien eksekusi bertanda tangan AGENT. Dipakai semua aksi trading.
 *  Dompet utama TIDAK pernah dipakai untuk order — cuma untuk menyetujui
 *  agent sekali, supaya tidak ada popup di tiap order. */
function klienAgen(agen: AgenTersimpan) {
  return new hl.ExchangeClient({
    transport,
    wallet: privateKeyToAccount(agen.kunci),
  });
}

/** Membuat agent baru DI PERAMBAN, lalu memintanya disetujui dompet utama.
 *
 *  Kuncinya dibuat di sini dan tidak pernah dikirim ke mana pun — yang
 *  berangkat ke Hyperliquid cuma ALAMAT-nya. Itu perbedaan yang menentukan:
 *  alamat boleh diketahui siapa saja, kunci tidak boleh diketahui siapa pun
 *  selain peramban ini.
 *
 *  `valid_until` dikecualikan dari batas 16 huruf nama agent oleh
 *  Hyperliquid sendiri, jadi masa berlaku bisa ditempel tanpa memotong
 *  namanya. */
export async function setujuiAgen(pemilik: string): Promise<AgenTersimpan> {
  const kunci = generatePrivateKey();
  const akun = privateKeyToAccount(kunci);
  const sampai = Date.now() + UMUR_AGEN_MS;
  const nama = `jaditrader valid_until ${sampai}`;

  const ex = new hl.ExchangeClient({ transport, wallet: dompetUtama(pemilik) });
  await ex.approveAgent({ agentAddress: akun.address, agentName: nama });

  const simpan: AgenTersimpan = {
    kunci, alamat: akun.address, nama, sampai, dibuat: Date.now(),
  };
  simpanAgen(pemilik, simpan);
  return simpan;
}

/** Melempar dengan kalimat yang bisa dibaca orang, bukan `undefined` yang
 *  meledak tiga baris kemudian di tempat yang tidak menjelaskan apa pun. */
function agenAtauGalat(pemilik: string): AgenTersimpan {
  const a = bacaAgen(pemilik);
  if (!a) throw new Error('Belum ada agent wallet di peramban ini. Tekan "Aktifkan trading" dulu.');
  if (Date.now() > a.sampai) throw new Error('Agent wallet sudah kedaluwarsa. Aktifkan ulang.');
  return a;
}

/* ── ORDER ─────────────────────────────────────────────────────────────── */

/** Ruang kejaran untuk IOC yang menyeberangi buku. Bukan slippage yang
 *  diterima — cuma batas seberapa jauh order boleh mengejar sebelum
 *  sisanya dibatalkan. */
const SELISIH_PASAR = 0.03;

export interface HasilOrderDex {
  /** Terisi kalau ada yang perlu dikatakan tentang SL/TP-nya.
   *  null / kosong = tidak ada yang perlu dikhawatirkan. */
  stopKabar?: string | null;
  koin: string;
  arah: 'BUY' | 'SELL';
  ukuran: number;
  hargaKirim: number;
  leverage: number;
  terisi: { ukuran: number; harga: number } | null;
  menggantung: number | null;
}

export interface MintaOrderDex {
  pemilik: string;
  koin: string;
  arah: 'BUY' | 'SELL';
  /** MARGIN dalam USD. Nilai posisinya = modal x leverage — konvensi yang
   *  sama dengan panel order pemilik, supaya satu angka di layar tidak
   *  berarti dua hal berbeda di dua halaman. */
  modal: number;
  leverage: number;
  jenis: 'MARKET' | 'LIMIT';
  /** Wajib untuk LIMIT, diabaikan untuk MARKET. */
  hargaLimit?: number;
  /** Harga pemicu. 0 / kosong = tidak dipasang. */
  sl?: number;
  tp?: number;
}

/** Satu trigger reduce-only. Bentuknya disalin dari `orderTrigger` di
 *  skrip/vps/hyperliquid.js — kembaran yang sudah terbukti di jalur pemilik.
 *
 *  `p` ditaruh DI BALIK pemicu, bukan sama dengan pemicunya: `isMarket` saja
 *  tidak cukup, `p` tetap jadi batas seberapa jauh order boleh mengejar
 *  sesudah terpicu. `p` yang sama persis bisa tidak terisi saat harga
 *  melompat melewatinya — persis keadaan saat stop paling dibutuhkan. */
function trigger(aset: AsetHl, beliMasuk: boolean, pemicu: number, ukuran: number,
                 jenis: 'sl' | 'tp') {
  const tutupBeli = !beliMasuk;
  const px = bulatHarga(pemicu, aset.szDecimals);
  const kejar = bulatHarga(pemicu * (tutupBeli ? 1 + SELISIH_PASAR : 1 - SELISIH_PASAR),
                           aset.szDecimals);
  return {
    a: aset.indeks, b: tutupBeli, p: String(kejar), s: String(ukuran), r: true,
    t: { trigger: { isMarket: true, triggerPx: String(px), tpsl: jenis } },
  };
}

/** Hyperliquid MENERIMA stop di sisi yang salah — ia langsung terpicu dan
 *  menutup posisi yang baru saja dibuka dalam hitungan detik, dan yang
 *  terbaca orang cuma "posisi saya hilang sendiri". Penolakannya harus kita
 *  sendiri yang melakukan. */
function periksaSisi(beli: boolean, entry: number, sl: number, tp: number) {
  if (sl > 0) {
    if (beli && sl >= entry) throw new Error(`SL ${sl} harus DI BAWAH entry ${entry} untuk BUY.`);
    if (!beli && sl <= entry) throw new Error(`SL ${sl} harus DI ATAS entry ${entry} untuk SELL.`);
  }
  if (tp > 0) {
    if (beli && tp <= entry) throw new Error(`TP ${tp} harus DI ATAS entry ${entry} untuk BUY.`);
    if (!beli && tp >= entry) throw new Error(`TP ${tp} harus DI BAWAH entry ${entry} untuk SELL.`);
  }
}

export async function kirimOrderDex(m: MintaOrderDex): Promise<HasilOrderDex> {
  const agen = agenAtauGalat(m.pemilik);
  if (!(m.modal > 0)) throw new Error('Modal wajib lebih dari nol.');

  const aset = await cariAset(m.koin);
  if (!aset) throw new Error(`${m.koin} tidak ada di Hyperliquid perps.`);

  const lev = Math.max(1, Math.min(aset.maksLeverage, Math.round(m.leverage) || 1));
  const pasar = await hargaKini(aset.nama);
  if (!(pasar > 0)) throw new Error(`Harga ${aset.nama} tidak terbaca dari bursa.`);

  const beli = m.arah === 'BUY';
  /* Harga acuan UKURAN adalah harga eksekusinya sendiri, bukan harga pasar.
     Untuk limit yang jauh dari pasar, memakai harga pasar berarti ukuran
     posisi meleset sebesar jarak itu — dan yang meleset adalah uang. */
  const hargaAcuan = m.jenis === 'LIMIT' ? Number(m.hargaLimit) : pasar;
  if (!(hargaAcuan > 0)) throw new Error('Harga limit wajib diisi.');

  const ukuran = bulatUkuran((m.modal * lev) / hargaAcuan, aset.szDecimals);
  if (!(ukuran > 0)) {
    throw new Error(`Modal $${m.modal} terlalu kecil untuk ${aset.nama} `
                  + `(harga ${hargaAcuan}) — ukurannya membulat jadi nol.`);
  }

  const hargaKirim = m.jenis === 'LIMIT'
    ? bulatHarga(hargaAcuan, aset.szDecimals)
    : bulatHarga(pasar * (beli ? 1 + SELISIH_PASAR : 1 - SELISIH_PASAR), aset.szDecimals);

  periksaSisi(beli, hargaAcuan, Number(m.sl) || 0, Number(m.tp) || 0);

  const ex = klienAgen(agen);

  /* Leverage disetel DULU dan terpisah. Digabung ke order, kegagalannya
     terbaca sebagai kegagalan order — dan itu menuntun orang memeriksa hal
     yang salah. Isolated: rugi satu koin tidak menyeret margin koin lain. */
  await ex.updateLeverage({ asset: aset.indeks, isCross: false, leverage: lev });

  const hasil = await ex.order({
    orders: [{
      a: aset.indeks,
      b: beli,
      p: String(hargaKirim),
      s: String(ukuran),
      r: false,
      t: { limit: { tif: m.jenis === 'LIMIT' ? 'Gtc' : 'Ioc' } },
    }],
    grouping: 'na',
  });

  const st = hasil?.response?.data?.statuses?.[0] as
    | { error?: string; filled?: { totalSz: string; avgPx: string }; resting?: { oid: number } }
    | undefined;
  if (st?.error) throw new Error(st.error);

  /* ── SL/TP DISIZING DARI FILL YANG SUNGGUHAN ────────────────────────
     Bukan dari `ukuran` yang diminta. Order di sini limit IOC yang
     menyeberangi buku, jadi ia BISA TERISI SEBAGIAN — dan stop seukuran
     permintaan pada posisi yang cuma terisi 60% ditolak bursa, lalu yang
     terbaca di layar cuma "gagal" tanpa sebab.

     Untuk LIMIT yang belum terisi, stopnya TIDAK dipasang: Hyperliquid
     menolak reduce-only tanpa posisi. Panelnya mengatakan itu apa adanya
     alih-alih diam — stop yang dikira terpasang padahal tidak adalah
     kebohongan yang baru ketahuan saat harganya lewat. */
  const slN = Number(m.sl) || 0, tpN = Number(m.tp) || 0;
  const terisiQty = st?.filled ? Number(st.filled.totalSz) : 0;
  let stopKabar: string | null = null;
  if ((slN > 0 || tpN > 0) && terisiQty > 0) {
    const pesan = [];
    if (slN > 0) pesan.push(trigger(aset, beli, slN, terisiQty, 'sl'));
    if (tpN > 0) pesan.push(trigger(aset, beli, tpN, terisiQty, 'tp'));
    try {
      const h2 = await ex.order({ orders: pesan, grouping: 'na' });
      const daftar = (h2?.response?.data?.statuses ?? []) as unknown[];
      if (daftar.some((x) => typeof x === 'object' && x !== null && 'error' in x)) {
        stopKabar = 'Posisi terbuka, tapi SL/TP GAGAL dipasang — pasang manual sekarang.';
      }
    } catch (e) {
      stopKabar = 'Posisi terbuka, tapi SL/TP GAGAL dipasang ('
                + (e instanceof Error ? e.message : '?') + ') — pasang manual sekarang.';
    }
  } else if ((slN > 0 || tpN > 0) && st?.resting) {
    stopKabar = 'Order menggantung — SL/TP baru bisa dipasang sesudah ia terisi.';
  }

  return {
    stopKabar,
    koin: aset.nama,
    arah: m.arah,
    ukuran,
    hargaKirim,
    leverage: lev,
    terisi: st?.filled
      ? { ukuran: Number(st.filled.totalSz), harga: Number(st.filled.avgPx) }
      : null,
    menggantung: st?.resting ? Number(st.resting.oid) : null,
  };
}

/** Menutup SELURUH posisi sebuah koin dengan IOC reduce-only berlawanan.
 *
 *  Ukurannya dibaca ulang dari bursa tepat sebelum dikirim, bukan dari
 *  angka yang sedang tampil di layar: layar bisa berumur beberapa detik,
 *  dan order penutup yang lebih besar dari posisinya ditolak — persis pada
 *  saat orang paling ingin ia berhasil. */
export async function tutupPosisiDex(pemilik: string, koin: string): Promise<HasilOrderDex> {
  const agen = agenAtauGalat(pemilik);
  const aset = await cariAset(koin);
  if (!aset) throw new Error(`${koin} tidak ada di Hyperliquid perps.`);

  const keadaan = await keadaanAkun(pemilik);
  const pos = keadaan.posisi.find((p) => p.koin.toUpperCase() === aset.nama.toUpperCase());
  if (!pos || !(pos.ukuran > 0)) throw new Error(`Tidak ada posisi ${aset.nama} yang terbuka.`);

  const pasar = await hargaKini(aset.nama);
  if (!(pasar > 0)) throw new Error(`Harga ${aset.nama} tidak terbaca dari bursa.`);

  const beliTutup = pos.arah === 'SHORT';
  const hargaKirim = bulatHarga(
    pasar * (beliTutup ? 1 + SELISIH_PASAR : 1 - SELISIH_PASAR), aset.szDecimals);

  const ex = klienAgen(agen);
  const hasil = await ex.order({
    orders: [{
      a: aset.indeks,
      b: beliTutup,
      p: String(hargaKirim),
      s: String(pos.ukuran),
      r: true,
      t: { limit: { tif: 'Ioc' } },
    }],
    grouping: 'na',
  });

  const st = hasil?.response?.data?.statuses?.[0] as
    | { error?: string; filled?: { totalSz: string; avgPx: string } }
    | undefined;
  if (st?.error) throw new Error(st.error);

  return {
    koin: aset.nama,
    arah: beliTutup ? 'BUY' : 'SELL',
    ukuran: pos.ukuran,
    hargaKirim,
    leverage: pos.leverage,
    terisi: st?.filled
      ? { ukuran: Number(st.filled.totalSz), harga: Number(st.filled.avgPx) }
      : null,
    menggantung: null,
  };
}

export async function batalOrderDex(pemilik: string, koin: string, oid: number): Promise<void> {
  const agen = agenAtauGalat(pemilik);
  const aset = await cariAset(koin);
  if (!aset) throw new Error(`${koin} tidak ada di Hyperliquid perps.`);
  const ex = klienAgen(agen);
  const hasil = await ex.cancel({ cancels: [{ a: aset.indeks, o: oid }] });
  const st = hasil?.response?.data?.statuses?.[0];
  if (typeof st === 'object' && st !== null && 'error' in st) {
    throw new Error(String((st as { error: string }).error));
  }
}
