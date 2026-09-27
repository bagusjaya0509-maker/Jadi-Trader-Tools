# Trading Floor (trabar2) — kode sumber

Ruang robot trading yang tayang di **`/trabar2/`**, digerbangi kuki `ruang_kunci`
(hanya pemilik). Folder ini berisi **kodenya saja, 422 KB**. Aset beratnya
sengaja tidak ikut — alasannya di bawah, lengkap.

---

## 1. Yang TIDAK ada di sini, dan kenapa

| Folder | Ukuran | Kenapa tidak ikut |
|---|---|---|
| `assets/*.glb`, `*.png` | 68 MB | Model Blender. Isinya berubah hanya kalau modelnya sendiri dibangun ulang — dan itu terjadi di `Kantor 3D/` pada vault, bukan di sini. Riwayat Git untuk berkas biner 21 MB tidak memberi apa pun: `diff`-nya tak terbaca, dan tiap versi disimpan utuh. |
| `musik/*.mp3` | 39 MB | 25 lagu. Tidak pernah disunting, cuma ditambah atau diganti. |
| `vendor/` | 2,6 MB | three.js **r180** apa adanya, tanpa satu pun tambalan. Bisa diambil ulang kapan saja; menyimpannya di repo cuma menggandakan pustaka yang sudah ada rilis resminya. |

Yang **ikut** cuma dua macam: 23 berkas kode, dan 4 berkas JSON tata letak di
`assets/` (77 KB). JSON itu masuk karena ia **bukan aset** — ia data yang
dibaca kode dan pernah disunting tangan: denah lantai, daftar
`replacedObjects`, jaring navigasi robot. Kalau satu angka di dalamnya
bergeser, ruangannya rusak, dan riwayat adalah satu-satunya cara tahu.

Sidik SHA-256 seluruh 62 berkas aset ada di `sidik-aset.txt`, supaya salinan
mana pun bisa dibuktikan sama, bukan diyakini sama.

---

## 2. Berkas hidupnya ada di VPS, dan SENGAJA di luar jangkauan deploy

Yang tayang: **`/root/ruang3d/trabar2/`** pada 103.253.145.38, disajikan
`ruang.js` di backend, bukan Caddy dan bukan `express.static` milik V3.

Ini bukan kebetulan. Dulu ruangan tinggal di `/root/v3/trabar`, ikut disajikan
V3. Workflow `bangun-v3.yml` **menukar seluruh folder** tiap ada push ke
`Template V3/**`:

```
rm -rf /root/v3.lama
mv /root/v3 /root/v3.lama
mv /root/v3.baru /root/v3
```

dan cuma `assets/` yang dibawa masuk. Jadi satu deploy V3 menghapus ruangan
tanpa satu pun pesan galat. **Terjadi 10 Sep 2026**: ruangannya masih terbuka
di layar pemilik dari cache peramban sementara berkasnya sudah tidak ada di
disk. Sesudah itu ia dipindah ke `/root/ruang3d`.

### Karena itu folder ini ada di AKAR repo, bukan di `Template V3/`

`bangun-v3.yml` menyaring:

```yaml
on:
  push:
    paths:
      - 'Template V3/**'
      - 'ema-cross-screener_3.html'
      - '.github/workflows/bangun-v3.yml'
```

`ruang3d/**` tidak cocok dengan satu pun. Jadi menyunting folder ini **tidak
memicu build, tidak memicu scp, dan tidak menyentuh VPS sama sekali.** Ia
arsip dan riwayat, bukan jalur terbitan.

Kalau suatu hari ia dipindah ke `Template V3/public/`, tiga hal terjadi
sekaligus: tarball tiap deploy naik ±105 MB (MP3 dan GLB tak bisa dikompres),
VPS menyimpan dua salinan sekaligus (`/root/v3` dan `/root/v3.lama`, +218 MB),
dan ruangan kembali masuk jangkauan penukaran folder yang dulu menghapusnya.

---

## 3. Cara mengirim perubahan ke yang tayang

Manual, satu berkas, lewat scp:

```
scp -i ~/.ssh/id_jaditrader_deploy main.js root@103.253.145.38:/root/ruang3d/trabar2/
```

Tidak perlu restart apa pun — `express.static` membaca dari disk tiap
permintaan. Header cache-nya sudah diatur `ruang.js`: `no-cache` untuk semua
berkas kode (ETag menjaga jawabannya tetap 304 dan murah), `max-age=604800`
khusus `.glb`. Jadi perubahan langsung terlihat begitu di-refresh, tanpa
menunggu cache kedaluwarsa.

**Cadangkan dulu.** Di VPS ada `/tmp/main.NOL` (keadaan baik yang sudah
terbukti) dan `/tmp/main.bak4` … `/tmp/main.bak10`. `/tmp` hilang saat reboot
— itu sebabnya repo ini dibuat.

---

## 4. Memulihkan dari nol

Kode dari repo ini. **Satu-satunya salinan aset yang lengkap ada di VPS.**

Versi pertama catatan ini (27 Sep 2026, pagi) menulis bahwa
`Template V3/public/3d/trading-floor-v2/` punya GLB dan MP3 yang sama. Itu
SALAH — ditulis tanpa diukur. Diukur beberapa jam kemudian dengan
`sidik-aset.txt`: cuma **24 dari 62** berkas yang sama (vendor/, panorama,
satu JSON). Kelima GLB dan 33 MP3 berbeda atau tidak ada di sana, 103,8 MB.

Jadi sebelum VPS dibuang atau dipindah, tarik dulu `assets/`, `musik/`, dan
`vendor/` dari `/root/ruang3d/trabar2/`, lalu cocokkan dengan
`sidik-aset.txt`. `vendor/` = three.js r180.

---

## 5. Isi kodenya

| Berkas | Isi |
|---|---|
| `main.js` | Inti ruangan, 109 KB: muat GLB, stasiun kerja, robot, lampu, panel pengaturan mutu, kendali area kantor |
| `quality.js` | Tiga profil mutu + lapisan kustom di `localStorage` (`jaditrader-floor-mutu-kustom`) |
| `room-envelope.js` | Selubung ruangan: plafon, 13 RectAreaLight, 4 SpotLight, kaca panorama |
| `morning-render.js` | `InteriorContactPass` (SSAO) + bloom |
| `joget.js` | Animasi joget robot, 32 KB |
| `robot-navigation.js`, `robot-performance.js`, `robot-colors.js` | Jalan, LOD, warna |
| `hidup.js`, `simulation.js`, `market-board.js` | Peristiwa kantor, papan harga |
| `layout-store.js`, `object-transform.js`, `keyboard-ik.js` | Sunting tata letak dari dalam ruangan |
| `warm-look.js`, `window-illusion.js`, `room-refinements.js`, `document-materials.js` | Sentuhan tampilan |
| `musik.js` | Pemutar 25 lagu |
| `index.html`, `style.css`, `tokens.css` | Kerangka & panel |
| `panel.css` | Gaya panel yang dipakai BERSAMA ruangan dan halaman kontrol, plus aturan layar bersih |
| `kendali.js` | Sisi ruangan dari halaman kontrol: layar bersih, cermin panel, menjalankan aksi |
| `kontrol.html`, `kontrol.js`, `kontrol.css` | Halaman kontrol terpisah — dibuka ikon gerigi, jendela sendiri |

---

## 6. Halaman kontrol terpisah (27 Sep 2026)

Layar ruangan bersih dari panel; semua kendali ada di `kontrol.html`,
dibuka ikon gerigi di pojok kanan atas sebagai jendela sendiri — cara yang
sama dengan tombol lepas panel di multi chart. Panelnya TIDAK dipindah:
tetap di `index.html`, disembunyikan, dan halaman kontrol menampilkan
salinannya lewat BroadcastChannel. Klik di sana dijalankan pada elemen
asli di sini. Alasan lengkap di kepala `kendali.js`.

Tombol di ruangan: **K** buka kontrol, **P** panel kembali tampil di layar
ruangan (untuk layar tunggal).

## 7. Dua hal yang masih terbuka (27 Sep 2026)

1. **Tembok melengkung.** Saat batas area kantor diperbaiki, muncul tembok
   besar melengkung yang seharusnya tidak ada. Sudah terbukti berasal dari
   salah satu dari tiga perbaikan itu — dikembalikan ke nol, temboknya
   hilang — tapi yang mana belum diketahui. Ketiganya sekarang dalam keadaan
   dikembalikan.
2. **Garis putih & jendela menggantung** saat satu area disembunyikan. Milik
   selubung, bukan milik kantornya: plafon dibentuk dari denah TERBESAR dan
   tidak tahu ada area yang disembunyikan. Perbaikannya (`aturArea` di
   `room-envelope.js`) ikut dikembalikan karena ia tersangka utama nomor 1.

Aturan yang dipakai sejak pengembalian itu: **satu perubahan, lalu dilihat.**
Bukan karena ekstra hati-hati — tapi karena yang menyunting berkas ini tidak
punya mata di ruangan itu, dan tiga tebakan berturut-turut sudah membuktikan
menebak tidak bekerja.
