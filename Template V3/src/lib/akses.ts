import { useCallback, useEffect, useState } from 'react';
import { jejak } from '@/lib/pixel';
import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   AKSES PERINTIS — 20 gratis, 80 berbayar, 30 hari
   ════════════════════════════════════════════════════════════════════════
   Angka kuotanya hidup di server, bukan di sini. Berkas ini cuma bertanya.
   Penghitung yang dihitung di browser bisa dibaca ulang dengan angka apa
   pun oleh siapa saja yang membuka DevTools, dan kuota yang bisa dikarang
   sendiri bukan kuota.

   Rute kuota sengaja TANPA login: halaman akses harus bisa mengatakan
   "tinggal 19 dari 20" kepada orang yang belum punya akun sama sekali.
   ════════════════════════════════════════════════════════════════════════ */


/** bacaKoneksi() sengaja mengembalikan kosong sebelum login — jadi untuk
 *  rute publik alamatnya diambil apa adanya, dengan bawaan VPS. */
function dasar() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}

export interface Kuota {
  gratisTerpakai: number; gratisTotal: number; gratisSisa: number; gratisHabis: boolean;
  bayarTerpakai: number; bayarTotal: number; bayarSisa: number; bayarHabis: boolean;
  hari: number;
  /** Sakelar pemilik di Maintenance. Saat mati, kartu kuota dan tombol minta
   *  DISEMBUNYIKAN — bukan sekadar dimatikan. Kuota yang tetap terpampang
   *  saat pendaftaran tutup cuma mengundang pertanyaan yang jawabannya
   *  "tidak bisa". */
  bukaPermintaan: boolean;
  /** Gambar apa yang dipasang di sisi kiri halaman akses. Datang dari
   *  server, bukan dari pilihan tiap peramban: yang diatur pemilik di
   *  Maintenance adalah tampilan yang DILIHAT SEMUA ORANG. Pilihan yang
   *  disimpan di localStorage cuma mengubah layar pemiliknya sendiri. */
  tampilanAkses: 'foto' | 'lonceng';
}

export const KUOTA_KOSONG: Kuota = {
  gratisTerpakai: 0, gratisTotal: 20, gratisSisa: 20, gratisHabis: false,
  bayarTerpakai: 0, bayarTotal: 80, bayarSisa: 80, bayarHabis: false, hari: 30,
  /* Bawaan MATI, bukan hidup. Nilai ini dipakai selama jawaban server belum
     datang; kalau hidup, kartu kuota berkedip muncul lalu hilang begitu
     server bilang pendaftaran ditutup. Lebih baik terlambat sedetik daripada
     menampilkan sesuatu yang langsung ditarik kembali. */
  bukaPermintaan: false,
  /* Bawaan 'foto', dan ini penting: nilai ini yang terpakai selama jawaban
     server belum datang. Foto adalah yang sudah ada sejak awal, jadi
     memasangnya lebih dulu berarti halaman tidak pernah berkedip
     menampilkan sesuatu yang lain sebelum menetap. */
  tampilanAkses: 'foto',
};

/** Link checkout Rp 17.900. Produknya bernama "Request Access". */
export const LINK_BAYAR = 'https://lynk.id/karyahukum_store/66nd63r733k8/checkout';

export type StatusMinta = 'baru' | 'disetujui' | 'ditolak';

export interface Permintaan {
  id: string;
  uid?: string;
  email?: string;
  nama?: string;
  jenis?: 'gratis' | 'bayar';
  produk: string;
  catatan?: string;
  bukti?: string;
  status: StatusMinta;
  waktu: number;
  berakhir?: number;
  kode?: string;
  /** Alasan yang ditulis pemilik saat menyetujui atau menolak. Kosong kalau
   *  ia memutuskan tanpa berkata apa-apa. */
  pesan?: string;
  diputusPada?: number;
}

async function kepalaLogin(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu.');
  return { Authorization: 'Bearer ' + (await u.getIdToken()), 'Content-Type': 'application/json' };
}

/* ── Publik: sisa kuota ──────────────────────────────────────────────── */
export function useKuota(): { kuota: Kuota; memuat: boolean; galat: string | null; muatUlang: () => void } {
  const [kuota, setKuota] = useState<Kuota>(KUOTA_KOSONG);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [putaran, setPutaran] = useState(0);

  useEffect(() => {
    let hidup = true;
    setMemuat(true);
    fetch(`${dasar()}/api/akses/kuota`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Server menjawab ${r.status}`))))
      .then((j) => { if (hidup) { setKuota({ ...KUOTA_KOSONG, ...j }); setGalat(null); setMemuat(false); } })
      .catch((e) => { if (hidup) { setGalat(e.message); setMemuat(false); } });
    return () => { hidup = false; };
  }, [putaran]);

  return { kuota, memuat, galat, muatUlang: useCallback(() => setPutaran((n) => n + 1), []) };
}

/* ── Pengguna: kirim permintaan & lihat miliknya sendiri ─────────────── */
export async function mintaAkses(opsi: {
  jenis: 'gratis' | 'bayar'; catatan?: string; bukti?: string;
}): Promise<{ ok: boolean; sudahAda?: boolean; id?: string;
  /* Terisi kalau permintaannya langsung disetujui sendiri (akses gratis
     dengan saklar otomatis menyala). Halaman pemanggil memakainya untuk
     bilang "sudah aktif" alih-alih "menunggu ditinjau" — dua kalimat yang
     tidak boleh tertukar. */
  oto?: boolean; kode?: string; berakhir?: number }> {
  const r = await fetch(`${dasar()}/api/lisensi/minta`, {
    method: 'POST',
    headers: await kepalaLogin(),
    body: JSON.stringify({
      jenis: opsi.jenis,
      produk: 'jadi-trader-v3',
      catatan: (opsi.catatan ?? '').slice(0, 300),
      bukti: (opsi.bukti ?? '').slice(0, 300),
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);

  /* ── Peristiwa Meta dicatat DI SINI, bukan di halaman pemanggil ───────
     Dua halaman memanggil fungsi ini — /akses (formulir) dan /aktivasi
     (pulang dari Lynk). Menaruh pencatatannya di masing-masing halaman
     berarti dua tempat yang harus ingat, dan halaman ketiga besok pasti
     lupa. Di sini satu tempat menutupi semuanya.

     `sudahAda` DILEWATI dengan sengaja: itu permintaan yang sudah pernah
     dikirim, bukan pembelian baru. Menghitungnya lagi akan menggandakan
     angka konversi dan membuat Meta belajar dari peristiwa yang tidak
     pernah terjadi.

     Pembedaan `bayar`:
       bukti 'lynk' → PURCHASE. Orangnya baru saja membayar di Lynk dan
                      dikirim balik ke /aktivasi. Ini uang sungguhan.
       tanpa itu    → INITIATE_CHECKOUT. Ia mengaku sudah bayar lewat
                      formulir dan masih menunggu pemilik memeriksanya.
                      Belum tentu benar, jadi belum boleh disebut
                      pembelian.

     NILAI (value) belum dikirim, dan itu disengaja. Paket mana yang
     dibeli baru diketahui saat pemilik menyetujuinya di Maintenance —
     bukan di peramban. Mengarang nilainya di sini berarti mengajari Meta
     angka yang salah. Nilainya menyusul lewat Conversions API dari VPS
     pada saat persetujuan. */
  if (!j.sudahAda) {
    if (opsi.jenis === 'gratis') jejak('Lead');
    else if ((opsi.bukti ?? '').startsWith('lynk')) jejak('Purchase');
    else jejak('InitiateCheckout');
  }
  return j;
}

export async function permintaanSaya(): Promise<Permintaan[]> {
  const r = await fetch(`${dasar()}/api/lisensi/minta/saya`, { headers: await kepalaLogin() });
  if (!r.ok) throw new Error(`Server menjawab ${r.status}`);
  const j = await r.json();
  return (j.permintaan ?? []) as Permintaan[];
}

/** Tukar kode lisensi jadi akses. Kode diikat ke akun pertama yang
 *  menukarnya — tanpa itu satu kode bisa disebar ke seratus orang dan kuota
 *  20/80 tidak berarti apa-apa. */
export async function aktifkanKode(kode: string) {
  const r = await fetch(`${dasar()}/api/akses/aktifkan`, {
    method: 'POST',
    headers: await kepalaLogin(),
    body: JSON.stringify({ kode: kode.trim().toUpperCase() }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j as { ok: boolean; berakhir?: number; firestoreOk?: boolean };
}

export interface SetelanAkses extends Kuota {
  bukaPermintaan: boolean;
  /* Harga paket, dalam DOLAR. Menumpang di setelan akses dan bukan di
     tempat sendiri karena ini satu urusan yang sama: apa yang dijual,
     berapa harganya, dan berapa sisa tempatnya. Halaman depan membacanya
     lewat cermin publiknya, /api/akses/kuota. */
  hargaTesting: number;
  hargaTestingCoret: number;
  hargaPremium3: number;
  hargaTahunan: number;
  nilaiMarketplace: number;
  kursUsd: number;
  eventGratis: boolean;
  /** Akses gratis disetujui sendiri, tanpa pemilik menekan tombol. */
  otoGratis: boolean;
  linkTesting: string;
  linkPremium3: string;
  linkTahunan: string;
}

/* ── Pemilik: setelan akses ─────────────────────────────────────────── */
export async function bacaSetelanAkses(): Promise<SetelanAkses> {
  const r = await fetch(`${dasar()}/api/akses/setelan`, { headers: kepalaPemilik() });
  if (r.status === 401) throw new Error('App Token ditolak.');
  if (!r.ok) throw new Error(`Server menjawab ${r.status}`);
  return (await r.json()) as SetelanAkses;
}

export async function simpanSetelanAkses(nilai: {
  bukaPermintaan?: boolean; gratisTotal?: number; bayarTotal?: number; hari?: number;
  hargaTesting?: number; hargaTestingCoret?: number;
  hargaPremium3?: number; hargaTahunan?: number; nilaiMarketplace?: number;
  kursUsd?: number; eventGratis?: boolean; otoGratis?: boolean;
  tampilanAkses?: 'foto' | 'lonceng';
  linkTesting?: string; linkPremium3?: string; linkTahunan?: string;
}): Promise<SetelanAkses> {
  const r = await fetch(`${dasar()}/api/akses/setelan`, {
    method: 'POST', headers: kepalaPemilik(), body: JSON.stringify(nilai),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j as SetelanAkses;
}

/* ── Pemilik: daftar & putuskan ──────────────────────────────────────── */
function kepalaPemilik(): Record<string, string> {
  const t = bacaKoneksi().token.trim();
  if (!t) throw new Error('App Token belum diisi di Integrations.');
  return { 'X-App-Token': t, 'Content-Type': 'application/json' };
}

export async function daftarPermintaan(): Promise<{ permintaan: Permintaan[]; baru: number }> {
  const r = await fetch(`${dasar()}/api/lisensi/permintaan`, { headers: kepalaPemilik() });
  if (r.status === 401) throw new Error('App Token ditolak.');
  if (!r.ok) throw new Error(`Server menjawab ${r.status}`);
  const j = await r.json();
  return { permintaan: (j.permintaan ?? []) as Permintaan[], baru: Number(j.baru) || 0 };
}

export async function putuskanPermintaan(id: string, tindakan: 'setujui' | 'tolak') {
  const r = await fetch(`${dasar()}/api/lisensi/permintaan/putuskan`, {
    method: 'POST',
    headers: kepalaPemilik(),
    body: JSON.stringify({ id, tindakan }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return j as { ok: boolean; status: string; kode?: string; berakhir?: number; firestoreOk?: boolean };
}


/* ── Pengingat masa akses ────────────────────────────────────────────────
   Satu baris = satu LISENSI, bukan satu orang. Bedanya kelihatan kalau ada
   yang punya dua lisensi aktif sekaligus; sekarang tidak ada (sudah dicek
   di server: 0 alamat kembar, 0 uid kembar), tapi tipe ini tidak boleh
   berpura-pura hal itu mustahil. */
export interface BarisPengingat {
  sidik: string;
  uid: string;
  produk: string;
  berakhir: number;
  /** Dibulatkan KE ATAS di server. Habis 20 jam lagi = 1 hari, bukan 0. */
  sisaHari: number;
  /** Tanggalnya sudah lewat. Suratnya berganti kalimat, bukan dibatalkan. */
  lewat: boolean;
  /** Kosong artinya orang ini TIDAK BISA dikabari sama sekali. */
  email: string;
  nama: string;
  /** 0 = belum pernah. Dipakai untuk menahan kirim dua kali dalam 3 hari. */
  pengingatPada: number;
}

export interface RingkasPengingat {
  total: number;
  siap: number;
  tanpaEmail: number;
  baruSaja: number;
  lewat: number;
}

/** Hanya membaca. Panel WAJIB memanggil ini dulu dan menampilkan hasilnya:
 *  surat yang sudah keluar tidak bisa ditarik kembali. */
export async function daftarPengingat(dalam = 30): Promise<{
  daftar: BarisPengingat[]; ringkas: RingkasPengingat; dalam: number;
}> {
  const r = await fetch(`${dasar()}/api/lisensi/pengingat?dalam=${dalam}`, { headers: kepalaPemilik() });
  if (r.status === 401) throw new Error('App Token ditolak.');
  if (!r.ok) throw new Error(`Server menjawab ${r.status}`);
  const j = await r.json();
  return {
    daftar: (j.daftar ?? []) as BarisPengingat[],
    ringkas: (j.ringkas ?? { total: 0, siap: 0, tanpaEmail: 0, baruSaja: 0, lewat: 0 }) as RingkasPengingat,
    dalam: Number(j.dalam) || dalam,
  };
}

export interface HasilKirim {
  sidik: string; email?: string; terkirim: boolean; alasan?: string;
}

/** Penerimanya disebut satu per satu, bukan "semua yang cocok". Kalau
 *  server yang memilih ulang, daftar di layar dan daftar yang dikirimi bisa
 *  berbeda — cukup satu lisensi baru disetujui di sela-selanya. */
export async function kirimPengingat(sidik: string[], ulangi = false): Promise<{
  terkirim: number; diminta: number; hasil: HasilKirim[];
}> {
  const r = await fetch(`${dasar()}/api/lisensi/pengingat/kirim`, {
    method: 'POST',
    headers: kepalaPemilik(),
    body: JSON.stringify({ sidik, ulangi }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server menjawab ${r.status}`);
  return {
    terkirim: Number(j.terkirim) || 0,
    diminta: Number(j.diminta) || 0,
    hasil: (j.hasil ?? []) as HasilKirim[],
  };
}

/** Login Discord: backend menyelesaikan OAuth lalu mengarahkan balik dengan
 *  `#discord=<token>`, yang sudah ditangani di lib/auth.tsx saat modul dimuat.
 *
 *  `balik` WAJIB dikirim. Backend mencocokkannya dengan daftar alamat yang
 *  sah sebelum mengarahkan siapa pun — tanpa itu ia menjawab "Alamat balik
 *  tidak dikenal", dan tombolnya cuma menampilkan JSON galat. Daftar itu ada
 *  supaya token login tidak bisa dialihkan ke situs orang lain. */
export function masukDiscord() {
  /* `search` IKUT, dan itu bukan kerapian. Halaman yang paling sering
     dipakai untuk menekan tombol ini adalah /akses?kode=... yang datang
     dari surat akses otomatis. Tanpa query-nya, orangnya dikembalikan ke
     /akses polos dan kodenya lenyap.

     Aman terhadap penjaga di server: BALIK_SAH dicocokkan dengan
     startsWith(), jadi menambahkan query tidak membuat alamatnya ditolak.
     Sudah diperiksa di server.js — bukan diasumsikan. */
  const balik = window.location.origin + window.location.pathname + window.location.search;
  window.location.href = `${dasar()}/api/auth/discord?balik=${encodeURIComponent(balik)}`;
}
