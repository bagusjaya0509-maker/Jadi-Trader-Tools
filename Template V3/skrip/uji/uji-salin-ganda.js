/* ════════════════════════════════════════════════════════════════════════
   UJI: SATU KOIN, SATU POSISI
   ════════════════════════════════════════════════════════════════════════
   Menguji pagar yang ditambahkan 3 Sep 2026 atas permintaan pemilik, yang
   menyalin beberapa dompet sekaligus dan takut posisinya jadi dobel.

   Tidak menyentuh jaringan sama sekali: `salin-dompet.js` memang dirancang
   dengan seluruh ketergantungannya disuntikkan, jadi bursa tiruan di bawah
   sudah cukup untuk membuktikan sifat yang paling menentukan — BERAPA KALI
   `buka` dipanggil.

   Jalankan di VPS:  SALIN_DOMPET=1 node uji-salin-ganda.js
   ════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.SALIN_DOMPET = '1';
process.env.SALIN_KONFIRMASI = '2';

const Salin = require('./salin-dompet');

let lulus = 0, gagal = 0;
function periksa(nama, benar, ket) {
  if (benar) { lulus++; console.log('  LULUS  ' + nama); }
  else { gagal++; console.log('  GAGAL  ' + nama + (ket ? ' — ' + ket : '')); }
}

/** Satu ruang kerja sementara berisi wallet-salin.json yang kita karang. */
function ruang(salin) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ujisalin-'));
  fs.writeFileSync(path.join(dir, 'wallet-salin.json'),
                   JSON.stringify({ salin, log: [], riwayat: [] }, null, 2));
  return dir;
}

function bacaSalin(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'wallet-salin.json'), 'utf8')).salin;
}

/** Dompet sumber: dua alamat yang sama-sama memegang ETH. */
const DUA_DOMPET_ETH = [
  { alamat: '0xaaa', koin: 'ETH', arah: 'LONG' },
  { alamat: '0xbbb', koin: 'ETH', arah: 'LONG' },
];

function setelan() {
  return [
    { alamat: '0xaaa', nama: 'Dompet A', aktif: true, bursa: 'binance', usd: 30, leverage: 1,
      pegang: [], konfirmasiBuka: {}, konfirmasiTutup: {}, punyaku: {} },
    { alamat: '0xbbb', nama: 'Dompet B', aktif: true, bursa: 'binance', usd: 30, leverage: 1,
      pegang: [], konfirmasiBuka: {}, konfirmasiTutup: {}, punyaku: {} },
  ];
}

/** Bursa tiruan. Mencatat tiap permintaan buka; tidak pernah menolak. */
function bursaPalsu(potret) {
  const dibuka = [];
  return {
    dibuka,
    async buka({ koin, arah }) {
      dibuka.push(koin);
      return { bursa: 'binance', simbol: koin + 'USDT', arah };
    },
    async tutup() { return { ok: true }; },
    async posisiku() { return potret; },
  };
}

async function jalankan(dir, bursa, posisiDompet) {
  /* Dua putaran: yang pertama menaikkan konfirmasi ke 1/2, yang kedua
     mencapai 2/2 dan barulah membuka. Itu perilaku sengaja mesinnya. */
  for (let i = 0; i < 2; i++) {
    await Salin.putaran({ dir, posisiDompet, bursa, catat: () => {}, lonceng: async () => {} });
  }
}

(async () => {
  console.log('\n=== 1. Dua dompet memegang koin yang SAMA ===');
  {
    const dir = ruang(setelan());
    const b = bursaPalsu([]);
    await jalankan(dir, b, DUA_DOMPET_ETH);
    periksa('ETH dibuka TEPAT SEKALI, bukan dua kali',
            b.dibuka.length === 1, 'dibuka: ' + JSON.stringify(b.dibuka));
    const sal = bacaSalin(dir);
    const punya = sal.filter((s) => s.punyaku && s.punyaku.ETH).map((s) => s.nama);
    periksa('hanya SATU dompet yang mencatatnya di punyaku',
            punya.length === 1, 'pencatat: ' + JSON.stringify(punya));
  }

  console.log('\n=== 2. Koinnya sudah terbuka di akun (dibuka manual) ===');
  {
    const dir = ruang(setelan());
    const b = bursaPalsu([{ bursa: 'binance', simbol: 'ETHUSDT', koin: 'ETH', qty: 1 }]);
    await jalankan(dir, b, DUA_DOMPET_ETH);
    periksa('TIDAK ada yang dibuka sama sekali',
            b.dibuka.length === 0, 'dibuka: ' + JSON.stringify(b.dibuka));
  }

  console.log('\n=== 3. Koin BERBEDA tetap boleh jalan (pagarnya tidak kebablasan) ===');
  {
    const dir = ruang(setelan());
    const b = bursaPalsu([]);
    await jalankan(dir, b, [
      { alamat: '0xaaa', koin: 'ETH', arah: 'LONG' },
      { alamat: '0xbbb', koin: 'SOL', arah: 'SHORT' },
    ]);
    periksa('keduanya dibuka',
            b.dibuka.length === 2 && b.dibuka.includes('ETH') && b.dibuka.includes('SOL'),
            'dibuka: ' + JSON.stringify(b.dibuka));
  }

  console.log('\n=== 4. Potret gagal dibaca — pagar catatan sendiri TETAP jalan ===');
  {
    const dir = ruang(setelan());
    const dibuka = [];
    const b = {
      dibuka,
      async buka({ koin, arah }) { dibuka.push(koin); return { bursa: 'binance', simbol: koin + 'USDT', arah }; },
      async tutup() { return { ok: true }; },
      async posisiku() { throw new Error('bursa bisu'); },
    };
    await jalankan(dir, b, DUA_DOMPET_ETH);
    periksa('ETH tetap dibuka TEPAT SEKALI walau potret mati',
            dibuka.length === 1, 'dibuka: ' + JSON.stringify(dibuka));
  }

  console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL') + ' (' + lulus + ' lulus)\n');
  process.exit(gagal === 0 ? 0 : 1);
})();
