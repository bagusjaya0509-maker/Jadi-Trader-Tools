import { doc, setDoc, deleteDoc, collection, onSnapshot, Timestamp, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '@/lib/data';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { bacaKoneksi } from '@/lib/koneksi';
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

/** Kunci gabungan sumber + waktu, dipakai untuk mengurutkan per sumber
 *  tanpa indeks komposit. Lihat catatan panjang di lib/data.ts.
 *
 *  13 digit cukup sampai tahun 2286; setelah itu padding perlu ditambah,
 *  dan sampai saat itu urutan teksnya sama persis dengan urutan angkanya. */
export function kunciUrut(sumber: string, waktuMs: number) {
  return `${sumber}#${String(Math.max(0, Math.floor(waktuMs))).padStart(13, '0')}`;
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
    kunciUrut: kunciUrut(m.sumber, m.waktu),
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

/* ════════════════════════════════════════════════════════════════════════
   SINKRON RIWAYAT MT5
   ════════════════════════════════════════════════════════════════════════
   Jurnal Trade-Fi berhenti terisi setelah 9 Agustus, dan penyebabnya bukan
   EA-nya: EA sudah mengirim 1131 transaksi tertutup ke backend dan terus
   mengirim. Yang tidak ada adalah yang MEMBACANYA.

   Jurnal forex di V2 memang selalu diketik tangan — sinkron otomatis di sana
   hanya ada untuk Binance. Jadi transaksi MT5 tidak pernah punya jalan masuk
   ke jurnal kecuali diketik ulang satu per satu.

   Fungsi ini menutup jalur itu. Tidak ada berkas EA baru yang perlu dipasang.
   ════════════════════════════════════════════════════════════════════════ */

const PROXY_BAWAAN = 'https://103-253-145-38.sslip.io';

export interface HasilSinkron {
  ditemukan: number;
  ditambah: number;
  dilewati: number;
}

export interface HasilSinkron2 extends HasilSinkron {
  /** Transaksi terlama & terbaru yang DIKIRIM EA, bukan yang tersimpan.
   *  Dipakai untuk mengatakan terus terang seberapa jauh riwayat MT5-nya
   *  benar-benar mencapai — kalau EA cuma mengirim 30 hari terakhir, tidak
   *  ada tombol di halaman ini yang bisa memunculkan bulan Juli. */
  terlama: number;
  terbaru: number;
  diluarRentang: number;
}

export async function sinkronRiwayatMt5(
  sudahAda: Set<string>,
  sejakMs = 0,
): Promise<HasilSinkron2> {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu dengan akun Google.');

  const dasar = (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
  const token = await u.getIdToken();
  const r = await fetch(`${dasar}/api/mt5/status`, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error(`Backend menjawab ${r.status}`);
  const j = await r.json();

  const riwayat: any[] = j?.data?.riwayat ?? [];
  if (!riwayat.length) {
    throw new Error(j?.terhubung
      ? 'EA tersambung tapi belum mengirim riwayat. Tunggu satu siklus (20 detik) lalu coba lagi.'
      : 'EA belum melapor. Pastikan Algo Trading menyala di MT5.');
  }

  /* Akun sen: nilainya harus dibagi 100, sama seperti saldo dan posisi. */
  const mu: string | null = j?.data?.akun?.mataUang ?? null;
  const sen = !!mu && /cent|USC/i.test(mu);

  /* Firestore membatasi satu batch 500 operasi. Riwayat 1131 baris pada
     sinkron pertama akan melewatinya dan SELURUH batch ditolak — jadi
     dipecah, bukan diharapkan muat. */
  const BATAS = 400;
  let ditambah = 0, dilewati = 0, diluarRentang = 0;
  let terlama = Infinity, terbaru = 0;
  let batch = writeBatch(db);
  let dalamBatch = 0;

  for (const t of riwayat) {
    /* Id dari nomor tiket broker. Itulah yang membuat sinkron ulang aman:
       transaksi yang sama selalu menghasilkan id yang sama, jadi menekan
       tombolnya dua kali tidak menggandakan apa pun. */
    const tiket = String(t.tiket ?? '');
    if (!tiket) { dilewati++; continue; }
    const id = `mt5-${tiket}`;
    if (sudahAda.has(id)) { dilewati++; continue; }

    const laba = Number(t.labaBersih ?? t.profit) || 0;
    const simbol = String(t.simbol ?? '');
    /* EA mengirim detik, Firestore menyimpan milidetik. */
    const waktu = (Number(t.waktuTutup) || 0) * 1000;
    if (!waktu) { dilewati++; continue; }
    terlama = Math.min(terlama, waktu);
    terbaru = Math.max(terbaru, waktu);
    /* Penyaringan rentang terjadi SESUDAH terlama/terbaru dicatat — supaya
       kita tetap bisa memberi tahu sejauh mana riwayat EA sebenarnya
       mencapai, bukan sejauh mana yang kebetulan diminta. */
    if (sejakMs && waktu < sejakMs) { diluarRentang++; continue; }

    batch.set(doc(db, 'users', u.uid, 'transaksi', id), {
      simbol,
      arah: t.arah === 'SELL' ? 'SELL' : 'BUY',
      /* XAU dipisahkan dari forex biasa — V2 memakai `xau` sebagai sumber
         tersendiri, dan pembaca V3 sudah memperlakukan keduanya sebagai
         Trade-Fi. Menyeragamkannya di sini akan membuat data lama dan data
         baru bercerita beda tentang transaksi yang sejenis. */
      sumber: /^XAU/i.test(simbol) ? 'xau' : 'forex',
      ukuran: { lot: Number(t.lot) || 0 },
      keluarHarga: Number(t.hargaTutup) || 0,
      pnl: sen ? laba / 100 : laba,
      masukWaktu: Timestamp.fromMillis(waktu),
      keluarWaktu: Timestamp.fromMillis(waktu),
      sebabKeluar: String(t.komentar ?? '').trim() || 'Ditutup di MT5',
      kunciUrut: kunciUrut(/^XAU/i.test(simbol) ? 'xau' : 'forex', waktu),
      _asal: 'mt5.riwayat',
      _tiket: tiket,
    }, { merge: true });

    ditambah++; dalamBatch++;
    if (dalamBatch >= BATAS) { await batch.commit(); batch = writeBatch(db); dalamBatch = 0; }
  }

  if (dalamBatch > 0) await batch.commit();
  return {
    ditemukan: riwayat.length, ditambah, dilewati, diluarRentang,
    terlama: isFinite(terlama) ? terlama : 0, terbaru,
  };
}
