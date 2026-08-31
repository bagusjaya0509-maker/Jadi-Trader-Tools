/* ══════════════════════════════════════════════════════════════════════════
   rangkai.js — menyusun satu sinyal dari beberapa pesan
   ══════════════════════════════════════════════════════════════════════════
   DIBANGUN DARI PESAN SUNGGUHAN, bukan dari format yang dibayangkan. Begini
   bentuk aslinya di ruang Signal VIP ASF:

       09:13   buy now xauusd            <- arah + pasangan, TANPA angka
       09:14   (gambar chart)
       09:14   SL 4632                   <- angka, TANPA pasangan & arah
               TP 4654

   Diurai satu-satu, DUA-DUANYA pulang kosong. Pesan pertama gugur karena
   tidak punya satu angka pun; pesan kedua gugur karena tidak menyebut
   pasangan maupun arah. Jadi sinyal yang lengkap dan jelas bagi manusia
   hilang seluruhnya — bukan karena penguarainya lemah, melainkan karena ia
   menatap satuan yang salah. Satuan sinyal di sini BUKAN pesan; ia
   percakapan pendek.

   Yang dilakukan berkas ini: menahan draf terbuka selama JENDELA menit,
   lalu menyusui draf itu dengan potongan yang datang menyusul. Draf
   diterbitkan ulang setiap kali ia bertambah lengkap — id-nya tetap sama,
   jadi lonceng menimpanya alih-alih berbunyi tiga kali untuk satu sinyal.

   BATAS YANG DIPEGANG: potongan hanya digabungkan kalau datang dari
   PENGIRIM YANG SAMA dan di dalam jendela waktu. Tanpa dua syarat itu,
   "SL 4632" milik seseorang akan menempel ke sinyal orang lain, dan
   angkanya akan tampak sah.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const { uraiPola, normalPasangan, masukAkal } = require('./urai-sinyal');

/* Berapa lama draf menunggu potongan susulan. 15 menit diambil dari
   pengamatan: jarak "buy now xauusd" ke "SL/TP"-nya satu menit, dan jarak
   ke sinyal BERIKUTNYA belasan menit. Terlalu panjang berarti angka sinyal
   baru menempel ke sinyal lama; terlalu pendek berarti admin yang sedang
   mengetik pelan kehilangan separuh sinyalnya. */
const JENDELA_MS = 15 * 60 * 1000;

/* Grup ini memperdagangkan emas dan hampir tidak pernah yang lain — semua
   contoh yang terlihat XAUUSD. Jadi pesan seperti "OTE BUY PANTAU" yang
   tidak menyebut pasangan diberi pasangan bawaan ini, TAPI ditandai
   `pasanganDitebak` supaya tebakan itu terlihat di layar dan tidak
   menyamar sebagai sesuatu yang benar-benar tertulis di pesannya. */
const BAWAAN = (process.env.TG_PASANGAN_BAWAAN || 'XAUUSD').toUpperCase();

/* ── Potongan yang bisa berdiri sendiri ───────────────────────────────── */

/** "SL 4632" / "TP 4654" tanpa konteks apa pun. */
function potonganAngka(teks, pasangan) {
  const t = String(teks || '');
  const sl = [];
  for (const m of t.matchAll(/\bSL\s*[:=@ ]*\s*([\d.,]+)/gi)) {
    const n = Number(String(m[1]).replace(/,/g, ''));
    if (masukAkal(pasangan, n)) sl.push(n);
  }
  const tp = [];
  for (const m of t.matchAll(/\bTP\s*([1-5])?(?![\d.,])\s*[:=@ ]*\s*([\d.,]+)/gi)) {
    const n = Number(String(m[2]).replace(/,/g, ''));
    if (masukAkal(pasangan, n)) tp.push(n);
  }
  return { sl: sl.length ? sl[0] : null, tp };
}

/** "Range Harga 4640 - 4646" — entry berupa RENTANG, bukan satu harga.
 *
 *  Disimpan sebagai dua ujungnya, bukan diperas jadi titik tengahnya.
 *  Titik tengah adalah harga yang tidak pernah disebut siapa pun, dan
 *  menaruhnya di kolom Entry berarti melaporkan sesuatu yang tidak ada di
 *  pesan aslinya. Yang dipakai untuk order nanti biarlah pemiliknya yang
 *  memilih; tugas di sini menyampaikan apa yang tertulis. */
function potonganRentang(teks, pasangan) {
  const t = String(teks || '');
  /* Dicari POLA ANGKANYA, bukan kata kuncinya.
     ──────────────────────────────────────────────────────────────────
     Versi pertama menuntut "range"/"zone" menempel pada angkanya, dan
     itu gugur pada bentuk yang sungguh-sungguh dipakai di ruang itu:
     "Zone buy xauusd 4648 - 4645" menyelipkan arah dan pasangan di
     antara keduanya. Menambal daftar kata di tengah cuma menunda
     kegagalan sampai admin menulis susunan berikutnya.

     Dua angka wajar yang dipisah tanda hubung SUDAH cukup khas untuk
     dikenali sendiri. Yang perlu ditolak cuma satu: angka yang tepat
     didahului SL atau TP -- "TP 4580 - 4590" itu dua target berjenjang,
     bukan zona masuk, dan membacanya sebagai zona akan memindahkan
     harga masuk ke tempat yang tidak pernah disebut. */
  for (const m of t.matchAll(/([\d.,]{3,})\s*[-–—]\s*([\d.,]{3,})/g)) {
    /* Yang diperiksa SELURUH BARISNYA, bukan delapan huruf sebelum angka.
       ────────────────────────────────────────────────────────────────
       Penjaga lama cuma mengintip tepat di depan angkanya, jadi satu kata
       sisipan mematahkannya seluruhnya: "TP AREA 4660 - 4680",
       "TP FINAL ...", "TP nya ...", bahkan "TP  :  ..." dengan spasi
       berlebih. Dan "TARGET"/"TAKE PROFIT" tidak pernah dikenali sama
       sekali.

       Akibatnya bukan sekadar salah label: zona TARGET masuk sebagai zona
       ENTRY, entryKartu memilih ujung terjauhnya, dan kartu terbit dengan
       harga masuk = harga TARGET. Pasar di 4642, kartu menyuruh masuk di
       4680. Itu kesalahan yang merugikan uang, bukan statistik.

       Label menempel pada BARIS, jadi barisnya yang dibaca. */
    const awalBaris = t.lastIndexOf('\n', m.index) + 1;
    const baris = t.slice(awalBaris, m.index);
    if (/\b(SL|TP|TARGET|TAKE\s*PROFIT|STOP\s*LOSS|CUT\s*LOSS)\b/i.test(baris)) continue;
    const a = Number(String(m[1]).replace(/,/g, ''));
    const b = Number(String(m[2]).replace(/,/g, ''));
    if (!masukAkal(pasangan, a) || !masukAkal(pasangan, b)) continue;
    return [Math.min(a, b), Math.max(a, b)];
  }
  return null;
}

/** Arah + pasangan tanpa angka: "buy now xauusd", "OTE BUY PANTAU". */
function potonganArah(teks) {
  const t = String(teks || '');
  const mArah = t.match(/\b(BUY|SELL|LONG|SHORT)\b/i);
  if (!mArah) return null;
  let pasangan = '';
  for (const m of t.toUpperCase().matchAll(/\b([A-Z]{2,10}[0-9]{0,3})\b/g)) {
    const p = normalPasangan(m[1]);
    if (p) { pasangan = p; break; }
  }
  return {
    arah: /^(buy|long)$/i.test(mArah[1]) ? 'BUY' : 'SELL',
    pasangan,
  };
}

const KATA_TUNGGU = ['pantau', 'pantai', 'pantaj', 'tunggu', 'sabar', 'wait', 'belum', 'side ways', 'sideways', 'stand by', 'standby'];
/* 'selamat' DICABUT dari daftar ini, dan batas kata tidak bisa
   menyelamatkannya: "Selamat pagi" memuat "selamat" sebagai kata utuh.
   Sapaan pagi yang menghapus draf sinyal adalah kegagalan yang tidak
   mungkin ditebak dari gejalanya -- tidak ada galat, cuma sinyal yang
   tidak pernah sampai.

   Kalimat yang dulu ingin ditangkapnya, "Mudahan TP sampai tujuan dengan
   selamat", tetap tertangkap lewat "tp sampai". Kata pengunci harus
   spesifik pada urusan trading; kata sopan sehari-hari tidak boleh ikut. */
const KATA_SELESAI = ['tp sampai', 'kena tp', 'tp kena', 'close', 'cut',
  'sl kena', 'kena sl', 'done'];

/* Masuk LAGI di arah yang sama. Pesannya tidak menyebut BUY/SELL sama
   sekali -- arahnya jelas bagi yang membaca dari atas, tapi tidak bagi
   penguarai yang menatap satu pesan.

   Ini WAJIB membuka draf baru, bukan menyuapi yang lama. Diuji dengan
   runtun sungguhan: "SELL NOW XAUUSD / SL 4600 / TP 4574" lalu "Aku
   reentry / SL 4605 / TP 4580" -- tanpa penanganan ini, SL 4605 ditolak
   karena drafnya sudah punya SL, dan TP 4580 menempel jadi TP kedua
   sinyal pertama. Hasilnya satu kartu dengan level campuran dua posisi
   yang berbeda, dan tidak ada satu pun tanda bahwa itu keliru. */
const KATA_REENTRY = [
  'reentry', 're-entry', 're entry', 'entry lagi', 'masuk lagi',
  'tambah posisi', 'add posisi', 'averaging', 'layer lagi',
];

/* BATAS KATA WAJIB, dan tanpanya sinyal hilang tanpa jejak.
   ──────────────────────────────────────────────────────────────────────
   Versi pertama memakai includes() polos. Yang terjadi di ruang berbahasa
   Indonesia:

       "Selamat pagi"   memuat "selamat"  -> draf DIHAPUS
       "Indonesia"      memuat "done"     -> draf DIHAPUS
       "sebelum"        memuat "belum"    -> sinyal terkunci jadi 'pantau'
       "Kuwait"         memuat "wait"     -> sinyal terkunci jadi 'pantau'

   Sapaan pagi yang menghapus sinyal adalah kegagalan yang tidak mungkin
   ditebak dari gejalanya: tidak ada galat, tidak ada baris log, cuma
   sinyal yang tidak pernah sampai. */
const _kataCache = new Map();
function polaKata(k) {
  let re = _kataCache.get(k);
  if (!re) {
    const aman = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    re = new RegExp('(^|[^a-z0-9])' + aman + '($|[^a-z0-9])', 'i');
    _kataCache.set(k, re);
  }
  return re;
}
function adaKata(teks, daftar) {
  const t = String(teks || '');
  return daftar.some((k) => polaKata(k).test(t));
}

/* ── Perangkai ────────────────────────────────────────────────────────── */
class Perangkai {
  constructor() {
    /* Satu draf per pengirim. Admin yang berbeda bisa memposting sinyal
       berbeda pada menit yang sama, dan satu draf bersama akan mengaduk
       angka keduanya. */
    this.draf = new Map();
  }

  /**
   * Suapi satu pesan. Mengembalikan sinyal yang SUDAH DIPERBARUI kalau
   * pesan ini menambah sesuatu, atau null kalau tidak mengubah apa pun.
   *
   * Tidak pernah melempar — pemanggilnya sudah menyimpan pesan mentahnya
   * dan membunyikan lonceng sebelum ini dipanggil.
   */
  suap(kirim) {
    const { dari, teks, waktu, pesanId } = kirim;
    const t = String(teks || '').trim();
    if (!t) return null;

    const kunci = String(dari || 'x');
    let d = this.draf.get(kunci);
    if (d && waktu - d.terakhir > JENDELA_MS) d = null;   // kedaluwarsa

    /* Satu pesan yang sudah lengkap sendiri tetap jalan lewat jalur lama —
       tidak semua grup memecah sinyalnya, dan yang utuh tidak perlu
       menunggu potongan yang tidak akan datang. */
    const utuh = uraiPola(t);
    if (utuh) {
      /* RENTANG MENANG ATAS ENTRY TUNGGAL di pesan yang sama.
         ────────────────────────────────────────────────────────────────
         "Zone buy xauusd 4648 - 4645" terurai uraiPola sebagai entry
         4648 -- angka itu memang ada di situ, tapi ia UJUNG sebuah zona,
         bukan harga masuk tunggal. Melaporkannya sendirian membuang
         ujung satunya dan mempersempit zona jadi satu titik yang tidak
         pernah dimaksudkan admin. */
      const zona = potonganRentang(t, utuh.pasangan);
      d = {
        id: 'sig-' + pesanId,
        pasangan: utuh.pasangan, arah: utuh.arah,
        entry: zona ? null : utuh.entry, rentang: zona, sl: utuh.sl, tp: utuh.tp.slice(),
        pasanganDitebak: false,
        /* Diambil dari KATA di pesannya, bukan dari jenis yang disimpulkan.
           ──────────────────────────────────────────────────────────────
           `utuh.jenis` berbunyi 'pantau' juga ketika sinyalnya sekadar
           BELUM lengkap -- "BUY XAUUSD 4640" tanpa SL/TP. Menyalinnya ke
           `tunggu` mengunci draf itu selamanya, dan SL/TP yang datang
           semenit kemudian tidak pernah bisa menaikkannya jadi sinyal.

           Akibatnya penyaring terbesar di jalur ini menyaring hal yang
           salah: justru sinyal yang menyebut harganya sendiri yang tidak
           pernah jadi kartu, sementara yang lolos adalah yang entry-nya
           terpaksa dikarang sistem dari harga pasar. Itu bukan sekadar
           kehilangan sinyal, itu bias yang membuat pengukurannya tidak
           berarti. */
        tunggu: adaKata(t, KATA_TUNGGU),
        terakhir: waktu, potongan: 1,
      };
      this.draf.set(kunci, d);
      return this.keluar(d);
    }

    let berubah = false;
    /* Dicatat SEBELUM draf diutak-atik: kalau pesan ini yang membuka
       drafnya, ia potongan pertama — bukan potongan kedua. */
    const drafSudahAda = !!d;
    let drafBaru = false;

    /* 1. Arah (+ pasangan kalau disebut) → BUKA draf baru.
          Reentry dihitung sebagai arah juga: ia membuka posisi baru,
          cuma arah dan pasangannya diwarisi dari yang sedang berjalan. */
    let arah = potonganArah(t);
    if (!arah && d && adaKata(t, KATA_REENTRY)) {
      arah = { arah: d.arah, pasangan: d.pasanganDitebak ? '' : d.pasangan };
    }
    if (arah) {
      /* Draf baru, bukan menimpa yang lama: "buy now xauusd" adalah awal
         sebuah sinyal, dan menempelkannya ke draf sebelumnya akan membuat
         SL sinyal lama menempel ke arah sinyal baru. */
      d = {
        id: 'sig-' + pesanId,
        pasangan: arah.pasangan || BAWAAN,
        arah: arah.arah,
        entry: null, rentang: null, sl: null, tp: [],
        pasanganDitebak: !arah.pasangan,
        tunggu: adaKata(t, KATA_TUNGGU),
        terakhir: waktu, potongan: 1,
      };
      this.draf.set(kunci, d);
      berubah = true;
      /* Draf ini BARU, walaupun ada draf lain yang masih hidup sedetik lalu.
         Tanpa baris ini ia lahir langsung sebagai "potongan 2", dan angka
         itu terbaca sebagai dua pesan yang menyumbang padahal cuma satu. */
      drafBaru = true;
    }

    if (!d) return null;   // angka tanpa draf terbuka: tidak ada yang bisa disusun

    /* 2. Angka susulan. */
    const ang = potonganAngka(t, d.pasangan);
    if (ang.sl !== null && d.sl === null) { d.sl = ang.sl; berubah = true; }
    for (const x of ang.tp) if (!d.tp.includes(x)) { d.tp.push(x); berubah = true; }

    /* 3. Rentang harga masuk. */
    const rentang = potonganRentang(t, d.pasangan);
    if (rentang && !d.rentang) { d.rentang = rentang; berubah = true; }

    /* 4. Kata tunggu hanya berlaku SEBELUM sinyalnya bisa dipakai.
          ──────────────────────────────────────────────────────────────
          Arahnya satu jalan: ia boleh menahan sinyal yang belum lengkap,
          tapi tidak boleh menurunkan yang sudah lengkap. Sebabnya terlihat
          di percakapan sungguhan — SL/TP keluar 09:14, lalu 09:17 admin
          menulis "Yok pantau guyss". Itu ajakan MENGAWASI posisi yang
          sudah dibuka, bukan pembatalan; menurunkannya kembali jadi
          "pantau" akan menulis "jangan masuk dulu" untuk posisi yang tiga
          menit lalu disuruh dibuka.

          Menaikkan status juga tetap terlarang. Yang satu salah label,
          yang lain salah membuka posisi. */
    const sudahBisaDipakai = d.sl !== null || d.tp.length > 0 || d.rentang !== null;
    if (!sudahBisaDipakai && adaKata(t, KATA_TUNGGU) && !d.tunggu) { d.tunggu = true; berubah = true; }

    /* 5. Kabar penutup MENGUNCI draf: sesudah "TP sampai tujuan", angka
          apa pun yang datang berikutnya milik sinyal lain. */
    if (adaKata(t, KATA_SELESAI)) { this.draf.delete(kunci); return null; }

    if (!berubah) return null;
    d.terakhir = waktu;
    if (drafSudahAda && !drafBaru) d.potongan += 1;
    return this.keluar(d);
  }

  keluar(d) {
    const bisaDipakai = d.sl !== null || d.tp.length > 0 || d.rentang !== null;
    return {
      id: d.id,
      pasangan: d.pasangan,
      arah: d.arah,
      entry: d.entry,
      rentang: d.rentang,
      sl: d.sl,
      tp: d.tp.slice(),
      pasanganDitebak: d.pasanganDitebak,
      /* 'sinyal' butuh DUA hal: ada yang bisa dieksekusi, dan tidak ada
         kata menunggu. Ragu selalu jatuh ke 'pantau' — lonceng yang salah
         bilang "pantau" cuma membuat orang membuka pesannya; yang salah
         bilang "sinyal" membuat orang membuka posisi. */
      jenis: bisaDipakai && !d.tunggu ? 'sinyal' : 'pantau',
      potongan: d.potongan,
      lengkap: d.sl !== null && d.tp.length > 0,
    };
  }
}

module.exports = { Perangkai, potonganAngka, potonganRentang, potonganArah, JENDELA_MS };
