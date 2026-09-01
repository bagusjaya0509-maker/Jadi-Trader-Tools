/* ══════════════════════════════════════════════════════════════════════════
   simbol-bursa.js — menerjemahkan nama koin Hyperliquid ke simbol Binance
   ══════════════════════════════════════════════════════════════════════════
   Dompet yang dipantau hidup di Hyperliquid, dan Hyperliquid menamai
   koinnya dengan caranya sendiri. Menyalin posisinya ke Binance menuntut
   satu langkah yang selama ini dilewati: menerjemahkan namanya.

   ── APA YANG SALAH SEBELUM BERKAS INI ADA ──────────────────────────────
   Penjaga auto-close menyusun simbolnya begini:

       const simbol = t.koin + 'USDT';

   Untuk BTC dan ETH itu benar. Untuk kPEPE ia menghasilkan `KPEPEUSDT` —
   simbol yang tidak pernah ada di Binance, yang tidak akan pernah cocok
   dengan posisi mana pun, dan yang GAGAL TANPA SUARA: penjaganya cuma
   menyimpulkan "aku tidak punya posisi itu" lalu berjalan terus. Sakelar
   auto-close-nya menyala di layar, tapi tidak pernah bisa mengeksekusi
   apa pun seumur hidupnya.

   ── DUA ATURAN PENERJEMAHAN ────────────────────────────────────────────
   1. Awalan `k` di Hyperliquid berarti KELIPATAN SERIBU: 1 kPEPE = 1000
      PEPE. Binance menuliskan hal yang sama sebagai `1000PEPEUSDT`. Jadi
      itu padanan yang paling setia — bukan cuma namanya yang cocok,
      SATUANNYA juga sama, dan itu yang membuat ukurannya tidak perlu
      dikonversi belakangan.
   2. Sebagian koin memang tidak ada di Binance Futures sama sekali. Itu
      BUKAN kegagalan yang perlu disembunyikan — ia jawaban, dan jawaban
      itulah yang dipakai layar untuk menulis "koin ini tidak ada di
      Binance" alih-alih diam.

   ── SIAPA WASITNYA ─────────────────────────────────────────────────────
   Bukan daftar yang ditulis tangan di sini. Daftar semacam itu basi diam-
   diam setiap kali Binance menambah atau mencabut listing, dan yang
   membaca kode ini tidak akan pernah tahu kapan itu terjadi.

   Wasitnya `/api/symbol-filters` — yang meneruskan `exchangeInfo` Binance
   dan sudah menjawab 404 untuk simbol yang tidak ada. Berkas ini cuma
   menyusun DAFTAR TEBAKAN yang masuk akal, lalu menanyakannya satu per
   satu sampai ada yang dijawab.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* Hasilnya diingat: listing bursa tidak berubah dalam hitungan menit, dan
   bertanya ulang tiap putaran pindai berarti puluhan permintaan per menit
   untuk jawaban yang sama.

   Yang TIDAK ADA diingat jauh lebih sebentar daripada yang ada. Koin baru
   yang listing hari ini harus bisa ditemukan hari ini juga; koin yang
   sudah ada tidak akan tiba-tiba hilang. */
const UMUR_ADA = 24 * 60 * 60 * 1000;
const UMUR_TIADA = 30 * 60 * 1000;
const ingat = new Map();

/** Daftar tebakan simbol Binance Futures untuk sebuah koin Hyperliquid,
 *  URUT dari yang paling mungkin benar.
 *
 *  Murni fungsi — tidak menyentuh jaringan, jadi bisa diuji sendiri. */
function calonSimbol(koin) {
  const k = String(koin || '').trim().toUpperCase();
  if (!k) return [];

  const calon = [];

  /* `k` di depan = kelipatan seribu. `1000X` didahulukan karena satuannya
     SAMA persis dengan kX-nya; nama polosnya dicoba belakangan sebagai
     jaring, dan kalau itu yang kena ukurannya tetap benar karena kita
     menghitung dari nilai dolar, bukan dari jumlah koin. */
  if (/^K[A-Z0-9]{2,}$/.test(k)) {
    calon.push('1000' + k.slice(1) + 'USDT', k.slice(1) + 'USDT');
  }
  /* Arah sebaliknya: dompet yang sudah menuliskannya ala Binance. */
  if (/^1000[A-Z0-9]{2,}$/.test(k)) calon.push(k + 'USDT', k.slice(4) + 'USDT');

  calon.push(k + 'USDT');
  return [...new Set(calon)];
}

/** Simbol Binance Futures untuk `koin`, atau null kalau memang tidak ada.
 *
 *  null berarti "sudah ditanyakan, jawabannya tidak ada" — BUKAN "gagal
 *  bertanya". Kegagalan jaringan melempar, supaya pemanggilnya bisa
 *  membedakan koin yang tidak terdaftar dari bursa yang sedang bisu.
 *  Keduanya menuntun ke keputusan yang berlawanan: yang pertama boleh
 *  dilaporkan ke pengguna sebagai fakta, yang kedua harus dicoba lagi. */
async function simbolBinance(koin, { dasar, token, catat = () => {} } = {}) {
  const k = String(koin || '').trim().toUpperCase();
  if (!k) return null;

  const tersimpan = ingat.get(k);
  if (tersimpan) {
    const umur = tersimpan.simbol ? UMUR_ADA : UMUR_TIADA;
    if (Date.now() - tersimpan.waktu < umur) return tersimpan.simbol;
  }

  if (!token) throw new Error('APP_TOKEN kosong — tidak bisa bertanya ke bursa');

  let adaYangMenjawab = false;
  for (const s of calonSimbol(k)) {
    let r;
    try {
      r = await fetch(dasar + '/api/symbol-filters?symbol=' + encodeURIComponent(s), {
        headers: { 'X-App-Token': token }, signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      /* Jaringan putus di tengah daftar. Jangan simpulkan apa pun dari
         sisa daftar yang belum sempat ditanya. */
      throw new Error('gagal bertanya ke bursa: ' + (e && e.message));
    }
    if (r.ok) {
      ingat.set(k, { simbol: s, waktu: Date.now() });
      if (s !== k + 'USDT') catat('  simbol: ' + k + ' -> ' + s);
      return s;
    }
    /* 404 = simbolnya memang tidak ada; lanjut ke tebakan berikutnya.
       Selain itu (500, 502, token ditolak) bursa yang bermasalah, bukan
       simbol yang tidak ada. */
    if (r.status === 404) { adaYangMenjawab = true; continue; }
    throw new Error('bursa menjawab ' + r.status + ' untuk ' + s);
  }

  if (!adaYangMenjawab) throw new Error('tidak satu pun tebakan terjawab untuk ' + k);
  ingat.set(k, { simbol: null, waktu: Date.now() });
  return null;
}

/** Buang ingatan — dipakai pengujian, dan kalau suatu saat ada rute yang
 *  perlu memaksa pembacaan ulang listing. */
function lupakan() { ingat.clear(); }

module.exports = { calonSimbol, simbolBinance, lupakan };
