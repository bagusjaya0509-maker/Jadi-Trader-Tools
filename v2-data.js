/* ════════════════════════════════════════════════════════════════════════
   JADI TRADER — LAPISAN DATA V2
   ════════════════════════════════════════════════════════════════════════

   Satu sumber angka untuk Beranda dan Dashboard, supaya keduanya tidak
   pernah menampilkan saldo yang berbeda untuk hal yang sama.

   DUA MODE, dan perbedaannya penting:

   • MODE ETALASE — pengunjung belum login, atau login tapi belum premium.
     Angkanya diambil dari dokumen PUBLIK milik pemilik (public/jurnalShowcase
     dan public/posisiTerbuka). Ini yang membuat halaman depan terisi penuh
     sejak detik pertama dibuka: bukti bahwa tool-nya hidup, bukan tangkapan
     layar. Yang TIDAK pernah ikut ke mode ini: apa pun dari Panel Pemilik -
     email klien, penjualan, laporan bug. Itu bukan etalase, itu data orang.

   • MODE PRIBADI — pengguna premium. Angkanya dari datanya sendiri
     (localStorage + cloud miliknya), tidak menyentuh dokumen publik.

   Semua fungsi di sini MURNI baca. Tidak ada satu pun yang menulis. */
(function(){
  'use strict';

  var KUNCI_SIM_KRIPTO = 'emaScreenerPrioritySim_v1';
  var KUNCI_JURNAL     = 'ledgerNoirTrades_v1';
  var KUNCI_PROFIL     = 'jtAccountProfile_v1';
  var OWNER_UID        = 'EOrakx0QnSVgsi6BECSOXvUM9kG3';
  var BACKEND_BAWAAN   = 'https://103-253-145-38.sslip.io';

  /* Saldo awal bawaan disamakan PERSIS dengan jurnal (ACCOUNT_BAWAAN di
     jurnal-trading.html). Kalau berbeda, halaman Dashboard dan halaman Jurnal
     akan menampilkan saldo yang berbeda untuk akun yang sama - dan pengguna
     tidak punya cara tahu mana yang benar. */
  var SALDO_AWAL_BAWAAN = 270.02;

  /* ── Bentuk data yang sebenarnya ──────────────────────────────────────────
     Ini sumber kesalahan angka di versi pertama, jadi ditulis eksplisit:

       Jurnal forex (ledgerNoirTrades_v1)
         { pl: number, date: "YYYY-MM-DD" }      <- "pl", BUKAN "pnl"
                                                 <- tanggal STRING, bukan ms
       Riwayat kripto (emaScreenerPrioritySim_v1.history)
         { pnl: number, exitTime: ms }           <- "pnl" dan ms

       Profil akun (jtAccountProfile_v1)
         { startBalance: number }                <- "startBalance",
                                                    BUKAN "saldoAwal"

     Dulu saldo awal dibaca sebagai `saldoAwal` sehingga selalu undefined ->
     Total Saldo jadi sekadar jumlah P/L, bukan saldo. Dan tanggal forex yang
     berupa string diurutkan sebagai angka, jadi kurva ekuitasnya acak. */

  function J(s, bawaan){
    try{ var v = JSON.parse(s); return (v === null || v === undefined) ? bawaan : v; }
    catch(e){ return bawaan; }
  }
  function lokal(k, bawaan){
    try{ return J(localStorage.getItem(k), bawaan); }catch(e){ return bawaan; }
  }

  /* ── Hitung statistik dari daftar transaksi selesai ──────────────────────
     Satu fungsi untuk kripto DAN forex: keduanya sudah dinormalkan ke bentuk
     { pnl: number }. Menghitungnya dua kali dengan rumus terpisah adalah cara
     paling mudah membuat dua halaman menampilkan winrate yang berbeda. */
  function hitungStat(riwayat, saldoAwal){
    var trade = (riwayat || []).filter(function(t){
      return t && typeof t.pnl === 'number' && isFinite(t.pnl);
    });
    var menang = trade.filter(function(t){ return t.pnl > 0; });
    var kalah  = trade.filter(function(t){ return t.pnl < 0; });

    var totalUntung = menang.reduce(function(s,t){ return s + t.pnl; }, 0);
    var totalRugi   = kalah.reduce(function(s,t){ return s + Math.abs(t.pnl); }, 0);
    var bersih      = totalUntung - totalRugi;

    return {
      jumlah: trade.length,
      menang: menang.length,
      kalah: kalah.length,
      /* Winrate dari transaksi yang PUNYA hasil. Kalau belum ada satu pun,
         hasilnya null - bukan 0%. "0% winrate" pada akun yang belum pernah
         trading adalah kebohongan kecil yang membuat panel terlihat rusak. */
      winrate: trade.length ? (menang.length / trade.length) * 100 : null,
      untung: totalUntung,
      rugi: totalRugi,
      bersih: bersih,
      saldo: (typeof saldoAwal === 'number' && isFinite(saldoAwal)) ? saldoAwal + bersih : bersih,
      faktorProfit: totalRugi > 0 ? (totalUntung / totalRugi) : (totalUntung > 0 ? Infinity : null),
      rerataMenang: menang.length ? totalUntung / menang.length : 0,
      rerataKalah: kalah.length ? totalRugi / kalah.length : 0
    };
  }

  /* Kurva ekuitas. Diurut menaik menurut waktu tutup - dan waktunya sudah
     dinormalkan ke milidetik lebih dulu oleh normalisasi*(), karena forex
     menyimpan tanggal sebagai string dan mengurutkan string sebagai angka
     menghasilkan kurva yang acak. */
  function kurvaEkuitas(riwayat, saldoAwal){
    var t = (riwayat || []).filter(function(x){ return x && isFinite(x.pnl); })
      .slice()
      .sort(function(a,b){ return (a.waktu || 0) - (b.waktu || 0); });
    var titik = [], jalan = isFinite(saldoAwal) ? saldoAwal : 0;
    titik.push({ i:0, nilai: jalan, waktu: t.length ? t[0].waktu : null, awal: true });
    t.forEach(function(x, i){
      jalan += x.pnl;
      titik.push({ i: i+1, nilai: jalan, waktu: x.waktu, sumber: x.sumber });
    });
    return titik;
  }

  /* ── Normalisasi ke satu bentuk: { pnl, waktu(ms), sumber } ────────────── */
  function normalisasiForex(daftar){
    return (Array.isArray(daftar) ? daftar : []).map(function(t){
      var n = (t && typeof t.pl === 'number') ? t.pl : parseFloat(t && t.pl);
      var w = t && (t.date || t.tgl);
      var ms = null;
      if(w){ var d = new Date(w); if(!isNaN(d.getTime())) ms = d.getTime(); }
      return { pnl: n, waktu: ms, sumber: 'forex' };
    }).filter(function(t){ return isFinite(t.pnl); });
  }

  function normalisasiKripto(sim){
    var h = (sim && Array.isArray(sim.history)) ? sim.history : [];
    return h.map(function(t){
      return { pnl: t && t.pnl, waktu: (t && (t.exitTime || t.entryTime)) || null, sumber: 'kripto' };
    }).filter(function(t){ return isFinite(t.pnl); });
  }

  function saldoAwalDari(profil){
    var n = profil && profil.startBalance;
    return (typeof n === 'number' && isFinite(n)) ? n : SALDO_AWAL_BAWAAN;
  }

  /* Menyusun satu paket data dari tiga bahan mentah. Dipakai mode pribadi
     MAUPUN etalase, supaya keduanya tidak mungkin memakai rumus berbeda. */
  function rakit(mode, sim, jurnal, profil, posisi){
    var forex  = normalisasiForex(jurnal);
    var kripto = normalisasiKripto(sim);
    var gabung = forex.concat(kripto);
    var awal   = saldoAwalDari(profil);

    return {
      mode: mode,
      saldoAwal: awal,
      stat: hitungStat(gabung, awal),
      /* Rincian per sumber. Ditampilkan di Dashboard supaya penggabungannya
         bisa DIPERIKSA - kalau totalnya terasa salah, dua baris ini langsung
         menunjukkan sisi mana yang menyimpang. */
      rincian: {
        forex:  hitungStat(forex,  awal),
        kripto: hitungStat(kripto, 0)
      },
      kurva: kurvaEkuitas(gabung, awal),
      posisi: Array.isArray(posisi) ? posisi : [],
      riwayat: gabung
    };
  }

  /* ── Data pribadi (premium) ───────────────────────────────────────────── */
  function dataPribadi(){
    var sim    = lokal(KUNCI_SIM_KRIPTO, {}) || {};
    var profil = lokal(KUNCI_PROFIL, {}) || {};
    var jurnal = lokal(KUNCI_JURNAL, []) || [];

    var posisi = Object.keys(sim.positions || {}).map(function(k){ return sim.positions[k]; })
      .filter(function(p){ return p && !p.pending; })
      .map(function(p){
        return { simbol:p.source, arah:p.dir, entry:p.entryPrice, sl:p.sl, tp:p.tp,
                 buka:p.entryTime, tf:p.tfLabel || '', qty:p.qty, margin:p.margin, leverage:p.leverage };
      });

    return rakit('pribadi', sim, jurnal, profil, posisi);
  }

  /* ── Data etalase (dokumen publik pemilik) ────────────────────────────── */
  function dataEtalase(db){
    if(!db) return Promise.resolve(kosong('etalase'));
    var pub = db.collection('public');
    return Promise.all([
      pub.doc('jurnalShowcase').get().catch(function(){ return null; }),
      pub.doc('posisiTerbuka').get().catch(function(){ return null; })
    ]).then(function(hasil){
      var show = (hasil[0] && hasil[0].exists) ? (hasil[0].data() || {}) : {};
      var pos  = (hasil[1] && hasil[1].exists) ? ((hasil[1].data() || {}).posisi || []) : [];
      return rakit('etalase',
        J(show[KUNCI_SIM_KRIPTO], {}) || {},
        J(show[KUNCI_JURNAL], []) || [],
        J(show[KUNCI_PROFIL], {}) || {},
        pos);
    }).catch(function(){ return kosong('etalase'); });
  }

  function kosong(mode){ return rakit(mode, {}, [], {}, []); }

  /* ── Harga pasar untuk PnL berjalan ───────────────────────────────────── */
  function backend(){
    var sumber = ['jtBinanceConn_v1', 'emaScreenerLiveTradeConfig_v1'];
    for(var i=0;i<sumber.length;i++){
      var c = lokal(sumber[i], null);
      if(c && c.backendUrl) return String(c.backendUrl).trim().replace(/\/+$/,'');
    }
    return BACKEND_BAWAAN;
  }
  function ambilHarga(){
    return fetch(backend() + '/api/tickers')
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        var peta = {};
        if(j && Array.isArray(j.data)) j.data.forEach(function(t){ peta[t.symbol] = parseFloat(t.lastPrice); });
        return peta;
      })
      .catch(function(){ return {}; });
  }

  /* ── Pemformat ────────────────────────────────────────────────────────── */
  function uang(n, tanda){
    if(typeof n !== 'number' || !isFinite(n)) return '—';
    var s = Math.abs(n) >= 1000 ? n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
                                : n.toFixed(2);
    return (tanda && n > 0 ? '+' : n < 0 ? '-' : '') + '$' + s.replace('-','');
  }
  function persen(n, desimal){
    if(typeof n !== 'number' || !isFinite(n)) return '—';
    return n.toFixed(desimal === undefined ? 1 : desimal) + '%';
  }
  function harga(n){
    if(typeof n !== 'number' || !isFinite(n)) return '—';
    if(n >= 1000) return '$' + n.toFixed(2);
    if(n >= 1)    return '$' + n.toFixed(4);
    return '$' + n.toPrecision(4);
  }

  window.V2Data = {
    OWNER_UID: OWNER_UID,
    SALDO_AWAL_BAWAAN: SALDO_AWAL_BAWAAN,
    hitungStat: hitungStat,
    kurvaEkuitas: kurvaEkuitas,
    rakit: rakit,
    pribadi: dataPribadi,
    etalase: dataEtalase,
    kosong: kosong,
    ambilHarga: ambilHarga,
    backend: backend,
    fmt: { uang: uang, persen: persen, harga: harga }
  };
})();
