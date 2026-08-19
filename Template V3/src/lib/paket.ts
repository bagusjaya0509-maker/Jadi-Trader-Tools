import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   PAKET & SISA JATAH ORANG YANG SEDANG LOGIN
   ════════════════════════════════════════════════════════════════════════
   Jangan tertukar dengan `preview.ts` di sebelah. Yang itu jatah TAMU —
   sekali pakai, disimpan di sessionStorage, untuk orang yang belum punya
   akun sama sekali. Yang ini jatah PELANGGAN, dihitung server, berdasarkan
   paket yang dibelinya.

   Keduanya menjaga dua fitur yang sama (screener & replay) dan itu bukan
   duplikasi: tamu dan pelanggan adalah dua orang berbeda dengan dua alasan
   berbeda untuk dibatasi. Tamu dibatasi supaya preview tidak berubah jadi
   versi gratis yang utuh. Pelanggan dibatasi karena itu yang membedakan
   paket yang ia bayar.

   YANG MENENTUKAN ADALAH SERVER. Angka di sini cuma untuk ditampilkan —
   supaya orang tahu sisanya sebelum kehabisan. Keputusan boleh-atau-tidak
   diambil `POST /api/paket/pakai`, dan jawabannya yang dipakai. Hitungan
   yang disimpan di browser bisa dihapus lewat DevTools dalam tiga detik;
   batas yang bisa direset sendiri bukan batas, cuma saran.
   ════════════════════════════════════════════════════════════════════════ */

export type Fitur = 'screener' | 'replay';
export type NamaPaket = 'gratis' | 'testing' | 'premium3' | 'tahunan';

export interface Paket {
  paket: NamaPaket;
  aktif: boolean;
  berakhir: number;
  /** -1 berarti tanpa batas. */
  batas: Record<Fitur, number>;
  pakai: Record<Fitur, number>;
  sisa: Record<Fitur, number>;
  copySignal: boolean;
  marketplace: boolean;
}

/** Dipakai selama jawaban server belum datang. Paling sempit, bukan paling
    longgar: menebak ke arah longgar berarti sekejap membuka fitur berbayar
    untuk orang yang tidak membelinya, dan yang sekejap itu cukup. */
export const PAKET_KOSONG: Paket = {
  paket: 'gratis', aktif: false, berakhir: 0,
  batas: { screener: 0, replay: 0 },
  pakai: { screener: 0, replay: 0 },
  sisa: { screener: 0, replay: 0 },
  copySignal: false, marketplace: false,
};

function dasar(): string {
  return (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
}

async function kepala(): Promise<Record<string, string> | null> {
  const u = auth.currentUser;
  if (!u) return null;
  return { Authorization: 'Bearer ' + (await u.getIdToken()), 'Content-Type': 'application/json' };
}

/** Sisa jatah yang sedang berlaku. `muatUlang` dipanggil sesudah memakai
    jatah, supaya angka di layar tidak tertinggal dari kenyataan. */
export function usePaket(): { paket: Paket; memuat: boolean; muatUlang: () => void } {
  const [paket, setPaket] = useState<Paket>(PAKET_KOSONG);
  const [memuat, setMemuat] = useState(true);
  const [putaran, setPutaran] = useState(0);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const h = await kepala();
      if (!h) { if (hidup) { setPaket(PAKET_KOSONG); setMemuat(false); } return; }
      try {
        const r = await fetch(`${dasar()}/api/paket`, { headers: h });
        const j = await r.json();
        if (hidup && r.ok && j.ok) setPaket({ ...PAKET_KOSONG, ...j });
      } catch { /* jaringan — angka di layar tetap yang terakhir diketahui */ }
      if (hidup) setMemuat(false);
    })();
    return () => { hidup = false; };
  }, [putaran]);

  return { paket, memuat, muatUlang: useCallback(() => setPutaran((n) => n + 1), []) };
}

export interface HasilPakai {
  boleh: boolean;
  /** Terisi kalau ditolak — kalimat siap tampil, bukan kode galat. */
  alasan?: string;
  paket?: Paket;
}

/** Memakai satu jatah. INI yang menentukan, bukan tampilan.

    Ditolaknya bukan lewat pengecualian melainkan lewat nilai balik, karena
    penolakan di sini bukan kegagalan — ia jawaban yang sah dan harus
    ditampilkan sebagai kalimat, bukan sebagai layar merah. */
export async function pakaiKuota(fitur: Fitur): Promise<HasilPakai> {
  const h = await kepala();
  if (!h) return { boleh: false, alasan: 'Masuk dulu untuk memakai fitur ini.' };
  try {
    const r = await fetch(`${dasar()}/api/paket/pakai`, {
      method: 'POST', headers: h, body: JSON.stringify({ fitur }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 403) {
      return { boleh: false, alasan: j.error || 'Jatah paket ini sudah habis.' };
    }
    if (!r.ok) {
      /* Server bermasalah BUKAN alasan menutup fitur yang sudah dibayar.
         Lebih baik satu pemakaian tidak terhitung daripada pelanggan
         terkunci karena jaringan sedang buruk. */
      return { boleh: true };
    }
    return { boleh: true, paket: { ...PAKET_KOSONG, ...j } };
  } catch {
    return { boleh: true };
  }
}

/** Tulisan sisa jatah, siap tempel. '' berarti tidak perlu ditampilkan. */
export function teksSisa(p: Paket, fitur: Fitur): string {
  if (!p.aktif) return '';
  if (p.batas[fitur] < 0) return 'tanpa batas';
  return `sisa ${p.sisa[fitur]} dari ${p.batas[fitur]}`;
}

export const LABEL_PAKET: Record<NamaPaket, string> = {
  gratis: 'Event Terbatas',
  testing: 'Testing — New Launch',
  premium3: 'Premium 3 Bulan',
  tahunan: 'Tahunan',
};
