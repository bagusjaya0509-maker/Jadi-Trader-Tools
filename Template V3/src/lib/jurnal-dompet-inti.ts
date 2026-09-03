/* ═══════════════════════════════════════════════════════════════════════════
   INTI JURNAL DOMPET — deretan fill Hyperliquid menjadi trade yang bulat
   ═══════════════════════════════════════════════════════════════════════════

   BEBAS DEPENDENSI DENGAN SENGAJA. Tidak ada impor `@/…`, tidak ada
   Firestore, tidak ada React. Berkas ini diuji langsung oleh Node lewat
   skrip/uji/uji-jurnal-dompet.mjs — dan alasannya bukan kerapian: angka yang
   keluar dari sini ditulis ke jurnal orang sebagai P/L. Salah satu tanda di
   sini berarti win rate yang salah, dan win rate yang salah tidak pernah
   melapor bahwa dirinya salah.

   ── DARI ANGKA POSISI, BUKAN DARI LABEL ───────────────────────────────────
   Tiap fill membawa `startPosition` (posisi SEBELUM fill, bertanda) dan
   `side` ('B' beli / 'A' jual). Posisi sesudahnya = start ± sz. Dari dua
   angka itu bisa dibaca pasti apakah fill ini membuka, menambah, menutup,
   atau membalik — tanpa membaca `dir`.

   Label `dir` ("Open Long", "Close Short", "Long > Short", "Settlement",
   dan entah apa lagi yang belum pernah terlihat) hanya dipakai untuk
   keterangan. Kode yang mencocokkan label akan diam saat labelnya baru;
   kode yang membaca angka tidak peduli.

   ── ID = OID ORDER PENUTUP, SAMA DENGAN JALUR SERVER ─────────────────────
   Jalur `/api/hl/user-trades` untuk akun pemilik menulis `hl<oid>` per
   order penutup. Dipakai konvensi yang SAMA di sini: kalau pemilik
   menautkan dompet HL-nya sendiri, kedua jalur bertemu di dokumen yang
   sama alih-alih menggandakannya. oid Hyperliquid unik global, jadi dompet
   yang berbeda tidak mungkin bertabrakan.

   ── YANG LEBIH BAIK DARI JALUR SERVER: HARGA MASUK ────────────────────────
   Jalur server hanya melihat fill PENUTUP, jadi harga masuknya selalu 0.
   Di sini riwayat penuh tersedia, jadi harga masuk = rata-rata tertimbang
   kaki posisi — angka yang sama dengan "entry price" di layar Hyperliquid.
   Kalau kakinya dimulai SEBELUM jendela yang ditarik, rata-ratanya tidak
   bisa dihitung dan ditulis 0 dengan `masukLengkap: false` — bukan
   dikarang dari harga keluar.

   ── P/L KOTOR, FEE TERPISAH ───────────────────────────────────────────────
   `pnl` = Σ closedPnl, SEBELUM fee — persis seperti baris HL yang sudah ada
   di jurnal dan seperti kolom "Closed PnL" di Hyperliquid sendiri. Fee
   (yang bisa NEGATIF: rebate maker) dijumlahkan terpisah supaya pembaca
   bisa melihatnya, tanpa membuat trade yang sama berbeda angkanya
   tergantung jalur mana yang menulisnya lebih dulu.
   ═══════════════════════════════════════════════════════════════════════ */

/** Bentuk fill dari `userFillsByTime` — cuma medan yang dipakai. Angka
 *  datang sebagai STRING dari API; dikonversi di sini, satu tempat. */
export interface FillHl {
  coin: string;
  px: string | number;
  sz: string | number;
  side: 'A' | 'B';
  time: number;
  startPosition: string | number;
  dir?: string;
  closedPnl?: string | number;
  oid: number;
  tid: number;
  fee?: string | number;
  feeToken?: string;
  hash?: string;
}

export interface TradeDompet {
  /** oid order penutup. ID dokumen jurnal = 'hl' + oid. */
  oid: number;
  koin: string;
  /** Konvensi jalur server: posisi LONG yang ditutup = 'BUY', SHORT = 'SELL'. */
  arah: 'BUY' | 'SELL';
  /** Jumlah koin yang ditutup oleh order ini. */
  qty: number;
  /** Rata-rata tertimbang kaki posisi; 0 kalau `masukLengkap` false. */
  hargaMasuk: number;
  /** Rata-rata tertimbang fill penutup order ini. */
  hargaKeluar: number;
  /** Σ closedPnl, kotor. */
  pnl: number;
  /** Σ fee fill penutup. Negatif = rebate. */
  fee: number;
  /** Waktu fill penutup terakhir, ms. */
  waktu: number;
  /** Jumlah fill yang membentuk order ini. */
  isian: number;
  /** false = kaki dimulai sebelum fill pertama yang kita punya. */
  masukLengkap: boolean;
  /** Label `dir` fill terakhir — keterangan, bukan logika. */
  dir: string;
}

const NOL = 1e-9;

/* ── HANYA PERP. SPOT DAN PASAR PREDIKSI DITOLAK DI PINTU ────────────────
   Seluruh berkas ini berdiri di atas satu asumsi: `startPosition` adalah
   POSISI BERTANDA, sehingga "posisi sesudahnya = start ± sz" dan tanda yang
   berbalik berarti tutup. Untuk perp itu benar. Untuk spot TIDAK: di sana
   `startPosition` adalah SALDO TOKEN — selalu positif, bisa berubah karena
   transfer, airdrop, atau fee yang dipotong dari token yang dibeli.

   Akibatnya kalau spot ikut dirantai: tiap penjualan terbaca sebagai
   "menutup long", `closedPnl` spot ikut dijumlahkan, dan angkanya masuk ke
   Net P/L. Diukur pada alamat nyata 0x03e1614998… — 787 fill menghasilkan
   154 trade, 77 di antaranya spot, dan Σ P/L melonjak dari $47.371 (perp
   saja) menjadi $354.342. Tiga ratus ribu dolar laba yang tidak pernah ada,
   plus 77 baris menang/kalah palsu di win rate. Pada satu alamat lain,
   sebuah `Settlement` pasar prediksi bernilai $72.998 masuk sebagai satu
   "trade".

   Rantai posisinya sendiri juga memang putus untuk spot: dari 8.167 fill
   spot nyata, 1.472 punya `startPosition` yang tidak sama dengan hasil fill
   sebelumnya. Pada perp: 4 dari 4.222.

   BENTUK NAMANYA yang jadi penjaga, karena itu yang dikirim API:
     '@107', '@5'      → spot (indeks pasar spot)
     'PURR/USDC'       → spot (pasangan bernama)
     '#1100'           → token pasar prediksi
     'BTC', 'HYPE'     → perp biasa            ← diterima
     'xyz:GOLD'        → perp HIP-3 pihak ketiga ← DITERIMA, jangan disaring
   Titik dua BUKAN penanda spot: itu perp yang di-deploy builder lain, dan
   model posisinya persis sama dengan perp biasa. */
export function perp(koin: string): boolean {
  return !(koin.startsWith('@') || koin.startsWith('#') || koin.includes('/'));
}

function angka(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : NaN;
}

interface Kaki {
  arah: 'long' | 'short';
  /** Jumlah koin di kaki ini (selalu positif). */
  qty: number;
  /** Σ px·qty untuk bagian yang harganya diketahui. */
  biaya: number;
  lengkap: boolean;
}

interface Kelompok {
  oid: number; koin: string; arah: 'BUY' | 'SELL';
  qty: number; nilaiKeluar: number; pnl: number; fee: number;
  waktu: number; isian: number; lengkap: boolean; dir: string;
  /** Σ hargaMasuk·qty per potongan tutup — kaki bisa berubah rata-ratanya
   *  di antara dua potongan (ada penambahan di tengah), jadi tiap potongan
   *  membawa rata-rata pada saat IA ditutup. */
  nilaiMasuk: number;
}

/** Urutkan waktu naik; fill dengan waktu sama dibiarkan pada urutan
 *  datangnya (sort stabil). Urutan di dalam satu milidetik PENTING —
 *  `startPosition` fill berikutnya harus sama dengan posisi sesudah fill
 *  sebelumnya — dan API sudah mengirimkannya berurutan. */
export function urutkanFill(fills: FillHl[]): FillHl[] {
  return [...fills].sort((a, b) => a.time - b.time);
}

export function kelompokkanFill(fillMentah: FillHl[]): TradeDompet[] {
  const fills = urutkanFill(fillMentah);
  const kaki = new Map<string, Kaki | null>();
  const kelompok = new Map<number, Kelompok>();

  for (const f of fills) {
    /* Penjaga pasar. `continue`, bukan disaring lebih dulu di luar loop,
       supaya satu-satunya jalan masuk ke rantai posisi tetap satu tempat. */
    if (!perp(f.coin)) continue;

    const sz = angka(f.sz);
    const px = angka(f.px);
    const start = angka(f.startPosition);
    /* Fill tanpa ukuran atau tanpa posisi awal yang terbaca tidak bisa
       ditempatkan di rantai posisi mana pun. Dilewati, bukan ditebak:
       tebakan yang salah menggeser SEMUA fill sesudahnya di koin itu. */
    if (!(sz > NOL) || !Number.isFinite(start) || !Number.isFinite(px)) continue;

    const beli = f.side === 'B';
    const bertanda = beli ? sz : -sz;
    const akhir = start + bertanda;
    let k = kaki.get(f.coin) ?? null;

    /* ── MEMBUKA dari nol ─────────────────────────────────────────────── */
    if (Math.abs(start) < NOL) {
      kaki.set(f.coin, { arah: akhir > 0 ? 'long' : 'short', qty: sz, biaya: px * sz, lengkap: true });
      continue;
    }

    const searah = (start > 0) === beli;

    /* ── MENAMBAH posisi yang sudah ada ───────────────────────────────── */
    if (searah) {
      if (!k) {
        /* Kaki ini dimulai sebelum jendela: bagian yang sudah ada tidak
           diketahui harganya, jadi rata-ratanya tidak akan pernah lengkap. */
        k = { arah: start > 0 ? 'long' : 'short', qty: Math.abs(start), biaya: 0, lengkap: false };
      }
      k.qty += sz;
      k.biaya += px * sz;
      kaki.set(f.coin, k);
      continue;
    }

    /* ── MENUTUP (sebagian, penuh, atau membalik) ─────────────────────── */
    const tutup = Math.min(Math.abs(start), sz);
    if (!k) {
      k = { arah: start > 0 ? 'long' : 'short', qty: Math.abs(start), biaya: 0, lengkap: false };
    }
    const rataMasuk = k.lengkap && k.qty > NOL ? k.biaya / k.qty : 0;

    const g = kelompok.get(f.oid) ?? {
      oid: f.oid, koin: f.coin, arah: k.arah === 'long' ? 'BUY' : 'SELL',
      qty: 0, nilaiKeluar: 0, nilaiMasuk: 0, pnl: 0, fee: 0,
      waktu: 0, isian: 0, lengkap: true, dir: '',
    };
    g.qty += tutup;
    g.nilaiKeluar += px * tutup;
    g.nilaiMasuk += rataMasuk * tutup;
    g.pnl += angka(f.closedPnl) || 0;
    g.fee += angka(f.fee) || 0;
    g.waktu = Math.max(g.waktu, f.time);
    g.isian += 1;
    g.lengkap = g.lengkap && k.lengkap;
    g.dir = f.dir || g.dir;
    kelompok.set(f.oid, g);

    /* Kurangi kaki secara proporsional supaya rata-ratanya tidak bergeser
       — menutup sebagian tidak mengubah harga masuk sisa posisi. */
    const sisa = k.qty - tutup;
    if (sisa > NOL) {
      k.biaya = k.lengkap ? rataMasuk * sisa : 0;
      k.qty = sisa;
      kaki.set(f.coin, k);
    } else {
      kaki.set(f.coin, null);
    }

    /* ── MEMBALIK: sisa ukuran membuka kaki baru di arah lawan ────────── */
    const balik = sz - tutup;
    if (balik > NOL) {
      kaki.set(f.coin, { arah: akhir > 0 ? 'long' : 'short', qty: balik, biaya: px * balik, lengkap: true });
    }
  }

  return [...kelompok.values()]
    .map((g) => ({
      oid: g.oid, koin: g.koin, arah: g.arah,
      qty: g.qty,
      hargaMasuk: g.lengkap && g.qty > NOL ? g.nilaiMasuk / g.qty : 0,
      hargaKeluar: g.qty > NOL ? g.nilaiKeluar / g.qty : 0,
      pnl: g.pnl, fee: g.fee, waktu: g.waktu, isian: g.isian,
      masukLengkap: g.lengkap, dir: g.dir,
    }))
    .sort((a, b) => a.waktu - b.waktu || a.oid - b.oid);
}

/* ── Penarikan berhalaman ────────────────────────────────────────────────
   `userFillsByTime` memulangkan paling banyak 2000 fill TERTUA sejak
   `startTime`, urut waktu naik. DIBUKTIKAN, bukan dibaca: 3 Sep 2026 pada
   dompet yang mencetak ~3.000 fill per jam, halaman pertama berhenti di
   09:13 UTC padahal saat itu pukul 12:30 dan dompetnya masih aktif — jadi
   yang datang adalah 2000 PERTAMA, bukan 2000 terakhir. Dugaan sebaliknya
   (2000 terbaru, geser `endTime` ke belakang) sempat ditulis di sini dan
   halaman keduanya cuma memulangkan satu fill batas.

   Jadi halaman berikutnya diambil dengan MEMAJUKAN startTime ke waktu fill
   terbaru yang sudah dipunya; fill yang berbagi milidetik di batas ikut
   terambil lagi dan disaring lewat `tid`.

   Hyperliquid hanya menyimpan 10.000 fill terakhir per akun. Untuk dompet
   biasa itu berbulan-bulan; untuk dompet di atas itu 3,5 jam. Pemanggil
   wajib menampilkan jendela yang BENAR-BENAR terambil, bukan yang diminta.
   `maksHalaman` menjaga kalau batas itu berubah tanpa kabar. */
export interface MintaFill { user: string; startTime: number; endTime?: number; aggregateByTime: boolean }

export async function tarikSemuaFill(
  alamat: string,
  sejakMs: number,
  tanya: (badan: MintaFill) => Promise<FillHl[]>,
  /* 10 halaman = 20.000 fill. Dompet yang diuji menyimpan 11.993 fill
     terakhir (lebih dari 10.000 yang didokumentasikan), jadi 6 halaman
     sempat memotongnya. Untuk dompet biasa satu halaman pun tidak penuh. */
  maksHalaman = 10,
): Promise<{ fills: FillHl[]; halaman: number; terpotong: boolean }> {
  const per = new Map<number, FillHl>();
  let startTime = Math.max(0, Math.floor(sejakMs));
  let halaman = 0;
  let terpotong = false;

  while (halaman < maksHalaman) {
    const isi = await tanya({ user: alamat, startTime, aggregateByTime: true });
    halaman++;
    if (!Array.isArray(isi) || isi.length === 0) break;

    let baru = 0;
    let terbaru = -Infinity;
    for (const f of isi) {
      if (!per.has(f.tid)) { per.set(f.tid, f); baru++; }
      if (f.time > terbaru) terbaru = f.time;
    }
    if (isi.length < 2000 || baru === 0) break;
    /* Tidak maju = seluruh halaman berisi fill di satu milidetik yang sama;
       memajukan batas tidak akan mengubah apa pun. */
    if (terbaru <= startTime) break;
    startTime = terbaru;
    if (halaman >= maksHalaman) terpotong = true;
  }

  return { fills: urutkanFill([...per.values()]), halaman, terpotong };
}
