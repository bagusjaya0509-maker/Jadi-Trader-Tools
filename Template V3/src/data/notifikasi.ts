/* ════════════════════════════════════════════════════════════════════════
   NOTIFIKASI — tiga saluran yang sengaja dipisah
   ════════════════════════════════════════════════════════════════════════
   Lonceng, amplop, dan changelog terlihat mirip, tapi isinya tidak boleh
   dicampur. Sekali dicampur, orang berhenti membuka ketiganya:

     · NEWS      (lonceng) — kejadian PASAR. Hidup beberapa jam, lalu basi.
                 Yang membacanya sedang memutuskan entry, jadi urutannya
                 waktu, bukan kepentingan.
     · PESAN     (amplop)  — kejadian AKUN. Paket mau habis, VPS mati,
                 langganan gagal ditagih. Selalu punya satu tindakan jelas.
     · CHANGELOG (sidebar) — kejadian PRODUK. Tidak mendesak, tapi harus
                 bisa ditelusuri: nomor versi, tanggal, dan daftar butir.
   ════════════════════════════════════════════════════════════════════════ */

export interface Berita {
  id: string;
  dampak: 'tinggi' | 'sedang' | 'rendah';
  mata: string;
  waktu: string;
  judul: string;
  detail?: string;
  baru?: boolean;
}

/* Berita dampak tinggi ditaruh di atas hanya kalau waktunya juga paling
   dekat. Menaikkan berita lama karena "dampaknya tinggi" membuat orang
   membaca kabar kemarin sebagai kabar sekarang. */
export const NEWS: Berita[] = [
  {
    id: 'n1', dampak: 'tinggi', mata: 'USD', waktu: '32 mnt lagi',
    judul: 'CPI Amerika Serikat (YoY)',
    detail: 'Perkiraan 2,9% · sebelumnya 3,1%. XAU dan kripto biasanya bergerak keras di menit pertama.',
    baru: true,
  },
  {
    id: 'n2', dampak: 'tinggi', mata: 'BTC', waktu: '1 jam lalu',
    judul: 'Arus keluar ETF spot $214 juta',
    detail: 'Hari ketiga berturut-turut. Rezim BTC di Area Pantau turun ke NETRAL.',
    baru: true,
  },
  {
    id: 'n3', dampak: 'sedang', mata: 'USD', waktu: '3 jam lalu',
    judul: 'Klaim pengangguran mingguan',
    detail: 'Rilis 221 ribu, sedikit di bawah perkiraan 224 ribu.',
    baru: true,
  },
  {
    id: 'n4', dampak: 'sedang', mata: 'XAU', waktu: '5 jam lalu',
    judul: 'Emas menembus 4.340 lalu ditolak',
    detail: 'Zona resisten H4 di 4.340 bertahan — sinyal SELL XAUT masih valid.',
  },
  {
    id: 'n5', dampak: 'rendah', mata: 'SOL', waktu: '8 jam lalu',
    judul: 'Upgrade jaringan Solana selesai',
    detail: 'Tidak ada gangguan perdagangan. Volume kembali normal.',
  },
  {
    id: 'n6', dampak: 'rendah', mata: 'EUR', waktu: 'Kemarin',
    judul: 'ECB menahan suku bunga di 3,25%',
  },
];

export interface PesanAkun {
  id: string;
  jenis: 'peringatan' | 'kabar';
  judul: string;
  isi: string;
  aksi?: string;
  aksiKe?: string;
  waktu: string;
  baru?: boolean;
}

export const PESAN: PesanAkun[] = [
  {
    id: 'p1', jenis: 'peringatan',
    judul: 'Paket Screener habis dalam 4 hari',
    isi: 'Langganan berakhir 14 Agustus 2026. Setelah itu Area Pantau dan Parallel Signal berhenti memuat data.',
    aksi: 'Perpanjang sekarang', aksiKe: '/tagihan',
    waktu: '2 jam lalu', baru: true,
  },
  {
    id: 'p2', jenis: 'peringatan',
    judul: 'App Token Binance belum diisi',
    isi: 'Tombol Open Real Order akan ditolak sampai Backend URL dan App Token tersimpan.',
    aksi: 'Atur di Integrations', aksiKe: '/integrasi',
    waktu: '6 jam lalu', baru: true,
  },
  {
    id: 'p3', jenis: 'kabar',
    judul: 'Jadi Trader V3 versi 3.4 tersedia',
    isi: 'Perbaikan pada duplikat channel kedua dan zona SNR di timeframe kecil. Unduh ulang dari Marketplace.',
    aksi: 'Buka Marketplace', aksiKe: '/marketplace',
    waktu: 'Kemarin', baru: true,
  },
  {
    id: 'p4', jenis: 'kabar',
    judul: 'Laporan bulan Juli sudah siap',
    isi: '123 transaksi tercatat, winrate 51,2%. Ringkasan lengkap ada di Journal.',
    aksi: 'Lihat Journal', aksiKe: '/jurnal',
    waktu: '3 hari lalu',
  },
  {
    id: 'p5', jenis: 'kabar',
    judul: 'VPS dipindah ke sslip.io ber-HTTPS',
    isi: 'Alamat lama dengan IP telanjang berhenti melayani 1 September 2026. Perbarui Backend URL kalau masih memakai yang lama.',
    aksi: 'Periksa sambungan', aksiKe: '/integrasi',
    waktu: '1 minggu lalu',
  },
];

export interface ButirRilis {
  jenis: 'baru' | 'perbaikan' | 'peningkatan';
  teks: string;
}

export interface Rilis {
  versi: string;
  tanggal: string;
  judul: string;
  ringkas: string;
  sorotan?: string;
  butir: ButirRilis[];
}

/* Urutan: terbaru dulu. CHANGELOG[0] yang tampil di kotak sidebar. */
export const CHANGELOG: Rilis[] = [
  {
    versi: 'v3.4',
    tanggal: '10 Agustus 2026',
    judul: 'Order sungguhan dari Area Entry',
    ringkas: 'Kirim order Binance langsung dari screener, lewat VPS sendiri — tanpa membuka aplikasi lain.',
    sorotan:
      'Sampai rilis ini, sinyal berhenti sebagai bacaan: kamu melihat entry, SL, dan TP, lalu pindah ke aplikasi ' +
      'lain untuk mengeksekusinya. Jeda pindah aplikasi itu yang paling sering mengubah rencana — harga bergerak, ' +
      'ukuran lot diubah "sedikit saja", SL ditarik lebih jauh. Sekarang order berangkat dari layar yang sama ' +
      'dengan yang menghitung levelnya.',
    butir: [
      { jenis: 'baru', teks: 'Tombol Open Real Order di Area Entry, mengirim MARKET/LIMIT ke Binance Futures lewat proxy VPS-mu sendiri.' },
      { jenis: 'baru', teks: 'Penjaga sambungan: tombol order ditolak dengan penjelasan kalau Backend URL atau App Token belum diisi.' },
      { jenis: 'baru', teks: 'Tutorial pemasangan lengkap di Integrations — dari membuat API key Binance sampai pm2 startup, dengan kode siap salin.' },
      { jenis: 'peningkatan', teks: 'Area Pantau kembali ke bentuk aslinya: ceklist saja. Entry, SL, dan TP hanya muncul di Parallel Signal.' },
      { jenis: 'perbaikan', teks: 'Peraga Parallel Channel di Marketplace sekarang benar-benar bergerak dan garis channel-nya sejajar.' },
    ],
  },
  {
    versi: 'v3.3',
    tanggal: '2 Agustus 2026',
    judul: 'Notifikasi dipisah tiga saluran',
    ringkas: 'Lonceng untuk berita pasar, amplop untuk kabar akun, changelog untuk pembaruan produk.',
    sorotan:
      'Satu ikon lonceng yang menampung semuanya membuat kabar "paket habis 4 hari lagi" tenggelam di antara ' +
      'enam berita pasar. Dipisah supaya yang mendesak tidak perlu bersaing dengan yang menarik.',
    butir: [
      { jenis: 'baru', teks: 'Lonceng berisi kalender berita dengan badge dampak tinggi/sedang/rendah.' },
      { jenis: 'baru', teks: 'Amplop berisi peringatan langganan, status VPS, dan kabar rilis — tiap butir punya satu tindakan.' },
      { jenis: 'baru', teks: 'Help Center langsung menuju WhatsApp, Discord, atau email.' },
      { jenis: 'peningkatan', teks: 'Popup berita tetap muncul saat membuka menu portofolio, jadi rilis besar tidak terlewat.' },
    ],
  },
  {
    versi: 'v3.2',
    tanggal: '24 Juli 2026',
    judul: 'Personal Area & Chart Backtest',
    ringkas: 'Pelacak portofolio rupiah dan editor indikator dengan chart lilin sendiri.',
    butir: [
      { jenis: 'baru', teks: 'Personal Area: aset, kewajiban, arus kas bulanan, dan perkembangan portofolio.' },
      { jenis: 'baru', teks: 'Chart & Backtest: chart lilin SVG, alat gambar, dan kotak editor Pine/MQL5.' },
      { jenis: 'peningkatan', teks: 'Journal memakai perhitungan saldo yang sama dengan Dashboard — tidak ada lagi dua angka berbeda.' },
    ],
  },
  {
    versi: 'v3.1',
    tanggal: '15 Juli 2026',
    judul: 'Sinyal Prioritas melebur ke Parallel Signal',
    ringkas: 'Tiga mode filter menggantikan dua section yang isinya tumpang tindih.',
    butir: [
      { jenis: 'peningkatan', teks: 'Mode Sinyal SNR H4, Sentuh SNR, dan Parallel Only dalam satu pemilih.' },
      { jenis: 'perbaikan', teks: 'Klik kartu sinyal membuka chart 4 jam, bukan 5 menit.' },
      { jenis: 'perbaikan', teks: 'Koin yang dihapus lewat klik kanan tidak muncul lagi saat dicari manual.' },
      { jenis: 'baru', teks: 'Sebelas simbol TradFi Binance (AAPL, NVDA, dan lainnya) masuk Area Pantau.' },
    ],
  },
];
