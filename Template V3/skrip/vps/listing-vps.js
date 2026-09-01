/* ══════════════════════════════════════════════════════════════════════════
   listing-vps.js — Coin Listing: menunggui koin presale sampai ia listing
   ══════════════════════════════════════════════════════════════════════════
   MASALAH YANG DIPECAHKAN
   Pemilik berkali-kali ketinggalan koin yang dibeli lewat presale di situs
   proyeknya sendiri. Uangnya sudah masuk, tokennya sudah dipegang, tapi
   momen listing lewat begitu saja — kabarnya datang dari grup yang ramai,
   jam berapa saja, dan sering baru terbaca setelah harganya bergerak.

   Yang dijaga di sini bukan pembeliannya (itu di situs proyeknya, di luar
   jangkauan kita) melainkan MOMEN LISTING-nya. Terbukti bisa: kolam yang
   baru berumur dua menit sudah terbaca di GeckoTerminal, lengkap dengan
   harga dan likuiditasnya.

   ── KENAPA ALAMAT KONTRAK, BUKAN NAMA ────────────────────────────────────
   Nama koin bukan pengenal. Ada empat kolam berbeda bernama "TRUMP" di
   Solana dengan harga $2,42 sampai $0,0289 — beda 80 kali lipat, dan tiga
   di antaranya bukan yang dimaksud siapa pun. Alamat kontrak satu-satunya
   hal yang tidak bisa ditiru: kalau alamatnya sama, tokennya memang sama.

   Maka yang disimpan alamat, dan yang dicocokkan alamat. Nama cuma label
   yang ditulis pemakainya sendiri untuk mengingat ini koin apa.

   ── KENAPA HARGA BELI IKUT DICATAT ───────────────────────────────────────
   Pertanyaan pertama pada detik listing bukan "berapa harganya" melainkan
   "aku untung berapa". Tanpa harga presale, angka listing cuma angka, dan
   orang menghitung kelipatan di kepala persis saat ia paling tidak boleh
   salah hitung. Dua medan — berapa dolar dibayar, berapa token diterima —
   sudah cukup untuk menjawabnya sendiri.

   ── PER PENGGUNA, BUKAN PER PEMILIK ──────────────────────────────────────
   Beda dengan pantau dompet yang digerbangi pemilik: daftar ini tidak
   merekomendasikan apa pun kepada siapa pun. Ia catatan pribadi, disimpan
   berdasar uid, dan tidak pernah muncul di jawaban pengguna lain. Isinya
   memang data keuangan pribadi — berapa yang dibayar untuk apa — jadi
   TIDAK ADA satu rute pun di berkas ini yang mengembalikan baris milik
   orang lain.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

/* Satu putaran pemantau saja untuk seluruh proses, walau modulnya
   ter-`require` dua kali. Dua putaran berarti dua kali kuota GeckoTerminal
   untuk jawaban yang sama persis. */
let putaranJalan = false;

const GT = 'https://api.geckoterminal.com/api/v2';

/* Jaringan yang dilayani. Kuncinya nama jaringan versi GeckoTerminal —
   dipakai apa adanya di URL, jadi tidak ada peta kedua yang bisa basi.
   `goplus` menyimpan chain id versi GoPlus, yang sayangnya berbeda. */
const JARINGAN = {
  solana:      { label: 'Solana',    gas: 'SOL',   goplus: 'solana', pola: 'sol' },
  eth:         { label: 'Ethereum',  gas: 'ETH',   goplus: '1',      pola: 'evm' },
  bsc:         { label: 'BNB Chain', gas: 'BNB',   goplus: '56',     pola: 'evm' },
  base:        { label: 'Base',      gas: 'ETH',   goplus: '8453',   pola: 'evm' },
  arbitrum:    { label: 'Arbitrum',  gas: 'ETH',   goplus: '42161',  pola: 'evm' },
  polygon_pos: { label: 'Polygon',   gas: 'POL',   goplus: '137',    pola: 'evm' },
};

const POLA_EVM = /^0x[a-fA-F0-9]{40}$/;
const POLA_SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Alamat sah untuk jaringannya? Diperiksa SEBELUM disimpan, bukan saat
 *  dipantau: alamat yang salah bentuk tidak akan pernah ketemu kolamnya,
 *  dan "belum listing" adalah laporan yang menenangkan untuk kesalahan
 *  ketik yang seharusnya berbunyi keras sejak awal. */
function alamatSah(jaringan, alamat) {
  const j = JARINGAN[jaringan];
  if (!j) return false;
  return j.pola === 'evm' ? POLA_EVM.test(alamat) : POLA_SOL.test(alamat);
}

module.exports = (app, { butuhLogin, batasLaju, express, DIR }) => {
  const BERKAS = path.join(DIR, 'listing-pantau.json');

  /* 20 per pengguna. Bukan angka keramat: satu putaran memeriksa 8 baris,
     jadi 20 baris selesai dalam tiga putaran (~4,5 menit) dan masih jauh
     di bawah 30 permintaan/menit yang diizinkan GeckoTerminal gratis. */
  const MAKS = 20;

  function baca() {
    try { return JSON.parse(fs.readFileSync(BERKAS, 'utf8')); } catch (e) { return {}; }
  }
  function tulis(d) {
    const semen = BERKAS + '.tmp';
    fs.writeFileSync(semen, JSON.stringify(d, null, 2));
    fs.renameSync(semen, BERKAS);
  }

  /* ── Kolam terdalam untuk satu alamat token ─────────────────────────────
     GeckoTerminal mengembalikan SEMUA kolam token itu, dan untuk token yang
     baru listing jumlahnya bisa belasan — kebanyakan kolam sampah dengan
     likuiditas beberapa dolar yang dibuat bot dalam menit yang sama.

     Yang dipilih yang likuiditasnya paling dalam. Bukan yang pertama, bukan
     yang harganya paling tinggi: kolam dangkal memberi harga yang tidak
     bisa dipakai siapa pun untuk membeli lebih dari beberapa dolar, dan
     memajangnya sebagai "harga listing" adalah kabar bohong yang terlihat
     persis seperti kabar baik. */
  async function cariKolam(jaringan, alamat) {
    const r = await axios.get(`${GT}/networks/${jaringan}/tokens/${alamat}/pools`, {
      timeout: 15000,
      headers: { accept: 'application/json' },
      validateStatus: (s) => s === 200 || s === 404,
    });
    if (r.status === 404) return null;                 // belum ada kolam sama sekali

    const kolam = (r.data && r.data.data) || [];
    if (!kolam.length) return null;

    const terdalam = kolam.reduce((a, b) =>
      Number(b.attributes?.reserve_in_usd || 0) > Number(a.attributes?.reserve_in_usd || 0) ? b : a);
    const t = terdalam.attributes || {};

    return {
      kolam: t.address || String(terdalam.id || '').split('_').pop() || '',
      nama: t.name || '',
      dex: terdalam.relationships?.dex?.data?.id || '',
      harga: Number(t.base_token_price_usd) || 0,
      likuiditas: Number(t.reserve_in_usd) || 0,
      volume24: Number(t.volume_usd?.h24) || 0,
      fdv: Number(t.fdv_usd) || 0,
      /* Umur kolam dari rantainya sendiri, bukan dari kapan KITA melihatnya.
         Bedanya penting: kalau selisihnya jauh, berarti pemantau terlambat
         dan pemakainya berhak tahu bahwa ia bukan orang pertama. */
      dibuatKolam: t.pool_created_at ? Date.parse(t.pool_created_at) : 0,
      jumlahKolam: kolam.length,
    };
  }

  /* ── Fakta keamanan, bukan vonis ────────────────────────────────────────
     GoPlus memberi belasan penanda; yang diambil hanya yang bisa dijelaskan
     dalam satu kalimat kepada orang yang sedang buru-buru.

     TIDAK ada skor gabungan dan tidak ada label "aman". Sudah terbukti di
     sesi ini bahwa TRUMP yang asli — yang resmi, yang benar — punya 89,8%
     pasokan di sepuluh dompet teratas, angka yang akan ditandai merah oleh
     penyaring naif mana pun. Yang bisa diberikan mesin cuma faktanya;
     kesimpulannya milik orang yang menanggung risikonya. */
  async function periksaAman(jaringan, alamat) {
    const j = JARINGAN[jaringan];
    if (!j) return null;

    const url = j.goplus === 'solana'
      ? `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${alamat}`
      : `https://api.gopluslabs.io/api/v1/token_security/${j.goplus}?contract_addresses=${alamat.toLowerCase()}`;

    const r = await axios.get(url, { timeout: 15000 });
    const hasil = r.data && r.data.result;
    if (!hasil) return null;
    const d = hasil[alamat] || hasil[alamat.toLowerCase()] || Object.values(hasil)[0];
    if (!d) return null;

    const ya = (v) => v === '1' || v === 1 || v === true;
    const angka = (v) => (v == null || v === '' ? null : Number(v));

    return {
      diperiksa: Date.now(),
      /* Bisa dicetak lagi sesuka pembuatnya — pasokan yang hari ini terbatas
         bisa jadi tak terbatas besok. */
      bisaCetak: ya(d.mintable?.status ?? d.is_mintable),
      /* Saldo dompet mana pun bisa dibekukan pembuatnya. */
      bisaBekukan: ya(d.freezable?.status ?? d.cannot_sell_all ?? d.is_blacklisted),
      /* Kontraknya masih bisa diubah isinya sesudah kamu membeli. */
      bisaDiubah: ya(d.upgradeable?.status ?? d.can_take_back_ownership),
      pajakBeli: angka(d.buy_tax),
      pajakJual: angka(d.sell_tax),
      /* Persentase pasokan di sepuluh dompet teratas. Tinggi TIDAK sama
         dengan penipuan — proyek resmi sering menahan mayoritas pasokannya
         di dompet tim yang terkunci. Yang diberitahukan cuma angkanya. */
      terpusat: (() => {
        const h = d.holders || d.lp_holders || [];
        if (!Array.isArray(h) || !h.length) return null;
        const jum = h.slice(0, 10).reduce((a, x) => a + (Number(x.percent) || 0), 0);
        return Math.round(jum * 1000) / 10;
      })(),
      pemegang: angka(d.holder_count),
      namaAsli: d.token_name || d.metadata?.name || '',
      simbolAsli: d.token_symbol || d.metadata?.symbol || '',
    };
  }

  /* ══ SATU BARIS DIPERIKSA ══════════════════════════════════════════════
     Mengembalikan true kalau ADA yang berubah dan berkasnya perlu ditulis.
     Dipisah dari putaran supaya rute "periksa sekarang" memakai jalur yang
     sama persis — pemeriksaan manual yang berbeda dari yang otomatis akan
     memberi dua jawaban berbeda untuk satu pertanyaan. */
  async function periksaBaris(b) {
    b.diperiksa = Date.now();
    b.galat = '';

    let k;
    try {
      k = await cariKolam(b.jaringan, b.alamat);
    } catch (e) {
      /* Jaringan bermasalah BUKAN "belum listing". Dibedakan supaya baris
         yang gagal diperiksa tidak terbaca sebagai baris yang sudah
         diperiksa dan ternyata sepi. */
      b.galat = String(e.message || e).slice(0, 120);
      return true;
    }

    if (!k) {
      b.putaran = (b.putaran || 0) + 1;
      return true;
    }

    /* Kolam yang likuiditasnya di bawah $500 tidak dihitung listing.
       Bukan kesombongan angka: token presale sering punya kolam benih
       beberapa dolar berhari-hari sebelum listing sungguhan, dan alarm yang
       berbunyi untuk itu akan melatih pemiliknya mengabaikan alarm. */
    if (k.likuiditas < 500 && b.status !== 'listing') {
      b.putaran = (b.putaran || 0) + 1;
      b.benih = { likuiditas: k.likuiditas, dibuatKolam: k.dibuatKolam };
      return true;
    }

    const baru = b.status !== 'listing';
    b.status = 'listing';
    b.pasar = k;
    if (baru) {
      b.listingKetahuan = Date.now();
      b.dibaca = false;                       // memicu alarm di layar
      if (!b.simbol && k.nama) b.simbol = String(k.nama).split('/')[0].trim();
    }
    /* Harga tertinggi yang pernah TERLIHAT pemantau — bukan tertinggi
       sesungguhnya. Dibedakan namanya (`puncakTerlihat`) supaya tidak ada
       yang mengira ini data candle. */
    if (!b.puncakTerlihat || k.harga > b.puncakTerlihat.harga) {
      b.puncakTerlihat = { harga: k.harga, waktu: Date.now() };
    }
    return true;
  }

  /* ══ PUTARAN PEMANTAU ══════════════════════════════════════════════════
     Yang paling lama tidak diperiksa duluan. Antrean adil ini yang membuat
     satu baris tidak pernah kelaparan walau daftarnya panjang.

     Baris yang SUDAH listing tetap ikut diperiksa, tapi jarang: harganya
     masih berguna (kelipatan terhadap harga presale terus bergerak), namun
     ia bukan lagi hal yang ditunggu. */
  async function putaran() {
    const semua = baca();
    const antre = [];
    for (const uid of Object.keys(semua)) {
      for (const b of semua[uid] || []) {
        if (b.status === 'berhenti') continue;
        const jeda = b.status === 'listing' ? 15 * 60 * 1000 : 0;
        if (Date.now() - (b.diperiksa || 0) < jeda) continue;
        antre.push(b);
      }
    }
    if (!antre.length) return;

    antre.sort((a, c) => (a.diperiksa || 0) - (c.diperiksa || 0));
    const giliran = antre.slice(0, 8);

    let berubah = false;
    for (const b of giliran) {
      try { if (await periksaBaris(b)) berubah = true; } catch (e) { /* baris ini saja */ }
    }
    if (berubah) tulis(semua);
  }

  if (!putaranJalan) {
    putaranJalan = true;
    /* 90 detik. Kolam terbaca ~2 menit sesudah dibuat, jadi menembak lebih
       rapat dari itu cuma membakar kuota untuk jawaban yang belum berubah. */
    setInterval(() => { putaran().catch(() => {}); }, 90 * 1000);
    setTimeout(() => { putaran().catch(() => {}); }, 8000);
  }

  /* ── Baris milikku saja ────────────────────────────────────────────── */
  function milikku(req) {
    const semua = baca();
    return { semua, daftar: semua[req.uid] || [] };
  }

  app.get('/api/listing', batasLaju, butuhLogin, (req, res) => {
    const { daftar } = milikku(req);
    res.json({ ok: true, daftar, jaringan: JARINGAN, maks: MAKS });
  });

  app.post('/api/listing', batasLaju, butuhLogin, express.json(), (req, res) => {
    const b = req.body || {};
    const jaringan = String(b.jaringan || '').trim();
    const alamat = String(b.alamat || '').trim();

    if (!JARINGAN[jaringan]) return res.status(400).json({ error: 'Jaringan tidak dikenal.' });
    if (!alamatSah(jaringan, alamat)) {
      return res.status(400).json({
        error: JARINGAN[jaringan].pola === 'evm'
          ? 'Alamat kontrak EVM harus 0x diikuti 40 karakter heksadesimal.'
          : 'Alamat token Solana harus 32–44 karakter base58.',
      });
    }

    const { semua, daftar } = milikku(req);
    const adaIdx = daftar.findIndex((x) => x.alamat === alamat && x.jaringan === jaringan);
    if (adaIdx < 0 && daftar.length >= MAKS) {
      return res.status(400).json({ error: `Maksimal ${MAKS} koin dipantau sekaligus.` });
    }

    const bersih = {
      nama: String(b.nama || '').slice(0, 60).trim(),
      simbol: String(b.simbol || '').slice(0, 20).trim().toUpperCase(),
      catatan: String(b.catatan || '').slice(0, 300).trim(),
      beliUsd: Math.max(0, Number(b.beliUsd) || 0),
      beliToken: Math.max(0, Number(b.beliToken) || 0),
    };

    if (adaIdx >= 0) {
      Object.assign(daftar[adaIdx], bersih);
    } else {
      daftar.push({
        alamat, jaringan, ...bersih,
        status: 'pantau',
        dibuat: Date.now(),
        diperiksa: 0,
        putaran: 0,
      });
    }
    semua[req.uid] = daftar;
    tulis(semua);
    res.json({ ok: true, daftar });
  });

  app.delete('/api/listing/:jaringan/:alamat', batasLaju, butuhLogin, (req, res) => {
    const { semua, daftar } = milikku(req);
    semua[req.uid] = daftar.filter(
      (x) => !(x.alamat === req.params.alamat && x.jaringan === req.params.jaringan));
    tulis(semua);
    res.json({ ok: true, daftar: semua[req.uid] });
  });

  /* Periksa SEKARANG — jalur yang sama dengan pemantau otomatis. Ada karena
     menunggu 90 detik untuk tahu apakah alamat yang baru ditempel sudah
     benar terasa seperti kerusakan, walau bukan. */
  app.post('/api/listing/periksa', batasLaju, butuhLogin, express.json(), async (req, res) => {
    const { semua, daftar } = milikku(req);
    const b = daftar.find((x) => x.alamat === req.body?.alamat && x.jaringan === req.body?.jaringan);
    if (!b) return res.status(404).json({ error: 'Baris tidak ditemukan.' });
    try {
      await periksaBaris(b);
      tulis(semua);
      res.json({ ok: true, baris: b });
    } catch (e) {
      res.status(502).json({ error: String(e.message || e).slice(0, 200) });
    }
  });

  /* Fakta keamanan ditarik atas permintaan, bukan tiap putaran: jawabannya
     nyaris tidak pernah berubah, dan GoPlus punya kuotanya sendiri. */
  app.post('/api/listing/aman', batasLaju, butuhLogin, express.json(), async (req, res) => {
    const { semua, daftar } = milikku(req);
    const b = daftar.find((x) => x.alamat === req.body?.alamat && x.jaringan === req.body?.jaringan);
    if (!b) return res.status(404).json({ error: 'Baris tidak ditemukan.' });
    try {
      b.aman = await periksaAman(b.jaringan, b.alamat);
      if (!b.aman) b.aman = { diperiksa: Date.now(), kosong: true };
      tulis(semua);
      res.json({ ok: true, aman: b.aman });
    } catch (e) {
      res.status(502).json({ error: String(e.message || e).slice(0, 200) });
    }
  });

  /* Alarm dimatikan setelah dilihat. Dipisah dari POST biasa supaya
     membaca alarm tidak bisa diam-diam mengubah harga belinya. */
  app.post('/api/listing/dibaca', batasLaju, butuhLogin, express.json(), (req, res) => {
    const { semua, daftar } = milikku(req);
    for (const b of daftar) {
      if (!req.body?.alamat || b.alamat === req.body.alamat) b.dibaca = true;
    }
    tulis(semua);
    res.json({ ok: true, daftar });
  });
};
