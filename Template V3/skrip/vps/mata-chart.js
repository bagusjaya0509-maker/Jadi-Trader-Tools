/* ══════════════════════════════════════════════════════════════════════════
   mata-chart.js — membaca ZONA dari gambar chart yang diposting di grup
   ══════════════════════════════════════════════════════════════════════════
   Sebagian ruang analisa tidak menulis levelnya sebagai teks. Yang diposting
   sebuah TANGKAPAN LAYAR chart: kotak zona berwarna, garis, dan angka yang
   tercetak di dalam gambarnya. Pengurai pola tidak bisa berbuat apa-apa
   dengan itu — dan mengabaikannya berarti seluruh ruang itu tak terbaca.

   Berkas ini satu-satunya tempat di pemantau yang memanggil model bahasa,
   dan pemanggilannya DIBATASI berlapis supaya ongkosnya tidak bisa lepas
   kendali (lihat "PAGAR ONGKOS" di bawah).

   ── ATURAN YANG PALING PENTING: JANGAN MENGARANG ANGKA ────────────────────
   Kartu yang terbit dari sini memasang order sungguhan di terminal orang
   yang menyalin agennya. Model penglihatan sanggup MENEBAK harga dari posisi
   piksel terhadap sumbu — dan tebakan itu terbaca sama meyakinkannya dengan
   angka yang benar-benar tercetak.

   Karena itu jawabannya dipaksa membawa medan `pasti`:

       pasti: true   angkanya TERTULIS — label harga, teks di gambar, atau
                     di keterangan pesannya. Boleh jadi kartu.
       pasti: false  angkanya dibaca dari POSISI terhadap sumbu. Hanya boleh
                     jadi kabar di lonceng, TIDAK PERNAH jadi kartu.

   Pemanggilnya yang menegakkan aturan itu; di sini cuma dilaporkan apa
   adanya. Batas ini sengaja diletakkan di dua tempat.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const KUNCI = process.env.OPENROUTER_API_KEY || '';
/* Model penglihatan diambil dari daftar eskalasi yang sudah ada, entri
   PERTAMA. Daftar itu berbunyi "sonnet, lalu haiku" — dan untuk membaca
   angka kecil di tangkapan layar chart, yang lebih kuat memang yang
   dibutuhkan. Salah baca satu digit di sini bukan jawaban yang kurang
   bagus, melainkan stop loss di harga yang salah. */
const MODEL = String(process.env.OPENROUTER_MODEL_ESKALASI || 'anthropic/claude-sonnet-5')
  .split(',')[0].trim();

/* ── PAGAR ONGKOS ──────────────────────────────────────────────────────────
   Tiga lapis, dan ketiganya perlu:

   1. UKURAN GAMBAR. Gambar besar dikirim utuh berarti token gambar yang
      besar pula. Telegram sudah menyimpan tiap foto dalam beberapa ukuran;
      pemanggil memilih yang sedang, dan di sini yang kelewat besar ditolak
      mentah-mentah supaya satu poster iseng tidak bisa mengosongkan saldo.

   2. JATAH HARIAN. Disimpan di berkas, bukan di ingatan — proses yang
      di-restart pm2 sepuluh kali sehari dengan jatah di ingatan sama saja
      dengan tidak punya jatah sama sekali.

   3. SALDO OPENROUTER. Sudah ada di sisi sana; kalau habis, panggilannya
      gagal dan pemantau tetap jalan (kegagalan di sini tidak boleh
      menjatuhkan telinga 24 jamnya). */
const MAKS_BITA = 2 * 1024 * 1024;
const JATAH_HARIAN = Number(process.env.TG_GAMBAR_JATAH || 40);
const BERKAS_JATAH = path.join(__dirname, 'jatah-mata.json');

function hariIni() { return new Date().toISOString().slice(0, 10); }

function jatahBaca() {
  try {
    const d = JSON.parse(fs.readFileSync(BERKAS_JATAH, 'utf8'));
    return d && d.hari === hariIni() ? d : { hari: hariIni(), pakai: 0 };
  } catch (e) { return { hari: hariIni(), pakai: 0 }; }
}

function jatahTambah() {
  const d = jatahBaca();
  d.pakai += 1;
  try { fs.writeFileSync(BERKAS_JATAH, JSON.stringify(d)); } catch (e) { /* disk penuh */ }
  return d.pakai;
}

/** Sisa panggilan hari ini. Dipakai pemanggil untuk menulis log yang jujur
 *  saat jatahnya habis — "dilewati" tanpa sebab terbaca seperti kerusakan. */
function sisaJatah() { return Math.max(0, JATAH_HARIAN - jatahBaca().pakai); }

/** Berapa yang sudah terpakai hari ini. Dipasangkan dengan sisaJatah()
 *  supaya panel bisa menulis "12 dari 40" tanpa berhitung sendiri —
 *  perhitungan yang sama di dua tempat adalah dua tempat untuk salah. */
function pakaiJatah() { return jatahBaca().pakai; }

/* ── SAKLAR & JENDELA TANGGAL ─────────────────────────────────────────────
   Pagar ongkos keempat, dan satu-satunya yang dipegang TANGAN pemiliknya.

   Tiga pagar di atas menjawab "seberapa banyak"; yang ini menjawab
   "sekarang, atau tidak sama sekali". Ruang chart bisa ramai berhari-hari
   tanpa satu pun setup yang layak dibaca — dan selama itu tiap gambar tetap
   memanggil model penglihatan, satu per satu, sampai jatahnya habis. Uang
   yang keluar untuk membaca gambar yang tidak akan dipakai siapa pun.

   Dua kendali, sengaja terpisah:

     aktif  false = tidak ada satu pun panggilan model yang berangkat.
            Berhenti TOTAL, bukan diperlambat.

     dari / sampai  jendela tanggal (YYYY-MM-DD, WIB, keduanya inklusif).
            Gambar di luar jendela dilewati tanpa dibaca. Dipakai untuk
            "nyalakan lagi, tapi cuma untuk chart tanggal 3 sampai 5" —
            menyalakan ulang tanpa batas tanggal berarti seluruh antrean
            yang menumpuk selama mati ikut dibaca sekaligus, dan itu
            kebalikan dari berhemat.

   Disimpan di BERKAS, bukan di env: env cuma terbaca saat proses menyala,
   jadi mematikannya akan menuntut restart pm2 — dan sesuatu yang menahan
   pengeluaran harus bisa ditekan dari layar dalam satu detik. Berkas ini
   juga jembatan antar-proses: yang menulis backend web, yang membaca
   pemantau Telegram, dan keduanya proses pm2 yang berbeda. */
const BERKAS_SETELAN = path.join(__dirname, 'mata-setelan.json');
const SETELAN_BAWAAN = { aktif: true, dari: null, sampai: null, diubah: 0 };

function bacaSetelan() {
  try {
    const d = JSON.parse(fs.readFileSync(BERKAS_SETELAN, 'utf8'));
    return {
      /* `!== false`, bukan `=== true`: berkas lama yang belum punya medan
         ini harus terbaca sebagai MENYALA. Bawaan mati akan mematikan
         agennya diam-diam pada pembaruan pertama, dan tidak ada satu pun
         pesan di layar yang menjelaskan kenapa. */
      aktif: d.aktif !== false,
      dari: typeof d.dari === 'string' && d.dari ? d.dari : null,
      sampai: typeof d.sampai === 'string' && d.sampai ? d.sampai : null,
      diubah: Number(d.diubah) || 0,
    };
  } catch (e) { return { ...SETELAN_BAWAAN }; }
}

function tulisSetelan(v) {
  const isi = {
    aktif: v.aktif !== false,
    dari: v.dari || null,
    sampai: v.sampai || null,
    diubah: Date.now(),
  };
  fs.writeFileSync(BERKAS_SETELAN + '.tmp', JSON.stringify(isi, null, 2));
  fs.renameSync(BERKAS_SETELAN + '.tmp', BERKAS_SETELAN);
  return isi;
}

/** Tanggal menurut WIB, bukan UTC.
 *
 *  Pemiliknya memilih tanggal di kalendernya sendiri, dan VPS-nya berjalan
 *  di UTC. Tanpa pergeseran ini, chart yang diposting pukul 01.00 WIB
 *  tercatat sebagai hari SEBELUMNYA — jendela "3 sampai 5" akan diam-diam
 *  membuang tujuh jam pertama tiap harinya. */
function tglWib(ms) {
  return new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Boleh dibaca atau tidak, berikut ALASANNYA.
 *
 *  Alasan ikut dipulangkan karena log yang berbunyi "dilewati" tanpa sebab
 *  terbaca sebagai kerusakan — dan yang paling mahal dari kerusakan palsu
 *  adalah waktu yang dihabiskan mencarinya. */
function bolehBaca(waktuMs) {
  const s = bacaSetelan();
  if (!s.aktif) return { boleh: false, alasan: 'AI chart dihentikan dari panel', setelan: s };
  const t = tglWib(Number(waktuMs) || Date.now());
  if (s.dari && t < s.dari) return { boleh: false, alasan: 'chart ' + t + ' lebih tua dari batas ' + s.dari, setelan: s };
  if (s.sampai && t > s.sampai) return { boleh: false, alasan: 'chart ' + t + ' lewat batas ' + s.sampai, setelan: s };
  return { boleh: true, alasan: '', setelan: s };
}

const PERINTAH = `Kamu membaca SATU tangkapan layar chart trading dari ruang analisa.
Tugasmu melaporkan apa yang BENAR-BENAR TERGAMBAR di sana. Bukan menganalisa,
bukan menyarankan, bukan melengkapi yang tidak ada.

Jawab HANYA dengan satu objek JSON, tanpa teks lain, tanpa pagar kode:

{
  "pasangan": "BTCUSDT" | "XAUUSD" | null,
  "arah": "BUY" | "SELL" | null,
  "zona": [bawah, atas] | null,
  "entry": angka | null,
  "sl": angka | null,
  "tp": [angka, ...],
  "pasti": true | false,
  "catatan": "satu kalimat pendek tentang apa yang tergambar"
}

ATURAN:
- "pasti": true HANYA kalau angka-angka yang kamu laporkan TERCETAK sebagai
  teks — label harga di sumbu yang sejajar dengan garisnya, tulisan di dalam
  gambar, atau angka di keterangan pesan. Kalau kamu menaksir harga dari
  POSISI sebuah kotak atau garis terhadap sumbu, "pasti" WAJIB false.
- Jangan pernah mengarang SL atau TP yang tidak tergambar. Kosongkan saja.
  Laporan yang setengah jauh lebih berguna daripada laporan yang dilengkapi
  sendiri.
- "arah" diisi hanya kalau tergambar atau tertulis jelas (panah, label BUY/
  SELL, tulisan "long"/"short"). Zona merah di atas harga bukan bukti SELL.
- "zona" untuk kotak area (support/resistance/demand/supply): [bawah, atas].
- Kalau gambarnya bukan chart trading, pulangkan semua null dengan
  "catatan" menjelaskan isinya.`;

/** Membaca satu gambar chart.
 *
 *  @param {Buffer} bita     berkas gambarnya
 *  @param {string} ket      keterangan pesannya (sering memuat angkanya)
 *  @param {string} tipe     mime, mis. 'image/jpeg'
 *  @returns {Promise<object|null>} objek hasil, atau null kalau tidak bisa
 *           dibaca. null berarti "tidak tahu" — pemanggil TIDAK boleh
 *           menganggapnya "tidak ada sinyal".
 */
async function bacaGambarChart(bita, ket = '', tipe = 'image/jpeg', waktuMs = 0) {
  /* Gerbang PALING DEPAN, sebelum apa pun yang berbiaya. Pemanggilnya sudah
     memeriksa hal yang sama sebelum mengunduh gambarnya — dan itu memang
     disengaja. Gerbang yang cuma hidup di satu tempat akan bocor begitu
     pemanggil kedua muncul, dan yang bocor di sini adalah uang. */
  const izin = bolehBaca(waktuMs);
  if (!izin.boleh) return { galat: izin.alasan };
  if (!KUNCI) return { galat: 'OPENROUTER_API_KEY kosong' };
  if (!bita || !bita.length) return { galat: 'gambar kosong' };
  if (bita.length > MAKS_BITA) return { galat: 'gambar ' + Math.round(bita.length / 1024) + ' KB — di atas batas' };
  if (sisaJatah() <= 0) return { galat: 'jatah harian ' + JATAH_HARIAN + ' gambar sudah habis' };

  const b64 = Buffer.from(bita).toString('base64');
  let jawab;
  try {
    /* Batas waktu DIPASANG. Tanpa itu satu permintaan yang menggantung
       menahan penanganan pesan berikutnya — dan pemantau yang macet di
       satu gambar terlihat persis seperti grup yang sedang sepi. */
    const putus = AbortSignal.timeout(90000);
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: putus,
      headers: {
        Authorization: 'Bearer ' + KUNCI,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://jaditrader.co.id',
        'X-Title': 'Jadi Trader - Mata Chart',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PERINTAH + (ket ? '\n\nKeterangan pesannya:\n' + String(ket).slice(0, 600) : '') },
            { type: 'image_url', image_url: { url: 'data:' + tipe + ';base64,' + b64 } },
          ],
        }],
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { galat: 'openrouter ' + r.status + ' ' + t.slice(0, 160) };
    }
    jawab = await r.json();
  } catch (e) {
    return { galat: 'panggilan gagal: ' + (e && e.message) };
  }

  /* Jatah dihitung SESUDAH panggilannya benar-benar terjadi. Menghitung di
     depan berarti gambar yang ditolak sebelum berangkat ikut memakan jatah,
     dan jatah yang habis tanpa satu pun panggilan adalah kerusakan yang
     tidak terjelaskan dari log. */
  jatahTambah();

  const isi = jawab && jawab.choices && jawab.choices[0]
    && jawab.choices[0].message && jawab.choices[0].message.content;
  if (!isi) return { galat: 'jawaban kosong' };

  /* Pagar kode dibersihkan kalau modelnya tetap memasangnya walau diminta
     tidak. Perintah yang dilanggar sesekali itu wajar; membiarkan
     JSON.parse gagal karena tiga tanda petik bukan. */
  const bersih = String(isi).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  let d;
  try { d = JSON.parse(bersih); }
  catch (e) { return { galat: 'jawaban bukan JSON: ' + bersih.slice(0, 120) }; }

  const angka = (x) => {
    const n = Number(x);
    return isFinite(n) && n > 0 ? n : null;
  };
  return {
    pasangan: d.pasangan ? String(d.pasangan).toUpperCase().replace(/[^A-Z0-9]/g, '') : null,
    arah: d.arah === 'BUY' || d.arah === 'SELL' ? d.arah : null,
    zona: Array.isArray(d.zona) && d.zona.length === 2 && angka(d.zona[0]) && angka(d.zona[1])
      ? [Math.min(angka(d.zona[0]), angka(d.zona[1])), Math.max(angka(d.zona[0]), angka(d.zona[1]))]
      : null,
    entry: angka(d.entry),
    sl: angka(d.sl),
    tp: (Array.isArray(d.tp) ? d.tp : []).map(angka).filter(Boolean),
    /* Bawaannya FALSE. Model yang lupa mengisi medan ini tidak boleh
       diperlakukan sebagai model yang yakin — kelalaian bukan keyakinan. */
    pasti: d.pasti === true,
    catatan: String(d.catatan || '').slice(0, 200),
    model: MODEL,
  };
}

/** Hasil bacaan gambar → bentuk sinyal yang sama dengan keluaran Perangkai,
 *  supaya kartu-agen.js tidak perlu tahu sinyalnya datang dari teks atau
 *  dari gambar. Memulangkan null kalau isinya belum cukup.
 *
 *  DIPISAH dari pembacaannya dengan sengaja: yang di atas berurusan dengan
 *  jaringan dan model, yang ini murni aturan main — dan aturan main harus
 *  bisa dibaca tanpa ikut membaca kode jaringan. */
function keSinyal(hasil, idPesan) {
  if (!hasil || hasil.galat) return null;
  if (!hasil.pasangan || !hasil.arah) return null;
  const adaEntry = hasil.entry || hasil.zona;
  if (!adaEntry) return null;
  const lengkap = !!(hasil.sl && hasil.tp.length);
  return {
    id: 'mata-' + idPesan,
    jenis: lengkap ? 'sinyal' : 'pantau',
    pasangan: hasil.pasangan,
    pasanganDitebak: false,
    arah: hasil.arah,
    entry: hasil.entry || null,
    rentang: hasil.entry ? null : hasil.zona,
    sl: hasil.sl || null,
    tp: hasil.tp,
    potongan: 1,
    lengkap,
    /* Dibawa ikut supaya gerbang "hanya yang pasti boleh jadi kartu" bisa
       ditegakkan di pemantau tanpa memegang objek hasilnya lagi. */
    dariGambar: true,
    pasti: hasil.pasti,
  };
}

module.exports = {
  bacaGambarChart, keSinyal, sisaJatah, pakaiJatah, JATAH_HARIAN, MODEL,
  bacaSetelan, tulisSetelan, bolehBaca, tglWib,
};
