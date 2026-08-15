import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Lock, Unlock, Trash2, Send, LineChart, X, CheckCircle2,
  TrendingUp, TrendingDown, RefreshCw, Radar, Sparkles, ImagePlus, Images, Flag,
} from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { PanelSinyal } from '@/components/panel-sinyal';
import { PerformaSignal } from '@/components/performa-signal';
import { cn, uang, persen, harga as fHarga, tanggalPendek } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useRiwayat, useSaldoAwal } from '@/lib/data';
import { statGabungan, kurvaEkuitas } from '@/lib/hitung';
import { useTutupLuar } from '@/lib/tutup-luar';
import {
  daftarAnalisa, kirimAnalisa, hapusAnalisa, bukaIsi, mintaAkses,
  statusSaya, putuskanAkses, tambahGambar, hapusGambar, kecilkanGambar,
  type RingkasAnalisa, type IsiAnalisa, type PermintaanMasuk, type GambarAnalisa,
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

/* Sparkline kurva ekuitas — SVG polos, tanpa pustaka: 60 titik tidak butuh
   Recharts, dan modal ini harus ringan karena dibuka dari daftar. */
function Sparkline({ kurva }: { kurva: number[] }) {
  if (kurva.length < 2) return <div className="py-6 text-center text-[12px] text-zinc-600">Kurva belum tersedia.</div>;
  const min = Math.min(...kurva), maks = Math.max(...kurva);
  const rentang = maks - min || 1;
  const titik = kurva.map((v, i) =>
    `${(i / (kurva.length - 1)) * 300},${60 - ((v - min) / rentang) * 56 + 2}`).join(' ');
  const naik = kurva[kurva.length - 1] >= kurva[0];
  return (
    <svg viewBox="0 0 300 64" className="h-24 w-full">
      <polyline points={titik} fill="none" stroke={naik ? '#10b981' : '#f87171'} strokeWidth="1.6" />
    </svg>
  );
}

function ModalPortofolio({ a, tutup }: { a: RingkasAnalisa; tutup: () => void }) {
  const s = a.snapshot;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" {...useTutupLuar(tutup)}>
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[14px] font-medium text-zinc-100">Portofolio {a.nama}</div>
            <div className="text-[11.5px] text-zinc-500">
              Diambil otomatis dari jurnalnya saat analisa diposting — bukan diketik tangan.
            </div>
          </div>
          <button onClick={tutup} className="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
            <X className="size-4" />
          </button>
        </div>
        {s ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Saldo', uang(s.saldo)],
                ['Winrate', persen(s.winrate)],
                ['Profit factor', s.pf ? s.pf.toFixed(2) : '—'],
                ['Transaksi', String(s.jumlah)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-zinc-800/60 p-3">
                  <div className="text-[11px] text-zinc-500">{l}</div>
                  <div className="angka mt-0.5 text-[16px] font-semibold text-zinc-100">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-zinc-800/60 p-3">
              <div className="mb-1 text-[11px] text-zinc-500">Kurva ekuitas (60 titik terakhir)</div>
              <Sparkline kurva={s.kurva} />
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-[12.5px] text-zinc-600">Analis ini belum menyertakan snapshot.</p>
        )}
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
function LencanaHasil({ hasil }: { hasil: 'sl' | 'tp' }) {
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

function KartuAnalisa({ a, status, milikku, onSegarkan }: {
  a: RingkasAnalisa;
  status: string | undefined;
  milikku: boolean;
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

  const bisaBuka = milikku || a.harga === 0 || status === 'pembeli';

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

  const selesai = a.hasil === 'sl' || a.hasil === 'tp';

  return (
    /* `relative` wajib: lencana AI Agent duduk absolut di pojok panel. */
    <Panel className={cn('relative p-4', selesai && 'opacity-75')}>
      {a.agen && <LencanaAgen />}
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
              {selesai && <LencanaHasil hasil={a.hasil as 'sl' | 'tp'} />}
            </div>
          )}
          <div className="mt-1 text-[13.5px] font-medium text-zinc-100">{a.judul}</div>
          <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{a.ringkas}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-zinc-500">
            <span>oleh <span className="text-zinc-300">{a.nama}</span></span>
            {a.snapshot && (
              <>
                <span>winrate <span className="angka text-zinc-300">{persen(a.snapshot.winrate)}</span></span>
                <span>PF <span className="angka text-zinc-300">{a.snapshot.pf ? a.snapshot.pf.toFixed(2) : '—'}</span></span>
              </>
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
            {milikku && (
              <button onClick={() => { if (confirm('Hapus analisa ini?')) void hapusAnalisa(a.id).then(onSegarkan); }}
                className="ml-auto flex cursor-pointer items-center gap-1 rounded-md border border-zinc-800 px-2 py-1.5 text-[11.5px] text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400">
                <Trash2 className="size-3.5" /> Hapus
              </button>
            )}
          </div>
        )}
        {kabar && <p className="mt-2 text-[12px] text-amber-300/90">{kabar}</p>}
      </div>

      {lihatPorto && <ModalPortofolio a={a} tutup={() => setLihatPorto(false)} />}
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
  { id: 'sinyal',   label: 'Sinyal' },
  { id: 'performa', label: 'Performa Signal' },
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
  const [sub, setSub] = useState<IdSub>('sinyal');
  const { pengguna } = useAuth();
  const { data: riwayat } = useRiwayat();
  const saldoAwal = useSaldoAwal();
  const [daftar, setDaftar] = useState<RingkasAnalisa[]>([]);
  const [masuk, setMasuk] = useState<PermintaanMasuk[]>([]);
  const [statusku, setStatusku] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(true);
  const [formBuka, setFormBuka] = useState(false);
  const [kabar, setKabar] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const [judul, setJudul] = useState('');
  const [pasangan, setPasangan] = useState('BTCUSDT');
  const [arah, setArah] = useState<'BUY' | 'SELL'>('BUY');
  const [hargaJual, setHargaJual] = useState(5);
  const [ringkas, setRingkas] = useState('');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [alasan, setAlasan] = useState('');

  const segarkan = () => {
    void daftarAnalisa().then(setDaftar).finally(() => setMemuat(false));
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
    };
  }, [riwayat, saldoAwal]);

  async function posting() {
    setSibuk(true); setKabar('');
    try {
      await kirimAnalisa({
        judul: judul.trim(), pasangan: pasangan.trim().toUpperCase(), arah,
        harga: hargaJual, ringkas: ringkas.trim(),
        isi: { entry: Number(entry) || 0, sl: Number(sl) || 0, tp: Number(tp) || 0, alasan: alasan.trim() },
        nama: pengguna?.displayName || pengguna?.email?.split('@')[0] || 'Analis',
        snapshot,
      });
      setKabar('Analisa terposting.');
      setFormBuka(false);
      setJudul(''); setRingkas(''); setEntry(''); setSl(''); setTp(''); setAlasan('');
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

      {sub === 'performa' && <PerformaSignal />}

      <div className={cn(sub !== 'sinyal' && 'hidden')}>
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
          sub="Posting rencana trade-mu — orang menilai dari rekam jejak jurnalmu, bukan dari klaim."
          kanan={
            <span className="flex items-center gap-2">
              <button onClick={segarkan} aria-label="Segarkan"
                className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
                <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} />
              </button>
              {pengguna && (
                <button onClick={() => setFormBuka((v) => !v)}
                  className="cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
                  {formBuka ? 'Tutup form' : 'Posting analisa'}
                </button>
              )}
            </span>
          }
        />
        {formBuka && (
          <div className="border-t border-zinc-800/80 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] text-zinc-500">Judul</label>
                <input value={judul} onChange={(e) => setJudul(e.target.value)} className={KELAS_ISIAN} />
              </div>
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
                <label className="mb-1 block text-[11px] text-zinc-500">Ringkasan publik (terlihat sebelum dibayar — sertakan kontak pembayaranmu)</label>
                <input value={ringkas} onChange={(e) => setRingkas(e.target.value)} className={KELAS_ISIAN} />
              </div>
              <div className="col-span-2 sm:col-span-4">
                <label className="mb-1 block text-[11px] text-zinc-500">Alasan / analisa lengkap (terkunci)</label>
                <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={3}
                  className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5 text-[12.5px] text-zinc-200 outline-none focus-visible:border-zinc-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => void posting()} disabled={sibuk || !judul.trim() || !entry}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Posting
              </button>
              <span className="text-[11.5px] text-zinc-600">
                Rekam jejak jurnalmu ({snapshot.jumlah} transaksi, winrate {persen(snapshot.winrate)}) ikut terlampir otomatis.
              </span>
            </div>
          </div>
        )}
        {kabar && <p className="px-5 pb-4 text-[12px] text-zinc-400">{kabar}</p>}
        {!pengguna && (
          <p className="px-5 pb-4 text-[12.5px] text-zinc-500">Masuk dulu untuk memposting atau membeli analisa.</p>
        )}
      </Panel>

      {/* Daftar */}
      {memuat ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-zinc-500">
          <Loader2 className="size-4 animate-spin" /> Memuat analisa…
        </div>
      ) : daftar.length === 0 ? (
        <Panel className="px-5 py-10 text-center text-[13px] text-zinc-500">
          Belum ada analisa. Jadilah yang pertama memposting.
        </Panel>
      ) : (
        /* Empat berjejer dengan LEBAR TETAP, alasan yang sama dengan rak
           di atas: kartu yang lebarnya ikut jendela membuat tata letaknya
           berubah tiap kali jendela digeser. Yang menggulir cuma barisnya,
           halamannya tidak ikut melebar. */
        <div className="flex gap-4 overflow-x-auto pb-1">
          {daftar.map((a) => (
            <div key={a.id} className="w-[320px] shrink-0">
              <KartuAnalisa a={a} status={statusku[a.id]}
                milikku={a.uid === pengguna?.uid} onSegarkan={segarkan} />
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
