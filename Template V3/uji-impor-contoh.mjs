/* Membuktikan bahwa impor data contoh TIDAK BISA menimpa transaksi
   sungguhan, dan bahwa yang ditulisnya benar-benar terbaca oleh pembaca
   jurnal yang sama.

   Yang dijaga di sini satu hal yang tidak bisa dibatalkan: transaksi hasil
   migrasi V2 memakai id `fx-…` dan `cr-…`. Contoh lama memakai id yang
   SAMA PERSIS, jadi tanpa awalan `contoh-` menekan "Impor data contoh"
   akan menimpa transaksi asli pemilik dengan angka karangan.

   Sejak 3 Okt 2026 contohnya dibangkitkan (setahun penuh) dengan id
   `s-fx-…`/`s-cr-…` — dua lapis jarak dari id migrasi, dan dua-duanya
   diuji di bawah: id contohnya sendiri tidak boleh berbentuk id migrasi,
   DAN id impornya tetap wajib berawalan `contoh-`.

   Sumbernya dibaca LANGSUNG lewat esbuild, bukan disalin tangan: salinan
   tangan akan tetap lulus walau berkas aslinya berubah. */

import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

let lulus = 0, gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  ok ? lulus++ : gagal++;
  console.log(`${ok ? ' ok  ' : 'GAGAL'} ${nama.padEnd(56)} ${JSON.stringify(dapat)}${ok ? '' : `  (harap ${JSON.stringify(harap)})`}`);
};

/* ── 1. Riwayat contoh: id apa adanya, dari sumbernya ─────────────────── */
const srcContoh = readFileSync('src/data/contoh.ts', 'utf8');
/* Dari pembangkit acaknya sampai tepat sebelum RIWAYAT — seluruh pembantu
   `buatRiwayat` tinggal di rentang itu. Tipenya dibuang esbuild. */
const aw = srcContoh.indexOf('function acakBerbenih');
const ak = srcContoh.indexOf('export const RIWAYAT');
if (aw < 0 || ak < aw) throw new Error('potongan pembangkit riwayat tidak ketemu');
const jsRiwayat = transformSync(
  srcContoh.slice(aw, ak).replace(/^export /gm, ''),
  { loader: 'ts', format: 'cjs' }).code;
const skrg = Date.now();
const bangun = (kini) => new Function('skrg', 'HARI', 'JAM', 'MENIT', `${jsRiwayat}; return buatRiwayat;`)(
  kini, 86_400_000, 3_600_000, 60_000)();
const RIWAYAT = bangun(skrg);

/* ── 1b. Setahun penuh, lengkap, dan tidak berubah tiap dimuat ───────── */
const HARI = 86_400_000;
cek('contohnya ratusan transaksi, bukan segelintir', RIWAYAT.length > 700 && RIWAYAT.length < 1400, true);
cek('rentangnya minimal 365 hari', (skrg - Math.min(...RIWAYAT.map((t) => t.waktu))) / HARI >= 365, true);
cek('tidak ada transaksi dari masa depan', RIWAYAT.some((t) => t.waktu > skrg), false);
cek('dua jurnal sama-sama berisi',
  ['forex', 'kripto'].map((s) => RIWAYAT.filter((t) => t.sumber === s).length > 250), [true, true]);
cek('tiap transaksi punya emosi dan setup', RIWAYAT.every((t) => t.emosi && t.alasan), true);
cek('transaksi kripto membawa nilai order & leverage',
  RIWAYAT.filter((t) => t.sumber === 'kripto').every((t) => t.nilaiOrder > 0 && t.leverage > 0), true);
/* Tiga belas bulan kalender (12 penuh + berjalan), dua jurnal: tidak boleh
   ada bulan yang kosong — itulah keluhan yang melahirkan contoh ini. */
const bulanDari = (s) => new Set(RIWAYAT.filter((t) => t.sumber === s).map((t) => {
  const d = new Date(t.waktu); return d.getFullYear() * 12 + d.getMonth();
})).size;
cek('forex: 12 bulan terakhir semuanya berisi', bulanDari('forex') >= 12, true);
cek('kripto: 12 bulan terakhir semuanya berisi', bulanDari('kripto') >= 12, true);
/* Deterministik: dibangkitkan dua kali pada jam yang sama -> sama persis;
   dibangkitkan sejam kemudian -> yang lama tidak berubah sedikit pun. */
cek('dimuat ulang -> transaksinya sama persis',
  JSON.stringify(bangun(skrg)) === JSON.stringify(RIWAYAT), true);
const nanti = bangun(skrg + 3_600_000);
cek('sejam kemudian -> yang lama tidak berubah',
  JSON.stringify(nanti.filter((t) => t.waktu <= skrg)) === JSON.stringify(RIWAYAT), true);

/* ── 2. Awalan id: satu string, dua berkas ────────────────────────────── */
const srcImpor = readFileSync('src/lib/impor-contoh.ts', 'utf8');
const awalan = srcImpor.match(/AWALAN_CONTOH\s*=\s*'([^']+)'/)?.[1];
cek('AWALAN_CONTOH terbaca dari sumbernya', awalan, 'contoh-');

/* Spanduknya harus MENGIMPOR awalannya, bukan menyalinnya. Salinan tulisan
   tangan pernah ada di sana — perlu waktu impornya masih dinamis — dan
   baris ini yang memastikan ia tidak kembali.

   Berkasnya `spanduk-contoh.tsx`, bukan `gerbang.tsx`: SpandukContoh
   dipindah supaya Firestore tidak ikut ke bundel awal, dan uji ini sempat
   tertinggal membaca berkas lama (ketahuan 3 Okt 2026 — ia gagal tanpa ada
   yang rusak). */
const srcGerbang = readFileSync('src/components/spanduk-contoh.tsx', 'utf8');
/* KOMENTAR DIBUANG DULU. Versi pertama uji ini gagal bukan karena kodenya
   salah, melainkan karena komentar yang MENJELASKAN kenapa impor dinamis
   dibuang justru memuat frasa yang dicarinya. Uji yang membaca komentar
   sebagai kode akan menghukum setiap penjelasan yang baik. */
const kodeGerbang = srcGerbang.replace(/\/\*[\s\S]*?\*\//g, '');

cek('spanduk mengimpor AWALAN_CONTOH',
  /import\s*\{[^}]*AWALAN_CONTOH[^}]*\}\s*from\s*'@\/lib\/impor-contoh'/.test(kodeGerbang), true);
cek('spanduk tidak menyalin awalannya sendiri',
  /startsWith\('contoh-'\)/.test(kodeGerbang), false);

/* IMPOR STATIS, bukan dinamis. `await import(...)` memecahnya jadi potongan
   bernama hash yang berubah tiap build — halaman dari cache memegang nama
   lama, permintaannya 404, dan tombolnya gagal dengan "Failed to fetch
   dynamically imported module". Persis bug yang dilaporkan pemilik. */
cek('impor-contoh ditarik statis, bukan lewat await import()',
  /await import\(['"]@\/lib\/impor-contoh/.test(kodeGerbang), false);

/* ── 3. Yang paling penting: TIDAK menabrak id migrasi ────────────────── */
const idImpor = RIWAYAT.map((t) => awalan + t.id);
/* Id migrasi V2 milik pemilik: 'fx-0', 'cr-0', … — bentuk yang DULU juga
   dipakai contoh. */
const BENTUK_MIGRASI = /^(fx|cr)-\d+$/;
cek('tidak ada id impor yang berbentuk id migrasi',
  idImpor.filter((id) => BENTUK_MIGRASI.test(id)).length, 0);
cek('semua id impor berawalan contoh-',
  idImpor.every((id) => id.startsWith('contoh-')), true);
cek('semua id impor unik', new Set(idImpor).size, idImpor.length);
cek('id contoh sendiri TIDAK berbentuk id migrasi',
  RIWAYAT.some((t) => BENTUK_MIGRASI.test(t.id)), false);

/* ── 3b. Hapus impor: dari yang ADA di jurnal, plus id impor lama ─────── */
const kodeImpor = srcImpor.replace(/\/\*[\s\S]*?\*\//g, '');
cek('hapusImporContoh menerima jurnal yang termuat',
  /export async function hapusImporContoh\(uid: string, riwayat: Trade\[\]\)/.test(kodeImpor), true);
cek('hapus tidak lagi menghitung ulang dari contoh hari ini',
  /hapusImporContoh[\s\S]*RIWAYAT\.slice/.test(kodeImpor), false);
cek('id impor versi lama (contoh-fx-0…28, contoh-cr-0…93) tetap terjangkau',
  /length: 29[\s\S]*fx-[\s\S]*length: 94[\s\S]*cr-/.test(kodeImpor), true);
/* Yang disalin dibatasi — setahun penuh berarti ~950 tulisan per klik. */
const HARI_IMPOR = Number(srcImpor.match(/HARI_IMPOR\s*=\s*(\d+)/)?.[1]);
const bahan = RIWAYAT.filter((t) => t.waktu >= skrg - HARI_IMPOR * HARI);
cek('impor dibatasi beberapa bulan terakhir', HARI_IMPOR > 0 && HARI_IMPOR <= 90, true);
cek('jumlah yang disalin muat satu batch (<400) dan tidak kosong',
  bahan.length > 40 && bahan.length < 400, true);

/* ── 4. Bentuk dokumen benar-benar terbaca keTrade ────────────────────── */
const aT = srcContoh.length && readFileSync('src/lib/data.ts', 'utf8');
const src = aT;
const p = src.indexOf('function keTrade');
const q = src.indexOf('export interface Ringkasan');
const jsKeTrade = transformSync(
  src.slice(p, q).replace(/: DocumentData/g, '').replace(/: Trade/g, '').replace(/: Sumber/g, ''),
  { loader: 'ts', format: 'cjs' }).code;
/* `keTrade` membaca emosi & alasan lewat lib/medan-jurnal.ts — aturannya
   memang tinggal di sana. Berkas itu murni (tanpa impor saat berjalan),
   jadi ia dimuat utuh dari sumbernya, bukan ditiru di sini. */
const jsMedan = transformSync(readFileSync('src/lib/medan-jurnal.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
const modMedan = { exports: {} };
new Function('exports', 'module', jsMedan)(modMedan.exports, modMedan);
const medan = modMedan.exports;
const keTrade = new Function('n', 'ms', 'emosiJurnal', 'alasanJurnal', `${jsKeTrade}; return keTrade;`)(
  (v) => (typeof v === 'number' && isFinite(v) ? v : 0),
  (v) => (typeof v === 'number' ? v : (v?.milis ?? 0)),
  medan.emosiJurnal, medan.alasanJurnal,
);

/* Catatannya dibaca LANGSUNG dari sumbernya, bukan disalin ke sini.
   Justru kalimat inilah yang pernah salah: memuat frasa yang dikenali
   `keTrade` sebagai jejak transaksi latihan lama. Salinan tangan akan
   membuat ujinya lulus sementara yang tayang tetap salah. */
const CATATAN = srcImpor.match(/catatan: '([^']+)'/)?.[1] ?? '';
cek('catatan terbaca dari sumbernya', CATATAN.length > 10, true);

/* Dokumen yang DITULIS imporContoh, disalin bentuknya dari sumbernya. */
const dokumen = (t) => ({
  simbol: t.pair.toUpperCase(),
  arah: t.arah,
  sumber: t.sumber,
  ukuran: t.sumber === 'forex' ? { lot: t.lot } : { qty: t.lot, nilai: t.nilaiOrder, leverage: t.leverage },
  pnl: t.pnl,
  masukWaktu: { milis: t.waktu },
  keluarWaktu: { milis: t.waktu },
  psikologi: {
    emosiMasuk: t.emosi ?? 'Netral',
    emosiEvaluasi: t.emosi ?? 'Netral',
    alasanMasuk: t.alasan ?? '',
    catatan: CATATAN,
  },
  latihan: false,
  _asal: 'contoh-v3',
});

const fx = RIWAYAT.find((t) => t.sumber === 'forex');
const cr = RIWAYAT.find((t) => t.sumber === 'kripto');
const bacaFx = keTrade(awalan + fx.id, dokumen(fx));
const bacaCr = keTrade(awalan + cr.id, dokumen(cr));

cek('forex — pnl bolak-balik utuh', bacaFx.pnl, fx.pnl);
cek('forex — ukuran terbaca sebagai lot', bacaFx.lot, fx.lot);
cek('kripto — ukuran terbaca sebagai qty', bacaCr.lot, cr.lot);
cek('kripto — sumber tetap kripto', bacaCr.sumber, 'kripto');
cek('kripto — nilai order ikut terbaca', bacaCr.nilaiOrder, cr.nilaiOrder);
cek('kripto — leverage ikut terbaca', bacaCr.leverage, cr.leverage);
cek('emosi ikut terbaca', bacaFx.emosi, fx.emosi);
cek('waktu tidak hilang', bacaFx.waktu, fx.waktu);

/* KRUSIAL: `latihan` harus false. Kalau true, seluruh baris hasil impor
   dikeluarkan dari winrate, Net P/L, dan profit factor — angka Dashboard
   tetap nol sesudah impor dan tombolnya terlihat tidak melakukan apa-apa. */
cek('tidak ditandai latihan (kalau tidak, statistik tetap nol)', bacaFx.latihan, false);

/* Catatannya wajib menyebut dirinya contoh. Tanpa itu, orang yang membuka
   transaksinya enam minggu lagi tidak punya cara tahu ini bukan miliknya. */
cek('catatan menyebut dirinya data contoh', /data contoh/i.test(CATATAN), true);

/* …TAPI tidak boleh memakai dua frasa yang dipakai keTrade untuk mengenali
   transaksi latihan lama. Ini persis bug yang tertangkap saat uji ini
   ditulis: catatannya berbunyi "bukan transaksi sungguhan", dan seluruh
   123 baris hasil impor langsung terhitung latihan. */
cek('catatan tidak memicu heuristik latihan lama',
  /latihan replay|bukan transaksi sungguhan/i.test(CATATAN), false);
cek('alasan juga tidak memicunya',
  RIWAYAT.some((t) => /latihan replay/i.test(t.alasan ?? '')), false);

/* ── 5. Pengenalan untuk tombol hapus ─────────────────────────────────── */
const ada = (daftar) => daftar.some((t) => t.id.startsWith(awalan));
cek('jurnal berisi impor  -> tombol hapus muncul', ada([{ id: 'contoh-fx-3' }, { id: 'm-BTC-1' }]), true);
cek('jurnal tanpa impor   -> tombol hapus diam', ada([{ id: 'm-BTC-1' }, { id: 'cr-7' }]), false);
cek('jurnal migrasi murni -> tombol hapus diam', ada([{ id: 'fx-0' }, { id: 'cr-93' }]), false);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
