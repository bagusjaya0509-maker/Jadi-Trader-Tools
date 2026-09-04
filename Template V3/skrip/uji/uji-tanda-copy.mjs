/* Uji jendela waktu penandaan salinan: src/lib/tanda-copy.ts
   ────────────────────────────────────────────────────────────────────────
   Jalankan: node skrip/uji/uji-tanda-copy.mjs

   Cacat yang dijaga di sini dilaporkan pemilik 4 Sep 2026: posisi yang
   dibuka MANUAL muncul berlabel salinan dari analis yang sinyalnya sudah
   lama tidak diikuti. Sebabnya catatan salinan lama yang tidak pernah
   kedaluwarsa, ditambah cabang yang mengembalikan catatan ke kolam jodoh
   tiap kali posisinya ditutup.

   Modulnya menyentuh localStorage, jadi disediakan tiruannya di sini.   */

const simpanan = new Map();
globalThis.localStorage = {
  getItem: (k) => (simpanan.has(k) ? simpanan.get(k) : null),
  setItem: (k, v) => simpanan.set(k, String(v)),
  removeItem: (k) => simpanan.delete(k),
  clear: () => simpanan.clear(),
};

const { catatCopy, bacaTanda, petaCopyPada } = await import('../../src/lib/tanda-copy.ts');

let n = 0, gagal = 0;
function uji(nama, f) {
  n++;
  simpanan.clear();
  try { f(); console.log('OK    ' + nama); }
  catch (e) { gagal++; console.log('GAGAL ' + nama + '\n      ' + ((e && e.message) || e)); }
}
function sama(a, b, pesan) {
  if (a !== b) throw new Error((pesan || '') + ' → dapat ' + JSON.stringify(a) + ', harap ' + JSON.stringify(b));
}

const UID = 'u1';
const JAM = 60 * 60 * 1000;
const KINI = 1_800_000_000_000;

/** Tulis catatan langsung dengan waktu yang ditentukan. */
function tanda(v) {
  const d = JSON.parse(globalThis.localStorage.getItem('jt.copy.tanda.' + UID) || '[]');
  d.push({ simbol: 'XAUUSDc', arah: 'BUY', lot: 0.17, analis: 'Bagus Jaya', ...v });
  globalThis.localStorage.setItem('jt.copy.tanda.' + UID, JSON.stringify(d));
}
const POSISI = (tiket, v = {}) => ({ tiket, simbol: 'XAUUSDc', arah: 'BUY', lot: 0.17, ...v });

/* ── 1. Perilaku normal tetap jalan ───────────────────────────────────── */
uji('catatan baru menjodoh dengan posisi yang seukuran', () => {
  tanda({ waktu: KINI - 30_000 });
  const p = petaCopyPada(UID, [POSISI('111')], KINI);
  sama(p.get('111'), 'Bagus Jaya');
});

uji('sesudah terikat, pencocokan lewat tiket saja — lot boleh berubah', () => {
  tanda({ waktu: KINI - 30_000 });
  petaCopyPada(UID, [POSISI('111')], KINI);
  /* Tiga hari kemudian, posisinya masih hidup dan lotnya sudah ditambah. */
  const p = petaCopyPada(UID, [POSISI('111', { lot: 0.5 })], KINI + 3 * 24 * JAM);
  sama(p.get('111'), 'Bagus Jaya', 'ikatan tiket bertahan melewati jendela');
});

/* ── 2. CACAT YANG DILAPORKAN ─────────────────────────────────────────── */
uji('catatan berumur 3 hari TIDAK melabeli posisi manual yang seukuran', () => {
  tanda({ waktu: KINI - 3 * 24 * JAM });
  const p = petaCopyPada(UID, [POSISI('999')], KINI);
  sama(p.size, 0, 'posisi manual tidak boleh dapat label');
});

uji('catatan 7 jam (di luar jendela 6 jam) juga tidak menjodoh', () => {
  tanda({ waktu: KINI - 7 * JAM });
  sama(petaCopyPada(UID, [POSISI('999')], KINI).size, 0);
});

uji('catatan 5 jam masih di dalam jendela — batasnya tidak terlalu ketat', () => {
  tanda({ waktu: KINI - 5 * JAM });
  sama(petaCopyPada(UID, [POSISI('222')], KINI).get('222'), 'Bagus Jaya');
});

uji('salinan lama yang sudah DITUTUP tidak kembali jadi label mengambang', () => {
  /* Ikat dulu, seperti yang terjadi berminggu-minggu lalu. */
  tanda({ waktu: KINI - 20 * 24 * JAM });
  petaCopyPada(UID, [POSISI('111')], KINI - 20 * 24 * JAM + 1000);
  sama(bacaTanda(UID)[0].tiket, '111', 'prasyarat: sudah terikat');

  /* Hari ini posisi 111 sudah lama tertutup, dan yang hidup posisi MANUAL
     baru yang kebetulan simbol/arah/lotnya sama. */
  const p = petaCopyPada(UID, [POSISI('777')], KINI);
  sama(p.size, 0, 'ikatan basi tidak boleh dilepas lalu direbut posisi baru');
});

uji('ikatan basi MASIH boleh dilepas selama catatannya muda', () => {
  tanda({ waktu: KINI - 10 * 60_000 });
  petaCopyPada(UID, [POSISI('111')], KINI - 9 * 60_000);
  sama(bacaTanda(UID)[0].tiket, '111');
  /* Order uji tadi hilang, salinannya masuk dengan tiket lain semenit lalu. */
  const p = petaCopyPada(UID, [POSISI('112')], KINI);
  sama(p.get('112'), 'Bagus Jaya', 'jodoh ulang dalam jendela tetap boleh');
});

/* ── 3. Perilaku sekitar yang tidak boleh ikut berubah ────────────────── */
uji('EA mati (daftar posisi kosong) tidak melepas ikatan apa pun', () => {
  tanda({ waktu: KINI - 60_000 });
  petaCopyPada(UID, [POSISI('111')], KINI - 50_000);
  sama(petaCopyPada(UID, [], KINI).size, 0, 'peta kosong saat tidak ada posisi');
  sama(bacaTanda(UID)[0].tiket, '111', 'ikatannya tetap');
});

uji('dua catatan muda tidak merebut satu tiket yang sama', () => {
  tanda({ waktu: KINI - 60_000, analis: 'A' });
  tanda({ waktu: KINI - 50_000, analis: 'B' });
  const p = petaCopyPada(UID, [POSISI('111')], KINI);
  sama(p.size, 1);
  sama(p.get('111'), 'A', 'yang terlama menjodoh lebih dulu');
});

uji('simbol dasar sama (XAUUSD vs XAUUSDc) tetap dianggap cocok', () => {
  tanda({ waktu: KINI - 60_000, simbol: 'XAUUSD' });
  sama(petaCopyPada(UID, [POSISI('111')], KINI).get('111'), 'Bagus Jaya');
});

uji('arah berbeda tidak pernah cocok', () => {
  tanda({ waktu: KINI - 60_000 });
  sama(petaCopyPada(UID, [POSISI('111', { arah: 'SELL' })], KINI).size, 0);
});

uji('catatan lebih tua dari 30 hari dibuang saat penyimpanan ditulis', () => {
  /* Penyapuan umur memakai jam SUNGGUHAN (ia terjadi di dalam `simpan`,
     yang tidak menerima waktu suntikan), jadi kasus ini diukur dari
     Date.now() — bukan dari KINI yang letaknya di masa depan. */
  tanda({ waktu: Date.now() - 40 * 24 * JAM });
  tanda({ waktu: Date.now() - 60_000 });
  sama(bacaTanda(UID).length, 2, 'prasyarat: keduanya masih tersimpan');
  /* catatCopy menulis, dan penulisan itulah yang menyapu yang tua. */
  catatCopy(UID, { simbol: 'EURUSD', arah: 'SELL', lot: 0.1, analis: 'C' });
  const sisa = bacaTanda(UID);
  sama(sisa.length, 2, 'yang berumur 40 hari terbuang, dua yang muda tinggal');
  sama(sisa.some((t) => t.analis === 'C'), true);
});

console.log(gagal ? `\n${gagal} dari ${n} GAGAL` : `\nSemua ${n} lulus.`);
process.exit(gagal ? 1 : 0);
