import type { DompetTertaut } from '@/lib/profil-pengguna';
import type { FillHl, MintaFill } from '@/lib/jurnal-dompet-inti';
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, Timestamp, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '@/lib/data';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';
import type { Sumber } from '@/data/contoh';
import { catatanJurnal, emosiJurnal, emosiEvaluasiJurnal } from '@/lib/medan-jurnal';

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
  /** Nilai posisi dalam DOLAR. Kolom "Size Order" jurnal kripto membaca
   *  medan ini, bukan `lot` — 0,0182 BTC tidak berarti apa-apa sampai
   *  dikalikan harganya. Opsional karena jurnal forex memakai lot. */
  nilaiOrder?: number;
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

/* ════════════════════════════════════════════════════════════════════════
   MEDAN MESIN vs MEDAN TANGAN — kenapa `mesin: true` ada
   ════════════════════════════════════════════════════════════════════════
   Ditemukan pada tinjauan 3 Sep 2026, dan diam-diam menghapus data orang:

   `setDoc(..., { merge: true })` menggabung per JALUR MEDAN, bukan per
   objek. Jadi mengirim `psikologi: { emosiMasuk, emosiEvaluasi,
   alasanMasuk, catatan }` menimpa keempatnya — selalu. Pengguna menandai
   satu trade "Serakah" dan menulis "overtrade sesudah rugi"; putaran
   sinkron berikutnya mengembalikannya jadi "Netral" dengan catatan
   "Ditutup di Hyperliquid (5199)". Panel Pola Emosi pun kembali seragam,
   yaitu satu-satunya bagian jurnal yang isinya benar-benar penilaian
   sendiri.

   Yang salah bukan merge-nya, melainkan bahwa satu tempat dipakai berdua:
   MESIN tahu dari bursa mana trade itu datang; MANUSIA tahu apa yang ia
   rasakan dan pelajari. Keduanya kini punya rumah sendiri:

     psikologi.*   MILIK MANUSIA. Hanya ditulis lewat modal jurnal.
     _sinkron.*    MILIK MESIN. Hanya ditulis jalur sinkron.

   `keTrade` (data.ts) membaca `psikologi.alasanMasuk` LEBIH DULU, lalu
   jatuh ke `_sinkron.alasan`. Jadi kolom Setup tetap berbunyi "Sinkron
   Hyperliquid" selama belum ditimpa — dan begitu orangnya menulis setup-nya
   sendiri di sana, tulisannya menang selamanya.

   Emosi sengaja TIDAK diisi mesin sama sekali. "Netral" yang dulu ditulis
   bukan fakta, melainkan tebakan yang menyamar jadi fakta: mesin tidak tahu
   perasaan siapa pun. Trade hasil sinkron kini kosong emosinya sampai
   orangnya mengisi, dan Pola Emosi cuma menghitung yang benar-benar
   dicatat. */
export interface PilihanSimpan {
  /** true = penulis adalah jalur sinkron, bukan manusia. */
  mesin?: boolean;
}

export async function simpanTrade(m: MasukanTrade, pilihan: PilihanSimpan = {}) {
  const uid = butuhUid();
  const id = m.id || idTrade(m);
  await setDoc(doc(db, 'users', uid, 'transaksi', id), {
    simbol: m.pair.trim().toUpperCase(),
    arah: m.arah,
    sumber: m.sumber,
    /* `nilai` ditulis kalau pemanggilnya tahu — jalur sinkron tahu (qty x
       harga keluar), pengisian tangan belum tentu. Tanpa medan ini, kolom
       "Size Order" hanya bisa diisi lewat margin x leverage, dan sinkron
       tidak punya keduanya: yang ia terima dari bursa cuma qty. */
    ukuran: m.sumber === 'forex'
      ? { lot: m.lot }
      : { qty: m.lot, ...(m.nilaiOrder ? { nilai: m.nilaiOrder } : {}) },
    masukHarga: m.masukHarga,
    keluarHarga: m.keluarHarga,
    pnl: m.pnl,
    masukWaktu: Timestamp.fromMillis(m.waktu),
    keluarWaktu: Timestamp.fromMillis(m.waktu),
    ...(pilihan.mesin
      ? { _sinkron: { alasan: m.alasan, catatan: m.catatan } }
      : {
        psikologi: {
          emosiMasuk: m.emosiMasuk,
          emosiEvaluasi: m.emosiEvaluasi,
          alasanMasuk: m.alasan,
          catatan: m.catatan,
        },
      }),
    kunciUrut: kunciUrut(m.sumber, m.waktu),
    latihan: !!m.latihan,
    _asal: m.latihan ? 'replay-v3' : pilihan.mesin ? 'sinkron-v3' : 'manual-v3',
  }, { merge: true });
  return id;
}

export async function hapusTrade(id: string) {
  await deleteDoc(doc(db, 'users', butuhUid(), 'transaksi', id));
}

/** Medan yang TIDAK dibawa objek `Trade` ringkas milik tabel.
 *
 *  `Trade` sengaja tidak memuatnya — tabel riwayat tidak menampilkan harga
 *  masuk, catatan, maupun emosi evaluasi, dan membawa semuanya untuk 2.000
 *  baris berarti memori yang dibayar setiap orang demi layar sunting yang
 *  mungkin tidak pernah dibuka.
 *
 *  Jadi yang dibuka-lah yang membacanya: satu dokumen, satu pembacaan,
 *  hanya saat pensil ditekan. */
export interface TradePenuh {
  masukHarga: number;
  keluarHarga: number;
  emosiMasuk: string;
  emosiEvaluasi: string;
  catatan: string;
  latihan: boolean;
}

export async function bacaTrade(id: string): Promise<TradePenuh | null> {
  const cuplik = await getDoc(doc(db, 'users', butuhUid(), 'transaksi', id));
  if (!cuplik.exists()) return null;
  const d = cuplik.data() as Record<string, any>;
  const angka = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    masukHarga: angka(d.masukHarga),
    keluarHarga: angka(d.keluarHarga),
    /* Aturan yang SAMA PERSIS dengan tabel riwayat, dari berkas yang sama.
       Kalau keduanya berselisih, modal menampilkan nilai mesin lalu Simpan
       menimpa tulisan tangan — cacat yang justru sedang diperbaiki. */
    emosiMasuk: emosiJurnal(d),
    emosiEvaluasi: emosiEvaluasiJurnal(d),
    catatan: catatanJurnal(d),
    latihan: d.latihan === true,
  };
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
          /* ── KOLOM "SIZE ORDER" MEMBACA INI, BUKAN `lot` ─────────────
             Untuk kripto kolomnya menampilkan NILAI DALAM DOLAR (keputusan
             lama: 0,0182 BTC tidak berarti apa-apa sampai dikalikan
             harganya). Sinkron dulu cuma menulis `lot`, jadi kolomnya
             selalu tanda hubung untuk SEMUA trade hasil sinkron — dan
             tanda hubung di situ berarti "tidak tersimpan", jadi ia
             terbaca seperti data yang hilang, bukan seperti medan yang
             memang tidak pernah diisi.

             Dihitung dari harga KELUAR karena isian penutup memang tidak
             menyebut harga masuknya. Bedanya kecil untuk trade yang wajar,
             dan yang ditanyakan kolom ini memang "posisinya sebesar apa",
             bukan "berapa persisnya saat entry". */
          nilaiOrder: Number((qty * hargaKeluar).toFixed(2)),
          masukHarga: 0, keluarHarga: Number(hargaKeluar.toFixed(6)),
          pnl: Number(pnl.toFixed(4)), waktu,
          emosiMasuk: '', emosiEvaluasi: '',
          alasan: 'Sinkron Binance', catatan: 'Ditutup di Binance (' + orderId + ')',
        }, { mesin: true });
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
        /* Sama dengan jalur Binance — lihat catatan di sana. */
        nilaiOrder: Number((Number(t.qty) * Number(t.hargaKeluar)).toFixed(2)),
        /* Harga masuk 0, sama dengan jalur Binance: isian PENUTUP tidak
           menyebut harga masuknya, dan mengarangnya dari harga keluar
           berarti menulis angka yang tidak pernah terjadi. */
        masukHarga: 0, keluarHarga: Number(Number(t.hargaKeluar).toFixed(6)),
        pnl: Number(Number(t.pnl).toFixed(4)), waktu: Number(t.waktu) || Date.now(),
        emosiMasuk: '', emosiEvaluasi: '',
        alasan: 'Sinkron Hyperliquid',
        catatan: 'Ditutup di Hyperliquid (' + t.oid + ')'
               + (Number(t.isian) > 1 ? ' · ' + t.isian + ' isian' : ''),
      }, { mesin: true });
      masuk++;
    }
    return { masuk, dilewati, galat: null };
  } catch (e) {
    return { masuk: 0, dilewati: 0, galat: e instanceof Error ? e.message : 'gagal sinkron Hyperliquid' };
  }
}

/* ════════════════════════════════════════════════════════════════════════
   SINKRON DARI DOMPET TERTAUT — jurnal yang mengisi dirinya sendiri
   ════════════════════════════════════════════════════════════════════════
   Jalur di atas (`sinkronRiwayatHyperliquid`) membaca akun HL PEMILIK yang
   dikonfigurasi di VPS, lewat X-App-Token. Jalur ini membaca alamat dompet
   yang ditautkan TIAP PENGGUNA ke akunnya (profil-pengguna.ts), langsung
   dari api.hyperliquid.xyz — yang memang CORS terbuka dan tidak butuh
   kunci untuk membaca riwayat alamat mana pun.

   Langsung dari peramban, bukan lewat VPS, karena dua alasan yang tidak
   sama beratnya: VPS tidak punya kredensial Firestore (jadi ia toh tidak
   bisa menulis jurnal siapa pun), dan riwayat on-chain adalah data publik
   — tidak ada yang perlu dilindungi dengan menyalurkannya lewat kita.

   ── SATU KONVENSI ID DENGAN JALUR SERVER: hl<oid> ─────────────────────
   Kalau pemilik menautkan dompet HL-nya sendiri, kedua jalur menulis
   dokumen yang SAMA. Jalur ini membawa lebih banyak (harga masuk, fee),
   jadi dokumennya berakhir dengan isi yang lebih lengkap — dan begitu
   termuat di `sudahAda`, keduanya berhenti menulisnya.

   ── PENGELOMPOKAN DI PERAMBAN, DAN ITU DISENGAJA ──────────────────────
   Catatan di jalur server berbunyi "aturannya satu tempat". Di sini
   aturannya justru dipindah ke `jurnal-dompet-inti.ts` yang bebas
   dependensi dan diuji Node (18 kasus + rekonsiliasi Σ pnl pada 12 ribu
   fill nyata). Yang penting bukan DI MANA aturannya, melainkan bahwa ia
   punya uji yang berjalan tanpa peramban — dan jalur server tidak punya.

   ── HITUNG DULU, TULIS KEMUDIAN ───────────────────────────────────────
   `hanyaHitung` memulangkan berapa yang AKAN ditulis tanpa menulis apa
   pun. Dompet yang aktif bisa punya ribuan trade, dan ribuan setDoc
   adalah kuota Firestore harian yang habis tanpa peringatan. Panel
   menampilkan angkanya dulu; orangnya yang memutuskan.
   ════════════════════════════════════════════════════════════════════ */

export interface HasilSinkronDompet extends HasilSinkronBin {
  /** Dompet EVM yang diperiksa. */
  dompet: number;
  /** Fill yang terambil dari Hyperliquid. */
  fill: number;
  /** Trade bulat yang terbentuk di jendela. */
  trade: number;
  /** Jendela yang BENAR-BENAR terambil (ms) — bisa jauh lebih sempit dari
   *  yang diminta: Hyperliquid hanya menyimpan belasan ribu fill terakhir. */
  dari: number | null;
  sampai: number | null;
  terpotong: boolean;
}

const HASIL_KOSONG: HasilSinkronDompet = {
  masuk: 0, dilewati: 0, galat: null, dompet: 0, fill: 0, trade: 0, dari: null, sampai: null, terpotong: false,
};

/* Daftar dompet disinggahkan 10 menit per uid. Efek auto-sinkron memanggil
   jalur ini tiap 5 menit, dan menembak /api/profil tiap kali demi daftar
   yang hampir tidak pernah berubah cuma membebani VPS. Dikunci per uid
   supaya ganti akun di tab yang sama tidak meminjam daftar orang lain. */
let singgahDompet: { uid: string; pada: number; daftar: DompetTertaut[] } | null = null;

async function daftarDompetTertaut(): Promise<DompetTertaut[]> {
  const uid = auth.currentUser?.uid || '';
  if (singgahDompet && singgahDompet.uid === uid && Date.now() - singgahDompet.pada < 10 * 60_000) {
    return singgahDompet.daftar;
  }
  const { ambilDompetTertaut } = await import('@/lib/profil-pengguna');
  const daftar = await ambilDompetTertaut();
  singgahDompet = { uid, pada: Date.now(), daftar };
  return daftar;
}

/** Dipanggil panel sesudah menautkan/melepas dompet, supaya putaran
 *  berikutnya tidak memakai daftar yang sudah usang. */
export function lupakanSinggahDompet(): void { singgahDompet = null; }

/** Nilai akun Hyperliquid satu alamat, dalam USD. `null` = tidak terbaca.
 *
 *  Tanpa tanda tangan dan tanpa kunci: keadaan akun on-chain itu publik,
 *  dan `info` mengirim CORS terbuka. Tidak lewat `dex-hl.ts` dengan sengaja
 *  — berkas itu menyeret pustaka @nktkas/hyperliquid, dan halaman Jurnal
 *  tidak butuh satu pun kemampuan menandatanganinya.
 *
 *  `nilaiAkun` = ekuitas perp (sudah termasuk P/L mengambang) DITAMBAH USDC
 *  yang menganggur di spot. Keduanya, bukan salah satu: akun unified
 *  menyimpan jaminannya di spot, dan membaca perp saja memulangkan $0 untuk
 *  akun yang sebenarnya berisi. */
export async function saldoDompetHl(alamat: string): Promise<number | null> {
  const tanya = async (type: string) => {
    const r = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, user: alamat }),
    });
    if (!r.ok) throw new Error('Hyperliquid menjawab ' + r.status);
    return r.json();
  };
  try {
    const [perp, spot] = await Promise.all([
      tanya('clearinghouseState'), tanya('spotClearinghouseState'),
    ]);
    const n = (x: unknown) => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
    const usdc = (spot?.balances ?? []).find(
      (b: { coin?: string }) => String(b.coin).toUpperCase() === 'USDC');
    return n(perp?.marginSummary?.accountValue) + n(usdc?.total);
  } catch { return null; }
}

/* ════════════════════════════════════════════════════════════════════════
   SALDO DOMPET TERTAUT — satu baris di kartu Saldo, tanpa panel
   ════════════════════════════════════════════════════════════════════════
   Dulu angka ini dilaporkan oleh panel "Dompet tertaut" di kaki jurnal.
   Panel itu dihapus atas permintaan pemilik 4 Sep 2026 — sesudah saldonya
   berjejer di kartu Saldo, panelnya cuma mengulang kabar yang sudah terbaca
   di atas, dan pengulangan yang memakan seperempat layar terbaca sebagai dua
   fitur yang kebetulan mirip.

   Yang tidak boleh ikut hilang cuma ANGKANYA. Jadi pembacaannya pindah ke
   sini: satu hook, dipanggil halaman jurnal, tanpa satu piksel pun UI.

   Disegarkan saat daftar dompetnya berubah saja. Saldo yang dikejar tiap
   detik cuma menambah permintaan untuk angka yang jarang bergerak, dan
   halaman jurnal bukan papan pantau harga.
   ════════════════════════════════════════════════════════════════════════ */
export function useSaldoDompetTertaut(hidup: boolean) {
  const [isi, setIsi] = useState<{ jumlah: number; saldo: number | null }>({ jumlah: 0, saldo: null });

  useEffect(() => {
    if (!hidup) { setIsi({ jumlah: 0, saldo: null }); return; }
    let jalan = true;
    void (async () => {
      try {
        /* HANYA EVM. Hyperliquid tidak mengenal alamat Solana, jadi dompet
           Solana tidak punya saldo yang bisa dibaca di sini sama sekali. */
        const daftar = (await daftarDompetTertaut()).filter((d) => d.pola === 'evm');
        if (!jalan) return;
        if (!daftar.length) { setIsi({ jumlah: 0, saldo: null }); return; }
        const nilai = await Promise.all(daftar.map((d) => saldoDompetHl(d.alamat)));
        if (!jalan) return;
        const terbaca = nilai.filter((x): x is number => typeof x === 'number');
        setIsi({
          jumlah: daftar.length,
          /* `null` = tidak satu pun terbaca. Berbeda dari nol, dan kartu
             Saldo memang tidak boleh menampilkan baris $0 untuk dompet yang
             sebenarnya cuma gagal dibaca. */
          saldo: terbaca.length ? terbaca.reduce((t, x) => t + x, 0) : null,
        });
      } catch { if (jalan) setIsi({ jumlah: 0, saldo: null }); }
    })();
    return () => { jalan = false; };
  }, [hidup]);

  return isi;
}

async function tanyaFillHl(badan: MintaFill): Promise<FillHl[]> {
  const r = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'userFillsByTime', ...badan }),
  });
  if (!r.ok) throw new Error('Hyperliquid menjawab ' + r.status);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

function alamatPendek(a: string): string {
  return a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a;
}

export async function sinkronRiwayatDompet(
  sudahAda: Set<string>, sejakMs: number,
  pilihan: { daftar?: DompetTertaut[]; hanyaHitung?: boolean; lapor?: (pesan: string) => void } = {},
): Promise<HasilSinkronDompet> {
  try {
    const { tarikSemuaFill, kelompokkanFill } = await import('@/lib/jurnal-dompet-inti');
    /* Hanya dompet EVM: Hyperliquid tidak mengenal alamat Solana. */
    const daftar = (pilihan.daftar ?? await daftarDompetTertaut()).filter((d) => d.pola === 'evm');
    if (!daftar.length) return { ...HASIL_KOSONG };

    const hasil: HasilSinkronDompet = { ...HASIL_KOSONG, dompet: daftar.length };
    for (const d of daftar) {
      pilihan.lapor?.(`Menarik fill ${alamatPendek(d.alamat)}…`);
      const { fills, terpotong } = await tarikSemuaFill(d.alamat, sejakMs, tanyaFillHl);
      hasil.fill += fills.length;
      hasil.terpotong = hasil.terpotong || terpotong;
      if (fills.length) {
        hasil.dari = Math.min(hasil.dari ?? Infinity, fills[0].time);
        hasil.sampai = Math.max(hasil.sampai ?? -Infinity, fills[fills.length - 1].time);
      }

      const trades = kelompokkanFill(fills);
      hasil.trade += trades.length;
      let ditulis = 0;
      for (const t of trades) {
        const id = 'hl' + t.oid;
        if (sudahAda.has(id)) { hasil.dilewati++; continue; }
        hasil.masuk++;
        if (pilihan.hanyaHitung) continue;

        await simpanTrade({
          id, sumber: 'kripto',
          /* Sama dengan keSimbol() di server: koin + 'USDT'. */
          pair: t.koin + 'USDT', arah: t.arah,
          lot: Number(t.qty.toFixed(6)),
          nilaiOrder: Number((t.qty * t.hargaKeluar).toFixed(2)),
          /* Berbeda dari jalur server yang selalu 0: di sini kakinya
             terlihat utuh, jadi rata-rata masuknya nyata — kecuali kaki
             yang dimulai sebelum jendela, yang tetap 0 dan diberi
             keterangan, bukan dikarang. */
          masukHarga: t.masukLengkap ? Number(t.hargaMasuk.toFixed(6)) : 0,
          keluarHarga: Number(t.hargaKeluar.toFixed(6)),
          pnl: Number(t.pnl.toFixed(4)), waktu: t.waktu,
          emosiMasuk: '', emosiEvaluasi: '',
          /* Label yang SAMA dengan jalur server: kolom Setup menampilkan
             medan ini, dan dua label untuk bursa yang sama membingungkan. */
          alasan: 'Sinkron Hyperliquid',
          catatan: 'Ditutup di Hyperliquid (' + t.oid + ')'
                 + (t.isian > 1 ? ' · ' + t.isian + ' isian' : '')
                 + (t.fee !== 0 ? ' · fee ' + t.fee.toFixed(4) : '')
                 + (t.masukLengkap ? '' : ' · harga masuk di luar jendela')
                 + ' · dompet ' + alamatPendek(d.alamat),
        }, { mesin: true });
        if (++ditulis % 25 === 0) pilihan.lapor?.(`${hasil.masuk} trade ditulis…`);
      }
    }
    return hasil;
  } catch (e) {
    return { ...HASIL_KOSONG, galat: e instanceof Error ? e.message : 'gagal sinkron dompet' };
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
