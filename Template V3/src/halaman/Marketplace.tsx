import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Crown, Download, Copy, X, Star, MessageCircle, ExternalLink, KeyRound, Loader2, Trash2,
  LineChart,
  GripHorizontal, Store, MessagesSquare, ThumbsUp, CornerDownRight, Send,
} from 'lucide-react';
import { PeragaProduk } from '@/components/peraga-produk';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, tanggalPendek } from '@/lib/utils';
import { type Produk } from '@/data/contoh';
import { bisaDipasang, pasangIndikator } from '@/lib/pasang-indikator';
import { useSuka, tukarSuka, useBalasanUlasan, kirimBalasan, hapusBalasan } from '@/lib/ulasan';

/* ── RINGKASAN KARTU: dipotong tiga baris ────────────────────────────────
   Sebelumnya keterangan produk ditulis seutuhnya dan kartunya dibiarkan
   memanjang mengikutinya. Di grid, kartu satu baris SELALU setinggi kartu
   tertinggi — jadi satu produk berketerangan sebelas baris memaksa tiga
   tetangganya menyediakan delapan baris kosong yang tidak berisi apa pun.
   Yang terlihat bukan kartu yang lapang, melainkan kartu yang gagal terisi.

   Tiga baris dipilih karena itu yang sudah terbaca rapi pada produk-produk
   pendek yang ada sekarang — bukan angka yang dikarang, tapi tinggi yang
   memang sudah berhasil di layar.

   TAUTANNYA MUNCUL HANYA KALAU MEMANG ADA YANG DIPOTONG, dan itu diukur,
   bukan ditebak dari jumlah huruf: huruf yang sama menghasilkan jumlah baris
   yang berbeda di lebar kolom yang berbeda. "Lihat selengkapnya" pada
   keterangan yang sudah utuh adalah janji yang tidak ditepati — ditekan, dan
   yang terbuka ternyata teks yang sama persis. */
function RingkasKartu({ teks, onBuka }: { teks: string; onBuka: () => void }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [potong, setPotong] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* line-clamp memakai -webkit-box + overflow:hidden, jadi scrollHeight
       tetap setinggi teks seutuhnya sementara clientHeight terkunci tiga
       baris. Selisihnya itulah yang tidak terlihat. Toleransi 1px untuk
       pembulatan pecahan piksel di layar ber-DPI tinggi. */
    const ukur = () => setPotong(el.scrollHeight > el.clientHeight + 1);
    ukur();
    /* Diukur ulang saat lebar kolom berubah — jendela dibesar-kecilkan atau
       grid berpindah dari empat kolom ke dua. Keterangan yang muat di kolom
       lebar bisa terpotong di kolom sempit, dan sebaliknya. */
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, [teks]);

  return (
    <div className="mt-3 flex-1">
      <p ref={ref} className="line-clamp-3 text-[12.5px] leading-relaxed text-zinc-400">{teks}</p>
      {potong && (
        <button onClick={onBuka}
                className="mt-1 cursor-pointer text-[12px] text-zinc-500 underline-offset-2
                           transition-colors hover:text-zinc-300 hover:underline">
          lihat selengkapnya
        </button>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   TOMBOL PASANG KE CHART
   ════════════════════════════════════════════════════════════════════════
   Hanya untuk indikator Pine, yang seluruhnya hidup di dalam aplikasi ini.
   EA MetaTrader tidak pernah menampilkannya: ia harus diunduh dan dipasang
   di terminal sendiri, dan tombol "Pasang" yang tidak memasang apa pun lebih
   buruk daripada tidak ada tombol.

   SIAPA YANG BOLEH:
     · pemilik — selalu
     · indikator gratis — siapa pun yang paketnya bukan Event Terbatas
     · indikator berbayar — pemegang paket TAHUNAN

   Paket tahunan dipakai sebagai tanda "sudah membeli" karena itulah satu-
   satunya tingkat langganan yang tercatat per akun di sistem ini. Catatan
   pembelian per produk belum ada; begitu ada, syaratnya ditambahkan di SATU
   tempat ini, bukan disebar ke tiap kartu.

   Komponen tersendiri, bukan potongan di dalam map kartu: ia menyimpan pesan
   hasilnya sendiri, dan satu state pesan yang dibagi seluruh kartu akan
   membuat menekan tombol di satu kartu memunculkan kabar di kartu lain. */
/* `besar`: versi berlabel untuk modal detail. Di kartu ia cukup ikon —
   kartunya sempit dan tombol berteks di sana berebut ruang dengan Detail.
   Di modal justru sebaliknya: itu SATU-SATUNYA jalan mendapatkan
   indikatornya, dan jalan satu-satunya tidak pantas berupa ikon 14 piksel
   yang harus ditebak artinya. */
function TombolPasangChart({ produk, besar }: { produk: Produk; besar?: boolean }) {
  const { pemilik } = useAuth();
  const { paket, memuat } = usePaket();
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState(false);

  if (!bisaDipasang(produk)) return null;

  const gratis = produk.harga === 0;
  const kunciEvent = gratis && !pemilik && (memuat || paket.paket === 'gratis');
  const boleh = pemilik || (gratis ? !kunciEvent : paket.paket === 'tahunan');
  const alasan = boleh
    ? 'Pasang ke Chart & Entry'
    : gratis
      ? 'Isi Marketplace belum termasuk paket Event Terbatas'
      : 'Perlu paket Tahunan untuk memasang indikator berbayar';

  function pasang() {
    const h = pasangIndikator(produk);
    setGagal(h === 'gagal');
    setPesan(
      h === 'gagal' ? 'Gagal memasang — penyimpanan peramban ditolak.'
      : h === 'sudahAda' ? 'Sudah terpasang — diaktifkan di chart.'
      : h === 'diperbarui' ? 'Versi terbaru dipasang & diaktifkan.'
      : 'Terpasang — buka Chart & Entry.');
    setTimeout(() => setPesan(''), 4000);
  }

  return (
    <span className="relative">
      <button
        onClick={() => boleh && pasang()}
        disabled={!boleh}
        title={alasan}
        aria-label={alasan}
        className={cn('flex items-center transition-colors',
          besar
            ? 'gap-2 rounded-full px-6 py-3 text-[13px] font-semibold'
            : 'rounded-md border px-2 py-1.5',
          boleh
            ? (besar
                ? 'cursor-pointer bg-zinc-100 text-zinc-950 hover:bg-white'
                : 'cursor-pointer border-emerald-600/50 text-emerald-400 hover:border-emerald-500 hover:text-emerald-300')
            : (besar
                ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
                : 'cursor-not-allowed border-zinc-800 text-zinc-700'))}
      >
        {/* IKON GRAFIK, BUKAN PANAH UNDUH. Tombol ini tidak mengunduh apa
            pun — ia menaruh indikatornya ke chart di dalam aplikasi. Panah
            unduh di sebelah kata "Detail" terbaca sebagai "ambil berkasnya",
            dan sesudah jalur unduhan dicabut itu jadi janji yang tidak ada
            isinya. */}
        <LineChart className={besar ? 'size-4' : 'size-3.5'} strokeWidth={2} />
        {besar && 'Terapkan ke Chart'}
      </button>
      {/* Kabar hasil digantung DI ATAS tombolnya, bukan disisipkan ke dalam
          kartu: kartu yang tiba-tiba bertambah tinggi menggeser seluruh grid
          di bawahnya, dan yang bergeser justru kartu yang sedang dibaca. */}
      {pesan && (
        <span className={cn('absolute bottom-full right-0 mb-1.5 w-max max-w-[15rem] rounded-md border px-2 py-1 text-[11px] shadow-xl',
          gagal ? 'border-red-500/40 bg-zinc-950 text-red-300' : 'border-emerald-600/40 bg-zinc-950 text-emerald-300')}>
          {pesan}
        </span>
      )}
    </span>
  );
}
import { useProduk, simpanKatalogProduk } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { usePaket } from '@/lib/paket';
import { suratLisensi, sisipkanPenanda, unduhTeks } from '@/lib/surat-lisensi';
import { useUlasan, kirimUlasan, hapusUlasan } from '@/lib/ulasan';
import { useTutupLuar } from '@/lib/tutup-luar';
import { useHargaPaket, rupiah } from '@/lib/harga-akses';
import {
  ambilSumberGratis, ambilSumberBerlisensi, tautanBerkas,
  mintaLisensi, usePermintaanSaya,
} from '@/lib/admin';

/* Kode lisensi pembeli disimpan di perangkatnya sendiri. Mengetiknya ulang
   tiap kali ingin mengambil versi baru adalah gesekan yang tidak perlu — dan
   kode itu memang bukan rahasia bersama, ia milik pembeli itu sendiri. */
const KUNCI_LISENSI = 'jtLisensiSaya_v1';

/* Jenis sumber ditentukan dari nama berkas di katalog, persis seperti yang
   dilakukan marketplace V2: `.mq5` diambil sebagai mq5, sisanya txt. */
function jenisSumber(berkas?: string): 'txt' | 'mq5' {
  return /\.mq5$/i.test(berkas ?? '') ? 'mq5' : 'txt';
}

/* ── Pengambilan sumber produk ────────────────────────────────────────────
   Satu komponen untuk dua jalur karena keduanya berakhir sama: teks sumber
   di papan klip. Yang berbeda cuma gerbangnya — produk gratis lewat
   `/api/produk/gratis`, premium lewat `/api/produk` dengan kode lisensi.

   Sebelum ini tombolnya cuma hiasan: "Salin Kode" tidak menyalin apa pun,
   dan "Buat Kode Lisensi" menjanjikan sesuatu yang memang tidak bisa
   dilakukan dari sisi pembeli — hanya penjual yang boleh menerbitkan kode. */
function AmbilSumber({ produk }: { produk: Produk }) {
  const [kode, setKode] = useState(() => {
    try { return localStorage.getItem(KUNCI_LISENSI) ?? ''; } catch { return ''; }
  });
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [gagal, setGagal] = useState(false);
  /* Persetujuan HARUS diklik sebelum kode premium keluar — pasal larangan
     menyebarluaskan tidak berarti apa-apa kalau tidak pernah disetujui. */
  const [setuju, setSetuju] = useState(false);
  const [surat, setSurat] = useState<string | null>(null);
  const [bukaSurat, setBukaSurat] = useState(false);
  /* Lisensi TERBUKTI aktif — bukan sekadar "kodenya sudah diketik".
     ────────────────────────────────────────────────────────────────────
     Tombol unduh dulu selalu tampil, bahkan dengan kolom kode kosong.
     Servernya memang menolak (400 "Kode lisensi tidak valid"), jadi tidak
     ada berkas yang pernah bocor — tapi tampilannya berkata sebaliknya:
     produk berbayar terlihat seperti bisa langsung diunduh, dan yang
     mengkliknya disambut JSON error alih-alih berkasnya.
     Sekarang tombolnya baru muncul setelah server benar-benar meloloskan
     kode itu sekali — bukti aktif, bukan janji. */
  const [terbuka, setTerbuka] = useState(false);
  const { pengguna, pemilik } = useAuth();
  const gratis = produk.harga === 0;

  /* ── PRODUK GRATIS PUN TIDAK TERMASUK PAKET EVENT TERBATAS ────────────
     Kartu harga sudah menyatakannya: "Free Indikator & EA di Marketplace"
     dicoret di paket gratis. Yang gratis di sini berarti tidak perlu KODE
     LISENSI — bukan berarti terbuka untuk paket mana pun.

     Terkunci berlaku untuk yang gratis saja. Produk berbayar sudah punya
     gerbangnya sendiri berupa kode lisensi, dan menumpuk dua gerbang di
     satu tombol membuat penolakannya tidak jelas datang dari mana. */
  const { paket, memuat: memuatPaket } = usePaket();
  const kunciEvent = gratis && !pemilik && (memuatPaket || paket.paket === 'gratis');
  const alasanKunci = kunciEvent
    ? 'Isi Marketplace belum termasuk paket Event Terbatas'
    : undefined;

  async function ambil() {
    setSibuk(true); setKabar(''); setGagal(false);
    try {
      const rapi = kode.trim().toUpperCase();
      const mentah = gratis
        ? await ambilSumberGratis(produk.id, jenisSumber(produk.berkas))
        : await ambilSumberBerlisensi(produk.id, rapi);
      /* Salinan premium DITANDAI dengan kode lisensinya — empat titik yang
         menyamar sebagai catatan build, identik dengan V2, supaya salinan
         yang beredar bisa ditelusuri kembali ke pemegang lisensinya. */
      const isi = gratis ? mentah : sisipkanPenanda(mentah, rapi);
      await navigator.clipboard.writeText(isi);
      if (!gratis) {
        try { localStorage.setItem(KUNCI_LISENSI, rapi); } catch { /* mode privat */ }
        setSurat(suratLisensi({
          produk: produk.nama, kode: rapi,
          nama: pengguna?.displayName || pengguna?.email?.split('@')[0] || 'Pemegang lisensi',
          email: pengguna?.email || '-',
        }));
      }
      setTerbuka(true);
      /* Tujuan tempelnya ikut jenis produknya: menyuruh pemilik EA MQL5
         membuka Pine Editor TradingView adalah petunjuk yang salah alamat. */
      const tujuan = produk.unduhan === 'mq5' || produk.unduhan === 'ex5'
        ? 'Tempel di MetaEditor lalu Compile (F7).'
        : 'Tempel di Pine Editor TradingView.';
      setKabar(`Tersalin — ${isi.length.toLocaleString('id-ID')} karakter. ${tujuan}`
        + (gratis ? '' : ' Salinan ini memuat penanda lisensimu.'));
    } catch (e) {
      setGagal(true);
      const asli = e instanceof Error ? e.message : 'Gagal mengambil sumber';
      /* Pesan backend ditulis untuk pemilik, bukan pembeli. "Produk ini tidak
         ditandai gratis" benar secara teknis tapi tidak memberi tahu pembeli
         apa yang harus dia lakukan — dan jawabannya memang bukan apa-apa,
         melainkan menunggu penjualnya mengunggah sumbernya. */
      setKabar(
        /tidak ditandai gratis|belum tersedia/i.test(asli)
          ? 'Sumbernya belum diunggah ke server. Hubungi penjual — produk ini gratis, cuma berkasnya yang belum dipasang.'
          : asli
      );
    } finally { setSibuk(false); }
  }

  return (
    <div>
      {!gratis && (
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] text-zinc-500">Kode lisensi</label>
          <input
            value={kode} onChange={(e) => { setKode(e.target.value); setTerbuka(false); }}
            placeholder="JT3-XXXX-XXXX-XXXX" spellCheck={false}
            className="angka h-10 w-full max-w-[280px] rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[13px]
                       uppercase tracking-wide text-zinc-100 outline-none transition-colors
                       placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-600
                       focus-visible:border-zinc-600" />
          <div className="mt-1.5 text-[11.5px] text-zinc-600">
            Kode diberikan penjual setelah pembayaran diterima.
          </div>
          <label className="mt-3 flex max-w-[560px] cursor-pointer items-start gap-2 text-[12px] leading-relaxed text-zinc-400">
            <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)}
                   className="mt-0.5 size-3.5 cursor-pointer accent-zinc-200" />
            <span>
              Saya memahami lisensi ini <b>personal</b> dan setuju untuk <b>tidak menyebarluaskan</b>{' '}
              kode ini dalam bentuk apa pun. Setiap salinan tercatat pada penerbit dan dapat
              ditelusuri bila ditemukan beredar.
            </span>
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => void ambil()} title={alasanKunci}
          disabled={sibuk || kunciEvent || (!gratis && (kode.trim().length < 8 || !setuju))}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-zinc-100 px-6 py-3 text-[13px] font-semibold
                     text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
          {sibuk ? <Loader2 className="size-4 animate-spin" /> : gratis ? <Copy className="size-4" /> : <KeyRound className="size-4" />}
          {gratis ? 'Salin Kode' : 'Buka & Salin Kode'}
        </button>
        {/* Berkas biner (.ex5/.mq5) tidak bisa disalin sebagai teks, jadi
            jalurnya unduhan langsung. Muncul kalau katalog menyatakan
            produknya punya berkas — DAN, untuk produk berbayar, hanya
            setelah lisensinya terbukti aktif lewat tombol di sebelah. */}
        {produk.unduhan && (gratis || terbuka) && kunciEvent && (
          <button type="button" disabled title={alasanKunci}
             className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-6 py-3
                        text-[13px] font-semibold text-zinc-100 opacity-50 disabled:cursor-not-allowed">
            <Download className="size-4" /> Unduh .{produk.unduhan}
          </button>
        )}
        {produk.unduhan && (gratis || terbuka) && !kunciEvent && (
          <a href={tautanBerkas(produk.id, gratis ? '' : kode.trim().toUpperCase(), produk.unduhan)}
             className="flex cursor-pointer items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-6 py-3
                        text-[13px] font-semibold text-zinc-100 transition-colors hover:border-zinc-700">
            <Download className="size-4" /> Unduh .{produk.unduhan}
          </a>
        )}
      </div>
      {kabar && (
        <div className={cn('mt-3 text-[12.5px]', gagal ? 'text-amber-300/90' : 'text-emerald-500')}>{kabar}</div>
      )}

      {surat && (
        <div className="mt-4 rounded-lg border border-zinc-800/70 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[12.5px] font-medium text-zinc-200">Surat Lisensi</span>
            <span className="text-[11.5px] text-zinc-600">bukti kepemilikan atas nama akunmu</span>
            <span className="ml-auto flex gap-2">
              <button onClick={() => setBukaSurat((v) => !v)}
                className="cursor-pointer rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700">
                {bukaSurat ? 'Sembunyikan' : 'Lihat surat'}
              </button>
              <button onClick={() => unduhTeks(`Surat-Lisensi-${kode.trim().toUpperCase()}.txt`, surat)}
                className="cursor-pointer rounded-md bg-zinc-100 px-2.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
                Unduh .txt
              </button>
            </span>
          </div>
          {bukaSurat && (
            <pre className="angka mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-md border border-zinc-800/60 bg-zinc-950/60 p-3 text-[11px] leading-relaxed text-zinc-400">
{surat}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Minta kode aktivasi ──────────────────────────────────────────────────
   Sebelum ini kotaknya cuma menunjuk ke toko lalu berhenti: pembeli yang
   sudah membayar tidak punya cara memberi tahu penjualnya selain WhatsApp,
   dan yang lewat WhatsApp gampang terlewat.

   Permintaan yang dikirim di sini muncul di panel Maintenance milik pemilik,
   lengkap dengan lencana merah di menunya. Menyetujui di sana menerbitkan
   kodenya sekaligus mengaktifkannya. */
function MintaKode({ produk, lynk }: { produk: string; lynk?: string }) {
  const { pengguna } = useAuth();
  const { data: punyaku, muatUlang } = usePermintaanSaya();
  const [catatan, setCatatan] = useState('');
  const [bukti, setBukti] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');

  const milikProduk = punyaku.find((x) => x.produk === produk);

  async function kirimMinta() {
    setSibuk(true); setKabar('');
    try {
      const j = await mintaLisensi({ produk, catatan: catatan.trim(), bukti: bukti.trim() });
      setKabar(j.sudahAda
        ? 'Permintaanmu sudah tercatat sebelumnya dan masih menunggu persetujuan.'
        : 'Permintaan terkirim. Kodenya muncul di sini begitu penjual menyetujui.');
      setCatatan(''); setBukti('');
      muatUlang();
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal mengirim');
    } finally { setSibuk(false); }
  }

  return (
    <Panel className="mt-5 border-amber-500/25 bg-amber-500/[0.04] p-5">
      <div className="mb-2 flex items-center gap-2">
        <Crown className="size-4 text-amber-400" />
        <span className="font-semibold text-zinc-100">Belum punya kode?</span>
      </div>

      {milikProduk?.status === 'disetujui' && milikProduk.kode ? (
        <>
          <p className="mb-3 text-[12.5px] leading-relaxed text-zinc-400">
            Permintaanmu sudah disetujui. Ini kodenya — salin ke kotak di atas.
          </p>
          <button onClick={() => void navigator.clipboard.writeText(milikProduk.kode!)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2">
            <Copy className="size-3.5 text-amber-300" />
            <span className="angka text-[13px] tracking-wide text-amber-200">{milikProduk.kode}</span>
          </button>
        </>
      ) : milikProduk?.status === 'baru' ? (
        <p className="text-[12.5px] leading-relaxed text-zinc-400">
          Permintaanmu sedang menunggu persetujuan penjual. Kodenya akan muncul di sini —
          tidak perlu mengirim ulang.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[12.5px] leading-relaxed text-zinc-400">
            Beli lisensinya di toko, lalu kirim permintaan aktivasi di bawah. Penjual akan
            menerbitkan kode <span className="angka">JT3-XXXX-XXXX-XXXX</span> untukmu.
          </p>
          {lynk && (
            <a href={lynk} target="_blank" rel="noreferrer"
               className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-5 py-2.5 text-[12.5px]
                          font-semibold text-amber-300 transition-colors hover:bg-amber-500/25">
              Beli di toko <ExternalLink className="size-3.5" />
            </a>
          )}
          {milikProduk?.status === 'ditolak' && (
            <div className="mb-3 text-[12px] text-amber-300/90">
              Permintaan sebelumnya ditolak. Kamu bisa mengirim lagi dengan keterangan yang lebih lengkap.
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={bukti} onChange={(e) => setBukti(e.target.value)}
              placeholder="Bukti bayar (nomor order / tautan)" disabled={!pengguna}
              className="h-10 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[13px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus-visible:border-zinc-600 disabled:opacity-50" />
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan (opsional)" disabled={!pengguna}
              className="h-10 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[13px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus-visible:border-zinc-600 disabled:opacity-50" />
          </div>
          <button onClick={() => void kirimMinta()} disabled={sibuk || !pengguna}
            title={pengguna ? undefined : 'Masuk dulu — emailmu diambil dari akun yang login'}
            className="mt-3 flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-4 py-2 text-[12.5px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
            {sibuk && <Loader2 className="size-3.5 animate-spin" />} Minta kode aktivasi
          </button>
          {!pengguna && (
            <div className="mt-2 text-[11.5px] text-zinc-500">Masuk dulu supaya penjual tahu permintaan ini dari siapa.</div>
          )}
        </>
      )}
      {kabar && <div className="mt-3 text-[12.5px] text-zinc-400">{kabar}</div>}
    </Panel>
  );
}

/* ── Kaki kartu ulasan: suka + balasan ───────────────────────────────────
   Komponen SENDIRI, bukan JSX di dalam .map(). Kotak balasannya punya
   keadaan terbuka/tertutup dan isi ketikan masing-masing; ditulis inline,
   satu useState harus melayani semua kartu — dan mengetik balasan di satu
   ulasan akan memunculkan huruf yang sama di ulasan lainnya.

   Menyukai TIDAK menunggu server. Firestore sudah menerapkan perubahannya
   ke cache lokal sebelum jaringan menjawab, jadi angkanya berubah seketika
   lewat onSnapshot; menambah keadaan optimis sendiri di sini cuma membuat
   dua sumber kebenaran yang bisa berselisih. */
function KakiUlasan({ ulasanId, suka, akuSuka, hitungUlangSuka, bolehTulis, uidAku, pemilik }: {
  ulasanId: string; suka: number; akuSuka: boolean; hitungUlangSuka: () => void;
  bolehTulis: boolean; uidAku: string; pemilik: boolean;
}) {
  const [buka, setBuka] = useState(false);
  /* Balasan baru diambil dari server SESUDAH `buka` jadi true. Pengunjung
     yang cuma membaca ulasan tidak membayar satu baca pun untuk percakapan
     yang tidak ia buka — dan halaman ini tujuan iklan, jadi sebagian besar
     pengunjung memang cuma membaca. */
  const { data: balasan } = useBalasanUlasan(ulasanId, buka);
  const [teks, setTeks] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  async function kirim() {
    setSibuk(true); setGalat('');
    try {
      await kirimBalasan(ulasanId, teks);
      setTeks(''); setBuka(false);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal mengirim balasan.');
    } finally { setSibuk(false); }
  }

  return (
    <>
      <div className="mt-3 flex items-center gap-1 border-t border-zinc-800/50 pt-2.5">
        <button
          onClick={() => {
            void tukarSuka(ulasanId, akuSuka)
              .then(() => hitungUlangSuka())
              .catch((e) => setGalat(e.message));
          }}
          disabled={!bolehTulis}
          title={bolehTulis ? (akuSuka ? 'Batal menyukai' : 'Suka ulasan ini') : 'Masuk dulu untuk menyukai'}
          aria-pressed={akuSuka}
          className={cn('flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            akuSuka ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300')}>
          <ThumbsUp className={cn('size-3.5', akuSuka && 'fill-emerald-400/25')} />
          {suka > 0 && <span className="angka">{suka}</span>}
        </button>
        <button
          onClick={() => setBuka((v) => !v)}
          disabled={!bolehTulis}
          title={bolehTulis ? 'Balas ulasan ini' : 'Masuk dulu untuk membalas'}
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50">
          <CornerDownRight className="size-3.5" /> Balas
          {/* Angkanya baru muncul SESUDAH dibuka. Menampilkannya sejak awal
              menuntut penghitungan untuk tiap ulasan pada tiap kunjungan —
              persis biaya yang sedang dihindari. */}
          {buka && balasan.length > 0 && <span className="angka text-zinc-600">{balasan.length}</span>}
        </button>
      </div>

      {/* Balasan MASUK KE DALAM garis kiri, bukan kartu tersendiri. Kotak di
          dalam kotak membuat percakapan terlihat seperti daftar baru;
          garis tepi kiri cukup untuk mengatakan "ini menjawab yang di
          atas". */}
      {balasan.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-zinc-800 pl-3">
          {balasan.map((b) => (
            <div key={b.id} className="flex items-start gap-2">
              {b.foto ? (
                <img src={b.foto} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer"
                     className="mt-0.5 size-5 shrink-0 rounded-full bg-zinc-800 object-cover"
                     onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-semibold text-zinc-300">
                  {b.nama.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] text-zinc-300">{b.nama}</span>
                  <span className="text-[10.5px] text-zinc-600">{tanggalPendek(b.waktu)}</span>
                  {/* Kegagalannya DIKATAKAN, tidak ditelan. Firestore menolak
                      lewat Promise, jadi `void` tanpa catch menghasilkan tombol
                      yang ditekan lalu tidak terjadi apa-apa — dan yang
                      menekannya menyimpulkan aplikasi rusak, bukan bahwa ia
                      memang tidak berhak.

                      Komentar ini DI ATAS kondisionalnya, bukan sesudah
                      `&& (`: di sana parser sedang menunggu sebuah ekspresi,
                      dan kurung kurawal komentar-JSX dibaca sebagai objek. */}
                  {(pemilik || uidAku === b.uid) && (
                    <button onClick={() => {
                              if (!confirm('Hapus balasan ini?')) return;
                              void hapusBalasan(b.id).catch((e) =>
                                setGalat(e?.code === 'permission-denied'
                                  ? 'Balasan ini bukan milikmu, jadi tidak bisa dihapus.'
                                  : (e instanceof Error ? e.message : 'Gagal menghapus balasan.')));
                            }}
                            aria-label="Hapus balasan"
                            className="ml-auto cursor-pointer rounded p-0.5 text-zinc-700 transition-colors hover:text-red-400">
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-line text-[12px] leading-relaxed text-zinc-400">{b.isi}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {buka && (
        <div className="mt-2 flex items-start gap-2 border-l border-zinc-800 pl-3">
          <textarea rows={2} value={teks} onChange={(e) => setTeks(e.target.value)} maxLength={400}
            placeholder="Tulis balasanmu…"
            className="min-w-0 flex-1 resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-2 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600" />
          <button onClick={() => void kirim()} disabled={sibuk || !teks.trim()}
            aria-label="Kirim balasan"
            className="mt-0.5 flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-2 text-[11.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
            {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </button>
        </div>
      )}

      {galat && <p className="mt-1.5 text-[11px] text-amber-400/90">{galat}</p>}
    </>
  );
}

/* ── Saringan etalase ────────────────────────────────────────────────────
   Jenisnya dibaca dari medan `versi`, bukan dari medan tersendiri: katalog
   nyata sudah menuliskannya di sana ("Pine v6 · overlay", "MQL5 · v2.03"),
   dan menambah medan baru berarti tiap produk lama harus disunting satu per
   satu sebelum saringannya berguna.

   `premium` memang medan sendiri — ia yang menyalakan mahkota di kartu, jadi
   memakai harga sebagai gantinya akan membuat lencana dan saringan bisa
   berselisih pendapat tentang produk yang sama. */
const SARING = [
  { id: 'semua',     label: 'All Product', cocok: () => true },
  { id: 'premium',   label: 'Premium',     cocok: (p: Produk) => !!p.premium },
  { id: 'indikator', label: 'Indikator',   cocok: (p: Produk) => /pine/i.test(p.versi) },
  { id: 'ea',        label: 'EA MT5',      cocok: (p: Produk) => /mql|mt5|expert advisor/i.test(p.versi) },
  { id: 'gratis',    label: 'Free',        cocok: (p: Produk) => !p.harga },
] as const;
type IdSaring = typeof SARING[number]['id'];

export default function Marketplace() {
  /* Kurs untuk keterangan rupiah di bawah harga dolar. Diambil sekali di
     sini, bukan di dalam tiap kartu — angkanya sama untuk semua produk. */
  const { kursUsd } = useHargaPaket();
  const [aktif, setAktif] = useState<Produk | null>(null);
  /* DINAIKKAN KE SINI DARI DALAM JSX MODALNYA.
     ────────────────────────────────────────────────────────────────────
     Sebelumnya useTutupLuar dipanggil di dalam `{aktif && ( … )}`, dan itu
     memanggil hook secara BERSYARAT — pelanggaran aturan hook React yang
     akibatnya persis seperti yang dilaporkan: tombol Detail ditekan,
     detailnya tidak pernah muncul.

     Jalannya begini. Saat halaman pertama digambar `aktif` masih null,
     jadi cabangnya tidak dijalankan dan useTutupLuar — yang di dalamnya
     ada useRef — tidak ikut terhitung. Begitu Detail ditekan, `aktif`
     terisi, cabangnya hidup, dan render kedua memakai SATU hook lebih
     banyak daripada render pertama. React membandingkan jumlahnya dan
     melempar "Rendered more hooks than during the previous render", lalu
     komponennya berhenti di tengah render.

     Tidak ada hubungannya dengan mode pratinjau atau paket mana pun:
     tidak ada satu pun gerbang paket di halaman ini, dan tombolnya selalu
     digambar. Yang rusak sama untuk semua orang — pratinjau kebetulan
     keadaan saat ia ketahuan.

     Tiga pemakaian useTutupLuar lainnya (ModalBatal, ModalTrade,
     ModalImporPorto) TIDAK bermasalah walau kelihatan mirip: ketiganya
     ada di dalam komponennya sendiri yang dipasang dan dilepas utuh, jadi
     hook-nya selalu dipanggil setiap kali komponen itu hidup. Yang
     dilarang React bukan modal yang muncul-hilang, melainkan jumlah hook
     yang berubah di dalam SATU komponen yang sama. */
  const tutupModal = useTutupLuar(() => setAktif(null));
  const { data: PRODUK, mentah } = useProduk();
  const { pengguna, pemilik } = useAuth();

  /* ── Urutan kartu: milik pemilik, diatur dengan menyeret ──────────────
     Aturan penempatan otomatis (produk premium baru duduk di kanan premium
     terakhir) cuma menentukan posisi AWAL. Selebihnya etalase adalah
     keputusan dagang, dan yang paling tahu urutannya adalah pemiliknya.

     Yang disimpan array MENTAH, bukan bentuk yang sudah dipetakan: katalog
     nyata membawa field yang tidak dikenal antarmuka `Produk` (sampul,
     tautan toko), dan menulis ulang dari hasil pemetaan akan melucutinya
     dari SEMUA produk sekaligus. Seret dimatikan kalau bentuk mentahnya
     tidak sepadan dengan yang tampil — misalnya saat katalog gagal dibaca
     dan layar sedang menampilkan contoh. */
  const [seret, setSeret] = useState<string | null>(null);
  const [sasaran, setSasaran] = useState<string | null>(null);
  const [kabarUrut, setKabarUrut] = useState('');
  const [saring, setSaring] = useState<IdSaring>('semua');
  const TAMPIL = PRODUK.filter(SARING.find((x) => x.id === saring)!.cocok);

  /* Seret DIMATIKAN saat saringan aktif. `jatuhkan` memang mencari indeks
     berdasarkan id di array mentah, jadi datanya tidak akan rusak — tapi
     memindahkan kartu ke posisi kartu lain dalam daftar tersaring
     menghasilkan urutan yang tidak bisa dilihat maupun diperkirakan
     penyeretnya, karena produk di antara keduanya sedang disembunyikan. */
  const bisaUrut = !!pemilik && saring === 'semua'
    && mentah.length === PRODUK.length && mentah.length > 1;

  async function jatuhkan(idTujuan: string) {
    const dariId = seret;
    setSeret(null); setSasaran(null);
    if (!bisaUrut || !dariId || dariId === idTujuan) return;
    const urut = [...mentah];
    const dari = urut.findIndex((p) => String(p?.id) === dariId);
    const ke = urut.findIndex((p) => String(p?.id) === idTujuan);
    if (dari < 0 || ke < 0) return;
    const [pindah] = urut.splice(dari, 1);
    urut.splice(ke, 0, pindah);
    setKabarUrut('Menyimpan urutan…');
    try {
      await simpanKatalogProduk(urut);
      setKabarUrut('Urutan tersimpan.');
      setTimeout(() => setKabarUrut(''), 2500);
    } catch (e) {
      setKabarUrut(e instanceof Error ? e.message : 'Gagal menyimpan urutan');
    }
  }
  const ulasan = useUlasan();
  /* Id-nya diambil dari ulasan yang BENAR-BENAR tampil, bukan dari koleksi:
     jumlah suka dihitung satu kueri per ulasan, jadi daftarnya harus sependek
     yang terlihat di layar. */
  const suka = useSuka(useMemo(() => ulasan.data.map((u) => u.id), [ulasan.data]));

  const [bintang, setBintang] = useState(5);
  const [tulisan, setTulisan] = useState('');
  const [kirimSibuk, setKirimSibuk] = useState(false);
  const [kabarUlasan, setKabarUlasan] = useState('');

  const rerata = ulasan.data.length
    ? ulasan.data.reduce((s, u) => s + u.bintang, 0) / ulasan.data.length
    : 0;

  async function kirim() {
    setKirimSibuk(true); setKabarUlasan('');
    try {
      await kirimUlasan({ bintang, isi: tulisan, produk: aktif?.nama ?? 'Jadi Trader Tools' });
      setTulisan(''); setBintang(5);
      setKabarUlasan('Ulasanmu terkirim. Terima kasih.');
    } catch (e) {
      setKabarUlasan(e instanceof Error ? e.message : 'Gagal mengirim');
    } finally { setKirimSibuk(false); }
  }

  /* Jarak ke tepi DIRAPATKAN — p-4/p-6 jadi p-3/p-4. Halaman ini etalase:
     yang berharga di sini lebar kartu produk, bukan ruang kosong di antara
     kartu dan garis sidebar. Halaman lain sengaja tidak diikutkan;
     masing-masing punya alasan sendiri untuk lapang.

     Komentarnya di LUAR `return (`, bukan komentar-JSX di dalamnya: di
     sana belum ada elemen JSX yang menampungnya, dan kurung kurawalnya
     dibaca sebagai awal sebuah objek.

     Catatan untuk yang menyunting nanti: JANGAN menulis pasangan pembuka
     dan penutup komentar JSX di dalam komentar blok seperti ini. Penutup
     bintang-garisnya mengakhiri komentar ini lebih awal, dan sisa
     kalimatnya jatuh ke luar sebagai kode. Sudah terjadi. */
  return (
    <div className="p-3 sm:p-4">
      {/* Baris KPI dibuang. Halaman ini dilihat calon pembeli, dan tiga dari
          empat kartunya adalah angka dapur: berapa lisensi aktif, berapa
          pendapatan. Itu milik Traffic & Sales, bukan etalase — dan kartu
          "khusus pemilik" yang isinya cuma tanda hubung tidak memberi apa pun
          kepada pengunjung selain kebingungan. */}

      {/* TANPA garis tepi, permintaan pemilik. Kartu produk di dalamnya
          sudah punya bingkainya masing-masing, dan bingkai di sekeliling
          bingkai membuat etalase terbaca sebagai satu kotak besar berisi
          kotak-kotak kecil — bukan sebagai deretan barang.

          Latarnya ikut dibuang. Tanpa garis tepi, `bg-zinc-900/40` cuma
          menyisakan slab abu membulat yang tidak menjelaskan dirinya —
          batas yang terasa tapi tidak terlihat. Sekalian transparan, dan
          kartu produknya duduk langsung di atas halaman.

          `border-0` dan `bg-transparent` menimpa bawaan Panel karena `cn`
          memakai twMerge; menambah kelas tanpa itu cuma menghasilkan dua
          kelas yang bertengkar, dan yang menang tergantung urutan di berkas
          CSS hasil bangun. */}
      <Panel className="border-0 bg-transparent">
        <PanelHead
          judul={<span className="flex items-center gap-2"><Store className="size-4 text-zinc-500" />Products</span>}
          sub="Indikator TradingView dan Expert Advisor MetaTrader yang dipakai di terminal ini."
          /* PanelDiscord DICABUT dari sini. Judul panel "Products" adalah
             tempat orang mencari produk; kotak komunitas di sebelahnya
             menarik perhatian keluar dari barang yang sedang dijual. Tautan
             Discord tetap ada di kaki halaman ini — di situ ia jadi ajakan
             sesudah melihat-lihat, bukan gangguan sebelum melihat. */
          kanan={
            bisaUrut ? (
              <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 lg:flex">
                <GripHorizontal className="size-3.5" /> seret kartu untuk mengatur urutan
              </span>
            ) : undefined
          }
        />
        {/* Bilah saringan TEPAT DI BAWAH keterangan panel, bukan di sisi
            kanan judul. Ia mengubah isi yang ada di bawahnya, jadi tempatnya
            di antara judul dan isi itu — bukan berjejer dengan judul, di mana
            ia terbaca sebagai hiasan kepala.

            Jumlahnya ikut tertulis. Tab kosong yang baru ketahuan kosong
            SESUDAH diklik membuat orang mengira etalasenya rusak; angka nol
            di label mengatakannya sebelum tangan bergerak. */}
        <div className="flex gap-1 overflow-x-auto px-5 pb-3">
          {SARING.map((t) => {
            const jumlah = PRODUK.filter(t.cocok).length;
            const aktif = saring === t.id;
            return (
              <button key={t.id} onClick={() => setSaring(t.id)}
                aria-pressed={aktif}
                className={cn('flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors',
                  aktif
                    ? 'border-zinc-600 bg-zinc-800/70 text-zinc-100'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300')}>
                {t.label}
                <span className={cn('angka text-[10.5px]', aktif ? 'text-zinc-400' : 'text-zinc-600')}>{jumlah}</span>
              </button>
            );
          })}
        </div>

        {kabarUrut && <div className="px-5 pb-2 text-[11.5px] text-zinc-500">{kabarUrut}</div>}
        {/* Kolom MENGIKUTI jumlah produk (maks 4). Empat kolom dengan tiga
            produk menyisakan satu lubang kosong permanen di kanan — kartu
            yang melebar mengisi barisnya jauh lebih enak dilihat daripada
            rongga yang tidak pernah terisi. */}
        {/* Kolomnya mengikuti jumlah YANG TAMPIL, bukan seluruh katalog.
            Kalau ikut katalog, menyaring sampai tersisa satu produk
            menyisakan tiga lubang kosong di kanannya. */}
        {TAMPIL.length === 0 ? (
          <div className="mx-5 mb-5 rounded-lg border border-dashed border-zinc-800 py-10 text-center text-[12.5px] text-zinc-600">
            Belum ada produk di kategori ini.
          </div>
        ) : (
        <div className={cn('grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2',
          TAMPIL.length >= 4 ? 'xl:grid-cols-4' : TAMPIL.length === 3 ? 'xl:grid-cols-3' : '')}>
          {TAMPIL.map((p) => (
            <Panel key={p.id}
                   draggable={bisaUrut}
                   onDragStart={() => setSeret(p.id)}
                   onDragOver={bisaUrut ? (e) => { e.preventDefault(); setSasaran(p.id); } : undefined}
                   onDrop={bisaUrut ? (e) => { e.preventDefault(); void jatuhkan(p.id); } : undefined}
                   onDragEnd={() => { setSeret(null); setSasaran(null); }}
                   className={cn('flex flex-col overflow-hidden', p.premium && 'border-amber-500/30',
                     bisaUrut && 'cursor-grab',
                     seret === p.id && 'opacity-40',
                     sasaran === p.id && seret && seret !== p.id && 'ring-2 ring-zinc-100')}>
              {/* Sampul = gambar pertama katalog, diatur di Maintenance.
                  Tinggi tetap dan `object-cover`: gambar dengan rasio
                  bermacam-macam tidak boleh membuat kartu-kartu di satu baris
                  jadi berbeda tinggi. */}
              {p.gambar?.[0] ? (
                <img src={p.gambar[0]} alt="" loading="lazy"
                     className="-mt-px h-[132px] w-full bg-zinc-900 object-cover"
                     onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                /* Produk tanpa sampul memakai kepala buatan setinggi sampul —
                   kartu di satu baris harus sebangun, dan kepala bertuliskan
                   nama jauh lebih baik daripada rongga kosong. */
                <div className="-mt-px flex h-[132px] w-full items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800">
                  <span className="px-6 text-center text-[15px] font-semibold tracking-tight text-zinc-600">
                    {p.nama}
                  </span>
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                {/* Dua baris, tidak lebih. Nama produk memang tidak pantas
                    dipotong, tapi nama sepanjang empat baris menggeser tinggi
                    seluruh barisnya — dan sampai sekarang tidak ada nama yang
                    melewati dua. */}
                <h3 className="line-clamp-2 min-h-[45px] text-[15px] font-semibold tracking-tight text-zinc-100">{p.nama}</h3>
                {p.premium && <Crown className="size-4 shrink-0 text-amber-400" />}
              </div>
              <div className="mt-1 text-[11.5px] text-zinc-600">{p.versi}</div>
              <RingkasKartu teks={p.ringkas} onBuka={() => setAktif(p)} />
              <div className="mt-4 flex items-end justify-between gap-3">
                {/* Harga lama dicoret DI SEBELAH harga berlaku, bukan
                    menggantikannya: yang harus terbaca lebih dulu adalah
                    angka yang benar-benar dibayar. */}
                {/* RUPIAH DI BAWAH DOLARNYA, bukan menggantikannya.
                    Harganya memang ditetapkan dalam dolar dan itu yang
                    ditagih; rupiah di sini keterangan, sama seperti di
                    halaman harga. Menukar posisinya berarti menjanjikan
                    angka rupiah yang tidak dijamin kursnya. */}
                {/* TINGGI BLOK HARGA DIPATOK. Produk berbayar punya baris
                    rupiah di bawah dolarnya; produk gratis tidak. Selisihnya
                    terukur 47px lawan 28px — dan di grid itu muncul sebagai
                    kartu gratis yang lebih pendek dari tetangganya, atau
                    seluruh baris ikut tinggi demi satu kartu berbayar.
                    Ruangnya disediakan untuk keduanya. */}
                <div className="min-h-[47px]">
                  <div className="angka flex items-baseline gap-2 text-xl font-semibold tracking-tight">
                    {p.harga === 0
                      ? <span className="text-emerald-500">Free</span>
                      : <span className="text-zinc-100">${p.harga}</span>}
                    {p.hargaAsal && (
                      <span className="text-[13px] font-normal text-zinc-600 line-through">${p.hargaAsal}</span>
                    )}
                  </div>
                  {p.harga > 0 && (
                    <div className="angka mt-0.5 text-[11px] text-zinc-600">{rupiah(p.harga, kursUsd)}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Ikon pasang di KIRI Detail — permintaan pemilik. Ikon,
                      bukan tombol berlabel: Detail adalah jalan utama tiap
                      kartu, dan dua tombol berteks sama besar membuat mata
                      memilih dulu sebelum membaca. */}
                  <TombolPasangChart produk={p} />
                  <button
                    onClick={() => setAktif(p)}
                    className="cursor-pointer rounded-md border border-zinc-800 px-3 py-1.5 text-[12px]
                               text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                  >
                    Detail
                  </button>
                </div>
              </div>
              </div>
            </Panel>
          ))}
        </div>
        )}
      </Panel>

      {/* ── Testimoni + rating ── */}
      {/* GARIS PEMISAH SEKSI. Begitu kedua panel kehilangan bingkainya,
          tidak ada lagi yang memberi tahu di mana etalase berakhir dan
          ulasan dimulai — keduanya jadi satu gulungan panjang tanpa sendi.
          Satu garis mengembalikan batas itu tanpa mengembalikan kotaknya. */}
      <div className="mt-6 border-t border-zinc-800/80" />

      {/* Tanpa garis tepi dan tanpa latar, seragam dengan panel Products di
          atasnya. Isinya sudah berbingkai sendiri — kartu ulasan, kotak
          tulis-ulasan, dan ajakan Discord — jadi bingkai pembungkusnya cuma
          lapisan keempat yang tidak menambah keterangan apa pun. */}
      <Panel className="mt-2 border-0 bg-transparent">
        <PanelHead
          judul={<span className="flex items-center gap-2"><MessagesSquare className="size-4 text-zinc-500" />Ulasan Pengguna</span>}
          sub="Ditulis langsung oleh pemakai, bukan kutipan pilihan."
          kanan={
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={cn('size-3.5', i <= Math.round(rerata) ? 'fill-amber-400 text-amber-400' : 'text-zinc-700')} />
                ))}
              </span>
              <span className="angka text-[12.5px] text-zinc-300">{ulasan.data.length ? rerata.toFixed(1) : '—'}</span>
              <span className="text-[11.5px] text-zinc-600">{ulasan.data.length} ulasan</span>
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 lg:grid-cols-3">
          {/* Jarak antar ulasan dinaikkan dari 12 px ke 20 px, dan tiap
              ulasan dapat garis pemisah tipis di bawahnya kecuali yang
              terakhir. Begitu bingkainya dicabut, dua ulasan berurutan
              kehilangan satu-satunya penanda di mana yang satu berakhir —
              dan yang tersisa cuma jarak, yang tidak cukup begitu ulasannya
              panjang. Garis rambut mengembalikan batas itu tanpa
              mengembalikan kotaknya. */}
          <div className="space-y-5 lg:col-span-2">
            {ulasan.memuat && <div className="py-6 text-center text-[12.5px] text-zinc-600">Memuat ulasan…</div>}
            {!ulasan.memuat && ulasan.data.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-800 py-8 text-center text-[12.5px] text-zinc-600">
                Belum ada ulasan. Jadilah yang pertama.
              </div>
            )}
            {ulasan.data.map((u) => (
              <div key={u.id} className="border-b border-zinc-800/50 pb-5 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Foto profil Google kalau ada, huruf awal kalau tidak.
                      `referrerPolicy` wajib: tanpa itu Google menolak melayani
                      gambarnya dari domain lain dan yang muncul ikon rusak. */}
                  {u.foto ? (
                    <img src={u.foto} alt="" width={28} height={28} loading="lazy"
                         referrerPolicy="no-referrer"
                         className="size-7 shrink-0 rounded-full bg-zinc-800 object-cover"
                         onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300">
                      {u.nama.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-tight text-zinc-200">{u.nama}</span>
                    {/* Alamatnya sudah tersamar SEJAK DITULIS, bukan disamarkan
                        di sini — dokumen ulasan dibaca publik. */}
                    {u.email && <span className="angka block text-[10.5px] leading-tight text-zinc-600">{u.email}</span>}
                  </span>
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={cn('size-3', i <= u.bintang ? 'fill-amber-400 text-amber-400' : 'text-zinc-700')} />
                    ))}
                  </span>
                  <span className="ml-auto text-[11.5px] text-zinc-600">{tanggalPendek(u.waktu)}</span>
                  {/* Menghapus hanya muncul untuk yang berhak. Aturan Firestore
                      yang menegakkannya; tombol ini cuma tidak menawarkan
                      sesuatu yang pasti ditolak. */}
                  {(pemilik || pengguna?.uid === u.uid) && (
                    <button onClick={() => { if (confirm('Hapus ulasan ini?')) void hapusUlasan(u.id); }}
                            aria-label="Hapus ulasan"
                            className="cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-zinc-400">{u.isi}</p>
                {u.produk && <div className="mt-2 text-[11px] text-zinc-600">tentang {u.produk}</div>}

                <KakiUlasan
                  ulasanId={u.id}
                  suka={suka.jumlah[u.id] ?? 0}
                  akuSuka={suka.punyaku.has(u.id)}
                  hitungUlangSuka={suka.hitungUlang}
                  bolehTulis={!!pengguna}
                  uidAku={pengguna?.uid ?? ''}
                  pemilik={pemilik}
                />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-800/60 p-4">
              <div className="mb-2 text-[12.5px] font-medium text-zinc-200">Tulis ulasanmu</div>
              <div className="mb-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} aria-label={`Beri ${i} bintang`} onClick={() => setBintang(i)}
                    className="cursor-pointer transition-colors">
                    <Star className={cn('size-5', i <= bintang ? 'fill-amber-400 text-amber-400' : 'text-zinc-700 hover:text-amber-400/60')} />
                  </button>
                ))}
                <span className="angka ml-1 text-[12px] text-zinc-500">{bintang}/5</span>
              </div>
              <textarea rows={4} value={tulisan} onChange={(e) => setTulisan(e.target.value)}
                maxLength={600} disabled={!pengguna}
                placeholder={pengguna ? 'Apa yang kamu suka, dan apa yang masih kurang?' : 'Masuk dulu untuk menulis ulasan.'}
                className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-60" />
              <button onClick={() => void kirim()} disabled={!pengguna || kirimSibuk || !tulisan.trim()}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-100 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                {kirimSibuk && <Loader2 className="size-3.5 animate-spin" />} Kirim ulasan
              </button>
              {kabarUlasan && <div className="mt-2 text-[11.5px] text-zinc-400">{kabarUlasan}</div>}
            </div>

            <a href="https://discord.gg/zcEMgxwY4" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-indigo-500/25 bg-indigo-500/[0.06] p-4 transition-colors hover:border-indigo-500/40">
              <MessageCircle className="size-5 shrink-0 text-indigo-400" strokeWidth={1.8} />
              <div className="min-w-0">
                <div className="text-[13px] text-zinc-100">Diskusi di Discord</div>
                <div className="text-[11.5px] text-zinc-500">Tanya setup, lapor bug, bagi hasil backtest.</div>
              </div>
            </a>
          </div>
        </div>
      </Panel>

      {aktif && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
          {...tutupModal}
        >
          <Panel className="my-4 w-full max-w-3xl bg-zinc-950" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 p-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">{aktif.nama}</h2>
                <div className="mt-1 text-[12px] text-zinc-500">{aktif.versi}</div>
              </div>
              <button onClick={() => setAktif(null)} aria-label="Tutup"
                className="cursor-pointer text-zinc-500 transition-colors hover:text-zinc-100">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-5">
                <div className="angka flex items-baseline gap-2.5 text-2xl font-semibold">
                  {aktif.harga === 0 ? <span className="text-emerald-500">Free</span> : <span className="text-zinc-100">${aktif.harga}</span>}
                  {aktif.hargaAsal && (
                    <>
                      <span className="text-[15px] font-normal text-zinc-600 line-through">${aktif.hargaAsal}</span>
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-emerald-400">
                        harga perkenalan
                      </span>
                    </>
                  )}
                </div>
                {aktif.harga > 0 && (
                  <div className="angka mt-1 text-[12px] text-zinc-600">{rupiah(aktif.harga, kursUsd)}</div>
                )}
              </div>
              <p className="mb-6 text-[13.5px] leading-[1.75] text-zinc-400">{aktif.ringkas}</p>

              {/* Tangkapan layar dari katalog Firestore. Dimuat malas dan
                  diberi tinggi tetap: tanpa itu, gambar yang datang belakangan
                  mendorong isi halaman ke bawah tepat saat orang sedang
                  membaca. Gagal muat disembunyikan, bukan dibiarkan jadi ikon
                  rusak — gambar produk yang patah lebih buruk daripada tidak
                  ada gambar. */}
              {aktif.gambar && aktif.gambar.length > 0 && (
                <div className="mb-6 -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                  {aktif.gambar.map((src, i) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer"
                       className="shrink-0 overflow-hidden rounded-lg border border-zinc-800 transition-colors hover:border-zinc-600">
                      <img src={src} alt={`Tangkapan layar ${i + 1} — ${aktif.nama}`}
                           loading="lazy" width={260} height={146}
                           className="block h-[146px] w-[260px] bg-zinc-900 object-cover"
                           onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                    </a>
                  ))}
                </div>
              )}

              {aktif.detail && (
                <div className="mb-6">
                  <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Penjelasan</div>
                  {/* whitespace-pre-line, dan tanpanya bagian ini RUSAK.
                      `detail` teks polos berparagraf — judul bagian, butir
                      bertanda titik, langkah bernomor. Di <p> biasa semua
                      baris barunya diruntuhkan jadi spasi, dan hasilnya satu
                      dinding teks di mana "YANG HARUS KAMU TAHU" menempel di
                      ekor kalimat sebelumnya. Halaman jualan yang tidak bisa
                      dipindai mata sama saja dengan halaman yang tidak
                      dibaca.

                      `pre-line`, bukan `pre-wrap`: baris baru dipertahankan
                      tapi spasi berlebih tetap diruntuhkan, jadi teks yang
                      ditempel dari mana pun tidak membawa lekukan aneh. */}
                  <p className="whitespace-pre-line text-[13px] leading-[1.8] text-zinc-400">{aktif.detail}</p>
                </div>
              )}

              {/* Animasi peraga cara kerja. Inilah yang hilang di versi
                  sebelumnya: tanpa ini halaman detail cuma daftar kalimat,
                  dan pengunjung tidak punya cara membayangkan hasilnya. */}
              <div className="mb-6">
                <div className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Cara kerjanya</div>
                <PeragaProduk id={aktif.id} />
              </div>

              <div className="mb-6">
                <div className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Features</div>
                <ul className="space-y-3">
                  {aktif.fitur.map((f) => {
                    /* Katalog nyata memakai `nama|penjelasan`; data contoh
                       hanya nama. Dipisah supaya nama fiturnya menonjol —
                       satu paragraf panjang di samping centang tidak terbaca
                       sebagai daftar fitur, melainkan sebagai dinding teks. */
                    const [nama, ...sisa] = f.split('|');
                    const jelas = sisa.join('|').trim();
                    return (
                      <li key={f} className="flex items-start gap-2.5 text-[13px]">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" strokeWidth={2.2} />
                        <span className="min-w-0">
                          <span className="text-zinc-200">{nama.trim()}</span>
                          {jelas && <span className="mt-0.5 block text-[12.5px] leading-relaxed text-zinc-500">{jelas}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* ── SATU JALAN MASUK UNTUK INDIKATOR ─────────────────────
                  Indikator Pine yang bisa dipasang TIDAK lagi menawarkan
                  "Salin Kode" maupun unduhan. Permintaan pemilik, dan ia
                  benar pada dua hal sekaligus:

                  Pertama, indikator ini hidup DI DALAM aplikasi. Menyodorkan
                  kode mentahnya lebih dulu berarti menyuruh orang menempel
                  sendiri sesuatu yang sudah bisa dipasang satu klik — dan
                  yang menempel manual akan punya salinan yang tidak pernah
                  ikut diperbarui.

                  Kedua, kode yang tidak bisa dibawa keluar tidak bisa
                  disebarkan. Untuk indikator yang logikanya milik orang
                  lain, itu bukan sekadar kerapian.

                  Produk lain — EA MetaTrader — tetap lewat jalur lama: ia
                  memang HARUS diunduh, karena ia jalan di terminal sendiri,
                  bukan di sini. */}
              {bisaDipasang(aktif)
                ? (
                  <div>
                    <TombolPasangChart produk={aktif} besar />
                    <p className="mt-2.5 max-w-[560px] text-[12.5px] leading-relaxed text-zinc-500">
                      Indikator ini dipakai di dalam aplikasi. Sekali ditekan, ia langsung
                      tergambar di Chart &amp; Entry dan ikut terbarui sendiri saat versinya
                      naik — tidak ada kode yang perlu kamu tempel sendiri.
                    </p>
                  </div>
                )
                : <AmbilSumber produk={aktif} />}

              {/* Peringatan HANYA untuk produk berbayar, dan ditaruh TEPAT
                  sebelum jalur pembeliannya. Yang gratis tidak menimbulkan
                  sengketa uang, dan menempelkan peringatan di semua tempat
                  membuatnya jadi latar yang tidak lagi dibaca siapa pun.

                  Kalimat refund ikut di sini, bukan cuma di halaman Legal:
                  "produk digital tidak bisa dikembalikan" yang baru diketahui
                  SESUDAH membayar adalah keluhan, bukan ketentuan. */}
              {aktif.harga > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                  <p className="text-[11.5px] leading-relaxed text-zinc-500">
                    Yang kamu beli adalah <span className="text-zinc-400">lisensi perangkat
                    lunak alat bantu analisa</span> — bukan nasihat investasi dan bukan janji
                    keuntungan. Trading berisiko kehilangan seluruh modal. Lisensi berlaku untuk
                    satu akun, dan <span className="text-zinc-400">tidak dapat dikembalikan setelah
                    diaktifkan</span>.{' '}
                    <Link to="/legal" className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300">
                      Ketentuan lengkap
                    </Link>
                  </p>
                </div>
              )}

              {aktif.harga > 0 && <MintaKode produk={aktif.id} lynk={aktif.lynk} />}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
