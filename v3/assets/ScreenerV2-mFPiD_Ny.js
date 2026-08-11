import{j as a,T as g,L as h}from"./index-D2A3A98b.js";import{r as i}from"./react-CgXm-uqR.js";import{R as x}from"./rotate-ccw-DYJ1kxsR.js";import{E as f}from"./external-link-CC3XhL63.js";import"./firebase-DH9158_C.js";const k="https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html";function y(){const r=window.location.origin,l=window.location.pathname.replace(/\/[^/]*$/,"").replace(/\/v3\/?$/,"");return[...new Set([`${r}${l}/ema-cross-screener_3.html`,`${r}/v2/ema-cross-screener_3.html`,`${r}/ema-cross-screener_3.html`])]}const w=`
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
`;function S(){const[r,s]=i.useState(null),[l,c]=i.useState(!1),[d,p]=i.useState(!1),[u,b]=i.useState(0);return i.useEffect(()=>{let t=!0;return(async()=>{c(!1),p(!1),s(null);for(const e of y())try{const o=await fetch(e,{method:"HEAD"});if(!t)return;if(o.ok){s(e);return}}catch{}t&&s(k)})(),()=>{t=!1}},[u]),i.useEffect(()=>{if(!r||d)return;const t=setTimeout(()=>c(!0),15e3);return()=>clearTimeout(t)},[r,d]),l?a.jsxs("div",{className:"flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center",children:[a.jsx(g,{className:"size-6 text-amber-500",strokeWidth:1.9}),a.jsx("div",{className:"text-[14px] text-zinc-200",children:"Screener tidak bisa dimuat"}),a.jsxs("p",{className:"max-w-md text-[12.5px] leading-relaxed text-zinc-500",children:["Berkas ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"ema-cross-screener_3.html"})," tidak ditemukan di alamat mana pun yang dicoba. Kalau ini di VPS, pastikan foldernya sudah diunggah ke"," ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"/root/v2"}),"."]}),a.jsxs("div",{className:"mt-1 flex flex-wrap justify-center gap-2",children:[a.jsxs("button",{onClick:()=>b(t=>t+1),className:"flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:[a.jsx(x,{className:"size-3.5"})," Coba lagi"]}),a.jsxs("a",{href:"https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html",target:"_blank",rel:"noreferrer",className:"flex items-center gap-1.5 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:["Buka di tab baru ",a.jsx(f,{className:"size-3.5"})]})]})]}):a.jsx("div",{className:"relative",children:a.jsxs("div",{style:{height:"calc(100vh - 56px)"},children:[!d&&a.jsxs("div",{className:"absolute inset-0 flex items-center justify-center gap-2.5 text-[13px] text-zinc-500",children:[a.jsx(h,{className:"size-4 animate-spin"})," Memuat screener…"]}),r&&a.jsx("iframe",{src:r,title:"Crypto Screener",onLoad:t=>{p(!0);try{const e=t.currentTarget.contentDocument;if(!e)return;if(!e.getElementById("jt-v3-tanpa-cangkang")){const n=e.createElement("style");n.id="jt-v3-tanpa-cangkang",n.textContent=w,(e.head||e.documentElement).appendChild(n)}const o=()=>{var n,m;(n=e.body)==null||n.style.setProperty("padding-left","0","important"),(m=e.body)==null||m.style.setProperty("padding-right","0","important")};o(),e.body&&new MutationObserver(o).observe(e.body,{attributes:!0,attributeFilter:["style","class"]})}catch{}},className:"block h-full w-full border-0",sandbox:"allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals",allow:"clipboard-write"})]})})}export{S as default};
