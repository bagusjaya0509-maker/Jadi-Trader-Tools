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

/** P/L per hari untuk kalender & grafik batang. */
export function plPerHari(trade: Trade[]) {
  const peta = new Map<string, number>();
  trade.forEach((t) => {
    const k = new Date(t.waktu).toISOString().slice(0, 10);
    peta.set(k, (peta.get(k) ?? 0) + t.pnl);
  });
  return peta;
}
