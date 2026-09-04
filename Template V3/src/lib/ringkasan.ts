import { useMemo } from 'react';
import { statGabungan, statPer, saldoDuaBulan, kurvaEkuitas } from '@/lib/hitung';
import { useRiwayat, useSaldoAwal } from '@/lib/data';
import { useAkunMt5, useAkunBinance } from '@/lib/akun';
import { useArusKas, arusBersih } from '@/lib/tulis-jurnal';

/* ════════════════════════════════════════════════════════════════════════
   MODEL UANG SATU AKUN — SATU HITUNGAN, BANYAK LAYAR
   ════════════════════════════════════════════════════════════════════════
   Ada karena dua layar pernah menyebut hal yang sama dengan dua angka
   berbeda, dan itu bukan kejadian sekali.

   Laporan pemiliknya: kartu di halaman depan tidak cocok dengan Dashboard.
   Ia mengimpor data contoh, Dashboard berubah, kartunya tidak. Ia menghapus
   data contohnya, Dashboard kosong, kartunya tetap di angka yang sama.

   Sebabnya lebih buruk daripada selisih hitungan: kartu itu TIDAK PERNAH
   MENGHITUNG APA PUN. Angkanya konstanta yang ditulis tangan di
   lib/pameran.ts — $1.140,50 / 57,6% / 213 transaksi — jadi tidak ada
   perbuatan apa pun di aplikasi ini yang bisa menggerakkannya.

   Yang berulang adalah polanya, dan komentar di dashboard.tsx sendiri
   mencatat dua kejadian sebelumnya: Jurnal memakai `saldoAwal + arusBersih`
   sementara Dashboard cuma `saldoAwal`, lalu Dashboard memakai hitungan
   jurnal sementara Jurnal memakai saldo broker. Dua-duanya "benar menurut
   rumusnya masing-masing", dan dua-duanya terbaca sebagai aplikasi yang
   tidak bisa dipercaya angkanya.

   Maka rumusnya dipindahkan ke SINI, satu kali. Layar tinggal menggambar.
   Layar yang menghitung sendiri adalah layar yang suatu hari menghitung
   beda — dan yang beda di sini saldo orang.

   BUKAN dipakai halaman pendaratan. Hook ini menyeret Firestore, dan
   halaman yang dibuka orang yang belum tentu masuk harus tetap bebas dari
   SDK-nya. Hero yang memakainya (glassmorphism-trust-hero) cuma tampil
   sesudah login — halaman logout punya heronya sendiri di Template.tsx.
   ════════════════════════════════════════════════════════════════════════ */

/** Tujuh angka yang muncul di kartu hero DAN diterbitkan ke halaman depan.
 *  Bentuknya sengaja sama persis dengan `RingkasanAkun` di lib/data.ts —
 *  itu yang dikirim `terbitkanRingkasan()`. */
export interface AngkaRingkas {
  saldo: number;
  jumlah: number;
  winrate: number;
  bersih: number;
  kurva: number[];
  tumbuh: number;
  /** Perubahan saldo dalam DOLAR pada jendela yang sama dengan `tumbuh`.
   *
   *  Ada karena keduanya pernah dipajang berdampingan sebagai satu angka:
   *  "+3,5%  -$150,25". Dua-duanya benar, dan justru itu masalahnya —
   *  persennya menghitung bulan berjalan, dolarnya menghitung 2.342
   *  transaksi sejak Juli. Pembacanya cuma melihat tanda plus di sebelah
   *  tanda minus dan menyimpulkan aplikasinya tidak bisa berhitung.
   *
   *  Medan ini sengaja dipertahankan meski sekarang isinya sama dengan
   *  `bersih`: ia yang MENGIKAT dolar ke persennya. Selama keduanya
   *  dihitung berdampingan di satu tempat, siapa pun yang kelak menggeser
   *  rentang `tumbuh` melihat pasangannya persis di baris berikutnya. */
  tumbuhUang: number;
  /** Transaksi paling lama; 0 kalau belum ada transaksi sama sekali. */
  sejak: number;
}

export function useRingkasanAkun() {
  const { data: RIWAYAT, contoh } = useRiwayat();
  const saldoAwal = useSaldoAwal();

  /* Setoran & penarikan ikut dihitung, persis seperti di halaman Jurnal, dan
     dibebankan ke sumbernya sendiri: setoran MT5 tidak menaikkan saldo
     kripto. */
  const { data: arus } = useArusKas();
  const arusForex = arusBersih(arus, 'forex');
  const arusKripto = arusBersih(arus, 'kripto');
  const modalTotal = saldoAwal + arusForex + arusKripto;

  const stat = statGabungan(RIWAYAT, modalTotal);
  /* Saldo awal dibebankan ke Trade-Fi SAJA. Kalau dibebankan ke keduanya ia
     terhitung dua kali, dan penjumlahan dua jurnal tidak akan pernah sama
     dengan totalnya. */
  const forex = statPer(RIWAYAT, 'forex', saldoAwal + arusForex);
  const kripto = statPer(RIWAYAT, 'kripto', arusKripto);

  const mt5 = useAkunMt5();
  const binance = useAkunBinance();

  /* Kalau brokernya tersambung, angka broker yang dipakai; kalau tidak,
     hasil hitungan jurnal.

     `saldo !== null` SAJA, bukan `terhubung === true`: EA yang offline masih
     membawa saldo laporan terakhirnya, dan angka itu tetap yang paling benar
     sampai ada transaksi baru. Syarat lama membuat saldo mundur ke hitungan
     jurnal lama tiap MT5 desktop ditutup. */
  const saldoForex = mt5.saldo !== null ? mt5.saldo : forex.saldo;
  const saldoKripto = binance.saldo !== null ? binance.saldo : kripto.saldo;
  const totalSaldo = saldoForex + saldoKripto;
  /* Nama bursanya dibaca dari `rincian`, bukan ditulis tetap 'Binance'.
     Kalimatnya dulu berbunyi "live MT5 & Binance" untuk saldo yang sudah
     memuat Hyperliquid — keterangan yang menyebut sumber lebih sedikit dari
     yang sebenarnya menghitung. Backend lama yang belum mengirim rincian
     tetap menulis 'Binance', persis seperti dulu. */
  const sumberSaldo = [
    mt5.terhubung === true ? 'MT5' : null,
    ...(binance.terhubung === true
      ? (binance.rincian?.length ? binance.rincian.map((b) => b.nama) : ['Binance'])
      : []),
  ].filter(Boolean) as string[];

  /* Kurva berangkat dari `totalSaldo` — titik jangkarnya, jadi harus dihitung
     sesudahnya. Setoran & penarikan sengaja tidak ikut: saldo broker sudah
     memuatnya, dan menambahkannya lagi sebagai peristiwa di kurva berarti
     menghitungnya dua kali. */
  const kurvaSaldo = useMemo(
    () => saldoDuaBulan(RIWAYAT, saldoAwal, [], totalSaldo),
    [RIWAYAT, saldoAwal, totalSaldo]
  );
  const titikIni = kurvaSaldo.filter((k) => k.ini !== null);
  const adaBulanLalu = kurvaSaldo.some((k) => k.lalu !== null);
  const awalKurva = titikIni[0]?.ini ?? saldoAwal;
  const akhirKurva = titikIni[titikIni.length - 1]?.ini ?? saldoAwal;
  const selisihSaldo = awalKurva ? ((akhirKurva - awalKurva) / Math.abs(awalKurva)) * 100 : 0;

  /* ── KARTU HERO BERBICARA SEUMUR AKUN ──────────────────────────────────
     `selisihSaldo` di atas tetap dipakai Dashboard, dan di sana ia benar:
     ia berdiri tepat di sebelah kurva bulan berjalan yang ia ukur.

     Kartu hero tidak. Diputuskan pemilik 4 Sep 2026 — "sesuaikan saja
     dengan persentase total return saya" — dan alasannya kuat: kartu itu
     rekam jejak, dan rekam jejak yang cuma menghitung empat hari pertama
     September memuji dirinya sendiri dengan memilih rentang. Winrate dan
     jumlah transaksi di bawahnya sudah seumur akun; persennya sekarang
     ikut.

     Penyebutnya modal — saldo awal DITAMBAH setoran/penarikan bersih —
     bukan saldo hari ini. Membaginya dengan saldo hari ini akan membuat
     akun yang rugi terlihat rugi lebih sedikit, karena penyebutnya sudah
     ikut menyusut bersama kerugiannya. */
  const returnUang = stat.bersih;
  const returnPersen = modalTotal > 0 ? (returnUang / modalTotal) * 100 : 0;

  /* Kurvanya ikut pindah rentang, bukan cuma angkanya. Angka seumur akun
     di atas grafik bulan berjalan adalah cacat yang sama dalam bentuk
     lain — pembacanya melihat garis September menanjak sambil membaca
     -11,0%, lalu mempercayai yang mana?

     Diringkas ke 60 titik: dokumen terbitannya memang dipotong segitu
     (`terbitkanRingkasan`), dan garis selebar 300 px tidak bisa
     menggambarkan 2.342 titik — ia cuma jadi lebih mahal. */
  const kurvaPenuh = useMemo(() => {
    const n = kurvaEkuitas(RIWAYAT, modalTotal).map((x) => x.nilai);
    if (n.length <= 60) return n;
    return Array.from({ length: 60 }, (_, i) => n[Math.round((i * (n.length - 1)) / 59)]);
  }, [RIWAYAT, modalTotal]);

  /* `Math.min()` tanpa argumen memulangkan Infinity, dan Infinity yang lolos
     ke layar tampil sebagai umur akun yang mustahil. Jadi daftar kosong
     dijawab 0, dan 0 berarti "belum ada", bukan "1 Januari 1970". */
  const waktuAda = RIWAYAT.map((t) => t.waktu).filter((x) => x > 0);
  const sejak = waktuAda.length ? Math.min(...waktuAda) : 0;

  /** Ada transaksi untuk dihitung. Layar memakai ini untuk memutuskan
   *  menggambar angka atau tanda pisah — 0 transaksi bukan "saldo nol",
   *  melainkan "belum ada yang bisa dikatakan". */
  const siap = RIWAYAT.length > 0;

  const angka: AngkaRingkas = useMemo(() => ({
    saldo: Number(totalSaldo.toFixed(2)),
    jumlah: stat.jumlah,
    winrate: Number((stat.winrate ?? 0).toFixed(1)),
    bersih: Number(stat.bersih.toFixed(2)),
    kurva: kurvaPenuh,
    tumbuh: Number(returnPersen.toFixed(1)),
    tumbuhUang: Number(returnUang.toFixed(2)),
    sejak,
  }), [totalSaldo, stat.jumlah, stat.winrate, stat.bersih, kurvaPenuh, returnPersen, returnUang, sejak]);

  return {
    /* Bahan mentah, supaya layar tidak memanggil hook yang sama dua kali. */
    RIWAYAT, contoh, siap, saldoAwal, arus, modalTotal,
    stat, forex, kripto,
    mt5, binance,
    saldoForex, saldoKripto, totalSaldo, sumberSaldo,
    kurvaSaldo, titikIni, adaBulanLalu, selisihSaldo, sejak,
    /* Tujuh angka siap pakai — yang digambar hero dan yang diterbitkan. */
    angka,
  };
}
