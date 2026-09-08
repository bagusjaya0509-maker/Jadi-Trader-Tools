import { StrictMode } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   TAUTAN LAMA BERBENTUK #/rute — DISELAMATKAN SEBELUM REACT JALAN
   ════════════════════════════════════════════════════════════════════════
   Ini bukan kerapian, ini uang yang hilang. Ditemukan 21 Agu 2026: seorang
   pembeli membayar lewat Lynk dan menerima tautan aktivasi berbentuk

       https://bagusjaya0509-maker.github.io/Jadi-Trader-Tools/v3/#/aktivasi

   Aplikasinya memakai BrowserRouter sejak 17 Agu 2026, jadi "#/aktivasi"
   cuma fragmen — rutenya tidak pernah terbuka. Halaman /aktivasi itulah
   yang memanggil mintaAkses({ jenis: 'bayar' }), jadi permintaannya tidak
   pernah tercatat sebagai berbayar. Pembelinya lalu memakai formulir
   gratis, dan kuota perintis tetap 0/80 sementara satu tempat GRATIS
   terpakai oleh orang yang sudah membayar.

   Tautan seperti itu SUDAH tersebar di surel yang terkirim; tidak ada cara
   menariknya kembali. Jadi yang diperbaiki di sini penerimanya, bukan
   pengirimnya — dan perbaikan di pengirim (tautan di Lynk) tetap harus
   dilakukan terpisah.

   Dijalankan SEBELUM createRoot: router membaca alamat saat ia dipasang,
   jadi pembetulan yang datang belakangan sudah terlambat satu render.

   Hanya untuk hash yang berbentuk RUTE (#/sesuatu). Jangkar biasa seperti
   #harga tidak disentuh — itu tautan ke seksi di halaman yang sama. */
/* ── KODE REFERRAL DARI ?ref= — DISIMPAN SEBELUM ROUTER MENYENTUH ALAMAT ──
   Tautan referral berbentuk /akses?ref=JTXXXXXX. Disimpan di sini, bukan
   di halaman Akses, karena beberapa halaman mengganti query string saat
   dipasang (pengalihan gerbang, tab) dan kode yang cuma dibaca satu
   render kemudian bisa sudah hilang. Bentuk dan kuncinya harus sama
   dengan bacaRefKode() di lib/referral.ts — sengaja tidak diimpor dari
   sana: main.tsx harus tetap ringan, dan lib itu menyeret Firebase. */
{
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) {
      localStorage.setItem('jt.ref', JSON.stringify({ kode: ref.toUpperCase(), waktu: Date.now() }));
    }
  } catch { /* mode privat: tanpa referral, aplikasinya tetap jalan */ }
}

{
  const hash = window.location.hash;
  if (hash.startsWith('#/') && hash.length > 2) {
    const rute = hash.slice(1) + window.location.search;
    /* Di domain GitHub Pages, aplikasinya duduk di bawah awalan
       /Jadi-Trader-Tools/v3/ dan GitHub tidak punya jaring SPA untuk
       alamat sembarang — mengganti alamat di tempat akan menghasilkan 404
       miliknya GitHub. Jadi yang dituju domain sungguhannya. */
    if (window.location.hostname.endsWith('github.io')) {
      window.location.replace('https://jaditrader.co.id' + rute);
    } else {
      window.history.replaceState(null, '', rute);
    }
  }
}

import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/* Dijalankan setelah render, bukan sebelumnya: memeriksa versi tidak boleh
   menunda tampilnya halaman. Kalau ternyata usang, muat ulang terjadi dalam
   sepersekian detik berikutnya. */
void import('@/lib/versi').then((m) => m.periksaVersi());
