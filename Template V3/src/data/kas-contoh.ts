/* ═══════════════════════════════════════════════════════════════════════
   kas-contoh.ts — Catatan Kas CONTOH untuk Personal Area
   ═══════════════════════════════════════════════════════════════════════
   Diminta pemilik 3 Okt 2026: di mode preview setiap panel Personal Area
   berisi lengkap setahun penuh. Catatan Kas dan grafik Cash Flow Bulanan
   adalah dua yang tersisa kosong — pengunjung cuma melihat "Belum ada
   catatan kas", persis di panel yang paling mudah dipahami gunanya.

   ── TIDAK PERNAH MENYENTUH FIRESTORE ──────────────────────────────────
   Berkas ini cuma memulangkan larik. Yang menulis ke `users/{uid}/porto/
   arus` adalah `tambah`/`hapus` di lib/kas.ts, dan keduanya membaca
   dokumen ASLI di dalam transaksi Firestore — mereka tidak pernah diberi
   daftar yang sedang tampil. Jadi baris contoh tidak punya jalan masuk ke
   akun siapa pun, termasuk saat orangnya mencatat pengeluaran pertamanya
   sementara contohnya masih di layar.

   Yang memutuskan KAPAN contoh ini tampil adalah pemanggilnya (Personal
   Area): hanya selama porto-nya sendiri juga masih contoh DAN catatan kas
   aslinya kosong. Lihat `PanelKas`.

   ── DETERMINISTIK PER BULAN ───────────────────────────────────────────
   Benihnya tahun-bulan (202610), jadi Maret selalu berisi baris yang sama.
   Bulan berjalan dibangkitkan utuh lalu dipotong di hari ini — catatan
   kas bertanggal lusa ketahuan karangan dalam sekali lihat.

   Angkanya bukan angka bulat dan bukan akun yang selalu surplus besar:
   ada bulan yang selisihnya tipis karena servis motor atau tiket pulang
   kampung. Catatan kas yang isinya rapi sempurna tidak memperlihatkan
   kenapa orang perlu mencatat.
   ═══════════════════════════════════════════════════════════════════════ */
import type { BarisKas, Dicatat } from '@/lib/kas';
import { acakBerbenih } from '@/data/contoh';

/* Kurs yang "dipakai waktu itu" untuk baris berdolar. Disimpan di barisnya,
   sama seperti catatan sungguhan — supaya label "39 USD" di tabel punya
   angka rupiah yang bisa dihitung ulang. */
const KURS_USD = 17_600;

const dua = (n: number) => String(n).padStart(2, '0');
const antara = (r: () => number, a: number, b: number, kelipatan = 500) =>
  Math.round((a + r() * (b - a)) / kelipatan) * kelipatan;

const MAKAN: [string, number, number][] = [
  ['Makan siang', 22_000, 48_000], ['Kopi', 18_000, 38_000], ['Makan malam', 45_000, 120_000],
  ['Sarapan', 12_000, 25_000], ['Jajan sore', 10_000, 30_000],
];
const TAK_RUTIN: [string, string, number, number][] = [
  ['Servis motor', 'Transportasi', 350_000, 650_000],
  ['Sepatu lari', 'Belanja', 450_000, 800_000],
  ['Periksa dokter', 'Kesehatan', 250_000, 420_000],
  ['Tiket pulang kampung', 'Transportasi', 900_000, 1_600_000],
  ['Kursus online', 'Pendidikan', 299_000, 499_000],
];

export function buatKasContoh(kini: Date = new Date()): BarisKas[] {
  const out: BarisKas[] = [];
  const hariIni = `${kini.getFullYear()}-${dua(kini.getMonth() + 1)}-${dua(kini.getDate())}`;

  /* Dua belas bulan penuh + bulan berjalan. */
  for (let mundur = 12; mundur >= 0; mundur--) {
    const awal = new Date(kini.getFullYear(), kini.getMonth() - mundur, 1);
    const th = awal.getFullYear(), bl = awal.getMonth();
    const jmlHari = new Date(th, bl + 1, 0).getDate();
    const r = acakBerbenih(th * 100 + bl + 1);
    let n = 0;

    const catat = (
      hari: number, jenis: BarisKas['jenis'], jumlah: number, kategori: string, judul: string,
      lain: Partial<BarisKas> = {},
    ) => {
      /* Dari mana barisnya "dicatat" ikut bervariasi — tabelnya menandai
         yang lewat Telegram, dan contoh yang semuanya manual menyembunyikan
         fitur itu. */
      const x = r();
      const dicatat: Dicatat = x < 0.5 ? 'otomatis' : x < 0.85 ? 'telegram' : 'manual';
      out.push({
        id: `kc-${th}${dua(bl + 1)}-${dua(n++)}`,
        tanggal: `${th}-${dua(bl + 1)}-${dua(Math.min(hari, jmlHari))}`,
        jenis, jumlah: Math.round(jumlah), kategori, judul, dicatat, ...lain,
      });
    };

    /* ── Yang datang tiap bulan ── */
    catat(1, 'masuk', 9_200_000, 'Gaji', 'Gaji bulanan', { akun: 'Bank' });
    catat(1, 'keluar', 2_500_000, 'Rumah', 'Sewa rumah', { akun: 'Bank' });
    catat(2 + Math.floor(r() * 3), 'keluar', antara(r, 640_000, 910_000), 'Belanja', 'Belanja bulanan', { akun: 'E-Wallet' });
    catat(4 + Math.floor(r() * 3), 'keluar', antara(r, 365_000, 525_000), 'Tagihan', 'Listrik', { akun: 'Bank' });
    catat(10, 'keluar', 385_000, 'Tagihan', 'Internet rumah', { akun: 'Bank' });
    catat(12, 'keluar', 39 * KURS_USD, 'Bisnis', 'Sewa server', {
      akun: 'Bank', mataUang: 'USD', jumlahAsli: 39, kurs: KURS_USD, teks: 'bayar server 39 usd',
    });
    catat(15 + Math.floor(r() * 4), 'keluar', r() < 0.5 ? 100_000 : 150_000, 'Tagihan', 'Pulsa & paket data', { akun: 'E-Wallet' });
    catat(18, 'keluar', 54_990, 'Hiburan', 'Langganan streaming', { akun: 'E-Wallet' });
    catat(26, 'keluar', 1_000_000, 'Keluarga', 'Kirim ke orang tua', { akun: 'Bank' });
    catat(27, 'keluar', 1_000_000, 'Investasi', 'Reksa dana rutin', { akun: 'Sekuritas' });

    /* ── Yang datang sesekali ── */
    if (r() < 0.5) catat(8 + Math.floor(r() * 12), 'masuk', antara(r, 1_200_000, 3_400_000, 50_000), 'Bisnis', 'Proyek sampingan', { akun: 'Bank' });
    if (r() < 0.4) catat(5 + Math.floor(r() * 5), 'masuk', antara(r, 800_000, 2_200_000, 50_000), 'Trading', 'Tarik profit trading', { akun: 'Bank' });
    if (bl === 2) catat(14, 'masuk', 9_200_000, 'Bonus', 'THR', { akun: 'Bank' });
    if (bl === 11) catat(20, 'masuk', 4_600_000, 'Bonus', 'Bonus akhir tahun', { akun: 'Bank' });
    if (r() < 0.35) {
      const [judul, kategori, a, b] = TAK_RUTIN[Math.floor(r() * TAK_RUTIN.length)];
      catat(6 + Math.floor(r() * 20), 'keluar', antara(r, a, b, 1_000), kategori, judul);
    }
    if (r() < 0.45) catat(7 + Math.floor(r() * 20), 'keluar', [100_000, 150_000, 200_000][Math.floor(r() * 3)], 'Sosial', 'Kondangan', { akun: 'Tunai' });
    if (r() < 0.5) catat(9 + Math.floor(r() * 18), 'keluar', antara(r, 80_000, 140_000, 1_000), 'Hiburan', 'Nonton bioskop', { akun: 'E-Wallet' });
    if (r() < 0.4) catat(3 + Math.floor(r() * 24), 'keluar', antara(r, 60_000, 160_000, 1_000), 'Kesehatan', 'Obat & vitamin');

    /* ── Yang kecil-kecil, dibangkitkan PER HARI ──
       Supaya awal bulan pun sudah berisi beberapa baris: daftar yang baru
       punya dua baris di tanggal 3 terbaca seperti panel yang belum jadi. */
    for (let hari = 1; hari <= jmlHari; hari++) {
      if (r() < 0.34) {
        const [judul, a, b] = MAKAN[Math.floor(r() * MAKAN.length)];
        catat(hari, 'keluar', antara(r, a, b, 500), 'Makan & Minum', judul, { akun: r() < 0.6 ? 'E-Wallet' : 'Tunai' });
      }
      if (r() < 0.12) catat(hari, 'keluar', antara(r, 28_000, 60_000, 1_000), 'Transportasi', 'Bensin', { akun: 'Tunai' });
    }
  }

  return out.filter((b) => b.tanggal <= hariIni);
}

export const KAS_CONTOH: BarisKas[] = buatKasContoh();
