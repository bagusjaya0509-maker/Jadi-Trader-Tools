import { useState } from 'react';
import {
  Check, Crown, Download, Copy, X, Star, MessageCircle, ExternalLink, KeyRound, Loader2, Trash2,
  GripHorizontal,
} from 'lucide-react';
import { PeragaProduk } from '@/components/peraga-produk';
import { PanelDiscord } from '@/components/panel-discord';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, tanggalPendek } from '@/lib/utils';
import { type Produk } from '@/data/contoh';
import { useProduk, simpanKatalogProduk } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { suratLisensi, sisipkanPenanda, unduhTeks } from '@/lib/surat-lisensi';
import { useUlasan, kirimUlasan, hapusUlasan } from '@/lib/ulasan';
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
  const { pengguna } = useAuth();
  const gratis = produk.harga === 0;

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
        <button onClick={() => void ambil()} disabled={sibuk || (!gratis && (kode.trim().length < 8 || !setuju))}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-zinc-100 px-6 py-3 text-[13px] font-semibold
                     text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
          {sibuk ? <Loader2 className="size-4 animate-spin" /> : gratis ? <Copy className="size-4" /> : <KeyRound className="size-4" />}
          {gratis ? 'Salin Kode' : 'Buka & Salin Kode'}
        </button>
        {/* Berkas biner (.ex5/.mq5) tidak bisa disalin sebagai teks, jadi
            jalurnya unduhan langsung. Muncul kalau katalog menyatakan
            produknya punya berkas — DAN, untuk produk berbayar, hanya
            setelah lisensinya terbukti aktif lewat tombol di sebelah. */}
        {produk.unduhan && (gratis || terbuka) && (
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

export default function Marketplace() {
  const [aktif, setAktif] = useState<Produk | null>(null);
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
  const bisaUrut = !!pemilik && mentah.length === PRODUK.length && mentah.length > 1;

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

  return (
    <div className="p-4 sm:p-6">
      {/* Baris KPI dibuang. Halaman ini dilihat calon pembeli, dan tiga dari
          empat kartunya adalah angka dapur: berapa lisensi aktif, berapa
          pendapatan. Itu milik Traffic & Sales, bukan etalase — dan kartu
          "khusus pemilik" yang isinya cuma tanda hubung tidak memberi apa pun
          kepada pengunjung selain kebingungan. */}

      <Panel>
        <PanelHead
          judul="Products"
          sub="Indikator TradingView dan Expert Advisor MetaTrader yang dipakai di terminal ini."
          kanan={
            <span className="flex items-center gap-3">
              {bisaUrut && (
                <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 lg:flex">
                  <GripHorizontal className="size-3.5" /> seret kartu untuk mengatur urutan
                </span>
              )}
              <PanelDiscord />
            </span>
          }
        />
        {kabarUrut && <div className="px-5 pb-2 text-[11.5px] text-zinc-500">{kabarUrut}</div>}
        {/* Kolom MENGIKUTI jumlah produk (maks 4). Empat kolom dengan tiga
            produk menyisakan satu lubang kosong permanen di kanan — kartu
            yang melebar mengisi barisnya jauh lebih enak dilihat daripada
            rongga yang tidak pernah terisi. */}
        <div className={cn('grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2',
          PRODUK.length >= 4 ? 'xl:grid-cols-4' : PRODUK.length === 3 ? 'xl:grid-cols-3' : '')}>
          {PRODUK.map((p) => (
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
                <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100">{p.nama}</h3>
                {p.premium && <Crown className="size-4 shrink-0 text-amber-400" />}
              </div>
              <div className="mt-1 text-[11.5px] text-zinc-600">{p.versi}</div>
              <p className="mt-3 flex-1 text-[12.5px] leading-relaxed text-zinc-400">{p.ringkas}</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                {/* Harga lama dicoret DI SEBELAH harga berlaku, bukan
                    menggantikannya: yang harus terbaca lebih dulu adalah
                    angka yang benar-benar dibayar. */}
                <div className="angka flex items-baseline gap-2 text-xl font-semibold tracking-tight">
                  {p.harga === 0
                    ? <span className="text-emerald-500">Free</span>
                    : <span className="text-zinc-100">${p.harga}</span>}
                  {p.hargaAsal && (
                    <span className="text-[13px] font-normal text-zinc-600 line-through">${p.hargaAsal}</span>
                  )}
                </div>
                <button
                  onClick={() => setAktif(p)}
                  className="cursor-pointer rounded-md border border-zinc-800 px-3 py-1.5 text-[12px]
                             text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                >
                  Detail
                </button>
              </div>
              </div>
            </Panel>
          ))}
        </div>
      </Panel>

      {/* ── Testimoni + rating ── */}
      <Panel className="mt-4">
        <PanelHead
          judul="Ulasan Pengguna"
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
          <div className="space-y-3 lg:col-span-2">
            {ulasan.memuat && <div className="py-6 text-center text-[12.5px] text-zinc-600">Memuat ulasan…</div>}
            {!ulasan.memuat && ulasan.data.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-800 py-8 text-center text-[12.5px] text-zinc-600">
                Belum ada ulasan. Jadilah yang pertama.
              </div>
            )}
            {ulasan.data.map((u) => (
              <div key={u.id} className="rounded-lg border border-zinc-800/60 p-4">
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
          onClick={() => setAktif(null)}
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
              <div className="angka mb-5 flex items-baseline gap-2.5 text-2xl font-semibold">
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
                  <p className="text-[13px] leading-[1.8] text-zinc-400">{aktif.detail}</p>
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

              {/* Pengambilan sumber — gratis maupun berlisensi. */}
              <AmbilSumber produk={aktif} />

              {aktif.harga > 0 && <MintaKode produk={aktif.id} lynk={aktif.lynk} />}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
