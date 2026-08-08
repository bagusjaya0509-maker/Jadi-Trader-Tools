/* ══════════════════════════════════════════════════════════════════════════
   jt-lapor.js — laporan bug/saran, error otomatis, dan penghitung trafik
   ══════════════════════════════════════════════════════════════════════════
   Dipakai bersama screener, jurnal, dan mobile. Satu berkas supaya perilakunya
   tidak bercabang: laporan dari halaman mana pun berbentuk sama, jadi bisa
   diurutkan dan disaring di halaman Pemilik tanpa perkecualian.

   Tiga hal yang dikerjakan:
     1. Kirim laporan yang DITULIS pengguna (bug / saran).
     2. Kirim error yang TIDAK ditulis siapa pun - error JavaScript yang lolos
        ke window. Ini yang paling berharga: pengguna hampir tidak pernah
        melaporkan error, mereka cuma menutup halaman.
     3. Catat kunjungan, sekali per sesi per halaman.

   Yang SENGAJA tidak dikirim: isi localStorage, token, atau apa pun dari
   dalam form. Hanya pesan, halaman, versi, dan user-agent.
   ══════════════════════════════════════════════════════════════════════════ */
window.JTLapor = (function(){
  "use strict";

  var BACKEND = 'https://103-253-145-38.sslip.io';
  var halaman = '', versi = '', auth = null, siap = false;

  function kepala(){
    var h = { 'Content-Type': 'application/json' };
    if(typeof JTLangganan !== 'undefined'){
      var k = JTLangganan.kepalaAuth();
      if(k.Authorization) h.Authorization = k.Authorization;
    }
    return h;
  }

  function kirim(jenis, pesan){
    return fetch(BACKEND + '/api/lapor', {
      method: 'POST',
      headers: kepala(),
      body: JSON.stringify({ jenis: jenis, pesan: pesan, halaman: halaman, versi: versi })
    }).then(function(r){ return r.ok; });
  }

  /* Error otomatis dibatasi 5 per sesi. Satu bug yang jatuh di dalam
     requestAnimationFrame bisa melempar 60 kali per detik - tanpa batas, satu
     tab rusak membanjiri berkas laporan sampai penuh dan menutupi laporan
     lain yang justru penting. */
  var jumlahError = 0, sudahDikirim = {};
  function laporError(pesan){
    if(jumlahError >= 5) return;
    var kunci = String(pesan).slice(0, 120);
    if(sudahDikirim[kunci]) return;      // error yang sama, sekali saja
    sudahDikirim[kunci] = true;
    jumlahError++;
    kirim('error', pesan).catch(function(){});
  }

  function pasangPenangkapError(){
    window.addEventListener('error', function(e){
      if(!e || !e.message) return;
      laporError(e.message + (e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + e.lineno : ''));
    });
    window.addEventListener('unhandledrejection', function(e){
      var r = e && e.reason;
      laporError('Promise ditolak: ' + (r && r.message ? r.message : String(r)).slice(0, 300));
    });
  }

  /* Kunjungan dicatat SEKALI per sesi per halaman. Tanpa penjaga ini, tiap
     refresh dan tiap pindah tab bolak-balik ikut terhitung, dan angkanya
     berhenti berarti apa-apa. */
  function catatKunjungan(){
    var kunci = 'jtKunjungan::' + halaman;
    try{ if(sessionStorage.getItem(kunci)) return; sessionStorage.setItem(kunci, '1'); }catch(e){}
    fetch(BACKEND + '/api/kunjungan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ halaman: halaman })
    }).catch(function(){});
  }

  function init(opsi){
    if(siap) return;
    siap = true;
    opsi = opsi || {};
    halaman = opsi.halaman || (location.pathname.split('/').pop() || 'index');
    versi = opsi.versi || (document.querySelector('meta[name=jt-versi]') || {}).content || '';
    if(opsi.backend) BACKEND = opsi.backend;
    pasangPenangkapError();
    catatKunjungan();
  }

  /* Pasang tombol + kotak laporan. Dipanggil halaman yang punya markup-nya;
     kalau markupnya tidak ada, diam saja - halaman lain boleh memakai init()
     saja untuk error otomatis & trafik tanpa tombolnya. */
  function pasangKotak(id){
    id = id || {};
    var tombol = document.getElementById(id.tombol || 'esLaporBtn');
    var modal  = document.getElementById(id.modal  || 'esLaporModal');
    var pesanEl= document.getElementById(id.pesan  || 'esLaporPesan');
    var statusEl=document.getElementById(id.status || 'esLaporStatus');
    var batal  = document.getElementById(id.batal  || 'esLaporBatal');
    var kirimBtn=document.getElementById(id.kirim  || 'esLaporKirim');
    if(!tombol || !modal || !pesanEl || !kirimBtn) return false;

    var buka = function(){
      pesanEl.value = '';
      if(statusEl) statusEl.textContent = '';
      kirimBtn.disabled = false;
      modal.classList.add('open');
      setTimeout(function(){ pesanEl.focus(); }, 50);
    };
    var tutup = function(){ modal.classList.remove('open'); };

    tombol.addEventListener('click', buka);
    if(batal) batal.addEventListener('click', tutup);
    modal.addEventListener('click', function(e){ if(e.target === modal) tutup(); });

    kirimBtn.addEventListener('click', function(){
      var teks = pesanEl.value.trim();
      if(!teks){ if(statusEl) statusEl.textContent = 'Tulis dulu isi laporannya.'; return; }
      var jenisEl = document.querySelector('input[name="' + (id.jenisName || 'esLaporJenis') + '"]:checked');
      var jenis = jenisEl ? jenisEl.value : 'bug';
      kirimBtn.disabled = true;
      if(statusEl) statusEl.textContent = 'Mengirim…';
      kirim(jenis, teks).then(function(ok){
        if(statusEl) statusEl.textContent = ok ? 'Terkirim. Terima kasih.' : 'Gagal terkirim, coba lagi sebentar lagi.';
        if(ok) setTimeout(tutup, 900); else kirimBtn.disabled = false;
      }).catch(function(){
        if(statusEl) statusEl.textContent = 'Tidak bisa menghubungi server.';
        kirimBtn.disabled = false;
      });
    });
    return true;
  }

  return { init: init, pasangKotak: pasangKotak, kirim: kirim, BACKEND: BACKEND };
})();
