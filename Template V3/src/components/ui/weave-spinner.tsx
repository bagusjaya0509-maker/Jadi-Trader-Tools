import './weave-spinner.css';

/* ════════════════════════════════════════════════════════════════════════
   WEAVE SPINNER
   ════════════════════════════════════════════════════════════════════════
   Markup saja — seluruh gaya dan animasinya di weave-spinner.css, mengikuti
   pola bell-notify.tsx + bell-notify.css yang sudah ada di folder ini.
   Alasan CSS-nya tidak tinggal di dalam <style> pada komponen ditulis di
   kepala berkas CSS-nya.

   JANGAN dipakai langsung untuk keadaan memuat. Pakai <Memuat> di
   components/memuat.tsx: ia yang memegang penempatan, dan penempatan yang
   dipegang satu tempat adalah satu-satunya cara loading di seluruh aplikasi
   muncul di posisi yang sama. Komponen ini sengaja TIDAK punya pendapat soal
   di mana ia berdiri.
   ════════════════════════════════════════════════════════════════════════ */

export function WeaveSpinner({ skala = 1 }: {
  /** Pengali ukuran. 1 = 160px seperti aslinya. Kotak layout-nya ikut
   *  mengecil, bukan cuma gambarnya — lihat catatan `.jtw` di CSS. */
  skala?: number;
}) {
  return (
    <div
      className="jtw"
      style={{ '--jtw-skala': skala } as React.CSSProperties}
      /* Pembaca layar tidak bisa melihat benang berputar. Tanpa dua atribut
         ini, orang yang memakainya menemui halaman yang diam saja tanpa
         satu pun petunjuk bahwa ada sesuatu yang sedang berjalan. */
      role="status"
      aria-label="Sedang memuat"
    >
      <div className="jtw-panggung">
        <div className="jtw-wadah">
          <div className="jtw-benang jtw-b1" />
          <div className="jtw-benang jtw-b2" />
          <div className="jtw-benang jtw-b3" />
          <div className="jtw-benang jtw-b4" />
          <div className="jtw-simpul" />
        </div>
      </div>
    </div>
  );
}
