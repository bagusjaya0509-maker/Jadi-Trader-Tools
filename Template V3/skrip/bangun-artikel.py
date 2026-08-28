# -*- coding: utf-8 -*-
"""Merender artikel /belajar jadi HTML statis, lalu memperbarui sitemap.

KENAPA STATIS. HTML mentah jaditrader.co.id memuat 122 karakter teks; sisanya
digambar JavaScript. Halaman yang isinya baru ada sesudah JS jalan bisa
diperingkatkan Google, tapi lebih lambat dan lebih sering gagal — dan mesin
jawab berbasis AI umumnya tidak menunggu sama sekali. Artikel di sini keluar
sebagai berkas HTML yang isinya sudah lengkap sebelum satu baris skrip pun
dijalankan. Nol JavaScript, sengaja.

DI MANA HASILNYA. `public/belajar/<slug>/index.html`. Vite menyalin seluruh
isi `public/` apa adanya ke `dist/`, dan server menyajikan berkas statis
sebelum jatuh ke SPA. Sudah diperiksa: berkas .html yang tidak ada memulangkan
404 sungguhan, bukan cangkang aplikasi — jadi berkas yang ADA benar-benar
disajikan sebagai dirinya sendiri.

ALAMAT SERVER TIDAK PERNAH DITULIS DI ARTIKEL. Ia berubah waktu backend
pindah, dan artikel yang menuliskannya akan menyesatkan tanpa ada yang
mengingatkan. Pembaca diarahkan menyalinnya dari halaman Integrations.

Pakai:  python skrip/bangun-artikel.py
"""
import io, os, re, sys
from importlib import import_module

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
D = os.path.dirname(os.path.abspath(__file__))
AKAR = os.path.dirname(D)
sys.path.insert(0, D)
A = import_module("artikel-isi")

SITUS = "https://jaditrader.co.id"
KELUAR = os.path.join(AKAR, "public", "belajar")

# Warna diambil dari aplikasinya sendiri supaya artikel tidak terbaca seperti
# situs lain yang kebetulan menumpang domain yang sama.
GAYA = """
:root{--bg:#09090b;--panel:#111114;--garis:#26262b;--teks:#e4e4e7;
  --redup:#a1a1aa;--aksen:#60a5fa}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--teks);
  font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased}
a{color:var(--aksen)}
.bungkus{max-width:720px;margin:0 auto;padding:28px 20px 80px}
header.atas{border-bottom:1px solid var(--garis);margin-bottom:36px;
  padding-bottom:18px;display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}
header.atas a.merek{color:var(--teks);text-decoration:none;font-weight:700;
  letter-spacing:-.02em}
header.atas nav a{color:var(--redup);text-decoration:none;font-size:14px;
  margin-right:14px}
header.atas nav a:hover{color:var(--teks)}
h1{font-size:34px;line-height:1.22;letter-spacing:-.02em;margin:0 0 14px}
h2{font-size:22px;line-height:1.3;letter-spacing:-.015em;margin:38px 0 12px}
p{margin:0 0 16px}
ul,ol{margin:0 0 18px;padding-left:22px}
li{margin-bottom:9px}
code{background:#1c1c20;border:1px solid var(--garis);border-radius:4px;
  padding:1px 6px;font-size:.88em;font-family:ui-monospace,SFMono-Regular,
  Menlo,monospace;color:#d4d4d8;white-space:nowrap}
.ringkas{color:var(--redup);font-size:18px;line-height:1.6;margin:0 0 26px}
.catatan{background:var(--panel);border:1px solid var(--garis);
  border-left:3px solid var(--aksen);border-radius:6px;padding:14px 16px;
  margin:0 0 20px;color:var(--redup);font-size:15px}
.catatan b{color:var(--teks)}
.ajakan{background:var(--panel);border:1px solid var(--garis);border-radius:10px;
  padding:22px;margin:44px 0 0}
.ajakan p{margin:0 0 14px;color:var(--redup)}
.ajakan a.tombol{display:inline-block;background:var(--teks);color:#09090b;
  text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;
  border-radius:7px}
.terkait{margin-top:44px;border-top:1px solid var(--garis);padding-top:22px}
.terkait h2{font-size:15px;color:var(--redup);margin:0 0 10px;
  text-transform:uppercase;letter-spacing:.06em}
.terkait a{display:block;margin-bottom:8px;text-decoration:none;
  color:var(--teks);font-weight:500}
.terkait a:hover{color:var(--aksen)}
footer{margin-top:52px;border-top:1px solid var(--garis);padding-top:20px;
  color:#71717a;font-size:13px}
.daftar-artikel{list-style:none;padding:0}
.daftar-artikel li{border-bottom:1px solid var(--garis);padding:18px 0;margin:0}
.daftar-artikel a{font-size:19px;font-weight:600;text-decoration:none;
  color:var(--teks);letter-spacing:-.01em}
.daftar-artikel a:hover{color:var(--aksen)}
.daftar-artikel p{margin:6px 0 0;color:var(--redup);font-size:15px}
.label{display:inline-block;font-size:11px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--redup);border:1px solid var(--garis);
  border-radius:99px;padding:2px 9px;margin-bottom:10px}
@media(max-width:520px){h1{font-size:27px}.bungkus{padding:20px 16px 64px}}
"""


def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def kaya(t):
    """Teks artikel boleh memuat <b>, <code>, <a> — tapi tidak boleh
    memuat tag lain. Ditulis penulis, bukan pengguna, jadi yang dijaga di sini
    bukan serangan melainkan salah ketik yang merusak halaman."""
    utuh = re.sub(r"</?(?:b|i|code|a|strong|em)(?:\s[^>]*)?>", "\x00", str(t))
    if "<" in utuh.replace("\x00", ""):
        raise SystemExit("Tag tak dikenal di teks artikel: " + str(t)[:80])
    return str(t)


def blok(jenis, isi):
    if jenis == "p":
        return "<p>%s</p>" % kaya(isi)
    if jenis == "h2":
        return "<h2>%s</h2>" % kaya(isi)
    if jenis == "catatan":
        return '<div class="catatan">%s</div>' % kaya(isi)
    if jenis in ("ul", "ol"):
        return "<%s>%s</%s>" % (jenis, "".join("<li>%s</li>" % kaya(x) for x in isi), jenis)
    raise SystemExit("Jenis blok tidak dikenal: " + jenis)


def kepala(judul, ringkas, jalur, kunci=""):
    """Kepala HTML yang sama untuk artikel dan halaman daftar."""
    url = SITUS + jalur
    return f"""<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(judul)}</title>
<meta name="description" content="{esc(ringkas)}">
{f'<meta name="keywords" content="{esc(kunci)}">' if kunci else ''}
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(judul)}">
<meta property="og:description" content="{esc(ringkas)}">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="Jadi Trader Tools">
<meta property="og:locale" content="id_ID">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>{GAYA}</style>
</head>
<body>
<div class="bungkus">
<header class="atas">
  <a class="merek" href="/">Jadi Trader Tools</a>
  <nav>
    <a href="/belajar/">Belajar</a>
    <a href="/preview">Coba gratis</a>
    <a href="/akses">Harga</a>
  </nav>
</header>
"""


EKOR = """
<footer>
  <p>Edukasi, bukan rekomendasi finansial. Trading mengandung risiko kehilangan modal.</p>
  <p><a href="/">jaditrader.co.id</a> &middot; <a href="/legal">Legal</a></p>
</footer>
</div>
</body>
</html>
"""


def jsonld(a, jalur):
    """Data terstruktur. Tanpa ini artikelnya tetap terbaca, tapi mesin
    pencari harus menebak mana judul dan mana isi."""
    return (
      '<script type="application/ld+json">'
      '{"@context":"https://schema.org","@type":"Article",'
      f'"headline":{esc(a["judul"])!r},'
      f'"description":{esc(a["ringkas"])!r},'
      f'"mainEntityOfPage":"{SITUS}{jalur}",'
      '"inLanguage":"id-ID",'
      '"publisher":{"@type":"Organization","name":"Jadi Trader Tools",'
      f'"url":"{SITUS}"}}}}'
      '</script>'
    ).replace("'", '"')


# ── render ──────────────────────────────────────────────────────────────
peta = {a["slug"]: a for a in A.ARTIKEL}
os.makedirs(KELUAR, exist_ok=True)

for a in A.ARTIKEL:
    jalur = "/belajar/%s/" % a["slug"]
    isi = "".join(blok(j, x) for j, x in a["isi"])

    terkait = ""
    tautan = [peta[s] for s in a.get("terkait", []) if s in peta]
    if tautan:
        terkait = ('<div class="terkait"><h2>Baca juga</h2>' +
                   "".join('<a href="/belajar/%s/">%s</a>' % (t["slug"], esc(t["judul"]))
                           for t in tautan) + "</div>")

    ajakan = ('<div class="ajakan"><p>%s</p>'
              '<a class="tombol" href="/preview">Coba tanpa daftar &rarr;</a></div>'
              % esc(A.CTA))

    html = (kepala(a["judul"] + " — Jadi Trader Tools", a["ringkas"], jalur, a["kunci"])
            + jsonld(a, jalur)
            + '<article><span class="label">%s</span><h1>%s</h1>'
              '<p class="ringkas">%s</p>%s</article>'
              % ("Panduan" if a["jenis"] == "fitur" else "Edukasi",
                 esc(a["judul"]), esc(a["ringkas"]), isi)
            + ajakan + terkait + EKOR)

    folder = os.path.join(KELUAR, a["slug"])
    os.makedirs(folder, exist_ok=True)
    io.open(os.path.join(folder, "index.html"), "w", encoding="utf-8").write(html)
    print("  %-52s %5d huruf" % (a["slug"], len(html)))

# ── halaman daftar ──────────────────────────────────────────────────────
def daftar(judul, butir):
    if not butir:
        return ""
    return ("<h2>%s</h2><ul class=\"daftar-artikel\">" % judul + "".join(
        '<li><a href="/belajar/%s/">%s</a><p>%s</p></li>'
        % (a["slug"], esc(a["judul"]), esc(a["ringkas"])) for a in butir) + "</ul>")

fitur = [a for a in A.ARTIKEL if a["jenis"] == "fitur"]
edukasi = [a for a in A.ARTIKEL if a["jenis"] != "fitur"]

hub = (kepala("Belajar — Panduan Jadi Trader Tools",
              "Panduan memakai Jadi Trader Tools dan dasar-dasar trading: "
              "menghubungkan MT5, API Binance, membaca chart, dan mengelola risiko.",
              "/belajar/")
       + '<article><h1>Belajar</h1><p class="ringkas">Panduan memakai alatnya, '
         'dan dasar-dasar yang membuat alat itu berguna.</p>'
       + daftar("Panduan alat", fitur)
       + daftar("Dasar trading", edukasi)
       + "</article>" + EKOR)
io.open(os.path.join(KELUAR, "index.html"), "w", encoding="utf-8").write(hub)
print("  %-52s %5d huruf" % ("(halaman daftar)", len(hub)))

# ── sitemap ─────────────────────────────────────────────────────────────
# Ditulis ulang seluruhnya dari daftar tetap + artikel, bukan ditambal:
# sitemap yang ditambal akan menumpuk alamat artikel yang sudah dihapus.
TETAP = ["/", "/preview", "/akses", "/legal", "/changelog", "/docs", "/belajar/"]
baris = ['<?xml version="1.0" encoding="UTF-8"?>',
         "<!-- Dibuat skrip/bangun-artikel.py. Jangan disunting tangan:",
         "     berkas ini ditulis ULANG tiap kali artikel dibangun. -->",
         '<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">'.replace(
             "www.sitemap.org", "www.sitemaps.org")]
for j in TETAP:
    baris.append("  <url><loc>%s%s</loc></url>" % (SITUS, j))
for a in A.ARTIKEL:
    baris.append("  <url><loc>%s/belajar/%s/</loc></url>" % (SITUS, a["slug"]))
baris.append("</urlset>")
io.open(os.path.join(AKAR, "public", "sitemap.xml"), "w", encoding="utf-8").write(
    "\n".join(baris) + "\n")

print("\n  %d artikel + 1 halaman daftar" % len(A.ARTIKEL))
print("  sitemap.xml: %d alamat" % (len(TETAP) + len(A.ARTIKEL)))
