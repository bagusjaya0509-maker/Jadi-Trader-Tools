/* ════════════════════════════════════════════════════════════════════════
   jt-scan-core.js — JANGAN DIEDIT LANGSUNG.

   File ini DIBUAT OTOMATIS dari ema-cross-screener_3.html oleh
   buat-scan-core.js. Semua isinya adalah salinan persis fungsi perhitungan
   milik screener, supaya halaman mobile memakai logika yang sama dan tidak
   bisa menyimpang diam-diam.

   Kalau logika di screener berubah, jalankan lagi:  node buat-scan-core.js
   Dibuat: 2026-08-01T00:51:58.617Z
   ════════════════════════════════════════════════════════════════════════ */
window.JTScan = (function(){
  "use strict";
  const SMI_K = 14, SMI_D = 3, SMI_EMA = 3;
  
  const SMI_OB = 50, SMI_OS = -50;   // ambang overbought / oversold
  
  const PC_SIG_TOL_MULT = 0.6;   // toleransi sentuh garis channel (x ATR)
  
  const PC_SIG_SCANBACK = 200;   // sejauh mana ke belakang dicek sentuhan (Pine: pcSigScanBack)
  
  const PC_SIG_FRESH    = 2;     // sinyal boleh muncul kalau sentuhan garis terjadi di candle
  
  function pcUpperAt(ch, b){ return ch.upperXp1 + ch.slope*(b - ch.xb1); }
  
  function pcLowerAt(ch, b){ return ch.lowerXp1 + ch.slope*(b - ch.xb1); }
  
   function fmtPrice(p){
    if(typeof p !== 'number' || !isFinite(p)) return '—';
    if(p >= 100) return p.toFixed(2);
    if(p >= 1) return p.toFixed(4);
    return p.toPrecision(4);
  }
  
   function ema(values, period){
    const k = 2/(period+1);
    const out = [values[0]];
    for(let i=1;i<values.length;i++){
      out.push(values[i]*k + out[i-1]*(1-k));
    }
    return out;
  }
  
   function stochastic(highs, lows, closes, kPeriod, smoothK, dPeriod){
    const rawK = new Array(closes.length).fill(null);
    for(let i=kPeriod-1;i<closes.length;i++){
      let hh = -Infinity, ll = Infinity;
      for(let j=i-kPeriod+1;j<=i;j++){
        if(highs[j]>hh) hh = highs[j];
        if(lows[j]<ll) ll = lows[j];
      }
      const range = hh-ll;
      rawK[i] = range===0 ? 50 : ((closes[i]-ll)/range)*100;
    }
    const k = smoothSeries(rawK, smoothK);
    const d = smoothSeries(k, dPeriod);
    return { k, d };
  }
  
  function smiSeries(highs, lows, closes, lengthK, lengthD, lengthEMA){
    const n = closes.length;
    const relRange = new Array(n).fill(null);
    const hlRange  = new Array(n).fill(null);
    for(let i=lengthK-1;i<n;i++){
      let hh=-Infinity, ll=Infinity;
      for(let j=i-lengthK+1;j<=i;j++){
        if(highs[j]>hh) hh=highs[j];
        if(lows[j]<ll)  ll=lows[j];
      }
      relRange[i] = closes[i] - (hh+ll)/2;
      hlRange[i]  = hh-ll;
    }
    // EMA di file ini tidak mengenal null, jadi warm-up-nya dipotong dulu lalu
    // hasilnya dikembalikan ke posisi index semula.
    const mulai = lengthK-1;
    if(mulai >= n) return { smi:new Array(n).fill(null), signal:new Array(n).fill(null) };
    const emaEma = arr => ema(ema(arr, lengthD), lengthD);
    const numer = emaEma(relRange.slice(mulai));
    const denom = emaEma(hlRange.slice(mulai));
    const inti  = numer.map((v,i)=> denom[i]===0 ? 0 : 200*(v/denom[i]));
    const sig   = ema(inti, lengthEMA);
    const smi=new Array(n).fill(null), signal=new Array(n).fill(null);
    for(let i=0;i<inti.length;i++){ smi[mulai+i]=inti[i]; signal[mulai+i]=sig[i]; }
    return { smi, signal };
  }
  
   function smiConditionOf(value){
    if(value===null || value===undefined) return 'neutral';
    if(value >= SMI_OB) return 'overbought';
    if(value <= SMI_OS) return 'oversold';
    return 'neutral';
  }
  
   function atr(highs, lows, closes, period){
    const n = closes.length;
    const tr = new Array(n).fill(0);
    for(let i=0;i<n;i++){
      if(i===0){ tr[i] = highs[i]-lows[i]; continue; }
      tr[i] = Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1]));
    }
    const out = new Array(n).fill(null);
    if(n <= period) return out;
    let sum = 0;
    for(let i=1;i<=period;i++) sum += tr[i];
    out[period] = sum/period;
    for(let i=period+1;i<n;i++){
      out[i] = (out[i-1]*(period-1)+tr[i])/period;
    }
    return out;
  }
  
   function findPivots(values, left, right, isHigh){
    const pivots = [];
    for(let i=left; i<values.length-right; i++){
      let isPivot = true;
      for(let j=i-left;j<=i+right;j++){
        if(j===i) continue;
        if(isHigh ? values[j] > values[i] : values[j] < values[i]){ isPivot = false; break; }
      }
      if(isPivot) pivots.push({ index: i, value: values[i] });
    }
    return pivots;
  }
  
  function detectParallelChannel(highs, lows, closes, atrArr, opt){
    opt = opt || {};
    const left = opt.left||5, right = opt.right||5, lookback = opt.lookback||150;
    const minTouches = opt.minTouches||2, minMid = opt.minMid||2, tolMult = opt.tolMult||0.5;
    const n = closes.length;
    const endBar = (opt.endBar!=null ? opt.endBar : n-1);
    if(endBar < left+right+5) return null;
    const atrE = atrArr[endBar];
    if(atrE==null || !(atrE>0)) return null;
    const tol = atrE * tolMult;
    const phBars=[], phPrices=[], plBars=[], plPrices=[];
    const startScan = Math.max(left, endBar - lookback);
    for(let p=startScan; p<=endBar-right; p++){
      let isH=true, isL=true;
      for(let j=p-left; j<=p+right; j++){
        if(j===p) continue;
        // LOOSE spt ta.pivothigh/pivotlow Pine: hanya tetangga yang BENAR-BENAR lebih
        // tinggi/rendah yang membatalkan pivot; nilai seri (tie) tetap dihitung pivot.
        // Diverifikasi vs label Pine asli (CHZ 15m & ARB 1H) - versi strict meleset.
        if(highs[j] > highs[p]) isH=false;
        if(lows[j]  < lows[p])  isL=false;
      }
      if(isH){ phBars.push(p); phPrices.push(highs[p]); }
      if(isL){ plBars.push(p); plPrices.push(lows[p]); }
    }
    let uptrend=false, downtrend=false;
    if(plPrices.length>=2) uptrend = plPrices[plPrices.length-1] > plPrices[plPrices.length-2];
    if(phPrices.length>=2) downtrend = phPrices[phPrices.length-1] < phPrices[phPrices.length-2];
    const useHigh = downtrend || !uptrend;
    const aBars   = useHigh ? phBars   : plBars;
    const aPrices = useHigh ? phPrices : plPrices;
    const anchorSeries = useHigh ? highs : lows;
    const oppSeries    = useHigh ? lows  : highs;
    if(aBars.length < 3) return null;
    let bestI=-1, bestJ=-1, bestTouches=-1;
    for(let j=aBars.length-1; j>=2; j--){
      for(let i=j-1; i>=0; i--){
        const b1=aBars[i], p1=aPrices[i], b2=aBars[j], p2=aPrices[j];
        if(b2===b1) continue;
        const slope=(p2-p1)/(b2-b1);
        let valid=true, touches=0;
        for(let k=b1; k<=endBar; k++){
          const v = anchorSeries[k];
          const lineVal = p1 + slope*(k-b1);
          const diff = useHigh ? (v - lineVal) : (lineVal - v);
          if(diff > tol) valid=false;
          if(Math.abs(v-lineVal) <= tol) touches++;
        }
        if(valid && touches>=minTouches && touches>bestTouches){ bestTouches=touches; bestI=i; bestJ=j; }
      }
    }
    if(bestI<0) return null;
    const xb1=aBars[bestI], xp1=aPrices[bestI];
    const xslope=(aPrices[bestJ]-xp1)/(aBars[bestJ]-xb1);
    let extreme = useHigh ? 10e10 : -10e10, extBar=xb1;
    for(let k=xb1; k<=endBar; k++){
      if(useHigh ? oppSeries[k]<extreme : oppSeries[k]>extreme){ extreme=oppSeries[k]; extBar=k; }
    }
    const projAtExt = xp1 + xslope*(extBar-xb1);
    let bestOffset = useHigh ? (projAtExt - extreme) : (extreme - projAtExt);
    let bestOffsetTouches=-1, bestOffsetC=null, bestOffsetCTouches=-1;
    for(let k=xb1; k<=endBar; k++){
      const projAtK = xp1 + xslope*(k-xb1);
      const candOffset = useHigh ? (projAtK - oppSeries[k]) : (oppSeries[k] - projAtK);
      let valid2=true, touches2=0, touchesMid=0;
      for(let m=xb1; m<=endBar; m++){
        const om = oppSeries[m];
        const anchorAtM = xp1 + xslope*(m-xb1);
        const oppAtM = useHigh ? (anchorAtM - candOffset) : (anchorAtM + candOffset);
        const diff2 = useHigh ? (om - oppAtM) : (oppAtM - om);
        if(diff2 < -tol) valid2=false;
        if(Math.abs(om-oppAtM) <= tol) touches2++;
        const midAtM = (anchorAtM + oppAtM)/2;
        if(Math.abs(closes[m]-midAtM) <= tol) touchesMid++;
      }
      if(valid2 && touches2>bestOffsetTouches){ bestOffsetTouches=touches2; bestOffset=candOffset; }
      if(valid2 && touchesMid>=minMid && touches2>bestOffsetCTouches){ bestOffsetCTouches=touches2; bestOffsetC=candOffset; }
    }
    const offset = (bestOffsetC==null) ? bestOffset : bestOffsetC;
    return { slope:xslope, xb1, upperXp1: useHigh ? xp1 : xp1+offset, lowerXp1: useHigh ? xp1-offset : xp1 };
  }
  
  function pivotConfirmBarsDesc(highs, lows, from, left, right, maxN){
    const out = [];
    for(let p = from - right; p >= left && out.length < maxN; p--){
      let isH=true, isL=true;
      for(let j=p-left; j<=p+right; j++){
        if(j===p) continue;
        if(highs[j] > highs[p]) isH=false;
        if(lows[j]  < lows[p])  isL=false;
      }
      if(isH || isL) out.push(p + right);
    }
    return out;
  }
  
  async function mapLimited(items, limit, fn){
    const results = new Array(items.length);
    let next = 0;
    async function worker(){
      while(next < items.length){
        const i = next++;
        try{ results[i] = { status:'fulfilled', value: await fn(items[i], i) }; }
        catch(e){ results[i] = { status:'rejected', reason: e }; }
      }
    }
    const pool = [];
    for(let w = 0; w < Math.min(limit, items.length); w++) pool.push(worker());
    await Promise.all(pool);
    return results;
  }

  return {
    fmtPrice: fmtPrice, ema: ema, stochastic: stochastic,
    smiSeries: smiSeries, smiConditionOf: smiConditionOf,
    atr: atr, findPivots: findPivots,
    detectParallelChannel: detectParallelChannel,
    pivotConfirmBarsDesc: pivotConfirmBarsDesc,
    pcUpperAt: pcUpperAt, pcLowerAt: pcLowerAt,
    mapLimited: mapLimited,
    SMI_K: SMI_K, SMI_D: SMI_D, SMI_EMA: SMI_EMA,
    SMI_OB: SMI_OB, SMI_OS: SMI_OS,
    PC_SIG_TOL_MULT: PC_SIG_TOL_MULT,
    PC_SIG_SCANBACK: PC_SIG_SCANBACK,
    PC_SIG_FRESH: PC_SIG_FRESH
  };
})();
