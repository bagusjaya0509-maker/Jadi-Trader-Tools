/* ══════════════════════════════════════════════════════════════════════
   MENEBAK PASANGAN DARI KETERANGAN CHART
   ══════════════════════════════════════════════════════════════════════
   KEMBARAN SENGAJA dari `KAMUS_PASANGAN` di
   src/components/panel-chart-agen.tsx. Keduanya HARUS diubah bersamaan.

   Kenapa digandakan, padahal seluruh berkas lain di proyek ini menolak dua
   sumber kebenaran: isi pesan Telegram TIDAK PERNAH boleh ikut ke lonceng.
   /api/kabar terbuka tanpa login, dan keputusan 28 Agu 2026 menetapkan cuma
   HASIL URAIAN KITA SENDIRI — pasangan, arah, level — yang boleh keluar.
   Jadi penebakannya wajib terjadi di server, sebelum apa pun dikirim; dan
   layar tetap butuh tabel yang sama untuk mengelompokkan chart di panel.
   Berkas TSX itu tidak bisa di-require dari sini, dan berkas ini tidak ikut
   dibangun ke bundel web.

   Yang menyeberang cuma NAMA PASANGAN — "XAUUSD", "ZECUSDT". Bukan
   keterangannya, bukan nama ruangnya, bukan tautannya.
   ══════════════════════════════════════════════════════════════════════ */

const KAMUS = [
  /* Longgar — nama panjang, tidak bersarang di kata Indonesia mana pun. */
  [/\bxau|\bgold\b|\bemas\b/i, 'XAUUSD'],
  [/\bbtc\b|\bbitcoin\b/i, 'BTCUSDT'],
  [/\bethereum\b/i, 'ETHUSDT'],
  [/\bsolana\b/i, 'SOLUSDT'],
  [/\bhyperliquid\b/i, 'HYPEUSDT'],
  [/\bethena\b/i, 'ENAUSDT'],
  [/\bvirtual\b/i, 'VIRTUALUSDT'],
  [/\bcardano\b/i, 'ADAUSDT'],
  [/\bripple\b/i, 'XRPUSDT'],
  [/\bzcash\b/i, 'ZECUSDT'],
  [/\bdoge\b/i, 'DOGEUSDT'],
  [/\bavax\b/i, 'AVAXUSDT'],
  [/\bbnb\b/i, 'BNBUSDT'],
  [/\bxrp\b/i, 'XRPUSDT'],

  /* KETAT — huruf besar saja, supaya ticker pendek tidak tertangkap dari
     tengah kata Indonesia. "ada" -> ADAUSDT adalah kegagalan yang akan
     terjadi tiap hari kalau benderanya dilonggarkan. */
  [/\bETH\b/, 'ETHUSDT'],
  [/\bSOL\b/, 'SOLUSDT'],
  [/\bHYPE\b/, 'HYPEUSDT'],
  [/\bENA\b/, 'ENAUSDT'],
  [/\bPUMP\b/, 'PUMPUSDT'],
  [/\bADA\b/, 'ADAUSDT'],
  [/\bLINK\b/, 'LINKUSDT'],
  [/\bSUI\b/, 'SUIUSDT'],
  /* Zec ditulis "Zec" di ruang sumbernya — huruf besar di depan saja, jadi
     pola ketat huruf-besar-semua tidak menangkapnya. Ditulis terpisah
     dengan bendera `i` karena "zec" tidak bersarang di kata mana pun. */
  [/\bzec\b/i, 'ZECUSDT'],
];

/** Nama pasangan, atau null kalau tidak satu pun cocok. Null adalah jawaban
 *  yang benar — satu chart yang perlu dikelompokkan tangan jauh lebih baik
 *  daripada sepuluh chart yang masuk koin yang salah. */
module.exports.tebakPasangan = function tebakPasangan(keterangan) {
  const t = String(keterangan || '');
  for (const [pola, simbol] of KAMUS) if (pola.test(t)) return simbol;
  return null;
};
