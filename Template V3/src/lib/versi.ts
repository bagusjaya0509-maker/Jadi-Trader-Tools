/* ════════════════════════════════════════════════════════════════════════
   PEMERIKSA VERSI — melawan index.html yang di-cache
   ════════════════════════════════════════════════════════════════════════
   Lihat catatan panjang di vite.config.ts. Ringkasnya: GitHub Pages menahan
   index.html sampai sepuluh menit, jadi build baru bisa "tidak kelihatan"
   meski deploy-nya berhasil.

   `versi.json` diambil dengan parameter waktu yang selalu berubah — URL yang
   berbeda tidak bisa dijawab dari cache, jadi jawabannya dijamin segar.
   Kalau isinya berbeda dengan yang tertanam di bundel ini, index.html yang
   sedang berjalan sudah usang.

   Muat ulang OTOMATIS, sekali, dijaga penanda sesi. Bukan spanduk "versi
   baru tersedia": pada saat pemeriksaan ini selesai halamannya baru saja
   dibuka, belum ada yang bisa hilang — dan spanduk yang harus diklik cuma
   memindahkan pekerjaan ke orangnya untuk masalah yang bisa kita selesaikan
   sendiri.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.versiDimuatUlang';

export async function periksaVersi() {
  /* Dilewati saat pengembangan: `versi.json` cuma ada di hasil build, dan
     server dev sudah menyajikan segalanya tanpa cache. */
  if (import.meta.env.DEV) return;

  let tertanam = '';
  try { tertanam = __JT_VERSI__; } catch { return; }
  if (!tertanam) return;

  try {
    const r = await fetch(`./versi.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const { versi } = await r.json();
    if (!versi || versi === tertanam) return;

    /* Sudah pernah dimuat ulang di sesi ini tapi versinya masih beda?
       Berarti bukan cache yang jadi masalah — memuat ulang lagi hanya akan
       jadi lingkaran tak berujung. Diam saja; aplikasinya tetap jalan. */
    let sudah = false;
    try { sudah = sessionStorage.getItem(KUNCI) === versi; } catch { return; }
    if (sudah) return;
    try { sessionStorage.setItem(KUNCI, versi); } catch { /* mode privat */ }

    const u = new URL(window.location.href);
    u.searchParams.set('v', String(versi).slice(-6));
    window.location.replace(u.toString());
  } catch {
    /* Jaringan gagal — biarkan aplikasi berjalan dengan versi yang ada. */
  }
}
