/* ════════════════════════════════════════════════════════════════════════
   LAMBANG JADI TRADER
   ════════════════════════════════════════════════════════════════════════
   SATU lambang untuk sidebar DAN favicon. Sebelumnya keduanya berbeda:
   sidebar memakai lilin yang menembus kanal sejajar, sementara
   `public/brand/logo-ikon-512.png` memakai tiga lilin dengan garis tren
   emas. Dua lambang untuk satu produk berarti tidak ada satu pun yang
   dikenali orang — dan yang mereka lihat paling sering, tab peramban,
   justru dulu kosong sama sekali.

   Bentuknya: tiga batang naik dari pusaran tiga cincin yang mengerucut.
   Berangkat dari gagasan yang dipilih pemilik 17 Agustus 2026.

   ── CINCIN UTUH, JANGAN PERNAH BUSUR SETENGAH ─────────────────────────
   Ini bukan pilihan gaya, dan sudah dibuktikan sekali: waktu cincinnya
   digambar sebagai busur yang melengkung ke bawah, lambangnya terbaca
   sebagai WAJAH TERSENYUM — busur jadi mulut, tiga batang di atasnya jadi
   mata. Sekali terlihat tidak bisa dilupakan. Elipsis penuh menutup
   kemungkinan itu, dan kebetulan juga lebih benar: yang digambar memang
   cincin dalam perspektif, bukan senyum bertumpuk.

   Opasitas menurun ke bawah (1 / .6 / .32) yang membuatnya terbaca
   BERPUTAR, bukan sekadar tiga garis bertumpuk.

   ── KENAPA DIGAMBAR TANGAN, BUKAN <img src="favicon.svg"> ─────────────
   `currentColor` — lambangnya ikut warna teks di sekitarnya, jadi tidak
   perlu versi terang/gelap terpisah, dan sidebar bisa meredupkannya saat
   hover tanpa memuat berkas kedua. Sumber bentuk yang sama ada di
   `public/favicon.svg`; kalau salah satu diubah, ubah keduanya.

   viewBox dipangkas ke batas gambarnya (bukan 0 0 32 32) supaya lambangnya
   MEMENUHI kotak 19 px di sidebar. Dengan viewBox penuh ia menyisakan
   margin kosong di keempat sisi dan terlihat lebih kecil daripada ikon
   lucide di sebelahnya.
   ════════════════════════════════════════════════════════════════════════ */

export function LogoJT({ className = 'size-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="2.5 1.6 27 27" fill="none" className={className}
         role="img" aria-label="Jadi Trader Tools">
      {/* Tiga batang naik dari dalam pusaran. */}
      <g fill="currentColor">
        <rect x="11.2" y="5.4" width="2.9" height="9.4" rx="1.25" />
        <rect x="15.5" y="2.6" width="2.9" height="12.2" rx="1.25" />
        <rect x="19.8" y="7.8" width="2.9" height="7" rx="1.25" />
      </g>

      {/* Tiga cincin mengerucut. Lihat catatan di kepala berkas sebelum
          mengubah bentuknya jadi busur. */}
      <g fill="none" stroke="currentColor">
        <ellipse cx="16" cy="18.6" rx="11" ry="3.7" strokeWidth="2.2" />
        <ellipse cx="16" cy="23.3" rx="7.4" ry="2.6" strokeWidth="2.1" strokeOpacity=".6" />
        <ellipse cx="16" cy="26.9" rx="4" ry="1.7" strokeWidth="2" strokeOpacity=".32" />
      </g>
    </svg>
  );
}
