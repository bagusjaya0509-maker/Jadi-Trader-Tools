import { readFileSync, writeFileSync } from 'node:fs';

/* ════════════════════════════════════════════════════════════════════════
   Hitungan pengcopy SUNGGUHAN per sinyal.
   ════════════════════════════════════════════════════════════════════════
   Kartu sinyal menulis "0 pengcopy" pada sinyal yang BARU SAJA disalin
   pemiliknya sendiri — karena angka itu sebenarnya jumlahPembeli, daftar
   pembeli akses berbayar. Eksekusi copy (panel manual, pengikut peramban,
   pengikut server) tidak pernah menyentuhnya. Angka bernama "pengcopy"
   yang menghitung hal lain adalah angka yang berbohong dengan tenang.

   Rute baru POST /api/analisa/dicopy mencatat uid penyalin per sinyal —
   SEKALI per orang, jadi menyalin ulang tidak menggelembungkan angkanya.
   Daftar uid-nya privat; yang keluar ke publik hanya jumlahnya
   (jumlahCopy) lewat pemetaan daftar yang sudah menyaring medan privat.

   Dua pintu masuk, karena penyalinnya dua jenis:
     · peramban  → token Firebase (butuhLogin), uid dari sesinya
     · pengikut server → X-App-Token + uid eksplisit, pola yang sama
       dengan rute agen yang sudah ada
   ════════════════════════════════════════════════════════════════════════ */

const berkas = process.argv[2] || 'server.js';
let s = readFileSync(berkas, 'utf8');

if (s.includes('/api/analisa/dicopy')) {
  console.log('rute dicopy sudah ada — tidak ada yang diubah.');
  process.exit(0);
}

const J1 = 'snapshot: a.snapshot || null, jumlahPembeli: (a.pembeli || []).length,';
if (s.split(J1).length - 1 !== 1) { console.error('GAGAL: jangkar pemetaan publik'); process.exit(1); }
s = s.replace(J1, J1 + '\n    jumlahCopy: (a.pengcopyUid || []).length,');

const J2 = "app.post('/api/analisa/agen', batasLaju, requireToken, (req, res) => {";
if (s.split(J2).length - 1 !== 1) { console.error('GAGAL: jangkar rute agen'); process.exit(1); }

const RUTE = `// --- Pencatat pengcopy: sekali per orang per sinyal ---
app.post('/api/analisa/dicopy', batasLaju, (req, res) => {
  const naikkan = (uid) => {
    const d = analisaBaca();
    const a = d.daftar.find((x) => x.id === String((req.body || {}).id || ''));
    if (!a) return res.status(404).json({ error: 'sinyal tidak ditemukan' });
    if (!Array.isArray(a.pengcopyUid)) a.pengcopyUid = [];
    if (!a.pengcopyUid.includes(uid)) {
      a.pengcopyUid.push(uid);
      analisaTulis(d);
    }
    res.json({ ok: true, jumlah: a.pengcopyUid.length });
  };
  const token = req.get('X-App-Token');
  const uidBadan = String((req.body || {}).uid || '');
  if (token && process.env.APP_TOKEN && token === process.env.APP_TOKEN && uidBadan) {
    return naikkan(uidBadan);
  }
  butuhLogin(req, res, () => naikkan(req.uid));
});

`;
s = s.replace(J2, RUTE + J2);
writeFileSync(berkas, s);
console.log('rute /api/analisa/dicopy + medan jumlahCopy terpasang.');
