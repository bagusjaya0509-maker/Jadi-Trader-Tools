/* ══════════════════════════════════════════════════════════════════════════
   hyperliquid.js — eksekusi order di Hyperliquid untuk salin dompet
   ══════════════════════════════════════════════════════════════════════════
   Dompet yang dipantau HIDUP di Hyperliquid. Menyalinnya di sini berarti
   bursa yang sama, instrumen yang sama, dan tidak ada penerjemahan nama —
   salinan yang paling setia yang bisa dibuat. Binance tetap ada sebagai
   jalur pilihan; yang memilih penggunanya, per dompet.

   ── TIGA HAL YANG SUDAH MEMAKAN WAKTU, DITULIS SUPAYA TIDAK TERULANG ───

   1. AKUN UNIFIED: SALDONYA TIDAK ADA DI `accountValue`.
      `clearinghouseState.marginSummary.accountValue` untuk sub-account ini
      menjawab **0** padahal saldonya USDC 300. Di akun unified, dananya
      tercatat di `spotClearinghouseState`. Memakai accountValue sebagai
      pemeriksa margin berarti SETIAP order ditolak sendiri sebelum
      berangkat — dan gejalanya terlihat seperti "tidak terjadi apa-apa",
      bukan seperti galat.

   2. AGENT DISETUJUI DI AKUN UTAMA, BUKAN DI SUB-ACCOUNT.
      `extraAgents` pada sub-account menjawab `[]`, dan itu NORMAL —
      bukan tanda otorisasinya gagal. Eksekusi ke sub-account dilakukan
      dengan menandatangani memakai kunci agent lalu mengoper
      `{ vaultAddress: <sub-account> }`. Sudah dibuktikan lewat
      `updateLeverage` yang menjawab `{status:'ok'}`.

   3. HYPERLIQUID TIDAK PUNYA ORDER "MARKET".
      Yang ada limit IOC. Order pasar ditiru dengan menaruh harga yang
      MENYEBERANGI buku — di atas ask untuk beli, di bawah bid untuk jual.
      Selisihnya (`SELISIH_PASAR`) bukan slippage yang kita terima, cuma
      batas seberapa jauh order boleh mengejar; yang tidak terisi dalam
      seketika langsung batal, itulah arti IOC.

   ── ATURAN ANGKA HYPERLIQUID ───────────────────────────────────────────
   Ukuran dibulatkan ke `szDecimals` milik koinnya. Harga punya dua batas
   sekaligus: maksimal 5 angka penting, DAN maksimal `6 - szDecimals`
   desimal. Melanggar salah satunya membuat order ditolak dengan pesan
   yang tidak menyebut angka mana yang salah.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

require('dotenv').config();

const AKUN = (process.env.HL_AKUN || '').trim();
const KUNCI = (process.env.HL_AGENT_KEY || '').trim();
/* Sengaja `=== '1'`, bukan `!== '0'` — alasan yang sama dengan
   WALLET_OTO_BUKA: sesuatu yang bisa memasukkan uang ke posisi baru tidak
   boleh menyala hanya karena tidak ada yang menuliskan angka nol. */
const HL_AKTIF = process.env.HL_AKTIF === '1';
const HL_MAKS_USD = Math.max(1, Number(process.env.HL_MAKS_USD || 60));
const HL_MAKS_LEV = Math.max(1, Number(process.env.HL_MAKS_LEV || 3));
const SELISIH_PASAR = 0.03;   // 3% ruang mengejar buku untuk IOC

let _hl = null;
function pustaka() {
  if (!_hl) {
    const hl = require('@nktkas/hyperliquid');
    const { Wallet } = require('ethers');
    const transport = new hl.HttpTransport();
    _hl = {
      info: new hl.InfoClient({ transport }),
      /* Klien eksekusi dibuat hanya kalau kuncinya ada. Membuatnya dengan
         kunci kosong melempar di tempat yang jauh dari sebabnya. */
      ex: KUNCI ? new hl.ExchangeClient({ wallet: new Wallet(KUNCI), transport }) : null,
    };
  }
  return _hl;
}

function siap() {
  return !!(HL_AKTIF && AKUN && KUNCI);
}

/* Daftar koin + aturan angkanya. Diingat: universe berubah saat ada koin
   baru listing, bukan tiap menit. */
let _meta = null, _metaWaktu = 0;
const META_UMUR = 30 * 60 * 1000;
async function meta() {
  if (_meta && Date.now() - _metaWaktu < META_UMUR) return _meta;
  _meta = await pustaka().info.meta();
  _metaWaktu = Date.now();
  return _meta;
}

/** Indeks aset + szDecimals untuk sebuah koin, atau null kalau koin itu
 *  tidak diperdagangkan di Hyperliquid perps. null = jawaban, bukan galat. */
async function asetHl(koin) {
  const k = String(koin || '').trim();
  const m = await meta();
  const i = (m.universe || []).findIndex(
    (u) => String(u.name).toUpperCase() === k.toUpperCase());
  if (i < 0) return null;
  return { indeks: i, szDecimals: Number(m.universe[i].szDecimals) || 0,
           maxLeverage: Number(m.universe[i].maxLeverage) || 1, nama: m.universe[i].name };
}

/** Saldo yang benar-benar bisa dipakai membuka posisi, dalam USD.
 *  Menjumlahkan DUA sumber karena akun unified menaruh dananya di spot
 *  sementara akun biasa menaruhnya di perps — lihat catatan (1) di atas. */
async function saldoHl() {
  const { info } = pustaka();
  const [perp, spot] = await Promise.all([
    info.clearinghouseState({ user: AKUN }),
    info.spotClearinghouseState({ user: AKUN }),
  ]);
  const diPerps = Number(perp?.withdrawable) || 0;
  const usdc = (spot?.balances || []).find((b) => String(b.coin).toUpperCase() === 'USDC');
  const diSpot = Number(usdc?.total) || 0;
  return {
    bisaDipakai: diPerps + diSpot,
    diPerps, diSpot,
    /* Lima medan pertama sudah lama dipakai; sisanya ditambahkan untuk
       panel Posisi Copy, yang harus bisa menjawab "uangku terpakai berapa
       dan seberapa jauh dari likuidasi" -- dua pertanyaan yang tidak bisa
       dijawab dari nilai posisi dan PnL saja.

       Semuanya sudah ada di jawaban clearinghouseState; yang kurang selama
       ini cuma pengambilannya. Tidak ada panggilan tambahan ke Hyperliquid. */
    posisi: (perp?.assetPositions || []).map((p) => ({
      koin: p.position.coin,
      arah: Number(p.position.szi) > 0 ? 'LONG' : 'SHORT',
      ukuran: Math.abs(Number(p.position.szi)),
      nilai: Number(p.position.positionValue) || 0,
      pnl: Number(p.position.unrealizedPnl) || 0,
      entry: Number(p.position.entryPx) || 0,
      margin: Number(p.position.marginUsed) || 0,
      likuidasi: Number(p.position.liquidationPx) || 0,
      leverage: Number(p.position.leverage && p.position.leverage.value) || 0,
    })),
  };
}

/** Harga tengah sebuah koin. */
async function hargaHl(koin) {
  const semua = await pustaka().info.allMids();
  const h = Number(semua[koin]);
  return h > 0 ? h : 0;
}

/* ── PEMBULATAN ANGKA SESUAI ATURAN HYPERLIQUID ───────────────────────── */

function bulatUkuran(n, szDecimals) {
  const f = Math.pow(10, szDecimals);
  /* toPrecision(12) membuang debu biner sebelum dibulatkan ke bawah —
     alasan yang sama dengan keStep di jalur Binance. */
  return Math.floor(Number((n * f).toPrecision(12))) / f;
}

/** Harga yang memenuhi KEDUA batas Hyperliquid sekaligus: maksimal 5 angka
 *  penting dan maksimal `6 - szDecimals` desimal. Yang lebih ketat menang. */
function bulatHarga(h, szDecimals) {
  const maksDesimal = Math.max(0, 6 - szDecimals);
  const lima = Number(h.toPrecision(5));
  return Number(lima.toFixed(maksDesimal));
}

/** Buka posisi. `usd` MARGIN, nilai posisinya usd x leverage — konvensi
 *  yang sama dengan jalur Binance supaya satu angka di layar tidak berarti
 *  dua hal berbeda tergantung bursanya. */
async function bukaHl({ koin, arah, usd, leverage = 1 }) {
  if (!siap()) throw new Error('Hyperliquid belum aktif (HL_AKTIF/HL_AKUN/HL_AGENT_KEY)');

  const nilaiUsd = Number(usd);
  if (!(nilaiUsd > 0)) throw new Error('usd wajib angka lebih dari nol');
  if (nilaiUsd > HL_MAKS_USD) {
    throw new Error(`usd ${nilaiUsd} melewati batas HL_MAKS_USD (${HL_MAKS_USD})`);
  }

  const aset = await asetHl(koin);
  if (!aset) throw new Error(`${koin} tidak ada di Hyperliquid perps`);

  const lev = Math.max(1, Math.min(HL_MAKS_LEV, aset.maxLeverage, Math.round(leverage) || 1));
  const harga = await hargaHl(aset.nama);
  if (!(harga > 0)) throw new Error(`Harga ${koin} tidak terbaca`);

  const saldo = await saldoHl();
  if (saldo.bisaDipakai < nilaiUsd) {
    throw new Error(`Saldo $${saldo.bisaDipakai.toFixed(2)} kurang dari ukuran order $${nilaiUsd}`);
  }

  const ukuran = bulatUkuran((nilaiUsd * lev) / harga, aset.szDecimals);
  if (!(ukuran > 0)) {
    throw new Error(`Ukuran $${nilaiUsd} terlalu kecil untuk ${koin} `
                  + `(harga ${harga}, ${aset.szDecimals} desimal) — membulat jadi nol`);
  }

  const beli = arah === 'BUY' || arah === 'LONG';
  const hargaKirim = bulatHarga(harga * (beli ? 1 + SELISIH_PASAR : 1 - SELISIH_PASAR),
                                aset.szDecimals);

  /* Leverage disetel DULU dan terpisah. Kalau digabung ke order, kegagalan
     menyetel leverage terbaca sebagai kegagalan order — dan yang kedua
     menuntun orang memeriksa hal yang salah. Isolated: kerugian satu koin
     tidak menyeret margin koin lain. */
  const { ex } = pustaka();
  await ex.updateLeverage({ asset: aset.indeks, isCross: false, leverage: lev },
                          { vaultAddress: AKUN });

  const hasil = await ex.order({
    orders: [{
      a: aset.indeks,
      b: beli,
      p: String(hargaKirim),
      s: String(ukuran),
      r: false,
      /* IOC, bukan GTC: yang tidak terisi seketika DIBATALKAN. Order
         menggantung di buku bukan tiruan dari dompet yang sudah masuk
         pasar — ia janji yang mungkin terisi berjam-jam kemudian di
         keadaan yang sudah lain. */
      t: { limit: { tif: 'Ioc' } },
    }],
    grouping: 'na',
  }, { vaultAddress: AKUN });

  const st = hasil?.response?.data?.statuses?.[0];
  if (st?.error) throw new Error(st.error);
  const isi = st?.filled;
  return {
    ok: true, koin: aset.nama, arah: beli ? 'BUY' : 'SELL',
    ukuran, hargaKirim, leverage: lev,
    terisi: isi ? { ukuran: Number(isi.totalSz), harga: Number(isi.avgPx) } : null,
    mentah: st,
  };
}

/** Tutup posisi sepenuhnya. reduceOnly — bursa menolak kalau ia justru
 *  akan menambah, pagar yang tidak bergantung pada benarnya kode di sini. */
async function tutupHl(koin) {
  if (!siap()) throw new Error('Hyperliquid belum aktif');
  const aset = await asetHl(koin);
  if (!aset) throw new Error(`${koin} tidak ada di Hyperliquid perps`);

  const saldo = await saldoHl();
  const pos = saldo.posisi.find((p) => String(p.koin).toUpperCase() === aset.nama.toUpperCase());
  if (!pos) return { ok: true, kosong: true };

  const harga = await hargaHl(aset.nama);
  const beli = pos.arah === 'SHORT';
  const hargaKirim = bulatHarga(harga * (beli ? 1 + SELISIH_PASAR : 1 - SELISIH_PASAR),
                                aset.szDecimals);

  const hasil = await pustaka().ex.order({
    orders: [{
      a: aset.indeks, b: beli, p: String(hargaKirim),
      s: String(bulatUkuran(pos.ukuran, aset.szDecimals)),
      r: true, t: { limit: { tif: 'Ioc' } },
    }],
    grouping: 'na',
  }, { vaultAddress: AKUN });

  const st = hasil?.response?.data?.statuses?.[0];
  if (st?.error) throw new Error(st.error);
  return { ok: true, koin: aset.nama, ditutup: pos.ukuran, terisi: st?.filled || null };
}

module.exports = {
  siap, asetHl, saldoHl, hargaHl, bukaHl, tutupHl,
  bulatUkuran, bulatHarga,
  batas: { HL_MAKS_USD, HL_MAKS_LEV },
};
