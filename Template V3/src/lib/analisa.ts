import { auth } from '@/lib/firebase';
import { PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   COPY TRADING — klien untuk rute /api/analisa di VPS
   ════════════════════════════════════════════════════════════════════════
   Analisa disimpan di backend VPS (berkas JSON), bukan Firestore: backend
   tidak punya kredensial admin Firestore, sementara pola berkas+ID-token
   sudah terbukti pada rute lisensi & MT5. Isi terkunci tidak pernah ikut
   daftar publik — ia diminta terpisah dan backend yang memutuskan boleh
   atau tidak, bukan tombol di layar.
   ════════════════════════════════════════════════════════════════════════ */

const DASAR = PROXY_BAWAAN;

export interface RingkasAnalisa {
  id: string; uid: string; nama: string; judul: string; pasangan: string;
  /** Foto profil analisnya, kosong kalau anonim. Lihat PerformaAnalis.foto. */
  foto?: string;
  arah: 'BUY' | 'SELL'; harga: number; ringkas: string; dibuat: number;
  jumlahPembeli: number;
  /** Ditulis agen AI, bukan pengguna. Dipasang HANYA oleh rute
   *  /api/analisa/agen yang dijaga App Token — kalau nilainya bisa dikirim
   *  lewat POST biasa, siapa pun yang login bisa menyamar jadi agen resmi. */
  agen?: boolean;
  /** Timeframe analisanya. Dipakai tautan ke Chart supaya yang terbuka
   *  timeframe yang DIANALISA, bukan timeframe terakhir yang dilihat orang. */
  tf?: string;
  jumlahGambar?: number;
  /** Hasil sinyal menurut lilin SEJAK diposting — bukan menurut harga
   *  sekarang. Sinyal yang sempat menyentuh TP lalu harganya balik tetap
   *  sudah selesai; membandingkan harga saat ini akan menyatakannya masih
   *  aktif dan orang mengira masih ada peluang yang sudah lewat.
   *  null = masih berjalan. Kosong/undefined = tidak bisa dinilai (simbol
   *  di luar Binance Futures) — dan itu ditampilkan sebagai tidak ada
   *  label, bukan sebagai tebakan.
   *  'batal' = ditarik penulisnya sebelum harganya datang — lihat
   *  `alasanBatal`. Bukan kalah dan bukan menang; ia keadaan tersendiri. */
  hasil?: 'sl' | 'tp' | 'batal' | null;
  waktuHasil?: number | null;
  /** Hasil dalam dolar menurut model papan peringkat (modal & risiko% ada
   *  di `Performa`). Dihitung SERVER, dan hanya terisi untuk sinyal yang
   *  sudah kena TP/SL.
   *
   *  null untuk yang masih berjalan, dan itu disengaja: angka ini
   *  memberitahukan rr sinyalnya — jarak TP terhadap SL — dan itu produk
   *  yang dijual analisnya. Sinyal yang sudah selesai tidak bisa ditiru
   *  lagi, jadi rekam jejaknya boleh terbuka; yang masih jalan tidak.
   *  Batal juga null: tidak ada uang yang berpindah, dan menuliskannya nol
   *  akan terbaca sebagai impas alih-alih sebagai tidak terjadi. */
  hasilDolar?: number | null;
  /** Harga pernah menyentuh entry. Ditulis penilai dari lilin sungguhan,
   *  dan tidak pernah dicabut lagi. Inilah yang mengunci pembatalan:
   *  order yang sudah terisi adalah posisi yang sudah jalan, dan
   *  menariknya sama dengan menghapus trade yang sedang rugi. */
  terisi?: boolean;
  /** Alasan pembatalan, wajib diisi penulisnya. Ditayangkan apa adanya —
   *  yang dinilai orang justru kenapa sebuah rencana ditarik. */
  alasanBatal?: string;
  /** "Buy Limit" / "Sell Stop" / "Market" — keterangan, bukan angka, jadi
   *  aman tampil publik pada analisa yang levelnya masih terkunci. */
  jenisEntry?: string;
  /** URL sampul — HANYA terisi untuk analisa gratis. Sampulnya tangkapan
   *  layar chart yang memuat garis entry/SL/TP; pada analisa berbayar
   *  gambar itu bukan pelengkap melainkan produknya, dan menayangkannya
   *  di kartu publik membuat gerbang pembeliannya jadi hiasan. */
  sampul?: string;
  /** Analisa ini punya gambar — dipakai kartu berbayar untuk mengatakan
   *  "berilustrasi" tanpa menunjukkan ilustrasinya. */
  adaSampul?: boolean;
  /** 'kripto' (Binance) atau 'tradefi' (MT5). Nama pasangan saja tidak
   *  cukup: XAUUSD di MT5 dan XAUT di Binance dibaca sama oleh mata tapi
   *  dieksekusi di tempat berbeda, dengan lot dan jam pasar berbeda pula. */
  pasar?: 'kripto' | 'tradefi';
  /** Potret jurnal analis PADA SAAT posting. Bukan jurnalnya hari ini:
   *  jurnal itu ada di Firestore miliknya sendiri dan tidak dibagikan.
   *  `bersih`/`menang`/`kalah`/`saldoAwal` baru ada sejak 16 Agu 2026 —
   *  analisa lama tidak punya, dan layarnya menyembunyikan baris itu
   *  daripada menampilkan nol yang terbaca seperti "tidak pernah untung". */
  snapshot: {
    saldo: number; winrate: number; pf: number; jumlah: number; kurva: number[];
    bersih?: number; menang?: number; kalah?: number; saldoAwal?: number;
  } | null;
}
export interface IsiAnalisa { entry: number; sl: number; tp: number; alasan: string }

/** Satu foto di galeri sebuah analisa. Foto menempel pada ANALISANYA, bukan
 *  pada pengunggahnya — siapa pun yang boleh membuka analisa itu melihat
 *  semua foto di dalamnya, termasuk yang ditambahkan orang lain. */
export interface GambarAnalisa {
  id: string; url: string; ket: string; uid: string; nama: string; waktu: number;
}
export interface PermintaanMasuk { id: string; judul: string; uid: string; nama: string; bukti: string; waktu: number }

async function idToken(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu untuk memakai Copy Trading.');
  return u.getIdToken();
}

async function panggil(jalur: string, opsi: RequestInit = {}, pakaiToken = true) {
  const kepala: Record<string, string> = { 'Content-Type': 'application/json' };
  if (pakaiToken) kepala.Authorization = `Bearer ${await idToken()}`;
  const r = await fetch(`${DASAR}${jalur}`, { ...opsi, headers: kepala });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j;
}

export async function daftarAnalisa(): Promise<RingkasAnalisa[]> {
  const j = await panggil('/api/analisa', {}, false);
  return j.daftar ?? [];
}

export async function kirimAnalisa(d: {
  judul: string; pasangan: string; arah: 'BUY' | 'SELL'; harga: number;
  ringkas: string; isi: IsiAnalisa; nama: string; pasar: 'kripto' | 'tradefi';
  snapshot: RingkasAnalisa['snapshot'];
  /** Persetujuan membuka akses pantau jurnal. WAJIB true — server menolak
   *  tanpa ini. Analis dinilai dari rekam jejak yang bisa diperiksa, dan
   *  posting sinyal berarti bersedia diperiksa. */
  izinJurnal: boolean;
}) {
  return panggil('/api/analisa', { method: 'POST', body: JSON.stringify(d) });
}

/* ════════════════════════════════════════════════════════════════════════
   PROFIL ANALIS — nama tampilan & avatar
   ════════════════════════════════════════════════════════════════════════
   Disimpan di SERVER, bukan Firestore, dan itu bukan pilihan kenyamanan:
   yang membaca nama & avatar adalah ORANG LAIN — papan peringkat dan kartu
   kanal menampilkan analis selain dirinya. Aturan Firestore mengunci
   `users/{uid}` untuk pemiliknya sendiri, jadi profil di sana tidak akan
   pernah terbaca siapa pun kecuali yang punya.

   Server menggabungkannya SAAT MEMBACA, bukan menulis balik ke tiap
   rekaman: ganti nama sekali langsung berlaku untuk seluruh sinyal lama.
   ════════════════════════════════════════════════════════════════════════ */
export interface ProfilAnalis {
  nama: string;
  /** 'anonim' = jangan tampilkan foto walau ada. Fotonya tidak dihapus,
   *  jadi berpindah kembali ke 'foto' tidak perlu mengunggah ulang. */
  avatar: 'anonim' | 'foto';
  foto: string;
}

/** Profil SEMUA analis, dipakai layar untuk menggambar avatar orang lain.
 *  Terbuka tanpa login — sama seperti papan peringkatnya sendiri. */
export async function ambilProfilAnalis(): Promise<Record<string, { nama: string; foto: string }>> {
  try {
    const j = await panggil('/api/analis/profil', {}, false);
    return j?.profil ?? {};
  } catch { return {}; }
}

/** Simpan profil SENDIRI. `dataUrl` opsional — kalau ada, ia diunggah dan
 *  modenya otomatis jadi 'foto'. */
export async function simpanProfilAnalis(d: {
  nama?: string; avatar?: 'anonim' | 'foto'; dataUrl?: string;
}): Promise<ProfilAnalis> {
  const j = await panggil('/api/analis/profil', { method: 'POST', body: JSON.stringify(d) });
  return j?.profil ?? { nama: '', avatar: 'anonim', foto: '' };
}

/** Batalkan sinyal sendiri. Server menolak kalau bukan penulisnya, kalau
 *  harganya sudah menyentuh entry, kalau jenisnya Market, atau kalau
 *  alasannya kurang dari 10 huruf — jadi galatnya ditampilkan apa adanya,
 *  bukan diterjemahkan jadi "gagal". */
export async function batalkanAnalisa(id: string, alasan: string) {
  return panggil('/api/analisa/batal', { method: 'POST', body: JSON.stringify({ id, alasan }) });
}

/** Sinyal ini masih bisa dibatalkan penulisnya? Syaratnya sama persis
 *  dengan yang dijaga server — ditulis ulang di sini HANYA supaya tombolnya
 *  tidak muncul saat pasti ditolak, bukan sebagai pengaman. Pengamannya di
 *  server; ini cuma sopan santun tampilan. */
/** Keadaan sebuah sinyal yang belum selesai.
 *
 *  `jalan`  — entry sudah tersentuh. FAKTA, dibaca server dari lilin
 *             sungguhan dan tidak pernah dicabut kembali.
 *  `nunggu` — penilai sudah memeriksanya dan entry-nya belum tersentuh.
 *  `belum`  — penilai belum pernah sampai ke sinyal ini.
 *
 *  ── KENAPA INI ADA ────────────────────────────────────────────────────
 *  Dulu layar menyimpulkan keadaan dari `jenisEntry`: kosong atau "Market"
 *  dianggap berjalan, sisanya menunggu. Dua-duanya keliru.
 *
 *  `jenisEntry` baru terisi pada penilaian pertama — sampai saat itu ia
 *  KOSONG, dan kosong dibaca sebagai "berjalan". Jadi tiap order menggantung
 *  yang baru diposting memperkenalkan dirinya sebagai posisi yang sudah
 *  jalan, lalu berubah sendiri beberapa menit kemudian. Itu laporan
 *  pemiliknya, dan ia benar: tidak ada yang terjadi di pasar di antara dua
 *  tampilan itu.
 *
 *  Yang salah bukan cuma waktunya, tapi juga logikanya: tidak tahu bukan
 *  jawaban. Sekarang `terisi` yang menentukan — satu-satunya medan di sini
 *  yang benar-benar dibaca dari lilin — dan yang belum diperiksa mengaku
 *  belum diperiksa. */
export type KeadaanSinyal = 'jalan' | 'nunggu' | 'belum';
export function keadaanSinyal(a: RingkasAnalisa): KeadaanSinyal {
  if (a.terisi) return 'jalan';
  return a.jenisEntry ? 'nunggu' : 'belum';
}

export function bisaDibatalkan(a: RingkasAnalisa, uidku?: string): boolean {
  return !!uidku && a.uid === uidku && !a.hasil && !a.terisi
    && !!a.jenisEntry && !/^market$/i.test(a.jenisEntry);
}

export async function hapusAnalisa(id: string) {
  return panggil(`/api/analisa?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function bukaIsi(id: string): Promise<{ isi: IsiAnalisa; galeri: GambarAnalisa[] }> {
  const j = await panggil(`/api/analisa/isi?id=${encodeURIComponent(id)}`);
  return { isi: j.isi, galeri: j.galeri ?? [] };
}

/* ── Galeri foto ────────────────────────────────────────────────────────
   Dikirim sebagai data URL, bukan multipart. Alasannya bukan kemalasan:
   rute /api/gambar yang sudah ada memakai pola yang sama, dan menambah
   parser multipart di backend berarti dependensi baru untuk satu rute.
   Batas 5 MB dijaga di server; di sini gambarnya diperkecil dulu supaya
   foto 12 MP dari HP tidak berangkat utuh lalu ditolak setelah menunggu. */

/** Perkecil ke maksimal 1600px sisi terpanjang dan kompres ke JPEG 82%.
 *  Tangkapan layar chart tidak butuh lebih; yang dibaca orang adalah garis
 *  dan angkanya, bukan jumlah pikselnya. */
export function kecilkanGambar(berkas: File, maks = 1600): Promise<string> {
  return new Promise((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onerror = () => gagal(new Error('Gagal membaca berkas'));
    pembaca.onload = () => {
      const img = new Image();
      img.onerror = () => gagal(new Error('Berkas ini bukan gambar yang bisa dibaca'));
      img.onload = () => {
        const skala = Math.min(1, maks / Math.max(img.width, img.height));
        const kanvas = document.createElement('canvas');
        kanvas.width = Math.round(img.width * skala);
        kanvas.height = Math.round(img.height * skala);
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

export async function tambahGambar(id: string, dataUrl: string, ket: string, nama: string): Promise<GambarAnalisa> {
  const j = await panggil('/api/analisa/gambar', {
    method: 'POST', body: JSON.stringify({ id, dataUrl, ket, nama }),
  });
  return j.gambar;
}

/* ── Performa signal ────────────────────────────────────────────────────
   Angkanya dihitung backend dari sinyal yang SUDAH SELESAI menurut lilin
   sungguhan — tidak ada satu pun yang bisa diisi tangan, termasuk oleh
   pemilik. Papan peringkat yang bisa disetel sendiri tidak berarti apa-apa. */
export interface PerformaAnalis {
  uid: string; nama: string; agen: boolean;
  /** Foto profil analis, kosong kalau ia memilih anonim. Datang dari
   *  server dan sudah menghormati pilihannya — layar tidak perlu tahu
   *  mode avatarnya, cukup: ada foto atau tidak. */
  foto?: string;
  menang: number; kalah: number; total: number;
  /** Sinyal yang ditarik sebelum harganya datang. TIDAK masuk `total` dan
   *  tidak masuk penyebut winrate: menghukum analis yang disiplin menarik
   *  rencana yang sudah tidak sah akan mendorong kebiasaan sebaliknya. */
  batal: number;
  winrate: number;
  /** Estimasi hasil dolar menurut model yang disebut di `modal`/`risikoPersen`. */
  hasilDolar: number;
  terakhir: number;
  /** Tanggal lokal `YYYY-MM-DD` -> hasil dolar hari itu. Untuk kalender. */
  harian: Record<string, number>;
  /** Jarak SL rata-rata sebagai PERSEN HARGA, dari sinyal yang sudah
   *  selesai. Dihitung server.
   *
   *  Ini parameter risiko yang sungguhan milik analisnya — seberapa jauh
   *  ia membiarkan harga melawan sebelum menyerah. Sengaja BUKAN "persen
   *  dari modal": sinyal berisi entry/SL/TP, tidak pernah berisi ukuran
   *  posisi, jadi persentase modal ditentukan lot yang dipakai PENIRUNYA
   *  dan tidak bisa diketahui dari sini oleh siapa pun.
   *
   *  null = belum ada satu pun yang bisa diukur. Bukan 0 — nol di kolom
   *  jarak SL terbaca sebagai "tanpa SL", kebalikan dari "belum tahu". */
  slPersen?: number | null;
}

export interface Performa {
  modal: number;
  risikoPersen: number;
  analis: PerformaAnalis[];
  /** Sinyal yang masih berjalan. Dipakai layar untuk mengatakan terus
   *  terang bahwa peringkatnya belum berarti apa-apa saat datanya sedikit. */
  berjalan: number;
  /** true = isinya CONTOH, bukan rekam jejak siapa pun. Layar WAJIB
   *  menuliskannya. Papan peringkat adalah dasar orang memutuskan sinyal
   *  siapa yang ditiru; angka karangan tanpa label di sana bukan hiasan
   *  yang keliru, melainkan saran investasi palsu. */
  contoh?: boolean;
}

/** @param bolehContoh Hanya boleh true untuk penonton yang TIDAK punya
 *  akses — pratinjau atau belum masuk. Pemilik dan pelanggan aktif SELALU
 *  melihat rekam jejak sungguhan, seberapa pun tipis.
 *
 *  Pemisahan ini yang menjaga fitur aslinya utuh: siapa pun yang bisa
 *  menekan "tiru sinyal" mengambil keputusannya dari angka yang benar,
 *  dan tidak ada satu jalur pun yang membuat data contoh sampai ke sana. */
export async function ambilPerforma(bolehContoh = false): Promise<Performa> {
  const j = await panggil('/api/analisa/performa', {}, false);
  const nyata: Performa = {
    modal: j.modal ?? 1000, risikoPersen: j.risikoPersen ?? 1,
    analis: j.analis ?? [], berjalan: j.berjalan ?? 0,
  };
  if (!bolehContoh) return nyata;

  /* Papan peringkat baru berarti sesudah ada beberapa sinyal selesai. Di
     bawah itu ia bukan cuma tipis — ia MENYESATKAN: satu sinyal kalah
     membuat satu-satunya analis tampil 0% winrate, dan itu penilaian yang
     tidak layak dibaca siapa pun. Halamannya sendiri sudah mengatakannya
     ("baru 1 sinyal selesai — terlalu sedikit untuk menyimpulkan").

     Untuk penonton yang memang sedang melihat-lihat, contoh berlabel
     lebih jujur daripada peringkat sungguhan yang belum layak dipercaya. */
  const selesai = nyata.analis.reduce((s, a) => s + a.total, 0);
  if (selesai >= 3) return nyata;

  const { PERFORMA_CONTOH } = await import('@/lib/contoh-pratinjau');
  /* `berjalan` tetap dari yang SUNGGUHAN kalau ada — jumlah sinyal yang
     sedang berjalan itu fakta yang terbaca, dan tidak ada alasan
     menggantinya dengan angka contoh. */
  return { ...PERFORMA_CONTOH, contoh: true, berjalan: nyata.berjalan || PERFORMA_CONTOH.berjalan };
}

export async function hapusGambar(id: string, gambarId: string) {
  return panggil('/api/analisa/gambar/hapus', { method: 'POST', body: JSON.stringify({ id, gambarId }) });
}

export async function mintaAkses(id: string, bukti: string, nama: string) {
  return panggil('/api/analisa/minta', { method: 'POST', body: JSON.stringify({ id, bukti, nama }) });
}

export async function statusSaya(): Promise<{ masuk: PermintaanMasuk[]; statusku: Record<string, string> }> {
  const j = await panggil('/api/analisa/saya');
  return { masuk: j.masuk ?? [], statusku: j.statusku ?? {} };
}

export async function putuskanAkses(id: string, uid: string, tindakan: 'setujui' | 'tolak') {
  return panggil('/api/analisa/putuskan', { method: 'POST', body: JSON.stringify({ id, uid, tindakan }) });
}

/* ── Login Discord ──────────────────────────────────────────────────────
   Tombolnya hanya muncul kalau backend menyatakan siap — fitur yang belum
   dikonfigurasi tidak boleh tampil sebagai tombol yang gagal saat diklik. */
export async function discordSiap(): Promise<boolean> {
  try {
    const r = await fetch(`${DASAR}/api/auth/discord/status`);
    const j = await r.json();
    return !!j.siap;
  } catch { return false; }
}

export function mulaiLoginDiscord() {
  const balik = window.location.origin + window.location.pathname;
  window.location.href = `${DASAR}/api/auth/discord?balik=${encodeURIComponent(balik)}`;
}
