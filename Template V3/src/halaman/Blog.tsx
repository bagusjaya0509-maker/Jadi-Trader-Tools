import React from 'react';
import { ARTIKEL } from '@/artikel/isi';

/* ════════════════════════════════════════════════════════════════════════
   HALAMAN /blog — PERAGA TEMA BLOGGER MILIK PEMILIK
   ════════════════════════════════════════════════════════════════════════
   Pemilik mengirim theme-7044701662345343888.xml (tema Blogger yang dipakai
   karyahukum.com) dan minta dilihat seperti apa halaman artikel kalau
   memakai tampilan itu.

   ── ANGKANYA DIUKUR, BUKAN DIKIRA ───────────────────────────────────────
   Palet dan huruf diambil dari dua sumber, dan keduanya diperiksa:

     • dari XML-nya   — #00857c (primer), #fdfdfd (permukaan), #272733
                        (teks), #f3f4f6 (latar), #d2d7e2 (garis),
                        radius 7/12/15/20px, pil 100px
     • dari situsnya  — diukur langsung di karyahukum.com lewat
                        getComputedStyle: body 14px/21px, judul pos
                        16,38px/500, latar rgb(243,244,246), teks
                        rgb(39,39,51)

   ── INI TERANG, DAN ITU MEMANG TEMANYA ──────────────────────────────────
   Seluruh situs Jadi Trader gelap. Tema ini terang, dan menggelapkannya
   berarti bukan lagi tema yang diminta dilihat. Jadi halaman ini sengaja
   berdiri sendiri: ia tidak memakai token warna aplikasi sama sekali, dan
   tidak satu pun kelas di sini bocor ke halaman lain karena semuanya
   disarangkan di bawah .blog-tema.

   ── HURUFNYA ────────────────────────────────────────────────────────────
   Open Sauce One tidak ada di Google Fonts. Tema aslinya memuatnya dari
   cdn.statically.io, dan alamat itu dipakai apa adanya di sini — kalau
   nanti mau dipakai sungguhan, berkasnya sebaiknya diinangkan sendiri
   supaya tidak bergantung pada CDN pihak ketiga.

   ── DATANYA SUNGGUHAN ───────────────────────────────────────────────────
   Sembilan artikel di bawah dibaca dari src/artikel/isi.ts — berkas yang
   ditulis perender artikel dan selama ini tidak diimpor siapa pun. Jadi
   yang terlihat di sini judul, ringkasan, gambar, dan waktu baca yang
   sama persis dengan /artikel/, bukan teks contoh.
   ════════════════════════════════════════════════════════════════════════ */

const GAYA = `
@font-face{font-family:'Open Sauce One';font-style:normal;font-weight:400;
  font-display:swap;src:local('Open Sauce One'),
  url('https://cdn.statically.io/gh/igniel/Open-Sauce-Fonts/6eea53f9/fonts/OpenSauceOne-Regular.ttf') format('truetype')}
@font-face{font-family:'Open Sauce One';font-style:normal;font-weight:500;
  font-display:swap;src:local('Open Sauce One'),
  url('https://cdn.statically.io/gh/igniel/Open-Sauce-Fonts/6eea53f9/fonts/OpenSauceOne-Medium.ttf') format('truetype')}
@font-face{font-family:'Open Sauce One';font-style:normal;font-weight:700;
  font-display:swap;src:local('Open Sauce One'),
  url('https://cdn.statically.io/gh/igniel/Open-Sauce-Fonts/6eea53f9/fonts/OpenSauceOne-Bold.ttf') format('truetype')}

.blog-tema{
  --primer:#00857c; --permukaan:#fdfdfd; --latar:#f3f4f6;
  --teks:#272733; --redup:#536471; --garis:#d2d7e2; --syn:#f4f6fa;
  --font:'Open Sauce One',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;
  background:var(--latar); color:var(--teks); font-family:var(--font);
  font-size:14px; line-height:1.5; min-height:100vh;
  -webkit-font-smoothing:antialiased;
}
.blog-tema *{box-sizing:border-box}
.blog-tema a{color:inherit;text-decoration:none}

/* ── kepala ───────────────────────────────────────────────────────────── */
.blog-tema .kepala{position:sticky;top:0;z-index:30;background:var(--permukaan);
  border-bottom:1px solid var(--garis)}
.blog-tema .kepala .isi{max-width:1150px;margin:0 auto;padding:14px 20px;
  display:flex;align-items:center;gap:28px}
.blog-tema .merek{display:flex;align-items:center;gap:8px;font-weight:700;
  font-size:15px;letter-spacing:-.01em}
.blog-tema .merek .kotak{width:26px;height:26px;border-radius:7px;
  background:var(--primer);color:#fff;display:grid;place-items:center;
  font-weight:700;font-size:14px}
.blog-tema .kepala nav{display:flex;gap:22px;font-size:14px;color:var(--teks)}
.blog-tema .kepala nav a:hover{color:var(--primer)}
.blog-tema .kepala .alat{margin-left:auto;display:flex;gap:14px;color:var(--redup)}
.blog-tema .kepala .alat span{width:30px;height:30px;border-radius:100px;
  display:grid;place-items:center;background:var(--syn);font-size:13px}

/* ── kerangka dua kolom ───────────────────────────────────────────────── */
.blog-tema .wadah{max-width:1150px;margin:0 auto;padding:24px 20px 60px}
.blog-tema .dua{display:grid;grid-template-columns:1fr;gap:24px;margin-top:24px}
@media(min-width:900px){.blog-tema .dua{grid-template-columns:1fr 280px}}

/* ── sorotan ──────────────────────────────────────────────────────────── */
.blog-tema .sorot{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:760px){.blog-tema .sorot{grid-template-columns:1.6fr 1fr}}
.blog-tema .sorot a{position:relative;display:flex;flex-direction:column;
  justify-content:flex-end;min-height:190px;border-radius:12px;overflow:hidden;
  background-size:cover;background-position:center;color:#fff;padding:16px}
.blog-tema .sorot a::after{content:'';position:absolute;inset:0;
  background:linear-gradient(to top,rgba(0,0,0,.78),rgba(0,0,0,.1) 70%)}
.blog-tema .sorot .teks{position:relative;z-index:1}
.blog-tema .chip{display:inline-block;background:var(--primer);color:#fff;
  font-size:11px;font-weight:500;padding:4px 9px;border-radius:5px;margin-bottom:8px}
.blog-tema .sorot h3{margin:0;font-size:16.38px;font-weight:500;line-height:1.35}

/* ── daftar pos ───────────────────────────────────────────────────────── */
.blog-tema .judul-seksi{font-size:14px;font-weight:500;margin:0 0 12px;
  color:var(--teks)}
.blog-tema .pos{background:var(--permukaan);border:1px solid var(--garis);
  border-radius:12px;padding:14px;display:grid;grid-template-columns:1fr;
  gap:14px;margin-bottom:14px}
@media(min-width:560px){.blog-tema .pos{grid-template-columns:200px 1fr}}
.blog-tema .pos .gbr{border-radius:7px;overflow:hidden;background:var(--syn);
  aspect-ratio:4/3;background-size:cover;background-position:center}
.blog-tema .pos .tgl{font-size:.785rem;color:var(--redup);margin-bottom:5px}
.blog-tema .pos h3{margin:0 0 7px;font-size:16.38px;font-weight:500;
  line-height:1.35}
.blog-tema .pos h3:hover{color:var(--primer)}
.blog-tema .pos p{margin:0 0 9px;font-size:.9rem;color:var(--redup);
  line-height:1.55}
.blog-tema .tag{font-size:.785rem;color:var(--primer)}

/* ── bilah samping ────────────────────────────────────────────────────── */
.blog-tema .kartu-sisi{background:var(--permukaan);border:1px solid var(--garis);
  border-radius:12px;padding:18px;margin-bottom:16px}
.blog-tema .profil{text-align:center}
.blog-tema .profil .ava{width:72px;height:72px;border-radius:100px;margin:0 auto 10px;
  background:var(--primer);color:#fff;display:grid;place-items:center;
  font-size:26px;font-weight:700}
.blog-tema .profil h4{margin:0 0 4px;font-size:15px;font-weight:500}
.blog-tema .profil .lok{font-size:.785rem;color:var(--redup);margin-bottom:10px}
.blog-tema .profil p{margin:0 0 12px;font-size:.9rem;color:var(--redup);line-height:1.55}
.blog-tema .tombol{display:inline-block;background:var(--primer);color:#fff;
  font-size:.9rem;font-weight:500;padding:9px 18px;border-radius:100px}
.blog-tema .kartu-sisi h5{margin:0 0 12px;font-size:14px;font-weight:500}
.blog-tema .mini{display:flex;gap:11px;margin-bottom:13px}
.blog-tema .mini .gbr{width:58px;height:58px;flex:none;border-radius:7px;
  background-size:cover;background-position:center;background-color:var(--syn)}
.blog-tema .mini span{font-size:.9rem;line-height:1.4}
.blog-tema .mini:hover span{color:var(--primer)}
.blog-tema .label{display:flex;flex-wrap:wrap;gap:7px}
.blog-tema .label a{background:var(--syn);border:1px solid var(--garis);
  border-radius:100px;padding:5px 12px;font-size:.785rem;color:var(--redup)}
.blog-tema .label a:hover{background:var(--primer);color:#fff;border-color:var(--primer)}

/* ── kaki ─────────────────────────────────────────────────────────────── */
.blog-tema .kaki{background:var(--permukaan);border-top:1px solid var(--garis);
  padding:26px 20px;text-align:center;font-size:.785rem;color:var(--redup)}
`;

const TGL = ['30 Agustus 2026', '30 Agustus 2026', '29 Agustus 2026', '28 Agustus 2026',
             '28 Agustus 2026', '27 Agustus 2026', '27 Agustus 2026', '27 Agustus 2026',
             '27 Agustus 2026'];

const Blog: React.FC = () => {
  const sorot = ARTIKEL.slice(0, 2);
  const daftar = ARTIKEL.slice(2);
  const populer = ARTIKEL.slice(0, 4);
  const label = Array.from(new Set(ARTIKEL.map((a) => (a.jenis === 'fitur' ? 'Panduan alat' : 'Dasar trading'))));

  return (
    <div className="blog-tema">
      <style>{GAYA}</style>

      <header className="kepala">
        <div className="isi">
          <a className="merek" href="/blog">
            <span className="kotak">J</span> JADI TRADER TOOLS
          </a>
          <nav>
            <a href="/artikel/">Artikel</a>
            <a href="/preview">Coba gratis</a>
            <a href="/akses">Harga</a>
            <a href="/docs">Dokumentasi</a>
          </nav>
          <div className="alat">
            <span>☾</span><span>⌕</span><span>☰</span>
          </div>
        </div>
      </header>

      <div className="wadah">
        <div className="sorot">
          {sorot.map((a) => (
            <a key={a.slug} href={`/artikel/${a.slug}/`}
               style={{ backgroundImage: `url(${a.gambar})` }}>
              <span className="teks">
                <span className="chip">{a.jenis === 'fitur' ? 'Panduan alat' : 'Dasar trading'}</span>
                <h3>{a.judul}</h3>
              </span>
            </a>
          ))}
        </div>

        <div className="dua">
          <main>
            <p className="judul-seksi">Baru Diposting</p>
            {daftar.map((a, i) => (
              <article className="pos" key={a.slug}>
                <a className="gbr" href={`/artikel/${a.slug}/`}
                   style={{ backgroundImage: `url(${a.gambar})` }} aria-label={a.judul} />
                <div>
                  <div className="tgl">{TGL[i + 2] ?? TGL[TGL.length - 1]}</div>
                  <a href={`/artikel/${a.slug}/`}><h3>{a.judul}</h3></a>
                  <p>{a.ringkas}</p>
                  <span className="tag">
                    #{a.jenis === 'fitur' ? 'PanduanAlat' : 'DasarTrading'} · {a.menit} menit baca
                  </span>
                </div>
              </article>
            ))}
          </main>

          <aside>
            <div className="kartu-sisi profil">
              <div className="ava">J</div>
              <h4>Jadi Trader Tools</h4>
              <div className="lok">Indonesia</div>
              <p>Chart replay, screener, dan jurnal trading otomatis — dalam satu halaman.</p>
              <a className="tombol" href="/preview">Coba gratis</a>
            </div>

            <div className="kartu-sisi">
              <h5>Paling Dibaca</h5>
              {populer.map((a) => (
                <a className="mini" key={a.slug} href={`/artikel/${a.slug}/`}>
                  <span className="gbr" style={{ backgroundImage: `url(${a.gambar})` }} />
                  <span>{a.judul}</span>
                </a>
              ))}
            </div>

            <div className="kartu-sisi">
              <h5>Label</h5>
              <div className="label">
                {label.map((l) => <a key={l} href="/artikel/">{l}</a>)}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <footer className="kaki">
        Edukasi, bukan rekomendasi finansial. Trading mengandung risiko kehilangan modal.
        <br />jaditrader.co.id
      </footer>
    </div>
  );
};

export default Blog;
