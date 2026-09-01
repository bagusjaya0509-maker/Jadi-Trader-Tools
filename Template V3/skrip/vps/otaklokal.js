/* ══════════════════════════════════════════════════════════════════════════
   otaklokal.js — memakai model Ollama di PC pemilik dari bot yang hidup di VPS
   ══════════════════════════════════════════════════════════════════════════
   MASALAHNYA. Ollama jalan di PC (hermes3:8b, GTX 1650). Bot jalan di VPS.
   PC ada di balik NAT tethering: VPS TIDAK BISA menghubunginya. Semua alat
   terowongan (cloudflared, tailscale, ngrok) butuh akun baru + unduhan, dan
   kuota pemilik dibatasi.

   JADI ARAHNYA DIBALIK. Bukan VPS menghubungi PC, melainkan PC yang MENJEMPUT
   kerja dari VPS — sama seperti prinsip yang sudah dipakai untuk Claude. PC
   sudah bisa menghubungi VPS (itu yang dipakai deploy tiap hari), jadi tidak
   ada yang perlu dibuka, dipasang, atau didaftarkan.

   YANG DIPINDAH KE LOKAL, DAN KENAPA HANYA ITU. Diukur 19 Agu 2026:

     - PENGGOLONG (memilah maksud kalimat): hermes3:8b LULUS, tapi HANYA dengan
       skema JSON ketat. Tanpa skema ia mengarang aksi "siapkan" yang tidak ada
       di daftar, dan validator menolaknya. Dengan skema: tepat.
     - TINGKAT BERPIKIR (menjawab pertanyaan berpendapat): hermes3:8b GAGAL.
       Melanggar batas kalimat, memakai daftar bernomor padahal dilarang, dan
       nyaris tidak menyebut satu angka pun padahal itu aturan utama. Tetap di
       nemotron-550b — 70x lebih besar, dan bedanya terasa.

   Maka yang lewat sini hanya penggolong. Kalau PC mati, bot memakai OpenRouter
   persis seperti sebelumnya: tidak ada yang rusak, cuma kembali makan kuota.
   ══════════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

module.exports = (app, { requireToken, batasLaju, express }) => {
  /* Antrean di memori saja, sengaja. Pekerjaan di sini berumur detik; menulisnya
     ke disk berarti sisa pekerjaan basi ikut hidup lagi setelah restart dan
     dijawab ke percakapan yang sudah lama lewat. */
  const antre = [];
  const menunggu = new Map();     // id -> { selesai, jam }
  let pekerjaTerakhir = 0;        // kapan worker terakhir menyapa

  const TUNGGU_BAWAAN = 20000;

  /* Dipanggil dari dalam bot. Memulangkan null kalau PC mati atau kelamaan —
     pemanggil WAJIB menyiapkan jalan lain, bukan menampilkan galat.

     ── GAMBAR IKUT LEWAT SINI ────────────────────────────────────────
     Ditambahkan 1 Sep 2026. Antrean ini semula cuma membawa teks, dan
     itu cukup selama yang dikerjakan lokal hanya penggolong maksud
     kalimat. Sejak model penglihatan ikut dipakai untuk MENGENALI chart
     (bukan membaca angkanya — lihat mata-chart.js), pekerjaannya membawa
     satu gambar base64 sekitar seratus kilobita.

     Dibawa di dalam pekerjaan yang sama, bukan lewat unggahan terpisah:
     pekerjaan dan bahannya harus tiba bersama, dan dua perjalanan berarti
     ada keadaan di mana yang satu tiba dan yang lain tidak.

     Batas waktunya juga diperpanjang PEMANGGIL, bukan di sini: gambar di
     GTX 1650 makan 40-60 detik sementara penggolong teks selesai dalam
     dua detik, dan satu angka bawaan untuk keduanya pasti salah untuk
     salah satunya. */
  function mintaLokal(pesan, skema, tungguMs = TUNGGU_BAWAAN, gambar = null) {
    // PC dianggap mati kalau worker tidak menyapa dalam 30 detik terakhir.
    // Tanpa penjagaan ini tiap pesan menggantung 20 detik sebelum menyerah.
    if (Date.now() - pekerjaTerakhir > 30000) return Promise.resolve(null);

    const id = crypto.randomBytes(8).toString('hex');
    return new Promise((selesai) => {
      const jam = setTimeout(() => {
        menunggu.delete(id);
        const i = antre.findIndex((k) => k.id === id);
        if (i >= 0) antre.splice(i, 1);
        selesai(null);
      }, tungguMs);
      menunggu.set(id, { selesai, jam });
      antre.push({ id, pesan, skema, gambar: gambar || null, dibuat: Date.now() });
      if (antre.length > 20) antre.shift();   // jangan menumpuk kalau PC lambat
    });
  }

  /* ── GET /api/otak/ambil ────────────────────────────────────────────────
     Worker di PC memanggil ini terus-menerus. Sengaja long-poll sampai 25
     detik: kalau balas kosong seketika, worker harus memanggil tiap detik dan
     itu membakar kuota tethering untuk permintaan yang isinya nihil. */
  app.get('/api/otak/ambil', batasLaju, requireToken, async (req, res) => {
    pekerjaTerakhir = Date.now();
    const batas = Date.now() + 25000;
    while (Date.now() < batas) {
      const k = antre.shift();
      if (k) return res.json({ ok: true, kerja: k });
      await new Promise((r) => setTimeout(r, 400));
      pekerjaTerakhir = Date.now();
    }
    res.json({ ok: true, kerja: null });
  });

  /* ── POST /api/otak/hasil ─────────────────────────────────────────────── */
  app.post('/api/otak/hasil', batasLaju, requireToken, express.json({ limit: '256kb' }), (req, res) => {
    pekerjaTerakhir = Date.now();
    const { id, jawaban, galat } = req.body || {};
    const t = menunggu.get(id);
    if (!t) return res.json({ ok: false, error: 'pekerjaan sudah kedaluwarsa' });
    clearTimeout(t.jam);
    menunggu.delete(id);
    t.selesai(galat ? null : String(jawaban || ''));
    res.json({ ok: true });
  });

  /* ── POST /api/otak/gambar ──────────────────────────────────────────────
     Titipan pekerjaan PENGLIHATAN dari proses lain.

     Perlu ada rutenya sendiri karena pemantau Telegram adalah proses pm2
     yang BERBEDA dari backend ini: ia tidak bisa memanggil mintaLokal()
     langsung walau keduanya hidup di mesin yang sama. Yang menghubungkan
     keduanya HTTP, sama seperti sisi pekerja di PC.

     Memulangkan `lokal:false` kalau PC-nya mati, dan itu jawaban yang sah:
     pemanggil punya jalan lain (model berbayar) dan yang ia butuhkan cuma
     tahu cepat, bukan menunggu batas waktu habis untuk menyimpulkannya. */
  app.post('/api/otak/gambar', batasLaju, requireToken, express.json({ limit: '4mb' }), async (req, res) => {
    const { pesan, gambar, skema, tungguMs } = req.body || {};
    if (!gambar) return res.status(400).json({ error: 'gambar kosong' });
    if (Date.now() - pekerjaTerakhir > 30000) {
      return res.json({ ok: true, lokal: false, alasan: 'PC tidak menyapa 30 detik terakhir' });
    }
    /* Batas waktu jauh lebih panjang daripada pekerjaan teks. Model
       penglihatan di kartu 4 GB makan 40-60 detik; 20 detik bawaan akan
       menyerah tepat sebelum jawabannya datang, tiap kali. */
    const jawab = await mintaLokal(String(pesan || ''), skema || null,
      Math.min(300000, Number(tungguMs) || 180000), String(gambar));
    if (jawab === null) return res.json({ ok: true, lokal: false, alasan: 'PC tidak menjawab tepat waktu' });
    res.json({ ok: true, lokal: true, jawaban: jawab });
  });

  /* ── GET /api/otak/status ─────────────────────────────────────────────── */
  app.get('/api/otak/status', batasLaju, requireToken, (req, res) => {
    const umur = pekerjaTerakhir ? Math.round((Date.now() - pekerjaTerakhir) / 1000) : null;
    res.json({
      ok: true,
      pcHidup: umur != null && umur < 30,
      detikSejakSapaTerakhir: umur,
      antre: antre.length,
      menunggu: menunggu.size,
    });
  });

  console.log('[otaklokal] siap — /api/otak/ambil + /hasil + /status');
  return {
    mintaLokal,
    pcHidup: () => Date.now() - pekerjaTerakhir < 30000,
    /* Dibuka untuk modul lain yang perlu memutuskan "coba lokal dulu atau
       langsung berbayar". Tanpa ini tiap pemanggil harus menebak lewat
       batas waktu — dan menebak lewat batas waktu berarti menunggu 20
       detik untuk mengetahui PC-nya mati. */
    detikSejakPekerja: () => Math.round((Date.now() - pekerjaTerakhir) / 1000),
  };
};
