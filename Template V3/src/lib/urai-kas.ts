/* ═══════════════════════════════════════════════════════════════════════
   urai-kas.ts — mengubah ketikan biasa jadi satu baris catatan kas
   ═══════════════════════════════════════════════════════════════════════
   "beli kopi 25rb"            → keluar · 25.000 · Makan & Minum · hari ini
   "gaji masuk 5jt kemarin"    → masuk  · 5.000.000 · Gaji · kemarin
   "bayar listrik 350.000 bca" → keluar · 350.000 · Tagihan · dari Bank

   SATU BERKAS UNTUK DUA TEMPAT. Berkas ini dipakai di peramban (kotak
   "Catat otomatis" di Personal Area) DAN di VPS (bot Telegram, sebagai
   urai-kas.cjs hasil esbuild). Karena itu ia tidak boleh mengimpor apa pun
   dan tidak boleh menyentuh DOM: pengurai yang sama di dua tempat berarti
   "beli kopi 25rb" dibaca sama persis di keduanya, dan kalau ada yang
   salah baca, salahnya di satu tempat.

   ATURAN, BUKAN MODEL. Pesan kas itu pendek dan berpola: kata kerja, benda,
   angka. Aturan tetap membacanya seketika, tanpa ongkos per pesan, dan
   hasilnya bisa diuji baris per baris. Yang tidak terbaca (tidak ada angka)
   dikembalikan sebagai null — lebih baik bertanya daripada menebak jumlah
   uang orang.
   ═══════════════════════════════════════════════════════════════════════ */

export type JenisKas = 'masuk' | 'keluar';

export interface HasilUrai {
  jumlah: number;
  jenis: JenisKas;
  kategori: string;
  judul: string;
  /** YYYY-MM-DD */
  tanggal: string;
  /** Nama tempat uangnya (Bank, E-Wallet, Tunai, Kripto, Sekuritas, Emas). */
  akun?: string;
  /** rendah = angka kecil tanpa satuan yang diasumsikan ribu, atau jenis/kategori cuma bawaan. */
  yakin: 'tinggi' | 'sedang' | 'rendah';
  /** Angka polos di bawah 1000 dibaca sebagai ribuan ("kopi 25" → 25.000). */
  tebakanRibu?: boolean;
  /** Potongan kalimat yang melahirkan baris ini — untuk melacak salah baca. */
  sumber: string;
  /** Kode mata uang aslinya kalau bukan rupiah, mis. "USD". */
  mataUang?: string;
  /** Nominal dalam mata uang aslinya, sebelum dikonversi. */
  jumlahAsli?: number;
  /** Rupiah per 1 satuan mata uang asli yang dipakai saat mengonversi. */
  kurs?: number;
  /** Mata uang asing terbaca tapi kursnya tidak ada — `jumlah` BELUM dikonversi. */
  kursTakAda?: boolean;
}

/** Kurs: rupiah per 1 satuan, mis. { USD: 17628.62 }. */
export type PetaKurs = Record<string, number>;

export const KATEGORI_KELUAR = [
  'Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan', 'Rumah', 'Kesehatan',
  'Pendidikan', 'Hiburan', 'Keluarga', 'Sosial', 'Trading', 'Investasi', 'Bisnis', 'Lainnya',
] as const;

export const KATEGORI_MASUK = [
  'Gaji', 'Bonus', 'Bisnis', 'Trading', 'Investasi', 'Hadiah', 'Lainnya',
] as const;

/* Kata kunci → kategori. Urutan di dalam tiap daftar tidak penting; yang
   penting kata yang LEBIH KHUSUS jangan tenggelam oleh yang umum — karena
   itu pencocokannya memakai batas kata, bukan sekadar "mengandung".
   "isi" sendirian tidak dipakai (terlalu umum); "isi bensin" ada di sini,
   "isi pulsa" ada di Tagihan. */
const KATA_KELUAR: Array<[string, string[]]> = [
  ['Makan & Minum', ['makan', 'minum', 'kopi', 'ngopi', 'teh', 'nasi', 'ayam', 'bakso', 'mie', 'sate', 'soto', 'warung', 'warteg',
    'resto', 'restoran', 'cafe', 'kafe', 'gofood', 'grabfood', 'shopeefood', 'jajan', 'snack', 'cemilan', 'sarapan', 'siang', 'malam',
    'makanan', 'minuman', 'es', 'boba', 'roti', 'kue', 'martabak', 'seblak', 'pizza', 'burger', 'kfc', 'mcd', 'starbucks']],
  ['Transportasi', ['bensin', 'pertalite', 'pertamax', 'solar', 'bbm', 'parkir', 'tol', 'grab', 'gojek', 'gocar', 'goride', 'ojek', 'ojol',
    'taksi', 'taxi', 'bus', 'kereta', 'krl', 'mrt', 'lrt', 'tiket', 'pesawat', 'travel', 'servis', 'service', 'ban', 'oli', 'bengkel',
    'transport', 'transportasi', 'angkot', 'ongkos', 'ongkir']],
  ['Belanja', ['belanja', 'baju', 'celana', 'sepatu', 'sandal', 'tas', 'jaket', 'skincare', 'kosmetik', 'parfum', 'tokopedia', 'shopee',
    'lazada', 'tiktokshop', 'indomaret', 'alfamart', 'supermarket', 'minimarket', 'pasar', 'sayur', 'buah', 'daging', 'beras', 'telur',
    'sabun', 'sampo', 'shampo', 'odol', 'deterjen', 'tisu', 'popok', 'susu', 'hp', 'laptop', 'charger', 'headset', 'elektronik']],
  ['Tagihan', ['listrik', 'pln', 'token', 'pdam', 'air', 'internet', 'wifi', 'indihome', 'biznet', 'pulsa', 'kuota', 'paket data',
    'telkomsel', 'xl', 'indosat', 'tri', 'smartfren', 'langganan', 'netflix', 'spotify', 'youtube', 'premium', 'icloud', 'iuran',
    'bpjs', 'asuransi', 'pajak', 'pbb', 'stnk', 'tagihan', 'bulanan', 'admin', 'biaya admin']],
  ['Rumah', ['sewa', 'kos', 'kost', 'kontrakan', 'kpr', 'perabot', 'furnitur', 'renovasi', 'tukang', 'laundry', 'galon', 'gas', 'elpiji',
    'lpg', 'rumah', 'kebersihan', 'sampah', 'satpam', 'art', 'pembantu']],
  ['Kesehatan', ['dokter', 'obat', 'apotek', 'apotik', 'rumah sakit', 'rs', 'klinik', 'vitamin', 'gigi', 'periksa', 'rawat', 'lab',
    'kacamata', 'gym', 'fitness', 'olahraga', 'terapi', 'pijat', 'urut', 'sakit']],
  ['Pendidikan', ['sekolah', 'spp', 'kuliah', 'ukt', 'kursus', 'les', 'bimbel', 'buku', 'seminar', 'workshop', 'pelatihan', 'kelas',
    'sertifikasi', 'wisuda', 'seragam', 'alat tulis', 'atk']],
  ['Hiburan', ['nonton', 'bioskop', 'film', 'game', 'gim', 'konser', 'liburan', 'hotel', 'villa', 'wisata', 'hiburan', 'karaoke',
    'jalan-jalan', 'jalan jalan', 'piknik', 'camping', 'mancing', 'hobi', 'steam', 'playstation', 'ps']],
  ['Keluarga', ['orang tua', 'orangtua', 'ibu', 'bapak', 'ayah', 'mama', 'papa', 'anak', 'istri', 'suami', 'keluarga', 'mertua', 'adik',
    'kakak', 'nenek', 'kakek', 'ponakan', 'keponakan', 'kado ulang tahun', 'uang saku', 'jajan anak']],
  ['Sosial', ['zakat', 'sedekah', 'infaq', 'infak', 'donasi', 'amal', 'sumbangan', 'kondangan', 'nikahan', 'hajatan', 'takziah',
    'kado', 'traktir', 'patungan', 'arisan', 'iuran rt']],
  ['Trading', ['sl', 'stop loss', 'stoploss', 'loss', 'rugi', 'cut loss', 'cutloss', 'margin', 'futures', 'deposit', 'depo',
    'binance', 'bybit', 'okx', 'indodax', 'tokocrypto', 'mt5', 'forex', 'xau', 'lot', 'floating', 'liquidasi', 'likuidasi']],
  ['Investasi', ['saham', 'reksadana', 'reksa dana', 'emas', 'antam', 'obligasi', 'sbn', 'ori', 'sukuk', 'deposito', 'bibit', 'ajaib',
    'stockbit', 'crypto', 'kripto', 'bitcoin', 'btc', 'eth', 'ethereum', 'dca', 'nabung', 'tabungan', 'investasi', 'invest']],
  ['Bisnis', ['domain', 'hosting', 'server', 'vps', 'iklan', 'ads', 'meta ads', 'google ads', 'karyawan', 'gaji karyawan', 'supplier',
    'stok', 'stock', 'modal', 'usaha', 'toko', 'bahan baku', 'kemasan', 'packaging', 'lisensi', 'software', 'tools', 'operasional',
    'kantor', 'meeting', 'klien', 'client', 'vendor', 'freelancer', 'jasa']],
];

const KATA_MASUK: Array<[string, string[]]> = [
  ['Gaji', ['gaji', 'gajian', 'payroll', 'upah', 'honor', 'honorarium', 'slip']],
  ['Bonus', ['bonus', 'thr', 'insentif', 'tunjangan', 'lembur', 'komisi', 'reward', 'hadiah kerja']],
  ['Bisnis', ['jual', 'laku', 'terjual', 'klien', 'client', 'proyek', 'project', 'invoice', 'order', 'orderan', 'omzet', 'omset',
    'dagang', 'toko', 'usaha', 'jasa', 'lisensi', 'langganan', 'member', 'referral', 'afiliasi', 'affiliate', 'endorse', 'adsense']],
  ['Trading', ['profit', 'tp', 'take profit', 'takeprofit', 'cuan', 'withdraw', 'wd', 'tarik', 'closing', 'close', 'floating',
    'binance', 'bybit', 'mt5', 'forex', 'xau', 'futures', 'copy', 'sinyal']],
  ['Investasi', ['dividen', 'deviden', 'bunga', 'kupon', 'reksadana', 'reksa dana', 'saham', 'obligasi', 'deposito', 'staking',
    'airdrop', 'yield', 'bagi hasil']],
  ['Hadiah', ['hadiah', 'kado', 'angpao', 'angpau', 'salam tempel', 'dikasih', 'pemberian', 'hibah', 'warisan', 'giveaway', 'menang', 'undian']],
];

/* Kata kerja punya bobot dua, kata benda satu. "bayar gaji karyawan 5jt"
   memuat "gaji" (masuk) DAN "bayar" (keluar): yang memutuskan adalah
   perbuatannya, bukan bendanya. */
const KERJA_MASUK = ['terima', 'diterima', 'nerima', 'dapat', 'dapet', 'masuk', 'cair', 'dibayar', 'dikirim', 'ditransfer', 'diterima dari',
  'dari', 'jual', 'menjual', 'laku', 'menang', 'untung', 'refund', 'cashback', 'kembalian', 'dikasih', 'pemasukan', 'pendapatan', 'income'];
const BENDA_MASUK = ['gaji', 'gajian', 'bonus', 'thr', 'dividen', 'deviden', 'profit', 'cuan', 'komisi', 'honor', 'upah', 'fee',
  'bayaran', 'hadiah', 'angpao', 'omzet', 'omset', 'invoice', 'withdraw', 'wd', 'bunga', 'kupon', 'airdrop', 'staking'];
const KERJA_KELUAR = ['beli', 'membeli', 'bayar', 'byr', 'membayar', 'belanja', 'nyicil', 'cicil', 'kirim', 'transfer ke', 'tf ke',
  'sedekah', 'donasi', 'zakat', 'traktir', 'top up', 'topup', 'isi', 'sewa', 'servis', 'service', 'langganan', 'keluar', 'pengeluaran',
  'habis', 'ngopi', 'makan', 'minum', 'jajan', 'nonton', 'main', 'rugi', 'loss', 'kena', 'denda', 'potong', 'dipotong', 'biaya'];
const BENDA_KELUAR = ['kopi', 'bensin', 'parkir', 'tol', 'listrik', 'pulsa', 'kuota', 'tagihan', 'cicilan', 'angsuran', 'kos', 'kontrakan',
  'obat', 'dokter', 'spp', 'tiket', 'hotel', 'baju', 'sepatu', 'iuran', 'pajak', 'ongkir', 'sl', 'stop loss'];

/* ── MATA UANG ──────────────────────────────────────────────────────────
   Diminta pemilik 9 Sep 2026: "400 dollar" harus terbaca dan dikonversi ke
   rupiah. Yang dikenali kode ISO-nya plus sebutan sehari-hari dalam bahasa
   Indonesia — orang menulis "400 dollar" atau "rm 50", bukan "USD 400.00".

   KURSNYA DATANG DARI LUAR, tidak pernah ditanam di sini. Berkas ini
   dipakai peramban dan server; kalau ia memegang angka kursnya sendiri,
   dua tempat itu bisa memakai kurs berbeda untuk pesan yang sama. Pemanggil
   yang menyediakan lewat argumen `kurs`. Tanpa kurs, mata uangnya tetap
   dikenali dan ditandai `kursTakAda` — jumlahnya TIDAK dikarang. */
const SIMBOL: Record<string, string> = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₩': 'KRW', '₹': 'INR', '฿': 'THB', '₫': 'VND' };

const MATA_UANG: Array<[string, string[]]> = [
  ['IDR', ['rp', 'idr', 'rupiah', 'perak']],
  ['USD', ['usd', 'dollar', 'dolar', 'us$', 'usd$', 'dolar as', 'dollar as', 'dolar amerika']],
  ['SGD', ['sgd', 's$', 'dolar singapura', 'dollar singapura']],
  ['MYR', ['myr', 'rm', 'ringgit']],
  ['EUR', ['eur', 'euro']],
  ['GBP', ['gbp', 'pound', 'poundsterling', 'pound sterling']],
  ['JPY', ['jpy', 'yen']],
  ['CNY', ['cny', 'rmb', 'yuan', 'renminbi']],
  ['AUD', ['aud', 'a$', 'dolar australia', 'dollar australia']],
  ['KRW', ['krw', 'won']],
  ['THB', ['thb', 'baht']],
  ['SAR', ['sar', 'riyal', 'real saudi']],
  ['AED', ['aed', 'dirham']],
  ['INR', ['inr', 'rupee']],
  ['HKD', ['hkd', 'dolar hongkong', 'dolar hong kong']],
  ['PHP', ['php', 'peso']],
  ['VND', ['vnd', 'dong']],
  ['TRY', ['try', 'lira']],
  ['CHF', ['chf', 'franc']],
  ['CAD', ['cad', 'dolar kanada', 'dollar kanada']],
  ['NZD', ['nzd']], ['TWD', ['twd']], ['BND', ['bnd']], ['PKR', ['pkr']], ['BDT', ['bdt']],
  ['EGP', ['egp']], ['QAR', ['qar']], ['KWD', ['kwd', 'dinar']], ['ZAR', ['zar', 'rand']],
  ['RUB', ['rub', 'rubel']], ['BRL', ['brl']],
];

/* Semua sebutan mata uang, untuk dibuang dari keterangan. */
const KATA_UANG = new Set(MATA_UANG.flatMap(([, a]) => a).flatMap((a) => a.split(' ')));

function mataUangDekat(teks: string, mulai: number, akhir: number): string | undefined {
  const depan = teks.slice(Math.max(0, mulai - 16), mulai);
  const belakang = teks.slice(akhir, akhir + 18);
  const simD = depan.match(/([$€£¥₩₹฿₫])\s*$/);
  if (simD) return SIMBOL[simD[1]];
  const simB = belakang.match(/^\s*([$€£¥₩₹฿₫])/);
  if (simB) return SIMBOL[simB[1]];
  for (const [kode, alias] of MATA_UANG) {
    for (const a of alias) {
      const e = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      /* Sesudah angka lebih diutamakan karena itu urutan bahasa Indonesia
         ("400 dollar"); sebelum angka untuk gaya "USD 400" dan "$400". */
      if (new RegExp('^\\s*' + e + '(?=$|[^a-z0-9])', 'i').test(belakang)) return kode;
      if (new RegExp('(^|[^a-z0-9])' + e + '\\s*$', 'i').test(depan)) return kode;
    }
  }
  return undefined;
}

const AKUN: Array<[string, string[]]> = [
  ['Bank', ['bca', 'bni', 'bri', 'mandiri', 'btn', 'cimb', 'permata', 'danamon', 'jago', 'jenius', 'seabank', 'blu', 'neo', 'bank',
    'rekening', 'rek', 'atm', 'debit', 'kartu kredit', 'cc', 'qris bank']],
  ['E-Wallet', ['gopay', 'ovo', 'dana', 'shopeepay', 'linkaja', 'link aja', 'e-wallet', 'ewallet', 'dompet digital', 'qris', 'paylater',
    'spaylater', 'gopaylater', 'kredivo', 'akulaku']],
  ['Tunai', ['cash', 'tunai', 'kas', 'uang tunai', 'dompet']],
  ['Kripto', ['binance', 'bybit', 'okx', 'indodax', 'tokocrypto', 'pintu', 'usdt', 'wallet', 'metamask', 'hyperliquid', 'kripto', 'crypto']],
  ['Sekuritas', ['ajaib', 'stockbit', 'bibit', 'sekuritas', 'rdn', 'mirae', 'ipot', 'indopremier', 'mnc']],
  ['Emas', ['antam', 'pegadaian', 'emas fisik', 'logam mulia', 'tabungan emas']],
];

/* ── Angka ─────────────────────────────────────────────────────────────
   Bentuk yang harus terbaca: 25rb · 25k · 25 ribu · 1,5jt · 1.5jt · 2 juta
   · 150000 · 150.000 · Rp 25.000 · 1.500.000 · 1jt5 (tidak) · 25 (→ 25rb,
   ditandai tebakan). Titik sebagai pemisah ribuan hanya kalau kelompoknya
   tiga digit; selain itu titik dan koma sama-sama desimal. */
const SATUAN: Array<[RegExp, number]> = [
  [/^(rb|ribu|k|rebu)$/i, 1e3],
  [/^(jt|juta|jto|jeti|m)$/i, 1e6],
  [/^(miliar|milyar|b)$/i, 1e9],
  [/^(t|triliun|trilyun)$/i, 1e12],
];

interface Angka { nilai: number; mulai: number; akhir: number; bersatuan: boolean; polos: boolean }

function bacaAngka(teks: string): Angka[] {
  const hasil: Angka[] = [];
  const re = /(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(rb|ribu|rebu|k|jt|juta|jto|jeti|m|miliar|milyar|b|t|triliun|trilyun)?(?![a-z0-9])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(teks))) {
    const mentah = m[1];
    const satuan = m[2] || '';
    let n: number;
    if (/^\d{1,3}(\.\d{3})+$/.test(mentah)) n = Number(mentah.replace(/\./g, ''));
    else n = Number(mentah.replace(',', '.'));
    if (!Number.isFinite(n)) continue;
    let kali = 1;
    for (const [pola, k] of SATUAN) if (satuan && pola.test(satuan)) { kali = k; break; }
    /* "5/9" atau "5-9" adalah tanggal, bukan jumlah — dilewati di sini dan
       dibaca oleh pembaca tanggal. */
    const sesudah = teks.slice(m.index + m[0].length, m.index + m[0].length + 1);
    const sebelum = teks.slice(Math.max(0, m.index - 1), m.index);
    if (!satuan && (/[/-]/.test(sesudah) || /[/-]/.test(sebelum))) continue;
    hasil.push({
      nilai: Math.round(n * kali), mulai: m.index, akhir: m.index + m[0].length,
      bersatuan: !!satuan || /^\d{1,3}(\.\d{3})+$/.test(mentah) || /^rp/i.test(m[0]),
      polos: !satuan && n < 1000 && !/^\d{1,3}(\.\d{3})+$/.test(mentah),
    });
  }
  return hasil;
}

/* Jumlah = angka yang paling "terlihat seperti uang": bersatuan dulu, lalu
   yang ≥ 1000, lalu terakhir angka polos kecil yang diasumsikan ribuan.
   Kalau ada dua yang setara ("2 kopi 25rb"), yang bersatuan menang; kalau
   sama-sama polos ("2 kopi 25"), yang TERAKHIR dianggap harganya. */
function pilihJumlah(daftar: Angka[]): { angka: Angka; tebakanRibu: boolean } | null {
  if (!daftar.length) return null;
  const bersatuan = daftar.filter((a) => a.bersatuan);
  if (bersatuan.length) return { angka: bersatuan[bersatuan.length - 1], tebakanRibu: false };
  const besar = daftar.filter((a) => a.nilai >= 1000);
  if (besar.length) return { angka: besar[besar.length - 1], tebakanRibu: false };
  /* Nilainya TIDAK dikalikan seribu di sini. Tebakan itu hanya berlaku untuk
     rupiah; "400 dollar" berarti empat ratus dolar, bukan empat ratus ribu.
     Yang tahu ada mata uang asing atau tidak adalah pemanggilnya. */
  return { angka: daftar[daftar.length - 1], tebakanRibu: true };
}

/* ── Tanggal ───────────────────────────────────────────────────────────── */
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
const BULAN_NAMA = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];

function bacaTanggal(teks: string, hariIni: Date): { tanggal: string; potong: RegExp[] } {
  const t = teks.toLowerCase();
  const potong: RegExp[] = [];
  const d = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
  let m: RegExpMatchArray | null;
  if (/\bkemarin lusa\b/.test(t)) { d.setDate(d.getDate() - 2); potong.push(/\bkemarin lusa\b/i); }
  else if (/\bkemarin\b|\bkmrn\b/.test(t)) { d.setDate(d.getDate() - 1); potong.push(/\bkemarin\b|\bkmrn\b/i); }
  else if ((m = t.match(/\b(\d{1,2})\s*hari\s*(yang\s*)?lalu\b/))) { d.setDate(d.getDate() - Number(m[1])); potong.push(/\b\d{1,2}\s*hari\s*(yang\s*)?lalu\b/i); }
  else if ((m = t.match(/\b(?:tgl|tanggal)\.?\s*(\d{1,2})(?:\s*(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)[a-z]*)?\b/))) {
    d.setDate(Number(m[1]));
    if (m[2]) d.setMonth(BULAN_NAMA.indexOf(m[2]));
    potong.push(/\b(?:tgl|tanggal)\.?\s*\d{1,2}(?:\s*(?:jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)[a-z]*)?\b/i);
  }
  else if ((m = t.match(/(?:^|\s)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?=\s|$)/))) {
    d.setMonth(Number(m[2]) - 1, Number(m[1]));
    if (m[3]) d.setFullYear(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]));
    potong.push(/(?:^|\s)\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?(?=\s|$)/i);
  }
  else if (/\btadi (pagi|siang|sore|malam)\b|\bhari ini\b|\bbarusan\b/.test(t)) { potong.push(/\btadi (pagi|siang|sore|malam)\b|\bhari ini\b|\bbarusan\b/i); }
  /* Tanggal di masa depan bukan catatan kas — itu rencana. Dikembalikan ke hari ini. */
  if (d.getTime() > hariIni.getTime() + 86400000) return { tanggal: ymd(hariIni), potong };
  return { tanggal: ymd(d), potong };
}

/* ── Pencocokan kata dengan batas kata ─────────────────────────────────── */
function ada(t: string, kata: string): boolean {
  const k = kata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + k + '(?=$|[^a-z0-9])', 'i').test(t);
}
function skor(t: string, daftar: string[]): number {
  let s = 0; for (const k of daftar) if (ada(t, k)) s += k.includes(' ') ? 2 : 1; return s;
}
function cariKategori(t: string, peta: Array<[string, string[]]>): string | null {
  let terbaik: string | null = null, nilai = 0;
  for (const [kategori, kata] of peta) {
    const s = skor(t, kata);
    if (s > nilai) { nilai = s; terbaik = kategori; }
  }
  return terbaik;
}

/* ── Keterangan: kata DI SEKITAR angkanya, bukan seluruh kalimat ────────
   Pemilik, 9 Sep 2026: "keterangannya jangan diisi [seluruh pesan], nanti
   kalau panjangnya satu halaman masa mau ditulis semua."

   Yang dipakai kata SEBELUM angkanya, karena begitulah bahasa Indonesia
   menyusunnya: benda dulu, harga belakangan ("listrik 100k", "cat rumah
   28k"). Ekor sesudah angka hampir selalu kalimat lain — di pesan yang
   memicu perbaikan ini, ekornya "bantu sya catat di web", yang bukan nama
   pengeluaran apa pun. Kalau di depan tidak ada apa-apa ("25rb kopi"),
   barulah dilihat ke belakang.

   Maksimal tiga kata: cukup untuk mengenali, terlalu pendek untuk jadi
   paragraf di kolom tabel. */
const KATA_BUANG = new Set([
  'rp', 'sebesar', 'sejumlah', 'total', 'harga', 'seharga', 'senilai', 'untuk', 'buat', 'utk',
  'dgn', 'dengan', 'pakai', 'pake', 'via', 'lewat', 'dari', 'ke', 'di', 'tadi', 'barusan',
  'saya', 'sya', 'aku', 'gw', 'gue', 'ane', 'sudah', 'udah', 'uda', 'td', 'nih', 'dong', 'ya',
  'yg', 'yang', 'bantu', 'tolong', 'mohon', 'catat', 'catet', 'web', 'itu', 'ini', 'juga',
  'lagi', 'aja', 'saja', 'sama', 'dan', 'lalu', 'terus', 'kemudian', 'habis', 'abis',
]);

function judulRingkas(sebelum: string, sesudah: string): string {
  const ambil = (teks: string, dariBelakang: boolean) => {
    const kata = teks.replace(/[^\p{L}\p{N}&/'-]+/gu, ' ').split(/\s+/).filter(Boolean)
      .filter((k) => !KATA_BUANG.has(k.toLowerCase()) && !KATA_UANG.has(k.toLowerCase()));
    if (!kata.length) return '';
    const potong = dariBelakang ? kata.slice(-3) : kata.slice(0, 3);
    return potong.join(' ').slice(0, 40).trim();
  };
  const j = ambil(sebelum, true) || ambil(sesudah, false);
  return j ? j.charAt(0).toUpperCase() + j.slice(1) : '';
}

/* ── Memecah satu pesan jadi beberapa catatan ───────────────────────────
   Pemicunya pesan nyata pemilik 9 Sep 2026:
     "Sya beli listrik 100k, makan 250k, cat rumah 28k, bensin 120k …"
   Versi pertama membaca SATU angka saja (yang terakhir) dan mencatat
   Rp120.000 — padahal isinya empat pengeluaran, Rp498.000.

   Kesalahannya bukan di pemilihan angka, melainkan di anggapan bahwa satu
   pesan berarti satu catatan. Orang menulis belanjaan sekaligus; itu cara
   normal, bukan penyalahgunaan.

   Pemecahannya dua tahap. Pertama tanda pemisah yang memang berarti "lalu"
   — koma, titik koma, plus, kata "dan/lalu/terus". Kalau sesudah itu masih
   ada penggal yang memuat lebih dari satu angka ("listrik 100k makan 250k"
   tanpa koma), penggal itu dipotong lagi di batas tiap angka.

   Yang TIDAK dipecah: pesan yang seluruhnya cuma punya satu angka. Di sana
   koma justru bisa memisahkan nama dari harganya ("beli kopi, 25rb"), dan
   memecahnya akan membuang namanya. */
const PEMISAH = /\s*[,;]\s*|\s+\+\s+|\s+(?:dan|lalu|terus|kemudian)\s+/i;

function pecahSegmen(teks: string): string[] {
  const hasil: string[] = [];
  for (const bagian of teks.split(PEMISAH)) {
    const b = (bagian || '').trim();
    if (!b) continue;
    const angka = bacaAngka(b);
    if (angka.length <= 1) { hasil.push(b); continue; }
    /* Tiap angka membawa kata di depannya sampai batas angka sebelumnya. */
    let mulai = 0;
    for (const a of angka) { hasil.push(b.slice(mulai, a.akhir).trim()); mulai = a.akhir; }
  }
  return hasil.filter(Boolean);
}

/* Satu segmen -> satu catatan. `penuh` dipakai untuk hal yang dinyatakan
   sekali untuk seluruh pesan: arah (masuk/keluar) dan nama akun. Kategori
   TIDAK ikut jatuh ke pesan penuh — kalau ikut, "cat rumah 28k" di dalam
   pesan yang memuat kata "makan" akan tercatat sebagai Makan & Minum,
   persis salah baca yang dilaporkan. */
function uraiSatu(segmen: string, tanggal: string, penuh: string, kurs?: PetaKurs): HasilUrai | null {
  const angka = bacaAngka(segmen);
  const pilihan = pilihJumlah(angka);
  if (!pilihan || pilihan.angka.nilai <= 0) return null;
  const { angka: jumlah } = pilihan;

  /* ── Mata uang ─────────────────────────────────────────────────────────
     Kalau ada mata uang asing yang jelas disebut, tebakan "angka kecil
     berarti ribuan" tidak berlaku lagi: yang menandai besaran adalah mata
     uangnya, bukan kebiasaan menulis rupiah. */
  const uang = mataUangDekat(segmen, jumlah.mulai, jumlah.akhir);
  const asing = !!uang && uang !== 'IDR';
  const tebakanRibu = pilihan.tebakanRibu && !asing;

  let nilai = tebakanRibu ? jumlah.nilai * 1000 : jumlah.nilai;
  let jumlahAsli: number | undefined, kursDipakai: number | undefined, kursTakAda = false;
  if (asing) {
    const k = kurs && kurs[uang!];
    jumlahAsli = nilai;
    if (k && k > 0) { kursDipakai = k; nilai = Math.round(nilai * k); }
    else kursTakAda = true;   /* jumlahnya dibiarkan apa adanya, bukan dikarang */
  }
  if (nilai > 1e11) return null;   /* >100 miliar: pasti salah ketik nol */

  const t = segmen.toLowerCase(), tp = penuh.toLowerCase();
  const arah = (teks: string) => ({
    masuk: 2 * skor(teks, KERJA_MASUK) + skor(teks, BENDA_MASUK),
    keluar: 2 * skor(teks, KERJA_KELUAR) + skor(teks, BENDA_KELUAR),
  });
  let n = arah(t);
  let jenisYakin = n.masuk !== n.keluar;
  if (!jenisYakin) { const np = arah(tp); if (np.masuk !== np.keluar) { n = np; jenisYakin = true; } }
  /* Seri tetap berarti keluar: catatan harian didominasi pengeluaran, dan
     salah arah pada pemasukan lebih mudah terlihat (angka hijau di tempat
     yang salah) daripada sebaliknya. */
  const jenis: JenisKas = n.masuk > n.keluar ? 'masuk' : 'keluar';

  const kategoriTebak = cariKategori(t, jenis === 'masuk' ? KATA_MASUK : KATA_KELUAR);
  const kategori = kategoriTebak || 'Lainnya';

  let akun: string | undefined;
  for (const [nama, kata] of AKUN) if (skor(t, kata)) { akun = nama; break; }
  if (!akun) for (const [nama, kata] of AKUN) if (skor(tp, kata)) { akun = nama; break; }

  let sebelum = segmen.slice(0, jumlah.mulai);
  let sesudah = segmen.slice(jumlah.akhir);
  if (akun) {
    const pola = new RegExp('\\b(' + AKUN.find((a) => a[0] === akun)![1].join('|') + ')\\b', 'gi');
    sebelum = sebelum.replace(pola, ' '); sesudah = sesudah.replace(pola, ' ');
  }
  const judul = judulRingkas(sebelum, sesudah) || kategori;

  const yakin: HasilUrai['yakin'] = (tebakanRibu || kursTakAda) ? 'rendah' : (jenisYakin && kategoriTebak) ? 'tinggi' : 'sedang';
  const hasil: HasilUrai = { jumlah: nilai, jenis, kategori, judul, tanggal, yakin, sumber: segmen.slice(0, 200) };
  if (akun) hasil.akun = akun;
  if (tebakanRibu) hasil.tebakanRibu = true;
  if (asing) {
    hasil.mataUang = uang;
    hasil.jumlahAsli = jumlahAsli;
    if (kursDipakai) hasil.kurs = kursDipakai;
    if (kursTakAda) hasil.kursTakAda = true;
  }
  return hasil;
}

/** Urai satu pesan jadi SEMUA catatan yang ada di dalamnya (bisa lebih dari satu). */
export function uraiSemua(teks: string, hariIni: Date = new Date(), kurs?: PetaKurs): HasilUrai[] {
  const asli = String(teks || '').replace(/\s+/g, ' ').trim();
  if (!asli) return [];
  /* Tanggal dibaca sekali untuk seluruh pesan: "kemarin beli A 10rb, B 20rb"
     berarti keduanya kemarin. */
  const { tanggal, potong } = bacaTanggal(asli.toLowerCase(), hariIni);
  let sisa = asli;
  for (const p of potong) sisa = sisa.replace(p, ' ');

  const segmen = bacaAngka(sisa).length > 1 ? pecahSegmen(sisa) : [sisa];
  const hasil: HasilUrai[] = [];
  for (const sg of segmen) {
    const h = uraiSatu(sg, tanggal, sisa, kurs);
    if (h) hasil.push(h);
  }
  return hasil;
}

/** Urai satu baris, ambil catatan pertamanya saja. Null kalau tidak ada angka. */
export function uraiKas(teks: string, hariIni: Date = new Date(), kurs?: PetaKurs): HasilUrai | null {
  return uraiSemua(teks, hariIni, kurs)[0] || null;
}

/** Urai tempelan banyak baris. Baris tanpa angka dilewati dan dilaporkan. */
export function uraiBanyak(teks: string, hariIni: Date = new Date(), kurs?: PetaKurs): { hasil: HasilUrai[]; gagal: string[] } {
  const hasil: HasilUrai[] = [], gagal: string[] = [];
  for (const baris of String(teks || '').split(/\r?\n/)) {
    const b = baris.trim(); if (!b) continue;
    const h = uraiSemua(b, hariIni, kurs);
    if (h.length) hasil.push(...h); else gagal.push(b);
  }
  return { hasil, gagal };
}

/* ── KURS CADANGAN ──────────────────────────────────────────────────────
   Dipakai HANYA kalau kurs hidup tidak bisa diambil. Angkanya diambil dari
   open.er-api.com 9 Sep 2026, dan ia akan menua — karena itu pemakainya
   wajib menandai hasilnya sebagai perkiraan, bukan menyamakannya dengan
   kurs hari ini. Lebih baik angka yang meleset beberapa persen dengan
   keterangan jujur daripada catatan yang gagal tersimpan sama sekali. */
export const KURS_CADANGAN: PetaKurs = {
  USD: 17628.62, SGD: 13936.71, MYR: 4340.81, EUR: 20491.74, GBP: 23872.39, JPY: 114.61,
  CNY: 2620.09, AUD: 12724.38, KRW: 13.15, THB: 535.82, SAR: 4700.96, AED: 4800.17,
  INR: 185.87, HKD: 2248.18, PHP: 281.86, VND: 0.68, TRY: 363.71, CHF: 21774.21,
  CAD: 12788.58, NZD: 10321.17, TWD: 559.62, BND: 13936.44, PKR: 63.52, BDT: 143.49,
  EGP: 345.51, QAR: 4843.03, KWD: 57130.41, ZAR: 1101.78, RUB: 203.99, BRL: 3455.18,
};

/** "400 USD" — nominal asli, untuk ditampilkan di sebelah hasil konversinya. */
export function labelAsing(h: HasilUrai): string {
  if (!h.mataUang || h.jumlahAsli == null) return '';
  const n = h.jumlahAsli;
  return (Number.isInteger(n) ? n.toLocaleString('id-ID') : String(n)) + ' ' + h.mataUang;
}

export function rupiahKas(n: number): string {
  return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}
