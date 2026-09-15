/* ════════════════════════════════════════════════════════════════════════
   VOLUME PROFILE ORDER BLOCKS — versi yang jalan di mesin Pine aplikasi
   ════════════════════════════════════════════════════════════════════════
   Diturunkan dari "Volume Profile Bar-Magnified Order Blocks" karya
   JacobMagleby (MPL 2.0). SKRIP ASLINYA TIDAK BISA DIPAKAI APA ADANYA —
   mesin menolaknya di deklarasi tipe:

       galat: baris 6: variabel "type" belum didefinisikan

   Dua fondasi skrip asli memang tidak ada di mesin ini:

     • `type orderBlock` + `method` — tipe buatan sendiri. Diganti larik
       sejajar (obTop / obBot / obKiri / obArah / obAktif).
     • `request.security_lower_tf` — sumber profil volumenya. Tidak ada
       padanannya sama sekali.

   ── SATU PERBEDAAN YANG HARUS DIKETAHUI PEMAKAI ─────────────────
   Aslinya menghitung profil volume dari SUB-BAR di dalam satu lilin order
   block (TF chart dibagi 15 lewat request.security_lower_tf). Versi ini
   menghitungnya dari BAR CHART YANG MELINTASI ZONA, sejak order block
   terbentuk sampai bar terakhir.

   Itu bukan pendekatan yang sama, dan tidak disamarkan seolah sama:
   aslinya menjawab "di harga mana volume terkonsentrasi SAAT zona
   terbentuk", versi ini menjawab "di harga mana volume terkonsentrasi
   SELAMA zona itu hidup". Keduanya berguna. Tapi angkanya tidak akan sama
   dengan TradingView, dan itu harus disebut di deskripsi produknya —
   bukan ditemukan sendiri oleh pembeli.

   ── KENAPA DIGAMBAR SEKALI DI BAR TERAKHIR ────────────────────
   Mesin tidak punya `box.set_right`, `box.get_top`, maupun `line.set_x2`
   — kotak dan garis tidak bisa diperbarui sesudah dibuat. Skrip asli
   memperbaruinya tiap bar. Menggambar SEKALI di bar terakhir memberi hasil
   akhir yang sama tanpa satu pun pembaruan.

   ── EMPAT CACAT MESIN YANG DITEMUKAN SAAT MEMPORTING INI ────────
   Keempatnya DIAM — tidak satu pun memberi galat, semuanya cuma membuat
   layar kosong. Diperbaiki bersamaan dengan indikator ini:

     1. `Lilin` tidak membawa volume sama sekali, padahal balasan klines
        selalu mengirimnya di kolom ke-6. Dibuang saat penguraian.
     2. `volume` di mesin Pine dikeraskan `return 0`.
     3. `volume[n]` memulangkan null — volume bukan deret berriwayat,
        sementara `close[n]` normal.
     4. `array.new_float(n, awal)` MENGABAIKAN n dan nilai awal; ia selalu
        memulangkan larik kosong. Terlacak dari `array.size()` yang
        menjawab 1 untuk larik yang diminta 10.

   Tanpa keempatnya, indikator volume apa pun berjalan mulus dan
   menggambar nol kotak.

   Diuji di mesin dengan 400 bar sintetis: 60 kotak (6 blok x 10 grid),
   12 garis, lebar kotak 6..239 bar sebanding volume, tinggi grid seragam
   0,16..0,19.
   ════════════════════════════════════════════════════════════════════════ */

export const VOLUME_OB_PINE = `//@version=5
indicator("Volume Profile Order Blocks", "VP OB", overlay = true, max_boxes_count = 500, max_lines_count = 500)

tuning    = input.int(7, "Panjang dorongan", minval = 3, maxval = 20)
jmlGrid   = input.int(10, "Jumlah grid volume", minval = 3, maxval = 24)
maksBlok  = input.int(6, "Maksimum order block", minval = 1, maxval = 10)
maksPindai = input.int(300, "Bar maksimum dipindai", minval = 20, maxval = 1000)
mitigasi  = input.string("Close 100%", "Metode mitigasi", options = ["Close 100%", "Close 75%", "Close 50%", "Close 25%", "Wick 100%", "Wick 75%", "Wick 50%", "Wick 25%"])
warnaTinggi = input.color(color.new(color.yellow, 30), "Volume tinggi")
warnaRendah = input.color(color.new(color.orange, 70), "Volume rendah")
warnaTepi   = input.color(color.new(color.gray, 60), "Garis tepi")
warnaIsi    = input.color(color.new(color.gray, 85), "Isian zona")

var obTop  = array.new_float(0)
var obBot  = array.new_float(0)
var obKiri = array.new_int(0)
var obArah = array.new_int(0)
var obAktif = array.new_bool(0)

// ── Deteksi order block ────────────────────────────────────────────────
// Lilin asal ada di offset tuning-1. Untuk order block BEARISH ia harus
// naik, lalu seluruh lilin sesudahnya tidak naik. Bullish kebalikannya.
bear = close[tuning - 1] > open[tuning - 1]
bull = close[tuning - 1] < open[tuning - 1]
for i = 0 to tuning - 2
    if close[i] > open[i]
        bear := false
    if close[i] < open[i]
        bull := false

if (bear or bull) and barstate.isconfirmed
    array.push(obTop, high[tuning - 1])
    array.push(obBot, low[tuning - 1])
    array.push(obKiri, bar_index - (tuning - 1))
    array.push(obArah, bull ? 1 : -1)
    array.push(obAktif, true)

// ── Mitigasi ───────────────────────────────────────────────────────────
bagian = mitigasi == "Close 100%" or mitigasi == "Wick 100%" ? 1.0 :
   mitigasi == "Close 75%" or mitigasi == "Wick 75%" ? 0.75 :
   mitigasi == "Close 50%" or mitigasi == "Wick 50%" ? 0.50 : 0.25
pakaiClose = mitigasi == "Close 100%" or mitigasi == "Close 75%" or mitigasi == "Close 50%" or mitigasi == "Close 25%"

if array.size(obAktif) > 0
    for i = 0 to array.size(obAktif) - 1
        if array.get(obAktif, i)
            atas = array.get(obTop, i)
            bawah = array.get(obBot, i)
            arah = array.get(obArah, i)
            tinggi = atas - bawah
            sumber = pakaiClose ? close : (arah == 1 ? low : high)
            batas = arah == 1 ? atas - tinggi * bagian : bawah + tinggi * bagian
            if (arah == 1 and sumber < batas) or (arah == -1 and sumber > batas)
                array.set(obAktif, i, false)

// ── Gambar sekali di bar terakhir ──────────────────────────────────────
// Mesin Pine aplikasi tidak punya box.set_right / line.set_x2, jadi kotak
// dan garis tidak bisa diperbarui sesudah dibuat. Menggambarnya SEKALI di
// bar terakhir memberi hasil yang sama tanpa satu pun pembaruan.
if barstate.islast and array.size(obAktif) > 0
    terpakai = 0
    for j = 0 to array.size(obAktif) - 1
        i = array.size(obAktif) - 1 - j
        if array.get(obAktif, i) and terpakai < maksBlok
            terpakai := terpakai + 1
            atas = array.get(obTop, i)
            bawah = array.get(obBot, i)
            kiri = array.get(obKiri, i)
            lebarBar = bar_index - kiri
            langkah = (atas - bawah) / jmlGrid

            // Volume tiap grid: tiap bar yang melintasi zona menyumbang
            // volumenya sebanding bagian rentangnya yang jatuh di grid itu.
            vol = array.new_float(jmlGrid, 0.0)
            mulai = math.max(0, lebarBar - maksPindai)
            for k = mulai to lebarBar
                off = lebarBar - k
                bh = high[off]
                bl = low[off]
                rentang = bh - bl
                if rentang > 0
                    for g = 0 to jmlGrid - 1
                        gAtas = atas - langkah * g
                        gBawah = atas - langkah * (g + 1)
                        if bl <= gAtas and bh >= gBawah
                            tumpang = math.min(bh, gAtas) - math.max(bl, gBawah)
                            if tumpang > 0
                                array.set(vol, g, array.get(vol, g) + volume[off] * tumpang / rentang)

            volMaks = array.max(vol)
            if volMaks > 0
                line.new(kiri, atas, bar_index, atas, color = warnaTepi, width = 2)
                line.new(kiri, bawah, bar_index, bawah, color = warnaTepi, width = 2)
                for g = 0 to jmlGrid - 1
                    bagianVol = array.get(vol, g) / volMaks
                    if bagianVol > 0.02
                        kananGrid = kiri + math.max(1, math.round(lebarBar * bagianVol))
                        w = bagianVol > 0.66 ? warnaTinggi : warnaRendah
                        box.new(left = kiri, top = atas - langkah * g,
                                right = kananGrid, bottom = atas - langkah * (g + 1),
                                bgcolor = w, border_color = w)

plot(na)
`;
