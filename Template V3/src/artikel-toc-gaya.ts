/* ════════════════════════════════════════════════════════════════════════
   KELAS TAILWIND YANG DIBUTUHKAN dynamic-island-toc — DITULIS TANGAN
   ════════════════════════════════════════════════════════════════════════
   Halaman baca artikel adalah HTML statis dan SENGAJA tidak memuat
   Tailwind: seluruh alasan halaman itu ada adalah supaya isinya terbaca
   crawler tanpa menyeret lembar gaya aplikasi. Komponen TOC kiriman
   pemilik ditulis dengan kelas Tailwind, jadi kelas yang betul-betul ia
   pakai — dan hanya itu — ditulis ulang di sini. Pola yang sama sudah
   dipakai link-preview di artikel-pratinjau.tsx.

   SEMUANYA DISARANGKAN DI BAWAH #jt-toc. Ini bukan kerapian, ini pagar:
   nama seperti .flex, .block, .fixed terlalu umum untuk dilepas ke
   halaman yang punya CSS sendiri. Dengan pagar ini tidak ada satu pun
   aturan di sini yang bisa menyentuh judul, paragraf, kartu, atau apa pun
   milik artikelnya.

   TIGA HAL YANG MUDAH TERLEWAT, dan ketiganya sudah menggigit kalau lupa:

   1. TRANSLATE & ROTATE BUKAN TRANSFORM. Tailwind v4 memakai properti
      `translate:` dan `rotate:` yang berdiri sendiri, bukan `transform:`.
      Itu bukan detail gaya — framer-motion menulis `transform:` inline
      untuk menganimasikan y/scale/filter. Kalau -translate-x-1/2 ditulis
      sebagai `transform:translateX(-50%)`, animasi masuknya akan MENIMPA
      pemusatan itu dan pulau ini melompat ke kanan layar.

   2. PREFLIGHT TIDAK ADA DI SINI. Daftar isinya dibangun dari <button>,
      dan tanpa preflight Tailwind tombol memakai gaya bawaan peramban:
      latar abu-abu, huruf sistem, teks di tengah. Reset seperlunya ada di
      bawah — itulah yang membuat daftarnya tampak sama dengan acuannya.

   3. --muted DAN --foreground HARUS ADA. CircleProgress menulis
      stroke="var(--muted)" langsung di JSX, bukan lewat kelas. Di proyek
      shadcn variabel itu hidup di :root; di sini tidak ada, dan var yang
      tidak terdefinisi membuat stroke-nya batal — cincin abu-abunya hilang
      tanpa pesan galat apa pun.

   Nilai warnanya diambil dari @theme di src/index.css supaya pulau ini
   memakai palet yang sama dengan aplikasinya, bukan palet karangan.
   ════════════════════════════════════════════════════════════════════════ */
export const GAYA_TOC = `
#jt-toc{
  /* Dibaca CircleProgress lewat var() di JSX-nya. */
  --foreground:#fafafa;
  --muted:#18181b;
  --background:#09090b;
  --muted-foreground:#a1a1aa;
  /* Bilang ke peramban bahwa permukaannya gelap: batang gulir daftar isi
     ikut gelap, bukan putih terang khas Windows di atas panel hitam. */
  color-scheme:dark;
}

/* ── reset seperlunya, menggantikan preflight ────────────────────────── */
#jt-toc button{font:inherit;color:inherit;background:transparent;border:0;
  margin:0;padding:0;text-align:inherit;letter-spacing:inherit}
#jt-toc svg{display:block;vertical-align:middle}
#jt-toc *,#jt-toc *::before,#jt-toc *::after{box-sizing:border-box}

/* ── tata letak ──────────────────────────────────────────────────────── */
#jt-toc .fixed{position:fixed}
#jt-toc .absolute{position:absolute}
#jt-toc .relative{position:relative}
#jt-toc .inset-0{inset:0}
#jt-toc .bottom-\\[30px\\]{bottom:30px}
#jt-toc .left-1\\/2{left:50%}
#jt-toc .z-\\[9998\\]{z-index:9998}
#jt-toc .z-\\[9999\\]{z-index:9999}
#jt-toc .block{display:block}
#jt-toc .flex{display:flex}
#jt-toc .flex-col{flex-direction:column}
#jt-toc .items-center{align-items:center}
#jt-toc .justify-between{justify-content:space-between}
#jt-toc .flex-1{flex:1 1 0%}
#jt-toc .shrink-0{flex-shrink:0}
#jt-toc .gap-4{gap:1rem}
#jt-toc .gap-0\\.5{gap:.125rem}
#jt-toc .h-full{height:100%}
#jt-toc .w-full{width:100%}
#jt-toc .h-2{height:.5rem}
#jt-toc .w-2{width:.5rem}
#jt-toc .h-5{height:1.25rem}
#jt-toc .w-5{width:1.25rem}
#jt-toc .h-1\\.5{height:.375rem}
#jt-toc .w-1\\.5{width:.375rem}
#jt-toc .ml-3{margin-left:.75rem}
#jt-toc .px-3{padding-left:.75rem;padding-right:.75rem}
#jt-toc .px-4{padding-left:1rem;padding-right:1rem}
#jt-toc .px-6{padding-left:1.5rem;padding-right:1.5rem}
#jt-toc .py-2{padding-top:.5rem;padding-bottom:.5rem}
#jt-toc .pr-3{padding-right:.75rem}
#jt-toc .pb-3{padding-bottom:.75rem}
#jt-toc .pb-4{padding-bottom:1rem}
#jt-toc .pt-5{padding-top:1.25rem}
@media (min-width:40rem){#jt-toc .sm\\:px-5{padding-left:1.25rem;padding-right:1.25rem}}

/* ── luapan & gulir ──────────────────────────────────────────────────── */
#jt-toc .overflow-hidden{overflow:hidden}
#jt-toc .overflow-y-auto{overflow-y:auto}
#jt-toc .overscroll-contain{overscroll-behavior:contain}
#jt-toc .text-ellipsis{text-overflow:ellipsis}
#jt-toc .whitespace-nowrap{white-space:nowrap}
#jt-toc .pointer-events-none{pointer-events:none}
#jt-toc .cursor-pointer{cursor:pointer}

/* ── huruf ───────────────────────────────────────────────────────────── */
#jt-toc .text-left{text-align:left}
#jt-toc .text-sm{font-size:.875rem;line-height:1.25rem}
#jt-toc .text-\\[11px\\]{font-size:11px}
#jt-toc .font-medium{font-weight:500}
#jt-toc .font-semibold{font-weight:600}
#jt-toc .tracking-\\[0\\.08em\\]{letter-spacing:.08em}

/* ── warna & garis ───────────────────────────────────────────────────── */
#jt-toc .bg-background{background-color:var(--background)}
#jt-toc .bg-foreground{background-color:var(--foreground)}
#jt-toc .bg-foreground\\/10{background-color:rgba(250,250,250,.1)}
#jt-toc .bg-foreground\\/5{background-color:rgba(250,250,250,.05)}
#jt-toc .bg-transparent{background-color:transparent}
#jt-toc .bg-black\\/20{background-color:rgba(0,0,0,.2)}
#jt-toc .text-foreground{color:var(--foreground)}
#jt-toc .text-foreground\\/85{color:rgba(250,250,250,.85)}
#jt-toc .text-foreground\\/45{color:rgba(250,250,250,.45)}
#jt-toc .text-muted-foreground{color:var(--muted-foreground)}
#jt-toc .hover\\:text-foreground:hover{color:var(--foreground)}
#jt-toc .border{border-width:1px;border-style:solid}
#jt-toc .border-none{border-style:none}
#jt-toc .border-foreground\\/10{border-color:rgba(250,250,250,.1)}
#jt-toc .rounded-lg{border-radius:.5rem}
#jt-toc .rounded-full{border-radius:9999px}
#jt-toc .shadow-2xl{box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}
#jt-toc .backdrop-blur-\\[4px\\]{-webkit-backdrop-filter:blur(4px);
  backdrop-filter:blur(4px)}

/* ── gerak. Lihat catatan (1) di kepala berkas: properti terpisah. ───── */
#jt-toc .-translate-x-1\\/2{translate:-50% 0}
#jt-toc .-rotate-90{rotate:-90deg}
#jt-toc .transition-colors{transition-property:color,background-color,
  border-color,text-decoration-color,fill,stroke;
  transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:150ms}
#jt-toc .transition-transform{transition-property:transform,translate,scale,
  rotate;transition-timing-function:cubic-bezier(.4,0,.2,1);
  transition-duration:150ms}
#jt-toc .transition-all{transition-property:all;
  transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:150ms}
#jt-toc .duration-300{transition-duration:300ms}
#jt-toc .ease-out{transition-timing-function:cubic-bezier(0,0,.2,1)}
#jt-toc .group:hover .group-hover\\:translate-x-1{translate:.25rem 0}
`;
