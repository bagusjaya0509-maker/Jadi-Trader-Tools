/* ══════════════════════════════════════════════════════════════════════════
   wallet-vps.js — memantau dompet on-chain, HANYA untuk pemilik
   ══════════════════════════════════════════════════════════════════════════
   Fase 1 dari rencana yang disepakati 28 Agu 2026: MENCATAT dulu, belum
   mengeksekusi. Agen membaca posisi dan setiap transaksi dompet Hyperliquid
   yang dipilih pemilik, lalu menaruhnya di ruang analisnya sendiri. Tidak
   ada satu pun order yang dikirim dari berkas ini.

   ── KENAPA HYPERLIQUID, BUKAN DOMPET SPOT ────────────────────────────────
   Dompet spot (Solana/Uniswap) cuma memperlihatkan swap: "beli token X
   sekian". Tidak ada posisi, tidak ada arah, tidak ada harga masuk yang
   berarti — dan menyalinnya menuntut kecepatan 10–40 ms yang tidak mungkin
   dicapai lewat bursa terpusat tempat platform ini mengeksekusi.

   Perp DEX berbeda: satu alamat punya POSISI dengan pasangan, arah, ukuran,
   harga masuk, leverage, dan harga likuidasi. Bentuk itu sama persis dengan
   kartu sinyal yang sudah dipakai di sini, jadi dompet bisa masuk sebagai
   agen tanpa mengarang bentuk data baru.

   ── SEMUANYA DIGERBANGI PEMILIK ──────────────────────────────────────────
   Alamat dompet memang data publik — tidak ada rahasia yang dijaga di sini,
   beda dengan arsip chart. Yang dijaga KEPUTUSANNYA: siapa yang layak
   dipantau dan siapa yang layak disalin belum diuji sama sekali, dan
   memajangnya ke publik sebelum ada angkanya sama dengan merekomendasikan
   orang asing.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

module.exports = (app, { butuhLogin, batasLaju, express, DIR }) => {
  const UID = process.env.PENGIKUT_UID || process.env.PORTO_UID || '';
  const PANTAU = path.join(DIR, 'wallet-pantau.json');
  const AKTIVITAS = path.join(DIR, 'wallet-aktivitas.json');
  const PERINGKAT = path.join(DIR, 'wallet-peringkat.json');
  const PERINGKAT_RINCI = path.join(DIR, 'wallet-peringkat-rinci.json');
  const TIRU = path.join(DIR, 'wallet-tiru.json');

  function baca(F, bawaan) {
    try { return JSON.parse(fs.readFileSync(F, 'utf8')); } catch (e) { return bawaan; }
  }
  function tulis(F, d) {
    const semen = F + '.tmp';
    fs.writeFileSync(semen, JSON.stringify(d, null, 2));
    fs.renameSync(semen, F);
  }

  function hanyaPemilik(req, res, next) {
    if (!UID || req.uid !== UID) {
      return res.status(403).json({ error: 'Pantau dompet hanya untuk akun pemilik.' });
    }
    next();
  }

  /* ── Keadaan lengkap: daftar pantau + posisi + transaksi ──────────────
     SATU rute, bukan tiga. Panelnya selalu butuh ketiganya bersamaan, dan
     tiga permintaan yang selalu berangkat berbarengan cuma menambah tiga
     kali ongkos jabat tangan untuk data yang tidak pernah dipakai
     sendiri-sendiri. */
  /* ── DUA RUTE BACA TERBUKA UNTUK SIAPA SAJA ───────────────────────────
     Isinya data rantai PUBLIK: posisi dompet yang alamatnya memang terbuka
     di Hyperliquid, dan papan peringkat yang diterbitkan bursanya sendiri.
     Tidak ada satu pun yang rahasia — yang membuatnya berharga bukan
     kerahasiaannya, melainkan bahwa ada yang mengumpulkan dan menghitungnya.

     YANG TIDAK IKUT TERBUKA, dan tidak boleh:
       - `tiru` — penanda posisi mana yang DITIRU pemilik. Itu bukan data
         rantai, itu keputusan dagang orangnya sendiri, dan ia pindah ke
         rute /tiru yang tetap digerbangi.
       - Menambah, menghapus, menandai tiruan, dan sakelar auto-close.
         Semuanya menulis, dan sebagiannya menggerakkan uang sungguhan di
         SATU kunci bursa yang ada di .env — kunci pemilik. Pengguna lain
         yang menyalakan auto-close akan menutup posisi pemilik dengan uang
         pemilik. Itu bukan fitur yang kurang matang; itu fitur yang tidak
         boleh ada sampai tiap orang memasang kuncinya sendiri. */
  /* ── MEMBACA BUTUH LOGIN, 10 Sep 2026 ────────────────────────────────
     Rute ini dulu terbuka dengan alasan "isinya data rantai publik".
     Yang ia pulangkan bukan itu: daftar dompet yang DIPILIH untuk
     dipantau, posisi hidupnya, dan log penariknya — sekitar satu MB
     hasil pengumpulan yang selama ini bisa diunduh siapa pun yang tahu
     alamatnya.

     LOGIN, bukan lisensi aktif: keputusan pemilik. Yang perlu ditutup
     adalah pengambilan borongan tanpa identitas, bukan akses pelanggan
     yang masa lisensinya kebetulan sedang habis.

     Menulis tetap `butuhLogin + hanyaPemilik` seperti sebelumnya. */
  app.get('/api/agen/wallet', batasLaju, butuhLogin, (req, res) => {
    const p = baca(PANTAU, { dompet: [] });
    const a = baca(AKTIVITAS, { log: [], posisi: [], denyut: 0, galat: '' });
    res.json({
      ok: true,
      dompet: p.dompet || [],
      log: logUntukLayar(a),
      posisi: a.posisi || [],
      seumur: a.seumur || {},
      denyut: a.denyut || 0,
      galat: a.galat || '',
    });
  });

  /* ── Menambah dompet yang dipantau ────────────────────────────────────
     Lewat layar, bukan lewat .env: memilih dompet adalah pekerjaan yang
     akan dilakukan berulang kali sambil melihat angkanya, dan setelan yang
     menuntut SSH untuk tiap percobaan tidak akan pernah dicoba lebih dari
     sekali. */
  app.post('/api/agen/wallet', batasLaju, butuhLogin, hanyaPemilik, express.json(), (req, res) => {
    const b = req.body || {};
    const alamat = String(b.alamat || '').trim().toLowerCase();
    /* Bentuk alamat diperiksa TEGAS. Alamat yang salah ketik dijawab
       Hyperliquid dengan posisi kosong — bukan galat — jadi dompet yang
       tidak pernah berisi apa pun terlihat persis seperti dompet yang
       sedang tidak punya posisi. */
    if (!/^0x[0-9a-f]{40}$/.test(alamat)) {
      return res.status(400).json({ error: 'Alamat harus 0x diikuti 40 karakter heksadesimal.' });
    }
    const nama = String(b.nama || '').slice(0, 40).trim() || alamat.slice(0, 10) + '…';
    const p = baca(PANTAU, { dompet: [] });
    p.dompet = p.dompet || [];
    if (p.dompet.some((d) => d.alamat === alamat)) {
      return res.status(409).json({ error: 'Dompet itu sudah dipantau.' });
    }
    if (p.dompet.length >= 20) {
      return res.status(400).json({ error: 'Batas 20 dompet. Hapus salah satu dulu.' });
    }
    p.dompet.push({ alamat, nama, sejak: Date.now(), aktif: true });
    tulis(PANTAU, p);
    res.json({ ok: true, dompet: p.dompet });
  });

  /* ── DOMPET SEBAGAI ANALIS DI COPY SIGNAL ─────────────────────────────
     Satu tombol di papan peringkat, dan sesudahnya dompet itu punya kartunya
     sendiri di Copy Signal: tiap posisi yang ia buka jadi sinyal, tiap posisi
     yang ia tutup jadi hasil.

     ── SATU RUTE, BUKAN DUA LANGKAH ───────────────────────────────────
     Menjadikan analis MENYIRATKAN memantau — pemantau dompet cuma melihat
     yang ada di daftar pantau, jadi dompet yang ditandai analis tapi tidak
     dipantau adalah kartu yang tidak akan pernah berisi. Menyerahkan urutan
     itu ke layar berarti satu tombol yang lupa memanggil rute pertama
     menghasilkan keadaan yang tidak bisa dijelaskan siapa pun.

     ── DICABUT TIDAK BERARTI DIHAPUS ──────────────────────────────────
     `analis: false` menghentikan sinyal BARU. Kartu dan riwayat sinyalnya
     tetap ada di papan — itu rekam jejak yang sudah terjadi, dan rekam jejak
     yang ikut hilang saat sakelarnya dimatikan tidak berarti apa-apa.
     Yang mau menyembunyikan kartunya punya panel sendiri di Maintenance. */
  app.post('/api/agen/wallet/analis', batasLaju, butuhLogin, hanyaPemilik, express.json(), (req, res) => {
    const b = req.body || {};
    const alamat = String(b.alamat || '').trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(alamat)) {
      return res.status(400).json({ error: 'Alamat harus 0x diikuti 40 karakter heksadesimal.' });
    }
    const jadi = b.analis !== false;
    const p = baca(PANTAU, { dompet: [] });
    p.dompet = p.dompet || [];
    let d = p.dompet.find((x) => x.alamat === alamat);

    if (!d) {
      if (!jadi) return res.status(404).json({ error: 'Dompet itu tidak ada di daftar pantau.' });
      if (p.dompet.length >= 20) {
        return res.status(400).json({ error: 'Batas 20 dompet. Hapus salah satu dulu.' });
      }
      /* Nama dipakai sebagai NAMA KARTU di Copy Signal, dan uid kartunya
         diturunkan dari nama itu di server analisa. Alamat mentah 42
         karakter jadi judul kartu yang tidak bisa dibaca siapa pun, jadi
         kalau pemanggil tidak mengirim nama, dipakai potongan alamatnya —
         tetap buruk, tapi setidaknya sependek judul. */
      d = { alamat, nama: String(b.nama || '').slice(0, 40).trim() || ('Dompet ' + alamat.slice(2, 8)),
            sejak: Date.now(), aktif: true };
      p.dompet.push(d);
    } else if (jadi && b.nama) {
      /* Nama BARU diterima hanya saat menyalakan, dan hanya kalau dikirim.
         Mengganti nama dompet yang sudah jadi analis akan melahirkan kartu
         BARU di Copy Signal (uid kartu diturunkan dari nama) dan membelah
         riwayatnya jadi dua — jadi penggantian nama harus tindakan yang
         disengaja, bukan efek samping menekan tombol yang sama dua kali. */
      if (!d.analis) d.nama = String(b.nama).slice(0, 40).trim() || d.nama;
    }

    if (jadi) {
      d.analis = true;
      d.analisSejak = d.analisSejak || Date.now();
    } else {
      d.analis = false;
    }
    tulis(PANTAU, p);
    res.json({ ok: true, dompet: p.dompet });
  });

  /* ── PAPAN PERINGKAT ──────────────────────────────────────────────────
     Menjawab "dompet mana yang layak dipantau" — pertanyaan yang tersisa
     dari fase pertama, dan satu-satunya alasan alamat 42 karakter harus
     dicari sendiri di luar sampai sekarang.

     Rute ini TIDAK menarik apa pun dari Hyperliquid. Papan aslinya 36 MB dan
     44 ribu baris; peringkat-wallet.js yang menariknya di proses tersendiri
     empat kali sehari, lalu meninggalkan ringkasan 190 KB di sini. Kalau
     penarikannya dikerjakan di dalam server ini, satu permintaan panel akan
     membekukan SELURUH API selama beberapa detik — termasuk order yang
     sedang dikirim orang lain. */
  /* Butuh login dengan alasan yang sama seperti /api/agen/wallet: papan
     ini hasil penyaringan 44 ribu baris, bukan data yang tergeletak. */
  app.get('/api/agen/wallet/peringkat', batasLaju, butuhLogin, (req, res) => {
    const p = baca(PERINGKAT, null);
    if (!p || !Array.isArray(p.daftar)) {
      return res.json({ ok: true, daftar: [], diperbarui: 0, belumAda: true });
    }
    const q = req.query || {};
    const jendela = ['day', 'week', 'month', 'allTime'].includes(String(q.jendela))
      ? String(q.jendela) : 'month';
    /* Pita ukuran akun. Diurutkan SELALU dari untung terbesar; yang bisa
       dipilih cuma dengan siapa perbandingannya dilakukan. Alasan panjangnya
       ada di peringkat-wallet.js -- tiga kandidat kolom persen dicoba dengan
       data sungguhan dan ketiganya menghasilkan angka yang tak terjelaskan. */
    const pita = { kecil: [0, 1e6], menengah: [1e6, 1e7], semua: [0, Infinity] };
    const [pBawah, pAtas] = pita[String(q.pita)] || pita.semua;
    const batas = Math.min(120, Math.max(5, Number(q.batas) || 40));

    /* Alamat yang SUDAH dipantau ikut ditandai, bukan dibuang dari daftar.
       Membuangnya membuat dompet terbaik menghilang dari papan begitu
       dipantau, dan yang melihatnya mengira peringkatnya berubah. */
    const dipantau = new Set(((baca(PANTAU, { dompet: [] }).dompet) || []).map((d) => d.alamat));

    /* Disaring dan diurutkan DI SINI, bukan di peramban. Kirim 190 KB tiap
       kali orang berganti jendela waktu itu mahal untuk sambungan yang
       sering menumpang tethering; yang benar-benar dibaca cuma 40 baris. */
    /* Rincian ditempel dari berkas terpisah, dan yang tidak punya dibiarkan
       KOSONG — bukan diisi nol. Cuma barisan teratas yang diperkaya (userFills
       632 KB per dompet, 953 dompet mustahil), dan nol di kolom win rate
       terbaca sebagai "tidak pernah menang" — kebalikan dari "belum
       diperiksa". */
    const rinci = (baca(PERINGKAT_RINCI, { rinci: {} }) || {}).rinci || {};

    const daftar = p.daftar
      .filter((x) => x && x.w && x.w[jendela] && x.akun >= pBawah && x.akun < pAtas)
      .sort((a, b) => (b.w[jendela].pnl || 0) - (a.w[jendela].pnl || 0))
      .slice(0, batas)
      .map((x) => ({
        alamat: x.alamat,
        nama: x.nama || '',
        akun: x.akun,
        pnl: x.w[jendela].pnl,
        vlm: x.w[jendela].vlm,
        dipantau: dipantau.has(x.alamat),
        rinci: rinci[x.alamat] || null,
      }));

    res.json({
      ok: true, jendela, pita: String(q.pita || 'semua'),
      diperbarui: p.diperbarui || 0,
      total: p.total || 0,
      minAkun: p.minAkun || 0,
      daftar,
    });
  });

  /* ── POSISI YANG DITIRU ───────────────────────────────────────────────
     Menandai "koin X di dompet ini sedang saya tiru". Yang disimpan cuma
     PENANDA — pasangan koin dan alamat — bukan order, bukan ukuran, bukan
     satu pun angka yang bisa dipakai mengeksekusi apa pun.

     Gunanya dua, dan keduanya soal melihat, bukan soal bertindak:

       1. Menyandingkan posisi sendiri dengan posisi dompet yang ditiru di
          satu layar. Tanpa itu, membandingkan keduanya berarti membuka
          Binance di satu tab dan panel ini di tab lain, lalu mengingat
          angkanya di kepala.

       2. Membunyikan lonceng saat dompet sumbernya bergerak di koin yang
          ditiru. Itu kabar yang paling mahal kalau terlambat: orang yang
          ditiru menutup posisinya sementara posisi kita masih terbuka.

     TIDAK ada eksekusi di sini, dan itu disengaja. Lihat catatan panjang di
     pemantau soal kenapa auto-open/auto-close belum dibangun. */
  app.get('/api/agen/wallet/tiru', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    res.json({ ok: true, tiru: (baca(TIRU, { tiru: [] }).tiru) || [] });
  });

  app.post('/api/agen/wallet/tiru', batasLaju, butuhLogin, hanyaPemilik, express.json(), (req, res) => {
    const b = req.body || {};
    const alamat = String(b.alamat || '').trim().toLowerCase();
    const koin = String(b.koin || '').trim().toUpperCase();
    if (!/^0x[0-9a-f]{40}$/.test(alamat) || !koin) {
      return res.status(400).json({ error: 'Alamat atau koin tidak sah.' });
    }
    const d = baca(TIRU, { tiru: [] });
    d.tiru = d.tiru || [];
    /* Satu koin per dompet. Menandai dua kali bukan dua tiruan — itu satu
       tiruan yang diklik dua kali, dan menyimpannya dua kali membuat
       loncengnya berbunyi dua kali untuk satu kejadian. */
    if (!d.tiru.some((t) => t.alamat === alamat && t.koin === koin)) {
      d.tiru.push({ alamat, koin, waktu: Date.now() });
      tulis(TIRU, d);
    }
    res.json({ ok: true, tiru: d.tiru });
  });

  /* ── SAKELAR AUTO-CLOSE, PER PENANDA ──────────────────────────────────
     Dinyalakan satu per satu, bukan satu sakelar untuk semuanya. Menyalakan
     seluruh tiruan sekaligus berarti satu klik memberi izin menutup posisi
     yang bahkan belum dipikirkan — dan izin yang diberikan borongan adalah
     izin yang tidak pernah benar-benar ditimbang.

     BAWAANNYA MATI, dan tidak ada cara menyalakannya kecuali di layar. */
  app.post('/api/agen/wallet/tiru/oto', batasLaju, butuhLogin, hanyaPemilik, express.json(), (req, res) => {
    const b = req.body || {};
    const alamat = String(b.alamat || '').toLowerCase();
    const koin = String(b.koin || '').toUpperCase();
    const d = baca(TIRU, { tiru: [] });
    const t = (d.tiru || []).find((x) => x.alamat === alamat && x.koin === koin);
    if (!t) return res.status(404).json({ error: 'Penanda tiruan tidak ditemukan.' });
    t.otoTutup = b.otoTutup === true;
    /* Hitungan konfirmasi DIRESET tiap kali sakelarnya disentuh. Kalau
       tidak, sakelar yang dimatikan lalu dinyalakan lagi akan mewarisi
       hitungan lama dan bisa langsung mengeksekusi pada pindaian pertama —
       tanpa kesempatan satu putaran pun untuk diperiksa. */
    t.konfirmasi = 0;
    tulis(TIRU, d);
    res.json({ ok: true, tiru: d.tiru });
  });

  /* -- SAKELAR AUTO-OPEN, UKURAN, DAN LEVERAGE -------------------------
     Terpisah dari rute auto-close di atas, dan itu bukan kerapian: menutup
     dan membuka adalah dua izin yang berbeda beratnya. Menggabungkannya
     jadi satu rute berarti satu permintaan bisa menyalakan keduanya, dan
     yang lebih berat ikut menyala karena kebetulan berada di badan yang
     sama.

     `usd` adalah MARGIN -- uang yang dipertaruhkan -- bukan nilai posisi.
     Nilai posisinya usd x leverage. Di 1x keduanya sama, dan 1x yang
     dipakai; kolom leverage ada supaya suatu hari bisa disesuaikan tanpa
     membongkar apa pun.

     Batas di sini SENGAJA longgar (500) -- ia cuma penjaga salah ketik.
     Batas yang sesungguhnya SALIN_MAKS_USD di server, gerbang terakhir
     sebelum uang bergerak, dan batas itu tidak bisa diubah dari layar. */
  app.post('/api/agen/wallet/tiru/buka', batasLaju, butuhLogin, hanyaPemilik, express.json(), (req, res) => {
    const b = req.body || {};
    const alamat = String(b.alamat || '').toLowerCase();
    const koin = String(b.koin || '').toUpperCase();
    const d = baca(TIRU, { tiru: [] });
    const t = (d.tiru || []).find((x) => x.alamat === alamat && x.koin === koin);
    if (!t) return res.status(404).json({ error: 'Penanda tiruan tidak ditemukan.' });

    if (b.usd !== undefined) {
      const u = Number(b.usd);
      if (!(u > 0) || u > 500) return res.status(400).json({ error: 'Ukuran harus antara 1 dan 500 USD.' });
      t.usd = Math.round(u * 100) / 100;
    }
    if (b.leverage !== undefined) {
      const l = Math.round(Number(b.leverage) || 1);
      if (!(l >= 1 && l <= 20)) return res.status(400).json({ error: 'Leverage harus 1 sampai 20.' });
      t.leverage = l;
    }
    if (b.bursa !== undefined) {
      const v = String(b.bursa).toLowerCase();
      if (!['binance', 'hyperliquid', 'dua'].includes(v)) {
        return res.status(400).json({ error: 'Bursa harus binance, hyperliquid, atau dua.' });
      }
      t.bursa = v;
    }
    if (b.otoBuka !== undefined) {
      if (b.otoBuka === true && !(Number(t.usd) > 0)) {
        return res.status(400).json({ error: 'Isi dulu ukuran ordernya sebelum menyalakan auto-open.' });
      }
      t.otoBuka = b.otoBuka === true;
      /* Hitungan konfirmasi DAN ingatan keadaan sumber sama-sama direset.
         Alasan konfirmasi sama dengan di rute auto-close. Alasan
         `sumberPegang` lebih penting: pemantau cuma bertindak pada
         peralihan tidak-pegang -> pegang, dan ingatan lama membuat sakelar
         yang baru dinyalakan mengira peralihan itu sudah terjadi. Dihapus,
         pindaian berikutnya memulai dari nol -- mencatat dulu, tidak
         bertindak. */
      t.bukaKonfirmasi = 0;
      delete t.sumberPegang;
    }
    tulis(TIRU, d);
    res.json({ ok: true, tiru: d.tiru });
  });

  app.delete('/api/agen/wallet/tiru/:alamat/:koin', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    const alamat = String(req.params.alamat || '').toLowerCase();
    const koin = String(req.params.koin || '').toUpperCase();
    const d = baca(TIRU, { tiru: [] });
    d.tiru = (d.tiru || []).filter((t) => !(t.alamat === alamat && t.koin === koin));
    tulis(TIRU, d);
    res.json({ ok: true, tiru: d.tiru });
  });

  /* ══ SALIN DOMPET — SATU SETELAN UNTUK SATU DOMPET ══════════════════
     Menggantikan penandaan per koin. Yang disimpan cuma niatnya: ke bursa
     mana, sebesar apa, dan hidup atau tidak. Koin mana yang disalin bukan
     urusan setelan ini -- itu keputusan dompetnya, dan menyalinnya berarti
     mengikuti keputusan itu apa adanya.

     Keadaan berjalannya (`pegang`, `punyaku`, hitungan konfirmasi) ditulis
     PEMANTAU, bukan rute ini. Rute ini tidak pernah menyentuhnya supaya
     menyimpan setelan di tengah putaran tidak menghapus ingatan yang
     sedang dipakai memutuskan. */
  const SALIN = path.join(DIR, 'wallet-salin.json');

  /* Tiga daftar sekaligus, bukan tiga rute.
     ──────────────────────────────────────────────────────────────────
     Setelan, log aksi, dan riwayat posisi tertutup selalu dibaca
     bersamaan oleh satu panel -- memecahnya jadi tiga rute berarti tiga
     perjalanan jaringan dan tiga kemungkinan salah satunya tertinggal
     satu putaran di belakang yang lain. Ketiganya tinggal di berkas yang
     sama, jadi memulangkannya sekaligus juga tidak menambah kerja.

     Log dibalik di sini (terbaru dulu): mesin menulisnya berurutan maju
     karena itu yang murah untuk pemangkasan, tapi yang dibaca orang
     selalu yang paling akhir terjadi. */
  app.get('/api/agen/wallet/salin', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    const d = baca(SALIN, { salin: [], log: [], riwayat: [] });
    res.json({
      ok: true,
      salin: d.salin || [],
      /* Batas per koin, kelipatan margin dasar. GLOBAL, bukan per dompet —
         bursa menyatukan posisi dari dompet mana pun jadi satu, jadi batas
         per dompet menjanjikan sesuatu yang tidak bisa ditepati. */
      maksLipat: lipatSah(d.maksLipat),
      log: (d.log || []).slice().reverse(),
      riwayat: (d.riwayat || []).slice().reverse(),
    });
  });

  /* Disalin dari `bacaLipat` di salin-dompet.js. Disalin, bukan diimpor:
     rute ini harus tetap menolak nilai ngawur walaupun mesin salinnya
     kebetulan tidak terpasang di proses yang sama. Batas atas 10 dipasang
     supaya salah ketik satu angka nol tidak jadi izin menumpuk sepuluh kali
     lipat lebih banyak dari yang dimaksud. */
  const lipatSah = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 && n <= 10 ? Math.round(n * 10) / 10 : 1;
  };

  app.post('/api/agen/wallet/salin', batasLaju, butuhLogin, hanyaPemilik, express.json(), (req, res) => {
    const b = req.body || {};
    const alamat = String(b.alamat || '').trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(alamat)) {
      return res.status(400).json({ error: 'Alamat dompet tidak sah.' });
    }
    const bursa = String(b.bursa || 'binance').toLowerCase();
    if (!['binance', 'hyperliquid', 'dua'].includes(bursa)) {
      return res.status(400).json({ error: 'Bursa harus binance, hyperliquid, atau dua.' });
    }
    const usd = Number(b.usd);
    if (!(usd > 0) || usd > 500) {
      return res.status(400).json({ error: 'Ukuran harus antara 1 dan 500 USD.' });
    }
    const leverage = Math.round(Number(b.leverage) || 1);
    if (!(leverage >= 1 && leverage <= 20)) {
      return res.status(400).json({ error: 'Leverage harus 1 sampai 20.' });
    }

    const d = baca(SALIN, { salin: [] });
    d.salin = d.salin || [];
    let s = d.salin.find((x) => x.alamat === alamat);
    if (!s) { s = { alamat, dibuat: Date.now() }; d.salin.push(s); }

    const nyalaBaru = b.aktif === true;
    /* -- INGATAN DIHAPUS SAAT SAKELARNYA BERUBAH ---------------------
       Pemantau cuma bertindak pada PERUBAHAN daftar koin, dan `pegang`
       adalah pembanding terakhirnya. Sakelar yang dimatikan lalu
       dinyalakan lagi sesudah dompetnya bergerak akan mewarisi
       perbandingan basi, lalu menyalin belasan koin sekaligus sebagai
       "baru" -- padahal semuanya sudah lama terbuka.

       Dihapus, pindaian berikutnya memulai dari nol: mencatat dulu, tidak
       bertindak. `punyaku` TIDAK dihapus -- posisi yang sudah terlanjur
       dibuka tetap harus bisa ditutup. */
    if (s.aktif !== nyalaBaru) {
      delete s.pegang;
      s.konfirmasiBuka = {};
      s.konfirmasiTutup = {};
    }
    s.aktif = nyalaBaru;
    s.bursa = bursa;
    s.usd = Math.round(usd * 100) / 100;
    s.leverage = leverage;
    /* Per dompet. Ditulis hanya kalau dikirim — pemanggil lama tidak boleh
       diam-diam mematikannya. Nilai selain `true` persis = mati. */
    if (b.sesuaikanMinimum !== undefined) s.sesuaikanMinimum = b.sesuaikanMinimum === true;
    if (b.nama !== undefined) s.nama = String(b.nama).slice(0, 60);
    s.diubah = Date.now();

    /* Medan GLOBAL yang menumpang formulir per dompet. Ditulis hanya kalau
       dikirim, supaya pemanggil lama yang belum tahu medan ini tidak
       diam-diam mengembalikannya ke 1 tiap kali menyimpan setelan dompet. */
    if (b.maksLipat !== undefined) d.maksLipat = lipatSah(b.maksLipat);

    tulis(SALIN, d);
    res.json({ ok: true, salin: d.salin, maksLipat: lipatSah(d.maksLipat) });
  });

  app.delete('/api/agen/wallet/salin/:alamat', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    const alamat = String(req.params.alamat || '').toLowerCase();
    const d = baca(SALIN, { salin: [] });
    const s = (d.salin || []).find((x) => x.alamat === alamat);
    /* Menolak menghapus setelan yang masih memegang posisi salinan.
       Menghapusnya berarti pemantau kehilangan catatan bahwa posisi itu
       miliknya, dan posisi sungguhan ditinggal terbuka tanpa ada yang
       merasa bertanggung jawab menutupnya. */
    if (s && s.punyaku && Object.keys(s.punyaku).length) {
      return res.status(409).json({
        error: 'Masih ada ' + Object.keys(s.punyaku).length + ' posisi salinan terbuka. '
             + 'Matikan salinannya dulu dan tunggu posisinya tertutup.',
      });
    }
    d.salin = (d.salin || []).filter((x) => x.alamat !== alamat);
    tulis(SALIN, d);
    res.json({ ok: true, salin: d.salin });
  });

  app.delete('/api/agen/wallet/:alamat', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    const alamat = String(req.params.alamat || '').toLowerCase();
    const p = baca(PANTAU, { dompet: [] });
    const sebelum = (p.dompet || []).length;
    p.dompet = (p.dompet || []).filter((d) => d.alamat !== alamat);
    if (p.dompet.length === sebelum) return res.status(404).json({ error: 'Tidak ada.' });
    tulis(PANTAU, p);
    res.json({ ok: true, dompet: p.dompet });
  });

  console.log('[wallet] siap · ' + (UID ? 'pemilik ' + UID.slice(0, 8) + '…' : 'UID PEMILIK KOSONG — semua ditolak'));
};

/* ── Dipakai pemantau untuk menulis hasil pindaian ────────────────────────
   Dipisah dari rutenya dengan alasan yang sama seperti arsip chart:
   pemantau berjalan sebagai proses sendiri, dan berkas adalah satu-satunya
   saluran yang keduanya sudah pakai. */
/* ── BATAS PER DOMPET, BUKAN SATU BATAS UNTUK SEMUA ──────────────────────
   Dulu 1000 baris untuk seluruh daftar, dengan alasan "cukup panjang untuk
   beberapa dompet ramai tanpa yang satu menghapus jejak yang lain". Terukur
   7 Sep 2026: SATU dompet (0x615f…, ~75 fill/jam) memakan 929 dari 1000
   baris itu, dan sembilan dari dua belas dompet tidak punya satu baris pun
   — padahal dipantau sejak 28 Agu. Yang terjadi tiap menit: jejak mereka
   tidak ada di log, jadi `batasTerakhir` jatuh ke tanggal mulai, seluruh
   riwayatnya ditarik ulang dari bursa ("Agresif 40x · 182 transaksi baru"
   setiap menit di log pm2), ditulis, lalu langsung tergusur lagi oleh
   1000 baris dompet ramai yang semuanya lebih baru. Di layar: kartu
   "$0.00 · 0 penutupan" untuk dompet yang kemarin masih berkurva. Bukan
   reset — tergusur. Dan 182 baris "baru" itu ikut masuk ke lonceng dan
   cermin Copy Signal tiap putaran.

   Sekarang tiga wadah, dua di antaranya berbatas PER DOMPET:
     `log`       — umpan transaksi terbaru, semua jenis fill. Untuk dompet
                   ramai ini beberapa jam; untuk dompet biasa berbulan.
     `penutupan` — buku penutupan per dompet: fill ber-closedPnl, sudah
                   dikelompokkan persis seperti di layar (koin+arah yang
                   sama dalam 5 menit = satu penutupan). Inilah yang
                   menjaga "realisasi sejak dipantau" dan kurvanya tetap
                   ada sesudah umpannya bergeser. Disimpan TERTUA DI DEPAN
                   supaya penambahannya cuma push.
     `batas`     — tanda air waktu fill terakhir per dompet, ditulis
                   eksplisit; tidak lagi disimpulkan dari log yang bisa
                   tergusur. */
const AKTIVITAS_PER_DOMPET = 250;
const PENUTUPAN_PER_DOMPET = 3000;
/* Sama dengan `JEDA_SATU_KELUAR` di pemantau dan di panel-wallet-agen.tsx.
   Tiga tempat memutuskan hal yang sama, jadi angkanya harus sama. */
const JEDA_SATU_KELUAR = 5 * 60 * 1000;
/* Kunci fill anggota yang diingat tiap kelompok — cukup untuk menolak fill
   yang sama dikirim dua kali, tanpa menyimpan seluruh riwayatnya. */
const ANGGOTA_MAKS = 40;

function kunciFill(l) {
  return [l.alamat, l.hash, l.waktu, l.koin, l.ukuran, l.harga, l.dir].join('|');
}
function kunciAnggota(l) {
  return [l.hash, l.waktu, l.ukuran].join('|');
}
function bulat(n, k) { return Math.round((Number(n) || 0) * k) / k; }

/* Menempelkan satu fill penutupan ke buku dompetnya. Pengelompokannya
   meniru `penutupanDompet` di layar: hanya dibandingkan dengan kelompok
   TERAKHIR — koin dan arah sama, selisih waktu ≤ 5 menit. Keduanya harus
   memberi jumlah penutupan yang sama, jadi algoritmanya tidak boleh
   lebih pintar di satu sisi. */
function tempelPenutupan(peta, l) {
  const daftar = peta[l.alamat] || (peta[l.alamat] = []);
  const k = kunciAnggota(l);
  for (let i = daftar.length - 1; i >= 0 && i >= daftar.length - 10; i--) {
    if ((daftar[i].anggota || []).indexOf(k) >= 0) return false;
  }
  const g = daftar[daftar.length - 1];
  if (g && g.koin === l.koin && g.dir === l.dir && l.waktu >= g.waktu && l.waktu - g.waktu <= JEDA_SATU_KELUAR) {
    const u = (Number(g.ukuran) || 0) + (Number(l.ukuran) || 0);
    if (u > 0) g.harga = bulat((g.harga * g.ukuran + l.harga * l.ukuran) / u, 1e8);
    g.ukuran = bulat(u, 1e8);
    g.nilai = bulat(g.nilai + l.nilai, 100);
    g.pnl = bulat(g.pnl + l.pnl, 1e6);
    g.waktu = l.waktu;
    if (!Array.isArray(g.anggota)) g.anggota = [];
    if (g.anggota.length < ANGGOTA_MAKS) g.anggota.push(k);
    return true;
  }
  daftar.push({
    waktu: l.waktu, mulai: l.waktu, alamat: l.alamat, nama: l.nama,
    koin: l.koin, arah: l.arah, dir: l.dir,
    harga: Number(l.harga) || 0, ukuran: Number(l.ukuran) || 0,
    nilai: Number(l.nilai) || 0, pnl: Number(l.pnl) || 0,
    hash: l.hash, anggota: [k],
  });
  return true;
}

/* Menggabungkan fill baru ke berkas: tolak yang sudah ada, potong umpan
   per dompet, tempel penutupannya ke buku, majukan tanda air. Memulangkan
   jumlah baris yang benar-benar baru. */
function gabungAktivitas(d, baru) {
  if (!Array.isArray(d.log)) d.log = [];
  if (!d.penutupan || typeof d.penutupan !== 'object') d.penutupan = {};
  if (!d.batas || typeof d.batas !== 'object') d.batas = {};

  const ada = new Set(d.log.map(kunciFill));
  const segar = [];
  for (const l of baru) {
    if (!l || !l.alamat) continue;
    const k = kunciFill(l);
    if (ada.has(k)) continue;
    ada.add(k);
    segar.push(l);
  }
  if (!segar.length) return 0;

  /* Yang terbaru di depan, diurutkan ULANG sesudah digabung: satu putaran
     bisa memulangkan beberapa dompet sekaligus, dan urutan kedatangannya
     bukan urutan waktunya. Lalu dipotong PER DOMPET. */
  const semua = [...segar, ...d.log].sort((a, b) => b.waktu - a.waktu);
  const hitung = {};
  const log = [];
  for (const l of semua) {
    const n = (hitung[l.alamat] || 0) + 1;
    hitung[l.alamat] = n;
    if (n <= AKTIVITAS_PER_DOMPET) log.push(l);
  }
  d.log = log;

  const tutup = segar.filter((l) => Number(l.pnl) !== 0).sort((a, b) => a.waktu - b.waktu);
  for (const l of tutup) tempelPenutupan(d.penutupan, l);
  for (const a of Object.keys(d.penutupan)) {
    const daftar = d.penutupan[a];
    if (Array.isArray(daftar) && daftar.length > PENUTUPAN_PER_DOMPET) {
      d.penutupan[a] = daftar.slice(daftar.length - PENUTUPAN_PER_DOMPET);
    }
  }

  for (const l of segar) {
    if (!d.batas[l.alamat] || l.waktu > d.batas[l.alamat]) d.batas[l.alamat] = l.waktu;
  }
  return segar.length;
}

/* Bentuk yang dibaca layar: umpan terbaru DITAMBAH kelompok penutupan yang
   sudah lebih tua daripada baris umpan tertua dompet itu. Yang lebih baru
   dari batas itu sudah ada di umpan sebagai fill asli — menambahkannya lagi
   berarti menghitung P/L yang sama dua kali. */
function logUntukLayar(a) {
  const log = Array.isArray(a.log) ? a.log : [];
  const tertua = {};
  for (const l of log) {
    if (!(l.alamat in tertua) || l.waktu < tertua[l.alamat]) tertua[l.alamat] = l.waktu;
  }
  const tambahan = [];
  const peta = a.penutupan && typeof a.penutupan === 'object' ? a.penutupan : {};
  for (const alamat of Object.keys(peta)) {
    const bawah = alamat in tertua ? tertua[alamat] : Infinity;
    for (const g of (peta[alamat] || [])) {
      if (g.waktu >= bawah) continue;
      tambahan.push({
        waktu: g.waktu, alamat: g.alamat || alamat, nama: g.nama, koin: g.koin,
        arah: g.arah, dir: g.dir, harga: g.harga, ukuran: g.ukuran,
        nilai: g.nilai, pnl: g.pnl, hash: g.hash, kelompok: true,
      });
    }
  }
  if (!tambahan.length) return log;
  return [...log, ...tambahan].sort((x, y) => y.waktu - x.waktu);
}

module.exports.gabungAktivitas = gabungAktivitas;
module.exports.logUntukLayar = logUntukLayar;
module.exports.kunciFill = kunciFill;

module.exports.bacaDompet = function bacaDompet(DIR) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, 'wallet-pantau.json'), 'utf8'));
    return (d.dompet || []).filter((x) => x.aktif !== false);
  } catch (e) { return []; }
};

/* @param baris.log     transaksi baru (larik) — DITAMBAHKAN, tidak menimpa
   @param baris.posisi  potret posisi terbuka SEKARANG — DITIMPA
   Dua perlakuan berbeda karena dua pertanyaan berbeda: "apa yang terjadi"
   menumpuk, "apa yang sedang dipegang" hanya punya satu jawaban benar. */
module.exports.catatWallet = function catatWallet(DIR, baris) {
  const F = path.join(DIR, 'wallet-aktivitas.json');
  let d = { log: [], posisi: [], denyut: 0, galat: '' };
  try { d = JSON.parse(fs.readFileSync(F, 'utf8')); } catch (e) { /* baru */ }
  if (!Array.isArray(d.log)) d.log = [];

  if (Array.isArray(baris.log) && baris.log.length) gabungAktivitas(d, baris.log);
  if (Array.isArray(baris.posisi)) d.posisi = baris.posisi;
  /* DITIMPA, bukan digabung — sama seperti posisi. Ia potret hitungan
     terakhir atas seluruh riwayat, dan menggabungnya dengan potret
     sebelumnya berarti menjumlahkan riwayat yang sama dua kali. */
  if (baris.seumur && typeof baris.seumur === 'object') d.seumur = baris.seumur;
  if (baris.denyut) d.denyut = baris.denyut;
  if (typeof baris.galat === 'string') d.galat = baris.galat;

  try {
    const semen = F + '.tmp';
    fs.writeFileSync(semen, JSON.stringify(d, null, 2));
    fs.renameSync(semen, F);
  } catch (e) { /* disk penuh — catatan bukan alasan menjatuhkan pemantau */ }
};

/** Transaksi terakhir yang sudah tercatat per dompet. Dipakai pemantau
 *  untuk tahu dari mana melanjutkan sesudah restart — tanpa ini tiap
 *  restart akan mencatat ulang seluruh riwayat yang dipulangkan API. */
module.exports.batasTerakhir = function batasTerakhir(DIR) {
  const peta = {};
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, 'wallet-aktivitas.json'), 'utf8'));
    /* Tanda air eksplisit lebih dulu; log dan buku penutupan cuma
       penyempurna untuk berkas dari versi sebelum tanda air ada. */
    for (const a of Object.keys(d.batas || {})) peta[a] = Number(d.batas[a]) || 0;
    for (const l of (d.log || [])) {
      if (!peta[l.alamat] || l.waktu > peta[l.alamat]) peta[l.alamat] = l.waktu;
    }
    const pen = d.penutupan && typeof d.penutupan === 'object' ? d.penutupan : {};
    for (const a of Object.keys(pen)) {
      for (const g of (pen[a] || [])) if (!peta[a] || g.waktu > peta[a]) peta[a] = g.waktu;
    }
  } catch (e) { /* belum ada */ }
  return peta;
};
