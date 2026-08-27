#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# BERJALAN DI VPS — dipanggil JALANKAN-pasang-pengikut.sh lewat scp+ssh
# ════════════════════════════════════════════════════════════════════════
# Kenapa berkas terpisah, bukan perintah di dalam ssh '...': percobaan
# pertama menyelipkan skrip node di dalam kutip-satu ssh, dan jangkar yang
# ditambalkannya SENDIRI mengandung kutip satu — kutipnya saling memutus,
# jangkarnya tiba dalam keadaan rusak, dan pemasangan gagal dengan pesan
# yang menunjuk ke tempat yang salah. Berkas yang dikirim utuh lewat scp
# tidak melewati satu pun lapisan kutip.
# ════════════════════════════════════════════════════════════════════════
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

if grep -q "^PENGIKUT_UID=\|^PORTO_UID=" .env; then
  echo "   uid: memakai yang sudah ada di .env"
else
  echo "   .env belum punya PENGIKUT_UID/PORTO_UID — tidak bisa lanjut."
  exit 1
fi

if grep -q "pengikut-copy-vps" server.js; then
  echo "   baris require sudah ada — dilewati."
else
  node /tmp/pasang-pengikut-server.mjs server.js || pulihkan
  echo "   baris require ditanam."
fi

node --check server.js || pulihkan
node --check pengikut-copy-vps.js || pulihkan
pm2 restart binance-backend --update-env >/dev/null || pulihkan
sleep 5

KODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/analisa || echo 000)
echo "   GET /api/analisa -> $KODE"
[ "$KODE" = "200" ] || pulihkan

if pm2 logs binance-backend --lines 40 --nostream 2>/dev/null | grep -q "pengikut... siap\|\[pengikut\] siap"; then
  echo "   modul pengikut hidup"
else
  echo "   log [pengikut] siap tidak muncul"
  pulihkan
fi
rm -f /tmp/pasang-pengikut-server.mjs /tmp/pasang-pengikut-remote.sh
