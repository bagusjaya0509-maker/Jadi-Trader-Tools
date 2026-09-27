

const HL = 'https://api.hyperliquid.xyz/info';

export const TRIO = ['BTC', 'ETH', 'SOL'];

export const KOIN_LAYAR = ['HYPE', 'BNB', 'XRP', 'DOGE', 'LINK', 'AVAX',
  'LTC', 'SUI', 'AAVE', 'ZEC', 'FARTCOIN', 'ENA', 'INJ', 'NEAR'];

export const KOIN_PILIHAN = [...TRIO, ...KOIN_LAYAR];

export const TF = [
  {id: '1m', label: '1m', menit: 1},
  {id: '5m', label: '5m', menit: 5},
  {id: '15m', label: '15m', menit: 15},
  {id: '1h', label: '1H', menit: 60},
  {id: '4h', label: '4H', menit: 240},
  {id: '1d', label: '1D', menit: 1440},
];
export const TF_BAWAAN = '1m';
const menitTf = (tf) => (TF.find(t => t.id === tf) || TF[0]).menit;

export const pasar = Object.create(null);
export const kabar = {pasarHidup: false, galat: null, diperbarui: 0, kartuGalat: null, sinyalGalat: null, analisDiperbarui: 0};

export const kunciPasar = (koin, tf) => koin + '|' + tf;

async function tanya(isi) {
  const r = await fetch(HL, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(isi), signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('hyperliquid ' + r.status);
  return r.json();
}

async function muatLilin(koin, tf) {
  const kini = Date.now(), m = menitTf(tf);
  const d = await tanya({type: 'candleSnapshot', req: {
    coin: koin, interval: tf, startTime: kini - 60 * m * 60000, endTime: kini,
  }});
  const lilin = (d || []).slice(-56).map(c => ({
    t: c.t, o: +c.o, h: +c.h, l: +c.l, c: +c.c, v: +c.v || 0,
  })).filter(c => isFinite(c.c) && c.c > 0);
  if (!lilin.length) throw new Error('lilin kosong: ' + koin + ' ' + tf);
  const k = kunciPasar(koin, tf);
  const p = pasar[k] || (pasar[k] = {koin, tf});
  p.lilin = lilin;
  p.harga = lilin[lilin.length - 1].c;
  p.awal = lilin[0].o;p.receivedAt=Date.now();p.priceAt=Date.now();
  if (!isFinite(p.tampil)) p.tampil = p.harga;
  kabar.pasarHidup = true;
  kabar.diperbarui = Date.now();
}

async function tarikHarga() {
  const mids = await tanya({type: 'allMids'});
  for (const p of Object.values(pasar)) {
    const v = +mids[p.koin];
    if (!isFinite(v) || !v || !p.lilin) continue;
    p.harga = v;p.priceAt=Date.now();
    const bucket=Math.floor(Date.now()/(menitTf(p.tf)*60000))*menitTf(p.tf)*60000;
    const last=p.lilin[p.lilin.length-1];
    if(bucket>last.t){p.lilin.push({t:bucket,o:last.c,h:v,l:v,c:v,v:0});if(p.lilin.length>56)p.lilin.shift();}
    const akhir = p.lilin[p.lilin.length - 1];
    akhir.c = v;
    if (v > akhir.h) akhir.h = v;
    if (v < akhir.l) akhir.l = v;
  }
  kabar.diperbarui = Date.now();
}

export function langgan(koin, tf = TF_BAWAAN) {
  const k = kunciPasar(koin, tf);
  if (!pasar[k]) {
    pasar[k] = {koin, tf};
    if(jalan)queueCandles();
  }
  return k;
}

let jalan=false,refreshBusy=false;
async function queueCandles(){
  if(refreshBusy)return;
  refreshBusy=true;
  try{
    const list=Object.values(pasar);
    for(let i=0;i<list.length;i+=4)
      await Promise.all(list.slice(i,i+4).map(p=>muatLilin(p.koin,p.tf).catch(e=>{kabar.galat=e.message;})));
    kabar.pasarHidup=statusPasar().live;
  }finally{refreshBusy=false;}
}
export async function mulaiPasar(){
  if(jalan)return;jalan=true;
  void queueCandles();
  setInterval(()=>{if(!document.hidden)void queueCandles();},60000);
  let priceBusy=false;
  setInterval(async()=>{
    if(priceBusy||document.hidden)return;priceBusy=true;
    try{await tarikHarga();kabar.galat=null;}catch(e){kabar.galat=e.message;}
    finally{priceBusy=false;}
  },3000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void queueCandles();});
}
export function segar(koin,tf=TF_BAWAAN){
  const p=pasar[kunciPasar(koin,tf)];
  return !!(p?.lilin?.length&&Date.now()-p.receivedAt<150000&&Date.now()-p.priceAt<30000);
}
export function statusPasar(){
  const list=Object.values(pasar),ready=list.filter(p=>p.lilin?.length);
  return {any:ready.length>0,live:list.length>0&&list.every(p=>segar(p.koin,p.tf))};
}

export function detak(dt) {
  for (const p of Object.values(pasar)) {
    if (!isFinite(p.harga)) continue;
    if (!isFinite(p.tampil)) { p.tampil = p.harga; continue; }
    p.tampil += (p.harga - p.tampil) * Math.min(1, dt * 3.2);
  }
}

export function deret(koin, tf = TF_BAWAAN, jumlah = 48) {
  const p = pasar[kunciPasar(koin, tf)];
  if (!p || !p.lilin || p.lilin.length < 6) return null;
  const potong = p.lilin.slice(-jumlah);
  const puncak = Math.max(...potong.map(c => c.v)) || 1;
  return potong.map(c => ({
    open: c.o, high: c.h, low: c.l, close: c.c,
    volume: 1.5 + (c.v / puncak) * 7, t: c.t,
  }));
}

export function harga(koin, tf = TF_BAWAAN) {
  const p = pasar[kunciPasar(koin, tf)];
  return p && isFinite(p.tampil) ? p.tampil : null;
}

export function ubah(koin, tf = TF_BAWAAN) {
  const p = pasar[kunciPasar(koin, tf)];
  if (!p || !isFinite(p.harga) || !p.awal) return null;
  return (p.harga - p.awal) / p.awal * 100;
}

export function angka(v) {
  if (v === null) return '—';
  const desimal = v >= 1000 ? 2 : v >= 10 ? 3 : 4;
  return v.toLocaleString('en-US', {minimumFractionDigits: desimal, maximumFractionDigits: desimal});
}

export function jam(d = new Date()) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// Embedded on JadiTrader, use its own public routes. The hosted room uses
// its read-only server bridge, since the public API doesn't return CORS headers.
const onJadiTrader=/^(www\.)?jaditrader\.co\.id$/.test(location.hostname);
export const DASAR=onJadiTrader?'':'https://jaditrader.co.id';
async function ambilJson(jalur){
  const endpoint=onJadiTrader?jalur:jalur==='/api/analisa/performa'?'/api/jaditrader/performa':'/api/jaditrader/analisa';
  const r=await fetch(endpoint,{signal:AbortSignal.timeout(12000),credentials:'omit'});
  if(!r.ok)throw new Error('Data JadiTrader sementara tidak tersedia');
  return r.json();
}

const SIMPAN_SINYAL = 3 * 60000;
let sinyalCache = null, sinyalWaktu = 0;

async function sinyalHidup() {
  if (sinyalCache && Date.now() - sinyalWaktu < SIMPAN_SINYAL) return sinyalCache;
  const d = await ambilJson('/api/analisa');
  const peta = new Map();
  for (const x of (d.daftar || [])) {
    if (x.hasil || !x.uid) continue;
    const daftar = peta.get(x.uid) || [];
    daftar.push({
      pasangan: x.pasangan || '', arah: String(x.arah || '').toUpperCase(),
      tf: x.tf || '', pasar: x.pasar || '', dibuat: Number(x.dibuat) || 0,
      terisi: !!x.terisi,
    });
    peta.set(x.uid, daftar);
  }
  for (const daftar of peta.values()) daftar.sort((a, b) => b.dibuat - a.dibuat);
  sinyalCache = peta; sinyalWaktu = Date.now();
  return peta;
}

async function pnlBerjalan() {
  if (typeof window.RUANG_TOKEN !== 'function') return null;
  try {
    const token = await window.RUANG_TOKEN();
    if(!token)return null;
    const r = await fetch(DASAR + '/api/ruang/potret', {headers: {authorization: 'Bearer ' + token},signal:AbortSignal.timeout(8000)});
    if (!r.ok) return null;
    const d = await r.json();
    const kartu = (d.potret && d.potret.kartu) || [];
    const peta = new Map();
    for (const k of kartu) if (k.nama) peta.set(k.nama, Number(k.berjalan) || 0);
    return peta.size ? peta : null;
  } catch { return null; }
}

export async function daftarAnalis() {
  const [perf, hidup, berjalan] = await Promise.all([
    ambilJson('/api/analisa/performa'),
    sinyalHidup().then(d=>{kabar.sinyalGalat=null;return d;}).catch(e=>{kabar.sinyalGalat=e.message;return sinyalCache;}),
    pnlBerjalan(),
  ]);
  if (perf.contoh) throw new Error('papan peringkat sedang memulangkan data contoh');
  if(!Array.isArray(perf.analis))throw new Error('Format data analis belum tersedia');
  const layak = perf.analis.filter(a => a.layak);
  kabar.analisDiperbarui=Date.now();

  return layak
    .map(a => ({
      uid: a.uid, nama: a.nama || 'Analis', agen: !!a.agen,
      pnl: Number(a.hasilDolar) || 0,
      menang: Number(a.menang) || 0, kalah: Number(a.kalah) || 0,
      total: Number(a.total) || 0, winrate: Number(a.winrate) || 0,
      dd: Number(a.ddPersen) || 0, terakhir: Number(a.terakhir) || 0,
      sinyal: hidup?.get(a.uid) || [], sinyalDiketahui:!!hidup,

      berjalan: berjalan && berjalan.has(a.nama) ? berjalan.get(a.nama) : null,
    }))
    .sort((x, y) => y.pnl - x.pnl);
}

export function uang(v, tanda = true) {
  const n = Number(v) || 0;
  const s = Math.abs(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return (tanda ? (n > 0 ? '+$' : n < 0 ? '−$' : '$') : '$') + s;
}
