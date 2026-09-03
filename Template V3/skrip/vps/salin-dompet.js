/* ══════════════════════════════════════════════════════════════════════════
   salin-dompet.js — menyalin SELURUH gerakan sebuah dompet
   ══════════════════════════════════════════════════════════════════════════
   Satu setelan untuk satu dompet: bursa tujuan, ukuran order, leverage.
   Sesudah itu apa pun yang dompet itu BUKA diikuti, dan apa pun yang ia
   TUTUP ikut ditutup.

   ── KENAPA PER DOMPET, BUKAN PER KOIN ──────────────────────────────────
   Versi sebelumnya menuntut penandaan koin satu per satu. Itu salah, dan
   salahnya bukan soal jumlah klik: yang ditiru orang saat menyalin dompet
   adalah KEPUTUSANNYA, dan keputusan itu termasuk memilih koin mana yang
   dimasuki. Menandai koin lebih dulu berarti kita sudah menyaring
   keputusannya sebelum ia mengambilnya — dan yang tersalin bukan lagi
   dompet itu, melainkan tebakan kita tentang koin apa yang akan ia sentuh.

   Akibat praktisnya juga jelas: koin yang tidak pernah kita tandai tidak
   akan pernah tersalin, betapa pun bagusnya. Justru masuk ke koin yang
   tidak kita pikirkan sendiri adalah alasan orang menyalin dompet.

   ── APA YANG MENJADI PEMICU ────────────────────────────────────────────
   PERUBAHAN daftar koin yang dipegang dompet itu, bukan keadaannya:

       pegang kemarin: BTC, SOL
       pegang sekarang: BTC, HYPE
       -> HYPE baru dibuka  (salin buka)
       -> SOL sudah dilepas (salin tutup)

   `pegang` yang belum pernah terisi (`undefined`) TIDAK memicu apa pun —
   pindaian pertama sesudah setelannya disimpan hanya MENCATAT. Tanpa
   aturan itu, menyalakan salinan hari ini akan langsung menyalin semua
   posisi yang sudah dibuka berhari-hari lalu di harga yang sudah jauh
   lewat, dan itu kebalikan dari menyalin.

   ── DUA PINDAIAN, DUA-DUANYA ───────────────────────────────────────────
   Buka maupun tutup menunggu koin itu terlihat sama selama dua pindaian
   berturut-turut. Satu jawaban API yang kebetulan kosong sudah cukup untuk
   memicu tutup-lalu-buka yang tidak pernah terjadi di dompet aslinya, dan
   dua order sungguhan lahir dari satu gangguan jaringan. Harganya ~1 menit
   keterlambatan; yang dibeli dengan harga itu adalah tidak adanya order
   hantu.

   ── APA YANG DICATAT, DAN KENAPA ───────────────────────────────────────
   Mesin ini dulu cuma menyimpan "aku sedang pegang koin X di bursa Y".
   Itu cukup untuk MENJALANKAN salinan, tapi tidak cukup untuk MEMPERCAYAI
   -nya: dari layar, posisi yang untung 40% dan posisi yang tinggal
   sejengkal dari likuidasi terlihat persis sama, dan tidak ada satu pun
   angka yang bisa dipakai memutuskan apakah dompet ini layak terus
   disalin.

   Jadi sekarang ada tiga lapis catatan:

     · punyaku[koin].hidup — potret posisi kita di bursa, disegarkan tiap
       putaran: margin terpakai, PnL berjalan, harga masuk, harga pasar,
       harga likuidasi. Nilainya DARI BURSA, bukan hitungan kita sendiri.

     · riwayat — tiap posisi salinan yang sudah TUTUP beserta hasilnya.
       Dari sinilah winrate lahir. Disimpan di berkas, bukan dihitung dari
       bursa: riwayat bursa bercampur dengan order tangan, dan yang mau
       dinilai orang di sini adalah salinannya saja.

     · log — apa yang mesin ini KERJAKAN dan apa yang ia TOLAK kerjakan,
       berikut alasannya. Yang paling sering ditanyakan bukan "kenapa ia
       membuka", melainkan "kenapa ia TIDAK membuka" — dan pertanyaan itu
       tidak bisa dijawab kalau yang tercatat cuma keberhasilan.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const BERKAS = 'wallet-salin.json';

/* MATI kecuali dinyalakan — sengaja tidak simetris dengan sakelar lain.
   Sesuatu yang bisa memasukkan uang ke posisi baru tidak boleh menyala
   hanya karena tidak ada yang menuliskan angka nol di berkas env. */
const AKTIF = process.env.SALIN_DOMPET === '1';
const KONFIRMASI = Math.max(2, Number(process.env.SALIN_KONFIRMASI || 2));
const MAKS_POSISI = Math.max(1, Number(process.env.SALIN_MAKS_POSISI || 3));

/* Batas ingatan. Log dan riwayat tumbuh selamanya kalau tidak dipangkas,
   dan berkas yang dibaca-tulis tiap putaran tidak boleh jadi megabyte.
   Yang dipangkas selalu yang TERTUA — layar cuma pernah menanyakan yang
   terakhir terjadi. */
const MAKS_LOG = 200;
const MAKS_RIWAYAT = 300;

/* ══ BERKAS ══════════════════════════════════════════════════════════════
   Tiga daftar dalam satu berkas, dan pembacanya harus memulangkan
   ketiganya walau yang lama cuma punya satu. Berkas yang sudah ada di VPS
   hanya berisi `salin`; `log` dan `riwayat` lahir kosong dan terisi sendiri
   sejak putaran berikutnya — tidak ada migrasi yang perlu dijalankan. */
function bacaBerkas(dir) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, BERKAS), 'utf8'));
    return {
      salin: Array.isArray(d.salin) ? d.salin : [],
      log: Array.isArray(d.log) ? d.log : [],
      riwayat: Array.isArray(d.riwayat) ? d.riwayat : [],
    };
  } catch { return { salin: [], log: [], riwayat: [] }; }
}

/** Dipertahankan apa adanya untuk pemanggil yang cuma butuh setelannya. */
function baca(dir) { return bacaBerkas(dir).salin; }

function tulis(dir, isi) {
  const f = path.join(dir, BERKAS);
  /* Pemanggil lama mengoper ARRAY setelan, bukan objek berisi tiga daftar.
     Diterima keduanya: memutus pemanggil demi kerapian bentuk argumen
     adalah harga yang tidak perlu dibayar. */
  const d = Array.isArray(isi) ? { salin: isi, log: [], riwayat: [] } : isi;
  try {
    /* Ditulis ke berkas sementara lalu di-rename: rename itu atomik, jadi
       pembaca tidak pernah melihat berkas setengah tertulis. */
    fs.writeFileSync(f + '.tmp', JSON.stringify({
      salin: d.salin || [],
      log: (d.log || []).slice(-MAKS_LOG),
      riwayat: (d.riwayat || []).slice(-MAKS_RIWAYAT),
    }, null, 2));
    fs.renameSync(f + '.tmp', f);
  } catch { /* gagal menulis penanda bukan alasan menjatuhkan pemantau */ }
}

/** Koin apa saja yang dipegang sebuah dompet SEKARANG, beserta arahnya. */
function koinDompet(posisiDompet, alamat) {
  const peta = new Map();
  for (const p of posisiDompet) {
    if (p.alamat !== alamat) continue;
    peta.set(String(p.koin).toUpperCase(), p);
  }
  return peta;
}

/** Angka yang PASTI angka. Bursa memulangkan string, kadang null, kadang
 *  "NaN" — dan satu NaN yang lolos ke berkas membuat seluruh baris di layar
 *  jadi tanda hubung tanpa penjelasan. */
function ang(x) { const n = Number(x); return Number.isFinite(n) ? n : 0; }

/** Mencocokkan satu posisi salinan dengan potret posisi kita di bursa.
 *
 *  Dicocokkan menurut BURSA + SIMBOL, bukan koin saja: koin yang sama bisa
 *  terbuka di Binance dan Hyperliquid sekaligus (setelan 'dua'), dan
 *  memilih yang pertama ketemu berarti menempelkan angka Hyperliquid ke
 *  posisi Binance — dua posisi berbeda dilaporkan sebagai satu. */
function cocokkan(potret, punya, koin) {
  if (!Array.isArray(potret)) return null;
  const simbol = String(punya.simbol || '').toUpperCase();
  const bursa = String(punya.bursa || '').toLowerCase();
  return potret.find((p) =>
    String(p.bursa).toLowerCase() === bursa
    && (String(p.simbol).toUpperCase() === simbol
        || String(p.koin).toUpperCase() === String(koin).toUpperCase())) || null;
}

/**
 * Menjalankan satu putaran salinan.
 *
 * Seluruh ketergantungannya disuntikkan, bukan di-require di sini — supaya
 * berkas ini bisa diuji tanpa jaringan, dan supaya jelas apa saja yang
 * benar-benar ia sentuh.
 *
 * `bursa.posisiku()` boleh tidak ada. Kalau tidak ada — atau kalau ia
 * gagal — mesinnya tetap membuka dan menutup seperti biasa; yang hilang
 * cuma angka pemantauannya. Salinan yang berhenti bekerja karena panel
 * pemantauan tidak bisa diisi adalah pertukaran yang salah arah.
 */
async function putaran({ dir, posisiDompet, catat, lonceng, bursa }) {
  if (!AKTIF) return;
  const berkas = bacaBerkas(dir);
  const salin = berkas.salin;
  const hidup = salin.filter((s) => s.aktif === true && Number(s.usd) > 0);
  if (!hidup.length) return;

  let berubah = false;

  /* Satu catatan masuk ke DUA tempat: log pm2 seperti dulu (untuk yang
     sedang menonton `pm2 logs`), dan daftar di berkas (untuk layar, yang
     dibuka jauh sesudah kejadiannya). Menuliskannya dua kali di tiap
     pemanggil adalah cara paling pasti untuk lupa salah satunya. */
  function jejak(jenis, alamat, koin, pesan) {
    berkas.log.push({ waktu: Date.now(), jenis, alamat, koin: koin || '', pesan });
    if (berkas.log.length > MAKS_LOG) berkas.log = berkas.log.slice(-MAKS_LOG);
    berubah = true;
    catat('  ' + pesan);
  }

  /* Potret posisi KITA, diambil SEKALI untuk seluruh putaran. Sekali per
     dompet berarti tiga panggilan bursa untuk tiga setelan yang menanyakan
     hal yang persis sama. */
  let potret = null;
  if (typeof bursa.posisiku === 'function') {
    try { potret = await bursa.posisiku(); }
    catch (e) { catat('  salin: potret posisi gagal — ' + ((e && e.message) || '?')); }
  }

  for (const s of hidup) {
    const sekarang = koinDompet(posisiDompet, s.alamat);
    const namaKoin = [...sekarang.keys()];
    const tadi = Array.isArray(s.pegang) ? s.pegang : null;

    /* Pindaian pertama: catat, jangan bertindak. Lihat catatan di kepala. */
    if (tadi === null) {
      s.pegang = namaKoin; berubah = true;
      jejak('catat', s.alamat, '', 'salin ' + ringkas(s.alamat) + ': pindaian pertama, mencatat ' + namaKoin.length + ' koin');
      continue;
    }

    const baru = namaKoin.filter((k) => !tadi.includes(k));
    const hilang = tadi.filter((k) => !namaKoin.includes(k));

    s.konfirmasiBuka = s.konfirmasiBuka || {};
    s.konfirmasiTutup = s.konfirmasiTutup || {};
    s.punyaku = s.punyaku || {};

    /* ── SEGARKAN ANGKA POSISI YANG SEDANG TERBUKA ───────────────────
       Dilakukan SEBELUM buka/tutup, bukan sesudah: kalau sesudah, posisi
       yang baru saja ditutup ikut dicari di potret dan tidak ketemu — lalu
       angka terakhirnya terhapus tepat pada saat ia paling dibutuhkan,
       yaitu untuk menghitung hasilnya. */
    if (potret) {
      for (const [k, punya] of Object.entries(s.punyaku)) {
        const p = cocokkan(potret, punya, k);
        if (!p) {
          /* Tidak ketemu di bursa. TIDAK dihapus dari punyaku di sini —
             yang berhak menghapus cuma jalur tutup di bawah. Posisi yang
             lenyap karena likuidasi atau ditutup tangan akan terbaca
             sebagai "hilang" di putaran berikutnya lewat jalur itu, dengan
             angka terakhir yang masih utuh sebagai bahan hitungannya. */
          if (punya.hidup) { punya.hidup.terbaca = false; berubah = true; }
          continue;
        }
        const h = {
          terbaca: true,
          qty: ang(p.qty),
          entry: ang(p.entry),
          harga: ang(p.mark),
          nilai: ang(p.notional),
          margin: ang(p.margin),
          pnl: ang(p.upnl),
          likuidasi: ang(p.likuidasi),
          leverage: ang(p.leverage) || ang(punya.leverage) || 1,
          waktu: Date.now(),
        };
        /* Persentase dihitung terhadap MARGIN, bukan nilai posisi: yang
           dipertaruhkan orangnya adalah marginnya, dan +8% terhadap nilai
           posisi di leverage 10x sebenarnya +80% terhadap uangnya. Angka
           yang sama bisa berarti dua hal yang jauh berbeda, jadi yang
           ditampilkan harus yang menjawab "uangku bertambah berapa persen". */
        const dasar = h.margin > 0 ? h.margin : (ang(punya.usd) || 0);
        h.roe = dasar > 0 ? (h.pnl / dasar) * 100 : 0;
        punya.hidup = h;
        berubah = true;
      }
    }

    /* ── BUKA ────────────────────────────────────────────────────────── */
    for (const k of baru) {
      s.konfirmasiBuka[k] = (s.konfirmasiBuka[k] || 0) + 1; berubah = true;
      if (s.konfirmasiBuka[k] < KONFIRMASI) {
        jejak('konfirmasi', s.alamat, k, 'salin ' + k + ': konfirmasi buka ' + s.konfirmasiBuka[k] + '/' + KONFIRMASI);
        continue;
      }
      if (s.punyaku[k]) { delete s.konfirmasiBuka[k]; continue; }

      /* ══ SATU KOIN, SATU POSISI ══════════════════════════════════════
         Diminta pemilik 3 Sep 2026 sesudah ia menyalin beberapa dompet
         sekaligus: "takut nanti ada double posisi, mending dibatalkan saja
         oleh sistem."

         Ketakutan itu berdasar, dan penjaga di atas TIDAK menutupinya —
         `s.punyaku` cuma tahu isi dompet INI. Dua dompet yang kebetulan
         sama-sama memegang ETH menghasilkan dua kali `bursa.buka`, dan di
         bursa keduanya MENYATU jadi satu posisi berukuran dua kali lipat.

         Yang membuatnya berbahaya bukan ukurannya, melainkan pembukuannya:
         `punyaku` mencatat dua posisi $30 sementara yang ada satu posisi
         $60. Begitu salah satu dompet menutup ETH, mesin menutup "bagiannya"
         — dan angka yang tersisa di layar tidak lagi cocok dengan yang ada
         di bursa. Kesalahan pembukuan uang tidak pernah berhenti di
         pembukuan.

         ── DUA PEMERIKSAAN, DAN KEDUANYA PERLU ─────────────────────────
         1. Catatan sendiri (`punyaku` seluruh dompet). Selalu bisa dibaca,
            tidak bergantung jaringan.
         2. Potret posisi di bursa. Menangkap yang TIDAK ada di catatan kita
            — posisi yang dibuka pemilik dengan tangan dari Chart & Entry.
            Menyalin di atasnya akan membesarkan posisi manualnya diam-diam,
            dan itu justru kejutan yang paling sulit ditelusuri.

         Yang kedua dilewati kalau potretnya gagal diambil; yang pertama
         tetap jalan. Penjaga yang mati bersama jaringan bukan penjaga.

         Ditahan, BUKAN dibatalkan lalu dicoba lagi: hitungan konfirmasinya
         sengaja tidak dihapus, jadi begitu koinnya bebas ia langsung layak
         disalin tanpa menunggu dua pindaian dari nol. */
      const dompetLain = hidup.find(
        (x) => x !== s && x.punyaku && x.punyaku[k]);
      if (dompetLain) {
        jejak('tahan', s.alamat, k, 'salin ' + k + ': ditahan, koin ini sudah disalin dari '
              + (dompetLain.nama || ringkas(dompetLain.alamat)) + ' — satu koin satu posisi');
        continue;
      }
      if (potret && potret.some((p) => String(p.koin).toUpperCase() === String(k).toUpperCase())) {
        jejak('tahan', s.alamat, k, 'salin ' + k + ': ditahan, posisi ' + k
              + ' sudah terbuka di akun (kemungkinan dibuka manual) — satu koin satu posisi');
        continue;
      }

      if (Object.keys(s.punyaku).length >= MAKS_POSISI) {
        jejak('tahan', s.alamat, k, 'salin ' + k + ': ditahan, sudah ' + Object.keys(s.punyaku).length + ' posisi salinan');
        continue;
      }

      const sumber = sekarang.get(k);
      const arah = sumber.arah === 'SHORT' ? 'SELL' : 'BUY';
      try {
        const h = await bursa.buka({
          koin: k, arah, usd: Number(s.usd),
          leverage: Math.max(1, Number(s.leverage) || 1),
          bursa: s.bursa || 'binance',
        });
        delete s.konfirmasiBuka[k];
        /* Setelan DIPOTRET ke dalam posisinya, bukan dibaca dari `s` saat
           ditampilkan. Ukuran dan leverage boleh diubah orangnya kapan
           saja, dan posisi yang dibuka dengan $30 tidak berubah jadi
           posisi $50 hanya karena setelannya dinaikkan sesudahnya. */
        s.punyaku[k] = {
          bursa: h.bursa, simbol: h.simbol, arah, waktu: Date.now(),
          usd: Number(s.usd), leverage: Math.max(1, Number(s.leverage) || 1),
          arahSumber: sumber.arah,
        };
        berubah = true;
        jejak('buka', s.alamat, k, 'SALIN BUKA ' + arah + ' ' + h.simbol + ' di ' + h.bursa
              + ' — $' + s.usd + ' ' + (s.leverage || 1) + 'x, meniru ' + (s.nama || ringkas(s.alamat)));
        await lonceng({
          id: 'salin-buka-' + s.alamat.slice(0, 8) + '-' + k + '-' + Date.now(),
          judul: 'Salin ' + (s.nama || ringkas(s.alamat)) + ': ' + arah + ' ' + k,
          detail: 'Dompet itu membuka ' + sumber.arah + ' ' + k + '. Disalin di ' + h.bursa
                + ' sebesar ' + s.usd + ' USD, ' + (s.leverage || 1) + 'x.',
        });
      } catch (e) {
        const pesan = (e && e.message) || 'tidak diketahui';
        jejak('gagal', s.alamat, k, 'salin buka GAGAL ' + k + ': ' + pesan);
        /* Konfirmasi TIDAK direset di sini. Kegagalan sesaat -- bursa sibuk,
           jaringan putus -- tidak boleh membuat koin ini mengulang hitungan
           dari nol dan tertunda dua pindaian lagi. Yang gagal permanen
           (koinnya memang tidak ada) akan gagal lagi dan terlihat di log. */
        await lonceng({
          id: 'salin-gagal-' + s.alamat.slice(0, 8) + '-' + k + '-' + Date.now(),
          judul: 'Salin gagal: ' + k,
          detail: pesan,
        });
      }
    }

    /* ── TUTUP ───────────────────────────────────────────────────────── */
    for (const k of hilang) {
      s.konfirmasiTutup[k] = (s.konfirmasiTutup[k] || 0) + 1; berubah = true;
      if (s.konfirmasiTutup[k] < KONFIRMASI) {
        jejak('konfirmasi', s.alamat, k, 'salin ' + k + ': konfirmasi tutup ' + s.konfirmasiTutup[k] + '/' + KONFIRMASI);
        continue;
      }
      const punya = s.punyaku[k];
      if (!punya) { delete s.konfirmasiTutup[k]; continue; }
      /* ── HASILNYA DIPOTRET SEBELUM ORDER TUTUP BERANGKAT ───────────
         Sesudah tertutup, posisinya tidak ada lagi di bursa dan tidak ada
         satu pun angka yang bisa ditanyakan tentangnya. Yang dipakai
         adalah PnL berjalan dari potret di awal putaran ini — beberapa
         detik sebelum ordernya berangkat.

         Bukan angka fill yang sesungguhnya, dan tidak berpura-pura
         demikian: selisihnya sebesar gerak harga selama beberapa detik
         plus slippage. Untuk menilai "dompet ini menguntungkan atau tidak"
         itu lebih dari cukup, dan menariknya dari riwayat fill bursa
         berarti mencampurnya dengan order tangan yang bukan salinan. */
      const potretAkhir = punya.hidup && punya.hidup.terbaca ? punya.hidup : null;
      try {
        await bursa.tutup({ koin: k, simbol: punya.simbol, bursa: punya.bursa, arah: punya.arah });
        delete s.konfirmasiTutup[k];
        delete s.punyaku[k];
        berubah = true;
        const pnl = potretAkhir ? ang(potretAkhir.pnl) : null;
        berkas.riwayat.push({
          waktu: Date.now(), dibuka: ang(punya.waktu),
          alamat: s.alamat, nama: s.nama || '', koin: k,
          simbol: punya.simbol, bursa: punya.bursa, arah: punya.arah,
          usd: ang(punya.usd), leverage: ang(punya.leverage) || 1,
          entry: potretAkhir ? ang(potretAkhir.entry) : 0,
          keluar: potretAkhir ? ang(potretAkhir.harga) : 0,
          /* null, BUKAN nol, kalau angkanya tidak pernah terbaca. Nol
             berarti impas — pernyataan yang berbeda dari "tidak tahu", dan
             winrate yang menghitung "tidak tahu" sebagai impas berbohong
             ke arah yang tidak bisa dikoreksi belakangan. */
          pnl, roe: potretAkhir ? ang(potretAkhir.roe) : null,
        });
        if (berkas.riwayat.length > MAKS_RIWAYAT) berkas.riwayat = berkas.riwayat.slice(-MAKS_RIWAYAT);
        jejak('tutup', s.alamat, k, 'SALIN TUTUP ' + punya.simbol + ' di ' + punya.bursa
              + (pnl === null ? ' — hasil tidak terbaca' : ' — PnL ' + (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + ' USD'));
        await lonceng({
          id: 'salin-tutup-' + s.alamat.slice(0, 8) + '-' + k + '-' + Date.now(),
          judul: 'Salin ' + (s.nama || ringkas(s.alamat)) + ': tutup ' + k,
          detail: 'Dompet itu sudah tidak memegang ' + k + '. Posisi salinannya ikut ditutup.'
                + (pnl === null ? '' : ' Hasil ' + (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + ' USD.'),
        });
      } catch (e) {
        jejak('gagal', s.alamat, k, 'salin tutup GAGAL ' + k + ': ' + ((e && e.message) || '?'));
      }
    }

    /* Koin yang sempat masuk daftar konfirmasi lalu kembali normal
       dibersihkan, supaya hitungannya tidak menua diam-diam. */
    for (const k of Object.keys(s.konfirmasiBuka)) if (!baru.includes(k)) delete s.konfirmasiBuka[k];
    for (const k of Object.keys(s.konfirmasiTutup)) if (!hilang.includes(k)) delete s.konfirmasiTutup[k];

    /* -- `pegang` HANYA MENYERAP PERUBAHAN YANG SUDAH SELESAI ----------
       Ini pernah salah dan gejalanya sunyi total: dulu `pegang` langsung
       disamakan dengan keadaan sekarang tiap putaran. Akibatnya koin yang
       baru muncul dan masih menunggu konfirmasi 1/2 sudah tercatat sebagai
       "dipegang" -- jadi pindaian berikutnya ia tidak lagi terhitung BARU,
       hitungannya dihapus pembersih di atas, dan konfirmasinya tidak pernah
       sampai dua. Salinannya diam selamanya tanpa satu galat pun.

       Sekarang koin yang sedang ditunggu DIBIARKAN di keadaan lamanya:
       yang menunggu buka tetap di luar `pegang` (jadi tetap terbaca baru),
       yang menunggu tutup tetap di dalam (jadi tetap terbaca hilang).
       Keduanya baru berpindah sesudah ordernya benar-benar berangkat. */
    const tertunda = new Set([
      ...Object.keys(s.konfirmasiBuka), ...Object.keys(s.konfirmasiTutup),
    ]);
    const pegangBaru = new Set(tadi);
    for (const k of namaKoin) if (!tertunda.has(k)) pegangBaru.add(k);
    for (const k of tadi) if (!namaKoin.includes(k) && !tertunda.has(k)) pegangBaru.delete(k);
    const daftar = [...pegangBaru];
    if (JSON.stringify(s.pegang) !== JSON.stringify(daftar)) {
      s.pegang = daftar; berubah = true;
    }
  }

  if (berubah) tulis(dir, berkas);
}

function ringkas(a) { return String(a || '').slice(0, 8) + '…'; }

module.exports = {
  baca, bacaBerkas, tulis, putaran,
  AKTIF, KONFIRMASI, MAKS_POSISI, BERKAS, MAKS_LOG, MAKS_RIWAYAT,
};
