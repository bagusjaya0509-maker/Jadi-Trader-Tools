#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
#  pasang-kunci-hl.sh — menaruh kredensial Hyperliquid di .env, dengan aman
# ══════════════════════════════════════════════════════════════════════════
#  Dijalankan LANGSUNG oleh pemiliknya di terminal. Kuncinya diketik ke
#  prompt, bukan ditulis di baris perintah — jadi ia tidak pernah mampir ke
#  riwayat shell, tidak muncul di `ps`, dan tidak pernah melewati chat.
#
#  Dua nilai yang berbeda sifatnya:
#    HL_AKUN      — alamat akun, identitas PUBLIK di blockchain. Bukan
#                   rahasia; siapa pun bisa melihatnya di explorer.
#    HL_AGENT_KEY — private key agent wallet. RAHASIA. Ia boleh membuka dan
#                   menutup posisi, tapi TIDAK boleh menarik atau
#                   memindahkan dana — itulah sebabnya yang dipakai agent
#                   wallet, bukan kunci utama.
# ══════════════════════════════════════════════════════════════════════════
set -u

ENV=/root/binance-trading-backend/.env
[ -f "$ENV" ] || { echo "✖ Tidak ketemu: $ENV"; exit 1; }

echo "── Kredensial Hyperliquid ──────────────────────────────────────"
echo

# ── Alamat akun ────────────────────────────────────────────────────────
read -r -p "Alamat akun Hyperliquid (0x…) : " AKUN
AKUN=$(echo "$AKUN" | tr -d '[:space:]')
if ! echo "$AKUN" | grep -Eq '^0x[0-9a-fA-F]{40}$'; then
  echo "✖ Bukan alamat yang sah. Harus 0x diikuti 40 karakter heksadesimal."
  exit 1
fi

# ── Private key agent ──────────────────────────────────────────────────
#  -s: tidak ditampilkan sama sekali saat diketik.
echo
echo "Tempel private key AGENT wallet (tidak akan terlihat saat diketik)."
echo "Kalau salah tempel, tekan Ctrl+C dan ulangi."
read -r -s -p "Private key agent            : " KUNCI
echo
KUNCI=$(echo "$KUNCI" | tr -d '[:space:]')
# 0x boleh ada boleh tidak; disimpan apa adanya asal panjangnya benar.
if ! echo "$KUNCI" | grep -Eq '^(0x)?[0-9a-fA-F]{64}$'; then
  echo "✖ Bukan private key yang sah (harus 64 karakter heksadesimal)."
  echo "  Yang kamu tempel mungkin ALAMAT agent, bukan kuncinya."
  exit 1
fi

# ── Pagar: kunci dan alamat tidak boleh sama ───────────────────────────
#  Kesalahan paling mudah terjadi: menempel alamat agent di dua-duanya.
if [ "${KUNCI#0x}" = "${AKUN#0x}" ]; then
  echo "✖ Kunci dan alamat sama — salah satunya pasti salah tempel."
  exit 1
fi

# ── Ditulis: baris lama dibuang dulu supaya tidak menumpuk ─────────────
cp "$ENV" "$ENV.cadangan-hl-$(date +%Y%m%d-%H%M%S)"
grep -v -E '^(HL_AKUN|HL_AGENT_KEY)=' "$ENV" > "$ENV.tmp"
{
  echo "HL_AKUN=$AKUN"
  echo "HL_AGENT_KEY=$KUNCI"
} >> "$ENV.tmp"
mv "$ENV.tmp" "$ENV"
chmod 600 "$ENV"

echo
echo "✔ Tersimpan di $ENV"
echo "  HL_AKUN      = $AKUN"
echo "  HL_AGENT_KEY = ${KUNCI:0:6}…${KUNCI: -4}  (disamarkan)"
echo
echo "Cadangan .env sebelumnya ada di $ENV.cadangan-hl-*"
echo "Belum ada kode yang memakainya — jalur Hyperliquid dibangun setelah ini."
