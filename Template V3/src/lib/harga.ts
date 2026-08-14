import { useEffect, useState } from 'react';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   HARGA PASAR TERKINI
   ════════════════════════════════════════════════════════════════════════
   Harga terkini tidak disimpan di Firestore, dan itu bukan kelalaian: harga
   milik pasar, bukan milik akun. Menyimpannya berarti menulis dokumen tiap
   beberapa detik untuk angka yang sudah usang begitu ditulis.

   Diambil dari proxy VPS, BUKAN dari Binance langsung. Sebagian ISP
   Indonesia memblokir `fapi.binance.com` — Indosat bahkan membajak
   sertifikat TLS-nya — sehingga permintaan langsung dari peramban gagal
   dengan "Failed to fetch" tanpa penjelasan. Rute `/api/ticker-price` di
   VPS memang dibuat untuk itu: publik, tanpa token, dengan cache 15–20 detik.

   Kalau proxy tidak terjangkau, hook mengembalikan peta kosong dan layar
   memakai harga entry seperti sebelumnya. Tabel yang kehilangan satu kolom
   jauh lebih baik daripada tabel yang tidak muncul sama sekali.
   ════════════════════════════════════════════════════════════════════════ */

/** Dipakai kalau pengguna belum mengisi Backend URL sendiri. Sama dengan
 *  `MARKET_PROXY_DEFAULT` di screener V2 — satu alamat, dua aplikasi. */

const JEDA_MS = 20_000;

function alamatProxy() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}

async function ambilSatu(simbol: string, dasar: string): Promise<[string, number] | null> {
  try {
    const r = await fetch(`${dasar}/api/ticker-price?symbol=${encodeURIComponent(simbol)}`);
    if (!r.ok) return null;
    const j = await r.json();
    /* Bentuk balasannya sudah diperiksa langsung ke VPS:
         {"ok":true,"data":{"symbol":"BTCUSDT","price":"65270.96000000"}}
       Harganya STRING, jadi Number() bukan pilihan gaya melainkan keharusan —
       tanpa itu perbandingan harga jadi perbandingan teks, dan "9" > "65270". */
    const harga = Number(j?.data?.price);
    return isFinite(harga) && harga > 0 ? [simbol, harga] : null;
  } catch {
    return null;
  }
}

/* Proxy ini melayani Binance saja. Simbol MT5 seperti `XAUUSDc` dijawab 400 —
   benar dari sisi proxy, tapi permintaannya memang tidak pernah ada gunanya:
   ia cuma menghasilkan dua baris merah di konsol tiap 20 detik, dan konsol
   yang selalu merah membuat error sungguhan berikutnya tidak terlihat.

   Disaring di sini, bukan di pemanggilnya: yang tahu proxy ini hanya mengerti
   pasangan Binance adalah berkas ini, bukan halaman yang memakainya. */
const POLA_BINANCE = /(USDT|USDC|BUSD|FDUSD)$/;

/** Peta simbol → harga terkini. Kosong = proxy tidak terjangkau. */
export function useHargaPasar(simbol: string[]): Record<string, number> {
  const [harga, setHarga] = useState<Record<string, number>>({});
  /* Kunci string, bukan array: array baru tiap render akan memicu useEffect
     tanpa henti walaupun isinya sama persis. */
  const kunci = [...new Set(simbol.filter((s) => s && POLA_BINANCE.test(s)))].sort().join(',');

  useEffect(() => {
    if (!kunci) { setHarga({}); return; }
    const daftar = kunci.split(',');
    const dasar = alamatProxy();
    let hidup = true;

    async function segarkan() {
      const hasil = await Promise.all(daftar.map((s) => ambilSatu(s, dasar)));
      if (!hidup) return;
      const peta: Record<string, number> = {};
      for (const h of hasil) if (h) peta[h[0]] = h[1];
      /* Hanya ditimpa kalau ADA yang berhasil. Kalau semua gagal, harga lama
         dipertahankan — layar yang tiba-tiba kosong saat jaringan berkedip
         terlihat seperti posisinya hilang. */
      if (Object.keys(peta).length) setHarga((lama) => ({ ...lama, ...peta }));
    }

    segarkan();
    const jam = setInterval(segarkan, JEDA_MS);
    return () => { hidup = false; clearInterval(jam); };
  }, [kunci]);

  return harga;
}
