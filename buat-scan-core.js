/* ══════════════════════════════════════════════════════════════════════════
   GENERATOR: jt-scan-core.js
   ══════════════════════════════════════════════════════════════════════════
   Menyalin fungsi-fungsi PERHITUNGAN dari ema-cross-screener_3.html ke sebuah
   file terpisah supaya halaman mobile bisa memakai logika yang SAMA PERSIS.

   Kenapa disalin lewat skrip, bukan diketik ulang:
   logika parallel channel di screener butuh banyak putaran perbaikan sampai
   cocok dengan Pine Script (pivot LOOSE, channel dihitung di bar konfirmasi
   pivot, dst). Mengetik ulang = mengundang penyimpangan diam-diam. Dengan
   generator, salinannya dijamin identik, dan kalau screener berubah tinggal:

       node buat-scan-core.js

   Yang disalin HANYA fungsi murni (tanpa sentuhan DOM). Bagian tampilan tetap
   ditulis sendiri di masing-masing halaman.
   ══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SUMBER = path.join(DIR, 'ema-cross-screener_3.html');
const TUJUAN = path.join(DIR, 'jt-scan-core.js');

const src = fs.readFileSync(SUMBER, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';

// Fungsi yang dibutuhkan halaman mobile.
const FUNGSI = [
  'fmtPrice', 'ema', 'stochastic', 'smiSeries', 'smiConditionOf',
  'atr', 'findPivots', 'detectParallelChannel', 'pivotConfirmBarsDesc',
  'snrTouchH4M5',
  'mapLimited'
];

// Baris konstanta / fungsi satu baris yang ikut dibawa apa adanya.
const BARIS_LITERAL = [
  'const SMI_K = 14',
  'const SMI_OB = 50',
  'const PC_SIG_TOL_MULT',
  'const PC_SIG_SCANBACK',
  'const PC_SIG_FRESH',
  'function pcUpperAt',
  'function pcLowerAt'
];

/* Ambil satu deklarasi fungsi utuh dengan mencocokkan kurung kurawal.
   Tanda kurawal di dalam string/komentar dilewati supaya hitungannya benar. */
function ambilFungsi(nama){
  const re = new RegExp('\\n(\\s*)(?:async\\s+)?function\\s+' + nama + '\\s*\\(');
  const m = re.exec(src);
  if(!m) throw new Error('fungsi tidak ketemu: ' + nama);
  const mulai = m.index + 1;
  let i = src.indexOf('{', m.index + m[0].length - 1);
  if(i < 0) throw new Error('kurawal pembuka tidak ketemu: ' + nama);

  let depth = 0, dalamStr = null, dalamKomentar = null;
  for(let j = i; j < src.length; j++){
    const c = src[j], c2 = src[j+1];
    if(dalamKomentar === 'baris'){ if(c === '\n') dalamKomentar = null; continue; }
    if(dalamKomentar === 'blok'){ if(c === '*' && c2 === '/'){ dalamKomentar = null; j++; } continue; }
    if(dalamStr){
      if(c === '\\'){ j++; continue; }
      if(c === dalamStr) dalamStr = null;
      continue;
    }
    if(c === '/' && c2 === '/'){ dalamKomentar = 'baris'; j++; continue; }
    if(c === '/' && c2 === '*'){ dalamKomentar = 'blok'; j++; continue; }
    if(c === '"' || c === "'" || c === '`'){ dalamStr = c; continue; }
    if(c === '{') depth++;
    else if(c === '}'){
      depth--;
      if(depth === 0) return src.slice(mulai, j + 1);
    }
  }
  throw new Error('kurawal penutup tidak ketemu: ' + nama);
}

function ambilBaris(awalan){
  const baris = src.split(eol);
  const hit = baris.find(l => l.trim().startsWith(awalan));
  if(!hit) throw new Error('baris tidak ketemu: ' + awalan);
  return hit;
}

const bagian = [];
BARIS_LITERAL.forEach(a => bagian.push(ambilBaris(a).trim()));
FUNGSI.forEach(n => bagian.push(ambilFungsi(n).replace(/^\s{2}/gm, '')));

/* Daftar ekspor DITURUNKAN dari FUNGSI, tidak diketik ulang. Dulu keduanya
   ditulis terpisah, dan menambah satu fungsi ke FUNGSI tanpa menambahnya ke
   daftar ekspor menghasilkan file yang lolos cek sintaks tapi fungsinya tidak
   bisa dipanggil dari luar. */
const EKSPOR_LITERAL = [
  'pcUpperAt', 'pcLowerAt',
  'SMI_K', 'SMI_D', 'SMI_EMA', 'SMI_OB', 'SMI_OS',
  'PC_SIG_TOL_MULT', 'PC_SIG_SCANBACK', 'PC_SIG_FRESH'
];
const SEMUA_EKSPOR = FUNGSI.concat(EKSPOR_LITERAL);

function barisEkspor(){
  const baris = [];
  for(let i = 0; i < SEMUA_EKSPOR.length; i += 3){
    const potong = SEMUA_EKSPOR.slice(i, i + 3).map(n => n + ': ' + n);
    baris.push('    ' + potong.join(', ') + (i + 3 < SEMUA_EKSPOR.length ? ',' : ''));
  }
  return baris;
}

const keluaran = [
  '/* ════════════════════════════════════════════════════════════════════════',
  '   jt-scan-core.js — JANGAN DIEDIT LANGSUNG.',
  '',
  '   File ini DIBUAT OTOMATIS dari ema-cross-screener_3.html oleh',
  '   buat-scan-core.js. Semua isinya adalah salinan persis fungsi perhitungan',
  '   milik screener, supaya halaman mobile memakai logika yang sama dan tidak',
  '   bisa menyimpang diam-diam.',
  '',
  '   Kalau logika di screener berubah, jalankan lagi:  node buat-scan-core.js',
  '   Dibuat: ' + new Date().toISOString(),
  '   ════════════════════════════════════════════════════════════════════════ */',
  'window.JTScan = (function(){',
  '  "use strict";',
  ''
].join(eol)
  + bagian.join(eol + eol).split('\n').map(l => '  ' + l).join('\n')
  + eol + eol
  + [
    '  return {',
    ...barisEkspor(),
    '  };',
    '})();'
  ].join(eol) + eol;

fs.writeFileSync(TUJUAN, keluaran);

/* Pastikan hasilnya benar-benar bisa DIJALANKAN, bukan cuma di-parse, dan
   setiap nama yang dijanjikan memang keluar dari modulnya. Versi lama hanya
   memeriksa sintaks - jadi waktu snrTouchH4M5 ditambahkan ke FUNGSI tapi
   daftar ekspornya (yang dulu diketik tangan, terpisah) belum, generatornya
   melapor "sukses" padahal halaman mobile memanggil fungsi yang tidak ada. */
const vm = require('vm');
const kotak = { window: {} };
vm.createContext(kotak);
new vm.Script(keluaran).runInContext(kotak);
const jadi = kotak.window.JTScan;
const hilang = SEMUA_EKSPOR.filter(n => jadi[n] === undefined);
if (hilang.length) throw new Error('tidak terekspor: ' + hilang.join(', '));

console.log('jt-scan-core.js dibuat: ' + keluaran.length + ' byte');
console.log('fungsi: ' + FUNGSI.join(', '));
console.log('ekspor terverifikasi: ' + SEMUA_EKSPOR.length + ' nama');
