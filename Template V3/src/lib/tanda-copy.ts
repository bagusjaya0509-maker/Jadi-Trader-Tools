import { simbolDasarMt5 } from '@/lib/simbol';

/* ════════════════════════════════════════════════════════════════════════
   TANDA COPY — posisi mana yang datang dari sinyal orang lain
   ════════════════════════════════════════════════════════════════════════
   Sesudah beberapa hari, tabel posisi terbuka berisi campuran: order yang
   dipasang sendiri dan order yang masuk otomatis karena mengikuti analis.
   Dari terminal keduanya identik — MT5 tidak menyimpan "ini salinan siapa".
   Yang tahu asal-usulnya hanya aplikasi ini, pada detik ia mengirimnya.
   Jadi di situlah dicatat.

   ── KENAPA TIDAK LANGSUNG PAKAI TIKET ───────────────────────────────────
   Karena tiketnya belum ada saat perintah dikirim. Web menaruh perintah di
   antrean; EA yang mengeksekusinya beberapa detik kemudian, dan nomor tiket
   lahir di sana. Yang bisa dicatat pada saat mengirim cuma niatnya: simbol,
   arah, dan lot.

   ── PENGIKATAN SEKALI, LALU TIKET SELAMANYA ─────────────────────────────
   Maka pencocokannya dua tahap. Catatan yang belum punya tiket dijodohkan
   dengan posisi hidup yang simbol + arah + lotnya sama; begitu ketemu,
   tiketnya DIIKAT dan disimpan. Sesudah itu pencocokannya lewat tiket saja.

   Ini penting justru karena SL dan TP boleh berubah. Kalau tandanya
   bergantung pada level, menggeser stop akan menghapus keterangan "ini
   salinan" — padahal menggeser stop adalah hal yang wajar dilakukan pada
   posisi salinan.

   Penjodohan pertama memang bisa keliru kalau ada dua order dengan simbol,
   arah, dan lot yang persis sama dibuka BERBARENGAN — satu manual, satu
   salinan. Yang tertukar cuma LABELNYA; tidak ada order yang ikut berpindah
   karenanya. Itu harga yang wajar untuk keterangan yang bertahan.

   ── TAPI "BERBARENGAN" ITU DULU TIDAK PERNAH DIPERIKSA ──────────────────
   Dilaporkan pemilik 4 Sep 2026: ia membuka posisi MANUAL, dan posisi itu
   muncul berlabel salinan dari seorang analis yang sinyalnya sudah lama
   tidak ia ikuti.

   Sebabnya bukan penjodohan yang keliru sesaat, melainkan catatan yang
   TIDAK PERNAH KEDALUWARSA. Sebuah catatan salinan dari berminggu-minggu
   lalu tetap duduk di localStorage tanpa tiket, dan syarat jodohnya cuma
   simbol + arah + lot. XAUUSDc BUY 0,17 adalah kombinasi yang sama orang
   itu pakai berulang kali — jadi cepat atau lambat ia pasti tertangkap.

   Yang memperparah: cabang "ikatan basi dilepas" di bawah. Begitu posisi
   salinan lama ditutup, tiketnya hilang dari terminal dan catatannya
   DIKEMBALIKAN ke kolam jodoh — selamanya. Artinya tiap salinan yang pernah
   ditutup berubah jadi label mengambang yang menunggu posisi manual
   berikutnya yang seukuran.

   Sekarang keduanya dibatasi satu jendela waktu: catatan cuma boleh
   menjodoh — dan cuma boleh dilepas untuk menjodoh ulang — selama ia masih
   muda. Sesudah itu ia inert: tidak menghapus apa pun, tidak melabeli apa
   pun.

   Jendelanya diukur dengan JAM YANG SAMA (Date.now() saat mencatat vs
   Date.now() saat menjodoh), bukan dengan waktu buka posisi dari MT5 —
   waktu itu adalah waktu SERVER BROKER, yang bisa meleset berjam-jam dari
   jam peramban dan akan menolak jodoh yang benar.
   ════════════════════════════════════════════════════════════════════════ */

/** Selama ini sebuah catatan boleh dijodohkan dengan posisi hidup.
 *
 *  6 jam, dan itu longgar dengan sengaja. Kenyataannya EA mengeksekusi
 *  dalam hitungan detik dan panel memeriksa tiap 30 detik, jadi
 *  penjodohan nyata hampir selalu terjadi di bawah satu menit. Yang
 *  dilindungi jendela selebar ini adalah kasus tidak normal — EA sempat
 *  mati, atau tab ditutup tepat sesudah order dikirim — tanpa membiarkan
 *  catatan berumur hari ikut berebut. */
const JENDELA_IKAT_MS = 6 * 60 * 60 * 1000;

/** Catatan yang lebih tua dari ini dibuang saat penyimpanan disentuh.
 *  Bukan demi ruang (batas 200 sudah mengurusnya) melainkan supaya isi
 *  penyimpanan tidak jadi tumpukan label mati yang menyesatkan orang yang
 *  membacanya lewat devtools. */
const UMUR_MAKS_MS = 30 * 24 * 60 * 60 * 1000;

function masihMuda(t: TandaCopy, kini: number): boolean {
  return kini - (t.waktu || 0) <= JENDELA_IKAT_MS;
}

export interface TandaCopy {
  /** Nama simbol seperti yang dikirim ke broker: "XAUUSDc", bukan "XAUUSD". */
  simbol: string;
  arah: 'BUY' | 'SELL';
  lot: number;
  /** Nama analis yang sinyalnya ditiru — yang ditampilkan saat ikonnya
   *  disentuh. */
  analis: string;
  waktu: number;
  /** Terisi sesudah catatan ini berhasil dijodohkan dengan satu posisi
   *  hidup. Sejak itu, cuma ini yang dipakai mencocokkan. */
  tiket?: string;
  /** Sinyal analis yang melahirkan order ini. Dibutuhkan saat analisnya
   *  MENARIK sinyalnya: yang dibatalkan harus order dari sinyal itu, bukan
   *  order lain yang kebetulan sepasang dan searah. */
  sinyal?: string;
  /** Penarikan sinyalnya sudah diurus. Tanpa ini, sinyal yang berstatus
   *  batal akan mengirim perintah pembatalan lagi di SETIAP putaran — ke
   *  tiket yang sudah tidak ada, selamanya. */
  batalSelesai?: boolean;
}

const KUNCI = (uid: string) => `jt.copy.tanda.${uid}`;
/** Catatan disimpan 200 terakhir. Yang lebih tua dari itu pasti sudah
 *  tertutup berkali-kali; menyimpannya selamanya cuma melewatkan batas
 *  localStorage. */
const BATAS = 200;

export function bacaTanda(uid?: string | null): TandaCopy[] {
  if (!uid) return [];
  try {
    const j = JSON.parse(localStorage.getItem(KUNCI(uid)) || '[]');
    return Array.isArray(j) ? (j as TandaCopy[]) : [];
  } catch { return []; }
}

function simpan(uid: string, d: TandaCopy[]) {
  /* Yang sudah lewat umur dibuang di sini, bukan di pembacaan: pembacaan
     terjadi tiap 30 detik dan tidak boleh menulis apa-apa kalau tidak ada
     yang berubah. */
  const kini = Date.now();
  const hidup = d.filter((t) => kini - (t.waktu || 0) <= UMUR_MAKS_MS);
  try { localStorage.setItem(KUNCI(uid), JSON.stringify(hidup.slice(-BATAS))); }
  catch { /* mode privat — tandanya hilang, ordernya tidak */ }
}

/** Dipanggil TEPAT sesudah satu order salinan berhasil dikirim. */
export function catatCopy(uid: string | null | undefined, t: Omit<TandaCopy, 'waktu'>) {
  if (!uid) return;
  const d = bacaTanda(uid);
  d.push({ ...t, waktu: Date.now() });
  simpan(uid, d);
}

/** Catatan salinan untuk satu sinyal tertentu. */
export function tandaSinyal(uid: string | null | undefined, sinyal: string): TandaCopy | undefined {
  if (!uid) return undefined;
  return bacaTanda(uid).find((t) => t.sinyal === sinyal);
}

/** Menyetel penanda "penarikan sinyal ini sudah diurus". */
export function tandaiBatalSelesai(uid: string | null | undefined, sinyal: string) {
  if (!uid) return;
  const d = bacaTanda(uid);
  let berubah = false;
  for (const t of d) {
    if (t.sinyal === sinyal && !t.batalSelesai) { t.batalSelesai = true; berubah = true; }
  }
  if (berubah) simpan(uid, d);
}

function samaSimbol(a: string, b: string): boolean {
  if (a.toUpperCase() === b.toUpperCase()) return true;
  return simbolDasarMt5(a) === simbolDasarMt5(b);
}

export interface PosisiUntukTanda {
  tiket: string;
  simbol: string;
  arah: 'BUY' | 'SELL';
  lot: number;
}

/** Disuntik pada uji supaya jendela waktunya bisa diperiksa tanpa menunggu
 *  enam jam. Kosong = pakai jam sungguhan. */
export function petaCopyPada(uid: string | null | undefined, posisi: PosisiUntukTanda[], kini: number) {
  return hitungPeta(uid, posisi, kini);
}

/**
 * Peta tiket → nama analis untuk posisi yang sedang terbuka.
 *
 * Sekalian mengikat catatan yang belum punya tiket, jadi ia MENULIS ke
 * penyimpanan saat ada yang baru terjodoh. Aman dipanggil berulang: sesudah
 * pengikatan pertama, panggilan berikutnya tidak mengubah apa-apa.
 */
export function petaCopy(uid: string | null | undefined, posisi: PosisiUntukTanda[]): Map<string, string> {
  return hitungPeta(uid, posisi, Date.now());
}

function hitungPeta(uid: string | null | undefined, posisi: PosisiUntukTanda[], kini: number): Map<string, string> {
  const peta = new Map<string, string>();
  if (!uid || posisi.length === 0) return peta;

  const d = bacaTanda(uid);
  if (d.length === 0) return peta;

  const hidup = new Set(posisi.map((p) => p.tiket));
  /* Tiket yang sudah diikat catatan lain tidak boleh direbut catatan kedua:
     dua salinan berbeda tidak menunjuk satu order yang sama. */
  const terpakai = new Set<string>();
  let berubah = false;
  for (const t of d) {
    if (!t.tiket) continue;
    if (hidup.has(t.tiket)) {
      peta.set(t.tiket, t.analis);
      terpakai.add(t.tiket);
      continue;
    }
    /* ── IKATAN BASI DILEPAS ────────────────────────────────────────────
       Tiketnya tidak ada lagi di terminal: ordernya sudah tertutup, atau
       dibatalkan, atau — yang paling sering — pernah terikat ke order uji
       yang lama hilang. Sebelumnya `if (t.tiket) continue` membuat catatan
       seperti itu MATI SELAMANYA: ia tidak pernah cocok (tiketnya tidak
       hidup) dan tidak pernah boleh menjodoh ulang. Akibatnya salinan
       berikutnya yang seukuran berdiri tanpa ikon sama sekali.

       Dilepas HANYA kalau daftar hidupnya memang berisi. EA yang sedang
       mati melaporkan daftar kosong, dan melepas semua ikatan di situ
       berarti membuang seluruh riwayat penandaan karena terminal kebetulan
       tertutup.

       DAN hanya selama catatannya masih muda. Tanpa syarat itu, tiap
       salinan yang pernah ditutup kembali jadi label mengambang yang
       menunggu posisi manual berikutnya yang kebetulan seukuran — persis
       cacat yang dilaporkan 4 Sep 2026. Catatan tua yang tiketnya sudah
       mati memang seharusnya mati bersamanya. */
    if (posisi.length > 0 && masihMuda(t, kini)) { t.tiket = undefined; berubah = true; }
  }

  /* Catatan terlama dijodohkan lebih dulu — urutan yang sama dengan urutan
     ordernya dikirim. */
  for (const t of d) {
    if (t.tiket) continue;
    /* Catatan tua tidak ikut berebut. Lihat catatan jendela di kepala
       berkas — ini penjaga utamanya, bukan optimasi. */
    if (!masihMuda(t, kini)) continue;
    const cocok = posisi.find((p) =>
      !terpakai.has(p.tiket)
      && p.arah === t.arah
      && Math.abs(p.lot - t.lot) < 0.005
      && samaSimbol(p.simbol, t.simbol));
    if (!cocok) continue;
    t.tiket = cocok.tiket;
    terpakai.add(cocok.tiket);
    peta.set(cocok.tiket, t.analis);
    berubah = true;
  }
  if (berubah) simpan(uid, d);

  return peta;
}
