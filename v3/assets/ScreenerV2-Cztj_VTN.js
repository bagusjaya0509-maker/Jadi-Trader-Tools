import{d as B,m as I,j as K,e as a,R as C,A as N,p as D,T as M,L as U}from"./index-CKwWhWhZ.js";import{u as R,r as s,L as g}from"./react-C97iXi1P.js";import{u as H,p as Y,L as J}from"./paket-DieKtelg.js";import{L as _}from"./lock-Bno5GhC8.js";import{R as G}from"./rotate-ccw-CSa4O7y0.js";import{E as $}from"./external-link-q1TjcTYg.js";import"./firebase-D_y3CBvp.js";const W="https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html";function F(){const o=window.location.origin,u=window.location.pathname.replace(/\/[^/]*$/,"").replace(/\/v3\/?$/,"");return[...new Set([`${o}${u}/ema-cross-screener_3.html`,`${o}/v2/ema-cross-screener_3.html`,`${o}/ema-cross-screener_3.html`])]}const q=`
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

  /* ── WARNA MENGIKUTI TEMA, BUKAN DITULIS MATI ──────────────────────
     Dilaporkan pemilik: Screener tetap hitam waktu tema terang dinyalakan.
     Sebabnya blok ini sendiri. Ia ditulis waktu V3 CUMA punya tema gelap,
     jadi menyamakan V2 dengan V3 berarti menulis #09090b dan #fafafa apa
     adanya — dan dengan !important, supaya menang melawan gaya bawaan V2.

     Sejak tema terang ada, dua sifat itu berbalik jadi penghalang: hex mati
     tidak ikut berubah, dan !important membuat tidak ada yang bisa
     menimpanya. Halaman lain berbalik karena memakai kelas zinc; halaman
     ini tidak, karena warnanya tidak pernah lewat token.

     Sekarang lewat token. Nilai di tema GELAP sengaja dijaga sama persis:
     --color-zinc-950 memang #09090b, zinc-50 memang #fafafa, zinc-300
     memang #d4d4d8. Jadi tampilan gelapnya tidak bergeser satu piksel pun
     — yang ditambahkan cuma kemampuan berubah.

     color-mix dipakai untuk yang bertransparansi: 40% dari zinc-900 di tema
     gelap menghasilkan rgba(24,24,27,.4), persis angka lamanya. Menuliskan
     var() begitu saja akan membuang transparansinya dan panelnya jadi
     kotak pekat. */
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

  .ema-screener { background: var(--color-zinc-950) !important; color: var(--color-zinc-50) !important; }

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
    border: 1px solid var(--color-zinc-800) !important;
    background: color-mix(in srgb, var(--color-zinc-900) 60%, transparent) !important;
    color: var(--color-zinc-300) !important;
    font-size: 12.5px !important;
  }
  .ema-screener button {
    border-radius: 6px !important;
    font-size: 12px !important;
  }
  /* Tombol utama V3 = putih dengan teks gelap */
  .es-scan-btn, .es-priority-scan-btn, .es-pantau-scan-btn {
    background: var(--color-zinc-50) !important;
    color: var(--color-zinc-950) !important;
    border: none !important;
    font-weight: 500 !important;
  }

  /* Judul section disamakan dengan PanelHead V3 */
  .es-section-head, .es-priority-header {
    font-size: 15px !important;
    font-weight: 600 !important;
    letter-spacing: -.01em !important;
    color: var(--color-zinc-50) !important;
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
    --bg: var(--color-zinc-950) !important;
    --bg-2: var(--color-zinc-950) !important;
    --panel: color-mix(in srgb, var(--color-zinc-900) 40%, transparent) !important;
    --panel-2: color-mix(in srgb, var(--color-zinc-900) 60%, transparent) !important;
    --border: color-mix(in srgb, var(--color-zinc-800) 80%, transparent) !important;
  }
  html, body, .ema-screener, .es-main, .es-wrap, .es-content {
    background: var(--color-zinc-950) !important;
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
  * { scrollbar-width: thin; scrollbar-color: var(--color-zinc-700) transparent; }
  *::-webkit-scrollbar { width: 9px; height: 9px; }
  *::-webkit-scrollbar-thumb { background: var(--color-zinc-800); border-radius: 9px; }
  *::-webkit-scrollbar-track { background: transparent; }
`;function O(o){return["inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5",o?"border-zinc-700 bg-zinc-800/40 text-zinc-400":"border-amber-500/30 bg-amber-500/[0.07] text-amber-300"].join(" ")}function ia(){const o=R();s.useEffect(()=>{const n=i=>{if(i.origin!==window.location.origin)return;const e=i.data;if(!e||e.jt!=="buka-chart"||typeof e.simbol!="string")return;const t=new URLSearchParams({simbol:e.simbol});typeof e.tf=="string"&&e.tf&&t.set("tf",e.tf);for(const p of["sl","tp"]){const m=Number(e[p]);isFinite(m)&&m>0&&t.set(p,String(m))}(e.arah==="BUY"||e.arah==="SELL")&&t.set("arah",e.arah),o(`/chart-entry?${t}`)};return window.addEventListener("message",n),()=>window.removeEventListener("message",n)},[o]);const[c,u]=s.useState(null),[S,y]=s.useState(!1),[h,f]=s.useState(!1),[A,V]=s.useState(0),{pengguna:x}=B(),d=I()&&!x,{paket:j,muatUlang:v}=H(),[E,b]=s.useState(null),[T,L]=s.useState("");s.useEffect(()=>{if(d||!x){b(!0);return}const n="jt.paket.screener.sesi";let i=!1;return(async()=>{try{if(sessionStorage.getItem(n)==="1"){i||b(!0);return}}catch{}const e=await Y("screener");if(!i){if(e.boleh){try{sessionStorage.setItem(n,"1")}catch{}b(!0)}else L(e.alasan??"Jatah screener paket ini sudah habis."),b(!1);v()}})(),()=>{i=!0}},[d,x,v]);const[k,P]=s.useState(!d),l=d&&!k&&K("screener");return s.useEffect(()=>{if(!k)return;let n=!0;return(async()=>{y(!1),f(!1),u(null);for(const i of F())try{const e=await fetch(i,{method:"HEAD"});if(!n)return;if(e.ok){u(i);return}}catch{}n&&u(W)})(),()=>{n=!1}},[A,k]),s.useEffect(()=>{if(!c||h)return;const n=setTimeout(()=>y(!0),15e3);return()=>clearTimeout(n)},[c,h]),E===!1?a.jsx("div",{className:"flex min-h-[70vh] items-center justify-center p-6",children:a.jsxs("div",{className:"w-full max-w-lg rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-6",children:[a.jsx("div",{className:"text-[14px] font-medium text-amber-300",children:"Jatah Screener sudah habis"}),a.jsxs("p",{className:"mt-2 text-[12.5px] leading-relaxed text-zinc-400",children:[T," Paket ",a.jsx("span",{className:"text-zinc-200",children:J[j.paket]})," memberi"," ",a.jsx("span",{className:"angka text-zinc-200",children:j.batas.screener})," kali akses per masa aktif, dan semuanya sudah terpakai. Jatahnya kembali penuh saat masa aktifmu diperpanjang."]}),a.jsxs("div",{className:"mt-4 flex flex-wrap gap-2",children:[a.jsx(g,{to:"/harga",className:"rounded-md bg-zinc-100 px-4 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:"Lihat paket tanpa batas"}),a.jsx(g,{to:"/dashboard",className:"rounded-md border border-zinc-800 px-4 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700",children:"Kembali ke Dashboard"})]})]})}):d&&!k?a.jsx("div",{className:"flex min-h-[70vh] items-center justify-center p-6",children:a.jsxs("div",{className:"w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/40 p-6",children:[a.jsxs("div",{className:O(l),children:[l?a.jsx(_,{className:"size-4",strokeWidth:2}):a.jsx(C,{className:"size-4",strokeWidth:2}),a.jsx("span",{className:"text-[10.5px] font-semibold uppercase tracking-wider",children:l?"Sudah terpakai":"Sekali lihat"})]}),a.jsx("h1",{className:"mt-4 text-2xl font-medium tracking-tight text-zinc-50",children:l?"Screener Area sudah kamu buka":"Screener Area"}),a.jsx("p",{className:"mt-2 text-[13.5px] leading-relaxed text-zinc-400",children:l?a.jsx(a.Fragment,{children:"Di mode preview, screener berlaku sekali — dan sekali itu sudah lewat. Masuk untuk memakainya tanpa batas, berikut jurnal dan Chart & Entry yang menyimpan hasilnya."}):a.jsxs(a.Fragment,{children:["Pemindai yang membaca ratusan simbol Binance langsung dari pasar: Koin Hunter, Zona Pantau, dan sinyal paralel. Angkanya ",a.jsx("b",{children:"bukan contoh"})," — ini alat yang sesungguhnya, berjalan atas data sekarang."]})}),!l&&a.jsx("ul",{className:"mt-5 flex flex-col gap-2.5 border-t border-zinc-800 pt-5",children:[["Berlaku sekali per kunjungan","Begitu kamu pindah halaman lalu kembali, layarnya tertutup lagi."],["Bukan data contoh","Berbeda dari halaman preview lain — yang ini memindai pasar sungguhan."],["Tidak perlu daftar","Tidak ada yang diminta, dan tidak ada yang disimpan."]].map(([n,i])=>a.jsxs("li",{className:"flex gap-2.5",children:[a.jsx("span",{className:"mt-1.5 size-1 shrink-0 rounded-full bg-zinc-600"}),a.jsxs("div",{children:[a.jsx("div",{className:"text-[12.5px] font-medium text-zinc-200",children:n}),a.jsx("div",{className:"text-[11.5px] leading-relaxed text-zinc-500",children:i})]})]},n))}),a.jsxs("div",{className:"mt-5 flex flex-wrap items-center gap-2.5",children:[l?a.jsxs(g,{to:"/tour",className:"flex items-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white",children:["Masuk untuk membukanya lagi ",a.jsx(N,{className:"size-4"})]}):a.jsxs("button",{onClick:()=>{D("screener"),P(!0)},className:"flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white",children:["Buka Screener Area ",a.jsx(N,{className:"size-4"})]}),a.jsx(g,{to:"/dashboard",className:"rounded-md border border-zinc-800 px-4 py-2.5 text-[13px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:"Kembali ke Dashboard"})]})]})}):S?a.jsxs("div",{className:"flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center",children:[a.jsx(M,{className:"size-6 text-amber-500",strokeWidth:1.9}),a.jsx("div",{className:"text-[14px] text-zinc-200",children:"Screener tidak bisa dimuat"}),a.jsxs("p",{className:"max-w-md text-[12.5px] leading-relaxed text-zinc-500",children:["Berkas ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"ema-cross-screener_3.html"})," tidak ditemukan di alamat mana pun yang dicoba. Kalau ini di VPS, pastikan foldernya sudah diunggah ke"," ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"/root/v2"}),"."]}),a.jsxs("div",{className:"mt-1 flex flex-wrap justify-center gap-2",children:[a.jsxs("button",{onClick:()=>V(n=>n+1),className:"flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:[a.jsx(G,{className:"size-3.5"})," Coba lagi"]}),a.jsxs("a",{href:"https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html",target:"_blank",rel:"noreferrer",className:"flex items-center gap-1.5 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:["Buka di tab baru ",a.jsx($,{className:"size-3.5"})]})]})]}):a.jsx("div",{className:"relative",children:a.jsxs("div",{style:{height:"calc(100vh - 56px)"},children:[!h&&a.jsxs("div",{className:"absolute inset-0 flex items-center justify-center gap-2.5 text-[13px] text-zinc-500",children:[a.jsx(U,{className:"size-4 animate-spin"})," Memuat screener…"]}),c&&a.jsx("iframe",{src:c,title:"Crypto Screener",onLoad:n=>{var i;f(!0);try{const e=n.currentTarget,t=e.contentDocument;if(!t)return;if(d){const r=e.contentWindow;(i=r==null?void 0:r.jtModeTamu)==null||i.call(r)}if(!t.getElementById("jt-v3-tanpa-cangkang")){const r=t.createElement("style");r.id="jt-v3-tanpa-cangkang",r.textContent=q,(t.head||t.documentElement).appendChild(r)}const p=t.querySelector(".es-pantau-title");p&&(p.textContent="Koin Hunter");const m=t.querySelector('[data-section="crosshunter"] .es-priority-title');m&&(m.textContent="Zona Pantau");const w=()=>{var r,z;(r=t.body)==null||r.style.setProperty("padding-left","0","important"),(z=t.body)==null||z.style.setProperty("padding-right","0","important")};w(),t.body&&new MutationObserver(w).observe(t.body,{attributes:!0,attributeFilter:["style","class"]})}catch{}},className:"block h-full w-full border-0",sandbox:"allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals",allow:"clipboard-write"})]})})}export{ia as default};
