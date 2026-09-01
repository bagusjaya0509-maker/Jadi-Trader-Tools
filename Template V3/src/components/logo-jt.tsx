/* ════════════════════════════════════════════════════════════════════════
   LAMBANG JADI TRADER
   ════════════════════════════════════════════════════════════════════════
   SATU lambang untuk sidebar, halaman depan, DAN favicon. Dua lambang untuk
   satu produk berarti tidak ada satu pun yang dikenali orang.

   Bentuknya: tiga lilin naik dari dalam sebuah mangkuk bercincin. Dipilih
   pemilik 1 September 2026, menggantikan gambar tiga batang di atas tiga
   cincin mengerucut.

   ── DITELUSUR DARI BERKASNYA, BUKAN DIGAMBAR ULANG ────────────────────
   Jalur di bawah hasil penelusuran piksel berkas aslinya (Moore-neighbor
   + Douglas-Peucker, toleransi 1,4 px), lalu diperiksa balik dengan
   merasterkannya lagi dan membandingkannya ke berkas asli: 99,16% piksel
   bertumpang tepat, selisihnya cuma tepi antialias.

   Itu penting karena bentuk ini punya perpotongan cincin-dan-mangkuk yang
   tidak bisa ditebak dari ukuran batangnya saja. Menggambar ulang dengan
   mata berarti mengarang, dan lambang yang dikarang tidak akan pernah sama
   persis dengan yang dipilih pemiliknya.

   Karena itu JANGAN menyunting angka-angka di jalur ini dengan tangan.
   Kalau lambangnya berubah, telusur ulang dari berkas gambarnya.

   ── KENAPA JALUR, BUKAN <img src="logo.png"> ──────────────────────────
   `currentColor` — lambangnya ikut warna teks di sekitarnya, jadi tidak
   perlu versi terang/gelap terpisah, dan sidebar bisa meredupkannya saat
   hover tanpa memuat berkas kedua. Bentuk yang sama ada di
   `public/favicon.svg`; kalau salah satu diubah, ubah keduanya.
   ════════════════════════════════════════════════════════════════════════ */

export function LogoJT({ className = 'size-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 983 1040" className={className}
         role="img" aria-label="Jadi Trader Tools">
      <path fill="currentColor" fillRule="evenodd" d="M487 0L510 2L530 13L542 27L550 49L549 624L602 631L649 643L652 641L652 235L657 216L665 204L676 194L688 188L700 185L722 186L740 194L750 203L759 217L763 231L763 634L793 641L817 650L822 655L822 661L818 666L806 673L782 682L737 693L699 699L652 703L651 679L606 667L550 661L549 710L435 710L433 661L376 668L335 679L332 681L332 702L326 703L259 695L211 685L181 675L168 668L161 660L162 655L175 646L220 634L222 234L227 216L234 205L251 191L270 185L291 186L311 195L326 212L333 235L332 643L334 644L381 632L430 626L435 623L437 47L444 28L458 12L472 4L487 0ZM178 570L180 570L180 611L141 622L113 636L97 653L95 659L97 670L108 683L118 690L149 704L196 716L262 727L401 739L462 741L561 740L695 730L763 720L816 709L852 696L873 684L886 670L888 659L882 646L863 631L829 617L803 611L803 570L830 574L871 585L908 599L939 615L961 631L973 644L981 661L982 675L975 694L959 712L941 725L915 739L877 754L833 767L760 782L743 814L726 835L652 793L551 798L549 800L550 976L588 968L629 953L663 935L688 918L704 905L743 863L763 831L775 803L840 803L833 828L817 862L781 913L752 943L702 980L657 1004L598 1025L544 1036L512 1039L457 1039L427 1036L378 1026L334 1011L283 985L245 958L210 925L176 880L154 837L144 803L208 803L220 830L242 865L255 881L292 916L324 938L364 958L396 969L433 976L433 798L330 793L257 835L239 812L223 782L145 767L77 745L55 735L28 718L16 707L5 692L0 675L3 657L11 643L35 622L74 601L105 589L178 570Z" />
    </svg>
  );
}
