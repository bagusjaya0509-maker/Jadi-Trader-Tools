import{d as D,m as I,j as C,e as a,R,A,p as U,T as M,L as H}from"./index-CPZHi7X7.js";import{r,u as Y,L as h}from"./react-C97iXi1P.js";import{u as J,p as _,L as G}from"./paket-0VRhT3gP.js";import{L as $}from"./lock-DbJNNqgb.js";import{R as F}from"./rotate-ccw-C84emLaX.js";import{E as W}from"./external-link-BiNF8xvW.js";import"./firebase-D_y3CBvp.js";const O="https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html";function q(){const d=window.location.origin,p=window.location.pathname.replace(/\/[^/]*$/,"").replace(/\/v3\/?$/,"");return[...new Set([`${d}${p}/ema-cross-screener_3.html`,`${d}/v2/ema-cross-screener_3.html`,`${d}/ema-cross-screener_3.html`])]}const Z=`
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

  /* ══════════════════════════════════════════════════════════════════
     TEMA TERANG — BLOK TERPISAH, DI UJUNG, TIDAK MENYENTUH APA PUN DI ATAS
     ══════════════════════════════════════════════════════════════════
     Percobaan pertama keliru dan sempat tayang: seluruh warna di atas
     diubah jadi var(--color-zinc-*) supaya ikut tema. Nilai gelapnya
     memang terbukti identik — sudah diukur satu per satu — tapi yang
     TIDAK ikut diubah adalah variabel TEKS milik V2 sendiri:

         --text:#ece8de   --muted:#9a9ca4   --dim:#63656d

     Jadi latarnya memutih sementara tintanya tetap krem. Hasilnya bukan
     "belum selesai", melainkan lebih buruk daripada sebelumnya: yang tadi
     gelap-tapi-terbaca jadi terang-dan-tidak-terbaca. Nilai gelap di atas
     sudah dikembalikan persis seperti semula.

     Sekarang terangnya hidup di sini, di balik [data-tema='terang'].
     Selama atribut itu tidak ada di <html>, tidak satu pun baris di bawah
     ikut dihitung peramban — bukan "ditimpa nilai gelap", melainkan tidak
     pernah aktif. Tema gelap tidak bisa rusak oleh blok ini, dan itu
     jaminan susunannya, bukan janji saya.

     Warnanya memakai tangga slate yang sama dengan tema terang V3 supaya
     bingkai dan isinya tidak berbeda keluarga abu. */

  [data-tema='terang'] .ema-screener {
    background: #ffffff !important;
    color: #0f172a !important;
  }
  /* Variabel V2 diselaraskan DI SUMBERNYA — termasuk tiga variabel teks
     yang terlewat waktu itu. Menambal per selektor berarti memburu
     puluhan tempat dan tetap meninggalkan yang belum ketemu. */
  [data-tema='terang'], [data-tema='terang'] .ema-screener {
    --bg: #ffffff !important;
    --bg-2: #ffffff !important;
    --panel: #f8fafc !important;
    --panel-2: #f1f5f9 !important;
    --border: #e2e8f0 !important;
    --text: #0f172a !important;
    --muted: #64748b !important;
    --dim: #94a3b8 !important;
  }
  [data-tema='terang'] html, [data-tema='terang'] body,
  [data-tema='terang'] .ema-screener, [data-tema='terang'] .es-main,
  [data-tema='terang'] .es-wrap, [data-tema='terang'] .es-content {
    background: #ffffff !important;
  }
  [data-tema='terang'] .ema-screener select,
  [data-tema='terang'] .ema-screener input[type="text"],
  [data-tema='terang'] .ema-screener input[type="number"] {
    border-color: #e2e8f0 !important;
    background: #ffffff !important;
    color: #334155 !important;
  }
  /* Tombol utama ikut berbalik: di tema gelap ia putih dengan teks gelap,
     jadi di tema terang ia gelap dengan teks putih. "Putih" di sana
     berarti "permukaan paling menonjol", bukan putih harfiah. */
  [data-tema='terang'] .es-scan-btn,
  [data-tema='terang'] .es-priority-scan-btn,
  [data-tema='terang'] .es-pantau-scan-btn {
    background: #0f172a !important;
    color: #ffffff !important;
  }
  [data-tema='terang'] .es-section-head,
  [data-tema='terang'] .es-priority-header {
    color: #0f172a !important;
  }
  [data-tema='terang'] * {
    scrollbar-color: #cbd5e1 transparent !important;
  }
  [data-tema='terang'] *::-webkit-scrollbar-thumb {
    background: #cbd5e1 !important;
  }
`;function Q(d){return["inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5",d?"border-zinc-700 bg-zinc-800/40 text-zinc-400":"border-amber-500/30 bg-amber-500/[0.07] text-amber-300"].join(" ")}function sa(){const d=r.useRef(null),u=r.useCallback(()=>{var e;try{const n=(e=d.current)==null?void 0:e.contentDocument;if(!(n!=null&&n.documentElement))return;const t=document.documentElement.getAttribute("data-tema");t?n.documentElement.setAttribute("data-tema",t):n.documentElement.removeAttribute("data-tema")}catch{}},[]);r.useEffect(()=>{u();const e=new MutationObserver(u);return e.observe(document.documentElement,{attributes:!0,attributeFilter:["data-tema"]}),()=>e.disconnect()},[u]);const p=Y();r.useEffect(()=>{const e=n=>{if(n.origin!==window.location.origin)return;const t=n.data;if(!t||t.jt!=="buka-chart"||typeof t.simbol!="string")return;const i=new URLSearchParams({simbol:t.simbol});typeof t.tf=="string"&&t.tf&&i.set("tf",t.tf);for(const c of["sl","tp"]){const m=Number(t[c]);isFinite(m)&&m>0&&i.set(c,String(m))}(t.arah==="BUY"||t.arah==="SELL")&&i.set("arah",t.arah),p(`/chart-entry?${i}`)};return window.addEventListener("message",e),()=>window.removeEventListener("message",e)},[p]);const[b,f]=r.useState(null),[E,j]=r.useState(!1),[x,w]=r.useState(!1),[T,V]=r.useState(0),{pengguna:y}=D(),l=I()&&!y,{paket:v,muatUlang:N}=J(),[P,g]=r.useState(null),[B,L]=r.useState("");r.useEffect(()=>{if(l||!y){g(!0);return}const e="jt.paket.screener.sesi";let n=!1;return(async()=>{try{if(sessionStorage.getItem(e)==="1"){n||g(!0);return}}catch{}const t=await _("screener");if(!n){if(t.boleh){try{sessionStorage.setItem(e,"1")}catch{}g(!0)}else L(t.alasan??"Jatah screener paket ini sudah habis."),g(!1);N()}})(),()=>{n=!0}},[l,y,N]);const[k,K]=r.useState(!l),o=l&&!k&&C("screener");return r.useEffect(()=>{if(!k)return;let e=!0;return(async()=>{j(!1),w(!1),f(null);for(const n of q())try{const t=await fetch(n,{method:"HEAD"});if(!e)return;if(t.ok){f(n);return}}catch{}e&&f(O)})(),()=>{e=!1}},[T,k]),r.useEffect(()=>{if(!b||x)return;const e=setTimeout(()=>j(!0),15e3);return()=>clearTimeout(e)},[b,x]),P===!1?a.jsx("div",{className:"flex min-h-[70vh] items-center justify-center p-6",children:a.jsxs("div",{className:"w-full max-w-lg rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-6",children:[a.jsx("div",{className:"text-[14px] font-medium text-amber-300",children:"Jatah Screener sudah habis"}),a.jsxs("p",{className:"mt-2 text-[12.5px] leading-relaxed text-zinc-400",children:[B," Paket ",a.jsx("span",{className:"text-zinc-200",children:G[v.paket]})," memberi"," ",a.jsx("span",{className:"angka text-zinc-200",children:v.batas.screener})," kali akses per masa aktif, dan semuanya sudah terpakai. Jatahnya kembali penuh saat masa aktifmu diperpanjang."]}),a.jsxs("div",{className:"mt-4 flex flex-wrap gap-2",children:[a.jsx(h,{to:"/harga",className:"rounded-md bg-zinc-100 px-4 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:"Lihat paket tanpa batas"}),a.jsx(h,{to:"/dashboard",className:"rounded-md border border-zinc-800 px-4 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700",children:"Kembali ke Dashboard"})]})]})}):l&&!k?a.jsx("div",{className:"flex min-h-[70vh] items-center justify-center p-6",children:a.jsxs("div",{className:"w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/40 p-6",children:[a.jsxs("div",{className:Q(o),children:[o?a.jsx($,{className:"size-4",strokeWidth:2}):a.jsx(R,{className:"size-4",strokeWidth:2}),a.jsx("span",{className:"text-[10.5px] font-semibold uppercase tracking-wider",children:o?"Sudah terpakai":"Sekali lihat"})]}),a.jsx("h1",{className:"mt-4 text-2xl font-medium tracking-tight text-zinc-50",children:o?"Screener Area sudah kamu buka":"Screener Area"}),a.jsx("p",{className:"mt-2 text-[13.5px] leading-relaxed text-zinc-400",children:o?a.jsx(a.Fragment,{children:"Di mode preview, screener berlaku sekali — dan sekali itu sudah lewat. Masuk untuk memakainya tanpa batas, berikut jurnal dan Chart & Entry yang menyimpan hasilnya."}):a.jsxs(a.Fragment,{children:["Pemindai yang membaca ratusan simbol Binance langsung dari pasar: Koin Hunter, Zona Pantau, dan sinyal paralel. Angkanya ",a.jsx("b",{children:"bukan contoh"})," — ini alat yang sesungguhnya, berjalan atas data sekarang."]})}),!o&&a.jsx("ul",{className:"mt-5 flex flex-col gap-2.5 border-t border-zinc-800 pt-5",children:[["Berlaku sekali per kunjungan","Begitu kamu pindah halaman lalu kembali, layarnya tertutup lagi."],["Bukan data contoh","Berbeda dari halaman preview lain — yang ini memindai pasar sungguhan."],["Tidak perlu daftar","Tidak ada yang diminta, dan tidak ada yang disimpan."]].map(([e,n])=>a.jsxs("li",{className:"flex gap-2.5",children:[a.jsx("span",{className:"mt-1.5 size-1 shrink-0 rounded-full bg-zinc-600"}),a.jsxs("div",{children:[a.jsx("div",{className:"text-[12.5px] font-medium text-zinc-200",children:e}),a.jsx("div",{className:"text-[11.5px] leading-relaxed text-zinc-500",children:n})]})]},e))}),a.jsxs("div",{className:"mt-5 flex flex-wrap items-center gap-2.5",children:[o?a.jsxs(h,{to:"/tour",className:"flex items-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white",children:["Masuk untuk membukanya lagi ",a.jsx(A,{className:"size-4"})]}):a.jsxs("button",{onClick:()=>{U("screener"),K(!0)},className:"flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white",children:["Buka Screener Area ",a.jsx(A,{className:"size-4"})]}),a.jsx(h,{to:"/dashboard",className:"rounded-md border border-zinc-800 px-4 py-2.5 text-[13px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:"Kembali ke Dashboard"})]})]})}):E?a.jsxs("div",{className:"flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center",children:[a.jsx(M,{className:"size-6 text-amber-500",strokeWidth:1.9}),a.jsx("div",{className:"text-[14px] text-zinc-200",children:"Screener tidak bisa dimuat"}),a.jsxs("p",{className:"max-w-md text-[12.5px] leading-relaxed text-zinc-500",children:["Berkas ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"ema-cross-screener_3.html"})," tidak ditemukan di alamat mana pun yang dicoba. Kalau ini di VPS, pastikan foldernya sudah diunggah ke"," ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"/root/v2"}),"."]}),a.jsxs("div",{className:"mt-1 flex flex-wrap justify-center gap-2",children:[a.jsxs("button",{onClick:()=>V(e=>e+1),className:"flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:[a.jsx(F,{className:"size-3.5"})," Coba lagi"]}),a.jsxs("a",{href:"https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html",target:"_blank",rel:"noreferrer",className:"flex items-center gap-1.5 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:["Buka di tab baru ",a.jsx(W,{className:"size-3.5"})]})]})]}):a.jsx("div",{className:"relative",children:a.jsxs("div",{style:{height:"calc(100vh - 56px)"},children:[!x&&a.jsxs("div",{className:"absolute inset-0 flex items-center justify-center gap-2.5 text-[13px] text-zinc-500",children:[a.jsx(H,{className:"size-4 animate-spin"})," Memuat screener…"]}),b&&a.jsx("iframe",{ref:d,src:b,title:"Crypto Screener",onLoad:e=>{var n;w(!0);try{const t=e.currentTarget,i=t.contentDocument;if(!i)return;if(l){const s=t.contentWindow;(n=s==null?void 0:s.jtModeTamu)==null||n.call(s)}if(!i.getElementById("jt-v3-tanpa-cangkang")){const s=i.createElement("style");s.id="jt-v3-tanpa-cangkang",s.textContent=Z,(i.head||i.documentElement).appendChild(s)}u();const c=i.querySelector(".es-pantau-title");c&&(c.textContent="Koin Hunter");const m=i.querySelector('[data-section="crosshunter"] .es-priority-title');m&&(m.textContent="Zona Pantau");const S=()=>{var s,z;(s=i.body)==null||s.style.setProperty("padding-left","0","important"),(z=i.body)==null||z.style.setProperty("padding-right","0","important")};S(),i.body&&new MutationObserver(S).observe(i.body,{attributes:!0,attributeFilter:["style","class"]})}catch{}},className:"block h-full w-full border-0",sandbox:"allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals",allow:"clipboard-write"})]})})}export{sa as default};
