import{j as a,T as g,L as h}from"./index-eGi9_Dkd.js";import{r}from"./react-CgXm-uqR.js";import{R as k}from"./rotate-ccw-B7t1z-iS.js";import{E as y}from"./external-link-DvsaROnK.js";import"./firebase-DH9158_C.js";const x="https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html";function f(){const n=window.location.origin,d=window.location.pathname.replace(/\/[^/]*$/,"").replace(/\/v3\/?$/,"");return[...new Set([`${n}${d}/ema-cross-screener_3.html`,`${n}/v2/ema-cross-screener_3.html`,`${n}/ema-cross-screener_3.html`])]}const w=`
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

  /* ── Latar bercahaya V2 dimatikan ──
     '.v2-cahaya' menaruh dua bola kabur 640 px (emas & hijau) di belakang
     halaman, dan '.v2-grain' menaburkan bintik di atasnya. Keduanya bagus
     saat V2 berdiri sendiri — di dalam bingkai, keduanya jadi tambalan warna
     yang jelas berbeda dari latar rata V3 di sekelilingnya, dan justru
     menegaskan bahwa isi bingkai ini "halaman lain". */
  .v2-cahaya, .v2-grain { display: none !important; }
  body { background: #09090b !important; }

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

  /* ── Kotak Live Trading: bercahaya, bukan bergaris ──
     Ini satu-satunya tempat di halaman yang mengirim uang sungguhan, dan
     pembedanya harus terasa sebelum dibaca. Garis tipis terlihat sama
     dengan belasan kotak lain; cahaya tidak.

     Cahayanya berdenyut pelan — bukan untuk cantik, tapi supaya tetap
     terlihat setelah mata terbiasa. Warna statis apa pun akan hilang dari
     perhatian dalam dua menit. */
  .es-live-trade-config {
    border: 1px solid rgba(16,185,129,.45) !important;
    background: radial-gradient(120% 140% at 50% 0%, rgba(16,185,129,.10), rgba(24,24,27,.5) 62%) !important;
    box-shadow: 0 0 22px 2px rgba(16,185,129,.16), inset 0 1px 0 rgba(255,255,255,.04) !important;
    animation: jtHidupCahaya 3.6s ease-in-out infinite !important;
  }
  @keyframes jtHidupCahaya {
    0%, 100% { box-shadow: 0 0 18px 1px rgba(16,185,129,.13), inset 0 1px 0 rgba(255,255,255,.04); }
    50%      { box-shadow: 0 0 30px 4px rgba(16,185,129,.26), inset 0 1px 0 rgba(255,255,255,.06); }
  }
  /* Yang tidak suka gerakan tetap dapat kotaknya, hanya tanpa denyut. */
  @media (prefers-reduced-motion: reduce) {
    .es-live-trade-config { animation: none !important; }
  }

  /* Scrollbar tipis seperti sisa aplikasi */
  * { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
  *::-webkit-scrollbar { width: 9px; height: 9px; }
  *::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9px; }
  *::-webkit-scrollbar-track { background: transparent; }
`;function z(){const[n,s]=r.useState(null),[d,p]=r.useState(!1),[l,m]=r.useState(!1),[c,b]=r.useState(0);return r.useEffect(()=>{let t=!0;return(async()=>{p(!1),m(!1),s(null);for(const e of f())try{const o=await fetch(e,{method:"HEAD"});if(!t)return;if(o.ok){s(e);return}}catch{}t&&s(x)})(),()=>{t=!1}},[c]),r.useEffect(()=>{if(!n||l)return;const t=setTimeout(()=>p(!0),15e3);return()=>clearTimeout(t)},[n,l]),d?a.jsxs("div",{className:"flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center",children:[a.jsx(g,{className:"size-6 text-amber-500",strokeWidth:1.9}),a.jsx("div",{className:"text-[14px] text-zinc-200",children:"Screener tidak bisa dimuat"}),a.jsxs("p",{className:"max-w-md text-[12.5px] leading-relaxed text-zinc-500",children:["Berkas ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"ema-cross-screener_3.html"})," tidak ditemukan di alamat mana pun yang dicoba. Kalau ini di VPS, pastikan foldernya sudah diunggah ke"," ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"/root/v2"}),"."]}),a.jsxs("div",{className:"mt-1 flex flex-wrap justify-center gap-2",children:[a.jsxs("button",{onClick:()=>b(t=>t+1),className:"flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:[a.jsx(k,{className:"size-3.5"})," Coba lagi"]}),a.jsxs("a",{href:"https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html",target:"_blank",rel:"noreferrer",className:"flex items-center gap-1.5 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:["Buka di tab baru ",a.jsx(y,{className:"size-3.5"})]})]})]}):a.jsx("div",{className:"relative",children:a.jsxs("div",{style:{height:"calc(100vh - 56px)"},children:[!l&&a.jsxs("div",{className:"absolute inset-0 flex items-center justify-center gap-2.5 text-[13px] text-zinc-500",children:[a.jsx(h,{className:"size-4 animate-spin"})," Memuat screener…"]}),n&&a.jsx("iframe",{src:n,title:"Crypto Screener",onLoad:t=>{m(!0);try{const e=t.currentTarget.contentDocument;if(!e)return;if(!e.getElementById("jt-v3-tanpa-cangkang")){const i=e.createElement("style");i.id="jt-v3-tanpa-cangkang",i.textContent=w,(e.head||e.documentElement).appendChild(i)}const o=()=>{var i,u;(i=e.body)==null||i.style.setProperty("padding-left","0","important"),(u=e.body)==null||u.style.setProperty("padding-right","0","important")};o(),e.body&&new MutationObserver(o).observe(e.body,{attributes:!0,attributeFilter:["style","class"]})}catch{}},className:"block h-full w-full border-0",sandbox:"allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals",allow:"clipboard-write"})]})})}export{z as default};
