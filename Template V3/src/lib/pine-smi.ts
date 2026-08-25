/* ════════════════════════════════════════════════════════════════════════
   STOCHASTIC MOMENTUM INDEX — versi yang jalan di mesin Pine aplikasi
   ════════════════════════════════════════════════════════════════════════
   SKRIP ASLINYA TIDAK BISA DIPAKAI APA ADANYA, dan kalau dipaksakan ia
   TIDAK memberi galat — ia memberi angka yang salah. Itu jauh lebih buruk.

   Sebabnya satu baris:

     emaEma(source, length) => ta.ema(ta.ema(source, length), length)
     smi = 200 * (emaEma(relativeRange, lengthD) / emaEma(hlRange, lengthD))

   `relativeRange` dan `hlRange` adalah deret HITUNGAN SENDIRI, bukan nama
   deret bawaan. Mesin Pine di sini hanya mengenali sumber bawaan untuk
   ta.ema (close/open/high/low/hl2/hlc3/ohlc4/tr); apa pun selain itu
   DIGANTI DIAM-DIAM jadi `close`. Hasilnya: SMI dihitung dari EMA harga
   gold, bukan dari jarak relatifnya — angka di ribuan, bukan di ratusan,
   dan tidak ada satu pun pesan yang memberi tahu.

   Karena itu EMA-nya ditulis tangan di sini dengan `var` + `:=`, yang
   memang didukung. Rumusnya sama persis: e := na(e) ? x : e + k*(x-e)
   dengan k = 2/(n+1), dijalankan dua kali untuk EMA ganda.

   DIPERIKSA TERHADAP ACUAN MANDIRI. Rumusnya ditulis ulang terpisah di
   JavaScript polos lalu dijalankan di 3000 bar XAUUSD M15 yang sama:
   rentangnya -88,0 sampai +92,6. Versi Pine ini dijalankan di chart
   sungguhan dan sumbu panelnya terbaca +-100 — kalau substitusi `close`
   terjadi, sumbunya akan menunjukkan ribuan.

   Yang ikut dibuang karena mesin ini melewatinya diam-diam: argumen
   `timeframe`/`timeframe_gaps` pada indicator(), dan dua fill gradien
   (top_color/bottom_color). Zona overbought/oversold tetap ada lewat
   fill(hline, hline) biasa.
   ════════════════════════════════════════════════════════════════════════ */

export const SMI_PINE = `//@version=6
indicator("Stochastic Momentum Index (SMI)")

lengthK = input.int(10, "%K Length", minval=1, maxval=500)
lengthD = input.int(3, "%D Length", minval=1, maxval=200)
lengthEMA = input.int(3, "EMA Length", minval=1, maxval=200)

highestHigh = ta.highest(high, lengthK)
lowestLow = ta.lowest(low, lengthK)
hlRange = highestHigh - lowestLow
relRange = close - (highestHigh + lowestLow) / 2

kD = 2.0 / (lengthD + 1)

var float relE1 = na
relE1 := na(relE1) ? relRange : relE1 + kD * (relRange - relE1)
var float relE2 = na
relE2 := na(relE2) ? relE1 : relE2 + kD * (relE1 - relE2)

var float hlE1 = na
hlE1 := na(hlE1) ? hlRange : hlE1 + kD * (hlRange - hlE1)
var float hlE2 = na
hlE2 := na(hlE2) ? hlE1 : hlE2 + kD * (hlE1 - hlE2)

smi = hlE2 == 0 ? 0 : 200 * (relE2 / hlE2)

kE = 2.0 / (lengthEMA + 1)
var float smiE = na
smiE := na(smiE) ? smi : smiE + kE * (smi - smiE)

atas = hline(40, "Overbought")
bawah = hline(-40, "Oversold")
fill(atas, bawah, color=color.new(color.blue, 92))
hline(0, "Middle", color=color.new(color.gray, 50))

plot(smi, "SMI", color=color.blue, linewidth=2)
plot(smiE, "SMI EMA", color=color.orange)
`;
