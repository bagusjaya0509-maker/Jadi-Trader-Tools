/* ════════════════════════════════════════════════════════════════════════
   MOMENTUM CANDLE SEKOLAH TRADING — versi yang jalan di mesin Pine aplikasi
   ════════════════════════════════════════════════════════════════════════
   Skrip aslinya (Riski Aditama / Sekolah Trading) ditulis untuk TradingView
   dan DISERTAKAN UTUH sebagai berkas unduhan produk. Yang di bawah ini versi
   yang dipasang tombol "Pasang di Chart" — aturannya sama, tapi tiga hal
   diubah karena kalau tidak, ia tidak menggambar apa pun di sini:

   1. AMBANG BADAN: pip per pair -> kelipatan ATR(14).
      Aslinya memakai tabel pip per pasangan (XAUUSD 45 pip di M15, USDJPY 15,
      dst) dan MENGUNCI diri pada nama pair persis. Chart aplikasi ini memakai
      simbol seperti BTCUSDT dan XAUUSDc, jadi tabel itu tidak pernah cocok
      dan `minRange` tetap `na` — chart kosong melompong, dan yang memasang
      akan mengira indikatornya rusak.

      0,46xATR bukan angka baru: ia hasil kalibrasi dari pip aslinya, dan
      terbukti hampir identik. Di gold M15, ATR14 = 10,14 USD, jadi
      0,46xATR = 4,7 USD lawan 45 pip x 0,1 = 4,5 USD. Mode "Pip manual"
      tetap disediakan untuk yang mau angka persis videonya.

   2. FILTER EMA: request.security() dibuang, EMA dihitung di TF chart.
      Mesin Pine di sini MENJALANKAN request.security() di timeframe chart,
      bukan timeframe yang diminta — jadi "EMA H1" di chart M15 akan diam-
      diam memberi EMA M15. Angka yang salah tanpa satu pun galat lebih buruk
      daripada fitur yang tidak ada, jadi pilihan TF-nya dihapus dan
      keterangannya ditulis apa adanya.

   3. table.new / alertcondition DIBUANG.
      Keduanya dilewati diam-diam oleh mesin ini. Label tren diganti garis
      EMA yang benar-benar tergambar; alert tidak punya padanan di sini.

   Diuji langsung di chart XAUUSDc M15 pada 25 Agu 2026: penanda BUY/SELL
   tergambar, garis EMA tergambar, dan menyalakan validasi konsolidasi
   memang menyaring sinyal — termasuk perulangan `for` dengan indeks
   variabel, yang paling rawan tidak didukung.
   ════════════════════════════════════════════════════════════════════════ */

export const MOMENTUM_CANDLE_PINE = `//@version=6
indicator("Momentum Candle Sekolah Trading", overlay=true)

// ===== 1. Mode candle =====
modeCandle = input.string("Agresif", "Mode Candle", options=["Agresif", "Konservatif"])

// ===== 2. Ambang badan =====
modeAmbang = input.string("ATR otomatis", "Ukur badan dengan", options=["ATR otomatis", "Pip manual"])
atrKali = input.float(0.46, "Badan minimal x ATR(14)", minval=0.05, maxval=5)
pipMin = input.float(45, "Badan minimal (pip)", minval=1)
pipNilai = input.float(0.1, "Nilai 1 pip", minval=0.00001)

// ===== 3. Validasi ekor =====
wickPct = input.float(30.0, "Max ekor persen dari total candle", minval=1, maxval=99)

// ===== 4. Validasi konsolidasi =====
useKons = input.bool(false, "Aktifkan validasi konsolidasi")
konsCount = input.int(3, "Jumlah candle konsolidasi", minval=1, maxval=10)

// ===== 5. Filter tren EMA =====
useEMA = input.bool(false, "Aktifkan filter tren EMA")
emaLen = input.int(50, "EMA period", minval=1)

// ===== 6. Struktur candle =====
totalRange = math.abs(close - open)
upperWick = high - math.max(open, close)
lowerWick = math.min(open, close) - low
totalWick = upperWick + lowerWick

minRange = modeAmbang == "ATR otomatis" ? ta.atr(14) * atrKali : pipMin * pipNilai

// ===== 7. Validasi candle =====
isBigCandle = totalRange >= minRange
isWickOk = (totalWick / (totalRange + totalWick)) <= (wickPct / 100)
isBullish = close > open
isBearish = close < open

isBullishValid = isBullish and lowerWick < upperWick
isBearishValid = isBearish and upperWick < lowerWick

agresif = modeCandle == "Agresif"
bullSignal = isBigCandle and isWickOk and (agresif ? isBullish : isBullishValid)
bearSignal = isBigCandle and isWickOk and (agresif ? isBearish : isBearishValid)

// ===== 8. Konsolidasi =====
isKonsValid = true
if useKons
    allSmall = true
    for i = 1 to konsCount
        prevBody = math.abs(close[i] - open[i])
        if prevBody >= totalRange
            allSmall := false
    isKonsValid := allSmall

bullSignal := bullSignal and isKonsValid
bearSignal := bearSignal and isKonsValid

// ===== 9. Filter tren EMA =====
emaValue = ta.ema(close, emaLen)
if useEMA
    bullSignal := bullSignal and close > emaValue
    bearSignal := bearSignal and close < emaValue

plot(useEMA ? emaValue : na, title="EMA tren", color=color.new(color.gray, 30), linewidth=1)

// ===== 10. Penanda =====
plotshape(bullSignal, location=location.belowbar, style=shape.triangleup, color=color.new(color.blue, 0), size=size.small, text="BUY")
plotshape(bearSignal, location=location.abovebar, style=shape.triangledown, color=color.new(color.red, 0), size=size.small, text="SELL")
`;
