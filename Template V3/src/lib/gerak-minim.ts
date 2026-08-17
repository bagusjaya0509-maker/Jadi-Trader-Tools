import { useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   HORMATI SETELAN "KURANGI GERAK" MILIK SISTEM
   ════════════════════════════════════════════════════════════════════════
   Peraga di kartu halaman depan berjalan sendiri, berulang, dan tidak punya
   tombol berhenti. Untuk sebagian orang itu bukan gangguan kecil: gerak
   berulang yang tidak diminta bisa memicu pusing dan mual (vestibular),
   dan bagi yang memakai pembaca layar atau kesulitan fokus ia membuat
   halamannya melelahkan dibaca.

   Peramban sudah menyediakan jawabannya — pengguna menyalakan "kurangi
   gerak" di setelan sistemnya. Yang perlu dilakukan cuma menanyakannya.
   Saat menyala, tiap peraga menampilkan KEADAAN AKHIRNYA secara diam:
   bukan kotak kosong, bukan animasi yang dipercepat. Isinya tetap utuh,
   yang hilang cuma geraknya.

   Dipasang lewat addEventListener, bukan dibaca sekali: setelan ini bisa
   diubah selagi halaman terbuka, dan pada macOS ia ikut berubah sendiri
   saat mode hemat daya menyala.
   ════════════════════════════════════════════════════════════════════════ */

const KUERI = '(prefers-reduced-motion: reduce)';

export function useGerakMinim(): boolean {
  const [minim, setMinim] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(KUERI).matches === true,
  );

  useEffect(() => {
    const mq = window.matchMedia?.(KUERI);
    if (!mq) return;
    const ubah = () => setMinim(mq.matches);
    ubah();
    mq.addEventListener('change', ubah);
    return () => mq.removeEventListener('change', ubah);
  }, []);

  return minim;
}
