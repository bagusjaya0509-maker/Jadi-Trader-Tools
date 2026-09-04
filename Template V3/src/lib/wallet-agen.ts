import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   DOMPET PANTAUAN — on-chain, hanya untuk pemilik
   ════════════════════════════════════════════════════════════════════════
   Fase MENCATAT. Agen membaca posisi dan setiap transaksi dompet perp
   Hyperliquid yang dipilih pemilik; tidak ada order yang dikirim ke mana
   pun, dan belum ada sinyal yang terbit ke publik.

   Digerbangi pemilik bukan karena alamatnya rahasia — alamat dompet memang
   data terbuka — melainkan karena KEPUTUSANNYA belum diuji: siapa yang
   layak dipantau, apalagi disalin, belum punya satu angka pun untuk
   dipertanggungjawabkan.
   ════════════════════════════════════════════════════════════════════════ */

export interface DompetPantau {
  alamat: string;
  nama: string;
  sejak: number;
  aktif?: boolean;
}

export interface PosisiDompet {
  alamat: string; nama: string; koin: string;
  arah: 'LONG' | 'SHORT';
  ukuran: number; entry: number; nilai: number; pnl: number;
  leverage: number; likuidasi: number; nilaiAkun: number;
}

export interface TransaksiDompet {
  waktu: number; alamat: string; nama: string; koin: string;
  arah: 'BUY' | 'SELL';
  /** Istilah Hyperliquid apa adanya: "Open Long", "Close Short", dst. */
  dir: string;
  harga: number; ukuran: number; nilai: number; pnl: number; hash: string;
}

/** Rekam jejak dompet menurut BURSA, bukan menurut catatan kita.
 *
 *  Bukan "seumur hidup": Hyperliquid memulangkan maksimal 2000 fill, jadi
 *  untuk dompet ramai ini cuma satu-dua bulan terakhir. `terpotong` menandai
 *  yang menyentuh batas itu — WR dari 2000 fill terakhir dan WR dari seluruh
 *  hidup dompet adalah dua klaim berbeda, dan cuma satu yang bisa dibuktikan. */
export interface RiwayatBursa {
  fill: number;
  terpotong: boolean;
  tutup: number;
  menang: number;
  /** Rata-rata untung dibagi rata-rata rugi. null = belum pernah rugi. */
  rr: number | null;
  menangRata: number;
  kalahRata: number;
  realisasi: number;
  /** Waktu fill tertua yang dipulangkan bursa. */
  sejak: number;
  /** Setoran pertama ke dompetnya — umur yang sebenarnya, bukan fill tertua.
   *  0/undefined kalau buku besarnya belum terbaca. */
  lahir?: number;
  lahirDicek?: number;
}

/** Penanda "koin ini sedang saya tiru dari dompet itu". Cuma penanda —
 *  tidak ada order, ukuran, atau apa pun yang bisa dipakai mengeksekusi. */
export interface PenandaTiru {
  alamat: string;
  koin: string;
  waktu: number;
  /** Tutup posisiku otomatis saat dompet sumbernya sudah flat di koin ini.
   *  Mati sebagai bawaan, dan padam sendiri sesudah sekali dieksekusi. */
  otoTutup?: boolean;
  /** Berapa pindaian berturut-turut sumbernya terlihat flat. */
  konfirmasi?: number;
  terakhir?: { waktu: number; sukses: boolean; jumlah: number; arah: string };

  /* -- SISI BUKA ---------------------------------------------------- */
  /** Buka posisi otomatis saat dompet sumbernya MULAI memegang koin ini.
   *  Mati sebagai bawaan, dan tidak bisa dinyalakan sebelum `usd` diisi. */
  otoBuka?: boolean;
  /** Bursa tujuan salinan, dipilih per dompet.
   *  'dua' = Binance diutamakan, Hyperliquid jadi jaring untuk koin yang
   *  tidak terdaftar di Binance. Kosong = 'binance'. */
  bursa?: 'binance' | 'hyperliquid' | 'dua';
  /** Bursa tempat posisi TERAKHIR benar-benar dibuka. Dipakai penjaga
   *  tutup supaya ia mencari posisinya di tempat yang benar. */
  bursaBuka?: string | null;
  /** Koin tidak terdaftar di bursa yang dipilih (mode hyperliquid). */
  takAdaDiBursa?: boolean;
  /** Ukuran order dalam USD. MARGIN -- uang yang dipertaruhkan -- bukan
   *  nilai posisi. Nilai posisinya usd x leverage; di 1x keduanya sama. */
  usd?: number;
  leverage?: number;
  /** Berapa pindaian berturut-turut sumbernya terlihat baru membuka. */
  bukaKonfirmasi?: number;
  /** Apakah sumbernya sedang memegang, menurut pindaian TERAKHIR. Ini yang
   *  membuat pemantau bisa membedakan "baru membuka" dari "sedang punya" --
   *  `undefined` berarti belum pernah diamati, dan itu TIDAK memicu apa
   *  pun. */
  sumberPegang?: boolean;
  /** Koin ini tidak terdaftar di Binance Futures. Ditandai server supaya
   *  layar bisa mengatakannya alih-alih diam. */
  takAdaDiBinance?: boolean;
  terakhirBuka?: number;
  simbolBuka?: string;
}

/* ══ SETELAN SALIN — SATU PER DOMPET ══════════════════════════════════
   Menggantikan penandaan per koin. Yang disimpan cuma niatnya: ke bursa
   mana, sebesar apa, dan hidup atau tidak. Koin mana yang disalin bukan
   urusan setelan ini — itu keputusan dompetnya. */
export interface SetelanSalin {
  alamat: string;
  nama?: string;
  /** Hidup. Selama false, tidak ada order yang berangkat. */
  aktif?: boolean;
  bursa?: 'binance' | 'hyperliquid' | 'dua';
  /** MARGIN per order dalam USD — uang yang dipertaruhkan, bukan nilai
   *  posisi. Nilai posisinya usd x leverage. */
  usd?: number;
  leverage?: number;
  dibuat?: number;
  diubah?: number;

  /* ── Keadaan berjalan, ditulis PEMANTAU. Layar hanya membacanya. ── */
  /** Koin yang dipegang dompet sumber menurut pindaian terakhir.
   *  `undefined` = belum pernah diamati; pindaian berikutnya cuma
   *  mencatat, tidak membuka apa pun. */
  pegang?: string[];
  /** Posisi salinan yang SEDANG kita pegang, per koin. */
  punyaku?: Record<string, PosisiSalinan>;
  konfirmasiBuka?: Record<string, number>;
  konfirmasiTutup?: Record<string, number>;
}

/** Satu posisi salinan yang sedang terbuka.
 *
 *  Empat medan pertama ditulis saat ordernya berangkat dan tidak pernah
 *  berubah lagi; `hidup` disegarkan pemantau tiap putaran dari bursa.
 *  Dipisah begitu bukan demi kerapian: `usd` dan `leverage` adalah setelan
 *  SAAT DIBUKA, dan posisi yang dibuka dengan $30 tidak berubah jadi $50
 *  hanya karena setelannya dinaikkan sesudahnya. */
export interface PosisiSalinan {
  bursa: string;
  simbol: string;
  arah: string;
  waktu: number;
  usd?: number;
  leverage?: number;
  /** Arah dompet sumbernya: LONG / SHORT. */
  arahSumber?: string;
  /** Potret dari bursa. `terbaca: false` = posisinya tidak ketemu di
   *  jawaban bursa terakhir — angkanya yang tertinggal sudah basi, dan
   *  layar harus mengatakannya alih-alih menampilkannya seolah segar. */
  hidup?: {
    terbaca: boolean;
    qty: number; entry: number; harga: number; nilai: number;
    margin: number; pnl: number; roe: number;
    likuidasi: number; leverage: number; waktu: number;
  };
}

/** Satu baris log aksi mesin salinan. */
export interface LogSalin {
  waktu: number;
  /** buka · tutup · tahan · gagal · konfirmasi · catat */
  jenis: string;
  alamat: string;
  koin: string;
  pesan: string;
}

/** Satu posisi salinan yang SUDAH tertutup, beserta hasilnya. */
export interface RiwayatSalin {
  waktu: number;
  dibuka: number;
  alamat: string;
  nama: string;
  koin: string;
  simbol: string;
  bursa: string;
  arah: string;
  usd: number;
  leverage: number;
  entry: number;
  keluar: number;
  /** null = hasilnya tidak pernah terbaca dari bursa. Berbeda dari nol,
   *  yang berarti impas — dan winrate yang menghitung "tidak tahu" sebagai
   *  impas berbohong ke arah yang tidak bisa dikoreksi belakangan. */
  pnl: number | null;
  roe: number | null;
}

/** Tiga daftar yang selalu dibaca bersamaan oleh panel Posisi Copy. */
export interface IsiSalin {
  salin: SetelanSalin[];
  log: LogSalin[];
  riwayat: RiwayatSalin[];
  /* ── BATAS PER KOIN, KELIPATAN MARGIN DASAR ──────────────────────────
     Berapa kali margin dasar boleh menumpuk di SATU koin, dihitung dari
     seluruh isi akun. 1 = satu koin satu posisi (perilaku sebelum 4 Sep
     2026): koin yang sudah ada isinya, dari mana pun asalnya, menahan
     salinan berikutnya.

     GLOBAL, bukan per dompet, dan itu bukan kemalasan: bursa MENYATUKAN
     posisi dari dompet mana pun jadi satu posisi yang sama. Batas per
     dompet akan menjanjikan sesuatu yang tidak bisa ditepati bursa. */
  maksLipat: number;
}

export interface KeadaanDompet {
  dompet: DompetPantau[];
  posisi: PosisiDompet[];
  log: TransaksiDompet[];
  seumur: Record<string, RiwayatBursa>;
  tiru: PenandaTiru[];
  denyut: number;
  galat: string;
}

function dasar(): string {
  return (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
}

async function token(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try { return await u.getIdToken(); } catch { return null; }
}

/** null = tidak bisa bertanya, bukan "kosong". Dua jawaban yang berbeda. */
/** Keadaan dompet pantauan. TANPA token: isinya data rantai publik, dan
 *  pengunjung yang belum login pun boleh melihatnya.
 *
 *  Penanda tiruan ditarik TERPISAH dan hanya berhasil untuk pemilik. Ia
 *  sengaja tidak ikut di jawaban utama: menyatukannya berarti satu rute
 *  membawa dua tingkat kerahasiaan sekaligus, dan gerbang yang harus
 *  memilah isi jawabannya sendiri adalah gerbang yang cepat atau lambat
 *  salah memilah. */
export async function keadaanDompet(): Promise<KeadaanDompet | null> {
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet`);
    if (!r.ok) return null;
    const j = await r.json();

    /* Gagal = bukan pemilik, dan itu keadaan yang WAJAR di sini — bukan
       galat yang perlu dilaporkan. Daftarnya kosong, dan panel "Posisi
       tiruan" memang tidak dirender untuk orang lain. */
    let tiru: PenandaTiru[] = [];
    try {
      const t = await token();
      if (t) {
        const rt = await fetch(`${dasar()}/api/agen/wallet/tiru`,
          { headers: { Authorization: 'Bearer ' + t } });
        if (rt.ok) {
          const jt = await rt.json();
          if (Array.isArray(jt?.tiru)) tiru = jt.tiru;
        }
      }
    } catch { /* bukan pemilik, atau jaringan berkedip */ }

    return {
      dompet: Array.isArray(j?.dompet) ? j.dompet : [],
      posisi: Array.isArray(j?.posisi) ? j.posisi : [],
      log: Array.isArray(j?.log) ? j.log : [],
      seumur: (j && typeof j.seumur === 'object' && j.seumur) || {},
      tiru,
      denyut: Number(j?.denyut) || 0,
      galat: String(j?.galat || ''),
    };
  } catch { return null; }
}

/** Memulangkan pesan galatnya apa adanya: penolakan di sini hampir selalu
 *  "alamatnya salah bentuk" atau "sudah dipantau" — kalimat yang menjelaskan
 *  persis apa yang perlu diperbaiki. */
export async function tambahDompet(alamat: string, nama: string): Promise<{ ok: true } | { ok: false; pesan: string }> {
  const t = await token();
  if (!t) return { ok: false, pesan: 'Belum masuk.' };
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alamat, nama }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, pesan: String(j.error || 'Ditolak server (' + r.status + ').') };
    return { ok: true };
  } catch {
    return { ok: false, pesan: 'Tidak bisa menghubungi server.' };
  }
}

export async function tandaiTiru(alamat: string, koin: string): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet/tiru`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alamat, koin }),
    });
    return r.ok;
  } catch { return false; }
}

export async function aturOtoTutup(alamat: string, koin: string, otoTutup: boolean): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet/tiru/oto`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alamat, koin, otoTutup }),
    });
    return r.ok;
  } catch { return false; }
}

/** Sakelar auto-open, ukuran, dan leverage. Ketiganya lewat SATU rute
 *  tapi masing-masing opsional: layar mengirim cuma yang berubah, jadi
 *  mengetik ukuran tidak diam-diam ikut menyalakan sakelarnya. */
export async function aturBuka(
  alamat: string, koin: string,
  ubah: { otoBuka?: boolean; usd?: number; leverage?: number; bursa?: string },
): Promise<{ ok: boolean; pesan?: string }> {
  const t = await token();
  if (!t) return { ok: false, pesan: 'Belum masuk.' };
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet/tiru/buka`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alamat, koin, ...ubah }),
    });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    return { ok: false, pesan: j.error || `Server menjawab ${r.status}` };
  } catch { return { ok: false, pesan: 'Tidak bisa menghubungi server.' }; }
}

export async function batalTiru(alamat: string, koin: string): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  try {
    const r = await fetch(
      `${dasar()}/api/agen/wallet/tiru/${encodeURIComponent(alamat)}/${encodeURIComponent(koin)}`,
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } });
    return r.ok;
  } catch { return false; }
}

/** Setelan salin + log aksi + riwayat posisi tertutup. Pemilik saja —
 *  digerbangi server.
 *
 *  Ketiganya dipulangkan satu rute karena satu panel selalu membacanya
 *  bersamaan. Kegagalan memulangkan tiga daftar KOSONG, bukan melempar:
 *  panel ini menumpang di kartu yang juga menampilkan dompet pantauan, dan
 *  setelan yang tidak terbaca tidak boleh menjatuhkan keduanya. */
export async function daftarSalin(): Promise<IsiSalin> {
  const kosong: IsiSalin = { salin: [], log: [], riwayat: [], maksLipat: 1 };
  const t = await token();
  if (!t) return kosong;
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet/salin`, {
      headers: { Authorization: 'Bearer ' + t },
    });
    if (!r.ok) return kosong;
    const j = await r.json();
    return {
      salin: Array.isArray(j.salin) ? j.salin : [],
      log: Array.isArray(j.log) ? j.log : [],
      riwayat: Array.isArray(j.riwayat) ? j.riwayat : [],
      /* Server lama tidak mengirim medan ini. Jatuh ke 1 = penjaga paling
         ketat; nilai bawaan yang longgar pada jawaban yang tidak lengkap
         adalah cara paling sunyi untuk melonggarkan penjaga uang. */
      maksLipat: Number(j.maksLipat) >= 1 ? Number(j.maksLipat) : 1,
    };
  } catch { return kosong; }
}

/** Simpan setelan salin untuk satu dompet. Mengirim SELURUH setelan
 *  sekaligus — popup-nya memang satu formulir dengan satu tombol Simpan,
 *  dan mengirimnya sepotong-sepotong berarti ada keadaan setengah tersimpan
 *  yang bisa dipakai pemantau di tengah putaran. */
export async function simpanSalin(ubah: {
  alamat: string; nama?: string; aktif: boolean;
  bursa: string; usd: number; leverage: number;
  /** GLOBAL — menumpang formulir per dompet karena di situlah orangnya
   *  berada saat memikirkannya. Server menulisnya hanya kalau dikirim. */
  maksLipat?: number;
}): Promise<{ ok: boolean; pesan?: string }> {
  const t = await token();
  if (!t) return { ok: false, pesan: 'Belum masuk.' };
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet/salin`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(ubah),
    });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    return { ok: false, pesan: j.error || `Server menjawab ${r.status}` };
  } catch { return { ok: false, pesan: 'Tidak bisa menghubungi server.' }; }
}

export async function hapusSalin(alamat: string): Promise<{ ok: boolean; pesan?: string }> {
  const t = await token();
  if (!t) return { ok: false, pesan: 'Belum masuk.' };
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet/salin/${encodeURIComponent(alamat)}`,
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    return { ok: false, pesan: j.error || `Server menjawab ${r.status}` };
  } catch { return { ok: false, pesan: 'Tidak bisa menghubungi server.' }; }
}

export async function hapusDompet(alamat: string): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  try {
    const r = await fetch(`${dasar()}/api/agen/wallet/${encodeURIComponent(alamat)}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + t },
    });
    return r.ok;
  } catch { return false; }
}

/* ── PAPAN PERINGKAT ────────────────────────────────────────────────────
   Sampai sekarang satu-satunya cara menambah dompet adalah menempel alamat
   42 karakter yang harus dicari sendiri di luar. Papan peringkat menjawab
   pertanyaan yang sebenarnya: dompet mana yang layak dipantau.

   Disaring dan diurutkan DI SERVER. Papan aslinya 36 MB; yang sampai ke
   sini 40 baris yang benar-benar dibaca. */

export type JendelaPeringkat = 'day' | 'week' | 'month' | 'allTime';
/** Pita ukuran akun — dengan siapa perbandingannya dilakukan. Tidak ada
 *  pilihan urutan: papan ini SELALU diurut dari untung terbesar, satu-satunya
 *  angka dari sumber ini yang bisa dipertanggungjawabkan. */
export type PitaAkun = 'kecil' | 'menengah' | 'semua';

/** Rincian yang ditarik terpisah untuk barisan teratas saja.
 *  null = belum diperiksa, BUKAN nol. */
export interface RinciPeringkat {
  /** `entry` baru ada sejak pengayaan dua tahap; baris lama yang tersimpan
   *  sebelum itu tidak punya, jadi ia opsional dan harus dijaga saat
   *  dipakai — bukan dianggap selalu ada. */
  posisi: { koin: string; arah: 'L' | 'S'; nilai: number; pnl: number; entry?: number }[];
  jmlPosisi: number;
  /** Setoran pertama ke dompetnya — umur yang sebenarnya, bukan fill tertua. */
  lahir: number;
  wr: number | null;
  rr: number | null;
  menangRata: number;
  kalahRata: number;
  tutup: number;
  fill: number;
  terpotong: boolean;
  /** Diperiksa posisinya SAJA — WR, RR, dan umurnya tidak pernah ditarik.
   *  Bukan kekurangan data, melainkan pilihan: riwayat seratus kali lebih
   *  mahal daripada posisi, dan tidak setiap baris perlu membayarnya. */
  ringan?: boolean;
}

export interface BarisPeringkat {
  alamat: string;
  /** Nama yang dipasang pemiliknya sendiri — teks pihak lain. Ditampilkan
   *  apa adanya sebagai teks, tidak pernah lebih dari itu. */
  nama: string;
  akun: number;
  pnl: number;
  vlm: number;
  dipantau: boolean;
  rinci: RinciPeringkat | null;
}

export interface Peringkat {
  daftar: BarisPeringkat[];
  diperbarui: number;
  total: number;
  minAkun: number;
  /** Skrip penariknya belum pernah jalan — beda dengan "tidak ada yang
   *  lolos saringan", dan layar harus bisa membedakan keduanya. */
  belumAda: boolean;
}

export async function peringkatDompet(
  jendela: JendelaPeringkat, pita: PitaAkun, batas = 40,
): Promise<Peringkat | null> {
  try {
    const q = `jendela=${jendela}&pita=${pita}&batas=${batas}`;
    const r = await fetch(`${dasar()}/api/agen/wallet/peringkat?${q}`);
    if (!r.ok) return null;
    const j = await r.json();
    return {
      daftar: Array.isArray(j?.daftar) ? j.daftar : [],
      diperbarui: Number(j?.diperbarui) || 0,
      total: Number(j?.total) || 0,
      minAkun: Number(j?.minAkun) || 0,
      belumAda: !!j?.belumAda,
    };
  } catch { return null; }
}
