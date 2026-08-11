import { doc, setDoc, deleteDoc, collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '@/lib/data';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import type { Sumber } from '@/data/contoh';

/* ════════════════════════════════════════════════════════════════════════
   MENULIS JURNAL — transaksi manual, setoran, dan penarikan
   ════════════════════════════════════════════════════════════════════════
   Tombol "Tambah" dan ikon pensil di halaman Jurnal sebelumnya cuma gambar:
   tidak ada penanganan klik sama sekali. V2 punya modal lengkap untuk ini
   (`jurnal-trading.html`), dan bentuk datanya ikut yang sudah dipakai
   migrasi — `users/{uid}/transaksi/{id}` dengan `ukuran`, `psikologi`,
   `keluarWaktu`, dst. Menyimpang dari bentuk itu berarti transaksi buatan
   tangan tidak terbaca oleh pembaca yang sama.

   SETORAN & PENARIKAN dipisah ke subkoleksi sendiri, bukan ditaruh sebagai
   transaksi ber-PnL. Alasannya bukan kerapian: memasukkan setoran $500
   sebagai "profit" akan menaikkan winrate, P/L bersih, dan profit factor
   sekaligus — tiga angka yang justru dipakai untuk menilai apakah caranya
   berdagang berhasil.
   ════════════════════════════════════════════════════════════════════════ */

export interface MasukanTrade {
  id?: string;
  sumber: Sumber;
  pair: string;
  arah: 'BUY' | 'SELL';
  lot: number;
  masukHarga: number;
  keluarHarga: number;
  pnl: number;
  waktu: number;
  emosiMasuk: string;
  emosiEvaluasi: string;
  alasan: string;
  catatan: string;
}

function butuhUid() {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu dengan akun Google.');
  return u.uid;
}

/** Id yang bisa dibaca manusia dan tidak bentrok.
 *
 *  Awalannya `m-` (manual) supaya transaksi buatan tangan bisa dibedakan dari
 *  hasil migrasi (`cr-`, `fx-`) tanpa perlu membuka isinya. */
function idTrade(m: MasukanTrade) {
  return `m-${m.pair.replace(/[^A-Za-z0-9]/g, '')}-${m.waktu}`;
}

export async function simpanTrade(m: MasukanTrade) {
  const uid = butuhUid();
  const id = m.id || idTrade(m);
  await setDoc(doc(db, 'users', uid, 'transaksi', id), {
    simbol: m.pair.trim().toUpperCase(),
    arah: m.arah,
    sumber: m.sumber,
    ukuran: m.sumber === 'forex' ? { lot: m.lot } : { qty: m.lot },
    masukHarga: m.masukHarga,
    keluarHarga: m.keluarHarga,
    pnl: m.pnl,
    masukWaktu: Timestamp.fromMillis(m.waktu),
    keluarWaktu: Timestamp.fromMillis(m.waktu),
    psikologi: {
      emosiMasuk: m.emosiMasuk,
      emosiEvaluasi: m.emosiEvaluasi,
      alasanMasuk: m.alasan,
      catatan: m.catatan,
    },
    _asal: 'manual-v3',
  }, { merge: true });
  return id;
}

export async function hapusTrade(id: string) {
  await deleteDoc(doc(db, 'users', butuhUid(), 'transaksi', id));
}

/* ── Setoran & penarikan ─────────────────────────────────────────────── */

export interface Arus {
  id: string;
  sumber: Sumber;
  jenis: 'setor' | 'tarik';
  nilai: number;
  waktu: number;
  catatan: string;
}

export function useArusKas(): { data: Arus[]; memuat: boolean } {
  const { pengguna, memuat: memuatAuth } = useAuth();
  const [data, setData] = useState<Arus[]>([]);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    if (memuatAuth) return;
    if (!pengguna) { setData([]); setMemuat(false); return; }
    setMemuat(true);
    return onSnapshot(collection(db, 'users', pengguna.uid, 'arusKas'),
      (s) => {
        setData(s.docs.map((d): Arus => {
          const v = d.data();
          return {
            id: d.id,
            sumber: v.sumber === 'forex' ? 'forex' : 'kripto',
            jenis: v.jenis === 'tarik' ? 'tarik' : 'setor',
            nilai: Number(v.nilai) || 0,
            waktu: v.waktu?.toMillis?.() ?? Number(v.waktu) ?? 0,
            catatan: String(v.catatan ?? ''),
          };
        }).sort((a, b) => b.waktu - a.waktu));
        setMemuat(false);
      },
      (e) => { console.warn('arusKas:', e); setMemuat(false); }
    );
  }, [pengguna, memuatAuth]);

  return { data, memuat };
}

export async function simpanArus(a: Omit<Arus, 'id'> & { id?: string }) {
  const uid = butuhUid();
  const id = a.id || `${a.jenis}-${a.sumber}-${a.waktu}`;
  await setDoc(doc(db, 'users', uid, 'arusKas', id), {
    sumber: a.sumber,
    jenis: a.jenis,
    /* Selalu positif. Tandanya ditentukan `jenis`, bukan tanda angkanya —
       kalau keduanya boleh membawa tanda, "tarik -500" jadi ambigu. */
    nilai: Math.abs(a.nilai),
    waktu: Timestamp.fromMillis(a.waktu),
    catatan: a.catatan,
  }, { merge: true });
}

export async function hapusArus(id: string) {
  await deleteDoc(doc(db, 'users', butuhUid(), 'arusKas', id));
}

/** Setoran dikurangi penarikan untuk satu sumber.
 *
 *  Ditambahkan ke saldo, TIDAK ke P/L. Saldo jurnal = saldo awal + arus kas
 *  + P/L; memasukkan arus kas ke P/L akan membuat menyetor uang terlihat
 *  seperti berdagang dengan untung. */
export function arusBersih(daftar: Arus[], sumber: Sumber) {
  return daftar
    .filter((a) => a.sumber === sumber)
    .reduce((s, a) => s + (a.jenis === 'setor' ? a.nilai : -a.nilai), 0);
}
