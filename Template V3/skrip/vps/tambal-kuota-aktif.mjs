import { readFileSync, writeFileSync } from 'node:fs';

/* ════════════════════════════════════════════════════════════════════════
   TAMBALAN — kuota 20 menghitung sinyal AKTIF, bukan seluruh riwayat
   ════════════════════════════════════════════════════════════════════════
   Batas 20 per akun dipasang supaya satu orang tidak bisa membanjiri papan
   peringkat dengan puluhan tebakan lalu menonjolkan yang kebetulan kena.
   Tujuan itu tetap. Yang salah cara menghitungnya: ia menghitung SELURUH
   riwayat, termasuk sinyal yang sudah kena TP/SL berbulan lalu.

   Akibatnya batas itu menghukum hal yang justru ingin ia lindungi. Sinyal
   yang sudah selesai bukan rencana yang sedang dijual siapa pun — ia data
   historis, dan makin banyak makin bagus, karena persis itulah yang membuat
   winrate seseorang berarti. Analis yang paling lama aktif jadi yang paling
   cepat terkunci, sementara yang baru kemarin daftar punya 20 slot penuh.

   Yang membanjiri papan adalah sinyal HIDUP — yang masih menggantung dan
   yang sedang berjalan. Itu yang dibatasi sekarang.

   Sengaja memakai daftar penanda yang sama dengan layar (`hasil`): 'sl',
   'tp', dan 'batal' berarti selesai; null/undefined berarti masih hidup.
   Kalau suatu hari muncul penanda selesai yang keempat, ia harus
   ditambahkan di KEDUA tempat — dan itu sebabnya daftarnya ditulis sebagai
   satu konstanta bernama, bukan tiga perbandingan yang berserakan.
   ════════════════════════════════════════════════════════════════════════ */

const berkas = process.argv[2];
if (!berkas) {
  console.error('Pakai: node tambal-kuota-aktif.mjs <jalur server.js>');
  process.exit(1);
}

let s = readFileSync(berkas, 'utf8');

const LAMA = `  const d = analisaBaca();
  if (d.daftar.filter(a => a.uid === req.uid).length >= 20) {
    return res.status(400).json({ error: 'Maksimal 20 analisa per akun. Hapus yang lama dulu.' });
  }`;

const BARU = `  const d = analisaBaca();
  /* ── KUOTA MENGHITUNG YANG AKTIF SAJA ──────────────────────────────
     Batasnya tetap 20 dan tujuannya tetap sama: satu orang tidak boleh
     membanjiri papan peringkat dengan puluhan rencana sekaligus. Yang
     diperbaiki cara menghitungnya.

     Dulu ia menghitung SELURUH riwayat, termasuk sinyal yang sudah kena
     TP/SL berbulan lalu. Sinyal selesai bukan rencana yang sedang dijual
     siapa pun -- ia data historis, dan makin banyak makin bagus, karena
     persis itu yang membuat winrate seseorang berarti. Menghitungnya
     membuat batas ini menghukum analis yang paling lama aktif, sementara
     yang baru daftar kemarin punya 20 slot penuh.

     Yang membanjiri papan adalah sinyal HIDUP: masih menggantung atau
     sedang berjalan. Itu yang dibatasi.

     Pesan galatnya ikut diperbaiki. Bunyi lamanya "Hapus yang lama dulu"
     menyuruh hal yang TIDAK BISA dilakukan analis: tombol hapus sengaja
     dicabut, dan formulir postingnya sendiri mewajibkan centang "saya
     paham sinyal ini tidak bisa dihapus setelah diposting". Menyuruh orang
     melakukan yang kami sendiri larang membuat penolakan ini terbaca
     seperti kerusakan. */
  const SELESAI = ['sl', 'tp', 'batal'];
  const aktifku = d.daftar.filter(a => a.uid === req.uid && !SELESAI.includes(a.hasil)).length;
  if (aktifku >= 20) {
    return res.status(400).json({
      error: 'Kuota penuh: 20 sinyal aktif. Sinyal yang sudah kena TP/SL tidak dihitung — '
           + 'tunggu salah satu rencanamu selesai atau batalkan yang belum tersentuh harga.',
    });
  }`;

const n = s.split(LAMA).length - 1;
if (n !== 1) {
  console.error(n === 0
    ? 'GAGAL: penjaga kuota lama tidak ditemukan — server.js sudah berubah atau sudah tertambal.'
    : `GAGAL: penjaga kuota ditemukan ${n} kali; tambalan menolak menebak yang mana.`);
  process.exit(1);
}

s = s.replace(LAMA, BARU);
writeFileSync(berkas, s);
console.log('Tambalan terpasang: kuota 20 sekarang menghitung sinyal aktif saja.');
