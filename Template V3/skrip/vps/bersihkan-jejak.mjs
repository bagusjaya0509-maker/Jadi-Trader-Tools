#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   bersihkan-jejak.mjs — menghapus jejak ruang sumber dari data YANG SUDAH ADA
   ══════════════════════════════════════════════════════════════════════════
   Menambal kodenya cuma menghentikan kebocoran BARU. Yang sudah telanjur
   tersimpan tetap tersaji: kabar.json dibaca /api/kabar tanpa login, dan
   kartu di analisa.json dibaca siapa pun yang membuka Copy Signal.

   Yang dibersihkan:

     kabar.json    · sumber "Telegram · VIP ASF"     → nama agen
                   · tautan t.me                     → kosong
                   · judul & detail baris 'pantau'   → kalimat baku
                     (baris 'pantau' isinya memang obrolan mentah)
                   · baris 'sinyal': judul & detail DIPERTAHANKAN — isinya
                     hasil uraian sendiri (pasangan, arah, level), bukan
                     kutipan. Ekor kutipan sesudah tanda '·' dipotong.

     analisa.json  · isi.alasan: baris "Sumber: ..." dan "Pesan asli: <url>"
                     dibuang, blok "Kutipan pesan:" dan seluruh sisanya
                     dipotong
                   · ringkas: kalimat yang menyebut Telegram diganti

   AMAN DIULANG. Semua penggantian idempoten: menjalankannya dua kali
   menghasilkan berkas yang sama persis.

   Jalankan dengan --uji untuk melihat hitungannya tanpa menulis apa pun.
   ══════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const AKAR = process.env.AKAR_BACKEND || '/root/binance-trading-backend';
const UJI = process.argv.includes('--uji');
const AGEN_BAWAAN = process.env.TG_AGEN_NAMA || 'AI Telg';

function bacaJson(berkas) {
  try { return JSON.parse(fs.readFileSync(berkas, 'utf8')); }
  catch (e) { return null; }
}

function tulisJson(berkas, data) {
  if (UJI) return;
  /* Cadangan bercap waktu, bukan ".bak" tunggal: menjalankan skrip ini dua
     kali dengan cadangan tunggal akan menimpa cadangan pertama dengan data
     yang SUDAH dibersihkan — dan yang asli hilang untuk selamanya tepat
     saat seseorang menyadari ada yang perlu dikembalikan. */
  const cap = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  try { fs.copyFileSync(berkas, berkas + '.cadangan-jejak-' + cap); } catch (e) { /* baru */ }
  const semen = berkas + '.tmp';
  fs.writeFileSync(semen, JSON.stringify(data, null, 2));
  fs.renameSync(semen, berkas);
}

let ubahKabar = 0;
let ubahKartu = 0;

/* ── kabar.json ───────────────────────────────────────────────────────── */
const bKabar = path.join(AKAR, 'kabar.json');
const dKabar = bacaJson(bKabar);
let buangKabar = 0;
if (dKabar && Array.isArray(dKabar.kabar)) {
  /* ── BARIS OBROLAN DIBUANG, BUKAN DIKOSONGKAN ────────────────────────
     Percobaan pertama menggantinya dengan kalimat baku "Postingan baru di
     ruang pantauan / Isinya tidak ditampilkan". Hasilnya lonceng berisi 50
     baris yang sama persis — bocornya memang tertutup, tapi yang tersisa
     nol informasi dan tetap menenggelamkan sinyal sungguhan di bawahnya.

     Baris 'pantau' lama isinya baris pertama pesan orang apa adanya. Sesudah
     isinya dibuang, tidak ada yang tersisa untuk dilihat siapa pun: waktunya
     saja tidak menjawab pertanyaan apa pun. Jadi barisnya ikut pergi.

     Baris 'sinyal' TIDAK dibuang — isinya hasil uraian kita sendiri
     (pasangan, arah, level), dan itu memang riwayat yang berguna. */
  const sebelumnya = dKabar.kabar.length;
  dKabar.kabar = dKabar.kabar.filter((k) => k && k.jenis === 'sinyal');
  buangKabar = sebelumnya - dKabar.kabar.length;

  for (const k of dKabar.kabar) {
    const sebelum = JSON.stringify(k);
    if (/telegram|vip asf/i.test(String(k.sumber || ''))) k.sumber = AGEN_BAWAAN;
    if (k.tautan) k.tautan = '';
    {
      /* Baris 'sinyal': ekornya dulu memuat '· ' + 260 huruf pesan aslinya.
         ────────────────────────────────────────────────────────────────
         Percobaan pertama memotongnya kalau ekornya "lebih dari 40 huruf".
         Itu tebakan, dan tebakan itu MELESET pada kasus nyata: ekor
         "· Yok buy now xauusd / SL 4595 / TP 4612" cuma 36 huruf, jadi
         kutipannya lolos utuh ke API publik.

         Panjang bukan kriteria yang benar. Yang benar: detail buatan kita
         sendiri cuma pernah memuat DUA macam catatan bertanda '·', dan
         keduanya diketahui. Apa pun '·' selain itu adalah kutipan. */
      const AMAN = ['· pasangan tidak disebut', '· dibaca dari chart'];
      const d = String(k.detail || '');
      let p = d.indexOf('· ');
      while (p >= 0 && AMAN.some((a) => d.startsWith(a, p))) {
        p = d.indexOf('· ', p + 2);
      }
      if (p >= 0) k.detail = d.slice(0, p).trim();
    }
    if (JSON.stringify(k) !== sebelum) ubahKabar++;
  }
  tulisJson(bKabar, dKabar);
}

/* ── analisa.json ─────────────────────────────────────────────────────── */
const bAnalisa = path.join(AKAR, 'analisa.json');
const dAnalisa = bacaJson(bAnalisa);
if (dAnalisa && Array.isArray(dAnalisa.daftar)) {
  for (const a of dAnalisa.daftar) {
    if (!a || !a.agen) continue;
    const sebelum = JSON.stringify(a);

    if (a.isi && typeof a.isi.alasan === 'string') {
      let t = a.isi.alasan;
      /* Kutipan dan segala yang mengikutinya. Dipotong lebih dulu supaya
         baris-baris di bawah tidak perlu berhati-hati terhadap isinya. */
      const iKutip = t.indexOf('Kutipan pesan:');
      if (iKutip >= 0) t = t.slice(0, iKutip);
      t = t
        .replace(/^Sumber: ruang sinyal Telegram \(bukan analisa sistem ini\)\.\s*\n?/m,
          'Level ini DITERUSKAN dari ruang pantauan agen, bukan hasil '
          + 'analisa sistem ini. Asal ruangnya tidak dipublikasikan.\n')
        .replace(/^Pesan asli: \S+\s*\n?/m, '')
        /* Jaring pengaman: tautan t.me di mana pun, dalam bentuk apa pun. */
        .replace(/https?:\/\/t\.me\/\S+/g, '(tautan dihapus)')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      a.isi.alasan = t;
    }

    if (typeof a.ringkas === 'string' && /telegram/i.test(a.ringkas)) {
      a.ringkas = 'Level diteruskan agen pemantau, bukan analisa sistem ini.';
    }

    if (JSON.stringify(a) !== sebelum) ubahKartu++;
  }
  tulisJson(bAnalisa, dAnalisa);
}

console.log((UJI ? '[UJI] ' : '') + 'kabar dibuang: ' + buangKabar
  + ' · kabar dibersihkan: ' + ubahKabar
  + ' · kartu dibersihkan: ' + ubahKartu);

/* ── Pemeriksaan akhir: benarkah tidak ada lagi jejaknya ──────────────── */
for (const b of [bKabar, bAnalisa]) {
  let isi = '';
  try { isi = fs.readFileSync(b, 'utf8'); } catch (e) { continue; }
  const sisa = (isi.match(/t\.me\/c\/\d+/g) || []).length
             + (isi.match(/VIP ASF/g) || []).length;
  console.log('  ' + path.basename(b) + ': ' + (sisa ? '⚠ masih ada ' + sisa + ' jejak' : 'bersih'));
}
