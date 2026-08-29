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
  app.get('/api/agen/wallet', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
    const p = baca(PANTAU, { dompet: [] });
    const a = baca(AKTIVITAS, { log: [], posisi: [], denyut: 0, galat: '' });
    res.json({
      ok: true,
      dompet: p.dompet || [],
      log: a.log || [],
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
  app.get('/api/agen/wallet/peringkat', batasLaju, butuhLogin, hanyaPemilik, (req, res) => {
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
      }));

    res.json({
      ok: true, jendela, pita: String(q.pita || 'semua'),
      diperbarui: p.diperbarui || 0,
      total: p.total || 0,
      minAkun: p.minAkun || 0,
      daftar,
    });
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
/* 1000 baris ≈ 250 KB — masih berkas kecil, tapi cukup panjang untuk
   menampung beberapa dompet ramai tanpa yang satu menghapus jejak yang
   lain. Batasnya ada supaya berkasnya tidak tumbuh tanpa akhir, bukan
   supaya daftarnya pendek. */
const AKTIVITAS_MAKS = 1000;

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

  if (Array.isArray(baris.log) && baris.log.length) {
    /* Yang terbaru di depan, dan diurutkan ULANG sesudah digabung: satu
       putaran pindai bisa memulangkan beberapa transaksi sekaligus dari
       dompet yang berbeda, dan urutan kedatangannya bukan urutan waktunya. */
    d.log = [...baris.log, ...d.log].sort((a, b) => b.waktu - a.waktu).slice(0, AKTIVITAS_MAKS);
  }
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
    for (const l of (d.log || [])) {
      if (!peta[l.alamat] || l.waktu > peta[l.alamat]) peta[l.alamat] = l.waktu;
    }
  } catch (e) { /* belum ada */ }
  return peta;
};
