/* ════════════════════════════════════════════════════════════════════════
   SURAT LISENSI + PENANDA SALINAN
   ════════════════════════════════════════════════════════════════════════
   Port SETIA dari marketplace.html V2 — teks surat dan keempat titik
   penanda dibuat identik, supaya salinan yang beredar bisa ditelusuri
   dengan alat yang sama (bacaPenanda di V2) dari mana pun asal unduhannya.

   Penandanya menyamar sebagai catatan build biasa dan disebar di empat
   titik: kalau satu dihapus, sisanya masih merekonstruksi kodenya. Tidak
   ada satu pun yang mengubah perilaku indikator.
   ════════════════════════════════════════════════════════════════════════ */

export interface DataSurat {
  produk: string;
  kode: string;
  nama: string;
  email: string;
  hp?: string;
}

export function suratLisensi(d: DataSurat): string {
  const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return ''
    + 'SURAT LISENSI PENGGUNAAN INDIKATOR\n'
    + '══════════════════════════════════════════════════\n\n'
    + 'Produk        : ' + d.produk + '\n'
    + 'Kode Lisensi  : ' + d.kode + '\n'
    + 'Tanggal Terbit: ' + tgl + '\n\n'
    + 'DIBERIKAN KEPADA\n'
    + 'Nama          : ' + d.nama + '\n'
    + 'Email         : ' + d.email + '\n'
    + 'No. Telepon   : ' + (d.hp || '-') + '\n\n'
    + 'KETENTUAN\n'
    + '1. Lisensi ini bersifat PERSONAL dan hanya berlaku untuk satu orang,\n'
    + '   yaitu pemegang nama di atas. Lisensi tidak dapat dipindahtangankan,\n'
    + '   dijual kembali, disewakan, maupun dipakai bersama-sama.\n'
    + '2. Pemegang lisensi boleh memasang indikator ini di akun TradingView\n'
    + '   miliknya sendiri, pada perangkat sebanyak yang ia butuhkan.\n'
    + '3. Pemegang lisensi DILARANG menyebarluaskan, membagikan, mengunggah\n'
    + '   ulang, atau mempublikasikan kode sumber indikator ini, baik utuh\n'
    + '   maupun sebagian, dengan atau tanpa imbalan.\n'
    /* Pasal penelusuran dipertahankan persis seperti V2: tanpa klausul ini,
       pemegang lisensi bisa berdalih tidak pernah menyetujui salinannya
       ditelusuri. Kalimatnya umum — tidak membocorkan cara kerjanya. */
    + '4. Setiap salinan indikator ini diterbitkan khusus untuk satu pemegang\n'
    + '   lisensi dan tercatat pada penerbit. Bila kode sumber indikator ini\n'
    + '   ditemukan beredar tanpa izin, penerbit berhak menelusuri asal\n'
    + '   salinan tersebut dan menindaklanjutinya.\n'
    + '5. Pelanggaran ketentuan nomor 3 mengakibatkan lisensi ini gugur\n'
    + '   seketika tanpa pengembalian dana, dan penerbit berhak menempuh\n'
    + '   upaya hukum atas pelanggaran hak cipta sesuai peraturan yang\n'
    + '   berlaku di Republik Indonesia, antara lain Undang-Undang Nomor 28\n'
    + '   Tahun 2014 tentang Hak Cipta.\n'
    + '6. Indikator ini adalah ALAT BANTU ANALISIS, bukan ajakan membeli atau\n'
    + '   menjual, bukan jaminan keuntungan, dan bukan nasihat keuangan.\n'
    + '   Seluruh keputusan dan risiko transaksi sepenuhnya ada pada\n'
    + '   pemegang lisensi.\n\n'
    + 'Dengan mengunduh dan memakai berkas indikator ini, pemegang lisensi\n'
    + 'dianggap telah membaca, memahami, dan menyetujui seluruh ketentuan\n'
    + 'di atas.\n\n'
    + '══════════════════════════════════════════════════\n'
    + 'Diterbitkan oleh: Jadi Trader\n'
    + 'Simpan surat ini bersama berkas indikatormu sebagai bukti kepemilikan.\n';
}

/** Sisipkan penanda lisensi ke sumber Pine — identik dengan V2. */
export function sisipkanPenanda(sumber: string, kode: string): string {
  const inti = kode.replace(/^JT3-/, '').replace(/-/g, '');
  if (inti.length < 12) return sumber; // kode tidak berbentuk JT3 — jangan merusak berkas
  const a = inti.substring(0, 4), b = inti.substring(4, 8), c = inti.substring(8, 12);
  const eol = sumber.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const baris = sumber.split(/\r?\n/);
  const stempel = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  let iVer = baris.findIndex((l) => l.startsWith('//@version'));
  if (iVer < 0) iVer = 0;
  baris.splice(iVer + 1, 0, `// build ${stempel}.${a.toLowerCase()} — dist ${b.toLowerCase()}`);

  const iInd = baris.findIndex((l) => l.includes('indicator('));
  if (iInd >= 0) {
    baris.splice(iInd + 1, 0, '', '// revisi internal — jangan diubah', `_rev = "${a}${c}"`);
  }

  let tengah = Math.floor(baris.length * 0.55);
  for (let i = tengah; i < baris.length; i++) {
    if (baris[i].startsWith('// ═══')) { tengah = i; break; }
  }
  baris.splice(tengah, 0, `// ref-${b.toLowerCase()}${c.toLowerCase()} (${stempel})`);

  baris.push('');
  baris.push(`// ${stempel}-${a.toLowerCase()}${b.toLowerCase()}${c.toLowerCase()}`);
  return baris.join(eol);
}

/** Unduh teks sebagai berkas .txt di sisi peramban. */
export function unduhTeks(nama: string, isi: string) {
  const url = URL.createObjectURL(new Blob([isi], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
