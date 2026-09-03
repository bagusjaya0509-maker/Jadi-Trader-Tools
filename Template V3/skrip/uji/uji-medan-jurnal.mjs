/* Uji kepemilikan medan jurnal: src/lib/medan-jurnal.ts
   ────────────────────────────────────────────────────────────────────────
   Jalankan: node skrip/uji/uji-medan-jurnal.mjs

   Yang dikunci di sini satu kalimat — TULISAN TANGAN MENANG — tapi ia
   dibaca dari dua tempat (tabel riwayat dan modal sunting). Kalau keduanya
   pernah berselisih, akibatnya bukan tampilan yang aneh melainkan DATA
   HILANG: modal menampilkan nilai mesin, orangnya menekan Simpan, dan
   nilai tulisan tangan tertimpa.                                        */

import {
  alasanJurnal, catatanJurnal, emosiJurnal, emosiEvaluasiJurnal,
} from '../../src/lib/medan-jurnal.ts';

let n = 0, gagal = 0;
function uji(nama, f) {
  n++;
  try { f(); console.log('OK    ' + nama); }
  catch (e) { gagal++; console.log('GAGAL ' + nama + '\n      ' + (e && e.message || e)); }
}
function sama(a, b, pesan) {
  if (a !== b) throw new Error((pesan || '') + ' → dapat ' + JSON.stringify(a) + ', harap ' + JSON.stringify(b));
}

/* Bentuk dokumen sesungguhnya, bukan yang enak diuji. */
const MESIN = {
  _sinkron: {
    alasan: 'Sinkron Hyperliquid',
    catatan: 'Ditutup di Hyperliquid (5199) · 3 isian · fee -0.1240 · dompet 0xf5d8…3ad53',
  },
};
const TANGAN = {
  psikologi: {
    emosiMasuk: 'Serakah', emosiEvaluasi: 'Menyesal',
    alasanMasuk: 'Breakout retest', catatan: 'Overtrade sesudah rugi',
  },
};

uji('trade hasil sinkron: Setup & catatan diisi medan mesin', () => {
  sama(alasanJurnal(MESIN), 'Sinkron Hyperliquid');
  sama(catatanJurnal(MESIN), MESIN._sinkron.catatan);
  sama(emosiJurnal(MESIN), '', 'mesin TIDAK boleh mengarang emosi');
  sama(emosiEvaluasiJurnal(MESIN), '');
});

uji('sesudah disunting: tulisan tangan menang atas medan mesin', () => {
  const d = { ...MESIN, ...TANGAN };
  sama(alasanJurnal(d), 'Breakout retest');
  sama(catatanJurnal(d), 'Overtrade sesudah rugi');
  sama(emosiJurnal(d), 'Serakah');
  sama(emosiEvaluasiJurnal(d), 'Menyesal');
});

uji('tulisan tangan KOSONG jatuh ke medan mesin, bukan jadi kosong', () => {
  const d = { ...MESIN, psikologi: { emosiMasuk: '', emosiEvaluasi: '', alasanMasuk: '', catatan: '' } };
  sama(alasanJurnal(d), 'Sinkron Hyperliquid');
  sama(catatanJurnal(d), MESIN._sinkron.catatan);
  sama(emosiJurnal(d), '', 'kosong tetap kosong — tidak ada cadangan emosi');
});

uji('trade manual tanpa medan mesin', () => {
  sama(alasanJurnal(TANGAN), 'Breakout retest');
  sama(catatanJurnal(TANGAN), 'Overtrade sesudah rugi');
  sama(emosiJurnal(TANGAN), 'Serakah');
});

uji('dokumen migrasi lama: sebabKeluar jadi cadangan terakhir', () => {
  sama(alasanJurnal({ sebabKeluar: 'Ditutup di MT5' }), 'Ditutup di MT5');
  /* Urutannya: tangan → mesin → sebabKeluar. Bukan sebaliknya. */
  sama(alasanJurnal({ sebabKeluar: 'Ditutup di MT5', ...MESIN }), 'Sinkron Hyperliquid');
  sama(alasanJurnal({ sebabKeluar: 'Ditutup di MT5', ...MESIN, ...TANGAN }), 'Breakout retest');
});

uji('dokumen kosong / medan hilang / null tidak melempar', () => {
  for (const d of [{}, { psikologi: null }, { _sinkron: null }, { psikologi: null, _sinkron: null }]) {
    sama(alasanJurnal(d), ''); sama(catatanJurnal(d), '');
    sama(emosiJurnal(d), ''); sama(emosiEvaluasiJurnal(d), '');
  }
});

uji('nilai bukan-string tidak bocor sebagai objek', () => {
  sama(alasanJurnal({ psikologi: { alasanMasuk: 42 } }), '42');
  sama(catatanJurnal({ psikologi: { catatan: null }, _sinkron: { catatan: 'mesin' } }), 'mesin');
});

console.log(gagal ? `\n${gagal} dari ${n} GAGAL` : `\nSemua ${n} lulus.`);
process.exit(gagal ? 1 : 0);
