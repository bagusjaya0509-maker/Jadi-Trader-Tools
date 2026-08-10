import { useEffect, useState } from 'react';
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

export interface StatusAkun {
  /** null = belum diketahui (masih memeriksa). */
  terhubung: boolean | null;
  /** Saldo dari broker/bursa. null kalau tidak tersambung. */
  saldo: number | null;
  ekuitas: number | null;
  mataUang: string | null;
  ket: string;
}

const BELUM: StatusAkun = { terhubung: null, saldo: null, ekuitas: null, mataUang: null, ket: 'Memeriksa…' };

/** Akun sen dibagi 100. Tanpa ini akun cent terlihat 100× lebih besar —
 *  kekeliruan yang sama sudah pernah diperbaiki di jurnal V2. */
function keUsd(nilai: number, mataUang: string | null) {
  if (!mataUang) return nilai;
  return /cent|USC/i.test(mataUang) ? nilai / 100 : nilai;
}

export function useAkunMt5(): StatusAkun {
  const [st, setSt] = useState<StatusAkun>(BELUM);

  useEffect(() => {
    let hidup = true;

    async function periksa() {
      const u = auth.currentUser;
      if (!u) {
        if (hidup) setSt({ ...BELUM, terhubung: false, ket: 'Masuk dulu untuk menyambungkan' });
        return;
      }
      try {
        const token = await u.getIdToken();
        const r = await fetch(`${dasar()}/api/mt5/status`, { headers: { Authorization: 'Bearer ' + token } });
        if (!hidup) return;
        if (!r.ok) { setSt({ ...BELUM, terhubung: false, ket: 'Backend tidak menjawab' }); return; }
        const j = await r.json();
        const akun = j?.data?.akun;
        if (!j?.terhubung || !akun) {
          setSt({ ...BELUM, terhubung: false, ket: j?.kode ? `Kode ${j.kode} — EA belum melapor` : 'EA belum terpasang' });
          return;
        }
        const mu = akun.mataUang ?? null;
        setSt({
          terhubung: true,
          saldo: keUsd(Number(akun.saldo) || 0, mu),
          ekuitas: keUsd(Number(akun.ekuitas) || 0, mu),
          mataUang: mu,
          ket: akun.login ? `Akun ${akun.login}` : 'MetaTrader 5',
        });
      } catch {
        if (hidup) setSt({ ...BELUM, terhubung: false, ket: 'Tidak bisa menghubungi backend' });
      }
    }

    periksa();
    const jam = setInterval(periksa, JEDA_MS);
    return () => { hidup = false; clearInterval(jam); };
  }, []);

  return st;
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
        setSt({ terhubung: true, saldo, ekuitas: isFinite(ekuitas) ? ekuitas : saldo, mataUang: 'USDT', ket: 'Binance Futures' });
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
