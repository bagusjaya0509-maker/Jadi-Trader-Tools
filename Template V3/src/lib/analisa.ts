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
   *  label, bukan sebagai tebakan. */
  hasil?: 'sl' | 'tp' | null;
  waktuHasil?: number | null;
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
  snapshot: { saldo: number; winrate: number; pf: number; jumlah: number; kurva: number[] } | null;
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
  ringkas: string; isi: IsiAnalisa; nama: string;
  snapshot: RingkasAnalisa['snapshot'];
  /** Persetujuan membuka akses pantau jurnal. WAJIB true — server menolak
   *  tanpa ini. Analis dinilai dari rekam jejak yang bisa diperiksa, dan
   *  posting sinyal berarti bersedia diperiksa. */
  izinJurnal: boolean;
}) {
  return panggil('/api/analisa', { method: 'POST', body: JSON.stringify(d) });
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
  menang: number; kalah: number; total: number;
  winrate: number;
  /** Estimasi hasil dolar menurut model yang disebut di `modal`/`risikoPersen`. */
  hasilDolar: number;
  terakhir: number;
  /** Tanggal lokal `YYYY-MM-DD` -> hasil dolar hari itu. Untuk kalender. */
  harian: Record<string, number>;
}

export interface Performa {
  modal: number;
  risikoPersen: number;
  analis: PerformaAnalis[];
  /** Sinyal yang masih berjalan. Dipakai layar untuk mengatakan terus
   *  terang bahwa peringkatnya belum berarti apa-apa saat datanya sedikit. */
  berjalan: number;
}

export async function ambilPerforma(): Promise<Performa> {
  const j = await panggil('/api/analisa/performa', {}, false);
  return {
    modal: j.modal ?? 1000, risikoPersen: j.risikoPersen ?? 1,
    analis: j.analis ?? [], berjalan: j.berjalan ?? 0,
  };
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
