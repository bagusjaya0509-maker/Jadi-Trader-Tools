import { useEffect, useState } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, orderBy, limit, query, Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
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

const BATAS_TRANSAKSI = 400;

/* Berkas ini hanya diimpor halaman-halaman yang dimuat malas, jadi impor
   statis Firestore di atas TIDAK ikut ke jalur muat awal. getFirestore aman
   dipanggil lagi di sini — Firebase mengembalikan instans yang sama. */
const db = getFirestore(app);

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
  };
}

function kePosisi(id: string, d: DocumentData): Posisi {
  const venue: Posisi['venue'] =
    d.venue === 'sim' ? 'Simulasi' : d.venue === 'mt5' ? 'MT5' : 'Binance Live';
  return {
    id,
    simbol: d.simbol ?? '',
    arah: d.arah === 'SELL' ? 'SELL' : 'BUY',
    tf: d.tf ?? '—',
    entry: n(d.masukHarga),
    sl: n(d.sl),
    tp: n(d.tp1),
    /* Harga terkini tidak disimpan di Firestore — ia milik pasar, bukan
       milik kita. Sampai proxy harga tersambung, entry dipakai sebagai
       tempat berdiri supaya kolom "gerak" menampilkan 0,00% dan bukan
       angka karangan. */
    hargaKini: n(d.masukHarga),
    venue,
    buka: ms(d.masukWaktu),
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
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (memuatAuth) return;
    if (!pengguna) { setData(RIWAYAT); setMemuat(false); return; }
    setMemuat(true);
    const q = query(
      collection(db, 'users', pengguna.uid, 'transaksi'),
      orderBy('keluarWaktu', 'desc'),
      limit(BATAS_TRANSAKSI)
    );
    return onSnapshot(q,
      (s) => { setData(s.docs.map((d) => keTrade(d.id, d.data()))); setMemuat(false); setGalat(null); },
      (e) => { console.warn('riwayat:', e); setGalat(e.message); setMemuat(false); }
    );
  }, [pengguna, memuatAuth]);

  return { data, memuat: memuat || memuatAuth, contoh: !pengguna, galat };
}

export function usePosisi(): HasilData<Posisi[]> {
  const { pengguna, memuat: memuatAuth } = useAuth();
  const [data, setData] = useState<Posisi[]>(POSISI_TERBUKA);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (memuatAuth) return;
    if (!pengguna) { setData(POSISI_TERBUKA); setMemuat(false); return; }
    setMemuat(true);
    return onSnapshot(collection(db, 'users', pengguna.uid, 'posisi'),
      (s) => { setData(s.docs.map((d) => kePosisi(d.id, d.data()))); setMemuat(false); setGalat(null); },
      (e) => { console.warn('posisi:', e); setGalat(e.message); setMemuat(false); }
    );
  }, [pengguna, memuatAuth]);

  return { data, memuat: memuat || memuatAuth, contoh: !pengguna, galat };
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
export function useProduk(): HasilData<Produk[]> {
  const [data, setData] = useState<Produk[]>(PRODUK);
  const [memuat, setMemuat] = useState(true);
  const [contoh, setContoh] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'public', 'marketplace'),
      (s) => {
        setMemuat(false);
        const mentah = s.data()?.produk;
        try {
          const daftar = typeof mentah === 'string' ? JSON.parse(mentah) : mentah;
          if (Array.isArray(daftar) && daftar.length) {
            setData(daftar.map((p: any): Produk => ({
              id: String(p.id ?? ''),
              nama: String(p.nama ?? ''),
              versi: String(p.versi ?? ''),
              harga: Number(p.harga) || 0,
              ringkas: String(p.ringkas ?? ''),
              fitur: Array.isArray(p.fitur) ? p.fitur.map(String) : [],
              premium: !!p.premium,
              detail: p.detail ? String(p.detail) : undefined,
              gambar: Array.isArray(p.gambar) ? p.gambar.map(String) : undefined,
              lynk: p.lynk ? String(p.lynk) : undefined,
              berkas: p.berkas ? String(p.berkas) : undefined,
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

  return { data, memuat, contoh, galat };
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
