/* ══════════════════════════════════════════════════════════════════════════
   arsip-chart-vps.js — chart dari ruang pantauan, HANYA untuk pemilik
   ══════════════════════════════════════════════════════════════════════════
   Sebagian ruang analisa tidak menulis levelnya sebagai teks: yang diposting
   tangkapan layar chart, dan angkanya cuma ada di dalam gambarnya.

   Percobaan sebelumnya membacanya dengan model penglihatan. Itu bekerja —
   zona terbaca benar — tapi hampir tidak pernah menghasilkan kartu, karena
   ruang seperti itu memang jarang menulis SL/TP. Keputusan pemilik 28 Agu
   2026: gambarnya disimpan apa adanya dan DIA yang menyaring serta merapikan
   area entry-nya. Nol biaya model, dan yang menilai setup tetap manusia.

   ── KENAPA TERTUTUP RAPAT ────────────────────────────────────────────────
   Chart-chart ini membawa tanda air sumbernya DI DALAM pikselnya — nama
   ruang tercetak besar di tengah, dan nama akun TradingView-nya di pojok
   kiri atas. Menyajikannya ke publik akan menyiarkan asal sumber lebih keras
   daripada tautan yang sudah susah payah dicabut dari lonceng dan kartu,
   dan ia ikut terindeks pencarian gambar.

   Jadi setiap rute di sini digerbangi DUA lapis: wajib masuk, lalu wajib uid
   pemilik. Gambarnya tidak pernah lewat express.static dan namanya tidak
   bisa ditebak dari luar.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

module.exports = (app, { butuhLogin, batasLaju, express, DIR }) => {
  const UID = process.env.PENGIKUT_UID || process.env.PORTO_UID || '';
  const GAMBAR_DIR = path.join(DIR, 'chart-arsip');
  const INDEKS = path.join(DIR, 'chart-arsip.json');
  const DASAR = 'http://127.0.0.1:' + (process.env.PORT || 4000);
  const APP_TOKEN = process.env.APP_TOKEN || '';

  fs.mkdirSync(GAMBAR_DIR, { recursive: true });

  function baca() {
    try {
      const d = JSON.parse(fs.readFileSync(INDEKS, 'utf8'));
      return Array.isArray(d.chart) ? d.chart : [];
    } catch (e) { return []; }
  }

  function tulis(daftar) {
    const semen = INDEKS + '.tmp';
    fs.writeFileSync(semen, JSON.stringify({ chart: daftar }, null, 2));
    fs.renameSync(semen, INDEKS);
  }

  /* Gerbang pemilik. Dipasang sebagai middleware, bukan diperiksa di dalam
     tiap penangan: satu rute yang lupa memeriksanya membocorkan seluruh
     arsipnya, dan lupa itu tidak akan terlihat sebagai galat di mana pun. */
  function hanyaPemilik(req, res, next) {
    if (!UID || req.uid !== UID) {
      return res.status(403).json({ error: 'Arsip chart hanya untuk akun pemilik.' });
    }
    next();
  }

  /* ── Daftar chart ─────────────────────────────────────────────────────
     Yang disembunyikan tidak ikut, kecuali diminta. Menyaring di server,
     bukan di layar: daftar yang sudah dibereskan tidak perlu dikirim ulang
     tiap kali panelnya dibuka. */
  app.get('/api/agen/chart', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    const semua = req.query.semua === '1';
    const daftar = baca().filter((c) => semua || !c.sembunyi);
    res.json({ ok: true, chart: daftar, total: baca().length });
  });

  /* ── Log aktivitas agen ───────────────────────────────────────────────
     Menjawab satu pertanyaan yang tidak bisa dijawab arsipnya sendiri:
     "agennya bekerja, atau ruangnya memang sepi?" Dua keadaan itu
     menghasilkan arsip yang sama persis — tidak bertambah — dan tanpa
     catatan ini satu-satunya cara membedakannya adalah masuk ke VPS lalu
     membaca log pm2.

     Yang paling berharga di sini bukan baris "tersimpan", melainkan baris
     "dilewati": saringan yang menolak diam-diam adalah cara paling rapi
     kehilangan postingan tanpa pernah tahu. */
  app.get('/api/agen/chart/aktivitas', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    let d = { log: [], ruang: [] };
    try { d = JSON.parse(fs.readFileSync(path.join(DIR, 'chart-aktivitas.json'), 'utf8')); }
    catch (e) { /* belum pernah ditulis — pemantau baru pertama kali nyala */ }
    res.json({ ok: true, log: d.log || [], ruang: d.ruang || [] });
  });

  /* ── SAKLAR AI PEMBACA CHART ──────────────────────────────────────────
     Setelannya milik mata-chart.js, dan dibaca lewat modul itu — bukan
     dengan menyusun ulang jalur berkasnya di sini. Dua tempat yang
     menghitung jalur yang sama adalah dua tempat yang bisa berselisih, dan
     selisihnya akan terbaca sebagai "tombolnya ditekan tapi tidak ada
     yang berubah": panel menulis ke satu berkas, pemantau membaca yang
     lain, dan tidak ada satu pun galat yang muncul.

     Prosesnya memang berbeda — rute ini hidup di backend web, yang
     membacanya hidup di pemantau Telegram — tapi berkasnya satu, dan itu
     yang menjadikannya saklar sungguhan. */
  const mata = require('./mata-chart');

  app.get('/api/agen/chart/mata', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    /* ── GERBANG KEDUA IKUT DILAPORKAN ─────────────────────────────
       Saklar di panel bukan satu-satunya yang menentukan AI membaca atau
       tidak. Tiap ruang Telegram punya `TG*_GAMBAR` sendiri di .env, dan
       ruang yang nilainya 0 tidak pernah menyuapi model apa pun.

       Tanpa laporan ini, panel akan menulis "AI baca chart menyala"
       untuk keadaan yang sebenarnya tidak membaca apa-apa — dan tidak
       ada bentuk kebohongan layar yang lebih halus daripada saklar yang
       menyala di atas kabel yang putus.

       Sengaja dibaca dari env, bukan dari berkas keadaan pemantau: yang
       menentukan memang env, dan menyalinnya ke tempat lain cuma
       menciptakan satu salinan yang bisa basi. */
    const AWALAN = ['TG', 'TG2', 'TG3', 'TG4'];
    const ruang = [];
    for (const a of AWALAN) {
      if (!String(process.env[a + '_GRUP'] || '').trim()) continue;
      ruang.push({
        awalan: a,
        agen: String(process.env[a + '_AGEN_NAMA'] || a).trim(),
        gambar: process.env[a + '_GAMBAR'] === '1',
        arsip: process.env[a + '_ARSIP'] === '1',
      });
    }
    res.json({
      ok: true,
      setelan: mata.bacaSetelan(),
      jatah: { harian: mata.JATAH_HARIAN, pakai: mata.pakaiJatah(), sisa: mata.sisaJatah() },
      model: mata.MODEL,
      ruang,
    });
  });

  app.post('/api/agen/chart/mata', batasLaju, butuhLogin, hanyaPemilik, express.json(), (req, res) => {
    const b = req.body || {};
    /* Bentuk tanggal DIPERIKSA, bukan dipercaya. Yang lolos setengah jadi
       ("2026-9-3") akan dibandingkan sebagai teks dengan "2026-09-03" dan
       hasilnya salah tanpa satu pun galat — jendela yang membuang gambar
       yang seharusnya masuk, sunyi total. */
    const tgl = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const s = String(v).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
      return s;
    };
    const dari = tgl(b.dari);
    const sampai = tgl(b.sampai);
    if (dari === undefined || sampai === undefined) {
      return res.status(400).json({ error: 'Tanggal harus berbentuk YYYY-MM-DD.' });
    }
    if (dari && sampai && dari > sampai) {
      return res.status(400).json({ error: 'Tanggal mulai ada sesudah tanggal akhir.' });
    }
    try {
      const isi = mata.tulisSetelan({ aktif: b.aktif !== false, dari, sampai });
      res.json({ ok: true, setelan: isi });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menyimpan setelan: ' + ((e && e.message) || '?') });
    }
  });

  /* ── Gambarnya ────────────────────────────────────────────────────────
     Dilayani dari memori, bukan lewat express.static. Static akan membuat
     seluruh folder bisa ditebak alamatnya oleh siapa pun yang tahu nama
     berkasnya, dan nama berkasnya cuma nomor pesan Telegram — bukan rahasia
     yang bisa diandalkan. */
  app.get('/api/agen/chart/:id/gambar', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    const c = baca().find((x) => x.id === req.params.id);
    if (!c || !c.berkas) return res.status(404).json({ error: 'Tidak ada.' });
    /* Nama berkas dari indeks, TIDAK dari alamatnya. Menyusun jalur dari
       parameter alamat membuka jalan ke berkas lain lewat "../" — dan di
       folder ini tetangganya .env. */
    const p = path.join(GAMBAR_DIR, path.basename(c.berkas));
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'Berkasnya hilang.' });
    res.type('image/jpeg');
    res.set('Cache-Control', 'private, max-age=86400');
    fs.createReadStream(p).pipe(res);
  });

  /* ── Menandai: sembunyikan, kembalikan, atau beri catatan ────────────── */
  app.post('/api/agen/chart/:id', batasLaju, butuhLogin, hanyaPemilik, express.json(), (req, res) => {
    const daftar = baca();
    const c = daftar.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Tidak ada.' });
    const b = req.body || {};
    if (typeof b.sembunyi === 'boolean') c.sembunyi = b.sembunyi;
    /* `terpilah` = sudah dipindahkan pemilik ke seksi koinnya.
       ────────────────────────────────────────────────────────────────
       Chart yang baru masuk berkumpul di rak "Baru" paling atas supaya
       terlihat apa yang datang; sesudah dilihat, pemilik memindahkannya
       dan ia menyatu ke seksi koinnya masing-masing. */
    if (typeof b.terpilah === 'boolean') c.terpilah = b.terpilah;
    if (typeof b.catatan === 'string') c.catatan = b.catatan.slice(0, 500);
    tulis(daftar);
    res.json({ ok: true, chart: c });
  });

  /* ── Membuang satu chart, berikut berkasnya ───────────────────────────
     Menghapus baris indeks saja akan meninggalkan berkasnya di disk
     selamanya — arsip yang "sudah dihapus" tapi masih ada isinya adalah
     kebocoran yang paling mudah terlupakan. */
  app.delete('/api/agen/chart/:id', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    const daftar = baca();
    const i = daftar.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Tidak ada.' });
    const [c] = daftar.splice(i, 1);
    if (c.berkas) {
      try { fs.unlinkSync(path.join(GAMBAR_DIR, path.basename(c.berkas))); } catch (e) { /* sudah hilang */ }
    }
    /* Dicatat SEBELUM indeksnya ditulis. Kalau prosesnya mati di antara
       keduanya, yang tertinggal adalah nisan untuk chart yang masih ada —
       dan itu cuma berarti ia tidak akan ditarik ulang seandainya nanti
       dihapus lagi. Urutan sebaliknya meninggalkan chart yang hilang dari
       indeks tanpa nisan, dan sapuan berikutnya mengembalikannya: persis
       cacat yang sedang diperbaiki. */
    try { module.exports.tandaiBuang(DIR, c.id); }
    catch (e) { /* nisan gagal ditulis bukan alasan menggagalkan penghapusan */ }
    tulis(daftar);
    res.json({ ok: true, sisa: daftar.length });
  });

  /* ── Jadikan sinyal ───────────────────────────────────────────────────
     Level DITULIS PEMILIK, tidak diambil dari gambarnya. Itu inti keputusan
     28 Agu 2026: yang menilai dan merapikan area entry adalah manusia, dan
     angka yang ditulis tangan tidak bisa salah karena satu digit terbaca
     keliru dari piksel.

     Kartunya diterbitkan lewat rute agen yang SUDAH ADA, dari sisi server.
     Dua alasan: seluruh pemeriksaannya (sisi SL/TP terhadap entry, kuota,
     bentuk badan) berlaku apa adanya tanpa disalin, dan APP_TOKEN tidak
     perlu pernah menyeberang ke peramban. */
  app.post('/api/agen/chart/:id/sinyal', batasLaju, butuhLogin, hanyaPemilik, express.json(), async (req, res) => {
    const daftar = baca();
    const c = daftar.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Tidak ada.' });

    const b = req.body || {};
    const pasangan = String(b.pasangan || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const arah = b.arah === 'SELL' ? 'SELL' : 'BUY';
    const entry = Number(b.entry) || 0;
    const sl = Number(b.sl) || 0;
    const tp = Number(b.tp) || 0;
    if (!pasangan || !entry || !sl || !tp) {
      return res.status(400).json({ error: 'Pasangan, entry, SL, dan TP wajib diisi.' });
    }
    /* SISI SL/TP DIPERIKSA DI SINI JUGA. Rute agen memang memeriksanya,
       tapi jawabannya berupa kartu yang tidak terbit — dan dari layar itu
       terbaca seperti tombol yang tidak bekerja. Ditolak di sini, sebabnya
       bisa ditulis dalam kalimat yang menjelaskan apa yang salah. */
    const beli = arah === 'BUY';
    if (beli ? sl >= entry : sl <= entry) {
      return res.status(400).json({ error: 'SL ' + sl + ' di sisi yang salah untuk ' + arah + ' di ' + entry + '.' });
    }
    if (beli ? tp <= entry : tp >= entry) {
      return res.status(400).json({ error: 'TP ' + tp + ' di sisi yang salah untuk ' + arah + ' di ' + entry + '.' });
    }

    const kripto = /USDT$/.test(pasangan);
    try {
      const r = await fetch(DASAR + '/api/analisa/agen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN },
        body: JSON.stringify({
          agenNama: c.agen || 'AI Chart',
          pasangan, arah,
          tf: String(b.tf || '1h').slice(0, 6),
          pasar: kripto ? 'kripto' : 'tradefi',
          judul: pasangan + ' ' + arah + ' — area entry dirapikan pemilik',
          /* Tidak menyebut ruang mana pun, sama seperti kartu agen lainnya. */
          ringkas: 'Zona dari chart yang dipantau agen; area entry, SL, dan TP '
                 + 'ditetapkan pemilik sendiri.',
          isi: {
            entry, sl, tp,
            alasan: 'Chart-nya dibaca pemilik, bukan diurai mesin. Area entry, '
                  + 'SL, dan TP di kartu ini angka yang ia tetapkan sendiri '
                  + 'setelah melihat zonanya.\n'
                  + (b.alasan ? '\n' + String(b.alasan).slice(0, 1500) + '\n' : ''),
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(502).json({ error: 'Kartu ditolak: ' + (j.error || r.status) });
      /* Ditandai SESUDAH kartunya benar-benar terbit. Menandai lebih dulu
         berarti chart yang gagal diposting hilang dari daftar tanpa pernah
         jadi apa-apa. */
      c.sembunyi = true;
      c.sinyalId = j.id || null;
      tulis(daftar);
      res.json({ ok: true, id: j.id || null });
    } catch (e) {
      res.status(502).json({ error: 'Gagal menerbitkan: ' + e.message });
    }
  });

  console.log('[arsip-chart] siap · ' + (UID ? 'pemilik ' + UID.slice(0, 8) + '…' : 'UID PEMILIK KOSONG — semua ditolak'));
};

/* ── CATATAN AKTIVITAS ────────────────────────────────────────────────────
   Ditulis pemantau, dibaca rute di atas. Berkas, bukan memori bersama:
   pemantau dan backend dua proses terpisah, dan berkas adalah satu-satunya
   saluran yang keduanya sudah pakai (chart-arsip.json juga begitu).

   `ruang` menyimpan keadaan TERAKHIR tiap ruang — denyut, jumlah admin,
   topik yang dipatok. Itu jawaban "agennya hidup?"; `log` jawaban "apa saja
   yang lewat?". Dua pertanyaan berbeda, jadi dua bentuk berbeda: yang satu
   ditimpa, yang satu ditumpuk.

   Dibatasi 80 baris. Log yang tumbuh tanpa batas akan membuat rutenya
   mengirim berkas satu megabita ke peramban tiap kali panelnya dibuka. */
const AKTIVITAS_MAKS = 80;

module.exports.catatAktivitas = function catatAktivitas(DIR, baris) {
  const F = path.join(DIR, 'chart-aktivitas.json');
  let d = { log: [], ruang: [] };
  try { d = JSON.parse(fs.readFileSync(F, 'utf8')); } catch (e) { /* baru */ }
  if (!Array.isArray(d.log)) d.log = [];
  if (!Array.isArray(d.ruang)) d.ruang = [];

  if (baris.ruang) {
    /* Keadaan ruang DITIMPA, bukan ditumpuk: yang dicari orangnya "denyut
       terakhir kapan", bukan riwayat seluruh denyut sejak dinyalakan. */
    const i = d.ruang.findIndex((r) => r.agen === baris.ruang.agen);
    if (i >= 0) d.ruang[i] = { ...d.ruang[i], ...baris.ruang };
    else d.ruang.push(baris.ruang);
  }
  if (baris.log) {
    d.log.unshift({ waktu: Date.now(), ...baris.log });
    d.log = d.log.slice(0, AKTIVITAS_MAKS);
  }

  try {
    const semen = F + '.tmp';
    fs.writeFileSync(semen, JSON.stringify(d, null, 2));
    fs.renameSync(semen, F);
  } catch (e) { /* disk penuh — catatan bukan alasan menjatuhkan pemantau */ }
};

/** Id chart yang SUDAH tersimpan. Dipakai sapuan untuk tahu mana yang
 *  perlu diunduh — tanpa ini sapuan harus mengunduh setiap gambar dulu baru
 *  menyadari ia sudah punya, dan sapuan tiap sepuluh menit akan menarik
 *  belasan megabita berulang-ulang untuk tidak menyimpan apa pun.
 *
 *  Ditaruh di sini, bukan di pemantau, karena bentuk indeksnya milik berkas
 *  ini. Dua penulis yang harus sepakat selamanya adalah kesepakatan yang
 *  cepat atau lambat putus. */
/* ══ NISAN — ID CHART YANG SUDAH DIBUANG ═══════════════════════════════
   Chart yang dihapus muncul lagi beberapa menit kemudian. Bukan gangguan
   kecil: itu membuat tombol hapusnya berbohong.

   Sebabnya sapuan bertanya "apa yang sudah kupunya?" ke INDEKS, dan indeks
   cuma tahu apa yang ADA sekarang. Menghapus sebuah chart mengeluarkan
   id-nya dari sana — dan begitu id-nya hilang, pesan Telegram yang sama
   kembali terbaca sebagai temuan baru yang belum pernah ditarik. Sapuan
   bekerja persis seperti seharusnya; yang salah pertanyaannya.

   Ada dua keadaan yang bentuknya sama dan artinya berlawanan:

       "belum pernah kuambil"   -> ambil
       "sudah kuambil, dibuang" -> JANGAN ambil

   Indeks tidak bisa membedakannya, karena keduanya sama-sama berarti
   "tidak ada di daftar". Jadi yang dibuang dicatat terpisah dan disimpan
   selamanya. Daftarnya cuma berisi id, sekitar 40 bita per baris; seribu
   penghapusan pun tidak sampai 40 KB.

   TIDAK dipangkas. Memangkas yang tertua berarti menghidupkan kembali
   chart yang paling lama dibuang — persis cacat yang sedang diperbaiki,
   cuma datangnya lebih lambat. */
function berkasBuang(DIR) { return path.join(DIR, 'chart-buang.json'); }

module.exports.idChartDibuang = function idChartDibuang(DIR) {
  try {
    const d = JSON.parse(fs.readFileSync(berkasBuang(DIR), 'utf8'));
    return new Set((d.buang || []).map((x) => String(x.id)));
  } catch (e) { return new Set(); }
};

module.exports.tandaiBuang = function tandaiBuang(DIR, id) {
  let d = { buang: [] };
  try { d = JSON.parse(fs.readFileSync(berkasBuang(DIR), 'utf8')); } catch (e) { /* baru */ }
  if (!Array.isArray(d.buang)) d.buang = [];
  if (d.buang.some((x) => String(x.id) === String(id))) return;
  d.buang.push({ id: String(id), waktu: Date.now() });
  /* Tulis ke berkas sementara lalu ganti nama: nisan yang tersimpan
     separuh saat proses mati akan gagal di-parse, dan berkas nisan yang
     gagal dibaca berarti SELURUH penghapusan yang pernah dilakukan
     terlupakan sekaligus. */
  const semen = berkasBuang(DIR) + '.tmp';
  fs.writeFileSync(semen, JSON.stringify(d, null, 2));
  fs.renameSync(semen, berkasBuang(DIR));
};

module.exports.idChartTersimpan = function idChartTersimpan(DIR) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, 'chart-arsip.json'), 'utf8'));
    return new Set((d.chart || []).map((c) => String(c.id)));
  } catch (e) { return new Set(); }
};

/** Waktu chart TERBARU yang sudah tersimpan, 0 kalau arsipnya kosong.
 *  Sapuan memakainya untuk membedakan kabar yang terlewat dari riwayat
 *  yang memang belum pernah ditarik. */
module.exports.puncakArsip = function puncakArsip(DIR) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, 'chart-arsip.json'), 'utf8'));
    return (d.chart || []).reduce((t, c) => Math.max(t, Number(c.waktu) || 0), 0);
  } catch (e) { return 0; }
};

/* ── Dipakai pemantau untuk menyimpan satu chart ──────────────────────────
   Ditempel ke module.exports supaya pemantau bisa memakainya tanpa
   menyalakan express. Kalau kodenya disalin ke pemantau, bentuk indeksnya
   punya dua penulis — dan dua penulis yang harus sepakat selamanya adalah
   kesepakatan yang cepat atau lambat putus. */
module.exports.simpanChart = function simpanChart(DIR, { id, agen, keterangan, waktu, bita, terpilah }) {
  const GAMBAR_DIR = path.join(DIR, 'chart-arsip');
  const INDEKS = path.join(DIR, 'chart-arsip.json');
  const MAKS = Number(process.env.CHART_ARSIP_MAKS || 150);
  fs.mkdirSync(GAMBAR_DIR, { recursive: true });

  let daftar = [];
  try { daftar = JSON.parse(fs.readFileSync(INDEKS, 'utf8')).chart || []; } catch (e) { /* baru */ }
  if (daftar.some((c) => c.id === id)) return null;   // sudah ada

  /* Pagar KEDUA, di titik yang dilewati semua jalan masuk. Sapuan sudah
     menyaring nisannya lebih dulu supaya gambarnya tidak perlu diunduh
     sama sekali; pagar di sini yang menjamin jalan masuk BERIKUTNYA —
     yang belum ditulis siapa pun hari ini — tidak bisa diam-diam
     menghidupkan lagi chart yang sudah dibuang. */
  try {
    if (module.exports.idChartDibuang(DIR).has(String(id))) return null;
  } catch (e) { /* nisan tak terbaca: jangan halangi penyimpanan */ }

  const berkas = id.replace(/[^\w-]/g, '') + '.jpg';
  fs.writeFileSync(path.join(GAMBAR_DIR, berkas), bita);
  daftar.unshift({
    id, agen,
    keterangan: String(keterangan || '').slice(0, 800),
    waktu: waktu || Date.now(),
    berkas,
    kb: Math.round(bita.length / 1024),
    sembunyi: false,
    /* TEGAS bernilai, dan itu yang membedakannya dari arsip lama.
       ────────────────────────────────────────────────────────────────
       Baris lama tidak punya medan ini sama sekali, dan pembacanya
       memperlakukan "tidak ada" sebagai SUDAH dipilah. Kalau yang baru
       juga dibiarkan kosong, ia tidak akan pernah muncul di rak Baru;
       kalau yang lama dianggap belum dipilah, sebelas chart yang sudah
       lama ada akan membanjiri rak itu sekaligus. Satu nilai tegas di
       sini menyelesaikan keduanya tanpa perlu memigrasi apa pun. */
    /* Bawaannya false — chart yang baru datang memang belum dipilah, dan
       itu yang menaruhnya di rak "Baru masuk". Sapuan boleh menimpanya:
       yang ia temukan dari riwayat lama BUKAN kabar baru, dan menaruh
       lima puluh chart lama di rak itu sekaligus membuat rak yang gunanya
       menandai yang baru jadi tidak bisa dipakai untuk apa pun. */
    terpilah: terpilah === true,
    catatan: '',
    sinyalId: null,
  });

  /* Yang terlama dibuang BERIKUT berkasnya. Arsip yang cuma dipotong di
     indeks akan menumpuk gambar di disk tanpa ada yang bisa melihatnya
     lagi — tumbuh tanpa batas dan tak terjangkau sekaligus. */
  while (daftar.length > MAKS) {
    const buang = daftar.pop();
    if (buang && buang.berkas) {
      try { fs.unlinkSync(path.join(GAMBAR_DIR, path.basename(buang.berkas))); } catch (e) { /* sudah hilang */ }
    }
  }

  const semen = INDEKS + '.tmp';
  fs.writeFileSync(semen, JSON.stringify({ chart: daftar }, null, 2));
  fs.renameSync(semen, INDEKS);
  return berkas;
};
