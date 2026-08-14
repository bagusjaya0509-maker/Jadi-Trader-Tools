import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ExternalLink, TriangleAlert, RotateCcw } from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════════
   SCREENER ENTRY — screener V2 yang ASLI, ditanam apa adanya
   ════════════════════════════════════════════════════════════════════════
   Halaman ini sengaja TIDAK menggambar ulang apa pun. Yang tampil adalah
   `ema-cross-screener_3.html` milik V2 — seluruh delapan section-nya, semua
   setelan, semua logic, dan design aslinya, tanpa satu baris pun diubah.

   Kenapa ditanam, bukan diport:
   Screener V2 itu 494 kB dengan delapan section — Sinyal Entry Koin Favorit,
   Cross Hunter, BBMA, AI, News, panel simulasi, panel live trading, dan strip
   rezim BTC. Menulis ulang semuanya ke React berarti setiap putaran revisi
   ada saja yang terlewat, dan itulah keluhan yang membuat halaman ini
   diputuskan begini. Ditanam, tidak ada yang bisa terlewat — karena tidak
   ada yang disalin.

   Bonus yang sebenarnya lebih penting: memperbarui screener V2 langsung
   mengubah halaman ini juga. Tidak ada dua salinan yang bisa menyimpang.

   ── KENAPA SAMA-DOMAIN PENTING ─────────────────────────────────────────
   Firebase menyimpan sesi login di IndexedDB per-origin. Kalau V2 ditanam
   dari domain lain, orang yang sudah masuk di V3 akan diminta masuk lagi di
   dalam bingkainya — dua login untuk satu aplikasi. Karena itu alamat
   sama-domain dicoba lebih dulu, dan GitHub Pages cuma jadi jaring terakhir.
   ════════════════════════════════════════════════════════════════════════ */

/** Alamat cadangan terakhir. TIDAK ikut diperiksa lebih dulu, dan itu
 *  disengaja: ia lintas-domain, jadi `fetch` akan diblokir CORS walaupun
 *  berkasnya ada. Iframe tidak butuh CORS — memeriksanya justru membuat
 *  alamat yang sebenarnya bisa dipakai dianggap gagal. */
const CADANGAN = 'https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html';

/** Kandidat SAMA-DOMAIN, diurut dari yang paling diinginkan. Satu build yang
 *  sama bekerja di GitHub Pages maupun VPS tanpa perlu tahu ia sedang
 *  berjalan di mana. */
function kandidat(): string[] {
  const asal = window.location.origin;
  const jalur = window.location.pathname.replace(/\/[^/]*$/, '');       // …/v3
  const induk = jalur.replace(/\/v3\/?$/, '');                          // …
  return [...new Set([
    `${asal}${induk}/ema-cross-screener_3.html`,   // GitHub Pages: /Jadi-Trader-Tools/
    `${asal}/v2/ema-cross-screener_3.html`,        // VPS: /v2/
    `${asal}/ema-cross-screener_3.html`,           // kalau V3 ada di akar
  ])];
}

/* ── Menyembunyikan cangkang V2 di dalam bingkai ──────────────────────────
   Halaman V2 membawa sidebar, bilah pengguna, dan judul besarnya sendiri.
   Di dalam V3 ketiganya jadi kembar: dua sidebar, dua avatar, dua nama
   aplikasi. Yang dibuang HANYA pembungkusnya — seluruh isi screener,
   setelan, dan logic-nya tetap utuh apa adanya.

   Disuntikkan sebagai CSS, bukan dengan menyunting berkas V2-nya. Berkas
   itu juga dipakai sebagai halaman berdiri sendiri di alamat aslinya, dan
   di sana sidebar-nya justru dibutuhkan.

   `#esHiddenSections` (chip untuk memunculkan kembali section yang dilipat)
   sengaja TIDAK ikut disembunyikan — ia fungsional, bukan hiasan. */
const CSS_TANPA_CANGKANG = `
  /* Spinner emas "memeriksa sesi" milik V2 disembunyikan di sini — V3 sudah
     menampilkan loadernya sendiri, dan dua indikator memuat untuk satu
     halaman terbaca sebagai dua hal yang sedang rusak. Berlaku HANYA saat
     ditempel; V2 yang berdiri sendiri tetap memakai spinnernya. */
  .es-auth-loading{ display:none !important; }

  /* ─────────────────────────────────────────────────────────────────────
     SEMUA di berkas ini hanya menyentuh TAMPILAN, tidak satu pun logic.
     Yang diubah: huruf, warna, radius, dan tiga elemen yang disembunyikan.
     Berkas V2-nya sendiri TIDAK disunting sama sekali — ia tetap utuh dan
     tetap benar saat dibuka sebagai halaman berdiri sendiri.
     ───────────────────────────────────────────────────────────────────── */

  /* Lebar sidebar dinolkan DI SUMBERNYA, bukan dilawan di hilir.
     Cangkang V2 menulis \`body{padding-left:var(--v2-sisi)}\`; mengosongkan
     variabelnya membuat aturan itu menghitung 0 dengan sendirinya — tidak
     ada yang perlu dikalahkan lewat spesifisitas. */
  :root { --v2-sisi: 0px !important; --v2-sisi-kecil: 0px !important; }

  /* Cangkang V2: sidebar, laci, kaki halaman */
  .v2-sisi, .v2-tirai, .v2-buka-laci, #v2Kaki { display: none !important; }
  body, body.v2-ciut { padding-left: 0 !important; }

  /* Bilah pengguna & judul aplikasi — V3 sudah punya keduanya */
  .es-toprow, .es-user-bar { display: none !important; }
  .es-header .es-title { display: none !important; }

  /* ── Panel simulasi & live trading disembunyikan SELURUHNYA ──
     Keputusan pemilik 14 Agu 2026: halaman screener cukup Area Pantau dan
     Parallel Signal. Ringkasan KPI, tabel Posisi Terbuka, Entry Area
     (termasuk kotak Live Trading), dan Riwayat Transaksi — semuanya satu
     blok .es-sim-section — tidak lagi ditampilkan DI SINI.

     Disembunyikan, BUKAN dihapus dari berkas V2-nya: 194 titik di JS V2
     menulis ke elemen-elemen blok ini tanpa penjaga null, jadi menghapus
     DOM-nya membuat seluruh halaman mati oleh TypeError. Dengan CSS,
     mesin simulasinya tetap berjalan diam-diam dan V2 yang dibuka berdiri
     sendiri (tempat live trading tetap dipakai) tidak berubah sama sekali. */
  .es-sim-section { display: none !important; }

  /* ── Huruf & warna mengikuti V3 ── */
  :root {
    --v2-radius: 12px;
  }
  body, .ema-screener, .es-header, button, input, select, textarea {
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  }
  /* Angka tetap tabular seperti di seluruh V3 — digit yang bergeser tiap
     harga berubah memaksa mata mencari ulang posisinya. */
  .es-price, .es-num, .angka, .es-sim-table td, .es-priority-levels,
  .es-card-price, .es-val { font-variant-numeric: tabular-nums !important; }

  .ema-screener { background: #09090b !important; color: #fafafa !important; }

  /* Panel & kartu: HANYA radius yang diseragamkan.
     ────────────────────────────────────────────────────────────────────
     Sempat di sini ada 'border-color' dan 'background' dengan !important,
     dan itu menghapus warna hijau/merah pada kartu sinyal — padahal warna
     itulah isi utamanya: BUY dan SELL dibedakan sebelum tulisannya dibaca.

     Warna netralnya sudah ikut V3 lewat variabel '--panel' dan '--border'
     di blok bawah, jadi tidak ada yang perlu dipaksa di sini. Aksen yang
     memang disengaja V2 dibiarkan hidup. */
  .es-priority-section, .es-card, .es-priority-card, .es-sim-wrap,
  .es-panel, .es-box, .es-news-pop {
    border-radius: 12px !important;
  }

  /* Kontrol: tinggi, radius, dan warna sama dengan <Pilih> di V3 */
  .ema-screener select, .ema-screener input[type="text"], .ema-screener input[type="number"] {
    height: 36px !important;
    border-radius: 6px !important;
    border: 1px solid #27272a !important;
    background: rgba(24,24,27,.6) !important;
    color: #d4d4d8 !important;
    font-size: 12.5px !important;
  }
  .ema-screener button {
    border-radius: 6px !important;
    font-size: 12px !important;
  }
  /* Tombol utama V3 = putih dengan teks gelap */
  .es-scan-btn, .es-priority-scan-btn, .es-pantau-scan-btn {
    background: #fafafa !important;
    color: #09090b !important;
    border: none !important;
    font-weight: 500 !important;
  }

  /* Judul section disamakan dengan PanelHead V3 */
  .es-section-head, .es-priority-header {
    font-size: 15px !important;
    font-weight: 600 !important;
    letter-spacing: -.01em !important;
    color: #fafafa !important;
  }

  /* Hijau/merah disamakan dengan emerald-500 / red-400 milik V3 supaya
     BUY di dalam bingkai tidak berbeda warna dengan BUY di luar bingkai. */
  .es-buy, .es-long, .profit, .es-up { color: #10b981 !important; }
  .es-sell, .es-short, .loss, .es-down { color: #f87171 !important; }

  /* ── Latar bercahaya V2 dimatikan ──
     '.v2-cahaya' menaruh dua bola kabur 640 px (emas & hijau) di belakang
     halaman, dan '.v2-grain' menaburkan bintik di atasnya. Keduanya bagus
     saat V2 berdiri sendiri — di dalam bingkai, keduanya jadi tambalan warna
     yang jelas berbeda dari latar rata V3 di sekelilingnya, dan justru
     menegaskan bahwa isi bingkai ini "halaman lain". */
  .v2-cahaya, .v2-grain { display: none !important; }

  /* Latar abu yang tersisa datang dari variabel tema V2, bukan dari satu
     elemen — '--bg' dan '--panel'-nya beberapa tingkat lebih terang daripada
     zinc-950 milik V3. Diselaraskan DI SUMBERNYA supaya setiap elemen yang
     memakainya ikut benar, tanpa perlu memburu selektor satu per satu. */
  :root, .ema-screener {
    --bg: #09090b !important;
    --bg-2: #09090b !important;
    --panel: rgba(24,24,27,.4) !important;
    --panel-2: rgba(24,24,27,.6) !important;
    --border: rgba(39,39,42,.8) !important;
  }
  html, body, .ema-screener, .es-main, .es-wrap, .es-content {
    background: #09090b !important;
    background-image: none !important;
  }

  /* ── Bayangan jatuh di tiap section dihapus ──
     V2 memakai 'box-shadow: 0 10px 30px rgba(0,0,0,.45)' untuk mengangkat
     panel dari latar. V3 memisahkan panel dengan GARIS, bukan bayangan —
     mencampur keduanya membuat panel di dalam bingkai terlihat melayang di
     atas panel di luarnya.

     Yang TIDAK ikut dimatikan: bayangan pada popup (news, menu koin) — di
     sana bayangan bukan hiasan melainkan penanda bahwa ia mengambang di atas
     halaman, dan tanpa itu popup terbaca menyatu dengan isi di belakangnya. */
  .es-priority-section, .es-card, .es-priority-card, .es-sim-wrap,
  .es-panel, .es-box, .es-pantau-card, .es-chart-box, .es-section {
    box-shadow: none !important;
  }

  /* Kotak Live Trading kini ikut tersembunyi bersama .es-sim-section di
     atas — aturan gaya untuknya tidak lagi diperlukan di sini. */

  /* Scrollbar tipis seperti sisa aplikasi */
  * { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
  *::-webkit-scrollbar { width: 9px; height: 9px; }
  *::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9px; }
  *::-webkit-scrollbar-track { background: transparent; }
`;

export default function ScreenerV2() {
  const arahkan = useNavigate();

  /* Pesan dari dalam bingkai: "buka simbol ini di Chart & Backtest".
     ──────────────────────────────────────────────────────────────────────
     Asal pengirim DIPERIKSA. Tanpa pemeriksaan itu, situs mana pun yang
     kebetulan membingkai halaman ini bisa menyuruhnya berpindah halaman —
     dan pemeriksaan asal adalah satu-satunya hal yang membedakan pesan dari
     tempelan kita sendiri dengan pesan dari orang lain. */
  useEffect(() => {
    const dengar = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.jt !== 'buka-chart' || typeof d.simbol !== 'string') return;
      const q = new URLSearchParams({ simbol: d.simbol });
      if (typeof d.tf === 'string' && d.tf) q.set('tf', d.tf);
      /* SL/TP ikut kalau kartunya punya. Nilainya diperiksa sebagai angka,
         bukan diteruskan apa adanya: pesan dari dalam bingkai tetap masukan
         dari luar, dan alamat halaman bukan tempat untuk teks sembarang. */
      for (const k of ['sl', 'tp'] as const) {
        const n = Number(d[k]);
        if (isFinite(n) && n > 0) q.set(k, String(n));
      }
      if (d.arah === 'BUY' || d.arah === 'SELL') q.set('arah', d.arah);
      arahkan(`/chart?${q}`);
    };
    window.addEventListener('message', dengar);
    return () => window.removeEventListener('message', dengar);
  }, [arahkan]);

  const [alamat, setAlamat] = useState<string | null>(null);
  const [gagal, setGagal] = useState(false);
  const [siap, setSiap] = useState(false);
  const [ronde, setRonde] = useState(0);

  useEffect(() => {
    let hidup = true;
    (async () => {
      setGagal(false); setSiap(false); setAlamat(null);
      for (const u of kandidat()) {
        try {
          /* HEAD, bukan GET: berkasnya 494 kB dan kita cuma perlu tahu ia
             ada. Mengunduhnya dua kali (sekali untuk mengecek, sekali oleh
             iframe) memboroskan kuota orang yang memakai data seluler. */
          const r = await fetch(u, { method: 'HEAD' });
          if (!hidup) return;
          if (r.ok) { setAlamat(u); return; }
        } catch {
          /* Berkasnya tidak ada di alamat ini — lanjut, bukan menyerah. */
        }
      }
      /* Tidak ada yang sama-domain. Pakai cadangan tanpa diperiksa: iframe
         tidak butuh CORS, jadi ia tetap bisa memuatnya walaupun `fetch`
         tidak akan pernah bisa membuktikannya lebih dulu. Konsekuensinya
         login di dalam bingkai jadi terpisah — itu harga yang dibayar, dan
         lebih baik daripada halaman kosong. */
      if (hidup) setAlamat(CADANGAN);
    })();
    return () => { hidup = false; };
  }, [ronde]);

  /* Iframe lintas-domain tidak memberi tahu kalau isinya gagal dimuat —
     `onError` hampir tidak pernah terpanggil, dan `onLoad` tetap menyala
     untuk halaman error. Jadi kegagalan diukur dari waktu: kalau setelah
     15 detik bingkainya belum juga selesai, yang dilihat orang adalah layar
     kosong tanpa penjelasan, dan itu yang harus diganti dengan pesan. */
  useEffect(() => {
    if (!alamat || siap) return;
    const t = setTimeout(() => setGagal(true), 15_000);
    return () => clearTimeout(t);
  }, [alamat, siap]);

  if (gagal) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <TriangleAlert className="size-6 text-amber-500" strokeWidth={1.9} />
        <div className="text-[14px] text-zinc-200">Screener tidak bisa dimuat</div>
        <p className="max-w-md text-[12.5px] leading-relaxed text-zinc-500">
          Berkas <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]">ema-cross-screener_3.html</code> tidak
          ditemukan di alamat mana pun yang dicoba. Kalau ini di VPS, pastikan foldernya sudah diunggah ke{' '}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]">/root/v2</code>.
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setRonde((v) => v + 1)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white"
          >
            <RotateCcw className="size-3.5" /> Coba lagi
          </button>
          <a
            href="https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html"
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            Buka di tab baru <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Tinggi dihitung dari tinggi layar dikurangi bilah atas (56 px).
          Memakai h-full tidak bekerja: induknya tidak punya tinggi pasti,
          dan iframe tanpa tinggi runtuh jadi nol piksel. */}
      <div style={{ height: 'calc(100vh - 56px)' }}>
        {!siap && (
          <div className="absolute inset-0 flex items-center justify-center gap-2.5 text-[13px] text-zinc-500">
            <Loader2 className="size-4 animate-spin" /> Memuat screener…
          </div>
        )}
        {alamat && (
          <iframe
            src={alamat}
            title="Crypto Screener"
            onLoad={(e) => {
              setSiap(true);
              /* Hanya bisa kalau sama-domain. Kalau bingkainya terpaksa
                 memakai alamat cadangan lintas-domain, akses ini melempar —
                 dan itu tidak apa-apa: screener-nya tetap jalan, cuma
                 cangkang V2-nya ikut kelihatan. */
              try {
                const d = (e.currentTarget as HTMLIFrameElement).contentDocument;
                if (!d) return;
                if (!d.getElementById('jt-v3-tanpa-cangkang')) {
                  const s = d.createElement('style');
                  s.id = 'jt-v3-tanpa-cangkang';
                  s.textContent = CSS_TANPA_CANGKANG;
                  (d.head || d.documentElement).appendChild(s);
                }
                /* Nama section diganti DI TAMPILAN, bukan di berkas V2.
                   Nama lama ("Area Pantau", "Parallel Signal") tertanam di
                   localStorage V2 (chip section tersembunyi), di notifikasi,
                   dan di dokumentasi — menyuntingnya di sumber berarti
                   memburu semua itu sekaligus. Di sini cukup dua judul yang
                   terlihat orang. Selektor Parallel Signal lewat induknya
                   [data-section] karena kelas .es-priority-title dipakai
                   tiga section berbeda. */
                const j1 = d.querySelector('.es-pantau-title');
                if (j1) j1.textContent = 'Screener Tools';
                const j2 = d.querySelector('[data-section="crosshunter"] .es-priority-title');
                if (j2) j2.textContent = 'Zona Pantau';
                /* Padding kiri body diatur langsung di elemennya, bukan lewat
                   stylesheet. Aturan `body{padding-left:0!important}` di CSS
                   di atas terbukti TIDAK menang — isi halaman tetap mulai di
                   68 px (lebar sidebar yang sudah disembunyikan). Gaya inline
                   ber-!important adalah satu-satunya yang pasti menang, dan
                   ini bukan tempat untuk menebak-nebak cascade. */
                const pasang = () => {
                  d.body?.style.setProperty('padding-left', '0', 'important');
                  d.body?.style.setProperty('padding-right', '0', 'important');
                };
                pasang();
                /* Cangkang V2 mengubah padding lagi saat sidebar dilipat atau
                   layar diputar. Pengamat ini mengembalikannya tanpa perlu
                   tahu kapan itu terjadi. */
                if (d.body) {
                  new MutationObserver(pasang).observe(d.body, {
                    attributes: true, attributeFilter: ['style', 'class'],
                  });
                }
              } catch {
                /* lintas-domain — biarkan apa adanya */
              }
            }}
            className="block h-full w-full border-0"
            /* allow-same-origin WAJIB: tanpa itu Firebase di dalam bingkai
               tidak bisa membaca IndexedDB, dan orang yang sudah masuk di V3
               diminta masuk lagi di sini. */
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals"
            allow="clipboard-write"
          />
        )}
      </div>


    </div>
  );
}
