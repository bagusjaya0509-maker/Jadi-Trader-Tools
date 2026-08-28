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
    "cara-menghubungkan-mt5-ke-jurnal-trading-otomatis":
        "/artikel/gambar/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis.webp",
    "cara-membuat-api-key-binance-yang-aman":
        "/artikel/gambar/cara-membuat-api-key-binance-yang-aman.webp",
    "kenapa-data-binance-tidak-masuk-di-indonesia":
        "/artikel/gambar/kenapa-data-binance-tidak-masuk-di-indonesia.webp",
    "akun-sen-mt5-jurnal-seratus-kali-lipat":
        "/artikel/gambar/akun-sen-mt5-jurnal-seratus-kali-lipat.webp",
    "cara-memasang-indikator-pine-di-tradingview":
        "/artikel/gambar/cara-memasang-indikator-pine-di-tradingview.webp",
}
GAMBAR_BAWAAN = "/artikel/gambar/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis.webp"

GAYA = """
/* Tipografi diambil dari peraga link-preview Aceternity, diukur langsung di
   situsnya: Inter, latar hitam pekat, paragraf 30px warna rgb(163,163,163),
   kolom 768px, tautan tebal putih tanpa garis bawah. */
:root{--bg:#000;--panel:#0c0c0c;--garis:#262626;--teks:#fafafa;
  --redup:#a3a3a3;--aksen:#fff}
*{box-sizing:border-box}
html{overflow-x:hidden}
body{margin:0;overflow-x:hidden;background:var(--bg);color:var(--teks);
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  font-size:20px;line-height:1.5;-webkit-font-smoothing:antialiased}

.bungkus{max-width:768px;margin:0 auto;padding:28px 20px 96px}
.lebar{max-width:1120px}

header.atas{border-bottom:1px solid var(--garis);margin-bottom:44px;
  padding-bottom:18px;display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}
header.atas a.merek{color:var(--teks);text-decoration:none;font-weight:700;
  font-size:16px;letter-spacing:-.02em}
header.atas nav a{color:var(--redup);text-decoration:none;font-size:15px;
  margin-right:16px}
header.atas nav a:hover{color:var(--teks)}

/* Judul artikel. Besar, putih, rapat — lawan dari badan teks yang renggang
   dan redup; kontras itu yang membuat mata tahu di mana tulisannya mulai. */
h1{font-size:38px;line-height:1.14;letter-spacing:-.03em;margin:0 0 20px;
  color:var(--teks);font-weight:600}
h2{font-size:26px;line-height:1.25;letter-spacing:-.02em;margin:56px 0 18px;
  color:var(--teks);font-weight:600}

p{margin:0 0 26px;color:var(--redup)}
p b,li b,p strong,li strong{color:var(--teks);font-weight:700}
article a{color:var(--teks);font-weight:700;text-decoration:none}
article a:hover{text-decoration:underline;text-underline-offset:4px}

ul,ol{margin:0 0 26px;padding-left:26px;color:var(--redup)}
li{margin-bottom:14px}
li::marker{color:#525252}

code{background:#141414;border:1px solid var(--garis);border-radius:5px;
  padding:1px 7px;font-size:.82em;font-family:ui-monospace,SFMono-Regular,
  Menlo,monospace;color:var(--teks);white-space:nowrap}

.ringkas{color:var(--redup);margin:0 0 34px}
.label{display:inline-block;font-size:12px;letter-spacing:.1em;
  text-transform:uppercase;color:#737373;border:1px solid var(--garis);
  border-radius:99px;padding:3px 11px;margin-bottom:18px}

.catatan{background:var(--panel);border:1px solid var(--garis);
  border-left:2px solid #525252;border-radius:8px;padding:18px 22px;
  margin:0 0 26px;color:var(--redup);font-size:.82em;line-height:1.6}
.catatan b{color:var(--teks)}

.ajakan{background:var(--panel);border:1px solid var(--garis);border-radius:14px;
  padding:28px;margin:56px 0 0}
.ajakan p{margin:0 0 18px;font-size:.8em}
.ajakan a.tombol{display:inline-block;background:var(--teks);color:#000;
  text-decoration:none;font-weight:600;font-size:15px;padding:11px 20px;
  border-radius:8px}
.ajakan a.tombol:hover{text-decoration:none}

.terkait{margin-top:56px;border-top:1px solid var(--garis);padding-top:26px}
.terkait h2{font-size:13px;color:#737373;margin:0 0 14px;
  text-transform:uppercase;letter-spacing:.1em;font-weight:500}
.terkait a{display:inline-block;text-decoration:none;
  color:var(--teks);font-weight:700;font-size:.72em;line-height:1.35}
/* width:fit-content — TANPA ini pembungkusnya selebar kolom, dan kartu
   pratinjau yang dipusatkan dengan left:50% mendarat 87px di kanan
   tautannya. Diukur, bukan dikira. */
.terkait .pratinjau{display:block;width:fit-content;margin-bottom:14px}
.terkait a:hover{text-decoration:underline;text-underline-offset:4px}

footer{margin-top:64px;border-top:1px solid var(--garis);padding-top:24px;
  color:#525252;font-size:14px;line-height:1.6}
footer p{color:#525252;margin:0 0 8px;font-size:14px}
footer a{color:#737373}

/* ── pratinjau tautan: tiruan link-preview.tsx tanpa JavaScript ───────── */
.pratinjau{position:relative;display:inline-block}
.pratinjau > .kartu-p{position:absolute;bottom:calc(100% + 10px);left:50%;
  z-index:20;padding:4px;background:#fff;border:2px solid transparent;
  border-radius:12px;box-shadow:0 20px 45px rgba(0,0,0,.7);
  opacity:0;pointer-events:none;
  transform:translate(-50%,20px) scale(.6);transform-origin:bottom center;
  transition:opacity .18s ease,transform .32s cubic-bezier(.34,1.56,.64,1)}
.pratinjau > .kartu-p img{display:block;width:200px;height:125px;
  object-fit:cover;border-radius:8px}
.pratinjau:hover > .kartu-p,
.pratinjau:focus-within > .kartu-p{opacity:1;transform:translate(-50%,0) scale(1)}
/* Di layar sentuh tidak ada kursor yang melayang, jadi kartunya tidak akan
   pernah muncul — dan kalau ia muncul waktu disentuh, ia justru menutupi
   tautan yang hendak ditekan. */
@media(hover:none){.pratinjau > .kartu-p{display:none}}

/* ── layar lebar: ukuran peraga Aceternity yang sesungguhnya ──────────── */
@media(min-width:768px){
  body{font-size:30px;line-height:1.45}
  h1{font-size:56px}
  h2{font-size:34px;margin-top:72px}
  p{margin-bottom:32px}
  li{margin-bottom:18px}
  header.atas a.merek{font-size:17px}
  header.atas nav a{font-size:16px}
}

/* ── halaman daftar: tiruan blog-posts.tsx ────────────────────────────── */
.seksi{position:relative;margin:40px 0 0;padding:24px 0 0}
.seksi h1.aula{text-align:center;font-size:30px;font-weight:600;
  line-height:1.3;letter-spacing:-.02em;margin:0 0 10px}
.latar-label{position:absolute;top:-40px;left:-8%;z-index:-1;user-select:none;
  font-size:110px;font-weight:800;line-height:1;color:rgba(250,250,250,.03);
  pointer-events:none;white-space:nowrap}
.seksi p.aula{max-width:800px;margin:0 auto 36px;text-align:center;
  font-size:18px;line-height:1.7;color:var(--redup)}
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
.kartu .baca{font-size:16px;font-weight:600;color:#fff}
.kartu svg.panah{flex:none;transition:transform .3s ease}
.kartu:hover svg.panah{transform:translateX(8px)}
.kisi-sisa{display:grid;grid-template-columns:1fr;gap:20px;margin-top:20px}
.kisi-sisa .kartu{min-height:240px}
@media(min-width:768px){
  .kisi{grid-template-columns:1fr 1fr}
  .kisi-sisa{grid-template-columns:1fr 1fr}
  .kartu.utama{grid-column:span 2;grid-row:span 2;min-height:420px}
  .kartu h2{font-size:30px}
  .kartu.utama h2{font-size:36px}
  .seksi h1.aula{font-size:36px}
  .latar-label{font-size:180px}
}
@media(min-width:1024px){
  .kisi{grid-template-columns:1fr .62fr}
  .kisi-sisa{grid-template-columns:repeat(3,1fr)}
  .kartu.utama{grid-column:span 1;grid-row:span 2}
  .latar-label{font-size:340px;left:-16%}
  /* Satu baris, dan ukurannya DITURUNKAN sampai muat — bukan sebaliknya. */
  .seksi h1.aula{font-size:38px;white-space:nowrap}
}
/* 44px membuat teksnya 1.080px di wadah 1.080px — pas, tapi nol sisa. */
@media(min-width:1280px){.seksi h1.aula{font-size:41px}}
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
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


EKOR_SKRIP = """
<!-- Komponen link-preview Aceternity yang SUNGGUHAN — Radix HoverCard +
     framer-motion, dibundel terpisah dari aplikasi. `defer` dan diletakkan
     paling akhir: seluruh teks artikel sudah ada di HTML sebelum berkas ini
     diminta, jadi crawler dan pembaca tanpa JavaScript tidak kehilangan
     satu huruf pun kalau ia gagal dimuat. -->
<script defer src="/artikel-pratinjau.js"></script>
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
                   "".join(
                     '<span class="pratinjau">'
                     '<span class="kartu-p"><img src="%s" width="200" height="125" '
                     'loading="lazy" decoding="async" alt=""></span>'
                     '<a href="/artikel/%s/" data-pratinjau data-gambar="%s">%s</a></span>'
                     % (GAMBAR.get(t["slug"], GAMBAR_BAWAAN), t["slug"],
                        GAMBAR.get(t["slug"], GAMBAR_BAWAAN), esc(t["judul"]))
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
            + ajakan + terkait + EKOR_SKRIP + EKOR)

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

# <title> dan <h1> sengaja BERBEDA. Judul tab harus menyebut topiknya
# supaya terbaca di hasil pencarian ("Artikel — Panduan..."); judul di
# halaman boleh langsung memanggil pembacanya, karena orang yang sudah
# membuka halamannya tidak perlu diberi tahu ia sedang di mana.
hub = (kepala("Artikel — Panduan Jadi Trader Tools",
              A.AULA_DESKRIPSI,
              "/artikel/", lebar=True)
       + '<section class="seksi"><span class="latar-label">%s</span>'
         '<h1 class="aula">%s</h1>'
         '<p class="aula">%s</p>'
         % (esc(A.AULA_LABEL), esc(A.AULA_JUDUL), esc(A.AULA_DESKRIPSI))
       + '<div class="kisi">' + kartu_html + '</div>' + sisa_html + '</section>'
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
