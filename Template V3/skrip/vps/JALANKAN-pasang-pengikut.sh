#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# PASANG PENGIKUT COPY DI VPS — jalankan dari Git Bash di komputer pemilik
# ════════════════════════════════════════════════════════════════════════
# Tiga berkas dikirim utuh lewat scp, lalu yang berjalan di VPS adalah
# skrip yang sudah jadi — TIDAK ADA logika di dalam kutip ssh. Percobaan
# pertama menaruh penambal node di dalam kutip-satu ssh dan jangkarnya
# (yang mengandung kutip satu) tiba dalam keadaan rusak.
#
# Pengaman di sisi VPS (pasang-pengikut-remote.sh): cadangan bercap waktu,
# node --check sebelum restart, bukti hidup GET /api/analisa + log
# "[pengikut] siap", pulih otomatis kalau gagal. Aman diulang.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

KUNCI="$HOME/.ssh/id_jaditrader_deploy"
VPS="root@103.253.145.38"
DIRSKRIP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ -f "$KUNCI" ] || { echo "✖ Kunci tidak ada: $KUNCI"; exit 1; }
for f in pengikut-copy-vps.js pasang-pengikut-server.mjs pasang-pengikut-remote.sh; do
  [ -f "$DIRSKRIP/$f" ] || { echo "✖ $f tidak ada di $DIRSKRIP"; exit 1; }
done

echo "→ Mengirim tiga berkas…"
scp -i "$KUNCI" -o BatchMode=yes \
  "$DIRSKRIP/pengikut-copy-vps.js" "$VPS:/root/binance-trading-backend/pengikut-copy-vps.js"
scp -i "$KUNCI" -o BatchMode=yes \
  "$DIRSKRIP/pasang-pengikut-server.mjs" "$VPS:/tmp/pasang-pengikut-server.mjs"
scp -i "$KUNCI" -o BatchMode=yes \
  "$DIRSKRIP/pasang-pengikut-remote.sh" "$VPS:/tmp/pasang-pengikut-remote.sh"

echo "→ Memasang…"
ssh -i "$KUNCI" -o BatchMode=yes "$VPS" "bash /tmp/pasang-pengikut-remote.sh"
echo "✔ Selesai — pengikut copy sekarang berjalan 24 jam di VPS."
