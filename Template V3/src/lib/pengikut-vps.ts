import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   PENGIKUT VPS — jembatan ke pengikut copy yang hidup di server
   ════════════════════════════════════════════════════════════════════════
   Untuk akun pemilik, penyalinan sinyal berjalan di VPS (24 jam, tanpa
   tab). Berkas ini cuma jembatannya: membaca statusnya, mengirim setelan
   langganan ke sana, dan menarik tuas jedanya.

   Untuk SEMUA akun lain, /api/copy/pengikut menjawab { aktif: false } dan
   aplikasi memakai pengikut peramban seperti biasa. Pembedanya keputusan
   server, bukan tebakan layar — layar yang menebak sendiri akan salah
   persis saat servernya berubah pikiran.

   Kegagalan jaringan dijawab null, bukan { aktif: false }: "tidak tahu"
   dan "tidak aktif" adalah dua jawaban yang berbeda, dan pemanggil yang
   menerima null harus memilih sendiri sikap amannya.
   ════════════════════════════════════════════════════════════════════════ */

export interface LogPengikutVps {
  waktu: number;
  sinyal: string;
  pasangan: string;
  analis: string;
  hasil: 'terkirim' | 'dilewati' | 'gagal';
  sebab: string;
}

export interface StatusPengikutVps {
  aktif: boolean;
  jalan?: boolean;
  pindai?: number;
  langganan?: { analisUid: string; analisNama: string; rugiMaks: number; sejak: number }[];
  log?: LogPengikutVps[];
}

function dasar() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}

async function token(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try { return await u.getIdToken(); } catch { return null; }
}

export async function statusPengikutVps(): Promise<StatusPengikutVps | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch(`${dasar()}/api/copy/pengikut`, {
      headers: { Authorization: 'Bearer ' + t },
    });
    if (!r.ok) return null;
    return (await r.json()) as StatusPengikutVps;
  } catch { return null; }
}

/** Mengirim satu langganan ke server. Diam kalau servernya menolak —
 *  penolakan untuk akun non-pemilik adalah keadaan normal, bukan galat
 *  yang perlu mengganggu alur menyimpan di peramban. */
export async function simpanLanggananVps(l: { analisUid: string; analisNama: string; rugiMaks: number }): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  try {
    const r = await fetch(`${dasar()}/api/copy/pengikut/langganan`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(l),
    });
    return r.ok;
  } catch { return false; }
}

export async function hapusLanggananVps(analisUid: string): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  try {
    const r = await fetch(`${dasar()}/api/copy/pengikut/langganan`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hapus: analisUid }),
    });
    return r.ok;
  } catch { return false; }
}

export async function setJalanVps(jalan: boolean): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  try {
    const r = await fetch(`${dasar()}/api/copy/pengikut/jalan`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jalan }),
    });
    return r.ok;
  } catch { return false; }
}
