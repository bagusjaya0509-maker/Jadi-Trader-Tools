/* Membuktikan bahwa impor data contoh TIDAK BISA menimpa transaksi
   sungguhan, dan bahwa yang ditulisnya benar-benar terbaca oleh pembaca
   jurnal yang sama.

   Yang dijaga di sini satu hal yang tidak bisa dibatalkan: transaksi hasil
   migrasi V2 memakai id `fx-…` dan `cr-…` — id yang SAMA PERSIS dengan
   konstanta di data/contoh.ts. Kalau awalan `contoh-` hilang dalam suatu
   revisi, menekan "Impor data contoh" akan menimpa 123 transaksi asli
   pemilik dengan angka karangan, dan tidak ada tombol yang bisa
   mengembalikannya.

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
const aw = srcContoh.indexOf('function buatRiwayat');
const ak = srcContoh.indexOf('export const RIWAYAT');
const jsRiwayat = transformSync(
  srcContoh.slice(aw, ak).replace(/: Trade\[\]/g, '').replace(/^export /gm, ''),
  { loader: 'ts', format: 'cjs' }).code;
const skrg = Date.now();
const buatRiwayat = new Function('skrg', 'HARI', `${jsRiwayat}; return buatRiwayat;`)(skrg, 86_400_000);
const RIWAYAT = buatRiwayat();

cek('jumlah transaksi contoh', RIWAYAT.length, 123);

/* ── 2. Awalan id: satu string, dua berkas ────────────────────────────── */
const srcImpor = readFileSync('src/lib/impor-contoh.ts', 'utf8');
const awalan = srcImpor.match(/AWALAN_CONTOH\s*=\s*'([^']+)'/)?.[1];
cek('AWALAN_CONTOH terbaca dari sumbernya', awalan, 'contoh-');

/* gerbang.tsx menuliskan awalan yang sama SECARA TERPISAH — sengaja, supaya
   berkas impor tetap bisa dimuat malas. Harganya: keduanya bisa menyimpang
   diam-diam, dan baris inilah yang mencegahnya. */
const srcGerbang = readFileSync('src/components/gerbang.tsx', 'utf8');
const diGerbang = srcGerbang.match(/t\.id\.startsWith\('([^']+)'\)/)?.[1];
cek('gerbang.tsx memakai awalan yang sama', diGerbang, awalan);

/* ── 3. Yang paling penting: TIDAK menabrak id migrasi ────────────────── */
const idImpor = RIWAYAT.map((t) => awalan + t.id);
const idMigrasi = new Set(RIWAYAT.map((t) => t.id));          // 'fx-0', 'cr-0', …
cek('tidak ada id impor yang menabrak id migrasi',
  idImpor.filter((id) => idMigrasi.has(id)).length, 0);
cek('semua id impor berawalan contoh-',
  idImpor.every((id) => id.startsWith('contoh-')), true);
cek('semua id impor unik', new Set(idImpor).size, idImpor.length);
cek('id migrasi asli tetap berawalan fx-/cr-',
  [...idMigrasi].every((id) => /^(fx|cr)-\d+$/.test(id)), true);

/* ── 4. Bentuk dokumen benar-benar terbaca keTrade ────────────────────── */
const aT = srcContoh.length && readFileSync('src/lib/data.ts', 'utf8');
const src = aT;
const p = src.indexOf('function keTrade');
const q = src.indexOf('export interface Ringkasan');
const jsKeTrade = transformSync(
  src.slice(p, q).replace(/: DocumentData/g, '').replace(/: Trade/g, '').replace(/: Sumber/g, ''),
  { loader: 'ts', format: 'cjs' }).code;
const keTrade = new Function('n', 'ms', `${jsKeTrade}; return keTrade;`)(
  (v) => (typeof v === 'number' && isFinite(v) ? v : 0),
  (v) => (typeof v === 'number' ? v : (v?.milis ?? 0)),
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
  ukuran: t.sumber === 'forex' ? { lot: t.lot } : { qty: t.lot },
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
