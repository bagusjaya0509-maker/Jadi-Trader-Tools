#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# PASANG AGEN PEMBACA CHART + RAHASIAKAN ASAL RUANG
# ════════════════════════════════════════════════════════════════════════
# Mengunggah pemantau multi-ruang, modul mata-chart, dan pembersih jejak
# ke VPS, lalu menjalankan pemasangannya. Aman diulang: setelan .env yang
# sudah ada tidak ditimpa, dan pembersih jejaknya idempoten.
#
# Kalau ada satu langkah yang gagal, skrip di sisi VPS mengembalikan
# SEMUANYA — berkas maupun .env.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

KUNCI="$HOME/.ssh/id_jaditrader_deploy"
VPS="root@103.253.145.38"
DI="$(cd "$(dirname "$0")" && pwd)"

[ -f "$KUNCI" ] || { echo "✖ Kunci tidak ada: $KUNCI"; exit 1; }

echo "→ mengunggah berkas"
ssh -i "$KUNCI" -o BatchMode=yes "$VPS" 'mkdir -p /tmp/agen'
scp -i "$KUNCI" -o BatchMode=yes \
  "$DI/pemantau-telegram.js" "$DI/kartu-agen.js" \
  "$DI/mata-chart.js" "$DI/bersihkan-jejak.mjs" \
  "$VPS:/tmp/agen/" >/dev/null
scp -i "$KUNCI" -o BatchMode=yes \
  "$DI/pasang-agen-chart-remote.sh" "$VPS:/tmp/pasang-agen-chart-remote.sh" >/dev/null

echo "→ memasang di VPS"
# sed membuang CR: berkas ini disunting di Windows, dan bash menolak
# baris berakhiran CRLF dengan pesan yang menyesatkan ("command not found"
# untuk perintah yang jelas-jelas ada).
ssh -i "$KUNCI" -o BatchMode=yes "$VPS" \
  'sed -i "s/\r$//" /tmp/pasang-agen-chart-remote.sh && bash /tmp/pasang-agen-chart-remote.sh'

echo
echo "✔ Selesai. Untuk menguji pembaca gambarnya pada chart sungguhan:"
echo "    ssh -i $KUNCI $VPS 'cd /root/binance-trading-backend && node uji-mata.js 2'"
