import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePaket, LABEL_PAKET } from '@/lib/paket';
import {
  Loader2, Lock, Unlock, Send, X, CheckCircle2,
  TrendingUp, TrendingDown, RefreshCw, Radar, Sparkles, ImagePlus, Images, Flag, Ban, Trash2,
  Settings2, UserRound, Pin, TriangleAlert, ArrowLeft, CandlestickChart,
} from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { PanelSinyal } from '@/components/panel-sinyal';
import { PapanPeringkatSignal } from '@/components/performa-signal';
/* TEMPELAN — sedang dinilai, ditaruh DI DALAM KANAL ANALIS.

   Sempat dipasang di kepala Market Signal dan itu keliru: kepala halaman
   adalah papan peringkat SEMUA analis, sedangkan yang ditempel ini
   performa satu orang. Yang di kepala sudah dikembalikan. */
import PerformaKalender from '@/components/performa-kalender';
import { SparklineSaldo } from '@/components/kurva-saldo';
import { ambilDraf } from '@/lib/draf-sinyal';
import { AvatarAnalis } from '@/components/avatar-analis';
import { ringkasKanal, type RingkasKanal } from '@/lib/ringkas-kanal';
import { usePinAnalis } from '@/lib/pin-analis';
import { cn, uang, persen, harga as fHarga, tanggalPendek } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useRiwayat, useSaldoAwal } from '@/lib/data';
import { useHargaPasar, useHargaTradeFi } from '@/lib/harga';
import { simbolDasarMt5 } from '@/lib/simbol';
import { statGabungan, kurvaEkuitas } from '@/lib/hitung';
import { useTutupLuar } from '@/lib/tutup-luar';
import {
  daftarAnalisa, kirimAnalisa, bukaIsi, mintaAkses,
  ambilProfilAnalis, simpanProfilAnalis,
  statusSaya, putuskanAkses, tambahGambar, hapusGambar, kecilkanGambar, ambilPerforma,
  batalkanAnalisa, bisaDibatalkan, keadaanSinyal,
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


/* ModalPerformaAnalis DIBUANG bersama tombol yang membukanya.

   Satu-satunya pemicunya tombol "Performa Signal" di kartu, dan begitu
   tombolnya dicabut modal itu jadi layar yang tidak punya pintu: kode
   yang lengkap, teruji, dan tidak akan pernah tampil. Yang membacanya
   nanti akan menghabiskan waktu mencari kenapa ia tidak muncul.

   Isinya tidak hilang dari produk: PerformaAnalisSatu tetap hidup di
   components/performa-signal.tsx, dan performa per-analis sekarang
   punya sub-halamannya sendiri di kanal. */


/* ── Lencana gaya trading & tingkat risiko ──────────────────────────────
   Keduanya diturunkan di `ringkasKanal`, tidak pernah diketik analisnya.
   Warnanya sengaja TIDAK memuji: risiko rendah bukan prestasi dan risiko
   tinggi bukan aib — scalper agresif yang jujur soal risikonya lebih
   berguna daripada yang menyamar tenang. Emerald/amber/rose di sini
   membaca "sejauh mana ia pernah turun", bukan "sebagus apa ia". */
const WARNA_RISIKO: Record<string, string> = {
  Rendah: 'border-emerald-500/30 text-emerald-400/90',
  Sedang: 'border-amber-500/30 text-amber-400/90',
  Tinggi: 'border-rose-500/30 text-rose-400/90',
};

function LencanaKanal({ r, className }: { r: RingkasKanal; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {r.gaya && (
        <span title="Diturunkan dari timeframe yang paling sering ia analisa"
              className="rounded border border-zinc-700/70 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {r.gaya}
        </span>
      )}
      {/* Saat datanya belum cukup, lencananya TETAP ada — hanya isinya yang
          berganti jadi "belum dinilai". Menghilangkannya sama sekali membuat
          analis tanpa rekam jejak terlihat seperti tidak punya kolom risiko,
          bukan seperti belum cukup diuji; dan pembaca yang tidak melihat
          peringatan apa pun akan menganggapnya sudah aman. */}
      {/* ANGKANYA IKUT, bukan cuma kata sifatnya.
          ────────────────────────────────────────────────────────────────
          "Risiko rendah" sendirian adalah penilaian tanpa parameter —
          pembaca tidak punya cara memeriksanya, dan dua analis yang sama
          sama "rendah" bisa sangat berbeda.

          Yang ditempelkan jarak SL rata-rata sebagai persen harga, BUKAN
          persen modal. Persen modal memang yang lebih ingin diketahui
          orang, tapi tidak ada yang bisa mengetahuinya: sinyal berisi
          entry/SL/TP dan tidak pernah berisi ukuran posisi, jadi porsi
          modal yang berisiko ditentukan lot yang dipakai penirunya
          sendiri. Menaruh angka karangan di kolom bernama "risiko" adalah
          kebohongan yang paling mahal di halaman ini.

          Jarak SL milik analisnya sungguhan, dan ia yang menentukan:
          dengan lot yang sama, SL 3% menguras tiga kali lipat SL 1%. */}
      <span title={r.slPersen !== null
              ? `${r.alasanRisiko} Jarak SL rata-rata ${r.slPersen}% dari harga, dihitung dari sinyalnya yang sudah selesai. Berapa persen MODALmu yang berisiko tergantung ukuran lot yang kamu pakai sendiri.`
              : r.alasanRisiko}
            className={cn('rounded border px-1.5 py-0.5 text-[10px]',
              r.risiko ? WARNA_RISIKO[r.risiko] : 'border-zinc-800 text-zinc-600')}>
        {r.risiko ? `Risiko ${r.risiko.toLowerCase()}` : 'Risiko belum dinilai'}
        {r.slPersen !== null && (
          <span className="angka opacity-80"> · SL {r.slPersen}%</span>
        )}
      </span>
    </div>
  );
}

/** Satu baris hitungan: menang / kalah / berjalan / menggantung.
 *  Angka nol tetap ditulis, tidak disembunyikan — "0 kalah" dari 12 sinyal
 *  adalah keterangan, dan menghilangkannya membuat kartunya terbaca seperti
 *  belum pernah diuji. */
function BarisHitung({ r }: { r: RingkasKanal }) {
  const bagian: Array<[string, number, string]> = [
    ['menang', r.profit, 'text-emerald-400'],
    ['kalah', r.rugi, 'text-red-400'],
    ['jalan', r.berjalan, 'text-sky-400'],
    ['pending', r.pending, 'text-amber-400'],
  ];
  return (
    /* mt-2.5: barisnya duduk tepat di bawah kotak Estimasi yang bertepi, dan
       tanpa jarak ia menempel ke garis itu — terbaca seperti kaki kotaknya,
       bukan sebagai keterangan kartu yang berdiri sendiri. */
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-zinc-600">
      {bagian.map(([nama, nilai, warna]) => (
        <span key={nama} className="whitespace-nowrap">
          <span className={cn('angka font-semibold', nilai > 0 ? warna : 'text-zinc-600')}>{nilai}</span>
          {' '}{nama}
        </span>
      ))}
      {r.batal > 0 && (
        <span className="whitespace-nowrap" title="Ditarik penulisnya sebelum harganya datang">
          <span className="angka font-semibold text-zinc-500">{r.batal}</span> batal
        </span>
      )}
    </div>
  );
}

/** Penanda analisa yang ditulis agen AI, bukan orang.
 *  Wajib ada dan wajib jelas: pembaca berhak tahu apakah yang ia baca
 *  disusun manusia dengan rekam jejak jurnal, atau mesin yang membaca
 *  lilin. Keduanya boleh salah — tapi salahnya berbeda jenis, dan orang
 *  perlu tahu jenis mana yang sedang ia pertimbangkan. */
function LencanaAgen({ geser }: { geser?: boolean }) {
  return (
    /* Ditempel di POJOK KANAN ATAS panel, bukan ikut mengalir di dalam isi.
       Sebagai baris tersendiri ia mendorong judul turun dan memakan satu
       baris penuh untuk dua kata — dan lencana yang memanjang terbaca
       sebagai isi kartu, padahal ia keterangan TENTANG kartunya. */
    /* `geser` memberi tempat untuk tombol pin di kartu kanal — dua elemen
       yang sama-sama dipaku ke pojok kanan atas akan saling menimpa. */
    <span className={cn('absolute top-3 z-10 flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300',
                        geser ? 'right-10' : 'right-3')}
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

  /* Diportal karena alasan yang sama dengan ModalPerformaAnalis —
     catatan lengkapnya ada di sana. */
  return createPortal(
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
    </div>,
    document.body,
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

      {/* Diportal — sama seperti dua modal di atas berkas ini. Galeri
          hidup di dalam kartu sinyal juga. */}
      {besar && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
             onClick={() => setBesar(null)}>
          <img src={besar.url} alt={besar.ket || 'Foto analisa'}
               className="max-h-full max-w-full rounded-lg object-contain" />
        </div>,
        document.body,
      )}
    </div>
  );
}

function KartuAnalisa({ a, status, milikku, onSegarkan, performa, hargaKini }: {
  a: RingkasAnalisa;
  status: string | undefined;
  milikku: boolean;
  /** Harga pasar terkini pasangan ini. undefined = tidak diketahui, dan
   *  kartunya memang diam saat itu terjadi.
   *
   *  Untuk Trade-Fi, undefined juga berarti tick MT5-nya sudah kedaluwarsa
   *  — terminal pemilik mati, chart-nya dilepas, atau pasar sedang tutup.
   *  Diam di situ disengaja: harga akhir pekan yang tampil seolah hidup
   *  akan menjawab "rencana ini masih terpakai?" dengan percaya diri dan
   *  salah. Lihat useHargaTradeFi. */
  hargaKini?: number;
  /** Performa seluruh papan — kartu ini cuma mengambil barisnya sendiri.
   *  Dioper dari halaman, bukan diambil ulang tiap kartu: satu daftar bisa
   *  memuat belasan kartu, dan belasan permintaan untuk data yang sama
   *  adalah cara paling cepat menghabiskan kuota rute publik. */
  performa: Performa | null;
  /** Pemilik APLIKASI, bukan penulis analisa. Satu-satunya yang boleh
   *  menghapus — itu moderasi (kewajiban pengawasan PSE), bukan fitur.
   *  Penulis TIDAK bisa menghapus sinyalnya sendiri: rekam jejak yang bisa
   *  dihapus bukan rekam jejak. Server menolaknya juga; tombol yang
   *  disembunyikan di sini cuma sopan santun, penjaganya di backend. */

  onSegarkan: () => void;
}) {
  const { pengguna } = useAuth();
  const [buka, setBuka] = useState(false);
  const [isi, setIsi] = useState<IsiAnalisa | null>(null);
  const [galeri, setGaleri] = useState<GambarAnalisa[]>([]);
  const [formBeli, setFormBeli] = useState(false);
  /* Berpindah lewat router, bukan href: memuat ulang seluruh aplikasi cuma
     untuk berpindah halaman di dalamnya membuang seluruh data yang sudah
     diambil — termasuk level yang barusan dijemput. */
  const navigate = useNavigate();
  const [bukti, setBukti] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [formBatal, setFormBatal] = useState(false);

  /* ── SINYAL SELESAI IKUT TERBUKA — menyamakan diri dengan servernya ───
     Bug yang dilaporkan pemiliknya: sinyal yang sudah selesai dibuka di
     chart, tapi entry/SL/TP-nya tidak ikut terbawa.

     Sebabnya baris ini. Server sudah membuka level untuk sinyal yang sudah
     kena TP/SL/batal sejak 17 Agu 2026 — lihat gerbang di /api/analisa/isi
     — tapi syarat di layar tidak ikut diperbarui. Akibatnya kartu sinyal
     berbayar yang sudah selesai menulis "Terbuka gratis" di lencananya,
     TIDAK menampilkan tombol "Buka analisa", dan karena `isi` tidak pernah
     dimuat, tautan chart-nya berangkat tanpa level.

     Tiga bagian yang saling bertentangan di satu kartu, dan tidak satu pun
     berbunyi seperti galat — itu sebabnya ia bertahan sekian lama.

     Rumusnya SENGAJA disalin apa adanya dari server, termasuk 'batal':
     rencana yang ditarik sebelum harganya datang juga tidak bisa
     ditradingkan lagi, dan alasan pembatalannya justru bagian yang paling
     layak dinilai orang. */
  const sudahSelesai = a.hasil === 'tp' || a.hasil === 'sl' || a.hasil === 'batal';
  const bisaBuka = milikku || a.harga === 0 || sudahSelesai || status === 'pembeli';

  /* ── TAUTAN "BUKA DI CHART" ──────────────────────────────────────────
     Dulu tautan ini cuma ada SETELAH analisanya dibuka, terkubur di baris
     Entry/SL/TP. Sekarang ia naik ke baris tombol dan ada di kedua
     keadaan — terkunci maupun terbuka.

     Yang dikirim berbeda, dan pembedanya bukan selera: PASANGAN dan ARAH
     sudah tertulis terang di kepala kartu untuk semua orang, jadi
     membukanya di chart tidak membocorkan apa pun. Yang dibayar adalah
     LEVEL-nya — entry, SL, TP — dan itu cuma ikut kalau isinya memang
     sudah ada di tangan.

     Jadi yang belum membeli tetap bisa melihat chart pasangannya di
     timeframe yang dianalisa; yang ia tidak dapat cuma garis-garisnya.
     Gemboknya menyatakan persis itu.

     AWALAN MT5: WAJIB untuk Trade-Fi. Halaman Chart memilih SUMBER DATA
     dari bentuk simbolnya — tanpa awalan ia menarik lilin dari proxy VPS
     ke Binance, dengan "MT5:" ia menarik dari lilin yang dikirim EA.
     Tanpa ini, sinyal XAUUSD mendarat di chart yang mencari XAUUSD di
     Binance, bursa yang memang tidak punya simbol itu — dan pesan yang
     muncul menuduh jaringan padahal permintaannya yang salah alamat. */
  /* Dijadikan fungsi supaya level yang BARU DIJEMPUT bisa dipakai langsung,
     tanpa menunggu render berikutnya. `setIsi` tidak mengubah `isi` di
     dalam pemanggilan yang sedang berjalan — memakai variabelnya di situ
     akan menghasilkan tautan tanpa garis, persis bug yang sedang dibetulkan. */
  const alamatChart = (lv: IsiAnalisa | null) =>
    `/chart-entry?simbol=${encodeURIComponent((a.pasar === 'tradefi' ? 'MT5:' : '') + a.pasangan)}`
    + (a.tf ? `&tf=${a.tf}` : '')
    + (lv ? `&arah=${a.arah}&entry=${lv.entry}&sl=${lv.sl}&tp=${lv.tp}` : '');
  const tautanChart = alamatChart(isi);
  const bolehBatal = bisaDibatalkan(a, pengguna?.uid);
  const perfPenulis = performa?.analis.find((x) => x.uid === a.uid) ?? null;

  /* Tautan chart yang MENJEMPUT levelnya dulu.
     ──────────────────────────────────────────────────────────────────────
     Laporan pemiliknya: sinyal yang sudah selesai dibuka di chart, garis
     entry/SL/TP-nya tidak ikut. Perbaikan sebelumnya membuat tombol "Buka
     analisa" muncul untuk sinyal selesai, tapi itu menyisakan satu langkah
     yang tidak masuk akal: levelnya sudah GRATIS, orangnya sudah menekan
     "Buka di Chart", dan ia masih harus menekan tombol lain dulu supaya
     yang diminta ikut terbawa.

     Sekarang tombolnya yang menjemput. Kalau levelnya belum ada di tangan
     tapi memang boleh dibuka, ia diambil dulu, baru chart-nya dibuka —
     dengan garisnya lengkap.

     SATU permintaan, dan hanya saat diklik. Memuatnya otomatis untuk tiap
     kartu akan berarti belasan permintaan tiap kali kanal dibuka, untuk
     level yang mungkin tidak satu pun dilihat orang. */
  async function keChart(e: React.MouseEvent) {
    if (isi || !bisaBuka) return;             // sudah lengkap, atau memang terkunci
    e.preventDefault();
    setSibuk(true);
    try {
      const h = await bukaIsi(a.id);
      setIsi(h.isi);
      setGaleri(h.galeri);
      navigate(alamatChart(h.isi));
    } catch {
      /* Gagal mengambil level bukan alasan menahan orang di halaman ini —
         chart tetap dibuka, cuma tanpa garisnya. */
      navigate(alamatChart(null));
    } finally { setSibuk(false); }
  }

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
    /* flex-col + h-full: kartu mengisi tinggi raknya, bukan tinggi isinya.
       Dipasangkan dengan mt-auto di baris tombol supaya seluruh kartu di
       satu rak berakhir di garis yang sama. */
    <Panel className={cn('relative flex h-full flex-col overflow-hidden p-4', selesai && 'opacity-75')}>
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
            {/* HARGA DI UJUNG BARIS INI, bukan di tengah kartu.
                Sebelumnya ia berdiri sendiri di antara isi analisa dan
                tombol, dan di rak mendatar posisinya ikut bergeser
                mengikuti panjang judul tiap kartu — mata harus
                mencarinya ulang di tiap kartu. Di ujung baris kepala ia
                selalu di tempat yang sama, sebaris dengan tanggal:
                dua keterangan yang sama-sama dibaca sekilas. */}
            <span className={cn('angka ml-auto shrink-0 text-[13px] font-semibold',
              a.harga === 0 ? 'text-emerald-500' : 'text-zinc-100')}>
              {a.harga === 0 ? 'Gratis' : uang(a.harga)}
            </span>
          </div>
          {/* Tipe entry DI TAMPILAN UTAMA, sebelum analisanya dibuka.
              Ia keterangan, bukan angka — jadi tidak membocorkan level yang
              masih terkunci, tapi menjawab pertanyaan yang menentukan: ini
              rencana yang menunggu harga datang, atau eksekusi sekarang?
              Orang yang menimbang membeli berhak tahu itu lebih dulu. */}
          {/* Baris ini dulu digerbangi `(a.jenisEntry || selesai)`, dan itu
              masuk akal ketika isinya HANYA tipe entry: tidak ada tipe, tidak
              ada yang digambar.

              Begitu lencana keadaan (Berjalan / Menunggu harga) dan harga
              terkini masuk ke sini, gerbang itu berubah jadi bug: sinyal
              dengan jenisEntry kosong — entry pasar, dan itu wajar — kehilangan
              SELURUH barisnya, termasuk dua keterangan yang tidak ada
              hubungannya dengan tipe entry. Nyata di XAUUSD: kartunya tidak
              pernah menampilkan status maupun harga sementara kartu kripto di
              sebelahnya menampilkan keduanya.

              Gerbangnya dibuang. Barisnya selalu punya isi: kalau selesai ada
              lencana hasil, kalau belum ada lencana keadaan. */}
          {(
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {a.jenisEntry && (
                <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  {a.jenisEntry}
                </span>
              )}
              {/* Keadaan sinyalnya, dibawa DI KARTU dan bukan cuma di judul
                  raknya: kartu ini juga tampil di rak "Semua kanal" dan di
                  hasil pencarian, jauh dari pengelompokannya. Tanpa lencana
                  ini, di sana order yang harganya belum datang terlihat
                  persis sama dengan posisi yang sudah berjalan.

                  `terisi` yang membedakan, bukan jenis ordernya — Buy Limit
                  yang harganya sudah tersentuh SUDAH jadi posisi. */}
{/* TIGA keadaan, dan yang ketiga yang menjadi pokok: "belum dinilai".

                  Dulu di sini cuma ada dua cabang, dan cabang "Berjalan"
                  ikut menampung sinyal yang jenisEntry-nya masih KOSONG —
                  yaitu setiap sinyal yang baru diposting, sebelum penilai
                  sempat menyentuhnya. Akibatnya order menggantung muncul
                  sebagai posisi yang sudah jalan, lalu berpindah sendiri ke
                  "Menunggu harga" beberapa menit kemudian tanpa ada apa pun
                  yang terjadi di pasar. Itu laporan pemiliknya.

                  Sekarang pembedanya keadaanSinyal(), dan keadaan yang belum
                  diperiksa mengaku belum diperiksa. Warnanya sengaja zinc,
                  bukan biru atau amber: ia bukan kabar tentang pasar, ia
                  kabar tentang kami. */}
              {!selesai && (() => {
                const keadaan = keadaanSinyal(a);
                if (keadaan === 'jalan') return (
                  <span title="Harga sudah menyentuh entry — titik masuknya sudah lewat"
                        className="flex items-center gap-1 rounded border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
                    <span className="size-1.5 rounded-full bg-sky-400" /> Berjalan
                  </span>
                );
                if (keadaan === 'nunggu') return (
                  <span title="Order menggantung — entry-nya belum tersentuh"
                        className="flex items-center gap-1 rounded border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    <span className="size-1.5 rounded-full bg-amber-400" /> Menunggu harga
                  </span>
                );
                return (
                  <span title="Penilai belum sampai ke sinyal ini — keadaannya muncul setelah lilinnya dibaca, paling lama beberapa menit"
                        className="flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                    <span className="size-1.5 rounded-full bg-zinc-600" /> Menunggu penilaian
                  </span>
                );
              })()}
              {/* HARGA TERKINI — menjawab "rencana ini masih terpakai?"
                  ────────────────────────────────────────────────────────
                  Ditaruh di sini, bukan di dalam panel terkunci, karena
                  harga pasar bukan milik siapa pun: ia tidak membocorkan
                  entry/SL/TP yang justru dijual. Yang bisa dibaca orang
                  cuma "pasarnya sekarang di sini" — dan itu persis yang
                  ia butuhkan untuk memutuskan membeli sinyalnya atau
                  tidak.

                  Sinyal SELESAI tidak menampilkannya: harganya sudah tidak
                  relevan, dan angka berjalan di sebelah hasil yang sudah
                  final justru mengesankan ia masih bisa diikuti. */}
              {!selesai && hargaKini !== undefined && hargaKini > 0 && (
                <span title="Harga pasar terkini — dari proxy VPS, bukan dari penulis sinyal"
                      className="flex items-center gap-1 rounded border border-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                  <span className="size-1 animate-pulse rounded-full bg-emerald-400" />
                  {fHarga(hargaKini)}
                </span>
              )}
              {selesai && <LencanaHasil hasil={a.hasil as 'sl' | 'tp' | 'batal'} />}
              {/* Sinyal selesai kini terbuka untuk siapa pun — dikatakan di
                  kartunya supaya orang tahu tidak perlu membeli apa pun
                  untuk memeriksanya. */}
              {selesai && a.harga > 0 && (
                <span className="rounded border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400/90"
                      title="Peluangnya sudah habis, jadi levelnya dibuka gratis untuk diperiksa">
                  Terbuka gratis
                </span>
              )}
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
          {/* [Performa Signal] DICABUT — permintaan pemilik. Panel performa
              analisnya sudah terbuka lebar sebagai sub-halaman sendiri di
              kanal; tombol per-kartu yang membuka hal yang sama cuma jalan
              kedua ke tempat yang sudah punya pintu.

              [Buka di Chart] TURUN ke baris tombol di dasar kartu, sejajar
              "Buka analisa". Keduanya tindakan atas sinyal ini, dan
              memisahkannya — satu di kepala, satu di kaki — membuat mata
              harus menyapu kartu dua kali untuk menemukan apa yang bisa
              dilakukan. */}
          {/* Batalkan HANYA muncul untuk sinyal sendiri yang masih menunggu
              harga. Begitu entry tersentuh tombolnya hilang — dan itu bukan
              sekadar disembunyikan, server menolaknya juga. */}
          {bolehBatal && (
            <button onClick={() => setFormBatal(true)}
              title="Tarik rencana ini sebelum harganya datang — alasannya wajib dan tercatat permanen"
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-300">
              {/* Ikon bak sampah — permintaan pemilik, supaya tombolnya
                  terbaca sekilas sebagai "tarik order ini" di antara tombol
                  lain yang semuanya justru MEMBUKA sesuatu.

                  SATU CATATAN untuk yang mengubahnya nanti: ini BUKAN
                  penghapusan. Barisnya tetap ada, tetap terhitung di papan
                  peringkat pada kolomnya sendiri ("Dibatalkan"), dan
                  alasannya tayang permanen di kartunya. Bak sampah biasanya
                  berarti hilang — di sini tidak, dan yang menegakkan itu
                  gerbang di server, bukan ikon di layar. */}
              <Trash2 className="size-3.5" /> Batalkan
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
            {/* Tautan "Buka di Chart" DULU di sini, sebaris dengan
                Entry/SL/TP. Ia pindah naik ke baris tombol: di sini ia
                cuma ada setelah analisanya dibuka, padahal pertanyaan
                "chart-nya seperti apa" justru datang SEBELUM orang
                memutuskan membuka. */}
            {isi.alasan && (
              /* whitespace-pre-line: analisa agen ditulis berparagraf dengan
                 judul bagian. Diperas jadi satu blok, ia berubah dari bacaan
                 jadi dinding teks. */
              <p className="w-full whitespace-pre-line text-[12px] leading-relaxed text-zinc-400">{isi.alasan}</p>
            )}
            <Galeri
              /* bisaTambah SELALU false: menambah foto ke sinyal ditutup
                  seluruhnya, bukan cuma di formulir postingnya. Foto galeri
                  menempel pada ANALISANYA — siapa pun yang boleh membukanya
                  bisa menambahkan gambar ke sana — jadi meninggalkan pintu
                  ini terbuka membuat pencabutan di formulir tidak berarti
                  apa-apa.

                  Komponennya dibiarkan utuh: ia masih menampilkan foto yang
                  sudah ada, dan menyalakannya lagi cukup satu nilai. */
              analisaId={a.id} galeri={galeri} bisaTambah={false}
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
          /* mt-auto: baris tombol dipaku ke DASAR kartu.
             Tanpa ini tiap kartu setinggi isinya masing-masing, dan di rak
             mendatar hasilnya deretan tombol yang tingginya bertingkat-
             tingkat — mata membaca itu sebagai tata letak yang rusak,
             padahal cuma isinya yang tidak sama panjang. */
          <div className="mt-auto flex items-center gap-2 pt-1">
            {bisaBuka ? (
              <button onClick={() => void muatIsi()} disabled={sibuk}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" />
                  /* DICERMIN mendatar. Gembok terbuka lucide menaruh besinya
                     di kanan, dan di sana ia terbaca seperti sedang MENUTUP:
                     ujung besinya menjauh dari badan gemboknya, jadi
                     garisnya tampak tidak menyatu. Dicermin, besinya
                     menghadap kiri dan bertumpu pada badannya — bentuk yang
                     dibaca orang sebagai "sudah terbuka". */
                  : <Unlock className="size-3.5 -scale-x-100" />}
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
            {/* Ikon CANDLESTICK, bukan gembok.

                Gembok di sini menjawab pertanyaan yang salah: ia bercerita
                tentang kunci, padahal yang dituju tombolnya adalah CHART.
                Keadaan terkunci sudah dinyatakan tombol di sebelah kirinya
                ("Buka analisa" / "Beli akses"), jadi dua gembok bersebelahan
                cuma mengulang hal yang sama dua kali dengan satu-satunya
                pembeda arah besinya.

                Yang tersisa dari keadaan itu warnanya: putih pekat kalau
                levelnya memang ikut terbawa, bergaris tipis kalau chart-nya
                terbuka tanpa level. */}
{/* IKUT TERKUNCI kalau levelnya belum boleh dibuka.

                Dulu tombol ini selalu bisa ditekan, dengan alasan yang
                sebenarnya masuk akal: pasangan dan timeframe sudah tertulis
                terang di kepala kartu untuk semua orang, jadi membuka
                chart-nya tidak membocorkan apa pun.

                Yang tidak diperhitungkan alasan itu adalah apa yang
                DIDAPAT orangnya. Ia menekan tombol di kartu sinyal, pindah
                halaman, dan sampai di chart kosong — chart yang persis sama
                dengan yang bisa ia buka sendiri dari menu, tanpa satu pun
                garis dari sinyal yang barusan ia klik. Itu tidak terbaca
                sebagai "bagian ini berbayar"; itu terbaca sebagai fitur yang
                rusak, dan yang tampak rusak justru produk yang dijual.

                Sekarang keadaannya dinyatakan sebelum orangnya berpindah
                halaman. Gembok di sini memang mengulang gembok di tombol
                sebelahnya, dan itu disengaja: keduanya menuju hal yang sama
                (levelnya), jadi keduanya harus terkunci bersama.

                Yang sudah boleh membuka tetap dapat garisnya OTOMATIS —
                keChart() menjemput levelnya dulu, lihat catatannya di atas. */}
            {bisaBuka ? (
              <Link to={tautanChart} onClick={(e) => void keChart(e)}
                title={isi
                  ? 'Buka chart dengan entry, SL, dan TP sudah terisi'
                  : 'Buka chart — entry, SL, dan TP dijemput dulu lalu ikut terbawa'}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  isi
                    ? 'bg-zinc-100 text-zinc-950 hover:bg-white'
                    : 'border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100')}>
                {sibuk && !isi ? <Loader2 className="size-3.5 animate-spin" /> : <CandlestickChart className="size-3.5" />}
                Buka di Chart
              </Link>
            ) : (
              <span title="Chart-nya ikut terbuka begitu akses sinyal ini dibuka — lengkap dengan garis entry, SL, dan TP"
                className="flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-md border border-zinc-800/60 px-3 py-1.5 text-[12px] font-medium text-zinc-600">
                <Lock className="size-3.5" /> Buka di Chart
              </span>
            )}
            {/* TOMBOL MODERASI DICABUT — permintaan pemilik.

                YANG DICABUT TOMBOLNYA, BUKAN KEMAMPUANNYA. Rute
                DELETE /api/analisa di VPS masih hidup dan masih memeriksa
                bahwa yang meminta adalah pemilik aplikasi; sinyal tetap bisa
                ditarik dari sana kalau suatu saat perlu.

                Itu perlu dicatat, karena penghapusan sinyal bukan cuma
                kenyamanan: sebagai PSE, penyelenggara wajib bisa menurunkan
                isi yang melanggar dari platformnya sendiri. Kalau rutenya
                ikut dicabut suatu hari, kewajiban itu ikut hilang bersamanya
                — dan tidak akan ada yang menyadarinya sampai ada yang
                memposting sesuatu yang harus diturunkan. */}
          </div>
        )}
        {kabar && <p className="mt-2 text-[12px] text-amber-300/90">{kabar}</p>}
      </div>

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
/* Urutannya SENGAJA begini: 'performa' duluan. Ia cuma muncul di dalam
   kanal, dan di sana ia yang pertama — keputusan pemilik.

   'posting' TIDAK ikut tampil di dalam kanal. Ia sudah ada sebagai sub-menu
   sidebar, dan menu yang sama muncul dua kali di satu layar membuat orang
   menebak-nebak apakah keduanya benda yang sama. Di dalam ruang satu analis
   ia juga salah tempat: memposting sinyal bukan sesuatu yang dilakukan
   "di dalam" kanal orang lain. */
const SUB = [
  /* URUTANNYA: 'market' duluan, dan di dalam kanal ia yang terbuka
     pertama — keputusan pemilik, mengubah yang sebelumnya.

     Alasannya masuk akal begitu dilihat dari sisi orang yang mengklik: ia
     baru saja memilih sebuah kanal dari daftar yang SUDAH memperlihatkan
     winrate, estimasi, dan kurva saldonya. Rekam jejaknya sudah ia baca —
     yang belum ia lihat justru sinyalnya. */
  { id: 'market',   label: 'Market Signal' },
  { id: 'performa', label: 'Performa Signal' },
  { id: 'posting',  label: 'Posting Signal' },
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

/* ════════════════════════════════════════════════════════════════════
   MENU KLIK-KANAN — satu-satunya jalan menyematkan kanal
   ════════════════════════════════════════════════════════════════════
   Menggantikan tombol pin yang dulu duduk permanen di pojok tiap kartu.
   Permintaan pemiliknya, dan alasannya kuat: pin adalah alat yang dipakai
   sekali lalu tidak disentuh berbulan-bulan, sementara kartunya dibaca
   tiap hari. Tombol yang jarang dipakai tapi selalu terlihat membayar
   ongkosnya tiap kali orang membaca kartu, bukan tiap kali ia dipakai.

   ── YANG HILANG DAN DISADARI ────────────────────────────────────────
   1. e.preventDefault() mematikan menu bawaan peramban di atas kartu —
      "buka di tab baru", "salin", dan periksa elemen ikut hilang DI SANA.
      Di luar kartu semuanya normal.
   2. Klik kanan tidak bisa ditemukan sendiri oleh siapa pun. Karena itu
      ada satu baris petunjuk di atas daftarnya; tanpa itu fiturnya ada
      tapi tidak pernah dipakai, yang sama saja dengan tidak ada.
   3. Di layar sentuh, yang membangkitkan contextmenu adalah TEKAN-TAHAN.
      Android Chrome dan Safari iOS keduanya mengirimkannya, jadi jalannya
      tetap ada — tapi ia jalan yang berbeda dari yang tertulis di
      petunjuk, dan itu sebabnya petunjuknya menyebut keduanya.

   Menunya sengaja cuma berisi SATU tindakan. Menu sekali-pakai yang
   isinya satu baris lebih jujur daripada menu yang diisi tindakan lain
   supaya terlihat pantas jadi menu. */
function MenuPin({ x, y, disemat, pilih, tutup }: {
  x: number; y: number; disemat: boolean; pilih: () => void; tutup: () => void;
}) {
  const kotak = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x, y });

  /* Digeser masuk kalau menabrak tepi layar. Diukur SESUDAH tergambar —
     tinggi dan lebarnya baru pasti setelah isinya ada, dan menebaknya di
     muka akan meleset begitu labelnya berganti panjang ("Sematkan ke
     atas" vs "Lepas sematan"). useLayoutEffect, bukan useEffect:
     pergeserannya harus terjadi sebelum frame pertama, kalau tidak
     menunya terlihat melompat. */
  useLayoutEffect(() => {
    const el = kotak.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const pergi = (e: Event) => {
      /* Klik DI DALAM menunya tidak menutup: kalau tidak, tekanan yang
         sama menutup menu sebelum tombolnya sempat menyala. */
      if (kotak.current && e.target instanceof Node && kotak.current.contains(e.target)) return;
      tutup();
    };
    const tombol = (e: KeyboardEvent) => { if (e.key === 'Escape') tutup(); };
    /* Fase CAPTURE: menu harus tertutup sebelum klik sampai ke kartu di
       bawahnya — tanpa itu satu klik menutup menu SEKALIGUS membuka
       kanalnya, dan orangnya tidak pernah bermaksud membuka apa pun.
       'scroll' juga capture: guliran terjadi di panel dalam, bukan di
       jendela, dan pendengar tanpa capture tidak akan mendengarnya. */
    window.addEventListener('pointerdown', pergi, true);
    window.addEventListener('scroll', pergi, true);
    window.addEventListener('resize', tutup);
    window.addEventListener('keydown', tombol);
    return () => {
      window.removeEventListener('pointerdown', pergi, true);
      window.removeEventListener('scroll', pergi, true);
      window.removeEventListener('resize', tutup);
      window.removeEventListener('keydown', tombol);
    };
  }, [tutup]);

  return createPortal(
    <div ref={kotak} role="menu" style={{ left: pos.x, top: pos.y }}
      className="fixed z-[70] min-w-[188px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl shadow-black/60">
      <button role="menuitem" onClick={() => { pilih(); tutup(); }}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[12.5px] text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100">
        <Pin className={cn('size-3.5', disemat ? 'fill-current text-amber-400' : 'text-zinc-500')} />
        {disemat ? 'Lepas sematan' : 'Sematkan ke atas'}
      </button>
    </div>,
    document.body,
  );
}

/** Sinyal ini pasar kripto (Binance) atau Trade-Fi (MT5)?
 *
 *  `pasar` sudah dikirim server, tapi analisa LAMA — yang diposting sebelum
 *  medan itu ada — tidak punya. Bentuk pasangannya jadi jaring pengaman:
 *  yang berakhiran USDT pasti kripto, sisanya Trade-Fi. Tanpa cadangan itu
 *  sinyal lama semuanya jatuh ke satu kelompok yang salah, dan yang paling
 *  lama justru yang paling banyak dipakai menilai rekam jejak. */
function pasarKripto(s: RingkasAnalisa): boolean {
  if (s.pasar) return s.pasar === 'kripto';
  return /USDT$/i.test(s.pasangan || '');
}

export default function Analisa() {
  /* Sub-halaman DIBACA DARI ALAMAT (`#/copy?sub=performa`), bukan cuma dari
     state: sidebar sekarang punya sub-menu yang menunjuk langsung ke sini,
     dan tab yang tidak bisa dituju lewat alamat tidak bisa ditaut siapa pun. */
  const [cariSub, setCariSub] = useSearchParams();
  /* null = alamatnya tidak menyebut tab sama sekali. Dibedakan dari
     'market' karena tab bawaannya sekarang BERGANTUNG KEADAAN: di daftar
     kanal 'market', di dalam kanal 'performa'. Kalau yang kosong langsung
     dijadikan 'market', bawaan di dalam kanal tidak akan pernah kepakai. */
  const subUrl = cariSub.get('sub');
  const subMinta: IdSub | null = SUB.some((s) => s.id === subUrl) ? (subUrl as IdSub) : null;
  const { pengguna, pemilik, langganan } = useAuth();
  /* Copy Signal tidak termasuk paket gratis — itu yang tertulis di kartu
     harga, jadi itu yang harus berlaku di sini. Kartu harga yang menjanjikan
     pembeda lalu tidak menegakkannya bukan cuma bohong kepada pembeli; ia
     juga menghapus alasan orang naik paket.

     PEMILIK selalu lewat: ia harus bisa memeriksa sinyal orang lain, dan
     mengunci dirinya sendiri dari alat pemeriksaannya tidak masuk akal.

     `memuatPaket` ikut dijaga supaya halamannya tidak berkedip terkunci
     selama jawaban server masih di jalan. */
  const { paket: paketku, memuat: memuatPaket } = usePaket();
  const kunciCopy = !!pengguna && !pemilik && !memuatPaket && !paketku.copySignal;

  /* ── Siapa yang boleh MEMPOSTING ──────────────────────────────────────
     Pratinjau 24 jam membuka semua alat, TAPI tidak membuka ini. Sinyal
     tidak bisa dihapus setelah diposting dan ikut dihitung papan peringkat,
     jadi akun sekali-pakai yang memposting lalu menghilang meninggalkan
     jejak permanen di papan yang dipakai analis sungguhan.

     Selama jawaban server belum datang (`memuatPaket`), tabnya DITAHAN.
     Menampilkannya dulu lalu mencabutnya begitu jawaban tiba membuat orang
     mengetik separuh formulir ke dalam tab yang lenyap.

     Ini cuma menyembunyikan pintunya. Yang mengunci ada di server —
     POST /api/analisa menolak dengan 403 POSTING_TERKUNCI, karena
     permintaan itu bisa dikirim tanpa membuka halaman ini sama sekali. */
  const bolehPosting = pemilik || (!memuatPaket && paketku.postingSinyal);

  /* Tabnya TETAP TERBUKA dan formulirnya tetap bisa diisi — keputusan
     pemilik. Yang dimatikan cuma tombol kirimnya.

     Menyembunyikan tabnya lebih mudah, tapi salah sasaran: orang yang
     sedang mencoba produk justru perlu MELIHAT apa yang akan ia dapat.
     Formulir yang bisa diisi sampai ujung lalu berhenti di satu tombol
     berlabel jelas menerangkan nilainya jauh lebih baik daripada menu
     yang tidak pernah ia tahu ada. */

  /* Kanal yang sedang dibuka — null berarti daftar kanal. Sinyal kini
     dikelompokkan PER ANALIS seperti papan kanal: satu orang sering
     memposting banyak sinyal, dan menderetkan semuanya rata membuat rekam
     jejak per orangnya tidak pernah terlihat utuh. */
  /* ── KANAL YANG TERBUKA HIDUP DI ALAMAT, BUKAN DI STATE ───────────────
     Dulu `useState`, dan itu menutup tiga hal sekaligus:

     1. Sidebar tidak mungkin tahu kanal siapa yang sedang dibuka, jadi
        sub-menu "Area Analis" tidak bisa digambar sama sekali.
     2. Kanal seseorang tidak bisa ditautkan. Menyalin alamatnya lalu
        membukanya di tempat lain mendarat di daftar, bukan di kanalnya.
     3. Muat ulang halaman membuang kanal yang sedang dibaca.

     Ketiganya satu sebab, jadi satu perbaikan. */
  const kanalBuka = cariSub.get('kanal') || null;

  /* Pindah kanal MENGOSONGKAN `sub`, bukan mempertahankannya. Tab yang
     sedang dibuka milik kanal yang barusan ditinggalkan; membawanya ke kanal
     lain berarti menebak bahwa orangnya ingin melihat hal yang sama tentang
     orang yang berbeda. Yang bawaan lebih baik daripada yang ditebak. */
  const setKanalBuka = (uid: string | null) =>
    setCariSub((p) => {
      const b = new URLSearchParams(p);
      if (uid) b.set('kanal', uid); else b.delete('kanal');
      b.delete('sub');
      return b;
    }, { replace: true });
  const { disematkan, ubahPin } = usePinAnalis();
  /** Kanal yang sedang diklik-kanan, beserta titik munculnya menu. null =
   *  tidak ada menu terbuka. */
  const [menuPin, setMenuPin] = useState<{ uid: string; x: number; y: number } | null>(null);
  /** Halaman depan Market Signal: daftar kanal, belum masuk ke kanal siapa
   *  pun. Dipakai memutuskan apa yang boleh menumpuk di kepala halaman —
   *  begitu seseorang masuk ke sebuah kanal, kepala halaman itu miliknya. */
  /* KEPALA HALAMAN — peringatan risiko + papan peringkat.
     ────────────────────────────────────────────────────────────────────
     Dulu `sub === 'market' && kanalBuka === null`, dan syarat pertama itu
     yang membuat bilah sub-halaman melompat: di Market Signal bilahnya
     duduk di bawah papan peringkat, di Posting Signal tidak ada apa pun di
     atasnya sehingga ia naik sendiri ke puncak. Menekan tab yang seharusnya
     bersaudara terasa seperti berpindah ke halaman lain.

     Syarat `sub` dilepas. Keduanya kini tampil di kedua sub-halaman, dan
     itu bukan sekadar demi posisi bilah:

       · Peringatan risiko JUSTRU lebih perlu dibaca yang sedang MEMPOSTING
         sinyal untuk diikuti orang lain, bukan cuma yang membacanya.
       · Papan peringkat memperlihatkan kepada yang mau memposting di mana
         posisinya sekarang — konteks yang hilang kalau ia harus pindah tab
         untuk melihatnya.

     Yang tersisa cuma `kanalBuka === null`: membuka satu kanal adalah masuk
     ke dalam sesuatu, dan di sana seluruh halaman memang berganti. */
  const diDepan = kanalBuka === null;

  /* ── Tab mana yang tampil, dan mana yang sedang dibuka ────────────────
     Daftar kanal : Market + Posting  (seperti semula)
     Dalam kanal  : Performa + Market (Performa duluan)

     `sub` HARUS dihitung SESUDAH `diDepan`, bukan sebelumnya — daftar
     tabnya sendiri bergantung pada apakah sebuah kanal sedang terbuka.

     Alamat yang menunjuk tab yang tidak ada di keadaan ini dipulangkan ke
     'market', bukan dibiarkan. Tanpa itu, orang yang membuka ?sub=performa
     lalu menekan "← Semua kanal" mendarat di daftar kanal dengan tab yang
     tombolnya tidak ada di mana pun — layar kosong tanpa penjelasan dan
     tanpa jalan keluar selain menebak. */
  /* Label 'market' BERGANTUNG KEADAAN, dan itu bukan kemanjaan.

     Di daftar kanal ia memang Market Signal: pasar sinyal SEMUA analis.
     Di dalam sebuah kanal ia bukan itu — isinya daftar sinyal SATU orang.
     Memakai satu nama untuk keduanya membuat pohon menunya memuat "Market
     Signal" dua kali bersarang di dalam dirinya sendiri, dan orang harus
     menebak apakah keduanya benda yang sama. */
  const tabTampil = SUB
    .filter((s) => (diDepan ? s.id !== 'performa' : s.id !== 'posting'))
    .map((s) => (!diDepan && s.id === 'market' ? { ...s, label: 'Daftar Signal' } : s));

  /* Masuk kanal, yang pertama terlihat Performa Signal — keputusan pemilik.
     Orang membuka kanal seseorang untuk menimbang apakah ia layak diikuti,
     dan itu pertanyaan tentang rekam jejak, bukan tentang sinyal terbarunya. */
  const bawaanSub: IdSub = 'market';
  const sub: IdSub = subMinta && tabTampil.some((s) => s.id === subMinta) ? subMinta : bawaanSub;

  /* Bawaan tidak ditulis ke alamat, tab lain ditulis. Kalau 'market' selalu
     dianggap bawaan seperti dulu, menekan tab Market di dalam kanal akan
     MENGOSONGKAN parameternya — dan alamat tanpa parameter di dalam kanal
     berarti Performa, jadi tombolnya memantul balik ke tab yang barusan
     ditinggalkan. */
  /* Disunting dari parameter yang SEDANG BERLAKU, bukan ditulis dari nol.
     Bentuk lamanya menyerahkan objek utuh, dan itu menghapus `kanal`:
     menekan tab di dalam kanal akan melemparkan orangnya keluar ke daftar. */
  const setSub = (id: IdSub) =>
    setCariSub((p) => {
      const b = new URLSearchParams(p);
      if (id === bawaanSub) b.delete('sub'); else b.set('sub', id);
      return b;
    }, { replace: true });

  /* ── Peringatan risiko: tampil 3 detik, lalu menyusut sendiri ──────────
     Keputusan pemilik 17 Agu 2026, sesudah sempat dicoba jadi kaki halaman
     dan dikembalikan ke atas.

     Timernya digantung pada `diDepan`, BUKAN pada pemasangan komponen.
     Kalau digantung pada mount, orang yang mendarat di tab Posting lalu
     pindah ke Market sepuluh detik kemudian tidak akan pernah melihatnya —
     timernya sudah habis di layar yang tidak menampilkannya. Digantung
     begini, hitungannya mulai saat kalimatnya benar-benar terlihat, dan
     mulai lagi tiap kali orangnya kembali ke halaman depan Market Signal.

     LIMA DETIK, dinaikkan dari tiga (permintaan pemilik, 17 Agu 2026).

     YANG PERLU DICATAT DENGAN JUJUR: kalimat ini ±45 kata, dan 5 detik
     cukup untuk kira-kira 16 kata pada kecepatan baca wajar. Ia masih
     lewat sebelum sempat dibaca habis — naik dari tiga detik memperbaiki
     keadaan, tidak menyelesaikannya. Yang menahan risikonya karena itu
     BUKAN kalimat ini, melainkan tiga hal yang tidak ikut menghilang:
       · satu baris ringkas DI ATAS tiap kanal yang dibuka — dan kanal
         itulah layar yang benar-benar menampilkan entry, SL, dan TP
       · tautan "Legal" permanen di kaki sidebar
       · halaman /legal itu sendiri
     Ini wilayah OJK/Bappebti; kalau salah satu dari tiga itu dicabut,
     durasi 3 detik ini harus ikut ditinjau ulang. */
  const [diskTampil, setDiskTampil] = useState(true);
  useEffect(() => {
    if (!diDepan) return;
    setDiskTampil(true);
    const t = setTimeout(() => setDiskTampil(false), 5000);
    return () => clearTimeout(t);
  }, [diDepan]);

  const [performa, setPerforma] = useState<Performa | null>(null);
  const { data: riwayat } = useRiwayat();
  const saldoAwal = useSaldoAwal();
  const [daftar, setDaftar] = useState<RingkasAnalisa[]>([]);
  /* Harga terkini tiap pasangan, dipakai kartu sinyal untuk menjawab satu
     pertanyaan: rencana ini masih terpakai atau harganya sudah lewat?

     DUA sumber, karena memang dua pasar yang berbeda:
       kripto   -> proxy VPS ke Binance, selalu hidup
       Trade-Fi -> tick MT5 dari EA di terminal pemilik, dan HANYA yang
                   masih segar (lihat useHargaTradeFi soal harga basi)

     Keduanya tidak pernah tercampur: useHargaPasar menyaring sendiri ke
     simbol berakhiran USDT/USDC/BUSD/FDUSD, sisanya dicari di peta MT5.
     Menampilkan harga Binance untuk XAUUSD Exness adalah angka yang
     terlihat benar sambil menunjuk pasar yang berbeda. */
  const hargaPasar = useHargaPasar(daftar.map((a) => a.pasangan));
  const hargaMt5 = useHargaTradeFi();
  /* Pasangan sinyal ditulis apa adanya oleh penulisnya ("XAUUSD"), sementara
     peta MT5 berkunci simbol dasar. simbolDasarMt5 memotong akhiran broker
     supaya "XAUUSDc" dan "XAUUSD" bertemu di kunci yang sama. */
  const hargaUntuk = (pasangan: string): number | undefined =>
    hargaPasar[pasangan] ?? hargaMt5[simbolDasarMt5(pasangan)];
  /* Sub-halaman kanal: berjalan / menunggu harga / selesai. */
  const [rakAktif, setRakAktif] = useState<'jalan' | 'nunggu' | 'selesai' | 'batal'>('jalan');
  const [masuk, setMasuk] = useState<PermintaanMasuk[]>([]);
  const [statusku, setStatusku] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(true);
  const [kabar, setKabar] = useState('');
  /* Nada kabar. Sebelumnya sukses dan gagal memakai satu string yang sama
     dan dirender identik — abu-abu 12px di kaki panel. Yang memposting
     karena itu harus MEMBACA kalimatnya untuk tahu sinyalnya masuk atau
     tidak, dan kalau terlewat ia bolak-balik memeriksa sendiri. Warna dan
     lambang menjawabnya sebelum kalimatnya dibaca. */
  const [nada, setNada] = useState<'info' | 'ok' | 'galat'>('info');
  const [sibuk, setSibuk] = useState(false);

  const [pasangan, setPasangan] = useState('BTCUSDT');
  const [arah, setArah] = useState<'BUY' | 'SELL'>('BUY');
  const [pasar, setPasar] = useState<'kripto' | 'tradefi'>('kripto');

  /* Simbol untuk halaman Chart — AWALAN `MT5:` DIPASANG KEMBALI di sini.
     ──────────────────────────────────────────────────────────────────────
     Ini perbaikan bug yang dilaporkan: tombol "Susun ulang di Chart"
     membuka `#/chart?simbol=XAUUSD`, dan chartnya menjawab "Data tidak
     diterima. Proxy VPS mungkin sedang tidak menjawab" — pesan yang
     menuduh VPS padahal VPS-nya sehat. Yang salah simbolnya: XAUUSD itu
     simbol MT5, dan proxy Binance memang tidak punya lilinnya.

     Perjalanannya bocor di satu titik. Draf dari chart datang sebagai
     `MT5:XAUUSD`; formulir MENCOPOT awalannya supaya kolom Pasangan enak
     dibaca, lalu menyimpan pasarnya terpisah di `pasar`. Tautan ini cuma
     memakai `pasangan` dan melupakan `pasar`, jadi penanda pasarnya hilang
     dalam perjalanan pulang.

     Disatukan di sini, bukan di dalam JSX-nya: kalau nanti ada tombol
     kedua yang membuka chart dari formulir ini, ia memakai nilai yang sama
     dan tidak bisa lupa dengan cara yang sama. */

  /* ── Profil analis: nama tampilan & avatar ────────────────────────────
     Dibuka dari ikon gerigi di kepala panel Posting Signal — bukan halaman
     sendiri. Yang diatur di sini cuma dipakai di satu tempat (papan Copy
     Signal), dan pengaturan yang tinggal di halaman lain adalah pengaturan
     yang tidak pernah ditemukan orang yang membutuhkannya.

     Nilai awalnya dari server, BUKAN dari akun Google. Kalau dari akun,
     orang yang sudah mengganti namanya akan melihat nama lamanya kembali
     tiap kali panel ini dibuka, dan menekan Simpan tanpa curiga akan
     mengembalikannya betulan. */
  const [bukaSetelan, setBukaSetelan] = useState(false);
  const [profNama, setProfNama] = useState('');
  const [profAvatar, setProfAvatar] = useState<'anonim' | 'foto'>('anonim');
  const [profFoto, setProfFoto] = useState('');
  const [profBaru, setProfBaru] = useState('');        // data URL yang belum tersimpan
  const [profSibuk, setProfSibuk] = useState(false);
  const [profKabar, setProfKabar] = useState('');
  const berkasFoto = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!pengguna) return;
    void ambilProfilAnalis().then((semua) => {
      const p = semua[pengguna.uid];
      setProfNama(p?.nama || pengguna.displayName || pengguna.email?.split('@')[0] || '');
      setProfFoto(p?.foto || '');
      setProfAvatar(p?.foto ? 'foto' : 'anonim');
    });
  }, [pengguna]);

  function pilihFoto(f: File | null) {
    if (!f) return;
    /* Dibatasi DI SINI juga, bukan cuma di server: mengunggah 8 MB lewat
       jaringan seluler lalu ditolak adalah menit yang terbuang tanpa hasil,
       dan pesannya baru datang setelah semuanya terkirim. */
    if (f.size > 2 * 1024 * 1024) {
      setProfKabar(`Foto ${(f.size / 1048576).toFixed(1)} MB — batasnya 2 MB.`);
      return;
    }
    const r = new FileReader();
    r.onload = () => { setProfBaru(String(r.result || '')); setProfAvatar('foto'); setProfKabar(''); };
    r.readAsDataURL(f);
  }

  async function simpanProfil() {
    setProfSibuk(true); setProfKabar('');
    try {
      const hasil = await simpanProfilAnalis({
        nama: profNama.trim(),
        avatar: profAvatar,
        ...(profBaru ? { dataUrl: profBaru } : {}),
      });
      setProfNama(hasil.nama);
      setProfFoto(hasil.foto);
      setProfAvatar(hasil.avatar);
      setProfBaru('');
      setProfKabar('Tersimpan. Nama dan avatarmu berlaku untuk seluruh sinyal, termasuk yang lama.');
      segarkan();
    } catch (e) {
      setProfKabar('Gagal: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setProfSibuk(false); }
  }


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
    setNada('info');
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

  /* ── HALAMAN INI BERUBAH SENDIRI, JADI IA HARUS MEMERIKSA SENDIRI ──────
     Laporan pemiliknya: sinyal XAUUSD-nya sudah kena TP tapi layar tetap
     menulis "Berjalan". Ditelusuri, dan yang salah bukan MT5 dan bukan
     penilainya — keduanya bekerja. Servernya sudah mencatat "kena TP"
     lengkap dengan jam dan RR-nya.

     Yang tidak terjadi: halaman ini TIDAK PERNAH mengambil ulang datanya.
     `segarkan()` cuma dipanggil sesudah orangnya memposting sinyal atau
     menyimpan profil — dua hal yang ia lakukan sendiri. Sementara sinyal
     berubah karena HARGA, bukan karena tombol: penilai server menandainya
     tiap lima menit tanpa ada yang menyentuh layar ini.

     Jadi apa pun yang termuat saat halaman dibuka akan bertahan di sana
     sampai dimuat ulang. Yang membuatnya sulit disadari: datanya tidak
     salah, cuma tua — dan layar yang menampilkan angka tua terlihat persis
     sama dengan layar yang menampilkan angka terbaru.

     ── DUA PEMICU, DAN KEDUANYA HEMAT ────────────────────────────────────
     Menyegarkan saat TABNYA KEMBALI TERLIHAT menutup kejadian yang paling
     sering: orangnya membuka tab lain, kembali beberapa jam kemudian, dan
     langsung mendapat yang terbaru tanpa satu permintaan pun terbuang
     selama ia pergi.

     Selang satu menit menangani yang menunggui layarnya. Dijaga
     `visibilityState`: tab latar tidak meminta apa-apa. Ini bukan
     kerapian — koneksi yang dipakai proyek ini dibatasi kuota, dan halaman
     yang memanggil server tiap menit selamanya di tab yang terlupakan itu
     tagihan yang tidak seorang pun memintanya. */
  const segarkanRef = useRef(segarkan);
  segarkanRef.current = segarkan;
  useEffect(() => {
    const terlihat = () => document.visibilityState === 'visible';
    const j = setInterval(() => { if (terlihat()) segarkanRef.current(); }, 60_000);
    const saatKembali = () => { if (terlihat()) segarkanRef.current(); };
    document.addEventListener('visibilitychange', saatKembali);
    return () => {
      clearInterval(j);
      document.removeEventListener('visibilitychange', saatKembali);
    };
  }, []);
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
    setSibuk(true); setKabar(''); setNada('info');
    try {
      await kirimAnalisa({
        /* Judul rekaman diturunkan dari ringkasan — kolomnya sudah dihapus
           dari formulir. Server tetap mewajibkannya, dan kartu-kartu lama
           yang judulnya berbeda dari ringkasannya tetap tampil apa adanya. */
        judul: (ringkas.trim() || `${pasangan.trim().toUpperCase()} · ${arah}`).slice(0, 80),
        pasangan: pasangan.trim().toUpperCase(), arah, pasar,
        harga: hargaJual, ringkas: ringkas.trim(),
        isi: { entry: Number(entry) || 0, sl: Number(sl) || 0, tp: Number(tp) || 0, alasan: alasan.trim() },
        /* Nama PROFIL didahulukan. Server menimpanya lagi saat membaca,
           jadi ini cuma cadangan — tapi cadangan yang benar: tanpa ini,
           rekaman baru menyimpan nama akun Google milik orang yang justru
           sudah sengaja memakai nama samaran. */
        nama: profNama.trim() || pengguna?.displayName || pengguna?.email?.split('@')[0] || 'Analis',
        snapshot,
        izinJurnal,
      });
      setNada('ok');
      setKabar('Analisa terposting — dan kini permanen. Semoga levelnya bekerja.');
      setRingkas(''); setEntry(''); setSl(''); setTp(''); setAlasan('');
      setIzinJurnal(false); setPahamPermanen(false); setSampul(''); setQtyDraf(0);
      segarkan();
    } catch (e) {
      setNada('galat');
      setKabar(e instanceof Error ? e.message : 'Gagal memposting');
    } finally { setSibuk(false); }
  }

  /* Terkunci karena paket. Bentuknya kalimat + jalan keluar, bukan layar
     kosong: yang membacanya orang yang sudah punya akun dan sedang mencari
     alasan untuk naik paket, bukan orang tersesat. */
  if (kunciCopy) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-6">
          <div className="text-[14px] font-medium text-amber-300">Copy Signal belum termasuk paketmu</div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-400">
            Paket <span className="text-zinc-200">{LABEL_PAKET[paketku.paket]}</span> memberi akses penuh ke
            chart, screener, dan jurnal — tapi belum ke papan sinyal analis. Copy Signal terbuka mulai paket
            berbayar, tanpa tambahan biaya lain.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/harga"
                  className="rounded-md bg-zinc-100 px-4 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white">
              Lihat paket
            </Link>
            <Link to="/dashboard"
                  className="rounded-md border border-zinc-800 px-4 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700">
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* ── Peringatan risiko, 3 detik lalu menyusut ──────────────────────
          Alasan lengkapnya di dekat `diskTampil` di atas berkas ini.

          MENYUSUT, BUKAN LANGSUNG LENYAP. `display:none` mendadak membuat
          seluruh halaman melompat naik 3 detik setelah dibuka — persis saat
          mata sedang menyusuri kartu kanal, dan yang terasa bukan "kalimat
          itu selesai" melainkan "halamannya bergeser sendiri".

          grid-rows 1fr → 0fr menganimasikan tinggi yang SEBENARNYA, tanpa
          menebak max-height. Kalau kalimatnya diperpanjang nanti, tidak ada
          angka ajaib yang ikut harus diperbaiki.

          DITULIS SEBAGAI GAYA INLINE, bukan kelas `grid-rows-[0fr]`.
          Versi pertama memakai kelas itu dan GAGAL DIAM-DIAM: Tailwind tidak
          menghasilkan aturannya sama sekali (diperiksa — nol aturan
          `grid-rows` di seluruh stylesheet), jadi nama kelasnya cuma teks
          mati. Yang bekerja tinggal `opacity-0`, dan hasilnya gabungan
          terburuk: kalimatnya tak terlihat tapi tetap memakan 37 px, jadi
          halaman tetap terdorong ke bawah oleh sesuatu yang tidak ada.
          Gaya inline tidak bisa terlewat pemindai kelas.

          motion-reduce: yang menyalakan "kurangi gerak" di sistemnya
          mendapat pergantian tanpa animasi — mereka menyalakannya justru
          karena gerak begini memicu sesuatu. */}
      {diDepan && (
        <div
          style={{ gridTemplateRows: diskTampil ? '1fr' : '0fr' }}
          className={cn(
            'grid overflow-hidden transition-all duration-500 ease-out motion-reduce:transition-none',
            diskTampil ? 'mb-4 opacity-100' : 'mb-0 opacity-0',
          )}>
          <div className="overflow-hidden">
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

      {/* ── Bilah sub-halaman ───────────────────────────────────────────
          Dipindah ke SINI (18 Agu 2026) — di bawah papan peringkat beserta
          catatan cara estimasi dihitung, bukan lagi di paling atas halaman.

          Yang dibeli: papan peringkat jadi hal pertama yang dilihat orang
          yang baru masuk, dan bilah ini berubah fungsi jadi pembatas antara
          ringkasan di atas dan daftar sinyal di bawah.

          POSISINYA SEKARANG TETAP di Market Signal maupun Posting Signal:
          kepala halaman (peringatan risiko + papan peringkat) sengaja
          ditampilkan di keduanya — lihat catatan di `diDepan`. Versi
          pertama tidak begitu, dan bilah ini melompat ke puncak tiap kali
          tab Posting dibuka.

          Ia masih naik saat sebuah KANAL dibuka, dan itu dibiarkan:
          membuka kanal adalah masuk ke dalam sesuatu, dan di sana seluruh
          halaman memang berganti — bukan tab bersaudara yang ditukar.

          border-t, bukan border-b: garisnya kini memisahkan dari yang di
          ATAS, bukan menggarisbawahi dirinya sendiri. */}
      {/* ── PANEL KELUAR, DI ATAS BILAH TAB ──────────────────────────────
          Dulu tombol ini duduk DI BAWAH bilah tab, di dalam badan kanal —
          jadi ia ikut berpindah tiap kali tab diganti, dan letaknya berubah
          tergantung isi tabnya. Jalan keluar yang pindah-pindah tempat harus
          dicari dulu tiap kali diperlukan.

          Sekarang ia di atas segalanya, dalam panelnya sendiri: ia memang
          bukan bagian dari tab mana pun, ia jalan keluar dari keduanya. */}
      {!diDepan && (
        <div className="mb-3 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2">
          {/* Panah IKON, bukan karakter "←".
              Panah teks mewarisi berat huruf paragraf — tipis, dan di 12,5px
              ia nyaris tak terbaca sebagai panah. Ikon punya strokeWidth
              sendiri, jadi ia bisa ditebalkan tanpa menebalkan tulisannya.

              "Kembali", bukan "Semua kanal": yang perlu diketahui orangnya
              adalah APA YANG TERJADI kalau ditekan, bukan nama tempat yang
              akan ia datangi. */}
          <button onClick={() => setKanalBuka(null)}
            className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-zinc-300 transition-colors hover:text-zinc-100">
            <ArrowLeft className="size-[18px]" strokeWidth={2.75} />
            Kembali
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1 border-t border-zinc-800/80 pt-3">
        {tabTampil.map((s) => (
          /* GARIS BAWAH, bukan bidang terisi.

             Tab terisi penuh punya berat yang sama dengan tombol tindakan —
             di layar yang juga memuat "Copy Signal" dan "Kembali", ia ikut
             berebut perhatian padahal tugasnya cuma menandai posisi.

             Garisnya di <span>, BUKAN di tombolnya: tombolnya punya px-3
             supaya sasaran kliknya lega, dan garis yang ikut selebar itu
             akan lebih panjang daripada tulisannya.

             `font-medium` dipasang di KEDUA keadaan. Menebalkan hanya yang
             aktif membuat lebarnya berubah tiap kali tab ditukar, dan
             tetangganya bergeser sedikit — gerakan yang tidak diminta siapa
             pun dan terlihat seperti layar yang belum tenang. */
          <button key={s.id} onClick={() => setSub(s.id)}
            className={cn('cursor-pointer px-3 pt-1 pb-0.5 text-[12.5px] font-medium transition-colors',
              sub === s.id ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
            <span className={cn('inline-block border-b-2 pb-1.5 transition-colors',
              sub === s.id ? 'border-zinc-100' : 'border-transparent')}>
              {s.label}
            </span>
          </button>
        ))}
      </div>


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
            <span className="flex items-center gap-1">
              {/* Gerigi HANYA untuk yang sudah masuk: profil analis tidak
                  ada artinya sebelum ada akun yang memilikinya, dan tombol
                  yang membuka panel kosong terbaca sebagai fitur rusak. */}
              {pengguna && (
                <button onClick={() => setBukaSetelan((v) => !v)} aria-label="Pengaturan profil analis"
                  title="Nama tampilan & avatar"
                  className={cn('cursor-pointer rounded p-1 transition-colors hover:bg-zinc-800',
                    bukaSetelan ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-200')}>
                  <Settings2 className="size-3.5" />
                </button>
              )}
              <button onClick={segarkan} aria-label="Segarkan"
                className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
                <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} />
              </button>
            </span>
          }
        />
        {/* FORMULIRNYA LANGSUNG TERBUKA — tombol "Posting analisa" dibuang.
            Tabnya sendiri sudah bernama Posting Signal: siapa pun yang
            sampai ke sini sudah menyatakan niatnya, dan meminta satu klik
            lagi untuk membuka panel di dalam tab yang isinya cuma panel itu
            adalah pintu di depan pintu. Dulu tombolnya masuk akal karena
            formulir ini duduk di atas daftar sinyal yang dicari orang lain;
            sesudah pindah tab, alasan itu ikut hilang. */}
        {pengguna && bukaSetelan && (
          <div className="border-t border-zinc-800/80 bg-zinc-950/40 px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <UserRound className="size-3.5 text-zinc-500" />
              <h3 className="text-[12.5px] font-medium text-zinc-200">Tampilanmu sebagai analis</h3>
            </div>

            <div className="flex flex-wrap items-start gap-5">
              {/* Pratinjau HIDUP, bukan contoh. Inilah yang akan dilihat
                  orang lain di papan peringkat — dan avatar yang cuma bisa
                  dibayangkan sampai tersimpan adalah avatar yang dipasang
                  lalu langsung diganti. */}
              <div className="flex flex-col items-center gap-2">
                <AvatarAnalis
                  nama={profNama || 'Analis'}
                  foto={profAvatar === 'foto' ? (profBaru || profFoto) : ''}
                  uid={pengguna.uid}
                  className="size-16" kelasHuruf="text-[22px]"
                />
                <span className="text-[10.5px] text-zinc-600">pratinjau</span>
              </div>

              <div className="min-w-[220px] grow">
                <label className="mb-1 block text-[11px] text-zinc-500">Nama tampilan</label>
                <input value={profNama} maxLength={40}
                  onChange={(e) => setProfNama(e.target.value)}
                  placeholder="Nama yang dilihat orang di papan peringkat"
                  className={KELAS_ISIAN} />
                <p className="mt-1 text-[10.5px] leading-relaxed text-zinc-600">
                  Berlaku untuk <b className="font-normal text-zinc-500">seluruh sinyalmu</b>, termasuk yang
                  sudah diposting. Boleh nama samaran — yang dinilai orang hasil sinyalnya.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => { setProfAvatar('anonim'); setProfKabar(''); }}
                    className={cn('cursor-pointer rounded-md border px-3 py-1.5 text-[12px] transition-colors',
                      profAvatar === 'anonim'
                        ? 'border-zinc-500 bg-zinc-800/60 text-zinc-100'
                        : 'border-zinc-800 text-zinc-400 hover:border-zinc-700')}>
                    Anonim — huruf awal
                  </button>
                  <button onClick={() => berkasFoto.current?.click()}
                    className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition-colors',
                      profAvatar === 'foto'
                        ? 'border-zinc-500 bg-zinc-800/60 text-zinc-100'
                        : 'border-zinc-800 text-zinc-400 hover:border-zinc-700')}>
                    <ImagePlus className="size-3.5" />
                    {profFoto || profBaru ? 'Ganti foto' : 'Unggah foto'}
                  </button>
                  <input ref={berkasFoto} type="file" accept="image/png,image/jpeg,image/webp" hidden
                    onChange={(e) => { pilihFoto(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                </div>
                <p className="mt-1 text-[10.5px] leading-relaxed text-zinc-600">
                  PNG, JPG, atau WebP — maksimal 2 MB. Memilih Anonim tidak menghapus fotomu;
                  ia cuma berhenti ditampilkan, jadi bisa dinyalakan lagi kapan saja.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button onClick={() => void simpanProfil()} disabled={profSibuk || !profNama.trim()}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                    {profSibuk && <Loader2 className="size-3.5 animate-spin" />} Simpan
                  </button>
                  {profKabar && (
                    <span className={cn('text-[11.5px] leading-relaxed',
                      /^Gagal/.test(profKabar) ? 'text-red-400' : 'text-emerald-400/90')}>
                      {profKabar}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
            {/* KOTAK SAMPUL DICABUT — permintaan pemilik: pengguna tidak
                boleh melampirkan foto saat memposting sinyal, karena
                gambar yang diunggah orang tidak bisa diperiksa
                keasliannya. Tangkapan layar chart bisa disunting, dan
                sampul yang menunjukkan level rapi tapi tidak pernah
                terjadi adalah bukti palsu yang terlihat meyakinkan
                justru di tempat orang memutuskan mau menirunya.

                Yang dinilai sekarang murni angkanya: entry/SL/TP yang
                tercatat, dan hasil yang dihitung server dari lilin
                sungguhan. Keduanya tidak bisa dikarang.

                Sampul yang SUDAH terlanjur ada tetap tampil di kartunya —
                yang ditutup jalan menambahnya, bukan yang sudah ada. */}

            {/* ── Dua persetujuan yang menjadikan seseorang analis ─────────
                Keduanya disetujui SADAR pada tiap posting, bukan diingat:
                tiap sinyal adalah komitmen baru yang tidak bisa ditarik.
                Server menolak tanpa izin jurnal — centangnya bukan hiasan. */}
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3.5 py-3">
                <input type="checkbox" checked={izinJurnal} onChange={(e) => setIzinJurnal(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-emerald-500" />
                {/* KALIMAT INI HARUS TETAP BENAR — dan versi lamanya sudah
                    tidak. Ia menjanjikan jurnal sebagai SYARAT memposting;
                    syarat itu dicabut 17 Agu 2026, dan yang dinilai publik
                    sekarang performa sinyalnya. Persetujuan yang menyebut
                    sesuatu yang tidak lagi terjadi lebih buruk daripada
                    tidak ada persetujuan sama sekali. */}
                <span className="text-[12px] leading-relaxed text-zinc-400">
                  Saya paham yang dinilai orang adalah{' '}
                  <span className="text-zinc-200">hasil sinyal-sinyalku</span> — kena TP atau SL,
                  dihitung otomatis di papan peringkat. Jurnal pribadiku tidak jadi syarat dan
                  tidak dibuka.
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

            {/* PERINGATAN "jurnalmu masih kosong" DIHAPUS. Ia menyuruh orang
                mengisi jurnal untuk sesuatu yang tidak lagi diperiksa siapa
                pun — pekerjaan yang tidak menghasilkan apa-apa, disodorkan
                sebagai keharusan. */}

            {/* Tooltip saja tidak cukup: di layar sentuh ia tidak pernah
                muncul, dan tombol mati tanpa keterangan terbaca sebagai
                halaman rusak — bukan sebagai batas yang disengaja. */}
            {!bolehPosting && (
              <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/[0.04] px-3.5 py-3">
                <p className="text-[12px] leading-relaxed text-zinc-400">
                  <span className="text-sky-300">Mode pratinjau</span> — semua alat terbuka, tapi
                  memposting sinyal belum. Sinyal tidak bisa dihapus setelah terbit dan ikut
                  dihitung papan peringkat, jadi ia menunggu akses dulu. Formulir ini boleh kamu
                  isi sampai ujung untuk melihat isinya.
                </p>
                <Link to="/harga"
                      className="mt-2.5 inline-block rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
                  Lihat paket
                </Link>
              </div>
            )}

            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => void posting()}
                /* Syarat `!judul.trim()` DIHAPUS bersama kolomnya. Ia sempat
                   tertinggal saat kolom Judul dibuang, dan karena judulnya
                   tidak pernah lagi diisi siapa pun, tombolnya terkunci
                   permanen — formulir yang sudah lengkap menolak dikirim
                   tanpa memberi tahu apa yang kurang. */
                /* `snapshot.jumlah === 0` DICABUT dari syarat: jurnal kosong
                   tidak lagi menghalangi siapa pun memposting. Yang tersisa
                   cuma kelengkapan formulir dan dua persetujuan — keduanya
                   soal sinyal yang sedang dikirim, bukan soal masa lalu
                   orangnya. */
                /* `!bolehPosting` DIDAHULUKAN di title supaya alasan yang
                   sebenarnya yang terbaca. Tanpa itu, orang bermode pratinjau
                   dengan formulir separuh terisi membaca "Entry, SL, dan TP
                   harus terisi", melengkapinya, lalu tombolnya tetap mati —
                   petunjuk yang menyuruh mengerjakan sesuatu yang tidak
                   membuka apa pun. */
                disabled={sibuk || !bolehPosting || !ringkas.trim() || !entry || !sl || !tp
                          || !izinJurnal || !pahamPermanen}
                title={!bolehPosting ? 'Mode pratinjau: semua alat terbuka, tapi memposting sinyal perlu akses'
                  : !ringkas.trim() ? 'Isi ringkasan publik dulu — itu yang jadi judul kartunya'
                  : !entry || !sl || !tp ? 'Entry, SL, dan TP harus terisi'
                  : !izinJurnal || !pahamPermanen ? 'Centang kedua persetujuan dulu' : undefined}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Posting — permanen
              </button>
            </div>

            {/* ── KABAR HASIL, TEPAT DI BAWAH TOMBOLNYA ────────────────────
                Dulu ia satu baris abu-abu 12px di KAKI panel — di bawah
                modal pratinjau sampul, jauh dari tombol yang barusan
                ditekan, dan berbentuk sama persis apakah sinyalnya masuk
                atau gagal. Yang memposting jadi harus mencari kalimatnya
                lalu membacanya untuk tahu hasilnya; kalau terlewat, ia
                bolak-balik memeriksa sendiri ke daftar Market.

                Tiga hal yang membuatnya terjawab tanpa dicari:

                1. TEMPAT. Mata sudah ada di tombol, jadi kabarnya muncul
                   di situ juga — bukan di ujung halaman.
                2. WARNA DAN LAMBANG. Hijau berpusat centang untuk berhasil,
                   merah bersegitiga untuk gagal. Terbaca sebelum
                   kalimatnya dibaca.
                3. JALAN KELUAR. Berhasil membawa tombol yang memindahkan
                   ke tab Market — tempat sinyalnya sekarang berada. Itu
                   yang selama ini dikerjakan tangan.

                role="status" + aria-live: pembaca layar mengumumkannya
                sendiri. Tanpa itu, perubahan ini cuma memperbaiki keadaan
                bagi yang melihat layar. */}
            {kabar && (
              <div role="status" aria-live="polite"
                className={cn('mt-3 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed',
                  nada === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : nada === 'galat' ? 'border-red-500/40 bg-red-500/10 text-red-200'
                      : 'border-zinc-700 bg-zinc-900/60 text-zinc-300')}>
                {nada === 'ok' ? <CheckCircle2 className="mt-px size-4 shrink-0" />
                  : nada === 'galat' ? <TriangleAlert className="mt-px size-4 shrink-0" />
                    : <Sparkles className="mt-px size-4 shrink-0" />}
                <div className="min-w-0 grow">
                  <p>{kabar}</p>
                  {nada === 'ok' && (
                    <button onClick={() => setSub('market')}
                      className="mt-2 cursor-pointer rounded-md border border-emerald-500/40 px-2.5 py-1 text-[11.5px] font-medium text-emerald-100 transition-colors hover:bg-emerald-500/15">
                      Lihat sinyalnya di Market
                    </button>
                  )}
                </div>
              </div>
            )}
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

        {/* Baris kabar yang dulu di sini SUDAH PINDAH ke bawah tombol Posting
            (lihat catatan di sana). Tidak digandakan: dua salinan pesan yang
            sama di satu panel membuat orang mengira ada dua kejadian. */}
        {!pengguna && (
          <p className="px-5 pb-4 text-[12.5px] text-zinc-500">Masuk dulu untuk memposting atau membeli analisa.</p>
        )}
      </Panel>
      </div>

      {/* Ikut tampil saat tab Performa dibuka, supaya KEPALA KANAL —
          "← Semua kanal", nama analis, lencana, hitungan, disclaimer —
          tetap ada di KEDUA tab. Kalau blok ini ikut disembunyikan, tab
          Performa menampilkan angka tanpa menyebut angka SIAPA, dan tombol
          kembali ke daftar kanal ikut lenyap: orangnya terjebak. */}
      <div className={cn(sub === 'posting' && 'hidden')}>
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
        /* Yang disematkan naik ke atas, sisanya tetap urut sinyal terbaru.
           Sematan hanya mengubah tampilan orang yang menyematkan — lihat
           lib/pin-analis.ts soal kenapa ia tidak dibuat bersama. */
        const kanalUrut = [...kanal.entries()].sort((x, y) => {
          const px = disematkan(x[0]) ? 1 : 0, py = disematkan(y[0]) ? 1 : 0;
          return py - px || y[1][0].dibuat - x[1][0].dibuat;
        });
        const perfDari = (uid: string) => performa?.analis.find((p) => p.uid === uid) ?? null;
        /* Uang yang dipertaruhkan per sinyal menurut model papan peringkat.
           Dipakai menyatakan drawdown dalam satuan risiko, bukan dolar. */
        const risikoPerSinyal = (performa?.modal ?? 1000) * (performa?.risikoPersen ?? 1) / 100;
        const terpilih = kanalBuka ? kanal.get(kanalBuka) ?? [] : [];

        return kanalBuka === null ? (
          <>
          {/* Petunjuk, bukan hiasan. Klik kanan tidak punya penanda apa pun
              di layar — tidak ada yang menemukannya sendiri, dan fitur yang
              tidak ditemukan sama saja dengan fitur yang tidak ada.

              Satu baris kecil dan redup: ia cuma perlu dibaca sekali seumur
              pemakaian, jadi ia tidak boleh menuntut perhatian tiap kali
              halaman dibuka. */}
          <p className="mb-2.5 text-[11.5px] text-zinc-600">
            Klik kanan kartu analis (atau tekan-tahan di layar sentuh) untuk menyematkannya ke atas.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kanalUrut.map(([uid, sinyal]) => {
              const a0 = sinyal[0];
              const p = perfDari(uid);
              const r = ringkasKanal(sinyal, p, risikoPerSinyal);
              const disemat = disematkan(uid);
              return (
                /* Bukan satu <button> besar lagi: tombol pin ada DI DALAM
                   kartu, dan tombol bersarang di dalam tombol tidak sah —
                   peramban memutus sarangnya sendiri dan salah satunya
                   berhenti bisa diklik. */
                <div key={uid}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuPin({ uid, x: e.clientX, y: e.clientY });
                  }}
                  className={cn('relative rounded-xl border bg-zinc-900/40 transition-colors',
                    /* Tepi kartu TIDAK lagi ikut menguning saat disematkan.
                        Sematan itu urusan tampilan SATU orang — ia tidak
                        mengubah apa pun tentang analisnya — sementara tepi
                        berwarna adalah penanda paling keras yang dimiliki
                        kartu ini, dan di sebelah kartu lain ia terbaca
                        seperti peringkat atau status istimewa.

                        Cukup pinnya yang menyala. Yang menyematkan tahu ia
                        menyematkan; yang lain tidak perlu diberi tahu
                        dengan bingkai. */
                    'border-zinc-800 hover:border-zinc-600')}>
                  {a0.agen && <LencanaAgen geser />}
                  <button onClick={() => setKanalBuka(uid)}
                    className="w-full cursor-pointer p-4 text-left">
                    <div className="flex items-center gap-2.5 pr-8">
                      <AvatarAnalis nama={a0.nama} foto={a0.foto} uid={uid}
                                    className="size-10" kelasHuruf="text-[14px]" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-zinc-100">{a0.nama}</span>
                        <span className="block text-[11px] text-zinc-600">
                          {r.total} sinyal diunggah
                          {uid === pengguna?.uid && ' · kanalmu'}
                        </span>
                      </span>
                    </div>
                    <LencanaKanal r={r} className="mt-2.5" />
                    {/* Winrate & Estimasi dipersempit, kurvanya mengisi
                        kolom ketiga. Dua angka menjawab "berapa"; kurva
                        menjawab "ke mana arahnya" — dan yang terakhir itu
                        yang tidak bisa dibaca dari angka mana pun. Tujuh
                        menang kecil yang kalah oleh dua rugi besar
                        menghasilkan winrate 78% dan kurva yang menurun.

                        Kolom kurvanya PALING LEBAR (1,4fr) walau isinya
                        paling sedikit: garis butuh lebar untuk punya bentuk,
                        sementara angka tidak bertambah jelas karena kotaknya
                        dilebarkan. */}
                    {/* Winrate TANPA kotak; Estimasi dan kurvanya DISATUKAN.

                        Tiga kotak bertepi berjejer membuat kartu ini terbaca
                        sebagai tiga hal setara, padahal dua di antaranya
                        satu hal: "berapa hasilnya" dan "bagaimana bentuk
                        perjalanan hasil itu" adalah angka dan grafik dari
                        deret yang SAMA. Menyatukannya jadi satu kotak
                        menjadikannya satu pernyataan, dan winrate yang
                        berdiri sendiri di kirinya jadi pembanding — bukan
                        anggota ketiga dari daftar yang tidak ada.

                        Winrate kehilangan tepinya karena ia satu angka,
                        bukan satu panel. Kotak yang isinya satu baris teks
                        cuma menambah garis di layar yang sudah penuh kartu
                        bertepi. */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="shrink-0">
                        <div className="text-[10.5px] text-zinc-600">Winrate</div>
                        <div className={cn('angka text-[15px] font-semibold',
                          r.winrate !== null ? (r.winrate >= 50 ? 'text-emerald-400' : 'text-zinc-100') : 'text-zinc-600')}>
                          {r.winrate !== null ? persen(r.winrate) : '—'}
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-zinc-800/60 p-2.5">
                        <div className="shrink-0">
                          <div className="text-[10.5px] text-zinc-600">Estimasi $1.000</div>
                          <div className={cn('angka text-[15px] font-semibold',
                            p ? (p.hasilDolar >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-600')}>
                            {p ? uang(p.hasilDolar, true) : '—'}
                          </div>
                        </div>
                        {/* Kurvanya mengisi sisa lebar, di kanan angkanya.
                            Garis putus-putus di dalamnya modal awal: di
                            atasnya untung, di bawahnya rugi — patokan yang
                            membuat bentuknya bisa dibaca tanpa satu angka.

                            Disembunyikan kalau belum ada sinyal selesai:
                            garis lurus sepanjang kotak bukan informasi, dan
                            ia terbaca seperti akun yang datar padahal
                            artinya belum ada yang bisa digambar. */}
                        <SparklineSaldo sinyal={sinyal} kelas="ml-auto h-[40px] w-full min-w-0"
                          modal={performa?.modal ?? 1000} />
                      </div>
                    </div>
                    <BarisHitung r={r} />
                    {r.winrate === null && (
                      <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
                        Belum ada sinyal yang selesai — angka muncul setelah harga menyentuh SL/TP.
                      </p>
                    )}
                  </button>
                  {/* PENANDA, BUKAN TOMBOL — dan hanya ada kalau memang
                      disematkan. Permintaan pemiliknya, dan ia benar: kartu
                      yang belum disematkan tidak punya urusan apa pun dengan
                      pin, jadi menggambar pin redup di sana cuma menaruh
                      barang di sudut yang isinya angka rekam jejak.

                      pointer-events-none supaya ia tidak mencuri klik yang
                      ditujukan ke kartunya. Yang mencabut sematan menu klik
                      kanan yang sama, bukan ikon ini — satu jalan masuk,
                      satu jalan keluar.

                      Sematan milik penontonnya sendiri dan tidak mengubah
                      urutan papan untuk orang lain. Lihat lib/pin-analis.ts. */}
                  {disemat && (
                    <span title="Disematkan — kanal ini naik ke atas, hanya untuk tampilanmu"
                          className="pointer-events-none absolute right-2 top-2 z-10 p-1.5 text-amber-400">
                      <Pin className="size-3.5 fill-current" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {menuPin && (
            <MenuPin x={menuPin.x} y={menuPin.y}
              disemat={disematkan(menuPin.uid)}
              pilih={() => ubahPin(menuPin.uid)}
              tutup={() => setMenuPin(null)} />
          )}
          </>
        ) : (
          <>
            {/* ── KEPALA KANAL DICABUT — permintaan pemilik ──────────────
                Yang berdiri di sini dulu: nama analis, "· 7 sinyal", lencana
                risiko, baris menang/kalah/jalan/pending, dan satu baris
                disclaimer.

                Semuanya sudah ada di KARTU KANAL di halaman depan — layar
                yang baru saja ditinggalkan orangnya untuk sampai ke sini.
                Mengulangnya membuat dua layar berurutan mengatakan hal yang
                sama, dan yang kedua memakan tinggi layar yang seharusnya
                dipakai sinyalnya sendiri.

                "← Semua kanal" SENGAJA tidak ikut dicabut: ia satu-satunya
                jalan kembali ke daftar, dan mencabutnya akan mengurung
                orangnya di dalam kanal.

                CATATAN UNTUK YANG MENGUBAH INI NANTI: baris disclaimer ikut
                hilang dari sini. Layar ini menampilkan entry/SL/TP dan rekam
                jejak, dan peringatan risiko tingkat halaman (kotak amber di
                atas) cuma tampil di DAFTAR kanal, tidak di dalamnya. Jadi
                sekarang tidak ada satu pun peringatan di layar ini selain
                tautan "Legal" di kaki sidebar. Itu keputusan pemiliknya dan
                dicatat di sini supaya tidak hilang tanpa jejak. */}

            {/* ── DIPISAH TIGA RAK MENURUT KEADAANNYA ────────────────────
                Sebelumnya seluruh sinyal satu kanal berjejer di satu rak
                mendatar tanpa penanda apa pun, jadi order yang HARGANYA
                BELUM DATANG terlihat persis sama dengan posisi yang sudah
                berjalan — dan sama dengan yang sudah selesai berbulan lalu.
                Ketiganya menuntut tindakan yang berbeda: yang menggantung
                masih bisa diikuti, yang berjalan sudah lewat titik masuknya,
                dan yang selesai cuma bahan penilaian.

                Pembedanya `terisi`, BUKAN jenis ordernya: Buy Limit yang
                harganya sudah tersentuh SUDAH jadi posisi berjalan.
                Menghitungnya sebagai "menunggu harga" akan menjanjikan
                peluang yang sebenarnya sudah lewat. */}
            {(() => {
              /* Tab Performa mengganti BADAN kanal saja — kepalanya di atas
                 sengaja dibiarkan berdiri, lihat catatan di pembungkusnya.

                 Isinya masih data contoh bawaan komponennya dan belum
                 tersambung ke sinyal siapa pun. Menunggu instruksi. */
              if (sub === 'performa') return <PerformaKalender sinyal={terpilih} />;
              /* BATAL DIPISAH DARI SELESAI.
                 ────────────────────────────────────────────────────────────
                 Dulu keduanya satu rak, dan itu menyamakan dua hal yang
                 tidak sama: yang kena TP/SL punya hasil yang bisa dinilai,
                 sedangkan yang dibatalkan tidak pernah jadi posisi sama
                 sekali. Menaruhnya berdampingan membuat rak "Sudah selesai"
                 menjanjikan rekam jejak lalu menyisipkan baris yang tidak
                 punya hasil apa-apa di tengahnya. */
              const selesai = terpilih.filter((s) => s.hasil === 'tp' || s.hasil === 'sl');
              const dibatalkan = terpilih.filter((s) => s.hasil === 'batal');
              const belum = terpilih.filter((s) => !s.hasil);
              /* PEMBEDANYA `terisi`, DAN HANYA ITU.
                 ────────────────────────────────────────────────────────────
                 Sebelumnya rak ini menyaring lewat jenisEntry: yang kosong
                 atau "Market" dianggap berjalan. Dua-duanya menebak.

                 jenisEntry baru terisi pada penilaian pertama, jadi sinyal
                 yang baru diposting selalu jatuh ke "Sedang berjalan" dulu,
                 lalu pindah sendiri ke "Menunggu harga" begitu penilai
                 sampai. Itu bug yang dilaporkan pemiliknya, dan bentuknya
                 paling merepotkan di rak: sinyal berpindah kotak tanpa ada
                 apa pun yang terjadi di pasar.

                 `terisi` tidak punya masalah itu. Ia ditulis dari lilin
                 sungguhan, sekali, dan tidak pernah dicabut lagi — jadi
                 perpindahan yang mungkin cuma satu, searah, dan memang
                 karena harganya benar-benar sampai. */
              const berjalan = belum.filter((s) => keadaanSinyal(s) === 'jalan');
              const menunggu = belum.filter((s) => keadaanSinyal(s) !== 'jalan');

              const rak = [
                { kunci: 'jalan' as const, judul: 'Sedang berjalan', isi: berjalan,
                  aktif: 'border-sky-500/60 bg-sky-500/10 text-sky-300',
                  ket: 'Harga sudah menyentuh entry — titik masuknya sudah lewat.' },
                { kunci: 'nunggu' as const, judul: 'Menunggu harga', isi: menunggu,
                  aktif: 'border-amber-500/60 bg-amber-500/10 text-amber-300',
                  ket: 'Order masih menggantung — entry-nya belum tersentuh, jadi rencananya masih bisa diikuti.' },
                { kunci: 'selesai' as const, judul: 'Sudah selesai', isi: selesai,
                  aktif: 'border-zinc-600 bg-zinc-800/60 text-zinc-200',
                  ket: 'Kena TP atau SL. Levelnya terbuka gratis — peluangnya sudah habis, yang tersisa bahan penilaian.' },
                /* RAK KEEMPAT: rencana yang DITARIK sebelum harganya datang.
                   ──────────────────────────────────────────────────────────
                   Ia berdiri sendiri, bukan disatukan dengan "Sudah selesai",
                   karena pertanyaan yang dijawabnya berbeda. Yang kena TP/SL
                   menjawab "seberapa tepat analisnya"; yang dibatalkan
                   menjawab "seberapa jujur ia menarik rencana yang sudah
                   tidak sah".

                   Dua-duanya layak dibaca, dan yang kedua justru bagian yang
                   paling mudah disembunyikan orang kalau kami tidak
                   menyediakan tempatnya. Sinyal tidak bisa dihapus di sini —
                   jadi menarik rencana meninggalkan barisnya, lengkap dengan
                   alasannya, dan rak ini yang menampungnya. */
                { kunci: 'batal' as const, judul: 'Dibatalkan', isi: dibatalkan,
                  aktif: 'border-zinc-700 bg-zinc-800 text-zinc-300',
                  ket: 'Ditarik penulisnya sebelum harga menyentuh entry — jadi tidak ada posisi yang pernah jalan, dan tidak ada uang yang hilang. Alasannya tercatat di tiap kartu.' },
              ];
              /* Tab yang isinya kosong tetap DITAMPILKAN, cuma diredupkan dan
                 tidak bisa ditekan. Menyembunyikannya membuat jumlah tab
                 berubah-ubah antar-kanal, dan orang kehilangan patokan di
                 mana ia sedang berdiri. Nol yang terbaca juga informasi:
                 "analis ini tidak punya satu pun yang menggantung". */
              /* Yang dipilih orangnya menang; kalau ia belum memilih, atau
                 yang dipilihnya kebetulan kosong, jatuh ke rak pertama yang
                 BERISI — bukan ke rak[0].

                 Ini bug yang dilaporkan: analis yang semua sinyalnya sudah
                 selesai membuka kanalnya dan mendapat "Tidak ada sinyal di
                 ruangan ini", padahal ada tujuh di rak sebelah. Bawaannya
                 'jalan', dan 'jalan' kebetulan kosong. Layar yang menjawab
                 "tidak ada" untuk pertanyaan yang tidak diajukan siapa pun
                 terbaca sebagai data yang hilang, bukan sebagai rak yang
                 kebetulan kosong. */
              const dipilih = rak.find((r) => r.kunci === rakAktif);
              const pilih = (dipilih && dipilih.isi.length) ? dipilih
                          : (rak.find((r) => r.isi.length > 0) ?? rak[0]);
              const tampil = pilih.isi;

              return (
                <>
                  <div className="mb-2.5 flex flex-wrap gap-1.5">
                    {rak.map((r) => {
                      const kosong = r.isi.length === 0;
                      const ini = r.kunci === pilih.kunci;
                      return (
                        <button key={r.kunci} disabled={kosong}
                          onClick={() => setRakAktif(r.kunci)}
                          title={r.ket}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors',
                            kosong ? 'cursor-not-allowed border-zinc-800/60 text-zinc-700'
                              : ini ? cn('cursor-pointer', r.aktif)
                              : 'cursor-pointer border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200')}>
                          {r.judul}
                          <span className="angka text-[11px] opacity-70">{r.isi.length}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mb-3 text-[11.5px] leading-relaxed text-zinc-600">{pilih.ket}</p>

                  {tampil.length === 0 ? (
                    <p className="rounded-lg border border-zinc-800/60 px-4 py-6 text-center text-[12px] text-zinc-600">
                      Tidak ada sinyal di ruangan ini.
                    </p>
                  ) : (
                    /* ── DIPISAH MENURUT PASAR, DI KETIGA RAK ─────────────
                       Kripto dan Trade-Fi berjejer rata dulu, dan itu
                       menyamarkan perbedaan yang justru menentukan bisa
                       tidaknya sebuah sinyal diikuti: BTCUSDT jalan terus
                       tujuh hari seminggu, XAUUSD berhenti akhir pekan dan
                       buka lagi Senin. Order yang "menunggu harga" di dua
                       pasar itu bukan keadaan yang sama — yang satu bisa
                       kena malam ini, yang satu menunggu pasar buka.

                       Lotnya juga tidak sebanding, dan eksekusinya di tempat
                       berbeda: Binance untuk yang satu, MT5 untuk yang lain.
                       Orang yang cuma memasang salah satunya perlu tahu
                       mana yang bisa ia tiru tanpa membaca satu per satu.

                       Kelompok KOSONG tidak digambar. Judul "Trade-Fi" di
                       atas rak kosong tidak menerangkan apa pun, dan di rak
                       yang isinya satu pasar saja ia cuma menambah baris. */
                    <div className="space-y-4">
                      {[
                        { kunci: 'kripto' as const, judul: 'Kripto', sumber: 'Binance Futures',
                          isi: tampil.filter(pasarKripto) },
                        { kunci: 'tradefi' as const, judul: 'Trade-Fi', sumber: 'MetaTrader 5',
                          isi: tampil.filter((s) => !pasarKripto(s)) },
                      ].filter((g) => g.isi.length > 0).map((g) => (
                        <div key={g.kunci}>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-[12px] font-medium text-zinc-300">{g.judul}</span>
                            <span className="angka text-[11px] text-zinc-600">{g.isi.length}</span>
                            <span className="text-[11px] text-zinc-700">· {g.sumber}</span>
                            {/* Garis mengisi sisa lebar: ia memisahkan kelompok
                                ini dari yang di bawahnya tanpa menambah kotak
                                bertepi yang berat di layar yang sudah penuh
                                kartu bertepi. */}
                            <span className="h-px flex-1 bg-zinc-800/70" />
                          </div>
                          <div className="flex items-stretch gap-4 overflow-x-auto pb-1">
                            {g.isi.map((a) => (
                              <div key={a.id} className="flex w-[320px] shrink-0">
                                <KartuAnalisa a={a} status={statusku[a.id]}
                                  milikku={a.uid === pengguna?.uid} onSegarkan={segarkan}
                                  performa={performa} hargaKini={hargaUntuk(a.pasangan)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </>
        );
      })()}
      </div>
    </div>
  );
}
