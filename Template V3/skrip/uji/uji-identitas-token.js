/* Rantai penuh: token -> verifikasiIdToken -> identitasToken -> tambalIdentitas.
   Kripto dipalsukan (tanda tangan selalu sah) supaya token uji bisa dibuat,
   tapi SELURUH sisanya kode asli dari server.js — termasuk baris return yang
   tadi membuang klaim. */
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/vps/server.js', 'utf8');

function potong(nama) {
  const i = src.indexOf('function ' + nama + '(');
  const j = src.lastIndexOf('async ', i) === i - 6 ? i - 6 : i;
  let dalam = 0, mulai = src.indexOf('{', i);
  for (let k = mulai; k < src.length; k++) {
    if (src[k] === '{') dalam++;
    else if (src[k] === '}') { dalam--; if (!dalam) return src.slice(j, k + 1); }
  }
}

const data = JSON.parse(fs.readFileSync(__dirname + '/lisensi-uji2.json', 'utf8'));
let tulisan = 0;
const kotak = {
  console, FB_PROJECT: 'proyek-uji',
  b64urlKeJson: (b) => JSON.parse(Buffer.from(b, 'base64url').toString('utf8')),
  ambilSertifikat: async () => ({ kid1: 'pem-palsu' }),
  crypto: { createVerify: () => ({ update() {}, end() {}, verify: () => true }),
            createPublicKey: () => 'kunci' },
  Buffer,
  lisensiBaca: () => data,
  lisensiTulis: () => { tulisan++; },
  lisensiPermintaan: (d) => d.permintaan,
};
vm.createContext(kotak);
vm.runInContext('const sudahDitambal = new Set();\n'
  + potong('verifikasiIdToken') + '\n' + potong('identitasToken') + '\n' + potong('tambalIdentitas'), kotak);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(klaim) {
  return b64({ alg: 'RS256', kid: 'kid1' }) + '.' + b64(Object.assign({
    sub: 'x', aud: 'proyek-uji', iss: 'https://securetoken.google.com/proyek-uji',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, klaim)) + '.tandatangan';
}

let lulus = 0, gagal = 0;
const cek = (n, b) => { b ? (lulus++, console.log('  ok   ' + n)) : (gagal++, console.log('  GAGAL ' + n)); };

(async () => {
  const UID = 'discord:1518626452776423576';
  const v = await kotak.verifikasiIdToken(token({
    sub: UID, discord: true, emailDiscord: 'orang@discord.test', namaDiscord: 'sicoba' }));

  cek('uid tetap dari sub', v.uid === UID);
  cek('emailDiscord LOLOS dari verifikator', v.emailDiscord === 'orang@discord.test');
  cek('namaDiscord LOLOS dari verifikator', v.namaDiscord === 'sicoba');
  cek('identitasToken membacanya', kotak.identitasToken(v).email === 'orang@discord.test');

  const baris = () => data.permintaan.filter((x) => x.uid === UID);
  cek('sebelum ditambal alamatnya kosong', baris().every((x) => !x.email));
  kotak.tambalIdentitas(v.uid, v);
  cek('SESUDAH: alamatnya terisi', baris().every((x) => x.email === 'orang@discord.test'));
  cek('SESUDAH: namanya terisi', baris().every((x) => x.nama === 'sicoba'));
  cek('berkas ditulis sekali', tulisan === 1);

  const g = await kotak.verifikasiIdToken(token({ sub: 'google-1', email: 'a@b.com', name: 'Budi' }));
  cek('Google: email tetap jalan', g.email === 'a@b.com');
  cek('Google: name kini ikut lolos', g.name === 'Budi');
  cek('token tanpa email -> string kosong, bukan undefined', (await kotak.verifikasiIdToken(token({ sub: 'z' }))).email === '');

  console.log('\n' + lulus + ' lulus, ' + gagal + ' gagal');
  process.exit(gagal ? 1 : 0);
})();
