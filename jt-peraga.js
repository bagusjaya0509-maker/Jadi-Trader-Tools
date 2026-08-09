/* ══════════════════════════════════════════════════════════════════════════
   jt-peraga.js — mesin animasi peraga cara kerja indikator
   ══════════════════════════════════════════════════════════════════════════
   Dipakai bersama oleh:
     • marketplace.html        (dipajang di detail produk premium)
     • animasi-indikator.html  (untuk direkam jadi berkas video)

   Ditaruh di satu berkas supaya kedua halaman TIDAK PERNAH menampilkan
   animasi yang berbeda. Kalau isinya diubah, keduanya ikut berubah.

   Pemakaian:
     var m = JTPeraga.buat(kanvas);      // kanvas 1280x720
     m.adegan[0].gambar(t);              // t = 0..30 detik
   ══════════════════════════════════════════════════════════════════════════ */
window.JTPeraga = (function(){
"use strict";

var DUR = 30;
var NAMA = ['parallel-channel', 'snr-supply-demand', 'momentum-ema'];
var JUDUL = [
  'Channel digambar dari pivot — sentuh garis bawah lalu close balik ke dalam → BUY',
  'Zona SNR & Supply-Demand — sinyal muncul di sentuhan KEDUA dengan candle penolakan',
  'Momentum & dua EMA — kapan posisi boleh ditahan, kapan harus diamankan'
];

function buat(kanvas){
  var g = kanvas.getContext('2d');
  var W = kanvas.width, H = kanvas.height;

  var WARNA = { bull:'#4f9e82', bear:'#c2544d', gold:'#c9a24b', text:'#ece8de',
                muted:'#9a9ca4', dim:'#63656d', grid:'#1b1e24', biru:'#3b82f6',
                coklat:'#8a5a3a' };

  function jepit(v,a,b){ return v<a?a:(v>b?b:v); }
  function pudar(t,a,b){ return jepit((t-a)/((b-a)||1), 0, 1); }
  function pelan(x){ return x<0.5 ? 2*x*x : 1-Math.pow(-2*x+2,2)/2; }

  function latar(){
    g.fillStyle = '#0b0c0f'; g.fillRect(0,0,W,H);
    g.strokeStyle = WARNA.grid; g.lineWidth = 1;
    for(var y=90; y<H-90; y+=70){ g.beginPath(); g.moveTo(60,y); g.lineTo(W-60,y); g.stroke(); }
  }

  function judul(teks, sub){
    g.textAlign='left'; g.textBaseline='alphabetic';
    g.fillStyle = WARNA.text; g.font = '600 26px "IBM Plex Sans", Arial';
    g.fillText(teks, 56, 56);
    if(sub){
      g.fillStyle = WARNA.dim; g.font = '400 15px "IBM Plex Mono", monospace';
      g.fillText(sub, 56, 82);
    }
  }

  function keterangan(teks, alpha, warna){
    if(alpha <= 0) return;
    g.save(); g.globalAlpha = alpha;
    var tinggi = 66, y = H - tinggi - 30;
    g.fillStyle = 'rgba(21,23,28,.94)';
    g.beginPath();
    if(g.roundRect) g.roundRect(56, y, W-112, tinggi, 12); else g.rect(56, y, W-112, tinggi);
    g.fill();
    g.strokeStyle = warna || '#262a31'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = warna || WARNA.text;
    g.font = '600 21px "IBM Plex Sans", Arial';
    g.textAlign='left'; g.textBaseline='middle';
    g.fillText(teks, 78, y + tinggi/2);
    g.restore();
  }

  function lilin(x, w, yo, yh, yl, yc){
    var naik = yc <= yo;
    g.strokeStyle = naik ? WARNA.bull : WARNA.bear;
    g.fillStyle   = naik ? WARNA.bull : WARNA.bear;
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x, yh); g.lineTo(x, yl); g.stroke();
    var t = Math.min(yo,yc), b = Math.max(yo,yc);
    g.fillRect(x - w/2, t, w, Math.max(2, b-t));
  }

  function garis(x1,y1,x2,y2,warna,tebal,putus){
    g.save();
    g.strokeStyle = warna; g.lineWidth = tebal || 2;
    if(putus) g.setLineDash(putus);
    g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
    g.restore();
  }

  function labelSinyal(x, y, teks, beli){
    g.save();
    g.font = '700 16px "IBM Plex Mono", monospace';
    var w = g.measureText(teks).width + 22, h = 28;
    var ly = beli ? y + 16 : y - 16 - h;
    g.fillStyle = beli ? WARNA.bull : WARNA.bear;
    g.beginPath();
    if(g.roundRect) g.roundRect(x - w/2, ly, w, h, 6); else g.rect(x - w/2, ly, w, h);
    g.fill();
    g.fillStyle = '#fff'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText(teks, x, ly + h/2 + 1);
    g.restore();
  }

  function tandaTeks(x, y, teks, warna, ukuran){
    g.save();
    g.fillStyle = warna; g.font = '600 ' + (ukuran||13) + 'px "IBM Plex Mono", monospace';
    g.textAlign='left'; g.textBaseline='middle';
    g.fillText(teks, x, y);
    g.restore();
  }

  function sorot(x, y, r, warna, alpha){
    g.save(); g.globalAlpha = alpha;
    g.strokeStyle = warna; g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, r, 0, 6.3); g.stroke();
    g.restore();
  }

  /* Deterministik: bentuk lilin selalu sama tiap diputar, jadi hasil
     rekamannya bisa diulang persis. */
  function buatLilin(jalur, amplitudo){
    var out = [], acak = 1;
    function rnd(){ acak = (acak * 1103515245 + 12345) % 2147483648; return acak / 2147483648; }
    for(var i=0;i<jalur.length;i++){
      var o = i ? out[i-1].c : jalur[i];
      var c = jalur[i];
      var a = amplitudo * (0.4 + rnd()*0.9);
      out.push({ o:o, c:c, h:Math.max(o,c)+a, l:Math.min(o,c)-a });
    }
    return out;
  }

  /* ── ADEGAN 1: PARALLEL CHANNEL + DUPLIKAT ────────────────────────── */
  var A1 = (function(){
    var n = 78, slope = 0.42, atas0 = 105.6, lebar = 11.6;
    function atasDi(i){ return atas0 + slope*i; }
    function bawahDi(i){ return atasDi(i) - lebar; }

    // Jalur disusun agar MENYENTUH tiap garis pada waktunya - bukan sekadar
    // "naik terus", supaya peraganya benar-benar menjelaskan.
    var jalur = [];
    for(var i=0;i<n;i++){
      var A = atasDi(i), v;
      if(i < 38)       v = A - 6 + Math.sin(i*0.45)*4.2;
      else if(i <= 45) v = A - 6 - (i-38)*0.78;
      else if(i < 62)  v = A - 11.46 + (i-45)*1.42;
      else             v = A + 11.26 + Math.min(i-61, 13)*0.92;
      jalur.push(v);
    }
    var C = buatLilin(jalur, 1.5);
    var X0 = 96, X1 = W - 210, dx = (X1-X0)/(n-1);
    var pMin = 90, pMax = 168;
    function yOf(p){ return 640 - (p-pMin)/(pMax-pMin) * 520; }
    function xOf(i){ return X0 + i*dx; }

    function pita(i0, i1, geser, alpha, wg, nama){
      g.save(); g.globalAlpha = alpha;
      var ya1 = yOf(atasDi(i0)+geser*lebar), ya2 = yOf(atasDi(i1)+geser*lebar);
      var yb1 = yOf(bawahDi(i0)+geser*lebar), yb2 = yOf(bawahDi(i1)+geser*lebar);
      g.fillStyle = geser===0 ? 'rgba(59,130,246,.07)' : 'rgba(201,162,75,.09)';
      g.beginPath(); g.moveTo(xOf(i0),ya1); g.lineTo(xOf(i1),ya2);
      g.lineTo(xOf(i1),yb2); g.lineTo(xOf(i0),yb1); g.closePath(); g.fill();
      garis(xOf(i0),ya1,xOf(i1),ya2, wg, 2.2);
      garis(xOf(i0),yb1,xOf(i1),yb2, wg, 2.2);
      garis(xOf(i0),(ya1+yb1)/2, xOf(i1),(ya2+yb2)/2, '#787B86', 1.4, [7,6]);
      if(nama) tandaTeks(xOf(i1)+10, (ya2+yb2)/2, nama, wg, 14);
      g.restore();
    }

    return { gambar: function(t){
      latar();
      judul('Auto Parallel Channel', 'XAUUSD · TF 30 menit');

      var tampil = Math.floor(pudar(t,0.4,6.5) * n);
      for(var i=0;i<tampil;i++) lilin(xOf(i), dx*0.62, yOf(C[i].o), yOf(C[i].h), yOf(C[i].l), yOf(C[i].c));

      var aP = pudar(t,5,7.6);
      if(aP > 0){
        g.save(); g.globalAlpha = aP;
        [7,22,37].forEach(function(i){ if(i<tampil){ g.fillStyle=WARNA.bear;
          g.beginPath(); g.arc(xOf(i), yOf(C[i].h), 5, 0, 6.3); g.fill(); } });
        [14,29,45].forEach(function(i){ if(i<tampil){ g.fillStyle=WARNA.bull;
          g.beginPath(); g.arc(xOf(i), yOf(C[i].l), 5, 0, 6.3); g.fill(); } });
        g.restore();
      }

      var aCh = pudar(t,7.5,11);
      if(aCh > 0) pita(4, 7 + (n-8)*pelan(aCh), 0, 1, WARNA.biru, aCh>.95 ? 'Channel Utama' : '');

      if(t > 12.5){
        sorot(xOf(45), yOf(C[45].l), 15, WARNA.bull, pudar(t,12.5,13.6));
        if(t > 13.4){ g.save(); g.globalAlpha = pudar(t,13.4,14.4);
          labelSinyal(xOf(45), yOf(C[45].l), 'BUY', true); g.restore(); }
      }

      var aD1 = pudar(t,17,20);
      if(aD1 > 0) pita(30, n-2, 1, aD1, WARNA.gold, aD1>.9 ? 'Duplikat 1' : '');
      var aD2 = pudar(t,22,25);
      if(aD2 > 0) pita(30, n-2, 2, aD2, WARNA.gold, aD2>.9 ? 'Duplikat 2' : '');

      if(t > 25.5){
        sorot(xOf(74), yOf(C[74].h), 15, WARNA.bear, pudar(t,25.5,26.4));
        if(t > 26.2){ g.save(); g.globalAlpha = pudar(t,26.2,27.2);
          labelSinyal(xOf(74), yOf(C[74].h), 'SELL', false); g.restore(); }
      }

      if(t < 5)        keterangan('Harga bergerak — indikator mencari titik pivot', pudar(t,0.6,1.6));
      else if(t < 7.5) keterangan('Pivot high & pivot low terdeteksi otomatis', pudar(t,5.2,6));
      else if(t < 12.5)keterangan('Dua garis sejajar ditarik dari pivot → Channel Utama', pudar(t,7.8,8.6), WARNA.biru);
      else if(t < 17)  keterangan('Sentuh garis BAWAH lalu close balik ke dalam → sinyal BUY', pudar(t,12.8,13.6), WARNA.bull);
      else if(t < 22)  keterangan('Harga menembus ke atas → Duplikat 1 ditempel di sisi breakout', pudar(t,17.2,18), WARNA.gold);
      else if(t < 25.5)keterangan('Tembus lagi → Duplikat 2, acuan sinyal ikut berpindah', pudar(t,22.2,23), WARNA.gold);
      else             keterangan('Sentuh garis ATAS Duplikat 2 → sinyal SELL', pudar(t,25.8,26.6), WARNA.bear);
    }};
  })();

  /* ── ADEGAN 2: SNR & SUPPLY-DEMAND ────────────────────────────────── */
  var A2 = (function(){
    var jalur = [], n = 78;
    for(var i=0;i<n;i++){
      var v;
      if(i < 14)      v = 140 - i*1.4;
      else if(i < 22) v = 120 + Math.sin((i-14)*0.7)*2.4;
      else if(i < 32) v = 121 + (i-22)*1.5;
      else if(i < 44) v = 136 - (i-32)*1.35;
      else if(i < 52) v = 120 + Math.sin((i-44)*0.8)*2.2;
      else if(i < 68) v = 120 + (i-52)*1.42;
      else            v = 143 - (i-68)*0.9;
      jalur.push(v);
    }
    var C = buatLilin(jalur, 1.4);
    C[52].o = 119; C[52].c = 127; C[52].h = 128; C[52].l = 118.4;   // candle impulsif

    var X0 = 96, X1 = W - 210, dx = (X1-X0)/(n-1);
    var pMin = 108, pMax = 152;
    function yOf(p){ return 630 - (p-pMin)/(pMax-pMin) * 500; }
    function xOf(i){ return X0 + i*dx; }
    var SUP = 119.6, RES = 143.2, TOL = 2.2, DEMAND = 123;

    function zona(nilai, tol, isi, gr, nama, alpha, x0){
      g.save(); g.globalAlpha = alpha;
      var yT = yOf(nilai+tol), yB = yOf(nilai-tol);
      g.fillStyle = isi; g.fillRect(x0, yT, (W-150)-x0, yB-yT);
      g.strokeStyle = gr; g.lineWidth = 1.4; g.strokeRect(x0, yT, (W-150)-x0, yB-yT);
      tandaTeks(x0+10, yT+15, nama, gr, 14);
      g.restore();
    }

    return { gambar: function(t){
      latar();
      judul('Support-Resisten & Supply-Demand', 'XAUUSD · TF 30 menit');

      var tampil = Math.floor(pudar(t,0.4,7) * n);
      for(var i=0;i<tampil;i++) lilin(xOf(i), dx*0.62, yOf(C[i].o), yOf(C[i].h), yOf(C[i].l), yOf(C[i].c));

      var aS = pudar(t,5,7.5);
      if(aS > 0) zona(SUP, TOL, 'rgba(26,58,42,.75)', WARNA.bull, 'S1  Support Zone', aS, xOf(10));
      var aR = pudar(t,8,10.5);
      if(aR > 0) zona(RES, TOL, 'rgba(139,0,0,.4)', WARNA.bear, 'R1  Resistance Zone', aR, xOf(2));

      var aD = pudar(t,11.5,14);
      if(aD > 0){
        g.save(); g.globalAlpha = aD;
        garis(xOf(48), yOf(DEMAND), W-150, yOf(DEMAND), WARNA.coklat, 2);
        tandaTeks(W-146, yOf(DEMAND), 'Demand Zone', WARNA.coklat, 13);
        g.restore();
      }

      if(t > 15){
        sorot(xOf(18), yOf(C[18].l), 14, WARNA.muted, pudar(t,15,15.9));
        g.save(); g.globalAlpha = pudar(t,15,15.9);
        tandaTeks(xOf(18)-46, yOf(C[18].l)+38, 'sentuhan 1 — belum sinyal', WARNA.muted, 13);
        g.restore();
      }
      if(t > 19.5){
        sorot(xOf(48), yOf(C[48].l), 15, WARNA.bull, pudar(t,19.5,20.4));
        if(t > 20.6){ g.save(); g.globalAlpha = pudar(t,20.6,21.5);
          labelSinyal(xOf(48), yOf(C[48].l), 'BUY', true); g.restore(); }
      }
      if(t > 24.5){
        sorot(xOf(68), yOf(C[68].h), 15, WARNA.bear, pudar(t,24.5,25.4));
        if(t > 25.6){ g.save(); g.globalAlpha = pudar(t,25.6,26.5);
          labelSinyal(xOf(68), yOf(C[68].h), 'SELL', false); g.restore(); }
      }

      if(t < 5)         keterangan('Zona dicari dari pivot high & pivot low', pudar(t,0.6,1.6));
      else if(t < 8)    keterangan('Support Zone terbentuk — lebarnya mengikuti ATR', pudar(t,5.2,6), WARNA.bull);
      else if(t < 11.5) keterangan('Resistance Zone di atas — acuan penolakan harga', pudar(t,8.2,9), WARNA.bear);
      else if(t < 15)   keterangan('Candle impulsif meninggalkan jejak: Demand Zone', pudar(t,11.8,12.6), WARNA.coklat);
      else if(t < 19.5) keterangan('Sentuhan pertama ke zona: dicatat, belum jadi sinyal', pudar(t,15.2,16));
      else if(t < 24.5) keterangan('Sentuhan KEDUA + ekor panjang menolak → sinyal BUY', pudar(t,19.8,20.6), WARNA.bull);
      else              keterangan('Ditolak di Resistance Zone → sinyal SELL', pudar(t,24.8,25.6), WARNA.bear);
    }};
  })();

  /* ── ADEGAN 3: MOMENTUM & EMA ─────────────────────────────────────── */
  var A3 = (function(){
    var jalur = [], n = 82;
    for(var i=0;i<n;i++){
      var v;
      if(i < 12)      v = 100 + Math.sin(i*0.6)*1.6;
      else if(i < 18) v = 100 + (i-12)*2.6;
      else if(i < 56) v = 115.6 + (i-18)*0.62 + Math.sin(i*0.5)*1.5;
      else if(i < 66) v = 139 - (i-56)*0.35 + Math.sin(i*0.6)*1.2;
      else            v = 135.5 - (i-66)*1.25;
      jalur.push(v);
    }
    var C = buatLilin(jalur, 1.2);
    C[15].o = 106; C[15].c = 113.6; C[15].h = 114.2; C[15].l = 105.6;

    var X0 = 96, X1 = W - 210, dx = (X1-X0)/(n-1);
    var pMin = 92, pMax = 146;
    function yOf(p){ return 630 - (p-pMin)/(pMax-pMin) * 500; }
    function xOf(i){ return X0 + i*dx; }

    function ema(arr, p){
      var k = 2/(p+1), out = [], e = arr[0];
      for(var i=0;i<arr.length;i++){ e = arr[i]*k + e*(1-k); out.push(e); }
      return out;
    }
    var e9 = ema(jalur, 9), e21 = ema(jalur, 21);

    function garisEma(data, warna, sampai, alpha){
      g.save(); g.globalAlpha = alpha;
      g.strokeStyle = warna; g.lineWidth = 2.4; g.beginPath();
      for(var i=0;i<sampai;i++){
        var x = xOf(i), y = yOf(data[i]);
        if(i===0) g.moveTo(x,y); else g.lineTo(x,y);
      }
      g.stroke(); g.restore();
    }

    return { gambar: function(t){
      latar();
      judul('Momentum Candle & Dua Garis EMA', 'XAUUSD · TF 30 menit');

      var tampil = Math.floor(pudar(t,0.4,7.5) * n);
      for(var i=0;i<tampil;i++) lilin(xOf(i), dx*0.6, yOf(C[i].o), yOf(C[i].h), yOf(C[i].l), yOf(C[i].c));

      var aE = pudar(t,3,6);
      if(aE > 0 && tampil > 2){
        garisEma(e9, WARNA.bull, tampil, aE);
        garisEma(e21, WARNA.bear, tampil, aE);
        g.save(); g.globalAlpha = aE;
        tandaTeks(W-198, yOf(e9[tampil-1]) - 14, 'EMA 9', WARNA.bull, 14);
        tandaTeks(W-198, yOf(e21[tampil-1]) + 18, 'EMA 21', WARNA.bear, 14);
        g.restore();
      }

      if(t > 8){
        g.save(); g.globalAlpha = pudar(t,8,9);
        g.strokeStyle = WARNA.gold; g.lineWidth = 3;
        var yT = yOf(C[15].h), yB = yOf(C[15].l);
        g.strokeRect(xOf(15)-16, yT-8, 32, (yB-yT)+16);
        tandaTeks(xOf(15)+24, yT-18, 'Momentum Candle · body ≥ 70%', WARNA.gold, 14);
        g.restore();
      }

      var aT = pudar(t,13,14.5);
      if(aT > 0){
        g.save(); g.globalAlpha = aT*0.85;
        var x1 = xOf(20), x2 = xOf(Math.min(tampil-1, 55));
        if(x2 > x1){
          g.fillStyle = 'rgba(79,158,130,.10)'; g.fillRect(x1, 128, x2-x1, 492);
          g.strokeStyle = WARNA.bull; g.lineWidth = 1.4; g.setLineDash([8,6]);
          g.strokeRect(x1, 128, x2-x1, 492); g.setLineDash([]);
          g.fillStyle = WARNA.bull; g.font = '600 16px "IBM Plex Mono", monospace';
          g.textAlign='center'; g.textBaseline='top';
          g.fillText('harga DI ATAS kedua EMA → tren kuat, biarkan profit berjalan', (x1+x2)/2, 140);
        }
        g.restore();
      }

      if(t > 23 && tampil > 70){
        sorot(xOf(70), yOf(jalur[70]), 17, WARNA.bear, pudar(t,23,24));
        if(t > 24.5){ g.save(); g.globalAlpha = pudar(t,24.5,25.5);
          labelSinyal(xOf(70), yOf(C[70].h), 'TUTUP', false); g.restore(); }
      }

      if(t < 3)       keterangan('Harga bergerak datar — belum ada dorongan', pudar(t,0.6,1.6));
      else if(t < 8)  keterangan('Dua EMA dipasang: EMA 9 (cepat) & EMA 21 (lambat)', pudar(t,3.2,4));
      else if(t < 13) keterangan('Candle berbadan tebal menembus high sebelumnya → Momentum', pudar(t,8.2,9), WARNA.gold);
      else if(t < 23) keterangan('Selama harga di atas KEDUA EMA → tahan, profit boleh berjalan', pudar(t,13.2,14), WARNA.bull);
      else            keterangan('Close di bawah EMA 21 → dorongan habis, amankan profit', pudar(t,23.2,24), WARNA.bear);
    }};
  })();

  return { adegan: [A1, A2, A3] };
}

return { buat: buat, DUR: DUR, NAMA: NAMA, JUDUL: JUDUL };
})();
