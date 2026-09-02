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


/* ══ BINGKAI SURAT ════════════════════════════════════════════════════════
   Kop dan kaki tinggal di SATU tempat, dan tiap surat cuma menyetor badannya.

   Bukan demi hemat baris. Sebelumnya blok tanda tangan yang sama disalin di
   tiga surat dan sudah mulai menyimpang -- dua bertema terang, satu gelap.
   Orang yang menerima dua di antaranya punya alasan wajar untuk curiga salah
   satunya palsu, dan surat berisi tautan akses adalah persis jenis surat yang
   paling sering dicurigai. Waktu surat keempat (pengingat masa gratis habis)
   ditulis nanti, ia mewarisi kop ini tanpa disalin lagi.

   ── KENAPA TABEL, BUKAN DIV ─────────────────────────────────────────────
   HTML surat memang kuno. Outlook di Windows merender lewat mesin Word, yang
   tidak mengenal flexbox maupun grid; div bersusun di sana runtuh jadi satu
   kolom kiri. Tabel bersarang dengan lebar sebagai ATRIBUT (bukan cuma CSS)
   adalah satu-satunya tata letak yang bisa dipercaya di semua klien.

   ── GAMBAR BOLEH HILANG ─────────────────────────────────────────────────
   Banyak klien tidak memuat gambar sampai penerimanya menekan "tampilkan
   gambar". Jadi nama merek ditulis sebagai TEKS di sebelah logo, bukan
   dijadikan bagian dari gambarnya. Kalau logonya diblokir, kop ini tetap
   terbaca -- yang hilang cuma hiasannya. Tidak ada satu pun informasi surat
   yang tinggal di dalam gambar.

   Lebarnya dikunci 600px: patokan lama yang bertahan karena panel baca
   Outlook memang selebar itu. */
const HURUF = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const KOP_GAMBAR = SITUS + '/brand/email-kop-128.png';

function bungkusSurat({ isi, pratinjau }) {
  /* Baris abu-abu di sebelah judul surat pada daftar kotak masuk. Tanpa ini
     Gmail mengambil kalimat pertama badan surat apa adanya. Ekor karakter tak
     terlihat itu mendorong sisa badan keluar dari cuplikan -- kalau tidak,
     pratinjaunya tersambung jadi satu kalimat aneh. */
  const sisip = pratinjau
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${amanHtml(pratinjau)}${'&#8199;&#65279;'.repeat(80)}</div>`
    : '';

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light"><title>Jadi Trader Tools</title></head>
<body style="margin:0;padding:0;background:#f4f4f5">${sisip}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px">

  <tr><td style="padding:22px 28px 16px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="middle" style="padding-right:11px">
        <img src="${KOP_GAMBAR}" width="34" height="34" alt="" style="display:block;width:34px;height:34px;border:0;border-radius:8px">
      </td>
      <td valign="middle" style="font-family:${HURUF};font-size:15px;font-weight:700;color:#18181b;letter-spacing:-.01em">Jadi Trader Tools</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 28px"><div style="height:1px;background:#e4e4e7;font-size:0;line-height:0">&nbsp;</div></td></tr>

  <tr><td style="padding:22px 28px 8px;font-family:${HURUF};font-size:14px;line-height:1.65;color:#18181b">
${isi}
  </td></tr>

  <tr><td style="padding:8px 28px 24px">
    <div style="height:1px;background:#e4e4e7;font-size:0;line-height:0;margin-bottom:14px">&nbsp;</div>
    <p style="margin:0;font-family:${HURUF};font-size:12px;line-height:1.65;color:#71717a">
      <strong style="color:#52525b">Jadi Trader Tools</strong> &middot; PT Solusi Bursa Nusantara<br>
      Alat bantu analisa pasar. <strong>Bukan nasihat investasi.</strong><br>
      <a href="${SITUS}/legal" style="color:#71717a">Ketentuan lengkap</a> &middot;
      <a href="mailto:${BALAS_KE}" style="color:#71717a">${BALAS_KE}</a>
    </p>
    <p style="margin:10px 0 0;font-family:${HURUF};font-size:11px;line-height:1.6;color:#a1a1aa">
      Kamu menerima surat ini karena mendaftar di jaditrader.co.id.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

/* ── TOMBOLNYA MENUNJUK /dashboard, BUKAN AKAR SITUS ────────────────────
   Sampai 2 Sep 2026 tombol "Masuk ke Jadi Trader Tools" menunjuk
   https://jaditrader.co.id begitu saja. Alamat itu halaman JUALAN: orang
   yang aksesnya baru disetujui mendarat di materi pemasaran dan harus
   mencari sendiri tombol masuknya.

   /dashboard benar di kedua keadaan, dan itu sebabnya ia dipilih:
     sudah masuk + aktif  -> langsung di dalam aplikasi
     belum masuk          -> gerbang di App.tsx melempar ke
                             /akses?dari=%2Fdashboard, dan halaman Akses
                             membaca `dari` itu untuk tombol "Buka aplikasi"

   Jadi tidak perlu menebak apakah penerimanya sedang punya sesi. */
/* Surat sengaja pendek. Satu logo kecil di kop, selebihnya teks.

   Catatan ini dulu berbunyi "tanpa gambar" dan alasannya masih berlaku:
   surat panjang penuh gambar dari pengirim yang belum dikenal adalah bentuk
   yang paling sering ditandai spam, dan surat pertama dari sebuah merek
   adalah surat yang paling tidak boleh nyasar ke sana. Yang berubah cuma
   takarannya -- satu gambar 1 KB di kop, bukan spanduk. Rasio teks terhadap
   gambar tetap berat di sisi teks, dan itu yang dihitung penyaring. */
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
    `Masuk di sini: ${SITUS}/dashboard`,
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

  const html = bungkusSurat({
    pratinjau: 'Permintaan aksesmu sudah disetujui — masuk pakai akun yang sama.',
    isi: `<p style="margin:0 0 14px">${amanHtml(sapaan)}</p>
  <p style="margin:0 0 18px">Permintaan aksesmu ke <strong>Jadi Trader Tools</strong> sudah disetujui.</p>
  <table style="border-collapse:collapse;margin:0 0 20px;font-size:13.5px">
    <tr><td style="padding:3px 16px 3px 0;color:#71717a">Jenis akses</td><td style="padding:3px 0"><strong>${amanHtml(label)}</strong></td></tr>
    ${kode ? `<tr><td style="padding:3px 16px 3px 0;color:#71717a">Kode aktivasi</td><td style="padding:3px 0"><code style="background:#f4f4f5;padding:2px 6px;border-radius:4px">${amanHtml(kode)}</code></td></tr>` : ''}
    ${sampai ? `<tr><td style="padding:3px 16px 3px 0;color:#71717a">Berlaku sampai</td><td style="padding:3px 0"><strong>${amanHtml(sampai)}</strong></td></tr>` : ''}
  </table>
  <p style="margin:0 0 18px">
    <a href="${SITUS}/dashboard" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600">Masuk ke Jadi Trader Tools</a>
  </p>
  <p style="margin:0;color:#52525b">Pakai akun yang sama dengan yang kamu daftarkan — aksesnya sudah menempel di akun itu, jadi biasanya kamu tidak perlu memasukkan kode apa pun. Kalau setelah masuk kamu masih terkunci, balas email ini dan sertakan kode di atas.</p>`,
  });

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

  /* ── DULU SATU-SATUNYA SURAT BERTEMA GELAP ────────────────────────────
     Latarnya #09090b sementara dua surat lain putih. Bukan pilihan gaya --
     ia ditulis belakangan dan meniru tampilan aplikasinya, bukan surat-surat
     sebelumnya. Sekarang ketiganya lewat bungkusSurat() yang sama.

     Terang, bukan gelap, karena surat berlatar gelap justru paling rapuh:
     klien yang punya mode gelap sendiri akan MEMBALIK warna yang sudah
     gelap, dan hasilnya teks abu di atas abu. Latar putih dibalik jadi
     gelap dengan rapi; latar gelap dibalik jadi berantakan. */
  const catatanHtml = pesan
    ? '<div style="margin:0 0 18px;border-left:3px solid ' + (setuju ? '#10b981' : '#f59e0b')
      + ';padding:10px 14px;background:#fafafa;border-radius:0 8px 8px 0">'
      + '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#71717a;margin-bottom:6px">Catatan dari kami</div>'
      + '<div style="font-size:14px;line-height:1.6;color:#3f3f46;white-space:pre-wrap">' + amanHtml(pesan) + '</div></div>'
    : '';

  /* Tombolnya cuma untuk yang disetujui. Sebelumnya surat penolakan pun
     memakai tombol "Buka Jadi Trader Tools" -- mengajak orang masuk ke
     tempat yang baru saja dibilang belum bisa ia masuki. Yang ditawarkan
     ke mereka adalah membalas surat ini, dan itu sudah ada di penutup. */
  const tombolHtml = setuju
    ? '<p style="margin:0 0 18px"><a href="' + SITUS + '/dashboard" style="display:inline-block;background:#18181b;color:#fff;'
      + 'text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600">Masuk ke Jadi Trader Tools</a></p>'
    : '';

  const html = bungkusSurat({
    pratinjau: setuju
      ? 'Permintaan aksesmu sudah disetujui — aksesnya aktif sekarang.'
      : 'Permintaan aksesmu belum bisa disetujui. Balas surat ini kalau ada yang keliru.',
    isi: '<p style="margin:0 0 14px">' + amanHtml(sapa) + '</p>'
      + '<p style="margin:0 0 18px">' + amanHtml(pembuka) + '</p>'
      + (produk
        ? '<table style="border-collapse:collapse;margin:0 0 18px;font-size:13.5px">'
          + '<tr><td style="padding:3px 16px 3px 0;color:#71717a">Produk</td>'
          + '<td style="padding:3px 0"><strong>' + amanHtml(produk) + '</strong></td></tr></table>'
        : '')
      + catatanHtml
      + tombolHtml
      + '<p style="margin:0;color:#52525b">' + amanHtml(penutup) + '</p>',
  });

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

  const html = bungkusSurat({
    pratinjau: 'Akses event gratismu sudah aktif — tidak perlu menunggu ditinjau.',
    isi: `<p style="margin:0 0 14px">${amanHtml(sapaan)}</p>
  <p style="margin:0 0 18px">Akses <strong>event gratis</strong> Jadi Trader Tools sudah aktif di akunmu. Tidak perlu menunggu ditinjau.</p>
  <table style="border-collapse:collapse;margin:0 0 20px;font-size:13.5px">
    <tr><td style="padding:3px 16px 3px 0;color:#71717a">Jenis akses</td><td style="padding:3px 0"><strong>Akses gratis (event)</strong></td></tr>
    ${sampai ? `<tr><td style="padding:3px 16px 3px 0;color:#71717a">Berlaku sampai</td><td style="padding:3px 0"><strong>${amanHtml(sampai)}</strong>${hari ? ` <span style="color:#71717a">(${amanHtml(hari)} hari)</span>` : ''}</td></tr>` : ''}
    <tr><td style="padding:3px 16px 3px 0;color:#71717a">Kode cadangan</td><td style="padding:3px 0"><code style="background:#f4f4f5;padding:2px 6px;border-radius:4px">${amanHtml(kode)}</code></td></tr>
  </table>
  <p style="margin:0 0 18px">
    <a href="${amanHtml(tautan)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600">Buka akses saya</a>
  </p>
  <p style="margin:0;color:#52525b">Tautan itu terikat ke akun yang mendaftar — dibuka dengan akun lain, ia ditolak. Jadi aman kalau surat ini kebetulan diteruskan. Kalau tombolnya tidak bisa diklik, masuk lebih dulu lalu tempel kode cadangan di halaman Akses.</p>`,
  });

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


/* ══ SURAT PENGINGAT MASA AKSES ═══════════════════════════════════════════
   Surat pertama yang ditulis SESUDAH bingkainya ada, dan itu terlihat: ia
   tidak menyalin kop maupun tanda tangan dari mana pun.

   Satu fungsi untuk dua keadaan, bukan dua surat. Yang membedakan "tiga
   hari lagi" dan "sudah berakhir kemarin" cuma tanggalnya; menulisnya jadi
   dua fungsi berarti dua tempat yang harus diperbaiki tiap kali kalimatnya
   berubah, dan yang satu pasti tertinggal.

   ── YANG TIDAK BOLEH DIJANJIKAN ─────────────────────────────────────────
   Kalimat "datamu tidak dihapus" dicek dulu ke kodenya, bukan ditulis
   karena enak dibaca. Yang terjadi saat masa akses lewat: hitungLangganan()
   di auth.tsx menjatuhkan statusnya ke 'habis' dan orangnya diarahkan ke
   /akses. Tidak ada penyapu yang menghapus jurnal, catatan, atau setelan --
   sudah dicari, memang tidak ada. Jadi kalimat itu boleh berdiri.

   Kalau suatu hari penyapu itu dibuat, kalimat DI SINI yang harus ikut
   diubah. Surat yang menjanjikan sesuatu yang tidak lagi benar lebih buruk
   daripada surat yang tidak dikirim. */
async function kirimSuratPengingat({ email, nama, berakhir, sisaHari }) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return { terkirim: false, alasan: 'alamat email tidak ada atau tidak sah' };
  }
  const j = jalur();
  if (!j) return { terkirim: false, alasan: 'surel belum dikonfigurasi' };

  const sampai = tanggalIndo(berakhir);
  const sisa = Number(sisaHari);
  const lewat = sisa <= 0;
  const sapaan = nama ? 'Halo ' + String(nama).trim() + ',' : 'Halo,';
  /* ── KE DAFTAR PAKET, BUKAN KE HALAMAN MASUK ────────────────────────
     Diminta pemilik 2 Sep 2026: "untuk yang email reminder langsung
     arahkan ke harga paket."

     Dan itu benar secara isi, bukan cuma selera. Orang yang menerima surat
     ini SUDAH punya akun -- ia sudah mendaftar, sudah dipakaikan akses
     gratis selama 30 hari. Mengirimnya ke halaman masuk berarti menjawab
     pertanyaan yang tidak ia punya. Yang belum ia lihat adalah harganya.

     /harga sengaja dikeluarkan dari gerbang di App.tsx pada hari yang sama;
     tanpa itu tautan ini memantul ke layar minta-akses. Kalau suatu saat
     gerbang itu dipasang kembali, tautan DI SINI ikut mati diam-diam. */
  const tautan = SITUS + '/harga';

  /* Judulnya menyebut TANGGAL, bukan "segera". Orang yang membuka kotak
     masuknya seminggu kemudian masih tahu persis apa yang dibicarakan --
     dan "segera" di surat berumur seminggu tidak berarti apa-apa. */
  const subjek = lewat
    ? 'Akses gratis Jadi Trader Tools kamu sudah berakhir'
    : 'Akses gratis Jadi Trader Tools berakhir ' + sampai;

  const kalimat = lewat
    ? 'Masa akses gratismu di Jadi Trader Tools berakhir pada ' + sampai + '.'
    : 'Akses gratismu di Jadi Trader Tools berakhir ' + sampai
      + ' — ' + sisa + ' hari lagi.';

  const penjelasan = lewat
    ? 'Kamu masih bisa masuk dengan akun yang sama, tapi halaman-halamannya '
      + 'terkunci sampai aksesnya diperpanjang. Jurnal, catatan, dan setelanmu '
      + 'tidak dihapus — semuanya kembali seperti semula begitu akses aktif lagi.'
    : 'Sesudah tanggal itu kamu masih bisa masuk dengan akun yang sama, tapi '
      + 'halaman-halamannya terkunci sampai aksesnya diperpanjang. Jurnal, '
      + 'catatan, dan setelanmu tidak dihapus — semuanya kembali seperti semula '
      + 'begitu akses aktif lagi.';

  const teks = [
    sapaan,
    '',
    kalimat,
    '',
    'Jenis akses : Akses gratis (event)',
    'Berakhir    : ' + sampai,
    lewat ? '' : 'Sisa waktu  : ' + sisa + ' hari',
    '',
    'Lihat paket dan harganya di sini:',
    tautan,
    '',
    penjelasan,
    '',
    'Kalau ada yang mau ditanyakan sebelum memutuskan, balas surat ini.',
    '',
    '--',
    'Jadi Trader Tools - PT Solusi Bursa Nusantara',
    'Alat bantu analisa pasar. Bukan nasihat investasi.',
    'Ketentuan lengkap: ' + SITUS + '/legal',
  ].filter(function (b) { return b !== ''; }).join('\n');

  const html = bungkusSurat({
    pratinjau: lewat
      ? 'Masa akses gratismu sudah berakhir. Datamu tetap tersimpan.'
      : 'Sisa ' + sisa + ' hari. Datamu tetap tersimpan apa pun keputusanmu.',
    isi: `<p style="margin:0 0 14px">${amanHtml(sapaan)}</p>
  <p style="margin:0 0 18px">${amanHtml(kalimat)}</p>
  <table style="border-collapse:collapse;margin:0 0 20px;font-size:13.5px">
    <tr><td style="padding:3px 16px 3px 0;color:#71717a">Jenis akses</td><td style="padding:3px 0"><strong>Akses gratis (event)</strong></td></tr>
    <tr><td style="padding:3px 16px 3px 0;color:#71717a">Berakhir</td><td style="padding:3px 0"><strong>${amanHtml(sampai)}</strong></td></tr>
    ${lewat ? '' : `<tr><td style="padding:3px 16px 3px 0;color:#71717a">Sisa waktu</td><td style="padding:3px 0"><strong>${amanHtml(String(sisa))} hari</strong></td></tr>`}
  </table>
  <p style="margin:0 0 18px">
    <a href="${tautan}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600">Lihat paket &amp; harga</a>
  </p>
  <p style="margin:0 0 12px;color:#52525b">${amanHtml(penjelasan)}</p>
  <p style="margin:0;color:#52525b">Kalau ada yang mau ditanyakan sebelum memutuskan, balas surat ini.</p>`,
  });

  try {
    if (j === 'api') {
      const h = await kirimLewatApi({ email, teks, html, subjek });
      if (h.terkirim) console.log('[surel] pengingat terkirim (api) ke', email, '·', h.id);
      else console.error('[surel] pengingat gagal (api) ke', email, '·', h.alasan);
      return h;
    }
    const t = ambilAngkut();
    if (!t) return { terkirim: false, alasan: 'SMTP belum dikonfigurasi' };
    const info = await t.sendMail({
      from: `"${DARI_NAMA}" <${SMTP_USER}>`,
      to: email, replyTo: BALAS_KE, subject: subjek, text: teks, html,
    });
    console.log('[surel] pengingat terkirim (smtp) ke', email, '·', info.messageId);
    return { terkirim: true };
  } catch (e) {
    console.error('[surel] pengingat gagal ke', email, '·', e.message);
    return { terkirim: false, alasan: e.message };
  }
}

module.exports = {
  kirimSuratPersetujuan, kirimSuratPermintaanMasuk, kirimSuratKeputusan,
  kirimSuratAksesOtomatis, kirimSuratPengingat, statusSurel,
};
