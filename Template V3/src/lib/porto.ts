import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, bacaPilihanContoh } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { ASET, KEWAJIBAN } from '@/data/porto';

/* ════════════════════════════════════════════════════════════════════════
   PORTOFOLIO PRIBADI — penyimpanan nyata
   ════════════════════════════════════════════════════════════════════════
   Halaman Personal Area punya tombol "Tambah pos", kotak unggah Excel, dan
   tombol "Simpan" — dan tidak satu pun tersambung ke apa pun. Isinya
   `ASET`/`KEWAJIBAN` yang ditulis di data/porto.ts, jadi setiap angka yang
   diketik hilang begitu halaman disegarkan.

   Sekarang tersimpan di `users/{uid}/porto/daftar`. Satu dokumen, bukan satu
   dokumen per pos: daftarnya belasan baris dan selalu dibaca utuh, jadi
   memecahnya jadi subkoleksi cuma menambah belasan pembacaan tiap kali
   halaman dibuka tanpa memberi apa pun sebagai gantinya.

   Aturan `users/{uid}/{sub=**}` yang sudah terpasang menjaganya: dibaca dan
   ditulis hanya oleh pemiliknya sendiri.
   ════════════════════════════════════════════════════════════════════════ */

export interface PosAset {
  id: string;
  nama: string;
  nilai: number;
  /* String, bukan `KategoriAset`. Enam kategori bawaan tidak akan pernah
     cukup — orang punya reksa dana, tanah, piutang, koperasi. Yang bawaan
     tetap jadi pilihan cepat di layar; sisanya diketik sendiri. */
  kategori: string;
  /** Simbol pasar, kalau nilainya ikut bergerak (mis. BTCUSDT). */
  simbol?: string;
  /** Harga simbol saat pos ini dicatat. Titik nol untuk menghitung nilai
   *  kini; tanpanya harga pasar tidak bisa diterjemahkan jadi rupiah. */
  hargaCatat?: number;
}

export interface PosKewajiban {
  id: string;
  nama: string;
  nilai: number;
}

export interface IsiPorto {
  aset: PosAset[];
  kewajiban: PosKewajiban[];
  /** Riwayat porto bersih per bulan, "YYYY-MM" -> nilai. */
  bulanan: Record<string, number>;
}

const KOSONG: IsiPorto = { aset: [], kewajiban: [], bulanan: {} };

function idBaru() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Isi awal dari daftar yang selama ini tertulis di kode.
 *
 *  Dipakai HANYA sebagai bahan tombol "Isi dari daftar bawaan", bukan
 *  ditulis diam-diam saat halaman pertama dibuka. Menulis belasan pos ke
 *  akun orang lain tanpa diminta adalah kejutan yang tidak menyenangkan —
 *  terutama karena angkanya adalah portofolio milik satu orang tertentu. */
export function bawaan(): IsiPorto {
  return {
    aset: ASET.map((a): PosAset => ({ id: idBaru(), nama: a.nama, nilai: a.nilai, kategori: a.kategori, simbol: a.simbol })),
    kewajiban: KEWAJIBAN.map((k): PosKewajiban => ({ id: idBaru(), nama: k.nama, nilai: k.nilai })),
    bulanan: {},
  };
}

/* ── Riwayat bulanan CONTOH ──────────────────────────────────────────────
   Panel "Perkembangan Porto" butuh minimal dua bulan; dengan `bulanan: {}`
   ia selalu menampilkan "riwayat bulanan mulai terisi begitu ada dua bulan
   tercatat" — satu-satunya kotak kosong yang tersisa di Personal Area.

   Ini SENGAJA tidak masuk ke `bawaan()`. Fungsi itu dipakai tombol "Isi
   dari daftar bawaan", yang MENULIS ke Firestore akun orang; menuliskan
   delapan bulan riwayat yang tidak pernah ia jalani berarti menaruh
   kebohongan di data miliknya sendiri, dan besok ia akan membacanya
   sebagai fakta. Contoh hanya boleh hidup di lapisan tampilan.

   Angkanya naik dengan DUA bulan turun. Kurva yang naik mulus setiap bulan
   tidak pernah terjadi pada portofolio siapa pun, dan orang yang mengerti
   akan langsung tahu grafiknya disetel. */
function bulananContoh(): Record<string, number> {
  /* Nilai bulan terakhir SAMA PERSIS dengan porto bersih yang dihitung
     dari aset & kewajiban contoh (180.218.200 − 75.309.420). Kalau beda,
     titik terakhir grafik akan bertentangan dengan kartu KPI di atasnya —
     dan selisih yang tidak bisa dijelaskan lebih merusak kepercayaan
     daripada panel yang kosong. */
  const nilai = [71_400_000, 76_850_000, 82_300_000, 79_100_000, 88_600_000, 93_250_000, 91_800_000, 104_908_780];
  const out: Record<string, number> = {};
  const skrg = new Date();
  nilai.forEach((v, i) => {
    const d = new Date(skrg.getFullYear(), skrg.getMonth() - (nilai.length - 1 - i), 1);
    out[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = v;
  });
  return out;
}

/* Contoh untuk halaman yang MASIH KOSONG — dibuat sekali supaya id-nya
   tetap sama antar render (kunci daftar React, dan pilihan baris). */
const CONTOH: IsiPorto = { ...bawaan(), bulanan: bulananContoh() };

export interface HasilPorto {
  /** Isi NYATA milik pengguna. Semua penulisan berangkat dari sini — dan
   *  hanya dari sini, supaya angka contoh tidak pernah punya jalan masuk
   *  ke Firestore. */
  isi: IsiPorto;
  /** Isi untuk DITAMPILKAN: contoh selama porto masih kosong, punya sendiri
   *  begitu ada satu pos pun. Halaman yang seluruhnya nol tidak menjelaskan
   *  apa pun tentang apa yang akan ia dapat. */
  tampil: IsiPorto;
  /** true kalau yang sedang tampil adalah contoh, bukan milik penggunanya. */
  contoh: boolean;
  memuat: boolean;
  galat: string | null;
  /** true kalau pengguna belum punya dokumen porto sama sekali. */
  kosong: boolean;
  simpan: (baru: IsiPorto) => Promise<void>;
}

export function usePorto(): HasilPorto {
  const { pengguna, memuat: memuatAuth } = useAuth();
  const [isi, setIsi] = useState<IsiPorto>(KOSONG);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [kosong, setKosong] = useState(false);
  /* Pilihan "mulai kosong" ditekan di Dashboard, dibaca di sini — tanpa
     penyimak ini halaman baru ikut kosong setelah pindah halaman. */
  const [, setVersiPilihan] = useState(0);
  useEffect(() => {
    const naik = () => setVersiPilihan((v) => v + 1);
    window.addEventListener('jt:pilihan-contoh', naik);
    return () => window.removeEventListener('jt:pilihan-contoh', naik);
  }, []);

  useEffect(() => {
    if (memuatAuth) return;
    if (!pengguna) { setIsi(KOSONG); setKosong(true); setMemuat(false); return; }
    setMemuat(true);
    return onSnapshot(doc(db, 'users', pengguna.uid, 'porto', 'daftar'),
      (s) => {
        const d = s.data();
        setKosong(!s.exists());
        setIsi({
          aset: Array.isArray(d?.aset) ? d.aset : [],
          kewajiban: Array.isArray(d?.kewajiban) ? d.kewajiban : [],
          bulanan: d?.bulanan ?? {},
        });
        setMemuat(false); setGalat(null);
      },
      (e) => { console.warn('porto:', e); setGalat(e.message); setMemuat(false); }
    );
  }, [pengguna, memuatAuth]);

  const simpan = useCallback(async (baru: IsiPorto) => {
    if (!pengguna) throw new Error('Masuk dulu untuk menyimpan.');
    /* `undefined` ditolak Firestore dan melemparkan error — pos tanpa simbol
       harus kehilangan fieldnya, bukan membawanya sebagai undefined. */
    const bersih: IsiPorto = {
      aset: baru.aset.map((a) => {
        const inti = { id: a.id, nama: a.nama, nilai: a.nilai, kategori: a.kategori };
        if (!a.simbol) return inti;
        return a.hargaCatat ? { ...inti, simbol: a.simbol, hargaCatat: a.hargaCatat } : { ...inti, simbol: a.simbol };
      }),
      kewajiban: baru.kewajiban,
      bulanan: baru.bulanan,
    };
    await setDoc(doc(db, 'users', pengguna.uid, 'porto', 'daftar'),
      { ...bersih, _updatedAt: Date.now() }, { merge: true });
  }, [pengguna]);

  /* Contoh dipasang saat SELESAI memuat dan hasilnya benar-benar nol pos.
     Dipakai juga saat belum login — etalase halaman ini memang isinya.

     KECUALI kalau orangnya sudah menekan "mulai kosong" di Dashboard.
     Pilihan itu dulu hanya menyapu riwayat trade, jadi Personal Area tetap
     memamerkan porto contoh Rp 180 juta sesudahnya — "hapus semua data"
     yang menyisakan halaman paling penuh angka justru terbaca sebagai
     tombol yang tidak bekerja. Satu pilihan, satu arti, di semua halaman. */
  const pilihKosong = !!pengguna && bacaPilihanContoh(pengguna.uid) === 'kosong';
  const contoh = !(memuat || memuatAuth) && !pilihKosong
    && isi.aset.length === 0 && isi.kewajiban.length === 0;

  return {
    isi,
    tampil: contoh ? CONTOH : isi,
    contoh,
    memuat: memuat || memuatAuth,
    galat, kosong, simpan,
  };
}

export { idBaru };
