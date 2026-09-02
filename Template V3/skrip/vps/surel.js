/* ════════════════════════════════════════════════════════════════════════
   SUREL — pemberitahuan ke pengguna saat aksesnya disetujui
   ════════════════════════════════════════════════════════════════════════
   Sebelum ini, orang yang permintaannya disetujui tidak diberi tahu apa pun.
   Ia harus menebak sendiri kapan harus membuka situs lagi — dan sebagian
   tidak pernah kembali karena mengira permintaannya diabaikan. Persetujuan
   yang tidak sampai ke orangnya sama saja dengan penolakan yang sopan.

   ── KENAPA ADA DUA JALUR KIRIM ─────────────────────────────────────────
   Versi pertama modul ini hanya bisa SMTP, dan itu ternyata jalan buntu di
   VPS ini: penyedia MEMBLOKIR port SMTP keluar (25, 465, 587) ke SELURUH
   host, bukan cuma ke Hostinger — praktik anti-spam yang lazim untuk VPS.
   Firewall lokalnya sendiri bersih (kebijakan OUTPUT ACCEPT, ufw mati),
   jadi tidak ada yang bisa diperbaiki dari dalam mesin.

   Akibatnya penting dan tidak kelihatan: mengisi SMTP_USER/SMTP_PASS akan
   membuat `siap()` bernilai true sementara setiap pengiriman mati di
   connection timeout. Itu lebih buruk daripada tidak dikonfigurasi sama
   sekali, karena kegagalannya diam.

   Maka jalur UTAMA sekarang API HTTPS (port 443 — satu-satunya yang
   terbukti tembus). SMTP dipertahankan sebagai jalur kedua, dipakai hanya
   kalau memang diisi, supaya tetap siap kalau blokirnya dibuka nanti.

   ── DUA ATURAN YANG TIDAK BOLEH DILANGGAR ──────────────────────────────

   1. GAGAL KIRIM TIDAK BOLEH MEMBATALKAN PERSETUJUAN.
      Aksesnya sudah sah begitu ditulis ke berkas dan Firestore. Kalau
      pengiriman gagal, yang hilang cuma pemberitahuannya — bukan hak orang
      itu. Seluruh pengiriman dibungkus try/catch dan dipanggil TANPA await
      yang menahan jawaban HTTP.

   2. TANPA KREDENSIAL, MODUL INI DIAM — BUKAN MELEDAK.
      Server tetap jalan penuh. Kodenya bisa dipasang lebih dulu,
      kredensialnya menyusul, tanpa jendela waktu backend rusak.

   ── SOAL KREDENSIAL ────────────────────────────────────────────────────
   Dibaca dari .env, tidak pernah ditulis di kode dan tidak pernah muncul di
   log. `statusSurel()` sengaja hanya melaporkan ADA/TIDAK dan jalur mana
   yang aktif, bukan isinya, supaya endpoint diagnostik tidak berubah jadi
   kebocoran.
   ════════════════════════════════════════════════════════════════════════ */

const nodemailer = require('nodemailer');

/* ── Jalur 1: API HTTPS (Resend) ── */
const RESEND_KEY = process.env.RESEND_API_KEY || '';
/* Alamat pengirim WAJIB di domain yang sudah diverifikasi di Resend.
   Memakai gmail.com di sini akan ditolak dengan 403 — dan pesannya tidak
   selalu jelas menyebut sebabnya. */
const DARI_EMAIL = process.env.SUREL_DARI || 'no-reply@jaditrader.co.id';
const BALAS_KE = process.env.SUREL_BALAS || 'business@jaditrader.co.id';

/* ── Jalur 2: SMTP (cadangan, kalau blokir port dibuka) ── */
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const DARI_NAMA = process.env.SMTP_NAMA || 'Jadi Trader Tools';
const SITUS = process.env.SITUS_URL || 'https://jaditrader.co.id';

/** Header From yang sah untuk kedua bentuk isi SUREL_DARI. */
function dariHeader() {
  const v = String(DARI_EMAIL).trim();
  return v.includes('<') ? v : `${DARI_NAMA} <${v}>`;
}

/* Penerima pemberitahuan permintaan masuk. Dua alamat, bukan satu: satu
   alamat adalah satu titik gagal, dan mailbox bisnisnya masih masa coba. */
const SUREL_PEMILIK = (process.env.SUREL_PEMILIK
  || 'business@jaditrader.co.id,bagusjaya0509@gmail.com')
  .split(',').map((x) => x.trim()).filter(Boolean);

let angkut = null;

/** Jalur mana yang akan dipakai. 'api' menang kalau keduanya terisi:
 *  ia yang terbukti bisa keluar dari mesin ini. */
function jalur() {
  if (RESEND_KEY) return 'api';
  if (SMTP_USER && SMTP_PASS) return 'smtp';
  return null;
}

function siap() {
  return jalur() !== null;
}

function ambilAngkut() {
  if (angkut) return angkut;
  if (!(SMTP_USER && SMTP_PASS)) return null;
  angkut = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    /* 465 = SMTPS (TLS sejak awal). 587 = STARTTLS, dinegosiasikan setelah
       sambungan terbuka. Salah pasangan port/secure adalah penyebab
       "connection timeout" paling umum — dan pesannya tidak menyebut port. */
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 12000,
    greetingTimeout: 8000,
    socketTimeout: 20000,
  });
  return angkut;
}

/** Status untuk diagnosa. TIDAK pernah memulangkan kredensial. */
function statusSurel() {
  const j = jalur();
  return {
    siap: siap(),
    jalur: j,
    pengirim: j === 'api' ? DARI_EMAIL : (SMTP_USER || null),
    /* Diagnosa yang paling sering dibutuhkan: kenapa belum siap. */
    catatan: j === null
      ? 'Isi RESEND_API_KEY (disarankan — lewat HTTPS 443) atau SMTP_USER/SMTP_PASS di .env'
      : j === 'smtp'
        ? 'Port SMTP keluar diblokir penyedia VPS; pengiriman kemungkinan besar timeout'
        : null,
    smtp: { host: SMTP_HOST, port: SMTP_PORT, terisi: Boolean(SMTP_USER && SMTP_PASS) },
  };
}

function amanHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function tanggalIndo(ms) {
  try {
    return new Date(ms).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar',
    });
  } catch { return ''; }
}

/* Surat sengaja pendek dan tanpa gambar. Email panjang bergambar dari
   pengirim yang belum dikenal adalah bentuk yang paling sering ditandai
   spam — dan surat pertama dari sebuah merek adalah surat yang paling
   tidak boleh nyasar ke folder spam. */
function susunSurat({ nama, kode, berakhir, jenis }) {
  const sapaan = nama ? `Halo ${nama},` : 'Halo,';
  const sampai = berakhir ? tanggalIndo(berakhir) : '';
  const label = jenis === 'bayar' ? 'Akses perintis' : 'Akses gratis';

  const teks = [
    sapaan,
    '',
    'Permintaan aksesmu ke Jadi Trader Tools sudah disetujui.',
    '',
    `Jenis akses : ${label}`,
    kode ? `Kode aktivasi : ${kode}` : '',
    sampai ? `Berlaku sampai : ${sampai}` : '',
    '',
    `Masuk di sini: ${SITUS}`,
    'Pakai akun yang sama dengan yang kamu daftarkan — aksesnya sudah menempel di akun itu,',
    'jadi biasanya kamu tidak perlu memasukkan kode apa pun.',
    '',
    'Kalau setelah masuk kamu masih terkunci, balas email ini dan sertakan kode di atas.',
    '',
    '—',
    'Jadi Trader Tools · PT Solusi Bursa Nusantara',
    'Alat bantu analisa pasar. Bukan nasihat investasi.',
    `Ketentuan lengkap: ${SITUS}/legal`,
  ].filter((b) => b !== null).join('\n');

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.65;color:#18181b;max-width:520px">
  <p style="margin:0 0 14px">${amanHtml(sapaan)}</p>
  <p style="margin:0 0 18px">Permintaan aksesmu ke <strong>Jadi Trader Tools</strong> sudah disetujui.</p>
  <table style="border-collapse:collapse;margin:0 0 20px;font-size:13.5px">
    <tr><td style="padding:3px 16px 3px 0;color:#71717a">Jenis akses</td><td style="padding:3px 0"><strong>${amanHtml(label)}</strong></td></tr>
    ${kode ? `<tr><td style="padding:3px 16px 3px 0;color:#71717a">Kode aktivasi</td><td style="padding:3px 0"><code style="background:#f4f4f5;padding:2px 6px;border-radius:4px">${amanHtml(kode)}</code></td></tr>` : ''}
    ${sampai ? `<tr><td style="padding:3px 16px 3px 0;color:#71717a">Berlaku sampai</td><td style="padding:3px 0"><strong>${amanHtml(sampai)}</strong></td></tr>` : ''}
  </table>
  <p style="margin:0 0 18px">
    <a href="${SITUS}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600">Masuk ke Jadi Trader Tools</a>
  </p>
  <p style="margin:0 0 18px;color:#52525b">Pakai akun yang sama dengan yang kamu daftarkan — aksesnya sudah menempel di akun itu, jadi biasanya kamu tidak perlu memasukkan kode apa pun. Kalau setelah masuk kamu masih terkunci, balas email ini dan sertakan kode di atas.</p>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:22px 0 14px">
  <p style="margin:0;font-size:12px;color:#71717a">
    Jadi Trader Tools · PT Solusi Bursa Nusantara<br>
    Alat bantu analisa pasar. <strong>Bukan nasihat investasi.</strong><br>
    <a href="${SITUS}/legal" style="color:#71717a">Ketentuan lengkap</a>
  </p>
</div>`;

  return { teks, html };
}

const SUBJEK = 'Akses Jadi Trader Tools kamu sudah aktif';

/** Kirim lewat API HTTPS Resend. fetch bawaan Node 18+ — tanpa dependensi
 *  baru, dan lewat port 443 yang terbukti tidak diblokir. */
async function kirimLewatApi({ email, teks, html, subjek, ke }) {
  const kendali = new AbortController();
  const jam = setTimeout(() => kendali.abort(), 15000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: dariHeader(),
        to: ke && ke.length ? ke : [email],
        reply_to: BALAS_KE,
        subject: subjek || SUBJEK,
        text: teks,
        html,
      }),
      signal: kendali.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      /* Pesan Resend dibawa apa adanya: "domain not verified" dan "invalid
         api key" adalah dua kegagalan paling sering, dan keduanya cuma bisa
         dibedakan dari teks aslinya. */
      return { terkirim: false, alasan: `Resend ${r.status}: ${j.message || j.name || 'ditolak'}` };
    }
    return { terkirim: true, id: j.id };
  } finally {
    clearTimeout(jam);
  }
}

/**
 * Kirim pemberitahuan persetujuan. TIDAK pernah melempar.
 * @returns {Promise<{terkirim:boolean, alasan?:string}>}
 */
async function kirimSuratPersetujuan({ email, nama, kode, berakhir, jenis }) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return { terkirim: false, alasan: 'alamat email tidak ada atau tidak sah' };
  }
  const j = jalur();
  if (!j) {
    console.log('[surel] belum dikonfigurasi — pemberitahuan dilewati untuk', email);
    return { terkirim: false, alasan: 'surel belum dikonfigurasi' };
  }

  const { teks, html } = susunSurat({ nama, kode, berakhir, jenis });

  try {
    if (j === 'api') {
      const h = await kirimLewatApi({ email, teks, html });
      if (h.terkirim) console.log('[surel] terkirim (api) ke', email, '·', h.id);
      else console.error('[surel] gagal (api) ke', email, '·', h.alasan);
      return h;
    }

    const t = ambilAngkut();
    if (!t) return { terkirim: false, alasan: 'SMTP belum dikonfigurasi' };
    const info = await t.sendMail({
      from: `"${DARI_NAMA}" <${SMTP_USER}>`,
      to: email,
      replyTo: BALAS_KE,
      subject: SUBJEK,
      text: teks,
      html,
    });
    console.log('[surel] terkirim (smtp) ke', email, '·', info.messageId);
    return { terkirim: true };
  } catch (e) {
    /* Dicatat, tidak dilempar. Persetujuan sudah sah tanpa email ini. */
    console.error('[surel] gagal kirim ke', email, '·', e.message);
    return { terkirim: false, alasan: e.message };
  }
}

/** Beri tahu pemilik bahwa ada permintaan akses baru.
 *  TIDAK pernah melempar, dan TIDAK pernah menahan jawaban HTTP —
 *  permintaannya sudah tercatat tanpa surat ini. */
async function kirimSuratPermintaanMasuk({ email, nama, produk, jenis, bukti, catatan }) {
  const j = jalur();
  if (!j) {
    console.log('[surel] belum dikonfigurasi — pemberitahuan permintaan dilewati');
    return { terkirim: false, alasan: 'surel belum dikonfigurasi' };
  }
  if (!SUREL_PEMILIK.length) return { terkirim: false, alasan: 'alamat pemilik kosong' };

  const baris = [
    ['Pemohon', nama || '(tanpa nama)'],
    ['Email', email || '(tidak ada)'],
    ['Produk', produk || '-'],
    ['Jenis', jenis === 'bayar' ? 'Berbayar' : 'Gratis'],
    ['Bukti', bukti === 'lynk' ? 'Lynk — sudah bayar' : (bukti || '-')],
    ['Alasan', catatan || '-'],
  ];

  const teks = 'Ada permintaan akses baru di Jadi Trader Tools.\n\n'
    + baris.map(([k, v]) => k + ': ' + v).join('\n')
    + '\n\nSetujui atau tolak di: ' + SITUS + '/maintenance'
    + '\n\nSurat ini otomatis — tidak perlu dibalas.';

  const html = '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;'
    + 'background:#0b0c0f;color:#e4e4e7;padding:24px">'
    + '<h2 style="margin:0 0 4px;font-size:17px">Permintaan akses baru</h2>'
    + '<p style="margin:0 0 16px;font-size:13px;color:#a1a1aa">Ada yang mendaftar dan menunggu persetujuanmu.</p>'
    + '<table style="border-collapse:collapse;font-size:13px">'
    + baris.map(([k, v]) =>
        '<tr><td style="padding:4px 14px 4px 0;color:#71717a;vertical-align:top">' + amanHtml(k)
        + '</td><td style="padding:4px 0;color:#e4e4e7">' + amanHtml(String(v)) + '</td></tr>').join('')
    + '</table>'
    + '<p style="margin:18px 0 0"><a href="' + SITUS + '/maintenance" '
    + 'style="display:inline-block;background:#fafafa;color:#09090b;padding:9px 16px;'
    + 'border-radius:7px;text-decoration:none;font-size:13px;font-weight:600">Buka panel persetujuan</a></p>'
    + '<p style="margin:16px 0 0;font-size:11px;color:#52525b">Surat otomatis dari ' + SITUS + '</p>'
    + '</div>';

  try {
    if (j === 'api') {
      const h = await kirimLewatApi({
        ke: SUREL_PEMILIK, email: SUREL_PEMILIK[0], teks, html,
        subjek: 'Permintaan akses baru — ' + (nama || email || 'pengguna'),
      });
      if (h.terkirim) console.log('[surel] pemberitahuan permintaan terkirim ·', h.id);
      else console.error('[surel] pemberitahuan permintaan gagal ·', h.alasan);
      return h;
    }
    const t = ambilAngkut();
    if (!t) return { terkirim: false, alasan: 'SMTP belum dikonfigurasi' };
    await t.sendMail({
      from: `"${DARI_NAMA}" <${SMTP_USER}>`,
      to: SUREL_PEMILIK.join(','),
      replyTo: BALAS_KE,
      subject: 'Permintaan akses baru — ' + (nama || email || 'pengguna'),
      text: teks, html,
    });
    return { terkirim: true };
  } catch (e) {
    console.error('[surel] pemberitahuan permintaan gagal ·', e.message);
    return { terkirim: false, alasan: e.message };
  }
}


/* ── Surat KEPUTUSAN berpesan ───────────────────────────────────────────
   Dipakai saat pemilik menyertakan alasan pada Setujui atau Tolak.

   Kenapa terpisah dari kirimSuratPersetujuan: surat itu menyampaikan KODE
   dan masa berlaku -- isinya sudah pasti sebelum tombolnya ditekan. Yang ini
   menyampaikan KEPUTUSAN beserta alasan yang diketik saat itu juga, dan
   penolakan tidak punya kode untuk disebut sama sekali. Memaksa keduanya ke
   satu susunan berarti surat penolakan yang penuh kolom kosong.

   Pesannya di-escape sebelum masuk HTML. Pemilik mengetik teks biasa, dan
   satu tanda kurung siku yang tidak sengaja akan merusak seluruh isi surat
   di sebagian klien surel. */
/* Kembarannya DIBUANG 1 Sep 2026. Berkas ini sempat punya dua amanHtml:
   yang di atas meloloskan tanda petik tunggal jadi &#39;, yang di sini
   tidak. Deklarasi fungsi diangkat ke atas, jadi yang BELAKANGAN menang --
   artinya versi yang lebih lemah itulah yang dipakai seluruh berkas,
   termasuk oleh surat-surat yang ditulis dengan asumsi versi kuat.

   Tidak ada galat, tidak ada peringatan. Cuma satu karakter yang diam-diam
   berhenti dijaga di tempat yang justru menerima nama orang asing. */

function susunSuratKeputusan({ nama, keputusan, pesan, produk }) {
  const sapa = nama ? 'Halo ' + nama + ',' : 'Halo,';
  const setuju = keputusan === 'disetujui';
  const judul = setuju ? 'Permintaan aksesmu disetujui' : 'Permintaan aksesmu belum bisa disetujui';
  const pembuka = setuju
    ? 'Permintaan aksesmu ke Jadi Trader Tools sudah disetujui.'
    : 'Terima kasih sudah mengajukan akses ke Jadi Trader Tools. Untuk saat ini permintaanmu belum bisa disetujui.';
  const penutup = setuju
    ? 'Silakan masuk kembali ke aplikasi -- aksesnya sudah aktif.'
    : 'Kalau menurutmu ini keliru, atau syaratnya sudah kamu penuhi, balas surat ini dan permintaanmu ditinjau lagi.';

  const teks = sapa + '\n\n' + pembuka + '\n'
    + (produk ? 'Produk: ' + produk + '\n' : '')
    + (pesan ? '\nCatatan dari kami:\n' + pesan + '\n' : '')
    + '\n' + penutup + '\n\n-- Jadi Trader Tools\nhttps://jaditrader.co.id';

  const html = '<!doctype html><html><body style="margin:0;padding:24px;background:#09090b;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e4e4e7">'
    + '<div style="max-width:520px;margin:0 auto;border:1px solid #27272a;border-radius:12px;padding:24px;background:#0f0f11">'
    + '<h1 style="margin:0 0 12px;font-size:17px;color:#fafafa">' + amanHtml(judul) + '</h1>'
    + '<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#a1a1aa">' + amanHtml(sapa) + '</p>'
    + '<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#a1a1aa">' + amanHtml(pembuka) + '</p>'
    + (produk ? '<p style="margin:0 0 14px;font-size:13px;color:#71717a">Produk: <span style="color:#d4d4d8">' + amanHtml(produk) + '</span></p>' : '')
    + (pesan ? '<div style="margin:0 0 16px;border-left:3px solid ' + (setuju ? '#10b981' : '#f59e0b') + ';padding:10px 14px;background:#18181b;border-radius:0 8px 8px 0">'
        + '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#71717a;margin-bottom:6px">Catatan dari kami</div>'
        + '<div style="font-size:14px;line-height:1.6;color:#e4e4e7;white-space:pre-wrap">' + amanHtml(pesan) + '</div></div>' : '')
    + '<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#a1a1aa">' + amanHtml(penutup) + '</p>'
    + '<a href="https://jaditrader.co.id" style="display:inline-block;background:#10b981;color:#052e21;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">Buka Jadi Trader Tools</a>'
    + '<p style="margin:20px 0 0;font-size:12px;color:#52525b">Surat ini dikirim otomatis dari jaditrader.co.id</p>'
    + '</div></body></html>';

  return { teks, html, subjek: judul };
}

/** Kirim surat keputusan. TIDAK pernah melempar -- keputusannya sudah sah
 *  tersimpan sebelum surat ini dicoba, dan gagal kirim tidak boleh terlihat
 *  seperti gagal memutuskan. */
async function kirimSuratKeputusan({ email, nama, keputusan, pesan, produk }) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return { terkirim: false, alasan: 'alamat email tidak ada atau tidak sah' };
  }
  const j = jalur();
  if (!j) {
    console.log('[surel] belum dikonfigurasi -- keputusan tidak dikabarkan ke', email);
    return { terkirim: false, alasan: 'surel belum dikonfigurasi' };
  }
  const { teks, html, subjek } = susunSuratKeputusan({ nama, keputusan, pesan, produk });
  try {
    if (j === 'api') return await kirimLewatApi({ email, teks, html, subjek });
    const t = ambilAngkut();
    if (!t) return { terkirim: false, alasan: 'SMTP belum dikonfigurasi' };
    const info = await t.sendMail({
      from: '"' + DARI_NAMA + '" <' + SMTP_USER + '>',
      to: email, replyTo: BALAS_KE, subject: subjek, text: teks, html,
    });
    return { terkirim: true, id: info.messageId };
  } catch (e) {
    console.error('[surel] keputusan gagal ke', email, '·', e && e.message);
    return { terkirim: false, alasan: e && e.message };
  }
}


/* ══ SURAT AKSES OTOMATIS ═════════════════════════════════════════════════
   Dikirim saat akses gratis disetujui sendiri, tanpa ada yang menekan
   tombol. Bedanya dengan kirimSuratPersetujuan bukan cuma kata-katanya:

   YANG DIKIRIM TAUTAN, BUKAN CUMA KODE. Kode menuntut orangnya membuka
   situs, mencari kolom yang benar, lalu menyalin dua belas karakter tanpa
   salah satu pun. Setiap langkah itu tempat orang berhenti. Tautannya
   membawa kodenya sendiri dan halaman aksesnya menukarkannya begitu
   dibuka.

   TAUTAN INI TIDAK RAHASIA, DAN MEMANG TIDAK PERLU. Kodenya sudah diikat
   ke akun yang memintanya pada saat diterbitkan, jadi siapa pun yang
   membukanya dengan akun lain ditolak /api/akses/aktifkan. Yang bocor
   cuma dua belas karakter yang tidak membuka apa pun di tangan orang
   lain. */
async function kirimSuratAksesOtomatis({ email, nama, kode, berakhir, hari }) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return { terkirim: false, alasan: 'alamat email tidak ada atau tidak sah' };
  }
  const j = jalur();
  if (!j) {
    console.log('[surel] belum dikonfigurasi — akses otomatis tidak dikabari untuk', email);
    return { terkirim: false, alasan: 'surel belum dikonfigurasi' };
  }

  /* ── SATU GAYA UNTUK SEMUA SURAT ────────────────────────────────────
     Disamakan dengan susunSurat() di atas: sapaan, satu kalimat pembuka,
     TABEL RINCIAN, tombol, penjelasan, lalu blok tanda tangan.

     Bukan soal selera. Tiga surat dengan tiga tata letak membuat orang
     yang menerima dua di antaranya bertanya-tanya apakah yang satu palsu --
     dan surat berisi tautan akses adalah persis jenis surat yang paling
     sering dicurigai. Keseragaman di sini fungsinya keamanan, bukan rapi.

     SELURUH nilai yang disisipkan lewat amanHtml(). Nama pendaftar datang
     dari akun Google/Discord orang lain; ia boleh berisi tanda kutip,
     kurung siku, apa pun. Menempelkannya mentah ke HTML berarti tata letak
     surat ditentukan oleh nama orang asing. */
  const tautan = SITUS + '/akses?kode=' + encodeURIComponent(String(kode || ''));
  const sapaan = nama ? 'Halo ' + String(nama).trim() + ',' : 'Halo,';
  const sampai = berakhir ? tanggalIndo(berakhir) : '';

  const teks = [
    sapaan,
    '',
    'Akses event gratis Jadi Trader Tools sudah aktif di akunmu.',
    'Tidak perlu menunggu ditinjau.',
    '',
    'Jenis akses    : Akses gratis (event)',
    sampai ? 'Berlaku sampai : ' + sampai + (hari ? ' (' + hari + ' hari)' : '') : '',
    'Kode cadangan  : ' + kode,
    '',
    'Buka aksesmu di sini:',
    tautan,
    '',
    'Tautan itu terikat ke akun yang mendaftar. Kalau dibuka dengan akun',
    'lain, ia ditolak -- jadi aman kalau surat ini kebetulan diteruskan.',
    '',
    'Kalau tautannya tidak bisa diklik, masuk lebih dulu lalu tempel kode',
    'cadangan di halaman Akses.',
    '',
    '--',
    'Jadi Trader Tools - PT Solusi Bursa Nusantara',
    'Alat bantu analisa pasar. Bukan nasihat investasi.',
    'Ketentuan lengkap: ' + SITUS + '/legal',
  ].filter(function (b) { return b !== ''; }).join('\n');

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.65;color:#18181b;max-width:520px">
  <p style="margin:0 0 14px">${amanHtml(sapaan)}</p>
  <p style="margin:0 0 18px">Akses <strong>event gratis</strong> Jadi Trader Tools sudah aktif di akunmu. Tidak perlu menunggu ditinjau.</p>
  <table style="border-collapse:collapse;margin:0 0 20px;font-size:13.5px">
    <tr><td style="padding:3px 16px 3px 0;color:#71717a">Jenis akses</td><td style="padding:3px 0"><strong>Akses gratis (event)</strong></td></tr>
    ${sampai ? `<tr><td style="padding:3px 16px 3px 0;color:#71717a">Berlaku sampai</td><td style="padding:3px 0"><strong>${amanHtml(sampai)}</strong>${hari ? ` <span style="color:#71717a">(${amanHtml(hari)} hari)</span>` : ''}</td></tr>` : ''}
    <tr><td style="padding:3px 16px 3px 0;color:#71717a">Kode cadangan</td><td style="padding:3px 0"><code style="background:#f4f4f5;padding:2px 6px;border-radius:4px">${amanHtml(kode)}</code></td></tr>
  </table>
  <p style="margin:0 0 18px">
    <a href="${amanHtml(tautan)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600">Buka akses saya</a>
  </p>
  <p style="margin:0 0 18px;color:#52525b">Tautan itu terikat ke akun yang mendaftar — dibuka dengan akun lain, ia ditolak. Jadi aman kalau surat ini kebetulan diteruskan. Kalau tombolnya tidak bisa diklik, masuk lebih dulu lalu tempel kode cadangan di halaman Akses.</p>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:22px 0 14px">
  <p style="margin:0;font-size:12px;color:#71717a">
    Jadi Trader Tools · PT Solusi Bursa Nusantara<br>
    Alat bantu analisa pasar. <strong>Bukan nasihat investasi.</strong><br>
    <a href="${SITUS}/legal" style="color:#71717a">Ketentuan lengkap</a>
  </p>
</div>`;

  try {
    if (j === 'api') {
      /* SUBJEK yang sama dengan surat persetujuan: orang yang menerima
         keduanya tidak perlu menebak apakah ini surat yang berbeda. */
      const h = await kirimLewatApi({ email, teks, html, subjek: SUBJEK });
      if (h.terkirim) console.log('[surel] akses otomatis terkirim (api) ke', email, '·', h.id);
      else console.error('[surel] akses otomatis gagal (api) ke', email, '·', h.alasan);
      return h;
    }
    const t = ambilAngkut();
    if (!t) return { terkirim: false, alasan: 'SMTP belum dikonfigurasi' };
    const info = await t.sendMail({
      from: `"${DARI_NAMA}" <${SMTP_USER}>`,
      to: email, replyTo: BALAS_KE, subject: SUBJEK, text: teks, html,
    });
    console.log('[surel] akses otomatis terkirim (smtp) ke', email, '·', info.messageId);
    return { terkirim: true };
  } catch (e) {
    /* Dicatat, tidak dilempar: aksesnya sudah sah tanpa surat ini. */
    console.error('[surel] akses otomatis gagal ke', email, '·', e.message);
    return { terkirim: false, alasan: e.message };
  }
}

module.exports = {
  kirimSuratPersetujuan, kirimSuratPermintaanMasuk, kirimSuratKeputusan,
  kirimSuratAksesOtomatis, statusSurel,
};
