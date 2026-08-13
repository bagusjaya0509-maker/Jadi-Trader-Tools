import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { bacaKoneksi } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   DATA PEMILIK — trafik, klien, penjualan, laporan, lisensi, status VPS
   ════════════════════════════════════════════════════════════════════════
   Semuanya sudah ada di backend VPS sejak V2; halaman Traffic & Sales cuma
   belum pernah menanyakannya. Sampai sekarang halaman itu menampilkan
   `KLIEN`, `PENJUALAN`, `LAPORAN`, `VPS`, dan `TRAFIK` dari data/contoh.ts —
   angka karangan yang tidak pernah berubah, di halaman yang justru dipakai
   untuk mengambil keputusan.

   Enam rute di bawah ini dijaga `X-App-Token`, bukan login Firebase: token
   itu milik VPS pemiliknya sendiri. Jadi tanpa App Token di Integrations,
   halaman ini memang tidak bisa menampilkan apa-apa — dan lebih baik
   mengatakannya daripada diam-diam jatuh ke data contoh.
   ════════════════════════════════════════════════════════════════════════ */

const PROXY_BAWAAN = 'https://103-253-145-38.sslip.io';
/** Sama dengan jeda di lib/akun.ts — dua panel yang menanyakan hal yang
 *  sama tidak boleh menyegarkan diri pada irama berbeda. */
const JEDA_MS = 30_000;

function dasar() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}

export interface Hasil<T> {
  data: T;
  memuat: boolean;
  galat: string | null;
  muatUlang: () => void;
}

/** Satu pola untuk keenam rute: ambil, urai, dan sediakan `muatUlang` supaya
 *  panel bisa menyegarkan diri setelah menulis sesuatu. */
function useRute<T>(jalur: string, ambilData: (j: any) => T, awal: T): Hasil<T> {
  const [data, setData] = useState<T>(awal);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [putaran, setPutaran] = useState(0);
  const { token } = bacaKoneksi();

  useEffect(() => {
    let hidup = true;
    if (!token.trim()) {
      setMemuat(false);
      setGalat('App Token belum diisi di Integrations');
      return;
    }
    setMemuat(true);
    fetch(`${dasar()}${jalur}`, { headers: { 'X-App-Token': token.trim() } })
      .then(async (r) => {
        if (r.status === 401) throw new Error('App Token ditolak');
        if (!r.ok) throw new Error(`Backend menjawab ${r.status}`);
        return r.json();
      })
      .then((j) => { if (hidup) { setData(ambilData(j)); setGalat(null); setMemuat(false); } })
      .catch((e) => { if (hidup) { setGalat(e.message); setMemuat(false); } });
    return () => { hidup = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jalur, token, putaran]);

  const muatUlang = useCallback(() => setPutaran((n) => n + 1), []);
  return { data, memuat, galat, muatUlang };
}

/* ── Trafik ──────────────────────────────────────────────────────────── */
export interface HariTrafik {
  hari: string;
  label: string;
  total: number;
  unik: number;
  halaman: Record<string, number>;
}

export function useTrafik(): Hasil<HariTrafik[]> {
  return useRute('/api/kunjungan/ringkas', (j) =>
    (j?.harian ?? []).map((h: any): HariTrafik => ({
      hari: String(h.hari),
      /* "2026-08-10" -> "10 Agu". Sumbu grafik dengan tanggal ISO penuh
         saling tindih begitu ada lebih dari sepuluh hari. */
      label: new Date(h.hari + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      total: Number(h.total) || 0,
      unik: Number(h.unik) || 0,
      halaman: h.halaman ?? {},
    })), []);
}

/* ── Klien ───────────────────────────────────────────────────────────── */
export interface Klien {
  uid: string; email: string; nama: string;
  kunjungan: number; pertama: number; terakhir: number;
}

export function useKlien(): Hasil<Klien[]> {
  return useRute('/api/klien/daftar', (j) =>
    (j?.klien ?? []).map((k: any): Klien => ({
      uid: String(k.uid ?? ''),
      email: String(k.email ?? ''),
      nama: String(k.nama ?? ''),
      kunjungan: Number(k.kunjungan) || 0,
      pertama: Number(k.pertama) || 0,
      terakhir: Number(k.terakhir) || 0,
    })), []);
}

/* ── Penjualan ───────────────────────────────────────────────────────── */
export interface Penjualan {
  id: string; produk: string; pembeli: string;
  nilai: number; catatan: string; waktu: number;
}

export function usePenjualan(): Hasil<Penjualan[]> {
  return useRute('/api/penjualan/daftar', (j) =>
    (j?.penjualan ?? []).map((p: any): Penjualan => ({
      id: String(p.id ?? ''),
      produk: String(p.produk ?? ''),
      pembeli: String(p.pembeli ?? ''),
      nilai: Number(p.nilai) || 0,
      catatan: String(p.catatan ?? ''),
      waktu: Number(p.waktu) || 0,
    })), []);
}

/* ── Laporan bug & error ─────────────────────────────────────────────── */
export interface Laporan {
  id: string; jenis: string; pesan: string; halaman: string;
  email: string; status: string; waktu: number;
}

export function useLaporan(): Hasil<Laporan[]> {
  return useRute('/api/lapor/daftar', (j) =>
    (j?.laporan ?? []).map((l: any): Laporan => ({
      id: String(l.id ?? ''),
      jenis: String(l.jenis ?? 'lain'),
      pesan: String(l.pesan ?? ''),
      halaman: String(l.halaman ?? ''),
      email: String(l.email ?? ''),
      status: String(l.status ?? 'baru'),
      waktu: Number(l.waktu) || 0,
    })), []);
}

/* ── Lisensi aktif ───────────────────────────────────────────────────── */
export interface Lisensi { sidik: string; produk: string; catatan: string; tgl: number; }

export function useLisensi(): Hasil<Lisensi[]> {
  return useRute('/api/lisensi/daftar', (j) =>
    (j?.aktif ?? []).map((x: any): Lisensi => ({
      sidik: String(x.sidik ?? ''),
      produk: String(x.produk ?? ''),
      catatan: String(x.catatan ?? ''),
      tgl: Number(x.tgl) || 0,
    })), []);
}

/* ── Status VPS ──────────────────────────────────────────────────────── */
export interface StatusVps {
  waktuHidupDetik: number; waktuHidupMesinDetik: number;
  ramTotalMb: number; ramBebasMb: number; ramProsesMb: number;
  beban: number[]; cpu: number; node: string; gerbangLangganan: boolean;
  disk: { totalMb: number; terpakaiMb: number; persen: number } | null;
  permintaan: {
    sejak: number; total: number; perMenit: number;
    tolakanAuth: number; kena429: number; galat5xx: number;
  } | null;
}

const VPS_KOSONG: StatusVps = {
  waktuHidupDetik: 0, waktuHidupMesinDetik: 0, ramTotalMb: 0, ramBebasMb: 0,
  ramProsesMb: 0, beban: [], cpu: 0, node: '', gerbangLangganan: false,
  disk: null, permintaan: null,
};

export function useStatusVps(): Hasil<StatusVps> {
  return useRute('/api/status-vps', (j): StatusVps => ({
    waktuHidupDetik: Number(j?.waktuHidupDetik) || 0,
    waktuHidupMesinDetik: Number(j?.waktuHidupMesinDetik) || 0,
    ramTotalMb: Number(j?.ramTotalMb) || 0,
    ramBebasMb: Number(j?.ramBebasMb) || 0,
    ramProsesMb: Number(j?.ramProsesMb) || 0,
    beban: Array.isArray(j?.beban) ? j.beban.map(Number) : [],
    cpu: Number(j?.cpu) || 0,
    node: String(j?.node ?? ''),
    gerbangLangganan: !!j?.gerbangLangganan,
    disk: j?.disk ? {
      totalMb: Number(j.disk.totalMb) || 0,
      terpakaiMb: Number(j.disk.terpakaiMb) || 0,
      persen: Number(j.disk.persen) || 0,
    } : null,
    permintaan: j?.permintaan ? {
      sejak: Number(j.permintaan.sejak) || 0,
      total: Number(j.permintaan.total) || 0,
      perMenit: Number(j.permintaan.perMenit) || 0,
      tolakanAuth: Number(j.permintaan.tolakanAuth) || 0,
      kena429: Number(j.permintaan.kena429) || 0,
      galat5xx: Number(j.permintaan.galat5xx) || 0,
    } : null,
  }), VPS_KOSONG);
}

/* ── Menulis ─────────────────────────────────────────────────────────── */

async function kirim(jalur: string, muatan: unknown) {
  const { token } = bacaKoneksi();
  if (!token.trim()) throw new Error('App Token belum diisi di Integrations');
  const r = await fetch(`${dasar()}${jalur}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Token': token.trim() },
    body: JSON.stringify(muatan),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Backend menjawab ${r.status}`);
  return r.json();
}

export const catatPenjualan = (p: { produk: string; pembeli: string; nilai: number; catatan?: string }) =>
  kirim('/api/penjualan', p);
export const hapusPenjualan = (id: string) => kirim('/api/penjualan/hapus', { id });
export const tandaiLaporan = (id: string, status: string) => kirim('/api/lapor/status', { id, status });
export const cabutLisensi = (sidik: string) => kirim('/api/lisensi/cabut', { sidik });

/* ════════════════════════════════════════════════════════════════════════
   PELAPORAN BALIK — supaya V3 ikut terhitung
   ════════════════════════════════════════════════════════════════════════
   Grafik trafik dan daftar klien di halaman Pemilik diisi oleh halaman yang
   MELAPOR. V2 melapor lewat jt-lapor.js dan jt-langganan.js; V3 sama sekali
   tidak — jadi selama ini setiap kunjungan ke V3 tidak pernah muncul di
   angka mana pun, dan grafiknya perlahan jadi laporan tentang V2 saja.
   ════════════════════════════════════════════════════════════════════════ */

/** Catat satu kunjungan halaman. Sekali per sesi per halaman — tanpa penjaga
 *  ini setiap refresh ikut terhitung dan angkanya berhenti berarti apa-apa.
 *  Sengaja tidak memakai App Token: pengunjung biasa tidak punya. */
export function catatKunjungan(halaman: string) {
  const kunci = 'jtKunjungan::v3::' + halaman;
  try {
    if (sessionStorage.getItem(kunci)) return;
    sessionStorage.setItem(kunci, '1');
  } catch { /* mode privat — biarkan terhitung daripada tidak sama sekali */ }
  fetch(`${dasar()}/api/kunjungan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ halaman }),
  }).catch(() => {});
}

/** Catat kehadiran klien yang login. Email diambil backend dari ID token yang
 *  sudah diverifikasi — halaman ini tidak bisa mendaftarkan email orang lain. */
export async function catatKlienHadir() {
  const u = auth.currentUser;
  if (!u) return;
  const kunci = 'jtKlienHadir::' + u.uid;
  try {
    if (sessionStorage.getItem(kunci)) return;
    sessionStorage.setItem(kunci, '1');
  } catch { /* sama seperti di atas */ }
  try {
    const token = await u.getIdToken();
    await fetch(`${dasar()}/api/klien/hadir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ nama: u.displayName ?? '' }),
    });
  } catch { /* pencatatan gagal tidak boleh mengganggu apa pun */ }
}

/* ════════════════════════════════════════════════════════════════════════
   PRODUK — ambil sumber & berkas
   ════════════════════════════════════════════════════════════════════════
   Rute-rute ini PUBLIK (tanpa App Token): yang menjaganya adalah lisensi,
   bukan token pemilik. Pembeli tidak punya App Token dan tidak boleh punya.

   Tiga jalur, tiga gerbang berbeda:
     · /api/produk/gratis  — hanya untuk produk bertanda `.gratis`
     · /api/produk         — sumber teks premium, butuh kode lisensi aktif;
                             kode pembeli disisipkan sebagai penanda
     · /api/produk/berkas  — .ex5 biner; gratis kalau ditandai gratis,
                             kalau tidak butuh kode lisensi
   ════════════════════════════════════════════════════════════════════════ */

/** Sumber produk gratis. */
export async function ambilSumberGratis(id: string, jenis: 'txt' | 'mq5' = 'txt') {
  const r = await fetch(`${dasar()}/api/produk/gratis?id=${encodeURIComponent(id)}&jenis=${jenis}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Backend menjawab ${r.status}`);
  return String(j.kode ?? '');
}

/** Sumber produk premium, dengan kode lisensi pembeli. */
export async function ambilSumberBerlisensi(id: string, kode: string) {
  const r = await fetch(`${dasar()}/api/produk?id=${encodeURIComponent(id)}&kode=${encodeURIComponent(kode)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Backend menjawab ${r.status}`);
  return String(j.kode ?? '');
}

/** Tautan unduh berkas biner. Dipakai sebagai href, bukan fetch — `res.download`
 *  mengirim header Content-Disposition, dan browser yang menanganinya. */
export function tautanBerkas(id: string, kode = '', jenis: 'ex5' | 'mq5' = 'ex5') {
  const q = new URLSearchParams({ id, jenis });
  if (kode) q.set('kode', kode);
  return `${dasar()}/api/produk/berkas?${q}`;
}

/** Cek satu kode lisensi. Backend hanya menerima SIDIK-nya lewat rute publik
 *  `/api/lisensi/cek`, tapi sidik dihitung dari kode — dan perhitungannya ada
 *  di server. Jadi yang dipakai di sini adalah percobaan mengambil sumbernya:
 *  berhasil berarti lisensinya aktif. */
export async function ujiLisensi(id: string, kode: string) {
  try { await ambilSumberBerlisensi(id, kode); return { aktif: true, ket: 'Lisensi aktif' }; }
  catch (e) { return { aktif: false, ket: e instanceof Error ? e.message : 'Gagal memeriksa' }; }
}

/* ── Posisi terbuka langsung dari Binance ────────────────────────────────
   `public/posisiTerbuka` hanya berisi posisi yang DIBUKA lewat screener V2,
   dan hanya diperbarui selama halaman itu terbuka. Posisi yang dibuka dari
   aplikasi Binance tidak pernah masuk ke sana — itulah kenapa dashboard
   pernah menampilkan dua posisi sementara di bursa ada tiga.

   Rute ini menjawab dari bursanya langsung, jadi ia selalu benar. Syaratnya
   App Token, yang cuma dimiliki pemilik VPS-nya; pengunjung tetap memakai
   dokumen publik. */
export interface PosisiBursa {
  simbol: string;
  arah: 'BUY' | 'SELL';
  jumlah: number;
  entry: number;
  pnl: number;
  /** Harga pemicu STOP_MARKET / TAKE_PROFIT_MARKET yang SEDANG terpasang
   *  di bursa. 0 berarti memang tidak ada ordernya.
   *
   *  Kenapa dibaca terpisah: `positionRisk` tidak pernah menyebut stop yang
   *  menjaga posisinya, jadi web menampilkan posisi kripto tanpa SL/TP —
   *  dan jurnal menulis "belum dipasang" untuk posisi yang stopnya justru
   *  aman di bursa. Dibaca dari bursa, bukan dari catatan sendiri, supaya
   *  SL yang digeser lewat aplikasi Binance ikut terbaca. */
  sl: number;
  tp: number;
}

/** Satu order yang SEDANG menggantung di bursa.
 *
 *  Dipisahkan dari PosisiBursa karena keduanya menjawab pertanyaan yang
 *  berbeda: posisi adalah "aku sedang memegang apa", order adalah "apa
 *  yang akan terjadi kalau harga bergerak". Order ENTRY yang belum
 *  ke-fill sama sekali tidak punya posisi — dan justru itu yang paling
 *  sering lupa ditampilkan, lalu pemiliknya merasa order-nya tidak
 *  terkirim padahal menggantung rapi di bursa. */
export interface OrderBursa {
  id: string;
  simbol: string;
  /** ENTRY = order yang akan MEMBUKA posisi (pending). SL/TP = penjaga
   *  posisi yang sudah ada. */
  jenis: 'ENTRY' | 'SL' | 'TP' | 'LAIN';
  tipe: string;
  arah: 'BUY' | 'SELL';
  pemicu: number;
  harga: number;
  qty: number;
  dibuat: number;
}

/** Stop yang SEDANG terpasang di bursa untuk satu simbol, sekali baca.
 *  Dipakai untuk MENUNGGU bursa benar-benar mencatat perubahan sebelum
 *  layar berani mengatakan "berhasil". Mengembalikan null kalau bursanya
 *  tidak menjawab — itu berbeda dari "tidak ada stop", dan bedanya
 *  penting: yang satu berarti belum tahu, yang satu berarti telanjang. */
export async function bacaStopBursa(simbol: string): Promise<{ sl: number; tp: number } | null> {
  const token = bacaKoneksi().token.trim();
  if (!token) return null;
  try {
    const r = await fetch(`${dasar()}/api/open-orders`, { headers: { 'X-App-Token': token } });
    if (!r.ok) return null;
    const j = await r.json();
    const o = (j.order ?? []).find((x: any) => String(x.simbol ?? '') === simbol);
    return { sl: Number(o?.sl) || 0, tp: Number(o?.tp) || 0 };
  } catch { return null; }
}

export function usePosisiBinance(): {
  data: PosisiBursa[];
  order: OrderBursa[];
  aktif: boolean;
  /** Paksa baca ulang sekarang, tanpa menunggu putaran 30 detik.
   *  Dipakai setelah mengubah order: menunggu satu putaran penuh membuat
   *  layar bilang "berhasil" sementara tabelnya masih menampilkan angka
   *  lama — dan selisih itu terbaca sebagai kegagalan. */
  segarkan: () => void;
} {
  const [data, setData] = useState<PosisiBursa[]>([]);
  const [order, setOrder] = useState<OrderBursa[]>([]);
  const [aktif, setAktif] = useState(false);
  const { token } = bacaKoneksi();
  const [pemicu, setPemicu] = useState(0);

  useEffect(() => {
    if (!token.trim()) { setAktif(false); setData([]); return; }
    let hidup = true;

    async function ambil() {
      try {
        const kepala = { 'X-App-Token': token.trim() };
        const r = await fetch(`${dasar()}/api/positions`, { headers: kepala });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!hidup) return;

        /* Stop yang terpasang dibaca dari rute terpisah. Kegagalannya TIDAK
           menggagalkan posisi: daftar posisi tanpa SL masih berguna, daftar
           posisi yang hilang sama sekali tidak. */
        const stop = new Map<string, { sl: number; tp: number }>();
        try {
          const ro = await fetch(`${dasar()}/api/open-orders`, { headers: kepala });
          if (ro.ok) {
            const jo = await ro.json();
            (jo.order ?? []).forEach((o: any) => {
              stop.set(String(o.simbol ?? ''), { sl: Number(o.sl) || 0, tp: Number(o.tp) || 0 });
            });
            /* Daftar mentahnya ikut disimpan. Ringkasan sl/tp per simbol
               menjawab "posisi ini dijaga di harga berapa", tapi TIDAK
               bisa menjawab "ada berapa order" — dua order di simbol yang
               sama menyusut jadi satu angka. Chart butuh yang kedua untuk
               menggambar satu garis per order. */
            if (hidup) setOrder((jo.daftar ?? []).map((o: any): OrderBursa => ({
              id: String(o.id ?? ''),
              simbol: String(o.simbol ?? ''),
              jenis: (o.jenis ?? 'LAIN') as OrderBursa['jenis'],
              tipe: String(o.tipe ?? ''),
              arah: o.arah === 'SELL' ? 'SELL' : 'BUY',
              pemicu: Number(o.pemicu) || 0,
              harga: Number(o.harga) || 0,
              qty: Number(o.qty) || 0,
              dibuat: Number(o.dibuat) || 0,
            })));
          }
        } catch { /* bursa sedang tidak menjawab soal order */ }
        /* Binance mengirim SATU baris untuk setiap simbol yang pernah
           disentuh — 858 baris untuk tiga posisi. Yang qty-nya nol bukan
           posisi; menampilkannya berarti daftar sepanjang ratusan baris. */
        setData((j.positions ?? [])
          .filter((p: any) => Math.abs(Number(p.positionAmt)) > 0)
          .map((p: any): PosisiBursa => ({
            simbol: String(p.symbol ?? ''),
            arah: Number(p.positionAmt) > 0 ? 'BUY' : 'SELL',
            jumlah: Math.abs(Number(p.positionAmt)) || 0,
            entry: Number(p.entryPrice) || 0,
            pnl: Number(p.unRealizedProfit) || 0,
            sl: stop.get(String(p.symbol ?? ''))?.sl ?? 0,
            tp: stop.get(String(p.symbol ?? ''))?.tp ?? 0,
          })));
        setAktif(true);
      } catch {
        if (hidup) { setAktif(false); }
      }
    }

    void ambil();
    const jam = setInterval(ambil, JEDA_MS);
    return () => { hidup = false; clearInterval(jam); };
  }, [token, pemicu]);

  return { data, order, aktif, segarkan: () => setPemicu((n) => n + 1) };
}

/** Unggah satu gambar ke VPS, dapat URL publiknya.
 *
 *  Gambar TIDAK disimpan di Firestore. Satu dokumen dibatasi 1 MiB, dan
 *  satu tangkapan layar chart saja sudah melewatinya — katalognya akan
 *  berhenti bisa disimpan sama sekali begitu ada dua produk bergambar. */
export async function unggahGambar(dataUrl: string, nama: string) {
  const j = await kirim('/api/gambar', { dataUrl, nama });
  return String(j.url ?? '');
}

/** Berkas -> data URL, supaya bisa dikirim sebagai JSON.
 *
 *  Batas 8 MB ditegakkan juga di server; diperiksa di sini supaya orang tahu
 *  sebelum menunggu unggahan yang pasti ditolak. */
export function keDataUrl(berkas: File): Promise<string> {
  if (berkas.size > 8 * 1024 * 1024) {
    return Promise.reject(new Error(`Gambar ${(berkas.size / 1048576).toFixed(1)} MB, batasnya 8 MB`));
  }
  return new Promise((selesai, tolak) => {
    const r = new FileReader();
    r.onload = () => selesai(String(r.result));
    r.onerror = () => tolak(new Error('Gagal membaca berkas'));
    r.readAsDataURL(berkas);
  });
}

/* ── Permintaan lisensi ──────────────────────────────────────────────────
   Pembeli mengirim permintaan, pemilik menyetujui, dan penyetujuan itulah
   yang MENERBITKAN kodenya. Sebelum ini satu-satunya jalur adalah pemilik
   mengetik kode lalu mengaktifkannya sendiri — pembelinya tidak punya cara
   memberi tahu bahwa ia sudah membayar selain lewat WhatsApp. */
export interface PermintaanLisensi {
  id: string;
  uid: string;
  email: string;
  nama: string;
  produk: string;
  catatan: string;
  bukti: string;
  status: 'baru' | 'disetujui' | 'ditolak';
  waktu: number;
  kode?: string;
  /** Sidik kode setelah disetujui — inilah yang menautkan permintaan ini
   *  dengan barisnya di daftar lisensi aktif. */
  sidik?: string;
}

export function usePermintaanLisensi(): Hasil<PermintaanLisensi[]> {
  return useRute('/api/lisensi/permintaan', (j) =>
    (j?.permintaan ?? []).map((x: any): PermintaanLisensi => ({
      id: String(x.id ?? ''),
      uid: String(x.uid ?? ''),
      email: String(x.email ?? ''),
      nama: String(x.nama ?? ''),
      produk: String(x.produk ?? ''),
      catatan: String(x.catatan ?? ''),
      bukti: String(x.bukti ?? ''),
      status: x.status === 'disetujui' ? 'disetujui' : x.status === 'ditolak' ? 'ditolak' : 'baru',
      waktu: Number(x.waktu) || 0,
      kode: x.kode ? String(x.kode) : undefined,
      sidik: x.sidik ? String(x.sidik) : undefined,
    })), []);
}

export const putuskanLisensi = (id: string, tindakan: 'setujui' | 'tolak', kode?: string) =>
  kirim('/api/lisensi/permintaan/putuskan', { id, tindakan, ...(kode ? { kode } : {}) });

/** Kirim permintaan aktivasi. Butuh login — emailnya diambil backend dari
 *  ID token yang sudah diverifikasi, bukan dari kiriman halaman ini. */
export async function mintaLisensi(p: { produk: string; nama?: string; catatan?: string; bukti?: string }) {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu dengan akun Google.');
  const token = await u.getIdToken();
  const r = await fetch(`${dasar()}/api/lisensi/minta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(p),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Backend menjawab ${r.status}`);
  return j as { ok: boolean; id: string; sudahAda?: boolean };
}

/** Permintaan milik pengguna yang sedang masuk — termasuk kodenya kalau
 *  sudah disetujui. Dipakai halaman Marketplace supaya pembeli tahu di mana
 *  posisinya tanpa perlu bertanya. */
export function usePermintaanSaya(): { data: PermintaanLisensi[]; muatUlang: () => void } {
  const [data, setData] = useState<PermintaanLisensi[]>([]);
  const [putaran, setPutaran] = useState(0);

  useEffect(() => {
    let hidup = true;
    const lepas = onAuthStateChanged(auth, async (u) => {
      if (!u) { setData([]); return; }
      try {
        const token = await u.getIdToken();
        const r = await fetch(`${dasar()}/api/lisensi/minta/saya`, { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) return;
        const j = await r.json();
        if (hidup) setData(j?.permintaan ?? []);
      } catch { /* tidak apa-apa — panelnya cuma tidak menampilkan status */ }
    });
    return () => { hidup = false; lepas(); };
  }, [putaran]);

  return { data, muatUlang: () => setPutaran((n) => n + 1) };
}
