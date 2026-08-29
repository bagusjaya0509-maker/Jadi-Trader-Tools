#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   agen-naratif.js — analis model, dengan pagar yang membuatnya tidak bisa
                     mengarang
   ══════════════════════════════════════════════════════════════════════════
   Lima agen yang sudah ada menjalankan aturan tetap: kondisinya dihitung
   kode, angkanya keluar dari rumus. Yang ini berbeda — keputusannya diambil
   model bahasa. Itu membuka satu hal yang tidak bisa diberikan aturan tetap
   (ALASAN yang ditulis dengan kalimat, bukan nama strategi) dan membuka satu
   bahaya yang tidak dimiliki aturan tetap sama sekali: model bisa menuliskan
   angka yang terdengar masuk akal dan tidak pernah ada di chart mana pun.

   Permintaan pemiliknya jelas: "pastikan analisanya yang betul, jangan
   ngasal". Itu tidak bisa dijawab dengan menyuruh model berhati-hati di
   dalam prompt. Ia dijawab dengan bentuk sistemnya.

   ══ SATU ATURAN YANG MEMBENTUK SELURUH BERKAS INI ═════════════════════════

        MODEL TIDAK PERNAH MENGETIK HARGA.

   Kode menghitung level dari lilin sungguhan, memberinya nomor (S1, S2, R1,
   R2, …), lalu model MEMILIH nomor. Entry, stop, dan target semuanya
   dirujuk lewat nomor itu. Angka yang tidak ada di chart jadi mustahil
   secara struktur — bukan sekadar "tidak mungkin karena modelnya bagus".

   Ini perbedaan antara pagar dan imbauan. Prompt yang berbunyi "jangan
   mengarang harga" tetap menyerahkan keputusannya kepada model; menu nomor
   mencabut kemampuannya untuk mengarang.

   ══ LIMA PAGAR SESUDAHNYA ════════════════════════════════════════════════

   1. GERBANG HITUNGAN. Arah harus konsisten (BUY: sl < entry < tp), RR
      minimal 1,5, jarak stop antara 0,4x dan 3x ATR, entry tidak lebih jauh
      dari 2x ATR dari harga sekarang. Gagal satu saja -> dibuang.

   2. PENYANGGAH. Panggilan KEDUA ke model, dengan lembar fakta yang sama
      dan usulan yang pertama, tugasnya MENJATUHKAN usulan itu. Sinyal cuma
      lolos kalau penyanggah gagal menemukan cacat. Satu panggilan tambahan
      per usulan, dan ia yang paling banyak menahan sinyal buruk.

   3. TUNGGU ITU JAWABAN YANG SAH, dan yang paling sering benar. Agen yang
      wajib mengeluarkan sinyal tiap empat jam akan mengarang setup di empat
      dari enam putaran. Prompt-nya menyebut tegas bahwa tidak ada setup
      adalah hasil yang baik.

   4. KEYAKINAN MINIMAL 4 DARI 5. Model yang ragu diminta mengatakannya, dan
      yang ragu tidak diterbitkan.

   5. TIDAK MENUMPUK. Satu pasangan yang sudah punya sinyal hidup dilewati.

   ══ YANG TIDAK BISA DIJANJIKAN ═══════════════════════════════════════════
   Pagar-pagar di atas menjamin angkanya nyata, arahnya konsisten, dan
   rasionya masuk akal. Ia TIDAK menjamin analisanya menang. Tidak ada yang
   bisa menjamin itu, dan siapa pun yang mengatakannya sedang berjualan.

   Beda paling jujur dengan lima agen lain: strategi aturan bisa diuji ulang
   atas dua tahun riwayat sampai keluar angkanya. Yang ini tidak bisa —
   tidak ada cara memutar ulang model atas Januari 2024. Jadi kartunya lahir
   tanpa rekam jejak, dan harus tetap gratis sampai ia punya angkanya
   sendiri dari forward test.

   Pakai:  node agen-naratif.js            (terbitkan)
           node agen-naratif.js --kering   (cetak saja, tidak menerbitkan)
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const path = require('path');
const AKAR = __dirname;
try { require('dotenv').config({ path: path.join(AKAR, '.env') }); } catch (e) { /* uji lokal */ }

const { klines, atr, ema } = require('./agen-sinyal');

const TOKEN = process.env.APP_TOKEN;
const LOKAL = 'http://127.0.0.1:' + (process.env.PORT || 4000);
const KUNCI = process.env.OPENROUTER_API_KEY || '';
const MODEL = (process.env.NARATIF_MODEL || 'anthropic/claude-sonnet-5').trim();

const NAMA = process.env.NARATIF_NAMA || 'Agen Naratif';
const TF = process.env.NARATIF_TF || '4h';
const PASANGAN = (process.env.NARATIF_PASANGAN || 'BTCUSDT,ETHUSDT,SOLUSDT')
  .split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);

/* Ambang gerbang. Diletakkan di satu tempat supaya bisa diperketat sesudah
   forward test tanpa menyisir kodenya. */
const RR_MIN = Number(process.env.NARATIF_RR_MIN || 1.5);
const SL_ATR_MIN = Number(process.env.NARATIF_SL_ATR_MIN || 0.4);
const SL_ATR_MAKS = Number(process.env.NARATIF_SL_ATR_MAKS || 3);
const ENTRY_ATR_MAKS = Number(process.env.NARATIF_ENTRY_ATR_MAKS || 2);
const KEYAKINAN_MIN = Number(process.env.NARATIF_KEYAKINAN_MIN || 4);

const KERING = process.argv.includes('--kering');

function jam() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
function catat(...a) { console.log('[' + jam() + ']', ...a); }

/* Desimal mengikuti harga simbolnya. Angka sembilan desimal di papan publik
   terbaca sebagai kecerobohan, dan ditolak bursa saat dipakai order. */
function rapikan(x, contoh) {
  const d = (String(contoh).split('.')[1] || '').length;
  return Number(x.toFixed(Math.min(8, d || 2)));
}

/* ── SWING, DENGAN KONFIRMASI ──────────────────────────────────────────
   Fraktal 2 bar di kiri dan 2 bar di kanan. Konfirmasi kanan WAJIB: swing
   yang diakui sebelum dua bar berikutnya tutup adalah swing yang bisa
   dibatalkan bar berikutnya, dan level yang berubah sesudah sinyalnya
   terbit membuat stop-nya pindah tanpa ada yang memindahkan. */
function swing(bar, kiri = 2, kanan = 2) {
  const atas = [];
  const bawah = [];
  for (let i = kiri; i < bar.length - kanan; i++) {
    let hi = true;
    let lo = true;
    for (let j = i - kiri; j <= i + kanan; j++) {
      if (j === i) continue;
      if (bar[j].h >= bar[i].h) hi = false;
      if (bar[j].l <= bar[i].l) lo = false;
    }
    if (hi) atas.push({ harga: bar[i].h, umurBar: bar.length - 1 - i });
    if (lo) bawah.push({ harga: bar[i].l, umurBar: bar.length - 1 - i });
  }
  return { atas, bawah };
}

/* ── MENU LEVEL ───────────────────────────────────────────────────────
   Inti dari seluruh berkas ini. Yang dikirim ke model bukan "pilih harga",
   melainkan "pilih salah satu dari daftar ini" — dan daftarnya seluruhnya
   berasal dari lilin yang benar-benar ada.

   Yang berdekatan digabung: dua swing berjarak seperempat ATR adalah satu
   level yang sama dilihat dua kali, dan menyodorkan keduanya cuma memberi
   model pilihan palsu yang tidak berarti apa-apa. */
function menuLevel(bar, harga, a) {
  const { atas, bawah } = swing(bar);
  const rapat = a * 0.25;

  const pilihSisi = (daftar, kode, arahJauh) => {
    const urut = daftar.slice().sort((x, y) => arahJauh * (x.harga - y.harga));
    const out = [];
    for (const s of urut) {
      if (out.some((o) => Math.abs(o.harga - s.harga) < rapat)) continue;
      out.push(s);
      if (out.length >= 4) break;
    }
    return out.map((s, i) => ({
      id: kode + (i + 1),
      harga: s.harga,
      umurBar: s.umurBar,
      jarakAtr: Math.abs(s.harga - harga) / a,
    }));
  };

  return [
    /* Support: swing bawah DI BAWAH harga, terdekat dulu. */
    ...pilihSisi(bawah.filter((s) => s.harga < harga), 'S', -1),
    /* Resistance: swing atas DI ATAS harga, terdekat dulu. */
    ...pilihSisi(atas.filter((s) => s.harga > harga), 'R', 1),
  ];
}

/* ── POSISI PASAR ─────────────────────────────────────────────────────
   Tiga angka yang tidak ada di lilin, gratis, dan nyata:

     · funding — siapa yang membayar siapa. Positif berarti long membayar
       short; kalau ia tinggi sementara harga tidak naik, sisi long sedang
       ramai dan mahal.
     · perubahan open interest — uang masuk atau keluar. Harga naik dengan
       OI naik berbeda artinya dengan harga naik karena short ditutup.
     · rasio akun long/short — berapa banyak akun ritel di tiap sisi.

   Disebut "posisi pasar", BUKAN "fundamental". Fundamental yang sebenarnya
   — kebijakan bank sentral, aliran ETF, berita — tidak ada di sini, dan
   prompt-nya melarang tegas model menyebut-nyebutnya. Model yang boleh
   berspekulasi tentang berita akan mengarang berita; itu bukan kemungkinan,
   itu keniscayaan.

   Kegagalan mengambilnya TIDAK menjatuhkan analisanya — medannya cuma jadi
   null, dan prompt menyuruh mengabaikan yang null. Data tambahan yang bisa
   mematikan agen saat penyedianya batuk adalah data yang biayanya lebih
   besar daripada gunanya. */
const FAPI = (process.env.BINANCE_BASE_URL || 'https://fapi.binance.com').replace(/\/$/, '');

async function jsonAman(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

async function posisiPasar(pasangan) {
  const [prem, oi, ls] = await Promise.all([
    jsonAman(FAPI + '/fapi/v1/premiumIndex?symbol=' + pasangan),
    jsonAman(FAPI + '/futures/data/openInterestHist?symbol=' + pasangan + '&period=4h&limit=7'),
    jsonAman(FAPI + '/futures/data/globalLongShortAccountRatio?symbol=' + pasangan + '&period=4h&limit=2'),
  ]);
  const out = { fundingPersen: null, oiUbah24jPersen: null, rasioLongShort: null };
  if (prem && prem.lastFundingRate !== undefined) {
    out.fundingPersen = Number((Number(prem.lastFundingRate) * 100).toFixed(4));
  }
  if (Array.isArray(oi) && oi.length >= 2) {
    const a = Number(oi[0].sumOpenInterest);
    const b = Number(oi[oi.length - 1].sumOpenInterest);
    if (a > 0) out.oiUbah24jPersen = Number(((b - a) / a * 100).toFixed(2));
  }
  if (Array.isArray(ls) && ls.length) {
    out.rasioLongShort = Number(Number(ls[ls.length - 1].longShortRatio).toFixed(3));
  }
  return out;
}

/* ── LEMBAR FAKTA ─────────────────────────────────────────────────────
   Semua yang dilihat model, dan tidak ada yang lain. Ditulis kode dari
   lilin sungguhan; model tidak pernah menyentuh sumber datanya sendiri. */
async function lembarFakta(pasangan, bar) {
  const a = atr(bar, 14);
  const harga = bar[bar.length - 1].c;
  const tutup = bar.map((b) => b.c);
  const e20 = ema(tutup.slice(-60), 20);
  const e50 = ema(tutup.slice(-150), 50);
  const e200 = tutup.length >= 200 ? ema(tutup, 200) : null;

  const n = 60;
  const potong = bar.slice(-n);
  const tertinggi = Math.max(...potong.map((b) => b.h));
  const terendah = Math.min(...potong.map((b) => b.l));

  return {
    pasangan,
    tf: TF,
    harga: rapikan(harga, harga),
    atr14: rapikan(a, harga),
    atrPersen: Number((a / harga * 100).toFixed(2)),
    ema20: rapikan(e20, harga),
    ema50: rapikan(e50, harga),
    ema200: e200 === null ? null : rapikan(e200, harga),
    tertinggi60bar: rapikan(tertinggi, harga),
    terendah60bar: rapikan(terendah, harga),
    posisiDalamRange: Number(((harga - terendah) / (tertinggi - terendah || 1) * 100).toFixed(1)),
    /* Dua belas bar terakhir apa adanya. Model butuh bentuk pergerakannya,
       bukan cuma ringkasannya — tapi dua ratus bar cuma menaikkan ongkos
       tanpa menambah yang bisa dipakainya. */
    bar12: bar.slice(-12).map((b) => ({
      o: rapikan(b.o, harga), h: rapikan(b.h, harga),
      l: rapikan(b.l, harga), c: rapikan(b.c, harga),
    })),
    pasar_: await posisiPasar(pasangan),
    level: menuLevel(bar, harga, a).map((l) => ({
      id: l.id,
      harga: rapikan(l.harga, harga),
      umurBar: l.umurBar,
      jarakAtr: Number(l.jarakAtr.toFixed(2)),
    })),
  };
}

/* ── PANGGILAN MODEL ──────────────────────────────────────────────────
   temperature 0. Ini bukan penulisan kreatif: dua putaran atas data yang
   sama harus memberi jawaban yang sama, kalau tidak tidak ada yang bisa
   diperiksa saat hasilnya nanti dinilai. */
/* 1500, bukan 700. Uji pertama gagal persis di sini: `finish=max_tokens`,
   jawaban terpotong di tengah JSON, dan layarnya cuma berbunyi "balasan
   kosong". Model menulis alasan yang panjang sebelum sampai ke kesimpulan,
   dan memotongnya berarti membuang seluruh panggilannya. Token keluaran
   ditagih sesuai yang terpakai, jadi batas yang longgar tidak menaikkan
   ongkos untuk jawaban yang memang pendek. */
/* Satu kali coba lagi kalau jawabannya terpotong. Model ini menulis
   penalaran panjang sebelum sampai ke JSON, dan panjangnya berbeda-beda per
   pasangan: pada uji nyata BTC dan ETH selesai dalam 1500 token sementara
   SOL menghabiskannya. Menaikkan batas untuk semua berarti membayar
   kelonggaran yang cuma dipakai satu dari tiga.

   Percobaan kedua menambahkan perintah ringkas DAN menaikkan batasnya.
   Kalau tetap terpotong, gugur — lebih baik satu pasangan dilewati daripada
   JSON separuh yang dipaksa terbaca. */
async function panggilSekali(pesan, maksToken) {
  const ac = new AbortController();
  const jamHenti = setTimeout(() => ac.abort(), 60000);
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        Authorization: 'Bearer ' + KUNCI,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://jaditrader.co.id',
        'X-Title': 'Jadi Trader - Agen Naratif',
      },
      body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: maksToken, messages: pesan }),
    });
    if (!r.ok) {
      const teks = await r.text().catch(() => '');
      return { galat: 'HTTP ' + r.status + (teks ? ' · ' + teks.slice(0, 200) : '') };
    }
    const d = await r.json();
    const c = d.choices && d.choices[0];
    const isi = c && c.message && c.message.content;
    if (isi) return { isi };
    /* Balasan kosong DIJELASKAN, bukan cuma dilaporkan kosong. Tiga sebab
       yang bentuknya sama di layar tapi butuh perbaikan yang berbeda:
       kehabisan max_tokens, penolakan model, dan galat penyedia yang lolos
       sebagai HTTP 200. Tanpa alasan bawaannya, ketiganya cuma "kosong". */
    return { galat: 'balasan kosong · finish=' + (c && c.finish_reason)
      + ' native=' + (c && c.native_finish_reason)
      + ' err=' + (d.error && (d.error.message || JSON.stringify(d.error)) || '-')
      + ' usage=' + JSON.stringify(d.usage && { p: d.usage.prompt_tokens, c: d.usage.completion_tokens }) };
  } catch (e) {
    return { galat: e.name === 'AbortError' ? 'timeout' : 'jaringan' };
  } finally {
    clearTimeout(jamHenti);
  }
}

async function panggil(pesan, maksToken = 1500) {
  const a = await panggilSekali(pesan, maksToken);
  if (!a.galat || !/finish=length/.test(a.galat)) return a;
  const ringkas = pesan.concat([{ role: 'system', content:
    'Jawabanmu barusan terpotong karena terlalu panjang. Jawab lagi, LANGSUNG '
    + 'JSON-nya saja, dan buat medan "alasan" maksimal 45 kata.' }]);
  return panggilSekali(ringkas, Math.min(4000, maksToken * 2));
}

/* Keluaran model diperlakukan sebagai TEKS KOTOR, bukan JSON. Model rutin
   membungkusnya dengan ```json atau menambah kalimat pengantar, dan
   JSON.parse langsung adalah cara paling umum fitur seperti ini mati. */
function uraikan(teks) {
  if (!teks) return null;
  let t = String(teks).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

/* ══ LINGKAR BELAJAR ═══════════════════════════════════════════════════
   Permintaan pemiliknya: agen ini harus MENGINGAT dan memperbaiki dirinya.

   Yang dipakai belajar bukan pendapat, melainkan hasil forward test-nya
   sendiri — satu-satunya bukti yang benar-benar ada untuk agen semacam ini.
   Strategi aturan bisa diuji ulang atas dua tahun riwayat; model tidak
   bisa. Jadi bahan belajarnya harus dikumpulkan hari demi hari.

   Dua berkas, dua peran yang berbeda:

     naratif-jurnal.json    setiap usulan, terbit maupun ditolak, LENGKAP
                            dengan lembar faktanya. Ini bahan mentahnya, dan
                            yang DITOLAK sama berharganya dengan yang terbit:
                            tanpa mereka tidak ada cara tahu apakah gerbangnya
                            terlalu ketat atau terlalu longgar.

     naratif-pelajaran.md   kesimpulan yang sudah disuling, ikut masuk ke
                            prompt tiap analisa. Pendek dengan sengaja — file
                            pelajaran yang tumbuh tanpa batas akan menenggelamkan
                            lembar faktanya sendiri, dan model mulai menjawab
                            catatan lamanya alih-alih chart di depannya.

   Yang menulis pelajaran bukan berkas ini setiap putaran, melainkan mode
   `--nilai` yang dijalankan terpisah sesudah cukup sinyal selesai. Memisahkan
   "menganalisa" dari "menilai diri" penting: agen yang mengubah
   pelajarannya di tengah putaran analisa akan menilai dirinya dengan
   pelajaran yang baru saja ia karang. */
const F_JURNAL = path.join(AKAR, 'naratif-jurnal.json');
const F_PELAJARAN = path.join(AKAR, 'naratif-pelajaran.md');
const fs = require('fs');

function bacaJurnal() {
  try { return JSON.parse(fs.readFileSync(F_JURNAL, 'utf8')).catatan || []; }
  catch (e) { return []; }
}

function tulisJurnal(catatan) {
  try {
    /* Dibatasi 400 catatan. Lembar fakta ikut tersimpan supaya penilaian
       nanti bisa melihat keadaan pasar saat keputusannya diambil — itu
       membuat tiap catatan besar, dan berkas yang tumbuh tanpa batas di VPS
       961 MB adalah cara paling pelan mengisi disknya. */
    const semen = F_JURNAL + '.tmp';
    fs.writeFileSync(semen, JSON.stringify({ catatan: catatan.slice(-400) }, null, 1));
    fs.renameSync(semen, F_JURNAL);
  } catch (e) { /* catatan bukan alasan menjatuhkan analisanya */ }
}

function bacaPelajaran() {
  try { return fs.readFileSync(F_PELAJARAN, 'utf8').trim().slice(0, 4000); }
  catch (e) { return ''; }
}

function catatKe(jurnal, baris) {
  jurnal.push(Object.assign({ waktu: Date.now(), hasil: null }, baris));
}

const PERAN = `Kamu analis teknikal untuk papan sinyal publik. Jawabanmu dibaca
orang yang mungkin mempertaruhkan uang atas dasarnya.

ATURAN YANG TIDAK BISA DILANGGAR:
1. Kamu TIDAK BOLEH menulis angka harga. Entry, stop, dan target HARUS dipilih
   dari daftar level yang diberikan, dirujuk lewat id-nya (S1, R2, dst).
2. "TUNGGU" adalah jawaban yang baik dan sering merupakan jawaban yang benar.
   Pasar tanpa setup jelas jauh lebih sering daripada pasar dengan setup jelas.
   Kamu tidak dinilai dari berapa banyak sinyal yang kamu keluarkan.
3. Alasanmu harus menunjuk data yang ADA di lembar fakta. Jangan menyebut
   berita, sentimen, volume order book, atau apa pun yang tidak diberikan.
4. Kalau ragu, jawab TUNGGU.

5. Abaikan medan yang bernilai null — itu berarti datanya tidak terbaca,
   bukan berarti nilainya nol.
6. JANGAN menyebut berita, kebijakan bank sentral, aliran ETF, atau apa pun
   yang tidak ada di lembar fakta. Kamu tidak punya akses ke sana, dan
   menebaknya berarti mengarang.

Balas HANYA JSON, tanpa penjelasan di luarnya.`;

/* Pelajaran disisipkan sebagai pesan sistem KEDUA, bukan disambung ke
   peran utamanya. Aturan yang tidak boleh dilanggar dan catatan yang boleh
   ditimbang harus terlihat sebagai dua hal yang berbeda — kalau disatukan,
   pelajaran hasil sepuluh sampel mulai dibaca sebagai hukum. */
function pesanPelajaran() {
  const p = bacaPelajaran();
  if (!p) return [];
  return [{ role: 'system', content:
`Catatan dari hasil forward test agen ini sendiri. Ini BAHAN PERTIMBANGAN,
bukan aturan — chart di depanmu tetap yang menentukan. Kalau catatan ini
bertentangan dengan yang kamu lihat sekarang, ikuti yang kamu lihat.

${p}` }];
}

function promptUsul(f) {
  return [
    { role: 'system', content: PERAN },
    ...pesanPelajaran(),
    { role: 'user', content:
`Lembar fakta ${f.pasangan} timeframe ${f.tf}:

${JSON.stringify(f, null, 1)}

Nilai apakah ADA setup yang layak sekarang.

Balas JSON dengan bentuk persis ini:
{
  "aksi": "BUY" | "SELL" | "TUNGGU",
  "entryId": "<id level, atau null kalau TUNGGU>",
  "slId": "<id level>",
  "tpId": "<id level>",
  "keyakinan": 1..5,
  "alasan": "<2-3 kalimat, MAKSIMAL 60 kata, bahasa Indonesia, menunjuk angka dari lembar fakta>"
}

Untuk BUY: slId harus di BAWAH entryId, tpId harus di ATAS entryId.
Untuk SELL: kebalikannya.` },
  ];
}

function promptSanggah(f, u, harga) {
  return [
    { role: 'system', content:
`Kamu penguji sinyal, bukan pembuatnya. Tugasmu MENJATUHKAN usulan di bawah.

Cari cacat nyata: level yang salah pilih, stop yang berada di tempat yang
mudah tersapu, target yang menabrak level lain lebih dulu, alasan yang tidak
didukung angka di lembar fakta, atau arah yang melawan struktur.

Kalau memang tidak ada cacat, katakan begitu — jangan mengarang keberatan.
Tapi ragu sedikit pun berarti "jatuh". Balas HANYA JSON.` },
    { role: 'user', content:
`Lembar fakta:
${JSON.stringify(f, null, 1)}

Usulan yang diuji:
- Aksi: ${u.aksi}
- Entry: ${u.entryId} (${u.entryHarga})
- Stop: ${u.slId} (${u.slHarga})
- Target: ${u.tpId} (${u.tpHarga})
- Harga sekarang: ${harga}
- Alasan pengusul: ${u.alasan}

Balas JSON:
{ "lolos": true | false, "cacat": "<kalau tidak lolos, sebut cacatnya dalam 1-2 kalimat>" }` },
  ];
}

/* ── GERBANG HITUNGAN ─────────────────────────────────────────────────
   Dijalankan SEBELUM penyanggah dipanggil: usulan yang gagal aritmetika
   tidak layak membayar satu panggilan model lagi. */
function gerbang(u, f) {
  const { aksi, entryHarga: e, slHarga: sl, tpHarga: tp } = u;
  const a = f.atr14;
  if (!(e > 0 && sl > 0 && tp > 0)) return 'harga level tidak terbaca';
  if (aksi === 'BUY' && !(sl < e && e < tp)) return 'urutan BUY salah (butuh sl < entry < tp)';
  if (aksi === 'SELL' && !(sl > e && e > tp)) return 'urutan SELL salah (butuh tp < entry < sl)';

  const jarakSl = Math.abs(e - sl);
  const jarakTp = Math.abs(tp - e);
  const rr = jarakTp / jarakSl;
  if (rr < RR_MIN) return 'RR ' + rr.toFixed(2) + ' di bawah ' + RR_MIN;
  if (jarakSl < a * SL_ATR_MIN) return 'stop terlalu rapat (' + (jarakSl / a).toFixed(2) + 'x ATR)';
  if (jarakSl > a * SL_ATR_MAKS) return 'stop terlalu lebar (' + (jarakSl / a).toFixed(2) + 'x ATR)';

  const jauh = Math.abs(e - f.harga) / a;
  if (jauh > ENTRY_ATR_MAKS) return 'entry ' + jauh.toFixed(2) + 'x ATR dari harga sekarang';
  if (!(u.keyakinan >= KEYAKINAN_MIN)) return 'keyakinan ' + u.keyakinan + ' di bawah ' + KEYAKINAN_MIN;
  return null;
}

async function ambil(url, opsi) {
  const r = await fetch(url, opsi);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}

async function periksaSatu(pasangan, sedangJalan, jurnal) {
  if (sedangJalan.has(pasangan)) { catat(' ', pasangan, '· dilewati, masih ada sinyal hidup'); return null; }

  const bar = await klines(pasangan, TF, 220);
  if (bar.length < 120) { catat(' ', pasangan, '· data kurang'); return null; }
  const f = await lembarFakta(pasangan, bar);
  if (f.level.length < 3) { catat(' ', pasangan, '· level kurang dari tiga'); return null; }

  const j1 = await panggil(promptUsul(f));
  if (j1.galat) { catat(' ', pasangan, '· pengusul gagal:', j1.galat); return null; }
  const u = uraikan(j1.isi);
  if (!u || !u.aksi) {
    /* Potongan mentahnya IKUT DICETAK. "Tidak terbaca" tanpa contohnya
       adalah laporan yang tidak bisa ditindaklanjuti — dan jawaban model
       gagal terurai karena sebab yang berbeda-beda tiap kali. */
    catat(' ', pasangan, '· jawaban pengusul tidak terbaca ·',
      JSON.stringify(String(j1.isi || '').slice(0, 220)));
    return null;
  }
  if (u.aksi === 'TUNGGU') {
    /* TUNGGU ikut dicatat. Ia bukan ketiadaan keputusan — ia keputusan,
       dan tanpa mencatatnya tidak ada cara menjawab pertanyaan yang paling
       penting saat menilai agen ini nanti: berapa banyak gerakan besar yang
       ia lewatkan karena terlalu berhati-hati. */
    catatKe(jurnal, { pasangan, tf: TF, status: 'tunggu',
      alasan: String(u.alasan || '').slice(0, 400), harga: f.harga });
    catat(' ', pasangan, '· TUNGGU —', String(u.alasan || '').slice(0, 90));
    return null;
  }

  /* Id DIPETAKAN ke harga di sini, dan id yang tidak ada di menu langsung
     menjatuhkan usulannya. Inilah tempat "mengarang harga" mati: tidak ada
     jalan bagi angka yang tidak berasal dari lilin untuk lewat. */
  const peta = new Map(f.level.map((l) => [l.id, l.harga]));
  u.entryHarga = peta.get(u.entryId);
  u.slHarga = peta.get(u.slId);
  u.tpHarga = peta.get(u.tpId);
  if (u.entryHarga === undefined || u.slHarga === undefined || u.tpHarga === undefined) {
    catatKe(jurnal, { pasangan, tf: TF, status: 'ditolak', harga: f.harga,
      sebab: 'id level tidak dikenal: ' + u.entryId + '/' + u.slId + '/' + u.tpId,
      alasan: String(u.alasan || '').slice(0, 400) });
    catat(' ', pasangan, '· id level tidak dikenal:', u.entryId, u.slId, u.tpId);
    return null;
  }

  const tolak = gerbang(u, f);
  if (tolak) {
    catatKe(jurnal, { pasangan, tf: TF, status: 'ditolak', harga: f.harga, sebab: 'gerbang: ' + tolak,
      aksi: u.aksi, entry: u.entryHarga, sl: u.slHarga, tp: u.tpHarga,
      alasan: String(u.alasan || '').slice(0, 400) });
    catat(' ', pasangan, '· ditolak gerbang:', tolak);
    return null;
  }

  const j2 = await panggil(promptSanggah(f, u, f.harga), 900);
  if (j2.galat) { catat(' ', pasangan, '· penyanggah gagal:', j2.galat, '— tidak diterbitkan'); return null; }
  const v = uraikan(j2.isi);
  /* Penyanggah yang jawabannya tidak terbaca dihitung MENJATUHKAN, bukan
     meloloskan. Gerbang yang gagal terbuka harus gagal ke sisi yang aman. */
  if (!v || v.lolos !== true) {
    const cacat = String((v && v.cacat) || 'jawaban penyanggah tidak terbaca');
    catatKe(jurnal, { pasangan, tf: TF, status: 'ditolak', harga: f.harga, sebab: 'penyanggah: ' + cacat.slice(0, 240),
      aksi: u.aksi, entry: u.entryHarga, sl: u.slHarga, tp: u.tpHarga,
      alasan: String(u.alasan || '').slice(0, 400) });
    catat(' ', pasangan, '· dijatuhkan penyanggah:', cacat.slice(0, 110));
    return null;
  }

  const rr = Math.abs(u.tpHarga - u.entryHarga) / Math.abs(u.entryHarga - u.slHarga);
  const persen = (Math.abs(u.entryHarga - u.slHarga) / u.entryHarga * 100).toFixed(2);
  catatKe(jurnal, { pasangan, tf: TF, status: 'terbit', harga: f.harga,
    aksi: u.aksi, entryId: u.entryId, slId: u.slId, tpId: u.tpId,
    entry: u.entryHarga, sl: u.slHarga, tp: u.tpHarga,
    rr: Number(rr.toFixed(2)), keyakinan: u.keyakinan,
    alasan: String(u.alasan || '').slice(0, 400),
    /* Keadaan pasar saat keputusannya diambil ikut disimpan. Menilai
       keputusan lama tanpa tahu apa yang terlihat waktu itu cuma menghakimi
       hasilnya, dan hasil satu trade nyaris tidak mengandung informasi. */
    konteks: { atr: f.atr14, ema20: f.ema20, ema50: f.ema50, ema200: f.ema200,
      posisiDalamRange: f.posisiDalamRange, pasar: f.pasar_ } });
  catat(' ', pasangan, '· LOLOS ·', u.aksi, u.entryId, '->', u.entryHarga,
    '| sl', u.slHarga, '| tp', u.tpHarga, '| RR', rr.toFixed(2));

  return {
    pasangan,
    tf: TF,
    arah: u.aksi,
    agenNama: NAMA,
    pasar: /USDT$/.test(pasangan) ? 'kripto' : 'tradefi',
    judul: pasangan.replace('USDT', '') + ' ' + u.aksi + ' — level ' + u.entryId,
    ringkas: String(u.alasan || '').slice(0, 180),
    isi: {
      entry: u.entryHarga,
      sl: u.slHarga,
      tp: u.tpHarga,
      alasan: String(u.alasan || '').trim()
        + '\n\nEntry di ' + u.entryId + ', stop di ' + u.slId + ', target di ' + u.tpId
        + ' — ketiganya swing yang benar-benar ada di ' + TF + '. Jarak stop ' + persen
        + '% (' + (Math.abs(u.entryHarga - u.slHarga) / f.atr14).toFixed(2) + 'x ATR), RR ' + rr.toFixed(2) + '.'
        + '\n\nDitulis model, bukan aturan tetap. Angkanya dipilih dari level yang dihitung kode dari '
        + 'lilin sungguhan — model tidak pernah mengetik harga sendiri. Usulannya lolos gerbang hitungan '
        + 'lalu diuji ulang oleh panggilan kedua yang tugasnya menjatuhkannya. '
        + 'Belum punya rekam jejak: forward test, gratis.',
    },
  };
}

/* ══ MENILAI DIRI ══════════════════════════════════════════════════════
   Dijalankan terpisah (`--nilai`), bukan di putaran analisa. Dua pekerjaan:

   1. Mencocokkan sinyal yang SUDAH SELESAI di papan dengan catatan jurnal
      yang menerbitkannya, lalu menuliskan hasilnya ke catatan itu.
   2. Kalau ada cukup hasil baru, menyuruh model membaca catatan-catatan itu
      dan menulis ulang berkas pelajaran.

   Yang menulis pelajaran adalah model, bukan kode — kode tidak bisa melihat
   pola dalam kalimat alasan. Tapi bahannya seluruhnya fakta: keputusan yang
   benar-benar diambil, dan hasil yang benar-benar terjadi. */
function cocokkan(catatan, sinyal) {
  /* Dicocokkan lewat pasangan + entry, bukan lewat waktu. Waktu posting
     jurnal dan waktu simpan server berbeda beberapa detik, dan cocok-waktu
     yang longgar akan menempelkan hasil satu sinyal ke sinyal lain di
     pasangan yang sama. Entry adalah angka yang keduanya sepakati persis. */
  return catatan.find((c) => c.status === 'terbit' && c.hasil === null
    && c.pasangan === sinyal.pasangan && Math.abs(Number(c.entry) - Number(sinyal.entry)) < 1e-8);
}

async function nilaiDiri() {
  const jurnal = bacaJurnal();
  let baru = 0;
  try {
    const d = await ambil(LOKAL + '/api/analisa');
    for (const sn of (d.analisa || d.daftar || [])) {
      if (sn.agenNama !== NAMA) continue;
      if (sn.hasil === undefined || sn.hasil === null) continue;
      const c = cocokkan(jurnal, sn.isi ? { pasangan: sn.pasangan, entry: sn.isi.entry } : sn);
      if (!c) continue;
      c.hasil = String(sn.hasil).toUpperCase().includes('TP') || Number(sn.hasilDolar) > 0 ? 'MENANG' : 'KALAH';
      c.hasilDolar = Number(sn.hasilDolar) || 0;
      baru++;
    }
  } catch (e) { catat('tidak bisa membaca papan:', e.message); return; }

  tulisJurnal(jurnal);
  const dinilai = jurnal.filter((c) => c.hasil);
  catat(baru, 'hasil baru dicatat ·', dinilai.length, 'total sinyal selesai di jurnal');

  const MIN = Number(process.env.NARATIF_MIN_NILAI || 8);
  if (dinilai.length < MIN && !process.argv.includes('--paksa')) {
    catat('belum cukup sampel untuk menulis pelajaran (butuh', MIN + ')');
    return;
  }

  const menang = dinilai.filter((c) => c.hasil === 'MENANG').length;
  const ditolak = jurnal.filter((c) => c.status === 'ditolak');
  const tunggu = jurnal.filter((c) => c.status === 'tunggu');

  const bahan = {
    ringkas: {
      selesai: dinilai.length, menang, kalah: dinilai.length - menang,
      persenMenang: Math.round(menang / dinilai.length * 100),
      ditolakGerbang: ditolak.filter((c) => (c.sebab || '').startsWith('gerbang')).length,
      dijatuhkanPenyanggah: ditolak.filter((c) => (c.sebab || '').startsWith('penyanggah')).length,
      tunggu: tunggu.length,
    },
    /* Tiga puluh terakhir, bukan semuanya: yang lama sudah terwakili di
       pelajaran yang sedang berlaku, dan mengirim ulang seluruh jurnal tiap
       kali berarti membayar ongkos yang sama berulang untuk kesimpulan yang
       tidak berubah. */
    selesai: dinilai.slice(-30).map((c) => ({
      pasangan: c.pasangan, aksi: c.aksi, rr: c.rr, keyakinan: c.keyakinan,
      hasil: c.hasil, alasan: c.alasan, konteks: c.konteks,
    })),
    sebabDitolak: ditolak.slice(-20).map((c) => c.sebab),
  };

  const j = await panggil([
    { role: 'system', content:
`Kamu menulis catatan pelajaran untuk seorang analis, dari hasil forward
test-nya sendiri.

ATURAN:
1. Hanya simpulkan yang DIDUKUNG angka di bawah. Dengan sepuluh sampel,
   "hindari BUY saat funding tinggi" bukan pelajaran — itu kebetulan.
   Katakan begitu kalau memang belum cukup.
2. Tulis maksimal 8 butir, tiap butir satu kalimat, bahasa Indonesia.
3. Sertakan berapa sampel yang mendukung tiap butir, dalam kurung.
4. Kalau sebuah pola cuma muncul sekali atau dua kali, JANGAN ditulis.
5. Butir tentang apa yang HARUS DIHINDARI lebih berguna daripada butir
   tentang apa yang harus dicari.

Balas teks biasa (markdown daftar), bukan JSON.` },
    { role: 'user', content:
`Catatan pelajaran yang sedang berlaku:
${bacaPelajaran() || '(belum ada)'}

Data forward test:
${JSON.stringify(bahan, null, 1)}

Tulis ulang catatan pelajarannya.` },
  ], 1200);

  if (j.galat) { catat('gagal menulis pelajaran:', j.galat); return; }
  const teks = String(j.isi || '').trim();
  if (teks.length < 30) { catat('pelajaran terlalu pendek, tidak ditulis'); return; }
  try {
    fs.writeFileSync(F_PELAJARAN,
      '<!-- Ditulis otomatis oleh `node agen-naratif.js --nilai`. ' + jam()
      + ' · ' + dinilai.length + ' sinyal selesai, ' + menang + ' menang. -->\n\n' + teks + '\n');
    catat('pelajaran diperbarui ·', teks.split('\n').filter(Boolean).length, 'baris');
  } catch (e) { catat('gagal menyimpan pelajaran:', e.message); }
}

async function utama() {
  if (!KUNCI) { console.error('OPENROUTER_API_KEY kosong — agen naratif tidak bisa jalan.'); process.exit(1); }
  if (process.argv.includes('--nilai')) { await nilaiDiri(); return; }
  catat('agen naratif ·', NAMA, '·', MODEL, '·', PASANGAN.join(', '), '·', TF,
    KERING ? '· MODE KERING' : '');

  /* Pasangan yang sinyalnya masih hidup dilewati. Menumpuk dua sinyal arah
     berlawanan di pasangan yang sama pada papan yang sama membuat kanalnya
     terbaca sedang menebak dua-duanya. */
  const sedangJalan = new Set();
  try {
    const d = await ambil(LOKAL + '/api/analisa');
    for (const s of (d.analisa || d.daftar || [])) {
      if (s.agenNama !== NAMA) continue;
      if (s.hasil === undefined || s.hasil === null) sedangJalan.add(s.pasangan);
    }
  } catch (e) { catat('tidak bisa membaca sinyal berjalan:', e.message, '— lanjut tanpa saringan itu'); }

  const jurnal = bacaJurnal();
  const hasil = [];
  for (const p of PASANGAN) {
    try {
      const sn = await periksaSatu(p, sedangJalan, jurnal);
      if (sn) hasil.push(sn);
    } catch (e) { catat(' ', p, '· galat:', e && e.message); }
  }
  /* Ditulis SEKALI di akhir, bukan tiap catatan. Tiga pasangan berarti tiga
     penulisan berkas untuk data yang sama, dan proses yang mati di tengah
     akan meninggalkan jurnal yang separuh berisi keputusan putaran ini.

     Mode kering TIDAK menulis. Catatan bertanda "terbit" yang tidak pernah
     benar-benar terbit tidak akan pernah mendapat hasil, dan ia akan duduk
     selamanya di jurnal sebagai sinyal yang belum selesai — mengotori
     penilaian diri dengan sampel yang tidak pernah ada. */
  if (!KERING) tulisJurnal(jurnal);

  catat(hasil.length, 'sinyal lolos dari', PASANGAN.length, 'pasangan');

  if (!KERING) {
    for (const sn of hasil) {
      try {
        await ambil(LOKAL + '/api/analisa/agen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-App-Token': TOKEN },
          body: JSON.stringify(sn),
        });
        catat('   terkirim:', sn.pasangan, sn.arah);
      } catch (e) { catat('   GAGAL kirim', sn.pasangan, '·', e.message); }
    }
    /* Denyut dikirim SELALU, terutama saat nol sinyal: agen ini memang
       dirancang sering diam, dan tanpa denyut papan Copy Signal tidak punya
       apa pun untuk ditampilkan selain kartu yang seolah mati. */
    try {
      await ambil(LOKAL + '/api/analisa/agen/hadir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': TOKEN },
        body: JSON.stringify({
          nama: NAMA,
          strategi: 'Analisa ditulis model bahasa, bukan aturan tetap. Entry, stop, dan target '
                  + 'dipilih dari level swing yang dihitung kode dari lilin ' + TF + ' — model tidak '
                  + 'pernah mengetik harga. Tiap usulan lolos gerbang RR & jarak ATR, lalu diuji '
                  + 'panggilan kedua yang tugasnya menjatuhkannya. Sering menjawab TUNGGU, dan itu '
                  + 'disengaja. Belum punya rekam jejak — forward test, gratis.',
          pasangan: PASANGAN.length,
          tf: TF,
        }),
      });
    } catch (e) { catat('denyut gagal:', e.message); }
  }
}

/* Dijalankan HANYA saat dipanggil langsung. Tanpa penjaga ini, satu
   `require('./agen-naratif')` untuk memeriksa satu fungsi akan menjalankan
   seluruh agen — dan saat pertama diuji, itu betul-betul terjadi: satu
   perintah pemeriksaan ikut mendaftarkan kartunya ke papan. */
if (require.main === module) {
  utama().catch((e) => { console.error('[' + jam() + '] BERHENTI:', e && e.message); process.exit(1); });
}

module.exports = { lembarFakta, menuLevel, swing, gerbang, uraikan, posisiPasar, nilaiDiri };
