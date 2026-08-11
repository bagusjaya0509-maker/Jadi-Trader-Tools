import { SALDO_AWAL, type Trade, type Sumber } from '@/data/contoh';

/* ════════════════════════════════════════════════════════════════════════
   SATU SUMBER PERHITUNGAN
   ════════════════════════════════════════════════════════════════════════
   Beranda, Dashboard, dan Jurnal memakai fungsi yang SAMA. Menghitung
   winrate dua kali dengan rumus terpisah adalah cara paling mudah membuat
   dua halaman menampilkan angka berbeda untuk akun yang sama — dan pengguna
   tidak punya cara tahu mana yang benar.
   ════════════════════════════════════════════════════════════════════════ */

export interface Stat {
  jumlah: number;
  menang: number;
  kalah: number;
  /** null kalau belum ada transaksi sama sekali. Bukan 0 — "0% winrate" pada
   *  akun yang belum pernah trading adalah kebohongan kecil yang membuat
   *  panelnya terlihat rusak, bukan kosong. */
  winrate: number | null;
  untung: number;
  rugi: number;
  bersih: number;
  saldo: number;
  faktorProfit: number | null;
  rerataMenang: number;
  rerataKalah: number;
}

export function statGabungan(trade: Trade[], saldoAwal = SALDO_AWAL): Stat {
  const sah = trade.filter((t) => Number.isFinite(t.pnl));
  const menang = sah.filter((t) => t.pnl > 0);
  const kalah = sah.filter((t) => t.pnl < 0);

  const untung = menang.reduce((s, t) => s + t.pnl, 0);
  const rugi = Math.abs(kalah.reduce((s, t) => s + t.pnl, 0));
  const bersih = untung - rugi;

  return {
    jumlah: sah.length,
    menang: menang.length,
    kalah: kalah.length,
    winrate: sah.length ? (menang.length / sah.length) * 100 : null,
    untung,
    rugi,
    bersih,
    saldo: saldoAwal + bersih,
    /* Tak hingga kalau belum pernah rugi. Menuliskannya "Infinity" jelas
       salah; layar yang memakainya menampilkan "∞". */
    faktorProfit: rugi > 0 ? untung / rugi : untung > 0 ? Infinity : null,
    rerataMenang: menang.length ? untung / menang.length : 0,
    rerataKalah: kalah.length ? rugi / kalah.length : 0,
  };
}

/** Statistik satu sumber saja (forex / kripto).
 *
 *  Daftar transaksinya WAJIB dioper, tidak boleh diambil dari impor contoh.
 *  Versi sebelumnya membaca `RIWAYAT` bawaan berkas ini, sehingga Dashboard
 *  menampilkan total dari data hidup tapi rincian forex/kripto dari data
 *  contoh — bagian-bagiannya tidak pernah menjumlah ke totalnya, dan tidak
 *  ada satu pun tanda di layar bahwa keduanya datang dari sumber berbeda. */
export function statPer(trade: Trade[], sumber: Sumber, saldoAwal = 0) {
  return statGabungan(trade.filter((t) => t.sumber === sumber), saldoAwal);
}

export interface TitikEkuitas { i: number; nilai: number; label: string }

/** Kurva ekuitas. Diurut menaik menurut waktu — riwayat tersimpan kadang urut
 *  terbalik, dan kurva yang digambar dari urutan salah naik-turun tanpa arti. */
export function kurvaEkuitas(trade: Trade[], saldoAwal = SALDO_AWAL): TitikEkuitas[] {
  const urut = [...trade].sort((a, b) => a.waktu - b.waktu);
  let jalan = saldoAwal;
  const titik: TitikEkuitas[] = [{ i: 0, nilai: jalan, label: 'Awal' }];
  urut.forEach((t, i) => {
    jalan += t.pnl;
    titik.push({
      i: i + 1,
      nilai: Number(jalan.toFixed(2)),
      label: new Date(t.waktu).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    });
  });
  return titik;
}

export interface Bulan { bulan: string; kunci: string; pnl: number; trade: number }

const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** P/L per bulan, dihitung dari transaksi yang benar-benar ada.
 *
 *  Sebelumnya Dashboard memakai daftar bulan yang ditulis tangan di
 *  `data/porto.ts` — Maret sampai Agustus dengan angka karangan. Akibatnya
 *  grafiknya menampilkan lima bulan riwayat untuk akun yang transaksinya
 *  baru mulai bulan ini, dan tidak ada satu pun tanda bahwa itu bukan data
 *  sungguhan.
 *
 *  Bulan yang tidak punya transaksi TIDAK dibuat-buat. Yang dikembalikan
 *  hanya rentang dari transaksi pertama sampai terakhir; bulan kosong di
 *  tengahnya tetap muncul dengan nol supaya sumbu waktunya tidak melompat,
 *  tapi bulan sebelum transaksi pertama tidak pernah ada. */
export function plPerBulan(trade: Trade[], maksBulan = 12): Bulan[] {
  const sah = trade.filter((t) => Number.isFinite(t.pnl) && t.waktu > 0);
  if (!sah.length) return [];

  const peta = new Map<string, { pnl: number; trade: number }>();
  for (const t of sah) {
    const d = new Date(t.waktu);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const p = peta.get(k) ?? { pnl: 0, trade: 0 };
    peta.set(k, { pnl: p.pnl + t.pnl, trade: p.trade + 1 });
  }

  const kunci = [...peta.keys()].sort();
  const [thA, blA] = kunci[0].split('-').map(Number);
  const [thZ, blZ] = kunci[kunci.length - 1].split('-').map(Number);

  const out: Bulan[] = [];
  for (let th = thA, bl = blA; th < thZ || (th === thZ && bl <= blZ); ) {
    const k = `${th}-${String(bl).padStart(2, '0')}`;
    const d = peta.get(k);
    out.push({
      kunci: k,
      bulan: NAMA_BULAN[bl - 1],
      pnl: Number((d?.pnl ?? 0).toFixed(2)),
      trade: d?.trade ?? 0,
    });
    bl++; if (bl > 12) { bl = 1; th++; }
  }
  return out.slice(-maksBulan);
}

export interface TitikSaldo { label: string; saldo: number }

/** Saldo harian sepanjang bulan berjalan, dari saldo awal + P/L kumulatif.
 *
 *  Menggantikan `SALDO_PER_TANGGAL` yang juga ditulis tangan. Titik hanya
 *  dibuat sampai HARI INI — menggambar sisa bulan sebagai garis datar
 *  membuat grafiknya terlihat seperti akun yang berhenti bergerak. */
export function saldoBulanIni(trade: Trade[], saldoAwal: number): TitikSaldo[] {
  const kini = new Date();
  const th = kini.getFullYear(), bl = kini.getMonth();
  const awalBulan = new Date(th, bl, 1).getTime();

  const sebelum = trade
    .filter((t) => t.waktu < awalBulan)
    .reduce((s, t) => s + t.pnl, 0);

  const perHari = new Map<number, number>();
  for (const t of trade) {
    if (t.waktu < awalBulan) continue;
    const d = new Date(t.waktu);
    if (d.getFullYear() !== th || d.getMonth() !== bl) continue;
    perHari.set(d.getDate(), (perHari.get(d.getDate()) ?? 0) + t.pnl);
  }

  const out: TitikSaldo[] = [];
  let jalan = saldoAwal + sebelum;
  for (let h = 1; h <= kini.getDate(); h++) {
    jalan += perHari.get(h) ?? 0;
    out.push({ label: String(h), saldo: Number(jalan.toFixed(2)) });
  }
  return out;
}

/** P/L per hari untuk kalender & grafik batang. */
export function plPerHari(trade: Trade[]) {
  const peta = new Map<string, number>();
  trade.forEach((t) => {
    const k = new Date(t.waktu).toISOString().slice(0, 10);
    peta.set(k, (peta.get(k) ?? 0) + t.pnl);
  });
  return peta;
}

/* ════════════════════════════════════════════════════════════════════════
   RANGKUM LAYERING
   ════════════════════════════════════════════════════════════════════════
   Akun cent dengan layering membuka puluhan order kecil pada pair yang sama,
   arah yang sama, di hari yang sama — dan itu SATU keputusan, bukan puluhan.
   Menampilkannya sebagai puluhan baris membuat tabel riwayat tidak bisa
   dibaca, dan lebih buruk: setiap ukuran yang dihitung per-transaksi
   (winrate, konsistensi risiko, overtrading) jadi mengukur jumlah layer
   alih-alih jumlah keputusan.

   Dirangkum di sisi TAMPILAN saja. Dokumen aslinya di Firestore tetap satu
   per tiket — merangkum di sumbernya berarti kehilangan kemampuan
   menelusuri kembali ke transaksi broker yang sebenarnya.
   ════════════════════════════════════════════════════════════════════════ */

export interface TradeRangkum extends Trade {
  /** Berapa transaksi asli yang menyusun baris ini. 1 = tidak dirangkum. */
  lapis: number;
}

function kunciHariLokal(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function rangkumLayering(trade: Trade[]): TradeRangkum[] {
  const peta = new Map<string, TradeRangkum>();

  for (const t of trade) {
    const k = `${t.pair}|${t.arah}|${kunciHariLokal(t.waktu)}`;
    const ada = peta.get(k);
    if (!ada) {
      peta.set(k, { ...t, lapis: 1 });
      continue;
    }
    ada.lapis += 1;
    ada.lot = Number((ada.lot + t.lot).toFixed(6));
    ada.pnl += t.pnl;
    /* Waktu yang disimpan adalah yang PALING AKHIR — layering ditutup
       bertahap, dan yang menandai selesainya keputusan itu adalah penutupan
       terakhirnya. */
    if (t.waktu > ada.waktu) ada.waktu = t.waktu;
    if (t.nilaiOrder) ada.nilaiOrder = (ada.nilaiOrder ?? 0) + t.nilaiOrder;
    /* Alasan & emosi diambil dari layer pertama yang punya — layer
       berikutnya biasanya tanpa catatan karena ia lanjutan, bukan entri
       baru. */
    if (!ada.alasan && t.alasan) ada.alasan = t.alasan;
    if (!ada.emosi && t.emosi) ada.emosi = t.emosi;
  }

  return [...peta.values()].map((x) => ({ ...x, pnl: Number(x.pnl.toFixed(2)) }));
}
