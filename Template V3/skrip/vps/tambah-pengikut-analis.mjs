import { readFileSync, writeFileSync } from 'node:fs';

/* ════════════════════════════════════════════════════════════════════════
   Pencatat PENGIKUT ANALIS — "berapa orang yang mengikuti", bukan "berapa
   kali disalin".
   ════════════════════════════════════════════════════════════════════════
   Dua angka yang selama ini tertukar di kepala pemakainya, dan wajar:

     · DISALIN  = order yang benar-benar dieksekusi, dihitung per SINYAL.
                  Sudah ada (rute /api/analisa/dicopy).
     · PENGIKUT = orang yang menekan "Ikuti analis ini". Satu langganan
                  bisa melahirkan puluhan salinan, atau nol kalau analisnya
                  belum memposting apa-apa sejak diikuti.

   Sampai sekarang langganan HANYA hidup di localStorage peramban masing-
   masing orang — jadi tidak ada satu tempat pun yang tahu berapa orang
   mengikuti seorang analis. Kartu analis lalu menampilkan angka salinan
   dan pembacanya mengira itu jumlah pengikut.

   PRIVASI: daftar uid disimpan supaya "sekali per orang" bisa ditegakkan
   dan supaya berhenti-mengikuti benar-benar mengurangi angkanya, tapi yang
   KELUAR dari rute publik hanya JUMLAHNYA. Siapa mengikuti siapa bukan
   urusan orang lain.
   ════════════════════════════════════════════════════════════════════════ */

const berkas = process.argv[2] || 'server.js';
let s = readFileSync(berkas, 'utf8');

if (s.includes("'/api/analis/pengikut'")) {
  console.log('rute pengikut analis sudah ada — tidak ada yang diubah.');
  process.exit(0);
}

const J = "app.post('/api/analisa/dicopy', batasLaju, (req, res) => {";
if (s.split(J).length - 1 !== 1) {
  console.error('GAGAL: jangkar rute dicopy tidak ditemukan persis satu kali. Pasang tambah-dicopy.mjs dulu.');
  process.exit(1);
}

const RUTE = `// --- Pengikut analis: siapa berlangganan siapa (jumlahnya saja yang publik) ---
const PENGIKUT_FILE = path.join(__dirname, 'pengikut-analis.json');
function pengikutBaca() {
  try { return JSON.parse(fs.readFileSync(PENGIKUT_FILE, 'utf8')) || {}; } catch (e) { return {}; }
}
function pengikutTulis(d) {
  const tmp = PENGIKUT_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, PENGIKUT_FILE);
}

/* Hanya JUMLAHNYA. Daftar uid tetap di server untuk menegakkan sekali-per-
   orang; siapa mengikuti siapa tidak pernah keluar dari sini. */
app.get('/api/analis/pengikut', batasLaju, (req, res) => {
  const d = pengikutBaca();
  const jumlah = {};
  for (const uid of Object.keys(d)) jumlah[uid] = (d[uid] || []).length;
  res.json({ jumlah });
});

app.post('/api/analis/ikuti', batasLaju, butuhLogin, express.json(), (req, res) => {
  const b = req.body || {};
  const analisUid = String(b.analisUid || '');
  if (!analisUid) return res.status(400).json({ error: 'analisUid wajib' });
  /* MENGIKUTI DIRI SENDIRI IKUT DIHITUNG, dan itu bukan kelonggaran.
     Angka ini menjawab "berapa akun yang sedang menyalin analis ini" —
     dan analis yang mengikuti kanalnya sendiri memang benar-benar
     disalin oleh satu akun: akunnya sendiri. Mesin penyalinnya bekerja
     persis sama untuk dia. Mengecualikannya justru membuat angkanya
     berbohong ke arah yang lain, dan membuat pengujian sendiri selalu
     memulangkan nol tanpa sebab yang terlihat. */

  const d = pengikutBaca();
  const daftar = Array.isArray(d[analisUid]) ? d[analisUid] : [];
  const ada = daftar.indexOf(req.uid);
  const ikut = b.ikut !== false;
  if (ikut && ada < 0) daftar.push(req.uid);
  if (!ikut && ada >= 0) daftar.splice(ada, 1);
  d[analisUid] = daftar;
  pengikutTulis(d);
  res.json({ ok: true, jumlah: daftar.length });
});

`;

s = s.replace(J, RUTE + J);
writeFileSync(berkas, s);
console.log('rute /api/analis/ikuti + /api/analis/pengikut terpasang.');
