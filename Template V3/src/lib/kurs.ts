import { useCallback, useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   KURS USD ↔ IDR — satu angka, disimpan, bisa diubah tangan
   ════════════════════════════════════════════════════════════════════════
   Pemilik membayar kadang dalam dolar (VPS, domain, langganan alat) dan
   kadang dalam rupiah (jasa, perizinan, iklan lokal). Semua tercatat dalam
   dolar di backend; yang dibutuhkan cuma cara MEMBACANYA dalam rupiah.

   ── KENAPA KURSNYA DIISI SENDIRI, BUKAN DIAMBIL DARI API ──────────────
   Godaannya jelas: ambil kurs hidup dari suatu layanan, selalu mutakhir.
   Tapi laporan keuangan yang angkanya berubah sendiri tiap hari tidak bisa
   dibandingkan antar bulan — "Agustus Rp 2,4 juta" hari ini bisa jadi
   "Rp 2,45 juta" minggu depan tanpa satu transaksi pun berubah. Yang lebih
   buruk, kalau layanannya mati, angkanya diam-diam memakai kurs basi tanpa
   ada yang tahu sejak kapan.

   Kurs yang diketik sendiri selalu bisa dipertanggungjawabkan: pemiliknya
   tahu persis angka apa yang dipakai, dan kapan ia menggantinya.

   Disimpan di peramban, bukan di server: ini soal CARA MEMBACA, bukan data
   usaha. Dua perangkat boleh saja memakai kurs berbeda tanpa merusak apa
   pun — angka dolarnya tetap satu-satunya kebenaran.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI_KURS = 'jt.kursUsdIdr';
const KUNCI_TAMPIL = 'jt.mataUangTampil';

/** Kurs bawaan. Sengaja angka bulat yang gampang dikenali sebagai
 *  perkiraan — supaya orang yang belum menggantinya tidak mengira ini kurs
 *  hari ini yang presisi. */
export const KURS_BAWAAN = 16000;

export type MataUang = 'USD' | 'IDR';

function bacaAngka(kunci: string, bawaan: number): number {
  try {
    const v = Number(window.localStorage.getItem(kunci));
    return isFinite(v) && v > 0 ? v : bawaan;
  } catch { return bawaan; }
}

export function useKurs() {
  const [kurs, setKursState] = useState(() => bacaAngka(KUNCI_KURS, KURS_BAWAAN));
  const [tampil, setTampilState] = useState<MataUang>(() => {
    try { return window.localStorage.getItem(KUNCI_TAMPIL) === 'IDR' ? 'IDR' : 'USD'; }
    catch { return 'USD'; }
  });

  /* Perubahan disiarkan ke seluruh tab yang terbuka. Tanpa ini, mengubah
     kurs di satu tab meninggalkan tab lain memakai angka lama — dan dua
     layar yang menampilkan total berbeda untuk data yang sama adalah cara
     tercepat kehilangan kepercayaan pada laporannya. */
  useEffect(() => {
    const dengar = () => {
      setKursState(bacaAngka(KUNCI_KURS, KURS_BAWAAN));
      try { setTampilState(window.localStorage.getItem(KUNCI_TAMPIL) === 'IDR' ? 'IDR' : 'USD'); } catch { /* privat */ }
    };
    window.addEventListener('storage', dengar);
    return () => window.removeEventListener('storage', dengar);
  }, []);

  const setKurs = useCallback((n: number) => {
    const v = isFinite(n) && n > 0 ? n : KURS_BAWAAN;
    setKursState(v);
    try { window.localStorage.setItem(KUNCI_KURS, String(v)); } catch { /* privat */ }
  }, []);

  const setTampil = useCallback((m: MataUang) => {
    setTampilState(m);
    try { window.localStorage.setItem(KUNCI_TAMPIL, m); } catch { /* privat */ }
  }, []);

  /** Angka dolar → teks dalam mata uang yang sedang dipilih.
   *
   *  Rupiah dibulatkan ke satuan penuh: sen rupiah tidak ada di dunia
   *  nyata, dan "Rp 163.000,47" terbaca sebagai hasil hitungan yang bocor,
   *  bukan sebagai jumlah uang. */
  const fmt = useCallback((usd: number | null | undefined, tanda = false): string => {
    if (typeof usd !== 'number' || !isFinite(usd)) return '—';
    if (tampil === 'USD') {
      const abs = Math.abs(usd);
      const s = abs >= 1000
        ? abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : abs.toFixed(2);
      return `${usd < 0 ? '-' : tanda && usd > 0 ? '+' : ''}$${s}`;
    }
    const rp = Math.round(usd * kurs);
    const awalan = rp < 0 ? '-' : tanda && rp > 0 ? '+' : '';
    return `${awalan}Rp ${Math.abs(rp).toLocaleString('id-ID')}`;
  }, [tampil, kurs]);

  return { kurs, setKurs, tampil, setTampil, fmt };
}
