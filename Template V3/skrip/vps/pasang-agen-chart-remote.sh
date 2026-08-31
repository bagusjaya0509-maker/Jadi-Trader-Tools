#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Dijalankan DI VPS. Memasang pemantau multi-ruang + agen pembaca chart,
# membersihkan jejak sumber dari data lama, lalu memastikan hasilnya hidup.
#
# Kalau ADA SATU SAJA langkah yang gagal, semuanya dikembalikan — termasuk
# .env. Setengah terpasang adalah keadaan yang paling sulit dibereskan.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd /root/binance-trading-backend

CAP=$(date +%Y%m%d-%H%M%S)
echo "   cap cadangan: $CAP"
cp pemantau-telegram.js "pemantau-telegram.js.cadangan-$CAP"
cp kartu-agen.js        "kartu-agen.js.cadangan-$CAP"
cp .env                 ".env.cadangan-$CAP"

pulihkan() {
  echo "   ✖ GAGAL — mengembalikan semuanya"
  cp "pemantau-telegram.js.cadangan-$CAP" pemantau-telegram.js
  cp "kartu-agen.js.cadangan-$CAP"        kartu-agen.js
  cp ".env.cadangan-$CAP"                 .env
  rm -f mata-chart.js
  pm2 restart pemantau-telegram --update-env >/dev/null 2>&1 || true
  exit 1
}
trap pulihkan ERR

# ── 1. Berkas baru ────────────────────────────────────────────────────
cp /tmp/agen/pemantau-telegram.js pemantau-telegram.js
cp /tmp/agen/kartu-agen.js        kartu-agen.js
cp /tmp/agen/mata-chart.js        mata-chart.js
# rangkai.js & pasangan-chart.js: dependensi require() pemantau -- tanpa
# keduanya pemantau mati MODULE_NOT_FOUND di VPS yang baru dipasang.
[ -f /tmp/agen/rangkai.js ] && cp /tmp/agen/rangkai.js rangkai.js
[ -f /tmp/agen/pasangan-chart.js ] && cp /tmp/agen/pasangan-chart.js pasangan-chart.js
cp /tmp/agen/bersihkan-jejak.mjs  bersihkan-jejak.mjs

node --check pemantau-telegram.js
node --check kartu-agen.js
node --check mata-chart.js
echo "   sintaks ketiga berkas OK"

# Modulnya benar-benar bisa dimuat, bukan cuma lolos parser.
node -e "
  const k = require('/root/binance-trading-backend/kartu-agen.js');
  const m = require('/root/binance-trading-backend/mata-chart.js');
  if (!k.kirimKartu || !k.layakKartu || !k.daftarHadir) throw new Error('kartu-agen kurang ekspor');
  if (!m.bacaGambarChart || !m.keSinyal || !m.sisaJatah) throw new Error('mata-chart kurang ekspor');
  console.log('   modul termuat · model mata: ' + m.MODEL + ' · jatah ' + m.JATAH_HARIAN + '/hari');
"

# ── 2. Setelan ruang kedua di .env ────────────────────────────────────
# Ditambah HANYA kalau kuncinya belum ada, supaya skrip ini aman diulang
# dan tidak pernah menimpa nilai yang sudah disesuaikan tangan.
tambah() {
  if grep -q "^$1=" .env; then
    echo "   $1 sudah ada — dibiarkan"
  else
    printf '%s=%s\n' "$1" "$2" >> .env
    echo "   + $1"
  fi
}

grep -q '^# ── Ruang kedua' .env || printf '\n# ── Ruang kedua: agen pembaca chart ──\n' >> .env
tambah TG2_GRUP        '-1001749208391'
tambah TG2_TOPIK       'chart'
tambah TG2_TOPIK_ID    '264877'
tambah TG2_HANYA_ADMIN '1'
tambah TG2_AGEN_NAMA   'AI Chart'
tambah TG2_GAMBAR      '1'
tambah TG2_STRATEGI    'Membaca chart yang diposting di ruang analisa tertutup. Zona, SL, dan TP diambil dari label harga yang tercetak di gambarnya; yang cuma bisa ditaksir dari posisi tidak diterbitkan sebagai sinyal.'
tambah TG_GAMBAR_JATAH '40'

# ── 3. Bersihkan jejak sumber dari data lama ──────────────────────────
echo "   ── uji bersih-bersih (belum menulis) ──"
node bersihkan-jejak.mjs --uji
echo "   ── bersih-bersih sungguhan ──"
node bersihkan-jejak.mjs

# ── 4. Nyalakan ulang & buktikan hidup ────────────────────────────────
pm2 restart pemantau-telegram --update-env >/dev/null
sleep 12
# Log DITAMPUNG DULU, tidak disalurkan langsung ke `grep -q`.
# ────────────────────────────────────────────────────────────────────────
# `grep -q` menutup pipanya begitu ketemu, dan pm2 di ujung hulu menerima
# SIGPIPE lalu keluar dengan kode galat. Dengan `set -o pipefail` kode itu
# menjadi kode SELURUH pipa — jadi pemeriksaannya gagal justru ketika
# kalimat yang dicari ADA. Kena betulan 28 Agu 2026: pemasangan yang sudah
# berhasil seluruhnya dikembalikan oleh pemeriksanya sendiri.
LOG=$(pm2 logs pemantau-telegram --lines 40 --nostream 2>/dev/null || true)
if printf '%s' "$LOG" | grep -q "pemantau hidup"; then
  echo "   ✔ pemantau hidup"
else
  echo "   pemantau TIDAK melapor hidup — log terakhir:"
  printf '%s\n' "$LOG" | tail -25
  false
fi

trap - ERR
echo "   ── log nyala ──"
printf '%s\n' "$LOG" | grep -E "memantau|topik|admin|pemantau hidup|terdaftar" | tail -20
rm -rf /tmp/agen
echo "✔ Selesai."
