/* ════════════════════════════════════════════════════════════════════════
   IKON MASUKAN — balon pesan bergaris dengan tanda tambah
   ════════════════════════════════════════════════════════════════════════
   Digambar tangan, bukan diambil dari lucide. `MessageSquarePlus` bawaan
   lucide berbeda di tiga hal yang justru paling terlihat: ekor balonnya di
   kanan bawah, tanda tambahnya di dalam balon, dan sudutnya lebih tajam.
   Pemilik mengirim gambar acuan 8 Sep 2026 dan memintanya sama persis.

   ── KOORDINATNYA DIUKUR DARI GAMBAR ACUAN, BUKAN DIKIRA ────────────────
   Percobaan pertama digambar dengan angka yang "kelihatan masuk akal" dan
   hasilnya salah dengan cara yang tidak kelihatan di ukuran 12 px: balonnya
   cuma selebar separuh bidang, jadi pada tebal garis yang sama ia terbaca
   gemuk, kedua batangnya hampir menempel, dan ekornya bersenggolan dengan
   tanda tambah.

   Angka di bawah ini hasil mengukur gambar acuan (1067 × 1006) lalu
   menskalakannya ke bidang 24 × 24: garis tengah balon di x 3–19, ekor
   berakhir di (11,6 · 18,6), tanda tambah berpusat di (17,8 · 16,85).
   Tebal garis acuan 62 px × faktor skala 0,0326 = 2,02 — jadi
   `strokeWidth={2}` memang tebal yang benar untuk bentuk ini, bukan
   angka yang dipilih supaya seragam dengan ikon lain.

   Bentuknya:
     · Balon bersudut membulat. Sisi kanannya BERHENTI di tengah jalan;
       potongan itu yang memberi ruang untuk tanda tambah.
     · Ekor keluar dari sudut kiri bawah, menurun ke kanan.
     · Dua batang mendatar, yang kedua lebih pendek — menandakan "ada
       tulisan", bukan meniru barisnya.
     · Tanda tambah di kanan bawah, melewati tepi kanan balon.

   Tanda tangannya sama dengan ikon lucide (`className`, `strokeWidth`)
   supaya bisa ditukar-pakai tanpa pemanggilnya perlu tahu ini buatan
   sendiri.
   ════════════════════════════════════════════════════════════════════════ */
export function IkonMasukan({
  className,
  strokeWidth = 2,
  ...props
}: React.SVGProps<SVGSVGElement> & { strokeWidth?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Balon dan ekornya SATU jalur: sudutnya harus menyambung mulus, dan
          dua jalur terpisah memperlihatkan sambungan di tempat berbelok. */}
      <path d="M19 11.2V5.5A2.5 2.5 0 0 0 16.5 3h-11A2.5 2.5 0 0 0 3 5.5v6.8a2.5 2.5 0 0 0 2.5 2.5h2.6l3.5 3.8" />
      {/* Dua batang tulisan. */}
      <path d="M7.3 6.2h7.3" />
      <path d="M7.3 11.3h5.8" />
      {/* Tanda tambah — terpisah supaya ujungnya membulat sendiri. */}
      <path d="M14.6 16.85H21" />
      <path d="M17.8 13.65v6.4" />
    </svg>
  );
}

export default IkonMasukan;
