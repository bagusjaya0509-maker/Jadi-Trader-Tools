/* ═══════════════════════════════════════════════════════════════════════════
   BELI KOIN DI DEX — tukar koin gas jaringannya dengan token yang dipantau
   ═══════════════════════════════════════════════════════════════════════════

   Ini BUKAN saudara dari `dex-hl.ts`, dan perbedaannya harus jelas sebelum
   satu barispun dibaca:

     dex-hl.ts   perpetual di Hyperliquid. Ada leverage, ada SL/TP, ada
                 likuidasi, daftar koinnya tertutup (233 koin).
     dex-swap.ts tukar-menukar token di DEX. TIDAK ada leverage, TIDAK ada
                 SL/TP, TIDAK ada likuidasi. Token apa pun yang punya kolam
                 bisa dibeli — termasuk yang baru lahir kemarin.

   Keduanya sengaja tidak digabung ke satu panel. Panel yang kadang punya
   SL/TP dan kadang tidak akan salah dibaca tepat pada saat harganya sedang
   bergerak, dan salah baca di saat itu berharga uang.

   ── SATU PEMBATASAN YANG DISENGAJA: BELI SAJA, PAKAI KOIN GAS ─────────────
   Yang dibayarkan selalu koin gas jaringannya (SOL di Solana, ETH di
   Ethereum/Base/Arbitrum, BNB di BNB Chain, POL di Polygon). Bukan karena
   USDC tidak bisa — melainkan karena membayar dengan token ERC-20 menuntut
   `approve` lebih dulu: tanda tangan KEDUA, ke alamat kontrak yang berbeda,
   dengan jumlah yang harus dipilih (tepat sekian, atau tak terbatas).

   Tanda tangan kedua yang isinya tidak dimengerti adalah tempat orang
   kehilangan seluruh saldonya, bukan sebagian. Selama panel ini masih baru,
   satu tanda tangan untuk satu perbuatan adalah batas yang layak dipegang.

   Menjual kembali juga belum ada, dan sebabnya sama persis: menjual token
   berarti `approve` token itu lebih dulu.

   ── KENAPA LANGSUNG DARI PERAMBAN, BUKAN LEWAT VPS ───────────────────────
   Diperiksa 3 Sep 2026: li.quest dan lite-api.jup.ag keduanya mengirim
   `access-control-allow-origin: *` dan tidak minta kunci API. Jadi tidak
   ada yang perlu dititipkan ke VPS — dan lebih penting lagi, tidak ada
   transaksi yang perlu lewat mesin kita. Yang menandatangani dompet
   penggunanya sendiri; kita cuma menyiapkan bahan yang ia tanda tangani.
   ═══════════════════════════════════════════════════════════════════════ */

import { penyedia } from './dex-dompet';

/* ── Peta rantai ────────────────────────────────────────────────────────── */

export interface RantaiEvm {
  id: number;
  nama: string;
  gas: string;
  /** Dipakai `wallet_addEthereumChain` kalau dompetnya belum kenal rantainya. */
  rpc: string;
  jelajah: string;
}

/* Kuncinya SENGAJA sama dengan kunci jaringan di `listing-vps.js`, jadi baris
   Coin Hunter bisa dioper apa adanya tanpa tabel penerjemah di tengah. */
export const RANTAI: Record<string, RantaiEvm> = {
  eth:         { id: 1,     nama: 'Ethereum',  gas: 'ETH', rpc: 'https://eth.llamarpc.com',      jelajah: 'https://etherscan.io/tx/' },
  bsc:         { id: 56,    nama: 'BNB Chain', gas: 'BNB', rpc: 'https://bsc-dataseed.binance.org', jelajah: 'https://bscscan.com/tx/' },
  base:        { id: 8453,  nama: 'Base',      gas: 'ETH', rpc: 'https://mainnet.base.org',      jelajah: 'https://basescan.org/tx/' },
  arbitrum:    { id: 42161, nama: 'Arbitrum',  gas: 'ETH', rpc: 'https://arb1.arbitrum.io/rpc',  jelajah: 'https://arbiscan.io/tx/' },
  polygon_pos: { id: 137,   nama: 'Polygon',   gas: 'POL', rpc: 'https://polygon-rpc.com',       jelajah: 'https://polygonscan.com/tx/' },
};

/** Alamat yang dipakai LI.FI untuk "koin gas jaringan ini", bukan token. */
const GAS_EVM = '0x0000000000000000000000000000000000000000';
/** Wrapped SOL. Jupiter memakai mint ini untuk SOL asli; `wrapAndUnwrapSol`
 *  yang mengurus bungkus-membungkusnya, jadi penggunanya tetap membayar SOL. */
const MINT_SOL = 'So11111111111111111111111111111111111111112';
const JELAJAH_SOL = 'https://solscan.io/tx/';

export function jaringanDidukung(kunci: string): boolean {
  return kunci === 'solana' || !!RANTAI[kunci];
}

export function koinGas(kunci: string): string {
  return kunci === 'solana' ? 'SOL' : RANTAI[kunci]?.gas || '';
}

export function tautanTx(kunci: string, tx: string): string {
  return (kunci === 'solana' ? JELAJAH_SOL : RANTAI[kunci]?.jelajah || '') + tx;
}

/* ── Bentuk kutipan ─────────────────────────────────────────────────────── */

export interface Kutipan {
  pola: 'evm' | 'sol';
  jaringan: string;
  /** Yang dibayar, dalam koin gas — sudah dalam satuan manusia. */
  bayarGas: number;
  bayarUsd: number | null;
  /** Yang diterima, dalam satuan manusia. */
  terima: number;
  /** Paling sedikit yang diterima kalau harga bergerak sejauh slippage. */
  terimaMin: number;
  simbol: string;
  desimal: number;
  /** Persen, sudah dikali 100. `null` kalau sumbernya tidak menyebutkan. */
  dampak: number | null;
  /** Nama bursa/agregator yang benar-benar mengeksekusi. */
  rute: string;
  /** Bahan mentah untuk `beli()`. Jangan disunting di komponen. */
  bahan: unknown;
  /** Diisi hanya untuk EVM: rantai yang harus aktif di dompet. */
  rantaiId?: number;
}

/** Slippage bawaan 1,5%. Koin yang baru listing kolamnya dangkal dan
 *  harganya melompat antara kutipan dan tanda tangan; 0,5% seperti pasangan
 *  besar akan gagal terus dan kegagalan berulang mengajari orang menaikkan
 *  slippage sampai angka yang berbahaya. 1,5% cukup longgar untuk lolos,
 *  cukup ketat untuk tidak jadi lubang. */
export const SLIP_BAWAAN = 150; // basis poin

/* ── Kutipan: EVM lewat LI.FI ───────────────────────────────────────────── */

async function kutipEvm(
  jaringan: string, alamatToken: string, dompet: string, bayar: number, slipBps: number,
): Promise<Kutipan> {
  const r = RANTAI[jaringan];
  if (!r) throw new Error(`Jaringan ${jaringan} belum didukung panel beli.`);

  /* 18 desimal untuk SEMUA koin gas EVM — benar untuk kelima rantai di
     tabel di atas, termasuk POL di Polygon. Ditulis sebagai tetapan, bukan
     dibaca dari mana-mana, supaya kalau ada rantai baru dengan desimal lain
     ia gagal di sini dan bukan diam-diam salah jumlah. */
  const wei = BigInt(Math.round(bayar * 1e18));
  if (wei <= 0n) throw new Error('Jumlahnya nol.');

  const u = new URL('https://li.quest/v1/quote');
  u.searchParams.set('fromChain', String(r.id));
  u.searchParams.set('toChain', String(r.id));
  u.searchParams.set('fromToken', GAS_EVM);
  u.searchParams.set('toToken', alamatToken);
  u.searchParams.set('fromAmount', wei.toString());
  u.searchParams.set('fromAddress', dompet);
  u.searchParams.set('slippage', String(slipBps / 10000));

  const j = await ambilJson(u.toString());
  const aksi = j.action || {};
  const kira = j.estimate || {};
  const tok = aksi.toToken || {};
  const des = Number(tok.decimals ?? 18);

  return {
    pola: 'evm',
    jaringan,
    bayarGas: bayar,
    bayarUsd: angkaAtauNull(kira.fromAmountUSD),
    terima: Number(kira.toAmount || 0) / 10 ** des,
    terimaMin: Number(kira.toAmountMin || 0) / 10 ** des,
    simbol: tok.symbol || '?',
    desimal: des,
    /* LI.FI tidak selalu menyebutkan dampak harga; menuliskan 0 saat ia
       diam berarti berbohong ke arah yang menenangkan. */
    dampak: null,
    rute: j.toolDetails?.name || j.tool || 'DEX',
    bahan: j.transactionRequest,
    rantaiId: r.id,
  };
}

/* ── Kutipan: Solana lewat Jupiter ──────────────────────────────────────── */

async function kutipSol(
  alamatToken: string, bayar: number, slipBps: number,
): Promise<Kutipan> {
  const lamport = BigInt(Math.round(bayar * 1e9));
  if (lamport <= 0n) throw new Error('Jumlahnya nol.');

  const u = new URL('https://lite-api.jup.ag/swap/v1/quote');
  u.searchParams.set('inputMint', MINT_SOL);
  u.searchParams.set('outputMint', alamatToken);
  u.searchParams.set('amount', lamport.toString());
  u.searchParams.set('slippageBps', String(slipBps));

  const q = await ambilJson(u.toString());

  /* Desimal token TIDAK ada di jawaban kutipan, dan tanpa desimal angka
     "terima" cuma bilangan bulat mentah yang tidak berarti apa-apa. Dua
     permintaan, bukan satu — tapi keduanya sekaligus, jadi tidak menambah
     waktu tunggu. */
  const meta = await metaSol(alamatToken);
  const des = meta?.decimals ?? 0;

  return {
    pola: 'sol',
    jaringan: 'solana',
    bayarGas: bayar,
    bayarUsd: meta?.hargaSol != null ? bayar * meta.hargaSol : null,
    terima: Number(q.outAmount || 0) / 10 ** des,
    terimaMin: Number(q.otherAmountThreshold || 0) / 10 ** des,
    simbol: meta?.symbol || '?',
    desimal: des,
    dampak: q.priceImpactPct != null ? Number(q.priceImpactPct) * 100 : null,
    rute: (q.routePlan || []).map((p: any) => p?.swapInfo?.label).filter(Boolean).join(' → ') || 'Jupiter',
    bahan: q,
  };
}

interface MetaSol { symbol: string; decimals: number; hargaSol: number | null }

async function metaSol(mint: string): Promise<MetaSol | null> {
  try {
    const [tok, sol] = await Promise.all([
      ambilJson(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`),
      ambilJson(`https://lite-api.jup.ag/tokens/v2/search?query=${MINT_SOL}`),
    ]);
    const t = Array.isArray(tok) ? tok.find((x: any) => x?.id === mint) || tok[0] : tok;
    const s = Array.isArray(sol) ? sol.find((x: any) => x?.id === MINT_SOL) || sol[0] : sol;
    if (!t) return null;
    return { symbol: t.symbol || '?', decimals: Number(t.decimals ?? 0), hargaSol: angkaAtauNull(s?.usdPrice) };
  } catch { return null; }
}

/** Satu pintu kutipan. */
export async function kutip(v: {
  jaringan: string; alamat: string; dompet: string; bayar: number; slipBps?: number;
}): Promise<Kutipan> {
  const slip = v.slipBps ?? SLIP_BAWAAN;
  return v.jaringan === 'solana'
    ? kutipSol(v.alamat, v.bayar, slip)
    : kutipEvm(v.jaringan, v.alamat, v.dompet, v.bayar, slip);
}

/* ── Eksekusi ───────────────────────────────────────────────────────────── */

/** Mengembalikan hash/signature transaksi. Melempar kalau ditolak/gagal. */
export async function beli(k: Kutipan, dompet: string): Promise<string> {
  return k.pola === 'sol' ? beliSol(k) : beliEvm(k, dompet);
}

async function beliEvm(k: Kutipan, dompet: string): Promise<string> {
  const p = penyedia();
  if (!p) throw new Error('Dompet peramban tidak ditemukan.');
  const tx = k.bahan as Record<string, string> | null;
  if (!tx?.to || !tx?.data) throw new Error('Kutipan tidak memuat transaksi — coba ambil ulang.');

  await pastikanRantai(k.rantaiId!);

  /* `from` DITIMPA dengan alamat yang benar-benar aktif di dompet, bukan
     dipakai apa adanya dari LI.FI. Kutipan diambil beberapa detik lalu, dan
     di antaranya orang bisa berganti akun di MetaMask — mengirim `from` yang
     bukan akun aktif membuat dompet menolak dengan pesan yang tidak
     menyebutkan sebabnya. */
  const hash = await p.request({
    method: 'eth_sendTransaction',
    params: [{
      from: dompet,
      to: tx.to,
      data: tx.data,
      value: tx.value || '0x0',
      /* gasLimit dan gasPrice SENGAJA tidak dioper. Keduanya ditaksir LI.FI
         pada saat kutipan; dompet menaksir ulang pada saat kirim, dan
         taksiran yang lebih baru selalu yang lebih benar. Taksiran basi yang
         terlalu rendah gagal di rantai — sesudah gasnya terbakar. */
    }],
  }) as string;

  if (!hash) throw new Error('Dompet tidak mengembalikan hash transaksi.');
  return hash;
}

/** Pindahkan dompet ke rantai yang benar; tawarkan menambahkannya kalau
 *  belum dikenal. Kode 4902 = "rantai tidak dikenal", satu-satunya kegagalan
 *  yang masih bisa diperbaiki tanpa campur tangan manusia. */
async function pastikanRantai(id: number): Promise<void> {
  const p = penyedia()!;
  const kini = parseInt(await p.request({ method: 'eth_chainId' }) as string, 16);
  if (kini === id) return;

  const hex = '0x' + id.toString(16);
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (e: any) {
    if (e?.code !== 4902) throw e;
    const r = Object.values(RANTAI).find((x) => x.id === id);
    if (!r) throw e;
    await p.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: hex,
        chainName: r.nama,
        nativeCurrency: { name: r.gas, symbol: r.gas, decimals: 18 },
        rpcUrls: [r.rpc],
        blockExplorerUrls: [r.jelajah.replace(/tx\/$/, '')],
      }],
    });
  }
}

/* ── Solana: Phantom ────────────────────────────────────────────────────── */

interface PenyediaSol {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(v?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  request(v: { method: string; params?: unknown }): Promise<any>;
}

export function penyediaSol(): PenyediaSol | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null) ?? w.solana ?? null;
}

export function adaDompetSol(): boolean {
  return !!penyediaSol();
}

/** Alamat Solana yang sudah dipercaya, tanpa memunculkan popup. */
export async function alamatSolTersambung(): Promise<string | null> {
  const p = penyediaSol();
  if (!p) return null;
  try {
    const r = await p.connect({ onlyIfTrusted: true });
    return r?.publicKey?.toString() ?? null;
  } catch { return null; }
}

export async function sambungSol(): Promise<string> {
  const p = penyediaSol();
  if (!p) throw new Error('Tidak ada dompet Solana di peramban ini. Pasang Phantom dulu.');
  const r = await p.connect();
  const a = r?.publicKey?.toString();
  if (!a) throw new Error('Dompet tidak memberikan alamat.');
  return a;
}

async function beliSol(k: Kutipan): Promise<string> {
  const p = penyediaSol();
  if (!p) throw new Error('Dompet Solana tidak ditemukan.');
  const alamat = p.publicKey?.toString() || await sambungSol();

  const j = await ambilJson('https://lite-api.jup.ag/swap/v1/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: k.bahan,
      userPublicKey: alamat,
      /* Penggunanya membayar SOL asli, bukan wSOL. Jupiter yang membungkus
         dan membuka bungkusnya di dalam transaksi yang sama. */
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: { maxLamports: 2_000_000, priorityLevel: 'medium' },
      },
    }),
  });

  if (j.simulationError) {
    /* Jupiter MENSIMULASIKAN transaksinya sebelum mengembalikannya, dan
       kalau simulasinya gagal, transaksi itu hampir pasti gagal juga di
       rantai — sesudah gasnya dibayar. Berhenti di sini lebih murah. */
    const s = typeof j.simulationError === 'string'
      ? j.simulationError : (j.simulationError.error || JSON.stringify(j.simulationError));
    throw new Error('Simulasi gagal, transaksi tidak dikirim: ' + s);
  }
  if (!j.swapTransaction) throw new Error('Jupiter tidak mengembalikan transaksi.');

  /* Phantom menerima transaksi dalam base58 lewat `request`, dan itu jalan
     yang sengaja dipilih: alternatifnya `@solana/web3.js` untuk sekadar
     mengubah bentuk pengkodean — 200-an kB masuk ke bundel demi 25 baris.
     Peringatannya sudah tercatat: satu impor yang tampak kecil pernah
     menyeret 647 kB Firestore ke jalur muat awal. */
  const { signature } = await p.request({
    method: 'signAndSendTransaction',
    params: { message: base58(base64KeBita(j.swapTransaction)) },
  });
  if (!signature) throw new Error('Dompet tidak mengembalikan signature.');
  return signature;
}

/* ── Alat kecil ─────────────────────────────────────────────────────────── */

function base64KeBita(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const ABJAD58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** base58 Bitcoin (tanpa 0, O, I, l). Diuji dengan vektor baku di
 *  `skrip/uji/uji-base58.mjs` — jangan disunting tanpa menjalankannya lagi:
 *  pengkodean yang meleset satu huruf menghasilkan transaksi yang ditolak
 *  dengan pesan yang tidak menyebut pengkodean sama sekali. */
export function base58(b: Uint8Array): string {
  let nol = 0;
  while (nol < b.length && b[nol] === 0) nol++;

  const angka: number[] = [];
  for (let i = nol; i < b.length; i++) {
    let bawa = b[i];
    for (let j = 0; j < angka.length; j++) {
      const v = (angka[j] << 8) + bawa;
      angka[j] = v % 58;
      bawa = (v / 58) | 0;
    }
    while (bawa > 0) { angka.push(bawa % 58); bawa = (bawa / 58) | 0; }
  }

  let s = '1'.repeat(nol);
  for (let i = angka.length - 1; i >= 0; i--) s += ABJAD58[angka[i]];
  return s;
}

function angkaAtauNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function ambilJson(url: string, init?: RequestInit): Promise<any> {
  const r = await fetch(url, init);
  const teks = await r.text();
  let j: any = null;
  try { j = JSON.parse(teks); } catch { /* biar pesan mentahnya yang bicara */ }

  if (!r.ok) {
    /* Pesan agregator jauh lebih berguna daripada "HTTP 400": ia menyebut
       "tidak ada rute", "kolam terlalu dangkal", "token tidak dikenal" —
       tiga sebab yang tindak lanjutnya berbeda-beda. */
    const pesan = j?.message || j?.error || teks.slice(0, 200) || `HTTP ${r.status}`;
    throw new Error(pesan);
  }
  return j;
}
