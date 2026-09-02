import { doc, setDoc, deleteDoc, collection, onSnapshot, Timestamp, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '@/lib/data';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';
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
  /** Hasil LATIHAN (replay), bukan transaksi sungguhan. Tetap tersimpan
   *  dan tetap terlihat di riwayat, tapi tidak ikut dijumlah ke Net P/L,
   *  winrate, dan profit factor — angka yang dipakai menilai diri sendiri
   *  tidak boleh memuat trade yang tidak pernah mempertaruhkan apa pun. */
  latihan?: boolean;
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
    latihan: !!m.latihan,
    _asal: m.latihan ? 'replay-v3' : 'manual-v3',
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

/* TIDAK ADA ARUS KAS CONTOH — dan ini disengaja.
   ──────────────────────────────────────────────────────────────────────
   Pernah ada, selama satu rilis, dengan maksud baik: mengisi kartu saldo
   milik pengguna baru. Akibatnya saldo Dashboard naik $1.800 di atas
   jurnal untuk SETIAP akun yang tidak pernah mencatat setoran — dan tidak
   pernah mencatat setoran bukan tanda pengguna baru, itu cuma tanda
   fiturnya tidak dipakai.

   Bedanya dengan contoh di Personal Area: porto contoh berhenti di
   halamannya sendiri, sedangkan arus kas ikut ke dalam ARITMATIKA modal,
   saldo, dan kurva dua bulan yang dibaca halaman lain. Angka yang salah
   lebih buruk daripada kartu yang kosong. */
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
   SINKRON RIWAYAT HYPERLIQUID
   ════════════════════════════════════════════════════════════════════════
   SATU jurnal, bursa jadi keterangan — bentuk yang diminta pemilik supaya
   broker berikutnya tinggal masuk tanpa jurnal kedua.

   Trade Hyperliquid ditulis ke `sumber: 'kripto'` yang SAMA dengan Binance,
   jadi win rate, Net P/L, dan kurva ekuitas menghitung keduanya sekaligus.
   Yang membedakannya cuma `alasan` — dan itu bukan penanda seadanya: kolom
   Setup di Riwayat Trade memang menampilkan medan itu, jadi tiap baris
   menyebut sendiri dari bursa mana ia datang.

   ── ID DETERMINISTIK, PREFIKS BERBEDA ──────────────────────────────────
   `hl<oid>` sejajar `bin<orderId>`. Prefiksnya wajib berbeda: oid
   Hyperliquid dan orderId Binance sama-sama angka, dan tanpa prefiks dua
   trade dari bursa berbeda bisa bertabrakan di satu id — yang kedua
   menimpa yang pertama, diam-diam.

   ── PENGELOMPOKAN DIKERJAKAN SERVER ────────────────────────────────────
   Berbeda dari jalur Binance yang mengelompokkan fill di sini, jalur ini
   menerima trade yang SUDAH utuh dari /api/hl/user-trades. Aturannya satu
   tempat; aturan yang disalin ke layar akan berselisih dengan yang di
   server pada hari salah satunya disunting.
   ════════════════════════════════════════════════════════════════════════ */

export async function sinkronRiwayatHyperliquid(
  sudahAda: Set<string>, sejakMs: number,
): Promise<HasilSinkronBin> {
  const { bacaKoneksi, koneksiLengkap } = await import('@/lib/koneksi');
  const k = bacaKoneksi();
  if (!koneksiLengkap(k)) return { masuk: 0, dilewati: 0, galat: null };
  const dasar = k.url.trim().replace(/\/+$/, '');
  const kepala = { 'X-App-Token': k.token.trim() };

  try {
    const r = await fetch(dasar + '/api/hl/user-trades?since=' + sejakMs, { headers: kepala });
    const j = await r.json();
    if (!r.ok) return { masuk: 0, dilewati: 0, galat: j.error || ('hl/user-trades menjawab ' + r.status) };
    /* Hyperliquid mati bukan galat yang perlu ditampilkan — jurnal Binance
       tetap jalan, dan pesan merah untuk bursa yang memang belum dipakai
       cuma bising. */
    if (j.aktif === false) return { masuk: 0, dilewati: 0, galat: null };

    let masuk = 0, dilewati = 0;
    for (const t of (j.trades ?? [])) {
      const id = 'hl' + t.oid;
      if (sudahAda.has(id)) { dilewati++; continue; }
      await simpanTrade({
        id, sumber: 'kripto', pair: String(t.simbol || ''), arah: t.arah === 'SELL' ? 'SELL' : 'BUY',
        lot: Number(Number(t.qty).toFixed(6)),
        /* Harga masuk 0, sama dengan jalur Binance: isian PENUTUP tidak
           menyebut harga masuknya, dan mengarangnya dari harga keluar
           berarti menulis angka yang tidak pernah terjadi. */
        masukHarga: 0, keluarHarga: Number(Number(t.hargaKeluar).toFixed(6)),
        pnl: Number(Number(t.pnl).toFixed(4)), waktu: Number(t.waktu) || Date.now(),
        emosiMasuk: 'Netral', emosiEvaluasi: 'Netral',
        alasan: 'Sinkron Hyperliquid',
        catatan: 'Ditutup di Hyperliquid (' + t.oid + ')'
               + (Number(t.isian) > 1 ? ' · ' + t.isian + ' isian' : ''),
      });
      masuk++;
    }
    return { masuk, dilewati, galat: null };
  } catch (e) {
    return { masuk: 0, dilewati: 0, galat: e instanceof Error ? e.message : 'gagal sinkron Hyperliquid' };
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

  /* Nomor akun terminal yang sedang dipilih. Dipakai menyusun id riwayat —
     lihat catatan panjang di bawah. Diambil dari `j.login` (yang server
     pulangkan sebagai akun terpilih), BUKAN dari `j.data.akun.login`: yang
     terakhir tidak selalu terisi di laporan EA lama. */
  const loginAkun = String(j?.login || j?.data?.akun?.login || '');

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
    /* Id dari NOMOR AKUN + nomor tiket. Itulah yang membuat sinkron ulang
       aman: transaksi yang sama selalu menghasilkan id yang sama, jadi
       menekan tombolnya dua kali tidak menggandakan apa pun.

       NOMOR AKUNNYA WAJIB IKUT, dan ini bukan kerapian. Nomor tiket unik
       PER BROKER, bukan global — Exness dan HFM sama-sama punya tiket
       12345. Selama id-nya cuma `mt5-<tiket>`, trade dari broker kedua
       MENIMPA trade broker pertama di jurnal: jumlah trade berkurang, atau
       sebuah baris tiba-tiba berganti pair dan lot. Bukan galat, cuma angka
       yang salah — jenis kerusakan yang paling lama tidak ketahuan.

       Peluangnya bukan teoretis: banyak broker memulai penomoran dari angka
       rendah, jadi tabrakan justru paling mungkin di trade-trade awal.

       ENTRI LAMA DIPERTAHANKAN pada id lamanya. Kalau `mt5-<tiket>` sudah
       ada di jurnal, itu yang dipakai — mengganti id-nya akan menyisakan
       dokumen lama sebagai yatim DAN menulis salinan baru, jadi satu trade
       terhitung dua kali. Yang berformat lama tetap lama, yang baru pakai
       format baru, dan keduanya tidak pernah bertabrakan. */
    const tiket = String(t.tiket ?? '');
    if (!tiket) { dilewati++; continue; }
    const idLama = `mt5-${tiket}`;
    const id = sudahAda.has(idLama) ? idLama
      : (loginAkun ? `mt5-${loginAkun}-${tiket}` : idLama);
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
