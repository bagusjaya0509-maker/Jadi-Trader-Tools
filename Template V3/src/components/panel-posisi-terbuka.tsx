import { useEffect, useMemo, useState } from 'react';
import { Copy, Trash2, Loader2 } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, uang, harga as fHarga } from '@/lib/utils';
import { usePosisi } from '@/lib/data';
import { useAkunMt5, versiKurangDari, VERSI_EA_PENDING, segarkanAkunMt5 } from '@/lib/akun';
import { kirimPerintahMt5, tungguHasilMt5 } from '@/lib/mt5-order';
import { useHargaPasar } from '@/lib/harga';
import { bacaSpekMt5 } from '@/lib/pasar';
import { TabelPosisi, type BarisPosisi } from '@/components/tabel-posisi';
import type { Sumber } from '@/data/contoh';
import { simbolDasarMt5 } from '@/lib/simbol';
import { cariStopNyasar } from '@/lib/stop-nyasar';
import { batalPendingNyata } from '@/lib/order-nyata';
import { useOrderSementara, sapuYangSudahAda } from '@/lib/order-sementara';
import { barisPendingKripto, rencanaLokal } from '@/lib/pending-kripto';
import { useAuth } from '@/lib/auth';
import { petaCopy } from '@/lib/tanda-copy';

/* ════════════════════════════════════════════════════════════════════════
   POSISI TERBUKA — dipindah dari Jurnal ke Chart & Backtest
   ════════════════════════════════════════════════════════════════════════
   Panel ini dulu tinggal di Jurnal. Pindah karena tempatnya salah: jurnal
   adalah tempat MENILAI yang sudah lewat, sementara posisi terbuka adalah
   sesuatu yang masih bisa DIPERBUAT — digeser SL-nya, ditutup, ditambah.
   Semua perbuatan itu terjadi di halaman chart, dan memisahkan "apa yang
   sedang jalan" dari tempat orang menanganinya memaksa bolak-balik
   halaman untuk satu keputusan.

   Dibuat komponen tersendiri, bukan disalin: kripto dan Trade-Fi memakai
   isi yang sama persis dan cuma berbeda sumbernya.
   ════════════════════════════════════════════════════════════════════════ */

/** Posisi yang SEDANG terbuka untuk sumber ini.
 *
 *  Kripto dari `public/posisiTerbuka` (dan dari bursa langsung kalau App
 *  Token ada); Trade-Fi dari laporan EA. Dua sumber berbeda, satu tampilan —
 *  yang ditanyakan sama: apa yang sedang berjalan sekarang. */
/** Order yang dipilih untuk disunting di chart. Bentuknya sengaja SATU
 *  untuk kedua pasar dan kedua jenis: yang membedakan cuma isian mana
 *  yang terisi, bukan bentuk datanya — pemanggilnya tidak perlu bercabang
 *  empat kali. */
export interface OrderSunting {
  pasar: 'kripto' | 'mt5';
  jenis: 'posisi' | 'pending';
  /** Simbol chart: "BTCUSDT" atau "MT5:XAUUSD". */
  simbolChart: string;
  /** Simbol asli di bursa/broker. */
  simbol: string;
  arah: 'BUY' | 'SELL';
  entry: number;
  sl: number;
  tp: number;
  /** Ukuran: jumlah koin (kripto) atau lot (MT5). */
  ukuran: number;
  /** Tiket MT5, atau id order pending kripto. */
  tiket?: string;
  /** Berapa order yang diringkas jadi satu baris. Terisi HANYA untuk baris
   *  gabungan; undefined berarti order tunggal yang sungguhan.
   *
   *  Ada di sini karena chart tidak punya cara lain mengetahuinya. `tiket`
   *  kosong TIDAK bisa dipakai sebagai penanda: posisi kripto tidak pernah
   *  punya tiket sama sekali, jadi memakai itu akan mengunci separuh
   *  pemakai dari mengubah SL/TP order tunggal mereka sendiri. */
  gabungan?: number;
}

export function PanelPosisiTerbuka({ sumber, onSunting, onTutup, tanpaBingkai, menyatu }: {
  /** Lepas garis tepi dan latar kartu. Dipakai di panel multi-chart, yang
   *  sudah punya garis pemisahnya sendiri — kartu bergaris di dalam kotak
   *  bergaris menghasilkan dua garis sejajar berjarak beberapa piksel. */
  tanpaBingkai?: boolean;
  /** Satukan kartu ini dengan bidang di sekitarnya: tanpa latar, sudutnya
   *  siku, garis tepinya TETAP. Berbeda maksud dengan `tanpaBingkai`, yang
   *  membuang garisnya juga.
   *
   *  Latar dan sudut diurus satu prop karena keduanya satu keputusan, bukan
   *  dua. Kartu tanpa latar yang sudutnya masih membulat menyisakan celah
   *  segitiga di tiap pojok saat ia berdampingan rapat dengan kotak lain —
   *  yang terbaca sebagai salah pasang, bukan sebagai lengkungan. Memisahkan
   *  keduanya jadi dua prop cuma menyediakan cara untuk salah. */
  menyatu?: boolean;
  sumber: Sumber;
  /** Klik baris = buka order itu di chart. Tanpa ini barisnya tidak bisa
   *  diklik sama sekali. */
  onSunting?: (o: OrderSunting) => void;
  /** Tombol Tutup per baris. Terpisah dari onSunting karena menutup posisi
   *  adalah tindakan yang tidak bisa dibatalkan — ia harus punya tombolnya
   *  sendiri, bukan menumpang klik baris yang sama dengan "lihat di chart". */
  onTutup?: (o: OrderSunting) => void;
}) {
  const { data: posisiKripto, pending: pendingKripto, stop: stopKripto, contoh: kriptoContoh, bursaAktif } = usePosisi();
  const mt5 = useAkunMt5();
  const { pengguna } = useAuth();
  /* TIKET MANA YANG SALINAN. Dihitung dari daftar posisi hidup, bukan
     sekadar dibaca: catatan salinan lahir sebelum tiketnya ada (EA yang
     mengeksekusi, beberapa detik kemudian), jadi penjodohan pertamanya
     terjadi di sini — sekali, lalu tiketnya diikat permanen. */
  const tandaCopy = useMemo(
    () => petaCopy(pengguna?.uid, [...mt5.posisi, ...mt5.pending].map((p) => ({
      tiket: p.tiket, simbol: p.simbol, arah: p.arah, lot: p.lot,
    }))),
    [pengguna?.uid, mt5.posisi, mt5.pending]);

  /* ── Order yang baru saja dikirim, belum terlihat di bursa ────────────
     Jembatan beberapa detik antara menekan Kirim dan putaran baca
     berikutnya. Tanpa ini layar kosong, dan yang dirasakan orangnya bukan
     "sedang menunggu" melainkan "ordernya gagal" — lalu ia memesan lagi.

     Cuma untuk kripto: perintah MT5 punya jalur dan umpan baliknya
     sendiri lewat EA, dan menampilkannya di sini akan menjanjikan sesuatu
     yang panel ini tidak tahu kebenarannya. */
  const semuaSementara = useOrderSementara();
  const sementara = sumber === 'kripto' ? semuaSementara : [];
  /* Disapu SETIAP kali data bursa berubah, bukan lewat timer: begitu
     ordernya muncul dari sumber yang sesungguhnya, baris sementaranya
     tidak punya alasan hidup lagi — dan membiarkan keduanya tampil
     berarti satu order terlihat dua kali. */
  useEffect(() => {
    if (sumber !== 'kripto') return;
    sapuYangSudahAda(posisiKripto, pendingKripto);
  }, [sumber, posisiKripto, pendingKripto]);
  /* ── Rencana SL/TP order yang masih menggantung ───────────────────────
     Ditulis ke localStorage oleh kirimOrderNyata saat ordernya berangkat,
     berikut liveOrderId dari jawaban Binance. Inilah satu-satunya tempat
     rencana itu hidup selama entry-nya belum terisi — di bursa BELUM ada
     apa-apa, karena Binance menolak order reduceOnly tanpa posisi. */
  const rencana = useMemo(
    () => (sumber === 'kripto' ? rencanaLokal() : new Map()),
    /* pendingKripto sebagai kunci: daftar berubah = mungkin ada order
       baru yang rencananya baru saja ditulis. */
    [sumber, pendingKripto],
  );

  /* Order menggantung dari DUA pasar, disamakan bentuknya di sini.
     Keduanya menjawab pertanyaan yang sama — "order-ku sampai atau
     tidak?" — jadi keduanya pantas tampil dengan cara yang sama, walau
     satuannya beda: kripto memakai jumlah koin, MT5 memakai lot.

     Sisi kripto dipetakan lib/pending-kripto.ts, bukan di sini: Dashboard
     memakai baris yang sama persis, dan dua salinan pemetaan sudah pernah
     menyimpang — yang satu menampilkan SL/TP, yang lain tidak. */
  const pending = sumber === 'kripto'
    ? barisPendingKripto(pendingKripto, stopKripto, rencana)
        .map((o) => ({ ...o, copy: undefined as string | undefined }))
    /* Yang paling BARU dipasang di atas. Order pending dibuat berurutan
       waktu, dan yang baru saja dikirim adalah yang sedang dipikirkan —
       menaruhnya di ekor daftar berarti ia harus dicari dulu. */
    : [...mt5.pending].sort((a, b) => b.waktu - a.waktu).map((o) => ({
        kunci: o.tiket, simbol: o.simbol, arah: o.arah,
        copy: tandaCopy.get(o.tiket),
        ukuran: `${o.lot} lot`,
        ukuranNum: o.lot,
        jenis: o.jenis.replace('_', ' '),
        /* MT5 lain cerita: SL/TP menempel di order pending-nya sendiri,
           jadi angka dari EA memang sudah terpasang — bukan rencana. */
        harga: o.harga, sl: o.sl, tp: o.tp, rencana: false,
      }));


  /* ── Penjaga stop nyasar ────────────────────────────────────────────
     SL/TP di Binance menempel pada SIMBOL, bukan pada posisi — jadi ia
     bisa hidup terus setelah posisinya tutup, dan bisa menumpuk kalau
     perubahan lama gagal dibatalkan. Keduanya tidak terlihat di mana pun
     sampai ia menembak posisi yang salah.

     Yang dilaporkan di sini cuma temuannya. Pembatalannya tetap harus
     ditekan orangnya, dengan kotak konfirmasi yang MENYEBUT tiap order —
     membatalkan order diam-diam di latar belakang adalah hal terakhir
     yang boleh dilakukan panel yang cuma bertugas menampilkan. */
  const nyasar = useMemo(
    () => (sumber === 'kripto'
      ? cariStopNyasar(stopKripto, posisiKripto.map((p) => ({ simbol: p.simbol, jumlah: p.jumlah ?? 0 })), pendingKripto)
      : []),
    [sumber, stopKripto, posisiKripto, pendingKripto]);
  /* Tiket yang sedang dibatalkan. Satu per satu, bukan penanda boolean
     bersama: dua order menunggu di daftar yang sama, dan penanda tunggal
     akan memutar spinner di baris yang tidak sedang diapa-apakan. */
  const [batalTiket, setBatalTiket] = useState<string | null>(null);
  const [batalKabar, setBatalKabar] = useState('');
  const [sibukBersih, setSibukBersih] = useState(false);
  const [kabarBersih, setKabarBersih] = useState('');

  async function bersihkanNyasar() {
    const daftar = nyasar.map((n, i) => `${i + 1}. ${n.order.simbol} ${n.order.jenis} @ ${fHarga(n.order.pemicu)} — ${n.ket}`).join('\n');
    if (!confirm(`Batalkan ${nyasar.length} order berikut di Binance?

${daftar}

Posisi yang sedang terbuka TIDAK ikut ditutup.`)) return;
    setSibukBersih(true); setKabarBersih('');
    let sukses = 0; const gagal: string[] = [];
    for (const n of nyasar) {
      try { await batalPendingNyata({ symbol: n.order.simbol, orderId: n.order.id, isAlgo: true }); sukses++; }
      catch { gagal.push(`${n.order.simbol} ${n.order.jenis}`); }
    }
    setSibukBersih(false);
    setKabarBersih(gagal.length
      ? `${sukses} dibatalkan, ${gagal.length} gagal (${gagal.join(', ')}). Coba lagi atau batalkan manual di Binance.`
      : `${sukses} order dibatalkan. Daftarnya menyegar sendiri dalam beberapa detik.`);
  }

  /* Ukuran, entry, SL, dan TP ikut ditampilkan — tanpa keempatnya, panel
     ini cuma memberi tahu ADA posisi, bukan posisi seperti apa. Kripto
     memakai jumlah koin (size order), Trade-Fi memakai lot; keduanya
     ditulis dengan satuannya sendiri karena "0,05" tanpa satuan berarti
     dua hal yang sangat berbeda di dua pasar itu. */
  /* Harga berjalan diambil sendiri di sini, sama seperti Dashboard.
     Tanpa itu `hargaKini` sama dengan entry — dan kolom Gerak akan
     menulis "+0.00%", yang terbaca sebagai "harga tidak bergerak"
     padahal artinya "harganya tidak kita ketahui". Salah satu dari dua
     itu bohong; yang jujur adalah mengambil harganya. */
  /* KECUALI untuk data contoh. Baris contoh sudah membawa hargaKini dan
     pnlFloat yang saling cocok; menimpanya dengan harga bursa yang
     sesungguhnya membuat kolom Gerak menghitung selisih antara harga hari
     ini dan entry karangan — persentase yang tidak berarti apa-apa, dan
     satu permintaan jaringan untuk menghasilkannya. */
  const hargaPasar = useHargaPasar(
    sumber === 'kripto' && !kriptoContoh ? posisiKripto.map((p) => p.simbol) : []);

  /* ── Risiko & target dalam DOLAR ───────────────────────────────────
     SL dan TP sebagai harga cuma bisa dinilai orang yang hafal ukuran
     posisinya. Yang sebenarnya ditanyakan: berapa uang yang hilang kalau
     stop kena, dan berapa yang didapat kalau target kena.

     Rumusnya berbeda per pasar dan itu tidak bisa disatukan:
       · kripto   — jumlah koin x jarak harga
       · Trade-Fi — lot x dolar per lot per 1.0 harga (dilaporkan EA)
     Menyamakan keduanya berarti salah satunya salah 100x lipat.

     undefined kalau SL/TP belum dipasang atau ukurannya tidak diketahui.
     Angka nol di sana akan terbaca "tidak ada risiko", yang justru
     kebalikan dari kenyataannya. */
  function uangDari(jarak: number, unitPerHarga: number): number | undefined {
    if (!(jarak > 0) || !(unitPerHarga > 0)) return undefined;
    return jarak * unitPerHarga;
  }

  /* ── POSISI YANG SUDAH MELEWATI STOPNYA SENDIRI ───────────────────────
     Dokumen `public/posisiTerbuka` ditulis screener V2 dan HANYA selama
     halaman itu terbuka. Posisi yang tertutup saat screener tidak berjalan
     tertinggal di sana — terukur pada MANAUSDT: entry 0,06330 dengan TP
     0,06530, sementara pasarnya sudah 0,07250. Harga melewati targetnya
     11% yang lalu, dan barisnya masih tertulis "sedang berjalan".

     Yang dipakai sebagai penilai adalah SL dan TP MILIK POSISI ITU SENDIRI,
     bukan ambang karangan: kalau harga sudah melewati exit yang ditetapkan
     rencananya, posisi itu menurut rencananya sendiri sudah selesai.

     Hanya berlaku untuk baris yang TIDAK didukung bursa (`jumlah` kosong).
     Posisi yang dilaporkan akun Binance tidak perlu ditebak — kalau ia ada
     di daftar bursa, ia memang masih terbuka, berapa pun harganya. */
  function raguKarena(p: typeof posisiKripto[number], kini?: number): string | undefined {
    if (p.jumlah !== undefined) return undefined;
    if (!kini || !(kini > 0)) return undefined;
    const buy = p.arah === 'BUY';
    const lewatTp = p.tp > 0 && (buy ? kini >= p.tp : kini <= p.tp);
    const lewatSl = p.sl > 0 && (buy ? kini <= p.sl : kini >= p.sl);
    if (!lewatTp && !lewatSl) return undefined;
    return `Harga sekarang ${fHarga(kini)} sudah melewati ${lewatTp ? 'TP' : 'SL'} `
      + `${fHarga(lewatTp ? p.tp : p.sl)}. Posisi ini datang dari dokumen publik screener, `
      + `yang hanya diperbarui selama halaman screener terbuka — kemungkinan besar sudah `
      + `tertutup dan catatannya belum ikut diperbarui. Kalau ternyata masih terbuka, `
      + `berarti order stopnya tidak jalan dan perlu diperiksa langsung di Binance.`;
  }

  const baris: BarisPosisi[] = sumber === 'kripto'
    ? posisiKripto.map((p) => {
        const unit = p.jumlah ?? 0;
        const kini = kriptoContoh ? p.hargaKini : hargaPasar[p.simbol];
        return {
          kunci: p.id, simbol: p.simbol, arah: p.arah,
          ragu: raguKarena(p, kini),
          ket: p.tf && p.tf !== '—' ? p.tf : p.venue,
          ukuran: p.jumlah ? p.jumlah.toLocaleString('id-ID', { maximumFractionDigits: 4 }) : '',
          ukuranNum: p.jumlah,
          /* Data nyata: HANYA harga pasar. `p.hargaKini` dari dokumen publik
             selalu sama dengan entry, jadi memakainya sebagai cadangan akan
             menulis "+0,00%" — yang terbaca "harga tidak bergerak" padahal
             artinya "harganya tidak kita ketahui". Contoh punya harganya
             sendiri dan memang boleh dipakai. */
          entry: p.entry, hargaKini: kini,
          sl: p.sl, tp: p.tp,
          pnl: p.pnlFloat,
          ukuranUsd: unit > 0 && p.entry > 0 ? unit * p.entry : undefined,
          risikoUsd: uangDari(p.sl > 0 ? Math.abs(p.entry - p.sl) : 0, unit),
          imbalUsd: uangDari(p.tp > 0 ? Math.abs(p.tp - p.entry) : 0, unit),
        };
      })
    : mt5.posisi.map((p) => {
        /* Nilai per lot dari EA. bacaSpekMt5 memakai nama DASAR, sementara
           EA melapor nama broker apa adanya (XAUUSDc) — dikupas dulu, sama
           seperti di chart. Null berarti EA lama yang belum melaporkannya;
           kolomnya dibiarkan kosong daripada memakai angka karangan. */
        const nilaiLot = bacaSpekMt5(simbolDasarMt5(p.simbol));
        const unit = nilaiLot ? p.lot * nilaiLot : 0;
        return {
          kunci: p.tiket, simbol: p.simbol, arah: p.arah,
          copy: tandaCopy.get(p.tiket),
          ket: `#${p.tiket}`,
          ukuran: `${p.lot} lot`,
          ukuranNum: p.lot,
          entry: p.hargaBuka, hargaKini: p.hargaKini, sl: p.sl, tp: p.tp,
          pnl: p.profit,
          tiket: p.tiket,
          risikoUsd: uangDari(p.sl > 0 ? Math.abs(p.hargaBuka - p.sl) : 0, unit),
          imbalUsd: uangDari(p.tp > 0 ? Math.abs(p.tp - p.hargaBuka) : 0, unit),
        };
      });

  /* ── BATALKAN ORDER YANG BELUM TERISI ─────────────────────────────
     Sampai sekarang membatalkan pending Trade-Fi menuntut jalan memutar:
     klik barisnya, tunggu chart-nya termuat, cari tombolnya di panel order.
     Padahal yang diinginkan cuma satu hal, dan pada order yang BELUM TERISI
     hal itu tidak mempertaruhkan apa pun — tidak ada posisi yang ditutup
     rugi, cuma niat yang ditarik kembali.

     EA memakai satu perintah untuk posisi maupun pending: terminal yang
     tahu tiket itu milik yang mana. */
  async function batalkanPending(tiket: string) {
    if (batalTiket) return;
    setBatalTiket(tiket);
    setBatalKabar('');
    try {
      const { id } = await kirimPerintahMt5({ aksi: 'TUTUP', tiket });
      const h = await tungguHasilMt5(id);
      if (h.status === 'sukses') {
        /* Dipaksa membaca ulang. Tanpa ini daftarnya menunggu putaran 30
           detik berikutnya, dan order yang sudah hilang dari terminal tetap
           terpampang di layar seolah pembatalannya tidak jalan. */
        segarkanAkunMt5();
      } else {
        setBatalKabar(h.pesan || `Terminal menjawab: ${h.status}`);
      }
    } catch (e) {
      setBatalKabar(e instanceof Error ? e.message : 'Gagal mengirim perintah batal.');
    } finally { setBatalTiket(null); }
  }

  /* Satu bentuk OrderSunting untuk DUA pemakai: klik baris (lihat di chart)
     dan tombol Tutup. Dulu bentuknya ditulis inline di satu tempat saja;
     begitu tombol Tutup ditambahkan, menyalinnya berarti dua salinan yang
     bisa menyimpang — dan yang menyimpang di sini adalah order MANA yang
     ditutup. */
  function keOrder(b: BarisPosisi, gabungan?: number): OrderSunting {
    return {
      pasar: sumber === 'kripto' ? 'kripto' : 'mt5',
      jenis: 'posisi',
      /* Nama DASAR, bukan nama broker: chart & tick dikirim EA dengan
         nama dasar. */
      simbolChart: sumber === 'kripto' ? b.simbol : `MT5:${simbolDasarMt5(b.simbol)}`,
      simbol: b.simbol,
      arah: b.arah,
      entry: b.entry,
      /* Level yang BERAGAM di antara order yang digabung TIDAK diteruskan.
         0 di sini berarti "tidak ada garis", dan itu memang keadaan yang
         sebenarnya: tidak ada satu harga pun yang bisa disebut SL posisi
         ini. Menggambar rata-ratanya akan memasang garis yang tidak
         dimiliki order mana pun, tepat di tempat orang membaca janji
         kapan ia keluar.

         Entry beda urusan dan tetap diteruskan: rata-rata tertimbangnya
         justru titik impas tumpukan yang sungguhan, bukan taksiran. */
      sl: gabungan && b.gabungBeda?.includes('SL') ? 0 : b.sl,
      tp: gabungan && b.gabungBeda?.includes('TP') ? 0 : b.tp,
      /* Ukuran dibaca dari sumber aslinya, bukan dari teks berformat di
         kolom Size — "1.234,5" akan jadi 1,2345 kalau diurai sebagai
         angka Inggris.

         Baris gabungan tidak punya padanan di daftar sumber -- kuncinya
         sintetis, jadi pencariannya PASTI gagal dan `?? 0` mengubah
         kegagalan itu jadi angka nol yang tampak sah. Totalnya sudah
         dihitung benar di `ukuranNum` waktu barisnya digabung; dipakai
         langsung supaya panel tidak pernah melaporkan 0 lot untuk sesuatu
         yang jelas-jelas terbuka. */
      ukuran: gabungan
        ? (b.ukuranNum ?? 0)
        : sumber === 'kripto'
          ? (posisiKripto.find((p) => p.id === b.kunci)?.jumlah ?? 0)
          : (mt5.posisi.find((p) => p.tiket === b.kunci)?.lot ?? 0),
      tiket: b.tiket,
      gabungan: gabungan,
    };
  }

  const total = baris.some((b) => b.pnl !== undefined)
    ? baris.reduce((s, b) => s + (b.pnl ?? 0), 0)
    : null;

  return (
    /* self-start: panel ini setinggi ISINYA, tidak ikut meregang
       mengikuti kolom kalender di sebelahnya. Kotak tinggi yang isinya
       dua baris terbaca seperti ada yang gagal dimuat. */
    <Panel className={cn('self-start',
      tanpaBingkai ? 'rounded-none border-0 bg-transparent' : menyatu && 'rounded-none bg-transparent')}>
      <PanelHead
        /* Judul menyebut PASARNYA, sama persis dengan Dashboard —
           dua panel berdampingan yang sama-sama berjudul "Posisi
           Terbuka" memaksa membaca sub-judulnya dulu untuk tahu yang
           mana. */
        judul={sumber === 'kripto' ? 'Posisi Terbuka — Kripto' : 'Order Terbuka — Trade-Fi'}
        /* Subjudulnya menyebut SUMBERNYA apa adanya. "Berjalan di Binance"
           hanya benar kalau daftarnya memang dibacakan bursa; tanpa App
           Token yang tampil dokumen screener, dan menyebutnya sama adalah
           satu-satunya kalimat di panel ini yang bisa keliru tanpa ada
           angka yang salah. */
        sub={sumber !== 'kripto'
          /* Broker dan nomor akun DI SINI, bukan di lencana harga chart.
             Lencana itu duduk di sebelah angka harga dan harus pendek supaya
             terbaca sekilas; keterangan panjang di sana justru mendorong
             harganya menyempit. Di kepala panel ini ruangnya ada, dan
             pertanyaannya memang "order ini di akun mana" — bukan "chart ini
             sumbernya apa". */
          ? (() => {
              const ak = mt5.daftarAkun.find((a) => a.login === mt5.loginAktif);
              return ak
                ? `${ak.broker || 'MetaTrader 5'} · ${ak.login}`
                : 'Dari MetaTrader 5, lewat EA JadiTraderSync.';
            })()
          : bursaAktif
            ? 'Order yang sedang berjalan di Binance.'
            : 'Dari catatan screener — App Token belum diisi, jadi belum dicocokkan ke Binance.'}
        kanan={
          total === null
            ? <span className="text-[11.5px] text-zinc-500">{baris.length} posisi</span>
            : <span className={cn('angka text-[12.5px]', total >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {uang(total, true)}
              </span>
        }
      />
      <div className="px-5 pb-5">
        {/* Susunan kolom SAMA dengan Dashboard: Pair | Size | Entry |
            Gerak | P/L, SL & TP di baris keterangan. Dulu di sini kartu
            sendiri — dan panel yang menjawab pertanyaan yang sama dengan
            bentuk berbeda memaksa orang belajar dua kali.

            Kolom Emosi DIHAPUS (keputusan pemilik 14 Agu 2026) dan
            digantikan Risk SL & Target TP dalam dolar. Emosi tetap
            tercatat lewat panel tiket saat order dibuat — yang hilang
            cuma penyuntingannya di tabel ini, dan tempatnya dipakai
            untuk angka yang dibutuhkan saat posisi sedang berjalan. */}
        <TabelPosisi
          baris={baris}
          onTutup={onTutup && ((b) => onTutup(keOrder(b)))}
          onKlikBaris={onSunting && ((b, gabungan) => onSunting(keOrder(b, gabungan)))}
          kosong={sumber === 'kripto'
            ? 'Tidak ada posisi kripto terbuka.'
            : mt5.terhubung === true ? 'Tidak ada posisi MT5 terbuka.' : mt5.ket}
        />

        {/* Sama seperti di Dashboard: EA lama tidak bisa melaporkan
            pending, dan layar yang diam soal itu memberi kesan order-nya
            tidak terkirim. */}
        {sumber !== 'kripto' && mt5.terhubung === true && mt5.versiEa
          && versiKurangDari(mt5.versiEa, VERSI_EA_PENDING) && (
          <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
            EA v{mt5.versiEa} belum mengirim pending order.
            <span className="text-amber-200/60">
              {' '}Kompilasi ulang ke v{VERSI_EA_PENDING} (F7 di MetaEditor), lalu pasang ulang EA-nya.
            </span>
          </div>
        )}

        {nyasar.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] px-3 py-2">
            <div className="text-[11px] font-medium text-amber-200/90">
              {nyasar.length} order SL/TP tidak menjaga apa pun
            </div>
            <ul className="mt-1 space-y-0.5">
              {nyasar.map((n) => (
                <li key={n.order.id} className="text-[10.5px] leading-relaxed text-amber-200/60">
                  <span className="text-amber-200/85">{n.order.simbol} {n.order.jenis}</span>
                  {' @ '}<span className="angka">{fHarga(n.order.pemicu)}</span>
                  {' — '}{n.ket}
                </li>
              ))}
            </ul>
            <button onClick={() => void bersihkanNyasar()} disabled={sibukBersih}
              className="mt-1.5 cursor-pointer rounded px-1.5 py-1 text-[10.5px] text-amber-300/90 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50">
              {sibukBersih ? 'Membatalkan…' : `Batalkan ${nyasar.length} order ini`}
            </button>
            {kabarBersih && <div className="mt-0.5 text-[10px] leading-relaxed text-amber-200/70">{kabarBersih}</div>}
          </div>
        )}

        {/* ── Baru dikirim ────────────────────────────────────────────
            DI ATAS segalanya dan TERPISAH dari daftar bursa. Terpisah
            karena isinya belum tentu ada: mencampurnya dengan order yang
            sudah tercatat di Binance membuat dua hal berbeda derajat
            kepastiannya terbaca sederajat. Statusnya ditulis apa adanya —
            "Mengirim…", "Terkirim", atau alasan gagalnya. */}
        {sementara.length > 0 && (
          <div className="mt-3 border-t border-zinc-800/60 pt-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-sky-400/80">
              Baru dikirim · {sementara.length}
            </div>
            <div className="divide-y divide-zinc-800/60">
              {sementara.map((o) => (
                <div key={o.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="angka truncate text-[12px] text-zinc-200">{o.simbol}</span>
                      <span className={cn('text-[10px] font-semibold',
                        o.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>{o.arah}</span>
                      <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[9.5px] text-zinc-500">
                        {o.jenis}
                      </span>
                      <span className="angka hidden text-[10.5px] text-zinc-600 sm:inline">{o.qty}</span>
                    </span>
                    <span className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium',
                      o.status === 'mengirim' ? 'bg-sky-500/10 text-sky-300'
                        : o.status === 'terkirim' ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400')}>
                      {o.status === 'mengirim' && (
                        <span className="size-1.5 animate-pulse rounded-full bg-sky-400" />
                      )}
                      {o.status === 'mengirim' ? 'Mengirim…'
                        : o.status === 'terkirim' ? 'Terkirim' : 'Gagal'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[10.5px] text-zinc-600">
                    <span>Entry <span className="angka text-zinc-500">{fHarga(o.harga)}</span></span>
                    {!!o.sl && <span>SL <span className="angka text-red-400/80">{fHarga(o.sl)}</span></span>}
                    {!!o.tp && <span>TP <span className="angka text-emerald-500/80">{fHarga(o.tp)}</span></span>}
                  </div>
                  {o.status === 'terkirim' && (
                    <div className="mt-0.5 text-[10px] text-zinc-600">
                      Diterima bursa — barisnya pindah ke daftar di bawah begitu Binance mencatatnya.
                    </div>
                  )}
                  {o.status === 'gagal' && o.pesan && (
                    <div className="mt-0.5 text-[10.5px] leading-relaxed text-red-400/90">{o.pesan}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mt-3 border-t border-zinc-800/60 pt-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-amber-400/80">
              Menunggu harga · {pending.length} order
            </div>
            {/* Garis pemisah, bukan kotak berbingkai — order menunggu tidak
                boleh terlihat lebih berbobot daripada posisi yang benar-
                benar berjalan di atasnya. Empat terlihat, sisanya digulir
                supaya panelnya berhenti tumbuh. */}
            <div className={cn('gulir-senyap divide-y divide-zinc-800/60 overflow-y-auto',
              /* Tinggi tepat EMPAT baris, diukur langsung dari CSS
                 terkompilasi — bukan ditebak. Baris MT5 dua baris teks
                 (SL/TP ikut), baris kripto satu; tinggi yang sama untuk
                 keduanya akan memotong baris keempat di satu sisi dan
                 menampilkan enam di sisi lain. */
              /* ENAM baris terlihat, bukan empat: panel di bawahnya masih
                 punya ruang, dan daftar yang berhenti di empat memaksa
                 menggulir untuk hal yang sebenarnya muat. Angkanya
                 kelipatan tinggi baris yang sama seperti sebelumnya
                 (kripto 35,5 px; Trade-Fi 53,25 px). */
              sumber === 'kripto' ? 'max-h-[213px]' : 'max-h-[320px]')}>
              {pending.map((o) => (
                <div key={o.kunci}
                     onClick={onSunting ? () => onSunting({
                       pasar: sumber === 'kripto' ? 'kripto' : 'mt5',
                       jenis: 'pending',
                       simbolChart: sumber === 'kripto' ? o.simbol : `MT5:${simbolDasarMt5(o.simbol)}`,
                       simbol: o.simbol,
                       arah: o.arah,
                       /* Rencana TIDAK ikut ke chart: garis SL/TP di sana
                          bisa diseret lalu dikirim, dan mengirim perubahan
                          untuk stop yang belum ada di bursa hanya
                          menghasilkan galat. Yang dibawa cuma yang
                          benar-benar terpasang. */
                       entry: o.harga, sl: o.rencana ? 0 : o.sl, tp: o.rencana ? 0 : o.tp,
                       ukuran: sumber === 'kripto'
                         ? (pendingKripto.find((x) => x.id === o.kunci)?.qty ?? 0)
                         : (mt5.pending.find((x) => x.tiket === o.kunci)?.lot ?? 0),
                       tiket: o.kunci,
                     }) : undefined}
                     title={onSunting ? 'Buka di chart untuk mengubah harga/SL/TP' : undefined}
                     className={cn('py-2', onSunting && 'cursor-pointer rounded transition-colors hover:bg-zinc-800/40')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[12.5px] text-zinc-200">{o.simbol}</span>
                      {o.copy && (
                        <span title={`Order ini masuk otomatis karena kamu mengikuti ${o.copy} di Copy Signal.`}
                              aria-label={'Salinan sinyal ' + o.copy}>
                          <Copy className="-ml-1 size-3 shrink-0 text-sky-400/80" />
                        </span>
                      )}
                      <span className={cn('text-[10.5px]',
                        o.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                        {o.jenis}
                      </span>
                      <span className="angka shrink-0 text-[11px] text-zinc-400">{o.ukuran}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="angka text-[12px] text-amber-400/90">{fHarga(o.harga)}</span>
                      {/* Hanya untuk Trade-Fi. Pending kripto di daftar ini
                          sebagian RENCANA lokal yang belum ada di bursa,
                          dan satu ikon yang kadang menghapus order sungguhan
                          kadang cuma catatan sendiri adalah ikon yang tidak
                          bisa dipercaya. */}
                      {sumber !== 'kripto' && (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); void batalkanPending(o.kunci); }}
                          disabled={batalTiket !== null}
                          title="Batalkan order ini di MT5"
                          aria-label={`Batalkan ${o.arah} ${o.simbol}`}
                          className="rounded p-0.5 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40">
                          {batalTiket === o.kunci
                            ? <Loader2 className="size-3.5 animate-spin" />
                            : <Trash2 className="size-3.5" />}
                        </button>
                      )}
                    </span>
                  </div>
                  {/* SL/TP hanya ditulis kalau order-nya memang membawanya.
                      Untuk entry kripto yang menggantung, angkanya RENCANA —
                      stop sungguhan baru dipasang saat entry terisi, karena
                      Binance menolak order penutup tanpa posisi. Labelnya
                      wajib mengatakan itu: angka tanpa keterangan terbaca
                      sebagai stop yang sudah hidup di bursa. */}
                  {(o.sl > 0 || o.tp > 0) && (
                    <div className="mt-0.5 flex items-center gap-4 text-[10.5px] text-zinc-600">
                      <span>SL <span className="angka text-red-400/90">{o.sl ? fHarga(o.sl) : '—'}</span></span>
                      <span>TP <span className="angka text-emerald-500/90">{o.tp ? fHarga(o.tp) : '—'}</span></span>
                      {o.rencana && (
                        <span className="rounded bg-zinc-800/80 px-1.5 py-px text-[9.5px] text-zinc-500"
                              title="Stop sungguhan baru dipasang di Binance begitu entry-nya terisi.">
                          rencana — dipasang saat terisi
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {batalKabar && (
              <p className="mt-2 text-[11px] text-red-400/90">{batalKabar}</p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
