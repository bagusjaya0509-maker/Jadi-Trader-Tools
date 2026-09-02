import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   COIN LISTING — menunggui koin presale sampai ia listing
   ════════════════════════════════════════════════════════════════════════
   Dibeli di situs proyeknya, dipegang di dompet sendiri, lalu menunggu.
   Yang dijaga halaman ini cuma satu momen: detik kolamnya muncul di DEX.

   Semua rutenya butuh token dan mengembalikan baris milik pemanggilnya
   saja. Isinya data keuangan pribadi — berapa dolar dibayar untuk berapa
   token — dan tidak ada satu pun bagian darinya yang pernah terbit ke
   pengguna lain, termasuk ke pemilik platform.
   ════════════════════════════════════════════════════════════════════════ */

function dasar(): string {
  return (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
}

async function token(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try { return await u.getIdToken(); } catch { return null; }
}

export interface PasarListing {
  kolam: string;
  nama: string;
  dex: string;
  harga: number;
  likuiditas: number;
  volume24: number;
  fdv: number;
  /** Kapan kolamnya dibuat menurut rantai — bukan kapan kita melihatnya. */
  dibuatKolam: number;
  jumlahKolam: number;
}

export interface FaktaAman {
  diperiksa: number;
  kosong?: boolean;
  bisaCetak?: boolean;
  bisaBekukan?: boolean;
  bisaDiubah?: boolean;
  pajakBeli?: number | null;
  pajakJual?: number | null;
  /** Persen pasokan di 10 dompet teratas. Tinggi ≠ penipuan. */
  terpusat?: number | null;
  pemegang?: number | null;
  namaAsli?: string;
  simbolAsli?: string;
}

export interface KoinPantau {
  alamat: string;
  jaringan: string;
  nama: string;
  simbol: string;
  catatan: string;
  /** Total dolar yang dibayar saat presale. */
  beliUsd: number;
  /** Jumlah token yang diterima. */
  beliToken: number;
  status: 'pantau' | 'listing' | 'berhenti';
  dibuat: number;
  diperiksa: number;
  putaran: number;
  galat?: string;
  /** Kolam yang sudah ada tapi terlalu dangkal untuk disebut listing. */
  benih?: { likuiditas: number; dibuatKolam: number };
  pasar?: PasarListing;
  listingKetahuan?: number;
  /** false = alarmnya belum dimatikan pembacanya. */
  dibaca?: boolean;
  puncakTerlihat?: { harga: number; waktu: number };
  aman?: FaktaAman;
}

export interface InfoJaringan {
  label: string;
  gas: string;
  goplus: string;
  pola: 'evm' | 'sol';
}

export interface IsiListing {
  daftar: KoinPantau[];
  jaringan: Record<string, InfoJaringan>;
  maks: number;
}

/* Kenapa gagalnya PENTING, bukan cuma bahwa ia gagal.
   ────────────────────────────────────────────────────────────────────────
   Sebelumnya ketiga sebab di bawah sama-sama berakhir sebagai `{ error }`
   lalu dijadikan `null` oleh pemanggilnya — dan halaman menampilkan satu
   kalimat untuk semuanya: "Masuk dulu untuk memakai halaman ini."

   Akibatnya: VPS mati -> halaman menuduh sesi penggunanya. Orangnya keluar
   lalu masuk lagi berkali-kali untuk memperbaiki sesuatu yang tidak rusak,
   sementara sebab yang sebenarnya tidak pernah disebut di layar. */
export type KodeGagal = 'LOGIN' | 'JARINGAN' | 'SERVER';

async function panggil(jalan: string, opsi?: RequestInit): Promise<any> {
  const t = await token();
  if (!t) return { error: 'Belum masuk.', kode: 'LOGIN' as KodeGagal };
  try {
    const r = await fetch(`${dasar()}${jalan}`, {
      ...opsi,
      headers: {
        ...(opsi?.body ? { 'content-type': 'application/json' } : {}),
        Authorization: 'Bearer ' + t,
      },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      /* 401 dari server berarti tokennya memang ditolak — itu sungguhan
         soal login, dan harus dibedakan dari 500 yang bukan. */
      return {
        error: j.error || `Gagal (${r.status})`,
        kode: (r.status === 401 ? 'LOGIN' : 'SERVER') as KodeGagal,
      };
    }
    return j;
  } catch (e) {
    return { error: 'Tidak bisa menghubungi server.', kode: 'JARINGAN' as KodeGagal };
  }
}

export type HasilListing =
  | { ok: true; isi: IsiListing }
  | { ok: false; kode: KodeGagal; pesan: string };

export async function ambilListing(): Promise<HasilListing> {
  const j = await panggil('/api/listing');
  if (j.error) return { ok: false, kode: j.kode || 'SERVER', pesan: j.error };
  return {
    ok: true,
    isi: { daftar: j.daftar || [], jaringan: j.jaringan || {}, maks: j.maks || 20 },
  };
}

/* ── SENTIMEN PASAR ──────────────────────────────────────────────────────
   Konteks, bukan sinyal. Indeksnya tidak tahu apa pun tentang token presale
   yang ditunggu di halaman ini — ia mengukur suasana pasar kripto secara
   keseluruhan, dan diperbarui sekali sehari.

   `basi: true` datang dari server saat sumbernya sedang tidak terjangkau dan
   yang dikirim adalah singgahan lama. Halaman WAJIB menampilkannya: angka
   kemarin yang menyamar jadi angka hari ini adalah kebohongan kecil yang
   dipakai orang untuk mengambil keputusan. */
export interface Sentimen {
  nilai: number;
  label: string;
  waktu: number;
  kemarin: number | null;
  pekanLalu: number | null;
  riwayat: { t: number; v: number }[];
  basi?: boolean;
}

export async function ambilSentimen(): Promise<Sentimen | null> {
  const j = await panggil('/api/listing/sentimen');
  if (j.error || !Number.isFinite(j.nilai)) return null;
  return {
    nilai: j.nilai, label: String(j.label || ''), waktu: Number(j.waktu) || 0,
    kemarin: Number.isFinite(j.kemarin) ? j.kemarin : null,
    pekanLalu: Number.isFinite(j.pekanLalu) ? j.pekanLalu : null,
    riwayat: Array.isArray(j.riwayat) ? j.riwayat : [],
    basi: j.basi === true,
  };
}

/* Zona resmi indeksnya. Warnanya sengaja TIDAK memakai merah=buruk /
   hijau=baik: di indeks ini "extreme greed" justru keadaan yang paling
   sering mendahului koreksi, dan mewarnainya hijau berarti layar memberi
   saran yang tidak pernah diminta. Yang dipakai gradasi dingin->hangat,
   yang menyatakan SUHU pasar tanpa menilainya. */
export function zonaSentimen(n: number): { nama: string; kelas: string; cincin: string } {
  if (n <= 24) return { nama: 'Extreme Fear', kelas: 'text-sky-300',     cincin: '#7dd3fc' };
  if (n <= 44) return { nama: 'Fear',         kelas: 'text-sky-200/80',  cincin: '#bae6fd' };
  if (n <= 55) return { nama: 'Neutral',      kelas: 'text-zinc-300',    cincin: '#d4d4d8' };
  if (n <= 74) return { nama: 'Greed',        kelas: 'text-amber-300',   cincin: '#fcd34d' };
  return { nama: 'Extreme Greed',             kelas: 'text-orange-400',  cincin: '#fb923c' };
}

export async function simpanKoin(v: {
  jaringan: string; alamat: string; nama?: string; simbol?: string;
  catatan?: string; beliUsd?: number; beliToken?: number;
}) {
  return panggil('/api/listing', { method: 'POST', body: JSON.stringify(v) });
}

export async function hapusKoin(jaringan: string, alamat: string) {
  return panggil(`/api/listing/${jaringan}/${encodeURIComponent(alamat)}`, { method: 'DELETE' });
}

export async function periksaSekarang(jaringan: string, alamat: string) {
  return panggil('/api/listing/periksa', { method: 'POST', body: JSON.stringify({ jaringan, alamat }) });
}

export async function periksaKeamanan(jaringan: string, alamat: string) {
  return panggil('/api/listing/aman', { method: 'POST', body: JSON.stringify({ jaringan, alamat }) });
}

export async function tandaiDibaca(alamat?: string) {
  return panggil('/api/listing/dibaca', { method: 'POST', body: JSON.stringify({ alamat }) });
}

/* ── Hitungan yang dipakai layar ────────────────────────────────────────
   Ditaruh di sini, bukan di komponen: harga presale muncul di tiga tempat
   berbeda di halaman itu, dan tiga salinan rumus pembagian adalah tiga
   kesempatan untuk tidak sengaja membaginya dengan nol. */

/** Harga per token saat presale, atau null kalau angkanya belum diisi. */
export function hargaPresale(k: KoinPantau): number | null {
  if (!(k.beliUsd > 0) || !(k.beliToken > 0)) return null;
  return k.beliUsd / k.beliToken;
}

/** Berapa kali lipat harga sekarang terhadap harga presale. */
export function kelipatan(k: KoinPantau): number | null {
  const p = hargaPresale(k);
  if (p == null || !k.pasar?.harga) return null;
  return k.pasar.harga / p;
}

/** Nilai token yang dipegang menurut harga kolam terdalam sekarang. */
export function nilaiSekarang(k: KoinPantau): number | null {
  if (!(k.beliToken > 0) || !k.pasar?.harga) return null;
  return k.beliToken * k.pasar.harga;
}

/** Harga sub-sen ditulis penuh, bukan dibulatkan jadi $0.00.
 *  Koin presale hampir selalu hidup di bawah satu sen, dan pembulatan yang
 *  wajar untuk BTC membuat seluruh halaman ini menampilkan angka nol. */
export function tulisHarga(h: number): string {
  if (!h) return '—';
  if (h >= 1) return '$' + h.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (h >= 0.0001) return '$' + h.toFixed(6);
  return '$' + h.toExponential(3).replace('e-', '×10⁻');
}

export function tulisUsd(n: number): string {
  if (!n) return '$0';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + ' M';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + ' jt';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + ' rb';
  return '$' + n.toFixed(0);
}

/* ── JEJAK: LINTASAN, BUKAN POTRET ───────────────────────────────────────
   Dibaca dari catatan harian yang ditulis cron di VPS. Rute ini tidak pernah
   menarik data pasar sendiri — halaman yang dibuka sepuluh kali sehari tidak
   boleh menembak GeckoTerminal sepuluh kali untuk angka yang cuma berubah
   sekali sehari.

   `hariTotal` vs `hariLangsung` adalah pembedaan yang menentukan: harga dan
   volume bisa ditarik surut dari riwayat OHLCV, sedangkan likuiditas dan
   pemegang tidak punya riwayat di mana pun. Panel memakai `hariLangsung`
   untuk memutuskan kapan boleh bicara soal tren keduanya. */
export interface BarisJejak {
  jaringan: string; alamat: string; nama: string; simbol: string;
  dex: string; kolam: string;
  milikPemilik: boolean;
  umurKolamHari: number | null;
  harga: number | null; likuiditas: number | null;
  volume24: number | null; fdv: number | null; pemegang: number | null;
  trenVolume: number | null;
  trenLikuiditas: number | null;
  trenPemegang: number | null;
  hariTotal: number;
  hariLangsung: number;
  riwayat: { t: string; h: number; v: number }[];
}

export async function ambilJejak(): Promise<
  { koin: BarisJejak[]; diperbarui: number; belumAda?: boolean } | null
> {
  const j = await panggil('/api/listing/jejak');
  if (j.error) return null;
  return {
    koin: (j.koin ?? []) as BarisJejak[],
    diperbarui: Number(j.diperbarui) || 0,
    belumAda: j.belumAda === true,
  };
}
