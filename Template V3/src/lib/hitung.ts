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

export interface Bulan {
  bulan: string; kunci: string; pnl: number; trade: number;
  /** Rincian yang menyusun `pnl`. Dashboard adalah PENJUMLAHAN dua jurnal;
   *  tanpa rinciannya, angkanya tidak bisa dicocokkan dengan kalender di
   *  halaman Jurnal yang selalu menampilkan satu jurnal saja. */
  forex: number; kripto: number;
}

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

  /* Dirinci per SUMBER, bukan cuma totalnya.
     ────────────────────────────────────────────────────────────────────
     Batang di dashboard adalah penjumlahan jurnal Trade-Fi dan Kripto,
     sementara kalender di halaman Jurnal hanya menampilkan satu jurnal.
     Keduanya benar, tapi angkanya berbeda — dan tanpa rinciannya yang
     terbaca, selisih itu terbaca sebagai "dashboardnya salah". */
  const peta = new Map<string, { pnl: number; trade: number; forex: number; kripto: number }>();
  for (const t of sah) {
    const d = new Date(t.waktu);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const p = peta.get(k) ?? { pnl: 0, trade: 0, forex: 0, kripto: 0 };
    peta.set(k, {
      pnl: p.pnl + t.pnl,
      trade: p.trade + 1,
      forex: p.forex + (t.sumber === 'forex' ? t.pnl : 0),
      kripto: p.kripto + (t.sumber === 'forex' ? 0 : t.pnl),
    });
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
      forex: Number((d?.forex ?? 0).toFixed(2)),
      kripto: Number((d?.kripto ?? 0).toFixed(2)),
    });
    bl++; if (bl > 12) { bl = 1; th++; }
  }
  return out.slice(-maksBulan);
}

export interface TitikSaldo { label: string; saldo: number }

/** Satu tanggal, dua bulan. `null` = bulan itu belum/tidak sampai tanggal ini. */
export interface TitikBanding { label: string; ini: number | null; lalu: number | null }

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

/* ════════════════════════════════════════════════════════════════════════
   SALDO BULAN INI vs BULAN LALU
   ════════════════════════════════════════════════════════════════════════
   Satu garis saja tidak menjawab pertanyaan yang sebenarnya diajukan orang
   saat melihat panel ini: "bulan ini lebih baik atau lebih buruk?" Untuk
   menjawabnya butuh pembanding, dan pembanding yang masuk akal adalah bulan
   sebelumnya pada TANGGAL YANG SAMA — tanggal 10 dibandingkan tanggal 10,
   bukan bulan penuh melawan sepuluh hari.

   Keduanya dimulai dari saldo di AWAL bulannya masing-masing, jadi yang
   dibandingkan adalah jalannya bulan, bukan tinggi saldo mutlaknya.
   ════════════════════════════════════════════════════════════════════════ */
/** Setoran/penarikan yang ikut menggerakkan saldo — bentuk minimum dari
 *  `Arus` di tulis-jurnal, ditulis di sini supaya hitung.ts tidak perlu
 *  mengimpor modul Firestore. */
export interface ArusRingkas { jenis: 'setor' | 'tarik'; nilai: number; waktu: number }

export function saldoDuaBulan(trade: Trade[], saldoAwal: number, arus: ArusRingkas[] = []): TitikBanding[] {
  const kini = new Date();
  const th = kini.getFullYear(), bl = kini.getMonth();
  const awalIni = new Date(th, bl, 1).getTime();
  const awalLalu = new Date(th, bl - 1, 1).getTime();
  const hariLalu = new Date(th, bl, 0).getDate();

  /* Top-up dan penarikan DIPERLAKUKAN SEBAGAI PERISTIWA BERTANGGAL, sama
     seperti transaksi. Menjumlahkannya sekaligus di saldo awal membuat
     setoran kemarin ikut menaikkan saldo awal bulan — dan kurvanya
     berbohong tentang kapan uangnya benar-benar masuk. */
  const peristiwa = [
    ...trade.map((t) => ({ waktu: t.waktu, nilai: t.pnl })),
    ...arus.map((a) => ({ waktu: a.waktu, nilai: a.jenis === 'setor' ? a.nilai : -a.nilai })),
  ];

  const jumlahSebelum = (batas: number) =>
    peristiwa.filter((x) => x.waktu < batas).reduce((s, x) => s + x.nilai, 0);

  const perHari = (mulai: number, selesai: number) => {
    const m = new Map<number, number>();
    for (const x of peristiwa) {
      if (x.waktu < mulai || x.waktu >= selesai) continue;
      const d = new Date(x.waktu).getDate();
      m.set(d, (m.get(d) ?? 0) + x.nilai);
    }
    return m;
  };

  const hIni = perHari(awalIni, Date.now() + 86_400_000);
  const hLalu = perHari(awalLalu, awalIni);

  let jIni = saldoAwal + jumlahSebelum(awalIni);
  let jLalu = saldoAwal + jumlahSebelum(awalLalu);

  const out: TitikBanding[] = [];
  const maks = Math.max(kini.getDate(), hLalu.size ? hariLalu : 0);
  for (let h = 1; h <= maks; h++) {
    jIni += hIni.get(h) ?? 0;
    jLalu += hLalu.get(h) ?? 0;
    out.push({
      label: String(h),
      ini: h <= kini.getDate() ? Number(jIni.toFixed(2)) : null,
      /* Bulan lalu digambar hanya kalau memang ADA transaksinya. Garis datar
         sepanjang bulan pada akun yang belum trading bukan pembanding —
         itu cuma garis yang terlihat seperti data. */
      lalu: hLalu.size && h <= hariLalu ? Number(jLalu.toFixed(2)) : null,
    });
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
