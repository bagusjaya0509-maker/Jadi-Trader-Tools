/* ══════════════════════════════════════════════════════════════════════════
   kartu-agen.js — mengubah sinyal terbaca jadi kartu di Copy Signal
   ══════════════════════════════════════════════════════════════════════════
   BERDIRI SENDIRI, dan itu disengaja. Pemantau Telegram memakainya saat ada
   pesan sungguhan; alat uji memakainya untuk menembakkan sinyal karangan.
   Kalau alat ujinya menyalin kodenya, yang diuji bukan yang berjalan --
   dan uji yang menguji salinannya sendiri selalu lulus.

   Nama agen menentukan KARTU MANA yang terisi: server menurunkan uid dari
   nama tampilannya (`uidAgenDari`), jadi 'AI Telg' -> `agen:ai-telg`.
   Mengganti namanya berarti membuat kartu BARU dan meninggalkan riwayat
   lamanya di uid lama -- pernah kejadian, dan papannya menampilkan dua
   kartu bernama sama dengan statistik terbelah tanpa satu pun galat.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const NAMA_AGEN = process.env.TG_AGEN_NAMA || 'AI Telg';
const DASAR = 'http://127.0.0.1:' + (process.env.PORT || 4000);
const APP_TOKEN = process.env.APP_TOKEN || '';
const MT5_KLINES = path.join(__dirname, 'mt5-klines.json');

/* ── HARGA PASAR UNTUK ENTRY YANG TIDAK DISEBUT ────────────────────────
   Rute kartu menolak sinyal tanpa entry, sementara grup ini sering menulis
   "buy now xauusd" -- yang artinya HARGA PASAR, bukan harga yang lupa
   ditulis. Dibaca dari berkas lilin MT5 yang memang sudah dipoll EA di
   mesin yang sama; tidak ada permintaan jaringan baru untuk ini. */
/* Lilin yang lebih tua dari ini BUKAN harga pasar. */
const UMUR_MAKS_MS = 30 * 60 * 1000;

function hargaPasar(pasangan) {
  try {
    const j = JSON.parse(fs.readFileSync(MT5_KLINES, 'utf8'));
    const uid = Object.keys(j)[0];
    const lg = uid && Object.keys(j[uid])[0];
    const w = lg && j[uid][lg][pasangan];
    for (const tf of ['15m', '5m', '1h', '4h']) {
      const isi = w && w[tf];
      const bar = isi && (isi.data || isi.bar);
      if (!bar || !bar.length) continue;
      /* UMURNYA DIPERIKSA, dan ini bukan kehati-hatian berlebihan.
         ──────────────────────────────────────────────────────────────
         Terminal MT5 mati itu kejadian rutin, dan saat mati berkas ini
         berhenti diperbarui tanpa berubah bentuk. Versi pertama
         memulangkan lilin terakhir apa adanya, jadi harga berumur
         delapan hari dipakai sebagai "harga pasar saat sinyal terbaca"
         -- terukur meleset 229 poin. Kartunya lalu terbit dengan entry
         yang tidak pernah ada, dan alasannya menyatakan itu harga pasar.

         0 berarti "tidak tahu", dan pemanggilnya sudah membatalkan
         posting untuk 0. Tidak tahu lebih baik daripada salah. */
      const t = Number(bar[bar.length - 1][0]) || 0;
      if (t && Date.now() - t > UMUR_MAKS_MS) continue;
      return Number(bar[bar.length - 1][4]) || 0;
    }
  } catch (e) { /* belum ada lilin — ditangani pemanggil */ }
  return 0;
}

/** Entry untuk kartunya. 0 berarti tidak ada yang bisa dipakai secara
 *  jujur, dan pemanggilnya BATAL memposting — kartu dengan entry karangan
 *  lebih buruk daripada tidak ada kartu. */
function entryKartu(sn) {
  if (sn.entry) return sn.entry;
  if (sn.rentang) {
    /* Ujung yang PALING TIDAK MENGUNTUNGKAN, bukan titik tengahnya.
       Titik tengah adalah harga yang tidak pernah disebut siapa pun di
       ruang itu; ujungnya tertulis hitam di atas putih. Memilih ujung yang
       merugikan berarti kartunya tidak pernah menyanjung sinyalnya — kalau
       ia tetap menang di harga terburuk zona, kemenangannya nyata. */
    return sn.arah === 'BUY' ? sn.rentang[1] : sn.rentang[0];
  }
  return hargaPasar(sn.pasangan);
}

/** Semua entry yang harus jadi kartu. Zona "4613 - 4609" adalah CARA
 *  MASUK, bukan satu harga: ruang itu memasang order di kedua ujungnya
 *  dan membiarkan harga memilih. Satu kartu per ujung meniru itu apa
 *  adanya — dua pending dengan SL/TP yang sama, persis seperti yang
 *  dikerjakan orang di grupnya. Diputuskan pemilik, 27 Agu 2026.
 *
 *  Ujung TERDEKAT dari arah datangnya harga ditulis lebih dulu supaya
 *  urutan kartunya sama dengan urutan kemungkinan tersentuhnya: BUY
 *  menunggu harga TURUN, jadi ujung atas tersentuh duluan. */
function daftarEntry(sn) {
  if (sn.entry) return [sn.entry];
  if (sn.rentang) {
    const [lo, hi] = sn.rentang;
    if (lo === hi) return [lo];
    return sn.arah === 'BUY' ? [hi, lo] : [lo, hi];
  }
  const pasar = hargaPasar(sn.pasangan);
  return pasar ? [pasar] : [];
}

/** Layak jadi kartu? Butuh arah, dan setidaknya satu dari SL/TP.
 *  Yang masih 'pantau' TIDAK dikirim — kartu adalah ajakan bertindak, dan
 *  pesan yang menyuruh menunggu bukan itu. */
function layakKartu(sn) {
  /* LENGKAP: SL **dan** TP, bukan salah satunya.
     ────────────────────────────────────────────────────────────────────
     Versi pertama menembak begitu ada salah satu, lalu mengunci id-nya --
     jadi TP yang datang semenit kemudian tidak pernah sampai ke kartunya,
     dan yang terbit adalah kartu publik TANPA STOP LOSS. Di ruang itu SL
     dan TP memang biasa datang di dua pesan berbeda, jadi keadaan ini
     bukan kasus sudut melainkan jalur yang biasa dilewati.

     Medan `lengkap` sudah dihitung perangkai sejak awal dan tidak pernah
     dipakai siapa pun. Sekarang dipakai. Menunggu satu pesan lagi jauh
     lebih murah daripada menerbitkan posisi tanpa perlindungan. */
  return !!sn && sn.jenis === 'sinyal' && !!sn.lengkap;
}

async function kirimKartu(sn, opsi = {}) {
  const { tautan = '', teks = '', catat = console.log } = opsi;
  /* Zona = satu kartu per ujung. Keduanya dicoba; yang gagal di
     pemeriksaan sisi dilewati SENDIRI tanpa menggagalkan pasangannya —
     harga yang sudah bergerak bisa membuat satu ujung tak masuk akal
     sementara ujung lainnya masih rencana yang utuh. */
  const semuaEntry = daftarEntry(sn);
  if (!semuaEntry.length) { catat('  kartu dilewati — entry tidak diketahui'); return null; }
  let idPertama = null;
  for (let ke = 0; ke < semuaEntry.length; ke++) {
    const id = await kirimSatuKartu(sn, semuaEntry[ke], ke, semuaEntry.length, { tautan, teks, catat });
    if (id && !idPertama) idPertama = id;
  }
  return idPertama;
}

async function kirimSatuKartu(sn, entry, ke, dari, opsi) {
  const { tautan = '', teks = '', catat = console.log } = opsi;

  /* SL/TP DI SISI YANG BENAR — diperiksa ULANG di sini, dan bukan
     pengulangan yang sia-sia.
     ──────────────────────────────────────────────────────────────────
     Perangkai sudah memeriksanya, tapi hanya untuk sinyal yang menyebut
     entry-nya sendiri. Untuk "buy now" entry-nya baru ditentukan DI SINI,
     dari harga pasar saat pesannya terbaca — dan harga bergerak. Uji
     pertama langsung memperlihatkannya: SL 4632 yang ditulis admin saat
     harga di atasnya, dipasangkan dengan entry pasar 4630, menghasilkan
     BUY dengan stop di ATAS harga masuk.

     Kartu semacam itu bukan sekadar aneh: penilai akan membacanya sebagai
     posisi yang langsung tersentuh stop, dan winrate agennya turun karena
     kesalahan pencatatan, bukan karena sinyalnya. Lebih baik tidak ada
     kartu daripada kartu yang menghukum sumbernya atas kesalahan kita. */
  const beli = sn.arah === 'BUY';
  if (sn.sl && (beli ? sn.sl >= entry : sn.sl <= entry)) {
    catat('  kartu dilewati — SL ' + sn.sl + ' di sisi yang salah untuk '
      + sn.arah + ' di ' + entry + ' (harga sudah lewat sejak sinyalnya ditulis)');
    return null;
  }
  if ((sn.tp || []).length && (beli ? sn.tp[0] <= entry : sn.tp[0] >= entry)) {
    catat('  kartu dilewati — TP ' + sn.tp[0] + ' di sisi yang salah untuk '
      + sn.arah + ' di ' + entry);
    return null;
  }

  const kripto = /USDT$/.test(sn.pasangan);
  const badan = {
    agenNama: NAMA_AGEN,
    pasangan: sn.pasangan,
    tf: '15m',
    arah: sn.arah,
    pasar: kripto ? 'kripto' : 'tradefi',
    judul: sn.pasangan + ' ' + sn.arah
         + (dari > 1 ? ' — zona, lapis ' + (ke + 1) + '/' + dari + ' @ ' + entry
                     : ' — dari grup sinyal'),
    ringkas: 'Dibaca otomatis dari ruang sinyal Telegram yang diikuti pemilik'
           + (sn.pasanganDitebak ? '. Pasangan tidak disebut di pesannya, ditebak ' + sn.pasangan : '')
           + '.',
    isi: {
      entry: entry,
      sl: sn.sl || 0,
      tp: (sn.tp && sn.tp[0]) || 0,
      /* SUMBERNYA DITULIS TERANG-TERANGAN, berikut tautan ke pesan
         aslinya. Sinyal ini bukan hasil analisa sistem ini sendiri, dan
         kartu yang tidak menyebutkannya memberi kesan sebaliknya kepada
         siapa pun yang membacanya nanti. */
      alasan: 'Sumber: ruang sinyal Telegram (bukan analisa sistem ini).\n'
            + (tautan ? 'Pesan asli: ' + tautan + '\n' : '')
            + '\n'
            + (sn.entry ? ''
               : sn.rentang
                 ? 'Pesannya memberi zona ' + sn.rentang.join(' - ')
                   + '. Zona adalah cara masuk berlapis, jadi tiap ujungnya diterbitkan '
                   + 'sebagai kartu sendiri — ini lapis ' + (ke + 1) + ' dari ' + dari
                   + ', entry ' + entry + ', SL/TP sama untuk semua lapis.\n'
                 : 'Entry tidak disebut — dipakai harga pasar saat sinyal terbaca.\n')
            + ((sn.tp || []).length > 1 ? 'TP berjenjang: ' + sn.tp.join(' / ') + '\n' : '')
            + (sn.potongan > 1 ? 'Disusun dari ' + sn.potongan + ' pesan berurutan.\n' : '')
            + (teks ? '\nKutipan pesan:\n' + String(teks).slice(0, 900) : ''),
    },
  };

  try {
    const r = await fetch(DASAR + '/api/analisa/agen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
      body: JSON.stringify(badan),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { catat('  kartu ditolak', r.status, JSON.stringify(j).slice(0, 140)); return null; }
    catat('  kartu terkirim ke', NAMA_AGEN, '·', sn.pasangan, sn.arah,
      'entry', entry, 'sl', sn.sl || '-', 'tp', (sn.tp || [])[0] || '-');
    return j.id || null;
  } catch (e) {
    catat('  kartu gagal:', e.message);
    return null;
  }
}

/** Daftarkan diri di papan supaya KARTUNYA ADA sebelum sinyal pertama.
 *
 *  Tanpa ini kartunya baru muncul saat Bang Pras memposting — dan sampai
 *  saat itu tidak ada cara membedakan "agennya hidup, grupnya sepi" dari
 *  "agennya mati". Keduanya sama-sama papan kosong. */
async function daftarHadir(catat = console.log) {
  try {
    const r = await fetch(DASAR + '/api/analisa/agen/hadir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
      body: JSON.stringify({
        /* `nama`, BUKAN `agenNama` -- rute kehadiran memakai kunci yang
           berbeda dari rute sinyal, dan mengirim kunci yang salah pulang
           400 tanpa menjelaskan yang mana. Ketahuan saat diuji.
           `pasangan` juga ANGKA di sini (berapa banyak yang dipantau),
           bukan daftar namanya. */
        nama: NAMA_AGEN,
        strategi: 'Membaca ruang sinyal Telegram yang diikuti pemilik. Tidak '
                + 'menganalisa sendiri: ia menyusun sinyal dari pesan berurutan '
                + '(arah, zona, SL/TP) lalu memposting apa adanya.',
        pasangan: 1,
        tf: '15m',
      }),
    });
    catat(r.ok ? 'terdaftar di papan sebagai ' + NAMA_AGEN
                : 'daftar hadir ditolak ' + r.status);
  } catch (e) { catat('daftar hadir gagal:', e.message); }
}

module.exports = { kirimKartu, layakKartu, entryKartu, hargaPasar, daftarHadir, NAMA_AGEN };
