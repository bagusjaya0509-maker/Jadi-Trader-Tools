import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/data';
import { useAuth } from '@/lib/auth';

/* ════════════════════════════════════════════════════════════════════════
   EMOSI POSISI BERJALAN
   ════════════════════════════════════════════════════════════════════════
   Emosi paling jujur dicatat SAAT posisinya masih berjalan — bukan setelah
   hasilnya diketahui. Yang diisi setelah melihat P/L bukan lagi catatan
   psikologi, itu pembenaran.

   DUA TEMPAT, SENGAJA:

     1. `users/{uid}/emosiPosisi/{kunci}` — supaya layar posisi terbuka bisa
        menampilkannya kembali, termasuk untuk posisi kripto yang jalur
        penutupannya tidak kita kendalikan.

     2. Untuk posisi MT5, JUGA ditulis ke `users/{uid}/transaksi/mt5-{tiket}`
        pada field `psikologi.emosiMasuk`. Itu id yang sama persis dengan
        yang dipakai sinkron riwayat EA nanti, dan sinkronnya memakai
        `merge: true` — jadi saat posisinya tutup, catatan emosinya sudah
        menunggu di sana dan ikut terbawa ke riwayat order tanpa ada yang
        perlu mengetik ulang.

   Batas yang diakui terbuka: posisi kripto belum punya id transaksi yang
   bisa ditebak dari sini, jadi emosinya tersimpan dan tampil di layar,
   tapi penyambungannya ke riwayat menunggu jalur tutup kripto memakai
   kunci yang sama.
   ════════════════════════════════════════════════════════════════════════ */

export const EMOSI = ['Netral', 'Percaya Diri', 'Tenang', 'Ragu-ragu', 'FOMO', 'Panik', 'Balas Dendam'] as const;

export function useEmosiPosisi() {
  const { pengguna } = useAuth();
  const [peta, setPeta] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!pengguna) { setPeta({}); return; }
    return onSnapshot(collection(db, 'users', pengguna.uid, 'emosiPosisi'),
      (s) => {
        const p: Record<string, string> = {};
        s.docs.forEach((d) => { const e = d.data()?.emosi; if (e) p[d.id] = String(e); });
        setPeta(p);
      },
      (e) => { console.warn('emosiPosisi:', e); }
    );
  }, [pengguna]);

  /** `tiket` diisi untuk posisi MT5 — itulah yang menyambungkannya ke
   *  riwayat order nanti. */
  async function simpan(kunci: string, emosi: string, tiket?: string) {
    if (!pengguna) throw new Error('Masuk dulu untuk mencatat emosi.');
    const bersih = kunci.replace(/[/]/g, '_');
    await setDoc(doc(db, 'users', pengguna.uid, 'emosiPosisi', bersih),
      { emosi, waktu: Date.now() }, { merge: true });
    if (tiket) {
      await setDoc(doc(db, 'users', pengguna.uid, 'transaksi', `mt5-${tiket}`),
        { psikologi: { emosiMasuk: emosi }, _tiket: tiket }, { merge: true });
    }
  }

  return { peta, simpan, bisaTulis: !!pengguna };
}
