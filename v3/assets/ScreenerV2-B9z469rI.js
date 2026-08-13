import{j as e,T as h,L as y}from"./index-2HfGcX1D.js";import{u as f,r}from"./react-VF5lU9JK.js";import{R as x}from"./rotate-ccw-BXGlAPGS.js";import{E as w}from"./external-link-D_0-r3Ue.js";import"./firebase-C9MpMDuk.js";const v="https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html";function j(){const s=window.location.origin,d=window.location.pathname.replace(/\/[^/]*$/,"").replace(/\/v3\/?$/,"");return[...new Set([`${s}${d}/ema-cross-screener_3.html`,`${s}/v2/ema-cross-screener_3.html`,`${s}/ema-cross-screener_3.html`])]}const A=`
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

  /* Kotak Live Trading DIBIARKAN seperti aslinya di V2.
     Sempat saya beri cahaya berdenyut; hasilnya lebih ramai, bukan lebih
     jelas — dan gaya aslinya sudah membedakan diri dengan cukup. Tidak ada
     aturan untuk '.es-live-trade-config' di sini, dan itu disengaja. */

  /* Scrollbar tipis seperti sisa aplikasi */
  * { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
  *::-webkit-scrollbar { width: 9px; height: 9px; }
  *::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9px; }
  *::-webkit-scrollbar-track { background: transparent; }
`;function L(){const s=f();r.useEffect(()=>{const t=n=>{if(n.origin!==window.location.origin)return;const a=n.data;if(!a||a.jt!=="buka-chart"||typeof a.simbol!="string")return;const i=new URLSearchParams({simbol:a.simbol});typeof a.tf=="string"&&a.tf&&i.set("tf",a.tf);for(const l of["sl","tp"]){const p=Number(a[l]);isFinite(p)&&p>0&&i.set(l,String(p))}(a.arah==="BUY"||a.arah==="SELL")&&i.set("arah",a.arah),s(`/chart?${i}`)};return window.addEventListener("message",t),()=>window.removeEventListener("message",t)},[s]);const[o,d]=r.useState(null),[b,u]=r.useState(!1),[m,c]=r.useState(!1),[g,k]=r.useState(0);return r.useEffect(()=>{let t=!0;return(async()=>{u(!1),c(!1),d(null);for(const n of j())try{const a=await fetch(n,{method:"HEAD"});if(!t)return;if(a.ok){d(n);return}}catch{}t&&d(v)})(),()=>{t=!1}},[g]),r.useEffect(()=>{if(!o||m)return;const t=setTimeout(()=>u(!0),15e3);return()=>clearTimeout(t)},[o,m]),b?e.jsxs("div",{className:"flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center",children:[e.jsx(h,{className:"size-6 text-amber-500",strokeWidth:1.9}),e.jsx("div",{className:"text-[14px] text-zinc-200",children:"Screener tidak bisa dimuat"}),e.jsxs("p",{className:"max-w-md text-[12.5px] leading-relaxed text-zinc-500",children:["Berkas ",e.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"ema-cross-screener_3.html"})," tidak ditemukan di alamat mana pun yang dicoba. Kalau ini di VPS, pastikan foldernya sudah diunggah ke"," ",e.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"/root/v2"}),"."]}),e.jsxs("div",{className:"mt-1 flex flex-wrap justify-center gap-2",children:[e.jsxs("button",{onClick:()=>k(t=>t+1),className:"flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:[e.jsx(x,{className:"size-3.5"})," Coba lagi"]}),e.jsxs("a",{href:"https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html",target:"_blank",rel:"noreferrer",className:"flex items-center gap-1.5 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:["Buka di tab baru ",e.jsx(w,{className:"size-3.5"})]})]})]}):e.jsx("div",{className:"relative",children:e.jsxs("div",{style:{height:"calc(100vh - 56px)"},children:[!m&&e.jsxs("div",{className:"absolute inset-0 flex items-center justify-center gap-2.5 text-[13px] text-zinc-500",children:[e.jsx(y,{className:"size-4 animate-spin"})," Memuat screener…"]}),o&&e.jsx("iframe",{src:o,title:"Crypto Screener",onLoad:t=>{c(!0);try{const n=t.currentTarget.contentDocument;if(!n)return;if(!n.getElementById("jt-v3-tanpa-cangkang")){const i=n.createElement("style");i.id="jt-v3-tanpa-cangkang",i.textContent=A,(n.head||n.documentElement).appendChild(i)}const a=()=>{var i,l;(i=n.body)==null||i.style.setProperty("padding-left","0","important"),(l=n.body)==null||l.style.setProperty("padding-right","0","important")};a(),n.body&&new MutationObserver(a).observe(n.body,{attributes:!0,attributeFilter:["style","class"]})}catch{}},className:"block h-full w-full border-0",sandbox:"allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals",allow:"clipboard-write"})]})})}export{L as default};
