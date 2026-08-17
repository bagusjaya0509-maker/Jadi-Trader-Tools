import{u as A,m as V,j as T,a,R as B,A as f,p as E,T as L,L as P}from"./index-CqysiTcx.js";import{u as C,r as d,L as j}from"./react-DRIkVFoA.js";import{L as D}from"./lock-0BygMAjp.js";import{R as I}from"./rotate-ccw-CX5A0YeQ.js";import{E as K}from"./external-link-D4xFuIFF.js";import"./firebase-D_y3CBvp.js";const R="https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html";function M(){const s=window.location.origin,u=window.location.pathname.replace(/\/[^/]*$/,"").replace(/\/v3\/?$/,"");return[...new Set([`${s}${u}/ema-cross-screener_3.html`,`${s}/v2/ema-cross-screener_3.html`,`${s}/ema-cross-screener_3.html`])]}const U=`
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

  /* Tombol & panel News PINDAH ke bilah kendali Chart & Entry (komponen
     components/panel-news.tsx, sumber data sama: /api/news). Disembunyikan
     di sini supaya tidak ada dua kalender yang bisa menampilkan isi berbeda
     saat salah satunya gagal memuat. Sama seperti blok di atas: hanya
     disembunyikan, JS kalendernya di V2 tetap utuh dan tetap jalan saat V2
     dibuka berdiri sendiri. */
  .es-econ-calendar-panel { display: none !important; }

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
`;function Y(s){return["inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5",s?"border-zinc-700 bg-zinc-800/40 text-zinc-400":"border-amber-500/30 bg-amber-500/[0.07] text-amber-300"].join(" ")}function W(){const s=C();d.useEffect(()=>{const t=r=>{if(r.origin!==window.location.origin)return;const e=r.data;if(!e||e.jt!=="buka-chart"||typeof e.simbol!="string")return;const n=new URLSearchParams({simbol:e.simbol});typeof e.tf=="string"&&e.tf&&n.set("tf",e.tf);for(const c of["sl","tp"]){const l=Number(e[c]);isFinite(l)&&l>0&&n.set(c,String(l))}(e.arah==="BUY"||e.arah==="SELL")&&n.set("arah",e.arah),s(`/chart?${n}`)};return window.addEventListener("message",t),()=>window.removeEventListener("message",t)},[s]);const[m,u]=d.useState(null),[w,k]=d.useState(!1),[g,h]=d.useState(!1),[v,N]=d.useState(0),{pengguna:z}=A(),p=V()&&!z,[b,S]=d.useState(!p),o=p&&!b&&T("screener");return d.useEffect(()=>{if(!b)return;let t=!0;return(async()=>{k(!1),h(!1),u(null);for(const r of M())try{const e=await fetch(r,{method:"HEAD"});if(!t)return;if(e.ok){u(r);return}}catch{}t&&u(R)})(),()=>{t=!1}},[v,b]),d.useEffect(()=>{if(!m||g)return;const t=setTimeout(()=>k(!0),15e3);return()=>clearTimeout(t)},[m,g]),p&&!b?a.jsx("div",{className:"flex min-h-[70vh] items-center justify-center p-6",children:a.jsxs("div",{className:"w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/40 p-6",children:[a.jsxs("div",{className:Y(o),children:[o?a.jsx(D,{className:"size-4",strokeWidth:2}):a.jsx(B,{className:"size-4",strokeWidth:2}),a.jsx("span",{className:"text-[10.5px] font-semibold uppercase tracking-wider",children:o?"Sudah terpakai":"Sekali lihat"})]}),a.jsx("h1",{className:"mt-4 text-2xl font-medium tracking-tight text-zinc-50",children:o?"Screener Area sudah kamu buka":"Screener Area"}),a.jsx("p",{className:"mt-2 text-[13.5px] leading-relaxed text-zinc-400",children:o?a.jsx(a.Fragment,{children:"Di mode preview, screener berlaku sekali — dan sekali itu sudah lewat. Masuk untuk memakainya tanpa batas, berikut jurnal dan Chart & Entry yang menyimpan hasilnya."}):a.jsxs(a.Fragment,{children:["Pemindai yang membaca ratusan simbol Binance langsung dari pasar: Koin Hunter, Zona Pantau, dan sinyal paralel. Angkanya ",a.jsx("b",{children:"bukan contoh"})," — ini alat yang sesungguhnya, berjalan atas data sekarang."]})}),!o&&a.jsx("ul",{className:"mt-5 flex flex-col gap-2.5 border-t border-zinc-800 pt-5",children:[["Berlaku sekali per kunjungan","Begitu kamu pindah halaman lalu kembali, layarnya tertutup lagi."],["Bukan data contoh","Berbeda dari halaman preview lain — yang ini memindai pasar sungguhan."],["Tidak perlu daftar","Tidak ada yang diminta, dan tidak ada yang disimpan."]].map(([t,r])=>a.jsxs("li",{className:"flex gap-2.5",children:[a.jsx("span",{className:"mt-1.5 size-1 shrink-0 rounded-full bg-zinc-600"}),a.jsxs("div",{children:[a.jsx("div",{className:"text-[12.5px] font-medium text-zinc-200",children:t}),a.jsx("div",{className:"text-[11.5px] leading-relaxed text-zinc-500",children:r})]})]},t))}),a.jsxs("div",{className:"mt-5 flex flex-wrap items-center gap-2.5",children:[o?a.jsxs(j,{to:"/pratinjau",className:"flex items-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white",children:["Masuk untuk membukanya lagi ",a.jsx(f,{className:"size-4"})]}):a.jsxs("button",{onClick:()=>{E("screener"),S(!0)},className:"flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white",children:["Buka Screener Area ",a.jsx(f,{className:"size-4"})]}),a.jsx(j,{to:"/dashboard",className:"rounded-md border border-zinc-800 px-4 py-2.5 text-[13px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:"Kembali ke Dashboard"})]})]})}):w?a.jsxs("div",{className:"flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center",children:[a.jsx(L,{className:"size-6 text-amber-500",strokeWidth:1.9}),a.jsx("div",{className:"text-[14px] text-zinc-200",children:"Screener tidak bisa dimuat"}),a.jsxs("p",{className:"max-w-md text-[12.5px] leading-relaxed text-zinc-500",children:["Berkas ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"ema-cross-screener_3.html"})," tidak ditemukan di alamat mana pun yang dicoba. Kalau ini di VPS, pastikan foldernya sudah diunggah ke"," ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"/root/v2"}),"."]}),a.jsxs("div",{className:"mt-1 flex flex-wrap justify-center gap-2",children:[a.jsxs("button",{onClick:()=>N(t=>t+1),className:"flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:[a.jsx(I,{className:"size-3.5"})," Coba lagi"]}),a.jsxs("a",{href:"https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html",target:"_blank",rel:"noreferrer",className:"flex items-center gap-1.5 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:["Buka di tab baru ",a.jsx(K,{className:"size-3.5"})]})]})]}):a.jsx("div",{className:"relative",children:a.jsxs("div",{style:{height:"calc(100vh - 56px)"},children:[!g&&a.jsxs("div",{className:"absolute inset-0 flex items-center justify-center gap-2.5 text-[13px] text-zinc-500",children:[a.jsx(P,{className:"size-4 animate-spin"})," Memuat screener…"]}),m&&a.jsx("iframe",{src:m,title:"Crypto Screener",onLoad:t=>{var r;h(!0);try{const e=t.currentTarget,n=e.contentDocument;if(!n)return;if(p){const i=e.contentWindow;(r=i==null?void 0:i.jtModeTamu)==null||r.call(i)}if(!n.getElementById("jt-v3-tanpa-cangkang")){const i=n.createElement("style");i.id="jt-v3-tanpa-cangkang",i.textContent=U,(n.head||n.documentElement).appendChild(i)}const c=n.querySelector(".es-pantau-title");c&&(c.textContent="Koin Hunter");const l=n.querySelector('[data-section="crosshunter"] .es-priority-title');l&&(l.textContent="Zona Pantau");const x=()=>{var i,y;(i=n.body)==null||i.style.setProperty("padding-left","0","important"),(y=n.body)==null||y.style.setProperty("padding-right","0","important")};x(),n.body&&new MutationObserver(x).observe(n.body,{attributes:!0,attributeFilter:["style","class"]})}catch{}},className:"block h-full w-full border-0",sandbox:"allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals",allow:"clipboard-write"})]})})}export{W as default};
