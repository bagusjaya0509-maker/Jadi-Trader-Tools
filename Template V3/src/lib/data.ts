import { useEffect, useMemo, useState } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, orderBy, limit, query, where, Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { usePosisiBinance } from '@/lib/admin';
import {
  RIWAYAT, POSISI_TERBUKA, SALDO_AWAL, PRODUK,
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
export const db = getFirestore(app);

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
    emosi: d.psikologi?.emosiMasuk ?? undefined,
    alasan: d.psikologi?.alasanMasuk ?? d.sebabKeluar ?? undefined,
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
    nilaiOrder: n(d.ukuran?.margin) && n(d.ukuran?.leverage)
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
  const [data, setData] = useState<Trade[]>(RIWAYAT);
  const [, setVersiPilihan] = useState(0);
  useEffect(() => {
    const naik = () => setVersiPilihan((v) => v + 1);
    window.addEventListener('jt:pilihan-contoh', naik);
    return () => window.removeEventListener('jt:pilihan-contoh', naik);
  }, []);

  /* Contoh NYATA dari akun pemilik — sekali muat, dipakai saat layar butuh
     data contoh (belum login, atau akun baru yang masih kosong). */
  const [contohNyata, setContohNyata] = useState<Trade[] | null>(null);
  useEffect(() => { void ambilContohNyata().then(setContohNyata); }, []);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (memuatAuth) return;
    if (!pengguna) { setData(RIWAYAT); setMemuat(false); return; }
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
  return {
    /* Prioritas contoh: transaksi NYATA pemilik > contoh statis. */
    data: pakaiContoh ? (contohNyata ?? RIWAYAT) : data,
    memuat: memuat || memuatAuth,
    contoh: pakaiContoh,
    galat,
  };
}

/* Pilihan pengguna atas data contoh: 'kosong' = mulai dari nol,
   'biarkan' = tetap tampilkan contoh (spanduknya saja yang hilang). */
export function bacaPilihanContoh(uid: string): 'kosong' | 'biarkan' | null {
  try {
    const v = localStorage.getItem(`jt.pilihanContoh.${uid}`);
    return v === 'kosong' || v === 'biarkan' ? v : null;
  } catch { return null; }
}
export function simpanPilihanContoh(uid: string, v: 'kosong' | 'biarkan') {
  try { localStorage.setItem(`jt.pilihanContoh.${uid}`, v); } catch { /* privat */ }
  window.dispatchEvent(new CustomEvent('jt:pilihan-contoh'));
}

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
export function usePosisi(): HasilData<Posisi[]> {
  const { pengguna, memuat: memuatAuth } = useAuth();
  const [data, setData] = useState<Posisi[]>(POSISI_TERBUKA);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [ada, setAda] = useState(false);

  useEffect(() => {
    setMemuat(true);
    return onSnapshot(doc(db, 'public', 'posisiTerbuka'),
      (s) => {
        const daftar = s.exists() ? (s.data()?.posisi ?? []) : [];
        setData(Array.isArray(daftar) ? daftar.map(kePosisiPublik) : []);
        setAda(s.exists());
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
  const { data: bursa, aktif } = usePosisiBinance();

  const gabungan = useMemo(() => {
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
            ...p, arah: b.arah, entry: b.entry || p.entry,
            sl: b.sl || p.sl, tp: b.tp || p.tp,
            jumlah: b.jumlah, pnlFloat: b.pnl,
          }
        : {
            id: `bursa-${b.simbol}`,
            simbol: b.simbol, arah: b.arah, tf: '—',
            entry: b.entry, sl: b.sl, tp: b.tp, hargaKini: b.entry,
            venue: 'Binance Live', buka: 0,
            jumlah: b.jumlah, pnlFloat: b.pnl,
          };
    });
  }, [aktif, bursa, data]);

  /* `contoh` berarti "ini bukan datamu, ini contoh". Dokumen publik itu data
     sungguhan, jadi labelnya hanya muncul kalau dokumennya memang belum ada. */
  return { data: gabungan, memuat: memuat || memuatAuth, contoh: !ada && !pengguna, galat };
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
    return onSnapshot(doc(db, 'users', pengguna.uid), (s) => {
      try {
        const p = JSON.parse(s.data()?.jtAccountProfile_v1 ?? '{}');
        if (typeof p.startBalance === 'number') setSaldo(p.startBalance);
      } catch { /* profil belum ada — pakai bawaan */ }
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
  tumbuh: number;
  /** Waktu transaksi PALING LAMA — dipakai halaman depan untuk mengatakan
   *  sudah berapa lama tools ini dipakai, bukan sekadar berapa transaksi. */
  sejak: number;
}

export async function terbitkanRingkasan(r: RingkasanAkun, trade?: Trade[]) {
  const { setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'public', 'ringkasanAkun'), {
    ...r,
    kurva: r.kurva.slice(-60).map((x) => Number(x.toFixed(2))),
    /* Transaksi pemilik (dipadatkan) ikut terbit sebagai DATA CONTOH untuk
       akun baru — halaman kosong tidak menjelaskan apa pun tentang apa yang
       akan didapat. Hanya field yang dipakai layar; tanpa catatan pribadi. */
    ...(trade ? {
      contohTrade: trade.slice(0, 150).map((t) => ({
        p: t.pair, a: t.arah, s: t.sumber, w: t.waktu,
        n: Number(t.pnl.toFixed(2)), l: t.lot ?? 0,
        e: t.emosi ?? '', u: t.alasan ?? '',
      })),
    } : {}),
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

/* Data contoh NYATA milik pemilik, dibaca akun baru & mode pameran.
   Dimuat sekali per sesi; kalau dokumennya belum ada (pemilik belum pernah
   membuka dashboard sejak fitur ini), jatuh ke contoh statis. */
let contohNyataCache: Trade[] | null | undefined;
export async function ambilContohNyata(): Promise<Trade[] | null> {
  if (contohNyataCache !== undefined) return contohNyataCache;
  try {
    const { getDoc } = await import('firebase/firestore');
    const s = await getDoc(doc(db, 'public', 'ringkasanAkun'));
    const mentah = s.data()?.contohTrade;
    if (!Array.isArray(mentah) || !mentah.length) { contohNyataCache = null; return null; }
    contohNyataCache = mentah.map((x: any, i: number): Trade => ({
      id: 'pub' + i,
      pair: String(x.p ?? ''),
      arah: x.a === 'SELL' ? 'SELL' : 'BUY',
      sumber: x.s === 'forex' ? 'forex' : 'kripto',
      waktu: Number(x.w) || 0,
      pnl: Number(x.n) || 0,
      lot: Number(x.l) || 0,
      emosi: String(x.e ?? ''),
      alasan: String(x.u ?? ''),
    } as Trade));
    return contohNyataCache;
  } catch {
    contohNyataCache = null;
    return null;
  }
}
