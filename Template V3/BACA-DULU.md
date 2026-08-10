# Template V3 — Jadi Trader Tools

React + TypeScript + Tailwind v4 + struktur shadcn.
**Tersambung Firebase** (Auth Google + Firestore skema V3) dan **memindai
pasar sungguhan** lewat proxy VPS, sejak 10 Agustus 2026.
Belum tersambung: pengiriman order Binance, MT5.

Langkah rilis & apa yang harus disiapkan sendiri: `Catatan/Panduan Rilis V3.md`.

```bash
npm run dev     # http://localhost:5190
npm run rilis   # bangun + periksa + buka folder yang tinggal diunggah
```

## Dua belas layar

| Rute | Isi |
|---|---|
| `/` | Beranda — hero glassmorphism, tanpa sidebar |
| `#/dashboard` | KPI gabungan, hasil bulanan, saldo lalu vs kini, posisi kripto & MT5 |
| `#/screener` | Pemindaian pasar nyata — Area Pantau + Parallel Signal + 4 KPI + Area Entry |
| `#/chart` | Chart lilin + editor indikator + backtest |
| `#/jurnal` | Equity curve, kalender P/L, riwayat, pola emosi |
| `#/personal` | Pelacak portofolio — pie, perkembangan, arus kas |
| `#/marketplace` | Produk + peraga animasi + ulasan bintang + Discord |
| `#/integrasi` | Connection health, connect MT5 & Binance, tutorial VPS 10 langkah |
| `#/pemilik` | Traffic & Sales + laporan bulanan + kata-kata hari ini |
| `#/maintenance` | Upload/edit/hapus produk, tempat sampah, lisensi |
| `#/tagihan` | Kartu, e-money, perpanjangan otomatis |
| `#/dokumentasi` | 10 bab — mulai cepat, logika sinyal, risiko, keamanan, glosarium |
| `#/changelog` | Rilis terbaru + riwayat rilis, tujuan tombol "Learn more" |

## Keputusan yang perlu diingat

**Ikon koin = monogram bulat berwarna, bukan logo asli.** Mengunduh logo berarti
bergantung pada aset pihak lain yang bisa hilang kapan saja — persis yang baru
terjadi pada gambar latar hero.

**Lilin digambar SVG tangan.** Recharts tidak punya candlestick, dan pustaka
chart keuangan penuh menambah ratusan kilobyte untuk sesuatu yang masih
prototipe.

**Data backtest & lilin memakai seed tetap**, bukan `Math.random`. Kalau
bentuknya berubah tiap refresh, hasil backtest mustahil dibandingkan.

**Di Personal Area hanya pos bertanda `live` yang bergerak.** Saldo bank dan
emas fisik tidak berubah tiap detik; membuat semuanya berkedip akan terlihat
canggih tapi berbohong.

**Billing tidak punya kolom nomor kartu.** Nomor kartu tidak boleh melewati
server kita — saat disambungkan, kolom itu harus datang dari iframe penyedia
pembayaran. Menyimpannya sendiri berarti tunduk PCI-DSS.

**Laci sidebar pakai inline style**, bukan `-translate-x-full`. Tailwind v4
punya shim `*{--tw-translate-x:0}` di blok `@supports` yang bisa mengalahkan
utility itu, dan lacinya tidak pernah menutup di HP.

**Kartu Area Pantau: ada mini chart, TIDAK ada entry/SL/TP.** Grafiknya justru
yang paling berguna — zona SNR cuma bisa dilihat sebagai bentuk. Yang dibuang
angka ordernya: itu daftar pengawasan, dan level di sampingnya membuat koin
yang baru "menarik dilihat" terbaca seperti sudah layak dieksekusi. Parallel
Signal kebalikannya — ada area entry, tanpa grafik.

**Peraga produk pakai animasi CSS, bukan SMIL `<animate>`.** SMIL-nya benar
tapi berhenti diam-diam di sejumlah keadaan tanpa jejak di konsol — persis
laporan "animasinya tidak bergerak". Kelasnya `.peraga-*` di `index.css`.

**Backend URL & App Token disimpan di localStorage**, bukan di server kami.
Menyimpannya di server berarti kami memegang kunci akun Binance orang lain.
`src/lib/koneksi.ts` adalah satu-satunya sumbernya; Screener dan Integrations
membaca dari sana lewat `useKoneksi()`.

**Firestore & Recharts TIDAK boleh masuk jalur muat awal.** Keduanya berjumlah
±240 kB gzip dan hanya dibutuhkan sesudah orang masuk atau membuka halaman
bergrafik. Karena itu `firebase.ts` tidak memanggil `getFirestore`, `auth.tsx`
mengimpornya dinamis, dan hero memakai data pameran + grafik SVG tangan.
Menambahkan satu impor Firestore di berkas jalur-awal mana pun akan
mengembalikan Beranda ke 1,4 MB — periksa dengan `npm run rilis`.

**Halaman memakai bentuk `Trade`/`Posisi`, bukan bentuk Firestore.**
`src/lib/data.ts` yang menerjemahkan. Layar tidak tahu — dan tidak perlu tahu —
apakah datanya dari contoh atau dari server.

**`src/lib/jt-scan-core.ts` adalah SALINAN VERBATIM, jangan ditulis ulang.**
Isinya inti perhitungan milik V2 (SMI, ATR, pivot, parallel channel, sentuhan
SNR, penempatan SL). Kalau V3 menghitungnya sendiri, cepat atau lambat kedua
versi memberi sinyal berbeda untuk koin yang sama dan tidak ada cara tahu mana
yang benar. `src/lib/pindai.ts` hanya mengorkestrasi: ambil data, panggil
rumusnya, susun jadi kartu.

**Kunci localStorage screener SAMA dengan V2** (`emaScreenerFavorites_v1`,
`emaScreenerActiveSymbols_v1`). Koin yang dibintangi di satu versi langsung
terlihat di versi lain. Memakai kunci baru akan membuat keduanya punya daftar
sendiri-sendiri tanpa ada yang memberi tahu.

## Terverifikasi

- `tsc -b --force` bersih · `npm run build` sukses
- **Beranda 466 kB mentah / ±126 kB gzip** (dari 1.388 kB sebelum dipecah).
  Firestore & Recharts baru diunduh saat dashboard dibuka.
- Kedua belas rute tergambar, **0 error runtime**, tanpa geser horizontal
  (diuji 375 px dan desktop)
- **Diuji di subfolder** `/Jadi-Trader-Tools/v3/` seperti GitHub Pages nanti:
  0 berkas gagal muat, refresh di `#/jurnal` tetap jalan
- Hero: badge, judul, deskripsi baru; grafik porto; 2 thn / winrate / PNL;
  marquee 12 ikon koin; kedua tombol nge-link
- Screener: **memindai pasar sungguhan** lewat proxy VPS. Diuji langsung —
  7 sinyal Area Pantau & 5 Parallel dari 40 koin, 112 permintaan, 0 gagal.
  Pantau = mini chart + ceklist (tanpa angka order) · Parallel = ceklist +
  area entry (tanpa grafik) · 4 KPI **di bawah** Parallel Signal
- Bintang, hapus koin, tambah koin: bekerja dan tersimpan (diuji satu per satu)
- Penjaga order: `Open Real Order` tanpa token → alert + tautan `#/integrasi`;
  setelah token disimpan → alert tidak muncul, badge jadi "VPS tersambung"
- Peraga V3: tirai `−420 → 0` px, pemutar `0 → 420` px seiring, badge BUY
  opacity `0 → 1` pada 2,2 s. Nol elemen SMIL tersisa.
- Tutorial VPS: 10 langkah, nama env & header diambil dari `server.js` asli
  (`APP_TOKEN`, `X-App-Token`, `/api/health`, `/api/account`)

## Belum ada — disengaja, bukan terlewat

- **Mesin backtest sungguhan.** Angka hasilnya masih contoh.
- **Penerjemah Pine/MQL5.** Editor sudah ada, penerjemahnya belum.
- **Pengiriman order & MT5.** Data pasar sudah lewat VPS; order belum dikirim.
- **Parser Excel** di Personal Area. Tombolnya ada, pembacanya belum.
- **Tombol "Uji Sambungan" belum memanggil `/api/health`.** Yang sudah nyata:
  URL dan token benar-benar tersimpan dan dibaca penjaga order.
- **Tangkapan layar tutorial digambar SVG**, bukan foto layar asli. Tata letak
  Binance berubah tiap beberapa bulan, dan tangkapan layar terminal sendiri
  hampir selalu memuat sesuatu yang tidak boleh dilihat orang.
- **Traffic & Sales** masih data contoh — butuh rute VPS `/api/kunjungan` dll.
- **Panel simulasi & order sungguhan** belum mengirim ke Binance; tombolnya ada,
  pengirimnya belum.
