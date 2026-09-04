import{b as M,m as C,c as U,p as R,j as H,d as a,L as Y,R as J,A as z,e as G,T as _,E as $,M as O}from"./index-npnEXoaq.js";import{r as d,u as F,L as v}from"./react-BGzhFICo.js";import{L as W}from"./lock-Bh7Shhgs.js";import{R as q}from"./rotate-ccw-BiQByV-v.js";import"./firebase-Csnso1ng.js";const Z="https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html";function Q(){const o=window.location.origin,g=window.location.pathname.replace(/\/[^/]*$/,"").replace(/\/v3\/?$/,"");return[...new Set([`${o}${g}/ema-cross-screener_3.html`,`${o}/v2/ema-cross-screener_3.html`,`${o}/ema-cross-screener_3.html`])]}const X=`
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
  /* ── TOMBOL PINDAI ────────────────────────────────────────────────
     Kelasnya .es-priority-btn — dipakai BERTIGA: "Cari Sinyal Pantau",
     "Cari Sinyal Parallel", dan "Cari Sinyal Prioritas ICT". Yang kedua
     berganti tulisan jadi "Cari Sinyal SNR H4" lewat JS, jadi ia tidak
     bisa dicari dari teksnya di berkas — id-nya esChBtn.

     Tiga nama yang saya tulis sebelumnya (.es-scan-btn,
     .es-priority-scan-btn, .es-pantau-scan-btn) TIDAK ADA di V2. Saya
     mengarangnya dari tebakan penamaan, dan aturan yang tidak pernah
     cocok tidak memberi tanda apa pun bahwa ia salah — ia cuma diam.
     Yang ini diambil dari sumber V2-nya.

     Aslinya: teks & tepi var(--gold) #c9a24b di atas var(--panel). Emas
     itu dibuat untuk latar gelap; di atas putih ia tinggal 2,5:1 dan
     nyaris hilang. Jadi emasnya digelapkan, bukan diganti warna lain —
     tombol ini penanda "aksi utama section" di seluruh V2, dan menukar
     warnanya di satu tema memutus hubungan itu.

     Ditulis dengan .ema-screener di depannya supaya menang tanpa harus
     bergantung pada urutan berkas. */
  [data-tema='terang'] .ema-screener .es-priority-btn {
    background: #ffffff !important;
    border-color: #a97b1f !important;
    color: #8a6420 !important;
  }
  [data-tema='terang'] .ema-screener .es-priority-btn:hover {
    background: #fdf6e7 !important;
  }

  /* ── DUA TOMBOL YANG DIKUNCI LEWAT ID ─────────────────────────────
     "Cari Sinyal Pantau" tetap tidak terbaca meski aturan
     .es-priority-btn di atas sudah benar. Sebabnya bukan kelasnya —
     V2 punya aturan TERPISAH ber-ID untuknya (baris 1349):

         #esLiveTradeBtn, #esPantauBtn { color:#fff !important; ... }

     Satu id itu bernilai (1,0,0); selektor saya di atas cuma (0,3,0).
     Keduanya !important, jadi yang menentukan kekhususannya — dan id
     menang. Itu sebabnya "Cari Sinyal SNR H4" ikut berubah sementara
     tetangganya tidak: yang kedua punya aturan id, yang pertama tidak.

     Disapu dulu sebelum ditambal: di SELURUH berkas V2 hanya ADA SATU
     aturan yang memaksa teks putih dengan !important, yaitu ini. Jadi
     memperbaikinya menutup seluruh kelas masalahnya, bukan satu contoh.

     Idnya dipakai balik supaya (1,1,0) > (1,0,0). #esLiveTradeBtn ikut
     meski kotak Live Trading sedang disembunyikan — ia berbagi aturan
     yang sama persis, dan meninggalkannya berarti menanam bug yang
     muncul entah kapan nanti saat kotak itu ditampilkan lagi.

     Teksnya netral gelap, BUKAN emas seperti tombol di atas. Di tema
     gelap tombol ini memang sengaja dibedakan: putih polos + kedip,
     bukan emas — dan perbedaan itu ikut dipertahankan.

     Kedipnya TIDAK dimatikan. chScanGlow cuma menganimasikan box-shadow
     merah<->hijau; ia penanda "tombol ini yang memulai pemindaian", dan
     itu berlaku di tema mana pun. */
  [data-tema='terang'] #esPantauBtn,
  [data-tema='terang'] #esLiveTradeBtn {
    color: #0f172a !important;
    background: #ffffff !important;
    border-color: #cbd5e1 !important;
  }
  [data-tema='terang'] #esPantauBtn:hover,
  [data-tema='terang'] #esLiveTradeBtn:hover {
    background: #f1f5f9 !important;
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
`;function aa(o){return["inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5",o?"border-zinc-700 bg-zinc-800/40 text-zinc-400":"border-amber-500/30 bg-amber-500/[0.07] text-amber-300"].join(" ")}function sa({tinggi:o,onPilihSimbol:c}={}){const g=d.useRef(null),k=d.useCallback(()=>{var n;try{const i=(n=g.current)==null?void 0:n.contentDocument;if(!(i!=null&&i.documentElement))return;const e=document.documentElement.getAttribute("data-tema");e?i.documentElement.setAttribute("data-tema",e):i.documentElement.removeAttribute("data-tema")}catch{}},[]);d.useEffect(()=>{k();const n=new MutationObserver(k);return n.observe(document.documentElement,{attributes:!0,attributeFilter:["data-tema"]}),()=>n.disconnect()},[k]);const j=F();d.useEffect(()=>{const n=i=>{if(i.origin!==window.location.origin)return;const e=i.data;if(!e||e.jt!=="buka-chart"||typeof e.simbol!="string")return;const r=new URLSearchParams({simbol:e.simbol});typeof e.tf=="string"&&e.tf&&r.set("tf",e.tf);for(const s of["sl","tp"]){const l=Number(e[s]);isFinite(l)&&l>0&&r.set(s,String(l))}if((e.arah==="BUY"||e.arah==="SELL")&&r.set("arah",e.arah),c){const s=l=>{const p=Number(e[l]);return isFinite(p)&&p>0?p:void 0};c({simbol:e.simbol,tf:typeof e.tf=="string"&&e.tf?e.tf:void 0,sl:s("sl"),tp:s("tp"),arah:e.arah==="BUY"||e.arah==="SELL"?e.arah:void 0});return}r.set("screener","1"),j(`/chart-entry?${r}`)};return window.addEventListener("message",n),()=>window.removeEventListener("message",n)},[j,c]);const[h,w]=d.useState(null),[B,A]=d.useState(!1),[y,S]=d.useState(!1),[L,P]=d.useState(0),{pengguna:N}=M(),u=C()&&!N,{paket:T,muatUlang:E}=U(),[V,f]=d.useState(null),[I,D]=d.useState("");d.useEffect(()=>{if(u||!N){f(!0);return}const n="jt.paket.screener.sesi";let i=!1;return(async()=>{try{if(sessionStorage.getItem(n)==="1"){i||f(!0);return}}catch{}const e=await R("screener");if(!i){if(e.boleh){try{sessionStorage.setItem(n,"1")}catch{}f(!0)}else D(e.alasan??"Jatah screener paket ini sudah habis."),f(!1);E()}})(),()=>{i=!0}},[u,N,E]);const[x,K]=d.useState(!u),m=u&&!x&&H("screener");return d.useEffect(()=>{if(!x)return;let n=!0;return(async()=>{A(!1),S(!1),w(null);for(const i of Q())try{const e=await fetch(i,{method:"HEAD"});if(!n)return;if(e.ok){w(i);return}}catch{}n&&w(Z)})(),()=>{n=!1}},[L,x]),d.useEffect(()=>{if(!h||y)return;const n=setTimeout(()=>A(!0),15e3);return()=>clearTimeout(n)},[h,y]),V===!1?a.jsx("div",{className:"flex min-h-[70vh] items-center justify-center p-6",children:a.jsxs("div",{className:"w-full max-w-lg rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-6",children:[a.jsx("div",{className:"text-[14px] font-medium text-amber-300",children:"Jatah Screener sudah habis"}),a.jsxs("p",{className:"mt-2 text-[12.5px] leading-relaxed text-zinc-400",children:[I," Paket ",a.jsx("span",{className:"text-zinc-200",children:Y[T.paket]})," memberi"," ",a.jsx("span",{className:"angka text-zinc-200",children:T.batas.screener})," kali akses per masa aktif, dan semuanya sudah terpakai. Jatahnya kembali penuh saat masa aktifmu diperpanjang."]}),a.jsxs("div",{className:"mt-4 flex flex-wrap gap-2",children:[a.jsx(v,{to:"/harga",className:"rounded-md bg-zinc-100 px-4 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:"Lihat paket tanpa batas"}),a.jsx(v,{to:"/dashboard",className:"rounded-md border border-zinc-800 px-4 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700",children:"Kembali ke Dashboard"})]})]})}):u&&!x?a.jsx("div",{className:"flex min-h-[70vh] items-center justify-center p-6",children:a.jsxs("div",{className:"w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/40 p-6",children:[a.jsxs("div",{className:aa(m),children:[m?a.jsx(W,{className:"size-4",strokeWidth:2}):a.jsx(J,{className:"size-4",strokeWidth:2}),a.jsx("span",{className:"text-[10.5px] font-semibold uppercase tracking-wider",children:m?"Sudah terpakai":"Sekali lihat"})]}),a.jsx("h1",{className:"mt-4 text-2xl font-medium tracking-tight text-zinc-50",children:m?"Screener Area sudah kamu buka":"Screener Area"}),a.jsx("p",{className:"mt-2 text-[13.5px] leading-relaxed text-zinc-400",children:m?a.jsx(a.Fragment,{children:"Di mode preview, screener berlaku sekali — dan sekali itu sudah lewat. Masuk untuk memakainya tanpa batas, berikut jurnal dan Chart & Entry yang menyimpan hasilnya."}):a.jsxs(a.Fragment,{children:["Pemindai yang membaca ratusan simbol Binance langsung dari pasar: Koin Hunter, Zona Pantau, dan sinyal paralel. Angkanya ",a.jsx("b",{children:"bukan contoh"})," — ini alat yang sesungguhnya, berjalan atas data sekarang."]})}),!m&&a.jsx("ul",{className:"mt-5 flex flex-col gap-2.5 border-t border-zinc-800 pt-5",children:[["Berlaku sekali per kunjungan","Begitu kamu pindah halaman lalu kembali, layarnya tertutup lagi."],["Bukan data contoh","Berbeda dari halaman preview lain — yang ini memindai pasar sungguhan."],["Tidak perlu daftar","Tidak ada yang diminta, dan tidak ada yang disimpan."]].map(([n,i])=>a.jsxs("li",{className:"flex gap-2.5",children:[a.jsx("span",{className:"mt-1.5 size-1 shrink-0 rounded-full bg-zinc-600"}),a.jsxs("div",{children:[a.jsx("div",{className:"text-[12.5px] font-medium text-zinc-200",children:n}),a.jsx("div",{className:"text-[11.5px] leading-relaxed text-zinc-500",children:i})]})]},n))}),a.jsxs("div",{className:"mt-5 flex flex-wrap items-center gap-2.5",children:[m?a.jsxs(v,{to:"/tour",className:"flex items-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white",children:["Masuk untuk membukanya lagi ",a.jsx(z,{className:"size-4"})]}):a.jsxs("button",{onClick:()=>{G("screener"),K(!0)},className:"flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white",children:["Buka Screener Area ",a.jsx(z,{className:"size-4"})]}),a.jsx(v,{to:"/dashboard",className:"rounded-md border border-zinc-800 px-4 py-2.5 text-[13px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:"Kembali ke Dashboard"})]})]})}):B?a.jsxs("div",{className:"flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center",children:[a.jsx(_,{className:"size-6 text-amber-500",strokeWidth:1.9}),a.jsx("div",{className:"text-[14px] text-zinc-200",children:"Screener tidak bisa dimuat"}),a.jsxs("p",{className:"max-w-md text-[12.5px] leading-relaxed text-zinc-500",children:["Berkas ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"ema-cross-screener_3.html"})," tidak ditemukan di alamat mana pun yang dicoba. Kalau ini di VPS, pastikan foldernya sudah diunggah ke"," ",a.jsx("code",{className:"rounded bg-zinc-800 px-1.5 py-0.5 text-[11.5px]",children:"/root/v2"}),"."]}),a.jsxs("div",{className:"mt-1 flex flex-wrap justify-center gap-2",children:[a.jsxs("button",{onClick:()=>P(n=>n+1),className:"flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white",children:[a.jsx(q,{className:"size-3.5"})," Coba lagi"]}),a.jsxs("a",{href:"https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/ema-cross-screener_3.html",target:"_blank",rel:"noreferrer",className:"flex items-center gap-1.5 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100",children:["Buka di tab baru ",a.jsx($,{className:"size-3.5"})]})]})]}):a.jsx("div",{className:"relative",children:a.jsxs("div",{className:"bg-zinc-950",style:{height:o?`${o}px`:"calc(100vh - 56px)"},children:[!y&&a.jsx(O,{className:"absolute inset-0",pesan:"Memuat screener…"}),h&&a.jsx("iframe",{ref:g,src:h,title:"Crypto Screener",onLoad:n=>{var i;S(!0);try{const e=n.currentTarget,r=e.contentDocument;if(!r)return;if(u){const t=e.contentWindow;(i=t==null?void 0:t.jtModeTamu)==null||i.call(t)}if(!r.getElementById("jt-v3-tanpa-cangkang")){const t=r.createElement("style");t.id="jt-v3-tanpa-cangkang",t.textContent=X,(r.head||r.documentElement).appendChild(t)}k();const s=r.querySelector(".es-pantau-title");if(s&&(s.textContent="Koin Hunter"),s&&!c&&!r.getElementById("jt-buka-chart")){const t=r.createElement("button");t.id="jt-buka-chart",t.type="button",t.title="Buka di Chart & Entry — Koin Hunter ikut terpasang di panel kiri",t.setAttribute("aria-label","Buka di Chart dan Entry"),t.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" style="width:15px;height:15px;display:block"><path d="M3 2v11.5h11"/><path d="M5.5 5v5.5M5.5 4v1M5.5 10.5v1"/><path d="M9 3.5v6M9 2.5v1M9 9.5v1"/><path d="M12.5 6.5v4M12.5 5.5v1M12.5 10.5v1"/></svg>',t.style.cssText="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex:0 0 auto;border:1px solid #3a3f4b;border-radius:6px;background:transparent;color:inherit;cursor:pointer;padding:0;opacity:.75",t.addEventListener("mouseenter",()=>{t.style.opacity="1"}),t.addEventListener("mouseleave",()=>{t.style.opacity=".75"}),t.addEventListener("click",b=>{b.preventDefault(),b.stopPropagation(),j("/chart-entry?screener=1")}),s.style.display="flex",s.style.alignItems="center",s.style.gap="8px",s.insertBefore(t,s.firstChild)}const l=r.querySelector('[data-section="crosshunter"] .es-priority-title');l&&(l.textContent="Zona Pantau");const p=()=>{var t,b;(t=r.body)==null||t.style.setProperty("padding-left","0","important"),(b=r.body)==null||b.style.setProperty("padding-right","0","important")};p(),r.body&&new MutationObserver(p).observe(r.body,{attributes:!0,attributeFilter:["style","class"]})}catch{}},className:`block h-full w-full border-0 transition-opacity duration-200 ${y?"opacity-100":"opacity-0"}`,sandbox:"allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals",allow:"clipboard-write"})]})})}export{sa as default};
