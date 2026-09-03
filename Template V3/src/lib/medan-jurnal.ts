/* ═══════════════════════════════════════════════════════════════════════════
   SIAPA PEMILIK MEDAN — satu aturan, satu tempat
   ═══════════════════════════════════════════════════════════════════════════
   Dokumen transaksi punya dua penulis yang tidak boleh saling menimpa:

     psikologi.*   MILIK MANUSIA. Ditulis hanya lewat modal jurnal.
     _sinkron.*    MILIK MESIN.   Ditulis hanya jalur sinkron bursa/dompet.

   Aturannya satu kalimat: TULISAN TANGAN MENANG, medan mesin cuma cadangan
   supaya kolom Setup tidak kosong sebelum ada yang menulis apa-apa.

   Berkas ini ada karena aturan itu dibaca di DUA tempat — `keTrade`
   (data.ts, untuk tabel riwayat) dan `bacaTrade` (tulis-jurnal.ts, untuk
   modal sunting). Dua salinan akan berselisih pada revisi berikutnya, dan
   selisihnya berbentuk paling jahat: tabel menampilkan setup tulisan
   sendiri, modal menampilkan "Sinkron Hyperliquid", dan menekan Simpan
   menimpa yang benar dengan yang salah.

   BEBAS DEPENDENSI dengan sengaja — tanpa firebase, tanpa React — supaya
   bisa diuji langsung oleh Node di skrip/uji/uji-medan-jurnal.mjs.

   String KOSONG diperlakukan sebagai TIDAK ADA, bukan sebagai nilai. Jalur
   sinkron memang menulis '' untuk emosi (mesin tidak tahu perasaan siapa
   pun), dan `??` akan meloloskan '' sebagai jawaban yang sah — lalu Pola
   Emosi menggambar satu baris tanpa nama. `||` yang dipakai di sini
   menutupnya.
   ═══════════════════════════════════════════════════════════════════════ */

/** Bentuk dokumen seadanya — sengaja longgar, ini pembaca bukan penulis. */
export interface DokTrade {
  psikologi?: { emosiMasuk?: unknown; emosiEvaluasi?: unknown; alasanMasuk?: unknown; catatan?: unknown } | null;
  _sinkron?: { alasan?: unknown; catatan?: unknown } | null;
  sebabKeluar?: unknown;
}

function teks(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

/** Kolom "Setup". Tangan → mesin → sebab keluar (dokumen migrasi lama). */
export function alasanJurnal(d: DokTrade): string {
  return teks(d?.psikologi?.alasanMasuk) || teks(d?._sinkron?.alasan) || teks(d?.sebabKeluar) || '';
}

/** Catatan. Tangan → keterangan mesin (oid, isian, fee, dompet). */
export function catatanJurnal(d: DokTrade): string {
  return teks(d?.psikologi?.catatan) || teks(d?._sinkron?.catatan) || '';
}

/** Emosi TIDAK punya cadangan mesin, dan itu disengaja: mesin tidak boleh
 *  menaruh klaim perasaan di jurnal orang. Kosong berarti belum dicatat. */
export function emosiJurnal(d: DokTrade): string {
  return teks(d?.psikologi?.emosiMasuk);
}

export function emosiEvaluasiJurnal(d: DokTrade): string {
  return teks(d?.psikologi?.emosiEvaluasi);
}
