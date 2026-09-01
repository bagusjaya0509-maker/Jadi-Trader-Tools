/* ══════════════════════════════════════════════════════════════════════════
   salin-dompet.js — menyalin SELURUH gerakan sebuah dompet
   ══════════════════════════════════════════════════════════════════════════
   Satu setelan untuk satu dompet: bursa tujuan, ukuran order, leverage.
   Sesudah itu apa pun yang dompet itu BUKA diikuti, dan apa pun yang ia
   TUTUP ikut ditutup.

   ── KENAPA PER DOMPET, BUKAN PER KOIN ──────────────────────────────────
   Versi sebelumnya menuntut penandaan koin satu per satu. Itu salah, dan
   salahnya bukan soal jumlah klik: yang ditiru orang saat menyalin dompet
   adalah KEPUTUSANNYA, dan keputusan itu termasuk memilih koin mana yang
   dimasuki. Menandai koin lebih dulu berarti kita sudah menyaring
   keputusannya sebelum ia mengambilnya — dan yang tersalin bukan lagi
   dompet itu, melainkan tebakan kita tentang koin apa yang akan ia sentuh.

   Akibat praktisnya juga jelas: koin yang tidak pernah kita tandai tidak
   akan pernah tersalin, betapa pun bagusnya. Justru masuk ke koin yang
   tidak kita pikirkan sendiri adalah alasan orang menyalin dompet.

   ── APA YANG MENJADI PEMICU ────────────────────────────────────────────
   PERUBAHAN daftar koin yang dipegang dompet itu, bukan keadaannya:

       pegang kemarin: BTC, SOL
       pegang sekarang: BTC, HYPE
       -> HYPE baru dibuka  (salin buka)
       -> SOL sudah dilepas (salin tutup)

   `pegang` yang belum pernah terisi (`undefined`) TIDAK memicu apa pun —
   pindaian pertama sesudah setelannya disimpan hanya MENCATAT. Tanpa
   aturan itu, menyalakan salinan hari ini akan langsung menyalin semua
   posisi yang sudah dibuka berhari-hari lalu di harga yang sudah jauh
   lewat, dan itu kebalikan dari menyalin.

   ── DUA PINDAIAN, DUA-DUANYA ───────────────────────────────────────────
   Buka maupun tutup menunggu koin itu terlihat sama selama dua pindaian
   berturut-turut. Satu jawaban API yang kebetulan kosong sudah cukup untuk
   memicu tutup-lalu-buka yang tidak pernah terjadi di dompet aslinya, dan
   dua order sungguhan lahir dari satu gangguan jaringan. Harganya ~1 menit
   keterlambatan; yang dibeli dengan harga itu adalah tidak adanya order
   hantu.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const BERKAS = 'wallet-salin.json';

/* MATI kecuali dinyalakan — sengaja tidak simetris dengan sakelar lain.
   Sesuatu yang bisa memasukkan uang ke posisi baru tidak boleh menyala
   hanya karena tidak ada yang menuliskan angka nol di berkas env. */
const AKTIF = process.env.SALIN_DOMPET === '1';
const KONFIRMASI = Math.max(2, Number(process.env.SALIN_KONFIRMASI || 2));
const MAKS_POSISI = Math.max(1, Number(process.env.SALIN_MAKS_POSISI || 3));

function baca(dir) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, BERKAS), 'utf8'));
    return Array.isArray(d.salin) ? d.salin : [];
  } catch { return []; }
}

function tulis(dir, salin) {
  const f = path.join(dir, BERKAS);
  try {
    /* Ditulis ke berkas sementara lalu di-rename: rename itu atomik, jadi
       pembaca tidak pernah melihat berkas setengah tertulis. */
    fs.writeFileSync(f + '.tmp', JSON.stringify({ salin }, null, 2));
    fs.renameSync(f + '.tmp', f);
  } catch { /* gagal menulis penanda bukan alasan menjatuhkan pemantau */ }
}

/** Koin apa saja yang dipegang sebuah dompet SEKARANG, beserta arahnya. */
function koinDompet(posisiDompet, alamat) {
  const peta = new Map();
  for (const p of posisiDompet) {
    if (p.alamat !== alamat) continue;
    peta.set(String(p.koin).toUpperCase(), p);
  }
  return peta;
}

/**
 * Menjalankan satu putaran salinan.
 *
 * Seluruh ketergantungannya disuntikkan, bukan di-require di sini — supaya
 * berkas ini bisa diuji tanpa jaringan, dan supaya jelas apa saja yang
 * benar-benar ia sentuh.
 */
async function putaran({ dir, posisiDompet, catat, lonceng, bursa }) {
  if (!AKTIF) return;
  const salin = baca(dir);
  const hidup = salin.filter((s) => s.aktif === true && Number(s.usd) > 0);
  if (!hidup.length) return;

  let berubah = false;

  for (const s of hidup) {
    const sekarang = koinDompet(posisiDompet, s.alamat);
    const namaKoin = [...sekarang.keys()];
    const tadi = Array.isArray(s.pegang) ? s.pegang : null;

    /* Pindaian pertama: catat, jangan bertindak. Lihat catatan di kepala. */
    if (tadi === null) {
      s.pegang = namaKoin; berubah = true;
      catat('  salin ' + ringkas(s.alamat) + ': pindaian pertama, mencatat ' + namaKoin.length + ' koin');
      continue;
    }

    const baru = namaKoin.filter((k) => !tadi.includes(k));
    const hilang = tadi.filter((k) => !namaKoin.includes(k));

    s.konfirmasiBuka = s.konfirmasiBuka || {};
    s.konfirmasiTutup = s.konfirmasiTutup || {};
    s.punyaku = s.punyaku || {};

    /* ── BUKA ────────────────────────────────────────────────────────── */
    for (const k of baru) {
      s.konfirmasiBuka[k] = (s.konfirmasiBuka[k] || 0) + 1; berubah = true;
      if (s.konfirmasiBuka[k] < KONFIRMASI) {
        catat('  salin ' + k + ': konfirmasi buka ' + s.konfirmasiBuka[k] + '/' + KONFIRMASI);
        continue;
      }
      if (s.punyaku[k]) { delete s.konfirmasiBuka[k]; continue; }
      if (Object.keys(s.punyaku).length >= MAKS_POSISI) {
        catat('  salin ' + k + ': ditahan, sudah ' + Object.keys(s.punyaku).length + ' posisi salinan');
        continue;
      }

      const sumber = sekarang.get(k);
      const arah = sumber.arah === 'SHORT' ? 'SELL' : 'BUY';
      try {
        const h = await bursa.buka({
          koin: k, arah, usd: Number(s.usd),
          leverage: Math.max(1, Number(s.leverage) || 1),
          bursa: s.bursa || 'binance',
        });
        delete s.konfirmasiBuka[k];
        s.punyaku[k] = { bursa: h.bursa, simbol: h.simbol, arah, waktu: Date.now() };
        berubah = true;
        catat('  SALIN BUKA ' + arah + ' ' + h.simbol + ' di ' + h.bursa);
        await lonceng({
          id: 'salin-buka-' + s.alamat.slice(0, 8) + '-' + k + '-' + Date.now(),
          judul: 'Salin ' + (s.nama || ringkas(s.alamat)) + ': ' + arah + ' ' + k,
          detail: 'Dompet itu membuka ' + sumber.arah + ' ' + k + '. Disalin di ' + h.bursa
                + ' sebesar ' + s.usd + ' USD, ' + (s.leverage || 1) + 'x.',
        });
      } catch (e) {
        const pesan = (e && e.message) || 'tidak diketahui';
        catat('  salin buka GAGAL ' + k + ': ' + pesan);
        /* Konfirmasi TIDAK direset di sini. Kegagalan sesaat -- bursa sibuk,
           jaringan putus -- tidak boleh membuat koin ini mengulang hitungan
           dari nol dan tertunda dua pindaian lagi. Yang gagal permanen
           (koinnya memang tidak ada) akan gagal lagi dan terlihat di log. */
        await lonceng({
          id: 'salin-gagal-' + s.alamat.slice(0, 8) + '-' + k + '-' + Date.now(),
          judul: 'Salin gagal: ' + k,
          detail: pesan,
        });
      }
    }

    /* ── TUTUP ───────────────────────────────────────────────────────── */
    for (const k of hilang) {
      s.konfirmasiTutup[k] = (s.konfirmasiTutup[k] || 0) + 1; berubah = true;
      if (s.konfirmasiTutup[k] < KONFIRMASI) {
        catat('  salin ' + k + ': konfirmasi tutup ' + s.konfirmasiTutup[k] + '/' + KONFIRMASI);
        continue;
      }
      const punya = s.punyaku[k];
      if (!punya) { delete s.konfirmasiTutup[k]; continue; }
      try {
        await bursa.tutup({ koin: k, simbol: punya.simbol, bursa: punya.bursa, arah: punya.arah });
        delete s.konfirmasiTutup[k];
        delete s.punyaku[k];
        berubah = true;
        catat('  SALIN TUTUP ' + punya.simbol + ' di ' + punya.bursa);
        await lonceng({
          id: 'salin-tutup-' + s.alamat.slice(0, 8) + '-' + k + '-' + Date.now(),
          judul: 'Salin ' + (s.nama || ringkas(s.alamat)) + ': tutup ' + k,
          detail: 'Dompet itu sudah tidak memegang ' + k + '. Posisi salinannya ikut ditutup.',
        });
      } catch (e) {
        catat('  salin tutup GAGAL ' + k + ': ' + ((e && e.message) || '?'));
      }
    }

    /* Koin yang sempat masuk daftar konfirmasi lalu kembali normal
       dibersihkan, supaya hitungannya tidak menua diam-diam. */
    for (const k of Object.keys(s.konfirmasiBuka)) if (!baru.includes(k)) delete s.konfirmasiBuka[k];
    for (const k of Object.keys(s.konfirmasiTutup)) if (!hilang.includes(k)) delete s.konfirmasiTutup[k];

    /* -- `pegang` HANYA MENYERAP PERUBAHAN YANG SUDAH SELESAI ----------
       Ini pernah salah dan gejalanya sunyi total: dulu `pegang` langsung
       disamakan dengan keadaan sekarang tiap putaran. Akibatnya koin yang
       baru muncul dan masih menunggu konfirmasi 1/2 sudah tercatat sebagai
       "dipegang" -- jadi pindaian berikutnya ia tidak lagi terhitung BARU,
       hitungannya dihapus pembersih di atas, dan konfirmasinya tidak pernah
       sampai dua. Salinannya diam selamanya tanpa satu galat pun.

       Sekarang koin yang sedang ditunggu DIBIARKAN di keadaan lamanya:
       yang menunggu buka tetap di luar `pegang` (jadi tetap terbaca baru),
       yang menunggu tutup tetap di dalam (jadi tetap terbaca hilang).
       Keduanya baru berpindah sesudah ordernya benar-benar berangkat. */
    const tertunda = new Set([
      ...Object.keys(s.konfirmasiBuka), ...Object.keys(s.konfirmasiTutup),
    ]);
    const pegangBaru = new Set(tadi);
    for (const k of namaKoin) if (!tertunda.has(k)) pegangBaru.add(k);
    for (const k of tadi) if (!namaKoin.includes(k) && !tertunda.has(k)) pegangBaru.delete(k);
    const daftar = [...pegangBaru];
    if (JSON.stringify(s.pegang) !== JSON.stringify(daftar)) {
      s.pegang = daftar; berubah = true;
    }
  }

  if (berubah) tulis(dir, salin);
}

function ringkas(a) { return String(a || '').slice(0, 8) + '…'; }

module.exports = { baca, tulis, putaran, AKTIF, KONFIRMASI, MAKS_POSISI, BERKAS };
