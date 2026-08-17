import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';
import { AKUN_MT5_CONTOH, pakaiContoh } from '@/lib/contoh-pratinjau';

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

/** Order MT5 yang MENUNGGU harga — belum jadi posisi.
 *
 *  MT5 menyimpannya terpisah dari posisi (OrdersTotal vs PositionsTotal),
 *  dan EA di bawah v2.05 tidak melaporkannya sama sekali. Akibatnya empat
 *  Sell Stop yang terpasang rapi di terminal tidak muncul di mana pun, dan
 *  layar berkata "0 posisi" — pernyataan yang benar tapi menyesatkan. */
export interface PendingBroker {
  tiket: string;
  simbol: string;
  /** BUY_STOP | SELL_STOP | BUY_LIMIT | SELL_LIMIT */
  jenis: string;
  arah: 'BUY' | 'SELL';
  lot: number;
  /** Harga pemicunya — inilah yang menentukan kapan ia jadi posisi. */
  harga: number;
  sl: number;
  tp: number;
  waktu: number;
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
  /** Order menggantung. Kosong kalau tidak tersambung ATAU kalau EA-nya
   *  masih di bawah v2.05 — versi lama tidak mengirim kolom ini, dan
   *  daftar kosong dari EA lama bukan bukti tidak ada pending. */
  pending: PendingBroker[];
  /** Versi EA yang MELAPOR, apa adanya ('' kalau tidak menyebutkan).
   *
   *  Dipakai untuk membedakan "tidak ada pending order" dari "EA-nya
   *  belum bisa melaporkan pending order". Dua keadaan itu terlihat sama
   *  persis di layar — kosong — dan itulah yang bikin orang mengira
   *  order-nya tidak terkirim padahal terpasang rapi di terminal. */
  versiEa: string;
}

/** Versi EA paling awal yang mengirim daftar pending order. */
export const VERSI_EA_PENDING = '2.05';

/** Bandingkan versi bergaya "2.4.1" tanpa terjebak perbandingan teks:
 *  "2.10" > "2.9" secara angka, tapi lebih kecil kalau diadu sebagai
 *  string. Versi EA akan menembus 2.10 cepat atau lambat. */
export function versiKurangDari(a: string, b: string): boolean {
  const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

const BELUM: StatusAkun = { terhubung: null, saldo: null, ekuitas: null, mataUang: null, ket: 'Memeriksa…', posisi: [], pending: [], versiEa: '' };

/* ── Saldo terakhir yang diketahui, per akun ──────────────────────────────
   Server menyimpan laporan EA terakhir DI MEMORI — restart pm2 menghapusnya,
   dan backend yang tak terjangkau tidak menjawab sama sekali. Dua-duanya
   membuat saldo "berjalan mundur" ke hitungan jurnal lama begitu MT5
   desktop ditutup. Salinan lokal ini membuat angka terakhir yang pernah
   TERBUKTI benar tetap dipakai sampai ada laporan baru. */
interface SaldoTersimpan { saldo: number; ekuitas: number; mataUang: string | null; waktu: number }

function simpanSaldoTerakhir(uid: string, s: SaldoTersimpan) {
  try { localStorage.setItem('jt.mt5Terakhir.' + uid, JSON.stringify(s)); } catch { /* privat */ }
}

function dariSimpanan(uid: string, sebab: string): StatusAkun | null {
  try {
    const s = JSON.parse(localStorage.getItem('jt.mt5Terakhir.' + uid) ?? 'null') as SaldoTersimpan | null;
    if (!s || !isFinite(s.saldo)) return null;
    const tgl = new Date(s.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return {
      terhubung: false, saldo: s.saldo, ekuitas: s.ekuitas, mataUang: s.mataUang,
      ket: `${sebab} — saldo terakhir (${tgl})`, posisi: [], pending: [], versiEa: '',
    };
  } catch { return null; }
}

/** Akun sen dibagi 100. Tanpa ini akun cent terlihat 100× lebih besar —
 *  kekeliruan yang sama sudah pernah diperbaiki di jurnal V2. */
function keUsd(nilai: number, mataUang: string | null) {
  if (!mataUang) return nilai;
  return /cent|USC/i.test(mataUang) ? nilai / 100 : nilai;
}

/* ── Pemicu baca-ulang segera ─────────────────────────────────────────
   Sesudah SL/TP sebuah posisi diubah, menunggu putaran 30 detik membuat
   layar mengatakan "berhasil" sementara tabel Posisi Terbuka masih
   memperlihatkan angka lama. Selisih itu terbaca sebagai "belum masuk",
   jadi perubahannya dikirim berkali-kali — dan tiap kiriman memasang
   stop baru. Panggil ini setelah perubahan supaya keduanya berubah
   berbarengan. */
const pendengarAkun = new Set<() => void>();
export function segarkanAkunMt5() { pendengarAkun.forEach((f) => f()); }

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
  const gagalBeruntun = useRef(0);

  useEffect(() => onAuthStateChanged(auth, (u) => setSiapaUid(u ? u.uid : null)), []);

  useEffect(() => {
    let hidup = true;
    if (siapaUid === undefined) return;          // auth belum menjawab
    if (siapaUid === null) {
      /* Belum masuk → tampilkan akun CONTOH, bukan kotak kosong $0.00.
         Panel Trade-Fi butuh MetaTrader hidup DAN EA terpasang; pengunjung
         yang belum punya keduanya cuma melihat kotak kosong, dan itu
         satu-satunya kesan yang ia bawa tentang fitur ini.

         `terhubung: false` DIPERTAHANKAN di data contohnya, dan itu
         penting: panel membaca bendera itu untuk memutuskan menampilkan
         lencana tersambung. Lencana tersambung yang tidak benar adalah
         cara tercepat membuat orang menutup MetaTrader sambil merasa
         posisinya tetap terpantau. */
      setSt(pakaiContoh(false) ? AKUN_MT5_CONTOH : { ...BELUM, terhubung: false, ket: 'Masuk dulu untuk menyambungkan' });
      return;
    }

    /* Kegagalan TUNGGAL (kuota Google cegukan, jaringan tersendat, server
       baru restart) TIDAK mengosongkan panel — posisi yang berkedip
       hilang-muncul tiap 30 detik jauh lebih menyesatkan daripada angka
       yang telat semenit. Baru setelah TIGA kegagalan beruntun keadaan
       buruknya diakui di layar. */
    const gagalLunak = (buat: () => StatusAkun) => {
      gagalBeruntun.current++;
      if (gagalBeruntun.current < 3) return;
      setSt(buat());
    };

    async function periksa() {
      const u = auth.currentUser;
      if (!u) return;
      try {
        const token = await u.getIdToken();
        const r = await fetch(`${dasar()}/api/mt5/status`, { headers: { Authorization: 'Bearer ' + token } });
        if (!hidup) return;
        if (!r.ok) { gagalLunak(() => dariSimpanan(u.uid, 'Backend tidak menjawab') ?? { ...BELUM, terhubung: false, ket: 'Backend tidak menjawab' }); return; }
        const j = await r.json();
        const akun = j?.data?.akun;
        /* EA yang MATI bukan akun yang hilang. Server tetap menyimpan
           laporan terakhirnya, jadi saldo terakhir itulah yang dipakai —
           kembali ke hitungan jurnal (~$300) setiap MT5 ditutup membuat
           angkanya melompat dua kali sehari tanpa satu pun transaksi. */
        if (!akun) {
          gagalLunak(() => dariSimpanan(u.uid, 'EA offline')
            ?? { ...BELUM, terhubung: false, ket: j?.kode ? `Kode ${j.kode} — EA belum melapor` : 'EA belum terpasang' });
          return;
        }
        gagalBeruntun.current = 0;
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
        const pending: PendingBroker[] = (j?.data?.pending ?? []).map((p: any) => ({
          tiket: String(p.tiket ?? ''),
          simbol: String(p.simbol ?? ''),
          jenis: String(p.jenis ?? ''),
          arah: p.arah === 'SELL' ? 'SELL' : 'BUY',
          lot: Number(p.lot) || 0,
          harga: Number(p.harga) || 0,
          sl: Number(p.sl) || 0,
          tp: Number(p.tp) || 0,
          waktu: (Number(p.waktu) || 0) * 1000,
        }));
        simpanSaldoTerakhir(u.uid, {
          saldo: keUsd(Number(akun.saldo) || 0, mu),
          ekuitas: keUsd(Number(akun.ekuitas) || 0, mu),
          mataUang: mu, waktu: Date.now(),
        });
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
          pending: eaHidup ? pending : [],
          versiEa: String(j?.data?.versiEa || ''),
        });
      } catch {
        if (hidup) gagalLunak(() => dariSimpanan(auth.currentUser?.uid ?? '', 'Backend tak terjangkau')
          ?? { ...BELUM, terhubung: false, ket: 'Tidak bisa menghubungi backend' });
      }
    }

    void periksa();
    const jam = setInterval(periksa, JEDA_MS);
    /* Ikut mendengar permintaan baca-ulang segera. */
    const dengar = () => { void periksa(); };
    pendengarAkun.add(dengar);
    return () => { hidup = false; clearInterval(jam); pendengarAkun.delete(dengar); };
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
          mataUang: 'USDT', ket: 'Binance Futures', posisi: [], pending: [], versiEa: '',
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
