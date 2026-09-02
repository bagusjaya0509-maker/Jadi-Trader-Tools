/* Yang diuji: kabar pribadi TIDAK bocor. Fungsi aslinya dipotong dari
   server.js, jadi kalau penyaringnya dilonggarkan suatu hari, uji ini gagal. */
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/vps/server.js', 'utf8');
function potong(nama) {
  const i = src.indexOf('function ' + nama + '(');
  let dalam = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') dalam++;
    else if (src[k] === '}') { dalam--; if (!dalam) return src.slice(i, k + 1); }
  }
}

const UMUM = [{ id: 'agen1', judul: 'Sinyal BTC', waktu: 5000 }];
const PRIBADI = [
  { id: 'p:a', uid: 'discord:AAA', judul: 'Akses gratismu berakhir', detail: 'x', waktu: 9000 },
  { id: 'p:b', uid: 'google:BBB', judul: 'Punya orang lain', detail: 'y', waktu: 7000 },
];
const kotak = { console, kabarBaca: () => UMUM, kabarPribadiBaca: () => PRIBADI };
vm.createContext(kotak);
vm.runInContext(potong('kabarUntuk'), kotak);
const K = kotak.kabarUntuk;

let lulus = 0, gagal = 0;
const cek = (n, b) => { b ? (lulus++, console.log('  ok   ' + n)) : (gagal++, console.log('  GAGAL ' + n)); };
const ids = (uid) => K(uid).map((x) => x.id);

cek('tamu: hanya kabar umum', JSON.stringify(ids(undefined)) === '["agen1"]');
cek('tamu: uid kosong pun sama', JSON.stringify(ids('')) === '["agen1"]');
cek('tamu TIDAK melihat kabar pribadi siapa pun',
    !ids(undefined).some((i) => i.startsWith('p:')));
cek('pemilik uid: melihat miliknya', ids('discord:AAA').includes('p:a'));
cek('TIDAK melihat milik orang lain', !ids('discord:AAA').includes('p:b'));
cek('kabar umum tetap ikut', ids('discord:AAA').includes('agen1'));
cek('terbaru di atas', K('discord:AAA')[0].id === 'p:a');
cek('uid asing tidak mendapat apa pun selain umum',
    JSON.stringify(ids('siapa-pun')) === '["agen1"]');
cek('bentuk barisnya lengkap untuk lonceng', (() => {
  const b = K('discord:AAA').find((x) => x.id === 'p:a');
  return b.judul && b.sumber === 'Jadi Trader Tools' && typeof b.waktu === 'number';
})());

console.log('\n' + lulus + ' lulus, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
