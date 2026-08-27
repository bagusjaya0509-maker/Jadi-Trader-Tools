/* ══════════════════════════════════════════════════════════════════════════
   pengikut-copy-vps.js — pengikut Copy Signal yang hidup di server, 24 jam
   ══════════════════════════════════════════════════════════════════════════
   Versi peramban (src/lib/pengikut-copy.ts) berjalan hanya selama tab
   aplikasinya terbuka — sinyal yang terbit saat semua tab tertutup tidak
   pernah tersalin. Modul ini memindahkan pengikutnya ke tempat kartu
   sinyalnya sudah tinggal: server ini sendiri.

   HANYA UNTUK SATU UID (pemilik). Itu bukan kemalasan, itu keputusan:
   begitu server mengeksekusi order uang nyata untuk PENGGUNA UMUM, posisi
   platform bergeser dari penyedia alat ke penyelenggara copy trading —
   wilayah OJK/Bappebti yang harus ditinjau dulu sebagai keputusan bisnis
   tersendiri. Batasnya ditegakkan di KODE (uid diperiksa di tiap rute dan
   di putarannya), bukan cuma di halaman yang tidak menampilkan tombolnya.

   ── PAGAR YANG SAMA DENGAN VERSI PERAMBAN, dipindah utuh ────────────────
   1. Hanya analis yang didaftar, hanya Trade-Fi (USDT dilewati).
   2. Hanya sinyal yang terbit SESUDAH langganannya dimulai.
   3. Sekali per sinyal — ditandai tepat sebelum perintahnya diantrekan.
   4. Lot dihitung dari batas rugi dolar pemilik, bukan lot analis;
      kontrak dari PASANGAN SINYALNYA (pelajaran 26 Agu: kontrak beku dari
      langganan membuat lot salah seribu kali lipat).
   5. Sisi SL/TP diperiksa ulang — tidak ada manusia yang menatap layar.
   6. Sinyal yang ditarik analisnya ditarik juga di sini: pending
      dibatalkan, posisi yang terlanjur terisi ditutup di harga pasar.
   7. Sakelar jeda. Fitur yang mengirim uang tanpa diminta per-order wajib
      punya satu tombol yang menghentikannya seketika.

   ── KENAPA MENULIS LANGSUNG KE ANTREAN, bukan lewat HTTP sendiri ────────
   Rute /api/mt5/perintah/kirim menuntut sesi Firebase, dan server memang
   sengaja tidak memegang kredensial pengguna mana pun. Modul ini tinggal
   satu proses dengan antreannya, jadi ia menulis langsung ke mt5.json —
   jalur yang sama yang dipakai mt5agen.js, dengan pagar lot yang sama.
   ══════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = (app, { butuhLogin, batasLaju, express, DIR }) => {
  const UID = process.env.PENGIKUT_UID || process.env.PORTO_UID || '';
  const BERKAS = path.join(DIR, 'pengikut-copy.json');
  const MT5 = path.join(DIR, 'mt5.json');
  const ANALISA = path.join(DIR, 'analisa.json');
  /* Sabuk pengaman terakhir. Batas rugi sudah membatasi lot secara wajar;
     angka ini menangkap keadaan yang tidak wajar — spesifikasi simbol yang
     salah tebak, batas rugi yang salah ketik nol-nya. */
  const MAKS_LOT = Number(process.env.PENGIKUT_MAKS_LOT || 1);
  const JEDA_MS = 60_000;

  if (!UID) {
    console.log('[pengikut] PENGIKUT_UID/PORTO_UID kosong — pengikut server tidak aktif.');
    return;
  }

  /* ── keadaan ─────────────────────────────────────────────────────────── */
  function baca() {
    try {
      const j = JSON.parse(fs.readFileSync(BERKAS, 'utf8'));
      return {
        jalan: j.jalan !== false,
        langganan: j.langganan || {},
        sudah: Array.isArray(j.sudah) ? j.sudah : [],
        tanda: Array.isArray(j.tanda) ? j.tanda : [],
        log: Array.isArray(j.log) ? j.log : [],
        pindai: Number(j.pindai) || 0,
      };
    } catch (e) {
      return { jalan: true, langganan: {}, sudah: [], tanda: [], log: [], pindai: 0 };
    }
  }
  function tulis(d) {
    const tmp = BERKAS + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
    fs.renameSync(tmp, BERKAS);
  }
  function bacaMt5() { try { return JSON.parse(fs.readFileSync(MT5, 'utf8')); } catch (e) { return {}; } }
  function tulisMt5(d) {
    const tmp = MT5 + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
    fs.renameSync(tmp, MT5);
  }
  function bacaAnalisa() {
    try {
      const j = JSON.parse(fs.readFileSync(ANALISA, 'utf8'));
      return Array.isArray(j.daftar) ? j.daftar : [];
    } catch (e) { return []; }
  }

  /* Catatan kejadian — alasan tiap sinyal terkirim/dilewati/gagal, karena
     "tidak terjadi apa-apa" punya sepuluh sebab yang berbeda dan pemiliknya
     harus bisa membedakannya dari layar. Sebab yang sama untuk sinyal yang
     sama tidak ditulis ulang tiap menit. */
  function catat(d, e) {
    const akhir = d.log[d.log.length - 1];
    if (akhir && akhir.sinyal === e.sinyal && akhir.sebab === e.sebab) return;
    d.log.push({ waktu: Date.now(), ...e });
    d.log = d.log.slice(-60);
  }

  /* ── salinan kecil dari ukuran-posisi.ts — dua sisi WAJIB seirama ────── */
  function kontrakBawaan(pasangan) {
    const s = String(pasangan || '').replace(/^MT5:/i, '').toUpperCase();
    if (s.startsWith('XAU')) return 100;
    if (s.startsWith('XAG')) return 5000;
    return 100000;
  }
  const bulatkanLot = (x) => Math.max(0, Math.floor(x * 100) / 100);

  function terminalPemilik(m) {
    const semua = (m.data || {})[UID] || {};
    const daftar = Object.keys(semua);
    if (!daftar.length) return null;
    const login = daftar.sort((a, b) => (Number(semua[b].diterima) || 0) - (Number(semua[a].diterima) || 0))[0];
    return { login, ...semua[login] };
  }

  function antrekan(m, login, perintah) {
    if (!m.perintah) m.perintah = {};
    if (!m.perintah[UID]) m.perintah[UID] = {};
    const antre = m.perintah[UID][login] || [];
    const id = 'p' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
    antre.push({ id, tiket: '', sl: 0, tp: 0, lot: 0, simbol: '', arah: '', entry: 0,
                 ...perintah, status: 'antre', dibuat: Date.now(), pesan: '', oleh: 'pengikut' });
    m.perintah[UID][login] = antre.slice(-50);
    return id;
  }

  /* Harga acuan dari lilin 1m terakhir di feed mana pun yang punya
     simbolnya. Kasarnya boleh beberapa menit — pagar yang memakainya
     menoleransi setengah sampai dua kali, bukan pip. */
  function hargaAcuanKasar(dasar) {
    try {
      const k = JSON.parse(fs.readFileSync(path.join(DIR, 'mt5-klines.json'), 'utf8'));
      for (const uid of Object.keys(k)) {
        for (const lg of Object.keys(k[uid] || {})) {
          for (const sim of Object.keys(k[uid][lg] || {})) {
            if (sim !== dasar && !sim.startsWith(dasar)) continue;
            const b = k[uid][lg][sim]['1m'] || k[uid][lg][sim]['5m'];
            const d = b && b.data;
            if (Array.isArray(d) && d.length) {
              const c = Number(d[d.length - 1][4]);
              if (c > 0) return c;
            }
          }
        }
      }
    } catch (e) { /* berkasnya sedang ditulis — putaran depan */ }
    return null;
  }

  function cariPerintah(m, id) {
    const per = (m.perintah || {})[UID] || {};
    for (const lg of Object.keys(per)) {
      const c = (per[lg] || []).find((x) => x.id === id);
      if (c) return c;
    }
    return null;
  }

  /* ── satu putaran ────────────────────────────────────────────────────── */
  let sibuk = false;
  function putaran() {
    if (sibuk) return;
    sibuk = true;
    try {
      const d = baca();
      const adaLangganan = Object.keys(d.langganan).length > 0;
      const adaTanda = d.tanda.length > 0;
      if (!d.jalan || (!adaLangganan && !adaTanda)) { sibuk = false; return; }

      const m = bacaMt5();
      const t = terminalPemilik(m);
      const umurMenit = t && t.diterima ? (Date.now() - t.diterima) / 60000 : 9999;
      /* EA mati = tidak ada terminal yang bisa menerima perintah. Perintah
         yang diantrekan sekarang cuma kedaluwarsa 5 menit kemudian; lebih
         jujur diam dan MENCATAT diamnya. */
      if (!t || umurMenit > 5) {
        catat(d, { sinyal: '-', pasangan: '-', analis: '-', hasil: 'dilewati',
          sebab: 'Terminal MT5 belum melapor — EA mati atau MetaTrader tertutup. Tidak ada yang bisa dikirim.' });
        d.pindai = Date.now(); tulis(d); sibuk = false; return;
      }
      const jenisCent = /cent|USC/i.test(String((t.akun || {}).mataUang || ''));

      const semua = bacaAnalisa();
      let adaAntrean = false;

      /* A. Nasib perintah yang sudah berangkat — dilaporkan sekali. */
      for (const td of d.tanda) {
        if (td.hasilDicatat || !td.idPerintah) continue;
        const c = cariPerintah(m, td.idPerintah);
        if (!c) { td.hasilDicatat = true; continue; }
        if (c.status === 'sukses') {
          td.hasilDicatat = true;
          if (c.tiket) td.tiket = String(c.tiket);
          catat(d, { sinyal: td.sinyal || '-', pasangan: td.simbol, analis: td.analis, hasil: 'terkirim',
            sebab: `${td.aksi === 'TUTUP' ? 'Pembatalan' : td.arah + ' ' + td.lot + ' lot'} ${td.simbol} — ${c.pesan || 'dieksekusi EA'}` });
        } else if (c.status === 'gagal' || c.status === 'kedaluwarsa') {
          td.hasilDicatat = true;
          catat(d, { sinyal: td.sinyal || '-', pasangan: td.simbol, analis: td.analis, hasil: 'gagal',
            sebab: `${td.simbol}: ${c.pesan || c.status}` });
        }
      }

      /* B. Ikat tiket untuk salinan yang belum punya — dari laporan EA,
         dicocokkan simbol+arah+lot. Levelnya sengaja BUKAN sidiknya:
         menggeser stop itu wajar pada posisi salinan. */
      const terpakai = new Set(d.tanda.map((x) => x.tiket).filter(Boolean));
      for (const td of d.tanda) {
        if (td.tiket || td.aksi === 'TUTUP') continue;
        const calon = [...(t.pending || []), ...(t.posisi || [])].find((p) =>
          !terpakai.has(String(p.tiket))
          && String(p.arah).toUpperCase() === td.arah
          && Math.abs(Number(p.lot) - td.lot) < 0.005
          && String(p.simbol).toUpperCase() === String(td.simbol).toUpperCase());
        if (calon) { td.tiket = String(calon.tiket); terpakai.add(td.tiket); }
      }

      /* C. Sinyal baru → salin. Terlama duluan, urutan analisnya. */
      const kandidat = semua
        .filter((s) => d.langganan[s.uid])
        .filter((s) => !d.sudah.includes(s.id))
        .filter((s) => !/USDT$/i.test(s.pasangan))
        .filter((s) => s.hasil !== 'sl' && s.hasil !== 'tp' && s.hasil !== 'batal');

      /* Yang terbit SEBELUM langganan dilewati — itu pagar #2 dan tetap
         berdiri. Tapi dilewati DENGAN SUARA: pemilik pernah menunggu
         salinan dari sinyal yang diposting tiga menit sebelum ia menekan
         Ikuti, dan tidak ada satu baris pun yang menjelaskan kenapa
         terminalnya diam. Aturan yang tidak kelihatan tidak bisa
         dibedakan dari kerusakan. Dedup log menahan banjirnya. */
      for (const s of kandidat) {
        if (Number(s.dibuat) > Number(d.langganan[s.uid].sejak || 0)) continue;
        catat(d, { sinyal: s.id, pasangan: s.pasangan, analis: d.langganan[s.uid].analisNama || 'Analis',
          hasil: 'dilewati', sebab: 'Terbit sebelum kamu menekan Ikuti — hanya sinyal baru yang disalin, riwayat tidak.' });
      }

      const antre = kandidat
        .filter((s) => Number(s.dibuat) > Number(d.langganan[s.uid].sejak || 0))
        .sort((a, b) => a.dibuat - b.dibuat);

      for (const s of antre) {
        const l = d.langganan[s.uid];
        const jejak = { sinyal: s.id, pasangan: s.pasangan, analis: l.analisNama || 'Analis' };
        const isi = s.isi || {};
        const entry = Number(isi.entry) || 0;
        const sl = Number(isi.sl) || 0;
        const tp = Number(isi.tp) || 0;
        if (!(entry > 0) || !(sl > 0)) {
          catat(d, { ...jejak, hasil: 'dilewati', sebab: 'Sinyalnya belum punya entry dan SL yang bisa dihitung.' });
          continue;
        }
        const benar = s.arah === 'BUY'
          ? sl < entry && (!tp || tp > entry)
          : sl > entry && (!tp || tp < entry);
        if (!benar) {
          catat(d, { ...jejak, hasil: 'dilewati', sebab: 'SL/TP sinyalnya ada di sisi yang salah terhadap entry.' });
          continue;
        }
        const dasar = String(s.pasangan).replace(/^MT5:/i, '').toUpperCase();
        /* Nama broker: laporan EA yang tahu. Dicari yang persis, lalu yang
           dasar-nya cocok (XAUUSD → XAUUSDc). Kalau terminal belum pernah
           melaporkan simbolnya sama sekali, EA tetap dicoba dengan nama
           dasar — Market Watch bisa punya simbol yang belum pernah muncul
           di laporan posisi. */
        const dikenal = [...(t.posisi || []), ...(t.pending || [])]
          .map((p) => String(p.simbol)).find((x) => {
            const X = x.toUpperCase();
            return X === dasar || X.replace(/[a-z]+$/,'').toUpperCase() === dasar || X.startsWith(dasar);
          });
        const simbol = dikenal || dasar;

        /* PAGAR KEWAJARAN HARGA. Sinyal "jangan lupa FM" ditulis dengan
           titik ribuan yang salah urai: entry 4,626 di pasar 4.634. Kalau
           sinyal seperti itu lolos ke sini, jarak SL 0,01 dolar membuat
           lot = rugiMaks/jarak meledak ke MAKS_LOT — dan yang terpasang
           adalah pending 1 lot di harga yang tidak akan pernah datang.
           Sinyal yang levelnya di luar setengah–dua kali harga pasar
           bukan rencana yang bisa diikuti; ia salah ketik. */
        const acuan = hargaAcuanKasar(dasar);
        if (acuan && (entry / acuan < 0.5 || entry / acuan > 2)) {
          catat(d, { ...jejak, hasil: 'dilewati',
            sebab: `Entry ${entry} terlalu jauh dari harga pasar ${dasar} (±${acuan}) — kemungkinan salah tulis angka, tidak disalin.` });
          continue;
        }

        const kontrak = kontrakBawaan(dasar) / (jenisCent ? 100 : 1);
        const jarak = Math.abs(entry - sl);
        const lot = Math.min(bulatkanLot((Number(l.rugiMaks) || 0) / (kontrak * jarak)), MAKS_LOT);
        if (lot < 0.01) {
          catat(d, { ...jejak, hasil: 'dilewati',
            sebab: `Batas rugi $${l.rugiMaks} terlalu kecil untuk jarak SL sinyal ini — lotnya membulat ke nol.` });
          continue;
        }

        /* Ditandai TEPAT SEBELUM diantrekan — bukan di awal putaran (satu
           kegagalan sementara tidak boleh membakar sinyal selamanya), dan
           bukan sesudahnya (proses yang mati di tengah tidak boleh membuat
           order kedua saat hidup lagi). */
        d.sudah.push(s.id);
        d.sudah = d.sudah.slice(-500);
        const id = antrekan(m, t.login, { aksi: 'BUKA', simbol, arah: s.arah, lot, sl, tp, entry });
        adaAntrean = true;
        d.tanda.push({ sinyal: s.id, simbol, arah: s.arah, lot, analis: jejak.analis,
                       aksi: 'BUKA', idPerintah: id, waktu: Date.now() });
        d.tanda = d.tanda.slice(-200);
        catat(d, { ...jejak, hasil: 'terkirim', sebab: `${s.arah} ${lot} lot ${simbol} diantrekan — menunggu EA.` });
      }

      /* D. Sinyal yang ditarik analisnya → salinannya ikut ditarik.
         Pending dibatalkan; posisi yang terlanjur terisi ditutup di harga
         pasar — salinan yang analisnya sudah pergi adalah posisi yang tidak
         ada lagi yang memantaunya (keputusan pemilik, 26 Agu 2026). */
      const batalSet = new Set(semua.filter((s) => s.hasil === 'batal').map((s) => s.id));
      for (const td of d.tanda) {
        if (td.aksi !== 'BUKA' || td.batalSelesai || !td.sinyal || !batalSet.has(td.sinyal)) continue;
        if (!td.tiket) { td.batalSelesai = true; continue; } // tidak pernah terisi/terikat — tidak ada yang bisa ditarik
        const hidup = [...(t.pending || []), ...(t.posisi || [])].some((p) => String(p.tiket) === td.tiket);
        if (!hidup) { td.batalSelesai = true; continue; }
        const id = antrekan(m, t.login, { aksi: 'TUTUP', tiket: td.tiket });
        adaAntrean = true;
        td.batalSelesai = true;
        d.tanda.push({ sinyal: td.sinyal, simbol: td.simbol, arah: td.arah, lot: td.lot,
                       analis: td.analis, aksi: 'TUTUP', idPerintah: id, waktu: Date.now() });
        catat(d, { sinyal: td.sinyal, pasangan: td.simbol, analis: td.analis, hasil: 'terkirim',
          sebab: `Analis menarik sinyalnya — #${td.tiket} diminta ditutup/dibatalkan.` });
      }

      if (adaAntrean) tulisMt5(m);
      d.pindai = Date.now();
      tulis(d);
    } catch (e) {
      console.error('[pengikut] putaran gagal (lanjut menit depan):', e && e.message);
    } finally { sibuk = false; }
  }

  setInterval(putaran, JEDA_MS);
  setTimeout(putaran, 5000);

  /* ── rute — semuanya milik UID pengikut saja ─────────────────────────── */
  function hanyaPemilik(req, res, next) {
    if (req.uid !== UID) return res.status(403).json({ error: 'Pengikut server hanya untuk akun pemilik.' });
    next();
  }

  app.get('/api/copy/pengikut', batasLaju, butuhLogin, (req, res) => {
    if (req.uid !== UID) return res.json({ aktif: false });
    const d = baca();
    res.json({
      aktif: true, jalan: d.jalan, pindai: d.pindai,
      langganan: Object.entries(d.langganan).map(([uid, l]) => ({ analisUid: uid, ...l })),
      log: d.log.slice().reverse(),
      /* Tanda salinan ikut dikirim supaya tabel posisi bisa menempelkan
         ikon copy pada tiket yang dibuka PENGIKUT SERVER. Catatan peramban
         hanya tahu salinan yang dikirim peramban sendiri — dua pencatat
         yang tidak saling membaca membuat ikonnya hilang justru pada
         salinan yang paling otomatis. */
      tanda: d.tanda
        .filter((t) => t.aksi === 'BUKA' && t.tiket)
        .map((t) => ({ tiket: t.tiket, analis: t.analis, simbol: t.simbol, arah: t.arah, lot: t.lot })),
    });
  });

  app.post('/api/copy/pengikut/langganan', batasLaju, butuhLogin, hanyaPemilik, express.json(), (req, res) => {
    const b = req.body || {};
    const d = baca();
    if (b.hapus) {
      delete d.langganan[String(b.hapus)];
      tulis(d);
      return res.json({ ok: true });
    }
    const analisUid = String(b.analisUid || '');
    const rugiMaks = Number(b.rugiMaks);
    if (!analisUid || !(rugiMaks > 0)) return res.status(400).json({ error: 'analisUid dan rugiMaks wajib.' });
    /* `sejak` dipertahankan saat setelannya cuma diubah: memperbaruinya
       akan membuat sinyal di antara dua penyimpanan tidak pernah disalin. */
    const lama = d.langganan[analisUid];
    d.langganan[analisUid] = {
      analisNama: String(b.analisNama || 'Analis').slice(0, 40),
      rugiMaks,
      sejak: lama ? lama.sejak : Date.now(),
    };
    tulis(d);
    res.json({ ok: true });
  });

  app.post('/api/copy/pengikut/jalan', batasLaju, butuhLogin, hanyaPemilik, express.json(), (req, res) => {
    const d = baca();
    d.jalan = req.body && req.body.jalan !== false;
    tulis(d);
    res.json({ ok: true, jalan: d.jalan });
  });

  console.log(`[pengikut] siap — uid ${UID.slice(0, 8)}…, pindai tiap ${JEDA_MS / 1000}s, maks lot ${MAKS_LOT}`);
};
