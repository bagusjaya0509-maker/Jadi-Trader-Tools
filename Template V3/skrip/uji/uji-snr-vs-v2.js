/* Adu porting SNR dengan ASLINYA.
   ────────────────────────────────────────────────────────────────────────
   Fungsi V2 dipotong langsung dari ema-cross-screener_3.html dan fungsi
   agen dipotong dari agen-sinyal.js — keduanya kode yang benar-benar jalan,
   bukan salinan yang diketik ulang ke berkas uji ini. Lalu keduanya diberi
   deret harga acak yang SAMA dan dibandingkan bar demi bar.

   Kalau suatu hari salah satu sisi diubah, angkanya berpisah dan uji ini
   gagal. Itu gunanya. */
const fs = require('fs'), vm = require('vm');

const HTML = fs.readFileSync(
  'C:/Users/Admin/Documents/Obsidian Vault/Jadi Trader Tools/Template V2 Premium/ema-cross-screener_3.html', 'utf8');
const AGEN = fs.readFileSync(__dirname + '/vps/agen-sinyal.js', 'utf8');

function potong(src, nama) {
  const i = src.search(new RegExp('function\\s+' + nama + '\\s*\\('));
  if (i < 0) throw new Error('tidak ketemu: ' + nama);
  let dalam = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') dalam++;
    else if (src[k] === '}') { dalam--; if (!dalam) return src.slice(i, k + 1); }
  }
  throw new Error('kurung tidak tertutup: ' + nama);
}

// ── sisi V2 ───────────────────────────────────────────────────────────
const v2 = { console };
vm.createContext(v2);
vm.runInContext('const SMI_K=14,SMI_D=3,SMI_EMA=3;const SMI_OB=50,SMI_OS=-50;\n'
  + ['ema', 'atr', 'findPivots', 'smiSeries', 'cekSmiEkstrem', 'snrTouchH4M5', 'slFromSnrZone']
      .map((n) => potong(HTML, n)).join('\n'), v2);

// ── sisi agen ─────────────────────────────────────────────────────────
const ag = { console };
vm.createContext(ag);
vm.runInContext('const SMI_K=14,SMI_D=3,SMI_EMA=3;const SMI_OB=50,SMI_OS=-50;\n'
  + ['emaSeri', 'atrWilder', 'cariPivot', 'smiSeri', 'smiEkstrem', 'sentuhZonaSnr', 'slDariZonaSnr']
      .map((n) => potong(AGEN, n)).join('\n'), ag);

// ── deret harga acak yang bisa diulang ────────────────────────────────
let benih = 20260902;
const acak = () => { benih = (benih * 1103515245 + 12345) % 2147483648; return benih / 2147483648; };
function deret(n) {
  const bar = []; let h = 100;
  for (let i = 0; i < n; i++) {
    const o = h;
    h = Math.max(1, h * (1 + (acak() - 0.5) * 0.04));
    const c = h;
    const hi = Math.max(o, c) * (1 + acak() * 0.012);
    const lo = Math.min(o, c) * (1 - acak() * 0.012);
    bar.push({ t: 1756000000000 + i * 14400000, o, h: hi, l: lo, c });
  }
  return bar;
}

const dekat = (a, b, tol) => (a === null || b === null || a === undefined || b === undefined)
  ? a === b : Math.abs(a - b) <= (tol || 1e-9);

let lulus = 0, gagal = 0;
const cek = (n, b, ket) => {
  if (b) { lulus++; console.log('  ok   ' + n); }
  else { gagal++; console.log('  GAGAL ' + n + (ket ? '  ' + ket : '')); }
};

const BAR = deret(300);
const highs = BAR.map((b) => b.h), lows = BAR.map((b) => b.l), closes = BAR.map((b) => b.c);

// 1. EMA
{
  const a = v2.ema(closes, 9), b = ag.emaSeri(closes, 9);
  cek('EMA sepanjang 300 bar identik',
      a.length === b.length && a.every((v, i) => dekat(v, b[i])));
}

// 2. ATR Wilder — beda dari atr() lama di agen, jadi ini yang menentukan
{
  const a = v2.atr(highs, lows, closes, 14), b = ag.atrWilder(BAR, 14);
  cek('ATR(14) Wilder identik di SEMUA bar',
      a.length === b.length && a.every((v, i) => dekat(v, b[i], 1e-9)));
}

// 3. Pivot
{
  const a = v2.findPivots(highs, 10, 10, true), b = ag.cariPivot(highs, 10, 10, true);
  const c = v2.findPivots(lows, 10, 10, false), d = ag.cariPivot(lows, 10, 10, false);
  cek('pivot high: jumlah & posisi identik',
      a.length === b.length && a.every((p, i) => p.index === b[i].i && dekat(p.value, b[i].nilai)),
      '(' + a.length + ' vs ' + b.length + ')');
  cek('pivot low: jumlah & posisi identik',
      c.length === d.length && c.every((p, i) => p.index === d[i].i && dekat(p.value, d[i].nilai)));
}

// 4. SMI
{
  const a = v2.smiSeries(highs, lows, closes, 14, 3, 3);
  const b = ag.smiSeri(BAR, 14, 3, 3);
  cek('deret SMI identik di SEMUA bar',
      a.smi.every((v, i) => dekat(v, b.smi[i], 1e-9)));
  cek('deret sinyal SMI identik',
      a.signal.every((v, i) => dekat(v, b.sinyal[i], 1e-9)));
}

// 5. SMI ekstrem — diuji di banyak potongan supaya ketiga cabangnya kena
{
  let sama = 0, beda = 0, ekstrem = 0;
  for (let n = 60; n <= 300; n += 3) {
    const sub = BAR.slice(0, n);
    const a = v2.cekSmiEkstrem(sub.map((x) => x.h), sub.map((x) => x.l), sub.map((x) => x.c));
    const b = ag.smiEkstrem(sub);
    const cocok = (!a && !b) || (a && b && a.arah === b.arah && a.kondisi === b.kondisi
                  && dekat(a.k, b.k, 1e-9) && a.mulaiBalik === b.mulaiBalik);
    cocok ? sama++ : beda++;
    if (a) ekstrem++;
  }
  cek('SMI ekstrem sama di 81 potongan (' + ekstrem + ' di antaranya ekstrem)', beda === 0,
      beda ? beda + ' berbeda' : '');
}

// 6. Sentuhan zona — candle dipaksa menyentuh supaya cabangnya benar-benar kena
{
  const res = v2.findPivots(highs, 10, 10, true).slice(-2).map((p) => p.value);
  const sup = v2.findPivots(lows, 10, 10, false).slice(-2).map((p) => p.value);
  const h4 = { highs, lows, closes };
  const uji = [];
  // sentuh resistance, sentuh support, dan jauh dari keduanya
  res.forEach((lvl) => uji.push({ open: lvl * 0.999, high: lvl, low: lvl * 0.995, close: lvl * 0.9985 }));
  sup.forEach((lvl) => uji.push({ open: lvl * 1.001, high: lvl * 1.005, low: lvl, close: lvl * 1.0015 }));
  uji.push({ open: 1e6, high: 1.01e6, low: 0.99e6, close: 1e6 });
  let beda = 0, adaSentuh = 0;
  uji.forEach((k) => {
    const a = v2.snrTouchH4M5(h4, k);
    const b = ag.sentuhZonaSnr(BAR, { o: k.open, h: k.high, l: k.low, c: k.close });
    if (a) adaSentuh++;
    const cocok = (!a && !b) || (a && b && a.sisi === b.sisi && a.arah === b.arah
                  && dekat(a.level, b.level) && a.tolak === b.tolak && dekat(a.tol, b.tol));
    if (!cocok) beda++;
  });
  cek('sentuhan zona sama di ' + uji.length + ' candle (' + adaSentuh + ' menyentuh)', beda === 0);
}

// 7. SL dari zona
{
  let beda = 0;
  const a14 = v2.atr(highs, lows, closes, 14);
  const aNow = a14[a14.length - 1];
  [80, 100, 120, 150].forEach((harga) => {
    ['BUY', 'SELL'].forEach((arah) => {
      const a = v2.slFromSnrZone(arah, harga, highs, lows, aNow);
      const b = ag.slDariZonaSnr(arah, harga, BAR, aNow);
      if (!dekat(a, b, 1e-9)) beda++;
    });
  });
  cek('SL dari zona sama di 8 kombinasi harga x arah', beda === 0);
}

// 8. Pencerminan: yang dibalik HANYA sisinya, bukan ukurannya
{
  const entry = 100, sl = 96, tp = 104;
  const slB = 2 * entry - sl, tpB = 2 * entry - tp;
  cek('cermin: jarak SL tetap sama', dekat(Math.abs(entry - sl), Math.abs(entry - slB)));
  cek('cermin: jarak TP tetap sama', dekat(Math.abs(entry - tp), Math.abs(entry - tpB)));
  cek('cermin: SL pindah ke seberang', (sl < entry) !== (slB < entry));
  cek('cermin: RR tetap 1:1',
      dekat(Math.abs(tpB - entry) / Math.abs(slB - entry), Math.abs(tp - entry) / Math.abs(sl - entry)));
}

console.log('\n' + lulus + ' lulus, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
