#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# PASANG PENGIKUT COPY DI VPS — jalankan dari Git Bash di komputer pemilik
# ════════════════════════════════════════════════════════════════════════
# Memasang pengikut-copy-vps.js sebagai modul server: pengikut Copy Signal
# yang hidup 24 jam di VPS, khusus akun pemilik. Sesudah ini tab peramban
# tidak dibutuhkan lagi untuk menyalin sinyal.
#
# AMAN DIULANG: modul disalin ulang, baris require hanya ditambah kalau
# belum ada, dan PENGIKUT_UID hanya ditulis kalau belum ada.
#
# Pengaman: cadangan server.js bercap waktu → node --check SEBELUM restart
# → bukti hidup lewat GET /api/analisa → log "[pengikut] siap" diperiksa →
# gagal di titik mana pun mengembalikan cadangannya.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

KUNCI="$HOME/.ssh/id_jaditrader_deploy"
VPS="root@103.253.145.38"
DIRSKRIP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ -f "$KUNCI" ] || { echo "✖ Kunci tidak ada: $KUNCI"; exit 1; }
[ -f "$DIRSKRIP/pengikut-copy-vps.js" ] || { echo "✖ Modul tidak ada di $DIRSKRIP"; exit 1; }

echo "→ Mengirim modul…"
scp -i "$KUNCI" -o BatchMode=yes "$DIRSKRIP/pengikut-copy-vps.js" "$VPS:/root/binance-trading-backend/pengikut-copy-vps.js"

echo "→ Memasang di server.js…"
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

# UID pengikut: pakai PORTO_UID kalau sudah ada; kalau tidak, ambil dari
# mt5.json — uid pemilik adalah yang terminal Exness-nya melapor.
if ! grep -q "^PENGIKUT_UID=\|^PORTO_UID=" .env; then
  UID_PEMILIK=$(node -e "
    const d=require(\"/root/binance-trading-backend/mt5.json\");
    for (const u of Object.keys(d.data||{}))
      for (const lg of Object.keys(d.data[u]||{}))
        if (((d.data[u][lg].akun||{}).server||\"\").includes(\"Exness\")) { console.log(u); process.exit(0); }
  ")
  [ -n "$UID_PEMILIK" ] || { echo "   ✖ uid pemilik tidak ketemu di mt5.json"; exit 1; }
  echo "PENGIKUT_UID=$UID_PEMILIK" >> .env
  echo "   PENGIKUT_UID ditulis: ${UID_PEMILIK:0:10}…"
else
  echo "   uid: memakai $(grep -o "^PENGIKUT_UID=\|^PORTO_UID=" .env | head -1 | tr -d "=") yang sudah ada"
fi

# Baris require — idempoten, ditanam tepat sesudah baris mt5agen supaya
# ikut pola modul tertanam yang sudah ada.
if ! grep -q "pengikut-copy-vps" server.js; then
  node -e "
    const fs=require(\"fs\");
    let s=fs.readFileSync(\"server.js\",\"utf8\");
    const jangkar=\"require('./mt5agen')(app, { requireToken, batasLaju, express, DIR: __dirname });\";
    if (!s.includes(jangkar)) { console.error(\"jangkar mt5agen tidak ketemu\"); process.exit(1); }
    const baris=\"\\n\\n// Pengikut Copy Signal di server — 24 jam, khusus akun pemilik (pengikut-copy-vps.js).\\n\" +
      \"// Menyalin sinyal analis yang diikuti ke terminal MT5 pemilik tanpa butuh tab peramban.\\n\" +
      \"require('./pengikut-copy-vps')(app, { butuhLogin, batasLaju, express, DIR: __dirname });\";
    s=s.replace(jangkar, jangkar+baris);
    fs.writeFileSync(\"server.js\",s);
  " || pulihkan
  echo "   baris require ditanam."
else
  echo "   baris require sudah ada — dilewati."
fi

node --check server.js || pulihkan
node --check pengikut-copy-vps.js || pulihkan
pm2 restart binance-backend --update-env >/dev/null || pulihkan
sleep 5
KODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/analisa || echo 000)
echo "   GET /api/analisa -> $KODE"
[ "$KODE" = "200" ] || pulihkan
if pm2 logs binance-backend --lines 40 --nostream 2>/dev/null | grep -q "\[pengikut\] siap"; then
  echo "   ✔ modul pengikut hidup"
else
  echo "   ✖ log \"[pengikut] siap\" tidak muncul"
  pulihkan
fi
'
echo "✔ Selesai — pengikut copy sekarang berjalan 24 jam di VPS."
