import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   PROFIL PENGGUNA — foto & banner milik masing-masing orang
   ════════════════════════════════════════════════════════════════════════
   TERPISAH dari profil analis, dan itu keputusan privasi bukan kerapian.
   GET /api/analis/profil memulangkan peta uid -> {nama, foto} untuk SEMUA
   orang tanpa login — memang begitu tugasnya, papan peringkat dan daftar
   sinyal perlu menggambar wajah orang yang memposting. Menaruh foto tiap
   pengguna biasa di sana berarti mendaftarkan orang yang tidak pernah
   memposting apa pun ke sebuah daftar publik.

   Rute /api/profil kebalikannya: yang boleh membaca cuma pemilik datanya.

   Yang TIDAK terpisah adalah wajahnya. Kalau orangnya memang analis,
   server ikut menyalin fotonya ke identitas analisnya — satu orang, satu
   wajah, di kartu sinyal maupun di panel ini. Syarat "kalau memang analis"
   dijaga di server, bukan di sini.

   GAMBARNYA disimpan di VPS dan disajikan dari /gambar, bukan sebagai data
   URL di Firestore: satu dokumen Firestore dibatasi 1 MiB, dan foto dari
   kamera HP sendirian sudah bisa melewatinya.
   ════════════════════════════════════════════════════════════════════════ */

export type JenisGambar = 'foto' | 'banner';

export interface ProfilPengguna {
  /** URL absolut, kosong kalau belum pernah diunggah. */
  foto: string;
  banner: string;
}

export const PROFIL_KOSONG: ProfilPengguna = { foto: '', banner: '' };

/* ── CERMIN LOKAL UNTUK AVATAR BILAH ATAS ───────────────────────────────
   Avatar di pojok kanan atas digambar di SETIAP halaman, sementara profil
   lengkapnya cuma diambil saat menunya dibuka. Tanpa cermin ini ada dua
   pilihan, dan dua-duanya buruk: menembak /api/profil di tiap pemuatan
   halaman demi satu bulatan 28 px, atau membiarkan foto yang baru saja
   diganti tetap menampilkan wajah lama sampai orangnya menyegarkan
   halaman.

   Ini CACHE TAMPILAN, bukan sumber kebenaran. Kalau isinya basi, kartu
   profil membetulkannya begitu menunya dibuka lagi. Dikunci per uid supaya
   dua akun di satu peramban tidak saling meminjam wajah. */
const KUNCI_FOTO = 'jt.fotoProfil.';

export function fotoTersimpan(uid: string): string {
  try { return window.localStorage.getItem(KUNCI_FOTO + uid) || ''; } catch { return ''; }
}

function simpanFotoLokal(uid: string, url: string) {
  try {
    if (url) window.localStorage.setItem(KUNCI_FOTO + uid, url);
    else window.localStorage.removeItem(KUNCI_FOTO + uid);
  } catch { /* mode penyamaran, kuota penuh — bukan alasan menggagalkan unggahan */ }
}

function dasar(): string {
  return (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
}

async function kepala(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu.');
  return { Authorization: 'Bearer ' + (await u.getIdToken()), 'Content-Type': 'application/json' };
}

/** Perkecil sebelum berangkat, JANGAN kirim berkas mentah.
 *
 *  Dua sebab, dan yang kedua yang menggigit. Pertama: 300 px sudah lebih
 *  dari cukup untuk avatar 64 px, dan foto 12 MP yang dikirim utuh cuma
 *  membuat orangnya menunggu lama untuk gambar yang sama.
 *
 *  Kedua: parser JSON di backend menolak badan permintaan yang terlalu
 *  besar SEBELUM rutenya sempat melihatnya, dan balasannya berupa HTML —
 *  yang di peramban muncul sebagai "Unexpected token '<'", bukan sebagai
 *  pesan yang menjelaskan apa pun. Mengecilkan di sini membuat keadaan itu
 *  tidak pernah tercapai.
 *
 *  JPEG, bukan PNG. Foto berisi gradien wajah dan langit; PNG menyimpannya
 *  utuh dan menghasilkan berkas berkali lipat tanpa satu pun perbedaan
 *  yang terlihat pada ukuran setempel pos. */
export function kecilkanUntukProfil(berkas: File, maks: number): Promise<string> {
  return new Promise((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onerror = () => gagal(new Error('Gagal membaca berkas'));
    pembaca.onload = () => {
      const img = new Image();
      img.onerror = () => gagal(new Error('Berkas ini bukan gambar yang bisa dibaca'));
      img.onload = () => {
        const skala = Math.min(1, maks / Math.max(img.width, img.height));
        const kanvas = document.createElement('canvas');
        kanvas.width = Math.max(1, Math.round(img.width * skala));
        kanvas.height = Math.max(1, Math.round(img.height * skala));
        const ktx = kanvas.getContext('2d');
        if (!ktx) return gagal(new Error('Canvas tidak tersedia'));
        ktx.drawImage(img, 0, 0, kanvas.width, kanvas.height);
        selesai(kanvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(pembaca.result);
    };
    pembaca.readAsDataURL(berkas);
  });
}

/** Sisi terpanjang sesudah diperkecil. Banner dipajang selebar kartu
 *  (~320 px) dan foto sebagai bulatan 64 px; angka di sini sudah dua kali
 *  lipatnya supaya tetap tajam di layar rapat. */
const MAKS: Record<JenisGambar, number> = { foto: 320, banner: 900 };

export async function simpanGambarProfil(jenis: JenisGambar, berkas: File): Promise<ProfilPengguna> {
  const dataUrl = await kecilkanUntukProfil(berkas, MAKS[jenis]);
  const r = await fetch(`${dasar()}/api/profil`, {
    method: 'POST', headers: await kepala(), body: JSON.stringify({ jenis, dataUrl }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  if (auth.currentUser) simpanFotoLokal(auth.currentUser.uid, j.foto ?? '');
  return { foto: j.foto ?? '', banner: j.banner ?? '' };
}

export async function hapusGambarProfil(jenis: JenisGambar): Promise<ProfilPengguna> {
  const r = await fetch(`${dasar()}/api/profil`, {
    method: 'POST', headers: await kepala(), body: JSON.stringify({ jenis, hapus: true }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  if (auth.currentUser) simpanFotoLokal(auth.currentUser.uid, j.foto ?? '');
  return { foto: j.foto ?? '', banner: j.banner ?? '' };
}

/** Dipanggil HANYA saat panelnya dibuka, bukan di tiap pemuatan halaman.
 *  Foto profil tidak dilihat siapa pun selama menunya tertutup, dan satu
 *  permintaan jaringan di jalur muat awal untuk sesuatu yang mungkin tidak
 *  pernah dibuka adalah ongkos yang dibayar semua orang. */
export function useProfilPengguna(hidup: boolean) {
  /* Diawali dari cermin lokal, bukan dari kosong. Kartu yang dibuka
     untuk kedua kalinya menggambar wajah yang benar seketika, bukan huruf
     awal yang sekejap berubah jadi foto. */
  const [profil, setProfil] = useState<ProfilPengguna>(() => ({
    ...PROFIL_KOSONG,
    foto: auth.currentUser ? fotoTersimpan(auth.currentUser.uid) : '',
  }));
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async () => {
    if (!auth.currentUser) return;
    setMemuat(true);
    try {
      const r = await fetch(`${dasar()}/api/profil`, { headers: await kepala() });
      if (r.ok) {
        const j = await r.json();
        setProfil({ foto: j.foto ?? '', banner: j.banner ?? '' });
        if (auth.currentUser) simpanFotoLokal(auth.currentUser.uid, j.foto ?? '');
      }
    } catch {
      /* Diam. Panel ini tetap berguna tanpa gambar — nama, paket, dan sisa
         durasi semuanya datang dari tempat lain. Pesan galat merah untuk
         banner yang gagal dimuat cuma mengalihkan perhatian dari itu. */
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { if (hidup) void muat(); }, [hidup, muat]);

  return { profil, setProfil, memuat, muatUlang: muat };
}
