/* ══════════════════════════════════════════════════════════════════════════
   jt-langganan.js — masa coba 30 hari + langganan bulanan
   ══════════════════════════════════════════════════════════════════════════
   Dipakai bersama oleh ema-cross-screener_3.html, mobile.html, dan
   jurnal-trading.html supaya ketiganya menghitung status dengan cara yang
   SAMA. Kalau tiap halaman menghitung sendiri, cepat atau lambat salah satu
   akan bilang "masih 3 hari" sementara yang lain bilang "sudah habis".

   ── YANG PERLU DIPAHAMI SOAL PENGAMANAN ───────────────────────────────────
   Berkas ini ada di halaman publik dan bisa dibaca siapa saja. Jadi ISINYA
   BUKAN PENGAMAN - ini cuma lapisan tampilan: memberi tahu sisa hari,
   mematikan tombol, memasang dinding bayar. Orang yang paham bisa
   melewatinya dalam hitungan menit.

   Penegakan yang sesungguhnya ada di dua tempat yang TIDAK bisa disentuh
   dari peramban:
     1. Aturan Firestore  - menolak TULISAN ke users/{uid} kalau langganan
        tidak aktif. Jurnal tetap bisa dibaca, tapi tidak bisa ditambah.
     2. Backend di VPS    - menolak /api/klines dkk kalau langganan tidak
        aktif, sesudah memverifikasi ID token Firebase-nya.

   Karena itu modul ini sengaja GAGAL-TERBUKA: kalau status tidak bisa dibaca
   (jaringan mati, Firestore lambat), tampilannya dibiarkan terbuka. Mengunci
   orang yang sudah bayar gara-gara sinyal WiFi jelek jauh lebih merugikan
   daripada membiarkan satu-dua pemakaian lolos - toh dua lapis di atas tetap
   menjaga.

   ── DOKUMEN STATUS ────────────────────────────────────────────────────────
   Firestore  langganan/{uid}  isinya:
     mulai        (timestamp) - ditulis SEKALI oleh halaman, nilainya WAJIB
                  serverTimestamp(). Aturan Firestore menolak nilai lain, jadi
                  jam di HP tidak bisa dipakai memperpanjang masa coba, dan
                  update/delete ditolak sehingga tidak bisa di-reset.
     bayarSampai  (timestamp, opsional) - HANYA pemilik yang boleh menulis.
   ══════════════════════════════════════════════════════════════════════════ */
window.JTLangganan = (function(){
  "use strict";

  var OWNER_UID   = 'EOrakx0QnSVgsi6BECSOXvUM9kG3';
  var HARI_COBA   = 30;
  var HARGA_TEKS  = '$5 / bulan';

  /* ⚠ ISI SATU BARIS INI dengan link pembayaran Lynk.id-mu, lalu unggah ulang
     berkasnya. Selama masih kosong, dinding bayar menampilkan petunjuk
     menghubungi pemilik - bukan tombol bayar yang menuju ke mana-mana. */
  var LYNK_URL = '';

  var HARI_MS = 86400000;
  var kondisi = null;   // hasil hitungan terakhir
  var sudahGaya = false;

  function hariBulat(ms){ return Math.max(0, Math.ceil(ms / HARI_MS)); }

  function keMillis(t){
    if(!t) return null;
    if(typeof t.toMillis === 'function') return t.toMillis();
    if(typeof t.seconds === 'number') return t.seconds * 1000;
    if(typeof t === 'number') return t;
    return null;
  }

  function hitung(data){
    var kini = Date.now();
    var mulai = keMillis(data.mulai);
    var bayar = keMillis(data.bayarSampai);

    if(bayar && bayar > kini){
      return { status:'bayar', aktif:true, sisaHari: hariBulat(bayar - kini),
               bayarSampai: bayar, cobaSampai: mulai ? mulai + HARI_COBA*HARI_MS : null };
    }
    if(mulai){
      var akhirCoba = mulai + HARI_COBA * HARI_MS;
      if(akhirCoba > kini){
        return { status:'coba', aktif:true, sisaHari: hariBulat(akhirCoba - kini),
                 cobaSampai: akhirCoba, bayarSampai: bayar };
      }
      return { status:'habis', aktif:false, sisaHari:0, cobaSampai: akhirCoba, bayarSampai: bayar };
    }
    return { status:'habis', aktif:false, sisaHari:0, cobaSampai:null, bayarSampai:null };
  }

  function terbuka(alasan){
    return { status:'tidakDiketahui', aktif:true, sisaHari:null, alasan:alasan };
  }

  /* Baca status, dan buat dokumen masa coba kalau pengguna ini belum punya.
     db   = firebase.firestore()
     user = objek user dari onAuthStateChanged  */
  function muat(db, user){
    if(!db || !user){ kondisi = terbuka('belum login'); return Promise.resolve(kondisi); }
    if(user.uid === OWNER_UID){
      kondisi = { status:'pemilik', aktif:true, sisaHari:null };
      return Promise.resolve(kondisi);
    }
    var ref = db.collection('langganan').doc(user.uid);
    return ref.get().then(function(d){
      if(d.exists) return d.data() || {};
      // Dokumen baru dibuat. TIDAK dibaca ulang: nilai "mulai" yang barusan
      // ditulis pasti waktu server saat ini, selisihnya dengan jam lokal cuma
      // milidetik - tidak sepadan dengan satu perjalanan bolak-balik tambahan
      // di jalur login, yang justru paling terasa lambat bagi pengguna baru.
      return ref.set({ mulai: firebase.firestore.FieldValue.serverTimestamp() })
        .then(function(){ return { mulai: Date.now() }; });
    }).then(function(data){
      kondisi = hitung(data);
      return kondisi;
    }).catch(function(e){
      // Lihat catatan GAGAL-TERBUKA di kepala berkas.
      if(window.console) console.warn('[langganan] status tidak terbaca:', e && e.message);
      kondisi = terbuka(e && e.message ? e.message : 'gagal membaca status');
      return kondisi;
    });
  }

  /* ── ID token untuk backend ───────────────────────────────────────────
     Backend memverifikasi tanda tangan token ini, jadi tidak bisa dipalsukan.
     Disimpan di variabel dan diperbarui lewat onIdTokenChanged - Firebase
     menyalakannya tiap kali token diperbarui (± tiap jam), jadi tidak perlu
     memanggil getIdToken() di tiap permintaan klines. */
  var tokenKini = null;

  function pantauToken(auth){
    if(!auth || typeof auth.onIdTokenChanged !== 'function') return;
    auth.onIdTokenChanged(function(u){
      if(!u){ tokenKini = null; return; }
      u.getIdToken().then(function(t){ tokenKini = t; })
                    .catch(function(){ tokenKini = null; });
    });
  }

  // Dipakai sebagai  headers: JTLangganan.kepalaAuth()  di fetch data pasar.
  // Kalau token belum siap, mengembalikan objek kosong - backend akan menolak
  // dengan pesan yang jelas, bukan diam-diam mengirim permintaan tanpa jati diri.
  function kepalaAuth(tambahan){
    var h = tambahan ? Object.assign({}, tambahan) : {};
    if(tokenKini) h.Authorization = 'Bearer ' + tokenKini;
    return h;
  }

  /* Terjemahkan penolakan backend jadi tindakan yang benar. Dipanggil halaman
     saat fetch data pasar membalas 401/402. */
  function tanganiTolakan(resp){
    if(!resp) return false;
    if(resp.status === 402){ tampilDinding('Sinyal &amp; Data Pasar'); return true; }
    if(resp.status === 401){
      if(window.console) console.warn('[langganan] backend menolak sesi - token belum siap atau kedaluwarsa');
      return true;
    }
    return false;
  }

  function status(){ return kondisi; }
  function aktif(){ return !kondisi || kondisi.aktif !== false; }
  function masaCoba(){ return !!kondisi && kondisi.status === 'coba'; }

  function tanggal(ms){
    if(!ms) return '—';
    return new Date(ms).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
  }

  /* ── Lencana kecil untuk dipasang di kepala halaman ───────────────────── */
  function teksLencana(){
    if(!kondisi) return '';
    if(kondisi.status === 'pemilik') return 'Pemilik';
    if(kondisi.status === 'tidakDiketahui') return '';
    if(kondisi.status === 'bayar') return 'Aktif · ' + kondisi.sisaHari + ' hari lagi';
    if(kondisi.status === 'coba')  return 'Masa coba · ' + kondisi.sisaHari + ' hari lagi';
    return 'Masa coba habis';
  }

  function kelasLencana(){
    if(!kondisi) return '';
    if(kondisi.status === 'habis') return 'jtl-habis';
    if(kondisi.status === 'coba' && kondisi.sisaHari <= 5) return 'jtl-segera';
    return 'jtl-aman';
  }

  function pasangGaya(){
    if(sudahGaya) return;
    sudahGaya = true;
    var s = document.createElement('style');
    s.textContent = [
      '.jtl-lencana{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;',
      'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.6;',
      'border:1px solid currentColor;cursor:pointer;white-space:nowrap;}',
      '.jtl-lencana.jtl-aman{color:#4f9e82;} .jtl-lencana.jtl-segera{color:#c9a24b;}',
      '.jtl-lencana.jtl-habis{color:#c2544d;}',
      '.jtl-tirai{position:fixed;inset:0;z-index:99999;background:rgba(6,7,10,.86);',
      'display:none;align-items:center;justify-content:center;padding:18px;}',
      '.jtl-tirai.on{display:flex;}',
      '.jtl-kotak{width:100%;max-width:430px;background:#15171c;border:1px solid #262a31;',
      'border-radius:14px;padding:22px;color:#ece8de;',
      'font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;max-height:90vh;overflow:auto;}',
      '.jtl-kotak h3{margin:0 0 6px;font-size:17px;font-weight:600;}',
      '.jtl-kotak p{margin:0 0 12px;font-size:13px;line-height:1.65;color:#9a9ca4;}',
      '.jtl-kotak b{color:#ece8de;}',
      '.jtl-harga{font-family:ui-monospace,monospace;font-size:22px;color:#c9a24b;margin:2px 0 14px;}',
      '.jtl-daftar{margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.9;color:#9a9ca4;}',
      '.jtl-tbl{display:block;width:100%;box-sizing:border-box;text-align:center;padding:11px 14px;',
      'border-radius:9px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:9px;',
      'border:1px solid #262a31;background:#1b1e24;color:#ece8de;cursor:pointer;}',
      '.jtl-tbl.utama{background:#c9a24b;border-color:#c9a24b;color:#1a1200;}',
      '.jtl-catat{font-size:11.5px;color:#63656d;line-height:1.6;margin-top:4px;}'
    ].join('');
    document.head.appendChild(s);
  }

  /* Pasang lencana ke sebuah elemen wadah. Diklik -> dinding bayar terbuka,
     jadi pengguna bisa membaca rinciannya kapan saja, bukan cuma waktu habis. */
  function pasangLencana(wadah){
    if(!wadah || !kondisi) return null;
    var t = teksLencana();
    if(!t) return null;
    pasangGaya();
    var b = document.createElement('span');
    b.className = 'jtl-lencana ' + kelasLencana();
    b.textContent = t;
    b.title = 'Lihat rincian langganan';
    b.addEventListener('click', function(){ tampilDinding(); });
    wadah.appendChild(b);
    return b;
  }

  /* ── Dinding bayar ────────────────────────────────────────────────────── */
  function tampilDinding(fitur){
    pasangGaya();
    var lama = document.getElementById('jtlTirai');
    if(lama) lama.remove();

    var habis = !!kondisi && kondisi.status === 'habis';
    var judul = habis
      ? 'Masa coba sudah habis'
      : (fitur ? fitur : 'Langganan Jadi Trader Tools');

    var isiAtas = habis
      ? '<p>Masa coba 30 hari-mu berakhir pada <b>' + tanggal(kondisi.cobaSampai) + '</b>. '
        + 'Fitur <b>sinyal</b> berhenti, dan jurnal sekarang <b>hanya bisa dibaca</b> — '
        + 'catatan lamamu tetap utuh dan tidak dihapus, tapi tidak bisa ditambah atau diubah dulu.</p>'
      : '<p>Masa coba <b>30 hari</b> berjalan otomatis sejak pertama kali masuk. '
        + 'Sesudah itu fitur sinyal dan pencatatan jurnal butuh langganan.</p>';

    var sisa = '';
    if(kondisi && kondisi.status === 'coba'){
      sisa = '<p>Sisa masa coba: <b>' + kondisi.sisaHari + ' hari</b> (sampai '
           + tanggal(kondisi.cobaSampai) + ').</p>';
    } else if(kondisi && kondisi.status === 'bayar'){
      sisa = '<p>Langganan aktif sampai <b>' + tanggal(kondisi.bayarSampai) + '</b>.</p>';
    }

    var tombol = LYNK_URL
      ? '<a class="jtl-tbl utama" href="' + LYNK_URL + '" target="_blank" rel="noopener">'
        + 'Bayar ' + HARGA_TEKS + '</a>'
        + '<div class="jtl-catat">Sesudah membayar, kirim bukti bayar beserta email akun ini '
        + 'ke pemilik. Langgananmu diperpanjang manual, biasanya di hari yang sama.</div>'
      : '<div class="jtl-catat">Link pembayaran belum dipasang. Hubungi pemilik tool untuk '
        + 'mengaktifkan langganan.</div>';

    var t = document.createElement('div');
    t.className = 'jtl-tirai on';
    t.id = 'jtlTirai';
    t.innerHTML =
        '<div class="jtl-kotak">'
      +   '<h3>' + judul + '</h3>'
      +   '<div class="jtl-harga">' + HARGA_TEKS + '</div>'
      +   isiAtas + sisa
      +   '<ul class="jtl-daftar">'
      +     '<li>Sinyal Area Pantau &amp; Parallel</li>'
      +     '<li>Jurnal trading (menambah &amp; mengubah catatan)</li>'
      +     '<li>Kalender ekonomi &amp; data pasar lewat server</li>'
      +   '</ul>'
      +   tombol
      +   '<button type="button" class="jtl-tbl" id="jtlTutup">Tutup</button>'
      + '</div>';
    document.body.appendChild(t);

    t.querySelector('#jtlTutup').addEventListener('click', function(){ t.remove(); });
    t.addEventListener('click', function(e){ if(e.target === t) t.remove(); });
  }

  /* Penjaga untuk dipakai di depan aksi berbayar. Mengembalikan true kalau
     boleh lanjut; kalau tidak, dinding bayar dibuka dan hasilnya false. */
  function boleh(fitur){
    if(aktif()) return true;
    tampilDinding(fitur);
    return false;
  }

  return {
    muat: muat,
    status: status,
    aktif: aktif,
    masaCoba: masaCoba,
    boleh: boleh,
    pantauToken: pantauToken,
    kepalaAuth: kepalaAuth,
    tanganiTolakan: tanganiTolakan,
    tampilDinding: tampilDinding,
    pasangLencana: pasangLencana,
    teksLencana: teksLencana,
    OWNER_UID: OWNER_UID,
    HARI_COBA: HARI_COBA
  };
})();
