/* ══════════════════════════════════════════════════════════════════════════
   PENJAGA RISIKO — pengingat batas trading di lonceng
   ══════════════════════════════════════════════════════════════════════════
   Diminta pemilik 30 Sep 2026: "jika posisi saya overtrade atau floatingnya
   terlalu besar berikan notifikasi di lonceng dan berikan pop up ... biar
   saya ingat batasan untuk trading. Untuk parameter penilaiannya saya rasa
   kamu lebih tahu."

   Berkas ini TIDAK menyentuh order apa pun. Ia cuma membaca saldo dan
   posisi, lalu menaruh kabar pribadi di lonceng pemilik. Kekeliruan
   terburuknya adalah pengingat yang salah waktu, bukan uang yang hilang —
   karena itu ia boleh jalan tanpa pagar setebal sapu-stop.js.

   Jalan di VPS, bukan di peramban: pengingat yang cuma bekerja selagi tab
   terbuka tidak mengingatkan apa-apa pada saat paling perlu, yaitu ketika
   orangnya sedang tidak melihat layar.

   ── LIMA ATURAN, DAN KENAPA ANGKANYA SEGITU ─────────────────────────────
   "Modal" = saldo dompet Binance + saldo Hyperliquid + saldo MT5 (kalau
   laporan EA-nya segar). Saldo, bukan ekuitas: batas yang ikut menyusut
   saat floating membesar justru melonggar di saat yang salah.

   1. FLOATING TOTAL — rugi mengambang BERSIH semua posisi terhadap modal.
      Waspada 3%, bahaya 6%. Patokan umum batas rugi harian 3–5%; floating
      sudah 6% berarti satu hari buruk sedang berjalan dan belum terkunci.
   2. SATU POSISI — rugi mengambang satu posisi terhadap modal. Waspada 2%,
      bahaya 4%. Aturan 1–2% per trade: posisi yang sudah lewat 2% sedang
      merugi melebihi yang wajar direncanakan untuk satu entry.
   3. JUMLAH POSISI — posisi terbuka bersamaan. Waspada 6, bahaya 10. Lewat
      lima, posisi kripto hampir selalu saling berkorelasi (ikut BTC), jadi
      yang terlihat seperti diversifikasi sebenarnya satu taruhan besar.
   4. EKSPOSUR KRIPTO — total nilai posisi kripto dibagi modal kripto.
      Waspada 3x, bahaya 5x. Tidak peduli leverage yang dipasang: yang
      diukur seberapa besar uang yang bergerak terhadap uang yang dimiliki.
      MT5 tidak ikut karena ukuran kontraknya tidak ada di laporan EA.
   5. ENTRY HARIAN (overtrade) — posisi baru yang terbuka hari ini (WIB).
      Waspada 6, bahaya 10. Dihitung dari posisi yang MUNCUL di antara dua
      pembacaan, jadi scalp yang buka-tutup di bawah dua menit tidak
      terhitung — angkanya batas bawah, bukan angka pasti.

   Semua angka bisa diganti lewat .env (RISIKO_*), tanpa menyunting berkas.
   Posisi dari mesin salin ikut dihitung: risikonya jatuh ke akun yang sama.

   ── SUPAYA LONCENGNYA TIDAK DIMATIKAN ORANG ─────────────────────────────
   - Berbunyi saat levelnya NAIK (aman→waspada, waspada→bahaya), bukan tiap
     putaran.
   - Diingatkan ulang paling cepat 6 jam kalau levelnya bertahan.
   - Baru dianggap pulih kalau angkanya turun di bawah 80% batas waspada.
     Tanpa jarak ini, floating yang naik-turun di 3,0% berbunyi tiap dua
     menit.
   - Satu id per aturan (dan per posisi): kabar lama DITIMPA, lonceng tidak
     menumpuk kalimat yang sama.
   ══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const BERKAS = path.join(__dirname, 'penjaga-risiko.json');
const JEDA_MS = 2 * 60 * 1000;
const INGAT_ULANG_MS = 6 * 60 * 60 * 1000;
/** Laporan EA lebih tua dari ini tidak dipakai — EA-nya sedang offline, dan
 *  floating dari laporan kemarin bukan floating. */
const MT5_SEGAR_MS = 10 * 60 * 1000;
/** Pembacaan terakhir sebuah bursa lebih tua dari ini = daftar posisinya
 *  disemai ulang tanpa dihitung sebagai entry baru (server baru menyala,
 *  bursa sempat gagal dibaca lama). */
const SEMAI_ULANG_MS = 10 * 60 * 1000;
const PULIH = 0.8;

function angkaEnv(nama, bawaan) {
  const n = Number(process.env[nama]);
  return Number.isFinite(n) && n > 0 ? n : bawaan;
}
const BATAS = {
  floating: { waspada: angkaEnv('RISIKO_FLOAT_WASPADA', 3), bahaya: angkaEnv('RISIKO_FLOAT_BAHAYA', 6) },
  posisi: { waspada: angkaEnv('RISIKO_POSISI_WASPADA', 2), bahaya: angkaEnv('RISIKO_POSISI_BAHAYA', 4) },
  jumlah: { waspada: angkaEnv('RISIKO_JUMLAH_WASPADA', 6), bahaya: angkaEnv('RISIKO_JUMLAH_BAHAYA', 10) },
  eksposur: { waspada: angkaEnv('RISIKO_EKSPOSUR_WASPADA', 3), bahaya: angkaEnv('RISIKO_EKSPOSUR_BAHAYA', 5) },
  entri: { waspada: angkaEnv('RISIKO_ENTRI_WASPADA', 6), bahaya: angkaEnv('RISIKO_ENTRI_BAHAYA', 10) },
};

const PERINGKAT = { waspada: 1, bahaya: 2 };

function jam() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
function hariWib(ms) { return new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10); }
function uang(n) {
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '−$' : '$') + s;
}
function persen(n) { return (Math.round(n * 10) / 10).toFixed(1) + '%'; }
function namaBursa(b) { return b === 'binance' ? 'Binance' : b === 'hyperliquid' ? 'Hyperliquid' : 'MT5'; }

function bacaKeadaan() {
  try { return JSON.parse(fs.readFileSync(BERKAS, 'utf8')); } catch (e) { return {}; }
}
function tulisKeadaan(k) {
  try { fs.writeFileSync(BERKAS, JSON.stringify(k, null, 2)); } catch (e) { /* disk penuh — putaran berikutnya coba lagi */ }
}

/** Nilai satu aturan → level mentahnya. `tahan` = di antara batas pulih dan
 *  batas waspada: tidak berbunyi, tapi juga belum dianggap pulih. */
function levelDari(nilai, b) {
  if (nilai >= b.bahaya) return 'bahaya';
  if (nilai >= b.waspada) return 'waspada';
  if (nilai >= b.waspada * PULIH) return 'tahan';
  return null;
}

/* ── EVALUASI MURNI ──────────────────────────────────────────────────────
   Tanpa jaringan, tanpa berkas: potret + keadaan lama + jam → temuan dan
   keadaan baru. Dipisah supaya bisa diuji dengan angka karangan (lihat
   skrip/uji/uji-penjaga-risiko.js) tanpa menunggu pasar bergerak. */
function evaluasi(potret, keadaanLama, kini) {
  const k = JSON.parse(JSON.stringify(keadaanLama || {}));
  k.level = k.level || {};
  k.kunci = k.kunci || {};
  const hari = hariWib(kini);
  if (k.hari !== hari) { k.hari = hari; k.entri = 0; k.entriDaftar = []; }

  /* ── Entry baru: kunci yang muncul sejak pembacaan sebelumnya ────── */
  for (const sumber of Object.keys(potret.terbaca)) {
    if (!potret.terbaca[sumber]) continue;
    const sekarang = potret.posisi.filter((p) => p.bursa === sumber).map((p) => p.kunci);
    const lama = k.kunci[sumber];
    if (lama && kini - (lama.waktu || 0) <= SEMAI_ULANG_MS) {
      const baru = sekarang.filter((x) => !lama.daftar.includes(x));
      for (const x of baru) {
        const p = potret.posisi.find((q) => q.kunci === x);
        k.entri += 1;
        k.entriDaftar.push(p ? p.label : x);
      }
    }
    k.kunci[sumber] = { daftar: sekarang, waktu: kini };
  }

  const ukur = [];
  const modal = potret.modal;
  const sumberModal = Object.keys(potret.rincianModal).filter((s) => potret.rincianModal[s] > 0)
    .map(namaBursa).join(' + ');

  if (modal > 0) {
    const floating = potret.posisi.reduce((t, p) => t + p.pnl, 0);
    const rugiPersen = floating < 0 ? (-floating / modal) * 100 : 0;
    ukur.push({
      kunci: 'floating', aturan: 'floating', nilai: rugiPersen,
      judul: () => 'Floating loss ' + persen(rugiPersen) + ' dari modal',
      detail: () => 'Rugi mengambang bersih ' + uang(floating) + ' dari modal ' + uang(modal)
        + ' (' + sumberModal + '). Batas: waspada ' + BATAS.floating.waspada + '%, bahaya '
        + BATAS.floating.bahaya + '%.',
    });

    for (const p of potret.posisi) {
      const r = p.pnl < 0 ? (-p.pnl / modal) * 100 : 0;
      ukur.push({
        kunci: 'posisi:' + p.kunci, aturan: 'posisi', nilai: r, pair: p.simbol,
        judul: () => p.label + ' floating ' + persen(r) + ' dari modal',
        detail: () => p.label + ' ' + p.arah + ' di ' + namaBursa(p.bursa) + ': ' + uang(p.pnl)
          + ' (modal ' + uang(modal) + '). Batas satu posisi: waspada ' + BATAS.posisi.waspada
          + '%, bahaya ' + BATAS.posisi.bahaya + '%.',
      });
    }
  }

  const jml = potret.posisi.length;
  ukur.push({
    kunci: 'jumlah', aturan: 'jumlah', nilai: jml,
    judul: () => jml + ' posisi terbuka sekaligus',
    detail: () => 'Batas: waspada ' + BATAS.jumlah.waspada + ', bahaya ' + BATAS.jumlah.bahaya
      + '. Posisi kripto sebanyak ini biasanya bergerak searah BTC, jadi risikonya menumpuk jadi satu.',
  });

  const kripto = potret.posisi.filter((p) => p.bursa !== 'mt5');
  const modalKripto = (potret.rincianModal.binance || 0) + (potret.rincianModal.hyperliquid || 0);
  if (modalKripto > 0) {
    const nilaiKripto = kripto.reduce((t, p) => t + Math.abs(p.nilai), 0);
    const kali = nilaiKripto / modalKripto;
    ukur.push({
      kunci: 'eksposur', aturan: 'eksposur', nilai: kali,
      judul: () => 'Eksposur kripto ' + (Math.round(kali * 10) / 10).toFixed(1) + 'x modal',
      detail: () => 'Total nilai posisi ' + uang(nilaiKripto) + ' untuk modal kripto ' + uang(modalKripto)
        + '. Batas: waspada ' + BATAS.eksposur.waspada + 'x, bahaya ' + BATAS.eksposur.bahaya + 'x.',
    });
  }

  ukur.push({
    kunci: 'entri', aturan: 'entri', nilai: k.entri,
    judul: () => 'Overtrade: ' + k.entri + ' entry hari ini',
    detail: () => 'Batas: waspada ' + BATAS.entri.waspada + ', bahaya ' + BATAS.entri.bahaya
      + ' entry per hari (WIB). Hari ini: ' + k.entriDaftar.slice(-8).join(', ')
      + (k.entriDaftar.length > 8 ? ', …' : '') + '.',
  });

  /* ── Level: naik = bunyi, bertahan lama = ingatkan ulang, turun = diam ── */
  const temuan = [];
  const kunciHidup = new Set(ukur.map((u) => u.kunci));
  for (const u of ukur) {
    const mentah = levelDari(u.nilai, BATAS[u.aturan]);
    const lama = k.level[u.kunci];
    if (mentah === null) { delete k.level[u.kunci]; continue; }
    if (mentah === 'tahan') continue;
    const naik = !lama || PERINGKAT[mentah] > PERINGKAT[lama.level];
    const basi = lama && PERINGKAT[mentah] >= PERINGKAT[lama.level] && kini - lama.waktu >= INGAT_ULANG_MS;
    if (naik || basi) {
      k.level[u.kunci] = { level: mentah, waktu: kini };
      temuan.push({
        id: 'risiko-' + u.kunci.replace(/[^\w.:-]/g, '-'),
        level: mentah, aturan: u.aturan, nilai: u.nilai, pair: u.pair || '',
        judul: u.judul(), detail: u.detail(),
      });
    } else if (PERINGKAT[mentah] < PERINGKAT[lama.level]) {
      /* Turun satu tingkat tapi masih di atas batas: dicatat tanpa bunyi,
         supaya naik lagi ke bahaya nanti berbunyi lagi. */
      k.level[u.kunci] = { level: mentah, waktu: lama.waktu };
    }
  }
  /* Posisi yang sudah ditutup tidak menyisakan level. Tanpa ini, simbol
     yang sama dibuka lagi minggu depan dianggap "masih waspada" dan tidak
     berbunyi saat pertama kali melewati batas. */
  for (const x of Object.keys(k.level)) if (!kunciHidup.has(x)) delete k.level[x];

  return { temuan, keadaan: k, ukur: ukur.map((u) => ({ kunci: u.kunci, nilai: u.nilai })) };
}

function buatPenjagaRisiko({ futuresRequest, HL, mt5Baca, uid, lonceng, catat }) {
  const log = catat || ((...a) => console.log('[' + jam() + '] [penjaga-risiko]', ...a));

  /* ── POTRET: satu pembacaan semua sumber ─────────────────────────────
     Binance dan Hyperliquid WAJIB terbaca. Floating yang dihitung dari
     separuh akun MENGECILKAN risiko — persis kekeliruan yang tidak boleh
     dibuat alat yang tugasnya mengingatkan. Jadi kalau salah satunya gagal,
     putaran ini dilewati utuh. MT5 berbeda: EA yang offline adalah keadaan
     biasa, dan saat itu MT5 dikeluarkan dari modal DAN dari posisi
     sekaligus, supaya persentasenya tetap jujur untuk yang terlihat. */
  async function bacaPotret() {
    const ang = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : 0; };
    const posisi = [];
    const rincianModal = { binance: 0, hyperliquid: 0, mt5: 0 };
    const terbaca = { binance: false, hyperliquid: false, mt5: false };

    const [akun, risk] = await Promise.all([
      futuresRequest('GET', '/fapi/v2/account', {}),
      futuresRequest('GET', '/fapi/v2/positionRisk', {}),
    ]);
    rincianModal.binance = ang(akun.totalWalletBalance);
    for (const p of Array.isArray(risk) ? risk : []) {
      const amt = ang(p.positionAmt);
      if (!amt) continue;
      const arah = amt > 0 ? 'BUY' : 'SELL';
      posisi.push({
        bursa: 'binance', simbol: p.symbol, arah, label: p.symbol,
        kunci: 'binance:' + p.symbol + ':' + arah,
        pnl: ang(p.unRealizedProfit),
        nilai: Math.abs(ang(p.notional)) || Math.abs(amt * ang(p.markPrice)),
      });
    }
    terbaca.binance = true;

    if (HL && HL.siap && HL.siap()) {
      /* `ketat`: satu buku yang 429 menggagalkan seluruh putaran. Tanpa ini
         buku yang gagal terbaca KOSONG — floating terhitung kecil, dan saat
         buku itu terbaca lagi putaran berikutnya, semua posisinya "muncul"
         dan dihitung sebagai entry baru. */
      const [saldo, hl] = await Promise.all([HL.saldoHl(), HL.posisiHl({ ketat: true })]);
      rincianModal.hyperliquid = ang(saldo.bisaDipakai);
      for (const p of hl || []) {
        const amt = ang(p.positionAmt);
        if (!amt) continue;
        const arah = amt > 0 ? 'BUY' : 'SELL';
        const koin = p.koin || p.symbol;
        posisi.push({
          bursa: 'hyperliquid', simbol: p.symbol, arah, label: koin,
          kunci: 'hyperliquid:' + (p.dex || '') + ':' + koin + ':' + arah,
          pnl: ang(p.unRealizedProfit), nilai: Math.abs(ang(p.notional)),
        });
      }
      terbaca.hyperliquid = true;
    }

    try {
      const d = mt5Baca ? mt5Baca() : null;
      const semua = (d && d.data && d.data[uid]) || {};
      const kini = Date.now();
      let adaSegar = false;
      for (const login of Object.keys(semua)) {
        const v = semua[login];
        if (!v || kini - (Number(v.diterima) || 0) > MT5_SEGAR_MS) continue;
        const uangAkun = String((v.akun && v.akun.mataUang) || '').toUpperCase();
        /* Akun sen (USC) melapor dalam sen. Mata uang lain tidak ditebak
           kursnya — lebih baik tidak dihitung daripada dihitung salah. */
        const bagi = uangAkun === 'USC' ? 100 : uangAkun === 'USD' ? 1 : 0;
        if (!bagi) continue;
        adaSegar = true;
        rincianModal.mt5 += ang(v.akun && v.akun.saldo) / bagi;
        for (const p of v.posisi || []) {
          const arah = /sell/i.test(String(p.arah)) ? 'SELL' : 'BUY';
          posisi.push({
            bursa: 'mt5', simbol: String(p.simbol || ''), arah, label: String(p.simbol || ''),
            kunci: 'mt5:' + login + ':' + p.tiket,
            pnl: (ang(p.profit) + ang(p.swap)) / bagi, nilai: 0,
          });
        }
      }
      terbaca.mt5 = adaSegar;
    } catch (e) { /* MT5 tidak terbaca = dianggap offline, lihat kepala fungsi */ }

    const modal = rincianModal.binance + rincianModal.hyperliquid + rincianModal.mt5;
    return { modal, rincianModal, posisi, terbaca };
  }

  async function putaran() {
    let potret;
    try { potret = await bacaPotret(); }
    catch (e) {
      log('dilewati — saldo/posisi tidak terbaca:', (e && e.message) || String(e));
      return null;
    }
    const kini = Date.now();
    const { temuan, keadaan } = evaluasi(potret, bacaKeadaan(), kini);
    tulisKeadaan(keadaan);
    for (const t of temuan) {
      log(t.level.toUpperCase() + ':', t.judul);
      if (!lonceng) continue;
      try {
        await lonceng({
          id: t.id, judul: t.judul, detail: t.detail, sumber: 'Penjaga risiko',
          jenis: 'risiko', level: t.level, pair: t.pair, tautan: '/chart-entry',
        });
      } catch (e) { log('lonceng gagal —', (e && e.message) || String(e)); }
    }
    return temuan;
  }

  return {
    putaran,
    bacaPotret,
    mulai() {
      if (String(process.env.PENJAGA_RISIKO || '1') === '0') { log('dimatikan lewat PENJAGA_RISIKO=0'); return null; }
      if (!uid) { log('tidak menyala — uid pemilik (PENGIKUT_UID/PORTO_UID) kosong'); return null; }
      log('menyala — tiap ' + (JEDA_MS / 1000) + ' dtk; batas ' + JSON.stringify(BATAS));
      const t = setInterval(() => {
        putaran().catch((e) => log('putaran gagal —', (e && e.message) || String(e)));
      }, JEDA_MS);
      if (t.unref) t.unref();
      return t;
    },
  };
}

module.exports = { buatPenjagaRisiko, evaluasi, BATAS, JEDA_MS, INGAT_ULANG_MS, MT5_SEGAR_MS, PULIH };
