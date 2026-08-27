#!/usr/bin/env bash
set -e
cd /root/binance-trading-backend
CAP=$(date +%Y%m%d-%H%M%S)
CADANGAN="server.js.cadangan-$CAP"
cp server.js "$CADANGAN"
echo "   cadangan: $CADANGAN"
pulihkan() {
  echo "   GAGAL — mengembalikan $CADANGAN"
  cp "$CADANGAN" server.js
  pm2 restart binance-backend >/dev/null 2>&1 || true
  exit 1
}
node /tmp/percepat-penilai.mjs server.js || pulihkan
node --check server.js || pulihkan
pm2 restart binance-backend --update-env >/dev/null || pulihkan
sleep 5
KODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/analisa || echo 000)
echo "   GET /api/analisa -> $KODE"
[ "$KODE" = "200" ] || pulihkan
rm -f /tmp/percepat-penilai.mjs /tmp/percepat-penilai-remote.sh
echo "   penilai kini tiap 60 detik"
