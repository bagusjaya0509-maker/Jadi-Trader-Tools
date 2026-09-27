# -*- coding: utf-8 -*-
"""Membuat sampul kartu artikel — motif abstrak gelap, bukan tipografi.

KENAPA MOTIF, BUKAN JUDUL BESAR. Judulnya sudah tercetak di kartu tepat di
bawah gambarnya. Sampul yang mengulang judul membuat satu kalimat dibaca dua
kali, dan di layar sempit keduanya bertabrakan. Yang dipakai di sini motif
yang menyiratkan isi artikelnya: kisi seperti spreadsheet untuk artikel
Excel, candle yang terpotong untuk replay, dan seterusnya.

PALETNYA MENEMPEL PADA HALAMAN ARTIKEL. Latarnya hitam pekat yang sama
(#000), garis kisi #1a1a1a, hijau dan merah diredupkan jauh di bawah warna
sinyal supaya gambarnya tidak pernah menarik perhatian melebihi judulnya.

Sengaja deterministik: seed-nya dipatok, jadi menjalankan ulang skrip ini
menghasilkan berkas yang sama persis dan diff-nya tidak pernah berisik.

  python skrip/buat-sampul-artikel.py
"""
import os
import random

from PIL import Image, ImageDraw

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KELUAR = os.path.join(AKAR, "public", "artikel", "gambar")

L, T = 1200, 900
LATAR = (8, 8, 8)
KISI = (26, 26, 26)
HIJAU = (20, 53, 31)
MERAH = (58, 20, 24)
HIJAU_T = (34, 88, 52)
MERAH_T = (96, 34, 40)
REDUP = (38, 38, 38)


def kanvas():
    im = Image.new("RGB", (L, T), LATAR)
    return im, ImageDraw.Draw(im)


def kisi_halus(d, langkah=50):
    for x in range(0, L, langkah):
        d.line([(x, 0), (x, T)], fill=KISI, width=1)
    for y in range(0, T, langkah):
        d.line([(0, y), (L, y)], fill=KISI, width=1)


# ── 1. CHART REPLAY ────────────────────────────────────────────────────
# Candle berhenti di tengah, sisanya kisi kosong. Itu persis yang dilakukan
# fiturnya: bar yang belum terjadi dipotong dari layar.
def replay(path):
    im, d = kanvas()
    kisi_halus(d)
    acak = random.Random(11)
    batas = int(L * 0.56)
    harga = T * 0.55
    x = 30
    lebar, jarak = 14, 24
    while x < batas:
        gerak = acak.uniform(-26, 24)
        buka = harga
        tutup = max(T * 0.18, min(T * 0.86, harga + gerak))
        atas = min(buka, tutup) - acak.uniform(6, 26)
        bawah = max(buka, tutup) + acak.uniform(6, 26)
        naik = tutup < buka
        warna = HIJAU if naik else MERAH
        tepi = HIJAU_T if naik else MERAH_T
        d.line([(x + lebar // 2, atas), (x + lebar // 2, bawah)], fill=tepi, width=1)
        y0, y1 = sorted((buka, tutup))
        d.rectangle([x, y0, x + lebar, max(y1, y0 + 2)], fill=warna, outline=tepi)
        harga = tutup
        x += jarak
    # Batas tempat grafiknya berhenti. Garis putus-putus, tipis, tidak menyala.
    for y in range(0, T, 14):
        d.line([(batas + 6, y), (batas + 6, y + 7)], fill=(48, 48, 48), width=2)
    im.save(path, "WEBP", quality=82, method=6)


# ── 2. SCREENER ────────────────────────────────────────────────────────
# Daftar panjang yang sebagian besar redup, dan sedikit sekali yang lolos.
# Bentuknya menyempit ke bawah supaya terbaca sebagai penyaringan.
def screener(path):
    im, d = kanvas()
    acak = random.Random(23)
    baris_t = 26
    jeda = 8
    y = 40
    i = 0
    while y < T - 40:
        susut = int(i * 11)
        x0 = 40 + susut
        x1 = L - 40 - susut
        if x1 - x0 < 120:
            break
        lolos = acak.random() < 0.16
        d.rectangle([x0, y, x1, y + baris_t], fill=(14, 14, 14), outline=REDUP)
        if lolos:
            d.rectangle([x0, y, x0 + 6, y + baris_t], fill=HIJAU_T)
            d.rectangle([x0 + 18, y + 9, x0 + 18 + acak.randint(90, 240), y + 17],
                        fill=HIJAU)
        else:
            d.rectangle([x0 + 18, y + 10, x0 + 18 + acak.randint(60, 200), y + 16],
                        fill=(30, 30, 30))
        y += baris_t + jeda
        i += 1
    im.save(path, "WEBP", quality=82, method=6)


# ── 3. STOP LOSS ───────────────────────────────────────────────────────
# Satu jalur harga, satu garis batas di bawahnya, dan jarak di antaranya
# ditandai. Jarak itu yang jadi pokok artikelnya.
def stoploss(path):
    im, d = kanvas()
    kisi_halus(d, 60)
    acak = random.Random(37)
    titik = []
    y = T * 0.40
    for x in range(40, L - 40, 18):
        y = max(T * 0.20, min(T * 0.62, y + acak.uniform(-22, 20)))
        titik.append((x, y))
    d.line(titik, fill=(90, 90, 90), width=2)
    # Garis stop loss: merah redup, putus-putus, jauh di bawah jalur harga.
    sl = T * 0.78
    for x in range(40, L - 40, 22):
        d.line([(x, sl), (x + 11, sl)], fill=MERAH_T, width=3)
    # Entry: garis datar tipis di tengah jalur.
    entry = T * 0.44
    for x in range(40, L - 40, 22):
        d.line([(x, entry), (x + 11, entry)], fill=(70, 70, 70), width=1)
    # Penanda jarak entry ke stop, di sisi kanan.
    xk = L - 110
    d.line([(xk, entry), (xk, sl)], fill=MERAH_T, width=2)
    for yy in (entry, sl):
        d.line([(xk - 12, yy), (xk + 12, yy)], fill=MERAH_T, width=2)
    d.rectangle([xk + 22, (entry + sl) / 2 - 5, xk + 62, (entry + sl) / 2 + 5],
                fill=MERAH)
    im.save(path, "WEBP", quality=82, method=6)


PETA = {
    "cara-latihan-trading-dengan-chart-replay": replay,
    "cara-menyaring-pair-dengan-screener": screener,
    "cara-menentukan-stop-loss": stoploss,
}

if __name__ == "__main__":
    os.makedirs(KELUAR, exist_ok=True)
    for slug, fungsi in PETA.items():
        p = os.path.join(KELUAR, slug + ".webp")
        fungsi(p)
        print("  %-46s %4d KB" % (slug + ".webp", os.path.getsize(p) // 1024))
