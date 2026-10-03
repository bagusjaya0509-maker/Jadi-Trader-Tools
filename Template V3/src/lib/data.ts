import { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, orderBy, limit, query, where, Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { ambilDb } from '@/lib/firestore';
import { alasanJurnal, emosiJurnal } from '@/lib/medan-jurnal';
import { useAuth } from '@/lib/auth';
import { usePosisiBinance, type OrderBursa } from '@/lib/admin';
import {
  RIWAYAT, SALDO_AWAL, PRODUK,
  POSISI_KRIPTO_CONTOH, PENDING_KRIPTO_CONTOH, STOP_KRIPTO_CONTOH,
  type Trade, type Posisi, type Sumber, type Produk,
} from '@/data/contoh';

/* ════════════════════════════════════════════════════════════════════════
   DATA NYATA DARI FIRESTORE
   ════════════════════════════════════════════════════════════════════════
   Hook di sini mengembalikan `Trade[]` dan `Posisi[]` — bentuk yang SUDAH
   dipakai seluruh layar sejak prototipe.

   Itu keputusan sengaja, bukan kemalasan. Kalau tiap halaman diubah untuk
   membaca bentuk Firestore langsung, penyambungan ini menyentuh delapan
   berkas sekaligus dan tidak ada satu pun yang bisa diuji terpisah. Dengan
   menerjemahkan di satu tempat, halaman-halamannya tidak tahu — dan tidak
   perlu tahu — apakah datanya dari contoh atau dari server.

   YANG DIBACA (skema V3, hasil migrasi 10 Agustus 2026):
     users/{uid}/transaksi/{id}      → Trade
     users/{uid}/posisi/{id}         → Posisi
     users/{uid}/agregat/ringkasan   → Ringkasan (dipakai Dashboard)

   MODE PAMERAN. Kalau belum login, hook mengembalikan data contoh. Beranda
   dan Dashboard tetap punya isi untuk dilihat pengunjung — halaman kosong
   dengan tulisan "silakan masuk" tidak meyakinkan siapa pun untuk mendaftar.
   Yang dikembalikan ditandai `contoh: true` supaya layar bisa memasang label
   jujur, bukan menyamarkannya sebagai milik pengunjung.
   ════════════════════════════════════════════════════════════════════════ */

/** Batas PER SUMBER, bukan batas total.
 *
 *  Riwayat MT5 sendiri bisa ribuan baris; membacanya seluruhnya tiap kali
 *  halaman dibuka adalah ribuan pembacaan Firestore untuk tabel yang cuma
 *  menampilkan 40 baris terakhir. 600 per sumber sudah lebih dari cukup
 *  untuk kalender, kurva ekuitas, dan seluruh statistik di halaman ini. */
const BATAS_PER_SUMBER = 2000;

/* Berkas ini hanya diimpor halaman-halaman yang dimuat malas, jadi impor
   statis Firestore di atas TIDAK ikut ke jalur muat awal. getFirestore aman
   dipanggil lagi di sini — Firebase mengembalikan instans yang sama. */
/* Lewat `ambilDb()`, bukan `getFirestore(app)` langsung: instansnya perlu
   dimulai dengan cache lokal, dan itu HANYA bisa sebelum getFirestore
   pertama. Satu pintu supaya urutannya tidak bergantung siapa yang
   kebetulan berjalan duluan — lihat lib/firestore.ts. */
export const db = ambilDb();

function ms(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (v instanceof Date) return +v;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const d = new Date(v); return isNaN(+d) ? 0 : +d; }
  return 0;
}
const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);

/** Dokumen transaksi V3 → Trade yang dipahami seluruh layar. */
function keTrade(id: string, d: DocumentData): Trade {
  const sumber: Sumber = d.sumber === 'forex' || d.sumber === 'xau' ? 'forex' : 'kripto';
  return {
    id,
    pair: d.simbol ?? '',
    arah: d.arah === 'SELL' ? 'SELL' : 'BUY',
    /* Forex punya lot, kripto punya qty. Satu kolom di layar, jadi ambil
       yang ada — menampilkan "0 lot" untuk transaksi kripto lebih salah
       daripada menampilkan jumlah koinnya. */
    lot: n(d.ukuran?.lot) || n(d.ukuran?.qty),
    pnl: n(d.pnl),
    waktu: ms(d.keluarWaktu) || ms(d.masukWaktu),
    sumber,
    /* Aturan siapa-pemilik-medan hidup di `medan-jurnal.ts`, BUKAN di sini.
       Ia dibaca juga oleh modal sunting, dan dua salinan aturan yang sama
       akan berselisih pada revisi berikutnya — dengan akibat yang paling
       jahat: modal menampilkan nilai mesin, orangnya menekan Simpan, dan
       tulisan tangannya tertimpa. */
    emosi: emosiJurnal(d) || undefined,
    alasan: alasanJurnal(d) || undefined,
    /* Transaksi latihan lama tidak punya field `latihan` — ia baru ada
       sejak perbaikan ini. Yang lama dikenali dari jejak yang memang
       sudah ditulis waktu itu: alasan "Latihan replay" atau catatan
       "bukan transaksi sungguhan". Tanpa ini, latihan yang terlanjur
       tersimpan akan terus menghitung diri sebagai trade sungguhan. */
    latihan: d.latihan === true
      || /latihan replay/i.test(String(d.psikologi?.alasanMasuk ?? ''))
      || /bukan transaksi sungguhan/i.test(String(d.psikologi?.catatan ?? '')),
    /* NILAI ORDER, bukan margin. Yang ditanyakan orang saat melihat riwayat
       adalah "posisi ini sebesar apa" — dan jawabannya margin DIKALI
       leverage, bukan modal yang dipakai. Posisi $100 dengan leverage 4×
       bergerak seperti posisi $400.

       Kalau margin/leverage tidak ada di dokumennya, dibiarkan undefined:
       menebaknya dari qty x harga entry akan salah untuk transaksi yang
       sebagian TP-nya sudah kena. */
    /* `ukuran.nilai` MENANG kalau ada: ia ditulis oleh yang benar-benar
       tahu nilainya saat transaksinya dicatat, bukan dihitung ulang dari
       dua medan yang bisa saja tidak lengkap. Margin x leverage tetap jadi
       cadangan untuk dokumen lama yang belum punya medan itu. */
    nilaiOrder: n(d.ukuran?.nilai) ? n(d.ukuran.nilai)
      : n(d.ukuran?.margin) && n(d.ukuran?.leverage)
      ? n(d.ukuran.margin) * n(d.ukuran.leverage)
      : undefined,
    leverage: n(d.ukuran?.leverage) || undefined,
  };
}


export interface Ringkasan {
  jumlah: number;
  menang: number;
  kalah: number;
  winrate: number;
  pnlTotal: number;
  perSumber: Record<string, { jumlah: number; menang: number; kalah: number; winrate: number; pnlTotal: number }>;
  perBulan: Record<string, { jumlah: number; pnl: number }>;
}

export interface HasilData<T> {
  data: T;
  memuat: boolean;
  contoh: boolean;
  galat: string | null;
}

/** Riwayat transaksi. Terurut terbaru dulu; layar yang butuh urutan naik
 *  mengurutkannya sendiri (kurvaEkuitas sudah melakukannya). */
export function useRiwayat(): HasilData<Trade[]> {
  const { pengguna, memuat: memuatAuth } = useAuth();
  /* ── KEADAAN AWALNYA KOSONG, BUKAN DATA CONTOH ───────────────────────
     Dulu `useState(RIWAYAT)`. Untuk pengunjung itu tidak berbahaya. Untuk
     yang SUDAH masuk, ada sela antara "sesinya pulih" dan "Firestore
     menjawab" — dan di sela itu hook ini memulangkan transaksi contoh
     dengan `contoh: false`. Layar mana pun yang membacanya memperlakukan
     baris karangan sebagai jurnal pemiliknya:

       · Dashboard menerbitkan ringkasan ke halaman depan 2 detik sesudah
         dibuka. Di sambungan lambat (Firestore > 2 detik) yang terbit
         adalah winrate dan saldo CONTOH, sebagai rekam jejak sungguhan.
       · Sinkron otomatis jurnal menghitung jendela tarikannya dari
         transaksi terbaru — yang saat itu transaksi contoh hari ini.

     Ditemukan 3 Okt 2026 saat menyiapkan contoh setahun (949 baris, jauh
     lebih meyakinkan daripada 123 baris lama — jadi bocornya pun akan jauh
     lebih sulit dikenali). Contoh sekarang cuma punya SATU jalan keluar:
     cabang `pakaiContoh` di ujung fungsi ini, yang selalu membawa
     `contoh: true`. */
  const [data, setData] = useState<Trade[]>([]);
  const [, setVersiPilihan] = useState(0);
  useEffect(() => {
    const naik = () => setVersiPilihan((v) => v + 1);
    window.addEventListener('jt:pilihan-contoh', naik);
    return () => window.removeEventListener('jt:pilihan-contoh', naik);
  }, []);

  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (memuatAuth) return;
    if (!pengguna) { setData([]); setMemuat(false); return; }
    setMemuat(true);
    /* SATU KUERI PER SUMBER, bukan satu kueri untuk semuanya.
       ──────────────────────────────────────────────────────────────────
       Sebelumnya: satu kueri `orderBy keluarWaktu desc limit 400`. Begitu
       sinkron MT5 memasukkan ~1100 transaksi forex, 400 baris terbaru
       SELURUHNYA milik MT5 — dan jurnal kripto berubah jadi "0 transaksi"
       padahal datanya utuh di Firestore. Pola Emosi ikut kosong karena
       catatan emosi ada di transaksi kripto & manual yang terdorong keluar.

       Batas per sumber membuat satu sumber tidak bisa menelan jatah yang
       lain, berapa pun banyaknya data yang masuk nanti. */
    const sumber = ['kripto', 'forex', 'xau'];
    const perSumber = new Map<string, Trade[]>();
    let sisaMuat = sumber.length;

    /* KENAPA `kunciUrut`, BUKAN where(sumber) + orderBy(keluarWaktu)
       ──────────────────────────────────────────────────────────────────
       Gabungan filter kesamaan dan pengurutan pada field BERBEDA menuntut
       indeks komposit, dan akun layanan yang kita punya tidak berhak
       membuatnya — jadi jurnalnya akan kosong sampai ada yang membuka
       konsol Firebase dan mengklik tautan di pesan error.

       `kunciUrut` menyatukan keduanya jadi satu field: "forex#1786282935000".
       Rentang DAN pengurutan terjadi pada field yang sama, dan itu dilayani
       indeks satu-field yang dibuat Firestore otomatis. Tidak ada yang perlu
       dibuat, tidak ada yang perlu diklik.

       Stempel waktunya dipadkan 13 digit supaya urutan teks sama dengan
       urutan angka — tanpa padding, "999" berada di atas "1786282935000". */
    const lepas = sumber.map((s) =>
      onSnapshot(
        query(
          collection(db, 'users', pengguna.uid, 'transaksi'),
          where('kunciUrut', '>=', `${s}#`),
          where('kunciUrut', '<=', `${s}#`),
          orderBy('kunciUrut', 'desc'),
          limit(BATAS_PER_SUMBER)
        ),
        (snap) => {
          perSumber.set(s, snap.docs.map((d) => keTrade(d.id, d.data())));
          setData([...perSumber.values()].flat());
          if (sisaMuat > 0) { sisaMuat--; if (sisaMuat === 0) setMemuat(false); }
          setGalat(null);
        },
        (e) => {
          /* Kueri gabungan (where + orderBy) butuh indeks komposit. Kalau
             belum ada, Firestore mengirim pesan yang MEMUAT tautan untuk
             membuatnya — ditampilkan apa adanya karena itulah satu-satunya
             cara pemiliknya tahu apa yang harus diklik. */
          console.warn(`riwayat ${s}:`, e);
          setGalat(e.message);
          if (sisaMuat > 0) { sisaMuat--; if (sisaMuat === 0) setMemuat(false); }
        }
      )
    );
    return () => lepas.forEach((f) => f());
  }, [pengguna, memuatAuth]);

  /* AKUN BARU tidak disambut halaman kosong.
     ────────────────────────────────────────────────────────────────────
     Selesai memuat dan hasilnya nol transaksi berarti orangnya baru —
     dan dashboard yang seluruhnya nol tidak menjelaskan apa pun tentang
     apa yang akan ia dapat. Data contoh dipasang (berlabel), sampai ia
     memilih mulai kosong lewat spanduk, atau transaksi pertamanya masuk. */
  const kosongBaru =
    !!pengguna && !memuat && !memuatAuth && !galat && data.length === 0 &&
    bacaPilihanContoh(pengguna.uid) !== 'kosong';

  const pakaiContoh = !pengguna || kosongBaru;

  /* ── CONTOHNYA SATU: `RIWAYAT`, SETAHUN PENUH ─────────────────────────
     Sempat ada lapisan kedua di sini: 150 transaksi ASLI pemilik dari
     public/ringkasanAkun menimpa contoh statis, per sumber. Maksudnya baik
     — angka nyata lebih jujur daripada karangan — tapi hasilnya bukan akun
     siapa pun: dua minggu terakhir dari akun berisi ribuan baris, tanpa
     emosi, tanpa setup, tanpa setoran. Kalender bulan berjalan kosong,
     Pola Emosi kosong, winrate 82% di sebelah P/L minus (dilaporkan pemilik
     3 Okt 2026).

     Sekarang contohnya dibangkitkan di data/contoh.ts dan dipakai apa
     adanya. Satu pembacaan Firestore per pengunjung ikut hilang, dan
     transaksi pemilik berhenti disiarkan (lihat `terbitkanRingkasan`). */
  return {
    data: pakaiContoh ? RIWAYAT : data,
    memuat: memuat || memuatAuth,
    contoh: pakaiContoh,
    galat,
  };
}

/* Pilihan pengguna atas data contoh PINDAH ke `@/lib/pilihan-contoh`.
   Diekspor ulang dari sini supaya pemanggil lama tidak perlu diubah.

   Dipindah karena keduanya murni localStorage, sementara berkas INI
   menarik seluruh SDK Firestore. Selama mereka tinggal di sini, satu
   pembacaan localStorage dari `lib/contoh-pratinjau.ts` menyeret 647 kB
   Firestore ke bundel awal — ke halaman depan, ke pengunjung yang belum
   login sekalipun.

   Yang TIDAK butuh Firestore sebaiknya mengambil langsung dari
   `@/lib/pilihan-contoh`; mengambilnya lewat sini menyeret berkas ini
   ikut serta. */
import { bacaPilihanContoh } from '@/lib/pilihan-contoh';
export { bacaPilihanContoh, simpanPilihanContoh } from '@/lib/pilihan-contoh';

/** Satu baris `public/posisiTerbuka` -> bentuk `Posisi`. */
function kePosisiPublik(p: any, i: number): Posisi {
  return {
    id: `${p.simbol ?? '?'}-${p.buka ?? i}`,
    simbol: String(p.simbol ?? ''),
    arah: p.arah === 'SELL' ? 'SELL' : 'BUY',
    tf: String(p.tf ?? '—'),
    entry: n(p.entry),
    sl: n(p.sl),
    tp: n(p.tp),
    hargaKini: n(p.entry),
    venue: 'Binance Live',
    buka: n(p.buka),
  };
}

/** Kunci sebuah posisi bursa: BURSA + SIMBOL, tidak pernah simbol saja.
 *
 *  Dulu `bursa-${simbol}`. Satu koin yang terbuka di Binance DAN di Hyperliquid
 *  — ZECUSDT, persis yang dilaporkan pemilik — lalu mendapat dua posisi
 *  dengan id yang sama persis. Dua akibatnya, dan dua-duanya diam:
 *
 *    · Tabel memakai id ini sebagai `key` React. Dua bersaudara berkunci sama
 *      membuat React salah memasangkan simpul tiap kali harganya diperbarui:
 *      baris anak bocor jadi baris induk, baris lama tertinggal, dan
 *      tumpukannya bertambah selama kelompoknya dibentangkan. Terlihat sebagai
 *      satu ZECUSDT yang beranak tujuh, masing-masing dengan persentase gerak
 *      yang beku di waktu yang berbeda-beda. Muat ulang menyembuhkannya
 *      sebentar karena kelompoknya kembali tergabung — dan itu yang membuatnya
 *      terbaca seperti gangguan sesaat, bukan cacat.
 *
 *    · Yang lebih mahal: `panel-posisi-terbuka` mencari ukuran lot lewat
 *      `find((p) => p.id === kunci)` saat hendak menutup. `find` memulangkan
 *      yang PERTAMA, jadi menutup posisi Hyperliquid mengirim ukuran posisi
 *      Binance. Itu bukan salah gambar — itu salah jumlah, ke bursa yang
 *      sungguhan.
 *
 *  Simbol saja TIDAK PERNAH cukup sebagai identitas sejak jalur Hyperliquid
 *  ada: keduanya sama-sama menulis COINUSDT. */
function idPosisiBursa(b: { bursa: string; simbol: string }): string {
  return `bursa-${b.bursa}-${b.simbol}`;
}

/** Posisi yang SEDANG terbuka di Binance.
 *
 *  Sumbernya `public/posisiTerbuka`, yang ditulis ulang oleh screener V2
 *  setiap kali posisi dibuka atau ditutup — jadi isinya selalu sama dengan
 *  `/api/positions` milik Binance.
 *
 *  Sebelumnya halaman ini membaca `users/{uid}/posisi`, dan itulah sumber
 *  keluhan "posisi terbuka kripto tidak sesuai": subkoleksi itu diisi sekali
 *  saat migrasi dari `prioritySim.positions` — posisi SIMULASI, bukan posisi
 *  nyata — lalu tidak pernah diperbarui lagi. Ia menampilkan LTCUSDT, ONEUSDT,
 *  SEIUSDT sementara yang benar-benar terbuka di bursa adalah RUNEUSDT,
 *  ENJUSDT, ONEUSDT.
 *
 *  Dokumen ini juga sengaja publik: pengunjung yang belum berlangganan tetap
 *  bisa melihat posisi pemilik — itu memang bagian dari etalasenya. */
/** Selama ini dianggap masih berjalan. Screener menulis ulang stempelnya
 *  tiap 2 menit; 10 menit memberi ruang empat detak terlewat sebelum ia
 *  dinyatakan berhenti — cukup longgar untuk tab yang tersendat, cukup
 *  ketat untuk tidak memajang siaran kemarin. */
const UMUR_SIARAN_HIDUP = 10 * 60 * 1000;

export function usePosisi(): HasilData<Posisi[]> & {
  pending: OrderBursa[]; stop: OrderBursa[]; bursaAktif: boolean;
  /** Kapan `public/posisiTerbuka` terakhir ditulis, atau null kalau belum
   *  pernah. Dipakai panelnya untuk mengatakan UMUR catatannya. */
  siaranPada: number | null;
  /** Siaran screener ada tapi sudah berhenti berdetak — barisnya sengaja
   *  TIDAK ditampilkan, dan panelnya memakai ini untuk mengatakan kenapa. */
  siaranBasi: boolean;
  /** Bursa yang jawabannya gagal pada putaran terakhir. Daftar posisi yang
   *  memendek diam-diam adalah kebohongan yang menenangkan — lihat catatan
   *  di `usePosisiBinance`. */
  gagalBursa: { binance: string | null; hyperliquid: string | null };
  /** Pemeriksaan PERTAMA ke bursa belum selesai — panelnya menulis
   *  "membaca", bukan "kosong" atau "catatan basi". */
  memeriksaBursa: boolean;
  /** Pembacaan terakhir gagal; yang tampil angka satu putaran sebelumnya. */
  tersendat: boolean;
} {
  const { pengguna, memuat: memuatAuth, pemilik } = useAuth();
  /* Kosong, bukan posisi contoh — alasan yang sama dengan `useRiwayat`:
     sebelum dokumen publiknya terbaca, pemilik tanpa bursa aktif sempat
     melihat BTC/SOL contoh di bawah judul "Posisi Terbuka". Contoh untuk
     pengunjung punya cabangnya sendiri di bawah, berlabel. */
  const [data, setData] = useState<Posisi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [ada, setAda] = useState(false);
  /* ── KAPAN CATATANNYA DITULIS ────────────────────────────────────────
     Dilaporkan pemilik 21 Sep 2026: dua posisi muncul "tiba-tiba" di panel
     kripto. Ternyata bukan tiba-tiba — itu posisi simulasi screener miliknya
     sendiri yang disiarkan 18 Sep dan tidak pernah dibersihkan siapa pun.

     Screener hanya menulis dokumen ini SELAMA halamannya terbuka, dan hanya
     kalau isinya berubah. Jadi begitu halaman itu ditutup, baris terakhirnya
     menetap di sana tanpa batas waktu — dan panel ini menampilkannya seperti
     sesuatu yang sedang berjalan sekarang.

     Yang diperbaiki BUKAN dengan menyembunyikan barisnya kalau sudah tua:
     posisi simulasi yang memang masih terbuka berhari-hari juga tidak
     memperbarui stempel ini, karena isinya tidak berubah. Menyembunyikannya
     berarti menghilangkan posisi yang benar-benar ada. Yang benar
     mengatakan umurnya, lalu membiarkan pembacanya menilai. */
  const [siaranPada, setSiaranPada] = useState<number | null>(null);

  useEffect(() => {
    setMemuat(true);
    return onSnapshot(doc(db, 'public', 'posisiTerbuka'),
      (s) => {
        const daftar = s.exists() ? (s.data()?.posisi ?? []) : [];
        setData(Array.isArray(daftar) ? daftar.map(kePosisiPublik) : []);
        setAda(s.exists());
        const stempel = Number(s.data()?._updatedAt);
        setSiaranPada(Number.isFinite(stempel) && stempel > 0 ? stempel : null);
        setMemuat(false); setGalat(null);
      },
      (e) => { console.warn('posisiTerbuka:', e); setGalat(e.message); setMemuat(false); }
    );
  }, []);

  /* Bursa adalah pemutus terakhir — kalau App Token ada, Binance yang bicara.
     `public/posisiTerbuka` hanya memuat posisi yang dibuka lewat screener V2
     DAN hanya diperbarui selama halaman itu terbuka; posisi yang dibuka dari
     aplikasi Binance tidak pernah sampai ke sana.

     Yang dipertahankan dari dokumen publik: SL, TP, timeframe, dan waktu
     buka. Binance tidak mengirimkan keempatnya di rute posisi, jadi
     mengganti begitu saja akan menukar data yang lebih lengkap dengan yang
     lebih benar — padahal keduanya bisa dipakai bersama. */
  const { data: bursa, order, aktif, memeriksa: memeriksaBursa, gagal: gagalBursa, tersendat } = usePosisiBinance();

  /* Order ENTRY yang belum ke-fill: BELUM jadi posisi, jadi ia tidak
     boleh masuk daftar posisi — tapi juga tidak boleh hilang. Order yang
     terkirim lalu tak terlihat di mana pun membuat pemiliknya mengira
     pengirimannya gagal, lalu memesan lagi. Dua order untuk niat yang
     sama adalah kerugian yang lahir dari layar, bukan dari pasar. */
  const pending = useMemo(
    () => order.filter((o) => o.jenis === 'ENTRY').sort((a, b) => b.dibuat - a.dibuat),
    [order],
  );

  /* SL/TP yang terpasang di bursa, apa adanya.
     ─────────────────────────────────────────────────────────────────
     Di Binance Futures, SL/TP BUKAN bagian dari order entry — ia order
     kondisional tersendiri yang cuma terikat pada SIMBOL. Karena itu
     baris pending tidak bisa membawa SL/TP-nya sendiri, dan sebelum ini
     kolomnya selalu kosong walau stopnya benar-benar terpasang. Orang
     yang baru saja memasang SL lalu melihat kolom kosong wajar mengira
     pemasangannya gagal — padahal yang gagal cuma tampilannya. */
  const stop = useMemo(
    () => order.filter((o) => o.jenis === 'SL' || o.jenis === 'TP'),
    [order],
  );

  const gabungan = useMemo(() => {
    /* ── JANGAN MENEBAK SELAMA JAWABANNYA BELUM ADA ────────────────────
       Dulu baris ini cuma `if (!aktif) return data`. Masalahnya `aktif`
       bernilai false karena DUA sebab yang berbeda artinya: bursanya
       memang tidak tersambung, atau pemeriksaannya baru saja dimulai.

       Pada penyegaran halaman, sebab kedua yang berlaku — jadi dokumen
       publik ditampilkan lebih dulu, lalu diganti posisi bursa yang
       sebenarnya begitu jawabannya datang. Yang terlihat: satu posisi
       lama berkedip muncul lalu hilang sendiri. Dilaporkan pemiliknya
       sebagai MANAUSDT yang selalu nongol tiap refresh.

       Data contoh TIDAK bersalah di sini — isinya BTC, SOL, dan ADA;
       tidak ada MANAUSDT sama sekali. Yang berkedip itu dokumen publik
       `posisiTerbuka`, berisi posisi sungguhan.

       Sekarang: selama masih memeriksa, kembalikan KOSONG. Panel yang
       sekejap kosong jujur soal ketidaktahuannya; panel yang menampilkan
       posisi lama menyatakan sesuatu yang tidak benar tentang akun yang
       sedang dibuka. */
    if (memeriksaBursa) return [];
    if (!aktif) return data;
    const dariPublik = new Map(data.map((p) => [p.simbol, p]));
    return bursa.map((b): Posisi => {
      const p = dariPublik.get(b.simbol);
      /* SL/TP dari BURSA menang: itu order yang benar-benar terpasang dan
         akan benar-benar dieksekusi. Dokumen publik cuma dipakai kalau
         bursanya tidak menyebutkan stop untuk simbol itu — misalnya posisi
         lama yang stopnya dipasang manual di aplikasi Binance sebelum rute
         open-orders ada. */
      return p
        ? {
            /* Id dari BURSA, menimpa id dokumen publik. `dariPublik` dikunci
               simbol saja, jadi posisi Binance dan Hyperliquid untuk koin yang
               sama mencomot baris publik yang sama — dan ikut mewarisi id-nya
               kalau tidak ditimpa di sini. */
            ...p, id: idPosisiBursa(b), arah: b.arah, entry: b.entry || p.entry,
            sl: b.sl || p.sl, tp: b.tp || p.tp,
            jumlah: b.jumlah, pnlFloat: b.pnl,
            /* Dokumen publik tidak tahu bursanya; yang tahu jawaban bursa
               yang barusan menimpanya. Tanpa baris ini, posisi Hyperliquid
               yang KEBETULAN juga tercatat di dokumen publik tetap
               berlabel Binance. */
            venue: b.bursa === 'hyperliquid' ? 'Hyperliquid' : 'Binance Live',
            funding: b.funding,
          }
        : {
            id: idPosisiBursa(b),
            simbol: b.simbol, arah: b.arah, tf: '—',
            entry: b.entry, sl: b.sl, tp: b.tp, hargaKini: b.entry,
            /* Dibaca dari bursanya sendiri. Dulu dikeraskan 'Binance Live',
               dan sesudah jalur Hyperliquid ada itu jadi keterangan yang
               SALAH — bukan kurang lengkap, salah. */
            venue: b.bursa === 'hyperliquid' ? 'Hyperliquid' : 'Binance Live', buka: 0,
            jumlah: b.jumlah, pnlFloat: b.pnl, funding: b.funding,
          };
    });
  }, [aktif, bursa, data, memeriksaBursa]);

  /* ── PENGUNJUNG TANPA SESI melihat contoh, bukan sisa milik pemilik ────
     `public/posisiTerbuka` memang sengaja publik, dan dulu itu yang
     ditampilkan ke pengunjung. Masalahnya isinya satu-dua baris posisi
     pemilik yang kebetulan sedang jalan — sementara panel Trade-Fi di
     sebelahnya sudah punya tiga posisi dan dua pending dari contoh MT5.
     Panel kembar yang timpang isinya terbaca sebagai fitur setengah jadi,
     dan itu kesan pertama satu-satunya yang dibawa orang.

     Cabangnya menunggu `memuatAuth` selesai. Tanpa itu, pemilik yang
     menyegarkan halaman melihat kedipan data contoh selama ~300 ms
     pertama, sebelum Firebase memulihkan sesinya dari IndexedDB.

     Yang SUDAH masuk sama sekali tidak lewat sini — dokumen publik dan
     bursanya tetap jalan seperti biasa. */
  if (!memuatAuth && !pengguna) {
    return {
      data: POSISI_KRIPTO_CONTOH, pending: PENDING_KRIPTO_CONTOH, stop: STOP_KRIPTO_CONTOH,
      /* Data contoh: tidak ada bursa di belakangnya, dan memang tidak
         mengaku begitu — subjudulnya sudah diurus label "contoh". */
      bursaAktif: false,
      /* Pengunjung melihat data contoh, dan contoh tidak punya umur siaran —
         menyebut tanggal untuk angka yang dikarang justru membuatnya terbaca
         seperti catatan sungguhan. */
      siaranPada: null, siaranBasi: false,
      gagalBursa: { binance: null, hyperliquid: null },
      memeriksaBursa: false, tersendat: false,
      memuat: false, contoh: true, galat: null,
    };
  }

  /* ── DOKUMEN PUBLIK ITU MILIK PEMILIK, bukan milik yang membacanya ─────
     Ini perbaikan bug yang dilaporkan: pengguna baru menekan "Mulai dari
     nol", seluruh angka lain jujur jadi nol — lalu panel "Posisi Terbuka —
     Kripto" tetap menampilkan MANAUSDT, dan Activity menulis "Posisi
     MANAUSDT BUY terbuka di Binance Live". Itu posisi PEMILIK, di bawah
     judul "Order yang sedang berjalan di Binance", di dasbor orang lain.
     Bukan sekadar sisa data contoh — itu menyatakan sesuatu yang tidak
     benar tentang akun yang sedang dibuka.

     `public/posisiTerbuka` ditulis screener V2 dari peramban pemilik, jadi
     isinya memang posisi pemilik. Aturannya sekarang mengikuti kepemilikan
     itu:
       · belum masuk        -> data contoh (cabang di atas)
       · pemilik            -> dokumennya sendiri, seperti sebelumnya
       · sudah masuk, bursa aktif -> posisi miliknya sendiri dari bursa
       · sudah masuk, tanpa bursa -> KOSONG

     Yang dicabut: pengunjung yang sudah masuk tidak lagi melihat posisi
     pemilik sebagai etalase. Sebab aslinya (tugas 8, "posisi terbuka
     pemilik terlihat oleh semua pengguna") tetap dihormati untuk yang
     BELUM masuk — merekalah etalasenya — dan mereka sekarang malah dapat
     tampilan yang lebih penuh lewat data contoh.

     Yang DIPERTAHANKAN: saat bursanya aktif, dokumen publik tetap dipakai
     memasok SL/TP, timeframe, dan waktu buka yang tidak dikirim Binance —
     itu tetap jalan lewat `gabungan` di atas.

     `pending` dan `stop` TIDAK ikut dijaga di sini, dan itu bukan
     kelalaian: keduanya datang dari `usePosisiBinance()` — order di bursa
     milik yang sedang masuk, lewat App Token-nya sendiri. Tanpa bursa aktif
     keduanya memang sudah kosong. */
  /* ── SIARAN YANG SUDAH BERHENTI BERDETAK TIDAK DITAMPILKAN ──────────
     Dilaporkan pemilik dua kali, terakhir 21 Sep 2026: posisi lama muncul
     lagi di panel kripto. Percobaan pertama cuma MENYEBUTKAN umurnya di
     subjudul — dan itu tidak cukup. Baris yang duduk di tabel berjudul
     "Posisi Terbuka" dibaca sebagai posisi terbuka, berapa pun keterangan
     yang ditempel di atasnya.

     Dulu ini tidak bisa diputuskan dari data: dengan aturan lama, stempel
     siaran cuma berubah saat ISI-nya berubah, jadi posisi simulasi yang
     memang masih terbuka berhari-hari punya stempel setua siaran yang
     sudah ditinggalkan. Menyembunyikan yang tua berarti ikut menghilangkan
     posisi yang benar-benar ada.

     Screener sekarang menulis ulang stempelnya tiap 2 menit selama
     halamannya hidup, isinya berubah atau tidak. Stempel tua karena itu
     berarti satu hal saja: screener sedang tidak berjalan. Tidak ada yang
     memantau posisi-posisi itu, tidak ada yang akan menutupnya, dan tidak
     ada yang akan memperbaruinya — memajangnya sebagai posisi berjalan
     adalah klaim yang tidak ditopang apa pun.

     Bursa yang aktif TIDAK terpengaruh: `aktif` berarti angkanya datang
     dari Binance lewat App Token, dan dokumen publik cuma memasok SL/TP
     serta timeframe. Yang dijaga di sini hanya keadaan tanpa bursa, saat
     dokumen itu satu-satunya sumbernya. */
  /* `!memeriksaBursa` ditambahkan 27 Sep 2026. Selama pemeriksaan pertama
     `aktif` masih false — bukan karena bursanya tidak tersambung, tapi
     karena jawabannya belum datang. Tanpa penjaga ini panelnya menulis
     "catatan screener sudah lama" selama 0,3-7,5 detik tiap kali dipasang,
     lalu posisinya muncul: kedipan yang dilaporkan pemilik. Daftarnya
     sendiri sudah dikosongkan selama memeriksa (lihat `gabungan`); yang
     terlewat cuma penanda basinya. */
  const basi = !aktif && !memeriksaBursa && siaranPada !== null
    && Date.now() - siaranPada > UMUR_SIARAN_HIDUP;

  return {
    data: pemilik || aktif ? (basi ? [] : gabungan) : [],
    pending, stop,
    /* Apakah daftar ini benar-benar dibacakan BURSA, atau cuma dokumen
       publik screener. Dua hal yang sangat berbeda, dan sebelum ini panelnya
       menyebut keduanya "Order yang sedang berjalan di Binance".

       Tanpa App Token, yang tampil adalah dokumen yang ditulis screener V2
       dan hanya diperbarui selama halaman itu terbuka — posisi yang sudah
       tertutup bisa tertinggal berhari-hari di sana. Menyebutnya berjalan di
       bursa adalah klaim yang tidak bisa ditopang apa pun. */
    bursaAktif: aktif,
    siaranPada,
    siaranBasi: basi,
    gagalBursa,
    memeriksaBursa, tersendat,
    /* `contoh` berarti "ini bukan datamu, ini contoh". Dokumen publik itu
       data sungguhan, jadi labelnya hanya muncul kalau dokumennya memang
       belum ada. */
    memuat: memuat || memuatAuth, contoh: !ada && !pengguna, galat,
  };
}

/** Ringkasan pra-hitung. Satu pembacaan, bukan 400.
 *
 *  Inilah yang menjaga kuota: Dashboard dan Beranda cuma perlu total dan
 *  winrate, dan membaca seluruh transaksi untuk itu adalah pemborosan yang
 *  tumbuh seiring jumlah pengguna. */
export function useRingkasan(): HasilData<Ringkasan | null> {
  const { pengguna, memuat: memuatAuth } = useAuth();
  const [data, setData] = useState<Ringkasan | null>(null);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    if (memuatAuth) return;
    if (!pengguna) { setData(null); setMemuat(false); return; }
    setMemuat(true);
    return onSnapshot(doc(db, 'users', pengguna.uid, 'agregat', 'ringkasan'),
      (s) => { setData(s.exists() ? (s.data() as Ringkasan) : null); setMemuat(false); },
      (e) => { console.warn('ringkasan:', e); setMemuat(false); }
    );
  }, [pengguna, memuatAuth]);

  return { data, memuat: memuat || memuatAuth, contoh: !pengguna, galat: null };
}

/** Katalog Marketplace dari `public/marketplace`.
 *
 *  Dokumen ini boleh dibaca SIAPA SAJA — termasuk yang belum login — karena
 *  aturan `public/{docId}` memang begitu. Jadi tidak ada mode contoh di sini:
 *  pengunjung melihat katalog yang sama persis dengan pelanggan.
 *
 *  Isinya disimpan sebagai STRING JSON di field `produk`, bukan array. Itu
 *  bentuk yang ditulis panel pemilik V2, dan mengubahnya berarti memutus
 *  halaman yang sekarang tayang — jadi dibaca apa adanya, diurai di sini. */
export interface HasilProduk extends HasilData<Produk[]> {
  /** Objek katalog APA ADANYA dari Firestore.
   *
   *  Dipakai saat menulis balik. Katalog nyata punya field yang tidak ada di
   *  antarmuka `Produk` (dan bisa bertambah kapan saja lewat panel V2);
   *  menulis ulang dari bentuk yang sudah dipetakan akan diam-diam membuang
   *  field yang tidak dikenali — menghapus SATU produk bisa melucuti
   *  tangkapan layar dan tautan beli milik semua produk lain. */
  mentah: any[];
  /** Tempat sampah, apa adanya. Panel pemilik V2 menyimpannya di dokumen yang
   *  sama (field `sampah`), jadi V3 harus membacanya dari sana juga — kalau
   *  tidak, produk yang dibuang lewat V2 akan hilang tanpa jejak di V3. */
  sampahMentah: any[];
}

export function useProduk(): HasilProduk {
  const [data, setData] = useState<Produk[]>(PRODUK);
  const [mentah, setMentah] = useState<any[]>([]);
  const [sampahMentah, setSampahMentah] = useState<any[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [contoh, setContoh] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'public', 'marketplace'),
      (s) => {
        setMemuat(false);
        try {
          const s2 = s.data()?.sampah;
          const buang = typeof s2 === 'string' ? JSON.parse(s2) : s2;
          setSampahMentah(Array.isArray(buang) ? buang : []);
        } catch { setSampahMentah([]); }
        const mentah = s.data()?.produk;
        try {
          const daftar = typeof mentah === 'string' ? JSON.parse(mentah) : mentah;
          /* `mentah` (katalog apa adanya, untuk Maintenance) diperbarui bahkan
             saat katalognya KOSONG. Sebelumnya seluruh blok ini dijaga
             `daftar.length`, jadi menghapus produk terakhir tidak pernah
             sampai ke layar: daftarnya tetap menampilkan produk yang sudah
             tidak ada, dan tombol hapusnya terlihat rusak.

             Yang tetap dijaga `length` hanyalah `data` — daftar untuk etalase.
             Di sana katalog kosong memang lebih baik diganti contoh daripada
             halaman jualan yang benar-benar kosong. */
          if (Array.isArray(daftar)) setMentah(daftar);
          if (Array.isArray(daftar) && daftar.length) {
            setData(daftar.map((p: any): Produk => ({
              id: String(p.id ?? ''),
              nama: String(p.nama ?? ''),
              versi: String(p.versi ?? ''),
              harga: Number(p.harga) || 0,
              hargaAsal: Number(p.hargaAsal) > (Number(p.harga) || 0) ? Number(p.hargaAsal) : undefined,
              ringkas: String(p.ringkas ?? ''),
              fitur: Array.isArray(p.fitur) ? p.fitur.map(String) : [],
              premium: !!p.premium,
              detail: p.detail ? String(p.detail) : undefined,
              gambar: Array.isArray(p.gambar) ? p.gambar.map(String) : undefined,
              lynk: p.lynk ? String(p.lynk) : undefined,
              berkas: p.berkas ? String(p.berkas) : undefined,
              unduhan: p.unduhan === 'ex5' || p.unduhan === 'mq5' ? p.unduhan : undefined,
            })));
            setContoh(false);
          }
        } catch (e) {
          /* Katalog rusak → tetap tampilkan data contoh. Halaman jualan yang
             kosong lebih merugikan daripada halaman jualan yang agak usang. */
          console.warn('katalog marketplace tidak terbaca:', e);
          setGalat('Katalog tidak terbaca, menampilkan contoh.');
        }
      },
      (e) => { console.warn('marketplace:', e); setGalat(e.message); setMemuat(false); }
    );
  }, []);

  return { data, mentah, sampahMentah, memuat, contoh, galat };
}

/** Menulis katalog Marketplace kembali ke `public/marketplace`.
 *
 *  Formatnya HARUS sama dengan yang ditulis panel pemilik V2: field `produk`
 *  berisi STRING JSON, bukan array. Menulis array akan membuat halaman V2
 *  yang sekarang tayang berhenti membaca katalognya — dua aplikasi memakai
 *  dokumen yang sama, jadi bentuknya tidak boleh diubah sepihak.
 *
 *  Hanya pemilik yang diizinkan menulis (aturan `public/{docId}`), jadi
 *  panggilan ini akan ditolak untuk siapa pun selain dia. */
/** Tulis katalog + tempat sampah ke `public/marketplace`.
 *
 *  Bentuknya PERSIS seperti yang ditulis panel pemilik V2 (`pemilik.html`
 *  fungsi `simpanKatalog`): dua field JSON string, `merge: true`. Dua panel
 *  yang menulis dokumen yang sama harus sepakat soal bentuknya — kalau V3
 *  menulis array biasa sementara V2 menulis string, salah satunya akan
 *  membaca katalog kosong dan mengira semua produknya hilang.
 *
 *  Tempat sampah ikut ditulis. Tanpa itu, produk yang dibuang lenyap dari
 *  katalog TAPI tidak tersimpan di mana pun — jadi menyegarkan halaman
 *  menghapusnya untuk selamanya, padahal tombolnya menjanjikan bisa
 *  dipulihkan. */
export async function simpanKatalogProduk(produk: any[], sampah?: any[]): Promise<void> {
  const { setDoc } = await import('firebase/firestore');
  const muatan: Record<string, unknown> = { produk: JSON.stringify(produk), _updatedAt: Date.now() };
  if (sampah) muatan.sampah = JSON.stringify(sampah);
  await setDoc(doc(db, 'public', 'marketplace'), muatan, { merge: true });
}

/** Saldo awal dari profil V2 (`jtAccountProfile_v1`), yang masih tersimpan di
 *  dokumen `users/{uid}` — migrasi tidak memindahkannya, dan itu disengaja:
 *  profil bukan transaksi, tidak perlu jadi subkoleksi. */
export function useSaldoAwal(): number {
  const { pengguna } = useAuth();
  const [saldo, setSaldo] = useState(SALDO_AWAL);

  useEffect(() => {
    if (!pengguna) { setSaldo(SALDO_AWAL); return; }
    /* SUDAH LOGIN TAPI PROFILNYA BELUM ADA = NOL, bukan SALDO_AWAL.
       ──────────────────────────────────────────────────────────────────
       SALDO_AWAL (359) itu angka CONTOH untuk mode pameran. Dulu ia juga
       jadi nilai awal state untuk orang yang sudah login, jadi akun yang
       baru dibuat — nol transaksi, profil belum ada — membuka Dashboard
       dan melihat "Total Saldo $359.00 · Trade-Fi $359.00" tanpa satu pun
       label contoh. Angka itu terbaca sebagai UANG MILIKNYA, di halaman
       yang setiap angka lainnya sudah jujur menulis nol.

       Ditulis nol lebih dulu, lalu ditimpa profil kalau memang ada. */
    setSaldo(0);
    return onSnapshot(doc(db, 'users', pengguna.uid), (s) => {
      try {
        const p = JSON.parse(s.data()?.jtAccountProfile_v1 ?? '{}');
        setSaldo(typeof p.startBalance === 'number' ? p.startBalance : 0);
      } catch { setSaldo(0); }
    }, () => {});
  }, [pengguna]);

  return saldo;
}

/* ════════════════════════════════════════════════════════════════════════
   RINGKASAN AKUN UNTUK HALAMAN DEPAN
   ════════════════════════════════════════════════════════════════════════
   Hero halaman depan menampilkan saldo, jumlah transaksi, winrate, dan PNL.
   Sebelum ini ia menghitungnya sendiri dari `public/jurnalShowcase` — jurnal
   mentah versi V2 yang terakhir diperbarui saat V2 masih dipakai, sehingga
   angkanya perlahan menyimpang dari Dashboard.

   Sekarang Dashboard-lah yang MENERBITKAN ringkasannya, jadi keduanya
   membaca hasil hitungan yang sama persis. Ditulis hanya oleh pemilik, dan
   hanya kalau isinya benar-benar berubah — halaman depan tidak boleh
   membebani kuota tulis setiap kali dashboard dibuka.
   ════════════════════════════════════════════════════════════════════════ */

export interface RingkasanAkun {
  saldo: number;
  jumlah: number;
  winrate: number;
  bersih: number;
  /** Kurva saldo ringkas — maksimal 60 titik supaya dokumennya tetap kecil. */
  kurva: number[];
  /** `null` = tidak ada modal untuk membaginya; lihat `AngkaRingkas`. */
  tumbuh: number | null;
  /** Perubahan saldo dalam dolar pada jendela yang sama dengan `tumbuh`.
   *  Bentuk dokumen ini sengaja sama persis dengan `AngkaRingkas`; medan
   *  yang ditambahkan di satu sisi saja membuat halaman depan membaca
   *  dokumen yang tidak pernah memuatnya. */
  tumbuhUang: number;
  /** Waktu transaksi PALING LAMA — dipakai halaman depan untuk mengatakan
   *  sudah berapa lama tools ini dipakai, bukan sekadar berapa transaksi. */
  sejak: number;
}

export async function terbitkanRingkasan(r: RingkasanAkun) {
  const { setDoc, deleteField } = await import('firebase/firestore');
  await setDoc(doc(db, 'public', 'ringkasanAkun'), {
    ...r,
    kurva: r.kurva.slice(-60).map((x) => Number(x.toFixed(2))),
    /* ── `contohTrade` DICABUT, DAN YANG SUDAH TERBIT DIHAPUS ───────────
       Dulu 150 transaksi terakhir pemilik (pair, arah, waktu, P/L, lot,
       emosi) ikut terbit di sini sebagai bahan contoh untuk mode preview
       dan akun baru. Pembacanya sudah tidak ada: contoh sekarang
       dibangkitkan di data/contoh.ts.

       Menyiarkan transaksi sungguhan ke dokumen yang terbaca siapa saja
       tanpa login cuma pantas selama ada yang membutuhkannya. `deleteField`
       — bukan sekadar berhenti menulis — karena `merge: true` membiarkan
       medan lama tetap di tempatnya selamanya. */
    contohTrade: deleteField(),
    _updatedAt: Date.now(),
  }, { merge: true });
}

/** Judul & subjudul hero halaman depan. Menumpang public/ringkasanAkun —
 *  dokumen yang memang sudah diambil halaman depan lewat REST, jadi teks
 *  terbitan pemilik sampai ke semua pengunjung tanpa satu permintaan baru. */
export async function terbitkanTeksBeranda(judul: string, sub: string) {
  const { setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'public', 'ringkasanAkun'),
    { teksJudul: judul, teksSub: sub, _updatedAt: Date.now() }, { merge: true });
}


