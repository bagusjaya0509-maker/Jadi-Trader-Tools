/* ════════════════════════════════════════════════════════════════════════
   LAMBANG JADI TRADER
   ════════════════════════════════════════════════════════════════════════
   Sebelumnya sidebar memakai `LayoutGrid` dari lucide — ikon "dasbor" bawaan
   yang dipakai ribuan aplikasi lain dan tidak menyebut apa pun tentang
   produk ini.

   Lambangnya menggambarkan apa yang sebenarnya dijual: satu lilin yang
   MENEMBUS batas atas kanal sejajar. Itu persis sinyal yang dicari screener —
   bukan grafik naik generik, melainkan kejadian tertentu yang punya nama.

   Digambar tangan sebagai SVG, bukan berkas: 40 baris di dalam bundel jauh
   lebih murah daripada satu permintaan HTTP tambahan, dan warnanya ikut
   `currentColor` sehingga tidak perlu versi terang/gelap terpisah.
   ════════════════════════════════════════════════════════════════════════ */

export function LogoJT({ className = 'size-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}
         role="img" aria-label="Jadi Trader Tools">
      {/* Kanal sejajar. Yang atas putus-putus: ia batas yang ditembus, bukan
          garis penopang — bedanya penting dan terbaca bahkan pada 18 px. */}
      <path d="M3 15.5 L21 6.5" stroke="currentColor" strokeWidth="1.4"
            strokeOpacity=".38" strokeLinecap="round" strokeDasharray="3 2.5" />
      <path d="M3 21 L21 12" stroke="currentColor" strokeWidth="1.4"
            strokeOpacity=".38" strokeLinecap="round" />

      {/* Dua lilin di dalam kanal, lalu satu yang menembus. Ukurannya menaik
          supaya matanya berjalan ke kanan tanpa perlu tanda panah. */}
      <line x1="7.5" y1="15.2" x2="7.5" y2="19.4" stroke="currentColor" strokeWidth="1.3" strokeOpacity=".5" strokeLinecap="round" />
      <line x1="12" y1="12.6" x2="12" y2="17.4" stroke="currentColor" strokeWidth="1.3" strokeOpacity=".65" strokeLinecap="round" />

      {/* Lilin penembus: sumbu panjang melewati garis putus-putus, badannya
          tebal supaya jadi titik berat gambarnya. */}
      <line x1="17" y1="2.6" x2="17" y2="14.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="15.4" y="5.2" width="3.2" height="7" rx="1" fill="currentColor" />
    </svg>
  );
}
