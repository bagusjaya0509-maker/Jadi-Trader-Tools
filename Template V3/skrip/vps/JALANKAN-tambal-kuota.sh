#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# TAMBAL KUOTA SINYAL DI VPS — jalankan dari Git Bash di komputer pemilik
# ════════════════════════════════════════════════════════════════════════
# Mengubah penjaga kuota di POST /api/analisa supaya menghitung sinyal AKTIF
# saja. Sinyal yang sudah kena TP/SL/batal berhenti dihitung — ia data
# historis, bukan rencana yang sedang dijual.
#
# AMAN UNTUK DIULANG. Kalau tambalannya sudah terpasang, skrip tambalannya
# berhenti dengan pesan "sudah tertambal" dan server.js tidak disentuh.
#
# URUTAN PENGAMANNYA, dan tidak satu pun boleh dilewati:
#   1. Cadangan bercap waktu dibuat SEBELUM apa pun ditulis.
#   2. `node --check` dijalankan SEBELUM restart. Berkas yang tidak bisa
#      diurai membuat pm2 gagal start dan SELURUH backend mati.
#   3. Hidupnya dibuktikan lewat GET /api/analisa sungguhan, bukan lewat
#      status pm2 — proses yang melempar galat di tiap permintaan tetap
#      dilaporkan "online".
#   4. Gagal di titik mana pun mengembalikan cadangannya, di detik itu juga.
#
# Kalau perlu mundur belakangan:
#   ssh -i ~/.ssh/id_jaditrader_deploy root@103.253.145.38 \
#     'cd /root/binance-trading-backend && cp $(ls -1t server.js.cadangan-* | head -1) server.js && pm2 restart binance-backend'
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

KUNCI="$HOME/.ssh/id_jaditrader_deploy"
VPS="root@103.253.145.38"
SKRIP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tambal-kuota-aktif.mjs"

[ -f "$KUNCI" ] || { echo "✖ Kunci tidak ada: $KUNCI"; exit 1; }
[ -f "$SKRIP" ] || { echo "✖ Skrip tambalan tidak ada: $SKRIP"; exit 1; }

echo "→ Mengirim tambalan…"
scp -i "$KUNCI" -o BatchMode=yes "$SKRIP" "$VPS:/tmp/tambalan.mjs"

echo "→ Menambal, memeriksa, lalu restart…"
ssh -i "$KUNCI" -o BatchMode=yes "$VPS" '
set -e
cd /root/binance-trading-backend
CAP=$(date +%Y%m%d-%H%M%S)
CADANGAN="server.js.cadangan-$CAP"
cp server.js "$CADANGAN"
echo "   cadangan: $CADANGAN"

pulihkan() {
  echo "   ✖ gagal — mengembalikan $CADANGAN"
  cp "$CADANGAN" server.js
  pm2 restart binance-backend >/dev/null 2>&1 || true
  exit 1
}

node /tmp/tambalan.mjs server.js || pulihkan
node --check server.js || pulihkan
pm2 restart binance-backend >/dev/null || pulihkan
sleep 5
KODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/analisa || echo 000)
echo "   GET /api/analisa -> $KODE"
[ "$KODE" = "200" ] || pulihkan
rm -f /tmp/tambalan.mjs
echo "   ✔ backend hidup dengan aturan kuota baru"
'
echo "✔ Selesai."
