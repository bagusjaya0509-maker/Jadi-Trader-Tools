/* Uji base58 di `src/lib/dex-swap.ts`.
   ────────────────────────────────────────────────────────────────────────
   Dipisah jadi berkas uji sendiri karena kesalahannya senyap: pengkodean
   yang meleset satu huruf tetap menghasilkan string yang kelihatan benar,
   dan yang menolaknya nanti adalah Phantom — dengan pesan yang tidak
   menyebut pengkodean sama sekali, di saat orangnya sedang menunggu
   transaksi uang sungguhan.

   Vektor di bawah baku (dipakai Bitcoin/Solana), bukan karangan sendiri.
   Jalankan: node skrip/uji/uji-base58.mjs                                */

const ABJAD58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58(b) {
  let nol = 0;
  while (nol < b.length && b[nol] === 0) nol++;
  const angka = [];
  for (let i = nol; i < b.length; i++) {
    let bawa = b[i];
    for (let j = 0; j < angka.length; j++) {
      const v = (angka[j] << 8) + bawa;
      angka[j] = v % 58;
      bawa = (v / 58) | 0;
    }
    while (bawa > 0) { angka.push(bawa % 58); bawa = (bawa / 58) | 0; }
  }
  let s = '1'.repeat(nol);
  for (let i = angka.length - 1; i >= 0; i--) s += ABJAD58[angka[i]];
  return s;
}

const hex = (h) => Uint8Array.from(Buffer.from(h, 'hex'));

const VEKTOR = [
  ['', ''],
  ['61', '2g'],
  ['626262', 'a3gV'],
  ['636363', 'aPEr'],
  ['73696d706c792061206c6f6e6720737472696e67', '2cFupjhnEsSn59qHXstmK2ffpLv2'],
  ['00eb15231dfceb60925886b67d065299925915aeb172c06647', '1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L'],
  ['516b6fcd0f', 'ABnLTmg'],
  ['bf4f89001e670274dd', '3SEo3LWLoPntC'],
  ['572e4794', '3EFU7m'],
  ['ecac89cad93923c02321', 'EJDM8drfXA6uyA'],
  ['10c8511e', 'Rt5zm'],
  ['00000000000000000000', '1111111111'],
  /* Nol di depan HARUS jadi '1', dan jumlahnya harus sama persis. Transaksi
     Solana yang belum ditandatangani diawali blok nol sepanjang slot tanda
     tangannya — jadi kasus ini justru yang paling sering kena. */
  ['0000287fb4cd', '11233QC4'],
];

let gagal = 0;
for (const [h, harap] of VEKTOR) {
  const dapat = base58(hex(h));
  const ok = dapat === harap;
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${h.padEnd(52)} -> ${dapat}${ok ? '' : `  (harusnya ${harap})`}`);
}

/* Bentuk nyata: transaksi Jupiter yang belum ditandatangani, 1024 huruf
   base64. Yang diuji di sini bukan nilainya (tidak ada acuan bakunya)
   melainkan bahwa panjangnya masuk akal dan tidak ada huruf terlarang. */
const contoh = new Uint8Array(768);
contoh[0] = 1; // jumlah tanda tangan
for (let i = 65; i < 768; i++) contoh[i] = (i * 37) % 256;
const s = base58(contoh);
const kotor = [...s].filter((c) => !ABJAD58.includes(c));
const masukAkal = s.length > 768 && s.length < 768 * 1.4 && kotor.length === 0;
console.log(`${masukAkal ? 'OK  ' : 'GAGAL'} transaksi 768 bita -> ${s.length} huruf, ${kotor.length} huruf terlarang`);
if (!masukAkal) gagal++;

console.log(gagal ? `\n${gagal} GAGAL` : '\nSemua lulus.');
process.exit(gagal ? 1 : 0);
