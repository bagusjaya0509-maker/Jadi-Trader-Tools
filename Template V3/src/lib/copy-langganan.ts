/* ════════════════════════════════════════════════════════════════════════
   LANGGANAN COPY — siapa mengikuti analis mana, dengan ukuran berapa
   ════════════════════════════════════════════════════════════════════════
   Disimpan DI PERANGKAT untuk sekarang. Itu keterbatasan yang disengaja dan
   diakui: pengikut di VPS yang akan mengeksekusi sinyal baru belum berdiri,
   jadi belum ada yang membaca catatan ini selain layar yang menulisnya.

   Bentuknya sudah dirancang untuk itu — satu catatan per (pengguna,
   analis), berisi persis yang dibutuhkan untuk menghitung lot tanpa
   bertanya apa pun lagi. Saat rutenya jadi, isi yang sama tinggal dikirim.

   DIKUNCI PER UID. Satu komputer bisa dipakai dua akun bergantian, dan
   "mengikuti analis X dengan 2 lot" milik satu orang tidak boleh jadi
   setelan orang berikutnya yang masuk.
   ════════════════════════════════════════════════════════════════════════ */

export interface LanggananCopy {
  analisUid: string;
  analisNama: string;
  /** 'lot' = lot tetap tiap sinyal. 'risiko' = lot dihitung dari jarak SL. */
  mode: 'lot' | 'risiko';
  lotTetap: number;
  modal: number;
  risiko: number;
  kontrak: number;
  sejak: number;
}

const kunci = (uid: string) => `jt.copy.langganan.${uid}`;

function semua(uid: string): Record<string, LanggananCopy> {
  try {
    const j = JSON.parse(localStorage.getItem(kunci(uid)) || '{}');
    return j && typeof j === 'object' ? j as Record<string, LanggananCopy> : {};
  } catch { return {}; }
}

export function daftarLangganan(uid?: string | null): LanggananCopy[] {
  if (!uid) return [];
  return Object.values(semua(uid));
}

export function bacaLangganan(uid: string | null | undefined, analisUid: string): LanggananCopy | null {
  if (!uid) return null;
  return semua(uid)[analisUid] ?? null;
}

export function simpanLangganan(uid: string, isi: LanggananCopy) {
  try {
    const s = semua(uid);
    s[isi.analisUid] = isi;
    localStorage.setItem(kunci(uid), JSON.stringify(s));
  } catch { /* mode privat */ }
}

export function hapusLangganan(uid: string, analisUid: string) {
  try {
    const s = semua(uid);
    delete s[analisUid];
    localStorage.setItem(kunci(uid), JSON.stringify(s));
  } catch { /* mode privat */ }
}
