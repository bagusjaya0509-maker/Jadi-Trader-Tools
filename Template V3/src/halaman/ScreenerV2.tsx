import { useEffect, useState } from 'react';
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

  /* Backend URL & App Token di Area Entry — tempatnya di Integrations.
     Disembunyikan lewat induk labelnya supaya label ikut hilang, bukan
     menyisakan tulisan yang menggantung tanpa kolom isian. */
  .es-live-trade-config label:has(#esLiveBackendUrl),
  .es-live-trade-config label:has(#esLiveAppToken) { display: none !important; }

  /* ── Huruf & warna mengikuti V3 ── */
  :root {
    --v2-radius: 12px;
  }
  body, .ema-screener, .es-header, button, input, select, textarea {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  }
  /* Angka tetap tabular seperti di seluruh V3 — digit yang bergeser tiap
     harga berubah memaksa mata mencari ulang posisinya. */
  .es-price, .es-num, .angka, .es-sim-table td, .es-priority-levels,
  .es-card-price, .es-val { font-variant-numeric: tabular-nums !important; }

  .ema-screener { background: #09090b !important; color: #fafafa !important; }

  /* Panel & kartu: radius, garis, dan latar disamakan dengan Panel V3 */
  .es-priority-section, .es-card, .es-priority-card, .es-sim-wrap,
  .es-panel, .es-box, .es-news-pop {
    border-radius: 12px !important;
    border-color: rgba(39,39,42,.8) !important;
    background: rgba(24,24,27,.4) !important;
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

  /* Scrollbar tipis seperti sisa aplikasi */
  * { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
  *::-webkit-scrollbar { width: 9px; height: 9px; }
  *::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9px; }
  *::-webkit-scrollbar-track { background: transparent; }
`;

export default function ScreenerV2() {
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
