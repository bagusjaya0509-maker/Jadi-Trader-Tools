import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { bacaKoneksi } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   SALDO AKUN — MT5 & Binance
   ════════════════════════════════════════════════════════════════════════
   Dua sambungan, dua cara membuktikan diri, dan itu bukan kerumitan yang
   dibuat-buat:

     · MT5     — `/api/mt5/status` dijaga ID token Firebase. Yang dikirim EA
                 adalah data milik AKUN YANG LOGIN, jadi servernya harus tahu
                 siapa yang bertanya.
     · Binance — `/api/account` dijaga header `X-App-Token`. Tokennya milik
                 VPS pengguna sendiri, bukan milik kami, jadi tidak ada
                 hubungannya dengan siapa yang login.

   Keduanya boleh gagal tanpa merusak apa pun. Jurnal tetap tampil dengan
   saldo hasil hitungan sendiri; yang hilang cuma badge "Connected".
   ════════════════════════════════════════════════════════════════════════ */

const PROXY_BAWAAN = 'https://103-253-145-38.sslip.io';
const JEDA_MS = 30_000;

function dasar() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}

export interface PosisiBroker {
  tiket: string;
  simbol: string;
  arah: 'BUY' | 'SELL';
  lot: number;
  hargaBuka: number;
  hargaKini: number;
  sl: number;
  tp: number;
  /** Sudah dikonversi ke USD — akun sen dibagi 100. */
  profit: number;
  waktuBuka: number;
}

export interface StatusAkun {
  /** null = belum diketahui (masih memeriksa). */
  terhubung: boolean | null;
  /** Saldo dari broker/bursa. null kalau tidak tersambung. */
  saldo: number | null;
  ekuitas: number | null;
  mataUang: string | null;
  ket: string;
  /** Posisi yang sedang terbuka di broker. Kosong kalau tidak tersambung. */
  posisi: PosisiBroker[];
}

const BELUM: StatusAkun = { terhubung: null, saldo: null, ekuitas: null, mataUang: null, ket: 'Memeriksa…', posisi: [] };

/** Akun sen dibagi 100. Tanpa ini akun cent terlihat 100× lebih besar —
 *  kekeliruan yang sama sudah pernah diperbaiki di jurnal V2. */
function keUsd(nilai: number, mataUang: string | null) {
  if (!mataUang) return nilai;
  return /cent|USC/i.test(mataUang) ? nilai / 100 : nilai;
}

export function useAkunMt5(): StatusAkun {
  const [st, setSt] = useState<StatusAkun>(BELUM);
  /* Auth Firebase memulihkan sesi dari IndexedDB SECARA ASINKRON. Selama
     ~300 ms pertama sesudah refresh, `auth.currentUser` masih null meski
     orangnya jelas sudah masuk.

     Efek ini dulu berdependensi `[]` dan langsung memanggil periksa(), jadi
     tiap refresh statusnya jatuh ke "belum tersambung" — lalu pulih sendiri
     saat interval 30 detik berikutnya jalan. Itulah kedipan connect/putus
     dan saldo yang berubah lalu kembali lagi.

     Sekarang pemeriksaan menunggu onAuthStateChanged. Tidak ada tebakan di
     antaranya: sebelum auth menjawab, statusnya tetap "Memeriksa…". */
  const [siapaUid, setSiapaUid] = useState<string | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, (u) => setSiapaUid(u ? u.uid : null)), []);

  useEffect(() => {
    let hidup = true;
    if (siapaUid === undefined) return;          // auth belum menjawab
    if (siapaUid === null) {
      setSt({ ...BELUM, terhubung: false, ket: 'Masuk dulu untuk menyambungkan' });
      return;
    }

    async function periksa() {
      const u = auth.currentUser;
      if (!u) return;
      try {
        const token = await u.getIdToken();
        const r = await fetch(`${dasar()}/api/mt5/status`, { headers: { Authorization: 'Bearer ' + token } });
        if (!hidup) return;
        if (!r.ok) { setSt({ ...BELUM, terhubung: false, ket: 'Backend tidak menjawab' }); return; }
        const j = await r.json();
        const akun = j?.data?.akun;
        /* EA yang MATI bukan akun yang hilang. Server tetap menyimpan
           laporan terakhirnya, jadi saldo terakhir itulah yang dipakai —
           kembali ke hitungan jurnal (~$300) setiap MT5 ditutup membuat
           angkanya melompat dua kali sehari tanpa satu pun transaksi. */
        if (!akun) {
          setSt({ ...BELUM, terhubung: false, ket: j?.kode ? `Kode ${j.kode} — EA belum melapor` : 'EA belum terpasang' });
          return;
        }
        const eaHidup = !!j?.terhubung;
        const mu = akun.mataUang ?? null;
        /* Profit tiap posisi ikut dikonversi. Akun ini bermata uang USC
           (sen), jadi tanpa pembagian 100 satu posisi rugi -50,60 sen
           terbaca sebagai rugi $50,60 — hampir seratus kali lipat. */
        const posisi: PosisiBroker[] = (j?.data?.posisi ?? []).map((p: any) => ({
          tiket: String(p.tiket ?? ''),
          simbol: String(p.simbol ?? ''),
          arah: p.arah === 'SELL' ? 'SELL' : 'BUY',
          lot: Number(p.lot) || 0,
          hargaBuka: Number(p.hargaBuka) || 0,
          hargaKini: Number(p.hargaKini) || 0,
          sl: Number(p.sl) || 0,
          tp: Number(p.tp) || 0,
          profit: keUsd((Number(p.profit) || 0) + (Number(p.swap) || 0), mu),
          /* EA mengirim detik, bukan milidetik. */
          waktuBuka: (Number(p.waktuBuka) || 0) * 1000,
        }));
        setSt({
          terhubung: eaHidup,
          saldo: keUsd(Number(akun.saldo) || 0, mu),
          ekuitas: keUsd(Number(akun.ekuitas) || 0, mu),
          mataUang: mu,
          ket: eaHidup
            ? (akun.login ? `Akun ${akun.login} · ${akun.broker ?? ''}`.trim() : 'MetaTrader 5')
            : 'EA offline — saldo dari laporan terakhir',
          /* Posisi TIDAK ditampilkan saat EA mati: saldo terakhir tetap
             benar sampai ada transaksi, tapi posisi terbuka bisa sudah
             berubah tanpa kita tahu. */
          posisi: eaHidup ? posisi : [],
        });
      } catch {
        if (hidup) setSt({ ...BELUM, terhubung: false, ket: 'Tidak bisa menghubungi backend' });
      }
    }

    void periksa();
    const jam = setInterval(periksa, JEDA_MS);
    return () => { hidup = false; clearInterval(jam); };
  }, [siapaUid]);

  return st;
}

/* ── Kode pasangan MT5 ────────────────────────────────────────────────────
   Kode dibaca dari `/api/mt5/status`, TIDAK dibuat saat halaman dibuka.

   `POST /api/mt5/kode` memutar kodenya — kode lama dibuang dan EA yang
   sedang berjalan langsung terputus. Kalau dipanggil tiap kali halaman
   Integrations dibuka, sambungan MT5 putus setiap kali orang melihatnya.
   Jadi POST hanya dilakukan saat tombol "Buat kode baru" ditekan.

   Bentuk kodenya `JTM5-XXXX-XXXX`, divalidasi backend dengan regex ketat.
   Halaman ini sebelumnya menampilkan `JT-4F2A-91C7` yang ditulis mati di
   kode — awalannya salah DAN tidak pernah terdaftar, jadi EA yang memakainya
   selalu ditolak 400 "Kode Pasangan tidak valid". */
export interface KodeMt5 {
  kode: string | null;
  memuat: boolean;
  galat: string | null;
  buatBaru: () => Promise<void>;
  putus: () => Promise<void>;
  segarkan: () => Promise<void>;
}

export function useKodeMt5(): KodeMt5 {
  const [kode, setKode] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  async function panggil(jalur: string, metode: 'GET' | 'POST') {
    const u = auth.currentUser;
    if (!u) throw new Error('Masuk dulu dengan akun Google.');
    const token = await u.getIdToken();
    const r = await fetch(`${dasar()}${jalur}`, {
      method: metode,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: metode === 'POST' ? '{}' : undefined,
    });
    if (!r.ok) throw new Error(`Backend menjawab ${r.status}`);
    return r.json();
  }

  const segarkan = useCallback(async () => {
    setMemuat(true); setGalat(null);
    try {
      const j = await panggil('/api/mt5/status', 'GET');
      setKode(j?.kode ?? null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membaca kode');
      setKode(null);
    } finally {
      setMemuat(false);
    }
  }, []);

  const buatBaru = useCallback(async () => {
    setMemuat(true); setGalat(null);
    try {
      const j = await panggil('/api/mt5/kode', 'POST');
      setKode(j?.kode ?? null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuat kode');
    } finally {
      setMemuat(false);
    }
  }, []);

  const putus = useCallback(async () => {
    setMemuat(true); setGalat(null);
    try {
      await panggil('/api/mt5/putus', 'POST');
      setKode(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memutus');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const lepas = onAuthStateChanged(auth, (u) => {
      if (u) void segarkan();
      else { setKode(null); setMemuat(false); setGalat(null); }
    });
    return lepas;
  }, [segarkan]);

  return { kode, memuat, galat, buatBaru, putus, segarkan };
}

export function useAkunBinance(): StatusAkun {
  const [st, setSt] = useState<StatusAkun>(BELUM);
  const { url, token } = bacaKoneksi();

  useEffect(() => {
    let hidup = true;

    async function periksa() {
      if (!url.trim() || !token.trim()) {
        if (hidup) setSt({ ...BELUM, terhubung: false, ket: 'Backend URL & App Token belum diisi' });
        return;
      }
      try {
        const r = await fetch(`${dasar()}/api/account`, { headers: { 'X-App-Token': token.trim() } });
        if (!hidup) return;
        if (r.status === 401) { setSt({ ...BELUM, terhubung: false, ket: 'App Token ditolak' }); return; }
        if (!r.ok) { setSt({ ...BELUM, terhubung: false, ket: 'Backend tidak menjawab' }); return; }
        const j = await r.json();
        /* Bentuk balasan Binance Futures: totalWalletBalance & totalMarginBalance,
           keduanya string. Number() bukan pilihan gaya — tanpa itu saldo
           dibandingkan sebagai teks. */
        const saldo = Number(j?.totalWalletBalance);
        const ekuitas = Number(j?.totalMarginBalance ?? j?.totalWalletBalance);
        if (!isFinite(saldo)) { setSt({ ...BELUM, terhubung: false, ket: 'Balasan tidak dikenali' }); return; }
        /* Posisi Binance TIDAK diambil dari sini. `/api/account` memang
           membawa `positions`, tapi ratusan baris dengan qty 0 untuk setiap
           simbol yang pernah disentuh — menyaringnya di sisi layar berarti
           mengunduh ratusan kilobyte tiap 30 detik. Posisi kripto yang
           dipakai V3 datang dari Firestore, yang memang sudah menyimpan
           hanya yang benar-benar terbuka. */
        setSt({
          terhubung: true, saldo, ekuitas: isFinite(ekuitas) ? ekuitas : saldo,
          mataUang: 'USDT', ket: 'Binance Futures', posisi: [],
        });
      } catch {
        if (hidup) setSt({ ...BELUM, terhubung: false, ket: 'Tidak bisa menghubungi backend' });
      }
    }

    periksa();
    const jam = setInterval(periksa, JEDA_MS);
    return () => { hidup = false; clearInterval(jam); };
  }, [url, token]);

  return st;
}
