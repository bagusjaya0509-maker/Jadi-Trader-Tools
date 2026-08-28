#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Dijalankan DI VPS. Memasang arsip chart khusus pemilik:
#   · modul arsip-chart-vps.js + rutenya di server.js
#   · pemantau menyimpan gambar (TG2_ARSIP=1) dan BERHENTI memanggil model
#     penglihatan (TG2_GAMBAR=0)
#
# Semua dikembalikan kalau ada satu langkah yang gagal.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd /root/binance-trading-backend

CAP=$(date +%Y%m%d-%H%M%S)
echo "   cap cadangan: $CAP"
cp server.js            "server.js.cadangan-$CAP"
cp pemantau-telegram.js "pemantau-telegram.js.cadangan-$CAP"
cp .env                 ".env.cadangan-$CAP"

pulihkan() {
  echo "   ✖ GAGAL — mengembalikan semuanya"
  cp "server.js.cadangan-$CAP"            server.js
  cp "pemantau-telegram.js.cadangan-$CAP" pemantau-telegram.js
  cp ".env.cadangan-$CAP"                 .env
  rm -f arsip-chart-vps.js
  pm2 restart binance-backend --update-env  >/dev/null 2>&1 || true
  pm2 restart pemantau-telegram --update-env >/dev/null 2>&1 || true
  exit 1
}
trap pulihkan ERR

# ── 1. Berkas ─────────────────────────────────────────────────────────
cp /tmp/agen/arsip-chart-vps.js  arsip-chart-vps.js
cp /tmp/agen/pemantau-telegram.js pemantau-telegram.js
node --check arsip-chart-vps.js
node --check pemantau-telegram.js
echo "   sintaks OK"

# ── 2. Pasang rutenya di server.js ────────────────────────────────────
# Ditempel SESUDAH mount pengikut-copy-vps, memakai perkakas yang sama
# (butuhLogin, batasLaju, express, DIR). Aman diulang: kalau barisnya sudah
# ada, tidak ditambah lagi.
if grep -q "arsip-chart-vps" server.js; then
  echo "   rute arsip chart sudah terpasang — dibiarkan"
else
  node -e '
    const fs = require("fs");
    const P = "server.js";
    let s = fs.readFileSync(P, "utf8");
    const jangkar = "require(\"./pengikut-copy-vps\")(app, { butuhLogin, batasLaju, express, DIR: __dirname });";
    const jangkar2 = "require(\x27./pengikut-copy-vps\x27)(app, { butuhLogin, batasLaju, express, DIR: __dirname });";
    const pakai = s.includes(jangkar) ? jangkar : jangkar2;
    if (!s.includes(pakai)) { console.error("JANGKAR mount pengikut TIDAK KETEMU"); process.exit(1); }
    const tambah = pakai + "\n\n"
      + "// Chart mentah dari ruang pantauan agen — arsip PRIVAT, hanya uid pemilik.\n"
      + "// Gambarnya membawa tanda air sumbernya di dalam piksel, jadi ia tidak pernah\n"
      + "// lewat express.static dan setiap rutenya digerbangi dua lapis.\n"
      + "require(\x27./arsip-chart-vps\x27)(app, { butuhLogin, batasLaju, express, DIR: __dirname });";
    s = s.replace(pakai, tambah);
    fs.writeFileSync(P, s);
    console.log("   + rute arsip chart disisipkan");
  '
  node --check server.js
fi

# ── 3. Setelan ruang Triv ─────────────────────────────────────────────
# Model penglihatan DIMATIKAN: keputusan pemilik 28 Agu 2026 — yang menyaring
# dan menetapkan area entry adalah dia, bukan mesin. Nol biaya sejak sekarang.
if grep -q "^TG2_GAMBAR=" .env; then
  sed -i "s/^TG2_GAMBAR=.*/TG2_GAMBAR=0/" .env
  echo "   TG2_GAMBAR -> 0 (model penglihatan mati)"
fi
if grep -q "^TG2_ARSIP=" .env; then
  echo "   TG2_ARSIP sudah ada — dibiarkan"
else
  printf 'TG2_ARSIP=1\n' >> .env
  echo "   + TG2_ARSIP=1"
fi

# ── 4. Nyalakan ulang keduanya & buktikan hidup ───────────────────────
pm2 restart binance-backend --update-env >/dev/null
pm2 restart pemantau-telegram --update-env >/dev/null
sleep 14

LOGS=$(pm2 logs binance-backend --lines 60 --nostream 2>/dev/null || true)
if printf '%s' "$LOGS" | grep -q "\[arsip-chart\] siap"; then
  printf '%s\n' "$LOGS" | grep "\[arsip-chart\]" | tail -1
else
  echo "   backend tidak melaporkan arsip-chart siap:"
  printf '%s\n' "$LOGS" | tail -20
  false
fi

LOGP=$(pm2 logs pemantau-telegram --lines 40 --nostream 2>/dev/null || true)
if printf '%s' "$LOGP" | grep -q "pemantau hidup"; then
  printf '%s\n' "$LOGP" | grep -E "memantau:|pemantau hidup" | tail -3
else
  echo "   pemantau tidak melapor hidup:"
  printf '%s\n' "$LOGP" | tail -20
  false
fi

trap - ERR
rm -rf /tmp/agen
echo "✔ Selesai."
