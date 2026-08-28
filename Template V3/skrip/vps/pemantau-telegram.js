#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   pemantau-telegram.js — telinga 24 jam untuk grup sinyal
   ══════════════════════════════════════════════════════════════════════════
   URUTAN KERJANYA YANG PALING PENTING, bukan kepintarannya:

       1. SIMPAN pesan mentahnya          <- tidak boleh gagal
       2. BUNYIKAN lonceng                <- tidak boleh gagal
       3. baru urai jadi angka            <- boleh gagal

   Permintaannya jelas: jangan sampai ada sinyal yang terlewat. Itu syarat
   tentang KABAR, bukan tentang angka. Pengurai yang bagus itu kenyamanan;
   pemberitahuan yang sampai itu keharusan. Kalau urutannya dibalik --
   urai dulu, kabari kalau berhasil -- maka setiap format baru yang belum
   dikenali menjadi sinyal yang hilang tanpa jejak, dan hilangnya tidak
   terlihat sebagai galat melainkan sebagai grup yang sedang sepi.

   Karena itu langkah 3 dibungkus try/catch yang menelan segalanya, dan
   langkah 1-2 berjalan lebih dulu tanpa syarat.

   ── HANYA MENDENGAR ──────────────────────────────────────────────────────
   Tidak ada satu baris pun di sini yang mengirim pesan, bergabung ke grup,
   atau menyentuh broker. Akun Telegram yang dipakai adalah akun pribadi
   pemilik, dan akun pribadi yang bertingkah seperti bot adalah cara
   tercepat mendapat pembatasan. Ia membaca ruang yang memang sudah
   diikutinya, persis seperti pemiliknya membaca dari HP.

   ── SARINGAN ─────────────────────────────────────────────────────────────
   Grupnya berbentuk forum: ada topik OUTLOOK, NEWS, Edukasi, Live Trade,
   dan Signal. Tanpa saringan topik, lonceng berbunyi untuk setiap materi
   edukasi -- dan lonceng yang terlalu sering berbunyi adalah lonceng yang
   dimatikan orang. Ditambah saringan pengirim: hanya admin. Anggota lain
   menulis "ENJOY PROFITTT" dan itu bukan kabar yang perlu dibangunkan.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { TelegramClient, Api } = require('teleproto');
const { StringSession } = require('teleproto/sessions');
const { Perangkai } = require('./rangkai');
const { kirimKartu, layakKartu, daftarHadir, NAMA_AGEN } = require('./kartu-agen');
const mata = require('./mata-chart');

/* TIDAK ADA MODEL BAHASA DI JALUR INI, dan itu disengaja.
   ──────────────────────────────────────────────────────────────────────
   Penyusun sinyalnya murni pola: nol token saat menganggur, nol token saat
   ada pesan. Pemantaunya sendiri juga tidak memindai apa pun secara
   berkala -- ia memegang satu sambungan ke Telegram dan MENUNGGU didorong.
   Selama ruang itu sepi, proses ini tidak melakukan apa-apa selain hidup.

   Versi pertama mengimpor otak.js sebagai cadangan penguarai. Dicabut
   begitu penyusunnya lulus semua format sungguhan: cadangan yang tidak
   pernah dipanggil cuma menyisakan kesan bahwa ada ongkos yang berjalan
   diam-diam. Kalau suatu saat ada format yang benar-benar tidak
   terpolakan, ia dipasang lagi DENGAN pagar -- hanya untuk pesan yang
   mengandung angka, dan hanya sesudah pola gagal. */

const API_ID = Number(process.env.TELEGRAM_API_ID || 0);
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESI = process.env.TELEGRAM_SESI || '';
/* ── SATU PROSES, BANYAK RUANG ─────────────────────────────────────────
   Satu sesi Telegram, satu sambungan. Dua proses yang memakai StringSession
   yang SAMA saling menendang di sisi Telegram (kunci auth ganda), dan
   gejalanya bukan galat melainkan pemantau yang kadang tuli — persis
   kerusakan yang paling sulit dilacak. Jadi ruang kedua dan seterusnya
   ditumpangkan di proses yang sama, bukan dijalankan sendiri.

   Berlapis dari .env dengan awalan bernomor:

       TG_GRUP=...       ruang pertama (yang sudah ada, artinya tidak berubah)
       TG2_GRUP=...      ruang kedua
       TG3_GRUP=...      dan seterusnya

   Tiap ruang punya nama agennya sendiri, karena tiap ruang punya KARTUNYA
   sendiri di papan — dan statistik dua sumber yang dicampur ke satu kartu
   tidak berarti apa-apa bagi siapa pun.

   Awalan tanpa TG*_GRUP dilewati diam-diam: itu keadaan normal (belum
   dipakai), bukan salah setelan. */
const AWALAN = ['TG', 'TG2', 'TG3', 'TG4'];

function bacaRuang() {
  const keluar = [];
  for (const a of AWALAN) {
    const g = String(process.env[a + '_GRUP'] || '').trim();
    if (!g) continue;
    keluar.push({
      awalan: a,
      grup: g,
      /* Nama topik, bukan nomornya. Nomor topik tidak terlihat di mana pun
         yang wajar dan berubah kalau topiknya dibuat ulang; namanya
         terbaca langsung di layar. Dicocokkan longgar supaya "Signal VIP
         ASF 🇮🇩" tetap kena. */
      topik: String(process.env[a + '_TOPIK'] || 'signal').trim().toLowerCase(),
      /* Nomor topik yang DIPASTIKAN pemilik, mengalahkan pencarian
         berdasarkan nama. Ada karena pencarian itu bergantung pada satu
         panggilan API yang ternyata pindah tempat antar versi pustaka --
         dan waktu ia gagal, saringannya mati diam-diam lalu SELURUH topik
         ikut terpantau. Nilai yang ditulis tangan tidak bisa gagal begitu.
         Di teleproto 1.228.5 panggilan itu MEMANG pecah ("Cannot cast
         undefined"), jadi nomor tangan bukan kehati-hatian melainkan
         satu-satunya jalan yang bekerja. */
      topikId: Number(process.env[a + '_TOPIK_ID'] || 0) || null,
      hanyaAdmin: process.env[a + '_HANYA_ADMIN'] !== '0',
      agen: String(process.env[a + '_AGEN_NAMA'] || NAMA_AGEN).trim(),
      /* Ruang yang isinya tangkapan layar chart, bukan teks. Menyalakan ini
         berarti tiap gambar dibaca model penglihatan — berbiaya, jadi
         bawaannya MATI dan hanya dinyalakan untuk ruang yang memang
         memerlukannya. */
      gambar: process.env[a + '_GAMBAR'] === '1',
      keKartu: (process.env[a + '_KE_KARTU'] || process.env.TG_KE_KARTU || '1') !== '0',
      strategi: String(process.env[a + '_STRATEGI'] || '').trim(),
    });
  }
  return keluar;
}
const DASAR = 'http://127.0.0.1:' + (process.env.PORT || 4000);
const APP_TOKEN = process.env.APP_TOKEN || '';

/* Sinyal yang terbaca ikut diposting ke kartu agen di Copy Signal, jadi ia
   dinilai penggaris yang sama dengan agen-agen lain: winrate, R per trade,
   drawdown, dihitung dari lilin sungguhan. Itu satu-satunya cara mengubah
   "grupnya lumayan profitable" dari kesan jadi angka. Rinciannya di
   kartu-agen.js, dipakai bersama alat uji supaya keduanya tidak bisa
   menyimpang. */
/* TG_KE_KARTU kini dibaca per ruang di bacaRuang() sebagai nilai bawaan
   bersama; tetapan modul yang lama dibuang supaya tidak ada dua sumber
   kebenaran untuk sakelar yang sama. */

/* ── LONCENG TIDAK MENAMPILKAN ISI OBROLAN ─────────────────────────────
   Keputusan pemilik, 28 Agu 2026. Sebelumnya tiap pesan yang lolos saringan
   dikirim apa adanya ke lonceng: judulnya baris pertama pesannya, detailnya
   400 huruf pertamanya, sumbernya nama ruangnya. Hasilnya lonceng berisi
   "mantap", "😂😂", "sok wkwkwk pilihan masing2" — obrolan admin, lengkap
   dengan nama ruang asalnya dan tautan ke pesannya.

   Dua hal salah di situ sekaligus. Yang pertama kebisingan. Yang kedua
   lebih serius: /api/kabar itu PUBLIK, tanpa login — jadi isi ruang
   berbayar orang lain terbit ke internet lewat pintu belakang.

   Yang berubah:
     · isi pesannya TIDAK PERNAH dikirim; yang dikirim hasil uraian kita
       sendiri (pasangan, arah, level)
     · nama ruang diganti nama AGEN kita
     · tautan t.me dikosongkan (tetap tersimpan di arsip VPS yang privat)
     · pesan yang jelas-jelas bukan sinyal tidak membunyikan apa pun

   Ambang "jelas-jelas bukan sinyal": kurang dari dua bilangan tiga digit.
   Harga selalu tiga digit ke atas di pasangan mana pun yang dipantau, dan
   sebuah setup selalu menyebut lebih dari satu angka. "sl 85+" punya satu
   bilangan dua digit — tidak berbunyi. "SL 4603 TP 4579" punya dua
   bilangan empat digit — berbunyi. */
function mungkinSinyal(teks) {
  const angka = String(teks || '').match(/\d[\d.,]{2,}/g) || [];
  return angka.length >= 2;
}

const ARSIP = path.join(__dirname, 'sinyal-telegram.json');
const MAKS_ARSIP = 400;

function jam() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
function catat(...a) { console.log('[' + jam() + ']', ...a); }

/* ── ARSIP ─────────────────────────────────────────────────────────────── */
function arsipBaca() {
  try {
    const d = JSON.parse(fs.readFileSync(ARSIP, 'utf8'));
    return Array.isArray(d.pesan) ? d.pesan : [];
  } catch (e) { return []; }
}
function arsipTulis(daftar) {
  const semen = ARSIP + '.tmp';
  fs.writeFileSync(semen, JSON.stringify({ pesan: daftar.slice(0, MAKS_ARSIP) }, null, 2));
  fs.renameSync(semen, ARSIP);
}

/* ── SATU SALINAN DI INGATAN, BUKAN BACA-ULANG TIAP KALI ────────────────
   Versi pertama membaca berkas, menyisipkan, lalu menulisnya kembali --
   untuk SETIAP pesan, dua kali (sekali saat menyimpan, sekali lagi saat
   menempelkan hasil uraiannya). Dua pesan yang datang berdekatan sama-sama
   membaca daftar yang sama, lalu yang menulis belakangan menimpa sisipan
   yang pertama. Pesannya hilang dari arsip tanpa satu pun galat.

   Bukan teori: penanganan pesan itu async (ada await lonceng dan await
   kirimKartu di tengahnya), jadi jeda antara baca dan tulis lebar sekali.
   Di ruang sinyal, pesan berdekatan justru yang paling lazim -- "buy now"
   lalu "SL/TP" berselang beberapa detik.

   Daftarnya sekarang dipegang di ingatan sebagai satu-satunya kebenaran,
   dan berkas cuma cerminnya. Tidak ada lagi baca-ubah-tulis yang bisa
   saling menimpa. */
let arsipIngatan = null;
function arsipAmbil() {
  if (!arsipIngatan) arsipIngatan = arsipBaca();
  return arsipIngatan;
}
function arsipSimpan() {
  try { arsipTulis(arsipIngatan || []); }
  catch (e) { console.error('[' + jam() + '] arsip gagal ditulis:', e.message); }
}

/* ── LONCENG ───────────────────────────────────────────────────────────── */
async function lonceng(baris) {
  if (!APP_TOKEN) { catat('APP_TOKEN kosong — lonceng dilewati'); return; }
  try {
    const r = await fetch(DASAR + '/api/kabar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-token': APP_TOKEN },
      body: JSON.stringify(baris),
    });
    if (!r.ok) catat('lonceng ditolak', r.status);
  } catch (e) {
    catat('lonceng gagal:', e.message);
  }
}

/* ── SATU RUANG: entitas, topiknya, dan siapa adminnya ─────────────────── */
async function siapkanRuang(client, r) {
  const ruang = await client.getEntity(/^-?\d+$/.test(r.grup) ? Number(r.grup) : r.grup);
  r.ruang = ruang;
  /* Kunci pencocokan pendengar. peerId yang datang bersama pembaruan memuat
     id kanal TANPA awalan -100, jadi yang dibandingkan id mentahnya —
     membandingkan dengan TG_GRUP apa adanya tidak akan pernah cocok. */
  r.kunciRuang = String(ruang.id);
  catat('memantau:', ruang.title || ruang.username || r.grup,
    '· agen', r.agen + (r.gambar ? ' · baca gambar NYALA' : ''));

  /* ── Topik mana ────────────────────────────────────────────────────────
     Dicari sekali di awal. Kalau grupnya bukan forum, hasilnya null dan
     saringan topiknya mati sendiri — bukan galat, memang tidak semua grup
     punya topik. */
  let topikId = r.topikId;
  if (topikId) catat('  topik dipatok dari .env: id', topikId);
  try {
    if (topikId) throw new Error('sudah dipatok');
    /* Api.messages, BUKAN Api.channels. Nama yang salah tidak melempar
       "tidak dikenal" melainkan "is not a constructor" -- dan karena
       panggilan ini dibungkus try/catch yang menganggap kegagalan berarti
       "grupnya bukan forum", saringan topiknya mati tanpa terlihat sebagai
       kesalahan. Log-nya bahkan berbunyi meyakinkan.

       CATATAN 28 Agu 2026: di teleproto 1.228.5 panggilan ini pecah untuk
       KEDUA nama ("Cannot cast undefined to any kind of undefined"). Jadi
       jalur pencarian-berdasarkan-nama praktis sudah mati, dan TG*_TOPIK_ID
       bukan lagi pengaman melainkan jalan utamanya. Kodenya dibiarkan
       supaya ia hidup lagi sendiri kalau pustakanya diperbaiki. */
    const t = await client.invoke(new Api.messages.GetForumTopics({
      channel: ruang, limit: 100, offsetDate: 0, offsetId: 0, offsetTopic: 0,
    }));
    for (const x of (t.topics || [])) {
      const judul = String(x.title || '').toLowerCase();
      if (judul.includes(r.topik)) { topikId = x.id; catat('  topik:', x.title, '(id ' + x.id + ')'); break; }
    }
    if (topikId === null && (t.topics || []).length) {
      catat('  topik "' + r.topik + '" tidak ketemu. Yang ada:',
        (t.topics || []).map((x) => x.title).join(' | '));
      catat('  SEMUA topik akan dipantau — isi ' + r.awalan + '_TOPIK_ID di .env.');
    }
  } catch (e) {
    catat('  bukan grup forum, atau daftar topik tidak bisa dibaca:', e.message);
  }
  r.topikAkhir = topikId;

  /* ── Siapa adminnya ────────────────────────────────────────────────────
     Disegarkan tiap jam. Admin bisa bertambah, dan daftar yang beku berarti
     sinyal dari admin baru diperlakukan sebagai obrolan anggota lalu
     dibuang diam-diam. */
  r.admin = new Set();
  r.segarkanAdmin = async function segarkanAdmin() {
    try {
      const q = await client.invoke(new Api.channels.GetParticipants({
        channel: ruang, filter: new Api.ChannelParticipantsAdmins(),
        offset: 0, limit: 100, hash: 0,
      }));
      const baru = new Set((q.users || []).map((u) => String(u.id)));
      if (baru.size) {
        r.admin = baru;
        catat('  admin', r.agen + ':', (q.users || [])
          .map((u) => u.username ? '@' + u.username : (u.firstName || u.id)).join(', '));
      }
    } catch (e) {
      /* DAFTAR LAMA DIPERTAHANKAN, saringannya TIDAK dimatikan.
         ──────────────────────────────────────────────────────────────
         Versi pertama mengosongkan daftarnya saat gagal dibaca, dan
         karena saringannya berbunyi `admin.size && ...`, daftar kosong
         berarti saringan MATI -- setiap anggota grup mendadak dianggap
         admin. Satu FLOOD_WAIT dari Telegram (hal biasa) sudah cukup
         membuka pintunya, dan yang masuk lewat pintu itu bukan sekadar
         kebisingan: pesan anggota mana pun yang menyebut angka bisa
         menjadi kartu sinyal.

         Gagal membaca daftar bukan kabar bahwa daftarnya berubah. Yang
         lama tetap berlaku sampai ada yang benar-benar menggantikannya. */
      catat('  daftar admin gagal dibaca:', e.message,
        r.admin.size ? '- memakai daftar sebelumnya (' + r.admin.size + ' admin)'
                     : '- BELUM ada daftar admin, kartu ditahan sampai terbaca');
    }
  };
  await r.segarkanAdmin();
  setInterval(() => { void r.segarkanAdmin(); }, 60 * 60 * 1000);
}


/* ── UTAMA ─────────────────────────────────────────────────────────────── */
(async () => {
  if (!API_ID || !API_HASH || !SESI) {
    console.error('TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESI belum ada di .env.');
    console.error('Jalankan dulu:  node login-telegram.js');
    process.exit(1);
  }
  const RUANG = bacaRuang();
  if (!RUANG.length) {
    console.error('TG_GRUP belum diisi di .env (contoh: TG_GRUP=-1002804902464).');
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(SESI), API_ID, API_HASH, {
    /* Infinity, bukan 100. Angka berapa pun di sini berarti "sesudah sekian
       gagal, menyerah selamanya" -- dan menyerah selamanya tidak pernah
       benar untuk proses yang tugasnya menunggu. Satu pemadaman jaringan
       VPS atau pemeliharaan pusat data Telegram yang lewat sepuluh menit
       sudah cukup menghabiskan 100 percobaan, dan sesudah itu ia diam
       untuk selamanya tanpa keluar dari pm2 -- jadi pm2 pun tidak
       menghidupkannya lagi. */
    connectionRetries: Infinity,
    retryDelay: 5000,
    autoReconnect: true,
    deviceModel: 'Jadi Trader - Pemantau Sinyal',
    systemVersion: 'VPS',
    appVersion: '1.0',
  });

  await client.connect();
  const aku = await client.getMe();
  catat('masuk sebagai', aku.username ? '@' + aku.username : (aku.firstName || '?'));

  /* Ruang disiapkan BERURUTAN, bukan serentak. Tiap ruang memanggil
     getEntity + GetParticipants, dan Telegram membalas panggilan yang
     bertubi-tubi dengan FLOOD_WAIT — jeda paksa yang panjangnya ditentukan
     sepihak. Menunggu satu per satu di detik-detik pertama jauh lebih murah
     daripada dijeda lima menit sesudahnya. */
  for (const r of RUANG) {
    try {
      await siapkanRuang(client, r);
    } catch (e) {
      /* Satu ruang yang gagal TIDAK menjatuhkan yang lain. Grup yang
         keluar-masuk, id yang salah ketik, atau akun yang dikeluarkan dari
         satu grup adalah kejadian yang wajar — dan menjadikannya galat
         fatal berarti kehilangan seluruh pemantauan gara-gara satu ruang
         yang memang sudah tidak dipakai. */
      catat('ruang', r.grup, 'GAGAL disiapkan:', e && e.message, '— dilewati');
      r.mati = true;
    }
  }
  const hidup = RUANG.filter((r) => !r.mati);
  if (!hidup.length) {
    console.error('Tidak satu pun ruang bisa disiapkan. Berhenti.');
    process.exit(1);
  }
  /* Peta dari id kanal ke ruangnya. Pendengar Telegram menerima SELURUH
     pembaruan akun — termasuk pesan pribadi dan grup lain yang kebetulan
     diikuti pemiliknya — dan versi satu-ruang dulu mengandalkan saringan
     topik + admin untuk membuangnya. Itu bekerja secara kebetulan, bukan
     karena dirancang begitu: pesan pribadi tidak punya penanda topik, jadi
     ia LOLOS saringan topik dan cuma tertahan di saringan admin.

     Dengan banyak ruang, kebetulan itu berhenti berlaku — admin ruang A
     yang menulis di grup C mana pun akan terbaca. Sekarang ruangnya
     dicocokkan lebih dulu, dan apa pun yang tidak terdaftar berhenti di
     baris pertama. */
  const petaRuang = new Map(hidup.map((r) => [r.kunciRuang, r]));

  /* ── Pendengar ─────────────────────────────────────────────────────────── */
  const sudah = new Set(arsipAmbil().map((p) => String(p.id)));
  /* SATU perangkai PER RUANG. Ia memegang draf yang sedang menunggu
     potongan susulan, dan draf itu harus bertahan antar-pesan — membuatnya
     ulang tiap pesan sama saja dengan tidak punya perangkai sama sekali.

     Per ruang, bukan satu untuk semua: "buy now" di ruang A dan "SL 4632"
     di ruang B adalah dua sinyal berbeda, dan perangkai bersama akan
     menyambungnya jadi satu setup yang tidak pernah ada di mana pun. */
  for (const r of hidup) {
    r.rangkai = new Perangkai();
    /* SEKALI per sinyal, bukan sekali per potongan. Perangkai menerbitkan
       ulang drafnya tiap kali ia bertambah lengkap, dan memposting tiap
       terbitan akan membuat satu setup jadi tiga kartu di papan. */
    r.sudahJadiKartu = new Set();
  }

  /* ── MEMBACA ZONA DARI GAMBAR ──────────────────────────────────────
     Hanya untuk ruang yang memang isinya tangkapan layar chart. Kegagalan
     di sini SELALU dijawab null dan tidak pernah dilempar: telinga 24 jam
     tidak boleh mati gara-gara satu gambar rusak atau satu panggilan model
     yang habis waktu. */
  async function bacaGambar(r, pesan, teks) {
    if (mata.sisaJatah() <= 0) {
      catat('  gambar dilewati — jatah harian', mata.JATAH_HARIAN, 'sudah habis');
      return null;
    }
    let bita = null;
    try {
      /* Dua jalur. Metode di objek pesan ada di sebagian versi pustaka dan
         tidak di sebagian lain, dan yang hilang tidak melempar "tidak
         dikenal" melainkan "is not a function" — persis kelas kesalahan
         yang sudah pernah mematikan saringan topik di berkas ini. */
      bita = typeof pesan.downloadMedia === 'function'
        ? await pesan.downloadMedia()
        : await client.downloadMedia(pesan);
    } catch (e) {
      catat('  gambar gagal diunduh:', e && e.message);
      return null;
    }
    const hasil = await mata.bacaGambarChart(bita, teks);
    if (!hasil || hasil.galat) {
      catat('  mata gagal:', (hasil && hasil.galat) || 'jawaban kosong');
      return null;
    }
    catat('  mata:', hasil.pasangan || '?', hasil.arah || '?',
      '· zona', hasil.zona ? hasil.zona.join('-') : '-',
      '· sl', hasil.sl || '-', '· tp', hasil.tp.join('/') || '-',
      hasil.pasti ? '· ANGKA TERCETAK' : '· taksiran dari posisi',
      '· sisa jatah', mata.sisaJatah());
    const sn = mata.keSinyal(hasil, r.kunciRuang + '-' + pesan.id);
    if (!sn) catat('  mata: belum cukup jadi sinyal —', hasil.catatan || 'tidak lengkap');
    /* Hasil mentahnya ikut dipulangkan. Bacaan yang BELUM cukup jadi sinyal
       tetap punya isi yang berguna — zona yang terbaca itu sendiri — dan
       membuangnya berarti ruang chart ini tidak pernah memperlihatkan apa
       pun kecuali pada hari yang kebetulan levelnya tertulis lengkap. */
    return { sn, hasil };
  }

  async function tangani(pesan, kunciRuang) {
    /* RUANGNYA DICOCOKKAN LEBIH DULU. Pendengar Telegram menerima seluruh
       pembaruan akun; apa pun yang bukan dari ruang terdaftar berhenti di
       sini, sebelum menyentuh arsip maupun lonceng. */
    const r = petaRuang.get(kunciRuang);
    if (!r || !pesan) return;
    try {
      const kunci = kunciRuang + ':' + String(pesan.id);
      if (sudah.has(kunci)) return;

      /* ── Saringan topik ────────────────────────────────────────────
         TOPIK 1 ADALAH KASUS KHUSUS, dan mengabaikannya membuang SEMUA
         sinyal tanpa sisa. Topik 1 = "General", topik bawaan yang selalu
         ada di forum mana pun — dan di grup VIP ASF, General-lah yang
         diberi nama "Signal VIP ASF 🇮🇩" (diganti nama di pesan #187;
         terperiksa 28 Agu 2026, 1.940 dari 2.000 pesan terakhir ada di
         sana). Pesan di General TIDAK membawa penanda topik sama sekali:
         replyTo-nya null. Membandingkannya dengan topikId=1 selalu gagal,
         jadi saringannya akan menolak setiap sinyal sambil tetap terlihat
         sehat di log — pemantau hidup, arsip kosong, dan tidak ada cara
         membedakannya dari grup yang sedang sepi.

         `forumTopic` yang menjaga cabang keduanya: tanpa itu, balasan
         biasa di dalam General terbaca sebagai penanda topik (nilainya
         id pesan yang dibalas), dan balasan ke pesan #1374 akan dikira
         milik topik OUTLOOK. */
      const topikId = r.topikAkhir;
      if (topikId !== null && topikId !== undefined) {
        const rt = pesan.replyTo;
        const idTopik = rt ? (rt.replyToTopId || (rt.forumTopic ? rt.replyToMsgId : null) || null) : null;
        if (topikId === 1) {
          if (idTopik !== null && idTopik !== 1) return;
        } else if (idTopik !== topikId) {
          return;
        }
      }

      /* Saringan pengirim.

         ADMIN ANONIM IKUT LOLOS. Di forum, admin yang memposting "sebagai
         grup" tidak mengirimkan id dirinya — yang datang id KANALNYA. Id
         itu tidak akan pernah ada di daftar peserta admin, jadi saringan
         yang cuma mencocokkan daftar akan membuang setiap postingan resmi
         sambil terlihat bekerja dengan benar. Ruang yang seluruh isinya
         diposting anonim akan terbaca sepi selamanya. */
      const dari = pesan.senderId ? String(pesan.senderId) : '';
      if (r.hanyaAdmin && r.admin.size && dari
          && dari !== r.kunciRuang && !r.admin.has(dari)) return;
      /* Daftar admin BELUM PERNAH terbaca: pesannya tetap disimpan dan
         tetap membunyikan lonceng -- kabar tidak boleh hilang -- tapi
         tidak boleh jadi kartu. Kartu adalah klaim bahwa admin grup
         mengeluarkan sinyal, dan itu belum bisa dipastikan. */
      const adminPasti = !r.hanyaAdmin || r.admin.size > 0;

      const teks = String(pesan.message || pesan.text || '').trim();
      const adaGambar = !!pesan.photo || !!(pesan.media && pesan.media.photo);
      if (!teks && !adaGambar) return;

      sudah.add(kunci);

      /* ── 1. SIMPAN ─────────────────────────────────────────────────── */
      const baris = {
        id: kunci,
        pesanId: pesan.id,
        waktu: (pesan.date ? pesan.date * 1000 : Date.now()),
        agen: r.agen,
        dari,
        teks,
        adaGambar,
        /* Tautan ke pesan aslinya di Telegram. Ini yang dipakai pemilik
           untuk memeriksa sendiri kalau hasil uraiannya terasa aneh —
           tanpa itu, satu-satunya cara memverifikasi adalah mencari
           manual di riwayat grup.

           TINGGAL DI SINI SAJA sejak 28 Agu 2026. Berkas arsip ini tidak
           pernah disajikan server ke siapa pun; yang keluar ke lonceng
           dan ke kartu tidak lagi membawanya. */
        tautan: 'https://t.me/c/' + String(r.grup).replace(/^-100/, '') + '/' + pesan.id,
        sinyal: null,
      };
      const arsip = arsipAmbil();
      arsip.unshift(baris);
      arsipSimpan();
      catat('[' + r.agen + '] pesan baru', pesan.id,
        teks ? teks.slice(0, 60).replace(/\n/g, ' ') : '(gambar)');

      /* ── 2. LONCENG, sebelum diurai — TANPA ISI PESANNYA ────────────
         Lihat catatan panjang di mungkinSinyal(). Yang dikirim di sini
         cuma FAKTA bahwa ada postingan berangka yang belum terurai; itu
         berguna sebagai alarm pengurai yang ketinggalan format, dan tidak
         membocorkan apa pun. Obrolan biasa tidak berbunyi sama sekali. */
      const layakBunyi = mungkinSinyal(teks) || (r.gambar && adaGambar);
      if (layakBunyi) {
        await lonceng({
          id: 'tg-' + kunci.replace(/[^\w-]/g, ''),
          judul: adaGambar ? 'Chart baru di ruang pantauan' : 'Postingan baru di ruang pantauan',
          detail: adaGambar ? 'Sedang dibaca levelnya.'
                            : 'Ada angka, belum terbaca sebagai sinyal lengkap.',
          sumber: r.agen,
          jenis: 'pantau',
          tautan: '',
          waktu: baris.waktu,
        });
      }

      /* ── 3. RANGKAI, boleh gagal ───────────────────────────────────
         Bukan urai(teks) per pesan. Di ruang ini satu sinyal dipecah jadi
         "buy now xauusd" lalu "SL 4632 / TP 4654" semenit kemudian, dan
         masing-masing potongan itu TIDAK BISA diurai sendirian: yang satu
         tanpa angka, yang lain tanpa pasangan maupun arah. Diurai per
         pesan, sinyal yang jelas bagi manusia hilang seluruhnya. */
      let sinyal = null;
      try {
        sinyal = r.rangkai.suap({ dari, teks, waktu: baris.waktu, pesanId: pesan.id });
      } catch (e) {
        catat('  rangkai gagal (diabaikan):', e.message);
      }

      /* Gambar dicoba HANYA kalau teksnya tidak menghasilkan apa-apa.
         Ruang yang menulis levelnya di keterangan gambar akan terbaca
         gratis lewat jalur teks, dan memanggil model untuk sesuatu yang
         sudah terbaca cuma membakar jatah. */
      let mataHasil = null;
      if (!sinyal && r.gambar && adaGambar) {
        const b = await bacaGambar(r, pesan, teks);
        if (b) { sinyal = b.sn; mataHasil = b.hasil; }
      }

      /* ── ZONA YANG TERBACA, WALAU BELUM JADI SINYAL ─────────────────
         Ruang chart memposting kotak zona tanpa SL/TP tertulis — itu
         keadaan NORMALNYA, bukan kekurangan. Kalau yang dikabarkan cuma
         sinyal lengkap, agen ini praktis tidak pernah berbunyi dan
         terbaca seperti agen yang mati.

         Yang dikirim bacaan KITA (pasangan, batas zona, kalimat
         penjelasnya), bukan sepotong pun tulisan orang di ruang itu.
         Id-nya sama dengan lonceng penanda tadi, jadi "Chart baru —
         sedang dibaca" BERUBAH jadi hasilnya, bukan menumpuk di
         bawahnya. */
      if (!sinyal && mataHasil && (mataHasil.pasangan || mataHasil.zona)) {
        const z = mataHasil.zona;
        await lonceng({
          id: 'tg-' + kunci.replace(/[^\w-]/g, ''),
          judul: (mataHasil.pasangan || 'Chart')
            + (mataHasil.arah ? ' ' + mataHasil.arah : '')
            + (z ? ' — zona ' + z[0] + ' - ' + z[1] : ' — zona terbaca'),
          detail: (mataHasil.catatan || 'Zona terbaca dari chart.')
            + (mataHasil.pasti ? '' : ' · taksiran dari posisi, bukan label tercetak'),
          sumber: r.agen,
          jenis: 'pantau',
          pair: mataHasil.pasangan || '',
          tautan: '',
          waktu: baris.waktu,
        });
        catat('  zona dikabarkan ke lonceng');
      }

      if (sinyal) {
        /* Objek `baris` yang sama sudah ada DI DALAM daftar ingatan, jadi
           mengubahnya cukup begini -- tidak perlu mencari lalu menyisipkan
           ulang. Yang dulu dicari-ulang itulah yang membuka lomba. */
        baris.sinyal = sinyal;
        arsipSimpan();

        catat('  ->', sinyal.jenis.toUpperCase(), sinyal.pasangan + (sinyal.pasanganDitebak ? '?' : ''),
          sinyal.arah,
          'entry', sinyal.rentang ? sinyal.rentang.join('-') : (sinyal.entry ?? '-'),
          'sl', sinyal.sl ?? '-', 'tp', (sinyal.tp || []).join('/') || '-',
          '(potongan ' + sinyal.potongan + (sinyal.lengkap ? ', lengkap' : '') + ')');

        /* Lonceng DIPERBARUI, bukan ditambah -- tapi HANYA kalau baris
           pertamanya memang berbunyi. Id-nya sengaja berbeda (id sinyal,
           bukan id pesan) supaya tiga pesan yang menyusun satu setup
           menimpa satu baris yang sama. Isinya SELURUHNYA hasil uraian
           kita sendiri: pasangan, arah, level. Kutipan pesannya dibuang
           28 Agu 2026 bersama nama ruang dan tautannya. */
        await lonceng({
          /* Sinyal dari GAMBAR memakai id pesannya, bukan id sinyalnya:
             satu gambar = satu baris lonceng yang berubah isinya, dari
             "sedang dibaca" jadi hasilnya. Sinyal dari TEKS tetap memakai
             id sinyal, karena di sana tiga pesan berbeda memang harus
             menimpa satu baris yang sama. */
          id: sinyal.dariGambar
            ? 'tg-' + kunci.replace(/[^\w-]/g, '')
            : 'tg-' + sinyal.id,
          judul: sinyal.pasangan + (sinyal.pasanganDitebak ? '?' : '') + ' ' + sinyal.arah
            + (sinyal.rentang ? ' @ ' + sinyal.rentang.join('-')
               : sinyal.entry ? ' @ ' + sinyal.entry : '')
            + (sinyal.jenis === 'pantau' ? ' — pantau dulu' : ''),
          detail: (sinyal.sl ? 'SL ' + sinyal.sl + '  ' : '')
            + ((sinyal.tp || []).length ? 'TP ' + sinyal.tp.join(' / ') + '  ' : '')
            + (sinyal.pasanganDitebak ? '· pasangan tidak disebut, ditebak ' + sinyal.pasangan + '  ' : '')
            + (sinyal.dariGambar ? '· dibaca dari chart' + (sinyal.pasti ? '' : ' (taksiran)') : ''),
          sumber: r.agen,
          jenis: sinyal.jenis,
          pair: sinyal.pasangan,
          tautan: '',
          waktu: baris.waktu,
        });

        /* Kartu dibuat begitu sinyalnya PERTAMA KALI bisa dipakai: ada
           arah, ada entry yang bisa ditentukan, dan SL **dan** TP. Yang
           masih "pantau" tidak dikirim -- kartu adalah ajakan bertindak,
           dan pesan yang menyuruh menunggu bukan itu.

           SATU GERBANG TAMBAHAN UNTUK SINYAL DARI GAMBAR: angkanya harus
           TERCETAK, bukan ditaksir dari posisi kotak terhadap sumbu harga.
           Taksiran boleh berbunyi di lonceng (pemiliknya bisa memeriksa
           sendiri), tapi tidak boleh jadi kartu — kartu memasang order
           sungguhan di terminal orang yang menyalin agennya, dan stop loss
           hasil taksiran piksel adalah kerugian yang kita sebabkan sendiri.
           Gerbang kembarnya ada di mata-chart.js; sengaja di dua tempat. */
        const gambarMeragukan = sinyal.dariGambar && !sinyal.pasti;
        if (gambarMeragukan && layakKartu(sinyal)) {
          catat('  kartu ditahan — angka dari gambar cuma taksiran, bukan label tercetak');
        }
        /* DITANDAI SESUDAH BERHASIL, bukan sebelum dikirim.
           ────────────────────────────────────────────────────────────
           Urutan terbalik berarti kartu yang GAGAL terkirim -- backend
           sedang mati, jaringan putus sesaat -- tidak pernah dicoba lagi.
           Sinyalnya hilang dari papan tanpa jejak, sementara pesannya
           tetap terarsip seolah semuanya beres. Potongan berikutnya dari
           sinyal yang sama akan mencobanya lagi, dan kalau tidak ada
           potongan lagi, ia setidaknya tercatat sebagai gagal di log. */
        if (r.keKartu && adminPasti && !gambarMeragukan
            && layakKartu(sinyal) && !r.sudahJadiKartu.has(sinyal.id)) {
          const id = await kirimKartu(sinyal, { tautan: baris.tautan, teks, catat, agen: r.agen });
          if (id) r.sudahJadiKartu.add(sinyal.id);
        } else if (r.keKartu && !adminPasti && layakKartu(sinyal)) {
          catat('  kartu ditahan — daftar admin belum terbaca');
        }
      }
    } catch (e) {
      /* Pendengar TIDAK BOLEH mati karena satu pesan aneh. Satu pesan yang
         bentuknya tak terduga tidak sepadan dengan kehilangan seluruh
         pemantauan sampai ada yang sadar dan menyalakannya lagi. */
      catat('galat menangani pesan (pemantau tetap jalan):', e && e.message);
    }
  }

  client.addEventHandler(async (peristiwa) => {
    const p = peristiwa.message;
    const idRuang = p && p.peerId && (p.peerId.channelId || p.peerId.chatId || p.peerId.userId);
    await tangani(p, idRuang ? String(idRuang) : 'x');
  });

  /* Didaftarkan sekali saat menyala, bukan tiap pesan: kartunya perlu ADA
     di papan sebelum sinyal pertama, supaya "agennya hidup, grupnya sepi"
     bisa dibedakan dari "agennya mati". Keduanya sama-sama papan kosong.

     Sekali per NAMA AGEN, bukan per ruang: dua ruang yang sengaja disetel
     ke nama agen yang sama memang berbagi satu kartu, dan mendaftarkannya
     dua kali cuma menimpa dirinya sendiri. */
  const sudahHadir = new Set();
  for (const r of hidup) {
    if (!r.keKartu || sudahHadir.has(r.agen)) continue;
    sudahHadir.add(r.agen);
    await daftarHadir(catat, { agen: r.agen, strategi: r.strategi || undefined });
  }

  catat('pemantau hidup ·', hidup.map((r) => r.agen).join(', ')
    + ' · ' + hidup.length + ' ruang. Menunggu pesan — tidak memindai apa pun.');

  /* Denyut sekali sejam ke log, supaya "sepi" bisa dibedakan dari "mati".
     Tanpa ini, log yang kosong selama dua hari punya dua arti yang sangat
     berbeda dan tidak ada cara memilih di antaranya. */
  /* Denyut yang MEMERIKSA sambungannya, bukan yang mengaku.
     ────────────────────────────────────────────────────────────────────
     Versi pertama menulis "masih terhubung" tanpa pernah menanyakannya ke
     siapa pun. Itu bukan sekadar tidak berguna -- ia berbahaya: proses
     tetap hidup karena setInterval menahan event loop, pm2 tetap menulis
     `online`, dan log tiap jam terus meyakinkan pemiliknya bahwa semuanya
     baik sementara soketnya sudah lama putus. Alarm yang selalu bilang
     aman lebih buruk daripada tidak ada alarm.

     Sekarang keadaannya ditanyakan, dan kalau putus ia MENCOBA
     menyambung lagi -- lalu keluar dengan kode galat kalau tetap gagal,
     supaya pm2 menghidupkannya kembali dari nol. Mati keras yang terlihat
     mengalahkan hidup yang berpura-pura. */
  setInterval(async () => {
    const nyambung = !!(client && client.connected);
    catat('denyut —', nyambung ? 'terhubung' : 'PUTUS', '· arsip', arsipAmbil().length, 'pesan');
    if (nyambung) return;
    try {
      await client.connect();
      catat('denyut — tersambung lagi');
    } catch (e) {
      catat('denyut — gagal menyambung ulang:', e.message, '· keluar supaya pm2 menghidupkan ulang');
      process.exit(1);
    }
  }, 60 * 60 * 1000);
})().catch((e) => {
  console.error('[' + jam() + '] pemantau berhenti:', e && e.message ? e.message : e);
  process.exit(1);
});
