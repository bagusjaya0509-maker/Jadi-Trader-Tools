#!/usr/bin/env bash
# Berjalan DI VPS. Tiga pembaruan sekaligus, satu cadangan, satu pemulih:
#   1. kartu-agen.js baru      — zona harga jadi satu kartu per ujung
#   2. server.js + rute dicopy — hitungan pengcopy sungguhan per sinyal
#   3. pengikut-copy-vps.js    — pengikut server ikut melapor pengcopy
set -e
cd /root/binance-trading-backend
CAP=$(date +%Y%m%d-%H%M%S)
cp server.js "server.js.cadangan-$CAP"
cp kartu-agen.js "kartu-agen.js.cadangan-$CAP"
cp pengikut-copy-vps.js "pengikut-copy-vps.js.cadangan-$CAP" 2>/dev/null || true
echo "   cadangan bercap: $CAP"
pulihkan() {
  echo "   GAGAL — mengembalikan semua cadangan $CAP"
  cp "server.js.cadangan-$CAP" server.js
  cp "kartu-agen.js.cadangan-$CAP" kartu-agen.js
  [ -f "pengikut-copy-vps.js.cadangan-$CAP" ] && cp "pengikut-copy-vps.js.cadangan-$CAP" pengikut-copy-vps.js
  pm2 restart binance-backend pemantau-telegram >/dev/null 2>&1 || true
  exit 1
}

cp /tmp/kartu-agen.baru.js kartu-agen.js
cp /tmp/pengikut-copy-vps.baru.js pengikut-copy-vps.js
node /tmp/tambah-dicopy.mjs server.js || pulihkan
node --check server.js || pulihkan
node --check kartu-agen.js || pulihkan
node --check pengikut-copy-vps.js || pulihkan
node -e "const m=require('/root/binance-trading-backend/kartu-agen.js'); if(!m.kirimKartu) process.exit(1)" || pulihkan

pm2 restart binance-backend --update-env >/dev/null || pulihkan
pm2 restart pemantau-telegram >/dev/null || pulihkan
sleep 5
KODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/analisa || echo 000)
echo "   GET /api/analisa -> $KODE"
[ "$KODE" = "200" ] || pulihkan
pm2 logs binance-backend --lines 40 --nostream 2>/dev/null | grep -q "\[pengikut\] siap" || pulihkan
pm2 logs pemantau-telegram --lines 15 --nostream 2>/dev/null | grep -q "pemantau hidup" || pulihkan
rm -f /tmp/kartu-agen.baru.js /tmp/pengikut-copy-vps.baru.js /tmp/tambah-dicopy.mjs /tmp/pembaruan-server-remote.sh
echo "   ketiganya hidup: zona 2 kartu + rute dicopy + pengikut pelapor"
