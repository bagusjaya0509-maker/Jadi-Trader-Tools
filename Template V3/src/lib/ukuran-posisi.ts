/* ════════════════════════════════════════════════════════════════════════
   UKURAN POSISI — satu sumber angka untuk kalkulator DAN eksekusi
   ════════════════════════════════════════════════════════════════════════
   Rumusnya sudah lama hidup di dalam komponen HitungPosisi, dan selama ia
   cuma menampilkan angka itu tidak apa-apa. Begitu tombol Copy benar-benar
   mengirim order, angka yang sama harus dipakai dua kali: sekali untuk
   diperlihatkan, sekali untuk dikirim. Menyalin rumusnya ke tempat kedua
   berarti suatu hari yang tampil dan yang terkirim berbeda — dan yang
   berbeda itu ukuran posisi orang.

   ── KENAPA LEVERAGE TIDAK MENENTUKAN RISIKO ─────────────────────────────
   Jarak SL BUKAN risiko. Risiko = ukuran posisi x jarak SL. Leverage cuma
   menentukan berapa margin yang tertahan bursa, bukan berapa yang hilang
   saat SL kena. SL yang LEBAR justru butuh leverage lebih KECIL.

   TRADE-FI (MT5): leverage tidak masuk hitungan sama sekali. Yang
   menentukan kerugian per lot adalah UKURAN KONTRAK simbolnya.
   ════════════════════════════════════════════════════════════════════════ */

export interface SetelanRisiko {
  /** Modal yang dipakai sebagai dasar persentase risiko, dalam dolar. */
  modal: number;
  /** Berapa persen modal yang boleh hilang kalau SL kena. */
  risiko: number;
  /** Kripto saja — tidak menyentuh besar risiko, hanya margin tertahan. */
  leverage: number;
}

export const RISIKO_BAWAAN: SetelanRisiko = { modal: 1000, risiko: 1, leverage: 1 };

/* Kunci LAMA, tanpa uid. Dibaca sekali sebagai warisan supaya orang yang
   sudah menyetel modalnya di kalkulator tidak menemukannya kosong lagi. */
const KUNCI_LAMA = 'jt.hitung.posisi.v2';
const kunci = (uid?: string | null) => (uid ? `jt.risiko.${uid}` : KUNCI_LAMA);

function bersihkan(j: unknown): SetelanRisiko {
  const o = (j ?? {}) as Record<string, unknown>;
  const angka = (v: unknown, bawaan: number) => (Number(v) > 0 ? Number(v) : bawaan);
  return {
    modal: angka(o.modal, RISIKO_BAWAAN.modal),
    risiko: angka(o.risiko, RISIKO_BAWAAN.risiko),
    leverage: angka(o.leverage, RISIKO_BAWAAN.leverage),
  };
}

/** DIKUNCI PER PENGGUNA. Modal dan toleransi risiko adalah milik orangnya,
 *  dan satu komputer bisa dipakai dua akun bergantian — tanpa uid, modal
 *  $50.000 milik yang satu jadi dasar ukuran posisi yang lain. */
export function bacaSetelanRisiko(uid?: string | null): SetelanRisiko {
  try {
    const punya = localStorage.getItem(kunci(uid));
    if (punya) return bersihkan(JSON.parse(punya));
    /* Belum punya yang ber-uid: pinjam sekali dari kunci lama. TIDAK
       dipindahkan — kalkulator versi lama masih membacanya, dan mencabutnya
       di sini akan mengosongkan panel yang tidak kami sentuh. */
    return bersihkan(JSON.parse(localStorage.getItem(KUNCI_LAMA) || '{}'));
  } catch { return RISIKO_BAWAAN; }
}

export function simpanSetelanRisiko(n: SetelanRisiko, uid?: string | null) {
  try { localStorage.setItem(kunci(uid), JSON.stringify(n)); } catch { /* mode privat */ }
}

/** Ukuran kontrak MT5 per 1 lot, DITEBAK dari nama simbolnya — dan karena
 *  itu wajib bisa disunting orangnya. Ukuran kontrak ditentukan BROKER,
 *  bukan standar dunia: sebagian menulis emas 100 oz per lot, sebagian 10.
 *  Tebakan yang tidak bisa dikoreksi akan diam-diam salah, dan salahnya
 *  berupa lot yang terlalu besar — bukan sekadar tampilan yang keliru. */
export function kontrakBawaan(pasangan: string): number {
  const s = (pasangan || '').replace(/^MT5:/i, '').toUpperCase();
  if (s.startsWith('XAU')) return 100;
  if (s.startsWith('XAG')) return 5000;
  if (/^[A-Z]{6}$/.test(s)) return 100_000;
  return 100_000;
}

/** Besar 1 pip — UNTUK DIBACA SAJA, tidak pernah untuk menghitung lot.
 *  "Pip" tidak disepakati semua broker (emas 0,1 di sebagian, 0,01 di
 *  sebagian lain), jadi lot yang dihitung lewat pip ikut salah di broker
 *  yang memakai kesepakatan lain. Lot dihitung dari JARAK HARGA, yang
 *  tidak punya kesepakatan dan karena itu tidak bisa salah. */
export function besarPip(pasangan: string): number {
  const t = (pasangan || '').replace(/^MT5:/i, '').toUpperCase();
  if (t.startsWith('XAU')) return 0.1;
  if (t.startsWith('XAG')) return 0.01;
  if (/JPY$/.test(t)) return 0.01;
  if (/^[A-Z]{6}$/.test(t)) return 0.0001;
  return 0.01;
}

export interface HasilUkuran {
  sah: boolean;
  /** Alasan kenapa tidak sah — ditulis apa adanya untuk ditampilkan. */
  sebab: string;
  jarakHarga: number;
  jarakPersen: number;
  risikoDolar: number;
  /** MT5: lot yang harus dikirim. Kripto: 0. */
  lot: number;
  /** Kripto: nilai posisi (notional) dalam dolar. MT5: 0. */
  nilaiPosisi: number;
  /** Kripto: margin yang tertahan = nilai posisi / leverage. MT5: 0. */
  margin: number;
}

const KOSONG: HasilUkuran = {
  sah: false, sebab: '', jarakHarga: 0, jarakPersen: 0,
  risikoDolar: 0, lot: 0, nilaiPosisi: 0, margin: 0,
};

/**
 * Satu-satunya tempat ukuran posisi dihitung.
 *
 * @param kontrak Ukuran kontrak MT5 per lot. Diabaikan untuk kripto.
 */
export function hitungUkuran(p: {
  entry: number;
  sl: number;
  kripto: boolean;
  pasangan?: string;
  setelan: SetelanRisiko;
  kontrak?: number;
}): HasilUkuran {
  const { entry, sl, kripto, setelan } = p;

  if (!(entry > 0) || !(sl > 0)) {
    return { ...KOSONG, sebab: 'Sinyal ini belum punya entry dan SL yang bisa dihitung.' };
  }
  const jarakHarga = Math.abs(entry - sl);
  const jarakPersen = (jarakHarga / entry) * 100;
  if (!(jarakPersen > 0)) {
    return { ...KOSONG, sebab: 'Entry dan SL berada di harga yang sama — jarak risikonya nol.' };
  }
  if (!(setelan.modal > 0) || !(setelan.risiko > 0)) {
    return { ...KOSONG, sebab: 'Isi modal dan persen risikonya dulu.' };
  }

  const risikoDolar = setelan.modal * (setelan.risiko / 100);
  const dasar = { sah: true, sebab: '', jarakHarga, jarakPersen, risikoDolar };

  if (kripto) {
    /* Nilai posisi dari jarak SL dalam PERSEN: turun 1% dari posisi $X
       menghilangkan $X/100. Supaya yang hilang tepat risikoDolar, nilai
       posisinya = risikoDolar / (jarak% / 100). */
    const nilaiPosisi = risikoDolar / (jarakPersen / 100);
    const margin = setelan.leverage > 0 ? nilaiPosisi / setelan.leverage : 0;
    if (!(margin > 0)) {
      return { ...KOSONG, sebab: 'Leverage harus lebih besar dari nol.' };
    }
    return { ...dasar, lot: 0, nilaiPosisi, margin };
  }

  const kontrak = p.kontrak && p.kontrak > 0 ? p.kontrak : kontrakBawaan(p.pasangan || '');
  const lot = risikoDolar / (kontrak * jarakHarga);
  if (!(lot > 0) || !isFinite(lot)) {
    return { ...KOSONG, sebab: 'Ukuran kontraknya belum masuk akal untuk simbol ini.' };
  }
  return { ...dasar, lot, nilaiPosisi: 0, margin: 0 };
}

/** Lot dibulatkan ke bawah ke kelipatan 0,01 — batas paling umum di MT5.
 *  KE BAWAH, bukan terdekat: membulatkan ke atas menaikkan risiko melewati
 *  angka yang sudah disetujui orangnya, dan persetujuan atas 1% bukan
 *  persetujuan atas 1,4%. */
export function bulatkanLot(lot: number): number {
  return Math.floor(lot * 100) / 100;
}

/** Standar atau CENT. Bukan detail administratif — ia mengubah setiap angka
 *  dolar di layar dengan faktor seratus.
 *
 *  Di akun cent, saldo dan untung-rugi dicatat dalam sen mata uangnya, dan
 *  1 lot menggerakkan seperseratus dari yang digerakkan 1 lot akun standar.
 *  Orang yang memakai akun cent lalu membaca hitungan versi standar akan
 *  melihat kerugian seratus kali lipat dari yang sebenarnya — dan lebih
 *  berbahaya sebaliknya: yang mengira akunnya cent padahal standar
 *  memasang lot seratus kali terlalu besar. */
export type JenisAkun = 'standar' | 'cent';

/** Jenis akun DIBACA, bukan ditanyakan.
 *
 *  Penandanya ada di mata uang terminal: akun cent Exness memakai USC/EUC,
 *  sebagian broker menuliskannya "USD Cent" apa adanya. Aturan yang sama
 *  sudah lama dipakai lib/akun.ts untuk mengubah saldo cent jadi dolar —
 *  dipakai ulang di sini supaya keduanya mustahil berselisih pendapat
 *  tentang akun yang sama.
 *
 *  Menanyakannya ke orang adalah pertanyaan yang jawabannya sudah dipegang
 *  aplikasi, dan salah jawab di situ menggeser ukuran posisi seratus kali. */
export function deteksiJenisAkun(mataUang: string | null | undefined): JenisAkun {
  return /cent|USC/i.test(String(mataUang ?? '')) ? 'cent' : 'standar';
}

/** Ukuran kontrak yang BERLAKU, sesudah jenis akun diperhitungkan.
 *  Dipakai di semua perkalian dolar supaya faktor seratus itu tidak pernah
 *  terlupa di salah satu tempat saja. */
export function kontrakBerlaku(kontrak: number, jenis: JenisAkun): number {
  return jenis === 'cent' ? kontrak / 100 : kontrak;
}

/** Naik-turun satu anak tangga lot. 0,01 = langkah terkecil yang diterima
 *  hampir semua broker MT5. Dibulatkan lewat perkalian bilangan bulat
 *  karena 0.1 + 0.01 di float menghasilkan 0.11000000000000001, dan angka
 *  itu ditolak broker sebagai lot yang tidak sah. */
export function langkahLot(lot: number, arah: 1 | -1, langkah = 0.01): number {
  const n = Math.round(lot * 100) + Math.round(langkah * 100) * arah;
  return Math.max(0.01, n / 100);
}

export interface LotCopy {
  /** Lot yang benar-benar dikirim, sudah dibulatkan dan sudah dibatasi. */
  lot: number;
  /** Rugi kalau SL kena, memakai lot di atas. */
  rugi: number;
  /** Lot diperkecil karena melewati batas rugi yang ditetapkan peniru. */
  dibatasi: boolean;
  /** Lot yang diminta sebelum dibatasi — dipakai menerangkan pemotongannya. */
  lotDiminta: number;
  sebab: string;
}

/**
 * Lot untuk MENIRU sinyal orang lain, dengan BATAS RUGI milik peniru.
 *
 * Inilah inti perlindungannya. Yang menentukan berapa dolar hilang saat SL
 * kena adalah lot DIKALI jarak SL — dan jarak SL itu milik analis, bukan
 * milik yang meniru. Analis yang melebarkan stop dari 20 poin ke 200 poin
 * mengalikan kerugian peniru sepuluh kali lipat tanpa peniru mengubah apa
 * pun, dan tanpa ia diberi tahu.
 *
 * Batas dolar membalik arahnya: yang dipatok kerugiannya, dan LOT yang
 * menyesuaikan. Stop yang melebar berarti lot yang mengecil, bukan rugi
 * yang membengkak.
 *
 * Berlaku juga pada mode LOT TETAP. Lot tetap yang tidak dibatasi punya
 * persis kelemahan yang sama — dan orang memilih lot tetap justru karena
 * ingin sederhana, bukan karena ingin tanpa pengaman.
 *
 * @param lotDiminta 0 = hitung dari batas rugi. >0 = lot tetap yang diminta.
 */
export function lotUntukCopy(p: {
  lotDiminta: number;
  rugiMaks: number;
  kontrak: number;
  jarakHarga: number;
}): LotCopy {
  const { lotDiminta, rugiMaks, kontrak, jarakHarga } = p;
  const kosong = { lot: 0, rugi: 0, dibatasi: false, lotDiminta: 0, sebab: '' };

  if (!(kontrak > 0) || !(jarakHarga > 0)) {
    return { ...kosong, sebab: 'Jarak SL atau ukuran kontraknya belum masuk akal.' };
  }
  if (!(rugiMaks > 0)) {
    return { ...kosong, sebab: 'Tetapkan dulu batas rugi maksimal per trade.' };
  }

  /* Lot terbesar yang kerugiannya masih di dalam batas. Dibulatkan KE BAWAH
     supaya pembulatannya sendiri tidak melampaui batas yang dijaga. */
  const lotBatas = bulatkanLot(rugiMaks / (kontrak * jarakHarga));
  const diminta = lotDiminta > 0 ? bulatkanLot(lotDiminta) : lotBatas;
  const lot = Math.min(diminta, lotBatas);

  if (lot < 0.01) {
    return {
      ...kosong, lotDiminta: diminta,
      sebab: `Untuk menahan rugi di bawah ${rugiMaks} dolar pada jarak SL ini, lotnya harus ${
        (rugiMaks / (kontrak * jarakHarga)).toFixed(4)} — di bawah 0,01 dan tidak bisa dikirim. Naikkan batas rugimu, atau lewati sinyal ini.`,
    };
  }
  return {
    lot,
    rugi: lot * kontrak * jarakHarga,
    dibatasi: lot < diminta,
    lotDiminta: diminta,
    sebab: '',
  };
}
