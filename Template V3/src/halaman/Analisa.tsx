import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Loader2, Lock, Unlock, Trash2, Send, LineChart, X, CheckCircle2,
  TrendingUp, TrendingDown, RefreshCw, Radar, Sparkles, ImagePlus, Images, Flag, Ban,
} from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { PanelSinyal } from '@/components/panel-sinyal';
import { PapanPeringkatSignal, PerformaAnalisSatu } from '@/components/performa-signal';
import { ambilDraf } from '@/lib/draf-sinyal';
import { cn, uang, persen, harga as fHarga, tanggalPendek } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useRiwayat, useSaldoAwal } from '@/lib/data';
import { statGabungan, kurvaEkuitas } from '@/lib/hitung';
import { useTutupLuar } from '@/lib/tutup-luar';
import {
  daftarAnalisa, kirimAnalisa, hapusAnalisa, bukaIsi, mintaAkses,
  statusSaya, putuskanAkses, tambahGambar, hapusGambar, kecilkanGambar, ambilPerforma,
  batalkanAnalisa, bisaDibatalkan,
  type RingkasAnalisa, type IsiAnalisa, type PermintaanMasuk, type GambarAnalisa, type Performa,
} from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   COPY TRADING — analisa berbayar antar pengguna
   ════════════════════════════════════════════════════════════════════════
   Analis memposting rencana trade (entry/SL/TP + alasan) dengan harga.
   Level dan alasannya TERKUNCI sampai pembeli disetujui; yang selalu
   terbuka adalah rekam jejak analisnya — winrate, profit factor, dan kurva
   ekuitas yang diambil OTOMATIS dari jurnalnya sendiri saat memposting,
   bukan diketik tangan. Orang menilai analis dari catatannya, bukan dari
   pengakuannya.

   PEMBAYARAN v1 — jujur soal batasnya: transfer manual ke analis, bukti
   dikirim, analis menyetujui, isi terbuka. Gerbang pembayaran otomatis
   menyusul lewat halaman Billing; alur persetujuannya sudah sama, tinggal
   mengganti "bukti transfer" dengan callback pembayaran.
   ════════════════════════════════════════════════════════════════════════ */

const KELAS_ISIAN =
  'h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 text-[12.5px] text-zinc-200 ' +
  'outline-none transition-colors hover:border-zinc-700 focus-visible:border-zinc-600';

/** Rapikan harga yang datang dari garis chart.
 *
 *  Menggeser garis menghasilkan angka sepanjang `62577.76218771864` —
 *  presisi yang tidak berarti apa-apa (tidak ada bursa menerima pecahan
 *  sekecil itu) dan membuat kolomnya tidak terbaca.
 *
 *  Tiga desimal untuk harga >= 1. Di bawah itu TIDAK dipotong tiga desimal:
 *  koin seharga 0,00001234 akan menjadi 0 — bukan dirapikan, melainkan
 *  dihapus. Untuk mereka yang dipakai angka penting, bukan angka desimal. */
function rapikanHarga(n: number): number {
  if (!Number.isFinite(n) || n === 0) return n;
  return Math.abs(n) >= 1 ? Number(n.toFixed(3)) : Number(n.toPrecision(6));
}


/* ── Panel performa sinyal satu analis ───────────────────────────────────
   Menggantikan modal portofolio jurnal. Alasannya bukan kerapian:
   PORTOFOLIO PRIBADI MENJAWAB PERTANYAAN YANG TIDAK SEDANG DITANYA.
   Orang bisa pandai membaca pasar untuk orang lain tapi berantakan
   mengurus akunnya sendiri — ukuran posisi terlalu besar, memindah SL,
   membalas dendam sesudah rugi. Jurnalnya akan berdarah sementara
   sinyal-sinyalnya bagus, dan pembaca menyimpulkan hal yang salah dari
   angka yang benar.

   Yang diikuti pembeli adalah SINYALNYA. Maka yang ditampilkan di sini
   rekam jejak sinyalnya: berapa yang kena TP, berapa kena SL, berapa yang
   ia tarik sebelum harganya datang, dan kenapa. */
function ModalPerformaAnalis({ a, performa, dibatalkan, berjalan, tutup }: {
  a: RingkasAnalisa;
  performa: Performa | null;
  dibatalkan: RingkasAnalisa[];
  berjalan: number;
  tutup: () => void;
}) {
  const analis = performa?.analis.find((x) => x.uid === a.uid) ?? null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" {...useTutupLuar(tutup)}>
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-5"
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-zinc-100">Performa signal {a.nama}</div>
            <div className="text-[11.5px] leading-relaxed text-zinc-500">
              Dihitung server dari lilin sungguhan sejak tiap sinyal diposting — tidak ada satu
              angka pun di sini yang bisa diisi tangan, termasuk oleh pemilik situs.
            </div>
          </div>
          <button onClick={tutup} className="shrink-0 cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
            <X className="size-4" />
          </button>
        </div>

        <PerformaAnalisSatu
          analis={analis}
          modal={performa?.modal ?? 1000}
          risikoPersen={performa?.risikoPersen ?? 1}
          berjalan={berjalan}
          dibatalkan={dibatalkan}
        />
      </div>
    </div>
  );
}

/** Penanda analisa yang ditulis agen AI, bukan orang.
 *  Wajib ada dan wajib jelas: pembaca berhak tahu apakah yang ia baca
 *  disusun manusia dengan rekam jejak jurnal, atau mesin yang membaca
 *  lilin. Keduanya boleh salah — tapi salahnya berbeda jenis, dan orang
 *  perlu tahu jenis mana yang sedang ia pertimbangkan. */
function LencanaAgen() {
  return (
    /* Ditempel di POJOK KANAN ATAS panel, bukan ikut mengalir di dalam isi.
       Sebagai baris tersendiri ia mendorong judul turun dan memakan satu
       baris penuh untuk dua kata — dan lencana yang memanjang terbaca
       sebagai isi kartu, padahal ia keterangan TENTANG kartunya. */
    <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300"
          title="Ditulis agen AI dari data lilin, bukan oleh analis manusia">
      <Sparkles className="size-3" /> AI Agent
    </span>
  );
}

/** Label hasil sinyal. Muncul HANYA kalau backend sudah bisa memastikannya
 *  dari lilin sejak analisa diposting — kalau simbolnya tidak bisa dinilai,
 *  tidak ada label sama sekali. Diam lebih jujur daripada menebak. */
function LencanaHasil({ hasil }: { hasil: 'sl' | 'tp' | 'batal' }) {
  /* DIBATALKAN PUNYA WARNANYA SENDIRI — abu, bukan merah.
     Memberinya warna kalah akan membuat analis yang disiplin menarik
     rencana yang sudah tidak sah terlihat sama dengan yang kena SL,
     padahal tidak ada posisi yang pernah jalan dan tidak ada uang yang
     hilang. Warna adalah penilaian; ini bukan kekalahan. */
  if (hasil === 'batal') {
    return (
      <span className="flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400"
        title="Ditarik penulisnya sebelum harga menyentuh entry — alasannya tercatat.">
        <Ban className="size-3" /> Dibatalkan
      </span>
    );
  }
  const kenaTp = hasil === 'tp';
  return (
    <span className={cn(
      'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
      kenaTp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
    )}
      title={kenaTp
        ? 'Harga sudah menyentuh TP sejak analisa ini diposting — rencananya selesai.'
        : 'Harga sudah menyentuh SL sejak analisa ini diposting — rencananya selesai.'}>
      <Flag className="size-3" /> Expired · {kenaTp ? 'TP' : 'SL'}
    </span>
  );
}

/* ── Batalkan sinyal: alasannya WAJIB, dan itu bukan formalitas ──────────
   Analis boleh menarik rencana yang harganya tidak pernah datang — level
   yang disusun kemarin bisa jadi tidak sah lagi hari ini. Yang tidak boleh
   adalah menariknya diam-diam: pembatalan tanpa alasan hanya memindahkan
   sinyal dari daftar ke tempat sampah, dan orang yang sudah menaruh order
   mengikutinya tidak pernah tahu kenapa.

   Server juga menolak alasan di bawah 10 huruf, jadi batas yang sama
   ditulis di sini — supaya orang tahu SEBELUM menekan, bukan sesudah. */
function ModalBatal({ a, tutup, selesai }: {
  a: RingkasAnalisa; tutup: () => void; selesai: () => void;
}) {
  const [alasan, setAlasan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const cukup = alasan.trim().length >= 10;

  async function kirim() {
    setSibuk(true); setGalat('');
    try {
      await batalkanAnalisa(a.id, alasan.trim());
      selesai();
      tutup();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membatalkan');
    } finally { setSibuk(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" {...useTutupLuar(tutup)}>
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2">
          <Ban className="size-4 text-zinc-400" />
          <span className="text-[14px] font-medium text-zinc-100">Batalkan sinyal</span>
          <span className="angka text-[12px] text-zinc-500">{a.arah} {a.pasangan}</span>
        </div>
        <p className="mb-3 text-[11.5px] leading-relaxed text-zinc-500">
          Harganya belum menyentuh entry, jadi rencana ini masih bisa ditarik. Pembatalannya{' '}
          <span className="text-zinc-300">tidak menghapus apa pun</span> — sinyalnya tetap ada di
          rekam jejakmu bersama alasan ini, dan terbaca siapa pun yang membuka performamu.
        </p>

        <label className="mb-1 block text-[11px] text-zinc-500">
          Kenapa dibatalkan? <span className="text-zinc-600">(minimal 10 huruf)</span>
        </label>
        <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={3} maxLength={300}
          placeholder="mis. Struktur H4 berubah — level supply-nya sudah tembus, setup ini tidak sah lagi."
          className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[12.5px] leading-relaxed text-zinc-200 outline-none transition-colors hover:border-zinc-700 focus-visible:border-zinc-600" />
        <div className="mt-1 flex justify-between text-[10.5px] text-zinc-600">
          <span>{cukup ? 'Cukup' : `Kurang ${10 - alasan.trim().length} huruf lagi`}</span>
          <span className="angka">{alasan.length}/300</span>
        </div>

        {galat && <p className="mt-2 text-[12px] text-amber-300/90">{galat}</p>}

        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => void kirim()} disabled={sibuk || !cukup}
            title={!cukup ? 'Tulis alasannya dulu — minimal 10 huruf' : undefined}
            className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
            {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
            Batalkan sinyal
          </button>
          <button onClick={tutup}
            className="cursor-pointer rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
            Urungkan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Galeri foto analisa ─────────────────────────────────────────────────
   Terbuka untuk SEMUA yang boleh membuka analisanya, bukan hanya penulisnya.
   Itu keputusan yang disengaja: analisa yang bisa ditimpali tangkapan layar
   orang lain — "punyaku ke-fill di sini", "di TF 1 jam bentuknya begini" —
   jadi bahan diskusi. Kalau cuma penulis yang boleh menempel gambar, yang
   didapat adalah pengumuman satu arah.

   Yang menjaga dari penyalahgunaan bukan larangan mengunggah, melainkan
   batas jumlah (server) dan tombol hapus untuk pengunggah DAN penulisnya. */
function Galeri({ analisaId, galeri, bisaTambah, uidku, penulisku, onBerubah }: {
  analisaId: string;
  galeri: GambarAnalisa[];
  bisaTambah: boolean;
  uidku?: string;
  penulisku: boolean;
  onBerubah: (g: GambarAnalisa[]) => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [besar, setBesar] = useState<GambarAnalisa | null>(null);
  const berkasRef = useRef<HTMLInputElement>(null);
  const { pengguna } = useAuth();

  async function pilihBerkas(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    /* Input dikosongkan SEGERA. Tanpa ini, memilih berkas yang sama dua kali
       berturut-turut tidak memicu onChange sama sekali — orangnya menekan,
       tidak terjadi apa-apa, dan tidak ada galat untuk dibaca. */
    e.target.value = '';
    if (!f) return;
    setSibuk(true); setKabar('');
    try {
      const kecil = await kecilkanGambar(f);
      const g = await tambahGambar(
        analisaId, kecil, '',
        pengguna?.displayName || pengguna?.email?.split('@')[0] || '',
      );
      onBerubah([...galeri, g]);
    } catch (err) {
      setKabar(err instanceof Error ? err.message : 'Gagal mengunggah');
    } finally { setSibuk(false); }
  }

  async function buang(g: GambarAnalisa) {
    if (!confirm('Hapus foto ini?')) return;
    try {
      await hapusGambar(analisaId, g.id);
      onBerubah(galeri.filter((x) => x.id !== g.id));
    } catch (err) {
      setKabar(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  }

  return (
    <div className="mt-3 w-full border-t border-zinc-800/60 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <Images className="size-3.5 text-zinc-500" />
        <span className="text-[11.5px] text-zinc-400">
          Foto analisa {galeri.length > 0 && <span className="angka text-zinc-500">· {galeri.length}</span>}
        </span>
        {bisaTambah && (
          <button onClick={() => berkasRef.current?.click()} disabled={sibuk}
            className="ml-auto flex cursor-pointer items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50">
            {sibuk ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />}
            Tambah foto
          </button>
        )}
        <input ref={berkasRef} type="file" accept="image/png,image/jpeg,image/webp"
               onChange={(e) => void pilihBerkas(e)} className="hidden" />
      </div>

      {galeri.length === 0 ? (
        <p className="text-[11.5px] leading-relaxed text-zinc-600">
          {bisaTambah
            ? 'Belum ada foto. Tangkapan layar chart-mu akan terlihat oleh semua yang membuka analisa ini.'
            : 'Belum ada foto.'}
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {galeri.map((g) => (
            <div key={g.id} className="group relative shrink-0">
              <img src={g.url} alt={g.ket || 'Foto analisa'} loading="lazy"
                   onClick={() => setBesar(g)}
                   className="h-20 w-28 cursor-zoom-in rounded-md border border-zinc-800 object-cover" />
              <span className="mt-0.5 block max-w-28 truncate text-[10px] text-zinc-600">{g.nama}</span>
              {(g.uid === uidku || penulisku) && (
                <button onClick={() => void buang(g)} aria-label="Hapus foto"
                  className="absolute right-1 top-1 hidden cursor-pointer rounded bg-zinc-950/80 p-0.5 text-zinc-400 hover:text-red-400 group-hover:block">
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {kabar && <p className="mt-1.5 text-[11.5px] text-amber-300/90">{kabar}</p>}

      {besar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
             onClick={() => setBesar(null)}>
          <img src={besar.url} alt={besar.ket || 'Foto analisa'}
               className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}

function KartuAnalisa({ a, status, milikku, pemilik, onSegarkan, performa, dibatalkanAnalis, berjalanAnalis }: {
  a: RingkasAnalisa;
  status: string | undefined;
  milikku: boolean;
  /** Performa seluruh papan — kartu ini cuma mengambil barisnya sendiri.
   *  Dioper dari halaman, bukan diambil ulang tiap kartu: satu daftar bisa
   *  memuat belasan kartu, dan belasan permintaan untuk data yang sama
   *  adalah cara paling cepat menghabiskan kuota rute publik. */
  performa: Performa | null;
  /** Sinyal analis ini yang dibatalkan, untuk panel performanya. */
  dibatalkanAnalis: RingkasAnalisa[];
  berjalanAnalis: number;
  /** Pemilik APLIKASI, bukan penulis analisa. Satu-satunya yang boleh
   *  menghapus — itu moderasi (kewajiban pengawasan PSE), bukan fitur.
   *  Penulis TIDAK bisa menghapus sinyalnya sendiri: rekam jejak yang bisa
   *  dihapus bukan rekam jejak. Server menolaknya juga; tombol yang
   *  disembunyikan di sini cuma sopan santun, penjaganya di backend. */
  pemilik?: boolean;
  onSegarkan: () => void;
}) {
  const { pengguna } = useAuth();
  const [buka, setBuka] = useState(false);
  const [isi, setIsi] = useState<IsiAnalisa | null>(null);
  const [galeri, setGaleri] = useState<GambarAnalisa[]>([]);
  const [formBeli, setFormBeli] = useState(false);
  const [bukti, setBukti] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [lihatPorto, setLihatPorto] = useState(false);
  const [formBatal, setFormBatal] = useState(false);

  const bisaBuka = milikku || a.harga === 0 || status === 'pembeli';
  const bolehBatal = bisaDibatalkan(a, pengguna?.uid);
  const perfPenulis = performa?.analis.find((x) => x.uid === a.uid) ?? null;

  async function muatIsi() {
    setSibuk(true); setKabar('');
    try {
      const h = await bukaIsi(a.id);
      setIsi(h.isi);
      setGaleri(h.galeri);
      setBuka(true);
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal membuka');
    } finally { setSibuk(false); }
  }

  async function kirimPermintaan() {
    setSibuk(true); setKabar('');
    try {
      await mintaAkses(a.id, bukti.trim(), pengguna?.displayName || pengguna?.email?.split('@')[0] || '');
      setKabar('Permintaan terkirim — menunggu persetujuan analis.');
      setFormBeli(false);
      onSegarkan();
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal mengirim');
    } finally { setSibuk(false); }
  }

  const selesai = a.hasil === 'sl' || a.hasil === 'tp' || a.hasil === 'batal';

  return (
    /* `relative` wajib: lencana AI Agent duduk absolut di pojok panel. */
    <Panel className={cn('relative overflow-hidden p-4', selesai && 'opacity-75')}>
      {a.agen && <LencanaAgen />}

      {/* Sampul analisa. Untuk yang BERBAYAR gambarnya tidak dikirim server
          sama sekali — yang tampil cuma keterangan bahwa analisanya
          berilustrasi. Sampul berisi garis entry/SL/TP adalah produk yang
          dijual; menayangkannya gratis membuat tombol belinya tak berarti. */}
      {a.sampul ? (
        <img src={a.sampul} alt="" loading="lazy"
             /* max-w-none WAJIB: preflight Tailwind memberi setiap <img>
               `max-width: 100%`, dan itu memotong `calc(100% + 2rem)` kembali
               ke lebar kotak isi — sampulnya jadi menyisakan celah di kanan
               persis selebar padding kartu. Kelasnya benar sejak awal; yang
               membatalkannya aturan bawaan, bukan calc-nya. */
            className="-mx-4 -mt-4 mb-3 h-28 w-[calc(100%_+_2rem)] max-w-none border-b border-zinc-800 object-cover" />
      ) : a.adaSampul ? (
        <div className="-mx-4 -mt-4 mb-3 flex h-28 w-[calc(100%_+_2rem)] items-center justify-center gap-2 border-b border-zinc-800 bg-zinc-900/60 text-[11.5px] text-zinc-600">
          <Lock className="size-3.5" /> Sampul chart terbuka setelah dibeli
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 grow">
          {/* pr-20 menyisakan ruang untuk lencana di pojok, supaya baris ini
              tidak menabraknya di kartu selebar 320px. */}
          <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', a.agen && 'pr-20')}>
            <span className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
              a.arah === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
              {a.arah === 'BUY' ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {a.arah}
            </span>
            <span className="angka text-[12.5px] text-zinc-300">{a.pasangan}</span>
            {/* Pasar ditandai di baris simbol, bukan di catatan kecil:
                inilah yang menentukan apakah sinyal ini BISA dipakai
                pembacanya sama sekali. */}
            {a.pasar && (
              <span className={cn('rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide',
                a.pasar === 'tradefi' ? 'bg-violet-500/15 text-violet-300' : 'bg-amber-500/15 text-amber-300')}>
                {a.pasar === 'tradefi' ? 'Trade-Fi' : 'Kripto'}
              </span>
            )}
            {a.tf && <span className="angka text-[11px] text-zinc-500">{a.tf}</span>}
            <span className="text-[11px] text-zinc-600">· {tanggalPendek(a.dibuat)}</span>
          </div>
          {/* Tipe entry DI TAMPILAN UTAMA, sebelum analisanya dibuka.
              Ia keterangan, bukan angka — jadi tidak membocorkan level yang
              masih terkunci, tapi menjawab pertanyaan yang menentukan: ini
              rencana yang menunggu harga datang, atau eksekusi sekarang?
              Orang yang menimbang membeli berhak tahu itu lebih dulu. */}
          {(a.jenisEntry || selesai) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {a.jenisEntry && (
                <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  {a.jenisEntry}
                </span>
              )}
              {selesai && <LencanaHasil hasil={a.hasil as 'sl' | 'tp' | 'batal'} />}
            </div>
          )}
          {/* Alasan pembatalan tampil DI KARTU, bukan disembunyikan di balik
              "buka analisa". Orang yang sudah menaruh order mengikuti sinyal
              ini perlu tahu kenapa ditarik pada pandangan pertama, bukan
              sesudah menekan sesuatu. */}
          {a.hasil === 'batal' && a.alasanBatal && (
            <p className="mt-1.5 rounded-md border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-zinc-400">
              <span className="text-zinc-500">Alasan dibatalkan:</span> {a.alasanBatal}
            </p>
          )}
          <div className="mt-1 text-[13.5px] font-medium text-zinc-100">{a.judul}</div>
          <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{a.ringkas}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-zinc-500">
            <span>oleh <span className="text-zinc-300">{a.nama}</span></span>
            {/* WINRATE SINYAL, bukan winrate jurnal.
                Baris ini dulu menampilkan winrate & PF dari jurnal pribadi
                penulisnya — angka yang benar untuk pertanyaan yang tidak
                sedang ditanya. Orang bisa menyusun sinyal bagus lalu
                menghancurkan akunnya sendiri dengan ukuran posisi dan SL
                yang dipindah; jurnal yang berdarah membuat pembaca menolak
                sinyal yang sebenarnya bekerja, dan sebaliknya.
                Yang diikuti pembeli adalah sinyalnya. Maka itu yang
                ditampilkan — dan kalau belum ada yang selesai, dikatakan
                apa adanya, bukan ditambal angka jurnal. */}
            {perfPenulis && perfPenulis.total > 0 ? (
              <>
                <span>winrate sinyal{' '}
                  <span className={cn('angka', perfPenulis.winrate >= 50 ? 'text-emerald-400' : 'text-zinc-300')}>
                    {persen(perfPenulis.winrate)}
                  </span>
                </span>
                <span><span className="angka text-zinc-300">{perfPenulis.total}</span> selesai</span>
              </>
            ) : (
              <span className="text-zinc-600">belum ada sinyal selesai</span>
            )}
            <span>{a.jumlahPembeli} pengcopy</span>
            {!!a.jumlahGambar && (
              <span className="flex items-center gap-1"><Images className="size-3" /> {a.jumlahGambar} foto</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn('angka text-[14px] font-semibold', a.harga === 0 ? 'text-emerald-500' : 'text-zinc-100')}>
            {a.harga === 0 ? 'Gratis' : uang(a.harga)}
          </span>
          {/* Tombol portofolio TIDAK ditampilkan untuk agen: agen tidak punya
              jurnal, jadi tombolnya cuma membuka modal yang selalu berbunyi
              "belum ada snapshot" — jalan buntu yang terlihat seperti fitur
              rusak. Yang menggantikan rekam jejaknya adalah alasan analisa
              yang terbuka penuh, gratis, untuk siapa pun. */}
          {!a.agen && (
            <button onClick={() => setLihatPorto(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[11.5px] text-zinc-300 transition-colors hover:border-zinc-700">
              <LineChart className="size-3.5" /> Lihat portofolio
            </button>
          )}
          {/* Batalkan HANYA muncul untuk sinyal sendiri yang masih menunggu
              harga. Begitu entry tersentuh tombolnya hilang — dan itu bukan
              sekadar disembunyikan, server menolaknya juga. */}
          {bolehBatal && (
            <button onClick={() => setFormBatal(true)}
              title="Tarik rencana ini sebelum harganya datang — alasannya wajib dan tercatat permanen"
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-300">
              <Ban className="size-3.5" /> Batalkan
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-zinc-800/60 pt-3">
        {buka && isi ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px]">
            <span className="text-zinc-500">Entry <span className="angka text-zinc-200">{fHarga(isi.entry)}</span></span>
            <span className="text-zinc-500">SL <span className="angka text-red-400">{fHarga(isi.sl)}</span></span>
            <span className="text-zinc-500">TP <span className="angka text-emerald-500">{fHarga(isi.tp)}</span></span>
            {/* Tautan membawa SELURUH rencana, bukan cuma simbolnya.
                Dulu di sini sl/tp/arah ikut dikirim tapi halaman Chart
                membuangnya — orang yang baru membayar analisa mendarat di
                chart kosong dan harus mengetik ulang level yang barusan ia
                beli, dari ingatan. Sekarang tiketnya terbuka sudah terisi.
                `tf` ikut supaya yang tampil timeframe yang DIANALISA. */}
            <Link
              to={`/chart?simbol=${encodeURIComponent(a.pasangan)}`
                + (a.tf ? `&tf=${a.tf}` : '')
                + `&arah=${a.arah}&entry=${isi.entry}&sl=${isi.sl}&tp=${isi.tp}`}
              className="ml-auto flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-[11.5px] font-medium text-zinc-950 transition-colors hover:bg-white">
              <LineChart className="size-3.5" /> Buka di Chart &amp; Entry
            </Link>
            {isi.alasan && (
              /* whitespace-pre-line: analisa agen ditulis berparagraf dengan
                 judul bagian. Diperas jadi satu blok, ia berubah dari bacaan
                 jadi dinding teks. */
              <p className="w-full whitespace-pre-line text-[12px] leading-relaxed text-zinc-400">{isi.alasan}</p>
            )}
            <Galeri
              analisaId={a.id} galeri={galeri} bisaTambah={!!pengguna}
              uidku={pengguna?.uid} penulisku={milikku}
              onBerubah={setGaleri}
            />
          </div>
        ) : formBeli ? (
          <div className="space-y-2">
            <p className="text-[12px] leading-relaxed text-zinc-500">
              Transfer <span className="angka text-zinc-300">{uang(a.harga)}</span> ke analis (kontak tercantum
              di ringkasannya), lalu kirim buktinya di sini. Analis menyetujui → level dan alasannya terbuka.
              Pembayaran otomatis menyusul lewat Billing.
            </p>
            <div className="flex gap-2">
              <input value={bukti} onChange={(e) => setBukti(e.target.value)}
                placeholder="Tautan / keterangan bukti transfer" className={KELAS_ISIAN} />
              <button onClick={() => void kirimPermintaan()} disabled={sibuk || bukti.trim().length < 4}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Kirim
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {bisaBuka ? (
              <button onClick={() => void muatIsi()} disabled={sibuk}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Unlock className="size-3.5" />}
                Buka analisa
              </button>
            ) : status === 'menunggu' ? (
              <span className="flex items-center gap-1.5 rounded-md border border-amber-500/25 px-3 py-1.5 text-[12px] text-amber-300">
                <Loader2 className="size-3.5 animate-spin" /> Menunggu persetujuan analis
              </span>
            ) : (
              <button onClick={() => setFormBeli(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-200 transition-colors hover:border-zinc-500">
                <Lock className="size-3.5" /> Beli akses · {uang(a.harga)}
              </button>
            )}
            {pemilik && (
              <button onClick={() => { if (confirm('Hapus sinyal ini? (moderasi pemilik — penulisnya tidak bisa)')) void hapusAnalisa(a.id).then(onSegarkan); }}
                className="ml-auto flex cursor-pointer items-center gap-1 rounded-md border border-zinc-800 px-2 py-1.5 text-[11.5px] text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400">
                <Trash2 className="size-3.5" /> Moderasi
              </button>
            )}
          </div>
        )}
        {kabar && <p className="mt-2 text-[12px] text-amber-300/90">{kabar}</p>}
      </div>

      {lihatPorto && (
        <ModalPerformaAnalis a={a} performa={performa} dibatalkan={dibatalkanAnalis}
                             berjalan={berjalanAnalis} tutup={() => setLihatPorto(false)} />
      )}
      {formBatal && (
        <ModalBatal a={a} tutup={() => setFormBatal(false)} selesai={onSegarkan} />
      )}
    </Panel>
  );
}

/** Lencana Beta. Dipakai di dua tempat, jadi ditulis sekali.
 *  Ini proyek besar yang dibangun sambil jalan — menandainya lebih jujur
 *  daripada membiarkan orang mengira fitur setengah jadi ini sudah final. */
function LencanaBeta() {
  return (
    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
      Beta
    </span>
  );
}

/** Slot agen yang belum terisi. Menjelaskan APA yang akan menempatinya dan
 *  ATAS DASAR APA urutannya kelak disusun — placeholder yang cuma bertulis
 *  "segera hadir" tidak memberi tahu apa pun yang tidak sudah jelas. */
function SlotAgen({ urutan }: { urutan: number }) {
  return (
    <Panel className="flex h-[460px] flex-col items-start justify-center gap-2 border-dashed p-5">
      <span className="flex items-center gap-2">
        <Radar className="size-4 text-zinc-700" />
        <span className="text-[12.5px] font-medium text-zinc-400">Slot agen {urutan}</span>
      </span>
      <p className="text-[11.5px] leading-relaxed text-zinc-600">
        Belum terisi. Agen berikutnya masuk ke sini, dan keempat slot nanti
        diurutkan dari ketepatan analisanya — bukan dari urutan pendaftaran.
      </p>
    </Panel>
  );
}

/* ── SUB-HALAMAN ─────────────────────────────────────────────────────────
   Dua urusan yang berbeda pertanyaannya. "Sinyal" menjawab apa yang sedang
   ditawarkan sekarang; "Performa" menjawab apakah yang ditawarkan itu
   pernah terbukti. Menumpuk keduanya dalam satu halaman panjang membuat
   orang yang datang untuk memeriksa rekam jejak harus menggulir melewati
   sinyal yang belum ia percayai.

   Pola tabnya sama dengan halaman Maintenance — satu pola untuk hal yang
   sama, bukan dua cara berbeda menyelesaikan masalah yang identik. */
const SUB = [
  { id: 'market',  label: 'Market Signal' },
  { id: 'posting', label: 'Posting Signal' },
] as const;
type IdSub = typeof SUB[number]['id'];

/* Rak "Sinyal Pantauan" DISEMBUNYIKAN sementara — agennya masih jauh dari
   siap dan tiga dari empat slotnya kosong. Rak yang isinya satu panel beta
   plus tiga kotak "belum terisi" tidak menjanjikan apa pun kepada pengunjung
   selain bahwa produknya belum jadi.

   Kodenya SENGAJA TIDAK DIHAPUS, cuma dimatikan dari satu tempat. Rak itu
   hasil beberapa putaran perbaikan (lebar tetap, gulir mendatar, slot yang
   menjelaskan dirinya); membuangnya berarti mengerjakan ulang semuanya saat
   agennya siap. Ubah ke `true` untuk menampilkannya lagi. */
const TAMPIL_RAK_SINYAL = false;

export default function Analisa() {
  /* Sub-halaman DIBACA DARI ALAMAT (`#/copy?sub=performa`), bukan cuma dari
     state: sidebar sekarang punya sub-menu yang menunjuk langsung ke sini,
     dan tab yang tidak bisa dituju lewat alamat tidak bisa ditaut siapa pun. */
  const [cariSub, setCariSub] = useSearchParams();
  const sub: IdSub = SUB.some((s) => s.id === cariSub.get('sub')) ? (cariSub.get('sub') as IdSub) : 'market';
  const setSub = (id: IdSub) => setCariSub(id === 'market' ? {} : { sub: id }, { replace: true });
  const { pengguna, pemilik, langganan } = useAuth();

  /* Kanal yang sedang dibuka — null berarti daftar kanal. Sinyal kini
     dikelompokkan PER ANALIS seperti papan kanal: satu orang sering
     memposting banyak sinyal, dan menderetkan semuanya rata membuat rekam
     jejak per orangnya tidak pernah terlihat utuh. */
  const [kanalBuka, setKanalBuka] = useState<string | null>(null);
  /** Halaman depan Market Signal: daftar kanal, belum masuk ke kanal siapa
   *  pun. Dipakai memutuskan apa yang boleh menumpuk di kepala halaman —
   *  begitu seseorang masuk ke sebuah kanal, kepala halaman itu miliknya. */
  const diDepan = sub === 'market' && kanalBuka === null;
  const [performa, setPerforma] = useState<Performa | null>(null);
  const { data: riwayat } = useRiwayat();
  const saldoAwal = useSaldoAwal();
  const [daftar, setDaftar] = useState<RingkasAnalisa[]>([]);
  const [masuk, setMasuk] = useState<PermintaanMasuk[]>([]);
  const [statusku, setStatusku] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(true);
  const [kabar, setKabar] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const [pasangan, setPasangan] = useState('BTCUSDT');
  const [arah, setArah] = useState<'BUY' | 'SELL'>('BUY');
  const [pasar, setPasar] = useState<'kripto' | 'tradefi'>('kripto');
  const [hargaJual, setHargaJual] = useState(5);
  const [ringkas, setRingkas] = useState('');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [alasan, setAlasan] = useState('');
  /* Persetujuan pantau jurnal + kesadaran permanen. SENGAJA tidak diingat
     di localStorage: keduanya harus disetujui sadar pada TIAP posting,
     karena tiap posting adalah komitmen baru yang tidak bisa ditarik. */
  const [izinJurnal, setIzinJurnal] = useState(false);
  const [pahamPermanen, setPahamPermanen] = useState(false);
  /* Sampul dari Chart & Entry. Data URL JPEG, diunggah SESUDAH analisanya
     terposting — endpoint galeri butuh id analisanya, dan id itu baru ada
     setelah POST berhasil. */
  const [sampul, setSampul] = useState('');
  /** Ukuran posisi beku yang dibawa draf dari Chart & Entry. Dipakai supaya
   *  "Risk SL" di sini menampilkan angka yang SAMA dengan tiket chart —
   *  bukan −$10 mati dari model contoh. 0 = disusun langsung di sini. */
  const [qtyDraf, setQtyDraf] = useState(0);
  const [lihatSampul, setLihatSampul] = useState(false);

  /* Draf dari Chart & Entry dibaca SEKALI saat halaman dibuka, lalu
     dihapus oleh ambilDraf() — kalau tidak, menyegarkan halaman akan
     mengisi ulang formulir yang barusan sengaja dikosongkan orangnya. */
  useEffect(() => {
    const d = ambilDraf();
    if (!d) return;
    /* Awalan MT5: pada simbolnya adalah penanda pasar yang paling bisa
       dipercaya — ia datang dari daftar simbol MT5 itu sendiri, bukan dari
       tebakan atas nama pasangannya. */
    setPasar(/^MT5:/i.test(d.pasangan) ? 'tradefi' : 'kripto');
    setPasangan(d.pasangan.replace(/^MT5:/i, ''));
    setArah(d.arah);
    /* Dirapikan DI SINI, saat masuk — bukan saat dikirim. Angka yang
       ditampilkan ke orangnya harus sama persis dengan angka yang akan
       terbit; merapikan diam-diam saat submit berarti ia memposting level
       yang berbeda dari yang ia lihat dan setujui. */
    setEntry(String(rapikanHarga(d.entry)));
    setSl(String(rapikanHarga(d.sl)));
    setTp(String(rapikanHarga(d.tp)));
    if (d.sampul) setSampul(d.sampul);
    /* QTY SELALU TERPASANG untuk draf yang datang dari chart — kalau perlu,
       diturunkan ulang dari levelnya sendiri.

       Tanpa cadangan ini ada jendela di mana formulirnya kembali mematok
       −$10: draf yang ditulis bundel Chart LAMA (belum mengirim qty) dibaca
       formulir BARU — persis yang terjadi saat deploy baru saja naik dan
       chunk halaman ter-cache tidak serempak. Formulir lalu jatuh ke model
       contoh, dan angka yang barusan diperbaiki terlihat rusak lagi.

       Turunannya memakai anggapan yang sama dengan tiket chart mode Copy:
       risiko dasar $10 (Modal $1.000 × 1% — setelannya memang tersembunyi
       di mode itu) dibagi jarak SL saat draf dibuat. Untuk draf yang membawa
       qty asli, angka itulah yang menang. */
    if (d.qty && d.qty > 0) {
      setQtyDraf(d.qty);
    } else {
      const jarak0 = Math.abs(d.entry - d.sl);
      setQtyDraf(jarak0 > 0 ? 10 / jarak0 : 0);
    }
    /* PINDAH TAB, bukan sekadar membuka panel. Formulirnya sekarang hidup di
       tab Posting Signal; draf yang mendarat di tab yang tidak sedang
       dilihat sama saja dengan draf yang hilang — orangnya menekan "Ke Copy
       Signal" di chart lalu tiba di daftar kanal, tanpa tanda apa pun bahwa
       rencananya sudah sampai. */
    setCariSub({ sub: 'posting' }, { replace: true });
    setKabar(`Rencana dari Chart & Entry masuk — ${d.pasangan} ${d.tf} ${d.arah}. Lengkapi ringkasan dan alasannya.`);
  }, []);

  const segarkan = () => {
    void daftarAnalisa().then(setDaftar).finally(() => setMemuat(false));
    /* Contoh HANYA untuk yang belum punya akses. Pemilik dan pelanggan
       aktif — satu-satunya orang yang bisa benar-benar menirukan sinyal —
       selalu melihat rekam jejak sungguhan. */
    const bolehContoh = !pengguna || (!pemilik && langganan.status === 'pratinjau');
    void ambilPerforma(bolehContoh).then(setPerforma).catch(() => { /* panel kanal jalan tanpa performa */ });
    if (pengguna) void statusSaya().then((s) => { setMasuk(s.masuk); setStatusku(s.statusku); }).catch(() => { /* belum login */ });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(segarkan, [pengguna?.uid]);

  /* Snapshot rekam jejak DIAMBIL dari jurnal sendiri, di sinilah nilainya:
     angka yang diklaim analis harus angka yang jurnalnya bisa buktikan. */
  const snapshot = useMemo(() => {
    const stat = statGabungan(riwayat, saldoAwal);
    return {
      saldo: Number(stat.saldo.toFixed(2)),
      winrate: Number((stat.winrate ?? 0).toFixed(1)),
      pf: stat.faktorProfit === null || stat.faktorProfit === Infinity ? 0 : Number(stat.faktorProfit.toFixed(2)),
      jumlah: stat.jumlah,
      kurva: kurvaEkuitas(riwayat, saldoAwal).map((t) => t.nilai).slice(-60),
      /* Angka-angka ini yang membuat modalnya bisa berbahasa sama dengan
         halaman Jurnal. Saldo akhir sendirian tidak memberi tahu apa pun:
         $300 bisa berarti naik dari $100 atau jatuh dari $1.000. */
      bersih: Number(stat.bersih.toFixed(2)),
      menang: stat.menang,
      kalah: stat.kalah,
      saldoAwal: Number(saldoAwal.toFixed(2)),
    };
  }, [riwayat, saldoAwal]);

  async function posting() {
    setSibuk(true); setKabar('');
    try {
      const hasil = await kirimAnalisa({
        /* Judul rekaman diturunkan dari ringkasan — kolomnya sudah dihapus
           dari formulir. Server tetap mewajibkannya, dan kartu-kartu lama
           yang judulnya berbeda dari ringkasannya tetap tampil apa adanya. */
        judul: (ringkas.trim() || `${pasangan.trim().toUpperCase()} · ${arah}`).slice(0, 80),
        pasangan: pasangan.trim().toUpperCase(), arah, pasar,
        harga: hargaJual, ringkas: ringkas.trim(),
        isi: { entry: Number(entry) || 0, sl: Number(sl) || 0, tp: Number(tp) || 0, alasan: alasan.trim() },
        nama: pengguna?.displayName || pengguna?.email?.split('@')[0] || 'Analis',
        snapshot,
        izinJurnal,
      });
      /* Sampul diunggah SESUDAH analisanya ada — galeri butuh id-nya.
         Kegagalan unggah TIDAK membatalkan postingan: analisanya sudah
         permanen di server, dan menampilkan "gagal memposting" untuk
         sampul yang tidak jadi terpasang akan membuat orang memposting
         ulang analisa yang sebenarnya sudah masuk. */
      let kabarSampul = '';
      if (sampul && hasil?.id) {
        try {
          await tambahGambar(hasil.id, sampul, 'Sampul analisa',
            pengguna?.displayName || pengguna?.email?.split('@')[0] || '');
        } catch (e) {
          kabarSampul = ' (sampul gagal diunggah — bisa ditambahkan lagi lewat galeri)';
        }
      }
      setKabar(`Analisa terposting — dan kini permanen. Semoga levelnya bekerja.${kabarSampul}`);
      setRingkas(''); setEntry(''); setSl(''); setTp(''); setAlasan('');
      setIzinJurnal(false); setPahamPermanen(false); setSampul(''); setQtyDraf(0);
      segarkan();
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal memposting');
    } finally { setSibuk(false); }
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Bilah sub-halaman. Sengaja di paling atas dan bukan di dalam salah
          satu panel: ia memilih SELURUH isi halaman, dan kontrol yang
          mengubah semuanya tidak boleh terlihat seperti milik satu panel. */}
      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-zinc-800/80 pb-3">
        {SUB.map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)}
            className={cn('cursor-pointer rounded-md px-3 py-1.5 text-[12.5px] transition-colors',
              sub === s.id ? 'bg-zinc-100 font-medium text-zinc-950' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200')}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Peringatan risiko, di tingkat HALAMAN ──────────────────────────
          Kalimat ini dulu menempel di panel Sinyal Pantauan. Panel itu kini
          disembunyikan — dan yang ikut hilang bersamanya justru satu-satunya
          penyeimbang yang terlihat, padahal halaman ini menampilkan pair,
          arah, entry, SL, dan TP dari analisa berbayar: bentuk yang paling
          mudah dibaca orang sebagai "beli sekarang di harga ini".

          DI LUAR TAB, jadi terlihat di keduanya. Tab Performa justru yang
          paling membutuhkannya: winrate dan estimasi hasil adalah angka yang
          paling gampang dibaca sebagai janji.

          Di ATAS, bukan di kaki halaman. Disclaimer yang menunggu digulir
          tidak pernah sampai ke orang yang sedang bersiap menekan "Buka di
          Chart & Entry". */}
      {/* HANYA di halaman depan Market Signal — bukan di dalam kanal, bukan
          di tab Posting. Di dalam kanal, kotak amber setinggi tiga baris
          duduk di antara nama analis dan sinyalnya, dan layar itu berhenti
          terasa seperti kanal orang tersebut.

          TIDAK DIHAPUS, DIPERKECIL. Kanal justru layar yang menampilkan
          entry, SL, dan TP — bentuk yang paling gampang dibaca sebagai
          "beli sekarang di harga ini". Menghilangkan penyeimbangnya sama
          sekali di situ bukan lagi keputusan tampilan, dan ini wilayah OJK
          / Bappebti. Jadi versi ringkasnya tetap ada: satu baris kecil di
          bawah judul kanal. */}
      {diDepan && (
      <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
        <p className="text-[11.5px] leading-relaxed text-zinc-400">
          <span className="font-medium text-amber-300/90">Bukan rekomendasi beli atau jual.</span>{' '}
          Analisa di halaman ini disusun pengguna lain dan agen AI dari data harga publik —
          termasuk yang berbayar. Rekam jejak dan estimasi yang ditampilkan adalah catatan masa
          lalu, <span className="text-zinc-300">bukan jaminan hasil</span>. Periksa ulang sebelum
          eksekusi; seluruh risiko dan keputusan ada padamu.{' '}
          <Link to="/legal" className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-200">
            Disclaimer &amp; Ketentuan
          </Link>
        </p>
      </div>
      )}

      {/* ── Papan peringkat, DI KEPALA Market Signal ─────────────────────
          Bukan sub-halaman sendiri lagi. Orang datang ke sini untuk mencari
          sinyal; sekalian di layar yang sama ia melihat rekam jejak siapa
          yang paling baik. Papan peringkat yang harus dicari di tab lain
          adalah papan yang tidak pernah dibaca orang yang paling perlu
          membacanya — yang sedang menimbang mengikuti seseorang.

          Bisa dilipat: begitu seseorang tahu siapa yang ia ikuti, papan itu
          berubah jadi penghalang antara dia dan sinyalnya. */}
      {diDepan && <PapanPeringkatSignal data={performa} />}

      <div className={cn(sub !== 'market' && 'hidden')}>
      {/* ── Rak sinyal pantauan: empat slot ───────────────────────────
         Duduk di halaman Copy Signal, bukan dashboard: sinyal komunitas
         adalah bahan meniru trade orang lain — satu keluarga dengan
         analisa berbayar di bawahnya, bukan dengan KPI jurnal pribadi.

         EMPAT SLOT SEKARANG, WALAUPUN BARU SATU TERISI. Raknya dibangun
         duluan supaya agen kedua tinggal masuk ke slot yang sudah ada —
         bukan memicu tata ulang halaman saat itu juga. Slot kosongnya
         sengaja MENJELASKAN dirinya: kotak abu tanpa keterangan terbaca
         sebagai panel yang gagal memuat, bukan sebagai tempat yang memang
         belum diisi.

         Urutannya kelak mengikuti ketepatan analisa, bukan waktu daftar.
         Sampai angka itu terkumpul, urutan sekarang belum berarti apa-apa
         dan itu dikatakan apa adanya di layar. */}
      {TAMPIL_RAK_SINYAL && <>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-100">Sinyal Pantauan</h2>
        <LencanaBeta />
        <span className="text-[11.5px] text-zinc-500">1 dari 4 slot terisi</span>
      </div>
      {/* LEBAR TETAP + gulir mendatar, bukan grid responsif.
          ────────────────────────────────────────────────────────────────
          Dengan grid, keempat slot memanjang-memendek mengikuti lebar
          jendela: satu kartu jadi selebar layar di monitor besar, lalu
          remuk jadi kolom sempit saat jendela dikecilkan. Isi kartunya —
          harga, level, ceklist — punya lebar yang memang dibutuhkan, dan
          lebar yang berubah-ubah membuat mata harus mencari ulang letak
          tiap angka setiap kali jendelanya digeser.

          Dengan lebar tetap, kartunya selalu terlihat sama; yang berubah
          cuma berapa banyak yang muat sekaligus. Pola yang sama dipakai
          Koin Hunter di Screener. */}
      <div className="mb-4 flex gap-4 overflow-x-auto pb-1">
        <div className="w-[320px] shrink-0"><PanelSinyal ringkas /></div>
        {[2, 3, 4].map((n) => (
          <div key={n} className="w-[320px] shrink-0"><SlotAgen urutan={n} /></div>
        ))}
      </div>
      </>}
      </div>

      {/* ── Posting Signal ───────────────────────────────────────────────
          Memposting dan mencari sinyal adalah dua pekerjaan berbeda yang
          dilakukan orang berbeda, di saat berbeda. Formulir setinggi layar
          yang duduk di atas daftar sinyal memaksa setiap pengunjung —
          termasuk yang tidak akan pernah memposting apa pun — menggulir
          melewatinya untuk sampai ke yang ia cari. */}
      <div className={cn(sub !== 'posting' && 'hidden')}>

      {/* Permintaan masuk untuk analisaku */}
      {masuk.length > 0 && (
        <Panel className="mb-4">
          <PanelHead judul="Permintaan Akses Masuk"
            sub="Pembeli yang menunggu persetujuanmu — periksa buktinya dulu." />
          <div className="space-y-2 px-5 pb-4">
            {masuk.map((m) => (
              <div key={m.id + m.uid} className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800/60 p-3 text-[12.5px]">
                <span className="text-zinc-300">{m.nama || m.uid.slice(0, 10)}</span>
                <span className="text-zinc-500">→ {m.judul}</span>
                {m.bukti && <span className="max-w-[280px] truncate text-zinc-500" title={m.bukti}>bukti: {m.bukti}</span>}
                <span className="ml-auto flex gap-2">
                  <button onClick={() => void putuskanAkses(m.id, m.uid, 'setujui').then(segarkan)}
                    className="flex cursor-pointer items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11.5px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25">
                    <CheckCircle2 className="size-3.5" /> Setujui
                  </button>
                  <button onClick={() => void putuskanAkses(m.id, m.uid, 'tolak').then(segarkan)}
                    className="cursor-pointer rounded-md border border-zinc-800 px-2.5 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-400">
                    Tolak
                  </button>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Posting */}
      <Panel className="mb-4">
        <PanelHead
          judul={<span className="flex items-center gap-2">Copy Signal <LencanaBeta /></span>}
          sub="Posting rencana trade-mu — yang dinilai orang adalah hasil sinyalmu, bukan klaimmu."
          kanan={
            <button onClick={segarkan} aria-label="Segarkan"
              className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
              <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} />
            </button>
          }
        />
        {/* FORMULIRNYA LANGSUNG TERBUKA — tombol "Posting analisa" dibuang.
            Tabnya sendiri sudah bernama Posting Signal: siapa pun yang
            sampai ke sini sudah menyatakan niatnya, dan meminta satu klik
            lagi untuk membuka panel di dalam tab yang isinya cuma panel itu
            adalah pintu di depan pintu. Dulu tombolnya masuk akal karena
            formulir ini duduk di atas daftar sinyal yang dicari orang lain;
            sesudah pindah tab, alasan itu ikut hilang. */}
        {pengguna && (
          <div className="border-t border-zinc-800/80 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Kolom "Judul" DIHAPUS. Ia meminta orang menulis dua ringkasan
                  untuk satu analisa — judul dan ringkasan publik — dan yang
                  kedua selalu memuat yang pertama. Judul rekamannya kini
                  diambil dari ringkasan (lihat `posting`), jadi kartu lama
                  yang judulnya berbeda tetap tampil apa adanya. */}
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">Pasangan</label>
                <input value={pasangan} onChange={(e) => setPasangan(e.target.value.toUpperCase())} className={cn(KELAS_ISIAN, 'angka')} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">Arah</label>
                <select value={arah} onChange={(e) => setArah(e.target.value as 'BUY' | 'SELL')} className={cn(KELAS_ISIAN, 'cursor-pointer')}>
                  <option>BUY</option><option>SELL</option>
                </select>
              </div>
              {/* Jenis pasar. Nama pasangan saja tidak cukup memberi tahu:
                  XAUUSD di MT5 dan XAUT di Binance dibaca sama oleh mata,
                  tapi dieksekusi di tempat yang berbeda, dengan lot dan jam
                  pasar yang berbeda pula. Pembeli yang cuma punya akun
                  kripto tidak bisa memakai sinyal Trade-Fi — itu harus
                  terlihat SEBELUM ia membayar, bukan sesudah. */}
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">Pasar</label>
                <select value={pasar} onChange={(e) => setPasar(e.target.value as 'kripto' | 'tradefi')}
                        className={cn(KELAS_ISIAN, 'cursor-pointer')}>
                  <option value="kripto">Kripto (Binance)</option>
                  <option value="tradefi">Trade-Fi (MT5)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">Harga akses ($, 0 = gratis)</label>
                <input type="number" value={hargaJual} onChange={(e) => setHargaJual(Number(e.target.value) || 0)} className={cn(KELAS_ISIAN, 'angka')} />
              </div>
              <div><label className="mb-1 block text-[11px] text-zinc-500">Entry</label>
                <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" className={cn(KELAS_ISIAN, 'angka')} /></div>
              <div><label className="mb-1 block text-[11px] text-zinc-500">SL</label>
                <input value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" className={cn(KELAS_ISIAN, 'angka')} /></div>
              <div><label className="mb-1 block text-[11px] text-zinc-500">TP</label>
                <input value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" className={cn(KELAS_ISIAN, 'angka')} /></div>
              <div className="col-span-2 sm:col-span-4">
                <label className="mb-1 block text-[11px] text-zinc-500">
                  Ringkasan publik — ini yang jadi judul kartu, terlihat sebelum dibayar
                </label>
                <input value={ringkas} onChange={(e) => setRingkas(e.target.value)}
                       placeholder="mis. EMA tersusun turun, jual di pantulan EMA50" className={KELAS_ISIAN} />
              </div>

              {/* ── Risiko & imbalan dalam DOLAR ────────────────────────────
                  Level dalam angka harga tidak memberi tahu apa pun tentang
                  besar taruhannya. Yang dihitung di sini memakai model yang
                  SAMA dengan halaman Performa Signal — modal $1.000, risiko
                  1% — supaya angka yang dilihat analis saat memposting dan
                  angka yang dilihat pembeli di rekam jejak berasal dari
                  aturan yang satu, bukan dua yang kebetulan mirip. */}
              {(() => {
                const e = Number(entry), s = Number(sl), t = Number(tp);
                if (!e || !s || !t) return null;
                const jarakSl = Math.abs(e - s), jarakTp = Math.abs(t - e);
                if (!jarakSl) return null;
                const rr = jarakTp / jarakSl;
                const sisiBenar = arah === 'BUY' ? (s < e && t > e) : (s > e && t < e);
                /* DUA SUMBER ANGKA, dan yang dipakai disebut di layar.
                   ──────────────────────────────────────────────────────
                   Kalau rencananya datang dari Chart & Entry, ukuran
                   posisinya sudah dibekukan di sana dan dolarnya MENGIKUTI
                   jarak SL — geser SL lebih jauh, risikonya membesar.
                   Itu yang barusan dilihat orangnya di tiket chart, dan
                   formulir ini harus menampilkan angka yang sama.

                   Kalau diketik langsung di sini tanpa melewati chart,
                   tidak ada ukuran posisi untuk dipakai; yang tersisa model
                   contoh 1% dari $1.000. Bedanya disebutkan, bukan
                   disembunyikan — dua angka yang lahir dari model berbeda
                   tidak boleh terlihat seperti satu jenis angka. */
                const dariChart = qtyDraf > 0;
                const RISIKO = dariChart ? qtyDraf * jarakSl : 10;
                return (
                  <div className="col-span-2 sm:col-span-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                    {!sisiBenar ? (
                      <p className="text-[12px] leading-relaxed text-amber-300/90">
                        SL dan TP berada di sisi yang salah untuk arah {arah}. Untuk {arah},
                        SL harus {arah === 'BUY' ? 'di bawah' : 'di atas'} entry dan
                        TP {arah === 'BUY' ? 'di atas' : 'di bawah'}-nya.
                      </p>
                    ) : (
                      /* SATU BARIS, tiga angka. Versi sebelumnya memakai empat
                         kotak — jarak SL, jarak TP, rasio, dan hasil TP —
                         dan dua di antaranya (jarak dalam harga dan persen)
                         adalah bahan MENTAH dari rasio yang sudah ditampilkan
                         di sebelahnya. Angka yang sudah terangkum tidak perlu
                         ditampilkan lagi bersama bahannya; yang terjadi cuma
                         empat angka yang harus dibaca untuk memahami satu. */
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <span className="flex items-baseline gap-2">
                          <span className="text-[11px] text-zinc-500">R : R</span>
                          <span className={cn('angka text-[16px] font-semibold',
                            rr >= 1.5 ? 'text-emerald-400' : rr >= 1 ? 'text-zinc-100' : 'text-amber-400')}>
                            1 : {rr.toFixed(2)}
                          </span>
                        </span>
                        <span className="flex items-baseline gap-2">
                          <span className="text-[11px] text-zinc-500">Risk SL</span>
                          <span className="angka text-[16px] font-semibold text-red-400">−{uang(RISIKO)}</span>
                        </span>
                        <span className="flex items-baseline gap-2">
                          <span className="text-[11px] text-zinc-500">TP</span>
                          <span className="angka text-[16px] font-semibold text-emerald-400">+{uang(rr * RISIKO)}</span>
                        </span>
                        <span className="text-[10.5px] leading-relaxed text-zinc-600">
                          {dariChart
                            ? 'ukuran posisi dari tiket Chart & Entry — sama dengan yang kamu lihat di sana'
                            : `contoh modal ${uang(1000)}, risiko 1%`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="col-span-2 sm:col-span-4">
                <label className="mb-1 block text-[11px] text-zinc-500">Alasan / analisa lengkap (terkunci)</label>
                <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={3}
                  className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5 text-[12.5px] text-zinc-200 outline-none focus-visible:border-zinc-600" />
              </div>
            </div>
            {/* ── Sampul dari Chart & Entry ───────────────────────────────
                Level bisa diketik tangan di kolom di atas, tapi menyusunnya
                di chart jauh lebih tepat — dan sampulnya cuma bisa lahir di
                sana, karena yang membuat sampul layak dilihat adalah gambar
                analisanya: fibonacci, kotak SNR, garis tren. Chart mini di
                dalam formulir ini hanya akan menghasilkan lilin polos plus
                tiga garis, sampul yang tidak memberi tahu apa pun. */}
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              {sampul ? (
                <div className="flex flex-wrap items-start gap-3">
                  {/* Gambar kecilnya SENDIRI bisa diklik untuk membesar —
                      selain tombolnya. Ukuran 160×96 tidak cukup untuk
                      menilai apakah levelnya kelihatan, dan sampul yang tidak
                      pernah diperiksa terbit apa adanya ke calon pembeli. */}
                  <button onClick={() => setLihatSampul(true)} title="Lihat ukuran penuh"
                          className="shrink-0 cursor-zoom-in">
                    <img src={sampul} alt="Sampul analisa"
                         className="h-24 w-40 rounded border border-zinc-800 object-cover transition-opacity hover:opacity-80" />
                  </button>
                  <div className="min-w-0 grow">
                    <div className="text-[12px] font-medium text-zinc-200">Sampul terpasang</div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      Tangkapan layar chart-mu ikut terbit sebagai sampul analisa ini.
                      Periksa dulu sebelum memposting — sinyalnya permanen.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => setLihatSampul(true)}
                        className="cursor-pointer rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] text-zinc-200 transition-colors hover:border-zinc-500">
                        Lihat sampul
                      </button>
                      <Link to={`/chart?simbol=${encodeURIComponent(pasangan)}&untuk=sinyal&arah=${arah}`
                              + (entry ? `&entry=${entry}` : '') + (sl ? `&sl=${sl}` : '') + (tp ? `&tp=${tp}` : '')}
                        className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] text-zinc-300 transition-colors hover:border-zinc-500">
                        Susun ulang di Chart
                      </Link>
                      <button onClick={() => setSampul('')}
                        className="cursor-pointer rounded-md border border-zinc-800 px-2.5 py-1 text-[11.5px] text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400">
                        Hapus sampul
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <ImagePlus className="size-4 shrink-0 text-zinc-600" />
                  <p className="min-w-0 grow text-[11.5px] leading-relaxed text-zinc-500">
                    Belum ada sampul. Susun rencanamu di Chart & Entry — geser garis entry, SL,
                    dan TP, tambahkan gambar analisamu — lalu tekan{' '}
                    <span className="text-zinc-300">"Ke Copy Signal"</span> di tiket order.
                    Level dan tangkapan layarnya masuk ke formulir ini otomatis.
                  </p>
                  <Link to={`/chart?simbol=${encodeURIComponent(pasangan)}&untuk=sinyal`}
                    className="shrink-0 rounded-md bg-zinc-100 px-3 py-1.5 text-[11.5px] font-medium text-zinc-950 transition-colors hover:bg-white">
                    Susun di Chart & Entry
                  </Link>
                </div>
              )}
            </div>

            {/* ── Dua persetujuan yang menjadikan seseorang analis ─────────
                Keduanya disetujui SADAR pada tiap posting, bukan diingat:
                tiap sinyal adalah komitmen baru yang tidak bisa ditarik.
                Server menolak tanpa izin jurnal — centangnya bukan hiasan. */}
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3.5 py-3">
                <input type="checkbox" checked={izinJurnal} onChange={(e) => setIzinJurnal(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-emerald-500" />
                {/* KALIMAT INI HARUS TETAP BENAR. Ia sempat menjanjikan
                    jurnalnya "bisa diperiksa siapa pun lewat Lihat
                    portofolio" — dan sesudah panel itu diganti performa
                    sinyal, janji tersebut jadi keliru ke arah yang paling
                    buruk: orang menyetujui sesuatu yang tidak terjadi, dan
                    tidak menyetujui yang benar-benar terjadi. */}
                <span className="text-[12px] leading-relaxed text-zinc-400">
                  Saya lampirkan <span className="text-zinc-200">rekam jejak jurnal saya</span>{' '}
                  ({snapshot.jumlah} transaksi, winrate {persen(snapshot.winrate)}, PF {snapshot.pf || '—'})
                  sebagai syarat memposting — analis harus benar-benar trading, bukan cuma
                  memberi arahan. Yang tampil publik adalah <span className="text-zinc-200">hasil
                  sinyal-sinyalku</span>; isi jurnalku sendiri tidak dibuka.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3.5 py-3">
                <input type="checkbox" checked={pahamPermanen} onChange={(e) => setPahamPermanen(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-amber-500" />
                <span className="text-[12px] leading-relaxed text-zinc-400">
                  Saya paham sinyal ini <span className="text-amber-300/90">tidak bisa dihapus</span> setelah
                  diposting, dan hasilnya — kena TP maupun SL — akan tercatat permanen di performa saya.
                  Pastikan analisamu matang sebelum menekan Posting.
                </span>
              </label>
            </div>

            {snapshot.jumlah === 0 && (
              <p className="mt-2 text-[12px] leading-relaxed text-amber-300/90">
                Jurnalmu masih kosong — server akan menolak posting. Analis wajib punya riwayat
                trading yang bisa diperiksa; isi jurnalmu dulu.
              </p>
            )}

            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => void posting()}
                /* Syarat `!judul.trim()` DIHAPUS bersama kolomnya. Ia sempat
                   tertinggal saat kolom Judul dibuang, dan karena judulnya
                   tidak pernah lagi diisi siapa pun, tombolnya terkunci
                   permanen — formulir yang sudah lengkap menolak dikirim
                   tanpa memberi tahu apa yang kurang. */
                disabled={sibuk || !ringkas.trim() || !entry || !sl || !tp
                          || !izinJurnal || !pahamPermanen || snapshot.jumlah === 0}
                title={!ringkas.trim() ? 'Isi ringkasan publik dulu — itu yang jadi judul kartunya'
                  : !entry || !sl || !tp ? 'Entry, SL, dan TP harus terisi'
                  : !izinJurnal || !pahamPermanen ? 'Centang kedua persetujuan dulu'
                  : snapshot.jumlah === 0 ? 'Jurnalmu masih kosong' : undefined}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Posting — permanen
              </button>
            </div>
          </div>
        )}
        {/* Pratinjau sampul ukuran penuh. Yang terpotret HANYA kanvas
            chartnya — lilin, indikator, garis harga, dan alat gambar.
            Panel melayang yang digambar HTML (tiket order, label garis yang
            sedang diseret, bilah alat) TIDAK ikut, karena mereka bukan
            bagian dari kanvas. Itu disebutkan di sini supaya bedanya dengan
            layar tidak terbaca sebagai sampul yang rusak. */}
        {lihatSampul && sampul && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
               onClick={() => setLihatSampul(false)}>
            <div className="max-h-full w-full max-w-4xl overflow-auto" onClick={(e) => e.stopPropagation()}>
              <img src={sampul} alt="Sampul analisa ukuran penuh"
                   className="w-full rounded-lg border border-zinc-800" />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="min-w-0 grow text-[11.5px] leading-relaxed text-zinc-500">
                  Yang terpotret adalah kanvas chart: lilin, indikator, garis harga, dan alat
                  gambar. Tiket order dan label garis yang sedang diseret tidak ikut — keduanya
                  panel melayang, bukan bagian dari chartnya.
                </p>
                <button onClick={() => setLihatSampul(false)}
                  className="shrink-0 cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {kabar && <p className="px-5 pb-4 text-[12px] text-zinc-400">{kabar}</p>}
        {!pengguna && (
          <p className="px-5 pb-4 text-[12.5px] text-zinc-500">Masuk dulu untuk memposting atau membeli analisa.</p>
        )}
      </Panel>
      </div>

      <div className={cn(sub !== 'market' && 'hidden')}>
      {/* ── Kanal per analis ────────────────────────────────────────────
         Satu analis sering memposting banyak sinyal. Dideretkan rata,
         rekam jejak per ORANG tidak pernah terlihat utuh — dan justru
         orangnya yang sedang dinilai pembeli, bukan sinyal satuannya.
         Maka daftar utamanya kartu kanal: satu kartu per analis dengan
         performanya, dan sinyal-sinyalnya terbuka SETELAH kanalnya dipilih. */}
      {memuat ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-zinc-500">
          <Loader2 className="size-4 animate-spin" /> Memuat analisa…
        </div>
      ) : daftar.length === 0 ? (
        <Panel className="px-5 py-10 text-center text-[13px] text-zinc-500">
          Belum ada analisa. Jadilah yang pertama memposting.
        </Panel>
      ) : (() => {
        /* Kelompokkan per analis, urut dari sinyal terbaru. Performa
           (winrate, estimasi) dijahit dari endpoint performa bila ada —
           analis yang belum punya sinyal selesai tampil tanpa angka,
           bukan dengan nol yang terbaca seperti rekam jejak buruk. */
        const kanal = new Map<string, RingkasAnalisa[]>();
        for (const a of daftar) {
          const k = kanal.get(a.uid) ?? [];
          k.push(a); kanal.set(a.uid, k);
        }
        const kanalUrut = [...kanal.entries()].sort((x, y) => y[1][0].dibuat - x[1][0].dibuat);
        const perfDari = (uid: string) => performa?.analis.find((p) => p.uid === uid) ?? null;
        const terpilih = kanalBuka ? kanal.get(kanalBuka) ?? [] : [];
        const infoTerpilih = kanalBuka ? kanal.get(kanalBuka)?.[0] : undefined;

        return kanalBuka === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kanalUrut.map(([uid, sinyal]) => {
              const a0 = sinyal[0];
              const p = perfDari(uid);
              const selesai = sinyal.filter((s) => s.hasil === 'tp' || s.hasil === 'sl').length;
              return (
                <button key={uid} onClick={() => setKanalBuka(uid)}
                  className="relative cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-left transition-colors hover:border-zinc-600">
                  {a0.agen && <LencanaAgen />}
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-[14px] font-semibold text-zinc-100">
                      {(a0.nama || '?').trim()[0]?.toUpperCase() ?? '?'}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-zinc-100">{a0.nama}</span>
                      <span className="block text-[11px] text-zinc-600">
                        {sinyal.length} sinyal · {selesai} selesai
                        {uid === pengguna?.uid && ' · kanalmu'}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-zinc-800/60 p-2.5">
                      <div className="text-[10.5px] text-zinc-600">Winrate</div>
                      <div className={cn('angka text-[15px] font-semibold',
                        p ? (p.winrate >= 50 ? 'text-emerald-400' : 'text-zinc-100') : 'text-zinc-600')}>
                        {p ? persen(p.winrate) : '—'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-800/60 p-2.5">
                      <div className="text-[10.5px] text-zinc-600">Estimasi $1.000</div>
                      <div className={cn('angka text-[15px] font-semibold',
                        p ? (p.hasilDolar >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-600')}>
                        {p ? uang(p.hasilDolar, true) : '—'}
                      </div>
                    </div>
                  </div>
                  {!p && (
                    <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
                      Belum ada sinyal yang selesai — angka muncul setelah harga menyentuh SL/TP.
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <button onClick={() => setKanalBuka(null)}
              className="mb-3 flex cursor-pointer items-center gap-1.5 text-[12.5px] text-zinc-500 transition-colors hover:text-zinc-200">
              ← Semua kanal
            </button>
            <div className="mb-1.5 flex items-center gap-2 text-[13.5px] text-zinc-200">
              <span className="font-medium">{infoTerpilih?.nama}</span>
              <span className="text-zinc-600">· {terpilih.length} sinyal</span>
            </div>
            {/* Satu baris, bukan kotak amber. Cukup untuk tetap ada di layar
                yang menampilkan entry/SL/TP, cukup kecil untuk tidak berdiri
                di antara nama analis dan sinyalnya. */}
            <p className="mb-3 text-[11px] text-zinc-600">
              Bukan rekomendasi beli atau jual · rekam jejak bukan jaminan hasil ·{' '}
              <Link to="/legal" className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-400">
                Disclaimer
              </Link>
            </p>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {terpilih.map((a) => (
                <div key={a.id} className="w-[320px] shrink-0">
                  <KartuAnalisa a={a} status={statusku[a.id]}
                    milikku={a.uid === pengguna?.uid} pemilik={pemilik} onSegarkan={segarkan}
                    performa={performa}
                    dibatalkanAnalis={terpilih.filter((s) => s.hasil === 'batal')}
                    berjalanAnalis={terpilih.filter((s) => !s.hasil).length} />
                </div>
              ))}
            </div>
          </>
        );
      })()}
      </div>
    </div>
  );
}
