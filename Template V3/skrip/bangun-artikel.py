# -*- coding: utf-8 -*-
"""Merender artikel /artikel jadi HTML statis, lalu memperbarui sitemap.

KENAPA STATIS. HTML mentah jaditrader.co.id memuat 122 karakter teks; sisanya
digambar JavaScript. Halaman yang isinya baru ada sesudah JS jalan bisa
diperingkatkan Google, tapi lebih lambat dan lebih sering gagal — dan mesin
jawab berbasis AI umumnya tidak menunggu sama sekali. Artikel di sini keluar
sebagai berkas HTML yang isinya sudah lengkap sebelum satu baris skrip pun
dijalankan. Nol JavaScript, sengaja.

DI MANA HASILNYA. `public/artikel/<slug>/index.html`. Vite menyalin seluruh
isi `public/` apa adanya ke `dist/`, dan server menyajikan berkas statis
sebelum jatuh ke SPA — sudah dibuktikan di situs tayang: halamannya tidak
memuat `id="root"`.

── HALAMAN DAFTAR MENIRU KOMPONEN blog-posts.tsx ────────────────────────
Pemilik mengirim komponen React `src/components/ui/blog-posts.tsx` untuk
halaman ini. Komponennya ditempel apa adanya ke kode (ia berguna untuk
tampilan di dalam aplikasi), TAPI halaman /artikel/ tidak memakainya —
karena satu alamat hanya bisa punya satu pemilik, dan berkas statis menang
atas rute SPA. Kalau /artikel/ jadi rute React, seluruh alasan halaman ini
ada akan hilang: ia kembali tidak terbaca crawler.

Jadi tata letaknya DITIRU di CSS biasa: judul tengah, label raksasa di
belakang, deskripsi tengah, lalu grid kartu bergambar — kartu pertama besar,
sisanya di kolom kanan. Gradien, sudut 20px, dan gerak hover-nya sama.

YANG SENGAJA TIDAK DITIRU: bintang penilaian dan jumlah "views". Keduanya
butuh angka yang belum ada, dan mengarangnya berarti memasang bukti sosial
palsu di situs yang menjual kejujuran hitungan. Waktu baca DIHITUNG dari
jumlah katanya sendiri, jadi ia angka sungguhan.

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
KELUAR = os.path.join(AKAR, "public", "artikel")

# Gambar kartu. Dipetakan per artikel supaya nyambung isinya, bukan diputar
# asal — semuanya berkas yang sudah ada di public/ dan sudah dioptimalkan.
GAMBAR = {
    "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis": "/parallax/gunung-lilin.webp",
    "cara-membuat-api-key-binance-yang-aman":            "/hero-bg2.webp",
    "kenapa-data-binance-tidak-masuk-di-indonesia":      "/parallax/langit.webp",
    "akun-sen-mt5-jurnal-seratus-kali-lipat":            "/hero-bg3.webp",
    "cara-memasang-indikator-pine-di-tradingview":       "/parallax/gunung-malam.webp",
}
GAMBAR_BAWAAN = "/hero-bg.webp"

GAYA = """
:root{--bg:#09090b;--panel:#111114;--garis:#26262b;--teks:#e4e4e7;
  --redup:#a1a1aa;--aksen:#60a5fa}
*{box-sizing:border-box}
/* overflow-x disembunyikan KARENA label raksasa di belakang judul memang
   dirancang meluber ke kiri (left:-16%). Diukur di peramban: dokumennya
   1.348px pada viewport 1.280px, jadi halaman ini bisa digeser ke samping —
   cacat yang paling terasa justru di ponsel. */
html{overflow-x:hidden}
body{margin:0;overflow-x:hidden;background:var(--bg);color:var(--teks);
  font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased}
a{color:var(--aksen)}
.bungkus{max-width:720px;margin:0 auto;padding:28px 20px 80px}
.lebar{max-width:1120px}
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
.label{display:inline-block;font-size:11px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--redup);border:1px solid var(--garis);
  border-radius:99px;padding:2px 9px;margin-bottom:10px}

/* ── halaman daftar: tiruan blog-posts.tsx ────────────────────────────── */
.seksi{position:relative;margin:40px 0 0;padding:24px 0 0}
.seksi h1.aula{text-align:center;font-size:40px;font-weight:600;
  line-height:1.4;letter-spacing:-.02em;margin:0 0 8px}
.latar-label{position:absolute;top:-40px;left:-8%;z-index:-1;user-select:none;
  font-size:180px;font-weight:800;line-height:1;color:rgba(228,228,231,.028);
  pointer-events:none;white-space:nowrap}
.seksi p.aula{max-width:800px;margin:0 auto 34px;text-align:center;
  font-size:20px;line-height:2;color:rgba(228,228,231,.5)}
.kisi{display:grid;grid-template-columns:1fr;gap:20px}
.kartu{position:relative;display:flex;flex-direction:column;justify-content:flex-end;
  overflow:hidden;border-radius:20px;background-size:cover;background-position:center;
  background-repeat:no-repeat;padding:20px;color:#fff;text-decoration:none;
  min-height:300px;transition:transform .3s ease}
.kartu:hover{transform:scale(.98) rotate(.3deg)}
.kartu .tirai{position:absolute;left:0;right:0;bottom:0;height:130%;
  background:linear-gradient(to top,rgba(0,0,0,.86),rgba(0,0,0,.15) 55%,transparent);
  transition:height .5s ease}
.kartu:hover .tirai{height:100%}
.kartu .isi{position:relative;display:flex;align-items:flex-end;gap:12px}
.kartu .teks{display:flex;flex:1;flex-direction:column;gap:12px}
.kartu h2{margin:0;font-size:26px;line-height:1.2;font-weight:600;
  letter-spacing:-.02em;color:#fff}
.kartu .chip{align-self:flex-start;background:rgba(255,255,255,.28);
  backdrop-filter:blur(8px);border-radius:6px;padding:2px 9px;font-size:14px;
  color:#fff}
.kartu .baca{font-size:17px;font-weight:600;color:#fff}
.kartu svg.panah{flex:none;transition:transform .3s ease}
.kartu:hover svg.panah{transform:translateX(8px)}
@media(min-width:768px){
  .kisi{grid-template-columns:1fr 1fr}
  .kartu.utama{grid-column:span 2;grid-row:span 2;min-height:420px}
  .kartu h2{font-size:30px}
  .kartu.utama h2{font-size:36px}
}
.kisi-sisa{display:grid;grid-template-columns:1fr;gap:20px;margin-top:20px}
.kisi-sisa .kartu{min-height:240px}
@media(min-width:768px){.kisi-sisa{grid-template-columns:1fr 1fr}}
@media(min-width:1024px){
  .kisi{grid-template-columns:1fr .62fr}
  .kisi-sisa{grid-template-columns:repeat(3,1fr)}
  .kartu.utama{grid-column:span 1;grid-row:span 2}
  .latar-label{font-size:340px;left:-16%}
  .seksi h1.aula{font-size:56px}
}
@media(max-width:520px){h1{font-size:27px}.bungkus{padding:20px 16px 64px}
  .seksi h1.aula{font-size:30px}.latar-label{font-size:110px}
  .seksi p.aula{font-size:17px;line-height:1.8}}
"""

PANAH = ('<svg class="panah" width="40" height="40" viewBox="0 0 24 24" fill="none" '
         'stroke="#fff" stroke-width="1.25" stroke-linecap="round" '
         'stroke-linejoin="round" aria-hidden="true">'
         '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>')


def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def kaya(t):
    """Teks artikel boleh memuat <b>, <code>, <a> — tidak boleh tag lain.
    Ditulis penulis, bukan pengguna, jadi yang dijaga di sini salah ketik yang
    merusak halaman, bukan serangan."""
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


def menitBaca(a):
    """Waktu baca DIHITUNG dari jumlah katanya, bukan ditebak.

    Angka yang ditebak di kartu terbaca sama meyakinkannya dengan angka yang
    benar, dan pembaca tidak punya cara membedakannya — jadi satu-satunya
    pilihan jujur adalah menghitungnya."""
    kata = 0
    for jenis, isi in a["isi"]:
        potong = isi if isinstance(isi, list) else [isi]
        for x in potong:
            kata += len(re.sub(r"<[^>]+>", " ", str(x)).split())
    return max(1, round(kata / 200))


def kepala(judul, ringkas, jalur, kunci="", lebar=False):
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
<div class="bungkus{' lebar' if lebar else ''}">
<header class="atas">
  <a class="merek" href="/">Jadi Trader Tools</a>
  <nav>
    <a href="/artikel/">Artikel</a>
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


# ── artikel ─────────────────────────────────────────────────────────────
peta = {a["slug"]: a for a in A.ARTIKEL}
os.makedirs(KELUAR, exist_ok=True)

for a in A.ARTIKEL:
    jalur = "/artikel/%s/" % a["slug"]
    isi = "".join(blok(j, x) for j, x in a["isi"])

    terkait = ""
    tautan = [peta[s] for s in a.get("terkait", []) if s in peta]
    if tautan:
        terkait = ('<div class="terkait"><h2>Baca juga</h2>' +
                   "".join('<a href="/artikel/%s/">%s</a>' % (t["slug"], esc(t["judul"]))
                           for t in tautan) + "</div>")

    ajakan = ('<div class="ajakan"><p>%s</p>'
              '<a class="tombol" href="/preview">Coba tanpa daftar &rarr;</a></div>'
              % esc(A.CTA))

    html = (kepala(a["judul"] + " — Jadi Trader Tools", a["ringkas"], jalur, a["kunci"])
            + jsonld(a, jalur)
            + '<article><span class="label">%s &middot; %d menit baca</span>'
              '<h1>%s</h1><p class="ringkas">%s</p>%s</article>'
              % ("Panduan" if a["jenis"] == "fitur" else "Edukasi",
                 menitBaca(a), esc(a["judul"]), esc(a["ringkas"]), isi)
            + ajakan + terkait + EKOR)

    folder = os.path.join(KELUAR, a["slug"])
    os.makedirs(folder, exist_ok=True)
    io.open(os.path.join(folder, "index.html"), "w", encoding="utf-8").write(html)
    print("  %-52s %5d huruf  %2d menit" % (a["slug"], len(html), menitBaca(a)))


# ── halaman daftar ──────────────────────────────────────────────────────
def kartu(a, utama=False):
    return (
      '<a class="kartu%s" href="/artikel/%s/" style="background-image:url(%s)">'
      '<span class="tirai"></span>'
      '<span class="isi"><span class="teks">'
      '<h2>%s</h2>'
      '<span class="chip">%s</span>'
      '<span class="baca">%d menit baca</span>'
      '</span>%s</span></a>'
      % (" utama" if utama else "", a["slug"],
         GAMBAR.get(a["slug"], GAMBAR_BAWAAN),
         esc(a["judul"]),
         "Panduan alat" if a["jenis"] == "fitur" else "Dasar trading",
         menitBaca(a), PANAH))


# TIGA kartu di kisi utama, persis seperti komponen aslinya: satu besar di
# kiri, dua kecil di kanan. Dengan lima kartu, kolom kanan tumbuh 1.260px
# sementara kartu utama berhenti di 940px — jomplang 320px yang terlihat
# sebagai lubang. Sisanya turun ke kisi kedua yang seragam, dan itu juga yang
# membuat halaman ini tetap rapi waktu artikelnya jadi tiga belas.
utama, sisa = A.ARTIKEL[:3], A.ARTIKEL[3:]
kartu_html = "".join(kartu(a, i == 0) for i, a in enumerate(utama))
sisa_html = ('<div class="kisi-sisa">' + "".join(kartu(a) for a in sisa) + "</div>") if sisa else ""

hub = (kepala("Artikel — Panduan Jadi Trader Tools",
              "Panduan memakai Jadi Trader Tools dan dasar-dasar trading: "
              "menghubungkan MT5, API Binance, membaca chart, dan mengelola risiko.",
              "/artikel/", lebar=True)
       + '<section class="seksi"><span class="latar-label">ARTIKEL</span>'
         '<h1 class="aula">Artikel</h1>'
         '<p class="aula">Panduan memakai alatnya, dan dasar-dasar yang '
         'membuat alat itu berguna.</p>'
         '<div class="kisi">' + kartu_html + '</div>' + sisa_html + '</section>'
       + EKOR)
io.open(os.path.join(KELUAR, "index.html"), "w", encoding="utf-8").write(hub)
print("  %-52s %5d huruf" % ("(halaman daftar)", len(hub)))

# ── sitemap ─────────────────────────────────────────────────────────────
# Ditulis ULANG seluruhnya, bukan ditambal: sitemap tambalan menumpuk alamat
# artikel yang sudah dihapus dan tidak ada yang mengingatkan.
TETAP = ["/", "/preview", "/akses", "/legal", "/changelog", "/docs", "/artikel/"]
baris = ['<?xml version="1.0" encoding="UTF-8"?>',
         "<!-- Dibuat skrip/bangun-artikel.py. Jangan disunting tangan:",
         "     berkas ini ditulis ULANG tiap kali artikel dibangun. -->",
         '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for j in TETAP:
    baris.append("  <url><loc>%s%s</loc></url>" % (SITUS, j))
for a in A.ARTIKEL:
    baris.append("  <url><loc>%s/artikel/%s/</loc></url>" % (SITUS, a["slug"]))
baris.append("</urlset>")
io.open(os.path.join(AKAR, "public", "sitemap.xml"), "w", encoding="utf-8").write(
    "\n".join(baris) + "\n")

print("\n  %d artikel + 1 halaman daftar" % len(A.ARTIKEL))
print("  sitemap.xml: %d alamat" % (len(TETAP) + len(A.ARTIKEL)))
