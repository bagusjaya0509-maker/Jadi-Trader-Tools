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
  dompet: DompetTertaut[];
}

/* ── ALAMAT DOMPET ON-CHAIN ─────────────────────────────────────────────
   Kenapa disimpan padahal dompetnya sudah tersambung di peramban:
   sambungan peramban HILANG. Ia hidup di satu perangkat, satu profil
   peramban, dan lenyap begitu izinnya dicabut. Yang harus bertahan lebih
   lama adalah tautannya — jurnal yang mengisi dirinya sendiri dari riwayat
   on-chain perlu tahu alamat siapa yang dibaca, bahkan saat orangnya
   sedang tidak membuka dompetnya sama sekali.

   Alamat dompet BUKAN rahasia; ia tertulis di rantai. Yang dijaga adalah
   PETANYA — siapa pemilik alamat yang mana — dan itu sebabnya ia duduk di
   /api/profil yang cuma bisa dibaca pemiliknya, bukan di /api/analis/profil
   yang publik.

   Kunci pribadi dan seed phrase DITOLAK di server sebelum sempat tertulis
   ke disk. Bukan karena kita menyangka ada yang mengirimnya dengan sengaja,
   melainkan karena tempel-yang-salah itu nyata. */
export interface DompetTertaut {
  alamat: string;
  pola: 'evm' | 'sol';
  label: string;
  ditambah: number;
  terlihat: number;
}

export const PROFIL_KOSONG: ProfilPengguna = { foto: '', banner: '', dompet: [] };

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
  return { foto: j.foto ?? '', banner: j.banner ?? '', dompet: j.dompet ?? [] };
}

export async function hapusGambarProfil(jenis: JenisGambar): Promise<ProfilPengguna> {
  const r = await fetch(`${dasar()}/api/profil`, {
    method: 'POST', headers: await kepala(), body: JSON.stringify({ jenis, hapus: true }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  if (auth.currentUser) simpanFotoLokal(auth.currentUser.uid, j.foto ?? '');
  return { foto: j.foto ?? '', banner: j.banner ?? '', dompet: j.dompet ?? [] };
}

/** Tautkan satu alamat dompet ke akun ini. Mengirim alamat yang SAMA lagi
 *  bukan galat — itu yang terjadi tiap kali halamannya dibuka; server cuma
 *  memperbarui kapan terakhir terlihat. */
export async function tautkanDompet(alamat: string, label?: string): Promise<DompetTertaut[]> {
  const r = await fetch(`${dasar()}/api/profil/dompet`, {
    method: 'POST', headers: await kepala(), body: JSON.stringify({ alamat, label }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j.dompet ?? [];
}

export async function lepasDompet(alamat: string): Promise<DompetTertaut[]> {
  const r = await fetch(`${dasar()}/api/profil/dompet`, {
    method: 'POST', headers: await kepala(), body: JSON.stringify({ alamat, hapus: true }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j.dompet ?? [];
}

/** Daftar dompet tertaut, tanpa hook — untuk jalur yang berjalan di luar
 *  render (sinkron jurnal). Melempar kalau belum masuk. */
export async function ambilDompetTertaut(): Promise<DompetTertaut[]> {
  const r = await fetch(`${dasar()}/api/profil`, { headers: await kepala() });
  if (!r.ok) throw new Error(`Server menjawab ${r.status}`);
  const j = await r.json().catch(() => ({}));
  return Array.isArray(j.dompet) ? j.dompet : [];
}

/** Versi diam untuk dipanggil dari jalur "dompet baru saja tersambung".
 *
 *  Diam DENGAN SENGAJA. Yang baru saja dilakukan orangnya adalah
 *  menyambungkan dompet supaya bisa trading; pesan galat merah tentang
 *  penyimpanan profil di detik itu memberi tahu kegagalan yang tidak
 *  menghalangi apa pun yang sedang ia kerjakan. Tautannya dicoba lagi
 *  otomatis di sambungan berikutnya. */
export function tautkanDompetDiam(alamat: string): void {
  if (!auth.currentUser || !alamat) return;
  void tautkanDompet(alamat).catch(() => {});
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
        setProfil({ foto: j.foto ?? '', banner: j.banner ?? '', dompet: j.dompet ?? [] });
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
