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
  /** Tiket yang dibuka pengikut server — bahan ikon copy di tabel posisi. */
  tanda?: { tiket: string; analis: string; simbol: string; arah: string; lot: number }[];
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

/* ════════════════════════════════════════════════════════════════════════
   PENGIKUT ANALIS — "berapa akun yang sedang menyalin analis ini"
   ════════════════════════════════════════════════════════════════════════
   Beda dari hitungan salinan per sinyal: begitu seseorang menekan Ikuti,
   ia sudah menyalin SELURUH isi analis itu — market order, pending, dan
   pembatalan — jadi ia terhitung satu penyalin pada detik itu juga, bukan
   menunggu sinyal pertama terbit.

   Yang tersimpan di server daftar uid (supaya sekali-per-orang tegak dan
   berhenti mengikuti benar-benar mengurangi angkanya); yang KELUAR cuma
   jumlahnya. Siapa mengikuti siapa bukan urusan orang lain.
   ════════════════════════════════════════════════════════════════════════ */

/** Menyalakan/mematikan langganan di server. Diam saat gagal — hitungan
 *  tampilan tidak boleh menggagalkan penyimpanan setelan yang sudah
 *  berhasil di perangkat. */
export async function kirimIkuti(analisUid: string, ikut: boolean): Promise<void> {
  const t = await token();
  if (!t) return;
  try {
    await fetch(`${dasar()}/api/analis/ikuti`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ analisUid, ikut }),
    });
  } catch { /* diam */ }
}

/** Jumlah penyalin per analis. Publik, tanpa login — kartu analis dibaca
 *  juga oleh pengunjung yang belum masuk. */
export async function jumlahPengikut(): Promise<Record<string, number>> {
  try {
    const r = await fetch(`${dasar()}/api/analis/pengikut`);
    if (!r.ok) return {};
    const j = await r.json();
    return (j && j.jumlah) || {};
  } catch { return {}; }
}
