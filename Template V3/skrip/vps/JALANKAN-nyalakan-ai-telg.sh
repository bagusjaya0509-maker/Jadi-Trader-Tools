#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# NYALAKAN POSTING KARTU AI TELG — TG_KE_KARTU=0 → 1, lalu restart pemantau
# ════════════════════════════════════════════════════════════════════════
# Pemantau Telegram di VPS sudah membaca grup VIP ASF dan merangkai sinyal
# dengan benar (log 26 Agu 22.57: "SINYAL XAUUSD BUY sl 4385 tp 4600,
# lengkap") — tapi TG_KE_KARTU=0 menahannya tepat sebelum diposting jadi
# kartu AI Telg. Skrip ini cuma membalik sakelar itu.
#
# Sesudah menyala: tiap sinyal lengkap dari grup terbit sebagai kartu
# AI Telg di Copy Signal — dan siapa pun yang mengikuti AI Telg akan
# menyalinnya otomatis ke terminalnya, dengan lot dari batas ruginya
# sendiri. Pagar yang sudah ada tetap berlaku: hanya pesan admin, wajib
# SL DAN TP lengkap, sisi SL/TP diperiksa terhadap entry pasar.
#
# Aman diulang: kalau nilainya sudah 1, sed tidak mengubah apa-apa.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

KUNCI="$HOME/.ssh/id_jaditrader_deploy"
VPS="root@103.253.145.38"
[ -f "$KUNCI" ] || { echo "✖ Kunci tidak ada: $KUNCI"; exit 1; }

ssh -i "$KUNCI" -o BatchMode=yes "$VPS" '
set -e
cd /root/binance-trading-backend
cp .env ".env.cadangan-$(date +%Y%m%d-%H%M%S)"
sed -i "s/^TG_KE_KARTU=0$/TG_KE_KARTU=1/" .env
echo "   sakelar sekarang: $(grep "^TG_KE_KARTU" .env)"
pm2 restart pemantau-telegram --update-env >/dev/null
sleep 6
echo "   ── log sesudah restart ──"
pm2 logs pemantau-telegram --lines 5 --nostream 2>/dev/null | tail -6
'
echo "✔ Selesai — AI Telg sekarang memposting sinyal lengkap sebagai kartu."
