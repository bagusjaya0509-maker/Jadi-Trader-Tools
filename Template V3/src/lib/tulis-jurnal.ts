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

/* Arus kas contoh — dipakai HANYA saat layarnya masih benar-benar kosong.
   Setoran awal lalu dua penambahan modal: bentuk paling wajar dari orang
   yang baru mulai, dan cukup untuk membuat kartu saldo & grafik modal
   punya isi. Tidak pernah ditulis ke Firestore; ia hidup di layar saja. */
const ARUS_CONTOH: Arus[] = [
  { id: 'contoh-3', sumber: 'kripto', jenis: 'setor', nilai: 500, waktu: Date.now() - 5 * 86_400_000, catatan: 'Tambah modal (contoh)' },
  { id: 'contoh-2', sumber: 'forex', jenis: 'setor', nilai: 300, waktu: Date.now() - 26 * 86_400_000, catatan: 'Setoran akun MT5 (contoh)' },
  { id: 'contoh-1', sumber: 'kripto', jenis: 'setor', nilai: 1000, waktu: Date.now() - 62 * 86_400_000, catatan: 'Setoran awal (contoh)' },
];

export function useArusKas(): { data: Arus[]; memuat: boolean; contoh: boolean } {
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

  /* Kosong SETELAH selesai memuat berarti belum ada catatan sama sekali —
     bukan berarti orangnya tidak pernah menyetor. Yang tampil contoh,
     yang tersimpan tetap kosong sampai ia mencatat sendiri. */
  const contoh = !(memuat || memuatAuth) && data.length === 0;
  return { data: contoh ? ARUS_CONTOH : data, memuat, contoh };
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
  /* Baris contoh tidak punya dokumen untuk dihapus — ia cuma tampil selama
     daftarnya masih kosong, dan lenyap sendiri begitu catatan pertama yang
     sungguhan masuk. */
  if (id.startsWith('contoh-')) return;
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
   SINKRON RIWAYAT BINANCE — jurnal kripto
   ════════════════════════════════════════════════════════════════════════
   Order yang DITUTUP DI LUAR situs (aplikasi Binance, web Binance) tidak
   pernah lewat layar kita, jadi satu-satunya sumber kebenarannya adalah
   Binance sendiri. /api/income menyebut simbol mana yang punya REALIZED_PNL
   sejak titik waktu tertentu; /api/user-trades per simbol memberi fill
   aslinya — arah, qty, harga, dan pnl per orderId.

   ID dokumen = bin<orderId>, jadi sinkron boleh diulang kapan pun tanpa
   menggandakan baris — setDoc menimpa dirinya sendiri.
   ════════════════════════════════════════════════════════════════════════ */

export interface HasilSinkronBin { masuk: number; dilewati: number; galat: string | null }

export async function sinkronRiwayatBinance(sudahAda: Set<string>, sejakMs: number): Promise<HasilSinkronBin> {
  const { bacaKoneksi, koneksiLengkap } = await import('@/lib/koneksi');
  const k = bacaKoneksi();
  if (!koneksiLengkap(k)) return { masuk: 0, dilewati: 0, galat: 'Backend URL & App Token belum dipasang di Integrations' };
  const dasar = k.url.trim().replace(/\/+$/, '');
  const kepala = { 'X-App-Token': k.token.trim() };

  try {
    const ri = await fetch(dasar + '/api/income?since=' + sejakMs, { headers: kepala });
    const ji = await ri.json();
    if (!ri.ok) return { masuk: 0, dilewati: 0, galat: ji.error || ('income menjawab ' + ri.status) };
    const simbolKena = [...new Set(
      (ji.income ?? [])
        .filter((x: any) => x.incomeType === 'REALIZED_PNL' && Number(x.income) !== 0)
        .map((x: any) => String(x.symbol))
    )] as string[];
    if (!simbolKena.length) return { masuk: 0, dilewati: 0, galat: null };

    let masuk = 0, dilewati = 0;
    for (const simbol of simbolKena) {
      const rt = await fetch(dasar + '/api/user-trades?symbol=' + simbol + '&since=' + sejakMs, { headers: kepala });
      const jt = await rt.json();
      if (!rt.ok) continue;
      const fills: any[] = jt.trades ?? jt ?? [];
      /* Fill dikelompokkan per orderId — satu order penutup bisa terisi
         beberapa kali, dan itu SATU baris jurnal, bukan tiga. */
      const per = new Map<string, any[]>();
      for (const f of fills) {
        if (Number(f.realizedPnl) === 0) continue; /* fill pembuka */
        const kunci = String(f.orderId);
        if (!per.has(kunci)) per.set(kunci, []);
        per.get(kunci)!.push(f);
      }
      for (const [orderId, grup] of per) {
        const id = 'bin' + orderId;
        if (sudahAda.has(id)) { dilewati++; continue; }
        const qty = grup.reduce((s, f) => s + Number(f.qty), 0);
        const pnl = grup.reduce((s, f) => s + Number(f.realizedPnl), 0);
        const hargaKeluar = grup.reduce((s, f) => s + Number(f.price) * Number(f.qty), 0) / (qty || 1);
        const waktu = Math.max(...grup.map((f) => Number(f.time)));
        /* Sisi fill penutup BUY berarti posisinya SELL — arah jurnal adalah
           arah POSISINYA. */
        const arah = grup[0].side === 'BUY' ? 'SELL' : 'BUY';
        await simpanTrade({
          id, sumber: 'kripto', pair: simbol, arah,
          lot: Number(qty.toFixed(6)),
          masukHarga: 0, keluarHarga: Number(hargaKeluar.toFixed(6)),
          pnl: Number(pnl.toFixed(4)), waktu,
          emosiMasuk: 'Netral', emosiEvaluasi: 'Netral',
          alasan: 'Sinkron Binance', catatan: 'Ditutup di Binance (' + orderId + ')',
        });
        masuk++;
      }
    }
    return { masuk, dilewati, galat: null };
  } catch (e) {
    return { masuk: 0, dilewati: 0, galat: e instanceof Error ? e.message : 'gagal sinkron' };
  }
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
