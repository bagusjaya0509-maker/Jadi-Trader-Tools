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
