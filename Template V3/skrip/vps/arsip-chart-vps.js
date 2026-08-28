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

/* ── Dipakai pemantau untuk menyimpan satu chart ──────────────────────────
   Ditempel ke module.exports supaya pemantau bisa memakainya tanpa
   menyalakan express. Kalau kodenya disalin ke pemantau, bentuk indeksnya
   punya dua penulis — dan dua penulis yang harus sepakat selamanya adalah
   kesepakatan yang cepat atau lambat putus. */
module.exports.simpanChart = function simpanChart(DIR, { id, agen, keterangan, waktu, bita }) {
  const GAMBAR_DIR = path.join(DIR, 'chart-arsip');
  const INDEKS = path.join(DIR, 'chart-arsip.json');
  const MAKS = Number(process.env.CHART_ARSIP_MAKS || 150);
  fs.mkdirSync(GAMBAR_DIR, { recursive: true });

  let daftar = [];
  try { daftar = JSON.parse(fs.readFileSync(INDEKS, 'utf8')).chart || []; } catch (e) { /* baru */ }
  if (daftar.some((c) => c.id === id)) return null;   // sudah ada

  const berkas = id.replace(/[^\w-]/g, '') + '.jpg';
  fs.writeFileSync(path.join(GAMBAR_DIR, berkas), bita);
  daftar.unshift({
    id, agen,
    keterangan: String(keterangan || '').slice(0, 800),
    waktu: waktu || Date.now(),
    berkas,
    kb: Math.round(bita.length / 1024),
    sembunyi: false,
    /* TEGAS false, dan itu yang membedakannya dari arsip lama.
       ────────────────────────────────────────────────────────────────
       Baris lama tidak punya medan ini sama sekali, dan pembacanya
       memperlakukan "tidak ada" sebagai SUDAH dipilah. Kalau yang baru
       juga dibiarkan kosong, ia tidak akan pernah muncul di rak Baru;
       kalau yang lama dianggap belum dipilah, sebelas chart yang sudah
       lama ada akan membanjiri rak itu sekaligus. Satu nilai tegas di
       sini menyelesaikan keduanya tanpa perlu memigrasi apa pun. */
    terpilah: false,
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
