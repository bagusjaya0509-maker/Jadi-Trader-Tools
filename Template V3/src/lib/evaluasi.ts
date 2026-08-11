import type { Trade } from '@/data/contoh';

/* ════════════════════════════════════════════════════════════════════════
   EVALUASI PERFORMA — ukuran yang dipakai prop firm
   ════════════════════════════════════════════════════════════════════════
   Winrate dan P/L saja tidak menjawab pertanyaan yang menentukan lolos atau
   tidaknya seseorang di evaluasi prop firm. Yang ditanyakan justru:

     · apakah ukuran risikonya KONSISTEN, atau membesar setelah kalah
     · apakah ada hari dengan terlalu banyak transaksi (overtrading)
     · seberapa dalam penurunan terburuk dari puncak (max drawdown)
     · apakah satu trade menyumbang terlalu besar ke labanya
     · apakah setiap transaksi punya alasan tertulis
     · apakah ada balas dendam — masuk lagi cepat setelah rugi

   Semuanya DIHITUNG dari transaksi jurnal. Tidak ada satu pun angka di sini
   yang ditulis tangan; kalau jurnalnya kosong, panelnya mengatakan begitu
   alih-alih menampilkan nilai bagus yang tidak berarti apa-apa.

   Ambangnya mengikuti aturan yang lazim dipakai firma evaluasi (FTMO, MFF,
   The5ers): drawdown harian 5%, total 10%, dan konsistensi 30–40% — satu
   hari tidak boleh menyumbang lebih dari sepertiga total laba.
   ════════════════════════════════════════════════════════════════════════ */

export interface Butir {
  kunci: string;
  label: string;
  /** 0–100. Bukan persentase apa pun — ini nilai, dan cara menghitungnya
   *  berbeda tiap butir. Angka aslinya ada di `nilaiAsli`. */
  skor: number;
  nilaiAsli: string;
  ket: string;
  /** true kalau butir ini melewati ambang yang lazim dipakai prop firm. */
  lulus: boolean;
}

export interface HasilEvaluasi {
  butir: Butir[];
  skorTotal: number;
  peringkat: string;
  cukupData: boolean;
  jumlah: number;
}

const jepit = (n: number) => Math.max(0, Math.min(100, n));
const HARI = 86_400_000;

/** Kunci hari lokal. `toISOString()` memakai UTC, jadi transaksi jam 7 pagi
 *  WIB akan tercatat sebagai hari sebelumnya — dan hitungan overtrading per
 *  hari jadi salah tepat di jam paling sibuk. */
function kunciHari(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function evaluasi(trade: Trade[], saldoAwal: number): HasilEvaluasi {
  const n = trade.length;
  if (n < 5) {
    return { butir: [], skorTotal: 0, peringkat: 'Belum bisa dinilai', cukupData: false, jumlah: n };
  }

  const urut = [...trade].sort((a, b) => a.waktu - b.waktu);
  const modal = saldoAwal > 0 ? saldoAwal : Math.max(1, Math.abs(urut.reduce((s, t) => s + t.pnl, 0)) * 5);

  /* ── Konsistensi ukuran risiko ──────────────────────────────────────
     Yang diukur koefisien variasi kerugian: simpangan baku dibagi rata-rata.
     Kenapa kerugian dan bukan seluruh PnL — ukuran risiko paling jujur
     terlihat pada trade yang KALAH, karena di situ kerugiannya mendekati
     risiko yang benar-benar dipasang. Laba dipengaruhi kapan orang keluar. */
  const rugi = urut.filter((t) => t.pnl < 0).map((t) => Math.abs(t.pnl));
  let skorKonsisten = 100, ketKonsisten = 'belum ada transaksi rugi';
  let cvTeks = '—';
  if (rugi.length >= 3) {
    const rerata = rugi.reduce((s, x) => s + x, 0) / rugi.length;
    const varian = rugi.reduce((s, x) => s + (x - rerata) ** 2, 0) / rugi.length;
    const cv = rerata > 0 ? Math.sqrt(varian) / rerata : 0;
    cvTeks = `CV ${(cv * 100).toFixed(0)}%`;
    /* CV 0,3 dianggap sangat konsisten, 1,2 ke atas berantakan. */
    skorKonsisten = jepit(100 - ((cv - 0.3) / 0.9) * 100);
    ketKonsisten = cv <= 0.5 ? 'ukuran risiko stabil'
      : cv <= 0.9 ? 'ukuran risiko cukup bervariasi'
      : 'ukuran risiko berubah-ubah — tanda martingale atau balas dendam';
  }

  /* ── Overtrading ────────────────────────────────────────────────────
     Diukur dari hari tersibuk dibanding median. Rata-rata tidak dipakai:
     satu hari 30 transaksi menarik rata-ratanya naik sehingga hari itu
     sendiri terlihat wajar. */
  const perHari = new Map<string, number>();
  urut.forEach((t) => perHari.set(kunciHari(t.waktu), (perHari.get(kunciHari(t.waktu)) ?? 0) + 1));
  const hitunganHari = [...perHari.values()].sort((a, b) => a - b);
  const median = hitunganHari[Math.floor(hitunganHari.length / 2)] || 1;
  const puncak = hitunganHari[hitunganHari.length - 1] || 1;
  const rasioPuncak = puncak / Math.max(1, median);
  const skorOver = jepit(100 - (rasioPuncak - 1.5) * 40);
  const hariRamai = hitunganHari.filter((x) => x >= median * 3).length;

  /* ── Drawdown maksimum ──────────────────────────────────────────────
     Dari kurva ekuitas berjalan, bukan dari penjumlahan kerugian: yang
     penting bukan total rugi melainkan seberapa dalam turunnya dari puncak
     tertinggi yang pernah dicapai. Itulah yang membuat akun prop gugur. */
  let jalan = modal, puncakEkuitas = modal, ddTerdalam = 0;
  urut.forEach((t) => {
    jalan += t.pnl;
    puncakEkuitas = Math.max(puncakEkuitas, jalan);
    ddTerdalam = Math.max(ddTerdalam, (puncakEkuitas - jalan) / puncakEkuitas);
  });
  const ddPersen = ddTerdalam * 100;
  /* 10% adalah batas gugur yang paling umum; 5% batas "aman". */
  const skorDd = jepit(100 - (ddPersen / 10) * 100);

  /* ── Konsentrasi laba ───────────────────────────────────────────────
     Berapa persen laba kotor berasal dari SATU trade terbesar. Prop firm
     menyebutnya aturan konsistensi: kalau satu hari (atau satu trade)
     menyumbang lebih dari 30–40% laba, hasilnya dianggap keberuntungan. */
  const untung = urut.filter((t) => t.pnl > 0).map((t) => t.pnl);
  const totalUntung = untung.reduce((s, x) => s + x, 0);
  const terbesar = untung.length ? Math.max(...untung) : 0;
  const konsentrasi = totalUntung > 0 ? (terbesar / totalUntung) * 100 : 0;
  const skorKonsentrasi = jepit(100 - ((konsentrasi - 20) / 30) * 100);

  /* ── Disiplin catatan ───────────────────────────────────────────────
     Transaksi tanpa alasan tertulis tidak bisa dievaluasi sesudahnya —
     dan jurnal yang tidak bisa dievaluasi tidak melakukan apa pun. */
  const beralasan = urut.filter((t) => (t.alasan ?? '').trim().length >= 4).length;
  const persenAlasan = (beralasan / n) * 100;

  /* ── Balas dendam ───────────────────────────────────────────────────
     Masuk lagi dalam 15 menit setelah trade rugi. Bukan selalu salah, tapi
     polanya yang berulang adalah tanda pengambilan keputusan emosional —
     dan itu yang paling sering menghabiskan akun. */
  let balasDendam = 0;
  for (let i = 1; i < urut.length; i++) {
    if (urut[i - 1].pnl < 0 && urut[i].waktu - urut[i - 1].waktu < 15 * 60_000) balasDendam++;
  }
  const persenBalas = (balasDendam / Math.max(1, n - 1)) * 100;
  const skorBalas = jepit(100 - persenBalas * 4);

  const butir: Butir[] = [
    {
      kunci: 'konsistensi', label: 'Konsistensi Risiko', skor: skorKonsisten,
      nilaiAsli: cvTeks, ket: ketKonsisten, lulus: skorKonsisten >= 60,
    },
    {
      kunci: 'overtrade', label: 'Kendali Overtrading', skor: skorOver,
      nilaiAsli: `${puncak}/hari`,
      ket: hariRamai > 0
        ? `${hariRamai} hari dengan transaksi 3× lipat dari biasanya`
        : `hari tersibuk ${puncak} transaksi, biasanya ${median}`,
      lulus: skorOver >= 60,
    },
    {
      kunci: 'drawdown', label: 'Max Drawdown', skor: skorDd,
      nilaiAsli: `${ddPersen.toFixed(1)}%`,
      ket: ddPersen <= 5 ? 'di bawah batas aman 5%'
        : ddPersen <= 10 ? 'masih di bawah batas gugur 10%, tapi sudah lewat batas aman'
        : 'melewati batas gugur 10% yang dipakai kebanyakan prop firm',
      lulus: ddPersen <= 10,
    },
    {
      kunci: 'konsentrasi', label: 'Sebaran Laba', skor: skorKonsentrasi,
      nilaiAsli: `${konsentrasi.toFixed(0)}%`,
      ket: konsentrasi <= 30
        ? 'laba tersebar, tidak bergantung satu trade'
        : `satu trade menyumbang ${konsentrasi.toFixed(0)}% laba kotor — aturan konsistensi prop firm biasanya 30%`,
      lulus: konsentrasi <= 40,
    },
    {
      kunci: 'alasan', label: 'Disiplin Catatan', skor: persenAlasan,
      nilaiAsli: `${beralasan}/${n}`,
      ket: persenAlasan >= 80 ? 'hampir semua transaksi punya alasan tertulis'
        : `${n - beralasan} transaksi tanpa alasan — tidak bisa dievaluasi ulang`,
      lulus: persenAlasan >= 70,
    },
    {
      kunci: 'balas', label: 'Kendali Emosi', skor: skorBalas,
      nilaiAsli: `${balasDendam}×`,
      ket: balasDendam === 0
        ? 'tidak ada entri cepat setelah rugi'
        : `${balasDendam} kali masuk lagi <15 menit setelah rugi`,
      lulus: skorBalas >= 70,
    },
  ];

  const skorTotal = Math.round(butir.reduce((s, b) => s + b.skor, 0) / butir.length);
  const peringkat =
    skorTotal >= 85 ? 'Sangat Disiplin' :
    skorTotal >= 70 ? 'Disiplin' :
    skorTotal >= 55 ? 'Cukup — ada yang perlu dirapikan' :
    skorTotal >= 40 ? 'Rawan' : 'Berisiko Tinggi';

  return { butir, skorTotal, peringkat, cukupData: true, jumlah: n };
}

/** Rentang waktu yang bisa dipilih di panel evaluasi. */
export function saring(trade: Trade[], hari: number) {
  if (!hari) return trade;
  const batas = Date.now() - hari * HARI;
  return trade.filter((t) => t.waktu >= batas);
}
