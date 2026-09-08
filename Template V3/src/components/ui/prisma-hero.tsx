import { useEffect, useRef } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   PRISMA — video sebagai panel kiri halaman gerbang
   ════════════════════════════════════════════════════════════════════════
   Tampilan KETIGA panel kiri /akses, di samping Foto dan Lonceng. Dari
   templat yang dikirim pemilik 8 Sep 2026.

   ── TINGGAL VIDEONYA ────────────────────────────────────────────────────
   Templatnya menaruh nama merek raksasa di atas video, dan itu sempat
   dipasang. Pemilik menghapusnya di hari yang sama: gambarnya jadi terlalu
   ramai. Maka yang tersisa videonya saja — keterangan merek yang kecil di
   kaki panel dikembalikan ke tempat asalnya di `Akses.tsx`, sama seperti
   yang dipakai tampilan Foto dan Lonceng.

   Ikut hilang bersamanya: `WordsPullUp`, animasi huruf naik kata demi kata
   dari templat itu. Ia tidak dipakai di tempat lain, dan komponen bergerak
   yang tidak pernah digambar cuma menyisakan pertanyaan. Ada di riwayat
   git kalau suatu saat diperlukan lagi.

   ── SOAL VIDEO LATARNYA ─────────────────────────────────────────────────
   Videonya ditaruh di CloudFront milik orang lain. Percobaan pertama
   menggantinya dengan gambar merek sendiri supaya gerbang tidak bergantung
   pada berkas yang tak bisa kita jaga; pemilik menolaknya — hasilnya
   dinilai jauh di bawah kode aslinya, dan risiko tautan mati dianggap
   murah karena tinggal ditukar. Keputusan itu miliknya.

   `poster` tetap dipasang: bukan pengganti keputusan itu, melainkan
   penyangga selama 15 MB videonya masih dalam perjalanan — tanpa itu,
   bingkai pertama halaman masuk adalah kotak hitam. Kalau videonya
   benar-benar hilang suatu hari, poster inilah yang tersisa, dan
   gerbangnya tetap terlihat disengaja.
   ════════════════════════════════════════════════════════════════════════ */

/* Bintik sebagai data-URI, bukan berkas: satu permintaan jaringan lagi di
   halaman masuk untuk tekstur setipis ini tidak sepadan, dan berkas yang
   gagal dimuat meninggalkan bidang yang terlalu bersih dibanding
   rancangannya. */
const BINTIK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4';

export function PanelGerbangPrisma({ poster }: { poster: string }) {
  /* ── DIPUTAR SENDIRI, JANGAN CUMA DIMINTA ────────────────────────────
     Atribut `autoplay` bukan jaminan: sebagian peramban menahannya sampai
     ada sentuhan, dan yang tersisa poster diam. Terukur saat menguji tema
     ini — videonya siap penuh (readyState 4) tapi `paused` tetap true
     sampai `play()` dipanggil tangan.

     Penolakannya ditelan: kalau peramban memang melarang, poster yang
     tampil sudah cukup, dan galat di konsol halaman masuk tidak menolong
     siapa pun. */
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const coba = () => { void v.play().catch(() => { /* ditahan peramban */ }); };
    coba();
    v.addEventListener('loadeddata', coba);
    return () => v.removeEventListener('loadeddata', coba);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-zinc-950">
      {/* muted + playsInline WAJIB dua-duanya: tanpa `muted` peramban
          menolak memutar sendiri, dan tanpa `playsInline` iOS membuka
          videonya layar penuh begitu ia mulai. */}
      <video
        ref={video}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={poster}
        aria-hidden="true"
        className="absolute inset-0 size-full object-cover"
        src={VIDEO}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55] mix-blend-overlay"
        style={{ backgroundImage: BINTIK }}
      />

      {/* Tiga tirai, tiga tugas. Dua yang pertama dari templatnya: menahan
          bagian atas dan menggelapkan kaki panel supaya keterangan merek di
          sana terbaca berapa pun terangnya bingkai video yang sedang lewat.
          Yang ketiga milik kita — menyatukan sisi kanan panel dengan kolom
          isi di sebelahnya, sama seperti pada tampilan Foto. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-zinc-950/85 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-zinc-950" />
    </div>
  );
}
