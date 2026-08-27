#!/usr/bin/env bash
set -e
cd /root/binance-trading-backend
CAP=$(date +%Y%m%d-%H%M%S)
cp kartu-agen.js "kartu-agen.js.cadangan-$CAP"
echo "   cadangan: kartu-agen.js.cadangan-$CAP"
pulihkan() {
  echo "   GAGAL — mengembalikan cadangan"
  cp "kartu-agen.js.cadangan-$CAP" kartu-agen.js
  pm2 restart pemantau-telegram >/dev/null 2>&1 || true
  exit 1
}
cp /tmp/kartu-agen.baru.js kartu-agen.js
node --check kartu-agen.js || pulihkan
node -e "const m=require('/root/binance-trading-backend/kartu-agen.js'); if(!m.kirimKartu||!m.layakKartu) process.exit(1)" || pulihkan
pm2 restart pemantau-telegram >/dev/null || pulihkan
sleep 4
if pm2 logs pemantau-telegram --lines 15 --nostream 2>/dev/null | grep -q "pemantau hidup"; then
  echo "   pemantau hidup dengan kartu-agen baru"
else
  echo "   pemantau tidak melapor hidup"; pulihkan
fi
rm -f /tmp/kartu-agen.baru.js /tmp/perbarui-aitelg-remote.sh
echo "   zona kini terbit sebagai satu kartu per ujung"
